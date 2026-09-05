'use strict';

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { listAllLogicflows } = require('./integration-check');
const { getLogicflowDetail } = require('./integration-api');
const { isDeepStrictEqual } = require('util');

function parseJsonObject(value) {
  if (typeof value === 'string') {
    if (!value.trim()) { return null; }
    try {
      return parseJsonObject(JSON.parse(value));
    } catch (_error) {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value;
}

function extractDetailEnvelope(response) {
  const wrapper = parseJsonObject(response);
  if (!wrapper) { return null; }
  const hasContent = Object.prototype.hasOwnProperty.call(wrapper, 'content');
  const hasSuccess = Object.prototype.hasOwnProperty.call(wrapper, 'success');
  if (hasSuccess && wrapper.success !== true) { return null; }
  if (hasSuccess && !hasContent) { return null; }
  const detail = hasContent ? parseJsonObject(wrapper.content) : wrapper;
  if (!detail || Object.keys(detail).length === 0) {
    return null;
  }
  return {
    detail,
    provenance: hasSuccess ? 'SUCCESS_CONTENT_WRAPPER' : (hasContent ? 'CONTENT_WRAPPER' : 'RAW_DETAIL_OBJECT'),
  };
}

function extractNonEmptyDetail(response) {
  const envelope = extractDetailEnvelope(response);
  return envelope && envelope.detail;
}

function projectDetailIdentity(response, detail) {
  const wrapper = parseJsonObject(response) || {};
  const projections = [
    { source: 'response', value: wrapper },
    { source: 'response.content', value: detail },
  ];
  const result = [];
  for (const projection of projections) {
    for (const field of ['processCode', 'formUuid']) {
      if (Object.prototype.hasOwnProperty.call(projection.value, field)) {
        result.push({ source: projection.source, field, value: projection.value[field] });
      }
    }
  }
  return result;
}

function readbackError(code, message, details) {
  return new CliError(message, { code, details });
}

function projectAddDataAssignments(root) {
  const projected = [];
  const seen = new Set();
  function visit(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) { return; }
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value.componentName === 'AddDataNode') {
      const rules = value.props && value.props.addDataRules;
      const assignments = rules && Array.isArray(rules.assignments)
        ? rules.assignments
        : [];
      projected.push({
        nodeId: value.id || '',
        assignments: assignments.map((item) => ({
          column: item.column || item.name || '',
          valueType: item.valueType || '',
          value: item.value,
        })),
      });
    }
    Object.values(value).forEach(visit);
  }
  visit(root);
  return projected.sort((left, right) => String(left.nodeId).localeCompare(String(right.nodeId)));
}

function projectSystemTokenBindings(root) {
  const projected = [];
  const seen = new Set();
  function collectBindings(rule, bindings) {
    if (!rule || typeof rule !== 'object') { return; }
    if (String(rule.name || '').toLowerCase() === 'systemtoken') {
      const appliedRules = Array.isArray(rule.rules) ? rule.rules : [];
      bindings.push({
        target: 'body.systemToken',
        bound: appliedRules.some(item => (
          item && item.value !== undefined && item.value !== null && String(item.value) !== ''
        )),
      });
    }
    (Array.isArray(rule.childList) ? rule.childList : [])
      .forEach(child => collectBindings(child, bindings));
  }
  function visit(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) { return; }
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value.componentName === 'ConnectorNode') {
      const connectorRules = value.props && value.props.connectorRules;
      const bindings = [];
      (connectorRules && Array.isArray(connectorRules.rules) ? connectorRules.rules : [])
        .forEach(rule => collectBindings(rule, bindings));
      if (bindings.length > 0) {
        projected.push({
          nodeId: value.id || '',
          connectorId: connectorRules.connectorId || '',
          actionId: connectorRules.actionId || '',
          bindings,
        });
      }
    }
    Object.values(value).forEach(visit);
  }
  visit(root);
  return projected.sort((left, right) => String(left.nodeId).localeCompare(String(right.nodeId)));
}

