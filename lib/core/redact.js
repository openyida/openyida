'use strict';

const SENSITIVE_KEY_PATTERN = /(^|[_-])(authorization|auth|cookie|csrf|token|secret|password|passwd|api[_-]?key|access[_-]?key|signature|sign)([_-]|$)/i;
const SENSITIVE_CAMEL_KEY_PATTERN = /^(?:authorization|auth|cookie|csrf|token|secret|password|passwd|apiKey|accessKey|signature|sign)(?:[A-Z]|$)|(?:Authorization|Auth|Cookie|Csrf|Token|Secret|Password|Passwd|ApiKey|AccessKey|Signature|Sign)$/;
const EMAIL_PATTERN = /([A-Z0-9._%+-])([A-Z0-9._%+-]*)(@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
const MAINLAND_PHONE_PATTERN = /(^|[^\d])(1[3-9]\d)(\d{4})(\d{4})(?!\d)/g;

function maskString(value, options = {}) {
  const text = String(value);
  const start = options.start === null || options.start === undefined ? 4 : options.start;
  const end = options.end === null || options.end === undefined ? 4 : options.end;

  if (!text) {
    return '';
  }
  if (text.length <= start + end + 3) {
    return '***';
  }

  return `${text.slice(0, start)}***${text.slice(text.length - end)}`;
}

function redactString(value) {
  return String(value)
    .replace(/\bBearer\s+([A-Za-z0-9._~+/=-]+)/gi, 'Bearer ***')
    .replace(/\bBasic\s+([A-Za-z0-9._~+/=-]+)/gi, 'Basic ***')
    .replace(/(access[_-]?token|csrf[_-]?token|api[_-]?key|secret|password|token)=([^&\s]+)/gi, '$1=***')
    .replace(/(Cookie:\s*)([^\r\n]+)/gi, '$1***')
    .replace(EMAIL_PATTERN, function(_match, first, _middle, domain) {
      return `${first}***${domain}`;
    })
    .replace(MAINLAND_PHONE_PATTERN, function(_match, prefix, first, _middle, last) {
      return `${prefix}${first}****${last}`;
    });
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function shouldMaskKey(key) {
  const text = String(key || '');
  return SENSITIVE_KEY_PATTERN.test(text) || SENSITIVE_CAMEL_KEY_PATTERN.test(text);
}

function redactSensitive(value, options = {}) {
  const seen = options.seen || new WeakSet();
  const key = options.key || '';

  if (value === null || value === undefined) {
    return value;
  }

  if (shouldMaskKey(key)) {
    if (typeof value === 'string') {
      return maskString(value);
    }
    return '***';
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => redactSensitive(item, { seen }));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const redacted = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    redacted[entryKey] = redactSensitive(entryValue, { seen, key: entryKey });
  }
  return redacted;
}

function safeJsonStringify(value, spacing = 2) {
  return JSON.stringify(redactSensitive(value), null, spacing);
}

module.exports = {
  maskString,
  redactSensitive,
  redactString,
  safeJsonStringify,
};
