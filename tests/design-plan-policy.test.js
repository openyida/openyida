'use strict';

const { confirmationPayload, confirmationHandoff } = require('../lib/design-plan/confirmation');
const { getVisualDecisionPolicy } = require('../lib/design-plan/visual-policy');
const fs = require('fs');
const path = require('path');

const snapshot = 'prd/example/build-plan-content-hash.html';
const outputs = { html: 'prd/example/build-plan.html', confirmationHtml: snapshot };

test('confirmation payload uses the immutable snapshot and keeps policy outside the callable schema', () => {
  const result = confirmationHandoff(outputs, '2');
  expect(result.confirmation).toEqual({
    question: '请确认当前搭建方案',
    options: [{ label: '确认并开始搭建', value: 'confirm_build' }, { label: '继续调整', value: 'continue_editing' }],
    submitLabel: '提交选择',
    attachments: [{ name: '搭建方案.html', path: snapshot }],
    revision: '2',
  });
  expect(result.confirmationPolicy).toMatchObject({ tool: 'ask_human', requiredBeforeExecution: true, payloadField: 'confirmation' });
  expect(result.confirmationPolicy.policy).toMatch(/structured ask_human.*snapshot\/revision.*wait/);
  expect(result.confirmationPolicy.approval).toMatch(/confirm_build.*interaction and revision/);
  expect(result.confirmationPolicy.approval).toContain('queued/pending is not consent');
  expect(result.confirmationPolicy.unavailable).toMatch(/awaiting_confirmation.*Do not.*prose approval.*switch to Fast/);
  expect(result.confirmationPolicy.reuse).toMatch(/same-plan approval.*recovery or asset progress/);
  expect(result.confirmationPolicy.reuse).toContain('Fast adds no Plan approval');
});

test.each([
  { QWENWORK: '1' },
  { QWENWORKCN_INTEGRATION_MODE: 'desktop' },
  { QODER_WORK_INTEGRATION_PRODUCT: 'qwenworkcn', QODERCLI_INTEGRATION_MODE: 'qoder_work' },
])('QwenWork receives the same snapshot confirmation contract as other hosts: %j', env => {
  expect(confirmationHandoff(outputs, '2', { env })).toEqual({
    confirmation: confirmationPayload(outputs, '2'),
    confirmationPolicy: require('../lib/design-plan/confirmation').confirmationPolicy,
  });
});

test.each([{}, { CODEX_THREAD_ID: 'thread' }, { CLAUDE_CODE: '1' },
  { QODERCLI_INTEGRATION_MODE: 'qoder_work' }, { __CFBundleIdentifier: 'com.qoder.ide' },
])('other hosts keep their confirmation contract unchanged: %j', env => {
  expect(confirmationHandoff(outputs, '2', { env })).toEqual({
    confirmation: confirmationPayload(outputs, '2'),
    confirmationPolicy: require('../lib/design-plan/confirmation').confirmationPolicy,
  });
});

test.each([
  [undefined, '2'],
  [{ html: outputs.html }, '2'],
  [{ ...outputs, confirmationHtml: '' }, '2'],
  [{ ...outputs, confirmationHtml: ' ' }, '2'],
  [{ ...outputs, confirmationHtml: true }, '2'],
  [outputs, undefined],
  [outputs, ''],
  [outputs, ' '],
  [outputs, 2],
])('missing snapshot or revision cannot fall back to editable HTML: %j / %j', (files, revision) => {
  expect(() => confirmationPayload(files, revision)).toThrow(expect.objectContaining({
    code: 'DESIGN_PLAN_CONFIRMATION_REQUIRED',
  }));
});

test.each([
  undefined,
  { themeId: 'soft-outline-rhythm', source: 'user_explicit' },
  { themeId: 'free-creative', source: 'material_extracted' },
])('theme previews require explicit requests even with an existing choice: %j', selection => {
  const policy = getVisualDecisionPolicy(selection);
  for (const surface of [policy.themeSelection.preview, policy.themeSelection.qwenwork]) {
    expect(surface).toMatchObject({ trigger: 'explicit_user_request', defaultEnabled: false, purpose: 'preview_only' });
  }
  expect(policy.themeSelection.preview.policy).toMatch(/every host.*Only explicit user requests/);
  expect(policy.themeSelection.preview.policy).toContain('supplied references never trigger previews');
  expect(policy.themeSelection.preview.policy).toContain('Previewing never reopens selection');
  if (selection) {
    expect(policy.comparison).toMatchObject({ enabled: false, candidateCount: 0 });
    expect(policy.themeSelection.allowStyleQuestion).toBe(false);
  }
});

test('unmapped style intent and image/site references are resolved before conditional comparison', () => {
  const policy = getVisualDecisionPolicy();
  expect(policy.execution).toContain('resolve_style_intent_before_any_comparison');
  expect(policy.themeSelection.intent.policy).toContain('A missing themeId does not mean missing intent');
  expect(policy.themeSelection.questionCondition).toContain('Ask only without style intent, visual reference, reusable choice or delegation');
  expect(policy.comparison.onlyWhen).toBe('no_style_intent_visual_reference_or_reusable_selection_or_user_requests_alternatives');
  expect(policy.themeSelection.intent.referenceVisual.policy).toContain('Inspect the reference website or liked image itself');
  expect(policy.themeSelection.intent.referenceVisual.policy).toContain('not its filename or OCR alone');
  expect(policy.themeSelection.intent.referenceVisual.policy).toContain('distinguish observations from inferred values');
  expect(policy.themeSelection.intent.referenceVisual.policy).toContain('Data links and bug screenshots alone are not style preferences');
});

test.each([undefined, { themeId: 'app-sage', source: 'user_explicit' }])(
  'explicit style and color instructions take priority over template color frequency: %j', selection => {
    const { policy } = getVisualDecisionPolicy(selection).themeSelection.intent;
    expect(policy).toContain('Honor the latest explicit style and color instructions and preserve the selected theme');
    expect(policy).toContain('Apply requested colors through project tokens while preserving theme structure');
    expect(policy).toContain('Template examples, frequency and order never make green or blue a default');
    expect(policy).toContain('CRM or inventory labels do not determine color');
    expect(policy).toContain('actual tasks, brand evidence, reading conditions and status semantics');
  });

test('creation guidance derives navigation from the chosen theme and honors user colors', () => {
  const create = fs.readFileSync(path.join(__dirname, '../yida-skills/skills/yida-create-app/SKILL.md'), 'utf8');
  expect(create).toContain('`--nav-theme` 显式取 design.md 的 `themeProfile.navTheme`');
  expect(create).toContain('主色遵从用户最新指定的颜色、风格及已选主题');
  expect(create).not.toContain('--nav-theme light --logo-source appIcon');
  expect(create).not.toContain('`greyBlue` 也只在工业制造');
});


test('preview-assisted selection uses catalog images and same-interaction conversation cards', () => {
  const policy = getVisualDecisionPolicy();
  expect(policy.presentation).toContain('explicit_preview_to_help_choose_uses_ask_human_in_fast_and_plan');
  expect(policy.themeSelection.preview.imageSource).toContain('reuse_exact_previewImage_url');
  expect(policy.themeSelection.preview.presentation).toMatchObject({ format: 'html_card', surface: 'conversation', timing: 'same_turn_as_ask_human', attachmentSource: 'theme-preview result.attachment' });
  expect(policy.themeSelection.interactionOrder.sequence).toContain('present_requested_html_with_batched_ask_human_if_needed');
  expect(getVisualDecisionPolicy({ themeId: 'app-sage' }).themeSelection.allowStyleQuestion).toBe(false);
});
