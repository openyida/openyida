/**
 * Yida application theme data screen Code Canvas template
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 */

import React, { useMemo, useState } from 'react';
import { ConfigProvider, Button, Tag, Progress } from 'antd';
import { AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemoizedFn } from 'ahooks';

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
  brandName: '区域经营态势屏',
  brandInitials: 'DS',
  tagline: '实时监测 · 异常预警 · 处置闭环',
  heroText: '把区域增长、异常分布、趋势波动和处置优先级集中到一张数据大屏，适合运营监控和管理驾驶舱。',
  primaryCta: '刷新数据',
  secondaryCta: '导出快照',
  featuresTitle: '重点指标监测区',
  roadmapTitle: '处置路径',
  ctaTitle: '异常洞察',
  ctaText: '北区增长最快，南区异常率需要进一步拆解。',
});

const DEFAULT_FEATURES = [
  { title: '区域经营', text: '按区域聚合核心指标、排名和异常对象。' },
  { title: '实时态势', text: '把增长、履约和风险用同一屏幕表达。' },
  { title: '重点追踪', text: '把需要管理者介入的事项固定到行动区。' },
];
const DEFAULT_METRICS = [
  { label: '今日访问', value: '12,860' },
  { label: '转化率', value: '18.6%' },
  { label: '异常单', value: '23' },
  { label: '完成率', value: '96%' },
];
const DEFAULT_ROADMAP = [
  { stage: 'A', title: '数据接入', text: '接入表单、报表或连接器数据。' },
  { stage: 'B', title: '态势分析', text: '按区域、时间和业务线做对比。' },
  { stage: 'C', title: '行动闭环', text: '把异常项同步给对应负责人。' },
];
const DEFAULT_VISUAL_PROFILE = { name: 'data-screen' };
const DEFAULT_THEME_PROFILE = { followRuntimeTheme: false, name: 'electric-cyan-screen', themeColor: '#00B8D9', themeColorDeep: '#075985', themeColorSoft: '#E7F9FD', themeColorTint: 'rgba(0, 184, 217, 0.2)', palette: ['#00B8D9', '#31D7FF', '#4BE0A0', '#B8F35A', '#FF7AB6'] };
const DEFAULT_APP_BLUEPRINT = { shell: 'screen' };
const DEFAULT_INTERACTION_PROFILE = { primaryAction: '刷新数据' };
const DEFAULT_INSIGHTS = [{ conclusion: '北区增长最快，南区异常率需要进一步拆解。' }];

const FEATURES = parseTemplateJson('{{FEATURES_JSON}}', DEFAULT_FEATURES);
const METRICS = parseTemplateJson('{{METRICS_JSON}}', DEFAULT_METRICS);
const ROADMAP = parseTemplateJson('{{ROADMAP_JSON}}', DEFAULT_ROADMAP);
const VISUAL_PROFILE = parseTemplateJson('{{OPENYIDA_VISUAL_PROFILE_JSON}}', DEFAULT_VISUAL_PROFILE);
const THEME_PROFILE = parseTemplateJson('{{OPENYIDA_THEME_PROFILE_JSON}}', DEFAULT_THEME_PROFILE);
const THEME_SCOPE = withFallback('{{OPENYIDA_THEME_SCOPE}}', 'page');
const APP_BLUEPRINT = parseTemplateJson('{{OPENYIDA_APP_BLUEPRINT_JSON}}', DEFAULT_APP_BLUEPRINT);
const INTERACTION_PROFILE = parseTemplateJson('{{OPENYIDA_INTERACTION_PROFILE_JSON}}', DEFAULT_INTERACTION_PROFILE);
const INSIGHTS = parseTemplateJson('{{OPENYIDA_INSIGHTS_JSON}}', DEFAULT_INSIGHTS);
const RESEARCH_LEVEL = withFallback('{{OPENYIDA_RESEARCH_LEVEL}}', 'sample');
const THEME_COLOR_LEVELS = {
  themeColor: 6,
  themeColorSoft: 2,
  themeColorTint: 3,
  themeColorDeep: 9,
};

