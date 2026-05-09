/**
 * TodoMVC interaction template
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
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
};

if (TODO_CONFIG.title === TODO_TOKENS.title) {
  TODO_CONFIG.title = 'Todos';
}
if (TODO_CONFIG.subtitle === TODO_TOKENS.subtitle) {
  TODO_CONFIG.subtitle = '一个用于验证宜搭自定义页面事件、状态、循环渲染和本地持久化的 OpenYida 模板。';
}
if (TODO_CONFIG.placeholder === TODO_TOKENS.placeholder) {
  TODO_CONFIG.placeholder = 'What needs to be done?';
}
if (TODO_CONFIG.storageKey === TODO_TOKENS.storageKey) {
  TODO_CONFIG.storageKey = 'openyida.todoMVC';
}
if (TODO_CONFIG.allLabel === TODO_TOKENS.allLabel) {
  TODO_CONFIG.allLabel = 'All';
}
if (TODO_CONFIG.activeLabel === TODO_TOKENS.activeLabel) {
  TODO_CONFIG.activeLabel = 'Active';
}
if (TODO_CONFIG.completedLabel === TODO_TOKENS.completedLabel) {
  TODO_CONFIG.completedLabel = 'Completed';
}
if (TODO_CONFIG.clearCompletedLabel === TODO_TOKENS.clearCompletedLabel) {
  TODO_CONFIG.clearCompletedLabel = 'Clear completed';
}

var DEFAULT_TODOS = [
  { id: 1, content: '用 OpenYida 生成宜搭自定义页面', done: false },
  { id: 2, content: '运行 check-page 和 compile 做发布前检查', done: true },
  { id: 3, content: '接入真实表单数据后发布到宜搭', done: false },
];

var TODO_ITEMS_JSON = '{{TODO_ITEMS_JSON}}';

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
        aria-label={item.done ? 'Mark as active' : 'Mark as completed'}
        style={item.done ? Object.assign({}, styles.checkButton, styles.checkButtonDone) : styles.checkButton}
        onClick={() => this.toggleTodo(item.id)}
      >
        {item.done ? '✓' : ''}
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
        Edit
      </button>
      <button type="button" style={styles.deleteButton} onClick={() => this.removeTodo(item.id)}>
        Delete
      </button>
    </li>
  );
}

export function renderJsx() {
  var state = this.getCustomState();
  var visibleTodos = this.getShowList();
  var leftCount = this.getLeftCount();
  var completedCount = (state.todoList || []).length - leftCount;
  var isMobile = this.utils && this.utils.isMobile ? this.utils.isMobile() : false;

  var colors = {
    ink: '#182033',
    muted: '#667085',
    soft: '#F4F6FA',
    panel: '#FFFFFF',
    line: '#D9E1EA',
    blue: '#2F65D9',
    green: '#138A63',
    red: '#D14343',
    amber: '#B7791F',
  };

  var styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: colors.soft,
      color: colors.ink,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      letterSpacing: '0',
      padding: isMobile ? '20px 14px' : '44px 24px',
    },
    shell: {
      maxWidth: 760,
      margin: '0 auto',
    },
    header: {
      marginBottom: 18,
    },
    title: {
      margin: 0,
      fontSize: isMobile ? 48 : 72,
      lineHeight: isMobile ? '56px' : '78px',
      fontWeight: 900,
      color: colors.ink,
      letterSpacing: '0',
    },
    subtitle: {
      margin: '8px 0 0',
      color: colors.muted,
      fontSize: isMobile ? 14 : 15,
      lineHeight: '24px',
    },
    panel: {
      backgroundColor: colors.panel,
      border: '1px solid ' + colors.line,
      borderRadius: 8,
      boxShadow: '0 12px 28px rgba(24,32,51,0.08)',
      overflow: 'hidden',
    },
    inputRow: {
      padding: isMobile ? 14 : 18,
      borderBottom: '1px solid ' + colors.line,
    },
    newInput: {
      boxSizing: 'border-box',
      width: '100%',
      height: 48,
      border: '1px solid ' + colors.line,
      borderRadius: 8,
      padding: '0 14px',
      fontSize: 16,
      outline: 'none',
      color: colors.ink,
      backgroundColor: '#FBFCFE',
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
    },
    checkButton: {
      width: 28,
      height: 28,
      borderRadius: 999,
      border: '2px solid ' + colors.line,
      backgroundColor: colors.panel,
      color: colors.panel,
      cursor: 'pointer',
      fontWeight: 900,
      lineHeight: '22px',
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
      outline: 'none',
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
      borderRadius: 8,
      backgroundColor: colors.panel,
      color: colors.ink,
      padding: '7px 10px',
      fontWeight: 800,
      cursor: 'pointer',
    },
    filterButtonActive: {
      borderColor: colors.blue,
      backgroundColor: '#EEF4FF',
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
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <h1 style={styles.title}>{TODO_CONFIG.title}</h1>
          <p style={styles.subtitle}>{TODO_CONFIG.subtitle}</p>
        </header>

        <section style={styles.panel}>
          <div style={styles.inputRow}>
            <input
              type="text"
              aria-label="New todo"
              placeholder={TODO_CONFIG.placeholder}
              style={styles.newInput}
              onKeyDown={(e) => this.addTodo(e)}
            />
          </div>

          {visibleTodos.length ? (
            <ul style={styles.todoList}>
              {visibleTodos.map((item) => this.renderTodoItem(item, styles))}
            </ul>
          ) : (
            <div style={styles.empty}>当前筛选条件下暂无任务</div>
          )}

          <footer style={styles.footer}>
            <span>{leftCount} item{leftCount === 1 ? '' : 's'} left</span>
            <div style={styles.filters}>
              {this.renderFilterButton('All', TODO_CONFIG.allLabel, state.mode, styles)}
              {this.renderFilterButton('Active', TODO_CONFIG.activeLabel, state.mode, styles)}
              {this.renderFilterButton('Completed', TODO_CONFIG.completedLabel, state.mode, styles)}
            </div>
            <button
              type="button"
              disabled={completedCount === 0}
              style={styles.clearButton}
              onClick={() => this.clearCompleted()}
            >
              {TODO_CONFIG.clearCompletedLabel}
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
