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

// Mirrors the fixed designer defaults read from configLimit. Tenant-dynamic
// overrides remain a platform-probe concern rather than a CLI configuration system.
const DEFAULT_LIMITS = Object.freeze({
  relationForms: 10,
  relationships: 10,
  formulaFields: 10,
  auxFields: 10,
  filters: 10,
});

function addError(errors, code, path) {
  errors.push({ code, path });
}

function isNonEmptyValue(value) {
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function isNonEmptyText(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim().length > 0;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return ['zh_CN', 'en_US', 'pureEn_US', 'value']
    .some((key) => isNonEmptyText(value[key]));
}

function findDuplicateValues(items, getValue) {
  const seen = new Set();
  const duplicates = new Set();
  items.forEach((item) => {
    const value = getValue(item);
    if (!isNonEmptyValue(value)) { return; }
    const normalized = String(value);
    if (seen.has(normalized)) {
      duplicates.add(normalized);
    }
    seen.add(normalized);
  });
  return duplicates;
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

      const filter = item && item.filter;
      if (filter === undefined || filter === null) { return; }
      if (typeof filter !== 'object' || Array.isArray(filter)) {
        addError(errors, 'AGGREGATE_FILTER_INVALID', `relationForms[${index}].filter`);
        return;
      }
      if (filter.rules === undefined || filter.rules === null) { return; }
      if (!Array.isArray(filter.rules)) {
        addError(errors, 'AGGREGATE_FILTER_RULES_ARRAY_REQUIRED', `relationForms[${index}].filter.rules`);
        return;
      }
      if (filter.rules.length > DEFAULT_LIMITS.filters) {
        addError(errors, 'AGGREGATE_FILTER_LIMIT', `relationForms[${index}].filter.rules`);
      }
      filter.rules.forEach((rule, ruleIndex) => {
        if (!rule || !isNonEmptyValue(rule.operator)) {
          addError(
            errors,
            'AGGREGATE_FILTER_OPERATOR_REQUIRED',
            `relationForms[${index}].filter.rules[${ruleIndex}].operator`
          );
        }
      });
    });

    if (findDuplicateValues(config.relationForms, (item) => item && item.formUuid).size > 0) {
      addError(errors, 'AGGREGATE_RELATION_FORM_DUPLICATE', 'relationForms');
    }
  }

  if (Array.isArray(config.relationships)) {
    config.relationships.forEach((item, index) => {
      const relationshipInfos = item && item.relationshipInfos;
      if (!item || !isNonEmptyValue(item.relationId) ||
          !Array.isArray(relationshipInfos) || relationshipInfos.length === 0 ||
          relationshipInfos.some((entry) => entry === null || entry === undefined)) {
        addError(errors, 'AGGREGATE_RELATIONSHIP_INVALID', `relationships[${index}]`);
      }
      if (Array.isArray(relationshipInfos) && Array.isArray(config.relationForms) &&
          relationshipInfos.length !== config.relationForms.length) {
        addError(
          errors,
          'AGGREGATE_RELATIONSHIP_SOURCE_COUNT_MISMATCH',
          `relationships[${index}].relationshipInfos`
        );
      }
    });

    if (findDuplicateValues(config.relationships, (item) => item && item.relationId).size > 0) {
      addError(errors, 'AGGREGATE_RELATIONSHIP_ID_DUPLICATE', 'relationships');
    }
  }

  if (Array.isArray(config.aggregatedFields)) {
    config.aggregatedFields.forEach((item, index) => {
      if (!item || !isNonEmptyValue(item.id) || !isNonEmptyText(item.name)) {
        addError(errors, 'AGGREGATE_COLUMN_INVALID', `aggregatedFields[${index}]`);
      }
    });
    if (findDuplicateValues(config.aggregatedFields, (item) => item && item.id).size > 0) {
      addError(errors, 'AGGREGATE_COLUMN_ID_DUPLICATE', 'aggregatedFields');
    }
  }

  if (Array.isArray(config.auxFields)) {
    config.auxFields.forEach((item, index) => {
      if (!item || !isNonEmptyValue(item.id) || !isNonEmptyText(item.name)) {
        addError(errors, 'AGGREGATE_AUX_FIELD_INVALID', `auxFields[${index}]`);
      }
    });
    if (findDuplicateValues(config.auxFields, (item) => item && item.id).size > 0) {
      addError(errors, 'AGGREGATE_AUX_FIELD_ID_DUPLICATE', 'auxFields');
    }
  }

  if (Array.isArray(config.formulaFields)) {
    config.formulaFields.forEach((item, index) => {
      if (!item || !isNonEmptyValue(item.id) || !isNonEmptyText(item.name) ||
          !isNonEmptyText(item.formula)) {
        addError(errors, 'AGGREGATE_FORMULA_FIELD_INVALID', `formulaFields[${index}]`);
      }
    });
    if (findDuplicateValues(config.formulaFields, (item) => item && item.id).size > 0) {
      addError(errors, 'AGGREGATE_FORMULA_FIELD_ID_DUPLICATE', 'formulaFields');
    }
  }

  if (Array.isArray(config.validators)) {
    config.validators.forEach((item, index) => {
      if (!item || !isNonEmptyText(item.formula) || !item.text ||
          typeof item.text !== 'object' || Array.isArray(item.text) ||
          !isNonEmptyText(item.text.zh_CN)) {
        addError(errors, 'AGGREGATE_VALIDATOR_INVALID', `validators[${index}]`);
      }
    });
  }
}

function validateCrossArrayMappings(config, mode, errors) {
  if (!Array.isArray(config.relationships) || !Array.isArray(config.aggregatedFields)) {
    return;
  }

  const relationshipIds = new Set(config.relationships
    .map((item) => item && item.relationId)
    .filter(isNonEmptyValue)
    .map(String));
  const aggregatedIds = new Set(config.aggregatedFields
    .map((item) => item && item.id)
    .filter(isNonEmptyValue)
    .map(String));

  config.aggregatedFields.forEach((item, index) => {
    if (item && isNonEmptyValue(item.id) && !relationshipIds.has(String(item.id))) {
      addError(errors, 'AGGREGATE_COLUMN_RELATION_MISMATCH', `aggregatedFields[${index}].id`);
    }
  });

  if (mode === 'publish') {
    config.relationships.forEach((item, index) => {
      if (item && isNonEmptyValue(item.relationId) && !aggregatedIds.has(String(item.relationId))) {
        addError(errors, 'AGGREGATE_RELATION_COLUMN_MISSING', `relationships[${index}].relationId`);
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
  validateCrossArrayMappings(safeConfig, mode, errors);
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
  const malformedKey = DESIGN_KEYS.find((key) => !Array.isArray(expected && expected[key]) ||
    !Array.isArray(actual && actual[key]));
  if (malformedKey) {
    const error = new Error('AGGREGATE_DESIGN_READBACK_MISMATCH');
    error.name = 'AggregateDesignReadbackError';
    error.code = 'AGGREGATE_DESIGN_READBACK_MISMATCH';
    error.path = malformedKey;
    throw error;
  }

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
