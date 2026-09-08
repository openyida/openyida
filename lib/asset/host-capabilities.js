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

function hasDeclaredCapability(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function availableCapability(source) {
  return { status: 'available', available: true, source };
}

function detectHostClass(runtime = {}, env = process.env) {
  const managedRuntime = String(env.OPENYIDA_MANAGED_RUNTIME || '').trim().toLowerCase();
  if (managedRuntime === 'cloud' || runtime.runtime === 'web_sandbox' || runtime.tool === 'mulerun') {
    return 'managed_cloud';
  }
  if (
    ['local', 'non_cloud', 'non-cloud'].includes(managedRuntime) ||
    ['desktop_shell', 'agent_cli', 'local'].includes(runtime.runtime)
  ) {
    return 'non_cloud';
  }
  return 'unknown';
}

function resolveCapability(value, runtimeDefault) {
  return hasDeclaredCapability(value) ? readDeclaredCapability(value) : runtimeDefault;
}

function buildHostAssetCapabilities(options = {}) {
  const env = options.env || process.env;
  const runtime = options.runtime || {};
  const hostClass = detectHostClass(runtime, env);
  const inventoryRequired = {
    status: 'unknown',
    available: null,
    source: 'host_tool_inventory_required',
  };
  const searchDefault = hostClass === 'non_cloud'
    ? availableCapability('non_cloud_runtime_default')
    : inventoryRequired;
  const generationDefault = runtime.tool === 'qwenwork'
    ? availableCapability('qwenwork_runtime_default')
    : inventoryRequired;
  const onlineSearch = resolveCapability(env[CAPABILITY_ENV.onlineSearch], searchDefault);
  const imageSearch = resolveCapability(env[CAPABILITY_ENV.imageSearch], searchDefault);
  const imageGeneration = resolveCapability(env[CAPABILITY_ENV.imageGeneration], generationDefault);
  const capabilities = [onlineSearch, imageSearch, imageGeneration];

  return {
    schema_version: 1,
    host: {
      tool: runtime.tool || null,
      runtime: runtime.runtime || 'unknown',
      subtype: runtime.subtype || null,
      class: hostClass,
    },
    online_search: onlineSearch,
    image_search: imageSearch,
    image_generation: imageGeneration,
    requires_host_tool_inventory_check: capabilities.some(item => item.status === 'unknown'),
    declaration_env: { ...CAPABILITY_ENV },
    detection_policy:
      'Explicit declarations override runtime defaults. QwenWork provides image generation, and verified non-cloud runtimes provide online and image search. Managed-cloud or unknown runtimes use the host tool inventory.',
  };
}

module.exports = {
  CAPABILITY_ENV,
  readDeclaredCapability,
  detectHostClass,
  buildHostAssetCapabilities,
};
