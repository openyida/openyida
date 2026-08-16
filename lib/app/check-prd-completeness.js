'use strict';

const fs = require('fs');
const path = require('path');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { throwCommandError, throwUsage } = require('../core/command-errors');
const { fetchFormPageList } = require('./form-navigation');
const { collectFieldNodes, extractFieldSummary } = require('./get-schema');
const { extractSchemaContent } = require('./services/native-page-schema-builder');
const {
  extractDisplayPublishInfo,
  hasExpectedDisplayComponent,
  summarizeDisplayPublishInfo,
} = require('./display-page-readback');

const REQUIRED_SECTION_CHECKS = [
  { key: 'resourceBlueprint', label: '资源蓝图', patterns: ['资源蓝图', 'resource blueprint'] },
  { key: 'resourceCreationOrder', label: '资源创建顺序', patterns: ['资源创建顺序', 'resource creation order'] },
  { key: 'pageImplementationOrder', label: '页面实现交付顺序', patterns: ['页面实现交付顺序', '页面实现顺序', 'page implementation'] },
  { key: 'navigationOrder', label: '导航顺序', patterns: ['导航顺序', 'navigation order'] },
  { key: 'acceptanceCriteria', label: '验收标准', patterns: ['验收标准', 'acceptance criteria'] },
];

const FIELD_TYPE_GROUPS = [
  { name: 'text', pattern: /文本|单行|字符串|text|string/i, components: ['TextField', 'TextareaField'] },
  { name: 'textarea', pattern: /多行|长文本|textarea/i, components: ['TextareaField', 'TextField'] },
  { name: 'number', pattern: /数字|金额|数量|number|decimal|integer/i, components: ['NumberField'] },
  { name: 'date', pattern: /日期|时间|date|time/i, components: ['DateField'] },
  { name: 'singleChoice', pattern: /单选|下拉|选择|状态|select|radio/i, components: ['RadioField', 'SelectField'] },
  { name: 'multiChoice', pattern: /多选|复选|checkbox|multi/i, components: ['CheckboxField', 'MultiSelectField', 'SelectField'] },
  { name: 'employee', pattern: /成员|员工|人员|负责人|employee|user/i, components: ['EmployeeField'] },
  { name: 'department', pattern: /部门|department/i, components: ['DepartmentSelectField'] },
  { name: 'phone', pattern: /手机|电话|phone|mobile/i, components: ['PhoneField'] },
  { name: 'email', pattern: /邮箱|邮件|email/i, components: ['EmailField'] },
  { name: 'attachment', pattern: /附件|attachment|file/i, components: ['AttachmentField'] },
  { name: 'image', pattern: /图片|image|photo/i, components: ['ImageField'] },
  { name: 'table', pattern: /子表|明细|table/i, components: ['TableField'] },
  { name: 'association', pattern: /关联|association/i, components: ['AssociationFormField'] },
];

const GENERIC_NAV_ITEMS = new Set([
  '新增入口',
  '待办相关页面',
  '平台导航',
  '顶部导航',
  '侧边导航',
  '单页入口',
  '配置表',
  '字典表',
  '权限说明',
  '列表页',
  '详情页',
  '主页面',
  '工作台',
  '官网首页',
]);

function parseArgs(args = []) {
  const parsed = {
    prdPath: '',
    appType: '',
    buildManifestPath: '',
    json: false,
    help: false,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if ((arg === '--app-type' || arg === '--appType' || arg === '--app_type') && args[index + 1]) {
      parsed.appType = args[index + 1];
      index++;
    } else if ((arg === '--build-manifest' || arg === '--manifest') && args[index + 1]) {
      parsed.buildManifestPath = args[index + 1];
      index++;
    } else if (!arg.startsWith('--') && !parsed.prdPath) {
      parsed.prdPath = arg;
    }
  }

  return parsed;
}

function stripInlineMarkdown(value) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_]/g, '')
    .trim();
}

