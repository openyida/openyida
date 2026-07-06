#!/usr/bin/env node
/**
 * openyida - 宜搭命令行工具
 *
 * 安装：npm install -g openyida
 * 用法：openyida <命令> [参数]（别名：yida）
 *
 * 命令清单维护在 lib/core/command-manifest.js，供 help 和 agent JSON 共用。
 */

'use strict';

const { version: currentVersion } = require('../package.json');
const { t } = require('../lib/core/i18n');
const { warn } = require('../lib/core/chalk');
const { CliError, isCliError, toErrorPayload } = require('../lib/core/cli-error');
const { COMMAND_GROUPS, buildCommandManifest } = require('../lib/core/command-manifest');

const command = process.argv[2];
const args = process.argv.slice(3);

function isAgentEnvironment(env) {
  return !!(
    env.CODEX_SHELL ||
    env.CODEX_CI ||
    env.CODEX_THREAD_ID ||
    env.CODEX_HOME ||
    env.CLAUDE_CODE ||
    env.CLAUDE_CODE_ENTRYPOINT ||
    env.MULERUN_CHAT_ID ||
    env.MULE_DATA_DIR ||
    env.OPENCODE ||
    env.OPENCODE_CLIENT ||
    env.QODER_IDE ||
    env.QODER_AGENT ||
    env.QODERCLI_INTEGRATION_MODE ||
    env.CURSOR_TRACE_ID ||
    env.AGENT_WORK_ROOT ||
    env.OPENYIDA_AGENT_MODE ||
    (env.__CFBundleIdentifier || '').toLowerCase().includes('codex') ||
    (env.__CFBundleIdentifier || '').toLowerCase().includes('qoder')
  );
}

function shouldRunUpdateCheck() {
  if (process.env.OPENYIDA_SKIP_UPDATE_CHECK || process.env.NO_UPDATE_NOTIFIER) {
    return false;
  }
  if (process.env.CI || isAgentEnvironment(process.env)) {
    return false;
  }
  if (!process.stderr.isTTY) {
    return false;
  }
  if (!command || command === '--help' || command === '-h' || command === '--version' || command === '-v') {
    return false;
  }
  if (command === 'commands' || command === 'mcp') {
    return false;
  }
  if (args.includes('--json') || args.includes('--check-only')) {
    return false;
  }
  return true;
}

function maybeCheckForUpdate() {
  if (!shouldRunUpdateCheck()) {
    return;
  }
  const { checkUpdate } = require('../lib/core/check-update');
  checkUpdate(currentVersion).catch(() => {});
}

maybeCheckForUpdate();

function shouldUseEnvManagement(argsList) {
  const subCommand = argsList[0];
  return !!subCommand && subCommand !== '--json';
}

function printHelp() {
  const RESET   = '\x1b[0m';
  const BOLD    = '\x1b[1m';
  const DIM     = '\x1b[2m';
  const CYAN    = '\x1b[36m';
  const GREEN   = '\x1b[32m';
  const YELLOW  = '\x1b[33m';

  const SEP = `${DIM}${'─'.repeat(60)}${RESET}`;

  /**
   * 渲染一组命令列表。
   * @param {string} groupTitle - 分组标题
   * @param {Array<[string, string]>} commands - [命令, 描述] 数组
   */
  function renderGroup(groupTitle, commands) {
    console.log(`\n  ${BOLD}${CYAN}${groupTitle}${RESET}`);
    const maxCmdLen = Math.max(...commands.map(([cmd]) => cmd.length));
    const padWidth = Math.min(maxCmdLen + 2, 50);
    for (const [cmd, desc] of commands) {
      if (cmd.length >= padWidth) {
        console.log(`    ${GREEN}${cmd}${RESET}`);
        console.log(`      ${DIM}${desc}${RESET}`);
      } else {
        console.log(`    ${GREEN}${cmd.padEnd(padWidth)}${RESET}${DIM}${desc}${RESET}`);
      }
    }
  }

  // ── 标题 ──
  console.log('');
  console.log(`  ${BOLD}${CYAN}OpenYida${RESET} ${DIM}v${currentVersion}${RESET}`);
  console.log(`  ${DIM}${t('help.subtitle')}${RESET}`);
  console.log(`  ${DIM}"We are on the verge of the Singularity"${RESET}`);
  console.log('');
  console.log(`  ${YELLOW}${t('help.usage')}${RESET}  openyida <command> [args...]`);
  console.log(`  ${DIM}${t('help.alias')}${RESET}  yida`);
  console.log(SEP);

  for (const group of COMMAND_GROUPS) {
    renderGroup(
      t(group.titleKey),
      group.commands
        .filter(entry => !entry.hidden)
        .map(entry => [entry.usage, t(entry.descriptionKey)])
    );
  }

  // ── 快速上手 ──
  console.log(SEP);
  console.log(`\n  ${BOLD}${CYAN}${t('help.quickstart_title')}${RESET}`);
  console.log(`    ${DIM}${RESET} openyida login`);
  console.log(`    ${DIM}${RESET} openyida create-app "${t('help.quickstart_app_name')}"`);
  console.log(`    ${DIM}${RESET} openyida create-form create APP_XXX "${t('help.quickstart_form_name')}" .cache/openyida/forms/fields.json`);
  console.log(`    ${DIM}${RESET} openyida dws contact user search --keyword "张三"`);
  console.log('');
  console.log(`  ${DIM}${t('help.docs')} https://openyida.ai  ·  https://github.com/openyida/openyida${RESET}`);
  console.log('');
}

