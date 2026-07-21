/**
 * Yida dashboard overview Code Canvas template
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 */

import React, { useMemo } from 'react';
import { ConfigProvider, Button, Tag, Typography } from 'antd';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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

function isTemplateToken(value) {
  return typeof value === 'string' && /^\{\{[A-Z0-9_]+\}\}$/.test(value);
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

function withFallback(value, fallback) {
  return value && !isTemplateToken(value) ? value : fallback;
}

function applyPageFallbacks(fallbacks) {
  Object.keys(fallbacks).forEach((key) => {
    PAGE[key] = withFallback(PAGE[key], fallbacks[key]);
  });
}

applyPageFallbacks({
  brandName: '经营概览看板',
  brandInitials: 'DB',
  tagline: '增长、履约和风险的一屏概览',
  heroText: '用指标、趋势、排行和洞察把业务状态压缩到一张工作台，适合管理层晨会和运营复盘。',
  primaryCta: '查看详情',
  secondaryCta: '导出周报',
  featuresTitle: '重点对象',
  roadmapTitle: '推进节奏',
  ctaTitle: '经营洞察',
  ctaText: '本周业务整体稳定，建议优先处理高价值待跟进事项。',
});

const DEFAULT_FEATURES = [
  { title: '增长线索', text: '关键客户、重点机会和待处理事项集中到一个看板里。' },
  { title: '履约进度', text: '用趋势和排行快速判断本周推进是否偏离目标。' },
  { title: '风险提示', text: '把异常指标、负责人和建议动作固定在首屏。' },
];
const DEFAULT_METRICS = [
  { label: '本周新增', value: '4,286', delta: '+12.8%' },
  { label: '履约完成率', value: '96.4%', delta: '+5.2pp' },
  { label: '异常告警', value: '18', delta: '-9' },
  { label: '平均响应', value: '2.4h', delta: '-18%' },
];
const DEFAULT_ROADMAP = [
  { stage: '01', title: '采集', text: '汇总表单和业务系统数据。' },
  { stage: '02', title: '判断', text: '定位波动指标与高优先级对象。' },
  { stage: '03', title: '行动', text: '分派跟进并沉淀处理结果。' },
];
const DEFAULT_VISUAL_PROFILE = { name: 'dashboard-overview' };
const DEFAULT_THEME_PROFILE = { followRuntimeTheme: false, name: 'harbor-command', themeColor: '#155E75', themeColorDeep: '#0E3F4C', themeColorSoft: '#E6F7F8', themeColorTint: 'rgba(21, 94, 117, 0.18)', palette: ['#155E75', '#14B8A6', '#84CC16', '#F59E0B', '#E11D48'] };
const DEFAULT_APP_BLUEPRINT = { shell: 'dashboard' };
const DEFAULT_INTERACTION_PROFILE = { primaryAction: '查看详情' };
const DEFAULT_INSIGHTS = [{ conclusion: '本周业务整体稳定，建议优先处理高价值待跟进事项。' }];
const DEFAULT_DATA_BINDING = { enabled: false, mode: 'seed', seedStrategy: 'sample-only' };
const EMPTY_METRICS = [
  { label: '真实记录', value: '0', delta: '未接入表单数据' },
  { label: '数据来源', value: '未接入', delta: '请配置 dataBinding' },
  { label: '演示指标', value: '0', delta: '演示记录需先写入表单' },
  { label: '图表状态', value: '空态', delta: '等待真实数据' },
];
const BACKGROUND_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1566346654781-14e3ef6ee988?auto=format&fit=crop&w=1400&q=80',
};

