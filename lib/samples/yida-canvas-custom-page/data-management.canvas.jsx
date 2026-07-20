/**
 * Yida multidimensional data management Code Canvas template
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 */

import React, { useMemo, useState } from 'react';
import { Button, ConfigProvider, Input, Tag, Typography, message } from 'antd';

const { Text, Title } = Typography;

const PAGE = {
  brandName: '{{BRAND_NAME}}',
  brandInitials: '{{BRAND_INITIALS}}',
  tagline: '{{TAGLINE}}',
  heroText: '{{HERO_TEXT}}',
  primaryCta: '{{PRIMARY_CTA}}',
  secondaryCta: '{{SECONDARY_CTA}}',
  featuresTitle: '{{FEATURES_TITLE}}',
  roadmapTitle: '{{ROADMAP_TITLE}}',
  ctaTitle: '{{CTA_TITLE}}',
  ctaText: '{{CTA_TEXT}}',
};

const TOKENS = {
  brandName: '{' + '{BRAND_NAME}' + '}',
  brandInitials: '{' + '{BRAND_INITIALS}' + '}',
  tagline: '{' + '{TAGLINE}' + '}',
  heroText: '{' + '{HERO_TEXT}' + '}',
  primaryCta: '{' + '{PRIMARY_CTA}' + '}',
  secondaryCta: '{' + '{SECONDARY_CTA}' + '}',
  featuresTitle: '{' + '{FEATURES_TITLE}' + '}',
  roadmapTitle: '{' + '{ROADMAP_TITLE}' + '}',
  ctaTitle: '{' + '{CTA_TITLE}' + '}',
  ctaText: '{' + '{CTA_TEXT}' + '}',
  featuresJson: '{' + '{FEATURES_JSON}' + '}',
  metricsJson: '{' + '{METRICS_JSON}' + '}',
  roadmapJson: '{' + '{ROADMAP_JSON}' + '}',
  visualProfileJson: '{' + '{OPENYIDA_VISUAL_PROFILE_JSON}' + '}',
  themeProfileJson: '{' + '{OPENYIDA_THEME_PROFILE_JSON}' + '}',
  themeScope: '{' + '{OPENYIDA_THEME_SCOPE}' + '}',
  appBlueprintJson: '{' + '{OPENYIDA_APP_BLUEPRINT_JSON}' + '}',
  interactionProfileJson: '{' + '{OPENYIDA_INTERACTION_PROFILE_JSON}' + '}',
  insightsJson: '{' + '{OPENYIDA_INSIGHTS_JSON}' + '}',
  dataBindingJson: '{' + '{OPENYIDA_DATA_BINDING_JSON}' + '}',
  archetype: '{' + '{OPENYIDA_ARCHETYPE}' + '}',
  researchLevel: '{' + '{OPENYIDA_RESEARCH_LEVEL}' + '}',
};

function isTemplateToken(value) {
  return typeof value === 'string' && /^\{\{[A-Z0-9_]+\}\}$/.test(value);
}

function withFallback(value, token, fallback) {
  return value && value !== token && !isTemplateToken(value) ? value : fallback;
}

function parseTemplateJson(raw, fallback) {
  if (!raw || isTemplateToken(raw)) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed : fallback;
    }
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (err) {
    return fallback;
  }
}

function applyPageFallbacks(fallbacks) {
  Object.keys(fallbacks).forEach((key) => {
    PAGE[key] = withFallback(PAGE[key], TOKENS[key], fallbacks[key]);
  });
}

applyPageFallbacks({
  brandName: '多维数据管理',
  brandInitials: 'DM',
  tagline: '像多维表一样管理任务、字段、分组和状态',
  heroText: '参考飞书与钉钉多维表的高密度表格体验，把视图切换、字段配置、筛选、分组、标签、状态和批量操作组织成一个真实的数据管理样板。',
  primaryCta: '添加记录',
  secondaryCta: '分享视图',
  featuresTitle: '全部数据',
  roadmapTitle: '本周协作节奏',
  ctaTitle: '字段与视图配置',
  ctaText: '用于任务台账、项目排期、运营需求池、客户跟进和研发治理等数据管理场景。',
});

const DEFAULT_FEATURES = [
  { title: 'openyida skill治理', text: '完成技能索引治理、引用检查和发布前自测。' },
  { title: '公式校验问题修复&测试&发布', text: '补齐异常案例，完成回归验证并同步发布。' },
  { title: 'npm外置链路方案-服务端oss', text: '梳理静态资源链路、上传策略和回退逻辑。' },
];
const DEFAULT_METRICS = [
  { label: '总记录', value: '148', hint: '按单选字段分 6 组' },
  { label: '本周完成', value: '73%', hint: '+12 条已归档' },
  { label: '字段数', value: '18', hint: '4 个公式字段' },
  { label: '协作成员', value: '26', hint: '7 人今日更新' },
];
const DEFAULT_ROADMAP = [
  { stage: '09:30', title: '按负责人拉齐任务', text: '同步研发、测试、发布和设计任务状态。' },
  { stage: '11:20', title: '筛出高优先级', text: '只看逾期、阻塞和本周必须交付的记录。' },
  { stage: '15:00', title: '批量补充字段', text: '给需求池补齐标签、重要程度和备注。' },
];
const DEFAULT_VISUAL_PROFILE = { name: 'multidim-table', density: 'data-compact', motif: ['view-tabs', 'field-toolbar', 'grouped-grid'] };
const DEFAULT_THEME_PROFILE = { followRuntimeTheme: false, name: 'teal-data-studio', themeColor: '#0F766E', themeColorDeep: '#0B4F49', themeColorSoft: '#E6FFFA', themeColorTint: 'rgba(15, 118, 110, 0.16)', palette: ['#0F766E', '#2563EB', '#F59E0B', '#DB2777', '#65A30D'] };
const DEFAULT_APP_BLUEPRINT = { shell: 'data-management', views: ['全部数据', '看板', '日历', '自动化'] };
const DEFAULT_INTERACTION_PROFILE = { primaryAction: '添加记录', bulkActions: ['字段管理', '筛选', '按单选分组', '排序', '行高', '填色'] };
const DEFAULT_INSIGHTS = [
  {
    conclusion: '用表格承载主要工作，不要把数据管理页做成普通卡片墙。',
    suggestion: '首屏保留字段工具条、横向滚动表格、分组行和批量操作，用户能立刻理解这是数据管理场景。',
  },
];
const DEFAULT_DATA_BINDING = { enabled: false, mode: 'seed' };

