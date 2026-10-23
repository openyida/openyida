#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(ROOT, 'yida-skills', 'skills');

const SKILL_COVERAGE = {
  'yida-custom-button': { level: 'offline-unit', commands: ['custom-button list/inspect/options/create/update/delete'], tests: ['tests/custom-button.test.js', 'tests/agent-managed-policy.test.js'], reason: 'Tests cover native payloads, metadata references, display bindings, backups, conflicts, single-attempt mutations, readback and managed app scope. Live configuration writes and runtime execution require an authorized target and are not part of the shared runner.' },
  'yida-form-message': { level: 'offline-unit', commands: ['form-message list/inspect/options/create/update/delete'], tests: ['tests/form-message.test.js', 'tests/agent-managed-policy.test.js', 'tests/agent-mutation-receipt.test.js'], reason: 'Tests cover native binding reads, seven templates, verified ordinary-form triggers, recipients, field references, complete-list conflicts, backups, one-shot mutations, readback and managed app scope. Shared E2E never creates bindings or triggers delivery; live writes and actual messages require an explicitly authorized test form and recipients.' },
  'yida-task-center': { level: 'offline-unit', commands: ['task-center capabilities/scaffold/options/inspect/count', 'data query tasks'], tests: ['tests/task-center.test.js', 'tests/task-center-contract.test.js', 'tests/task-center-lookups.test.js', 'tests/task-center-scaffold.test.js', 'tests/task-center-runtime.test.js', 'tests/task-center-workflow.test.js', 'tests/task-center-progress-runtime.test.js', 'tests/task-center-contract-alignment.test.js'], reason: 'Offline CLI, documentation replay, task/workflow contracts, managed scope and generated-component behavior; runtime data, permissions, model routing and visual acceptance still require an owned application and explicit evaluation.' },
  'yida-cool-card': { level: 'offline-unit', commands: ['cool-card list/templates/create/get', 'app-settings', 'sample yida-cool-card project-brief', 'dws install/setup'], tests: ['tests/cool-card.test.js', 'tests/sample.test.js', 'tests/dws-wrapper.test.js', 'tests/dws-integration.test.js', 'tests/native-card-contract-alignment.test.js'], reason: 'Contracts cover resource identity, allowlisted one-shot creation, readback recovery, pagination, full snapshot export, platform entitlement errors and managed app scope. No automatic live writes or sends. Configuration save/publication through the external editor authentication flow remains unsupported.' },
  'yida-data-card': { level: 'offline-unit', commands: ['data-card list/create/get/save/publish/probe/release-get/release-save/release-check/release-test/refs', 'app-settings'], tests: ['tests/data-card.test.js', 'tests/data-card-builder.test.js', 'tests/data-card-release.test.js', 'tests/agent-managed-policy.test.js', 'tests/native-card-contract-alignment.test.js'], reason: 'Mock contracts cover native creation, multi-chart generation, verified fields, chart capacity, filter scope, runtime probes, broadcast configuration/readback, send consent, usage pagination, draft hashes, backup/readback, separate publication, i18n and application scope. Live writes require an explicitly authorized app/card and are never part of shared E2E defaults; verify native designer editing and real data rendering separately.' },
  'yida-form-view': { level: 'offline-unit', commands: ['form-view list/inspect/save/create/order'], tests: ['tests/form-view.test.js', 'tests/agent-managed-policy.test.js', 'scripts/e2e-real/fixtures/form-view-fields.json'], reason: 'Unit tests cover native view reads, setting patches, hashes, backups, replacement/readback and managed-app scope. Real writes require a dedicated authorized regression form; shared full-runner defaults never alter existing view settings. Desktop acceptance must verify actual columns, filtering and horizontal scrolling.' },
  'yida-print-template': { level: 'offline-unit', commands: ['print-template list/inspect/fields/build/create/copy/save/restore/settings/status/order/render/files', 'print-template list/render --detail-url', 'sample yida-print-template'], tests: ['tests/print-template.test.js', 'tests/sample.test.js', 'tests/agent-managed-policy.test.js'], reason: 'Unit tests cover native payloads, six document scenarios, QR/barcode fields, record-detail URL parsing, authorized runtime rendering, backups, conflicts and readback. Live template writes and PDF output need an explicitly authorized app and record; they are excluded from the shared real E2E runner.' },
  'yida-aggregate-table': { level: 'opt-in-real-e2e', stages: ['aggregate'], commands: ['aggregate-table inspect/preview/save/publish/status'], tests: ['tests/aggregate-table.test.js', 'tests/aggregate-table-contract.test.js', 'tests/e2e-real-aggregate-runner.test.js'], reason: 'aggregate writes require an explicitly owned target and fixed designer fixture; runtime query and physical delete remain PLATFORM_PROBE_REQUIRED, so this domain runner is never part of shared full-runner defaults' },
  'yida-app': { level: 'real-e2e', stages: ['app', 'form', 'page', 'data', 'report', 'dashboard'] },
  'yida-solution-template': { level: 'offline-unit', commands: ['solution-template search/detail/ai-build/enable/status'], tests: ['tests/solution-template.test.js', 'tests/agent-managed-policy.test.js'], reason: 'Unit tests cover catalog/detail reads, native AI handoff truthfulness, one-shot direct enable, durable receipts, target isolation, timeout recovery and ambiguous readback. Shared real E2E performs no template enable because it creates an application; live enable requires an explicitly authorized target name and separate UI acceptance.' },
  'yida-upgrade-app-theme': { level: 'offline-unit', tests: ['tests/upgrade-app-theme.test.js', 'tests/prepare-app-theme-upgrade.test.js', 'tests/cli-smoke.test.js'], reason: 'Requires an explicit upgrade request and ask_human confirmation; mock-only tests cover authorization gates, agentAppType-only eligibility, creation-marker/theme-mode writes, partial failure and pair readback. Never upgrade a shared E2E app automatically.' },
  'yida-app-lifecycle': { level: 'offline-unit', tests: ['tests/app-lifecycle.test.js', 'tests/cli-smoke.test.js'], reason: 'online/offline commands change real app availability; request contracts and agent permission metadata are validated with mocks and never run in shared real E2E' },
  'yida-app-permission': { level: 'offline-unit', tests: ['tests/app-permission.test.js'], reason: 'app admin mutations affect real application access; shared real E2E only validates safe read paths' },
  'yida-requirement-analysis': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'tests/skill-contracts.test.js'], reason: 'writes only a local structured requirements file used by the parallel PRD and visual design skills' },
  'yida-prd': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'routing eval scenarios', 'tests/skill-contracts.test.js'], reason: 'writes only the local Product PRD file and is validated through routing, output scope and consistency contracts without mutating Yida resources' },
  'yida-design': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'routing eval scenarios', 'tests/create-form.test.js', 'tests/skill-contracts.test.js'], reason: 'writes only the visual design file from the organized user requirements; validate routing, packaging, visual scope and form theme payloads rather than mutating Yida resources or tenant-wide theme config' },
  'yida-image-assets': { level: 'offline-unit', tests: ['tests/asset.test.js', 'tests/agent-capabilities.test.js', 'tests/skill-contracts.test.js', 'routing eval scenarios'], reason: 'host image tools and stock providers vary by runtime and may cause network, license, or CDN side effects; shared E2E validates capability declarations, routing, source policy, and honest fallback without downloading or publishing third-party media' },
  'yida-basic-info': { level: 'offline-unit', tests: ['tests/basic-info.test.js'], reason: 'basic-info reads org admin metadata and can update domains; unit coverage avoids mutating shared real org settings' },
  'yida-business-rule': { level: 'opt-in', reason: 'business association rules mutate form event configuration; validate in a dedicated real-form/UI stage before adding to deterministic shared E2E' },
  'yida-canvas-custom-page': { level: 'offline-unit', tests: ['skill metadata and packaging validation'], reason: 'YidaCodeCanvas authoring is published through the shared publish command; shared real E2E validates metadata and routing here, while page mutation remains covered by dedicated publish scenarios' },
  'yida-canvas-data-binding': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'routing eval scenarios', 'tests/page-linter.test.js', 'tests/task-center-contract-alignment.test.js', 'tests/task-center-workflow.test.js', 'tests/task-center-progress-runtime.test.js'], reason: 'Canvas DataBridge/source contracts and optional workflow components have offline checks; real form reads, visitor permissions and published-page verification require opt-in acceptance.' },
  'yida-canvas-table-form': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'tests/sample.test.js', 'tests/canvas-compile.test.js'], reason: 'Canvas table-form sample and writeBridge guardrails are validated by metadata/package checks plus sample/canvas compile tests; real write closure requires dedicated bridge verification and is excluded from shared real E2E' },
  'yida-canvas-upgrade': { level: 'offline-unit', tests: ['skill metadata and packaging validation'], reason: 'platform JSX component page migration emits source/report artifacts and may publish through .canvas.jsx after verification; shared real E2E validates metadata and routing to avoid overwriting existing pages' },
  'yida-chart': { level: 'real-e2e', stages: ['report', 'dashboard'], tests: ['report chart config generation'] },
  'yida-connector': { level: 'offline', stages: ['connector-local'], commands: ['connector gen-template', 'connector parse-api'] },
  'yida-connector-safe-actions': { level: 'offline', stages: ['connector-local'], commands: ['connector parse-api', 'connector test --action <operationId>'], reason: 'skill documents conservative HTTP connector action generation and repair workflow; shared E2E should validate local parsing without mutating tenant connectors' },
  'yida-corp-efficiency': { level: 'offline-unit', tests: ['tests/corp-efficiency.test.js'], reason: 'enterprise efficiency queries and notify mutations are not safe for shared real org E2E' },
  'yida-corp-manager': { level: 'offline-unit', tests: ['tests/corp-manager.test.js'], reason: 'enterprise admin mutations are not safe for shared real org E2E' },
  'yida-create-app': { level: 'real-e2e', stages: ['app'], commands: ['create-app'] },
  'yida-create-form-page': { level: 'real-e2e', stages: ['form'], commands: ['create-form create', 'create-form update', 'create-form add-option'] },
  'yida-create-page': { level: 'real-e2e', stages: ['page', 'dashboard'], commands: ['create-page --mode dashboard', 'create-page --mode dashboard --hide-nav'] },
  'yida-create-process': { level: 'opt-in-real-e2e', stages: ['process'], commands: ['create-process --formUuid'], reason: 'process stage mutates workflow definitions and is excluded from default full E2E unless explicitly requested' },
  'yida-custom-page': { level: 'real-e2e', stages: ['page'], commands: ['check-page', 'build-page', 'compile', 'publish'] },
  'yida-dashboard': { level: 'real-e2e', stages: ['dashboard'], commands: ['create-page --mode dashboard', 'create-page --mode dashboard --hide-nav', 'publish dashboard skill page'] },
  'yida-data-source-connectors': { level: 'offline-unit', tests: ['skill metadata and packaging validation'], reason: 'skill defines a page Schema/dataSource authoring guardrail; real connector execution mutates tenant-specific connector/data source configuration and should be validated in dedicated page publish scenarios' },
  'yida-data-management': { level: 'real-e2e', stages: ['data', 'task'], commands: ['data create/query/update form', 'data query tasks'], tests: ['tests/query-data.test.js', 'tests/task-center.test.js', 'tests/task-center-workflow.test.js', 'tests/task-center-contract-alignment.test.js'], reason: 'Existing data/task stages provide real E2E coverage; task-center inspect/count and documented filter combinations are covered offline, not by the shared real stages.' },
  'yida-data-manage-ui': { level: 'offline-unit', commands: ['data-manage-style guide', 'data-manage-style list', 'data-manage-style generate'], tests: ['tests/data-manage-style.test.js', 'routing eval scenarios', 'skill metadata and packaging validation'], reason: 'Offline guidance exposes composable UI dimensions, token/CSS targets and state checks without requiring a preset. Optional recipe regressions preserve page scope, geometry and idempotent merging. Freeform styling and custom data binding still require verification on the authorized real page.' },
  'yida-db-seq-fix': { level: 'offline-unit', tests: ['tests/db-seq-fix.test.js'], reason: 'PostgreSQL admin repair is not safe for shared real org E2E' },
  'yida-density': { level: 'offline-unit', tests: ['sample/check-page coverage'], reason: 'visual density template is validated through page build/lint rather than real data mutation' },
  'yida-dingtalk-openapi': { level: 'offline-unit', tests: ['tests/dingtalk-openapi-skill.test.js', 'tests/connector-auth-safety.test.js', 'tests/canvas-compile.test.js'], reason: 'DingTalk OpenAPI contract routing, secret isolation, unsupported inbound-event guard, and Canvas connector bridge are deterministic offline; real DingAuth requires user-owned credentials and an explicitly authorized tenant connector' },
  'yida-document-markdown': { level: 'offline-unit', tests: ['tests/document-tools.test.js'], reason: 'document content depends on authenticated tenant data; unit coverage validates endpoint parameters, text response handling, envelope unwrapping, output modes, and error behavior' },
  'yida-export-conversation': { level: 'offline-unit', tests: ['conversation exporter unit coverage'], reason: 'depends on local conversation artifacts, not Yida API' },
  'yida-flash-note-to-prd': { level: 'opt-in', stages: ['ai'], commands: ['flash-to-prd'], reason: 'remote AI service can timeout; excluded from deterministic default full run' },
  'yida-flow-node-config': { level: 'offline-unit', tests: ['tests/skill-contracts.test.js', 'tests/flow-node-roles.test.js', 'tests/process-field-permissions.test.js', 'tests/integration-batch-data.test.js'], reason: 'shared node configuration has no standalone write command; offline contracts cover routing, actors, field permissions and batch payloads, while authorized real writes remain in the process and integration domain stages' },
  'yida-form-permission': { level: 'real-e2e', stages: ['permission'], commands: ['get-permission'] },
  'yida-formula': { level: 'offline-unit', stages: ['offline'], commands: ['formula check', 'formula evaluate', 'formula contracts'],
    tests: ['tests/formula-contract-alignment.test.js', 'tests/formula-support.test.js', 'tests/formula-commands.test.js', 'tests/formula-runtime.test.js', 'tests/formula-normalize.test.js'],
    reason: 'The offline stage runs static CLI checks. Unit tests execute Skill examples and mock current metadata, component types, saved/candidate formulas and native field cases; they do not replace authorized live-app or browser acceptance.' },
  'yida-formula-evaluate': { level: 'offline-unit', stages: ['offline'], commands: ['formula check', 'formula evaluate', 'formula contracts'],
    tests: ['tests/formula-contract-alignment.test.js', 'tests/formula-evaluate.test.js', 'tests/formula-commands.test.js', 'tests/formula-runtime.test.js'],
    reason: 'CLI routing, strict diagnostics and parameter combinations are tested offline; metadata/schema/endpoint and field-runtime requests are mocked, not claimed as real platform execution.' },
  'yida-get-schema': { level: 'real-e2e', stages: ['form'], commands: ['get-schema', 'get-schema --all', 'get-schema --field'] },
  'yida-i18n': { level: 'offline-unit', tests: ['tests/i18n-management.test.js'], reason: 'multilingual management writes app language config and copy entries; shared real E2E should only run read-only overview on dedicated intl apps' },
  'yida-integration': { level: 'opt-in', reason: 'creates backend automation flows; should run in a separate integration stage with cleanup/audit controls' },
  'yida-agent-center': { level: 'offline-unit', tests: ['tests/agent-center.test.js'], reason: 'process delegation mutates real user-agent relationships; shared real E2E must avoid changing organization delegation settings' },
  'yida-login': { level: 'real-e2e', stages: ['auth'], commands: ['login --check-only --json'] },
  'yida-logout': { level: 'offline-unit', tests: ['login/auth unit coverage'], reason: 'real logout would destroy the shared E2E session' },
  'yida-nav-group': { level: 'offline-unit', tests: ['tests/nav-group.test.js'], reason: 'navigation grouping mutates app sidebar order; unit coverage validates payloads and tree operations until a dedicated cleanup-safe nav stage exists' },
  'yida-nav-shell': { level: 'offline-unit', tests: ['skill metadata and packaging validation'], reason: 'page-internal JSX navigation shell is an authoring pattern, not a standalone CLI command; validate skill packaging and use custom-page/design generation fixtures for runtime page coverage' },
  'yida-openyida-publish-guard': { level: 'offline-unit', tests: ['skill metadata and packaging validation'], reason: 'publish guard is an agent workflow safety rule for comparing live schema before publish; real page publish behavior remains covered by yida-publish-page E2E stages' },
  'yida-page-config': { level: 'real-e2e', stages: ['share'], commands: ['get-page-config', 'verify-short-url', 'save-share-config'] },
  'yida-ppt-slider': { level: 'offline-unit', reason: 'presentation-style custom page skill should be validated by page generation/check-page fixtures' },
  'yida-process-rule': { level: 'opt-in-real-e2e', stages: ['process'], commands: ['configure-process'], reason: 'process stage publishes workflow rules on the disposable E2E form and is excluded from default full E2E unless explicitly requested' },
  'yida-publish-page': { level: 'real-e2e', stages: ['page', 'dashboard'], commands: ['publish --health-check'] },
  'yida-rechart': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'tests/sample.test.js', 'tests/canvas-compile.test.js'], reason: 'YidaCodeCanvas Recharts skill is covered by metadata/package validation plus sample/canvas compile tests; it consumes already aggregated data and does not perform real Yida remote writes in shared E2E' },
  'yida-report': { level: 'real-e2e', stages: ['report'], commands: ['create-report', 'append-chart', 'report inspect'], tests: ['scripts/e2e-real/report/runner.js platform/runtime/ui package probe'] },
  'yida-table-form': { level: 'offline-unit', reason: 'table-form custom page template should be validated with check-page fixture before real publish stage is added' },
  'yida-tingji': { level: 'offline-unit', tests: ['tests/document-tools.test.js'], reason: 'Tingji content depends on authenticated tenant data; unit coverage validates taskUuid passthrough, response handling, and error behavior' },
  'yida-skill-evaluator': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'eval test suites'], reason: 'evaluator skill reads and scores other skills; no Yida API mutation' },
  'yida-feedback': { level: 'offline-unit', tests: ['tests/feedback-report.test.js', 'tests/feedback-github.test.js'], reason: 'Local report preparation and mocked GitHub account/Star/Fork checks; actual Star, Fork and Issue submission require user authorization and never run in shared E2E.' },
  'yida-voc': { level: 'offline-unit', reason: 'VOC formatting skill is local text transformation, not Yida API mutation' },
};

