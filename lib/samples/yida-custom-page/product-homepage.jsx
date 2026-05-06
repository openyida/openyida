/**
 * 产品首页轻量模板
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
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
};

if (PAGE.brandName === TOKENS.brandName) {
  PAGE.brandName = 'ProductName';
}
if (PAGE.brandInitials === TOKENS.brandInitials) {
  PAGE.brandInitials = 'PN';
}
if (PAGE.tagline === TOKENS.tagline) {
  PAGE.tagline = '把产品价值讲清楚，把行动入口放到用户面前';
}
if (PAGE.heroText === TOKENS.heroText) {
  PAGE.heroText = '这是一个适合 SaaS、开源项目、活动和内部工具的宜搭自定义首页模板。';
}
if (PAGE.primaryCta === TOKENS.primaryCta) {
  PAGE.primaryCta = '开始使用';
}
if (PAGE.secondaryCta === TOKENS.secondaryCta) {
  PAGE.secondaryCta = '查看能力';
}
if (PAGE.featuresTitle === TOKENS.featuresTitle) {
  PAGE.featuresTitle = '核心能力';
}
if (PAGE.roadmapTitle === TOKENS.roadmapTitle) {
  PAGE.roadmapTitle = '迭代路线';
}
if (PAGE.ctaTitle === TOKENS.ctaTitle) {
  PAGE.ctaTitle = '先发布首页，再接入真实流程。';
}
if (PAGE.ctaText === TOKENS.ctaText) {
  PAGE.ctaText = '把这个模板作为第一版，后续再连接宜搭表单、数据报表和自动化。';
}

var FEATURES = [
  {
    title: '清晰定位',
    text: '第一屏说明产品是谁、解决什么问题、为什么值得继续看。',
  },
  {
    title: '模块化内容',
    text: '特性、流程、指标和路线图都用独立区块组织，便于增删。',
  },
  {
    title: '宜搭可扩展',
    text: '后续可以接入表单、报表、权限和自动化流程，形成运营闭环。',
  },
];

var METRICS = [
  { value: '1', label: '统一入口' },
  { value: '3', label: '核心区块' },
  { value: '0', label: '外部依赖' },
];

var ROADMAP = [
  { stage: '01', title: '发布首页', text: '先完成品牌、价值和行动入口。' },
  { stage: '02', title: '接入表单', text: '收集申请、反馈、线索和需求。' },
  { stage: '03', title: '运营看板', text: '把数据沉淀到报表和自动化流程。' },
];

var FEATURES_JSON = '{{FEATURES_JSON}}';
var METRICS_JSON = '{{METRICS_JSON}}';
var ROADMAP_JSON = '{{ROADMAP_JSON}}';

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

FEATURES = parseGeneratedList(FEATURES_JSON, TOKENS.featuresJson, FEATURES);
METRICS = parseGeneratedList(METRICS_JSON, TOKENS.metricsJson, METRICS);
ROADMAP = parseGeneratedList(ROADMAP_JSON, TOKENS.roadmapJson, ROADMAP);

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

export function didMount() {}

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
  var state = this.getCustomState();
  var isMobile = this.utils && this.utils.isMobile ? this.utils.isMobile() : false;
  var activeFeature = FEATURES[state.activeFeature] || FEATURES[0];

  var colors = {
    ink: '#162033',
    muted: '#667085',
    bg: '#F5F7FB',
    white: '#FFFFFF',
    line: '#D9E1EC',
    blue: '#2F6BFF',
    green: '#18A67E',
    coral: '#EE6B57',
  };

  var styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: colors.bg,
      color: colors.ink,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      letterSpacing: '0',
    },
    hidden: { display: 'none' },
    nav: {
      borderBottom: '1px solid ' + colors.line,
      backgroundColor: colors.white,
    },
    navInner: {
      maxWidth: 1120,
      margin: '0 auto',
      padding: isMobile ? '12px 16px' : '14px 24px',
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
      borderRadius: 8,
      backgroundColor: colors.ink,
      color: colors.white,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 900,
    },
    navButton: {
      border: '0',
      borderRadius: 8,
      backgroundColor: colors.blue,
      color: colors.white,
      padding: '10px 14px',
      fontWeight: 800,
      cursor: 'pointer',
    },
    hero: {
      maxWidth: 1120,
      margin: '0 auto',
      padding: isMobile ? '48px 16px' : '76px 24px',
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr',
      gap: isMobile ? 26 : 44,
      alignItems: 'center',
    },
    eyebrow: {
      display: 'inline-flex',
      border: '1px solid ' + colors.line,
      borderRadius: 999,
      backgroundColor: colors.white,
      padding: '7px 11px',
      color: colors.muted,
      fontSize: 13,
      fontWeight: 800,
    },
    h1: {
      margin: '18px 0 14px',
      fontSize: isMobile ? 42 : 68,
      lineHeight: isMobile ? '50px' : '76px',
      fontWeight: 900,
      letterSpacing: '0',
    },
    heroText: {
      margin: 0,
      maxWidth: 620,
      color: colors.muted,
      fontSize: isMobile ? 17 : 20,
      lineHeight: isMobile ? '28px' : '32px',
    },
    actions: {
      marginTop: 26,
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
    },
    primary: {
      border: '0',
      borderRadius: 8,
      backgroundColor: colors.blue,
      color: colors.white,
      padding: '13px 18px',
      fontSize: 15,
      fontWeight: 900,
      cursor: 'pointer',
    },
    secondary: {
      border: '1px solid ' + colors.line,
      borderRadius: 8,
      backgroundColor: colors.white,
      color: colors.ink,
      padding: '12px 17px',
      fontSize: 15,
      fontWeight: 900,
      cursor: 'pointer',
    },
    visual: {
      border: '1px solid ' + colors.line,
      borderRadius: 8,
      backgroundColor: colors.white,
      padding: 22,
      boxShadow: '0 20px 45px rgba(22,32,51,0.12)',
    },
    visualTitle: {
      fontSize: 18,
      lineHeight: '25px',
      fontWeight: 900,
    },
    visualText: {
      marginTop: 8,
      color: colors.muted,
      fontSize: 14,
      lineHeight: '24px',
    },
    bars: {
      display: 'grid',
      gap: 10,
      marginTop: 24,
    },
    bar: {
      height: 12,
      borderRadius: 999,
      backgroundColor: colors.line,
      overflow: 'hidden',
    },
    fillBlue: { height: '100%', width: '82%', backgroundColor: colors.blue, display: 'block' },
    fillGreen: { height: '100%', width: '66%', backgroundColor: colors.green, display: 'block' },
    fillCoral: { height: '100%', width: '48%', backgroundColor: colors.coral, display: 'block' },
    metrics: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 10,
      marginTop: 22,
    },
    metric: {
      borderTop: '1px solid ' + colors.line,
      paddingTop: 12,
    },
    metricValue: {
      fontSize: 28,
      lineHeight: '34px',
      fontWeight: 900,
    },
    metricLabel: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: '20px',
    },
    section: {
      maxWidth: 1120,
      margin: '0 auto',
      padding: isMobile ? '42px 16px' : '58px 24px',
    },
    h2: {
      margin: 0,
      fontSize: isMobile ? 30 : 42,
      lineHeight: isMobile ? '38px' : '50px',
      fontWeight: 900,
    },
    grid: {
      marginTop: 22,
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gap: 14,
    },
    card: {
      border: '1px solid ' + colors.line,
      borderRadius: 8,
      backgroundColor: colors.white,
      padding: 20,
      minHeight: 160,
    },
    activeCard: {
      border: '1px solid ' + colors.ink,
      borderRadius: 8,
      backgroundColor: colors.ink,
      color: colors.white,
      padding: 20,
      minHeight: 160,
    },
    cardTitle: {
      fontSize: 20,
      lineHeight: '27px',
      fontWeight: 900,
    },
    cardText: {
      marginTop: 10,
      color: 'inherit',
      opacity: 0.74,
      fontSize: 14,
      lineHeight: '24px',
    },
    roadmapStage: {
      color: colors.green,
      fontSize: 13,
      fontWeight: 900,
    },
    cta: {
      marginTop: 22,
      borderRadius: 8,
      backgroundColor: colors.ink,
      color: colors.white,
      padding: isMobile ? 24 : 34,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'flex-start' : 'center',
      flexDirection: isMobile ? 'column' : 'row',
      gap: 18,
    },
    ctaTitle: {
      margin: 0,
      fontSize: isMobile ? 26 : 34,
      lineHeight: isMobile ? '34px' : '42px',
      fontWeight: 900,
    },
    ctaText: {
      margin: '8px 0 0',
      color: '#C9D3E3',
      fontSize: 15,
      lineHeight: '25px',
      maxWidth: 620,
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.hidden}>{this.state.timestamp}</div>

      <div style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.brand}>
            <div style={styles.mark}>{PAGE.brandInitials}</div>
            <span>{PAGE.brandName}</span>
          </div>
          <button style={styles.navButton} onClick={(e) => { this.scrollToSection('start'); }}>
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
            <button style={styles.primary} onClick={(e) => { this.scrollToSection('start'); }}>
              {PAGE.primaryCta}
            </button>
            <button style={styles.secondary} onClick={(e) => { this.scrollToSection('features'); }}>
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

      <div id="features" style={styles.section}>
        <h2 style={styles.h2}>{PAGE.featuresTitle}</h2>
        <div style={styles.grid}>
          {FEATURES.map((item, index) => (
            <button
              key={item.title}
              style={state.activeFeature === index ? styles.activeCard : styles.card}
              onClick={(e) => { this.selectFeature(index); }}
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
          <button style={styles.navButton} onClick={(e) => { this.scrollToSection('features'); }}>
            {PAGE.secondaryCta}
          </button>
        </div>
      </div>
    </div>
  );
}
