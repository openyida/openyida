/**
 * TodoMVC interaction template
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 *
 * 生成示例：
 * openyida generate-page todo-mvc --output project/pages/src/todo-mvc.oyd.jsx --compile
 */

var TODO_CONFIG = {
  title: '{{TODO_TITLE}}',
  subtitle: '{{TODO_SUBTITLE}}',
  placeholder: '{{TODO_PLACEHOLDER}}',
  storageKey: '{{TODO_STORAGE_KEY}}',
  allLabel: '{{TODO_ALL_LABEL}}',
  activeLabel: '{{TODO_ACTIVE_LABEL}}',
  completedLabel: '{{TODO_COMPLETED_LABEL}}',
  clearCompletedLabel: '{{TODO_CLEAR_COMPLETED_LABEL}}',
};

var TODO_TOKENS = {
  title: '{' + '{TODO_TITLE}' + '}',
  subtitle: '{' + '{TODO_SUBTITLE}' + '}',
  placeholder: '{' + '{TODO_PLACEHOLDER}' + '}',
  storageKey: '{' + '{TODO_STORAGE_KEY}' + '}',
  allLabel: '{' + '{TODO_ALL_LABEL}' + '}',
  activeLabel: '{' + '{TODO_ACTIVE_LABEL}' + '}',
  completedLabel: '{' + '{TODO_COMPLETED_LABEL}' + '}',
  clearCompletedLabel: '{' + '{TODO_CLEAR_COMPLETED_LABEL}' + '}',
  itemsJson: '{' + '{TODO_ITEMS_JSON}' + '}',
  themeProfileJson: '{' + '{OPENYIDA_THEME_PROFILE_JSON}' + '}',
  themeScope: '{' + '{OPENYIDA_THEME_SCOPE}' + '}',
};

if (TODO_CONFIG.title === TODO_TOKENS.title) {
  TODO_CONFIG.title = '团队任务指挥台';
}
if (TODO_CONFIG.subtitle === TODO_TOKENS.subtitle) {
  TODO_CONFIG.subtitle = '把今日任务、筛选、编辑、完成状态和清理动作集中到一个高密度任务面板。';
}
if (TODO_CONFIG.placeholder === TODO_TOKENS.placeholder) {
  TODO_CONFIG.placeholder = '输入新的任务，按 Enter 创建';
}
if (TODO_CONFIG.storageKey === TODO_TOKENS.storageKey) {
  TODO_CONFIG.storageKey = 'openyida.todoMVC';
}
if (TODO_CONFIG.allLabel === TODO_TOKENS.allLabel) {
  TODO_CONFIG.allLabel = '全部';
}
if (TODO_CONFIG.activeLabel === TODO_TOKENS.activeLabel) {
  TODO_CONFIG.activeLabel = '进行中';
}
if (TODO_CONFIG.completedLabel === TODO_TOKENS.completedLabel) {
  TODO_CONFIG.completedLabel = '已完成';
}
if (TODO_CONFIG.clearCompletedLabel === TODO_TOKENS.clearCompletedLabel) {
  TODO_CONFIG.clearCompletedLabel = '清理已完成';
}

var DEFAULT_TODOS = [
  { id: 1, content: '确认重点客户回访结果', done: false },
  { id: 2, content: '复核审批 SLA 异常记录', done: true },
  { id: 3, content: '同步本周自动化执行报告', done: false },
  { id: 4, content: '补齐合同归档缺失附件', done: false },
];

var TODO_ITEMS_JSON = '{{TODO_ITEMS_JSON}}';
var THEME_PROFILE_JSON = '{{OPENYIDA_THEME_PROFILE_JSON}}';
var THEME_SCOPE = '{{OPENYIDA_THEME_SCOPE}}';

