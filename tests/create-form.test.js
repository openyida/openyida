'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const querystring = require('querystring');

const CREATE_FORM_PATH = path.join(__dirname, '..', 'lib', 'app', 'create-form.js');
const FORM_COMPILER_PATH = path.join(__dirname, '..', 'lib', 'app', 'services', 'form-compiler.js');
const FORM_VALIDATION_PATH = path.join(__dirname, '..', 'lib', 'app', 'services', 'form-validation.js');
const sourceCode = fs.readFileSync(CREATE_FORM_PATH, 'utf-8');
const compilerSourceCode = fs.readFileSync(FORM_COMPILER_PATH, 'utf-8');
const validationSourceCode = fs.readFileSync(FORM_VALIDATION_PATH, 'utf-8');
const createForm = require('../lib/app/create-form');
const formCompiler = require('../lib/app/services/form-compiler');
const { verifyFieldBindings } = require('../lib/app/services/field-bindings');

// ── Bug #1: HTTP helpers must come from core utils ──

describe('create-form.js imports', () => {
  test('imports shared HTTP helpers from utils.js', () => {
    const requireLine = sourceCode
      .split('\n')
      .find((line) => line.includes('require("../core/utils")') || line.includes("require('../core/utils')"));
    expect(requireLine).toBeDefined();
    expect(requireLine).toContain('httpGet');
    expect(requireLine).toContain('httpPost');
    expect(requireLine).toContain('requestWithAutoLogin');
  });

  test('request wrappers delegate to shared HTTP helpers', () => {
    const getBody = extractFunctionBody(sourceCode, 'sendGetRequest');
    const postBody = extractFunctionBody(sourceCode, 'sendPostRequest');
    const updateBody = extractFunctionBody(sourceCode, 'sendUpdateConfigRequest');
    expect(getBody).toContain('httpGet(');
    expect(postBody).toContain('httpPost(');
    expect(updateBody).toContain('httpPost(');
  });
});

describe('legacy process form bridge', () => {
  test('creates through shared form services without stdout and tolerates config warnings', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-process-form-'));
    const fieldsPath = path.join(tmpDir, 'fields.json');
    fs.writeFileSync(fieldsPath, JSON.stringify({
      fields: [
        { key: 'requester', type: 'TextField', label: '申请人', required: true },
      ],
    }));

    jest.resetModules();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockUtils = {
      httpPost: jest.fn((baseUrl, requestPath) => {
        if (requestPath.includes('saveFormSchemaInfo')) {
          return Promise.resolve({ success: true, content: { formUuid: 'FORM_BRIDGE' } });
        }
        if (requestPath.includes('/_view/query/formdesign/saveFormSchema.json')) {
          return Promise.resolve({ success: true });
        }
        if (requestPath.includes('updateFormConfig')) {
          return Promise.resolve({ success: false, errorMsg: 'config warning' });
        }
        return Promise.resolve({ success: true });
      }),
      requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
      loadCookieData: jest.fn(),
      triggerLogin: jest.fn(),
      resolveBaseUrl: jest.fn(() => 'https://example.test'),
      httpGet: jest.fn(() => Promise.resolve({ success: true, content: { gmtModified: 100 } })),
    };

    jest.doMock('../lib/core/utils', () => mockUtils);
    const isolatedCreateForm = require('../lib/app/create-form');
    const result = await isolatedCreateForm.createFormForLegacyProcess({
      baseUrl: 'https://example.test',
      cookies: [{ name: 'session', value: 'private' }],
      csrfToken: 'csrf',
      corpId: 'corp',
    }, {
      appType: 'APP_TEST',
      formTitle: '流程申请',
      fieldsJsonFile: fieldsPath,
    });

    expect(result).toMatchObject({
      success: true,
      appType: 'APP_TEST',
      formUuid: 'FORM_BRIDGE',
      formTitle: '流程申请',
      fieldCount: 1,
      configResult: { success: false, errorMsg: 'config warning' },
    });
    const saveCall = mockUtils.httpPost.mock.calls.find(function (call) {
      return call[1].includes('/_view/query/formdesign/saveFormSchema.json');
    });
    const savedSchema = JSON.parse(querystring.parse(saveCall[2]).content);
    const savedText = JSON.stringify(savedSchema);
    expect(savedText).toContain('textField_');
    expect(savedText).toContain('required');
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.dontMock('../lib/core/utils');
    jest.resetModules();
  });
});