const FEATURES = parseTemplateJson('{{FEATURES_JSON}}', DEFAULT_FEATURES);
const METRICS = parseTemplateJson('{{METRICS_JSON}}', DEFAULT_METRICS);
const ROADMAP = parseTemplateJson('{{ROADMAP_JSON}}', DEFAULT_ROADMAP);
const VISUAL_PROFILE = parseTemplateJson('{{OPENYIDA_VISUAL_PROFILE_JSON}}', DEFAULT_VISUAL_PROFILE);
const THEME_PROFILE = parseTemplateJson('{{OPENYIDA_THEME_PROFILE_JSON}}', DEFAULT_THEME_PROFILE);
const THEME_SCOPE = withFallback('{{OPENYIDA_THEME_SCOPE}}', TOKENS.themeScope, 'page');
const APP_BLUEPRINT = parseTemplateJson('{{OPENYIDA_APP_BLUEPRINT_JSON}}', DEFAULT_APP_BLUEPRINT);
const INTERACTION_PROFILE = parseTemplateJson('{{OPENYIDA_INTERACTION_PROFILE_JSON}}', DEFAULT_INTERACTION_PROFILE);
const INSIGHTS = parseTemplateJson('{{OPENYIDA_INSIGHTS_JSON}}', DEFAULT_INSIGHTS);
const DATA_BINDING = parseTemplateJson('{{OPENYIDA_DATA_BINDING_JSON}}', DEFAULT_DATA_BINDING);
const ARCHETYPE = withFallback('{{OPENYIDA_ARCHETYPE}}', TOKENS.archetype, 'multidim-table');
const RESEARCH_LEVEL = withFallback('{{OPENYIDA_RESEARCH_LEVEL}}', TOKENS.researchLevel, 'sample');

function readBrandColor(level, fallback) {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--color-brand1-' + (level || 6)).trim();
    return value || fallback;
  } catch (err) {
    return fallback;
  }
}

function getThemeColor(profile, key, fallback) {
  const levels = { themeColor: 6, themeColorSoft: 2, themeColorDeep: 9 };
  if (profile && profile.followRuntimeTheme && levels[key]) {
    return readBrandColor(levels[key], fallback);
  }
  return (profile && profile[key]) || fallback;
}

function parseColorGroup(fallback) {
  if (THEME_PROFILE && THEME_PROFILE.followRuntimeTheme === false) {
    return fallback;
  }
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--color-group').trim();
    const colors = value.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/g);
    return colors && colors.length ? colors : fallback;
  } catch (err) {
    return fallback;
  }
}

function buildScopedThemeVars(scope, profile) {
  if (scope !== 'page' || (profile && profile.followRuntimeTheme)) {
    return {};
  }
  return {
    '--color-brand1-6': getThemeColor(profile, 'themeColor', '#0F766E'),
    '--color-brand1-2': getThemeColor(profile, 'themeColorSoft', '#E6FFFA'),
    '--color-brand1-9': getThemeColor(profile, 'themeColorDeep', '#0B4F49'),
  };
}

function applyShellTheme(scope, profile) {
  if (scope !== 'app') {
    return;
  }
  try {
    const updateShellConfig = window && window.__YIDA__ && window.__YIDA__.updateShellConfig;
    if (typeof updateShellConfig === 'function') {
      updateShellConfig({ themeConfig: { themeColor: getThemeColor(profile, 'themeColor', readBrandColor(6, '#0F766E')) } });
    }
  } catch (err) {
    // Optional shell bridge.
  }
}

