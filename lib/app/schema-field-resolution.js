/**
 * 将 getFormSchema 的完整返回正规化为安全、确定性的字段解析契约。
 * 本模块无网络、文件或进程状态依赖，不承担跨调用缓存。
 */

'use strict';

const crypto = require('crypto');

const CONTRACT_KIND = 'yida_schema_field_resolution';
const CONTRACT_VERSION = 1;
const LABEL_LOCALES = [
  'zh_CN',
  'zh_HK',
  'en_US',
  'ja_JP',
  'ko_KR',
  'fr_FR',
  'de_DE',
  'es_ES',
  'pt_PT',
  'ar_SA',
  'hi_IN',
  'vi_VN',
];
const LOCALE_KEY_PATTERN = /^[a-z]{2}(?:[_-][A-Z]{2})?$/;

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (!['string', 'number', 'boolean'].includes(typeof value)) {
    return '';
  }
  return String(value).normalize('NFC').trim();
}

function collectLocalizedLabels(value, fallback) {
  const entries = [];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const knownLocales = LABEL_LOCALES.filter(locale => (
      Object.prototype.hasOwnProperty.call(value, locale)
    ));
    const extraLocales = Object.keys(value)
      .filter(locale => !LABEL_LOCALES.includes(locale) && LOCALE_KEY_PATTERN.test(locale))
      .sort();
    knownLocales.concat(extraLocales).forEach((locale) => {
      const label = normalizeText(value[locale]);
      if (label) {
        entries.push({ locale, label });
      }
    });
  } else {
    const label = normalizeText(value);
    if (label) {
      entries.push({ locale: null, label });
    }
  }

  if (entries.length === 0) {
    entries.push({ locale: null, label: normalizeText(fallback) });
  }
  return {
    label: entries[0].label,
    entries,
  };
}

function normalizeLabel(value, fallback) {
  return collectLocalizedLabels(value, fallback).label;
}

function normalizeValueType(value) {
  const normalized = typeof value === 'string' ? normalizeText(value) : '';
  return normalized || null;
}

function stableCopy(value) {
  if (Array.isArray(value)) {
    return value.map(stableCopy);
  }
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).sort().forEach((key) => {
      if (value[key] !== undefined) {
        result[key] = stableCopy(value[key]);
      }
    });
    return result;
  }
  return value;
}

function createSchemaHash(schemaResult) {
  let content = schemaResult && Object.prototype.hasOwnProperty.call(schemaResult, 'content')
    ? schemaResult.content
    : null;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch (error) {
      content = null;
    }
  }
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    content = stableCopy(content);
    delete content.gmtModified;
  }
  const serialized = JSON.stringify(stableCopy(content));
  const digest = crypto
    .createHash('sha256')
    .update(serialized === undefined ? 'null' : serialized)
    .digest('hex');
  return `sha256:${digest}`;
}

function buildAliasByFieldId(schemaResult) {
  const aliases = {};
  const pages = schemaResult && schemaResult.content && schemaResult.content.pages;
  if (!Array.isArray(pages)) {
    return aliases;
  }
  pages.forEach((page) => {
    const items = page && page.componentAlias && Array.isArray(page.componentAlias.items)
      ? page.componentAlias.items
      : [];
    items.forEach((item) => {
      const fieldId = item && item.fieldId ? normalizeText(item.fieldId) : '';
      const alias = item && item.alias ? normalizeText(item.alias) : '';
      if (fieldId && alias) {
        aliases[fieldId] = alias;
      }
    });
  });
  return aliases;
}

function buildLabelPathSelectors(tableAncestors, labelInfo) {
  const labelNodes = tableAncestors.map(item => item.labelInfo).concat(labelInfo);
  const selectors = [];
  const seen = new Set();

  function append(locale, labels) {
    const value = labels.join('/');
    if (!seen.has(value)) {
      seen.add(value);
      selectors.push({ locale, value });
    }
  }

  append(null, labelNodes.map(item => item.label));
  const discoveredLocales = new Set();
  labelNodes.forEach((item) => {
    item.entries.forEach((entry) => {
      if (entry.locale) {
        discoveredLocales.add(entry.locale);
      }
    });
  });
  const orderedLocales = LABEL_LOCALES.filter(locale => discoveredLocales.has(locale))
    .concat(Array.from(discoveredLocales)
      .filter(locale => !LABEL_LOCALES.includes(locale))
      .sort());
  orderedLocales.forEach((locale) => {
    append(locale, labelNodes.map((item) => {
      const localized = item.entries.find(entry => entry.locale === locale);
      return localized ? localized.label : item.label;
    }));
  });
  return selectors;
}

