/**
 * Yida business list Code Canvas template
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 */

import React, { useMemo, useState } from 'react';
import { ConfigProvider, Button, Input, Select, Table, Tag, Typography } from 'antd';

const { Title, Text, Paragraph } = Typography;

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

if (PAGE.brandName === TOKENS.brandName) {
  PAGE.brandName = '业务协同列表';
}
if (PAGE.brandInitials === TOKENS.brandInitials) {
  PAGE.brandInitials = 'BL';
}
if (PAGE.tagline === TOKENS.tagline) {
  PAGE.tagline = '客户、订单与任务的一屏式管理样板';
}
if (PAGE.heroText === TOKENS.heroText) {
  PAGE.heroText = '把筛选、批量操作、列表扫描和详情预览放在同一张业务工作台里，适合线索、订单、工单和项目台账。';
}
if (PAGE.primaryCta === TOKENS.primaryCta) {
  PAGE.primaryCta = '新建记录';
}
if (PAGE.secondaryCta === TOKENS.secondaryCta) {
  PAGE.secondaryCta = '导出列表';
}
if (PAGE.featuresTitle === TOKENS.featuresTitle) {
  PAGE.featuresTitle = '业务记录';
}
if (PAGE.roadmapTitle === TOKENS.roadmapTitle) {
  PAGE.roadmapTitle = '处理路径';
}
if (PAGE.ctaTitle === TOKENS.ctaTitle) {
  PAGE.ctaTitle = '详情预览';
}
if (PAGE.ctaText === TOKENS.ctaText) {
  PAGE.ctaText = '选中任意记录后，右侧保持关键摘要、负责人、状态和下一步动作，减少跳页成本。';
}

const DEFAULT_FEATURES = [
  { title: 'SO-240716-001', text: '华东客户补货申请，需确认交付批次与负责人。' },
  { title: 'SO-240716-002', text: '校园渠道暑期活动订单，等待财务复核。' },
  { title: 'TK-240716-018', text: '门店设备巡检异常，需要售后团队跟进。' },
  { title: 'PRJ-240716-006', text: '区域联营项目推进中，合同资料已补齐。' },
  { title: 'SO-240717-011', text: '华南经销商临时加单，库存锁定后等待出库排期。' },
  { title: 'CL-240717-026', text: '重点客户续约机会，需销售主管确认报价策略。' },
  { title: 'AF-240717-037', text: '售后换新申请，缺少质检照片和门店签收记录。' },
  { title: 'PRJ-240717-014', text: '区域快闪活动立项，物料预算和负责人已同步。' },
];
const DEFAULT_METRICS = [
  { label: '待处理记录', value: '128', hint: '+18 今日新增' },
  { label: '高价值客户', value: '36', hint: '¥86.4万 商机' },
  { label: '准时完成率', value: '96%', hint: '+5.2% 环比' },
];
const DEFAULT_ROADMAP = [
  { stage: '01', title: '收集', text: '从表单、连接器或示例数据汇入业务记录。' },
  { stage: '02', title: '筛选', text: '按状态、周期和关键词快速定位需要处理的事项。' },
  { stage: '03', title: '推进', text: '通过批量操作和详情预览完成分派、导出和跟进。' },
];
const DEFAULT_VISUAL_PROFILE = { name: 'business-list', density: 'comfortable' };
const DEFAULT_THEME_PROFILE = { followRuntimeTheme: false, name: 'sapphire-order-room', themeColor: '#2563EB', themeColorDeep: '#1D4ED8', themeColorSoft: '#EFF6FF', themeColorTint: 'rgba(37, 99, 235, 0.18)', palette: ['#2563EB', '#0F9F8E', '#F97316', '#E11D48', '#7C3AED'] };
const DEFAULT_APP_BLUEPRINT = { shell: 'workbench' };
const DEFAULT_INTERACTION_PROFILE = { primaryAction: '新建记录', bulkActions: ['批量导出', '批量分派', '标记完成'] };
const DEFAULT_INSIGHTS = [
  {
    conclusion: '建议把状态和负责人放在列表首屏，减少管理者来回切页。',
    suggestion: '高频批量动作固定在列表底部，选中记录后右侧展示下一步。',
  },
];
const DEFAULT_DATA_BINDING = { enabled: false, mode: 'seed', seedStrategy: 'sample-only' };
const EMPTY_METRICS = [
  { label: '真实记录', value: '0', hint: '未接入表单数据' },
  { label: '数据来源', value: '未接入', hint: '请在 page-spec.json 配置 dataBinding' },
  { label: '演示记录', value: '0', hint: '演示记录需先写入真实表单' },
];
const BACKGROUND_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1566346654781-14e3ef6ee988?auto=format&fit=crop&w=1400&q=80',
  card: 'https://images.unsplash.com/photo-1759884247160-27b8465544b6?auto=format&fit=crop&w=1200&q=80',
};

