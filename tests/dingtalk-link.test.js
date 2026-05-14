'use strict';

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');

const {
  buildDingTalkPageLink,
  extractPageUrl,
} = require('../lib/dingtalk/dingtalk-link');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');

function cliEnv() {
  return {
    ...process.env,
    CI: '1',
    OPENYIDA_LANG: 'en',
  };
}

function runOk(args) {
  return execFileSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    env: cliEnv(),
    encoding: 'utf8',
    timeout: 10000,
  }).trim();
}

describe('dingtalk-link', () => {
  test('builds AppLink page links by default', () => {
    expect(buildDingTalkPageLink({
      url: 'https://attend.dingtalk.com/attend/index.html',
    })).toBe('https://applink.dingtalk.com/page/link?url=https%3A%2F%2Fattend.dingtalk.com%2Fattend%2Findex.html&target=fullScreen');
  });

  test('converts legacy dingtalk:// page links to AppLink', () => {
    const legacy = 'dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fattend.dingtalk.com%2Fattend%2Findex.html';

    expect(buildDingTalkPageLink({ url: legacy })).toBe('https://applink.dingtalk.com/page/link?url=https%3A%2F%2Fattend.dingtalk.com%2Fattend%2Findex.html&target=fullScreen');
  });

  test('can intentionally generate legacy scheme links', () => {
    expect(buildDingTalkPageLink({
      url: 'https://example.com/path?q=1',
      legacyScheme: true,
      target: 'self',
    })).toBe('dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1&target=self');
  });

  test('extracts page url and target from AppLink', () => {
    expect(extractPageUrl('https://applink.dingtalk.com/page/link?url=https%3A%2F%2Fexample.com%2F&target=fullScreen')).toEqual({
      pageUrl: 'https://example.com/',
      target: 'fullScreen',
    });
  });

  test('CLI outputs AppLink without requiring login', () => {
    const output = runOk(['dingtalk-link', 'https://attend.dingtalk.com/attend/index.html']);
    expect(output).toBe('https://applink.dingtalk.com/page/link?url=https%3A%2F%2Fattend.dingtalk.com%2Fattend%2Findex.html&target=fullScreen');
  });

  test('CLI rejects non-http page urls', () => {
    const result = spawnSync(process.execPath, [BIN, 'dingtalk-link', 'javascript:alert(1)'], {
      cwd: ROOT,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('DingTalk page links require an absolute http(s) URL.');
  });
});
