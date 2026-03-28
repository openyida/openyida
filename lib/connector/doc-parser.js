/**
 * API 文档解析模块
 * 支持 Markdown、Word、PDF、URL 等多种格式
 */

const fs = require('fs');
const path = require('path');
const { generateOutputs, generateExample, generateChildList } = require('./response-parser');

/**
 * 文档解析器基类
 */
class BaseDocParser {
  constructor(content) {
    this.content = content;
    this.result = {
      basicInfo: {},
      serverInfo: {},
      authInfo: {},
      requestInfo: {
        headers: [],
        query: [],
        body: null
      },
      responseInfo: {
        schema: null,
        examples: []
      }
    };
  }

  parse() {
    throw new Error('子类必须实现 parse 方法');
  }
}

/**
 * Markdown 文档解析器
 */
class MarkdownParser extends BaseDocParser {
  parse() {
    this.parseBasicInfo();
    this.parseServerInfo();
    this.parseAuthInfo();
    this.parseRequestHeaders();
    this.parseQueryParams();
    this.parseRequestBody();
    this.parseResponseSchema();
    return this.result;
  }

  parseBasicInfo() {
    const titleMatch = this.content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      this.result.basicInfo.title = titleMatch[1].trim();
    }

    const descMatch = this.content.match(/##\s+(.+?)\s*\n\s*\n(.+?)(?=\n##|$)/s);
    if (descMatch) {
      this.result.basicInfo.description = descMatch[2].trim();
    }

    const sourceMatch = this.content.match(/Source:\s*(https?:\/\/\S+)/);
    if (sourceMatch) {
      this.result.basicInfo.sourceUrl = sourceMatch[1];
    }
  }

  parseServerInfo() {
    const urlMatch = this.content.match(/[-*]\s*URL\s*[-:]?\s*\n?\s*(https?:\/\/\S+)/i);
    if (urlMatch) {
      const url = new URL(urlMatch[1]);
      this.result.serverInfo.protocol = url.protocol.replace(':', '');
      this.result.serverInfo.host = url.hostname;
      this.result.serverInfo.basePath = url.pathname.replace(/\/[^/]+$/, '') || '/';
      this.result.serverInfo.path = url.pathname;
    }

    const methodMatch = this.content.match(/[-*]\s*Method\s*[-:]?\s*\n?\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/i);
    if (methodMatch) {
      this.result.serverInfo.method = methodMatch[1].toUpperCase();
    }
  }

  parseAuthInfo() {
    const content = this.content;

    if (content.includes('Bearer') || content.match(/Authorization.*Bearer/i)) {
      this.result.authInfo.type = 'API密钥';
      this.result.authInfo.scheme = 'bearer';
      this.result.authInfo.details = 'Bearer Token 鉴权';
    } else if (content.includes('Basic Auth') || content.match(/基本身份验证/i)) {
      this.result.authInfo.type = '基本身份验证';
      this.result.authInfo.scheme = 'basic';
    } else if (content.includes('钉钉') || content.includes('DingTalk') || content.includes('x-acs-dingtalk')) {
      this.result.authInfo.type = '钉钉开放平台验证';
      this.result.authInfo.scheme = 'dingtalk';
    }

    const authHeaderMatch = content.match(/Authorization\s+string\s+[*]*\s*(.+?)(?=\n\S|$)/s);
    if (authHeaderMatch) {
      this.result.authInfo.description = authHeaderMatch[1].replace(/\n/g, ' ').trim();
    }
  }

  parseRequestHeaders() {
    const headerSection = this.extractSection('请求头', '请求参数');
    if (headerSection) {
      this.result.requestInfo.headers = this.parseTable(headerSection);
    }
  }

  parseQueryParams() {
    const querySection = this.extractSection('查询参数', '请求体');
    if (querySection) {
      this.result.requestInfo.query = this.parseTable(querySection);
    }
  }

