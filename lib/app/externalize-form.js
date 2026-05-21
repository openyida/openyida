'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  requestWithAutoLogin,
} = require('../core/utils');

const FIELD_COMPONENT_NAMES = new Set([
  'TextField',
  'TextareaField',
  'SelectField',
  'DateField',
  'NumberField',
  'RadioField',
  'CheckboxField',
  'EmployeeField',
  'PhoneField',
  'EmailField',
  'CascadeSelectField',
  'ImageField',
  'AttachmentField',
  'TableField',
  'MultiSelectField',
  'DepartmentSelectField',
  'AssociationFormField',
  'CountrySelectField',
  'CitySelectField',
  'RateField',
  'SignatureField',
  'SerialNumberField',
  'AddressField',
]);

const PUBLIC_BLOCKED_TYPES = new Set([
  'AssociationFormField',
  'EmployeeField',
  'DepartmentSelectField',
]);

const REVIEW_TYPES = new Set([
  'AttachmentField',
  'ImageField',
  'SignatureField',
  'TableField',
  'CascadeSelectField',
  'CountrySelectField',
  'CitySelectField',
  'AddressField',
]);

const SAFE_CREATE_FORM_TYPES = new Set([
  'TextField',
  'TextareaField',
  'SelectField',
  'DateField',
  'NumberField',
  'RadioField',
  'CheckboxField',
  'PhoneField',
  'EmailField',
  'MultiSelectField',
  'RateField',
  'AttachmentField',
  'ImageField',
]);

function readOption(args, names, fallback = '') {
  const optionNames = Array.isArray(names) ? names : [names];
  for (const name of optionNames) {
    const index = args.indexOf(name);
    if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) {
      return args[index + 1];
    }
  }
  return fallback;
}

function parseArgs(args) {
  const parsed = {
    appType: '',
    formUuid: '',
    schemaFile: '',
    output: '',
    mirrorFieldsOutput: '',
    format: 'json',
    target: 'open',
    mirrorTitle: '',
    help: false,
  };
  const positional = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--schema-file' || arg === '--schema') {
      parsed.schemaFile = readOption(args, arg);
      index++;
    } else if (arg === '--output' || arg === '-o') {
      parsed.output = readOption(args, arg);
      index++;
    } else if (arg === '--mirror-fields-output' || arg === '--fields-output') {
      parsed.mirrorFieldsOutput = readOption(args, arg);
      index++;
    } else if (arg === '--format') {
      parsed.format = readOption(args, arg, 'json');
      index++;
    } else if (arg === '--target') {
      parsed.target = readOption(args, arg, 'open');
      index++;
    } else if (arg === '--mirror-title') {
      parsed.mirrorTitle = readOption(args, arg);
      index++;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  parsed.appType = positional[0] || '';
  parsed.formUuid = positional[1] || '';
  if (!['json', 'markdown'].includes(parsed.format)) {
    throw new Error(`Unsupported format: ${parsed.format}`);
  }
  if (!['open', 'share'].includes(parsed.target)) {
    throw new Error(`Unsupported target: ${parsed.target}`);
  }
  return parsed;
}

function printUsage() {
  const lines = [
    'Usage: openyida externalize-form <appType> <formUuid> [options]',
    '',
    'Options:',
    '  --schema-file <file>          Read a saved get-schema JSON file instead of fetching remotely',
    '  --output, -o <file>           Write the report to a file',
    '  --mirror-fields-output <file> Write external-safe create-form fields JSON',
    '  --format json|markdown        Output format, default: json',
    '  --target open|share           Access target, default: open',
    '  --mirror-title <title>        Title used in suggested create-form command',
    '',
    'Examples:',
    '  openyida externalize-form APP_XXX FORM-XXX --schema-file .cache/schema.json',
    '  openyida externalize-form APP_XXX FORM-XXX --mirror-fields-output .cache/external-fields.json',
  ];
  process.stderr.write(`${lines.join('\n')}\n`);
}

function extractText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    return extractText(
      value.zh_CN ||
      value.en_US ||
      value.ja_JP ||
      value.value ||
      value.text ||
      value.label ||
      value.name ||
      value.title ||
      ''
    );
  }
  return '';
}

