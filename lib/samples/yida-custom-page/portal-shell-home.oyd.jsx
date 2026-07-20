/**
 * 数字工作台门户（portal-shell-home 场景 · 原生自定义页面示例 · portal-shell-home）
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 真实业务对象：企业员工数字工作台门户。欢迎头 + 关键待办统计 + 应用入口矩阵
 * （多系统入口）+ 我的待办 + 公司公告，对齐 canvas 的 portal-shell-home。
 *
 * 页面级独立主题（品牌蓝，避免蓝紫科技渐变），零 emoji，功能性内联 SVG。
 */

var FIELDS = { targetForm: 'FORM-XXX' };

var OVERVIEW = [
  { label: '待我审批', value: '6', unit: '项', tone: 'primary' },
  { label: '待办任务', value: '11', unit: '项', tone: 'warning' },
  { label: '本月报销', value: '3,280', unit: '元', tone: 'ink' },
  { label: '待读公告', value: '2', unit: '条', tone: 'ink' },
];

// 应用入口矩阵（多入口门户核心）
var APP_GROUPS = [
  {
    group: '人事行政',
    apps: [
      { name: '考勤打卡', badge: 0, icon: 'clock' },
      { name: '请假申请', badge: 0, icon: 'leaf' },
      { name: '出差报销', badge: 2, icon: 'wallet' },
      { name: '通讯录', badge: 0, icon: 'people' },
    ],
  },
  {
    group: '业务系统',
    apps: [
      { name: '客户管理', badge: 0, icon: 'card' },
      { name: '订单中心', badge: 4, icon: 'box' },
      { name: '合同审批', badge: 3, icon: 'doc' },
      { name: '数据报表', badge: 0, icon: 'chart' },
    ],
  },
  {
    group: '协作工具',
    apps: [
      { name: '会议室预订', badge: 0, icon: 'calendar' },
      { name: '知识库', badge: 0, icon: 'book' },
      { name: 'IT 服务台', badge: 1, icon: 'wrench' },
      { name: '更多应用', badge: 0, icon: 'grid' },
    ],
  },
];

var TODOS = [
  { title: '差旅报销单 BX-20748 待审批', from: '市场部 · 李阳', time: '10 分钟前', level: 'urgent' },
  { title: '采购合同 HT-0921 待会签', from: '采购部 · 周敏', time: '1 小时前', level: 'high' },
  { title: '入职材料待确认（张明）', from: '人力资源部', time: '今天 09:20', level: 'normal' },
  { title: 'Q3 营销预算复核', from: '财务部', time: '昨天 17:40', level: 'normal' },
];

var NOTICES = [
  { tag: '制度', title: '关于更新差旅报销标准的通知', date: '07-16' },
  { tag: '活动', title: '2024 年中运动会报名开启', date: '07-15' },
  { tag: '系统', title: 'OA 系统本周六 22:00 例行维护', date: '07-14' },
];

var CONTROL_RESET_CSS = [
  '.oyd-portal-page input{appearance:none;-webkit-appearance:none;font-family:inherit;color:#16213A;outline:none!important;box-shadow:none;border:1px solid #D8DEEA;border-radius:999px;background:#fff;}',
  '.oyd-portal-page input:focus{border-color:#2563A8!important;box-shadow:0 0 0 3px rgba(37,99,168,.16)!important;}',
].join('');

var _customState = { keyword: '', _isComposing: false };

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
  var id = 'openyida-portal-control-reset';
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
  var style = document.getElementById('openyida-portal-control-reset');
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
  }
}

export function handleSearchInput(e) {
  if (_customState._isComposing) { return; }
  _customState.keyword = e && e.target ? e.target.value : '';
}

export function applySearch(e) {
  if (e && e.type === 'keydown' && e.key !== 'Enter' && e.keyCode !== 13) { return; }
  var kw = (_customState.keyword || '').trim();
  this.utils.toast({ title: kw ? '搜索应用 / 待办：' + kw + '（示例演示）' : '请输入要搜索的应用或待办', type: kw ? 'info' : 'warning' });
}

export function openApp(name) {
  if (!FIELDS.targetForm || FIELDS.targetForm === 'FORM-XXX') {
    this.utils.toast({ title: '打开「' + name + '」（示例未绑定目标页，接入 formUuid 后可跳转）', type: 'info' });
    return;
  }
  this.utils.router.push(FIELDS.targetForm, {}, false);
}