  parseRequestBody() {
    const bodySection = this.extractSection('请求体', '响应');
    if (!bodySection) {return;}

    const jsonMatch = bodySection.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const example = JSON.parse(jsonMatch[1]);
        this.result.requestInfo.body = {
          example: example,
          schema: this.inferSchemaFromExample(example)
        };
      } catch (e) {
        // JSON 解析失败，忽略
      }
    }

    const fields = this.parseTable(bodySection);
    if (fields.length > 0 && this.result.requestInfo.body) {
      fields.forEach(field => {
        const propName = field.name || field.fieldName;
        if (propName && this.result.requestInfo.body.schema.properties[propName]) {
          this.result.requestInfo.body.schema.properties[propName].description =
            field.description || field.desc || field.type || '';
        }
      });
    }
  }

  parseResponseSchema() {
    const responseSection = this.extractSection('响应', '错误码');
    if (!responseSection) {return;}

    const jsonMatch = responseSection.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const example = JSON.parse(jsonMatch[1]);
        this.result.responseInfo.examples.push(example);
        this.result.responseInfo.schema = this.inferSchemaFromExample(example);
      } catch (e) {
        // JSON 解析失败，忽略
      }
    }

    const schema = { type: 'object', properties: {} };
    const lines = responseSection.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line || line.match(/^#/) || line.includes('HTTP 状态码')) {continue;}

      if (line && !line.includes(':') && !line.includes('{')) {
        const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
        const nextNextLine = lines[i + 2] ? lines[i + 2].trim() : '';

        if (nextLine.match(/^(string|integer|number|boolean|array|object)\b/) ||
            nextLine.match(/^array\[/) ||
            nextLine.match(/^{\d+}/)) {
          const fieldName = line.replace(/\*$/, '').trim();
          const fieldType = this.parseFieldType(nextLine);
          const description = nextNextLine && !nextNextLine.match(/^(string|integer|number|boolean|array|object)\b/)
            ? nextNextLine
            : '';

          schema.properties[fieldName] = {
            type: fieldType.type,
            description: description,
            items: fieldType.items
          };

          i += description ? 2 : 1;
        }
      }
    }

    if (Object.keys(schema.properties).length > 0) {
      this.result.responseInfo.schema = schema;
    }
  }

  parseFieldType(typeStr) {
    const arrayMatch = typeStr.match(/^array\[(\w+)]/);
    if (arrayMatch) {
      return {
        type: 'array',
        items: { type: this.mapType(arrayMatch[1]) }
      };
    }

    const objectMatch = typeStr.match(/^object\{(\d+)\}/);
    if (objectMatch) {
      return {
        type: 'object',
        description: `包含 ${objectMatch[1]} 个字段`
      };
    }

    return { type: this.mapType(typeStr) };
  }

  inferSchemaFromExample(example) {
    const schema = { type: 'object', properties: {} };

    for (const [key, value] of Object.entries(example)) {
      schema.properties[key] = this.inferType(value, key);
    }

    return schema;
  }

  inferType(value, key = '') {
    if (value === null) {
      return { type: 'null' };
    }

    const type = typeof value;

    if (type === 'string') {
      if (key.toLowerCase().includes('time') || key.toLowerCase().includes('date') || key.toLowerCase().includes('at')) {
        return { type: 'string', format: 'date-time' };
      }
      return { type: 'string' };
    }

    if (type === 'number') {
      return { type: Number.isInteger(value) ? 'integer' : 'number' };
    }

    if (type === 'boolean') {
      return { type: 'boolean' };
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        return {
          type: 'array',
          items: this.inferType(value[0])
        };
      }
      return { type: 'array' };
    }

    if (type === 'object') {
      return this.inferSchemaFromExample(value);
    }

    return { type: 'string' };
  }

  mapType(typeStr) {
    const typeMap = {
      'string': 'string',
      'integer': 'integer',
      'int': 'integer',
      'number': 'number',
      'boolean': 'boolean',
      'bool': 'boolean',
      'array': 'array',
      'object': 'object',
      'file': 'string'
    };

    return typeMap[typeStr.toLowerCase()] || 'string';
  }

  extractSection(startMarker, endMarker) {
    const startIndex = this.content.indexOf(startMarker);
    if (startIndex === -1) {return null;}

    let endIndex = this.content.length;
    if (endMarker) {
      const endMatch = this.content.indexOf(endMarker, startIndex + startMarker.length);
      if (endMatch !== -1) {
        endIndex = endMatch;
      }
    }

    return this.content.substring(startIndex, endIndex);
  }

  parseTable(section) {
    const lines = section.split('\n').filter(line => line.trim());
    const results = [];

    const tableLines = lines.filter(line => line.includes('|'));

    if (tableLines.length < 2) {return results;}

    const headerLine = tableLines[0];
    const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);

    for (let i = 2; i < tableLines.length; i++) {
      const cells = tableLines[i].split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        const item = {};
        headers.forEach((header, index) => {
          const key = this.normalizeHeader(header);
          item[key] = cells[index] || '';
        });
        results.push(item);
      }
    }

    return results;
  }

  normalizeHeader(header) {
    const headerMap = {
      '名称': 'name',
      'name': 'name',
      '类型': 'type',
      'type': 'type',
      '必填': 'required',
      'required': 'required',
      '示例值': 'example',
      '示例': 'example',
      'example': 'example',
      '描述': 'description',
      '说明': 'description'
    };

    return headerMap[header] || header.toLowerCase();
  }
}

