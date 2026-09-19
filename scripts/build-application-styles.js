'use strict';

// Maintainer tool: materialize paired, reviewable assets from the shared platform
// contract. Runtime consumers use the checked-in assets, never this generator.
const fs = require('fs');
const path = require('path');
const { parseDesignDocument } = require('../lib/design/document');
const { resolveThemeColors } = require('../lib/design-plan/themes');
const { applyDesignTokens } = require('../lib/app/theme-from-design');
const root = path.resolve(__dirname, '../yida-skills/skills/yida-design');
const directory = path.join(root, 'templates/design-themes');
const profiles = require('../yida-skills/skills/yida-design/templates/application-styles.json');
const base = parseDesignDocument(fs.readFileSync(path.join(directory, 'dark-inset-hairline.md'), 'utf8'));
const platformCss = fs.readFileSync(path.join(root, 'references/theme/app-custom-theme-template.css'), 'utf8');
const index = JSON.parse(fs.readFileSync(path.join(directory, 'index.json'), 'utf8'));
index.description = '共享主题与应用风格目录：摘要用于选型，路径用于读取配对资产；mode=creative 是独立业务推演入口，不是视觉预设。';
index.themes = index.themes.filter(theme => theme.collection !== 'application-styles');

function yaml(value, depth = 0) {
  return Object.entries(value).map(([key, item]) => {
    const prefix = `${'  '.repeat(depth)}${key.startsWith('--') ? JSON.stringify(key) : key}:`;
    return item && typeof item === 'object' ? `${prefix}\n${yaml(item, depth + 1)}` : `${prefix} ${JSON.stringify(String(item))}`;
  }).join('\n');
}

