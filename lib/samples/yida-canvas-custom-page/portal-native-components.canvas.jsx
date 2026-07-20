import React, { useMemo, useState } from 'react';

const CANVAS_CONTROL_RESET_CSS = `
.oy-native-portal {
  --oy-control-border: #D9CCFF;
  --oy-control-focus: #7C3AED;
  --oy-control-focus-ring: rgba(124, 58, 237, .18);
  --oy-control-hover: #A78BFA;
  --oy-control-active-bg: #F4F0FF;
  --oy-brand: #7C3AED;
  --oy-brand-deep: #3B0764;
  --oy-brand-mid: #5B21B6;
  --oy-brand-soft: #F4F0FF;
  --oy-brand-line: #D9CCFF;
  --oy-text: #1E1734;
  --oy-muted: #6F5F91;
  --oy-line: #E5DDFF;
  --oy-surface-soft: #FAF7FF;
}
.oy-native-portal :where(input, textarea, select, button, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number, .ant-segmented, .ant-btn) {
  font-family: inherit;
  letter-spacing: 0;
}
.oy-native-portal :where(input, textarea, select, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number) {
  border-color: var(--oy-control-border) !important;
  color: var(--oy-text);
  font-weight: 400;
  outline: none !important;
  box-shadow: none !important;
}
.oy-native-portal :where(input, textarea, select, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number):hover {
  border-color: var(--oy-control-hover) !important;
}
.oy-native-portal :where(input, textarea, select, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number):focus,
.oy-native-portal :where(.ant-input-affix-wrapper, .ant-select-focused .ant-select-selector, .ant-picker-focused, .ant-input-number-focused) {
  border-color: var(--oy-control-focus) !important;
  box-shadow: 0 0 0 3px var(--oy-control-focus-ring) !important;
  outline: none !important;
}
.oy-native-portal :where(.ant-select-selection-item, .ant-select-selection-placeholder, .ant-input, input, textarea) {
  color: var(--oy-text);
  font-weight: 400;
}
.oy-native-portal :where(.ant-select-dropdown, .ant-picker-dropdown) {
  border: 1px solid #d7dee8;
  border-radius: 10px;
  box-shadow: 0 14px 36px rgba(91, 33, 182, .14);
  overflow: hidden;
}
.oy-native-portal :where(.ant-select-item-option-active, .ant-select-item-option-selected) {
  background: var(--oy-control-active-bg) !important;
  color: var(--oy-brand) !important;
  font-weight: 600;
}
`;

const ENTRY_ITEMS = [
  { title: '事项发起', desc: '提交材料与协作信息', url: '#start', group: '常用', icon: 'yingyong', count: '18', image: 'collab' },
  { title: '流程跟进', desc: '查看处理进度', url: '#progress', group: '常用', icon: 'liucheng', count: '32', image: 'chairs' },
  { title: '数据概览', desc: '查看门户指标', url: '#insight', group: '数据', icon: 'shuju', count: '7', image: 'containers' },
  { title: '资料中心', desc: '沉淀常用文档', url: '#files', group: '资料', icon: 'wenjian', count: '146', image: 'bins' },
  { title: '合同归档', desc: '复核附件与归档状态', url: '#archive', group: '资料', icon: 'wenjian', count: '24', image: 'containers' },
  { title: '成员排班', desc: '查看本周负责人与部门', url: '#roster', group: '组织', icon: 'yingyong', count: '9', image: 'collab' },
];

const BACKGROUND_IMAGES = {
  collab: 'https://images.unsplash.com/photo-1759884247160-27b8465544b6?auto=format&fit=crop&w=1200&q=80',
  containers: 'https://images.unsplash.com/photo-1566346654781-14e3ef6ee988?auto=format&fit=crop&w=1200&q=80',
  chairs: 'https://images.unsplash.com/photo-1771147372627-7fffe86cf00b?auto=format&fit=crop&w=1200&q=80',
  bins: 'https://images.unsplash.com/photo-1566346654781-14e3ef6ee988?auto=format&fit=crop&w=1200&q=80',
};

