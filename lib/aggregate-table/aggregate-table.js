'use strict';

const fs = require('fs');
const querystring = require('querystring');

const { createAuthRef: createCoreAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { buildYidaTitleI18n, normalizeYidaLocale, resolveContentLocale } = require('../core/yida-i18n');
const { parseOpenOption, withBrowserHandoff } = require('../core/browser-handoff');
const { fetchFormPageList, resolveLocalizedText } = require('../app/form-navigation');

const FORM_TYPE_VIRTUAL_VIEW = 'virtualView';
const DESIGN_KEYS = [
  'relationForms',
  'relationships',
  'aggregatedFields',
  'auxFields',
  'formulaFields',
  'validators',
];

function hasHelpFlag(args) {
  return (args || []).includes('--help') || (args || []).includes('-h');
}

function printUsage() {
  process.stderr.write([
    t('aggregate_table.usage'),
    '',
    t('aggregate_table.commands_title'),
    `  ${t('aggregate_table.cmd_list')}`,
    `  ${t('aggregate_table.cmd_create_empty')}`,
    `  ${t('aggregate_table.cmd_inspect')}`,
    `  ${t('aggregate_table.cmd_preview')}`,
    `  ${t('aggregate_table.cmd_save')}`,
    `  ${t('aggregate_table.cmd_publish')}`,
    `  ${t('aggregate_table.cmd_status')}`,
    '',
    t('aggregate_table.examples_title'),
    `  ${t('aggregate_table.example_list')}`,
    `  ${t('aggregate_table.example_create_empty')}`,
    `  ${t('aggregate_table.example_inspect')}`,
    '',
  ].join('\n'));
}

function parseFlags(args) {
  const openOption = parseOpenOption(args || []);
  const positional = [];
  const flags = {
    json: false,
    keyword: '',
    locale: null,
  };

  for (let index = 0; index < openOption.args.length; index++) {
    const arg = openOption.args[index];
    if (arg === '--json') {
      flags.json = true;
      continue;
    }
    if (arg === '--keyword' && openOption.args[index + 1]) {
      flags.keyword = openOption.args[++index];
      continue;
    }
    if ((arg === '--locale' || arg === '--content-locale' || arg === '--lang') && openOption.args[index + 1]) {
      const locale = openOption.args[++index];
      if (!normalizeYidaLocale(locale)) {
        throw new Error(t('aggregate_table.unsupported_locale', locale));
      }
      flags.locale = locale;
      continue;
    }
    positional.push(arg);
  }

  flags.openMode = openOption.mode;
  return { positional, flags };
}

function unwrapContent(result) {
  if (result && Object.prototype.hasOwnProperty.call(result, 'content')) {
    return result.content;
  }
  return result;
}

function assertSuccess(result, action) {
  if (!result || result.success === false || result.__needLogin) {
    const message = result
      ? result.errorMsg || result.error || result.message || t('common.unknown_error')
      : t('common.request_failed');
    throw new Error(`${action}: ${message}`);
  }
  return unwrapContent(result);
}

async function createAuthRef() {
  const authRef = createCoreAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new Error(t('aggregate_table.no_login'));
  }
  return authRef;
}

function buildCreateEmptyPostData(title) {
  return querystring.stringify({
    formType: 'receipt',
    isVirtualView: 'y',
    title: JSON.stringify(buildYidaTitleI18n(title, {
      en_US: title,
      ja_JP: title,
    })),
  });
}

function buildDesignPostData(formUuid, designInfo, gmtModified) {
  const payload = {
    formUuid,
    designInfo: JSON.stringify(designInfo),
  };
  if (gmtModified !== undefined) {
    payload.gmtModified = gmtModified === null ? '' : gmtModified;
  }
  return querystring.stringify(payload);
}

async function checkVirtualViewFeature(authRef, appType) {
  return createYidaClient({ authRef }).postForm(
    `/dingtalk/web/${appType}/query/virtualview/show.json`,
    {}
  );
}

async function createEmptyVirtualView(authRef, appType, title) {
  return createYidaClient({ authRef }).postForm(
    `/dingtalk/web/${appType}/query/formdesign/saveFormSchemaInfo.json`,
    buildCreateEmptyPostData(title)
  );
}

