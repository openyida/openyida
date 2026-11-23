'use strict';

const { EventEmitter } = require('node:events');
const { read, allowedUrl, session, parseConfig, screenView, catalogueView } = require('../lib/app/datav-designer');
const { parse } = require('../lib/app/datav');

const config = { config: { width: 1920, height: 1080, token: 'private-page' },
  token: 'private-share', password: 'private-password', scenes: [{ name: 'Main', layers: {
    TITLE: { comName: 'main-title', version: '1.0', attr: { x: 1 },
      config: { content: 'Sales', url: 'https://example.test/?token=private-query&region=CN', secret: 'private-secret' },
      data: { source: [{ value: 'private-data' }] } },
  } }] };

test.each(['https://evil.test/path', 'http://datav.aliyun.com/path', 'https://user:pass@datav.aliyun.com/path',
  'https://datav.aliyun.com/path#fragment', 'https://datav.aliyun.com.evil.test/path'])('rejects an unsafe integration origin: %s', url => {
  expect(() => allowedUrl(url)).toThrow();
});

test('relative integration requests stay on the pinned DataV origin', () => {
  expect(allowedUrl('/api/admin/screen').origin).toBe('https://datav.aliyun.com');
});

function envelope(payload, id = 12) {
  return `Cube("main:/admin/v3/screen/${id}/config.js", [], function (module, exports, require, load, __dirname, __filename) {module.exports = ${JSON.stringify(payload)};\nreturn module.exports;});`;
}

test('parses the observed JSON envelope without running remote JavaScript', () => {
  expect(parseConfig(envelope(config), 12)).toEqual(config);
  expect(() => parseConfig(envelope(config), 13)).toThrow();
  expect(() => parseConfig(envelope(config).replace('module.exports = {', 'module.exports = global.injected = {'), 12)).toThrow();
  expect(() => parseConfig(envelope(config) + 'process.exit(1)', 12)).toThrow();
  expect(() => parseConfig('<html>login</html>', 12)).toThrow();
  expect(() => parseConfig(envelope({ scenes: [] }), 12)).toThrow();
  expect(() => parseConfig(envelope(null), 12)).toThrow();
});

test('returns saved styles while excluding share settings, source data and credentials', () => {
  const view = screenView(config);
  expect(view).toMatchObject({ page: { width: 1920 }, dataValuesIncluded: false, writable: false,
    scenes: [{ layers: [{ id: 'TITLE', dataInterfaces: ['source'], config: { content: 'Sales', secret: '[redacted]' } }] }] });
  expect(JSON.stringify(view)).not.toContain('private-');
  expect(view.scenes[0].layers[0].config.url).toBe('https://example.test/?token=[redacted]&region=CN');
  expect(config.scenes[0].layers.TITLE.config.secret).toBe('private-secret');
});

test('selects a real layer ID and reports a missing selection', () => {
  expect(screenView(config, 'TITLE').scenes[0].layers).toHaveLength(1);
  expect(() => screenView(config, 'MISSING')).toThrow(expect.objectContaining({ code: 'DATAV_COMPONENT_NOT_FOUND' }));
});

const entry = { name: 'bar-basic', cn_name: '柱状图', version: '5.9.10', type: 'regular_bar',
  config: { type: ['regular_bar', 'DataV-6:regular_column', 'DataV-6:analysis'],
    config: { options: { type: 'menu', children: { size: { name: 'Size', type: 'number', min: 0, max: 100, default: 12 } } } },
    apis: { source: { fields: { x: { type: 'string' }, y: { type: 'number' } } } },
    events: { click: {} }, publicHandler: { show: {} } } };

test.each(['chart', 'analysis'])('classifies a BI chart in category %s', category => {
  const view = catalogueView([entry], { category });
  expect(view.total).toBe(1);
  expect(view.components[0].categories).toEqual(['chart', 'analysis']);
  expect(view).toMatchObject({ entitlementVerified: false, installedPackagesIncluded: false });
});

test('detailed catalogue parses schema JSON strings and preserves types, ranges and events', () => {
  const view = catalogueView([{ ...entry, config: JSON.stringify(entry.config) }], { component: 'bar-basic' });
  expect(view.components[0]).toMatchObject({ definition: entry.config,
    parameterDefinitions: expect.arrayContaining([{ path: 'options.size', name: 'Size', type: 'number', min: 0, max: 100, default: 12 }]) });
  expect(catalogueView([entry], { search: '柱状' }).total).toBe(1);
  expect(catalogueView([entry], { search: 'missing' }).total).toBe(0);
  expect(() => catalogueView([entry], { component: 'missing' })).toThrow();
  expect(() => catalogueView({}, {})).toThrow();
  expect(() => catalogueView([{ ...entry, config: 'invalid' }], {})).toThrow();
});