const FEATURES = parseTemplateJson('{{FEATURES_JSON}}', DEFAULT_FEATURES);
const METRICS = parseTemplateJson('{{METRICS_JSON}}', DEFAULT_METRICS);
const ROADMAP = parseTemplateJson('{{ROADMAP_JSON}}', DEFAULT_ROADMAP);
const VISUAL_PROFILE = parseTemplateJson('{{OPENYIDA_VISUAL_PROFILE_JSON}}', DEFAULT_VISUAL_PROFILE);
const THEME_PROFILE = parseTemplateJson('{{OPENYIDA_THEME_PROFILE_JSON}}', DEFAULT_THEME_PROFILE);
const THEME_SCOPE = withFallback('{{OPENYIDA_THEME_SCOPE}}', TOKENS.themeScope, 'runtime');
const APP_BLUEPRINT = parseTemplateJson('{{OPENYIDA_APP_BLUEPRINT_JSON}}', DEFAULT_APP_BLUEPRINT);
const INTERACTION_PROFILE = parseTemplateJson('{{OPENYIDA_INTERACTION_PROFILE_JSON}}', DEFAULT_INTERACTION_PROFILE);
const INSIGHTS = parseTemplateJson('{{OPENYIDA_INSIGHTS_JSON}}', DEFAULT_INSIGHTS);
const DATA_BINDING = parseTemplateJson('{{OPENYIDA_DATA_BINDING_JSON}}', DEFAULT_DATA_BINDING);
const ARCHETYPE = withFallback('{{OPENYIDA_ARCHETYPE}}', TOKENS.archetype, 'business-list');
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
    '--color-brand1-6': getThemeColor(profile, 'themeColor', '#6B7CAB'),
    '--color-brand1-2': getThemeColor(profile, 'themeColorSoft', '#F3F5FB'),
    '--color-brand1-9': getThemeColor(profile, 'themeColorDeep', '#435480'),
  };
}

function applyShellTheme(scope, profile) {
  if (scope !== 'app') {
    return;
  }
  try {
    const updateShellConfig = window && window.__YIDA__ && window.__YIDA__.updateShellConfig;
    if (typeof updateShellConfig === 'function') {
      updateShellConfig({ themeConfig: { themeColor: getThemeColor(profile, 'themeColor', readBrandColor(6, '#6B7CAB')) } });
    }
  } catch (err) {
    // Optional shell bridge.
  }
}

function StateBadge({ value }) {
  const color = value === '需跟进' ? 'warning' : value === '已完成' ? 'success' : 'processing';
  return <Tag className="oy-state-preview" color={color}>{value}</Tag>;
}

const STATUS_LABELS = { todo: '待处理', risk: '需跟进', done: '已完成' };

function FilterBar({ filters, onFilterChange, onReset }) {
  return (
    <div className="oy-list-filter oy-filter-bar">
      <Input placeholder="搜索编号、客户或摘要" allowClear value={filters.keyword} onChange={(e) => onFilterChange('keyword', e.target.value)} />
      <Select value={filters.status} onChange={(value) => onFilterChange('status', value)} options={[{ value: 'all', label: '全部状态' }, { value: 'todo', label: '待处理' }, { value: 'risk', label: '需跟进' }, { value: 'done', label: '已完成' }]} />
      <Select value={filters.period} onChange={(value) => onFilterChange('period', value)} options={[{ value: 'all', label: '全部周期' }, { value: 'week', label: '本周' }, { value: 'month', label: '本月' }]} />
      <Button onClick={onReset}>重置筛选</Button>
    </div>
  );
}

