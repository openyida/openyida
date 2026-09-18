'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { readManagedContext } = require('./managed-context');

const SCHEMA = 'openyida.ask-human.v1';
const MAX_FILE_BYTES = 32 * 1024;

function fail(code, message) { throw new CliError(message, { code, details: { retryable: false } }); }
function text(value, max) { return typeof value === 'string' && value === value.trim() && value.length > 0 && Buffer.byteLength(value) <= max; }

function parseArgs(argv) {
  const result = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (name === '--json' && !result.json) { result.json = true; continue; }
    const key = name === '--request-key' ? 'requestKey' : name === '--questions-file' ? 'questionsFile' : null;
    if (!key || result[key] !== undefined || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      fail('AGENT_ASK_HUMAN_INVALID', '用法：openyida agent ask-human --request-key <稳定业务键> --questions-file <相对路径> --json');
    }
    result[key] = argv[++i];
  }
  if (!text(result.requestKey, 128) || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(result.requestKey) ||
      !text(result.questionsFile, 512) || path.isAbsolute(result.questionsFile)) {
    fail('AGENT_ASK_HUMAN_INVALID', 'Ask Human 参数无效。');
  }
  return result;
}

function readQuestions(relativePath, cwd) {
  let root;
  let candidate;
  let realCandidate;
  let stat;
  try {
    root = fs.realpathSync(cwd);
    candidate = path.resolve(root, relativePath);
    stat = fs.lstatSync(candidate);
    realCandidate = fs.realpathSync(candidate);
  } catch { fail('AGENT_ASK_HUMAN_INVALID', '问题文件不可读取。'); }
  if (candidate === root || !candidate.startsWith(root + path.sep) || realCandidate === root || !realCandidate.startsWith(root + path.sep)) {
    fail('AGENT_ASK_HUMAN_INVALID', '问题文件必须位于当前工作目录。');
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE_BYTES) { fail('AGENT_ASK_HUMAN_INVALID', '问题文件必须是 32 KiB 以内的普通文件。'); }
  let document;
  try { document = JSON.parse(fs.readFileSync(candidate, 'utf8')); } catch { fail('AGENT_ASK_HUMAN_INVALID', '问题文件不是有效 JSON。'); }
  if (!document || typeof document !== 'object' || Array.isArray(document) || !text(document.title, 256) ||
      !Array.isArray(document.questions) || document.questions.length < 1 || document.questions.length > 3) {
    fail('AGENT_ASK_HUMAN_INVALID', 'Ask Human 问题结构无效。');
  }
  const ids = new Set();
  for (const question of document.questions) {
    const allowed = new Set(['id', 'header', 'question', 'type', 'required', 'options']);
    if (!question || typeof question !== 'object' || Array.isArray(question) || Object.keys(question).some(key => !allowed.has(key)) ||
        !text(question.id, 128) || ids.has(question.id) || !text(question.header, 128) || !text(question.question, 2048) ||
        !['text', 'single_select', 'multi_select'].includes(question.type) ||
        (question.required !== undefined && typeof question.required !== 'boolean')) {
      fail('AGENT_ASK_HUMAN_INVALID', 'Ask Human 问题结构无效。');
    }
    ids.add(question.id);
    const options = question.options === undefined ? [] : question.options;
    if (!Array.isArray(options)) { fail('AGENT_ASK_HUMAN_INVALID', 'Ask Human 选项结构无效。'); }
    if ((question.type === 'text' && options.length) || (question.type !== 'text' && (!Array.isArray(options) || options.length < 1 || options.length > 12)) ||
        options.some(option => !option || typeof option !== 'object' || Array.isArray(option) || Object.keys(option).some(key => !['label', 'description'].includes(key)) || !text(option.label, 512) ||
          (option.description !== undefined && (typeof option.description !== 'string' || Buffer.byteLength(option.description) > 1024)))) {
      fail('AGENT_ASK_HUMAN_INVALID', 'Ask Human 选项结构无效。');
    }
    if (new Set(options.map(option => option.label)).size !== options.length) { fail('AGENT_ASK_HUMAN_INVALID', 'Ask Human 选项不能重复。'); }
  }
  return { title: document.title, questions: document.questions.map(question => ({ ...question, required: question.required !== false })) };
}

function ensureReceiptDir(env) {
  const value = env.OPENYIDA_AGENT_INTERACTIONS_DIR;
  if (!value || !path.isAbsolute(value)) { fail('AGENT_ASK_HUMAN_UNAVAILABLE', '当前任务未启用 Ask Human。'); }
  fs.mkdirSync(value, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) { fail('AGENT_ASK_HUMAN_UNAVAILABLE', 'Ask Human 私有目录不可用。'); }
  if (fs.readdirSync(value).filter(name => name.endsWith('.json')).length >= 64) { fail('AGENT_ASK_HUMAN_LIMIT', '本轮 Ask Human 请求过多。'); }
  return value;
}

function retryWindowsFileOperation(operation) {
  const delays = [20, 40, 80, 160, 320];
  for (let attempt = 0; ; attempt++) {
    try { return operation(); } catch (error) {
      if (process.platform !== 'win32' || attempt === delays.length || !['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) { throw error; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delays[attempt]);
    }
  }
}

function writeReceipt(directory, requestId, receipt) {
  const temporary = path.join(directory, `.${requestId}.tmp`);
  const target = path.join(directory, `${requestId}.json`);
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(receipt));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    retryWindowsFileOperation(() => fs.renameSync(temporary, target));
    if (process.platform !== 'win32') {
      const parent = fs.openSync(directory, 'r');
      try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
    }
  } catch (error) {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch {} }
    if (fs.existsSync(temporary)) { try { retryWindowsFileOperation(() => fs.unlinkSync(temporary)); } catch {} }
    throw error;
  }
}

function run(argv = [], options = {}) {
  const env = options.env || process.env;
  const context = readManagedContext(env);
  if (!context) { fail('AGENT_ASK_HUMAN_MANAGED_ONLY', 'Ask Human 仅可在宜搭云端发起的本地 Agent 任务中使用。'); }
  const args = parseArgs(argv);
  const document = readQuestions(args.questionsFile, options.cwd || process.cwd());
  const digest = crypto.createHash('sha256').update(JSON.stringify(document)).digest('hex');
  const directory = ensureReceiptDir(env);
  for (const name of fs.readdirSync(directory).filter(item => item.endsWith('.json'))) {
    let prior;
    try { prior = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')); } catch { continue; }
    if (prior.requestKey === args.requestKey) {
      if (prior.contentDigest !== digest) { fail('AGENT_ASK_HUMAN_CONFLICT', '同一 request-key 不能提交不同问题。'); }
      const output = { ok: true, requestId: prior.requestId, status: 'queued' };
      (options.stdout || process.stdout).write(JSON.stringify(output) + '\n');
      return output;
    }
  }
  const requestId = crypto.randomUUID();
  const receipt = { schemaVersion: SCHEMA, requestId, requestKey: args.requestKey, contentDigest: digest,
    runId: context.runId, attemptId: context.attemptId, createdAt: new Date().toISOString(), ...document };
  writeReceipt(directory, requestId, receipt);
  const output = { ok: true, requestId, status: 'queued' };
  (options.stdout || process.stdout).write(JSON.stringify(output) + '\n');
  return output;
}

module.exports = { run, SCHEMA };
