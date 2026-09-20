'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseDesignDocument, serializeDesignDocument, extractDesignTokens, validateDesignDocument } = require('../lib/design/document');
const { resolveThemeColors } = require('../lib/design-plan/themes');

const ROOT = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/templates/design-themes/dark-inset-hairline.md'), 'utf8');
const tokenFixture = parseDesignDocument(resolveThemeColors(template.replace(/\{\{PRIMARY_COLOR\}\}/g, '#1677FF'))).metadata.tokens;

function fixture() {
  return {
    metadata: {
      schemaVersion: '1.0', name: '研发 "A" 系统', description: '页面设计',
      tokens: JSON.parse(JSON.stringify(tokenFixture)),
      themeProfile: { name: '业务风格', themeColor: '#1677FF', themeColorSource: 'user-specified', navTheme: 'dark', themeDelivery: 'app-custom-theme-file', themeFile: 'app-theme.css' },
      sceneRecipes: { workbench: { pages: [{ pageId: 'workbench', anchor: '#page-workbench' }] } },
      components: { button: { anchor: '#component-button' } }, states: { empty: { anchor: '#state-empty' } },
      assetStrategy: { pages: [{ pageId: 'workbench', imageNeed: 'none', slots: [] }] },
      iconSystem: { library: 'lucide-react', mappings: { add: 'Plus' } },
    },
    body: [
      '# 研发 A 项目设计', '', '## 1. 风格摘要', '', '克制、清晰。', '',
      '## 2. 页面视觉系统', '', '内容使用 var(--pod-page-bg-color)。', '',
      '## 3. 基础组件表达', '', '<a id="component-button"></a>', '### 按钮', '主要操作使用品牌色。', '',
      '<a id="state-empty"></a>', '### 空状态', '空状态提供登记入口。', '',
      '## 4. 特色表达配方', '', '只呈现真实内容。', '',
      '## 5. 项目应用与调整规则', '', '<a id="page-workbench"></a>', '### 工作台', '',
      '- **页面任务：** 处理待办', '- **首屏焦点：** 逾期队列优先', '- **布局：** 主列表与上下文分栏',
      '- **表面与组件：** 表格使用炭灰表面', '- **主操作：** 完成任务', '- **状态：** 无记录显示登记入口',
      '- **响应式：** 720px以下上下堆叠，列表横向滚动', '- **验收：** 操作后同源刷新计数与列表', '',
    ].join('\n'),
  };
}

function prd(designFile = 'prd/研发/design.md', pages) {
  return '# 项目PRD\n\n```json\n' + JSON.stringify({ appConfig: {}, resourceBlueprint: [], pages: pages || [{
    pageId: 'workbench', pageSpecHandoff: { designFile, designRefs: ['themeProfile', 'sceneRecipes.workbench', 'components.button', 'states.empty'] },
  }] }, null, 2) + '\n```\n';
}

function fastPrd(refs = '`themeProfile` / `sceneRecipes.workbench` / `components.button` / `states.empty`') {
  return [
    '# 研发项目 PRD', '', '## 3. 数据模型与业务字段', '', '订单业务字段。', '',
    '## 4. 页面与功能设计', '', '### 工作台', '',
    '- pageId：`workbench`', '- 页面类型：`display-page`', '- 页面目标：处理待办',
    '- 关联资源：', '  - 表单：订单', '- pageSpecHandoff：',
    '  - pageStructure：workbench', '  - scene：workbench',
    '  - designFile：`prd/研发/design.md`', `  - designRefs：${refs}`,
    '  - dataBinding：form', '', '### 订单登记', '', '- 页面类型：form-page',
    '- 页面目标：登记订单', '', '## 5. 应用主题与风格摘要', '', '沿用当前设计。', '',
  ].join('\n');
}

function check(value = fixture(), options) {return validateDesignDocument(serializeDesignDocument(value), options);}
function expectIssue(action, issue) {
  try {action(); throw new Error('Expected validation error');} catch (error) {expect(error.details?.issue).toBe(issue);}
}

