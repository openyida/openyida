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

function makeFailure(code, message, details = {}) {
  return { code, message, ...details };
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

function formatCoverage(done, total) {
  return `${done}/${total}`;
}

async function evaluatePrdCompleteness(markdown, options = {}, deps = {}) {
  const appType = options.appType;
  const authRef = options.authRef || {};
  const parsed = parsePrdMarkdown(markdown);
  const hardFailures = [];
  const warnings = [];
  const manualReview = parsed.manualReview.slice();

  REQUIRED_SECTION_CHECKS.forEach((check) => {
    if (!parsed.sections[check.key]) {
      hardFailures.push(makeFailure('prd_section_missing', `PRD 缺少关键章节：${check.label}`, {
        section: check.label,
      }));
    }
  });

  const fetchForms = deps.fetchForms || fetchFormPageList;
  const fetchSchema = deps.fetchSchema || fetchSchemaContent;
  const fetchRecordCount = deps.fetchOneFormRecordCount || fetchOneFormRecordCount;
  const forms = await fetchForms(appType, authRef);
  const schemaCache = new Map();

  async function getSchema(formUuid) {
    if (!schemaCache.has(formUuid)) {
      schemaCache.set(formUuid, await fetchSchema(appType, formUuid, authRef));
    }
    return schemaCache.get(formUuid);
  }

  const checkableResources = parsed.resources.filter(resource => (
    resource.kind === 'normal-form' ||
    resource.kind === 'process-form' ||
    resource.kind === 'display-page'
  ));
  const resolvedByName = new Map();
  const resourceResults = [];

  checkableResources.forEach((resource) => {
    const actual = findActualForm(forms, resource.name, resource.kind);
    const ok = !!actual;
    if (!ok) {
      hardFailures.push(makeFailure('resource_missing', `PRD 资源未创建：${resource.name}`, {
        resource: resource.name,
        expectedType: resource.kind,
      }));
    } else {
      resolvedByName.set(normalizeComparable(resource.name), actual);
    }
    resourceResults.push({ resource, actual, ok });
  });

  parsed.resources
    .filter(resource => resource.kind === 'report' || resource.kind === 'unknown')
    .forEach((resource) => {
      warnings.push(makeFailure('resource_not_checked', `轻量检查暂未覆盖该资源类型：${resource.name}`, {
        resource: resource.name,
        expectedType: resource.kind,
      }));
    });

  const fieldsByForm = new Map();
  parsed.fields.forEach((field) => {
    const key = normalizeComparable(field.formName);
    if (!fieldsByForm.has(key)) {
      fieldsByForm.set(key, []);
    }
    fieldsByForm.get(key).push(field);
  });

  let fieldsPassed = 0;
  const fieldsTotal = parsed.fields.length;
  for (const [formKey, fieldRequirements] of fieldsByForm.entries()) {
    const formName = fieldRequirements[0].formName;
    const resolved = resolvedByName.get(formKey) || findActualForm(forms, formName, 'normal-form') || findActualForm(forms, formName, 'process-form');
    if (!resolved) {
      fieldRequirements.forEach((field) => {
        hardFailures.push(makeFailure('field_form_missing', `字段所属表单未找到：${formName}`, {
          form: formName,
          field: field.label,
        }));
      });
      continue;
    }

    let schemaFields;
    try {
      schemaFields = extractSchemaFieldDetails(await getSchema(resolved.formUuid));
    } catch (error) {
      fieldRequirements.forEach((field) => {
        hardFailures.push(makeFailure('field_schema_read_failed', `字段 Schema 读取失败：${formName}`, {
          form: formName,
          field: field.label,
          error: error.message,
        }));
      });
      continue;
    }

    fieldRequirements.forEach((field) => {
      const actualField = findSchemaField(schemaFields, field.label);
      if (!actualField) {
        hardFailures.push(makeFailure('field_missing', `PRD 字段未创建：${formName}.${field.label}`, {
          form: formName,
          field: field.label,
        }));
        return;
      }
      if (!fieldTypeMatches(field.type, actualField.componentName)) {
        hardFailures.push(makeFailure('field_type_mismatch', `字段类型不匹配：${formName}.${field.label}`, {
          form: formName,
          field: field.label,
          expectedType: field.type,
          actualType: actualField.componentName,
        }));
        return;
      }
      if (isRequiredValue(field.required) && !actualField.required) {
        hardFailures.push(makeFailure('field_required_mismatch', `字段必填未覆盖：${formName}.${field.label}`, {
          form: formName,
          field: field.label,
        }));
        return;
      }
      const expectedOptions = extractExpectedOptions(field.options);
      const actualOptions = actualField.options.map(normalizeComparable);
      const missingOptions = expectedOptions.filter(option => !actualOptions.includes(normalizeComparable(option)));
      if (missingOptions.length > 0) {
        hardFailures.push(makeFailure('field_options_missing', `字段选项未覆盖：${formName}.${field.label}`, {
          form: formName,
          field: field.label,
          missingOptions,
        }));
        return;
      }
      fieldsPassed++;
    });
  }

  if (fieldsTotal === 0 && checkableResources.some(resource => resource.kind !== 'display-page')) {
    warnings.push(makeFailure('fields_not_specified', 'PRD 未提取到明确字段清单，字段覆盖无法自动验证'));
  }

  const pageResources = resourceResults.filter(result => result.resource.kind === 'display-page');
  let pagesPassed = 0;
  for (const result of pageResources) {
    if (!result.actual) {
      continue;
    }
    try {
      const schema = await getSchema(result.actual.formUuid);
      const info = extractDisplayPublishInfo(schema);
      const publishMode = info && info.hasYidaCodeCanvas ? 'canvas' : 'native';
      if (hasExpectedDisplayComponent(info, publishMode)) {
        pagesPassed++;
      } else {
        hardFailures.push(makeFailure('display_page_unpublished', `自定义页面未读到已发布内容：${result.resource.name}`, {
          page: result.resource.name,
          formUuid: result.actual.formUuid,
          displayPage: summarizeDisplayPublishInfo(info),
        }));
      }
    } catch (error) {
      hardFailures.push(makeFailure('display_page_schema_read_failed', `自定义页面 Schema 读取失败：${result.resource.name}`, {
        page: result.resource.name,
        formUuid: result.actual.formUuid,
        error: error.message,
      }));
    }
  }

  let seedPassed = 0;
  const seedRecordCountByFormUuid = new Map();
  for (const seed of parsed.seedRecords) {
    const skipAllowed = isSeedSkipAllowed(seed.allowSkip);
    const resolved = findActualForm(forms, seed.formName, 'normal-form');
    if (!resolved) {
      warnings.push(makeFailure('seed_form_missing', `示例数据目标表单未找到：${seed.formName}`, {
        form: seed.formName,
        allowSkip: seed.allowSkip,
      }));
      continue;
    }
    try {
      if (!seedRecordCountByFormUuid.has(resolved.formUuid)) {
        seedRecordCountByFormUuid.set(resolved.formUuid, await fetchRecordCount(appType, resolved.formUuid, authRef));
      }
      const count = seedRecordCountByFormUuid.get(resolved.formUuid);
      if (count > 0) {
        seedPassed++;
      } else if (skipAllowed) {
        seedPassed++;
        warnings.push(makeFailure('seed_record_skipped', `示例数据允许跳过且未抽查到记录：${seed.formName}`, {
          form: seed.formName,
          formUuid: resolved.formUuid,
          allowSkip: seed.allowSkip,
        }));
      } else {
        hardFailures.push(makeFailure('seed_record_missing', `示例数据未抽查到记录：${seed.formName}`, {
          form: seed.formName,
          formUuid: resolved.formUuid,
        }));
      }
    } catch (error) {
      warnings.push(makeFailure('seed_record_query_failed', `示例数据抽查失败：${seed.formName}`, {
        form: seed.formName,
        formUuid: resolved.formUuid,
        error: error.message,
      }));
    }
  }

  const navigation = checkNavigationOrder(parsed.navigationOrder, forms);
  navigation.failures.forEach(failure => hardFailures.push(failure));
  navigation.warnings.forEach(warning => warnings.push(warning));

  const resourcePassed = resourceResults.filter(item => item.ok).length;
  const verdict = hardFailures.length > 0 ? 'fail' : (warnings.length > 0 || manualReview.length > 0) ? 'warning' : 'pass';

  return {
    success: true,
    verdict,
    appType,
    prdPath: options.prdPath || '',
    coverage: {
      resources: formatCoverage(resourcePassed, checkableResources.length),
      fields: formatCoverage(fieldsPassed, fieldsTotal),
      pages: formatCoverage(pagesPassed, pageResources.length),
      seedRecords: formatCoverage(seedPassed, parsed.seedRecords.length),
      navigation: navigation.status,
    },
    hardFailures,
    warnings,
    manualReview,
  };
}

function checkNavigationOrder(navigationOrder, forms) {
  if (!navigationOrder || navigationOrder.length < 2) {
    return { status: 'not_specified', failures: [], warnings: [] };
  }

  const resolved = navigationOrder.map((name) => ({
    name,
    actual: findActualForm(forms, name, 'unknown'),
  }));
  const missing = resolved.filter(item => !item.actual);
  if (missing.length > 0) {
    return {
      status: 'warning',
      failures: [],
      warnings: missing.map(item => makeFailure('navigation_item_missing', `导航项未找到：${item.name}`, {
        item: item.name,
      })),
    };
  }

  const indexes = resolved.map(item => forms.findIndex(form => form.formUuid === item.actual.formUuid));
  const ordered = indexes.every((value, index) => index === 0 || value > indexes[index - 1]);
  if (!ordered) {
    return {
      status: 'fail',
      failures: [makeFailure('navigation_order_mismatch', '导航顺序与 PRD 不一致', {
        expected: navigationOrder,
        actual: forms.map(form => form.formName || form.formUuid),
      })],
      warnings: [],
    };
  }

  return { status: 'pass', failures: [], warnings: [] };
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
  const result = await evaluatePrdCompleteness(markdown, {
    appType: parsed.appType,
    prdPath,
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
  parseArgs,
  parseMarkdownTables,
  parsePrdMarkdown,
  run,
};
