'use strict';

const querystring = require('querystring');
const { httpGet, httpPost, requestWithAutoLogin } = require('../core/utils');
const { createAuthRef } = require('../core/yida-client');
const { throwCommandError, throwUsage } = require('../core/command-errors');
const { t } = require('../core/i18n');

function parseArgs(args = []) {
  const params = { appType: null, explicitRequest: false, confirm: false, help: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { params.help = true; }
    else if (arg === '--prepare') { params.prepare = true; }
    else if (arg === '--output-dir' && args[i + 1] && !args[i + 1].startsWith('-')) { params.outputDir = args[++i]; }
    else if (arg === '--json') { params.json = true; }
    else if (arg === '--explicit-request') { params.explicitRequest = true; }
    else if (arg === '--confirm') { params.confirm = true; }
    else if (!arg.startsWith('-') && !params.appType) { params.appType = arg; }
    else { throwUsage(t('cli_argument.invalid', arg)); }
  }
  if (params.prepare && params.confirm) { throwUsage(t('upgrade_app_theme.prepare_output_required')); }
  return params;
}

// Read only literal fields from the server-rendered admin configuration. Never execute HTML/JS.
function parseThemeContext(html, wanted = ['appType', 'corpId', 'agentAppType']) {
  const fail = () => throwCommandError(t('upgrade_app_theme.context_failed'), { code: 'APP_THEME_CONTEXT_UNVERIFIED' });
  if (typeof html !== 'string') { return fail(); }
  const contexts = [];
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    if (!match[1].includes('window.pageConfig')) { continue; }
    let ast;
    try { ast = require('@babel/standalone').transform(match[1], { ast: true, code: false }).ast; }
    catch (_) { return fail(); }
    for (const statement of ast.program.body) {
      const expr = statement.expression;
      if (expr?.type !== 'AssignmentExpression' || expr.operator !== '=' ||
          expr.left.type !== 'MemberExpression' || expr.left.computed ||
          expr.left.object.name !== 'window' || expr.left.property.name !== 'pageConfig') { continue; }
      if (expr.right.type !== 'ObjectExpression') { return fail(); }
      const context = {};
      for (const prop of expr.right.properties) {
        if (prop.type === 'SpreadElement' || prop.computed) { return fail(); }
        const key = prop.key.name || prop.key.value;
        if (!wanted.includes(key)) { continue; }
        if (Object.hasOwn(context, key) || prop.value?.type !== 'StringLiteral') { return fail(); }
        context[key] = prop.value.value;
      }
      if (wanted.some(key => !Object.hasOwn(context, key))) { return fail(); }
      contexts.push(context);
    }
  }
  if (contexts.length !== 1) { return fail(); }
  return contexts[0];
}

async function readThemeEligibility(appType, auth) {
  const html = await requestWithAutoLogin(current => httpGet(current.baseUrl,
    `/${encodeURIComponent(appType)}/admin`, { _stamp: Date.now() }, { responseType: 'text' }), auth);
  const context = parseThemeContext(html);
  if (context.appType !== appType || !auth.corpId || context.corpId !== auth.corpId) {
    throwCommandError(t('upgrade_app_theme.context_failed'), { code: 'APP_THEME_CONTEXT_UNVERIFIED' });
  }
  // agentAppType is derived by Tianshu from FROM_BUILDER_AI and BUILDER_AI_SOURCE.
  // aiApp/FROM_AI is a separate feature flag and must not be used as provenance.
  if (!['local', 'cloud', 'qwenwork'].includes(context.agentAppType.trim().toLowerCase())) {
    throwCommandError(t('upgrade_app_theme.ai_only'), { code: 'APP_THEME_AI_APP_REQUIRED' });
  }
  return context;
}

/** 升级时将历史导航协议转换为新版值，保留导航结构与已配置的新值。 */
function resolveModernNavigationConfig(previous) {
  const layout = previous.LAY_OUT_DIRECTION;
  const navType = previous.NAVTYPE;
  const targets = {};
  // 旧版 ver 默认是侧导；只有明确的 top_side 结构才恢复 L 型。
  const layouts = { slide: 'side', ver: navType === 'top_side' ? 'l_shape' : 'side',
    hoz: navType === 'top_side' ? 'l_shape' : 'top' };
  if (Object.hasOwn(layouts, layout)) {targets.LAY_OUT_DIRECTION = layouts[layout];}
  // APP_THEME_MODE=modern 的 light 已是新版浅品牌色，重复升级不能把它变成 white。
  const wasLegacy = previous.APP_THEME_MODE !== 'modern';
  const colors = { default: 'light', light: 'white', dark: 'dark', clear: 'white' };
  if (wasLegacy && Object.hasOwn(colors, previous.NAV_THEME)) {targets.NAV_THEME = colors[previous.NAV_THEME];}
  return targets;
}