test('platform basics are a minimum set and can consume declared project extensions', () => {
  const value = fixture();
  const global = value.metadata.tokens['application-global'];
  global.spacing['--project-reading-width'] = 'min(100%, 72rem)';
  value.metadata.tokens['custom-page'].project = {
    '--project-paper': '#F6F1E8',
    '--project-surface': 'var(--project-paper)',
    '--project-cover': 'linear-gradient(135deg, var(--project-paper), #FFFFFF)',
    '--project-motion': '180ms',
  };
  global.appearance.surfaces['--pod-page-bg-color'] = 'var(--project-surface)';
  expect(() => check(value)).not.toThrow();
  expect(extractDesignTokens(value.metadata, { strict: true })).toMatchObject({
    '--pod-page-bg-color': 'var(--project-surface)',
    '--project-reading-width': 'min(100%, 72rem)',
    '--project-cover': 'linear-gradient(135deg, var(--project-paper), #FFFFFF)',
    '--project-motion': '180ms',
  });
});

test.each(['页面任务', '首屏焦点', '布局', '表面与组件', '主操作', '状态', '响应式', '验收'])(
  'final documents reject generic text for %s just as Plan inputs do', label => {
    for (const placeholder of ['按主题执行', '继承主题。', 'TODO']) {
      const value = fixture();
      value.body = value.body.replace(new RegExp(`^- \\*\\*${label}：\\*\\* .*`, 'm'), `- **${label}：** ${placeholder}`);
      expectIssue(() => check(value), 'PAGE_LABEL_REQUIRED');
    }
  }
);

test.each(['--pod-app-root-bg-color', '--pod-page-bg-color', '--pod-card-bg-color'])(
  'background colors reject image values in %s', token => {
    const value = fixture();
    value.metadata.tokens['application-global'].appearance[token] = 'linear-gradient(135deg, #F4F8F5, #E8F0EC)';
    expectIssue(() => check(value), 'COLOR_CANNOT_BE_IMAGE');
  }
);

test('serialization safely round-trips metadata, grouped tokens and single-line asset JSON', () => {
  const value = fixture();
  value.metadata.description = '引号 "、换行\n、反斜杠\\都保留';
  const markdown = serializeDesignDocument(value.metadata, value.body);
  expect(parseDesignDocument(markdown)).toEqual({ metadata: value.metadata, body: '\n' + value.body.trim() + '\n' });
  expect(markdown).toMatch(/^assetStrategy: \{[^\n]+\}$/m);
  expect(markdown).toMatch(/"--pod-card-bg-color": "#0E0E0E"/);
  expect(validateDesignDocument(markdown, { prdMarkdown: prd() })).toMatchObject({ success: true, pages: ['workbench'], prdChecked: true });
});

test.each([
  ['duplicate keys', 'name: A\nname: B', 'INVALID_YAML'],
  ['cyclic alias', 'name: A\na: &cycle\n  back: *cycle', 'CYCLIC_ALIAS'],
  ['unsupported YAML type', 'name: A\na: !!binary SGVsbG8=', 'INVALID_YAML'],
  ['prototype key', 'name: A\n__proto__: {}', 'UNSAFE_KEY'],
])('parser rejects %s', (_label, frontmatter, issue) => {
  expectIssue(() => parseDesignDocument(`---\n${frontmatter}\n---\n# Design`), issue);
});

test('normal YAML flow and block mappings share the same parser', () => {
  for (const field of ['themeProfile: {navTheme: dark}', 'themeProfile:\n  navTheme: dark']) {
    expect(parseDesignDocument(`---\n${field}\n---\n`).metadata.themeProfile.navTheme).toBe('dark');
  }
});

