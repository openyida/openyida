'use strict';

const { parseArgs } = require('node:util');
const { CliError } = require('../core/cli-error');
const { createYidaClient, unwrapYidaResponse } = require('../core/yida-client');
const { buildYidaTitleI18n, normalizeYidaLocale } = require('../core/yida-i18n');
const { fetchFormSchemaInfo } = require('./get-form-config');

const ACTIONS = new Set(['templates', 'create', 'inspect', 'copy', 'rename', 'publish', 'components', 'config', 'data', 'configure-data']);
// Native resources use DATAV- IDs; FORM- targets still require a server datav type check.
const DATAV_RESOURCE_ID = /^(?:DATAV|FORM)-[A-Za-z0-9]+$/;
const USAGE = 'datav templates <appType> [--page <n>] [--page-size <n>]; datav create <appType> <name> [--template <id>] [--locale <locale>]; datav inspect|publish|config|components <appType> <formUuid>; datav copy|rename <appType> <formUuid> <name>; datav data <appType> <formUuid> --component <layerId>; datav configure-data <appType> <formUuid> --component <layerId> --query-file <file> --expected-hash <hash>';

/** Parse action-specific options before authentication or remote writes. */
function parse(input) {
  const { positionals, values } = parseArgs({ args: input, allowPositionals: true, options: {
    json: { type: 'boolean' }, confirm: { type: 'boolean' }, template: { type: 'string' }, locale: { type: 'string' },
    page: { type: 'string' }, 'page-size': { type: 'string' }, 'wait-seconds': { type: 'string' },
    component: { type: 'string' }, category: { type: 'string' }, search: { type: 'string' },
    'query-file': { type: 'string' }, 'expected-hash': { type: 'string' },
  } });
  const [action, appType, formOrName, name] = positionals;
  const length = ['templates'].includes(action) ? 2 : ['copy', 'rename'].includes(action) ? 4 : 3;
  if (!ACTIONS.has(action) || positionals.length !== length || !/^APP_[A-Za-z0-9]+$/.test(appType || '')) {
    throw new CliError(USAGE, { code: 'DATAV_USAGE' });
  }
  const allowed = {
    templates: ['page', 'page-size'], create: ['template', 'locale', 'wait-seconds'],
    copy: ['locale', 'wait-seconds'], rename: ['locale'], inspect: [], publish: ['confirm'],
    components: ['component', 'category', 'search'], config: ['component'],
    data: ['component'], 'configure-data': ['component', 'query-file', 'expected-hash'],
  }[action];
  if (Object.keys(values).some(key => key !== 'json' && !allowed.includes(key))) {
    throw new CliError(USAGE, { code: 'DATAV_USAGE' });
  }
  if (['data', 'configure-data'].includes(action) && !values.component) {throw new CliError(USAGE, { code: 'DATAV_USAGE' });}
  if (action === 'configure-data' && (!values['query-file'] || !/^sha256:[a-f0-9]{64}$/.test(values['expected-hash'] || ''))) {
    throw new CliError(USAGE, { code: 'DATAV_USAGE' });
  }
  const needsForm = !['templates', 'create'].includes(action);
  if (needsForm && !DATAV_RESOURCE_ID.test(formOrName || '')) {
    throw new CliError('A native DataV formUuid is required.', { code: 'DATAV_USAGE' });
  }
  if (action === 'publish' && values.confirm !== true) {
    throw new CliError('Publishing enables the DataV screen. Pass --confirm only when publication is requested.', { code: 'DATAV_PUBLISH_CONFIRM_REQUIRED' });
  }
  const title = action === 'create' ? formOrName : name;
  if (title !== undefined && (!title.trim() || title.length > 150)) {
    throw new CliError('The screen name must contain 1–150 characters.', { code: 'DATAV_USAGE' });
  }
  const locale = values.locale ? normalizeYidaLocale(values.locale) : 'zh_CN';
  if (!locale) {throw new CliError('Unsupported content locale.', { code: 'DATAV_USAGE' });}
  if (values.template !== undefined && !/^\d+$/.test(values.template)) {
    throw new CliError('Use a templateId returned by datav templates.', { code: 'DATAV_USAGE' });
  }
  if (values.category !== undefined && !['chart', 'analysis', 'map', 'info', 'table', 'control', 'media', 'other'].includes(values.category)) {
    throw new CliError('Use category chart|analysis|map|info|table|control|media|other.', { code: 'DATAV_USAGE' });
  }
  if (['component', 'search'].some(key => values[key] !== undefined && (!values[key].trim() || values[key].length > 200))) {
    throw new CliError('Component and search values must contain 1–200 characters.', { code: 'DATAV_USAGE' });
  }
  const integer = (key, fallback, max) => {
    const raw = values[key] === undefined ? String(fallback) : values[key];
    if (!/^\d+$/.test(raw) || Number(raw) > max || (key !== 'wait-seconds' && Number(raw) < 1)) {
      throw new CliError('Invalid --' + key, { code: 'DATAV_USAGE' });
    }
    return Number(raw);
  };
  return { action, appType, formUuid: needsForm ? formOrName : undefined, title, locale,
    template: values.template, page: integer('page', 1, 1000000), pageSize: integer('page-size', 10, 100),
    waitSeconds: integer('wait-seconds', 15, 60), component: values.component, category: values.category, search: values.search,
    queryFile: values['query-file'], expectedHash: values['expected-hash'] };
}