for (const profile of profiles) {
  const { id, label, ink, canvas, surface, border, radius, height, width, padding, gap, columns, intro, composition, material, scenario, accent, dark } = profile;
  const metadata = JSON.parse(JSON.stringify(base.metadata));
  metadata.themeId = id;
  metadata.applicationStyle = { recipe: 'application-style-v1', mode: profile.mode || 'template' };
  metadata.description = `${composition}；${material}。${scenario}`;
  const global = metadata.tokens['application-global'];
  const replace = {
    '--pod-app-root-bg-color': canvas, '--pod-app-root-bg-image': profile.background || 'none',
    '--pod-page-bg-color': canvas, '--pod-card-bg-color': surface,
    '--pod-shell-theme-bg-color': surface, '--pod-nav-item-text-color': ink,
    '--pod-nav-item-text-hover-color': ink, '--pod-nav-item-text-selected-color': ink,
    '--pod-nav-menu-bg-hover-color': canvas, '--pod-nav-menu-bg-selected-color': canvas,
    '--color-line1-1': border, '--color-line1-2': border,
    '--color-fill1-1': canvas, '--color-fill1-2': canvas, '--color-fill1-3': border,
    '--color-fill1-5': surface,
    '--color-text1-4': ink, '--color-text1-10': ink,
    '--color-text1-3': profile.muted || ink, '--color-text1-2': dark ? '#7f8986' : '#858781',
    '--color-text1-1': border,
  };
  const rewrite = node => {
    for (const [key, value] of Object.entries(node)) {
      if (key in replace) {node[key] = replace[key];}
      else if (value && typeof value === 'object') {rewrite(value);}
    }
  };
  rewrite(global);
  global.appearance['native-form'] = {
    '--form-element-medium-corner': `${radius}px`, '--form-element-medium-height': `${height}px`,
    '--form-element-medium-font-size': '14px', '--input-bg-color': surface,
    '--input-border-width': `${profile.stroke || 1}px`, '--input-border-color': border,
    '--input-hover-border-color': 'var(--color-brand1-6)', '--input-focus-border-color': 'var(--color-brand1-6)',
    '--input-hover-bg-color': surface, '--input-focus-bg-color': surface,
    '--pod-form-label-color': ink, '--form-top-label-margin-b': `${profile.labelGap || 8}px`,
    '--yida-form-content-bgcolor': surface, '--pod-page-content-max-width': `${width}px`,
    '--pod-page-border-radius': `${radius}px`, '--pod-page-footer-bg-color': surface,
    '--pod-page-footer-border-radius': `${radius}px`, '--pod-sticky-footer-box-shadow': profile.shadow || 'none',
    '--pod-formView-stickyFooter-bg-color': canvas, '--pod-formView-stickyFooter-box-shadow': 'none',
    '--pod-formView-stickyFooter-border': 'none', '--pod-formView-stickyFooter-border-top': `1px solid ${border}`,
    '--pod-formView-stickyFooter-height': '56px', '--pod-formView-stickyFooter-bottom': '8px',
    '--pod-field-preview-text-color': ink, '--pod-field-preview-bg-color': surface,
    '--pod-field-preview-border-radius': `${radius}px`, '--pod-field-preview-padding': '8px 12px',
    '--pod-field-preview-shadow': 'none',
  };
  metadata.tokens['custom-page'] = {
    '--oyd-page-bg': 'var(--pod-page-bg-color)', '--oyd-surface': 'var(--pod-card-bg-color)',
    '--oyd-canvas-image': 'var(--pod-app-root-bg-image)',
    '--oyd-ink': 'var(--color-text1-4)', '--oyd-border': 'var(--color-line1-2)',
    '--oyd-accent': 'var(--color-brand1-6)', '--oyd-radius': `${radius}px`,
    '--oyd-content-width': `${width}px`, '--oyd-content-padding': `${padding}px`,
    '--oyd-field-gap': `${gap}px`, '--oyd-section-gap': `${gap * 2}px`,
    '--oyd-heading-font': profile.headingFont || profile.font || 'var(--font-family-base)',
    '--oyd-heading-size': `${profile.headingSize || 32}px`, '--oyd-rule-style': profile.rule || 'solid',
    '--oyd-layout-columns': profile.rail ? 'minmax(180px, 1fr) minmax(0, 3fr)' : columns.split(':').map(span => `minmax(0, ${span}fr)`).join(' '),
    '--oyd-surface-shadow': profile.shadow || 'none',
  };
  const free = profile.mode === 'creative';
  let body = `# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**${label}**

${free ? '这是业务推演的空白设计契约，不是视觉预设。先从使用者、任务频率、内容结构、品牌和环境推导两个有差异的方向，再形成自己的构图、材质、字体和密度。以下基础值仅让平台结构可解析，交付前必须用自主推导的设计值替换；不继承任何命名风格。' : metadata.description}

应用、自定义页面、原生表单、编辑与详情共用这一套视觉语言。业务内容来自 PRD，不复制示例行业、编号、标题或数据。色彩来源：{{COLOR_SOURCE}}；主色由 {{PRIMARY_COLOR}} 实例化，示范配色只是参考。

## 2. 页面视觉系统

### 2.1 表面、区块与层次

${composition}。${material}。画布消费 --oyd-page-bg，内容消费 --oyd-surface，文字消费 --oyd-ink，边界消费 --oyd-border。内容最大宽度 --oyd-content-width，内距 --oyd-content-padding；宽屏不放大成空白 KPI 卡。

### 2.2 应用导航

${profile.navigation || '平台侧导航与内容表面保持连续；选中项用品牌色和明确文字，不靠图标猜测。'} 默认保留平台导航，菜单来自真实业务范围。只有需求确定自绘导航时才在 Canvas 实现结构。导航深浅与正文深浅分别决定。

### 2.3 页面标题与操作

${intro}。标题字体消费 --oyd-heading-font 与 --oyd-heading-size，辅助说明按正文层级。主操作与当前任务相邻；不堆造虚假标签、指标或章号。

### 2.4 布局和移动端

桌面业务工作区：${profile.workspace || composition}。短字段建议 ${columns}，字段间距 ${gap}px、章节间距 ${gap * 2}px、内容内距 ${padding}px；这些是项目起点，必须在每张表单设计中按字段长度确定。窄屏与半屏抽屉优先单列，介绍区在字段前面；长文本、附件和子表占整行。不把屏幕断点当 iframe 宽度，不用 fixed 卡片截断自然内容。

## 3. 基础组件表达

### 表单、表格与记录集合

单行控件 ${height}px、圆角 ${radius}px，边框 ${profile.stroke || 1}px；字段 labelAlign=${['app-finance', 'app-ticket', 'app-graphite'].includes(id) ? 'left（横向标签，长标签换行；窄屏回到顶部）' : 'top（标签在字段上方）'}。多行文本、附件、日期范围、子表按自身布局。详情使用相同章节顺序与表面，保留只读语义。表格为有真实数据的紧凑记录集合，不能给每个单元格加独立大卡。按钮、输入、浮层和导航消费同源色彩与形状。

### 原生结构与介绍区

${intro}。原生表单用 ColumnContainer 的 ${profile.rail ? '3:9 外层承载介绍和字段，右列再按业务分栏' : columns + ' 栏比例承载业务字段'}；columnGap=${gap}px、rowGap=${gap}px、display=VERTICAL。介绍标题、说明由 Divider 的 title/description 承载，章节同样用 Divider；有语义的文案不能放到 CSS content。模板附有 form-layout.json，只示范结构，不创建虚假业务字段。若当前平台 Divider 不支持所需长说明或标题排版，降级成顶部标题说明并记录限制，不注入 HTML/JS。自定义页面可用语义 HTML 丰富同一版式。

### 组件状态

默认/hover/focus 同时配置边界和表面；键盘焦点保持可见。错误、警告、禁用沿用平台独立语义，不能被通用强调色覆盖；不得以全局 input 或 .next-* 强制改所有控件。表单样式由应用 CSS 发布，原生布局由 Schema 发布，禁止 didMount、style 标签或 iframe 跨文档注入。

### 底栏与对齐

普通提交按钮区使用 --pod-page-footer-bg-color 与 --pod-sticky-footer-box-shadow；数据管理、抽屉详情外层使用 --pod-formView-stickyFooter-bg-color 与 --pod-formView-stickyFooter-box-shadow。本风格按钮区跟随内容面，外层跟随画布，不叠加双阴影。底栏与正文共同消费 --pod-page-content-max-width。导航、无导航、管理内嵌、抽屉、移动端分别检查，不能全局覆盖 stickyFooter 的宽度与定位。

## 4. 特色表达配方

### R1 介绍与正文的关系

${intro}。应用首页、内容详情与表单使用同一标题语法；只有任务确需上下文时展示介绍区。原生场景使用 form-layout.json，自定义页面可用 .oyd-style-intro 与 .oyd-style-section；外层 .oyd-style-workspace 中用 .oyd-style-layout 消费列比例，全宽区使用 .oyd-style-wide。介绍栏方案将介绍和正文作为网格的两个子项。伪元素只画空的装饰线，不承载可读内容。窄容器回到纵向阅读。

### R2 材质与信息密度

${material}。${profile.workspace || composition}。图表、图片、时间线只为真实内容出现；没有媒体时以排版与章节构图成立，不为“丰富”捏造指标或入口。

## 5. 项目应用与调整规则

YAML Token 是唯一数值源。${free ? '必须记录业务推演依据，并自主决定画布、内容面、标题、线条、密度、表单列数和底栏；禁止拿其他模板改名冒充自由创意。' : '保留构图与材质语言，按业务调整主色、字段分组及信息密度；模板不是行业限制。'}

按每页写清页面任务、首屏焦点、布局、表面与组件、主操作、空/载/错态、响应式与验收。表单额外写列比例、标签位置、内距、字段与章节间距、介绍区位置和详情延续方式。原生 Schema 不会由 design.md 自动生成：实施时消费附带布局起点并填入真实字段；设计验收须比较 Schema 与设计。

{{PAGE_APPLICATIONS}}

### 验收

- [ ] 应用壳、Canvas、原生表单与详情的字体、线条、材质和状态一致。
- [ ] 正文与底栏对齐；四类容器与移动端无横向溢出。
- [ ] 文字/焦点/禁用/错误在实际背景上可辨，长说明与表格未裁切。
- [ ] 原生布局与逐页设计一致；没有加载代码、伪元素文案或 iframe 注入。
`;
  if (free) {
    body = `# {{PROJECT_NAME}} design.md

## 1. 风格摘要

自由创意：从业务任务、用户、品牌和内容结构独立推演，不选择命名模板。此文件仅提供平台 Token 契约，最终设计必须由 creativeDirection 与项目 Token 决定。

## 2. 页面视觉系统

### 2.2 应用导航

按业务确定导航、标题、内容构图、材质和密度。主色 {{PRIMARY_COLOR}}；色彩来源 {{COLOR_SOURCE}}。

## 3. 基础组件表达

应用、Canvas、自定义页面、原生表单与详情共用字体、材质、状态和间距体系。表单结构使用原生 Schema，禁止加载代码注入。

## 4. 特色表达配方

由真实任务推导介绍区、章节、图表和记录集合，不复用命名模板配方。不添加无业务意义的指标或装饰文案。

## 5. 项目应用与调整规则

逐页记录布局、表单列比例、字段间距、响应式与验收。原生 Schema 与设计分别交付并核对，footer 背景和阴影必须是显式决策。

{{PAGE_APPLICATIONS}}
`;
  }
  const markdown = `---\n${yaml(metadata)}\n---\n${body}`;
  const folder = path.join(directory, id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'design.md'), markdown);
  const resolved = resolveThemeColors(markdown.replace(/\{\{PRIMARY_COLOR\}\}/g, accent));
  fs.writeFileSync(path.join(folder, 'app_theme.css'), free ? '/* Free creative: author design.md before generating the project CSS. */\n' + platformCss : applyDesignTokens(platformCss, resolved));
  const divider = { type: 'Divider', title: '填写真实业务标题', description: '填写这项业务的用途、要求或材料说明', colorType: 'theme', titleColor: 'var(--pod-form-label-color)', backgroundColor: 'var(--color-brand1-6)', secondaryColor: 'var(--color-line1-1)' };
  const layout = { type: 'ColumnContainer', layout: profile.rail ? '3:9' : columns, columnGap: `${gap}px`, rowGap: `${gap}px`, display: 'VERTICAL', mobileRowGap: `${gap}px`, children: [] };
  layout.children = profile.rail ? [[divider], []] : columns.split(':').map((_, index) => index ? [] : [divider]);
  fs.writeFileSync(path.join(folder, 'form-layout.json'), JSON.stringify([layout], null, 2) + '\n');
  index.themes.push({ themeId: id, label, mode: profile.mode || 'template', collection: 'application-styles', templatePath: `templates/design-themes/${id}/design.md`, cssTemplatePath: `templates/design-themes/${id}/app_theme.css`, formLayoutPath: `templates/design-themes/${id}/form-layout.json`, previewPrimaryColor: accent, styleSummary: metadata.description });
}
fs.writeFileSync(path.join(directory, 'index.json'), JSON.stringify(index, null, 2) + '\n');