const SHELL_NAV = [
  { label: '工作台', active: true },
  { label: '流程队列', active: false },
  { label: '资料中心', active: false },
  { label: '成员协同', active: false },
  { label: '运行诊断', active: false },
];

const PORTAL_METRICS = [
  { label: '待处理事项', value: '38', trend: '+12%', detail: '跨部门待确认 6 项' },
  { label: '材料完整率', value: '96%', trend: '+8%', detail: '本周补齐 142 份' },
  { label: '平均流转时长', value: '2.6h', trend: '-18%', detail: '较上周更快完成' },
];

const PROCESS_QUEUE = [
  { code: 'OPS-240717-018', title: '华东门店物料补齐', owner: '运营中台', status: '待补材料', time: '10:30' },
  { code: 'FIN-240717-009', title: '渠道返利复核', owner: '财务共享', status: '待部门确认', time: '13:40' },
  { code: 'HR-240717-022', title: '暑期排班确认', owner: '组织发展', status: '处理中', time: '15:15' },
  { code: 'IT-240717-031', title: '设备巡检异常', owner: '服务台', status: '需跟进', time: '16:20' },
];

const MATERIAL_AUDITS = [
  { label: '合同附件', value: 92 },
  { label: '审批说明', value: 78 },
  { label: '发票资料', value: 86 },
  { label: '交付凭证', value: 64 },
];

const INSIGHT_CARDS = [
  { label: '在线协作人', value: '128', detail: '横跨 7 个团队', tone: 'violet' },
  { label: '今日新增资料', value: '64', detail: '18 份待复核', tone: 'indigo' },
  { label: '高优先级', value: '9', detail: '3 项超过 SLA', tone: 'rose' },
];

function getDeepYidaBundle() {
  const deepYida = window.DeepYida;
  if (!deepYida) return null;
  if (Array.isArray(deepYida)) return deepYida;
  if (Array.isArray(deepYida.default)) return deepYida.default;
  if (Array.isArray(deepYida.components)) return deepYida.components;
  return deepYida;
}

function findYidaComponent(name) {
  const native = window.YidaNativeComponents || {};
  if (native[name]) return native[name];

  const deep = window.Deep || {};
  if (deep[name]) return deep[name];

  const bundle = getDeepYidaBundle();
  if (!bundle) return null;
  if (bundle[name]) return bundle[name];
  if (Array.isArray(bundle)) {
    return bundle.find((item) => item && (item.displayName === name || item.name === name)) || null;
  }
  return null;
}

function toList(input) {
  if (!input) return [];
  if (input.value && Array.isArray(input.value)) return input.value;
  if (input.value && typeof input.value === 'object') return [input.value];
  return Array.isArray(input) ? input : [input];
}

function normalizeEmployeeValue(input) {
  return toList(input).map((item) => ({
    userId: item.userId || item.userid || item.value || item.emplId || '',
    emplId: item.emplId || item.value || item.userId || '',
    name: item.name || item.label || item.text || item.nickName || '',
    nickName: item.nickName || '',
    workNo: item.workNo || '',
    avatar: item.avatar || item.avatarUrl || '',
    raw: item,
  }));
}

function normalizeDepartmentValue(input) {
  return toList(input).map((item) => ({
    deptId: item.deptId || item.value || item.id || '',
    value: item.value || item.deptId || item.id || '',
    name: item.name || item.text || item.label || '',
    text: item.text || item.name || item.label || '',
    deptFullPath: item.deptFullPath || '',
    raw: item,
  }));
}

function normalizeFileValue(input) {
  return toList(input).map((item) => {
    const response = item.response || {};
    const content = response.content || response || {};
    return {
      name: item.name || content.name || content.fileName || '',
      url: item.url || content.url || content.previewUrl || '',
      downloadURL: item.downloadURL || content.downloadURL || content.downloadUrl || '',
      imgURL: item.imgURL || content.imgURL || content.previewUrl || '',
      fileId: item.fileId || content.fileId || content.sequence || '',
      size: item.size || content.size || 0,
      type: item.type || content.type || '',
      raw: item,
    };
  });
}

