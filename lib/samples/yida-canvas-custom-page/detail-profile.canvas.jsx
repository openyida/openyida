/**
 * Yida detail profile Code Canvas template
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 */

import React from 'react';
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
  brandName: '华东旗舰客户档案',
  brandInitials: 'HX',
  tagline: '客户画像 · 商机价值 · 协作时间线',
  heroText: '面向客户成功和销售主管的单客户详情页，把联系人、合同价值、风险状态、协作记录和下一步动作压缩成一张可决策的档案。',
  primaryCta: '更新状态',
  secondaryCta: '打开合同',
  featuresTitle: '客户关系画像',
  roadmapTitle: '最近协作时间线',
  ctaTitle: '下一步动作',
  ctaText: '该客户近期采购节奏加快，建议本周完成年度框架协议确认。',
});

const DEFAULT_FEATURES = [
  { title: '关键联系人', text: '采购负责人李青，本周已确认追加门店补货计划，偏好午后沟通。', meta: '采购中心 / 华东大区' },
  { title: '年度框架', text: '预计覆盖 42 家门店，框架金额 ¥286.4 万，法务已完成第一轮审阅。', meta: '合同阶段 78%' },
  { title: '履约健康度', text: '过去 30 天准时交付率 96%，仅苏州仓补货存在 1 次延迟。', meta: '风险低' },
  { title: '增长机会', text: '咖啡机耗材和冷链新品可捆绑报价，预计新增 ¥38.6 万商机。', meta: 'Q3 expansion' },
  { title: '协作偏好', text: '客户更关注交付确定性和发票流转效率，方案页需突出里程碑。', meta: '高频诉求' },
];
const DEFAULT_METRICS = [
  { label: '年度价值', value: '¥286.4万', hint: '+38.6万 潜在扩展' },
  { label: '关系热度', value: '92', hint: '连续 6 周活跃' },
  { label: '合同进度', value: '78%', hint: '法务二审中' },
  { label: '履约健康', value: '96%', hint: '准时交付率' },
];
const DEFAULT_ROADMAP = [
  { stage: 'Jul 15', title: '补货计划确认', text: '华东门店计划追加 18 个 SKU，需锁定苏州仓库存。' },
  { stage: 'Jul 12', title: '框架协议一审', text: '客户法务反馈付款周期条款，销售运营已同步修订稿。' },
  { stage: 'Jul 08', title: '联合复盘会议', text: '确认上月准时交付率 96%，客户认可发票流转优化。' },
  { stage: 'Jul 02', title: '新品试点上线', text: '冷链新品进入 6 家门店试点，预计 2 周后复盘销量。' },
  { stage: 'Jun 28', title: '年度预算冻结', text: '客户完成年度预算审批，等待最终采购章确认。' },
];
const DEFAULT_VISUAL_PROFILE = { name: 'detail-profile' };
const DEFAULT_THEME_PROFILE = { followRuntimeTheme: false, name: 'copper-client-profile', themeColor: '#EA580C', themeColorDeep: '#9A3412', themeColorSoft: '#FFF3E8', themeColorTint: 'rgba(234, 88, 12, 0.18)', palette: ['#EA580C', '#0F9F8E', '#B45309', '#2563EB', '#DB2777'] };
const DEFAULT_APP_BLUEPRINT = { shell: 'detail' };
const DEFAULT_INTERACTION_PROFILE = { primaryAction: '更新状态' };
const DEFAULT_INSIGHTS = [{
  conclusion: '本周优先拿下年度框架协议',
  evidence: '合同进度 78%，客户预算已冻结，风险集中在付款周期和苏州仓库存。',
  suggestion: '安排法务二审和仓配锁库，周五前回传最终确认稿。',
}];
const BACKGROUND_IMAGES = {
  portrait: 'https://images.unsplash.com/photo-1739298061757-7a3339cee982?auto=format&fit=crop&w=1200&q=80',
  workspace: 'https://images.unsplash.com/photo-1758691737083-0e7fdbde0f05?auto=format&fit=crop&w=1400&q=80',
};
const DEFAULT_CONTACTS = [
  { name: '李青', role: '采购负责人', signal: '决策影响高', note: '关注交付确定性' },
  { name: '周明', role: '财务共享', signal: '付款条款', note: '本周确认账期' },
  { name: '陈一', role: '门店运营', signal: '试点反馈', note: '冷链新品复盘' },
];

