/**
 * 设备台账管理（data-management 场景 · 原生自定义页面示例 · data-management）
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 真实业务对象：工厂设备台账。左侧类别导航 + 台账统计 + 关键字搜索 +
 * 设备明细表（状态/保养到期/负责人）+ 保养预警高亮，对齐 canvas 的 data-management。
 *
 * 页面级独立主题（石板青），零 emoji，功能性内联 SVG，字段带单位与到期天数。
 */

var FIELDS = { deviceForm: 'FORM-XXX' };

var CATEGORIES = [
  { value: 'all', label: '全部设备', count: 7 },
  { value: 'cnc', label: '数控机床', count: 2 },
  { value: 'inject', label: '注塑设备', count: 2 },
  { value: 'convey', label: '输送系统', count: 1 },
  { value: 'power', label: '动力设备', count: 2 },
];

var DEVICES = [
  { id: 'EQ-CNC-018', name: '五轴加工中心 VMC-850', cat: 'cnc', catLabel: '数控机床', location: 'A 区 · 精加工线', owner: '李文博', due: 4, status: 'running', health: 92 },
  { id: 'EQ-CNC-021', name: '数控车床 CK6150', cat: 'cnc', catLabel: '数控机床', location: 'A 区 · 精加工线', owner: '李文博', due: 26, status: 'running', health: 88 },
  { id: 'EQ-INJ-007', name: '伺服注塑机 260T', cat: 'inject', catLabel: '注塑设备', location: 'B 区 · 注塑车间', owner: '张涛', due: -2, status: 'maintenance', health: 61 },
  { id: 'EQ-INJ-009', name: '伺服注塑机 180T', cat: 'inject', catLabel: '注塑设备', location: 'B 区 · 注塑车间', owner: '张涛', due: 15, status: 'running', health: 79 },
  { id: 'EQ-CVY-003', name: '主装配线输送机', cat: 'convey', catLabel: '输送系统', location: 'C 区 · 总装线', owner: '王琳', due: 9, status: 'running', health: 84 },
  { id: 'EQ-PWR-002', name: '空压机 75kW', cat: 'power', catLabel: '动力设备', location: '动力站房', owner: '陈刚', due: 1, status: 'warning', health: 68 },
  { id: 'EQ-PWR-005', name: '冷冻机组 120RT', cat: 'power', catLabel: '动力设备', location: '动力站房', owner: '陈刚', due: 38, status: 'stopped', health: 0 },
];

var CONTROL_RESET_CSS = [
  '.oyd-asset-page{--as-focus:#2E6A72;--as-focus-ring:rgba(46,106,114,.16);--as-border:#D3DEDF;}',
  '.oyd-asset-page input{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:400;color:#182A2C;outline:none!important;box-shadow:none;border:1px solid var(--as-border);border-radius:8px;background:#fff;}',
  '.oyd-asset-page input:hover{border-color:var(--as-focus)!important;}',
  '.oyd-asset-page input:focus{border-color:var(--as-focus)!important;box-shadow:0 0 0 3px var(--as-focus-ring)!important;}',
].join('');

function cloneList(list) {
  return (list || []).map((item) => Object.assign({}, item));
}

var _customState = {
  category: 'all',
  keyword: '',
  appliedKeyword: '',
  devices: cloneList(DEVICES),
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
  var id = 'openyida-asset-control-reset';
  var style = document.getElementById(id);
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = CONTROL_RESET_CSS;
}

export function didMount() {
  this.injectControlReset();
}

export function didUnmount() {
  var style = document.getElementById('openyida-asset-control-reset');
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
  }
}

export function chooseCategory(value) {
  _customState.category = value;
  this.forceUpdate();
}

export function handleSearchInput(e) {
  if (_customState._isComposing) { return; }
  _customState.keyword = e && e.target ? e.target.value : '';
}

export function applySearch(e) {
  if (e && e.type === 'keydown' && e.key !== 'Enter' && e.keyCode !== 13) { return; }
  this.setCustomState({ appliedKeyword: (_customState.keyword || '').trim() });
}

