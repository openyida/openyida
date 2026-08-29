#!/usr/bin/env node

'use strict';

/**
 * 把 generation 的机器断言转换为可执行的 OpenYida 优化 backlog。
 *
 * 归因必须保守：差异本身可以 confirmed，但没有确定性重放时，
 * CLI / skill 根因只能标 inferred 或 unknown。
 */

const RESOURCE_COMMANDS = Object.freeze({
  app: [['create-app']],
  form: [['create-form', 'create']],
  process: [['create-process']],
  page: [['create-page'], ['publish']],
  portal: [['create-page'], ['publish']],
  dashboard: [['create-page'], ['publish'], ['create-report']],
  report: [['create-report']],
  integration: [['integration', 'create']],
  permission: [['save-permission']],
  'app-permission': [['app-permission']],
  i18n: [['i18n']],
  nav: [['nav-group']],
  'page-config': [['save-share-config']],
  'sample-data': [['data', 'create']],
});

const RESOURCE_TARGETS = Object.freeze({
  app: {
    skills: ['yida-app', 'yida-create-app'], commands: ['openyida create-app'],
    files: ['yida-skills/skills/yida-app/SKILL.md', 'yida-skills/skills/yida-create-app/SKILL.md', 'lib/app/create-app.js'],
  },
  form: {
    skills: ['yida-create-form-page'], commands: ['openyida create-form create', 'openyida get-schema'],
    files: ['yida-skills/skills/yida-create-form-page/SKILL.md', 'lib/app/create-form.js', 'lib/app/get-schema.js'],
  },
  process: {
    skills: ['yida-create-process', 'yida-process-rule'], commands: ['openyida create-process', 'openyida configure-process'],
    files: ['yida-skills/skills/yida-create-process/SKILL.md', 'lib/process/create-process.js', 'lib/process/configure-process.js'],
  },
  page: {
    skills: ['yida-create-page', 'yida-canvas-custom-page', 'yida-publish-page'],
    commands: ['openyida create-page', 'openyida publish'],
    files: ['yida-skills/skills/yida-canvas-custom-page/SKILL.md', 'yida-skills/skills/yida-publish-page/SKILL.md', 'lib/app/publish.js'],
  },
  portal: {
    skills: ['yida-create-page', 'yida-canvas-custom-page', 'yida-publish-page'],
    commands: ['openyida create-page', 'openyida publish'],
    files: ['yida-skills/skills/yida-canvas-custom-page/SKILL.md', 'lib/app/create-page.js', 'lib/app/publish.js'],
  },
  dashboard: {
    skills: ['yida-dashboard', 'yida-report'], commands: ['openyida create-report', 'openyida publish'],
    files: ['yida-skills/skills/yida-dashboard/SKILL.md', 'yida-skills/skills/yida-report/SKILL.md', 'lib/report/create-report.js'],
  },
  report: {
    skills: ['yida-report'], commands: ['openyida create-report', 'openyida report inspect'],
    files: ['yida-skills/skills/yida-report/SKILL.md', 'lib/report/create-report.js', 'lib/report/inspect.js'],
  },
  integration: {
    skills: ['yida-integration'], commands: ['openyida integration create', 'openyida integration list', 'openyida integration check'],
    files: ['yida-skills/skills/yida-integration/SKILL.md', 'lib/integration/integration-create.js', 'lib/integration/integration-list.js'],
  },
  permission: {
    skills: ['yida-form-permission'], commands: ['openyida save-permission', 'openyida get-permission'],
    files: ['yida-skills/skills/yida-form-permission/SKILL.md', 'lib/permission/save-permission.js', 'lib/permission/get-permission.js'],
  },
  'app-permission': {
    skills: ['yida-app-permission'], commands: ['openyida app-permission'],
    files: ['yida-skills/skills/yida-app-permission/SKILL.md', 'lib/app-permission/app-permission.js'],
  },
  i18n: {
    skills: ['yida-i18n'], commands: ['openyida i18n'],
    files: ['yida-skills/skills/yida-i18n/SKILL.md', 'lib/i18n-management/i18n-management.js'],
  },
  nav: {
    skills: ['yida-nav-group'], commands: ['openyida nav-group'],
    files: ['yida-skills/skills/yida-nav-group/SKILL.md', 'lib/app/nav-group.js'],
  },
  'page-config': {
    skills: ['yida-page-config'], commands: ['openyida save-share-config', 'openyida get-page-config'],
    files: ['yida-skills/skills/yida-page-config/SKILL.md', 'lib/page-config/save-share-config.js', 'lib/page-config/get-page-config.js'],
  },
  'sample-data': {
    skills: ['yida-app', 'yida-data-management'],
    commands: ['openyida data create form', 'openyida data query form', 'openyida data create process', 'openyida data query process'],
    files: ['yida-skills/skills/yida-app/workflow/step-5-seed-records.md', 'yida-skills/skills/yida-data-management/SKILL.md', 'lib/core/query-data.js'],
  },
});