function isRequired(props) {
  if (!props) {
    return false;
  }
  if (props.required === true) {
    return true;
  }
  const validation = Array.isArray(props.validation) ? props.validation : [];
  return validation.some(rule => rule && rule.type === 'required');
}

function getPages(schemaResult) {
  if (schemaResult && schemaResult.content && Array.isArray(schemaResult.content.pages)) {
    return schemaResult.content.pages;
  }
  if (schemaResult && Array.isArray(schemaResult.pages)) {
    return schemaResult.pages;
  }
  return [];
}

function collectFieldNodes(schemaResult) {
  const fields = [];
  const pages = getPages(schemaResult);

  function traverse(node, parents) {
    if (!node) {
      return;
    }
    const props = node.props || {};
    const label = extractText(props.label);
    const nextParents = FIELD_COMPONENT_NAMES.has(node.componentName) && label
      ? parents.concat(label)
      : parents;

    if (FIELD_COMPONENT_NAMES.has(node.componentName)) {
      fields.push({
        componentName: node.componentName,
        props,
        label,
        fieldId: props.fieldId || '',
        required: isRequired(props),
        behavior: props.behavior || '',
        path: nextParents.join(' > '),
      });
    }

    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach(child => traverse(child, nextParents));
  }

  pages.forEach((page) => {
    const roots = page && page.componentsTree ? page.componentsTree : [];
    roots.forEach(root => traverse(root, []));
  });

  return fields;
}

function getRisk(field, target) {
  if (target === 'share') {
    if (field.componentName === 'AssociationFormField') {
      return {
        level: 'review',
        reason: 'Association fields require internal form data permission and should be verified for org-share scenarios.',
      };
    }
    return { level: 'safe', reason: 'Internal share keeps the visitor inside the organization permission boundary.' };
  }

  if (PUBLIC_BLOCKED_TYPES.has(field.componentName)) {
    return {
      level: 'blocked',
      reason: `${field.componentName} depends on authenticated organization data and is not reliable for anonymous public access.`,
    };
  }
  if (REVIEW_TYPES.has(field.componentName)) {
    return {
      level: 'review',
      reason: `${field.componentName} may need a browser verification or a simpler external intake field.`,
    };
  }
  return { level: 'safe', reason: 'Primitive input field, suitable for external intake.' };
}

function associationTarget(props) {
  const associationForm = props && props.associationForm ? props.associationForm : {};
  return {
    appType: associationForm.appType || '',
    formUuid: associationForm.formUuid || '',
    formTitle: associationForm.formTitle || '',
    mainFieldId: associationForm.mainFieldId || '',
    mainFieldLabel: extractText(associationForm.mainFieldLabel),
  };
}

function planField(field, target) {
  const risk = getRisk(field, target);
  const plan = {
    label: field.label || field.fieldId || field.componentName,
    fieldId: field.fieldId,
    componentName: field.componentName,
    required: field.required,
    behavior: field.behavior,
    path: field.path,
    riskLevel: risk.level,
    reason: risk.reason,
    externalStrategy: 'keep',
  };

  if (field.componentName === 'AssociationFormField') {
    plan.associationTarget = associationTarget(field.props);
    plan.externalStrategy = 'snapshot-and-resolve-internal';
  } else if (field.componentName === 'EmployeeField') {
    plan.externalStrategy = 'collect-name-or-contact';
  } else if (field.componentName === 'DepartmentSelectField') {
    plan.externalStrategy = 'collect-department-text';
  } else if (risk.level === 'review') {
    plan.externalStrategy = 'verify-or-simplify';
  }
  return plan;
}

function mirrorLabel(label, suffix) {
  if (!label) {
    return suffix;
  }
  return `${label}${suffix}`;
}

function associationSnapshotLabel(plan) {
  const target = plan.associationTarget || {};
  const targetMainLabel = target.mainFieldLabel || '';
  if (targetMainLabel) {
    return targetMainLabel;
  }
  if (plan.label && plan.label.endsWith('名称')) {
    return plan.label;
  }
  return mirrorLabel(plan.label, '名称');
}

