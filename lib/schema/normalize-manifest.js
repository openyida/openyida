'use strict';

const crypto = require('crypto');
const Ajv = require('ajv');
const manifestSchemaV1 = require('./manifest-schema-v1.json');
const { schemaError } = require('./errors');
const { assertManifestObjectLimits } = require('./manifest-limits');
const { createDefaultRegistry } = require('./resource-registry');
const { countDependencies, validateDependencyGraph } = require('./dependency-graph');
const { compareCodePoints, sortStrings } = require('./sort');

const KNOWN_UNSUPPORTED_SECTIONS = Object.freeze({
  automations: 'automation',
  reports: 'report',
});

const FORBIDDEN_KEY_CANONICALS = new Set([
  'apikey',
  'apptype',
  'authorization',
  'clientsecret',
  'cookie',
  'cookies',
  'credential',
  'credentials',
  'constructor',
  'csrf',
  'csrftoken',
  'fieldid',
  'formuuid',
  'header',
  'headers',
  'internalpath',
  'internalurl',
  'nodeid',
  'password',
  'proto',
  'prototype',
  'processcode',
  'processid',
  'processversion',
  'refreshtoken',
  'secret',
  'token',
]);

let validateManifestV1;

function normalizeManifest(manifest, options = {}) {
  assertManifestObjectLimits(manifest, options);
  precheckUnsupportedSections(manifest);
  precheckForbiddenKeys(manifest);
  validateRawManifest(manifest);

  const registry = options.registry || createDefaultRegistry();
  const appAdapter = registry.get('app');
  const appEntry = {
    key: manifest.app.key,
    definition: manifest.app,
  };
  appAdapter.validate(appEntry);
  const appResource = appAdapter.normalize(appEntry);

  const context = {
    appKey: manifest.app.key,
    fsImpl: options.fsImpl,
    manifest,
    registry,
    workspaceRoot: options.workspaceRoot || process.cwd(),
  };
  const formAdapter = registry.get('form');
  const formResources = sortStrings(Object.keys(manifest.forms || {})).map(formKey => {
    const entry = {
      key: formKey,
      definition: manifest.forms[formKey],
    };
    formAdapter.validate(entry, context);
    return formAdapter.normalize(entry, context);
  });

  let processResources = [];
  if (Object.prototype.hasOwnProperty.call(manifest, 'processes')) {
    const processAdapter = registry.get('process');
    processResources = sortStrings(Object.keys(manifest.processes || {})).map(processKey => {
      const entry = {
        key: processKey,
        definition: manifest.processes[processKey],
      };
      processAdapter.validate(entry, context);
      return processAdapter.normalize(entry, context);
    });
  }

  let pageResources = [];
  if (Object.prototype.hasOwnProperty.call(manifest, 'pages')) {
    const pageAdapter = registry.get('page');
    pageResources = sortStrings(Object.keys(manifest.pages || {})).map(pageKey => {
      const entry = {
        key: pageKey,
        definition: manifest.pages[pageKey],
      };
      pageAdapter.validate(entry, context);
      return pageAdapter.normalize(entry, context);
    });
  }

  const resources = [appResource, ...formResources, ...processResources, ...pageResources]
    .sort(compareResources);
  validateDependencyGraph(resources);

  const publicResources = resources.map(toPublicResource);
  const hashInput = {
    contractVersion: 1,
    resources: publicResources,
  };
  const manifestHash = 'sha256:' + crypto
    .createHash('sha256')
    .update(stableStringify(hashInput))
    .digest('hex');

  return {
    manifestHash,
    normalized: {
      resources: publicResources,
    },
    counts: {
      resources: publicResources.length,
      dependencies: countDependencies(publicResources),
    },
  };
}

function precheckUnsupportedSections(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return;
  }
  for (const section of sortStrings(Object.keys(KNOWN_UNSUPPORTED_SECTIONS))) {
    if (Object.prototype.hasOwnProperty.call(manifest, section)) {
      throw schemaError('SCHEMA_RESOURCE_TYPE_UNSUPPORTED', 'Manifest resource type is not supported in SAC-02.', {
        path: `/${section}`,
        details: {
          section,
          resourceType: KNOWN_UNSUPPORTED_SECTIONS[section],
        },
      });
    }
  }
}

