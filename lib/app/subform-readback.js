'use strict';

// Kept in sync with the standalone Canvas sample; no network or guessed clears.
function readCanvasSubformRows(row, fieldId) {
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const failure = code => ({ status: 'error', rows: [], error: { code, fieldId } });
  if (!object(row) || typeof fieldId !== 'string' || !fieldId.trim()) {return failure('DATA_SUBFORM_INVALID');}
  const data = own(row, 'formData') ? row.formData : row;
  if (!object(data)) {return failure('DATA_SUBFORM_INVALID');}
  if (!own(data, fieldId)) {return failure('DATA_SUBFORM_UNAVAILABLE');}
  let rows = data[fieldId];
  for (let depth = 0; depth < 2 && typeof rows === 'string' && rows !== ''; depth++) {
    try { rows = JSON.parse(rows); } catch { return failure('DATA_SUBFORM_INVALID'); }
  }
  if (rows === null || rows === '') {rows = [];}
  if (!Array.isArray(rows) || !rows.every(object)) {return failure('DATA_SUBFORM_INVALID');}
  if (!rows.length) {return { status: 'empty', rows: [], error: null };}
  let entries = row.instValue;
  if (entries !== undefined && entries !== null && entries !== '') {
    if (typeof entries === 'string') {
      try { entries = JSON.parse(entries); } catch { return failure('DATA_SUBFORM_INVALID'); }
    }
    if (!Array.isArray(entries)) {return failure('DATA_SUBFORM_INVALID');}
    const matches = entries.filter(entry => object(entry) && entry.fieldId === fieldId);
    if (matches.length > 1) {return failure('DATA_SUBFORM_INVALID');}
    if (matches.length) {
      const table = matches[0];
      if (table.componentName !== 'TableField' || !object(table.fieldData)
        || !Array.isArray(table.fieldData.value) || table.fieldData.value.length !== rows.length) {
        return failure('DATA_SUBFORM_INVALID');
      }
      const rawRows = table.fieldData.value;
      const rowIds = new Set();
      for (let index = 0; index < rows.length; index++) {
        const cells = rawRows[index];
        if (!Array.isArray(cells) || !cells.every(object)) {return failure('DATA_SUBFORM_INVALID');}
        const ids = [...new Set(cells.map(cell => cell.rowId).filter(id => typeof id === 'string' && id))];
        if (ids.length > 1 || own(rows[index], 'rowId') && (ids.length !== 1 || rows[index].rowId !== ids[0])) {
          return failure('DATA_SUBFORM_INVALID');
        }
        if (ids.length && rowIds.has(ids[0])) {return failure('DATA_SUBFORM_INVALID');}
        if (ids.length) {rowIds.add(ids[0]);}
        for (const cell of cells) {
          if (['TextField', 'TextareaField'].includes(cell.componentName) && own(rows[index], cell.fieldId)
            && typeof rows[index][cell.fieldId] === 'string' && typeof cell.fieldData?.value === 'string'
            && rows[index][cell.fieldId] !== cell.fieldData.value) {return failure('DATA_SUBFORM_INVALID');}
        }
      }
      // Same-response ordered rows, equal counts and compatible row IDs only.
      // Keep original fields/projections authoritative; the association reader
      // consults these raw cells only when both are absent.
      rows = rows.map((item, index) => ({ ...item,
        instValue: own(item, 'instValue') ? item.instValue : rawRows[index] }));
    }
  }
  return { status: 'ready', rows, error: null };
}

module.exports = { readCanvasSubformRows };