const OWNER_TARGETS = Object.freeze({
  'skill-routing': { files: ['yida-skills/SKILL.md', 'scripts/eval/routing.js'] },
  'skill-guidance': { skills: ['yida-app'], files: ['yida-skills/skills/yida-app/SKILL.md'] },
  'agent-runtime': { files: ['scripts/eval/agent.js', 'scripts/eval/generate.js'] },
  'agent-output-contract': {
    skills: ['yida-app'],
    files: ['yida-skills/skills/yida-app/workflow/step-9-output-finish.md', 'scripts/eval/generate.js'],
  },
  'agent-command-planning': {
    skills: ['yida-app'], commands: ['openyida agent-capabilities'],
    files: ['yida-skills/skills/yida-app/SKILL.md', 'lib/core/agent-capabilities.js'],
  },
  'cli-discoverability': { files: ['lib/core/command-manifest.js', 'bin/yida.js'] },
  'cli-capability-gap': { files: ['lib/core/command-manifest.js'] },
  'eval-readback': { files: ['scripts/eval/openyida-readback.js', 'scripts/eval/evidence.js'] },
  idempotency: { files: ['scripts/eval/schema-diff.js'] },
  safety: {
    skills: ['yida-login', 'yida-app'], commands: ['openyida login --check-only --json'],
    files: ['scripts/eval/guardrail.js', 'yida-skills/skills/yida-login/SKILL.md'],
  },
  'page-delivery': {
    skills: ['yida-canvas-custom-page', 'yida-publish-page'], commands: ['openyida publish'],
    files: ['yida-skills/skills/yida-canvas-custom-page/SKILL.md', 'yida-skills/skills/yida-publish-page/SKILL.md'],
  },
  'test-data': RESOURCE_TARGETS['sample-data'],
  'browser-runtime': {
    skills: ['yida-canvas-custom-page', 'yida-canvas-data-binding'],
    commands: ['openyida check-page', 'openyida compile', 'openyida publish'],
    files: ['scripts/eval/screenshot.js', 'yida-skills/skills/yida-canvas-data-binding/SKILL.md'],
  },
  unattributed: { files: ['scripts/eval/trace-openyida.js', 'scripts/eval/replay-generation.js'] },
});

const CAPABILITY_TARGETS = Object.freeze({
  'page-sharing': RESOURCE_TARGETS['page-config'],
  reports: RESOURCE_TARGETS.report,
  automation: RESOURCE_TARGETS.integration,
  integration: RESOURCE_TARGETS.integration,
  'automation-advanced-branches': RESOURCE_TARGETS.integration,
  'i18n-english-labels': RESOURCE_TARGETS.i18n,
  'role-based-permissions': mergeTargets(RESOURCE_TARGETS.permission, RESOURCE_TARGETS['app-permission']),
});

const SUGGESTIONS = Object.freeze({
  'skill-routing': ['yida-skills/SKILL.md', '修正意图路由或必需子技能选择，并增加 routing 回归用例'],
  'skill-guidance': ['yida-app / 对应子技能', '增加 PRD 逐项核销、失败恢复和最终 readback 要求'],
  'agent-runtime': ['scripts/eval/agent.js', '保留超时/不可用证据并检查 agent 执行稳定性'],
  'agent-output-contract': ['scripts/eval/generate.js / 生成结果契约', '要求最终结果携带实际技能、资源、缺口和 trace 完整性证据'],
  'agent-command-planning': ['yida-app / 命令能力发现', '先读取 agent-capabilities 或命令契约，失败后按结构化 usage 修正参数并停止盲试'],
  'cli-discoverability': ['命令 manifest / CLI help', '让 openyida <command> --help 稳定输出正确用法并以退出码 0 结束'],
  'cli-capability-gap': ['命令 manifest / lib 业务模块', '补齐缺失命令或明确 capability-gap 契约'],
  'cli-or-input-contract': ['对应 CLI 命令与技能参数契约', '用相同参数做确定性重放，区分 CLI 缺陷与 agent 输入错误'],
  'cli-false-success': ['对应 CLI 成功判定与写后读', '成功返回后增加平台 readback 和结构指纹校验'],
  'eval-readback': ['scripts/eval/openyida-readback.js', '扩展平台回读范围或修正资源归一化'],
  idempotency: ['对应 CLI patch/update 与 schema-diff', '增加稳定资源键、重复执行和最大变化数回归'],
  safety: ['scripts/eval/guardrail.js / 技能安全边界', '阻断违规命令并增加红线回归'],
  'platform-api': ['宜搭平台 API / OpenYida 重试策略', '保存原始状态码和 request evidence，确认平台限制或瞬态错误'],
  'page-delivery': ['yida-canvas-custom-page / yida-publish-page', '增加逐页真实数据、运行时和浏览器验收'],
  'test-data': ['CRM 测试数据与页面查询前置条件', '先补齐 CRM 关联数据和页面可见性；只有完整 trace 或确定性重放指向技能/CLI 时再转为 OpenYida 优化'],
  'browser-runtime': ['scripts/eval/screenshot.js / 页面运行时', '修复页面加载、破图或前端异常，并保留逐页浏览器回归'],
  unattributed: ['OpenYida 诊断探针', '审计只确认了应用差异；用原始构建 trace 或确定性 CLI 重放后再归因'],
});

