'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadThemeIndex, DESIGN_SKILL_ROOT, resolveThemeColors } = require('../lib/design-plan/themes');
const { catalog } = require('../lib/design-plan/init');
const { materialize } = require('../lib/design-plan/materialize');
const { readDesignTokens, applyDesignTokens } = require('../lib/app/theme-from-design');
const { exportApplicationStyle, CREATIVE_TOKENS } = require('../lib/app/application-style');
const { validateThemeCssContent } = require('../lib/app/custom-theme');
const { parseDesignDocument } = require('../lib/design/document');
const { BUSINESS_FIELD_TYPES, PRESENTATION_FIELD_TYPES } = require('../lib/app/form-field-validator');
const sample = require('../lib/core/sample');
const form = require('../lib/app/create-form')._private;
const themeIndex = loadThemeIndex().themes;
const applicationStyles = themeIndex.filter(theme => theme.collection === 'application-styles');
const sharedThemes = themeIndex.filter(theme => !theme.collection);
const styles = applicationStyles.filter(theme => theme.mode !== 'creative');
const DETAIL_FIELD_PREVIEW_TOKENS = [
  '--pod-field-preview-bg-color', '--pod-field-preview-border-radius',
  '--pod-field-preview-indicator-color', '--pod-field-preview-shadow',
  '--pod-field-preview-text-color', '--form-element-medium-font-size',
  '--pod-field-preview-gap', '--pod-field-preview-line-height',
  '--pod-field-preview-min-height', '--pod-field-preview-padding',
];
const NAVIGATION_COLOR_TOKENS = [
  '--pod-shell-theme-bg-color', '--pod-nav-item-text-color', '--pod-nav-item-text-hover-color',
  '--pod-nav-item-text-selected-color', '--pod-nav-menu-bg-hover-color', '--pod-nav-menu-bg-selected-color',
];
let directory;

beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oyd-app-style-')); });
afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

function planFor(themeId) {
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
  plan.visualStyle.forUser.selectedTheme = { themeId, source: 'user_selected', templatePath: loadThemeIndex().themes.find(theme => theme.themeId === themeId).templatePath };
  plan.pages.customPageDetails[0].pageSpecHandoff = { designRefs: ['themeProfile'] };
  return plan;
}

test('catalog separates the creative option from eighteen application presets', () => {
  expect(styles).toHaveLength(18);
  expect(catalog().creativeOption).toMatchObject({ themeId: 'free-creative', mode: 'creative' });
  expect(catalog().themes.some(theme => theme.mode === 'creative')).toBe(false);
  const layouts = new Set(styles.map(theme => JSON.parse(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.formLayoutPath), 'utf8'))[0].layout));
  expect(layouts.size).toBeGreaterThanOrEqual(5);
});

test('theme catalog separates content tone from navigation tone', () => {
  const presets = themeIndex.filter(theme => theme.mode !== 'creative');
  expect(presets.every(theme => ['light', 'dark'].includes(theme.contentTone))).toBe(true);
  expect(presets.every(theme => ['light', 'dark'].includes(theme.navTheme))).toBe(true);
  expect(themeIndex.find(theme => theme.themeId === 'dark-rail-fine-lines')).toMatchObject({
    contentTone: 'light', navTheme: 'dark',
  });
  expect(themeIndex.find(theme => theme.themeId === 'dark-inset-hairline')).toMatchObject({
    contentTone: 'dark', navTheme: 'dark',
  });
  expect(themeIndex.find(theme => theme.themeId === 'free-creative')).not.toHaveProperty('contentTone');
  expect(themeIndex.find(theme => theme.themeId === 'free-creative')).not.toHaveProperty('navTheme');
  const sourceProfiles = require('../yida-skills/skills/yida-design/templates/application-styles.json');
  expect(sourceProfiles.every(profile => !Object.prototype.hasOwnProperty.call(profile, 'dark'))).toBe(true);

  applicationStyles.filter(theme => theme.mode === 'template').forEach(theme => {
    const design = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8');
    expect(parseDesignDocument(design).metadata.themeProfile).toEqual({
      contentTone: theme.contentTone, navTheme: theme.navTheme,
    });
    expect(design).toContain(`当前模板使用 contentTone: ${theme.contentTone}、navTheme: ${theme.navTheme}`);
    expect(design).not.toContain('contentTone 决定页面、表单、详情和自定义页面的内容界面明暗');
  });
  const creative = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, applicationStyles.find(theme => theme.mode === 'creative').templatePath), 'utf8');
  expect(creative).toContain('在 themeProfile 中分别填写 contentTone 与 navTheme');
});

