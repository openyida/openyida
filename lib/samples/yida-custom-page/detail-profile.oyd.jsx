/**
 * 供应商档案（detail-profile 场景 · 原生自定义页面示例 · detail-profile）
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 真实业务对象：供应商档案详情。档案头（评级/标签/操作）+ 关键指标 +
 * Tab 分区（基本信息 / 资质证照 / 合作记录）+ 合作时间线，对齐 canvas 的 detail-profile。
 *
 * 页面级独立主题（赭金棕），零 emoji，功能性内联 SVG，指标带单位与量级。
 */

var FIELDS = { supplierForm: 'FORM-XXX' };

var SUPPLIER = {
  name: '宁波固德精密制造有限公司',
  code: 'SUP-2019-0286',
  initials: '固德',
  level: 'A 级战略',
  category: '结构件 · 精密加工',
  since: '2019 年 3 月',
  region: '浙江宁波',
  contact: '沈国栋',
  phone: '138****6027',
  tags: ['准时交付', '来料合格率高', '年框协议'],
};

var METRICS = [
  { label: '合作年限', value: '6.3', unit: '年' },
  { label: '累计采购', value: '4,280', unit: '万元' },
  { label: '准时交付率', value: '98.2', unit: '%' },
  { label: '来料合格率', value: '99.4', unit: '%' },
];

var TABS = [
  { value: 'basic', label: '基本信息' },
  { value: 'cert', label: '资质证照' },
  { value: 'history', label: '合作记录' },
];

var BASIC_INFO = [
  { label: '企业全称', value: '宁波固德精密制造有限公司' },
  { label: '统一社会信用代码', value: '91330200MA2XXXXX7K' },
  { label: '注册资本', value: '5,000 万元' },
  { label: '法定代表人', value: '沈国栋' },
  { label: '主营范围', value: '精密结构件、CNC 加工、表面处理' },
  { label: '账期政策', value: '月结 60 天' },
  { label: '开票税率', value: '13% 增值税专用发票' },
  { label: '结算银行', value: '中国银行宁波分行' },
];

var CERTS = [
  { name: 'ISO 9001 质量管理体系', no: '00124Q31285R2M', expire: '2026-11-30', status: 'valid' },
  { name: 'IATF 16949 汽车行业', no: '0312-2023-AE', expire: '2025-08-14', status: 'soon' },
  { name: 'ISO 14001 环境管理', no: '00124E10982R1M', expire: '2027-03-22', status: 'valid' },
  { name: '营业执照', no: '91330200MA2XXXXX7K', expire: '长期有效', status: 'valid' },
];

var HISTORY = [
  { date: '2024-07-10', title: '批量交付结构件 12,000 件', desc: '交付及时率 100%，全检合格，质量部评分 9.6。', tone: 'good' },
  { date: '2024-05-22', title: '年度框架协议续签', desc: '锁定 2024-2025 供货价，较上年降本 3.2%。', tone: 'good' },
  { date: '2024-03-08', title: '来料波动预警', desc: '批次 B2403 尺寸公差超差 0.02mm，已 8D 闭环整改。', tone: 'warn' },
  { date: '2023-11-15', title: '产能扩充验厂通过', desc: '新增两条 CNC 产线，月产能提升至 45 万件。', tone: 'good' },
];

var _customState = { tab: 'basic' };

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

export function didMount() {}

export function didUnmount() {}

export function chooseTab(value) {
  _customState.tab = value;
  this.forceUpdate();
}

export function editSupplier() {
  if (!FIELDS.supplierForm || FIELDS.supplierForm === 'FORM-XXX') {
    this.utils.toast({ title: '示例页未绑定供应商表单，接入 formUuid 后可编辑档案', type: 'info' });
    return;
  }
  this.utils.router.push(FIELDS.supplierForm, {}, false);
}

