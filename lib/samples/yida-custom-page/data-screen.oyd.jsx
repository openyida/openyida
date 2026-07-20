/**
 * 物流实时监控大屏（data-screen 场景 · 原生自定义页面示例 · data-screen）
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 真实业务对象：全国物流调度实时监控大屏。顶部 KPI 指标条 + 区域运力分布 +
 * 干线时效趋势 + 车辆状态环 + 实时异常告警流，对齐 canvas 的 data-screen。
 *
 * 大屏场景允许深色主题（data-screen 专属），零 emoji，功能性内联 SVG，
 * 纯 CSS 图形不依赖 ECharts，页面级独立主题（深空蓝 + 青绿点缀）。
 */

var REGION_OPTIONS = [
  { value: 'all', label: '全国' },
  { value: 'east', label: '华东' },
  { value: 'south', label: '华南' },
  { value: 'north', label: '华北' },
  { value: 'west', label: '西部' },
];

// 顶部 KPI（含单位/环比）
var KPI = [
  { key: 'inTransit', label: '在途运单', value: '18,642', unit: '单', delta: '+4.2%', trend: 'up' },
  { key: 'ontime', label: '准时率', value: '96.8', unit: '%', delta: '+1.1pt', trend: 'up' },
  { key: 'vehicles', label: '在线车辆', value: '1,326', unit: '辆', delta: '+38', trend: 'up' },
  { key: 'exception', label: '异常件', value: '54', unit: '件', delta: '+9', trend: 'bad' },
  { key: 'avgHours', label: '平均时效', value: '31.4', unit: 'h', delta: '-0.8h', trend: 'up' },
];

// 区域运力分布（在途量 + 负载率）
var REGIONS = [
  { name: '华东枢纽', volume: 6820, load: 88 },
  { name: '华南枢纽', volume: 4310, load: 72 },
  { name: '华北枢纽', volume: 3560, load: 63 },
  { name: '西部枢纽', volume: 2190, load: 51 },
  { name: '东北枢纽', volume: 1762, load: 44 },
];

// 干线时效趋势（近 12 小时平均时效 h）
var TREND = [
  { t: '02', v: 33.1 }, { t: '04', v: 32.6 }, { t: '06', v: 31.9 },
  { t: '08', v: 30.4 }, { t: '10', v: 29.8 }, { t: '12', v: 30.6 },
  { t: '14', v: 31.4 }, { t: '16', v: 32.0 }, { t: '18', v: 33.5 },
  { t: '20', v: 34.2 }, { t: '22', v: 32.8 }, { t: '24', v: 31.4 },
];

// 车辆状态分布
var VEHICLE = [
  { name: '在途行驶', value: 892, color: '#2DD4BF' },
  { name: '装卸作业', value: 268, color: '#38BDF8' },
  { name: '待发调度', value: 124, color: '#FBBF24' },
  { name: '异常停滞', value: 42, color: '#F87171' },
];

// 实时异常告警流（具体、可执行）
var ALERTS = [
  { level: 'high', time: '14:02', text: 'G60 沪昆高速 K1284 段拥堵，17 辆车预计延误 40min，已触发改道方案 B。' },
  { level: 'mid', time: '13:51', text: '华南枢纽冷链库温升至 8.2℃，超阈值 2℃，已通知值班工程师现场处置。' },
  { level: 'high', time: '13:47', text: '运单 YD-778201 连续 90min 无轨迹上报，车载终端疑似离线，正电话核实。' },
  { level: 'low', time: '13:39', text: '西部枢纽夜班运力缺口 6 辆，系统已向 3 家承运商推送抢单需求。' },
  { level: 'mid', time: '13:22', text: '双十一大促预分拣完成 62%，较排期滞后 8%，建议增派 2 组分拣人力。' },
];

