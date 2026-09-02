'use strict';

const { buildYidaI18n } = require('../../core/yida-i18n');

function i18n(text, enText, jaText) {
  return buildYidaI18n(text, {
    en_US: enText || text,
    ja_JP: jaText || text,
  });
}

function deepMerge(target, source) {
  Object.keys(source || {}).forEach(function (key) {
    const sourceValue = source[key];
    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });
  return target;
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
    'regex',
  ].indexOf(rule.type) !== -1;
}

function isAdvancedValidationRule(rule) {
  if (!rule || isNativeFieldValidationRule(rule)) {
    return false;
  }
  return ['bankCard', 'unifiedSocialCreditCode', 'email', 'compare', 'conditionalRequired', 'custom', 'async'].indexOf(rule.type) !== -1;
}

function jsString(value) {
  return JSON.stringify(value === undefined ? '' : value);
}

function compileCustomValidateSource(source) {
  const funcSource = String(source || 'function validateRule(value) { return true; }').trim();
  return 'function main(){\n    \n    "use strict";\n\nvar __compiledFunc__ = '
    + funcSource
    + ';\n    return __compiledFunc__.apply(this, arguments);\n  }';
}

function normalizeCustomValidateParam(param) {
  if (param && typeof param === 'object' && param.type === 'js') {
    const source = param.source || 'function validateRule(value) { return true; }';
    return {
      compiled: param.compiled || compileCustomValidateSource(source),
      source: source,
      type: 'js',
      error: param.error || {},
    };
  }
  let funcSource = typeof param === 'string' ? param
    : (param && typeof param === 'object' && param.type === 'JSExpression') ? String(param.value || '')
      : String(param || '');
  if (!funcSource || !/function/.test(funcSource)) {
    funcSource = 'function validateRule(value) { return true; }';
  }
  return {
    compiled: compileCustomValidateSource(funcSource),
    source: funcSource,
    type: 'js',
    error: {},
  };
}

function buildCustomValidateExpressionParam(rule) {
  return normalizeCustomValidateParam(buildCustomValidateParam(rule));
}