test('legacy bare HEX compatibility is explicit and never changes versioned documents or body', () => {
  const source = '---\ntokens:\n  "--color-brand1-6": #1677FF # selected color\nassetStrategy: {"pages": []}\n---\n# Design\n--example: #123456\n';
  expect(parseDesignDocument(source).metadata.tokens['--color-brand1-6']).toBeNull();
  const legacy = parseDesignDocument(source, { legacyTokenValues: true });
  expect(legacy.metadata.tokens['--color-brand1-6']).toBe('#1677FF');
  expect(legacy.metadata.assetStrategy).toEqual({ pages: [] });
  expect(legacy.body).toBe('# Design\n--example: #123456\n');
  for (const version of ['"1.0"', 'null']) {
    const current = source.replace('tokens:', `schemaVersion: ${version}\ntokens:`);
    expect(parseDesignDocument(current, { legacyTokenValues: true }).metadata.tokens['--color-brand1-6']).toBeNull();
  }
});

test('legacy token extraction reads only tokens, converts numbers and preserves same-value compatibility', () => {
  const tokens = extractDesignTokens(fixture().metadata);
  const metadata = { tokens, example: { '--color-brand1-6': '#FF0000' } };
  metadata.tokens['--font-weight-custom'] = 500;
  expect(extractDesignTokens(metadata)['--color-brand1-6']).toBe('#1677FF');
  expect(extractDesignTokens(metadata)['--font-weight-custom']).toBe('500');
  expect(() => extractDesignTokens({ example: tokens })).toThrow();
  expect(() => extractDesignTokens({ tokens: { '--only-one': '1px' } })).toThrow();
});

test.each(['red; color: blue', 'var(--x', '{{PRIMARY_COLOR}}', 'url(javascript:alert(1))', 'x\ny'])('token extraction rejects unresolved or unsafe value %s', value => {
  const metadata = fixture().metadata;
  metadata.tokens['custom-page']['--bad-value'] = value;
  expect(() => extractDesignTokens(metadata)).toThrow();
});

