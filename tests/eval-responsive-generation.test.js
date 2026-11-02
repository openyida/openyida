'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArtifact, runEvaluation, buildPrompt } = require('../scripts/eval/responsive-generation');

const artifact = { design: { firstScreenFocus: '记录', layout: '对齐比较', primaryAction: '查询',
  responsive: '窄容器局部横滑', acceptanceChecks: ['查询后保留选中项'] }, html: '<html><body>演示</body></html>' };

test('does not accept agent failures or extra design fields as valid generation', () => {
  expect(() => parseArtifact({ available: true, ok: false, text: JSON.stringify(artifact) })).toThrow();
  expect(() => parseArtifact({ available: true, ok: true, text: JSON.stringify({ ...artifact,
    design: { ...artifact.design, mobileLayout: 'new field' } }) })).toThrow('five existing fields');
  expect(() => parseArtifact({ available: true, ok: true, text: JSON.stringify({ ...artifact, html: '' }) })).toThrow('HTML');
});

test('output protocol and task stay identical when only candidate context changes', () => {
  const scenario = { prompt: '对账' };
  expect(buildPrompt(scenario, 'OLD').replace('OLD', 'NEW')).toBe(buildPrompt(scenario, 'NEW'));
});

test('saves every attempt, separates generation from browser success, and continues after failure', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oy-responsive-eval-'));
  try {
    const agent = jest.fn()
      .mockResolvedValueOnce({ available: false, ok: false, error: 'not installed' })
      .mockResolvedValueOnce({ available: true, ok: true, text: JSON.stringify(artifact) });
    const report = await runEvaluation({ outputDir, runAgent: agent,
      scenarios: [{ id: 'comparison', prompt: '对账', review: ['可比较'] }],
      variants: [{ id: 'before', context: 'OLD' }, { id: 'after', context: 'NEW' }] });
    expect(report.results.map(x => x.status)).toEqual(['failed', 'generated']);
    expect(report.results.every(x => x.browser === 'not-run' && x.designReview === 'not-run')).toBe(true);
    expect(fs.readFileSync(path.join(outputDir, 'comparison-after.html'), 'utf8')).toBe(artifact.html);
    expect(report.results[0].contextHash).not.toBe(report.results[1].contextHash);
    expect(JSON.parse(fs.readFileSync(path.join(outputDir, 'generation-report.json'), 'utf8'))).toEqual(report);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