function cleanCell(value) {
  return stripInlineMarkdown(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparable(value) {
  return cleanCell(value)
    .replace(/[《》"'“”‘’<>]/g, '')
    .replace(/[\s\-_/／|]+/g, '')
    .toLowerCase();
}

function stripCommonSuffix(value) {
  return normalizeComparable(value)
    .replace(/(普通表单|流程表单|自定义页面|展示页面|表单页面|业务表单|数据表单|表单|流程|页面|工作台|首页)$/g, '');
}

function isPlaceholder(value) {
  const cleaned = cleanCell(value);
  if (!cleaned) {
    return true;
  }
  if (/^<[^>]+>$/.test(cleaned)) {
    return true;
  }
  if (/^(待创建后回填|待登录态确认|待定|未知|无|n\/a|-)$/.test(cleaned.toLowerCase())) {
    return true;
  }
  return /<[^>]+>/.test(cleaned);
}

function isSeedSkipAllowed(value) {
  return /^(允许跳过|是|true|yes|y)$/i.test(cleanCell(value));
}

function isConcreteName(value) {
  const cleaned = cleanCell(value);
  if (isPlaceholder(cleaned)) {
    return false;
  }
  if (GENERIC_NAV_ITEMS.has(cleaned)) {
    return false;
  }
  return !/^(普通表单|流程表单|报表|详情|页面|表单|流程|数据源|入口)$/.test(cleaned);
}

function splitHeadingSections(markdown, level) {
  const lines = String(markdown || '').split(/\r?\n/);
  const marker = '#'.repeat(level);
  const nextHeading = new RegExp(`^#{1,${level}}\\s+`);
  const sections = [];
  let current = null;

  lines.forEach((line) => {
    if (line.startsWith(`${marker} `)) {
      if (current) {
        sections.push(current);
      }
      current = {
        title: cleanCell(line.slice(level + 1)),
        bodyLines: [],
      };
      return;
    }
    if (current) {
      if (nextHeading.test(line) && !line.startsWith(`${marker} `)) {
        sections.push(current);
        current = null;
      } else {
        current.bodyLines.push(line);
      }
    }
  });

  if (current) {
    sections.push(current);
  }

  return sections.map(section => ({
    title: section.title,
    body: section.bodyLines.join('\n'),
  }));
}

function findHeadingSection(markdown, level, patterns) {
  const normalizedPatterns = patterns.map(pattern => String(pattern).toLowerCase());
  return splitHeadingSections(markdown, level).find((section) => {
    const title = section.title.toLowerCase();
    return normalizedPatterns.some(pattern => title.includes(pattern));
  }) || null;
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cleanCell);
}

function isTableSeparator(line) {
  const cells = splitMarkdownRow(line);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')));
}

function parseMarkdownTables(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const tables = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim().startsWith('|')) {
      index++;
      continue;
    }
    const tableLines = [];
    while (index < lines.length && lines[index].trim().startsWith('|')) {
      tableLines.push(lines[index]);
      index++;
    }
    if (tableLines.length < 2 || !isTableSeparator(tableLines[1])) {
      continue;
    }
    const headers = splitMarkdownRow(tableLines[0]);
    const rows = tableLines.slice(2).map((line) => {
      const cells = splitMarkdownRow(line);
      const row = {};
      headers.forEach((header, cellIndex) => {
        row[header] = cells[cellIndex] || '';
      });
      return row;
    });
    tables.push({ headers, rows });
  }

  return tables;
}

function getCell(row, headerPatterns) {
  const key = Object.keys(row).find((header) => {
    const normalized = normalizeComparable(header);
    return headerPatterns.some(pattern => normalized.includes(normalizeComparable(pattern)));
  });
  return key ? cleanCell(row[key]) : '';
}

function classifyPrdResourceType(typeValue) {
  const value = normalizeComparable(typeValue);
  if (!value) {
    return 'unknown';
  }
  if (/process|流程|审批/.test(value)) {
    return 'process-form';
  }
  if (/report|报表|图表/.test(value)) {
    return 'report';
  }
  if (/display|custom|main|自定义|展示|页面|首页|工作台|门户|看板/.test(value) && !/formpage|表单/.test(value)) {
    return 'display-page';
  }
  if (/normal|receipt|form|表单|数据/.test(value)) {
    return 'normal-form';
  }
  return 'unknown';
}

function classifyActualFormType(formType) {
  const value = normalizeComparable(formType);
  if (value === 'display') {
    return 'display-page';
  }
  if (value === 'process') {
    return 'process-form';
  }
  if (['receipt', 'form', 'normal'].includes(value)) {
    return 'normal-form';
  }
  if (value === 'report') {
    return 'report';
  }
  return value || 'unknown';
}

function isCompatibleResourceType(expectedKind, actualKind) {
  if (!expectedKind || expectedKind === 'unknown') {
    return true;
  }
  if (expectedKind === 'normal-form') {
    return actualKind === 'normal-form';
  }
  return expectedKind === actualKind;
}

function isMainResourceHint(resource = {}) {
  if (resource.main === true || resource.isMain === true || resource.primary === true) {
    return true;
  }
  if (resource.main === false || resource.isMain === false || resource.primary === false) {
    return false;
  }
  const text = [
    resource.name,
    resource.type,
    resource.kind,
    resource.purpose,
    resource.role,
  ].filter(Boolean).join(' ');
  return /main|primary|home|portal|主页面|主入口|首页|门户|工作台/.test(text);
}

function extractResources(markdown) {
  const section = findHeadingSection(markdown, 2, ['资源蓝图', 'resource blueprint']);
  if (!section) {
    return [];
  }

  const table = parseMarkdownTables(section.body).find((candidate) => {
    return candidate.headers.some(header => normalizeComparable(header).includes('资源')) &&
      candidate.headers.some(header => normalizeComparable(header).includes('类型'));
  });
  if (!table) {
    return [];
  }

  return table.rows
    .map((row) => {
      const name = getCell(row, ['资源', 'resource']);
      const type = getCell(row, ['类型', 'type']);
      return {
        name,
        type,
        kind: classifyPrdResourceType(type),
        purpose: getCell(row, ['用途', 'purpose']),
        main: isMainResourceHint({ name, type, purpose: getCell(row, ['用途', 'purpose']) }),
        source: 'prd.resourceBlueprint',
      };
    })
    .filter(resource => isConcreteName(resource.name));
}

function isFieldTable(table) {
  return table.headers.some(header => normalizeComparable(header).includes('字段名')) &&
    table.headers.some(header => normalizeComparable(header).includes('字段类型'));
}

function extractFieldRequirements(markdown) {
  const dataSection = findHeadingSection(markdown, 2, ['数据结构', 'data structure']);
  if (!dataSection) {
    return [];
  }

  const subsections = splitHeadingSections(dataSection.body, 3);
  const requirements = [];
  subsections.forEach((section) => {
    if (!isConcreteName(section.title) || /初始示例数据|seed/i.test(section.title)) {
      return;
    }
    parseMarkdownTables(section.body)
      .filter(isFieldTable)
      .forEach((table) => {
        table.rows.forEach((row) => {
          const label = getCell(row, ['字段名', 'field']);
          if (!isConcreteName(label)) {
            return;
          }
          requirements.push({
            formName: section.title,
            label,
            type: getCell(row, ['字段类型', '类型', 'type']),
            required: getCell(row, ['必填', 'required']),
            options: getCell(row, ['默认值', '选项', 'options']),
          });
        });
      });
  });
  return requirements;
}

function extractSeedRequirements(markdown) {
  const section = findHeadingSection(markdown, 3, ['初始示例数据', 'seed']);
  if (!section) {
    return [];
  }
  const table = parseMarkdownTables(section.body).find((candidate) => {
    return candidate.headers.some(header => normalizeComparable(header).includes('表单')) &&
      candidate.headers.some(header => normalizeComparable(header).includes('默认写入数量'));
  });
  if (!table) {
    return [];
  }

  return table.rows
    .map((row) => {
      const formName = getCell(row, ['表单', 'form']);
      const countText = getCell(row, ['默认写入数量', '数量', 'count']);
      const countMatch = countText.match(/\d+/);
      return {
        formName,
        expectedCount: countMatch ? Number.parseInt(countMatch[0], 10) : 0,
        semantics: getCell(row, ['示例记录语义', '语义']),
        allowSkip: getCell(row, ['是否允许跳过', '允许跳过']),
      };
    })
    .filter(item => isConcreteName(item.formName) && item.expectedCount > 0);
}

function extractNavigationOrder(markdown) {
  const section = findHeadingSection(markdown, 2, ['导航顺序', 'navigation order']);
  if (!section) {
    return [];
  }
  const table = parseMarkdownTables(section.body).find((candidate) => {
    return candidate.headers.some(header => normalizeComparable(header).includes('页面顺序'));
  });
  if (!table) {
    return [];
  }
  const names = [];
  table.rows.forEach((row) => {
    const cell = getCell(row, ['页面顺序', 'pages']);
    cell
      .split(/[、,，>/／/]+/)
      .map(cleanCell)
      .filter(isConcreteName)
      .forEach((name) => {
        if (!names.includes(name)) {
          names.push(name);
        }
      });
  });
  return names;
}

function extractManualReviewItems(markdown) {
  const section = findHeadingSection(markdown, 2, ['验收标准', 'acceptance criteria']);
  if (!section) {
    return [];
  }
  const manualReview = [];
  parseMarkdownTables(section.body).forEach((table) => {
    table.rows.forEach((row) => {
      const scenario = getCell(row, ['场景', 'scenario']) || Object.values(row)[0] || '';
      const criteria = getCell(row, ['验收标准', 'criteria']) || Object.values(row)[1] || '';
      const text = `${scenario} ${criteria}`;
      if (/视觉|首屏|体验|布局|图标|打开后|可访问|首屏|好看|一致性|控制台|渲染|approval|permission|visual|render|experience|first screen/i.test(text)) {
        manualReview.push({
          code: 'manual_acceptance_required',
          scenario: cleanCell(scenario),
          criteria: cleanCell(criteria),
        });
      }
    });
  });
  return manualReview;
}

function parsePrdMarkdown(markdown) {
  const sections = {};
  REQUIRED_SECTION_CHECKS.forEach((check) => {
    sections[check.key] = !!findHeadingSection(markdown, 2, check.patterns);
  });
  return {
    sections,
    resources: extractResources(markdown),
    fields: extractFieldRequirements(markdown),
    seedRecords: extractSeedRequirements(markdown),
    navigationOrder: extractNavigationOrder(markdown),
    manualReview: extractManualReviewItems(markdown),
  };
}

function makeRiskItem(id, source, status, severity, message, details = {}) {
  const item = {
    id,
    source,
    status,
    severity,
    message,
  };
  ['expected', 'actual', 'details'].forEach((key) => {
    if (details[key] !== undefined) {
      item[key] = details[key];
    }
  });
  return item;
}

function legacyFailureFromItem(item) {
  return {
    code: item.id,
    id: item.id,
    source: item.source,
    status: item.status,
    severity: item.severity,
    message: item.message,
    expected: item.expected,
    actual: item.actual,
    ...(item.details || {}),
  };
}

function getObjectValue(object, keys) {
  if (!object || typeof object !== 'object') {
    return undefined;
  }
  return keys.map(key => object[key]).find(value => value !== undefined && value !== null && value !== '');
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizeBuildManifestResource(raw = {}, defaultKind = 'unknown') {
  const name = getObjectValue(raw, ['name', 'resource', 'resourceName', 'formName', 'pageName', 'title']);
  const type = getObjectValue(raw, ['type', 'kind', 'resourceType', 'formType']) || defaultKind;
  const formUuid = getObjectValue(raw, ['formUuid', 'uuid', 'pageUuid', 'formId']);
  const resource = {
    name: cleanCell(name || formUuid || ''),
    type: cleanCell(type || ''),
    kind: classifyPrdResourceType(type || defaultKind),
    purpose: cleanCell(getObjectValue(raw, ['purpose', 'description', 'usage']) || ''),
    formUuid: cleanCell(formUuid || ''),
    required: raw.required !== false && raw.optional !== true,
    main: isMainResourceHint(raw),
    source: 'build_manifest.resources',
  };
  if (defaultKind === 'display-page') {
    resource.kind = 'display-page';
  } else if (defaultKind === 'normal-form' && resource.kind === 'unknown') {
    resource.kind = 'normal-form';
  } else if (defaultKind === 'process-form' && resource.kind === 'unknown') {
    resource.kind = 'process-form';
  }
  return resource;
}

function addManifestResource(resources, seen, raw, defaultKind) {
  const resource = normalizeBuildManifestResource(raw, defaultKind);
  if (!isConcreteName(resource.name) && !resource.formUuid) {
    return;
  }
  const key = `${resource.kind}:${normalizeComparable(resource.name || resource.formUuid)}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  resources.push(resource);
}

function normalizeManifestField(field = {}, formName) {
  const label = getObjectValue(field, ['label', 'name', 'fieldName', 'title']);
  if (!isConcreteName(label)) {
    return null;
  }
  return {
    formName,
    label: cleanCell(label),
    type: cleanCell(getObjectValue(field, ['type', 'fieldType', 'componentName']) || ''),
    required: cleanCell(getObjectValue(field, ['required', 'must']) || ''),
    options: cleanCell(getObjectValue(field, ['options', 'optionLabels', 'values']) || ''),
    source: 'build_manifest.fields',
  };
}

function parseBuildManifest(manifest = {}) {
  const normalized = {
    resources: [],
    fields: [],
    seedRecords: [],
    navigationOrder: [],
    manualReview: [],
  };
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return normalized;
  }

  const seen = new Set();
  asArray(manifest.resources).forEach(resource => addManifestResource(normalized.resources, seen, resource, 'unknown'));
  asArray(manifest.forms).forEach((form) => {
    const defaultKind = /process|流程/i.test(cleanCell(getObjectValue(form, ['type', 'kind', 'formType']) || '')) ? 'process-form' : 'normal-form';
    addManifestResource(normalized.resources, seen, form, defaultKind);
    const formName = cleanCell(getObjectValue(form, ['name', 'formName', 'title', 'resourceName']) || '');
    asArray(form.fields).forEach((field) => {
      const normalizedField = normalizeManifestField(field, formName);
      if (normalizedField) {
        normalized.fields.push(normalizedField);
      }
    });
  });
  asArray(manifest.pages || manifest.displayPages).forEach(page => addManifestResource(normalized.resources, seen, page, 'display-page'));

  asArray(manifest.fields).forEach((group) => {
    const formName = cleanCell(getObjectValue(group, ['formName', 'resource', 'resourceName', 'name']) || '');
    if (Array.isArray(group.fields)) {
      group.fields.forEach((field) => {
        const normalizedField = normalizeManifestField(field, formName);
        if (normalizedField) {
          normalized.fields.push(normalizedField);
        }
      });
    } else {
      const normalizedField = normalizeManifestField(group, formName);
      if (normalizedField) {
        normalized.fields.push(normalizedField);
      }
    }
  });

  asArray(manifest.seedRecords || manifest.seeds).forEach((seed) => {
    const formName = cleanCell(getObjectValue(seed, ['formName', 'form', 'resource', 'resourceName']) || '');
    if (!isConcreteName(formName)) {
      return;
    }
    normalized.seedRecords.push({
      formName,
      expectedCount: Number.parseInt(getObjectValue(seed, ['expectedCount', 'count', 'rows']) || '1', 10) || 1,
      allowSkip: cleanCell(getObjectValue(seed, ['allowSkip', 'skippable']) || ''),
      semantics: cleanCell(getObjectValue(seed, ['semantics', 'description']) || ''),
      source: 'build_manifest.seedRecords',
    });
  });

  const navigation = manifest.navigationOrder || (manifest.navigation && (manifest.navigation.order || manifest.navigation.items)) || manifest.navigation;
  normalized.navigationOrder = asArray(navigation)
    .flatMap(item => (typeof item === 'string' ? item.split(/[、,，>/／/]+/) : [getObjectValue(item, ['name', 'title', 'pageName', 'formName'])]))
    .map(cleanCell)
    .filter(isConcreteName);

  asArray(manifest.manualReview).forEach((item) => {
    const message = typeof item === 'string' ? item : getObjectValue(item, ['message', 'criteria', 'title']);
    if (message) {
      normalized.manualReview.push({
        code: 'manual_acceptance_required',
        scenario: cleanCell(getObjectValue(item, ['scenario', 'source']) || 'build manifest'),
        criteria: cleanCell(message),
        source: 'build_manifest.manualReview',
      });
    }
  });

  return normalized;
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(item);
  });
  return result;
}

function mergeResourceHints(prdResources, manifestResources) {
  return dedupeBy([
    ...manifestResources,
    ...prdResources.map(resource => ({ ...resource, source: resource.source || 'prd.resourceBlueprint' })),
  ], resource => `${resource.kind}:${normalizeComparable(resource.name || resource.formUuid)}`);
}

function mergeFieldHints(prdFields, manifestFields) {
  return dedupeBy([
    ...manifestFields,
    ...prdFields.map(field => ({ ...field, source: field.source || 'prd.fields' })),
  ], field => `${normalizeComparable(field.formName)}:${normalizeComparable(field.label)}`);
}

function mergeSeedHints(prdSeeds, manifestSeeds) {
  return dedupeBy([
    ...manifestSeeds,
    ...prdSeeds.map(seed => ({ ...seed, source: seed.source || 'prd.seedRecords' })),
  ], seed => `${normalizeComparable(seed.formName)}:${normalizeComparable(seed.semantics || seed.expectedCount)}`);
}

function mergeNavigationHints(prdNavigationOrder, manifestNavigationOrder) {
  return manifestNavigationOrder.length > 0 ? manifestNavigationOrder : prdNavigationOrder;
}

function loadBuildManifest(filePath) {
  if (!filePath) {
    return null;
  }
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throwCommandError(t('check_prd_completeness.manifest_not_found', resolvedPath), {
      code: 'PRD_COMPLETENESS_MANIFEST_NOT_FOUND',
    });
  }
  try {
    return {
      path: resolvedPath,
      content: JSON.parse(fs.readFileSync(resolvedPath, 'utf8')),
    };
  } catch (error) {
    throwCommandError(t('check_prd_completeness.manifest_invalid', error.message), {
      code: 'PRD_COMPLETENESS_MANIFEST_INVALID',
    });
  }
  return null;
}

function findActualForm(forms, targetName, expectedKind = 'unknown') {
  const target = normalizeComparable(targetName);
  const targetLoose = stripCommonSuffix(targetName);
  if (!target) {
    return null;
  }

  const candidates = (forms || []).map((form, index) => ({
    form,
    index,
    kind: classifyActualFormType(form.formType),
    names: [form.formName, form.formUuid, form.pathName].filter(Boolean),
  })).filter(item => isCompatibleResourceType(expectedKind, item.kind));

  const scored = candidates.map((candidate) => {
    let score = 0;
    candidate.names.forEach((name) => {
      const normalized = normalizeComparable(name);
      const loose = stripCommonSuffix(name);
      if (normalized === target) {
        score = Math.max(score, 100);
      } else if (loose && targetLoose && loose === targetLoose) {
        score = Math.max(score, 90);
      } else if (normalized.includes(target) || target.includes(normalized)) {
        score = Math.max(score, 75);
      } else if (loose && targetLoose && (loose.includes(targetLoose) || targetLoose.includes(loose))) {
        score = Math.max(score, 65);
      }
    });
    return { ...candidate, score };
  }).filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  return scored[0] ? scored[0].form : null;
}

function labelFromProps(label) {
  if (!label) {
    return '';
  }
  if (typeof label === 'object') {
    return label.zh_CN || label.en_US || label.zh_HK || label.ja_JP || label.text || label.label || '';
  }
  return String(label);
}

function isRequiredValue(value) {
  return /^(是|必填|true|yes|required|y)$/i.test(cleanCell(value));
}

function isFieldRequired(props = {}) {
  return props.required === true ||
    props.required === 'true' ||
    props.required === 'y' ||
    props.required === 'Y' ||
    props.required === 1;
}

function expectedFieldTypeGroup(value) {
  if (isPlaceholder(value)) {
    return null;
  }
  const cleaned = cleanCell(value);
  return FIELD_TYPE_GROUPS.find(group => group.pattern.test(cleaned)) || null;
}

function fieldTypeMatches(expectedType, componentName) {
  const group = expectedFieldTypeGroup(expectedType);
  if (!group) {
    return true;
  }
  return group.components.includes(componentName);
}

function extractExpectedOptions(value) {
  if (!value || isPlaceholder(value)) {
    return [];
  }
  const cleaned = cleanCell(value)
    .replace(/默认值[:：]?/g, '')
    .replace(/选项[:：]?/g, '')
    .replace(/无|不适用|暂无|待定/g, '');
  return cleaned
    .split(/[、,，;；/|]+/)
    .map(item => cleanCell(item).replace(/^[-:：]+/, '').trim())
    .filter(item => item && !isPlaceholder(item));
}

function extractSchemaFieldDetails(schema) {
  const schemaResult = { content: schema };
  const nodes = collectFieldNodes(schemaResult);
  const summaries = extractFieldSummary(schemaResult);
  const summaryByFieldId = new Map(summaries.map(summary => [summary.fieldId, summary]));

  return nodes.map((node) => {
    const props = node.props || {};
    const summary = summaryByFieldId.get(props.fieldId) || {};
    return {
      label: labelFromProps(props.label),
      fieldId: props.fieldId || '',
      componentName: node.componentName || '',
      required: isFieldRequired(props),
      options: Array.isArray(summary.options) ? summary.options.map(option => option.label).filter(Boolean) : [],
    };
  });
}

function findSchemaField(fields, label) {
  const target = normalizeComparable(label);
  return fields.find(field => normalizeComparable(field.label) === target || normalizeComparable(field.fieldId) === target) || null;
}

async function fetchSchemaContent(appType, formUuid, authRef) {
  const result = await createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
    { formUuid, schemaVersion: 'V5' }
  );
  if (!result || result.success === false || result.__needLogin) {
    throw new Error(result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed'));
  }
  const schema = extractSchemaContent(result);
  if (!schema) {
    throw new Error(t('create_form.schema_parse_failed'));
  }
  return schema;
}

function getResultDataList(result) {
  if (!result) {
    return [];
  }
  if (Array.isArray(result.data)) {
    return result.data;
  }
  if (result.content && Array.isArray(result.content.data)) {
    return result.content.data;
  }
  if (result.content && Array.isArray(result.content.dataList)) {
    return result.content.dataList;
  }
  return [];
}

async function fetchOneFormRecordCount(appType, formUuid, authRef) {
  const result = await createYidaClient({ authRef }).get(
    `/dingtalk/web/${appType}/v1/form/searchFormDatas.json`,
    {
      formUuid,
      appType,
      currentPage: '1',
      pageSize: '1',
    }
  );
  if (!result || result.success === false || result.__needLogin) {
    throw new Error(result ? result.errorMsg || t('common.unknown_error') : t('common.request_failed'));
  }
  return getResultDataList(result).length;
}

async function evaluatePrdCompleteness(markdown, options = {}, deps = {}) {
  const appType = options.appType;
  const authRef = options.authRef || {};
  const parsed = parsePrdMarkdown(markdown);
  const manifestHints = parseBuildManifest(options.buildManifest);
  const items = [];
  const checked = {
    formListRead: false,
    resources: { expected: 0, found: 0 },
    formSchemas: { checked: 0, failed: 0 },
    displayPages: { checked: 0, published: 0 },
    fields: { hinted: 0, matched: 0 },
    seedRecords: { hinted: 0, checked: 0, found: 0 },
    navigation: 'not_checked',
  };

  function addItem(id, source, status, severity, message, details = {}) {
    items.push(makeRiskItem(id, source, status, severity, message, details));
  }

  function buildResult() {
    const hardFailureItems = items.filter(item => item.status === 'fail');
    const reviewItems = items.filter(item => item.status === 'needs_review' || item.status === 'not_checked');
    const verdict = hardFailureItems.length > 0 ? 'fail' : reviewItems.length > 0 ? 'needs_review' : 'pass';
    return {
      success: true,
      verdict,
      mode: 'delivery_risk_radar',
      appType,
      prdPath: options.prdPath || '',
      buildManifestPath: options.buildManifestPath || '',
      sources: {
        prd: {
          mode: 'best_effort_hints',
          resources: parsed.resources.length,
          fields: parsed.fields.length,
          seedRecords: parsed.seedRecords.length,
          navigationItems: parsed.navigationOrder.length,
        },
        buildManifest: options.buildManifest ? {
          mode: 'build_facts',
          path: options.buildManifestPath || '',
          resources: manifestHints.resources.length,
          fields: manifestHints.fields.length,
          seedRecords: manifestHints.seedRecords.length,
          navigationItems: manifestHints.navigationOrder.length,
        } : null,
      },
      summary: {
        totalItems: items.length,
        hardFailures: hardFailureItems.length,
        needsReview: reviewItems.length,
        notChecked: items.filter(item => item.status === 'not_checked').length,
        checked,
      },
      items,
      hardFailures: hardFailureItems.map(legacyFailureFromItem),
      warnings: items
        .filter(item => item.status === 'needs_review' && item.severity !== 'manual')
        .map(legacyFailureFromItem),
      manualReview: items
        .filter(item => item.status === 'not_checked' || item.severity === 'manual')
        .map(legacyFailureFromItem),
    };
  }

  if (!options.buildManifest) {
    addItem('build_manifest_missing', 'build_manifest', 'not_checked', 'info', '未提供 build-manifest.json，结果仅基于 PRD best-effort hints 和远端 readback', {
      expected: '--build-manifest <file>',
      actual: null,
    });
  }

  REQUIRED_SECTION_CHECKS.forEach((check) => {
    if (!parsed.sections[check.key]) {
      addItem('prd_section_not_checked', 'prd.sections', 'not_checked', 'info', `PRD 未解析到关键章节：${check.label}`, {
        expected: check.label,
        actual: null,
      });
    }
  });

  const fetchForms = deps.fetchForms || fetchFormPageList;
  const fetchSchema = deps.fetchSchema || fetchSchemaContent;
  const fetchRecordCount = deps.fetchOneFormRecordCount || fetchOneFormRecordCount;
  let forms = [];
  try {
    forms = await fetchForms(appType, authRef);
    checked.formListRead = true;
  } catch (error) {
    checked.formListRead = false;
    addItem('app_nav_list_read_failed', 'remote.nav_list', 'fail', 'blocker', '目标应用资源/导航列表读取失败，无法继续做定向检查', {
      expected: { appType, readable: true },
      actual: { error: error.message },
    });
    return buildResult();
  }

  const schemaCache = new Map();

  async function getSchema(formUuid) {
    if (!schemaCache.has(formUuid)) {
      schemaCache.set(formUuid, await fetchSchema(appType, formUuid, authRef));
    }
    return schemaCache.get(formUuid);
  }

  const resourceHints = mergeResourceHints(parsed.resources, manifestHints.resources);
  const fieldHints = mergeFieldHints(parsed.fields, manifestHints.fields);
  const seedHints = mergeSeedHints(parsed.seedRecords, manifestHints.seedRecords);
  const navigationOrder = mergeNavigationHints(parsed.navigationOrder, manifestHints.navigationOrder);

  const checkableResources = resourceHints.filter(resource => (
    resource.kind === 'normal-form' ||
    resource.kind === 'process-form' ||
    resource.kind === 'display-page'
  ));
  const resolvedByName = new Map();
  const resourceResults = [];
  checked.resources.expected = checkableResources.length;

  if (resourceHints.length === 0) {
    addItem('resources_not_checked', 'prd.resourceBlueprint', 'not_checked', 'manual', '未从 PRD 或 build manifest 中获得明确资源清单，无法判断是否存在漏搭资源', {
      expected: '资源蓝图或 build-manifest.resources/forms/pages',
      actual: null,
    });
  }
  checkableResources.forEach((resource) => {
    const actual = resource.formUuid
      ? forms.find(form => normalizeComparable(form.formUuid) === normalizeComparable(resource.formUuid)) || findActualForm(forms, resource.name, resource.kind)
      : findActualForm(forms, resource.name, resource.kind);
    const ok = !!actual;
    if (!ok) {
      if (resource.required === false) {
        addItem('optional_resource_not_checked', resource.source || 'build_manifest.resources', 'not_checked', 'info', `可选资源未找到：${resource.name || resource.formUuid}`, {
          expected: { name: resource.name, formUuid: resource.formUuid, kind: resource.kind },
          actual: null,
        });
      } else {
        addItem('resource_missing', resource.source || 'prd.resourceBlueprint', 'fail', 'blocker', `明确要求的核心资源未找到：${resource.name || resource.formUuid}`, {
          expected: { name: resource.name, formUuid: resource.formUuid, kind: resource.kind },
          actual: null,
        });
      }
    } else {
      resolvedByName.set(normalizeComparable(resource.name), actual);
      resolvedByName.set(normalizeComparable(resource.formUuid), actual);
      resolvedByName.set(normalizeComparable(actual.formUuid), actual);
      checked.resources.found++;
    }
    resourceResults.push({ resource, actual, ok });
  });

  resourceHints
    .filter(resource => resource.kind === 'report' || resource.kind === 'unknown')
    .forEach((resource) => {
      addItem('resource_not_checked', resource.source || 'prd.resourceBlueprint', 'not_checked', 'info', `轻量检查暂未覆盖该资源类型：${resource.name}`, {
        expected: { name: resource.name, kind: resource.kind },
        actual: 'unsupported_in_v1',
      });
    });

  const schemaReadFailed = new Set();
  const schemaReadSucceeded = new Set();
  async function readSchemaForResource(resource, actual, source) {
    try {
      const schema = await getSchema(actual.formUuid);
      if (!schemaReadSucceeded.has(actual.formUuid)) {
        schemaReadSucceeded.add(actual.formUuid);
        checked.formSchemas.checked++;
      }
      return schema;
    } catch (error) {
      if (!schemaReadFailed.has(actual.formUuid)) {
        schemaReadFailed.add(actual.formUuid);
        checked.formSchemas.failed++;
        addItem('form_schema_read_failed', source, 'fail', 'blocker', `核心资源 Schema 读取失败：${resource.name || actual.formName}`, {
          expected: { form: resource.name || actual.formName, formUuid: actual.formUuid, readable: true },
          actual: { error: error.message },
        });
      }
      return null;
    }
  }

  for (const result of resourceResults.filter(item => item.actual && (item.resource.kind === 'normal-form' || item.resource.kind === 'process-form'))) {
    await readSchemaForResource(result.resource, result.actual, result.resource.source || 'remote.schema');
  }

  const fieldsByForm = new Map();
  fieldHints.forEach((field) => {
    const key = normalizeComparable(field.formName);
    if (!fieldsByForm.has(key)) {
      fieldsByForm.set(key, []);
    }
    fieldsByForm.get(key).push(field);
  });

  checked.fields.hinted = fieldHints.length;
  for (const [formKey, fieldRequirements] of fieldsByForm.entries()) {
    const formName = fieldRequirements[0].formName;
    const resolved = resolvedByName.get(formKey) || findActualForm(forms, formName, 'normal-form') || findActualForm(forms, formName, 'process-form');
    if (!resolved) {
      fieldRequirements.forEach((field) => {
        addItem('field_form_missing', field.source || 'prd.fields', 'needs_review', 'warning', `字段所属表单未定位，需人工确认：${formName}`, {
          expected: { form: formName, field: field.label },
          actual: null,
        });
      });
      continue;
    }

    let schemaFields;
    let schema;
    try {
      schema = await getSchema(resolved.formUuid);
      schemaFields = extractSchemaFieldDetails(schema);
    } catch (error) {
      if (!schemaReadFailed.has(resolved.formUuid)) {
        schemaReadFailed.add(resolved.formUuid);
        checked.formSchemas.failed++;
        addItem('form_schema_read_failed', 'remote.schema', 'fail', 'blocker', `核心表单存在但 Schema 读取失败：${formName}`, {
          expected: { form: formName, formUuid: resolved.formUuid, readable: true },
          actual: { error: error.message },
        });
      }
      continue;
    }
    if (schema) {
      if (!schemaReadSucceeded.has(resolved.formUuid)) {
        schemaReadSucceeded.add(resolved.formUuid);
        checked.formSchemas.checked++;
      }
    }

    fieldRequirements.forEach((field) => {
      const actualField = findSchemaField(schemaFields, field.label);
      if (!actualField) {
        addItem('field_missing', field.source || 'prd.fields', 'needs_review', 'warning', `字段未稳定匹配，需人工确认：${formName}.${field.label}`, {
          expected: { form: formName, field: field.label },
          actual: schemaFields.map(item => item.label).filter(Boolean),
        });
        return;
      }
      if (!fieldTypeMatches(field.type, actualField.componentName)) {
        addItem('field_type_mismatch', field.source || 'prd.fields', 'needs_review', 'warning', `字段类型可能不一致，需人工确认：${formName}.${field.label}`, {
          expected: { type: field.type },
          actual: { type: actualField.componentName },
        });
        return;
      }
      if (isRequiredValue(field.required) && !actualField.required) {
        addItem('field_required_mismatch', field.source || 'prd.fields', 'needs_review', 'warning', `字段必填要求可能未覆盖，需人工确认：${formName}.${field.label}`, {
          expected: { required: true },
          actual: { required: actualField.required },
        });
        return;
      }
      const expectedOptions = extractExpectedOptions(field.options);
      const actualOptions = actualField.options.map(normalizeComparable);
      const missingOptions = expectedOptions.filter(option => !actualOptions.includes(normalizeComparable(option)));
      if (missingOptions.length > 0) {
        addItem('field_options_missing', field.source || 'prd.fields', 'needs_review', 'warning', `字段选项可能未覆盖，需人工确认：${formName}.${field.label}`, {
          expected: expectedOptions,
          actual: actualField.options,
        });
        return;
      }
      checked.fields.matched++;
    });
  }

  if (fieldHints.length === 0 && checkableResources.some(resource => resource.kind !== 'display-page')) {
    addItem('fields_not_checked', 'prd.fields', 'not_checked', 'manual', '未从 PRD 或 build manifest 中获得明确字段清单，字段覆盖无法自动验证', {
      expected: '数据结构字段表或 build-manifest.forms[].fields',
      actual: null,
    });
  }

  const pageResources = resourceResults.filter(result => result.resource.kind === 'display-page');
  for (const result of pageResources) {
    if (!result.actual) {
      continue;
    }
    const mainPage = isMainResourceHint(result.resource) || pageResources.length === 1;
    try {
      const schema = await getSchema(result.actual.formUuid);
      checked.displayPages.checked++;
      const info = extractDisplayPublishInfo(schema);
      const publishMode = info && info.hasYidaCodeCanvas ? 'canvas' : 'native';
      if (hasExpectedDisplayComponent(info, publishMode)) {
        checked.displayPages.published++;
      } else {
        addItem(
          'display_page_unpublished',
          result.resource.source || 'remote.schema',
          mainPage ? 'fail' : 'needs_review',
          mainPage ? 'blocker' : 'warning',
          `自定义页面未读到已发布内容：${result.resource.name}`,
          {
            expected: { page: result.resource.name, formUuid: result.actual.formUuid, published: true, main: mainPage },
            actual: summarizeDisplayPublishInfo(info),
          }
        );
      }
    } catch (error) {
      addItem('display_page_schema_read_failed', 'remote.schema', mainPage ? 'fail' : 'needs_review', mainPage ? 'blocker' : 'warning', `自定义页面 Schema 读取失败：${result.resource.name}`, {
        expected: { page: result.resource.name, formUuid: result.actual.formUuid, readable: true, main: mainPage },
        actual: { error: error.message },
      });
    }
  }

  const seedRecordCountByFormUuid = new Map();
  checked.seedRecords.hinted = seedHints.length;
  for (const seed of seedHints) {
    const skipAllowed = isSeedSkipAllowed(seed.allowSkip);
    const resolved = findActualForm(forms, seed.formName, 'normal-form');
    if (!resolved) {
      addItem('seed_form_missing', seed.source || 'prd.seedRecords', 'needs_review', 'warning', `示例数据目标表单未定位，需人工确认：${seed.formName}`, {
        expected: { form: seed.formName },
        actual: null,
      });
      continue;
    }
    try {
      if (!seedRecordCountByFormUuid.has(resolved.formUuid)) {
        seedRecordCountByFormUuid.set(resolved.formUuid, await fetchRecordCount(appType, resolved.formUuid, authRef));
      }
      checked.seedRecords.checked++;
      const count = seedRecordCountByFormUuid.get(resolved.formUuid);
      if (count > 0) {
        checked.seedRecords.found++;
      } else if (skipAllowed) {
        addItem('seed_record_skipped', seed.source || 'prd.seedRecords', 'needs_review', 'info', `示例数据允许跳过且未抽查到记录：${seed.formName}`, {
          expected: { form: seed.formName, formUuid: resolved.formUuid, count: seed.expectedCount, allowSkip: seed.allowSkip },
          actual: { count },
        });
      } else {
        addItem('seed_record_missing', seed.source || 'prd.seedRecords', 'needs_review', 'warning', `示例数据未抽查到记录，需人工确认是否允许空态交付：${seed.formName}`, {
          expected: { form: seed.formName, formUuid: resolved.formUuid, count: seed.expectedCount },
          actual: { count },
        });
      }
    } catch (error) {
      addItem('seed_record_not_checked', seed.source || 'prd.seedRecords', 'not_checked', 'manual', `示例数据抽查失败，需人工确认：${seed.formName}`, {
        expected: { form: seed.formName, formUuid: resolved.formUuid, pageSize: 1 },
        actual: { error: error.message },
      });
    }
  }
  if (seedHints.length === 0) {
    addItem('seed_records_not_checked', 'prd.seedRecords', 'not_checked', 'manual', '未从 PRD 或 build manifest 中获得明确 seed records 要求，示例数据无法自动确认', {
      expected: '初始示例数据计划或 build-manifest.seedRecords',
      actual: null,
    });
  }

  const navigation = checkNavigationOrder(navigationOrder, forms, manifestHints.navigationOrder.length > 0 ? 'build_manifest.navigationOrder' : 'prd.navigationOrder');
  checked.navigation = navigation.status;
  navigation.items.forEach(item => items.push(item));

  [...parsed.manualReview, ...manifestHints.manualReview].forEach((item) => {
    addItem('manual_acceptance_required', item.source || 'prd.acceptanceCriteria', 'needs_review', 'manual', 'PRD 包含需要人工确认的验收项', {
      expected: item.criteria,
      actual: { scenario: item.scenario || '' },
    });
  });

  return buildResult();
}

function checkNavigationOrder(navigationOrder, forms, source = 'prd.navigationOrder') {
  if (!navigationOrder || navigationOrder.length < 2) {
    return {
      status: 'not_checked',
      items: [makeRiskItem('navigation_not_checked', source, 'not_checked', 'manual', '未获得明确导航顺序，导航覆盖无法自动确认', {
        expected: '导航顺序或 build-manifest.navigationOrder',
        actual: null,
      })],
    };
  }

  const resolved = navigationOrder.map((name) => ({
    name,
    actual: findActualForm(forms, name, 'unknown'),
  }));
  const missing = resolved.filter(item => !item.actual);
  if (missing.length > 0) {
    return {
      status: 'needs_review',
      items: missing.map(item => makeRiskItem('navigation_item_missing', source, 'needs_review', 'warning', `导航项未定位，需人工确认：${item.name}`, {
        expected: item.name,
        actual: null,
      })),
    };
  }

  const indexes = resolved.map(item => forms.findIndex(form => form.formUuid === item.actual.formUuid));
  const ordered = indexes.every((value, index) => index === 0 || value > indexes[index - 1]);
  if (!ordered) {
    return {
      status: 'needs_review',
      items: [makeRiskItem('navigation_order_mismatch', source, 'needs_review', 'warning', '导航顺序可能与 PRD/manifest 不一致，需人工确认', {
        expected: navigationOrder,
        actual: forms.map(form => form.formName || form.formUuid),
      })],
    };
  }

  return { status: 'pass', items: [] };
}

async function run(args = []) {
  const parsed = parseArgs(args);
  if (parsed.help) {
    console.error(t('check_prd_completeness.usage'));
    console.error(t('check_prd_completeness.example'));
    return;
  }
  if (!parsed.prdPath || !parsed.appType) {
    throwUsage(t('check_prd_completeness.usage'), t('check_prd_completeness.example'));
  }

  const prdPath = path.resolve(parsed.prdPath);
  if (!fs.existsSync(prdPath)) {
    throwCommandError(t('check_prd_completeness.prd_not_found', prdPath), {
      code: 'PRD_COMPLETENESS_FILE_NOT_FOUND',
    });
  }

  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throwCommandError(t('check_prd_completeness.no_login'), {
      code: 'CLI_AUTH_REQUIRED',
    });
  }

  console.error(t('check_prd_completeness.checking', parsed.appType));
  const markdown = fs.readFileSync(prdPath, 'utf8');
  const buildManifest = loadBuildManifest(parsed.buildManifestPath);
  const result = await evaluatePrdCompleteness(markdown, {
    appType: parsed.appType,
    prdPath,
    buildManifestPath: buildManifest ? buildManifest.path : '',
    buildManifest: buildManifest ? buildManifest.content : null,
    authRef,
  });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  checkNavigationOrder,
  evaluatePrdCompleteness,
  extractFieldRequirements,
  extractNavigationOrder,
  extractResources,
  extractSeedRequirements,
  loadBuildManifest,
  parseArgs,
  parseBuildManifest,
  parseMarkdownTables,
  parsePrdMarkdown,
  run,
};
