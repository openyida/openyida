'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

jest.mock('../lib/core/yida-client', () => ({
  createAuthRef: jest.fn(),
}));

const utils = require('../lib/core/utils');
const yidaClient = require('../lib/core/yida-client');
const formDetailStyle = require('../lib/app/form-detail-style');

function createSchema() {
  return {
    pages: [
      {
        componentsMap: [
          { componentName: 'RootContent' },
          { componentName: 'FormContainer' },
          { componentName: 'TextField' },
        ],
        componentsTree: [
          {
            componentName: 'RootContent',
            id: 'root',
            css: 'body { color: #111; }',
            children: [
              {
                componentName: 'FormContainer',
                id: 'form',
                children: [
                  { componentName: 'TextField', id: 'text1', props: { fieldId: 'text1' } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

const authRef = {
  baseUrl: 'https://www.aliwork.com',
  authData: { auth_mode: 'token' },
  authMode: 'token',
};

let logSpy;

beforeEach(() => {
  jest.clearAllMocks();
  utils.requestWithAutoLogin.mockImplementation((requestFn, ref) => requestFn(ref));
  yidaClient.createAuthRef.mockReturnValue(authRef);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  jest.restoreAllMocks();
});

describe('form-detail-style parseArgs', () => {
  test('parses apply arguments with defaults', () => {
    expect(formDetailStyle.parseArgs(['apply', 'APP_X', 'FORM_Y'])).toEqual({
      action: 'apply',
      appType: 'APP_X',
      formUuid: 'FORM_Y',
      cssFile: '',
      preset: 'clean-card',
      themeTokensJson: '',
      themeTokensFile: '',
      json: false,
    });
  });

  test('parses css file and json flag', () => {
    expect(formDetailStyle.parseArgs(['apply', 'APP_X', 'FORM_Y', '--css', 'detail.css', '--json'])).toMatchObject({
      cssFile: 'detail.css',
      json: true,
    });
  });

  test('parses explicit theme tokens json', () => {
    expect(formDetailStyle.parseArgs([
      'apply',
      'APP_X',
      'FORM_Y',
      '--theme-tokens-json',
      '{"--color-brand1-6":"#0F8FA8"}',
    ])).toMatchObject({
      themeTokensJson: '{"--color-brand1-6":"#0F8FA8"}',
    });
  });
});

describe('form-detail-style schema helpers', () => {
  test('upsertFormDetailCss writes runtime detail CSS into the form action', () => {
    const schema = createSchema();
    const action = formDetailStyle.upsertFormDetailCss(schema, '/* yida-form-detail */ body { background: red; }');
    const status = formDetailStyle.inspectFormDetailCss(schema);

    expect(action).toBe('inserted');
    expect(status.installed).toBe(true);
    expect(status.formDetailStyleActionFound).toBe(true);
    expect(status.globalThemeActionFound).toBe(true);
    const formContainer = schema.pages[0].componentsTree[0].children[0];
    expect(formContainer.children.map(item => item.componentName)).not.toContain('Html');
    expect(schema.actions.module.source).toContain('openyida:theme:start');
    expect(schema.actions.module.source).toContain('openyidaThemeDidMount');
    expect(schema.actions.module.source).toContain('yida-form-detail-style');
    expect(schema.actions.module.source).toContain('body { background: red; }');
    expect(schema.pages[0].componentsMap.map((item) => item.componentName)).not.toContain('Html');
  });

  test('upsertFormDetailCss updates action CSS instead of adding Html nodes', () => {
    const schema = createSchema();
    formDetailStyle.upsertFormDetailCss(schema, '/* yida-form-detail */ .a { color: red; }');
    const action = formDetailStyle.upsertFormDetailCss(schema, '/* yida-form-detail */ .a { color: blue; }');

    expect(action).toBe('updated');
    expect(schema.actions.module.source).toContain('blue');
    expect(schema.actions.module.source).not.toContain('red');
  });

  test('removeFormDetailCss removes detail CSS and keeps global theme action', () => {
    const schema = createSchema();
    formDetailStyle.upsertFormDetailCss(schema, '/* yida-form-detail */ .a { color: red; }');
    const action = formDetailStyle.removeFormDetailCss(schema);
    const status = formDetailStyle.inspectFormDetailCss(schema);

    expect(action).toBe('removed');
    expect(status.installed).toBe(false);
    expect(status.globalThemeActionFound).toBe(true);
    expect(status.formDetailStyleActionFound).toBe(false);
    expect(schema.actions.module.source).not.toContain('.a { color: red; }');
  });

  test('ensureYidaGlobalThemeAction injects submission page theme action', () => {
    const schema = createSchema();
    const applied = formDetailStyle._private.ensureYidaGlobalThemeAction(schema);
    const root = schema.pages[0].componentsTree[0];
    const status = formDetailStyle.inspectFormDetailCss(schema);

    expect(applied).toBe(true);
    expect(root.lifeCycles.componentDidMount).toMatchObject({
      name: 'openyidaThemeDidMount',
      type: 'actionRef',
    });
    expect(schema.actions.list).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'openyidaThemeDidMount',
        relatedEventId: 'lifecycle:didMount',
      }),
    ]));
    expect(schema.actions.module.source).toContain('openyida:theme:start');
    expect(schema.actions.module.source).toContain("'yida-global-theme'");
    expect(schema.actions.module.source).toContain('openyidaThemeIsFormDetail');
    expect(schema.actions.module.compiled).toContain('openyidaThemeDidMount');
    expect(status.globalThemeActionFound).toBe(true);
  });

  test('ensureYidaGlobalThemeAction writes explicit theme tokens for form components', () => {
    const schema = createSchema();
    const applied = formDetailStyle._private.ensureYidaGlobalThemeAction(schema, {
      themeTokens: {
        '--color-brand1-6': '#0F8FA8',
        '--color-brand1-2': 'rgba(15, 143, 168, 0.08)',
        colorBrand: '#bad',
        '--bad-value': 'red; color: blue',
      },
    });
    const source = schema.actions.module.source;

    expect(applied).toBe(true);
    expect(source).toContain('var OPENYIDA_THEME_TOKENS = {"--color-brand1-6":"#0F8FA8","--color-brand1-2":"rgba(15, 143, 168, 0.08)"};');
    expect(source).toContain('openyidaThemeReadExplicitTokens');
    expect(source).toContain('openyidaThemeHasVariables(explicitThemeConfig)');
    expect(source).not.toContain('colorBrand');
    expect(source).not.toContain('--bad-value');
  });

  test('upsertFormDetailCss keeps existing explicit theme tokens', () => {
    const schema = createSchema();
    formDetailStyle._private.ensureYidaGlobalThemeAction(schema, {
      themeTokens: { '--color-brand1-6': '#0F8FA8' },
    });
    formDetailStyle.upsertFormDetailCss(schema, '/* yida-form-detail */ .a { color: blue; }');

    expect(schema.actions.module.source).toContain('var OPENYIDA_THEME_TOKENS = {"--color-brand1-6":"#0F8FA8"};');
    expect(schema.actions.module.source).toContain('.a { color: blue; }');
  });
});

describe('form-detail-style api calls', () => {
  test('check fetches schema without saving', async () => {
    utils.httpGet.mockResolvedValue({ success: true, content: createSchema(), gmtModified: 7 });

    const output = await formDetailStyle.run(['check', 'APP_X', 'FORM_Y', '--json']);

    expect(output.success).toBe(true);
    expect(output.installed).toBe(false);
    expect(utils.httpGet).toHaveBeenCalledWith(
      'https://www.aliwork.com',
      '/alibaba/web/APP_X/_view/query/formdesign/getFormSchema.json',
      { formUuid: 'FORM_Y', schemaVersion: 'V5' },
      expect.any(Object)
    );
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('apply succeeds after one Schema save', async () => {
    utils.httpGet.mockResolvedValue({ success: true, content: createSchema(), gmtModified: 8 });
    utils.httpPost.mockResolvedValue({ success: true });

    const output = await formDetailStyle.run(['apply', 'APP_X', 'FORM_Y', '--json']);

    expect(output.success).toBe(true);
    expect(output.action).toBe('inserted');
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_X/_view/query/formdesign/saveFormSchema.json');
    const saveBody = querystring.parse(utils.httpPost.mock.calls[0][2]);
    expect(saveBody.formUuid).toBe('FORM_Y');
    expect(saveBody.schemaVersion).toBe('V5');
    expect(saveBody.importSchema).toBe('true');
    expect(saveBody.gmtModified).toBe('8');
    expect(saveBody.content).toContain('openyida:theme:start');
    expect(saveBody.content).toContain('openyidaThemeDidMount');
    expect(saveBody.content).toContain('yida-form-detail-style');
    expect(output.themeAction).toBe('upserted');
    expect(output).not.toHaveProperty('configResult');
  });

  test('remove succeeds after one Schema save', async () => {
    const schema = createSchema();
    formDetailStyle.upsertFormDetailCss(schema, '/* yida-form-detail */ .a { color: blue; }');
    utils.httpGet.mockResolvedValue({ success: true, content: schema, gmtModified: 9 });
    utils.httpPost.mockResolvedValue({ success: true });

    const output = await formDetailStyle.run(['remove', 'APP_X', 'FORM_Y', '--json']);

    expect(output).toMatchObject({ success: true, installed: false });
    expect(output).not.toHaveProperty('configResult');
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpPost.mock.calls[0][1]).toBe('/dingtalk/web/APP_X/_view/query/formdesign/saveFormSchema.json');
  });

  test('apply fails when Schema save fails', async () => {
    utils.httpGet.mockResolvedValue({ success: true, content: createSchema(), gmtModified: 10 });
    utils.httpPost.mockResolvedValue({ success: false, errorMsg: 'save failed' });

    await expect(formDetailStyle.run(['apply', 'APP_X', 'FORM_Y', '--json'])).rejects.toThrow('save failed');
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });
});