test('every named theme has its own complete platform navigation design and readable guidance', () => {
  const platformCss = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'references/theme/app-custom-theme-template.css'), 'utf8');
  const supported = new Set([...platformCss.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
  const palettes = new Set();
  const radii = new Set();
  const heights = new Set();
  themeIndex.filter(theme => theme.mode !== 'creative').forEach(theme => {
    const source = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8');
    const navigation = parseDesignDocument(source).metadata.tokens['application-global'].appearance.navigation;
    expect(theme.navigationSummary).toEqual(expect.any(String));
    expect(source).toContain(theme.navigationSummary);
    expect(source).toContain('导航与应用框架、表单、自定义页面和详情页共用设计语言');
    expect(source).not.toContain('原生导航仅配置上述开放颜色');
    Object.keys(navigation).forEach(token => expect(supported.has(token)).toBe(true));
    expect(Object.keys(navigation).length).toBeGreaterThanOrEqual(40);
    NAVIGATION_COLOR_TOKENS.forEach(token => expect(navigation[token]).toEqual(expect.any(String)));
    palettes.add(NAVIGATION_COLOR_TOKENS.map(token => navigation[token]).join('|'));
    radii.add(navigation['--pod-nav-menu-item-radius']);
    heights.add(navigation['--pod-nav-menu-item-height']);
    // Navigation overlays have their own surface, including dark-nav/light-content themes.
    expect(navigation['--pod-nav-popup-bg-color']).toBe('var(--pod-shell-theme-bg-color)');
    expect(navigation['--pod-nav-search-text-color']).toBe('var(--pod-nav-item-text-hover-color)');
    expect(navigation['--pod-nav-logo-icon']).toBe('var(--pod-nav-item-text-selected-color)');
  });
  expect(palettes.size).toBe(33);
  expect(radii.size).toBeGreaterThanOrEqual(8);
  expect(heights.size).toBeGreaterThanOrEqual(6);
});

test('application preset navigation text is readable in ordinary, hover and selected states', () => {
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const states = [
    ['--pod-nav-item-text-color', '--pod-shell-theme-bg-color'],
    ['--pod-nav-item-text-hover-color', '--pod-nav-menu-bg-hover-color'],
    ['--pod-nav-item-text-selected-color', '--pod-nav-menu-bg-selected-color'],
  ];
  styles.forEach(theme => {
    const navigation = parseDesignDocument(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8'))
      .metadata.tokens['application-global'].appearance.navigation;
    states.forEach(([foreground, background]) => {
      const values = [navigation[foreground], navigation[background]];
      values.forEach(value => expect(value).toMatch(/^#[\da-f]{6}$/i));
      const [a, b] = values.map(luminance);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    });
  });
});

test.each(themeIndex.filter(theme => theme.mode !== 'creative'))('$themeId bundles the same navigation values as its design source', theme => {
  const metadata = parseDesignDocument(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8')).metadata;
  const expected = metadata.tokens['application-global'].appearance.navigation;
  const css = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.cssTemplatePath), 'utf8')
    .replace(/\{\{PRIMARY_COLOR\}\}/g, '#123456');
  const blocks = [...css.matchAll(/(^:root|^\.pod-premium\.(?:nav|is)-(?:light|dark))\s*\{([^}]*)\}/gm)];
  const values = {};
  const read = body => Object.assign(values, Object.fromEntries([...body.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)]
    .map(match => [match[1], match[2].trim()])));
  blocks.filter(([, selector]) => selector === ':root').forEach(([, , body]) => read(body));
  blocks.filter(([, selector]) => [`.pod-premium.nav-${theme.navTheme}`, `.pod-premium.is-${theme.navTheme}`].includes(selector))
    .forEach(([, , body]) => read(body));
  expect(values).toMatchObject(expected);
});

