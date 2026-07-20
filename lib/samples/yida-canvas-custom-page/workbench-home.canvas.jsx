/**
 * Yida workbench home Code Canvas template
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 */

import React, { useState } from 'react';
import { ConfigProvider, Button, Tag, Typography } from 'antd';

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
  brandName: 'RoseOps Hub',
  brandInitials: 'RH',
  tagline: '深玫红运营工作台',
  heroText: '把今日待办、重点指标、常用入口和团队动态压缩到一个清晰的操作首页，让打开应用后的第一眼就知道先做什么。',
  primaryCta: '创建事项',
  secondaryCta: '查看全局',
  featuresTitle: '高频入口',
  roadmapTitle: '今日节奏',
  ctaTitle: '今日重点',
  ctaText: '工作台不是展示页，重点是把任务优先级、业务进展和下一步动作放在一个可快速扫描的界面里。',
});

const DEFAULT_FEATURES = [
  { title: '审批与待办', text: '集中处理审批、补资料、确认和协作提醒。' },
  { title: '客户与订单', text: '进入客户跟进、订单排产、交付异常等高频页面。' },
  { title: '经营复盘', text: '查看当日转化、履约、风险和资源占用趋势。' },
  { title: '团队协作', text: '同步项目纪要、责任人和跨部门待确认事项。' },
  { title: '资料归档', text: '快速访问合同、凭证、方案和交付文档。' },
  { title: '自动化动作', text: '触发提醒、回访、审批催办和数据校验流程。' },
];
const DEFAULT_METRICS = [
  { label: '待处理事项', value: '28', detail: '6 项高优先级' },
  { label: '今日流转率', value: '91%', detail: '较昨日 +8%' },
  { label: '风险预警', value: '7', detail: '2 项需主管确认' },
  { label: '自动化执行', value: '143', detail: '成功率 98.6%' },
];
const DEFAULT_ROADMAP = [
  { stage: '09:20', title: '供应链补件确认', text: '3 个订单附件缺失，需在午前补齐。' },
  { stage: '11:40', title: '重点客户回访', text: 'A 级客户试用到期前触达，确认续约意向。' },
  { stage: '15:30', title: '审批 SLA 复盘', text: '检查本周超时节点并同步责任人。' },
  { stage: '18:10', title: '日终经营同步', text: '沉淀成交、退款、异常和明日优先级。' },
];
const DEFAULT_ASSETS = {
  materialStatus: 'curated-free',
  workspaceImage: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
  textureImage: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80',
  dashboardImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
};
const DEFAULT_VISUAL_PROFILE = { name: 'workbench-home', neutral: 'deep-rose-ops' };
const DEFAULT_THEME_PROFILE = {
  followRuntimeTheme: false,
  name: 'deep-rose-workbench',
  themeColor: '#9D174D',
  themeColorDeep: '#4A1230',
  themeColorSoft: '#3A1730',
  themeColorTint: 'rgba(244, 114, 182, 0.2)',
  palette: ['#F472B6', '#BE185D', '#F59E0B', '#38D9C7', '#A78BFA'],
};
const DEFAULT_INTERACTION_PROFILE = { primaryAction: '创建事项' };
const DEFAULT_INSIGHTS = [{ conclusion: '今日需优先清理高优先级待办。', suggestion: '先处理补件、回访和 SLA 复盘，再查看全局数据。' }];

