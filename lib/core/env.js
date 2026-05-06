/**
 * env.js - 宜搭 CLI 环境检测
 *
 * 通过环境变量 + 文件特征检测当前运行环境，并输出环境信息。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  detectActiveTool,
  findProjectRoot,
  loadCookieData,
  resolveBaseUrl,
  extractInfoFromCookies,
  resolveWukongWorkspaceRoot,
} = require('./utils');
const { t } = require('./i18n');

const home = os.homedir();

/**
 * 获取所有已安装的 AI 工具列表（用于展示）。
 * 不判断当前是否活跃，只判断是否安装过。
 * 使用 path.join 拼接路径，兼容 Windows 和 macOS/Linux。
 *
 * @returns {Array} 已安装工具列表
 */
function getInstalledTools() {
  const tools = [
    { dirName: '.real', displayName: '悟空（Wukong）' },
    { dirName: '.codex', displayName: 'Codex' },
    // Windows 上配置目录为 ~/.config/opencode，macOS/Linux 为 ~/.opencode
    {
      dirName: process.platform === 'win32' ? path.join('.config', 'opencode') : '.opencode',
      displayName: 'OpenCode',
    },
    { dirName: '.claudecode', displayName: 'Claude Code' },
    { dirName: '.aone_copilot', displayName: 'Aone Copilot' },
    { dirName: '.cursor', displayName: 'Cursor' },
    { dirName: '.qoder', displayName: 'Qoder' },
  ];

  return tools.filter(({ dirName }) => {
    return fs.existsSync(path.join(home, dirName));
  });
}

/**
 * 检测当前 AI 工具环境。
 * 返回当前活跃工具信息和所有已安装工具列表。
 */
function detectEnvironment() {
  const activeTool = detectActiveTool();
  const installedTools = getInstalledTools();
  const cwdProject = path.join(process.cwd(), 'project');

  // 构建结果列表
  const results = installedTools.map(({ dirName, displayName }) => {
    const isWukong = dirName === '.real';
    const isActive = activeTool && activeTool.dirName === dirName;
    // path.join 在 Windows 上自动使用反斜杠，兼容所有平台
    const workspaceRoot = isWukong
      ? resolveWukongWorkspaceRoot(process.env.AGENT_WORK_ROOT || path.join(home, '.real', 'workspace'))
      : cwdProject;
    const hasProject = fs.existsSync(workspaceRoot);

    return {
      displayName,
      dirName,
      isActive: !!isActive,
      hasProject,
      workspaceRoot,
    };
  });

  // 当前生效环境
  const activeToolName = activeTool ? activeTool.displayName : null;
  const activeProjectRoot = activeTool ? activeTool.workspaceRoot : null;

  return { activeToolName, activeProjectRoot, results };
}
function getCookieDiagnostics(projectRoot) {
  const { getCurrentEnvConfig, getCookieFilePath } = require('./env-manager');
  const currentEnv = getCurrentEnvConfig(projectRoot);
  const envCookieFile = getCookieFilePath(projectRoot);
  const legacyCookieFile = path.join(projectRoot, '.cache', 'cookies.json');
  const envCookieFileFound = fs.existsSync(envCookieFile);
  const legacyCookieFileFound = fs.existsSync(legacyCookieFile);
  const selectedCookieFile = envCookieFileFound ? envCookieFile : legacyCookieFile;

  return {
    currentEnv: currentEnv.name,
    configuredCookieFile: envCookieFile,
    legacyCookieFile,
    cookieFile: selectedCookieFile,
    cookieFileFound: envCookieFileFound || legacyCookieFileFound,
    usedLegacyCookieFile: !envCookieFileFound && legacyCookieFileFound,
  };
}

/**
 * 检测登录态信息。
 */
function detectLoginStatus(projectRoot) {
  const cookieDiagnostics = getCookieDiagnostics(projectRoot);
  const cookieData = loadCookieData(projectRoot);
  const cookies = cookieData && Array.isArray(cookieData.cookies) ? cookieData.cookies : [];

  if (!cookieData || !cookieData.cookies) {
    return {
      loggedIn: false,
      canAutoUse: false,
      csrfToken: null,
      corpId: null,
      userId: null,
      baseUrl: null,
      cookiesCount: 0,
      diagnostics: {
        ...cookieDiagnostics,
        cacheReadable: false,
        cookiesArrayFound: false,
        csrfTokenFound: false,
        corpIdFound: false,
        userIdFound: false,
        baseUrlFound: false,
        failureReason: cookieDiagnostics.cookieFileFound ? 'cookie_cache_unreadable_or_invalid' : 'cookie_cache_missing',
      },
    };
  }

  const { csrfToken, corpId, userId } = extractInfoFromCookies(cookies);
  const baseUrl = resolveBaseUrl(cookieData);
  const loggedIn = !!csrfToken;

  return {
    loggedIn,
    canAutoUse: loggedIn,
    csrfToken,
    corpId,
    userId,
    baseUrl,
    cookiesCount: cookies.length,
    diagnostics: {
      ...cookieDiagnostics,
      cacheReadable: true,
      cookiesArrayFound: Array.isArray(cookieData.cookies),
      csrfTokenFound: !!csrfToken,
      corpIdFound: !!corpId,
      userIdFound: !!userId,
      baseUrlFound: !!baseUrl,
      failureReason: loggedIn ? null : 'csrf_token_missing',
    },
  };
}

function maskSecret(value) {
  if (!value) {return null;}
  return `${value.slice(0, 16)}...`;
}