/**
 * 检测是否首次运行（安装后第一次执行 openyida 命令）。
 * 通过 ~/.openyida/first-run-done 标记文件判断。
 * 若是首次运行，打印新手引导并写入标记文件。
 */
function handleFirstRunGuide() {
  const os = require('os');
  const path = require('path');
  const fs = require('fs');

  const OPENYIDA_DIR = path.join(os.homedir(), '.openyida');
  const FIRST_RUN_FLAG = path.join(OPENYIDA_DIR, 'first-run-done');

  // 已运行过，跳过引导
  if (fs.existsSync(FIRST_RUN_FLAG)) {return;}

  // 写入标记，避免重复展示
  try {
    fs.mkdirSync(OPENYIDA_DIR, { recursive: true });
    fs.writeFileSync(FIRST_RUN_FLAG, new Date().toISOString(), 'utf8');
  } catch {
    // 写入失败不影响主流程
  }

  const RESET   = '\x1b[0m';
  const BOLD    = '\x1b[1m';
  const DIM     = '\x1b[2m';
  const CYAN    = '\x1b[36m';
  const GREEN   = '\x1b[32m';
  const YELLOW  = '\x1b[33m';
  const BLUE    = '\x1b[34m';
  const MAGENTA = '\x1b[35m';
  const BG_CYAN = '\x1b[46m';
  const WHITE   = '\x1b[37m';

  const SEP = `${DIM}${'─'.repeat(60)}${RESET}`;

  console.log('');
  console.log(`${BG_CYAN}${WHITE}${BOLD}${t('cli.first_run_title')}${RESET}`);
  console.log(SEP);
  console.log(t('cli.first_run_welcome', `${GREEN}${BOLD}`, RESET));
  console.log('');
  console.log(`${BOLD}${CYAN}${t('cli.first_run_way1_title')}${RESET}`);
  console.log(t('cli.first_run_way1_desc'));
  console.log('');
  console.log(`  ${YELLOW}${t('cli.first_run_prompt1')}${RESET}`);
  console.log(`  ${YELLOW}${t('cli.first_run_prompt2')}${RESET}`);
  console.log(`  ${YELLOW}${t('cli.first_run_prompt3')}${RESET}`);
  console.log('');
  console.log(`${BOLD}${CYAN}${t('cli.first_run_way2_title')}${RESET}`);
  console.log('');
  console.log(`  ${YELLOW}${t('cli.first_run_prompt4')}${RESET}`);
  console.log('');
  console.log(`${BOLD}${CYAN}${t('cli.first_run_examples_title')}${RESET}`);
  console.log('');
  console.log(`  ${MAGENTA}•${RESET} ${t('cli.first_run_examples')}`);
  console.log('');
  console.log(SEP);
  console.log(`${BOLD}${BLUE}${t('cli.first_run_tips_title')}${RESET}`);
  console.log('');
  console.log(t('cli.first_run_tip1', CYAN, RESET));
  console.log(t('cli.first_run_tip2', CYAN, RESET));
  console.log(t('cli.first_run_tip3'));
  console.log('');
  console.log(SEP);
  console.log(`  ${DIM}${t('cli.first_run_footer1')}${RESET}`);
  console.log(`  ${DIM}${t('cli.first_run_footer2')}${RESET}`);
  console.log('');
  console.log(`  ${DIM}${t('cli.first_run_footer3')}${RESET}`);
  console.log('');
}

function printLoginResult(result) {
  noteLoginCommandResult(result);

  if (!result) {
    console.log(JSON.stringify({
      ok: false,
      status: 'login_failed',
      can_auto_use: false,
      error: 'login_failed',
    }));
    return;
  }

  if (result && (result.status === 'need_qr_scan' || result.status === 'need_corp_selection')) {
    console.log(JSON.stringify(result));
    return;
  }

  if (result && result.status === 'need_codex_browser_login') {
    const handoff = {
      status: result.status,
      handoff_type: result.handoff_type || 'browser',
      can_auto_use: false,
      browser: result.browser,
      login_url: result.login_url,
      message: result.message,
    };
    [
      'agent_action',
      'browser_open_strategy',
      'browser_use_local_redirect_fallback',
      'required_agent_tool',
      'required_runtime_tool',
      'cookie_export_file',
      'cookie_file',
      'post_login_check_command',
      'fallback_command',
    ].forEach((key) => {
      if (result[key]) {handoff[key] = result[key];}
    });
    console.log(JSON.stringify(handoff));
    return;
  }

  if (result.status && result.status !== 'ok' && !result.csrf_token) {
    console.log(JSON.stringify(result));
    return;
  }

  const summary = {
    ok: true,
    base_url: result && result.base_url,
    corp_id: result && result.corp_id,
    user_id: result && result.user_id,
    csrf_token: result && result.csrf_token ? `${result.csrf_token.slice(0, 16)}...` : undefined,
    cookies_count: Array.isArray(result && result.cookies) ? result.cookies.length : 0,
  };
  console.log(JSON.stringify(summary));
}

