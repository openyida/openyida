'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

const utils = require('../lib/core/utils');
const {
  createBlankForm,
  createFormResource,
  prepareFormResourceUpdate,
  saveFormSchema,
  updateFormConfig,
  updateFormResource,
} = require('../lib/app/services/form-service');
const { formAdapter } = require('../lib/schema/adapters/form-adapter');
const { isServerRevisionConflict } = require('../lib/schema/server-revision');
const { compileFormDefinition } = require('../lib/app/services/form-compiler');

const authRef = {
  baseUrl: 'https://example.test',
  csrfToken: 'csrf',
  cookies: [],
};

function baseInput() {
  return {
    appType: 'APP_XXX',
    formTitle: '访客登记',
    fields: [
      { key: 'visitorName', type: 'TextField', label: '访客姓名' },
    ],
    existingBindings: {
      visitorName: 'textField_keep',
    },
  };
}

function schemaWithField(componentName, fieldId) {
  return {
    gmtModified: 100,
    schemaType: 'superform',
    schemaVersion: '5.0',
    pages: [{
      componentsTree: [{
        componentName: 'Page',
        props: {},
        children: [{
          componentName: 'FormContainer',
          props: {},
          children: [{
            componentName,
            props: {
              fieldId,
              label: { zh_CN: '访客姓名' },
            },
          }],
        }],
      }],
    }],
  };
}

function mockCreateSaveConfig(configResult) {
  utils.httpPost.mockImplementation((baseUrl, requestPath) => {
    if (requestPath.includes('saveFormSchemaInfo')) {
      return Promise.resolve({ success: true, content: { formUuid: 'FORM_TEST' } });
    }
    if (requestPath.includes('saveFormSchema')) {
      return Promise.resolve({ success: true });
    }
    if (requestPath.includes('updateFormConfig')) {
      return Promise.resolve(configResult || { success: true });
    }
    return Promise.resolve({ success: true });
  });
}