var CONTROL_RESET_CSS = [
  '.oyd-screen-page{--sc-focus:#2DD4BF;--sc-focus-ring:rgba(45,212,191,.22);--sc-border:rgba(148,197,255,.18);}',
  '.oyd-screen-page .oyd-select-trigger{appearance:none;-webkit-appearance:none;font-family:inherit;color:#DCEAFB;outline:none!important;box-shadow:none;display:flex;align-items:center;justify-content:space-between;gap:8px;}',
  '.oyd-screen-page .oyd-select-trigger:hover{border-color:var(--sc-focus)!important;}',
  '.oyd-screen-page .oyd-select-trigger[aria-expanded="true"]{border-color:var(--sc-focus)!important;box-shadow:0 0 0 3px var(--sc-focus-ring)!important;}',
  '.oyd-screen-page .oyd-select-arrow{width:14px!important;height:14px!important;color:#7FA6CE;transition:transform .16s ease;flex:0 0 14px;display:block;}',
  '.oyd-screen-page .oyd-select-trigger[aria-expanded="true"] .oyd-select-arrow{transform:rotate(180deg);color:var(--sc-focus);}',
].join('');

var _customState = {
  region: 'all',
  openDropdown: '',
};

export function getCustomState(key) {
  if (key) { return _customState[key]; }
  return Object.assign({}, _customState);
}

