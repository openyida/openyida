'use strict';

const {
  assertPresetThemeKey,
  APP_THEME_TOKEN_PRESETS,
  APP_THEME_TOKEN_PRESET_KEYS,
  getAppThemeTokenPreset,
  SUPPORTED_THEME_KEYS,
} = require('../lib/app/theme-presets');

const {
  parseArgs,
  hasShellUpdate,
  buildUpdateAppNamePostData,
  buildUpdateAppPostData,
  normalizeThemeColor,
  assertNavTheme,
  assertLogoSource,
  normalizeLayoutDirection,
  syncSystemIconColor,
} = require('../lib/app/update-app');

describe('update-app helpers', () => {
  test('parseArgs supports app shell theme flags', () => {
    expect(parseArgs([
      'APP_1',
      '--theme', 'podBlue',
      '--nav-theme', 'light',
      '--layout', 'side',
      '--logo-source', 'appIcon',
      '--icon', 'xian-yingyong',
      '--icon-color', '#0089FF',
    ])).toMatchObject({
      appType: 'APP_1',
      colour: 'podBlue',
      navTheme: 'light',
      layoutDirection: 'side',
      logoSource: 'appIcon',
      icon: 'xian-yingyong',
      iconColor: '#0089FF',
    });
  });

  test('parseArgs supports a custom theme file, theme color, and modern nav theme together', () => {
    expect(parseArgs([
      'APP_1',
      '--theme-color', '#1677ff',
      '--theme-file', './app-theme.css',
      '--nav-theme', 'white',
    ])).toMatchObject({
      appType: 'APP_1',
      themeColor: '#1677ff',
      themeFile: './app-theme.css',
      navTheme: 'white',
    });
    expect(hasShellUpdate(parseArgs(['APP_1', '--theme-file', './app-theme.css']))).toBe(true);
  });

  test('validates the custom theme color and nav theme contract', () => {
    expect(normalizeThemeColor('#1677ff')).toBe('#1677FF');
    expect(normalizeThemeColor('rgb(22, 119, 255)')).toBe('rgb(22, 119, 255)');
    expect(() => normalizeThemeColor('blue')).toThrow('#RGB, #RRGGBB, rgb(a), or hsl(a)');
    expect(() => assertNavTheme('brand')).toThrow('light, dark, white, gray');
    expect(() => assertLogoSource('logo')).toThrow('appIcon, customImage');
    expect(normalizeLayoutDirection('ver')).toBe('side');
    expect(normalizeLayoutDirection('hoz')).toBe('top');
    expect(normalizeLayoutDirection('l_shape')).toBe('l_shape');
    expect(() => normalizeLayoutDirection('vertical')).toThrow('side, top, l_shape');
  });

  test('parseArgs supports app nav visibility flags', () => {
    expect(parseArgs(['APP_1', '--hide-app-nav'])).toMatchObject({
      appType: 'APP_1',
      hideAppNav: 'y',
    });
    expect(parseArgs(['APP_1', '--show-app-nav'])).toMatchObject({
      appType: 'APP_1',
      hideAppNav: 'n',
    });
  });

  test('theme presets list documents the only values accepted by --theme', () => {
    expect(SUPPORTED_THEME_KEYS).toContain('deepBlue');
    expect(SUPPORTED_THEME_KEYS).toContain('podBlue');
    expect(SUPPORTED_THEME_KEYS).toContain('black');
    expect(() => assertPresetThemeKey('customAmber')).toThrow('Unsupported theme: customAmber');
  });

  test('application theme token presets are centralized and platform theme keys stay explicit', () => {
    expect(APP_THEME_TOKEN_PRESET_KEYS).toEqual(['blue', 'green', 'orange', 'podBlue', 'podGreen', 'podOrange']);
    expect(['podBlue', 'podGreen', 'podOrange'].every((presetKey) => SUPPORTED_THEME_KEYS.includes(presetKey))).toBe(true);
    expect(['blue', 'green', 'orange'].every((presetKey) => !SUPPORTED_THEME_KEYS.includes(presetKey))).toBe(true);
    expect(getAppThemeTokenPreset('podBlue')).toMatchObject({
      '--color-brand1-1': 'rgb(51, 160, 255)',
      '--color-brand1-6': 'rgb(0, 137, 255)',
      '--color-brand-4': 'rgb(0, 109, 204)',
    });
    expect(APP_THEME_TOKEN_PRESETS).toHaveProperty('podOrange.--color-brand1-10', 'rgba(255, 111, 0, 0.3)');

    expect(getAppThemeTokenPreset('blue')).toMatchObject({
      '--color-brand1-1': 'rgb(51, 160, 255)',
      '--color-brand1-6': 'rgb(0, 137, 255)',
      '--color-brand-4': 'rgb(0, 109, 204)',
    });
    expect(getAppThemeTokenPreset('green')).toMatchObject({
      '--color-brand1-1': 'rgb(60, 190, 113)',
      '--color-brand1-6': 'rgb(64, 179, 112)',
      '--color-brand-4': 'rgb(62, 170, 107)',
    });
    expect(getAppThemeTokenPreset('orange')).toMatchObject({
      '--color-brand1-1': 'rgb(255, 125, 26)',
      '--color-brand1-6': 'rgb(255, 111, 0)',
      '--color-brand-4': 'rgb(242, 105, 0)',
    });
    expect(() => assertPresetThemeKey('blue')).toThrow('application theme token profiles that are not platform --theme keys');
  });

  test('detects shell updates that need updateApp instead of updateAppName', () => {
    expect(hasShellUpdate(parseArgs(['APP_1', '--name', '新名称']))).toBe(false);
    expect(hasShellUpdate(parseArgs(['APP_1', '--theme', 'podBlue']))).toBe(true);
    expect(hasShellUpdate(parseArgs(['APP_1', '--icon', 'xian-yingyong']))).toBe(true);
    expect(hasShellUpdate(parseArgs(['APP_1', '--hide-app-nav']))).toBe(true);
    expect(hasShellUpdate(parseArgs(['APP_1', '--show-app-nav']))).toBe(true);
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
        layoutDirection: 'side',
        logoSource: 'appIcon',
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
      layoutDirection: 'side',
      logoSource: 'appIcon',
    });
    expect(payload).not.toHaveProperty('appMode');
    expect(payload).not.toHaveProperty('hideAppNav');
    expect(JSON.parse(payload.appName)).toMatchObject({
      zh_CN: 'OpenYida官方Samples展示0716',
    });
  });

  test('buildUpdateAppPostData writes hideAppNav as y/n only when requested', () => {
    const currentApp = {
      appName: { zh_CN: '应用' },
      description: { zh_CN: '描述' },
      mode: 'normal',
      type: 'single',
      showNav: 'y',
      showCrumb: 'y',
      deviceType: 'web,mobile',
    };

    expect(buildUpdateAppPostData(
      parseArgs(['APP_1', '--hide-app-nav']),
      currentApp,
      { csrfToken: 'csrf' }
    )).toMatchObject({
      appType: 'APP_1',
      hideAppNav: 'y',
    });

    expect(buildUpdateAppPostData(
      parseArgs(['APP_1', '--show-app-nav']),
      currentApp,
      { csrfToken: 'csrf' }
    )).toMatchObject({
      appType: 'APP_1',
      hideAppNav: 'n',
    });
  });

  test('buildUpdateAppPostData saves custom theme fields together and preserves existing theme files', () => {
    const customThemeStyle = JSON.stringify({
      enabled: true,
      iframePropagation: false,
      cssUrl: 'https://example.com/app-theme.css',
      cssFileName: 'app-theme.css',
    });
    const payload = buildUpdateAppPostData(
      {
        ...parseArgs(['APP_1', '--theme-color', '#1677FF', '--nav-theme', 'dark', '--logo-source', 'appIcon', '--layout', 'l_shape']),
        themeColor: '#1677FF',
        customThemeStyle,
      },
      {
        appName: { zh_CN: '应用' },
        description: { zh_CN: '描述' },
        mode: 'normal',
        type: 'single',
      },
      { csrfToken: 'csrf' }
    );

    expect(payload).toMatchObject({
      colour: 'custom',
      themeColor: '#1677FF',
      navTheme: 'dark',
      logoSource: 'appIcon',
      layoutDirection: 'l_shape',
      customThemeStyle,
    });

    const preserved = buildUpdateAppPostData(
      parseArgs(['APP_1', '--nav-theme', 'white']),
      {
        appName: { zh_CN: '应用' },
        description: { zh_CN: '描述' },
        themeColor: '#334455',
        customThemeStyle: JSON.parse(customThemeStyle),
        mode: 'normal',
        type: 'single',
      },
      { csrfToken: 'csrf' }
    );
    expect(preserved).toMatchObject({
      themeColor: '#334455',
      customThemeStyle,
      navTheme: 'white',
    });
  });

  test('custom theme files synchronize system app icon color to --color-brand1-6', () => {
    const payload = buildUpdateAppPostData(
      {
        ...parseArgs(['APP_1', '--theme-file', './app-theme.css']),
        themeColor: 'rgb(22, 119, 255)',
        customThemeStyle: JSON.stringify({ cssUrl: 'https://example.com/app-theme.css', enabled: true }),
      },
      {
        appName: { zh_CN: '法律服务应用' },
        description: { zh_CN: '描述' },
        icon: 'xian-falv%%#111827',
        mode: 'normal',
        type: 'single',
      },
      { csrfToken: 'csrf' }
    );

    expect(payload).toMatchObject({
      icon: 'xian-falv%%#1677FF',
      iconUrl: 'xian-falv%%#1677FF',
      themeColor: 'rgb(22, 119, 255)',
    });
  });

  test('custom theme files do not rewrite uploaded image app icons', () => {
    const imageIcon = 'https://cdn.example.com/app-icon.png';
    const payload = buildUpdateAppPostData(
      {
        ...parseArgs(['APP_1', '--theme-file', './app-theme.css']),
        themeColor: '#B421FD',
        customThemeStyle: JSON.stringify({ cssUrl: 'https://example.com/app-theme.css', enabled: true }),
      },
      {
        appName: { zh_CN: '品牌应用' },
        description: { zh_CN: '描述' },
        icon: imageIcon,
        mode: 'normal',
        type: 'single',
      },
      { csrfToken: 'csrf' }
    );

    expect(payload).toMatchObject({ icon: imageIcon, iconUrl: imageIcon });
    expect(syncSystemIconColor('data:image/png;base64,AAAA', '#B421FD'))
      .toBe('data:image/png;base64,AAAA');
  });

  test('switching to a preset theme clears the previously uploaded custom CSS', () => {
    const payload = buildUpdateAppPostData(
      parseArgs(['APP_1', '--theme', 'podGreen']),
      {
        appName: { zh_CN: '应用' },
        description: { zh_CN: '描述' },
        mode: 'normal',
        type: 'single',
        themeColor: '#8F66FF',
        customThemeStyle: JSON.stringify({ cssUrl: 'https://example.com/old.css', enabled: true }),
      },
      { csrfToken: 'csrf' }
    );

    expect(payload).toMatchObject({
      colour: 'podGreen',
      themeColor: '',
      customThemeStyle: '',
    });
  });
});
