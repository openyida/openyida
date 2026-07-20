'use strict';

const querystring = require('querystring');

const {
  assertPageWriteReady,
  createPageShellOnce,
  readPageResource,
  savePageSchemaOnce,
} = require('../lib/app/services/page-resource-service');

describe('page resource low-level single-request service', () => {
  const authRef = {
    baseUrl: 'https://example.test',
    cookies: [{ name: 'session', value: 'secret' }],
    csrfToken: 'csrf-secret',
  };

  test('reads exact Schema and exact navigation identity without discovery fallback', async () => {
    const httpGet = jest.fn()
      .mockResolvedValueOnce({ success: true, content: { gmtModified: 100, schemaType: 'superform' } })
      .mockResolvedValueOnce({
        success: true,
        content: [
          { formUuid: 'FORM-OTHER', formType: 'display', title: { zh_CN: 'Other' } },
          { formUuid: 'FORM-TARGET', formType: 'display', title: { zh_CN: 'Target' } },
        ],
      });

    const result = await readPageResource({ authRef, services: { httpGet } }, {
      appType: 'APP-TARGET',
      formUuid: 'FORM-TARGET',
    });

    expect(result).toEqual({
      appType: 'APP-TARGET',
      formUuid: 'FORM-TARGET',
      observedFormType: 'display',
      observedTitle: 'Target',
      schema: { gmtModified: 100, schemaType: 'superform' },
      serverRevision: 100,
    });
    expect(httpGet).toHaveBeenCalledTimes(2);
  });

  test('lock loss after Schema GET prevents the navigation GET', async () => {
    const httpGet = jest.fn().mockResolvedValue({
      success: true,
      content: { gmtModified: 100, schemaType: 'superform' },
    });
    const lost = Object.assign(new Error('lock lost'), { code: 'SCHEMA_APPLY_LOCK_LOST' });
    let completedPrimitive = 0;

    await expect(readPageResource({
      authRef,
      services: { httpGet },
      assertRemoteDispatchBoundary(phase) {
        if (phase === 'after' && ++completedPrimitive === 1) {
          throw lost;
        }
      },
    }, {
      appType: 'APP-TARGET',
      formUuid: 'FORM-TARGET',
    })).rejects.toBe(lost);

    expect(httpGet).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['empty success', { success: true, content: '' }],
    ['explicit failure', { success: false, errorMsg: 'not found FORM-SECRET' }],
  ])('fails closed for %s without exposing upstream values', async (label, schemaResult) => {
    const httpGet = jest.fn().mockResolvedValue(schemaResult);
    let error;
    try {
      await readPageResource({ authRef, services: { httpGet } }, {
        appType: 'APP-SECRET',
        formUuid: 'FORM-SECRET',
      });
    } catch (caught) {
      error = caught;
    }

    expect(label).toBeTruthy();
    expect(error).toMatchObject({ code: 'SCHEMA_PAGE_READ_FAILED' });
    expect(JSON.stringify(error)).not.toContain('APP-SECRET');
    expect(JSON.stringify(error)).not.toContain('FORM-SECRET');
  });

  test('create and save each invoke one low-level transport and require explicit success', async () => {
    const httpPost = jest.fn()
      .mockResolvedValueOnce({ success: true, content: { formUuid: 'FORM-TARGET' } })
      .mockResolvedValueOnce({ success: true });
    const context = { authRef, services: { httpPost } };

    await expect(createPageShellOnce(context, {
      appType: 'APP-TARGET',
      title: 'Target',
    })).resolves.toEqual({ appType: 'APP-TARGET', formUuid: 'FORM-TARGET' });
    await expect(savePageSchemaOnce(context, {
      appType: 'APP-TARGET',
      formUuid: 'FORM-TARGET',
      schema: { schemaType: 'superform' },
      serverRevision: 100,
    })).resolves.toEqual({ success: true });

    expect(httpPost).toHaveBeenCalledTimes(2);
    expect(querystring.parse(httpPost.mock.calls[1][2]).gmtModified).toBe('100');
  });

  test('missing revision and confirmed stale CAS both fail closed without retry', async () => {
    const missingRevisionPost = jest.fn();
    await expect(savePageSchemaOnce({ authRef, services: { httpPost: missingRevisionPost } }, {
      appType: 'APP-TARGET',
      formUuid: 'FORM-TARGET',
      schema: { schemaType: 'superform' },
    })).rejects.toMatchObject({ code: 'SCHEMA_PAGE_WRITE_PRECHECK_FAILED' });
    expect(missingRevisionPost).not.toHaveBeenCalled();

    const stalePost = jest.fn().mockResolvedValue({
      success: false,
      errorCode: '500',
      errorMsg: '页面已变更，请更新后再修改并重新保存',
    });
    await expect(savePageSchemaOnce({ authRef, services: { httpPost: stalePost } }, {
      appType: 'APP-TARGET',
      formUuid: 'FORM-TARGET',
      schema: { schemaType: 'superform' },
      serverRevision: 100,
    })).rejects.toMatchObject({ code: 'SCHEMA_APPLY_JIT_CONFLICT' });
    expect(stalePost).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['login expiry', { __needLogin: true }],
    ['CSRF expiry', { __csrfExpired: true }],
    ['redirect', { __needLogin: true, __httpStatus: 302 }],
    ['ordinary failure', { success: false, errorCode: 'FAILED' }],
  ])('never retries page Schema save after %s', async (label, response) => {
    const httpPost = jest.fn().mockResolvedValue(response);

    await expect(savePageSchemaOnce({ authRef, services: { httpPost } }, {
      appType: 'APP-TARGET',
      formUuid: 'FORM-TARGET',
      schema: { schemaType: 'superform' },
      serverRevision: 100,
    })).rejects.toMatchObject({ code: 'SCHEMA_PAGE_SAVE_FAILED' });

    expect(label).toBeTruthy();
    expect(httpPost).toHaveBeenCalledTimes(1);
  });

  test('write readiness rejects before transport when CSRF is absent', () => {
    expect(() => assertPageWriteReady({ authRef: {
      baseUrl: authRef.baseUrl,
      cookies: authRef.cookies,
    } })).toThrow(expect.objectContaining({
      code: 'SCHEMA_PAGE_WRITE_PRECHECK_FAILED',
    }));
  });
});