var NATIVE_CONTROL_RESET_CSS = [
  '.oyd-page{--oyd-control-border:#D0D5DD;--oyd-control-hover:#63D7C8;--oyd-control-focus:#0F9F8E;--oyd-control-focus-ring:rgba(15,159,142,.16);--oyd-control-selected-bg:rgba(15,159,142,.10);--oyd-control-info-bg:rgba(15,159,142,.10);}',
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

function normalizeTodoList(items) {
  if (!items || !items.length) {
    return [];
  }

  return items
    .map((item, index) => {
      var content = item && (item.content || item.title || item.text);
      if (!content) {
        return null;
      }
      return {
        id: item.id === undefined || item.id === null || item.id === '' ? index + 1 : item.id,
        content: String(content),
        done: item.done === true || item.done === 'true' || item.status === 'done' || item.status === 'completed',
      };
    })
    .filter((item) => !!item);
}

function parseGeneratedTodos(raw, tokenValue, fallback) {
  if (!raw || raw === tokenValue) {
    return fallback;
  }

  try {
    var parsed = JSON.parse(raw);
    var normalized = normalizeTodoList(parsed);
    if (normalized.length) {
      return normalized;
    }
  } catch (err) {
    if (err && err.message) {
      return fallback;
    }
  }

  return fallback;
}

function parseGeneratedObject(raw, tokenValue, fallback) {
  if (!raw || raw === tokenValue) {
    return fallback;
  }

  try {
    var parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (err) {
    if (err && err.message) {
      return fallback;
    }
  }

  return fallback;
}

var THEME_PROFILE = parseGeneratedObject(THEME_PROFILE_JSON, TODO_TOKENS.themeProfileJson, {
  name: 'crisp-mint-taskflow',
  themeColor: '#0F9F8E',
  themeColorDeep: '#075E54',
  themeColorSoft: '#ECFDF8',
  themeColorTint: 'rgba(15, 159, 142, 0.18)',
  navTheme: 'light',
  mode: 'color_color',
  colorMode: 'gradient',
  mobileNavStyle: 'top',
});

if (!THEME_SCOPE || THEME_SCOPE === TODO_TOKENS.themeScope) {
  THEME_SCOPE = 'page';
}

function getThemeColor(profile, key, fallback) {
  return profile && profile[key] ? profile[key] : fallback;
}

function resolveScopedThemeVars(scope, profile) {
  if (scope !== 'page') {
    return {};
  }
  return {
    '--color-brand1-6': getThemeColor(profile, 'themeColor', '#6B7CAB'),
    '--color-brand1-2': getThemeColor(profile, 'themeColorSoft', '#F3F5FB'),
    '--color-brand1-3': getThemeColor(profile, 'themeColorTint', 'rgba(107, 124, 171, 0.2)'),
    '--color-brand1-9': getThemeColor(profile, 'themeColorDeep', '#435480'),
    '--color-brand-4': getThemeColor(profile, 'themeColorDeep', '#435480'),
    '--color-brand-3': getThemeColor(profile, 'themeColor', '#6B7CAB'),
  };
}

function applyShellTheme(scope, profile) {
  if (scope !== 'app') {
    return;
  }
  try {
    var updateShellConfig = window && window.__YIDA__ && window.__YIDA__.updateShellConfig;
    if (typeof updateShellConfig !== 'function') {
      return;
    }
    updateShellConfig({
      themeConfig: {
        theme: getThemeColor(profile, 'navTheme', 'light'),
        colorMode: getThemeColor(profile, 'colorMode', 'gradient'),
        mode: getThemeColor(profile, 'mode', 'color_color'),
        themeColor: getThemeColor(profile, 'themeColor', '#6B7CAB'),
        mobileNavStyle: getThemeColor(profile, 'mobileNavStyle', 'top'),
      },
    });
  } catch (err) {
    if (err && err.message) {
      return;
    }
  }
}

function cloneTodos(items) {
  return items.map((item) => ({
    id: item.id,
    content: item.content,
    done: item.done === true,
  }));
}

function getNextId(items) {
  var maxId = 0;
  items.forEach((item) => {
    var numericId = Number(item.id);
    if (!isNaN(numericId) && numericId > maxId) {
      maxId = numericId;
    }
  });
  return maxId + 1;
}

var INITIAL_TODOS = parseGeneratedTodos(TODO_ITEMS_JSON, TODO_TOKENS.itemsJson, DEFAULT_TODOS);

var _customState = {
  todoList: cloneTodos(INITIAL_TODOS),
  editRowId: '',
  mode: 'All',
  newId: getNextId(INITIAL_TODOS),
  ready: false,
};

export function getCustomState(key) {
  if (key) {
    return _customState[key];
  }
  return Object.assign({}, _customState);
}

export function setCustomState(newState) {
  Object.keys(newState || {}).forEach((key) => {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

export function getTodoData() {
  if (!window.localStorage) {
    return {};
  }

  try {
    var raw = window.localStorage.getItem(TODO_CONFIG.storageKey);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

export function saveTodoData(todoList, newId) {
  if (!window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(TODO_CONFIG.storageKey, JSON.stringify({
      todoList: cloneTodos(todoList || []),
      newId: newId,
    }));
  } catch (err) {
    if (this.utils && this.utils.toast) {
      this.utils.toast({ title: '本地存储失败，请检查浏览器权限', type: 'warning' });
    }
  }
}

export function commitTodoState(todoList, patch) {
  var current = this.getCustomState();
  var nextState = Object.assign({
    todoList: todoList,
    newId: current.newId,
  }, patch || {});

  this.setCustomState(nextState);
  this.saveTodoData(nextState.todoList, nextState.newId);
}

export function didMount() {
  applyShellTheme(THEME_SCOPE, THEME_PROFILE);

  var stored = this.getTodoData();
  var storedTodos = normalizeTodoList(stored.todoList || []);
  if (storedTodos.length) {
    this.setCustomState({
      todoList: storedTodos,
      newId: stored.newId || getNextId(storedTodos),
      ready: true,
    });
    return;
  }

  this.setCustomState({ ready: true });
}

export function didUnmount() {}

export function isEnterKey(e) {
  return e && (e.key === 'Enter' || e.keyCode === 13);
}

export function addTodo(e) {
  if (!this.isEnterKey(e)) {
    return;
  }

  var value = e && e.target ? String(e.target.value || '').trim() : '';
  if (!value) {
    return;
  }

  var state = this.getCustomState();
  var nextTodo = {
    id: state.newId,
    content: value,
    done: false,
  };
  var nextList = [nextTodo].concat(state.todoList || []);
  this.commitTodoState(nextList, {
    newId: state.newId + 1,
    editRowId: '',
  });

  if (e.target) {
    e.target.value = '';
  }
}

export function addTodoFromButton() {
  var input = document.getElementById('openyida-todo-input');
  var value = input ? String(input.value || '').trim() : '';
  if (!value) {
    this.utils.toast({ title: '请输入任务内容', type: 'warning' });
    return;
  }

  var state = this.getCustomState();
  var nextTodo = {
    id: state.newId,
    content: value,
    done: false,
  };
  var nextList = [nextTodo].concat(state.todoList || []);
  this.commitTodoState(nextList, {
    newId: state.newId + 1,
    editRowId: '',
  });

  if (input) {
    input.value = '';
  }
  this.utils.toast({ title: '已新增任务', type: 'success' });
}

export function startEdit(todoId) {
  this.setCustomState({ editRowId: todoId });
}

export function cancelEdit() {
  this.setCustomState({ editRowId: '' });
}

export function commitEdit(todoId, e) {
  if (e && e.type === 'keydown' && !this.isEnterKey(e)) {
    return;
  }

  var value = e && e.target ? String(e.target.value || '').trim() : '';
  if (!value) {
    this.cancelEdit();
    return;
  }

  var state = this.getCustomState();
  var nextList = (state.todoList || []).map((item) => {
    if (item.id === todoId) {
      return Object.assign({}, item, { content: value });
    }
    return item;
  });

  this.commitTodoState(nextList, { editRowId: '' });
}

export function toggleTodo(todoId) {
  var state = this.getCustomState();
  var nextList = (state.todoList || []).map((item) => {
    if (item.id === todoId) {
      return Object.assign({}, item, { done: !item.done });
    }
    return item;
  });

  this.commitTodoState(nextList, { editRowId: '' });
}

export function removeTodo(todoId) {
  var state = this.getCustomState();
  var nextList = (state.todoList || []).filter((item) => item.id !== todoId);
  this.commitTodoState(nextList, { editRowId: '' });
}

export function setMode(mode) {
  this.setCustomState({ mode: mode });
}

export function clearCompleted() {
  var state = this.getCustomState();
  var nextList = (state.todoList || []).filter((item) => !item.done);
  this.commitTodoState(nextList, { editRowId: '' });
}

export function getShowList() {
  var state = this.getCustomState();
  var todoList = state.todoList || [];

  if (state.mode === 'Active') {
    return todoList.filter((item) => !item.done);
  }
  if (state.mode === 'Completed') {
    return todoList.filter((item) => item.done);
  }
  return todoList;
}

export function getLeftCount() {
  var todoList = this.getCustomState('todoList') || [];
  return todoList.filter((item) => !item.done).length;
}

export function renderFilterButton(mode, label, activeMode, styles) {
  var active = mode === activeMode;
  return (
    <button
      type="button"
      style={active ? Object.assign({}, styles.filterButton, styles.filterButtonActive) : styles.filterButton}
      onClick={() => this.setMode(mode)}
    >
      {label}
    </button>
  );
}

export function renderTodoItem(item, styles) {
  var editing = this.getCustomState('editRowId') === item.id;
  var labelStyle = item.done ? Object.assign({}, styles.todoText, styles.todoTextDone) : styles.todoText;

  return (
    <li key={item.id} style={styles.todoItem}>
      <button
        type="button"
        aria-label={item.done ? '标记为进行中' : '标记为已完成'}
        style={item.done ? Object.assign({}, styles.checkButton, styles.checkButtonDone) : styles.checkButton}
        onClick={() => this.toggleTodo(item.id)}
      >
        {item.done ? '完' : ''}
      </button>

      <div style={styles.todoMain}>
        {editing ? (
          <input
            key={'edit-' + item.id + '-' + item.content}
            autoFocus={true}
            defaultValue={item.content}
            style={styles.editInput}
            onKeyDown={(e) => this.commitEdit(item.id, e)}
            onBlur={(e) => this.commitEdit(item.id, e)}
          />
        ) : (
          <button type="button" style={labelStyle} onClick={() => this.startEdit(item.id)}>
            {item.content}
          </button>
        )}
      </div>

      <button type="button" style={styles.textButton} onClick={() => this.startEdit(item.id)}>
        编辑
      </button>
      <button type="button" style={styles.deleteButton} onClick={() => this.removeTodo(item.id)}>
        删除
      </button>
    </li>
  );
}

export function renderJsx() {
  var self = this;
  var state = self.getCustomState();
  var visibleTodos = self.getShowList();
  var leftCount = self.getLeftCount();
  var completedCount = (state.todoList || []).length - leftCount;
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;

  var colors = {
    ink: '#10201D',
    muted: '#58706B',
    soft: '#ECFDF8',
    panel: '#FFFFFF',
    line: '#D8EEE8',
    blue: '#0F9F8E',
    green: '#0F9F8E',
    red: '#D14343',
    amber: '#B7791F',
    violet: '#6D5DF6',
  };

  var styles = {
    page: Object.assign(resolveScopedThemeVars(THEME_SCOPE, THEME_PROFILE), {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #ECFDF8 0%, #F8FBFF 48%, #EEF2FF 100%)',
      color: colors.ink,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      letterSpacing: '0',
      padding: isMobile ? '14px 12px' : '28px',
    }),
    shell: {
      maxWidth: 1280,
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '260px minmax(0, 1fr) 330px',
      gap: 18,
    },
    header: {
      borderRadius: 22,
      padding: isMobile ? 18 : 22,
      background: 'linear-gradient(160deg, #063C36 0%, #0F9F8E 72%, #7DD3C7 100%)',
      color: '#FFFFFF',
      minHeight: isMobile ? 'auto' : 420,
      boxShadow: '0 24px 70px rgba(15,159,142,0.25)',
    },
    title: {
      margin: 0,
      fontSize: isMobile ? 28 : 30,
      lineHeight: isMobile ? '36px' : '38px',
      fontWeight: 900,
      color: '#FFFFFF',
      letterSpacing: '0',
    },
    subtitle: {
      margin: '8px 0 0',
      color: 'rgba(255,255,255,0.74)',
      fontSize: isMobile ? 14 : 15,
      lineHeight: '24px',
    },
    sideStats: {
      display: 'grid',
      gap: 10,
      marginTop: 26,
    },
    sideStat: {
      border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: 16,
      padding: 14,
      background: 'rgba(255,255,255,0.12)',
    },
    sideValue: {
      fontSize: 26,
      lineHeight: '32px',
      fontWeight: 900,
    },
    sideLabel: {
      marginTop: 2,
      color: 'rgba(255,255,255,0.68)',
      fontSize: 12,
      fontWeight: 700,
    },
    panel: {
      backgroundColor: colors.panel,
      border: '1px solid ' + colors.line,
      borderRadius: 22,
      boxShadow: '0 24px 60px rgba(16,32,29,0.12)',
      overflow: 'hidden',
    },
    inputRow: {
      padding: isMobile ? 14 : 18,
      borderBottom: '1px solid ' + colors.line,
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 120px',
      gap: 10,
    },
    newInput: {
      boxSizing: 'border-box',
      width: '100%',
      height: 52,
      border: '1px solid ' + colors.line,
      borderRadius: 14,
      padding: '0 16px',
      fontSize: 16,
      fontWeight: 400,
      outline: 'none',
      boxShadow: 'none',
      appearance: 'none',
      WebkitAppearance: 'none',
      color: colors.ink,
      backgroundColor: '#FBFFFD',
    },
    addButton: {
      height: 52,
      border: '0',
      borderRadius: 14,
      backgroundColor: colors.blue,
      color: '#FFFFFF',
      fontWeight: 900,
      cursor: 'pointer',
      boxShadow: '0 14px 28px rgba(15,159,142,0.22)',
    },
    todoList: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
    },
    todoItem: {
      minHeight: 64,
      display: 'grid',
      gridTemplateColumns: isMobile ? '34px 1fr' : '36px 1fr auto auto',
      gap: isMobile ? 8 : 10,
      alignItems: 'center',
      padding: isMobile ? '12px 14px' : '12px 18px',
      borderBottom: '1px solid ' + colors.line,
      background: '#FFFFFF',
    },
    checkButton: {
      width: 28,
      height: 28,
      borderRadius: 10,
      border: '2px solid ' + colors.line,
      backgroundColor: colors.panel,
      color: colors.panel,
      cursor: 'pointer',
      fontWeight: 900,
      lineHeight: '22px',
      fontSize: 12,
    },
    checkButtonDone: {
      borderColor: colors.green,
      backgroundColor: colors.green,
      color: '#FFFFFF',
    },
    todoMain: {
      minWidth: 0,
    },
    todoText: {
      width: '100%',
      border: 0,
      padding: 0,
      margin: 0,
      textAlign: 'left',
      backgroundColor: 'transparent',
      color: colors.ink,
      fontSize: 16,
      lineHeight: '24px',
      fontWeight: 700,
      cursor: 'pointer',
      wordBreak: 'break-word',
    },
    todoTextDone: {
      color: colors.muted,
      textDecoration: 'line-through',
    },
    editInput: {
      boxSizing: 'border-box',
      width: '100%',
      minHeight: 40,
      border: '1px solid ' + colors.blue,
      borderRadius: 8,
      padding: '0 10px',
      fontSize: 16,
      fontWeight: 400,
      outline: 'none',
      boxShadow: 'none',
      appearance: 'none',
      WebkitAppearance: 'none',
    },
    textButton: {
      border: '1px solid ' + colors.line,
      backgroundColor: '#F8FAFD',
      color: colors.blue,
      borderRadius: 8,
      padding: '8px 10px',
      fontWeight: 800,
      cursor: 'pointer',
      gridColumn: isMobile ? '2 / 3' : 'auto',
      justifySelf: isMobile ? 'start' : 'auto',
    },
    deleteButton: {
      border: '1px solid rgba(209,67,67,0.22)',
      backgroundColor: '#FFF7F7',
      color: colors.red,
      borderRadius: 8,
      padding: '8px 10px',
      fontWeight: 800,
      cursor: 'pointer',
      gridColumn: isMobile ? '2 / 3' : 'auto',
      justifySelf: isMobile ? 'start' : 'auto',
    },
    footer: {
      padding: isMobile ? '12px 14px' : '14px 18px',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'center',
      justifyContent: 'space-between',
      gap: 12,
      color: colors.muted,
      fontSize: 14,
    },
    filters: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
    },
    filterButton: {
      border: '1px solid ' + colors.line,
      borderRadius: 999,
      backgroundColor: colors.panel,
      color: colors.ink,
      padding: '8px 12px',
      fontWeight: 800,
      cursor: 'pointer',
    },
    filterButtonActive: {
      borderColor: colors.blue,
      backgroundColor: '#E6FFFA',
      color: colors.blue,
    },
    clearButton: {
      border: '1px solid rgba(183,121,31,0.28)',
      borderRadius: 8,
      backgroundColor: '#FFF8EA',
      color: colors.amber,
      padding: '8px 10px',
      fontWeight: 800,
      cursor: completedCount > 0 ? 'pointer' : 'not-allowed',
      opacity: completedCount > 0 ? 1 : 0.5,
    },
    empty: {
      padding: 28,
      color: colors.muted,
      textAlign: 'center',
      borderBottom: '1px solid ' + colors.line,
    },
  };

  return (
    <div className="oyd-page" style={styles.page}>
      <style>{NATIVE_CONTROL_RESET_CSS}</style>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <div style={{ width: 46, height: 46, borderRadius: 16, background: '#FFFFFF', color: colors.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>CH</div>
            <div>
              <div style={{ fontWeight: 900 }}>Courtney Henry</div>
              <div style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12 }}>Online</div>
            </div>
          </div>
          <h1 style={styles.title}>{TODO_CONFIG.title}</h1>
          <p style={styles.subtitle}>{TODO_CONFIG.subtitle}</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
            {['Home', 'Prodify AI', 'My tasks', 'Inbox', 'Calendar', 'Reports'].map((item, index) => (
              <button key={item} type="button" style={{ height: 38, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12, background: index === 0 ? 'rgba(255,255,255,0.20)' : 'transparent', color: '#FFFFFF', textAlign: 'left', padding: '0 12px', cursor: 'pointer', fontWeight: 800 }} onClick={(e) => { self.setMode(index === 2 ? 'Active' : 'All'); }}>
                {item}
              </button>
            ))}
          </div>
          <div style={styles.sideStats}>
            <div style={styles.sideStat}>
              <div style={styles.sideValue}>{(state.todoList || []).length}</div>
              <div style={styles.sideLabel}>全部任务</div>
            </div>
            <div style={styles.sideStat}>
              <div style={styles.sideValue}>{leftCount}</div>
              <div style={styles.sideLabel}>进行中</div>
            </div>
            <div style={styles.sideStat}>
              <div style={styles.sideValue}>{completedCount}</div>
              <div style={styles.sideLabel}>已完成</div>
            </div>
          </div>
        </header>

        <section style={styles.panel}>
          <div style={{ padding: isMobile ? 14 : 18, borderBottom: '1px solid ' + colors.line }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: colors.violet }}>Mon, July 7</div>
            <h2 style={{ margin: '10px 0 4px', fontSize: isMobile ? 24 : 32, lineHeight: isMobile ? '32px' : '40px', color: colors.ink }}>Hello, Courtney</h2>
            <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 900, color: colors.blue }}>How can I help you today?</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
              <button type="button" style={styles.addButton} onClick={(e) => { self.addTodoFromButton(e); }}>Ask AI</button>
              <button type="button" style={styles.filterButton} onClick={(e) => { self.setMode('Active'); }}>Get task updates</button>
              <button type="button" style={styles.filterButton} onClick={(e) => { self.setMode('All'); }}>Create workspace</button>
            </div>
          </div>
          <div style={styles.inputRow}>
            <input
              id="openyida-todo-input"
              type="text"
              aria-label="New todo"
              placeholder={TODO_CONFIG.placeholder}
              style={styles.newInput}
              onKeyDown={(e) => { self.addTodo(e); }}
            />
            <button type="button" style={styles.addButton} onClick={(e) => { self.addTodoFromButton(e); }}>
              新增任务
            </button>
          </div>

          {visibleTodos.length ? (
            <ul style={styles.todoList}>
              {visibleTodos.map((item) => self.renderTodoItem(item, styles))}
            </ul>
          ) : (
            <div style={styles.empty}>当前筛选条件下暂无任务</div>
          )}

          <footer style={styles.footer}>
            <span>{leftCount} 项进行中</span>
            <div style={styles.filters}>
              {self.renderFilterButton('All', TODO_CONFIG.allLabel, state.mode, styles)}
              {self.renderFilterButton('Active', TODO_CONFIG.activeLabel, state.mode, styles)}
              {self.renderFilterButton('Completed', TODO_CONFIG.completedLabel, state.mode, styles)}
            </div>
            <button
              type="button"
              disabled={completedCount === 0}
              style={styles.clearButton}
              onClick={(e) => { self.clearCompleted(e); }}
            >
              {TODO_CONFIG.clearCompletedLabel}
            </button>
          </footer>
        </section>

        <aside style={{ display: 'grid', gap: 18 }}>
          <section style={styles.panel}>
            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 20, color: colors.ink }}>Projects</h2>
                <button type="button" style={styles.filterButton} onClick={(e) => { self.setMode('All'); }}>Recents</button>
              </div>
              {[
                { name: 'Product launch', meta: '6 tasks / 12 teammates', color: '#A855F7' },
                { name: 'Team brainstorm', meta: '2 tasks / 32 teammates', color: '#4F46E5' },
                { name: 'Branding launch', meta: '4 tasks / 9 teammates', color: '#06B6D4' },
              ].map((project) => (
                <button key={project.name} type="button" style={{ width: '100%', minHeight: 56, border: 0, background: 'transparent', display: 'grid', gridTemplateColumns: '34px 1fr', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer', padding: '12px 0', borderBottom: '1px solid ' + colors.line }} onClick={(e) => { self.setMode('Active'); }}>
                  <span style={{ width: 34, height: 34, borderRadius: 12, background: project.color, display: 'block' }}></span>
                  <span><strong style={{ color: colors.ink }}>{project.name}</strong><span style={{ display: 'block', color: colors.muted, fontSize: 12, marginTop: 3 }}>{project.meta}</span></span>
                </button>
              ))}
            </div>
          </section>
          <section style={styles.panel}>
            <div style={{ padding: 18 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: colors.ink }}>Calendar</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 16 }}>
                {['04', '05', '06', '07', '08'].map((day) => (
                  <button key={day} type="button" style={{ height: 52, border: day === '07' ? 0 : '1px solid ' + colors.line, borderRadius: 14, background: day === '07' ? colors.violet : '#FFFFFF', color: day === '07' ? '#FFFFFF' : colors.ink, fontWeight: 900, cursor: 'pointer' }} onClick={(e) => { self.setMode('All'); }}>{day}</button>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: 16, borderRadius: 18, background: '#F1F4FF', color: colors.ink }}>
                <strong>Meeting with VP</strong>
                <div style={{ marginTop: 4, color: colors.muted, fontSize: 12 }}>Today / 10:00 - 11:00</div>
                <button type="button" style={styles.textButton} onClick={(e) => { self.addTodoFromButton(e); }}>同步为任务</button>
              </div>
            </div>
          </section>
          <section style={styles.panel}>
            <div style={{ padding: 18 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: colors.ink }}>Reminders</h2>
              {['Assess morning meeting risks', 'Outline stand-up notes', 'Confirm missing attachments'].map((item, index) => (
                <button key={item} type="button" style={{ width: '100%', border: 0, borderBottom: '1px solid ' + colors.line, background: 'transparent', textAlign: 'left', padding: '13px 0', color: colors.ink, cursor: 'pointer', fontWeight: 700 }} onClick={(e) => { self.setMode(index === 0 ? 'Active' : 'All'); }}>
                  <span style={{ color: index === 0 ? colors.red : colors.blue, marginRight: 8 }}>{index === 0 ? '优先' : '提醒'}</span>{item}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
