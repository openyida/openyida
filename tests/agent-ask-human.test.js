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

test('prints static managed help without writing a receipt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-ask-'));
  const env = managed(root);
  let output = '';
  expect(run(['--help'], { env, cwd: root, stdout: { write(value) { output += value; } } })).toEqual({ ok: true, help: true });
  expect(output).toContain('openyida agent ask-human --request-key');
  expect(output).toContain('single_select');
  expect(fs.existsSync(env.OPENYIDA_AGENT_INTERACTIONS_DIR)).toBe(false);
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

// Runtime's validAskText rejects Unicode control characters and non-trimmed text.
// CLI validation must fail before writing a receipt that could interrupt a run.
test.each([
  ['title', '确认\n方案'], ['header', '范围\t选择'], ['question', '第一段\n第二段'],
  ['id', 'scope\u0000id'], ['label', '确认\u0085方案'], ['description', '说明\r内容'],
  ['description', ' 说明'],
])('rejects invalid %s text before queuing a runtime receipt', (field, value) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-ask-wire-'));
  const env = managed(root);
  const question = { id: 'scope', header: '范围', question: '请选择', type: 'single_select', options: [{ label: '确认', description: '说明' }] };
  const document = { title: '确认方案', questions: [question] };
  if (field === 'title') {document.title = value;}
  else if (['label', 'description'].includes(field)) {question.options[0][field] = value;}
  else {question[field] = value;}
  fs.writeFileSync(path.join(root, 'questions.json'), JSON.stringify(document));
  try {
    expect(() => run(['--request-key', 'scope-v1', '--questions-file', 'questions.json', '--json'],
      { env, cwd: root, stdout: { write() {} } })).toThrow(expect.objectContaining({ code: 'AGENT_ASK_HUMAN_INVALID' }));
    expect(fs.existsSync(env.OPENYIDA_AGENT_INTERACTIONS_DIR)).toBe(false);
  } finally {fs.rmSync(root, { recursive: true, force: true });}
});

test('preserves Unicode text and optional empty descriptions accepted by runtime', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-ask-wire-'));
  const env = managed(root);
  fs.writeFileSync(path.join(root, 'questions.json'), JSON.stringify({ title: '方案确认 🌱',
    questions: [{ id: 'scope', header: '范围', question: '组织成员提交即报名成功，不需要审批。', type: 'single_select',
      options: [{ label: '确认', description: '' }] }] }));
  try {
    const result = run(['--request-key', 'scope-v1', '--questions-file', 'questions.json', '--json'],
      { env, cwd: root, stdout: { write() {} } });
    const receipt = JSON.parse(fs.readFileSync(path.join(env.OPENYIDA_AGENT_INTERACTIONS_DIR, result.requestId + '.json'), 'utf8'));
    expect(receipt.title).toBe('方案确认 🌱');
    expect(receipt.questions[0].options[0].description).toBe('');
  } finally {fs.rmSync(root, { recursive: true, force: true });}
});
