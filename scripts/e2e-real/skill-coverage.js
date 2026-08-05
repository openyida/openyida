#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(ROOT, 'yida-skills', 'skills');

const SKILL_COVERAGE = {
  'yida-app': { level: 'real-e2e', stages: ['app', 'form', 'page', 'data', 'report', 'dashboard'] },
  'yida-app-lifecycle': { level: 'offline-unit', tests: ['tests/app-lifecycle.test.js', 'tests/cli-smoke.test.js'], reason: 'online/offline commands change real app availability; request contracts and agent permission metadata are validated with mocks and never run in shared real E2E' },
  'yida-app-permission': { level: 'offline-unit', tests: ['tests/app-permission.test.js'], reason: 'app admin mutations affect real application access; shared real E2E only validates safe read paths' },
  'yida-design': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'routing eval scenarios', 'tests/create-form.test.js', 'tests/skill-contracts.test.js'], reason: 'application experience blueprint, visual direction and theme token guidance produce PRD/design artifacts before missing app/form/process/page resources are created; validate routing, packaging, skill contracts and form theme payloads rather than mutating Yida resources or tenant-wide theme config' },
  'yida-basic-info': { level: 'offline-unit', tests: ['tests/basic-info.test.js'], reason: 'basic-info reads org admin metadata and can update domains; unit coverage avoids mutating shared real org settings' },
  'yida-business-rule': { level: 'opt-in', reason: 'business association rules mutate form event configuration; validate in a dedicated real-form/UI stage before adding to deterministic shared E2E' },
  'yida-canvas-custom-page': { level: 'offline-unit', tests: ['skill metadata and packaging validation'], reason: 'Code Canvas authoring skill has no dedicated CLI command; runtimeCode/importedModules are produced by the platform compile service and a YidaCodeCanvas schema cannot be published via openyida, so shared real E2E validates skill metadata and routing rather than mutating a real page' },
  'yida-canvas-data-binding': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'routing eval scenarios', 'tests/page-linter.test.js'], reason: 'Canvas data binding skill defines DataBridge/source-contract authoring guardrails; real form reads and published page verification are covered by page linter checks and opt-in publish scenarios' },
  'yida-canvas-table-form': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'tests/sample.test.js', 'tests/canvas-compile.test.js'], reason: 'Canvas table-form sample and writeBridge guardrails are validated by metadata/package checks plus sample/canvas compile tests; real write closure requires dedicated bridge verification and is excluded from shared real E2E' },
  'yida-canvas-upgrade': { level: 'offline-unit', tests: ['skill metadata and packaging validation'], reason: 'ordinary custom page to Code Canvas migration skill emits source/report artifacts but has no CLI publish path for YidaCodeCanvas; validated via skill metadata and routing until a Canvas publish stage exists' },
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
  'yida-data-management': { level: 'real-e2e', stages: ['data', 'task'], commands: ['data create/query/update form', 'data query tasks'] },
  'yida-db-seq-fix': { level: 'offline-unit', tests: ['tests/db-seq-fix.test.js'], reason: 'PostgreSQL admin repair is not safe for shared real org E2E' },
  'yida-density': { level: 'offline-unit', tests: ['sample/check-page coverage'], reason: 'visual density template is validated through page build/lint rather than real data mutation' },
  'yida-document-markdown': { level: 'offline-unit', tests: ['tests/document-tools.test.js'], reason: 'document content depends on authenticated tenant data; unit coverage validates endpoint parameters, text response handling, envelope unwrapping, output modes, and error behavior' },
  'yida-export-conversation': { level: 'offline-unit', tests: ['conversation exporter unit coverage'], reason: 'depends on local conversation artifacts, not Yida API' },
  'yida-flash-note-to-prd': { level: 'opt-in', stages: ['ai'], commands: ['flash-to-prd'], reason: 'remote AI service can timeout; excluded from deterministic default full run' },
  'yida-form-detail': { level: 'offline-unit', tests: ['tests/form-detail-style.test.js', 'tests/skill-contracts.test.js'], reason: 'form-detail-style mutates real form Schema; shared E2E validates the form stage while unit and contract tests cover default Html/CSS injection behavior' },
  'yida-form-permission': { level: 'real-e2e', stages: ['permission'], commands: ['get-permission'] },
  'yida-formula': { level: 'offline', stages: ['offline'], commands: ['formula evaluate'] },
  'yida-formula-evaluate': { level: 'offline', stages: ['offline'], commands: ['formula evaluate --json'] },
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
  'yida-rechart': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'tests/sample.test.js', 'tests/canvas-compile.test.js'], reason: 'Code Canvas Recharts skill is covered by metadata/package validation plus sample/canvas compile tests; it consumes already aggregated data and does not perform real Yida remote writes in shared E2E' },
  'yida-report': { level: 'real-e2e', stages: ['report'], commands: ['create-report', 'append-chart'] },
  'yida-table-form': { level: 'offline-unit', reason: 'table-form custom page template should be validated with check-page fixture before real publish stage is added' },
  'yida-tingji': { level: 'offline-unit', tests: ['tests/document-tools.test.js'], reason: 'Tingji content depends on authenticated tenant data; unit coverage validates taskUuid passthrough, response handling, and error behavior' },
  'yida-skill-evaluator': { level: 'offline-unit', tests: ['skill metadata and packaging validation', 'eval test suites'], reason: 'evaluator skill reads and scores other skills; no Yida API mutation' },
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