describe('form service strict create resource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    utils.requestWithAutoLogin.mockImplementation((requestFn, ref) => requestFn(ref));
  });

  test('returns success only after config success and verified bindings', async () => {
    mockCreateSaveConfig({ success: true });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: schemaWithField('TextField', 'textField_keep'),
    });

    const checkpointCreateIdentity = jest.fn();
    const result = await createFormResource({ authRef, checkpointCreateIdentity }, baseInput());

    expect(result).toMatchObject({
      formUuid: 'FORM_TEST',
      fieldBindings: {
        visitorName: 'textField_keep',
      },
      verification: {
        verified: ['visitorName'],
        missing: [],
        mismatched: [],
      },
    });
    expect(checkpointCreateIdentity).toHaveBeenCalledWith({
      appType: 'APP_XXX',
      formUuid: 'FORM_TEST',
      fieldBindings: { visitorName: 'textField_keep' },
      fieldBindingComponents: { visitorName: 'TextField' },
    });
    const saveCall = utils.httpPost.mock.calls.find(call => call[1].includes('/saveFormSchema.json'));
    expect(querystring.parse(saveCall[2]).gmtModified).toBe('100');
  });

  test('uses definition title when creating the blank form shell', async () => {
    utils.httpPost.mockResolvedValue({ success: true, content: { formUuid: 'FORM_TEST' } });

    await expect(createBlankForm(authRef, {
      appType: 'APP_XXX',
      definition: {
        title: '客户审批',
      },
      formType: 'process',
    })).resolves.toMatchObject({ formUuid: 'FORM_TEST' });

    const createCall = utils.httpPost.mock.calls.find(call => call[1].includes('/saveFormSchemaInfo.json'));
    const params = querystring.parse(createCall[2]);
    expect(params.formType).toBe('process');
    expect(JSON.parse(params.title)).toMatchObject({ zh_CN: '客户审批' });
  });

  test('throws stable error when config update fails', async () => {
    mockCreateSaveConfig({ success: false, errorMsg: 'config failed', content: { secret: 'ignored' } });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: schemaWithField('TextField', 'textField_keep'),
    });

    let thrown;
    try {
      await createFormResource(authRef, baseInput());
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'FORM_CONFIG_UPDATE_FAILED',
      details: {
        appType: 'APP_XXX',
        formUuid: 'FORM_TEST',
        result: {
          success: false,
          errorMsg: 'config failed',
        },
      },
    });
    expect(thrown.details.result.content).toBeUndefined();
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
  });

  test('accepts updateFormConfig HTTP 200 empty non-JSON response and verifies readback', async () => {
    mockCreateSaveConfig({
      success: false,
      errorMsg: 'HTTP 200: 响应非 JSON',
      __httpStatus: 200,
      __nonJsonResponse: true,
      __emptyBody: true,
    });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: schemaWithField('TextField', 'textField_keep'),
    });

    const result = await createFormResource(authRef, baseInput());

    expect(result).toMatchObject({
      formUuid: 'FORM_TEST',
      configResult: {
        success: true,
        acceptedNonJsonResponse: true,
        acceptedEmptyResponse: true,
      },
      verification: {
        missing: [],
        mismatched: [],
      },
    });
    expect(utils.httpGet).toHaveBeenCalledTimes(2);
  });

  test('accepts updateFormConfig HTTP 200 non-empty non-JSON response and verifies readback', async () => {
    mockCreateSaveConfig({
      success: false,
      errorMsg: 'HTTP 200: 响应非 JSON',
      __httpStatus: 200,
      __nonJsonResponse: true,
      __emptyBody: false,
    });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: schemaWithField('TextField', 'textField_keep'),
    });

    const result = await createFormResource(authRef, baseInput());

    expect(result).toMatchObject({
      formUuid: 'FORM_TEST',
      configResult: {
        success: true,
        acceptedNonJsonResponse: true,
        acceptedEmptyResponse: false,
      },
      verification: {
        missing: [],
        mismatched: [],
      },
    });
    expect(utils.httpGet).toHaveBeenCalledTimes(2);
  });

  test('rejects updateFormConfig non-JSON response with explicit business code', async () => {
    mockCreateSaveConfig({
      success: false,
      errorMsg: 'HTTP 200: 响应非 JSON',
      errorCode: 'FAILED',
      __httpStatus: 200,
      __nonJsonResponse: true,
      __emptyBody: false,
    });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: schemaWithField('TextField', 'textField_keep'),
    });

    await expect(createFormResource(authRef, baseInput())).rejects.toMatchObject({
      code: 'FORM_CONFIG_UPDATE_FAILED',
      details: {
        result: {
          errorCode: 'FAILED',
          __httpStatus: 200,
          __nonJsonResponse: true,
        },
      },
    });
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
  });

  test('throws stable error when read-back binding is missing', async () => {
    mockCreateSaveConfig({ success: true });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: { gmtModified: 100, schemaType: 'superform', schemaVersion: '5.0', pages: [] },
    });

    await expect(createFormResource(authRef, baseInput())).rejects.toMatchObject({
      code: 'FORM_FIELD_BINDING_VERIFICATION_FAILED',
      details: {
        missing: [{ semanticPath: 'visitorName', fieldId: 'textField_keep' }],
        mismatched: [],
      },
    });
  });

  test('throws stable error when read-back binding component type mismatches', async () => {
    mockCreateSaveConfig({ success: true });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: schemaWithField('NumberField', 'textField_keep'),
    });

    await expect(createFormResource(authRef, baseInput())).rejects.toMatchObject({
      code: 'FORM_FIELD_BINDING_VERIFICATION_FAILED',
      details: {
        missing: [],
        mismatched: [{
          semanticPath: 'visitorName',
          fieldId: 'textField_keep',
          expectedComponentType: 'TextField',
          actualComponentType: 'NumberField',
        }],
      },
    });
  });
});

