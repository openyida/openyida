'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildReport, parseReportArgs, renderMarkdown, writeReport } = require('../lib/feedback/report');
const { parseArgs } = require('../lib/feedback/feedback');
const { setLanguage, getLanguage, t } = require('../lib/core/i18n');

const summary = { title: 'Repeated publish error', actual: 'No recovery advice', command: 'publish' };

describe('offline feedback reports', () => {
  let directory;
  let originalLanguage;
  beforeEach(() => {
    originalLanguage = getLanguage();
    setLanguage('en');
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-report-'));
  });
  afterEach(() => {
    setLanguage(originalLanguage);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('keeps incident facts distinct from the generator after an upgrade', () => {
    const report = buildReport({
      ...summary, summary: 'Create an order page', expected: 'Helpful recovery advice',
      tool: 'Example AI 1.2', incidentEnvironment: {
        openyida: '2026.1.1', node: 'v18.20.0', platform: 'Windows 11', arch: 'x64',
        installation: 'npm', browser: 'Firefox 130', deployment: 'public cloud',
        organizationContext: 'multiple organizations; switched before failure',
        token: 'do-not-copy', rawLog: 'do-not-copy',
      },
    });
    expect(report.environment.openyida).toBe(require('../package.json').version);
    expect(report.incidentEnvironment.openyida).toBe('2026.1.1');
    expect(JSON.stringify(report)).not.toContain('do-not-copy');
    const body = renderMarkdown(report);
    expect(body.indexOf('## Your goal')).toBeLessThan(body.indexOf('## Environment when'));
    expect(body.indexOf('## What happened')).toBeLessThan(body.indexOf('## Environment when'));
    const incident = body.split('## Environment when the problem occurred')[1].split('## Related operation')[0];
    expect(incident).toContain('2026.1.1');
    expect(incident).not.toContain(report.environment.openyida);
    expect(body).toContain('Report generator environment (not the incident environment)');
    expect(body).not.toContain('## Cause and confidence');
    expect(body).not.toContain('## Screenshots');
  });

  test('old summaries leave incident versions unknown and new fields are redacted and escaped', () => {
    const legacy = buildReport(summary);
    expect(legacy.incidentEnvironment.openyida).toBe('');
    expect(renderMarkdown(legacy)).toContain('openyida: Unknown / not verified');
    const report = buildReport({ ...summary, incidentEnvironment: {
      installation: 'npm token=secretValue',
      browser: '<img src="private">',
      deployment: 'https://private.example /Users/customer/private',
    } });
    const body = renderMarkdown(report);
    expect(body).not.toContain('secretValue');
    expect(body).not.toContain('private.example');
    expect(body).not.toContain('/Users/customer');
    expect(body).toContain('\\<img');
  });

  test.each([null, [], 'node18', { node: 18 }, { browser: 'x'.repeat(12001) }])('rejects invalid incident fields %#', incidentEnvironment => {
    expect(() => buildReport({ ...summary, incidentEnvironment })).toThrow();
  });

  test.each(['zh', 'en', 'zh-HK', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ar', 'hi', 'vi'])('renders translated report headings in %s', lang => {
    setLanguage(lang);
    const locale = require(lang === 'en' || lang === 'zh'
      ? `../lib/core/locales/${lang}` : `../locales-extra/core/${lang}`);
    const messages = locale.feedback_report.body;
    expect(Object.keys(messages)).toHaveLength(18);
    const body = renderMarkdown(buildReport(summary));
    expect(body).toContain(messages.actual);
    expect(body).toContain(messages.generator);
    expect(body).toContain(t('feedback_report.body.draft'));
    expect(body).not.toContain('feedback_report.body.');
  });

  test('approval digest changes when incident facts change, while dedup fingerprint stays stable', () => {
    const input = path.join(directory, 'input.json');
    fs.writeFileSync(input, JSON.stringify(summary));
    const original = writeReport({ input, outputDir: path.join(directory, 'one') });
    fs.writeFileSync(input, JSON.stringify({ ...summary, incidentEnvironment: { openyida: '2026.1.1' } }));
    const updated = writeReport({ input, outputDir: path.join(directory, 'two') });
    expect(updated.fingerprint).toBe(original.fingerprint);
    expect(updated.reviewDigest).not.toBe(original.reviewDigest);
  });

  test('tool setup metadata does not change the original draft or imply public approval', () => {
    const input = path.join(directory, 'input.json');
    const originalInput = { ...summary, incidentEnvironment: { openyida: '2026.1.1' } };
    fs.writeFileSync(input, JSON.stringify(originalInput));
    const original = writeReport({ input, outputDir: path.join(directory, 'before-setup') });
    fs.writeFileSync(input, JSON.stringify({ ...originalInput,
      githubAccount: 'private-account', setupConsent: true, publishConsent: true,
      githubSetup: { tool: 'gh', authenticated: true, token: 'private-credential', diagnostics: 'private-login-log' },
    }));
    const resumed = writeReport({ input, outputDir: path.join(directory, 'after-setup') });
    expect(resumed.submissionPerformed).toBe(false);
    expect(resumed.fingerprint).toBe(original.fingerprint);
    expect(resumed.reviewDigest).toBe(original.reviewDigest);
    expect(fs.readFileSync(resumed.bodyFile, 'utf8')).toBe(fs.readFileSync(original.bodyFile, 'utf8'));
    const report = JSON.parse(fs.readFileSync(resumed.reportFile, 'utf8'));
    expect(report.incidentEnvironment.openyida).toBe('2026.1.1');
    expect(JSON.stringify(report)).not.toMatch(/private-account|private-credential|private-login-log|setupConsent|publishConsent/);
  });

  test('accepts only explicit summary data and distinguishes hypotheses from observations', () => {
    const report = buildReport({
      ...summary,
      auth: { accessToken: 'do-not-copy' }, fullConversation: 'do-not-copy',
      cause: { category: 'cli', status: 'hypothesis', summary: 'Possibly incomplete error handling' },
    });
    expect(JSON.stringify(report)).not.toContain('do-not-copy');
    expect(report.cause.status).toBe('hypothesis');
    expect(report.occurrenceCount).toBeNull();
    expect(report.submissionPerformed).toBe(false);
    expect(report.environment).toEqual({
      openyida: require('../package.json').version,
      node: process.version, platform: process.platform, arch: process.arch,
    });
    expect(buildReport(summary).cause).toMatchObject({ category: 'unknown', status: 'unknown' });
    expect(buildReport(summary).fingerprint).toBe(buildReport(summary).fingerprint);
    expect(buildReport({ ...summary, actual: 'A different failure' }).fingerprint).not.toBe(report.fingerprint);
  });

  test('removes common secrets, resource identifiers, private URLs and source paths', () => {
    const report = buildReport({
      ...summary,
      evidence: [
        'Authorization: Bearer topSecretBearer',
        'Cookie: sid=secretCookie',
        '"refreshToken": "secretRefresh", password=secretPassword',
        'openyida login --token secretOption',
        'ghp_secretGithubToken github_pat_secretGithubPat',
        'https://private.example/repo/closed-source /Users/customer/internal-repo/source.js',
        'C:\\Users\\customer\\secret-repo\\source.js',
        'APP_PRIVATE123 FORM-PRIVATE123 person@customer.example 13812345678 110101199001011234',
        '-----BEGIN PRIVATE KEY-----\nsecretPrivateKey\n-----END PRIVATE KEY-----',
      ],
    });
    const output = JSON.stringify(report) + renderMarkdown(report);
    ['topSecretBearer', 'secretCookie', 'secretRefresh', 'secretPassword', 'secretOption',
      'secretGithubToken', 'secretGithubPat', 'private.example', 'internal-repo', 'secret-repo',
      'customer.example', 'PRIVATE123', '13812345678', '110101199001011234', 'secretPrivateKey']
      .forEach(secret => {expect(output).not.toContain(secret);});
  });

  test('escapes executable or externally loaded Markdown in copied diagnostic snippets', () => {
    const text = renderMarkdown(buildReport({ ...summary, evidence: ['![tracking](data:image/png;base64,abc)', '<img src="secret">', '`$(do-not-run)`'] }));
    expect(text).toContain('\\!\\[tracking\\]\\(data:image');
    expect(text).toContain('\\<img');
    expect(text).not.toContain('![tracking](');
  });

  test.each([
    null, [], {}, { ...summary, steps: ['ok', { cookie: 'unsafe' }] },
    { ...summary, cause: { status: 'confirmed' } }, { ...summary, occurrenceCount: -1 },
    { ...summary, actual: 'x'.repeat(12001) },
  ])('rejects malformed or unsupported report input %#', input => {
    expect(() => buildReport(input)).toThrow();
  });

  test('requires explicit files and rejects unexpected CLI arguments', () => {
    expect(parseArgs(['report', '--input', 'a.json', '--output-dir', 'fresh'])).toEqual({
      command: 'report', options: { input: 'a.json', outputDir: 'fresh' },
    });
    [[], ['--input', 'a'], ['--input', 'a', '--output-dir', 'b', '--submit'],
      ['--input', 'a', '--input', 'b', '--output-dir', 'c']]
      .forEach(args => {expect(() => parseReportArgs(args)).toThrow();});
  });

  test('writes local review drafts and never overwrites a previous report', () => {
    const input = path.join(directory, 'input.json');
    const outputDir = path.join(directory, 'draft');
    fs.writeFileSync(input, JSON.stringify(summary));
    const result = writeReport({ input, outputDir });
    expect(result).toMatchObject({ submissionPerformed: false, reviewRequired: true });
    expect(fs.readdirSync(outputDir).sort()).toEqual(['issue.md', 'report.json']);
    const before = fs.readFileSync(result.bodyFile, 'utf8');
    expect(before).toContain('not submitted');
    expect(() => writeReport({ input, outputDir })).toThrow();
    expect(fs.readFileSync(result.bodyFile, 'utf8')).toBe(before);
    if (process.platform !== 'win32') {
      expect(fs.statSync(result.reportFile).mode & 0o777).toBe(0o600);
    }
  });

  test('malformed JSON is not echoed and oversize inputs do not create drafts', () => {
    const input = path.join(directory, 'input.json');
    const outputDir = path.join(directory, 'draft');
    fs.writeFileSync(input, '{"password":"secret-invalid-json');
    expect(() => writeReport({ input, outputDir })).toThrow(expect.objectContaining({ code: 'FEEDBACK_REPORT_INVALID' }));
    expect(fs.existsSync(outputDir)).toBe(false);
    fs.writeFileSync(input, 'x'.repeat(1024 * 1024 + 1));
    expect(() => writeReport({ input, outputDir })).toThrow('1 MiB');
  });

  test('copies only explicit screenshots with generic filenames and keeps them local', () => {
    const privateSourceName = 'private-customer-screen.png';
    const screenshot = path.join(directory, privateSourceName);
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jYaQAAAAASUVORK5CYII=', 'base64');
    fs.writeFileSync(screenshot, image);
    fs.writeFileSync(path.join(directory, 'unselected.png'), image);
    const input = path.join(directory, 'input.json');
    fs.writeFileSync(input, JSON.stringify({ ...summary, screenshots: [{ path: privateSourceName, description: 'Selected error screen' }] }));
    const result = writeReport({ input, outputDir: path.join(directory, 'draft') });
    const report = JSON.parse(fs.readFileSync(result.reportFile));
    expect(report.screenshots).toEqual([{ file: 'screenshot-01.png', description: 'Selected error screen', reviewRequired: true }]);
    expect(fs.readFileSync(result.screenshotFiles[0])).toEqual(image);
    expect(fs.readdirSync(path.dirname(result.bodyFile)).sort()).toEqual(['issue.md', 'report.json', 'screenshot-01.png']);
    expect(fs.readFileSync(result.reportFile, 'utf8')).not.toContain(privateSourceName);
    expect(fs.readFileSync(result.bodyFile, 'utf8')).not.toContain(directory);
    expect(result.submissionPerformed).toBe(false);
    expect(result.reviewDigest).toMatch(/^[a-f0-9]{64}$/);
    fs.writeFileSync(screenshot, Buffer.concat([image, Buffer.from('changed-metadata')]));
    const changed = writeReport({ input, outputDir: path.join(directory, 'changed-draft') });
    expect(changed.fingerprint).toBe(result.fingerprint);
    expect(changed.reviewDigest).not.toBe(result.reviewDigest);
  });

  test('rejects unsupported screenshot content before creating any output', () => {
    const input = path.join(directory, 'input.json');
    fs.writeFileSync(path.join(directory, 'fake.png'), '<script>not an image</script>');
    fs.writeFileSync(input, JSON.stringify({ ...summary, screenshots: [{ path: 'fake.png' }] }));
    const outputDir = path.join(directory, 'draft');
    expect(() => writeReport({ input, outputDir })).toThrow(expect.objectContaining({ code: 'FEEDBACK_REPORT_INVALID' }));
    expect(fs.existsSync(outputDir)).toBe(false);
  });

  test('records actual before/after test evidence and never invents a passing result', () => {
    const report = buildReport({ ...summary, comparison: {
      before: { status: 'failed', revision: 'baseline', command: 'npm test -- case', actual: 'Assertion failed', evidence: ['Observed exit 1'] },
      after: { status: 'passed', revision: 'fix', command: 'npm test -- case', actual: 'Assertion passed', evidence: ['Observed exit 0'] },
      limitations: ['Browser not verified'],
    } });
    expect(report.comparison.regression.status).toBe('not_run');
    const body = renderMarkdown(report);
    expect(body).toContain('Test comparison: before');
    expect(body).toContain('Assertion failed');
    expect(body).toContain('Assertion passed');
    expect(body).toContain('Browser not verified');
    expect(renderMarkdown(buildReport(summary))).not.toContain('Test comparison:');
    expect(() => buildReport({ ...summary, comparison: { after: { status: 'passed' } } })).toThrow();
  });

  test('runs from a source-free directory with no login or network access', () => {
    const input = path.join(directory, 'input.json');
    const outputDir = path.join(directory, 'draft');
    fs.writeFileSync(input, JSON.stringify(summary));
    const guardFile = path.join(directory, 'no-network.cjs');
    fs.writeFileSync(guardFile, `
      for (const name of ['http', 'https', 'net', 'tls']) {
        const mod = require(name);
        for (const method of ['request', 'get', 'connect', 'createConnection']) {
          if (mod[method]) mod[method] = () => { throw new Error('Network forbidden'); };
        }
      }
      global.fetch = () => { throw new Error('Network forbidden'); };
    `);
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../bin/yida.js'),
      'feedback', 'report', '--input', input, '--output-dir', outputDir], {
      cwd: directory, encoding: 'utf8',
      env: { ...process.env, HOME: directory, USERPROFILE: directory, CODEX_HOME: directory,
        NODE_OPTIONS: `--require=${guardFile}` },
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ success: true, submissionPerformed: false });
  });
});
