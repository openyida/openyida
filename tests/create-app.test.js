'use strict';

const {
  APP_ICON_NAMES,
  DEFAULT_CREATE_LAYOUT_DIRECTION,
  parseCreateAppArgs,
  inferAppDefaults,
  selectRandomAppIcon,
  applyThemeFileCreateDefaults,
  buildCreateAppPayload,
} = require('../lib/app/create-app');

const AGENT_ENV_KEYS = [
  'CLAUDE_CODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'OPENCODE',
  'OPENCODE_CLIENT',
  'QODER_IDE',
  'QODER_AGENT',
  'QODER_PRODUCT_ID',
  'QODER_SESSION_TYPE',
  'QODER_CLI',
  'QODERCLI_INTEGRATION_MODE',
  'QWENWORK_INTEGRATION_MODE',
  'QWENWORKCN_INTEGRATION_MODE',
  'CODEX_SHELL',
  'CODEX_CI',
  'CODEX_THREAD_ID',
  'CODEX_HOME',
  '__CFBundleIdentifier',
  'CURSOR_TRACE_ID',
  'AGENT_WORK_ROOT',
  'MULERUN_CHAT_ID',
  'MULE_DATA_DIR',
  'TERM_PROGRAM',
  'VSCODE_GIT_ASKPASS_NODE',
];

const originalEnv = { ...process.env };