/**
 * 文档解析器工厂
 */
class DocParserFactory {
  static createParser(filePath, content) {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.md':
      case '.markdown':
        return new MarkdownParser(content);
      case '.txt':
        return new MarkdownParser(content);
      case '.doc':
      case '.docx':
        throw new Error('Word 文档解析需要安装额外依赖，请使用 Markdown 格式或提供文本内容');
      case '.pdf':
        throw new Error('PDF 解析需要安装额外依赖，请使用 Markdown 格式或提供文本内容');
      default:
        return new MarkdownParser(content);
    }
  }
}

/**
 * 解析 API 文档主函数
 * @param {string} filePath - 文档路径
 * @returns {Object} 解析结果
 */
function parseAPIDoc(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parser = DocParserFactory.createParser(filePath, content);
    return parser.parse();
  } catch (error) {
    throw new Error(`解析文档失败: ${error.message}`);
  }
}

/**
 * 将解析结果转换为连接器操作配置
 * @param {Object} parseResult - 解析结果
 * @returns {Object} 操作配置
 */
function convertToOperationConfig(parseResult) {
  const operation = {
    id: `operation-${Date.now()}`,
    operationId: parseResult.basicInfo.title?.replace(/\s+/g, '_') || 'operation',
    summary: parseResult.basicInfo.title || '未命名操作',
    description: parseResult.basicInfo.description || '',
    url: parseResult.serverInfo.path || '',
    method: (parseResult.serverInfo.method || 'GET').toLowerCase(),
    inputs: [],
    parameters: {
      header: [],
      query: []
    },
    responses: {},
    outputs: [{
      defaultValue: '{}',
      desc: '响应体结构',
      name: 'Response',
      paramType: 'Object',
      required: false,
      childList: []
    }],
    origin: true
  };

  // 转换请求头
  if (parseResult.requestInfo.headers && parseResult.requestInfo.headers.length > 0) {
    const headerChildren = parseResult.requestInfo.headers.map(h => ({
      _key: `${operation.operationId}%${h.name}`,
      name: h.name,
      paramType: 'String',
      desc: h.description || h.name,
      componentName: 'TextField',
      children: [],
      childList: [],
      __level: 0,
      hidden: false,
      required: h.required === 'true' || h.required === '是' || h.required === '**' || h.required === true,
      defaultValue: h.example || h.value || ''
    }));

    operation.inputs.push({
      childList: headerChildren,
      desc: '请求头',
      name: 'Headers',
      paramType: 'Object',
      required: false
    });

    operation.parameters.header = parseResult.requestInfo.headers.map(h => ({
      name: h.name,
      value: h.example || h.value || ''
    }));
  }

  // 转换查询参数
  if (parseResult.requestInfo.query && parseResult.requestInfo.query.length > 0) {
    const queryChildren = parseResult.requestInfo.query.map(q => ({
      _key: `${operation.operationId}%${q.name}`,
      name: q.name,
      paramType: q.type === 'integer' || q.type === 'number' ? 'Number' : 'String',
      desc: q.description || q.name,
      children: [],
      childList: [],
      __level: 0,
      hidden: false
    }));

    operation.inputs.push({
      childList: queryChildren,
      desc: '查询参数',
      name: 'Query',
      paramType: 'Object',
      required: false
    });

    operation.parameters.query = parseResult.requestInfo.query.map(q => ({
      name: q.name,
      value: q.example || q.value || ''
    }));
  }

  // 处理请求 Body
  if (parseResult.requestInfo.body && parseResult.requestInfo.body.schema) {
    const requestSchema = parseResult.requestInfo.body.schema;
    const requestExample = generateExample(requestSchema);

    operation.parameters.body = {
      default: JSON.stringify(requestExample)
    };

    const requestChildList = generateChildList(requestSchema, operation.operationId);
    if (requestChildList.length > 0) {
      operation.inputs.push({
        defaultValue: JSON.stringify(requestExample),
        desc: '请求体',
        name: 'Body',
        paramType: 'Object',
        required: false,
        childList: requestChildList
      });
    }
  }

  // 处理响应格式
  if (parseResult.responseInfo.schema) {
    const responseSchema = parseResult.responseInfo.schema;
    operation.responses = responseSchema;

    if (!operation.parameters.body) {
      const example = generateExample(responseSchema);
      operation.parameters.body = {
        default: JSON.stringify(example)
      };
    }

    operation.outputs = [generateOutputs(responseSchema, operation.operationId)];
  } else {
    operation.responses = { type: 'object' };
  }

  return operation;
}

module.exports = {
  parseAPIDoc,
  convertToOperationConfig,
  MarkdownParser,
  DocParserFactory
};
