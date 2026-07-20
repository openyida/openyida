/**
 * OpenYida Code Canvas custom page template.
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 */
import React, { useMemo, useState, useEffect } from 'react';
import { ConfigProvider, Button, Input, Select, Tag, Typography } from 'antd';

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
  brandName: '双栏业务详情',
  brandInitials: 'SP',
  tagline: '列表筛选和详情处理并行',
  heroText: '左侧保留队列和筛选上下文，右侧展示当前对象详情、关键指标和处理建议，适合逐条审核和运营处理。',
  primaryCta: '处理当前项',
  secondaryCta: '返回列表',
  featuresTitle: '业务队列',
  roadmapTitle: '处理步骤',
  ctaTitle: '详情建议',
  ctaText: '双栏详情页适合高频查阅和逐条处理。',
});

const DEFAULT_FEATURES = [
  { title: '合同审核', text: '展示事项摘要、负责人和处理状态。' },
  { title: '采购申请', text: '快速查看金额、说明和当前节点。' },
  { title: '客户跟进', text: '在右侧详情里保留下一步动作。' },
];
const DEFAULT_METRICS = [
  { label: '待办金额', value: '¥42.8万' },
  { label: '处理中', value: '36' },
  { label: '完成率', value: '94%' },
];
const DEFAULT_ROADMAP = [
  { stage: '01', title: '选择记录', text: '在左侧列表快速筛选业务对象。' },
  { stage: '02', title: '查看详情', text: '右侧展示状态、摘要和操作建议。' },
  { stage: '03', title: '推进处理', text: '完成分派、备注或状态更新。' },
];
const DEFAULT_THEME_PROFILE = { followRuntimeTheme: false, name: 'amber-client-file', themeColor: '#B7791F', themeColorDeep: '#7C4A03', themeColorSoft: '#FFF8E7', themeColorTint: 'rgba(183, 121, 31, 0.18)', palette: ['#B7791F', '#0F9F8E', '#E11D48', '#2563EB', '#F97316'] };
const DEFAULT_DATA_BINDING = { enabled: false, mode: 'seed' };
const DEFAULT_INSIGHTS = [{ conclusion: '双栏详情页适合高频查阅和逐条处理。' }];
const BACKGROUND_IMAGES = {
  detail: 'https://images.unsplash.com/photo-1771147372627-7fffe86cf00b?auto=format&fit=crop&w=1400&q=80',
  queue: 'https://images.unsplash.com/photo-1759884247160-27b8465544b6?auto=format&fit=crop&w=1200&q=80',
};

const FEATURES = parseTemplateJson('{{FEATURES_JSON}}', DEFAULT_FEATURES);
const METRICS = parseTemplateJson('{{METRICS_JSON}}', DEFAULT_METRICS);
const ROADMAP = parseTemplateJson('{{ROADMAP_JSON}}', DEFAULT_ROADMAP);
const THEME_PROFILE = parseTemplateJson('{{OPENYIDA_THEME_PROFILE_JSON}}', DEFAULT_THEME_PROFILE);
const THEME_SCOPE = withFallback('{{OPENYIDA_THEME_SCOPE}}', 'page');
const DATA_BINDING = parseTemplateJson('{{OPENYIDA_DATA_BINDING_JSON}}', DEFAULT_DATA_BINDING);
const INSIGHTS = parseTemplateJson('{{OPENYIDA_INSIGHTS_JSON}}', DEFAULT_INSIGHTS);

function getThemeColor(fallback) {
  if (typeof window === 'undefined' || !window.getComputedStyle) {
    return fallback;
  }
  const value = window.getComputedStyle(document.documentElement).getPropertyValue('--color-brand1-6').trim();
  return value || fallback;
}

