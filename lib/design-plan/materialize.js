'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { CliError } = require('../core/cli-error');
const { normalizePlan } = require('./normalize');
const { readJson, atomicWrite } = require('./files');

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const PLAN_SKILL_ROOT = path.join(
  PACKAGE_ROOT,
  'yida-skills',
  'skills',
  'yida-design',
  'sub_skill',
  'yida-design-plan'
);
const THEME_DIR = path.join(PLAN_SKILL_ROOT, 'templates', 'design-themes');
const THEME_INDEX_PATH = path.join(THEME_DIR, 'index.json');
const HTML_RENDERER_PATH = path.join(PLAN_SKILL_ROOT, 'scripts', 'render_build_plan.py');

function text(value, fallback = '-') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(item => text(item, '')).filter(Boolean).join(' / ') : fallback;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value).replace(/\r?\n/g, ' ');
}

function mdCell(value) {
  return text(value).replace(/\|/g, '\\|');
}

function mdList(items, fallback = '- 无') {
  const values = Array.isArray(items) ? items.filter(item => item !== undefined && item !== null && item !== '') : [];
  return values.length > 0 ? values.map(item => `- ${text(item)}`).join('\n') : fallback;
}

function mdTable(headers, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return [
    `| ${headers.map(mdCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...(safeRows.length > 0
      ? safeRows.map(row => `| ${row.map(mdCell).join(' | ')} |`)
      : [`| ${headers.map((_, index) => index === 0 ? '-' : '').join(' | ')} |`]),
  ].join('\n');
}

function visualSelections(plan) {
  const visual = plan.visualStyle || {};
  const forUser = visual.forUser || {};
  const selectedTheme = ((visual.internal || {}).selectedTheme) || forUser.selectedTheme || {};
  const visualDirection = forUser.visualDirection || {
    label: '统一业务工具风格',
    description: forUser.styleSummary || '保持清晰、稳定并适合持续业务操作。',
    source: forUser.styleSource || selectedTheme.source || 'legacy_default',
  };
  const navigationStyle = forUser.navigationStyle || {
    structure: 'side',
    tone: 'light',
    source: 'legacy_default',
    selectionReason: '兼容旧版搭建计划；新计划必须显式记录导航选择。',
  };
  return { visual, forUser, selectedTheme, visualDirection, navigationStyle };
}

function navigationStructureLabel(value) {
  return value === 'top' ? '顶部导航' : '侧边导航';
}

function navigationToneLabel(value) {
  return value === 'dark' ? '深色' : '浅色';
}

function renderExecution(plan) {
  const pages = (plan.pages || {}).customPageDetails || [];
  const models = plan.dataModels || [];
  const { navigationStyle } = visualSelections(plan);
  const execution = plan.execution || {};
  const handoff = {
    appConfig: { layoutDirection: navigationStyle.structure, navTheme: navigationStyle.tone, logoSource: 'appIcon' },
    resourceBlueprint: [
      ...models.map(model => ({ name: model.name, type: String(model.formType).includes('流程') ? 'process' : 'form' })),
      ...pages.map(page => ({ name: page.name, type: 'display', pageId: page.pageId })),
    ],
    resourceCreationOrder: ['应用', ...models.map(model => model.name), ...pages.map(page => page.name)],
    pageImplementationOrder: pages.map(page => page.pageId || page.name),
    navigationOrder: [],
    navigationFallback: '发布时使用 --auto-nav-order，不再重复执行排序',
    acceptanceCriteria: [
      ...models.map(model => `${model.name}的字段、必填规则与关系符合数据模型`),
      ...(plan.businessFlows || []).map(flow => `${flow.name}按触发条件和业务规则执行`),
      ...pages.map(page => `${page.name}支持${page.primaryTask || page.positioning}`),
    ],
    ...execution,
    pages: pages.map(page => ({
      pageId: page.pageId,
      name: page.name,
      entryMode: page.entryMode || 'workbench',
      pageSpecHandoff: {
        scene: page.scene || (page.layoutPattern || {}).id,
        pageStructure: page.firstScreenStructure,
        contentBlocks: page.blocks,
        dataSources: page.dataSources || [],
        primaryAction: page.primaryTask,
        designFile: 'design.md',
        designRefs: ['项目视觉选择', '项目应用'],
        ...page.pageSpecHandoff,
      },
    })),
  };
  return [
    '## 6. 搭建交接', '',
    '资源创建顺序、页面实现交付顺序、导航顺序和验收标准如下。名称仅用于规划；真实 ID 由后续 CLI 结果解析。designFile 相对本 PRD 所在目录。', '',
    '```json', JSON.stringify(handoff, null, 2), '```', '',
  ].join('\n');
}

function renderPrd(plan) {
  const meta = plan.meta || {};
  const overview = plan.overview || {};
  const projectName = text(meta.projectName, 'OpenYida 应用');
  const revision = text(meta.revision, 'unversioned');
  const graph = overview.businessGraph || {};
  const graphRelations = graph.relations || [];
  const dataModels = plan.dataModels || [];
  const businessFlows = plan.businessFlows || [];
  const pages = plan.pages || {};
  const { forUser, visualDirection, navigationStyle } = visualSelections(plan);
  const color = forUser.colorStrategy || {};
  const lines = [
    '---',
    `projectName: ${projectName}`,
    `buildPlanRevision: "${revision}"`,
    '---',
    '',
    `# ${projectName} 搭建计划（PRD）`,
    '',
    `本文件由 \`build-plan.json\` 确定性派生，版本为 ${revision}。完整设计契约见同目录 \`design.md\`。`,
    '',
    '## 1. 需求总览',
    '',
    '### 应用概述',
    '',
    text(overview.summary),
    '',
    '### 业务全景图',
    '',
    mdTable(
      ['起点表', '关系', '终点表', '说明'],
      graphRelations.map(relation => [relation.from, relation.label, relation.to, relation.description])
    ),
    '',
    '### 数据模型摘要',
    '',
    mdList(overview.dataModelSummary),
    '',
    '### 业务流程摘要',
    '',
    mdList(overview.flowSummary),
    '',
    '### 导航菜单摘要',
    '',
    mdList(overview.navigationSummary || overview.pageSummary),
    '',
    '### 角色与权限摘要',
    '',
    mdList(overview.rolePermissionSummary),
    '',
    '### 视觉设计摘要',
    '',
    text(overview.visualSummary || forUser.styleSummary),
  ];

  lines.push('', '## 2. 数据模型');
  dataModels.forEach((model, index) => {
    lines.push(
      '',
      `### 2.${index + 1} ${text(model.name)}（${text(model.formType)}）`,
      '',
      text(model.description),
      '',
      `视图：${text(model.views)}`,
      '',
      mdTable(
        ['字段', '字段类型', '必填', '默认值/选项', '关联关系', '分组', '说明'],
        (model.fields || []).map(field => [
          field.name,
          field.type,
          field.required === true ? '是' : field.required === false ? '否' : field.required,
          field.defaultOrOptions,
          field.relation,
          field.group,
          field.description,
        ])
      )
    );
  });

  lines.push('', '## 3. 业务流程');
  businessFlows.forEach((flow, index) => {
    lines.push(
      '',
      `### 3.${index + 1} [${text(flow.type)}] ${text(flow.name)}`,
      '',
      `触发：${text(flow.trigger)}`,
      '',
      `链路：${text(flow.nodes)}`,
      '',
      text(flow.description),
      '',
      '规则说明：',
      '',
      mdList(flow.rules)
    );
  });

  lines.push(
    '',
    '## 4. 页面规划',
    '',
    '### 4.1 页面总览',
    '',
    mdTable(
      ['页面名称', '类型', '用途'],
      (pages.overview || []).map(page => [page.name, page.type, page.purpose])
    ),
    '',
    '### 4.2 自定义页面详情'
  );
  const pageApplications = new Map((forUser.pageApplications || []).map(item => [item.pageId || item.pageName, item]));
  (pages.customPageDetails || []).forEach((page, index) => {
    const pattern = page.layoutPattern || {};
    const richness = page.contentRichness || {};
    const application = pageApplications.get(page.pageId) || pageApplications.get(page.name) || {};
    lines.push(
      '',
      `#### 4.2.${index + 1} ${text(page.name)}`,
      '',
      `- 页面定位：${text(page.positioning)}`,
      `- 核心用户：${text(page.primaryUsers)}`,
      `- 核心任务：${text(page.primaryTask)}`,
      `- 内容优先级：${text(page.contentPriority)}`,
      `- 功能区块：${text(page.blocks)}`,
      `- 首屏结构：${text(page.firstScreenStructure)}`,
      `- 标志性交互：${text(page.signatureInteraction)}`,
      `- 页面模式：${text(pattern.mode)} / ${text(pattern.id)}`,
      `- 模式调整：${text(pattern.adaptations)}`,
      `- 信息密度：${text(page.density)}`,
      `- 内容丰富度：${text(richness.requirement)}；${text(richness.contentLayers)}`,
      `- 避免填充：${text(richness.antiFiller)}`,
      `- 视觉应用：${text(application.visualApplication)}`,
      `- 权限说明：${text(page.permissionSummary)}`
    );
  });

  lines.push(
    '',
    '## 5. 视觉风格',
    '',
    `- 视觉方向：${text(visualDirection.label)}（${text(visualDirection.description)}）`,
    `- 风格来源：${text(forUser.styleSource || visualDirection.source)}`,
    `- 主题色：${text(color.primaryColorName)} ${text(color.primaryColor)}`,
    `- 色彩策略：${text(color.usage)}`,
    `- 导航结构：${navigationStructureLabel(navigationStyle.structure)}`,
    `- 导航明暗：${navigationToneLabel(navigationStyle.tone)}`,
    `- 选择依据：${text(navigationStyle.selectionReason || visualDirection.description)}`,
    `- 层次摘要：${text(forUser.hierarchySummary)}`,
    `- 组件摘要：${text(forUser.componentToneSummary)}`,
    `- 图标摘要：${text(forUser.iconSummary)}`,
    `- 状态摘要：${text(forUser.stateSummary)}`,
    `- 响应式摘要：${text(forUser.responsiveSummary)}`,
    '',
    '### 页面视觉应用',
    ''
  );
  (forUser.pageApplications || []).forEach(application => {
    lines.push(
      `#### ${text(application.pageName || application.pageId)}`,
      '',
      `- 视觉应用：${text(application.visualApplication)}`,
      `- 表面：${text(application.surface)}`,
      `- 主操作：${text(application.primaryAction)}`,
      `- 状态：${text(application.states)}`,
      `- 视觉记忆点：${text(application.visualMemories)}`,
      ''
    );
  });
  lines.push(
    '### 素材策略',
    '',
    `- 素材状态：${text((forUser.assetStrategy || {}).materialStatus)}`,
    `- 已有素材：${text((forUser.assetStrategy || {}).brandAssets || (forUser.assetStrategy || {}).heroImage)}`,
    `- 素材缺口：${text((forUser.assetStrategy || {}).missingAssets)}`,
    `- 说明：${text((forUser.assetStrategy || {}).notes)}`,
    ''
  );
  lines.push(renderExecution(plan));
  return lines.join('\n');
}

