'use strict';

const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn((requestFn, authRef) => requestFn(authRef)),
}));

jest.mock('../lib/app/form-navigation', () => ({
  fetchFormPageList: jest.fn(),
  resolveLocalizedText: jest.fn((value, fallback = '') => {
    if (!value) { return fallback; }
    if (typeof value === 'string') { return value; }
    return value.zh_CN || value.en_US || fallback;
  }),
}));

const utils = require('../lib/core/utils');
const { fetchFormPageList } = require('../lib/app/form-navigation');
const {
  buildCreateEmptyPostData,
  buildDesignPostData,
  filterAggregateTables,
  normalizeDesignConfig,
  run,
} = require('../lib/aggregate-table/aggregate-table');

const mockAuthData = {
  base_url: 'https://www.aliwork.com',
  auth_mode: 'token',
  auth_source: 'token',
  corp_id: 'corp-1',
  user_id: 'user-1',
};

function buildPublishableDesign(overrides = {}) {
  return {
    formUuid: 'FORM-VIEW',
    relationForms: [{ formUuid: 'FORM-SOURCE' }],
    relationships: [{
      relationId: 'REL-1',
      relationshipInfos: [{ id: 'field_name', name: '名称' }],
    }],
    aggregatedFields: [{ id: 'REL-1', name: '名称' }],
    auxFields: [],
    formulaFields: [{ id: 'metric_count', formula: 'COUNT(field_name)' }],
    validators: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  utils.loadAuthData.mockReturnValue(mockAuthData);
  process.env.YIDA_QUIET = '1';
});

afterEach(() => {
  delete process.env.YIDA_QUIET;
});

describe('aggregate-table helpers', () => {
  test('buildCreateEmptyPostData creates a virtualView placeholder payload', () => {
    const parsed = querystring.parse(buildCreateEmptyPostData('客户聚合表'));
    const title = JSON.parse(parsed.title);

    expect(parsed).toMatchObject({
      formType: 'receipt',
      isVirtualView: 'y',
    });
    expect(title).toMatchObject({
      type: 'i18n',
      zh_CN: '客户聚合表',
      en_US: '客户聚合表',
      ja_JP: '客户聚合表',
    });
  });

  test('filterAggregateTables keeps only virtualView nodes and applies keyword', () => {
    const nodes = [
      { formUuid: 'FORM-A', formName: '客户聚合表', formType: 'virtualView' },
      { formUuid: 'FORM-B', formName: '普通表单', formType: 'receipt' },
      { formUuid: 'FORM-C', formName: '合同聚合表', formType: 'virtualView' },
    ];

    expect(filterAggregateTables(nodes, '')).toHaveLength(2);
    expect(filterAggregateTables(nodes, '合同')).toEqual([
      { formUuid: 'FORM-C', formName: '合同聚合表', formType: 'virtualView' },
    ]);
  });

  test('normalizeDesignConfig unwraps designer config and fills arrays', () => {
    const normalized = normalizeDesignConfig({
      viewDesignConfig: {
        relationForms: [{ formUuid: 'FORM-SOURCE' }],
        formulaFields: [{ id: 'numberField_total' }],
      },
    }, 'FORM-VIEW');

    expect(normalized).toEqual({
      formUuid: 'FORM-VIEW',
      relationForms: [{ formUuid: 'FORM-SOURCE' }],
      relationships: [],
      aggregatedFields: [],
      auxFields: [],
      formulaFields: [{ id: 'numberField_total' }],
      validators: [],
    });
  });

  test('buildDesignPostData preserves blank gmtModified for first draft save', () => {
    const parsed = querystring.parse(buildDesignPostData('FORM-VIEW', {
      formUuid: 'FORM-VIEW',
      relationForms: [],
      relationships: [],
      aggregatedFields: [],
      auxFields: [],
      formulaFields: [],
      validators: [],
    }, null));

    expect(parsed).toMatchObject({
      formUuid: 'FORM-VIEW',
      gmtModified: '',
    });
    expect(JSON.parse(parsed.designInfo)).toHaveProperty('formUuid', 'FORM-VIEW');
  });
});

