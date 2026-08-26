'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');
const PRELOAD = path.join(__dirname, 'fixtures', 'create-auth-no-replay-preload.js');

const EXPECTED_MESSAGES = {
  zh: '身份验证在创建请求期间发生变化；创建结果未知。请先检查目标状态，再决定是否重试。',
  en: 'Authentication changed during the create request; the result is unknown. Verify the target state before retrying.',
  'zh-HK': '建立請求期間的身份驗證發生變化；建立結果未知。請先檢查目標狀態，再決定是否重試。',
  vi: 'Xác thực đã thay đổi trong lúc gửi yêu cầu tạo; chưa xác định được kết quả. Hãy kiểm tra trạng thái đích trước khi thử lại.',
};

function runCreateCommand(command, language) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-create-auth-e2e-'));
  const counterFile = path.join(tempDir, 'counter.json');
  const fieldsFile = path.join(tempDir, 'fields.json');
  fs.writeFileSync(fieldsFile, JSON.stringify([
    { type: 'TextField', label: 'Name' },
  ]));

  const args = command === 'create-page'
    ? [BIN, 'create-page', 'APP_TEST', 'Auth Replay Page', '--open', 'off', '--json']
    : [BIN, 'create-form', 'create', 'APP_TEST', 'Auth Replay Form', fieldsFile, '--open', 'off', '--json'];
  const existingNodeOptions = String(process.env.NODE_OPTIONS || '').trim();
  const preloadOption = `--require=${JSON.stringify(PRELOAD)}`;
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20000,
    env: {
      ...process.env,
      OPENYIDA_LANG: language,
      OPENYIDA_SKIP_UPDATE_CHECK: '1',
      NO_UPDATE_NOTIFIER: '1',
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      OPENYIDA_CREATE_AUTH_COUNTER_FILE: counterFile,
      NODE_OPTIONS: `${existingNodeOptions} ${preloadOption}`.trim(),
    },
  });

  const counter = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
  fs.rmSync(tempDir, { recursive: true, force: true });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    output: `${result.stdout || ''}${result.stderr || ''}`,
    counter,
  };
}

function parseJsonLines(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'))
    .map((line) => JSON.parse(line));
}

function expectUnknownResultCode(result) {
  const stderrJson = result.stderr.match(/\{\s*"success"[\s\S]*\}\s*$/);
  expect(stderrJson).not.toBeNull();
  const stderrPayload = JSON.parse(stderrJson[0]);
  const payloads = [
    ...parseJsonLines(result.stdout),
    stderrPayload,
  ]
    .filter((payload) => payload && payload.success === false);
  expect(payloads.length).toBeGreaterThanOrEqual(2);
  expect(payloads.every((payload) => payload.errorCode === 'NON_IDEMPOTENT_RESULT_UNKNOWN')).toBe(true);
}

describe('create auth no-replay CLI UI E2E', () => {
  test.each(Object.entries(EXPECTED_MESSAGES))(
    'create-page renders the direct %s locale message and never replays create',
    (language, expectedMessage) => {
      const result = runCreateCommand('create-page', language);

      expect(result.status).toBe(1);
      expect(result.output).toContain(expectedMessage);
      expectUnknownResultCode(result);
      expect(result.counter.get).toBe(2);
      expect(result.counter.post).toBe(1);
      expect(result.counter.paths).toEqual([
        expect.objectContaining({ method: 'GET', path: expect.stringContaining('getFormNavigationListByOrder.json') }),
        expect.objectContaining({ method: 'GET', path: expect.stringContaining('getFormNavigationListByOrder.json') }),
        expect.objectContaining({ method: 'POST', path: expect.stringContaining('saveFormSchemaInfo.json') }),
      ]);
    }
  );

  test.each(['zh', 'en'])(
    'create-form renders the %s locale message and never replays create',
    (language) => {
      const result = runCreateCommand('create-form', language);

      expect(result.status).toBe(1);
      expect(result.output).toContain(EXPECTED_MESSAGES[language]);
      expectUnknownResultCode(result);
      expect(result.counter.get).toBe(2);
      expect(result.counter.post).toBe(1);
    }
  );
});