function mirrorFieldForPlan(plan) {
  const base = {
    label: plan.label,
    required: plan.required,
    sourceFieldId: plan.fieldId,
    sourceComponentName: plan.componentName,
    sourceStrategy: plan.externalStrategy,
  };

  if (plan.componentName === 'AssociationFormField') {
    const target = plan.associationTarget || {};
    return [
      {
        type: 'TextField',
        label: associationSnapshotLabel(plan),
        required: plan.required,
        sourceFieldId: plan.fieldId,
        sourceComponentName: plan.componentName,
        sourceStrategy: 'association-main-field-snapshot',
        targetFormUuid: target.formUuid,
        targetMainFieldId: target.mainFieldId,
      },
      {
        type: 'TextField',
        label: mirrorLabel(plan.label, '业务标识'),
        required: false,
        sourceFieldId: plan.fieldId,
        sourceComponentName: plan.componentName,
        sourceStrategy: 'association-business-key-for-internal-resolution',
        targetFormUuid: target.formUuid,
      },
    ];
  }

  if (plan.componentName === 'EmployeeField') {
    return [
      { ...base, type: 'TextField', label: mirrorLabel(plan.label, '姓名') },
      { ...base, type: 'TextField', label: mirrorLabel(plan.label, '联系方式'), required: false },
    ];
  }

  if (plan.componentName === 'DepartmentSelectField') {
    return [{ ...base, type: 'TextField', label: mirrorLabel(plan.label, '名称') }];
  }

  if (SAFE_CREATE_FORM_TYPES.has(plan.componentName)) {
    return [{ ...base, type: plan.componentName }];
  }

  if (plan.componentName === 'SerialNumberField') {
    return [];
  }

  return [{ ...base, type: 'TextareaField', label: mirrorLabel(plan.label, '说明'), required: false }];
}

function buildMirrorFields(fields) {
  const mirrorFields = [];
  fields.forEach((field) => {
    mirrorFields.push(...mirrorFieldForPlan(field));
  });
  return mirrorFields;
}

function summarize(fields) {
  const summary = {
    totalFields: fields.length,
    safeFields: 0,
    reviewFields: 0,
    blockedFields: 0,
    associationFields: 0,
    authBoundFields: 0,
  };

  fields.forEach((field) => {
    if (field.riskLevel === 'safe') {
      summary.safeFields++;
    } else if (field.riskLevel === 'review') {
      summary.reviewFields++;
    } else if (field.riskLevel === 'blocked') {
      summary.blockedFields++;
    }
    if (field.componentName === 'AssociationFormField') {
      summary.associationFields++;
    }
    if (PUBLIC_BLOCKED_TYPES.has(field.componentName)) {
      summary.authBoundFields++;
    }
  });
  return summary;
}

function buildRecommendedActions(parsed, report) {
  const actions = [
    'Create a separate external intake form from mirrorFields instead of exposing the internal form directly.',
    'Keep association fields in the internal form and resolve them after submission by business key or manual review.',
    'Copy human-readable snapshots into the external form so public visitors never need target-form permissions.',
  ];

  if (parsed.mirrorFieldsOutput) {
    const title = parsed.mirrorTitle || `${report.formTitle || 'External Intake'} External`;
    actions.unshift(
      `Create mirror form: openyida create-form create ${parsed.appType} "${title}" ${parsed.mirrorFieldsOutput}`
    );
  }

  if (report.summary.blockedFields === 0 && report.summary.reviewFields === 0) {
    actions.unshift('No blocked fields were found; public access can still be verified with save-share-config and Chrome.');
  }
  return actions;
}

function inferFormTitle(schemaResult, formUuid) {
  const content = schemaResult && schemaResult.content ? schemaResult.content : schemaResult;
  return extractText(
    content && (
      content.formName ||
      content.formTitle ||
      content.title ||
      content.name
    )
  ) || formUuid;
}

function analyzeSchema(schemaResult, options = {}) {
  const target = options.target || 'open';
  const fields = collectFieldNodes(schemaResult).map(field => planField(field, target));
  const report = {
    success: true,
    appType: options.appType || '',
    formUuid: options.formUuid || '',
    formTitle: inferFormTitle(schemaResult, options.formUuid || ''),
    target,
    source: options.source || 'schema',
    summary: summarize(fields),
    fields,
    mirrorFields: buildMirrorFields(fields),
    recommendedActions: [],
    notes: [
      'OpenYida cannot relax Yida platform permission boundaries for anonymous visitors.',
      'This plan keeps internal association fields private and generates external-safe snapshot fields.',
      'For fully automated sync, add an internal automation or API worker that resolves submitted business keys.',
    ],
  };
  report.recommendedActions = buildRecommendedActions(options, report);
  return report;
}