const EVIDENCE_FINDING_RULES = Object.freeze({
  'resource-before-login-check': {
    owner: 'safety', confidence: 'high', status: 'confirmed', severity: 'P0', title: '资源写入发生在登录校验之前',
  },
  'protected-resource-referenced': {
    owner: 'safety', confidence: 'high', status: 'confirmed', severity: 'P0', title: '命令引用了受保护资源',
  },
  'command-failed': {
    owner: 'cli-or-input-contract', confidence: 'medium', status: 'inferred', severity: 'P1', title: 'OpenYida 命令执行失败',
  },
  'evidence-collector-error': {
    owner: 'eval-readback', confidence: 'high', status: 'confirmed', severity: 'P1', title: '验收证据采集器异常',
  },
  'platform-readback-unavailable': {
    owner: 'eval-readback', confidence: 'high', status: 'confirmed', severity: 'P1', title: '平台回读不可用',
  },
  'platform-readback-failed': {
    owner: 'eval-readback', confidence: 'low', status: 'unknown', severity: 'P1', title: '平台回读命令失败',
  },
  'platform-readback-schema-form-missing': {
    owner: 'eval-readback', confidence: 'low', status: 'unknown', severity: 'P1', title: 'Schema 回读目标不存在',
  },
  'platform-readback-data-form-missing': {
    owner: 'eval-readback', confidence: 'low', status: 'unknown', severity: 'P1', title: '种子数据回读目标不存在',
  },
  'page-visible-data-missing': {
    owner: 'test-data', confidence: 'high', status: 'confirmed', severity: 'P1', title: '页面未展示冷启动业务数据',
  },
  'browser-runtime-signal-failed': {
    owner: 'browser-runtime', confidence: 'high', status: 'confirmed', severity: 'P1', title: '页面运行时健康检查失败',
  },
});

function asArray(value) {
  if (value === undefined || value === null) {return [];}
  return Array.isArray(value) ? value : [value];
}

function commandStartsWith(command = {}, tokens = []) {
  const args = Array.isArray(command.args) ? command.args.map(String) : [];
  return tokens.length > 0 && tokens.every((token, index) => args[index] === token);
}

function commandAttempts(commands = [], prefixes = []) {
  return asArray(commands).filter((command) => prefixes.some((prefix) => commandStartsWith(command, prefix)));
}

function expectedSeverity(check = {}) {
  const severity = check.expectation && check.expectation.severity;
  if (severity) {return severity;}
  if (check.kind === 'forbidden-finding') {return 'P0';}
  if (check.kind === 'schema-diff') {return 'P1';}
  if (check.kind === 'resource' || check.kind === 'command') {return 'P1';}
  return 'P2';
}

function uniqueStrings(values = []) {
  return [...new Set(asArray(values).filter(Boolean).map(String))];
}

function mergeTargets(...items) {
  return {
    skills: uniqueStrings(items.flatMap((item) => item && item.skills || [])),
    commands: uniqueStrings(items.flatMap((item) => item && item.commands || [])),
    files: uniqueStrings(items.flatMap((item) => item && item.files || [])),
  };
}

function targetForCommand(command = '') {
  const normalized = String(command || '').replace(/^openyida\s+/, '').trim();
  if (!normalized) {return {};}
  const matches = Object.values(RESOURCE_TARGETS).filter((target) => target.commands.some((candidate) => {
    const targetCommand = candidate.replace(/^openyida\s+/, '');
    return targetCommand.startsWith(normalized) || normalized.startsWith(targetCommand);
  }));
  return mergeTargets(...matches, { commands: [`openyida ${normalized}`] });
}

