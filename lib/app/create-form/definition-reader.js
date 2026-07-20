'use strict';

function readJsonInput(value, options) {
  const { fs, path, error, missingMessage, inlineObject = false } = options;
  const text = String(value || '');
  const trimmed = text.trimStart();
  const isInline = trimmed.startsWith('[') || (inlineObject && trimmed.startsWith('{'));

  if (isInline) {
    return text;
  }

  const resolvedPath = path.resolve(text);
  if (!fs.existsSync(resolvedPath)) {
    error(missingMessage + resolvedPath);
  }
  return fs.readFileSync(resolvedPath, 'utf-8');
}

function createDefinitionReaders(dependencies) {
  const {
    fs,
    path,
    safeParseJson,
    error,
    t,
  } = dependencies;

  function readFieldsDefinition(fieldsJsonOrFile) {
    const rawContent = readJsonInput(fieldsJsonOrFile, {
      fs,
      path,
      error,
      inlineObject: true,
      missingMessage: t('create_form.fields_file_not_found'),
    });

    try {
      const parsed = safeParseJson(rawContent);

      let fields;
      let validations = [];
      let columns = 1;

      if (Array.isArray(parsed)) {
        fields = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        fields = parsed.fields || [];
        columns = parsed.columns !== undefined ? parsed.columns : 1;
        if (Array.isArray(parsed.validations)) {
          validations = parsed.validations;
        } else if (Array.isArray(parsed.rules)) {
          validations = parsed.rules;
        }
      } else {
        throw new Error(t('create_form.fields_format_invalid'));
      }

      if (!Array.isArray(fields) || fields.length === 0) {
        throw new Error(t('create_form.fields_must_be_array'));
      }

      return { fields, columns, validations };
    } catch (parseError) {
      error(t('create_form.fields_parse_failed') + parseError.message);
    }
  }

  function readChangesDefinition(changesJsonOrFile) {
    const rawContent = readJsonInput(changesJsonOrFile, {
      fs,
      path,
      error,
      missingMessage: t('create_form.changes_file_not_found'),
    });

    try {
      const changes = safeParseJson(rawContent);
      if (!Array.isArray(changes) || changes.length === 0) {
        throw new Error(t('create_form.changes_must_be_array'));
      }
      return changes;
    } catch (parseError) {
      error(t('create_form.changes_parse_failed') + parseError.message);
    }
  }

  function readPatchDefinition(patchJsonOrFile) {
    const rawContent = readJsonInput(patchJsonOrFile, {
      fs,
      path,
      error,
      inlineObject: true,
      missingMessage: t('create_form.patch_file_not_found'),
    });

    try {
      const patch = safeParseJson(rawContent);
      if (Array.isArray(patch)) {
        if (patch.length === 0) {
          throw new Error(t('create_form.patch_must_not_be_empty'));
        }
        return patch;
      }
      if (patch && typeof patch === 'object') {
        if (Array.isArray(patch.operations)) {
          return patch.operations;
        }
        if (patch.action || patch.op) {
          return [patch];
        }
      }
      throw new Error(t('create_form.patch_invalid_shape'));
    } catch (parseError) {
      error(t('create_form.patch_parse_failed') + parseError.message);
    }
  }

  function readRuleDefinition(rulesJsonOrFile) {
    const rawContent = readJsonInput(rulesJsonOrFile, {
      fs,
      path,
      error,
      inlineObject: true,
      missingMessage: t('create_form.rule_file_not_found'),
    });

    try {
      const parsed = safeParseJson(rawContent);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          throw new Error(t('create_form.rule_array_empty'));
        }
        return parsed;
      }
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.rules)) {
          if (parsed.rules.length === 0) {
            throw new Error(t('create_form.rules_array_empty'));
          }
          return parsed.rules;
        }
        if (parsed.type || parsed.action || parsed.when || parsed.target || parsed.targets) {
          return [parsed];
        }
      }
      throw new Error(t('create_form.rule_invalid_shape'));
    } catch (parseError) {
      error(t('create_form.rule_parse_failed') + parseError.message);
    }
  }

  function readValidationDefinition(validationJsonOrFile, inlineRule) {
    if (inlineRule) {
      return [inlineRule];
    }

    const rawContent = readJsonInput(validationJsonOrFile, {
      fs,
      path,
      error,
      inlineObject: true,
      missingMessage: t('create_form.validation_file_not_found'),
    });

    try {
      const parsed = safeParseJson(rawContent);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          throw new Error(t('create_form.validation_array_empty'));
        }
        return parsed;
      }
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.validations)) {
          if (parsed.validations.length === 0) {
            throw new Error(t('create_form.validations_array_empty'));
          }
          return parsed.validations;
        }
        if (Array.isArray(parsed.rules)) {
          if (parsed.rules.length === 0) {
            throw new Error(t('create_form.rules_array_empty'));
          }
          return parsed.rules;
        }
        if (parsed.type || parsed.field || parsed.fieldId || parsed.target || parsed.when) {
          return [parsed];
        }
      }
      throw new Error(t('create_form.validation_invalid_shape'));
    } catch (parseError) {
      error(t('create_form.validation_parse_failed') + parseError.message);
    }
  }

  function readDataSourceDefinition(dataSourceJsonOrFile) {
    const rawContent = readJsonInput(dataSourceJsonOrFile, {
      fs,
      path,
      error,
      inlineObject: true,
      missingMessage: t('create_form.datasource_file_not_found'),
    });

    try {
      const parsed = safeParseJson(rawContent);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(t('create_form.datasource_must_be_object'));
      }
      return parsed;
    } catch (parseError) {
      error(t('create_form.datasource_parse_failed') + parseError.message);
    }
  }

  return {
    readFieldsDefinition,
    readChangesDefinition,
    readPatchDefinition,
    readRuleDefinition,
    readValidationDefinition,
    readDataSourceDefinition,
  };
}

module.exports = {
  createDefinitionReaders,
  readJsonInput,
};
