'use strict';

const IR_VERSION = '1.0';

const PRODUCT_HOMEPAGE_TEMPLATE = 'product-homepage';

const DEFAULT_PRODUCT_HOMEPAGE = {
  meta: {
    brandName: 'ProductName',
    brandInitials: 'PN',
    tagline: '把产品价值讲清楚，把行动入口放到用户面前',
    heroText: '这是一个适合 SaaS、开源项目、活动和内部工具的宜搭自定义首页模板。',
    primaryCta: '开始使用',
    secondaryCta: '查看能力',
  },
  sections: {
    featuresTitle: '核心能力',
    roadmapTitle: '迭代路线',
    ctaTitle: '先发布首页，再接入真实流程。',
    ctaText: '把这个模板作为第一版，后续再连接宜搭表单、数据报表和自动化。',
  },
  features: [
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
  ],
  metrics: [
    { value: '1', label: '统一入口' },
    { value: '3', label: '核心区块' },
    { value: '0', label: '外部依赖' },
  ],
  roadmap: [
    { stage: '01', title: '发布首页', text: '先完成品牌、价值和行动入口。' },
    { stage: '02', title: '接入表单', text: '收集申请、反馈、线索和需求。' },
    { stage: '03', title: '运营看板', text: '把数据沉淀到报表和自动化流程。' },
  ],
};

const FIELD_ALIASES = {
  brandName: 'brandName',
  brandInitials: 'brandInitials',
  tagline: 'tagline',
  heroText: 'heroText',
  primaryCta: 'primaryCta',
  secondaryCta: 'secondaryCta',
  featuresTitle: 'featuresTitle',
  roadmapTitle: 'roadmapTitle',
  ctaTitle: 'ctaTitle',
  ctaText: 'ctaText',
  features: 'features',
  metrics: 'metrics',
  roadmap: 'roadmap',
  'brand-name': 'brandName',
  'brand-initials': 'brandInitials',
  'hero-text': 'heroText',
  'primary-cta': 'primaryCta',
  'secondary-cta': 'secondaryCta',
  'features-title': 'featuresTitle',
  'roadmap-title': 'roadmapTitle',
  'cta-title': 'ctaTitle',
  'cta-text': 'ctaText',
  BRAND_NAME: 'brandName',
  BRAND_INITIALS: 'brandInitials',
  TAGLINE: 'tagline',
  HERO_TEXT: 'heroText',
  PRIMARY_CTA: 'primaryCta',
  SECONDARY_CTA: 'secondaryCta',
  FEATURES_TITLE: 'featuresTitle',
  ROADMAP_TITLE: 'roadmapTitle',
  CTA_TITLE: 'ctaTitle',
  CTA_TEXT: 'ctaText',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function valueOrDefault(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
}

function applyVariableOverrides(spec, variables) {
  if (!isPlainObject(variables)) {
    return;
  }

  Object.entries(variables).forEach(([key, value]) => {
    const fieldName = FIELD_ALIASES[key] || key;
    spec[fieldName] = value;
  });
}

function getBlock(spec, type) {
  if (!Array.isArray(spec.blocks)) {
    return null;
  }
  return spec.blocks.find((block) => block && block.type === type) || null;
}

function toList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeFeatureItems(items, fallback) {
  const normalized = toList(items)
    .filter(isPlainObject)
    .map((item, index) => ({
      title: valueOrDefault(item.title || item.name, `能力 ${index + 1}`),
      text: valueOrDefault(item.text || item.description || item.summary, ''),
    }))
    .filter((item) => item.title || item.text);

  return normalized.length ? normalized : clone(fallback);
}

function normalizeMetricItems(items, fallback) {
  const normalized = toList(items)
    .filter(isPlainObject)
    .map((item, index) => ({
      value: valueOrDefault(item.value || item.metric || item.count, '-'),
      label: valueOrDefault(item.label || item.title || item.name, `指标 ${index + 1}`),
    }))
    .filter((item) => item.value || item.label);

  return normalized.length ? normalized : clone(fallback);
}

function padStage(index) {
  return String(index + 1).padStart(2, '0');
}

function normalizeRoadmapItems(items, fallback) {
  const normalized = toList(items)
    .filter(isPlainObject)
    .map((item, index) => ({
      stage: valueOrDefault(item.stage || item.step || item.phase, padStage(index)),
      title: valueOrDefault(item.title || item.name, `阶段 ${index + 1}`),
      text: valueOrDefault(item.text || item.description || item.summary, ''),
    }))
    .filter((item) => item.stage || item.title || item.text);

  return normalized.length ? normalized : clone(fallback);
}

function normalizeProductHomepageSpec(rawSpec, options) {
  const spec = isPlainObject(rawSpec) ? clone(rawSpec) : {};

  if (isPlainObject(spec.variables)) {
    applyVariableOverrides(spec, spec.variables);
  }
  applyVariableOverrides(spec, options && options.variables);

  const heroBlock = getBlock(spec, 'hero') || {};
  const featureBlock = getBlock(spec, 'feature-grid') || {};
  const metricBlock = getBlock(spec, 'metric-strip') || {};
  const roadmapBlock = getBlock(spec, 'roadmap') || {};
  const ctaBlock = getBlock(spec, 'cta') || {};

  const defaults = DEFAULT_PRODUCT_HOMEPAGE;
  const meta = {
    brandName: valueOrDefault(spec.brandName || heroBlock.brandName, defaults.meta.brandName),
    brandInitials: valueOrDefault(spec.brandInitials || heroBlock.brandInitials, defaults.meta.brandInitials),
    tagline: valueOrDefault(spec.tagline || heroBlock.tagline, defaults.meta.tagline),
    heroText: valueOrDefault(spec.heroText || heroBlock.text || heroBlock.heroText, defaults.meta.heroText),
    primaryCta: valueOrDefault(spec.primaryCta || heroBlock.primaryCta, defaults.meta.primaryCta),
    secondaryCta: valueOrDefault(spec.secondaryCta || heroBlock.secondaryCta, defaults.meta.secondaryCta),
  };

  const features = normalizeFeatureItems(
    featureBlock.items || spec.features,
    defaults.features
  );
  const metrics = normalizeMetricItems(
    metricBlock.items || spec.metrics,
    defaults.metrics
  );
  const roadmap = normalizeRoadmapItems(
    roadmapBlock.items || spec.roadmap,
    defaults.roadmap
  );

  return {
    irVersion: IR_VERSION,
    template: PRODUCT_HOMEPAGE_TEMPLATE,
    pageType: PRODUCT_HOMEPAGE_TEMPLATE,
    density: valueOrDefault(spec.density, 'comfortable'),
    meta,
    blocks: [
      {
        type: 'hero',
        brandName: meta.brandName,
        brandInitials: meta.brandInitials,
        tagline: meta.tagline,
        text: meta.heroText,
        primaryCta: meta.primaryCta,
        secondaryCta: meta.secondaryCta,
      },
      {
        type: 'feature-grid',
        title: valueOrDefault(spec.featuresTitle || featureBlock.title, defaults.sections.featuresTitle),
        items: features,
      },
      {
        type: 'metric-strip',
        items: metrics,
      },
      {
        type: 'roadmap',
        title: valueOrDefault(spec.roadmapTitle || roadmapBlock.title, defaults.sections.roadmapTitle),
        items: roadmap,
      },
      {
        type: 'cta',
        title: valueOrDefault(spec.ctaTitle || ctaBlock.title, defaults.sections.ctaTitle),
        text: valueOrDefault(spec.ctaText || ctaBlock.text, defaults.sections.ctaText),
      },
    ],
  };
}

function normalizePageSpec(spec, options) {
  const templateName = (options && options.template) || (spec && spec.template) || PRODUCT_HOMEPAGE_TEMPLATE;

  if (templateName !== PRODUCT_HOMEPAGE_TEMPLATE) {
    throw new Error(`Unsupported page template: ${templateName}`);
  }

  return normalizeProductHomepageSpec(spec, options || {});
}

function getBlockByType(ir, type) {
  return ir.blocks.find((block) => block.type === type) || {};
}

function escapeJsStringValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '\\n');
}