function normalizeHex(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(value || '').trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}

function mixHex(hex, target, targetRatio) {
  const source = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const mixed = source.map((channel, index) => Math.round(channel * (1 - targetRatio) + target[index] * targetRatio));
  return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function mixTwoHex(left, right, rightRatio) {
  const target = [1, 3, 5].map(index => parseInt(right.slice(index, index + 2), 16));
  return mixHex(left, target, rightRatio);
}

function hexToRgba(hex, alpha) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  return `rgba(${channels.join(', ')}, ${alpha})`;
}

function replaceTokenValue(source, token, value) {
  const tokenPattern = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.replace(new RegExp(`("${tokenPattern}"\\s*:\\s*)"[^"]*"`), `$1"${value}"`);
}

function deriveBrandColors(primaryColor, themeId) {
  if (themeId === 'dark-luminous-modular') {
    return {
      '--color-brand1-1': mixHex(primaryColor, [255, 255, 255], 0.10),
      '--color-brand1-2': mixTwoHex(primaryColor, '#181818', 0.76),
      '--color-brand1-3': mixTwoHex(primaryColor, '#101010', 0.90),
      '--color-brand1-5': mixHex(primaryColor, [0, 0, 0], 0.18),
      '--color-brand1-9': mixHex(primaryColor, [0, 0, 0], 0.10),
      '--color-brand1-10': mixTwoHex(primaryColor, '#181818', 0.58),
    };
  }
  const defaults = {
    brand1: 0.12,
    brand2: 0.88,
    brand3: 0.94,
    brand5: 0.18,
    brand9: 0.12,
    brand10: 0.62,
  };
  const profiles = {
    'airy-media-grid': { brand1: 0.14, brand3: 0.95, brand5: 0.16, brand9: 0.10, brand10: 0.64 },
    'ambient-halo-layered': { brand1: 0.14, brand9: 0.10, brand10: 0.64 },
    'hairline-runway-clarity': { brand1: 0.90, brand2: 0.82, brand3: 0.74, brand10: 0.70 },
    'media-rail-inspector': { brand1: 0.90, brand2: 0.82, brand3: 0.74, brand10: 0.68 },
    'mist-layered-signal': { brand1: 0.14, brand5: 0.16, brand9: 0.10, brand10: 0.64 },
    'modular-rail-signal': { brand1: 0.14, brand9: 0.10, brand10: 0.64 },
    'mono-grid-signal': { brand1: 0.90, brand2: 0.82, brand3: 0.74, brand10: 0.68 },
    'ribbon-ledger-lift': { brand1: 0.90, brand2: 0.82, brand3: 0.74, brand5: 0.16, brand10: 0.68 },
    'segmented-meter-clarity': { brand1: 0.90, brand2: 0.82, brand3: 0.74, brand10: 0.66 },
    'status-framed-media-grid': { brand1: 0.08, brand9: 0.10, brand10: 0.72 },
  };
  const profile = { ...defaults, ...(profiles[themeId] || {}) };
  return {
    '--color-brand1-1': mixHex(primaryColor, [255, 255, 255], profile.brand1),
    '--color-brand1-2': mixHex(primaryColor, [255, 255, 255], profile.brand2),
    '--color-brand1-3': mixHex(primaryColor, [255, 255, 255], profile.brand3),
    '--color-brand1-5': mixHex(primaryColor, [0, 0, 0], profile.brand5),
    '--color-brand1-9': mixHex(primaryColor, [0, 0, 0], profile.brand9),
    '--color-brand1-10': mixHex(primaryColor, [255, 255, 255], profile.brand10),
  };
}

