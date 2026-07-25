'use strict';

const { schemaError } = require('./structured-error');

const STALE_SCHEMA_MESSAGE = '页面已变更，请更新后再修改并重新保存';
const SERVER_REVISION_CONFLICTS = new WeakSet();

function getSchemaServerRevision(value) {
  const schema = normalizeSchemaContent(value);
  if (!schema) {
    return undefined;
  }
  const revision = schema.gmtModified;
  return Number.isFinite(revision) && revision >= 0 ? revision : undefined;
}

function requireSchemaServerRevision(value, createError) {
  const revision = getSchemaServerRevision(value);
  if (revision !== undefined) {
    return revision;
  }
  if (typeof createError === 'function') {
    throw createError();
  }
  throw schemaError('SCHEMA_REMOTE_READ_FAILED', 'Remote Schema revision is missing or invalid.');
}

function isSaveFormSchemaRevisionConflict(result) {
  if (!result || typeof result !== 'object' || result.success !== false) {
    return false;
  }
  if (String(result.errorCode || '') !== '500') {
    return false;
  }
  return result.errorMsg === STALE_SCHEMA_MESSAGE || result.throwable === STALE_SCHEMA_MESSAGE;
}

function createServerRevisionConflict(resourceType) {
  const error = schemaError('REMOTE_REVISION_CONFLICT', 'Resource changed after the remote read.', {
    details: { resourceType },
  });
  SERVER_REVISION_CONFLICTS.add(error);
  return error;
}

function isServerRevisionConflict(error) {
  return !!error && SERVER_REVISION_CONFLICTS.has(error);
}

function normalizeSchemaContent(value) {
  let schema = value && Object.prototype.hasOwnProperty.call(value, 'content')
    ? value.content
    : value;
  if (typeof schema === 'string') {
    try {
      schema = JSON.parse(schema);
    } catch (error) {
      return null;
    }
  }
  return schema && typeof schema === 'object' && !Array.isArray(schema) ? schema : null;
}

module.exports = Object.freeze({
  STALE_SCHEMA_MESSAGE,
  createServerRevisionConflict,
  getSchemaServerRevision,
  isSaveFormSchemaRevisionConflict,
  isServerRevisionConflict,
  requireSchemaServerRevision,
});