test.each([
  ['missing schema', v => { delete v.metadata.schemaVersion; }, 'EXPECTED_1_0'],
  ['missing token group', v => { delete v.metadata.tokens['application-global'].shadow; }, 'SIX_GLOBAL_GROUPS_REQUIRED'],
  ['missing standard variable', v => { delete v.metadata.tokens['application-global'].spacing['--s-5']; }, 'GLOBAL_TOKEN_SET_MISMATCH'],
  ['wrong token group', v => { v.metadata.tokens['application-global'].colors['--s-5'] = '20px'; }, 'GLOBAL_TOKEN_SET_MISMATCH'],
  ['undefined reference', v => { v.metadata.tokens['custom-page']['--a'] = 'var(--missing)'; }, 'UNDECLARED_TOKEN_REFERENCE'],
  ['platform references missing extension', v => { v.metadata.tokens['application-global'].appearance.surfaces['--pod-page-bg-color'] = 'var(--page-only-paper)'; }, 'UNDECLARED_TOKEN_REFERENCE'],
  ['cycle', v => { Object.assign(v.metadata.tokens['custom-page'], { '--a': 'var(--b)', '--b': 'var(--a)' }); }, 'TOKEN_REFERENCE_CYCLE'],
  ['cross-group cycle', v => {
    v.metadata.tokens['application-global'].appearance.surfaces['--pod-page-bg-color'] = 'var(--project-paper)';
    v.metadata.tokens['custom-page']['--project-paper'] = 'var(--pod-page-bg-color)';
  }, 'TOKEN_REFERENCE_CYCLE'],
  ['fixed bridge', v => { v.metadata.tokens['application-global'].colors['--color-white'] = '#FFFFFF'; }, 'FIXED_PLATFORM_VALUE'],
  ['primary mismatch', v => { v.metadata.themeProfile.themeColor = '#FF0000'; }, 'PRIMARY_COLOR_MISMATCH'],
  ['missing CSS path', v => { delete v.metadata.themeProfile.themeFile; }, 'STRING_REQUIRED'],
  ['empty custom CSS path', v => { v.metadata.themeProfile.themeFile = ''; }, 'THEME_FILE_REQUIRED'],
  ['invalid optional plan revision', v => { v.metadata.buildPlanRevision = 42; }, 'NONEMPTY_STRING_REQUIRED'],
  ['template identity', v => { v.metadata.themeId = 'source-template'; }, 'TEMPLATE_IDENTITY_NOT_ALLOWED'],
  ['invalid inherited CSS path', v => { v.metadata.themeProfile.themeDelivery = 'current-app-theme'; v.metadata.themeProfile.themeFile = []; }, 'STRING_REQUIRED'],
  ['invalid navigation value', v => { v.metadata.themeProfile.hideAppNav = true; }, 'INVALID_NAVIGATION_VALUE'],
  ['invalid icon mapping', v => { v.metadata.iconSystem.mappings.add = {}; }, 'ICON_COMPONENT_NAME_REQUIRED'],
  ['missing icons', v => { delete v.metadata.iconSystem; }, 'ICON_LIBRARY_AND_MAPPINGS_REQUIRED'],
  ['reordered chapters', v => { v.body = v.body.replace('## 4. 特色表达配方', '## 6. 其他'); }, 'FIVE_ORDERED_CHAPTERS_REQUIRED'],
  ['wrong H1 position', v => { v.body = '前置正文\n' + v.body; }, 'ONE_LEADING_H1_REQUIRED'],
  ['duplicate anchor', v => { v.body += '\n<a id="page-workbench"></a>'; }, 'DUPLICATE_ANCHOR'],
  ['missing anchor', v => { v.metadata.components.button.anchor = '#missing'; }, 'EXISTING_ANCHOR_REQUIRED'],
  ['component prose duplicated in metadata', v => { v.metadata.components.button.rules = '主要操作使用品牌色'; }, 'ANCHOR_ONLY_REQUIRED'],
  ['state prose duplicated in metadata', v => { v.metadata.states.empty.rules = '请登记'; }, 'ANCHOR_ONLY_REQUIRED'],
  ['page prose duplicated in metadata', v => { v.metadata.sceneRecipes.workbench.pages[0].rules = '处理待办'; }, 'PAGE_ID_AND_ANCHOR_ONLY_REQUIRED'],
  ['invalid reference key', v => { v.metadata.components['button.primary'] = v.metadata.components.button; }, 'INVALID_REFERENCE_KEY'],
  ['component anchor outside chapter three', v => { v.metadata.components.button.anchor = '#page-workbench'; }, 'ANCHOR_MUST_BE_IN_CHAPTER_THREE'],
  ['state anchor outside chapter three', v => { v.metadata.states.empty.anchor = '#page-workbench'; }, 'ANCHOR_MUST_BE_IN_CHAPTER_THREE'],
  ['missing page label', v => { v.body = v.body.replace('- **布局：** 主列表与上下文分栏', ''); }, 'PAGE_LABEL_REQUIRED'],
  ['placeholder page label', v => { v.body = v.body.replace('逾期队列优先', '待补充'); }, 'PAGE_LABEL_REQUIRED'],
  ['draft page label', v => { v.body = v.body.replace('逾期队列优先', '草稿待补充'); }, 'PAGE_LABEL_REQUIRED'],
  ['draft layout with generated suffix', v => { v.body = v.body.replace('- **布局：** 主列表与上下文分栏', '- 布局：草稿待补充；页面模式 x'); }, 'PAGE_LABEL_REQUIRED'],
  ['unknown image page', v => { v.metadata.assetStrategy.pages[0].pageId = 'unknown'; }, 'UNKNOWN_DESIGN_PAGE'],
])('strict design validation rejects %s', (_label, mutate, issue) => {
  const value = fixture();
  mutate(value);
  expectIssue(() => check(value), issue);
});

