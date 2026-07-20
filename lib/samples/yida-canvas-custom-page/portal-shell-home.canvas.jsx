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
import { ConfigProvider, Button, Input, Tag, Typography } from 'antd';

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
  brandName: '红曜业务门户',
  brandInitials: 'RT',
  tagline: '统一入口、角色任务和经营脉搏',
  heroText: '把应用里的页面、表单、报表、待办和团队动态聚合成一个红色门户首页，让不同角色进来 3 秒内知道要处理什么、从哪里开始。',
  primaryCta: '进入工作台',
  secondaryCta: '调整角色入口',
  featuresTitle: '高频工作入口',
  roadmapTitle: '今日运营节奏',
  ctaTitle: '门户编排建议',
  ctaText: '红色门户应突出高优先级流程、风险闭环和团队协作脉搏，避免做成平均铺开的九宫格。',
});

const DEFAULT_FEATURES = [
  { title: '运营总览', text: '汇总今日待办、关键客户、异常流程和核心数据。', group: '管理层', value: '128' },
  { title: '流程处理', text: '把审批、分派、补材料和归档动作放到同一入口。', group: '协作组', value: '36' },
  { title: '客户服务', text: '跟踪高价值客户、服务 SLA 和回访任务。', group: '一线团队', value: '92%' },
  { title: '数据报表', text: '访问销售、履约、财务共享和周报导出。', group: '数据角色', value: '18' },
  { title: '知识资料', text: '沉淀制度、模板、FAQ 和项目复盘。', group: '共享中心', value: '42' },
  { title: '系统配置', text: '维护角色入口、导航分组和页面权限。', group: '管理员', value: '7' },
];
const DEFAULT_METRICS = [
  { label: '今日访问', value: '1,286', trend: '+18%' },
  { label: '待处理', value: '24', trend: '6 高优先级' },
  { label: '流程完成率', value: '96%', trend: '+4.2pp' },
  { label: '角色入口', value: '18', trend: '5 类人群' },
];
const DEFAULT_ROADMAP = [
  { stage: '09:30', title: '晨会待办清点', text: '运营主管确认高优先级流程和客户跟进分派。' },
  { stage: '11:00', title: '合同材料补齐', text: '法务、财务共享和一线销售同步补充附件。' },
  { stage: '14:30', title: '履约风险复盘', text: '仓配团队跟进苏州仓库存锁定与发票流转。' },
  { stage: '17:00', title: '日报自动归档', text: '门户沉淀今日处理记录，并推送给各角色负责人。' },
];
const DEFAULT_THEME_PROFILE = { followRuntimeTheme: false, name: 'crimson-portal', themeColor: '#DC2626', themeColorDeep: '#7F1D1D', themeColorSoft: '#FFF1F2', themeColorTint: 'rgba(220, 38, 38, 0.16)', palette: ['#DC2626', '#F97316', '#F43F5E', '#F59E0B', '#10B981'] };
const DEFAULT_APP_BLUEPRINT = { shell: 'portal', navigation: ['首页', '业务', '报表', '设置'] };
const DEFAULT_INSIGHTS = [{
  conclusion: '今天优先处理 6 条高优先级流程',
  evidence: '审批、合同材料和客户回访集中在上午，建议把流程入口和负责人状态固定在首屏。',
  suggestion: '把运营总览、流程处理和客户服务置顶，低频配置入口移到侧栏下半区。',
}];
const BACKGROUND_IMAGES = {
  team: 'https://images.unsplash.com/photo-1758873268745-dd2cf0d677b5?auto=format&fit=crop&w=1400&q=80',
  pattern: 'https://images.unsplash.com/photo-1678500877037-eb78ebaf79e1?auto=format&fit=crop&w=1400&q=80',
};

const FEATURES = parseTemplateJson('{{FEATURES_JSON}}', DEFAULT_FEATURES);
const METRICS = parseTemplateJson('{{METRICS_JSON}}', DEFAULT_METRICS);
const ROADMAP = parseTemplateJson('{{ROADMAP_JSON}}', DEFAULT_ROADMAP);
const THEME_PROFILE = parseTemplateJson('{{OPENYIDA_THEME_PROFILE_JSON}}', DEFAULT_THEME_PROFILE);
const THEME_SCOPE = withFallback('{{OPENYIDA_THEME_SCOPE}}', 'page');
const APP_BLUEPRINT = parseTemplateJson('{{OPENYIDA_APP_BLUEPRINT_JSON}}', DEFAULT_APP_BLUEPRINT);
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
    '--oy-team-image': `url("${BACKGROUND_IMAGES.team}")`,
    '--oy-pattern-image': `url("${BACKGROUND_IMAGES.pattern}")`,
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

