'use strict';

const { isDeepStrictEqual } = require('util');

const REPORT_DOMAIN_CODE = 'tEXDRG';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeReportConfig(config) {
  if (typeof config !== 'string') {
    return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  }
  try {
    const parsed = JSON.parse(config);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (cause) {
    const error = new Error('REPORT_SCHEMA_CONFIG_INVALID');
    error.code = 'REPORT_SCHEMA_CONFIG_INVALID';
    error.cause = cause;
    throw error;
  }
}

function normalizeReportSchemaContent(value) {
  let schema = value && Object.prototype.hasOwnProperty.call(value, 'content')
    ? value.content
    : value;
  if (typeof schema === 'string') {
    try {
      schema = JSON.parse(schema);
    } catch (cause) {
      const error = new Error('REPORT_SCHEMA_CONTENT_INVALID');
      error.code = 'REPORT_SCHEMA_CONTENT_INVALID';
      error.cause = cause;
      throw error;
    }
  }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    const error = new Error('REPORT_SCHEMA_CONTENT_INVALID');
    error.code = 'REPORT_SCHEMA_CONTENT_INVALID';
    throw error;
  }
  return schema;
}

function visitComponentNodes(node, callback) {
  if (!node || typeof node !== 'object') {
    return;
  }
  callback(node);
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => visitComponentNodes(child, callback));
  }
}

function collectReportI18nKeys(schema) {
  const keys = [];
  const seen = new Set();
  const pages = schema && Array.isArray(schema.pages) ? schema.pages : [];

  pages.forEach((page) => {
    const trees = page && Array.isArray(page.componentsTree) ? page.componentsTree : [];
    trees.forEach((tree) => visitComponentNodes(tree, (node) => {
      const key = node && node.data && node.data.key;
      if (typeof key !== 'string' || key.length === 0 || key.startsWith('i18n') || seen.has(key)) {
        return;
      }
      seen.add(key);
      keys.push(key);
    }));
  });

  return keys;
}

function prepareReportSchemaForSave(schema, options = {}) {
  const prepared = cloneJson(normalizeReportSchemaContent(schema));
  delete prepared.i18nData;
  prepared.config = normalizeReportConfig(prepared.config);

  const i18nKeys = collectReportI18nKeys(prepared);
  if (i18nKeys.length > 0) {
    prepared.config.i18nKeyList = i18nKeys;
  } else {
    delete prepared.config.i18nKeyList;
  }

  if (options.serverRevision !== undefined) {
    prepared.gmtModified = options.serverRevision;
  }
  return prepared;
}

const OMITTED = Symbol('REPORT_SCHEMA_OMITTED');
const DESIGNER_ONLY_KEYS = new Set(['lifeCycles', 'css', 'utils']);

function canonicalizeReportValue(value) {
  if (value === null || value === undefined) {
    return OMITTED;
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => canonicalizeReportValue(item))
      .filter((item) => item !== OMITTED);
    return items.length > 0 ? items : OMITTED;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const result = {};
  Object.keys(value).sort().forEach((key) => {
    if (DESIGNER_ONLY_KEYS.has(key)) {
      return;
    }
    const canonical = canonicalizeReportValue(value[key]);
    if (canonical !== OMITTED) {
      result[key] = canonical;
    }
  });
  return Object.keys(result).length > 0 ? result : OMITTED;
}

function projectReportSchema(schema) {
  const projected = cloneJson(normalizeReportSchemaContent(schema));
  projected.config = normalizeReportConfig(projected.config);
  delete projected.gmtModified;
  delete projected.id;
  delete projected.i18nData;
  delete projected.status;
  const canonical = canonicalizeReportValue(projected);
  return canonical === OMITTED ? {} : canonical;
}

function assertReportSchemaReadback(expected, actual) {
  const expectedProjection = projectReportSchema(expected);
  const actualProjection = projectReportSchema(actual);
  if (isDeepStrictEqual(expectedProjection, actualProjection)) {
    return actualProjection;
  }

  const error = new Error('REPORT_SCHEMA_READBACK_MISMATCH');
  error.name = 'ReportSchemaReadbackError';
  error.code = 'REPORT_SCHEMA_READBACK_MISMATCH';
  throw error;
}

module.exports = {
  REPORT_DOMAIN_CODE,
  assertReportSchemaReadback,
  collectReportI18nKeys,
  normalizeReportSchemaContent,
  normalizeReportConfig,
  prepareReportSchemaForSave,
  projectReportSchema,
};