test('strict validation rejects duplicate declarations even when values agree', () => {
  const value = fixture();
  value.metadata.tokens['custom-page']['--color-white'] = 'var(--pod-card-bg-color)';
  expect(() => check(value)).toThrow(expect.objectContaining({ code: 'DESIGN_THEME_TOKEN_CONFLICT' }));
});

test('project fonts, spacing and additional platform tokens remain configurable', () => {
  const value = fixture();
  value.metadata.tokens['application-global'].typography['--font-size-subhead'] = '20px';
  value.metadata.tokens['application-global'].spacing['--s-5'] = '24px';
  value.metadata.tokens['application-global'].appearance['--pod-card-border-radius'] = '12px';
  expect(check(value).success).toBe(true);
});

test('examples cannot satisfy body anchors, page labels or the PRD handoff', () => {
  const value = fixture();
  value.body = value.body.replace('- **布局：** 主列表与上下文分栏', '```markdown\n- **布局：** 主列表与上下文分栏\n```');
  expectIssue(() => check(value), 'PAGE_LABEL_REQUIRED');
  const fakePrd = '# PRD\n正文中的 designRefs: ["themeProfile"]\n```json\n{"pages":[]}\n```';
  expectIssue(() => check(fixture(), { prdMarkdown: fakePrd }), 'ONE_STRUCTURED_HANDOFF_REQUIRED');
});

test('PRD validates refs, per-scene page membership and page coverage', () => {
  expectIssue(() => check(fixture(), { prdMarkdown: prd().replace('components.button', 'components.missing') }), 'MISSING_DESIGN_REFERENCE');
  expectIssue(() => check(fixture(), { prdMarkdown: prd('design.md', []) }), 'DESIGN_PAGE_COVERAGE_MISMATCH');
  const value = fixture();
  value.metadata.sceneRecipes.other = { pages: [{ pageId: 'other', anchor: '#page-other' }] };
  value.body += '\n' + value.body.slice(value.body.indexOf('<a id="page-workbench">')).replace('page-workbench', 'page-other');
  expectIssue(() => check(value, { prdMarkdown: prd().replace('sceneRecipes.workbench', 'sceneRecipes.other') }), 'SCENE_PAGE_MISMATCH');
});

test.each([
  '`themeProfile` / `sceneRecipes.workbench` / `components.button` / `states.empty`',
  '`themeProfile`、`sceneRecipes.workbench`，`components.button`, `states.empty`',
  '["themeProfile", "sceneRecipes.workbench", "components.button", "states.empty"]',
])('Fast Markdown PRD reads explicit page IDs and nested handoff refs: %s', refs => {
  expect(check(fixture(), { prdMarkdown: fastPrd(refs) })).toMatchObject({ success: true, prdChecked: true, pages: ['workbench'] });
});

test.each([
  ['missing stable page ID', text => text.replace('- pageId：`workbench`\n', ''), 'UNIQUE_PAGE_ID_REQUIRED'],
  ['unknown reference', text => text.replace('components.button', 'components.missing'), 'MISSING_DESIGN_REFERENCE'],
  ['invalid reference syntax', text => text.replace('components.button', 'components.button.extra'), 'INVALID_DESIGN_REFERENCE'],
  ['malformed JSON references', text => text.replace(/ {2}- designRefs：[^\n]+/, '  - designRefs：["themeProfile",]'), 'INVALID_DESIGN_REFERENCE'],
  ['missing page handoff', text => text.replace('- pageSpecHandoff：', '- 其他说明：'), 'PAGE_HANDOFF_REQUIRED'],
  ['missing custom page', text => text.replace('- 页面类型：`display-page`', '- 页面类型：form-page'), 'DESIGN_PAGE_COVERAGE_MISMATCH'],
  ['duplicate page ID field', text => text.replace('- pageId：`workbench`', '- pageId：`workbench`\n- pageId：other'), 'DUPLICATE_PRD_FIELD'],
  ['wrong stable ID despite same page name', text => text.replace('- pageId：`workbench`', '- pageId：`different`'), 'SCENE_PAGE_MISMATCH'],
])('Fast Markdown PRD rejects %s', (_label, mutate, issue) => {
  expectIssue(() => check(fixture(), { prdMarkdown: mutate(fastPrd()) }), issue);
});

