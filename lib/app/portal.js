'use strict';

const fs = require('node:fs');
const { isDeepStrictEqual, parseArgs } = require('node:util');
const { CliError } = require('../core/cli-error');
const { createYidaClient, unwrapYidaResponse } = require('../core/yida-client');
const { createServerRevisionConflict, isSaveFormSchemaRevisionConflict, requireSchemaServerRevision } = require('../core/server-revision');
const { fetchFormSchemaInfo } = require('./get-form-config');
const { applyPortalConfig, inspectPortal, portalCatalog, editablePortalConfig } = require('./portal-schema');

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
        editable: { type: 'boolean' },
        'expected-revision': { type: 'string' },
      },
    });
  } catch (error) {
    throw new CliError(error.message, { code: 'PORTAL_USAGE' });
  }
  const [action, appType, formUuid, configFile] = args.positionals;
  const { editable, 'dry-run': dryRun, 'expected-revision': expectedRevision } = args.values;
  if (action === 'catalog' && args.positionals.length <= 2 && !editable && !dryRun && expectedRevision === undefined) {
    return { action, componentName: appType };
  }
  const inspect = action === 'inspect' && args.positionals.length === 3 && !dryRun && expectedRevision === undefined;
  const configure = action === 'configure' && args.positionals.length === 4 && !editable;
  if ((!inspect && !configure) || !/^APP_[A-Za-z0-9]+$/.test(appType || '') || !/^FORM-[A-Za-z0-9]+$/.test(formUuid || '')) {
    throw new CliError('Usage: portal catalog [componentName], portal inspect <appType> <formUuid> [--editable], or portal configure <appType> <formUuid> <file> --expected-revision <revision> [--dry-run]', { code: 'PORTAL_USAGE' });
  }
  const expected = expectedRevision;
  if (configure && ((!dryRun && expected === undefined) || (expected !== undefined && !/^\d+$/.test(expected)))) {
    throw new CliError('Read the portal first and pass its revision with --expected-revision.', { code: 'PORTAL_REVISION_REQUIRED' });
  }
  return { action, appType, formUuid, configFile, dryRun: dryRun === true, expected, editable };
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
  if (input.includes('--help') || input.includes('-h')) {
    const { COMMAND_GROUPS } = require('../core/command-manifest');
    const action = input.find(arg => !arg.startsWith('-'));
    for (const command of COMMAND_GROUPS.flatMap(group => group.commands)) {
      if (command.path[0] === 'portal' && (!action || command.path[1] === action)) {
        process.stdout.write('openyida ' + command.usage + '\n');
      }
    }
    return;
  }
  const { action, appType, formUuid, configFile, dryRun, expected, editable, componentName } = parse(input);
  if (action === 'catalog') {
    report(portalCatalog(componentName));
    return;
  }
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
    const inspection = inspectPortal(schema);
    report({ ...target, ...inspection, ...(editable ? editablePortalConfig(inspection) : {}) });
    return;
  }
  if (expected !== undefined && Number(expected) !== revision) {throw createServerRevisionConflict('portal');}

  const result = applyPortalConfig(schema, config, target);
  await verifyFormBindings(authRef, appType, result.tiles);
  if (dryRun || !result.changed) {
    report({ ...target, dryRun, changed: result.changed, readbackVerified: !result.changed, tiles: result.tiles, themePatch: result.theme, mobileLayout: result.mobileLayout });
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

  const readbackError = () => new CliError('Portal save was accepted but the configuration could not be verified. Inspect the same portal before retrying.', {
    code: 'PORTAL_READBACK_UNVERIFIED', details: { target, sideEffectState: 'applied', retrySafe: false },
  });
  let readback;
  try {
    readback = await readSchema(client, path, formUuid);
    const inspection = inspectPortal(readback.schema);
    const saved = new Map(inspection.tiles.map(tile => [tile.fieldId, tile]));
    // An empty image object disables the background. It must not match a saved image URL.
    const expectedImage = result.theme.topPcImg;
    const imageDisabled = expectedImage && !Object.keys(expectedImage).length;
    if (result.tiles.some(tile => !isSubset(tile, saved.get(tile.fieldId))) ||
        (Object.keys(result.theme).length && !isSubset(result.theme, inspection.theme)) ||
        (imageDisabled && !isDeepStrictEqual(inspection.theme?.topPcImg, expectedImage)) ||
        (result.mobileLayout && !isDeepStrictEqual(result.mobileLayout, inspection.mobileLayout))) {throw readbackError();}
  } catch {
    throw readbackError();
  }
  report({ ...target, revision: readback.revision, changed: true, readbackVerified: true, tiles: result.tiles, themePatch: result.theme, mobileLayout: result.mobileLayout });
}

module.exports = { run };