const BASE_ROWS = [
  { id: 1, group: '20260717-研发治理', task: 'openyida skill治理', progress: '已完成', date: '2026-07-17', tags: ['skill优化', '发布'], priority: 'P1', note: '已完成索引校验', rich: '发布记录已归档' },
  { id: 2, group: '20260717-研发治理', task: '公式校验问题修复&测试&发布', progress: '已完成', date: '2026-07-17', tags: ['bugfix'], priority: 'P1', note: '覆盖边界案例', rich: '补充 8 条用例' },
  { id: 3, group: '20260717-研发治理', task: 'npm外置链路方案-服务端oss', progress: '进行中', date: '2026-07-18', tags: ['技术方案调研'], priority: 'P2', note: '等待链路压测', rich: '需要后端确认' },
  { id: 4, group: '20260717-研发治理', task: '自定义页面升级方案调研&技术方案', progress: '待确认', date: '2026-07-18', tags: ['技术方案'], priority: 'P1', note: '产品评审中', rich: '关联 Canvas 模板' },
  { id: 5, group: '20260717-研发治理', task: 'npm外置链路技术方案', progress: '进行中', date: '2026-07-19', tags: ['技术方案'], priority: 'P2', note: '联调草案', rich: '同步研发负责人' },
  { id: 6, group: '20260717-研发治理', task: 'openyida现有问题整理', progress: '已完成', date: '2026-07-19', tags: ['自测'], priority: 'P3', note: '已分类', rich: '沉淀缺陷池' },
  { id: 7, group: '20260717-体验优化', task: '验证jsx与成员搜索组件的可用性', progress: '已完成', date: '2026-07-20', tags: ['体验优化'], priority: 'P2', note: '验证通过', rich: '补充文档截图' },
  { id: 8, group: '20260717-体验优化', task: '自定义页面基于jsx链路的优化&测试&bugfix', progress: '进行中', date: '2026-07-20', tags: ['bugfix', '自测'], priority: 'P1', note: '回归中', rich: '关注发布链路' },
  { id: 9, group: '20260717-体验优化', task: '自定义页面优化fix自测&bugfix&优化', progress: '待确认', date: '2026-07-21', tags: ['发布'], priority: 'P2', note: '等待验收', rich: '需设计确认' },
  { id: 10, group: '20260717-体验优化', task: 'skill治理自测', progress: '已完成', date: '2026-07-21', tags: ['自测', '发布'], priority: 'P3', note: '清单完成', rich: '无阻塞' },
  { id: 11, group: '20260717-发布准备', task: '导航顺序首次优化', progress: '已完成', date: '2026-07-22', tags: ['体验优化'], priority: 'P2', note: '排序已同步', rich: '影响 3 个入口' },
  { id: 12, group: '20260717-发布准备', task: 'skill内容再治理', progress: '进行中', date: '2026-07-22', tags: ['skill优化'], priority: 'P1', note: '重点检查技能路由', rich: '预计今日完成' },
  { id: 13, group: '20260717-发布准备', task: '登录态路径优化', progress: '待确认', date: '2026-07-23', tags: ['bugfix'], priority: 'P1', note: '需真实账号验证', rich: '风险待复核' },
  { id: 14, group: '20260717-发布准备', task: '再优化内容自测（3个线上应用搭建/3个场景）', progress: '进行中', date: '2026-07-23', tags: ['发布', '体验优化'], priority: 'P1', note: '准备同步线上', rich: '示例应用待更新' },
];

function createRowsFromFeatures(features) {
  if (!features || !features.length) {
    return BASE_ROWS;
  }
  return BASE_ROWS.map((row, index) => {
    const item = features[index % features.length];
    return {
      ...row,
      task: item.title || row.task,
      note: item.text || row.note,
    };
  });
}

function Icon({ name }) {
  const paths = {
    table: 'M3 5h18v14H3z M3 9h18 M8 5v14',
    board: 'M4 5h7v14H4z M13 5h7v6h-7z M13 13h7v6h-7z',
    plus: 'M12 5v14 M5 12h14',
    field: 'M4 6h16 M4 12h16 M4 18h10',
    filter: 'M4 6h16l-6 7v5l-4 2v-7z',
    group: 'M7 7h10 M7 12h10 M7 17h10 M4 7h.01 M4 12h.01 M4 17h.01',
    sort: 'M8 6v12 M5 15l3 3 3-3 M16 18V6 M13 9l3-3 3 3',
    search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z M16 16l4 4',
    bell: 'M6 17h12l-1.5-2.5V10a4.5 4.5 0 0 0-9 0v4.5z M10 20h4',
    text: 'M5 6h14 M12 6v12 M8 18h8',
    tag: 'M4 6h8l8 8-6 6-8-8z M8 9h.01',
    calendar: 'M5 5h14v15H5z M8 3v4 M16 3v4 M5 10h14',
    check: 'M20 6 9 17l-5-5',
  };
  return (
    <svg className="oy-data-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.table} />
    </svg>
  );
}

function StatusTag({ value }) {
  const map = {
    已完成: { color: '#65A30D', bg: '#ECFCCB' },
    进行中: { color: '#2563EB', bg: '#DBEAFE' },
    待确认: { color: '#B45309', bg: '#FEF3C7' },
  };
  const token = map[value] || map['进行中'];
  return <span className="oy-status-pill" style={{ color: token.color, background: token.bg }}>{value}</span>;
}

function PriorityTag({ value }) {
  const map = {
    P1: '#DB2777',
    P2: '#F59E0B',
    P3: '#0F766E',
  };
  return <span className="oy-priority-dot" style={{ '--oy-priority': map[value] || '#2563EB' }}>{value}</span>;
}

