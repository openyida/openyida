/**
 * 售后服务调度台（家电售后场景 · 原生自定义页面示例 · workbench-home 场景）
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 目标：给出一个「真实用户消费场景」的 native JSX 工作台样例，替代通用的
 * "Hello / Ask AI" 型 AI 味页面。全部内容围绕一个具体业务对象——家电售后
 * 服务工单的接入、派单、SLA 跟踪与坐席协同展开。
 *
 * 设计要点（去 AI 味）：
 * - 页面级独立主题（钢青蓝主色 + 琥珀强调），不继承宿主 App 主题，也不用蓝紫科技渐变
 * - 零 emoji，图标一律功能性内联 SVG，卡片标题为纯文字
 * - KPI 全部带单位、量级与环比，不出现裸数字
 * - 数据为具体的机型 / 故障 / 地区 / 工程师 / SLA 倒计时，可替换测试
 * - 交互真实可用：班次切换、队列 Tab 筛选、关键字搜索、工单受理 / 派单流转
 *
 * 发布：
 *   openyida check-page project/pages/src/service-dispatch-console.oyd.jsx
 *   openyida compile   project/pages/src/service-dispatch-console.oyd.jsx
 *   openyida publish    project/pages/src/service-dispatch-console.oyd.jsx APP_XXX FORM-XXX
 */

// ── 表单占位（接入真实表单后替换为 get-schema 输出的 fieldId） ──
var FIELDS = {
  ticketForm: 'FORM-XXX',
};

// ── 班次切换（自定义下拉，禁止原生 select） ──
var SHIFT_OPTIONS = [
  { value: 'huadong2', label: '华东二组 · 白班' },
  { value: 'huadong3', label: '华东三组 · 晚班' },
  { value: 'huanan1', label: '华南一组 · 白班' },
];

// ── 队列筛选 Tab ──
var TAB_OPTIONS = [
  { value: 'all', label: '全部工单' },
  { value: 'pending', label: '待派单' },
  { value: 'processing', label: '处理中' },
  { value: 'overtime', label: '已超时' },
];

// ── 顶部 KPI 指标（带单位 / 环比，禁止裸数字） ──
var METRICS = [
  { key: 'inflow', label: '今日进线', value: '186', unit: '单', delta: '+12.4%', trend: 'up', hint: '较昨日同时段' },
  { key: 'pending', label: '待派单', value: '23', unit: '单', delta: '-5 单', trend: 'down', hint: '30 分钟内需派完' },
  { key: 'processing', label: '处理中', value: '68', unit: '单', delta: '+9 单', trend: 'up', hint: '含上门 / 远程' },
  { key: 'overtime', label: '超时预警', value: '4', unit: '单', delta: '+2 单', trend: 'bad', hint: '已触发 SLA 升级' },
  { key: 'closeRate', label: '当日完结率', value: '82.6', unit: '%', delta: '+3.1pt', trend: 'up', hint: '目标 85%' },
  { key: 'firstResp', label: '平均首响', value: '6.2', unit: '分钟', delta: '-1.4 分', trend: 'up', hint: '接入到派单' },
];