const FEATURES = parseTemplateJson('{{FEATURES_JSON}}', DEFAULT_FEATURES);
const METRICS = parseTemplateJson('{{METRICS_JSON}}', DEFAULT_METRICS);
const ROADMAP = parseTemplateJson('{{ROADMAP_JSON}}', DEFAULT_ROADMAP);
const VISUAL_PROFILE = parseTemplateJson('{{OPENYIDA_VISUAL_PROFILE_JSON}}', DEFAULT_VISUAL_PROFILE);
const THEME_PROFILE = parseTemplateJson('{{OPENYIDA_THEME_PROFILE_JSON}}', DEFAULT_THEME_PROFILE);
const THEME_SCOPE = withFallback('{{OPENYIDA_THEME_SCOPE}}', 'page');
const APP_BLUEPRINT = parseTemplateJson('{{OPENYIDA_APP_BLUEPRINT_JSON}}', DEFAULT_APP_BLUEPRINT);
const INTERACTION_PROFILE = parseTemplateJson('{{OPENYIDA_INTERACTION_PROFILE_JSON}}', DEFAULT_INTERACTION_PROFILE);
const INSIGHTS = parseTemplateJson('{{OPENYIDA_INSIGHTS_JSON}}', DEFAULT_INSIGHTS);
const DATA_BINDING = parseTemplateJson('{{OPENYIDA_DATA_BINDING_JSON}}', DEFAULT_DATA_BINDING);
const ARCHETYPE = withFallback('{{OPENYIDA_ARCHETYPE}}', 'overview');
const RESEARCH_LEVEL = withFallback('{{OPENYIDA_RESEARCH_LEVEL}}', 'sample');

function readBrandColor(level, fallback) {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand1-' + (level || 6))
      .trim();
    return value || fallback;
  } catch (err) {
    return fallback;
  }
}

function getThemeColor(profile, key, fallback) {
  const levels = { themeColor: 6, themeColorSoft: 2, themeColorTint: 3, themeColorDeep: 9 };
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
      updateShellConfig({
        themeConfig: {
          theme: getThemeColor(profile, 'navTheme', 'light'),
          colorMode: getThemeColor(profile, 'colorMode', 'gradient'),
          mode: getThemeColor(profile, 'mode', 'color_color'),
          themeColor: getThemeColor(profile, 'themeColor', readBrandColor(6, '#6B7CAB')),
          mobileNavStyle: getThemeColor(profile, 'mobileNavStyle', 'top'),
        },
      });
    }
  } catch (err) {
    // Shell theme bridge is optional.
  }
}

function DataFreshnessBadge({ researchLevel }) {
  return (
    <Tag className="oy-freshness-badge" color="success">
      {researchLevel || 'light'} research · 更新时间 10:40
    </Tag>
  );
}

function KpiPrimitive({ item, index, brandDeep }) {
  return (
    <div className="oy-dashboard-kpi-card oy-kpi-primitive" key={item.label}>
      <Text style={{ color: '#747677' }}>{item.label}</Text>
      <div className="oy-dashboard-number">{item.value}</div>
      <Text style={{ color: brandDeep }}>{item.delta || (index === 0 ? '+5.2% 环比' : '本周稳定')}</Text>
    </div>
  );
}

function InsightCallout({ insight, fallback }) {
  const view = insight || {};
  return (
    <div className="oy-insight-callout">
      <Text strong>{view.conclusion || fallback}</Text>
      <Paragraph className="oy-insight-evidence">{view.evidence || '基于轻量场景调研和页面目标提炼。'}</Paragraph>
      <Text className="oy-insight-suggestion">{view.suggestion || '优先把关键动作、风险和增长机会放到首屏。'}</Text>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }) {
  return (
    <section className="oy-dashboard-card oy-dashboard-panel oy-chart-panel">
      <div className="oy-dashboard-panel-title">
        <Title level={4} style={{ margin: 0 }}>{title}</Title>
        <Text type="secondary">{subtitle}</Text>
      </div>
      {children}
    </section>
  );
}

function DashboardEmptyState({ title, text }) {
  return (
    <div className="oy-dashboard-empty">
      <Title level={4}>{title}</Title>
      <Paragraph type="secondary">{text}</Paragraph>
      <div className="oy-dashboard-empty-actions">
        <Button type="primary">{PAGE.primaryCta || '登记记录'}</Button>
        <Button>刷新数据</Button>
      </div>
    </div>
  );
}