function FieldTags({ tags, palette }) {
  return (
    <div className="oy-field-tags">
      {tags.map((tag, index) => (
        <span className="oy-field-tag" style={{ '--tag-color': palette[index % palette.length] }} key={tag}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function ViewTabs({ views, activeView, onChange, onAddView }) {
  return (
    <div className="oy-data-tabs">
      {(views && views.length ? views : ['全部数据', '看板', '日历']).slice(0, 4).map((view) => (
        <button type="button" className={activeView === view ? 'is-active' : ''} onClick={() => onChange(view)} key={view}>
          <Icon name={view === '看板' ? 'board' : 'table'} />
          <span>{view}</span>
        </button>
      ))}
      <button type="button" className="oy-tab-icon" aria-label="新增视图" onClick={onAddView}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

function Toolbar({ primaryAction, selectedCount, statusFilter, sortDir, grouped, density, colorize, sidebarOpen, onAdd, onCycleStatus, onCycleSort, onToggleGroup, onCycleDensity, onToggleColor, onToggleSidebar }) {
  const densityLabel = { normal: '适中', compact: '紧凑', tall: '宽松' };
  const controls = [
    { key: 'field', icon: 'field', label: '字段管理', active: sidebarOpen, onClick: onToggleSidebar },
    { key: 'filter', icon: 'filter', label: statusFilter === 'all' ? '筛选' : '筛选·' + statusFilter, active: statusFilter !== 'all', onClick: onCycleStatus },
    { key: 'group', icon: 'group', label: grouped ? '取消分组' : '按单选分组', active: grouped, onClick: onToggleGroup },
    { key: 'sort', icon: 'sort', label: sortDir === 'none' ? '排序' : (sortDir === 'asc' ? '日期升序' : '日期降序'), active: sortDir !== 'none', onClick: onCycleSort },
    { key: 'density', icon: 'table', label: '行高·' + densityLabel[density], active: density !== 'normal', onClick: onCycleDensity },
    { key: 'color', icon: 'tag', label: colorize ? '取消填色' : '按状态填色', active: colorize, onClick: onToggleColor },
  ];
  return (
    <div className="oy-data-toolbar">
      <Button type="primary" size="small" icon={<Icon name="plus" />} onClick={onAdd}>{primaryAction}</Button>
      <div className="oy-toolbar-divider" />
      {controls.map((control) => (
        <button type="button" className={control.active ? 'is-active' : ''} onClick={control.onClick} key={control.key}>
          <Icon name={control.icon} />
          <span>{control.label}</span>
        </button>
      ))}
      <div className="oy-toolbar-spacer" />
      <Text type="secondary">{selectedCount ? '已选 ' + selectedCount + ' 条' : '自动保存'}</Text>
    </div>
  );
}

function GroupHeader({ label, group, count, collapsed, onToggle }) {
  return (
    <button type="button" className="oy-group-row" onClick={onToggle}>
      <div className="oy-group-cell">
        <span className={collapsed ? 'oy-caret is-collapsed' : 'oy-caret'} />
        <span className="oy-group-label">{label}</span>
        <span className="oy-group-name">{group}</span>
      </div>
      <span className="oy-group-count">{count} 条记录</span>
    </button>
  );
}

function DataHeader() {
  const columns = [
    { icon: 'check', label: '' },
    { icon: 'table', label: '待办内容' },
    { icon: 'check', label: '任务进度' },
    { icon: 'calendar', label: '日期' },
    { icon: 'tag', label: '属性标签' },
    { icon: 'check', label: '重要程度' },
    { icon: 'text', label: '备注' },
    { icon: 'text', label: '富文本' },
  ];
  return (
    <div className="oy-data-row oy-data-header">
      {columns.map((column, index) => (
        <div className={index < 2 ? 'oy-data-cell is-sticky' : 'oy-data-cell'} key={column.label || 'select'}>
          {column.label ? <><Icon name={column.icon} /><span>{column.label}</span></> : <span className="oy-head-checkbox" />}
        </div>
      ))}
    </div>
  );
}

function DataRow({ row, selected, onToggle, palette, density, colorize }) {
  const statusBg = { 已完成: '#F1FBE9', 进行中: '#EFF4FE', 待确认: '#FEF6E7' };
  const rowStyle = colorize ? { '--oy-row-bg': statusBg[row.progress] || '#FFFFFF' } : {};
  const className = 'oy-data-row is-' + (density || 'normal') + (selected ? ' is-selected' : '') + (colorize ? ' is-colorized' : '');
  return (
    <div className={className} style={rowStyle}>
      <div className="oy-data-cell is-index is-sticky">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={'选择 ' + row.task} />
        <span>{row.id}</span>
      </div>
      <div className="oy-data-cell is-task is-sticky">
        <span className="oy-file-icon" />
        <Text strong>{row.task}</Text>
      </div>
      <div className="oy-data-cell"><StatusTag value={row.progress} /></div>
      <div className="oy-data-cell"><Text>{row.date}</Text></div>
      <div className="oy-data-cell"><FieldTags tags={row.tags} palette={palette} /></div>
      <div className="oy-data-cell"><PriorityTag value={row.priority} /></div>
      <div className="oy-data-cell"><Text>{row.note}</Text></div>
      <div className="oy-data-cell"><Text>{row.rich}</Text></div>
    </div>
  );
}

function MetricStrip({ metrics }) {
  return (
    <section className="oy-data-metrics">
      {metrics.slice(0, 4).map((metric) => (
        <div className="oy-data-metric" key={metric.label}>
          <Text type="secondary">{metric.label}</Text>
          <strong>{metric.value}</strong>
          <span>{metric.hint || '实时同步'}</span>
        </div>
      ))}
    </section>
  );
}

function Sidebar({ roadmap, insight, dataBinding }) {
  return (
    <aside className="oy-data-sidebar">
      <div className="oy-side-block">
        <Text type="secondary">{PAGE.ctaTitle}</Text>
        <Title level={4}>视图字段</Title>
        {['任务进度', '属性标签', '重要程度', '负责人', '自动编号'].map((field) => (
          <div className="oy-field-config" key={field}>
            <span>{field}</span>
            <Tag>{field === '负责人' ? '成员' : field === '自动编号' ? '公式' : '单选'}</Tag>
          </div>
        ))}
      </div>
      <div className="oy-side-block">
        <Text type="secondary">{PAGE.roadmapTitle}</Text>
        {roadmap.slice(0, 3).map((item) => (
          <div className="oy-timeline-item" key={item.stage}>
            <strong>{item.stage}</strong>
            <div>
              <Text strong>{item.title}</Text>
              <p>{item.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="oy-side-block is-insight">
        <Tag color="cyan">{ARCHETYPE}</Tag>
        <p>{insight.suggestion || PAGE.ctaText}</p>
        {dataBinding && dataBinding.enabled ? <Text type="secondary">已配置真实数据源</Text> : <Text type="secondary">当前使用演示数据，可通过 dataBinding 接入宜搭表单。</Text>}
      </div>
    </aside>
  );
}

const DIMENSION_BY_VIEW = { '全部数据': 'group', '看板': 'progress', '日历': 'date', '自动化': 'priority' };
const DIMENSION_LABEL = { group: '单选', progress: '状态', date: '日期', priority: '优先级' };

function YidaComp() {
  const [activeView, setActiveView] = useState((APP_BLUEPRINT.views && APP_BLUEPRINT.views[0]) || '全部数据');
  const seedRows = useMemo(() => createRowsFromFeatures(FEATURES), []);
  const [rows, setRows] = useState(seedRows);
  const [selected, setSelected] = useState([1, 2]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortDir, setSortDir] = useState('none');
  const [grouped, setGrouped] = useState(true);
  const [density, setDensity] = useState('normal');
  const [colorize, setColorize] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collapsed, setCollapsed] = useState([]);
  React.useEffect(() => {
    applyShellTheme(THEME_SCOPE, THEME_PROFILE);
  }, []);

  const brand = getThemeColor(THEME_PROFILE, 'themeColor', readBrandColor(6, '#0F766E'));
  const brandDeep = getThemeColor(THEME_PROFILE, 'themeColorDeep', readBrandColor(9, '#0B4F49'));
  const brandSoft = getThemeColor(THEME_PROFILE, 'themeColorSoft', readBrandColor(2, '#E6FFFA'));
  const palette = parseColorGroup(THEME_PROFILE.palette || [brand, '#2563EB', '#F59E0B', '#DB2777', '#65A30D']);
  const insight = INSIGHTS[0] || {};
  const primaryAction = INTERACTION_PROFILE.primaryAction || PAGE.primaryCta;
  const themeVars = buildScopedThemeVars(THEME_SCOPE, THEME_PROFILE);
  const dimension = DIMENSION_BY_VIEW[activeView] || 'group';

  const kw = keyword.trim().toLowerCase();
  let viewRows = rows.filter((row) => {
    if (statusFilter !== 'all' && row.progress !== statusFilter) { return false; }
    if (kw) {
      const hay = (row.task + ' ' + row.note + ' ' + row.rich + ' ' + row.group + ' ' + row.priority + ' ' + (row.tags || []).join(' ')).toLowerCase();
      if (hay.indexOf(kw) < 0) { return false; }
    }
    return true;
  });
  if (sortDir !== 'none') {
    viewRows = viewRows.slice().sort((a, b) => {
      if (a.date === b.date) { return 0; }
      const asc = a.date < b.date ? -1 : 1;
      return sortDir === 'asc' ? asc : -asc;
    });
  }

  function groupKeyOf(row) {
    if (dimension === 'progress') { return row.progress; }
    if (dimension === 'priority') { return row.priority; }
    if (dimension === 'date') { return row.date; }
    return row.group;
  }
  const groupList = [];
  if (grouped) {
    const bucket = {};
    const order = [];
    viewRows.forEach((row) => {
      const key = groupKeyOf(row);
      if (!bucket[key]) { bucket[key] = []; order.push(key); }
      bucket[key].push(row);
    });
    order.forEach((key) => groupList.push({ key: key, rows: bucket[key] }));
  } else {
    groupList.push({ key: null, rows: viewRows });
  }

  function toggleSelected(id) {
    setSelected((current) => current.indexOf(id) >= 0 ? current.filter((item) => item !== id) : current.concat(id));
  }
  function cycleStatus() {
    const seq = ['all', '已完成', '进行中', '待确认'];
    setStatusFilter((cur) => seq[(seq.indexOf(cur) + 1) % seq.length]);
  }
  function cycleSort() {
    const seq = ['none', 'asc', 'desc'];
    setSortDir((cur) => seq[(seq.indexOf(cur) + 1) % seq.length]);
  }
  function cycleDensity() {
    const seq = ['normal', 'compact', 'tall'];
    setDensity((cur) => seq[(seq.indexOf(cur) + 1) % seq.length]);
  }
  function toggleGroupCollapse(key) {
    setCollapsed((cur) => cur.indexOf(key) >= 0 ? cur.filter((item) => item !== key) : cur.concat(key));
  }
  function addRecord() {
    const nextId = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
    const groupName = (rows[0] && rows[0].group) || '20260717-研发治理';
    const record = { id: nextId, group: groupName, task: '新任务 ' + nextId, progress: '待确认', date: '2026-07-17', tags: ['新建'], priority: 'P2', note: '待补充', rich: '' };
    setRows([record].concat(rows));
    setSelected(selected.concat(nextId));
    if (message && message.success) { message.success('已新增一条记录，已自动选中'); }
  }
  function notify(text) {
    if (message && message.info) { message.info(text); }
  }

  return (
    <ConfigProvider getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body} theme={{ token: { colorPrimary: brand, borderRadius: 8 } }}>
      <main
        className="oy-data-management"
        data-profile={VISUAL_PROFILE.name}
        data-theme-scope={THEME_SCOPE}
        style={{
          ...themeVars,
          '--oy-brand': brand,
          '--oy-brand-deep': brandDeep,
          '--oy-brand-soft': brandSoft,
          '--oy-accent-blue': palette[1],
          '--oy-accent-warm': palette[2],
          '--oy-accent-rose': palette[3],
          '--oy-accent-green': palette[4],
        }}
      >
        <style>{`
          {{OPENYIDA_CANVAS_CONTROL_CSS}}
          .oy-data-management {
            min-height: 100vh;
            color: #1B2738;
            background:
              linear-gradient(180deg, #FFF7ED 0, #F6FFFC 92px, #FFFFFF 360px),
              radial-gradient(circle at 86% 4%, rgba(15,118,110,.16), transparent 32%);
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
            letter-spacing: 0;
          }
          .oy-data-icon {
            width: 16px;
            height: 16px;
            fill: none;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            flex: 0 0 auto;
          }
          .oy-data-shell {
            min-height: 100vh;
            display: grid;
            grid-template-rows: auto auto auto minmax(0, 1fr);
          }
          .oy-data-topbar {
            height: 52px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 0 22px;
            border-bottom: 1px solid rgba(138, 153, 170, .28);
            background: rgba(255, 255, 255, .86);
            backdrop-filter: blur(18px);
            position: sticky;
            top: 0;
            z-index: 9;
          }
          .oy-data-tabs {
            display: flex;
            align-items: center;
            gap: 4px;
            min-width: 0;
          }
          .oy-data-tabs button,
          .oy-data-toolbar button {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 30px;
            border: 0;
            border-radius: 6px;
            padding: 0 10px;
            color: #506077;
            background: transparent;
            font: inherit;
            font-weight: 650;
            cursor: pointer;
            white-space: nowrap;
          }
          .oy-data-tabs button.is-active {
            color: #152033;
            background: #FFFFFF;
            box-shadow: 0 1px 0 rgba(138,153,170,.22), 0 10px 30px rgba(43,52,64,.08);
          }
          .oy-tab-icon {
            width: 30px;
            justify-content: center;
            padding: 0;
          }
          .oy-top-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }
          .oy-top-actions .ant-input-affix-wrapper,
          .oy-top-actions .ant-input {
            width: 220px;
            border-radius: 8px;
          }
          .oy-data-toolbar {
            min-height: 48px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 22px;
            border-bottom: 1px solid rgba(138, 153, 170, .28);
            background: rgba(255, 255, 255, .74);
            overflow-x: auto;
          }
          .oy-data-toolbar button:hover {
            background: rgba(15,118,110,.08);
            color: var(--oy-brand-deep);
          }
          .oy-data-toolbar button.is-highlight {
            background: color-mix(in srgb, var(--oy-brand) 14%, #FFFFFF);
            color: var(--oy-brand-deep);
          }
          .oy-data-toolbar button.is-active {
            background: color-mix(in srgb, var(--oy-brand) 16%, #FFFFFF);
            color: var(--oy-brand-deep);
            box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--oy-brand) 32%, #FFFFFF);
          }
          .oy-toolbar-divider {
            width: 1px;
            height: 24px;
            background: rgba(138,153,170,.35);
            margin: 0 4px;
          }
          .oy-toolbar-spacer { flex: 1; }
          .oy-data-intro {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 18px;
            align-items: end;
            padding: 20px 22px 16px;
          }
          .oy-data-kicker {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 8px;
          }
          .oy-data-intro h2 {
            margin: 0;
            color: #142235;
            font-size: 28px;
            line-height: 36px;
            font-weight: 850;
          }
          .oy-data-intro p {
            max-width: 850px;
            margin: 8px 0 0;
            color: #5B687B;
            line-height: 24px;
          }
          .oy-data-metrics {
            display: grid;
            grid-template-columns: repeat(4, minmax(150px, 1fr));
            gap: 10px;
            min-width: 660px;
          }
          .oy-data-metric {
            padding: 14px 14px 12px;
            border: 1px solid rgba(138,153,170,.24);
            border-radius: 8px;
            background: rgba(255,255,255,.82);
            box-shadow: 0 14px 34px rgba(43,52,64,.06);
          }
          .oy-data-metric strong {
            display: block;
            margin: 8px 0 4px;
            color: var(--oy-brand-deep);
            font-size: 25px;
            line-height: 28px;
            font-variant-numeric: tabular-nums;
          }
          .oy-data-metric span {
            color: #718096;
            font-size: 12px;
            font-weight: 650;
          }
          .oy-data-workspace {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 288px;
            gap: 12px;
            min-height: 0;
            padding: 0 22px 22px;
          }
          .oy-data-workspace.is-full {
            grid-template-columns: minmax(0, 1fr);
          }
          .oy-data-empty {
            min-width: 1688px;
            padding: 40px 22px;
            text-align: center;
            color: #718096;
            font-weight: 650;
            background: #FFFFFF;
          }
          .oy-table-panel,
          .oy-data-sidebar {
            border: 1px solid rgba(138,153,170,.30);
            border-radius: 8px;
            background: rgba(255,255,255,.90);
            box-shadow: 0 20px 48px rgba(43,52,64,.08);
            overflow: hidden;
          }
          .oy-table-scroll {
            width: 100%;
            min-height: 520px;
            overflow: auto;
          }
          .oy-data-row {
            display: grid;
            grid-template-columns: 58px 380px 160px 150px 250px 150px 260px 280px;
            min-width: 1688px;
          }
          .oy-data-header {
            position: sticky;
            top: 0;
            z-index: 5;
            background: #FBFCFD;
          }
          .oy-data-cell {
            min-height: 42px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 0 10px;
            border-right: 1px solid rgba(138,153,170,.28);
            border-bottom: 1px solid rgba(138,153,170,.28);
            background: rgba(255,255,255,.76);
            color: #263245;
            overflow: hidden;
          }
          .oy-data-header .oy-data-cell {
            color: #263245;
            font-weight: 800;
            background: #FAFBFC;
          }
          .oy-data-cell.is-sticky {
            position: sticky;
            z-index: 4;
          }
          .oy-data-cell.is-index {
            left: 0;
            justify-content: center;
            color: #8A96A8;
            background: #FFFFFF;
          }
          .oy-data-header .oy-data-cell:first-child {
            left: 0;
            background: #FAFBFC;
          }
          .oy-data-cell.is-task,
          .oy-data-header .oy-data-cell:nth-child(2) {
            left: 58px;
            background: #FFFFFF;
            box-shadow: 12px 0 20px rgba(43,52,64,.04);
          }
          .oy-data-header .oy-data-cell:nth-child(2) {
            background: #FAFBFC;
          }
          .oy-data-row.is-colorized .oy-data-cell {
            background: var(--oy-row-bg);
          }
          .oy-data-row.is-compact .oy-data-cell { min-height: 34px; }
          .oy-data-row.is-tall .oy-data-cell { min-height: 56px; }
          .oy-data-row.is-selected .oy-data-cell {
            background: #F0FDFA;
          }
          .oy-data-cell .ant-typography {
            margin: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .oy-head-checkbox {
            width: 18px;
            height: 18px;
            border: 2px solid #CBD5E1;
            border-radius: 5px;
            background: #fff;
          }
          .oy-file-icon {
            width: 16px;
            height: 18px;
            border: 1.8px solid #CBD5E1;
            border-radius: 4px;
            background: linear-gradient(135deg, #FFFFFF 72%, #EEF2F7 0);
            flex: 0 0 auto;
          }
          .oy-status-pill {
            min-width: 72px;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            min-height: 24px;
            padding: 0 10px;
            border-radius: 999px;
            font-weight: 850;
            line-height: 1;
            white-space: nowrap;
          }
          .oy-field-tags {
            display: flex;
            gap: 6px;
            align-items: center;
            min-width: 0;
            overflow: hidden;
          }
          .oy-field-tag {
            max-width: 100px;
            padding: 3px 8px;
            border-radius: 999px;
            color: color-mix(in srgb, var(--tag-color), #1B2738 26%);
            background: color-mix(in srgb, var(--tag-color) 18%, #FFFFFF);
            font-size: 12px;
            font-weight: 750;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .oy-priority-dot {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            color: #263245;
            font-weight: 800;
          }
          .oy-priority-dot:before {
            content: "";
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--oy-priority);
          }
          .oy-group-row {
            width: 100%;
            min-width: 1688px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            height: 58px;
            padding: 0 22px 0 58px;
            border: 0;
            border-bottom: 1px solid rgba(138,153,170,.28);
            background: linear-gradient(90deg, #FFFFFF 0, #F8FBFA 100%);
            cursor: pointer;
            font: inherit;
            color: inherit;
            text-align: left;
          }
          .oy-group-row:hover {
            background: linear-gradient(90deg, #F6FFFC 0, #EFF7F4 100%);
          }
          .oy-group-cell {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .oy-caret {
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 6px solid #9AA6B7;
            transition: transform .15s ease;
          }
          .oy-caret.is-collapsed {
            transform: rotate(-90deg);
          }
          .oy-group-label {
            color: #8A96A8;
            font-size: 12px;
            font-weight: 700;
          }
          .oy-group-name {
            display: inline-flex;
            align-items: center;
            min-height: 28px;
            padding: 0 12px;
            border-radius: 999px;
            color: #34566B;
            background: #DBEAFE;
            font-weight: 850;
          }
          .oy-group-count {
            color: #718096;
            font-size: 13px;
            font-weight: 700;
          }
          .oy-add-row {
            min-width: 1688px;
            height: 42px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding-left: 58px;
            color: #718096;
            border-bottom: 1px solid rgba(138,153,170,.20);
            background: #FFFFFF;
          }
          .oy-add-row button {
            border: 0;
            background: transparent;
            color: var(--oy-brand-deep);
            font-weight: 800;
            cursor: pointer;
          }
          .oy-data-sidebar {
            padding: 12px;
            display: grid;
            align-content: start;
            gap: 10px;
          }
          .oy-side-block {
            padding: 14px;
            border: 1px solid rgba(138,153,170,.22);
            border-radius: 8px;
            background: #FFFFFF;
          }
          .oy-side-block h4 {
            margin: 5px 0 12px;
          }
          .oy-field-config {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-height: 34px;
            border-top: 1px solid #EEF2F7;
          }
          .oy-timeline-item {
            display: grid;
            grid-template-columns: 48px 1fr;
            gap: 10px;
            padding: 12px 0;
            border-top: 1px solid #EEF2F7;
          }
          .oy-timeline-item strong {
            color: var(--oy-brand-deep);
            font-variant-numeric: tabular-nums;
          }
          .oy-timeline-item p,
          .oy-side-block p {
            margin: 4px 0 0;
            color: #64748B;
            line-height: 20px;
          }
          .oy-side-block.is-insight {
            background: linear-gradient(180deg, #F0FDFA, #FFFFFF);
          }
          @media (max-width: 1180px) {
            .oy-data-intro,
            .oy-data-workspace {
              grid-template-columns: 1fr;
            }
            .oy-data-metrics {
              min-width: 0;
              grid-template-columns: repeat(2, minmax(150px, 1fr));
            }
            .oy-data-sidebar {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
          @media (max-width: 760px) {
            .oy-data-topbar,
            .oy-data-toolbar,
            .oy-data-intro,
            .oy-data-workspace {
              padding-left: 14px;
              padding-right: 14px;
            }
            .oy-data-topbar {
              height: auto;
              min-height: 52px;
              align-items: flex-start;
              flex-direction: column;
              padding-top: 10px;
              padding-bottom: 10px;
            }
            .oy-top-actions {
              width: 100%;
              justify-content: flex-start;
            }
            .oy-top-actions .ant-input-affix-wrapper,
            .oy-top-actions .ant-input {
              width: min(100%, 280px);
            }
            .oy-data-metrics,
            .oy-data-sidebar {
              grid-template-columns: 1fr;
            }
            .oy-data-intro h2 {
              font-size: 24px;
              line-height: 32px;
            }
          }
        `}</style>

        <div className="oy-data-shell">
          <header className="oy-data-topbar">
            <ViewTabs views={APP_BLUEPRINT.views} activeView={activeView} onChange={setActiveView} onAddView={() => notify('可在此新增自定义视图（示例）')} />
            <div className="oy-top-actions">
              <Input prefix={<Icon name="search" />} placeholder="搜索任务、标签、备注" allowClear value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              <Button size="small" icon={<Icon name="bell" />} onClick={() => notify('提醒规则面板已打开（示例）')}>提醒设置</Button>
              <Button size="small" onClick={() => notify('视图分享链接已复制（示例）')}>{PAGE.secondaryCta}</Button>
            </div>
          </header>

          <Toolbar
            primaryAction={primaryAction}
            selectedCount={selected.length}
            statusFilter={statusFilter}
            sortDir={sortDir}
            grouped={grouped}
            density={density}
            colorize={colorize}
            sidebarOpen={sidebarOpen}
            onAdd={addRecord}
            onCycleStatus={cycleStatus}
            onCycleSort={cycleSort}
            onToggleGroup={() => setGrouped(!grouped)}
            onCycleDensity={cycleDensity}
            onToggleColor={() => setColorize(!colorize)}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />

          <section className="oy-data-intro">
            <div>
              <div className="oy-data-kicker">
                <Tag color="cyan">{activeView}</Tag>
                <Tag>{VISUAL_PROFILE.name}</Tag>
                <Tag>{RESEARCH_LEVEL}</Tag>
                {DATA_BINDING.enabled ? <Tag color="green">真实数据</Tag> : <Tag>演示数据</Tag>}
              </div>
              <Title level={2}>{PAGE.brandName}</Title>
              <p>{PAGE.heroText}</p>
            </div>
            <MetricStrip metrics={METRICS} />
          </section>

          <section className={sidebarOpen ? 'oy-data-workspace' : 'oy-data-workspace is-full'}>
            <div className="oy-table-panel">
              <div className="oy-table-scroll">
                <DataHeader />
                {groupList.map((bucket) => (
                  <React.Fragment key={bucket.key == null ? '__all__' : bucket.key}>
                    {grouped && bucket.key != null ? (
                      <GroupHeader
                        label={DIMENSION_LABEL[dimension]}
                        group={bucket.key}
                        count={bucket.rows.length}
                        collapsed={collapsed.indexOf(bucket.key) >= 0}
                        onToggle={() => toggleGroupCollapse(bucket.key)}
                      />
                    ) : null}
                    {(grouped && collapsed.indexOf(bucket.key) >= 0) ? null : bucket.rows.map((row) => (
                      <DataRow
                        key={row.id}
                        row={row}
                        selected={selected.indexOf(row.id) >= 0}
                        onToggle={() => toggleSelected(row.id)}
                        palette={palette}
                        density={density}
                        colorize={colorize}
                      />
                    ))}
                  </React.Fragment>
                ))}
                {viewRows.length === 0 ? (
                  <div className="oy-data-empty">没有符合条件的记录，试试清空搜索或切换筛选</div>
                ) : null}
                <div className="oy-add-row">
                  <button type="button" onClick={addRecord}>+ 新增一条记录</button>
                  <Text type="secondary">字段、分组和筛选会保持在当前视图中</Text>
                </div>
              </div>
            </div>

            {sidebarOpen ? <Sidebar roadmap={ROADMAP} insight={insight} dataBinding={DATA_BINDING} /> : null}
          </section>
        </div>
      </main>
    </ConfigProvider>
  );
}

export default YidaComp;