function getNavItems() {
  const navigation = Array.isArray(APP_BLUEPRINT.navigation) ? APP_BLUEPRINT.navigation : [];
  const pages = Array.isArray(APP_BLUEPRINT.pages) ? APP_BLUEPRINT.pages : [];
  const names = navigation.length ? navigation : pages.map((page) => page.name).filter(Boolean);
  return (names.length ? names : FEATURES.map((item) => item.title)).slice(0, 6);
}

function PortalNav({ items, active, onChange }) {
  return (
    <nav className="oy-portal-nav" aria-label="页面内门户导航">
      {items.map((item) => (
        <button
          type="button"
          key={item}
          className={item === active ? 'is-active' : ''}
          onClick={() => onChange(item)}
        >
          <span>{item.slice(0, 1)}</span>
          {item}
        </button>
      ))}
    </nav>
  );
}

function SideInsight({ metrics, roadmap }) {
  const primaryMetric = metrics[0] || { label: '今日访问', value: '1,286', trend: '+18%' };
  const nextTask = roadmap[0] || { stage: '09:30', title: '晨会待办清点' };
  return (
    <div className="oy-side-insight">
      <Text className="oy-side-label">实时门户状态</Text>
      <strong>{primaryMetric.value}</strong>
      <small>{primaryMetric.label} · {primaryMetric.trend}</small>
      <div className="oy-side-next">
        <span>{nextTask.stage}</span>
        <p>{nextTask.title}</p>
      </div>
    </div>
  );
}

function MetricStrip({ metrics }) {
  return (
    <section className="oy-portal-metrics">
      {metrics.slice(0, 4).map((item, index) => (
        <div className={index === 0 ? 'oy-metric-card is-primary' : 'oy-metric-card'} key={item.label}>
          <Text>{item.label}</Text>
          <strong>{item.value}</strong>
          <small>{item.trend || '持续跟进'}</small>
        </div>
      ))}
    </section>
  );
}

function EntryCard({ item, index }) {
  const metric = METRICS[index % METRICS.length] || { value: '-', label: '状态' };
  const progress = [82, 68, 92, 74, 58, 46][index % 6];
  return (
    <article className="oy-portal-entry">
      <div className="oy-entry-topline">
        <div className="oy-entry-icon">{index + 1}</div>
        <Tag color={index < 2 ? 'red' : 'default'}>{item.group || metric.label}</Tag>
      </div>
      <h3>{item.title}</h3>
      <p>{item.text}</p>
      <div className="oy-entry-bottom">
        <span>
          <strong>{item.value || metric.value}</strong>
          <small>{metric.trend || metric.label}</small>
        </span>
        <span className="oy-entry-action">进入</span>
      </div>
      <div className="oy-entry-progress">
        <span style={{ width: progress + '%' }} />
      </div>
    </article>
  );
}

function RoleBoard({ features }) {
  const rows = features.slice(0, 4);
  return (
    <div className="oy-role-board">
      <Text>{PAGE.featuresTitle}</Text>
      <h3>角色入口热度</h3>
      {rows.map((item, index) => (
        <div className="oy-role-row" key={item.title}>
          <span>{item.group || '团队'}</span>
          <strong>{item.title}</strong>
          <small>{[92, 84, 76, 63][index]}%</small>
        </div>
      ))}
    </div>
  );
}

