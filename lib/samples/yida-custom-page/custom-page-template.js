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
  data: [],
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
    '@theme { --color-brand: #2F6FED; }',
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
    '.oyd-btn,.oyd-select-trigger,.oyd-select-option{appearance:none;-webkit-appearance:none;font-family:inherit;}',
    '.oyd-btn{height:36px;border-radius:6px;border:1px solid #D0D5DD;background:#fff;padding:0 12px;font-size:14px;cursor:pointer;}',
    '.oyd-btn-primary{background:#2F6FED;border-color:#2F6FED;color:#fff;}',
    '.oyd-select-trigger{height:38px;border-radius:6px;border:1px solid #D0D5DD;background:#fff;padding:0 12px;font-size:14px;text-align:left;box-shadow:0 6px 14px rgba(15,23,42,.06);}',
    '.oyd-select-menu{position:absolute;z-index:30;margin-top:6px;width:100%;padding:6px;border:1px solid #E4E7EC;border-radius:10px;background:#fff;box-shadow:0 16px 32px rgba(16,24,40,.14);}',
    '.oyd-select-option{width:100%;min-height:36px;border:0;border-radius:8px;background:#fff;padding:0 10px;text-align:left;font-size:14px;cursor:pointer;}',
    '.oyd-select-option-active{background:#EFF6FF;color:#1D4ED8;font-weight:600;}',
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
  // 业务逻辑
  this.setCustomState({ inputValue: '' });
  this.utils.toast({ title: '操作成功', type: 'success' });
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
        className="oyd-select-trigger flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-left text-sm text-slate-800 shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        style={styles.selectTrigger}
        aria-expanded={open}
        onClick={(e) => { self.toggleDropdown(key); }}
      >
        <span className={selected ? 'truncate text-slate-800' : 'truncate text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="ml-2 text-xs text-slate-400">v</span>
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
                  ? 'oyd-select-option oyd-select-option-active flex w-full items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-left text-sm font-medium text-blue-700'
                  : 'oyd-select-option flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50'}
                style={active ? styles.optionActive : styles.option}
                onClick={(e) => { self.chooseDropdown(key, option.value); }}
              >
                <span>{option.label}</span>
                {active && <span className="text-xs">已选</span>}
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
    padding: '16px 24px',
    maxWidth: '1200px',
    margin: '0 auto',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    borderRadius: '0 !important',  // 清除宜搭默认圆角（编注12）
  },
  header: {
    marginBottom: '20px',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 10px 0'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '16px',
    marginBottom: '16px'
  },
  button: {
    backgroundColor: '#1677FF',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  secondaryButton: {
    backgroundColor: '#fff',
    color: '#344054',
    border: '1px solid #D0D5DD',
    borderRadius: '4px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  dropdownWrap: {
    position: 'relative',
    width: '100%',
    marginTop: '12px',
    marginBottom: '12px'
  },
  selectTrigger: {
    width: '100%',
    minHeight: 38,
    border: '1px solid #D0D5DD',
    borderRadius: 6,
    background: '#fff',
    padding: '0 12px',
    textAlign: 'left',
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
    boxShadow: '0 6px 14px rgba(15,23,42,.06)'
  },
  selectMenu: {
    position: 'absolute',
    zIndex: 30,
    marginTop: 6,
    width: '100%',
    background: '#fff',
    border: '1px solid #E4E7EC',
    borderRadius: 10,
    padding: 6,
    boxShadow: '0 16px 32px rgba(16,24,40,.14)'
  },
  option: {
    width: '100%',
    minHeight: 36,
    padding: '8px 12px',
    textAlign: 'left',
    background: '#fff',
    border: 0,
    borderRadius: 8,
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer'
  },
  optionActive: {
    width: '100%',
    minHeight: 36,
    padding: '8px 12px',
    textAlign: 'left',
    background: '#EFF6FF',
    border: 0,
    borderRadius: 8,
    color: '#1D4ED8',
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer'
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

  var containerStyle = Object.assign({}, styles.container, {
    padding: isMobile ? '12px' : '16px 24px',
  });
  
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={containerStyle}>
      {/* 必须保留：timestamp 用于触发 React 重新渲染 */}
      <div style={{ display: 'none' }}>{timestamp}</div>
      
      {/* 页面头部 */}
      <div className="border-b border-slate-200 pb-3" style={styles.header}>
        <h1 className="text-2xl font-bold tracking-normal text-slate-900" style={styles.title}>页面标题</h1>
        <p className="text-sm text-slate-500" style={{ color: '#666', margin: 0 }}>页面描述</p>
      </div>
      
      {/* 内容区域 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" style={styles.card}>
        {/* 输入框示例 */}
        <input
          id="template-input"
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          style={styles.input}
          type="text"
          placeholder="请输入内容"
          defaultValue=""
          onCompositionStart={() => { _customState._isComposing = true; }}
          onCompositionEnd={(e) => {
            _customState._isComposing = false;
            self.handleInputChange(e);
          }}
          onChange={(e) => { self.handleInputChange(e); }}
        />

        {/* 自定义下拉示例：不要使用原生 select */}
        {this.renderDropdown('selectedId', DEPARTMENT_OPTIONS, state.selectedId, '请选择部门')}
        
        {/* 按钮示例 */}
        <button 
          className="oyd-btn oyd-btn-primary inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          style={styles.button}
          onClick={(e) => { self.handleButtonClick(e); }}
        >
          提交
        </button>
      </div>
      
      {/* 数据列表示例 */}
      {state.loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
      ) : (
        <div>
          {state.data.map((item, index) => (
              <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" style={styles.card}>
                <div>{item.formData[FIELDS.name]}</div>
                <button 
                  className="oyd-btn mt-3 inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                  style={styles.secondaryButton}
                  onClick={(e) => { self.openFormPage(FIELDS.formUuid); }}
                >
                  查看详情
                </button>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}