function noteLoginCommandResult(result) {
  try {
    const { recordLoginEvent, printLoginLoopFeedbackHint } = require('../lib/feedback/feedback');
    let status = 'failed';
    let reason = 'login_failed';

    if (result && (result.csrf_token || (result.status === 'ok' && result.can_auto_use))) {
      status = 'success';
      reason = 'login_ok';
    } else if (result && result.status === 'need_qr_scan') {
      status = 'need_qr_scan';
      reason = 'need_qr_scan';
    } else if (result && result.status === 'need_codex_browser_login') {
      status = 'need_browser_login';
      reason = 'need_browser_login';
    } else if (result && result.status === 'need_corp_selection') {
      status = 'success';
      reason = 'need_corp_selection';
    } else if (result && result.status) {
      reason = result.status;
    }

    const loopStatus = recordLoginEvent(status, {
      mode: args.join(' ') || 'default',
      reason,
      command: 'openyida login',
    });
    if (status !== 'success') {
      printLoginLoopFeedbackHint(loopStatus);
    }
  } catch {
    // Login feedback tracking is best-effort and must not affect CLI output.
  }
}

function isAgentConversationEnvironment() {
  const { detectActiveTool } = require('../lib/core/utils');
  return !!detectActiveTool() || process.env.OPENYIDA_AGENT_MODE === '1';
}

function shouldUseBrowserHandoffLogin(cliArgs) {
  if (cliArgs.includes('--qr') || cliArgs.includes('--codex-qr') || cliArgs.includes('--agent-qr')) {return false;}
  if (cliArgs.includes('--browser') || cliArgs.includes('--codex') || cliArgs.includes('--qoder') || cliArgs.includes('--wukong')) {return true;}
  return false;
}

function shouldUseAgentLogin(cliArgs) {
  if (cliArgs.includes('--qr') || cliArgs.includes('--codex-qr') || cliArgs.includes('--agent-qr')) {return false;}
  if (shouldUseBrowserHandoffLogin(cliArgs)) {return false;}
  return isAgentConversationEnvironment();
}

function shouldUsePlaywrightFallbackInAgentLogin() {
  const { hasDesktopEnvironment } = require('../lib/core/utils');
  return hasDesktopEnvironment() || process.env.OPENYIDA_AGENT_PLAYWRIGHT_FALLBACK === '1';
}

function shouldUseDesktopBrowserLogin() {
  const { hasDesktopEnvironment } = require('../lib/core/utils');
  return hasDesktopEnvironment();
}

function shouldUseCodexQrLogin(cliArgs) {
  if (cliArgs.includes('--codex-qr') || cliArgs.includes('--agent-qr')) {return true;}
  return false;
}

function getArgValue(cliArgs, name) {
  const index = cliArgs.indexOf(name);
  if (index === -1 || !cliArgs[index + 1] || cliArgs[index + 1].startsWith('--')) {
    return null;
  }
  return cliArgs[index + 1];
}

