'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../lib/agent/ask-human');

function managed(root) {
  return { OPENYIDA_MANAGED_RUN: '1', OPENYIDA_AGENT_APP_TYPE: 'APP_TEST', OPENYIDA_AGENT_CORP_ID: 'corp',
    OPENYIDA_AGENT_USER_ID: 'user', OPENYIDA_AGENT_RUN_ID: 'run', OPENYIDA_AGENT_ATTEMPT_ID: 'attempt',
    OPENYIDA_AGENT_BASE_URL: 'https://example.test', OPENYIDA_AGENT_TASK_GRANT: 'grant-1234567890123456',
    OPENYIDA_AGENT_INTERACTIONS_DIR: path.join(root, 'interactions') };
}

test('fails closed outside managed mode without writing a receipt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-ask-'));
  fs.writeFileSync(path.join(root, 'questions.json'), JSON.stringify({ title: '确认', questions: [{ id: 'scope', header: '范围', question: '请选择', type: 'text' }] }));
  expect(() => run(['--request-key', 'scope-v1', '--questions-file', 'questions.json', '--json'], { env: {}, cwd: root, stdout: { write() {} } })).toThrow(expect.objectContaining({ code: 'AGENT_ASK_HUMAN_MANAGED_ONLY' }));
  expect(fs.existsSync(path.join(root, 'interactions'))).toBe(false);
});

test('writes one idempotent secret-free managed receipt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-ask-'));
  fs.writeFileSync(path.join(root, 'questions.json'), JSON.stringify({ title: '确认方案', questions: [{ id: 'scope', header: '功能范围', question: '请选择功能', type: 'multi_select', options: [{ label: '报名' }, { label: '签到' }] }] }));
  const env = managed(root);
  const first = run(['--request-key', 'scope-v1', '--questions-file', 'questions.json', '--json'], { env, cwd: root, stdout: { write() {} } });
  const second = run(['--request-key', 'scope-v1', '--questions-file', 'questions.json', '--json'], { env, cwd: root, stdout: { write() {} } });
  expect(second.requestId).toBe(first.requestId);
  const files = fs.readdirSync(env.OPENYIDA_AGENT_INTERACTIONS_DIR).filter(name => name.endsWith('.json'));
  expect(files).toHaveLength(1);
  const receipt = JSON.parse(fs.readFileSync(path.join(env.OPENYIDA_AGENT_INTERACTIONS_DIR, files[0]), 'utf8'));
  expect(receipt).toMatchObject({ schemaVersion: 'openyida.ask-human.v1', runId: 'run', attemptId: 'attempt', requestKey: 'scope-v1' });
  expect(JSON.stringify(receipt)).not.toContain(env.OPENYIDA_AGENT_TASK_GRANT);
});

test('rejects traversal, symlinks and conflicting reuse of a request key', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-ask-'));
  const outside = path.join(os.tmpdir(), `openyida-ask-outside-${process.pid}.json`);
  fs.writeFileSync(outside, JSON.stringify({ title: '确认', questions: [{ id: 'scope', header: '范围', question: '请选择', type: 'text' }] }));
  const env = managed(root);
  expect(() => run(['--request-key', 'scope-v1', '--questions-file', path.relative(root, outside), '--json'], { env, cwd: root, stdout: { write() {} } })).toThrow(expect.objectContaining({ code: 'AGENT_ASK_HUMAN_INVALID' }));
  if (process.platform !== 'win32') {
    fs.symlinkSync(outside, path.join(root, 'linked.json'));
    expect(() => run(['--request-key', 'scope-v1', '--questions-file', 'linked.json', '--json'], { env, cwd: root, stdout: { write() {} } })).toThrow(expect.objectContaining({ code: 'AGENT_ASK_HUMAN_INVALID' }));
  }

  const questions = path.join(root, 'questions.json');
  fs.writeFileSync(questions, JSON.stringify({ title: '确认', questions: [{ id: 'scope', header: '范围', question: '请选择', type: 'text' }] }));
  run(['--request-key', 'scope-v1', '--questions-file', 'questions.json', '--json'], { env, cwd: root, stdout: { write() {} } });
  fs.writeFileSync(questions, JSON.stringify({ title: '再次确认', questions: [{ id: 'scope', header: '范围', question: '请选择', type: 'text' }] }));
  expect(() => run(['--request-key', 'scope-v1', '--questions-file', 'questions.json', '--json'], { env, cwd: root, stdout: { write() {} } })).toThrow(expect.objectContaining({ code: 'AGENT_ASK_HUMAN_CONFLICT' }));
  fs.unlinkSync(outside);
});
