'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock utils 避免真实登录
jest.mock('../lib/core/utils', () => {
  const real = jest.requireActual('../lib/core/utils');
  return {
    ...real,
    loadAuthData: jest.fn(() => ({
      auth_mode: 'token',
      auth_source: 'token',
      corp_id: 'corp-1',
      user_id: 'user-1',
      base_url: 'https://www.aliwork.com',
    })),
    triggerLogin: jest.fn(),
    resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  };
});

jest.mock('child_process', () => ({ ...jest.requireActual('child_process'), execFile: jest.fn() }));

const { parseArgs, parseCommandLine, loadCommandsFromFile, executeCommand } = require('../lib/core/batch');

describe('child execution results', () => {
  test('help describes concurrency without reading auth or launching children', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const auth = require('../lib/core/utils').loadAuthData;
    auth.mockClear(); require('child_process').execFile.mockClear();
    try {
      await require('../lib/core/batch').run(['--help']);
      expect(log.mock.calls.flat().join('\n')).toContain('--concurrency 1..4');
      expect(auth).not.toHaveBeenCalled();
      expect(require('child_process').execFile).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  test('zero exit code with business failure still fails the batch item', async () => {
    require('child_process').execFile.mockImplementationOnce((_bin, _args, _opts, done) =>
      done(null, 'progress\n{\n  "success": false,\n  "message": "business failure"\n}\n', ''));
    expect(await executeCommand(['app-list'], true)).toMatchObject({ success: false, exitCode: 1, error: 'business failure' });
  });

  test('structured stderr diagnostics survive incidental stdout', async () => {
    const payload = { success: false, nextAction: { type: 'open_url', url: 'https://example.test/permission' } };
    require('child_process').execFile.mockImplementationOnce((_bin, _args, _opts, done) =>
      done(Object.assign(new Error('failed'), { code: 1 }), 'progress', JSON.stringify(payload)));
    expect(await executeCommand(['app-list'], true)).toMatchObject({ success: false, output: payload });
  });
});

describe('batch parseArgs', () => {
  test.each(['0', '5', '-1', '2.5', 'NaN', undefined])('拒绝无效并发上限 %s', value => {
    expect(() => parseArgs(['--concurrency', value])).toThrow();
  });

  test('并发默认串行，显式开启有效上限', () => {
    expect(parseArgs([]).concurrency).toBe(1);
    expect(parseArgs(['tasks.txt', '--concurrency', '3']).concurrency).toBe(3);
  });

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
    expect(parseCommandLine("compile 'page source.jsx'")).toEqual(['compile', 'page source.jsx']);
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
    const missingFile = path.join(os.tmpdir(), `openyida-batch-missing-${process.pid}-${Date.now()}.txt`);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('__exit__'); });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => loadCommandsFromFile(missingFile)).toThrow('__exit__');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`命令文件不存在: ${path.resolve(missingFile)}`));
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
