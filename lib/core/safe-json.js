/**
 * safe-json.js - 更友好的 JSON 解析工具
 *
 * 解决两类高频问题：
 *   #2 严格 JSON.parse 报错信息晦涩（如 "Expected property name or '}' in JSON at position 1"），
 *      用户看不出到底哪里写错了。这里在解析失败时给出「疑似原因 + 出错位置 + 片段定位 + 修复建议」。
 *   #3 输入常带 BOM、首尾空白或从聊天/文档里粘来的智能引号（“ ” ‘ ’），
 *      导致本应合法的 JSON 解析失败。这里做输入预处理，并在仅智能引号导致失败时自动纠正一次。
 *
 * 注意：本工具不做「宽松解析」（不支持无引号键、单引号、尾逗号等非法 JSON）——
 * 只在标准 JSON 基础上做无损预处理与失败诊断，保持与 JSON.parse 语义一致。
 */

'use strict';

const { t } = require('./i18n');
const { warn } = require('./chalk');

/**
 * 预处理 JSON 输入：转字符串、去除 BOM、去除首尾空白。
 * @param {*} input
 * @returns {string}
 */
function preprocessJsonInput(input) {
  let s = typeof input === 'string' ? input : String(input);
  // 去除 UTF-8 BOM（U+FEFF）
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
  }
  return s.trim();
}

/**
 * 将中文/智能引号规整为标准 ASCII 引号。仅在失败恢复路径使用。
 * @param {string} s
 * @returns {string}
 */
function normalizeSmartQuotes(s) {
  return s
    .replace(/[“”]/g, '"') // “ ” → "
    .replace(/[‘’]/g, "'"); // ‘ ’ → '
}

/**
 * 从 V8 报错信息中提取出错位置（position N）。
 * @param {string} message
 * @returns {number} 找不到时返回 -1
 */
function extractPosition(message) {
  const match = /position (\d+)/.exec(message || '');
  return match ? parseInt(match[1], 10) : -1;
}

/**
 * 根据出错位置附近的字符推断疑似原因，返回本地化提示。
 * @param {string} text - 预处理后的输入
 * @param {number} pos - 出错位置
 * @param {string} message - 原始报错信息
 * @returns {string}
 */
function diagnoseCause(text, pos, message) {
  // 智能引号：整个文本里只要还残留智能引号，基本就是它
  if (/[“”‘’]/.test(text)) {
    return t('safe_json.hint_smart_quote');
  }
  const ch = pos >= 0 && pos < text.length ? text[pos] : '';
  // 单引号
  if (ch === "'") {
    return t('safe_json.hint_single_quote');
  }
  // 尾逗号：定位到 } 或 ]，往前找到第一个非空白字符是逗号
  if (ch === '}' || ch === ']') {
    let i = pos - 1;
    while (i >= 0 && /\s/.test(text[i])) {
      i--;
    }
    if (i >= 0 && text[i] === ',') {
      return t('safe_json.hint_trailing_comma');
    }
  }
  // 无引号键：报错信息提到 property name，或出错字符是标识符起始
  if (/property name/i.test(message || '') || (ch && /[A-Za-z0-9_$]/.test(ch))) {
    return t('safe_json.hint_unquoted_key');
  }
  // 全文启发式兜底（新版 Node 报错信息可能不含 position，无法按位置定位）
  if (/,\s*[}\]]/.test(text)) {
    return t('safe_json.hint_trailing_comma');
  }
  if (/[{,]\s*[A-Za-z_$][\w$]*\s*:/.test(text)) {
    return t('safe_json.hint_unquoted_key');
  }
  if (text.includes("'")) {
    return t('safe_json.hint_single_quote');
  }
  return t('safe_json.hint_generic');
}

/**
 * 在出错位置生成带指示符（^）的代码片段，便于肉眼定位。
 * @param {string} text
 * @param {number} pos
 * @returns {string}
 */
function buildSnippet(text, pos) {
  if (pos < 0) {
    return '';
  }
  const start = Math.max(0, pos - 20);
  const end = Math.min(text.length, pos + 20);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  // 片段中的换行/制表替换为空格，避免打乱 caret 对齐
  const rawSlice = text.slice(start, end).replace(/[\n\r\t]/g, ' ');
  const snippet = prefix + rawSlice + suffix;
  const caretOffset = prefix.length + (pos - start);
  const caretLine = ' '.repeat(caretOffset) + '^';
  return `\n  ${snippet}\n  ${caretLine}`;
}

/**
 * 组装友好的诊断信息。
 * @param {string} text - 预处理后的输入
 * @param {Error} err - JSON.parse 抛出的错误
 * @returns {string}
 */
function buildDiagnostic(text, err) {
  const message = err && err.message ? err.message : String(err);
  const pos = extractPosition(message);
  const cause = diagnoseCause(text, pos, message);
  const parts = [`${t('safe_json.label_cause')}${cause}`];
  if (pos >= 0) {
    parts.push(`${t('safe_json.label_position')}${pos}`);
  }
  const snippet = buildSnippet(text, pos);
  if (snippet) {
    parts.push(snippet);
  }
  parts.push(`${t('safe_json.label_raw')}${message}`);
  parts.push(`${t('safe_json.label_suggestion')}${t('safe_json.suggestion_file')}`);
  return parts.join('\n');
}

/**
 * 安全解析 JSON：预处理（#3）+ 失败友好诊断（#2）。
 *
 * 成功返回解析结果；失败抛出 Error，其 message 为本地化的完整诊断文本。
 * 仅当输入含智能引号且规整后可解析时，会自动纠正一次并打印一条 warn。
 *
 * @param {*} input - 原始 JSON 字符串（或可 String() 化的值）
 * @param {object} [options]
 * @param {boolean} [options.recoverSmartQuotes=true] - 是否尝试智能引号自动纠正
 * @returns {*} 解析结果
 */
function safeParseJson(input, options = {}) {
  const { recoverSmartQuotes = true } = options;
  const text = preprocessJsonInput(input);
  try {
    return JSON.parse(text);
  } catch (err) {
    // 失败恢复：仅智能引号导致的失败，规整后重试一次
    if (recoverSmartQuotes) {
      const normalized = normalizeSmartQuotes(text);
      if (normalized !== text) {
        try {
          const value = JSON.parse(normalized);
          warn(t('safe_json.recovered_smart_quote'));
          return value;
        } catch {
          // 规整后仍失败，走通用诊断
        }
      }
    }
    const diagnostic = new Error(buildDiagnostic(text, err));
    diagnostic.original = err;
    throw diagnostic;
  }
}

module.exports = {
  safeParseJson,
  preprocessJsonInput,
  normalizeSmartQuotes,
};
