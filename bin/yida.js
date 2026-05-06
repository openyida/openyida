#!/usr/bin/env node
/**
 * openyida - 宜搭命令行工具
 *
 * 安装：npm install -g openyida
 * 用法：openyida <命令> [参数]（别名：yida）
 *
 * 命令列表：
 *   openyida env                                        检测当前 AI 工具环境和登录态
 *   openyida copy [--force]                             复制 project 工作目录到当前 AI 工具环境
 *   openyida login [--qr]                               登录态管理（--qr 使用终端二维码扫码）
 *   openyida logout                                     退出登录
 *   openyida auth status                                查看当前登录状态
 *   openyida auth login                                 执行登录
 *   openyida auth refresh                               刷新登录态
 *   openyida auth logout                                退出登录
 *   openyida org list                                   列出可访问的组织
 *   openyida org switch --corp-id <corpId>              切换组织（无需重新登录）
 *   openyida app-list [--size N]                        查询我的应用列表
 *   openyida create-app "<名称>" [desc] [icon] [color] [colour] [navTheme] [layout]  创建应用
 *   openyida create-page <appType> "<页面名>"            创建自定义页面
 *   openyida create-form create <appType> "<表单名>" <字段JSON> [--layout <布局>] [--theme <主题>] [--label-align <对齐>]  创建表单页面
 *   openyida create-form update <appType> <formUuid> <修改JSON>  更新表单页面
 *   openyida get-schema <appType> <formUuid>            获取表单 Schema
 *   openyida publish <源文件路径> <appType> <formUuid>   编译并发布自定义页面
 *   openyida verify-short-url <appType> <formUuid> <url>           验证短链接 URL 是否可用
 *   openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]  保存公开访问/分享配置
 *   openyida get-page-config <appType> <formUuid>       查询页面公开访问/分享配置
 *   openyida update-form-config <appType> <formUuid> <isRenderNav> <title>  更新表单配置
 *   openyida update-app <appType> --name "新名称" [--desc "描述"] [--icon "图标"]  更新应用信息
 *   openyida data <action> <resource> [args]            统一数据管理（表单/流程/任务/子表单）
 *   openyida task-center <type> [--page N] [--size N] [--keyword TEXT]  全局任务中心（待办/我创建的/我已处理/抄送/代提交）
 *   openyida doctor [选项]                              检查环境依赖，诊断应用问题
 *   openyida export <appType> [output]                  导出应用所有表单 Schema（生成迁移包）
 *   openyida import <file> [name]                       导入迁移包，在目标环境重建应用
 *   openyida get-permission <appType> <formUuid>        查询表单权限配置
 *   openyida save-permission <appType> <formUuid> [--data-permission <json>] [--action-permission <json>]  保存表单权限配置
 *   openyida process preview <appType> <processInstanceId> [--output <path>]  预览流程实例（生成可视化流程图）
 *   openyida connector list [选项]                       列出 HTTP 连接器
 *   openyida connector create "名称" "域名" --operations <file> [选项]  创建连接器
 *   openyida connector detail <connector-id>             查看连接器详情
 *   openyida connector delete <connector-id> [--force]  删除连接器
 *   openyida connector add-action --operations <file> --connector-id <id> [--confirm]  添加执行动作
 *   openyida connector list-actions <connector-id>       列出执行动作
 *   openyida connector delete-action <connector-id> <operation-id> [--force]  删除执行动作
 *   openyida connector test --connector-id <id> --action <actionId> [选项]  测试执行动作
 *   openyida connector list-connections <connector-id>   列出鉴权账号
 *   openyida connector create-connection <connector-id> <name> [选项]  创建鉴权账号
 *   openyida connector smart-create --curl "curl命令" [选项]  智能创建连接器
 *   openyida connector parse-api [选项]                  解析接口信息
 *   openyida connector gen-template [输出路径]            生成接口文档模板
 *   openyida integration create <appType> <formUuid> <flowName> [选项]  创建集成&自动化逻辑流
 *   openyida create-report <appType> "<报表名称>" <图表定义JSON或文件路径>  创建宜搭报表
 *   openyida append-chart <appType> <reportId> <图表定义JSON或文件路径>    向已有报表追加图表
 *   openyida dws <command> [args]                        钉钉 CLI（通讯录/日历/待办/审批等）
 *   openyida update                                       检查并更新 openyida 到最新版本
 */

'use strict';

const { checkUpdate } = require('../lib/core/check-update');
const { version: currentVersion } = require('../package.json');
const { t } = require('../lib/core/i18n');
const { warn, fail } = require('../lib/core/chalk');

// 异步检查更新，fire-and-forget，不阻塞主流程
const updateCheckPromise = checkUpdate(currentVersion);
updateCheckPromise.catch(() => {});

