'use strict';

const fs = require('fs');
const path = require('path');
const { createAuthRef, isAuthRefReady } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { throwCommandError, throwUsage } = require('../core/command-errors');
const { fetchFormPageList } = require('./form-navigation');

const CHECKABLE_RESOURCE_KINDS = new Set(['display-page', 'normal-form', 'process-form']);

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

function isConcreteName(value) {
  const cleaned = cleanCell(value);
  if (isPlaceholder(cleaned)) {
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

function classifyResourceType(typeValue) {
  const value = normalizeComparable(typeValue);
  if (!value) {
    return 'unknown';
  }
  if (/process|流程|审批/.test(value)) {
    return 'process-form';
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
  if (/display|custom|自定义|展示/.test(value)) {
    return 'display-page';
  }
  if (/process|流程/.test(value)) {
    return 'process-form';
  }
  if (/receipt|normal|form|表单/.test(value)) {
    return 'normal-form';
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
        kind: classifyResourceType(type),
        source: 'prd.resourceBlueprint',
      };
    })
    .filter(resource => isConcreteName(resource.name) && CHECKABLE_RESOURCE_KINDS.has(resource.kind));
}

function parsePrdMarkdown(markdown) {
  return {
    resources: extractResources(markdown),
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

function isResourceRequired(raw = {}) {
  if (raw.required === false || raw.optional === true || raw.core === false) {
    return false;
  }
  return true;
}

function normalizeBuildManifestResource(raw = {}, defaultKind = 'unknown', source = 'build_manifest.resources') {
  const name = getObjectValue(raw, ['name', 'resource', 'resourceName', 'formName', 'pageName', 'title']);
  const type = getObjectValue(raw, ['type', 'kind', 'resourceType', 'formType']) || defaultKind;
  const formUuid = getObjectValue(raw, ['formUuid', 'uuid', 'pageUuid', 'formId']);
  let kind = classifyResourceType(type || defaultKind);
  if (defaultKind !== 'unknown' && kind === 'unknown') {
    kind = defaultKind;
  }
  return {
    name: cleanCell(name || ''),
    type: cleanCell(type || ''),
    kind,
    formUuid: cleanCell(formUuid || ''),
    main: raw.main === true || raw.isMain === true || raw.primary === true,
    required: isResourceRequired(raw),
    source,
  };
}

function addManifestResource(resources, seen, raw, defaultKind, source) {
  const resource = normalizeBuildManifestResource(raw, defaultKind, source);
  if (!CHECKABLE_RESOURCE_KINDS.has(resource.kind)) {
    return;
  }
  if (!isConcreteName(resource.name) && !resource.formUuid) {
    return;
  }
  const key = `${resource.kind}:${normalizeComparable(resource.formUuid || resource.name)}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  resources.push(resource);
}

function parseBuildManifest(manifest = {}) {
  const normalized = {
    resources: [],
  };
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return normalized;
  }

  const seen = new Set();
  asArray(manifest.resources).forEach(resource => addManifestResource(normalized.resources, seen, resource, 'unknown', 'build_manifest.resources'));
  asArray(manifest.pages || manifest.displayPages).forEach(page => addManifestResource(normalized.resources, seen, page, 'display-page', 'build_manifest.pages'));
  asArray(manifest.forms).forEach((form) => {
    const defaultKind = /process|流程/i.test(cleanCell(getObjectValue(form, ['type', 'kind', 'formType']) || '')) ? 'process-form' : 'normal-form';
    addManifestResource(normalized.resources, seen, form, defaultKind, 'build_manifest.forms');
  });
  return normalized;
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

function makeRiskItem(id, source, status, severity, message, details = {}) {
  const item = {
    id,
    source,
    status,
    severity,
    message,
  };
  ['expected', 'actual'].forEach((key) => {
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
  };
}

function makeActualResource(form, index) {
  return {
    formUuid: form.formUuid || '',
    name: form.formName || form.name || form.pageName || '',
    kind: classifyActualFormType(form.formType || form.type),
    index,
    raw: form,
  };
}

function namesMatch(expectedName, actualName) {
  const expected = normalizeComparable(expectedName);
  const actual = normalizeComparable(actualName);
  const expectedLoose = stripCommonSuffix(expectedName);
  const actualLoose = stripCommonSuffix(actualName);
  return expected && actual && (
    expected === actual ||
    (expectedLoose && actualLoose && expectedLoose === actualLoose)
  );
}

function matchResource(expected, actualResources) {
  if (expected.formUuid) {
    const actual = actualResources.find(resource => normalizeComparable(resource.formUuid) === normalizeComparable(expected.formUuid));
    if (!actual) {
      return { status: 'missing_exact_id' };
    }
    if (!isCompatibleResourceType(expected.kind, actual.kind)) {
      return { status: 'type_mismatch', actual };
    }
    return { status: 'matched', actual, method: 'formUuid' };
  }

  const candidates = actualResources.filter((actual) => {
    return namesMatch(expected.name, actual.name) && isCompatibleResourceType(expected.kind, actual.kind);
  });
  if (candidates.length === 1) {
    return { status: 'matched', actual: candidates[0], method: 'name_type' };
  }
  if (candidates.length > 1) {
    return { status: 'ambiguous', candidates };
  }
  return { status: 'unmatched_name_type' };
}

async function evaluatePrdCompleteness(markdown, options = {}, deps = {}) {
  const appType = options.appType;
  const authRef = options.authRef || {};
  const parsedPrd = parsePrdMarkdown(markdown);
  const parsedManifest = parseBuildManifest(options.buildManifest);
  const items = [];

  function addItem(id, source, status, severity, message, details = {}) {
    items.push(makeRiskItem(id, source, status, severity, message, details));
  }

  function buildResult(remoteForms = []) {
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
          resources: parsedPrd.resources.length,
        },
        buildManifest: options.buildManifest ? {
          mode: 'build_facts',
          path: options.buildManifestPath || '',
          resources: parsedManifest.resources.length,
        } : null,
      },
      summary: {
        totalItems: items.length,
        hardFailures: hardFailureItems.length,
        needsReview: reviewItems.length,
        notChecked: items.filter(item => item.status === 'not_checked').length,
        checked: {
          remoteResourceListRead: hardFailureItems.every(item => item.id !== 'app_resource_list_read_failed'),
          remoteResources: remoteForms.length,
          expectedResources: parsedManifest.resources.filter(resource => resource.required).length,
          matchedResources: 0,
          prdHintResources: parsedPrd.resources.length,
        },
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

  const fetchForms = deps.fetchForms || fetchFormPageList;
  let forms = [];
  try {
    forms = await fetchForms(appType, authRef);
  } catch (error) {
    addItem('app_resource_list_read_failed', 'remote.resource_list', 'fail', 'blocker', '目标应用资源列表读取失败，无法执行数量完整性检查', {
      expected: { appType, readable: true },
      actual: { error: error.message },
    });
    return buildResult([]);
  }

  const actualResources = forms.map(makeActualResource);
  const manifestResources = parsedManifest.resources.filter(resource => resource.required);

  if (!options.buildManifest) {
    addItem('build_manifest_missing', 'build_manifest', 'not_checked', 'info', '未提供 build-manifest.json，只能基于 PRD 资源 hints 做风险提示', {
      expected: '--build-manifest <file>',
      actual: null,
    });
  } else if (parsedManifest.resources.length === 0) {
    addItem('build_manifest_empty', 'build_manifest', 'not_checked', 'warning', 'build-manifest.json 未记录 display-page / normal-form / process-form 资源，无法确认数量完整性', {
      expected: ['display-page', 'normal-form', 'process-form'],
      actual: [],
    });
  }

  if (parsedPrd.resources.length > 0 && parsedManifest.resources.length === 0) {
    addItem('prd_resource_hints_not_checked', 'prd.resourceBlueprint', 'needs_review', 'warning', 'PRD 资源蓝图仅作为 hints，未提供结构化搭建事实源时不作为硬验收依据', {
      expected: parsedPrd.resources.map(resource => ({ name: resource.name, kind: resource.kind })),
      actual: actualResources.map(resource => ({ name: resource.name, formUuid: resource.formUuid, kind: resource.kind })),
    });
  }

  if (parsedPrd.resources.length > 0 && manifestResources.length > 0 && parsedPrd.resources.length !== manifestResources.length) {
    addItem('prd_manifest_resource_count_mismatch', 'prd.resourceBlueprint', 'needs_review', 'info', 'PRD hint 数量与 build manifest required 资源数量不一致，需人工确认是否有资源延期或合并', {
      expected: { prdHintResources: parsedPrd.resources.length },
      actual: { manifestRequiredResources: manifestResources.length },
    });
  }

  let matchedRequiredResources = 0;
  manifestResources.forEach((resource) => {
    const match = matchResource(resource, actualResources);
    if (match.status === 'matched') {
      matchedRequiredResources++;
      return;
    }

    if (match.status === 'missing_exact_id') {
      addItem('resource_missing', resource.source, 'fail', 'blocker', `build manifest 记录的必需资源 ID 未在远端列表中找到：${resource.formUuid}`, {
        expected: { name: resource.name, formUuid: resource.formUuid, kind: resource.kind },
        actual: null,
      });
      return;
    }

    if (match.status === 'type_mismatch') {
      addItem('resource_type_mismatch', resource.source, 'needs_review', 'warning', `资源 ID 已找到，但类型与 build manifest 不一致：${resource.name || resource.formUuid}`, {
        expected: { name: resource.name, formUuid: resource.formUuid, kind: resource.kind },
        actual: { name: match.actual.name, formUuid: match.actual.formUuid, kind: match.actual.kind },
      });
      return;
    }

    if (match.status === 'ambiguous') {
      addItem('resource_match_ambiguous', resource.source, 'needs_review', 'warning', `资源名称和类型匹配到多个候选，需人工确认：${resource.name}`, {
        expected: { name: resource.name, kind: resource.kind },
        actual: match.candidates.map(candidate => ({ name: candidate.name, formUuid: candidate.formUuid, kind: candidate.kind })),
      });
      return;
    }

    addItem('resource_unmatched_by_name_type', resource.source, 'needs_review', 'warning', `build manifest 只提供名称/类型，远端列表未稳定匹配：${resource.name}`, {
      expected: { name: resource.name, kind: resource.kind },
      actual: actualResources.map(actual => ({ name: actual.name, formUuid: actual.formUuid, kind: actual.kind })),
    });
  });

  if (manifestResources.length > 0 && manifestResources.length !== matchedRequiredResources) {
    addItem('resource_count_mismatch', 'build_manifest.resources', 'needs_review', 'warning', '必需资源期望数量与远端稳定匹配数量不一致', {
      expected: { requiredResources: manifestResources.length },
      actual: { matchedResources: matchedRequiredResources },
    });
  }

  const result = buildResult(forms);
  result.summary.checked.matchedResources = matchedRequiredResources;
  return result;
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
  evaluatePrdCompleteness,
  extractResources,
  loadBuildManifest,
  parseArgs,
  parseBuildManifest,
  parseMarkdownTables,
  parsePrdMarkdown,
  run,
};