function buildScopedThemeVars() {
  const brand = THEME_PROFILE.followRuntimeTheme ? getThemeColor(THEME_PROFILE.themeColor) : THEME_PROFILE.themeColor;
  return {
    '--oy-brand': brand,
    '--oy-brand-soft': THEME_PROFILE.themeColorSoft || 'rgba(243,245,251,1)',
    '--oy-brand-deep': THEME_PROFILE.themeColorDeep || '#1f2a44',
    '--oy-radius-shell': '12px',
    '--oy-radius-card': '8px',
    '--oy-radius-control': '6px',
    '--oy-detail-image': `url("${BACKGROUND_IMAGES.detail}")`,
    '--oy-queue-image': `url("${BACKGROUND_IMAGES.queue}")`,
  };
}

function updateShellTheme() {
  if (THEME_SCOPE !== 'app' || typeof window === 'undefined') {
    return;
  }
  const api = window.__YIDA__ || window.Yida;
  if (api && typeof api.updateShellConfig === 'function') {
    api.updateShellConfig({
      themeConfig: {
        themeColor: getThemeColor(THEME_PROFILE.themeColor),
        navTheme: THEME_PROFILE.navTheme || 'light',
        mode: THEME_PROFILE.mode || 'color_color',
        colorMode: THEME_PROFILE.colorMode || 'gradient',
      },
    });
  }
}

function getSeedRows() {
  const rows = FEATURES.map((item, index) => ({
    id: `ROW-${index + 1}`,
    title: item.title,
    desc: item.text,
    status: index === 0 ? '高优先级' : index === 1 ? '待跟进' : '正常',
    owner: ['区域运营', '客服主管', '渠道经理'][index % 3],
    amount: METRICS[index] ? METRICS[index].value : `${index + 1}8`,
  }));
  return rows.length ? rows : [
    { id: 'ROW-1', title: PAGE.brandName, desc: PAGE.heroText, status: '待处理', owner: '负责人', amount: '-' },
  ];
}

function getStatusColor(status) {
  if (/高|异常|风险|超时/.test(status)) {
    return 'error';
  }
  if (/待|跟进/.test(status)) {
    return 'warning';
  }
  return 'success';
}

const QUEUE_STATUS = { high: '高优先级', pending: '待跟进' };

function SplitQueue({ rows, selectedId, onSelect, filters, onFilterChange }) {
  return (
    <aside className="oy-split-queue">
      <div className="oy-filter-bar">
        <Input.Search placeholder="搜索对象、负责人或状态" allowClear value={filters.keyword} onChange={(e) => onFilterChange('keyword', e.target.value)} />
        <Select
          value={filters.status}
          onChange={(value) => onFilterChange('status', value)}
          options={[
            { label: '全部', value: 'all' },
            { label: '高优先级', value: 'high' },
            { label: '待跟进', value: 'pending' },
          ]}
        />
      </div>
      <div className="oy-queue-list">
        {rows.length === 0 ? (
          <div className="oy-queue-empty"><Text>无匹配工单，试试清空搜索或切换状态</Text></div>
        ) : rows.map((row) => (
          <button
            type="button"
            key={row.id}
            className={`oy-queue-item ${row.id === selectedId ? 'is-active' : ''}`}
            onClick={() => onSelect(row.id)}
          >
            <span>
              <strong>{row.title}</strong>
              <Text>{row.desc}</Text>
            </span>
            <Tag color={getStatusColor(row.status)}>{row.status}</Tag>
          </button>
        ))}
      </div>
    </aside>
  );
}

