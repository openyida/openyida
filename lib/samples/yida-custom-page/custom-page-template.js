/**
 * 宜搭自定义页面完整模板
 * 
 * 使用说明：
 * 1. 复制此模板到 project/pages/src/xxx.oyd.jsx
 * 2. 修改 _customState 初始状态
 * 3. 在 renderJsx 中编写页面 JSX
 * 4. 运行 openyida check-page project/pages/src/xxx.oyd.jsx 检查宜搭规范
 * 5. 运行 openyida compile project/pages/src/xxx.oyd.jsx 验证语法
 * 6. 运行 openyida publish project/pages/src/xxx.oyd.jsx <appType> <formUuid> 发布
 * 
 * ⚠️ 重要约束：
 * - 业务方法必须用 export function 定义；JSX 事件绑定必须用箭头函数包裹
 * - 所有方法必须用 export function 定义
 * - renderJsx 内先定义 var self = this，事件绑定使用 (e) => { self.methodName(e); }
 * - 禁止 ES6 计算属性名 { [key]: value }，动态对象先 var obj = {}; obj[key] = value;
 * - 默认加载固定版本 Tailwind 并开启 preflight；用户可见下拉框使用自定义 dropdown，不使用原生 select
 * - 数据加载必须有 catch/finally 兜底，不要让整页永久停在 loading 状态
 * - 跳转页面用 this.utils.router.push('FORM-XXX', {}, false)
 */

// ============================================================
// 字段 ID 别名（从 openyida get-schema 输出中提取）
// ⚠️ 实际开发时将 _xxx 占位符替换为真实 fieldId
// ============================================================
var FIELDS = {
  name:       'textField_xxx',       // 替换为实际字段 ID
  department: 'selectField_xxx',     // 替换为实际字段 ID
  joinDate:   'dateField_xxx',       // 替换为实际字段 ID
  formUuid:   'FORM-XXX',           // 替换为实际表单 ID
};

// Tailwind 运行时脚本：只填写已验证的 g.alicdn.com 或企业自托管地址；不要默认使用海外 CDN
var TAILWIND_CDN = 'https://g.alicdn.com/code/lib/tailwindcss-browser/0.0.0-insiders.fed6c6a/index.global.min.js';

var DEPARTMENT_OPTIONS = [
  { value: 'rd', label: '研发部' },
  { value: 'ops', label: '运营部' },
  { value: 'sales', label: '销售部' },
];

// ============================================================
// 状态管理（全局变量，不是 export function）
// ============================================================
var _customState = {
  // 在此定义所有业务状态的初始值
  loading: false,
  data: [
    { name: '重点客户回访', department: '运营部', owner: '沈岚', status: '今日必办', metric: '98.2%', trend: '+12%' },
    { name: '合同补件确认', department: '销售部', owner: '顾川', status: '需协同', metric: '76.4%', trend: '+6%' },
    { name: '审批 SLA 复盘', department: '研发部', owner: '叶澜', status: '进行中', metric: '41.8%', trend: '-3%' },
    { name: '渠道线索分配', department: '销售部', owner: '陈序', status: '已排期', metric: '89.0%', trend: '+9%' },
  ],
  inputValue: '',
  selectedId: 'rd',
  openDropdown: '',
  _isComposing: false,  // 输入法组合输入标记（编注3）
};

/**
 * 获取状态
 * @param {string} [key] - 传入 key 返回单个值，不传返回全部状态的浅拷贝
 */
export function getCustomState(key) {
  if (key) {
    return _customState[key];
  }
  return Object.assign({}, _customState);
}

/**
 * 设置状态（合并更新，自动触发重新渲染）
 * @param {Object} newState - 需要更新的状态键值对
 */
