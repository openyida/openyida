/**
 * 销售订单管理（list 场景 · 原生自定义页面示例 · business-list）
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 真实业务对象：B2B 销售订单。筛选栏 + 批量操作 + 数据表格 + 状态标签 +
 * 分页 + 空/加载态，是列表管理页最典型的闭环，用来对齐 canvas 的 business-list。
 *
 * 页面级独立主题（靛蓝），零 emoji，图标全部功能性内联 SVG，金额/数量带单位。
 */

var FIELDS = { orderForm: 'FORM-XXX' };

var STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'unpaid', label: '待付款' },
  { value: 'unshipped', label: '待发货' },
  { value: 'shipped', label: '已发货' },
  { value: 'done', label: '已完成' },
  { value: 'canceled', label: '已取消' },
];

var REGION_OPTIONS = [
  { value: 'all', label: '全部大区' },
  { value: 'east', label: '华东大区' },
  { value: 'south', label: '华南大区' },
  { value: 'north', label: '华北大区' },
  { value: 'west', label: '西南大区' },
];

var ORDERS = [
  { id: 'SO-2024-08017', customer: '杭州比邻智能科技', contact: '陈婷 · 采购', items: '工业路由器 R720 x40，配件包 x40', amount: 128600, qty: 80, region: '华东大区', owner: '林澈', date: '07-18 09:24', status: 'unpaid' },
  { id: 'SO-2024-08016', customer: '广州锐捷网络设备', contact: '黄工 · 技术', items: '千兆交换机 S2910 x12', amount: 43800, qty: 12, region: '华南大区', owner: '周岚', date: '07-18 08:51', status: 'unshipped' },
  { id: 'SO-2024-08012', customer: '南京云栖数据中心', contact: '许总 · 项目', items: '机柜 42U x6，理线架 x18', amount: 96400, qty: 24, region: '华东大区', owner: '林澈', date: '07-17 17:32', status: 'shipped' },
  { id: 'SO-2024-08008', customer: '成都天府软件园', contact: '刘敏 · 行政', items: '无线 AP AC1300 x60', amount: 71200, qty: 60, region: '西南大区', owner: '郑凯', date: '07-17 15:10', status: 'shipped' },
  { id: 'SO-2024-08003', customer: '北京中关村创投', contact: '赵磊 · IT', items: '防火墙 NGFW-3000 x2', amount: 58900, qty: 2, region: '华北大区', owner: '周岚', date: '07-17 11:46', status: 'done' },
  { id: 'SO-2024-07998', customer: '深圳前海金融科技', contact: '孙悦 · 采购', items: '光模块 10G x120', amount: 35600, qty: 120, region: '华南大区', owner: '郑凯', date: '07-16 16:20', status: 'done' },
  { id: 'SO-2024-07990', customer: '苏州工业园智造', contact: '吴桐 · 设备', items: 'PoE 交换机 x8（客户临时取消）', amount: 21400, qty: 8, region: '华东大区', owner: '林澈', date: '07-16 10:05', status: 'canceled' },
];

var PAGE_SIZE = 5;

var CONTROL_RESET_CSS = [
  '.oyd-order-page{--op-focus:#3B4AA0;--op-focus-ring:rgba(59,74,160,.16);--op-border:#D9DCE6;--op-selected:rgba(59,74,160,.08);}',
  '.oyd-order-page input,.oyd-order-page .oyd-select-trigger{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:400;color:#1C2333;outline:none!important;box-shadow:none;}',
  '.oyd-order-page input{border:1px solid var(--op-border);border-radius:8px;background:#fff;}',
  '.oyd-order-page input:hover,.oyd-order-page .oyd-select-trigger:hover{border-color:var(--op-focus)!important;}',
  '.oyd-order-page input:focus,.oyd-order-page .oyd-select-trigger:focus{border-color:var(--op-focus)!important;box-shadow:0 0 0 3px var(--op-focus-ring)!important;}',
  '.oyd-order-page .oyd-select-trigger[aria-expanded="true"]{border-color:var(--op-focus)!important;box-shadow:0 0 0 3px var(--op-focus-ring)!important;}',
  '.oyd-order-page .oyd-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
  '.oyd-order-page .oyd-select-arrow{width:14px!important;height:14px!important;color:#6B7385;transition:transform .16s ease;flex:0 0 14px;display:block;}',
  '.oyd-order-page .oyd-select-trigger[aria-expanded="true"] .oyd-select-arrow{transform:rotate(180deg);color:var(--op-focus);}',
].join('');

