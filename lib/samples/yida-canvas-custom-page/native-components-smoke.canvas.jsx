import React, { useMemo, useState } from 'react';

const CANVAS_CONTROL_RESET_CSS = `
.oy-smoke-page {
  --oy-control-border: #BBD7FF;
  --oy-control-focus: #1677FF;
  --oy-control-focus-ring: rgba(22, 119, 255, .16);
  --oy-control-hover: #69A7FF;
  --oy-control-active-bg: #EAF3FF;
}
.oy-smoke-page :where(input, textarea, select, button, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number, .ant-segmented, .ant-btn) {
  font-family: inherit;
  letter-spacing: 0;
}
.oy-smoke-page :where(input, textarea, select, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number) {
  border-color: var(--oy-control-border) !important;
  color: #153B66;
  font-weight: 400;
  outline: none !important;
  box-shadow: none !important;
}
.oy-smoke-page :where(input, textarea, select, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number):hover {
  border-color: var(--oy-control-hover) !important;
}
.oy-smoke-page :where(input, textarea, select, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number):focus,
.oy-smoke-page :where(.ant-input-affix-wrapper, .ant-select-focused .ant-select-selector, .ant-picker-focused, .ant-input-number-focused) {
  border-color: var(--oy-control-focus) !important;
  box-shadow: 0 0 0 3px var(--oy-control-focus-ring) !important;
  outline: none !important;
}
.oy-smoke-page :where(.ant-select-selection-item, .ant-select-selection-placeholder, .ant-input, input, textarea) {
  color: #153B66;
  font-weight: 400;
}
.oy-smoke-page :where(.ant-select-dropdown, .ant-picker-dropdown) {
  border: 1px solid #d7dee8;
  border-radius: 10px;
  box-shadow: 0 14px 36px rgba(22, 119, 255, .12);
  overflow: hidden;
}
.oy-smoke-page :where(.ant-select-item-option-active, .ant-select-item-option-selected) {
  background: var(--oy-control-active-bg) !important;
  color: #0B5CFF !important;
  font-weight: 600;
}
`;

const TARGETS = [
  { name: 'PortalTopBanner', group: 'portal', groupLabel: '门户组件', level: 'preferred', desc: '首屏公告、品牌横幅和入口上下文。' },
  { name: 'PortalQuickEntry', group: 'portal', groupLabel: '门户组件', level: 'preferred', desc: '高频入口网格，适合事项、资料和流程直达。' },
  { name: 'QuickAccessCard', group: 'portal', groupLabel: '门户组件', level: 'verify', desc: '宿主门户的快捷收藏容器。' },
  { name: 'RecentlyUsedCard', group: 'portal', groupLabel: '门户组件', level: 'verify', desc: '最近访问入口，用于验证门户运行态。' },
  { name: 'DataCard', group: 'portal', groupLabel: '门户组件', level: 'verify', desc: '数据卡片容器，依赖宿主配置上下文。' },
  { name: 'DataManageViews', group: 'data', groupLabel: '数据管理', level: 'preferred', desc: '多维表式数据管理视图，需 URL 指定 formUuid。' },
  { name: 'EmployeeField', group: 'field', groupLabel: '字段组件', level: 'preferred', desc: '成员选择与用户值归一化。' },
  { name: 'DepartmentSelectField', group: 'field', groupLabel: '字段组件', level: 'verify', desc: '部门树选择与部门值归一化。' },
  { name: 'AttachmentField', group: 'upload', groupLabel: '上传组件', level: 'verify', desc: '附件上传返回结构验证。' },
  { name: 'ImageField', group: 'upload', groupLabel: '上传组件', level: 'verify', desc: '图片上传和预览返回结构验证。' },
];

const LAB_NAV = [
  { label: '运行态', value: 'Runtime' },
  { label: '门户', value: 'Portal' },
  { label: '数据', value: 'Data' },
  { label: '字段', value: 'Fields' },
  { label: '上传', value: 'Upload' },
];

const SAMPLE_ENTRIES = [
  { title: '发起申请', desc: '验证快捷入口渲染', url: '#start', icon: 'yingyong' },
  { title: '待办中心', desc: '验证点击与样式', url: '#todo', icon: 'liucheng' },
  { title: '数据概览', desc: '验证门户卡片', url: '#data', icon: 'shuju' },
];

function getDeepYidaBundle() {
  const deepYida = window.DeepYida;
  if (!deepYida) return null;
  if (Array.isArray(deepYida)) return deepYida;
  if (Array.isArray(deepYida.default)) return deepYida.default;
  if (Array.isArray(deepYida.components)) return deepYida.components;
  return deepYida;
}

