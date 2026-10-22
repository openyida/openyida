#!/usr/bin/env node

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Budgets are ratchets that track legitimate content growth (12 locale packs,
// samples, skills). Raise them intentionally when new content is justified; the
// per-file cap stays fixed to catch accidental large-blob embeds.
// Application styles add 18 paired presets plus the independent creative scaffold
// (57 design/CSS/layout assets), their catalog, recipe and runtime consumer. Complete
// content/navigation tone and detail-field tokens are retained in every standalone preset.
// Complete navigation designs add navigation tokens to each template, paired
// CSS mode overrides and matching guidance in each complete design.md source.
// Paired CSS also retains scoped detail-canvas and toolbar contrast corrections.
// Restored selected-item shadows include the common CSS rule and template guidance.
// All 34 themes now ship three-file bundles; 15 migrated themes add CSS and layout assets.
// Navigation borders add three state tokens, top-tab surfaces and shared CSS consumers.
// Anonymous form submission guidance adds about 14 KiB of required runtime skill content.
// app-entry/fix-theme commands and WAF-safe authoring guidance push the gzipped tarball
// past the previous 2128 KiB ratchet (CI Node 20 gzip runs ~2 KiB heavier than newer Node).
// Retain modest growth headroom and round budgets to 16 KiB boundaries.
// Merging the theme preview/query guidance with Local Agent adds runtime modules
// and skills, including the JavaScript Plan renderer replacing the Python dependency.
// Measured combined package (Node 22): 2,273,268 compressed bytes,
// 8,602,259 unpacked bytes and 647 files. Retain modest cross-Node gzip headroom.
// Data-management UI measures 2,296,797 tarball bytes on Node 20;
// retain under 16 KiB headroom across supported compression runtimes.
// Composable UI authoring guide: 2,314,474 compressed bytes on Node 20.
// Batch runtime/schema support measures 2,329,197 compressed bytes on Node 24;
// retain less than 16 KiB of cross-runtime gzip headroom.
// Combined main and process/integration content measures 2,364,935 bytes on
// Node 24; retain under 16 KiB of compression headroom across supported Nodes.
// Automation triggers, guarded updates, lifecycle operations and conditional actors
// bring the package to 2,390,301 compressed bytes on Node 24 (692 files).
// Round to the next 16 KiB boundary with cross-runtime compression headroom.
// Offline feedback screenshots, test comparisons and user guidance measure
// 2,410,795 compressed bytes on Node 24; retain the next 16 KiB boundary.
// Feedback plus native form views measures 2,419,790 bytes on Node 22; this limit fits.
// Task filters, lookup runtime and their reference examples bring the merged
// package to 2,439,886 compressed bytes on CI Node 20 (9,099,864 unpacked,
// 707 files). Retain less than 32 KiB of cross-runtime compression headroom.
// Native cool-card CLI and its independent skill add ~8 KiB compressed.
// Native cool-card import sample and design guidance need one additional 16 KiB gzip step.
// Combined formula configuration/examples and offline feedback reports, npm dry-run:
// Node 24.19.0: 2,442,200 compressed; Node 26.4.0: 2,417,070 compressed.
// Both: 9,111,642 unpacked bytes / 709 files. Keep cross-runtime gzip headroom.
// Keep byte budgets on 16 KiB boundaries; per-file limits are unchanged.
// Formula component querying and exact-name guidance measure 2,460,061 bytes
// on Node 22; retain the next 16 KiB boundary across compression runtimes.
// Merged formula and personal-workflow capabilities measure 2,504,841 compressed
// bytes on Node 20. Retain less than 32 KiB of cross-runtime gzip headroom.
// PR #638 merged with main: Node 20.20.2 measures 2,496,932 compressed
// bytes. Round to the next 16 KiB boundary with less than 16 KiB headroom.
// Combined personal-workflow and native data-card content measures 2,528,519
// compressed bytes on Node 20; retain the next 16 KiB boundary.
// Merged formula support, native cards and import sample: Node 20 measures
// 2,517,672 compressed bytes; retain the next 16 KiB boundary.
// Combined personal workflows, native data cards and cool-card tooling measure
// 2,552,878 compressed bytes on Node 20; retain less than 32 KiB runtime headroom.
// Native print templates add seven runtime modules, six reusable scenario samples,
// and a skill with three guides. With main's AI app helper, Node 26 measures
// 2,576,926 compressed bytes;
// keep a small allowance for Node 20's different npm compression output.
// Beginner account/tool guidance: Node 20.18.1 measures 2,627,647 compressed
// bytes (Node 26 is smaller). Keep the next 16 KiB compression boundary.
// Main's task-transfer and scheduled-end-condition changes combined with feedback
// guidance measure 2,634,130 compressed bytes on Node 20; this cap still fits.
// Consent-based GitHub setup adds one runtime module and user guidance:
// Node 20.18.1 measures 2,637,999 compressed bytes; next 16 KiB boundary.
const MAX_TARBALL_BYTES = 2592 * 1024;
// Round unpacked content to the next 16 KiB boundary.
// Data-management UI adds 3 runtime/catalog files and 3 skill/reference files.
// Measured 8,678,362 bytes / 654 entries; retain less than 32 KiB headroom.
// Column emphasis adds runtime options and one skill reference: measured
// 8,704,842 bytes / 655 entries on Node 20; next 16 KiB boundary.
// Token/CSS reference and guide: 8,722,920 unpacked bytes / 656 entries;
// retain less than 16 KiB headroom, without changing per-file or entry limits.
// Current-approver queries add one runtime module and localized query guidance.
// The isolated main-based package measures about 8.34 MiB / 657 files on Node 20.
// Front/backend navigation handoff, readback audit and 12 localized diagnostics:
// Node 20 measures 2,325,817 compressed / 8,754,863 unpacked bytes, still 657 files.
// Process field diagnostics, permission compilation and START package support add
// four runtime files plus one skill reference (about 31 KiB including locale/docs updates).
// Batch data support adds two runtime modules and a skill reference. Measured
// 8,771,375 unpacked bytes / 664 files; round to the next 16 KiB boundary.
// Current-approver scans add one runtime module and multilingual query guidance.
// Measured 8,784,392 bytes / 665 files on Node 20; next 16 KiB boundary.
// Shared node skills and role compilation/readback add four packaged files.
// Measured 8,798,736 bytes / 669 entries; next 16 KiB boundary.
// Owner/role/field permission helpers, matrix availability and their shared guide:
// measured 8,817,431 unpacked bytes / 681 entries; next 16 KiB boundary.
// Restore original resource gates, strict rules, examples and pass-through
// contracts across the shared references; retain the next 16 KiB boundary.
// Main's front/backend handoff and runtime 0.1.4 metadata plus the restored
// process/integration contracts measure 8,867,368 unpacked bytes / 681 files.
// Automation/permission runtime features add eight modules. Three task guides
// cover triggers, maintenance and management; related node/condition topics stay
// in their existing guides. Merging main also adds its detail-log module and
// localized help. Node 24 measures 8,968,987 unpacked bytes / 693 files.
// Native form views bring the merged package to 8,996,291 bytes on Node 22.
// Retain the next 16 KiB boundary for the combined package.
// Application task contracts, page template and skill add five packaged files.
// Combined content measures 9,006,669 bytes; retain the next 16 KiB boundary.
// Application task filter schemas and portable option loading measure 9,022,266
// unpacked bytes; retain the next 16 KiB boundary without raising tarball limits.

// Offline feedback reports add one runtime module and four skill/reference files.
// Screenshot staging, comparisons and user guidance measure 9,008,896 unpacked
// bytes / 698 files on Node 26; retain the next 16 KiB boundary.
// Feedback plus native form views measures 9,036,200 bytes on Node 22.
// Merged task-center, form-view and feedback package: 2,412,020 compressed,
// 9,090,404 unpacked bytes / 706 entries; next 16 KiB boundary.
// Personal task filter examples add one shared skill reference.
// Measured 9,099,864 unpacked bytes / 707 entries; next 16 KiB boundary.
// Portable workflow readers, optional progress/filter components and their guide
// measure about 9.15 MB unpacked / 712 files on Node 20. Compression remains
// within the existing cap; retain the next 16 KiB unpacked boundary.
// Native data cards add two CLI modules, one skill and 12-locale help (~9.07 MB total).
// Retain the next 16 KiB boundary; the tarball and per-file caps stay unchanged.
// Native multi-chart builder and its self-contained configuration guide measure
// 9,086,358 unpacked bytes / 705 entries on Node 26; next 16 KiB boundary.
// Broadcast runtime and its self-contained skill reference add ~21 KiB; next 16 KiB boundary.
// Explicit native-card routing guidance is present in both host rules and skill metadata.
// Cool-card runtime, skill and reference: 9,137,177 bytes / 710 files on Node 26.
// External dws installation guidance and localized notices: 9,144,203 bytes,
// still 710 files; round the unpacked budget to the next 16 KiB boundary.
// Native cool-card design guide and import-ready brief add one sample and one reference.
// Offline feedback adds one runtime module and four skill/reference files.
// Combined formula/feedback content retains the next 16 KiB boundary.
// Native field-runtime binding and its complete regression examples:
// Node 24: 9,139,711 unpacked bytes / 711 files (2 new packaged files).
// Exact formula-name validation, component-type query and required guidance:
// Node 26: 9,163,220 unpacked bytes / 711 files; next 16 KiB boundary.
// Native form views add their runtime, skill and localized documentation to
// formula support; retain the next 16 KiB boundary for the merged content.
// Combined Node 22 package: 2,468,324 compressed / 9,194,708 unpacked bytes,
// 713 files. Keep the compressed and single-file caps unchanged.
// Combined formula and workflow content measures 9,309,589 unpacked bytes;
// retain the next 16 KiB boundary for the merged package.
// PR #638 plus main: 9,278,325 unpacked bytes on Node 20; next 16 KiB boundary.
// The combined package measures 9,387,803 unpacked bytes. Retain less than
// 32 KiB headroom across supported packaging runtimes; per-file limits stay fixed.
// Combined package: 9,377,402 unpacked bytes on Node 20; next 16 KiB boundary.
// The merged package measures 9,493,590 unpacked bytes; next 16 KiB boundary.
// Custom buttons merged with personal workflows and native cards:
// Node 22 measures 9,526,388 unpacked bytes / 740 files. Next 16 KiB boundary.
// Native zero-value configuration adds two runtime modules and a skill guide:
// Independent category/legend choices and ask-human guidance bring this to
// 9,521,185 unpacked bytes / 741 files on Node 26; next 16 KiB boundary.
// Combined buttons, live-test fixes and report controls (Node 22):
// 2,573,647 compressed bytes / 9,556,794 unpacked bytes / 743 files.
// Keep less than 16 KiB compressed headroom and the next 16 KiB unpacked boundary.
// Print templates plus main's AI app helper measure 9,640,515 bytes / 761 files on Node 26.
// Keep the next 16 KiB boundary and the existing 512 KiB per-file cap.
// Issue contribution account checks add one runtime module: 9,653,376 unpacked bytes
// on Node 26 before generated command docs; retain the next 16 KiB boundary.
// Container-aware responsive diagnostics and the reusable Canvas scaffold add
// two published files. Keep a small byte margin for npm metadata variance.
// Task-driven responsive guidance measures 9,676,524 unpacked bytes at 12b8b0d0;
// the wording cleanup measures 9,676,590 bytes / 764 files on Node 26.
// Retain the next 16 KiB boundary; compressed, entry and per-file caps stay fixed.
// Form-member/self-select runtime and guide: 9,672,548 unpacked bytes / 764 files
// on Node 22. Retain the next 16 KiB boundary; compressed and per-file caps stay fixed.
// Responsive guidance combined with main's dynamic personnel sources measures
// 9,694,016 unpacked bytes / 766 files on Node 26; next 16 KiB boundary.
// Beginner feedback guidance and localized incident context: 9,701,569 bytes,
// still 766 files. Keep the next 16 KiB boundary; other budgets stay unchanged.
// PR #619 merged with main: 9,695,540 unpacked bytes on Node 23.
// Task transfer adds its runtime, guide and 12-locale messages; next 16 KiB boundary.
// Combined responsive/feedback and main package: 9,733,108 bytes / 769 files
// on Node 20. Keep the next 16 KiB boundary and the existing single-file cap.
// QwenWork identity modules and 12-locale guidance measure 9,758,833 unpacked
// bytes / 772 files on Node 24; retain the next 16 KiB boundary.
const MAX_UNPACKED_BYTES = 9536 * 1024;
// Plan confirmation payload and explicit part rebase add two runtime modules.
// app-entry/fix-theme commands and the WAF-safe authoring guidance add three packaged files.
// Shared source-repair diagnostics and their skill contract add two packaged files.
// Theme scope, brand-scale and palette validation add three runtime modules;
// removing the application-styles/navigation-styles catalogs offsets two files.
// App theme upgrades add two CLI modules and an independent skill with its migration guide.
// Retain two entries of headroom; per-file limits remain unchanged.
// Shared node references split six node categories and four common settings;
// automation command/spec details move out of entry skills (+11 files).
// Content shrinks overall (8,794,095 unpacked bytes); byte budgets stay fixed.
// Remove the two obsolete process reference redirects after updating consumers.
// Main adds the shared integration detail-log module.
// Portable task lookup options add one runtime module.
// Native form-view runtime and self-contained skill add two packaged files.
// Native form-view runtime and self-contained skill add two packaged files.
// Native card management and application setting links add exactly three packaged files.
// Native broadcast support adds exactly two packaged files.
// Cool-card runtime plus its skill and protocol reference add exactly three files.
// Formula support and offline feedback reports bring the total to 709 files.
// Formula runtime/examples bring it to 711; native form views add two files.
// Shared formula CLI/manifest/help parameter definitions add one runtime file.
// Node 22: 2,469,301 compressed / 9,198,911 unpacked bytes; byte caps unchanged.
// The combined formula and workflow package contains 726 published files.
// Native data-card runtime, skills and references add seven files to main.
// The merged workflow and native data-card package contains 733 files.
// The combined workflow, data-card and cool-card package contains 738 files.
// Custom buttons and native report zero-value controls add five packaged files.
// Include the shared AI application eligibility helper merged from main.
// Dynamic personnel sources add one runtime module and one skill reference.
// Account/tool onboarding adds one progressively loaded feedback reference.
// Unpacked and per-file limits remain unchanged.
// Administrator task transfer adds exactly one runtime module and one skill guide.
// GitHub setup keeps installation/detection separate from account actions.
// QwenWork cloud identity adds its reusable client and explicit CLI command.
const MAX_ENTRY_COUNT = 772;
const MAX_SINGLE_FILE_BYTES = 512 * 1024;

const REQUIRED_PACKAGE_FILES = [
  'lib/feedback/github.js',
  'lib/feedback/github-setup.js',
  'lib/print-template/builder.js',
  'lib/print-template/codes.js',
  'lib/print-template/contract.js',
  'lib/print-template/detail.js',
  'lib/print-template/model.js',
  'lib/print-template/print-template.js',
  'lib/print-template/scenes.js',
  'lib/samples/yida-print-template/approval.json',
  'lib/samples/yida-print-template/codes.json',
  'lib/samples/yida-print-template/delivery.json',
  'lib/samples/yida-print-template/order.json',
  'lib/samples/yida-print-template/quotation.json',
  'lib/samples/yida-print-template/receipt.json',
  'yida-skills/skills/yida-print-template/SKILL.md',
  'yida-skills/skills/yida-print-template/references/detail.md',
  'yida-skills/skills/yida-print-template/references/guide.md',
  'yida-skills/skills/yida-print-template/references/scenarios.md',
  'lib/app/custom-button.js',
  'yida-skills/skills/yida-custom-button/SKILL.md',
  'lib/task-center/workflow.js',
  'lib/task-center/workflow-loader.js',
  'lib/samples/yida-task-center/progress.canvas.jsx',
  'lib/samples/yida-task-center/filters.jsx',
  'yida-skills/skills/yida-canvas-data-binding/references/workflow-capabilities.md',
  'lib/task-center/contract.js',
  'lib/task-center/loader.js',
  'lib/task-center/lookups.js',
  'lib/task-center/scaffold.js',
  'lib/samples/yida-task-center/center.canvas.jsx',
  'yida-skills/skills/yida-task-center/SKILL.md',
  'yida-skills/skills/yida-task-center/references/task-filters.md',
  'lib/app/app-settings.js',
  'lib/app/data-card.js',
  'lib/app/data-card-builder.js',
  'lib/app/data-card-release.js',
  'lib/app/cool-card.js',
  'lib/samples/yida-cool-card/project-brief.json',
  'yida-skills/skills/yida-data-card/SKILL.md',
  'yida-skills/skills/yida-data-card/references/chart-config.md',
  'yida-skills/skills/yida-data-card/references/release.md',
  'yida-skills/skills/yida-cool-card/SKILL.md',
  'yida-skills/skills/yida-cool-card/references/configuration.md',
  'yida-skills/skills/yida-cool-card/references/design.md',
  'lib/feedback/report.js',
  'yida-skills/skills/yida-feedback/references/user-interaction.md',
  'yida-skills/skills/yida-feedback/SKILL.md',
  'yida-skills/skills/yida-feedback/references/report-input.md',
  'yida-skills/skills/yida-feedback/references/github-contribution.md',
  'yida-skills/skills/yida-feedback/references/github-setup.md',
  'lib/permission/permission-scope.js',
  'lib/permission/matrix-availability.js',
  'yida-skills/skills/yida-form-permission/references/row-field-access.md',
  'lib/integration/integration-message-roles.js',
  'lib/process/services/process-actor-config.js',
  'yida-skills/skills/yida-flow-node-config/SKILL.md',
  'yida-skills/skills/yida-flow-node-config/references/actors.md',
  ...['actions', 'fields', 'start', 'human', 'control', 'data', 'notifications', 'extensions', 'conditions-variables']
    .map(name => `yida-skills/skills/yida-flow-node-config/references/${name}.md`),
  'yida-skills/skills/yida-integration/references/cli-options.md',
  'yida-skills/skills/yida-integration/references/spec-authoring.md',
  'lib/style/data-manage-style.js',
  'lib/style/native-data-manage.js',
  'lib/style/data-manage-presets.json',
  'yida-skills/skills/yida-data-manage-ui/SKILL.md',
  'yida-skills/skills/yida-data-manage-ui/references/style-decisions.md',
  'yida-skills/skills/yida-data-manage-ui/references/token-and-css.md',
  'yida-skills/skills/yida-data-manage-ui/references/custom-layouts.md',
  'yida-skills/skills/yida-data-manage-ui/references/column-emphasis.md',
  'lib/app/app-theme.js',
  'lib/app/theme-source.js',
  'lib/core/theme-widget.js',
  'lib/app/nav-group-create.js',
  'yida-skills/skills/yida-design/references/responsive-layout.md',
  'yida-skills/skills/yida-design/sub_skill/ui-improve/SKILL.md',
  ...['application-coverage', 'backup-and-restore', 'component-replacement', 'confirmation']
    .map(name => `yida-skills/skills/yida-design/sub_skill/ui-improve/references/${name}.md`),
  'lib/app/upgrade-app-theme.js',
  'lib/app/agent-app-type.js',
  'lib/app/prepare-app-theme-upgrade.js',
  'yida-skills/skills/yida-upgrade-app-theme/SKILL.md',
  'yida-skills/skills/yida-upgrade-app-theme/references/page-migration.md',
  'bin/yida.js',
  'lib/core/managed-policy.js',
  'lib/auth/qwenwork-client.js',
  'lib/auth/qwenwork.js',
  'lib/app/create-form/batch.js',
  'lib/app/application-entry-urls.js',
  'lib/app/app-entry.js',
  'lib/app/inline-css-guard.js',
  'lib/app/canvas-icon-guard.js',
  'lib/app/canvas-navigation-guard.js',
  'lib/app/canvas-path-guard.js',
  'lib/samples/openyida-scaffold/canvas-navigation.jsx',
  'lib/samples/openyida-scaffold/canvas-admin-entry.jsx',
  'lib/samples/openyida-scaffold/canvas-view-state.jsx',
  'yida-skills/skills/yida-canvas-custom-page/references/view-state-recovery.md',
  'yida-skills/skills/yida-canvas-data-binding/references/business-action-permissions.md',
  'lib/asset/asset-execution.js',
  'lib/app/canvas-icon-exports.json',
  'lib/design-plan/preview.js',
  'lib/design-plan/confirmation.js',
  'lib/design-plan/rebase.js',
  'lib/design-plan/entry-navigation.js',
  'lib/design-plan/navigation-policy.js',
  'yida-skills/skills/yida-app/references/entry-navigation.md',
  'yida-skills/skills/yida-app/workflow/incremental-preview.md',
  'yida-skills/skills/yida-create-form-page/references/batch-forms.md',
  'lib/core/utils.js',
  'lib/core/process-approver-query.js',
  'lib/core/source-repair.js',
  'lib/app/theme-scope.js',
  'lib/core/theme-brand-scale.js',
  'lib/design/palette-contrast.js',
  'yida-skills/references/source-repair.md',
  'lib/asset/asset-plan.js',
  'lib/asset/attachment-upload.js',
  'lib/process/services/process-actions.js',
  'lib/process/process-tasks.js',
  'yida-skills/skills/yida-data-management/references/process-task-transfer.md',
  'lib/process/services/process-field-permissions.js',
  'lib/process/services/process-form-fields.js',
  'lib/process/process-fields.js',
  'lib/permission/package-type.js',
  'lib/integration/integration-batch-data.js',
  'lib/integration/integration-data-retrieve.js',
  'yida-skills/skills/yida-integration/references/batch-data.md',
  'project/config.json',
  'scripts/postinstall.js',
  'yida-skills/SKILL.md',
  'yida-skills/skills-index.json',
  'yida-skills/skills/yida-requirement-analysis/references/experience-groups.md',
  'yida-skills/skills/yida-requirement-analysis/references/handoff.md',
  'yida-skills/skills/yida-design/references/navigation-decision.md',
  'yida-skills/skills/yida-design/references/theme-preview-images.json',
  'yida-skills/skills/yida-design/templates/theme-selector.html',
  'yida-skills/skills/yida-design/templates/design-themes/index.json',
  'yida-skills/skills/yida-design/templates/design-themes/basic-tokens.json',
  'lib/app/application-style.js',
  'yida-skills/skills/yida-design/references/application-style-library.md',
  'yida-skills/skills/yida-design/references/theme/application-style-recipes.css',
  ...require('../yida-skills/skills/yida-design/templates/design-themes/index.json').themes
    .flatMap(theme => [theme.templatePath, theme.cssTemplatePath, theme.formLayoutPath]
      .map(file => `yida-skills/skills/yida-design/${file}`)),
  'yida-skills/skills/yida-design/scripts/validate_design_themes.py',
  'lib/samples/openyida-scaffold/canvas-dialog.canvas.jsx',
  ...['shared', 'sidebar', 'side', 'top', 'mixed', 'dock', 'tabs', 'data', 'content'].map(name => `lib/samples/openyida-scaffold/canvas-nav/${name}.jsx`),
  'yida-skills/skills/yida-canvas-custom-page/references/dialog-guide.md',
];

const FORBIDDEN_PACKAGE_PREFIXES = [
  'agent/',
  'docs/',
  'scripts/e2e-real/',
  'scripts/eval/',
  'tests/',
  'yida-skills/skills/yida-design/references/style-designs/',
  'yida-skills/skills/yida-design/sub_skill/yida-design-plan/templates/design-themes/',
];

const ALLOWED_PACKAGE_SCRIPTS = new Set([
  'scripts/postinstall.js',
]);

const STATIC_RELATIVE_REQUIRE = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function sizeLimitMessage(label, actual, limit) {
  return `${label} is ${formatBytes(actual)} (${actual} bytes), above ${formatBytes(limit)} (${limit} bytes) by ${actual - limit} bytes`;
}

function getPackageBudgetErrors(pack) {
  const errors = [];
  if (pack.size > MAX_TARBALL_BYTES) {
    errors.push(sizeLimitMessage('tarball', pack.size, MAX_TARBALL_BYTES));
  }
  if (pack.unpackedSize > MAX_UNPACKED_BYTES) {
    errors.push(sizeLimitMessage('unpacked package', pack.unpackedSize, MAX_UNPACKED_BYTES));
  }
  if (pack.entryCount > MAX_ENTRY_COUNT) {
    errors.push(`package has ${pack.entryCount} files, above ${MAX_ENTRY_COUNT}`);
  }
  return errors;
}

function fail(message) {
  console.error('npm package validation failed:');
  console.error('  error ' + message);
  process.exit(1);
}

function resolveNpmBin() {
  if (process.env.OPENYIDA_NPM_BIN) {
    return process.env.OPENYIDA_NPM_BIN;
  }
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runNpmPackDryRun() {
  const shouldCreateCache = !process.env.OPENYIDA_NPM_CACHE;
  const npmCache = shouldCreateCache
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-npm-cache-'))
    : process.env.OPENYIDA_NPM_CACHE;
  const npmBin = resolveNpmBin();
  const result = spawnSync(npmBin, ['pack', '--dry-run', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: npmCache, NPM_CONFIG_CACHE: npmCache },
    stdio: 'pipe',
  });
  if (shouldCreateCache) {
    fs.rmSync(npmCache, { recursive: true, force: true });
  }

  if (result.error) {
    fail(`failed to run ${npmBin}: ${result.error.message}. Set OPENYIDA_NPM_BIN to a valid npm executable if npm is not on PATH.`);
  }

  if (result.status === null) {
    fail(`${npmBin} pack --dry-run exited without a status${result.signal ? ` (signal: ${result.signal})` : ''}`);
  }

  if (result.status !== 0) {
    const output = result.stderr || result.stdout || `${npmBin} pack --dry-run failed with status ${result.status}\n`;
    process.stderr.write(output);
    process.exit(result.status);
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return parsed[0];
  } catch (_error) {
    process.stderr.write(result.stdout);
    fail('npm pack --dry-run --json did not return valid JSON');
  }
}

function validateLargestFiles(files) {
  const sorted = [...files].sort((a, b) => b.size - a.size);
  const oversized = sorted.find(file => file.size > MAX_SINGLE_FILE_BYTES);
  if (oversized) {
    fail(sizeLimitMessage(oversized.path, oversized.size, MAX_SINGLE_FILE_BYTES));
  }

  return sorted.slice(0, 5).map(file => `${file.path} (${formatBytes(file.size)})`);
}

function validatePackageContents(files) {
  const packagePaths = new Set(files.map(file => file.path));

  for (const requiredPath of REQUIRED_PACKAGE_FILES) {
    if (!packagePaths.has(requiredPath)) {
      fail(`required runtime file is missing: ${requiredPath}`);
    }
  }

  const themeRoot = 'yida-skills/skills/yida-design/';
  const themeIndex = JSON.parse(fs.readFileSync(path.join(__dirname, '..', themeRoot, 'templates/design-themes/index.json'), 'utf8'));
  for (const theme of themeIndex.themes) {
    if (!packagePaths.has(themeRoot + theme.templatePath)) {
      fail(`shared theme template is missing: ${themeRoot + theme.templatePath}`);
    }
  }

  for (const filePath of packagePaths) {
    const forbiddenPrefix = FORBIDDEN_PACKAGE_PREFIXES.find(prefix => filePath.startsWith(prefix));
    if (forbiddenPrefix) {
      fail(`local-only path was included: ${filePath}`);
    }

    if (filePath.startsWith('scripts/') && !ALLOWED_PACKAGE_SCRIPTS.has(filePath)) {
      fail(`development script was included: ${filePath}`);
    }
  }

  validatePublishedScriptRequires(packagePaths);
}

// Publishing only a narrow scripts/ allowlist is safe only when packaged runtime
// modules do not still point at excluded development scripts.
function validatePublishedScriptRequires(packagePaths) {
  for (const packagePath of packagePaths) {
    if (!/\.(?:cjs|js|mjs)$/.test(packagePath)) {
      continue;
    }

    const sourcePath = path.join(__dirname, '..', packagePath);
    const source = fs.readFileSync(sourcePath, 'utf8');
    let match;
    while ((match = STATIC_RELATIVE_REQUIRE.exec(source)) !== null) {
      const resolvedBase = path.posix.normalize(path.posix.join(path.posix.dirname(packagePath), match[1]));
      if (!resolvedBase.startsWith('scripts/')) {
        continue;
      }
      const candidates = [resolvedBase, `${resolvedBase}.js`, `${resolvedBase}.json`, `${resolvedBase}/index.js`];
      if (!candidates.some(candidate => packagePaths.has(candidate))) {
        fail(`${packagePath} requires unpublished script: ${match[1]}`);
      }
    }
    STATIC_RELATIVE_REQUIRE.lastIndex = 0;
  }
}

function run() {
  const pack = runNpmPackDryRun();
  console.log(`Package measurements (Node ${process.version}): ${pack.size} tarball bytes, ${pack.unpackedSize} unpacked bytes, ${pack.entryCount} files`);
  const files = pack.files || [];
  validatePackageContents(files);
  const largestFiles = validateLargestFiles(files);

  const budgetErrors = getPackageBudgetErrors(pack);
  if (budgetErrors.length) {fail(budgetErrors.join('\n  error '));}

  console.log(
    `Package size OK: ${formatBytes(pack.size)} tarball, ${formatBytes(pack.unpackedSize)} unpacked, ${pack.entryCount} files`
  );
  console.log('Largest files: ' + largestFiles.join(', '));
}

if (require.main === module) {run();}

module.exports = { getPackageBudgetErrors, MAX_TARBALL_BYTES, MAX_UNPACKED_BYTES, MAX_ENTRY_COUNT };
