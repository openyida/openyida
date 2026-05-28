'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
} = require('../core/utils');
const { t } = require('../core/i18n');
const { fetchFormPageList } = require('./form-navigation');
const {
  buildComponentAliasMaps,
  fetchSchemaRecord,
  filterForms,
  mapLimit,
} = require('./get-schema');

const FIELD_KIND_BY_COMPONENT = {
  TextField: 'string',
  TextareaField: 'text',
  SelectField: 'enum',
  MultiSelectField: 'enum[]',
  RadioField: 'enum',
  CheckboxField: 'enum[]',
  NumberField: 'number',
  RateField: 'number',
  DateField: 'datetime',
  CascadeDateField: 'datetime',
  PhoneField: 'phone',
  EmailField: 'email',
  EmployeeField: 'user',
  DepartmentSelectField: 'department',
  CountrySelectField: 'country',
  CitySelectField: 'city',
  CascadeSelectField: 'cascade',
  AddressField: 'address',
  ImageField: 'image',
  AttachmentField: 'attachment',
  SignatureField: 'signature',
  SerialNumberField: 'serial',
  AssociationFormField: 'relation',
  TableField: 'subtable',
};

const SYSTEM_ENTITIES = [
  {
    id: 'SystemUser',
    name: 'User',
    type: 'system',
    formUuid: 'SystemUser',
    formType: 'system',
    fields: [
      { name: 'userId', fieldId: 'userId', type: 'string', componentName: 'SystemField', label: 'userId' },
      { name: 'name', fieldId: 'name', type: 'string', componentName: 'SystemField', label: 'name' },
      { name: 'deptId', fieldId: 'deptId', type: 'string', componentName: 'SystemField', label: 'deptId' },
      { name: 'roleIds', fieldId: 'roleIds', type: 'string[]', componentName: 'SystemField', label: 'roleIds' },
    ],
  },
  {
    id: 'SystemDepartment',
    name: 'Department',
    type: 'system',
    formUuid: 'SystemDepartment',
    formType: 'system',
    fields: [
      { name: 'deptId', fieldId: 'deptId', type: 'string', componentName: 'SystemField', label: 'deptId' },
      { name: 'name', fieldId: 'name', type: 'string', componentName: 'SystemField', label: 'name' },
      { name: 'parentId', fieldId: 'parentId', type: 'string', componentName: 'SystemField', label: 'parentId' },
      { name: 'orgId', fieldId: 'orgId', type: 'string', componentName: 'SystemField', label: 'orgId' },
    ],
  },
  {
    id: 'SystemRole',
    name: 'Role',
    type: 'system',
    formUuid: 'SystemRole',
    formType: 'system',
    fields: [
      { name: 'roleId', fieldId: 'roleId', type: 'string', componentName: 'SystemField', label: 'roleId' },
      { name: 'name', fieldId: 'name', type: 'string', componentName: 'SystemField', label: 'name' },
      { name: 'orgId', fieldId: 'orgId', type: 'string', componentName: 'SystemField', label: 'orgId' },
    ],
  },
  {
    id: 'SystemOrganization',
    name: 'Organization',
    type: 'system',
    formUuid: 'SystemOrganization',
    formType: 'system',
    fields: [
      { name: 'orgId', fieldId: 'orgId', type: 'string', componentName: 'SystemField', label: 'orgId' },
      { name: 'name', fieldId: 'name', type: 'string', componentName: 'SystemField', label: 'name' },
    ],
  },
];

