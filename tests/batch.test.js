'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock utils 避免真实登录
jest.mock('../lib/core/utils', () => {
  const real = jest.requireActual('../lib/core/utils');
  return {
    ...real,
    loadCookieData: jest.fn(() => ({
      csrf_token: 'fake-csrf',
      cookies: [{ name: 'tb_token', value: 'fake' }],
      base_url: 'https://www.aliwork.com',
    })),
    triggerLogin: jest.fn(),
    resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  };
});

const { parseArgs, parseCommandLine, loadCommandsFromFile } = require('../lib/core/batch');

describe('batch parseArgs', () => {
  test('解析内联 --commands 分号分隔', () => {
    const parsed = parseArgs(['--commands', 'app-list;get-schema APP_X FORM-1', '--json']);
    expect(parsed.inlineCommands).toEqual(['app-list', 'get-schema APP_X FORM-1']);
    expect(parsed.json).toBe(true);
    expect(parsed.commandsFile).toBe('');
  });

  test('解析内联 --commands 多参数', () => {
    const parsed = parseArgs(['--commands', 'app-list', 'env', '--stop-on-error']);
    expect(parsed.inlineCommands).toEqual(['app-list', 'env']);
    expect(parsed.stopOnError).toBe(true);
  });

  test('解析命令文件路径', () => {
    const parsed = parseArgs(['tasks.txt', '--quiet']);
    expect(parsed.commandsFile).toBe('tasks.txt');
    expect(parsed.quiet).toBe(true);
  });

  test('缺省默认值', () => {
    const parsed = parseArgs([]);
    expect(parsed.commandsFile).toBe('');
    expect(parsed.inlineCommands).toEqual([]);
    expect(parsed.stopOnError).toBe(false);
    expect(parsed.json).toBe(false);
    expect(parsed.quiet).toBe(false);
  });
});

describe('batch parseCommandLine', () => {
  test('按空格分割简单命令', () => {
    expect(parseCommandLine('get-schema APP_X FORM-1')).toEqual(['get-schema', 'APP_X', 'FORM-1']);
  });

  test('支持双引号内的空格', () => {
    expect(parseCommandLine('create-app "My App Name"')).toEqual(['create-app', 'My App Name']);
  });

  test('支持单引号内的空格', () => {
    expect(parseCommandLine("flash-to-prd 'meeting notes.md'")).toEqual(['flash-to-prd', 'meeting notes.md']);
  });

  test('混合引号和普通参数', () => {
    expect(parseCommandLine('create-form add-option APP_X FORM-1 "优先级" "P0" P1')).toEqual([
      'create-form', 'add-option', 'APP_X', 'FORM-1', '优先级', 'P0', 'P1',
    ]);
  });

  test('空字符串返回空数组', () => {
    expect(parseCommandLine('')).toEqual([]);
  });
});

describe('batch loadCommandsFromFile', () => {
  test('从文件读取命令，跳过空行和注释', () => {
    const tmpFile = path.join(os.tmpdir(), 'batch-test-' + Date.now() + '.txt');
    fs.writeFileSync(tmpFile, [
      '# 这是注释',
      'app-list --json',
      '',
      'get-schema APP_X FORM-1',
      '  # 另一行注释  ',
      'env',
      '',
    ].join('\n'), 'utf-8');

    const commands = loadCommandsFromFile(tmpFile);
    expect(commands).toEqual([
      'app-list --json',
      'get-schema APP_X FORM-1',
      'env',
    ]);

    fs.unlinkSync(tmpFile);
  });

  test('文件不存在时退出', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('__exit__'); });
    expect(() => loadCommandsFromFile('/nonexistent/file.txt')).toThrow('__exit__');
    exitSpy.mockRestore();
  });
});
