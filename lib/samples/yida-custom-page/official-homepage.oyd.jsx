/**
 * 服务机构官网（official-homepage 场景 · 原生自定义页面示例 · official-homepage）
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 真实业务对象：企业法税服务机构官网。顶部导航 + Hero + 数据条 + 服务矩阵 +
 * 服务流程 + 客户案例 + 底部行动区，对齐 canvas 的 official-homepage。
 *
 * 页面级独立主题（墨绿茶感），零 emoji，功能性内联 SVG，成绩数据带量级与单位。
 */

var NAV = ['服务范围', '服务流程', '客户案例', '关于我们'];

var STATS = [
  { value: '2,600', unit: '家+', label: '累计服务企业' },
  { value: '15', unit: '年', label: '深耕法税领域' },
  { value: '98.6', unit: '%', label: '客户续约率' },
  { value: '40', unit: '人', label: '执业顾问团队' },
];

var SERVICES = [
  { title: '企业法律顾问', desc: '合同审查、股权架构、劳动用工、争议应对，按年框提供常态化法律支持。', points: ['合同全流程审查', '股权与治理设计', '劳动合规体检'] },
  { title: '财税筹划服务', desc: '结合行业与政策，做合规前提下的税务优化与申报托管，降低涉税风险。', points: ['税务健康诊断', '申报代理托管', '专项优惠申请'] },
  { title: '知识产权保护', desc: '商标、专利、著作权全链条布局与维权，为品牌资产筑起护城河。', points: ['商标注册布局', '专利挖掘申请', '侵权取证维权'] },
  { title: '合规与风控', desc: '数据合规、反舞弊、内控制度搭建，帮助企业在扩张期守住底线。', points: ['数据合规审查', '内控制度搭建', '尽职调查支持'] },
];

var PROCESS = [
  { step: '01', title: '需求诊断', desc: '一对一沟通，梳理企业当前法税痛点与目标。' },
  { step: '02', title: '方案定制', desc: '出具书面服务方案与报价，明确交付节点。' },
  { step: '03', title: '落地执行', desc: '专属顾问团队进场，按里程碑推进交付。' },
  { step: '04', title: '持续跟进', desc: '定期回访与合规复盘，动态调整策略。' },
];

var CASES = [
  { name: '某智能制造上市公司', tag: '股权重组', text: '完成 3 层控股架构搭建与员工持股平台设计，为科创板上市扫清合规障碍。' },
  { name: '某连锁餐饮集团', tag: '税务筹划', text: '梳理 42 家门店涉税事项，合规前提下年度税负优化约 260 万元。' },
  { name: '某跨境电商品牌', tag: '知产维权', text: '完成 18 类商标全球布局，一年内处理侵权投诉 30 余起，胜诉率 100%。' },
];

var _customState = {};

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

export function contactUs() {
  this.utils.toast({ title: '已收到咨询意向，顾问将在 1 个工作日内联系您（示例演示）', type: 'success' });
}

