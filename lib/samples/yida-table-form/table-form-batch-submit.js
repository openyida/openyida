// ── 配置区（根据实际表单修改）────────────────────────

var FORM_UUID = 'FORM-XXX';
var DRAFT_KEY = 'yida_table_form_draft_' + FORM_UUID;

// 列定义：label 显示名、field 字段 ID、type 字段类型、required 是否必填
var COLUMNS = [
  { label: '姓名', field: 'textField_name', type: 'text', required: true },
  { label: '部门', field: 'selectField_dept', type: 'select', required: true,
    options: ['研发部', '产品部', '运营部', '市场部'] },
  { label: '日期', field: 'dateField_date', type: 'date', required: true },
  { label: '备注', field: 'textField_remark', type: 'text', required: false },
];

// ── 状态 ─────────────────────────────────────────────

var _customState = {
  rows: [],           // 行数据列表
  submitting: false,  // 是否正在提交
  submitResult: null, // { success: number, failed: number }
};

// ── 工具函数 ─────────────────────────────────────────

function generateRowId() {
  return 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function createEmptyRow() {
  var row = { id: generateRowId(), _status: 'valid', _errors: {} };
  COLUMNS.forEach(function (col) { row[col.field] = ''; });
  return row;
}

function validateRow(row) {
  var errors = {};
  COLUMNS.forEach(function (col) {
    if (col.required && !row[col.field]) {
      errors[col.field] = col.label + '不能为空';
    }
  });
  return errors;
}

function saveDraft(rows) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(rows));
  } catch (e) {
    // localStorage 不可用时静默忽略
  }
}

