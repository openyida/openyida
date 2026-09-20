'use strict';

// Shared by Plan authoring and the final Fast/Plan document check.
function concretePageText(value) {
  if (typeof value !== 'string' || !value.trim()) {return false;}
  const text = value.trim().replace(/^(?:\*\*|`)|(?:\*\*|`)$/g, '').trim();
  return !/草稿待补充/.test(text)
    && !/^(?:继承主题|继承全局|遵循主题|遵循全局|同全局|同上|按主题执行|按全局执行|待補充|待补充|待定|TBD|TODO|[-—])[。.!！]*$/i.test(text);
}

module.exports = { concretePageText };