function optimizationTargets({ owner, check = {}, finding = {} } = {}) {
  const expectation = check.expectation || {};
  const resourceType = check.kind === 'resource' ? expectation.type : null;
  const skillName = check.kind === 'skill' ? (expectation.name || check.key) : null;
  const commandName = check.kind === 'command'
    ? (expectation.name || expectation.command || check.key)
    : (finding.code === 'command-failed' ? commandFamilyFromArgs(failedCommandParts(finding.detail)) : null);
  let capabilityTarget = {};
  if (String(finding.code || '').startsWith('capability-gap:')) {
    const area = String(finding.code).slice('capability-gap:'.length);
    capabilityTarget = CAPABILITY_TARGETS[area] || {};
  }
  return mergeTargets(
    OWNER_TARGETS[owner],
    RESOURCE_TARGETS[resourceType],
    skillName ? {
      skills: [skillName],
      files: [`yida-skills/skills/${skillName.replace(/^openyida:/, '')}/SKILL.md`],
    } : null,
    commandName ? targetForCommand(commandName) : null,
    capabilityTarget,
  );
}

function optimizationScope(owner, status = 'confirmed') {
  if (status === 'resolved') {return 'resolved';}
  if (owner === 'unattributed' || owner === 'test-data') {return 'application-gap';}
  if (owner === 'cli-or-input-contract' || owner === 'cli-false-success' || owner === 'platform-api') {
    return 'diagnostic';
  }
  return 'openyida-optimization';
}

function targetFields(owner, context = {}, status = 'confirmed') {
  const scope = optimizationScope(owner, status);
  const affected = optimizationTargets({ owner, ...context });
  const empty = { skills: [], commands: [], files: [] };
  return {
    scope,
    affected,
    targets: scope === 'openyida-optimization' ? affected : empty,
    diagnosticTargets: scope === 'diagnostic' ? affected : empty,
  };
}

function suggestionFor(owner) {
  const [area, action] = SUGGESTIONS[owner] || ['OpenYida 待诊断', '补充最小复现后再确定实现落点'];
  return { area, action };
}

function authoritativeReadback(evidence = {}) {
  return asArray(evidence.sources).includes('platform-readback')
    || asArray(evidence.resources).some((resource) => resource && resource.source === 'platform-readback');
}

function inferResourceAttribution(check, evidence = {}, scenario = {}) {
  const expectation = check.expectation || {};
  const resourceType = expectation.type || check.key;
  const allAttempts = commandAttempts(evidence.commands, RESOURCE_COMMANDS[resourceType] || []);
  const attempts = expectation.name
    ? allAttempts.filter((command) => asArray(command.args).some((arg) => String(arg).includes(String(expectation.name))))
    : allAttempts;
  const successful = attempts.filter((command) => command.ok !== false);
  const failed = attempts.filter((command) => command.ok === false);
  const hasReadback = authoritativeReadback(evidence);
  const partialReplay = scenario.diagnostics && scenario.diagnostics.mode === 'replay'
    && scenario.diagnostics.traceCompleteness !== 'full';

  if (scenario.diagnostics && scenario.diagnostics.mode === 'audit') {
    return {
      owner: 'unattributed', confidence: 'low',
      reason: '只读审计确认了资源差异，但本次没有构建写命令，不能据此归因技能或 CLI',
      attempts,
    };
  }

  if (resourceType === 'sample-data' && hasReadback) {
    return {
      owner: 'test-data', confidence: 'high',
      reason: `平台已完成种子数据回读，但「${expectation.name || '目标业务表'}」实例数未满足验收要求`,
      attempts,
    };
  }

  if (check.maxCount !== null && check.maxCount !== undefined && check.actualCount > check.maxCount) {
    return {
      owner: 'idempotency', confidence: hasReadback ? 'high' : 'medium',
      reason: `平台存在 ${check.actualCount} 个匹配资源，超过允许上限 ${check.maxCount}`,
      attempts,
    };
  }
  if (failed.length) {
    return {
      owner: 'cli-or-input-contract', confidence: 'medium',
      reason: `发现 ${failed.length} 次相关 CLI 失败；需确定性重放区分命令缺陷与 agent 输入错误`,
      attempts,
    };
  }
  if (partialReplay && attempts.length < (check.minCount || 1)) {
    return {
      owner: 'unattributed', confidence: 'low',
      reason: `归档 trace 标记为 partial，仅观察到 ${attempts.length} 次相关尝试，不能证明构建阶段遗漏`,
      attempts,
    };
  }
  if (successful.length >= (check.minCount || 1) && hasReadback) {
    return {
      owner: 'cli-false-success', confidence: 'medium',
      reason: `相关写命令成功 ${successful.length} 次，但平台回读未满足资源契约`,
      attempts,
    };
  }
  if (attempts.length < (check.minCount || 1)) {
    return {
      owner: 'skill-guidance', confidence: 'high',
      reason: `资源缺口已回读，但相关 CLI 尝试仅 ${attempts.length} 次`,
      attempts,
    };
  }
  return {
    owner: hasReadback ? 'skill-guidance' : 'eval-readback',
    confidence: hasReadback ? 'medium' : 'low',
    reason: hasReadback ? '平台资源契约未满足，现有证据不足以确认 CLI 根因' : '缺少平台权威回读，无法确认资源差异',
    attempts,
  };
}