function getNativeDiagnostics(native) {
  const deep = window.Deep || {};
  const bundle = getDeepYidaBundle();
  return {
    hasDeep: !!window.Deep,
    hasDeepYida: !!window.DeepYida,
    deepKeys: Object.keys(deep).slice(0, 40),
    deepYidaDisplayNames: Array.isArray(bundle)
      ? bundle.map((item) => item && item.displayName).filter(Boolean).slice(0, 80)
      : [],
    available: Object.keys(native).filter((key) => !!native[key]),
    missing: Object.keys(native).filter((key) => !native[key]),
  };
}

function PortalRail() {
  return (
    <aside className="oy-portal-rail">
      <div className="oy-portal-brand">
        <b>OY</b>
        <span>Native Portal</span>
      </div>
      <nav>
        {SHELL_NAV.map((item) => (
          <a className={item.active ? 'active' : ''} href="#portal" key={item.label}>{item.label}</a>
        ))}
      </nav>
      <div className="oy-rail-note">
        <strong>组件状态</strong>
        <span>Portal + Fields + Upload</span>
      </div>
    </aside>
  );
}

function PortalCommandBar() {
  return (
    <header className="oy-command-bar">
      <div>
        <p className="oy-kicker">Purple SaaS Shell</p>
        <h1>统一业务门户</h1>
      </div>
      <div className="oy-command-actions">
        <button type="button">同步数据</button>
        <button type="button">分享视图</button>
      </div>
    </header>
  );
}