function buildCustomValidateParam(rule) {
  if (rule.type === 'customValidate' && rule.param) {
    if (typeof rule.param === 'object' && rule.param.type === 'js') {
      return rule.param;
    }
    return typeof rule.param === 'object' && rule.param.type === 'JSExpression'
      ? String(rule.param.value || '')
      : String(rule.param);
  }

  const fieldId = jsString(rule.fieldId);
  const targetFieldId = jsString(rule.targetFieldId || '');
  const operator = jsString(rule.operator || '<=');
  const pattern = jsString(rule.pattern || '');
  const expression = jsString(rule.expression || 'true');
  const condition = JSON.stringify(rule.condition || null);
  const domainWhitelist = JSON.stringify(rule.domainWhitelist || []);
  const api = jsString(rule.api || '');
  const method = jsString(rule.method || 'POST');
  const headers = JSON.stringify(rule.headers || {});
  const body = JSON.stringify(rule.body === undefined ? null : rule.body);
  const validPath = jsString(rule.validPath || '');

  return `function validateRule(value, currentRule) {
  var FIELD_ID = ${fieldId};
  var TARGET_FIELD_ID = ${targetFieldId};
  var OPERATOR = ${operator};
  var PATTERN = ${pattern};
  var EXPRESSION = ${expression};
  var CONDITION = ${condition};
  var DOMAIN_WHITELIST = ${domainWhitelist};
  var API = ${api};
  var METHOD = ${method};
  var HEADERS = ${headers};
  var BODY = ${body};
  var VALID_PATH = ${validPath};
  var self = this;
  var state = currentRule && currentRule.values || {};
  var ctx = currentRule || {};

  function isEmpty(input) {
    return input === undefined || input === null || input === '' || (Array.isArray(input) && input.length === 0);
  }

  function text(input) {
    if (input === undefined || input === null) { return ''; }
    if (Array.isArray(input)) { return input.join(','); }
    if (typeof input === 'object') {
      if (input.value !== undefined) { return String(input.value).trim(); }
      if (input.label !== undefined) { return String(input.label).trim(); }
      try { return JSON.stringify(input); } catch (err) { return String(input); }
    }
    return String(input).trim();
  }

  function getFieldValue(id) {
    if (!id) { return undefined; }
    try {
      if (ctx && ctx.store && typeof ctx.store.get === 'function') {
        var model = ctx.store.get(id);
        if (model) {
          if (typeof model.getVal === 'function') { return model.getVal(); }
          if (typeof model.getValue === 'function') { return model.getValue(); }
          if (typeof model.get === 'function') { return model.get('value'); }
        }
      }
    } catch (err) {}
    try {
      if (self && typeof self.$ === 'function') {
        var component = self.$(id);
        if (component) {
          if (typeof component.getValue === 'function') { return component.getValue(); }
          if (typeof component.get === 'function') { return component.get('value'); }
        }
      }
    } catch (err) {}
    try {
      if (typeof $ === 'function') {
        var globalComponent = $(id);
        if (globalComponent) {
          if (typeof globalComponent.getValue === 'function') { return globalComponent.getValue(); }
          if (typeof globalComponent.get === 'function') { return globalComponent.get('value'); }
        }
      }
    } catch (err) {}
    if (state && Object.prototype.hasOwnProperty.call(state, id)) { return state[id]; }
    return undefined;
  }

  function comparable(input) {
    if (input instanceof Date) { return input.getTime(); }
    if (typeof input === 'number') { return input; }
    var source = text(input);
    if (/^\\d{13}$/.test(source)) { return Number(source); }
    var parsedDate = Date.parse(source);
    if (!isNaN(parsedDate)) { return parsedDate; }
    var parsedNumber = Number(source);
    return isNaN(parsedNumber) ? source : parsedNumber;
  }

  function match(input, condition) {
    if (!condition || condition.operator === 'always') { return true; }
    var conditionValue = condition.value;
    var op = condition.operator || 'eq';
    if (op === 'empty') { return isEmpty(input); }
    if (op === 'notEmpty') { return !isEmpty(input); }
    if (op === 'in') { return (condition.values || []).indexOf(input) !== -1 || (condition.values || []).indexOf(text(input)) !== -1; }
    if (op === 'notIn') { return (condition.values || []).indexOf(input) === -1 && (condition.values || []).indexOf(text(input)) === -1; }
    if (op === 'contains') { return Array.isArray(input) ? input.indexOf(conditionValue) !== -1 : text(input).indexOf(String(conditionValue)) !== -1; }
    if (op === 'notContains') { return Array.isArray(input) ? input.indexOf(conditionValue) === -1 : text(input).indexOf(String(conditionValue)) === -1; }
    if (op === 'ne') { return input !== conditionValue && text(input) !== String(conditionValue); }
    if (op === 'gt') { return Number(input) > Number(conditionValue); }
    if (op === 'gte') { return Number(input) >= Number(conditionValue); }
    if (op === 'lt') { return Number(input) < Number(conditionValue); }
    if (op === 'lte') { return Number(input) <= Number(conditionValue); }
    return input === conditionValue || text(input) === String(conditionValue);
  }

  function luhn(input) {
    var digits = text(input).replace(/\\s+/g, '');
    if (!/^\\d{12,19}$/.test(digits)) { return false; }
    var sum = 0;
    var shouldDouble = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var digit = Number(digits.charAt(i));
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) { digit -= 9; }
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  function idCard(input) {
    var valueText = text(input).toUpperCase();
    if (!/^\\d{17}[\\dX]$/.test(valueText)) { return false; }
    var year = Number(valueText.slice(6, 10));
    var month = Number(valueText.slice(10, 12));
    var day = Number(valueText.slice(12, 14));
    var date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) { return false; }
    var weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    var checks = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    var sum = 0;
    for (var index = 0; index < 17; index++) {
      sum += Number(valueText.charAt(index)) * weights[index];
    }
    return checks[sum % 11] === valueText.charAt(17);
  }

  function uscc(input) {
    var valueText = text(input).toUpperCase();
    var chars = '0123456789ABCDEFGHJKLMNPQRTUWXY';
    if (!/^[0-9ABCDEFGHJKLMNPQRTUWXY]{18}$/.test(valueText)) { return false; }
    var weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
    var sum = 0;
    for (var index = 0; index < 17; index++) {
      var charIndex = chars.indexOf(valueText.charAt(index));
      if (charIndex === -1) { return false; }
      sum += charIndex * weights[index];
    }
    return chars.charAt((31 - (sum % 31)) % 31) === valueText.charAt(17);
  }

  if (CONDITION) {
    var conditionValue = getFieldValue(CONDITION.fieldId);
    if (!match(conditionValue, CONDITION)) { return true; }
  }
  if (${jsString(rule.type)} !== 'required' && ${jsString(rule.type)} !== 'conditionalRequired' && isEmpty(value)) {
    return true;
  }
  if (${jsString(rule.type)} === 'regex') { return new RegExp(PATTERN).test(text(value)); }
  if (${jsString(rule.type)} === 'idCard' || ${jsString(rule.type)} === 'chineseID') { return idCard(value); }
  if (${jsString(rule.type)} === 'bankCard') { return luhn(value); }
  if (${jsString(rule.type)} === 'unifiedSocialCreditCode') { return uscc(value); }
  if (${jsString(rule.type)} === 'email') {
    var email = text(value);
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { return false; }
    if (DOMAIN_WHITELIST.length) {
      return DOMAIN_WHITELIST.indexOf(email.split('@').pop()) !== -1;
    }
    return true;
  }
  if (${jsString(rule.type)} === 'compare') {
    var targetValue = getFieldValue(TARGET_FIELD_ID);
    if (isEmpty(value) || isEmpty(targetValue)) { return true; }
    var left = comparable(value);
    var right = comparable(targetValue);
    if (OPERATOR === '<' || OPERATOR === 'lt') { return left < right; }
    if (OPERATOR === '<=' || OPERATOR === 'lte') { return left <= right; }
    if (OPERATOR === '>' || OPERATOR === 'gt') { return left > right; }
    if (OPERATOR === '>=' || OPERATOR === 'gte') { return left >= right; }
    if (OPERATOR === '!=' || OPERATOR === '!==' || OPERATOR === 'ne') { return left !== right; }
    return left === right;
  }
  if (${jsString(rule.type)} === 'conditionalRequired') { return !isEmpty(value); }
  if (${jsString(rule.type)} === 'custom') {
    var fields = {};
    if (FIELD_ID) { fields[FIELD_ID] = value; }
    try {
      var result = (new Function('value', 'fields', 'state', 'ctx', 'getFieldValue', 'return (' + EXPRESSION + ');'))(value, fields, state || {}, ctx || {}, getFieldValue);
      return result === true || (result && result.valid === true);
    } catch (err) {
      return false;
    }
  }
  if (${jsString(rule.type)} === 'async') {
    if (!API) { return true; }
    var payload = BODY || { fieldId: FIELD_ID, value: value };
    return fetch(API, {
      method: METHOD || 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, HEADERS || {}),
      body: String(METHOD || 'POST').toUpperCase() === 'GET' ? undefined : JSON.stringify(payload)
    }).then(function(response) {
      return response.json();
    }).then(function(data) {
      if (VALID_PATH) {
        var current = data;
        String(VALID_PATH).split('.').forEach(function(part) {
          current = current && current[part];
        });
        return current !== false;
      }
      return data.valid !== false && data.success !== false && !data.error;
    }).catch(function() {
      return false;
    });
  }
  return true;
}`;
}

