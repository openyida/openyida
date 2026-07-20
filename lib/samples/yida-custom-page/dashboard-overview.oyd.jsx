/**
 * 电商经营看板（dashboard 场景 · 原生自定义页面示例 · dashboard-overview）
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 真实业务对象：电商经营看板。KPI 指标（带单位/环比）+ 7 日趋势 + 渠道排行
 * + 转化漏斗 + 经营洞察，对齐 canvas 的 dashboard-overview。纯 CSS 图形，
 * 不依赖 ECharts，保证 sample 稳定可发布。
 *
 * 页面级独立主题（翡翠绿），零 emoji，数值全部带量级与正负号。
 */

var PERIOD_OPTIONS = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '近 7 日' },
  { value: 'month', label: '本月' },
];

// 各周期 KPI，切换周期时联动
var KPI_DATA = {
  today: [
    { key: 'gmv', label: '成交金额', value: '38.6', unit: '万元', delta: '+9.2%', trend: 'up' },
    { key: 'orders', label: '成交订单', value: '1,284', unit: '笔', delta: '+6.1%', trend: 'up' },
    { key: 'aov', label: '客单价', value: '300', unit: '元', delta: '+2.9%', trend: 'up' },
    { key: 'refund', label: '退款率', value: '3.4', unit: '%', delta: '+0.6pt', trend: 'bad' },
  ],
  week: [
    { key: 'gmv', label: '成交金额', value: '246.8', unit: '万元', delta: '+12.7%', trend: 'up' },
    { key: 'orders', label: '成交订单', value: '8,912', unit: '笔', delta: '+8.4%', trend: 'up' },
    { key: 'aov', label: '客单价', value: '277', unit: '元', delta: '+3.9%', trend: 'up' },
    { key: 'refund', label: '退款率', value: '2.9', unit: '%', delta: '-0.4pt', trend: 'up' },
  ],
  month: [
    { key: 'gmv', label: '成交金额', value: '1,036', unit: '万元', delta: '+15.3%', trend: 'up' },
    { key: 'orders', label: '成交订单', value: '37,640', unit: '笔', delta: '+10.2%', trend: 'up' },
    { key: 'aov', label: '客单价', value: '275', unit: '元', delta: '+4.6%', trend: 'up' },
    { key: 'refund', label: '退款率', value: '3.1', unit: '%', delta: '-0.2pt', trend: 'up' },
  ],
};

// 近 7 日成交额（万元）
var TREND = [
  { day: '周一', value: 31.2 },
  { day: '周二', value: 34.8 },
  { day: '周三', value: 29.6 },
  { day: '周四', value: 40.1 },
  { day: '周五', value: 44.7 },
  { day: '周六', value: 52.3 },
  { day: '周日', value: 38.6 },
];

// 渠道销售排行
var CHANNELS = [
  { name: '天猫旗舰店', value: 96.4, share: 39 },
  { name: '抖音小店', value: 71.2, share: 29 },
  { name: '京东自营', value: 48.9, share: 20 },
  { name: '微信小程序', value: 30.3, share: 12 },
];

// 转化漏斗
var FUNNEL = [
  { name: '访问', value: 128600, rate: '100%' },
  { name: '加购', value: 41520, rate: '32.3%' },
  { name: '下单', value: 12840, rate: '10.0%' },
  { name: '支付', value: 11056, rate: '8.6%' },
];

// 经营洞察（具体、可执行，不写空话）
var INSIGHTS = [
  { level: 'up', text: '抖音小店 GMV 周环比 +34%，直播时段贡献 62%，建议追加下周三晚黄金档排期。' },
  { level: 'warn', text: '母婴类目退款率升至 5.8%，集中在「奶瓶 A3」尺寸描述，需补充详情页规格图。' },
  { level: 'down', text: '微信小程序转化率 1.9% 低于均值，落地页首屏加载 3.2s，建议压缩主图体积。' },
];

var CONTROL_RESET_CSS = [
  '.oyd-dash-page{--dh-focus:#1F8A5B;--dh-focus-ring:rgba(31,138,91,.16);--dh-border:#DCE4DF;}',
  '.oyd-dash-page .oyd-select-trigger{appearance:none;-webkit-appearance:none;font-family:inherit;color:#17241D;outline:none!important;box-shadow:none;display:flex;align-items:center;justify-content:space-between;gap:8px;}',
  '.oyd-dash-page .oyd-select-trigger:hover{border-color:var(--dh-focus)!important;}',
  '.oyd-dash-page .oyd-select-trigger[aria-expanded="true"]{border-color:var(--dh-focus)!important;box-shadow:0 0 0 3px var(--dh-focus-ring)!important;}',
  '.oyd-dash-page .oyd-select-arrow{width:14px!important;height:14px!important;color:#5C6B62;transition:transform .16s ease;flex:0 0 14px;display:block;}',
  '.oyd-dash-page .oyd-select-trigger[aria-expanded="true"] .oyd-select-arrow{transform:rotate(180deg);color:var(--dh-focus);}',
].join('');

