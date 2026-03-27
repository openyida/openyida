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
 *   openyida create-app "<名称>" [desc] [icon] [color] [themeColor]  创建应用
 *   openyida create-page <appType> "<页面名>"            创建自定义页面
 *   openyida create-form create <appType> "<表单名>" <字段JSON> [--layout <布局>] [--theme <主题>] [--label-align <对齐>]  创建表单页面
 *   openyida create-form update <appType> <formUuid> <修改JSON>  更新表单页面
 *   openyida get-schema <appType> <formUuid>            获取表单 Schema
 *   openyida publish <源文件路径> <appType> <formUuid>   编译并发布自定义页面
 *   openyida verify-short-url <appType> <formUuid> <url>           验证短链接 URL 是否可用
 *   openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]  保存公开访问/分享配置
 *   openyida get-page-config <appType> <formUuid>       查询页面公开访问/分享配置
 *   openyida update-form-config <appType> <formUuid> <isRenderNav> <title>  更新表单配置
 *   openyida data <action> <resource> [args]            统一数据管理（表单/流程/任务/子表单）
 *   openyida doctor [选项]                              检查环境依赖，诊断应用问题
 *   openyida export <appType> [output]                  导出应用所有表单 Schema（生成迁移包）
 *   openyida import <file> [name]                       导入迁移包，在目标环境重建应用
 *   openyida get-permission <appType> <formUuid>        查询表单权限配置
 *   openyida save-permission <appType> <formUuid> [--data-permission <json>] [--action-permission <json>]  保存表单权限配置
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
 *   openyida create-report <appType> "<报表名称>" <图表定义JSON或文件路径>  创建宜搭报表
 *   openyida append-chart <appType> <reportId> <图表定义JSON或文件路径>    向已有报表追加图表
 */

'use strict';

const { checkUpdate } = require('../lib/core/check-update');
const { version: currentVersion } = require('../package.json');
const { t } = require('../lib/core/i18n');

// 异步检查更新，fire-and-forget，不阻塞主流程
const updateCheckPromise = checkUpdate(currentVersion);

const command = process.argv[2];
const args = process.argv.slice(3);

