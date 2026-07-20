/**
 * 工单处理台（split-pane-detail 场景 · 原生自定义页面示例 · split-pane-detail）
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 真实业务对象：IT 服务工单处理台。左侧工单队列（可筛选可选中）+ 右侧详情面板
 * （基本信息 + 处理时间线 + 操作区），左右联动，对齐 canvas 的 split-pane-detail。
 *
 * 页面级独立主题（靛紫），零 emoji，功能性内联 SVG，SLA 倒计时具体到分钟。
 */

var FILTERS = [
  { value: 'pending', label: '待我处理' },
  { value: 'all', label: '全部工单' },
  { value: 'urgent', label: '加急' },
];

var TICKETS = [
  { id: 'IT-20748', title: 'ERP 登录报 500 错误', requester: '财务部 · 周敏', priority: 'urgent', sla: '剩 38 分钟', slaLevel: 'danger', status: 'processing', updated: '14:02', channel: '在线提单',
    desc: '财务共享中心 12 人无法登录 ERP，点击登录后报 500。影响月末结账，请求尽快恢复。',
    timeline: [
      { time: '13:24', who: '周敏', text: '提交工单，附登录报错截图。', tone: 'normal' },
      { time: '13:31', who: '一线客服', text: '初判为应用网关异常，升级至运维二线。', tone: 'normal' },
      { time: '13:58', who: '运维 · 郑昊', text: '已定位网关连接池打满，正在扩容重启。', tone: 'good' },
    ] },
  { id: 'IT-20745', title: '企业邮箱附件无法下载', requester: '市场部 · 李阳', priority: 'high', sla: '剩 2 小时', slaLevel: 'warn', status: 'processing', updated: '13:40', channel: '钉钉',
    desc: '部分同事反馈邮箱附件点击下载后无响应，Chrome / Edge 均复现。',
    timeline: [
      { time: '11:20', who: '李阳', text: '提交工单。', tone: 'normal' },
      { time: '12:05', who: '运维 · 孙倩', text: '正在排查邮件网关附件服务。', tone: 'normal' },
    ] },
  { id: 'IT-20740', title: '新员工账号开通', requester: '人力资源 · 吴敏', priority: 'normal', sla: '剩 6 小时', slaLevel: 'ok', status: 'pending', updated: '10:12', channel: '在线提单',
    desc: '7 月入职 5 名新员工，需开通域账号、邮箱与 OA 权限，附名单。',
    timeline: [ { time: '10:12', who: '吴敏', text: '提交工单，附入职名单。', tone: 'normal' } ] },
  { id: 'IT-20736', title: '打印机驱动安装', requester: '行政部 · 何静', priority: 'normal', sla: '剩 1 天', slaLevel: 'ok', status: 'pending', updated: '09:30', channel: '电话',
    desc: '3 楼东区新到一台激光打印机，需批量推送驱动到本层办公电脑。',
    timeline: [ { time: '09:30', who: '何静', text: '电话报单，客服代提。', tone: 'normal' } ] },
];

var CONTROL_RESET_CSS = [
  '.oyd-ticket-page textarea{appearance:none;-webkit-appearance:none;font-family:inherit;color:#20233A;outline:none!important;box-shadow:none;border:1px solid #DCDDE8;border-radius:8px;background:#fff;resize:none;}',
  '.oyd-ticket-page textarea:focus{border-color:#5B4B8A!important;box-shadow:0 0 0 3px rgba(91,75,138,.16)!important;}',
].join('');