const command = process.argv[2];
const args = process.argv.slice(3);

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
      console.log(`    ${GREEN}${cmd.padEnd(padWidth)}${RESET}${DIM}${desc}${RESET}`);
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

  // ── 环境 & 认证 ──
  renderGroup(t('help.group_auth'), [
    ['login [--qr]',                          t('help.cmd_login')],
    ['logout',                                 t('help.cmd_logout')],
    ['auth <status|login|refresh|logout>',     t('help.cmd_auth')],
    ['org <list|switch>',                      t('help.cmd_org')],
    ['env',                                    t('help.cmd_env')],
  ]);

  // ── 应用管理 ──
  renderGroup(t('help.group_app'), [
    ['app-list [--size N]',                  t('help.cmd_app_list')],
    ['create-app "<name>" [options]',          t('help.cmd_create_app')],
    ['update-app <appType> --name "..."',      t('help.cmd_update_app')],
    ['export <appType> [output]',              t('help.cmd_export')],
    ['import <file> [name]',                   t('help.cmd_import')],
  ]);

  // ── 表单 & 页面 ──
  renderGroup(t('help.group_form'), [
    ['create-form create <appType> ...',       t('help.cmd_create_form')],
    ['create-form update <appType> ...',       t('help.cmd_update_form')],
    ['get-schema <appType> <formUuid>',        t('help.cmd_get_schema')],
    ['create-page <appType> "<name>"',         t('help.cmd_create_page')],
    ['publish <src> <appType> <formUuid>',     t('help.cmd_publish')],
    ['update-form-config <appType> ...',       t('help.cmd_update_form_config')],
  ]);

  // ── 数据 & 权限 ──
  renderGroup(t('help.group_data'), [
    ['data <action> <resource> [args]',        t('help.cmd_data')],
    ['task-center <type> [options]',           t('help.cmd_task_center')],
    ['get-permission <appType> <formUuid>',    t('help.cmd_get_permission')],
    ['save-permission <appType> <formUuid> ...', t('help.cmd_save_permission')],
  ]);

  // ── 流程 ──
  renderGroup(t('help.group_process'), [
    ['configure-process <appType> ...',        t('help.cmd_configure_process')],
    ['create-process <appType> ...',           t('help.cmd_create_process')],
    ['process preview <appType> ...',          t('help.cmd_process_preview')],
  ]);

  // ── 页面配置 & 分享 ──
  renderGroup(t('help.group_share'), [
    ['verify-short-url <appType> ...',         t('help.cmd_verify_url')],
    ['save-share-config <appType> ...',        t('help.cmd_save_share')],
    ['get-page-config <appType> <formUuid>',   t('help.cmd_get_page_config')],
  ]);

  // ── 报表 ──
  renderGroup(t('help.group_report'), [
    ['create-report <appType> "<name>" ...',   t('help.cmd_create_report')],
    ['append-chart <appType> <reportId> ...',  t('help.cmd_append_chart')],
  ]);

  // ── 连接器 ──
  renderGroup(t('help.group_connector'), [
    ['connector list',                         t('help.cmd_connector_list')],
    ['connector create "name" "domain" ...',   t('help.cmd_connector_create')],
    ['connector detail <id>',                  t('help.cmd_connector_detail')],
    ['connector delete <id>',                  t('help.cmd_connector_delete')],
    ['connector smart-create --curl "..."',    t('help.cmd_connector_smart')],
    ['connector <sub-command> --help',         t('help.cmd_connector_more')],
  ]);

  // ── 集成 & 钉钉 ──
  renderGroup(t('help.group_integration'), [
    ['integration create <appType> ...',       t('help.cmd_integration')],
    ['dws <command> [args]',                   t('help.cmd_dws')],
  ]);

  // ── 工具 ──
  renderGroup(t('help.group_utility'), [
    ['copy [--force]',                         t('help.cmd_copy')],
    ['doctor [--fix]',                         t('help.cmd_doctor')],
    ['update',                                 t('help.cmd_update')],
    ['export-conversation [options]',          t('help.cmd_export_conversation')],
    ['cdn-config / cdn-upload / cdn-refresh',  t('help.cmd_cdn')],
  ]);

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
    case 'env': {
      const { run } = require('../lib/core/env');
      run();
      break;
    }

    case 'copy': {
      const { run } = require('../lib/core/copy');
      run();
      break;
    }

    case 'login': {
      const { ensureLogin, checkLoginOnly } = require('../lib/auth/login');
      if (args[0] === '--check-only') {
        const result = checkLoginOnly({ includeSecrets: args.includes('--with-cookies') });
        console.log(JSON.stringify(result, null, 2));
      } else if (args[0] === '--qr') {
        const { qrLogin } = require('../lib/auth/qr-login');
        const result = await qrLogin();
        console.log(JSON.stringify(result));
      } else {
        const result = ensureLogin();
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
        authLogin({ type: 'qrcode' });
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
