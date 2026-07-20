// ── 配置区（根据实际表单修改）────────────────────────

var FORM_UUID = 'FORM-XXX';
var DRAFT_KEY = 'yida_table_form_draft_' + FORM_UUID;
var TABLE_THEME = {
  primary: '#7C3AED',
  primaryHover: '#6D28D9',
  primarySoft: '#F5F3FF',
  primarySoftActive: '#EDE9FE',
  primaryLine: '#DDD6FE',
  text: '#24324A',
  textMuted: '#64748B',
  textSubtle: '#8A98AC',
  bg: '#F5F8FC',
  surface: '#FFFFFF',
  surfaceSoft: '#F9FBFE',
  line: '#DCE6F2',
  lineSoft: '#EEF3F8',
  shadow: '0 16px 36px rgba(124,58,237,0.10)',
  success: '#047857',
  successBg: '#ECFDF5',
  successLine: '#A7F3D0',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerLine: '#FECACA',
};

// 列定义：label 显示名、field 字段 ID、type 字段类型、required 是否必填
var COLUMNS = [
  { label: '姓名', field: 'textField_name', type: 'text', required: true },
  { label: '部门', field: 'selectField_dept', type: 'select', required: true,
    options: ['研发部', '产品部', '运营部', '市场部'] },
  { label: '日期', field: 'dateField_date', type: 'date', required: true },
  { label: '备注', field: 'textField_remark', type: 'text', required: false },
];

var DEMO_IMPORT_ROWS = [
  ['沈岚', '运营部', '2026-07-17', '重点客户回访确认'],
  ['顾川', '市场部', '2026-07-18', '渠道活动素材补充'],
  ['叶澜', '研发部', '2026-07-19', '审批自动化联调'],
  ['陈序', '产品部', '2026-07-20', '数据看板字段验收'],
];

// ── 状态 ─────────────────────────────────────────────