describe('create-app argument parsing', () => {
  beforeEach(() => {
    AGENT_ENV_KEYS.forEach((key) => {
      delete process.env[key];
    });
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  test('keeps backward-compatible positional arguments', () => {
    const parsed = parseCreateAppArgs([
      'CRM',
      'Customer management',
      'xian-qiye',
      '#00B853',
      'deepBlue',
      'light',
      'ver',
    ]);

    expect(parsed).toMatchObject({
      appName: 'CRM',
      description: 'Customer management',
      icon: 'xian-qiye',
      iconColor: '#00B853',
      colour: 'deepBlue',
      navTheme: 'light',
      layoutDirection: 'side',
    });
  });

  test('supports agent-friendly named options', () => {
    const parsed = parseCreateAppArgs([
      '--name', '电商经营管理看板',
      '--desc', 'E-commerce operations management dashboard demo',
      '--theme', 'deepBlue',
      '--locale', 'ja_JP',
    ], () => 0.5);

    expect(parsed).toMatchObject({
      appName: '电商经营管理看板',
      description: 'E-commerce operations management dashboard demo',
      colour: 'deepBlue',
      icon: APP_ICON_NAMES[12],
      iconColor: '#0089FF',
      navTheme: null,
      layoutDirection: 'l_shape',
      locale: 'ja_JP',
    });
  });

  test('creates normal apps by default', () => {
    expect(parseCreateAppArgs(['--name', '普通应用'])).toMatchObject({
      appName: '普通应用',
      colour: 'podBlue',
      layoutDirection: DEFAULT_CREATE_LAYOUT_DIRECTION,
    });
  });

  test('infers legal-service app shell defaults from app name', () => {
    const parsed = parseCreateAppArgs([
      '--name', '恒信律师事务所',
      '--desc', '面向企业客户的法律服务官网和案件管理入口',
    ]);

    expect(parsed).toMatchObject({
      appName: '恒信律师事务所',
      icon: 'xian-falv',
      iconColor: '#5C72FF',
      colour: 'podBlue',
      navTheme: null,
      layoutDirection: 'l_shape',
      industry: 'legal',
    });
  });

  test('infers tea and ecology app shell defaults', () => {
    expect(inferAppDefaults('云山茶叶官网', '绿色茶园品牌展示')).toMatchObject({
      icon: 'xian-diqiu',
      iconColor: '#00B853',
      colour: 'podGreen',
      industry: 'tea-ecology',
    });
  });

  test('explicit options override inferred industry defaults', () => {
    const parsed = parseCreateAppArgs([
      '--name', '水质情况实时监控预警系统',
      '--icon', 'xian-diannao',
      '--icon-color', '#8F66FF',
      '--theme', 'black',
      '--nav-theme', 'dark',
      '--layout', 'ver',
    ]);

    expect(parsed).toMatchObject({
      icon: 'xian-diannao',
      iconColor: '#8F66FF',
      colour: 'black',
      navTheme: 'dark',
      layoutDirection: 'side',
      industry: 'command-screen',
    });
  });

  test('rejects unknown flags instead of treating them as the app name', () => {
    expect(() => parseCreateAppArgs(['--unknown'])).toThrow('Unknown option: --unknown');
  });

  test('does not expose the modern-theme creation marker as a CLI option', () => {
    expect(() => parseCreateAppArgs(['--name', 'CRM', '--create-with-modern-theme', 'n']))
      .toThrow('Unknown option: --create-with-modern-theme');
  });

  test('rejects unsupported locales', () => {
    expect(() => parseCreateAppArgs(['--name', 'CRM', '--locale', 'ko_KR'])).toThrow('Unsupported locale: ko_KR');
  });

  test('rejects custom theme names because --theme only accepts platform presets', () => {
    expect(() => parseCreateAppArgs(['--name', 'CRM', '--theme', 'vibrantOrange']))
      .toThrow('Unsupported theme: vibrantOrange');
  });

  test('configures custom theme, nav, logo source, and modern layout as one creation flow', () => {
    expect(parseCreateAppArgs([
      '--name', 'CRM',
      '--theme-file', './app-theme.css',
      '--nav-theme', 'gray',
      '--logo-source', 'appIcon',
      '--layout', 'l_shape',
    ])).toMatchObject({
      themeFile: './app-theme.css',
      navTheme: 'gray',
      logoSource: 'appIcon',
      layoutDirection: 'l_shape',
    });
  });

  test('uses aligned navigation defaults when a custom theme file is provided', () => {
    expect(parseCreateAppArgs(['--name', 'CRM', '--theme-file', './app-theme.css']))
      .toMatchObject({
        navTheme: 'light',
        logoSource: 'appIcon',
        layoutDirection: 'l_shape',
      });
    expect(() => parseCreateAppArgs(['--name', 'CRM', '--logo-source', 'appIcon']))
      .toThrow('--logo-source must be used with --theme-file');
    expect(() => parseCreateAppArgs([
      '--name', 'CRM',
      '--theme-file', './app-theme.css',
      '--logo-source', 'customImage',
    ])).toThrow('new app has no homepageLogo image yet');
  });

  test('keeps custom theme files optional for backward-compatible app creation', () => {
    expect(parseCreateAppArgs(['--name', 'CRM'], () => 0.5)).toMatchObject({
      appName: 'CRM',
      themeFile: null,
      icon: APP_ICON_NAMES[12],
      iconColor: '#0089FF',
      navTheme: null,
      logoSource: null,
      layoutDirection: 'l_shape',
    });
  });

  test('selects only icons supported by yida-next', () => {
    expect(APP_ICON_NAMES).toHaveLength(24);
    expect(selectRandomAppIcon(() => 0)).toBe('xian-xinwen');
    expect(selectRandomAppIcon(() => 0.999999)).toBe('daka');
    expect(APP_ICON_NAMES).toEqual(expect.arrayContaining(['huoche', 'chaxun', 'shenbao', 'daka']));
    expect(APP_ICON_NAMES).not.toEqual(expect.arrayContaining(['xian-chaxun', 'xian-shenbao', 'xian-daka']));
  });

  test('uses a random system icon and the custom theme brand color for modern app creation', () => {
    const params = parseCreateAppArgs(
      ['--name', 'CRM', '--theme-file', './app-theme.css'],
      () => 0.5
    );
    expect(applyThemeFileCreateDefaults(params, { themeColor: 'rgb(22, 119, 255)' }))
      .toMatchObject({
        icon: APP_ICON_NAMES[12],
        iconColor: '#1677FF',
        navTheme: 'light',
        logoSource: 'appIcon',
        layoutDirection: 'l_shape',
      });
  });

  test('keeps an inferred industry icon and only syncs its color to --color-brand1-6', () => {
    const params = parseCreateAppArgs([
      '--name', '恒信律师事务所',
      '--desc', '面向企业客户的法律服务官网',
      '--theme-file', './app-theme.css',
    ]);
    expect(applyThemeFileCreateDefaults(params, { themeColor: '#B421FD' }))
      .toMatchObject({
        industry: 'legal',
        icon: 'xian-falv',
        iconColor: '#B421FD',
      });
  });

  test('keeps an explicit icon name but still syncs its color to --color-brand1-6', () => {
    const params = parseCreateAppArgs([
      '--name', 'CRM',
      '--theme-file', './app-theme.css',
      '--icon', 'xian-qiye',
      '--icon-color', '#FF0000',
    ]);
    expect(applyThemeFileCreateDefaults(params, { themeColor: '#8f66ff' }))
      .toMatchObject({
        icon: 'xian-qiye',
        iconColor: '#8F66FF',
      });
  });

  test('builds registerApp payload with normal app group', () => {
    const params = parseCreateAppArgs(['--name', '普通宜搭应用', '--desc', '来自 OpenYida']);
    const payload = buildCreateAppPayload(
      params,
      { csrfToken: 'csrf-token' },
      'zh_CN',
      'n',
      'n'
    );

    expect(payload).toMatchObject({
      _csrf_token: 'csrf-token',
      group: 'ALL',
      openExclusive: 'n',
      openPhysicColumn: 'n',
      createWithModernTheme: 'y',
      fromBuilderAi: 'y',
      builderAiSource: 'local',
    });
    expect(payload).not.toHaveProperty('navTheme');
    expect(payload).toHaveProperty('layoutDirection', DEFAULT_CREATE_LAYOUT_DIRECTION);
    expect(JSON.parse(payload.appName)).toMatchObject({ zh_CN: '普通宜搭应用' });
  });

  test('builds registerApp payload with active local agent source', () => {
    process.env.CODEX_SHELL = '1';
    const params = parseCreateAppArgs(['--name', '普通宜搭应用']);
    const payload = buildCreateAppPayload(
      params,
      { csrfToken: 'csrf-token' },
      'zh_CN',
      'n',
      'n'
    );

    expect(payload).toMatchObject({
      fromBuilderAi: 'y',
      builderAiSource: 'codex',
    });
  });

  test('reports new Qoder with the existing qoder builder source contract', () => {
    process.env.QODER_PRODUCT_ID = 'qoder';
    process.env.QODER_SESSION_TYPE = 'app';
    const params = parseCreateAppArgs(['--name', '普通宜搭应用']);
    const payload = buildCreateAppPayload(
      params,
      { csrfToken: 'csrf-token' },
      'zh_CN',
      'n',
      'n'
    );

    expect(payload).toMatchObject({
      fromBuilderAi: 'y',
      builderAiSource: 'qoder',
    });
  });

  test('keeps an explicitly provided navigation layout instead of the L-shaped default', () => {
    const params = parseCreateAppArgs(['--name', '普通宜搭应用', '--nav-theme', 'light', '--layout', 'ver']);
    const payload = buildCreateAppPayload(
      params,
      { csrfToken: 'csrf-token' },
      'zh_CN',
      'n',
      'n'
    );

    expect(payload).toMatchObject({
      navTheme: 'light',
      layoutDirection: 'side',
    });
  });
});
