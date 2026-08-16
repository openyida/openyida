'use strict';

const crypto = require('crypto');
const { extractSchemaContent } = require('./services/native-page-schema-builder');

function parseSchemaContent(value) {
  return extractSchemaContent(value);
}

function codeBytes(value) {
  return typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : 0;
}

function normalizeCodeForFingerprint(value) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';
}

function fingerprint(value) {
  const normalized = normalizeCodeForFingerprint(value);
  if (!normalized) {
    return '';
  }
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function createEmptyDisplayInfo() {
  return {
    hasYidaCodeCanvas: false,
    hasNativeJsx: false,
    runtimeCodeBytes: 0,
    sourceCodeBytes: 0,
    compiledCodeBytes: 0,
    importedModules: [],
    componentCount: 0,
    canvasRuntimeCode: '',
    canvasSourceCode: '',
    nativeCompiledCode: '',
    nativeSourceCode: '',
  };
}

function addImportedModules(target, value) {
  let modules = value;
  if (typeof modules === 'string') {
    const trimmed = modules.trim();
    if (!trimmed) {
      return;
    }
    try {
      modules = JSON.parse(trimmed);
    } catch {
      modules = [trimmed];
    }
  }
  if (!Array.isArray(modules)) {
    return;
  }
  modules
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .forEach((item) => {
      if (!target.includes(item)) {
        target.push(item);
      }
    });
}

function traverseDisplayNodes(node, info) {
  if (!node) {
    return;
  }
  if (Array.isArray(node)) {
    node.forEach(item => traverseDisplayNodes(item, info));
    return;
  }
  if (typeof node !== 'object') {
    return;
  }

  if (node.componentName === 'YidaCodeCanvas') {
    const props = node.props || {};
    info.hasYidaCodeCanvas = true;
    info.componentCount++;
    info.canvasRuntimeCode = props.runtimeCode || '';
    info.canvasSourceCode = props.code || '';
    info.runtimeCodeBytes += codeBytes(props.runtimeCode);
    info.sourceCodeBytes += codeBytes(props.code);
    addImportedModules(info.importedModules, props.importedModules);
  } else if (node.componentName === 'Jsx') {
    info.hasNativeJsx = true;
    info.componentCount++;
  }

  Object.keys(node).forEach(key => traverseDisplayNodes(node[key], info));
}

function extractDisplayPublishInfo(schemaInput) {
  const schema = parseSchemaContent(schemaInput);
  if (!schema || typeof schema !== 'object') {
    return null;
  }

  const info = createEmptyDisplayInfo();
  traverseDisplayNodes(schema.pages || schema, info);

  const module = schema.actions && schema.actions.module;
  if (info.hasNativeJsx && module && typeof module === 'object') {
    info.nativeCompiledCode = module.compiled || '';
    info.nativeSourceCode = module.source || '';
    info.compiledCodeBytes += codeBytes(module.compiled);
    info.sourceCodeBytes += codeBytes(module.source);
  }

  if (!info.hasYidaCodeCanvas && !info.hasNativeJsx) {
    return null;
  }

  return info;
}

function getPublishArtifact(info, publishMode) {
  if (!info) {
    return '';
  }
  if (publishMode === 'canvas') {
    return info.canvasRuntimeCode || '';
  }
  return info.nativeCompiledCode || '';
}

function hasExpectedDisplayComponent(info, publishMode) {
  if (!info) {
    return false;
  }
  if (publishMode === 'canvas') {
    return info.hasYidaCodeCanvas && info.runtimeCodeBytes > 0;
  }
  return info.hasNativeJsx && info.compiledCodeBytes > 0;
}

function summarizeDisplayPublishInfo(info) {
  if (!info) {
    return null;
  }
  return {
    hasYidaCodeCanvas: info.hasYidaCodeCanvas,
    hasNativeJsx: info.hasNativeJsx,
    runtimeCodeBytes: info.runtimeCodeBytes,
    sourceCodeBytes: info.sourceCodeBytes,
    compiledCodeBytes: info.compiledCodeBytes,
    importedModules: info.importedModules.slice(),
    componentCount: info.componentCount,
  };
}

function verifyPublishedContentMatch(readbackSchema, expectedSchemaContent, publishMode) {
  const readbackInfo = extractDisplayPublishInfo(readbackSchema);
  const expectedInfo = extractDisplayPublishInfo(expectedSchemaContent);
  const displayComponentPresent = hasExpectedDisplayComponent(readbackInfo, publishMode);
  const readbackArtifact = getPublishArtifact(readbackInfo, publishMode);
  const expectedArtifact = getPublishArtifact(expectedInfo, publishMode);
  const readbackFingerprint = fingerprint(readbackArtifact);
  const expectedFingerprint = fingerprint(expectedArtifact);

  return {
    readbackInfo,
    expectedInfo,
    displayComponentPresent,
    publishedContentMatched: !!(
      displayComponentPresent &&
      readbackFingerprint &&
      expectedFingerprint &&
      readbackFingerprint === expectedFingerprint
    ),
    readbackFingerprint,
    expectedFingerprint,
  };
}

module.exports = {
  extractDisplayPublishInfo,
  fingerprint,
  hasExpectedDisplayComponent,
  parseSchemaContent,
  summarizeDisplayPublishInfo,
  verifyPublishedContentMatch,
};
