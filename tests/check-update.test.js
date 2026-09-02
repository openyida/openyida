'use strict';

const https = require('https');
const { isNewer, fetchLatestVersion, checkUpdate } = require('../lib/core/check-update');

// ── isNewer ───────────────────────────────────────────────────────────

describe('isNewer', () => {
  test('major 版本更高时返回 true', () => {
    expect(isNewer('1.0.0', '2.0.0')).toBe(true);
  });

  test('minor 版本更高时返回 true', () => {
    expect(isNewer('1.0.0', '1.1.0')).toBe(true);
  });

  test('patch 版本更高时返回 true', () => {
    expect(isNewer('1.0.0', '1.0.1')).toBe(true);
  });

  test('版本相同时返回 false', () => {
    expect(isNewer('1.2.3', '1.2.3')).toBe(false);
  });

  test('latest 版本更低时返回 false', () => {
    expect(isNewer('2.0.0', '1.9.9')).toBe(false);
  });

  test('major 更低时返回 false', () => {
    expect(isNewer('2.0.0', '1.0.0')).toBe(false);
  });

  test('minor 更低时返回 false', () => {
    expect(isNewer('1.5.0', '1.4.9')).toBe(false);
  });

  test('beta 版本升级到同号 stable', () => {
    expect(isNewer('2026.8.27-beta.0', '2026.8.27')).toBe(true);
  });

  test('按 SemVer 比较预发布标识', () => {
    expect(isNewer('1.0.0-beta.1', '1.0.0-beta.2')).toBe(true);
    expect(isNewer('1.0.0-beta.2', '1.0.0-beta.11')).toBe(true);
    expect(isNewer('1.0.0-beta', '1.0.0-beta.1')).toBe(true);
    expect(isNewer('1.0.0-beta.1', '1.0.0-beta.alpha')).toBe(true);
  });

  test('stable 不降级到同号 beta', () => {
    expect(isNewer('1.0.0', '1.0.0-beta.1')).toBe(false);
  });

  test('构建元数据不影响版本优先级', () => {
    expect(isNewer('1.0.0+build.1', '1.0.0+build.2')).toBe(false);
  });

  test('超出 Number 安全范围的数字标识仍按 SemVer 比较', () => {
    expect(isNewer('9007199254740992.0.0', '9007199254740993.0.0')).toBe(true);
    expect(isNewer('1.0.0-beta.9007199254740992', '1.0.0-beta.9007199254740993')).toBe(true);
  });

  test('空字符串版本号不抛错并视为无可用更新', () => {
    expect(() => isNewer('', '1.0.0')).not.toThrow();
    expect(isNewer('', '1.0.0')).toBe(false);
  });

  test('undefined 版本号不抛错', () => {
    expect(() => isNewer(undefined, '1.0.0')).not.toThrow();
    expect(isNewer(undefined, '1.0.0')).toBe(false);
  });

  test('非法 latest 版本不会触发更新', () => {
    expect(isNewer('1.0.0', 'latest')).toBe(false);
    expect(isNewer('1.0.0', '01.0.0')).toBe(false);
  });
});

// ── fetchLatestVersion ────────────────────────────────────────────────

describe('fetchLatestVersion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockHttpsSuccess(responseBody) {
    const mockResponse = {
      on: jest.fn((event, handler) => {
        if (event === 'data') {handler(responseBody);}
        if (event === 'end') {handler();}
        return mockResponse;
      }),
    };
    const mockReq = { on: jest.fn().mockReturnThis(), destroy: jest.fn() };
    jest.spyOn(https, 'get').mockImplementation((url, opts, callback) => {
      callback(mockResponse);
      return mockReq;
    });
  }

  function mockHttpsError() {
    const mockReq = {
      on: jest.fn((event, handler) => {
        if (event === 'error') {handler(new Error('network error'));}
        return mockReq;
      }),
      destroy: jest.fn(),
    };
    jest.spyOn(https, 'get').mockImplementation(() => mockReq);
  }

  test('网络正常时返回字符串版本号', async () => {
    mockHttpsSuccess(JSON.stringify({ version: '9.9.9' }));
    const version = await fetchLatestVersion();
    expect(version).toBe('9.9.9');
  });

  test('网络错误时返回 null', async () => {
    mockHttpsError();
    const version = await fetchLatestVersion();
    expect(version).toBeNull();
  });

  test('同步版本检查不会 unref 请求，确保主命令等待检查完成', async () => {
    const socket = { unref: jest.fn() };
    const mockResponse = {
      on: jest.fn((event, handler) => {
        if (event === 'data') {handler(JSON.stringify({ version: '9.9.9' }));}
        if (event === 'end') {handler();}
        return mockResponse;
      }),
    };
    const mockReq = {
      on: jest.fn((event, handler) => {
        if (event === 'socket') {handler(socket);}
        return mockReq;
      }),
      destroy: jest.fn(),
      unref: jest.fn(),
    };
    jest.spyOn(https, 'get').mockImplementation((url, opts, callback) => {
      callback(mockResponse);
      return mockReq;
    });

    await fetchLatestVersion();

    expect(mockReq.unref).not.toHaveBeenCalled();
    expect(socket.unref).not.toHaveBeenCalled();
  });

  test('响应非 JSON 时返回 null', async () => {
    mockHttpsSuccess('not-json');
    const version = await fetchLatestVersion();
    expect(version).toBeNull();
  });
});

// ── checkUpdate ───────────────────────────────────────────────────────

describe('checkUpdate', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockHttpsWithVersion(version) {
    const mockResponse = {
      on: jest.fn((event, handler) => {
        if (event === 'data') {handler(JSON.stringify({ version }));}
        if (event === 'end') {handler();}
        return mockResponse;
      }),
    };
    const mockReq = { on: jest.fn().mockReturnThis(), destroy: jest.fn() };
    jest.spyOn(https, 'get').mockImplementation((url, opts, callback) => {
      callback(mockResponse);
      return mockReq;
    });
  }

  function mockHttpsError() {
    const mockReq = {
      on: jest.fn((event, handler) => {
        if (event === 'error') {handler(new Error('network error'));}
        return mockReq;
      }),
      destroy: jest.fn(),
    };
    jest.spyOn(https, 'get').mockImplementation(() => mockReq);
  }

  test('有新版本时调用 process.nextTick 打印提示', async () => {
    mockHttpsWithVersion('99.0.0');
    const nextTickSpy = jest.spyOn(process, 'nextTick').mockImplementation(() => {});

    await checkUpdate('1.0.0');

    expect(nextTickSpy).toHaveBeenCalled();
  });

  test('无新版本时不调用 process.nextTick', async () => {
    mockHttpsWithVersion('0.0.1');
    const nextTickSpy = jest.spyOn(process, 'nextTick').mockImplementation(() => {});

    await checkUpdate('1.0.0');

    expect(nextTickSpy).not.toHaveBeenCalled();
  });

  test('网络失败时正常 resolve，不抛错', async () => {
    mockHttpsError();
    await expect(checkUpdate('1.0.0')).resolves.toBeUndefined();
  });
});