function deriveThemeColors(primaryColor, themeId) {
  const themes = {
    'high-contrast-modular': {
      '--oyd-page-background': mixTwoHex(primaryColor, '#F5F5F5', 0.97),
      '--oyd-surface-soft': mixTwoHex(primaryColor, '#F1F1F1', 0.95),
      '--oyd-accent-deep': mixTwoHex(primaryColor, '#202020', 0.55),
    },
    'interlocked-vivid-modules': {
      '--oyd-page-background': mixTwoHex(primaryColor, '#F7F7F7', 0.98),
    },
    'media-rail-inspector': {
      '--oyd-media-surface': mixTwoHex(primaryColor, '#F7F7F7', 0.96),
      '--oyd-tag-surface': mixTwoHex(primaryColor, '#F2F2F2', 0.92),
      '--oyd-action-deep': mixTwoHex(primaryColor, '#151515', 0.86),
    },
    'mono-grid-signal': {
      '--oyd-pattern-surface': mixTwoHex(primaryColor, '#F3F3F3', 0.92),
    },
    'status-framed-media-grid': {
      '--oyd-brand-focus-soft': mixTwoHex(primaryColor, '#FFFFFF', 0.92),
    },
    'dark-luminous-modular': {
      '--oyd-brand-glow-soft': hexToRgba(primaryColor, 0.18),
      '--oyd-brand-chart-strong': mixHex(primaryColor, [255, 255, 255], 0.06),
      '--oyd-brand-chart-muted': hexToRgba(primaryColor, 0.46),
      '--oyd-brand-chart-area': hexToRgba(primaryColor, 0.14),
    },
  };
  return themes[themeId] || {};
}