function inferCheckAttribution(check = {}, evidence = {}, scenario = {}) {
  if (check.kind === 'resource') {return inferResourceAttribution(check, evidence, scenario);}
  if (check.kind === 'skill') {
    const hasSkillEvidence = asArray(evidence.skills).length > 0;
    return hasSkillEvidence
      ? { owner: 'skill-routing', confidence: 'medium', reason: '必需技能没有出现在最终技能证据中', attempts: [] }
      : { owner: 'agent-output-contract', confidence: 'high', reason: '最终结果未提供任何可验证技能使用证据', attempts: [] };
  }
  if (check.kind === 'command') {
    const tokens = String(check.key || '').split(/\s+/).filter(Boolean);
    const attempts = commandAttempts(evidence.commands, [tokens]);
    const failed = attempts.filter((command) => command.ok === false);
    if (failed.length) {
      return { owner: 'cli-or-input-contract', confidence: 'medium', reason: '目标命令已尝试但执行失败，需确定性重放', attempts };
    }
    const partialReplay = scenario.diagnostics && scenario.diagnostics.mode === 'replay'
      && scenario.diagnostics.traceCompleteness !== 'full';
    return partialReplay
      ? { owner: 'unattributed', confidence: 'low', reason: '归档 trace 不完整，不能证明目标命令未执行', attempts }
      : { owner: 'skill-guidance', confidence: 'high', reason: '场景要求的命令没有被 agent 成功执行', attempts };
  }
  if (check.kind === 'forbidden-finding') {
    return { owner: 'safety', confidence: 'high', reason: `命中安全红线 ${check.key}`, attempts: [] };
  }
  if (String(check.name || '').startsWith('schemaDiff:')) {
    return { owner: 'idempotency', confidence: 'high', reason: 'before/after Schema diff 违反变更契约', attempts: [] };
  }
  if (String(check.name || '').startsWith('targetType:') || check.name === 'minTargets') {
    return { owner: 'page-delivery', confidence: 'medium', reason: '生成结果或平台回读缺少要求的可交付目标', attempts: [] };
  }
  return { owner: 'skill-guidance', confidence: 'low', reason: '断言失败，尚无更具体诊断证据', attempts: [] };
}

function compactCommand(command = {}) {
  return {
    args: asArray(command.args).map(String),
    exitCode: command.exitCode,
    ok: command.ok !== false,
    source: command.source || 'harness-cli-trace',
  };
}

function findingFromCheck({ scenario = {}, check = {}, evidence = {}, index = 0, category = 'acceptance' }) {
  const attribution = inferCheckAttribution(check, evidence, scenario);
  const expectation = check.expectation || {};
  const requirementId = expectation.requirementId || `${scenario.id || 'scenario'}:${check.name || index + 1}`;
  const confirmed = check.kind === 'resource' && authoritativeReadback(evidence)
    || check.kind === 'forbidden-finding'
    || String(check.name || '').startsWith('schemaDiff:');
  const targetInfo = targetFields(attribution.owner, { check }, confirmed ? 'confirmed' : 'inferred');
  return {
    findingId: `OPT-${String(scenario.id || 'scenario').replace(/[^a-zA-Z0-9_-]+/g, '-')}-${index + 1}`,
    scenarioId: scenario.id || null,
    requirementId,
    category,
    title: `未满足 ${check.name || '验收断言'}`,
    severity: expectedSeverity(check),
    status: confirmed ? 'confirmed' : 'inferred',
    expected: expectation,
    actual: {
      count: check.actualCount,
      detail: check.detail || '',
    },
    evidence: {
      check: check.name || null,
      sources: asArray(evidence.sources),
      commands: asArray(attribution.attempts).map(compactCommand),
    },
    attribution: {
      owner: attribution.owner,
      confidence: attribution.confidence,
      reason: attribution.reason,
    },
    ...targetInfo,
    suggestedChange: suggestionFor(attribution.owner),
    regression: { assertion: check.name || null },
  };
}

