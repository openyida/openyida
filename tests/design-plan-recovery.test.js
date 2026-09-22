'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { planBase } = require('../lib/design-plan/parallel');
const { materialize } = require('../lib/design-plan/materialize');
const { patchPlan } = require('../lib/design-plan/patch');
let dir, input, businessFile, visualFile, base, business, visual;
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const merge = options => materialize(input, { businessFile, visualFile, ...options });
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-recovery-'));
  input = path.join(dir, 'build-plan.json');
  businessFile = path.join(dir, 'business.json'); visualFile = path.join(dir, 'visual.json');
  base = read(path.join(__dirname, 'fixtures/design-plan.json'));
  base.meta.status = 'draft';
  business = { base: planBase(base), ready: true, facts: Object.fromEntries(['overview', 'dataModels', 'businessFlows', 'pages'].map(key => [key, base[key]])) };
  visual = { base: planBase(base), ready: true, facts: { visualStyle: base.visualStyle } };
  write(input, base); write(businessFile, business); write(visualFile, visual);
  write(path.join(dir, '.build-plan-base.json'), { schemaVersion: 1, base: planBase(base), plan: base });
  // Isolate in-memory fixtures from shared nested references.
  business = read(businessFile); visual = read(visualFile);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test('reconciles changed main source with completed part facts without deleting or rewriting parts', () => {
  const source = read(input);
  source.overview.summary = '当前主计划纠正后的概要'; write(input, source);
  business.facts.overview.businessGoals = ['保留片段中已经完成的目标']; write(businessFile, business);
  const parts = [businessFile, visualFile].map(file => fs.readFileSync(file, 'utf8'));
  expect(() => merge()).toThrow(expect.objectContaining({ code: 'DESIGN_PLAN_STALE_PART' }));
  const result = merge({ rebaseParts: true });
  const final = read(input);
  expect(final.overview.summary).toBe(source.overview.summary);
  expect(final.overview.businessGoals).toEqual(business.facts.overview.businessGoals);
  expect([businessFile, visualFile].map(file => fs.readFileSync(file, 'utf8'))).toEqual(parts);
  expect(fs.existsSync(result.outputs.html)).toBe(true);
  expect(result.confirmation.revision).toBe(final.meta.revision);
  expect(result.confirmation.attachments[0].path).toBe(result.outputs.html);
  expect(result.confirmation.options.map(option => option.value)).toEqual(['confirm_build', 'continue_editing']);
  // Replaying the initial parts over the materialized plan reconciles to the current plan.
  merge({ rebaseParts: true });
  expect(read(input).meta.revision).toBe(final.meta.revision);
  // Confirmed plans still refuse initialization parts; later edits go through patch --materialize.
  const confirmed = read(input);
  confirmed.meta.status = 'confirmed';
  confirmed.meta.planState.planConfirmed = true;
  confirmed.meta.planState.confirmedRevision = confirmed.meta.revision;
  write(input, confirmed);
  expect(() => merge({ rebaseParts: true })).toThrow(expect.objectContaining({ code: 'DESIGN_PLAN_REBASE_STAGE_INVALID' }));
});

test.each(['conflict', 'missing', 'tampered', 'wrong_part'])('%s stops before any file changes', kind => {
  const source = read(input); source.overview.summary = '主计划修正'; write(input, source);
  if (kind === 'conflict') { business.facts.overview.summary = '片段不同修正'; write(businessFile, business); }
  if (kind === 'missing') { fs.unlinkSync(path.join(dir, '.build-plan-base.json')); }
  if (kind === 'tampered') { const saved = read(path.join(dir, '.build-plan-base.json')); saved.plan.overview.summary = '篡改'; write(path.join(dir, '.build-plan-base.json'), saved); }
  if (kind === 'wrong_part') { business.base.digest = 'other-baseline'; write(businessFile, business); }
  const snapshot = () => Object.fromEntries(fs.readdirSync(dir).map(name => [name, fs.readFileSync(path.join(dir, name), 'utf8')]));
  const before = snapshot();
  expect(() => merge({ rebaseParts: true })).toThrow();
  expect(snapshot()).toEqual(before);
});

test('patch materialization returns current confirmation on both actual and no-op edits', () => {
  merge();
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = patchPlan(input, ['overview.summary=本轮调整后的概要'], { materialize: true });
    expect(result.confirmation.revision).toBe(read(input).meta.revision);
    expect(result.confirmation.attachments[0].path).toBe(result.outputs.html);
    expect(result.changed).toBe(attempt === 0);
  }
});


test('CLI accepts rebase-parts and delivers confirmation for the reconciled draft', async () => {
  const source = read(input);
  source.overview.summary = 'CLI 主计划修正'; write(input, source);
  business.facts.overview.businessGoals = ['CLI 保留片段目标']; write(businessFile, business);
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await require('../lib/design-plan/design-plan').run([
      'materialize', input, '--business-file', businessFile, '--visual-file', visualFile,
      '--rebase-parts', '--json',
    ]);
    const result = JSON.parse(log.mock.calls[0][0]);
    expect(read(input).overview.summary).toBe(source.overview.summary);
    expect(read(input).overview.businessGoals).toEqual(business.facts.overview.businessGoals);
    expect(result.confirmation.revision).toBe(read(input).meta.revision);
    expect(result.confirmation.attachments[0].path).toBe(result.outputs.html);
  } finally {
    log.mockRestore();
  }
});