function RankList({ data, color }) {
  return (
    <div className="oy-rank-list">
      {data.slice(0, 4).map((item, index) => (
        <div className="oy-rank-row" key={item.name}>
          <Text className="oy-rank-index">{String(index + 1).padStart(2, '0')}</Text>
          <Text strong>{item.name}</Text>
          <div className="oy-rank-bar">
            <span style={{ width: item.value + '%', background: color }} />
          </div>
          <Text>{item.value}</Text>
        </div>
      ))}
    </div>
  );
}

function ActionStep({ item }) {
  return (
    <div className="oy-dashboard-action" key={item.stage}>
      <div className="oy-dashboard-stage">{item.stage}</div>
      <div>
        <Text strong>{item.title}</Text>
        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>{item.text}</Paragraph>
      </div>
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
      if (Array.isArray(item[key])) { queue.unshift(item[key]); }
    });
    ['result', 'content', 'value'].forEach((key) => {
      if (item[key] && typeof item[key] === 'object') { queue.push(item[key]); }
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
      if (item[key] && typeof item[key] === 'object') { queue.push(item[key]); }
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
  return undefined;
}

function parseNumericMetric(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeDashboardRows(rows, binding) {
  const fields = binding.fields || {};
  return rows.map((row, index) => {
    const rawValue = pickField(row, fields.value || fields.amount || fields.count, ['value', 'amount', 'count']);
    return {
      name: pickField(row, fields.name || fields.title || fields.code, ['name', 'title', 'code']) || ('记录 ' + (index + 1)),
      value: parseNumericMetric(rawValue),
    };
  });
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
      setState({ loading: false, error: '', rows: normalizeDashboardRows(rows, binding), totalCount });
    }).catch((err) => {
      if (err.name === 'AbortError') { return; }
      setState({ loading: false, error: err.message || String(err), rows: [], totalCount: null });
    });
    return () => controller.abort();
  }, []);
  return state;
}