function resolveTheme(plan) {
  const { selectedTheme: selected } = visualSelections(plan);
  const index = readJson(THEME_INDEX_PATH, '主题索引');
  const theme = (index.themes || []).find(item => item.themeId === selected.themeId);
  if (!theme || theme.templatePath !== selected.templatePath) {
    throw new CliError('selectedTheme 的 themeId 与 templatePath 不属于主题索引中的同一记录', {
      code: 'DESIGN_PLAN_THEME_MISMATCH',
      details: { selectedTheme: selected },
    });
  }
  const templatePath = path.resolve(PLAN_SKILL_ROOT, selected.templatePath);
  if (!templatePath.startsWith(`${THEME_DIR}${path.sep}`) || !fs.existsSync(templatePath)) {
    throw new CliError(`主题模板不可读：${selected.templatePath}`, {
      code: 'DESIGN_PLAN_THEME_UNREADABLE',
    });
  }
  return { theme, templatePath };
}

function renderProjectVisualSection(visualDirection, color, navigationStyle) {
  const navigationToken = navigationStyle.tone === 'dark'
    ? '--color-brand1-5'
    : '--color-brand1-3';
  return [
    '## 项目视觉选择',
    '',
    `- 视觉方向：${text(visualDirection.label)}`,
    `- 方向说明：${text(visualDirection.description)}`,
    `- 主题色：${text(color.primaryColorName)} \`${text(color.primaryColor)}\``,
    `- 导航结构：${navigationStructureLabel(navigationStyle.structure)}`,
    `- 导航明暗：${navigationToneLabel(navigationStyle.tone)}`,
    `- 导航背景：\`${navigationToken}\``,
    `- 选择依据：${text(navigationStyle.selectionReason || visualDirection.description)}`,
  ].join('\n');
}