const trendData = [
  { label: '00', up: 86, down: 64, avg: 70 },
  { label: '04', up: 118, down: 90, avg: 82 },
  { label: '08', up: 156, down: 126, avg: 108 },
  { label: '12', up: 182, down: 142, avg: 136 },
  { label: '16', up: 226, down: 176, avg: 158 },
  { label: '20', up: 288, down: 212, avg: 194 },
];

const barData = [
  { name: '企业总数', value: 117 },
  { name: '异常企业', value: 74 },
  { name: '高危站点', value: 55 },
  { name: '待处置', value: 38 },
];

const radarData = [
  { name: '北京', value: 65 },
  { name: '上海', value: 48 },
  { name: '浙江', value: 82 },
  { name: '广东', value: 62 },
  { name: '重庆', value: 85 },
];

const geoRegions = [
  { name: '北京市', shortName: '北京', area: '北区', coord: [116.4074, 39.9042], value: 120, level: '重点', trend: '+18%', radius: 18 },
  { name: '重庆市', shortName: '重庆', area: '西南', coord: [106.5516, 29.563], value: 98, level: '关注', trend: '+9%', radius: 15 },
  { name: '浙江省', shortName: '浙江', area: '华东', coord: [120.1551, 30.2741], value: 86, level: '关注', trend: '+12%', radius: 14 },
  { name: '广东省', shortName: '深圳', area: '华南', coord: [114.0579, 22.5431], value: 64, level: '稳定', trend: '+5%', radius: 12 },
  { name: '上海市', shortName: '上海', area: '华东', coord: [121.4737, 31.2304], value: 60, level: '稳定', trend: '+3%', radius: 12 },
];

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
    if (typeof updateShellConfig !== 'function') {
      return;
    }
    updateShellConfig({
      themeConfig: {
        theme: getThemeColor(profile, 'navTheme', 'light'),
        colorMode: getThemeColor(profile, 'colorMode', 'gradient'),
        mode: getThemeColor(profile, 'mode', 'color_color'),
        themeColor: getThemeColor(profile, 'themeColor', readBrandColor(6, '#6B7CAB')),
        mobileNavStyle: getThemeColor(profile, 'mobileNavStyle', 'top'),
      },
    });
  } catch (err) {
    // Shell theme bridge is optional.
  }
}

function Icon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17l5-5 4 4 7-8" />
      <path d="M15 8h5v5" />
    </svg>
  );
}

function Metric({ item, index, accent }) {
  return (
    <div className="oy-screen-metric">
      <div className="oy-metric-label">{item.label}</div>
      <div className="oy-metric-value">{item.value}</div>
      <div className="oy-spark">
        {Array.from({ length: 26 }).map((_, sparkIndex) => (
          <span
            key={sparkIndex}
            style={{ height: 6 + ((sparkIndex * 7 + index * 5) % 24), background: sparkIndex % 3 === 0 ? accent : '#36d6c5' }}
          />
        ))}
      </div>
    </div>
  );
}

function getDeepYidaBundle() {
  const deepYida = typeof window !== 'undefined' && window.DeepYida;
  if (!deepYida) return null;
  if (Array.isArray(deepYida)) return deepYida;
  if (Array.isArray(deepYida.default)) return deepYida.default;
  if (Array.isArray(deepYida.components)) return deepYida.components;
  return deepYida;
}

function findFromBundle(bundle, name) {
  if (!bundle) return null;
  if (bundle[name]) return bundle[name];
  if (Array.isArray(bundle)) {
    return bundle.find((item) => item && (item.displayName === name || item.name === name)) || null;
  }
  return null;
}