test('all nineteen form-layout starters use supported types and direct capability language', () => {
  expect(applicationStyles).toHaveLength(19);
  const supportedTypes = new Set([...BUSINESS_FIELD_TYPES, ...PRESENTATION_FIELD_TYPES]);

  applicationStyles.forEach(style => {
    const design = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, style.templatePath), 'utf8');
    expect(design).toContain('表单支持');
    expect(design).toContain('普通业务分组和章节分隔使用 Divider');
    expect(design).toContain('横向字段组合使用 ColumnContainer');
    if (style.mode !== 'creative') {
      expect(design).toContain('### 材质与信息密度');
    }
    expect(design).not.toContain('### R1 组件区域与字段的关系');
    expect(design.match(/表单支持在顶部、左侧、主体、右侧和字段之间/g)).toHaveLength(1);
    expect(design).not.toMatch(/能力上限|暂未覆盖|设计契约|误判为自定义页面|先扩展 CLI|平台 Schema|原生 Schema|原生表单 Schema|表单 Schema 编辑能力|完整 Schema|由 Schema 发布/);
    const layout = JSON.parse(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, style.formLayoutPath), 'utf8'));
    const visit = value => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== 'object') {
        return;
      }
      if (value.type) {
        expect(supportedTypes.has(value.type)).toBe(true);
      }
      if (value.children) {
        visit(value.children);
      }
    };
    visit(layout);
  });
});

test('all nineteen application styles include complete custom-page guidance', () => {
  expect(applicationStyles).toHaveLength(19);
  applicationStyles.forEach(style => {
    const design = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, style.templatePath), 'utf8');
    expect(design).toContain('### 2.5 自定义页面设计');
    expect(design).toContain('### 自定义页面组件与交互');
    expect(design).toContain('页面任务、首屏焦点、布局、表面与组件、主操作、状态、响应式和验收');
    expect(design).toContain('列表、表格、图表、详情抽屉和表单入口');
    expect(design).toContain('YidaCodeCanvas');
    expect(design).toContain('应用全局样式统一作用于应用框架、表单、详情页和自定义页面等');
  });
});

test('all nineteen application styles define detail read-only field tokens and guidance', () => {
  expect(applicationStyles).toHaveLength(19);
  applicationStyles.forEach(style => {
    const design = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, style.templatePath), 'utf8');
    const metadata = parseDesignDocument(design).metadata;
    const nativeFormTokens = metadata.tokens['application-global'].appearance['native-form'];
    const css = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, style.cssTemplatePath), 'utf8');
    expect(design).toContain('详情页');
    expect(design).toContain('只读字段的数据框');
    DETAIL_FIELD_PREVIEW_TOKENS.forEach(token => {
      expect(nativeFormTokens[token]).toBeDefined();
      expect(css).toContain(`${token}:`);
    });
  });
});

test('all fifteen shared themes include native form layout and style guidance', () => {
  expect(sharedThemes).toHaveLength(15);
  sharedThemes.forEach(theme => {
    const design = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, theme.templatePath), 'utf8');
    expect(design).toContain('### 表单组件与版式结构');
    expect(design).toContain('表单使用与自定义页面相同的应用全局样式');
    expect(design).toContain('普通业务分组和章节分隔使用 `Divider`');
    expect(design).toContain('横向字段组合使用 `ColumnContainer`');
    expect(design).toContain('底栏、详情延续和窄屏重排');
  });
});

test('form skills describe component capabilities with direct instructions', () => {
  const files = [
    'yida-create-form-page/SKILL.md',
    'yida-create-form-page/references/form-field-properties.md',
    'yida-design/SKILL.md',
    'yida-design/references/native-form-styles.md',
    'yida-design/references/application-style-library.md',
  ];
  const capabilityFiles = files.filter(file => file !== 'yida-design/SKILL.md');
  const forbiddenCapabilityLanguage = /能力上限|能力边界|暂未覆盖|尚不支持某项表现|平台能力限制|不是完整视觉主题|只提交其已支持的类型|不代表平台 Schema|误判为自定义页面|先扩展 CLI|原生 Schema|原生表单 Schema|表单 Schema 编辑能力|完整 Schema|由 Schema 发布/;
  files.forEach(file => {
    const content = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, '..', file), 'utf8');
    expect(content).not.toMatch(forbiddenCapabilityLanguage);
  });
  capabilityFiles.forEach(file => {
    const content = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, '..', file), 'utf8');
    expect(content).toContain('表单支持');
  });
  expect(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, '..', 'yida-design/workflow/step-2-theme-system.md'), 'utf8'))
    .not.toMatch(forbiddenCapabilityLanguage);
  expect(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, '..', 'yida-create-form-page/references/field-definition-guide.md'), 'utf8'))
    .toContain('普通业务分组和章节分隔使用 `Divider`');
  const designSkill = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'SKILL.md'), 'utf8');
  const nativeFormStyles = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'references/native-form-styles.md'), 'utf8');
  expect(designSkill).toContain('应用包含表单或详情页时，读取 [表单风格规则]');
  expect(designSkill).not.toContain('表单支持在顶部、左侧、主体、右侧和字段之间放置');
  expect(nativeFormStyles).toContain('`--pod-field-preview-bg-color`');
  expect(nativeFormStyles).toContain('普通业务分组和章节分隔使用 `Divider`');
});