// ── 工单队列（真实机型 / 故障 / 地区 / 工程师 / SLA 倒计时） ──
var TICKETS = [
  { id: 'SO-240718-0421', customer: '张女士', model: '海尔 滚筒洗衣机 EG100', fault: '不脱水，滚筒有异响', faultType: '机械故障', region: '杭州 · 拱墅区', channel: '电话进线', engineer: '', sla: '00:28', slaLevel: 'urgent', status: 'pending' },
  { id: 'SO-240718-0418', customer: '城西万象城 海尔专柜', model: '变频空调 KFR-35GW', fault: '整机不制冷，显示 E4', faultType: '制冷系统', region: '杭州 · 余杭区', channel: '门店报修', engineer: '', sla: '00:52', slaLevel: 'urgent', status: 'pending' },
  { id: 'SO-240718-0402', customer: '李先生', model: '对开门冰箱 BCD-470', fault: '冷藏室不制冷，冷冻正常', faultType: '制冷系统', region: '宁波 · 海曙区', channel: '小程序自助', engineer: '周敏', sla: '02:15', slaLevel: 'warn', status: 'processing' },
  { id: 'SO-240718-0389', customer: '王先生', model: '油烟机 CXW-260', fault: '吸力明显下降，噪音大', faultType: '功能异常', region: '苏州 · 工业园区', channel: '电话进线', engineer: '郑凯', sla: '03:40', slaLevel: 'normal', status: 'processing' },
  { id: 'SO-240718-0361', customer: '悦享公寓 (企业客户)', model: '热水器 JSQ30 x6 台', fault: '批量点火失败，需上门排查', faultType: '批量工单', region: '南京 · 建邺区', channel: '客户经理', engineer: '许文博', sla: '05:10', slaLevel: 'normal', status: 'processing' },
  { id: 'SO-240717-0295', customer: '陈女士', model: '洗碗机 EW13918', fault: '进水报警，无法启动', faultType: '进排水', region: '合肥 · 蜀山区', channel: '电话进线', engineer: '周敏', sla: '-00:34', slaLevel: 'over', status: 'overtime' },
  { id: 'SO-240717-0288', customer: '赵先生', model: '中央空调 多联机', fault: '外机停机保护，反复报错', faultType: '制冷系统', region: '杭州 · 滨江区', channel: '门店报修', engineer: '郑凯', sla: '-01:12', slaLevel: 'over', status: 'overtime' },
];

// ── 工程师负载（进度条，反映当班压力分布） ──
var ENGINEERS = [
  { name: '周敏', area: '杭州北线', load: 6, capacity: 8, status: '在途' },
  { name: '郑凯', area: '杭州南线', load: 7, capacity: 8, status: '在途' },
  { name: '许文博', area: '南京 / 苏州', load: 4, capacity: 8, status: '空闲' },
  { name: '林岚', area: '宁波 / 绍兴', load: 5, capacity: 8, status: '待命' },
];

// ── SLA 预警清单（即将超时优先处理） ──
var SLA_ALERTS = [
  { id: 'SO-240718-0421', text: '张女士 · 洗衣机不脱水', left: '28 分钟内派单', level: 'urgent' },
  { id: 'SO-240718-0418', text: '海尔专柜 · 空调 E4', left: '52 分钟内派单', level: 'urgent' },
  { id: 'SO-240717-0295', text: '陈女士 · 洗碗机进水报警', left: '已超时 34 分钟', level: 'over' },
];

// ── 区域工单分布（横向条形，纯 CSS） ──
var REGION_DIST = [
  { name: '杭州', value: 74 },
  { name: '宁波', value: 38 },
  { name: '苏州', value: 31 },
  { name: '南京', value: 27 },
  { name: '合肥', value: 16 },
];

// ── 快捷入口 ──
var QUICK_ENTRIES = [
  { key: 'part', title: '配件申领', desc: '本班待领 5 项' },
  { key: 'kb', title: '维修知识库', desc: 'E4 报错处置手册' },
  { key: 'revisit', title: '回访任务', desc: '今日待回访 12 单' },
];

