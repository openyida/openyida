'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');
const getPageConfig = require('../lib/page-config/get-page-config');
const saveShareConfig = require('../lib/page-config/save-share-config');
const verifyShortUrl = require('../lib/page-config/verify-short-url');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

let logSpy;
let errorSpy;

beforeEach(() => {
  jest.clearAllMocks();
  utils.httpGet.mockReset();
  utils.httpPost.mockReset();
  utils.loadAuthData.mockReturnValue(mockAuthData);
  utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

function getLoggedJson() {
  return JSON.parse(logSpy.mock.calls[0][0]);
}

function expectCliError(error, code, message) {
  expect(error).toBeTruthy();
  expect(error.isCliError).toBe(true);
  expect(error.code).toBe(code);
  if (message) {
    expect(error.message).toContain(message);
  }
}

describe('get-page-config', () => {
  test('queries share config through yida-client and prints normalized JSON', async () => {
    utils.httpPost.mockResolvedValue({
      success: true,
      content: {
        isOpen: 'y',
        openUrl: '/o/public-page',
        shareUrl: '/s/internal-page',
      },
    });

    const result = await getPageConfig.run(['APP_XXX', 'FORM_XXX']);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/query/formdesign/getShareConfig.json');
    expect(querystring.parse(utils.httpPost.mock.calls[0][2])).toMatchObject({
      _api: 'Share.getShareConfig',
      formUuid: 'FORM_XXX',
    });
    expect(result).toEqual({
      isOpen: true,
      openUrl: '/o/public-page',
      shareUrl: '/s/internal-page',
    });
    expect(getLoggedJson()).toEqual(result);
  });

  test('reports missing arguments as CliError instead of exiting', async () => {
    await expect(getPageConfig.run([])).rejects.toMatchObject({
      isCliError: true,
      code: 'PAGE_CONFIG_INVALID_ARGUMENTS',
    });
  });
});

describe('verify-short-url', () => {
  test('checks public open URL availability through yida-client', async () => {
    utils.httpGet.mockResolvedValue({
      success: true,
      content: true,
    });

    const result = await verifyShortUrl.run(['APP_XXX', 'FORM_XXX', '/o/new-page']);

    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    expect(utils.httpGet.mock.calls[0][1]).toBe('/dingtalk/web/APP_XXX/query/formdesign/verifyShortUrl.json');
    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({
      _api: 'App.verifyShortUrlForm',
      formUuid: 'FORM_XXX',
      openUrl: '/o/new-page',
    });
    expect(result).toMatchObject({
      available: true,
      url: '/o/new-page',
      urlType: 'open',
    });
    expect(getLoggedJson()).toEqual(result);
  });

  test('keeps taken URL as a normal JSON result', async () => {
    utils.httpGet.mockResolvedValue({
      success: false,
      errorMsg: '短链已存在',
      errorCode: 'DUPLICATE',
    });

    const result = await verifyShortUrl.run(['APP_XXX', 'FORM_XXX', '/s/existing-page']);

    expect(utils.httpGet.mock.calls[0][2]).toMatchObject({
      shareUrl: '/s/existing-page',
    });
    expect(result).toEqual({
      available: false,
      url: '/s/existing-page',
      urlType: 'share',
      message: '短链已存在',
      errorCode: 'DUPLICATE',
    });
  });

  test('rejects invalid URL format without network work', async () => {
    let error;
    try {
      await verifyShortUrl.run(['APP_XXX', 'FORM_XXX', 'bad-url']);
    } catch (err) {
      error = err;
    }

    expectCliError(error, 'VERIFY_SHORT_URL_INVALID_ARGUMENTS', 'bad-url');
    expect(utils.httpGet).not.toHaveBeenCalled();
  });
});

describe('save-share-config', () => {
  test('bootstraps a new public config when current state is empty and openAuth is explicit', async () => {
    utils.httpPost
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'n',
          openUrl: '',
          shareUrl: '',
        },
      })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'y',
          openUrl: '/o/public-page',
          shareUrl: '',
          openPageAuthConfig: '{"openAuth":"n","authSources":[]}',
        },
      });

    const result = await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/public-page', 'y', 'n']);

    const body = querystring.parse(utils.httpPost.mock.calls[1][2]);
    expect(JSON.parse(body.openPageAuthConfig)).toEqual({
      openAuth: 'n',
      authSources: [],
    });
    expect(result).toMatchObject({
      success: true,
      openUrl: '/o/public-page',
      isOpen: true,
      verification: {
        status: 'verified',
        changedKeys: expect.arrayContaining(['openUrl', 'isOpen', 'openPageAuthConfig']),
      },
    });
  });

  test('new public config still fails closed when openAuth is omitted', async () => {
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: { isOpen: 'n', openUrl: '', shareUrl: '' },
    });

    await expect(saveShareConfig.run([
      'APP_XXX',
      'FORM_XXX',
      '/o/public-page',
      'y',
    ])).rejects.toMatchObject({
      isCliError: true,
      code: 'SAVE_SHARE_CONFIG_CURRENT_STATE_INCOMPLETE',
    });
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test('omitted openAuth preserves the complete public auth config', async () => {
    const sensitiveMarker = 'SENSITIVE_AUTH_SOURCE_MARKER_PRESERVE';
    const authConfig = {
      openAuth: 'y',
      authType: 'custom',
      authSources: JSON.stringify({ users: [sensitiveMarker], departments: ['dept-1'] }),
      nested: { policy: 'owned' },
    };
    utils.httpPost
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'n',
          openUrl: '/o/old',
          shareUrl: '/s/keep',
          openPageAuthConfig: JSON.stringify(authConfig),
        },
      })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'y',
          openUrl: '/o/new',
          shareUrl: '/s/keep',
          openPageAuthConfig: JSON.stringify({
            nested: { policy: 'owned' },
            authSources: JSON.stringify({ departments: ['dept-1'], users: [sensitiveMarker] }),
            authType: 'custom',
            openAuth: 'y',
          }),
        },
      });

    const result = await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/new', 'y']);

    const body = querystring.parse(utils.httpPost.mock.calls[1][2]);
    expect(JSON.parse(body.openPageAuthConfig)).toEqual(authConfig);
    expect(result).not.toHaveProperty('before');
    expect(result).not.toHaveProperty('after');
    expect(result).not.toHaveProperty('expected');
    expect(result.verification).toMatchObject({
      status: 'verified',
      changedKeys: ['openUrl', 'isOpen'],
      preservedKeys: expect.arrayContaining(['shareUrl', 'openPageAuthConfig']),
      canonicalFingerprints: {
        before: expect.stringMatching(/^[a-f0-9]{64}$/),
        expected: expect.stringMatching(/^[a-f0-9]{64}$/),
        actual: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(JSON.stringify(result)).not.toContain(sensitiveMarker);
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain(sensitiveMarker);
  });

  test('explicit openAuth patches only openAuth and preserves nested auth fields', async () => {
    const sensitiveMarker = 'SENSITIVE_AUTH_SOURCE_MARKER_PATCH';
    const beforeAuthConfig = {
      openAuth: 'y',
      authType: 'source-list',
      authSources: [{ type: 'USER', ids: [sensitiveMarker] }],
    };
    const afterAuthConfig = { ...beforeAuthConfig, openAuth: 'n' };
    utils.httpPost
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'y',
          openUrl: '/o/old',
          shareUrl: '/s/keep',
          openPageAuthConfig: JSON.stringify(beforeAuthConfig),
        },
      })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'y',
          openUrl: '/o/new',
          shareUrl: '/s/keep',
          openPageAuthConfig: afterAuthConfig,
        },
      });

    const result = await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/new', 'y', 'n']);

    const body = querystring.parse(utils.httpPost.mock.calls[1][2]);
    expect(JSON.parse(body.openPageAuthConfig)).toEqual(afterAuthConfig);
    expect(result.verification).toMatchObject({
      status: 'verified',
      changedKeys: expect.arrayContaining(['openPageAuthConfig.openAuth']),
      preservedKeys: expect.arrayContaining([
        'shareUrl',
        'openPageAuthConfig.authType',
        'openPageAuthConfig.authSources',
      ]),
    });
    expect(JSON.stringify(result)).not.toContain(sensitiveMarker);
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain(sensitiveMarker);
  });

  test('public update fails closed when the current auth config cannot be parsed', async () => {
    const sensitiveMarker = 'SENSITIVE_AUTH_SOURCE_MARKER_UNKNOWN';
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: {
        isOpen: 'n',
        openUrl: '/o/old',
        shareUrl: '/s/keep',
        openPageAuthConfig: JSON.stringify({ authSources: [sensitiveMarker] }),
      },
    });

    let error;
    try {
      await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/new', 'y', 'n']);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      isCliError: true,
      code: 'SAVE_SHARE_CONFIG_CURRENT_STATE_INCOMPLETE',
      details: {
        verification: {
          status: 'unknown',
          changedKeys: expect.arrayContaining(['openPageAuthConfig.openAuth']),
          preservedKeys: expect.arrayContaining(['shareUrl']),
          mismatches: [{ path: 'openPageAuthConfig', kind: 'preserved' }],
        },
      },
    });
    expect(JSON.stringify(error.details)).not.toContain(sensitiveMarker);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test('updates public URL, preserves share URL, and verifies readback', async () => {
    utils.httpPost
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'n',
          openUrl: '/o/old-public-page',
          shareUrl: '/s/internal-page',
          openPageAuthConfig: '{"openAuth":"y","authSources":[]}',
        },
      })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'y',
          openUrl: '/o/public-page',
          shareUrl: '/s/internal-page',
          openPageAuthConfig: '{"openAuth":"n","authSources":[]}',
        },
      });

    const result = await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/public-page', 'y', 'n']);

    expect(utils.httpPost).toHaveBeenCalledTimes(3);
    expect(utils.httpPost.mock.calls[1][1]).toBe('/dingtalk/web/APP_XXX/query/formdesign/saveShareConfig.json');
    const body = querystring.parse(utils.httpPost.mock.calls[1][2]);
    expect(body).toMatchObject({
      _api: 'Share.saveShareConfig',
      formUuid: 'FORM_XXX',
      openUrl: '/o/public-page',
      shareUrl: '/s/internal-page',
      isOpen: 'y',
    });
    expect(JSON.parse(body.openPageAuthConfig)).toEqual({
      openAuth: 'n',
      authSources: [],
    });
    expect(result).toMatchObject({
      success: true,
      openUrl: '/o/public-page',
      shareUrl: '/s/internal-page',
      isOpen: true,
      verification: {
        status: 'verified',
        changedKeys: expect.arrayContaining(['openUrl', 'isOpen', 'openPageAuthConfig.openAuth']),
        preservedKeys: expect.arrayContaining(['shareUrl', 'openPageAuthConfig.authSources']),
      },
      message: expect.any(String),
    });
    expect(result).not.toHaveProperty('before');
    expect(result).not.toHaveProperty('after');
    expect(result).not.toHaveProperty('expected');
    expect(getLoggedJson()).toEqual(result);
  });

  test('updates organization share URL while preserving public URL and auth config', async () => {
    const publicAuthConfig = '{"openAuth":"y","authSources":["corp"]}';
    utils.httpPost
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'y',
          openUrl: '/o/public-page',
          shareUrl: '/s/old-internal-page',
          openPageAuthConfig: publicAuthConfig,
        },
      })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'y',
          openUrl: '/o/public-page',
          shareUrl: '/s/internal-page',
          openPageAuthConfig: publicAuthConfig,
        },
      });

    await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/s/internal-page', 'y']);

    const body = querystring.parse(utils.httpPost.mock.calls[1][2]);
    expect(body).toMatchObject({
      shareUrl: '/s/internal-page',
      openUrl: '/o/public-page',
      isOpen: 'y',
      openPageAuthConfig: publicAuthConfig,
    });
  });

  test('updates organization share URL when no public config exists', async () => {
    utils.httpPost
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'n',
          openUrl: '',
          shareUrl: '',
        },
      })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'n',
          openUrl: '',
          shareUrl: '/s/team',
        },
      });

    const result = await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/s/team', 'n']);

    expect(result).toMatchObject({
      success: true,
      openUrl: null,
      shareUrl: '/s/team',
      isOpen: false,
      verification: {
        status: 'verified',
        changedKeys: ['shareUrl'],
        preservedKeys: expect.arrayContaining(['openUrl', 'isOpen']),
      },
    });
    expect(result).not.toHaveProperty('expected');
  });

  test('fails closed when an existing public URL lacks preservable auth config', async () => {
    utils.httpPost.mockResolvedValueOnce({
      success: true,
      content: {
        isOpen: 'y',
        openUrl: '/o/public-page',
        shareUrl: '/s/old-internal-page',
      },
    });

    await expect(saveShareConfig.run([
      'APP_XXX',
      'FORM_XXX',
      '/s/internal-page',
      'y',
    ])).rejects.toMatchObject({
      isCliError: true,
      code: 'SAVE_SHARE_CONFIG_CURRENT_STATE_INCOMPLETE',
    });
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test('keeps save API business failure as a normal JSON result', async () => {
    utils.httpPost
      .mockResolvedValueOnce({
        success: true,
        content: { openPageAuthConfig: '{"openAuth":"n","authSources":[]}' },
      })
      .mockResolvedValueOnce({
        success: false,
        errorMsg: '保存失败',
        errorCode: 'SAVE_FAILED',
      });

    const result = await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/public-page', 'y']);

    expect(result).toEqual({
      success: false,
      message: '保存失败',
      errorCode: 'SAVE_FAILED',
    });
    expect(utils.httpPost).toHaveBeenCalledTimes(2);
  });

  test('fails closed when save succeeds but readback does not match', async () => {
    const sensitiveMarker = 'SENSITIVE_AUTH_SOURCE_MARKER_MISMATCH';
    utils.httpPost
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'n',
          openUrl: '/o/old',
          shareUrl: '/s/keep',
          openPageAuthConfig: JSON.stringify({
            openAuth: 'n',
            authType: 'source-list',
            authSources: [{ type: 'USER', ids: [sensitiveMarker] }],
          }),
        },
      })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: true,
        content: {
          isOpen: 'y',
          openUrl: '/o/new',
          shareUrl: '/s/keep',
          openPageAuthConfig: JSON.stringify({
            openAuth: 'n',
            authType: 'source-list',
            authSources: [],
          }),
        },
      });

    let error;
    try {
      await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/new', 'y']);
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      isCliError: true,
      code: 'SAVE_SHARE_CONFIG_VERIFY_FAILED',
      details: {
        verification: {
          status: 'failed',
          changedKeys: ['openUrl', 'isOpen'],
          preservedKeys: expect.arrayContaining(['shareUrl', 'openPageAuthConfig']),
          canonicalFingerprints: {
            before: expect.stringMatching(/^[a-f0-9]{64}$/),
            expected: expect.stringMatching(/^[a-f0-9]{64}$/),
            actual: expect.stringMatching(/^[a-f0-9]{64}$/),
          },
          mismatches: expect.arrayContaining([
            { path: 'openPageAuthConfig.authSources', kind: 'preserved' },
          ]),
        },
      },
    });
    const serializedError = JSON.stringify({ message: error.message, details: error.details });
    expect(serializedError).not.toContain(sensitiveMarker);
    expect(serializedError).not.toContain('authType');
    expect(error.details).not.toHaveProperty('before');
    expect(error.details).not.toHaveProperty('expected');
    expect(error.details).not.toHaveProperty('actual');
  });

  test('rejects invalid open flag without network work', async () => {
    let error;
    try {
      await saveShareConfig.run(['APP_XXX', 'FORM_XXX', '/o/public-page', 'maybe']);
    } catch (err) {
      error = err;
    }

    expectCliError(error, 'SAVE_SHARE_CONFIG_INVALID_ARGUMENTS', 'maybe');
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('rejects a non-empty invalid URL even when isOpen is n', async () => {
    await expect(saveShareConfig.run([
      'APP_XXX',
      'FORM_XXX',
      '/s/../bad',
      'n',
    ])).rejects.toMatchObject({
      isCliError: true,
      code: 'SAVE_SHARE_CONFIG_INVALID_ARGUMENTS',
    });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });
});