const FEATURES = parseTemplateJson('{{FEATURES_JSON}}', DEFAULT_FEATURES);
const METRICS = parseTemplateJson('{{METRICS_JSON}}', DEFAULT_METRICS);
const ROADMAP = parseTemplateJson('{{ROADMAP_JSON}}', DEFAULT_ROADMAP);
const ASSETS = parseTemplateJson('{{ASSETS_JSON}}', DEFAULT_ASSETS);
const VISUAL_PROFILE = parseTemplateJson('{{OPENYIDA_VISUAL_PROFILE_JSON}}', DEFAULT_VISUAL_PROFILE);
const THEME_PROFILE = parseTemplateJson('{{OPENYIDA_THEME_PROFILE_JSON}}', DEFAULT_THEME_PROFILE);
const THEME_SCOPE = withFallback('{{OPENYIDA_THEME_SCOPE}}', 'page');
const INTERACTION_PROFILE = parseTemplateJson('{{OPENYIDA_INTERACTION_PROFILE_JSON}}', DEFAULT_INTERACTION_PROFILE);
const INSIGHTS = parseTemplateJson('{{OPENYIDA_INSIGHTS_JSON}}', DEFAULT_INSIGHTS);

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
    '--color-brand1-6': getThemeColor(profile, 'themeColor', '#9D174D'),
    '--color-brand1-2': getThemeColor(profile, 'themeColorSoft', '#3A1730'),
    '--color-brand1-9': getThemeColor(profile, 'themeColorDeep', '#4A1230'),
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
          theme: getThemeColor(profile, 'navTheme', 'dark'),
          themeColor: getThemeColor(profile, 'themeColor', readBrandColor(6, '#9D174D')),
        },
      });
    }
  } catch (err) {
    // Optional shell bridge.
  }
}