export function renderJsx() {
  var self = this;
  var state = self.getCustomState();
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;

  var colors = {
    ink: '#2A2118', inkSoft: '#6A5C49', muted: '#9A8B76',
    bg: '#F6F2EC', surface: '#FFFFFF', line: '#E7DECF', lineSoft: '#F0EAE0', chipBg: '#EFE7D9',
    primary: '#96652F', primarySoft: '#F2E7D5', primaryDeep: '#7A5121',
    success: '#3F8F5B', successBg: '#E9F3EC',
    warning: '#C17A28', warningBg: '#FAF0DE',
    danger: '#BC4A38', dangerBg: '#FAEBE7',
  };
  var radius = { card: 14, control: 8 };

  var certStatus = {
    valid: { label: '有效', color: colors.success, bg: colors.successBg },
    soon: { label: '即将到期', color: colors.warning, bg: colors.warningBg },
    expired: { label: '已过期', color: colors.danger, bg: colors.dangerBg },
  };

  var styles = {
    page: { minHeight: '100vh', background: colors.bg, color: colors.ink, fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif', fontSize: 14, padding: isMobile ? '14px' : '22px 28px', boxSizing: 'border-box' },
    shell: { maxWidth: 1040, margin: '0 auto' },
    card: { background: colors.surface, border: '1px solid ' + colors.line, borderRadius: radius.card, boxShadow: '0 1px 2px rgba(42,33,24,0.04)' },
  };

  return (
    <div className="oyd-page oyd-supplier-page" style={styles.page}>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>
      <div style={styles.shell}>
        {/* 档案头 */}
        <div style={Object.assign({}, styles.card, { padding: isMobile ? '18px' : '22px 26px', marginBottom: 14 })}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: 60, height: 60, borderRadius: 14, background: colors.primarySoft, color: colors.primaryDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flex: '0 0 60px' }}>{SUPPLIER.initials}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 800 }}>{SUPPLIER.name}</h1>
                <span style={{ height: 22, padding: '0 10px', borderRadius: 6, background: colors.primary, color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{SUPPLIER.level}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: colors.inkSoft }}>{SUPPLIER.code} · {SUPPLIER.category} · 合作起于 {SUPPLIER.since} · {SUPPLIER.region}</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SUPPLIER.tags.map((t) => (
                  <span key={t} style={{ height: 24, padding: '0 10px', borderRadius: 999, background: colors.chipBg, color: colors.primaryDeep, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" style={{ height: 38, padding: '0 16px', border: '1px solid ' + colors.line, borderRadius: radius.control, background: '#fff', color: colors.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={(e) => { self.utils.toast({ title: '联系人：' + SUPPLIER.contact + ' · ' + SUPPLIER.phone, type: 'info' }); }}>
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5C3 3.7 3.7 3 4.5 3H6l1 3-1.6 1c.7 1.6 2 2.9 3.6 3.6L10 12l3 1v1.5c0 .8-.7 1.5-1.5 1.5C6.8 17 3 12.7 3 7z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                联系
              </button>
              <button type="button" style={{ height: 38, padding: '0 18px', border: 0, borderRadius: radius.control, background: colors.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={(e) => { self.editSupplier(); }}>编辑档案</button>
            </div>
          </div>

          {/* 关键指标 */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
            {METRICS.map((m) => (
              <div key={m.label} style={{ padding: '12px 14px', borderRadius: 10, background: colors.lineSoft }}>
                <div style={{ fontSize: 12, color: colors.inkSoft }}>{m.label}</div>
                <div style={{ marginTop: 5, display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: colors.primaryDeep, fontVariantNumeric: 'tabular-nums' }}>{m.value}</span>
                  <span style={{ fontSize: 12, color: colors.muted }}>{m.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab */}
        <div style={Object.assign({}, styles.card, { overflow: 'hidden' })}>
          <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: '1px solid ' + colors.lineSoft }}>
            {TABS.map((t) => {
              var active = t.value === state.tab;
              return (
                <button key={t.value} type="button" style={{ height: 36, padding: '0 16px', border: 0, borderRadius: 8, background: active ? colors.primarySoft : 'transparent', color: active ? colors.primaryDeep : colors.inkSoft, fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer' }} onClick={(e) => { self.chooseTab(t.value); }}>{t.label}</button>
              );
            })}
          </div>

          <div style={{ padding: isMobile ? '16px' : '20px 24px' }}>
            {state.tab === 'basic' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px 32px' }}>
                {BASIC_INFO.map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 12, borderBottom: '1px solid ' + colors.lineSoft }}>
                    <span style={{ fontSize: 13, color: colors.muted, flex: '0 0 auto' }}>{row.label}</span>
                    <span style={{ fontSize: 13, color: colors.ink, fontWeight: 600, textAlign: 'right' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            {state.tab === 'cert' && (
              <div style={{ display: 'grid', gap: 10 }}>
                {CERTS.map((c) => {
                  var st = certStatus[c.status] || certStatus.valid;
                  return (
                    <div key={c.no} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', border: '1px solid ' + colors.line, borderRadius: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 36, height: 36, borderRadius: 8, background: colors.primarySoft, color: colors.primaryDeep, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 36px' }}>
                          <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h6l2.5 2.5V14H4z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M6 7h4M6 9.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                        </span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink }}>{c.name}</div>
                          <div style={{ marginTop: 3, fontSize: 12, color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>证书编号 {c.no} · 有效期至 {c.expire}</div>
                        </div>
                      </div>
                      <span style={{ height: 24, padding: '0 10px', borderRadius: 6, background: st.bg, color: st.color, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {state.tab === 'history' && (
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                <span style={{ position: 'absolute', left: 5, top: 4, bottom: 4, width: 2, background: colors.lineSoft }}></span>
                {HISTORY.map((h, idx) => {
                  var dot = h.tone === 'warn' ? colors.warning : colors.primary;
                  return (
                    <div key={h.date + '-' + h.title} style={{ position: 'relative', paddingBottom: idx === HISTORY.length - 1 ? 0 : 18 }}>
                      <span style={{ position: 'absolute', left: -19, top: 3, width: 10, height: 10, borderRadius: 999, background: '#fff', border: '2.5px solid ' + dot }}></span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: colors.ink }}>{h.title}</span>
                        <span style={{ fontSize: 12, color: colors.muted, fontVariantNumeric: 'tabular-nums' }}>{h.date}</span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 13, color: colors.inkSoft, lineHeight: '20px' }}>{h.desc}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
