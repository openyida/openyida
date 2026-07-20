'use strict';

// Subtable child fields are stored flat in the schema (get-schema / save never
// emit a "tableField_xxx.xxx" form), and Yida formulas reference them by their
// plain fieldId. A "tableField_xxx." prefix inside #{...} is therefore always
// an invalid reference that the web platform cannot resolve.
const SUBTABLE_FIELD_PREFIX_PATTERN = /^tableField_[A-Za-z0-9]+\./;

function normalizeSubtableFieldId(fieldId) {
  const value = String(fieldId || '');
  if (!SUBTABLE_FIELD_PREFIX_PATTERN.test(value)) {
    return { value, changed: false };
  }
  return {
    value: value.replace(SUBTABLE_FIELD_PREFIX_PATTERN, ''),
    changed: true,
  };
}

// Rewrite every `#{tableField_xxx.field}` reference inside a string to the
// canonical `#{field}` form. Returns the corrected string plus how many refs
// were fixed. Only the exact `#{tableField_<alnum>.<rest>}` shape is touched,
// so unrelated text (e.g. a JS regex like `#{1,3}`) is left untouched.
function stripSubtableFieldPrefix(str) {
  if (typeof str !== 'string' || str.indexOf('#{') === -1) {
    return { value: str, count: 0 };
  }

  let count = 0;
  const value = str.replace(/#\{([^}]*)\}/g, (whole, inner) => {
    const trimmed = inner.trim();
    const normalized = normalizeSubtableFieldId(trimmed);
    if (normalized.changed) {
      count += 1;
      return `#{${normalized.value}}`;
    }
    return whole;
  });

  return { value, count };
}

// Recursively walk any schema node (object/array) and normalize subtable
// prefixes in every string value in place. Returns the total number of refs
// fixed. Covers formula, complexValue.formula, expression, linkage, and any
// other string-valued property uniformly.
function normalizeFormulaFieldRefs(node) {
  let total = 0;

  function visit(parent, key) {
    const current = parent[key];
    if (typeof current === 'string') {
      const { value, count } = stripSubtableFieldPrefix(current);
      if (count > 0) {
        parent[key] = value;
        total += count;
      }
      return;
    }
    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        visit(current, i);
      }
      return;
    }
    if (current && typeof current === 'object') {
      for (const childKey of Object.keys(current)) {
        visit(current, childKey);
      }
    }
  }

  if (node && typeof node === 'object') {
    visit({ root: node }, 'root');
  }
  return total;
}

module.exports = {
  normalizeFormulaFieldRefs,
  normalizeSubtableFieldId,
  stripSubtableFieldPrefix,
};
