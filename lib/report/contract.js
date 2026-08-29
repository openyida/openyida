'use strict';

const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');

const REPORT_DOMAIN_CODE = 'tEXDRG';
const PLATFORM_OMITTED_DEFAULT_PAGE_CSS = 'body {\n  background-color: #f2f3f5;\n}\n';
const PLATFORM_OMITTED_NULL_LIFECYCLE_KEYS = new Set([
  'componentDidMount',
  'componentWillUnmount',
]);
const PLATFORM_OMITTED_YOUSHU_NULL_DEFAULT_KEYS = new Set([
  'barBackground',
  'drilldownFilterList',
  'height',
  'idField',
  'isLeaf',
  'max',
  'maxSize',
  'min',
  'minSize',
  'pidField',
  'size',
  'timeGranularityType',
  'value',
]);

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

function stripClientOnlyReportMetadata(value) {
  if (Array.isArray(value)) {
    value.forEach((item) => stripClientOnlyReportMetadata(item));
    return value;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value.componentsTree)) {
    if (Array.isArray(value.utils) && value.utils.length === 0) {delete value.utils;}
    if (value.css === PLATFORM_OMITTED_DEFAULT_PAGE_CSS) {delete value.css;}
  }
  delete value.__filterMeta__;
  Object.values(value).forEach((child) => stripClientOnlyReportMetadata(child));
  return value;
}

function stripPlatformOmittedChartDefaults(value, insideYoushuComponent = false) {
  if (Array.isArray(value)) {
    value.forEach((item) => stripPlatformOmittedChartDefaults(item, insideYoushuComponent));
    return value;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const insideYoushu = insideYoushuComponent || (
    typeof value.componentName === 'string' && value.componentName.startsWith('Youshu')
  );
  PLATFORM_OMITTED_NULL_LIFECYCLE_KEYS.forEach((key) => {
    if (value[key] === null) {delete value[key];}
  });
  if (insideYoushu) {
    PLATFORM_OMITTED_YOUSHU_NULL_DEFAULT_KEYS.forEach((key) => {
      if (value[key] === null) {delete value[key];}
    });
  }

  if (
    typeof value.componentName === 'string'
    && value.componentName.startsWith('Youshu')
    && value.props
    && typeof value.props === 'object'
  ) {
    if (value.props.height === null) {
      delete value.props.height;
    }
    const exportData = value.props.exportData;
    if (exportData && typeof exportData === 'object') {
      if (exportData.filterList === null) {
        delete exportData.filterList;
      }
      if (exportData.exportPromptFilter === null) {
        delete exportData.exportPromptFilter;
      }
    }
  }

  Object.values(value).forEach((child) => stripPlatformOmittedChartDefaults(child, insideYoushu));
  return value;
}

function prepareReportSchemaForSave(schema, options = {}) {
  const prepared = cloneJson(normalizeReportSchemaContent(schema));
  stripClientOnlyReportMetadata(prepared);
  stripPlatformOmittedChartDefaults(prepared);
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

const REPORT_READBACK_OMITTED = Object.freeze([
  Object.freeze({ path: '$.gmtModified', reason: 'server-owned revision' }),
  Object.freeze({ path: '$.id', reason: 'server-owned resource identity returned out-of-band' }),
  Object.freeze({ path: '$.i18nData', reason: 'server-owned localization materialization' }),
  Object.freeze({ path: '$.status', reason: 'server-owned publication status' }),
]);

const SAFE_MISMATCH_PATH_KEYS = new Set([
  'aggregateType', 'children', 'componentName', 'componentsMap', 'componentsTree',
  'config', 'css', 'data', 'dataSetModelMap', 'fieldCode', 'fieldId', 'filterKey',
  'gmtModified', 'h', 'i', 'id', 'i18nData', 'layout', 'lifeCycles', 'pages',
  'props', 'settings', 'status', 'utils', 'w', 'x', 'y',
]);

function canonicalizeReportValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeReportValue(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const result = {};
  Object.keys(value).sort().forEach((key) => {
    result[key] = canonicalizeReportValue(value[key]);
  });
  return result;
}

function projectReportSchema(schema) {
  const projected = cloneJson(normalizeReportSchemaContent(schema));
  projected.config = normalizeReportConfig(projected.config);
  delete projected.gmtModified;
  delete projected.id;
  delete projected.i18nData;
  delete projected.status;
  return canonicalizeReportValue(projected);
}

function valueKind(value) {
  if (value === undefined) {return 'undefined';}
  if (value === null) {return 'null';}
  if (Array.isArray(value)) {return 'array';}
  return typeof value;
}

function fingerprintReportValue(value) {
  const serialized = JSON.stringify({
    kind: valueKind(value),
    value: value === undefined ? null : canonicalizeReportValue(value),
  });
  return `sha256:${crypto.createHash('sha256').update(serialized).digest('hex')}`;
}

function safeMismatchPath(path, key) {
  if (SAFE_MISMATCH_PATH_KEYS.has(key)) {
    return `${path}.${key}`;
  }
  const fingerprint = crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 12);
  return `${path}.[key:sha256:${fingerprint}]`;
}

function buildMismatch(path, kind, expected, actual) {
  return {
    path,
    kind,
    expectedFingerprint: fingerprintReportValue(expected),
    actualFingerprint: fingerprintReportValue(actual),
  };
}

function findReportSchemaMismatch(expected, actual, path = '$') {
  const expectedKind = valueKind(expected);
  const actualKind = valueKind(actual);
  if (expectedKind !== actualKind) {
    return buildMismatch(path, 'type_mismatch', expected, actual);
  }

  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) {
      return buildMismatch(path, 'array_length_mismatch', expected, actual);
    }
    for (let index = 0; index < expected.length; index += 1) {
      const mismatch = findReportSchemaMismatch(expected[index], actual[index], `${path}[${index}]`);
      if (mismatch) {return mismatch;}
    }
    return null;
  }

  if (expected && typeof expected === 'object') {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      const childPath = safeMismatchPath(path, key);
      const hasExpected = Object.prototype.hasOwnProperty.call(expected, key);
      const hasActual = Object.prototype.hasOwnProperty.call(actual, key);
      if (!hasExpected) {
        return buildMismatch(childPath, 'unexpected_key', undefined, actual[key]);
      }
      if (!hasActual) {
        return buildMismatch(childPath, 'missing_key', expected[key], undefined);
      }
      const mismatch = findReportSchemaMismatch(expected[key], actual[key], childPath);
      if (mismatch) {return mismatch;}
    }
    return null;
  }

  return Object.is(expected, actual) ? null : buildMismatch(path, 'value_mismatch', expected, actual);
}

