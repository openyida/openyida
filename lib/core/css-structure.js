'use strict';

/**
 * 检查静态 CSS 的括号、字符串和注释闭合；忽略转义及字面量中的括号。
 * 供页面编译和应用主题共用，不验证属性支持或浏览器渲染效果。
 */
function findCssStructureIssue(css) {
  const stack = [];
  const pairs = { '(': ')', '[': ']', '{': '}' };
  for (let index = 0; index < css.length; index++) {
    const char = css[index];
    if (char === '\\') { index++; continue; }
    if (char === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2);
      if (end < 0) { return { index, type: 'unclosed_comment' }; }
      index = end + 1;
    } else if (char === '"' || char === "'") {
      const start = index;
      for (index++; index < css.length; index++) {
        if (css[index] === '\\') { index++; continue; }
        if (css[index] === char) { break; }
      }
      if (index >= css.length) { return { index: start, type: 'unclosed_string' }; }
    } else if (pairs[char]) {
      stack.push({ char, index });
    } else if (')]}'.includes(char)) {
      const open = stack.pop();
      if (!open || pairs[open.char] !== char) {
        return { index: open ? open.index : index, type: 'mismatched_delimiter', expected: open && pairs[open.char], actual: char };
      }
    }
  }
  const open = stack.pop();
  return open ? { index: open.index, type: 'unclosed_delimiter', expected: pairs[open.char] } : null;
}

module.exports = { findCssStructureIssue };
