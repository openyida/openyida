'use strict';

const { isDeepStrictEqual } = require('util');

const DESIGN_KEYS = [
  'relationForms',
  'relationships',
  'aggregatedFields',
  'auxFields',
  'formulaFields',
  'validators',
];

// Mirrors the designer defaults read from configLimit. Only limits that map to
// persisted design arrays are enforced here.
const DEFAULT_LIMITS = Object.freeze({
  relationForms: 10,
  relationships: 10,
  formulaFields: 10,
  auxFields: 10,
});

function addError(errors, code, path) {
  errors.push({ code, path });
}

function isNonEmptyValue(value) {
  return value !== null && value !== undefined && String(value).length > 0;
}

function validateArrayShapes(config, errors) {
  for (const key of DESIGN_KEYS) {
    if (!Array.isArray(config && config[key])) {
      addError(errors, 'AGGREGATE_DESIGN_ARRAY_REQUIRED', key);
    }
  }
}

function validateLimits(config, limits, errors) {
  const limitCodes = {
    relationForms: 'AGGREGATE_RELATION_FORMS_LIMIT',
    relationships: 'AGGREGATE_RELATIONSHIPS_LIMIT',
    formulaFields: 'AGGREGATE_FORMULA_FIELDS_LIMIT',
    auxFields: 'AGGREGATE_AUX_FIELDS_LIMIT',
  };

  for (const [key, limit] of Object.entries(limits)) {
    if (Array.isArray(config[key]) && config[key].length > limit) {
      addError(errors, limitCodes[key] || 'AGGREGATE_DESIGN_LIMIT', key);
    }
  }
}

function validateEntries(config, errors) {
  if (Array.isArray(config.relationForms)) {
    config.relationForms.forEach((item, index) => {
      if (!item || !isNonEmptyValue(item.formUuid)) {
        addError(errors, 'AGGREGATE_RELATION_FORM_INVALID', `relationForms[${index}]`);
      }
    });
  }

  if (Array.isArray(config.relationships)) {
    config.relationships.forEach((item, index) => {
      const relationshipInfos = item && item.relationshipInfos;
      if (!Array.isArray(relationshipInfos) || relationshipInfos.length === 0 ||
          relationshipInfos.some((entry) => entry === null || entry === undefined)) {
        addError(errors, 'AGGREGATE_RELATIONSHIP_INVALID', `relationships[${index}]`);
      }
    });
  }

  if (Array.isArray(config.aggregatedFields)) {
    config.aggregatedFields.forEach((item, index) => {
      if (!item || !isNonEmptyValue(item.name)) {
        addError(errors, 'AGGREGATE_COLUMN_INVALID', `aggregatedFields[${index}]`);
      }
    });
  }

  if (Array.isArray(config.formulaFields)) {
    config.formulaFields.forEach((item, index) => {
      if (!item || !isNonEmptyValue(item.formula)) {
        addError(errors, 'AGGREGATE_FORMULA_FIELD_INVALID', `formulaFields[${index}]`);
      }
    });
  }

  if (Array.isArray(config.validators)) {
    config.validators.forEach((item, index) => {
      if (!item || !isNonEmptyValue(item.formula)) {
        addError(errors, 'AGGREGATE_VALIDATOR_INVALID', `validators[${index}]`);
      }
    });
  }
}

function validatePublishCompleteness(config, errors) {
  const required = [
    ['relationForms', 'AGGREGATE_RELATION_FORMS_REQUIRED'],
    ['relationships', 'AGGREGATE_RELATIONSHIPS_REQUIRED'],
    ['aggregatedFields', 'AGGREGATE_COLUMNS_REQUIRED'],
    ['formulaFields', 'AGGREGATE_FORMULA_FIELDS_REQUIRED'],
  ];

  for (const [key, code] of required) {
    if (!Array.isArray(config[key]) || config[key].length === 0) {
      addError(errors, code, key);
    }
  }
}

function validateAggregateDesignConfig(config, options = {}) {
  const mode = options.mode || 'draft';
  if (mode !== 'draft' && mode !== 'publish') {
    throw new Error(`Unsupported aggregate contract mode: ${mode}`);
  }

  const safeConfig = config && typeof config === 'object' && !Array.isArray(config)
    ? config
    : {};
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const errors = [];

  validateArrayShapes(safeConfig, errors);
  validateLimits(safeConfig, limits, errors);
  validateEntries(safeConfig, errors);
  if (mode === 'publish') {
    validatePublishCompleteness(safeConfig, errors);
  }

  return { valid: errors.length === 0, errors };
}

function assertAggregateDesignConfig(config, options = {}) {
  const result = validateAggregateDesignConfig(config, options);
  if (result.valid) {
    return config;
  }

  const error = new Error(result.errors.map((item) => item.code).join(', '));
  error.name = 'AggregateDesignContractError';
  error.code = 'AGGREGATE_DESIGN_CONTRACT_INVALID';
  error.details = result.errors;
  throw error;
}

function projectAggregateDesignConfig(config) {
  const safeConfig = config && typeof config === 'object' ? config : {};
  const projected = {};
  for (const key of DESIGN_KEYS) {
    projected[key] = Array.isArray(safeConfig[key]) ? safeConfig[key] : [];
  }
  return projected;
}

function isI18nValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && (
    value.type === 'i18n' ||
    Object.prototype.hasOwnProperty.call(value, 'zh_CN') ||
    Object.prototype.hasOwnProperty.call(value, 'en_US') ||
    Object.prototype.hasOwnProperty.call(value, 'pureEn_US')
  );
}

function canonicalizeI18nValue(value) {
  const zhCN = value.zh_CN || value.value || '';
  const enUS = value.en_US || value.pureEn_US || zhCN;
  return {
    type: value.type || 'i18n',
    zh_CN: String(zhCN),
    en_US: String(enUS),
  };
}

function isEmptyFilter(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const rules = value.rules;
  return (rules === undefined || rules === null || (Array.isArray(rules) && rules.length === 0)) &&
    !value.logicOperator;
}

function canonicalizeAggregateValue(value, key = '') {
  if (isI18nValue(value)) {
    return canonicalizeI18nValue(value);
  }
  if (key === 'filter' && isEmptyFilter(value)) {
    return {};
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeAggregateValue(item));
  }
  if (!value || typeof value !== 'object') {
    if (key === 'precision' && value !== undefined && value !== null && value !== '') {
      return String(value);
    }
    return value;
  }

  const result = {};
  for (const childKey of Object.keys(value)) {
    const childValue = value[childKey];
    if ((childKey === 'filterState' && (childValue === null || childValue === undefined)) ||
        (childKey === 'parentId' && (childValue === '' || childValue === null || childValue === undefined))) {
      continue;
    }
    result[childKey] = canonicalizeAggregateValue(childValue, childKey);
  }
  return result;
}

function assertAggregateDesignReadback(expected, actual) {
  const expectedProjection = canonicalizeAggregateValue(projectAggregateDesignConfig(expected));
  const actualProjection = canonicalizeAggregateValue(projectAggregateDesignConfig(actual));
  if (isDeepStrictEqual(expectedProjection, actualProjection)) {
    return actualProjection;
  }

  const error = new Error('AGGREGATE_DESIGN_READBACK_MISMATCH');
  error.name = 'AggregateDesignReadbackError';
  error.code = 'AGGREGATE_DESIGN_READBACK_MISMATCH';
  throw error;
}

module.exports = {
  DEFAULT_LIMITS,
  DESIGN_KEYS,
  assertAggregateDesignConfig,
  assertAggregateDesignReadback,
  projectAggregateDesignConfig,
  validateAggregateDesignConfig,
};