/** Return YiDA-hosted DataV routes; never expose the embedded DataV share token. */
function urls(client, appType, formUuid) {
  const base = client.getAuthRef().baseUrl.replace(/\/$/, '') + '/alibaba/web/' + appType + '/datav/';
  return { designerUrl: base + 'vigoDesigner.html?formUuid=' + formUuid,
    previewUrl: base + 'preview.html?formUuid=' + formUuid };
}

/** Preserve business error codes, including missing DataV entitlement or quota. */
function unwrap(response, action) {
  let envelope = response;
  for (let depth = 0; depth < 3; depth++) {
    // DataV's ServiceResult uses result for rename/publish and content for create;
    // MVC may add a second success/content envelope around that ServiceResult.
    const normalized = envelope && (envelope.content === null || envelope.content === undefined) && envelope.result !== undefined
      ? { ...envelope, content: envelope.result } : envelope;
    let value;
    try {value = unwrapYidaResponse(normalized, { action });} catch (error) {
      throw new CliError(error.message, { code: 'DATAV_REQUEST_FAILED',
        details: { platformErrorCode: envelope && envelope.errorCode } });
    }
    if (!value || typeof value !== 'object' || typeof value.success !== 'boolean' || value === envelope) {return value;}
    envelope = value;
  }
  throw new CliError('Unsupported DataV response envelope.', { code: 'DATAV_RESPONSE_INVALID' });
}

/** Read metadata and async readiness for an existing DataV resource only. */
async function inspect(client, appType, formUuid) {
  const metadata = unwrap(await fetchFormSchemaInfo(client.getAuthRef(), appType, formUuid), 'Read DataV metadata');
  if (metadata.formType !== 'datav' || (metadata.formUuid && metadata.formUuid !== formUuid) ||
      (metadata.appType && metadata.appType !== appType)) {
    throw new CliError('The selected resource must belong to this app and have formType datav.', { code: 'DATAV_TYPE_REQUIRED' });
  }
  const value = unwrap(await client.get('/alibaba/web/' + appType + '/query/datavscreen/getCreateDatavResult.json', { formUuid }), 'Read DataV creation status');
  const ready = /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
  return { appType, formUuid, formType: 'datav', title: metadata.title,
    state: ready ? 'ready' : 'pending', datavId: ready ? Number(value) : null, ...urls(client, appType, formUuid) };
}

/** Write once; transport failures carry recovery details instead of replaying a mutation. */
async function write(client, appType, endpoint, body, target) {
  let response;
  try {
    response = await client.postFormOnce('/alibaba/web/' + appType + '/query/datavscreen/' + endpoint + '.json',
      ref => ({ _csrf_token: ref.csrfToken, ...body }));
  } catch (error) {
    throw new CliError(error.message, { code: 'DATAV_WRITE_UNCERTAIN', details: {
      ...target, sideEffectState: 'unknown', retrySafe: false,
      recovery: target.formUuid ? ['datav', 'inspect', appType, target.formUuid, '--json'] : ['list-forms', appType],
    } });
  }
  return unwrap(response, endpoint);
}

/** Create/copy asynchronously, retaining the resource identity if readiness cannot be verified. */
async function create(client, args) {
  const { appType, action, title, locale, template, waitSeconds } = args;
  if (action === 'copy') {
    const source = await inspect(client, appType, args.formUuid);
    if (source.state !== 'ready') {throw new CliError('The source DataV screen is not ready.', { code: 'DATAV_NOT_READY' });}
  }
  const titleValue = JSON.stringify(buildYidaTitleI18n(title, { [locale]: title }));
  const body = action === 'copy' ? { formUuid: args.formUuid, appKey: appType, title: titleValue } : {
    formType: 'datav', title: titleValue, parentNavUuid: '', relateFormType: '', relateFormUuid: '',
    ...(template === undefined ? {} : { templateUuid: template }),
  };
  const content = await write(client, appType, action === 'copy' ? 'copyDatavScreen' : 'createDatavScreenInfo', body, { appType });
  const formUuid = typeof content === 'string' ? content : content && (content.formUuid || content.result);
  if (!DATAV_RESOURCE_ID.test(formUuid || '')) {
    throw new CliError('Creation was accepted without a usable formUuid. List existing app pages before retrying.', {
      code: 'DATAV_CREATE_UNVERIFIED', details: { appType, sideEffectState: 'unknown', retrySafe: false, recovery: ['list-forms', appType] },
    });
  }
  const deadline = Date.now() + waitSeconds * 1000;
  try {
    let first = true;
    while (first || Date.now() < deadline) {
      first = false;
      const result = await inspect(client, appType, formUuid);
      if (result.state === 'ready') {return { ...result, created: true, readbackVerified: true };}
      if (Date.now() >= deadline) {break;}
      await new Promise(resolve => setTimeout(resolve, Math.min(1500, deadline - Date.now())));
    }
  } catch (error) {
    throw new CliError(error.message, { code: 'DATAV_CREATE_UNVERIFIED', details: {
      appType, formUuid, created: true, sideEffectState: 'applied', retrySafe: false,
      recovery: ['datav', 'inspect', appType, formUuid, '--json'],
    } });
  }
  throw new CliError('The screen was created but is not ready. Inspect this same formUuid; do not create it again.', {
    code: 'DATAV_CREATE_PENDING', details: { appType, formUuid, created: true, retrySafe: false,
      ...urls(client, appType, formUuid), recovery: ['datav', 'inspect', appType, formUuid, '--json'] },
  });
}

