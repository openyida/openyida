#!/usr/bin/env node

'use strict';

/**
 * Generation scenario 的执行证据归一化与断言（纯函数、零远端副作用）。
 */

const { assertLoginBeforeMutation } = require('./guardrail');
const { diffSchemaSnapshots, checkExpectedSchemaDiff } = require('./schema-diff');

function asArray(value) {
  if (value === undefined || value === null) {return [];}
  return Array.isArray(value) ? value : [value];
}

function normalizeNamedItems(items = [], defaultSource = 'agent-report') {
  return asArray(items).filter(Boolean).map((item) => {
    if (typeof item === 'string') {return { name: item, source: defaultSource };}
    return { ...item, name: item.name || item.skill || item.code || null, source: item.source || defaultSource };
  });
}

function splitExpectations(expected) {
  if (Array.isArray(expected)) {return { required: expected, optional: [] };}
  if (!expected || typeof expected !== 'object') {return { required: [], optional: [] };}
  return {
    required: asArray(expected.required),
    optional: asArray(expected.optional),
  };
}

function expectationName(item, fallback) {
  if (typeof item === 'string') {return item;}
  return item && (item.name || item.skill || item.command || item.type || item.code) || fallback;
}

function checkExpectedSkills(actualSkills = [], expectedSkills) {
  const actual = new Set(normalizeNamedItems(actualSkills).map((item) => item.name).filter(Boolean));
  const groups = splitExpectations(expectedSkills);
  const checks = [];
  const check = (item, required) => {
    const name = expectationName(item, 'unknown');
    const ok = actual.has(name);
    checks.push({
      name: `skill:${name}`,
      ok,
      required,
      kind: 'skill',
      key: name,
      expectation: typeof item === 'object' && item ? { ...item } : { name },
      actualCount: ok ? 1 : 0,
      detail: ok ? '已记录' : `${required ? '缺少必需技能证据' : '未覆盖可选技能'}`,
    });
  };
  groups.required.forEach((item) => check(item, true));
  groups.optional.forEach((item) => check(item, false));
  return { pass: checks.filter((item) => item.required).every((item) => item.ok), checks };
}

function commandTokens(expected) {
  if (typeof expected === 'string') {return expected.trim().split(/\s+/).filter(Boolean);}
  if (!expected) {return [];}
  const base = expected.name || expected.command || '';
  return String(base).trim().split(/\s+/).filter(Boolean);
}

function commandMatches(command = {}, expected) {
  const args = Array.isArray(command.args) ? command.args.map(String) : [];
  const tokens = commandTokens(expected);
  if (tokens.some((token, index) => args[index] !== token)) {return false;}
  const spec = typeof expected === 'object' && expected ? expected : {};
  if (Array.isArray(spec.argsIncludes) && spec.argsIncludes.some((arg) => !args.includes(String(arg)))) {return false;}
  if (spec.successOnly !== false && command.ok === false) {return false;}
  return tokens.length > 0;
}

function checkExpectedCommands(actualCommands = [], expectedCommands) {
  const groups = splitExpectations(expectedCommands);
  const checks = [];
  const check = (item, required) => {
    const spec = typeof item === 'object' && item ? item : {};
    const minCount = Number.isFinite(spec.minCount) ? spec.minCount : 1;
    const count = actualCommands.filter((command) => commandMatches(command, item)).length;
    const label = commandTokens(item).join(' ') || 'unknown';
    const ok = count >= minCount;
    checks.push({
      name: `command:${label}`,
      ok,
      required,
      kind: 'command',
      key: label,
      expectation: typeof item === 'object' && item ? { ...item } : { name: label },
      minCount,
      actualCount: count,
      detail: `期望成功调用 ≥${minCount}，实际 ${count}`,
    });
  };
  groups.required.forEach((item) => check(item, true));
  groups.optional.forEach((item) => check(item, false));
  return { pass: checks.filter((item) => item.required).every((item) => item.ok), checks };
}

function resourceMatches(resource = {}, expected) {
  const spec = typeof expected === 'string' ? { type: expected } : (expected || {});
  if (spec.type && String(resource.type || resource.resourceType) !== String(spec.type)) {return false;}
  if (spec.name && String(resource.name || resource.label) !== String(spec.name)) {return false;}
  if (spec.nameIncludes && !String(resource.name || resource.label || '').includes(String(spec.nameIncludes))) {return false;}
  if (spec.id && String(resource.id || resource.formUuid || resource.pageId || '') !== String(spec.id)) {return false;}
  if (spec.status && String(resource.status || '') !== String(spec.status)) {return false;}
  if (spec.schemaVersion && String(resource.schemaVersion || '') !== String(spec.schemaVersion)) {return false;}
  if (spec.openUrl && String(resource.openUrl || '') !== String(spec.openUrl)) {return false;}
  if (Number.isFinite(spec.minPackageCount) && Number(resource.packageCount || 0) < spec.minPackageCount) {return false;}
  if (Number.isFinite(spec.minInstanceCount) && Number(resource.instanceCount || 0) < spec.minInstanceCount) {return false;}
  if (Number.isFinite(spec.minComponentCount) && Number(resource.componentCount || 0) < spec.minComponentCount) {return false;}
  if (Number.isFinite(spec.minChartCount) && Number(resource.chartCount || 0) < spec.minChartCount) {return false;}
  if (Number.isFinite(spec.maxUnknownCubeCount)
      && Number(resource.unknownCubeCount || 0) > spec.maxUnknownCubeCount) {return false;}
  return true;
}

