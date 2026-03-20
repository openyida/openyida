/**
 * 宜搭响应格式解析器
 * 模拟宜搭前端的 "解析 Body" 逻辑
 */

/**
 * 类型映射
 */
const TYPE_MAP = {
  'string': 'String',
  'number': 'Number',
  'integer': 'Number',
  'boolean': 'Boolean',
  'object': 'Object',
  'array': 'Array'
};

/**
 * 从 JSON Schema 生成 childList
 * @param {Object} schema - JSON Schema
 * @param {string} operationId - 操作ID
 * @param {string} parentKey - 父级 key
 * @param {number} level - 层级
 * @returns {Array} childList
 */
function generateChildList(schema, operationId, parentKey = '', level = 0) {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return [];
  }

  const result = [];

  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    const key = parentKey
      ? `${parentKey}%${fieldName}`
      : `${operationId}%${fieldName}`;

    const node = {
      _key: key,
      name: fieldName,
      paramType: TYPE_MAP[fieldSchema.type] || 'String',
      desc: fieldSchema.description || '',
      componentName: 'TextField',
      children: [],
      childList: [],
      __level: level,
      hidden: false
    };

    // 处理嵌套对象
    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      const children = generateChildList(fieldSchema, operationId, key, level + 1);
      node.children = children;
      node.childList = children;
    }

    // 处理数组
    if (fieldSchema.type === 'array' && fieldSchema.items) {
      if (fieldSchema.items.type === 'object' && fieldSchema.items.properties) {
        const children = generateChildList(fieldSchema.items, operationId, key, level + 1);
        node.children = children;
        node.childList = children;
      }
    }

    result.push(node);
  }

  return result;
}

/**
 * 从 JSON Schema 生成示例数据
 * @param {Object} schema - JSON Schema
 * @returns {Object} 示例数据
 */
function generateExample(schema) {
  if (!schema) return null;

  switch (schema.type) {
    case 'string':
      return schema.description || '';

    case 'number':
    case 'integer':
      return 0;

    case 'boolean':
      return false;

    case 'array':
      if (schema.items) {
        const item = generateExample(schema.items);
        return item ? [item] : [];
      }
      return [];

    case 'object':
      if (schema.properties) {
        const obj = {};
        for (const [key, value] of Object.entries(schema.properties)) {
          obj[key] = generateExample(value);
        }
        return obj;
      }
      return {};

    default:
      return null;
  }
}

/**
 * 生成完整的 outputs 配置
 * @param {Object} schema - JSON Schema
 * @param {string} operationId - 操作ID
 * @returns {Object} outputs 配置
 */
function generateOutputs(schema, operationId) {
  const example = generateExample(schema);
  const childList = generateChildList(schema, operationId);

  return {
    defaultValue: JSON.stringify(example, null, 2),
    desc: '响应体结构',
    name: 'Response',
    paramType: 'Object',
    required: false,
    childList: childList
  };
}

module.exports = {
  generateChildList,
  generateExample,
  generateOutputs,
  TYPE_MAP
};