function injectAfterFrontmatter(source, content) {
  const frontmatter = /^---\n[\s\S]*?\n---\n/;
  if (!frontmatter.test(source)) {
    return `${content}\n\n${source}`;
  }
  return source.replace(frontmatter, match => `${match}\n${content}\n\n`);
}

function renderPagePatterns(pages) {
  return (pages.customPageDetails || []).map(page => {
    const pattern = page.layoutPattern || {};
    const richness = page.contentRichness || {};
    return [
      `#### ${text(page.name)}`,
      '',
      `- 模式：${text(pattern.mode)} / ${text(pattern.id)}`,
      `- 选择原因：${text(pattern.reason)}`,
      `- 调整项：${text(pattern.adaptations)}`,
      `- 必须保留：${text(pattern.mustKeep)}`,
      `- 信息密度：${text(page.density)}`,
      `- 内容覆盖：${text(richness.contentLayers)}`,
    ].join('\n');
  }).join('\n\n') || '- 无自定义页面';
}

function renderPageApplications(applications) {
  return (applications || []).map(application => {
    const memories = (application.visualMemoryApplications || []).map(memory =>
      `  - ${text(memory.name)}：${text(memory.target)}（${text(memory.renderPolicy)}；${text(memory.reason)}）`
    );
    return [
      `#### ${text(application.pageName || application.pageId)}`,
      '',
      `- 视觉应用：${text(application.visualApplication)}`,
      `- 表面：${text(application.surface)}`,
      `- 主操作：${text(application.primaryAction)}`,
      `- 状态：${text(application.states)}`,
      '- 视觉记忆点：',
      ...(memories.length > 0 ? memories : ['  - 无匹配内容，不虚构视觉组件']),
    ].join('\n');
  }).join('\n\n') || '- 无自定义页面';
}