/** Execute source-backed DataV lifecycle operations. Layout editing remains in its native designer. */
async function run(input) {
  if (input.includes('--help') || input.includes('-h')) {
    const action = input.find(value => !value.startsWith('-'));
    const { COMMAND_GROUPS } = require('../core/command-manifest');
    for (const command of COMMAND_GROUPS.flatMap(group => group.commands)) {
      if (command.path[0] === 'datav' && (!action || action === command.path[1])) {
        process.stdout.write('openyida ' + command.usage + '\n');
      }
    }
    return;
  }
  const args = parse(input);
  const client = createYidaClient();
  const { action, appType, formUuid } = args;
  let result;
  if (action === 'templates') {
    result = { appType, page: args.page, pageSize: args.pageSize,
      templates: unwrap(await client.get('/alibaba/web/' + appType + '/datavtemplate/getTemplateList.json',
        { pageIndex: args.page, pageSize: args.pageSize }), 'List DataV templates') };
  } else if (['create', 'copy'].includes(action)) {
    result = await create(client, args);
  } else {
    result = await inspect(client, appType, formUuid);
    if (['data', 'configure-data'].includes(action)) {
      if (result.state !== 'ready') {throw new CliError('The DataV screen is not ready.', { code: 'DATAV_NOT_READY' });}
      const data = await require('./datav-data').run(client, result, args);
      console.log(JSON.stringify({ success: true, pageType: 'datav', ...result, ...data }, null, 2));
      return;
    }
    if (['config', 'components'].includes(action)) {
      if (result.state !== 'ready') {throw new CliError('The DataV screen is not ready.', { code: 'DATAV_NOT_READY' });}
      const configuration = await require('./datav-designer').read(client, result, args);
      console.log(JSON.stringify({ success: true, pageType: 'datav', ...result, ...configuration }, null, 2));
      return;
    }
    if (action !== 'inspect') {
      if (result.state !== 'ready') {throw new CliError('The DataV screen is not ready.', { code: 'DATAV_NOT_READY', details: result });}
      let title;
      if (action === 'rename') {
        title = typeof result.title === 'object' && result.title !== null ? { ...result.title } : buildYidaTitleI18n(String(result.title || ''));
        title[args.locale] = args.title;
        // The platform validates zh_CN and uses it to rename the DataV backing screen.
        title.zh_CN = args.title;
      }
      const value = await write(client, appType, action === 'rename' ? 'modifyScreen' : 'saveScreen',
        action === 'rename' ? { formUuid, datavId: result.datavId, screenTitle: JSON.stringify(title) } : { formUuid }, result);
      if (value !== true) {
        throw new CliError('The DataV write result was not confirmed. Inspect before retrying.', {
          code: 'DATAV_WRITE_UNCERTAIN', details: { appType, formUuid, retrySafe: false },
        });
      }
      const before = result;
      try {
        result = await inspect(client, appType, formUuid);
        if (result.state !== 'ready' || before.datavId !== result.datavId ||
            (title && (result.title[args.locale] !== args.title || result.title.zh_CN !== args.title))) {
          throw new Error('DataV readback does not match the requested change.');
        }
      } catch (error) {
        throw new CliError(error.message, { code: 'DATAV_READBACK_UNVERIFIED', details: {
          appType, formUuid, sideEffectState: 'applied', retrySafe: false, recovery: ['datav', 'inspect', appType, formUuid, '--json'],
        } });
      }
      result = { ...result, operation: action, readbackVerified: action === 'rename',
        ...(action === 'publish' ? { publishAccepted: true, enableRequested: true, layoutVerified: false } : {}) };
    }
  }
  console.log(JSON.stringify({ success: true, pageType: 'datav', ...result }, null, 2));
}

module.exports = { run, parse };
