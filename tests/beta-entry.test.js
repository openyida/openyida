'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// 只隔离实际命令执行，验证入口对环境及标准端点解析的可观察影响。
jest.mock('../bin/yida.js', () => ({}));

describe('beta 入口沿用主干环境与域名选择', () => {
  const names = ['OPENYIDA_ENDPOINT', 'OPENYIDA_ENV', 'OPENYIDA_AUTH_DIR', 'OPENYIDA_SKIP_UPDATE_CHECK'];
  let previous; let root;
  beforeEach(() => {
    jest.resetModules();
    previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
    for (const name of names) { delete process.env[name]; }
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-beta-entry-'));
  });
  afterEach(() => {
    for (const name of names) {
      if (previous[name] === undefined) { delete process.env[name]; }
      else { process.env[name] = previous[name]; }
    }
    fs.rmSync(root, { recursive: true, force: true });
    jest.resetModules();
  });
  function start() {
    require('../bin/yida-beta');
    return require('../lib/auth/token-auth').resolveTokenBaseUrl;
  }
  test('零配置使用公有云，不注入测试环境或独立认证目录', () => {
    const resolve = start();
    expect(resolve({ projectRoot: root })).toBe('https://www.aliwork.com');
    for (const name of names.slice(0, 3)) { expect(process.env[name]).toBeUndefined(); }
    expect(process.env.OPENYIDA_SKIP_UPDATE_CHECK).toBe('1');
  });
  test('显式端点与已有认证目录原样保留', () => {
    process.env.OPENYIDA_ENDPOINT = 'https://custom.example.test';
    process.env.OPENYIDA_AUTH_DIR = path.join(root, 'selected-auth');
    const resolve = start();
    expect(resolve({ projectRoot: root })).toBe('https://custom.example.test');
    expect(process.env.OPENYIDA_AUTH_DIR).toBe(path.join(root, 'selected-auth'));
  });
  test('命令端点继续优先于环境变量', () => {
    process.env.OPENYIDA_ENDPOINT = 'https://env.example.test';
    expect(start()({ projectRoot: root, endpoint: 'https://argument.example.test' })).toBe('https://argument.example.test');
  });
  test('海外环境不被 beta 改回预发', () => {
    process.env.OPENYIDA_ENV = 'intl';
    expect(start()({ projectRoot: root })).toBe('https://www.yidaapps.com');
    expect(process.env.OPENYIDA_ENV).toBe('intl');
  });
  test('当前激活的项目环境继续决定域名', () => {
    const { saveEnvsConfig } = require('../lib/core/env-manager');
    saveEnvsConfig({ current: 'selected', environments: { selected: { baseUrl: 'https://selected.example.test' } } }, root);
    expect(start()({ projectRoot: root })).toBe('https://selected.example.test');
  });
  test('环境变量继续优先于项目当前环境', () => {
    const { saveEnvsConfig } = require('../lib/core/env-manager');
    saveEnvsConfig({ current: 'selected', environments: { selected: { baseUrl: 'https://selected.example.test' } } }, root);
    process.env.OPENYIDA_ENV = 'intl';
    expect(start()({ projectRoot: root })).toBe('https://www.yidaapps.com');
  });
});
