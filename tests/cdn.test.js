'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('CDN config regression', () => {
  let tempHome;
  let originalHome;
  let originalUserProfile;
  let mockLog;

  beforeEach(() => {
    jest.resetModules();
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-cdn-'));
    jest.doMock('os', () => ({
      ...jest.requireActual('os'),
      homedir: () => tempHome,
    }));
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockLog.mockRestore();
    jest.dontMock('os');
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  test('loadCdnConfig returns defaults when no config file exists', () => {
    const { loadCdnConfig, DEFAULT_CONFIG, hasCdnConfig } = require('../lib/cdn/cdn-config');

    expect(loadCdnConfig()).toEqual(DEFAULT_CONFIG);
    expect(hasCdnConfig()).toBe(false);
  });

  test('initCdnConfig normalizes domains and upload paths before saving', () => {
    const {
      initCdnConfig,
      loadCdnConfig,
      validateCdnConfig,
      hasCdnConfig,
      getCdnConfigPath,
    } = require('../lib/cdn/cdn-config');

    const saved = initCdnConfig({
      accessKeyId: 'ak',
      accessKeySecret: 'secret',
      cdnDomain: 'https://cdn.example.com/',
      ossBucket: 'bucket',
      ossRegion: 'oss-cn-shanghai',
      uploadPath: '/images/',
    });

    expect(saved).toMatchObject({
      cdnDomain: 'cdn.example.com',
      ossEndpoint: 'https://bucket.oss-cn-shanghai.aliyuncs.com',
      uploadPath: 'images/',
    });
    expect(loadCdnConfig().accessKeyId).toBe('ak');
    expect(validateCdnConfig(saved)).toEqual({ valid: true, missing: [] });
    expect(hasCdnConfig()).toBe(true);
    expect(fs.existsSync(getCdnConfigPath())).toBe(true);
  });

  test('validateCdnConfig reports all missing required keys', () => {
    const { validateCdnConfig } = require('../lib/cdn/cdn-config');
    expect(validateCdnConfig({ accessKeyId: 'ak' })).toEqual({
      valid: false,
      missing: ['accessKeySecret', 'cdnDomain', 'ossBucket'],
    });
  });
});