describe('legacy create-form server revision isolation', () => {
  test('uses the adjacent exact-read revision even when a patch mutates root gmtModified', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Revision Test',
      fields: [{ key: 'name', type: 'TextField', label: 'Name' }],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    }).schema;
    initial.gmtModified = 100;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);

    await isolatedCreateForm.run([
      'patch',
      'APP_TEST',
      'FORM_TEST',
      JSON.stringify([{ action: 'replace', path: '/gmtModified', value: 999 }]),
    ]);

    const saveCall = mockUtils.httpPost.mock.calls.find(call => call[1].includes('/saveFormSchema.json'));
    const saveBody = querystring.parse(saveCall[2]);
    expect(saveBody.gmtModified).toBe('100');
    expect(JSON.parse(saveBody.content).gmtModified).toBe(999);
    expect(mockUtils.requestWithAutoLogin).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });

  test('missing exact-read revision blocks save and config network calls', async () => {
    const initial = formCompiler.compileFormDefinition({
      formTitle: 'Revision Test',
      fields: [{ key: 'name', type: 'TextField', label: 'Name' }],
    }, {
      appType: 'APP_TEST',
      formUuid: 'FORM_TEST',
    }).schema;
    const { isolatedCreateForm, mockUtils, consoleSpy } = loadIsolatedLegacyForm(initial);

    await expect(isolatedCreateForm.run([
      'patch',
      'APP_TEST',
      'FORM_TEST',
      JSON.stringify([{ action: 'add', path: '/custom', value: true }]),
    ])).rejects.toMatchObject({ code: 'CREATE_FORM_SCHEMA_REVISION_INVALID' });

    expect(mockUtils.httpPost).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });
});

function loadIsolatedLegacyForm(schema) {
  jest.resetModules();
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const mockUtils = {
    loadCookieData: jest.fn(() => ({
      csrf_token: 'csrf',
      cookies: [{ name: 'session', value: 'private' }],
      corp_id: 'corp',
    })),
    triggerLogin: jest.fn(),
    resolveBaseUrl: jest.fn(() => 'https://example.test'),
    httpGet: jest.fn(() => Promise.resolve({ success: true, content: schema })),
    httpPost: jest.fn((baseUrl, requestPath) => {
      if (requestPath.includes('updateFormConfig')) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    }),
    requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
    detectActiveTool: jest.fn(() => null),
  };
  jest.doMock('../lib/core/utils', () => mockUtils);
  jest.doMock('../lib/core/chalk', () => ({
    banner: jest.fn(),
    step: jest.fn(),
    label: jest.fn(),
    success: jest.fn(),
    fail: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    result: jest.fn(),
    usage: jest.fn(),
    hint: jest.fn(),
    listItem: jest.fn(),
  }));
  return {
    isolatedCreateForm: require('../lib/app/create-form'),
    mockUtils,
    consoleSpy,
  };
}

// ── Bug #2: generateFieldId 必须使用递增计数器确保唯一性 ──

describe('generateFieldId uniqueness', () => {
  test('generateFieldId uses an incrementing counter variable', () => {
    expect(compilerSourceCode).toContain('_fieldIdCounter');
  });

  test('generateFieldId increments the counter on each call', () => {
    const functionBody = extractFunctionBody(compilerSourceCode, 'generateFieldId');
    expect(functionBody).toBeDefined();
    expect(functionBody).toContain('_fieldIdCounter++');
  });

  test('counter value is included in the generated suffix', () => {
    const functionBody = extractFunctionBody(compilerSourceCode, 'generateFieldId');
    expect(functionBody).toBeDefined();
    expect(functionBody).toContain('counterPart');
    expect(functionBody).toMatch(/suffix\s*=.*counterPart/);
  });
});

// ── Bug #3: buildFormSchema 必须包含 componentDidMount 生命周期 ──

