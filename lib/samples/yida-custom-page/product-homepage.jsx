/**
 * 产品首页轻量模板
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 生成示例：
 * openyida sample yida-custom-page product-homepage \
 *   --output project/pages/src/openkuma-homepage.jsx \
 *   --var BRAND_NAME=OpenKuma \
 *   --var BRAND_INITIALS=OK \
 *   --var TAGLINE=开放项目首页工作台 \
 *   --var HERO_TEXT=把品牌展示、社区入口和运营反馈放进同一个宜搭页面
 */

var PAGE = {
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

var TOKENS = {
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
};

if (PAGE.brandName === TOKENS.brandName) {
  PAGE.brandName = 'NexaFlow';
}
if (PAGE.brandInitials === TOKENS.brandInitials) {
  PAGE.brandInitials = 'NF';
}
if (PAGE.tagline === TOKENS.tagline) {
  PAGE.tagline = '暗色产品官网首页';
}
if (PAGE.heroText === TOKENS.heroText) {
  PAGE.heroText = '面向 B2B SaaS、AI 工具和数据产品的高质感首页，首屏直接呈现产品价值、关键数据和下一步行动。';
}
if (PAGE.primaryCta === TOKENS.primaryCta) {
  PAGE.primaryCta = '查看方案';
}
if (PAGE.secondaryCta === TOKENS.secondaryCta) {
  PAGE.secondaryCta = '浏览路线';
}
if (PAGE.featuresTitle === TOKENS.featuresTitle) {
  PAGE.featuresTitle = '产品能力';
}
if (PAGE.roadmapTitle === TOKENS.roadmapTitle) {
  PAGE.roadmapTitle = '上线路径';
}
if (PAGE.ctaTitle === TOKENS.ctaTitle) {
  PAGE.ctaTitle = '下一步行动';
}
if (PAGE.ctaText === TOKENS.ctaText) {
  PAGE.ctaText = '把品牌页作为应用首页，再连接真实表单、报表和自动化，形成可运营的业务门户。';
}

var FEATURES = [
  {
    title: '智能编排',
    text: '把线索、审批、回访和自动化任务汇聚到一个操作链路。',
  },
  {
    title: '实时洞察',
    text: '用紧凑指标和趋势卡片展示转化、增长与风险变化。',
  },
  {
    title: '低代码交付',
    text: '保持原生自定义页格式，可继续接入表单、流程和页面跳转。',
  },
];

var METRICS = [
  { value: '4.8x', label: '流程提效' },
  { value: '12', label: '核心模块' },
  { value: '36h', label: '上线周期' },
];

var ROADMAP = [
  { stage: '01', title: '定位成型', text: '确定首屏信息、行动按钮和核心栏目。' },
  { stage: '02', title: '数据接入', text: '连接宜搭表单、报表和跳转页面。' },
  { stage: '03', title: '持续运营', text: '用自动化和内容更新保持页面活跃。' },
];

var FEATURES_JSON = '{{FEATURES_JSON}}';
var METRICS_JSON = '{{METRICS_JSON}}';
var ROADMAP_JSON = '{{ROADMAP_JSON}}';
var VISUAL_PROFILE_JSON = '{{OPENYIDA_VISUAL_PROFILE_JSON}}';
var THEME_PROFILE_JSON = '{{OPENYIDA_THEME_PROFILE_JSON}}';
var THEME_SCOPE = '{{OPENYIDA_THEME_SCOPE}}';

var NATIVE_CONTROL_RESET_CSS = [
  '.oyd-page{--oyd-control-border:#D0D5DD;--oyd-control-hover:#FFB4A8;--oyd-control-focus:#E85D4A;--oyd-control-focus-ring:rgba(232,93,74,.16);--oyd-control-selected-bg:rgba(232,93,74,.10);--oyd-control-info-bg:rgba(232,93,74,.10);}',
  '.oyd-page input,.oyd-page textarea,.oyd-page select,.oyd-page .oyd-input,.oyd-page .oyd-select-trigger{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:400;color:#1D2939;outline:none!important;box-shadow:none;}',
  '.oyd-page input,.oyd-page textarea,.oyd-page select,.oyd-page .oyd-input{border:1px solid var(--oyd-control-border);border-radius:6px;background:#fff;}',
  '.oyd-page input:hover,.oyd-page textarea:hover,.oyd-page select:hover,.oyd-page .oyd-input:hover,.oyd-page .oyd-select-trigger:hover{border-color:var(--oyd-control-hover)!important;}',
  '.oyd-page input:focus,.oyd-page textarea:focus,.oyd-page select:focus,.oyd-page .oyd-input:focus,.oyd-page .oyd-select-trigger:focus{border-color:var(--oyd-control-focus)!important;outline:none!important;box-shadow:0 0 0 3px var(--oyd-control-focus-ring)!important;}',
  '.oyd-page .oyd-select-trigger[aria-expanded="true"]{border-color:var(--oyd-control-focus)!important;box-shadow:0 0 0 3px var(--oyd-control-focus-ring)!important;}',
  '.oyd-page .oyd-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
  '.oyd-page .oyd-select-trigger-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  '.oyd-page .oyd-select-arrow{width:14px!important;height:14px!important;color:#667085;transition:transform .16s ease,color .16s ease;flex:0 0 14px;display:block;}',
  '.oyd-page .oyd-select-trigger[aria-expanded="true"] .oyd-select-arrow{transform:rotate(180deg);color:var(--oyd-control-focus);}',
  '.oyd-page .oyd-select-option{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
  '.oyd-page .oyd-select-check{width:14px!important;height:14px!important;color:var(--oyd-control-focus);flex:0 0 14px;display:block;}',
].join('');

function parseGeneratedList(raw, tokenValue, fallback) {
  if (!raw || raw === tokenValue) {
    return fallback;
  }

  try {
    var parsed = JSON.parse(raw);
    if (parsed && parsed.length) {
      return parsed;
    }
  } catch (err) {
    if (err && err.message) {
      return fallback;
    }
  }

  return fallback;
}

function parseGeneratedObject(raw, tokenValue, fallback) {
  if (!raw || raw === tokenValue) {
    return fallback;
  }

  try {
    var parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (err) {
    if (err && err.message) {
      return fallback;
    }
  }

  return fallback;
}

FEATURES = parseGeneratedList(FEATURES_JSON, TOKENS.featuresJson, FEATURES);
METRICS = parseGeneratedList(METRICS_JSON, TOKENS.metricsJson, METRICS);
ROADMAP = parseGeneratedList(ROADMAP_JSON, TOKENS.roadmapJson, ROADMAP);

var VISUAL_PROFILE = parseGeneratedObject(VISUAL_PROFILE_JSON, TOKENS.visualProfileJson, {
  name: 'dark-product-launch',
  scene: 'landing',
  tone: 'premium-saas-dark',
  density: 'business-compact',
  neutral: 'dark-violet',
  corner: 'layered',
  accent: 'electric-cyan',
  typography: 'editorial-hierarchy',
  motif: ['product-hero', 'glass-panel', 'metric-strip', 'timeline'],
});

var THEME_PROFILE = parseGeneratedObject(THEME_PROFILE_JSON, TOKENS.themeProfileJson, {
  name: 'dark-product-launch',
  themeColor: '#7C5CFF',
  themeColorDeep: '#241832',
  themeColorSoft: '#F4F1FF',
  themeColorTint: 'rgba(124, 92, 255, 0.22)',
  navTheme: 'light',
  mode: 'color_color',
  colorMode: 'gradient',
  mobileNavStyle: 'top',
});

if (!THEME_SCOPE || THEME_SCOPE === TOKENS.themeScope) {
  THEME_SCOPE = 'page';
}

function getThemeColor(profile, key, fallback) {
  return profile && profile[key] ? profile[key] : fallback;
}

function resolveScopedThemeVars(scope, profile) {
  if (scope !== 'page') {
    return {};
  }
  return {
    '--color-brand1-6': getThemeColor(profile, 'themeColor', '#6B7CAB'),
    '--color-brand1-2': getThemeColor(profile, 'themeColorSoft', '#F3F5FB'),
    '--color-brand1-3': getThemeColor(profile, 'themeColorTint', 'rgba(107, 124, 171, 0.2)'),
    '--color-brand1-9': getThemeColor(profile, 'themeColorDeep', '#435480'),
    '--color-brand-4': getThemeColor(profile, 'themeColorDeep', '#435480'),
    '--color-brand-3': getThemeColor(profile, 'themeColor', '#6B7CAB'),
  };
}

function applyShellTheme(scope, profile) {
  if (scope !== 'app') {
    return;
  }
  try {
    var updateShellConfig = window && window.__YIDA__ && window.__YIDA__.updateShellConfig;
    if (typeof updateShellConfig !== 'function') {
      return;
    }
    updateShellConfig({
      themeConfig: {
        theme: getThemeColor(profile, 'navTheme', 'light'),
        colorMode: getThemeColor(profile, 'colorMode', 'gradient'),
        mode: getThemeColor(profile, 'mode', 'color_color'),
        themeColor: getThemeColor(profile, 'themeColor', '#6B7CAB'),
        mobileNavStyle: getThemeColor(profile, 'mobileNavStyle', 'top'),
      },
    });
  } catch (err) {
    if (err && err.message) {
      return;
    }
  }
}

function resolveVisualPalette(profile) {
  var neutral = profile && profile.neutral ? profile.neutral : 'neutral-gray';
  var scene = profile && profile.scene ? profile.scene : 'workbench';
  var palette = {
    ink: '#162033',
    muted: '#667085',
    bg: '#F5F7FB',
    white: '#FFFFFF',
    line: '#D9E1EC',
    brand: '#E85D4A',
    brandSoft: '#FFF1ED',
    success: '#18A67E',
    accent: '#C77D35',
    ctaText: '#C9D3E3',
    shadow: 'rgba(22,32,51,0.12)',
  };

  if (neutral === 'warm-gray') {
    palette.ink = '#24211D';
    palette.muted = '#706B64';
    palette.bg = '#F7F5F1';
    palette.line = '#E4DDD2';
    palette.accent = '#B56F43';
    palette.ctaText = '#E1D7C7';
    palette.shadow = 'rgba(36,33,29,0.12)';
  }

  if (neutral === 'cool-gray') {
    palette.ink = '#101828';
    palette.muted = '#5D687A';
    palette.bg = '#F3F6FA';
    palette.line = '#D8E0EA';
    palette.accent = '#3E7C70';
    palette.ctaText = '#D5DEE9';
    palette.shadow = 'rgba(16,24,40,0.13)';
  }

  if (neutral === 'yida-blue-gray') {
    palette.ink = '#171a1d';
    palette.muted = '#747677';
    palette.bg = '#FFF1ED';
    palette.white = '#FFFFFF';
    palette.line = '#e5e6e8';
    palette.brand = '#E85D4A';
    palette.brandSoft = '#FFF1ED';
    palette.accent = '#B23A2F';
    palette.ctaText = 'rgba(255,255,255,0.74)';
    palette.shadow = 'rgba(43,44,51,0.08)';
  }

  if (neutral === 'dark-violet') {
    palette.ink = '#F7F3FF';
    palette.muted = 'rgba(247,243,255,0.68)';
    palette.bg = '#241832';
    palette.white = '#FFFFFF';
    palette.line = 'rgba(255,255,255,0.14)';
    palette.brand = '#7C5CFF';
    palette.brandSoft = 'rgba(124,92,255,0.16)';
    palette.accent = '#42D4FF';
    palette.ctaText = 'rgba(255,255,255,0.72)';
    palette.shadow = 'rgba(8,6,17,0.32)';
  }

  if (scene === 'dashboard') {
    palette.accent = '#D08A1E';
    palette.success = '#16846B';
  }

  return palette;
}

function resolveRadius(profile) {
  var corner = profile && profile.corner ? profile.corner : 'micro';
  if (corner === 'layered') {
    return { sm: 6, md: 8, shell: 12, pill: 999 };
  }
  if (corner === 'standard') {
    return { sm: 8, md: 10, pill: 999 };
  }
  if (corner === 'rounded') {
    return { sm: 12, md: 16, pill: 999 };
  }
  return { sm: 4, md: 6, pill: 999 };
}

var _customState = {
  activeFeature: 0,
};

export function getCustomState(key) {
  if (key) {
    return _customState[key];
  }
  return Object.assign({}, _customState);
}

export function setCustomState(newState) {
  Object.keys(newState).forEach((key) => {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

export function didMount() {
  applyShellTheme(THEME_SCOPE, THEME_PROFILE);
}

export function didUnmount() {}

export function selectFeature(index) {
  this.setCustomState({ activeFeature: index });
}

export function scrollToSection(id) {
  var el = document.getElementById(id);
  if (el && el.scrollIntoView) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export function renderJsx() {
  var self = this;
  var state = self.getCustomState();
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;
  var activeFeature = FEATURES[state.activeFeature] || FEATURES[0];
  var colors = resolveVisualPalette(VISUAL_PROFILE);
  var radius = resolveRadius(VISUAL_PROFILE);

  var styles = {
    page: Object.assign(resolveScopedThemeVars(THEME_SCOPE, THEME_PROFILE), {
      minHeight: '100vh',
      background: 'radial-gradient(circle at 18% 0%, rgba(124,92,255,0.34), transparent 34%), linear-gradient(180deg, #241832 0%, #342047 46%, #1F172C 100%)',
      color: colors.ink,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      letterSpacing: '0',
    }),
    hidden: { display: 'none' },
    nav: {
      borderBottom: '1px solid rgba(255,255,255,0.10)',
      backgroundColor: 'rgba(36,24,50,0.82)',
    },
    navInner: {
      maxWidth: 1120,
      margin: '0 auto',
      padding: isMobile ? '12px 16px' : '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    brand: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontWeight: 900,
      fontSize: 18,
    },
    mark: {
      width: 34,
      height: 34,
      borderRadius: 999,
      backgroundColor: '#7C5CFF',
      color: colors.white,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 900,
    },
    navButton: {
      border: '0',
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
      color: '#241832',
      padding: '10px 16px',
      fontWeight: 800,
      cursor: 'pointer',
    },
    hero: {
      maxWidth: 1120,
      margin: '0 auto',
      padding: isMobile ? '24px 16px 16px' : '42px 24px 24px',
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 390px',
      gap: isMobile ? 18 : 28,
      alignItems: 'center',
    },
    eyebrow: {
      display: 'inline-flex',
      border: '1px solid rgba(255,255,255,0.16)',
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.08)',
      padding: '7px 11px',
      color: '#42D4FF',
      fontSize: 13,
      fontWeight: 800,
    },
    h1: {
      margin: '18px 0 12px',
      fontSize: isMobile ? 30 : 48,
      lineHeight: isMobile ? '38px' : '56px',
      fontWeight: 900,
      letterSpacing: '0',
    },
    heroText: {
      margin: 0,
      maxWidth: 620,
      color: colors.muted,
      fontSize: isMobile ? 15 : 16,
      lineHeight: isMobile ? '24px' : '27px',
    },
    actions: {
      marginTop: 26,
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
    },
    primary: {
      border: '0',
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
      color: '#241832',
      padding: '13px 20px',
      fontSize: 15,
      fontWeight: 900,
      cursor: 'pointer',
    },
    secondary: {
      border: '1px solid ' + colors.line,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.08)',
      color: '#FFFFFF',
      padding: '12px 20px',
      fontSize: 15,
      fontWeight: 900,
      cursor: 'pointer',
    },
    visual: {
      border: '1px solid rgba(255,255,255,0.16)',
      borderRadius: 22,
      background: 'linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(124,92,255,0.24) 52%, rgba(66,212,255,0.20) 100%)',
      padding: 20,
      color: '#FFFFFF',
      boxShadow: '0 30px 80px rgba(8,6,17,0.34)',
      backdropFilter: 'blur(18px)',
    },
    visualTitle: {
      fontSize: 18,
      lineHeight: '25px',
      fontWeight: 900,
    },
    visualText: {
      marginTop: 8,
      color: 'rgba(255,255,255,0.74)',
      fontSize: 14,
      lineHeight: '24px',
    },
    bars: {
      display: 'grid',
      gap: 10,
      marginTop: 16,
    },
    bar: {
      height: 12,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.18)',
      overflow: 'hidden',
    },
    fillBlue: { height: '100%', width: '82%', backgroundColor: '#42D4FF', display: 'block' },
    fillGreen: { height: '100%', width: '66%', backgroundColor: '#7C5CFF', display: 'block' },
    fillCoral: { height: '100%', width: '48%', backgroundColor: '#FF8AB3', display: 'block' },
    metrics: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 10,
      marginTop: 16,
    },
    metric: {
      borderTop: '1px solid rgba(255,255,255,0.22)',
      paddingTop: 10,
    },
    metricValue: {
      fontSize: 24,
      lineHeight: '30px',
      fontWeight: 800,
    },
    metricLabel: {
      color: 'rgba(255,255,255,0.64)',
      fontSize: 13,
      lineHeight: '20px',
    },
    section: {
      maxWidth: 1120,
      margin: '0 auto',
      padding: isMobile ? '18px 16px' : '20px 24px',
    },
    h2: {
      margin: 0,
      fontSize: isMobile ? 20 : 18,
      lineHeight: isMobile ? '28px' : '26px',
      fontWeight: 800,
    },
    grid: {
      marginTop: 18,
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gap: 14,
    },
    card: {
      border: '1px solid ' + colors.line,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.08)',
      padding: 16,
      minHeight: 124,
      boxShadow: '0 16px 36px rgba(8,6,17,0.18)',
      color: colors.ink,
    },
    activeCard: {
      border: '1px solid rgba(66,212,255,0.72)',
      borderRadius: 16,
      backgroundColor: 'rgba(66,212,255,0.14)',
      color: colors.white,
      padding: 16,
      minHeight: 124,
    },
    cardTitle: {
      fontSize: 16,
      lineHeight: '24px',
      fontWeight: 800,
    },
    cardText: {
      marginTop: 10,
      color: 'inherit',
      opacity: 0.74,
      fontSize: 14,
      lineHeight: '24px',
    },
    roadmapStage: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: 900,
    },
    cta: {
      marginTop: 22,
      borderRadius: 20,
      background: 'linear-gradient(135deg, rgba(124,92,255,0.76) 0%, rgba(66,212,255,0.32) 100%)',
      color: colors.white,
      padding: isMobile ? 18 : 20,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'flex-start' : 'center',
      flexDirection: isMobile ? 'column' : 'row',
      gap: 18,
    },
    ctaTitle: {
      margin: 0,
      fontSize: isMobile ? 20 : 18,
      lineHeight: isMobile ? '28px' : '26px',
      fontWeight: 800,
    },
    ctaText: {
      margin: '8px 0 0',
      color: colors.ctaText,
      fontSize: 15,
      lineHeight: '25px',
      maxWidth: 620,
    },
  };

  return (
    <div className="oyd-page" style={styles.page}>
      <style>{NATIVE_CONTROL_RESET_CSS}</style>
      <div style={styles.hidden}>{self.state.timestamp}</div>

      <div style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.brand}>
            <div style={styles.mark}>{PAGE.brandInitials}</div>
            <span>{PAGE.brandName}</span>
          </div>
          <button style={styles.navButton} onClick={(e) => { self.scrollToSection('start'); }}>
            {PAGE.primaryCta}
          </button>
        </div>
      </div>

      <div style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>{PAGE.tagline}</div>
          <h1 style={styles.h1}>{PAGE.brandName}</h1>
          <p style={styles.heroText}>{PAGE.heroText}</p>
          <div style={styles.actions}>
            <button style={styles.primary} onClick={(e) => { self.scrollToSection('start'); }}>
              {PAGE.primaryCta}
            </button>
            <button style={styles.secondary} onClick={(e) => { self.scrollToSection('features'); }}>
              {PAGE.secondaryCta}
            </button>
          </div>
        </div>

        <div style={styles.visual}>
          <div style={styles.visualTitle}>{activeFeature.title}</div>
          <div style={styles.visualText}>{activeFeature.text}</div>
          <div style={styles.bars}>
            <div style={styles.bar}><span style={styles.fillBlue}></span></div>
            <div style={styles.bar}><span style={styles.fillGreen}></span></div>
            <div style={styles.bar}><span style={styles.fillCoral}></span></div>
          </div>
          <div style={styles.metrics}>
            {METRICS.map((item) => (
              <div key={item.label} style={styles.metric}>
                <div style={styles.metricValue}>{item.value}</div>
                <div style={styles.metricLabel}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr',
          gap: 14,
          alignItems: 'stretch',
        }}>
          <div style={styles.visual}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={styles.eyebrow}>Product cockpit</div>
                <h2 style={{ margin: '16px 0 8px', fontSize: isMobile ? 24 : 30, lineHeight: isMobile ? '32px' : '38px', color: '#FFFFFF' }}>把产品能力直接展示成可理解的控制台</h2>
                <p style={styles.visualText}>参考暗色 SaaS 首页的产品截图区：不是抽象口号，而是让用户第一眼看到模块、数据、流程和下一步动作。</p>
              </div>
              <button style={styles.navButton} onClick={(e) => { self.selectFeature(1); }}>切换预览</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginTop: 18 }}>
              {['AI 工作流', '自动化规则', '增长看板'].map((item, index) => (
                <button key={item} style={{ minHeight: 92, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 16, background: index === state.activeFeature ? 'rgba(66,212,255,0.18)' : 'rgba(255,255,255,0.08)', color: '#FFFFFF', textAlign: 'left', padding: 14, cursor: 'pointer' }} onClick={(e) => { self.selectFeature(index % FEATURES.length); }}>
                  <strong>{item}</strong>
                  <span style={{ display: 'block', marginTop: 12, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: [82, 64, 48][index] + '%', height: '100%', background: index === 0 ? '#42D4FF' : index === 1 ? '#7C5CFF' : '#FF8AB3' }}></span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div style={styles.card}>
            <div style={styles.roadmapStage}>可信证明</div>
            <div style={styles.cardTitle}>上线后 36 小时进入运营节奏</div>
            <div style={styles.cardText}>用页面级数据、表单入口和自动化记录，让首页不只是展示，而是持续承接业务动作。</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
              {METRICS.map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 10 }}>
                  <span style={{ color: colors.muted }}>{item.label}</span>
                  <strong style={{ color: '#FFFFFF' }}>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div id="features" style={styles.section}>
        <h2 style={styles.h2}>{PAGE.featuresTitle}</h2>
        <div style={styles.grid}>
          {FEATURES.map((item, index) => (
            <button
              key={item.title}
              style={state.activeFeature === index ? styles.activeCard : styles.card}
              onClick={(e) => { self.selectFeature(index); }}
            >
              <div style={styles.cardTitle}>{item.title}</div>
              <div style={styles.cardText}>{item.text}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>{PAGE.roadmapTitle}</h2>
        <div style={styles.grid}>
          {ROADMAP.map((item) => (
            <div key={item.stage} style={styles.card}>
              <div style={styles.roadmapStage}>{item.stage}</div>
              <div style={styles.cardTitle}>{item.title}</div>
              <div style={styles.cardText}>{item.text}</div>
            </div>
          ))}
        </div>

        <div id="start" style={styles.cta}>
          <div>
            <h2 style={styles.ctaTitle}>{PAGE.ctaTitle}</h2>
            <p style={styles.ctaText}>{PAGE.ctaText}</p>
          </div>
          <button style={styles.navButton} onClick={(e) => { self.scrollToSection('features'); }}>
            {PAGE.secondaryCta}
          </button>
        </div>
      </div>
    </div>
  );
}
