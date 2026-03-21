'use strict';

/**
 * integration-api.js - 集成&自动化相关宜搭 API 调用封装
 *
 * 包含：
 *   - getFormSchema：获取目标表单字段 Schema
 *   - saveProcess：保存/发布逻辑流
 *   - createLogicflow：新建逻辑流绑定关系
 *   - listLogicflows：查询应用内逻辑流列表（支持关键字/表单/状态筛选）
 *   - switchLogicflow：开启或关闭逻辑流
 */

const querystring = require('querystring');
const { httpGet, httpPost, requestWithAutoLogin } = require('../core/utils');

/**
 * 获取目标表单的字段 Schema 列表
 * 接口地址：GET /alibaba/web/{appType}/_view/query/formdesign/getFormSchema.json?formUuid=xxx&schemaVersion=V5
 * @param {object} authRef - 认证信息
 * @param {object} params
 * @param {string} params.appType - 应用 appType
 * @param {string} params.formUuid - 目标表单 UUID
 * @returns {Promise<Array>} 字段 Schema 列表（components 数组）
 */
async function getFormSchema(authRef, params) {
  const { appType, formUuid } = params;

  const response = await requestWithAutoLogin((auth) => {
    return httpGet(
      auth.baseUrl,
      `/alibaba/web/${appType}/_view/query/formdesign/getFormSchema.json?formUuid=${formUuid}&schemaVersion=V5`,
      auth.cookies
    );
  }, authRef);

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || JSON.stringify(response) : '请求失败';
    throw new Error(`获取表单 Schema 失败：${errorMsg}`);
  }

  // content 是 JSON 字符串，需要解析
  let schemaContent = response.content;
  if (typeof schemaContent === 'string') {
    try {
      schemaContent = JSON.parse(schemaContent);
    } catch {
      throw new Error(`解析表单 Schema 失败：${schemaContent}`);
    }
  }

  // 提取 components 数组（字段列表）
  const components = schemaContent && schemaContent.components;
  if (!Array.isArray(components)) {
    return [];
  }
  return components;
}

/**
 * 调用 saveProcess 接口保存或发布逻辑流
 * 接口地址：POST /alibaba/web/{appType}/query/simpleProcess/saveProcess.json
 * @param {object} authRef - 认证信息
 * @param {object} params - 接口参数
 * @param {string} params.appType - 应用 appType
 * @param {string} params.formUuid - 关联表单 UUID
 * @param {string} params.processCode - 逻辑流唯一标识（LPROC-xxx 格式）
 * @param {object} params.processJson - 节点定义对象（json 参数）
 * @param {object} params.viewJson - 画布 Schema 对象（viewJson 参数）
 * @param {boolean} params.isOnline - false=保存草稿，true=发布生效
 * @returns {Promise<object>} 接口响应
 */
async function saveProcess(authRef, params) {
  const { appType, formUuid, processCode, processJson, viewJson, isOnline } = params;

  return requestWithAutoLogin((auth) => {
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      formUuid,
      isLogic: 'true',
      isOnline: String(isOnline),
      json: JSON.stringify(processJson),
      needReportLine: 'y',
      processCode,
      viewJson: JSON.stringify(viewJson),
    });
    return httpPost(
      auth.baseUrl,
      `/alibaba/web/${appType}/query/simpleProcess/saveProcess.json`,
      postData,
      auth.cookies
    );
  }, authRef);
}

/**
 * 调用 createLogicflow 接口新建逻辑流绑定关系，获取宜搭分配的真实 processCode
 * 接口地址：POST /alibaba/web/{appType}/query/formLogicflowBinding/createLogicflow.json
 * @param {object} authRef - 认证信息
 * @param {object} params
 * @param {string} params.appType - 应用 appType
 * @param {string} params.formUuid - 触发表单 UUID
 * @param {string} params.flowName - 逻辑流名称
 * @returns {Promise<string>} 新建的 processCode
 */
async function createLogicflow(authRef, params) {
  const { appType, formUuid, flowName } = params;

  const response = await requestWithAutoLogin((auth) => {
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      _locale_time_zone_offset: '28800000',
      name: flowName,
      type: '1',
      formUuid,
    });
    return httpPost(
      auth.baseUrl,
      `/alibaba/web/${appType}/query/formLogicflowBinding/createLogicflow.json`,
      postData,
      auth.cookies
    );
  }, authRef);

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
 * @param {object} authRef - 认证信息
 * @param {object} params
 * @param {string} params.appType - 应用 appType
 * @param {string} [params.key] - 关键字搜索（按自动化名称模糊匹配）
 * @param {string} [params.formUuid] - 按触发表单 UUID 过滤
 * @param {string} [params.status] - 按状态过滤：'y'=开启，'n'=关闭，''=全部（默认）
 * @param {number} [params.pageIndex=1] - 页码，从 1 开始
 * @param {number} [params.pageSize=10] - 每页条数，最大 10
 * @returns {Promise<object>} 包含 data（表单分组列表）和 totalCount 的对象
 *   data 结构：[{ formUuid, formTitle, flowList: [{ processCode, name, status, formUuid, eventName, ... }] }]
 */
async function listLogicflows(authRef, params) {
  const {
    appType,
    key = '',
    formUuid = '',
    status = '',
    pageIndex = 1,
    pageSize = 10,
  } = params;

  const response = await requestWithAutoLogin((auth) => {
    const stamp = Date.now();
    const query = new URLSearchParams({
      _api: 'Connector.getListflow',
      _mock: 'false',
      _csrf_token: auth.csrfToken,
      _locale_time_zone_offset: '28800000',
      type: '1',
      key,
      appType,
      formUuid,
      status,
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
      _stamp: String(stamp),
    });
    return httpGet(
      auth.baseUrl,
      `/alibaba/web/${appType}/query/appLogicflowBinding/listflow.json?${query}`,
      auth.cookies
    );
  }, authRef);

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
 * 开启或关闭逻辑流（自动化）
 * 接口地址：POST /alibaba/web/{appType}/query/formLogicflowBinding/switchflow.json
 * @param {object} authRef - 认证信息
 * @param {object} params
 * @param {string} params.appType - 应用 appType
 * @param {string} params.formUuid - 触发表单 UUID
 * @param {string} params.processCode - 逻辑流唯一标识（LPROC-xxx 格式）
 * @param {boolean} params.enable - true=开启，false=关闭
 * @returns {Promise<object>} 接口响应 content（含 status: 'y'|'n'）
 */
async function switchLogicflow(authRef, params) {
  const { appType, formUuid, processCode, enable } = params;

  const response = await requestWithAutoLogin((auth) => {
    const stamp = Date.now();
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      _locale_time_zone_offset: '28800000',
      enable: enable ? 'y' : 'n',
      processCode,
      formUuid,
      type: '1',
    });
    return httpPost(
      auth.baseUrl,
      `/alibaba/web/${appType}/query/formLogicflowBinding/switchflow.json?_api=Connector.switchFlow&_mock=false&_stamp=${stamp}`,
      postData,
      auth.cookies
    );
  }, authRef);

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || JSON.stringify(response) : '请求失败';
    throw new Error(`切换逻辑流状态失败：${errorMsg}`);
  }

  return response.content;
}

module.exports = { getFormSchema, saveProcess, createLogicflow, listLogicflows, switchLogicflow };