// ── native 控件样式 reset（页面专属作用域，避免多 native 页互相污染） ──
var CONTROL_RESET_CSS = [
  '.oyd-dispatch-page{--dp-focus:#2E4A7A;--dp-focus-ring:rgba(46,74,122,.16);--dp-border:#D8DDE6;--dp-selected-bg:rgba(46,74,122,.08);}',
  '.oyd-dispatch-page input,.oyd-dispatch-page textarea,.oyd-dispatch-page .oyd-select-trigger{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:400;color:#1C2530;outline:none!important;box-shadow:none;}',
  '.oyd-dispatch-page input,.oyd-dispatch-page textarea{border:1px solid var(--dp-border);border-radius:8px;background:#fff;}',
  '.oyd-dispatch-page input:hover,.oyd-dispatch-page .oyd-select-trigger:hover{border-color:var(--dp-focus)!important;}',
  '.oyd-dispatch-page input:focus,.oyd-dispatch-page textarea:focus,.oyd-dispatch-page .oyd-select-trigger:focus{border-color:var(--dp-focus)!important;outline:none!important;box-shadow:0 0 0 3px var(--dp-focus-ring)!important;}',
  '.oyd-dispatch-page .oyd-select-trigger[aria-expanded="true"]{border-color:var(--dp-focus)!important;box-shadow:0 0 0 3px var(--dp-focus-ring)!important;}',
  '.oyd-dispatch-page .oyd-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
  '.oyd-dispatch-page .oyd-select-arrow{width:14px!important;height:14px!important;color:#5A6675;transition:transform .16s ease;flex:0 0 14px;display:block;}',
  '.oyd-dispatch-page .oyd-select-trigger[aria-expanded="true"] .oyd-select-arrow{transform:rotate(180deg);color:var(--dp-focus);}',
  '.oyd-dispatch-page .oyd-select-option{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
].join('');

function cloneTickets(list) {
  return (list || []).map((item) => Object.assign({}, item));
}

var _customState = {
  activeTab: 'all',
  shift: 'huadong2',
  openDropdown: '',
  keyword: '',
  appliedKeyword: '',
  tickets: cloneTickets(TICKETS),
  _isComposing: false,
};

export function getCustomState(key) {
  if (key) {
    return _customState[key];
  }
  return Object.assign({}, _customState);
}