function findingFromRuntime({ scenario = {}, status, error, index = 0 }) {
  const owner = status === 'agent-unavailable' || status === 'agent-error' ? 'agent-runtime' : 'page-delivery';
  const targetInfo = targetFields(owner, {}, 'confirmed');
  return {
    findingId: `OPT-${String(scenario.id || 'scenario').replace(/[^a-zA-Z0-9_-]+/g, '-')}-${index + 1}`,
    scenarioId: scenario.id || null,
    requirementId: `${scenario.id || 'scenario'}:runtime`,
    category: 'runtime',
    title: status === 'no-output' ? 'Agent 未产出可验证目标' : `Agent 运行状态异常：${status}`,
    severity: status === 'agent-unavailable' ? 'P2' : 'P1',
    status: 'confirmed',
    expected: { status: 'ok' },
    actual: { status, error: error || null },
    evidence: { check: status, sources: ['agent-runner'], commands: [] },
    attribution: { owner, confidence: 'high', reason: error || status },
    ...targetInfo,
    suggestedChange: suggestionFor(owner),
    regression: { assertion: `generationStatus:${status}` },
  };
}

function evidenceFindingRule(code = '') {
  if (EVIDENCE_FINDING_RULES[code]) {return EVIDENCE_FINDING_RULES[code];}
  if (String(code).startsWith('capability-gap:')) {
    return {
      owner: 'cli-capability-gap', confidence: 'low', status: 'inferred', severity: 'P1',
      title: `Agent 报告能力缺口：${String(code).slice('capability-gap:'.length)}`,
    };
  }
  return {
    owner: 'unattributed', confidence: 'low', status: 'unknown', severity: 'P2',
    title: `诊断证据：${code || 'unknown'}`,
  };
}

function failedCommandParts(detail = '') {
  const commandText = String(detail).split(/\s+exited\s+/)[0].trim();
  return commandText.split(/\s+/).filter(Boolean);
}

function commandFamilyFromArgs(args = []) {
  const tokens = asArray(args).map(String);
  if (!tokens.length) {return 'unknown';}
  const twoTokenRoots = new Set(['data', 'integration', 'nav-group', 'report', 'process', 'i18n', 'app-permission']);
  return twoTokenRoots.has(tokens[0]) && tokens[1] ? `${tokens[0]} ${tokens[1]}` : tokens[0];
}

function classifyCommandFailure(normalized = {}, evidence = {}) {
  const args = failedCommandParts(normalized.detail);
  if (args.includes('--help')) {
    return {
      owner: 'cli-discoverability', confidence: 'high', status: 'confirmed', severity: 'P2',
      title: 'CLI help / 命令发现失败',
      reason: `${commandFamilyFromArgs(args)} --help 以失败退出码结束`,
    };
  }
  const family = commandFamilyFromArgs(args);
  const recovered = asArray(evidence.commands).some((command) => command && command.ok !== false
    && commandFamilyFromArgs(command.args) === family);
  if (recovered) {
    return {
      owner: 'agent-command-planning', confidence: 'high', status: 'inferred', severity: 'P2',
      title: `${family} 首次参数错误后恢复`,
      reason: `同一 trace 中 ${family} 后续成功，优先检查 agent 参数规划与技能示例`,
    };
  }
  return { ...EVIDENCE_FINDING_RULES['command-failed'], reason: normalized.detail };
}

function findingFromEvidenceFinding({ scenario = {}, finding = {}, evidence = {}, index = 0 }) {
  const normalized = typeof finding === 'string' ? { code: finding } : finding;
  const code = normalized.code || normalized.name || 'unknown';
  let rule = code === 'command-failed'
    ? classifyCommandFailure(normalized, evidence)
    : evidenceFindingRule(code);
  let reason = normalized.detail || `发现 ${code}，需要最小重放确认责任层`;
  if (code === 'capability-gap:page-sharing'
      && asArray(evidence.resources).some((resource) => resource && resource.type === 'page-config'
        && resource.source === 'platform-readback')) {
    rule = { ...rule, status: 'resolved', confidence: 'high', title: '历史能力缺口已解决：page-sharing' };
    reason = '当前平台权威回读已存在 page-config；保留历史证据，但不再作为未解决优化项';
  }
  if (rule.reason) {reason = rule.reason;}
  const targetInfo = targetFields(rule.owner, { finding: normalized }, rule.status);
  const suggestedChange = rule.status === 'resolved'
    ? {
      area: 'save-share-config / page-config readback',
      action: '已解决；保留写入与平台回读回归，不再进入未解决 backlog',
    }
    : suggestionFor(rule.owner);
  return {
    findingId: `OPT-${String(scenario.id || 'scenario').replace(/[^a-zA-Z0-9_-]+/g, '-')}-${index + 1}`,
    scenarioId: scenario.id || null,
    requirementId: `${scenario.id || 'scenario'}:finding:${code}`,
    category: 'diagnostic',
    title: rule.title,
    severity: rule.severity,
    status: rule.status,
    expected: { finding: 'absent', code },
    actual: { finding: 'present', detail: normalized.detail || '' },
    evidence: {
      check: `finding:${code}`,
      sources: [normalized.source || 'generation-evidence'],
      commands: [],
    },
    attribution: {
      owner: rule.owner,
      confidence: rule.confidence,
      reason,
    },
    ...targetInfo,
    suggestedChange,
    regression: { assertion: `finding:${code}` },
  };
}

