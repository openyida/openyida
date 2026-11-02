'use strict';

const { object, fail, safe } = require('./model');
const names = ['order', 'quotation', 'delivery', 'receipt', 'approval', 'codes'];

/** Map scene roles to explicit live field references; compilation verifies IDs and table ownership. */
function document(scene, bindings = {}) {
  if (!names.includes(scene)) { fail('INVALID_CONFIG', `scene: ${names.join('|')}`); }
  safe(bindings);
  if (!object(bindings) || Object.values(bindings).some(value => typeof value !== 'string' || !value.trim())) {
    fail('INVALID_CONFIG', 'bindings: field role -> actual field name/key');
  }
  const result = JSON.parse(JSON.stringify(require(`../samples/yida-print-template/${scene}.json`)));
  const used = new Set();
  const ref = name => { used.add(name); return bindings[name] ?? name; };
  for (const block of result.document.blocks) {
    if (block.field) { block.field = ref(block.field); }
    if (block.fields) { block.fields = block.fields.map(field => typeof field === 'string' ? ref(field) : { ...field, field: ref(field.field) }); }
    if (block.columns && Array.isArray(block.columns)) {
      block.columns = block.columns.map(field => typeof field === 'string' ? ref(field) : { ...field, field: ref(field.field) });
    }
    if (block.html) { block.html = block.html.replace(/\{\{([^{}]+)\}\}/g, (_, field) => `{{${ref(field.trim())}}}`); }
  }
  const unused = Object.keys(bindings).filter(key => !used.has(key));
  if (unused.length) { fail('INVALID_CONFIG', `unknown scene roles: ${unused.join(', ')}`); }
  return result;
}

module.exports = { names, document };
