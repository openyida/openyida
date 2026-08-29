#!/usr/bin/env node

'use strict';

/**
 * Generation eval 的确定性平台回读。
 *
 * 仅在 scenario.readback.enabled=true 时运行；通过当前 link 的 openyida
 * 执行只读命令，把平台资源与 agent 自报证据分开记录。
 */

const { spawnSync } = require('child_process');
const { resolveCliExecutable } = require('./command-trace');

function stripAnsi(value = '') {
  const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g');
  return String(value).replace(ansiPattern, '');
}

function extractJsonValues(text = '') {
  const input = stripAnsi(text);
  const values = [];
  for (let start = 0; start < input.length; start += 1) {
    const first = input[start];
    if (first !== '{' && first !== '[') {continue;}
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let index = start; index < input.length; index += 1) {
      const ch = input[index];
      if (inString) {
        if (escaped) {escaped = false;}
        else if (ch === '\\') {escaped = true;}
        else if (ch === '"') {inString = false;}
        continue;
      }
      if (ch === '"') {inString = true; continue;}
      if (ch === '{' || ch === '[') {stack.push(ch); continue;}
      if (ch === '}' || ch === ']') {
        const expected = ch === '}' ? '{' : '[';
        if (stack.pop() !== expected) {break;}
        if (stack.length === 0) {
          try {values.push(JSON.parse(input.slice(start, index + 1)));} catch { /* ignore */ }
          start = index;
          break;
        }
      }
    }
  }
  return values;
}

function extractLastJsonValue(text = '') {
  const values = extractJsonValues(text);
  return values.length ? values[values.length - 1] : null;
}

function runJsonCommand(cliPath, args, options = {}) {
  const spawn = options.spawn || spawnSync;
  let result;
  try {
    result = spawn(cliPath, args, {
      cwd: options.cwd || process.cwd(),
      encoding: 'utf8',
      timeout: options.timeoutMs || 60000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, ...(options.env || {}), YIDA_QUIET: '1' },
    });
  } catch (error) {
    return { ok: false, value: null, error: error.message, args };
  }
  const value = extractLastJsonValue(result.stdout || '');
  return {
    ok: result.status === 0 && value !== null,
    value,
    error: result.status === 0 ? (value === null ? 'JSON output missing' : null) : (result.stderr || `exit ${result.status}`),
    args,
  };
}

function normalizeFormType(type) {
  if (type === 'receipt') {return 'form';}
  if (type === 'display') {return 'page';}
  return type || 'form';
}

function normalizePlatformResourceId(value) {
  return String(value || '').replace(/^FORM[-_]/, 'FORM_').replace(/[^a-zA-Z0-9_]/g, '_');
}

function reportInspectMetadata(inspect = {}, knownFormIds = []) {
  const components = Array.isArray(inspect.components) ? inspect.components : [];
  const layout = Array.isArray(inspect.layout) ? inspect.layout : [];
  const cubeCodes = [...new Set(components.flatMap((component) => (
    Array.isArray(component && component.cubeCodes) ? component.cubeCodes : []
  )).filter(Boolean).map(String))];
  const known = new Set(knownFormIds.map(normalizePlatformResourceId));
  const unknownCubeCodes = cubeCodes.filter((code) => !known.has(normalizePlatformResourceId(code)));
  return {
    schemaVersion: inspect.schemaVersion || null,
    componentCount: Number.isFinite(inspect.componentCount) ? inspect.componentCount : components.length,
    chartCount: components.filter((component) => /Chart|Funnel|Calendar|Indicator|Metric/i.test(
      String(component && component.componentName || ''),
    )).length || layout.length,
    layoutCount: layout.length,
    cubeCodes,
    unknownCubeCodes,
    unknownCubeCount: unknownCubeCodes.length,
  };
}

function dataInstanceCount(query = {}) {
  if (Number.isFinite(query.totalCount)) {return query.totalCount;}
  if (query.content && Number.isFinite(query.content.totalCount)) {return query.content.totalCount;}
  if (Array.isArray(query.data)) {return query.data.length;}
  if (query.content && Array.isArray(query.content.data)) {return query.content.data.length;}
  return 0;
}

