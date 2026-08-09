'use strict';

const Babel = require('@babel/standalone');
const { normalizeSchemaFields } = require('./schema-field-resolution');

const parser = Babel.packages.parser;
const PARSER_OPTIONS = {
  sourceType: 'module',
  plugins: ['jsx', 'typescript', 'objectRestSpread', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
};

function unwrapExpression(node) {
  let current = node;
  while (current && ['TSAsExpression', 'TSTypeAssertion', 'TypeCastExpression'].includes(current.type)) {
    current = current.expression;
  }
  return current;
}

function propertyName(property) {
  const key = property && property.key;
  if (!key) {return '';}
  if (key.type === 'Identifier') {return key.name;}
  if (key.type === 'StringLiteral') {return key.value;}
  return '';
}

function readStaticValue(node) {
  const valueNode = unwrapExpression(node);
  if (!valueNode) {return { ok: false };}
  if (valueNode.type === 'StringLiteral') {return { ok: true, value: valueNode.value };}
  if (valueNode.type === 'NumericLiteral' || valueNode.type === 'BooleanLiteral') {
    return { ok: true, value: valueNode.value };
  }
  if (valueNode.type === 'ObjectExpression') {
    const value = {};
    for (const property of valueNode.properties) {
      if (!property || property.type !== 'ObjectProperty' || property.computed) {return { ok: false };}
      const name = propertyName(property);
      const child = readStaticValue(property.value);
      if (!name || !child.ok) {return { ok: false };}
      value[name] = child.value;
    }
    return { ok: true, value };
  }
  return { ok: false };
}

function extractCanvasBindingContract(sourceCode) {
  let ast;
  try {
    ast = parser.parse(String(sourceCode || ''), PARSER_OPTIONS);
  } catch (error) {
    return { present: false, parseError: error.message };
  }
  const declarations = {};
  ast.program.body.forEach(function (statement) {
    if (!statement || statement.type !== 'VariableDeclaration') {return;}
    statement.declarations.forEach(function (declaration) {
      const name = declaration && declaration.id && declaration.id.type === 'Identifier' ? declaration.id.name : '';
      if (!['APP_TYPE', 'FORM_UUIDS', 'FIELDS'].includes(name)) {return;}
      declarations[name] = readStaticValue(declaration.init);
    });
  });
  const present = Boolean(declarations.FORM_UUIDS || declarations.FIELDS);
  const dynamic = Object.keys(declarations).filter(function (name) {return !declarations[name].ok;});
  const missing = present
    ? ['APP_TYPE', 'FORM_UUIDS', 'FIELDS'].filter(function (name) {return !declarations[name];})
    : [];
  return {
    present,
    dynamic,
    missing,
    appType: declarations.APP_TYPE && declarations.APP_TYPE.ok ? String(declarations.APP_TYPE.value || '') : '',
    formUuids: declarations.FORM_UUIDS && declarations.FORM_UUIDS.ok ? declarations.FORM_UUIDS.value : {},
    fields: declarations.FIELDS && declarations.FIELDS.ok ? declarations.FIELDS.value : {},
  };
}

function levenshtein(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  const row = Array.from({ length: b.length + 1 }, function (_, index) {return index;});
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function nearestCandidates(value, candidates, limit) {
  return (candidates || [])
    .map(function (candidate) {
      return Object.assign({}, candidate, { distance: levenshtein(value, candidate.id) });
    })
    .sort(function (left, right) {return left.distance - right.distance;})
    .slice(0, limit || 3);
}

function normalizeFieldsByForm(formUuids, fields) {
  const formKeys = Object.keys(formUuids || {});
  const fieldKeys = Object.keys(fields || {});
  const nested = fieldKeys.length > 0 && fieldKeys.every(function (key) {
    const value = fields[key];
    return value && typeof value === 'object' && !Array.isArray(value) &&
      !Object.prototype.hasOwnProperty.call(value, 'fieldId') &&
      !Object.prototype.hasOwnProperty.call(value, 'id') &&
      !Object.prototype.hasOwnProperty.call(value, 'value');
  });
  if (nested) {return { fieldsByForm: fields, ambiguous: false };}
  if (formKeys.length === 1) {return { fieldsByForm: { [formKeys[0]]: fields || {} }, ambiguous: false };}
  return { fieldsByForm: {}, ambiguous: fieldKeys.length > 0 };
}

function normalizeFieldId(value) {
  if (typeof value === 'string') {return value;}
  if (value && typeof value === 'object') {return String(value.fieldId || value.id || value.value || '');}
  return '';
}

function validateCanvasBindingContract(contract, context) {
  if (!contract || !contract.present) {return { valid: true, skipped: true, reason: 'no_binding_contract' };}
  const appType = String(context && context.appType || '');
  const forms = Array.isArray(context && context.forms) ? context.forms : [];
  const schemasByFormUuid = context && context.schemasByFormUuid || {};
  const errors = [];
  const verified = { forms: [], fields: [] };

  if (contract.dynamic.length > 0) {
    errors.push({ code: 'CANVAS_BINDING_DYNAMIC', names: contract.dynamic });
  }
  if (contract.missing.length > 0) {
    errors.push({ code: 'CANVAS_BINDING_DECLARATION_MISSING', names: contract.missing });
  }
  if (!contract.appType) {
    errors.push({ code: 'CANVAS_BINDING_APP_TYPE_EMPTY' });
  } else if (contract.appType !== appType) {
    errors.push({ code: 'CANVAS_BINDING_APP_TYPE_MISMATCH', expected: appType, actual: contract.appType });
  }

  const actualForms = new Map(forms.filter(Boolean).map(function (form) {return [String(form.formUuid || ''), form];}));
  const formCandidates = forms.filter(Boolean).map(function (form) {
    return { id: String(form.formUuid || ''), label: form.formName || form.title || '' };
  }).filter(function (form) {return form.id;});
  const formUuids = contract.formUuids && typeof contract.formUuids === 'object' ? contract.formUuids : {};
  if (Object.keys(formUuids).length === 0) {
    errors.push({ code: 'CANVAS_BINDING_FORM_UUIDS_EMPTY' });
  }
  Object.keys(formUuids).forEach(function (formKey) {
    const formUuid = String(formUuids[formKey] || '');
    if (!formUuid) {
      errors.push({ code: 'CANVAS_BINDING_FORM_UUID_EMPTY', formKey });
    } else if (!actualForms.has(formUuid)) {
      errors.push({
        code: 'CANVAS_BINDING_FORM_UUID_NOT_FOUND',
        formKey,
        formUuid,
        candidates: nearestCandidates(formUuid, formCandidates),
      });
    } else {
      verified.forms.push({ formKey, formUuid, formName: actualForms.get(formUuid).formName || '' });
    }
  });

  const normalized = normalizeFieldsByForm(formUuids, contract.fields);
  if (normalized.ambiguous) {
    errors.push({ code: 'CANVAS_BINDING_FIELDS_FORM_AMBIGUOUS', formKeys: Object.keys(formUuids) });
  }
  Object.keys(normalized.fieldsByForm).forEach(function (formKey) {
    const formUuid = String(formUuids[formKey] || '');
    if (!formUuid) {
      errors.push({ code: 'CANVAS_BINDING_FIELDS_FORM_KEY_UNKNOWN', formKey });
      return;
    }
    const schema = schemasByFormUuid[formUuid];
    if (!schema) {return;}
    const fields = normalizeSchemaFields({ content: schema });
    const actualFields = new Map(fields.filter(function (field) {return field.fieldId;}).map(function (field) {
      return [field.fieldId, field];
    }));
    const fieldCandidates = fields.filter(function (field) {return field.fieldId;}).map(function (field) {
      return { id: field.fieldId, label: field.labelPath || field.label || '', componentType: field.componentType || '' };
    });
    Object.keys(normalized.fieldsByForm[formKey] || {}).forEach(function (fieldKey) {
      const fieldId = normalizeFieldId(normalized.fieldsByForm[formKey][fieldKey]);
      const actual = actualFields.get(fieldId);
      if (!fieldId) {
        errors.push({ code: 'CANVAS_BINDING_FIELD_ID_EMPTY', formKey, fieldKey, formUuid });
      } else if (!actual) {
        errors.push({
          code: 'CANVAS_BINDING_FIELD_ID_NOT_FOUND',
          formKey,
          fieldKey,
          formUuid,
          fieldId,
          candidates: nearestCandidates(fieldId, fieldCandidates),
        });
      } else {
        verified.fields.push({
          formKey,
          fieldKey,
          formUuid,
          fieldId,
          label: actual.labelPath || actual.label || '',
          componentType: actual.componentType || '',
        });
      }
    });
  });

  return { valid: errors.length === 0, errors, verified };
}

module.exports = {
  extractCanvasBindingContract,
  validateCanvasBindingContract,
  _private: { levenshtein, nearestCandidates, normalizeFieldsByForm, readStaticValue },
};