function findFromBundle(bundle, name) {
  if (!bundle) return null;
  if (bundle[name]) return bundle[name];
  if (Array.isArray(bundle)) {
    return bundle.find((item) => item && (item.displayName === name || item.name === name)) || null;
  }
  return null;
}

function findYidaComponent(name) {
  const native = window.YidaNativeComponents || {};
  if (native[name]) return { component: native[name], source: 'window.YidaNativeComponents' };

  const deep = window.Deep || {};
  if (deep[name]) return { component: deep[name], source: 'window.Deep' };

  const bundleComponent = findFromBundle(getDeepYidaBundle(), name);
  if (bundleComponent) return { component: bundleComponent, source: 'window.DeepYida' };

  return { component: null, source: '' };
}

function listKeys(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => item && (item.displayName || item.name))
      .filter(Boolean)
      .slice(0, 80);
  }
  if (typeof value === 'object' || typeof value === 'function') {
    return Object.keys(value).slice(0, 80);
  }
  return [];
}

function stringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function toClassPart(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getUrlParams() {
  try {
    return new URLSearchParams(window.location.search || '');
  } catch (error) {
    return new URLSearchParams('');
  }
}

function getRuntimeAppType() {
  const params = getUrlParams();
  const explicit = params.get('appType');
  if (explicit) return explicit;
  const matched = (window.location.pathname || '').match(/\/(APP_[^/]+)/);
  return matched ? matched[1] : '';
}

function getDataManageProbeProps() {
  const params = getUrlParams();
  const formUuid = params.get('formUuid') || params.get('manageUuid') || '';
  const appType = getRuntimeAppType();

  if (!formUuid) {
    return {
      __skipNativeRender: true,
      __skipReason: '请在 URL 上追加 ?formUuid=目标表单formUuid 后再试渲染，避免未指定表单时误打数据管理视图接口。',
    };
  }

  return {
    innerHeight: Number(params.get('innerHeight') || 600),
    form: {
      appType,
      value: formUuid,
      label: params.get('formLabel') || '数据管理视图 Smoke',
      title: {
        type: 'i18n',
        zh_CN: params.get('formTitle') || '数据管理视图 Smoke',
        en_US: params.get('formTitleEn') || 'Data Manage Views Smoke',
      },
      isNewForm: params.get('isNewForm') || undefined,
    },
  };
}

function getProbeProps(name, onChange) {
  const commonFieldProps = {
    value: [],
    placeholder: '请选择',
    disabled: false,
    readOnly: false,
    onChange,
  };

  if (name === 'PortalTopBanner') {
    return {
      mainTitle: '门户组件 Smoke 验证',
      subTitle: '验证宿主运行态是否可以渲染 PortalTopBanner',
      bannerHeight: 160,
      textPosition: 'left',
    };
  }

  if (name === 'PortalQuickEntry') {
    return {
      content: SAMPLE_ENTRIES,
      dataSource: SAMPLE_ENTRIES,
      titleConfig: { title: '快捷入口' },
      themeConfig: { column: 3 },
      onItemClick: onChange,
    };
  }

  if (name === 'QuickAccessCard' || name === 'RecentlyUsedCard') {
    // 容器组件 renderItem 会执行 this.props.theme.includes('column')，容器层无默认 theme，
    // 不传即 undefined.includes 崩溃白屏；传含义为横排的 'row-white' 规避。列表数据由组件自取。
    return {
      theme: 'row-white',
      maxItems: 6,
      showAppDescription: false,
      containerPrefix: 'oy-smoke',
      enableQuickAccess: name === 'RecentlyUsedCard',
      enableCancelAccess: name === 'QuickAccessCard',
      onChange,
    };
  }

  if (name === 'DataCard') {
    // 暂不支持：Canvas 无门户宿主上下文，裸渲染只会显示「请选择要嵌入的数据卡片」空占位。
    return {
      title: `${name} Smoke`,
      content: SAMPLE_ENTRIES,
      dataSource: SAMPLE_ENTRIES,
      onChange,
      onClick: onChange,
    };
  }

  if (name === 'DataManageViews') {
    return getDataManageProbeProps();
  }

  if (name === 'EmployeeField') {
    return {
      ...commonFieldProps,
      supportDepartment: true,
      multiple: true,
    };
  }

  if (name === 'DepartmentSelectField') {
    return {
      ...commonFieldProps,
      multiple: true,
      mode: 'multiple',
    };
  }

  if (name === 'AttachmentField' || name === 'ImageField') {
    return {
      ...commonFieldProps,
      fileList: [],
      listType: name === 'ImageField' ? 'picture-card' : 'text',
    };
  }

  return { onChange };
}

class ProbeBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.error) {
      return <pre className="oy-smoke-error">{this.state.error.message || String(this.state.error)}</pre>;
    }
    return this.props.children;
  }
}

