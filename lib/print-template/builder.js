'use strict';

const { object, fail, json, safe, label, content } = require('./model');
const codes = require('./codes');
const TYPES = new Set(['value', 'date', 'img', 'table', 'commonCheckbox', 'yidaApproveNode']);
const FONTS = ['宋体', 'Arial', '新宋', '微软雅黑', '黑体'];
// The native PDF renderer recognizes these editor values, not localized font labels.
const FONT_VALUES = { 宋体: 'SimSun', Arial: 'Arial Unicode MS', 新宋: 'NSimSun', 微软雅黑: 'Microsoft YaHei', 黑体: 'SimHei' };

/** Escape literal values in XHTML and native dynamic-field attributes. */
function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** Fail on unrecognized configuration instead of silently dropping requested features. */
function keys(value, allowed, name) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) { fail('INVALID_CONFIG', name); }
}

/** Build printable field groups from the same dictionaries consumed by the native editor. */
function fields(raw, codeCapability = { enabled: false, reason: 'capability_unverified' }) {
  if (!object(raw) || !Array.isArray(raw.formField) && !Array.isArray(raw.forms) || !Array.isArray(raw.systemField)) {
    fail('INVALID_RESPONSE', 'print dictionary');
  }
  const normalize = (items, group, parent) => (items || []).map(item => ({ ...item, label: label(item.description), group,
    ...(codes.eligible(item) ? { codeFormats: codeCapability.enabled ? [...codes.FORMATS] : [],
      codeUnavailableReason: codeCapability.enabled ? null : codeCapability.reason } : {}),
    parentKey: parent || null, children: normalize(item.children, group, item.key) }));
  return [...normalize(raw.formField, 'form'), ...normalize(raw.systemField, 'system'),
    ...normalize(raw.remarkRecord ? [raw.remarkRecord] : [], 'system'), ...normalize(raw.approvedNode, 'approval'),
    ...(raw.forms || []).flatMap(form => normalize(form.formField, 'form', form.id).map(item => ({ ...item, formKey: form.id })))];
}

/** Resolve exact IDs or unambiguous names, scoped to a parent table when supplied. */
function resolve(items, ref) {
  if (typeof ref !== 'string' || !ref) { fail('INVALID_CONFIG', 'field reference'); }
  const byId = items.filter(item => item.key === ref);
  const matches = byId.length ? byId : items.filter(item => item.label === ref);
  if (matches.length !== 1) { fail('FIELD_REFERENCE', ref, { candidates: matches.map(item => ({ key: item.key, label: item.label })) }); }
  return matches[0];
}

/** Reject executable HTML/Velocity input; native macros remain data references only. */
function html(value) {
  if (typeof value !== 'string' || /<\s*\/?\s*(?:script|iframe|object|embed|form|link|meta|style)\b|\bon\w+\s*=|javascript\s*:|data\s*:|#\s*(?:set|evaluate|parse|include|foreach|if|macro)\b|\$!?\{/i.test(value)) {
    fail('INVALID_CONFIG', 'static XHTML');
  }
  return value;
}

