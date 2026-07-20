/**
 * Yida dark product homepage Code Canvas template
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 */

import React, { useMemo, useState } from 'react';
import { ConfigProvider, Button, Tag, Typography } from 'antd';
import { useMemoizedFn } from 'ahooks';

const { Text, Title, Paragraph } = Typography;

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
  brandName: 'Nebula Flow',
  brandInitials: 'NF',
  tagline: '暗色智能运营产品官网',
  heroText: '用一张高级感产品首页展示实时洞察、自动化编排和增长转化，让客户在首屏就看见产品价值。',
  primaryCta: '预约演示',
  secondaryCta: '查看能力',
  featuresTitle: '产品能力',
  roadmapTitle: '发布节奏',
  ctaTitle: '把官网变成业务入口',
  ctaText: '接入表单、报表、流程与连接器，把产品官网从展示页面升级为可交互、可转化、可运营的客户入口。',
});

const DEFAULT_FEATURES = [
  { title: '实时增长洞察', text: '汇总线索、订单、内容和渠道数据，首屏即可解释业务变化。' },
  { title: '自动化客户旅程', text: '把注册、试用、回访和续费动作编排成可追踪的转化路径。' },
  { title: '高可信产品展示', text: '用产品屏幕、客户指标和路线图替代空泛介绍，提升访问者判断效率。' },
];
const DEFAULT_METRICS = [
  { label: '转化提升', value: '+42%', detail: '官网访问到试用' },
  { label: '自动化流程', value: '186', detail: '运行中的增长动作' },
  { label: '客户触达', value: '92k', detail: '月度有效互动' },
  { label: '上线周期', value: '7d', detail: '从设计到发布' },
];
const DEFAULT_ROADMAP = [
  { stage: '01', title: '品牌首屏', text: '完成暗色视觉、价值主张和产品截图呈现。' },
  { stage: '02', title: '数据联动', text: '接入线索、订单和客户行为，沉淀可展示指标。' },
  { stage: '03', title: '转化运营', text: '上线表单、自动化跟进和客户分层触达。' },
];
const DEFAULT_ASSETS = {
  materialStatus: 'curated-free',
  heroImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=80',
  productImages: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1400&q=80',
  ],
};
const DEFAULT_VISUAL_PROFILE = { name: 'dark-product-homepage', neutral: 'obsidian-luxury', corner: 'layered' };
const DEFAULT_THEME_PROFILE = {
  followRuntimeTheme: false,
  name: 'noir-product',
  themeColor: '#2D2142',
  themeColorDeep: '#160F24',
  themeColorSoft: '#241934',
  themeColorTint: 'rgba(122, 92, 255, 0.24)',
  palette: ['#8D7CFF', '#F2C572', '#38D9C7', '#FF7A90', '#6FB8FF'],
};

const FEATURES = parseTemplateJson('{{FEATURES_JSON}}', DEFAULT_FEATURES);
const METRICS = parseTemplateJson('{{METRICS_JSON}}', DEFAULT_METRICS);
const ROADMAP = parseTemplateJson('{{ROADMAP_JSON}}', DEFAULT_ROADMAP);
const ASSETS = parseTemplateJson('{{ASSETS_JSON}}', DEFAULT_ASSETS);
const VISUAL_PROFILE = parseTemplateJson('{{OPENYIDA_VISUAL_PROFILE_JSON}}', DEFAULT_VISUAL_PROFILE);
const THEME_PROFILE = parseTemplateJson('{{OPENYIDA_THEME_PROFILE_JSON}}', DEFAULT_THEME_PROFILE);
const THEME_SCOPE = withFallback('{{OPENYIDA_THEME_SCOPE}}', 'page');
const THEME_COLOR_LEVELS = {
  themeColor: 6,
  themeColorSoft: 2,
  themeColorTint: 3,
  themeColorDeep: 9,
};

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
  if (profile && profile.followRuntimeTheme && THEME_COLOR_LEVELS[key]) {
    return readBrandColor(THEME_COLOR_LEVELS[key], fallback);
  }
  return (profile && profile[key]) || fallback;
}