function printHelp() {
  console.log(`
openyida - 宜搭命令行工具

用法：
  openyida <命令> [参数...]（别名：yida）

命令：
  env                                                          检测当前 AI 工具环境和登录态
  copy [--force]                                               复制 project 工作目录到当前 AI 工具环境
  login                                                        登录态管理（优先缓存，否则扫码）
  logout                                                       退出登录 / 切换账号
  create-app "<名称>" [描述] [图标] [颜色] [主题色]             创建应用，输出 appType
  create-page <appType> "<页面名>"                             创建自定义页面，输出 pageId
  create-form create <appType> "<表单名>" <字段JSON> [--layout <布局>] [--theme <主题>] [--label-align <对齐>]  创建表单页面
  create-form update <appType> <formUuid> <修改JSON>           更新表单页面
  get-schema <appType> <formUuid>                              获取表单 Schema
  publish <源文件路径> <appType> <formUuid>                    编译并发布自定义页面
  verify-short-url <appType> <formUuid> <url>                  验证短链接 URL 是否可用
  save-share-config <appType> <formUuid> <url> <isOpen> [auth] 保存公开访问/分享配置
  get-page-config <appType> <formUuid>                         查询页面公开访问/分享配置
  query-data <appType> <formUuid> [--page N] [--size N]        查询表单实例数据
  update-form-config <appType> <formUuid> <isRenderNav> <title> 更新表单配置
  data <action> <resource> [args]                              统一数据管理（表单/流程/任务/子表单）
  doctor [选项]                                                检查环境依赖，诊断应用问题
    --fix / --repair                                           诊断并自动修复
    --production --app <appId>                                 线上应用诊断
    --monitor                                                  启动实时健康度监控
    --report <format>                                          生成诊断报告（json | markdown | html）
    --create-ticket                                            根据诊断结果创建工单
    --create-voc                                               创建 VOC（需求反馈）
    --auto-submit                                              自动判断并提交工单或 VOC
  auth status                                                  查看当前登录状态
  auth login                                                   执行登录
  auth refresh                                                 刷新登录态
  auth logout                                                  退出登录
  org list                                                     列出可访问的组织
  org switch --corp-id <corpId>                                切换组织（无需重新登录）
  get-permission <appType> <formUuid>                          查询表单权限配置
  save-permission <appType> <formUuid> [--data-permission <json>] [--action-permission <json>]  保存表单权限配置
  configure-process <appType> <formUuid> <processDefinitionFile> [processCode]  配置并发布流程
  create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>  创建流程表单（一体化）
  create-process <appType> --formUuid <formUuid> <processDefinitionFile>         复用已有表单创建流程
  connector list [选项]                                          列出 HTTP 连接器
  connector create "名称" "域名" --operations <file> [选项]      创建连接器
  connector detail <connector-id>                               查看连接器详情
  connector delete <connector-id> [--force]                     删除连接器
  connector add-action --operations <file> --connector-id <id>  添加执行动作到连接器
  connector list-actions <connector-id>                         列出执行动作
  connector delete-action <connector-id> <operation-id>         删除执行动作
  connector test --connector-id <id> --action <actionId>        测试执行动作
  connector list-connections <connector-id>                     列出鉴权账号
  connector create-connection <connector-id> <name> [选项]      创建鉴权账号
  connector smart-create --curl "curl命令" [选项]               智能创建连接器
  connector parse-api [选项]                                    解析接口信息
  connector gen-template [输出路径]                              生成接口文档模板
  create-report <appType> "<报表名称>" <图表定义JSON或文件路径>   创建宜搭报表
  append-chart <appType> <reportId> <图表定义JSON或文件路径>      向已有报表追加图表
  export-conversation [选项]                                      导出 AI 对话记录
    --output, -o <path>                                           指定输出文件路径
    --input, -i <file>                                            指定输入对话文件
    --latest                                                      只导出最新对话（默认）
    --list                                                        列出可用的对话记录

示例：
  openyida login
  openyida logout
  openyida create-app "考勤管理"
  openyida create-app "考勤管理" "员工考勤系统" "xian-daka" "#00B853" "red"
  openyida create-page APP_XXX "游戏主页"
  openyida create-form create APP_XXX "员工信息" fields.json
  openyida create-form update APP_XXX FORM-XXX '[{"action":"add","field":{"type":"TextField","label":"备注"}}]'
  openyida get-schema APP_XXX FORM-XXX
  openyida publish pages/src/home.jsx APP_XXX FORM-XXX
  openyida verify-short-url APP_XXX FORM-XXX /o/myapp
  openyida save-share-config APP_XXX FORM-XXX /o/myapp y n
  openyida get-page-config APP_XXX FORM-XXX
  openyida update-form-config APP_XXX FORM-XXX false "页面标题"
  openyida data query form APP_XXX FORM-XXX --page 1 --size 20
  openyida query-data APP_XXX FORM-XXX --page 1 --size 10
  openyida create-report APP_XXX "销售报表" charts.json
  openyida append-chart APP_XXX REPORT-XXX charts.json
  openyida configure-process APP_XXX FORM-YYY process-def.json
  openyida create-process APP_XXX "订单处理表" fields.json process-def.json
  openyida create-process APP_XXX --formUuid FORM-YYY process-def.json
  openyida doctor                                 完整诊断
  openyida doctor --fix                           诊断并自动修复
  openyida doctor --production --app APP_XXX      线上应用诊断
  openyida doctor --monitor                       实时监控
  openyida doctor --report markdown               生成 Markdown 报告
  openyida doctor --create-ticket                 创建工单
  openyida doctor --create-voc                    创建 VOC
  openyida doctor --auto-submit                   自动判断并提交
  openyida export-conversation                   导出当前对话记录
  openyida export-conversation -o output.md     指定输出路径
  openyida export-conversation --list            列出可用对话
`);
  console.log(t('cli.help'));
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
        const result = checkLoginOnly();
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
        console.error(t('cli.auth_usage'));
        console.error(t('cli.auth_example'));
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
          console.error(t('org.no_login'));
          process.exit(1);
        }
        await listOrganizations(cookieData);
      } else if (subCommand === 'switch') {
        const cookieData = loadCookieData();
        if (!cookieData || !cookieData.cookies) {
          console.error(t('org.no_login'));
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
        console.error(t('cli.org_usage'));
        console.error(t('cli.org_example'));
        process.exit(1);
      }
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
        console.error(t('cli.publish_usage'));
        console.error(t('cli.publish_example'));
        process.exit(1);
      }
      const [sourceFile, appType, formUuid] = filteredArgs;
      process.argv = [
        process.argv[0], process.argv[1],
        appType, formUuid, sourceFile,
        ...(skipLint ? ['--skip-lint'] : [])
      ];
      require('../lib/app/publish');
      break;
    }

    case 'verify-short-url': {
      if (args.length < 3) {
        console.error(t('cli.verify_usage'));
        console.error(t('cli.verify_example'));
        process.exit(1);
      }
      process.argv = [process.argv[0], process.argv[1], ...args];
      require('../lib/page-config/verify-short-url');
      break;
    }

    case 'save-share-config': {
      if (args.length < 4) {
        console.error(t('cli.share_usage'));
        console.error(t('cli.share_example'));
        process.exit(1);
      }
      process.argv = [process.argv[0], process.argv[1], ...args];
      require('../lib/page-config/save-share-config');
      break;
    }

    case 'get-page-config': {
      if (args.length < 2) {
        console.error(t('cli.page_config_usage'));
        console.error(t('cli.page_config_example'));
        process.exit(1);
      }
      process.argv = [process.argv[0], process.argv[1], ...args];
      require('../lib/page-config/get-page-config');
      break;
    }

    case 'update-form-config': {
      if (args.length < 4) {
        console.error(t('cli.form_config_usage'));
        console.error(t('cli.form_config_example'));
        process.exit(1);
      }
      process.argv = [process.argv[0], process.argv[1], ...args];
      require('../lib/app/update-form-config');
      break;
    }

    case 'data': {
      if (args.length < 2) {
        console.error('用法: openyida data <action> <resource> [args] [options]');
        console.error('示例: openyida data query form APP_XXX FORM_XXX --page 1 --size 20');
        process.exit(1);
      }
      const { run: runDataManagement } = require('../lib/data-management');
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
        console.error(t('cli.export_usage'));
        console.error(t('cli.export_example1'));
        console.error(t('cli.export_example2'));
        process.exit(1);
      }
      const { run: runExport } = require('../lib/app/export-app');
      await runExport(args);
      break;
    }

    case 'import': {
      if (args.length < 1) {
        console.error(t('cli.import_usage'));
        console.error(t('cli.import_example1'));
        console.error(t('cli.import_example2'));
        process.exit(1);
      }
      const { run: runImport } = require('../lib/app/import-app');
      await runImport(args);
      break;
    }

    case 'get-permission': {
      if (args.length < 2) {
        console.error(t('cli.get_permission_usage'));
        console.error(t('cli.get_permission_example'));
        process.exit(1);
      }
      const { run: runGetPermission } = require('../lib/permission/get-permission');
      await runGetPermission(args);
      break;
    }

    case 'save-permission': {
      if (args.length < 2) {
        console.error(t('cli.save_permission_usage'));
        console.error(t('cli.save_permission_example'));
        process.exit(1);
      }
      const { run: runSavePermission } = require('../lib/permission/save-permission');
      await runSavePermission(args);
      break;
    }

    case 'configure-process': {
      if (args.length < 3) {
        console.error(t('cli.configure_process_usage'));
        console.error(t('cli.configure_process_example'));
        process.exit(1);
      }
      const { run: runConfigureProcess } = require('../lib/process/configure-process');
      await runConfigureProcess(args);
      break;
    }

    case 'create-process': {
      if (args.length < 2) {
        console.error(t('cli.create_process_usage'));
        console.error(t('cli.create_process_example'));
        process.exit(1);
      }
      const { run: runCreateProcess } = require('../lib/process/create-process');
      await runCreateProcess(args);
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
        console.error(`未知的 connector 子命令: ${subCommand}`);
        console.error('使用 openyida connector --help 查看可用子命令');
        process.exit(1);
      }

      const { run: runConnector } = require(modulePath);
      await runConnector(subArgs);
      break;
    }

    case 'query-data': {
      if (args.length < 2) {
        console.error('用法：openyida query-data <appType> <formUuid> [--page N] [--size N] [--search-json JSON] [--inst-id ID]');
        process.exit(1);
      }
      const { run: runQueryData } = require('../lib/core/query-data');
      await runQueryData(args);
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

    default: {
      console.error(t('cli.unknown_command', command));
      console.error(t('cli.run_help'));
      process.exit(1);
    }
  }
}

main()
  .then(() => updateCheckPromise)
  .catch((err) => {
    console.error(t('cli.exec_failed', err.message));
    process.exit(1);
  });
