'use strict';

function hasRemoteDispatchBoundary(context) {
  return !!(context && typeof context.assertRemoteDispatchBoundary === 'function');
}

function assertRemoteDispatchBoundary(context, phase) {
  if (hasRemoteDispatchBoundary(context)) {
    context.assertRemoteDispatchBoundary(phase);
  }
}

async function dispatchRemotePrimitive(context, callback) {
  assertRemoteDispatchBoundary(context, 'before');
  let result;
  let requestError;
  try {
    result = await callback();
  } catch (error) {
    requestError = error;
  }
  assertRemoteDispatchBoundary(context, 'after');
  if (requestError) {
    throw requestError;
  }
  return result;
}

function rethrowRemoteDispatchBoundaryFailure(error) {
  if (error && error.code === 'SCHEMA_APPLY_LOCK_LOST') {
    throw error;
  }
}

module.exports = Object.freeze({
  dispatchRemotePrimitive,
  hasRemoteDispatchBoundary,
  rethrowRemoteDispatchBoundaryFailure,
});