function listSkillNames(skillsDir = SKILLS_DIR) {
  return fs.readdirSync(skillsDir)
    .filter((name) => fs.statSync(path.join(skillsDir, name)).isDirectory())
    .sort();
}

function validateSkillCoverage(options = {}) {
  const skillsDir = options.skillsDir || SKILLS_DIR;
  const coverage = options.coverage || SKILL_COVERAGE;
  const skillNames = options.skillNames || listSkillNames(skillsDir);
  const missing = skillNames.filter((name) => !coverage[name]);
  const extra = Object.keys(coverage).filter((name) => !skillNames.includes(name)).sort();
  const invalid = Object.entries(coverage)
    .filter(([, entry]) => !entry || !entry.level)
    .map(([name]) => name);

  return {
    ok: missing.length === 0 && extra.length === 0 && invalid.length === 0,
    checked: skillNames.length,
    missing,
    extra,
    invalid,
    coverage,
  };
}

function run(options = {}) {
  const result = validateSkillCoverage(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Skill E2E coverage: checked ${result.checked} skills`);
    for (const name of Object.keys(result.coverage).sort()) {
      const entry = result.coverage[name];
      console.log(`- ${name}: ${entry.level}`);
    }
  }

  if (!result.ok) {
    if (!options.json) {
      if (result.missing.length) {console.error(`Missing coverage: ${result.missing.join(', ')}`);}
      if (result.extra.length) {console.error(`Coverage entries without skill: ${result.extra.join(', ')}`);}
      if (result.invalid.length) {console.error(`Invalid coverage entries: ${result.invalid.join(', ')}`);}
    }
    process.exit(1);
  }

  return result;
}

if (require.main === module) {
  run({ json: process.argv.includes('--json') });
}

module.exports = {
  SKILL_COVERAGE,
  listSkillNames,
  run,
  validateSkillCoverage,
};