/** Validate a complete native body while preserving advanced native attributes verbatim. */
function validateNative(raw, dictionary) {
  const result = content(raw);
  safe(result);
  const attrs = result.termJsonAttr;
  const entries = result.dictionaryList;
  const ids = attrs.map(item => item?.id);
  if (ids.some(id => typeof id !== 'string' || !/^[\w-]+$/.test(id)) || new Set(ids).size !== ids.length
    || entries.length !== attrs.length || new Set(entries.map(item => item.id)).size !== entries.length) {
    fail('INVALID_CONFIG', 'native component IDs');
  }
  const all = [];
  const visit = items => items.forEach(item => { all.push(item); visit(item.children || []); });
  visit(dictionary);
  for (const attr of attrs) {
    const entry = entries.find(item => item.id === attr.id);
    const code = entry && codes.resolveNative(entry.key, all);
    const labelKey = typeof attr.content === 'string' && /exttype="label"/.test(attr.content)
      ? /fieldkey="([^"]+)"/.exec(attr.content)?.[1] : null;
    if (!TYPES.has(attr.type) || !entry || entry.type !== attr.type || (code ? attr.type !== 'img' : !all.some(field => field.key === (labelKey || entry.key)))
      || typeof attr.content !== 'string' || !result.termContents.includes(` #macro_${attr.id} `)) {
      fail('INVALID_CONFIG', `native component: ${attr.id}`);
    }
    // Native placeholders use ${label} in disabled input values. They are never evaluated locally.
    html(attr.content.replace(/\$!?\{[^}]*\}/g, 'FIELD'));
    // Repeating tables keep child image keys inside the parent macro, outside dictionaryList.
    for (const [input] of attr.content.matchAll(/<input\b[^>]*>/gi)) {
      const key = /\bkey\s*=\s*(["'])(.*?)\1/i.exec(input)?.[2];
      if (codes.resolveNative(key, all) && !/\bkeytype\s*=\s*(["'])img\1/i.test(input)) {
        fail('INVALID_CONFIG', 'native code image');
      }
    }
  }
  const macros = [...result.termContents.matchAll(/#macro_([\w-]+)/g)].map(match => match[1]);
  if (macros.some(id => !ids.includes(id))) { fail('INVALID_CONFIG', 'unresolved macro'); }
  html(result.termContents.replace(/ #macro_[\w-]+ /g, 'FIELD'));
  return { termContents: result.termContents, termJsonAttr: attrs, dictionaryList: entries };
}

/** Compile named sections into the existing editor's native macros, never browser-only placeholders. */
function build(config, dictionary) {
  keys(config, ['title', 'style', 'font', 'fontSize', 'width', 'blocks'], 'document');
  const theme = config.style || 'document';
  if (!['document', 'compact', 'formal'].includes(theme) || config.font !== undefined && !FONTS.includes(config.font)
    || config.title !== undefined && typeof config.title !== 'string'
    || config.fontSize !== undefined && (!Number.isFinite(config.fontSize) || config.fontSize < 8 || config.fontSize > 72)
    || config.width !== undefined && (!Number.isFinite(config.width) || config.width < 160 || config.width > 2000)
    || !Array.isArray(config.blocks) || !config.blocks.length) { fail('INVALID_CONFIG', 'document style / blocks'); }
  const padding = theme === 'compact' ? '3px 5px' : '7px 9px';
  const border = theme === 'formal' ? '#333333' : '#777777';
  const cellStyle = `border:1px solid ${border};padding:${padding};vertical-align:top;`;
  const tableStyle = `border-collapse:collapse;width:100%;border:1px solid ${border};`;
  const termJsonAttr = [];
  const dictionaryList = [];
  let counter = 0;
  const next = type => `${type}_${++counter}`;
  const scalar = (field, options = {}, nested = false) => {
    if (options.render !== undefined) { field = codes.transform(field, options.render); }
    if (field.type === 'commonCheckbox') {
      if (nested || !Array.isArray(field.children) || !field.children.length) { fail('UNSUPPORTED', `checkbox: ${field.label}`); }
      const id = next('commonCheckbox');
      const body = `<span id="${id}" key="${escape(field.key)}" contenteditable="false" class="render-commonCheckbox">${field.children.map(child => `<label key="${escape(child.key)}" keytype="${escape(child.type)}" keydescription="${escape(child.label)}">☐\${${escape(child.label)}}</label>`).join(' ')}</span>`;
      termJsonAttr.push({ id, type: 'commonCheckbox', content: body });
      dictionaryList.push({ id, type: 'commonCheckbox', key: field.key, description: field.label });
      return ` #macro_${id} `;
    }
    if (!['value', 'date', 'img'].includes(field.type)) { fail('UNSUPPORTED', `${field.label}: ${field.type}`); }
    const id = next(field.type);
    let extra = '';
    const width = options.width ?? (field.codeFormat === 'qrcode' ? 128 : field.codeFormat === 'barcode' ? 240 : undefined);
    const height = options.height ?? (field.codeFormat === 'qrcode' ? 128 : field.codeFormat === 'barcode' ? 80 : undefined);
    if (field.type === 'date') {
      const format = options.format || 'yyyy-MM-dd';
      if (!(field.children || []).some(child => child.key === format)) { fail('INVALID_CONFIG', `date format: ${format}`); }
      extra += ` dateformat="${escape(format)}"`;
    } else if (options.format !== undefined) { fail('INVALID_CONFIG', `format: ${field.label}`); }
    if (width !== undefined || height !== undefined) {
      if (field.type !== 'img' || [width, height].filter(v => v !== undefined).some(v => !Number.isFinite(v) || v <= 0 || v > 2000)) {
        fail('INVALID_CONFIG', 'image dimensions');
      }
      extra += width ? ` width="${width}" td-width="${Number.isInteger(width) ? `${width}.0` : width}"` : '';
      extra += height ? ` height="${height}" td-height="${Number.isInteger(height) ? `${height}.0` : height}"` : '';
    }
    const input = `<input id="${id}" key="${escape(field.key)}" keytype="${field.type}" type="text" disabled="disabled" class="render-${field.type}" style="border:0;background-color:transparent;color:inherit;font:inherit;" title="${escape(field.label)}(${escape(field.key)})" value="\${${escape(field.label)}}"${extra}/>`;
    if (nested) { return input; }
    termJsonAttr.push({ id, type: field.type, content: input });
    dictionaryList.push({ id, type: field.type, key: field.key, description: field.label });
    return ` #macro_${id} `;
  };
  const dynamic = (ref, options = {}) => {
    const field = resolve(dictionary, ref);
    if (field.type === 'table' || field.group === 'approval') {
      if (['format', 'width', 'height', 'render'].some(key => options[key] !== undefined)) { fail('INVALID_CONFIG', 'table options'); }
      const id = next(field.group === 'approval' ? 'yidaApproveNode' : 'table');
      const selected = options.columns || field.children.map(child => child.key);
      if (!Array.isArray(selected) || !selected.length) { fail('INVALID_CONFIG', 'table columns'); }
      const columns = selected.map(col => {
        if (typeof col === 'string') { col = { field: col }; }
        keys(col, ['field', 'label', 'format', 'width', 'height', 'render'], 'table column');
        return { ...col, definition: resolve(field.children, col.field) };
      });
      const row = `<tr class="render-table row">${columns.map(col => `<td style="${cellStyle}">${scalar(col.definition, col, true)}</td>`).join('')}</tr>`;
      const head = `<tr class="render-table head">${columns.map(col => `<td style="${cellStyle}">${escape(col.label ?? col.definition.label)}</td>`).join('')}</tr>`;
      const type = field.group === 'approval' ? 'yidaApproveNode' : 'table';
      const body = type === 'table'
        ? `<table id="${id}" key="${escape(field.key)}" class="render-table" style="${tableStyle}"><tbody>${head}${row}</tbody></table>`
        : `<div id="${id}" key="${escape(field.key)}" class="render-yidaApproveNode"><div>${columns.map(col => `<p>${escape(col.label ?? col.definition.label)}：${scalar(col.definition, col, true)}</p>`).join('')}</div></div>`;
      termJsonAttr.push({ id, type, content: body });
      dictionaryList.push({ id, type, key: field.key, description: field.label });
      return ` #macro_${id} `;
    }
    return scalar(field, options);
  };
  const blocks = config.blocks.map(block => {
    if (!object(block)) { fail('INVALID_CONFIG', 'block'); }
    if (block.type === 'heading' || block.type === 'text') {
      keys(block, ['type', 'text', 'align'], block.type);
      if (typeof block.text !== 'string' || block.align && !['left', 'center', 'right'].includes(block.align)) { fail('INVALID_CONFIG', block.type); }
      const tag = block.type === 'heading' ? 'h2' : 'p';
      return `<${tag} style="text-align:${block.align || 'left'};">${escape(block.text)}</${tag}>`;
    }
    if (block.type === 'fields') {
      keys(block, ['type', 'fields', 'columns'], 'fields block');
      const count = block.columns ?? 1;
      if (![1, 2, 3, 4].includes(count) || !Array.isArray(block.fields) || !block.fields.length) { fail('INVALID_CONFIG', 'fields block'); }
      const cells = block.fields.map(ref => {
        const item = typeof ref === 'string' ? { field: ref } : ref;
        keys(item, ['field', 'label', 'format', 'width', 'height', 'render'], 'field');
        const field = resolve(dictionary, item.field);
        if (field.type === 'table' || field.group === 'approval') { fail('INVALID_CONFIG', 'use table block'); }
        return `<td style="${cellStyle}width:${100 / count}%;">${escape(item.label ?? field.label)}：${dynamic(item.field, item)}</td>`;
      });
      const rows = [];
      for (let i = 0; i < cells.length; i += count) { rows.push(`<tr>${cells.slice(i, i + count).join('')}${`<td style="${cellStyle}"></td>`.repeat(Math.max(0, count - cells.slice(i, i + count).length))}</tr>`); }
      return `<table style="${tableStyle}"><tbody>${rows.join('')}</tbody></table>`;
    }
    if (block.type === 'table' || block.type === 'field') {
      keys(block, ['type', 'field', 'columns', 'format', 'width', 'height', 'render'], block.type);
      const field = resolve(dictionary, block.field);
      if (block.type === 'table' && field.type !== 'table' && field.group !== 'approval') { fail('INVALID_CONFIG', 'table field'); }
      if (block.columns !== undefined && field.type !== 'table' && field.group !== 'approval') { fail('INVALID_CONFIG', 'columns require table'); }
      return dynamic(block.field, block);
    }
    if (codes.FORMATS.includes(block.type)) {
      keys(block, ['type', 'field', 'width', 'height'], block.type);
      const width = block.width ?? (block.type === 'qrcode' ? 128 : 240);
      const height = block.height ?? (block.type === 'qrcode' ? 128 : 80);
      const macro = dynamic(block.field, { render: block.type, width, height });
      return `<table style="border-collapse:collapse;width:${width}px;"><tbody><tr><td style="width:${width}px;height:${height}px;padding:0;border:0;">${macro}</td></tr></tbody></table>`;
    }
    if (block.type === 'html') {
      keys(block, ['type', 'html'], 'html block');
      // Static XHTML supports arbitrary arrangements; dynamic tokens must resolve to live fields.
      const result = html(block.html).replace(/\{\{([^{}]+)\}\}/g, (_, ref) => dynamic(ref.trim()));
      if (/\{\{|\}\}/.test(result)) { fail('INVALID_CONFIG', 'unclosed field token'); }
      return result;
    }
    if (block.type === 'image') {
      keys(block, ['type', 'url', 'width', 'height'], 'image block');
      if (typeof block.url !== 'string' || !/^https:\/\//.test(block.url) || [block.width, block.height].filter(v => v !== undefined).some(v => !Number.isFinite(v) || v <= 0 || v > 2000)) { fail('INVALID_CONFIG', 'image'); }
      return `<p><img src="${escape(block.url)}"${block.width ? ` width="${block.width}"` : ''}${block.height ? ` height="${block.height}"` : ''}/></p>`;
    }
    if (block.type === 'divider') { keys(block, ['type'], 'divider'); return '<hr/>'; }
    fail('UNSUPPORTED', `block: ${block.type}`);
  });
  const title = config.title ? `<h1 style="text-align:center;">${escape(config.title)}</h1>` : '';
  const termContents = `<div style="font-family:${FONT_VALUES[config.font || '宋体']};font-size:${config.fontSize || 14}px;line-height:1.6;${config.width ? `width:${config.width}px;` : ''}">${title}${blocks.join('<p></p>')}</div>`;
  return validateNative({ termContents, termJsonAttr, dictionaryList }, dictionary);
}

/** Accept authored documents or complete native exports; partial native bodies are rejected. */
function compile(raw, dictionary) {
  if (object(raw) && Object.hasOwn(raw, 'document')) {
    keys(raw, ['document'], 'config');
    return build(raw.document, dictionary);
  }
  keys(raw, ['termContents', 'termJsonAttr', 'dictionaryList'], 'native config');
  if (['termContents', 'termJsonAttr', 'dictionaryList'].some(key => !Object.hasOwn(raw, key))) { fail('INVALID_CONFIG', 'complete native config required'); }
  return validateNative({ ...raw, termJsonAttr: json(raw.termJsonAttr, 'termJsonAttr'), dictionaryList: json(raw.dictionaryList, 'dictionaryList') }, dictionary);
}

module.exports = { fields, resolve, build, compile, validateNative, escape };
