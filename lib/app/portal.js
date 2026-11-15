'use strict';

const fs = require('node:fs');
const { isDeepStrictEqual, parseArgs } = require('node:util');
const { CliError } = require('../core/cli-error');
const { createYidaClient, unwrapYidaResponse } = require('../core/yida-client');
const { createServerRevisionConflict, isSaveFormSchemaRevisionConflict, requireSchemaServerRevision } = require('../core/server-revision');
const { fetchFormSchemaInfo } = require('./get-form-config');
const { applyPortalConfig, inspectPortal } = require('./portal-schema');

const SCHEMA_VERSION = 'V5';
const DOMAIN_CODE = 'tEXDRG';

async function readSchema(client, path, formUuid) {
  const result = await client.get(path + '/getFormSchema.json', { formUuid, schemaVersion: SCHEMA_VERSION });
  const content = unwrapYidaResponse(result, { action: 'Read portal schema' });
  const schema = typeof content === 'string' ? JSON.parse(content) : content;
  const revision = requireSchemaServerRevision(schema);
  return { schema, revision };
}

function parse(input) {
  let args;
  try {
    args = parseArgs({
      args: input, allowPositionals: true,
      options: {
        json: { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        'expected-revision': { type: 'string' },
      },
    });
  } catch (error) {
    throw new CliError(error.message, { code: 'PORTAL_USAGE' });
  }
  const [action, appType, formUuid, configFile] = args.positionals;
  const inspect = action === 'inspect' && args.positionals.length === 3 && !args.values['dry-run'] && !args.values['expected-revision'];
  const configure = action === 'configure' && args.positionals.length === 4;
  if ((!inspect && !configure) || !/^APP_[A-Za-z0-9]+$/.test(appType || '') || !/^FORM-[A-Za-z0-9]+$/.test(formUuid || '')) {
    throw new CliError('Usage: portal inspect <appType> <formUuid> or portal configure <appType> <formUuid> <file> --expected-revision <revision> [--dry-run]', { code: 'PORTAL_USAGE' });
  }
  const expected = args.values['expected-revision'];
  const dryRun = args.values['dry-run'] === true;
  if (configure && ((!dryRun && expected === undefined) || (expected !== undefined && !/^\d+$/.test(expected)))) {
    throw new CliError('Read the portal first and pass its revision with --expected-revision.', { code: 'PORTAL_REVISION_REQUIRED' });
  }
  return { action, appType, formUuid, configFile, dryRun, expected };
}

function readConfig(configFile) {
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (error) {
    throw new CliError('Unable to read portal configuration: ' + error.message, { code: 'PORTAL_CONFIG_INVALID' });
  }
}

async function verifyFormBindings(authRef, appType, tiles) {
  const forms = new Set(tiles.filter(tile => tile.componentName === 'DataManageViews').map(tile => tile.props.form.value));
  for (const formUuid of forms) {
    const response = await fetchFormSchemaInfo(authRef, appType, formUuid);
    const form = unwrapYidaResponse(response, { action: 'Read data-management source form' });
    if (!['receipt', 'process'].includes(form.formType)) {
      throw new CliError('DataManageViews must reference a readable regular or process form in the portal app: ' + formUuid, { code: 'PORTAL_FORM_BINDING_INVALID' });
    }
  }
}

function report(result) {
  process.stdout.write(JSON.stringify({ success: true, ...result }, null, 2) + '\n');
}

function isSubset(expected, actual) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.length === actual.length && expected.every((value, index) => isSubset(value, actual[index]));
  }
  if (expected && typeof expected === 'object') {
    return !!actual && typeof actual === 'object' && Object.entries(expected).every(([key, value]) => isSubset(value, actual[key]));
  }
  return isDeepStrictEqual(expected, actual);
}

async function run(input) {
  const { action, appType, formUuid, configFile, dryRun, expected } = parse(input);
  const config = configFile ? readConfig(configFile) : null;
  const client = createYidaClient();
  const authRef = client.getAuthRef();
  const meta = unwrapYidaResponse(await fetchFormSchemaInfo(authRef, appType, formUuid), { action: 'Read portal metadata' });
  if (meta.formType !== 'portal') {
    throw new CliError('The selected page must be a native portal.', { code: 'PORTAL_TYPE_REQUIRED' });
  }

  const path = '/alibaba/web/' + appType + '/_view/query/formdesign';
  const { schema, revision } = await readSchema(client, path, formUuid);
  const target = { appType, formUuid, revision };
  if (action === 'inspect') {
    report({ ...target, ...inspectPortal(schema) });
    return;
  }
  if (expected !== undefined && Number(expected) !== revision) {throw createServerRevisionConflict('portal');}

  const result = applyPortalConfig(schema, config, target);
  await verifyFormBindings(authRef, appType, result.tiles);
  if (dryRun || !result.changed) {
    report({ ...target, dryRun, changed: result.changed, readbackVerified: !result.changed, tiles: result.tiles });
    return;
  }

  const content = { ...result.schema };
  delete content.gmtModified;
  delete content.status;
  delete content.i18nData;
  const response = await client.postFormOnce(path + '/saveFormSchema.json', ref => ({
    _csrf_token: ref.csrfToken,
    prefix: '_view',
    formUuid,
    gmtModified: revision,
    domainCode: DOMAIN_CODE,
    schemaVersion: SCHEMA_VERSION,
    content: JSON.stringify(content),
  }));
  if (isSaveFormSchemaRevisionConflict(response)) {throw createServerRevisionConflict('portal');}
  try {
    unwrapYidaResponse(response, { action: 'Save portal layout' });
  } catch (error) {
    throw new CliError(error.message, { code: 'PORTAL_SAVE_FAILED', details: { target } });
  }

  const readbackError = () => new CliError('Portal save was accepted but the tiles could not be verified. Inspect the same portal before retrying.', {
    code: 'PORTAL_READBACK_UNVERIFIED', details: { target, sideEffectState: 'applied', retrySafe: false },
  });
  let readback;
  try {
    readback = await readSchema(client, path, formUuid);
    const saved = new Map(inspectPortal(readback.schema).tiles.map(tile => [tile.fieldId, tile]));
    if (result.tiles.some(tile => !isSubset(tile, saved.get(tile.fieldId)))) {throw readbackError();}
  } catch {
    throw readbackError();
  }
  report({ ...target, revision: readback.revision, changed: true, readbackVerified: true, tiles: result.tiles });
}

module.exports = { run };
