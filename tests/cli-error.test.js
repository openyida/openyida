'use strict';

const {
  CliError,
  isCliError,
  shouldUseStructuredErrorOutput,
  toErrorPayload,
} = require('../lib/core/cli-error');

describe('CliError', () => {
  test('keeps exit code and code metadata', () => {
    const error = new CliError('Bad input', {
      code: 'BAD_INPUT',
      exitCode: 2,
      details: { token: 'secret-token-value' },
      usage: 'openyida example',
    });

    expect(isCliError(error)).toBe(true);
    expect(error.exitCode).toBe(2);
    expect(error.usage).toBe('openyida example');
    expect(toErrorPayload(error)).toEqual({
      success: false,
      errorCode: 'BAD_INPUT',
      errorMsg: 'Bad input',
      details: { token: 'secr***alue' },
    });
  });

  test('normal errors become unexpected error payloads', () => {
    const payload = toErrorPayload(new Error('Boom'));

    expect(payload).toEqual({
      success: false,
      errorCode: 'UNEXPECTED_ERROR',
      errorMsg: 'Boom',
    });
  });

  test('promotes actionable stage details for JSON callers', () => {
    const error = new CliError('Save failed', {
      code: 'SAVE_FAILED',
      details: {
        stage: 'save_definition',
        completedStages: ['read_definition', 'build_definition'],
        nextStep: '检查流程节点配置后重试。',
        authToken: 'private-token',
      },
    });

    expect(toErrorPayload(error)).toEqual({
      success: false,
      errorCode: 'SAVE_FAILED',
      errorMsg: 'Save failed',
      stage: 'save_definition',
      completedStages: ['read_definition', 'build_definition'],
      nextStep: '检查流程节点配置后重试。',
      details: {
        stage: 'save_definition',
        completedStages: ['read_definition', 'build_definition'],
        nextStep: '检查流程节点配置后重试。',
        authToken: 'priv***oken',
      },
    });
  });

  test('promotes owned residual metadata and forces structured output without --json', () => {
    const error = new CliError('Readback mismatch', {
      code: 'REPORT_SCHEMA_READBACK_MISMATCH',
      details: {
        partial: true,
        residual: {
          type: 'report',
          appType: 'APP_1',
          reportId: 'REPORT_1',
          url: 'https://demo.aliwork.com/APP_1/workbench/REPORT_1',
          workbenchUrl: 'https://demo.aliwork.com/APP_1/workbench/REPORT_1',
          owned: true,
          state: 'created_partial',
        },
        retryable: false,
        retrySafe: false,
        sideEffectState: 'partial',
        nextAction: {
          commandId: 'report.inspect',
          args: { appType: 'APP_1', reportId: 'REPORT_1' },
        },
        nextStep: 'openyida report inspect APP_1 REPORT_1 --json',
      },
    });

    expect(toErrorPayload(error)).toMatchObject({
      success: false,
      errorCode: 'REPORT_SCHEMA_READBACK_MISMATCH',
      partial: true,
      residual: {
        type: 'report',
        appType: 'APP_1',
        reportId: 'REPORT_1',
        url: 'https://demo.aliwork.com/APP_1/workbench/REPORT_1',
        workbenchUrl: 'https://demo.aliwork.com/APP_1/workbench/REPORT_1',
        owned: true,
        state: 'created_partial',
      },
      retryable: false,
      retrySafe: false,
      sideEffectState: 'partial',
      nextStep: 'openyida report inspect APP_1 REPORT_1 --json',
    });
    expect(shouldUseStructuredErrorOutput(error, [])).toBe(true);
    expect(shouldUseStructuredErrorOutput(new CliError('Bad input'), [])).toBe(false);
    expect(shouldUseStructuredErrorOutput(new CliError('Bad input'), ['--json'])).toBe(true);
  });

  test('promotes unknown mutation outcome and forces structured output without --json', () => {
    const error = new CliError('Delete outcome unknown', {
      code: 'DATA_DELETE_RESULT_UNKNOWN',
      details: {
        target: {
          type: 'formInstance',
          appType: 'APP_1',
          formUuid: 'FORM_1',
          formInstId: 'FINST_1',
        },
        deleted: false,
        mutationAccepted: true,
        readbackVerified: false,
        status: 'RESULT_UNKNOWN',
        retryable: false,
        retrySafe: false,
        sideEffectState: 'unknown',
        nextStep: 'openyida data get form APP_1 --inst-id FINST_1 --json',
      },
    });

    expect(toErrorPayload(error)).toMatchObject({
      errorCode: 'DATA_DELETE_RESULT_UNKNOWN',
      target: {
        type: 'formInstance',
        formInstId: 'FINST_1',
      },
      deleted: false,
      mutationAccepted: true,
      readbackVerified: false,
      status: 'RESULT_UNKNOWN',
      retryable: false,
      retrySafe: false,
      sideEffectState: 'unknown',
    });
    expect(shouldUseStructuredErrorOutput(error, [])).toBe(true);
  });
});
