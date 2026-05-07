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
    env.OPENCODE ||
    env.QODER_IDE ||
    env.QODER_AGENT ||
    env.CURSOR_TRACE_ID ||
    env.AGENT_WORK_ROOT ||
    env.OPENYIDA_AGENT_MODE ||
    (env.__CFBundleIdentifier || '').toLowerCase().includes('codex')
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
  if (command === 'commands') {
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
      group.commands.map(entry => [entry.usage, t(entry.descriptionKey)])
    );
  }

  // ── 快速上手 ──
  console.log(SEP);
  console.log(`\n  ${BOLD}${CYAN}${t('help.quickstart_title')}${RESET}`);
  console.log(`    ${DIM}${RESET} openyida login`);
  console.log(`    ${DIM}${RESET} openyida create-app "${t('help.quickstart_app_name')}"`);
  console.log(`    ${DIM}${RESET} openyida create-form create APP_XXX "${t('help.quickstart_form_name')}" fields.json`);
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
  if (result && result.status === 'need_codex_browser_login') {
    console.log(JSON.stringify({
      status: result.status,
      handoff_type: result.handoff_type || 'browser',
      can_auto_use: false,
      browser: result.browser,
      login_url: result.login_url,
      message: result.message,
    }));
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

function isBrowserHandoffEnvironment() {
  const { detectActiveTool } = require('../lib/core/utils');
  const activeTool = detectActiveTool();
  return !!activeTool && (activeTool.tool === 'codex' || activeTool.tool === 'qoder' || activeTool.tool === 'wukong');
}

function shouldUseBrowserHandoffLogin(cliArgs) {
  if (cliArgs.includes('--qr')) {return false;}
  if (cliArgs.includes('--browser') || cliArgs.includes('--codex') || cliArgs.includes('--qoder') || cliArgs.includes('--wukong')) {return true;}
  return isBrowserHandoffEnvironment();
}

function getArgValue(cliArgs, name) {
  const index = cliArgs.indexOf(name);
  if (index === -1 || !cliArgs[index + 1] || cliArgs[index + 1].startsWith('--')) {
    return null;
  }
  return cliArgs[index + 1];
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    handleFirstRunGuide();
    printHelp();
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    console.log(currentVersion);
    process.exit(0);
  }

  switch (command) {
    case 'commands': {
      const manifest = buildCommandManifest({ t, version: currentVersion });
      console.log(JSON.stringify(manifest, null, 2));
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
      run();
      break;
    }

    case 'sample': {
      const { run } = require('../lib/core/sample');
      await run(args);
      break;
    }

    case 'login': {
      const { checkLoginOnly } = require('../lib/auth/login');
      if (args[0] === '--check-only') {
        const result = checkLoginOnly({ includeSecrets: args.includes('--with-cookies') });
        console.log(JSON.stringify(result, null, 2));
      } else if (args.includes('--browser') || args.includes('--codex') || args.includes('--qoder') || args.includes('--wukong')) {
        const { codexLogin } = require('../lib/auth/codex-login');
        const result = await codexLogin();
        printLoginResult(result);
      } else if (args.includes('--qr')) {
        const { qrLogin } = require('../lib/auth/qr-login');
        const result = await qrLogin({ corpId: getArgValue(args, '--corp-id') });
        console.log(JSON.stringify(result));
      } else if (shouldUseBrowserHandoffLogin(args)) {
        const cachedResult = checkLoginOnly({ includeSecrets: true });
        if (cachedResult.status === 'ok') {
          printLoginResult(cachedResult);
        } else {
          const { codexLogin } = require('../lib/auth/codex-login');
          const result = await codexLogin();
          printLoginResult(result);
        }
      } else {
        const cachedResult = checkLoginOnly({ includeSecrets: true });
        if (cachedResult.status === 'ok') {
          printLoginResult(cachedResult);
          break;
        }
        const { qrLogin } = require('../lib/auth/qr-login');
        const result = await qrLogin({ corpId: getArgValue(args, '--corp-id') });
        console.log(JSON.stringify(result));
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
        const loginType = shouldUseBrowserHandoffLogin(args) ? 'browser' : 'qrcode';
        await authLogin({ type: loginType, corpId: getArgValue(args, '--corp-id') });
      } else if (subCommand === 'refresh') {
        authRefresh();
      } else if (subCommand === 'logout') {
        authLogout();
      } else {
        warn(t('cli.auth_usage'));
        warn(t('cli.auth_example'));
        process.exit(1);
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
          warn(t('org.no_login'));
          process.exit(1);
        }
        await listOrganizations(cookieData);
      } else if (subCommand === 'switch') {
        const cookieData = loadCookieData();
        if (!cookieData || !cookieData.cookies) {
          warn(t('org.no_login'));
          process.exit(1);
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
        warn(t('cli.org_usage'));
        warn(t('cli.org_example'));
        process.exit(1);
      }
      break;
    }

    case 'app-list': {
      const { run } = require('../lib/app/app-list');
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
      // create-form.js 通过 process.argv.slice(2) 读取参数，注入子命令及其参数
      process.argv = [process.argv[0], process.argv[1], ...args];
      require('../lib/app/create-form');
      break;
    }

    case 'list-forms': {
      const { run } = require('../lib/app/list-forms');
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
        warn(t('cli.formula_usage'));
        warn(t('cli.formula_example'));
        process.exit(1);
      }
      break;
    }

    case 'generate-page': {
      const { run } = require('../lib/app/generate-page');
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
        warn(t('cli.compile_usage'));
        warn(t('cli.compile_example'));
        process.exit(1);
      }
      const { run } = require('../lib/app/compile');
      await run(args);
      break;
    }

    case 'publish': {
      // 参数顺序：<源文件路径> <appType> <formUuid>
      // publish.js 内部读取顺序：argv[2]=appType, argv[3]=formUuid, argv[4]=sourceFile
      const skipLint = args.includes('--skip-lint');
      const filteredArgs = args.filter(arg => arg !== '--skip-lint');
      if (filteredArgs.length < 3) {
        warn(t('cli.publish_usage'));
        warn(t('cli.publish_example'));
        process.exit(1);
      }
      const [sourceFile, appType, formUuid] = filteredArgs;
      process.argv = [
        process.argv[0], process.argv[1],
        appType, formUuid, sourceFile,
        ...(skipLint ? ['--skip-lint'] : [])
      ];
      const publishMain = require('../lib/app/publish');
      await publishMain();
      break;
    }

    case 'verify-short-url': {
      if (args.length < 3) {
        warn(t('cli.verify_usage'));
        warn(t('cli.verify_example'));
        process.exit(1);
      }
      process.argv = [process.argv[0], process.argv[1], ...args];
      require('../lib/page-config/verify-short-url');
      break;
    }

    case 'save-share-config': {
      if (args.length < 4) {
        warn(t('cli.share_usage'));
        warn(t('cli.share_example'));
        process.exit(1);
      }
      process.argv = [process.argv[0], process.argv[1], ...args];
      require('../lib/page-config/save-share-config');
      break;
    }

    case 'get-page-config': {
      if (args.length < 2) {
        warn(t('cli.page_config_usage'));
        warn(t('cli.page_config_example'));
        process.exit(1);
      }
      process.argv = [process.argv[0], process.argv[1], ...args];
      require('../lib/page-config/get-page-config');
      break;
    }

    case 'update-form-config': {
      if (args.length < 4) {
        warn(t('cli.form_config_usage'));
        warn(t('cli.form_config_example'));
        process.exit(1);
      }
      process.argv = [process.argv[0], process.argv[1], ...args];
      require('../lib/app/update-form-config');
      break;
    }

    case 'update-app': {
      if (args.length < 2) {
        warn(t('cli.update_app_usage'));
        warn(t('cli.update_app_example'));
        process.exit(1);
      }
      const { run: runUpdateApp } = require('../lib/app/update-app');
      await runUpdateApp(args);
      break;
    }

    case 'data': {
      if (args.length < 2) {
        warn('用法: openyida data <action> <resource> [args] [options]');
        warn('示例: openyida data query form APP_XXX FORM_XXX --page 1 --size 20');
        process.exit(1);
      }
      const { run: runDataManagement } = require('../lib/core/query-data');
      await runDataManagement(args);
      break;
    }

    case 'doctor': {
      const { run } = require('../lib/core/doctor');
      await run(args);
      break;
    }

    case 'export': {
      if (args.length < 1) {
        warn(t('cli.export_usage'));
        warn(t('cli.export_example1'));
        warn(t('cli.export_example2'));
        process.exit(1);
      }
      const { run: runExport } = require('../lib/app/export-app');
      await runExport(args);
      break;
    }

    case 'import': {
      if (args.length < 1) {
        warn(t('cli.import_usage'));
        warn(t('cli.import_example1'));
        warn(t('cli.import_example2'));
        process.exit(1);
      }
      const { run: runImport } = require('../lib/app/import-app');
      await runImport(args);
      break;
    }

    case 'get-permission': {
      if (args.length < 2) {
        warn(t('cli.get_permission_usage'));
        warn(t('cli.get_permission_example'));
        process.exit(1);
      }
      const { run: runGetPermission } = require('../lib/permission/get-permission');
      await runGetPermission(args);
      break;
    }

    case 'save-permission': {
      if (args.length < 2) {
        warn(t('cli.save_permission_usage'));
        warn(t('cli.save_permission_example'));
        process.exit(1);
      }
      const { run: runSavePermission } = require('../lib/permission/save-permission');
      await runSavePermission(args);
      break;
    }

    case 'configure-process': {
      if (args.length < 3) {
        warn(t('cli.configure_process_usage'));
        warn(t('cli.configure_process_example'));
        process.exit(1);
      }
      const { run: runConfigureProcess } = require('../lib/process/configure-process');
      await runConfigureProcess(args);
      break;
    }

    case 'create-process': {
      if (args.length < 2) {
        warn(t('cli.create_process_usage'));
        warn(t('cli.create_process_example'));
        process.exit(1);
      }
      const { run: runCreateProcess } = require('../lib/process/create-process');
      await runCreateProcess(args);
      break;
    }

    case 'process': {
      const subCommand = args[0];
      const subArgs = args.slice(1);

      if (subCommand === 'preview') {
        if (subArgs.length < 2) {
          warn(t('cli.process_preview_usage'));
          warn(t('cli.process_preview_example'));
          process.exit(1);
        }
        const { run: runPreviewProcess } = require('../lib/process/preview-process');
        await runPreviewProcess(subArgs);
      } else {
        warn(t('cli.process_usage'));
        process.exit(1);
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
        warn(`未知的 connector 子命令: ${subCommand}`);
        warn('使用 openyida connector --help 查看可用子命令');
        process.exit(1);
      }

      const { run: runConnector } = require(modulePath);
      await runConnector(subArgs);
      break;
    }

    case 'flash-to-prd': {
      const { run: runFlashToPrd } = require('../lib/flash-note/flash-to-prd');
      await runFlashToPrd(args);
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
      } else {
        warn(t('cli.integration_unknown', subCommand));
        warn(t('cli.integration_help_hint'));
        process.exit(1);
      }
      break;
    }

    case 'dws': {
      const { run: runDws } = require('../lib/dws/dws-wrapper');
      await runDws(args);
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

    case 'task-center': {
      const { run: runTaskCenter } = require('../lib/core/task-center');
      await runTaskCenter(args);
      break;
    }

    case 'update': {
      const { runUpdate } = require('../lib/core/update');
      await runUpdate(currentVersion);
      break;
    }

    default: {
      warn(t('cli.unknown_command', command));
      warn(t('cli.run_help'));
      process.exit(1);
    }
  }
}

main()
  .catch((err) => {
    warn(t('cli.exec_failed', err.message));
    process.exit(1);
  });
