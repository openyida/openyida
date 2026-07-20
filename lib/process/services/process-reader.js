'use strict';

const { getProcessById } = require('./process-service');
const {
  dispatchRemotePrimitive,
  hasRemoteDispatchBoundary,
  rethrowRemoteDispatchBoundaryFailure,
} = require('../../schema/remote-dispatch-boundary');

const READ_OPERATION = 'SimpleProcess.getProcessById';

class ProcessReaderError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ProcessReaderError';
    this.code = code;
    this.details = details;
  }
}

function readerError(code, message, details) {
  return new ProcessReaderError(code, message, details);
}

function readFailure() {
  return readerError('PROCESS_READ_FAILED', 'Process definition could not be read.', {
    operation: READ_OPERATION,
  });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isNonEmptyIdentifier(value) {
  return isNonEmptyString(value) || (typeof value === 'number' && Number.isFinite(value));
}

function isValidProcessVersion(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0;
  }
  return typeof value === 'string' && /^\d+$/.test(value.trim());
}

function assertReadBindings(bindings) {
  const checks = {
    appType: isNonEmptyString,
    formUuid: isNonEmptyString,
    processCode: isNonEmptyString,
    processId: isNonEmptyIdentifier,
    processVersion: isValidProcessVersion,
  };
  for (const [property, isValid] of Object.entries(checks)) {
    if (!isValid(bindings && bindings[property])) {
      throw readerError(
        'PROCESS_READ_BINDING_INVALID',
        'A required process read binding is missing or invalid.',
        { operation: READ_OPERATION, property }
      );
    }
  }
}

async function readProcessDefinition(context, bindings) {
  assertReadBindings(bindings);
  const authRef = context && context.authRef ? context.authRef : context;
  let result;
  try {
    result = await dispatchRemotePrimitive(context, () => getProcessById(
      authRef,
      bindings || {},
      { oneShot: hasRemoteDispatchBoundary(context) }
    ));
  } catch (error) {
    rethrowRemoteDispatchBoundaryFailure(error);
    throw readFailure();
  }

  if (!result || result.success !== true) {
    throw readFailure();
  }
  if (typeof result.content !== 'string' || result.content.trim() === '') {
    throw readerError(
      'PROCESS_READ_CONTENT_INVALID',
      'Process definition content is invalid.',
      { operation: READ_OPERATION }
    );
  }

  let definition;
  try {
    definition = JSON.parse(result.content);
  } catch {
    throw readerError(
      'PROCESS_READ_CONTENT_INVALID',
      'Process definition content is invalid.',
      { operation: READ_OPERATION }
    );
  }
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw readerError(
      'PROCESS_READ_CONTENT_INVALID',
      'Process definition content is invalid.',
      { operation: READ_OPERATION }
    );
  }

  return { definition };
}

function getBoundNodeId(binding) {
  if (typeof binding === 'string' && binding) {
    return binding;
  }
  if (binding && typeof binding.nodeId === 'string' && binding.nodeId) {
    return binding.nodeId;
  }
  return null;
}

function extractManagedName(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    if (typeof value.zh_CN === 'string') {return value.zh_CN;}
    if (typeof value.en_US === 'string') {return value.en_US;}
    if (typeof value.ja_JP === 'string') {return value.ja_JP;}
  }
  return '';
}

function projectNodeType(componentName) {
  if (componentName === 'ApprovalNode') {return 'approval';}
  if (componentName === 'OperatorNode') {return 'operator';}
  if (componentName === 'MultiApprovalNode') {return 'multiApproval';}
  if (componentName === 'CarbonNode') {return 'carbon';}
  return 'unsupported';
}

function projectApprover(node) {
  const ruleType = node && node.props && node.props.approverRules && node.props.approverRules.type;
  return ruleType === 'ext_target_approval_originator'
    ? 'originator'
    : (typeof ruleType === 'string' && ruleType ? ruleType : 'unsupported');
}

function observedStructureError(semanticPath) {
  return readerError(
    'PROCESS_OBSERVED_STRUCTURE_MISMATCH',
    'Observed process structure does not match managed node bindings.',
    { semanticPath }
  );
}

function projectProcessManaged(readResult, options) {
  const definition = readResult && readResult.definition;
  const desired = options && options.desired;
  const nodeBindings = options && options.nodeBindings || {};
  const expectedFormUuid = options && options.formUuid;
  const schema = definition && definition.schema;
  const children = schema && Array.isArray(schema.children) ? schema.children : null;

  if (!desired || !Array.isArray(desired.nodes) || !children) {
    throw observedStructureError('process');
  }
  if (!isNonEmptyString(expectedFormUuid) || definition.bindingForm !== expectedFormUuid) {
    throw observedStructureError('form');
  }

  const keyByNodeId = new Map();
  desired.nodes.forEach(function (node) {
    const nodeId = getBoundNodeId(nodeBindings[node.key]);
    if (!nodeId) {
      throw readerError(
        'PROCESS_NODE_BINDING_MISSING',
        'A managed process node binding is missing.',
        { semanticPath: 'nodes.' + node.key }
      );
    }
    if (keyByNodeId.has(nodeId)) {
      throw observedStructureError('nodes.' + node.key);
    }
    keyByNodeId.set(nodeId, node.key);
  });

  const desiredByKey = new Map(desired.nodes.map(function (node) {
    return [node.key, node];
  }));
  const managedNodes = [];

  children.forEach(function (node) {
    if (!node || node.componentName === 'ApplyNode' || node.componentName === 'EndNode') {
      return;
    }
    const semanticKey = keyByNodeId.get(node.id);
    if (!semanticKey) {
      throw observedStructureError('nodes');
    }
    const expected = desiredByKey.get(semanticKey);
    managedNodes.push({
      key: semanticKey,
      type: projectNodeType(node.componentName),
      name: extractManagedName(node.props && node.props.name),
      approver: projectApprover(node),
      _expected: expected,
    });
  });

  if (managedNodes.length !== desired.nodes.length) {
    throw observedStructureError('nodes');
  }
  managedNodes.forEach(function (node, index) {
    if (!node._expected || node.key !== desired.nodes[index].key) {
      throw observedStructureError('nodes.' + node.key);
    }
    delete node._expected;
  });

  return {
    form: desired.form,
    nodes: managedNodes,
  };
}

module.exports = {
  ProcessReaderError,
  READ_OPERATION,
  projectProcessManaged,
  readProcessDefinition,
};