test.each(themeIndex.filter(theme => theme.mode !== 'creative').map(style => [style.themeId, style]))('%s pairs generate valid CSS and compile the form layout', (_id, style) => {
  const templateCss = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, style.cssTemplatePath), 'utf8');
  expect(templateCss).toContain('--color-brand1-6: {{PRIMARY_COLOR}};');
  expect(templateCss).toContain('--color-brand1-1: <生成实际色值：');
  const template = fs.readFileSync(path.join(DESIGN_SKILL_ROOT, style.templatePath), 'utf8');
  const design = resolveThemeColors(template.replace(/\{\{PRIMARY_COLOR\}\}/g, '#357942'));
  const css = applyDesignTokens(templateCss, design);
  expect(() => validateThemeCssContent(css)).not.toThrow();
  expect(css).not.toMatch(/\{\{|<生成实际色值：/);
  expect(css).toContain('--color-brand1-6: #357942;');
  if (style.collection === 'application-styles') {
    expect(css.match(/OPENYIDA APPLICATION STYLE RECIPES START/g)).toHaveLength(1);
  }
  const layout = JSON.parse(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, style.formLayoutPath), 'utf8'));
  expect(layout[0].children.every(column => column.length === 0)).toBe(true);
  if (['app-editorial', 'app-executive'].includes(style.themeId)) {
    expect(layout[0].layout).not.toBe('3:9');
  }
  // Populate a real business field: decorative components are not data fields.
  layout[0].children[layout[0].children.length - 1].push({ type: 'TextField', label: '申请事由', required: true });
  expect(() => form.validateFormFieldDefinitions(layout)).not.toThrow();
  const node = form.buildFormNodeComponent(layout[0]);
  expect(node.componentName).toBe('ColumnsLayout');
  expect(node.props).toMatchObject({ columnGap: layout[0].columnGap, rowGap: layout[0].rowGap, display: 'VERTICAL' });
  expect(node.children[node.children.length - 1].children[0].componentName).toBe('TextField');
});

test.each(styles.map(style => style.themeId))('%s survives Plan materialization and Fast regeneration', async themeId => {
  const input = path.join(directory, 'build-plan.json');
  fs.writeFileSync(input, JSON.stringify(planFor(themeId)));
  const result = materialize(input);
  const design = fs.readFileSync(result.outputs.design, 'utf8');
  const metadata = parseDesignDocument(design).metadata;
  expect(metadata.applicationStyle).toEqual({ recipe: 'application-style-v1', mode: 'template' });
  expect(metadata.themeProfile).toMatchObject({
    contentTone: themeIndex.find(theme => theme.themeId === themeId).contentTone,
    navTheme: themeIndex.find(theme => theme.themeId === themeId).navTheme,
  });
  const templateTokens = readDesignTokens(resolveThemeColors(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, themeIndex.find(theme => theme.themeId === themeId).templatePath), 'utf8').replace(/\{\{PRIMARY_COLOR\}\}/g, metadata.themeProfile.themeColor)));
  expect(readDesignTokens(design)['--pod-shell-theme-bg-color']).toBe(templateTokens['--pod-shell-theme-bg-color']);
  const fastOutput = path.join(directory, 'fast.css');
  await sample.run(['yida-design', 'app-theme', '--design-file', result.outputs.design, '--output', fastOutput]);
  expect(fs.readFileSync(fastOutput, 'utf8')).toBe(fs.readFileSync(result.outputs.theme, 'utf8'));
  expect(design).toContain('表单组件与版式结构');
  expect(design).toContain('普通业务分组和章节分隔使用 Divider');
  expect(design).toContain('横向字段组合使用 ColumnContainer');
});

