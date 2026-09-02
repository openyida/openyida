'use strict';

const http = require('http');
const { httpGet, httpPost } = require('../lib/core/utils');

jest.mock('../lib/auth/token-auth', () => ({
  getAccessToken: jest.fn(() => 'test-access-token'),
}));

function writeSplitUtf8Json(res, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const splitTarget = Buffer.from('解', 'utf8');
  const splitAt = body.indexOf(splitTarget) + 1;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.write(body.subarray(0, splitAt));
  res.write(body.subarray(splitAt));
  res.end();
}

async function withServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = server.address();
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('http response encoding', () => {
  const payload = {
    success: true,
    content: {
      text: '测试、解码相关内容',
    },
  };

  test('httpGet preserves UTF-8 characters split across chunks', async () => {
    await withServer((_req, res) => writeSplitUtf8Json(res, payload), async (baseUrl) => {
      const result = await httpGet(baseUrl, '/api', {}, { silentStatus: true });

      expect(result.content.text).toBe('测试、解码相关内容');
      expect(result.content.text).not.toContain('�');
    });
  });

  test('httpPost preserves UTF-8 characters split across chunks', async () => {
    await withServer((_req, res) => writeSplitUtf8Json(res, payload), async (baseUrl) => {
      const result = await httpPost(baseUrl, '/api', 'value=1', { silentStatus: true });

      expect(result.content.text).toBe('测试、解码相关内容');
      expect(result.content.text).not.toContain('�');
    });
  });
});

describe('httpGet query parameters', () => {
  test.each([
    ['/api', { added: '1' }, '/api?added=1'],
    ['/api?existing=1', { added: '2' }, '/api?existing=1&added=2'],
    ['/api?', { added: '3' }, '/api?added=3'],
    ['/api?existing=1&', { added: '4' }, '/api?existing=1&added=4'],
    ['/api?existing=1', {}, '/api?existing=1'],
  ])('joins query params onto %s', async (requestPath, queryParams, expectedPath) => {
    let actualPath = '';
    await withServer((req, res) => {
      actualPath = req.url;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
    }, async (baseUrl) => {
      await httpGet(baseUrl, requestPath, queryParams, { silentStatus: true });
    });

    expect(actualPath).toBe(expectedPath);
  });
});
