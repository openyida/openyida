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

  test('空字符串版本号不抛错', () => {
    expect(() => isNewer('', '1.0.0')).not.toThrow();
    expect(isNewer('', '1.0.0')).toBe(true);
  });

  test('undefined 版本号不抛错', () => {
    expect(() => isNewer(undefined, '1.0.0')).not.toThrow();
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