// Both attestations are required even for callers that bypass the CLI runner.
// They record the agent's authorization checks; they cannot prove a human reply.
async function upgradeAppTheme(params, authRef) {
  if (!params.appType || !/^[A-Za-z0-9_-]+$/.test(params.appType)) {
    throwUsage(t('upgrade_app_theme.usage'));
  }
  const auth = authRef || createAuthRef();
  // Reject ineligible apps before offering upgrade confirmation; flags cannot bypass this gate.
  await readThemeEligibility(params.appType, auth);
  if (params.explicitRequest !== true || params.confirm !== true) {
    throwCommandError(t('upgrade_app_theme.confirm_required'), { code: 'APP_THEME_CONFIRMATION_REQUIRED' });
  }
  const targets = { CREATED_WITH_MODERN_THEME: 'y', APP_THEME_MODE: 'modern' };
  const request = (endpoint, fields) => requestWithAutoLogin((current) => httpPost(
    current.baseUrl,
    `/${encodeURIComponent(params.appType)}/query/app/${endpoint}.json`,
    querystring.stringify({ appType: params.appType, ...fields, _csrf_token: current.csrfToken })
  ), auth);
  const readConfig = async (key) => {
    const response = await request('getSingleConfig', { key });
    const emptyContent = response?.content && typeof response.content === 'object' &&
      !Array.isArray(response.content) && Object.keys(response.content).length === 0;
    if (response?.success !== true || (response.content !== null && typeof response.content !== 'string' && !emptyContent)) {
      throwCommandError(t('upgrade_app_theme.read_failed'), { code: 'APP_THEME_READ_FAILED', details: { key } });
    }
    return emptyContent ? null : response.content;
  };
  // Read theme and navigation before writing anything; these endpoints are not transactional.
  const previous = {};
  for (const key of [...Object.keys(targets), 'LAY_OUT_DIRECTION', 'NAV_THEME', 'NAVTYPE']) {
    previous[key] = await readConfig(key);
  }
  const navigationTargets = resolveModernNavigationConfig(previous);
  // 先写导航，再启用主题，避免配色/布局迁移失败后留下已启用的新主题。
  const allTargets = { ...navigationTargets, ...targets };
  const verifiedWrites = [];
  let attemptedKey;
  try {
    for (const [key, value] of Object.entries(allTargets)) {
      if (previous[key] === value) { continue; }
      attemptedKey = key;
      const response = await request('updateSingleConfig', { key, value });
      if (response?.success !== true || response.content !== true) {
        throwCommandError(t('upgrade_app_theme.write_failed'), { code: 'APP_THEME_UPGRADE_FAILED' });
      }
      if (await readConfig(key) !== value) {
        throwCommandError(t('upgrade_app_theme.verify_failed'), { code: 'APP_THEME_NOT_PERSISTED' });
      }
      verifiedWrites.push(key);
    }
    // Verify all migration targets again after writes; each value needs independent readback.
    if (attemptedKey) {
      for (const [key, value] of Object.entries(allTargets)) {
        if (await readConfig(key) !== value) {
          throwCommandError(t('upgrade_app_theme.verify_failed'), { code: 'APP_THEME_NOT_PERSISTED' });
        }
      }
    }
  } catch (error) {
    throwCommandError(attemptedKey ? t('upgrade_app_theme.incomplete') : error.message, {
      code: error.code || 'APP_THEME_UPGRADE_FAILED',
      details: { appType: params.appType, previous, attemptedKey, verifiedWrites,
        configVerified: false, writeOutcomeMayBePartial: Boolean(attemptedKey) },
    });
  }
  return { success: true, appType: params.appType, changed: verifiedWrites.length > 0,
    verified: true, verificationScope: 'config', runtimeVerified: false, appUpgradeComplete: false,
    nextStep: 'migrate-pages-and-clean-form-styles-with-yida-upgrade-app-theme', previous,
    createdWithModernTheme: 'y', appThemeMode: 'modern', navigation: {
      layoutDirection: navigationTargets.LAY_OUT_DIRECTION || previous.LAY_OUT_DIRECTION,
      navTheme: navigationTargets.NAV_THEME || previous.NAV_THEME,
    }, updatedKeys: verifiedWrites };

}

async function run(args = []) {
  const params = parseArgs(args);
  if (params.help) {
    const { usage } = require('../core/chalk');
    usage(t('upgrade_app_theme.usage'), t('upgrade_app_theme.confirm_required'));
    return;
  }
  if (params.prepare) {
    if (!params.appType || !/^[A-Za-z0-9_-]+$/.test(params.appType)) {
      throwUsage(t('upgrade_app_theme.prepare_output_required'));
    }
    const auth = createAuthRef();
    await readThemeEligibility(params.appType, auth);
    if (!params.explicitRequest || !params.outputDir) {
      throwUsage(t('upgrade_app_theme.prepare_output_required'));
    }
    const { prepareAppThemeUpgrade } = require('./prepare-app-theme-upgrade');
    const prepared = await prepareAppThemeUpgrade(params, auth);
    if (!prepared.success) {
      throwCommandError(t('upgrade_app_theme.prepare_blocked'), {
        code: 'APP_THEME_PREPARE_BLOCKED', details: { manifestFile: prepared.manifestFile, blockedCount: prepared.blockedCount },
      });
    }
    console.log(JSON.stringify(prepared));
    return prepared;
  }
  if (params.outputDir) { throwUsage(t('upgrade_app_theme.prepare_output_required')); }
  const output = await upgradeAppTheme(params);
  console.log(JSON.stringify(output));
  return output;
}

module.exports = { parseArgs, parseThemeContext, readThemeEligibility, upgradeAppTheme, run };
