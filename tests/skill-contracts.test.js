'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readSkill(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function listMarkdownAndJsonFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listMarkdownAndJsonFiles(fullPath);
    }
    return /\.(md|json)$/i.test(entry.name) ? [fullPath] : [];
  });
}

function isSampleRoutingGuidanceFile(file) {
  const relativePath = path.relative(ROOT, file).replace(/\\/g, '/');
  if (relativePath.includes('yida-skills/skills/yida-design/references/style-designs/')) {
    return false;
  }
  return true;
}

describe('OpenYida skill contracts', () => {
  test('agent-facing docs use token auth wording instead of legacy cookie login guidance', () => {
    const docs = [
      'AGENTS.md',
      'README.md',
      'README_zhCN.md',
      'scripts/eval/runner.js',
      'scripts/eval/VERIFY.md',
      'yida-skills/skills/yida-app/SKILL.md',
    ].map(readSkill).join('\n');

    expect(docs).toContain('token session');
    expect(docs).not.toContain('登录宜搭并缓存 Cookie');
    expect(docs).not.toContain('有效 cookie 缓存');
    expect(docs).not.toContain('读取 .cache/cookies.json 中的 corpId');
    expect(docs).not.toContain('lib/auth/login.js');
    expect(docs).not.toContain('lib/auth/qr-login.js');
    expect(docs).not.toContain('lib/auth/codex-login.js');
  });

  test('page command examples keep historical JSX checks separate from custom-page publish', () => {
    const localeDirs = [
      path.join(ROOT, 'lib', 'core', 'locales'),
      path.join(ROOT, 'locales-extra', 'core'),
    ];
    const localeSource = localeDirs.flatMap((localeDir) => {
      if (!fs.existsSync(localeDir)) { return []; }
      return fs.readdirSync(localeDir)
        .filter((file) => file.endsWith('.js'))
        .map((file) => fs.readFileSync(path.join(localeDir, file), 'utf8'));
    })
      .join('\n');

    expect(localeSource).toContain('openyida compile pages/src/home.oyd.jsx');
    expect(localeSource).toContain('openyida check-page pages/src/home.oyd.jsx');
    expect(localeSource).toContain('openyida publish pages/src/home.canvas.jsx');
    expect(localeSource).not.toContain('openyida compile pages/src/home.canvas.jsx');
    expect(localeSource).not.toContain('openyida check-page pages/src/home.canvas.jsx');
  });

  test('optional locale login help keeps the no-browser ownership contract', () => {
    const localeDir = path.join(ROOT, 'locales-extra', 'core');
    const localeFiles = fs.readdirSync(localeDir).filter((file) => file.endsWith('.js'));

    for (const file of localeFiles) {
      const source = fs.readFileSync(path.join(localeDir, file), 'utf8');
      expect(source).toContain('[--no-browser]');
      expect(source).toContain('openyida login --no-browser');
      expect(source).toMatch(/authorization URL|授權連結/);
    }
  });

  test('skill guidance does not route through sample templates', () => {
    const files = listMarkdownAndJsonFiles(path.join(ROOT, 'yida-skills'))
      .filter(isSampleRoutingGuidanceFile);
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return /sample|generate-page|openyida sample/i.test(source);
    });

    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });

  test('root skill uses compact agent-capabilities for default preflight', () => {
    const skill = readSkill('yida-skills/SKILL.md');

    expect(skill).toContain('openyida agent-capabilities --summary-json');
    expect(skill).toContain('`openyida agent-capabilities --json` 是完整能力信息');
    expect(skill).toContain('不要把完整能力信息放进常规完整搭建链路');
    expect(skill).toContain('`workdir` 对应完整能力信息里的 `active.projectRoot`');
    expect(skill).toContain('builder_path.interactive_login.mode=caller_open_url');
    expect(skill).toContain('沙箱浏览器 / 内置 Browser');
    expect(skill).toContain('只有没有浏览器工具或工具调用失败时');
    expect(skill).not.toContain('优先跑一次 `openyida agent-capabilities --json`');
  });

  test('form skills use TextField plus custom validation for phone numbers', () => {
    const createFormSkill = readSkill('yida-skills/skills/yida-create-form-page/SKILL.md');
    const appFormStep = readSkill('yida-skills/skills/yida-app/workflow/step-4-forms-processes.md');

    expect(createFormSkill).toContain('电话号码使用 `TextField`');
    expect(createFormSkill).toContain('不要创建或 patch `PhoneField`');
    expect(appFormStep).toContain('"type": "TextField"');
    expect(appFormStep).toContain('"type": "regex"');
    expect(appFormStep).toContain('"pattern": "^1[3-9]\\\\d{9}$"');
    expect(appFormStep).not.toContain('"type": "PhoneField"');
  });

  test('form action guidance requires atomic binding and exact readback', () => {
    const createFormSkill = readSkill('yida-skills/skills/yida-create-form-page/SKILL.md');
    const advancedModes = readSkill('yida-skills/skills/yida-create-form-page/references/advanced-form-modes.md');
    const appFormStep = readSkill('yida-skills/skills/yida-app/workflow/step-4-forms-processes.md');

    expect(createFormSkill).toContain('字段事件动作使用原子 `field-action`');
    expect(createFormSkill).toContain('`designerBindingFound: true`');
    expect(createFormSkill).toContain('`readbackVerified: true`');
    expect(advancedModes).toContain('字段事件动作不得只写 `actions-module`');
    expect(advancedModes).toContain('"action": "field-action"');
    expect(advancedModes).toContain('入口动作必须是顶层 `export function`');
    expect(advancedModes).toContain('export function handleStatusChange(value)');
    expect(advancedModes).toContain('var actionValue = value && value.value !== undefined ? value.value : value');
    expect(advancedModes).toContain('actionValue && actionValue.value !== undefined ? actionValue.value : actionValue');
    expect(advancedModes).not.toContain('export function handleStatusChange(event)');
    expect(advancedModes).not.toContain('下拉单选 `onChange` 直接接收选中值');
    expect(advancedModes).toContain('不同组件不能统一 `String(value)`');
    expect(advancedModes).toContain('AttachmentField / ImageField');
    expect(advancedModes).toContain('EmployeeField');
    expect(advancedModes).toContain('运行时发生联动但设计器仍显示“新建动作”属于失败');
    expect(advancedModes).toContain('replaceExisting: true');
    expect(appFormStep).toContain('字段事件动作使用 `yida-create-form-page` 的原子 `field-action`');
  });

  test('shared Yida API guidance uses the SelectField value callback contract', () => {
    const apiReference = readSkill('yida-skills/references/yida-api.md');

    expect(apiReference).toContain('下拉单选 `onChange` 直接传入动作参数 `value`');
    expect(apiReference).toContain('value && value.value !== undefined ? value.value : value');
    expect(apiReference).toContain('再以相同方式取得选项明细值');
    expect(apiReference).toContain('不要从 `event` 取值');
    expect(apiReference).toContain('宜搭动作面板不支持空值合并运算符');
    expect(apiReference).toContain('不同组件不能统一 `String(value)`');
    expect(apiReference).toContain('日期区间是 `{ start, end }`');
  });

  test('report skill preserves structured mismatch recovery contract', () => {
    const skill = readSkill('yida-skills/skills/yida-report/SKILL.md');
    const contractMatch = skill.match(
      /<!-- owned-residual-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- owned-residual-contract:end -->/
    );

    expect(skill).toContain('REPORT_SCHEMA_READBACK_MISMATCH');
    expect(skill).toContain('sideEffectState');
    expect(skill).toContain('details.nextAction');
    expect(skill).toContain('report inspect');
    expect(skill).toContain('--json');
    expect(skill).toContain('create/inspect 返回的 `workbenchUrl`');
    expect(skill).toContain('禁止自行拼接 `/{appType}/report/{reportId}`');
    expect(contractMatch).not.toBeNull();

    const contract = JSON.parse(contractMatch[1]);
    const residual = { type: 'report', appType: 'APP_1', reportId: 'REPORT_1', owned: true };
    expect(contract.createReportAllowed).toBe(false);
    expect(contract.inspect).toMatchObject({
      commandId: 'report.inspect',
      appTypeSource: 'residual.appType',
      reportIdSource: 'residual.reportId',
      maxAttempts: 1,
    });
    expect(contract.allowedRepairCommands).toEqual(['append-chart']);
    expect(contract.repairReportIdSource).toBe('residual.reportId');
    expect(contract.deleteAllowed).toBe(false);
    expect(contract.unsafeRepairFallback).toBe('stop_and_report_residual');
    expect(residual.reportId).toBe('REPORT_1');

    const finishStep = readSkill('yida-skills/skills/yida-app/workflow/step-9-output-finish.md');
    expect(finishStep).toContain('原生报表（仅单独交付该报表时）');
    expect(finishStep).toContain('`{base_url}/{appType}/workbench/{reportId}`');
    expect(finishStep).toContain('禁止拼接 `/{appType}/report/{reportId}`');
    expect(finishStep).toContain('最终唯一主入口仍是应用首页');
  });

  test('data management skill exposes only the verified form delete contract', () => {
    const skill = readSkill('yida-skills/skills/yida-data-management/SKILL.md');
    const contractMatch = skill.match(
      /<!-- data-delete-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- data-delete-contract:end -->/
    );

    expect(contractMatch).not.toBeNull();
    expect(skill).toContain('openyida data delete form <appType> <formUuid> --inst-id <formInstId> --expect-form-name <name> --expect-form-type receipt --confirm --json');
    expect(skill).toContain('禁止生成 `openyida data delete process`');
    expect(skill).toContain('禁止在 CLI 报不支持后探索一次性脚本、浏览器私有请求或底层 API');

    const contract = JSON.parse(contractMatch[1]);
    expect(contract).toMatchObject({
      supportedDeleteCommand: 'data delete form',
      requiredTarget: ['appType', 'formUuid', 'formInstId', 'formName', 'formType'],
      preflightCommand: 'data get form',
      businessConfirmationRequired: true,
      executionFlag: '--confirm',
      successCondition: 'deleted=true && readbackVerified=true',
      repeatResult: 'alreadyAbsent=true && mutationPerformed=false',
      processDeleteSupported: false,
      privateApiFallbackAllowed: false,
    });
  });

  test('login skill assigns browser ownership and waits for the original command', () => {
    const skill = readSkill('yida-skills/skills/yida-login/SKILL.md');

    expect(skill).toContain('CLI 默认自动打开系统浏览器');
    expect(skill).toContain('Agent 禁止提取授权 URL 后再次打开');
    expect(skill).toContain('openyida login --no-browser');
    expect(skill).toContain('不要把固定 `sleep`');
    expect(skill).toContain('`ok=true` 与 `can_auto_use=true`');
    expect(skill).toContain('用户未授权就关闭浏览器时');
    expect(skill).toContain('不要只把 URL 贴给用户然后等待');
    expect(skill).toContain('沙箱浏览器 / 内置 Browser');
  });

  test('QwenWork install guidance aligns with QoderWork user-level skills layout', () => {
    const docs = [
      'README.md',
      'README_zhCN.md',
      'yida-skills/SKILL.md',
      'scripts/postinstall.js',
    ].map(readSkill).join('\n');

    expect(docs).toContain('~/.qwenworkcn/skills/yida-skills/');
    expect(docs).toContain('~/.qoderwork/skills/yida-skills/');
    expect(docs).toContain('未检测到 `~/.qwenworkcn` 时');
    expect(docs).toContain('folderName');
    expect(docs).toContain('QwenWork（千问办公）');
    expect(docs).not.toContain('project/.qwenworkcn/skills/');
    expect(docs).not.toContain('不要把 OpenYida skill 放到项目根目录');
    expect(docs).not.toContain('不会自动加载');
    expect(docs).not.toContain('project-root `.qwenworkcn/skills/`');
    expect(docs).not.toContain('not auto-loaded');
    expect(docs).not.toContain('特定项目生效');
    expect(docs).not.toContain('trigger conditions');
  });

  test('skills index carries machine routing hints for high-confusion skills', () => {
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const byName = new Map(index.skills.map((skill) => [skill.name, skill]));

    const form = byName.get('yida-create-form-page');
    expect(form.positive_signals).toEqual(expect.arrayContaining(['新增字段']));
    expect(form.negative_signals).toEqual(expect.arrayContaining(['新增记录']));
    expect(form.command_ids).toEqual(expect.arrayContaining(['create-form.create']));

    const login = byName.get('yida-login');
    const logout = byName.get('yida-logout');
    expect(login.command_ids).toEqual(expect.arrayContaining(['agent-capabilities', 'login', 'auth']));
    expect(logout.command_ids).toEqual(expect.arrayContaining(['logout', 'auth']));

    const lifecycle = byName.get('yida-app-lifecycle');
    expect(lifecycle.positive_signals).toEqual(expect.arrayContaining(['启用应用', '停用应用', '上线应用', '下线应用']));
    expect(lifecycle.negative_signals).toEqual(expect.arrayContaining(['发布页面', '禁用集成自动化']));
    expect(lifecycle.command_ids).toEqual(['app-online', 'app-offline']);
    const lifecycleSkill = readSkill('yida-skills/skills/yida-app-lifecycle/SKILL.md');
    expect(lifecycleSkill).toContain('只有用户明确说');
    expect(lifecycleSkill).toContain('`app-offline` 会让现有应用停止服务');
    expect(lifecycleSkill).toContain('不得在测试、评测或默认 shared real E2E 中执行真实启用/停用');

    const data = byName.get('yida-data-management');
    expect(data.positive_signals).toEqual(expect.arrayContaining(['新增记录']));
    expect(data.negative_signals).toEqual(expect.arrayContaining(['修改表单结构']));

    const canvas = byName.get('yida-canvas-custom-page');
    expect(canvas.display_name).toBe('自定义页面开发');
    expect(canvas.description).toContain('宜搭自定义页面开发规范');
    expect(canvas.negative_signals).toEqual(expect.arrayContaining(['renderJsx 平台 Jsx 组件迁移']));

    const custom = byName.get('yida-custom-page');
    expect(custom.display_name).toBe('JSX 自定义页面开发');
    expect(custom.description).toContain('仅用于已检测到 .oyd.jsx/.oyb.jsx/renderJsx/平台 Jsx 组件页面维护');
    expect(custom.description).not.toContain('this.$/this.utils.yida/dataSourceMap');
    expect(custom.positive_signals).not.toEqual(expect.arrayContaining(['this.$', 'this.utils.yida', 'this.dataSourceMap']));

    const createAppSkill = readSkill('yida-skills/skills/yida-create-app/SKILL.md');
    expect(createAppSkill).not.toContain('fromBuilderAi');
    expect(createAppSkill).not.toContain('FROM_BUILDER_AI');
    expect(createAppSkill).not.toContain('AppConfigType');

    const publishPage = byName.get('yida-publish-page');
    expect(publishPage.command_ids).toEqual(['publish']);
    expect(publishPage.tags).not.toEqual(expect.arrayContaining(['compile', 'check-page']));

    const rechart = byName.get('yida-rechart');
    expect(rechart.positive_signals).toEqual(expect.arrayContaining(['高级图表', 'Recharts']));
    expect(rechart.negative_signals).toEqual(expect.arrayContaining(['明确指定 ECharts']));

    const canvasTable = byName.get('yida-canvas-table-form');
    expect(canvasTable.positive_signals).toEqual(expect.arrayContaining(['批量录入', 'antd Table']));
    expect(canvasTable.negative_signals).toEqual(expect.arrayContaining(['this.utils.yida.saveFormData']));

    const design = byName.get('yida-design');
    expect(design.description).toContain('当用户要做完整应用产品设计、单页 UI 改造、主页面视觉设计、应用主题色或全局换肤时使用');
    expect(design.description).toContain('本技能基于需求分析和资源上下文');
    expect(design.description).toContain('本技能不写页面源码');
    expect(design.description).toContain('本技能不写页面源码');
    expect(design.done_when).toContain('prd/<项目名>/prd.md');
    expect(design.done_when).toContain('prd/<项目名>/design.md');
    expect(design.tags).toEqual(expect.arrayContaining(['产品设计', 'ui_skill']));
    expect(design.positive_signals).toEqual(expect.arrayContaining(['主页面 UI 设计', 'ui_skill']));

    const designSkill = readSkill('yida-skills/skills/yida-design/SKILL.md');
    expect(designSkill).toContain('本技能输出 `prd.md` 和 `design.md`，不写 JSX/TSX');
    expect(designSkill).toContain('从 Step 1 开始按顺序执行');
    expect(designSkill).toContain('每步开始前先读取对应步骤文件');
    expect(designSkill).toContain('确保不跳步、不停在中间步骤');

    const formDetail = byName.get('yida-form-detail');
    expect(formDetail.description).toContain('表单页视觉引导');
    expect(formDetail.description).toContain('拿到 formUuid 后默认');
    expect(formDetail.description).toContain('Divider 分割线语义分组');
    expect(formDetail.tags).toEqual(expect.arrayContaining(['表单视觉引导', 'Divider']));
  });

  test('specialized page-adjacent skills avoid duplicated custom-page route prose', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const rechart = readSkill('yida-skills/skills/yida-rechart/SKILL.md');
    const canvasTable = readSkill('yida-skills/skills/yida-canvas-table-form/SKILL.md');
    const nativeChart = readSkill('yida-skills/skills/yida-chart/SKILL.md');
    const nativeTable = readSkill('yida-skills/skills/yida-table-form/SKILL.md');

    expect(root).toContain('高级图表、可视化、看板图表 | 默认 `yida-rechart`');
    expect(root).toContain('默认 `yida-canvas-table-form`');
    expect(rechart).toContain('禁止前端全量聚合');
    expect(rechart).toContain('`yida-report`');
    expect(rechart).toContain('`yida-canvas-data-binding`');
    expect(canvasTable).toContain('YidaCodeCanvas 组件内没有平台 JSX 组件实例桥');
    expect(canvasTable).toContain('window.__OPENYIDA_YIDA_API__');
    expect(canvasTable).toContain('未验证不得伪装闭环');
    expect(canvasTable).toContain('Promise.all');
    expect(nativeChart).toContain('# 宜搭 ECharts 高级报表技能');
    expect(nativeTable).toContain('saveFormData');
  });

  test('deprecated yida-ppt routes through yida-ppt-slider only', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const slider = readSkill('yida-skills/skills/yida-ppt-slider/SKILL.md');
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const byName = new Map(index.skills.map((skill) => [skill.name, skill]));

    expect(byName.has('yida-ppt')).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'yida-skills', 'skills', 'yida-ppt', 'SKILL.md'))).toBe(false);
    expect(root).toContain('`yida-ppt-slider`');
    expect(root).not.toContain('`yida-ppt` |');
    expect(byName.get('yida-ppt-slider').aliases).toEqual(expect.arrayContaining(['yida-ppt']));
    expect(byName.get('yida-ppt-slider').positive_signals).toEqual(expect.arrayContaining(['yida-ppt', 'PPT']));
    expect(slider).toContain('"yida-ppt"');
  });

  test('tingji reads taskUuid before flash-note PRD generation', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const tingji = readSkill('yida-skills/skills/yida-tingji/SKILL.md');
    const flash = readSkill('yida-skills/skills/yida-flash-note-to-prd/SKILL.md');
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const byName = new Map(index.skills.map((skill) => [skill.name, skill]));

    expect(root).toContain('先用 `yida-tingji` 读取听记内容，再把已有内容交给 `yida-flash-note-to-prd`');
    expect(tingji).toContain('本技能不直接生成 PRD');
    expect(flash).toContain('先加载 `yida-tingji` 读取听记内容');
    expect(byName.get('yida-tingji').description).toContain('只负责读取内容');
    expect(byName.get('yida-flash-note-to-prd').description).toContain('若用户只给 taskUuid');
  });

  test('yida-app unified build forbids unbound dataSourceMap by default', () => {
    const skill = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const step2 = readSkill('yida-skills/skills/yida-app/workflow/step-2-design.md');
    const step9 = readSkill('yida-skills/skills/yida-app/workflow/step-9-output-finish.md');

    expect(skill).toContain('全局 CLI、ID、存储、发布和输出规则以主入口 `SKILL.md` 为准');
    expect(step2).toContain('use_skill("yida-design", "完整应用产品设计")');
    expect(step2).toContain('prd/<项目名>/prd.md');
    expect(step2).toContain('prd/<项目名>/design.md');
    expect(skill).toContain('默认页面源码不得使用 `this.dataSourceMap.*`');
    expect(skill).toContain('页面数据桥或 `window.__OPENYIDA_YIDA_API__.searchFormDatas(params)`');
    expect(skill).toContain('发布输出出现 `No custom page data sources to preserve`');
    expect(skill).toContain('use_skill("yida-data-source-connectors")');
    expect(step9).toContain('先写 2-3 句业务交付总结，再给一个主入口链接');
    expect(step9).toContain('新增、修改或发布单个具体页面时，主入口是当前页面 URL');
    expect(step9).toContain('其他完整应用、建表单、建流程、权限、主题、导航或批量资源场景，主入口是应用首页 `{base_url}/{appType}/workbench`');
    expect(step9).toContain('不默认输出资源 ID 表格、资源清单、长列表');
    expect(step9).toContain('已完成订单、客户和商品等核心业务表单');
    expect(step9).toContain('主入口：`{base_url}/{appType}/workbench`');
    expect(step9).toContain('不把 `g.alicdn.com` 的 `index.css`、`index.js`、`index.html`、`locales/*.json`');
    expect(step9).toContain('顶层 `skillsUsed`');
    expect(step9).toContain('实际读取并使用');
  });

  test('unified full app build consumes PRD navigation order and falls back to auto order', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const app = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const step4 = readSkill('yida-skills/skills/yida-app/workflow/step-4-forms-processes.md');
    const step8 = readSkill('yida-skills/skills/yida-app/workflow/step-8-publish-navigation.md');
    const publish = readSkill('yida-skills/skills/yida-publish-page/SKILL.md');
    const navGroup = readSkill('yida-skills/skills/yida-nav-group/SKILL.md');
    const manifest = readSkill('lib/core/command-manifest.js');
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const byName = new Map(index.skills.map((skill) => [skill.name, skill]));

    expect(root).toContain('默认完成即停止');
    expect(app).toContain('[Step 8：发布页面并排序导航]');
    expect(step8).toContain('发布本轮修改过的页面源码到真实 display 页面，并执行轻量导航排序');
    expect(step8).toContain('openyida publish <source> <appType> <displayPageFormUuid> --canvas --health-check --auto-nav-order');
    expect(step8).toContain('PRD 写明页面/表单清单顺序时，执行 `openyida nav-group order <appType> <页面/表单...>`');
    expect(step4).toContain('PRD 包含审批、流程、申请、审核、工单等流程对象时');
    expect(publish).toContain('`--auto-nav-order`');
    expect(publish).toContain('PRD 已写明导航顺序时优先用 `openyida nav-group order <appType> <页面/表单...>`');
    expect(publish).toContain('排序失败只警告，不回滚已发布页面');
    expect(navGroup).toContain('PRD 导航优先');
    expect(navGroup).toContain('openyida nav-group order <appType> <页面/表单...>');
    expect(navGroup).toContain('openyida nav-group auto-order <appType>');
    expect(navGroup).toContain('目标分组必须通过 `--to` 传入');
    expect(manifest).toContain('default_nav_order_policy');
    expect(manifest).toContain('openyida nav-group order <appType> <items...>');
    expect(manifest).toContain('openyida publish ... --auto-nav-order');
    expect(manifest).toContain('product_design_policy');
    expect(manifest).toContain('Full app creation first resolves resource context, then uses yida-design for requirement analysis and product design');
    expect(manifest).toContain('final_link_policy');
    expect(manifest).toContain('Return exactly one primary user-facing link');
    expect(manifest).toContain('{base_url}/{appType}/workbench');
    expect(byName.get('yida-app').description).toContain('表单/流程先于自定义页面');
    expect(byName.get('yida-nav-group').description).toContain('PRD 写明导航顺序时用 order');
  });

  test('yida-design owns product design output and yida-app consumes it', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const skill = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const createApp = readSkill('yida-skills/skills/yida-create-app/SKILL.md');
    const design = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const step1 = readSkill('yida-skills/skills/yida-design/workflow/step-1-positioning.md');
    const step3 = readSkill('yida-skills/skills/yida-design/workflow/step-3-information-architecture.md');
    const step5 = readSkill('yida-skills/skills/yida-design/workflow/step-5-visual-states.md');
    const output = readSkill('yida-skills/skills/yida-design/workflow/output-prd.md');
    const outputDesign = readSkill('yida-skills/skills/yida-design/workflow/output-design.md');
    const pageDesign = readSkill('yida-skills/skills/yida-design/sub_skill/page-design/SKILL.md');
    const pageGeneration = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const styleSelection = readSkill('yida-skills/skills/yida-design/references/style-design-selection.md');
    const scaffoldRecipes = readSkill('yida-skills/skills/yida-design/references/visual-scaffold-recipes.md');
    const styleRegistry = readSkill('yida-skills/skills/yida-design/references/style-designs/registry.md');
    const dataManagement = readSkill('yida-skills/skills/yida-data-management/SKILL.md');
    const formPage = readSkill('yida-skills/skills/yida-create-form-page/SKILL.md');
    const appStep2 = readSkill('yida-skills/skills/yida-app/workflow/step-2-design.md');
    const appStep4 = readSkill('yida-skills/skills/yida-app/workflow/step-4-forms-processes.md');
    const appStep5 = readSkill('yida-skills/skills/yida-app/workflow/step-5-seed-records.md');
    const appStep7 = readSkill('yida-skills/skills/yida-app/workflow/step-7-page-code.md');
    const appStep9 = readSkill('yida-skills/skills/yida-app/workflow/step-9-output-finish.md');
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const byName = new Map(index.skills.map((item) => [item.name, item]));

    expect(appStep2).toContain('完整应用只走统一产品设计');
    expect(appStep2).toContain('`yida-design` 产出');
    expect(root).toContain('`yida-create-app`；创建成功后把真实 `appType` 交给 `yida-design` 生成或更新 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md`');
    expect(root).toContain('`yida-create-page`，之后交给 `yida-canvas-custom-page` 编写页面源码，再交给 `yida-publish-page` 发布');
    expect(createApp).toContain('创建成功后，把真实 `appType` 交给 `yida-design` 生成或更新 `prd/<项目名>/prd.md` 与 `prd/<项目名>/design.md`');
    expect(createApp).toContain('创建应用后，先用 `yida-design` 产出或更新 PRD，再继续执行');
    expect(appStep2).toContain('`prd/<项目名>/prd.md`');
    expect(appStep2).toContain('`prd/<项目名>/design.md`');
    expect(skill).not.toContain('用户说“按默认方案”“不要追问”“直接创建”“尽快搭建”等');
    expect(skill).not.toContain('默认链路：`resolve context → yida-design PRD');
    expect(appStep2).toContain('资源创建顺序、页面实现交付顺序、导航顺序和验收标准');
    expect(appStep2).toContain('`prd.md` 和 `design.md` 是唯一设计事实源');
    expect(appStep7).toContain('从 PRD + `design.md` 派生当前业务自己的 `page-spec.json`');
    expect(appStep7).toContain('conflictPolicy: "prd-design-win"');
    expect(pageGeneration).toContain('PRD 写有 `pageSpecHandoff` 时');
    expect(appStep7).toContain('事实源修正');
    expect(appStep7).toContain('回写 `prd.md`');
    expect(appStep7).toContain('回写 `design.md`');
    expect(appStep7).toContain('小范围 patch 源码');
    expect(pageGeneration).toContain('实现阶段不再从 PRD 里反推视觉，也不直接读取 `references/style-designs/`');
    expect(pageGeneration).toContain('页面实现路径二选一');
    expect(pageGeneration).toContain('结构化实现工具提供可编译运行时结构');
    expect(skill).toContain('[写入初始表单数据](workflow/step-5-seed-records.md)');
    expect(appStep5).toContain('use_skill("yida-data-management", "为核心业务表单写入 1-3 条示例记录")');
    expect(appStep5).toContain('完整应用默认给本轮新建或页面数据源依赖的核心普通表单写入 1-3 条业务化 seed records');
    expect(appStep4).toContain('拿到或确认真实 `formUuid` 后，必须执行表单主题和 formDetail CSS 注入校验');
    expect(appStep4).toContain('`globalThemeActionFound: true` 与 `formDetailStyleActionFound: true`');
    expect(appStep9).toContain('普通表单和流程表单已注入全局主题样式，详情页已注入 formDetail CSS');
    expect(appStep9).toContain('新建或作为页面数据源的核心普通表单已写入 1-3 条真实示例记录并 query 抽查');
    expect(skill).not.toContain('## 模板优先');
    expect(skill).not.toContain('## Sample 与业务页边界');
    expect(skill).not.toContain('模板路由');
    expect(skill).not.toContain('去 sample 化检查');
    expect(design).toContain('需求分析归本技能');
    expect(design).not.toContain('应用体验蓝图');
    expect(design).not.toContain('推荐模板');
    expect(output).toContain('## PRD 输出格式');
    expect(output).not.toContain('## design.md 输出格式');
    expect(outputDesign).toContain('## design.md 输出格式');
    expect(outputDesign).toContain('themeProfile:');
    expect(outputDesign).toContain('yidaThemeRuntime:');
    expect(outputDesign).toContain('globalThemeInjection: <style#yida-global-theme / customThemeStyle.tokens / none>');
    expect(outputDesign).toContain('formRuntimeInjection: style#yida-global-theme');
    expect(outputDesign).toContain('formDetailStyleInjection: style#yida-form-detail-style');
    expect(outputDesign).toContain('themeConsistency: app, custom pages, normal forms, process forms, submission pages, and formDetail pages share the same themeProfile tokens');
    expect(outputDesign).toContain('## 18. 实现适配');
    expect(outputDesign).toContain('### Yida Global Theme Runtime Contract');
    expect(outputDesign).toContain('helperRef: yida-canvas-custom-page/references/theme-runtime-helpers.md');
    expect(outputDesign).toContain('injectTargets: [currentDocument, sameOriginParentDocuments]');
    expect(output).toContain('再交给 `yida-canvas-custom-page` 实现');
    expect(outputDesign).toContain('页面实现交给 `yida-canvas-custom-page`。');
    expect(pageDesign).toContain('交给 `yida-canvas-custom-page` 实现');
    expect(outputDesign).toContain('collectYidaThemeDocuments');
    expect(outputDesign).toContain('--color-brand1-1: <明亮品牌浅色或浅 hover 色>');
    expect(outputDesign).toContain('--color-brand1-10: <深色或透明强调档>');
    expect(outputDesign).toContain('--color-brand-1: <移动端品牌色 1>');
    expect(outputDesign).toContain('--color-brand-4: <移动端品牌色 4>');
    expect(outputDesign).toContain('backgroundLayer:');
    expect(outputDesign).toContain('surfaceContrast:');
    expect(outputDesign).toContain('### Surface Contrast Contract');
    expect(outputDesign).toContain('white-bg-bordered-card');
    expect(outputDesign).toContain('gray-bg-white-card');
    expect(outputDesign).toContain('gradient-bg-glass-card');
    expect(outputDesign).toContain('页面背景与卡片背景必须形成明显层次对比');
    expect(outputDesign).toContain('rounded:');
    expect(outputDesign).toContain('densityRule');
    expect(outputDesign).toContain('breathingRule');
    expect(outputDesign).toContain('roundedRule');
    expect(outputDesign).toContain('卡片圆角范围 0-32px');
    expect(outputDesign).toContain('卡片 padding 必须大于 20px');
    expect(outputDesign).toContain('卡片和卡片的 gap 必须小于 20px');
    expect(outputDesign).toContain('状态摘要 64-88px');
    expect(outputDesign).toContain('### Background Layer Contract');
    expect(outputDesign).toContain('softTintCanvas');
    expect(outputDesign).toContain('topIrregularWash');
    expect(outputDesign).toContain('flowLight');
    expect(outputDesign).toContain('prefers-reduced-motion');
    expect(outputDesign).toContain('已写清对比度、内容栅格和 reduced motion 静态降级');
    expect(output).not.toContain('## PRD 模板');
    expect(output).not.toContain('推荐模板');
    expect(output).not.toContain('区别于 sample 默认风格');
    expect(step3).toContain('每个页面写清 scene、目标用户、主任务和需要设计的区块');
    expect(step3).toContain('页面区块 / contentBlocks：<工作台、首页、门户、看板、展示页和业务入口页推荐逐条列出 8-10 个区块以上');
    expect(step3).not.toContain('推荐模板');
    expect(step5).toContain('示例品牌名、默认指标和通用卖点');
    expect(step5).not.toContain('sample 品牌名');
    expect(design).toContain('视觉设计规范只写 design.md');
    expect(design).toContain('visualScaffold');
    expect(design).toContain('写入 `design.md`');
    expect(design).toContain('实现交接必须结构化');
    expect(design).toContain('每个 display 页面在 PRD 中输出 `pageSpecHandoff`');
    expect(step5).toContain('`visualScaffold`：给所有页面实现使用的硬骨架');
    expect(step5).toContain('读取 [视觉脚手架配方库](../references/visual-scaffold-recipes.md)');
    expect(step5).toContain('读取 [页面质量门禁](../references/page-quality-gates.md)');
    expect(step5).toContain('`surfaceMap` 写清每个区块的容器形态');
    expect(step5).toContain('源码槽位写清 `rootShell`、`prioritySurface`');
    expect(step5).toContain('这些字段要能直接指导实现，而不是形容词');
    expect(readSkill('yida-skills/skills/yida-design/references/visual-scaffold-recipes.md')).toContain('## 源码级槽位');
    expect(readSkill('yida-skills/skills/yida-design/references/visual-scaffold-recipes.md')).toContain('`prioritySurface`：首屏最大视觉锚点');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('## 6. 双文件输出门禁');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('缺少 `pageSpecHandoff`、缺少 `design.md`');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('## 5. 视觉层次门禁');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('`backgroundLayer`');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('`surfaceMaterial`');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('`surfaceContrast`');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('圆角、间距与呼吸感门禁');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('`densityRule`');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('`breathingRule`');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('`roundedRule`');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('背景层推荐要求');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('背景可以不规则，内容必须规则');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('浅灰背景（如 `#F3F4F6`）配白色无边框卡片');
    expect(scaffoldRecipes).toContain('## 背景层配方');
    expect(scaffoldRecipes).toContain('radialGlowWash');
    expect(scaffoldRecipes).toContain('organicNoise');
    expect(scaffoldRecipes).toContain('背景和卡片不可相近或相同');
    expect(design).toContain('[design.md 输出格式](workflow/output-design.md)');
    expect(output).toContain('- pageSpecHandoff：');
    expect(outputDesign).toContain('- visualScaffold：<rootShell / prioritySurface / statusPrimitive / actionPrimitive / contentPrimitive / contextPrimitive / statePrimitive / responsiveRule / breathingRule>');
    expect(outputDesign).toContain('- surfaceContrast：<页面背景与卡片背景的层次搭配');
    expect(output).toContain('- designFile：<prd/<项目名>/design.md>');
    expect(output).toContain('- designRefs：<themeProfile / sceneRecipes.<scene> / components.<name> / states.<name>>');
    expect(design).toContain('[视觉脚手架配方库](references/visual-scaffold-recipes.md)');
    expect(design).toContain('[页面质量门禁](references/page-quality-gates.md)');
    expect(pageGeneration).toContain('## 页面场景到实现入口');
    expect(pageGeneration).toContain('PRD 用来确认页面场景、区块、数据来源、主操作和移动端要求');
    expect(pageGeneration).toContain('design.md 用来确认主题色、页面风格、视觉 DNA、布局配方、材质、圆角、密度、呼吸感、组件和状态规则');
    expect(pageGeneration).toContain('实现页面背景和卡片时必须消费 `surfaceContrast`');
    expect(pageGeneration).toContain('源码不得输出浅底白卡无边框');
    expect(pageGeneration).toContain('实现时按下表选择页面结构');
    expect(pageGeneration).toContain('## Source Of Truth');
    expect(pageGeneration).toContain('`prd.md` 和 `design.md` 是唯一设计事实源');
    expect(pageGeneration).toContain('`page-spec.json` 只是页面实现阶段的派生文件');
    expect(pageGeneration).toContain('sourceOfTruth.conflictPolicy = "prd-design-win"');
    expect(pageGeneration).toContain('`YidaCodeCanvas` 组件实现只遵守当前项目的 `design.md`');
    expect(pageGeneration).toContain('## 修复路径');
    expect(pageGeneration).toContain('页面目标、业务对象、指标口径、主操作、表单入口、数据来源');
    expect(pageGeneration).toContain('回写 `prd.md`，再重新派生 `page-spec.json`');
    expect(pageGeneration).toContain('回写 `design.md`，再重新派生 `page-spec.json` 或重读 design.md 实现');
    expect(pageGeneration).toContain('只有实现偏差才对生成源码做小范围 Edit/patch');
    expect(pageGeneration).toContain('近白画布如果有渐变、装饰、素材焦点或足够内容密度，可以作为背景感方案');
    expect(pageGeneration).toContain('`.oy-page-root` 承载基础底色');
    expect(pageGeneration).toContain('主题关系、token、`visualScaffold`、`backgroundLayer`、`surfaceMaterial`、`surfaceContrast`、`colorRoles`、`depthRule`、`roundedRule`、`densityRule`、`breathingRule`、组件规则、状态规则、响应式规则不足或错误');
    expect(pageGeneration).toContain('所有展示型页面都按当前项目 `design.md` 的 `visualScaffold` 实现');
    expect(pageGeneration).toContain('`visualScaffold` 必须来自 `design.md`');
    expect(pageGeneration).toContain('如果当前 `design.md` 缺少 `roundedRule`、`densityRule` 或 `breathingRule`，先回写设计文件再实现');
    expect(pageGeneration).not.toContain('## 首次生成模板路由');
    expect(output).toContain('## 1. 应用基本信息');
    expect(output).toContain('| 应用类型 | <企业管理 / 经营分析 / 流程审批 / 数据采集 / 客户服务 / 库存进销存 / 项目协作 / 资产设备 / 教育培训 / 知识内容 / 监控指挥 / 官网门户 / 活动报名 / 轻量工具> |');
    expect(output).toContain('| 主题色 | <当前应用主题色 / 用户指定品牌色 / 待创建后回填；写清色值或主题 key> |');
    expect(step1).toContain('| 流程审批类 | 申请表、审批表、待办页、流程详情 | 填写路径、节点状态、处理动作 |');
    expect(step1).toContain('| 数据采集类 | 移动录入表单、扫码登记、批量导入、提交结果页 | 快速录入、校验反馈、弱网可读 |');
    expect(step1).toContain('| 客户服务类 | 客户列表、工单池、服务记录、回访表 | 客户上下文、处理优先级、跟进记录 |');
    expect(step1).toContain('| 库存进销存类 | 商品管理、订单管理、库存预警、出入库明细 | 库存水位、状态流转、明细追踪 |');
    expect(step1).toContain('| 轻量工具类 | 计算器、查询页、配置工具、导入导出页 | 单任务效率、输入输出清晰、错误提示 |');
    expect(output).toContain('## 2. 应用配置');
    expect(output).toContain('| appType | <已有应用填真实 appType；从零创建时写“待创建后回填”> |');
    expect(output).toContain('| corpId | <目标组织 corpId；未知时写“待登录态确认”> |');
    expect(output).toContain('| baseUrl | <平台地址，如 https://www.aliwork.com 或私有化域名> |');
    expect(output).not.toContain('## 3. 需求范围与核心旅程');
    expect(output).not.toContain('| 本轮必做 | <1-3 个核心能力，围绕真实闭环> |');
    expect(output).not.toContain('| 后续候选 | <报表、公开访问、示例数据、复杂自动化等可后置能力> |');
    expect(output).not.toContain('| 关键角色旅程 | <角色从进入应用到完成任务的主路径> |');
    expect(output).not.toContain('## 3. 应用体验蓝图');
    expect(output).not.toContain('- 主入口页面：<官网首页 / 工作台 / 经营驾驶舱 / 其他；说明为什么作为第一入口>');
    expect(output).not.toContain('- 页面组合：');
    expect(output).toContain('## 3. 数据结构（业务语义，不含细节 ID）');
    expect(output).toContain('### 初始示例数据计划');
    expect(output).toContain('完整应用默认在表单创建后、页面实现前，为核心业务普通表单写入 1-3 条业务化示例记录');
    expect(output).toContain('| 3 | 表单主题与详情页样式注入 | 提交页、详情页、自定义页面和应用主题色必须一致；详情页必须有 formDetail CSS | `globalThemeActionFound: true`、`formDetailStyleActionFound: true` |');
    expect(output).toContain('| 4 | 初始示例数据 | 页面需要读取真实表单记录，完整应用默认写入 1-3 条核心业务记录 | 写入数量、抽查结果 |');
    expect(dataManagement).toContain('## 完整应用默认 seed records');
    expect(dataManagement).toContain('`yida-app` 从零生成完整应用时，表单创建完成后默认加载本技能');
    expect(dataManagement).toContain('每条实例单独执行一次 `openyida data create form`');
    expect(dataManagement).toContain('写完必须 `openyida data query form` 抽查至少 1 条');
    expect(formPage).toContain('完整应用生成场景中，create 成功并记录 formUuid 后，把核心普通表单交给 `yida-data-management` 默认写入 1-3 条业务化示例记录');
    expect(appStep4).toContain('## 字段配置文件示例');
    expect(appStep4).toContain('project/.cache/openyida/<项目名>/xxx-fields.json');
    expect(appStep4).toContain('"访客姓名": "textField_xxxxxxxx"');
    expect(appStep5).toContain('列表/工作台通常 2 条，看板/排行/状态分布通常 3 条');
    expect(output).toContain('## 4. 页面与功能设计');
    expect(output).toContain('## 5. 应用主题与风格摘要');
    expect(output).toContain('| 设计文件 | `prd/<项目名>/design.md` |');
    expect(output).toContain('| 应用主题色 | <平台预置 key 或自定义色盘名称；必须与 design.md 的 Theme Profile 一致> |');
    expect(output).toContain('| 风格摘要 | <2-3 个业务风格关键词，例如高效协同、稳重可信、经营洞察；完整 UI 设计见 design.md> |');
    expect(output).not.toContain('| 导航视觉 |');
    expect(output).toContain('### <页面名>');
    expect(output).toContain('- 页面类型：<display-page / form-page / process-form / report / detail-entry>');
    expect(output).toContain('- 页面定位：<主入口页面 / 核心业务页 / 详情页 / 报表页 / 配置页；说明为什么需要这个页面>');
    expect(output).toContain('- 页面关系：<从哪里进入、下一步去列表 / 看板 / 表单提交 / 详情 / 报表中的哪一个>');
    expect(output).toContain('- 设计文件：<display-page 填 `prd/<项目名>/design.md`；普通表单 / 流程表单写“跟随应用主题、表单视觉引导、表单全局主题注入和详情页样式注入”>');
    expect(output).toContain('- 设计引用：<引用 design.md 中的章节 ID，例如 themeProfile、sceneRecipes.workbench、components.table、states.empty>');
    expect(output).toContain('- 关联资源：');
    expect(output).toContain('  - 表单：<表单名称；用于新增、编辑、查询或作为列表数据来源>');
    expect(output).toContain('  - 流程：<流程名称；用于提交、审批、处理或状态流转>');
    expect(output).toContain('  - 报表 / 数据源：<报表或数据来源；用于指标、图表或大屏>');
    expect(output).toContain('  - 详情页：<原生 formDetail / 自定义详情页 / 抽屉详情>');
    expect(output).toContain('- 需要设计的区块：');
    expect(output).toContain('  - <区块名称>：<区块目的；数据来源；主操作；状态>');
    expect(output).toContain('  - 自定义页面需要逐个写清首屏、筛选、列表/卡片、图表、表单入口、详情抽屉、空态等区块。');
    expect(output).toContain('## 8. 资源创建顺序');
    expect(output).toContain('## 9. 页面实现交付顺序');
    expect(output).toContain('## 10. 导航顺序');
    expect(output).toContain('| 分组 | 页面顺序 | 导航呈现 | 放置原则 |');
    expect(output).toContain('表单/流程在自定义页面之前');
    expect(output).toContain('## 11. 验收标准');
    expect(design).toContain('[design.md 生成规则](references/style-design-selection.md)');
    expect(design).toContain('[style-design 风格注册表](references/style-designs/registry.md)');
    expect(step5).toContain('读取 [design.md 生成规则](../references/style-design-selection.md)');
    expect(step5).toContain('- designFile：<prd/<项目名>/design.md>');
    expect(step5).toContain('- baseDesignSource：references/style-designs/<selected-style>.md');
    expect(styleSelection).toContain('## 输出字段');
    expect(styleSelection).toContain('当前项目 `design.md` 提供所有页面必须遵守的视觉 DNA、布局、组件样式、主题 token 和状态规则');
    expect(styleSelection).toContain('| visualScaffold | design.md |');
    expect(styleSelection).toContain('| rounded / spacing / breathing | design.md |');
    expect(styleSelection).toContain('读取 [visual-scaffold-recipes.md](visual-scaffold-recipes.md)');
    expect(styleSelection).toContain('根据行业、品牌、业务情绪、应用主题和用户偏好生成配色');
    expect(styleSelection).toContain('卡片 padding >20px，卡片间 gap <20px，卡片圆角 0-32px');
    expect(scaffoldRecipes).toContain('# 视觉脚手架配方库');
    expect(scaffoldRecipes).toContain('## 配方 A：运营驾驶舱三栏');
    expect(scaffoldRecipes).toContain('左侧 260-320px 指标轨，中间 1fr 主图表区，右侧 280-360px 风险与事件流');
    expect(scaffoldRecipes).toContain('三栏比例存在，不退化为四张等宽 KPI 卡');
    expect(scaffoldRecipes).toContain('## 配方 B：任务工作台双栏');
    expect(scaffoldRecipes).toContain('KPI 组只算 1 个区块，快捷入口组只算 1 个区块');
    expect(styleRegistry).toContain('_design-md-template.md');
    expect(styleRegistry).toContain('默认审美方向是“圆润、高密且有呼吸感”');
    expect(fs.existsSync(path.join(ROOT, 'yida-skills', 'skills', 'yida-design', 'sub_skill', 'workhome-ui-skill', 'SKILL.md'))).toBe(false);
    const styleDesignEntries = fs.readdirSync(path.join(ROOT, 'yida-skills', 'skills', 'yida-design', 'references', 'style-designs')).sort();
    expect(styleDesignEntries).toEqual(expect.arrayContaining(['_design-md-template.md', 'registry.md']));
    expect(styleDesignEntries.length).toBeGreaterThan(2);
    expect(design).not.toContain('workhome-ui-skill');
    expect(step5).not.toContain('workhome-ui-skill');
    expect(output).not.toContain('workhome-ui-skill');
    expect(appStep2).toContain('`yida-design` 产出');
    expect(appStep2).toContain('PRD 写明资源创建顺序、页面实现交付顺序、导航顺序或明确兜底策略');
    expect(appStep2).toContain('`prd.md` | 应用基本信息、用户角色、核心任务、业务对象、数据结构、页面与功能、业务逻辑、交互状态、资源蓝图、资源创建顺序、页面实现交付顺序、导航顺序和验收标准');
    expect(appStep2).toContain('`design.md` | 主题 token、视觉 DNA、布局密度、圆角规则、背景与卡片层次、组件规则、状态规则、响应式规则和页面视觉验收');
    expect(appStep2).not.toContain('应用体验蓝图');
    expect(appStep2).not.toContain('需求范围');
    expect(appStep2).not.toContain('## 完整低代码 PRD 模板');
    expect(byName.get('yida-app').description).toContain('消费 yida-design 的 prd.md 与 design.md');
    expect(byName.get('yida-app').description).toContain('表单/流程先于自定义页面');
    expect(byName.get('yida-app').description).toContain('发布后优先按 PRD 导航顺序排序');
    expect(byName.get('yida-create-app').description).toContain('交给 yida-design 生成或更新 PRD');
    expect(byName.get('yida-app').done_when).toContain('PRD 已写入 prd/<项目名>/prd.md');
    expect(byName.get('yida-app').done_when).toContain('design.md 已写入 prd/<项目名>/design.md');
  });

  test('form page development loads yida-form-detail and defaults formDetail CSS injection', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const app = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const appStep4 = readSkill('yida-skills/skills/yida-app/workflow/step-4-forms-processes.md');
    const createForm = readSkill('yida-skills/skills/yida-create-form-page/SKILL.md');
    const formDetail = readSkill('yida-skills/skills/yida-form-detail/SKILL.md');
    const manifest = readSkill('lib/core/command-manifest.js');

    expect(root).toContain('默认完成即停止');
    expect(appStep4).toContain('use_skill("yida-form-detail", "表单视觉引导与详情页样式默认注入")');
    expect(appStep4).toContain('字段结构有 Divider 分组');
    expect(appStep4).toContain('表单全局主题已注入：`globalThemeActionFound: true`');
    expect(appStep4).toContain('formDetail CSS 已注入：`formDetailStyleActionFound: true`');
    expect(createForm).toContain('拿到 formUuid 后必须注入表单全局主题和 formDetail CSS');
    expect(createForm).toContain('视觉引导必须和 `Divider` 分割线语义分组合并执行');
    expect(createForm).toContain('最终确认 `globalThemeActionFound: true` 与 `formDetailStyleActionFound: true`');
    expect(createForm).toContain('新建表单在 Schema JS 中默认带上 `openyida:theme` 和 `openyidaThemeDidMount`');
    expect(formDetail).toContain('### 【表单视觉引导】');
    expect(formDetail).toContain('Divider 策略');
    expect(formDetail).toContain('拿到 `formUuid` 后必须执行幂等注入');
    expect(formDetail).toContain('style#yida-global-theme');
    expect(createForm).toContain('提交页必须在自身运行文档内注入该样式');
    expect(createForm).toContain('保证自定义页面、表单、详情页和应用主题色一致');
    expect(formDetail).toContain('表单运行态主题阶段');
    expect(formDetail).toContain('style#yida-form-detail-style');
    expect(formDetail).toContain('openyida:theme');
    expect(formDetail).toContain('openyidaThemeDidMount');
    expect(formDetail).toContain('globalThemeActionFound: true');
    expect(formDetail).toContain('formDetailStyleActionFound: true');
    expect(formDetail).toContain('完整步骤见 [注入流程](references/injection-guide.md)');
    expect(formDetail).toContain('openyida form-detail-style check');
    expect(formDetail).toContain('openyida form-detail-style apply');
    expect(manifest).toContain("default_form_visual_guidance_skill_id: 'yida-form-detail'");
    expect(manifest).toContain('injects formDetail CSS by default after a real formUuid exists');
    expect(manifest).toContain("'form-detail-style.apply'");
  });

  test('Canvas form data pages use yida JS API bridge before endpoint fallback', () => {
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const dataBinding = readSkill('yida-skills/skills/yida-canvas-data-binding/SKILL.md');
    const bridge = readSkill('yida-skills/skills/yida-canvas-custom-page/references/data-bridge-guide.md');
    const generation = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');

    [canvas, dataBinding, bridge, generation].forEach((doc) => {
      expect(doc).toContain('dataBinding.mode');
    });
    [canvas, dataBinding, bridge, generation].forEach((doc) => {
      expect(doc).toContain('window.__OPENYIDA_YIDA_API__');
    });
    [dataBinding, bridge].forEach((doc) => {
      expect(doc).toContain('this.utils.yida.searchFormDatas');
      expect(doc).toContain('/dingtalk/web/<appType>/v1/form/searchFormDatas.json');
      expect(doc).toContain('searchFieldJson');
      expect(doc).toContain('_csrf_token');
    });
    expect(canvas).toContain('window.__OPENYIDA_YIDA_API__.searchFormDatas(params)');
    expect(canvas).toContain('不能使用 `/query/form/searchFormDatas.json`');
    expect(dataBinding).toContain('`/query/form/searchFormDatas.json` 不是可用表单数据端点');
    expect(bridge).toContain('`/query/form/searchFormDatas.json` 不是可用表单数据端点');
    expect(generation).toContain('用前端 seedRows 冒充真实表单数据');
  });

  test('yida-custom-page unified full-app build uses compact native defaults and reads references on demand', () => {
    const skill = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');

    expect(skill).toContain('完整应用默认不得生成依赖 dataSourceMap 的代码');
    expect(skill).toContain('不得在完整应用默认页面里写 `this.dataSourceMap.<name>.load()`');
    expect(skill).toContain('默认产出 `prd/<项目名>/prd.md` 与 `prd/<项目名>/design.md`');
    expect(skill).toContain('## Available Files');
    expect(skill).toContain('check-page 报错、复杂交互、状态管理问题');
    expect(skill).not.toContain('编写页面代码前**必须完整阅读**');
    expect(skill).not.toContain('编写任何页面代码前必读');
  });

  test('yida-get-schema documents compact field-map first', () => {
    const skill = readSkill('yida-skills/skills/yida-get-schema/SKILL.md');

    expect(skill).toContain('openyida get-schema <appType> <formUuid> [--summary-json|--field-map-json]');
    expect(skill).toContain('页面开发默认使用 compact 输出');
    expect(skill).toContain('不内联完整 Schema');
    expect(skill).toContain('先传 `appType`，再传 `formUuid`');
  });

  test('form permission keeps package UUID scoped to the queried form', () => {
    const skill = readSkill('yida-skills/skills/yida-form-permission/SKILL.md');

    expect(skill).toContain('`packageUuid` 只属于本次查询的 `formUuid`');
    expect(skill).toContain('禁止跨表单复用');
  });

  test('builder stopgap docs codify yida-app resource resolution commands and cwd-sensitive paths', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const app = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const appStep1 = readSkill('yida-skills/skills/yida-app/workflow/step-1-resource-context.md');
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const native = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');
    const publish = readSkill('yida-skills/skills/yida-publish-page/SKILL.md');

    expect(root).toContain('读取与复核用合适工具');

    expect(appStep1).toContain('已有显式 `appType`、应用 URL 或已绑定上下文中的 `appType` 且能唯一解析时，直接复用');
    expect(appStep1).toContain('不要调用 `app-list` 做存在性确认');
    expect(appStep1).toContain('才运行 `openyida app-list [--size N]`');
    expect(appStep1).toContain('openyida list-forms <appType> [--keyword <text>]');
    expect(appStep1).toContain('openyida get-schema <appType> <formUuid|--all> ...');
    expect(appStep1).toContain('禁止编造 `list-apps` / `get-app`');
    expect(appStep1).toContain('读取 PRD、字段 JSON、页面源码或 schema 文件时优先用当前工具的 Read / Glob / Grep');

    [appStep1, canvas, native, publish].forEach((skill) => {
      expect(skill).toContain('从仓库根执行');
      expect(skill).toContain('<workspace>/project');
      expect(skill).toContain('`pages/src/...`');
    });
  });

  test('yida-publish-page treats missing preserved data sources as incomplete when code uses dataSourceMap', () => {
    const skill = readSkill('yida-skills/skills/yida-publish-page/SKILL.md');

    expect(skill).toContain('源码包含 `this.dataSourceMap.`');
    expect(skill).toContain('`No custom page data sources to preserve`');
    expect(skill).toContain('本次发布不能视为完成');
  });

  test('page source edits require successful publish evidence before claiming remote updates', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const app = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const appStep7 = readSkill('yida-skills/skills/yida-app/workflow/step-7-page-code.md');
    const appStep8 = readSkill('yida-skills/skills/yida-app/workflow/step-8-publish-navigation.md');
    const appStep9 = readSkill('yida-skills/skills/yida-app/workflow/step-9-output-finish.md');
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const native = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');
    const publish = readSkill('yida-skills/skills/yida-publish-page/SKILL.md');
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const byName = new Map(index.skills.map((skill) => [skill.name, skill]));

    expect(root).toContain('页面源码修改必须发布闭环');
    expect(root).toContain('project/pages/src/*.{canvas.jsx,canvas.tsx,oyd.jsx,jsx,tsx}');
    expect(root).toContain('openyida publish <source> <appType> <displayPageFormUuid>');
    expect(root).toContain('源码已修改，尚未发布');
    expect(root).toContain('禁止说“页面已更新 / 已重新发布 / 已上线”');

    expect(app).toContain('[Step 7：编写或更新页面]');
    expect(appStep7).toContain('页面源码通过本地校验只表示“可发布”，不表示远端页面已更新');
    expect(appStep8).toContain('--canvas --health-check --auto-nav-order');
    expect(appStep8).toContain('`publishMode=canvas`');
    expect(appStep8).toContain('`healthCheck.readback.hasYidaCodeCanvas=true`');
    expect(appStep9).toContain('没有成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`');
    expect(appStep9).toContain('只能交付“源码已修改，尚未发布”的说明');
    expect(appStep9).toContain('显示至少一条已 query 确认的记录');

    expect(canvas).toContain('final 前需要成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`');
    expect(canvas).toContain('该历史源码只由 `yida-custom-page` 自身闭环维护');
    expect(canvas).toContain('交给 `yida-canvas-upgrade`');
    expect(canvas).toContain('有 publish 成功证据时表述为“页面已发布”');
    expect(canvas).toContain('只有本地校验证据时表述为“源码已修改，尚未发布”');

    expect(native).toContain('`check-page` / `compile` 只证明源码可发布，不等于远端页面已更新');
    expect(native).toContain('## 平台 JSX 组件编译与检查');
    expect(native).toContain('`.oyd.jsx` / `.openyida.jsx` 或显式 `--compat`');
    expect(native).toContain('final 只能说明“源码已修改，尚未发布”');

    expect(publish).toContain('final 证据只认真实执行成功的 `openyida publish <source> <appType> <displayPageFormUuid>`');
    expect(publish).toContain('新建或默认自定义页面源码先由 `yida-canvas-custom-page` 产出');
    expect(publish).toContain('发布前确认源码已由对应页面开发技能完成并通过相应本地检查');
    expect(publish).toContain('resolve existing page or create missing page → yida-canvas-custom-page → [本技能] yida-publish-page');
    expect(publish).toContain('| `yida-canvas-custom-page` | 前置技能，编写 `.canvas.jsx` / `.canvas.tsx` 页面源码 |');
    expect(publish).toContain('本地文件编辑、diff、`check-page`、`compile`、`compileCanvasLocal` 或口头声明都不能证明远端页面已更新');
    expect(publish).toContain('发布了其他文件或其他目标页面，不满足本轮源码修改的 doneWhen');
    expect(publish).toContain('`publishMode=canvas`');
    expect(publish).toContain('`healthCheck.readback.hasYidaCodeCanvas=true`');
    expect(publish).not.toContain('## OpenYida 兼容编译');
    expect(publish).not.toContain('兼容构建会自动补齐 `renderJsx`');

    expect(byName.get('yida-app').done_when).toContain('没有 publish 证据只能声明源码已修改，尚未发布');
    expect(byName.get('yida-app').done_when).toContain('返回当前页面 URL');
    expect(byName.get('yida-app').done_when).toContain('返回 {base_url}/{appType}/workbench');
    expect(byName.get('yida-app').done_when).toContain('final 先用 2-3 句业务语言总结创建/复用了哪些表单、页面和流程');
    expect(byName.get('yida-app').done_when).toContain('再给主入口链接');
    expect(byName.get('yida-app').done_when).toContain('不默认输出表格、长列表或资源 ID');
    expect(byName.get('yida-canvas-custom-page').done_when).toContain('openyida publish <source> <appType> <displayPageFormUuid>');
    expect(byName.get('yida-custom-page').done_when).toContain('openyida publish <source> <appType> <displayPageFormUuid>');
    expect(byName.get('yida-publish-page').command_ids).toEqual(['publish']);
    expect(byName.get('yida-publish-page').done_when).toContain('本地文件编辑、diff、check-page 或 compile 不能证明远端页面已更新');
  });

  test('Canvas skills require zero unbound identifiers and keep canonical helper names', () => {
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const navGuide = readSkill('yida-skills/skills/yida-canvas-custom-page/references/navigation-and-entry-guide.md');
    const dataBridge = readSkill('yida-skills/skills/yida-canvas-custom-page/references/data-bridge-guide.md');
    const appStep7 = readSkill('yida-skills/skills/yida-app/workflow/step-7-page-code.md');
    const commonIssues = readSkill('yida-skills/skills/yida-app/references/common-issues.md');

    expect(canvas).toContain('源码保持零未绑定标识符');
    expect(canvas).toContain('OPENYIDA_CANVAS_UNBOUND_IDENTIFIER');
    expect(canvas).toContain('`window.<name>` 或 `parentWindow.<name>`');
    expect(canvas).toContain('一次修复 `details.issues` 中的全部名称');
    expect(canvas).toContain('const dingTalk = window.dd;');
    expect(canvas).toContain("typeof dingTalk?.biz?.navigation?.setTitle === 'function'");
    expect(canvas).toContain('未绑定标识符守卫边界');
    expect(canvas).toContain('不代表能发现全部拼写错误');
    expect(canvas).toContain('`name`、`status`、`length`、`event`、`origin`、`top`');
    expect(navGuide.match(/function getYidaFormInstId\(/g)).toHaveLength(1);
    expect(navGuide).toContain('const selectedFormInstId = getYidaFormInstId(selectedCustomer);');
    expect(navGuide).toContain('不能只生成 `getInstId(...)` 等新调用名');
    expect(dataBridge).toContain('轮询骨架固定使用 `hasLoadedRef`');
    expect(dataBridge).toContain('不能只把部分引用改成 `loadedRef`');
    expect(appStep7).toContain('Canvas 本地校验不存在未绑定标识符');
    expect(appStep7).toContain('`window.<name>` / `parentWindow.<name>`');
    expect(commonIssues).toContain('Canvas 编译报 `OPENYIDA_CANVAS_UNBOUND_IDENTIFIER`');
    expect(commonIssues).toContain('或运行时报 `<name> is not defined`');
    expect(commonIssues).toContain('通过 `window.<name>` / `parentWindow.<name>` 获取能力');
  });

  test('integration skill selects create, replacement, and update commands by intent', () => {
    const integration = readSkill('yida-skills/skills/yida-integration/SKILL.md');

    expect(integration).toContain('## 命令选择');
    expect(integration).toContain('| 创建新自动化 | 使用 `integration create`，由 CLI 生成 `processCode` |');
    expect(integration).toContain('`integration create ... --process-code <code> --replace`');
    expect(integration).toContain('CLI 无法读取原有节点定义；本次将整体覆盖，原节点不保留');
    expect(integration).toContain('| 更新已有自动化 | 使用 `integration update` 获取 capability 结果，并按结果报告当前状态 |');
    expect(integration).toContain('不得把 `integration update` 的 fail-closed 结果降级为 `integration create --process-code --replace`');
    expect(integration).toContain('`INTEGRATION_FULL_REPLACEMENT_REQUIRES_REPLACE`');
    expect(integration).toContain('已获得整图替换确认时，补 `--replace` 重试一次');
    expect(integration).toContain('--process-code LPROC-XXX');
    expect(integration).toContain('--replace');
  });

  test('page visual lessons are codified in yida-design, chart, and report skills', () => {
    const design = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const chart = readSkill('yida-skills/skills/yida-chart/SKILL.md');
    const report = readSkill('yida-skills/skills/yida-report/SKILL.md');
    const retrospective = readSkill('yida-skills/references/task-retrospective.md');

    expect(design).toContain('参考 Dribbble');
    expect(design).toContain('参考转成可执行选择');
    expect(design).toContain('应用主题与 token 参考');
    expect(design).toContain('`style#yida-global-theme`');
    expect(design).toContain('主色不固定为 `podBlue` 或 #1677ff');
    expect(design).toContain('创建应用时不显式传 `theme/colour`');
    expect(chart).toContain('已有 ECharts 页面 / 跨应用迁移修复流程');
    expect(chart).toContain('getFormNavigationListByOrder');
    expect(chart).toContain('report-binding.json');
    expect(report).toContain('作为 ECharts 页面数据源的绑定纪律');
    expect(report).toContain('再让 `yida-chart` 或 `yida-canvas-custom-page` 承载展示层高级视觉');
    expect(report).toContain('REPORT_xxx');
    expect(readSkill('yida-skills/references/official-example-schema-patterns.md')).toContain('`yida-data-source-connectors` + `yida-canvas-data-binding`');
    expect(retrospective).toContain('ECharts 页面 / 原生报表绑定经验');
    expect(retrospective).toContain('工作台是操作首页');
  });

  test('yida-design centralizes application theme token presets and keeps application theme profiles explicit', () => {
    const theme = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const app = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const appStep2 = readSkill('yida-skills/skills/yida-app/workflow/step-2-design.md');
    const createApp = readSkill('yida-skills/skills/yida-create-app/SKILL.md');
    const pageUiux = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const step2 = readSkill('yida-skills/skills/yida-design/workflow/step-2-theme-system.md');
    const styleSelection = readSkill('yida-skills/skills/yida-design/references/style-design-selection.md');
    const canvasStyleGuide = readSkill('yida-skills/skills/yida-canvas-custom-page/references/canvas-style-implementation-guide.md');
    const presets = readSkill('yida-skills/skills/yida-design/references/theme/theme-token-presets.md');
    const expectedPresets = {
      podBlue: {
        '--color-brand1-1': 'rgba(73, 164, 255, 1)',
        '--color-brand1-2': 'rgba(224, 240, 255, 1)',
        '--color-brand1-3': 'rgba(0, 127, 255, 0.2)',
        '--color-brand1-6': 'rgba(0, 102, 255, 1)',
        '--color-brand1-9': 'rgba(0, 82, 204, 1)',
        '--color-brand1-10': 'rgba(0, 127, 255, 0.3)',
        '--color-brand-1': 'rgba(0, 127, 255, 0.3)',
        '--color-brand-2': 'rgba(73, 164, 255, 1)',
        '--color-brand-3': 'rgba(0, 102, 255, 1)',
        '--color-brand-4': 'rgba(0, 82, 204, 1)',
        '--color-group': 'rgba(131, 137, 143, 0.16),rgba(0, 200, 255, 1),rgba(122, 95, 255, 1),rgba(0, 61, 153, 1),rgba(255, 107, 53, 1),rgba(102, 204, 102, 1)',
      },
      podGreen: {
        '--color-brand1-1': 'rgba(73, 192, 109, 1)',
        '--color-brand1-2': 'rgba(224, 244, 230, 1)',
        '--color-brand1-3': 'rgba(0, 165, 50, 0.2)',
        '--color-brand1-6': 'rgba(0, 165, 50, 1)',
        '--color-brand1-9': 'rgba(0, 116, 35, 1)',
        '--color-brand1-10': 'rgba(0, 165, 50, 0.3)',
        '--color-brand-1': 'rgba(0, 165, 50, 0.3)',
        '--color-brand-2': 'rgba(73, 192, 109, 1)',
        '--color-brand-3': 'rgba(0, 165, 50, 1)',
        '--color-brand-4': 'rgba(0, 116, 35, 1)',
        '--color-group': 'rgba(0, 165, 50, 1),rgba(76, 217, 100, 1),rgba(0, 200, 140, 1),rgba(0, 95, 31, 1),rgba(255, 94, 91, 1),rgba(255, 159, 58, 1)',
      },
      podOrange: {
        '--color-brand1-1': 'rgba(253, 145, 0, 0.6)',
        '--color-brand1-2': 'rgba(255, 242, 224, 1)',
        '--color-brand1-3': 'rgba(253, 145, 0, 0.2)',
        '--color-brand1-6': 'rgba(253, 145, 0, 1)',
        '--color-brand1-9': 'rgba(177, 102, 0, 1)',
        '--color-brand1-10': 'rgba(177, 102, 0, 0.32)',
        '--color-brand-1': 'rgba(177, 102, 0, 0.32)',
        '--color-brand-2': 'rgba(253, 145, 0, 0.6)',
        '--color-brand-3': 'rgba(253, 145, 0, 1)',
        '--color-brand-4': 'rgba(177, 102, 0, 1)',
        '--color-group': 'rgba(253, 145, 0, 1),rgba(224, 90, 45, 1),rgba(252, 125, 41, 1),rgba(212, 160, 23, 1),rgba(47, 140, 130, 1),rgba(184, 154, 125, 1)',
      },
    };

    expect(presets).toContain('主题选择先根据行业、品牌、业务情绪和视觉目标做创意判断');
    expect(presets).toContain('不能套用“科技=蓝、宠物=橙、法律=蓝”这类行业刻板配色');
    expect(presets).toContain('本文件是 OpenYida 应用主题的统一参考');
    expect(presets).toContain('## 应用主题 key 清单');
    expect(presets).toContain('## 应用主题 token profile');
    expect(presets).toContain('`blue`、`green`、`orange` 也是应用主题 token profile，保留原名，不自动改写成其他主题名');
    expect(presets).toContain('若设计结果是任意自定义品牌色、渐变色盘或不在清单里的主题名，创建应用时不要显式传 `theme/colour`');
    expect(presets).toContain('其他 skill 需要应用主题 key、平台候选主题或 token 变量时，引用本文');
    expect(appStep2).toContain('只有 PRD 摘要和 `design.md` 都写明 `shouldPassCreateAppTheme=true`，且 `themePresetKey` 命中平台 key');
    expect(createApp).toContain('只在 PRD 的 `shouldPassCreateAppTheme=true` 且 `themePresetKey` 命中平台预置 key 时传');
    expect(createApp).toContain('禁止把行业词直接映射成固定颜色');
    expect(createApp).toContain('完整应用主题 key、颜色倾向和 token 变量统一维护在 `yida-design/references/theme/theme-token-presets.md`');
    expect(createApp).not.toContain('| `deepBlue` | 深蓝 |');
    expect(pageUiux).not.toContain('| `deepBlue` | 深蓝 |');
    expect(pageUiux).toContain('先根据行业、品牌、业务情绪和视觉目标做创意色彩判断');
    expect(theme).toContain('应用主题先统领页面主色');
    expect(theme).toContain('页面主按钮、链接、选中态、重点标签和图表主序列都跟随应用主题 `--color-brand1-*`');
    expect(step2).toContain('若截图或预览中出现左侧导航选中态与页面主操作颜色不一致');
    expect(styleSelection).toContain('应用主题主导，生成色彩作为辅助色');
    expect(canvasStyleGuide).toContain('本文件是 `YidaCodeCanvas` 组件的样式实现适配指南，不是新的设计系统');
    expect(canvasStyleGuide).toContain('设计事实唯一来自 `yida-design` 输出的 `prd.md` 与 `design.md`');
    expect(canvasStyleGuide).toContain('## 应用主题与页面风格冲突处理');
    expect(canvasStyleGuide).toContain('默认值是 `跟随应用主题`，不是 `跟随生成色盘色相`');
    expect(canvasStyleGuide).toContain('helper 必须带兜底逻辑');
    expect(canvasStyleGuide).toContain('读不到、空串或读取异常时返回传入的 `defaultColor`');
    expect(canvasStyleGuide).toContain('`defaultColor` 必须来自当前项目 `design.md` 的 tokens 或当前应用主题 token profile');
    expect(step2).toContain('`--color-brand1-*` 是页面和 PC 端主要消费的品牌色阶');
    expect(step2).toContain('`--color-brand-*` 是移动端和部分原生表单/壳层桥接仍会消费的品牌色阶');
    expect(step2).toContain('| `--color-brand1-1` | 明亮品牌浅色或浅 hover 色 |');
    expect(step2).toContain('| `--color-brand-4` | 移动端深品牌档 4 |');
    expect(presets).toContain('## 平台 token 语义');
    expect(presets).toContain('`--color-brand-*` 是移动端和部分原生表单/壳层桥接仍会消费的品牌色阶');
    expect(presets).toContain('## blue');
    expect(presets).toContain('## podBlue');
    expect(presets).toContain('| `podBule` | 平台蓝色 key | 按需 |');
    expect(presets).toContain('| `teal` | 青色 | 按需 |');
    expect(presets).toContain('| `black` | 黑色 | 按需 |');
    expect(presets).toContain('## teal');
    expect(presets).toContain('## greyBlue');
    expect(presets).toContain('## royalBlue');
    expect(presets).toContain('## black');
    expect(presets).toContain('普通业务页默认使用浅底主题，`black` 不作为默认主题。');
    expect(presets).not.toContain('rgba(0, 102, 255, 1))');
    expect(presets).not.toContain('| `blue` | `podBlue` |');
    expect([
      pageUiux,
      app,
      createApp,
      pageUiux,
      presets,
    ].join('\n')).not.toMatch(/pod 主题|pod主题|平台 pod|推荐 pod|pod theme|pod 系主题|应用主题别名|legacy application theme alias|legacy-basic/);

    Object.entries(expectedPresets).forEach(([preset, tokens]) => {
      expect(presets).toContain(`## ${preset}`);
      Object.entries(tokens).forEach(([token, value]) => {
        expect(presets).toContain(`"${token}": "${value}"`);
      });
    });
  });

  test('data screens do not default to dark or black themes', () => {
    const pageUiux = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const step4 = readSkill('yida-skills/skills/yida-design/workflow/step-2-theme-system.md');
    const outputBlock = readSkill('yida-skills/skills/yida-design/workflow/output-prd.md');
    const visualEngine = readSkill('yida-skills/skills/yida-design/references/visual-decision-engine.md');
    const dashboardTheme = readSkill('yida-skills/skills/yida-dashboard/references/theme-presets.md');
    const chartSpec = readSkill('yida-skills/skills/yida-chart/references/echarts-design-spec.md');

    expect(step4).toContain('PRD 只写应用主题色和风格摘要；`design.md` 写完整 `themeProfile`');
    expect(pageUiux).toContain('工作台、门户、列表、详情、普通看板和数据大屏默认都是浅底 / light 模式');
    expect(step4).toContain('视觉方向要从“高级 / 简洁 / 商务”继续落细');
    expect(step4).toContain('主色：先按行业、品牌、业务情绪和视觉目标做创意判断，可选择平台预置主题，也可设计自定义品牌色盘');
    expect(step4).toContain('明暗模式：默认 `light`；`design.md` 的 `themeProfile.navTheme` 保持 `light`');
    expect(step4).toContain('`design.md` 的 `themeProfile.colorMode` 是宜搭配色模式');
    expect(outputBlock).toContain('| 明暗模式 | <light 默认；dark 只在明确暗色/夜间/高对比/黑金时使用；具体色阶见 design.md> |');
    expect(outputBlock).toContain('| 应用主题色 | <平台预置 key 或自定义色盘名称；必须与 design.md 的 Theme Profile 一致> |');
    expect(outputBlock).toContain('| 主题作用域 | <app / page；只写摘要，具体 themeProfile、token、注入策略见 design.md> |');
    expect(outputBlock).not.toContain('- 主题策略：<默认应用主题、themeProfile、themeScope、是否跟随运行态应用主题>');
    expect(visualEngine).toContain('默认 light，不默认暗黑');
    expect(pageUiux).toContain('工作台、门户、列表、详情、普通看板和数据大屏默认都是浅底 / light 模式');
    expect(pageUiux).toContain('只有用户明确说暗色/深色/夜间/高对比时才用深色沉浸');
    expect(dashboardTheme).toContain('白底商务风（DEFAULT）');
    expect(dashboardTheme).toContain('用户只说“做个看板 / 驾驶舱 / 数据大屏”，不说暗色或夜间，默认用 **主题 3（白底商务）**');
    expect(dashboardTheme).not.toContain('深色紫蓝科技风（DEFAULT）');
    expect(chartSpec).toContain('大屏不等于暗色');
  });

  test('custom pages do not build page-level navigation by default', () => {
    const pageUiux = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const navStep = readSkill('yida-skills/skills/yida-design/workflow/step-3-information-architecture.md');
    const pageGeneration = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const navPatterns = readSkill('yida-skills/skills/yida-design/references/app/navigation-patterns.md');
    const navGuide = readSkill('yida-skills/skills/yida-canvas-custom-page/references/navigation-and-entry-guide.md');
    const createPage = readSkill('yida-skills/skills/yida-create-page/SKILL.md');
    const navShell = readSkill('yida-skills/skills/yida-nav-shell/SKILL.md');

    expect(pageUiux).toContain('默认保留平台应用导航');
    expect(pageUiux).toContain('普通自定义页、页面内 tab、分段、筛选和快捷入口都不触发 `yida-nav-shell`');
    expect(pageUiux).toContain("才写 `appBlueprint.hideAppNav: 'y'` 并交给 `yida-nav-shell`");
    expect(pageUiux).toContain('同应用页面优先放入平台导航或导航分组');
    expect(navStep).toContain('默认保留平台应用导航。');
    expect(navStep).toContain('页面内 tab、分段、筛选、卡片切换只是当前页内容结构。');
    expect(navStep).toContain('先分清两件事');
    expect(navStep).toContain('自绘应用级顶部/侧边/导航壳，或明确隐藏应用导航');
    expect(navStep).toContain("写 `appBlueprint.hideAppNav: 'y'`，实现阶段用 `yida-nav-shell`");
    expect(navStep).toContain('只说「工作台 / 门户 / 看板 / 大屏 / 首页」不是隐藏导航信号。');
    expect(pageGeneration).toContain('### 导航生成规则');
    expect(pageGeneration).toContain('| 普通自定义页、工作台、门户、看板、首页 | 不写 `hideAppNav` | 保留平台应用导航 |');
    expect(pageGeneration).toContain("| 自定义页顶部导航、侧边导航、导航壳、自绘应用级导航 | 写 `appBlueprint.hideAppNav: 'y'` | 执行 `openyida update-app <appType> --hide-app-nav` |");
    expect(pageGeneration).toContain('| 页面隐藏导航、无导航全屏、`isRenderNav=false` | 写 `appBlueprint.renderNav: false` | 执行 `openyida update-form-config <appType> <formUuid> false "<页面标题>"` |');
    expect(pageGeneration).toContain('openyida update-app <appType> --hide-app-nav');
    expect(navPatterns).toContain('默认不要在自定义页里自建同级导航');
    expect(navPatterns).toContain('自绘应用级导航前必须开启 `hideAppNav`');
    expect(navPatterns).toContain('不要用 `isRenderNav=false` 表达应用导航隐藏');
    expect(navShell).toContain('openyida update-app <appType> --hide-app-nav');
    expect(navShell).toContain('不要用 `isRenderNav=false` 代替 `hideAppNav`');
    expect(navShell).toContain('跨自定义页用 `/{appType}/custom/{formUuid}`；应用导航隐藏靠 `hideAppNav`');
    expect(createPage).toContain('默认生成页面导航可见');
    expect(createPage).toContain('`--mode dashboard` | 否 | 看板/驾驶舱页面推荐使用；只表达页面模式，不会自动隐藏导航');
    expect(createPage).toContain('这不等同于应用导航隐藏');
    expect(createPage).toContain('改由 `yida-canvas-custom-page` 编写页面源码，再由 `yida-publish-page` 发布');
    expect(createPage).toContain('本技能不使用 `yida-custom-page` 处理新建页面');
    expect(navStep).toContain('同应用跨页面入口优先进入平台导航或导航分组。');
    expect(pageGeneration).toContain('### 快捷入口生成规则');
    expect(navGuide).toContain('同应用内页面优先在平台应用导航内切换');
    expect(navGuide).toContain('| “隐藏页面导航 / 全屏 / 无导航 / isRenderNav=false” | 页面级导航隐藏 | 走 `yida-page-config`，不自动隐藏应用导航 |');
  });

  test('workbench pages avoid low-density giant card templates', () => {
    const pageUiux = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const step4 = readSkill('yida-skills/skills/yida-design/workflow/step-4-wireframe-interaction.md');
    const step5 = readSkill('yida-skills/skills/yida-design/workflow/step-5-visual-states.md');
    const step3 = readSkill('yida-skills/skills/yida-design/workflow/step-3-information-architecture.md');
    const outputPrd = readSkill('yida-skills/skills/yida-design/workflow/output-prd.md');
    const pageGeneration = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const canvasStyleGuide = readSkill('yida-skills/skills/yida-canvas-custom-page/references/canvas-style-implementation-guide.md');
    const qualityGates = readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md');

    expect(pageUiux).toContain('工作台禁低密大卡片套路');
    expect(pageUiux).toContain('标题 + 4 个等宽大 KPI 白卡 + 图标快捷卡 + 大空态白卡');
    expect(pageUiux).toContain('页面丰富度建议');
    expect(pageUiux).toContain('推荐规划 8-10 个有业务目的的区块以上');
    expect(pageUiux).toContain('KPI 卡片: 学生总数, 课程总数, 出勤率, 平均分');
    expect(pageUiux).toContain('只能算 1 个状态摘要区块');
    expect(pageUiux).toContain('只能算 1 个动作区块');
    expect(qualityGates).toContain('## 1. 区块丰富度建议');
    expect(qualityGates).toContain('## 2. 源码槽位门禁');
    expect(qualityGates).toContain('## 3. 低密大卡片门禁');
    expect(step3).toContain('推荐显式列出 8-10 个 `contentBlocks` 以上');
    expect(step3).toContain('KPI 组和快捷入口组各只算 1 个区块');
    expect(step4).toContain('读取 [页面质量门禁](../references/page-quality-gates.md)');
    expect(step4).toContain('pageSpecHandoff 草稿');
    expect(step4).toContain('禁止用 4 个等宽大 KPI 卡和大空态白卡撑首屏');
    expect(step4).toContain('推荐拆成 8-10 个有业务目的的区块以上');
    expect(step4).toContain('内容区块：<推荐 8-10 个区块以上 + 目的');
    expect(step4).toContain('KPI 组只能算 1 个，快捷入口组只能算 1 个，列表组只能算 1 个');
    expect(step4).toContain('视觉上只有几个聚合区块');
    expect(step5).toContain('4 个等宽大 KPI 卡 + 图标快捷卡 + 大空态白卡');
    expect(step5).toContain('`contentBlocks` 推荐 8-10 个区块以上');
    expect(step5).toContain('KPI 子项、快捷入口子项和列表行不能分别计数');
    expect(outputPrd).toContain('推荐逐条列出 8-10 个 `contentBlocks` 以上');
    expect(outputPrd).toContain('KPI 组、快捷入口组、列表组各只算 1 个区块');
    expect(pageGeneration).toContain('替代“4 个等宽大 KPI 白卡 + 图标快捷卡 + 大空态白卡”');
    expect(pageGeneration).toContain('工作台的状态摘要必须是 64-88px 圆润紧凑状态条');
    expect(pageGeneration).toContain('`contentBlocks`');
    expect(pageGeneration).toContain('推荐落地 8-10 个有业务目的的区块以上');
    expect(pageGeneration).toContain('KPI 子项、快捷入口子项和列表行不计入区块数量');
    expect(pageGeneration).toContain('实现前建议补充 `contentBlocks`');
    expect(canvasStyleGuide).toContain('## 工作台卡片密度红线');
    expect(canvasStyleGuide).toContain('禁止使用“4 个等宽大 KPI 白卡 + 彩色图标盒 + 大数字 0”');
    expect(canvasStyleGuide).toContain('禁止用 160px 以上的大空态白卡');
    expect(canvasStyleGuide).toContain('## 默认圆润高密与呼吸感落地');
    expect(canvasStyleGuide).toContain('卡片 `border-radius` 范围 `0px-32px`');
    expect(canvasStyleGuide).toContain('页面布局必须有呼吸感');
    expect(canvasStyleGuide).toContain('卡片和卡片的 gap 默认 `12px-18px` 且必须小于 `20px`');
    expect(canvasStyleGuide).toContain('卡片 padding 默认 `22px-28px` 且必须大于 `20px`');
    expect(canvasStyleGuide).toContain('页面整体推荐包含 8-10 个有业务目的的区块以上');
    expect(canvasStyleGuide).toContain('KPI 子项、快捷入口子项和列表行不能分别计数');
  });

  test('single page design checks current app theme before page-level decisions', () => {
    const design = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const pageDesign = readSkill('yida-skills/skills/yida-design/sub_skill/page-design/SKILL.md');
    const step1 = readSkill('yida-skills/skills/yida-design/workflow/step-1-positioning.md');
    const step3 = readSkill('yida-skills/skills/yida-design/workflow/step-3-information-architecture.md');
    const output = readSkill('yida-skills/skills/yida-design/workflow/output-prd.md');
    const blueprint = readSkill('yida-skills/skills/yida-design/references/app/blueprint.md');

    expect(design).toContain('[page-design](sub_skill/page-design/SKILL.md)');
    expect(design).toContain('先确认当前应用主题');
    expect(design).toContain('应用资源蓝图先行');
    expect(step1).toContain('主页面 / 首页');
    expect(step1).toContain('普通表单');
    expect(step1).toContain('流程表单');
    expect(step3).toContain('## 列资源清单');
    expect(step3).toContain('`display-page`');
    expect(step3).toContain('`normal-form`');
    expect(step3).toContain('`process-form`');
    expect(output).toContain('## 7. 资源蓝图');
    expect(output).toContain('process-form');
    expect(output).toContain('## 8. 资源创建顺序');
    expect(blueprint).toContain('`resourceBlueprint` 对齐 `yida-app` 的页面与表单设计');
    expect(pageDesign).toContain('## Step 1：读取应用主题');
    expect(pageDesign).toContain('单页设计和页面重构先确认当前应用主题');
    expect(pageDesign).toContain('页面重构、局部美化、列表/看板/详情优化默认沿用当前应用');
    expect(pageDesign).toContain('`project/config.json`、`.cache/<项目名>-schema.json`、`.openyida-page.json`');
    expect(pageDesign).toContain('`OPENYIDA_THEME_PROFILE_JSON`、`style#yida-global-theme`');
    expect(pageDesign).toContain('| 1 | 本文件：读取应用主题与功能契约 | 获取 `currentAppTheme`、`currentPageTheme`、`themeEvidence`、`functionContract` |');
    expect(pageDesign).toContain('[选择主题色和 token](../../workflow/step-2-theme-system.md)');
    expect(pageDesign).toContain('`themeEvidence.status=missing`');
    expect(pageDesign).toContain('页面重构/局部美化：默认以当前应用主题为基准');
    expect(pageDesign).toContain('页面美感提升/改 UI：`functionContract` 保持稳定');
    expect(pageDesign).toContain('changeScope');
    expect(pageDesign).toContain('themeDecision');
  });

  test('full app design defaults to form data management pages and requires an explicit custom-list request', () => {
    const design = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const informationArchitecture = readSkill('yida-skills/skills/yida-design/workflow/step-3-information-architecture.md');
    const outputPrd = readSkill('yida-skills/skills/yida-design/workflow/output-prd.md');
    const app = readSkill('yida-skills/skills/yida-app/SKILL.md');

    expect([design, informationArchitecture, outputPrd, app].join('\n')).not.toContain('customPageReason');
    expect(design).toContain('普通表单的数据管理页默认作为列表');
    expect(informationArchitecture).toContain('宜搭表单数据管理页（默认）');
    expect(informationArchitecture).toContain('用户明确要求时才增加自定义列表页');
    expect(outputPrd).toContain('默认不创建自定义列表页');
    expect(app).toContain('默认使用普通表单的数据管理页');
  });

  test('custom page form entries use responsive FormOpenContainer guidance', () => {
    const pageUiux = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const navGuide = readSkill('yida-skills/skills/yida-canvas-custom-page/references/navigation-and-entry-guide.md');
    const pageGeneration = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const themeHelpers = readSkill('yida-skills/skills/yida-canvas-custom-page/references/theme-runtime-helpers.md');
    const customPage = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');
    const codingGuide = readSkill('yida-skills/skills/yida-custom-page/references/coding-guide.md');
    const app = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const step9 = readSkill('yida-skills/skills/yida-app/workflow/step-9-output-finish.md');
    const fieldUrlReference = readSkill('yida-skills/references/field-and-url-reference.md');

    expect(pageUiux).toContain('PC 端默认在侧边抽屉中用 iframe 承载宜搭原生表单');
    expect(pageUiux).toContain('抽屉默认半屏 `50vw`');
    expect(pageUiux).toContain('新增/提交页 URL 默认使用页面级隐藏导航的 `submission/{formUuid}?isRenderNav=false`');
    expect(pageUiux).toContain('formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false');
    expect(canvas).toContain('表单打开入口统一容器');
    expect(canvas).toContain('FormOpenContainer');
    expect(canvas).toContain('按钮事件只能调用 `openForm({ type: "submission" | "detail", ... })`');
    expect(navGuide).toContain('"openMode": "responsive-drawer"');
    expect(navGuide).toContain('"hideNav": true');
    expect(navGuide).toContain('function FormOpenContainer');
    expect(navGuide).toContain('function useYidaFormOpen');
    expect(navGuide).toContain('installYidaGlobalThemeIntoFrame');
    expect(navGuide).toContain('themeTokens');
    expect(navGuide).toContain('onLoad={syncThemeToIframe}');
    expect(navGuide).toContain("const FORM_OPEN_DRAWER_WIDTH = '50vw';");
    expect(navGuide).toContain('width={FORM_OPEN_DRAWER_WIDTH}');
    expect(navGuide).toContain('return `/${appType}/submission/${entry.formUuid}?isRenderNav=false`;');
    expect(navGuide).toContain('formDetail/${entry.formUuid}?formInstId=');
    expect(navGuide).toContain("'navConfig.layout': 1180");
    expect(navGuide).toContain('row.formInstId || row.formInstanceId || row.instanceId || row.id');
    expect(navGuide).toContain('禁止打开 `formInstId=` 为空的详情页');
    expect(navGuide).toContain('&isRenderNav=false');
    expect(navGuide).toContain('FormOpenContainer');
    expect(navGuide).toContain('按钮事件只调用 `openForm(request)`');
    expect(navGuide).not.toContain('runtime.openDrawer');
    expect(pageGeneration).toContain('| 表单新建/提交 | `targetType: "submission"` + `openMode: "responsive-drawer"` | PC 用 `FormOpenContainer` 右侧抽屉 iframe，URL 带 `isRenderNav=false` |');
    expect(pageGeneration).toContain('| 表单查看详情 | `targetType: "detail"` + 目标 `formUuid` + 真实 `formInstId` 来源 | PC 用同一套抽屉宽度，详情 URL 带 `navConfig.layout=1180&isRenderNav=false` |');
    expect(pageGeneration).toContain('表单提交/详情里的 `isRenderNav=false` 只隐藏原生表单页或详情页的页面导航');
    expect(pageGeneration).toContain('PC 用 `FormOpenContainer` 右侧抽屉 iframe');
    expect(pageGeneration).toContain('PC 抽屉 iframe 不会自动继承父页面 CSS 变量');
    expect(themeHelpers).toContain('function installYidaGlobalThemeIntoFrame');
    expect(themeHelpers).toContain('FormOpenContainer');
    expect(themeHelpers).toContain('同源子 iframe 文档');
    expect(customPage).toContain('表单打开入口统一容器');
    expect(customPage).toContain('半屏 `50vw` 抽屉 iframe');
    expect(customPage).toContain('formDetail/{formUuid}?formInstId=...&navConfig.layout=1180&isRenderNav=false');
    expect(codingGuide).toContain('抽屉内 iframe 指向隐藏导航提交页或详情页 URL');
    expect(codingGuide).toContain("drawerWidth: '50vw'");
    expect(codingGuide).toContain("state.formOpenRequest.drawerWidth || '50vw'");
    expect(codingGuide).toContain('FormOpenContainer');
    expect(codingGuide).toContain('formOpenRequest');
    expect(codingGuide).toContain('installYidaGlobalThemeIntoFrame');
    expect(codingGuide).toContain("'/submission/' + formUuid + '?isRenderNav=false'");
    expect(codingGuide).toContain("'/formDetail/' + formUuid");
    expect(codingGuide).toContain('&isRenderNav=false');
    expect(step9).toContain('{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false');
    expect(fieldUrlReference).toContain('{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false');
  });

  test('custom-page-dependent skills avoid duplicated dual-route prose', () => {
    const dashboard = readSkill('yida-skills/skills/yida-dashboard/SKILL.md');
    const ppt = readSkill('yida-skills/skills/yida-ppt-slider/SKILL.md');
    const density = readSkill('yida-skills/skills/yida-density/SKILL.md');
    const navShell = readSkill('yida-skills/skills/yida-nav-shell/SKILL.md');
    const pageUiux = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const canvasStyleGuide = readSkill('yida-skills/skills/yida-canvas-custom-page/references/canvas-style-implementation-guide.md');
    const pageGeneration = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const dependencies = readSkill('yida-skills/skills/yida-canvas-custom-page/references/dependencies-and-cdn.md');
    const authoringExamples = readSkill('yida-skills/skills/yida-canvas-custom-page/references/canvas-authoring-examples.md');
    const customPage = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');
    const codingGuide = readSkill('yida-skills/skills/yida-custom-page/references/coding-guide.md');
    const nativeDesignSystem = readSkill('yida-skills/skills/yida-custom-page/references/design-system.md');
    const assetsGuide = readSkill('yida-skills/skills/yida-custom-page/references/assets-guide.md');
    const dataSources = readSkill('yida-skills/skills/yida-data-source-connectors/SKILL.md');

    expect(dashboard).toContain('常规图表：`yida-rechart`');
    expect(dashboard).toContain('只有用户明确要求 ECharts');
    expect(dashboard).toContain('## 平台 JSX 组件维护注意事项');
    expect(dashboard).not.toContain('## Legacy/native fallback');

    expect(ppt).toContain('`useEffect` 管键盘、hash、触摸、定时器和 cleanup');
    expect(ppt).toContain('## 平台 JSX 组件维护注意事项');
    expect(ppt).not.toContain('新建演示默认走 **YidaCodeCanvas**');

    expect(density).toContain('实现示例使用 React hooks');
    expect(density).toContain('## 平台 JSX 组件维护注意事项');
    expect(density).not.toContain('## Legacy/native fallback');

    expect(navShell).toContain('需要分享、刷新恢复、前进后退时用 URL hash');
    expect(navShell).toContain('需要代码骨架时读 [导航壳形态目录]');
    expect(navShell).not.toContain('新建导航壳默认交 **YidaCodeCanvas**');

    expect(pageUiux).toContain('本技能输出 `prd.md` 和 `design.md`，不写 JSX/TSX');
    expect(pageUiux).toContain('常规业务图表使用 `yida-rechart`');
    expect(pageUiux).toContain('ECharts 例外');
    expect(pageUiux).toContain('页面重构/单页美化默认以当前应用主题色为基准');
    expect(canvas).toContain('UI 和产品设计输入来自 `yida-design` 输出的 `prd/<项目名>/prd.md` 和 `prd/<项目名>/design.md`');
    expect(canvas).toContain('主题实现消费设计结果');
    expect(canvas).toContain('canvas-style-implementation-guide.md');
    expect(canvas).not.toContain('canvas-design-system.md');
    expect(canvas).toContain('references/theme-runtime-helpers.md');
    expect(canvas).toContain('真实业务页、页面重构和局部美化以当前应用主题色为基准');
    expect(canvas).toContain('必须写 `import ... from \'包名\'`');
    expect(canvas).toContain('严禁写未声明裸变量依赖或手写 window 依赖');
    expect(canvas).toContain('`const { Drawer } = antd`');
    expect(canvas).toContain('`const { Search } = lucideReact`');
    expect(dependencies).toContain('不要在源码里写 `const { Drawer } = antd`');
    expect(dependencies).toContain('运行时会出现 `antd is not defined`、`lucideReact is not defined`');
    expect(authoringExamples).toContain('所有包依赖都用标准 `import`');
    expect(authoringExamples).toContain('不要直接从 `window.*` 解构');
    expect(authoringExamples).toContain('JSX 文案只能写成纯文本 `所有级别` 或带引号字符串 `{\'所有级别\'}`');
    expect(canvasStyleGuide).toContain('本文件是 `YidaCodeCanvas` 组件的样式实现适配指南，不是新的设计系统');
    expect(canvasStyleGuide).toContain('设计事实唯一来自 `yida-design` 输出的 `prd.md` 与 `design.md`');
    expect(pageUiux).toContain('yida-canvas-custom-page 样式实现指南');
    expect(pageUiux).not.toContain('Canvas 设计系统');
    expect(canvasStyleGuide).toContain('| `--color-brand1-6` | 主色 |');
    expect(canvasStyleGuide).toContain('| `--color-brand-1` ~ `--color-brand-4` | 移动端品牌色阶 |');
    expect(canvasStyleGuide).toContain('页面重构/局部美化即使是 page scope，也先以当前应用主题为基准');
    expect(canvasStyleGuide).toContain('## 视觉落地顺序');
    expect(canvasStyleGuide).toContain('先读取 `prd/<项目名>/design.md`');
    expect(canvasStyleGuide).toContain('theme-runtime-helpers.md');
    expect(canvasStyleGuide).toContain('## 背景层实现规则');
    expect(canvasStyleGuide).toContain('OPENYIDA_BACKGROUND_LAYER_CSS');
    expect(canvasStyleGuide).toContain('.oy-page-root::before');
    expect(canvasStyleGuide).toContain('clip-path');
    expect(canvasStyleGuide).toContain('prefers-reduced-motion');
    expect(readSkill('yida-skills/skills/yida-canvas-custom-page/references/theme-runtime-helpers.md')).toContain('collectYidaThemeDocuments');
    expect(readSkill('yida-skills/skills/yida-canvas-custom-page/references/theme-runtime-helpers.md')).toContain('cursor.parent');
    expect(customPage).toContain('theme-runtime-helpers.md');
    expect(canvasStyleGuide).toContain('## 源码结构验收');
    expect(canvasStyleGuide).toContain('缺少 `prioritySurface`、`contentPrimitive` 或 `statePrimitive` 任意一项');
    expect(pageGeneration).toContain('| `themeSummary` | 应用主题色、风格关键词、themeScope 摘要 |');
    expect(pageGeneration).toContain('`page-spec.json` 不复制 `visualScaffold`、`surfaceMap`、`componentRecipe`、tokens、完整色盘或组件规则');
    expect(pageGeneration).toContain('| `sourceOfTruth` |');
    expect(pageGeneration).toContain('"conflictPolicy": "prd-design-win"');
    expect(pageGeneration).toContain('使用 `YidaCodeCanvas` 组件实现的自定义页面消费 `yida-design` 输出的 `prd.md` 与 `design.md`');
    expect(pageGeneration).toContain('页面重构 / 局部美化先以当前应用主题为基准');
    expect(pageGeneration).toContain('页面美感提升/页面重构写入 `functionContract`');
    expect(canvas).toContain('完整应用默认在页面实现前通过 `yida-data-management` 写入 1-3 条业务化 demo records');
    expect(canvas).toContain('页面读取这些真实表单记录，不使用前端 seedRows 冒充');
    expect(canvas).toContain('JSX 文案只能写成纯文本 `所有级别` 或带引号字符串 `{\'所有级别\'}`');
    expect(pageGeneration).toContain('默认读取 `yida-app` 通过 `yida-data-management` 写入的 1-3 条 seed records');
    expect(readSkill('yida-skills/skills/yida-canvas-custom-page/references/data-bridge-guide.md')).toContain('完整应用/真实交付页默认先由 `yida-app` 调用 `yida-data-management` 把 1-3 条 demo records 写入真实表单');
    expect(pageGeneration).not.toContain('视觉路由');
    expect(pageGeneration).not.toContain('自然语言推断');
    expect(customPage).toContain('页面重构默认以当前应用主题色为基准');
    expect(customPage).toContain('保持现有数据源、字段映射、按钮动作、筛选逻辑、提交 URL、权限和业务状态');
    expect(customPage).toContain('平台 JSX 组件页面发布后落到平台 `Jsx` 组件');
    expect(customPage).toContain('JSX 文案只能写成纯文本 `所有级别` 或带引号字符串 `{\'所有级别\'}`');
    expect(codingGuide).toContain('中文业务文案只能写成纯文本 `所有级别` 或带引号字符串 `{\'所有级别\'}`');
    expect(customPage).toContain('源码禁止 `import/require`');
    expect(customPage).toContain('图标来源只允许 `lucide-react` 或 `@ant-design/icons`');
    expect(customPage).toContain('平台 JSX 组件只能通过已验证运行时脚本/global 方式加载这两类图标库，不能写 import');
    expect(customPage).toContain('必须去掉非必要图标或使用已验证资源');
    expect(customPage).toContain('不得把 emoji 改成 CSS 图形、字母占位、Unicode 符号、iconfont、装饰性临时 SVG 或其他图标库');
    expect(assetsGuide).toContain('自定义页面图标只使用 `lucide-react` 或 `@ant-design/icons`');
    expect(assetsGuide).toContain('使用 `YidaCodeCanvas` 组件实现的页面使用标准 import');
    expect(assetsGuide).toContain('平台 JSX 组件页面源码不支持 import');
    expect(assetsGuide).toContain('只能通过已验证运行时脚本/global 方式加载这两类图标库');
    expect(assetsGuide).toContain('加载条件不满足时去掉非必要图标或使用已验证资源');
    expect(assetsGuide).toContain('| `lucide-react` | ISC |');
    expect(assetsGuide).toContain('| `@ant-design/icons` | MIT |');
    expect(assetsGuide).not.toContain('| [iconfont（阿里）]');
    expect(assetsGuide).not.toContain('| [Remix Icon]');
    expect(assetsGuide).not.toContain('| [Font Awesome]');
    expect(assetsGuide).not.toContain('SVG 内联');
    expect(canvas).toContain('UI 改造保持功能契约');
    expect(pageUiux).toContain('美感提升保持功能契约');
    expect(codingGuide).toContain('页面美感提升/页面重构只调整颜色、布局、密度、间距、视觉层级、素材和图标表达');
    expect(nativeDesignSystem).toContain('`--color-brand1-*` 是平台层品牌色变量');
    expect(nativeDesignSystem).toContain('主色来自平台层品牌色变量');
    expect(nativeDesignSystem).toContain('## 设计执行清单');
    expect(nativeDesignSystem).toContain('任务路径清晰');
    expect(nativeDesignSystem).toContain('场景模式一致');
    expect(nativeDesignSystem).toContain('响应式完整');
    expect(nativeDesignSystem).toContain('操作反馈完整');
    expect(nativeDesignSystem).toContain('表达克制专业');
    expect(nativeDesignSystem).not.toContain('## 设计反模式（禁止）');
    expect(nativeDesignSystem).not.toContain('### 去 AI 味反模式');
    expect(nativeDesignSystem).not.toContain('跟随 App 主题自动适配');
    expect(nativeDesignSystem).not.toContain('应用全局主题');
    expect(nativeDesignSystem).not.toContain('App 品牌色');

    expect(dataSources).toContain('本技能只服务已存在的历史平台 JSX 组件页面中的设计器 Page dataSource.online 配置');
    expect(dataSources).toContain('`YidaCodeCanvas` 组件没有平台 JSX 组件页面实例 `this`，也没有 `dataSourceMap`');
    expect(dataSources).toContain('use_skill("yida-canvas-data-binding"');
  });
});