function precheckForbiddenKeys(value, pathSegments = []) {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => precheckForbiddenKeys(item, pathSegments.concat(String(index))));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY_CANONICALS.has(canonicalizeKey(key))) {
      throw schemaError('SCHEMA_FORBIDDEN_FIELD', 'Manifest must not contain environment IDs or sensitive configuration fields.', {
        path: formatJsonPointer(pathSegments.concat(key)),
        details: { key },
      });
    }
    precheckForbiddenKeys(child, pathSegments.concat(key));
  }
}

function validateRawManifest(manifest) {
  const validate = getValidator();
  if (validate(manifest)) {
    return;
  }

  const error = (validate.errors || [])[0];
  throw mapAjvError(error);
}

function getValidator() {
  if (!validateManifestV1) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    validateManifestV1 = ajv.compile(manifestSchemaV1);
  }
  return validateManifestV1;
}

function mapAjvError(error) {
  if (!error) {
    return schemaError('SCHEMA_MANIFEST_SCHEMA_INVALID', 'Manifest does not match Manifest v1 schema.');
  }

  const pointer = error.instancePath || '/';
  if (error.keyword === 'additionalProperties') {
    const property = error.params && error.params.additionalProperty;
    return schemaError('SCHEMA_UNKNOWN_PROPERTY', 'Manifest contains an unknown property.', {
      path: pointer === '/' ? `/${property}` : `${pointer}/${escapePointer(property)}`,
      details: { property },
    });
  }
  if (error.keyword === 'required' && error.params && error.params.missingProperty === 'fields' && /^\/forms\//.test(error.instancePath || '')) {
    return schemaError('SCHEMA_FORM_FIELDS_REQUIRED', 'Manifest forms must contain at least one field.', {
      path: `${error.instancePath}/fields`,
    });
  }
  if (error.keyword === 'minProperties' && /\/fields$/.test(error.instancePath || '')) {
    return schemaError('SCHEMA_FORM_FIELDS_REQUIRED', 'Manifest forms must contain at least one field.', {
      path: error.instancePath,
    });
  }
  if (error.instancePath === '/kind' && error.keyword === 'const') {
    return schemaError('SCHEMA_INVALID_KIND', 'Manifest kind must be "openyida_app_manifest".', {
      path: '/kind',
    });
  }
  if (error.instancePath === '/schemaVersion' && error.keyword === 'const') {
    return schemaError('SCHEMA_UNSUPPORTED_VERSION', 'Manifest schemaVersion must be 1.', {
      path: '/schemaVersion',
    });
  }

  return schemaError('SCHEMA_MANIFEST_SCHEMA_INVALID', 'Manifest does not match Manifest v1 schema.', {
    path: pointer,
    details: {
      keyword: error.keyword,
    },
  });
}

function toPublicResource(resource) {
  const result = {
    resourceType: resource.resourceType,
    key: resource.key,
    desired: resource.desired,
    dependsOn: [...(resource.dependsOn || [])].sort(),
  };
  if (resource.source !== undefined) {
    result.source = resource.source;
  }
  return result;
}

function compareResources(left, right) {
  const leftId = `${left.resourceType}:${left.key}`;
  const rightId = `${right.resourceType}:${right.key}`;
  return compareCodePoints(leftId, rightId);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(item => stableStringify(item)).join(',') + ']';
  }
  return '{' + Object.keys(value).sort(compareCodePoints).map(key => (
    JSON.stringify(key) + ':' + stableStringify(value[key])
  )).join(',') + '}';
}

function canonicalizeKey(key) {
  return String(key).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function formatJsonPointer(segments) {
  if (!segments || segments.length === 0) {
    return '/';
  }
  return '/' + segments.map(escapePointer).join('/');
}

function escapePointer(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

module.exports = {
  KNOWN_UNSUPPORTED_SECTIONS,
  canonicalizeKey,
  normalizeManifest,
  stableStringify,
};
