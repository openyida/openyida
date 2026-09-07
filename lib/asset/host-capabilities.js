'use strict';

const CAPABILITY_ENV = Object.freeze({
  onlineSearch: 'OPENYIDA_AGENT_ONLINE_SEARCH',
  imageSearch: 'OPENYIDA_AGENT_IMAGE_SEARCH',
  imageGeneration: 'OPENYIDA_AGENT_IMAGE_GENERATION',
});

function readDeclaredCapability(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { status: 'unknown', available: null, source: 'host_tool_inventory_required' };
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'available', 'enabled'].includes(normalized)) {
    return { status: 'available', available: true, source: 'environment_declaration' };
  }
  if (['0', 'false', 'no', 'unavailable', 'disabled'].includes(normalized)) {
    return { status: 'unavailable', available: false, source: 'environment_declaration' };
  }
  return { status: 'unknown', available: null, source: 'invalid_environment_declaration' };
}

function buildHostAssetCapabilities(options = {}) {
  const env = options.env || process.env;
  const runtime = options.runtime || {};
  const onlineSearch = readDeclaredCapability(env[CAPABILITY_ENV.onlineSearch]);
  const imageSearch = readDeclaredCapability(env[CAPABILITY_ENV.imageSearch]);
  const imageGeneration = readDeclaredCapability(env[CAPABILITY_ENV.imageGeneration]);
  const capabilities = [onlineSearch, imageSearch, imageGeneration];

  return {
    schema_version: 1,
    host: {
      tool: runtime.tool || null,
      runtime: runtime.runtime || 'unknown',
      subtype: runtime.subtype || null,
    },
    online_search: onlineSearch,
    image_search: imageSearch,
    image_generation: imageGeneration,
    requires_host_tool_inventory_check: capabilities.some(item => item.status === 'unknown'),
    declaration_env: { ...CAPABILITY_ENV },
    detection_policy:
      'Host tool inventory or explicit declarations are authoritative. Browser availability and agent product name do not prove online image search or image generation support.',
  };
}

module.exports = {
  CAPABILITY_ENV,
  readDeclaredCapability,
  buildHostAssetCapabilities,
};
