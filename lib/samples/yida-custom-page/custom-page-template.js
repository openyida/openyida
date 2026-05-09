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

// ============================================================
// 状态管理（全局变量，不是 export function）
// ============================================================
var _customState = {
  // 在此定义所有业务状态的初始值
  loading: false,
  data: [],
  inputValue: '',
  selectedId: null,
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
  return { ..._customState };
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
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box'
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
    <div style={containerStyle}>
      {/* 必须保留：timestamp 用于触发 React 重新渲染 */}
      <div style={{ display: 'none' }}>{timestamp}</div>
      
      {/* 页面头部 */}
      <div style={styles.header}>
        <h1 style={styles.title}>页面标题</h1>
        <p style={{ color: '#666', margin: 0 }}>页面描述</p>
      </div>
      
      {/* 内容区域 */}
      <div style={styles.card}>
        {/* 输入框示例 */}
        <input
          id="template-input"
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
        
        {/* 按钮示例 */}
        <button 
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
              <div key={index} style={styles.card}>
                <div>{item.formData[FIELDS.name]}</div>
                <button 
                  style={styles.button}
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