async function getVirtualViewConfig(authRef, appType, formUuid) {
  return createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/query/virtualview/get.json`,
    { formUuid }
  );
}

async function postVirtualViewDesign(authRef, appType, formUuid, designInfo, action, gmtModified) {
  const endpointMap = {
    preview: 'preview.json',
    save: 'saveStashConfig.json',
    publish: 'update.json',
  };
  const endpoint = endpointMap[action];
  if (!endpoint) {
    throw new Error(`Unknown aggregate table action: ${action}`);
  }

  return createYidaClient({ authRef }).postForm(
    `/alibaba/web/${appType}/query/virtualview/${endpoint}`,
    buildDesignPostData(formUuid, designInfo, gmtModified)
  );
}

async function queryBuildState(authRef, appType, formUuid) {
  return createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/query/virtualview/queryBuildState.json`,
    { formUuid }
  );
}

function isVirtualViewNode(node) {
  return node && node.formType === FORM_TYPE_VIRTUAL_VIEW;
}

function filterAggregateTables(items, keyword) {
  const aggregateTables = (items || []).filter(isVirtualViewNode);
  if (!keyword) {
    return aggregateTables;
  }
  const normalized = String(keyword).toLowerCase();
  return aggregateTables.filter((item) => {
    return [item.formName, item.formUuid, item.pathName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized));
  });
}

function normalizeAggregateTableNode(node) {
  return {
    formUuid: node.formUuid,
    aggregateTableId: node.formUuid,
    name: node.formName || '',
    formType: FORM_TYPE_VIRTUAL_VIEW,
    pathName: node.pathName || '',
  };
}

function readJsonInput(input) {
  if (!input) {
    throw new Error(t('aggregate_table.design_required'));
  }

  let raw = input;
  if (fs.existsSync(input)) {
    raw = fs.readFileSync(input, 'utf8');
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(t('aggregate_table.invalid_json', err.message));
  }
}

function normalizeDesignConfig(rawConfig, formUuid) {
  let config = rawConfig;

  if (config && typeof config.designInfo === 'string') {
    config = JSON.parse(config.designInfo);
  } else if (config && config.designInfo && typeof config.designInfo === 'object') {
    config = config.designInfo;
  } else if (config && config.viewDesignConfig) {
    config = config.viewDesignConfig;
  } else if (config && Object.prototype.hasOwnProperty.call(config, 'content')) {
    config = config.content && config.content.viewDesignConfig
      ? config.content.viewDesignConfig
      : config.content;
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(t('aggregate_table.design_object_required'));
  }

  const normalized = { formUuid };
  for (const key of DESIGN_KEYS) {
    normalized[key] = Array.isArray(config[key]) ? config[key] : [];
  }
  return normalized;
}

function summarizeDesignConfig(config) {
  const safeConfig = config || {};
  return {
    formUuid: safeConfig.formUuid || '',
    title: resolveLocalizedText(safeConfig.title, ''),
    isStashConfig: safeConfig.isStashConfig || '',
    gmtModified: safeConfig.gmtModified || null,
    stashGmtModified: safeConfig.stashGmtModified || null,
    counts: {
      relationForms: Array.isArray(safeConfig.relationForms) ? safeConfig.relationForms.length : 0,
      relationships: Array.isArray(safeConfig.relationships) ? safeConfig.relationships.length : 0,
      aggregatedFields: Array.isArray(safeConfig.aggregatedFields) ? safeConfig.aggregatedFields.length : 0,
      auxFields: Array.isArray(safeConfig.auxFields) ? safeConfig.auxFields.length : 0,
      formulaFields: Array.isArray(safeConfig.formulaFields) ? safeConfig.formulaFields.length : 0,
      validators: Array.isArray(safeConfig.validators) ? safeConfig.validators.length : 0,
    },
  };
}

function buildDesignUrl(baseUrl, appType, formUuid, options = {}) {
  const suffix = options.fromNew ? '&fromNew=true' : '';
  return `${baseUrl}/alibaba/web/${appType}/design/virtualViewDesigner.html?formUuid=${formUuid}${suffix}`;
}

function buildWorkbenchUrl(baseUrl, appType, formUuid) {
  return `${baseUrl}/${appType}/workbench/${formUuid}`;
}

function printSummary(title, rows) {
  const { result } = require('../core/chalk');
  result(true, title, rows);
}

async function runList(args) {
  const { positional, flags } = parseFlags(args);
  const appType = positional[0];
  if (!appType) {
    const { error } = require('../core/chalk');
    error(t('aggregate_table.list_usage'), { hint: t('aggregate_table.example_list') });
    return;
  }

  const authRef = await createAuthRef();
  const items = await fetchFormPageList(appType, authRef);
  const aggregateTables = filterAggregateTables(items, flags.keyword).map(normalizeAggregateTableNode);

  if (!flags.json) {
    printSummary(t('aggregate_table.list_success'), [
      ['App', appType],
      ['Count', String(aggregateTables.length)],
    ]);
  }

  console.log(JSON.stringify(aggregateTables, null, 2));
}

