'use strict';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const APP_TYPE = /^APP_[A-Za-z0-9_-]{1,200}$/;
const { classifyManagedMutation } = require('./managed-command-map');

function safeText(value, max = 256) {
  return typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : undefined;
}

function resourceId(...values) {
  return values.map((value) => safeText(value, 128)).find((value) => value && ID.test(value));
}

function safeOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {return null;}
  return value;
}

/**
 * Captures only successful JSON result metadata for a Runtime-managed command.
 * Console output is preserved byte-for-byte; ordinary OpenYida invocations are untouched.
 */
function beginManagedMutationCapture({ command, args, env = process.env, consoleObject = console, eventId } = {}) {
  const classification = classifyManagedMutation(command, args);
  const appType = env.OPENYIDA_AGENT_APP_TYPE;
  const active = env.OPENYIDA_MANAGED_RUN === '1' && classification && ID.test(eventId || '') && APP_TYPE.test(appType || '');
  if (!active) {return { commit: () => null, discard: () => undefined };}

  const original = consoleObject.log;
  let latest = null;
  let explicitFailure = false;
  let restored = false;
  consoleObject.log = function managedMutationConsoleLog(...values) {
    try {
      const text = values.length === 1 && typeof values[0] === 'string' ? values[0].trim() : '';
      if (text.startsWith('{') && text.endsWith('}') && text.length <= 64 * 1024) {
        const parsed = safeOutput(JSON.parse(text));
        if (parsed?.success === false) {explicitFailure = true;}
        if (parsed?.success === true) {latest = parsed;}
      }
    } catch { /* CLI output is not a protocol unless it is valid allowlisted JSON. */ }
    return original.apply(this, values);
  };
  const restore = () => {
    if (!restored) {consoleObject.log = original;}
    restored = true;
  };
  return {
    commit() {
      restore();
      if (explicitFailure || !latest) {return null;}
      const isReport = command === 'create-report';
      const formUuid = resourceId(latest?.formUuid, latest?.pageId,
        isReport ? latest?.reportId : undefined, classification.formUuid);
      const pageType = safeText(latest?.pageType, 64) || (isReport ? 'report' : undefined);
      const updatedFields = safeOutput(latest?.updatedFields);
      const appName = safeText(latest?.appName || updatedFields?.name);
      const appIcon = safeText(latest?.appIcon || updatedFields?.icon);
      const colour = safeText(latest?.colour || updatedFields?.colour, 64);
      const receipt = {
        schemaVersion: 'openyida.mutation.v1',
        eventId,
        source: 'openyida-cli',
        operation: classification.operation,
        status: 'succeeded',
        appType,
        ...(formUuid ? { formUuid } : {}),
        ...(pageType ? { pageType } : {}),
        ...(appName ? { appName } : {}),
        ...(appIcon ? { appIcon } : {}),
        ...(colour ? { colour } : {}),
        ...(safeText(latest?.formName || latest?.formTitle || latest?.pageName || (isReport && latest?.reportTitle)) ? { formName: safeText(latest?.formName || latest?.formTitle || latest?.pageName || (isReport && latest?.reportTitle)) } : {}),
        ...(safeText(latest?.schemaHash, 128) ? { schemaHash: safeText(latest.schemaHash, 128) } : {}),
      };
      return receipt;
    },
    discard: restore,
  };
}

module.exports = { beginManagedMutationCapture, classifyManagedMutation };