function parseArgs(args) {
  const parsed = {
    appType: '',
    format: 'mermaid',
    output: '',
    includeSystem: false,
    includePages: false,
    keyword: '',
    concurrency: 3,
    retries: 1,
    json: false,
    help: false,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if ((arg === '--format' || arg === '-f') && args[index + 1]) {
      parsed.format = args[index + 1].toLowerCase();
      index++;
    } else if ((arg === '--output' || arg === '-o') && args[index + 1]) {
      parsed.output = args[index + 1];
      index++;
    } else if (arg === '--include-system') {
      parsed.includeSystem = true;
    } else if (arg === '--include-pages') {
      parsed.includePages = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--keyword' && args[index + 1]) {
      parsed.keyword = args[index + 1];
      index++;
    } else if ((arg === '--concurrency' || arg === '--parallel') && args[index + 1]) {
      parsed.concurrency = parsePositiveInt(args[index + 1], 3, 1, 10);
      index++;
    } else if ((arg === '--retries' || arg === '--retry') && args[index + 1]) {
      parsed.retries = parsePositiveInt(args[index + 1], 1, 0, 5);
      index++;
    } else if (arg === '--json') {
      parsed.format = 'json';
      parsed.json = true;
    } else if (!arg.startsWith('-') && !parsed.appType) {
      parsed.appType = arg;
    }
  }

  if (parsed.format === 'mmd') {
    parsed.format = 'mermaid';
  }

  return parsed;
}

function parsePositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function filterErSourceForms(forms, options = {}) {
  const filtered = filterForms(forms, options.keyword || '');
  if (options.includePages) {
    return filtered;
  }
  return filtered.filter((form) => String(form?.formType || '').toLowerCase() !== 'display');
}

function normalizeText(value, fallback = '') {
  if (!value) {
    return fallback;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    return value.zh_CN || value.en_US || value.zh_TW || value.zh_HK || value.ja_JP || Object.values(value).find(item => typeof item === 'string') || fallback;
  }
  return String(value);
}

function sanitizeEntityId(value) {
  const raw = String(value || 'Entity').replace(/[^A-Za-z0-9_]/g, '_');
  const compact = raw.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!compact) {
    return 'Entity';
  }
  return /^[A-Za-z_]/.test(compact) ? compact : `E_${compact}`;
}

function sanitizeFieldName(value, fallback) {
  const raw = String(value || fallback || 'field').trim() || 'field';
  const normalized = raw.replace(/\s+/g, '_').replace(/[^\w\u4e00-\u9fa5]/g, '_').replace(/_+/g, '_');
  return normalized.replace(/^_+|_+$/g, '') || fallback || 'field';
}

function fieldTypeFor(componentName) {
  return FIELD_KIND_BY_COMPONENT[componentName] || String(componentName || 'field');
}