function assetSummary(assetStrategy) {
  const strategy = assetStrategy || {};
  const values = [];
  for (const [key, value] of Object.entries(strategy)) {
    if (key === 'missingAssets' || key === 'notes' || value === undefined || value === null || value === '') {
      continue;
    }
    values.push(`${key}: ${text(value)}`);
  }
  return values.join('；') || '无现成品牌素材';
}

function renderDesign(plan) {
  const { templatePath } = resolveTheme(plan);
  const template = fs.readFileSync(templatePath, 'utf8');
  const meta = plan.meta || {};
  const { visual, forUser, selectedTheme: selected, visualDirection, navigationStyle } = visualSelections(plan);
  const forDesignMd = visual.forDesignMd || {};
  const color = forUser.colorStrategy || {};
  if (!['top', 'side'].includes(navigationStyle.structure)) {
    throw new CliError('visualStyle.forUser.navigationStyle.structure 必须是 top 或 side', {
      code: 'DESIGN_PLAN_INVALID_NAVIGATION_STRUCTURE',
    });
  }
  if (!['light', 'dark'].includes(navigationStyle.tone)) {
    throw new CliError('visualStyle.forUser.navigationStyle.tone 必须是 light 或 dark', {
      code: 'DESIGN_PLAN_INVALID_NAVIGATION_TONE',
    });
  }
  const primaryColor = normalizeHex(color.primaryColor);
  if (!primaryColor) {
    throw new CliError('visualStyle.forUser.colorStrategy.primaryColor 必须是 6 位 HEX 色值', {
      code: 'DESIGN_PLAN_INVALID_PRIMARY_COLOR',
      details: { primaryColor: color.primaryColor },
    });
  }
  const replacements = {
    PROJECT_NAME: text(meta.projectName, 'OpenYida 应用'),
    BUSINESS_DOMAIN: text(meta.businessDomain),
    EXPERIENCE_TOPOLOGY: text(meta.experienceTopology),
    THEME_SOURCE: text(forUser.styleSource || selected.source),
    PRIMARY_COLOR: primaryColor,
    COLOR_SOURCE: text(color.source),
    PROJECT_CONSTRAINTS: text(visual.constraints, '无额外约束'),
    PRODUCT_TOPOLOGY_APPLICATION: text(forDesignMd.productTopologyApplication),
    PAGE_PATTERN_SUMMARY: renderPagePatterns(plan.pages || {}),
    PAGE_APPLICATIONS: renderPageApplications(forUser.pageApplications),
    BRAND_ASSETS: assetSummary(forUser.assetStrategy),
    ASSET_GAPS: text((forUser.assetStrategy || {}).missingAssets, '无'),
  };
  let output = template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(replacements, key)) {
      return match;
    }
    return replacements[key];
  });
  output = output.replace(/^themeId:\s*[^\n]+\n?/m, '');
  if (!/^buildPlanRevision:/m.test(output)) {
    output = output.replace(
      /^---\n/,
      `---\nbuildPlanRevision: "${text(meta.revision, 'unversioned')}"\n`
    );
  }
  output = injectAfterFrontmatter(
    output,
    renderProjectVisualSection(visualDirection, color, navigationStyle)
  );
  const derived = {
    ...deriveBrandColors(primaryColor, selected.themeId),
    '--oyd-stage-bottom': mixTwoHex(primaryColor, '#121212', 0.72),
    '--oyd-heat-1': mixHex(primaryColor, [255, 255, 255], 0.92),
    '--oyd-heat-2': mixHex(primaryColor, [255, 255, 255], 0.80),
    '--oyd-heat-3': mixHex(primaryColor, [255, 255, 255], 0.62),
    '--oyd-heat-4': mixHex(primaryColor, [255, 255, 255], 0.32),
    '--oyd-heat-5': primaryColor,
    '--oyd-chart-stripe': mixHex(primaryColor, [0, 0, 0], 0.08),
    '--oyd-chart-pale': mixHex(primaryColor, [255, 255, 255], 0.84),
    ...deriveThemeColors(primaryColor, selected.themeId),
  };
  for (const [token, value] of Object.entries(derived)) {
    output = replaceTokenValue(output, token, value);
  }
  const unresolved = output.match(
    /\{\{[^}]+\}\}|<[^>]*(?:实际色值|生成期标记)[^>]*>|"--[^"]+"\s*:\s*"AI 根据[^"]*生成[^"]*"/g
  );
  if (unresolved) {
    throw new CliError('design.md 仍包含未解析占位符或 Token 推导指令', {
      code: 'DESIGN_PLAN_UNRESOLVED_TEMPLATE',
      details: { unresolved: [...new Set(unresolved)] },
    });
  }
  return output;
}