export function renderJsx() {
  var self = this;
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;

  var colors = {
    ink: '#1C2A25', inkSoft: '#4C5C55', muted: '#7E8D85', onDark: '#EAF3EE', onDarkSoft: '#AEC7BC',
    bg: '#FBFAF6', surface: '#FFFFFF', line: '#E6E7DF', lineSoft: '#F0F0E8', chipBg: '#EAF0EB',
    primary: '#2C5548', primarySoft: '#E6EFE9', primaryDeep: '#1F3E34',
    accent: '#B08A3E', accentSoft: '#F4ECDA',
  };
  var radius = { card: 16, control: 10, pill: 999 };

  var styles = {
    page: { background: colors.bg, color: colors.ink, fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif', fontSize: 14, minHeight: '100vh', boxSizing: 'border-box' },
    shell: { maxWidth: 1120, margin: '0 auto', padding: isMobile ? '0 16px' : '0 28px' },
    card: { background: colors.surface, border: '1px solid ' + colors.line, borderRadius: radius.card },
    sectionTitle: { margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 800, color: colors.ink, letterSpacing: 0.3 },
    sectionSub: { marginTop: 8, fontSize: 14, color: colors.muted },
  };

  return (
    <div className="oyd-page oyd-site-page" style={styles.page}>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>

      {/* 顶部导航 */}
      <div style={{ borderBottom: '1px solid ' + colors.line, background: 'rgba(251,250,246,0.92)' }}>
        <div style={Object.assign({}, styles.shell, { height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: colors.primary, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>明</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: colors.primaryDeep }}>明诚法税服务</span>
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', gap: 28 }}>
              {NAV.map((n) => (<span key={n} style={{ fontSize: 14, color: colors.inkSoft, cursor: 'pointer', fontWeight: 500 }}>{n}</span>))}
            </div>
          )}
          <button type="button" style={{ height: 38, padding: '0 18px', border: 0, borderRadius: radius.control, background: colors.primary, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }} onClick={(e) => { self.contactUs(); }}>预约咨询</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(160deg, ' + colors.primaryDeep + ' 0%, ' + colors.primary + ' 100%)' }}>
        <div style={Object.assign({}, styles.shell, { padding: isMobile ? '48px 16px' : '76px 28px' })}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: radius.pill, background: 'rgba(176,138,62,0.22)', color: colors.accentSoft, fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: colors.accent }}></span>为成长型企业保驾护航
          </span>
          <h1 style={{ margin: isMobile ? '18px 0 0' : '22px 0 0', fontSize: isMobile ? 30 : 44, fontWeight: 800, color: '#fff', lineHeight: 1.2, maxWidth: 760 }}>让法律与财税，成为企业增长的确定性</h1>
          <p style={{ marginTop: 18, fontSize: isMobile ? 15 : 17, color: colors.onDarkSoft, lineHeight: 1.7, maxWidth: 620 }}>15 年专注企业法税一体化服务，40 人执业顾问团队，从合同、股权到税务筹划，用专业把风险挡在门外。</p>
          <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" style={{ height: 46, padding: '0 26px', border: 0, borderRadius: radius.control, background: colors.accent, color: '#2A2010', fontSize: 15, fontWeight: 700, cursor: 'pointer' }} onClick={(e) => { self.contactUs(); }}>获取专属方案</button>
            <button type="button" style={{ height: 46, padding: '0 24px', border: '1px solid rgba(234,243,238,0.4)', borderRadius: radius.control, background: 'transparent', color: colors.onDark, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={(e) => { self.utils.toast({ title: '四步交付流程：需求诊断 → 方案定制 → 落地执行 → 持续跟进', type: 'info' }); }}>了解服务流程</button>
          </div>
        </div>
      </div>

      {/* 数据条 */}
      <div style={Object.assign({}, styles.shell, { marginTop: -32, position: 'relative', zIndex: 2 })}>
        <div style={Object.assign({}, styles.card, { boxShadow: '0 12px 30px rgba(28,42,37,0.1)', padding: isMobile ? '18px' : '22px 28px', display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 16 })}>
          {STATS.map((s, idx) => (
            <div key={s.label} style={{ textAlign: 'center', borderRight: !isMobile && idx < STATS.length - 1 ? '1px solid ' + colors.lineSoft : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: colors.primary, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                <span style={{ fontSize: 14, color: colors.accent, fontWeight: 700 }}>{s.unit}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: colors.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 服务矩阵 */}
      <div style={Object.assign({}, styles.shell, { padding: isMobile ? '48px 16px 0' : '72px 28px 0' })}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={styles.sectionTitle}>四大核心服务</h2>
          <p style={styles.sectionSub}>覆盖企业从初创到扩张的法税全周期需求</p>
        </div>
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 16 }}>
          {SERVICES.map((s) => (
            <div key={s.title} style={Object.assign({}, styles.card, { padding: isMobile ? '20px' : '24px 26px' })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 42, height: 42, borderRadius: 11, background: colors.primarySoft, color: colors.primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 42px' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2l6 3v5c0 3.6-2.5 6.3-6 7.6C6.5 16.3 4 13.6 4 10V5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M7.4 10l1.8 1.8L13 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.ink }}>{s.title}</h3>
              </div>
              <p style={{ marginTop: 12, fontSize: 14, color: colors.inkSoft, lineHeight: 1.7 }}>{s.desc}</p>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {s.points.map((p) => (
                  <span key={p} style={{ height: 26, padding: '0 10px', borderRadius: radius.pill, background: colors.chipBg, color: colors.primaryDeep, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 服务流程 */}
      <div style={Object.assign({}, styles.shell, { padding: isMobile ? '48px 16px 0' : '72px 28px 0' })}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={styles.sectionTitle}>四步交付流程</h2>
          <p style={styles.sectionSub}>标准化推进，每个节点都有书面交付物</p>
        </div>
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,1fr)', gap: 16 }}>
          {PROCESS.map((p) => (
            <div key={p.step} style={Object.assign({}, styles.card, { padding: '22px 20px' })}>
              <span style={{ fontSize: 26, fontWeight: 800, color: colors.accent, fontVariantNumeric: 'tabular-nums' }}>{p.step}</span>
              <h3 style={{ margin: '10px 0 0', fontSize: 16, fontWeight: 700, color: colors.ink }}>{p.title}</h3>
              <p style={{ marginTop: 8, fontSize: 13, color: colors.inkSoft, lineHeight: 1.6 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 客户案例 */}
      <div style={Object.assign({}, styles.shell, { padding: isMobile ? '48px 16px 0' : '72px 28px 0' })}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={styles.sectionTitle}>他们信任明诚</h2>
          <p style={styles.sectionSub}>真实项目，看得见的价值</p>
        </div>
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 16 }}>
          {CASES.map((c) => (
            <div key={c.name} style={Object.assign({}, styles.card, { padding: '22px 22px' })}>
              <span style={{ height: 24, padding: '0 10px', borderRadius: radius.pill, background: colors.accentSoft, color: colors.accent, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{c.tag}</span>
              <p style={{ marginTop: 14, fontSize: 14, color: colors.ink, lineHeight: 1.7 }}>{c.text}</p>
              <div style={{ marginTop: 14, fontSize: 13, color: colors.muted, fontWeight: 600 }}>— {c.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={Object.assign({}, styles.shell, { padding: isMobile ? '48px 16px' : '72px 28px' })}>
        <div style={{ borderRadius: 20, background: 'linear-gradient(135deg, ' + colors.primaryDeep + ', ' + colors.primary + ')', padding: isMobile ? '32px 22px' : '48px 56px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 30, fontWeight: 800, color: '#fff' }}>先做一次免费的法税健康诊断</h2>
          <p style={{ marginTop: 12, fontSize: 15, color: colors.onDarkSoft }}>留下需求，资深顾问 1 个工作日内为您梳理风险清单。</p>
          <button type="button" style={{ marginTop: 24, height: 48, padding: '0 32px', border: 0, borderRadius: radius.control, background: colors.accent, color: '#2A2010', fontSize: 16, fontWeight: 700, cursor: 'pointer' }} onClick={(e) => { self.contactUs(); }}>立即预约咨询</button>
        </div>
      </div>

      {/* 页脚 */}
      <div style={{ borderTop: '1px solid ' + colors.line }}>
        <div style={Object.assign({}, styles.shell, { padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 })}>
          <span style={{ fontSize: 13, color: colors.muted }}>明诚企业法税服务中心 · 专业 · 稳健 · 长期主义</span>
          <span style={{ fontSize: 13, color: colors.muted }}>咨询热线 400-618-0286</span>
        </div>
      </div>
    </div>
  );
}