describe('form service server revision CAS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    utils.requestWithAutoLogin.mockImplementation((requestFn, ref) => requestFn(ref));
  });

  test('rejects a missing revision before transport', async () => {
    await expect(saveFormSchema(authRef, {
      appType: 'APP_XXX',
      formUuid: 'FORM_TEST',
      schema: { pages: [] },
    })).rejects.toMatchObject({ code: 'FORM_SAVE_SCHEMA_PRECHECK_FAILED' });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('brands the confirmed stale response as deterministic JIT conflict without retry', async () => {
    utils.httpPost.mockResolvedValue({
      success: false,
      errorCode: '500',
      throwable: '页面已变更，请更新后再修改并重新保存',
    });
    let thrown;
    try {
      await saveFormSchema(authRef, {
        appType: 'APP_XXX',
        formUuid: 'FORM_TEST',
        schema: { pages: [] },
        serverRevision: 100,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: 'SCHEMA_APPLY_JIT_CONFLICT' });
    expect(isServerRevisionConflict(thrown)).toBe(true);
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['login expiry', { __needLogin: true }],
    ['CSRF expiry', { __csrfExpired: true }],
    ['redirect', { __needLogin: true, __httpStatus: 302 }],
    ['ordinary failure', { success: false, errorCode: 'FAILED' }],
  ])('never retries Schema save after %s', async (label, response) => {
    utils.httpPost.mockResolvedValue(response);

    await expect(saveFormSchema(authRef, {
      appType: 'APP_XXX',
      formUuid: 'FORM_TEST',
      schema: { pages: [] },
      serverRevision: 100,
    })).rejects.toMatchObject({ code: 'FORM_SAVE_SCHEMA_FAILED' });

    expect(label).toBeTruthy();
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
  });

  test('never retries Schema save after a transport error', async () => {
    utils.httpPost.mockRejectedValue(new Error('transport failed'));

    await expect(saveFormSchema(authRef, {
      appType: 'APP_XXX',
      formUuid: 'FORM_TEST',
      schema: { pages: [] },
      serverRevision: 100,
    })).rejects.toThrow('transport failed');

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
  });

  test.each([
    ['blank shell', createBlankForm, { appType: 'APP_XXX', formTitle: 'Form' }],
    ['config', updateFormConfig, { appType: 'APP_XXX', formUuid: 'FORM_TEST', strict: true }],
  ])('schema apply %s write bypasses auto-login replay', async (_label, operation, input) => {
    utils.httpPost.mockResolvedValue({ __csrfExpired: true });

    await expect(operation({
      authRef,
      assertRemoteDispatchBoundary() {},
    }, input)).rejects.toMatchObject({
      code: operation === createBlankForm ? 'FORM_CREATE_BLANK_FAILED' : 'FORM_CONFIG_UPDATE_FAILED',
    });

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.requestWithAutoLogin).not.toHaveBeenCalled();
  });

  test('form JIT lock loss after Schema read prevents mode read', async () => {
    const readFormSchema = jest.fn().mockResolvedValue({
      success: true,
      content: schemaWithField('TextField', 'textField_keep'),
    });
    const readFormMode = jest.fn();
    const lost = Object.assign(new Error('lock lost'), { code: 'SCHEMA_APPLY_LOCK_LOST' });
    let completedPrimitive = 0;

    await expect(formAdapter.readObserved({
      bindings: {
        appType: 'APP_XXX',
        formUuid: 'FORM_TEST',
        fieldBindings: { visitorName: { fieldId: 'textField_keep', componentType: 'TextField' } },
      },
    }, {
      resource: { desired: { mode: 'process' } },
      services: { readFormMode, readFormSchema },
      assertRemoteDispatchBoundary(phase) {
        if (phase === 'after' && ++completedPrimitive === 1) {
          throw lost;
        }
      },
    })).rejects.toBe(lost);

    expect(readFormSchema).toHaveBeenCalledTimes(1);
    expect(readFormMode).not.toHaveBeenCalled();
  });
});

