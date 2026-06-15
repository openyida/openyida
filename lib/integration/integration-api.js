'use strict';

const { createYidaClient } = require('../core/yida-client');

/**
 * integration-api.js - 集成&自动化相关宜搭 API 调用封装
 *
 * 包含：
 *   - getFormSchema：获取目标表单字段 Schema
 *   - saveProcess：保存/发布逻辑流
 *   - createLogicflow：新建逻辑流绑定关系
 *   - listLogicflows：查询应用内逻辑流列表（支持关键字/表单/状态筛选）
 *   - listFormLogicflows：查询单个表单下的逻辑流列表
 *   - listLogicflowLogs：查询逻辑流运行日志（支持状态筛选）
 *   - switchLogicflow：开启或关闭逻辑流
 */

/**
 * 获取目标表单的字段 Schema 列表
 * 接口地址：GET /alibaba/web/{appType}/_view/query/formdesign/getFormSchema.json?formUuid=xxx&schemaVersion=V5
 */
async function getFormSchema(authRef, params) {
  const { appType, formUuid } = params;
  const response = await createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json?formUuid=${formUuid}&schemaVersion=V5`,
    null
  );

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || JSON.stringify(response) : '请求失败';
    throw new Error(`获取表单 Schema 失败：${errorMsg}`);
  }

  // content 是 JSON 字符串，需要解析
  let schemaContent = response.content;
  if (typeof schemaContent === 'string') {
    try {
      schemaContent = JSON.parse(schemaContent);
    } catch (parseError) {
      throw new Error(`解析表单 Schema 失败：${parseError.message}，原始内容：${schemaContent}`);
    }
  }

  // V5 Schema 结构：pages[].componentsTree[0].children
  // 遍历所有 pages（支持 Tab 布局多页面表单），递归提取字段组件（跳过布局容器）
  const pages = schemaContent && Array.isArray(schemaContent.pages) ? schemaContent.pages : [];

  if (pages.length === 0) {
    return [];
  }

  const fieldComponents = [];
  const layoutTypes = new Set([
    'Container', 'Card', 'Tab', 'TabPane', 'Grid', 'GridColumn',
    'Fieldset', 'Section', 'Collapse', 'CollapsePanel',
  ]);

  function collectFields(children) {
    for (const child of children) {
      if (!child || typeof child !== 'object') {
        continue;
      }
      const componentName = child.componentName || '';
      const isContainer = layoutTypes.has(componentName)
        || /Container$/.test(componentName)
        || componentName === 'RootContent';
      if (child.props && child.props.fieldId && !isContainer) {
        fieldComponents.push(child);
      }
      if (Array.isArray(child.children)) {
        collectFields(child.children);
      }
    }
  }

  for (const page of pages) {
    const rootNode = page.componentsTree && page.componentsTree[0];
    if (rootNode && Array.isArray(rootNode.children)) {
      collectFields(rootNode.children);
    }
  }

  return fieldComponents;
}

/**
 * 调用 saveProcess 接口保存或发布逻辑流
 * 接口地址：POST /alibaba/web/{appType}/query/simpleProcess/saveProcess.json
 */
async function saveProcess(authRef, params) {
  const { appType, formUuid, processCode, processJson, viewJson, isOnline } = params;
  return createYidaClient({ authRef }).postForm(
    `/alibaba/web/${appType}/query/simpleProcess/saveProcess.json`,
    auth => ({
      _csrf_token: auth.csrfToken,
      formUuid,
      isLogic: 'true',
      isOnline: String(isOnline),
      json: JSON.stringify(processJson),
      needReportLine: 'y',
      processCode,
      viewJson: JSON.stringify(viewJson),
    })
  );
}

/**
 * 调用 createLogicflow 接口新建逻辑流绑定关系，获取宜搭分配的真实 processCode
 * 接口地址：POST /alibaba/web/{appType}/query/formLogicflowBinding/createLogicflow.json
 */
async function createLogicflow(authRef, params) {
  const { appType, formUuid, flowName } = params;
  const response = await createYidaClient({ authRef }).postForm(
    `/alibaba/web/${appType}/query/formLogicflowBinding/createLogicflow.json`,
    auth => ({
      _csrf_token: auth.csrfToken,
      _locale_time_zone_offset: '28800000',
      name: flowName,
      type: '1',
      formUuid,
    })
  );

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || JSON.stringify(response) : '请求失败';
    throw new Error(`新建逻辑流失败：${errorMsg}`);
  }

  const processCode = response.content && response.content.processCode;
  if (!processCode) {
    throw new Error(`新建逻辑流成功但未返回 processCode，响应：${JSON.stringify(response)}`);
  }
  return processCode;
}

/**
 * 查询应用内所有逻辑流（自动化）列表，支持按关键字/表单/状态筛选
 * 接口地址：GET /alibaba/web/{appType}/query/appLogicflowBinding/listflow.json
 */
async function listLogicflows(authRef, params) {
  const {
    appType,
    key = '',
    formUuid = '',
    status = '',
    type = '1',
    pageIndex = 1,
    pageSize = 10,
  } = params;

  const response = await createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/query/appLogicflowBinding/listflow.json`,
    (auth) => {
      const stamp = Date.now();
      return {
        _api: 'Connector.getListflow',
        _mock: 'false',
        _csrf_token: auth.csrfToken,
        _locale_time_zone_offset: '28800000',
        type,
        key,
        appType,
        formUuid,
        status,
        pageIndex: String(pageIndex),
        pageSize: String(pageSize),
        _stamp: String(stamp),
      };
    },
    { silentStatus: true }
  );

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || JSON.stringify(response) : '请求失败';
    throw new Error(`查询逻辑流列表失败：${errorMsg}`);
  }

  const content = response.content || {};
  // 返回结构：data 为按表单分组的列表，每组含 flowList；totalCount 为表单组数
  return {
    data: content.data || [],
    totalCount: content.totalCount || 0,
    hasMore: content.hasMore || false,
  };
}

