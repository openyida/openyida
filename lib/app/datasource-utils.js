/**
 * 构建连接器数据源的 options.fit 函数源码字符串（宜搭连接器专用格式）。
 * 连接器返回值会多包一层，需要解析 serviceReturnValue。
 */
function buildConnectorFitFunctionSource() {
  return (
    'function fit(response) {\n' +
    '    // 接口返回值会默认增加一层包裹，解析时需注意\n' +
    '    const content = (response.content !== undefined) ? response.content : response;\n' +
    '    // 连接器服务的返回值\n' +
    '    const serviceReturnValue = (content && content.serviceReturnValue !== undefined) ? content.serviceReturnValue : content;\n' +
    '\n' +
    '    const error = {\n' +
    '      message: response.errorMsg ||\n' +
    '        (response.errors && response.errors[0] && response.errors[0].msg) ||\n' +
    "        response.content || '远程数据源请求出错，success is false',\n" +
    '    };\n' +
    '    let success = true;\n' +
    '    if (response.success !== undefined) {\n' +
    '      success = response.success;\n' +
    '    } else if (response.hasError !== undefined) {\n' +
    '      success = !response.hasError;\n' +
    '    }\n' +
    '    return {\n' +
    '      content: serviceReturnValue || content,\n' +
    '      success,\n' +
    '      error,\n' +
    '    };\n' +
    '  }'
  );
}

/**
 * 构建 urlParams 默认数据源（每个表单都需要包含）。
 *
 * @param {string} formUuid - 表单 UUID
 * @returns {Object} urlParams 数据源对象
 */
function buildUrlParamsDataSource(formUuid) {
  return {
    id: '',
    name: 'urlParams',
    description:
      '当前页面地址的参数：如 aliwork.com/APP_xxxx/workbench?id=1&name=宜搭，可通过 this.state.urlParams.name 获取到宜搭',
    formUuid: formUuid,
    protocal: 'URI',
    isReadonly: true,
  };
}

/**
 * 构建单个连接器数据源的完整 Schema（宜搭 legao 格式）。
 *
 * @param {Object} definition - 数据源定义
 * @param {string} definition.id - 数据源名称（JS 中通过 this.dataSourceMap.<id> 调用）
 * @param {string} definition.connectorId - 连接器 ID
 * @param {string} definition.actionId - 连接器动作 ID
 * @param {string} formUuid - 表单 UUID
 * @param {string} csrfToken - CSRF Token
 * @returns {Object} 完整的连接器数据源 Schema
 */
function buildSingleConnectorDataSource(definition, formUuid, csrfToken) {
  const connectorId = definition.connectorId;
  const actionId = definition.actionId;
  const dataSourceName = definition.id;
  const inputsValue = definition.inputs ? JSON.stringify(definition.inputs) : '{}';
  const fitSource = buildConnectorFitFunctionSource();

  // compiled 字段：宜搭运行时需要编译后的 JS 代码（与 source 保持一致即可）
  const fitCompiled =
    'function main(){\n' +
    '    \n' +
    "    'use strict';\n" +
    '\n' +
    'var __compiledFunc__ = ' + fitSource.replace(/\n/g, '\n') + ';\n' +
    '    return __compiledFunc__.apply(this, arguments);\n' +
    '  }';

  const connectionId = definition.connectionId || null;

  const serviceInfo = JSON.stringify({
    connectorInfo: {
      connectorId: connectorId,
      actionId: actionId,
      type: 'httpConnector',
      ...(connectionId !== null ? { connection: connectionId } : {}),
    },
  });

  const dataHandlerSource =
    'function(data, err) { this.setState({' + dataSourceName + ': data}); return data; }';

  return {
    id: '',
    name: dataSourceName,
    description: '',
    formUuid: formUuid,
    protocal: 'REMOTE',
    options: {
      url: '/query/publicService/invokeService.json?_csrf_token=' + csrfToken,
      shouldFetch: true,
      method: 'POST',
      isSync: false,
      fit: {
        type: 'js',
        source: fitSource,
        compiled: fitCompiled,
        error: null,
      },
      loadType: '',
      params: {
        serviceInfo: serviceInfo,
        inputs: inputsValue,
      },
      connector: {
        config: { connectionLess: false },
        connectorCorpId: '',
        connectorId: connectorId,
        containTriggers: null,
        description: definition.connectorDescription || '',
        iconUrl: definition.connectorIconUrl || '',
        mode: 5,
        name: definition.connectorName || '',
        orgId: null,
        prioirty: 0,
        subscribed: null,
        underControl: null,
      },
      ...(connectionId !== null
        ? {
          connection: {
            value: connectionId,
            label: definition.connectionLabel || '',
            title: definition.connectionLabel || '',
            logo: '',
            desc: '',
          },
        }
        : {}),
      connectorAction: {
        value: actionId,
        label: definition.actionLabel || actionId,
        title: definition.actionLabel || actionId,
        logo: '',
        desc: definition.actionDesc || '',
      },
      connectorActionOutputs: definition.connectorActionOutputs || '',
    },
    isInit: definition.isAutoLoad === true,
    dpType: 'YIDACONNECTOR',
    type: 'legao',
    requestHandler: {
      type: 'JSExpression',
      value: 'this.utils.legaoBuiltin.dataSourceHandler',
    },
    dataHandler: {
      type: 'js',
      source: dataHandlerSource,
      compiled: dataHandlerSource,
    },
  };
}

/**
 * 根据数据源定义数组构建完整的数据源列表（online + list 格式）。
 * 返回值同时包含 urlParams 默认数据源和所有连接器数据源。
 *
 * @param {Array} datasourceDefinitions - 数据源定义数组
 * @param {string} formUuid - 表单 UUID
 * @param {string} csrfToken - CSRF Token
 * @returns {Array} 数据源对象数组（用于写入 dataSource.online 和 dataSource.list）
 */