function YidaComp() {
  React.useEffect(() => {
    applyShellTheme(THEME_SCOPE, THEME_PROFILE);
  }, []);

  const brand = getThemeColor(THEME_PROFILE, 'themeColor', readBrandColor(6, '#6B7CAB'));
  const brandDeep = getThemeColor(THEME_PROFILE, 'themeColorDeep', readBrandColor(9, '#435480'));
  const brandSoft = getThemeColor(THEME_PROFILE, 'themeColorSoft', readBrandColor(2, '#F3F5FB'));
  const palette = parseColorGroup(THEME_PROFILE.palette || [brand, '#14B8A6', '#F97316', '#22C55E', '#A855F7']);
  const themeVars = buildScopedThemeVars(THEME_SCOPE, THEME_PROFILE);
  const seedTrendData = useMemo(() => [
    { name: '周一', value: 42, target: 36 },
    { name: '周二', value: 48, target: 39 },
    { name: '周三', value: 51, target: 44 },
    { name: '周四', value: 46, target: 43 },
    { name: '周五', value: 58, target: 49 },
    { name: '周六', value: 63, target: 55 },
  ], []);
  const seedRankData = useMemo(() => FEATURES.slice(0, 5).map((item, index) => ({
    name: item.title,
    value: 88 - index * 11,
  })), []);
  const insight = INSIGHTS[0] || null;
  const primaryAction = INTERACTION_PROFILE.primaryAction || PAGE.primaryCta;
  const shellLabel = APP_BLUEPRINT.shell || 'single_page';
  const dataState = useYidaData(DATA_BINDING);
  const usesSeedRows = isSampleSeedPreview(DATA_BINDING);
  const chartRows = isDataBindingEnabled(DATA_BINDING)
    ? dataState.rows.filter((row) => Number.isFinite(row.value))
    : [];
  const hasRowsWithoutChartValue = isDataBindingEnabled(DATA_BINDING)
    && !dataState.loading
    && !dataState.error
    && dataState.rows.length > 0
    && chartRows.length === 0;
  const trendData = usesSeedRows
    ? seedTrendData
    : chartRows.length
      ? chartRows.slice(0, 6).map((row, index) => ({ name: row.name || '记录 ' + (index + 1), value: row.value, target: row.value }))
      : [];
  const rankData = usesSeedRows
    ? seedRankData
    : chartRows.length
      ? chartRows.slice(0, 5)
      : [];
  const metricItems = usesSeedRows
    ? METRICS
    : isDataBindingEnabled(DATA_BINDING)
      ? [
        { value: dataState.loading ? '--' : String(dataState.totalCount === null ? dataState.rows.length : dataState.totalCount), label: DATA_BINDING.sourceName || '真实记录', delta: dataState.loading ? '正在读取真实表单' : '来自宜搭表单' },
        { value: dataState.error ? '异常' : '已接入', label: '数据状态', delta: dataState.error || 'DataBridge' },
        { value: Object.keys(DATA_BINDING.fields || {}).length + ' 项', label: '字段映射', delta: 'page-spec.json' },
        { value: '0', label: '演示指标', delta: '演示记录需先写入表单' },
      ]
      : EMPTY_METRICS;
  const mainMetric = metricItems[0] || { value: '-', label: '核心指标' };
  const hasChartData = trendData.length > 0 && rankData.length > 0;
  const trendEmptyTitle = isDataBindingEnabled(DATA_BINDING)
    ? dataState.error
      ? '真实数据读取异常'
      : dataState.loading
        ? '正在读取真实表单数据'
        : hasRowsWithoutChartValue
          ? '缺少数值字段映射'
          : '暂无真实趋势数据'
    : '未接入真实表单数据';
  const trendEmptyText = isDataBindingEnabled(DATA_BINDING)
    ? hasRowsWithoutChartValue
      ? '已读取真实表单记录，但字段映射中没有可解析的数值字段，趋势图暂不绘制。'
      : '当前数据源已接入宜搭表单。若需要演示内容，请先通过表单数据写入链路创建 demo records，再刷新本页读取。'
    : '完整应用交付页不会用前端静态趋势冒充业务数据，请在 page-spec.json 写入 dataBinding.mode=form。';
  const rankEmptyTitle = isDataBindingEnabled(DATA_BINDING)
    ? dataState.error
      ? '真实数据读取异常'
      : dataState.loading
        ? '正在读取真实排行数据'
        : hasRowsWithoutChartValue
          ? '暂无可绘图数据'
          : '暂无真实排行记录'
    : '未接入真实排行数据';
  const rankEmptyText = isDataBindingEnabled(DATA_BINDING)
    ? hasRowsWithoutChartValue
      ? 'DataBridge 已读取真实记录，但缺少可用于排行的数值字段映射，页面不会合成前端指标。'
      : 'DataBridge 已启用，页面不会回退到 sample 排行。'
    : '请配置真实表单 dataBinding，或先写入 demo records 后再让 Canvas 读取。';

  return (
    <ConfigProvider
      getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}
      theme={{
        token: {
          colorPrimary: brand,
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
        },
      }}
    >
      <div
        className="oy-dashboard-overview"
        data-profile={VISUAL_PROFILE.name}
        data-theme-scope={THEME_SCOPE}
        style={{
          ...themeVars,
          '--oy-brand': brand,
          '--oy-brand-deep': brandDeep,
          '--oy-brand-soft': brandSoft,
          '--oy-accent-1': palette[0],
          '--oy-accent-2': palette[1],
          '--oy-accent-3': palette[2],
          '--oy-hero-image': `url("${BACKGROUND_IMAGES.hero}")`,
        }}
      >
        <style>{`
          {{OPENYIDA_CANVAS_CONTROL_CSS}}
          .oy-dashboard-overview {
            min-height: 100vh;
            padding: 28px 36px 44px;
            color: #102A2F;
            background:
              radial-gradient(circle at 10% 4%, rgba(20,184,166,.22), transparent 28%),
              linear-gradient(180deg, #E7F9FA 0%, #F7FCFC 340px, #fff 100%);
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
            letter-spacing: 0;
          }
          .oy-dashboard-shell { max-width: 1360px; margin: 0 auto; }
          .oy-dashboard-top { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 20px; }
          .oy-dashboard-brand { display: flex; gap: 14px; align-items: center; }
          .oy-dashboard-logo { width: 48px; height: 48px; border-radius: 10px; background: var(--oy-brand); color: #fff; display: grid; place-items: center; font-weight: 800; box-shadow: 0 12px 28px rgba(67,84,128,.14); }
          .oy-dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.75fr); gap: 16px; }
          .oy-dashboard-card { background: rgba(255,255,255,0.88); border: 1px solid color-mix(in srgb, var(--oy-brand) 16%, #CFE5E8); border-radius: 18px; box-shadow: 0 18px 44px rgba(16,42,47,0.10); overflow: hidden; }
          .oy-dashboard-hero {
            position: relative;
            padding: 26px;
            min-height: 308px;
            color: #fff;
            background:
              linear-gradient(90deg, rgba(4,47,46,.94), rgba(14,116,144,.72) 58%, rgba(20,184,166,.24)),
              var(--oy-hero-image) center / cover no-repeat;
            box-shadow: 0 30px 84px rgba(14,63,76,.22);
          }
          .oy-dashboard-hero .ant-typography,
          .oy-dashboard-hero h3 { color: #fff; }
          .oy-dashboard-hero .ant-typography-secondary { color: rgba(255,255,255,.74) !important; }
          .oy-dashboard-hero-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 22px; }
          .oy-dashboard-kpi { display: grid; grid-template-columns: 1.3fr repeat(3, 1fr); gap: 12px; margin-top: 18px; }
          .oy-dashboard-kpi-card { padding: 18px; border: 1px solid rgba(255,255,255,.26); border-radius: 16px; background: rgba(255,255,255,.14); min-height: 126px; backdrop-filter: blur(16px); }
          .oy-dashboard-kpi-card .ant-typography { color: rgba(255,255,255,.78) !important; }
          .oy-dashboard-number { color: #fff; font-size: 36px; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; margin-top: 16px; }
          .oy-dashboard-chart-row { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr); gap: 16px; margin-top: 16px; }
          .oy-dashboard-panel { padding: 18px; min-height: 292px; }
          .oy-dashboard-panel-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
          .oy-dashboard-insight { padding: 18px; min-height: 264px; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(180deg, rgba(255,255,255,.94), rgba(230,247,248,.78)); }
          .oy-dashboard-action { display: grid; grid-template-columns: 44px 1fr; gap: 12px; padding: 12px 0; border-top: 1px solid color-mix(in srgb, var(--oy-brand) 10%, #E8F0F8); }
          .oy-dashboard-action:first-child { border-top: none; }
          .oy-dashboard-stage { color: var(--oy-brand-deep); font-weight: 800; font-variant-numeric: tabular-nums; }
          .oy-insight-callout { padding: 14px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--oy-brand), transparent 72%); background: #EFFFFA; margin-bottom: 16px; }
          .oy-insight-evidence { margin: 8px 0 6px; color: #747677; }
          .oy-insight-suggestion { color: var(--oy-brand-deep); font-weight: 700; }
          .oy-freshness-badge { align-self: flex-start; }
          .oy-rank-list { display: grid; gap: 10px; margin-top: 12px; }
          .oy-rank-row { display: grid; grid-template-columns: 34px minmax(72px, 1fr) minmax(72px, 1.2fr) 36px; gap: 10px; align-items: center; }
          .oy-rank-index { color: var(--oy-brand-deep); font-weight: 800; font-variant-numeric: tabular-nums; }
          .oy-rank-bar { height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--oy-brand) 12%, #fff); overflow: hidden; }
          .oy-rank-bar span { display: block; height: 100%; border-radius: inherit; }
          .oy-data-status { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 12px; }
          .oy-dashboard-empty { min-height: 220px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; text-align: center; padding: 28px 18px; border: 1px dashed color-mix(in srgb, var(--oy-brand) 24%, #D7E4EA); border-radius: 14px; background: color-mix(in srgb, var(--oy-brand-soft), #fff 54%); }
          .oy-dashboard-empty h4 { margin: 0; color: #102A2F; }
          .oy-dashboard-empty .ant-typography { max-width: 560px; }
          .oy-dashboard-empty-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
          @media (max-width: 960px) {
            .oy-dashboard-overview { padding: 20px; }
            .oy-dashboard-grid, .oy-dashboard-chart-row, .oy-dashboard-kpi { grid-template-columns: 1fr; }
            .oy-dashboard-top { flex-direction: column; }
          }
        `}</style>

        <div className="oy-dashboard-shell">
          <div className="oy-dashboard-top">
            <div className="oy-dashboard-brand">
              <div className="oy-dashboard-logo">{PAGE.brandInitials}</div>
              <div>
                <Title level={2} style={{ margin: 0 }}>{PAGE.brandName}</Title>
                <Text type="secondary">{PAGE.tagline}</Text>
              </div>
            </div>
            <Button type="primary">{primaryAction}</Button>
          </div>

          <div className="oy-dashboard-grid">
            <section className="oy-dashboard-card oy-dashboard-hero">
              <div className="oy-dashboard-hero-head">
                <div>
                  <Tag color="processing">{shellLabel} + {ARCHETYPE || 'overview'}</Tag>
                  <Title level={3} style={{ marginTop: 16, marginBottom: 8 }}>{PAGE.ctaTitle}</Title>
                  <Paragraph style={{ maxWidth: 720, fontSize: 16, marginBottom: 0 }}>{PAGE.heroText}</Paragraph>
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
                        {usesSeedRows ? '当前为 sample/seed 预览指标，未接真实表单。' : '未配置真实表单 dataBinding，当前不显示前端静态业务指标。'}
                      </Text>
                    </div>
                  )}
                </div>
                <DataFreshnessBadge researchLevel={usesSeedRows ? 'sample seed' : isDataBindingEnabled(DATA_BINDING) ? 'DataBridge' : 'empty'} />
              </div>
              <div className="oy-dashboard-kpi">
                {metricItems.slice(0, 4).map((item, index) => (
                  <KpiPrimitive item={item} index={index} brandDeep={brandDeep} key={item.label} />
                ))}
              </div>
            </section>

            <aside className="oy-dashboard-card oy-dashboard-insight">
              <div>
                <Title level={4} style={{ marginTop: 0 }}>{PAGE.ctaTitle}</Title>
                <InsightCallout insight={insight} fallback={PAGE.ctaText} />
              </div>
              <div>
                {ROADMAP.slice(0, 3).map((item) => (
                  <ActionStep item={item} key={item.stage} />
                ))}
              </div>
            </aside>
          </div>

          <div className="oy-dashboard-chart-row">
            <ChartPanel title="趋势分析" subtitle={`${mainMetric.label}: ${mainMetric.value}`}>
              {hasChartData ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--oy-brand) 12%, #E8F0F8)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="target" name="目标" stroke={palette[2]} fill={palette[2]} fillOpacity={0.12} />
                    <Area type="monotone" dataKey="value" name="实际" stroke={brand} fill={brand} fillOpacity={0.18} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <DashboardEmptyState
                  title={trendEmptyTitle}
                  text={trendEmptyText}
                />
              )}
            </ChartPanel>

            <ChartPanel title={PAGE.featuresTitle} subtitle={`TOP ${rankData.length}`}>
              {hasChartData ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={rankData} layout="vertical" margin={{ left: 10, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="color-mix(in srgb, var(--oy-brand) 12%, #E8F0F8)" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={96} />
                      <Tooltip />
                      <Bar dataKey="value" name="贡献度" fill={palette[1] || brand} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <RankList data={rankData} color={palette[1] || brand} />
                </>
              ) : (
                <DashboardEmptyState
                  title={rankEmptyTitle}
                  text={rankEmptyText}
                />
              )}
            </ChartPanel>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