describe('aggregate-table run', () => {
  test('list outputs only aggregate tables', async () => {
    fetchFormPageList.mockResolvedValue([
      { formUuid: 'FORM-A', formName: '客户聚合表', formType: 'virtualView' },
      { formUuid: 'FORM-B', formName: '普通表单', formType: 'receipt' },
    ]);
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await run(['list', 'APP_XXX', '--json']);

    expect(fetchFormPageList).toHaveBeenCalledWith('APP_XXX', expect.objectContaining({
      baseUrl: 'https://www.aliwork.com',
    }));
    expect(mockLog).toHaveBeenCalledWith(JSON.stringify([
      {
        formUuid: 'FORM-A',
        aggregateTableId: 'FORM-A',
        name: '客户聚合表',
        formType: 'virtualView',
        pathName: '',
      },
    ], null, 2));

    mockLog.mockRestore();
  });

  test('create-empty checks feature and creates receipt-backed virtualView', async () => {
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: true })
      .mockResolvedValueOnce({ success: true, content: { formUuid: 'FORM-VIEW' } });
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await run(['create-empty', 'APP_XXX', '客户聚合表', '--no-open']);

    expect(utils.httpPost).toHaveBeenNthCalledWith(
      1,
      'https://www.aliwork.com',
      '/dingtalk/web/APP_XXX/query/virtualview/show.json',
      ''
    );
    const createPostData = utils.httpPost.mock.calls[1][2];
    expect(querystring.parse(createPostData)).toMatchObject({
      formType: 'receipt',
      isVirtualView: 'y',
    });
    const payload = JSON.parse(mockLog.mock.calls[0][0]);
    expect(payload).toMatchObject({
      success: true,
      appType: 'APP_XXX',
      aggregateTableId: 'FORM-VIEW',
      formType: 'virtualView',
      designUrl: 'https://www.aliwork.com/alibaba/web/APP_XXX/design/virtualViewDesigner.html?formUuid=FORM-VIEW&fromNew=true',
    });
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);

    mockLog.mockRestore();
  });

  test('create-empty fails closed when the single write returns no form identity', async () => {
    utils.httpPost
      .mockResolvedValueOnce({ success: true, content: true })
      .mockResolvedValueOnce({ success: true, content: {} });

    await expect(run([
      'create-empty',
      'APP_XXX',
      '客户聚合表',
      '--no-open',
    ])).rejects.toMatchObject({
      code: 'AGGREGATE_CREATE_IDENTITY_MISSING',
    });

    expect(utils.httpPost).toHaveBeenCalledTimes(2);
    expect(utils.requestWithAutoLogin).toHaveBeenCalledTimes(1);
  });

  test('publish rejects an incomplete frontend contract before the remote write', async () => {
    utils.httpGet.mockResolvedValue({
      success: true,
      content: { gmtModified: 1, stashGmtModified: 1 },
    });

    await expect(run([
      'publish',
      'APP_XXX',
      'FORM-VIEW',
      JSON.stringify(buildPublishableDesign({ formulaFields: [] })),
      '--no-open',
    ])).rejects.toMatchObject({
      code: 'AGGREGATE_DESIGN_CONTRACT_INVALID',
    });

    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('publish performs one write and requires exact designer-owned readback', async () => {
    const design = buildPublishableDesign();
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: { ...design, gmtModified: 1, stashGmtModified: 1 },
      })
      .mockResolvedValueOnce({
        success: true,
        content: { ...design, gmtModified: 2, stashGmtModified: 1, serverOnly: true },
      });
    utils.httpPost.mockResolvedValue({ success: true, content: { gmtModified: 2 } });
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await run([
      'publish',
      'APP_XXX',
      'FORM-VIEW',
      JSON.stringify(design),
      '--no-open',
    ]);

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpPost.mock.calls[0][1]).toBe(
      '/alibaba/web/APP_XXX/query/virtualview/update.json'
    );
    const output = JSON.parse(mockLog.mock.calls[0][0]);
    expect(output).toMatchObject({
      success: true,
      action: 'publish',
      readbackVerified: true,
    });

    mockLog.mockRestore();
  });

  test('publish fails closed when the platform readback differs', async () => {
    const design = buildPublishableDesign();
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: { ...design, gmtModified: 1, stashGmtModified: 1 },
      })
      .mockResolvedValueOnce({
        success: true,
        content: {
          ...design,
          aggregatedFields: [{ id: 'REL-1', name: '平台返回了不同列名' }],
          gmtModified: 2,
        },
      });
    utils.httpPost.mockResolvedValue({ success: true, content: { gmtModified: 2 } });

    await expect(run([
      'publish',
      'APP_XXX',
      'FORM-VIEW',
      JSON.stringify(design),
      '--no-open',
    ])).rejects.toMatchObject({
      code: 'AGGREGATE_DESIGN_READBACK_MISMATCH',
    });

    expect(utils.httpPost).toHaveBeenCalledTimes(1);
  });

  test('publish accepts a success response without a response revision when exact readback advances', async () => {
    const design = buildPublishableDesign();
    utils.httpGet
      .mockResolvedValueOnce({
        success: true,
        content: { ...design, gmtModified: 1, stashGmtModified: 1 },
      })
      .mockResolvedValueOnce({
        success: true,
        content: { ...design, gmtModified: 2, stashGmtModified: 1 },
      });
    utils.httpPost.mockResolvedValue({ success: true, content: {} });
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    await run([
      'publish',
      'APP_XXX',
      'FORM-VIEW',
      JSON.stringify(design),
      '--no-open',
    ]);

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockLog.mock.calls[0][0])).toMatchObject({
      success: true,
      readbackVerified: true,
    });
    mockLog.mockRestore();
  });

  test('publish rejects a revision-less response when readback did not advance', async () => {
    const design = buildPublishableDesign();
    utils.httpGet.mockResolvedValue({
      success: true,
      content: { ...design, gmtModified: 1, stashGmtModified: 1 },
    });
    utils.httpPost.mockResolvedValue({ success: true, content: {} });

    await expect(run([
      'publish',
      'APP_XXX',
      'FORM-VIEW',
      JSON.stringify(design),
      '--no-open',
    ])).rejects.toMatchObject({
      code: 'AGGREGATE_WRITE_REVISION_UNCHANGED',
    });

    expect(utils.httpGet).toHaveBeenCalledTimes(2);
  });
});
