'use strict';

const { createPluginRuntimeRegistry } = require('../lib/plugin/runtime-registry');

const descriptor = { pluginId: 'PLUGIN-ONE', version: '1.0.0', cdnUrl: 'https://g.alicdn.com/example/remoteEntry.js', extensionIds: ['b', 'a', 'a'] };

test('deduplicates concurrent and repeated loads inside one isolated registry', async () => {
  const loadEntry = jest.fn(async value => ({ value }));
  const registry = createPluginRuntimeRegistry({ loadEntry });
  const [first, second] = await Promise.all([registry.load(descriptor), registry.load({ ...descriptor, extensionIds: ['a', 'b'] })]);
  expect(first).toBe(second);
  expect(loadEntry).toHaveBeenCalledTimes(1);
  expect(loadEntry.mock.calls[0][0].extensionIds).toEqual(['a', 'b']);
  expect(await registry.load(descriptor)).toBe(first);
});

test('does not poison retries after a failed load', async () => {
  const loadEntry = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue({ ok: true });
  const registry = createPluginRuntimeRegistry({ loadEntry });
  await expect(registry.load(descriptor)).rejects.toThrow('network');
  await expect(registry.load(descriptor)).resolves.toEqual({ ok: true });
  expect(loadEntry).toHaveBeenCalledTimes(2);
});

test('separates versions and invalidates only the requested plugin version', async () => {
  const loadEntry = jest.fn(async value => value.version);
  const registry = createPluginRuntimeRegistry({ loadEntry });
  await registry.load(descriptor);
  await registry.load({ ...descriptor, version: '2.0.0' });
  expect(registry.size()).toBe(2);
  expect(registry.invalidate({ pluginId: descriptor.pluginId, version: '1.0.0' })).toBe(1);
  expect(registry.size()).toBe(1);
});

test('requires an HTTPS entry and keeps registries independent', async () => {
  const loader = jest.fn(async () => true);
  const first = createPluginRuntimeRegistry({ loadEntry: loader });
  const second = createPluginRuntimeRegistry({ loadEntry: loader });
  await expect(first.load({ ...descriptor, cdnUrl: 'http://unsafe.test/entry.js' })).rejects.toThrow('HTTPS');
  await first.load(descriptor);
  await second.load(descriptor);
  expect(loader).toHaveBeenCalledTimes(2);
});