function createReadbackMismatchError(mismatch) {
  const error = new Error('REPORT_SCHEMA_READBACK_MISMATCH');
  error.name = 'ReportSchemaReadbackError';
  error.code = 'REPORT_SCHEMA_READBACK_MISMATCH';
  error.details = {
    verificationLevel: 'strict-schema-content',
    omitted: REPORT_READBACK_OMITTED.map(entry => ({ ...entry })),
    mismatch,
  };
  return error;
}

function assertReportSchemaReadback(expected, actual) {
  const expectedSchema = normalizeReportSchemaContent(expected);
  const actualSchema = normalizeReportSchemaContent(actual);
  if (
    Object.prototype.hasOwnProperty.call(expectedSchema, 'id')
    && Object.prototype.hasOwnProperty.call(actualSchema, 'id')
    && !isDeepStrictEqual(expectedSchema.id, actualSchema.id)
  ) {
    throw createReadbackMismatchError(buildMismatch(
      '$.id',
      valueKind(expectedSchema.id) === valueKind(actualSchema.id) ? 'value_mismatch' : 'type_mismatch',
      expectedSchema.id,
      actualSchema.id
    ));
  }
  const expectedProjection = projectReportSchema(expected);
  const actualProjection = projectReportSchema(actual);
  if (isDeepStrictEqual(expectedProjection, actualProjection)) {
    return {
      verificationLevel: 'strict-schema-content',
      omitted: REPORT_READBACK_OMITTED.map(entry => ({ ...entry })),
      projection: actualProjection,
    };
  }

  throw createReadbackMismatchError(findReportSchemaMismatch(expectedProjection, actualProjection));
}

module.exports = {
  REPORT_DOMAIN_CODE,
  REPORT_READBACK_OMITTED,
  assertReportSchemaReadback,
  collectReportI18nKeys,
  findReportSchemaMismatch,
  normalizeReportSchemaContent,
  normalizeReportConfig,
  prepareReportSchemaForSave,
  projectReportSchema,
};
