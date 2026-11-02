'use strict';

const readActions = ['list', 'inspect', 'fields', 'files'];
const writeActions = ['create', 'copy', 'save', 'restore', 'settings', 'status', 'order', 'render'];
const usage = 'print-template <list|inspect|fields|build|create|copy|save|restore|settings|status|order|render|files> <appType> <formUuid> [templateId] [--config <file>] [--scene <order|quotation|delivery|receipt|approval|codes>] [--bindings <file>] [--name <title>] [--expected-hash <hash>] [--backup <file>] [--out <file>] [--status START|STOP] [--instance <id>] [--page <n>] [--size <n>] [--allow-permission-change] [--json] | print-template <list|render> --detail-url <url> [--template-id <id>] [--json]';

/** Shared manifest metadata keeps ordinary and managed agents on the same native contract. */
const printTemplateCommand = ['print-template', ['print-template'], usage, 'print_template.description', {
  output: 'json',
  managedRun: { scope: 'actions', actions: {
    ...Object.fromEntries([...readActions, 'build'].map(action => [action, { scope: 'app', appPosition: 1 }])),
    ...Object.fromEntries(writeActions.filter(action => action !== 'render').map(action => [action,
      { scope: 'app', appPosition: 1, mutation: { operation: 'update_form', formUuidPosition: 2 } }])),
    // PDF generation is explicit and may consume storage; managed app runs cannot invoke it.
    render: { scope: 'denied', reason: 'native_pdf_generation' },
  } },
  examples: ['openyida print-template list --detail-url "https://tenant.aliwork.com/APP_XXX/formDetail/FORM_XXX?formInstId=FINST_XXX" --json',
    'openyida print-template render --detail-url "https://tenant.aliwork.com/APP_XXX/formDetail/FORM_XXX?formInstId=FINST_XXX" --template-id 123 --json',
    'openyida print-template fields APP_XXX FORM_XXX --json',
    'openyida print-template build APP_XXX FORM_XXX --scene quotation --bindings quote-fields.json --out quote.json --json',
    'openyida print-template create APP_XXX FORM_XXX --name "报价单" --config quote.json --json',
    'openyida print-template save APP_XXX FORM_XXX 123 --config quote.json --expected-hash <inspect-hash> --json'],
  notes: ['Native rich-text YiDA printing only; Word, DingDang and government printing use different editors. build compiles a named-field document or validates a complete native body, without saving it. build --scene selects one of six reusable samples and --bindings maps semantic roles to actual field names/IDs before validation. create --config validates first, creates and saves content; failures after creation expose createdTemplateId and must be resumed with inspect/save instead of repeated create. qrcode/barcode blocks and field/column render options use native dynamic image keys, with validated field prefixes, current edition and feature availability. fields reports codeFormats; barcode values must follow native character limits and are never silently rewritten. inspect --out exports a full snapshot; restore restores its content only to the same target. save is immediately effective, with no separate publish action. Hashes are required for updates; body saves also send the native gmtModified concurrency token when present. Every remote mutation backs up first, never retries, and verifies readback. Uncertain create/copy results must be inspected before retrying. settings preserves untranslated locales and does not change roleData unless supplied with --allow-permission-change. Built-in default template body cannot be edited. render requests one native PDF and returns a file ID, not proof of generation or physical printing; files lists generation records. list --instance and --detail-url use the runtime record-authorized template list instead of the administration list; render uses that same list and never reads an admin-only template body. URL mode only accepts known native detail routes and the authenticated origin; template choice is explicit. It prints record data through native templates, not arbitrary website pixels. No edition/quota changes. Custom CSS, fixed pages, paper size, margins, headers/footers and automatic totals are not guaranteed by this legacy editor.'],
}];

const printTemplateEffects = { mutates_yida: true, mutates_local: true, read_actions: readActions,
  mutating_actions: ['build', ...writeActions], note: 'build only writes an optional local output; inspect/fields write local exports only with --out.' };
const printTemplatePermission = { preauthorized_actions: ['build', 'create', 'copy', 'save', 'restore', 'status', 'order'],
  ask_actions: ['settings', 'render'] };

module.exports = { printTemplateCommand, printTemplateEffects, printTemplatePermission, usage };