function toDesignerValidationRule(rule) {
  if (!rule) {
    return null;
  }

  if (rule.type === 'regex') {
    return {
      type: 'customValidate',
      param: buildCustomValidateExpressionParam(rule),
      message: rule.message,
    };
  }

  if (isAdvancedValidationRule(rule)) {
    return {
      type: 'customValidate',
      param: buildCustomValidateExpressionParam(rule),
      message: rule.message,
    };
  }

  if (!isNativeFieldValidationRule(rule)) {
    return null;
  }
  if (rule.type === 'customValidate' && !rule.param) {
    return null;
  }

  const designerRule = {
    type: rule.type,
    message: rule.message,
  };
  ['param', 'minLength', 'maxLength', 'minValue', 'maxValue'].forEach(function (key) {
    if (rule[key] !== undefined) {
      designerRule[key] = key === 'param' && rule.type === 'customValidate'
        ? normalizeCustomValidateParam(rule[key])
        : rule[key];
    }
  });
  return designerRule;
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

module.exports = {
  collectInputValidationRules,
  dedupeValidationRules,
  deepMerge,
  defaultValidationMessage,
  isNativeFieldValidationRule,
  normalizeDesignerValidationRule,
  normalizeFieldValidationRules,
  normalizeValidationType,
  toDesignerValidationRule,
};