test('export writes all three assets and refuses to overwrite authored work', async () => {
  const result = await sample.run(['yida-design', 'application-style', '--style-id', 'app-executive', '--output', directory]);
  expect(result.outputs.map(file => path.basename(file))).toEqual(['design.md', 'app_theme.css', 'form-layout.json']);
  fs.writeFileSync(result.outputs[0], 'authored work');
  expect(() => exportApplicationStyle('app-paper', directory)).toThrow();
  expect(fs.readFileSync(result.outputs[0], 'utf8')).toBe('authored work');
  expect(() => exportApplicationStyle('../outside', directory)).toThrow();
  await expect(sample.run(['yida-design', 'application-style', '--style-id', 'app-wire', '--design-file', 'ignored.md']))
    .rejects.toMatchObject({ code: 'APPLICATION_STYLE_SAMPLE_INVALID' });
});

test('every catalog entry exports exactly three files with unresolved project brand colors', () => {
  themeIndex.forEach(theme => {
    const output = path.join(directory, theme.themeId);
    exportApplicationStyle(theme.themeId, output);
    expect(fs.readdirSync(output).sort()).toEqual(['app_theme.css', 'design.md', 'form-layout.json']);
    expect(fs.readFileSync(path.join(output, 'app_theme.css'), 'utf8')).toContain('--color-brand1-6: {{PRIMARY_COLOR}};');
  });
});

test('exported CSS accepts a completed design through the CLI and follows later brand changes', async () => {
  exportApplicationStyle('dark-rail-fine-lines', directory);
  const cssFile = path.join(directory, 'app_theme.css');
  const designFile = path.join(directory, 'design.md');
  const template = fs.readFileSync(designFile, 'utf8');
  fs.appendFileSync(cssFile, '\n.project-note { padding: 7px; }\n');
  for (const color of ['#357942', '#936A21']) {
    const design = resolveThemeColors(template.replace(/\{\{PRIMARY_COLOR\}\}/g, color));
    fs.writeFileSync(designFile, design);
    await sample.run(['yida-design', 'app-theme', '--design-file', designFile, '--output', cssFile]);
    const css = fs.readFileSync(cssFile, 'utf8');
    const tokens = readDesignTokens(design);
    for (const name of ['--color-brand1-1', '--color-brand1-6']) {
      expect(css).toContain(`${name}: ${tokens[name]};`);
    }
    expect(css).not.toMatch(/\{\{|<生成实际色值：/);
    expect(css).toContain('.project-note { padding: 7px; }');
    expect(css).toContain('--pod-nav-menu-item-selected-shadow: inset 3px 0 0 var(--color-brand1-6);');
  }
});

test('historical theme paths resolve to the same design and mismatched paths remain invalid', () => {
  const { normalizePlan, renderDesign } = require('../lib/design-plan/materialize');
  const plan = planFor('soft-inset-surfaces');
  const current = renderDesign(plan);
  plan.visualStyle.forUser.selectedTheme.templatePath = 'templates/design-themes/soft-inset-surfaces.md';
  expect(renderDesign(plan)).toBe(current);
  const normalized = normalizePlan({ ...plan, schemaVersion: '2.0' });
  expect(normalized.visualStyle.internal.selectedTheme.templatePath).toBe('templates/design-themes/soft-inset-surfaces/design.md');
  plan.visualStyle.forUser.selectedTheme.templatePath = 'templates/design-themes/dark-inset-hairline.md';
  expect(() => renderDesign(plan)).toThrow();
});

test.each(['app-editorial', 'app-executive', 'free-creative'])('public CLI exports %s as field columns without a forced introduction', themeId => {
  const result = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, '../bin/yida.js'),
    'sample', 'yida-design', 'application-style', '--style-id', themeId, '--output', directory], {
    cwd: directory, encoding: 'utf8', env: { ...process.env, OPENYIDA_SKIP_UPDATE_CHECK: '1' },
  }));
  expect(result.success).toBe(true);
  const layout = JSON.parse(fs.readFileSync(path.join(directory, 'form-layout.json'), 'utf8'));
  expect(layout[0].children.every(column => column.length === 0)).toBe(true);
  expect(layout[0].layout).not.toBe('3:9');
});

