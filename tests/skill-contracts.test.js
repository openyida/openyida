'use strict';

const fs = require('fs');
const path = require('path');
const { buildCommandManifest, flattenCommandManifest } = require('../lib/core/command-manifest');

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

  test('page command examples keep Code Canvas as the default chain', () => {
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

    expect(localeSource).toContain('openyida compile pages/src/home.canvas.jsx');
    expect(localeSource).toContain('openyida check-page pages/src/home.canvas.jsx');
  });

  test('skill guidance only references the official Canvas and native form scaffolds', () => {
    const files = listMarkdownAndJsonFiles(path.join(ROOT, 'yida-skills'))
      .filter(isSampleRoutingGuidanceFile);
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const withoutOfficialScaffolds = source
        .replace(/openyida sample yida-canvas-custom-page canvas[^\n`]*/g, '')
        .replace(/openyida sample yida-create-form-page form[^\n`]*/g, '')
        .replace(/`canvas\.canvas\.jsx`/g, '')
        .replace(/`form\.form\.json`/g, '');
      return /generate-page|openyida sample/i.test(withoutOfficialScaffolds);
    });

    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });

  test('root skill uses compact agent-capabilities for default preflight', () => {
    const skill = readSkill('yida-skills/SKILL.md');

    expect(skill).toContain('openyida agent-capabilities --summary-json');
    expect(skill).toContain('`openyida agent-capabilities --json` 返回完整命令信息');
    expect(skill).toContain('只在排查命令或 manifest 时使用');
    expect(skill).toContain('`workdir` 对应完整输出中的 `active.projectRoot`');
    expect(skill).not.toContain('优先跑一次 `openyida agent-capabilities --json`');
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
    expect(canvas.negative_signals).toEqual(expect.arrayContaining(['强依赖 this.$']));

    const rechart = byName.get('yida-rechart');
    expect(rechart.positive_signals).toEqual(expect.arrayContaining(['高级图表', 'Recharts']));
    expect(rechart.negative_signals).toEqual(expect.arrayContaining(['明确指定 ECharts']));

    const dashboard = byName.get('yida-dashboard');
    expect(dashboard.display_name).toBe('经营看板设计');
    expect(dashboard.description).toContain('指标、布局、筛选、操作和验收方式');
    expect(dashboard.command_ids).toEqual(expect.arrayContaining([
      'create-page',
      'create-form.create',
      'integration.create',
      'create-report',
      'publish',
      'save-share-config',
      'get-page-config',
    ]));

    const canvasTable = byName.get('yida-canvas-table-form');
    expect(canvasTable.positive_signals).toEqual(expect.arrayContaining(['批量录入', 'antd Table']));
    expect(canvasTable.negative_signals).toEqual(expect.arrayContaining(['this.utils.yida.saveFormData']));

    const design = byName.get('yida-design');
    const prd = byName.get('yida-prd');
    const requirementAnalysis = byName.get('yida-requirement-analysis');
    expect(requirementAnalysis.description).toContain('分析完整应用的行业、用户、目标、功能、页面和品牌偏好');
    expect(requirementAnalysis.done_when).toContain('requirement-brief.json');
    expect(requirementAnalysis.done_when).toContain('没有生成 prd.md、design.md');
    expect(requirementAnalysis.command_ids).toEqual([]);
    expect(prd.description).toContain('生成 prd/<项目名>/prd.md');
    expect(prd.description).toContain('prd/<项目名>/prd.md');
    expect(prd.done_when).toContain('prd/<项目名>/prd.md');
    expect(prd.done_when).toContain('没有写 design.md');
    expect(prd.command_ids).toEqual([]);
    expect(design.description).toContain('生成 prd/<项目名>/design.md');
    expect(design.description).toContain('prd/<项目名>/design.md');
    expect(design.done_when).toContain('prd/<项目名>/design.md');
    expect(design.command_ids).toEqual(['sample']);
    expect(design.done_when).toContain('没有写 prd.md');
    expect(design.tags).toEqual(expect.arrayContaining(['ui_skill']));
    expect(design.positive_signals).toEqual(expect.arrayContaining(['主页面 UI 设计', 'ui_skill']));

    const designSkill = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const prdSkill = readSkill('yida-skills/skills/yida-prd/SKILL.md');
    expect(prdSkill).toContain('并生成 `prd/<项目名>/prd.md`');
    expect(designSkill).toContain('生成 `prd/<项目名>/design.md` 和精简视觉配置');
    expect(designSkill).toContain('刷新项目级表单与 Canvas 脚手架');
    expect(designSkill).toContain('不写 `prd.md`');
    expect(designSkill).toContain('执行到每一步前，读取对应 workflow 或 reference');

    const formDetail = byName.get('yida-form-detail');
    expect(formDetail.description).toContain('字段分组');
    expect(formDetail.description).toContain('表单详情页主题和样式');
    expect(formDetail.tags).toEqual(expect.arrayContaining(['表单视觉引导', 'Divider']));
  });

  test('specialized Code Canvas skills use window runtime and data bridges', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const rechart = readSkill('yida-skills/skills/yida-rechart/SKILL.md');
    const canvasTable = readSkill('yida-skills/skills/yida-canvas-table-form/SKILL.md');
    const nativeChart = readSkill('yida-skills/skills/yida-chart/SKILL.md');
    const nativeTable = readSkill('yida-skills/skills/yida-table-form/SKILL.md');

    expect(root).toContain('| 新建 Recharts 图表页 | `yida-rechart` |');
    expect(root).toContain('| 批量录入 | 默认 `yida-canvas-table-form`');
    expect(rechart).toContain('禁止前端全量聚合');
    expect(rechart).toContain('`yida-report`');
    expect(rechart).toContain('`yida-canvas-data-binding`');
    expect(canvasTable).toContain('不调用普通页面的 `this.utils.yida.*`');
    expect(canvasTable).toContain('window.__OPENYIDA_YIDA_API__');
    expect(canvasTable).toContain('未验证时保持待接入状态');
    expect(canvasTable).toContain('Promise.all');
    expect(nativeChart).toContain('# 宜搭 ECharts 页面维护');
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

    expect(root).toContain('| 读取 taskUuid 对应的听记 | `yida-tingji` |');
    expect(root).toContain('| 把已有听记或会议内容转成需求稿 | `yida-flash-note-to-prd` |');
    expect(tingji).toContain('本技能不直接生成会议需求稿');
    expect(flash).toContain('用户只提供 `taskUuid` → 先加载 `yida-tingji` 读取听记内容');
    expect(flash).toContain('写入 `prd/<项目名>/prd.md`');
    expect(flash).toContain('`yida-requirement-analysis` 读取会议需求稿并生成共享需求简报');
    expect(flash).not.toContain('## OpenYida PRD 质量门槛');
    expect(flash).not.toContain('| MVP 边界 | 第一版必须做什么');
    expect(byName.get('yida-tingji').description).toContain('按 taskUuid 读取钉钉听记');
    expect(byName.get('yida-flash-note-to-prd').description).toContain('会议需求稿');
    expect(byName.get('yida-flash-note-to-prd').description).toContain('prd/<项目名>/prd.md');
  });

  test('yida-app unified build forbids unbound dataSourceMap by default', () => {
    const skill = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const finalOutput = readSkill('yida-skills/skills/yida-app/workflow/final-output.md');
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const bridge = readSkill('yida-skills/skills/yida-canvas-custom-page/references/data-bridge-guide.md');
    const generation = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');

    expect(skill).toContain('先确认目标资源并生成共享需求简报');
    expect(skill).toContain('prd/<项目名>/prd.md');
    expect(skill).toContain('prd/<项目名>/design.md');
    expect(skill).toContain('| `yida-canvas-custom-page` | 实现完整应用页面 |');
    expect(skill).not.toContain('`yida-custom-page` |');
    expect(skill).toContain('2-3 句业务交付总结');
    expect(finalOutput).toContain('默认不输出资源 ID 表格、长列表、管理态链接');
    expect(canvas).toContain('data-bridge-guide.md');
    expect(canvas).toContain('page-generation-guide.md');
    expect(canvas).not.toContain('页面不能使用 `/query/form/searchFormDatas.json`');
    expect(bridge).toContain('`/query/form/searchFormDatas.json` 不是可用表单数据端点');
    expect(generation).toContain('用前端 seedRows 冒充真实表单数据');
  });

  test('unified full app build applies one verified navigation plan', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const app = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const publish = readSkill('yida-skills/skills/yida-publish-page/SKILL.md');
    const navGroup = readSkill('yida-skills/skills/yida-nav-group/SKILL.md');
    const prd = readSkill('yida-skills/skills/yida-prd/SKILL.md');
    const prdOutput = readSkill('yida-skills/skills/yida-prd/workflow/output-prd.md');
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const manifest = readSkill('lib/core/command-manifest.js');
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const byName = new Map(index.skills.map((skill) => [skill.name, skill]));

    const appStages = readSkill('yida-skills/skills/yida-app/workflow/build-stages.md');
    const appFinalOutput = readSkill('yida-skills/skills/yida-app/workflow/final-output.md');

    expect(root).toContain('加载子技能 `yida-app`，详细流程见 `yida-app`');
    expect(root).toContain('完整应用默认使用 `yida-prd` 生成的 `prd/<项目名>/prd.md` 和 `yida-design` 生成的 `prd/<项目名>/design.md`');
    expect(root).toContain('创建顺序、页面实现和最终输出见 `yida-app`');
    expect(app).toContain('[完整应用阶段](workflow/build-stages.md)');
    expect(appStages).toContain('写入薄 page-spec，记录 `prdRefs`、`designRefs`、真实 `appType/formUuid/fieldId`');
    expect(appStages).toContain('复制项目 Canvas 脚手架，按引用读取 PRD/design.md 的当前页章节');
    expect(appStages).not.toContain('新建自定义页面从 `canvas.canvas.jsx` 扩展，写 `.canvas.jsx` / `.canvas.tsx`');
    expect(canvas).toContain('OpenYida 提供一份完整脚手架');
    expect(canvas).toContain('发布命令会与线上 Schema 精确核对');
    expect(appStages).not.toContain('明确要求 JSX/Jsx 组件链路或实例桥强依赖时选择 `yida-custom-page`');
    expect(appStages).toContain('写入 `.cache/openyida/<项目名>/navigation-plan.json`');
    expect(appStages).toContain('`openyida nav-group order <appType> --plan <file>`');
    expect(appStages).toContain('命令返回 `verification.matched=true`');
    expect(appStages).toContain('缺少导航计划、命令结果或回读证据时停止，不进入最终输出');
    expect(appStages).not.toContain('精细导航分组');
    expect(appFinalOutput).toContain('不得用 warning 代替导航执行');
    expect(appFinalOutput).not.toContain('轻量导航自动排序已执行，或给出明确 warning');
    expect(appStages).toContain('PRD 命中审批/流程时加载');
    expect(publish).toContain('`--auto-nav-order`');
    expect(publish).toContain('完整应用使用 `nav-group order --plan`');
    expect(navGroup).toContain('完整应用只执行一条 `order --plan` 命令');
    expect(navGroup).toContain('openyida nav-group order <appType> --plan .cache/openyida/<项目名>/navigation-plan.json');
    expect(navGroup).toContain('`verification.matched=true`');
    expect(navGroup).toContain('导航分组和排序是必做阶段，不是可选优化');
    expect(navGroup).toContain('openyida nav-group auto-order <appType>');
    expect(prd).toContain('带唯一 `resourceKey` 的资源');
    expect(prdOutput).toContain('导航顺序只引用资源蓝图中的 `resourceKey`');
    expect(prdOutput).toContain('后续才实现的页面保留在资源蓝图和页面交付顺序中，不放入本轮导航执行计划');
    expect(manifest).toContain('default_nav_order_policy');
    expect(manifest).toContain('openyida nav-group order <appType> --plan <file>');
    expect(manifest).toContain('completion requires verification.matched=true');
    expect(manifest).toContain('navigation_contract');
    expect(manifest).toContain('warning_is_completion: false');
    expect(manifest).toContain('product_design_policy');
    expect(manifest).toContain('yida-prd and yida-design start in parallel');
    expect(manifest).toContain('artifact_generation: {');
    expect(manifest).toContain("mode: 'parallel'");
    expect(manifest).toContain("{ skill_id: 'yida-prd', output_path: 'prd/<project>/prd.md' }");
    expect(manifest).toContain("skill_id: 'yida-design'");
    expect(manifest).toContain("'.cache/openyida/<project>/design-runtime.json'");
    expect(manifest).toContain('page_index_contract');
    expect(manifest).toContain("forbidden_fields: ['contentBlocks', 'themeSummary', 'visualImplementation', 'interactionProfile', 'insights']");
    expect(manifest).toContain('final_link_policy');
    expect(manifest).toContain('Return exactly one primary user-facing link');
    expect(manifest).toContain('{base_url}/{appType}/workbench');
    expect(byName.get('yida-app').description).toContain('生成需求和设计文件');
    expect(byName.get('yida-nav-group').description).toContain('分组、移动、排序、隐藏和显示');
  });

  test('skill command ids and documented openyida commands match manifest', () => {
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const commands = flattenCommandManifest();
    const commandIds = new Set(commands.map((command) => command.id));
    const commandNames = new Set(commands.map((command) => command.name));
    const commandRoots = new Set(commands.map((command) => command.path[0]));

    const invalidCommandIds = [];
    for (const skill of index.skills) {
      for (const commandId of skill.command_ids || []) {
        if (!commandIds.has(commandId)) {
          invalidCommandIds.push(`${skill.name}:${commandId}`);
        }
      }
    }
    expect(invalidCommandIds).toEqual([]);

    const files = listMarkdownAndJsonFiles(path.join(ROOT, 'yida-skills'))
      .filter((file) => file.endsWith('.md'));
    const unknownMentions = [];
    const mentionPattern = /openyida[ \t]+([a-z][a-z0-9-]*)(?:[ \t]+([a-z][a-z0-9-]*))?/g;
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = mentionPattern.exec(source)) !== null) {
        const first = match[1];
        const second = match[2];
        const fullName = second ? `${first} ${second}` : first;
        if (!commandRoots.has(first) && !commandNames.has(fullName)) {
          const line = source.slice(0, match.index).split(/\r?\n/).length;
          unknownMentions.push(`${path.relative(ROOT, file)}:${line}:openyida ${fullName}`);
        }
      }
    }
    expect(unknownMentions).toEqual([]);
  });

  test('requirement analysis feeds yida-prd and yida-design in parallel', () => {
    const root = readSkill('yida-skills/SKILL.md');
    const skill = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const createApp = readSkill('yida-skills/skills/yida-create-app/SKILL.md');
    const createPage = readSkill('yida-skills/skills/yida-create-page/SKILL.md');
    const contract = readSkill('yida-skills/skills/yida-app/references/app-build-contract.md');
    const prd = readSkill('yida-skills/skills/yida-prd/SKILL.md');
    const design = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const requirementAnalysis = readSkill('yida-skills/skills/yida-requirement-analysis/SKILL.md');
    const step1 = readSkill('yida-skills/skills/yida-prd/workflow/step-1-read-brief.md');
    const step3 = readSkill('yida-skills/skills/yida-prd/workflow/step-3-information-architecture.md');
    const step5 = readSkill('yida-skills/skills/yida-design/workflow/step-5-visual-states.md');
    const output = readSkill('yida-skills/skills/yida-prd/workflow/output-prd.md');
    const outputDesign = readSkill('yida-skills/skills/yida-design/workflow/output-design.md');
    const pageGeneration = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const styleSelection = readSkill('yida-skills/skills/yida-design/references/style-design-selection.md');
    const scaffoldRecipes = readSkill('yida-skills/skills/yida-design/references/visual-scaffold-recipes.md');
    const styleRegistry = readSkill('yida-skills/skills/yida-design/references/style-designs/registry.md');
    const dataManagement = readSkill('yida-skills/skills/yida-data-management/SKILL.md');
    const appBuildContract = readSkill('yida-skills/skills/yida-app/references/app-build-contract.md');
    const appResolveContext = readSkill('yida-skills/skills/yida-app/workflow/resolve-context.md');
    const appBuildStages = readSkill('yida-skills/skills/yida-app/workflow/build-stages.md');
    const appFinalOutput = readSkill('yida-skills/skills/yida-app/workflow/final-output.md');
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const byName = new Map(index.skills.map((item) => [item.name, item]));
    const workflow = buildCommandManifest().summary.core_workflows.full_app_build;

    expect(requirementAnalysis).toContain('`.cache/openyida/<项目名>/requirement-brief.json`');
    expect(requirementAnalysis).toContain('同时加载 `yida-prd` 和 `yida-design`');
    expect(skill).toContain('`yida-prd` 和 `yida-design` 读取同一份共享需求简报，同时生成 `prd.md` 和 `design.md`');
    expect(appBuildStages).toContain('| 2A. PRD 生成（并行） | `yida-prd` |');
    expect(appBuildStages).toContain('| 2B. design.md 生成（并行） | `yida-design` |');
    expect(appBuildStages).toContain('不等待或读取本轮 PRD');
    expect(workflow).toMatchObject({
      orchestrator_skill_id: 'yida-app',
      requirement_analysis_skill_id: 'yida-requirement-analysis',
      requirement_brief_path: '.cache/openyida/<project>/requirement-brief.json',
      artifact_generation: {
        mode: 'parallel',
        tasks: [
          { skill_id: 'yida-prd', output_path: 'prd/<project>/prd.md' },
          { skill_id: 'yida-design', output_path: 'prd/<project>/design.md' },
        ],
        join_owner_skill_id: 'yida-app',
      },
    });
    expect([
      workflow.orchestrator_skill_id,
      workflow.requirement_analysis_skill_id,
      workflow.artifact_generation.join_owner_skill_id,
      ...workflow.artifact_generation.tasks.map((task) => task.skill_id),
    ].every((skillId) => byName.has(skillId))).toBe(true);
    expect(step1).toContain('读取 `.cache/openyida/<项目名>/requirement-brief.json`');
    expect(prd).not.toContain('先用本技能生成 `prd.md`，再加载 `yida-design`');
    expect(design).not.toContain('已有 `prd.md` 时先读它');
    expect(skill).toContain('`page-spec.json` 只记录 PRD/design.md 章节引用、真实资源 ID、数据绑定和源码路径');
    expect(skill).toContain('页面技能按引用读取原文');
    expect(root).toContain('加载子技能 `yida-app`，详细流程见 `yida-app`');
    expect(createApp).toContain('创建成功后，将真实 `appType` 写入 `.cache/<项目名>-schema.json`');
    expect(createApp).toContain('后续步骤由 `yida-app` 阶段表执行');
    expect(skill).not.toContain('用户说“按默认方案”“不要追问”“直接创建”“尽快搭建”等');
    expect(skill).not.toContain('默认链路：`resolve context → yida-design PRD');
    expect(skill).toContain('读取 [完整应用阶段](workflow/build-stages.md)');
    expect(appBuildStages).toContain('校验 PRD 页面场景、`prdRefs` 与 design.md 的 `designRefs`');
    expect(skill).not.toContain('PRD 中已有 `pageSpecHandoff` 时，优先从 `pageSpecHandoff` 提取');
    expect(skill).not.toContain('页面生成器修复策略');
    expect(pageGeneration).toContain('只加载当前页需要的业务章节');
    expect(pageGeneration).toContain('只加载当前页需要的视觉章节');
    expect(pageGeneration).toContain('修复路径');
    expect(pageGeneration).toContain('先补原文，再继续实现');
    expect(appBuildStages).toContain('| 5A. seed records（并行） | `yida-data-management` |');
    expect(appBuildStages).toContain('| 5B. 实现本轮页面源码（并行） | `yida-canvas-custom-page` |');
    expect(appBuildStages).toContain('本阶段禁止调用 `create-page`');
    expect(appBuildStages).toContain('| 5C. 逐页创建并发布 | `yida-create-page`、`yida-publish-page` |');
    expect(appBuildStages).toContain('上一页未发布成功前不得创建下一页');
    expect(createPage).toContain('下一步或以后才实现的页面只保留在 PRD，不执行 `create-page`');
    expect(createPage).toContain('`delivery.complete=false`');
    expect(workflow.page_creation_policy).toContain('Never batch-create page containers');
    expect(appBuildStages).toContain('默认给本轮新建或页面数据源依赖的核心普通表单写入 1-3 条业务化 seed records');
    expect(appBuildStages).toContain('seed records 和页面源码实现可以同时开始');
    expect(skill).toContain('seed records、表单详情页 formDetail CSS 注入和按 PRD 应用导航计划属于默认完整应用阶段');
    expect(appFinalOutput).toContain('核心普通表单已写入 1-3 条示例记录并 query 抽查');
    expect(appResolveContext).toContain('外部工具注入的当前任务资源上下文，例如 yida-agent 绑定的 app/page/form/process');
    expect(skill).not.toContain('## 模板优先');
    expect(skill).not.toContain('## Sample 与业务页边界');
    expect(skill).not.toContain('模板路由');
    expect(skill).not.toContain('去 sample 化检查');
    expect(prd).toContain('并生成 `prd/<项目名>/prd.md`');
    expect(prd).toContain('不写 `design.md`');
    expect(design).toContain('生成 `prd/<项目名>/design.md` 和精简视觉配置');
    expect(design).toContain('不写 `prd.md`');
    expect(design).not.toContain('应用体验蓝图');
    expect(design).not.toContain('推荐模板');
    expect(output).toContain('## PRD 输出格式');
    expect(output).not.toContain('## design.md 输出格式');
    expect(outputDesign).toContain('## design.md 输出格式');
    expect(outputDesign).toContain('themeProfile:');
    expect(outputDesign).not.toContain('yidaThemeRuntime:');
    expect(outputDesign).not.toContain('globalThemeInjection:');
    expect(outputDesign).toContain('## 18. 页面技能交接');
    expect(outputDesign).toContain('### Project Visual Handoff');
    expect(outputDesign).toContain('themeScope: <app / page>');
    expect(outputDesign).toContain('`design-runtime.json` 从本 `design.md` 的 `tokens` 和 `themeProfile` 派生');
    expect(outputDesign).toContain('完整应用页面按薄 page-spec 的 `designRefs` 读取本文件并使用项目脚手架');
    expect(outputDesign).not.toContain('helperRef: yida-canvas-custom-page/references/theme-runtime-helpers.md');
    expect(outputDesign).not.toContain('collectYidaThemeDocuments');
    const designEntryAndWorkflow = [design, step3, output, outputDesign].join('\n');
    expect(designEntryAndWorkflow).toContain('表单入口只写交互意图');
    expect(designEntryAndWorkflow).toContain('具体 URL 与容器实现由页面技能处理');
    expect(designEntryAndWorkflow).not.toMatch(/submission\/|formDetail\/|formInstId|navConfig\.layout|50vw|FormOpenContainer|installYidaGlobalThemeIntoFrame|workbench\/\{formUuid\}\?iframe=true|isRenderNav/);
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
    expect(step3).toContain('页面区块 / contentBlocks：<工作台、首页、门户、看板、展示页和业务入口页逐条列出至少 10 个区块');
    expect(step3).not.toContain('推荐模板');
    expect(step5).toContain('示例品牌名、默认指标和通用卖点');
    expect(step5).not.toContain('sample 品牌名');
    expect(design).toContain('design.md 是唯一视觉依据');
    expect(design).toContain('visualScaffold');
    expect(design).toContain('写入 `prd/<项目名>/design.md`');
    expect(design).toContain('页面布局要到可交接粒度');
    expect(prd).toContain('每个 display 页面的业务要求完整写在 PRD 页面章节');
    expect(prd).toContain('`pageSpecHandoff` 只写稳定 `pageKey`、`prdRefs`、`designFile` 和 `designRefs`');
    expect(step5).toContain('生成各页面的 `visualScaffold`');
    expect(step5).toContain('[视觉脚手架配方库](../references/visual-scaffold-recipes.md)');
    expect(step5).toContain('[页面质量门禁](../references/page-quality-gates.md)');
    expect(step5).toContain('只读取被选中的一个 `style-designs/*.md`');
    expect(step5).toContain('模板选择、评分、近邻比较和换肤规则只以 `style-design-selection.md` 为准');
    expect(step5).not.toContain('业务任务匹配 30%');
    expect(step5.split('\n').length).toBeLessThan(70);
    expect(scaffoldRecipes).toContain('surfaceMap');
    expect(scaffoldRecipes).toContain('`rootShell`');
    expect(outputDesign).toContain('surfaceMap：<每个区块的容器形态');
    expect(readSkill('yida-skills/skills/yida-design/references/visual-scaffold-recipes.md')).toContain('## 页面结构槽位');
    expect(readSkill('yida-skills/skills/yida-design/references/visual-scaffold-recipes.md')).toContain('`prioritySurface`：首屏最大视觉锚点');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('## 6. 并行产物对齐门禁');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('由 `yida-prd` 生成');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('缺少 `design.md`');
    expect(readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md')).toContain('由 `yida-prd` 补齐');
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
    expect(output).toContain('- pageKey：<当前页面 resourceKey>');
    expect(output).toContain('- prdRefs：<pages.<pageKey> / businessObjects.<resourceKey> / interactions.<pageKey> / acceptance.<pageKey>>');
    expect(outputDesign).toContain('- visualScaffold：<rootShell / prioritySurface / statusPrimitive / actionPrimitive / contentPrimitive / contextPrimitive / statePrimitive / responsiveRule / breathingRule>');
    expect(outputDesign).toContain('- surfaceContrast：<页面背景与卡片背景的层次搭配');
    expect(output).toContain('- designFile：<prd/<项目名>/design.md>');
    expect(output).toContain('- designRefs：<themeProfile / sceneRecipes.<scene> / components.<name> / states.<name>>');
    expect(design).toContain('[视觉脚手架配方库](references/visual-scaffold-recipes.md)');
    expect(design).toContain('[页面质量门禁](references/page-quality-gates.md)');
    expect(pageGeneration).toContain('## 页面场景到实现入口');
    expect(pageGeneration).toContain('page-spec 不保存业务或视觉摘要');
    expect(pageGeneration).toContain('page-spec 不得出现 `contentBlocks`、`themeSummary`、`visualImplementation`');
    expect(pageGeneration).toContain('实现页面背景和卡片时必须读取 `surfaceContrast`');
    expect(pageGeneration).toContain('源码不得输出浅底白卡无边框');
    expect(pageGeneration).toContain('## Source Of Truth');
    expect(pageGeneration).toContain('`prd.md` 和 `design.md` 保存完整要求');
    expect(pageGeneration).toContain('page-spec 只是索引，不是第三份需求或设计文件');
    expect(pageGeneration).toContain('`sourceOfTruth.prdRefs`');
    expect(pageGeneration).toContain('`sourceOfTruth.designRefs`');
    expect(pageGeneration).toContain('## 修复路径');
    expect(pageGeneration).toContain('页面目标、业务对象、指标口径、主操作、表单入口、数据来源');
    expect(pageGeneration).toContain('回写 `prd.md`；章节 key 变化时更新 `prdRefs`');
    expect(pageGeneration).toContain('回写 `design.md`；全局值变化时重新生成 `design-runtime.json` 和项目脚手架');
    expect(pageGeneration).toContain('近白画布必须用渐变、装饰、素材焦点或内容密度形成层次');
    expect(pageGeneration).toContain('`.oy-page-root` 承载基础底色');
    expect(pageGeneration).toContain('主题关系、页面结构、材质、圆角、密度、间距、组件、状态或响应式规则不足或错误');
    expect(pageGeneration).toContain('所有展示型页面都按 `designRefs` 指向的 design.md 章节实现');
    expect(pageGeneration).toContain('当前页引用的 design.md 章节必须写清 `rootShell`');
    expect(pageGeneration).not.toContain('## 首次生成模板路由');
    expect(output).toContain('## 1. 应用基本信息');
    expect(output).toContain('| 应用类型 | <企业管理 / 经营分析 / 流程审批 / 数据采集 / 客户服务 / 库存进销存 / 项目协作 / 资产设备 / 教育培训 / 知识内容 / 监控指挥 / 官网门户 / 活动报名 / 轻量工具> |');
    expect(output).toContain('| 品牌和色彩偏好 | <从 requirement-brief.json 读取；用户未指定时写“由 yida-design 决定”> |');
    expect(requirementAnalysis).toContain('流程审批、数据采集、客户服务、库存进销存');
    expect(requirementAnalysis).toContain('`targetUsers`');
    expect(requirementAnalysis).toContain('`coreFunctions`');
    expect(requirementAnalysis).toContain('`businessObjects`');
    expect(requirementAnalysis).toContain('`pageScenes`');
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
    expect(output).toContain('完整应用默认在表单字段映射完成后，为核心业务普通表单写入 1-3 条业务化示例记录');
    expect(output).toContain('示例数据写入可以和自定义页面源码实现、编译并行');
    expect(output).toContain('| 3 | 初始示例数据 | 页面需要读取真实表单记录，完整应用默认写入 1-3 条核心业务记录；可与页面实现并行 | 写入数量、抽查结果 |');
    expect(dataManagement).toContain('`data create form/process` 每次创建一条实例');
    expect(dataManagement).toContain('抽查至少一条新记录');
    expect(appBuildContract).toContain('## seed records 规则');
    expect(appBuildContract).toContain('完整应用默认写入核心普通表单示例记录');
    expect(output).toContain('## 4. 页面与功能设计');
    expect(output).toContain('## 5. 设计需求与引用');
    expect(output).toContain('| 设计文件 | `prd/<项目名>/design.md` |');
    expect(output).toContain('| 品牌和色彩偏好 | <从共享需求简报读取用户指定品牌色、已有应用主题、偏好色和避用色> |');
    expect(output).toContain('| 视觉目标 | <从共享需求简报读取业务气质、参考案例和素材要求> |');
    expect(output).not.toContain('| 导航视觉 |');
    expect(output).toContain('### <页面名>');
    expect(output).toContain('- 页面类型：<display-page / form-page / process-form / report / detail-entry>');
    expect(output).toContain('- 页面定位：<主入口页面 / 核心业务页 / 详情页 / 报表页 / 配置页；说明为什么需要这个页面>');
    expect(output).toContain('- 页面关系：<从哪里进入、下一步去列表 / 看板 / 表单提交 / 详情 / 报表中的哪一个>');
    expect(output).toContain('- 设计文件：<display-page 填 `prd/<项目名>/design.md`；普通表单 / 流程表单写“跟随应用主题与表单视觉引导”>');
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
    expect(output).toContain('| 分组 | resourceKey 顺序 | 导航呈现 | 放置原则 |');
    expect(output).toContain('表单/流程在自定义页面之前');
    expect(output).toContain('## 11. 验收标准');
    expect(design).toContain('[design.md 生成规则](references/style-design-selection.md)');
    expect(design).toContain('[style-design 内置模板注册表](references/style-designs/registry.md)');
    expect(step5).toContain('读取 [design.md 生成规则](../references/style-design-selection.md)');
    expect(styleSelection).toContain('| designFile | PRD pageSpecHandoff | `prd/<项目名>/design.md` |');
    expect(styleSelection).toContain('references/style-designs/<selected-template>.md');
    expect(styleSelection).toContain('## 输出字段');
    expect(styleSelection).toContain('视觉 DNA、布局、组件样式、主题 token 和状态规则从 `designRefs` 指向的 design.md 章节读取');
    expect(styleSelection).toContain('薄 page-spec 只记录当前页的 `designRefs`');
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
    expect(contract).toContain('完整应用阶段表见 `../workflow/build-stages.md`');
    expect(contract).toContain('`yida-app` 只认四个关系');
    expect(contract).toContain('`prd.md` 由 `yida-prd` 产出，作为业务输入');
    expect(contract).toContain('`design.md` 由 `yida-design` 产出，作为视觉输入');
    expect(contract).toContain('`page-spec.json` 只记录当前页的 `prdRefs`、`designRefs`、真实资源 ID、数据绑定和源码路径');
    expect(contract).toContain('页面技能先读 page-spec，再按引用读取 PRD/design.md 的相关章节');
    expect(contract).toContain('Code Canvas 实现规则归 `yida-canvas-custom-page`');
    expect(contract).not.toContain('应用体验蓝图');
    expect(contract).not.toContain('需求范围');
    expect(contract).not.toContain('## 完整低代码 PRD 模板');
    expect(byName.get('yida-app').description).toContain('生成需求和设计文件');
    expect(byName.get('yida-app').description).toContain('发布本轮页面并返回应用入口');
    expect(byName.get('yida-create-app').description).toContain('只需要新应用壳');
    expect(byName.get('yida-app').done_when).toContain('所有本轮交付页面已发布并回读成功');
  });

  test('native form development uses form json and dedicated builders', () => {
    const app = readSkill('yida-skills/skills/yida-app/SKILL.md');
    const createForm = readSkill('yida-skills/skills/yida-create-form-page/SKILL.md');
    const formDetail = readSkill('yida-skills/skills/yida-form-detail/SKILL.md');
    const manifest = readSkill('lib/core/command-manifest.js');

    expect(createForm).toContain('原生表单使用独立脚手架');
    expect(createForm).toContain('完整应用优先使用 `.cache/openyida/<项目名>/scaffolds/form.form.json`');
    expect(createForm).toContain('只扩展字段、Divider/多列分组、校验、规则和远程数据源');
    expect(createForm).toContain('`lib/app/scaffolds/form/form-schema-builder.js` 与 `lib/app/services/form-runtime.js`');
    expect(createForm).toContain('不要把原生表单写成自定义页面 JSX');
    expect(app).toContain('输入和实现规则见 `yida-create-form-page`');
    expect(formDetail).toContain('Divider 策略');
    expect(formDetail).toContain('formDetail CSS');
    expect(createForm).toContain('视觉引导必须和 `Divider` 分割线语义分组合并执行');
    expect(createForm).toContain('`fields` 第一项必须是 `{ "type": "Divider", "title": "分组名" }`');
    expect(createForm).toContain('不使用独立 `dividers` 数组');
    expect(createForm).toContain('openyida create-form validate-fields <fieldsJsonOrFile> --json');
    expect(createForm).toContain('字段类型写 `type`，选项写 `dataSource`');
    expect(createForm).toContain('回读 revision、字段、生命周期、主题、formDetail 样式和 13 个 Yida API');
    expect(formDetail).toContain('### 【表单视觉引导】');
    expect(formDetail).toContain('Divider 策略');
    expect(formDetail).toContain('拿到 `formUuid` 后默认执行幂等注入');
    expect(formDetail).toContain('style#yida-global-theme');
    expect(formDetail).toContain('提交页和详情页使用同一个 `style#yida-global-theme`');
    expect(formDetail).toContain('表单运行时主题');
    expect(formDetail).toContain('style#yida-form-detail-style');
    expect(formDetail).toContain('openyida:theme');
    expect(formDetail).toContain('openyidaThemeDidMount');
    expect(formDetail).toContain('globalThemeActionFound: true');
    expect(formDetail).toContain('formDetailStyleActionFound: true');
    expect(formDetail).toContain('完整步骤见 [注入流程](references/injection-guide.md)');
    expect(formDetail).toContain('openyida form-detail-style check');
    expect(formDetail).toContain('openyida form-detail-style apply');
    expect(manifest).toContain("default_form_visual_guidance_skill_id: 'yida-form-detail'");
    expect(manifest).toContain('Native forms use the independent .form.json scaffold');
    expect(manifest).toContain('do not use a separate dividers array');
    expect(manifest).toContain('run create-form validate-fields before create');
    expect(manifest).toContain('form-schema-builder.js and form-runtime.js');
    expect(manifest).toContain('scaffold_contracts: buildScaffoldContracts()');
    expect(manifest).not.toContain('a page-instance capability that Canvas lacks');
    expect(manifest).toContain("'form-detail-style.apply'");
  });

  test('skill slimming keeps specialized operational contracts in their owners', () => {
    const createForm = readSkill('yida-skills/skills/yida-create-form-page/SKILL.md');
    const createFormWorkflow = readSkill('yida-skills/skills/yida-create-form-page/references/create-update-workflow.md');
    const processRule = readSkill('yida-skills/skills/yida-process-rule/SKILL.md');
    const processDsl = readSkill('yida-skills/skills/yida-process-rule/references/process-dsl.md');
    const integration = readSkill('yida-skills/skills/yida-integration/SKILL.md');
    const integrationOptions = readSkill('yida-skills/skills/yida-integration/references/cli-options.md');
    const formula = readSkill('yida-skills/skills/yida-formula/SKILL.md');
    const data = readSkill('yida-skills/skills/yida-data-management/SKILL.md');
    const report = readSkill('yida-skills/skills/yida-report/SKILL.md');
    const reportApi = readSkill('yida-skills/skills/yida-report/references/report-api-guide.md');
    const manifest = buildCommandManifest();
    const commands = new Map(manifest.commands.map((command) => [command.id, command]));

    expect(createForm).toContain('references/create-update-workflow.md');
    expect(createFormWorkflow).toContain('list-forms <appType> --keyword');
    expect(createFormWorkflow).toContain('diagnostics[].candidates');
    expect(createFormWorkflow).toContain('--label-align top|left|right');

    expect(processRule).toContain('references/process-dsl.md');
    expect(processDsl).toContain('| `operator` |');
    expect(processDsl).toContain('| `parallel` |');
    expect(processDsl).toContain('`multiApproverType`');
    expect(processDsl).toContain('`routeRules`');

    expect(integration).toContain('integration enable <appType> <formUuid> <processCode>');
    expect(integrationOptions).toContain('--approval-actions <list>');
    expect(integrationOptions).toContain('--initiate-approval-form-uuid <formUuid>');
    expect(integrationOptions).toContain('--connection-id <id>');

    expect(formula).toContain('公式结果类型必须与目标字段兼容');
    expect(data).toContain('data query operation-records');
    expect(data).toContain('data execute task');
    expect(report).toContain('`cid`、`className`、`dataSetKey` 和 `filterKey`');
    expect(reportApi).toContain('getFormNavigationListByOrder');
    expect(reportApi).not.toContain('prdId: "13085982"');

    expect(commands.get('create-form.create').usage).toContain('--label-align top|left|right');
    expect(commands.get('create-process').usage).toContain('--formUuid <formUuid>');
    expect(commands.get('configure-process').usage).toContain('<processDefinitionFile>');
    expect(commands.get('integration.create').usage).toContain('<formUuid> "<flowName>"');
  });

  test('Canvas form data pages use yida JS API bridge before endpoint fallback', () => {
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const dataBinding = readSkill('yida-skills/skills/yida-canvas-data-binding/SKILL.md');
    const bindingRuntime = readSkill('yida-skills/skills/yida-canvas-data-binding/references/form-runtime-guide.md');
    const dataBridge = readSkill('yida-skills/skills/yida-canvas-data-binding/references/data-bridge-guide.md');
    const bridge = readSkill('yida-skills/skills/yida-canvas-custom-page/references/data-bridge-guide.md');
    const generation = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const postinstall = readSkill('scripts/postinstall.js');

    [dataBinding, bridge, generation].forEach((doc) => {
      expect(doc).toContain('dataBinding.mode');
    });
    [dataBinding, bridge, generation].forEach((doc) => {
      expect(doc).toContain('window.__OPENYIDA_YIDA_API__');
    });
    expect(bridge).toContain('window.__OPENYIDA_RUNTIME__');
    expect(bridge).toContain('window.__OPENYIDA_YIDA_API__');
    [bindingRuntime].forEach((doc) => {
      expect(doc).toContain('window.__OPENYIDA_RUNTIME__');
      expect(doc).toContain('saveFormData');
      expect(doc).toContain('getFormComponentDefinationList');
      expect(doc).toContain('startProcessInstance');
      expect(doc).toContain('getProcessInstanceById');
    });
    expect(canvas).toContain('OpenYida 提供一份完整脚手架');
    expect(canvas).toContain('openyida sample yida-canvas-custom-page canvas --output project/pages/src/canvas.canvas.jsx');
    expect(canvas).toContain('完整应用从项目 Canvas 脚手架扩展');
    expect(canvas).toContain('data-bridge-guide.md');
    expect(canvas).not.toContain('window.__OPENYIDA_RUNTIME__.yida.searchFormDatas(params)');
    expect(canvas).not.toContain('不能使用 `/query/form/searchFormDatas.json`');
    [bindingRuntime, bridge].forEach((doc) => {
      expect(doc).toContain('this.utils.yida');
      expect(doc).toContain('/dingtalk/web/<appType>/v1/form/searchFormDatas.json');
      expect(doc).toContain('searchFieldJson');
      expect(doc).toContain('_csrf_token');
    });
    expect(bridge).toContain('window.__OPENYIDA_RUNTIME__.yida.searchFormDatas(params)');
    expect(bridge).toContain('window.__OPENYIDA_YIDA_API__.searchFormDatas(params)');
    expect(dataBinding).toContain('references/form-runtime-guide.md');
    expect(dataBinding).toContain('references/data-bridge-guide.md');
    expect(dataBinding).not.toContain('function getCsrfToken()');
    expect(bindingRuntime).toContain('`/query/form/searchFormDatas.json` 不是可用表单数据端点');
    expect(dataBridge).toContain('function unwrapRows(payload)');
    expect(bridge).toContain('`/query/form/searchFormDatas.json` 不是可用表单数据端点');
    expect(generation).toContain('用前端 seedRows 冒充真实表单数据');
    expect(postinstall).toContain('完整应用的 Code Canvas 页面通过 \\`window.__OPENYIDA_RUNTIME__.yida\\`');
    expect(postinstall).toContain('修改已有非 Code Canvas 的 \\`Jsx\\` / \\`renderJsx\\` 页面时');
    expect(postinstall).not.toContain('Canvas 当前不具备的普通页面实例能力');
  });

  test('Code Canvas generation and compiler both require complete imports and interactions', () => {
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const dependencies = readSkill('yida-skills/skills/yida-canvas-custom-page/references/dependencies-and-cdn.md');
    const generation = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const compiler = readSkill('lib/app/canvas-compile.js');
    const guard = readSkill('lib/app/canvas-source-guard.js');
    const routing = readSkill('lib/app/page-compiler-routing.js');

    expect(canvas).toContain('组件必须有明确的 import 或本地定义');
    expect(canvas).toContain('必须绑定会执行动作的事件');
    expect(dependencies).toContain('Canvas 编译会阻止未声明组件发布');
    expect(generation).toContain('暂未实现的操作使用禁用态或静态文本');
    expect(compiler).toContain('assertCanvasSourceContracts(source, options)');
    expect(guard).toContain('OPENYIDA_CANVAS_UNBOUND_COMPONENT');
    expect(guard).toContain('OPENYIDA_CANVAS_INTERACTION_INCOMPLETE');
    expect(guard).toContain('OPENYIDA_CANVAS_INVALID_ANT_ICON_IMPORT');
    expect(canvas).toContain('React Hooks、自定义 Hooks、`antd` 和 `@ant-design/icons` 都可用');
    expect(canvas).toContain('openyida compile <source> --json');
    expect(canvas).toContain('本地检查结果必须包含 `mode: "canvas"`');
    expect(routing).toContain('OPENYIDA_PAGE_COMPILER_MISMATCH');
    expect(routing).toContain('resolvePageCompilerMode');
  });

  test('yida-custom-page covers ordinary JSX exceptions', () => {
    const skill = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');

    expect(skill).toContain('目标页面已确认使用 `Jsx`、`renderJsx`、`.oyd.jsx` 或 `.jsx`');
    expect(skill).toContain('新建自定义页面 → 使用 `yida-canvas-custom-page`');
    expect(skill).not.toContain('用户明确要求普通 JSX/Jsx');
    expect(skill).not.toContain('Canvas 当前不具备的普通页面实例能力');
    expect(skill).toContain('目标是 `YidaCodeCanvas` → 使用 `yida-canvas-custom-page`');
    expect(skill).toContain('只有本轮已通过 `yida-data-source-connectors` 创建并绑定数据源时');
    expect(skill).toContain('## 参考文件');
    expect(skill).toContain('coding-guide.md');
    expect(skill).not.toContain('export function loadVisitorList()');
    expect(skill).not.toContain('## API 速查');
    expect(skill).not.toContain('编写页面代码前**必须完整阅读**');
    expect(skill).not.toContain('编写任何页面代码前必读');
  });

  test('yida-get-schema documents compact field-map first', () => {
    const skill = readSkill('yida-skills/skills/yida-get-schema/SKILL.md');
    const outputs = readSkill('yida-skills/skills/yida-get-schema/references/output-contracts.md');

    expect(skill).toContain('openyida get-schema <appType> <formUuid> [--summary-json|--field-map-json]');
    expect(skill).toContain('页面开发默认使用 compact 输出');
    expect(skill).toContain('Canvas 发布会再次与线上 Schema 精确核对');
    expect(skill).toContain('不内联完整 Schema');
    expect(skill).toContain('references/output-contracts.md');
    expect(skill).not.toContain('"kind": "yida_schema_field_resolution"');
    expect(outputs).toContain('"kind": "yida_schema_field_resolution"');
  });

  test('large execution skills keep templates and troubleshooting in references', () => {
    const connector = readSkill('yida-skills/skills/yida-connector-safe-actions/SKILL.md');
    const connectorJson = readSkill('yida-skills/skills/yida-connector-safe-actions/references/action-json-guide.md');
    const dataBinding = readSkill('yida-skills/skills/yida-canvas-data-binding/SKILL.md');
    const getSchema = readSkill('yida-skills/skills/yida-get-schema/SKILL.md');
    const publish = readSkill('yida-skills/skills/yida-publish-page/SKILL.md');
    const publishCompile = readSkill('yida-skills/skills/yida-publish-page/references/compile-and-troubleshoot.md');

    [connector, dataBinding, getSchema, publish].forEach((skill) => {
      expect(skill.split('\n').length).toBeLessThan(120);
      expect(skill).toContain('## 参考文件');
    });
    expect(connector).not.toContain('"operationId": "getDeviceData"');
    expect(connectorJson).toContain('"operationId": "getDeviceData"');
    expect(publish).not.toContain('body { background-color: #f2f3f5; }');
    expect(publishCompile).toContain('body { background-color: #f2f3f5; }');
  });

  test('builder stopgap docs codify yida-app resource resolution commands and cwd-sensitive paths', () => {
    const appResolveContext = readSkill('yida-skills/skills/yida-app/workflow/resolve-context.md');
    const contract = readSkill('yida-skills/skills/yida-app/references/app-build-contract.md');
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const native = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');
    const publish = readSkill('yida-skills/skills/yida-publish-page/SKILL.md');

    expect(appResolveContext).toContain('已有显式 `appType`、应用 URL 或已绑定资源中的 `appType` 且能唯一确认时，直接复用该 app');
    expect(appResolveContext).toContain('运行 `openyida app-list [--size N]`');
    expect(appResolveContext).toContain('openyida list-forms <appType> [--keyword <text>]');
    expect(appResolveContext).toContain('openyida get-schema <appType> <formUuid> --field-map-json');
    expect(appResolveContext).toContain('阶段 0 不编造 `list-apps` / `get-app`');

    expect(contract).toContain('从 workspace 根执行命令');
    expect(contract).toContain('从 `project/` 工作目录执行命令');
    expect(contract).toContain('`project/pages/src/<页面名>.canvas.jsx`');
    expect(contract).toContain('`pages/src/<页面名>.canvas.jsx`');

    [canvas, native, publish].forEach((skill) => {
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
    const appFinalOutput = readSkill('yida-skills/skills/yida-app/workflow/final-output.md');
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const native = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');
    const publish = readSkill('yida-skills/skills/yida-publish-page/SKILL.md');
    const index = JSON.parse(readSkill('yida-skills/skills-index.json'));
    const byName = new Map(index.skills.map((skill) => [skill.name, skill]));

    expect(root).toContain('页面源码修改后必须成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`');
    expect(root).toContain('才能说明线上页面已更新');

    expect(app).toContain('本轮修改页面源码后');
    expect(app).toContain('所有“本轮交付=是”的页面都必须在 final 前成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`');
    expect(appFinalOutput).toContain('最终回复只说明本地源码修改和未发布原因');

    expect(canvas).toContain('本轮修改源码后，必须成功执行 `openyida publish <source> <appType> <displayPageFormUuid>`');
    expect(canvas).toContain('才能说明页面已发布');

    expect(native).toContain('只有本地检查而没有发布成功时，最终回复写“源码已修改，尚未发布”');

    expect(publish).toContain('本轮修改 `project/pages/src/*.{canvas.jsx,canvas.tsx,oyd.jsx,jsx,tsx}` 后');
    expect(publish).toContain('本地编辑、diff、`check-page`、`compile` 或 `compileCanvasLocal` 只证明源码通过本地检查');
    expect(publish).toContain('发布其他文件或其他页面，不满足本轮任务的完成条件');

    expect(byName.get('yida-app').done_when).toContain('没有发布证据/阻塞原因');
    expect(byName.get('yida-app').done_when).toContain('final 用 2-3 句业务总结 + 一个主入口链接');
    expect(byName.get('yida-app').done_when).toContain('不输出资源表');
    expect(byName.get('yida-canvas-custom-page').done_when).toContain('openyida publish <source> <appType> <displayPageFormUuid>');
    expect(byName.get('yida-custom-page').done_when).toContain('openyida publish <source> <appType> <displayPageFormUuid>');
    expect(byName.get('yida-publish-page').done_when).toContain('本地文件编辑、diff、check-page 或 compile 不能证明远端页面已更新');
  });

  test('page visual lessons are codified in yida-design, chart, and report skills', () => {
    const design = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const chart = readSkill('yida-skills/skills/yida-chart/SKILL.md');
    const report = readSkill('yida-skills/skills/yida-report/SKILL.md');
    const retrospective = readSkill('yida-skills/references/task-retrospective.md');

    expect(design).toContain('参考 Dribbble');
    expect(design).toContain('参考转成可执行选择');
    expect(design).toContain('应用主题与 token 参考');
    expect(design).toContain('`design-runtime.json`');
    expect(design).toContain('主色不固定为 `podBlue` 或 #1677ff');
    expect(design).toContain('创建应用时不显式传 `theme/colour`');
    expect(chart).toContain('已有 ECharts 页面 / 跨应用迁移修复流程');
    expect(chart).toContain('getFormNavigationListByOrder');
    expect(chart).toContain('report-binding.json');
    expect(report).toContain('为 Recharts 或已有 ECharts 页面提供服务端聚合结果');
    expect(report).toContain('REPORT_xxx');
    expect(retrospective).toContain('ECharts 页面 / 原生报表绑定经验');
    expect(retrospective).toContain('工作台是操作首页');
  });

  test('yida-design centralizes application theme token presets and keeps application theme profiles explicit', () => {
    const theme = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const app = readSkill('yida-skills/skills/yida-app/SKILL.md');
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
    expect(createApp).toContain('本技能只创建应用壳层并返回 `appType`');
    expect(createApp).toContain('本技能不按行业、场景或应用名推断颜色');
    expect(createApp).toContain('没有明确值时使用 CLI 和平台默认值');
    expect(createApp).not.toContain('shouldPassCreateAppTheme');
    expect(createApp).not.toContain('themePresetKey');
    expect(createApp).not.toContain('CLI 壳层 fallback');
    expect(createApp).not.toContain('禁止把行业词直接映射成固定颜色');
    expect(createApp).not.toContain('| `deepBlue` | 深蓝 |');
    expect(pageUiux).not.toContain('| `deepBlue` | 深蓝 |');
    expect(pageUiux).toContain('先根据行业、品牌、业务情绪和视觉目标做创意色彩判断');
    expect(theme).toContain('应用主题先统领页面主色');
    expect(theme).toContain('页面主按钮、链接、选中态、重点标签和图表主序列都跟随应用主题 `--color-brand1-*`');
    expect(step2).toContain('若截图或预览中出现左侧导航选中态与页面主操作颜色不一致');
    expect(styleSelection).toContain('应用主题主导，生成色彩作为辅助色');
    expect(canvasStyleGuide).toContain('本文件只说明 Code Canvas 如何实现样式，不产出设计要求');
    expect(canvasStyleGuide).toContain('完整应用先从薄 page-spec 取得 `prdRefs` 和 `designRefs`');
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
    const outputBlock = readSkill('yida-skills/skills/yida-prd/workflow/output-prd.md');
    const visualEngine = readSkill('yida-skills/skills/yida-design/references/visual-decision-engine.md');
    const dashboardTheme = readSkill('yida-skills/skills/yida-dashboard/references/theme-presets.md');
    const chartSpec = readSkill('yida-skills/skills/yida-chart/references/echarts-design-spec.md');

    expect(step4).toContain('共享需求简报只记录品牌和色彩偏好；`design.md` 写完整 `themeProfile`');
    expect(pageUiux).toContain('主色从行业、品牌、业务情绪和视觉目标推导');
    expect(step4).toContain('视觉方向要从“高级 / 简洁 / 商务”继续落细');
    expect(step4).toContain('主色：先按行业、品牌、业务情绪和视觉目标做创意判断，可选择平台预置主题，也可设计自定义品牌色盘');
    expect(step4).toContain('明暗模式：默认 `light`；`design.md` 的 `themeProfile.navTheme` 保持 `light`');
    expect(step4).toContain('`design.md` 的 `themeProfile.colorMode` 是宜搭配色模式');
    expect(outputBlock).toContain('| 品牌和色彩偏好 | <从共享需求简报读取用户指定品牌色、已有应用主题、偏好色和避用色> |');
    expect(outputBlock).toContain('| 视觉目标 | <从共享需求简报读取业务气质、参考案例和素材要求> |');
    expect(outputBlock).toContain('PRD 保留业务事实，design.md 保留视觉事实');
    expect(outputBlock).not.toContain('- 主题策略：<默认应用主题、themeProfile、themeScope、是否跟随运行态应用主题>');
    expect(visualEngine).toContain('默认 light，不默认暗黑');
    expect(pageUiux).toContain('默认浅底业务屏，只有用户明确说暗色/深色/夜间/高对比时才用深色沉浸');
    expect(dashboardTheme).toContain('白底商务风（DEFAULT）');
    expect(dashboardTheme).toContain('用户只说“做个看板 / 驾驶舱 / 数据大屏”，不说暗色或夜间，默认用 **主题 3（白底商务）**');
    expect(dashboardTheme).not.toContain('深色紫蓝科技风（DEFAULT）');
    expect(chartSpec).toContain('大屏不等于暗色');
  });

  test('custom pages do not build page-level navigation by default', () => {
    const pageUiux = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const navStep = readSkill('yida-skills/skills/yida-prd/workflow/step-3-information-architecture.md');
    const pageGeneration = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const navPatterns = readSkill('yida-skills/skills/yida-prd/references/app/navigation-patterns.md');
    const navGuide = readSkill('yida-skills/skills/yida-canvas-custom-page/references/navigation-and-entry-guide.md');
    const createPage = readSkill('yida-skills/skills/yida-create-page/SKILL.md');

    expect(pageUiux).toContain('默认页面保留平台应用导航');
    expect(pageUiux).toContain('页面内 tab、自绘侧边栏或独立门户壳写 `appBlueprint.hasPageNavigation: true`，同时保持平台导航可见');
    expect(pageUiux).toContain('同应用页面优先放入平台导航或导航分组');
    expect(navStep).toContain('默认自定义页**保留平台应用导航**');
    expect(navStep).toContain('页面内 tab / 分段导航 / 自绘导航记录为当前页内容结构，同时保持平台导航可见');
    expect(navStep).toContain('仅说「工作台 / 门户 / 看板 / 大屏 / 首页」时，优先解释为平台导航下的当前页面体验');
    expect(pageGeneration).toContain('默认实现保留平台应用导航，同应用内页面入口读取 PRD 导航章节');
    expect(pageGeneration).toContain('仅显式要求页面内门户壳、自绘导航或隐藏平台导航时使用');
    expect(navPatterns).toContain('默认不要在自定义页面里自建同级导航');
    expect(navPatterns).toContain('页面内导航不自动隐藏平台导航');
    expect(createPage).toContain('默认生成页面导航可见');
    expect(createPage).toContain('`--mode dashboard` | 否 | 看板/驾驶舱页面推荐使用；只表达页面模式，不会自动隐藏导航');
    expect(navStep).toContain('快捷入口目标是同应用内页面时');
    expect(pageGeneration).toContain('快捷入口目标是同应用内页面时');
    expect(navGuide).toContain('同应用内页面优先在平台应用导航内切换');
  });

  test('workbench pages avoid low-density giant card templates', () => {
    const pageUiux = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const step4 = readSkill('yida-skills/skills/yida-design/workflow/step-4-wireframe-interaction.md');
    const step5 = readSkill('yida-skills/skills/yida-design/workflow/step-5-visual-states.md');
    const step3 = readSkill('yida-skills/skills/yida-prd/workflow/step-3-information-architecture.md');
    const outputPrd = readSkill('yida-skills/skills/yida-prd/workflow/output-prd.md');
    const pageGeneration = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const canvasStyleGuide = readSkill('yida-skills/skills/yida-canvas-custom-page/references/canvas-style-implementation-guide.md');
    const qualityGates = readSkill('yida-skills/skills/yida-design/references/page-quality-gates.md');

    expect(pageUiux).toContain('工作台禁低密大卡片模板');
    expect(pageUiux).toContain('标题 + 4 个等宽大 KPI 白卡 + 图标快捷卡 + 大空态白卡');
    expect(pageUiux).toContain('页面丰富度保底');
    expect(pageUiux).toContain('至少规划 10 个有业务目的的区块以上');
    expect(step4).toContain('KPI 卡片: 学生总数, 课程总数, 本月出勤率, 平均分');
    expect(step4).toContain('KPI 组只能算 1 个');
    expect(step4).toContain('快捷入口组只能算 1 个');
    expect(qualityGates).toContain('## 1. 区块数量门禁');
    expect(qualityGates).toContain('## 2. 页面结构槽位门禁');
    expect(qualityGates).toContain('## 3. 低密大卡片门禁');
    expect(step3).toContain('必须显式列出 10 个以上 `contentBlocks`');
    expect(step3).toContain('KPI 组和快捷入口组各只算 1 个区块');
    expect(step4).toContain('读取 [页面质量门禁](../references/page-quality-gates.md)');
    expect(step4).toContain('sceneRecipes 草稿');
    expect(step4).toContain('禁止用 4 个等宽大 KPI 卡和大空态白卡撑首屏');
    expect(step4).toContain('默认至少拆成 10 个有业务目的的区块以上');
    expect(step4).toContain('内容区块：<至少 10 个区块列表 + 目的');
    expect(step4).toContain('KPI 组只能算 1 个，快捷入口组只能算 1 个，列表组只能算 1 个');
    expect(step4).toContain('视觉上只有 4 个聚合区块，不满足 10+');
    expect(step5).toContain('4 个等宽大 KPI 白卡 + 图标快捷卡 + 大空态白卡');
    expect(step5).toContain('满足页面质量门禁中的区块数量要求');
    expect(qualityGates).toContain('至少有 10 个有业务目的的 `contentBlocks`');
    expect(qualityGates).toContain('KPI 组、快捷入口组、列表组、图表组各只算 1 个区块');
    expect(outputPrd).toContain('必须逐条列出至少 10 个 `contentBlocks`');
    expect(outputPrd).toContain('KPI 组、快捷入口组、列表组各只算 1 个区块');
    expect(pageGeneration).toContain('KPI 子项、快捷入口子项和列表行不计入区块数量，不能用重复卡片或大空白凑数');
    expect(pageGeneration).toContain('工作台的状态摘要必须是 64-88px 圆润紧凑状态条');
    expect(pageGeneration).toContain('`contentBlocks`');
    expect(pageGeneration).toContain('至少有 10 个有业务目的的区块');
    expect(pageGeneration).toContain('KPI 子项、快捷入口子项和列表行不计入区块数量');
    expect(pageGeneration).toContain('这只构成 4 个聚合区块');
    expect(canvasStyleGuide).toContain('## 工作台卡片密度红线');
    expect(canvasStyleGuide).toContain('禁止使用“4 个等宽大 KPI 白卡 + 彩色图标盒 + 大数字 0”');
    expect(canvasStyleGuide).toContain('禁止用 160px 以上的大空态白卡');
    expect(canvasStyleGuide).toContain('## 默认圆润高密与呼吸感落地');
    expect(canvasStyleGuide).toContain('卡片 `border-radius` 范围 `0px-32px`');
    expect(canvasStyleGuide).toContain('页面布局必须有呼吸感');
    expect(canvasStyleGuide).toContain('卡片和卡片的 gap 默认 `12px-18px` 且必须小于 `20px`');
    expect(canvasStyleGuide).toContain('卡片 padding 默认 `22px-28px` 且必须大于 `20px`');
    expect(canvasStyleGuide).toContain('页面整体至少包含 10 个有业务目的的区块以上');
    expect(canvasStyleGuide).toContain('KPI 子项、快捷入口子项和列表行不能分别计数');
  });

  test('single page design checks current app theme before page-level decisions', () => {
    const design = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const pageDesign = readSkill('yida-skills/skills/yida-design/sub_skill/page-design/SKILL.md');
    const requirementAnalysis = readSkill('yida-skills/skills/yida-requirement-analysis/SKILL.md');
    const step3 = readSkill('yida-skills/skills/yida-prd/workflow/step-3-information-architecture.md');
    const output = readSkill('yida-skills/skills/yida-prd/workflow/output-prd.md');
    const blueprint = readSkill('yida-skills/skills/yida-prd/references/app/blueprint.md');

    expect(design).toContain('[page-design](sub_skill/page-design/SKILL.md)');
    expect(design).toContain('单页任务读取当前页面上下文');
    expect(design).toContain('不写 `prd.md`');
    expect(requirementAnalysis).toContain('从业务用途判断行业、用户、核心功能、业务对象和页面场景');
    expect(requirementAnalysis).toContain('最终主题色由 `yida-design` 决定');
    expect(step3).toContain('## 列资源清单');
    expect(step3).toContain('`display-page`');
    expect(step3).toContain('`normal-form`');
    expect(step3).toContain('`process-form`');
    expect(output).toContain('## 7. 资源蓝图');
    expect(output).toContain('process-form');
    expect(output).toContain('## 8. 资源创建顺序');
    expect(blueprint).toContain('每个资源必须有唯一、稳定的 `resourceKey`');
    expect(pageDesign).toContain('## 第一步：读取应用主题与现有功能');
    expect(pageDesign).toContain('单页设计和页面重构先确认当前应用主题');
    expect(pageDesign).toContain('页面重构、局部美化、列表/看板/详情优化默认沿用当前应用');
    expect(pageDesign).toContain('`project/config.json`、`.cache/<项目名>-schema.json`、`.openyida-page.json`');
    expect(pageDesign).toContain('已有 Page Spec、项目视觉配置或当前页面主题摘要');
    expect(pageDesign).toContain('| 1 | 本文件：读取应用主题与功能契约 | 获取 `currentAppTheme`、`currentPageTheme`、`themeEvidence`、`functionContract` |');
    expect(pageDesign).toContain('[选择主题色和 token](../../workflow/step-2-theme-system.md)');
    expect(pageDesign).toContain('`themeEvidence.status=missing`');
    expect(pageDesign).toContain('页面重构/局部美化：默认以当前应用主题为基准');
    expect(pageDesign).toContain('页面美化或改 UI 时保持 `functionContract` 不变');
    expect(pageDesign).toContain('changeScope');
    expect(pageDesign).toContain('themeDecision');
  });

  test('custom page form entries use responsive FormOpenContainer guidance', () => {
    const pageUiux = readSkill('yida-skills/skills/yida-design/SKILL.md');
    const canvas = readSkill('yida-skills/skills/yida-canvas-custom-page/SKILL.md');
    const navGuide = readSkill('yida-skills/skills/yida-canvas-custom-page/references/navigation-and-entry-guide.md');
    const pageGeneration = readSkill('yida-skills/skills/yida-canvas-custom-page/references/page-generation-guide.md');
    const themeHelpers = readSkill('yida-skills/skills/yida-canvas-custom-page/references/theme-runtime-helpers.md');
    const customPage = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');
    const codingGuide = readSkill('yida-skills/skills/yida-custom-page/references/coding-guide.md');
    const fieldUrlReference = readSkill('yida-skills/references/field-and-url-reference.md');
    const workflow = buildCommandManifest().summary.core_workflows.full_app_build;

    expect(pageUiux).toContain('表单入口只写交互意图');
    expect(pageUiux).toContain('具体 URL、真实记录校验、容器实现和主题同步由页面实现技能处理');
    expect(pageUiux).not.toContain('PC 端默认在侧边抽屉中用 iframe 承载宜搭原生表单');
    expect(pageUiux).not.toContain('抽屉默认半屏 `50vw`');
    expect(pageUiux).not.toContain('新增/提交页 URL 默认使用隐藏导航的 `submission/{formUuid}?isRenderNav=false`');
    expect(pageUiux).not.toContain('formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false');
    expect(canvas).toContain('navigation-and-entry-guide.md');
    expect(canvas).toContain('移动端使用全屏抽屉');
    expect(canvas).not.toContain('function FormOpenContainer');
    expect(canvas).not.toContain('按钮事件只能调用 `openForm({ type: "submission" | "detail", ... })`');
    expect(navGuide).toContain('"openMode": "responsive-drawer"');
    expect(navGuide).toContain('"hideNav": true');
    expect(navGuide).toContain('function FormOpenContainer');
    expect(navGuide).toContain('function useYidaFormOpen');
    expect(navGuide).toContain('installYidaGlobalThemeIntoFrame');
    expect(navGuide).toContain('themeTokens');
    expect(navGuide).toContain('onLoad={syncThemeToIframe}');
    expect(navGuide).toContain("const FORM_OPEN_DRAWER_WIDTH = 'min(720px, 100vw)';");
    expect(navGuide).toContain('width={FORM_OPEN_DRAWER_WIDTH}');
    expect(navGuide).toContain('return `/${appType}/submission/${entry.formUuid}?iframe=true&isRenderNav=false`;');
    expect(navGuide).toContain('formDetail/${entry.formUuid}?formInstId=');
    expect(navGuide).toContain('workbench/${entry.formUuid}?hideLeftNav=true&corpid=');
    expect(navGuide).toContain("entry.targetType === 'management'");
    expect(navGuide).toContain("'navConfig.layout': 1180");
    expect(navGuide).toContain('只使用 `searchFormDatas` 返回行的 `row.formInstId`');
    expect(navGuide).toContain('不要改用 `formInstanceId`、`instanceId` 或 `id`');
    expect(navGuide).toContain('&isRenderNav=false');
    expect(navGuide).toContain('FormOpenContainer');
    expect(navGuide).toContain('按钮事件只调用 `openForm(request)`');
    expect(navGuide).toContain('@openyida-form-open-mode page');
    expect(navGuide).not.toContain('function isMobileViewport()');
    expect(navGuide).not.toContain('runtime.openDrawer');
    expect(pageGeneration).toContain('表单新建/提交入口从 PRD 读取目标资源和打开方式');
    expect(pageGeneration).toContain('表单查看入口从 PRD 读取目标资源，并使用真实 `formUuid` 和 `formInstId`');
    expect(pageGeneration).toContain('数据管理入口使用真实 `corpId`');
    expect(pageGeneration).toContain('使用项目脚手架内置的 `FormOpenContainer`');
    expect(pageGeneration).toContain('移动端全屏抽屉');
    expect(pageGeneration).toContain('不要重新编写 URL 或 iframe 主题同步');
    expect(pageGeneration).toContain('新建 Canvas 页面使用项目脚手架内置主题和 iframe 同步能力');
    expect(pageGeneration).not.toMatch(/复制.*theme-runtime|复制.*helper|优先复制/);
    expect(themeHelpers).toContain('function installYidaGlobalThemeIntoFrame');
    expect(themeHelpers).toContain('FormOpenContainer');
    expect(themeHelpers).toContain('同源子 iframe 文档');
    expect(customPage).toContain('coding-guide.md');
    expect(customPage).toContain('FormOpenContainer');
    expect(customPage).not.toContain('半屏 `50vw` 抽屉 iframe');
    expect(customPage).not.toContain('formDetail/{formUuid}?formInstId=...&navConfig.layout=1180&isRenderNav=false');
    expect(codingGuide).toContain('桌面端打开右侧抽屉，移动端打开全屏抽屉');
    expect(codingGuide).toContain("drawerWidth: 'min(720px, 100vw)'");
    expect(codingGuide).toContain("state.formOpenRequest.drawerWidth || 'min(720px, 100vw)'");
    expect(codingGuide).toContain('FormOpenContainer');
    expect(codingGuide).toContain('formOpenRequest');
    expect(codingGuide).toContain('installYidaGlobalThemeIntoFrame');
    expect(codingGuide).toContain("'/submission/' + formUuid + '?iframe=true&isRenderNav=false'");
    expect(codingGuide).toContain("'/formDetail/' + formUuid");
    expect(codingGuide).toContain('&isRenderNav=false');
    expect(fieldUrlReference).toContain('{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&iframe=true&navConfig.layout=1180&isRenderNav=false');
    expect(workflow.form_entry_policy).toContain('mobile uses a full-screen drawer');
    expect(workflow.form_entry_policy).toContain('hideLeftNav=true&corpid={corpId}');
  });

  test('custom-page-dependent skills keep Code Canvas as creation path', () => {
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
    const dataBridge = readSkill('yida-skills/skills/yida-canvas-custom-page/references/data-bridge-guide.md');
    const customPage = readSkill('yida-skills/skills/yida-custom-page/SKILL.md');
    const codingGuide = readSkill('yida-skills/skills/yida-custom-page/references/coding-guide.md');
    const nativeDesignSystem = readSkill('yida-skills/skills/yida-custom-page/references/design-system.md');
    const assetsGuide = readSkill('yida-skills/skills/yida-custom-page/references/assets-guide.md');
    const dataSources = readSkill('yida-skills/skills/yida-data-source-connectors/SKILL.md');
    const nativeDataSource = readSkill('yida-skills/skills/yida-data-source-connectors/references/native-data-source-guide.md');

    expect(dashboard).toContain('设计经营看板、驾驶舱或数据大屏');
    expect(dashboard).toContain('Code Canvas 页面实现和发布 | `yida-canvas-custom-page`');
    expect(dashboard).toContain('页面真实数据 | `yida-canvas-data-binding`');
    expect(dashboard).toContain('Recharts 图表 | `yida-rechart`');
    expect(dashboard).toContain('服务端聚合和原生报表 | `yida-report`');
    expect(dashboard).toContain('已有普通 JSX ECharts 页面 | `yida-chart`');
    expect(dashboard).toContain('新看板使用 Code Canvas');
    expect(dashboard).not.toContain('## Canvas 实现纪律');
    expect(dashboard).not.toContain('Canvas 页面使用 `dataBinding` + `DataBridge`');
    expect(dashboard).not.toContain('`saveFormData → 集成自动化 → 待办2.0 ConnectorCall`');
    expect(dashboard).not.toContain('use_skill("yida-rechart"');
    expect(dashboard).not.toContain('use_skill("yida-chart"');

    expect(ppt).toContain('新建演示默认使用 **Code Canvas**');
    expect(ppt).toContain('`useEffect` 管键盘、hash、触摸、定时器和 cleanup');
    expect(ppt).toContain('## 存量普通页维护');

    expect(density).toContain('实现示例默认使用 **Code Canvas + React hooks**');
    expect(density).toContain('## 存量普通页维护');

    expect(navShell).toContain('新建导航壳默认交 **Code Canvas**');
    expect(navShell).toContain('需要可分享、前进/后退');
    expect(navShell).toContain('## 存量普通页维护');

    expect(pageUiux).toContain('新自定义页面使用 `yida-canvas-custom-page`');
    expect(pageUiux).toContain('Recharts 图表使用 `yida-rechart`');
    expect(pageUiux).toContain('已有普通 JSX 或 ECharts 页面分别使用对应维护技能');
    expect(pageUiux).toContain('页面重构/单页美化默认以当前应用主题色为基准');
    expect(canvas).toContain('完整应用先读薄 `page-spec.json`，再按 `prdRefs` 和 `designRefs` 读取 PRD/design.md 的当前页章节');
    expect(canvas).toContain('单页任务读取用户要求、当前页面上下文和可用的 `prd.md` / `design.md`');
    expect(canvas).toContain('canvas-style-implementation-guide.md');
    expect(canvas).not.toContain('canvas-design-system.md');
    expect(canvas).toContain('references/theme-runtime-helpers.md');
    expect(canvas).not.toContain('主题来源只读 `design.md`');
    expect(pageGeneration).toContain('新建 Canvas 页面使用项目脚手架内置主题和 iframe 同步能力');
    expect(readSkill('yida-skills/skills/yida-canvas-custom-page/references/theme-runtime-helpers.md')).toContain('只有维护旧源码、普通 JSX 页面或排查历史页面主题问题时');
    expect(canvas).not.toMatch(/复制.*theme-runtime|复制.*helper|优先复制/);
    expect(canvas).toContain('dependencies-and-cdn.md');
    expect(canvas).not.toContain('必须写 `import ... from \'包名\'`');
    expect(canvas).not.toContain('严禁写未声明裸变量依赖或手写 window 依赖');
    expect(canvas).not.toContain('`const { Drawer } = antd`');
    expect(canvas).not.toContain('`const { Search } = lucideReact`');
    expect(dependencies).toContain('不要在源码里写 `const { Drawer } = antd`');
    expect(dependencies).toContain('React Hooks、自定义 Hooks、`antd` 和 `@ant-design/icons` 都可用');
    expect(dependencies).toContain('不得把 `Search as SearchIcon` 这类 Lucide 名称写到 `@ant-design/icons` import 中');
    expect(dependencies).toContain('两个命令都会按文件后缀使用 Canvas 编译器');
    expect(authoringExamples).toContain('所有包依赖都用标准 `import`');
    expect(authoringExamples).toContain('不要直接从 `window.*` 解构');
    expect(authoringExamples).toContain('JSX 文案只能写成纯文本 `所有级别` 或带引号字符串 `{\'所有级别\'}`');
    expect(canvasStyleGuide).toContain('本文件只说明 Code Canvas 如何实现样式，不产出设计要求');
    expect(canvasStyleGuide).toContain('完整应用先从薄 page-spec 取得 `prdRefs` 和 `designRefs`');
    expect(pageUiux).not.toContain('Canvas 样式实现指南');
    expect(pageUiux).not.toContain('Canvas 设计系统');
    expect(canvasStyleGuide).toContain('| `--color-brand1-6` | 主色 |');
    expect(canvasStyleGuide).toContain('| `--color-brand-1` ~ `--color-brand-4` | 移动端品牌色阶 |');
    expect(canvasStyleGuide).toContain('页面重构/局部美化即使是 page scope，也先以当前应用主题为基准');
    expect(canvasStyleGuide).toContain('## 视觉落地顺序');
    expect(canvasStyleGuide).toContain('完整应用读取 `designRefs` 指向的 `visualScaffold` 和当前 `sceneRecipes`');
    expect(canvasStyleGuide).toContain('theme-runtime-helpers.md');
    expect(canvasStyleGuide).toContain('旧源码缺少主题同步时');
    expect(canvasStyleGuide).not.toMatch(/复制.*theme-runtime|复制.*helper|优先复制/);
    expect(canvasStyleGuide).toContain('## 背景层实现规则');
    expect(canvasStyleGuide).toContain('OPENYIDA_BACKGROUND_LAYER_CSS');
    expect(canvasStyleGuide).toContain('.oy-page-root::before');
    expect(canvasStyleGuide).toContain('clip-path');
    expect(canvasStyleGuide).toContain('prefers-reduced-motion');
    expect(readSkill('yida-skills/skills/yida-canvas-custom-page/references/theme-runtime-helpers.md')).toContain('collectYidaThemeDocuments');
    expect(readSkill('yida-skills/skills/yida-canvas-custom-page/references/theme-runtime-helpers.md')).toContain('cursor.parent');
    expect(canvasStyleGuide).toContain('## 源码结构验收');
    expect(canvasStyleGuide).toContain('缺少 `prioritySurface`、`contentPrimitive` 或 `statePrimitive` 任意一项');
    expect(pageGeneration).toContain('| `sourceOfTruth.prdRefs` |');
    expect(pageGeneration).toContain('| `sourceOfTruth.designRefs` |');
    expect(pageGeneration).toContain('| `dataBindings` |');
    expect(pageGeneration).toContain('"prdRefs": ["pages.growth_dashboard"');
    expect(pageGeneration).toContain('完整应用使用薄 `page-spec.json` 找到当前页面要读取的 PRD/design.md 章节');
    expect(pageGeneration).toContain('页面重构或局部美化先以当前应用主题为基准');
    expect(pageGeneration).toContain('从 `prdRefs` 读取业务名称、对象、指标、动作、数据来源和验收要求');
    expect(canvas).not.toContain('完整应用默认由 `yida-data-management` 写入 1-3 条业务化 demo records；该任务可与页面实现并行');
    expect(canvas).not.toContain('JSX 文案只能写成纯文本 `所有级别` 或带引号字符串 `{\'所有级别\'}`');
    expect(pageGeneration).toContain('seed 写入可与页面实现并行');
    expect(dataBridge).toContain('完整应用/真实交付页默认由 `yida-app` 调用 `yida-data-management` 把 1-3 条 demo records 写入真实表单，写入任务可与 Canvas 页面实现并行');
    expect(pageGeneration).not.toContain('视觉路由');
    expect(pageGeneration).not.toContain('自然语言推断');
    expect(customPage).toContain('新建自定义页面 → 使用 `yida-canvas-custom-page`');
    expect(customPage).toContain('coding-guide.md');
    expect(customPage).not.toContain('JSX 文案只能写成纯文本 `所有级别` 或带引号字符串 `{\'所有级别\'}`');
    expect(codingGuide).toContain('中文业务文案只能写成纯文本 `所有级别` 或带引号字符串 `{\'所有级别\'}`');
    expect(customPage).toContain('assets-guide.md');
    expect(customPage).not.toContain('源码禁止 `import/require`');
    expect(customPage).not.toContain('普通 JSX 只能通过已验证运行时脚本/global 方式加载这两类图标库，不能写 import');
    expect(assetsGuide).toContain('自定义页面图标只使用 `lucide-react` 或 `@ant-design/icons`');
    expect(assetsGuide).toContain('Code Canvas 使用标准 import');
    expect(assetsGuide).toContain('普通 JSX 是非 Code Canvas 的自定义页面，源码不支持 import');
    expect(assetsGuide).toContain('只能通过已验证运行时脚本/global 方式加载这两类图标库');
    expect(assetsGuide).toContain('加载条件不满足时切到 Code Canvas 或去掉非必要图标');
    expect(assetsGuide).toContain('| `lucide-react` | ISC |');
    expect(assetsGuide).toContain('| `@ant-design/icons` | MIT |');
    expect(assetsGuide).not.toContain('| [iconfont（阿里）]');
    expect(assetsGuide).not.toContain('| [Remix Icon]');
    expect(assetsGuide).not.toContain('| [Font Awesome]');
    expect(assetsGuide).not.toContain('SVG 内联');
    expect(canvas).not.toContain('UI 改造保持功能契约');
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

    expect(dataSources).toContain('本技能只服务 **已有普通 JSX 自定义页面**');
    expect(dataSources).toContain('Code Canvas 不直接使用普通页面的 `this.dataSourceMap`');
    expect(dataSources).toContain('use_skill("yida-canvas-data-binding"');
    expect(dataSources.split('\n').length).toBeLessThan(90);
    expect(dataSources).not.toContain('export function loadConnectorDataSource');
    expect(nativeDataSource).toContain('export function loadConnectorDataSource');
  });
});