function BulkActionBar({ actions, count }) {
  const views = actions && actions.length ? actions : ['批量导出', '批量分派'];
  return (
    <div className="oy-bulk-action-bar">
      <Text type="secondary">已加载 {count} 条业务记录</Text>
      <div className="oy-bulk-actions">
        {views.slice(0, 3).map((action) => <Button size="small" key={action}>{action}</Button>)}
      </div>
    </div>
  );
}

function DetailPreview({ active, page, roadmap }) {
  return (
    <div className="oy-detail-preview">
      <Tag color="processing">详情抽屉预览</Tag>
      <Title level={4} style={{ marginTop: 14 }}>{active.code || page.ctaTitle}</Title>
      <Paragraph>{active.summary || page.ctaText}</Paragraph>
      <Text type="secondary">负责人</Text>
      <Paragraph>{active.owner}</Paragraph>
      <Text type="secondary">状态</Text>
      <Paragraph><StateBadge value={active.status || '待处理'} /></Paragraph>
      <Title level={4}>{page.roadmapTitle}</Title>
      {roadmap.slice(0, 3).map((item) => (
        <div className="oy-list-step" key={item.stage}>
          <div className="oy-list-stage">{item.stage}</div>
          <div>
            <Text strong>{item.title}</Text>
            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>{item.text}</Paragraph>
          </div>
        </div>
      ))}
    </div>
  );
}

function isDataBindingEnabled(binding) {
  return Boolean(binding && binding.enabled && binding.mode && binding.mode !== 'seed');
}

function isSampleSeedPreview(binding) {
  const mode = binding && binding.mode ? binding.mode : 'seed';
  return RESEARCH_LEVEL === 'sample' && !isDataBindingEnabled(binding) && mode === 'seed';
}

function getCsrfToken() {
  try {
    return (window.g_config && (window.g_config._csrf_token || window.g_config.csrfToken)) || '';
  } catch (err) {
    return '';
  }
}

function buildDataRequest(binding) {
  if (binding.mode === 'form' && binding.appType && binding.formUuid) {
    // 已验证：searchFormDatas.json 用 GET + query 参数，formUuid/appType 必须放在 URL query 里
    // （放在 POST body 里后端读不到，会报「参数校验失败 formUuid」）。
    // 分页参数名是 currentPage（不是 pageNumber）。返回列表在响应的 content.data 中，由 unwrapRows 兜底解包。
    const qs = new URLSearchParams({
      formUuid: binding.formUuid,
      appType: binding.appType,
      currentPage: String(binding.pageNumber || 1),
      pageSize: String(binding.pageSize || 20),
      searchFieldJson: JSON.stringify(binding.query || {}),
    }).toString();
    return {
      url: '/dingtalk/web/' + binding.appType + '/v1/form/searchFormDatas.json?' + qs,
      method: 'GET',
      body: {},
    };
  }
  return {
    url: binding.endpoint,
    method: binding.method || 'GET',
    body: binding.body || {},
  };
}

function requestJson(req, signal) {
  const csrfToken = getCsrfToken();
  const headers = { 'Content-Type': 'application/json' };
  if (csrfToken) {
    headers.global_csrf_token = csrfToken;
  }
  return fetch(req.url, {
    method: req.method || 'GET',
    credentials: 'include',
    headers,
    body: req.method === 'GET' ? undefined : JSON.stringify(req.body || {}),
    signal,
  }).then((resp) => {
    if (!resp.ok) {
      throw new Error('HTTP ' + resp.status);
    }
    return resp.json();
  }).then((json) => {
    if (json && json.success === false) {
      throw new Error(json.errorMsg || json.message || 'request failed');
    }
    return json;
  });
}

function unwrapRows(payload) {
  const queue = [payload];
  const seen = [];
  while (queue.length) {
    const item = queue.shift();
    if (!item || seen.indexOf(item) >= 0) { continue; }
    seen.push(item);
    if (Array.isArray(item)) { return item; }
    ['data', 'list', 'values', 'records'].forEach((key) => {
      if (Array.isArray(item[key])) {
        queue.unshift(item[key]);
      }
    });
    ['result', 'content', 'value'].forEach((key) => {
      if (item[key] && typeof item[key] === 'object') {
        queue.push(item[key]);
      }
    });
  }
  return [];
}