test('a business-authored reference sidebar remains supported by the native compiler', () => {
  const layout = { type: 'ColumnContainer', layout: '3:9', columnGap: '24px', display: 'VERTICAL',
    children: [[{ type: 'Divider', title: '提交材料', description: '逐项核对盖章合同、报价单与验收记录。' }],
      [{ type: 'AttachmentField', label: '盖章合同' }]] };
  expect(() => form.validateFormFieldDefinitions([layout])).not.toThrow();
  const node = form.buildFormNodeComponent(layout);
  expect(node.componentName).toBe('ColumnsLayout');
  expect(JSON.stringify(node)).toContain('提交材料');
});

test('free creative rejects absent business decisions and explicit design tokens, then renders authored decisions', () => {
  const plan = planFor('free-creative');
  const input = path.join(directory, 'build-plan.json');
  fs.writeFileSync(input, JSON.stringify(plan));
  expect(() => materialize(input)).toThrow(/creativeDirection/);
  plan.visualStyle.creativeDirection = {
    businessRationale: '现场检查需要快速找到未完成事项，使用低干扰的工作面。',
    composition: '左侧窄目录、中央检查项、右侧证据摘要；抽屉合并为单列。',
    typography: '标题采用衬线，记录使用平台正文字体，编号按列对齐。',
    material: '暖灰画布、白色内容面、铜色细线，底栏使用相同纸面。',
    formLayout: '短字段双列、证据附件整行，字段间距24px，移动端单列。',
  };
  fs.writeFileSync(input, JSON.stringify(plan));
  expect(() => materialize(input)).toThrow(/--pod-page-bg-color/);
  const starter = readDesignTokens(resolveThemeColors(fs.readFileSync(path.join(DESIGN_SKILL_ROOT, 'templates/design-themes/free-creative/design.md'), 'utf8').replace(/\{\{PRIMARY_COLOR\}\}/g, '#685544')));
  plan.visualStyle.tokens = Object.fromEntries(CREATIVE_TOKENS.map(key => [key, starter[key]]));
  plan.visualStyle.tokens['--pod-page-bg-color'] = '#eee8df';
  Object.assign(plan.visualStyle.tokens, {
    '--pod-shell-theme-bg-color': '#302820', '--pod-nav-item-text-color': '#D5C9BA',
    '--pod-nav-item-text-hover-color': '#FAF0E4', '--pod-nav-item-text-selected-color': '#302820',
    '--pod-nav-menu-bg-hover-color': '#493C2F', '--pod-nav-menu-bg-selected-color': '#D5C9BA',
  });
  fs.writeFileSync(input, JSON.stringify(plan));
  const result = materialize(input);
  const design = fs.readFileSync(result.outputs.design, 'utf8');
  expect(parseDesignDocument(design).metadata.themeProfile).toMatchObject({ contentTone: 'light', navTheme: 'dark' });
  expect(design).toContain(plan.visualStyle.creativeDirection.businessRationale);
  expect(design).toContain(plan.visualStyle.creativeDirection.formLayout);
  expect(design).not.toMatch(/窄幅纸页|香槟金标题/);
  expect(fs.readFileSync(result.outputs.theme, 'utf8')).toContain('--pod-page-bg-color: #eee8df;');
  const { patchPlan } = require('../lib/design-plan/patch');
  patchPlan(input, ['visualStyle.forUser.navigationStyle.tone=light'], { materialize: true });
  const patchedDesign = parseDesignDocument(fs.readFileSync(result.outputs.design, 'utf8')).metadata;
  expect(patchedDesign.themeProfile.navTheme).toBe('light');
});

test('regeneration replaces only the managed recipe, preserving custom CSS', () => {
  const plan = planFor('app-editorial');
  const input = path.join(directory, 'build-plan.json');
  fs.writeFileSync(input, JSON.stringify(plan));
  const result = materialize(input);
  const design = fs.readFileSync(result.outputs.design, 'utf8');
  const css = fs.readFileSync(result.outputs.theme, 'utf8') + '\n.project-note { padding: 7px; }\n';
  const regenerated = applyDesignTokens(css, design, design);
  expect(regenerated).toContain('.project-note { padding: 7px; }');
  expect(regenerated.match(/OPENYIDA APPLICATION STYLE RECIPES START/g)).toHaveLength(1);
});