export function setCustomState(newState) {
  Object.keys(newState || {}).forEach((key) => {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

export function injectControlReset() {
  var id = 'openyida-dispatch-control-reset';
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

export function chooseShift(value) {
  var option = this.findOption(SHIFT_OPTIONS, value);
  _customState.shift = value;
  _customState.openDropdown = '';
  this.forceUpdate();
  if (option) {
    this.utils.toast({ title: '已切换到 ' + option.label, type: 'success' });
  }
}

export function setTab(value) {
  this.setCustomState({ activeTab: value });
}

export function handleSearchInput(e) {
  if (_customState._isComposing) {
    return;
  }
  _customState.keyword = e && e.target ? e.target.value : '';
}

export function applySearch(e) {
  if (e && e.type === 'keydown' && e.key !== 'Enter' && e.keyCode !== 13) {
    return;
  }
  this.setCustomState({ appliedKeyword: (_customState.keyword || '').trim() });
}

export function acceptTicket(id) {
  var nextList = (this.getCustomState('tickets') || []).map((item) => {
    if (item.id === id) {
      return Object.assign({}, item, { status: 'processing', engineer: item.engineer || '待指派', slaLevel: 'warn' });
    }
    return item;
  });
  this.setCustomState({ tickets: nextList });
  this.utils.toast({ title: '工单 ' + id + ' 已受理，进入处理中', type: 'success' });
}

export function dispatchTicket(id) {
  this.utils.toast({ title: '已推送派单：' + id + '，请在工程师端确认接单', type: 'success' });
}

export function openNewTicket() {
  if (!FIELDS.ticketForm || FIELDS.ticketForm === 'FORM-XXX') {
    this.utils.toast({ title: '示例页未绑定工单表单，接入真实 formUuid 后可直接跳转录入', type: 'warning' });
    return;
  }
  this.utils.router.push(FIELDS.ticketForm, {}, false);
}

export function openEntry(key) {
  var map = {
    part: '配件申领',
    kb: '维修知识库',
    revisit: '回访任务',
  };
  this.utils.toast({ title: '打开「' + (map[key] || '快捷入口') + '」（示例页占位）', type: 'info' });
}

export function focusAlert(id) {
  this.setCustomState({ activeTab: 'all', appliedKeyword: id });
  var input = document.getElementById('dispatch-search-input');
  if (input) {
    input.value = id;
    _customState.keyword = id;
  }
}

export function getVisibleTickets() {
  var state = this.getCustomState();
  var list = state.tickets || [];
  if (state.activeTab !== 'all') {
    list = list.filter((item) => item.status === state.activeTab);
  }
  var kw = (state.appliedKeyword || '').toLowerCase();
  if (kw) {
    list = list.filter((item) => {
      var hay = (item.id + ' ' + item.customer + ' ' + item.model + ' ' + item.fault + ' ' + item.region).toLowerCase();
      return hay.indexOf(kw) >= 0;
    });
  }
  return list;
}

export function countByStatus(status) {
  var list = this.getCustomState('tickets') || [];
  if (status === 'all') {
    return list.length;
  }
  return list.filter((item) => item.status === status).length;
}

export function renderShiftDropdown(colors, radius) {
  var self = this;
  var open = this.getCustomState('openDropdown') === 'shift';
  var selected = this.findOption(SHIFT_OPTIONS, this.getCustomState('shift'));

  var triggerStyle = {
    minWidth: 176,
    height: 38,
    border: '1px solid ' + colors.line,
    borderRadius: radius.control,
    background: '#FFFFFF',
    padding: '0 12px',
    fontSize: 14,
    fontWeight: 600,
    color: colors.ink,
    cursor: 'pointer',
  };
  var menuStyle = {
    position: 'absolute',
    zIndex: 40,
    marginTop: 6,
    right: 0,
    width: 220,
    background: '#FFFFFF',
    border: '1px solid ' + colors.line,
    borderRadius: radius.menu,
    padding: 6,
    boxShadow: '0 18px 38px rgba(28,37,48,0.14)',
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="oyd-select-trigger"
        style={triggerStyle}
        aria-expanded={open}
        onClick={(e) => { self.toggleDropdown('shift'); }}
      >
        <span>{selected ? selected.label : '选择班次'}</span>
        <svg className="oyd-select-arrow" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.2 6.1a.7.7 0 0 1 1 0L8 8.9l2.8-2.8a.7.7 0 1 1 1 1L8.5 11.4a.7.7 0 0 1-1 0L4.2 7.1a.7.7 0 0 1 0-1z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div style={menuStyle} role="listbox">
          {SHIFT_OPTIONS.map((option) => {
            var active = option.value === self.getCustomState('shift');
            var optStyle = {
              width: '100%',
              minHeight: 38,
              padding: '0 10px',
              border: 0,
              borderRadius: 8,
              background: active ? colors.primarySoft : '#FFFFFF',
              color: active ? colors.primary : colors.ink,
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              textAlign: 'left',
            };
            return (
              <button
                key={option.value}
                type="button"
                className="oyd-select-option"
                style={optStyle}
                onClick={(e) => { self.chooseShift(option.value); }}
              >
                <span>{option.label}</span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6.4 11.7a.7.7 0 0 1-1 0L2.9 9.2a.7.7 0 1 1 1-1l2 2 6-6a.7.7 0 1 1 1 1l-6.5 6.5z" fill="currentColor" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function renderTicketRow(item, colors, radius, isMobile) {
  var self = this;
  var slaColorMap = {
    urgent: colors.warning,
    warn: colors.accent,
    normal: colors.inkSoft,
    over: colors.danger,
  };
  var statusMap = {
    pending: { label: '待派单', color: colors.warning, bg: colors.warningBg },
    processing: { label: '处理中', color: colors.primary, bg: colors.primarySoft },
    overtime: { label: '已超时', color: colors.danger, bg: colors.dangerBg },
  };
  var st = statusMap[item.status] || statusMap.processing;
  var slaColor = slaColorMap[item.slaLevel] || colors.inkSoft;

  var rowStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2.4fr) 96px 120px 132px',
    gap: isMobile ? 8 : 12,
    alignItems: 'center',
    padding: isMobile ? '14px' : '14px 16px',
    borderBottom: '1px solid ' + colors.lineSoft,
    background: item.status === 'overtime' ? colors.dangerBg : '#FFFFFF',
  };

  return (
    <div key={item.id} style={rowStyle}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'SFMono-Regular, Menlo, monospace', fontSize: 12, color: colors.inkSoft }}>{item.id}</span>
          <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 5, background: colors.chipBg, color: colors.inkSoft, fontSize: 11, fontWeight: 600 }}>{item.faultType}</span>
          <span style={{ fontSize: 11, color: colors.muted }}>{item.channel}</span>
        </div>
        <div style={{ marginTop: 5, fontSize: 15, fontWeight: 700, color: colors.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.customer} · {item.model}
        </div>
        <div style={{ marginTop: 3, fontSize: 13, color: colors.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.fault} · {item.region}
        </div>
      </div>

      <div style={{ textAlign: isMobile ? 'left' : 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: slaColor, fontVariantNumeric: 'tabular-nums' }}>{item.sla}</div>
        <div style={{ fontSize: 11, color: colors.muted }}>{item.slaLevel === 'over' ? 'SLA 已超' : 'SLA 剩余'}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 24, padding: '0 10px', borderRadius: 6, background: st.bg, color: st.color, fontSize: 12, fontWeight: 700, width: 'fit-content' }}>{st.label}</span>
        <span style={{ fontSize: 12, color: colors.inkSoft }}>{item.engineer ? '工程师 ' + item.engineer : '未指派'}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
        {item.status === 'pending' ? (
          <button type="button" style={{ height: 32, padding: '0 14px', border: 0, borderRadius: radius.control, background: colors.primary, color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={(e) => { self.acceptTicket(item.id); }}>受理</button>
        ) : (
          <button type="button" style={{ height: 32, padding: '0 14px', border: '1px solid ' + colors.line, borderRadius: radius.control, background: '#FFFFFF', color: colors.ink, fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={(e) => { self.dispatchTicket(item.id); }}>派单</button>
        )}
      </div>
    </div>
  );
}

export function renderJsx() {
  var self = this;
  var state = self.getCustomState();
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;

  var colors = {
    ink: '#1C2530',
    inkSoft: '#5A6675',
    muted: '#8A94A3',
    bg: '#F4F3EF',
    surface: '#FFFFFF',
    line: '#E4E2DB',
    lineSoft: '#EEEDE7',
    chipBg: '#F0EFE9',
    primary: '#2E4A7A',
    primarySoft: '#EAF0FA',
    primaryDeep: '#223A63',
    accent: '#B5732A',
    accentSoft: '#F7EEDF',
    success: '#2E9E6B',
    successBg: '#EAF6EF',
    warning: '#C77B2C',
    warningBg: '#FBF1E3',
    danger: '#C6453B',
    dangerBg: '#FBECEA',
  };
  var radius = { card: 14, control: 8, menu: 12, pill: 999 };

  var trendColor = function (trend) {
    if (trend === 'bad') { return colors.danger; }
    if (trend === 'down') { return colors.inkSoft; }
    return colors.success;
  };

  var selectedShift = self.findOption(SHIFT_OPTIONS, state.shift);
  var visibleTickets = self.getVisibleTickets();
  var maxRegion = REGION_DIST.reduce((acc, cur) => (cur.value > acc ? cur.value : acc), 1);

  var styles = {
    page: {
      minHeight: '100vh',
      background: colors.bg,
      color: colors.ink,
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
      fontSize: 14,
      padding: isMobile ? '14px' : '22px 28px',
      boxSizing: 'border-box',
    },
    shell: { maxWidth: 1220, margin: '0 auto' },
    card: {
      background: colors.surface,
      border: '1px solid ' + colors.line,
      borderRadius: radius.card,
      boxShadow: '0 1px 2px rgba(28,37,48,0.04)',
    },
    sectionTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: colors.ink },
    sectionHint: { margin: 0, fontSize: 12, color: colors.muted },
  };

  var headerLeftBar = {
    width: 4,
    height: 42,
    borderRadius: 4,
    background: colors.primary,
    flex: '0 0 4px',
  };

  return (
    <div className="oyd-page oyd-dispatch-page" style={styles.page}>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>

      <div style={styles.shell}>
        {/* 顶部：标题 + 当班信息 + 主操作 */}
        <div style={Object.assign({}, styles.card, {
          padding: isMobile ? '16px' : '18px 22px',
          marginBottom: 14,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 16,
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
        })}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={headerLeftBar}></div>
            <div>
              <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 800, color: colors.ink }}>售后服务调度台</h1>
              <div style={{ marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: colors.inkSoft }}>
                <span>当班：{selectedShift ? selectedShift.label : '华东二组'}</span>
                <span>在线工程师 <strong style={{ color: colors.ink }}>8</strong> 人</span>
                <span style={{ color: colors.muted }}>数据截至 今日 14:20</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {self.renderShiftDropdown(colors, radius)}
            <button
              type="button"
              style={{ height: 38, padding: '0 18px', border: 0, borderRadius: radius.control, background: colors.primary, color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onClick={(e) => { self.openNewTicket(); }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" /></svg>
              新建服务工单
            </button>
          </div>
        </div>

        {/* KPI 指标条 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)',
          gap: isMobile ? 10 : 12,
          marginBottom: 14,
        }}>
          {METRICS.map((m) => (
            <div key={m.key} style={Object.assign({}, styles.card, { padding: isMobile ? '12px' : '14px 16px' })}>
              <div style={{ fontSize: 12, color: colors.inkSoft }}>{m.label}</div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: isMobile ? 22 : 24, fontWeight: 800, color: m.key === 'overtime' ? colors.danger : colors.ink, fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
                <span style={{ fontSize: 12, color: colors.muted }}>{m.unit}</span>
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: trendColor(m.trend) }}>{m.delta}</span>
                <span style={{ fontSize: 11, color: colors.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.hint}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 主体：左队列 + 右侧协同 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 340px',
          gap: 14,
        }}>
          {/* 左：工单队列 */}
          <div style={styles.card}>
            <div style={{ padding: isMobile ? '14px 14px 0' : '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={styles.sectionTitle}>工单队列</h2>
                <p style={Object.assign({}, styles.sectionHint, { marginTop: 4 })}>按 SLA 剩余时间优先处理，超时工单已置顶标红</p>
              </div>
              <div style={{ position: 'relative', width: isMobile ? '100%' : 240 }}>
                <input
                  id="dispatch-search-input"
                  type="text"
                  placeholder="搜索工单号 / 客户 / 机型"
                  defaultValue=""
                  style={{ width: '100%', height: 36, padding: '0 34px 0 12px', fontSize: 13, boxSizing: 'border-box' }}
                  onCompositionStart={() => { _customState._isComposing = true; }}
                  onCompositionEnd={(e) => { _customState._isComposing = false; self.handleSearchInput(e); }}
                  onChange={(e) => { self.handleSearchInput(e); }}
                  onKeyDown={(e) => { self.applySearch(e); }}
                />
                <button type="button" aria-label="搜索" style={{ position: 'absolute', right: 6, top: 6, width: 24, height: 24, border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }} onClick={(e) => { self.applySearch(e); }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke={colors.muted} strokeWidth="1.6" /><path d="M10.5 10.5L14 14" stroke={colors.muted} strokeWidth="1.6" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>

            {/* Tab 筛选 */}
            <div style={{ display: 'flex', gap: 6, padding: isMobile ? '12px 14px' : '14px 18px', flexWrap: 'wrap' }}>
              {TAB_OPTIONS.map((tab) => {
                var active = state.activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    style={{
                      height: 32,
                      padding: '0 14px',
                      border: '1px solid ' + (active ? colors.primary : colors.line),
                      borderRadius: radius.pill,
                      background: active ? colors.primarySoft : '#FFFFFF',
                      color: active ? colors.primary : colors.inkSoft,
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                    }}
                    onClick={(e) => { self.setTab(tab.value); }}
                  >
                    {tab.label} · {self.countByStatus(tab.value)}
                  </button>
                );
              })}
            </div>

            {/* 列表 */}
            <div style={{ borderTop: '1px solid ' + colors.lineSoft }}>
              {visibleTickets.length ? (
                visibleTickets.map((item) => self.renderTicketRow(item, colors, radius, isMobile))
              ) : (
                <div style={{ padding: '44px 16px', textAlign: 'center', color: colors.muted }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.inkSoft }}>当前筛选下没有工单</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>调整 Tab 或清空搜索关键字后再看</div>
                </div>
              )}
            </div>
          </div>

          {/* 右：协同侧栏 */}
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            {/* SLA 预警 */}
            <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '16px 18px' })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={styles.sectionTitle}>SLA 预警</h2>
                <span style={{ fontSize: 12, color: colors.danger, fontWeight: 700 }}>4 单待处理</span>
              </div>
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                {SLA_ALERTS.map((a) => {
                  var c = a.level === 'over' ? colors.danger : colors.warning;
                  var cbg = a.level === 'over' ? colors.dangerBg : colors.warningBg;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', width: '100%', border: '1px solid ' + colors.lineSoft, borderLeft: '3px solid ' + c, borderRadius: 10, background: cbg, padding: '10px 12px', cursor: 'pointer' }}
                      onClick={(e) => { self.focusAlert(a.id); }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: colors.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.text}</div>
                        <div style={{ marginTop: 3, fontSize: 12, fontWeight: 700, color: c }}>{a.left}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 工程师负载 */}
            <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '16px 18px' })}>
              <h2 style={styles.sectionTitle}>工程师负载</h2>
              <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                {ENGINEERS.map((eng) => {
                  var ratio = Math.min(1, eng.load / eng.capacity);
                  var barColor = ratio >= 0.85 ? colors.danger : ratio >= 0.6 ? colors.accent : colors.success;
                  return (
                    <div key={eng.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                        <span style={{ fontWeight: 700, color: colors.ink }}>{eng.name} <span style={{ fontWeight: 400, color: colors.muted }}>· {eng.area}</span></span>
                        <span style={{ color: colors.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{eng.load}/{eng.capacity} 单</span>
                      </div>
                      <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: colors.chipBg, overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: (ratio * 100) + '%', background: barColor, borderRadius: 999 }}></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 快捷入口 */}
            <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '16px 18px' })}>
              <h2 style={styles.sectionTitle}>快捷入口</h2>
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {QUICK_ENTRIES.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', border: '1px solid ' + colors.line, borderRadius: 10, background: '#FFFFFF', padding: '11px 14px', cursor: 'pointer', textAlign: 'left' }}
                    onClick={(e) => { self.openEntry(entry.key); }}
                  >
                    <span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: colors.ink }}>{entry.title}</span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: colors.muted }}>{entry.desc}</span>
                    </span>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke={colors.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 底部：区域工单分布 */}
        <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '18px 22px', marginTop: 14 })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={styles.sectionTitle}>今日区域工单分布</h2>
            <span style={styles.sectionHint}>共 186 单 · 华东片区在途占比 63%</span>
          </div>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            {REGION_DIST.map((r) => (
              <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 52px', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: colors.inkSoft }}>{r.name}</span>
                <span style={{ height: 12, borderRadius: 6, background: colors.chipBg, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: ((r.value / maxRegion) * 100) + '%', background: colors.primary, borderRadius: 6 }}></span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.value} 单</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
