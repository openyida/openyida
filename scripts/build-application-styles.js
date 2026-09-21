'use strict';

// Maintainer tool: materialize paired, reviewable assets from the shared platform
// contract. Runtime consumers use the checked-in assets, never this generator.
const fs = require('fs');
const path = require('path');
const { parseDesignDocument } = require('../lib/design/document');
const { resolveThemeColors } = require('../lib/design-plan/themes');
const { applyDesignTokens, readDesignTokens } = require('../lib/app/theme-from-design');
const root = path.resolve(__dirname, '../yida-skills/skills/yida-design');
const directory = path.join(root, 'templates/design-themes');
const profiles = require('../yida-skills/skills/yida-design/templates/application-styles.json');
const navigationStyles = require('../yida-skills/skills/yida-design/templates/navigation-styles.json');
const base = parseDesignDocument(fs.readFileSync(path.join(directory, 'dark-inset-hairline/design.md'), 'utf8'));
const platformCss = fs.readFileSync(path.join(root, 'references/theme/app-custom-theme-template.css'), 'utf8');
const index = JSON.parse(fs.readFileSync(path.join(directory, 'index.json'), 'utf8'));
index.description = '共享主题与应用风格目录；主题明暗双轴定义见 references/application-style-library.md，mode=creative 是独立业务推演入口。';
index.themes = index.themes.filter(theme => theme.collection !== 'application-styles');

function navigationTokens(style, navTheme) {
  const { palette: p, radius, itemHeight, gap, selectedWeight, popupShadow } = style;
  const ref = name => `var(--pod-${name})`;
  return {
    '--pod-shell-theme-bg-color': p.background,
    '--pod-nav-item-text-color': p.text,
    '--pod-nav-item-text-hover-color': p.hoverText,
    '--pod-nav-item-text-selected-color': p.selectedText,
    '--pod-nav-menu-bg-hover-color': p.hoverBackground,
    '--pod-nav-menu-bg-selected-color': p.selectedBackground,
    '--pod-nav-menu-item-selected-shadow': style.selectedShadow || 'none',
    '--pod-page-header-bg-color': ref('shell-theme-bg-color'),
    '--pod-nav-l-sub-main-bg-color': ref('shell-theme-bg-color'),
    '--pod-nav-top-main-border-width': style.stroke ? `${style.stroke}px` : '1px',
    '--pod-nav-top-main-border-color': p.border,
    '--pod-nav-top-tab-indicator-width': `${style.topIndicatorWidth || 0}px`,
    '--pod-nav-logo-text': ref('nav-item-text-hover-color'),
    '--pod-nav-logo-bg': ref('nav-menu-bg-selected-color'),
    '--pod-nav-logo-icon': ref('nav-item-text-selected-color'),
    '--pod-nav-logo-border': `1px solid ${p.border}`,
    '--pod-nav-logo-border-radius': `${radius}px`,
    '--pod-nav-sub-divider-color': p.border,
    '--pod-nav-item-text-disabled-color': navTheme === 'dark' ? 'rgba(255,255,255,.30)' : 'rgba(24,28,31,.30)',
    '--pod-nav-l-container-bg': ref('shell-theme-bg-color'),
    '--pod-nav-l-group-label-color': ref('nav-item-text-color'),
    '--pod-nav-l-search-border-color': p.border,
    '--pod-nav-popup-bg-color': ref('shell-theme-bg-color'),
    '--pod-nav-popup-border-radius': `${radius}px`,
    '--pod-nav-popup-shadow': popupShadow,
    '--pod-nav-tab-line-hover-color': ref('nav-item-text-hover-color'),
    '--pod-nav-tab-line-selected-color': ref('nav-item-text-hover-color'),
    '--pod-nav-search-bg-color': ref('nav-menu-bg-hover-color'),
    '--pod-nav-search-bg-hover-color': ref('nav-menu-bg-hover-color'),
    '--pod-nav-search-bg-active-color': ref('nav-menu-bg-hover-color'),
    '--pod-nav-search-placeholder-color': ref('nav-item-text-color'),
    '--pod-nav-search-text-color': ref('nav-item-text-hover-color'),
    '--pod-nav-search-icon-color': ref('nav-item-text-color'),
    '--pod-nav-search-border-color': p.border,
    '--pod-nav-search-border-hover-color': ref('nav-item-text-hover-color'),
    '--pod-nav-search-border-active-color': ref('nav-item-text-hover-color'),
    '--pod-nav-action-icon-color': ref('nav-item-text-color'),
    '--pod-nav-action-border-color': p.border,
    '--pod-nav-action-border': `1px solid ${p.border}`,
    '--pod-nav-action-bg-hover-color': ref('nav-menu-bg-hover-color'),
    '--pod-nav-action-bg-active-color': ref('nav-menu-bg-hover-color'),
    '--pod-nav-menu-item-height': `${itemHeight}px`,
    '--pod-nav-menu-item-radius': style.menuRadius || `${radius}px`,
    '--pod-nav-menu-item-border': style.menuBorder || 'none',
    '--pod-nav-menu-item-hover-border': style.menuHoverBorder || style.menuBorder || 'none',
    '--pod-nav-menu-item-selected-border': style.menuSelectedBorder || style.menuBorder || 'none',
    '--pod-nav-menu-font-size': '14px',
    '--pod-nav-menu-item-selected-font-weight': String(selectedWeight),
    '--pod-nav-menu-line-height': '20px',
    '--pod-nav-menu-gap': `${gap}px`,
    '--pod-shell-lshape-border-radius': `${radius}px`,
    ...style.tokens,
  };
}