function checkExpectedResources(actualResources = [], expectedResources) {
  const groups = splitExpectations(expectedResources);
  const checks = [];
  const check = (item, required) => {
    const spec = typeof item === 'object' && item ? item : {};
    const exactCount = Number.isFinite(spec.exactCount) ? spec.exactCount : null;
    const minCount = exactCount !== null ? exactCount : (Number.isFinite(spec.minCount) ? spec.minCount : 1);
    const maxCount = exactCount !== null ? exactCount : (Number.isFinite(spec.maxCount) ? spec.maxCount : null);
    const count = actualResources.filter((resource) => resourceMatches(resource, item)).length;
    const label = expectationName(item, 'resource');
    const ok = count >= minCount && (maxCount === null || count <= maxCount);
    const expectedDetail = maxCount === null
      ? `≥${minCount}`
      : (minCount === maxCount ? `=${minCount}` : `${minCount}..${maxCount}`);
    checks.push({
      name: `resource:${label}`,
      ok,
      required,
      kind: 'resource',
      key: label,
      expectation: typeof item === 'object' && item ? { ...item } : { type: label },
      minCount,
      maxCount,
      actualCount: count,
      detail: `期望 ${expectedDetail}，实际 ${count}`,
    });
  };
  groups.required.forEach((item) => check(item, true));
  groups.optional.forEach((item) => check(item, false));
  return { pass: checks.filter((item) => item.required).every((item) => item.ok), checks };
}

function findingMatches(finding, expected) {
  const actualCode = typeof finding === 'string' ? finding : finding && (finding.code || finding.name);
  const expectedCode = typeof expected === 'string' ? expected : expected && (expected.code || expected.name);
  return !!expectedCode && actualCode === expectedCode;
}

function checkForbiddenFindings(actualFindings = [], forbiddenFindings = []) {
  const checks = [];
  for (const forbidden of asArray(forbiddenFindings)) {
    const code = expectationName(forbidden, 'unknown');
    const found = actualFindings.some((finding) => findingMatches(finding, forbidden));
    checks.push({
      name: `forbidden:${code}`,
      ok: !found,
      required: true,
      kind: 'forbidden-finding',
      key: code,
      expectation: typeof forbidden === 'object' && forbidden ? { ...forbidden } : { code },
      actualCount: found ? 1 : 0,
      detail: found ? '发现禁止项' : '未发现',
    });
  }
  return { pass: checks.every((item) => item.ok), checks };
}

function deriveCommandFindings(commands = [], options = {}) {
  const findings = [];
  const loginGuard = assertLoginBeforeMutation(commands);
  if (loginGuard.status === 'fail') {
    findings.push({ code: 'resource-before-login-check', detail: loginGuard.detail, source: 'harness-cli-trace' });
  }
  for (const command of commands) {
    if (command.ok === false) {
      findings.push({
        code: 'command-failed',
        detail: `${(command.args || []).join(' ')} exited ${command.exitCode}`,
        source: 'harness-cli-trace',
      });
    }
    for (const protectedId of asArray(options.protectedResourceIds)) {
      if ((command.args || []).some((arg) => String(arg).includes(String(protectedId)))) {
        findings.push({
          code: 'protected-resource-referenced',
          detail: `命令参数引用受保护资源 ${protectedId}`,
          source: 'harness-cli-trace',
        });
      }
    }
  }
  return findings;
}

function mergeEvidence(base = {}, extra = {}) {
  const baseSnapshots = base.schemaSnapshots && typeof base.schemaSnapshots === 'object'
    ? base.schemaSnapshots : {};
  const extraSnapshots = extra.schemaSnapshots && typeof extra.schemaSnapshots === 'object'
    ? extra.schemaSnapshots : {};
  const merged = {
    skills: [...asArray(base.skills), ...asArray(extra.skills)],
    commands: [...asArray(base.commands), ...asArray(extra.commands)],
    resources: [...asArray(base.resources), ...asArray(extra.resources)],
    findings: [...asArray(base.findings), ...asArray(extra.findings)],
    sources: [...asArray(base.sources), ...asArray(extra.sources)],
    targets: [...asArray(base.targets), ...asArray(extra.targets)],
    schemaDiff: extra.schemaDiff || base.schemaDiff || null,
    schemaSnapshots: Object.keys(baseSnapshots).length || Object.keys(extraSnapshots).length
      ? { ...baseSnapshots, ...extraSnapshots }
      : null,
  };
  return merged;
}