test('Fast native-only PRDs have no custom design pages; fenced examples never create pages', () => {
  const value = fixture();
  value.metadata.sceneRecipes = {};
  value.metadata.assetStrategy.pages = [];
  value.body = value.body.slice(0, value.body.indexOf('<a id="page-workbench">'));
  const native = '# PRD\n## 4. 页面与功能设计\n### 订单表单\n- 页面类型：form-page\n## 5. 应用主题与风格摘要\n';
  const example = '\n````markdown\n' + fastPrd() + '\n' + prd() + '\n````\n';
  expect(check(value, { prdMarkdown: native + example }).pages).toEqual([]);
  expectIssue(() => check(fixture(), { prdMarkdown: native + example }), 'DESIGN_PAGE_COVERAGE_MISMATCH');
});

test.each([
  '\n```json\n{"pages":[],"appConfig":{},}\n```',
  '\n```json\n{"pages":{},"appConfig":{}}\n```',
  '\n### 结构化交接\n```json\n{broken}\n```',
  '\n```json\n{"pages":[],"appConfig":{},',
])('malformed Plan handoffs cannot fall back to an otherwise valid Fast PRD: %s', handoff => {
  expectIssue(() => check(fixture(), { prdMarkdown: fastPrd() + handoff }), 'INVALID_STRUCTURED_HANDOFF');
});

test('a valid Plan handoff takes precedence over illustrative Fast sections', () => {
  const wrongFast = fastPrd().replace('components.button', 'components.missing');
  expect(check(fixture(), { prdMarkdown: wrongFast + prd() }).success).toBe(true);
});

test('native-form-only designs and exported bundles are valid', () => {
  const value = fixture();
  value.metadata.sceneRecipes = {};
  value.metadata.assetStrategy.pages = [];
  value.body = value.body.slice(0, value.body.indexOf('<a id="page-workbench">'));
  expect(check(value, { prdMarkdown: prd('prd/project/design.md', []) }).pages).toEqual([]);
  const baseDir = path.join(os.tmpdir(), 'export');
  expect(check(fixture(), { prdMarkdown: prd(), designFile: path.join(baseDir, 'prd/研发/design.md'), baseDir }).success).toBe(true);
  expectIssue(() => check(fixture(), { prdMarkdown: prd(), designFile: path.join(baseDir, 'design.md'), baseDir }), 'DESIGN_FILE_MISMATCH');
});

test('document locations use the working directory by default and check absolute references too', () => {
  const designFile = path.resolve('prd/研发/design.md');
  expect(check(fixture(), { prdMarkdown: prd(), designFile }).success).toBe(true);
  expect(check(fixture(), { prdMarkdown: prd(designFile), designFile }).success).toBe(true);
  expect(check(fixture(), { prdMarkdown: prd('prd/研发/../研发/design.md'), designFile }).success).toBe(true);
  for (const other of ['prd/another-project/nonexistent.md', path.resolve('prd/other/design.md')]) {
    expectIssue(() => check(fixture(), { prdMarkdown: prd(other), designFile }), 'DESIGN_FILE_MISMATCH');
  }
});