export function setCustomState(newState) {
  Object.keys(newState).forEach((key) => {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

/**
 * 强制重新渲染（通过更新 timestamp 触发 React 重渲染）
 */
export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

// ============================================================
// 生命周期
// ============================================================

/**
 * 组件挂载到 DOM 后（等同于 componentDidMount）
 * 用于：初始化数据、启动定时器、绑定事件等
 */
export function didMount() {
  this.injectNativeControlReset();
  this.ensureTailwind();

  // 初始化逻辑
  // 示例：加载数据
  // this.loadData();

  // 示例：启动定时器（配合 didUnmount 清理）
  // this._timer = setInterval(function() { /* 轮询逻辑 */ }, 30000);
}

/**
 * 页面卸载时调用
 * 用于：清理定时器、解绑事件、释放资源等
 */
export function didUnmount() {
  // 清理定时器，防止内存泄漏（编注4）
  if (this._timer) {
    clearInterval(this._timer);
    this._timer = null;
  }
}

// ============================================================
// 业务方法（必须用 export function 定义）
// ============================================================

/**
 * 加载 Tailwind 浏览器脚本。未配置 g.alicdn.com/自托管地址时只启用兜底样式。
 */
export function ensureTailwind() {
  var self = this;
  if (window.__openyidaTailwindReady) {
    return Promise.resolve();
  }
  if (window.__openyidaTailwindLoading) {
    return window.__openyidaTailwindLoading;
  }

  if (!TAILWIND_CDN) {
    self.injectTailwindFallback();
    return Promise.resolve();
  }

  self.injectTailwindSource();

  window.__openyidaTailwindLoading = self.utils.loadScript(TAILWIND_CDN)
    .then(function() {
      window.__openyidaTailwindReady = true;
      self.forceUpdate();
    })
    .catch(function() {
      window.__openyidaTailwindFailed = true;
      self.injectTailwindFallback();
      self.forceUpdate();
    });

  return window.__openyidaTailwindLoading;
}

/**
 * Native 自定义页控件样式兜底。
 * Tailwind preflight 加载前后都生效，避免 input/textarea/select 聚焦时露出浏览器黑色粗边。
 */
export function injectNativeControlReset() {
  var style = document.getElementById('openyida-native-control-reset');
  if (!style) {
    style = document.createElement('style');
    style.id = 'openyida-native-control-reset';
    document.head.appendChild(style);
  }

  style.innerHTML = [
    '.oyd-page{--oyd-control-border:#D0D5DD;--oyd-control-hover:#7AA7FF;--oyd-control-focus:#2563EB;--oyd-control-focus-ring:rgba(37,99,235,.16);--oyd-control-selected-bg:rgba(37,99,235,.10);--oyd-control-info-bg:rgba(37,99,235,.10);}',
    '.oyd-page input,.oyd-page textarea,.oyd-page select,.oyd-page .oyd-input,.oyd-page .oyd-select-trigger{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:400;color:#1D2939;outline:none!important;box-shadow:none;}',
    '.oyd-page input,.oyd-page textarea,.oyd-page select,.oyd-page .oyd-input{border:1px solid var(--oyd-control-border);border-radius:6px;background:#fff;}',
    '.oyd-page input:hover,.oyd-page textarea:hover,.oyd-page select:hover,.oyd-page .oyd-input:hover,.oyd-page .oyd-select-trigger:hover{border-color:var(--oyd-control-hover)!important;}',
    '.oyd-page input:focus,.oyd-page textarea:focus,.oyd-page select:focus,.oyd-page .oyd-input:focus,.oyd-page .oyd-select-trigger:focus{border-color:var(--oyd-control-focus)!important;outline:none!important;box-shadow:0 0 0 3px var(--oyd-control-focus-ring)!important;}',
    '.oyd-page .oyd-select-trigger[aria-expanded="true"]{border-color:var(--oyd-control-focus)!important;box-shadow:0 0 0 3px var(--oyd-control-focus-ring)!important;}',
    '.oyd-page .oyd-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
    '.oyd-page .oyd-select-trigger-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.oyd-page .oyd-select-arrow{width:14px!important;height:14px!important;color:#667085;transition:transform .16s ease,color .16s ease;flex:0 0 14px;display:block;}',
    '.oyd-page .oyd-select-trigger[aria-expanded="true"] .oyd-select-arrow{transform:rotate(180deg);color:var(--oyd-control-focus);}',
    '.oyd-page .oyd-select-option{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
    '.oyd-page .oyd-select-check{width:14px!important;height:14px!important;color:var(--oyd-control-focus);flex:0 0 14px;display:block;}',
  ].join('');
}

/**
 * @tailwindcss/browser 使用 text/tailwindcss 声明输入源。
 * 自定义页面默认引入 preflight，重置浏览器原生按钮/下拉外观，避免出现黑色默认边框。
 */
export function injectTailwindSource() {
  if (document.getElementById('openyida-tailwind-source')) {
    return;
  }

  var style = document.createElement('style');
  style.id = 'openyida-tailwind-source';
  style.type = 'text/tailwindcss';
  style.innerHTML = [
    '@import "tailwindcss/theme";',
    '@import "tailwindcss/preflight";',
    '@import "tailwindcss/utilities";',
    '@theme { --color-brand: #2563EB; }',
  ].join('\n');
  document.head.appendChild(style);
}

/**
 * Tailwind 加载失败时的最小兜底样式。
 */
export function injectTailwindFallback() {
  if (document.getElementById('openyida-tailwind-fallback')) {
    return;
  }

  var style = document.createElement('style');
  style.id = 'openyida-tailwind-fallback';
  style.innerHTML = [
    '.oyd-btn,.oyd-input,.oyd-select-trigger,.oyd-select-option{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:400;}',
    '.oyd-btn{height:36px;border-radius:6px;border:1px solid #D0D5DD;background:#fff;padding:0 12px;font-size:14px;cursor:pointer;}',
    '.oyd-btn-primary{background:#2563EB;border-color:#2563EB;color:#fff;}',
    '.oyd-input{border:1px solid #D0D5DD;border-radius:6px;background:#fff;box-shadow:none;}',
    '.oyd-select-trigger{height:38px;border-radius:6px;border:1px solid #D0D5DD;background:#fff;padding:0 10px 0 12px;font-size:14px;text-align:left;box-shadow:none;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#1D2939;}',
    '.oyd-select-trigger-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.oyd-select-arrow{width:14px!important;height:14px!important;color:#667085;transition:transform .16s ease,color .16s ease;flex:0 0 14px;display:block;}',
    '.oyd-select-trigger[aria-expanded="true"] .oyd-select-arrow{transform:rotate(180deg);color:#2563EB;}',
    '.oyd-select-menu{position:absolute;z-index:30;margin-top:6px;width:100%;padding:6px;border:1px solid #E4E7EC;border-radius:10px;background:#fff;box-shadow:0 16px 32px rgba(16,24,40,.14);}',
    '.oyd-select-option{width:100%;min-height:36px;border:0;border-radius:8px;background:#fff;padding:0 10px;text-align:left;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#1D2939;}',
    '.oyd-select-option-active{background:var(--oyd-control-selected-bg,#EFF6FF);color:#2563EB;font-weight:600;}',
    '.oyd-select-check{width:14px!important;height:14px!important;color:#2563EB;flex:0 0 14px;display:block;}',
  ].join('');
  document.head.appendChild(style);
}

/**
 * 示例：加载表单数据
 */
export function loadData() {
  var self = this;
  self.setCustomState({ loading: true });
  
  self.utils.yida.searchFormDatas({
    formUuid: FIELDS.formUuid,
    pageSize: 20,
    currentPage: 1
  }).then(function(res) {
    if (res.success) {
      self.setCustomState({ 
        data: res.content.data,
        loading: false 
      });
    } else {
      self.utils.toast({ title: '加载失败', type: 'error' });
      self.setCustomState({ loading: false });
    }
  }).catch(function(err) {
    self.utils.toast({ title: '加载失败: ' + err.message, type: 'error' });
    self.setCustomState({ loading: false });
  });
}

/**
 * 示例：跳转到表单页面
 */
export function openFormPage(formUuid) {
  if (!formUuid || formUuid === 'FORM-XXX') {
    this.utils.toast({ title: '请替换为真实 formUuid 后再打开详情', type: 'warning' });
    return;
  }
  this.utils.router.push(formUuid, {}, false);
}

/**
 * 示例：处理按钮点击
 */
export function handleButtonClick(e) {
  var value = this.getCustomState('inputValue');
  if (!value) {
    this.utils.toast({ title: '请输入内容', type: 'warning' });
    return;
  }
  var selected = this.findOption(DEPARTMENT_OPTIONS, this.getCustomState('selectedId')) || DEPARTMENT_OPTIONS[0];
  var nextItem = {
    name: value,
    department: selected.label,
    owner: '当前用户',
    status: '新建',
    metric: '待评估',
    trend: '刚刚',
  };
  var nextData = [nextItem].concat(this.getCustomState('data') || []);
  this.setCustomState({ inputValue: '', data: nextData });
  var input = document.getElementById('template-input');
  if (input) {
    input.value = '';
  }
  this.utils.toast({ title: '已加入业务数据预览', type: 'success' });
}

/**
 * 示例：处理输入变化
 */
export function handleInputChange(e) {
  // 组合输入进行中时跳过处理（编注3）
  if (_customState._isComposing) return;
  _customState.inputValue = e.target.value;  // 静默更新，不触发重渲染
}

/**
 * 自定义下拉：打开/关闭菜单。
 */
export function toggleDropdown(key) {
  _customState.openDropdown = _customState.openDropdown === key ? '' : key;
  this.forceUpdate();
}

/**
 * 自定义下拉：选择选项。
 */
export function chooseDropdown(key, value) {
  _customState[key] = value;
  _customState.openDropdown = '';
  this.forceUpdate();
}

export function findOption(options, value) {
  var matched = options.filter((option) => option.value === value);
  return matched[0] || null;
}

export function renderDropdown(key, options, value, placeholder) {
  var self = this;
  var open = _customState.openDropdown === key;
  var selected = this.findOption(options, value);

  return (
    <div className="relative w-full" style={styles.dropdownWrap}>
      <button
        type="button"
        className="oyd-select-trigger flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-left text-sm text-slate-800 focus:outline-none"
        style={styles.selectTrigger}
        aria-expanded={open}
        onClick={(e) => { self.toggleDropdown(key); }}
      >
        <span className={selected ? 'oyd-select-trigger-label truncate text-slate-800' : 'oyd-select-trigger-label truncate text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="oyd-select-arrow" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.2 6.1a.7.7 0 0 1 1 0L8 8.9l2.8-2.8a.7.7 0 1 1 1 1L8.5 11.4a.7.7 0 0 1-1 0L4.2 7.1a.7.7 0 0 1 0-1z" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          className="oyd-select-menu absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          style={styles.selectMenu}
          role="listbox"
        >
          {options.map((option) => {
            var active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={active
                  ? 'oyd-select-option oyd-select-option-active flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium'
                  : 'oyd-select-option flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50'}
                style={active ? styles.optionActive : styles.option}
                onClick={(e) => { self.chooseDropdown(key, option.value); }}
              >
                <span>{option.label}</span>
                {active && (
                  <svg className="oyd-select-check" viewBox="0 0 16 16" aria-hidden="true">
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

// ============================================================
// 样式定义（放在文件末尾）
// ============================================================
var styles = {
  container: {
    padding: '24px',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #F4F8FF 0%, #FFFFFF 44%, #EEF4FF 100%)',
    color: '#1D2939',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    letterSpacing: '0',
    borderRadius: '0 !important',  // 清除宜搭默认圆角（编注12）
  },
  shell: {
    maxWidth: '1180px',
    margin: '0 auto',
  },
  header: {
    minHeight: 172,
    border: '1px solid #E5E7EB',
    borderRadius: '14px',
    padding: '22px',
    marginBottom: '16px',
    background: 'linear-gradient(135deg, #FFFFFF 0%, #F3F7FF 58%, #E8F0FF 100%)',
    boxShadow: '0 18px 42px rgba(37, 99, 235, 0.10)',
    overflow: 'hidden',
  },
  title: {
    fontSize: '30px',
    lineHeight: '38px',
    fontWeight: 900,
    color: '#1D2939',
    margin: '10px 0 8px 0'
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 28,
    padding: '0 10px',
    borderRadius: 999,
    border: '1px solid #CFE0FF',
    background: '#EFF6FF',
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: 800,
  },
  subtitle: {
    maxWidth: 620,
    margin: 0,
    color: '#6B7280',
    fontSize: 14,
    lineHeight: '23px',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    marginTop: 22,
  },
  metricCard: {
    border: '1px solid #E5E7EB',
    borderRadius: 10,
    padding: 14,
    background: '#FAFAFA',
  },
  metricValue: {
    fontSize: 24,
    lineHeight: '30px',
    fontWeight: 900,
    color: '#1D2939',
  },
  metricLabel: {
    marginTop: 3,
    color: '#6B7280',
    fontSize: 12,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '360px 1fr',
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 16px 36px rgba(37, 99, 235, 0.09)',
    border: '1px solid #E5E7EB',
    padding: '18px',
    color: '#1D2939',
  },
  cardTitle: {
    margin: '0 0 4px',
    fontSize: 16,
    lineHeight: '24px',
    color: '#1D2939',
    fontWeight: 900,
  },
  cardDesc: {
    margin: '0 0 16px',
    color: '#64748B',
    fontSize: 13,
    lineHeight: '21px',
  },
  button: {
    width: '100%',
    height: 42,
    background: '#2563EB',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 16px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 900,
    boxShadow: '0 10px 24px rgba(37, 99, 235, 0.20)',
  },
  secondaryButton: {
    backgroundColor: '#F8FAFC',
    color: '#1D2939',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 800,
  },
  input: {
    width: '100%',
    height: 42,
    padding: '0 12px',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 400,
    outline: 'none',
    boxShadow: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    boxSizing: 'border-box'
  },
  dropdownWrap: {
    position: 'relative',
    width: '100%',
    marginTop: '12px',
    marginBottom: '14px'
  },
  selectTrigger: {
    width: '100%',
    minHeight: 42,
    border: '1px solid #CBD5E1',
    borderRadius: 8,
    background: '#fff',
    padding: '0 10px 0 12px',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
    fontWeight: 400,
    boxShadow: 'none',
    outline: 'none'
  },
  selectMenu: {
    position: 'absolute',
    zIndex: 30,
    marginTop: 6,
    width: '100%',
    background: '#fff',
    border: '1px solid #E4E7EC',
    borderRadius: 12,
    padding: 6,
    boxShadow: '0 18px 38px rgba(15,159,142,.14)'
  },
  option: {
    width: '100%',
    minHeight: 36,
    padding: '8px 12px',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    background: '#fff',
    border: 0,
    borderRadius: 8,
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
    fontWeight: 400,
    outline: 'none',
    cursor: 'pointer'
  },
  optionActive: {
    width: '100%',
    minHeight: 36,
    padding: '8px 12px',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    background: 'var(--oyd-control-selected-bg, #EFF6FF)',
    border: 0,
    borderRadius: 8,
    color: '#0F9F8E',
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
    fontWeight: 600,
    outline: 'none',
    cursor: 'pointer'
  },
  list: {
    display: 'grid',
    gap: 10,
  },
  listItem: {
    display: 'grid',
    gridTemplateColumns: '1fr 88px 78px',
    gap: 12,
    alignItems: 'center',
    minHeight: 72,
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    background: '#FFFFFF',
    padding: '12px 14px',
  },
  itemName: {
    fontSize: 15,
    lineHeight: '22px',
    fontWeight: 900,
    color: '#1D2939',
  },
  itemMeta: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 12,
  },
  itemMetric: {
    fontSize: 18,
    lineHeight: '24px',
    fontWeight: 900,
    color: '#1D2939',
  },
  itemTag: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    borderRadius: 999,
    padding: '0 10px',
    background: '#EFF6FF',
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: 800,
  }
};

// ============================================================
// 渲染（页面入口）
// ============================================================

/**
 * 页面渲染函数
 * ⚠️ 必须包含隐藏 timestamp 节点，确保 forceUpdate 后能重新渲染
 */
export function renderJsx() {
  var self = this;
  var state = this.getCustomState();
  var isMobile = this.utils.isMobile();
  var timestamp = this.state && this.state.timestamp;
  var data = state.data || [];

  var containerStyle = Object.assign({}, styles.container, {
    padding: isMobile ? '14px' : '24px',
  });
  var gridStyle = Object.assign({}, styles.grid, {
    gridTemplateColumns: isMobile ? '1fr' : styles.grid.gridTemplateColumns,
  });
  var metricsStyle = Object.assign({}, styles.metrics, {
    gridTemplateColumns: isMobile ? '1fr' : styles.metrics.gridTemplateColumns,
  });
  
  return (
    <div className="oyd-page" style={containerStyle}>
      {/* 必须保留：timestamp 用于触发 React 重新渲染 */}
      <div style={{ display: 'none' }}>{timestamp}</div>

      <div style={styles.shell}>
        <div style={styles.header}>
          <div style={styles.eyebrow}>AI 业务工作台</div>
          <h1 style={styles.title}>Hello, Courtney</h1>
          <p style={styles.subtitle}>
            <span style={{ color: '#21C7B5', fontWeight: 900 }}>How can I help you today?</span>
            <span> 把客户、合同、审批和异常事项集中成一个真实可操作的工作台，而不是只展示几张卡片。</span>
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <button className="oyd-btn oyd-btn-primary" style={styles.button} onClick={(e) => { self.handleButtonClick(e); }}>Ask AI</button>
            <button className="oyd-btn" style={styles.secondaryButton} onClick={(e) => { self.loadData(e); }}>获取任务更新</button>
            <button className="oyd-btn" style={styles.secondaryButton} onClick={(e) => { self.openFormPage(FIELDS.formUuid); }}>创建工作区</button>
          </div>
          <div style={metricsStyle}>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>128</div>
              <div style={styles.metricLabel}>待处理事项</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>86%</div>
              <div style={styles.metricLabel}>本周完成率</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>12</div>
              <div style={styles.metricLabel}>异常提醒</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricValue}>73%</div>
              <div style={styles.metricLabel}>目标达成</div>
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr',
          gap: 14,
          marginBottom: 14,
        }}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Projects</h2>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
              {[
                { name: 'Product launch', meta: '6 tasks / 12 teammates', color: '#8B5CF6' },
                { name: 'Team brainstorm', meta: '2 tasks / 32 teammates', color: '#2563EB' },
                { name: 'Branding launch', meta: '4 tasks / 9 teammates', color: '#06B6D4' },
                { name: 'Create new project', meta: '从空白项目开始', color: '#CBD5E1' },
              ].map((project) => (
                <button key={project.name} type="button" style={{ minHeight: 58, border: '1px solid #E2E8F0', borderRadius: 14, background: '#FFFFFF', padding: '12px', textAlign: 'left', cursor: 'pointer' }} onClick={(e) => { self.openFormPage(FIELDS.formUuid); }}>
                  <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 4, background: project.color, marginRight: 8 }}></span>
                  <strong style={{ color: '#162033' }}>{project.name}</strong>
                  <div style={{ marginTop: 4, color: '#64748B', fontSize: 12 }}>{project.meta}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Calendar</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
              {['04', '05', '06', '07', '08'].map((day) => (
                <button key={day} type="button" onClick={(e) => { self.handleButtonClick(e); }} style={{ height: 52, border: day === '07' ? '0' : '1px solid #E2E8F0', borderRadius: 14, background: day === '07' ? '#6D5DF6' : '#FFFFFF', color: day === '07' ? '#FFFFFF' : '#162033', fontWeight: 900, cursor: 'pointer' }}>{day}</button>
              ))}
            </div>
            <div style={{ padding: 14, borderRadius: 16, background: 'linear-gradient(135deg,#F1F5FF,#FFFFFF)', border: '1px solid #E2E8F0' }}>
              <strong>Meeting with VP</strong>
              <div style={{ marginTop: 4, color: '#64748B', fontSize: 12 }}>Today / 10:00 - 11:00 / 5 位成员</div>
            </div>
          </div>
        </div>

        <div style={gridStyle}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>快速新增事项</h2>
            <p style={styles.cardDesc}>录入事项名称并选择归属团队，点击后会即时写入右侧列表，形成真实可操作的页面闭环。</p>
            <input
              id="template-input"
              className="oyd-input"
              style={styles.input}
              type="text"
              placeholder="输入任务、客户或关键字"
              defaultValue=""
              onCompositionStart={() => { _customState._isComposing = true; }}
              onCompositionEnd={(e) => {
                _customState._isComposing = false;
                self.handleInputChange(e);
              }}
              onChange={(e) => { self.handleInputChange(e); }}
            />
            {this.renderDropdown('selectedId', DEPARTMENT_OPTIONS, state.selectedId, '请选择部门')}
            <button
              className="oyd-btn oyd-btn-primary"
              style={styles.button}
              onClick={(e) => { self.handleButtonClick(e); }}
            >
              提交并刷新视图
            </button>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>业务数据队列</h2>
            <p style={styles.cardDesc}>列表默认模拟运营协同数据，接入真实表单后可替换为 searchFormDatas 返回值。</p>
            {state.loading ? (
              <div style={{ textAlign: 'center', padding: '28px', color: '#64748B' }}>加载中...</div>
            ) : (
              <div style={styles.list}>
                {data.map((item, index) => {
                  var formData = item.formData || {};
                  var itemName = item.name || formData[FIELDS.name] || '未命名事项';
                  var itemDepartment = item.department || formData[FIELDS.department] || '未分组';
                  var metric = item.metric || item.trend || '--';
                  return (
                    <div key={index} style={styles.listItem}>
                      <div>
                        <div style={styles.itemName}>{itemName}</div>
                        <div style={styles.itemMeta}>{itemDepartment} / {item.owner || '负责人待定'}</div>
                      </div>
                      <div style={styles.itemMetric}>{metric}</div>
                      <button
                        className="oyd-btn"
                        style={styles.secondaryButton}
                        onClick={(e) => { self.openFormPage(FIELDS.formUuid); }}
                      >
                        查看
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr',
          gap: 14,
          marginTop: 14,
        }}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>My Goals</h2>
            {[
              { name: 'Check emails and messages', project: 'Product launch', progress: 73, color: '#21C7B5' },
              { name: 'Prepare client status update', project: 'Product launch', progress: 11, color: '#F59E0B' },
              { name: 'Update project documentation', project: 'Team brainstorm', progress: 63, color: '#21C7B5' },
            ].map((goal) => (
              <div key={goal.name} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 42px', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #E2E8F0' }}>
                <div>
                  <strong>{goal.name}</strong>
                  <div style={{ color: '#64748B', fontSize: 12, marginTop: 3 }}>{goal.project} / My Projects</div>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#EEF2F7', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: goal.progress + '%', background: goal.color }}></span></div>
                <strong>{goal.progress}%</strong>
              </div>
            ))}
          </div>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Reminders</h2>
            {['评估晨会提出的新风险', '整理明日站会关键点', '同步补件截止时间'].map((item, index) => (
              <button key={item} type="button" style={{ width: '100%', minHeight: 48, border: 0, borderBottom: '1px solid #E2E8F0', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#162033', fontWeight: 700 }} onClick={(e) => { self.handleButtonClick(e); }}>
                <span style={{ color: index === 0 ? '#D14343' : '#64748B', marginRight: 8 }}>{index === 0 ? '优先' : '提醒'}</span>{item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