function findYidaMapComponent() {
  const names = ['YoushuMap', 'ChinaMap', 'YidaMap', 'MapChart', 'GeoMap', 'RegionMap', 'DataVMap'];
  const sources = [
    ['window.YidaNativeComponents', typeof window !== 'undefined' && window.YidaNativeComponents],
    ['window.Deep', typeof window !== 'undefined' && window.Deep],
    ['window.DeepYida', getDeepYidaBundle()],
  ];
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const [source, bundle] = sources[sourceIndex];
    for (let nameIndex = 0; nameIndex < names.length; nameIndex += 1) {
      const name = names[nameIndex];
      const component = findFromBundle(bundle, name);
      if (component) {
        return { component, source, name };
      }
    }
  }
  return { component: null, source: 'built-in', name: 'OpenYidaRegionMap' };
}

function projectGeoPoint(coord) {
  const lng = coord[0];
  const lat = coord[1];
  const x = ((lng - 73) / (135 - 73)) * 100;
  const y = ((54 - lat) / (54 - 18)) * 100;
  return {
    x: Math.max(8, Math.min(92, x)),
    y: Math.max(8, Math.min(88, y)),
  };
}

class MapBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: '' };
  }

  static getDerivedStateFromError(error) {
    return { error: error && error.message ? error.message : String(error) };
  }

  componentDidCatch(error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.error) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