function getTotalCount(payload) {
  const queue = [payload];
  const seen = [];
  while (queue.length) {
    const item = queue.shift();
    if (!item || seen.indexOf(item) >= 0) { continue; }
    seen.push(item);
    if (typeof item.totalCount === 'number') { return item.totalCount; }
    if (typeof item.total === 'number') { return item.total; }
    if (typeof item.count === 'number') { return item.count; }
    ['result', 'content', 'data', 'value'].forEach((key) => {
      if (item[key] && typeof item[key] === 'object') {
        queue.push(item[key]);
      }
    });
  }
  return null;
}

function pickField(row, fieldId, fallbackKeys) {
  const data = row.formData || row.data || row;
  if (fieldId && data[fieldId] !== undefined) {
    return data[fieldId];
  }
  for (let i = 0; i < fallbackKeys.length; i++) {
    if (data[fallbackKeys[i]] !== undefined) {
      return data[fallbackKeys[i]];
    }
  }
  return '';
}

function normalizeBoundRows(rows, binding) {
  const fields = binding.fields || {};
  return rows.map((row, index) => ({
    key: row.formInstanceId || row.instanceId || row.id || index,
    code: pickField(row, fields.code || fields.title, ['code', 'title', 'name']) || ('记录 ' + (index + 1)),
    summary: pickField(row, fields.summary || fields.description, ['summary', 'description', 'content']) || '',
    owner: pickField(row, fields.owner, ['owner', 'creator', 'dept']) || '未分配',
    amount: pickField(row, fields.amount || fields.value, ['amount', 'value', 'count']) || '-',
    status: pickField(row, fields.status, ['status', 'state']) || '待处理',
  }));
}

function useYidaData(binding) {
  const [state, setState] = React.useState(() => ({ loading: isDataBindingEnabled(binding), error: '', rows: [], totalCount: null }));
  React.useEffect(() => {
    if (!isDataBindingEnabled(binding)) { return undefined; }
    const controller = new AbortController();
    const req = buildDataRequest(binding);
    if (!req.url) {
      setState({ loading: false, error: '数据绑定缺少 endpoint 或 appType/formUuid', rows: [], totalCount: null });
      return undefined;
    }
    setState({ loading: true, error: '', rows: [], totalCount: null });
    requestJson(req, controller.signal).then((json) => {
      const rows = unwrapRows(json);
      const totalCount = getTotalCount(json);
      if (binding.emptyAsError !== false && totalCount > 0 && rows.length === 0) {
        throw new Error('接口返回结构未识别：totalCount=' + totalCount + ' 但 rows=0');
      }
      setState({ loading: false, error: '', rows: normalizeBoundRows(rows, binding), totalCount });
    }).catch((err) => {
      if (err.name === 'AbortError') { return; }
      setState({ loading: false, error: err.message || String(err), rows: [], totalCount: null });
    });
    return () => controller.abort();
  }, []);
  return state;
}

