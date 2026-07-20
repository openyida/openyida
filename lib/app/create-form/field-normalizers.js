'use strict';

/**
 * create-form/field-normalizers.js
 *
 * 表单字段的「选项数据源」与「校验规则」归一化工具集。
 * 这一块逻辑与其余建模流程解耦，只依赖三个外部原语：
 *   - i18n(text, enText, jaText)         构造宜搭多语言文案
 *   - deepMerge(target, source)          深合并 props
 *   - toDesignerValidationRule(rule)     将中间态校验规则转为设计器规则
 *
 * 通过工厂函数注入依赖（沿用 create-form/ 其余子模块的 create* 约定），
 * 保持 create-form.js 主文件对外行为完全不变。
 */

function createFieldNormalizers(deps) {
  const { i18n, deepMerge, toDesignerValidationRule } = deps || {};

  if (typeof i18n !== 'function') {
    throw new Error('createFieldNormalizers requires an i18n function');
  }
  if (typeof deepMerge !== 'function') {
    throw new Error('createFieldNormalizers requires a deepMerge function');
  }
  if (typeof toDesignerValidationRule !== 'function') {
    throw new Error('createFieldNormalizers requires a toDesignerValidationRule function');
  }

  function makeOptionSid(optionIndex) {
    return 'serial_' + Date.now().toString(36) + '_' + optionIndex;
  }

  function pickOptionValue(option, rawText) {
    if (option.value !== undefined) {
      return option.value;
    }
    if (option.id !== undefined) {
      return option.id;
    }
    if (option.key !== undefined) {
      return option.key;
    }
    return rawText;
  }

  function buildOptionDataSource(options) {
    if (!Array.isArray(options)) {
      return [];
    }
    return options.map(function (optionText, optionIndex) {
      return {
        text: i18n(optionText, optionText, optionText),
        value: optionText,
        sid: makeOptionSid(optionIndex),
        disable: false,
        defaultChecked: false,
      };
    });
  }

  function normalizeOptionItem(option, optionIndex) {
    if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
      const optionText = String(option);
      return {
        text: i18n(optionText, optionText, optionText),
        value: optionText,
        sid: makeOptionSid(optionIndex),
        disable: false,
        defaultChecked: false,
      };
    }
    if (option && typeof option === 'object') {
      const rawText = option.text || option.label || option.name || option.title || option.value || '';
      const rawValue = pickOptionValue(option, rawText);
      return {
        text: rawText && typeof rawText === 'object' ? rawText : i18n(String(rawText), String(rawText), String(rawText)),
        value: String(rawValue),
        sid: option.sid || makeOptionSid(optionIndex),
        disable: option.disable || false,
        defaultChecked: option.defaultChecked || false,
      };
    }
    const fallbackText = '选项' + (optionIndex + 1);
    return {
      text: i18n(fallbackText, fallbackText, fallbackText),
      value: fallbackText,
      sid: makeOptionSid(optionIndex),
      disable: false,
      defaultChecked: false,
    };
  }

  function normalizeOptionDataSource(options) {
    if (!Array.isArray(options)) {
      return [];
    }
    return options.map(normalizeOptionItem);
  }

  function normalizeSearchDataType(value, fallback) {
    const raw = String(value || fallback || 'json').trim();
    if (!raw) {
      return 'json';
    }
    return raw.toLowerCase() === 'jsonp' ? 'jsonp' : 'json';
  }

  function buildDefaultBeforeFetchSource(config) {
    if (config.beforeFetch !== undefined) {
      return String(config.beforeFetch);
    }
    const queryParam = config.queryParam || config.keywordParam || 'key';
    const queryParamLiteral = JSON.stringify(queryParam);
    return [
      'function willFetch(params) {',
      '  params = params || {};',
      '  var keyword = params.key || params.q || params.keyword || "";',
      '  params[' + queryParamLiteral + '] = keyword;',
      '  return params;',
      '}',
    ].join('\n');
  }

  function buildDefaultAfterFetchSource(config) {
    if (config.afterFetch !== undefined) {
      return String(config.afterFetch);
    }
    const listPath = JSON.stringify(config.listPath || config.arrayPath || 'data');
    const labelField = JSON.stringify(config.labelField || config.textField || config.labelKey || 'label');
    const valueField = JSON.stringify(config.valueField || config.valueKey || 'value');
    return [
      'function didFetch(content) {',
      '  function readPath(obj, path) {',
      '    if (!path) { return obj; }',
      '    var parts = String(path).split(".");',
      '    var current = obj;',
      '    for (var i = 0; i < parts.length; i++) {',
      '      if (current == null) { return undefined; }',
      '      current = current[parts[i]];',
      '    }',
      '    return current;',
      '  }',
      '  var list = readPath(content, ' + listPath + ');',
      '  if (!Array.isArray(list)) {',
      '    list = content && (content.list || content.items || content.values || content.result || content.data);',
      '  }',
      '  if (!Array.isArray(list)) { list = []; }',
      '  return list.map(function (item) {',
      '    if (item && typeof item === "object") {',
      '      var text = readPath(item, ' + labelField + ');',
      '      var value = readPath(item, ' + valueField + ');',
      '      if (value === undefined || value === null || value === "") { value = text; }',
      '      if (text === undefined || text === null || text === "") { text = value; }',
      '      return { text: String(text || ""), value: String(value || "") };',
      '    }',
      '    return { text: String(item), value: String(item) };',
      '  });',
      '}',
    ].join('\n');
  }

  function normalizeSelectDataSourceConfig(config) {
    const rawConfig = config && typeof config === 'object'
      ? (config.remoteDataSource || config.searchDataSource || config.dataSourceConfig || config)
      : {};
    const searchConfig = rawConfig.searchConfig || {};
    const url = rawConfig.url || rawConfig.endpoint || rawConfig.searchUrl || searchConfig.url || '';
    const dataType = normalizeSearchDataType(rawConfig.dataType || searchConfig.dataType || searchConfig.type, 'json');
    const beforeFetch = buildDefaultBeforeFetchSource(Object.assign({}, rawConfig, searchConfig));
    const afterFetch = buildDefaultAfterFetchSource(Object.assign({}, rawConfig, searchConfig));
    const options = normalizeOptionDataSource(rawConfig.options || rawConfig.initialOptions || rawConfig.dataSource || []);

    return {
      url,
      dataType,
      beforeFetch,
      afterFetch,
      options,
      dataSourceType: rawConfig.dataSourceType || 'custom',
      filterLocal: rawConfig.filterLocal !== undefined ? !!rawConfig.filterLocal : !url,
      showSearch: rawConfig.showSearch !== false,
      placeholder: rawConfig.placeholder,
      notFoundContent: rawConfig.notFoundContent,
      props: rawConfig.props && typeof rawConfig.props === 'object' ? rawConfig.props : null,
    };
  }

  function applySelectDataSourceConfig(props, config) {
    const normalized = normalizeSelectDataSourceConfig(config);
    props.dataSource = normalized.options;
    props.dataSourceType = normalized.dataSourceType;
    props.showSearch = normalized.showSearch;
    props.filterLocal = normalized.filterLocal;

    if (normalized.placeholder !== undefined) {
      props.placeholder = i18n(normalized.placeholder);
    }
    if (normalized.notFoundContent !== undefined) {
      props.notFoundContent = i18n(normalized.notFoundContent);
    }

    props.searchConfig = {
      dataType: normalized.dataType,
      url: normalized.url,
      beforeFetch: normalized.beforeFetch,
      afterFetch: normalized.afterFetch,
    };
    props.defaultDataSource = Object.assign({}, props.defaultDataSource || {}, {
      customStashOptions: props.defaultDataSource && props.defaultDataSource.customStashOptions || [],
      complexType: 'custom',
      options: normalized.options,
      formula: props.defaultDataSource && props.defaultDataSource.formula || { data: [], event: { 'onPageReady,onChange': [] } },
      url: normalized.url,
      searchConfig: {
        type: normalized.dataType.toUpperCase(),
        url: normalized.url,
        beforeFetch: normalized.beforeFetch,
        afterFetch: normalized.afterFetch,
      },
    });

    if (normalized.props) {
      deepMerge(props, normalized.props);
    }
    return normalized;
  }

  function normalizeValidationType(type) {
    const normalized = String(type || '').trim();
    const lower = normalized.toLowerCase();
    const typeMap = {
      mobile: 'mobile',
      phone: 'mobile',
      tel: 'mobile',
      cellphone: 'mobile',
      regex: 'regex',
      regexp: 'regex',
      pattern: 'regex',
      idcard: 'chineseID',
      id_card: 'chineseID',
      identitycard: 'chineseID',
      identity_card: 'chineseID',
      chineseid: 'chineseID',
      chinese_id: 'chineseID',
      bankcard: 'bankCard',
      bank_card: 'bankCard',
      luhn: 'bankCard',
      uscc: 'unifiedSocialCreditCode',
      creditcode: 'unifiedSocialCreditCode',
      credit_code: 'unifiedSocialCreditCode',
      unifiedsocialcreditcode: 'unifiedSocialCreditCode',
      unified_social_credit_code: 'unifiedSocialCreditCode',
      mail: 'email',
      e_mail: 'email',
      email: 'email',
      required: 'required',
      compare: 'compare',
      crossfield: 'compare',
      cross_field: 'compare',
      daterange: 'compare',
      date_range: 'compare',
      dateorder: 'compare',
      date_order: 'compare',
      conditionalrequired: 'conditionalRequired',
      conditional_required: 'conditionalRequired',
      expression: 'custom',
      javascript: 'custom',
      js: 'custom',
      customvalidate: 'customValidate',
      custom_validate: 'customValidate',
      async: 'async',
      remote: 'async',
    };
    return typeMap[lower] || normalized;
  }

  function defaultValidationMessage(type) {
    const messages = {
      required: i18n('此项为必填项', 'This field is required', 'この項目は必須です'),
      regex: i18n('格式不正确', 'Invalid format', '形式が正しくありません'),
      mobile: i18n('请输入正确的手机号', 'Please enter a valid phone number', '正しい電話番号を入力してください'),
      phone: i18n('请输入正确的手机号', 'Please enter a valid phone number', '正しい電話番号を入力してください'),
      idCard: i18n('身份证号不合法', 'Invalid ID card number', '身分証番号が正しくありません'),
      chineseID: i18n('身份证号不合法', 'Invalid ID card number', '身分証番号が正しくありません'),
      bankCard: i18n('银行卡号不合法', 'Invalid bank card number', '銀行カード番号が正しくありません'),
      unifiedSocialCreditCode: i18n('统一社会信用代码不合法', 'Invalid unified social credit code', '統一社会信用コードが正しくありません'),
      email: i18n('请输入正确的邮箱地址', 'Please enter a valid email address', '正しいメールアドレスを入力してください'),
      compare: i18n('字段间逻辑校验未通过', 'Cross-field validation failed', 'フィールド間検証に失敗しました'),
      conditionalRequired: i18n('此项在当前条件下为必填项', 'This field is required for the current condition', '現在の条件ではこの項目は必須です'),
      custom: i18n('自定义校验未通过', 'Custom validation failed', 'カスタム検証に失敗しました'),
      customValidate: i18n('自定义校验未通过', 'Custom validation failed', 'カスタム検証に失敗しました'),
      async: i18n('异步校验未通过', 'Async validation failed', '非同期検証に失敗しました'),
    };
    return messages[type] || i18n('校验未通过', 'Validation failed', '検証に失敗しました');
  }

  function normalizeDesignerValidationRule(rule) {
    if (!rule) {
      return null;
    }
    if (typeof rule === 'string') {
      return { type: normalizeValidationType(rule), message: defaultValidationMessage(normalizeValidationType(rule)) };
    }
    if (typeof rule !== 'object') {
      return null;
    }

    const type = normalizeValidationType(rule.type || rule.validator || rule.kind || (rule.pattern ? 'regex' : ''));
    if (!type) {
      return null;
    }

    const normalized = Object.assign({}, rule, {
      type,
      message: rule.message || rule.errorMessage || rule.tips || defaultValidationMessage(type),
    });

    if (rule.regex !== undefined && normalized.pattern === undefined) {
      normalized.pattern = rule.regex;
    }
    if (rule.domain_whitelist && !normalized.domainWhitelist) {
      normalized.domainWhitelist = String(rule.domain_whitelist).split(',').map(function (item) {
        return item.trim();
      }).filter(Boolean);
    }

    return normalized;
  }

  function isNativeFieldValidationRule(rule) {
    if (!rule || rule.condition || rule.when || rule.api || rule.url || rule.endpoint || rule.targetFieldId) {
      return false;
    }
    if (rule.type === 'email' && rule.domainWhitelist && rule.domainWhitelist.length) {
      return false;
    }
    return [
      'required',
      'number',
      'email',
      'mobile',
      'url',
      'maxLength',
      'minLength',
      'minValue',
      'maxValue',
      'date',
      'money',
      'zipcode',
      'phone',
      'ip',
      'mac',
      'chineseID',
      'customValidate',
    ].indexOf(rule.type) !== -1;
  }

  function validationRuleSignature(rule) {
    const param = rule && rule.param && typeof rule.param === 'object'
      ? JSON.stringify(rule.param)
      : rule && rule.param;
    return [
      rule && rule.type,
      rule && rule.pattern,
      param,
      rule && rule.targetFieldId,
      rule && rule.operator,
      rule && rule.api,
      rule && rule.expression,
      rule && rule.condition ? JSON.stringify(rule.condition) : '',
    ].map(function (value) {
      return value === undefined ? '' : String(value);
    }).join('|');
  }

  function dedupeValidationRules(rules) {
    const seen = new Set();
    return (rules || []).filter(function (rule) {
      const signature = validationRuleSignature(rule);
      if (seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    });
  }

  function collectInputValidationRules(field, options) {
    const rules = [];
    const includeAdvanced = !!(options && options.includeAdvanced);
    const sourceRules = Array.isArray(field && field.validation)
      ? field.validation
      : Array.isArray(field && field.validations)
        ? field.validations
        : [];

    if (field && field.required) {
      rules.push({
        type: 'required',
        message: field.requiredMessage || field.message || defaultValidationMessage('required'),
      });
    }

    if (field && (field.pattern || field.regex)) {
      rules.push({
        type: 'regex',
        pattern: field.pattern || field.regex,
        message: field.message || defaultValidationMessage('regex'),
      });
    }

    sourceRules.forEach(function (rule) {
      const normalized = normalizeDesignerValidationRule(rule);
      if (normalized && (includeAdvanced || isNativeFieldValidationRule(normalized))) {
        rules.push(normalized);
      }
    });

    return dedupeValidationRules(rules);
  }

  function normalizeFieldValidationRules(field, options) {
    return dedupeValidationRules(collectInputValidationRules(field, options).map(function (rule) {
      return toDesignerValidationRule(rule);
    }).filter(Boolean));
  }

  return {
    buildOptionDataSource,
    normalizeOptionItem,
    normalizeOptionDataSource,
    normalizeSearchDataType,
    buildDefaultBeforeFetchSource,
    buildDefaultAfterFetchSource,
    normalizeSelectDataSourceConfig,
    applySelectDataSourceConfig,
    normalizeValidationType,
    defaultValidationMessage,
    normalizeDesignerValidationRule,
    isNativeFieldValidationRule,
    validationRuleSignature,
    dedupeValidationRules,
    collectInputValidationRules,
    normalizeFieldValidationRules,
  };
}

module.exports = { createFieldNormalizers };