function resourceIdentity(resource = {}) {
  const id = resource.id || resource.formUuid || resource.pageId || resource.reportId
    || resource.processCode || resource.navUuid || null;
  return id ? String(id) : String(resource.name || resource.label || resource.url || '');
}

function preferPlatformReadbackResources(resources = []) {
  const normalized = asArray(resources).filter(Boolean).map((resource) => (
    typeof resource === 'string'
      ? { type: resource, source: 'agent-report' }
      : { ...resource, source: resource.source || 'agent-report' }
  ));
  const authoritativeTypes = new Set(normalized
    .filter((resource) => resource.source === 'platform-readback')
    .map((resource) => resource.type)
    .filter(Boolean));
  const authoritativeIds = new Set(normalized
    .filter((resource) => resource.source === 'platform-readback')
    .map(resourceIdentity)
    .filter(Boolean));
  const seen = new Set();
  return normalized.filter((resource) => {
    if (resource.source !== 'platform-readback' && authoritativeIds.has(resourceIdentity(resource))) {return false;}
    if (authoritativeTypes.has(resource.type) && resource.source !== 'platform-readback') {return false;}
    const key = `${resource.type || ''}\u0000${resourceIdentity(resource)}`;
    if (seen.has(key)) {return false;}
    seen.add(key);
    return true;
  });
}

function runEvidenceCollector(collector, context) {
  if (typeof collector !== 'function') {return {};}
  try {return collector(context) || {};} catch (error) {
    return {
      findings: [{
        code: 'evidence-collector-error',
        detail: error && error.message ? error.message : String(error),
        source: 'harness-collector',
      }],
      sources: ['harness-collector'],
    };
  }
}

function buildGenerationEvidence({ scenario = {}, result = {}, agentResult = {}, extraEvidence = {} } = {}) {
  const reported = result.evidence && typeof result.evidence === 'object' ? result.evidence : {};
  const commands = Array.isArray(agentResult.commandTrace) ? agentResult.commandTrace : [];
  const targetResources = asArray(result.targets).map((target) => ({
    type: target.type || 'page',
    name: target.stage || target.type || 'page',
    url: target.url,
    source: 'generation-target',
  }));
  // 命令只能来自 harness trace / 注入式 collector，不能采信 agent 自报。
  let evidence = mergeEvidence({ ...reported, commands: [] }, {
    commands,
    resources: targetResources,
    sources: [
      ...(commands.length ? ['harness-cli-trace'] : []),
      ...(Object.keys(reported).length ? ['agent-report'] : []),
    ],
  });
  evidence = mergeEvidence(evidence, extraEvidence);

  if (!evidence.schemaDiff && evidence.schemaSnapshots && evidence.schemaSnapshots.before !== undefined
      && evidence.schemaSnapshots.after !== undefined) {
    evidence.schemaDiff = diffSchemaSnapshots(evidence.schemaSnapshots.before, evidence.schemaSnapshots.after);
  }
  evidence.findings.push(...deriveCommandFindings(evidence.commands, {
    protectedResourceIds: scenario.protectedResourceIds,
  }));
  evidence.skills = normalizeNamedItems(evidence.skills);
  evidence.resources = preferPlatformReadbackResources(evidence.resources);
  evidence.sources = [...new Set(evidence.sources.filter(Boolean))];
  return evidence;
}

function hasEvidenceExpectations(scenario = {}) {
  return ['expectedSkills', 'expectedCommands', 'expectedResources', 'forbiddenFindings', 'expectedSchemaDiff']
    .some((key) => scenario[key] !== undefined);
}

function evaluateGenerationEvidence(scenario = {}, evidence = {}) {
  const suites = [
    checkExpectedSkills(evidence.skills, scenario.expectedSkills),
    checkExpectedCommands(evidence.commands, scenario.expectedCommands),
    checkExpectedResources(evidence.resources, scenario.expectedResources),
    checkForbiddenFindings(evidence.findings, scenario.forbiddenFindings),
  ];
  if (scenario.expectedSchemaDiff !== undefined) {
    suites.push(checkExpectedSchemaDiff(evidence.schemaDiff || {}, scenario.expectedSchemaDiff || {}));
  }
  const checks = suites.flatMap((suite) => suite.checks);
  return {
    pass: !hasEvidenceExpectations(scenario) || suites.every((suite) => suite.pass),
    checks,
  };
}

module.exports = {
  asArray,
  normalizeNamedItems,
  splitExpectations,
  checkExpectedSkills,
  commandTokens,
  commandMatches,
  checkExpectedCommands,
  resourceMatches,
  checkExpectedResources,
  findingMatches,
  checkForbiddenFindings,
  deriveCommandFindings,
  mergeEvidence,
  resourceIdentity,
  preferPlatformReadbackResources,
  runEvidenceCollector,
  buildGenerationEvidence,
  hasEvidenceExpectations,
  evaluateGenerationEvidence,
};