describe('buildFormSchema lifeCycles', () => {
  test('lifeCycles includes componentDidMount with actionRef to didMount', () => {
    const formSchemaFunction = extractFunctionBody(compilerSourceCode, 'buildFormSchema');
    expect(formSchemaFunction).toBeDefined();

    // 检查 lifeCycles 中包含 componentDidMount 配置
    expect(formSchemaFunction).toContain('componentDidMount');
    expect(formSchemaFunction).toContain("name: 'didMount'");
    expect(formSchemaFunction).toContain("type: 'actionRef'");
  });
});

// ── Bug #4: buildFormSchema 不能有重复嵌套的 FormContainer ──

describe('buildFormSchema FormContainer structure', () => {
  test('FormContainer does not nest another FormContainer as direct child', () => {
    const formSchemaFunction = extractFunctionBody(compilerSourceCode, 'buildFormSchema');
    expect(formSchemaFunction).toBeDefined();

    const formContainerMatches = formSchemaFunction.match(/componentName:\s*['"]FormContainer['"]/g) || [];
    expect(formContainerMatches.length).toBe(1);
  });

  test('RootContent has exactly one FormContainer child', () => {
    const formSchemaFunction = extractFunctionBody(compilerSourceCode, 'buildFormSchema');
    expect(formSchemaFunction).toBeDefined();

    const rootContentIndex = formSchemaFunction.search(/['"]RootContent['"]/);
    expect(rootContentIndex).toBeGreaterThan(-1);

    const afterRootContent = formSchemaFunction.slice(rootContentIndex);
    const formContainerCount = (afterRootContent.match(/componentName:\s*['"]FormContainer['"]/g) || []).length;
    expect(formContainerCount).toBe(1);
  });
});

describe('component alias schema support', () => {
  test('buildFormSchema writes component alias metadata at page level', () => {
    const formSchemaFunction = extractFunctionBody(compilerSourceCode, 'buildFormSchema');
    expect(formSchemaFunction).toBeDefined();
    expect(compilerSourceCode).toContain('function normalizeComponentAlias(');
    expect(compilerSourceCode).toContain('function buildComponentAliasItems(');
    expect(formSchemaFunction).toContain('componentAliasItems');
    expect(formSchemaFunction).toContain('items: componentAliasItems');
  });

  test('field definitions accept alias and componentAlias without writing them into props', () => {
    expect(compilerSourceCode).toContain('field.componentAlias');
    expect(compilerSourceCode).toContain('field.component_alias');
    expect(compilerSourceCode).toContain('field.alias');
    expect(compilerSourceCode).toContain('component[COMPONENT_ALIAS_META]');
  });

  test('rules and validations can resolve component aliases as field refs', () => {
    expect(sourceCode).toContain('function buildComponentAliasMaps(');
    expect(sourceCode).toContain('aliasByFieldId');
    expect(sourceCode).toContain('fieldIdByAlias');
    expect(sourceCode).toContain('byRef[descriptor.alias]');
    expect(sourceCode).toContain('fieldMap[descriptor.alias]');
  });
});

// ── JS 语法检查 ──

describe('create-form.js syntax', () => {
  test('passes Node.js syntax check', () => {
    const { execSync } = require('child_process');
    expect(() => {
      execSync('node --check ' + CREATE_FORM_PATH, { stdio: 'pipe' });
    }).not.toThrow();
  });
});

describe('create-form module API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('exports run and parseArgs without executing the command on require', () => {
    expect(createForm).toEqual(expect.objectContaining({
      run: expect.any(Function),
      parseArgs: expect.any(Function),
    }));
  });

  test('parseArgs throws CliError for invalid usage instead of exiting', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    let thrown;
    try {
      createForm.parseArgs(['create', 'APP_XXX']);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toMatchObject({
      code: 'CREATE_FORM_INVALID_ARGUMENTS',
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('parseArgs supports validation mode without process.argv mutation', () => {
    expect(createForm.parseArgs([
      'validation',
      'APP_XXX',
      'FORM_XXX',
      '.cache/openyida/forms/validations.json',
    ])).toMatchObject({
      mode: 'validation',
      appType: 'APP_XXX',
      formUuid: 'FORM_XXX',
      validationJsonOrFile: '.cache/openyida/forms/validations.json',
    });
  });
});

describe('form compiler field bindings', () => {
  test('compileFormDefinition reuses existing field bindings by semantic path', () => {
    const compiled = formCompiler.compileFormDefinition({
      formTitle: '访客登记',
      appType: 'APP_XXX',
      formUuid: 'FORM_XXX',
      fields: [
        { key: 'visitorName', type: 'TextField', label: '访客姓名' },
        {
          key: 'items',
          type: 'TableField',
          label: '明细',
          children: [
            { key: 'productName', type: 'TextField', label: '产品名称' },
          ],
        },
      ],
    }, {
      existingBindings: {
        visitorName: 'textField_keep',
        items: 'tableField_keep',
        'items.productName': 'textField_child_keep',
      },
    });

    expect(compiled.fieldBindings).toEqual({
      visitorName: 'textField_keep',
      items: 'tableField_keep',
      'items.productName': 'textField_child_keep',
    });
    expect(JSON.stringify(compiled.schema)).toContain('textField_keep');
    expect(JSON.stringify(compiled.schema)).toContain('textField_child_keep');
  });

  test('compileFormDefinition rejects dots inside semantic keys', () => {
    expect(() => formCompiler.compileFormDefinition({
      formTitle: '访客登记',
      fields: [
        { key: 'bad.key', type: 'TextField', label: '访客姓名' },
      ],
    })).toThrow(/semantic key/);
  });

  test('object-style fields keep property name as authoritative semantic key', () => {
    const compiled = formCompiler.compileFormDefinition({
      formTitle: '访客登记',
      fields: {
        visitorName: { key: 'visitorName', type: 'TextField', label: '访客姓名' },
      },
    }, {
      existingBindings: {
        visitorName: 'textField_keep',
      },
    });

    expect(compiled.fieldBindings).toEqual({ visitorName: 'textField_keep' });
  });

  test('object-style fields reject conflicting internal semantic keys', () => {
    let thrown;
    try {
      formCompiler.compileFormDefinition({
        formTitle: '访客登记',
        fields: {
          visitorName: { key: 'customerName', type: 'TextField', label: '访客姓名' },
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'FORM_COMPILER_SEMANTIC_KEY_CONFLICT',
    });
  });

  test('compileFormDefinition rejects duplicate top-level semantic paths', () => {
    let thrown;
    try {
      formCompiler.compileFormDefinition({
        formTitle: '访客登记',
        fields: [
          { key: 'visitorName', type: 'TextField', label: '访客姓名' },
          { key: 'visitorName', type: 'TextField', label: '联系人姓名' },
        ],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'FORM_COMPILER_DUPLICATE_SEMANTIC_PATH',
    });
  });

  test('compileFormDefinition rejects duplicate table child semantic paths', () => {
    let thrown;
    try {
      formCompiler.compileFormDefinition({
        formTitle: '访客登记',
        fields: [
          {
            key: 'items',
            type: 'TableField',
            label: '明细',
            children: [
              { key: 'productName', type: 'TextField', label: '产品名称' },
              { key: 'productName', type: 'TextField', label: '商品名称' },
            ],
          },
        ],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'FORM_COMPILER_DUPLICATE_SEMANTIC_PATH',
      details: expect.objectContaining({
        semanticPath: 'items.productName',
      }),
    });
  });

  test('verifyFieldBindings checks read-back schema by fieldId', () => {
    const compiled = formCompiler.compileFormDefinition({
      formTitle: '访客登记',
      fields: [
        { key: 'visitorName', type: 'TextField', label: '访客姓名' },
      ],
    }, {
      existingBindings: {
        visitorName: 'textField_keep',
      },
    });
    const verification = verifyFieldBindings({ content: compiled.schema }, {
      visitorName: 'textField_keep',
      missingField: 'textField_missing',
      wrongType: 'textField_keep',
    }, {
      expectedComponentTypes: {
        visitorName: 'TextField',
        wrongType: 'NumberField',
      },
    });

    expect(verification.verified).toEqual(['visitorName']);
    expect(verification.missing).toEqual([{ semanticPath: 'missingField', fieldId: 'textField_missing' }]);
    expect(verification.mismatched).toEqual([{
      semanticPath: 'wrongType',
      fieldId: 'textField_keep',
      expectedComponentType: 'NumberField',
      actualComponentType: 'TextField',
    }]);
  });
});

// ── 辅助函数：提取函数体 ──

function extractFunctionBody(source, functionName) {
  const pattern = new RegExp('function\\s+' + functionName + '\\s*\\(');
  const match = pattern.exec(source);
  if (!match) {return null;}

  let braceCount = 0;
  let started = false;
  const startIndex = match.index;

  for (let charIndex = match.index; charIndex < source.length; charIndex++) {
    if (source[charIndex] === '{') {
      braceCount++;
      started = true;
    } else if (source[charIndex] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        return source.slice(startIndex, charIndex + 1);
      }
    }
  }
  return null;
}

// ── add-option 模式 parseArgs 测试 ──────────────────

describe('add-option mode in source code', () => {
  test('parseArgs recognizes add-option mode', () => {
    expect(sourceCode).toContain("mode === 'add-option'");
    expect(sourceCode).toContain("if (mode === 'add-option')");
  });

  test('mainAddOption function is defined', () => {
    expect(sourceCode).toContain('async function mainAddOption(');
  });

  test('main routes to mainAddOption for add-option mode', () => {
    expect(sourceCode).toContain("parsedArgs.mode === 'add-option'");
    expect(sourceCode).toContain('mainAddOption(parsedArgs');
  });

  test('add-option validates OPTION_FIELD_TYPES', () => {
    expect(sourceCode).toContain('OPTION_FIELD_TYPES.indexOf(targetComponent.componentName)');
  });

  test('add-option deduplicates options by value', () => {
    expect(sourceCode).toContain('existingValues.has(optionText)');
  });

  test('add-option appends to existing dataSource', () => {
    expect(sourceCode).toContain('existingDataSource.push(newItem)');
  });
});

describe('patch mode in source code', () => {
  test('parseArgs recognizes patch mode', () => {
    expect(sourceCode).toContain("mode === 'patch'");
    expect(sourceCode).toContain('patchJsonOrFile');
  });

  test('mainPatch function is defined and routed', () => {
    expect(sourceCode).toContain('async function mainPatch(');
    expect(sourceCode).toContain("parsedArgs.mode === 'patch'");
    expect(sourceCode).toContain('mainPatch(parsedArgs');
  });

  test('patch mode supports field props and JSON pointer operations', () => {
    expect(sourceCode).toContain("action === 'field-props'");
    expect(sourceCode).toContain('applyJsonPointerOperation(schema, operation)');
  });
});

describe('rule mode in source code', () => {
  test('parseArgs recognizes rule mode', () => {
    expect(sourceCode).toContain("mode === 'rule'");
    expect(sourceCode).toContain('rulesJsonOrFile');
  });

  test('mainRule function is defined and routed', () => {
    expect(sourceCode).toContain('async function mainRule(');
    expect(sourceCode).toContain("parsedArgs.mode === 'rule'");
    expect(sourceCode).toContain('mainRule(parsedArgs');
  });

  test('rule mode generates action source and binds field onChange', () => {
    expect(sourceCode).toContain('function applyFormRules(');
    expect(sourceCode).toContain('openyidaApplyRules');
    expect(sourceCode).toContain('openyidaRuleChange_');
    expect(sourceCode).toContain("const eventName = 'onChange'");
  });

  test('rule mode supports visibility and set value rules', () => {
    expect(sourceCode).toContain("type: 'visibility'");
    expect(sourceCode).toContain("type: 'setValue'");
    expect(sourceCode).toContain('openyidaRuleSetBehavior');
    expect(sourceCode).toContain('openyidaRuleSetValue');
    expect(sourceCode).toContain("operator: 'always'");
  });
});

describe('validation mode in source code', () => {
  test('parseArgs recognizes validation mode and add-validation inline options', () => {
    expect(sourceCode).toContain("mode === 'validation'");
    expect(sourceCode).toContain('inlineValidationRule');
    expect(sourceCode).toContain('parseInlineValidationOptions');
  });

  test('validation mode uses native field validation first', () => {
    expect(sourceCode).toContain('function applySmartValidations(');
    expect(sourceCode).toContain('toDesignerValidationRule');
    expect(sourceCode).toContain("require('./services/form-validation')");
    expect(validationSourceCode).toContain('isNativeFieldValidationRule');
    expect(sourceCode).toContain('function resetGeneratedTextFieldValidationType');
    expect(sourceCode).toContain("field.props.validationType = 'text'");
    expect(sourceCode).not.toContain('field.props.validationType = rule.type');
    expect(sourceCode).toContain('found.field.props.validation = dedupeValidationRules');
    expect(validationSourceCode).toContain('customValidate');
    expect(sourceCode).toContain('cleanupLegacySmartValidationArtifacts');
  });

  test('smart validation emits native customValidate functions without submit hooks', () => {
    expect(validationSourceCode).toContain('function buildCustomValidateParam');
    expect(validationSourceCode).toContain("type: 'js'");
    expect(validationSourceCode).toContain('function validateRule(value, currentRule)');
    expect(validationSourceCode).toContain("=== 'idCard'");
    expect(validationSourceCode).toContain("=== 'bankCard'");
    expect(validationSourceCode).toContain("=== 'unifiedSocialCreditCode'");
    expect(validationSourceCode).toContain("=== 'compare'");
    expect(validationSourceCode).toContain("=== 'async'");
    expect(sourceCode).not.toContain('function buildSmartValidationActionSource');
  });

  test('create fields preserve validation definitions', () => {
    expect(compilerSourceCode).toContain('normalizeFieldValidationRules(field)');
    expect(compilerSourceCode).toContain("require('./form-validation')");
    expect(validationSourceCode).toContain('normalizeDesignerValidationRule');
  });
});

describe('bind-datasource mode in source code', () => {
  test('parseArgs recognizes bind-datasource aliases', () => {
    expect(sourceCode).toContain("mode === 'bind-datasource'");
    expect(sourceCode).toContain("mode === 'datasource'");
    expect(sourceCode).toContain('dataSourceJsonOrFile');
  });

  test('mainBindDataSource is defined and routed', () => {
    expect(sourceCode).toContain('async function mainBindDataSource(');
    expect(sourceCode).toContain("parsedArgs.mode === 'bind-datasource'");
    expect(sourceCode).toContain('mainBindDataSource(parsedArgs');
  });

  test('datasource binding updates searchConfig and defaultDataSource', () => {
    expect(compilerSourceCode).toContain('function applySelectDataSourceConfig(');
    expect(formCompiler.applySelectDataSourceConfig).toEqual(expect.any(Function));
    expect(sourceCode).toContain('applySelectDataSourceConfig,');
    expect(compilerSourceCode).toContain('props.searchConfig = {');
    expect(compilerSourceCode).toContain('props.defaultDataSource = Object.assign');
    expect(sourceCode).toContain("action: 'bind-datasource'");
  });

  test('shared datasource helper normalizes remote option config into field props', () => {
    const props = {
      defaultDataSource: {
        customStashOptions: [],
        formula: { data: [], event: { 'onPageReady,onChange': [] } },
      },
    };

    const normalized = formCompiler.applySelectDataSourceConfig(props, {
      url: '/gateway/options.json',
      dataType: 'jsonp',
      queryParam: 'keyword',
      listPath: 'content.items',
      labelField: 'name',
      valueField: 'id',
      options: [{ label: 'Seed option', value: 'seed' }],
      props: {
        searchConfig: {
          url: '/gateway/override.json',
        },
        defaultDataSource: {
          searchConfig: {
            beforeFetch: 'function willFetch(params) { params.keyword = params.key; return params; }',
          },
        },
      },
    });

    expect(normalized).toMatchObject({
      url: '/gateway/options.json',
      dataType: 'jsonp',
      dataSourceType: 'custom',
      filterLocal: false,
      showSearch: true,
    });
    expect(props.dataSource).toEqual([
      expect.objectContaining({
        value: 'seed',
        text: expect.objectContaining({ zh_CN: 'Seed option' }),
      }),
    ]);
    expect(props.dataSourceType).toBe('custom');
    expect(props.filterLocal).toBe(false);
    expect(props.showSearch).toBe(true);
    expect(props.searchConfig).toMatchObject({
      dataType: 'jsonp',
      url: '/gateway/override.json',
      afterFetch: expect.any(String),
      beforeFetch: expect.any(String),
    });
    expect(props.defaultDataSource).toMatchObject({
      complexType: 'custom',
      url: '/gateway/options.json',
      searchConfig: {
        type: 'JSONP',
        url: '/gateway/options.json',
        afterFetch: expect.any(String),
        beforeFetch: 'function willFetch(params) { params.keyword = params.key; return params; }',
      },
    });
  });
});

describe('legacy create-form compatibility', () => {
  test('shared field reference helper resolves main and table filling rules', () => {
    expect(formCompiler.resolveFieldIdReferences).toEqual(expect.any(Function));
    expect(sourceCode).toContain('resolveFieldIdReferences,');

    const formFields = [
      {
        componentName: 'TextField',
        props: {
          fieldId: 'textField_customerName',
          label: { zh_CN: '客户名称' },
        },
      },
      {
        componentName: 'TableField',
        props: {
          fieldId: 'tableField_lineItems',
          label: { zh_CN: '明细子表' },
        },
        children: [
          {
            componentName: 'TextField',
            props: {
              fieldId: 'textField_itemName',
              label: { zh_CN: '明细名称' },
            },
          },
        ],
      },
      {
        componentName: 'AssociationFormField',
        props: {
          fieldId: 'associationFormField_customer',
          label: { zh_CN: '关联客户' },
          dataFillingRules: {
            mainRules: [{
              source: 'remoteCustomerName',
              target: '@label:客户名称',
            }],
            tableRules: [{
              tableId: 'remoteLines',
              rules: [{
                source: 'remoteLineItems',
                target: '@label:明细子表',
              }],
            }],
          },
        },
      },
    ];

    formCompiler.resolveFieldIdReferences(formFields);

    const fillingRules = formFields[2].props.dataFillingRules;
    expect(fillingRules.mainRules[0]).toMatchObject({
      target: 'textField_customerName',
      targetFieldId: 'textField_customerName',
      targetType: 'TextField',
    });
    expect(fillingRules.tableRules[0].rules[0]).toMatchObject({
      target: 'tableField_lineItems',
      targetFieldId: 'tableField_lineItems',
      targetType: 'TableField',
    });
    expect(JSON.stringify(fillingRules)).not.toContain('@label:');
  });

  test('create mode reads only the shell revision and does not discover semantic keys', async () => {
    jest.resetModules();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockUtils = {
      loadCookieData: jest.fn(() => ({
        csrf_token: 'csrf',
        cookies: [{ name: 'tianshu_corp_user', value: 'corp_user' }],
        corp_id: 'corp',
      })),
      triggerLogin: jest.fn(),
      resolveBaseUrl: jest.fn(() => 'https://example.test'),
      httpGet: jest.fn(() => Promise.resolve({ success: true, content: { gmtModified: 100 } })),
      httpPost: jest.fn((baseUrl, requestPath) => {
        if (requestPath.includes('saveFormSchemaInfo')) {
          return Promise.resolve({ success: true, content: { formUuid: 'FORM_TEST' } });
        }
        if (requestPath.includes('saveFormSchema')) {
          return Promise.resolve({ success: true });
        }
        if (requestPath.includes('updateFormConfig')) {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true });
      }),
      requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
      detectActiveTool: jest.fn(() => null),
    };

    jest.doMock('../lib/core/utils', () => mockUtils);
    jest.doMock('../lib/core/chalk', () => ({
      banner: jest.fn(),
      step: jest.fn(),
      label: jest.fn(),
      success: jest.fn(),
      fail: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      result: jest.fn(),
      usage: jest.fn(),
      hint: jest.fn(),
      listItem: jest.fn(),
    }));

    const isolatedCreateForm = require('../lib/app/create-form');
    await isolatedCreateForm.run([
      'create',
      'APP_XXX',
      '访客登记',
      JSON.stringify([{ key: 'visitorName', type: 'TextField', label: '访客姓名' }]),
    ]);

    expect(mockUtils.httpGet).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(consoleSpy.mock.calls[0][0])).toMatchObject({
      success: true,
      formUuid: 'FORM_TEST',
      formTitle: '访客登记',
      appType: 'APP_XXX',
      fieldCount: 1,
      url: 'https://example.test/APP_XXX/workbench/FORM_TEST',
    });

    consoleSpy.mockRestore();
    jest.dontMock('../lib/core/utils');
    jest.dontMock('../lib/core/chalk');
    jest.resetModules();
  });
});
