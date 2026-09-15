'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { managedError } = require('./managed-context');
const { readManagedContext } = require('./managed-context');
const { beginManagedMutationCapture, classifyManagedMutation } = require('./mutation-receipt');

const MAX_RECEIPT_BYTES = 16 * 1024;

function retryReceiptFileOperation(operation) {
  const delays = [20, 40, 80, 160, 320];
  for (let attempt = 0; ; attempt++) {
    try {return operation();} catch (error) {
      if (process.platform !== 'win32' || attempt === delays.length ||
          !['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) {throw error;}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delays[attempt]);
    }
  }
}

function writeReceipt(directory, receipt) {
  const bytes = JSON.stringify(receipt);
  if (Buffer.byteLength(bytes) > MAX_RECEIPT_BYTES) {throw managedError('MANAGED_RECEIPT_INVALID', 'managed_receipt_invalid');}
  const temporary = path.join(directory, `.pending-${crypto.randomUUID()}`);
  let fd;
  let failure;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    retryReceiptFileOperation(() => fs.renameSync(temporary, path.join(directory, `${receipt.id}.json`)));
    if (process.platform !== 'win32') {
      const parent = fs.openSync(directory, 'r');
      try {fs.fsyncSync(parent);} finally {fs.closeSync(parent);}
    }
  } catch (error) {
    failure = error;
  }
  try {
    if (fd !== undefined) {fs.closeSync(fd);}
    if (fs.existsSync(temporary)) {retryReceiptFileOperation(() => fs.unlinkSync(temporary));}
  } catch (error) {
    // Preserve the publish error if cleanup also encounters a Windows lock.
    if (!failure) {failure = error;}
  }
  if (failure) {throw failure;}
}

// One bounded receipt only for an explicit successful Yida write. No argv,
// stdout, source, credentials, or crash-time intent record is persisted.
function beginCommandReceipt({ command, args = [], env = process.env, consoleObject = console } = {}) {
  if (env.OPENYIDA_MANAGED_RUN !== '1') {return { finish() {} };}
  // Only an allowlisted Yida write gets a durable receipt. Reads, help and
  // ordinary CLI bookkeeping must not create files in the attempt directory.
  if (!classifyManagedMutation(command, args)) {return { finish() {} };}
  const context = readManagedContext(env);
  const directory = env.OPENYIDA_AGENT_RECEIPTS_DIR;
  if (!directory || !path.isAbsolute(directory) || fs.realpathSync(directory) !== path.resolve(directory)) {
    throw managedError('MANAGED_RECEIPT_INVALID', 'managed_receipt_invalid');
  }
  const info = fs.lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || process.platform !== 'win32' && (info.mode & 0o077)) {
    throw managedError('MANAGED_RECEIPT_INVALID', 'managed_receipt_invalid');
  }
  if (fs.readdirSync(directory).length >= 4000) {throw managedError('MANAGED_RECEIPT_INVALID', 'managed_receipt_invalid');}
  const receipt = { schemaVersion: 1, id: crypto.randomUUID(), runId: context.runId,
    attemptId: context.attemptId };
  const capture = beginManagedMutationCapture({ command, args, env, consoleObject, eventId: receipt.id });
  let finished = false;
  return {
    finish(exitCode = 0) {
      if (finished) {return;}
      finished = true;
      const mutation = exitCode === 0 ? capture.commit() : (capture.discard(), null);
      if (mutation) {writeReceipt(directory, { ...receipt, mutation });}
    },
  };
}

module.exports = { beginCommandReceipt, writeReceipt, MAX_RECEIPT_BYTES };
