'use strict';

const fs = require('fs');
const path = require('path');

const CREATE_FORM_PATH = path.join(__dirname, '..', 'lib', 'app', 'create-form.js');
const sourceCode = fs.readFileSync(CREATE_FORM_PATH, 'utf-8');
const createForm = require('../lib/app/create-form');

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

// ── Bug #2: generateFieldId 必须使用递增计数器确保唯一性 ──

describe('generateFieldId uniqueness', () => {
  test('generateFieldId uses an incrementing counter variable', () => {
    expect(sourceCode).toContain('_fieldIdCounter');
  });

  test('generateFieldId increments the counter on each call', () => {
    const functionBody = extractFunctionBody(sourceCode, 'generateFieldId');
    expect(functionBody).toBeDefined();
    expect(functionBody).toContain('_fieldIdCounter++');
  });

  test('counter value is included in the generated suffix', () => {
    const functionBody = extractFunctionBody(sourceCode, 'generateFieldId');
    expect(functionBody).toBeDefined();
    expect(functionBody).toContain('counterPart');
    expect(functionBody).toMatch(/suffix\s*=.*counterPart/);
  });
});

// ── Bug #3: buildFormSchema 必须包含 componentDidMount 生命周期 ──

describe('buildFormSchema lifeCycles', () => {
  test('lifeCycles includes componentDidMount with actionRef to didMount', () => {
    const formSchemaFunction = extractFunctionBody(sourceCode, 'buildFormSchema');
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
    const formSchemaFunction = extractFunctionBody(sourceCode, 'buildFormSchema');
    expect(formSchemaFunction).toBeDefined();

    const formContainerMatches = formSchemaFunction.match(/componentName:\s*['"]FormContainer['"]/g) || [];
    expect(formContainerMatches.length).toBe(1);
  });

  test('RootContent has exactly one FormContainer child', () => {
    const formSchemaFunction = extractFunctionBody(sourceCode, 'buildFormSchema');
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
    const formSchemaFunction = extractFunctionBody(sourceCode, 'buildFormSchema');
    expect(formSchemaFunction).toBeDefined();
    expect(sourceCode).toContain('function normalizeComponentAlias(');
    expect(sourceCode).toContain('function buildComponentAliasItems(');
    expect(formSchemaFunction).toContain('componentAliasItems');
    expect(formSchemaFunction).toContain('items: componentAliasItems');
  });

  test('field definitions accept alias and componentAlias without writing them into props', () => {
    expect(sourceCode).toContain('field.componentAlias');
    expect(sourceCode).toContain('field.component_alias');
    expect(sourceCode).toContain('field.alias');
    expect(sourceCode).toContain('component[COMPONENT_ALIAS_META]');
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
    expect(sourceCode).toContain('isNativeFieldValidationRule');
    expect(sourceCode).toContain('function resetGeneratedTextFieldValidationType');
    expect(sourceCode).toContain("field.props.validationType = 'text'");
    expect(sourceCode).not.toContain('field.props.validationType = rule.type');
    expect(sourceCode).toContain('found.field.props.validation = dedupeValidationRules');
    expect(sourceCode).toContain('customValidate');
    expect(sourceCode).toContain('cleanupLegacySmartValidationArtifacts');
  });

  test('smart validation emits native customValidate functions without submit hooks', () => {
    expect(sourceCode).toContain('function buildCustomValidateParam');
    expect(sourceCode).toContain("type: 'js'");
    expect(sourceCode).toContain('function validateRule(value, currentRule)');
    expect(sourceCode).toContain("=== 'idCard'");
    expect(sourceCode).toContain("=== 'bankCard'");
    expect(sourceCode).toContain("=== 'unifiedSocialCreditCode'");
    expect(sourceCode).toContain("=== 'compare'");
    expect(sourceCode).toContain("=== 'async'");
    expect(sourceCode).not.toContain('function buildSmartValidationActionSource');
  });

  test('create fields preserve validation definitions', () => {
    expect(sourceCode).toContain('normalizeFieldValidationRules(field)');
    expect(sourceCode).toContain('normalizeDesignerValidationRule');
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
    expect(sourceCode).toContain('function applySelectDataSourceConfig(');
    expect(sourceCode).toContain('props.searchConfig = {');
    expect(sourceCode).toContain('props.defaultDataSource = Object.assign');
    expect(sourceCode).toContain("action: 'bind-datasource'");
  });
});
