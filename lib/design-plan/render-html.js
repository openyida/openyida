'use strict';

// Plan artifacts run inside the CLI's Node runtime, including on fresh Windows installations.
const fs = require('fs');
const path = require('path');
const { PLAN_SKILL_ROOT } = require('./themes');
const ASSETS = path.join(PLAN_SKILL_ROOT, 'assets');
const SECTIONS = [
  ['overview', '需求总览', '应用概述、业务全景图', 'overview.png'],
  ['data-models', '数据模型', '表单、字段、属性', 'data-models.png'],
  ['business-flows', '业务流程', '审批流、自动化流', 'business-flows.png'],
  ['pages', '页面规划', '页面总览与自定义页详情', 'pages.png'],
];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const present = value => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
function display(value) {
  if (Array.isArray(value)) { return value.map(display).join('；'); }
  if (object(value)) { return Object.entries(value).map(([key, item]) => `${key}：${display(item)}`).join('；'); }
  return (value === null || value === undefined) ? '' : String(value);
}
function esc(value) {
  const text = (value === null || value === undefined) || value === '' ? '-' : typeof value === 'boolean' ? (value ? '是' : '否') : String(value);
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[c]);
}
function list(items = []) {
  const values = items.filter(item => (item !== null && item !== undefined) && item !== '');
  return values.length ? `<ul>${values.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p class="muted">-</p>';
}
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="muted">-</td></tr>`}</tbody></table></div>`;
}
function icon(name) {
  const filename = path.join(ASSETS, 'icons', name);
  return fs.existsSync(filename) ? `data:${name.endsWith('.svg') ? 'image/svg+xml' : 'image/png'};base64,${fs.readFileSync(filename).toString('base64')}` : '';
}
function heading(anchor, title) {
  const section = SECTIONS.find(item => item[0] === anchor);
  const src = icon(section[3]);
  return `<h2 class="section-heading"><span class="section-heading-icon">${src ? `<img src="${esc(src)}" alt="" aria-hidden="true" />` : '<span class="nav-icon-fallback" aria-hidden="true"></span>'}</span><span>${esc(title || section[1])}</span></h2>`;
}
function nav() {
  return SECTIONS.map(([anchor, title, subtitle, name]) => {
    const src = icon(name);
    return `<a class="nav-item" href="#${anchor}" data-section-id="${anchor}"><span class="nav-icon">${src ? `<span class="nav-icon-img" style="--nav-icon-image: url('${esc(src)}')" aria-hidden="true"></span>` : '<span class="nav-icon-fallback" aria-hidden="true"></span>'}</span><span class="nav-copy"><span class="nav-title">${esc(title)}</span><span class="nav-subtitle">${esc(subtitle)}</span></span></a>`;
  }).join('');
}
function userCopy(value) {
  if (typeof value !== 'string') { return value; }
  for (const [source, target] of [['没有强匹配的浏览或表单预设', '采用更符合当前浏览任务的分类信息结构'], ['基于预设改造', '业务优化结构'], ['直接采用预设', '标准页面结构'], ['预设', '标准结构'], ['模板', '方案']]) {
    value = value.split(source).join(target);
  }
  return value;
}
function collectGraph(graph, models) {
  const nodes = [], exact = new Map(), aliases = new Map(), shortNames = new Map();
  const shortName = value => String(value || '').trim().replace(/(?:信息表|表单|表)$/, '');
  function register(index, value, id) {
    const key = String(value || '').trim();
    if (key) { if (!index.has(key)) { index.set(key, new Set()); } index.get(key).add(id); }
  }
  for (const [index, model] of models.entries()) {
    const name = String(model.name || '').trim(), id = `model-${index + 1}`;
    if (!name) { throw new Error('业务全景图的数据表缺少名称'); }
    if (exact.has(name)) { throw new Error(`业务全景图的数据表名称重复：${name}`); }
    nodes.push({ id, name, source: model.formType || '宜搭表单', group: model.group || '', color: '' });
    register(exact, name, id); register(shortNames, shortName(name), id);
    for (const key of ['id', 'modelId', 'formUuid']) { register(aliases, model[key], id); }
  }
  function resolve(value) {
    const key = String(value || '').trim(), candidates = exact.get(key) || aliases.get(key) || shortNames.get(shortName(key)) || new Set();
    if (candidates.size === 1) { return [...candidates][0]; }
    if (candidates.size > 1) { throw new Error(`业务全景图引用不明确：${key}，请使用数据表完整名称或明确绑定 modelName`); }
    throw new Error(`业务全景图引用未定义的数据表：${key || '(空)'}，请修正为 dataModels 中的名称`);
  }
  for (const raw of graph.nodes || graph.tables || []) {
    if (object(raw)) {
      const id = resolve(raw.modelName || raw.modelId || raw.formUuid || raw.name || raw.label || raw.id);
      for (const key of ['id', 'name', 'label']) { register(aliases, raw[key], id); }
      for (const key of ['group', 'color']) { if (raw[key]) { nodes.find(node => node.id === id)[key] = raw[key]; } }
    } else { register(aliases, raw, resolve(raw)); }
  }
  for (const node of nodes) { if (!aliases.has(node.id)) { aliases.set(node.id, new Set([node.id])); } }
  const relations = [], pairs = new Set();
  function add(source, target, label) {
    const from = resolve(source), to = resolve(target), key = JSON.stringify([from, to]);
    if (from === to || pairs.has(key)) { return; }
    pairs.add(key); relations.push({ from, to, label: String(label || '关联') });
  }
  const explicit = graph.relations || graph.edges || [];
  for (const relation of explicit) { if (object(relation)) { add(relation.from || relation.source, relation.to || relation.target, relation.label || relation.relation || relation.type); } }
  for (const line of String(graph.content || '').split(/\r?\n/)) {
    if (line.trim().startsWith('graph ')) { continue; }
    const match = line.trim().match(/^(.+?)\s*[-=]+>\s*(.+)$/);
    if (match) { add(match[1].trim().replace(/^"+|"+$/g, ''), match[2].trim().replace(/^"+|"+$/g, ''), '关联'); }
  }
  if (!explicit.length && !relations.length) {
    for (const model of models) { for (const field of model.fields || []) { if ((field.relation !== null && field.relation !== undefined) && field.relation !== '' && field.relation !== '-') { add(field.relation, model.name, field.name); } } }
  }
  return { nodes, relations };
}
function graphLevels(nodes, relations) {
  const adjacency = new Map(nodes.map(node => [node.id, []])), indegree = new Map(nodes.map(node => [node.id, 0]));
  for (const relation of relations) { adjacency.get(relation.from).push(relation.to); indegree.set(relation.to, indegree.get(relation.to) + 1); }
  const ids = nodes.map(node => node.id), roots = ids.filter(id => !indegree.get(id)), levels = new Map();
  for (const start of [...roots, ...ids.filter(id => !roots.includes(id))]) {
    if (levels.has(start)) { continue; }
    levels.set(start, 0); const queue = [start];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const target of adjacency.get(queue[cursor])) { if (!levels.has(target)) { levels.set(target, levels.get(queue[cursor]) + 1); queue.push(target); } }
    }
  }
  const max = Math.max(0, ...levels.values()), columns = Math.min(4, Math.max(nodes.length, 1));
  if (max >= columns) { for (const [id, level] of levels) { const scaled = level * (columns - 1) / max, floor = Math.floor(scaled); levels.set(id, scaled - floor === 0.5 ? floor + floor % 2 : Math.round(scaled)); } }
  return levels;
}
function roundedPath(points, radius = 12) {
  const compact = points.filter((point, i) => !i || point[0] !== points[i - 1][0] || point[1] !== points[i - 1][1]);
  for (let i = 1; i < compact.length - 1;) {
    const [a, b, c] = compact.slice(i - 1, i + 2);
    if (a[0] === b[0] && b[0] === c[0] || a[1] === b[1] && b[1] === c[1]) { compact.splice(i, 1); } else { i++; }
  }
  if (compact.length < 2) { return ''; }
  const number = value => String(Number(value.toFixed(2)));
  const pair = point => point.map(number).join(' ');
  const toward = (a, b, distance) => { const length = Math.hypot(b[0] - a[0], b[1] - a[1]); return length ? [a[0] + (b[0] - a[0]) * distance / length, a[1] + (b[1] - a[1]) * distance / length] : a; };
  const commands = [`M ${pair(compact[0])}`];
  for (let i = 1; i < compact.length - 1; i++) {
    const [a, b, c] = compact.slice(i - 1, i + 2), r = Math.min(radius, Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, Math.hypot(c[0] - b[0], c[1] - b[1]) / 2);
    commands.push(`L ${pair(toward(b, a, r))}`, `Q ${pair(b)} ${pair(toward(b, c, r))}`);
  }
  commands.push(`L ${pair(compact[compact.length - 1])}`); return commands.join(' ');
}
const truncate = (value, length) => { const chars = [...String(value || '')]; return chars.length <= length ? chars.join('') : chars.slice(0, length - 1).join('') + '…'; };
const formIcon = source => icon(String(source || '').includes('流程') ? 'form-process.svg' : 'form-normal.svg');
function visualDetails(data) {
  const visual = data.visualStyle?.forUser || {}, direction = visual.visualDirection || {}, assets = visual.assetStrategy || {};
  return [['视觉方向', direction.label], ['设计说明', direction.description], ['色彩用法', visual.colorStrategy?.usage], ['素材现状', assets.materialStatus], ['素材缺口', assets.missingAssets], ['素材说明', assets.notes]]
    .filter(([, value]) => present(value)).map(([label, value]) => `<p><strong>${esc(label)}：</strong>${esc(display(typeof value === 'string' ? ({ none: '暂无', partial: '部分已有', provided: '已提供' }[value] || value) : value))}</p>`).join('');
}
function overviewSection(data) {
  const overview = data.overview || {}, visual = data.visualStyle?.forUser || {}, colors = visual.colorStrategy || {}, navigation = visual.navigationStyle || {}, graph = overview.businessGraph || {};
  let graphNote = graph.description || graph.summary || graph.content || '';
  if (typeof graphNote === 'string' && graphNote.trim().startsWith('graph ')) { graphNote = ''; }
  const sections = [['数据模型', '核心表单与数据职责', overview.dataModelSummary || []], ['业务流程', '关键流转与自动化规则', overview.flowSummary || []], ['权限', '角色范围与数据边界', overview.rolePermissionSummary || []], ['导航菜单', '主要入口与使用路径', overview.navigationSummary || overview.pageSummary || []]];
  const color = typeof colors.primaryColor === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(colors.primaryColor.trim()) ? colors.primaryColor.trim().toUpperCase() : '';
  const name = colors.primaryColorName || '';
  const colorHtml = color || name ? `<div class="theme-color-row" aria-label="主题色 ${esc(name)} ${esc(color)}">${color ? `<span class="theme-color-swatch" style="background-color: ${color}" aria-hidden="true"></span>` : ''}<span class="theme-color-label">主题色</span>${name ? `<strong class="theme-color-name">${esc(name)}</strong>` : ''}${color ? `<code class="theme-color-value">${esc(color)}</code>` : ''}</div>` : '<p class="muted">主题色：-</p>';
  const structure = ({ 'platform-l-shape': '平台L型导航', 'platform-top': '平台顶部导航', 'platform-side': '平台侧边导航', custom: '自定义导航' }[data.execution?.appConfig?.navigationType]) || ({ top: '顶部导航', side: '侧边导航' }[navigation.structure]) || '-';
  return `<section id="overview" class="page-section">${heading('overview', overview.title || '需求总览')}<p class="section-desc">确认应用定位、业务结构与整体方案</p><section class="overview-subsection first"><h3>应用概述</h3><p class="overview-kicker">产品定位、核心用户与待解决问题</p><p class="summary">${esc(overview.summary)}</p>${overview.businessGoal ? `<p><strong>业务目标：</strong>${esc(overview.businessGoal)}</p>` : ''}</section><section class="overview-subsection"><h3>业务全景图</h3><p class="overview-kicker">业务对象及其关联关系</p>${graphNote ? `<p class="summary">${esc(graphNote)}</p>` : ''}${businessGraph(graph, data.dataModels || [])}</section>${sections.map(([title, description, items]) => `<section class="overview-subsection"><h3>${esc(title)}</h3><p class="overview-kicker">${esc(description)}</p>${list(items)}</section>`).join('')}<section class="overview-subsection"><h3>视觉设计</h3><p class="overview-kicker">整体风格、主题色与导航样式</p><p class="summary">${esc(overview.visualSummary || visual.styleSummary || '-')}</p>${colorHtml}<p class="summary"><strong>导航结构：</strong>${esc(structure)}\u3000<strong>导航明暗：</strong>${esc(({ light: '浅色', dark: '深色' })[navigation.tone])}</p>${navigation.selectionReason ? `<p class="muted"><strong>选择依据：</strong>${esc(navigation.selectionReason)}</p>` : ''}${visualDetails(data)}</section></section>`;
}
function modelsSection(data) {
  const models = data.dataModels || [];
  return `<section id="data-models" class="page-section">${heading('data-models')}<p class="section-desc">表单、字段、属性</p>${models.length ? models.map(model => `<h3>${esc(model.name ?? '表名称')}</h3><p class="muted">${esc(model.description ?? '一句话描述')}</p>${model.formType || model.views?.length ? `<p class="muted">表单类型：${esc(model.formType)}\u3000视图：${esc((model.views || []).filter(Boolean).join('、'))}</p>` : ''}${table(['字段', '字段类型', '必填', '默认值/选项', '关联关系', '分组', '说明'], (model.fields || []).map(field => ['name', 'type', 'required', 'defaultOrOptions', 'relation', 'group', 'description'].map(key => field[key])))}`).join('') : '<p class="muted">-</p>'}</section>`;
}
function flowsSection(data) {
  const flows = data.businessFlows || [];
  return `<section id="business-flows" class="page-section">${heading('business-flows')}<p class="section-desc">审批流、自动化流</p>${flows.length ? flows.map(flow => {
    const type = flow.type || '业务流', nodes = (flow.nodes || []).filter(Boolean).map(node => `<span class="node">${esc(node)}</span>`).join('<span class="arrow">-></span>');
    return `<div class="flow-card"><div class="flow-head"><div class="flow-title"><span class="tag ${type === '自动化' ? 'auto' : type === '审批流' ? 'approval' : 'business'}">${esc(type)}</span>${esc(flow.name)}</div><div class="trigger">触发：${esc(flow.trigger)}</div></div><div class="nodes">${nodes || '<span class="muted">-</span>'}</div><p>${esc(flow.description)}</p><div class="soft-card">${list(flow.rules || [])}</div></div>`;
  }).join('') : '<p class="muted">-</p>'}</section>`;
}
function executionSection(data) {
  const execution = data.execution || {}, pageNames = new Map((data.pages?.customPageDetails || []).map(page => [page.pageId, page.name]));
  const types = { 'normal-form': '普通表单', 'process-form': '流程表单', 'display-page': '自定义页面', 'native-portal': '原生门户', report: '报表', integration: '集成自动化' };
  const parts = ['<h3>搭建范围</h3>', table(['资源', '类型', '用途'], (execution.resourceBlueprint || []).map(item => [item.name, types[item.type] || item.type, item.purpose]))];
  if (execution.pageNavigation?.length) { parts.push('<h3>页面导航</h3>', table(['页面', '平台页面导航'], execution.pageNavigation.map(item => [item.name, item.isRenderNav === false ? '隐藏' : '显示']))); }
  if (execution.entryModeSummary) { parts.push('<h3>系统怎么使用</h3>', `<p>${esc(execution.entryModeSummary)}</p>`); }
  for (const entry of execution.entryRecommendation?.entries || []) {
    const rows = [];
    const entryRows = (items) => { for (const item of items) { if (item.children?.length) { entryRows(item.children); } else { rows.push([item.label, item.resource, item.key === entry.defaultMenuKey ? '默认进入' : '', (item.access || []).map(access => `${access.resource || ''}：${access.dataScope || ''}`).join('；')]); } } };
    entryRows(entry.menu || []); parts.push(`<h3>${esc(entry.name ?? '业务入口')}</h3>`, table(['任务菜单', '业务资源', '默认落点', '数据范围'], rows));
  }
  if (execution.explicitScope) { parts.push('<h3>本轮明确范围</h3>', `<p>${esc(display(execution.explicitScope))}</p>`); }
  const order = (execution.navigationOrder || []).map(item => typeof item === 'string' ? pageNames.get(item) || item : display(item));
  if (!order.length) { order.push((execution.navigationFallback || '按页面用途安排导航入口').replaceAll('--auto-nav-order', '自动导航排序')); }
  parts.push('<h3>导航顺序</h3>', list(order)); return parts.join('');
}
function pagesSection(data) {
  const pages = data.pages || {}, details = pages.customPageDetails || [];
  const parts = [`<section id="pages" class="page-section">${heading('pages')}<p class="section-desc">页面总览与自定义页详情</p><h3>页面总览</h3>`, table(['页面名称', '类型', '用途'], (pages.overview || []).map(page => [page.name, page.type, page.purpose])), '<h3>自定义页面详情</h3>'];
  for (const detail of details) {
    const handoff = (data.execution?.pages || []).find(item => item.pageId === detail.pageId)?.pageSpecHandoff || detail.pageSpecHandoff || {};
    const pattern = detail.layoutPattern || {}, adaptations = object(pattern) ? pattern.adaptations || [] : [];
    let patternText = pattern;
    if (object(pattern)) {
      patternText = ({ 'form-focused': '聚焦填报页', 'list-detail': '列表与详情页', 'compact-workbench': '紧凑工作台', 'custom-page-pattern': '分类信息页' })[String(pattern.id || '')] || ({ preset: '标准页面结构', adapted: '业务优化结构', custom: '业务定制结构' })[pattern.mode] || '业务任务结构';
      if (pattern.reason) { patternText += `；${userCopy(pattern.reason)}`; }
    }
    const richness = detail.contentRichness || {}, requirement = object(richness) ? richness.requirement : richness;
    const richLabel = ({ 'rich-but-relevant': '信息充分，突出关键内容', focused: '聚焦核心任务', minimal: '精简必要信息' })[requirement] || userCopy(requirement);
    const density = ({ compact: '紧凑', comfortable: '适中', spacious: '宽松' })[detail.density] || userCopy(detail.density);
    const modern = ['primaryUsers', 'primaryTask', 'contentPriority', 'firstScreenStructure', 'signatureInteraction', 'layoutPattern', 'contentRichness', 'density', 'permissionSummary'].some(key => Object.hasOwn(detail, key));
    const menu = handoff.navigation || {}, appCustom = data.execution?.appConfig?.navigationType === 'custom', standalone = handoff.entryMode === 'standalone';
    const menuLabel = menu.type === 'custom' ? `自定义${({ top: '顶部', side: '侧边', mixed: '顶部与侧边', dock: '底部' })[menu.variant] || ''}菜单` : menu.type === 'none' ? '不设菜单' : appCustom ? '沿用应用自定义菜单' : standalone ? '未规划应用菜单，仅实现业务内容' : '沿用平台导航';
    const binding = handoff.dataBinding || detail.dataBinding;
    const rows = [['访问方式', standalone ? '独立页面入口' : '应用工作区入口'], ['页面菜单', menuLabel], ['页面实现边界', standalone ? '按独立入口方案组织内容' : '只实现业务内容；跨模块使用平台菜单，同任务分类可用页内 Tab'], ['导航影响范围', appCustom ? '应用采用自定义导航' : standalone ? '仅当前入口，应用工作区保留平台导航' : '保留平台导航'], ['导航依据', menu.reason], ['数据接入', ({ form: '表单数据', report: '报表数据', connector: '外部系统数据', 'static-empty': '静态内容或空态' })[binding] || binding], ['数据来源', display(handoff.dataSources || detail.dataSources)], ['主操作', handoff.primaryAction || detail.primaryTask]];
    parts.push(`<div class="card page-detail"><h4>${esc(detail.name)} <span class="tag approval">${esc(detail.type ?? '自定义页面')}</span></h4><p><strong>页面定位：</strong>${esc(detail.positioning)}</p>${modern ? `<p><strong>核心用户：</strong>${esc((detail.primaryUsers || []).filter(Boolean).join('、'))}</p><p><strong>核心任务：</strong>${esc(detail.primaryTask)}</p><p><strong>内容优先级：</strong></p>${list(detail.contentPriority || [])}` : ''}<p><strong>功能区块：</strong></p>${list(handoff.contentBlocks || detail.blocks || detail.functionalSections || [])}<p><strong>${modern ? '首屏结构' : '首屏印象'}：</strong>${esc(detail.firstScreenStructure || detail.firstScreen)}</p><p><strong>${modern ? '标志性交互' : '标志性时刻'}：</strong>${esc(detail.signatureInteraction || detail.signatureMoment)}</p>${present(detail.contentRichness) ? `<p><strong>内容丰富度：</strong>${esc(richLabel)}</p><p><strong>内容层次：</strong></p>${list(richness.contentLayers || [])}<p><strong>避免填充：</strong></p>${list(richness.antiFiller || [])}` : ''}${modern ? `<p><strong>页面结构：</strong>${esc(patternText)}</p>${adaptations.length ? `<p><strong>结构优化：</strong></p>${list(adaptations)}` : ''}<p><strong>信息密度：</strong>${esc(density)}</p>` : ''}<p><strong>权限说明：</strong>${esc(detail.permissionSummary || detail.permission)}</p>${rows.filter(([, value]) => present(value)).map(([label, value]) => `<p><strong>${esc(label)}：</strong>${esc(value)}</p>`).join('')}</div>`);
  }
  if (!details.length) { parts.push('<p class="muted">-</p>'); }
  parts.push(executionSection(data), '</section>'); return parts.join('');
}

function validatePlan(data) {
  const errors = [];
  if (!object(data)) { throw new Error('build-plan.json 结构不完整：\n- 根节点必须是 JSON object'); }
  const meta = data.meta;
  if (!object(meta)) { errors.push('缺少 meta'); } else if (!meta.projectName) { errors.push('缺少 meta.projectName'); }
  for (const key of ['overview', 'pages']) { if (!object(data[key])) { errors.push(`缺少 ${key} object`); } }
  for (const key of ['dataModels', 'businessFlows']) { if (!Array.isArray(data[key])) { errors.push(`缺少 ${key} array`); } }
  for (const [index, detail] of (data.pages?.customPageDetails || []).entries()) {
    const prefix = `pages.customPageDetails[${index}]`;
    if (!object(detail)) { errors.push(`${prefix} 必须是 object`); continue; }
    if (['pageId', 'primaryTask', 'contentPriority', 'firstScreenStructure', 'signatureInteraction', 'layoutPattern', 'density'].some(key => Object.hasOwn(detail, key))) {
      for (const field of ['pageId', 'primaryTask', 'contentPriority', 'firstScreenStructure', 'layoutPattern', 'density']) { if (!present(detail[field])) { errors.push(`${prefix} 缺少 ${field}`); } }
      const layout = detail.layoutPattern;
      if (object(layout) && layout.mode) {
        if (!['preset', 'adapted', 'custom'].includes(layout.mode)) { errors.push(`${prefix}.layoutPattern.mode 必须是 preset、adapted 或 custom`); }
        if (layout.mode === 'adapted' && !present(layout.adaptations)) { errors.push(`${prefix} 使用 adapted 模式但缺少 adaptations`); }
        if (layout.mode === 'custom' && layout.id !== 'custom-page-pattern') { errors.push(`${prefix} 使用 custom 模式时 id 必须是 custom-page-pattern`); }
        const richness = detail.contentRichness;
        if (!object(richness)) { errors.push(`${prefix} 缺少 contentRichness object`); } else {
          if (richness.requirement !== 'rich-but-relevant') { errors.push(`${prefix}.contentRichness.requirement 必须是 rich-but-relevant`); }
          for (const key of ['contentLayers', 'antiFiller']) { if (!Array.isArray(richness[key]) || !richness[key].length) { errors.push(`${prefix}.contentRichness.${key} 必须是非空数组`); } }
        }
      }
    }
  }
  const visual = data.visualStyle, user = visual?.forUser;
  if (!object(visual) || !object(user)) { errors.push('缺少 visualStyle.forUser object'); } else {
    if (String(data.schemaVersion || '').startsWith('2')) {
      if (!user.visualDirection?.label || !user.visualDirection?.description) { errors.push('schemaVersion 2.0 缺少 visualStyle.forUser.visualDirection'); }
      if (!['top', 'side'].includes(user.navigationStyle?.structure)) { errors.push('visualStyle.forUser.navigationStyle.structure 必须是 top 或 side'); }
      if (!['light', 'dark'].includes(user.navigationStyle?.tone)) { errors.push('visualStyle.forUser.navigationStyle.tone 必须是 light 或 dark'); }
      if (!visual.internal?.selectedTheme?.themeId || !visual.internal?.selectedTheme?.templatePath) { errors.push('schemaVersion 2.0 缺少有效的 visualStyle.internal.selectedTheme'); }
    }
    if (user.selectedTheme) {
      for (const key of ['experienceTopology', 'businessDomain']) { if (!meta?.[key]) { errors.push(`selectedTheme 已存在，但缺少 meta.${key}`); } }
      for (const key of ['themeId', 'templatePath']) { if (!user.selectedTheme[key]) { errors.push(`selectedTheme 已存在，但缺少 ${key}`); } }
      if (!object(user.themeProfile)) { errors.push('selectedTheme 已存在，但缺少 visualStyle.forUser.themeProfile'); }
      if (!Array.isArray(user.pageApplications)) { errors.push('selectedTheme 已存在，但缺少 visualStyle.forUser.pageApplications array'); } else {
        user.pageApplications.forEach((application, index) => { if (!object(application)) { errors.push(`visualStyle.forUser.pageApplications[${index}] 必须是对象`); } else if (!Array.isArray(application.visualMemoryApplications)) { errors.push(`visualStyle.forUser.pageApplications[${index}] 缺少 visualMemoryApplications array`); } });
      }
      if (!object(visual.forDesignMd)) { errors.push('selectedTheme 已存在，但缺少 visualStyle.forDesignMd object'); } else if (!visual.forDesignMd.productTopologyApplication) { errors.push('selectedTheme 已存在，但缺少 visualStyle.forDesignMd.productTopologyApplication'); }
    }
  }
  if (errors.length) { throw new Error('build-plan.json 结构不完整：\n- ' + errors.join('\n- ')); }
}
function renderHtml(data, sections) {
  const renderers = { overview: overviewSection, 'data-models': modelsSection, 'business-flows': flowsSection, pages: pagesSection };
  if (sections) {
    if (sections.some(name => !Object.hasOwn(renderers, name))) { throw new Error('Unknown draft section'); }
    return JSON.stringify(Object.fromEntries(sections.map(name => [name, renderers[name](data)])));
  }
  validatePlan(data);
  const template = fs.readFileSync(path.join(ASSETS, 'build-plan-template.html'), 'utf8');
  const slots = { title: esc(data.meta.appName || data.meta.projectName || 'OpenYida 应用'), nav_items: nav(), content: Object.values(renderers).map(render => render(data)).join('\n') };
  return template.replace(/\{\{(title|nav_items|content)\}\}/g, (_, name) => slots[name]);
}
module.exports = { renderHtml, validatePlan, collectGraph, roundedPath };
function businessGraph(graph, models) {
  const { nodes, relations } = collectGraph(graph, models);
  if (!nodes.length) { return `<div class="graph graph-fallback">${esc(graph.content || '-')}</div>`; }
  const levels = graphLevels(nodes, relations); let groups = new Map();
  for (const node of nodes) { const level = levels.get(node.id); if (!groups.has(level)) { groups.set(level, []); } groups.get(level).push(node); }
  if (Math.max(...[...groups.values()].map(items => items.length)) > 3) {
    groups = new Map(); const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(nodes.length)))), rows = Math.ceil(nodes.length / columns);
    for (let column = 0; column < columns; column++) { const items = nodes.slice(column * rows, (column + 1) * rows); if (items.length) { groups.set(column, items); } }
  }
  const maxLevel = Math.max(...groups.keys()), maxRows = Math.max(...[...groups.values()].map(items => items.length));
  const cardWidth = 154, cardHeight = 36, gapX = Math.max(112, Math.min(180, Math.max(2, ...relations.map(r => [...r.label].length)) * 12 + 48));
  const width = 88 + (maxLevel + 1) * cardWidth + maxLevel * gapX, height = 88 + maxRows * cardHeight + (maxRows - 1) * 24;
  const positions = new Map(), nodeSvg = [];
  for (const level of [...groups.keys()].sort((a, b) => a - b)) {
    const items = groups.get(level), columnHeight = items.length * cardHeight + (items.length - 1) * 24, startY = 44 + Math.max((height - 88 - columnHeight) / 2, 0), x = 44 + level * (cardWidth + gapX);
    items.forEach((node, index) => {
      const y = startY + index * (cardHeight + 24); positions.set(node.id, [x, y]);
      nodeSvg.push(`<g class="object-node" data-node-id="${esc(node.id)}" data-node-name="${esc(node.name)}" role="button" tabindex="0" aria-label="表：${esc(node.name)}，类型：${esc(node.source)}" transform="translate(${x},${y})"><rect class="object-card" width="154" height="36" rx="10"></rect><image class="object-node-icon" href="${esc(formIcon(node.source))}" x="12" y="10" width="16" height="16" aria-hidden="true"></image><text class="object-title" x="36" y="23">${esc(truncate(node.name, 8))}</text></g>`);
    });
  }
  const routes = [], edgeSvg = [], slots = new Map();
  relations.forEach((relation, index) => {
    const [sx, sy] = positions.get(relation.from), [tx, ty] = positions.get(relation.to), startY = sy + 18, endY = ty + 18;
    let startX, endX, controls;
    if (tx > sx) { startX = sx + 154; endX = tx; const trunk = startX + Math.min(32, Math.max(24, (endX - startX) / 2)); controls = startY === endY ? [] : [[trunk, startY], [trunk, endY]]; }
    else if (tx < sx) { startX = sx; endX = tx + 154; const trunk = startX - Math.min(32, Math.max(24, (startX - endX) / 2)); controls = startY === endY ? [] : [[trunk, startY], [trunk, endY]]; }
    else { const slot = slots.get(sx) || 0; slots.set(sx, slot + 1); const lane = sx + 178 + slot % 3 * 10; startX = sx + 154; endX = tx + 154; controls = [[lane, startY], [lane, endY]]; }
    routes.push(controls);
    const route = roundedPath([[startX, startY], ...controls, [endX, endY]]), labelX = controls.length ? controls[0][0] + 8 : (startX + endX) / 2, labelY = controls.length ? (startY + endY) / 2 + 4 : endY - 7;
    edgeSvg.push(`<path class="object-edge" data-edge-id="edge-${index}" data-source="${esc(relation.from)}" data-target="${esc(relation.to)}" data-label="${esc(relation.label)}" d="${route}" marker-end="url(#relationArrow)"><title>${esc(relation.label)}</title></path><text class="object-edge-label" x="${labelX}" y="${labelY}" text-anchor="${controls.length ? 'start' : 'middle'}"><title>${esc(relation.label)}</title>${esc(truncate(relation.label, 10))}</text>`);
  });
  const data = {
    nodes: nodes.map(node => ({ id: node.id, data: { name: node.name, source: node.source, iconSrc: formIcon(node.source), group: node.group }, style: { x: positions.get(node.id)[0] + 77, y: positions.get(node.id)[1] + 18 } })),
    edges: relations.map((r, index) => ({ id: `edge-${index}`, source: r.from, target: r.to, data: { label: r.label }, controlPoints: routes[index] })),
  };
  const names = new Map(nodes.map(node => [node.id, node.name]));
  const relationItems = relations.map((r, index) => `<button class="object-relation-item" type="button" data-edge-id="edge-${index}" data-source="${esc(r.from)}" data-target="${esc(r.to)}"><span class="object-relation-source">${esc(names.get(r.from))}</span><span class="object-relation-label">${esc(r.label)}</span><span class="object-relation-target">${esc(names.get(r.to))}</span></button>`).join('');
  const actions = [['zoom-out', '缩小业务全景图', '缩小', 'graph-zoom-out.svg', ''], ['zoom-in', '放大业务全景图', '放大', 'graph-zoom-in.svg', ''], ['zoom-fit', '完整显示业务全景图', '适应画布', 'graph-fit.svg', ''], ['fullscreen', '全屏查看业务全景图', '全屏查看', 'graph-fit.svg', '全屏'], ['clear', '显示全部业务关系', '全部关系', 'graph-relations.svg', '全部关系']].map(([action, label, title, image, text], index) => `${index === 1 ? '<span class="object-graph-zoom-value" aria-live="polite">100%</span>' : ''}<button class="object-graph-zoom-button ${text ? 'has-label' : 'is-icon-only'}" type="button" data-graph-${action} aria-label="${label}" title="${title}"${action === 'fullscreen' ? ' aria-pressed="false"' : ''}><img class="object-graph-action-icon" src="${esc(icon(image))}" alt="" aria-hidden="true" />${text ? `<span>${text}</span>` : ''}</button>`).join('');
  return `<div class="object-graph-component" data-business-graph><div class="object-graph" data-graph-zoom style="--graph-height:${height + 60}px;--graph-width:${width}px;--graph-content-height:${height}px"><div class="object-graph-toolbar" role="group" aria-label="业务全景图缩放控制"><span class="object-graph-status" data-graph-status>选择一张表，可聚焦查看关联关系</span><div class="object-graph-actions">${actions}</div></div><div class="object-graph-viewport" role="img" tabindex="0" aria-label="业务全景图：全部表以及表之间的关系。可使用加号、减号和数字 0 调整缩放。"><div class="object-graph-g6" data-g6-mount aria-hidden="true"></div><div class="object-graph-fallback"><div class="object-graph-stage"><svg class="object-graph-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><defs><filter id="cardShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#181c1f" flood-opacity="0.08"/></filter><marker id="relationArrow" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M 1 1.5 L 6.5 4 L 1 6.5" fill="none" stroke="context-stroke" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"></path></marker></defs>${edgeSvg.join('')}${nodeSvg.join('')}</svg></div></div></div></div><script class="object-graph-data" type="application/json">${JSON.stringify(data).replace(/<\//g, '<\\/')}</script><div class="object-graph-relations"><div class="object-graph-relations-head"><strong>关系清单</strong><span>点击一条关系可在图中定位</span></div><div class="object-relation-list">${relationItems}</div></div></div>`;
}