function VioletPortalHero() {
  return (
    <section
      className="oy-hero"
      style={{ '--oy-hero-image': `url("${BACKGROUND_IMAGES.collab}")` }}
    >
      <div>
        <p className="oy-kicker">Native Components Workspace</p>
        <h2>把宜搭原生能力组织成一个真正的门户工作台</h2>
        <p className="oy-hero-desc">把导航、入口、流程、材料和成员协同组织到同一张紫色工作台里，内容区用真实业务数据承接原生组件。</p>
        <div className="oy-hero-tags">
          <span>7 个部门在线</span>
          <span>24 小时流转视图</span>
          <span>材料完整性校验</span>
        </div>
      </div>
      <div className="oy-hero-metrics">
        {PORTAL_METRICS.map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <em>{item.trend}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function InsightBand() {
  return (
    <section className="oy-insight-band">
      {INSIGHT_CARDS.map((item) => (
        <article className={`oy-insight-card ${item.tone}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <em>{item.detail}</em>
        </article>
      ))}
    </section>
  );
}

function FallbackQuickEntry() {
  return (
    <section className="oy-section oy-entry-section">
      <div className="oy-section-head">
        <h2>快捷入口</h2>
        <span>高频业务入口</span>
      </div>
      <div className="oy-entry-grid">
        {ENTRY_ITEMS.map((item) => (
          <a
            className="oy-entry"
            href={item.url}
            key={item.title}
            style={{ '--oy-entry-image': `url("${BACKGROUND_IMAGES[item.image]}")` }}
          >
            <span className="oy-entry-icon">{item.count}</span>
            <span>
              <strong>{item.title}</strong>
              <em>{item.desc}</em>
            </span>
            <b>{item.group}</b>
          </a>
        ))}
      </div>
    </section>
  );
}

function PortalOpsOverview() {
  return (
    <section className="oy-section oy-ops-overview">
      <div className="oy-section-head">
        <h2>流程队列</h2>
        <span>今日高优先级</span>
      </div>
      <div className="oy-queue-list">
        {PROCESS_QUEUE.map((item) => (
          <article className="oy-queue-item" key={item.code}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.code} · {item.owner}</span>
            </div>
            <em>{item.status}</em>
            <time>{item.time}</time>
          </article>
        ))}
      </div>
    </section>
  );
}

function MaterialAuditPanel() {
  return (
    <section className="oy-section oy-material-panel">
      <div className="oy-section-head">
        <h2>材料完整性</h2>
        <span>字段组件联动</span>
      </div>
      <div className="oy-audit-list">
        {MATERIAL_AUDITS.map((item) => (
          <div className="oy-audit-row" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}%</strong>
            <i><b style={{ width: item.value + '%' }} /></i>
          </div>
        ))}
      </div>
    </section>
  );
}

function TextTagInput({ label, placeholder, value, onChange, valueType }) {
  const [text, setText] = useState('');

  function addItem() {
    const next = text.trim();
    if (!next) return;
    if (valueType === 'department') {
      onChange([].concat(value || [], [{ deptId: next, value: next, name: next, text: next, raw: { text: next } }]));
    } else if (valueType === 'file') {
      onChange([].concat(value || [], [{ name: next, url: next, downloadURL: next, raw: { url: next } }]));
    } else {
      onChange([].concat(value || [], [{ userId: next, emplId: next, name: next, raw: { text: next } }]));
    }
    setText('');
  }

  return (
    <div className="oy-field">
      <label>{label}</label>
      <div className="oy-input-row">
        <input value={text} placeholder={placeholder} onChange={(event) => setText(event.target.value)} />
        <button type="button" onClick={addItem}>添加</button>
      </div>
      <div className="oy-tags">
        {(value || []).map((item, index) => (
          <button
            type="button"
            key={(item.userId || item.deptId || item.url || item.name || index) + index}
            onClick={() => onChange((value || []).filter((_, itemIndex) => itemIndex !== index))}
          >
            {item.name || item.text || item.url}
          </button>
        ))}
      </div>
    </div>
  );
}

function DiagnosticsPanel({ diagnostics }) {
  return (
    <details className="oy-diagnostics">
      <summary>运行态组件</summary>
      <div className="oy-diag-grid">
        <div>
          <strong>可用</strong>
          <p>{diagnostics.available.join(', ') || '无'}</p>
        </div>
        <div>
          <strong>缺失</strong>
          <p>{diagnostics.missing.join(', ') || '无'}</p>
        </div>
      </div>
    </details>
  );
}

class NativeComponentBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: '' };
  }

  static getDerivedStateFromError(error) {
    return { error: error && error.message ? error.message : String(error) };
  }

  componentDidCatch() {}

  render() {
    if (this.state.error) {
      return (
        <div className="oy-native-fallback">
          <strong>{this.props.title || '运行态组件不可用'}</strong>
          <span>{this.state.error}</span>
          {this.props.fallback || null}
        </div>
      );
    }
    return this.props.children;
  }
}

function NativeFormPanel({ native }) {
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [files, setFiles] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const EmployeeField = native.EmployeeField;
  const DepartmentSelectField = native.DepartmentSelectField;
  const UploadField = native.AttachmentField || native.ImageField;

  const payload = {
    members,
    departments,
    files,
    submittedAt: submitted ? new Date().toISOString() : '',
  };

  return (
    <section className="oy-section oy-form-section">
      <div className="oy-section-head">
        <h2>协作信息</h2>
        <span>成员 / 部门 / 上传</span>
      </div>

      <div className="oy-form-grid">
        {EmployeeField ? (
          <div className="oy-field">
            <label>负责人</label>
            <NativeComponentBoundary
              title="负责人组件降级"
              fallback={(
                <TextTagInput
                  label="负责人"
                  placeholder="输入成员名称或 userId"
                  value={members}
                  onChange={setMembers}
                  valueType="employee"
                />
              )}
            >
              <EmployeeField
                multiple
                value={members}
                onChange={(next) => setMembers(normalizeEmployeeValue(next))}
              />
            </NativeComponentBoundary>
          </div>
        ) : (
          <TextTagInput
            label="负责人"
            placeholder="输入成员名称或 userId"
            value={members}
            onChange={setMembers}
            valueType="employee"
          />
        )}

        {DepartmentSelectField ? (
          <div className="oy-field">
            <label>协作部门</label>
            <NativeComponentBoundary
              title="部门组件降级"
              fallback={(
                <TextTagInput
                  label="协作部门"
                  placeholder="输入部门名称或 deptId"
                  value={departments}
                  onChange={setDepartments}
                  valueType="department"
                />
              )}
            >
              <DepartmentSelectField
                multiple
                value={departments}
                onChange={(next) => setDepartments(normalizeDepartmentValue(next))}
              />
            </NativeComponentBoundary>
          </div>
        ) : (
          <TextTagInput
            label="协作部门"
            placeholder="输入部门名称或 deptId"
            value={departments}
            onChange={setDepartments}
            valueType="department"
          />
        )}

        {UploadField ? (
          <div className="oy-field oy-field-wide">
            <label>材料附件</label>
            <NativeComponentBoundary
              title="上传组件降级"
              fallback={(
                <TextTagInput
                  label="材料附件"
                  placeholder="粘贴文件 URL"
                  value={files}
                  onChange={setFiles}
                  valueType="file"
                />
              )}
            >
              <UploadField
                multiple
                value={files}
                onChange={(next) => setFiles(normalizeFileValue(next))}
                onSuccess={(result) => setFiles((prev) => normalizeFileValue([].concat(prev || [], result)))}
              />
            </NativeComponentBoundary>
          </div>
        ) : (
          <TextTagInput
            label="材料附件"
            placeholder="粘贴文件 URL"
            value={files}
            onChange={setFiles}
            valueType="file"
          />
        )}
      </div>

      <div className="oy-submit-row">
        <button type="button" onClick={() => setSubmitted(true)}>生成提交数据</button>
      </div>

      <pre className="oy-payload">{JSON.stringify(payload, null, 2)}</pre>
    </section>
  );
}

function YidaComp() {
  const native = useMemo(() => ({
    PortalTopBanner: findYidaComponent('PortalTopBanner'),
    PortalQuickEntry: findYidaComponent('PortalQuickEntry'),
    QuickAccessCard: findYidaComponent('QuickAccessCard'),
    RecentlyUsedCard: findYidaComponent('RecentlyUsedCard'),
    DataCard: findYidaComponent('DataCard'),
    EmployeeField: findYidaComponent('EmployeeField'),
    DepartmentSelectField: findYidaComponent('DepartmentSelectField'),
    AttachmentField: findYidaComponent('AttachmentField'),
    ImageField: findYidaComponent('ImageField'),
  }), []);

  const diagnostics = useMemo(() => getNativeDiagnostics(native), [native]);
  return (
    <div className="oy-native-portal">
      <style>{CANVAS_CONTROL_RESET_CSS + PAGE_CSS}</style>
      <PortalRail />
      <div className="oy-portal-main" id="portal">
        <PortalCommandBar />
        <VioletPortalHero />
        <InsightBand />
        <FallbackQuickEntry />

        <div className="oy-two-column">
          <div>
            <PortalOpsOverview />
            <NativeFormPanel native={native} />
          </div>
          <aside className="oy-side-stack">
            <MaterialAuditPanel />
            <section className="oy-section oy-side">
              <div className="oy-section-head">
                <h2>门户动态</h2>
                <span>运行态增强</span>
              </div>
              {native.QuickAccessCard ? (
                <NativeComponentBoundary title="门户动态组件降级">
                  <native.QuickAccessCard
                    theme="row-white"
                    maxItems={6}
                    showTitle={false}
                    viewMore={false}
                    showAppDescription={false}
                    containerPrefix="oy-native-portal"
                    enableCancelAccess
                  />
                </NativeComponentBoundary>
              ) : (
                <div className="oy-feed">
                  {PORTAL_METRICS.map((item) => (
                    <p key={item.label}><strong>{item.label} {item.value}</strong><span>{item.detail}</span></p>
                  ))}
                </div>
              )}
              <DiagnosticsPanel diagnostics={diagnostics} />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

const PAGE_CSS = `
.oy-native-portal {
  position: relative;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 0;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 0;
  color: var(--oy-text);
  background:
    radial-gradient(circle at 18% 4%, rgba(167, 139, 250, .28), transparent 28%),
    radial-gradient(circle at 96% 6%, rgba(236, 72, 153, .16), transparent 30%),
    linear-gradient(135deg, #F5F1FF 0%, #FBFAFF 42%, #FFFFFF 100%);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0;
}
.oy-native-portal * { box-sizing: border-box; }
.oy-portal-rail {
  position: sticky;
  top: 0;
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  gap: 22px;
  padding: 24px 20px;
  color: #F5F3FF;
  background:
    linear-gradient(180deg, rgba(46, 16, 101, .96), rgba(76, 29, 149, .94)),
    linear-gradient(145deg, #2E1065, #6D28D9);
  box-shadow: 24px 0 70px rgba(46, 16, 101, .22);
}
.oy-portal-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.oy-portal-brand b {
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  color: #3B0764;
  background: #FFFFFF;
  font-size: 14px;
}
.oy-portal-brand span {
  font-size: 15px;
  font-weight: 900;
  line-height: 20px;
}
.oy-portal-rail nav {
  display: grid;
  gap: 8px;
}
.oy-portal-rail a {
  display: flex;
  min-height: 42px;
  align-items: center;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 14px;
  color: rgba(255,255,255,.72);
  text-decoration: none;
  font-size: 14px;
  font-weight: 800;
}
.oy-portal-rail a.active {
  border-color: rgba(255,255,255,.24);
  color: #FFFFFF;
  background: rgba(255,255,255,.14);
}
.oy-rail-note {
  margin-top: auto;
  padding: 14px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 18px;
  background: rgba(255,255,255,.10);
}
.oy-rail-note strong,
.oy-rail-note span {
  display: block;
}
.oy-rail-note span {
  margin-top: 5px;
  color: rgba(255,255,255,.66);
  font-size: 12px;
  line-height: 18px;
}
.oy-portal-main {
  min-width: 0;
  padding: 24px 28px 34px;
}
.oy-command-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.oy-command-bar h1 {
  margin: 0;
  color: #1E1734;
  font-size: 24px;
  line-height: 32px;
  font-weight: 900;
}
.oy-command-actions {
  display: flex;
  gap: 10px;
}
.oy-command-actions button {
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--oy-line);
  border-radius: 12px;
  color: var(--oy-text);
  background: rgba(255,255,255,.78);
  font-weight: 800;
  cursor: pointer;
}
.oy-command-actions button:first-child {
  border-color: transparent;
  color: #FFFFFF;
  background: linear-gradient(135deg, #7C3AED, #C026D3);
  box-shadow: 0 14px 32px rgba(124, 58, 237, .24);
}
.oy-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 420px);
  gap: 28px;
  align-items: end;
  min-height: 318px;
  padding: 34px;
  overflow: hidden;
  border-radius: 26px;
  color: #fff;
  border: 1px solid rgba(255,255,255,.56);
  background:
    linear-gradient(90deg, rgba(46, 16, 101, .94) 0%, rgba(91, 33, 182, .78) 48%, rgba(192, 38, 211, .38) 100%),
    var(--oy-hero-image) center / cover no-repeat;
  box-shadow: 0 34px 90px rgba(76, 29, 149, .26);
}
.oy-hero::after {
  content: "";
  position: absolute;
  inset: auto -80px -140px auto;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: rgba(255,255,255,.16);
}
.oy-hero > * {
  position: relative;
  z-index: 1;
}
.oy-kicker {
  margin: 0 0 8px;
  color: #DDD6FE;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.oy-hero h2 {
  margin: 0;
  max-width: 720px;
  font-size: 42px;
  line-height: 52px;
  font-weight: 900;
}
.oy-hero-desc {
  max-width: 620px;
  margin: 12px 0 0;
  color: rgba(255,255,255,.86);
  font-size: 16px;
  line-height: 26px;
}
.oy-hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.oy-hero-tags span {
  padding: 7px 12px;
  border: 1px solid rgba(255,255,255,.28);
  border-radius: 999px;
  color: #fff;
  background: rgba(255,255,255,.14);
  backdrop-filter: blur(12px);
  font-size: 12px;
  font-weight: 700;
}
.oy-hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.oy-hero-metrics div {
  min-height: 116px;
  padding: 16px;
  border: 1px solid rgba(255,255,255,.32);
  border-radius: 16px;
  background: rgba(255,255,255,.18);
  backdrop-filter: blur(16px);
}
.oy-hero-metrics strong {
  display: block;
  color: #fff;
  font-size: 30px;
  line-height: 34px;
}
.oy-hero-metrics span {
  display: block;
  margin-top: 8px;
  color: rgba(255,255,255,.78);
  font-size: 12px;
}
.oy-hero-metrics em {
  display: inline-block;
  margin-top: 10px;
  padding: 3px 7px;
  border-radius: 999px;
  color: #4C1D95;
  background: #F3E8FF;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}
.oy-insight-band {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}
.oy-insight-card {
  min-height: 128px;
  padding: 18px;
  border: 1px solid rgba(124, 58, 237, .16);
  border-radius: 20px;
  background: rgba(255,255,255,.82);
  box-shadow: 0 18px 48px rgba(76, 29, 149, .10);
}
.oy-insight-card span,
.oy-insight-card strong,
.oy-insight-card em {
  display: block;
}
.oy-insight-card span {
  color: var(--oy-muted);
  font-size: 13px;
  font-weight: 800;
}
.oy-insight-card strong {
  margin-top: 12px;
  color: #1E1734;
  font-size: 38px;
  line-height: 42px;
}
.oy-insight-card em {
  margin-top: 8px;
  color: var(--oy-brand);
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
}
.oy-section {
  margin-top: 16px;
  padding: 18px;
  border: 1px solid var(--oy-line);
  border-radius: 20px;
  background: rgba(255,255,255,.86);
  box-shadow: 0 18px 48px rgba(76, 29, 149, .08);
}
.oy-section-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}
.oy-section-head h2 {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
}
.oy-section-head span {
  color: var(--oy-muted);
  font-size: 12px;
}
.oy-entry-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}
.oy-entry {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  min-height: 148px;
  padding: 16px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.48);
  border-radius: 20px;
  color: #fff;
  text-decoration: none;
  background:
    linear-gradient(180deg, rgba(46, 16, 101, .16), rgba(91, 33, 182, .78)),
    var(--oy-entry-image) center / cover no-repeat;
  box-shadow: 0 18px 42px rgba(76, 29, 149, .16);
}
.oy-entry::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, rgba(167, 139, 250, .28), transparent 48%);
}
.oy-entry > * {
  position: relative;
  z-index: 1;
}
.oy-entry-icon {
  display: inline-flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  flex: 0 0 42px;
  border-radius: 14px;
  color: #4C1D95;
  background: rgba(255,255,255,.84);
  font-weight: 900;
}
.oy-entry b {
  position: absolute;
  top: 14px;
  right: 14px;
  min-width: 28px;
  padding: 4px 8px;
  border-radius: 999px;
  color: #fff;
  background: rgba(255,255,255,.18);
  text-align: center;
  font-size: 11px;
  font-weight: 900;
}
.oy-entry strong,
.oy-entry em {
  display: block;
  font-style: normal;
}
.oy-entry strong {
  color: #fff;
  font-size: 18px;
  line-height: 24px;
}
.oy-entry em {
  margin-top: 5px;
  color: rgba(255,255,255,.78);
  font-size: 12px;
  line-height: 18px;
}
.oy-two-column {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
}
.oy-side-stack {
  display: grid;
  align-content: start;
}
.oy-queue-list {
  display: grid;
  gap: 10px;
}
.oy-queue-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 52px;
  gap: 12px;
  align-items: center;
  min-height: 62px;
  padding: 12px 14px;
  border: 1px solid var(--oy-line);
  border-radius: 16px;
  background: linear-gradient(90deg, #FFFFFF, #FAF7FF);
}
.oy-queue-item strong,
.oy-queue-item span {
  display: block;
}
.oy-queue-item strong {
  font-size: 14px;
  line-height: 20px;
}
.oy-queue-item span {
  margin-top: 3px;
  color: var(--oy-muted);
  font-size: 12px;
}
.oy-queue-item em {
  justify-self: start;
  padding: 4px 8px;
  border-radius: 999px;
  color: #5B21B6;
  background: #F3E8FF;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}
.oy-queue-item time {
  color: var(--oy-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.oy-audit-list {
  display: grid;
  gap: 12px;
}
.oy-audit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px;
  gap: 10px;
  align-items: center;
}
.oy-audit-row span,
.oy-audit-row strong {
  font-size: 13px;
}
.oy-audit-row span {
  color: var(--oy-text);
  font-weight: 700;
}
.oy-audit-row strong {
  justify-self: end;
  color: var(--oy-brand-deep);
  font-variant-numeric: tabular-nums;
}
.oy-audit-row i {
  grid-column: 1 / -1;
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #F0E9FF;
}
.oy-audit-row b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #A78BFA, #7C3AED 58%, #C026D3);
}
.oy-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.oy-field {
  min-width: 0;
}
.oy-field-wide {
  grid-column: 1 / -1;
}
.oy-field label {
  display: block;
  margin-bottom: 8px;
  color: var(--oy-text);
  font-size: 13px;
  font-weight: 800;
}
.oy-input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  gap: 8px;
}
.oy-input-row input {
  width: 100%;
  height: 36px;
  border: 1px solid var(--oy-line);
  border-radius: 6px;
  padding: 0 10px;
  color: var(--oy-text);
  outline: none;
}
.oy-input-row button,
.oy-submit-row button,
.oy-tags button {
  height: 36px;
  border: 1px solid var(--oy-brand);
  border-radius: 6px;
  color: #fff;
  background: linear-gradient(135deg, #7C3AED, #C026D3);
  font-weight: 800;
  cursor: pointer;
}
.oy-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.oy-tags button {
  height: 28px;
  border-color: var(--oy-line);
  color: var(--oy-text);
  background: var(--oy-surface-soft);
  font-size: 12px;
}
.oy-submit-row {
  margin-top: 16px;
}
.oy-submit-row button {
  min-width: 128px;
}
.oy-payload {
  max-height: 260px;
  margin: 14px 0 0;
  padding: 12px;
  overflow: auto;
  border-radius: 8px;
  color: var(--oy-text);
  background: #FAF7FF;
  font-size: 12px;
  line-height: 18px;
}
.oy-feed {
  display: grid;
  gap: 10px;
}
.oy-feed p {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--oy-line);
  border-radius: 8px;
  background: var(--oy-surface-soft);
}
.oy-feed strong,
.oy-feed span {
  display: block;
}
.oy-feed strong {
  font-size: 13px;
  line-height: 19px;
}
.oy-feed span {
  margin-top: 4px;
  color: var(--oy-muted);
  font-size: 12px;
  line-height: 18px;
}
.oy-diagnostics {
  margin-top: 14px;
  border-top: 1px solid #e5eaf0;
  padding-top: 12px;
  color: var(--oy-muted);
  font-size: 12px;
}
.oy-diagnostics summary {
  cursor: pointer;
  color: var(--oy-text);
  font-weight: 800;
}
.oy-diag-grid {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}
.oy-diag-grid p {
  margin: 4px 0 0;
  line-height: 18px;
  word-break: break-word;
}
.oy-native-fallback {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--oy-brand-line);
  border-radius: 8px;
  color: var(--oy-text);
  background: var(--oy-brand-soft);
}
.oy-native-fallback span {
  color: var(--oy-muted);
  font-size: 12px;
  line-height: 18px;
  word-break: break-word;
}
@media (max-width: 920px) {
  .oy-native-portal {
    display: block;
  }
  .oy-portal-rail {
    position: static;
    min-height: auto;
    border-radius: 0 0 24px 24px;
  }
  .oy-portal-rail nav {
    display: flex;
    overflow-x: auto;
  }
  .oy-portal-rail a {
    flex: 0 0 auto;
  }
  .oy-portal-main {
    padding: 14px;
  }
  .oy-command-bar {
    align-items: flex-start;
    flex-direction: column;
  }
  .oy-hero,
  .oy-two-column,
  .oy-form-grid,
  .oy-queue-item {
    grid-template-columns: 1fr;
  }
  .oy-hero-metrics,
  .oy-entry-grid,
  .oy-insight-band {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .oy-hero { padding: 20px; }
  .oy-hero h2 { font-size: 22px; line-height: 30px; }
  .oy-hero-metrics,
  .oy-entry-grid,
  .oy-insight-band {
    grid-template-columns: 1fr;
  }
}
`;

export default YidaComp;
