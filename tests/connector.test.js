'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseCurl,
  extractCurlUrl,
  detectAuthType,
  filterBrowserHeaders,
} = require('../lib/connector/curl-parser');
const {
  generateOperation,
  isSensitiveHeader,
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
const { normalizeOperations } = require('../lib/connector/operation-normalizer');
const { buildOperationsSummary } = require('../lib/connector/api');

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

  test('parseCurl handles bare URL, single quotes, --url and -X before URL', () => {
    // 裸 URL（无引号）
    expect(parseCurl('curl https://api.example.com/v1/items').url)
      .toBe('https://api.example.com/v1/items');
    // 单引号 URL
    expect(parseCurl("curl 'https://api.example.com/v1/items?a=1'").url)
      .toBe('https://api.example.com/v1/items?a=1');
    // --url 参数
    expect(parseCurl('curl --url https://api.example.com/v1/items').url)
      .toBe('https://api.example.com/v1/items');
    // -X POST 在 URL 之前（裸 URL）
    const parsed = parseCurl('curl -X POST https://api.example.com/v1/items -d \'{"a":1}\'');
    expect(parsed.url).toBe('https://api.example.com/v1/items');
    expect(parsed.method).toBe('POST');
  });

  test('extractCurlUrl prioritizes --url, then quoted, then bare URL', () => {
    expect(extractCurlUrl('curl --url "https://a.com/x"')).toBe('https://a.com/x');
    expect(extractCurlUrl('curl -X GET "https://a.com/y"')).toBe('https://a.com/y');
    expect(extractCurlUrl('curl https://a.com/z -H "X: 1"')).toBe('https://a.com/z');
    expect(extractCurlUrl('curl -H "X: 1"')).toBe('');
  });

  test('detectAuthType is case-insensitive for the auth scheme', () => {
    expect(detectAuthType({ Authorization: 'bearer abc' }).code).toBe('ApiKeyAuth');
    expect(detectAuthType({ authorization: 'BASIC abc' }).code).toBe('BasicAuth');
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
    // 安全：敏感头（Authorization）的真实凭证不得写入生成的 Action 配置，应脱敏为空值
    expect(operation.parameters.header).toEqual([{ name: 'Authorization', value: '' }]);
    expect(operation.parameters.query).toEqual([{ name: 'q', value: '' }]);
    expect(operation.parameters.body.default).toBe('{"name":"Ada","age":3}');
  });

  test('generateOperation redacts sensitive header values but keeps business header values', () => {
    const curlCommand = [
      'curl "https://api.example.com/v1/users/search?q=ada"',
      '-H "Authorization: Bearer super-secret-token-value"',
      '-H "X-Tenant-Id: tenant-42"',
    ].join(' ');
    const curlData = parseCurl(curlCommand);
    const relevantHeaders = filterBrowserHeaders(curlData.headers);
    const operation = generateOperation(curlData, relevantHeaders);

    const serialized = JSON.stringify(operation);
    // 真实 token 绝不能出现在生成的配置里
    expect(serialized).not.toContain('super-secret-token-value');
    // 业务头的值应保留
    const tenantHeader = operation.parameters.header.find((h) => h.name === 'X-Tenant-Id');
    expect(tenantHeader.value).toBe('tenant-42');
    const authHeader = operation.parameters.header.find((h) => h.name === 'Authorization');
    expect(authHeader.value).toBe('');
  });

  test('curl Body keeps nested objects, booleans and object-array leaves available for mapping', () => {
    const body = JSON.stringify({ duration: { bizType: 2, options: { enabled: false } },
      rows: [{ amount: 1.5, name: 'first' }], tags: ['a'], empty: [], note: null });
    const operation = normalizeOperations([generateOperation({ path: '/v1/duration', method: 'POST', body }, [])])[0];
    expect(operation.parameters.body.default).toBe(body);
    const roots = operation.inputs.find(input => input.name === 'Body').childList;
    const duration = roots.find(node => node.name === 'duration');
    expect(duration).toMatchObject({ paramType: 'Object', paramLocation: 'body' });
    expect(duration.childList.find(node => node.name === 'bizType').paramType).toBe('Number');
    const enabled = duration.childList.find(node => node.name === 'options').childList[0];
    expect(enabled).toMatchObject({ name: 'enabled', paramType: 'Boolean', paramLocation: 'body',
      _key: 'v1_duration%duration%options%enabled', __level: 2 });
    expect(duration.children).toEqual(duration.childList);
    expect(roots.find(node => node.name === 'rows')).toMatchObject({ paramType: 'Array',
      childList: [expect.objectContaining({ name: 'amount', paramType: 'Number', paramLocation: 'body' }),
        expect.objectContaining({ name: 'name', paramType: 'String' })] });
    expect(roots.find(node => node.name === 'tags').paramType).toBe('Array');
    expect(roots.find(node => node.name === 'empty').childList).toEqual([]);
  });

  test.each(['null', '[{"amount":2}]', 'false', '5', 'raw text'])('preserves raw non-object Body without inventing mapping fields: %s', body => {
    const operation = generateOperation({ path: '/v1/raw', method: 'POST', body }, []);
    expect(operation.parameters.body.default).toBe(body);
    expect(operation.inputs.find(input => input.name === 'Body')).toMatchObject({ paramType: 'String', defaultValue: body });
  });

  test('isSensitiveHeader matches credential-bearing headers case-insensitively', () => {
    expect(isSensitiveHeader('Authorization')).toBe(true);
    expect(isSensitiveHeader('X-Api-Key')).toBe(true);
    expect(isSensitiveHeader('Cookie')).toBe(true);
    expect(isSensitiveHeader('x-acs-dingtalk-access-token')).toBe(true);
    expect(isSensitiveHeader('Content-Type')).toBe(false);
    expect(isSensitiveHeader('X-Tenant-Id')).toBe(false);
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
    expect(outputs.childList.find(field => field.name === 'success'))
      .toMatchObject({ successFlag: true, successCondition: 'isTrue' });
    expect(generateChildList(schema, 'op').find(field => field.name === 'success')).not.toHaveProperty('successFlag');
  });

  test('success conditions only follow a top-level boolean contract and preserve explicit outputs', () => {
    for (const type of ['string', 'integer']) {
      const outputs = generateOutputs({ type: 'object', properties: { success: { type }, code: { type: 'integer' } } }, 'op');
      expect(outputs.childList.every(field => field.successFlag === undefined)).toBe(true);
    }
    const explicit = [{ name: 'Response', paramType: 'Object', childList: [
      { name: 'success', paramType: 'Boolean', successFlag: false, successCondition: '' },
    ] }];
    const [operation] = normalizeOperations({ operationId: 'explicitOutput', url: 'probe', responses: schema, outputs: explicit });
    expect(operation.outputs).toEqual(explicit);
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
    const headersInput = operation.inputs.find((input) => input.name === 'Headers');
    const queryInput = operation.inputs.find((input) => input.name === 'Query');
    const bodyInput = operation.inputs.find((input) => input.name === 'Body');
    expect(headersInput.paramLocation).toBe('header');
    expect(headersInput.childList.map((node) => node.name)).toEqual(['Authorization']);
    expect(headersInput.childList[0].paramLocation).toBe('header');
    expect(queryInput.paramLocation).toBe('query');
    expect(queryInput.childList[0].paramLocation).toBe('query');
    expect(bodyInput.paramLocation).toBe('body');
    expect(bodyInput.childList.map((node) => node.paramLocation)).toEqual(['body', 'body']);
    expect(operation.parameters.header[0]).toEqual({
      name: 'Authorization',
      value: '',
    });
    expect(operation.inputs.find((input) => input.name === 'Headers').childList[0].defaultValue).toBe('');
    expect(JSON.stringify(operation)).not.toContain('Bearer token');
    expect(operation.parameters.query[0]).toEqual({ name: 'page', value: '1' });
    expect(operation.outputs[0].childList.map((node) => node.name)).toContain('data');
  });

  test('convertToOperationConfig does not synthesize request body from response schema', () => {
    const markdown = [
      '# List Users',
      '',
      '- URL',
      'https://api.example.com/v1/users',
      '- Method',
      'GET',
      '',
      '## 响应',
      '```json',
      '{"success":true,"data":[{"id":1}]}',
      '```',
    ].join('\n');

    const operation = convertToOperationConfig(new MarkdownParser(markdown).parse());

    expect(operation.inputs.map((input) => input.name)).not.toContain('Body');
    expect(operation.parameters.body).toBeUndefined();
    expect(operation.outputs[0].childList.map((node) => node.name)).toContain('data');
  });

  test('document action IDs stay stable when a localized title cannot form an ASCII ID', () => {
    const parseResult = new MarkdownParser([
      '# 查询用户',
      '',
      '- URL',
      'https://api.example.com/v1/users/search',
      '- Method',
      'GET',
    ].join('\n')).parse();

    expect(convertToOperationConfig(parseResult)).toMatchObject({
      id: 'operation-v1_users_search',
      operationId: 'v1_users_search',
    });
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

describe('connector operation normalization', () => {
  test.each(['durationAction', 'uuid-123', 17, 0, null, '', {}, 'operation-'])('rejects new IDs that cannot survive a native designer edit: %j', id => {
    expect(() => normalizeOperations([{ id, operationId: 'duration', url: 'v1/duration' }]))
      .toThrow(expect.objectContaining({ code: 'CONNECTOR_OPERATION_UI_ID_INVALID' }));
  });

  test('existing remote IDs remain untouched when normalizing a delete target', () => {
    const [operation] = normalizeOperations([{ id: 'legacy-action', operationId: 'duration', url: 'v1/duration' }],
      { preserveExistingIds: true });
    expect(operation.id).toBe('legacy-action');
  });

  test('rejects duplicate UI IDs even when operationIds differ', () => {
    expect(() => normalizeOperations([
      { id: 'operation-shared', operationId: 'one', url: 'v1/one' },
      { id: 'operation-shared', operationId: 'two', url: 'v1/two' },
    ])).toThrow(expect.objectContaining({ code: 'CONNECTOR_OPERATION_ID_DUPLICATE' }));
  });
  test('normalizes legacy name/path actions before saving to Yida', () => {
    const [operation] = normalizeOperations([
      {
        name: '测试接口',
        path: '/test',
        method: 'GET',
        description: '测试用接口',
      },
    ]);

    expect(operation).toMatchObject({
      id: 'operation-test',
      operationId: 'test',
      summary: '测试接口',
      description: '测试用接口',
      url: 'test',
      method: 'get',
      parameters: { header: [] },
      responses: { type: 'object', properties: {} },
      origin: true,
    });
    expect(operation.outputs[0]).toMatchObject({
      name: 'Response',
      paramType: 'Object',
      childList: [],
    });
  });

  test('buildOperationsSummary falls back to legacy action names', () => {
    expect(buildOperationsSummary([
      { name: '测试接口', path: '/test', method: 'get' },
    ])).toBe('支持测试接口');
  });

  test('normalization keeps generated IDs stable and rejects duplicate operation IDs in one batch', () => {
    const input = [
      { name: 'Ping', path: '/v1/ping', method: 'GET' },
    ];
    expect(normalizeOperations(input)[0].id).toBe('operation-v1_ping');
    expect(normalizeOperations(input)[0].id).toBe(normalizeOperations(input)[0].id);

    expect(() => normalizeOperations([
      { operationId: 'duplicate', path: '/a', method: 'GET' },
      { operationId: 'duplicate', path: '/b', method: 'GET' },
    ])).toThrow(expect.objectContaining({ code: 'CONNECTOR_OPERATION_ID_DUPLICATE' }));
  });

  test('normalizes connector headers for the platform runtime contract', () => {
    const [operation] = normalizeOperations([{
      operationId: 'calendarCreate',
      url: '/v1.0/calendar/events',
      method: 'POST',
      inputs: [{
        name: 'Headers',
        paramLocation: 'header',
        required: true,
        childList: [
          { name: 'Content-Type', required: true, defaultValue: 'application/json' },
          { name: 'x-client-token', required: true, defaultValue: '' },
        ],
      }],
      parameters: {
        header: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'x-client-token', value: '' },
        ],
      },
    }]);

    expect(operation.inputs[0].required).toBe(false);
    expect(operation.inputs[0].childList).toEqual([
      expect.objectContaining({ name: 'Content-Type', required: false }),
      expect.objectContaining({ name: 'x-client-token', required: false }),
    ]);
    expect(operation.parameters.header).toEqual([
      { name: 'Content-Type', value: 'application/json' },
    ]);
  });
});
