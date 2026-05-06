'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseCurl,
  detectAuthType,
  filterBrowserHeaders,
} = require('../lib/connector/curl-parser');
const {
  generateOperation,
} = require('../lib/connector/action-generator');
const {
  generateChildList,
  generateExample,
  generateOutputs,
} = require('../lib/connector/response-parser');
const {
  parseAPIDoc,
  convertToOperationConfig,
  MarkdownParser,
  DocParserFactory,
} = require('../lib/connector/doc-parser');
const { generateConnectorDesc } = require('../lib/connector/desc-generator');

describe('connector curl parsing and action generation', () => {
  test('parseCurl extracts URL, method, headers, query path, and JSON body', () => {
    const curlCommand = [
      'curl "https://api.example.com/v1/users/search?q=ada"',
      '-X POST',
      '-H "Authorization: Bearer token"',
      '-H "Content-Type: application/json"',
      '--data-raw \'{"name":"Ada","age":3}\'',
    ].join(' ');
    const parsed = parseCurl(
      curlCommand
    );

    expect(parsed).toMatchObject({
      url: 'https://api.example.com/v1/users/search?q=ada',
      method: 'POST',
      protocol: 'https',
      host: 'api.example.com',
      path: '/v1/users/search?q=ada',
      body: '{"name":"Ada","age":3}',
    });
    expect(parsed.headers.Authorization).toBe('Bearer token');
  });

  test('detectAuthType recognizes common auth headers', () => {
    expect(detectAuthType({ Authorization: 'Bearer abc' })).toMatchObject({
      code: 'ApiKeyAuth',
      headerName: 'Authorization',
    });
    expect(detectAuthType({ Authorization: 'Basic abc' }).code).toBe('BasicAuth');
    expect(detectAuthType({ 'x-acs-dingtalk-access-token': 'tok' }).code).toBe('DingAuth');
    expect(detectAuthType({ 'X-Api-Key': 'key' })).toMatchObject({
      code: 'ApiKeyAuth',
      headerName: 'X-Api-Key',
    });
    expect(detectAuthType({}).code).toBe('NONE');
  });

  test('generateOperation keeps only business headers and mirrors inputs to parameters', () => {
    const curlCommand = [
      'curl "https://api.example.com/v1/users/search?q=ada"',
      '-H "Authorization: Bearer token"',
      '-H "User-Agent: Browser"',
      '--data-raw \'{"name":"Ada","age":3}\'',
    ].join(' ');
    const curlData = parseCurl(
      curlCommand
    );
    const relevantHeaders = filterBrowserHeaders(curlData.headers);
    const operation = generateOperation(curlData, relevantHeaders);

    expect(operation.url).toBe('v1/users/search');
    expect(operation.method).toBe('post');
    expect(operation.operationId).toBe('users_search');
    expect(operation.inputs.map((input) => input.name)).toEqual(['Headers', 'Body', 'Query']);
    expect(operation.parameters.header).toEqual([{ name: 'Authorization', value: 'Bearer token' }]);
    expect(operation.parameters.query).toEqual([{ name: 'q', value: '' }]);
    expect(operation.parameters.body.default).toBe('{"name":"Ada","age":3}');
  });

  test('generateConnectorDesc identifies Yida and generic HTTP connectors', () => {
    expect(generateConnectorDesc(
      { host: 'www.aliwork.com', method: 'POST' },
      { summary: '查询表单' }
    )).toContain('宜搭平台');
    expect(generateConnectorDesc(
      { host: 'api.example.com', method: 'GET' },
      { summary: '查询用户' }
    )).toContain('HTTP API');
  });
});

describe('connector response and API document parsing', () => {
  const schema = {
    type: 'object',
    properties: {
      success: { type: 'boolean', description: '是否成功' },
      data: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'ID' },
            name: { type: 'string', description: '姓名' },
          },
        },
      },
    },
  };

  test('generateExample and generateChildList preserve nested array object fields', () => {
    expect(generateExample(schema)).toEqual({
      success: false,
      data: [{ id: 0, name: '姓名' }],
    });

    const childList = generateChildList(schema, 'op');
    const dataNode = childList.find((node) => node.name === 'data');
    expect(dataNode.paramType).toBe('Array');
    expect(dataNode.childList.map((node) => node.name)).toEqual(['id', 'name']);
  });

  test('generateOutputs returns a Yida-style response object config', () => {
    const outputs = generateOutputs(schema, 'op');
    expect(outputs.name).toBe('Response');
    expect(outputs.paramType).toBe('Object');
    expect(JSON.parse(outputs.defaultValue)).toMatchObject({ success: false });
    expect(outputs.childList).toHaveLength(2);
  });

  test('MarkdownParser and convertToOperationConfig parse docs into an operation config', () => {
    const markdown = [
      '# Search Users',
      '',
      '## Description',
      '',
      'Search users by keyword.',
      '',
      '- URL',
      'https://api.example.com/v1/users/search',
      '- Method',
      'POST',
      '',
      '## 请求头',
      '| 名称 | 类型 | 必填 | 示例 | 描述 |',
      '| --- | --- | --- | --- | --- |',
      '| Authorization | string | 是 | Bearer token | Token |',
      '',
      '## 查询参数',
      '| 名称 | 类型 | 必填 | 示例 | 描述 |',
      '| --- | --- | --- | --- | --- |',
      '| page | integer | 否 | 1 | 页码 |',
      '',
      '## 请求体',
      '```json',
      '{"name":"Ada","age":3}',
      '```',
      '',
      '## 响应',
      '```json',
      '{"success":true,"data":[{"id":1,"name":"Ada"}]}',
      '```',
    ].join('\n');

    const parseResult = new MarkdownParser(markdown).parse();
    const operation = convertToOperationConfig(parseResult);

    expect(parseResult.basicInfo.title).toBe('Search Users');
    expect(parseResult.serverInfo).toMatchObject({
      host: 'api.example.com',
      path: '/v1/users/search',
      method: 'POST',
    });
    expect(operation.summary).toBe('Search Users');
    expect(operation.method).toBe('post');
    expect(operation.parameters.header[0]).toEqual({
      name: 'Authorization',
      value: 'Bearer token',
    });
    expect(operation.parameters.query[0]).toEqual({ name: 'page', value: '1' });
    expect(operation.outputs[0].childList.map((node) => node.name)).toContain('data');
  });

  test('parseAPIDoc reads markdown files through the parser factory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-api-doc-'));
    const docPath = path.join(tempDir, 'api.md');
    fs.writeFileSync(docPath, '# Ping\n\n- URL\nhttps://api.example.com/ping\n- Method\nGET\n', 'utf8');

    try {
      expect(DocParserFactory.createParser(docPath, 'content')).toBeInstanceOf(MarkdownParser);
      expect(parseAPIDoc(docPath).basicInfo.title).toBe('Ping');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
