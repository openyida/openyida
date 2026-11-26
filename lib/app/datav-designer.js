'use strict';

const https = require('node:https');
const { CliError } = require('../core/cli-error');

const ORIGIN = 'https://datav.aliyun.com';

function failure(code = 'DATAV_DESIGNER_UNAVAILABLE') {
  const messages = {
    DATAV_CONFIG_INVALID: 'The saved DataV configuration format is not supported.',
    DATAV_CATALOGUE_INVALID: 'The DataV component catalogue returned an unsupported response.',
    DATAV_COMPONENT_NOT_FOUND: 'No component matches the requested catalogue name or layer ID.',
  };
  return new CliError(messages[code] || 'DataV designer access could not be verified. Open the YiDA designer and check access before retrying.', { code });
}

/** Only the observed YiDA DataV integration origin may receive its temporary ticket. */
function allowedUrl(value) {
  let url;
  try {url = new URL(value, ORIGIN);} catch {throw failure();}
  if (url.origin !== ORIGIN || url.username || url.password || url.hash) {throw failure();}
  return url;
}

/** A short-lived, memory-only DataV session. YiDA OAuth headers never cross origins. */
function session(request = https.request) {
  const cookies = new Map();
  async function get(value, redirects = 0, mutation) {
    const url = allowedUrl(value);
    return new Promise((resolve, reject) => {
      const req = request(url, { method: mutation ? 'PUT' : 'GET', headers: {
        Accept: '*/*', 'Accept-Encoding': 'identity', 'from-app': 'yida',
        'X-Requested-With': 'XMLHttpRequest',
        ...(mutation ? { 'Content-Type': 'application/json; charset=UTF-8', 'xsrf-token': mutation.csrf } : {}),
        ...(cookies.size ? { Cookie: [...cookies].map(([key, val]) => key + '=' + val).join('; ') } : {}),
      } }, response => {
        for (const entry of response.headers['set-cookie'] || []) {
          const domain = /;\s*domain=([^;]+)/i.exec(entry);
          if (domain && !['datav.aliyun.com', '.datav.aliyun.com'].includes(domain[1].toLowerCase())) {continue;}
          const pair = /^([^=;\s]+)=([^;]*)/.exec(entry);
          if (pair) {cookies.set(pair[1], pair[2]);}
        }
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          response.resume();
          try {
            if (mutation || redirects >= 3 || !response.headers.location) {throw failure();}
            resolve(get(allowedUrl(new URL(response.headers.location, url).href).href, redirects + 1));
          } catch {reject(failure());}
          return;
        }
        if (response.statusCode !== 200) {response.resume(); reject(failure()); return;}
        let bytes = 0;
        const chunks = [];
        response.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > 8 * 1024 * 1024) {req.destroy(); reject(failure()); return;}
          chunks.push(chunk);
        });
        response.on('error', () => reject(failure()));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
      req.setTimeout(30000, () => {req.destroy(); reject(failure());});
      req.on('error', () => reject(failure()));
      req.end(mutation ? JSON.stringify(mutation.body) : undefined);
    });
  }
  return { get, put: (url, body, csrf) => get(url, 0, { body, csrf }) };
}

/** Parse the JSON payload in Cube's known config envelope without evaluating script. */
function parseConfig(text, id) {
  const prefix = `Cube("main:/admin/v3/screen/${id}/config.js", [], function (module, exports, require, load, __dirname, __filename) {module.exports = `;
  const suffix = ';\nreturn module.exports;});';
  if (!text.startsWith(prefix) || !text.trimEnd().endsWith(suffix)) {throw failure('DATAV_CONFIG_INVALID');}
  let result;
  try {result = JSON.parse(text.trimEnd().slice(prefix.length, -suffix.length));} catch {throw failure('DATAV_CONFIG_INVALID');}
  if (!result || !Array.isArray(result.scenes) || !result.config || typeof result.config !== 'object') {throw failure('DATAV_CONFIG_INVALID');}
  return result;
}

async function connect(client, metadata) {
  const html = await client.get('/alibaba/web/' + metadata.appType + '/datav/vigoDesigner.html',
    { formUuid: metadata.formUuid }, { responseType: 'text', silentStatus: true });
  const match = typeof html === 'string' && /datavScreenEdit:\s*"([^"\r\n]+)"/.exec(html);
  if (!match) {throw failure();}
  const url = allowedUrl(match[1].replace(/&amp;/g, '&'));
  if (url.pathname !== '/admin/screen/' + metadata.datavId || !url.searchParams.has('x-datav-login-ticket')) {throw failure();}
  const remote = session();
  const editor = await remote.get(url.href);
  if (!editor.includes('configJSPath')) {throw failure();}
  remote.csrf = /window\._csrf\s*=\s*['"]([^'"]+)['"]/.exec(editor)?.[1];
  return remote;
}

