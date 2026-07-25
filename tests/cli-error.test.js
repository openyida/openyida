'use strict';

const { CliError, isCliError, toErrorPayload } = require('../lib/core/cli-error');

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
});
