// ============================================================
// CRM 批量数据录入页面
// 支持：客户信息、商机管理、客户回访 三种表单的批量录入
// ============================================================

// ── 配置区 ─────────────────────────────────────────────────

var APP_TYPE = 'APP_MRNQXYA404IHD2P6JHSD';
var DRAFT_KEY_PREFIX = 'yida_crm_batch_entry_';

var FORM_CONFIG = {
  customer: {
    formUuid: 'FORM-48FB56AFA31E43B09BDE30B7165D3E92D7WT',
    name: '客户信息',
    columns: [
      { label: '客户名称', field: 'textField_l1h42qsqz', type: 'text', required: true },
      { label: '客户类型', field: 'radioField_l1h43yhd1', type: 'select', options: ['企业客户', '个人客户'] },
      { label: '客户级别', field: 'selectField_l1h54iojj', type: 'select', options: ['A级', 'B级', 'C级', 'D级'] },
      { label: '联系人', field: 'textField_l1h55ogqo', type: 'text' },
      { label: '联系电话', field: 'textField_l1h566r7t', type: 'text' },
      { label: '联系邮箱', field: 'textField_l1h57ofjl', type: 'text' }
    ]
  },
  opportunity: {
    formUuid: 'FORM-ECCF67D4CC994968B2675C9CBD0F04A536P0',
    name: '商机管理',
    columns: [
      { label: '商机名称', field: 'textField_ozj624rw0', type: 'text', required: true },
      { label: '商机阶段', field: 'selectField_ozj64pdqc', type: 'select', options: ['初步接触', '需求确认', '方案报价', '谈判', '赢单', '输单'] },
      { label: '预计金额(万)', field: 'numberField_ozj651thb', type: 'number' },
      { label: '成交概率(%)', field: 'numberField_ozj66qh91', type: 'number' },
      { label: '商机来源', field: 'radioField_ozj69jqrp', type: 'select', options: ['新开发', '老客户', '合作伙伴'] }
    ]
  },
  visit: {
    formUuid: 'FORM-21CC57767B184FB389DD0E9E765F028D77OA',
    name: '客户回访',
    columns: [
      { label: '回访方式', field: 'radioField_pjlt40nnj', type: 'select', options: ['电话', '上门', '视频', '邮件'] },
      { label: '满意度(1-5)', field: 'rateField_pjlt5hp2q', type: 'number' },
      { label: '回访记录', field: 'textareaField_pjlt8k3dg', type: 'text' }
    ]
  }
};

var FORM_OPTIONS = [
  { key: 'customer', label: '客户信息' },
  { key: 'opportunity', label: '商机管理' },
  { key: 'visit', label: '客户回访' }
];

// ── 状态 ───────────────────────────────────────────────────

var _customState = {
  selectedForm: 'customer',  // 当前选择的表单类型
  rows: [],                  // 行数据列表
  selectedRows: {},          // 选中的行 { rowId: true }
  submitting: false,         // 是否正在提交
  submitProgress: { current: 0, total: 0 },  // 提交进度
  submitResult: null         // { success: number, failed: number }
};

// ── 工具函数 ───────────────────────────────────────────────