var _customState = {
  rows: [],           // 行数据列表
  submitting: false,  // 是否正在提交
  submitResult: null, // { success: number, failed: number }
  openSelectKey: '',
  statusFilter: 'all', // all | draft | invalid | submitted
  keyword: '',         // 行内搜索关键词
  dataToken: 0,        // 程序化改数据时自增，用于强制重挂载非受控输入
  lastAction: '草稿已就绪',
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

// 将行归一到一个展示状态：已提交 / 待修正 / 待完善
function rowDisplayStatus(row) {
  if (row._status === 'submitted') { return 'submitted'; }
  if (row._status === 'invalid') { return 'invalid'; }
  return 'draft';
}

function matchKeyword(row, kw) {
  if (!kw) { return true; }
  return COLUMNS.some(function (col) {
    return String(row[col.field] || '').toLowerCase().indexOf(kw) >= 0;
  });
}

// ── 生命周期 ─────────────────────────────────────────

export function getCustomState(key) {
  if (key) return _customState[key];
  return _.clone(_customState);
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
  _customState.statusFilter = 'all';
  _customState.dataToken++;
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
  _customState.dataToken++;
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

export function toggleSelect(rowId, field) {
  var key = rowId + '_' + field;
  _customState.openSelectKey = _customState.openSelectKey === key ? '' : key;
  this.forceUpdate();
}

export function chooseSelect(rowId, field, value) {
  _customState.openSelectKey = '';
  this.updateCell(rowId, field, value);
}

export function setStatusFilter(value) {
  _customState.statusFilter = value;
  this.forceUpdate();
}

export function setKeyword(value) {
  _customState.keyword = value;
  this.forceUpdate();
}

export function resetFilters() {
  _customState.statusFilter = 'all';
  _customState.keyword = '';
  _customState.dataToken++;
  this.forceUpdate();
}

// ── Excel 粘贴导入 ───────────────────────────────────

export function handlePaste(event) {
  var clipboardData = event.clipboardData || window.clipboardData;
  if (!clipboardData) {
    this.importDemoRows();
    return;
  }
  var text = clipboardData.getData('text');
  if (!text) {
    this.importDemoRows();
    return;
  }

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
  _customState.lastAction = '已从剪贴板导入 ' + newRows.length + ' 行';
  _customState.statusFilter = 'all';
  _customState.keyword = '';
  _customState.dataToken++;
  saveDraft(_customState.rows);
  this.forceUpdate();

  this.utils.toast({ title: '已导入 ' + newRows.length + ' 行数据', type: 'success' });
}

export function importDemoRows() {
  var newRows = DEMO_IMPORT_ROWS.map(function (cells) {
    var row = createEmptyRow();
    COLUMNS.forEach(function (col, index) {
      if (cells[index] !== undefined) {
        row[col.field] = cells[index];
      }
    });
    return row;
  });
  var nonEmptyExisting = _customState.rows.filter(function (row) {
    return COLUMNS.some(function (col) { return row[col.field]; });
  });
  _customState.rows = nonEmptyExisting.concat(newRows);
  _customState.submitResult = null;
  _customState.lastAction = '已导入示例数据 ' + newRows.length + ' 行';
  _customState.statusFilter = 'all';
  _customState.keyword = '';
  _customState.dataToken++;
  saveDraft(_customState.rows);
  this.forceUpdate();
  this.utils.toast({ title: '已导入示例数据 ' + newRows.length + ' 行', type: 'success' });
}

export function clearAllRows() {
  _customState.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
  _customState.submitResult = null;
  _customState.openSelectKey = '';
  _customState.statusFilter = 'all';
  _customState.keyword = '';
  _customState.dataToken++;
  _customState.lastAction = '已清空当前草稿';
  clearDraft();
  this.forceUpdate();
  this.utils.toast({ title: '已清空草稿', type: 'success' });
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
    _customState.lastAction = '提交完成：' + successCount + ' 条成功，' + failedCount + ' 条失败';

    if (failedCount === 0) {
      clearDraft();
      // 提交成功后重置表格
      _customState.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
      _customState.statusFilter = 'all';
      _customState.keyword = '';
      _customState.dataToken++;
      self.utils.toast({ title: '全部提交成功，共 ' + successCount + ' 条', type: 'success' });
    } else {
      // 有失败行时自动聚焦到待修正，方便定位
      _customState.statusFilter = 'invalid';
      _customState.dataToken++;
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
  var colors = TABLE_THEME;

  var baseInputStyle = {
    width: '100%',
    height: '32px',
    padding: '0 8px',
    border: '1px solid ' + (hasError ? colors.danger : colors.line),
    borderRadius: '7px',
    fontSize: '13px',
    outline: 'none',
    background: isSubmitted ? colors.successBg : colors.surface,
    boxShadow: 'none',
    fontWeight: 400,
    color: colors.text,
  };

  if (col.type === 'select') {
    var selectKey = row.id + '_' + col.field;
    var open = _customState.openSelectKey === selectKey;
    var label = value || '请选择';
    return (
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          disabled={isSubmitted}
          onClick={(e) => { self.toggleSelect(row.id, col.field); }}
          style={Object.assign({}, baseInputStyle, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textAlign: 'left',
            color: value ? colors.text : colors.textSubtle,
            cursor: isSubmitted ? 'not-allowed' : 'pointer',
          })}
        >
          <span>{label}</span>
          <span style={{ fontSize: '12px', color: colors.primary }}>{open ? '收起' : '展开'}</span>
        </button>
        {open && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '36px',
            zIndex: 20,
            padding: '6px',
            border: '1px solid ' + colors.line,
            borderRadius: '10px',
            background: colors.surface,
            boxShadow: colors.shadow,
          }}>
            {(col.options || []).map(function (opt) {
              var active = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={(e) => { self.chooseSelect(row.id, col.field, opt); }}
                  style={{
                    width: '100%',
                    minHeight: '32px',
                    border: 0,
                    borderRadius: '7px',
                    background: active ? colors.primarySoftActive : colors.surface,
                    color: active ? colors.primary : colors.text,
                    textAlign: 'left',
                    padding: '0 8px',
                    cursor: 'pointer',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <input
      key={row.id + '_' + col.field + '_' + _customState.dataToken}
      type={col.type === 'date' ? 'date' : 'text'}
      defaultValue={value}
      disabled={isSubmitted}
      placeholder={col.required ? col.label + '（必填）' : col.label}
      onChange={(e) => { self.updateCell(row.id, col.field, e.target.value); }}
      style={baseInputStyle}
    />
  );
}

export function renderJsx() {
  var self = this;
  var colors = TABLE_THEME;
  var filledRows = _customState.rows.filter(function (row) {
    return COLUMNS.some(function (col) { return row[col.field]; });
  }).length;
  var invalidRows = _customState.rows.filter(function (row) {
    return row._status === 'invalid';
  }).length;
  var kw = (_customState.keyword || '').trim().toLowerCase();
  var statusFilter = _customState.statusFilter || 'all';
  var visibleRows = _customState.rows.filter(function (row) {
    if (statusFilter !== 'all' && rowDisplayStatus(row) !== statusFilter) { return false; }
    return matchKeyword(row, kw);
  });
  var counts = {
    all: _customState.rows.length,
    draft: _customState.rows.filter(function (r) { return rowDisplayStatus(r) === 'draft'; }).length,
    invalid: invalidRows,
    submitted: _customState.rows.filter(function (r) { return rowDisplayStatus(r) === 'submitted'; }).length,
  };
  var FILTERS = [
    { key: 'all', label: '全部' },
    { key: 'draft', label: '待完善' },
    { key: 'invalid', label: '待修正' },
    { key: 'submitted', label: '已提交' },
  ];

  return (
    <div style={{ padding: '20px', background: colors.bg, minHeight: '100vh', color: colors.text }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        marginBottom: '10px', padding: '16px 18px',
        background: colors.surface, borderRadius: '12px', border: '1px solid ' + colors.line,
        boxShadow: colors.shadow,
      }}>
        <div>
          <div style={{ fontSize: '12px', color: colors.primary, fontWeight: 900 }}>批量数据录入</div>
          <div style={{ marginTop: '4px', fontSize: '20px', fontWeight: 900 }}>人员与任务数据表</div>
          <div style={{ marginTop: '4px', fontSize: '12px', color: colors.textMuted }}>支持表格粘贴、示例导入、行内校验、草稿暂存和批量提交</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={(e) => { self.handlePaste(e); }}
            style={{
              height: '32px', padding: '0 12px', fontSize: '13px',
              border: '1px solid ' + colors.line, borderRadius: '8px',
              background: colors.surface, cursor: 'pointer', color: colors.text, fontWeight: 700,
            }}
          >
            导入示例数据
          </button>
          <button
            onClick={(e) => { self.addRow(e); }}
            style={{
              height: '32px', padding: '0 12px', fontSize: '13px',
              border: '1px solid ' + colors.primaryLine, borderRadius: '8px',
              background: colors.primarySoft, color: colors.primary, cursor: 'pointer', fontWeight: 700,
            }}
          >
            添加行
          </button>
          <button
            onClick={(e) => { self.clearAllRows(e); }}
            style={{
              height: '32px', padding: '0 12px', fontSize: '13px',
              border: '1px solid ' + colors.line, borderRadius: '8px',
              background: colors.surfaceSoft, color: colors.textMuted, cursor: 'pointer', fontWeight: 700,
            }}
          >
            清空草稿
          </button>
          <button
            onClick={(e) => { self.submitAll(e); }}
            disabled={_customState.submitting}
            style={{
              height: '32px', padding: '0 16px', fontSize: '13px',
              border: 'none', borderRadius: '8px',
              background: _customState.submitting ? colors.primaryLine : colors.primary,
              color: '#fff', cursor: _customState.submitting ? 'not-allowed' : 'pointer', fontWeight: 800,
            }}
          >
            {_customState.submitting ? '提交中...' : '提交全部'}
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        flexWrap: 'wrap',
        marginBottom: '10px',
        padding: '10px 12px',
        background: colors.surface,
        border: '1px solid ' + colors.line,
        borderRadius: '12px',
      }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map(function (f) {
            var active = statusFilter === f.key;
            return (
              <button key={f.key} type="button" onClick={(e) => { self.setStatusFilter(f.key); }} style={{
                height: '30px', padding: '0 12px', border: '1px solid ' + (active ? colors.primaryLine : colors.line), borderRadius: '8px',
                background: active ? colors.primarySoft : colors.surface, color: active ? colors.primary : colors.textMuted,
                cursor: 'pointer', fontWeight: active ? 800 : 600,
              }}>
                {f.label}
                <span style={{ marginLeft: '6px', color: active ? colors.primary : colors.textSubtle }}>{counts[f.key]}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            key={'tf_search_' + _customState.dataToken}
            type="text"
            defaultValue={_customState.keyword}
            placeholder="搜索姓名 / 部门 / 备注"
            onChange={(e) => { self.setKeyword(e.target.value); }}
            style={{
              height: '30px', width: '200px', padding: '0 10px', border: '1px solid ' + colors.line,
              borderRadius: '8px', fontSize: '13px', outline: 'none', color: colors.text, background: colors.surface,
            }}
          />
          {(_customState.keyword || statusFilter !== 'all') && (
            <button type="button" onClick={(e) => { self.resetFilters(); }} style={{
              height: '30px', padding: '0 10px', border: '1px solid ' + colors.line, borderRadius: '8px',
              background: colors.surfaceSoft, color: colors.textMuted, cursor: 'pointer', fontWeight: 700,
            }}>
              重置筛选
            </button>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '10px',
        marginBottom: '10px',
      }}>
        <div onClick={(e) => { self.setStatusFilter('all'); }} style={{ background: colors.surface, border: '1px solid ' + colors.line, borderRadius: '10px', padding: '12px', cursor: 'pointer' }}>
          <div style={{ fontSize: '22px', fontWeight: 900 }}>{_customState.rows.length}</div>
          <div style={{ fontSize: '12px', color: colors.textMuted }}>当前行数</div>
        </div>
        <div style={{ background: colors.surface, border: '1px solid ' + colors.line, borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '22px', fontWeight: 900 }}>{filledRows}</div>
          <div style={{ fontSize: '12px', color: colors.textMuted }}>已填写</div>
        </div>
        <div onClick={(e) => { self.setStatusFilter('invalid'); }} style={{ background: colors.surface, border: '1px solid ' + colors.line, borderRadius: '10px', padding: '12px', cursor: 'pointer' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: invalidRows ? colors.danger : colors.success }}>{invalidRows}</div>
          <div style={{ fontSize: '12px', color: colors.textMuted }}>待修正</div>
        </div>
        <div style={{ background: colors.surface, border: '1px solid ' + colors.line, borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: colors.primary }}>{_customState.lastAction}</div>
          <div style={{ marginTop: '4px', fontSize: '12px', color: colors.textMuted }}>最近操作</div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 280px',
        gap: '10px',
        alignItems: 'start',
      }}>
      {/* 表格 */}
      <div style={{ background: colors.surface, borderRadius: '12px', border: '1px solid ' + colors.line, overflow: 'visible', boxShadow: colors.shadow }}>
        {/* 表头 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS.map(function () { return '1fr'; }).join(' ') + ' 60px',
          background: colors.surfaceSoft, borderBottom: '1px solid ' + colors.line,
          padding: '10px 12px',
        }}>
          {COLUMNS.map(function (col) {
            return (
              <div key={col.field} style={{ fontSize: '13px', fontWeight: 700, color: colors.text }}>
                {col.required && <span style={{ color: colors.danger, marginRight: '2px' }}>*</span>}
                {col.label}
              </div>
            );
          })}
          <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text, textAlign: 'center' }}>操作</div>
        </div>

        {/* 数据行 */}
        {visibleRows.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: colors.textSubtle, fontSize: '13px' }}>
            没有符合条件的行，试试切换筛选或清空搜索
          </div>
        )}
        {visibleRows.map(function (row) {
          var rowBg = row._status === 'submitted' ? colors.successBg
            : row._status === 'invalid' ? colors.dangerBg : colors.surface;

          return (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: COLUMNS.map(function () { return '1fr'; }).join(' ') + ' 60px',
                padding: '8px 12px', borderBottom: '1px solid ' + colors.lineSoft,
                background: rowBg, alignItems: 'start',
              }}
            >
              {COLUMNS.map(function (col) {
                return (
                  <div key={col.field} style={{ paddingRight: '8px' }}>
                    {self.renderCellInput.call(self, row, col)}
                    {row._errors[col.field] && (
                      <div style={{ fontSize: '11px', color: colors.danger, marginTop: '2px' }}>
                        {row._errors[col.field]}
                      </div>
                    )}
                    {row._errors._submit && col === COLUMNS[0] && (
                      <div style={{ fontSize: '11px', color: colors.danger, marginTop: '2px' }}>
                        {row._errors._submit}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ textAlign: 'center', paddingTop: '4px' }}>
                {row._status !== 'submitted' && (
                  <button
                    onClick={(e) => { self.deleteRow(row.id); }}
                    style={{
                      border: 'none', background: 'none',
                      color: colors.danger, cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                    }}
                    title="删除此行"
                  >
                    删除
                  </button>
                )}
                {row._status === 'submitted' && (
                  <span style={{ color: colors.success, fontSize: '12px', fontWeight: 800 }}>已提交</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <aside style={{ background: colors.surface, border: '1px solid ' + colors.line, borderRadius: '12px', padding: '14px', boxShadow: colors.shadow }}>
        <div style={{ fontSize: '12px', color: colors.primary, fontWeight: 900 }}>提交质检</div>
        <div style={{ marginTop: '8px', fontSize: '20px', fontWeight: 900 }}>{invalidRows === 0 ? '可以提交' : '需要修正'}</div>
        <div style={{ marginTop: '6px', color: colors.textMuted, fontSize: '12px', lineHeight: '20px' }}>系统会检查必填字段、行状态和提交结果，适合作为批量录入前的最后确认区。</div>
        {[
          { label: '有效行', value: filledRows + ' 行', tone: colors.success },
          { label: '缺失字段', value: invalidRows + ' 项', tone: invalidRows ? colors.danger : colors.success },
          { label: '草稿状态', value: _customState.lastAction, tone: colors.primary },
        ].map(function (item) {
          return (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '12px 0', borderBottom: '1px solid ' + colors.lineSoft }}>
              <span style={{ color: colors.textMuted }}>{item.label}</span>
              <strong style={{ color: item.tone, textAlign: 'right' }}>{item.value}</strong>
            </div>
          );
        })}
        <button type="button" onClick={(e) => { self.submitAll(e); }} disabled={_customState.submitting} style={{ width: '100%', height: '36px', marginTop: '14px', border: 0, borderRadius: '9px', background: colors.primary, color: '#FFFFFF', cursor: _customState.submitting ? 'not-allowed' : 'pointer', fontWeight: 900 }}>
          {_customState.submitting ? '提交中...' : '通过质检并提交'}
        </button>
      </aside>
      </div>

      {/* 提交结果 */}
      {_customState.submitResult && (
        <div style={{
          marginTop: '12px', padding: '12px 16px',
          background: _customState.submitResult.failed === 0 ? colors.successBg : colors.dangerBg,
          border: '1px solid ' + (_customState.submitResult.failed === 0 ? colors.successLine : colors.dangerLine),
          borderRadius: '10px', fontSize: '14px',
        }}>
          提交完成：
          <span style={{ color: colors.success, fontWeight: 700 }}>
            {_customState.submitResult.success} 条成功
          </span>
          {_customState.submitResult.failed > 0 && (
            <span style={{ color: colors.danger, fontWeight: 700, marginLeft: '8px' }}>
              {_customState.submitResult.failed} 条失败（请修正红色行后重新提交）
            </span>
          )}
        </div>
      )}

      {/* 草稿提示 */}
      <div style={{ marginTop: '8px', fontSize: '12px', color: colors.textSubtle, textAlign: 'right' }}>
        数据已自动保存为草稿，刷新页面后可继续编辑
      </div>
    </div>
  );
}