const FEATURES = parseTemplateJson('{{FEATURES_JSON}}', DEFAULT_FEATURES);
const METRICS = parseTemplateJson('{{METRICS_JSON}}', DEFAULT_METRICS);
const ROADMAP = parseTemplateJson('{{ROADMAP_JSON}}', DEFAULT_ROADMAP);
const VISUAL_PROFILE = parseTemplateJson('{{OPENYIDA_VISUAL_PROFILE_JSON}}', DEFAULT_VISUAL_PROFILE);
const THEME_PROFILE = parseTemplateJson('{{OPENYIDA_THEME_PROFILE_JSON}}', DEFAULT_THEME_PROFILE);
const THEME_SCOPE = withFallback('{{OPENYIDA_THEME_SCOPE}}', 'page');
const APP_BLUEPRINT = parseTemplateJson('{{OPENYIDA_APP_BLUEPRINT_JSON}}', DEFAULT_APP_BLUEPRINT);
const INTERACTION_PROFILE = parseTemplateJson('{{OPENYIDA_INTERACTION_PROFILE_JSON}}', DEFAULT_INTERACTION_PROFILE);
const INSIGHTS = parseTemplateJson('{{OPENYIDA_INSIGHTS_JSON}}', DEFAULT_INSIGHTS);
const ARCHETYPE = withFallback('{{OPENYIDA_ARCHETYPE}}', 'profile');
const RESEARCH_LEVEL = withFallback('{{OPENYIDA_RESEARCH_LEVEL}}', 'sample');

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
    '--oy-portrait-image': `url("${BACKGROUND_IMAGES.portrait}")`,
    '--oy-workspace-image': `url("${BACKGROUND_IMAGES.workspace}")`,
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

function ObjectHero({ page, primaryAction, shellLabel }) {
  return (
    <div className="oy-detail-card oy-detail-main oy-object-hero">
      <div className="oy-hero-copy">
        <Tag color="warning">{shellLabel} + {ARCHETYPE || 'profile'}</Tag>
        <div className="oy-detail-title">{page.brandName}</div>
        <Paragraph>{page.heroText}</Paragraph>
        <div className="oy-detail-actions">
          <Button type="primary">{primaryAction}</Button>
          <Button>{page.secondaryCta}</Button>
        </div>
      </div>
      <div className="oy-profile-photo" aria-label="customer profile visual">
        <span>{page.brandInitials}</span>
      </div>
    </div>
  );
}

function MetaStack({ metrics, page }) {
  return (
    <aside className="oy-detail-card oy-detail-meta oy-meta-stack">
      <Title level={4} style={{ marginTop: 0 }}>{page.ctaTitle}</Title>
      {metrics.slice(0, 4).map((item) => (
        <div className="oy-detail-metric" key={item.label}>
          <div>
            <Text type="secondary">{item.label}</Text>
            {item.hint ? <small>{item.hint}</small> : null}
          </div>
          <Text strong>{item.value}</Text>
        </div>
      ))}
      <Paragraph style={{ marginTop: 18 }}>{page.tagline}</Paragraph>
      <div className="oy-next-action">
        <Text strong>本周动作</Text>
        <Paragraph>法务二审、苏州仓锁库、回传框架协议最终稿。</Paragraph>
        <Button type="primary" block>{page.primaryCta}</Button>
      </div>
    </aside>
  );
}

function TimelinePrimitive({ items, title }) {
  return (
    <div className="oy-detail-timeline oy-timeline-primitive">
      <Title level={3}>{title}</Title>
      {items.slice(0, 4).map((item) => (
        <div className="oy-detail-event" key={item.stage}>
          <div className="oy-detail-stage">{item.stage}</div>
          <div>
            <Text strong>{item.title}</Text>
            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>{item.text}</Paragraph>
          </div>
        </div>
      ))}
    </div>
  );
}