function DetailPane({ item }) {
  const insight = INSIGHTS[0] || { conclusion: PAGE.ctaText, evidence: '', suggestion: '' };
  return (
    <section className="oy-detail-pane">
      <div className="oy-detail-hero">
        <Tag color="warning">当前选中</Tag>
        <Title level={2}>{item.title}</Title>
        <Paragraph>{item.desc}</Paragraph>
        <div className="oy-detail-actions">
          <Button type="primary">{PAGE.primaryCta}</Button>
          <Button>{PAGE.secondaryCta}</Button>
        </div>
      </div>
      <div className="oy-detail-grid">
        {METRICS.map((metric) => (
          <div className="oy-metric-card" key={metric.label}>
            <Text>{metric.label}</Text>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <div className="oy-insight-card">
        <Text>处理建议</Text>
        <h3>{insight.conclusion}</h3>
        <p>{insight.evidence || PAGE.ctaText}</p>
        <Button type="link">{insight.suggestion || '查看相关记录'}</Button>
      </div>
      <div className="oy-timeline-card">
        <Text>{PAGE.roadmapTitle}</Text>
        {ROADMAP.map((step) => (
          <div className="oy-timeline-row" key={`${step.stage}-${step.title}`}>
            <span>{step.stage}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function YidaComp() {
  useEffect(() => { updateShellTheme(); }, []);
  const rows = useMemo(() => getSeedRows(), []);
  const [selectedId, setSelectedId] = useState(rows[0] && rows[0].id);
  const [queueFilters, setQueueFilters] = useState({ keyword: '', status: 'all' });
  const handleQueueFilter = (key, value) => setQueueFilters((prev) => Object.assign({}, prev, { [key]: value }));
  const filteredRows = useMemo(() => {
    const kw = (queueFilters.keyword || '').trim().toLowerCase();
    return rows.filter((row) => {
      if (queueFilters.status !== 'all' && row.status !== QUEUE_STATUS[queueFilters.status]) { return false; }
      if (kw) {
        const hay = ((row.title || '') + ' ' + (row.desc || '') + ' ' + (row.owner || '') + ' ' + (row.status || '')).toLowerCase();
        if (hay.indexOf(kw) < 0) { return false; }
      }
      return true;
    });
  }, [rows, queueFilters]);
  const visibleSelectedId = filteredRows.some((row) => row.id === selectedId) ? selectedId : (filteredRows[0] && filteredRows[0].id);
  const selected = rows.find((row) => row.id === visibleSelectedId) || rows[0];
  const themeVars = buildScopedThemeVars();

  return (
    <ConfigProvider getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}>
      <main className="oy-split-pane-detail" style={themeVars}>
        <style>{`
          {{OPENYIDA_CANVAS_CONTROL_CSS}}
          .oy-split-pane-detail {
            min-height: 100vh;
            padding: 32px;
            color: #2A1A12;
            background:
              radial-gradient(circle at 10% 6%, rgba(246, 190, 92, .28), transparent 28%),
              linear-gradient(135deg, #FFF8E7 0%, #FFFFFF 48%, #FFF4E1 100%);
          }
          .oy-split-shell { max-width: 1480px; margin: 0 auto; }
          .oy-split-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
          .oy-brand-mark { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #D99A2B, #7C4A03); font-weight: 800; box-shadow: 0 14px 34px rgba(124,74,3,.16); }
          .oy-header-copy { display: flex; gap: 14px; align-items: flex-start; }
          .oy-header-copy h1 { margin: 0; font-size: 34px; line-height: 1.08; letter-spacing: 0; }
          .oy-header-copy p { margin: 8px 0 0; max-width: 760px; color: #5f6673; font-size: 15px; line-height: 1.7; }
          .oy-split-layout { display: grid; grid-template-columns: minmax(320px, 390px) 1fr; gap: 16px; min-height: 680px; }
          .oy-split-queue, .oy-detail-pane { border: 1px solid color-mix(in srgb, var(--oy-brand) 18%, #F1D9AC); border-radius: 18px; background: rgba(255,255,255,.90); box-shadow: 0 20px 48px rgba(124,74,3,.10); backdrop-filter: blur(14px); overflow: hidden; }
          .oy-split-queue { padding: 14px; background: linear-gradient(180deg, rgba(255,255,255,.90), rgba(255,248,231,.88)), var(--oy-queue-image) center / cover no-repeat; }
          .oy-filter-bar { display: grid; grid-template-columns: 1fr 118px; gap: 8px; margin-bottom: 12px; }
          .oy-queue-list { display: grid; gap: 8px; }
          .oy-queue-item { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; text-align: left; border: 1px solid rgba(183,121,31,.12); border-radius: 14px; background: rgba(255,255,255,.78); cursor: pointer; transition: .18s ease; }
          .oy-queue-item:hover, .oy-queue-item.is-active { border-color: var(--oy-brand); background: #fff; box-shadow: 0 12px 28px rgba(124,74,3,.12); transform: translateY(-1px); }
          .oy-queue-item strong { display: block; margin-bottom: 5px; font-size: 15px; }
          .oy-queue-item .ant-typography { display: block; color: #6b7280; font-size: 12px; line-height: 1.55; }
          .oy-detail-pane { padding: 20px; display: grid; grid-template-columns: 1.15fr .85fr; gap: 16px; align-content: start; }
          .oy-detail-hero {
            grid-column: 1 / -1;
            min-height: 238px;
            padding: 30px;
            border-radius: 20px;
            color: #fff;
            border: 1px solid rgba(255,255,255,.42);
            background:
              linear-gradient(90deg, rgba(77,45,7,.92), rgba(183,121,31,.68) 58%, rgba(255,214,138,.26)),
              var(--oy-detail-image) center / cover no-repeat;
            position: relative;
            overflow: hidden;
          }
          .oy-detail-hero h2, .oy-detail-hero p { color: #fff; position: relative; z-index: 1; }
          .oy-detail-hero h2 { margin: 14px 0 10px; font-size: 36px; line-height: 44px; font-weight: 900; }
          .oy-detail-hero p { max-width: 760px; color: rgba(255,255,255,.80); }
          .oy-detail-actions { position: relative; z-index: 1; display: flex; gap: 10px; flex-wrap: wrap; }
          .oy-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .oy-metric-card, .oy-insight-card, .oy-timeline-card { border: 1px solid color-mix(in srgb, var(--oy-brand) 14%, #F0D9AC); border-radius: 16px; background: #fff; padding: 18px; }
          .oy-metric-card strong { display: block; margin-top: 8px; font-size: 28px; line-height: 1; }
          .oy-insight-card h3 { margin: 10px 0 8px; font-size: 22px; }
          .oy-insight-card p, .oy-timeline-row p { margin: 4px 0 0; color: #667085; line-height: 1.65; }
          .oy-timeline-card { grid-row: span 2; }
          .oy-timeline-row { display: grid; grid-template-columns: 54px 1fr; gap: 12px; padding: 14px 0; border-top: 1px solid color-mix(in srgb, var(--oy-brand) 10%, #E8F0F8); }
          .oy-timeline-row:first-of-type { border-top: 0; }
          .oy-timeline-row > span { color: var(--oy-brand-deep); font-weight: 800; }
          @media (max-width: 960px) {
            .oy-split-pane-detail { padding: 18px; }
            .oy-split-header, .oy-header-copy { display: block; }
            .oy-brand-mark { margin-bottom: 12px; }
            .oy-split-layout, .oy-detail-pane { grid-template-columns: 1fr; }
            .oy-filter-bar, .oy-detail-grid { grid-template-columns: 1fr; }
          }
        `}</style>
        <div className="oy-split-shell" data-binding-mode={DATA_BINDING.mode}>
          <header className="oy-split-header">
            <div className="oy-header-copy">
              <div className="oy-brand-mark">{PAGE.brandInitials}</div>
              <div>
                <Tag color="warning">{PAGE.tagline}</Tag>
                <h1>{PAGE.brandName}</h1>
                <p>{PAGE.heroText}</p>
              </div>
            </div>
            <Button type="primary">{PAGE.primaryCta}</Button>
          </header>
          <section className="oy-split-layout">
            <SplitQueue rows={filteredRows} selectedId={visibleSelectedId} onSelect={setSelectedId} filters={queueFilters} onFilterChange={handleQueueFilter} />
            <DetailPane item={selected} />
          </section>
        </div>
      </main>
    </ConfigProvider>
  );
}

export default YidaComp;