function parseColorGroup(fallback) {
  if (THEME_PROFILE && THEME_PROFILE.followRuntimeTheme === false) {
    return fallback;
  }
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-group')
      .trim();
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
    '--color-brand1-6': getThemeColor(profile, 'themeColor', '#2D2142'),
    '--color-brand1-2': getThemeColor(profile, 'themeColorSoft', '#241934'),
    '--color-brand1-3': getThemeColor(profile, 'themeColorTint', 'rgba(122, 92, 255, 0.24)'),
    '--color-brand1-9': getThemeColor(profile, 'themeColorDeep', '#160F24'),
    '--color-brand-4': getThemeColor(profile, 'themeColorDeep', '#160F24'),
    '--color-brand-3': getThemeColor(profile, 'themeColor', '#2D2142'),
  };
}

function applyShellTheme(scope, profile) {
  if (scope !== 'app') {
    return;
  }
  try {
    const updateShellConfig = window && window.__YIDA__ && window.__YIDA__.updateShellConfig;
    if (typeof updateShellConfig !== 'function') {
      return;
    }
    updateShellConfig({
      themeConfig: {
        theme: getThemeColor(profile, 'navTheme', 'dark'),
        colorMode: getThemeColor(profile, 'colorMode', 'gradient'),
        mode: getThemeColor(profile, 'mode', 'color_color'),
        themeColor: getThemeColor(profile, 'themeColor', readBrandColor(6, '#2D2142')),
        mobileNavStyle: getThemeColor(profile, 'mobileNavStyle', 'top'),
      },
    });
  } catch (err) {
    // Shell theme bridge is optional; page scoped tokens still render correctly.
  }
}

