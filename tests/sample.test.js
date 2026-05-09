'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const UglifyJS = require('uglify-js');
const { default: babelTransform } = require('../lib/core/babel-transform');
const { applyTemplateVariables, run } = require('../lib/core/sample');

describe('sample templates', () => {
  let tmpDir;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-sample-'));
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('applyTemplateVariables replaces {{KEY}} tokens', () => {
    const output = applyTemplateVariables('Hello {{BRAND_NAME}} / {{BRAND_NAME}}', {
      BRAND_NAME: 'OpenKuma',
    });

    expect(output).toBe('Hello OpenKuma / OpenKuma');
  });

  test('product-homepage sample supports variables and compiles', async () => {
    const outputPath = path.join(tmpDir, 'openkuma-homepage.jsx');

    await run([
      'yida-custom-page',
      'product-homepage',
      '--output',
      outputPath,
      '--var',
      'BRAND_NAME=OpenKuma',
      '--var',
      'BRAND_INITIALS=OK',
      '--var',
      'TAGLINE=开放项目首页工作台',
      '--var',
      'HERO_TEXT=把品牌展示、社区入口和运营反馈放进同一个宜搭页面',
    ]);

    const source = fs.readFileSync(outputPath, 'utf-8');
    expect(source).toContain("brandName: 'OpenKuma'");
    expect(source).toContain("brandInitials: 'OK'");
    expect(source).not.toContain("PAGE.brandName === 'OpenKuma'");
    expect(source).not.toContain('{{BRAND_NAME}}');

    const babelResult = babelTransform(source, {}, false, { RE_VERSION: '7.4.0' });
    expect(babelResult.error).toBeNull();

    const minifyResult = UglifyJS.minify(babelResult.compiled);
    expect(minifyResult.error).toBeUndefined();
    expect(minifyResult.code.length).toBeGreaterThan(1000);
  });

  test('todo-mvc sample supports variables and compiles', async () => {
    const outputPath = path.join(tmpDir, 'todo-mvc.oyd.jsx');

    await run([
      'yida-custom-page',
      'todo-mvc',
      '--output',
      outputPath,
      '--var',
      'TODO_TITLE=团队待办',
      '--var',
      'TODO_PLACEHOLDER=输入任务并按 Enter',
    ]);

    const source = fs.readFileSync(outputPath, 'utf-8');
    expect(source).toContain("title: '团队待办'");
    expect(source).toContain("placeholder: '输入任务并按 Enter'");
    expect(source).toContain('export function renderJsx()');
    expect(source).not.toContain('{{TODO_TITLE}}');

    const babelResult = babelTransform(source, {}, false, { RE_VERSION: '7.4.0' });
    expect(babelResult.error).toBeNull();

    const minifyResult = UglifyJS.minify(babelResult.compiled);
    expect(minifyResult.error).toBeUndefined();
    expect(minifyResult.code.length).toBeGreaterThan(1000);
  });
});