function renderMarkdown(report) {
  const lines = [
    `# External Access Plan: ${report.formTitle || report.formUuid}`,
    '',
    `- App: ${report.appType || '-'}`,
    `- Form: ${report.formUuid || '-'}`,
    `- Target: ${report.target}`,
    `- Total fields: ${report.summary.totalFields}`,
    `- Blocked fields: ${report.summary.blockedFields}`,
    `- Review fields: ${report.summary.reviewFields}`,
    '',
    '## Fields',
    '',
    '| Label | Type | Risk | Strategy | Reason |',
    '| --- | --- | --- | --- | --- |',
  ];

  report.fields.forEach((field) => {
    lines.push(
      `| ${field.label || '-'} | ${field.componentName} | ${field.riskLevel} | ${field.externalStrategy} | ${field.reason} |`
    );
  });

  lines.push('', '## Recommended Actions', '');
  report.recommendedActions.forEach(action => lines.push(`- ${action}`));
  lines.push('', '## Mirror Fields', '', '```json');
  lines.push(JSON.stringify(report.mirrorFields, null, 2));
  lines.push('```', '');
  return lines.join('\n');
}

function writeJson(filePath, data) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2), 'utf-8');
  return resolved;
}

function writeText(filePath, text) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, text, 'utf-8');
  return resolved;
}

function resolveOutputPath(filePath) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function loadSchemaFile(filePath) {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
  return JSON.parse(raw);
}

function createAuthRef() {
  let cookieData = loadCookieData();
  if (!cookieData) {
    cookieData = triggerLogin();
  }
  return {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
}

async function fetchSchema(appType, formUuid, authRef) {
  return requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json`,
      { formUuid, schemaVersion: 'V5' },
      auth.cookies
    );
  }, authRef);
}

function ensureSuccessfulSchema(result) {
  if (!result || result.success === false || result.__needLogin || result.__csrfExpired) {
    const message = result && (result.errorMsg || result.message)
      ? result.errorMsg || result.message
      : 'Failed to fetch form schema';
    throw new Error(message);
  }
}

async function loadSchema(parsed) {
  if (parsed.schemaFile) {
    return {
      schema: loadSchemaFile(parsed.schemaFile),
      source: path.resolve(parsed.schemaFile),
    };
  }
  const authRef = createAuthRef();
  const schema = await fetchSchema(parsed.appType, parsed.formUuid, authRef);
  ensureSuccessfulSchema(schema);
  return { schema, source: 'remote' };
}

async function run(args) {
  let parsed;
  try {
    parsed = parseArgs(args || []);
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exit(1);
  }

  if (parsed.help) {
    printUsage();
    return;
  }
  if (!parsed.appType || !parsed.formUuid) {
    printUsage();
    process.exit(1);
  }

  try {
    const loaded = await loadSchema(parsed);
    const report = analyzeSchema(loaded.schema, {
      ...parsed,
      source: loaded.source,
    });
    const files = {};

    if (parsed.mirrorFieldsOutput) {
      files.mirrorFields = writeJson(parsed.mirrorFieldsOutput, report.mirrorFields);
    }
    if (parsed.output) {
      files.report = resolveOutputPath(parsed.output);
    }
    report.files = files;
    if (parsed.output) {
      if (parsed.format === 'markdown') {
        writeText(files.report, renderMarkdown(report));
      } else {
        writeJson(files.report, report);
      }
    }

    const finalOutput = parsed.format === 'markdown'
      ? renderMarkdown(report)
      : JSON.stringify(report, null, 2);
    console.log(finalOutput);
  } catch (error) {
    console.error(`externalize-form failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  collectFieldNodes,
  analyzeSchema,
  renderMarkdown,
  run,
  _private: {
    extractText,
    isRequired,
    planField,
    buildMirrorFields,
    summarize,
  },
};