/** Redact credentials in saved style URLs and bindings; never return share settings. */
function redact(value) {
  if (Array.isArray(value)) {return value.map(redact);}
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) =>
      [key, /token|password|secret|cookie|authorization|credential|ticket|signature|access.?key|api.?key/i.test(key) ? '[redacted]' : redact(val)]));
  }
  if (typeof value === 'string') {
    return value.replace(/([?&](?:[^=&\s]*(?:token|secret|password|ticket|signature|credential|authorization|access.?key|api.?key)[^=&\s]*)=)[^&#\s]*/gi, '$1[redacted]')
      .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[redacted]@');
  }
  return value;
}

function screenView(config, component) {
  const scenes = config.scenes.map((scene, index) => ({ index, name: scene.name,
    layers: Object.entries(scene.layers || {}).filter(([id]) => !component || component === id).map(([id, layer]) => ({
      id, comName: layer.comName, version: layer.version, type: layer.type, comType: layer.comType,
      parent: layer.parent, children: layer.children, attr: layer.attr, config: layer.config,
      // Values and remote data-source credentials stay in the native designer.
      dataInterfaces: Object.keys(layer.data || {}),
    })),
  }));
  if (component && !scenes.some(scene => scene.layers.length)) {throw failure('DATAV_COMPONENT_NOT_FOUND');}
  const { width, height, grid, display, backgroundColor, backgroundImage } = config.config;
  return redact({ page: { width, height, grid, display, backgroundColor, backgroundImage }, scenes,
    dataValuesIncluded: false, shareSettingsIncluded: false, writable: false });
}

function categories(entry) {
  const types = [entry.type, entry.config?.type || []].flat().join(',');
  const values = [];
  if (/map|geo|datavgl|guston/.test(types) || /map2d|datavmap|xiongan_blockdata/.test(entry.name || '')) {values.push('map');}
  if (/regular/.test(types)) {values.push('chart');}
  if (/interact|control/.test(types)) {values.push('control');}
  if (/figure|text|:info/.test(types)) {values.push('info');}
  if (/table|list|:table/.test(types)) {values.push('table');}
  if (/media|decorate/.test(types)) {values.push('media');}
  if (/:analysis/.test(types)) {values.push('analysis');}
  return values.length ? values : ['other'];
}

function parameters(fields, prefix = '') {
  return Object.entries(fields || {}).flatMap(([key, field]) => {
    if (!field || typeof field !== 'object') {return [];}
    const path = prefix ? prefix + '.' + key : key;
    const { name, type, description, default: initial, min, max, range, options, show, showInPanel, step, suffix } = field;
    return [{ path, name, type, description, default: initial, min, max, range, options, show, showInPanel, step, suffix },
      ...parameters(field.children, path), ...parameters(field.template?.children, path + '[]')];
  });
}

function catalogueView(entries, args) {
  if (!Array.isArray(entries)) {throw failure('DATAV_CATALOGUE_INVALID');}
  const normalized = entries.map(entry => {
    if (!entry || typeof entry !== 'object') {return {};}
    let config = entry.config;
    if (typeof config === 'string') {
      try {config = JSON.parse(config);} catch {throw failure('DATAV_CATALOGUE_INVALID');}
    }
    return { ...entry, config };
  });
  const selected = normalized.filter(entry => typeof entry.name === 'string' &&
    (!args.category || categories(entry).includes(args.category)) &&
    (!args.component || entry.name === args.component) &&
    (!args.search || (entry.name + ' ' + entry.cn_name).toLowerCase().includes(args.search.toLowerCase())));
  if (args.component && !selected.length) {throw failure('DATAV_COMPONENT_NOT_FOUND');}
  return { source: 'datav_component_catalogue', entitlementVerified: false, installedPackagesIncluded: false,
    total: selected.length, components: selected.map(entry => ({ name: entry.name, title: entry.cn_name || entry.config?.cn_name || entry.name,
      version: entry.version, categories: categories(entry), type: entry.type, level: entry.level,
      dataInterfaces: Object.keys(entry.config?.apis || {}),
      ...(args.component ? { parameterDefinitions: parameters(entry.config?.config), definition: entry.config } : {}),
    })) };
}

async function read(client, metadata, args) {
  const remote = await connect(client, metadata);
  if (args.action === 'config') {
    return screenView(parseConfig(await remote.get('/api/admin/v3/screen/' + metadata.datavId + '/config.js?x-datav-from-app=yida&m=1'), metadata.datavId), args.component);
  }
  let entries;
  const detail = args.component ? '' : '&withoutConfig=true';
  try {entries = JSON.parse(await remote.get('/cube/modules?i18n=zh_CN&x-datav-from-app=yida' + detail));} catch {throw failure('DATAV_CATALOGUE_INVALID');}
  return redact(catalogueView(entries, args));
}

module.exports = { read, connect, allowedUrl, session, parseConfig, screenView, catalogueView };