var _customState = {
  filter: 'pending',
  selectedId: 'IT-20748',
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
  var id = 'openyida-ticket-control-reset';
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

export function chooseFilter(value) {
  _customState.filter = value;
  var list = this.getVisibleTickets();
  if (list.length && list.filter((t) => t.id === _customState.selectedId).length === 0) {
    _customState.selectedId = list[0].id;
  }
  this.forceUpdate();
}

export function selectTicket(id) {
  _customState.selectedId = id;
  this.forceUpdate();
}

export function getVisibleTickets() {
  var filter = this.getCustomState('filter');
  if (filter === 'urgent') { return TICKETS.filter((t) => t.priority === 'urgent' || t.priority === 'high'); }
  if (filter === 'pending') { return TICKETS.filter((t) => t.status === 'processing' || t.status === 'pending'); }
  return TICKETS.slice();
}

export function getSelected() {
  var id = this.getCustomState('selectedId');
  var matched = TICKETS.filter((t) => t.id === id);
  return matched[0] || TICKETS[0];
}

export function claimTicket() {
  this.utils.toast({ title: '已接单，工单进入「处理中」（示例演示）', type: 'success' });
}

export function resolveTicket() {
  this.utils.toast({ title: '已提交处理结果，等待发起人确认（示例演示）', type: 'success' });
}

export function renderJsx() {
  var self = this;
  var state = self.getCustomState();
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;

  var colors = {
    ink: '#20233A', inkSoft: '#585C7A', muted: '#8B8FA8',
    bg: '#F4F4F9', surface: '#FFFFFF', line: '#E4E4EE', lineSoft: '#EFEFF5', chipBg: '#ECECF5',
    primary: '#5B4B8A', primarySoft: '#EBE7F4', primaryDeep: '#463970',
    success: '#2E9E6B', successBg: '#EAF6EF',
    warning: '#C77B2C', warningBg: '#FBF1E3',
    danger: '#C6453B', dangerBg: '#FBECEA',
  };
  var radius = { card: 14, control: 8 };

  var priorityMap = {
    urgent: { label: '加急', color: colors.danger, bg: colors.dangerBg },
    high: { label: '较高', color: colors.warning, bg: colors.warningBg },
    normal: { label: '常规', color: colors.inkSoft, bg: colors.chipBg },
  };
  var slaColor = { danger: colors.danger, warn: colors.warning, ok: colors.success };
  var slaBg = { danger: colors.dangerBg, warn: colors.warningBg, ok: colors.successBg };

  var list = self.getVisibleTickets();
  var current = self.getSelected();
  var pr = priorityMap[current.priority] || priorityMap.normal;

  var styles = {
    page: { minHeight: '100vh', background: colors.bg, color: colors.ink, fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif', fontSize: 14, padding: isMobile ? '14px' : '22px 28px', boxSizing: 'border-box' },
    shell: { maxWidth: 1200, margin: '0 auto' },
    card: { background: colors.surface, border: '1px solid ' + colors.line, borderRadius: radius.card, boxShadow: '0 1px 2px rgba(32,35,58,0.04)' },
    sectionTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: colors.ink },
  };

  return (
    <div className="oyd-page oyd-ticket-page" style={styles.page}>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>
      <div style={styles.shell}>
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 800 }}>工单处理台</h1>
          <div style={{ marginTop: 6, fontSize: 13, color: colors.inkSoft }}>当前队列 <strong style={{ color: colors.ink }}>{list.length}</strong> 单 · 加急 <strong style={{ color: colors.danger }}>{TICKETS.filter((t) => t.priority === 'urgent').length}</strong> 单待响应</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,0.9fr) minmax(0,1.4fr)', gap: 14, alignItems: 'start' }}>
          {/* 左侧队列 */}
          <div style={Object.assign({}, styles.card, { overflow: 'hidden' })}>
            <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: '1px solid ' + colors.lineSoft }}>
              {FILTERS.map((f) => {
                var active = f.value === state.filter;
                return (
                  <button key={f.value} type="button" style={{ height: 32, padding: '0 12px', border: 0, borderRadius: 7, background: active ? colors.primarySoft : 'transparent', color: active ? colors.primaryDeep : colors.inkSoft, fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer' }} onClick={(e) => { self.chooseFilter(f.value); }}>{f.label}</button>
                );
              })}
            </div>
            <div style={{ maxHeight: isMobile ? 'none' : 560, overflowY: 'auto' }}>
              {list.map((t) => {
                var active = t.id === state.selectedId;
                var tp = priorityMap[t.priority] || priorityMap.normal;
                return (
                  <div key={t.id} onClick={(e) => { self.selectTicket(t.id); }} style={{ padding: '14px 16px', borderTop: '1px solid ' + colors.lineSoft, borderLeft: '3px solid ' + (active ? colors.primary : 'transparent'), background: active ? colors.primarySoft : 'transparent', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>{t.id}</span>
                      <span style={{ height: 20, padding: '0 8px', borderRadius: 5, background: tp.bg, color: tp.color, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{tp.label}</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600, color: colors.ink }}>{t.title}</div>
                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: colors.inkSoft }}>{t.requester}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: slaColor[t.slaLevel] }}>{t.sla}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右侧详情 */}
          <div style={Object.assign({}, styles.card, { padding: isMobile ? '16px' : '20px 24px' })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{current.title}</h2>
                  <span style={{ height: 22, padding: '0 9px', borderRadius: 6, background: pr.bg, color: pr.color, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{pr.label}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: colors.inkSoft }}>{current.id} · {current.requester} · {current.channel} · 最近更新 {current.updated}</div>
              </div>
              <span style={{ height: 30, padding: '0 12px', borderRadius: 8, background: slaBg[current.slaLevel] || colors.dangerBg, color: slaColor[current.slaLevel], fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 5.5v3l2 1.2M8 2h0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                SLA {current.sla}
              </span>
            </div>

            <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: colors.lineSoft, fontSize: 13, lineHeight: '21px', color: colors.ink }}>{current.desc}</div>

            <h3 style={Object.assign({}, styles.sectionTitle, { marginTop: 20 })}>处理时间线</h3>
            <div style={{ position: 'relative', paddingLeft: 20, marginTop: 12 }}>
              <span style={{ position: 'absolute', left: 5, top: 4, bottom: 4, width: 2, background: colors.lineSoft }}></span>
              {current.timeline.map((tl, idx) => {
                var dot = tl.tone === 'good' ? colors.success : colors.primary;
                return (
                  <div key={idx} style={{ position: 'relative', paddingBottom: idx === current.timeline.length - 1 ? 0 : 14 }}>
                    <span style={{ position: 'absolute', left: -19, top: 3, width: 10, height: 10, borderRadius: 999, background: '#fff', border: '2.5px solid ' + dot }}></span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.ink }}>{tl.who}</span>
                      <span style={{ fontSize: 12, color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>{tl.time}</span>
                    </div>
                    <div style={{ marginTop: 3, fontSize: 13, color: colors.inkSoft, lineHeight: '20px' }}>{tl.text}</div>
                  </div>
                );
              })}
            </div>

            {/* 操作区 */}
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid ' + colors.lineSoft }}>
              <textarea rows="3" placeholder="填写处理进展或结论，提交后同步给发起人…" style={{ width: '100%', padding: '10px 12px', fontSize: 13, lineHeight: '20px', boxSizing: 'border-box' }}></textarea>
              <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" style={{ height: 38, padding: '0 16px', border: '1px solid ' + colors.line, borderRadius: radius.control, background: '#fff', color: colors.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={(e) => { self.claimTicket(); }}>接单</button>
                <button type="button" style={{ height: 38, padding: '0 20px', border: 0, borderRadius: radius.control, background: colors.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={(e) => { self.resolveTicket(); }}>提交处理结果</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
