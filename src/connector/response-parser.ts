/**
 * 宜搭响应格式解析器
 * 模拟宜搭前端的 "解析 Body" 逻辑
 */

/**
 * 类型映射
 */
const TYPE_MAP: Record<string, string> = {
  'string': 'String',
  'number': 'Number',
  'integer': 'Number',
  'boolean': 'Boolean',
  'object': 'Object',
  'array': 'Array'
};

interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  description?: string;
  format?: string;
}

interface ChildListNode {
  _key: string;
  name: string;
  paramType: string;
  desc: string;
  componentName: string;
  children: ChildListNode[];
  childList: ChildListNode[];
  __level: number;
  hidden: boolean;
}

/**
 * 从 JSON Schema 生成 childList
 */
function generateChildList(schema: JsonSchema, operationId: string, parentKey: string = '', level: number = 0): ChildListNode[] {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return [];
  }

  const result: ChildListNode[] = [];

  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    const key = parentKey
      ? `${parentKey}%${fieldName}`
      : `${operationId}%${fieldName}`;

    const node: ChildListNode = {
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
 */
function generateExample(schema: JsonSchema | null): any {
  if (!schema) {return null;}

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
        const obj: Record<string, any> = {};
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
 */
function generateOutputs(schema: JsonSchema, operationId: string): any {
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

export {
  generateChildList,
  generateExample,
  generateOutputs,
  TYPE_MAP
};