function normalizeSchemaFields(schemaResult) {
  const fields = [];
  const pages = schemaResult && schemaResult.content && schemaResult.content.pages;
  if (!Array.isArray(pages)) {
    return fields;
  }
  const aliases = buildAliasByFieldId(schemaResult);

  function traverse(node, tableAncestors) {
    if (!node || typeof node !== 'object') {
      return;
    }

    const props = node.props && typeof node.props === 'object' ? node.props : {};
    const fieldId = props.fieldId ? normalizeText(props.fieldId) : '';
    const componentType = node.componentName ? normalizeText(node.componentName) : '';
    let childTableAncestors = tableAncestors;

    if (fieldId && componentType) {
      const labelInfo = collectLocalizedLabels(props.label, fieldId);
      const label = labelInfo.label;
      const parentTable = tableAncestors.length > 0
        ? tableAncestors[tableAncestors.length - 1]
        : null;
      fields.push({
        label,
        fieldId,
        componentType,
        valueType: normalizeValueType(props.valueType),
        path: tableAncestors.map(item => item.fieldId).concat(fieldId),
        labelPath: tableAncestors.map(item => item.label).concat(label),
        parentFieldId: parentTable ? parentTable.fieldId : null,
        alias: aliases[fieldId] || '',
        localizedLabels: labelInfo.entries,
        labelPathSelectors: buildLabelPathSelectors(tableAncestors, labelInfo),
      });

      if (componentType === 'TableField') {
        childTableAncestors = tableAncestors.concat({ label, fieldId, labelInfo });
      }
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(child => traverse(child, childTableAncestors));
    }
  }

  pages.forEach((page) => {
    const roots = page && Array.isArray(page.componentsTree) ? page.componentsTree : [];
    roots.forEach(root => traverse(root, []));
  });

  return fields;
}

function normalizeQueries(queries) {
  const result = [];
  (Array.isArray(queries) ? queries : []).forEach((query) => {
    const normalized = normalizeText(query);
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  });
  return result;
}

function findExactMatches(fields, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return [];
  }
  const matchesByFieldId = new Map();

  fields.forEach((field) => {
    const matchedBy = [];
    if (field.fieldId === normalizedQuery) {
      matchedBy.push('fieldId');
    }
    if (field.alias && field.alias === normalizedQuery) {
      matchedBy.push('alias');
    }
    if (field.path.length > 1 && field.path.join('/') === normalizedQuery) {
      matchedBy.push('path');
    }
    (field.localizedLabels || []).forEach((entry) => {
      if (entry.label === normalizedQuery) {
        matchedBy.push(entry.locale ? `label:${entry.locale}` : 'label');
      }
    });
    (field.labelPathSelectors || []).forEach((selector) => {
      if (field.labelPath.length > 1 && selector.value === normalizedQuery) {
        matchedBy.push(selector.locale ? `labelPath:${selector.locale}` : 'labelPath');
      }
    });

    if (matchedBy.length === 0) {
      return;
    }
    const existing = matchesByFieldId.get(field.fieldId);
    if (existing) {
      matchedBy.forEach((identity) => {
        if (!existing.matchedBy.includes(identity)) {
          existing.matchedBy.push(identity);
        }
      });
    } else {
      matchesByFieldId.set(field.fieldId, { field, matchedBy });
    }
  });

  return Array.from(matchesByFieldId.values()).map(({ field, matchedBy }) => ({
    ...field,
    matchedBy,
  }));
}

function publicField(field, query) {
  const result = {
    query: query === undefined ? null : query,
    label: field.label,
    fieldId: field.fieldId,
    componentType: field.componentType,
    valueType: field.valueType,
    path: field.path.slice(),
    labelPath: field.labelPath.slice(),
    parentFieldId: field.parentFieldId,
    alias: field.alias,
  };
  if (Array.isArray(field.matchedBy) && field.matchedBy.length > 0) {
    result.matchedBy = field.matchedBy.slice();
  }
  return result;
}

function resolveFields(fields, queries) {
  const normalizedQueries = normalizeQueries(queries);
  if (normalizedQueries.length === 0) {
    return {
      fields: fields.map(field => publicField(field)),
      missingFields: [],
      ambiguousFields: [],
    };
  }

  const resolution = {
    fields: [],
    missingFields: [],
    ambiguousFields: [],
  };

  normalizedQueries.forEach((query) => {
    const matches = findExactMatches(fields, query);
    if (matches.length === 0) {
      resolution.missingFields.push(query);
    } else if (matches.length === 1) {
      resolution.fields.push(publicField(matches[0], query));
    } else {
      resolution.ambiguousFields.push({
        query,
        reason: 'multiple_exact_matches',
        matches: matches.map(field => publicField(field, query)),
      });
    }
  });

  return resolution;
}

function buildFieldResolution(appType, formUuid, schemaResult, queries) {
  const normalizedFields = normalizeSchemaFields(schemaResult);
  const resolution = resolveFields(normalizedFields, queries);
  return {
    kind: CONTRACT_KIND,
    contractVersion: CONTRACT_VERSION,
    resource: {
      appType,
      formUuid,
      schemaHash: createSchemaHash(schemaResult),
    },
    ...resolution,
  };
}

module.exports = {
  CONTRACT_KIND,
  CONTRACT_VERSION,
  LABEL_LOCALES,
  normalizeText,
  collectLocalizedLabels,
  normalizeLabel,
  stableCopy,
  createSchemaHash,
  normalizeSchemaFields,
  normalizeQueries,
  findExactMatches,
  resolveFields,
  buildFieldResolution,
};
