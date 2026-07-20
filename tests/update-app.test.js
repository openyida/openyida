'use strict';

const {
  assertPresetThemeKey,
  SUPPORTED_THEME_KEYS,
} = require('../lib/app/theme-presets');

const {
  parseArgs,
  hasShellUpdate,
  buildUpdateAppNamePostData,
  buildUpdateAppPostData,
} = require('../lib/app/update-app');

describe('update-app helpers', () => {
  test('parseArgs supports app shell theme flags', () => {
    expect(parseArgs([
      'APP_1',
      '--theme', 'podBlue',
      '--nav-theme', 'light',
      '--layout', 'ver',
      '--icon', 'xian-yingyong',
      '--icon-color', '#0089FF',
    ])).toMatchObject({
      appType: 'APP_1',
      colour: 'podBlue',
      navTheme: 'light',
      layoutDirection: 'ver',
      icon: 'xian-yingyong',
      iconColor: '#0089FF',
    });
  });

  test('theme presets list documents the only values accepted by --theme', () => {
    expect(SUPPORTED_THEME_KEYS).toContain('deepBlue');
    expect(SUPPORTED_THEME_KEYS).toContain('podBlue');
    expect(SUPPORTED_THEME_KEYS).toContain('black');
    expect(() => assertPresetThemeKey('customAmber')).toThrow('Unsupported theme: customAmber');
  });

  test('detects shell updates that need updateApp instead of updateAppName', () => {
    expect(hasShellUpdate(parseArgs(['APP_1', '--name', '新名称']))).toBe(false);
    expect(hasShellUpdate(parseArgs(['APP_1', '--theme', 'podBlue']))).toBe(true);
    expect(hasShellUpdate(parseArgs(['APP_1', '--icon', 'xian-yingyong']))).toBe(true);
  });

  test('buildUpdateAppNamePostData keeps name-only updates on lightweight endpoint', () => {
    const payload = buildUpdateAppNamePostData(
      parseArgs(['APP_1', '--name', '业务门户']),
      { csrfToken: 'csrf' }
    );

    expect(payload).toMatchObject({
      _csrf_token: 'csrf',
      appType: 'APP_1',
    });
    expect(JSON.parse(payload.appName)).toMatchObject({
      zh_CN: '业务门户',
      pureEn_US: '业务门户',
    });
    expect(payload).not.toHaveProperty('colour');
  });

  test('buildUpdateAppPostData preserves app shell fields and writes accepted mode key', () => {
    const payload = buildUpdateAppPostData(
      parseArgs(['APP_1', '--theme', 'podBlue', '--icon', 'xian-yingyong', '--icon-color', '#0089FF']),
      {
        appName: { zh_CN: 'OpenYida官方Samples展示0716', en_US: 'Samples' },
        description: { zh_CN: '展示应用' },
        colour: 'black',
        icon: 'xian-yingyong%%#111827',
        mode: 'normal',
        type: 'single',
        navTheme: 'light',
        navType: 'top_side',
        navLayout: 'auto',
        layoutDirection: 'ver',
        showIcon: 'n',
        showNav: 'y',
        showCrumb: 'y',
        deviceType: 'web,mobile',
      },
      { csrfToken: 'csrf' }
    );

    expect(payload).toMatchObject({
      _csrf_token: 'csrf',
      appType: 'APP_1',
      appKey: 'APP_1',
      colour: 'podBlue',
      icon: 'xian-yingyong%%#0089FF',
      iconUrl: 'xian-yingyong%%#0089FF',
      mode: 'normal',
      type: 'single',
      navType: 'top_side',
      navLayout: 'auto',
      layoutDirection: 'ver',
    });
    expect(payload).not.toHaveProperty('appMode');
    expect(JSON.parse(payload.appName)).toMatchObject({
      zh_CN: 'OpenYida官方Samples展示0716',
    });
  });
});