function RelationshipPanel({ contacts }) {
  return (
    <section className="oy-detail-card oy-relationship-panel">
      <div className="oy-panel-head">
        <Title level={3}>关键关系网</Title>
        <Tag color="success">3 位高频联系人</Tag>
      </div>
      <div className="oy-contact-grid">
        {contacts.map((item, index) => (
          <div className="oy-contact-card" key={item.name}>
            <div className="oy-contact-avatar">{item.name.slice(0, 1)}</div>
            <div>
              <Text strong>{item.name}</Text>
              <span>{item.role}</span>
              <small>{item.signal} · {item.note}</small>
            </div>
            <b>{index === 0 ? 'A' : index === 1 ? 'B' : 'C'}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureNarrative({ features, title }) {
  return (
    <section className="oy-detail-card oy-detail-sections">
      <div className="oy-panel-head">
        <Title level={3}>{title}</Title>
        <Text type="secondary">按客户决策顺序组织，不做字段墙</Text>
      </div>
      {features.slice(0, 5).map((item) => (
        <div className="oy-detail-section" key={item.title}>
          <div>
            <Title level={4}>{item.title}</Title>
            <Paragraph>{item.text}</Paragraph>
          </div>
          <Tag>{item.meta || '已确认'}</Tag>
        </div>
      ))}
    </section>
  );
}

function InsightCallout({ insight, page }) {
  const view = insight || {};
  return (
    <aside className="oy-detail-card oy-detail-summary oy-insight-callout">
      <Text type="secondary">{page.ctaTitle}</Text>
      <div className="oy-detail-number">{view.conclusion || (METRICS[0] && METRICS[0].value) || '-'}</div>
      <Paragraph>{view.evidence || page.ctaText}</Paragraph>
      <Text strong>{view.suggestion || page.ctaText}</Text>
      <Tag color="success">{RESEARCH_LEVEL || 'light'} research</Tag>
    </aside>
  );
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
  const primaryAction = INTERACTION_PROFILE.primaryAction || PAGE.primaryCta;
  const shellLabel = APP_BLUEPRINT.shell || 'single_page';
  const insight = INSIGHTS[0] || null;

  return (
    <ConfigProvider getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body} theme={{ token: { colorPrimary: brand, borderRadius: 8 } }}>
      <div
        className="oy-detail-profile"
        data-profile={VISUAL_PROFILE.name}
        data-theme-scope={THEME_SCOPE}
        style={{
          ...themeVars,
          '--oy-brand': brand,
          '--oy-brand-deep': brandDeep,
          '--oy-brand-soft': brandSoft,
          '--oy-accent-2': palette[1],
          '--oy-accent-3': palette[2],
          '--oy-portrait-image': `url("${BACKGROUND_IMAGES.portrait}")`,
          '--oy-workspace-image': `url("${BACKGROUND_IMAGES.workspace}")`,
        }}
      >
        <style>{`
          {{OPENYIDA_CANVAS_CONTROL_CSS}}
          .oy-detail-profile {
            min-height: 100vh;
            padding: 30px 40px 48px;
            background:
              radial-gradient(circle at 10% 0%, rgba(234, 88, 12, .18), transparent 30%),
              linear-gradient(180deg, #FFF3E8 0%, #FFFBF6 360px, #fff 100%);
            color: #2A1A12;
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
            letter-spacing: 0;
          }
          .oy-detail-shell { max-width: 1360px; margin: 0 auto; }
          .oy-detail-hero { display: grid; grid-template-columns: minmax(0, 1.28fr) 380px; gap: 18px; margin-bottom: 18px; }
          .oy-detail-card { background: rgba(255,255,255,.92); border: 1px solid color-mix(in srgb, var(--oy-brand) 16%, #F5D1B0); border-radius: 18px; box-shadow: 0 18px 48px rgba(154, 52, 18, .10); overflow: hidden; }
          .oy-detail-main {
            min-height: 360px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 300px;
            gap: 24px;
            align-items: stretch;
            padding: 30px;
            position: relative;
            background:
              linear-gradient(90deg, rgba(255,255,255,.96), rgba(255,246,237,.88) 54%, rgba(255,255,255,.36)),
              var(--oy-workspace-image) center / cover no-repeat;
          }
          .oy-detail-main:before { content: ""; position: absolute; left: 0; top: 30px; bottom: 30px; width: 6px; background: var(--oy-brand); border-radius: 999px; }
          .oy-hero-copy { position: relative; z-index: 1; align-self: end; }
          .oy-hero-copy p { max-width: 740px; color: #674833; font-size: 16px; line-height: 1.75; }
          .oy-detail-title { font-size: 58px; line-height: 1.02; font-weight: 900; margin: 20px 0 14px; max-width: 760px; color: #2A1A12; }
          .oy-profile-photo { min-height: 300px; border-radius: 24px; background: var(--oy-portrait-image) center / cover no-repeat; box-shadow: inset 0 0 0 1px rgba(255,255,255,.62), 0 24px 56px rgba(154,52,18,.16); display: flex; align-items: flex-end; justify-content: flex-start; padding: 18px; }
          .oy-profile-photo span { width: 58px; height: 58px; border-radius: 18px; display: grid; place-items: center; background: rgba(255,255,255,.90); color: var(--oy-brand-deep); font-weight: 900; font-size: 20px; box-shadow: 0 12px 28px rgba(154,52,18,.18); }
          .oy-detail-summary { padding: 24px; display: flex; flex-direction: column; gap: 14px; justify-content: space-between; background: linear-gradient(180deg, #fff, #FFF7ED); }
          .oy-detail-number { font-size: 34px; font-weight: 900; font-variant-numeric: tabular-nums; line-height: 1.12; margin: 8px 0; color: var(--oy-brand-deep); }
          .oy-detail-actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
          .oy-detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; align-items: start; }
          .oy-detail-main-column { display: grid; gap: 18px; }
          .oy-detail-sections { padding: 22px; }
          .oy-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 10px; }
          .oy-panel-head h3 { margin: 0; }
          .oy-detail-section { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: start; padding: 18px 0; border-top: 1px solid color-mix(in srgb, var(--oy-brand) 12%, #F2D5BC); }
          .oy-detail-section:first-of-type { border-top: none; }
          .oy-detail-section h4 { margin: 0 0 8px; color: #2A1A12; }
          .oy-detail-section p { margin: 0; color: #6F5644; line-height: 1.72; }
          .oy-detail-meta { padding: 22px; position: sticky; top: 18px; }
          .oy-detail-metric { display: flex; justify-content: space-between; gap: 12px; padding: 15px 0; border-top: 1px solid color-mix(in srgb, var(--oy-brand) 12%, #F2D5BC); }
          .oy-detail-metric:first-of-type { border-top: none; }
          .oy-detail-metric strong { font-size: 23px; color: #2A1A12; font-variant-numeric: tabular-nums; }
          .oy-detail-metric small { display: block; margin-top: 5px; color: var(--oy-brand-deep); font-size: 12px; font-weight: 700; }
          .oy-next-action { margin-top: 18px; padding: 16px; border-radius: 16px; background: #FFF7ED; border: 1px solid color-mix(in srgb, var(--oy-brand) 18%, #F2D5BC); }
          .oy-next-action p { margin: 8px 0 14px; color: #6F5644; line-height: 1.65; }
          .oy-relationship-panel { padding: 22px; }
          .oy-contact-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
          .oy-contact-card { position: relative; display: grid; grid-template-columns: 46px 1fr; gap: 12px; padding: 14px; border: 1px solid color-mix(in srgb, var(--oy-brand) 12%, #F2D5BC); border-radius: 16px; background: #fff; }
          .oy-contact-avatar { width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; background: color-mix(in srgb, var(--oy-brand) 14%, #fff); color: var(--oy-brand-deep); font-weight: 900; }
          .oy-contact-card span, .oy-contact-card small { display: block; color: #7A604D; }
          .oy-contact-card small { margin-top: 4px; font-size: 12px; }
          .oy-contact-card b { position: absolute; right: 14px; top: 14px; color: color-mix(in srgb, var(--oy-brand) 52%, #D8B997); font-size: 18px; }
          .oy-detail-timeline { margin-top: 18px; }
          .oy-detail-event { display: grid; grid-template-columns: 86px 1fr; gap: 14px; padding: 15px 0; border-top: 1px solid color-mix(in srgb, var(--oy-brand) 12%, #F2D5BC); }
          .oy-detail-stage { color: var(--oy-brand-deep); font-weight: 900; font-variant-numeric: tabular-nums; }
          .oy-insight-callout { border-color: color-mix(in srgb, var(--oy-brand), transparent 70%); }
          @media (max-width: 960px) {
            .oy-detail-profile { padding: 20px; }
            .oy-detail-hero, .oy-detail-grid, .oy-detail-main, .oy-contact-grid { grid-template-columns: 1fr; }
            .oy-detail-title { font-size: 38px; }
            .oy-detail-meta { position: static; }
          }
        `}</style>

        <div className="oy-detail-shell">
          <section className="oy-detail-hero">
            <ObjectHero page={PAGE} primaryAction={primaryAction} shellLabel={shellLabel} />
            <InsightCallout insight={insight} page={PAGE} />
          </section>

          <div className="oy-detail-grid">
            <div className="oy-detail-main-column">
              <FeatureNarrative features={FEATURES} title={PAGE.featuresTitle} />
              <RelationshipPanel contacts={DEFAULT_CONTACTS} />
              <section className="oy-detail-card oy-detail-sections">
                <TimelinePrimitive items={ROADMAP} title={PAGE.roadmapTitle} />
              </section>
            </div>

            <MetaStack metrics={METRICS} page={PAGE} />
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