function generateRowId() {
  return 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function getCurrentFormConfig() {
  return FORM_CONFIG[_customState.selectedForm];
}

function getDraftKey() {
  return DRAFT_KEY_PREFIX + _customState.selectedForm;
}

function createEmptyRow() {
  var row = { id: generateRowId(), _status: 'valid', _errors: {} };
  var config = getCurrentFormConfig();
  config.columns.forEach(function(col) { row[col.field] = ''; });
  return row;
}

function validateRow(row) {
  var errors = {};
  var config = getCurrentFormConfig();
  config.columns.forEach(function(col) {
    if (col.required && !row[col.field]) {
      errors[col.field] = col.label + '不能为空';
    }
    if (col.type === 'number' && row[col.field]) {
      var num = Number(row[col.field]);
      if (isNaN(num)) {
        errors[col.field] = col.label + '必须是数字';
      }
    }
  });
  return errors;
}

function saveDraft(rows) {
  try {
    localStorage.setItem(getDraftKey(), JSON.stringify(rows));
  } catch (e) { /* ignore */ }
}

function loadDraft() {
  try {
    var saved = localStorage.getItem(getDraftKey());
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function clearDraft() {
  try { localStorage.removeItem(getDraftKey()); } catch (e) { /* ignore */ }
}

// ── 状态管理 ───────────────────────────────────────────────

export function getCustomState(key) {
  if (key) return _customState[key];
  return Object.assign({}, _customState);
}

export function setCustomState(newState) {
  Object.keys(newState).forEach(function(key) {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

// ── 生命周期 ───────────────────────────────────────────────

export function didMount() {
  // 绑定粘贴事件
  var self = this;
  self._pasteHandler = function(e) { self.handlePaste(e); };
  document.addEventListener('paste', self._pasteHandler);

  // 恢复草稿
  var draft = loadDraft();
  if (draft && draft.length > 0) {
    _customState.rows = draft;
  } else {
    _customState.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
  }
  this.forceUpdate();
}

export function didUnmount() {
  // 清理粘贴事件监听
  if (this._pasteHandler) {
    document.removeEventListener('paste', this._pasteHandler);
  }
}

// ── 表单切换 ───────────────────────────────────────────────

export function handleFormChange(e) {
  var newFormKey = e.target.value;
  // 保存当前表单的草稿
  saveDraft(_customState.rows);
  
  // 切换表单
  _customState.selectedForm = newFormKey;
  _customState.selectedRows = {};
  _customState.submitResult = null;
  
  // 加载新表单的草稿
  var draft = loadDraft();
  if (draft && draft.length > 0) {
    _customState.rows = draft;
  } else {
    _customState.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
  }
  this.forceUpdate();
}

// ── 行操作 ─────────────────────────────────────────────────

export function addRow() {
  _customState.rows.push(createEmptyRow());
  saveDraft(_customState.rows);
  this.forceUpdate();
}

export function deleteRow(rowId) {
  _customState.rows = _customState.rows.filter(function(row) {
    return row.id !== rowId;
  });
  delete _customState.selectedRows[rowId];
  if (_customState.rows.length === 0) {
    _customState.rows.push(createEmptyRow());
  }
  saveDraft(_customState.rows);
  this.forceUpdate();
}

export function deleteSelectedRows() {
  var selectedIds = Object.keys(_customState.selectedRows);
  if (selectedIds.length === 0) {
    this.utils.toast({ title: '请先选择要删除的行', type: 'warning' });
    return;
  }
  _customState.rows = _customState.rows.filter(function(row) {
    return !_customState.selectedRows[row.id];
  });
  _customState.selectedRows = {};
  if (_customState.rows.length === 0) {
    _customState.rows.push(createEmptyRow());
  }
  saveDraft(_customState.rows);
  this.forceUpdate();
}

export function clearAllRows() {
  _customState.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
  _customState.selectedRows = {};
  _customState.submitResult = null;
  clearDraft();
  this.forceUpdate();
  this.utils.toast({ title: '已清空所有数据', type: 'success' });
}

export function toggleRowSelection(rowId) {
  if (_customState.selectedRows[rowId]) {
    delete _customState.selectedRows[rowId];
  } else {
    _customState.selectedRows[rowId] = true;
  }
  this.forceUpdate();
}

export function toggleSelectAll() {
  var allSelected = _customState.rows.length > 0 && 
    _customState.rows.every(function(row) { return _customState.selectedRows[row.id]; });
  
  if (allSelected) {
    _customState.selectedRows = {};
  } else {
    _customState.rows.forEach(function(row) {
      _customState.selectedRows[row.id] = true;
    });
  }
  this.forceUpdate();
}

export function updateCell(rowId, field, value) {
  var row = _customState.rows.find(function(r) { return r.id === rowId; });
  if (!row) return;
  row[field] = value;
  // 清除该字段的错误
  if (row._errors[field]) {
    delete row._errors[field];
    row._status = Object.keys(row._errors).length === 0 ? 'valid' : 'invalid';
  }
  saveDraft(_customState.rows);
  // 不触发重渲染，静默更新
}

// ── Excel 粘贴导入 ─────────────────────────────────────────

export function handlePaste(event) {
  var clipboardData = event.clipboardData || window.clipboardData;
  if (!clipboardData) return;
  var text = clipboardData.getData('text');
  if (!text) return;

  var config = getCurrentFormConfig();
  var lines = text.trim().split('\n');
  var newRows = lines.map(function(line) {
    var cells = line.split('\t');
    var row = createEmptyRow();
    config.columns.forEach(function(col, index) {
      if (cells[index] !== undefined) {
        row[col.field] = cells[index].trim();
      }
    });
    return row;
  });

  // 过滤掉全空行
  newRows = newRows.filter(function(row) {
    return config.columns.some(function(col) { return row[col.field]; });
  });

  if (newRows.length === 0) return;

  // 追加到现有行（过滤掉现有的全空行）
  var nonEmptyExisting = _customState.rows.filter(function(row) {
    return config.columns.some(function(col) { return row[col.field]; });
  });
  _customState.rows = nonEmptyExisting.concat(newRows);
  saveDraft(_customState.rows);
  this.forceUpdate();
  this.utils.toast({ title: '已导入 ' + newRows.length + ' 行数据', type: 'success' });
}

// ── 批量提交 ───────────────────────────────────────────────

export function submitAll() {
  var self = this;
  var config = getCurrentFormConfig();

  // 1. 验证所有行
  var hasError = false;
  _customState.rows.forEach(function(row) {
    var errors = validateRow(row);
    row._errors = errors;
    if (Object.keys(errors).length > 0) {
      row._status = 'invalid';
      hasError = true;
    }
  });

  if (hasError) {
    self.forceUpdate();
    self.utils.toast({ title: '请修正表格中的错误后再提交', type: 'error' });
    return;
  }

  // 2. 过滤掉全空行
  var rowsToSubmit = _customState.rows.filter(function(row) {
    return config.columns.some(function(col) { return row[col.field]; });
  });

  if (rowsToSubmit.length === 0) {
    self.utils.toast({ title: '请至少填写一行数据', type: 'error' });
    return;
  }

  _customState.submitting = true;
  _customState.submitProgress = { current: 0, total: rowsToSubmit.length };
  _customState.submitResult = null;
  self.forceUpdate();

  // 3. 批量提交（并发）
  var completedCount = 0;
  var promises = rowsToSubmit.map(function(row) {
    var formDataJson = {};
    config.columns.forEach(function(col) {
      var val = row[col.field];
      // 数字类型转换
      if (col.type === 'number' && val) {
        formDataJson[col.field] = Number(val);
      } else {
        formDataJson[col.field] = val;
      }
    });

    row._status = 'submitting';

    return self.utils.yida.saveFormData({
      formUuid: config.formUuid,
      appType: APP_TYPE,
      formDataJson: JSON.stringify(formDataJson)
    }).then(function() {
      row._status = 'submitted';
      completedCount++;
      _customState.submitProgress.current = completedCount;
      self.forceUpdate();
    }).catch(function(err) {
      row._status = 'invalid';
      row._errors._submit = err.message || '提交失败';
      completedCount++;
      _customState.submitProgress.current = completedCount;
      self.forceUpdate();
    });
  });

  Promise.all(promises).then(function() {
    var successCount = rowsToSubmit.filter(function(r) { return r._status === 'submitted'; }).length;
    var failedCount = rowsToSubmit.filter(function(r) { return r._status === 'invalid'; }).length;

    _customState.submitting = false;
    _customState.submitResult = { success: successCount, failed: failedCount };

    if (failedCount === 0) {
      clearDraft();
      _customState.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
      self.utils.toast({ title: '全部提交成功，共 ' + successCount + ' 条', type: 'success' });
    } else {
      self.utils.toast({
        title: '提交完成：' + successCount + ' 条成功，' + failedCount + ' 条失败',
        type: 'error'
      });
    }
    self.forceUpdate();
  }).catch(function(err) {
    _customState.submitting = false;
    self.forceUpdate();
    self.utils.toast({ title: '提交异常：' + err.message, type: 'error' });
  });
}

// ── 渲染辅助 ───────────────────────────────────────────────

export function renderCellInput(row, col) {
  var self = this;
  var value = row[col.field];
  var hasError = !!row._errors[col.field];
  var isSubmitted = row._status === 'submitted';

  var baseInputStyle = {
    width: '100%',
    height: '32px',
    padding: '0 8px',
    border: '1px solid ' + (hasError ? '#ff4d4f' : '#d9d9d9'),
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    background: isSubmitted ? '#f6ffed' : '#fff',
    boxSizing: 'border-box'
  };

  if (col.type === 'select') {
    return (
      <select
        defaultValue={value}
        disabled={isSubmitted}
        onChange={(e) => { self.updateCell(row.id, col.field, e.target.value); }}
        style={baseInputStyle}
      >
        <option value="">请选择</option>
        {(col.options || []).map(function(opt) {
          return <option key={opt} value={opt}>{opt}</option>;
        })}
      </select>
    );
  }

  return (
    <input
      type={col.type === 'number' ? 'number' : 'text'}
      defaultValue={value}
      disabled={isSubmitted}
      placeholder={col.required ? col.label + '（必填）' : col.label}
      onChange={(e) => { self.updateCell(row.id, col.field, e.target.value); }}
      style={baseInputStyle}
    />
  );
}

// ── 主渲染 ─────────────────────────────────────────────────

export function renderJsx() {
  var self = this;
  var timestamp = this.state.timestamp;
  var config = getCurrentFormConfig();
  var columns = config.columns;

  var allSelected = _customState.rows.length > 0 && 
    _customState.rows.every(function(row) { return _customState.selectedRows[row.id]; });
  var selectedCount = Object.keys(_customState.selectedRows).length;

  // ── 样式定义 ─────────────────────────────────────────────
  var styles = {
    container: {
      padding: '16px',
      background: '#f5f7fa',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
      padding: '16px 20px',
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    },
    title: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#1f2937'
    },
    formSelect: {
      height: '36px',
      padding: '0 12px',
      fontSize: '14px',
      border: '1px solid #d9d9d9',
      borderRadius: '6px',
      background: '#fff',
      marginLeft: '12px',
      cursor: 'pointer'
    },
    toolbar: {
      display: 'flex',
      gap: '8px',
      marginBottom: '12px',
      padding: '12px 16px',
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    btn: {
      height: '32px',
      padding: '0 14px',
      fontSize: '13px',
      border: '1px solid #d9d9d9',
      borderRadius: '6px',
      background: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    btnPrimary: {
      height: '32px',
      padding: '0 16px',
      fontSize: '13px',
      border: 'none',
      borderRadius: '6px',
      background: '#1677ff',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    btnDanger: {
      height: '32px',
      padding: '0 14px',
      fontSize: '13px',
      border: '1px solid #ff4d4f',
      borderRadius: '6px',
      background: '#fff',
      color: '#ff4d4f',
      cursor: 'pointer'
    },
    tableContainer: {
      background: '#fff',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    },
    tableHeader: {
      display: 'grid',
      gridTemplateColumns: '40px ' + columns.map(function() { return '1fr'; }).join(' ') + ' 60px',
      background: '#fafafa',
      borderBottom: '1px solid #f0f0f0',
      padding: '10px 12px'
    },
    headerCell: {
      fontSize: '13px',
      fontWeight: 600,
      color: '#595959'
    },
    tableRow: {
      display: 'grid',
      gridTemplateColumns: '40px ' + columns.map(function() { return '1fr'; }).join(' ') + ' 60px',
      padding: '8px 12px',
      borderBottom: '1px solid #f0f0f0',
      alignItems: 'start'
    },
    checkbox: {
      width: '16px',
      height: '16px',
      cursor: 'pointer',
      marginTop: '8px'
    },
    cellWrapper: {
      paddingRight: '8px'
    },
    errorText: {
      fontSize: '11px',
      color: '#ff4d4f',
      marginTop: '2px'
    },
    deleteBtn: {
      border: 'none',
      background: 'none',
      color: '#ff4d4f',
      cursor: 'pointer',
      fontSize: '16px',
      padding: '4px 8px'
    },
    progressBar: {
      marginTop: '12px',
      padding: '12px 16px',
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    },
    progressTrack: {
      height: '8px',
      background: '#f0f0f0',
      borderRadius: '4px',
      overflow: 'hidden',
      marginTop: '8px'
    },
    progressFill: {
      height: '100%',
      background: '#1677ff',
      borderRadius: '4px',
      transition: 'width 0.3s ease'
    },
    resultBox: {
      marginTop: '12px',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '14px'
    },
    tip: {
      marginTop: '8px',
      fontSize: '12px',
      color: '#8c8c8c',
      textAlign: 'right'
    }
  };

  return (
    <div style={styles.container}>
      {/* 隐藏的 timestamp 用于触发重渲染 */}
      <div style={{ display: 'none' }}>{timestamp}</div>

      {/* 标题栏 */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={styles.title}>批量数据录入</span>
          <select
            value={_customState.selectedForm}
            onChange={(e) => { self.handleFormChange(e); }}
            style={styles.formSelect}
          >
            {FORM_OPTIONS.map(function(opt) {
              return <option key={opt.key} value={opt.key}>{opt.label}</option>;
            })}
          </select>
        </div>
        <div style={{ fontSize: '13px', color: '#8c8c8c' }}>
          当前：{config.name}（{_customState.rows.length} 行）
        </div>
      </div>

      {/* 工具栏 */}
      <div style={styles.toolbar}>
        <button
          onClick={() => { self.addRow(); }}
          style={styles.btn}
        >
          ➕ 添加行
        </button>
        <button
          onClick={() => { self.deleteSelectedRows(); }}
          style={Object.assign({}, styles.btn, selectedCount > 0 ? { borderColor: '#ff4d4f', color: '#ff4d4f' } : {})}
        >
          🗑 删除选中 {selectedCount > 0 ? '(' + selectedCount + ')' : ''}
        </button>
        <button
          onClick={() => { self.clearAllRows(); }}
          style={styles.btn}
        >
          🔄 清空
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '12px', color: '#8c8c8c', marginRight: '8px' }}>
          💡 提示：可直接从 Excel 复制数据粘贴导入
        </span>
        <button
          onClick={() => { self.submitAll(); }}
          disabled={_customState.submitting}
          style={Object.assign({}, styles.btnPrimary, _customState.submitting ? { background: '#bfbfbf', cursor: 'not-allowed' } : {})}
        >
          {_customState.submitting ? '⏳ 提交中...' : '✓ 批量提交'}
        </button>
      </div>

      {/* 表格 */}
      <div style={styles.tableContainer}>
        {/* 表头 */}
        <div style={styles.tableHeader}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => { self.toggleSelectAll(); }}
              style={styles.checkbox}
            />
          </div>
          {columns.map(function(col) {
            return (
              <div key={col.field} style={styles.headerCell}>
                {col.required && <span style={{ color: '#ff4d4f', marginRight: '2px' }}>*</span>}
                {col.label}
              </div>
            );
          })}
          <div style={Object.assign({}, styles.headerCell, { textAlign: 'center' })}>操作</div>
        </div>

        {/* 数据行 */}
        {_customState.rows.map(function(row) {
          var rowBg = row._status === 'submitted' ? '#f6ffed'
            : row._status === 'invalid' ? '#fff2f0'
            : row._status === 'submitting' ? '#e6f7ff'
            : '#fff';

          return (
            <div key={row.id} style={Object.assign({}, styles.tableRow, { background: rowBg })}>
              {/* 选择框 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!_customState.selectedRows[row.id]}
                  disabled={row._status === 'submitted'}
                  onChange={() => { self.toggleRowSelection(row.id); }}
                  style={styles.checkbox}
                />
              </div>

              {/* 数据列 */}
              {columns.map(function(col) {
                return (
                  <div key={col.field} style={styles.cellWrapper}>
                    {self.renderCellInput(row, col)}
                    {row._errors[col.field] && (
                      <div style={styles.errorText}>{row._errors[col.field]}</div>
                    )}
                    {row._errors._submit && col === columns[0] && (
                      <div style={styles.errorText}>{row._errors._submit}</div>
                    )}
                  </div>
                );
              })}

              {/* 操作列 */}
              <div style={{ textAlign: 'center' }}>
                {row._status === 'submitted' && (
                  <span style={{ color: '#52c41a', fontSize: '16px' }}>✓</span>
                )}
                {row._status === 'submitting' && (
                  <span style={{ color: '#1677ff', fontSize: '12px' }}>提交中</span>
                )}
                {row._status !== 'submitted' && row._status !== 'submitting' && (
                  <button
                    onClick={() => { self.deleteRow(row.id); }}
                    style={styles.deleteBtn}
                    title="删除此行"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 提交进度条 */}
      {_customState.submitting && (
        <div style={styles.progressBar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>提交进度</span>
            <span style={{ fontSize: '13px', color: '#1677ff' }}>
              {_customState.submitProgress.current} / {_customState.submitProgress.total}
            </span>
          </div>
          <div style={styles.progressTrack}>
            <div
              style={Object.assign({}, styles.progressFill, {
                width: (_customState.submitProgress.total > 0
                  ? Math.round(_customState.submitProgress.current / _customState.submitProgress.total * 100)
                  : 0) + '%'
              })}
            />
          </div>
        </div>
      )}

      {/* 提交结果 */}
      {_customState.submitResult && (
        <div style={Object.assign({}, styles.resultBox, {
          background: _customState.submitResult.failed === 0 ? '#f6ffed' : '#fff2f0',
          border: '1px solid ' + (_customState.submitResult.failed === 0 ? '#b7eb8f' : '#ffccc7')
        })}>
          提交完成：
          <span style={{ color: '#52c41a', fontWeight: 600 }}>
            {_customState.submitResult.success} 条成功
          </span>
          {_customState.submitResult.failed > 0 && (
            <span style={{ color: '#ff4d4f', fontWeight: 600, marginLeft: '8px' }}>
              {_customState.submitResult.failed} 条失败（请修正红色行后重新提交）
            </span>
          )}
        </div>
      )}

      {/* 草稿提示 */}
      <div style={styles.tip}>
        数据已自动保存为草稿，刷新页面后可继续编辑
      </div>
    </div>
  );
}
