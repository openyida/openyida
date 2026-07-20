#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_BIN = path.join(ROOT, 'bin', 'yida.js');
const SOURCE_SKILL_ROOT = path.join(ROOT, 'yida-skills');
const MOCK_PRELOAD = path.join(__dirname, 'support', 'schema-source-mock-preload.js');
const DEFAULT_RESULT_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real', 'schema-source');
const DEFAULT_TIMEOUT_MS = 120000;

const SENSITIVE_STDIO_PATTERNS = Object.freeze([
  /csrf-source-e2e/i,
  /corpSourceE2E/i,
  /userSourceE2E/i,
  /OPENYIDA_COOKIE_B64/i,
  /APP_SOURCE_E2E_/,
  /FORM_SOURCE_E2E_/,
  /TPROC_SOURCE_E2E_/,
  /PROCESS_SOURCE_E2E_/,
  /\b(text|number|date|select|textarea|employee|table|associationForm)Field_[A-Za-z0-9_-]+/,
  /componentsTree/,
]);

const MOCK_COOKIE_DATA = Object.freeze({
  base_url: 'https://source-e2e.example.test',
  cookies: [
    { name: 'tianshu_csrf_token', value: 'csrf-source-e2e', domain: 'source-e2e.example.test' },
    { name: 'tianshu_corp_user', value: 'corpSourceE2E_userSourceE2E', domain: 'source-e2e.example.test' },
  ],
});

function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hashFile(filePath) {
  return sha256(fs.readFileSync(filePath, 'utf8'));
}

function assertPathInside(child, parent, label) {
  const childReal = fs.realpathSync(child);
  const parentReal = fs.realpathSync(parent);
  const relative = path.relative(parentReal, childReal);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} is outside the expected source root`);
  }
  return childReal;
}

function toPortableRelative(root, target) {
  return path.relative(root, target).replace(/\\/g, '/');
}

function readSourceSkillEvidence(skillRoot = SOURCE_SKILL_ROOT) {
  const rootReal = fs.realpathSync(skillRoot);
  const expectedRoot = fs.realpathSync(SOURCE_SKILL_ROOT);
  if (rootReal !== expectedRoot) {
    throw new Error(`Skill root must be the checkout yida-skills directory: ${skillRoot}`);
  }

  const files = [
    path.join(skillRoot, 'SKILL.md'),
    path.join(skillRoot, 'skills', 'yida-app', 'SKILL.md'),
    path.join(skillRoot, 'skills', 'yida-create-form-page', 'SKILL.md'),
    path.join(skillRoot, 'skills', 'yida-create-process', 'SKILL.md'),
    path.join(skillRoot, 'skills', 'yida-create-page', 'SKILL.md'),
    path.join(skillRoot, 'skills', 'yida-publish-page', 'SKILL.md'),
    path.join(skillRoot, 'skills', 'yida-report', 'SKILL.md'),
    path.join(skillRoot, 'skills', 'yida-integration', 'SKILL.md'),
    path.join(skillRoot, 'skills', 'yida-page-config', 'SKILL.md'),
    path.join(skillRoot, 'references', 'schema-as-code-phase1.md'),
  ];

  const evidence = files.map((filePath) => {
    const realPath = assertPathInside(filePath, skillRoot, 'Skill file');
    const content = fs.readFileSync(realPath, 'utf8');
    return {
      file: toPortableRelative(ROOT, realPath),
      sha256: sha256(content),
      bytes: Buffer.byteLength(content),
    };
  });

  return {
    root: toPortableRelative(ROOT, rootReal),
    files: evidence,
  };
}

function ensureWorkspace(workspace) {
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(workspace, 'config.json'), `${JSON.stringify({ schemaSourceE2e: true }, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.join(workspace, '.cache'), { recursive: true, mode: 0o700 });
}