describe('form service managed Schema patch', () => {
  test('patches managed props by fieldId while preserving unmanaged props and adding fields', () => {
    const current = compileFormDefinition({
      title: 'Old title',
      fields: [
        { key: 'name', type: 'TextField', label: 'Old name' },
      ],
    }, {
      appType: 'APP_PATCH',
      formUuid: 'FORM_PATCH',
      existingBindings: { name: 'textField_keep' },
    });
    current.schema.gmtModified = 100;
    const currentField = findComponentByFieldId(current.schema, 'textField_keep');
    currentField.props.unmanagedCustom = { keep: true };

    const prepared = prepareFormResourceUpdate({
      appType: 'APP_PATCH',
      formUuid: 'FORM_PATCH',
      currentSchemaResult: { success: true, content: current.schema },
      existingBindings: {
        name: { fieldId: 'textField_keep', componentType: 'TextField' },
      },
      definition: {
        title: 'New title',
        fields: [
          { key: 'name', type: 'TextField', label: 'New name', required: true },
          { key: 'note', type: 'TextField', label: 'Note' },
        ],
      },
    });

    const patchedName = findComponentByFieldId(prepared.schema, 'textField_keep');
    expect(patchedName.props.label.zh_CN).toBe('New name');
    expect(patchedName.props.validation).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'required' }),
    ]));
    expect(patchedName.props.unmanagedCustom).toEqual({ keep: true });
    expect(prepared.compiled.fieldBindings.note).toMatch(/^textField_/);
    expect(findComponentByFieldId(prepared.schema, prepared.compiled.fieldBindings.note)).toBeTruthy();
  });

  test('rejects managed field removal before a remote save', () => {
    const current = compileFormDefinition({
      title: 'Current',
      fields: [
        { key: 'name', type: 'TextField', label: 'Name' },
        { key: 'note', type: 'TextField', label: 'Note' },
      ],
    }, {
      existingBindings: {
        name: 'textField_name',
        note: 'textField_note',
      },
    });

    expect(() => prepareFormResourceUpdate({
      currentSchemaResult: { content: current.schema },
      existingBindings: {
        name: { fieldId: 'textField_name' },
        note: { fieldId: 'textField_note' },
      },
      definition: {
        title: 'Current',
        fields: [
          { key: 'name', type: 'TextField', label: 'Name' },
        ],
      },
    })).toThrow(expect.objectContaining({
      code: 'FORM_SCHEMA_DESTRUCTIVE_CHANGE_UNSUPPORTED',
    }));
  });

  test('rejects missing existing bindings, duplicate fieldIds, option value removal, and association replacement', () => {
    const current = compileFormDefinition({
      title: 'Current',
      fields: [
        { key: 'name', type: 'TextField', label: 'Name' },
        { key: 'status', type: 'SelectField', label: 'Status', options: ['Draft', 'Done'] },
        {
          key: 'customer',
          type: 'AssociationFormField',
          label: 'Customer',
          associationForm: { appType: 'APP_PATCH', formUuid: 'FORM_CUSTOMER_A' },
        },
      ],
    }, {
      existingBindings: {
        name: 'textField_name',
        status: 'selectField_status',
        customer: 'associationFormField_customer',
      },
    });

    const missingFieldSchema = JSON.parse(JSON.stringify(current.schema));
    removeFieldComponent(missingFieldSchema, 'textField_name');
    expect(() => prepareFormResourceUpdate({
      currentSchemaResult: { content: missingFieldSchema },
      existingBindings: {
        name: { fieldId: 'textField_name' },
        status: { fieldId: 'selectField_status' },
        customer: { fieldId: 'associationFormField_customer' },
      },
      definition: {
        title: 'Current',
        fields: [
          { key: 'name', type: 'TextField', label: 'Name' },
          { key: 'status', type: 'SelectField', label: 'Status', options: ['Draft', 'Done'] },
          {
            key: 'customer',
            type: 'AssociationFormField',
            label: 'Customer',
            associationForm: { appType: 'APP_PATCH', formUuid: 'FORM_CUSTOMER_A' },
          },
        ],
      },
    })).toThrow(expect.objectContaining({
      code: 'FORM_SCHEMA_DESTRUCTIVE_CHANGE_UNSUPPORTED',
      details: { semanticPath: 'name', operation: 'managed_missing' },
    }));

    expect(() => prepareFormResourceUpdate({
      currentSchemaResult: { content: current.schema },
      existingBindings: {
        name: { fieldId: 'textField_name' },
        status: { fieldId: 'selectField_status' },
        customer: { fieldId: 'associationFormField_customer' },
      },
      definition: {
        title: 'Current',
        fields: [
          { key: 'name', type: 'TextField', label: 'Name' },
          { key: 'status', type: 'SelectField', label: 'Status', options: ['Draft'] },
          {
            key: 'customer',
            type: 'AssociationFormField',
            label: 'Customer',
            associationForm: { appType: 'APP_PATCH', formUuid: 'FORM_CUSTOMER_A' },
          },
        ],
      },
    })).toThrow(expect.objectContaining({
      code: 'FORM_SCHEMA_DESTRUCTIVE_CHANGE_UNSUPPORTED',
      details: { semanticPath: 'status', operation: 'remove_option_value' },
    }));

    expect(() => prepareFormResourceUpdate({
      currentSchemaResult: { content: current.schema },
      existingBindings: {
        name: { fieldId: 'textField_name' },
        status: { fieldId: 'selectField_status' },
        customer: { fieldId: 'associationFormField_customer' },
      },
      definition: {
        title: 'Current',
        fields: [
          { key: 'name', type: 'TextField', label: 'Name' },
          { key: 'status', type: 'SelectField', label: 'Status', options: ['Draft', 'Done'] },
          {
            key: 'customer',
            type: 'AssociationFormField',
            label: 'Customer',
            associationForm: { appType: 'APP_PATCH', formUuid: 'FORM_CUSTOMER_B' },
          },
        ],
      },
    })).toThrow(expect.objectContaining({
      code: 'FORM_SCHEMA_DESTRUCTIVE_CHANGE_UNSUPPORTED',
      details: { semanticPath: 'customer', operation: 'replace_association' },
    }));

    const duplicateCurrent = compileFormDefinition({
      title: 'Duplicate',
      fields: [
        { key: 'name', type: 'TextField', label: 'Name' },
        { key: 'note', type: 'TextField', label: 'Note' },
      ],
    }, {
      existingBindings: {
        name: 'textField_name',
        note: 'textField_note',
      },
    });
    expect(() => prepareFormResourceUpdate({
      currentSchemaResult: { content: duplicateCurrent.schema },
      existingBindings: {
        name: { fieldId: 'textField_name' },
        note: { fieldId: 'textField_name' },
      },
      definition: {
        title: 'Duplicate',
        fields: [
          { key: 'name', type: 'TextField', label: 'Name' },
          { key: 'note', type: 'TextField', label: 'Note' },
        ],
      },
    })).toThrow(expect.objectContaining({
      code: 'FORM_SCHEMA_PATCH_INVALID',
    }));
  });

  test('allows adding an option value while preserving existing values', () => {
    const current = compileFormDefinition({
      title: 'Current',
      fields: [
        { key: 'status', type: 'SelectField', label: 'Status', options: ['Draft'] },
      ],
    }, {
      existingBindings: { status: 'selectField_status' },
    });
    const prepared = prepareFormResourceUpdate({
      currentSchemaResult: { content: current.schema },
      existingBindings: {
        status: { fieldId: 'selectField_status' },
      },
      definition: {
        title: 'Current',
        fields: [
          { key: 'status', type: 'SelectField', label: 'Status', options: ['Draft', 'Done'] },
        ],
      },
    });
    expect(findComponentByFieldId(prepared.schema, 'selectField_status').props.dataSource).toHaveLength(2);
  });

  test('strict update saves the patched latest Schema and verifies read-back bindings', async () => {
    jest.clearAllMocks();
    utils.requestWithAutoLogin.mockImplementation((requestFn, ref) => requestFn(ref));
    const current = compileFormDefinition({
      title: 'Current',
      fields: [
        { key: 'name', type: 'TextField', label: 'Name' },
      ],
    }, {
      appType: 'APP_PATCH',
      formUuid: 'FORM_PATCH',
      existingBindings: { name: 'textField_keep' },
    });
    current.schema.gmtModified = 100;
    const input = {
      appType: 'APP_PATCH',
      formUuid: 'FORM_PATCH',
      currentSchemaResult: { success: true, content: current.schema },
      existingBindings: {
        name: { fieldId: 'textField_keep', componentType: 'TextField' },
      },
      definition: {
        title: 'Updated',
        fields: [
          { key: 'name', type: 'TextField', label: 'Updated name', required: true },
        ],
      },
    };
    const prepared = prepareFormResourceUpdate(input);
    utils.httpPost.mockResolvedValue({ success: true });
    utils.httpGet.mockResolvedValue({
      success: true,
      content: { ...prepared.schema, gmtModified: 101 },
    });

    const result = await updateFormResource(authRef, {
      ...input,
      prepared,
      serverRevision: 100,
    });

    expect(result).toMatchObject({
      appType: 'APP_PATCH',
      formUuid: 'FORM_PATCH',
      verification: {
        verified: ['name'],
        missing: [],
        mismatched: [],
      },
    });
    expect(utils.httpPost).toHaveBeenCalledTimes(2);
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
  });
});

function findComponentByFieldId(schema, fieldId) {
  let found;
  function visit(node) {
    if (!node || typeof node !== 'object' || found) {
      return;
    }
    if (node.props && node.props.fieldId === fieldId) {
      found = node;
      return;
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(visit);
    }
  }
  (schema.pages || []).forEach(page => (page.componentsTree || []).forEach(visit));
  return found;
}

function removeFieldComponent(schema, fieldId) {
  function remove(children) {
    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      if (child.props && child.props.fieldId === fieldId) {
        children.splice(index, 1);
        return true;
      }
      if (Array.isArray(child.children) && remove(child.children)) {
        return true;
      }
    }
    return false;
  }
  (schema.pages || []).forEach(page => (page.componentsTree || []).forEach(root => (
    Array.isArray(root.children) && remove(root.children)
  )));
}