/**
 * 查询单个表单下的逻辑流列表。
 *
 * 应用级列表接口会按表单分组，分组内默认只带前几条 flowList。
 * 前端点击分组里的「加载更多」时，会改用本接口继续拉取该表单下的自动化。
 */
async function listFormLogicflows(authRef, params) {
  const {
    appType,
    key = '',
    formUuid = '',
    status = '',
    type = '1',
    pageIndex = 1,
    pageSize = 10,
  } = params;

  const response = await createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/query/formLogicflowBinding/listflow.json`,
    (auth) => {
      const stamp = Date.now();
      return {
        _api: 'Connector.getTriggerList',
        _mock: 'false',
        _csrf_token: auth.csrfToken,
        _locale_time_zone_offset: '28800000',
        type,
        key,
        appType,
        formUuid,
        status,
        pageIndex: String(pageIndex),
        pageSize: String(pageSize),
        _stamp: String(stamp),
      };
    },
    { silentStatus: true }
  );

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || JSON.stringify(response) : '请求失败';
    throw new Error(`查询表单逻辑流列表失败：${errorMsg}`);
  }

  const content = response.content || {};
  return {
    data: content.data || [],
    totalCount: content.totalCount || 0,
    hasMore: content.hasMore || false,
  };
}

/**
 * 查询逻辑流（自动化）运行日志，支持按执行状态筛选。
 *
 * 前端「运行日志」抽屉使用同一接口：
 *   GET /alibaba/web/{appType}/query/formLogicflowBinding/listLog.json
 *
 * 状态枚举来自前端：
 *   3 = 执行成功
 *   2 = 执行异常
 *   0 = 执行中
 */
async function listLogicflowLogs(authRef, params) {
  const {
    appType,
    processCode,
    dateType = 'modifyTime',
    status,
    formInstId,
    procInstId,
    startTime,
    endTime,
    pageIndex = 1,
    pageSize = 10,
  } = params;

  if (!appType) {
    throw new Error('查询逻辑流运行日志失败：缺少 appType');
  }
  if (!processCode) {
    throw new Error('查询逻辑流运行日志失败：缺少 processCode');
  }

  const response = await createYidaClient({ authRef }).get(
    `/alibaba/web/${appType}/query/formLogicflowBinding/listLog.json`,
    (auth) => {
      const stamp = Date.now();
      const queryParams = {
        _api: 'Connector.listLog',
        _mock: 'false',
        _csrf_token: auth.csrfToken,
        _locale_time_zone_offset: '28800000',
        dateType,
        processCode,
        pageIndex: String(pageIndex),
        pageSize: String(pageSize),
        _stamp: String(stamp),
      };

      if (status !== undefined && status !== null && status !== '') {
        queryParams.status = String(status);
      }
      if (formInstId) {
        queryParams.formInstId = formInstId;
      }
      if (procInstId) {
        queryParams.procInstId = procInstId;
      }
      if (startTime !== undefined && startTime !== null && startTime !== '') {
        queryParams.startTime = String(startTime);
      }
      if (endTime !== undefined && endTime !== null && endTime !== '') {
        queryParams.endTime = String(endTime);
      }

      return queryParams;
    },
    { silentStatus: true }
  );

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || JSON.stringify(response) : '请求失败';
    throw new Error(`查询逻辑流运行日志失败：${errorMsg}`);
  }

  const content = response.content || {};
  return {
    data: content.data || [],
    totalCount: content.totalCount || 0,
    currentPage: content.currentPage || pageIndex,
    hasMore: content.hasMore || false,
  };
}

/**
 * 开启或关闭逻辑流（自动化）
 * 接口地址：POST /alibaba/web/{appType}/query/formLogicflowBinding/switchflow.json
 */
async function switchLogicflow(authRef, params) {
  const { appType, formUuid, processCode, enable } = params;
  const response = await createYidaClient({ authRef }).postForm(
    (function buildPath() {
      const stamp = Date.now();
      return `/alibaba/web/${appType}/query/formLogicflowBinding/switchflow.json?_api=Connector.switchFlow&_mock=false&_stamp=${stamp}`;
    }()),
    auth => ({
      _csrf_token: auth.csrfToken,
      _locale_time_zone_offset: '28800000',
      enable: enable ? 'y' : 'n',
      processCode,
      formUuid,
      type: '1',
    })
  );

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || JSON.stringify(response) : '请求失败';
    throw new Error(`切换逻辑流状态失败：${errorMsg}`);
  }
  return response.content;
}

module.exports = {
  getFormSchema,
  saveProcess,
  createLogicflow,
  listLogicflows,
  listFormLogicflows,
  listLogicflowLogs,
  switchLogicflow,
};
