'use strict';

const { DesignTemplateClient } = require('./client');
const { downloadTemplate } = require('./download');
const { throwUsage } = require('../core/command-errors');
const { t } = require('../core/i18n');

/** Only a single semantic match or a stable template ID download is exposed to consumers. */
function parseArgs(args) {
  if (!args.length || args.includes('--help') || args.includes('-h')) { return { help: true }; }
  const [action, value, ...rest] = args;
  if (!['match', 'get'].includes(action) || !value || value.startsWith('--')) { throwUsage(t('design_template.usage')); }
  const result = { action, value };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--json' && !result.json) { result.json = true; }
    else if (rest[i] === '--output-dir' && action === 'get' && !result.output && rest[i + 1] && !rest[i + 1].startsWith('--')) {
      result.output = rest[++i];
    } else { throwUsage(t('design_template.usage')); }
  }
  if ((action === 'match' && (value.trim().length < 2 || value.length > 1000)) ||
      (action === 'get' && (!/^dt_[a-f0-9]{32}$/.test(value) || !result.output))) {
    throwUsage(t('design_template.usage'));
  }
  return result;
}

/** Returns JSON without tokens, internal metadata, ranking scores or asset URLs. */
async function run(args) {
  const parsed = parseArgs(args);
  if (parsed.help) { console.log(t('design_template.usage')); return; }
  const client = new DesignTemplateClient();
  if (parsed.action === 'match') {
    const result = await client.request('match', { query: parsed.value });
    if (result.id !== null && !/^dt_[a-f0-9]{32}$/.test(result.id || '')) { throw new Error(t('design_template.invalid_manifest')); }
    console.log(JSON.stringify({ id: result.id }));
  } else {
    const manifest = await client.request('files', { id: parsed.value });
    console.log(JSON.stringify(await downloadTemplate(manifest, parsed.value, parsed.output), null, 2));
  }
}
module.exports = { run, parseArgs };