function cloneList(list) {
  return (list || []).map((item) => Object.assign({}, item));
}

var _customState = {
  keyword: '',
  appliedKeyword: '',
  status: 'all',
  region: 'all',
  openDropdown: '',
  page: 1,
  selected: [],
  loading: false,
  orders: cloneList(ORDERS),
  _isComposing: false,
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
  var id = 'openyida-order-control-reset';
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

export function chooseFilter(key, value) {
  _customState[key] = value;
  _customState.openDropdown = '';
  _customState.page = 1;
  this.forceUpdate();
}

export function handleSearchInput(e) {
  if (_customState._isComposing) { return; }
  _customState.keyword = e && e.target ? e.target.value : '';
}

export function applySearch(e) {
  if (e && e.type === 'keydown' && e.key !== 'Enter' && e.keyCode !== 13) { return; }
  this.setCustomState({ appliedKeyword: (_customState.keyword || '').trim(), page: 1 });
}

export function resetFilters() {
  _customState.keyword = '';
  var input = document.getElementById('order-search-input');
  if (input) { input.value = ''; }
  this.setCustomState({ appliedKeyword: '', status: 'all', region: 'all', page: 1, selected: [] });
}

export function getFilteredOrders() {
  var state = this.getCustomState();
  var list = state.orders || [];
  if (state.status !== 'all') { list = list.filter((item) => item.status === state.status); }
  if (state.region !== 'all') {
    var regionLabel = (this.findOption(REGION_OPTIONS, state.region) || {}).label;
    list = list.filter((item) => item.region === regionLabel);
  }
  var kw = (state.appliedKeyword || '').toLowerCase();
  if (kw) {
    list = list.filter((item) => (item.id + ' ' + item.customer + ' ' + item.contact + ' ' + item.items).toLowerCase().indexOf(kw) >= 0);
  }
  return list;
}

export function getPagedOrders(filtered) {
  var page = this.getCustomState('page') || 1;
  var start = (page - 1) * PAGE_SIZE;
  return filtered.slice(start, start + PAGE_SIZE);
}

export function goPage(delta, totalPages) {
  var next = (this.getCustomState('page') || 1) + delta;
  if (next < 1) { next = 1; }
  if (next > totalPages) { next = totalPages; }
  this.setCustomState({ page: next });
}

export function toggleSelect(id) {
  var selected = (this.getCustomState('selected') || []).slice();
  var idx = selected.indexOf(id);
  if (idx >= 0) { selected.splice(idx, 1); } else { selected.push(id); }
  this.setCustomState({ selected: selected });
}

export function toggleSelectAll(pageIds) {
  var selected = this.getCustomState('selected') || [];
  var allOn = pageIds.length > 0 && pageIds.every((id) => selected.indexOf(id) >= 0);
  this.setCustomState({ selected: allOn ? [] : pageIds.slice() });
}

export function batchExport() {
  var count = (this.getCustomState('selected') || []).length;
  if (!count) {
    this.utils.toast({ title: '请先勾选要导出的订单', type: 'warning' });
    return;
  }
  this.utils.toast({ title: '已提交导出：' + count + ' 笔订单，稍后可在下载中心查看', type: 'success' });
}

export function openOrder(id) {
  if (!FIELDS.orderForm || FIELDS.orderForm === 'FORM-XXX') {
    this.utils.toast({ title: '示例页未绑定订单表单，接入 formUuid 后可跳转详情：' + id, type: 'info' });
    return;
  }
  this.utils.router.push(FIELDS.orderForm, {}, false);
}

export function openNewOrder() {
  if (!FIELDS.orderForm || FIELDS.orderForm === 'FORM-XXX') {
    this.utils.toast({ title: '示例页未绑定订单表单，接入真实 formUuid 后可直接新建', type: 'warning' });
    return;
  }
  this.utils.router.push(FIELDS.orderForm, {}, false);
}

export function renderFilterDropdown(key, options, colors, radius, width) {
  var self = this;
  var open = this.getCustomState('openDropdown') === key;
  var selected = this.findOption(options, this.getCustomState(key));
  var triggerStyle = {
    minWidth: width || 132,
    height: 36,
    border: '1px solid ' + colors.line,
    borderRadius: radius.control,
    background: '#FFFFFF',
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 500,
    color: colors.ink,
    cursor: 'pointer',
  };
  var menuStyle = {
    position: 'absolute', zIndex: 40, marginTop: 6, left: 0, minWidth: '100%',
    background: '#FFFFFF', border: '1px solid ' + colors.line, borderRadius: radius.menu,
    padding: 6, boxShadow: '0 16px 34px rgba(28,35,51,0.14)', whiteSpace: 'nowrap',
  };
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="oyd-select-trigger" style={triggerStyle} aria-expanded={open} onClick={(e) => { self.toggleDropdown(key); }}>
        <span>{selected ? selected.label : '请选择'}</span>
        <svg className="oyd-select-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 6.1a.7.7 0 0 1 1 0L8 8.9l2.8-2.8a.7.7 0 1 1 1 1L8.5 11.4a.7.7 0 0 1-1 0L4.2 7.1a.7.7 0 0 1 0-1z" fill="currentColor" /></svg>
      </button>
      {open && (
        <div style={menuStyle} role="listbox">
          {options.map((option) => {
            var active = option.value === self.getCustomState(key);
            return (
              <button key={option.value} type="button" style={{ display: 'block', width: '100%', minHeight: 34, padding: '0 12px', border: 0, borderRadius: 6, background: active ? colors.primarySoft : '#FFFFFF', color: active ? colors.primary : colors.ink, fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left', lineHeight: '34px' }} onClick={(e) => { self.chooseFilter(key, option.value); }}>
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function renderCheckbox(checked, colors) {
  var boxStyle = {
    width: 18, height: 18, borderRadius: 5, flex: '0 0 18px',
    border: '1.5px solid ' + (checked ? colors.primary : colors.line),
    background: checked ? colors.primary : '#FFFFFF',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };
  return (
    <span style={boxStyle}>
      {checked && (<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.4 11.7a.7.7 0 0 1-1 0L2.9 9.2a.7.7 0 1 1 1-1l2 2 6-6a.7.7 0 1 1 1 1l-6.5 6.5z" fill="#FFFFFF" /></svg>)}
    </span>
  );
}

export function renderJsx() {
  var self = this;
  var state = self.getCustomState();
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;

  var colors = {
    ink: '#1C2333', inkSoft: '#5A6478', muted: '#8891A3',
    bg: '#F5F6FA', surface: '#FFFFFF', line: '#E6E8EF', lineSoft: '#F0F1F5', chipBg: '#EEF0F6',
    primary: '#3B4AA0', primarySoft: '#ECEEF8', primaryDeep: '#2E3A80',
    success: '#2E9E6B', successBg: '#EAF6EF',
    warning: '#C77B2C', warningBg: '#FBF1E3',
    danger: '#C6453B', dangerBg: '#FBECEA',
    info: '#3B4AA0', infoBg: '#ECEEF8',
  };
  var radius = { card: 14, control: 8, menu: 10, pill: 999 };

  var statusMap = {
    unpaid: { label: '待付款', color: colors.warning, bg: colors.warningBg },
    unshipped: { label: '待发货', color: colors.info, bg: colors.infoBg },
    shipped: { label: '已发货', color: colors.primary, bg: colors.primarySoft },
    done: { label: '已完成', color: colors.success, bg: colors.successBg },
    canceled: { label: '已取消', color: colors.muted, bg: colors.chipBg },
  };

  var filtered = self.getFilteredOrders();
  var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  var paged = self.getPagedOrders(filtered);
  var pageIds = paged.map((item) => item.id);
  var selected = state.selected || [];
  var allOn = pageIds.length > 0 && pageIds.every((id) => selected.indexOf(id) >= 0);

  var totalAmount = filtered.reduce((acc, cur) => acc + (cur.status === 'canceled' ? 0 : cur.amount), 0);
  var amountWan = (totalAmount / 10000).toFixed(1);

  var styles = {
    page: {
      minHeight: '100vh', background: colors.bg, color: colors.ink,
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
      fontSize: 14, padding: isMobile ? '14px' : '22px 28px', boxSizing: 'border-box',
    },
    shell: { maxWidth: 1180, margin: '0 auto' },
    card: { background: colors.surface, border: '1px solid ' + colors.line, borderRadius: radius.card, boxShadow: '0 1px 2px rgba(28,35,51,0.04)' },
  };

  return (
    <div className="oyd-page oyd-order-page" style={styles.page}>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>
      <div style={styles.shell}>
        {/* 标题 + 汇总 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 800 }}>销售订单管理</h1>
            <div style={{ marginTop: 6, fontSize: 13, color: colors.inkSoft }}>
              当前筛选 <strong style={{ color: colors.ink }}>{filtered.length}</strong> 笔 · 有效金额 <strong style={{ color: colors.primary }}>{amountWan} 万元</strong>
            </div>
          </div>
          <button type="button" style={{ height: 38, padding: '0 18px', border: 0, borderRadius: radius.control, background: colors.primary, color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={(e) => { self.openNewOrder(); }}>
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" /></svg>
            新建订单
          </button>
        </div>

        {/* 筛选栏 */}
        <div style={Object.assign({}, styles.card, { padding: isMobile ? '14px' : '16px 18px', marginBottom: 14 })}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 0 260px' }}>
              <input id="order-search-input" type="text" placeholder="搜索订单号 / 客户 / 商品" defaultValue="" style={{ width: '100%', height: 36, padding: '0 34px 0 12px', fontSize: 13, boxSizing: 'border-box' }}
                onCompositionStart={() => { _customState._isComposing = true; }}
                onCompositionEnd={(e) => { _customState._isComposing = false; self.handleSearchInput(e); }}
                onChange={(e) => { self.handleSearchInput(e); }}
                onKeyDown={(e) => { self.applySearch(e); }} />
              <button type="button" aria-label="搜索" style={{ position: 'absolute', right: 6, top: 6, width: 24, height: 24, border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }} onClick={(e) => { self.applySearch(e); }}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke={colors.muted} strokeWidth="1.6" /><path d="M10.5 10.5L14 14" stroke={colors.muted} strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>
            {self.renderFilterDropdown('status', STATUS_OPTIONS, colors, radius, 128)}
            {self.renderFilterDropdown('region', REGION_OPTIONS, colors, radius, 128)}
            <button type="button" style={{ height: 36, padding: '0 14px', border: '1px solid ' + colors.line, borderRadius: radius.control, background: '#FFFFFF', color: colors.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={(e) => { self.resetFilters(); }}>重置</button>
          </div>
        </div>

        {/* 表格卡片 */}
        <div style={styles.card}>
          {/* 工具条 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 14px' : '14px 18px', borderBottom: '1px solid ' + colors.lineSoft, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: colors.inkSoft }}>
              已选 <strong style={{ color: colors.primary }}>{selected.length}</strong> 笔
            </div>
            <button type="button" style={{ height: 32, padding: '0 14px', border: '1px solid ' + (selected.length ? colors.primary : colors.line), borderRadius: radius.control, background: selected.length ? colors.primarySoft : '#FFFFFF', color: selected.length ? colors.primary : colors.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={(e) => { self.batchExport(); }}>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m0 0L5 7m3 3l3-3M3 12v1.5A1.5 1.5 0 0 0 4.5 15h7A1.5 1.5 0 0 0 13 13.5V12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              批量导出
            </button>
          </div>

          {/* 表头（PC） */}
          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,2.2fr) 108px 96px 96px 104px', gap: 12, alignItems: 'center', padding: '10px 18px', borderBottom: '1px solid ' + colors.lineSoft, fontSize: 12, color: colors.muted, fontWeight: 600 }}>
              <button type="button" aria-label="全选" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }} onClick={(e) => { self.toggleSelectAll(pageIds); }}>{self.renderCheckbox(allOn, colors)}</button>
              <span>订单 / 客户</span>
              <span style={{ textAlign: 'right' }}>金额</span>
              <span>负责人</span>
              <span>状态</span>
              <span style={{ textAlign: 'right' }}>操作</span>
            </div>
          )}

          {/* 行 */}
          {state.loading ? (
            <div style={{ padding: '44px 16px', textAlign: 'center', color: colors.muted }}>正在加载订单...</div>
          ) : paged.length ? (
            paged.map((item) => {
              var st = statusMap[item.status] || statusMap.shipped;
              var checked = selected.indexOf(item.id) >= 0;
              if (isMobile) {
                return (
                  <div key={item.id} style={{ padding: '14px', borderBottom: '1px solid ' + colors.lineSoft }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                        <button type="button" aria-label="选择" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }} onClick={(e) => { self.toggleSelect(item.id); }}>{self.renderCheckbox(checked, colors)}</button>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: colors.muted, fontFamily: 'SFMono-Regular, Menlo, monospace' }}>{item.id}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{item.customer}</div>
                          <div style={{ fontSize: 12, color: colors.inkSoft, marginTop: 2 }}>{item.items}</div>
                        </div>
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 5, background: st.bg, color: st.color, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: colors.ink }}>¥{item.amount.toLocaleString()}</span>
                      <button type="button" style={{ height: 30, padding: '0 12px', border: '1px solid ' + colors.line, borderRadius: 6, background: '#FFFFFF', color: colors.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={(e) => { self.openOrder(item.id); }}>查看</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,2.2fr) 108px 96px 96px 104px', gap: 12, alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid ' + colors.lineSoft, background: checked ? colors.primarySoft : '#FFFFFF' }}>
                  <button type="button" aria-label="选择" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }} onClick={(e) => { self.toggleSelect(item.id); }}>{self.renderCheckbox(checked, colors)}</button>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: colors.muted, fontFamily: 'SFMono-Regular, Menlo, monospace' }}>{item.id}</span>
                      <span style={{ fontSize: 11, color: colors.muted }}>{item.date}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.customer} <span style={{ fontSize: 12, fontWeight: 400, color: colors.muted }}>· {item.contact}</span></div>
                    <div style={{ fontSize: 13, color: colors.inkSoft, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.items} · {item.region}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>¥{item.amount.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: colors.muted }}>{item.qty} 件</div>
                  </div>
                  <span style={{ fontSize: 13, color: colors.inkSoft }}>{item.owner}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 6, background: st.bg, color: st.color, fontSize: 12, fontWeight: 700, width: 'fit-content' }}>{st.label}</span>
                  <div style={{ textAlign: 'right' }}>
                    <button type="button" style={{ height: 30, padding: '0 12px', border: '1px solid ' + colors.line, borderRadius: 6, background: '#FFFFFF', color: colors.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={(e) => { self.openOrder(item.id); }}>查看</button>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '52px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.inkSoft }}>没有符合条件的订单</div>
              <div style={{ marginTop: 6, fontSize: 13, color: colors.muted }}>试试调整状态 / 大区，或点「重置」清空筛选</div>
            </div>
          )}

          {/* 分页 */}
          {paged.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '12px 14px' : '14px 18px', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 13, color: colors.muted }}>第 {state.page} / {totalPages} 页 · 共 {filtered.length} 笔</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={state.page <= 1} style={{ height: 32, padding: '0 14px', border: '1px solid ' + colors.line, borderRadius: radius.control, background: '#FFFFFF', color: state.page <= 1 ? colors.muted : colors.ink, fontSize: 13, fontWeight: 600, cursor: state.page <= 1 ? 'not-allowed' : 'pointer', opacity: state.page <= 1 ? 0.6 : 1 }} onClick={(e) => { self.goPage(-1, totalPages); }}>上一页</button>
                <button type="button" disabled={state.page >= totalPages} style={{ height: 32, padding: '0 14px', border: '1px solid ' + colors.line, borderRadius: radius.control, background: '#FFFFFF', color: state.page >= totalPages ? colors.muted : colors.ink, fontSize: 13, fontWeight: 600, cursor: state.page >= totalPages ? 'not-allowed' : 'pointer', opacity: state.page >= totalPages ? 0.6 : 1 }} onClick={(e) => { self.goPage(1, totalPages); }}>下一页</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