var _customState = {
  period: 'week',
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
  var id = 'openyida-dash-control-reset';
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

export function choosePeriod(value) {
  _customState.period = value;
  _customState.openDropdown = '';
  this.forceUpdate();
}

export function refreshData() {
  this.utils.toast({ title: '已刷新经营数据（示例为静态演示数据）', type: 'success' });
}

export function renderPeriodDropdown(colors, radius) {
  var self = this;
  var open = this.getCustomState('openDropdown') === 'period';
  var selected = this.findOption(PERIOD_OPTIONS, this.getCustomState('period'));
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="oyd-select-trigger" style={{ minWidth: 120, height: 36, border: '1px solid ' + colors.line, borderRadius: radius.control, background: '#FFFFFF', padding: '0 12px', fontSize: 13, fontWeight: 600, color: colors.ink, cursor: 'pointer' }} aria-expanded={open} onClick={(e) => { self.toggleDropdown('period'); }}>
        <span>{selected ? selected.label : '选择周期'}</span>
        <svg className="oyd-select-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 6.1a.7.7 0 0 1 1 0L8 8.9l2.8-2.8a.7.7 0 1 1 1 1L8.5 11.4a.7.7 0 0 1-1 0L4.2 7.1a.7.7 0 0 1 0-1z" fill="currentColor" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 40, marginTop: 6, right: 0, width: 140, background: '#FFFFFF', border: '1px solid ' + colors.line, borderRadius: radius.menu, padding: 6, boxShadow: '0 16px 34px rgba(23,36,29,0.14)' }} role="listbox">
          {PERIOD_OPTIONS.map((option) => {
            var active = option.value === self.getCustomState('period');
            return (
              <button key={option.value} type="button" style={{ display: 'block', width: '100%', minHeight: 34, padding: '0 12px', border: 0, borderRadius: 6, background: active ? colors.primarySoft : '#FFFFFF', color: active ? colors.primary : colors.ink, fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left', lineHeight: '34px' }} onClick={(e) => { self.choosePeriod(option.value); }}>{option.label}</button>
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
    ink: '#17241D', inkSoft: '#4E5C54', muted: '#84918A',
    bg: '#F3F6F4', surface: '#FFFFFF', line: '#E2E8E4', lineSoft: '#EEF2EF', chipBg: '#EAF0EC',
    primary: '#1F8A5B', primarySoft: '#E7F4EE', primaryDeep: '#166B46',
    success: '#2E9E6B', successBg: '#EAF6EF',
    warning: '#C77B2C', warningBg: '#FBF1E3',
    danger: '#C6453B', dangerBg: '#FBECEA',
  };
  var radius = { card: 14, control: 8, menu: 10 };

  var trendColor = function (t) {
    if (t === 'bad') { return colors.danger; }
    if (t === 'down') { return colors.inkSoft; }
    return colors.success;
  };

  var kpis = KPI_DATA[state.period] || KPI_DATA.week;
  var selectedPeriod = self.findOption(PERIOD_OPTIONS, state.period);
  var maxTrend = TREND.reduce((acc, cur) => (cur.value > acc ? cur.value : acc), 1);
  var maxChannel = CHANNELS.reduce((acc, cur) => (cur.value > acc ? cur.value : acc), 1);
  var maxFunnel = FUNNEL[0].value || 1;

  var styles = {
    page: { minHeight: '100vh', background: colors.bg, color: colors.ink, fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif', fontSize: 14, padding: isMobile ? '14px' : '22px 28px', boxSizing: 'border-box' },
    shell: { maxWidth: 1180, margin: '0 auto' },
    card: { background: colors.surface, border: '1px solid ' + colors.line, borderRadius: radius.card, boxShadow: '0 1px 2px rgba(23,36,29,0.04)' },
    sectionTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: colors.ink },
  };

  return (
    <div className="oyd-page oyd-dash-page" style={styles.page}>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>
      <div style={styles.shell}>
        {/* 顶部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 800 }}>电商经营看板</h1>
            <div style={{ marginTop: 6, fontSize: 13, color: colors.inkSoft }}>周期：{selectedPeriod ? selectedPeriod.label : '近 7 日'} · 数据截至 今日 14:00 · 含全渠道</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {self.renderPeriodDropdown(colors, radius)}
            <button type="button" style={{ height: 36, padding: '0 14px', border: '1px solid ' + colors.line, borderRadius: radius.control, background: '#FFFFFF', color: colors.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={(e) => { self.refreshData(); }}>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v2h-2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              刷新
            </button>
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
          {kpis.map((m) => (
            <div key={m.key} style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '16px 18px' })}>
              <div style={{ fontSize: 13, color: colors.inkSoft }}>{m.label}</div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
                <span style={{ fontSize: 13, color: colors.muted }}>{m.unit}</span>
              </div>
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: trendColor(m.trend) }}>
                <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                  {m.trend === 'bad' || m.trend === 'down'
                    ? (<path d="M8 3v9m0 0l3.5-3.5M8 12L4.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />)
                    : (<path d="M8 13V4m0 0L4.5 7.5M8 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />)}
                </svg>
                {m.delta}
                <span style={{ color: colors.muted, fontWeight: 400 }}>环比</span>
              </div>
            </div>
          ))}
        </div>

        {/* 趋势 + 渠道 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1.3fr) minmax(0,1fr)', gap: 14, marginBottom: 14 }}>
          {/* 趋势柱状 */}
          <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '18px 20px' })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={styles.sectionTitle}>近 7 日成交金额</h2>
              <span style={{ fontSize: 12, color: colors.muted }}>单位：万元</span>
            </div>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 6 : 12, height: 180 }}>
              {TREND.map((d) => {
                var h = Math.round((d.value / maxTrend) * 140) + 8;
                var isPeak = d.value === maxTrend;
                return (
                  <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: isPeak ? colors.primary : colors.inkSoft }}>{d.value}</span>
                    <div style={{ width: '100%', maxWidth: 34, height: h, borderRadius: '6px 6px 0 0', background: isPeak ? colors.primary : colors.primarySoft }}></div>
                    <span style={{ fontSize: 11, color: colors.muted }}>{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 渠道排行 */}
          <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '18px 20px' })}>
            <h2 style={styles.sectionTitle}>渠道销售排行</h2>
            <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
              {CHANNELS.map((ch, idx) => (
                <div key={ch.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: colors.ink }}><span style={{ display: 'inline-block', width: 18, color: colors.muted, fontWeight: 700 }}>{idx + 1}</span>{ch.name}</span>
                    <span style={{ color: colors.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{ch.value} 万 · {ch.share}%</span>
                  </div>
                  <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: colors.chipBg, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: ((ch.value / maxChannel) * 100) + '%', background: idx === 0 ? colors.primary : colors.primaryDeep, opacity: idx === 0 ? 1 : 0.55, borderRadius: 999 }}></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 漏斗 + 洞察 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) minmax(0,1.2fr)', gap: 14 }}>
          {/* 转化漏斗 */}
          <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '18px 20px' })}>
            <h2 style={styles.sectionTitle}>转化漏斗</h2>
            <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
              {FUNNEL.map((f, idx) => (
                <div key={f.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: colors.ink, fontWeight: 600 }}>{f.name}</span>
                    <span style={{ color: colors.inkSoft }}>{f.value.toLocaleString()} · {f.rate}</span>
                  </div>
                  <div style={{ height: 26, borderRadius: 6, background: colors.chipBg, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: ((f.value / maxFunnel) * 100) + '%', background: colors.primary, opacity: 1 - idx * 0.18, borderRadius: 6 }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 经营洞察 */}
          <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '18px 20px' })}>
            <h2 style={styles.sectionTitle}>经营洞察</h2>
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              {INSIGHTS.map((ins, idx) => {
                var c = ins.level === 'up' ? colors.success : ins.level === 'warn' ? colors.warning : colors.danger;
                var cbg = ins.level === 'up' ? colors.successBg : ins.level === 'warn' ? colors.warningBg : colors.dangerBg;
                var tag = ins.level === 'up' ? '增长' : ins.level === 'warn' ? '关注' : '待优化';
                return (
                  <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid ' + colors.lineSoft, borderLeft: '3px solid ' + c, borderRadius: 10, background: cbg, padding: '12px 14px' }}>
                    <span style={{ flex: '0 0 auto', height: 20, padding: '0 8px', borderRadius: 5, background: '#FFFFFF', color: c, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{tag}</span>
                    <span style={{ fontSize: 13, lineHeight: '21px', color: colors.ink }}>{ins.text}</span>
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