function loadDraft() {
  try {
    var saved = localStorage.getItem(DRAFT_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
}

// ── 生命周期 ─────────────────────────────────────────

export function getCustomState(key) {
  if (key) return _customState[key];
  return Object.assign({}, _customState);
}

export function setCustomState(newState) {
  Object.keys(newState).forEach(function (key) {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

export function didMount() {
  // 恢复草稿
  var draft = loadDraft();
  if (draft && draft.length > 0) {
    _customState.rows = draft;
  } else {
    _customState.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
  }
  this.forceUpdate();
}

// ── 行操作 ───────────────────────────────────────────

export function addRow() {
  _customState.rows.push(createEmptyRow());
  saveDraft(_customState.rows);
  this.forceUpdate();
}

export function deleteRow(rowId) {
  _customState.rows = _customState.rows.filter(function (row) {
    return row.id !== rowId;
  });
  if (_customState.rows.length === 0) {
    _customState.rows.push(createEmptyRow());
  }
  saveDraft(_customState.rows);
  this.forceUpdate();
}

export function updateCell(rowId, field, value) {
  var row = _customState.rows.find(function (r) { return r.id === rowId; });
  if (!row) return;
  row[field] = value;
  // 清除该字段的错误
  if (row._errors[field]) {
    delete row._errors[field];
    row._status = Object.keys(row._errors).length === 0 ? 'valid' : 'invalid';
  }
  saveDraft(_customState.rows);
  this.forceUpdate();
}

// ── Excel 粘贴导入 ───────────────────────────────────

export function handlePaste(event) {
  var clipboardData = event.clipboardData || window.clipboardData;
  if (!clipboardData) return;
  var text = clipboardData.getData('text');
  if (!text) return;

  var lines = text.trim().split('\n');
  var newRows = lines.map(function (line) {
    var cells = line.split('\t');
    var row = createEmptyRow();
    COLUMNS.forEach(function (col, index) {
      if (cells[index] !== undefined) {
        row[col.field] = cells[index].trim();
      }
    });
    return row;
  });

  // 追加到现有行（过滤掉全空行）
  var nonEmptyExisting = _customState.rows.filter(function (row) {
    return COLUMNS.some(function (col) { return row[col.field]; });
  });
  _customState.rows = nonEmptyExisting.concat(newRows);
  saveDraft(_customState.rows);
  this.forceUpdate();

  this.utils.toast({ title: '已导入 ' + newRows.length + ' 行数据', type: 'success' });
}

// ── 批量提交 ─────────────────────────────────────────

export function submitAll() {
  var self = this;

  // 1. 验证所有行
  var hasError = false;
  _customState.rows.forEach(function (row) {
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
  var rowsToSubmit = _customState.rows.filter(function (row) {
    return COLUMNS.some(function (col) { return row[col.field]; });
  });

  if (rowsToSubmit.length === 0) {
    self.utils.toast({ title: '请至少填写一行数据', type: 'error' });
    return;
  }

  _customState.submitting = true;
  _customState.submitResult = null;
  self.forceUpdate();

  // 3. 批量提交（并发）
  var appType = window.pageConfig && window.pageConfig.appType;
  var promises = rowsToSubmit.map(function (row) {
    var formDataJson = {};
    COLUMNS.forEach(function (col) { formDataJson[col.field] = row[col.field]; });

    row._status = 'submitting';

    return self.utils.yida.saveFormData({
      formUuid: FORM_UUID,
      appType: appType,
      formDataJson: JSON.stringify(formDataJson),
    }).then(function () {
      row._status = 'submitted';
    }).catch(function (err) {
      row._status = 'invalid';
      row._errors._submit = err.message || '提交失败';
    });
  });

  Promise.all(promises).then(function () {
    var successCount = rowsToSubmit.filter(function (r) { return r._status === 'submitted'; }).length;
    var failedCount = rowsToSubmit.filter(function (r) { return r._status === 'invalid'; }).length;

    _customState.submitting = false;
    _customState.submitResult = { success: successCount, failed: failedCount };

    if (failedCount === 0) {
      clearDraft();
      // 提交成功后重置表格
      _customState.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
      self.utils.toast({ title: '全部提交成功，共 ' + successCount + ' 条', type: 'success' });
    } else {
      self.utils.toast({
        title: '提交完成：' + successCount + ' 条成功，' + failedCount + ' 条失败',
        type: 'error',
      });
    }
    self.forceUpdate();
  });
}

// ── 渲染 ─────────────────────────────────────────────

export function renderCellInput(row, col) {
  var self = this;
  var value = row[col.field];
  var hasError = !!row._errors[col.field];
  var isSubmitted = row._status === 'submitted';

  var baseInputStyle = {
    width: '100%',
    height: '28px',
    padding: '0 6px',
    border: '1px solid ' + (hasError ? '#ff4d4f' : '#d9d9d9'),
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
    background: isSubmitted ? '#f6ffed' : '#fff',
  };

  if (col.type === 'select') {
    return (
      <select
        value={value}
        disabled={isSubmitted}
        onChange={function (e) { self.updateCell.call(self, row.id, col.field, e.target.value); }}
        style={baseInputStyle}
      >
        <option value="">请选择</option>
        {(col.options || []).map(function (opt) {
          return <option key={opt} value={opt}>{opt}</option>;
        })}
      </select>
    );
  }

  return (
    <input
      type={col.type === 'date' ? 'date' : 'text'}
      value={value}
      disabled={isSubmitted}
      placeholder={col.required ? col.label + '（必填）' : col.label}
      onChange={function (e) { self.updateCell.call(self, row.id, col.field, e.target.value); }}
      style={baseInputStyle}
    />
  );
}

export function renderJsx() {
  var self = this;

  return (
    <div style={{ padding: '16px', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '12px', padding: '12px 16px',
        background: '#fff', borderRadius: '6px',
      }}>
        <span style={{ fontSize: '16px', fontWeight: 600 }}>批量录入</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={self.handlePaste.bind(self)}
            style={{
              height: '32px', padding: '0 12px', fontSize: '13px',
              border: '1px solid #d9d9d9', borderRadius: '4px',
              background: '#fff', cursor: 'pointer',
            }}
          >
            📋 粘贴 Excel 数据
          </button>
          <button
            onClick={self.addRow.bind(self)}
            style={{
              height: '32px', padding: '0 12px', fontSize: '13px',
              border: '1px solid #1890ff', borderRadius: '4px',
              background: '#fff', color: '#1890ff', cursor: 'pointer',
            }}
          >
            + 添加行
          </button>
          <button
            onClick={self.submitAll.bind(self)}
            disabled={_customState.submitting}
            style={{
              height: '32px', padding: '0 16px', fontSize: '13px',
              border: 'none', borderRadius: '4px',
              background: _customState.submitting ? '#bfbfbf' : '#1890ff',
              color: '#fff', cursor: _customState.submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {_customState.submitting ? '提交中...' : '✓ 提交全部'}
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div style={{ background: '#fff', borderRadius: '6px', overflow: 'hidden' }}>
        {/* 表头 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS.map(function () { return '1fr'; }).join(' ') + ' 60px',
          background: '#fafafa', borderBottom: '1px solid #f0f0f0',
          padding: '8px 12px',
        }}>
          {COLUMNS.map(function (col) {
            return (
              <div key={col.field} style={{ fontSize: '13px', fontWeight: 600, color: '#595959' }}>
                {col.required && <span style={{ color: '#ff4d4f', marginRight: '2px' }}>*</span>}
                {col.label}
              </div>
            );
          })}
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#595959', textAlign: 'center' }}>操作</div>
        </div>

        {/* 数据行 */}
        {_customState.rows.map(function (row) {
          var rowBg = row._status === 'submitted' ? '#f6ffed'
            : row._status === 'invalid' ? '#fff2f0' : '#fff';

          return (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: COLUMNS.map(function () { return '1fr'; }).join(' ') + ' 60px',
                padding: '6px 12px', borderBottom: '1px solid #f0f0f0',
                background: rowBg, alignItems: 'start',
              }}
            >
              {COLUMNS.map(function (col) {
                return (
                  <div key={col.field} style={{ paddingRight: '8px' }}>
                    {self.renderCellInput.call(self, row, col)}
                    {row._errors[col.field] && (
                      <div style={{ fontSize: '11px', color: '#ff4d4f', marginTop: '2px' }}>
                        {row._errors[col.field]}
                      </div>
                    )}
                    {row._errors._submit && col === COLUMNS[0] && (
                      <div style={{ fontSize: '11px', color: '#ff4d4f', marginTop: '2px' }}>
                        {row._errors._submit}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ textAlign: 'center', paddingTop: '4px' }}>
                {row._status !== 'submitted' && (
                  <button
                    onClick={self.deleteRow.bind(self, row.id)}
                    style={{
                      border: 'none', background: 'none',
                      color: '#ff4d4f', cursor: 'pointer', fontSize: '16px',
                    }}
                    title="删除此行"
                  >
                    🗑
                  </button>
                )}
                {row._status === 'submitted' && (
                  <span style={{ color: '#52c41a', fontSize: '16px' }}>✓</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 提交结果 */}
      {_customState.submitResult && (
        <div style={{
          marginTop: '12px', padding: '12px 16px',
          background: _customState.submitResult.failed === 0 ? '#f6ffed' : '#fff2f0',
          border: '1px solid ' + (_customState.submitResult.failed === 0 ? '#b7eb8f' : '#ffccc7'),
          borderRadius: '6px', fontSize: '14px',
        }}>
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
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#bfbfbf', textAlign: 'right' }}>
        数据已自动保存为草稿，刷新页面后可继续编辑
      </div>
    </div>
  );
}
