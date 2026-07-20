'use strict';

const { schemaError } = require('./errors');
const { sortStrings } = require('./sort');

const OPTIONAL_ADAPTER_METHODS = Object.freeze([
  'buildBindings',
  'classifyObservedConflict',
  'classifyUpdate',
  'create',
  'preflightApply',
  'prepareComparison',
  'prepareOperation',
  'projectObserved',
  'projectOperationResult',
  'readObserved',
  'reconcileStaged',
  'resumeCreate',
  'advanceStagedCheckpoint',
  'isStagedCheckpointRemoteComplete',
  'update',
  'validateStageCheckpoint',
  'validateStateResource',
  'verify',
]);
const STAGED_ADAPTER_METHODS = Object.freeze([
  'advanceStagedCheckpoint',
  'isStagedCheckpointRemoteComplete',
  'reconcileStaged',
  'validateStageCheckpoint',
]);
const REQUIRED_ADAPTER_METHODS = Object.freeze(['normalize', 'validate']);
const ADAPTER_METADATA = Object.freeze(['adapterVersion', 'resourceType']);
const ADAPTER_CONTRACT_KEYS = new Set([
  ...ADAPTER_METADATA,
  ...REQUIRED_ADAPTER_METHODS,
  ...OPTIONAL_ADAPTER_METHODS,
]);

class ResourceRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter) {
    const contract = createAdapterContract(adapter);
    const stagedMethodCount = STAGED_ADAPTER_METHODS.filter(method => typeof contract[method] === 'function').length;
    if (stagedMethodCount > 0 && contract.resourceType !== 'process') {
      throw new Error('Resource adapter staged methods are reserved for process: ' + contract.resourceType);
    }
    if (stagedMethodCount > 0 && stagedMethodCount !== STAGED_ADAPTER_METHODS.length) {
      throw new Error('Process staged adapter must implement the complete staged method contract: ' + contract.resourceType);
    }
    if (this.adapters.has(contract.resourceType)) {
      throw new Error('Duplicate resource adapter: ' + contract.resourceType);
    }
    this.adapters.set(contract.resourceType, contract);
    return this;
  }

  get(resourceType) {
    const adapter = this.adapters.get(resourceType);
    if (!adapter) {
      throw schemaError('SCHEMA_RESOURCE_TYPE_UNSUPPORTED', 'Resource type is not supported by this validator.', {
        details: { resourceType },
      });
    }
    return adapter;
  }

  listTypes() {
    return sortStrings(this.adapters.keys());
  }
}

function createAdapterContract(adapter) {
  if (!adapter || typeof adapter !== 'object' || Array.isArray(adapter)) {
    throw new Error('Resource adapter must be a plain contract object');
  }
  const prototype = Object.getPrototypeOf(adapter);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('Resource adapter must not inherit contract properties');
  }
  const descriptors = Object.getOwnPropertyDescriptors(adapter);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || key === 'capabilities' || !ADAPTER_CONTRACT_KEYS.has(key)) {
      throw new Error('Resource adapter declares an unknown contract property: ' + String(key));
    }
    const descriptor = descriptors[key];
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      throw new Error('Resource adapter contract properties must be data properties: ' + key);
    }
  }

  const resourceType = valueFromDescriptor(descriptors, 'resourceType');
  const adapterVersion = valueFromDescriptor(descriptors, 'adapterVersion');
  if (typeof resourceType !== 'string' || !resourceType) {
    throw new Error('Resource adapter must declare resourceType');
  }
  if (!Number.isInteger(adapterVersion) || adapterVersion < 1) {
    throw new Error('Resource adapter must declare a positive integer adapterVersion: ' + resourceType);
  }
  for (const method of REQUIRED_ADAPTER_METHODS) {
    if (typeof valueFromDescriptor(descriptors, method) !== 'function') {
      throw new Error('Resource adapter must implement normalize and validate: ' + resourceType);
    }
  }
  for (const method of OPTIONAL_ADAPTER_METHODS) {
    if (descriptors[method] && typeof descriptors[method].value !== 'function') {
      throw new Error(`Resource adapter method must be a function ${method}: ` + resourceType);
    }
  }

  const contract = {};
  for (const key of ADAPTER_METADATA) {
    contract[key] = descriptors[key].value;
  }
  for (const method of [...REQUIRED_ADAPTER_METHODS, ...OPTIONAL_ADAPTER_METHODS]) {
    if (descriptors[method]) {
      contract[method] = descriptors[method].value;
    }
  }
  return Object.freeze(contract);
}

function valueFromDescriptor(descriptors, property) {
  const descriptor = descriptors[property];
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

function isStagedAdapter(adapter) {
  return !!(
    adapter &&
    adapter.resourceType === 'process' &&
    STAGED_ADAPTER_METHODS.every(method => typeof adapter[method] === 'function')
  );
}

function createDefaultRegistry() {
  const { appAdapter } = require('./adapters/app-adapter');
  const { formAdapter } = require('./adapters/form-adapter');
  const { pageAdapter } = require('./adapters/page-adapter');
  const { processAdapter } = require('./adapters/process-adapter');
  return new ResourceRegistry()
    .register(appAdapter)
    .register(formAdapter)
    .register(pageAdapter)
    .register(processAdapter);
}

module.exports = {
  ResourceRegistry,
  createDefaultRegistry,
  isStagedAdapter,
};