function ComponentProbe({ target, probe, onCapture }) {
  const [enabled, setEnabled] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [renderError, setRenderError] = useState('');
  const Comp = probe.component;

  function handleCapture(value) {
    setLastEvent(value);
    onCapture(target.name, value);
  }

  const statusClass = Comp ? 'ok' : 'missing';
  const props = Comp ? getProbeProps(target.name, handleCapture) : {};
  const skipNativeRender = !!props.__skipNativeRender;
  const cardClassName = [
    'oy-smoke-card',
    statusClass,
    `oy-smoke-card-${toClassPart(target.group)}`,
    `oy-smoke-card-${toClassPart(target.name)}`,
  ].join(' ');
  const renderClassName = [
    'oy-smoke-render',
    `oy-smoke-render-${toClassPart(target.group)}`,
    `oy-smoke-render-${toClassPart(target.name)}`,
  ].join(' ');
  const renderProps = skipNativeRender
    ? {}
    : Object.keys(props).reduce((next, key) => {
      if (!key.startsWith('__')) next[key] = props[key];
      return next;
    }, {});

  return (
    <section className={cardClassName}>
      <div className="oy-smoke-card-head">
        <div>
          <span>{target.groupLabel}</span>
          <h3>{target.name}</h3>
          <p>{target.desc}</p>
          <small>{Comp ? probe.source : '未探测到，发布环境可继续使用 fallback'}</small>
        </div>
        <span className={`oy-smoke-badge ${target.level}`}>{target.level}</span>
      </div>

      <div className="oy-smoke-actions">
        <button type="button" disabled={!Comp} onClick={() => setEnabled((next) => !next)}>
          {enabled ? '隐藏试渲染' : '试渲染'}
        </button>
        <button type="button" disabled={!lastEvent} onClick={() => setLastEvent(null)}>
          清空事件
        </button>
      </div>

      {enabled && Comp && skipNativeRender ? (
        <div className={`${renderClassName} oy-smoke-hint`}>{props.__skipReason}</div>
      ) : null}

      {enabled && Comp && !skipNativeRender ? (
        <ProbeBoundary onError={(error) => setRenderError(error.message || String(error))}>
          <div className={renderClassName}>
            <Comp {...renderProps} />
          </div>
        </ProbeBoundary>
      ) : null}

      {renderError ? <pre className="oy-smoke-error">{renderError}</pre> : null}
      {lastEvent ? <pre className="oy-smoke-json">{stringify(lastEvent)}</pre> : null}
    </section>
  );
}