function YidaComp() {
  const [selected, setSelected] = useState(0);
  const [filters, setFilters] = useState({ keyword: '', status: 'all', period: 'all' });
  const handleFilterChange = (key, value) => { setSelected(0); setFilters((prev) => Object.assign({}, prev, { [key]: value })); };
  const handleReset = () => { setSelected(0); setFilters({ keyword: '', status: 'all', period: 'all' }); };
  React.useEffect(() => {
    applyShellTheme(THEME_SCOPE, THEME_PROFILE);
  }, []);

  const brand = getThemeColor(THEME_PROFILE, 'themeColor', readBrandColor(6, '#6B7CAB'));
  const brandDeep = getThemeColor(THEME_PROFILE, 'themeColorDeep', readBrandColor(9, '#435480'));
  const brandSoft = getThemeColor(THEME_PROFILE, 'themeColorSoft', readBrandColor(2, '#F3F5FB'));
  const palette = parseColorGroup(THEME_PROFILE.palette || [brand, '#14B8A6', '#F97316', '#22C55E', '#A855F7']);
  const themeVars = buildScopedThemeVars(THEME_SCOPE, THEME_PROFILE);
  const primaryAction = INTERACTION_PROFILE.primaryAction || PAGE.primaryCta;
  const shellLabel = APP_BLUEPRINT.shell || 'single_page';
  const insight = INSIGHTS[0] || {};
  const seedRows = useMemo(() => FEATURES.slice(0, 8).map((item, index) => ({
    key: index,
    code: item.title,
    summary: item.text,
    owner: ['华东渠道', '校园门店', '社区团购', '直营门店'][index % 4],
    amount: ['12,860', '8,420', '5,390', '18,720'][index % 4],
    status: index % 3 === 0 ? '待处理' : index % 3 === 1 ? '已完成' : '需跟进',
    period: index % 2 === 0 ? 'week' : 'month',
  })), []);
  const dataState = useYidaData(DATA_BINDING);
  const usesSeedRows = isSampleSeedPreview(DATA_BINDING);
  const metricItems = usesSeedRows || isDataBindingEnabled(DATA_BINDING) ? METRICS : EMPTY_METRICS;
  const rows = dataState.rows.length ? dataState.rows : (usesSeedRows ? seedRows : []);
  const filteredRows = useMemo(() => {
    const kw = (filters.keyword || '').trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.status !== 'all' && row.status !== STATUS_LABELS[filters.status]) { return false; }
      if (filters.period !== 'all' && row.period && row.period !== filters.period) { return false; }
      if (kw) {
        const hay = ((row.code || '') + ' ' + (row.summary || '') + ' ' + (row.owner || '')).toLowerCase();
        if (hay.indexOf(kw) < 0) { return false; }
      }
      return true;
    });
  }, [rows, filters]);
  const activeIndex = selected < filteredRows.length ? selected : 0;
  const active = filteredRows[activeIndex] || {};
  const columns = [
    { title: '编号', dataIndex: 'code', width: 190, render: (value) => <Text strong>{value}</Text> },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    { title: '负责人', dataIndex: 'owner', width: 120 },
    { title: '金额', dataIndex: 'amount', width: 110, align: 'right', render: (value) => <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Text> },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <StateBadge value={value} /> },
  ];

  return (
    <ConfigProvider getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body} theme={{ token: { colorPrimary: brand, borderRadius: 8 } }}>
      <div
        className="oy-business-list"
        data-profile={VISUAL_PROFILE.name}
        data-theme-scope={THEME_SCOPE}
        style={{
          ...themeVars,
          '--oy-brand': brand,
          '--oy-brand-deep': brandDeep,
          '--oy-brand-soft': brandSoft,
          '--oy-accent-2': palette[1],
          '--oy-hero-image': `url("${BACKGROUND_IMAGES.hero}")`,
          '--oy-card-image': `url("${BACKGROUND_IMAGES.card}")`,
        }}
      >
        <style>{`
          {{OPENYIDA_CANVAS_CONTROL_CSS}}
          .oy-business-list {
            --oy-text: #2A1A12;
            --oy-text-muted: #80624B;
            --oy-line: color-mix(in srgb, var(--oy-brand) 22%, #F8D9BA);
            --oy-line-soft: color-mix(in srgb, var(--oy-brand) 10%, #EAF2FF);
            --oy-surface: rgba(255,255,255,.92);
            --oy-surface-soft: color-mix(in srgb, var(--oy-brand-soft), #fff 38%);
            min-height: 100vh;
            padding: 28px 36px 44px;
            background:
              radial-gradient(circle at 8% 4%, rgba(96, 165, 250, .30), transparent 26%),
              linear-gradient(180deg, #EAF2FF 0%, #F7FBFF 360px, #fff 100%);
            color: var(--oy-text);
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
            letter-spacing: 0;
          }
          .oy-list-shell { max-width: 1360px; margin: 0 auto; }
          .oy-list-hero {
            min-height: 256px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 320px;
            gap: 22px;
            align-items: end;
            margin-bottom: 16px;
            padding: 28px;
            border-radius: 24px;
            color: #fff;
            background:
              linear-gradient(90deg, rgba(30,64,175,.94), rgba(37,99,235,.72) 52%, rgba(96,165,250,.30)),
              var(--oy-hero-image) center / cover no-repeat;
            box-shadow: 0 28px 72px rgba(37,99,235,.22);
            overflow: hidden;
          }
          .oy-list-header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 16px; }
          .oy-list-hero .oy-list-header { margin-bottom: 0; }
          .oy-list-hero h2, .oy-list-hero .ant-typography { color: #fff; }
          .oy-list-hero h2 { font-size: 38px; line-height: 46px; font-weight: 900; }
          .oy-list-actions { display: flex; gap: 10px; }
          .oy-list-hero .oy-list-actions .ant-btn-default { color: #1D4ED8; border: 0; }
          .oy-list-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
          .oy-list-hero .oy-list-metrics { grid-template-columns: 1fr; margin-bottom: 0; }
          .oy-list-metric { padding: 16px; border: 1px solid var(--oy-line); border-radius: 14px; background: var(--oy-surface); }
          .oy-list-hero .oy-list-metric { padding: 18px; border: 1px solid rgba(255,255,255,.34); border-radius: 16px; background: rgba(255,255,255,.18); backdrop-filter: blur(16px); }
          .oy-list-hero .oy-list-metric .ant-typography { color: rgba(255,255,255,.78); }
          .oy-list-number { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; margin-top: 10px; }
          .oy-list-hero .oy-list-number { color: #fff; font-size: 34px; font-weight: 900; }
          .oy-list-hint { display: block; margin-top: 10px; color: #DBEAFE; font-size: 12px; font-weight: 800; }
          .oy-list-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, .42fr); gap: 16px; }
          .oy-list-card { background: var(--oy-surface); border: 1px solid var(--oy-line); border-radius: 18px; box-shadow: 0 18px 44px rgba(37,99,235,.08); overflow: hidden; }
          .oy-list-filter { display: grid; grid-template-columns: minmax(220px, 1fr) 150px 150px auto; gap: 10px; padding: 16px; border-bottom: 1px solid var(--oy-line-soft); }
          .oy-list-table { padding: 0 16px 16px; }
          .oy-list-detail { padding: 20px; background: linear-gradient(180deg, rgba(239,246,255,.92), rgba(255,255,255,.94)), var(--oy-card-image) center / cover no-repeat; }
          .oy-list-step { display: grid; grid-template-columns: 52px 1fr; gap: 12px; padding: 14px 0; border-top: 1px solid var(--oy-line-soft); }
          .oy-list-stage { color: var(--oy-brand-deep); font-weight: 800; }
          .oy-bulk-action-bar { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 12px 16px 16px; border-top: 1px solid var(--oy-line-soft); }
          .oy-bulk-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
          .oy-detail-preview { display: block; }
          .oy-list-insight { padding: 12px 14px; margin: 0 0 16px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--oy-brand), transparent 70%); background: #EFF6FF; }
          .oy-list-brief { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
          .oy-data-status { margin: 0 0 12px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--oy-line); background: var(--oy-surface-soft); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
          .oy-list-empty-state { min-height: 278px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 32px 22px; text-align: center; border: 1px dashed var(--oy-line); border-radius: 14px; background: color-mix(in srgb, var(--oy-brand-soft), #fff 58%); }
          .oy-list-empty-state h4 { margin: 0; color: var(--oy-text); }
          .oy-list-empty-state .ant-typography { max-width: 540px; }
          .oy-list-empty-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
          .oy-list-empty-detail { min-height: 360px; display: flex; flex-direction: column; justify-content: center; padding: 8px; }
          @media (max-width: 960px) {
            .oy-business-list { padding: 20px; }
            .oy-list-grid, .oy-list-metrics, .oy-list-filter, .oy-list-hero { grid-template-columns: 1fr; }
            .oy-list-header { flex-direction: column; }
          }
        `}</style>

        <div className="oy-list-shell">
          <section className="oy-list-hero">
            <header className="oy-list-header">
              <div>
                <Title level={2} style={{ margin: 0 }}>{PAGE.brandName}</Title>
                <Text>{PAGE.tagline}</Text>
                <div className="oy-list-brief">
                  <Tag color="warning">{shellLabel} + {ARCHETYPE || 'table'}</Tag>
                  <Tag>{RESEARCH_LEVEL || 'light'} research</Tag>
                  {insight.conclusion ? <Text>{insight.conclusion}</Text> : null}
                </div>
              </div>
              <div className="oy-list-actions">
                <Button>{PAGE.secondaryCta}</Button>
                <Button type="primary">{primaryAction}</Button>
              </div>
            </header>

            <section className="oy-list-metrics">
              {metricItems.slice(0, 3).map((item) => (
                <div className="oy-list-metric" key={item.label}>
                  <Text>{item.label}</Text>
                  <div className="oy-list-number">{item.value}</div>
                  {item.hint ? <span className="oy-list-hint">{item.hint}</span> : null}
                </div>
              ))}
            </section>
          </section>

          <div className="oy-list-grid">
            <section className="oy-list-card">
              <FilterBar filters={filters} onFilterChange={handleFilterChange} onReset={handleReset} />
              <div className="oy-list-table">
                {isDataBindingEnabled(DATA_BINDING) ? (
                  <div className="oy-data-status">
                    <Tag color={dataState.error ? 'error' : dataState.loading ? 'processing' : 'success'}>DataBridge</Tag>
                    <Text type={dataState.error ? 'danger' : 'secondary'}>
                      {dataState.error || (dataState.loading ? '正在读取真实数据' : '真实数据已接入' + (dataState.totalCount === null ? '' : '：' + dataState.totalCount + ' 条'))}
                    </Text>
                  </div>
                ) : (
                  <div className="oy-data-status">
                    <Tag color={usesSeedRows ? 'warning' : 'default'}>{usesSeedRows ? 'Sample seed' : '未接数据'}</Tag>
                    <Text type="secondary">
                      {usesSeedRows ? '当前为 sample/seed 预览数据，未接真实表单。' : '未配置真实表单 dataBinding，当前不显示前端 seed 列表。'}
                    </Text>
                  </div>
                )}
                {filteredRows.length ? (
                  <Table
                    columns={columns}
                    dataSource={filteredRows}
                    pagination={false}
                    size="middle"
                    rowClassName={(_, index) => index === activeIndex ? 'is-selected-row' : ''}
                    onRow={(_, index) => ({ onClick: () => setSelected(index || 0) })}
                  />
                ) : (
                  <div className="oy-list-empty-state">
                    <Title level={4}>{dataState.loading ? '正在读取真实表单数据' : isDataBindingEnabled(DATA_BINDING) ? '暂无真实表单记录' : usesSeedRows ? '暂无匹配的 sample 记录' : '未接入真实表单数据'}</Title>
                    <Paragraph type="secondary">
                      {isDataBindingEnabled(DATA_BINDING)
                        ? '当前数据源已接入宜搭表单。若需要演示内容，请先通过表单数据写入链路创建 demo records，再刷新本页读取。'
                        : usesSeedRows
                          ? '这是模板原样发布的 sample/seed 数据，仅用于离线预览模板结构。'
                          : '完整应用交付页不会用前端 seedRows 冒充业务记录。请在 page-spec.json 写入 dataBinding.mode=form，或先登记真实表单记录。'}
                    </Paragraph>
                    <div className="oy-list-empty-actions">
                      <Button type="primary">{PAGE.primaryCta || '登记记录'}</Button>
                      <Button>刷新数据</Button>
                    </div>
                  </div>
                )}
              </div>
              <BulkActionBar actions={INTERACTION_PROFILE.bulkActions} count={filteredRows.length} />
            </section>

            <aside className="oy-list-card oy-list-detail">
              {insight.suggestion ? (
                <div className="oy-list-insight">
                  <Text strong>{insight.suggestion}</Text>
                </div>
              ) : null}
              {filteredRows.length ? (
                <DetailPreview active={active} page={PAGE} roadmap={ROADMAP} />
              ) : (
                <div className="oy-list-empty-detail">
                  <Tag color="default">空态入口</Tag>
                  <Title level={4} style={{ marginTop: 14 }}>等待真实记录</Title>
                  <Paragraph type="secondary">接入表单后，选中列表记录将在这里展示摘要、负责人、状态和处理路径。</Paragraph>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
