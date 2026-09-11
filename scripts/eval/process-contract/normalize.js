'use strict';

const crypto = require('crypto');

const DESIGN_NOISE_KEYS = new Set([
  'x',
  'y',
  'left',
  'top',
  'width',
  'height',
  'offsetX',
  'offsetY',
  'position',
  'createdAt',
  'updatedAt',
  'modifiedAt',
  'revision',
  'version',
  'designerVersion',
  'componentVersion',
]);

const NODE_REFERENCE_KEYS = new Set([
  'nodeId',
  'prevId',
  'nextId',
  'targetNodeId',
  'jumpToNodeId',
  'sourceNodeId',
]);

const VIEW_TO_PROCESS_TYPE = {
  ApplyNode: 'apply',
  EndNode: 'finish',
  ApprovalNode: 'approval',
  MultiApprovalNode: 'approval',
  OperatorNode: 'approval',
  CarbonNode: 'carbon',
  ConditionContainer: 'route',
  ConditionNode: 'condition',
  ParallelNode: 'condition',
};

const OPERATOR_ALIASES = {
  '==': 'Equal',
  '=': 'Equal',
  '等于': 'Equal',
  Equal: 'Equal',
  '>': 'GreaterThan',
  '大于': 'GreaterThan',
  Bigger: 'GreaterThan',
  GreaterThan: 'GreaterThan',
  '>=': 'GreaterThanOrEqual',
  '大于等于': 'GreaterThanOrEqual',
  GreaterThanOrEqual: 'GreaterThanOrEqual',
  '<': 'LessThan',
  '小于': 'LessThan',
  LessThan: 'LessThan',
  '<=': 'LessThanOrEqual',
  '小于等于': 'LessThanOrEqual',
  LessThanOrEqual: 'LessThanOrEqual',
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function localizedName(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (!isPlainObject(value)) {
    return '';
  }
  return String(value.zh_CN || value.en_US || value.ja_JP || value.name || '');
}

function getProcessNodeName(node) {
  return localizedName(node && (node.name || (node.props && (node.props.name || node.props.nodeName))));
}

function getViewNodeName(node) {
  return localizedName(node && node.props && (node.props.name || node.props.nodeName));
}

function semanticSlug(value) {
  const normalized = String(value || 'unnamed')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'unnamed';
}

function collectProcessNodes(nodes, output) {
  (nodes || []).forEach(function (node) {
    output.push(node);
    collectProcessNodes(node.childNodes, output);
  });
}

function collectViewNodes(nodes, output) {
  (nodes || []).forEach(function (node) {
    output.push(node);
    collectViewNodes(node.children, output);
  });
}

function buildNodeIdMap(artifact) {
  const processNodes = [];
  const viewNodes = [];
  collectProcessNodes(artifact.processJson && artifact.processJson.nodes, processNodes);
  collectViewNodes(artifact.viewJson && artifact.viewJson.schema && artifact.viewJson.schema.children, viewNodes);

  const idMap = new Map();
  const identityQueues = new Map();
  const identityCounts = new Map();

  processNodes.forEach(function (node) {
    const type = String(node.type || 'unknown');
    const name = getProcessNodeName(node);
    const identity = type + ':' + semanticSlug(name);
    const count = (identityCounts.get(identity) || 0) + 1;
    identityCounts.set(identity, count);
    const canonicalId = 'node:' + identity + ':' + count;
    if (node.nodeId !== undefined && node.nodeId !== null && node.nodeId !== '') {
      idMap.set(String(node.nodeId), canonicalId);
    }
    if (!identityQueues.has(identity)) {
      identityQueues.set(identity, []);
    }
    identityQueues.get(identity).push(canonicalId);
  });

  const viewIdentityIndex = new Map();
  viewNodes.forEach(function (node) {
    const rawId = node.id === undefined || node.id === null ? '' : String(node.id);
    if (rawId && idMap.has(rawId)) {
      return;
    }
    const type = VIEW_TO_PROCESS_TYPE[node.componentName] || String(node.componentName || 'unknown');
    const identity = type + ':' + semanticSlug(getViewNodeName(node));
    const index = viewIdentityIndex.get(identity) || 0;
    viewIdentityIndex.set(identity, index + 1);
    const candidates = identityQueues.get(identity) || [];
    const canonicalId = candidates[index]
      || ('node:' + identity + ':' + (index + 1));
    if (rawId) {
      idMap.set(rawId, canonicalId);
    }
  });

  return idMap;
}

function stableSort(value) {
  if (Array.isArray(value)) {
    return value.map(stableSort);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const result = {};
  Object.keys(value).sort().forEach(function (key) {
    result[key] = stableSort(value[key]);
  });
  return result;
}

function normalizeNodeReference(value, idMap) {
  if (Array.isArray(value)) {
    return value.map(function (item) { return normalizeNodeReference(item, idMap); });
  }
  if (typeof value !== 'string' || value === '') {
    return value;
  }
  return idMap.get(value) || value;
}

function normalizeOperator(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const key = String(value);
  return OPERATOR_ALIASES[key] || key;
}

function parseJsonValue(value, label) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (parseError) {
    throw new TypeError(label + ' must be valid JSON: ' + parseError.message);
  }
}

function readbackTypeError(code, message) {
  const readbackError = new TypeError(message);
  readbackError.code = code;
  return readbackError;
}

function extractReadbackArtifact(rawProcessPayload) {
  let payload = parseJsonValue(rawProcessPayload, 'rawProcessPayload');
  if (!isPlainObject(payload)) {
    throw new TypeError('rawProcessPayload must resolve to an object');
  }
  if (isPlainObject(payload.data)) {
    payload = payload.data;
  }
  if (payload.content !== undefined) {
    payload = parseJsonValue(payload.content, 'rawProcessPayload.content');
  }
  if (!isPlainObject(payload)) {
    throw new TypeError('getProcessById content must resolve to an object');
  }

  if (isPlainObject(payload.schema)
    && payload.processJson === undefined
    && payload.json === undefined
    && payload.viewJson === undefined) {
    throw readbackTypeError(
      'PROCESS_READBACK_PROCESS_JSON_MISSING',
      'designer readback contains viewJson only; independent processJson is required for semantic verification'
    );
  }

  const processJson = parseJsonValue(
    payload.processJson !== undefined ? payload.processJson : payload.json,
    'processJson'
  );
  const viewJson = parseJsonValue(payload.viewJson, 'viewJson');
  if (!isPlainObject(processJson) || !isPlainObject(viewJson)) {
    throw new TypeError('readback payload must contain processJson/json and viewJson objects');
  }
  return { processJson: processJson, viewJson: viewJson };
}

function extractViewReadback(rawPlatformPayload) {
  let payload = parseJsonValue(rawPlatformPayload, 'rawPlatformPayload');
  if (!isPlainObject(payload)) {
    throw new TypeError('rawPlatformPayload must resolve to an object');
  }
  if (isPlainObject(payload.data)) {
    payload = payload.data;
  }
  if (payload.content !== undefined) {
    payload = parseJsonValue(payload.content, 'rawPlatformPayload.content');
  }
  if (!isPlainObject(payload)) {
    throw new TypeError('platform readback content must resolve to an object');
  }
  if (payload.processJson !== undefined || payload.json !== undefined || payload.viewJson !== undefined) {
    throw readbackTypeError(
      'PROCESS_VIEW_READBACK_COMBINED_PAYLOAD_REJECTED',
      'view readback entry point accepts the platform view schema payload only'
    );
  }
  if (!isPlainObject(payload.schema) || payload.schema.componentName !== 'CanvasEngine') {
    throw readbackTypeError(
      'PROCESS_VIEW_READBACK_SCHEMA_MISSING',
      'platform view readback must contain a CanvasEngine schema'
    );
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'bindingForm')
    || !Array.isArray(payload.formulaRules)
    || !isPlainObject(payload.globalSetting)) {
    throw readbackTypeError(
      'PROCESS_VIEW_READBACK_SHAPE_INVALID',
      'platform view readback must contain bindingForm, formulaRules, globalSetting, and schema'
    );
  }
  return payload;
}

