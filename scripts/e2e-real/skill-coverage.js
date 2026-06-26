#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(ROOT, 'yida-skills', 'skills');

const SKILL_COVERAGE = {
  'large-file-write': { level: 'offline', tests: ['write fixture generation uses fs APIs in runner tests'] },
  'sls-log-workbench': { level: 'offline-unit', tests: ['skill metadata and packaging validation'], reason: 'internal support-only SLS tooling is guarded by passphrase and corp whitelist; shared real E2E must not query production logs' },
  'yida-app': { level: 'real-e2e', stages: ['app', 'form', 'page', 'data', 'report', 'dashboard'] },
  'yida-app-permission': { level: 'offline-unit', tests: ['tests/app-permission.test.js'], reason: 'app admin mutations affect real application access; shared real E2E only validates safe read paths' },
  'yida-basic-info': { level: 'offline-unit', tests: ['tests/basic-info.test.js'], reason: 'basic-info reads org admin metadata and can update domains; unit coverage avoids mutating shared real org settings' },
  'yida-business-rule': { level: 'opt-in', reason: 'business association rules mutate form event configuration; validate in a dedicated real-form/UI stage before adding to deterministic shared E2E' },
  'yida-chart': { level: 'real-e2e', stages: ['report', 'dashboard'], tests: ['report chart config generation'] },
  'yida-connector': { level: 'offline', stages: ['connector-local'], commands: ['connector gen-template', 'connector parse-api'] },
  'yida-connector-safe-actions': { level: 'offline', stages: ['connector-local'], commands: ['connector parse-api', 'connector test --action <operationId>'], reason: 'skill documents conservative HTTP connector action generation and repair workflow; shared E2E should validate local parsing without mutating tenant connectors' },
  'yida-corp-efficiency': { level: 'offline-unit', tests: ['tests/corp-efficiency.test.js'], reason: 'enterprise efficiency queries and notify mutations are not safe for shared real org E2E' },
  'yida-corp-manager': { level: 'offline-unit', tests: ['tests/corp-manager.test.js'], reason: 'enterprise admin mutations are not safe for shared real org E2E' },
  'yida-create-app': { level: 'real-e2e', stages: ['app'], commands: ['create-app'] },
  'yida-create-form-page': { level: 'real-e2e', stages: ['form'], commands: ['create-form create', 'create-form update', 'create-form add-option'] },
  'yida-create-page': { level: 'real-e2e', stages: ['page', 'dashboard'], commands: ['create-page --mode dashboard'] },
  'yida-create-process': { level: 'opt-in-real-e2e', stages: ['process'], commands: ['create-process --formUuid'], reason: 'process stage mutates workflow definitions and is excluded from default full E2E unless explicitly requested' },
  'yida-custom-page': { level: 'real-e2e', stages: ['page'], commands: ['check-page', 'build-page', 'compile', 'publish'] },
  'yida-dashboard': { level: 'real-e2e', stages: ['dashboard'], commands: ['create-page --mode dashboard', 'publish dashboard skill page'] },
  'yida-data-source-connectors': { level: 'offline-unit', tests: ['skill metadata and packaging validation'], reason: 'skill defines a page Schema/dataSource authoring guardrail; real connector execution mutates tenant-specific connector/data source configuration and should be validated in dedicated page publish scenarios' },
  'yida-data-management': { level: 'real-e2e', stages: ['data', 'task'], commands: ['data create/query/update form', 'data query tasks'] },
  'yida-db-seq-fix': { level: 'offline-unit', tests: ['tests/db-seq-fix.test.js'], reason: 'PostgreSQL admin repair is not safe for shared real org E2E' },
  'yida-density': { level: 'offline-unit', tests: ['sample/check-page coverage'], reason: 'visual density template is validated through page build/lint rather than real data mutation' },
  'yida-export-conversation': { level: 'offline-unit', tests: ['conversation exporter unit coverage'], reason: 'depends on local conversation artifacts, not Yida API' },
  'yida-flash-note-to-prd': { level: 'opt-in', stages: ['ai'], commands: ['flash-to-prd'], reason: 'remote AI service can timeout; excluded from deterministic default full run' },
  'yida-form-detail': { level: 'offline-unit', reason: 'form detail styling skill has no standalone CLI command yet' },
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
  'yida-openyida-publish-guard': { level: 'offline-unit', tests: ['skill metadata and packaging validation'], reason: 'publish guard is an agent workflow safety rule for comparing live schema before publish; real page publish behavior remains covered by yida-publish-page E2E stages' },
  'yida-page-config': { level: 'real-e2e', stages: ['share'], commands: ['get-page-config', 'verify-short-url', 'save-share-config'] },
  'yida-ppt': { level: 'deprecated', reason: 'skill is deprecated in favor of yida-ppt-slider' },
  'yida-ppt-slider': { level: 'offline-unit', reason: 'presentation-style custom page skill should be validated by page generation/check-page fixtures' },
  'yida-process-rule': { level: 'opt-in-real-e2e', stages: ['process'], commands: ['configure-process'], reason: 'process stage publishes workflow rules on the disposable E2E form and is excluded from default full E2E unless explicitly requested' },
  'yida-publish-page': { level: 'real-e2e', stages: ['page', 'dashboard'], commands: ['publish --health-check'] },
  'yida-report': { level: 'real-e2e', stages: ['report'], commands: ['create-report', 'append-chart'] },
  'yida-table-form': { level: 'offline-unit', reason: 'table-form custom page template should be validated with check-page fixture before real publish stage is added' },
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