/**
 * 构建适合 AI agent 读取的环境快照。
 */
function buildEnvironmentSnapshot() {
  const environment = detectEnvironment();
  const projectRoot = (environment.activeProjectRoot && fs.existsSync(environment.activeProjectRoot))
    ? environment.activeProjectRoot
    : findProjectRoot();
  const loginStatus = detectLoginStatus(projectRoot);

  return {
    ok: true,
    system: {
      platform: process.platform,
      arch: os.arch(),
      node: process.version,
      home: os.homedir(),
      cwd: process.cwd(),
    },
    active: {
      tool: environment.activeToolName,
      toolKey: environment.results.find((item) => item.isActive)?.dirName || null,
      isWukong: environment.results.some((item) => item.isActive && item.dirName === '.real'),
      projectRoot,
      projectRootExists: fs.existsSync(projectRoot),
      hasConfig: fs.existsSync(path.join(projectRoot, 'config.json')),
    },
    tools: environment.results,
    login: {
      loggedIn: loginStatus.loggedIn,
      canAutoUse: loginStatus.canAutoUse,
      baseUrl: loginStatus.baseUrl,
      corpId: loginStatus.corpId,
      userId: loginStatus.userId,
      csrfToken: maskSecret(loginStatus.csrfToken),
      cookiesCount: loginStatus.cookiesCount,
      diagnostics: loginStatus.diagnostics,
    },
  };
}

/**
 * 执行环境检测并打印结果。
 */
function run(args = []) {
  if (args.includes('--json')) {
    console.log(JSON.stringify(buildEnvironmentSnapshot(), null, 2));
    return;
  }

  const { c, sep, banner, success, warn, label } = require('./chalk');

  banner(t('env.title'), { stderr: false });

  // ── 系统信息 ──────────────────────────────────────
  console.log(`\n  ${c.bold}${c.cyan}${t('env.system_info').replace(/^[\s─=]+/, '').replace(/[\s─=]+$/, '')}${c.reset}`);
  label('OS', `${process.platform} ${os.arch()}`, { stderr: false });
  label('Node', process.version, { stderr: false });
  label('Home', os.homedir(), { stderr: false });
  label('CWD', process.cwd(), { stderr: false });

  // ── AI 工具检测 ────────────────────────────────────
  console.log(`\n  ${c.bold}${c.cyan}${t('env.ai_tools').replace(/^[\s─=]+/, '').replace(/[\s─=]+$/, '')}${c.reset}`);
  const { activeToolName, activeProjectRoot, results } = detectEnvironment();

  if (results.length === 0) {
    warn(t('env.no_tools'), false);
  } else {
    for (const { displayName, isActive, hasProject } of results) {
      let statusIcon, note;
      if (isActive && hasProject) {
        statusIcon = `${c.green}✔${c.reset}`;
        note = `${c.green}${t('env.tool_active_ready')}${c.reset}`;
      } else if (isActive && !hasProject) {
        statusIcon = `${c.yellow}●${c.reset}`;
        note = `${c.yellow}${t('env.tool_active_no_project')}${c.reset}`;
      } else if (!isActive && hasProject) {
        statusIcon = `${c.dim}○${c.reset}`;
        note = `${c.dim}${t('env.tool_installed_has_project')}${c.reset}`;
      } else {
        statusIcon = `${c.dim}○${c.reset}`;
        note = `${c.dim}${t('env.tool_installed')}${c.reset}`;
      }
      console.log(`      ${statusIcon} ${displayName.padEnd(18)} ${note}`);
    }
  }

  // ── 当前生效环境 ───────────────────────────────────
  console.log(`\n  ${c.bold}${c.cyan}${t('env.active_env').replace(/^[\s─=]+/, '').replace(/[\s─=]+$/, '')}${c.reset}`);
  if (activeToolName && activeProjectRoot) {
    label('AI Tool', `${c.green}${activeToolName}${c.reset}`, { stderr: false });
    label('Project', activeProjectRoot, { stderr: false });
  } else {
    const activeOnly = results.filter((r) => r.isActive);
    if (activeOnly.length > 0) {
      warn(t('env.active_no_project', activeOnly.map((r) => r.displayName).join(', ')), false);
    } else {
      warn(t('env.no_active_tool'), false);
    }
    label('Fallback', process.cwd(), { stderr: false });
  }

  // ── 登录态检测 ─────────────────────────────────────
  console.log(`\n  ${c.bold}${c.cyan}${t('env.login_status').replace(/^[\s─=]+/, '').replace(/[\s─=]+$/, '')}${c.reset}`);
  const projectRoot = (activeProjectRoot && fs.existsSync(activeProjectRoot))
    ? activeProjectRoot
    : findProjectRoot();
  const loginStatus = detectLoginStatus(projectRoot);

  if (loginStatus.loggedIn) {
    success(t('env.logged_in'), false);
    label('Base URL', loginStatus.baseUrl, { stderr: false });
    label('Corp ID', loginStatus.corpId || t('env.unknown'), { stderr: false });
    label('User ID', loginStatus.userId || t('env.unknown'), { stderr: false });
    label('CSRF', `${loginStatus.csrfToken ? loginStatus.csrfToken.slice(0, 16) : 'N/A'}…`, { stderr: false });
  } else {
    warn(t('env.not_logged_in'), false);
  }

  console.log(`\n  ${sep()}\n`);
}

module.exports = { run, detectEnvironment, detectLoginStatus, buildEnvironmentSnapshot };