function palette(profile) {
  if (profile.neutral === 'obsidian-luxury') {
    return {
      bg: '#160F24',
      panel: '#21162E',
      panelSoft: '#2B1D3D',
      panelLift: '#35254B',
      ink: '#FBF7EF',
      muted: '#B7AFC6',
      quiet: '#8D849C',
      line: 'rgba(255, 255, 255, 0.14)',
      lineStrong: 'rgba(255, 255, 255, 0.24)',
      accent: '#F2C572',
      good: '#38D9C7',
      warn: '#FFB86B',
    };
  }
  return {
    bg: '#1A1326',
    panel: '#231832',
    panelSoft: '#302145',
    panelLift: '#3A2B50',
    ink: '#FBF7EF',
    muted: '#B7AFC6',
    quiet: '#8D849C',
    line: 'rgba(255, 255, 255, 0.14)',
    lineStrong: 'rgba(255, 255, 255, 0.24)',
    accent: '#F2C572',
    good: '#38D9C7',
    warn: '#FFB86B',
  };
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
  if (name === 'spark') {
    return (
      <svg {...common}>
        <path d="M12 3l1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
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
  if (name === 'chart') {
    return (
      <svg {...common}>
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function getShortName(value) {
  const text = String(value || '').trim();
  if (!text) {
    return 'APP';
  }
  const letters = text.match(/[A-Za-z0-9]/g);
  if (letters && letters.length >= 2) {
    return letters.slice(0, 2).join('').toUpperCase();
  }
  return text.slice(0, 2).toUpperCase();
}

function getAsset(index, fallback) {
  const images = Array.isArray(ASSETS.productImages) ? ASSETS.productImages : [];
  return images[index] || fallback;
}

function YidaComp() {
  const [activeFeature, setActiveFeature] = useState(0);
  React.useEffect(() => {
    applyShellTheme(THEME_SCOPE, THEME_PROFILE);
  }, []);

  const themeVars = buildScopedThemeVars(THEME_SCOPE, THEME_PROFILE);
  const brand = getThemeColor(THEME_PROFILE, 'themeColor', readBrandColor(6, '#2D2142'));
  const brandDeep = getThemeColor(THEME_PROFILE, 'themeColorDeep', readBrandColor(9, '#160F24'));
  const brandSoft = getThemeColor(THEME_PROFILE, 'themeColorSoft', readBrandColor(2, '#241934'));
  const brandPalette = parseColorGroup(THEME_PROFILE.palette || ['#8D7CFF', '#F2C572', '#38D9C7', '#FF7A90', '#6FB8FF']);
  const colors = palette(VISUAL_PROFILE);
  const active = FEATURES[activeFeature] || FEATURES[0];
  const initials = PAGE.brandInitials === 'PN' ? getShortName(PAGE.brandName) : PAGE.brandInitials;
  const heroImage = ASSETS.heroImage || getAsset(0, DEFAULT_ASSETS.heroImage);
  const ambientImage = getAsset(0, DEFAULT_ASSETS.productImages[0]);
  const deviceImage = getAsset(1, DEFAULT_ASSETS.productImages[1]);
  const selectFeature = useMemoizedFn((index) => setActiveFeature(index));

  const metricCards = useMemo(() => METRICS.slice(0, 4).map((item, index) => (
    <div className="oy-metric" key={item.label} style={{ '--metric-accent': brandPalette[index % brandPalette.length] }}>
      <Text className="oy-metric-label">{item.label}</Text>
      <div className="oy-metric-value">{item.value}</div>
      <Text className="oy-metric-detail">{item.detail || '核心指标'}</Text>
    </div>
  )), [brandPalette]);

  return (
    <ConfigProvider
      getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}
      theme={{ token: { colorPrimary: brand, borderRadius: 8 } }}
    >
      <div
        className="oy-page"
        data-profile={VISUAL_PROFILE.name}
        data-theme-profile={THEME_PROFILE.name}
        data-theme-scope={THEME_SCOPE}
        style={{
          ...themeVars,
          '--oy-brand': brand,
          '--oy-brand-deep': brandDeep,
          '--oy-brand-soft': brandSoft,
          '--oy-accent-1': brandPalette[0],
          '--oy-accent-2': brandPalette[1],
          '--oy-accent-3': brandPalette[2],
          '--oy-accent-4': brandPalette[3],
          '--oy-bg': colors.bg,
          '--oy-panel': colors.panel,
          '--oy-panel-soft': colors.panelSoft,
          '--oy-panel-lift': colors.panelLift,
          '--oy-ink': colors.ink,
          '--oy-muted': colors.muted,
          '--oy-quiet': colors.quiet,
          '--oy-line': colors.line,
          '--oy-line-strong': colors.lineStrong,
          '--oy-gold': colors.accent,
          '--oy-good': colors.good,
          '--oy-warn': colors.warn,
          '--oy-hero-image': `url("${heroImage}")`,
          '--oy-ambient-image': `url("${ambientImage}")`,
          '--oy-device-image': `url("${deviceImage}")`,
          background: colors.bg,
          color: colors.ink,
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
        }}
      >
        <style>{`
          {{OPENYIDA_CANVAS_CONTROL_CSS}}
          .oy-page {
            min-height: 100vh;
            overflow: hidden;
            letter-spacing: 0;
          }
          .oy-page * { box-sizing: border-box; }
          .oy-hero {
            position: relative;
            min-height: 660px;
            padding: 26px 24px 44px;
            background:
              linear-gradient(90deg, rgba(22, 15, 36, .96) 0%, rgba(22, 15, 36, .9) 38%, rgba(22, 15, 36, .58) 100%),
              linear-gradient(180deg, rgba(45, 33, 66, .18), rgba(22, 15, 36, .96)),
              var(--oy-hero-image) center/cover no-repeat;
          }
          .oy-hero::after {
            content: "";
            position: absolute;
            inset: auto 0 0;
            height: 170px;
            background: linear-gradient(180deg, rgba(22, 15, 36, 0), var(--oy-bg));
            pointer-events: none;
          }
          .oy-shell { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; }
          .oy-nav { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 76px; }
          .oy-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
          .oy-mark {
            width: 42px;
            height: 42px;
            border: 1px solid var(--oy-line-strong);
            border-radius: 8px;
            display: grid;
            place-items: center;
            color: var(--oy-ink);
            font-weight: 800;
            font-size: 13px;
            background: linear-gradient(135deg, rgba(251, 247, 239, .18), rgba(255, 255, 255, .04));
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, .28), 0 14px 42px rgba(45, 33, 66, .34);
          }
          .oy-brand-title { color: var(--oy-ink); font-weight: 760; font-size: 16px; line-height: 1.2; }
          .oy-nav-links { display: flex; align-items: center; gap: 20px; color: var(--oy-muted); font-size: 13px; }
          .oy-nav-action {
            height: 38px;
            border-color: rgba(255, 255, 255, .22) !important;
            color: var(--oy-ink) !important;
            background: rgba(255, 255, 255, .08) !important;
          }
          .oy-hero-grid {
            display: grid;
            grid-template-columns: minmax(0, .92fr) minmax(420px, 1.08fr);
            gap: 34px;
            align-items: center;
          }
          .oy-kicker {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            width: fit-content;
            max-width: 100%;
            padding: 7px 11px;
            border: 1px solid rgba(242, 197, 114, .34);
            border-radius: 999px;
            color: var(--oy-gold);
            background: rgba(242, 197, 114, .09);
            font-size: 13px;
            font-weight: 700;
            line-height: 18px;
          }
          .oy-hero-title {
            color: var(--oy-ink) !important;
            margin: 18px 0 0 !important;
            font-size: 58px !important;
            line-height: 1.02 !important;
            font-weight: 840 !important;
            max-width: 620px;
          }
          .oy-hero-copy {
            margin: 20px 0 0 !important;
            max-width: 580px;
            color: var(--oy-muted) !important;
            font-size: 17px !important;
            line-height: 29px !important;
          }
          .oy-action-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 30px; }
          .oy-primary {
            height: 44px;
            padding: 0 22px !important;
            border: 0 !important;
            color: #1A1326 !important;
            font-weight: 760 !important;
            background: linear-gradient(135deg, #F8D98B, #8D7CFF) !important;
            box-shadow: 0 18px 44px rgba(141, 124, 255, .28);
          }
          .oy-secondary {
            height: 44px;
            padding: 0 18px !important;
            color: var(--oy-ink) !important;
            border-color: rgba(255, 255, 255, .22) !important;
            background: rgba(255, 255, 255, .08) !important;
          }
          .oy-proof { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 34px; max-width: 650px; }
          .oy-metric {
            min-height: 112px;
            border: 1px solid var(--oy-line);
            border-radius: 8px;
            padding: 14px;
            background: linear-gradient(180deg, rgba(255, 255, 255, .10), rgba(255, 255, 255, .045));
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, .13);
          }
          .oy-metric::before {
            content: "";
            display: block;
            width: 34px;
            height: 3px;
            border-radius: 999px;
            margin-bottom: 12px;
            background: var(--metric-accent);
          }
          .oy-metric-label { display: block; color: var(--oy-muted) !important; font-size: 12px; line-height: 18px; }
          .oy-metric-value { margin-top: 4px; color: var(--oy-ink); font-size: 26px; line-height: 1; font-weight: 820; font-variant-numeric: tabular-nums; }
          .oy-metric-detail { display: block; margin-top: 8px; color: var(--oy-quiet) !important; font-size: 12px; line-height: 18px; }
          .oy-visual {
            position: relative;
            min-height: 500px;
            display: grid;
            place-items: center;
          }
          .oy-visual-bg {
            position: absolute;
            inset: 18px 0 0 38px;
            border-radius: 8px;
            background:
              linear-gradient(180deg, rgba(22, 15, 36, .06), rgba(22, 15, 36, .84)),
              var(--oy-ambient-image) center/cover no-repeat;
            opacity: .7;
            transform: rotate(-2deg);
            border: 1px solid rgba(255, 255, 255, .11);
          }
          .oy-device {
            position: relative;
            width: min(100%, 640px);
            border: 1px solid rgba(255, 255, 255, .18);
            border-radius: 8px;
            padding: 12px;
            background: linear-gradient(180deg, rgba(255, 255, 255, .16), rgba(255, 255, 255, .06));
            box-shadow: 0 38px 90px rgba(9, 6, 16, .52);
          }
          .oy-device-screen {
            min-height: 390px;
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, .12);
            background:
              linear-gradient(180deg, rgba(33, 22, 46, .82), rgba(22, 15, 36, .92)),
              var(--oy-device-image) center/cover no-repeat;
          }
          .oy-window-bar {
            height: 42px;
            padding: 0 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255, 255, 255, .11);
            background: rgba(22, 15, 36, .62);
          }
          .oy-dots { display: flex; gap: 7px; }
          .oy-dots span { width: 8px; height: 8px; border-radius: 999px; background: rgba(255, 255, 255, .28); }
          .oy-screen-content { padding: 20px; display: grid; grid-template-columns: .95fr 1.05fr; gap: 14px; }
          .oy-panel {
            border: 1px solid rgba(255, 255, 255, .12);
            border-radius: 8px;
            padding: 14px;
            background: rgba(22, 15, 36, .58);
          }
          .oy-panel-title { color: var(--oy-ink) !important; font-weight: 760; }
          .oy-bars { display: flex; align-items: end; gap: 8px; height: 128px; margin-top: 18px; }
          .oy-bar { flex: 1; min-width: 10px; border-radius: 999px 999px 3px 3px; background: linear-gradient(180deg, var(--oy-accent-1), rgba(141, 124, 255, .16)); }
          .oy-feed { display: grid; gap: 10px; margin-top: 14px; }
          .oy-feed-row { display: grid; grid-template-columns: 28px 1fr auto; gap: 10px; align-items: center; }
          .oy-feed-icon { width: 28px; height: 28px; border-radius: 7px; display: grid; place-items: center; color: var(--oy-ink); background: rgba(255, 255, 255, .11); }
          .oy-feed-title { color: var(--oy-ink) !important; font-size: 13px; line-height: 18px; }
          .oy-feed-meta { color: var(--oy-quiet) !important; font-size: 12px; line-height: 18px; }
          .oy-floating-note {
            position: absolute;
            right: -12px;
            bottom: 28px;
            width: 214px;
            border: 1px solid rgba(242, 197, 114, .22);
            border-radius: 8px;
            padding: 14px;
            background: rgba(43, 29, 61, .9);
            box-shadow: 0 24px 54px rgba(9, 6, 16, .46);
          }
          .oy-section-band {
            padding: 36px 24px 44px;
            background:
              linear-gradient(180deg, var(--oy-bg), #1D142A 62%, #160F24);
          }
          .oy-section-head { display: flex; justify-content: space-between; gap: 24px; align-items: end; margin-bottom: 18px; }
          .oy-section-title { color: var(--oy-ink) !important; margin: 0 !important; font-size: 26px !important; line-height: 1.25 !important; }
          .oy-section-copy { max-width: 460px; color: var(--oy-muted) !important; line-height: 24px !important; margin: 0 !important; }
          .oy-feature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
          .oy-feature {
            min-height: 190px;
            border: 1px solid var(--oy-line);
            border-radius: 8px;
            padding: 18px;
            cursor: pointer;
            background: linear-gradient(180deg, rgba(255, 255, 255, .09), rgba(255, 255, 255, .035));
            transition: border-color .18s ease, transform .18s ease, background .18s ease;
          }
          .oy-feature:hover { transform: translateY(-2px); border-color: rgba(242, 197, 114, .38); }
          .oy-feature-active { border-color: rgba(141, 124, 255, .54); background: linear-gradient(180deg, rgba(141, 124, 255, .18), rgba(255, 255, 255, .04)); }
          .oy-feature-icon { width: 36px; height: 36px; border-radius: 8px; display: grid; place-items: center; color: var(--oy-ink); background: rgba(255, 255, 255, .1); }
          .oy-feature-title { color: var(--oy-ink) !important; margin: 18px 0 8px !important; font-size: 17px !important; line-height: 1.35 !important; }
          .oy-feature-copy { color: var(--oy-muted) !important; font-size: 14px; line-height: 23px; }
          .oy-lower-grid { display: grid; grid-template-columns: minmax(0, .92fr) minmax(360px, 1.08fr); gap: 14px; margin-top: 14px; align-items: stretch; }
          .oy-roadmap {
            border: 1px solid var(--oy-line);
            border-radius: 8px;
            overflow: hidden;
            background: rgba(255, 255, 255, .045);
          }
          .oy-step { display: grid; grid-template-columns: 54px 1fr; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--oy-line); }
          .oy-step:last-child { border-bottom: 0; }
          .oy-stage { color: var(--oy-gold) !important; font-weight: 820; font-variant-numeric: tabular-nums; }
          .oy-step-title { color: var(--oy-ink) !important; font-weight: 760; }
          .oy-step-copy { color: var(--oy-muted) !important; font-size: 13px; line-height: 21px; }
          .oy-conversion {
            min-height: 260px;
            border: 1px solid var(--oy-line);
            border-radius: 8px;
            padding: 20px;
            background:
              linear-gradient(90deg, rgba(22, 15, 36, .94), rgba(33, 22, 46, .56)),
              var(--oy-ambient-image) center/cover no-repeat;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .oy-selected { display: grid; gap: 10px; }
          .oy-selected-title { color: var(--oy-ink) !important; margin: 0 !important; font-size: 22px !important; line-height: 1.25 !important; }
          .oy-selected-copy { color: var(--oy-muted) !important; margin: 0 !important; line-height: 24px !important; }
          .oy-conversion-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid rgba(255, 255, 255, .12); padding-top: 16px; }
          .oy-pulse { width: 10px; height: 10px; border-radius: 999px; background: var(--oy-good); box-shadow: 0 0 0 6px rgba(56, 217, 199, .12); }
          @media (max-width: 980px) {
            .oy-hero { min-height: auto; padding: 18px 12px 30px; }
            .oy-nav { margin-bottom: 36px; }
            .oy-nav-links { display: none; }
            .oy-hero-grid, .oy-lower-grid { grid-template-columns: 1fr; }
            .oy-hero-title { font-size: 42px !important; }
            .oy-proof { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .oy-visual { min-height: 420px; }
            .oy-screen-content { grid-template-columns: 1fr; }
            .oy-floating-note { position: static; width: auto; margin: 12px 8px 0; }
            .oy-section-band { padding: 28px 12px 36px; }
            .oy-section-head { display: grid; align-items: start; }
            .oy-feature-grid { grid-template-columns: 1fr; }
          }
          @media (max-width: 560px) {
            .oy-hero-title { font-size: 34px !important; }
            .oy-hero-copy { font-size: 15px !important; line-height: 25px !important; }
            .oy-proof { grid-template-columns: 1fr; }
            .oy-visual { min-height: auto; display: block; margin-top: 28px; }
            .oy-visual-bg { inset: 12px; }
            .oy-device-screen { min-height: 330px; }
            .oy-step { grid-template-columns: 42px 1fr; padding: 14px; }
          }
        `}</style>

        <section className="oy-hero">
          <div className="oy-shell">
            <div className="oy-nav">
              <div className="oy-brand">
                <div className="oy-mark">{initials}</div>
                <div>
                  <div className="oy-brand-title">{PAGE.brandName}</div>
                  <Text style={{ color: colors.quiet, fontSize: 12 }}>Product Intelligence</Text>
                </div>
              </div>
              <div className="oy-nav-links">
                <span>Overview</span>
                <span>Automation</span>
                <span>Insights</span>
                <span>Pricing</span>
              </div>
              <Button className="oy-nav-action">{PAGE.secondaryCta}</Button>
            </div>

            <div className="oy-hero-grid">
              <div>
                <div className="oy-kicker">
                  <Icon name="spark" />
                  {PAGE.tagline}
                </div>
                <Title className="oy-hero-title">{PAGE.brandName}</Title>
                <Paragraph className="oy-hero-copy">{PAGE.heroText}</Paragraph>
                <div className="oy-action-row">
                  <Button className="oy-primary" type="primary">{PAGE.primaryCta}</Button>
                  <Button className="oy-secondary">{PAGE.secondaryCta}</Button>
                </div>
                <div className="oy-proof">{metricCards}</div>
              </div>

              <div className="oy-visual">
                <div className="oy-visual-bg" />
                <div className="oy-device">
                  <div className="oy-device-screen">
                    <div className="oy-window-bar">
                      <div className="oy-dots"><span /><span /><span /></div>
                      <Tag color="purple">Live product cockpit</Tag>
                    </div>
                    <div className="oy-screen-content">
                      <div className="oy-panel">
                        <Text className="oy-panel-title">Revenue pulse</Text>
                        <div className="oy-bars">
                          {[44, 68, 52, 86, 72, 94, 78, 100].map((height, index) => (
                            <span
                              className="oy-bar"
                              key={index}
                              style={{
                                height: height + '%',
                                background: `linear-gradient(180deg, ${brandPalette[index % brandPalette.length]}, rgba(255, 255, 255, .1))`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="oy-panel">
                        <Text className="oy-panel-title">Journey automation</Text>
                        <div className="oy-feed">
                          {['访客识别', '试用跟进', '商机评分', '续费提醒'].map((name, index) => (
                            <div className="oy-feed-row" key={name}>
                              <span className="oy-feed-icon">
                                <Icon name={index === 0 ? 'spark' : index === 1 ? 'flow' : 'chart'} />
                              </span>
                              <span>
                                <Text className="oy-feed-title">{name}</Text>
                                <br />
                                <Text className="oy-feed-meta">{index === 0 ? '正在捕获高意向访问' : '自动化节点已运行'}</Text>
                              </span>
                              <Tag color={index === 0 ? 'gold' : 'cyan'}>{index === 0 ? 'Now' : 'Auto'}</Tag>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="oy-floating-note">
                  <Text style={{ color: colors.accent, fontWeight: 760 }}>官网转化状态</Text>
                  <Paragraph style={{ color: colors.muted, margin: '8px 0 0', lineHeight: 1.55 }}>
                    线索表单、产品演示和客户回访已接入同一条增长链路。
                  </Paragraph>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="oy-section-band">
          <div className="oy-shell">
            <div className="oy-section-head">
              <Title level={2} className="oy-section-title">{PAGE.featuresTitle}</Title>
              <Paragraph className="oy-section-copy">{PAGE.ctaText}</Paragraph>
            </div>

            <div className="oy-feature-grid">
              {FEATURES.map((item, index) => (
                <div
                  key={item.title}
                  className={'oy-feature' + (activeFeature === index ? ' oy-feature-active' : '')}
                  onClick={() => selectFeature(index)}
                >
                  <span className="oy-feature-icon" style={{ color: brandPalette[index % brandPalette.length] }}>
                    <Icon name={index === 0 ? 'chart' : index === 1 ? 'flow' : 'spark'} />
                  </span>
                  <Title level={4} className="oy-feature-title">{item.title}</Title>
                  <Text className="oy-feature-copy">{item.text}</Text>
                </div>
              ))}
            </div>

            <div className="oy-lower-grid">
              <div>
                <Title level={2} className="oy-section-title" style={{ marginBottom: 14 }}>{PAGE.roadmapTitle}</Title>
                <div className="oy-roadmap">
                  {ROADMAP.map((item) => (
                    <div className="oy-step" key={item.stage}>
                      <Text className="oy-stage">{item.stage}</Text>
                      <div>
                        <Text className="oy-step-title">{item.title}</Text>
                        <br />
                        <Text className="oy-step-copy">{item.text}</Text>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="oy-conversion">
                <div className="oy-selected">
                  <Tag color="purple">Selected capability</Tag>
                  <Title level={3} className="oy-selected-title">{active.title}</Title>
                  <Paragraph className="oy-selected-copy">{active.text}</Paragraph>
                </div>
                <div className="oy-conversion-footer">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <span className="oy-pulse" />
                    <Text style={{ color: colors.muted }}>演示预约正在同步到客户表单</Text>
                  </span>
                  <Button className="oy-primary" type="primary">{PAGE.primaryCta}</Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
