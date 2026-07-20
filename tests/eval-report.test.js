'use strict';

const { escapeHtml, renderEvalReportHtml } = require('../scripts/eval/report');

describe('eval report', () => {
  test('escapeHtml 转义危险字符', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(8)).toBe('8');
  });

  test('renderEvalReportHtml 含元数据/护栏/截图占位/打分', () => {
    const html = renderEvalReportHtml({
      config: { mode: 'e2e', skill: 'yida-dashboard', resolvedStages: 'auth,app,dashboard' },
      registry: { runId: 'OY_E2E_TEST' },
      guardrails: [{ name: 'no-resource-before-login-check', status: 'pass', detail: 'ok' }],
      screenshots: [
        { stage: 'dashboard', type: 'dashboard', url: 'https://x/dash', ok: false, skipped: 'playwright-missing', path: null },
      ],
      scores: [
        { stage: 'dashboard', url: 'https://x/dash', auto: { overall: 8, dimensions: { layout: 8 }, comment: '不错', model: 'claude -p' }, human: null },
      ],
    });
    expect(html).toContain('OY_E2E_TEST');
    expect(html).toContain('yida-dashboard');
    expect(html).toContain('no-resource-before-login-check');
    expect(html).toContain('https://x/dash');
    expect(html).toContain('playwright-missing'); // 失败截图以占位展示
    expect(html).toContain('自动打分');
    expect(html).toContain('不错');
    expect(html).toMatch(/<!doctype html>/i);
  });

  test('renderEvalReportHtml 无截图目标时给出提示', () => {
    const html = renderEvalReportHtml({ config: {}, registry: {}, guardrails: [], screenshots: [], scores: [] });
    expect(html).toContain('没有可截图');
    expect(html).toContain('（无护栏记录）');
  });

  test('renderEvalReportHtml 转义 URL/评语，防止注入破坏结构', () => {
    const html = renderEvalReportHtml({
      screenshots: [{ stage: 's', url: 'https://x/<script>', ok: false, path: null }],
      scores: [{ stage: 's', url: 'https://x/<script>', auto: { error: 'boom <bad>' }, human: null }],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('自动打分失败');
  });

  test('浏览器未下载时顶部统一提示，卡片用友好文案', () => {
    const html = renderEvalReportHtml({
      screenshots: [
        { stage: 'app', url: 'https://x/a', ok: false, skipped: 'browser-missing', path: null },
        { stage: 'dashboard', url: 'https://x/b', ok: false, skipped: 'browser-missing', path: null },
      ],
    });
    // 顶部提示只出现一次，带修复命令
    expect(html).toContain('npx playwright install chromium');
    expect(html).toContain('页面截图未生成');
    // 卡片用友好中文，而非原始横幅；但保留原始码供排查
    expect(html).toContain('Playwright 浏览器未下载');
    expect(html).toContain('data-skip="browser-missing"');
  });

  test('截图错误信息压成单行摘要，不把整段横幅堆进卡片', () => {
    const banner = "browserType.launch: Executable doesn't exist at /x/chrome\n\u2554══╗\n║ Please run npx playwright install ║\n╚══╝";
    const html = renderEvalReportHtml({
      screenshots: [{ stage: 'app', url: 'https://x/a', ok: false, error: banner, path: null }],
    });
    // 只保留第一行（单引号会被 HTML 转义），不包含框线字符
    expect(html).toContain('Executable doesn');
    expect(html).not.toContain('╔');
    expect(html).not.toContain('Please run npx playwright install');
  });
});