function normalizeValue(source, idMap) {
  const ruleIdMap = new Map();
  let ruleIdCounter = 0;
  let canvasIdCounter = 0;

  function visit(value) {
    if (Array.isArray(value)) {
      return value.map(function (item) { return visit(item); });
    }
    if (!isPlainObject(value)) {
      return value;
    }

    const output = {};
    Object.keys(value).forEach(function (key) {
      if (DESIGN_NOISE_KEYS.has(key)) {
        return;
      }
      const current = value[key];
      if (key === 'ruleId' && typeof current === 'string') {
        if (!ruleIdMap.has(current)) {
          ruleIdCounter += 1;
          ruleIdMap.set(current, 'rule:' + ruleIdCounter);
        }
        output[key] = ruleIdMap.get(current);
        return;
      }
      if (key === 'flowConfig' && isPlainObject(current)) {
        const normalizedFlowConfig = {};
        Object.keys(current).forEach(function (nodeId) {
          const canonicalNodeId = idMap.get(nodeId) || nodeId;
          normalizedFlowConfig[canonicalNodeId] = visit(current[nodeId]);
        });
        output[key] = normalizedFlowConfig;
        return;
      }
      if (NODE_REFERENCE_KEYS.has(key)) {
        output[key] = normalizeNodeReference(current, idMap);
        return;
      }
      if (key === 'id' && value.componentName) {
        if (value.componentName === 'CanvasEngine') {
          canvasIdCounter += 1;
          output[key] = 'canvas:' + canvasIdCounter;
        } else {
          output[key] = normalizeNodeReference(current, idMap);
        }
        return;
      }
      output[key] = visit(current);
    });

    const rawOperator = value.opCode !== undefined
      ? value.opCode
      : (value.operator !== undefined ? value.operator : value.op);
    if (rawOperator !== undefined) {
      output.operator = normalizeOperator(rawOperator);
      if (output.fieldId === undefined && value.id !== undefined) {
        output.fieldId = value.id;
        delete output.id;
      }
      if (output.value === undefined && value.ruleValue !== undefined) {
        output.value = visit(value.ruleValue);
      }
      delete output.opCode;
      delete output.op;
      delete output.ruleValue;
    }
    return output;
  }

  return stableSort(visit(source));
}

function normalizeArtifact(artifact) {
  if (!isPlainObject(artifact) || !isPlainObject(artifact.processJson) || !isPlainObject(artifact.viewJson)) {
    throw new TypeError('artifact must contain processJson and viewJson objects');
  }

  const source = clone(artifact);
  return normalizeValue(source, buildNodeIdMap(source));
}

function normalizeReadback(rawProcessPayload) {
  return normalizeArtifact(extractReadbackArtifact(rawProcessPayload));
}

function normalizeViewReadback(rawPlatformPayload) {
  const viewJson = clone(extractViewReadback(rawPlatformPayload));
  return normalizeValue(viewJson, buildNodeIdMap({ viewJson: viewJson }));
}

function canonicalStringify(value) {
  return JSON.stringify(stableSort(value));
}

function sha256Canonical(value) {
  return crypto.createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

module.exports = {
  DESIGN_NOISE_KEYS,
  OPERATOR_ALIASES,
  VIEW_TO_PROCESS_TYPE,
  extractReadbackArtifact,
  extractViewReadback,
  localizedName,
  normalizeArtifact,
  normalizeOperator,
  normalizeReadback,
  normalizeViewReadback,
  canonicalStringify,
  sha256Canonical,
  stableSort,
};