function navigationGuidance(style) {
  return `${style.summary}

菜单轮廓使用 --pod-nav-menu-item-radius、--pod-nav-menu-item-border、--pod-nav-menu-item-hover-border、--pod-nav-menu-item-selected-border。侧栏和顶部菜单共用轮廓，各状态保持相同边框宽度，文字位置稳定；具体数值以本项目 Token 为准。${style.example ? `\n\n导航示例：${style.example} 实际导航布局沿用业务规划。` : ''}

导航与应用框架、表单、自定义页面和详情页共用设计语言。先按业务入口安排菜单、分组、搜索、品牌区与常用操作，再一起确定导航与正文的明暗、表面、字体、边界、圆角和密度。平台导航使用真实页面菜单；自绘导航按同一套导航 Token 实现。命名模板沿用自身 navTheme，换主色保持导航明暗与内容画布；需要另一导航明暗时改选主题，自由创意按项目明确设计。

导航底色使用 --pod-shell-theme-bg-color；普通、悬停和选中文字分别使用 --pod-nav-item-text-color、--pod-nav-item-text-hover-color、--pod-nav-item-text-selected-color；悬停和选中背景使用 --pod-nav-menu-bg-hover-color、--pod-nav-menu-bg-selected-color。图标跟随对应文字状态，当前入口同时用背景或字重表达。

菜单高度、圆角与间距使用 --pod-nav-menu-item-height、--pod-nav-menu-item-radius、--pod-nav-menu-gap；搜索、品牌区、分组、操作和弹出菜单使用 navigation 分组中的对应 Token。弹出菜单的底色、文字与搜索状态成组配套，导航与内容可以分别选择明暗。选中项使用 --pod-nav-menu-item-selected-shadow：none 关闭额外标记，完整 box-shadow 值可表达左、右或底部内阴影，不占据菜单布局空间；该 Token 独立于导航明暗。菜单高度、文字行高、内距和框架留白一起调整，给外阴影、长标题与键盘焦点留出空间。

桌面检查菜单、搜索、选中态与表单的协调；折叠后保留可识别图标和入口名称；窄屏保持菜单可展开、当前页面可定位、键盘焦点可见。提交、编辑、详情与自定义页都沿用这一导航设计。`;
}

function yaml(value, depth = 0) {
  return Object.entries(value).map(([key, item]) => {
    const prefix = `${'  '.repeat(depth)}${key.startsWith('--') ? JSON.stringify(key) : key}:`;
    return item && typeof item === 'object' ? `${prefix}\n${yaml(item, depth + 1)}` : `${prefix} ${JSON.stringify(String(item))}`;
  }).join('\n');
}