export function getFilteredDevices() {
  var state = this.getCustomState();
  var list = state.devices || [];
  if (state.category !== 'all') { list = list.filter((item) => item.cat === state.category); }
  var kw = (state.appliedKeyword || '').toLowerCase();
  if (kw) {
    list = list.filter((item) => (item.id + ' ' + item.name + ' ' + item.location + ' ' + item.owner).toLowerCase().indexOf(kw) >= 0);
  }
  return list;
}

export function openDevice(id) {
  if (!FIELDS.deviceForm || FIELDS.deviceForm === 'FORM-XXX') {
    this.utils.toast({ title: '示例页未绑定设备表单，接入 formUuid 后可跳转台账详情：' + id, type: 'info' });
    return;
  }
  this.utils.router.push(FIELDS.deviceForm, {}, false);
}

export function openNewDevice() {
  if (!FIELDS.deviceForm || FIELDS.deviceForm === 'FORM-XXX') {
    this.utils.toast({ title: '示例页未绑定设备表单，接入真实 formUuid 后可直接登记', type: 'warning' });
    return;
  }
  this.utils.router.push(FIELDS.deviceForm, {}, false);
}

export function renderJsx() {
  var self = this;
  var state = self.getCustomState();
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;

  var colors = {
    ink: '#182A2C', inkSoft: '#4E605F', muted: '#83918F',
    bg: '#F1F5F4', surface: '#FFFFFF', line: '#E1E8E7', lineSoft: '#EEF2F1', chipBg: '#E7EEED',
    primary: '#2E6A72', primarySoft: '#E4EEEE', primaryDeep: '#215158',
    success: '#2E9E6B', successBg: '#EAF6EF',
    warning: '#C77B2C', warningBg: '#FBF1E3',
    danger: '#C6453B', dangerBg: '#FBECEA',
  };
  var radius = { card: 14, control: 8 };

  var statusMap = {
    running: { label: '运行中', color: colors.success, bg: colors.successBg },
    warning: { label: '待检修', color: colors.warning, bg: colors.warningBg },
    maintenance: { label: '保养中', color: colors.primary, bg: colors.primarySoft },
    stopped: { label: '已停机', color: colors.muted, bg: colors.chipBg },
  };

  var all = state.devices || [];
  var filtered = self.getFilteredDevices();
  var runningCount = all.filter((d) => d.status === 'running').length;
  var overdue = all.filter((d) => d.due <= 3).length;
  var stoppedCount = all.filter((d) => d.status === 'stopped').length;

  var styles = {
    page: { minHeight: '100vh', background: colors.bg, color: colors.ink, fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif', fontSize: 14, padding: isMobile ? '14px' : '22px 28px', boxSizing: 'border-box' },
    shell: { maxWidth: 1200, margin: '0 auto' },
    card: { background: colors.surface, border: '1px solid ' + colors.line, borderRadius: radius.card, boxShadow: '0 1px 2px rgba(24,42,44,0.04)' },
  };

  var dueTag = function (due) {
    if (due < 0) { return { text: '已逾期 ' + Math.abs(due) + ' 天', color: colors.danger, bg: colors.dangerBg }; }
    if (due <= 3) { return { text: due + ' 天后保养', color: colors.warning, bg: colors.warningBg }; }
    return { text: due + ' 天后保养', color: colors.inkSoft, bg: colors.lineSoft };
  };

  var healthColorOf = function (health) {
    if (health >= 80) { return colors.success; }
    if (health >= 60) { return colors.warning; }
    return colors.danger;
  };

  return (
    <div className="oyd-page oyd-asset-page" style={styles.page}>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>
      <div style={styles.shell}>
        {/* 标题 + 统计 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 800 }}>设备台账管理</h1>
            <div style={{ marginTop: 6, fontSize: 13, color: colors.inkSoft }}>
              共 <strong style={{ color: colors.ink }}>{all.length}</strong> 台 · 运行 <strong style={{ color: colors.success }}>{runningCount}</strong> · 待保养 <strong style={{ color: colors.warning }}>{overdue}</strong> · 停机 <strong style={{ color: colors.muted }}>{stoppedCount}</strong>
            </div>
          </div>
          <button type="button" style={{ height: 38, padding: '0 18px', border: 0, borderRadius: radius.control, background: colors.primary, color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={(e) => { self.openNewDevice(); }}>
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            登记设备
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '196px minmax(0,1fr)', gap: 14 }}>
          {/* 左侧类别 */}
          <div style={Object.assign({}, styles.card, { padding: 10, alignSelf: 'start' })}>
            {CATEGORIES.map((c) => {
              var active = c.value === state.category;
              return (
                <button key={c.value} type="button" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, padding: '0 12px', marginBottom: 2, border: 0, borderRadius: 8, background: active ? colors.primarySoft : 'transparent', color: active ? colors.primaryDeep : colors.inkSoft, fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left' }} onClick={(e) => { self.chooseCategory(c.value); }}>
                  <span>{c.label}</span>
                  <span style={{ fontSize: 12, color: active ? colors.primary : colors.muted, fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
                </button>
              );
            })}
          </div>

          {/* 右侧内容 */}
          <div>
            {/* 搜索栏 */}
            <div style={Object.assign({}, styles.card, { padding: isMobile ? '12px' : '12px 14px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' })}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: colors.muted, display: 'inline-flex' }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                </span>
                <input id="asset-search-input" type="text" placeholder="搜索设备编号 / 名称 / 位置 / 负责人" defaultValue={state.keyword}
                  onCompositionStart={(e) => { _customState._isComposing = true; }}
                  onCompositionEnd={(e) => { _customState._isComposing = false; self.handleSearchInput(e); }}
                  onChange={(e) => { self.handleSearchInput(e); }}
                  onKeyDown={(e) => { self.applySearch(e); }}
                  style={{ width: '100%', height: 38, padding: '0 12px 0 34px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <button type="button" style={{ height: 38, padding: '0 16px', border: 0, borderRadius: radius.control, background: colors.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={(e) => { self.applySearch({ type: 'click' }); }}>搜索</button>
            </div>

            {/* 设备表格 */}
            <div style={Object.assign({}, styles.card, { overflow: 'hidden' })}>
              {!isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 1fr 1.1fr 0.9fr', padding: '12px 18px', background: colors.lineSoft, fontSize: 12, fontWeight: 700, color: colors.muted }}>
                  <span>设备 / 编号</span><span>位置 / 负责人</span><span>健康度</span><span>保养到期</span><span style={{ textAlign: 'right' }}>状态</span>
                </div>
              )}
              {filtered.length === 0 && (
                <div style={{ padding: '48px 20px', textAlign: 'center', color: colors.muted, fontSize: 13 }}>没有符合条件的设备，试试切换类别或清空搜索。</div>
              )}
              {filtered.map((d) => {
                var st = statusMap[d.status] || statusMap.stopped;
                var dt = dueTag(d.due);
                var healthColor = healthColorOf(d.health);
                return (
                  <div key={d.id} onClick={(e) => { self.openDevice(d.id); }} style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: '2.2fr 1.4fr 1fr 1.1fr 0.9fr', alignItems: 'center', padding: isMobile ? '14px 16px' : '14px 18px', borderTop: '1px solid ' + colors.lineSoft, cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink }}>{d.name}</div>
                      <div style={{ marginTop: 3, fontSize: 12, color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>{d.id} · {d.catLabel}</div>
                    </div>
                    <div style={{ marginTop: isMobile ? 8 : 0, fontSize: 13, color: colors.inkSoft }}>{d.location}<span style={{ color: colors.muted }}> · {d.owner}</span></div>
                    <div style={{ marginTop: isMobile ? 8 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, maxWidth: 70, height: 6, borderRadius: 999, background: colors.chipBg, overflow: 'hidden' }}>
                          <span style={{ display: 'block', height: '100%', width: d.health + '%', background: healthColor, borderRadius: 999 }}></span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: healthColor, fontVariantNumeric: 'tabular-nums' }}>{d.health}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: isMobile ? 8 : 0 }}>
                      <span style={{ display: 'inline-flex', height: 22, padding: '0 8px', borderRadius: 6, background: dt.bg, color: dt.color, fontSize: 12, fontWeight: 600, alignItems: 'center' }}>{dt.text}</span>
                    </div>
                    <div style={{ marginTop: isMobile ? 8 : 0, textAlign: isMobile ? 'left' : 'right' }}>
                      <span style={{ display: 'inline-flex', height: 24, padding: '0 10px', borderRadius: 6, background: st.bg, color: st.color, fontSize: 12, fontWeight: 700, alignItems: 'center' }}>{st.label}</span>
                    </div>
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