function flattenNavGroups(nodes = [], out = []) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== 'object') {continue;}
    if (node.type === 'group' || node.navType === 'NAV') {out.push(node);}
    flattenNavGroups(node.children, out);
  }
  return out;
}

function collectOpenYidaReadback(context = {}, options = {}) {
  const scenario = context.scenario || {};
  const config = scenario.readback && typeof scenario.readback === 'object' ? scenario.readback : {};
  if (config.enabled !== true) {return {};}

  const appType = config.appType || (context.result && context.result.appType);
  const cliPath = options.cliPath || resolveCliExecutable('openyida');
  if (!appType || !cliPath) {
    return {
      resources: [], targets: [], sources: ['platform-readback'],
      findings: [{
        code: 'platform-readback-unavailable',
        detail: !appType ? 'appType missing' : 'openyida executable missing',
        source: 'platform-readback',
      }],
    };
  }

  const phase = context.phase || 'after';
  const resources = phase === 'before'
    ? []
    : [{ type: 'app', id: appType, name: appType, source: 'platform-readback' }];
  const targets = [];
  const findings = [];
  const baseUrl = String(config.baseUrl || 'https://www.aliwork.com').replace(/\/$/, '');
  const run = (args) => {
    const result = runJsonCommand(cliPath, args, options);
    if (!result.ok) {
      findings.push({
        code: 'platform-readback-failed',
        detail: `${args.join(' ')}: ${String(result.error || 'unknown').trim().slice(0, 300)}`,
        source: 'platform-readback',
      });
    }
    return result.value;
  };

  const forms = run(['list-forms', appType]);
  const formsByName = new Map();
  const reportResources = [];
  const knownFormIds = [];
  for (const form of Array.isArray(forms) ? forms : []) {
    if (!form || !form.formUuid) {continue;}
    const type = normalizeFormType(form.formType);
    const resource = {
      type,
      id: form.formUuid,
      name: form.formName || form.formUuid,
      source: 'platform-readback',
    };
    if (phase !== 'before') {resources.push(resource);}
    knownFormIds.push(resource.id);
    if (phase !== 'before' && type === 'report') {reportResources.push(resource);}
    const sameNameResources = formsByName.get(resource.name) || [];
    sameNameResources.push(resource);
    formsByName.set(resource.name, sameNameResources);
    if (phase !== 'before' && (type === 'page' || type === 'report')) {
      targets.push({
        stage: type,
        type,
        id: resource.id,
        name: resource.name,
        url: `${baseUrl}/${appType}/workbench/${form.formUuid}`,
        source: 'platform-readback',
      });
    }
  }

  const findNamedResource = (name, acceptedTypes = []) => {
    const candidates = formsByName.get(name) || [];
    if (!acceptedTypes.length) {return candidates[0];}
    return candidates.find((candidate) => acceptedTypes.includes(candidate.type));
  };

  const pageRuntimeConfig = config.pageRuntime && typeof config.pageRuntime === 'object'
    ? config.pageRuntime
    : {};
  if (phase !== 'before' && pageRuntimeConfig.enabled === true) {
    const defaults = pageRuntimeConfig.defaults && typeof pageRuntimeConfig.defaults === 'object'
      ? pageRuntimeConfig.defaults
      : {};
    const byName = pageRuntimeConfig.byName && typeof pageRuntimeConfig.byName === 'object'
      ? pageRuntimeConfig.byName
      : {};
    for (const target of targets.filter((item) => item.type === 'page')) {
      const page = Array.from(formsByName.values()).flat()
        .find((resource) => resource.type === 'page' && resource.id === target.id);
      target.runtimeExpectations = { ...defaults, ...((page && byName[page.name]) || {}) };
    }
  }

  const schemaSnapshot = { resources: [] };
  for (const name of Array.isArray(config.schemaSnapshotForms) ? config.schemaSnapshotForms : []) {
    const form = findNamedResource(name, ['form', 'process']);
    if (!form) {
      findings.push({
        code: 'platform-readback-schema-form-missing',
        detail: `${name} not found in ${appType}`,
        source: 'platform-readback',
      });
      continue;
    }
    const schema = run(['get-schema', appType, form.id, '--summary-json']);
    if (schema) {
      for (const field of Array.isArray(schema.fields) ? schema.fields : []) {
        schemaSnapshot.resources.push({
          ...field,
          type: `${form.id}/field`,
          formUuid: form.id,
          formName: name,
        });
      }
    }
  }
  if (phase === 'before') {
    return {
      resources,
      targets,
      findings,
      sources: ['platform-readback'],
      schemaSnapshots: { before: schemaSnapshot },
    };
  }

  if (config.reportInspect === true) {
    for (const report of reportResources) {
      const inspect = run(['report', 'inspect', appType, report.id, '--json']);
      if (inspect && inspect.success !== false) {
        Object.assign(report, reportInspectMetadata(inspect, knownFormIds));
      }
    }
  }

  for (const name of Array.isArray(config.portalNames) ? config.portalNames : []) {
    const page = findNamedResource(name, ['page']);
    if (page) {
      resources.push({ ...page, type: 'portal' });
    }
  }

  const integrations = run(['integration', 'list', appType, '--json']);
  for (const item of Array.isArray(integrations) ? integrations : []) {
    if (!item || !item.processCode) {continue;}
    resources.push({
      type: 'integration', id: item.processCode, name: item.name || item.processCode,
      status: item.status || null, source: 'platform-readback',
    });
  }

  const nav = run(['nav-group', 'list', appType]);
  for (const group of flattenNavGroups(nav && nav.tree)) {
    resources.push({
      type: 'nav', id: group.navUuid || group.id, name: group.name || group.navUuid,
      source: 'platform-readback',
    });
  }

  const i18n = run(['i18n', 'overview', appType]);
  const languages = i18n && i18n.config && i18n.config.languageList;
  for (const language of Array.isArray(languages) ? languages : []) {
    if (!language || language.enabled !== true || !language.languageTag) {continue;}
    resources.push({
      type: 'i18n', id: language.languageTag,
      name: language.languageName || language.languageTag,
      source: 'platform-readback',
    });
  }

  for (const name of Array.isArray(config.permissionFormNames) ? config.permissionFormNames : []) {
    const form = findNamedResource(name, ['form', 'process']);
    if (!form) {continue;}
    const permission = run(['get-permission', appType, form.id]);
    if (permission) {
      const packages = Array.isArray(permission.permissions)
        ? permission.permissions
        : (Array.isArray(permission.permissionGroupList) ? permission.permissionGroupList : []);
      resources.push({
        type: 'permission', id: form.id, name,
        packageCount: Number.isFinite(permission.totalPackages) ? permission.totalPackages : packages.length,
        packageNames: packages.map((item) => item && (item.packageName || item.name)).filter(Boolean),
        source: 'platform-readback',
      });
    }
  }

  for (const name of Array.isArray(config.dataPresenceFormNames) ? config.dataPresenceFormNames : []) {
    const form = findNamedResource(name, ['form', 'process']);
    if (!form) {
      findings.push({
        code: 'platform-readback-data-form-missing',
        detail: `${name} not found in ${appType}`,
        source: 'platform-readback',
      });
      continue;
    }
    const queryType = form.type === 'process' ? 'process' : 'form';
    const query = run(['data', 'query', queryType, appType, form.id, '--page', '1', '--size', '1']);
    if (query) {
      resources.push({
        type: 'sample-data', id: form.id, name,
        instanceCount: dataInstanceCount(query),
        source: 'platform-readback',
      });
    }
  }

  for (const name of Array.isArray(config.sharePageNames) ? config.sharePageNames : []) {
    const page = findNamedResource(name, ['page']);
    if (!page) {continue;}
    const share = run(['get-page-config', appType, page.id]);
    if (share && share.isOpen === true && share.openUrl) {
      resources.push({
        type: 'page-config', id: page.id, name,
        openUrl: share.openUrl, source: 'platform-readback',
      });
    }
  }

  return {
    resources, targets, findings, sources: ['platform-readback'],
    ...(config.schemaSnapshotForms ? { schemaSnapshots: { after: schemaSnapshot } } : {}),
  };
}

module.exports = {
  stripAnsi,
  extractJsonValues,
  extractLastJsonValue,
  runJsonCommand,
  normalizeFormType,
  normalizePlatformResourceId,
  reportInspectMetadata,
  dataInstanceCount,
  flattenNavGroups,
  collectOpenYidaReadback,
};
