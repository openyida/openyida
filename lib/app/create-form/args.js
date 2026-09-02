'use strict';

const { detectDeprecatedCreateFormInvocation } = require('../../core/command-contract');

function parseMaybeJsonValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function parseInlineValidationOptions(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return null;
  }

  const rule = {};
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token || !token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2).replace(/-/g, '_');
    const next = tokens[index + 1];
    if (next && !next.startsWith('--')) {
      rule[key] = parseMaybeJsonValue(next);
      index++;
    } else {
      rule[key] = true;
    }
  }

  if (!rule.field && !rule.field_id && !rule.label && !rule.target && !rule.type) {
    return null;
  }

  if (rule.field_id && !rule.fieldId) {
    rule.fieldId = rule.field_id;
  }
  if (rule.domain_whitelist && !rule.domainWhitelist) {
    rule.domainWhitelist = String(rule.domain_whitelist).split(',').map(function (item) {
      return item.trim();
    }).filter(Boolean);
  }
  if (rule.compare_to && !rule.compareTo) {
    rule.compareTo = rule.compare_to;
  }
  if (rule.other_field && !rule.otherField) {
    rule.otherField = rule.other_field;
  }

  return rule;
}

function createParseArgs(dependencies) {
  const {
    parseOpenOption,
    normalizeYidaLocale,
    usage,
    hint,
    error,
    t,
    throwCreateFormError,
  } = dependencies;

  return function parseArgs(inputArgs) {
    const openOption = parseOpenOption(inputArgs || process.argv.slice(2));
    const rawArgs = openOption.args;

    const options = {
      layout: 'single',
      theme: 'default',
      labelAlign: 'top',
      icon: 'auto',
      contentLocale: null,
      browserOpenMode: openOption.mode,
    };

    const args = [...rawArgs];

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--layout' && i + 1 < args.length) {
        options.layout = args[i + 1];
        args.splice(i, 2);
        i--;
      } else if (args[i] === '--theme' && i + 1 < args.length) {
        options.theme = args[i + 1];
        args.splice(i, 2);
        i--;
      } else if (args[i] === '--label-align' && i + 1 < args.length) {
        options.labelAlign = args[i + 1];
        args.splice(i, 2);
        i--;
      } else if (args[i] === '--icon' && i + 1 < args.length) {
        options.icon = args[i + 1];
        args.splice(i, 2);
        i--;
      } else if (args[i] === '--icon') {
        throwCreateFormError('--icon requires a value', 'CREATE_FORM_INVALID_ARGUMENTS');
      } else if ((args[i] === '--locale' || args[i] === '--content-locale' || args[i] === '--lang') && i + 1 < args.length) {
        options.contentLocale = args[i + 1];
        if (!normalizeYidaLocale(options.contentLocale)) {
          error(`Unsupported locale: ${options.contentLocale}`);
          throwCreateFormError(`Unsupported locale: ${options.contentLocale}`, 'CREATE_FORM_INVALID_ARGUMENTS');
        }
        process.env.OPENYIDA_CONTENT_LOCALE = normalizeYidaLocale(options.contentLocale);
        args.splice(i, 2);
        i--;
      } else if (args[i] === '--force') {
        options.force = true;
        args.splice(i, 1);
        i--;
      } else if (args[i] === '--json') {
        options.json = true;
        args.splice(i, 1);
        i--;
      }
    }

    if (args.includes('--help') || args.includes('-h')) {
      usage(t('create_form.usage_create_short'));
      hint(t('create_form.usage_update_short'));
      hint(t('create_form.example_create'));
      hint(t('create_form.example_update'));
      return {
        mode: 'help',
        help: true,
        ...options
      };
    }

    const mode = args[0];

    if (mode === 'icons' || mode === 'list-icons') {
      return {
        mode: 'icons',
        ...options
      };
    }

    if (mode === 'validate-fields') {
      if (args.length === 2) {
        return {
          mode: 'validate-fields',
          fieldsJsonOrFile: args[1],
          ...options
        };
      }
      usage(
        'openyida create-form validate-fields <fieldsJsonOrFile> --json',
        'openyida create-form validate-fields .cache/openyida/forms/fields.json --json'
      );
      throwCreateFormError('openyida create-form validate-fields <fieldsJsonOrFile> --json', 'CREATE_FORM_INVALID_ARGUMENTS');
    }

    if (mode === 'create') {
      if (args.length < 4) {
        usage(t('create_form.usage_create'), t('create_form.example_create'));
        throwCreateFormError(t('create_form.usage_create'), 'CREATE_FORM_INVALID_ARGUMENTS');
      }
      return {
        mode: 'create',
        appType: args[1],
        formTitle: args[2],
        fieldsJsonOrFile: args[3],
        ...options
      };
    }

    if (mode === 'update') {
      if (args.length < 4) {
        usage(t('create_form.usage_update'), t('create_form.example_update'));
        throwCreateFormError(t('create_form.usage_update'), 'CREATE_FORM_INVALID_ARGUMENTS');
      }
      return {
        mode: 'update',
        appType: args[1],
        formUuid: args[2],
        changesJsonOrFile: args[3],
        ...options
      };
    }

    if (mode === 'patch') {
      if (args.length < 4) {
        usage(
          'openyida create-form patch <appType> <formUuid> <patchJsonOrFile>',
          'openyida create-form patch APP_XXX FORM-XXX .cache/openyida/forms/form-patch.json'
        );
        throwCreateFormError('openyida create-form patch <appType> <formUuid> <patchJsonOrFile>', 'CREATE_FORM_INVALID_ARGUMENTS');
      }
      return {
        mode: 'patch',
        appType: args[1],
        formUuid: args[2],
        patchJsonOrFile: args[3],
        ...options
      };
    }

    if (mode === 'rule' || mode === 'rules') {
      if (args.length < 4) {
        usage(
          'openyida create-form rule <appType> <formUuid> <rulesJsonOrFile>',
          'openyida create-form rule APP_XXX FORM-XXX .cache/openyida/forms/form-rules.json'
        );
        throwCreateFormError('openyida create-form rule <appType> <formUuid> <rulesJsonOrFile>', 'CREATE_FORM_INVALID_ARGUMENTS');
      }
      return {
        mode: 'rule',
        appType: args[1],
        formUuid: args[2],
        rulesJsonOrFile: args[3],
        ...options
      };
    }

    if (mode === 'validation' || mode === 'validate' || mode === 'validations') {
      const inlineRule = parseInlineValidationOptions(args.slice(3));
      if (args.length < 4 && !inlineRule) {
        usage(
          'openyida create-form validation <appType> <formUuid> <validationsJsonOrFile>',
          'openyida create-form validation APP_XXX FORM-XXX .cache/openyida/forms/form-validations.json'
        );
        hint('openyida add-validation APP_XXX FORM-XXX --field "手机号" --type phone --message "请输入正确的手机号"');
        throwCreateFormError('openyida create-form validation <appType> <formUuid> <validationsJsonOrFile>', 'CREATE_FORM_INVALID_ARGUMENTS');
      }
      return {
        mode: 'validation',
        appType: args[1],
        formUuid: args[2],
        validationJsonOrFile: inlineRule ? '' : args[3],
        inlineValidationRule: inlineRule,
        ...options
      };
    }

    if (mode === 'bind-datasource' || mode === 'datasource' || mode === 'data-source') {
      if (args.length < 5) {
        usage(
          'openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile>',
          'openyida create-form bind-datasource APP_XXX FORM-XXX "客户" .cache/openyida/forms/customer-datasource.json'
        );
        throwCreateFormError('openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile>', 'CREATE_FORM_INVALID_ARGUMENTS');
      }
      return {
        mode: 'bind-datasource',
        appType: args[1],
        formUuid: args[2],
        fieldLabel: args[3],
        dataSourceJsonOrFile: args[4],
        ...options
      };
    }

    if (mode === 'add-option') {
      if (args.length < 5) {
        usage(
          'openyida create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...',
          'openyida create-form add-option APP_XXX FORM-XXX "优先级" "P0" "P1"'
        );
        throwCreateFormError('openyida create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...', 'CREATE_FORM_INVALID_ARGUMENTS');
      }
      return {
        mode: 'add-option',
        appType: args[1],
        formUuid: args[2],
        fieldLabel: args[3],
        newOptions: args.slice(4).filter(function (arg) { return !arg.startsWith('--'); }),
        ...options
      };
    }

    const deprecatedInvocation = detectDeprecatedCreateFormInvocation(args, {
      assumeCreateFormRoot: true,
    });
    if (deprecatedInvocation) {
      if (!options.json) {
        hint(deprecatedInvocation.suggestion.display);
        hint(deprecatedInvocation.suggestion.note);
      }
      throwCreateFormError(deprecatedInvocation.message, deprecatedInvocation.code, {
        command_id: deprecatedInvocation.command_id,
        canonical: deprecatedInvocation.canonical,
        suggestion: deprecatedInvocation.suggestion,
        pattern: deprecatedInvocation.pattern,
      });
    }

    if (args.length >= 3 && mode !== 'create' && mode !== 'update' && mode !== 'patch' && mode !== 'rule' && mode !== 'rules' && mode !== 'validation' && mode !== 'validate' && mode !== 'validations' && mode !== 'bind-datasource' && mode !== 'datasource' && mode !== 'data-source') {
      return {
        mode: 'create',
        appType: args[0],
        formTitle: args[1],
        fieldsJsonOrFile: args[2],
        ...options
      };
    }

    usage(t('create_form.usage_create_short'));
    hint(t('create_form.usage_update_short'));
    hint(t('create_form.example_create'));
    hint(t('create_form.example_update'));
    throwCreateFormError(t('create_form.usage_create_short'), 'CREATE_FORM_INVALID_ARGUMENTS');
  };
}

module.exports = {
  createParseArgs,
  parseInlineValidationOptions,
  parseMaybeJsonValue,
};