function dedupeByKey(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getAssociationTarget(props) {
  const associationForm = props.associationForm || {};
  return {
    appType: associationForm.appType || props.appType || '',
    formUuid: associationForm.formUuid || props.formUuid || '',
    formTitle: normalizeText(associationForm.formTitle || associationForm.title || props.formTitle || props.title, ''),
    mainFieldId: associationForm.mainFieldId || '',
    mainFieldLabel: normalizeText(associationForm.mainFieldLabel, ''),
    multiple: !!(props.multiple || associationForm.multiple),
  };
}

function collectTopLevelFieldNodes(schemaResult) {
  const nodes = [];
  const pages = schemaResult && schemaResult.content && schemaResult.content.pages;
  if (!Array.isArray(pages)) {
    return nodes;
  }

  function traverse(node) {
    if (!node) {
      return;
    }
    if (FIELD_KIND_BY_COMPONENT[node.componentName]) {
      nodes.push(node);
      if (node.componentName === 'TableField') {
        return;
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }

  pages.forEach((page) => {
    const roots = page && page.componentsTree ? page.componentsTree : [];
    roots.forEach(traverse);
  });
  return nodes;
}

function buildFieldFromNode(node, aliasMaps) {
  const props = node.props || {};
  const fieldId = props.fieldId || '';
  if (!fieldId) {
    return null;
  }

  const label = normalizeText(props.label, fieldId);
  const alias = aliasMaps.aliasByFieldId[fieldId] || '';
  return {
    name: sanitizeFieldName(alias || fieldId, fieldId),
    label,
    alias,
    fieldId,
    componentName: node.componentName,
    type: fieldTypeFor(node.componentName),
    required: !!props.required,
  };
}

function buildRelationshipsForField(entityId, node, label, fieldId) {
  const props = node.props || {};
  const relationships = [];

  if (node.componentName === 'EmployeeField') {
    relationships.push({
      from: entityId,
      to: 'SystemUser',
      fromField: fieldId,
      label,
      type: props.multiple ? 'many-to-many' : 'many-to-one',
      source: 'EmployeeField',
    });
  }

  if (node.componentName === 'DepartmentSelectField') {
    relationships.push({
      from: entityId,
      to: 'SystemDepartment',
      fromField: fieldId,
      label,
      type: props.multiple ? 'many-to-many' : 'many-to-one',
      source: 'DepartmentSelectField',
    });
  }

  if (node.componentName === 'AssociationFormField') {
    const target = getAssociationTarget(props);
    const targetId = target.formUuid ? sanitizeEntityId(target.formUuid) : '';
    relationships.push({
      from: entityId,
      to: targetId,
      toFormUuid: target.formUuid,
      toFormName: target.formTitle,
      fromField: fieldId,
      toField: target.mainFieldId,
      label,
      type: target.multiple ? 'many-to-many' : 'many-to-one',
      source: 'AssociationFormField',
      unresolved: !targetId,
    });
  }

  return relationships;
}

function buildEntityFromRecord(record) {
  const schema = record.schema;
  const aliasMaps = buildComponentAliasMaps(schema);
  const nodes = collectTopLevelFieldNodes(schema);
  const entityId = sanitizeEntityId(record.formUuid || record.formName);
  const entity = {
    id: entityId,
    name: record.formName || record.formUuid || entityId,
    type: 'form',
    formUuid: record.formUuid || '',
    formType: record.formType || '',
    pathName: record.pathName || '',
    fields: [],
  };
  const childEntities = [];
  const relationships = [];

  nodes.forEach((node) => {
    const props = node.props || {};
    const fieldId = props.fieldId || '';
    if (!fieldId) {
      return;
    }

    const baseField = buildFieldFromNode(node, aliasMaps);
    const label = baseField.label;

    entity.fields.push(baseField);
    relationships.push(...buildRelationshipsForField(entity.id, node, label, fieldId));

    if (node.componentName === 'TableField') {
      const childEntityId = `${entity.id}_${sanitizeEntityId(fieldId)}`;
      const childModel = Array.isArray(node.children)
        ? collectTableChildModel(node.children, aliasMaps, childEntityId)
        : { fields: [], relationships: [] };
      const childFields = childModel.fields;
      relationships.push(...childModel.relationships);
      childEntities.push({
        id: childEntityId,
        name: `${entity.name}.${label || fieldId}`,
        type: 'subtable',
        formUuid: `${record.formUuid || entity.id}.${fieldId}`,
        formType: 'subtable',
        parentFormUuid: record.formUuid || '',
        parentFieldId: fieldId,
        fields: [
          { name: 'parentInstId', fieldId: 'parentInstId', type: 'string', componentName: 'SystemField', label: 'parentInstId' },
          ...childFields,
        ],
      });
      relationships.push({
        from: entity.id,
        to: childEntityId,
        fromField: fieldId,
        label,
        type: 'one-to-many',
        source: 'TableField',
      });
    }
  });

  entity.fields = dedupeByKey(entity.fields, item => item.fieldId);
  entity.fields.unshift({
    name: 'formInstId',
    label: 'formInstId',
    alias: '',
    fieldId: 'formInstId',
    componentName: 'SystemField',
    type: 'string',
    required: true,
  });
  return { entity, childEntities, relationships };
}

function collectTableChildModel(children, aliasMaps, childEntityId) {
  const fields = [];
  const relationships = [];

  function traverse(node) {
    if (!node) {
      return;
    }
    if (FIELD_KIND_BY_COMPONENT[node.componentName]) {
      const field = buildFieldFromNode(node, aliasMaps);
      if (field) {
        fields.push(field);
        relationships.push(...buildRelationshipsForField(childEntityId, node, field.label, field.fieldId));
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }

  children.forEach(traverse);
  return {
    fields: dedupeByKey(fields, item => item.fieldId),
    relationships,
  };
}

function buildErModel(records, options = {}) {
  const entities = [];
  const relationships = [];
  const warnings = [];

  records.filter(record => record && record.success).forEach((record) => {
    const built = buildEntityFromRecord(record);
    entities.push(built.entity, ...built.childEntities);
    relationships.push(...built.relationships);
  });

  const knownEntityIds = new Set(entities.map(entity => entity.id));
  const needsSystemUser = relationships.some(rel => rel.to === 'SystemUser');
  const needsSystemDepartment = needsSystemUser || relationships.some(rel => rel.to === 'SystemDepartment');

  if (options.includeSystem || needsSystemUser || needsSystemDepartment) {
    SYSTEM_ENTITIES.forEach((entity) => {
      const shouldInclude = options.includeSystem ||
        (entity.id === 'SystemUser' && needsSystemUser) ||
        (entity.id === 'SystemDepartment' && needsSystemDepartment);
      if (shouldInclude && !knownEntityIds.has(entity.id)) {
        entities.push(entity);
        knownEntityIds.add(entity.id);
      }
    });
  }

  if (knownEntityIds.has('SystemUser') && knownEntityIds.has('SystemDepartment')) {
    relationships.push({
      from: 'SystemUser',
      to: 'SystemDepartment',
      fromField: 'deptId',
      toField: 'deptId',
      label: 'department',
      type: 'many-to-one',
      source: 'SystemEntity',
    });
  }

  if (knownEntityIds.has('SystemDepartment')) {
    relationships.push({
      from: 'SystemDepartment',
      to: 'SystemDepartment',
      fromField: 'parentId',
      toField: 'deptId',
      label: 'parent department',
      type: 'many-to-one',
      source: 'SystemEntity',
    });
  }

  if (knownEntityIds.has('SystemDepartment') && knownEntityIds.has('SystemOrganization')) {
    relationships.push({
      from: 'SystemDepartment',
      to: 'SystemOrganization',
      fromField: 'orgId',
      toField: 'orgId',
      label: 'organization',
      type: 'many-to-one',
      source: 'SystemEntity',
    });
  }

  if (knownEntityIds.has('SystemRole') && knownEntityIds.has('SystemOrganization')) {
    relationships.push({
      from: 'SystemRole',
      to: 'SystemOrganization',
      fromField: 'orgId',
      toField: 'orgId',
      label: 'organization',
      type: 'many-to-one',
      source: 'SystemEntity',
    });
  }

  if (knownEntityIds.has('SystemUser') && knownEntityIds.has('SystemRole')) {
    relationships.push({
      from: 'SystemUser',
      to: 'SystemRole',
      fromField: 'roleIds',
      toField: 'roleId',
      label: 'roles',
      type: 'many-to-many',
      source: 'SystemEntity',
    });
  }

  relationships.forEach((rel) => {
    if (rel.to && !knownEntityIds.has(rel.to)) {
      rel.unresolved = true;
      warnings.push({
        type: 'unresolved-relationship',
        from: rel.from,
        to: rel.to,
        toFormUuid: rel.toFormUuid || '',
        message: `Relationship target not found: ${rel.toFormUuid || rel.to}`,
      });
    }
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    appType: options.appType || '',
    entities: dedupeByKey(entities, item => item.id),
    relationships: dedupeByKey(relationships, item => `${item.from}->${item.to}:${item.fromField}:${item.source}`),
    warnings,
  };
}

function mermaidTypeFor(field) {
  return String(field.type || field.componentName || 'field')
    .replace(/\[\]/g, '_list')
    .replace(/[^\w\u4e00-\u9fa5]/g, '_');
}

function mermaidComment(value) {
  return String(value || '').replace(/["\\\r\n]/g, ' ').trim();
}

function renderMermaid(model) {
  const lines = ['erDiagram'];

  model.entities.forEach((entity) => {
    lines.push(`  ${entity.id} {`);
    const fields = entity.fields && entity.fields.length > 0
      ? entity.fields
      : [{ name: entity.formUuid || entity.id, fieldId: entity.formUuid || entity.id, type: 'entity' }];
    fields.forEach((field) => {
      const keyMark = field.fieldId === 'formInstId' || field.fieldId === 'parentInstId' ? ' PK' : '';
      const commentParts = [field.label, field.alias, field.componentName].map(mermaidComment).filter(Boolean);
      const comment = commentParts.length > 0 ? ` "${commentParts.join(' / ')}"` : '';
      lines.push(`    ${mermaidTypeFor(field)} ${sanitizeFieldName(field.name, field.fieldId)}${keyMark}${comment}`);
    });
    lines.push('  }');
  });

  model.relationships
    .filter(rel => rel.to && !rel.unresolved)
    .forEach((rel) => {
      const connector = rel.type === 'one-to-many'
        ? '||--o{'
        : rel.type === 'many-to-many'
          ? '}o--o{'
          : '}o--||';
      const label = mermaidComment(rel.label || rel.fromField || rel.source);
      lines.push(`  ${rel.from} ${connector} ${rel.to} : "${label}"`);
    });

  return `${lines.join('\n')}\n`;
}

function formatErOutput(model, format) {
  if (format === 'json') {
    return `${JSON.stringify(model, null, 2)}\n`;
  }
  if (format === 'mermaid') {
    return renderMermaid(model);
  }
  throw new Error(`Unsupported ER format: ${format}`);
}

function createAuthRef() {
  const { step, info, success: chalkSuccess } = require('../core/chalk');

  step(1, t('common.step_login', 1));
  let cookieData = loadCookieData();
  if (!cookieData) {
    info(t('common.login_no_cache'));
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  chalkSuccess(t('common.login_ready', authRef.baseUrl));
  return authRef;
}

function ensureUsage(parsed) {
  if (parsed.help) {
    process.stderr.write(`${t('er.usage')}\n${t('er.example')}\n`);
    return false;
  }
  if (!parsed.appType) {
    const { error } = require('../core/chalk');
    error(t('er.usage'), { hint: t('er.example') });
  }
  if (!['mermaid', 'json'].includes(parsed.format)) {
    const { error } = require('../core/chalk');
    error(t('er.unsupported_format', parsed.format), { hint: t('er.format_hint') });
  }
  return true;
}

async function collectSchemaRecords(parsed, authRef) {
  const forms = filterErSourceForms(await fetchFormPageList(parsed.appType, authRef), parsed);
  return mapLimit(forms, parsed.concurrency, form => fetchSchemaRecord(parsed.appType, form, authRef, parsed.retries));
}

function writeOutputIfNeeded(content, outputPath) {
  if (!outputPath) {
    return '';
  }
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, 'utf-8');
  return resolved;
}

async function run(args) {
  const parsed = parseArgs(args || []);
  if (!ensureUsage(parsed)) {
    return;
  }
  const { banner, step, label, info, success } = require('../core/chalk');

  banner(t('er.title'));
  label('App', parsed.appType);
  label('Format', parsed.format);
  if (parsed.output) {label('Output', parsed.output);}

  const authRef = createAuthRef();

  step(2, t('er.step_fetch'));
  const records = await collectSchemaRecords(parsed, authRef);
  const successCount = records.filter(record => record.success).length;
  info(t('er.forms_loaded', successCount, records.length - successCount));

  step(3, t('er.step_build'));
  const model = buildErModel(records, {
    appType: parsed.appType,
    includeSystem: parsed.includeSystem,
  });
  const content = formatErOutput(model, parsed.format);
  const writtenPath = writeOutputIfNeeded(content, parsed.output);

  if (writtenPath) {
    success(t('er.output_written', writtenPath));
  } else {
    process.stdout.write(content);
  }
}

module.exports = {
  SYSTEM_ENTITIES,
  parseArgs,
  filterErSourceForms,
  normalizeText,
  sanitizeEntityId,
  sanitizeFieldName,
  collectTopLevelFieldNodes,
  buildEntityFromRecord,
  buildErModel,
  renderMermaid,
  formatErOutput,
  collectSchemaRecords,
  run,
};