function YidaComp() {
  useEffect(() => { updateShellTheme(); }, []);
  const navItems = useMemo(() => getNavItems(), []);
  const [active, setActive] = useState(navItems[0] || PAGE.brandName);
  const insight = INSIGHTS[0] || { conclusion: PAGE.ctaText, evidence: '', suggestion: '' };
  const themeVars = buildScopedThemeVars();

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: THEME_PROFILE.themeColor,
          colorLink: THEME_PROFILE.themeColorDeep,
          colorText: '#2A1114',
          colorTextSecondary: '#7A4A4F',
        },
      }}
      getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}
    >
      <main className="oy-portal-shell-home" style={themeVars}>
        <style>{`
          {{OPENYIDA_CANVAS_CONTROL_CSS}}
          .oy-portal-shell-home {
            min-height: 100vh;
            color: #2A1114;
            background:
              radial-gradient(circle at 18% 10%, rgba(248, 113, 113, .20), transparent 30%),
              radial-gradient(circle at 86% 0%, rgba(249, 115, 22, .14), transparent 26%),
              linear-gradient(135deg, #FFF1F2 0%, #FFF7F7 48%, #FFFFFF 100%);
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
          }
          .oy-portal-layout { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; align-items: stretch; }
          .oy-portal-side {
            min-height: 100%;
            align-self: stretch;
            padding: 24px 18px;
            border-right: 1px solid rgba(255,255,255,.18);
            color: #fff;
            background:
              linear-gradient(180deg, rgba(127, 29, 29, .97), rgba(153, 27, 27, .94)),
              var(--oy-pattern-image) center / cover no-repeat;
            box-shadow: 18px 0 60px rgba(127, 29, 29, .18);
          }
          .oy-portal-brand { display: flex; gap: 12px; align-items: center; margin-bottom: 24px; }
          .oy-brand-mark { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; color: var(--oy-brand-deep); background: rgba(255,255,255,.92); font-weight: 900; box-shadow: 0 16px 34px rgba(24, 5, 51, .28); }
          .oy-portal-brand h1 { margin: 0; font-size: 18px; line-height: 1.2; letter-spacing: 0; }
          .oy-portal-brand p { margin: 4px 0 0; color: rgba(255,255,255,.72); font-size: 12px; }
          .oy-portal-search { margin-bottom: 16px; }
          .oy-portal-search .ant-input-affix-wrapper,
          .oy-portal-search .ant-input-group-addon .ant-btn { border-color: rgba(255,255,255,.22); background: rgba(255,255,255,.12); color: #fff; }
          .oy-portal-search input { color: #fff; background: transparent; }
          .oy-portal-search input::placeholder { color: rgba(255,255,255,.55); }
          .oy-portal-nav { display: grid; gap: 8px; }
          .oy-portal-nav button { height: 44px; display: flex; align-items: center; gap: 10px; border: 1px solid transparent; border-radius: 12px; background: transparent; color: rgba(255,255,255,.78); cursor: pointer; text-align: left; font-weight: 700; }
          .oy-portal-nav button span { width: 26px; height: 26px; border-radius: 9px; display: grid; place-items: center; background: rgba(255,255,255,.12); font-size: 12px; }
          .oy-portal-nav button:hover, .oy-portal-nav button.is-active { border-color: rgba(255,255,255,.28); color: #fff; background: rgba(255,255,255,.16); box-shadow: 0 16px 32px rgba(24,5,51,.18); }
          .oy-side-insight {
            margin-top: 18px;
            padding: 16px;
            border: 1px solid rgba(255,255,255,.18);
            border-radius: 18px;
            background: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.06));
          }
          .oy-side-label { display: block; color: rgba(255,255,255,.7) !important; font-size: 12px; }
          .oy-side-insight strong { display: block; margin-top: 10px; color: #fff; font-size: 32px; line-height: 1; font-variant-numeric: tabular-nums; }
          .oy-side-insight small { display: block; margin-top: 8px; color: rgba(255,255,255,.7); }
          .oy-side-next { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.14); }
          .oy-side-next span { color: #FECACA; font-weight: 900; font-variant-numeric: tabular-nums; }
          .oy-side-next p { margin: 6px 0 0; color: rgba(255,255,255,.82); line-height: 1.45; }
          .oy-portal-main { padding: 32px; }
          .oy-portal-hero { max-width: 1400px; margin: 0 auto 22px; display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(360px, .92fr); gap: 18px; align-items: stretch; }
          .oy-hero-copy, .oy-hero-panel, .oy-portal-entry, .oy-dynamic-card, .oy-update-feed { border: 1px solid color-mix(in srgb, var(--oy-brand) 14%, #FFE4E6); border-radius: 22px; background: rgba(255,255,255,.9); box-shadow: 0 22px 54px rgba(127,29,29,.10); backdrop-filter: blur(14px); }
          .oy-hero-copy {
            padding: 34px;
            min-height: 342px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            color: #fff;
            background:
              linear-gradient(90deg, rgba(127,29,29,.95), rgba(220,38,38,.72) 58%, rgba(249,115,22,.18)),
              var(--oy-team-image) center / cover no-repeat;
            overflow: hidden;
          }
          .oy-hero-copy h2 { margin: 18px 0 14px; color: #fff; font-size: 54px; line-height: 1.02; letter-spacing: 0; font-weight: 900; }
          .oy-hero-copy p { max-width: 760px; color: rgba(255,255,255,.82); font-size: 16px; line-height: 1.8; }
          .oy-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
          .oy-hero-copy .ant-btn-default { color: var(--oy-brand-deep); border: 0; }
          .oy-hero-panel { padding: 26px; color: #3A1418; background: linear-gradient(135deg, #FFFFFF 0%, #FFF1F2 100%); overflow: hidden; position: relative; }
          .oy-hero-panel:before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(color-mix(in srgb, var(--oy-brand) 10%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--oy-brand) 10%, transparent) 1px, transparent 1px); background-size: 34px 34px; opacity: .55; }
          .oy-hero-panel > * { position: relative; z-index: 1; }
          .oy-hero-panel h3 { margin: 54px 0 12px; color: #3A1418; font-size: 28px; line-height: 1.25; }
          .oy-hero-panel p { color: #7A4A4F; line-height: 1.7; }
          .oy-panel-bars { display: grid; gap: 10px; margin-top: 30px; }
          .oy-panel-bars span { height: 10px; border-radius: 999px; background: color-mix(in srgb, var(--oy-brand) 10%, #fff); overflow: hidden; }
          .oy-panel-bars span:after { content: ""; display: block; height: 100%; width: 72%; border-radius: inherit; background: linear-gradient(90deg, var(--oy-brand), #F97316 58%, #F43F5E); }
          .oy-panel-bars span:nth-child(2):after { width: 58%; }
          .oy-panel-bars span:nth-child(3):after { width: 86%; }
          .oy-portal-metrics {
            max-width: 1400px;
            margin: -8px auto 18px;
            display: grid;
            grid-template-columns: 1.2fr repeat(3, 1fr);
            gap: 14px;
          }
          .oy-metric-card {
            min-height: 116px;
            padding: 20px;
            border: 1px solid color-mix(in srgb, var(--oy-brand) 14%, #FFE4E6);
            border-radius: 20px;
            background: rgba(255,255,255,.9);
            box-shadow: 0 18px 44px rgba(127,29,29,.08);
          }
          .oy-metric-card.is-primary { background: linear-gradient(135deg, var(--oy-brand-deep), var(--oy-brand)); color: #fff; }
          .oy-metric-card.is-primary .ant-typography, .oy-metric-card.is-primary small { color: rgba(255,255,255,.76) !important; }
          .oy-metric-card strong { display: block; margin: 12px 0 8px; font-size: 36px; line-height: 1; font-variant-numeric: tabular-nums; }
          .oy-metric-card small { color: var(--oy-brand-deep); font-weight: 900; }
          .oy-portal-grid { max-width: 1400px; margin: 0 auto; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; }
          .oy-portal-entry { grid-column: span 2; padding: 22px; min-height: 248px; display: flex; flex-direction: column; }
          .oy-portal-entry:nth-child(1), .oy-portal-entry:nth-child(2) { grid-column: span 3; }
          .oy-entry-topline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
          .oy-entry-icon { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; color: var(--oy-brand-deep); background: color-mix(in srgb, var(--oy-brand) 13%, #fff); font-weight: 900; }
          .oy-portal-entry h3 { margin: 18px 0 8px; font-size: 22px; }
          .oy-portal-entry p { flex: 1; color: #7A4A4F; line-height: 1.65; }
          .oy-entry-bottom { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-top: 8px; }
          .oy-entry-bottom strong { display: block; font-size: 30px; line-height: 1; font-variant-numeric: tabular-nums; }
          .oy-entry-bottom small { display: inline-block; margin-top: 10px; color: var(--oy-brand-deep); font-size: 12px; font-weight: 800; }
          .oy-entry-action { color: var(--oy-brand-deep); font-weight: 900; }
          .oy-entry-progress { height: 8px; margin-top: 16px; border-radius: 999px; background: color-mix(in srgb, var(--oy-brand) 10%, #fff); overflow: hidden; }
          .oy-entry-progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--oy-brand), #F97316 60%, #F43F5E); }
          .oy-portal-bottom { max-width: 1400px; margin: 14px auto 0; display: grid; grid-template-columns: .85fr 1fr .85fr; gap: 14px; align-items: stretch; }
          .oy-dynamic-card, .oy-update-feed, .oy-role-board { padding: 22px; }
          .oy-dynamic-card h3 { margin: 10px 0 8px; font-size: 24px; }
          .oy-update-row { display: grid; grid-template-columns: 64px 1fr; gap: 12px; padding: 13px 0; border-top: 1px solid color-mix(in srgb, var(--oy-brand) 10%, #FFE4E6); }
          .oy-update-row:first-of-type { border-top: 0; }
          .oy-update-row span { color: var(--oy-brand-deep); font-weight: 800; }
          .oy-update-row p { margin: 4px 0 0; color: #7A4A4F; }
          .oy-role-board { border: 1px solid color-mix(in srgb, var(--oy-brand) 14%, #FFE4E6); border-radius: 22px; background: linear-gradient(135deg, #FFFFFF, #FFF1F2); box-shadow: 0 22px 54px rgba(127,29,29,.10); }
          .oy-role-board h3 { margin: 10px 0 14px; font-size: 24px; }
          .oy-role-row { display: grid; grid-template-columns: 70px 1fr 46px; gap: 10px; align-items: center; padding: 11px 0; border-top: 1px solid color-mix(in srgb, var(--oy-brand) 10%, #FFE4E6); }
          .oy-role-row:first-of-type { border-top: 0; }
          .oy-role-row span { color: #7A4A4F; font-size: 12px; }
          .oy-role-row strong { color: #2A1114; }
          .oy-role-row small { color: var(--oy-brand-deep); font-weight: 900; text-align: right; }
          @media (max-width: 1100px) {
            .oy-portal-shell-home { background: linear-gradient(135deg, #FFF1F2, var(--oy-brand-soft)); }
            .oy-portal-layout, .oy-portal-hero, .oy-portal-bottom, .oy-portal-metrics { grid-template-columns: 1fr; }
            .oy-portal-side { min-height: auto; }
            .oy-portal-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .oy-portal-grid { grid-template-columns: 1fr; }
            .oy-portal-entry, .oy-portal-entry:nth-child(1), .oy-portal-entry:nth-child(2) { grid-column: auto; }
            .oy-hero-copy h2 { font-size: 38px; }
          }
          @media (max-width: 640px) {
            .oy-portal-main, .oy-portal-side { padding: 18px; }
            .oy-portal-nav { grid-template-columns: 1fr; }
          }
        `}</style>
        <div className="oy-portal-layout">
          <aside className="oy-portal-side">
            <div className="oy-portal-brand">
              <div className="oy-brand-mark">{PAGE.brandInitials}</div>
              <div>
                <h1>{PAGE.brandName}</h1>
                <p>{PAGE.tagline}</p>
              </div>
            </div>
            <Input.Search className="oy-portal-search" placeholder="搜索入口、流程或数据" allowClear />
            <PortalNav items={navItems} active={active} onChange={setActive} />
            <SideInsight metrics={METRICS} roadmap={ROADMAP} />
          </aside>
          <section className="oy-portal-main">
            <div className="oy-portal-hero">
              <section className="oy-hero-copy">
                <Tag color="red">{active}</Tag>
                <Title level={2}>{PAGE.brandName}</Title>
                <Paragraph>{PAGE.heroText}</Paragraph>
                <div className="oy-hero-actions">
                  <Button type="primary">{PAGE.primaryCta}</Button>
                  <Button>{PAGE.secondaryCta}</Button>
                </div>
              </section>
              <section className="oy-hero-panel">
                <Tag color="red">Red Portal Shell</Tag>
                <h3>{insight.conclusion || PAGE.ctaTitle}</h3>
                <p>{insight.evidence || PAGE.ctaText}</p>
                <div className="oy-panel-bars">
                  <span />
                  <span />
                  <span />
                </div>
              </section>
            </div>
            <MetricStrip metrics={METRICS} />
            <section className="oy-portal-grid">
              {FEATURES.map((item, index) => <EntryCard item={item} index={index} key={item.title} />)}
            </section>
            <section className="oy-portal-bottom">
              <div className="oy-dynamic-card">
                <Text>{PAGE.ctaTitle}</Text>
                <h3>{insight.suggestion || PAGE.ctaText}</h3>
                <Paragraph>{PAGE.ctaText}</Paragraph>
              </div>
              <div className="oy-update-feed">
                <Text>{PAGE.roadmapTitle}</Text>
                {ROADMAP.map((item) => (
                  <div className="oy-update-row" key={`${item.stage}-${item.title}`}>
                    <span>{item.stage}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <RoleBoard features={FEATURES} />
            </section>
          </section>
        </div>
      </main>
    </ConfigProvider>
  );
}

export default YidaComp;