async function runCreateEmpty(args) {
  const { positional, flags } = parseFlags(args);
  const appType = positional[0];
  const name = positional[1];
  if (!appType || !name) {
    const { error } = require('../core/chalk');
    error(t('aggregate_table.create_empty_usage'), { hint: t('aggregate_table.example_create_empty') });
    return;
  }

  const authRef = await createAuthRef();
  const contentLocale = resolveContentLocale({ locale: flags.locale, baseUrl: authRef.baseUrl });

  const featureResult = await checkVirtualViewFeature(authRef, appType);
  const featureEnabled = assertSuccess(featureResult, t('aggregate_table.check_feature'));
  if (featureEnabled !== true) {
    throw new Error(t('aggregate_table.feature_disabled'));
  }

  const createResult = await createEmptyVirtualView(authRef, appType, name);
  const created = assertSuccess(createResult, t('aggregate_table.create_empty'));
  const formUuid = (created && created.formUuid) || created;
  const designUrl = buildDesignUrl(authRef.baseUrl, appType, formUuid, { fromNew: true });
  const workbenchUrl = buildWorkbenchUrl(authRef.baseUrl, appType, formUuid);

  printSummary(t('aggregate_table.create_empty_success'), [
    ['App', appType],
    ['Aggregate Table ID', formUuid],
    ['Locale', contentLocale],
    ['Design URL', designUrl],
  ]);

  console.log(JSON.stringify(withBrowserHandoff({
    success: true,
    appType,
    aggregateTableId: formUuid,
    formUuid,
    name,
    formType: FORM_TYPE_VIRTUAL_VIEW,
    locale: contentLocale,
    designUrl,
    workbenchUrl,
  }, designUrl, { stage: 'aggregate_table_create_empty_success', title: name }, flags.openMode)));
}

async function runInspect(args) {
  const { positional, flags } = parseFlags(args);
  const appType = positional[0];
  const formUuid = positional[1];
  if (!appType || !formUuid) {
    const { error } = require('../core/chalk');
    error(t('aggregate_table.inspect_usage'), { hint: t('aggregate_table.example_inspect') });
    return;
  }

  const authRef = await createAuthRef();
  const result = await getVirtualViewConfig(authRef, appType, formUuid);
  const config = assertSuccess(result, t('aggregate_table.inspect'));
  const summary = summarizeDesignConfig(config);

  if (!flags.json) {
    printSummary(t('aggregate_table.inspect_success'), [
      ['App', appType],
      ['Aggregate Table ID', formUuid],
      ['Data Sources', String(summary.counts.relationForms)],
      ['Relationships', String(summary.counts.relationships)],
      ['Metrics', String(summary.counts.formulaFields)],
      ['Validators', String(summary.counts.validators)],
    ]);
  }

  console.log(JSON.stringify({
    success: true,
    appType,
    aggregateTableId: formUuid,
    formUuid,
    summary,
    config,
  }, null, 2));
}

async function loadDesignForMutation(authRef, appType, formUuid, input, action) {
  const rawConfig = readJsonInput(input);
  const designInfo = normalizeDesignConfig(rawConfig, formUuid);
  const currentResult = await getVirtualViewConfig(authRef, appType, formUuid);
  const currentConfig = assertSuccess(currentResult, t('aggregate_table.inspect'));
  const gmtModified = action === 'save'
    ? currentConfig.stashGmtModified
    : currentConfig.gmtModified;
  return { designInfo, currentConfig, gmtModified };
}

async function runPreview(args) {
  const { positional, flags } = parseFlags(args);
  const appType = positional[0];
  const formUuid = positional[1];
  const input = positional[2];
  if (!appType || !formUuid || !input) {
    const { error } = require('../core/chalk');
    error(t('aggregate_table.preview_usage'), { hint: t('aggregate_table.example_preview') });
    return;
  }

  const authRef = await createAuthRef();
  const designInfo = normalizeDesignConfig(readJsonInput(input), formUuid);
  const result = await postVirtualViewDesign(authRef, appType, formUuid, designInfo, 'preview');
  const rows = assertSuccess(result, t('aggregate_table.preview'));
  const rowCount = Array.isArray(rows) ? rows.length : 0;

  if (!flags.json) {
    printSummary(t('aggregate_table.preview_success'), [
      ['App', appType],
      ['Aggregate Table ID', formUuid],
      ['Rows', String(rowCount)],
    ]);
  }

  console.log(JSON.stringify({
    success: true,
    appType,
    aggregateTableId: formUuid,
    formUuid,
    rowCount,
    rows,
  }, null, 2));
}