function deriveOptimizationFindings(options = {}) {
  const scenario = options.scenario || {};
  const evidence = options.evidence || {};
  const evidenceChecks = options.evidenceChecks || {};
  const features = options.features || {};
  const status = options.status || 'ok';
  const checks = [
    ...asArray(evidenceChecks.checks).filter((check) => check && check.required !== false && check.ok === false),
    ...asArray(features.checks).filter((check) => check && check.ok === false).map((check) => ({ ...check, required: true })),
  ];
  const findings = checks.map((check, index) => findingFromCheck({ scenario, check, evidence, index }));
  const representedFindingCodes = new Set(checks
    .filter((check) => check.kind === 'forbidden-finding')
    .map((check) => check.key));
  for (const evidenceFinding of asArray(evidence.findings)) {
    const code = typeof evidenceFinding === 'string'
      ? evidenceFinding
      : evidenceFinding && (evidenceFinding.code || evidenceFinding.name);
    if (representedFindingCodes.has(code)) {continue;}
    findings.push(findingFromEvidenceFinding({
      scenario, finding: evidenceFinding, evidence, index: findings.length,
    }));
  }
  if (['agent-unavailable', 'agent-error', 'no-output'].includes(status)) {
    findings.push(findingFromRuntime({ scenario, status, error: options.error, index: findings.length }));
  }
  return findings;
}