function RuntimeSummary({ probes }) {
  const sources = [
    ['window.YidaNativeComponents', window.YidaNativeComponents],
    ['window.Deep', window.Deep],
    ['window.DeepYida', getDeepYidaBundle()],
  ];
  const foundCount = probes.filter((item) => item.probe.component).length;

  return (
    <section className="oy-smoke-summary">
      <div>
        <p className="oy-smoke-eyebrow">Native Component Lab</p>
        <h1>宜搭原生组件实验室</h1>
        <p>
          把组件探测、试渲染、事件载荷和宿主来源放进同一个可演示的实验台，方便判断当前环境可增强到哪一层原生体验。
        </p>
      </div>
      <div className="oy-smoke-score">
        <strong>{foundCount}</strong>
        <span>/ {TARGETS.length} components found</span>
      </div>
      <div className="oy-smoke-sources">
        {sources.map(([name, value]) => (
          <div key={name}>
            <b>{name}</b>
            <span>{value ? 'detected' : 'empty'}</span>
            <small>{listKeys(value).join(', ') || '-'}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function YidaComp() {
  const [events, setEvents] = useState({});
  const probes = useMemo(
    () => TARGETS.map((target) => ({ target, probe: findYidaComponent(target.name) })),
    []
  );

  function handleCapture(name, value) {
    setEvents((prev) => ({
      ...prev,
      [name]: {
        time: new Date().toISOString(),
        value,
      },
    }));
  }

  return (
    <div className="oy-smoke-page">
      <style>{CANVAS_CONTROL_RESET_CSS + PAGE_CSS}</style>
      <aside className="oy-smoke-rail">
        <strong>Native</strong>
        {LAB_NAV.map((item) => <span key={item.value}>{item.label}</span>)}
      </aside>
      <div className="oy-smoke-workspace">
        <RuntimeSummary probes={probes} />
        <main className="oy-smoke-grid">
          {probes.map(({ target, probe }) => (
            <ComponentProbe key={target.name} target={target} probe={probe} onCapture={handleCapture} />
          ))}
        </main>
        <section className="oy-smoke-events">
          <div>
            <p className="oy-smoke-eyebrow">Payload Inspector</p>
            <h2>组件事件载荷</h2>
          </div>
          <pre>{Object.keys(events).length ? stringify(events) : '尚未捕获事件。点击“试渲染”后选择成员、部门或上传文件以记录真实返回结构。'}</pre>
        </section>
      </div>
    </div>
  );
}

const PAGE_CSS = `
.oy-smoke-page {
  position: relative;
  min-height: 100vh;
  padding: 22px 22px 28px 110px;
  color: #153B66;
  background:
    radial-gradient(circle at 18% 8%, rgba(22, 119, 255, .28), transparent 25%),
    radial-gradient(circle at 90% 0%, rgba(56, 189, 248, .18), transparent 32%),
    linear-gradient(135deg, #EAF3FF 0%, #F8FBFF 42%, #EEF6FF 100%);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.oy-smoke-page * { box-sizing: border-box; }
.oy-smoke-rail {
  position: fixed;
  left: 22px;
  top: 22px;
  bottom: 22px;
  z-index: 3;
  display: grid;
  width: 68px;
  grid-auto-rows: max-content;
  gap: 10px;
  padding: 14px 10px;
  border: 1px solid rgba(22, 119, 255, .20);
  border-radius: 22px;
  background: rgba(255,255,255,.74);
  box-shadow: 0 24px 60px rgba(21, 59, 102, .14);
  backdrop-filter: blur(18px);
}
.oy-smoke-rail strong,
.oy-smoke-rail span {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.oy-smoke-rail strong {
  height: 44px;
  border-radius: 16px;
  color: #fff;
  background: linear-gradient(145deg, #0B3A8F, #1677FF);
  font-size: 11px;
  font-weight: 900;
}
.oy-smoke-rail span {
  min-height: 42px;
  border-radius: 14px;
  color: #4D6B8F;
  background: rgba(22, 119, 255, .08);
  font-size: 12px;
  font-weight: 800;
}
.oy-smoke-workspace {
  max-width: 1440px;
  margin: 0 auto;
}
.oy-smoke-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 22px;
  padding: 28px;
  overflow: hidden;
  border: 1px solid rgba(22, 119, 255, .18);
  border-radius: 24px;
  background:
    linear-gradient(140deg, rgba(255,255,255,.92), rgba(255,255,255,.72)),
    linear-gradient(135deg, rgba(22,119,255,.16), rgba(56, 189, 248, .09));
  box-shadow: 0 28px 80px rgba(21, 59, 102, .16);
  backdrop-filter: blur(20px);
}
.oy-smoke-eyebrow {
  margin: 0 0 8px;
  color: #1677FF;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.oy-smoke-summary h1 {
  margin: 0 0 10px;
  color: #102A43;
  font-size: 34px;
  line-height: 42px;
  font-weight: 900;
}
.oy-smoke-summary p {
  margin: 0;
  max-width: 820px;
  color: #4D6B8F;
  line-height: 1.7;
}
.oy-smoke-score {
  min-width: 172px;
  padding: 20px;
  border: 1px solid rgba(22, 119, 255, .18);
  border-radius: 20px;
  background: linear-gradient(145deg, #0B3A8F, #1677FF);
  text-align: center;
  box-shadow: 0 22px 46px rgba(22, 119, 255, .24);
}
.oy-smoke-score strong {
  display: block;
  color: #FFFFFF;
  font-size: 48px;
  line-height: 1;
}
.oy-smoke-score span {
  color: rgba(255,255,255,.74);
  font-size: 12px;
}
.oy-smoke-sources {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.oy-smoke-sources div {
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(22, 119, 255, .14);
  border-radius: 16px;
  background: rgba(255,255,255,.72);
}
.oy-smoke-sources b,
.oy-smoke-sources span,
.oy-smoke-sources small {
  display: block;
}
.oy-smoke-sources span {
  margin: 4px 0;
  color: #0B5CFF;
  font-size: 12px;
  font-weight: 700;
}
.oy-smoke-sources small {
  overflow: hidden;
  color: #69788d;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.oy-smoke-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}
.oy-smoke-card {
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(22, 119, 255, .14);
  border-radius: 20px;
  background: rgba(255,255,255,.84);
  box-shadow: 0 18px 48px rgba(21, 59, 102, .10);
  backdrop-filter: blur(14px);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.oy-smoke-card:hover {
  transform: translateY(-2px);
  border-color: rgba(22, 119, 255, .28);
  box-shadow: 0 24px 60px rgba(21, 59, 102, .14);
}
.oy-smoke-card-data {
  grid-column: 1 / -1;
}
.oy-smoke-card.missing {
  background: rgba(248, 252, 251, .70);
}
.oy-smoke-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.oy-smoke-card-head span:first-child {
  display: inline-flex;
  margin-bottom: 8px;
  padding: 4px 8px;
  border-radius: 999px;
  color: #0B5CFF;
  background: rgba(22, 119, 255, .10);
  font-size: 11px;
  font-weight: 900;
}
.oy-smoke-card h3 {
  margin: 0;
  color: #102A43;
  font-size: 17px;
  line-height: 22px;
}
.oy-smoke-card p {
  margin: 6px 0 0;
  color: #4D6B8F;
  font-size: 12px;
  line-height: 18px;
}
.oy-smoke-card small {
  display: block;
  margin-top: 6px;
  color: #78908B;
  font-size: 11px;
}
.oy-smoke-badge {
  flex: 0 0 auto;
  padding: 5px 8px;
  border-radius: 999px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}
.oy-smoke-badge.preferred {
  background: #1677FF;
}
.oy-smoke-badge.verify {
  background: #38BDF8;
}
.oy-smoke-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
.oy-smoke-actions button {
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(22, 119, 255, .28);
  border-radius: 10px;
  color: #153B66;
  background: #F8FBFF;
  cursor: pointer;
  font-weight: 800;
}
.oy-smoke-actions button:disabled {
  color: #9aa7ba;
  cursor: not-allowed;
}
.oy-smoke-render {
  margin-top: 14px;
  padding: 12px;
  border: 1px dashed rgba(22, 119, 255, .28);
  border-radius: 14px;
  background: linear-gradient(180deg, #F8FBFF, #F4FAFF);
}
.oy-smoke-render-data {
  position: relative;
  height: min(620px, 70vh);
  min-height: 420px;
  overflow: auto;
  padding: 0;
  background: #ffffff;
}
.oy-smoke-render-DataManageViews {
  contain: layout paint;
}
.oy-smoke-render-DataManageViews .vc-data-manage-views,
.oy-smoke-render-DataManageViews .vc-yida-form-manage,
.oy-smoke-render-DataManageViews .vc-yida-form-manage-content {
  height: 100%;
  min-height: 0;
}
.oy-smoke-render-DataManageViews .vc-yida-form-manage--fixed,
.oy-smoke-render-DataManageViews .new-data-manage--fixed {
  position: absolute !important;
  inset: 0 !important;
  width: auto !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 0 !important;
}
.oy-smoke-render-DataManageViews .new-data-manage-table {
  height: calc(100% - 42px) !important;
}
.oy-smoke-json,
.oy-smoke-error,
.oy-smoke-events pre {
  overflow: auto;
  max-height: 220px;
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 14px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.oy-smoke-json,
.oy-smoke-events pre {
  border: 1px solid rgba(22, 119, 255, .14);
  color: #314156;
  background: #F8FBFF;
}
.oy-smoke-error {
  border: 1px solid #f2c7c7;
  color: #8a2626;
  background: #fff4f4;
}
.oy-smoke-events {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  margin-top: 18px;
  padding: 20px;
  border: 1px solid rgba(22, 119, 255, .14);
  border-radius: 22px;
  background: rgba(255,255,255,.84);
  box-shadow: 0 18px 48px rgba(21, 59, 102, .10);
}
.oy-smoke-events h2 {
  margin: 0;
  color: #102A43;
  font-size: 20px;
  line-height: 26px;
}
@media (max-width: 900px) {
  .oy-smoke-page {
    padding: 14px;
  }
  .oy-smoke-rail {
    position: static;
    display: flex;
    width: auto;
    margin-bottom: 14px;
    overflow-x: auto;
  }
  .oy-smoke-rail strong,
  .oy-smoke-rail span {
    min-width: 68px;
  }
  .oy-smoke-summary,
  .oy-smoke-grid,
  .oy-smoke-sources,
  .oy-smoke-events {
    grid-template-columns: 1fr;
  }
}
@media (min-width: 901px) and (max-width: 1280px) {
  .oy-smoke-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`;

export default YidaComp;