test.each(['Plan', 'Fast'])('CLI checks %s relative paths by default and supports explicit project roots', format => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-design-paths-'));
  try {
    const project = path.join(dir, 'project');
    const designPath = path.join(project, 'prd/研发/design.md');
    const prdPath = path.join(project, 'prd/研发/prd.md');
    fs.mkdirSync(path.dirname(designPath), { recursive: true });
    fs.writeFileSync(designPath, serializeDesignDocument(fixture()));
    const writePrd = reference => fs.writeFileSync(prdPath, format === 'Plan' ? prd(reference)
      : fastPrd().replace('prd/研发/design.md', reference));
    const invoke = (cwd, extra = []) => spawnSync(process.execPath, [path.join(ROOT, 'bin/yida.js'), 'check-design',
      path.relative(cwd, designPath), '--prd', path.relative(cwd, prdPath), '--json', ...extra], {
      cwd, encoding: 'utf8', env: { ...process.env, CI: '1', OPENYIDA_LANG: 'zh' },
    });
    const mismatch = result => {
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout || result.stderr)).toMatchObject({
        success: false, errorCode: 'DESIGN_DOCUMENT_INVALID',
        details: expect.objectContaining({ issue: 'DESIGN_FILE_MISMATCH' }),
      });
    };
    writePrd('prd/研发/design.md');
    expect(invoke(project).status).toBe(0);
    mismatch(invoke(dir));
    const explicit = invoke(dir, ['--base-dir', 'project']);
    expect(explicit.status).toBe(0);
    expect(JSON.parse(explicit.stdout)).toMatchObject({ success: true, prdChecked: true, baseDir: fs.realpathSync(project) });
    fs.symlinkSync(project, path.join(dir, 'linked-project'), 'junction');
    expect(invoke(dir, ['--base-dir', 'linked-project']).status).toBe(0);
    mismatch(invoke(dir, ['--base-dir', 'wrong-root']));
    // Both missing paths and another existing file must fail, even with identical contents.
    const other = path.join(project, 'prd/other/design.md');
    fs.mkdirSync(path.dirname(other), { recursive: true });
    fs.copyFileSync(designPath, other);
    for (const reference of ['prd/another-project/nonexistent.md', 'prd/other/design.md', other]) {
      writePrd(reference);
      mismatch(invoke(project));
      mismatch(invoke(dir, ['--base-dir', project]));
    }
    writePrd(designPath);
    expect(invoke(dir).status).toBe(0);
    for (const args of [['--base-dir'], ['--base-dir', project, '--base-dir', project]]) {
      const invalid = invoke(dir, args);
      expect(invalid.status).toBe(1);
    }
    expect(fs.readFileSync(designPath, 'utf8')).toBe(serializeDesignDocument(fixture()));
    expect(fs.readdirSync(path.dirname(designPath)).sort()).toEqual(['design.md', 'prd.md']);
  } finally {fs.rmSync(dir, { recursive: true, force: true });}
});

test('check-design CLI validates local documents without writing and returns structured failures', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-check-design-'));
  try {
    const designPath = path.join(dir, 'design.md');
    const prdPath = path.join(dir, 'prd.md');
    const design = serializeDesignDocument(fixture());
    fs.writeFileSync(designPath, design);
    fs.writeFileSync(prdPath, prd(designPath));
    const invoke = args => spawnSync(process.execPath, [path.join(ROOT, 'bin/yida.js'), 'check-design', ...args], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, CI: '1', OPENYIDA_LANG: 'zh' },
    });
    const good = invoke([designPath, '--prd', prdPath, '--json']);
    expect({ status: good.status, stderr: good.stderr }).toEqual({ status: 0, stderr: '' });
    expect(JSON.parse(good.stdout)).toMatchObject({ success: true, prdChecked: true });
    expect(fs.readFileSync(designPath, 'utf8')).toBe(design);
    expect(fs.readdirSync(dir).sort()).toEqual(['design.md', 'prd.md']);
    fs.writeFileSync(designPath, design.replace('schemaVersion: "1.0"', 'schemaVersion: "0.0"'));
    const bad = invoke([designPath, '--json']);
    expect(bad.status).toBe(1);
    expect(JSON.parse(bad.stdout || bad.stderr)).toMatchObject({ success: false, errorCode: 'DESIGN_DOCUMENT_INVALID' });
    expect(invoke(['--help']).status).toBe(0);
  } finally {fs.rmSync(dir, { recursive: true, force: true });}
});