function parseLoginTargetArg(value) {
  const raw = String(value || '').trim();
  if (!raw) {return null;}

  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  if (!hasProtocol) {
    if (raw.startsWith('/') || raw.startsWith('.') || raw.includes('\\')) {return null;}
    const hostPart = raw.split('/')[0];
    if (!hostPart.includes('.') && hostPart !== 'localhost') {return null;}
  }

  try {
    return new URL(hasProtocol ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

function applyLoginTargetUrl(value) {
  const parsedUrl = parseLoginTargetArg(value);
  if (!parsedUrl) {return false;}

  const {
    deriveBaseUrlFromDingtalkOAuthUrl,
    inferEnvironmentNameFromUrl,
    inferLoginUrlForBaseUrl,
    normalizeBaseUrl,
    normalizeHostname,
  } = require('../lib/core/env-manager');

  const targetHref = parsedUrl.href;
  const redirectBaseUrl = deriveBaseUrlFromDingtalkOAuthUrl(targetHref, null);
  const endpoint = normalizeBaseUrl(redirectBaseUrl || parsedUrl.origin, null);
  const inferredEnv = inferEnvironmentNameFromUrl(redirectBaseUrl || targetHref);

  if (inferredEnv) {
    process.env.OPENYIDA_ENV = inferredEnv;
  }
  if (endpoint) {
    process.env.OPENYIDA_ENDPOINT = endpoint;
  }

  const host = normalizeHostname(targetHref);
  const isDingtalkLoginHost = host.endsWith('dingtalk.com') || host.endsWith('dingtalk.io');
  const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '') || '/';
  const hasCustomLoginPath = normalizedPath !== '/' && normalizedPath !== '/workPlatform';
  process.env.OPENYIDA_LOGIN_URL = isDingtalkLoginHost || hasCustomLoginPath
    ? targetHref
    : inferLoginUrlForBaseUrl(endpoint || parsedUrl.origin);

  return true;
}

function applyLoginEnvironmentFlags(cliArgs, options = {}) {
  const envFlagMap = {
    '--public': 'public',
    '--intl': 'intl',
    '--overseas': 'intl',
    '--international': 'intl',
    '--global': 'intl',
    '--yidaapps': 'intl',
    '--alibaba': 'alibaba',
    '--internal': 'alibaba',
    '--intranet': 'alibaba',
  };
  const valuePassthroughFlags = new Set([
    '--agent-poll',
    '--codex-poll',
    '--agent-select',
    '--codex-select',
    '--corp-id',
  ]);
  const targetUrlFlags = new Set([
    '--endpoint',
    '--base-url',
    '--login-url',
  ]);
  const inferTargetUrl = !!options.inferTargetUrl;
  const filteredArgs = [];

  for (let index = 0; index < cliArgs.length; index++) {
    const arg = cliArgs[index];
    if (arg === '--env') {
      const envName = cliArgs[index + 1];
      if (envName && !envName.startsWith('--')) {
        process.env.OPENYIDA_ENV = envName;
        index++;
      }
      continue;
    }
    if (inferTargetUrl && targetUrlFlags.has(arg)) {
      const targetUrl = cliArgs[index + 1];
      if (targetUrl && !targetUrl.startsWith('--') && applyLoginTargetUrl(targetUrl)) {
        index++;
        continue;
      }
    }
    if (valuePassthroughFlags.has(arg)) {
      filteredArgs.push(arg);
      if (cliArgs[index + 1] && !cliArgs[index + 1].startsWith('--')) {
        filteredArgs.push(cliArgs[index + 1]);
        index++;
      }
      continue;
    }
    if (envFlagMap[arg]) {
      process.env.OPENYIDA_ENV = envFlagMap[arg];
      continue;
    }
    if (inferTargetUrl && !arg.startsWith('--') && applyLoginTargetUrl(arg)) {
      continue;
    }
    filteredArgs.push(arg);
  }

  return filteredArgs;
}

function applyGlobalEnvironmentFlags() {
  const filteredArgs = applyLoginEnvironmentFlags(args);
  args.splice(0, args.length, ...filteredArgs);
}

// 解析全局 --quiet 开关：从 args 中剔除并设置 YIDA_QUIET=1，让 chalk.js
// 的所有装饰输出（banner/step/info/...）变 no-op，AI 即可直接 `... --quiet | jq`。
function applyQuietFlag() {
  const idx = args.indexOf('--quiet');
  if (idx !== -1) {
    process.env.YIDA_QUIET = '1';
    args.splice(idx, 1);
  }
}

function throwCliUsage(...lines) {
  throw new CliError(lines.filter(Boolean).join('\n'), {
    code: 'INVALID_ARGUMENTS',
  });
}

function throwNeedLogin(message) {
  throw new CliError(message, {
    code: 'NEED_LOGIN',
  });
}

async function main() {
  applyQuietFlag();
  applyGlobalEnvironmentFlags();

  if (!command || command === '--help' || command === '-h') {
    handleFirstRunGuide();
    printHelp();
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log(currentVersion);
    return;
  }

  switch (command) {
    case 'commands': {
      const manifest = buildCommandManifest({ t, version: currentVersion });
      console.log(JSON.stringify(manifest, null, 2));
      break;
    }

    case 'mcp': {
      const { runStdioServer } = require('../lib/mcp/server');
      runStdioServer();
      break;
    }

    case 'a2a': {
      const { run } = require('../lib/a2a/cmd');
      await run(args);
      break;
    }

    case 'bridge': {
      const { run } = require('../lib/bridge/bridge');
      await run(args);
      break;
    }

    case 'env': {
      if (shouldUseEnvManagement(args)) {
        const { run } = require('../lib/core/env-cmd');
        await run(args);
      } else {
        const { run } = require('../lib/core/env');
        run(args);
      }
      break;
    }

    case 'copy': {
      const { run } = require('../lib/core/copy');
      run(args);
      break;
    }

    case 'sample': {
      const { run } = require('../lib/core/sample');
      await run(args);
      break;
    }

    case 'login': {
      const { checkLoginOnly } = require('../lib/auth/login');
      const loginArgs = applyLoginEnvironmentFlags(args, { inferTargetUrl: true });
      const { isInjectedAuthMode } = require('../lib/core/utils');
      if (loginArgs.includes('--agent-poll') || loginArgs.includes('--codex-poll')) {
        const sessionFile = getArgValue(loginArgs, '--agent-poll') || getArgValue(loginArgs, '--codex-poll');
        const { pollCodexQrLogin } = require('../lib/auth/qr-login');
        const result = await pollCodexQrLogin(sessionFile, {
          corpId: getArgValue(loginArgs, '--corp-id'),
        });
        printLoginResult(result);
      } else if (loginArgs.includes('--agent-select') || loginArgs.includes('--codex-select')) {
        const sessionFile = getArgValue(loginArgs, '--agent-select') || getArgValue(loginArgs, '--codex-select');
        const { selectCodexQrCorp } = require('../lib/auth/qr-login');
        const result = await selectCodexQrCorp(sessionFile, {
          corpId: getArgValue(loginArgs, '--corp-id'),
        });
        printLoginResult(result);
      } else if (loginArgs.includes('--check-only')) {
        const result = checkLoginOnly({ includeSecrets: loginArgs.includes('--with-cookies') });
        console.log(JSON.stringify(result, null, 2));
      } else if (isInjectedAuthMode()) {
        const result = checkLoginOnly({ includeSecrets: true });
        printLoginResult(result);
      } else if (shouldUseCodexQrLogin(loginArgs)) {
        const { startCodexQrLogin } = require('../lib/auth/qr-login');
        const result = await startCodexQrLogin({ corpId: getArgValue(loginArgs, '--corp-id') });
        printLoginResult(result);
      } else if (loginArgs.includes('--browser')) {
        const { interactiveLogin } = require('../lib/auth/login');
        const result = interactiveLogin({ force: true });
        printLoginResult(result);
      } else if (loginArgs.includes('--qoder') || loginArgs.includes('--wukong')) {
        const { codexLogin } = require('../lib/auth/codex-login');
        const result = await codexLogin({ tool: loginArgs.includes('--qoder') ? 'qoder' : 'wukong' });
        printLoginResult(result);
      } else if (loginArgs.includes('--qr')) {
        const { qrLogin } = require('../lib/auth/qr-login');
        const result = await qrLogin({ corpId: getArgValue(loginArgs, '--corp-id') });
        printLoginResult(result);
      } else if (shouldUseAgentLogin(loginArgs)) {
        const cachedResult = checkLoginOnly({ includeSecrets: true });
        if (cachedResult.status === 'ok') {
          printLoginResult(cachedResult);
        } else {
          const { detectActiveTool } = require('../lib/core/utils');
          const activeTool = detectActiveTool();
          const { interactiveLogin } = require('../lib/auth/login');
          const browserResult = interactiveLogin({
            playwrightFallback: shouldUsePlaywrightFallbackInAgentLogin(),
          });
          if (browserResult) {
            printLoginResult(browserResult);
          } else {
            // CDP/Playwright 失败后的兜底策略：
            // Wukong/QoderWork 有 in-app browser，优先使用 browser handoff；其余走 AI 对话框 QR handoff。
            if (activeTool && (activeTool.tool === 'wukong' || activeTool.tool === 'qoderwork')) {
              const { codexLogin } = require('../lib/auth/codex-login');
              const result = await codexLogin({ tool: activeTool.tool });
              printLoginResult(result);
            } else {
              const { startCodexQrLogin } = require('../lib/auth/qr-login');
              const result = await startCodexQrLogin({ corpId: getArgValue(loginArgs, '--corp-id') });
              printLoginResult(result);
            }
          }
        }
      } else if (shouldUseBrowserHandoffLogin(loginArgs)) {
        const cachedResult = checkLoginOnly({ includeSecrets: true });
        if (cachedResult.status === 'ok') {
          printLoginResult(cachedResult);
        } else {
          const { codexLogin } = require('../lib/auth/codex-login');
          const result = await codexLogin({ tool: loginArgs.includes('--codex') ? 'codex' : undefined });
          printLoginResult(result);
        }
      } else {
        const cachedResult = checkLoginOnly({ includeSecrets: true });
        if (cachedResult.status === 'ok') {
          printLoginResult(cachedResult);
          break;
        }
        if (shouldUseDesktopBrowserLogin()) {
          const { interactiveLogin } = require('../lib/auth/login');
          const browserResult = interactiveLogin({ playwrightFallback: true });
          if (browserResult) {
            printLoginResult(browserResult);
            break;
          }
        }
        const { qrLogin } = require('../lib/auth/qr-login');
        const result = await qrLogin({ corpId: getArgValue(loginArgs, '--corp-id') });
        printLoginResult(result);
      }
      break;
    }

    case 'logout': {
      const { logout } = require('../lib/auth/login');
      logout();
      break;
    }

    case 'auth': {
      const subCommand = args[0];
      const { authStatus, authLogin, authRefresh, authLogout } = require('../lib/auth/auth');

      if (subCommand === 'status') {
        authStatus();
      } else if (subCommand === 'login') {
        const authArgs = applyLoginEnvironmentFlags(args.slice(1), { inferTargetUrl: true });
        let loginType = 'qrcode';
        if (authArgs.includes('--codex')) {
          loginType = 'codex';
        } else if (authArgs.includes('--qoder')) {
          loginType = 'qoder';
        } else if (authArgs.includes('--wukong')) {
          loginType = 'wukong';
        } else if (authArgs.includes('--browser')) {
          loginType = 'browser';
        }
        const result = await authLogin({
          type: loginType,
          corpId: getArgValue(authArgs, '--corp-id'),
          forceTerminalQr: authArgs.includes('--qr'),
        });
        if (result) {
          printLoginResult(result);
        }
      } else if (subCommand === 'refresh') {
        authRefresh();
      } else if (subCommand === 'logout') {
        authLogout();
      } else {
        throwCliUsage(t('cli.auth_usage'), t('cli.auth_example'));
      }
      break;
    }

    case 'org': {
      const subCommand = args[0];
      const { listOrganizations, switchOrganization, interactiveSwitch } = require('../lib/auth/org');
      const { loadCookieData } = require('../lib/core/utils');

      if (subCommand === 'list') {
        const cookieData = loadCookieData();
        if (!cookieData || !cookieData.cookies) {
          throwNeedLogin(t('org.no_login'));
        }
        await listOrganizations(cookieData);
      } else if (subCommand === 'switch') {
        const cookieData = loadCookieData();
        if (!cookieData || !cookieData.cookies) {
          throwNeedLogin(t('org.no_login'));
        }

        // 解析 --corp-id 参数
        const corpIdIndex = args.indexOf('--corp-id');
        if (corpIdIndex !== -1 && args[corpIdIndex + 1]) {
          const targetCorpId = args[corpIdIndex + 1];
          await switchOrganization(targetCorpId, cookieData);
        } else {
          // 交互式选择
          await interactiveSwitch(cookieData);
        }
      } else {
        throwCliUsage(t('cli.org_usage'), t('cli.org_example'));
      }
      break;
    }

    case 'app-list': {
      const { run } = require('../lib/app/app-list');
      await run(args);
      break;
    }

    case 'corp-efficiency': {
      const { run } = require('../lib/corp-efficiency/corp-efficiency');
      await run(args);
      break;
    }

    case 'create-app': {
      const { run } = require('../lib/app/create-app');
      await run(args);
      break;
    }

    case 'create-page': {
      const { run } = require('../lib/app/create-page');
      await run(args);
      break;
    }

    case 'create-form': {
      const { run } = require('../lib/app/create-form');
      await run(args);
      break;
    }

    case 'add-validation': {
      const { run } = require('../lib/app/create-form');
      await run(['validation', ...args]);
      break;
    }

    case 'list-forms': {
      const { run } = require('../lib/app/list-forms');
      await run(args);
      break;
    }

    case 'aggregate-table': {
      const { run } = require('../lib/aggregate-table/aggregate-table');
      await run(args);
      break;
    }

    case 'get-schema': {
      const { run } = require('../lib/app/get-schema');
      await run(args);
      break;
    }

    case 'formula': {
      const subCommand = args[0];
      const subArgs = args.slice(1);
      if (subCommand === 'evaluate' || subCommand === 'check') {
        const { run } = require('../lib/formula/evaluate');
        await run(subArgs);
      } else {
        throwCliUsage(t('cli.formula_usage'), t('cli.formula_example'));
      }
      break;
    }

    case 'generate-page': {
      const { run } = require('../lib/app/generate-page');
      await run(args);
      break;
    }

    case 'build-page': {
      const { run } = require('../lib/app/build-page');
      await run(args);
      break;
    }

    case 'check-page': {
      const { run } = require('../lib/app/check-page');
      await run(args);
      break;
    }

    case 'compile': {
      if (args.length < 1) {
        throwCliUsage(t('cli.compile_usage'), t('cli.compile_example'));
      }
      const { run } = require('../lib/app/compile');
      await run(args);
      break;
    }

    case 'publish': {
      const passThroughFlags = new Set(['--skip-lint', '--health-check', '--check', '--open', '--no-open', '--compat', '--modern', '--force']);
      const filteredArgs = args.filter(arg => !passThroughFlags.has(arg));
      if (filteredArgs.length < 3) {
        throwCliUsage(t('cli.publish_usage'), t('cli.publish_example'));
      }
      const publishMain = require('../lib/app/publish');
      await publishMain(args);
      break;
    }

    case 'verify-short-url': {
      const { run } = require('../lib/page-config/verify-short-url');
      await run(args);
      break;
    }

    case 'save-share-config': {
      const { run } = require('../lib/page-config/save-share-config');
      await run(args);
      break;
    }

    case 'get-page-config': {
      const { run } = require('../lib/page-config/get-page-config');
      await run(args);
      break;
    }

    case 'externalize-form': {
      const { run } = require('../lib/app/externalize-form');
      await run(args);
      break;
    }

    case 'update-form-config': {
      if (args.length < 4) {
        throwCliUsage(t('cli.form_config_usage'), t('cli.form_config_example'));
      }
      process.argv = [process.argv[0], process.argv[1], ...args];
      require('../lib/app/update-form-config');
      break;
    }

    case 'update-app': {
      if (args.length < 2) {
        throwCliUsage(t('cli.update_app_usage'), t('cli.update_app_example'));
      }
      const { run: runUpdateApp } = require('../lib/app/update-app');
      await runUpdateApp(args);
      break;
    }

    case 'nav-group':
    case 'group': {
      const { run: runNavGroup } = require('../lib/app/nav-group');
      await runNavGroup(args);
      break;
    }

    case 'app-permission': {
      const { run: runAppPermission } = require('../lib/app-permission/app-permission');
      await runAppPermission(args);
      break;
    }

    case 'i18n': {
      const { run: runI18nManagement } = require('../lib/i18n-management/i18n-management');
      await runI18nManagement(args);
      break;
    }

    case 'data': {
      if (args.length < 2) {
        throwCliUsage(
          '用法: openyida data <action> <resource> [args] [options]',
          '示例: openyida data query form APP_XXX FORM_XXX --page 1 --size 20'
        );
      }
      const { run: runDataManagement } = require('../lib/core/query-data');
      await runDataManagement(args);
      break;
    }

    case 'basic-info': {
      const { run: runBasicInfo } = require('../lib/basic-info/basic-info');
      await runBasicInfo(args);
      break;
    }

    case 'doctor': {
      const { run } = require('../lib/core/doctor');
      await run(args);
      break;
    }

    case 'export': {
      if (args.length < 1) {
        throwCliUsage(t('cli.export_usage'), t('cli.export_example1'), t('cli.export_example2'));
      }
      const { run: runExport } = require('../lib/app/export-app');
      await runExport(args);
      break;
    }

    case 'import': {
      if (args.length < 1) {
        throwCliUsage(t('cli.import_usage'), t('cli.import_example1'), t('cli.import_example2'));
      }
      const { run: runImport } = require('../lib/app/import-app');
      await runImport(args);
      break;
    }

    case 'get-permission': {
      if (args.length < 2) {
        throwCliUsage(t('cli.get_permission_usage'), t('cli.get_permission_example'));
      }
      const { run: runGetPermission } = require('../lib/permission/get-permission');
      await runGetPermission(args);
      break;
    }

    case 'save-permission': {
      if (args.length < 2) {
        throwCliUsage(t('cli.save_permission_usage'), t('cli.save_permission_example'));
      }
      const { run: runSavePermission } = require('../lib/permission/save-permission');
      await runSavePermission(args);
      break;
    }

    case 'configure-process': {
      if (args.length < 3) {
        throwCliUsage(t('cli.configure_process_usage'), t('cli.configure_process_example'));
      }
      const { run: runConfigureProcess } = require('../lib/process/configure-process');
      await runConfigureProcess(args);
      break;
    }

    case 'create-process': {
      if (args.length < 2) {
        throwCliUsage(t('cli.create_process_usage'), t('cli.create_process_example'));
      }
      const { run: runCreateProcess } = require('../lib/process/create-process');
      await runCreateProcess(args);
      break;
    }

    case 'ai-form-setting':
    case 'ai-approve':
    case 'aiFormSetting': {
      const { run: runAIFormSetting } = require('../lib/process/ai-form-setting');
      await runAIFormSetting(args);
      break;
    }

    case 'process': {
      const subCommand = args[0];
      const subArgs = args.slice(1);

      if (subCommand === 'preview') {
        if (subArgs.length < 2) {
          throwCliUsage(t('cli.process_preview_usage'), t('cli.process_preview_example'));
        }
        const { run: runPreviewProcess } = require('../lib/process/preview-process');
        await runPreviewProcess(subArgs);
      } else {
        throwCliUsage(t('cli.process_usage'));
      }
      break;
    }

    case 'create-report': {
      const { run } = require('../lib/report/create-report');
      await run(args);
      break;
    }

    case 'append-chart': {
      const { run } = require('../lib/report/append');
      await run(args);
      break;
    }

    case 'cdn-config': {
      const { run: runCdnConfig } = require('../lib/cdn/cdn-config-cmd');
      await runCdnConfig(args);
      break;
    }

    case 'cdn-upload': {
      const { run: runCdnUpload } = require('../lib/cdn/cdn-upload');
      await runCdnUpload(args);
      break;
    }

    case 'cdn-refresh': {
      const { run: runCdnRefresh } = require('../lib/cdn/cdn-refresh');
      await runCdnRefresh(args);
      break;
    }

    case 'connector': {
      const subCommand = args[0];
      const subArgs = args.slice(1);

      const connectorSubCommands = {
        'list':              '../lib/connector/connector-list',
        'create':            '../lib/connector/connector-create',
        'detail':            '../lib/connector/connector-detail',
        'delete':            '../lib/connector/connector-delete',
        'add-action':        '../lib/connector/connector-add-action',
        'list-actions':      '../lib/connector/connector-list-actions',
        'delete-action':     '../lib/connector/connector-delete-action',
        'test':              '../lib/connector/connector-test',
        'list-connections':  '../lib/connector/connector-list-connections',
        'create-connection': '../lib/connector/connector-create-connection',
        'smart-create':      '../lib/connector/connector-smart-create',
        'parse-api':         '../lib/connector/connector-parse-api',
        'gen-template':      '../lib/connector/connector-gen-template',
      };

      if (!subCommand || subCommand === '--help' || subCommand === '-h') {
        console.log(`
用法: openyida connector <子命令> [参数]

子命令:
  list                                         列出 HTTP 连接器
  create "名称" "域名" --operations <file>      创建连接器
  detail <connector-id>                        查看连接器详情
  delete <connector-id> [--force]              删除连接器
  add-action --operations <file> --connector-id <id>  添加执行动作
  list-actions <connector-id>                  列出执行动作
  delete-action <connector-id> <operation-id>  删除执行动作
  test --connector-id <id> --action <actionId> 测试执行动作
  list-connections <connector-id>              列出鉴权账号
  create-connection <connector-id> <name>      创建鉴权账号
  smart-create --curl "curl命令"               智能创建连接器
  parse-api [选项]                             解析接口信息
  gen-template [输出路径]                       生成接口文档模板

使用 openyida connector <子命令> --help 查看详细帮助
`);
        break;
      }

      const modulePath = connectorSubCommands[subCommand];
      if (!modulePath) {
        throwCliUsage(`未知的 connector 子命令: ${subCommand}`, '使用 openyida connector --help 查看可用子命令');
      }

      const { run: runConnector } = require(modulePath);
      await runConnector(subArgs);
      break;
    }

    case 'corp-manager': {
      const { run: runCorpManager } = require('../lib/corp-manager/corp-manager');
      await runCorpManager(args);
      break;
    }

    case 'agent-center': {
      const { run: runAgentCenter } = require('../lib/agent-center/agent-center');
      await runAgentCenter(args);
      break;
    }

    case 'flash-to-prd': {
      const { run: runFlashToPrd } = require('../lib/flash-note/flash-to-prd');
      await runFlashToPrd(args);
      break;
    }

    case 'ai': {
      const { run: runAI } = require('../lib/ai/ai');
      await runAI(args);
      break;
    }

    case 'integration': {
      const subCommand = args[0];
      const subArgs = args.slice(1);  // 路由层消费 subCommand，传递剩余参数

      if (!subCommand || subCommand === '--help' || subCommand === '-h') {
        warn(t('cli.integration_help'));
        break;
      }

      if (subCommand === 'create') {
        const { run: runIntegration } = require('../lib/integration/integration-create');
        await runIntegration(subArgs);
      } else if (subCommand === 'list') {
        const { runList } = require('../lib/integration/integration-list');
        await runList(subArgs);
      } else if (subCommand === 'enable') {
        const { runEnable } = require('../lib/integration/integration-list');
        await runEnable(subArgs);
      } else if (subCommand === 'disable') {
        const { runDisable } = require('../lib/integration/integration-list');
        await runDisable(subArgs);
      } else if (subCommand === 'check') {
        const { run: runIntegrationCheck } = require('../lib/integration/integration-check');
        await runIntegrationCheck(subArgs);
      } else if (subCommand === 'diagnose' || subCommand === 'doctor') {
        const { run: runIntegrationDiagnose } = require('../lib/integration/integration-diagnose');
        await runIntegrationDiagnose(subArgs);
      } else {
        throwCliUsage(t('cli.integration_unknown', subCommand), t('cli.integration_help_hint'));
      }
      break;
    }

    case 'dws': {
      const { run: runDws } = require('../lib/dws/dws-wrapper');
      await runDws(args);
      break;
    }

    case 'dingtalk-link': {
      const { run: runDingTalkLink } = require('../lib/dingtalk/dingtalk-link');
      await runDingTalkLink(args);
      break;
    }

    case 'export-conversation': {
      const { exportConversation } = require('../lib/conversation/export-conversation');
      // 解析选项
      const options = {};
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--output' || args[i] === '-o') {
          options.output = args[++i];
        } else if (args[i] === '--input' || args[i] === '-i') {
          options.input = args[++i];
        } else if (args[i] === '--latest') {
          options.latest = true;
        } else if (args[i] === '--list') {
          options.list = true;
        }
      }
      await exportConversation(options);
      break;
    }

    case 'feedback': {
      const { run: runFeedback } = require('../lib/feedback/feedback');
      await runFeedback(args);
      break;
    }

    case 'task-center': {
      const { run: runTaskCenter } = require('../lib/core/task-center');
      await runTaskCenter(args);
      break;
    }

    case 'batch': {
      const { run: runBatch } = require('../lib/core/batch');
      await runBatch(args);
      break;
    }

    case 'db-seq-fix': {
      const { run: runDbSeqFix } = require('../lib/db/db-seq-fix');
      await runDbSeqFix(args);
      break;
    }

    case 'update': {
      const { runUpdate } = require('../lib/core/update');
      await runUpdate(currentVersion);
      break;
    }

    default: {
      throwCliUsage(t('cli.unknown_command', command), t('cli.run_help'));
    }
  }
}

main()
  .catch((err) => {
    if (isCliError(err) && args.includes('--json')) {
      console.error(JSON.stringify(toErrorPayload(err), null, 2));
    } else if (isCliError(err)) {
      warn(t('cli.exec_failed', err.message));
      if (err.usage) {
        warn(err.usage);
      }
    } else {
      warn(t('cli.exec_failed', err.message));
    }
    process.exit(err && err.exitCode ? err.exitCode : 1);
  });
