'use strict';

const { createAuthRef } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { fetchFormPageList } = require('./form-navigation');

function parseArgs(args) {
  const parsed = {
    appType: '',
    keyword: '',
  };

  if (args.length > 0) {
    parsed.appType = args[0];
  }

  for (let index = 1; index < args.length; index++) {
    if (args[index] === '--keyword' && args[index + 1]) {
      parsed.keyword = args[index + 1];
      index++;
    }
  }

  return parsed;
}

function filterForms(forms, keyword) {
  if (!keyword) {
    return forms;
  }

  const normalizedKeyword = keyword.toLowerCase();
  return forms.filter((form) => {
    return [form.formName, form.formUuid, form.formType, form.pathName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
  });
}

async function run(args) {
  const parsed = parseArgs(args);
  if (!parsed.appType) {
    console.error(t('list_forms.usage'));
    console.error(t('list_forms.example1'));
    console.error(t('list_forms.example2'));
    process.exit(1);
  }

  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error(t('list_forms.title'));
  console.error(SEP);
  console.error(t('list_forms.app_id', parsed.appType));
  if (parsed.keyword) {
    console.error(t('list_forms.keyword', parsed.keyword));
  }

  console.error(t('common.step_login', 1));
  const authRef = createAuthRef();
  if (!authRef || !authRef.csrfToken) {
    console.error(t('list_forms.no_login'));
    process.exit(1);
  }
  console.error(t('common.login_ready', authRef.baseUrl));

  console.error(t('list_forms.step_get'));
  let forms;
  try {
    forms = await fetchFormPageList(parsed.appType, authRef);
  } catch (error) {
    console.error(t('list_forms.failed', error.message));
    process.exit(1);
  }

  const filteredForms = filterForms(forms, parsed.keyword);
  console.error(t('list_forms.found', filteredForms.length));

  if (filteredForms.length === 0) {
    console.error(t('list_forms.empty'));
  }

  console.log(JSON.stringify(filteredForms, null, 2));
}

module.exports = {
  filterForms,
  parseArgs,
  run,
};