function findPython() {
  for (const executable of ['python3', 'python']) {
    const probe = spawnSync(executable, ['--version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) {
      return executable;
    }
  }
  throw new CliError('生成 build-plan.html 需要可用的 Python 3 运行时', {
    code: 'DESIGN_PLAN_PYTHON_UNAVAILABLE',
  });
}

function renderHtml(inputPath, outputPath) {
  const executable = findPython();
  const result = spawnSync(executable, [HTML_RENDERER_PATH, '--input', inputPath, '--output', outputPath], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new CliError((result.stderr || result.stdout || 'build-plan.html 生成失败').trim(), {
      code: 'DESIGN_PLAN_VALIDATION_FAILED',
      details: { inputPath },
    });
  }
}

function materialize(inputPath, options = {}) {
  const resolvedInput = path.resolve(inputPath);
  const outputDir = path.resolve(options.outputDir || path.dirname(resolvedInput));
  const sourcePlan = readJson(resolvedInput, 'build-plan.json');
  const plan = normalizePlan(sourcePlan);
  const prd = renderPrd(plan);
  const design = renderDesign(plan);
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-design-plan-'));
  const temporaryHtml = path.join(temporaryDir, 'build-plan.html');
  const normalizedInput = path.join(temporaryDir, 'build-plan.normalized.json');
  try {
    fs.writeFileSync(normalizedInput, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    renderHtml(normalizedInput, temporaryHtml);
    const html = fs.readFileSync(temporaryHtml, 'utf8');
    const outputs = {
      prd: path.join(outputDir, 'prd.md'),
      design: path.join(outputDir, 'design.md'),
      html: path.join(outputDir, 'build-plan.html'),
    };
    if (!options.check) {
      atomicWrite(outputs.prd, prd);
      atomicWrite(outputs.design, design);
      atomicWrite(outputs.html, html);
    }
    return {
      success: true,
      checked: options.check === true,
      input: resolvedInput,
      outputDir,
      revision: (plan.meta || {}).revision || null,
      outputs,
    };
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

module.exports = {
  materialize,
  normalizePlan,
  renderDesign: plan => renderDesign(normalizePlan(plan)),
  renderPrd: plan => renderPrd(normalizePlan(plan)),
};