async function runSaveOrPublish(args, action) {
  const { positional, flags } = parseFlags(args);
  const appType = positional[0];
  const formUuid = positional[1];
  const input = positional[2];
  const isPublish = action === 'publish';
  if (!appType || !formUuid || !input) {
    const { error } = require('../core/chalk');
    error(
      isPublish ? t('aggregate_table.publish_usage') : t('aggregate_table.save_usage'),
      { hint: isPublish ? t('aggregate_table.example_publish') : t('aggregate_table.example_save') }
    );
    return;
  }

  const authRef = await createAuthRef();
  const { designInfo, gmtModified } = await loadDesignForMutation(authRef, appType, formUuid, input, action);
  if (isPublish && designInfo.relationForms.length === 0) {
    throw new Error(t('aggregate_table.publish_requires_source'));
  }

  const result = await postVirtualViewDesign(authRef, appType, formUuid, designInfo, action, gmtModified);
  const content = assertSuccess(result, isPublish ? t('aggregate_table.publish') : t('aggregate_table.save'));
  const designUrl = buildDesignUrl(authRef.baseUrl, appType, formUuid);
  const workbenchUrl = buildWorkbenchUrl(authRef.baseUrl, appType, formUuid);

  if (!flags.json) {
    printSummary(isPublish ? t('aggregate_table.publish_success') : t('aggregate_table.save_success'), [
      ['App', appType],
      ['Aggregate Table ID', formUuid],
      ['Design URL', designUrl],
    ]);
  }

  console.log(JSON.stringify(withBrowserHandoff({
    success: true,
    action,
    appType,
    aggregateTableId: formUuid,
    formUuid,
    gmtModified: content && content.gmtModified,
    response: content,
    designUrl,
    workbenchUrl,
  }, designUrl, { stage: `aggregate_table_${action}_success`, title: formUuid }, flags.openMode), null, 2));
}

async function runStatus(args) {
  const { positional, flags } = parseFlags(args);
  const appType = positional[0];
  const formUuid = positional[1];
  if (!appType || !formUuid) {
    const { error } = require('../core/chalk');
    error(t('aggregate_table.status_usage'), { hint: t('aggregate_table.example_status') });
    return;
  }

  const authRef = await createAuthRef();
  const result = await queryBuildState(authRef, appType, formUuid);
  const content = assertSuccess(result, t('aggregate_table.status'));

  if (!flags.json) {
    printSummary(t('aggregate_table.status_success'), [
      ['App', appType],
      ['Aggregate Table ID', formUuid],
      ['Status', (content && content.status) || String(content || '')],
    ]);
  }

  console.log(JSON.stringify({
    success: true,
    appType,
    aggregateTableId: formUuid,
    formUuid,
    status: content && content.status,
    result: content,
  }, null, 2));
}

async function run(args) {
  if (!args || args.length === 0 || hasHelpFlag(args)) {
    printUsage();
    return;
  }

  const subCommand = args[0];
  const subArgs = args.slice(1);
  switch (subCommand) {
    case 'list':
      return runList(subArgs);
    case 'create':
    case 'create-empty':
      return runCreateEmpty(subArgs);
    case 'inspect':
    case 'get':
      return runInspect(subArgs);
    case 'preview':
      return runPreview(subArgs);
    case 'save':
      return runSaveOrPublish(subArgs, 'save');
    case 'publish':
      return runSaveOrPublish(subArgs, 'publish');
    case 'status':
      return runStatus(subArgs);
    default: {
      const { error } = require('../core/chalk');
      error(t('aggregate_table.unknown_subcommand', subCommand), { hint: t('aggregate_table.usage') });
      return null;
    }
  }
}

module.exports = {
  DESIGN_KEYS,
  FORM_TYPE_VIRTUAL_VIEW,
  buildCreateEmptyPostData,
  buildDesignPostData,
  filterAggregateTables,
  normalizeAggregateTableNode,
  normalizeDesignConfig,
  parseFlags,
  readJsonInput,
  summarizeDesignConfig,
  run,
  __api__: {
    checkVirtualViewFeature,
    createEmptyVirtualView,
    getVirtualViewConfig,
    postVirtualViewDesign,
    queryBuildState,
  },
};