function countBy(items, selector) {
  const out = {};
  for (const item of items) {
    const key = selector(item) || 'unknown';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function commandFamilyFromFinding(finding = {}) {
  return commandFamilyFromArgs(failedCommandParts(finding.actual && finding.actual.detail));
}

function findingGroupDescriptor(finding = {}) {
  const owner = finding.attribution && finding.attribution.owner || 'unknown';
  const assertion = finding.regression && finding.regression.assertion || 'unknown';
  if (assertion === 'finding:command-failed') {
    if (owner === 'cli-discoverability') {
      return { key: 'diagnostic:command-help:cli-discoverability', title: 'CLI help / 命令发现失败' };
    }
    const family = commandFamilyFromFinding(finding);
    return { key: `diagnostic:command-failed:${family}:${owner}`, title: `${family} 命令失败` };
  }
  if (String(assertion).startsWith('finding:capability-gap:')) {
    return { key: `diagnostic:${assertion}`, title: finding.title || assertion };
  }
  if (finding.category === 'acceptance' && String(assertion).startsWith('skill:')) {
    return { key: `acceptance:skill:${owner}`, title: '必需技能证据缺失' };
  }
  if (finding.category === 'acceptance' && String(assertion).startsWith('resource:')) {
    const type = finding.expected && finding.expected.type || 'resource';
    return { key: `acceptance:resource:${type}:${owner}`, title: `${type} 资源合同未满足` };
  }
  if (finding.category === 'acceptance' && String(assertion).startsWith('command:')) {
    return { key: `acceptance:${assertion}:${owner}`, title: `${assertion.slice('command:'.length)} 命令合同未满足` };
  }
  return { key: `${finding.category || 'unknown'}:${assertion}:${owner}`, title: finding.title || assertion };
}

function groupOptimizationFindings(findings = []) {
  const severityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const groups = new Map();
  for (const finding of asArray(findings)) {
    const descriptor = findingGroupDescriptor(finding);
    if (!groups.has(descriptor.key)) {
      groups.set(descriptor.key, {
        groupId: descriptor.key,
        title: descriptor.title,
        severity: finding.severity || 'P2',
        owner: finding.attribution && finding.attribution.owner || 'unknown',
        scopes: [],
        findingCount: 0,
        statuses: [],
        confidences: [],
        requirementIds: [],
        assertions: [],
        targetSkills: [],
        targetCommands: [],
        targetFiles: [],
        affectedSkills: [],
        affectedCommands: [],
        affectedFiles: [],
        diagnosticSkills: [],
        diagnosticCommands: [],
        diagnosticFiles: [],
        suggestedChange: finding.suggestedChange || null,
        examples: [],
      });
    }
    const group = groups.get(descriptor.key);
    group.findingCount += 1;
    group.scopes.push(finding.scope || 'unknown');
    if ((severityRank[finding.severity] ?? 99) < (severityRank[group.severity] ?? 99)) {
      group.severity = finding.severity;
    }
    group.statuses.push(finding.status || 'unknown');
    group.confidences.push(finding.attribution && finding.attribution.confidence || 'unknown');
    group.targetSkills.push(...asArray(finding.targets && finding.targets.skills));
    group.targetCommands.push(...asArray(finding.targets && finding.targets.commands));
    group.targetFiles.push(...asArray(finding.targets && finding.targets.files));
    group.affectedSkills.push(...asArray(finding.affected && finding.affected.skills));
    group.affectedCommands.push(...asArray(finding.affected && finding.affected.commands));
    group.affectedFiles.push(...asArray(finding.affected && finding.affected.files));
    group.diagnosticSkills.push(...asArray(finding.diagnosticTargets && finding.diagnosticTargets.skills));
    group.diagnosticCommands.push(...asArray(finding.diagnosticTargets && finding.diagnosticTargets.commands));
    group.diagnosticFiles.push(...asArray(finding.diagnosticTargets && finding.diagnosticTargets.files));
    if (finding.requirementId) {group.requirementIds.push(finding.requirementId);}
    if (finding.regression && finding.regression.assertion) {
      group.assertions.push(finding.regression.assertion);
    }
    if (group.examples.length < 3) {
      group.examples.push({
        findingId: finding.findingId,
        requirementId: finding.requirementId,
        title: finding.title,
        detail: finding.actual && finding.actual.detail || '',
        reason: finding.attribution && finding.attribution.reason || '',
      });
    }
  }
  return [...groups.values()].map((group) => ({
    ...group,
    scope: uniqueStrings(group.scopes).join(',') || 'unknown',
    scopes: uniqueStrings(group.scopes),
    statuses: [...new Set(group.statuses)],
    confidences: [...new Set(group.confidences)],
    requirementIds: [...new Set(group.requirementIds)],
    assertions: [...new Set(group.assertions)],
    targetSkills: uniqueStrings(group.targetSkills),
    targetCommands: uniqueStrings(group.targetCommands),
    targetFiles: uniqueStrings(group.targetFiles),
    affectedSkills: uniqueStrings(group.affectedSkills),
    affectedCommands: uniqueStrings(group.affectedCommands),
    affectedFiles: uniqueStrings(group.affectedFiles),
    diagnosticSkills: uniqueStrings(group.diagnosticSkills),
    diagnosticCommands: uniqueStrings(group.diagnosticCommands),
    diagnosticFiles: uniqueStrings(group.diagnosticFiles),
  })).sort((left, right) => {
    const severity = (severityRank[left.severity] ?? 99) - (severityRank[right.severity] ?? 99);
    return severity || right.findingCount - left.findingCount || left.title.localeCompare(right.title);
  });
}

function buildOptimizationBacklog(results = [], options = {}) {
  const findings = asArray(results).flatMap((result) => asArray(result && result.optimizationFindings));
  const groups = groupOptimizationFindings(findings);
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    summary: {
      total: findings.length,
      bySeverity: countBy(findings, (item) => item.severity),
      byOwner: countBy(findings, (item) => item.attribution && item.attribution.owner),
      byStatus: countBy(findings, (item) => item.status),
      byScope: countBy(findings, (item) => item.scope),
      bySkill: countBy(findings.flatMap((item) => uniqueStrings(item.targets && item.targets.skills)
        .map((skill) => ({ skill }))), (item) => item.skill),
      byCommand: countBy(findings.flatMap((item) => uniqueStrings(item.targets && item.targets.commands)
        .map((command) => ({ command }))), (item) => item.command),
      actionable: findings.filter((item) => item.status !== 'resolved').length,
      groupCount: groups.length,
    },
    groups,
    findings,
  };
}

module.exports = {
  RESOURCE_COMMANDS,
  RESOURCE_TARGETS,
  OWNER_TARGETS,
  CAPABILITY_TARGETS,
  optimizationTargets,
  optimizationScope,
  targetFields,
  commandStartsWith,
  commandAttempts,
  inferResourceAttribution,
  inferCheckAttribution,
  findingFromCheck,
  findingFromRuntime,
  findingFromEvidenceFinding,
  failedCommandParts,
  commandFamilyFromArgs,
  classifyCommandFailure,
  deriveOptimizationFindings,
  commandFamilyFromFinding,
  findingGroupDescriptor,
  groupOptimizationFindings,
  buildOptimizationBacklog,
};