function buildDataSourceList(datasourceDefinitions, formUuid, csrfToken) {
  const urlParamsSource = buildUrlParamsDataSource(formUuid || '');
  const connectorSources = (datasourceDefinitions || []).map(function (definition) {
    return buildSingleConnectorDataSource(definition, formUuid || '', csrfToken || '');
  });
  return [urlParamsSource].concat(connectorSources);
}

/**
 * 从命令行参数值（JSON 字符串或文件路径）中解析数据源定义。
 *
 * @param {string} value - JSON 字符串（以 [ 开头）或 JSON 文件路径
 * @returns {Array} 数据源定义数组
 */
function parseDatasourceArg(value) {
  if (!value) {return [];}
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      throw new Error('--datasource 参数 JSON 解析失败: ' + err.message);
    }
  }
  // 当作文件路径处理
  const fs = require('fs');
  const path = require('path');
  const filePath = path.resolve(value);
  if (!fs.existsSync(filePath)) {
    throw new Error('--datasource 文件不存在: ' + filePath);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error('--datasource 文件 JSON 解析失败: ' + err.message);
  }
}

/**
 * 从命令行参数数组中提取 --datasource 参数值。
 *
 * @param {string[]} args - 命令行参数数组
 * @returns {{ datasourceValue: string|null, remainingArgs: string[] }}
 */
function extractDatasourceArg(args) {
  const remainingArgs = [];
  let datasourceValue = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--datasource' && i + 1 < args.length) {
      datasourceValue = args[i + 1];
      i++; // 跳过下一个参数
    } else if (args[i].startsWith('--datasource=')) {
      datasourceValue = args[i].slice('--datasource='.length);
    } else {
      remainingArgs.push(args[i]);
    }
  }
  return { datasourceValue, remainingArgs };
}

/**
 * 通过 getAliveConnections 接口查询连接器下的鉴权账号列表。
 * 返回 Map<connectionId, connectionName>，供自动填充 connectionLabel 使用。
 *
 * @param {string} baseUrl - 宜搭 base URL
 * @param {string} connectorId - 连接器 ID
 * @param {string} csrfToken - CSRF Token
 * @param {Array} cookies - Cookie 数组
 * @returns {Promise<Map<number, string>>} connectionId -> connectionName 映射
 */
async function fetchConnectionNameMap(baseUrl, connectorId, csrfToken, cookies) {
  const { httpGet } = require('../core/utils');
  try {
    const result = await httpGet(baseUrl, '/query/connection/getAliveConnections.json', {
      _api: 'dataSourcePane.getYidaConnections',
      _mock: 'false',
      id: connectorId,
      schemaVersion: 'V5',
      _csrf_token: csrfToken,
      _stamp: Date.now(),
    }, cookies);
    const connectionNameMap = new Map();
    if (result && result.success && Array.isArray(result.content)) {
      result.content.forEach(function (item) {
        if (item.id !== undefined && item.connectionName) {
          connectionNameMap.set(item.id, item.connectionName);
        }
      });
    }
    return connectionNameMap;
  } catch (err) {
    // 查询失败不阻断主流程，connectionLabel 降级为空字符串
    return new Map();
  }
}

/**
 * 对数据源定义数组中有 connectionId 但缺少 connectionLabel 的项，
 * 自动调用 getAliveConnections 接口查询账号名称并填充 connectionLabel。
 * 相同 connectorId 的查询结果会被缓存，避免重复请求。
 *
 * @param {Array} datasourceDefinitions - 数据源定义数组（会原地修改）
 * @param {string} baseUrl - 宜搭 base URL
 * @param {string} csrfToken - CSRF Token
 * @param {Array} cookies - Cookie 数组
 * @returns {Promise<void>}
 */
async function enrichDatasourceDefinitionsWithConnectionLabels(datasourceDefinitions, baseUrl, csrfToken, cookies) {
  if (!datasourceDefinitions || datasourceDefinitions.length === 0) {return;}

  // 收集需要查询的 connectorId（去重）
  const connectorIdSet = new Set();
  datasourceDefinitions.forEach(function (definition) {
    if (definition.connectionId !== null && definition.connectionId !== undefined && !definition.connectionLabel && definition.connectorId) {
      connectorIdSet.add(definition.connectorId);
    }
  });

  if (connectorIdSet.size === 0) {return;}

  // 并行查询所有需要的连接器账号列表
  const connectorIdList = Array.from(connectorIdSet);
  const queryResults = await Promise.all(
    connectorIdList.map(function (connectorId) {
      return fetchConnectionNameMap(baseUrl, connectorId, csrfToken, cookies);
    })
  );

  // 构建 connectorId -> connectionNameMap 的缓存
  const connectorConnectionCache = new Map();
  connectorIdList.forEach(function (connectorId, index) {
    connectorConnectionCache.set(connectorId, queryResults[index]);
  });

  // 填充 connectionLabel
  datasourceDefinitions.forEach(function (definition) {
    if (definition.connectionId !== null && definition.connectionId !== undefined && !definition.connectionLabel && definition.connectorId) {
      const connectionNameMap = connectorConnectionCache.get(definition.connectorId);
      if (connectionNameMap) {
        const connectionName = connectionNameMap.get(definition.connectionId);
        if (connectionName) {
          definition.connectionLabel = connectionName;
        }
      }
    }
  });
}

module.exports = {
  buildDataSourceList,
  parseDatasourceArg,
  extractDatasourceArg,
  enrichDatasourceDefinitionsWithConnectionLabels,
};