function BuiltInChinaRegionMap({ data, colors, sourceName }) {
  const points = data.map((item) => ({ ...item, ...projectGeoPoint(item.coord) }));
  return (
    <div className="oy-yida-map-component">
      <div className="oy-map-badge">Yida Map · {sourceName || '内置区域地图组件'}</div>
      <svg className="oy-region-map-svg" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" aria-label="中国区域经营地图">
        <defs>
          <linearGradient id="oyMapAreaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(49,215,255,.34)" />
            <stop offset="55%" stopColor="rgba(0,184,217,.20)" />
            <stop offset="100%" stopColor="rgba(75,224,160,.32)" />
          </linearGradient>
          <filter id="oyMapGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          className="oy-region-map-shape"
          d="M184 190 L274 114 L377 126 L455 88 L562 112 L642 158 L760 162 L850 238 L812 340 L874 424 L770 494 L696 602 L584 562 L510 612 L420 552 L314 568 L250 482 L144 454 L106 336 Z"
        />
        <path className="oy-region-map-inner" d="M274 114 L332 224 L455 88 L470 246 L562 112 L548 286 L642 158 L620 318 L760 162 L690 350 L812 340" />
        <path className="oy-region-map-inner" d="M144 454 L314 568 L420 552 L510 612 L584 562 L696 602 L770 494" />
        <path className="oy-region-flow" d="M628 262 C676 306 710 350 760 426" />
        <path className="oy-region-flow secondary" d="M545 474 C590 414 650 388 742 360" />
        <path className="oy-region-flow tertiary" d="M660 546 C632 480 656 430 735 392" />
        {points.map((point) => (
          <g key={point.name} transform={`translate(${point.x * 10} ${point.y * 7})`}>
            <circle className="oy-region-point-ring" r={point.radius + 12} style={{ '--point-color': point.level === '重点' ? colors.pink : colors.cyan }} />
            <circle className="oy-region-point" r={point.radius} style={{ '--point-color': point.level === '重点' ? colors.pink : colors.cyan }} />
            <text className="oy-region-label" x={point.radius + 10} y="4">{point.shortName}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function YidaMapComponent({ data, colors }) {
  const [nativeFailed, setNativeFailed] = useState(false);
  const probe = useMemo(() => findYidaMapComponent(), []);
  const NativeMap = probe.component;
  const fallback = <BuiltInChinaRegionMap data={data} colors={colors} sourceName="内置区域地图组件" />;

  if (!NativeMap || nativeFailed) {
    return fallback;
  }

  const normalizedData = data.map((item) => ({
    name: item.name,
    label: item.shortName,
    value: item.value,
    area: item.area,
    level: item.level,
    trend: item.trend,
    coordinate: item.coord,
  }));

  return (
    <MapBoundary fallback={fallback} onError={() => setNativeFailed(true)}>
      <div className="oy-yida-map-component oy-yida-native-map-component">
        <div className="oy-map-badge">Yida Map · {probe.name}</div>
        <BuiltInChinaRegionMap data={data} colors={colors} sourceName="区域数据底图" />
        <div className="oy-native-map-host">
          <NativeMap
            data={normalizedData}
            dataSource={normalizedData}
            mapData={normalizedData}
            regions={normalizedData}
            points={normalizedData}
            settings={{
              titleConfig: { label: '区域经营态势' },
              height: 440,
              drillDown: false,
              colorType: 'custom',
              customColor: colors.cyan,
            }}
          />
        </div>
      </div>
    </MapBoundary>
  );
}

function YidaComp() {
  const [updatedAt, setUpdatedAt] = useState('10:40:19');

  React.useEffect(() => {
    applyShellTheme(THEME_SCOPE, THEME_PROFILE);
  }, []);

  const themeVars = buildScopedThemeVars(THEME_SCOPE, THEME_PROFILE);
  const brand = getThemeColor(THEME_PROFILE, 'themeColor', readBrandColor(6, '#6B7CAB'));
  const brandDeep = getThemeColor(THEME_PROFILE, 'themeColorDeep', readBrandColor(9, '#435480'));
  const brandPalette = parseColorGroup(THEME_PROFILE.palette || [brand, '#31D7FF', '#4BE0A0', '#B8F35A', '#FF7AB6']);
  const cyan = brandPalette[1] || brand;
  const green = brandPalette[2] || '#4be0a0';
  const amber = brandPalette[4] || '#f4a33f';
  const pink = brandPalette[5] || '#ff4aa2';
  const primaryAction = INTERACTION_PROFILE.primaryAction || PAGE.primaryCta;
  const insight = INSIGHTS[0] || {};
  const shellLabel = APP_BLUEPRINT.shell || 'single_page';

  const refresh = useMemoizedFn(() => {
    const now = new Date();
    setUpdatedAt([
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join(':'));
  });

  const rankItems = useMemo(() => FEATURES.slice(0, 5).map((item, index) => ({
    ...item,
    rank: index + 1,
    level: index < 2 ? '严重' : index < 4 ? '中度' : '稳定',
    distance: `${15 - index * 2}公里`,
  })), []);

  return (
    <ConfigProvider getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body} theme={{ token: { colorPrimary: brand, borderRadius: 6 } }}>
      <div
        className="oy-screen"
        data-profile={VISUAL_PROFILE.name}
        data-theme-profile={THEME_PROFILE.name}
        data-theme-scope={THEME_SCOPE}
        style={{
          ...themeVars,
          '--oy-brand': brand,
          '--oy-brand-deep': brandDeep,
          '--oy-cyan': cyan,
          '--oy-green': green,
          '--oy-amber': amber,
          '--oy-pink': pink,
        }}
      >
        <style>{`
          {{OPENYIDA_CANVAS_CONTROL_CSS}}
          .oy-screen {
            min-height: 100vh;
            padding: 18px;
            color: #dcecff;
            background:
              radial-gradient(circle at 50% 42%, rgba(49,215,255,.16), transparent 34%),
              linear-gradient(135deg, rgba(7,18,38,.98), rgba(10,34,68,.96) 48%, rgba(8,18,37,1)),
              var(--oy-brand-deep);
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
            letter-spacing: 0;
          }
          .oy-screen::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            background-image:
              linear-gradient(rgba(49,215,255,.045) 1px, transparent 1px),
              linear-gradient(90deg, rgba(49,215,255,.045) 1px, transparent 1px);
            background-size: 28px 28px;
            mask-image: radial-gradient(circle at center, #000, transparent 76%);
          }
          .oy-shell {
            position: relative;
            z-index: 1;
            max-width: 1840px;
            margin: 0 auto;
            display: grid;
            grid-template-rows: auto 1fr;
            gap: 14px;
          }
          .oy-header {
            min-height: 48px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 18px;
          }
          .oy-title {
            margin: 0;
            color: #f6fbff;
            font-size: 25px;
            line-height: 1.2;
            font-weight: 850;
            text-shadow: 0 0 18px rgba(49,215,255,.22);
          }
          .oy-subtitle {
            margin-top: 5px;
            color: rgba(220,236,255,.66);
            font-size: 13px;
          }
          .oy-time {
            display: flex;
            align-items: center;
            gap: 10px;
            color: rgba(220,236,255,.76);
            font-variant-numeric: tabular-nums;
          }
          .oy-grid {
            display: grid;
            grid-template-columns: minmax(260px, .72fr) minmax(560px, 1.55fr) minmax(300px, .82fr);
            gap: 12px;
            min-height: calc(100vh - 84px);
          }
          .oy-side {
            display: grid;
            gap: 12px;
            align-content: start;
          }
          .oy-panel {
            position: relative;
            border: 1px solid rgba(49,215,255,.18);
            background: linear-gradient(180deg, rgba(15,48,88,.72), rgba(7,25,54,.62));
            box-shadow: inset 0 0 24px rgba(49,215,255,.05), 0 18px 42px rgba(0,0,0,.22);
            border-radius: 8px;
            overflow: hidden;
          }
          .oy-panel::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            width: 3px;
            height: 30px;
            background: var(--oy-cyan);
            box-shadow: 0 0 18px var(--oy-cyan);
          }
          .oy-panel-body {
            position: relative;
            z-index: 1;
            padding: 14px;
          }
          .oy-panel-title {
            margin: 0 0 12px;
            color: #eaf7ff;
            font-size: 14px;
            line-height: 1.4;
            font-weight: 800;
          }
          .oy-metric-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .oy-screen-metric {
            min-height: 116px;
            padding: 12px;
            border-radius: 6px;
            background: rgba(7,24,48,.55);
          }
          .oy-metric-label {
            color: rgba(220,236,255,.68);
            font-size: 12px;
          }
          .oy-metric-value {
            margin-top: 12px;
            color: var(--oy-cyan);
            font-size: 32px;
            line-height: 1;
            font-weight: 850;
            font-variant-numeric: tabular-nums;
            text-shadow: 0 0 18px rgba(49,215,255,.36);
          }
          .oy-spark {
            display: flex;
            align-items: end;
            gap: 2px;
            height: 30px;
            margin-top: 12px;
          }
          .oy-spark span {
            flex: 1;
            min-width: 2px;
            border-radius: 99px 99px 0 0;
            opacity: .86;
          }
          .oy-chart {
            height: 230px;
          }
          .oy-bar-list {
            display: grid;
            gap: 14px;
          }
          .oy-bar-row {
            display: grid;
            grid-template-columns: 72px 1fr 38px;
            gap: 10px;
            align-items: center;
            color: rgba(220,236,255,.76);
            font-size: 12px;
          }
          .oy-map {
            position: relative;
            min-height: 100%;
            border: 1px solid rgba(49,215,255,.18);
            border-radius: 8px;
            overflow: hidden;
            background:
              radial-gradient(circle at 44% 54%, rgba(49,215,255,.20), transparent 36%),
              linear-gradient(180deg, rgba(10,36,72,.38), rgba(5,17,38,.58));
          }
          .oy-map::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
              linear-gradient(rgba(126,222,255,.035) 1px, transparent 1px),
              linear-gradient(90deg, rgba(126,222,255,.035) 1px, transparent 1px);
            background-size: 34px 34px;
            pointer-events: none;
          }
          .oy-map-title {
            position: absolute;
            left: 18px;
            top: 16px;
            z-index: 2;
            max-width: calc(100% - 290px);
          }
          .oy-map-title h2 {
            margin: 0;
            color: #f6fbff;
            font-size: 18px;
          }
          .oy-map-title p {
            margin: 6px 0 0;
            color: rgba(220,236,255,.62);
            font-size: 12px;
          }
          .oy-map-stage {
            position: absolute;
            inset: 76px 16px 16px;
            border: 1px solid rgba(126,222,255,.18);
            border-radius: 8px;
            background:
              radial-gradient(circle at 42% 48%, rgba(49,215,255,.16), transparent 36%),
              rgba(4,18,39,.20);
          }
          .oy-yida-map-component {
            position: absolute;
            left: 18px;
            top: 16px;
            width: calc(100% - 286px);
            height: calc(100% - 32px);
            min-height: 420px;
          }
          .oy-yida-native-map-component > .oy-yida-map-component {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
          }
          .oy-native-map-host {
            position: absolute;
            inset: 0;
            z-index: 2;
            opacity: .82;
            pointer-events: auto;
          }
          .oy-native-map-host:empty {
            display: none;
          }
          .oy-map-badge {
            position: absolute;
            left: 12px;
            top: 12px;
            z-index: 6;
            padding: 6px 10px;
            border: 1px solid rgba(126,222,255,.22);
            border-radius: 999px;
            color: rgba(246,251,255,.78);
            background: rgba(5,18,39,.72);
            font-size: 11px;
            font-weight: 800;
          }
          .oy-region-map-svg {
            width: 100%;
            height: 100%;
            min-height: 420px;
            overflow: visible;
          }
          .oy-region-map-shape {
            fill: url(#oyMapAreaGradient);
            stroke: rgba(126,222,255,.78);
            stroke-width: 2.4;
            filter: url(#oyMapGlow);
          }
          .oy-region-map-inner {
            fill: none;
            stroke: rgba(126,222,255,.22);
            stroke-width: 1.2;
          }
          .oy-region-flow {
            fill: none;
            stroke: var(--oy-green);
            stroke-width: 3;
            stroke-linecap: round;
            stroke-dasharray: 12 10;
            opacity: .78;
          }
          .oy-region-flow.secondary {
            stroke: var(--oy-pink);
            opacity: .64;
          }
          .oy-region-flow.tertiary {
            stroke: var(--oy-cyan);
            opacity: .58;
          }
          .oy-region-point-ring {
            fill: none;
            stroke: var(--point-color);
            stroke-width: 2;
            opacity: .36;
          }
          .oy-region-point {
            fill: var(--point-color);
            stroke: rgba(255,255,255,.88);
            stroke-width: 2;
            filter: url(#oyMapGlow);
          }
          .oy-region-label {
            fill: rgba(246,251,255,.84);
            font-size: 22px;
            font-weight: 850;
            paint-order: stroke;
            stroke: rgba(5,18,39,.78);
            stroke-width: 4px;
          }
          .oy-map-legend {
            position: absolute;
            left: 18px;
            bottom: 14px;
            display: flex;
            gap: 10px;
            z-index: 5;
            color: rgba(220,236,255,.66);
            font-size: 12px;
          }
          .oy-map-legend span {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 8px;
            border: 1px solid rgba(126,222,255,.16);
            border-radius: 6px;
            background: rgba(7,24,48,.58);
          }
          .oy-map-legend i {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--legend-color);
            box-shadow: 0 0 12px var(--legend-color);
          }
          .oy-map-callouts {
            position: absolute;
            right: 14px;
            top: 14px;
            bottom: 14px;
            width: 236px;
            z-index: 5;
            display: grid;
            gap: 9px;
            align-content: start;
          }
          .oy-point-card {
            min-height: 74px;
            padding: 10px 11px;
            border: 1px solid rgba(126,222,255,.32);
            border-radius: 8px;
            color: rgba(246,251,255,.92);
            background:
              linear-gradient(90deg, rgba(49,215,255,.12), transparent 46%),
              rgba(14,39,76,.86);
            box-shadow: 0 12px 28px rgba(0,0,0,.18);
            font-size: 12px;
            line-height: 1.55;
          }
          .oy-point-card-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin-bottom: 5px;
          }
          .oy-point-card b {
            color: #f6fbff;
            font-size: 14px;
          }
          .oy-point-card strong {
            color: var(--oy-cyan);
            font-size: 18px;
            font-variant-numeric: tabular-nums;
          }
          .oy-point-card small {
            color: rgba(220,236,255,.58);
          }
          .oy-rank-list {
            display: grid;
            gap: 10px;
          }
          .oy-rank {
            display: grid;
            grid-template-columns: 26px 54px 1fr auto;
            gap: 10px;
            align-items: center;
            color: rgba(220,236,255,.78);
            font-size: 12px;
          }
          .oy-rank-index {
            color: #ff7357;
            font-weight: 850;
            font-size: 16px;
          }
          .oy-risk-tag {
            display: inline-flex;
            justify-content: center;
            min-width: 44px;
            padding: 4px 7px;
            border-radius: 5px;
            color: #fff;
            background: var(--oy-amber);
            font-weight: 800;
          }
          .oy-ring-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }
          .oy-ring {
            display: grid;
            place-items: center;
            min-height: 104px;
            border-radius: 8px;
            background: rgba(7,24,48,.48);
          }
          .oy-ring-circle {
            width: 78px;
            height: 78px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            color: #fff;
            font-weight: 850;
            background:
              radial-gradient(circle at center, rgba(8,23,48,1) 48%, transparent 50%),
              conic-gradient(var(--ring-color) calc(var(--ring-value) * 1%), rgba(255,255,255,.1) 0);
          }
          .oy-screen-brief {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
            margin-top: 8px;
            color: rgba(220,236,255,.68);
          }
          @media (max-width: 1160px) {
            .oy-grid { grid-template-columns: 1fr; }
            .oy-map { min-height: 560px; }
            .oy-map-title { max-width: none; right: 18px; }
          }
          @media (max-width: 640px) {
            .oy-screen { padding: 12px; }
            .oy-header { align-items: flex-start; flex-direction: column; }
            .oy-metric-grid, .oy-ring-grid { grid-template-columns: 1fr; }
            .oy-map { min-height: 720px; }
            .oy-map-stage { inset: 98px 12px 12px; }
            .oy-yida-map-component { width: calc(100% - 24px); height: 54%; min-height: 320px; }
            .oy-region-map-svg { min-height: 320px; }
            .oy-map-callouts { left: 12px; right: 12px; top: auto; bottom: 12px; width: auto; grid-template-columns: 1fr; }
            .oy-map-legend { bottom: calc(45% - 4px); flex-wrap: wrap; }
          }
        `}</style>

        <div className="oy-shell">
          <header className="oy-header">
            <div>
              <h1 className="oy-title">{PAGE.brandName}</h1>
              <div className="oy-subtitle">{PAGE.heroText}</div>
              <div className="oy-screen-brief">
                <Tag color="processing">{shellLabel}</Tag>
                <Tag>{RESEARCH_LEVEL || 'light'} research</Tag>
                {insight.conclusion ? <span>{insight.conclusion}</span> : null}
              </div>
            </div>
            <div className="oy-time">
              <span>{updatedAt}</span>
              <Button type="primary" size="small" icon={<Icon />} onClick={refresh}>{primaryAction}</Button>
            </div>
          </header>

          <main className="oy-grid">
            <aside className="oy-side">
              <section className="oy-panel">
                <div className="oy-panel-body">
                  <h3 className="oy-panel-title">重点指标监测区</h3>
                  <div className="oy-metric-grid">
                    {METRICS.slice(0, 4).map((item, index) => (
                      <Metric key={item.label} item={item} index={index} accent={index % 2 ? green : cyan} />
                    ))}
                  </div>
                </div>
              </section>

              <section className="oy-panel">
                <div className="oy-panel-body">
                  <h3 className="oy-panel-title">{PAGE.featuresTitle}</h3>
                  <div className="oy-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(49,215,255,.24)" />
                        <PolarAngleAxis dataKey="name" tick={{ fill: 'rgba(220,236,255,.64)', fontSize: 12 }} />
                        <Radar dataKey="value" stroke={cyan} fill={cyan} fillOpacity={0.28} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section className="oy-panel">
                <div className="oy-panel-body">
                  <h3 className="oy-panel-title">{PAGE.roadmapTitle}</h3>
                  <div className="oy-bar-list">
                    {barData.map((item, index) => (
                      <div className="oy-bar-row" key={item.name}>
                        <span>{item.name}</span>
                        <Progress percent={item.value} size="small" showInfo={false} strokeColor={index === 0 ? cyan : green} trailColor="rgba(255,255,255,.1)" />
                        <b>{item.value}</b>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </aside>

            <section className="oy-map">
              <div className="oy-map-title">
                <h2>{insight.conclusion || PAGE.ctaTitle}</h2>
                <p>{insight.suggestion || PAGE.ctaText}</p>
              </div>
              <div className="oy-map-stage">
                <YidaMapComponent data={geoRegions} colors={{ cyan, green, pink, amber }} />

                <div className="oy-map-legend">
                  <span><i style={{ '--legend-color': cyan }} />重点监测</span>
                  <span><i style={{ '--legend-color': pink }} />异常波动</span>
                  <span><i style={{ '--legend-color': green }} />处置流向</span>
                </div>

                <div className="oy-map-callouts">
                  {geoRegions.slice(0, 4).map((point) => (
                    <div className="oy-point-card" key={point.name}>
                      <div className="oy-point-card-head">
                        <b>{point.shortName}</b>
                        <Tag color={point.level === '重点' ? 'magenta' : point.level === '关注' ? 'gold' : 'cyan'}>{point.level}</Tag>
                      </div>
                      <strong>{point.value}</strong>
                      <br />
                      <small>监测值 · 环比 {point.trend}</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="oy-side">
              <section className="oy-panel">
                <div className="oy-panel-body">
                  <h3 className="oy-panel-title">异常 TOP5</h3>
                  <div className="oy-rank-list">
                    {rankItems.map((item) => (
                      <div className="oy-rank" key={item.title}>
                        <span className="oy-rank-index">{item.rank}</span>
                        <span className="oy-risk-tag" style={{ background: item.level === '严重' ? amber : item.level === '中度' ? cyan : green }}>{item.level}</span>
                        <span>{item.title}</span>
                        <span>{item.distance}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="oy-panel">
                <div className="oy-panel-body">
                  <h3 className="oy-panel-title">类别占比</h3>
                  <div className="oy-ring-grid">
                    {ROADMAP.slice(0, 3).map((item, index) => (
                      <div className="oy-ring" key={item.stage}>
                        <div className="oy-ring-circle" style={{ '--ring-color': [cyan, pink, brand][index], '--ring-value': [62, 74, 86][index] }}>
                          {item.stage}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="oy-panel">
                <div className="oy-panel-body">
                  <h3 className="oy-panel-title">主要趋势</h3>
                  <div className="oy-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <XAxis dataKey="label" tick={{ fill: 'rgba(220,236,255,.54)', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(220,236,255,.54)', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#0b1f3c', border: '1px solid rgba(49,215,255,.22)', borderRadius: 8 }} />
                        <Area type="monotone" dataKey="up" stroke={amber} fill={amber} fillOpacity={0.12} strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="down" stroke={cyan} fill={cyan} fillOpacity={0.12} strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="avg" stroke={green} fill={green} fillOpacity={0.08} strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            </aside>
          </main>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