test('read options are action-specific and reject mutation flags before authentication', () => {
  expect(parse(['components', 'APP_TEST', 'DATAV-123', '--component', 'bar-basic', '--category', 'analysis'])).toMatchObject({ action: 'components', component: 'bar-basic' });
  expect(parse(['config', 'APP_TEST', 'DATAV-123', '--component', '标题_123'])).toMatchObject({ component: '标题_123' });
  for (const args of [ ['config', '--category', 'map'], ['components', '--category', 'regular'],
    ['config', '--confirm'], ['config', '--component', ''], ['components', '--template', '12'] ]) {
    expect(() => parse([args[0], 'APP_TEST', 'DATAV-123', ...args.slice(1)])).toThrow();
  }
});

function transport(responses) {
  const calls = [];
  function request(url, options, callback) {
    calls.push({ url: url.href, options });
    const req = new EventEmitter();
    req.setTimeout = jest.fn(); req.destroy = jest.fn();
    req.end = () => queueMicrotask(() => {
      const data = responses.shift();
      const res = new EventEmitter(); res.statusCode = data.status || 200;
      res.headers = data.headers || {}; res.resume = jest.fn(); callback(res);
      res.emit('data', Buffer.from(data.body || 'ok')); res.emit('end');
    });
    return req;
  }
  return { calls, request };
}

test('keeps DataV cookies in one memory-only session and never sends YiDA OAuth', async () => {
  const net = transport([{ headers: { 'set-cookie': ['EGG_DATAV_SESSION=private-cookie; Path=/; HttpOnly', 'other=wrong; Domain=evil.test'] } }, {}]);
  const remote = session(net.request);
  await remote.get('/admin/screen/12'); await remote.get('/cube/modules');
  expect(net.calls[0].options.headers.Cookie).toBeUndefined();
  expect(net.calls[1].options.headers.Cookie).toBe('EGG_DATAV_SESSION=private-cookie');
  expect(net.calls[1].options.headers.Authorization).toBeUndefined();
  const fresh = transport([{}]); await session(fresh.request).get('/cube/modules');
  expect(fresh.calls[0].options.headers.Cookie).toBeUndefined();
});

test('refuses external login redirects without leaking the signed ticket or cookie', async () => {
  const net = transport([{ status: 302, headers: { location: 'https://account.aliyun.com/login?token=private-ticket' } }]);
  await expect(session(net.request).get('/admin/screen/12')).rejects.toThrow(expect.objectContaining({ code: 'DATAV_DESIGNER_UNAVAILABLE' }));
  expect(net.calls).toHaveLength(1);
});

test('native data writes send one PUT with DataV CSRF and never follow redirects', async () => {
  const net = transport([{ status: 302, headers: { location: '/login' } }]);
  await expect(session(net.request).put('/api/admin/v2/data_source/1?screenId=12', { rawJSON: '{}' }, 'private-csrf')).rejects.toThrow();
  expect(net.calls).toHaveLength(1);
  expect(net.calls[0].options).toMatchObject({ method: 'PUT', headers: { 'xsrf-token': 'private-csrf' } });
  expect(net.calls[0].options.headers.Authorization).toBeUndefined();
});

test('opens the verified screen through a fresh ticket and only issues GET requests', async () => {
  const net = transport([{ body: 'var configJSPath = "current";' }, { body: envelope(config) }]);
  const request = jest.spyOn(require('node:https'), 'request').mockImplementation(net.request);
  const client = { get: jest.fn().mockResolvedValue('datavScreenEdit: "https://datav.aliyun.com/admin/screen/12?x-datav-login-ticket=private-ticket&x-datav-from-app=yida"') };
  try {
    const result = await read(client, { appType: 'APP_TEST', formUuid: 'DATAV-123', datavId: 12 }, { action: 'config' });
    expect(result.page.width).toBe(1920);
    expect(client.get.mock.calls[0][0]).toBe('/alibaba/web/APP_TEST/datav/vigoDesigner.html');
    expect(net.calls.map(call => call.options.method)).toEqual(['GET', 'GET']);
    expect(JSON.stringify(result)).not.toContain('private-ticket');
    client.get.mockResolvedValue('datavScreenEdit: "https://datav.aliyun.com/admin/screen/13?x-datav-login-ticket=private-ticket"');
    await expect(read(client, { appType: 'APP_TEST', formUuid: 'DATAV-123', datavId: 12 }, { action: 'config' })).rejects.toThrow();
    expect(net.calls).toHaveLength(2);
  } finally {request.mockRestore();}
});