async function verifyLogicflowFinalState(authRef, input, dependencies = {}) {
  const listAll = dependencies.listAllLogicflows || listAllLogicflows;
  const getDetail = dependencies.getLogicflowDetail || getLogicflowDetail;
  const flows = await listAll(authRef, input.appType, {
    pageSize: 50,
    formUuid: input.formUuid,
  });
  const matches = flows.filter((flow) => (
    flow
      && flow.processCode === input.processCode
      && flow.formUuid === input.formUuid
  ));
  if (matches.length !== 1) {
    throw readbackError(
      'INTEGRATION_READBACK_EXACT_MATCH_FAILED',
      t('integration.readback_exact_match_failed', input.processCode),
      { processCode: input.processCode, formUuid: input.formUuid, exactMatchCount: matches.length }
    );
  }

  const flow = matches[0];
  if (input.expectedStatus && flow.status !== input.expectedStatus) {
    throw readbackError(
      'INTEGRATION_READBACK_STATUS_MISMATCH',
      t('integration.readback_status_mismatch', input.expectedStatus, flow.status || '<empty>'),
      {
        processCode: input.processCode,
        formUuid: input.formUuid,
        expectedStatus: input.expectedStatus,
        actualStatus: flow.status || '',
      }
    );
  }

  let response;
  try {
    response = await getDetail(authRef, {
      appType: input.appType,
      formUuid: input.formUuid,
      processCode: input.processCode,
    });
  } catch (error) {
    throw readbackError(
      'INTEGRATION_READBACK_DETAIL_UNVERIFIED',
      t('integration.readback_detail_failed', error.message),
      { processCode: input.processCode, formUuid: input.formUuid }
    );
  }
  const detailEnvelope = extractDetailEnvelope(response);
  if (!detailEnvelope) {
    throw readbackError(
      'INTEGRATION_READBACK_DETAIL_UNVERIFIED',
      t('integration.readback_detail_empty', input.processCode),
      { processCode: input.processCode, formUuid: input.formUuid }
    );
  }
  const { detail } = detailEnvelope;

  const identityProjection = projectDetailIdentity(response, detail);
  for (const identity of identityProjection) {
    const expected = input[identity.field];
    if (String(identity.value) !== String(expected)) {
      throw readbackError(
        'INTEGRATION_READBACK_DETAIL_IDENTITY_MISMATCH',
        t('integration.readback_detail_identity_mismatch', identity.field),
        {
          processCode: input.processCode,
          formUuid: input.formUuid,
          source: identity.source,
          field: identity.field,
          expected,
          actual: identity.value,
        }
      );
    }
  }

  let addDataAssignmentProjection = 'NOT_REQUESTED';
  if (Array.isArray(input.expectedAddDataAssignments) && input.expectedAddDataAssignments.length > 0) {
    const actualAddDataAssignments = projectAddDataAssignments(detail);
    if (!isDeepStrictEqual(actualAddDataAssignments, input.expectedAddDataAssignments)) {
      throw readbackError(
        'INTEGRATION_READBACK_ASSIGNMENTS_MISMATCH',
        t('integration.readback_assignments_mismatch'),
        {
          processCode: input.processCode,
          formUuid: input.formUuid,
          expectedNodeCount: input.expectedAddDataAssignments.length,
          actualNodeCount: actualAddDataAssignments.length,
        }
      );
    }
    addDataAssignmentProjection = 'EXACT';
  }

  let systemTokenBindingProjection = 'NOT_REQUESTED';
  if (Array.isArray(input.expectedSystemTokenBindings) && input.expectedSystemTokenBindings.length > 0) {
    const actualBindings = projectSystemTokenBindings(detail);
    if (!isDeepStrictEqual(actualBindings, input.expectedSystemTokenBindings)) {
      throw readbackError(
        'INTEGRATION_READBACK_SYSTEM_TOKEN_BINDING_MISMATCH',
        '集成自动化远端回读未确认 systemToken 服务端绑定。',
        {
          processCode: input.processCode,
          formUuid: input.formUuid,
          expectedNodeCount: input.expectedSystemTokenBindings.length,
          actualNodeCount: actualBindings.length,
        }
      );
    }
    systemTokenBindingProjection = 'EXACT';
  }

  return {
    verificationLevel: 'PLATFORM_LIST_EXACT_DETAIL_PRESENT',
    processCode: input.processCode,
    formUuid: input.formUuid,
    status: flow.status,
    exactMatchCount: 1,
    detailReadback: true,
    detailProvenance: detailEnvelope.provenance,
    detailIdentityProjection: identityProjection.length > 0 ? 'MATCHED_IF_PRESENT' : 'NOT_PRESENT',
    addDataAssignmentProjection,
    systemTokenBindingProjection,
    detailKeys: Object.keys(detail).sort(),
  };
}

module.exports = {
  extractNonEmptyDetail,
  extractDetailEnvelope,
  projectDetailIdentity,
  projectAddDataAssignments,
  projectSystemTokenBindings,
  verifyLogicflowFinalState,
};