export function renderAppIcon(name, color) {
  var stroke = { fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  var paths = {
    clock: (<g><circle cx="10" cy="10" r="7" {...stroke} /><path d="M10 6v4l2.6 1.6" {...stroke} /></g>),
    leaf: (<g><path d="M15 4c0 6-4 11-10 11 0-6 4-11 10-11z" {...stroke} /><path d="M5 15c2-4 5-6 8-7" {...stroke} /></g>),
    wallet: (<g><rect x="3" y="5.5" width="14" height="10" rx="2" {...stroke} /><path d="M13 10h2.5" {...stroke} /><path d="M3 8h11" {...stroke} /></g>),
    people: (<g><circle cx="7.5" cy="8" r="2.4" {...stroke} /><path d="M3.5 15.5c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" {...stroke} /><path d="M13 7.5a2.2 2.2 0 0 1 0 4.4M14 15.5c0-1.8-1-3-2.4-3.4" {...stroke} /></g>),
    card: (<g><rect x="3" y="5" width="14" height="10" rx="2" {...stroke} /><path d="M3 8.5h14M6 12h4" {...stroke} /></g>),
    box: (<g><path d="M10 3l6 3.2v7.6L10 17l-6-3.2V6.2z" {...stroke} /><path d="M4 6.4l6 3.2 6-3.2M10 9.6V17" {...stroke} /></g>),
    doc: (<g><path d="M5 3h6l4 4v10H5z" {...stroke} /><path d="M11 3v4h4M7.5 10.5h5M7.5 13h5" {...stroke} /></g>),
    chart: (<g><path d="M4 16V4M4 16h12" {...stroke} /><path d="M7 13v-3M10 13V7M13 13V9" {...stroke} /></g>),
    calendar: (<g><rect x="3.5" y="4.5" width="13" height="12" rx="2" {...stroke} /><path d="M3.5 8h13M7 3v3M13 3v3" {...stroke} /></g>),
    book: (<g><path d="M4 4.5h5a2 2 0 0 1 2 2v9a2 2 0 0 0-2-2H4z" {...stroke} /><path d="M16 4.5h-5a2 2 0 0 0-2 2v9a2 2 0 0 1 2-2h5z" {...stroke} /></g>),
    wrench: (<g><path d="M13.5 3.5a3.5 3.5 0 0 0-4.4 4.4L4 13l3 3 5.1-5.1a3.5 3.5 0 0 0 4.4-4.4l-2 2-2-2z" {...stroke} /></g>),
    grid: (<g><rect x="3.5" y="3.5" width="5" height="5" rx="1.2" {...stroke} /><rect x="11.5" y="3.5" width="5" height="5" rx="1.2" {...stroke} /><rect x="3.5" y="11.5" width="5" height="5" rx="1.2" {...stroke} /><rect x="11.5" y="11.5" width="5" height="5" rx="1.2" {...stroke} /></g>),
  };
  return (<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">{paths[name] || paths.grid}</svg>);
}

export function renderJsx() {
  var self = this;
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;

  var colors = {
    ink: '#16213A', inkSoft: '#4E5A73', muted: '#8791A5',
    bg: '#F2F5FA', surface: '#FFFFFF', line: '#E4E9F1', lineSoft: '#EEF1F7', chipBg: '#EAEFF7',
    primary: '#2563A8', primarySoft: '#E7F0F9', primaryDeep: '#1B4C85',
    success: '#2E9E6B', warning: '#C77B2C', warningBg: '#FBF1E3', danger: '#C6453B', dangerBg: '#FBECEA',
  };
  var radius = { card: 14, control: 10, pill: 999 };

  var toneColor = { primary: colors.primary, warning: colors.warning, ink: colors.ink };
  var levelColor = { urgent: colors.danger, high: colors.warning, normal: colors.muted };
  var levelText = { urgent: '加急', high: '较急', normal: '常规' };

  var styles = {
    page: { minHeight: '100vh', background: colors.bg, color: colors.ink, fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif', fontSize: 14, padding: isMobile ? '14px' : '22px 28px', boxSizing: 'border-box' },
    shell: { maxWidth: 1180, margin: '0 auto' },
    card: { background: colors.surface, border: '1px solid ' + colors.line, borderRadius: radius.card, boxShadow: '0 1px 2px rgba(22,33,58,0.04)' },
    sectionTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: colors.ink },
  };

  return (
    <div className="oyd-page oyd-portal-page" style={styles.page}>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>
      <div style={styles.shell}>
        {/* 欢迎头 */}
        <div style={{ borderRadius: 16, background: 'linear-gradient(120deg, ' + colors.primaryDeep + ', ' + colors.primary + ')', padding: isMobile ? '20px' : '26px 30px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: '#fff' }}>下午好，方瑞妍</div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(231,240,249,0.85)' }}>今天有 6 项审批待处理 · 2 条公告待阅读 · 天气 晴 28℃</div>
            </div>
            <div style={{ position: 'relative', width: isMobile ? '100%' : 320 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: colors.muted, display: 'inline-flex' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
              <input type="text" placeholder="搜索应用、待办、同事…" defaultValue={self.getCustomState('keyword')}
                onCompositionStart={(e) => { _customState._isComposing = true; }}
                onCompositionEnd={(e) => { _customState._isComposing = false; self.handleSearchInput(e); }}
                onChange={(e) => { self.handleSearchInput(e); }}
                onKeyDown={(e) => { self.applySearch(e); }}
                style={{ width: '100%', height: 42, padding: '0 16px 0 38px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* 概览统计 */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
            {OVERVIEW.map((o) => (
              <div key={o.label} style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, color: 'rgba(231,240,249,0.8)' }}>{o.label}</div>
                <div style={{ marginTop: 5, display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{o.value}</span>
                  <span style={{ fontSize: 12, color: 'rgba(231,240,249,0.75)' }}>{o.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1.5fr) minmax(0,1fr)', gap: 14 }}>
          {/* 应用入口矩阵 */}
          <div style={{ display: 'grid', gap: 14 }}>
            {APP_GROUPS.map((g) => (
              <div key={g.group} style={Object.assign({}, styles.card, { padding: isMobile ? '16px' : '18px 20px' })}>
                <h2 style={styles.sectionTitle}>{g.group}</h2>
                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
                  {g.apps.map((a) => (
                    <button key={a.name} type="button" onClick={(e) => { self.openApp(a.name); }} style={{ position: 'relative', border: '1px solid ' + colors.lineSoft, borderRadius: 12, background: colors.surface, padding: '16px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 44, height: 44, borderRadius: 12, background: colors.primarySoft, color: colors.primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{self.renderAppIcon(a.icon, colors.primary)}</span>
                      <span style={{ fontSize: 13, color: colors.ink, fontWeight: 500 }}>{a.name}</span>
                      {a.badge > 0 && (<span style={{ position: 'absolute', top: 10, right: 12, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: colors.danger, color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{a.badge}</span>)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 右栏：待办 + 公告 */}
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <div style={Object.assign({}, styles.card, { padding: isMobile ? '16px' : '18px 20px' })}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 style={styles.sectionTitle}>我的待办</h2>
                <span style={{ fontSize: 12, color: colors.primary, cursor: 'pointer', fontWeight: 600 }}>全部</span>
              </div>
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {TODOS.map((t, idx) => (
                  <div key={idx} onClick={(e) => { self.openApp(t.title); }} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + colors.lineSoft, cursor: 'pointer' }}>
                    <span style={{ flex: '0 0 auto', height: 20, padding: '0 7px', borderRadius: 5, border: '1px solid ' + levelColor[t.level], color: levelColor[t.level], fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', marginTop: 1 }}>{levelText[t.level]}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.ink, lineHeight: '19px' }}>{t.title}</div>
                      <div style={{ marginTop: 3, fontSize: 12, color: colors.muted }}>{t.from} · {t.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={Object.assign({}, styles.card, { padding: isMobile ? '16px' : '18px 20px' })}>
              <h2 style={styles.sectionTitle}>公司公告</h2>
              <div style={{ marginTop: 12, display: 'grid', gap: 4 }}>
                {NOTICES.map((n, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: idx === 0 ? 'none' : '1px solid ' + colors.lineSoft, cursor: 'pointer' }} onClick={(e) => { self.openApp(n.title); }}>
                    <span style={{ flex: '0 0 auto', height: 20, padding: '0 8px', borderRadius: 5, background: colors.chipBg, color: colors.primaryDeep, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{n.tag}</span>
                    <span style={{ flex: 1, fontSize: 13, color: colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                    <span style={{ flex: '0 0 auto', fontSize: 12, color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>{n.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