function encodeJsonForTemplate(value) {
  return escapeJsStringValue(JSON.stringify(value));
}

function buildTemplateVariablesFromIr(ir) {
  const hero = getBlockByType(ir, 'hero');
  const features = getBlockByType(ir, 'feature-grid');
  const metrics = getBlockByType(ir, 'metric-strip');
  const roadmap = getBlockByType(ir, 'roadmap');
  const cta = getBlockByType(ir, 'cta');

  return {
    OPENYIDA_TEMPLATE: escapeJsStringValue(ir.template),
    OPENYIDA_IR_VERSION: escapeJsStringValue(ir.irVersion),
    OPENYIDA_BLOCKS: escapeJsStringValue(ir.blocks.map((block) => block.type).join(',')),
    BRAND_NAME: escapeJsStringValue(hero.brandName),
    BRAND_INITIALS: escapeJsStringValue(hero.brandInitials),
    TAGLINE: escapeJsStringValue(hero.tagline),
    HERO_TEXT: escapeJsStringValue(hero.text),
    PRIMARY_CTA: escapeJsStringValue(hero.primaryCta),
    SECONDARY_CTA: escapeJsStringValue(hero.secondaryCta),
    FEATURES_TITLE: escapeJsStringValue(features.title),
    ROADMAP_TITLE: escapeJsStringValue(roadmap.title),
    CTA_TITLE: escapeJsStringValue(cta.title),
    CTA_TEXT: escapeJsStringValue(cta.text),
    FEATURES_JSON: encodeJsonForTemplate(features.items || []),
    METRICS_JSON: encodeJsonForTemplate(metrics.items || []),
    ROADMAP_JSON: encodeJsonForTemplate(roadmap.items || []),
  };
}

module.exports = {
  IR_VERSION,
  PRODUCT_HOMEPAGE_TEMPLATE,
  DEFAULT_PRODUCT_HOMEPAGE,
  normalizePageSpec,
  buildTemplateVariablesFromIr,
  escapeJsStringValue,
};
