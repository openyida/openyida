'use strict';

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn(),
}));

const utils = require('../lib/core/utils');
const { getMatrixList, getMatrixById } = require('../lib/permission/matrix-service');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

describe('matrix-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    utils.loadAuthData.mockReturnValue(mockAuthData);
    utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
  });

  test('getMatrixList returns data array from response', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        currentPage: 1,
        data: [
          { matrixId: 'MATRIX-1', name: { zh_CN: '测试矩阵' } },
        ],
      },
    });

    const list = await getMatrixList(null, { keyword: '测试', page: 1, limit: 10 });

    expect(list).toEqual([{ matrixId: 'MATRIX-1', name: { zh_CN: '测试矩阵' } }]);
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    const [baseUrl, path, params] = utils.httpGet.mock.calls[0];
    expect(baseUrl).toBe('https://www.aliwork.com');
    expect(path).toBe('/query/matrix/getMatrixList.json');
    expect(params).toMatchObject({
      keyword: '测试',
      page: 1,
      limit: 10,
    });
  });

  test('getMatrixList returns empty array when response has no data', async () => {
    utils.httpGet.mockResolvedValueOnce({ success: true, content: {} });

    const list = await getMatrixList(null);

    expect(list).toEqual([]);
  });

  test('getMatrixById returns matrix detail', async () => {
    utils.httpGet.mockResolvedValueOnce({
      success: true,
      content: {
        matrixId: 'MATRIX-1',
        name: { zh_CN: '测试矩阵' },
      },
    });

    const detail = await getMatrixById(null, 'MATRIX-1');

    expect(detail).toEqual({
      matrixId: 'MATRIX-1',
      name: { zh_CN: '测试矩阵' },
    });
    expect(utils.httpGet).toHaveBeenCalledTimes(1);
    const [baseUrl, path, params] = utils.httpGet.mock.calls[0];
    expect(path).toBe('/query/matrix/getMatrixById.json');
    expect(params).toMatchObject({ matrixId: 'MATRIX-1' });
  });
});