function cookieHeaderFromData(cookieData) {
  return (cookieData.cookies || [])
    .filter((cookie) => cookie && cookie.name && cookie.value)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

function createLauncher(workspace) {
  const binDir = path.join(workspace, 'bin');
  const tracePath = path.join(workspace, 'launcher-trace.jsonl');
  fs.mkdirSync(binDir, { recursive: true, mode: 0o700 });
  const launcherPath = path.join(binDir, 'openyida');
  const launcher = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { spawnSync } = require('child_process');
const tracePath = ${JSON.stringify(tracePath)};
const sourceBin = ${JSON.stringify(SOURCE_BIN)};
fs.appendFileSync(tracePath, JSON.stringify({
  argv: process.argv.slice(2),
  execPath: process.execPath,
  sourceBin,
  cwd: process.cwd(),
  at: new Date().toISOString()
}) + '\\n', 'utf8');
const result = spawnSync(process.execPath, [sourceBin, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit'
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
`;
  fs.writeFileSync(launcherPath, launcher, { encoding: 'utf8', mode: 0o755 });
  const yidaPath = path.join(binDir, 'yida');
  fs.copyFileSync(launcherPath, yidaPath);
  fs.chmodSync(yidaPath, 0o755);

  let commandPath = launcherPath;
  if (process.platform === 'win32') {
    commandPath = path.join(binDir, 'openyida.cmd');
    const command = `@echo off\r\n"${process.execPath}" "${launcherPath}" %*\r\n`;
    fs.writeFileSync(commandPath, command, 'utf8');
    fs.writeFileSync(path.join(binDir, 'yida.cmd'), command, 'utf8');
  }

  return { binDir, commandPath, launcherPath, tracePath };
}

function buildEnv(workspace, launcher) {
  const mockDbPath = path.join(workspace, 'mock-remote.json');
  const cookieHeader = cookieHeaderFromData(MOCK_COOKIE_DATA);
  return {
    ...process.env,
    PATH: `${launcher.binDir}${path.delimiter}${process.env.PATH || ''}`,
    NODE_OPTIONS: `--require=${MOCK_PRELOAD}`,
    OPENYIDA_SCHEMA_SOURCE_E2E_LAUNCHER: launcher.commandPath || launcher.launcherPath,
    OPENYIDA_SCHEMA_SOURCE_E2E_MOCK: '1',
    OPENYIDA_SCHEMA_SOURCE_MOCK_DB: mockDbPath,
    OPENYIDA_LANG: 'en',
    OPENYIDA_SKIP_UPDATE_CHECK: '1',
    YIDA_AUTH_ENABLED: 'true',
    OPENYIDA_COOKIE_B64: Buffer.from(cookieHeader, 'utf8').toString('base64'),
    OPENYIDA_BASE_URL: MOCK_COOKIE_DATA.base_url,
    NO_UPDATE_NOTIFIER: '1',
    YIDA_QUIET: '1',
    CI: '1',
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function crmManifest(options = {}) {
  const fields = {
    customerName: {
      type: 'TextField',
      label: '客户名称',
      required: true,
    },
    customerPhone: {
      type: 'TextField',
      label: '联系电话',
    },
    followUpDate: {
      type: 'DateField',
      label: '跟进日期',
      required: true,
    },
    customerNeed: {
      type: 'TextareaField',
      label: '客户需求',
      required: !!options.reasonRequired,
    },
  };
  if (options.customerLevelField) {
    fields.customerLevel = {
      type: 'SelectField',
      label: '客户级别',
      options: ['A 类客户', 'B 类客户', 'C 类客户'],
    };
  }
  return {
    kind: 'openyida_app_manifest',
    schemaVersion: 1,
    app: {
      key: 'crmSystem',
      name: options.appName || 'CRM 系统',
    },
    forms: {
      customerProfile: {
        title: '客户档案',
        ...(options.process ? { mode: 'process' } : {}),
        fields,
      },
    },
    ...(options.process ? {
      processes: {
        customerApproval: {
          form: 'customerProfile',
          nodes: [
            { key: 'salesReview', type: 'approval', name: '销售确认', approver: 'originator' },
            {
              key: 'managerApproval',
              type: 'approval',
              name: options.processNodeName || '主管审批',
              approver: 'originator',
            },
          ],
        },
      },
    } : {}),
    ...(options.page ? {
      pages: {
        crmHome: {
          title: 'CRM 工作台',
          source: 'pages/crm-home.oyd.jsx',
        },
      },
    } : {}),
  };
}

function processManifest(options = {}) {
  return crmManifest({
    appName: '销售 CRM 系统',
    customerLevelField: true,
    reasonRequired: true,
    process: true,
    processNodeName: options.processNodeName,
    page: options.page,
  });
}

function reportManifest() {
  return {
    ...processManifest({ processNodeName: '销售主管审批', page: true }),
    reports: {
      monthlyCustomers: {
        title: '月度客户量报表',
        source: 'customerProfile',
        dimensions: ['followUpDate'],
        metrics: [{ type: 'count', field: 'customerName', label: '客户量' }],
      },
    },
  };
}

function automationManifest() {
  return {
    ...processManifest({ processNodeName: '销售主管审批', page: true }),
    automations: {
      notifySales: {
        title: '客户提交后通知销售',
        trigger: { form: 'customerProfile', event: 'submit' },
        actions: [{ type: 'dingTalkNotify', target: 'salesGroup', content: '新客户档案' }],
      },
    },
  };
}

function mixedModeManifest() {
  return {
    kind: 'openyida_app_manifest',
    schemaVersion: 1,
    app: {
      key: 'opsSystem',
      name: '运维工单系统',
    },
    forms: {
      deviceRegistry: {
        title: '设备台账',
        fields: {
          deviceName: {
            type: 'TextField',
            label: '设备名称',
            required: true,
          },
          deviceModel: {
            type: 'TextField',
            label: '设备型号',
          },
        },
      },
      changeApproval: {
        title: '变更审批',
        mode: 'process',
        fields: {
          changeTitle: {
            type: 'TextField',
            label: '变更标题',
            required: true,
          },
          changeReason: {
            type: 'TextareaField',
            label: '变更原因',
            required: true,
          },
        },
      },
    },
    processes: {
      changeFlow: {
        form: 'changeApproval',
        nodes: [
          { key: 'opsReview', type: 'approval', name: '运维审批', approver: 'originator' },
        ],
      },
    },
  };
}

function planCounts(create, update, noop) {
  return { create, update, noop, conflict: 0, unmanaged: 0, orphan: 0 };
}

function applyCounts(create, update, noop) {
  return { create, update, noop, stateRepair: 0 };
}

function scenarioDefinitions() {
  const pageSourceOne = 'export default function Page() { return <div>CRM dashboard one</div>; }\n';
  const pageSourceTwo = 'export default function Page() { return <div>CRM dashboard two</div>; }\n';
  return [
    {
      id: 'crm-build',
      prompt: '帮我搭建一个 CRM 系统',
      manifest: crmManifest(),
      expectedPlan: planCounts(2, 0, 0),
      expectedApply: applyCounts(2, 0, 0),
      expectedNoopResources: 2,
      supported: true,
    },
    {
      id: 'crm-rename-app',
      prompt: '把应用名称改成销售 CRM 系统',
      manifest: crmManifest({ appName: '销售 CRM 系统' }),
      expectedPlan: planCounts(0, 1, 1),
      expectedApply: applyCounts(0, 1, 1),
      expectedNoopResources: 2,
      supported: true,
    },
    {
      id: 'crm-add-customer-level-field',
      prompt: '帮我给客户档案增加客户级别字段',
      manifest: crmManifest({ appName: '销售 CRM 系统', customerLevelField: true }),
      expectedPlan: planCounts(0, 1, 1),
      expectedApply: applyCounts(0, 1, 1),
      expectedNoopResources: 2,
      supported: true,
    },
    {
      id: 'crm-customer-need-required',
      prompt: '帮我把客户需求字段改成必填',
      manifest: crmManifest({ appName: '销售 CRM 系统', customerLevelField: true, reasonRequired: true }),
      expectedPlan: planCounts(0, 1, 1),
      expectedApply: applyCounts(0, 1, 1),
      expectedNoopResources: 2,
      supported: true,
    },
    {
      id: 'crm-process',
      prompt: '帮我配置客户审批流程，提交后销售确认再主管审批',
      manifest: processManifest(),
      expectedPlan: planCounts(1, 1, 1),
      expectedApply: applyCounts(1, 1, 1),
      expectedNoopResources: 3,
      supported: true,
    },
    {
      id: 'crm-process-update',
      prompt: '把主管审批节点改名为销售主管审批',
      manifest: processManifest({ processNodeName: '销售主管审批' }),
      expectedPlan: planCounts(0, 1, 2),
      expectedApply: applyCounts(0, 1, 2),
      expectedNoopResources: 3,
      supported: true,
    },
    {
      id: 'crm-page',
      prompt: '帮我给 CRM 系统新增 native 客户工作台',
      manifest: processManifest({ processNodeName: '销售主管审批', page: true }),
      expectedPlan: planCounts(1, 0, 3),
      expectedApply: applyCounts(1, 0, 3),
      expectedNoopResources: 4,
      sourceContent: pageSourceOne,
      supported: true,
    },
    {
      id: 'crm-page-source-update',
      prompt: '修改 CRM 工作台页面源码',
      manifest: processManifest({ processNodeName: '销售主管审批', page: true }),
      expectedPlan: planCounts(0, 1, 3),
      expectedApply: applyCounts(0, 1, 3),
      expectedNoopResources: 4,
      sourceContent: pageSourceTwo,
      supported: true,
    },
    {
      id: 'crm-report',
      prompt: '基于客户档案生成每月客户量报表',
      manifest: reportManifest(),
      section: 'reports',
      supported: false,
    },
    {
      id: 'crm-automation',
      prompt: '配置集成自动化，客户提交后通知销售群',
      manifest: automationManifest(),
      section: 'automations',
      supported: false,
    },
  ];
}

function assertNoSensitiveStdio(text, label) {
  for (const pattern of SENSITIVE_STDIO_PATTERNS) {
    if (pattern.test(text || '')) {
      throw new Error(`${label} leaked sensitive or full-schema data matching ${pattern}`);
    }
  }
}

function runCommand(commandEnv, workspace, args, options = {}) {
  const command = commandEnv.OPENYIDA_SCHEMA_SOURCE_E2E_LAUNCHER || 'openyida';
  const result = spawnSync(command, args, {
    cwd: workspace,
    env: commandEnv,
    encoding: 'utf8',
    shell: process.platform === 'win32' && /\.cmd$/i.test(command),
    timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  const status = result.status === null ? 1 : result.status;
  if (options.expectStatus !== 'any' && status !== (options.expectStatus === undefined ? 0 : options.expectStatus)) {
    throw new Error(`Command failed (${status}): openyida ${args.join(' ')}\n${(result.stderr || result.stdout || '').slice(0, 1200)}`);
  }
  return {
    args,
    status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function parseJsonProtocol(commandResult, expected = {}) {
  assertNoSensitiveStdio(commandResult.stdout, 'stdout');
  assertNoSensitiveStdio(commandResult.stderr, 'stderr');
  if (commandResult.stderr !== '') {
    throw new Error(`Expected empty stderr for ${commandResult.args.join(' ')}`);
  }
  const lines = commandResult.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) {
    throw new Error(`Expected exactly one JSON stdout line for ${commandResult.args.join(' ')}, got ${lines.length}`);
  }
  let payload;
  try {
    payload = JSON.parse(lines[0]);
  } catch (error) {
    throw new Error(`Invalid JSON stdout for ${commandResult.args.join(' ')}: ${error.message}`);
  }
  if (expected.kind && payload.kind !== expected.kind) {
    throw new Error(`Expected kind ${expected.kind}, got ${payload.kind}`);
  }
  if (expected.success !== undefined && payload.success !== expected.success) {
    throw new Error(`Expected success ${expected.success}, got ${payload.success}`);
  }
  return payload;
}

function assertExactCounts(payload, expectedCounts, label) {
  const counts = payload && payload.counts;
  if (!counts || JSON.stringify(counts) !== JSON.stringify(expectedCounts)) {
    throw new Error(`${label} expected exact counts ${JSON.stringify(expectedCounts)}, got ${JSON.stringify(counts || null)}`);
  }
}

function assertNoop(payload, label, resourceCount, kind = 'plan') {
  assertExactCounts(
    payload,
    kind === 'apply' ? applyCounts(0, 0, resourceCount) : planCounts(0, 0, resourceCount),
    label
  );
}

function runSchemaValidate(commandEnv, workspace, manifestPath, expectStatus = 0) {
  const result = runCommand(commandEnv, workspace, ['schema', 'validate', manifestPath, '--json', '--quiet'], { expectStatus });
  return parseJsonProtocol(result, {
    kind: 'openyida_schema_validation',
    success: expectStatus === 0,
  });
}

function runSchemaPlan(commandEnv, workspace, manifestPath, statePath, expectStatus = 0) {
  const result = runCommand(commandEnv, workspace, ['schema', 'plan', manifestPath, '--state', statePath, '--json', '--quiet'], { expectStatus });
  return parseJsonProtocol(result, {
    kind: 'openyida_schema_plan',
    success: expectStatus === 0,
  });
}

function runSchemaApply(commandEnv, workspace, manifestPath, statePath, planId, expectStatus = 0) {
  const result = runCommand(commandEnv, workspace, [
    'schema',
    'apply',
    manifestPath,
    '--state',
    statePath,
    '--plan-id',
    planId,
    '--json',
    '--quiet',
  ], { expectStatus });
  return parseJsonProtocol(result, {
    kind: 'openyida_schema_apply',
    success: expectStatus === 0,
  });
}

function writeScenarioManifest(workspace, scenario) {
  if (scenario.sourceContent !== undefined) {
    const sourcePath = path.join(workspace, 'pages', 'crm-home.oyd.jsx');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, scenario.sourceContent, 'utf8');
  }
  const manifestPath = path.join(workspace, 'manifests', `${scenario.id}.json`);
  writeJson(manifestPath, scenario.manifest);
  return manifestPath;
}

function runSupportedScenario(commandEnv, workspace, statePath, scenario) {
  const manifestPath = writeScenarioManifest(workspace, scenario);
  const validation = runSchemaValidate(commandEnv, workspace, manifestPath);
  const plan = runSchemaPlan(commandEnv, workspace, manifestPath, statePath);
  assertExactCounts(plan, scenario.expectedPlan, `${scenario.id} plan`);
  const apply = runSchemaApply(commandEnv, workspace, manifestPath, statePath, plan.planId);
  assertExactCounts(apply, scenario.expectedApply, `${scenario.id} apply`);
  const journal = assertCompletedJournal(
    statePath,
    plan,
    scenario.id,
    commandEnv.OPENYIDA_SCHEMA_SOURCE_MOCK_DB
  );
  const processDefinition = scenario.manifest.processes
    ? assertProcessMatchesManifest(commandEnv.OPENYIDA_SCHEMA_SOURCE_MOCK_DB, statePath, scenario.manifest, scenario.id)
    : null;

  const confirmPlan = runSchemaPlan(commandEnv, workspace, manifestPath, statePath);
  assertNoop(confirmPlan, `${scenario.id} confirm plan`, scenario.expectedNoopResources);
  const confirmApply = runSchemaApply(commandEnv, workspace, manifestPath, statePath, confirmPlan.planId);
  assertNoop(confirmApply, `${scenario.id} confirm apply`, scenario.expectedNoopResources, 'apply');
  if (scenario.manifest.processes) {
    assertProcessMatchesManifest(commandEnv.OPENYIDA_SCHEMA_SOURCE_MOCK_DB, statePath, scenario.manifest, `${scenario.id} confirm`);
  }

  return {
    id: scenario.id,
    prompt: scenario.prompt,
    status: 'applied',
    manifestHash: validation.manifestHash,
    planId: plan.planId,
    counts: {
      plan: plan.counts,
      apply: apply.counts,
      confirmPlan: confirmPlan.counts,
      confirmApply: confirmApply.counts,
    },
    journal,
    ...(processDefinition ? { processDefinition } : {}),
  };
}

function assertProcessMatchesManifest(dbPath, statePath, manifest, label) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const desired = manifest.processes && manifest.processes.customerApproval;
  const processResource = Object.values(db.processes || {})[0];
  const processState = state.resources && state.resources.process && state.resources.process.customerApproval;
  const expectedManaged = desired && desired.nodes.map(node => ({
    approver: node.approver,
    name: node.name,
    type: node.type,
  }));
  const stateManaged = processState && processState.lastApplied && processState.lastApplied.nodes &&
    processState.lastApplied.nodes.map(node => ({ approver: node.approver, name: node.name, type: node.type }));
  if (
    !desired || !processResource || !processState ||
    processResource.appType !== processState.bindings.appType ||
    processResource.formUuid !== processState.bindings.formUuid ||
    processResource.processCode !== processState.bindings.processCode ||
    processResource.active.processId !== processState.bindings.processId ||
    processResource.active.processVersion !== processState.bindings.processVersion ||
    !isPlainRecord(processResource.activeProcessJson) ||
    !isSha256(processResource.activeProcessJsonHash) ||
    stableObjectHash(processResource.activeProcessJson) !== processResource.activeProcessJsonHash ||
    JSON.stringify(processResource.activeManagedDefinition) !== JSON.stringify(expectedManaged) ||
    JSON.stringify(stateManaged) !== JSON.stringify(expectedManaged)
  ) {
    throw new Error(`${label} process payload/state does not match the source managed definition`);
  }
  return {
    canonicalProcessHashVerified: true,
    managedDefinitionMatchesSource: true,
    ownershipMatchesState: true,
    version: processResource.active.processVersion,
  };
}

function stableObjectHash(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (isPlainRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function isUnsupportedPayload(payload, section) {
  return !!(
    payload &&
    payload.success === false &&
    payload.error &&
    payload.error.code === 'SCHEMA_RESOURCE_TYPE_UNSUPPORTED' &&
    (!section || payload.error.path === `/${section}`)
  );
}

function runBoundaryScenario(commandEnv, workspace, statePath, scenario) {
  const manifestPath = writeScenarioManifest(workspace, scenario);
  const sideEffectsRoot = path.dirname(statePath);
  const dbPath = commandEnv.OPENYIDA_SCHEMA_SOURCE_MOCK_DB;
  const cacheBefore = snapshotDirectory(sideEffectsRoot);
  const dbBefore = snapshotFile(dbPath);
  const validationResult = runCommand(commandEnv, workspace, ['schema', 'validate', manifestPath, '--json', '--quiet'], { expectStatus: 'any' });
  const validation = parseJsonProtocol(validationResult, { kind: 'openyida_schema_validation' });
  if (validationResult.status === 0 || !isUnsupportedPayload(validation, scenario.section)) {
    throw new Error(`${scenario.id} must fail exactly at /${scenario.section} validation, got ${JSON.stringify(validation.error || validation)}`);
  }
  assertSnapshotUnchanged(snapshotDirectory(sideEffectsRoot), cacheBefore, `${scenario.id} schema cache`);
  assertFileSnapshotUnchanged(dbPath, dbBefore, `${scenario.id} mock remote DB`);
  return {
    id: scenario.id,
    prompt: scenario.prompt,
    status: 'unsupported',
    phase: 'validate',
    errorCode: validation.error.code,
    errorPath: validation.error.path,
    sideEffectsUnchanged: true,
  };
}

function snapshotFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, sha256: null };
  }
  return {
    exists: true,
    sha256: hashFile(filePath),
  };
}

function assertFileSnapshotUnchanged(filePath, before, label) {
  const after = snapshotFile(filePath);
  if (before.exists !== after.exists || before.sha256 !== after.sha256) {
    throw new Error(`${label} changed schema state unexpectedly`);
  }
}

function snapshotDirectory(directory) {
  if (!fs.existsSync(directory)) {
    return { exists: false, sha256: null, files: 0 };
  }
  const files = [];
  collect(directory, '');
  return {
    exists: true,
    files: files.length,
    sha256: sha256(files.map(entry => `${entry.relative}:${entry.hash}`).join('\n')),
  };

  function collect(current, relative) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path.join(current, entry.name);
      const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        collect(entryPath, entryRelative);
      } else if (entry.isFile()) {
        files.push({ relative: entryRelative, hash: hashFile(entryPath) });
      } else {
        throw new Error(`Unexpected non-file cache entry in ${entryRelative}`);
      }
    }
  }
}

function assertSnapshotUnchanged(after, before, label) {
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    throw new Error(`${label} changed unexpectedly`);
  }
}

function assertCompletedJournal(statePath, plan, label, dbPath) {
  const journalPath = path.join(path.dirname(statePath), 'apply-operations.v1.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const expected = (plan.changes || []).filter(change => change.operation === 'create' || change.operation === 'update');
  const operations = Object.values(journal.operations || {});
  if (journal.planId !== plan.planId || operations.length !== expected.length) {
    throw new Error(`${label} journal does not match the reviewed plan`);
  }
  const expectedKeys = expected.map(change => `${change.resourceType}:${change.key}:${change.operation}`).sort();
  const actualKeys = operations.map(operation => {
    const checkpoint = operation.checkpoint;
    const stateResource = state.resources && state.resources[operation.resourceType] &&
      state.resources[operation.resourceType][operation.key];
    if (
      operation.status !== 'completed' || !isPlainRecord(checkpoint) ||
      !isPlainRecord(checkpoint.bindings) || Object.keys(checkpoint.bindings).length === 0 ||
      !Number.isInteger(checkpoint.adapterVersion) || checkpoint.adapterVersion < 1 ||
      !isSha256(checkpoint.lastAppliedHash) || !isSha256(checkpoint.observedManagedHash) ||
      !isPlainRecord(checkpoint.lastApplied) ||
      !stateResource || JSON.stringify(checkpoint.bindings) !== JSON.stringify(stateResource.bindings)
    ) {
      throw new Error(`${label} journal operation is not completed with a checkpoint`);
    }
    assertCheckpointIdentity(operation.resourceType, checkpoint.bindings, `${label} ${operation.resourceType}`);
    assertCheckpointBindingRelationships(operation.resourceType, checkpoint.bindings, stateResource, db, `${label} ${operation.resourceType}`);
    return `${operation.resourceType}:${operation.key}:${operation.operation}`;
  }).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${label} journal operations differ from plan changes`);
  }
  return {
    operationCount: operations.length,
    operations: actualKeys,
    allCompleted: true,
    bindingRelationshipsVerified: true,
  };
}

function assertCheckpointIdentity(resourceType, bindings, label) {
  const required = {
    app: ['appType'],
    form: ['appType', 'formUuid', 'fieldBindings'],
    page: ['appType', 'formUuid'],
    process: ['appType', 'formUuid', 'processCode', 'processId', 'processVersion', 'nodeBindings'],
  }[resourceType];
  if (!required || required.some(key => bindings[key] === undefined || bindings[key] === null || bindings[key] === '')) {
    throw new Error(`${label} checkpoint identity is incomplete`);
  }
  if (resourceType === 'form' && (!isPlainRecord(bindings.fieldBindings) || Object.keys(bindings.fieldBindings).length === 0)) {
    throw new Error(`${label} checkpoint field bindings are incomplete`);
  }
  if (resourceType === 'process' && (!isPlainRecord(bindings.nodeBindings) || Object.keys(bindings.nodeBindings).length === 0)) {
    throw new Error(`${label} checkpoint node bindings are incomplete`);
  }
}

function assertCheckpointBindingRelationships(resourceType, bindings, stateResource, db, label) {
  if (resourceType === 'form') {
    const remoteForm = Object.values(db.forms || {}).find(form => form.formUuid === bindings.formUuid);
    if (!remoteForm) {
      throw new Error(`${label} checkpoint form identity is absent from the mock remote`);
    }
    const managedKeys = (stateResource.lastApplied && stateResource.lastApplied.fields || [])
      .map(field => field.semanticPath)
      .sort();
    assertFieldBindingRelationships(bindings.fieldBindings, remoteForm.content, managedKeys, label);
  }
  if (resourceType === 'process') {
    const remoteProcess = Object.values(db.processes || {}).find(process => (
      process.processCode === bindings.processCode &&
      process.active && process.active.processId === bindings.processId &&
      process.active.processVersion === bindings.processVersion
    ));
    if (!remoteProcess) {
      throw new Error(`${label} checkpoint process identity is absent from the mock remote`);
    }
    assertProcessNodeBindingRelationships(
      bindings.nodeBindings,
      stateResource.lastApplied && stateResource.lastApplied.nodes,
      remoteProcess.activeProcessJson,
      label
    );
  }
}

function assertFieldBindingRelationships(fieldBindings, remoteSchema, managedKeys, label) {
  if (!isPlainRecord(fieldBindings)) {
    throw new Error(`${label} field bindings are invalid`);
  }
  const bindingKeys = Object.keys(fieldBindings).sort();
  if (JSON.stringify(bindingKeys) !== JSON.stringify((managedKeys || []).slice().sort())) {
    throw new Error(`${label} field binding semantic keys differ from managed fields`);
  }
  const remoteFields = collectRemoteFieldIdentities(remoteSchema);
  const usedFieldIds = new Set();
  for (const key of bindingKeys) {
    const binding = fieldBindings[key];
    if (
      !isPlainRecord(binding) || typeof binding.fieldId !== 'string' || !binding.fieldId ||
      typeof binding.componentType !== 'string' || !binding.componentType ||
      usedFieldIds.has(binding.fieldId)
    ) {
      throw new Error(`${label} field binding ${key} is not one-to-one`);
    }
    usedFieldIds.add(binding.fieldId);
    const remote = remoteFields.get(binding.fieldId);
    if (!remote || remote.componentName !== binding.componentType) {
      throw new Error(`${label} field binding ${key} does not match its exact remote field/component identity`);
    }
  }
}

function assertProcessNodeBindingRelationships(nodeBindings, managedNodes, activeProcessJson, label) {
  if (!isPlainRecord(nodeBindings) || !Array.isArray(managedNodes) || !isPlainRecord(activeProcessJson)) {
    throw new Error(`${label} process node relationship evidence is invalid`);
  }
  const managedByKey = new Map(managedNodes.map(node => [node.key, node]));
  const bindingKeys = Object.keys(nodeBindings).sort();
  const managedKeys = Array.from(managedByKey.keys()).sort();
  if (JSON.stringify(bindingKeys) !== JSON.stringify(managedKeys)) {
    throw new Error(`${label} process node binding semantic keys differ from managed nodes`);
  }
  const approvalNodes = (activeProcessJson.nodes || []).filter(node => node && node.type === 'approval');
  const activeById = new Map();
  for (const node of approvalNodes) {
    if (typeof node.nodeId !== 'string' || !node.nodeId || activeById.has(node.nodeId)) {
      throw new Error(`${label} active process contains duplicate or invalid approval node identity`);
    }
    activeById.set(node.nodeId, node);
  }
  const usedNodeIds = new Set();
  for (const key of bindingKeys) {
    const binding = nodeBindings[key];
    const managed = managedByKey.get(key);
    const active = binding && activeById.get(binding.nodeId);
    if (
      !isPlainRecord(binding) || binding.componentName !== 'ApprovalNode' ||
      typeof binding.nodeId !== 'string' || !binding.nodeId || usedNodeIds.has(binding.nodeId) ||
      !managed || managed.type !== 'approval' || !active ||
      !isPlainRecord(active.name) || active.name.zh_CN !== managed.name
    ) {
      throw new Error(`${label} process node binding ${key} is not one-to-one with the active process`);
    }
    usedNodeIds.add(binding.nodeId);
  }
  if (usedNodeIds.size !== activeById.size) {
    throw new Error(`${label} process node bindings do not cover the active managed nodes exactly`);
  }
}

function assertBindingContractNegativeCases(formState, form, processState, processResource) {
  const rejected = operation => {
    try {
      operation();
      return false;
    } catch (_error) {
      return true;
    }
  };
  const fieldBindings = cloneJson(formState.bindings.fieldBindings);
  const fieldKeys = Object.keys(fieldBindings).sort();
  fieldBindings[fieldKeys[1]].fieldId = fieldBindings[fieldKeys[0]].fieldId;

  const duplicateNodeBindings = cloneJson(processState.bindings.nodeBindings);
  const nodeKeys = Object.keys(duplicateNodeBindings).sort();
  duplicateNodeBindings[nodeKeys[1]].nodeId = duplicateNodeBindings[nodeKeys[0]].nodeId;

  const wrongNodeBindings = cloneJson(processState.bindings.nodeBindings);
  wrongNodeBindings[nodeKeys[0]].nodeId = 'node_SOURCE_E2E_WRONG';
  const managedFieldKeys = formState.lastApplied.fields.map(field => field.semanticPath);
  const managedNodes = processState.lastApplied.nodes;
  return {
    duplicateFieldId: rejected(() => assertFieldBindingRelationships(
      fieldBindings,
      form.content,
      managedFieldKeys,
      'negative form'
    )),
    duplicateProcessNodeId: rejected(() => assertProcessNodeBindingRelationships(
      duplicateNodeBindings,
      managedNodes,
      processResource.activeProcessJson,
      'negative process'
    )),
    wrongProcessNodeId: rejected(() => assertProcessNodeBindingRelationships(
      wrongNodeBindings,
      managedNodes,
      processResource.activeProcessJson,
      'negative process'
    )),
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function isSha256(value) {
  return typeof value === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/.test(value);
}

function readTrace(tracePath) {
  const raw = fs.readFileSync(tracePath, 'utf8').trim();
  return raw ? raw.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

function assertLauncherTrace(tracePath, launcherPath) {
  const trace = readTrace(tracePath);
  if (trace.length === 0) {
    throw new Error('Launcher trace is empty; openyida may not have used the temp source launcher');
  }
  const sourceBinReal = fs.realpathSync(SOURCE_BIN);
  for (const entry of trace) {
    if (fs.realpathSync(entry.sourceBin) !== sourceBinReal) {
      throw new Error('Launcher did not execute the current checkout bin/yida.js');
    }
  }
  return {
    commandCount: trace.length,
    launcherSha256: sha256(fs.realpathSync(launcherPath)),
    sourceBin: toPortableRelative(ROOT, sourceBinReal),
    sourceBinSha256: hashFile(sourceBinReal),
    firstCommand: summarizeArgs(trace[0].argv),
    lastCommand: summarizeArgs(trace[trace.length - 1].argv),
  };
}

function summarizeArgs(args = []) {
  const values = Array.isArray(args) ? args : [];
  if (values[0] === 'schema') {
    return values.slice(0, 2).join(' ');
  }
  return values[0] || '';
}

function assertStateAndBindings(workspace, statePath, dbPath) {
  if (!fs.existsSync(statePath)) {
    throw new Error('Expected schema state file to exist after supported scenarios');
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const journalPath = path.join(path.dirname(statePath), 'apply-operations.v1.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  if (state.kind !== 'openyida_resource_state') {
    throw new Error(`Unexpected state kind: ${state.kind}`);
  }
  if (state.revision !== 10 || !state.resources || !state.resources.app || !state.resources.form || !state.resources.page || !state.resources.process) {
    throw new Error('State must include app, form, page, and process resources');
  }
  const appState = state.resources.app.crmSystem;
  const formState = state.resources.form.customerProfile;
  const pageState = state.resources.page.crmHome;
  const processState = state.resources.process.customerApproval;
  const apps = Object.values(db.apps || {});
  const forms = Object.values(db.forms || {});
  const pages = Object.values(db.pages || {});
  const processes = Object.values(db.processes || {});
  if (apps.length !== 1 || forms.length !== 1 || pages.length !== 1 || processes.length !== 1) {
    throw new Error('Mock remote DB must contain exactly one app, form, page, and process');
  }
  const [app] = apps;
  const [form] = forms;
  const [page] = pages;
  const [processResource] = processes;
  if (
    !appState || appState.bindings.appType !== app.appType ||
    !formState || formState.bindings.appType !== app.appType || formState.bindings.formUuid !== form.formUuid ||
    !pageState || pageState.bindings.appType !== app.appType || pageState.bindings.formUuid !== page.formUuid ||
    !processState || processState.bindings.appType !== app.appType || processState.bindings.formUuid !== form.formUuid ||
    processState.bindings.processCode !== processResource.processCode ||
    processState.bindings.processId !== processResource.active.processId ||
    processState.bindings.processVersion !== processResource.active.processVersion
  ) {
    throw new Error('State identity bindings do not match the mock remote resources');
  }
  if (
    form.appType !== app.appType || form.mode !== 'process' || form.processCode !== processResource.processCode ||
    processResource.appType !== app.appType || processResource.formUuid !== form.formUuid ||
    processResource.active.processVersion !== 2 || processResource.draft !== null ||
    JSON.stringify(processResource.historical.map(identity => identity.processVersion)) !== JSON.stringify([0, 1]) ||
    !processResource.activeDefinition || processResource.activeDefinition.bindingForm !== form.formUuid
  ) {
    throw new Error('Process version or form ownership evidence is inconsistent');
  }
  const expectedFieldKeys = ['customerLevel', 'customerName', 'customerNeed', 'customerPhone', 'followUpDate'];
  if (JSON.stringify(Object.keys(formState.bindings.fieldBindings || {}).sort()) !== JSON.stringify(expectedFieldKeys)) {
    throw new Error('Form field bindings do not match the final managed fields');
  }
  assertFieldBindingRelationships(formState.bindings.fieldBindings, form.content, expectedFieldKeys, 'final form');
  assertProcessNodeBindingRelationships(
    processState.bindings.nodeBindings,
    processState.lastApplied.nodes,
    processResource.activeProcessJson,
    'final process'
  );
  const bindingContractNegativeCases = assertBindingContractNegativeCases(
    formState,
    form,
    processState,
    processResource
  );
  if (!Object.values(bindingContractNegativeCases).every(Boolean)) {
    throw new Error('Binding contract negative cases did not fail closed');
  }
  if (Object.keys(journal.operations || {}).length !== 0) {
    throw new Error('Final noop journal must contain no executable operations');
  }
  const writeCalls = countCalls(db.calls, name => /^(create|update|convert|save|publish):/.test(name));
  const expectedWriteCalls = {
    'convert:form': 1,
    'create:app': 1,
    'create:form': 1,
    'create:page': 1,
    'create:process-draft': 2,
    'publish:process': 2,
    'save:page': 2,
    'save:process': 2,
    'update:app': 1,
    'update:form': 3,
  };
  if (JSON.stringify(writeCalls) !== JSON.stringify(expectedWriteCalls)) {
    throw new Error(`Mock write calls differ from the lifecycle contract: ${JSON.stringify(writeCalls)}`);
  }
  if ((db.networkAttempts || []).length !== 0) {
    throw new Error('Source lifecycle attempted a blocked network primitive');
  }
  return {
    stateRevision: state.revision,
    stateResourceTypes: Object.keys(state.resources).sort(),
    bindingResourceTypes: Object.keys(state.resources || {}).sort(),
    stateFileBytes: fs.statSync(statePath).size,
    workspaceHash: sha256(workspace),
    identitiesMatchRemote: true,
    processVersion: processResource.active.processVersion,
    processHistoricalVersions: processResource.historical.map(identity => identity.processVersion),
    processFormBindingVerified: true,
    fieldBindingIdentitiesVerified: true,
    processNodeBindingIdentitiesVerified: true,
    bindingContractNegativeCases,
    exactWriteCalls: writeCalls,
    networkAttempts: 0,
    finalJournalOperations: 0,
  };
}

function collectRemoteFieldIdentities(value, result = new Map()) {
  if (Array.isArray(value)) {
    for (const child of value) {
      collectRemoteFieldIdentities(child, result);
    }
    return result;
  }
  if (!isPlainRecord(value)) {
    return result;
  }
  const fieldId = value.fieldId || value.props && value.props.fieldId;
  if (typeof fieldId === 'string' && fieldId && typeof value.componentName === 'string' && value.componentName) {
    if (result.has(fieldId)) {
      throw new Error('Remote form contains duplicate field identity');
    }
    result.set(fieldId, { componentName: value.componentName });
  }
  for (const child of Object.values(value)) {
    collectRemoteFieldIdentities(child, result);
  }
  return result;
}

function countCalls(calls, predicate) {
  const counts = {};
  for (const call of calls || []) {
    if (predicate(call.name)) {
      counts[call.name] = (counts[call.name] || 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function runMockContractProbe(commandEnv, workspace) {
  const sourceDbPath = commandEnv.OPENYIDA_SCHEMA_SOURCE_MOCK_DB;
  const probeDbPath = path.join(workspace, 'mock-process-contract-probe.json');
  fs.copyFileSync(sourceDbPath, probeDbPath);
  const script = `(async () => {
    const harness = global.__OPENYIDA_SCHEMA_SOURCE_MOCK_HARNESS__;
    if (!harness || typeof harness.runNegativeProcessContractChecks !== 'function') {
      throw new Error('mock contract harness unavailable');
    }
    process.stdout.write(JSON.stringify(await harness.runNegativeProcessContractChecks()));
  })().catch((error) => { process.stderr.write(error.message); process.exit(1); });`;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: workspace,
    env: { ...commandEnv, OPENYIDA_SCHEMA_SOURCE_MOCK_DB: probeDbPath },
    encoding: 'utf8',
    timeout: DEFAULT_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    if (result.error || result.status !== 0) {
      throw new Error(`Process mock contract probe failed: ${result.error ? result.error.message : result.stderr}`);
    }
    const evidence = JSON.parse(result.stdout);
    if (!evidence || Object.values(evidence).some(value => value !== true)) {
      throw new Error(`Process mock contract probe did not reject every invalid identity: ${result.stdout}`);
    }
    return evidence;
  } finally {
    fs.rmSync(probeDbPath, { force: true });
  }
}

function assertMixedModeBindings(statePath, dbPath) {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const apps = Object.values(db.apps || {});
  const forms = Object.values(db.forms || {});
  const processes = Object.values(db.processes || {});
  if (apps.length !== 1 || forms.length !== 2 || processes.length !== 1) {
    throw new Error('mixed-mode mock remote DB must contain exactly one app, two forms, and one process');
  }
  const appState = state.resources && state.resources.app && state.resources.app.opsSystem;
  const receiptState = state.resources && state.resources.form && state.resources.form.deviceRegistry;
  const processFormState = state.resources && state.resources.form && state.resources.form.changeApproval;
  const processState = state.resources && state.resources.process && state.resources.process.changeFlow;
  if (!appState || !receiptState || !processFormState || !processState) {
    throw new Error('mixed-mode state must include app, receipt form, process form, and process resources');
  }
  const [app] = apps;
  const receiptForm = forms.find(form => form.formUuid === receiptState.bindings.formUuid);
  const processForm = forms.find(form => form.formUuid === processFormState.bindings.formUuid);
  const [processResource] = processes;
  if (
    appState.bindings.appType !== app.appType ||
    !receiptForm || receiptForm.appType !== app.appType ||
    !processForm || processForm.appType !== app.appType
  ) {
    throw new Error('mixed-mode state identity bindings do not match the mock remote resources');
  }
  if (receiptForm.mode !== 'receipt' || receiptForm.processCode !== null || receiptState.bindings.processCode !== undefined) {
    throw new Error('mixed-mode receipt form must stay unbound from any process');
  }
  if (
    processForm.mode !== 'process' ||
    !processForm.processCode ||
    processForm.processCode !== processResource.processCode ||
    processFormState.bindings.processCode !== processResource.processCode ||
    processFormState.lastApplied.mode !== 'process'
  ) {
    throw new Error('mixed-mode process form must be bound to the created process');
  }
  if (
    processState.bindings.appType !== app.appType ||
    processState.bindings.formUuid !== processForm.formUuid ||
    processState.bindings.processCode !== processResource.processCode ||
    processState.bindings.processId !== processResource.active.processId ||
    processState.bindings.processVersion !== processResource.active.processVersion ||
    processResource.active.processVersion !== 1 ||
    processResource.draft !== null ||
    JSON.stringify(processResource.historical.map(identity => identity.processVersion)) !== JSON.stringify([0])
  ) {
    throw new Error('mixed-mode process version or form ownership evidence is inconsistent');
  }
  if (
    !isPlainRecord(processResource.activeProcessJson) ||
    !isSha256(processResource.activeProcessJsonHash) ||
    stableObjectHash(processResource.activeProcessJson) !== processResource.activeProcessJsonHash
  ) {
    throw new Error('mixed-mode process payload hash does not match the source managed definition');
  }
  assertFieldBindingRelationships(
    receiptState.bindings.fieldBindings,
    receiptForm.content,
    (receiptState.lastApplied.fields || []).map(field => field.semanticPath),
    'mixed-mode receipt form'
  );
  assertFieldBindingRelationships(
    processFormState.bindings.fieldBindings,
    processForm.content,
    (processFormState.lastApplied.fields || []).map(field => field.semanticPath),
    'mixed-mode process form'
  );
  assertProcessNodeBindingRelationships(
    processState.bindings.nodeBindings,
    processState.lastApplied.nodes,
    processResource.activeProcessJson,
    'mixed-mode process'
  );
  const writeCalls = countCalls(db.calls, name => /^(create|update|convert|save|publish):/.test(name));
  const expectedWriteCalls = {
    'create:app': 1,
    'create:form': 2,
    'create:process-draft': 1,
    'publish:process': 1,
    'save:process': 1,
  };
  if (JSON.stringify(writeCalls) !== JSON.stringify(expectedWriteCalls)) {
    throw new Error(`mixed-mode mock write calls differ from the lifecycle contract: ${JSON.stringify(writeCalls)}`);
  }
  if ((db.networkAttempts || []).length !== 0) {
    throw new Error('mixed-mode lifecycle attempted a blocked network primitive');
  }
  return {
    identitiesMatchRemote: true,
    receiptFormMode: receiptForm.mode,
    processFormMode: processForm.mode,
    processFormBoundToProcess: true,
    processVersion: processResource.active.processVersion,
    exactWriteCalls: writeCalls,
    networkAttempts: 0,
  };
}

function runMixedModeLifecycle() {
  const rawWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-mixed-e2e-'));
  fs.mkdirSync(rawWorkspace, { recursive: true, mode: 0o700 });
  const workspace = fs.realpathSync(rawWorkspace);
  try {
    ensureWorkspace(workspace);
    const launcher = createLauncher(workspace);
    const commandEnv = buildEnv(workspace, launcher);
    const statePath = path.join(workspace, '.cache', 'openyida', 'schema-source', 'state.v1.json');
    const manifestPath = path.join(workspace, 'manifests', 'mixed-mode.json');
    writeJson(manifestPath, mixedModeManifest());

    const validation = runSchemaValidate(commandEnv, workspace, manifestPath);
    const plan = runSchemaPlan(commandEnv, workspace, manifestPath, statePath);
    assertExactCounts(plan, planCounts(4, 0, 0), 'mixed-mode plan');
    const apply = runSchemaApply(commandEnv, workspace, manifestPath, statePath, plan.planId);
    assertExactCounts(apply, applyCounts(4, 0, 0), 'mixed-mode apply');
    const journal = assertCompletedJournal(
      statePath,
      plan,
      'mixed-mode',
      commandEnv.OPENYIDA_SCHEMA_SOURCE_MOCK_DB
    );

    const confirmPlan = runSchemaPlan(commandEnv, workspace, manifestPath, statePath);
    assertNoop(confirmPlan, 'mixed-mode confirm plan', 4);
    const confirmApply = runSchemaApply(commandEnv, workspace, manifestPath, statePath, confirmPlan.planId);
    assertNoop(confirmApply, 'mixed-mode confirm apply', 4, 'apply');

    return {
      id: 'mixed-mode-manifest',
      prompt: '同一个应用同时搭建普通表单和流程表单（receipt + process form + process）',
      status: 'applied',
      manifestHash: validation.manifestHash,
      planId: plan.planId,
      counts: {
        plan: plan.counts,
        apply: apply.counts,
        confirmPlan: confirmPlan.counts,
        confirmApply: confirmApply.counts,
      },
      journal,
      ...assertMixedModeBindings(statePath, commandEnv.OPENYIDA_SCHEMA_SOURCE_MOCK_DB),
    };
  } finally {
    fs.rmSync(rawWorkspace, { recursive: true, force: true });
  }
}

function writeResult(resultDir, summary) {
  fs.mkdirSync(resultDir, { recursive: true });
  const resultPath = path.join(resultDir, `${summary.runId}.json`);
  writeJson(resultPath, summary);
  writeJson(path.join(resultDir, 'latest.json'), summary);
  return resultPath;
}

function run(options = {}) {
  const runId = options.runId || `schema-source-${nowStamp()}`;
  const resultDir = options.resultDir || process.env.OPENYIDA_SCHEMA_SOURCE_E2E_RESULT_DIR || DEFAULT_RESULT_DIR;
  const rawWorkspace = options.workspace || fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-schema-source-e2e-'));
  fs.mkdirSync(rawWorkspace, { recursive: true, mode: 0o700 });
  const workspace = fs.realpathSync(rawWorkspace);
  const createdWorkspace = !options.workspace;
  const summary = {
    runId,
    startedAt: new Date().toISOString(),
    source: {
      cli: {
        bin: toPortableRelative(ROOT, fs.realpathSync(SOURCE_BIN)),
        binSha256: hashFile(SOURCE_BIN),
      },
      skills: readSourceSkillEvidence(),
    },
    scenarios: [],
    cleanup: {
      tempWorkspaceRemoved: false,
    },
  };

  try {
    ensureWorkspace(workspace);
    const launcher = createLauncher(workspace);
    const commandEnv = buildEnv(workspace, launcher);
    const versionResult = runCommand(commandEnv, workspace, ['--version']);
    if (versionResult.status !== 0 || !versionResult.stdout.trim()) {
      throw new Error('source launcher version probe failed');
    }
    assertNoSensitiveStdio(versionResult.stdout, 'version stdout');

    const statePath = path.join(workspace, '.cache', 'openyida', 'schema-source', 'state.v1.json');
    for (const scenario of scenarioDefinitions()) {
      const result = scenario.supported
        ? runSupportedScenario(commandEnv, workspace, statePath, scenario)
        : runBoundaryScenario(commandEnv, workspace, statePath, scenario);
      summary.scenarios.push(result);
    }

    const finalScenario = scenarioDefinitions().find((scenario) => scenario.id === 'crm-page-source-update');
    const finalManifestPath = writeScenarioManifest(workspace, {
      ...finalScenario,
      id: 'crm-final-noop',
    });
    const finalPlan = runSchemaPlan(commandEnv, workspace, finalManifestPath, statePath);
    assertNoop(finalPlan, 'crm-final-noop plan', 4);
    const finalApply = runSchemaApply(commandEnv, workspace, finalManifestPath, statePath, finalPlan.planId);
    assertNoop(finalApply, 'crm-final-noop apply', 4, 'apply');
    summary.scenarios.push({
      id: 'crm-final-noop',
      prompt: '同一 CRM 系统 Manifest 再次 plan/apply',
      status: 'noop',
      counts: {
        plan: finalPlan.counts,
        apply: finalApply.counts,
      },
    });

    summary.launcher = assertLauncherTrace(launcher.tracePath, launcher.launcherPath);
    summary.state = assertStateAndBindings(workspace, statePath, commandEnv.OPENYIDA_SCHEMA_SOURCE_MOCK_DB);
    summary.processMockContracts = runMockContractProbe(commandEnv, workspace);
    summary.mixedMode = runMixedModeLifecycle();
    summary.finishedAt = new Date().toISOString();
    summary.status = 'passed';
    return summary;
  } catch (error) {
    summary.finishedAt = new Date().toISOString();
    summary.status = 'failed';
    summary.error = {
      message: error.message,
    };
    throw Object.assign(error, { summary });
  } finally {
    if (createdWorkspace) {
      fs.rmSync(rawWorkspace, { recursive: true, force: true });
      summary.cleanup.tempWorkspaceRemoved = !fs.existsSync(rawWorkspace) && !fs.existsSync(workspace);
    }
    writeResult(resultDir, summary);
  }
}

if (require.main === module) {
  const resultDir = process.env.OPENYIDA_SCHEMA_SOURCE_E2E_RESULT_DIR || DEFAULT_RESULT_DIR;
  try {
    const summary = run();
    console.log(JSON.stringify({
      ok: true,
      runId: summary.runId,
      scenarios: summary.scenarios.map((scenario) => ({
        id: scenario.id,
        status: scenario.status,
        phase: scenario.phase,
      })),
      mixedMode: summary.mixedMode ? summary.mixedMode.status : null,
      result: path.join(resultDir, `${summary.runId}.json`),
    }));
  } catch (error) {
    const summary = error.summary || {};
    console.error(JSON.stringify({
      ok: false,
      runId: summary.runId || null,
      error: error.message,
      result: summary.runId ? path.join(resultDir, `${summary.runId}.json`) : null,
    }));
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_RESULT_DIR,
  SOURCE_BIN,
  SOURCE_SKILL_ROOT,
  assertNoSensitiveStdio,
  buildEnv,
  createLauncher,
  ensureWorkspace,
  isUnsupportedPayload,
  readSourceSkillEvidence,
  run,
  scenarioDefinitions,
  crmManifest,
};