function cssTemplate(markdown) {
  // Resolve only to reuse the platform's scope/recipe writer, then restore every
  // project-dependent value. The temporary seed never becomes a template default.
  const metadata = parseDesignDocument(markdown).metadata;
  if (metadata.applicationStyle?.mode === 'creative') {delete metadata.applicationStyle;}
  const source = `---\n${yaml(metadata)}\n---\n`;
  const resolved = resolveThemeColors(source.replace(/\{\{PRIMARY_COLOR\}\}/g, '#2C73A9'));
  const before = {};
  const collect = node => Object.entries(node).forEach(([key, value]) => {
    if (key.startsWith('--')) {before[key] = String(value);}
    else if (value && typeof value === 'object') {collect(value);}
  });
  collect(metadata.tokens);
  const after = readDesignTokens(resolved);
  const replacements = Object.entries(before)
    .filter(([, value]) => /\{\{PRIMARY_COLOR\}\}|<生成实际色值：/.test(value))
    .map(([name]) => [after[name], `var(${name})`]).sort((a, b) => b[0].length - a[0].length);
  const values = new Map(replacements);
  values.set(after['--color-brand1-6'], 'var(--color-brand1-6)');
  const pattern = new RegExp([...values.keys()].map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  return applyDesignTokens(platformCss, resolved)
    .replace(/^(\s*(--[\w-]+)\s*:\s*)([^;\n]+);/gm, (_, prefix, name, value) =>
      `${prefix}${value.trim() === after[name] && /\{\{|<生成实际色值：/.test(before[name] || '')
        ? before[name] : value.replace(pattern, color => values.get(color))};`)
    .replace('本模板默认品牌种子为 coffee 咖啡色；最终配色和圆角以 design.md 的 tokens 为准。',
      '品牌值保留项目占位和派生说明；先完成 design.md，再生成实际主题 CSS。');
}

// Shared themes retain their distinct compositions and original palettes. Only
// their navigation block is materialized, leaving authored prose and comments intact.
for (const theme of index.themes) {
  const style = navigationStyles[theme.themeId];
  if (!style) {throw new Error(`主题 ${theme.themeId} 缺少导航设计`);}
  const file = path.join(root, theme.templatePath);
  const navigation = yaml(navigationTokens(style, theme.navTheme), 4);
  const source = fs.readFileSync(file, 'utf8')
    .replace(/ {6}navigation:[^\n]*\n[\s\S]*?(?= {4}colors:)/, `      navigation:\n${navigation}\n`)
    .replace(/appearance: #[^\n]*/, 'appearance: # 应用外观：应用背景、内容表面与完整导航设计')
    .replace(/### 2\.2 应用导航\n[\s\S]*?(?=### 2\.3 )/, `### 2.2 应用导航\n\n${navigationGuidance(style)}\n\n`);
  fs.writeFileSync(file, source);
  fs.writeFileSync(path.join(path.dirname(file), 'app_theme.css'), cssTemplate(source));
  theme.navigationSummary = style.summary;
}

for (const profile of profiles) {
  const { id, label, ink, canvas, surface, border, radius, height, width, padding, gap, columns, intro, composition, material, scenario, accent } = profile;
  const free = profile.mode === 'creative';
  const contentTone = profile.contentTone || (free ? 'project-defined' : 'light');
  const navTheme = profile.navTheme || (free ? 'project-defined' : 'light');
  if (!['light', 'dark', 'project-defined'].includes(contentTone) || !['light', 'dark', 'project-defined'].includes(navTheme)
    || (!free && (contentTone === 'project-defined' || navTheme === 'project-defined'))) {
    throw new Error(`应用风格 ${id} 的 contentTone/navTheme 配置无效`);
  }
  const navigationStyle = navigationStyles[id];
  if (!free && !navigationStyle) {throw new Error(`应用风格 ${id} 缺少导航设计`);}
  const metadata = JSON.parse(JSON.stringify(base.metadata));
  metadata.themeId = id;
  delete metadata.navTheme;
  metadata.applicationStyle = { recipe: 'application-style-v1', mode: profile.mode || 'template' };
  if (!free) {metadata.themeProfile = { contentTone, navTheme };}
  metadata.description = `${composition}；${material}。${scenario}`;
  const global = metadata.tokens['application-global'];
  const replace = {
    '--pod-app-root-bg-color': canvas, '--pod-app-root-bg-image': profile.background || 'none',
    '--pod-page-bg-color': canvas, '--pod-card-bg-color': surface,
    '--color-line1-1': border, '--color-line1-2': border,
    '--color-fill1-1': canvas, '--color-fill1-2': canvas, '--color-fill1-3': border,
    '--color-fill1-5': surface,
    '--color-text1-4': ink, '--color-text1-10': ink,
    '--color-text1-3': profile.muted || ink, '--color-text1-2': contentTone === 'dark' ? '#7f8986' : '#858781',
    '--color-text1-1': border,
  };
  const rewrite = node => {
    for (const [key, value] of Object.entries(node)) {
      if (key in replace) {node[key] = replace[key];}
      else if (value && typeof value === 'object') {rewrite(value);}
    }
  };
  rewrite(global);
  global.appearance.navigation = free ? {} : navigationTokens(navigationStyle, navTheme);
  // Creative values are a writing skeleton. Projects explicitly design these
  // roles; they do not inherit the base theme's palette or material.
  if (free) {
    global.appearance.navigation = navigationTokens({
      palette: { background: '#FFFFFF', text: '#404040', hoverText: '#171717', selectedText: '#FFFFFF', hoverBackground: '#F0F0F0', selectedBackground: '#303030', border: '#CCCCCC' },
      radius: 4, itemHeight: 40, gap: 8, selectedWeight: 500, popupShadow: 'none',
    }, 'light');
  }
  for (const key of Object.keys(global.rounded)) {
    if (/^--corner-[1-5]$/.test(key)) {global.rounded[key] = `${radius}px`;}
  }
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
    '--pod-field-preview-min-height': '32px', '--pod-field-preview-padding': '8px 12px',
    '--pod-field-preview-gap': '4px', '--pod-field-preview-bg-color': surface,
    '--pod-field-preview-border-radius': `${radius}px`,
    '--pod-field-preview-indicator-color': 'var(--color-fill1-3)', '--pod-field-preview-shadow': 'none',
    '--pod-field-preview-text-color': ink, '--pod-field-preview-line-height': '20px',
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
  let body = `# {{PROJECT_NAME}} design.md

## 1. 风格摘要

**${label}**

${free ? '自由创意从使用者、任务频率、内容结构、品牌和环境推导两个有差异的方向，再确定构图、材质、字体和密度。交付前用项目设计值替换全部基础值。' : metadata.description}

导航、应用框架、自定义页面、表单、编辑与详情共用这一套视觉语言。业务内容来自 PRD，按实际行业、页面标题和数据设计。色彩来源：{{COLOR_SOURCE}}；主色由 {{PRIMARY_COLOR}} 实例化，品牌悬停色按同源占位说明生成；模板不固定项目品牌色。

## 2. 页面视觉系统

### 2.1 表面、区块与层次

${composition}。${material}。画布消费 --oyd-page-bg，内容消费 --oyd-surface，文字消费 --oyd-ink，边界消费 --oyd-border。内容最大宽度 --oyd-content-width，内距 --oyd-content-padding；宽屏不放大成空白 KPI 卡。

### 2.2 应用导航

${free ? '' : navigationGuidance(navigationStyle)} 当前模板使用 contentTone: ${contentTone}、navTheme: ${navTheme}。

### 2.3 页面标题与操作

${intro}。标题字体消费 --oyd-heading-font 与 --oyd-heading-size，辅助说明按正文层级。主操作与当前任务相邻；不堆造虚假标签、指标或章号。

### 2.4 布局和移动端

桌面业务工作区：${profile.workspace || composition}。短字段建议 ${columns}，字段间距 ${gap}px、章节间距 ${gap * 2}px、内容内距 ${padding}px；这些是项目起点，必须在每张表单设计中按组件树和字段长度确定。窄屏与半屏抽屉按实际可用宽度重排顶部、左侧、主体、右侧及字段间区域，侧栏组件可移到主体前后或折叠为合适的窄屏结构；长文本、附件和子表通常占整行。不把屏幕断点当 iframe 宽度，不用 fixed 卡片截断自然内容。

### 2.5 自定义页面设计

自定义页面以 ${composition} 组织真实业务内容，以 ${intro} 建立标题与首屏焦点，并用 ${material} 统一页面表面。页面根据 PRD 安排标题与操作区、状态摘要、筛选、主要内容、上下文信息和反馈区；列表、表格、图表、详情抽屉和表单入口只在业务需要时出现。宽度、列数、高度和滚动方式按内容增长确定，移动端按阅读与操作顺序重排。

每个自定义页面逐页写清页面任务、首屏焦点、布局、表面与组件、主操作、状态、响应式和验收。状态覆盖加载、空、错误和无权限反馈及恢复动作；页面使用全局主题 token 落实当前风格，并为键盘焦点、纯图标按钮、非颜色状态表达和 reduced motion 提供可执行规则。

## 3. 基础组件表达

### 自定义页面组件与交互

页面标题、筛选、主操作、状态摘要、列表、表格、图表、详情抽屉和表单入口按真实任务组合。标题与操作保持清楚的主次和对齐；列表、表格与图表使用稳定容器高度或自然增长规则；详情抽屉保留上下文并提供明确返回路径。默认、hover、active、focus、loading、empty、error、disabled 和 selected 状态使用同一套表面、边界、文字与状态语义。

\`YidaCodeCanvas\` 页面在 \`YidaComp\` 内消费 --oyd-page-bg、--oyd-surface、--oyd-ink、--oyd-border、--oyd-accent、--oyd-radius、--oyd-content-width、--oyd-content-padding、--oyd-section-gap 和其他已声明 token。页面局部 CSS 只负责当前组件的布局和特色表达；应用全局样式统一作用于应用框架、表单、详情页和自定义页面等。

### 表单、表格与记录集合

单行控件 ${height}px、圆角 ${radius}px，边框 ${profile.stroke || 1}px；字段 labelAlign=${['app-finance', 'app-ticket', 'app-graphite'].includes(id) ? 'left（横向标签，长标签换行；窄屏回到顶部）' : 'top（标签在字段上方）'}。多行文本、附件、日期范围、子表按自身布局。详情页沿用相同章节顺序与表面；只读字段的数据框使用 --pod-field-preview-bg-color、--pod-field-preview-border-radius、--pod-field-preview-shadow、--pod-field-preview-indicator-color、--pod-field-preview-text-color、--form-element-medium-font-size、--pod-field-preview-gap、--pod-field-preview-line-height、--pod-field-preview-min-height 和 --pod-field-preview-padding，延续应用的色彩、形状、字体与密度。表格保持紧凑，按钮、输入、浮层和导航消费同源色彩与形状。

### 表单组件与版式结构

表单支持在顶部、左侧、主体、右侧和字段之间放置分栏、Divider、图片/图形、Tab/切换、按钮组/操作入口、状态区和字段。各组件分别承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 Divider，横向字段组合使用 ColumnContainer。form-layout.json 提供 ${columns} 空字段列，columnGap=${gap}px、rowGap=${gap}px、display=VERTICAL；按任务与容器宽度补充组件并调整布局。不因主题名称自动套 3:9，不重复已有标题，不用空泛文案凑版式。

### 组件状态

默认/hover/focus 同时配置边界和表面；键盘焦点保持可见。错误、警告、禁用沿用平台独立语义，不能被通用强调色覆盖；不得以全局 input 或 .next-* 强制改所有控件。应用 CSS 配置表单、编辑和详情的视觉样式。

### 底栏与对齐

普通提交按钮区使用 --pod-page-footer-bg-color 与 --pod-sticky-footer-box-shadow；数据管理、抽屉详情外层使用 --pod-formView-stickyFooter-bg-color 与 --pod-formView-stickyFooter-box-shadow。本风格按钮区跟随内容面，外层跟随画布，不叠加双阴影。底栏与正文共同消费 --pod-page-content-max-width。导航、无导航、管理内嵌、抽屉、移动端分别检查，不能全局覆盖 stickyFooter 的宽度与定位。

## 4. 特色表达配方

### 材质与信息密度

${material}。${profile.workspace || composition}。图表、图片、时间线只为真实内容出现；没有媒体时以排版与章节构图成立，不为“丰富”捏造指标或入口。

## 5. 项目应用与调整规则

YAML Token 是唯一数值源。${free ? '记录业务推演依据，并确定画布、内容面、标题、线条、密度、表单列数和底栏。' : '沿用当前主题的构图与材质语言，按业务调整主色、字段分组及信息密度。'}

逐页记录页面任务、首屏焦点、布局、组件、主操作、状态、响应式与验收。表单按第 3 节补充组件作用、列比例、标签、间距、窄屏重排和详情延续方式；在 form-layout.json 中填入真实字段与所需组件，并对照 design.md 验收。

{{PAGE_APPLICATIONS}}

### 验收

- [ ] 导航、应用框架、Canvas、表单与详情的字体、线条、材质和状态一致。
- [ ] 正文与底栏对齐；四类容器与移动端无横向溢出。
- [ ] 文字/焦点/禁用/错误在实际背景上可辨，长说明与表格未裁切。
- [ ] 表单布局与逐页设计一致；组件、字段、主题和响应式规则均已核对。
`;
  if (free) {
    body = `# {{PROJECT_NAME}} design.md

## 1. 风格摘要

自由创意从业务任务、用户、品牌、内容结构和使用环境独立推演。导航、应用框架、自定义页面、表单和详情页共用最终确定的构图、字体、材质、密度与状态语言。

## 2. 页面视觉系统

### 2.1 表面、区块与层次

根据真实内容确定画布、内容面、边界、留白和信息层级。主次区域通过宽度、位置、表面和排版建立关系；每个容器都承载明确内容，不为丰富版式增加空卡片或虚构数据。

### 2.2 应用导航

按业务入口确定导航结构和明暗，菜单来自真实页面范围。主色 {{PRIMARY_COLOR}}；色彩来源 {{COLOR_SOURCE}}。导航与正文使用同一应用全局样式；在 themeProfile 中分别填写 contentTone 与 navTheme。

先决定品牌区、菜单分组、搜索和常用操作如何服务当前业务，再与应用框架、表单、自定义页和详情一起确定表面、边界、圆角、字体、密度和选中表达。在 navigation 分组填写项目自己的导航底色、普通文字、悬停文字、选中文字、悬停背景、选中背景六项 Token，并配套搜索、弹层、分组、操作、菜单高度与圆角。文件中的基础值是编写骨架，交付时用项目设计值替换。窄屏和折叠后保持菜单可展开、当前页面可定位、键盘焦点可见。

### 2.3 页面标题与操作

标题说明当前页面任务，主操作靠近作用对象，辅助操作保持清楚的层级。标题、说明、操作、筛选和状态摘要按首屏任务排列，不复制示例标题、指标或标签。

### 2.4 布局和移动端

根据阅读顺序、操作频率、内容宽度和增长方式确定单列、多列、侧栏或分区。窄屏按阅读与操作顺序重排，工具栏允许换行，宽表格提供横向滚动，抽屉和表单入口保留明确返回路径。

### 2.5 自定义页面设计

自定义页面按 PRD 组织标题与操作区、状态摘要、筛选、主要内容、上下文信息和反馈区；列表、表格、图表、详情抽屉和表单入口只在业务需要时出现。每个自定义页面逐页写清页面任务、首屏焦点、布局、表面与组件、主操作、状态、响应式和验收。

## 3. 基础组件表达

### 自定义页面组件与交互

页面标题、筛选、主操作、状态摘要、列表、表格、图表、详情抽屉和表单入口按真实任务组合。默认、hover、active、focus、loading、empty、error、disabled 和 selected 状态使用同一套表面、边界、文字与状态语义，并为键盘焦点、纯图标按钮、非颜色状态表达和 reduced motion 提供可执行规则。

\`YidaCodeCanvas\` 页面在 \`YidaComp\` 内消费已声明的应用主题 token。页面局部 CSS 只负责当前组件的布局和特色表达；应用全局样式统一作用于应用框架、表单、详情页和自定义页面等。

### 表单组件与版式结构

表单支持在顶部、左侧、主体、右侧和字段之间组合 Tab/切换、按钮组/操作入口、图片/图形、状态区、标题与 Divider、分栏、辅助内容和字段。各组件分别承担导航、操作、视觉焦点、反馈、层级、节奏、装饰或采集作用。普通业务分组和章节分隔使用 Divider，横向字段组合使用 ColumnContainer。表单延续应用全局字体、色彩、表面、边界、圆角、密度和状态。

### 组件状态与详情延续

输入、按钮、选择、表格和浮层使用已确定的尺寸、边界、表面和文字角色。错误、警告、禁用和只读使用独立语义；详情页保持与编辑表单相同的章节顺序、信息层级和响应式规则。详情页只读字段的数据框使用 --pod-field-preview-bg-color、--pod-field-preview-border-radius、--pod-field-preview-shadow、--pod-field-preview-indicator-color、--pod-field-preview-text-color、--form-element-medium-font-size、--pod-field-preview-gap、--pod-field-preview-line-height、--pod-field-preview-min-height 和 --pod-field-preview-padding，并与表单控件、卡片和页面画布使用同一套设计值。

## 4. 特色表达配方

由真实任务确定表单与页面的组件区域、章节、图表和记录集合。左侧栏可组合 Tab、按钮、图片或其他表单组件。每个指标、组件和装饰文案都服务于具体业务，并写清启用条件与窄屏处理。

## 5. 项目应用与调整规则

每个实际自定义页面逐页写清页面任务、首屏焦点、布局、表面与组件、主操作、状态、响应式和验收。表单额外写清顶部、左侧、主体、右侧和字段之间使用的组件、各组件作用、列比例、标签位置、字段与章节间距、底栏、详情延续和窄屏重排。form-layout.json 提供字段与分栏的初始结构；编辑已有表单时保留现有组件。交付时核对实际页面、表单与 design.md。

{{PAGE_APPLICATIONS}}
`;
  }
  const markdown = `---\n${yaml(metadata)}\n---\n${body}`;
  const folder = path.join(directory, id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'design.md'), markdown);
  fs.writeFileSync(path.join(folder, 'app_theme.css'), cssTemplate(markdown));
  const layout = { type: 'ColumnContainer', layout: columns, columnGap: `${gap}px`, rowGap: `${gap}px`, display: 'VERTICAL', mobileRowGap: `${gap}px`, children: columns.split(':').map(() => []) };
  fs.writeFileSync(path.join(folder, 'form-layout.json'), JSON.stringify([layout], null, 2) + '\n');
  index.themes.push({ themeId: id, label, mode: profile.mode || 'template', collection: 'application-styles',
    ...(!free ? { contentTone, navTheme, navigationSummary: navigationStyle.summary } : {}),
    templatePath: `templates/design-themes/${id}/design.md`, cssTemplatePath: `templates/design-themes/${id}/app_theme.css`, formLayoutPath: `templates/design-themes/${id}/form-layout.json`, previewPrimaryColor: accent, styleSummary: free ? metadata.description : `${navTheme === 'dark' ? '深色' : '浅色'}导航，${contentTone === 'dark' ? '深色' : '浅色'}内容界面。${metadata.description}` });
}
fs.writeFileSync(path.join(directory, 'index.json'), JSON.stringify(index, null, 2) + '\n');