export function setCustomState(newState) {
  Object.keys(newState || {}).forEach((key) => { _customState[key] = newState[key]; });
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

export function injectControlReset() {
  var id = 'openyida-screen-control-reset';
  var style = document.getElementById(id);
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  style.innerHTML = CONTROL_RESET_CSS;
}

export function didMount() {
  this.injectControlReset();
}

export function didUnmount() {}

export function findOption(options, value) {
  var matched = (options || []).filter((option) => option.value === value);
  return matched[0] || null;
}

export function toggleDropdown(key) {
  _customState.openDropdown = _customState.openDropdown === key ? '' : key;
  this.forceUpdate();
}

export function chooseRegion(value) {
  _customState.region = value;
  _customState.openDropdown = '';
  this.forceUpdate();
}

export function renderRegionDropdown(colors, radius) {
  var self = this;
  var open = this.getCustomState('openDropdown') === 'region';
  var selected = this.findOption(REGION_OPTIONS, this.getCustomState('region'));
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="oyd-select-trigger" style={{ minWidth: 112, height: 34, border: '1px solid ' + colors.line, borderRadius: radius.control, background: colors.panelSoft, padding: '0 12px', fontSize: 13, fontWeight: 600, color: colors.ink, cursor: 'pointer' }} aria-expanded={open} onClick={(e) => { self.toggleDropdown('region'); }}>
        <span>{selected ? selected.label : '选择区域'}</span>
        <svg className="oyd-select-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 6.1a.7.7 0 0 1 1 0L8 8.9l2.8-2.8a.7.7 0 1 1 1 1L8.5 11.4a.7.7 0 0 1-1 0L4.2 7.1a.7.7 0 0 1 0-1z" fill="currentColor" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 40, marginTop: 6, right: 0, width: 132, background: colors.panel, border: '1px solid ' + colors.line, borderRadius: radius.menu, padding: 6, boxShadow: '0 18px 40px rgba(2,10,25,0.5)' }} role="listbox">
          {REGION_OPTIONS.map((option) => {
            var active = option.value === self.getCustomState('region');
            return (
              <button key={option.value} type="button" style={{ display: 'block', width: '100%', minHeight: 32, padding: '0 12px', border: 0, borderRadius: 6, background: active ? colors.accentSoft : 'transparent', color: active ? colors.accent : colors.ink, fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left', lineHeight: '32px' }} onClick={(e) => { self.chooseRegion(option.value); }}>{option.label}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function renderJsx() {
  var self = this;
  var state = self.getCustomState();
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;

  var colors = {
    ink: '#EAF2FC', inkSoft: '#9DB4D0', muted: '#6C83A2',
    bg: '#0A1224', panel: '#111C34', panelSoft: '#16233F', line: 'rgba(148,197,255,0.14)', lineSoft: 'rgba(148,197,255,0.08)',
    accent: '#2DD4BF', accentSoft: 'rgba(45,212,191,0.14)',
    blue: '#38BDF8', amber: '#FBBF24', red: '#F87171', green: '#34D399',
  };
  var radius = { card: 14, control: 8, menu: 10 };

  var selectedRegion = self.findOption(REGION_OPTIONS, state.region);
  var maxRegion = REGIONS.reduce((acc, cur) => (cur.volume > acc ? cur.volume : acc), 1);
  var maxTrend = TREND.reduce((acc, cur) => (cur.v > acc ? cur.v : acc), 1);
  var minTrend = TREND.reduce((acc, cur) => (cur.v < acc ? cur.v : acc), maxTrend);
  var vehicleTotal = VEHICLE.reduce((acc, cur) => acc + cur.value, 0) || 1;

  var trendColor = function (t) {
    if (t === 'bad') { return colors.red; }
    return colors.green;
  };

  // 折线趋势的 SVG 折线点
  var chartW = 520;
  var chartH = 150;
  var span = maxTrend - minTrend || 1;
  var points = TREND.map((d, i) => {
    var x = (i / (TREND.length - 1)) * chartW;
    var y = chartH - ((d.v - minTrend) / span) * (chartH - 20) - 10;
    return { x: x, y: y, t: d.t, v: d.v };
  });
  var linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  var areaPath = linePath + ' L' + chartW + ' ' + chartH + ' L0 ' + chartH + ' Z';

  // 车辆状态环形（累积角度）
  var acc = 0;
  var arcs = VEHICLE.map((v) => {
    var frac = v.value / vehicleTotal;
    var seg = { color: v.color, name: v.name, value: v.value, offset: acc, frac: frac };
    acc += frac;
    return seg;
  });
  var circ = 2 * Math.PI * 52;

  var styles = {
    page: { minHeight: '100vh', background: 'radial-gradient(1200px 600px at 20% -10%, #16264a 0%, ' + colors.bg + ' 55%)', color: colors.ink, fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif', fontSize: 14, padding: isMobile ? '14px' : '22px 26px', boxSizing: 'border-box' },
    shell: { maxWidth: 1240, margin: '0 auto' },
    card: { background: colors.panel, border: '1px solid ' + colors.line, borderRadius: radius.card, boxShadow: '0 1px 0 rgba(148,197,255,0.05) inset' },
    sectionTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: colors.ink, letterSpacing: 0.3 },
  };

  return (
    <div className="oyd-page oyd-screen-page" style={styles.page}>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>
      <div style={styles.shell}>
        {/* 顶部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: colors.accent, boxShadow: '0 0 12px ' + colors.accent }}></span>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: 1 }}>全国物流实时调度监控</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: colors.inkSoft }}>范围 {selectedRegion ? selectedRegion.label : '全国'} · 实时刷新</span>
            {self.renderRegionDropdown(colors, radius)}
          </div>
        </div>

        {/* KPI 指标条 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 12, marginBottom: 14 }}>
          {KPI.map((m) => (
            <div key={m.key} style={Object.assign({}, styles.card, { padding: '14px 16px' })}>
              <div style={{ fontSize: 12, color: colors.inkSoft }}>{m.label}</div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: colors.ink }}>{m.value}</span>
                <span style={{ fontSize: 12, color: colors.muted }}>{m.unit}</span>
              </div>
              <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: trendColor(m.trend) }}>
                <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
                  {m.trend === 'bad'
                    ? (<path d="M8 3v9m0 0l3.5-3.5M8 12L4.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />)
                    : (<path d="M8 13V4m0 0L4.5 7.5M8 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />)}
                </svg>
                {m.delta}
              </div>
            </div>
          ))}
        </div>

        {/* 中区：区域分布 + 时效趋势 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) minmax(0,1.25fr)', gap: 14, marginBottom: 14 }}>
          {/* 区域运力 */}
          <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '18px 20px' })}>
            <h2 style={styles.sectionTitle}>区域运力分布</h2>
            <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
              {REGIONS.map((r) => (
                <div key={r.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: colors.ink, fontWeight: 600 }}>{r.name}</span>
                    <span style={{ color: colors.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{r.volume.toLocaleString()} 单 · 负载 {r.load}%</span>
                  </div>
                  <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: colors.lineSoft, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: ((r.volume / maxRegion) * 100) + '%', background: r.load >= 85 ? colors.red : r.load >= 70 ? colors.amber : colors.accent, borderRadius: 999 }}></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 时效趋势折线 */}
          <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '18px 20px' })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={styles.sectionTitle}>干线平均时效趋势</h2>
              <span style={{ fontSize: 12, color: colors.muted }}>近 12h · 单位 h</span>
            </div>
            <div style={{ marginTop: 16, width: '100%', overflow: 'hidden' }}>
              <svg viewBox={'0 0 ' + chartW + ' ' + (chartH + 22)} preserveAspectRatio="none" style={{ width: '100%', height: isMobile ? 140 : 172 }} aria-hidden="true">
                <defs>
                  <linearGradient id="oydScreenArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.accent} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#oydScreenArea)" />
                <path d={linePath} fill="none" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p) => (
                  <circle key={p.t} cx={p.x} cy={p.y} r="2.6" fill={colors.bg} stroke={colors.accent} strokeWidth="1.6" />
                ))}
                {points.map((p) => (
                  <text key={'lbl' + p.t} x={p.x} y={chartH + 16} fontSize="10" fill={colors.muted} textAnchor="middle">{p.t}</text>
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* 底区：车辆状态环 + 告警流 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,0.9fr) minmax(0,1.4fr)', gap: 14 }}>
          {/* 车辆状态环 */}
          <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '18px 20px' })}>
            <h2 style={styles.sectionTitle}>车辆状态分布</h2>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ position: 'relative', width: 132, height: 132, flex: '0 0 132px' }}>
                <svg width="132" height="132" viewBox="0 0 132 132">
                  <circle cx="66" cy="66" r="52" fill="none" stroke={colors.lineSoft} strokeWidth="14" />
                  {arcs.map((a) => (
                    <circle key={a.name} cx="66" cy="66" r="52" fill="none" stroke={a.color} strokeWidth="14"
                      strokeDasharray={(a.frac * circ).toFixed(1) + ' ' + circ} strokeDashoffset={(-a.offset * circ).toFixed(1)}
                      transform="rotate(-90 66 66)" strokeLinecap="butt" />
                  ))}
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: colors.ink, fontVariantNumeric: 'tabular-nums' }}>{vehicleTotal.toLocaleString()}</span>
                  <span style={{ fontSize: 11, color: colors.muted }}>在线车辆</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'grid', gap: 9 }}>
                {VEHICLE.map((v) => (
                  <div key={v.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: colors.inkSoft }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: v.color }}></span>{v.name}
                    </span>
                    <span style={{ color: colors.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 实时告警流 */}
          <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '18px 20px' })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={styles.sectionTitle}>实时异常告警</h2>
              <span style={{ fontSize: 12, color: colors.muted }}>近 1 小时 {ALERTS.length} 条</span>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {ALERTS.map((a, idx) => {
                var c = a.level === 'high' ? colors.red : a.level === 'mid' ? colors.amber : colors.blue;
                var tag = a.level === 'high' ? '高危' : a.level === 'mid' ? '关注' : '提示';
                return (
                  <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid ' + colors.line, borderLeft: '3px solid ' + c, borderRadius: 10, background: colors.panelSoft, padding: '10px 12px' }}>
                    <span style={{ flex: '0 0 auto', height: 20, padding: '0 8px', borderRadius: 5, background: 'transparent', border: '1px solid ' + c, color: c, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{tag}</span>
                    <span style={{ flex: '0 0 auto', fontSize: 12, color: colors.muted, fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{a.time}</span>
                    <span style={{ fontSize: 13, lineHeight: '20px', color: colors.ink }}>{a.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
