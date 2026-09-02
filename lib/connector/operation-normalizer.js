'use strict';

const { generateOutputs } = require('./response-parser');

function slugifyOperationId(value, fallback) {
  const slug = String(value || '')
    .trim()
    .replace(/^\//, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slug || fallback;
}

function deriveOperationId(operation, index) {
  const explicitId = String(operation.operationId || '').trim();
  if (explicitId) {
    return explicitId;
  }

  const fallback = `operation_${index + 1}`;
  const candidates = [operation.url, operation.path, operation.id, operation.name, operation.summary];
  for (const candidate of candidates) {
    const operationId = slugifyOperationId(candidate, '');
    if (operationId) {
      return operationId;
    }
  }

  return fallback;
}

function normalizeUrl(value) {
  return String(value || '').trim().replace(/^\/+/, '');
}

function inferParamLocation(input) {
  if (input.paramLocation) {
    return input.paramLocation;
  }

  const name = String(input.name || '').toLowerCase();
  if (name === 'headers' || name === 'header') {
    return 'header';
  }
  if (name === 'query' || name === 'queries') {
    return 'query';
  }
  if (name === 'path' || name === 'paths') {
    return 'path';
  }
  if (name === 'body') {
    return 'body';
  }

  return null;
}

function normalizeParamNode(node, paramLocation) {
  if (!node || typeof node !== 'object') {
    return node;
  }

  const normalized = { ...node };
  if (paramLocation && !normalized.paramLocation) {
    normalized.paramLocation = paramLocation;
  }
  if (!Array.isArray(normalized.children)) {
    normalized.children = [];
  }
  if (!Array.isArray(normalized.childList)) {
    normalized.childList = [];
  }
  normalized.children = normalized.children.map(child => normalizeParamNode(child, paramLocation));
  normalized.childList = normalized.childList.map(child => normalizeParamNode(child, paramLocation));
  return normalized;
}

function normalizeInput(input) {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const paramLocation = inferParamLocation(input);
  const normalized = { ...input };
  if (paramLocation && !normalized.paramLocation) {
    normalized.paramLocation = paramLocation;
  }
  if (!Array.isArray(normalized.childList)) {
    normalized.childList = [];
  }
  normalized.childList = normalized.childList.map(child => normalizeParamNode(child, paramLocation));
  return normalized;
}

function buildParametersFromInputs(inputs) {
  const parameters = { header: [] };

  for (const input of inputs) {
    if (!input || typeof input !== 'object') {
      continue;
    }

    const location = inferParamLocation(input);
    const childList = Array.isArray(input.childList) ? input.childList : [];

    if (location === 'header') {
      parameters.header = childList.map(child => ({
        name: child.name,
        value: child.defaultValue || '',
      }));
    } else if (location === 'query') {
      parameters.query = childList.map(child => ({
        name: child.name,
        value: child.defaultValue || '',
      }));
    } else if (location === 'body' && input.defaultValue !== undefined) {
      parameters.body = { default: input.defaultValue };
    }
  }

  return parameters;
}

function normalizeParameters(parameters, inputs) {
  const normalized = parameters && typeof parameters === 'object' && !Array.isArray(parameters)
    ? { ...parameters }
    : buildParametersFromInputs(inputs);

  if (!Array.isArray(normalized.header)) {
    normalized.header = [];
  }

  return normalized;
}

function normalizeOutput(output) {
  if (!output || typeof output !== 'object') {
    return output;
  }

  const normalized = { ...output };
  if (!Array.isArray(normalized.childList)) {
    normalized.childList = [];
  }
  return normalized;
}

function normalizeOperation(operation, index) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
    throw new Error(`第 ${index + 1} 个执行动作必须是对象`);
  }

  const operationId = deriveOperationId(operation, index);
  const rawUrl = operation.url !== undefined && operation.url !== null ? operation.url : operation.path;
  const hasUrl = rawUrl !== undefined && rawUrl !== null && String(rawUrl).trim() !== '';
  const url = normalizeUrl(rawUrl);

  if (!hasUrl) {
    throw new Error(`第 ${index + 1} 个执行动作缺少 url/path`);
  }

  const summary = operation.summary || operation.name || operationId;
  const description = operation.description || operation.desc || summary;
  const method = String(operation.method || 'get').toLowerCase();
  const inputs = Array.isArray(operation.inputs)
    ? operation.inputs.map(normalizeInput)
    : [];
  const responses = operation.responses || { type: 'object', properties: {} };
  const outputs = Array.isArray(operation.outputs) && operation.outputs.length > 0
    ? operation.outputs.map(normalizeOutput)
    : [generateOutputs(responses, operationId)];

  return {
    ...operation,
    id: operation.id || `operation-${operationId}`,
    operationId,
    summary,
    description,
    url,
    method,
    inputs,
    parameters: normalizeParameters(operation.parameters, inputs),
    responses,
    outputs,
    origin: operation.origin !== undefined ? operation.origin : true,
  };
}

function normalizeOperations(operations) {
  const list = Array.isArray(operations) ? operations : [operations];
  const normalized = list.map(normalizeOperation);
  const seen = new Set();
  for (const operation of normalized) {
    if (seen.has(operation.operationId)) {
      const error = new Error(`执行动作 operationId 重复: ${operation.operationId}`);
      error.code = 'CONNECTOR_OPERATION_ID_DUPLICATE';
      throw error;
    }
    seen.add(operation.operationId);
  }
  return normalized;
}

module.exports = {
  deriveOperationId,
  normalizeOperation,
  normalizeOperations,
  slugifyOperationId,
};