function Icon({ name, color }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color || 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { display: 'block' },
  };
  if (name === 'task') {
    return (
      <svg {...common}>
        <path d="M6 7h12" />
        <path d="M6 12h9" />
        <path d="M6 17h6" />
      </svg>
    );
  }
  if (name === 'pulse') {
    return (
      <svg {...common}>
        <path d="M4 13h3l2-6 4 12 2-6h5" />
      </svg>
    );
  }
  if (name === 'flow') {
    return (
      <svg {...common}>
        <path d="M5 6h5v5H5z" />
        <path d="M14 13h5v5h-5z" />
        <path d="M10 8.5h3.5a3 3 0 0 1 3 3V13" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function WorkbenchMetric({ item, index, palette }) {
  return (
    <div className={'oy-metric-card ' + (index === 0 ? 'is-primary' : '')} style={{ '--metric-accent': palette[index % palette.length] }}>
      <Text className="oy-label">{item.label}</Text>
      <div className="oy-number">{item.value}</div>
      <Text className="oy-muted">{item.detail || (index === 0 ? '优先处理' : '保持关注')}</Text>
    </div>
  );
}

function QuickEntry({ item, index, active, onSelect, palette }) {
  return (
    <button
      type="button"
      className={'oy-entry ' + (index === active ? 'is-active' : '')}
      style={{ '--entry-accent': palette[index % palette.length] }}
      onClick={() => onSelect(index)}
    >
      <span className="oy-entry-icon"><Icon name={index % 3 === 0 ? 'task' : index % 3 === 1 ? 'flow' : 'pulse'} /></span>
      <span>
        <Text className="oy-entry-title">{item.title}</Text>
        <Text className="oy-entry-copy">{item.text}</Text>
      </span>
    </button>
  );
}

function InsightStrip({ insight, page }) {
  const view = insight || {};
  return (
    <div className="oy-insight-strip">
      <Tag color="magenta">今日优先级</Tag>
      <Text className="oy-insight-title">{view.conclusion || page.ctaTitle}</Text>
      <Text className="oy-muted">{view.suggestion || page.ctaText}</Text>
    </div>
  );
}

function TaskFeed({ items }) {
  return (
    <div className="oy-task-feed">
      {items.slice(0, 4).map((item, index) => (
        <div className="oy-task-row" key={item.stage}>
          <div className="oy-task-time">{item.stage}</div>
          <div>
            <Text className="oy-task-title">{item.title}</Text>
            <Paragraph className="oy-task-copy">{item.text}</Paragraph>
          </div>
          <Tag color={index === 0 ? 'magenta' : 'default'}>{index === 0 ? '优先' : '待办'}</Tag>
        </div>
      ))}
    </div>
  );
}

function YidaComp() {
  const [active, setActive] = useState(0);
  React.useEffect(() => {
    applyShellTheme(THEME_SCOPE, THEME_PROFILE);
  }, []);

  const brand = getThemeColor(THEME_PROFILE, 'themeColor', readBrandColor(6, '#9D174D'));
  const brandDeep = getThemeColor(THEME_PROFILE, 'themeColorDeep', readBrandColor(9, '#4A1230'));
  const brandSoft = getThemeColor(THEME_PROFILE, 'themeColorSoft', readBrandColor(2, '#3A1730'));
  const palette = parseColorGroup(THEME_PROFILE.palette || [brand, '#F472B6', '#F59E0B', '#38D9C7', '#A78BFA']);
  const themeVars = buildScopedThemeVars(THEME_SCOPE, THEME_PROFILE);
  const selectedEntry = FEATURES[active] || FEATURES[0] || {};
  const primaryAction = INTERACTION_PROFILE.primaryAction || PAGE.primaryCta;
  const insight = INSIGHTS[0] || null;

  return (
    <ConfigProvider getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body} theme={{ token: { colorPrimary: brand, borderRadius: 8 } }}>
      <div
        className="oy-workbench-home"
        data-profile={VISUAL_PROFILE.name}
        data-theme-profile={THEME_PROFILE.name}
        data-theme-scope={THEME_SCOPE}
        style={{
          ...themeVars,
          '--oy-brand': brand,
          '--oy-brand-deep': brandDeep,
          '--oy-brand-soft': brandSoft,
          '--oy-accent-1': palette[0],
          '--oy-accent-2': palette[1],
          '--oy-accent-3': palette[2],
          '--oy-accent-4': palette[3],
          '--oy-workspace-image': `url("${ASSETS.workspaceImage || DEFAULT_ASSETS.workspaceImage}")`,
          '--oy-texture-image': `url("${ASSETS.textureImage || DEFAULT_ASSETS.textureImage}")`,
          '--oy-dashboard-image': `url("${ASSETS.dashboardImage || DEFAULT_ASSETS.dashboardImage}")`,
        }}
      >
        <style>{`
          {{OPENYIDA_CANVAS_CONTROL_CSS}}
          .oy-workbench-home {
            width: 100%;
            min-height: 100vh;
            padding: 0;
            color: #FDF2F8;
            background:
              radial-gradient(circle at 72% 8%, rgba(244, 114, 182, .16), transparent 32%),
              linear-gradient(120deg, rgba(35, 11, 29, .98), rgba(73, 18, 49, .94)),
              var(--oy-workspace-image) center/cover no-repeat;
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
            letter-spacing: 0;
            overflow-x: hidden;
          }
          .oy-workbench-home * { box-sizing: border-box; }
          .oy-shell {
            width: 100%;
            max-width: none;
            min-height: 100vh;
            margin: 0;
            display: grid;
            grid-template-columns: 248px minmax(0, 1fr);
            border: 0;
            border-radius: 0;
            overflow: hidden;
            background:
              linear-gradient(90deg, rgba(37, 12, 31, .96), rgba(37, 12, 31, .78)),
              var(--oy-workspace-image) center/cover no-repeat;
            box-shadow: none;
          }
          .oy-sidebar {
            min-height: 100vh;
            align-self: stretch;
            padding: 22px 18px;
            border-right: 1px solid rgba(255, 255, 255, .12);
            background:
              linear-gradient(180deg, rgba(81, 20, 57, .94), rgba(40, 12, 32, .96)),
              var(--oy-texture-image) center/cover no-repeat;
          }
          .oy-side-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
          .oy-logo {
            width: 42px;
            height: 42px;
            border-radius: 8px;
            display: grid;
            place-items: center;
            color: #FFF7FB;
            font-size: 13px;
            font-weight: 840;
            background: linear-gradient(135deg, var(--oy-brand), #F472B6);
            box-shadow: 0 18px 40px rgba(157, 23, 77, .34);
          }
          .oy-brand-title { color: #FFF7FB; font-size: 15px; font-weight: 760; line-height: 1.2; }
          .oy-muted { color: rgba(253, 242, 248, .64) !important; font-size: 13px; line-height: 20px; }
          .oy-nav { display: grid; gap: 6px; }
          .oy-nav-item {
            height: 38px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 10px;
            border-radius: 7px;
            color: rgba(253, 242, 248, .58);
            font-size: 13px;
          }
          .oy-nav-item.is-active {
            color: #FFF7FB;
            background: rgba(244, 114, 182, .16);
            box-shadow: inset 3px 0 0 #F472B6;
            font-weight: 720;
          }
          .oy-nav-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; opacity: .86; }
          .oy-main {
            min-width: 0;
            min-height: 100vh;
            padding: 24px 28px 28px;
            background: linear-gradient(180deg, rgba(255, 255, 255, .035), rgba(255, 255, 255, .015));
          }
          .oy-header { display: flex; justify-content: space-between; gap: 18px; align-items: center; margin-bottom: 18px; }
          .oy-header-copy { display: flex; gap: 12px; align-items: center; min-width: 0; }
          .oy-title { color: #FFF7FB !important; margin: 0 !important; font-size: 24px !important; line-height: 1.22 !important; }
          .oy-primary {
            height: 40px;
            border: 0 !important;
            color: #FFF7FB !important;
            background: linear-gradient(135deg, #BE185D, #F472B6) !important;
            font-weight: 760 !important;
            box-shadow: 0 18px 36px rgba(190, 24, 93, .26);
          }
          .oy-secondary {
            height: 40px;
            color: #FFF7FB !important;
            border-color: rgba(255, 255, 255, .2) !important;
            background: rgba(255, 255, 255, .08) !important;
          }
          .oy-priority {
            min-height: 172px;
            display: grid;
            grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr);
            gap: 18px;
            align-items: stretch;
            margin-bottom: 14px;
          }
          .oy-priority-card {
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, .14);
            border-radius: 8px;
            padding: 22px;
            background:
              linear-gradient(90deg, rgba(74, 18, 48, .94), rgba(74, 18, 48, .62)),
              var(--oy-dashboard-image) center/cover no-repeat;
          }
          .oy-priority-title { color: #FFF7FB !important; margin: 12px 0 8px !important; font-size: 28px !important; line-height: 1.2 !important; }
          .oy-priority-copy { color: rgba(253, 242, 248, .72) !important; max-width: 680px; margin: 0 !important; line-height: 24px !important; }
          .oy-command-card {
            border: 1px solid rgba(255, 255, 255, .14);
            border-radius: 8px;
            padding: 18px;
            background: linear-gradient(180deg, rgba(255, 255, 255, .11), rgba(255, 255, 255, .045));
          }
          .oy-command-list { display: grid; gap: 10px; margin-top: 14px; }
          .oy-command-row { display: grid; grid-template-columns: 28px 1fr auto; gap: 10px; align-items: center; }
          .oy-command-icon { width: 28px; height: 28px; border-radius: 7px; display: grid; place-items: center; color: #FFF7FB; background: rgba(244, 114, 182, .16); }
          .oy-command-title { color: #FFF7FB !important; font-size: 13px; font-weight: 700; line-height: 18px; }
          .oy-metrics {
            display: grid;
            grid-template-columns: 1.2fr repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 14px;
          }
          .oy-metric-card {
            min-height: 126px;
            padding: 16px;
            border: 1px solid rgba(255, 255, 255, .12);
            border-radius: 8px;
            background: linear-gradient(180deg, rgba(255, 255, 255, .10), rgba(255, 255, 255, .04));
          }
          .oy-metric-card::before {
            content: "";
            display: block;
            width: 38px;
            height: 3px;
            border-radius: 999px;
            margin-bottom: 12px;
            background: var(--metric-accent);
          }
          .oy-metric-card.is-primary {
            background: linear-gradient(180deg, rgba(190, 24, 93, .32), rgba(255, 255, 255, .055));
            border-color: rgba(244, 114, 182, .34);
          }
          .oy-label { color: rgba(253, 242, 248, .68) !important; font-size: 12px; line-height: 18px; }
          .oy-number { margin: 6px 0 8px; color: #FFF7FB; font-size: 34px; line-height: 1; font-weight: 840; font-variant-numeric: tabular-nums; }
          .oy-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, .55fr); gap: 14px; align-items: start; }
          .oy-panel {
            border: 1px solid rgba(255, 255, 255, .12);
            border-radius: 8px;
            background: rgba(255, 255, 255, .07);
            box-shadow: 0 18px 44px rgba(20, 8, 18, .24);
          }
          .oy-entry-panel { padding: 18px; }
          .oy-panel-title { color: #FFF7FB !important; margin: 10px 0 6px !important; font-size: 20px !important; line-height: 1.3 !important; }
          .oy-entry-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
          .oy-entry {
            min-height: 128px;
            display: grid;
            grid-template-columns: 34px 1fr;
            gap: 12px;
            padding: 14px;
            border: 1px solid rgba(255, 255, 255, .12);
            border-radius: 8px;
            color: inherit;
            background: rgba(42, 16, 32, .72);
            text-align: left;
            cursor: pointer;
            transition: transform .18s ease, border-color .18s ease, background .18s ease;
          }
          .oy-entry:hover { transform: translateY(-2px); border-color: rgba(244, 114, 182, .36); }
          .oy-entry.is-active { border-color: rgba(244, 114, 182, .56); background: rgba(157, 23, 77, .28); box-shadow: inset 3px 0 0 var(--entry-accent); }
          .oy-entry-icon { width: 34px; height: 34px; border-radius: 8px; display: grid; place-items: center; color: var(--entry-accent); background: rgba(255, 255, 255, .08); }
          .oy-entry-title { display: block; color: #FFF7FB !important; font-weight: 760; line-height: 20px; }
          .oy-entry-copy { display: block; margin-top: 7px; color: rgba(253, 242, 248, .62) !important; font-size: 13px; line-height: 21px; }
          .oy-insight-strip {
            display: grid;
            grid-template-columns: auto minmax(150px, .7fr) minmax(0, 1fr);
            gap: 10px;
            align-items: center;
            margin-top: 12px;
            padding: 12px;
            border: 1px solid rgba(244, 114, 182, .24);
            border-radius: 8px;
            background: rgba(244, 114, 182, .08);
          }
          .oy-insight-title { color: #FFF7FB !important; font-weight: 760; }
          .oy-feed-panel { padding: 18px; }
          .oy-selected {
            padding: 14px;
            border: 1px solid rgba(255, 255, 255, .12);
            border-radius: 8px;
            background: rgba(42, 16, 32, .64);
            margin-bottom: 16px;
          }
          .oy-selected-title { color: #FFF7FB !important; margin: 10px 0 6px !important; font-size: 18px !important; line-height: 1.35 !important; }
          .oy-task-feed { display: grid; gap: 0; }
          .oy-task-row { display: grid; grid-template-columns: 52px 1fr auto; gap: 12px; padding: 14px 0; border-top: 1px solid rgba(255, 255, 255, .11); align-items: start; }
          .oy-task-row:first-child { border-top: 0; }
          .oy-task-time { color: #F472B6; font-weight: 820; font-variant-numeric: tabular-nums; }
          .oy-task-title { color: #FFF7FB !important; font-weight: 740; }
          .oy-task-copy { color: rgba(253, 242, 248, .62) !important; margin: 4px 0 0 !important; font-size: 13px; line-height: 21px !important; }
          .oy-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
          .oy-chart {
            min-height: 148px;
            padding: 16px;
            border: 1px solid rgba(255, 255, 255, .12);
            border-radius: 8px;
            background: linear-gradient(180deg, rgba(255, 255, 255, .08), rgba(255, 255, 255, .035));
          }
          .oy-chart-title { color: #FFF7FB !important; font-weight: 760; }
          .oy-bars { height: 76px; display: flex; align-items: end; gap: 8px; margin-top: 16px; }
          .oy-bars span { flex: 1; min-width: 10px; border-radius: 999px 999px 3px 3px; background: linear-gradient(180deg, var(--oy-accent-1), rgba(244, 114, 182, .14)); }
          @media (max-width: 980px) {
            .oy-shell { grid-template-columns: 1fr; }
            .oy-sidebar { display: none; }
            .oy-main { padding: 16px; }
            .oy-header { align-items: flex-start; flex-direction: column; }
            .oy-priority, .oy-metrics, .oy-grid, .oy-charts, .oy-entry-grid, .oy-insight-strip { grid-template-columns: 1fr; }
          }
          @media (max-width: 560px) {
            .oy-priority-title { font-size: 22px !important; }
            .oy-number { font-size: 28px; }
            .oy-task-row { grid-template-columns: 46px 1fr; }
            .oy-task-row .ant-tag { width: fit-content; grid-column: 2; }
          }
        `}</style>

        <div className="oy-shell">
          <aside className="oy-sidebar">
            <div className="oy-side-brand">
              <div className="oy-logo">{PAGE.brandInitials}</div>
              <div>
                <div className="oy-brand-title">{PAGE.brandName}</div>
                <Text className="oy-muted">{PAGE.tagline}</Text>
              </div>
            </div>
            <nav className="oy-nav">
              {['今日工作台', '事项队列', '客户运营', '数据复盘', '流程自动化', '资料中心', '团队日程', '系统设置'].map((item, index) => (
                <div className={'oy-nav-item ' + (index === 0 ? 'is-active' : '')} key={item}>
                  <span className="oy-nav-dot" />
                  <span>{item}</span>
                </div>
              ))}
            </nav>
          </aside>

          <main className="oy-main">
            <header className="oy-header">
              <div className="oy-header-copy">
                <div className="oy-logo">{PAGE.brandInitials}</div>
                <div>
                  <Title level={2} className="oy-title">{PAGE.brandName}</Title>
                  <Text className="oy-muted">{PAGE.heroText}</Text>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button className="oy-secondary">{PAGE.secondaryCta}</Button>
                <Button className="oy-primary" type="primary">{primaryAction}</Button>
              </div>
            </header>

            <section className="oy-priority">
              <div className="oy-priority-card">
                <Tag color="magenta">今日重点</Tag>
                <Title level={2} className="oy-priority-title">{PAGE.ctaTitle}</Title>
                <Paragraph className="oy-priority-copy">{PAGE.ctaText}</Paragraph>
              </div>
              <div className="oy-command-card">
                <Tag color="gold">行动队列</Tag>
                <Title level={4} className="oy-panel-title">下一步动作</Title>
                <div className="oy-command-list">
                  {['清理高优先级待办', '核对客户回访结果', '同步异常与负责人'].map((item, index) => (
                    <div className="oy-command-row" key={item}>
                      <span className="oy-command-icon"><Icon name={index === 0 ? 'task' : index === 1 ? 'pulse' : 'flow'} /></span>
                      <Text className="oy-command-title">{item}</Text>
                      <Tag color={index === 0 ? 'magenta' : 'default'}>{index === 0 ? '现在' : '下一步'}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="oy-metrics">
              {METRICS.slice(0, 4).map((item, index) => (
                <WorkbenchMetric item={item} index={index} palette={palette} key={item.label} />
              ))}
            </section>

            <div className="oy-grid">
              <section className="oy-panel oy-entry-panel">
                <Tag color="magenta">常用入口</Tag>
                <Title level={3} className="oy-panel-title">{PAGE.featuresTitle}</Title>
                <Text className="oy-muted">{PAGE.heroText}</Text>
                <InsightStrip insight={insight} page={PAGE} />
                <div className="oy-entry-grid">
                  {FEATURES.slice(0, 6).map((item, index) => (
                    <QuickEntry item={item} index={index} active={active} onSelect={setActive} palette={palette} key={item.title} />
                  ))}
                </div>
              </section>

              <aside className="oy-panel oy-feed-panel">
                <div className="oy-selected">
                  <Tag color="magenta">当前选中</Tag>
                  <Title level={4} className="oy-selected-title">{selectedEntry.title || PAGE.ctaTitle}</Title>
                  <Text className="oy-muted">{selectedEntry.text || PAGE.ctaText}</Text>
                </div>
                <Title level={4} className="oy-panel-title">{PAGE.roadmapTitle}</Title>
                <TaskFeed items={ROADMAP} />
              </aside>
            </div>

            <section className="oy-charts">
              <div className="oy-chart">
                <Text className="oy-chart-title">流转趋势</Text>
                <div className="oy-bars">
                  {[38, 52, 44, 66, 82, 58, 74].map((height, index) => (
                    <span style={{ height: height + '%', background: `linear-gradient(180deg, ${palette[index % palette.length]}, rgba(244, 114, 182, .14))` }} key={index} />
                  ))}
                </div>
              </div>
              <div className="oy-chart">
                <Text className="oy-chart-title">资源负载</Text>
                <div className="oy-bars">
                  {[64, 72, 48, 88, 56, 76, 68].map((height, index) => (
                    <span style={{ height: height + '%', opacity: index % 2 ? .58 : 1, background: `linear-gradient(180deg, ${palette[(index + 1) % palette.length]}, rgba(253, 242, 248, .12))` }} key={index} />
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
