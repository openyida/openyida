'use strict';

/**
 * A small, framework-neutral registry for YiDA front-end plugin entries.
 * It deliberately owns no global state: create one registry per host/runtime.
 */
function createPluginRuntimeRegistry(options = {}) {
  if (typeof options.loadEntry !== 'function') {
    throw new TypeError('loadEntry must be a function');
  }
  const entries = new Map();

  function keyOf(descriptor) {
    if (!descriptor || typeof descriptor.pluginId !== 'string' || !descriptor.pluginId
      || typeof descriptor.version !== 'string' || !descriptor.version
      || typeof descriptor.cdnUrl !== 'string' || !/^https:\/\//.test(descriptor.cdnUrl)) {
      throw new TypeError('pluginId, version and an HTTPS cdnUrl are required');
    }
    const extensionIds = [...new Set(descriptor.extensionIds || [])].sort();
    if (extensionIds.some(value => typeof value !== 'string' || !value)) {
      throw new TypeError('extensionIds must contain non-empty strings');
    }
    return JSON.stringify([descriptor.pluginId, descriptor.version, descriptor.cdnUrl, extensionIds]);
  }

  async function load(descriptor) {
    const key = keyOf(descriptor);
    if (entries.has(key)) { return entries.get(key); }
    const pending = Promise.resolve().then(() => options.loadEntry({
      ...descriptor,
      extensionIds: [...new Set(descriptor.extensionIds || [])].sort(),
    }));
    entries.set(key, pending);
    try {
      return await pending;
    } catch (error) {
      if (entries.get(key) === pending) { entries.delete(key); }
      throw error;
    }
  }

  function invalidate(filter = {}) {
    let removed = 0;
    for (const [key] of entries) {
      const [pluginId, version] = JSON.parse(key);
      if ((!filter.pluginId || filter.pluginId === pluginId)
        && (!filter.version || filter.version === version)) {
        entries.delete(key);
        removed++;
      }
    }
    return removed;
  }

  return { load, invalidate, size: () => entries.size };
}

module.exports = { createPluginRuntimeRegistry };
