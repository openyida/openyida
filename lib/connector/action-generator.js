/**
 * 执行动作配置生成模块
 */

/**
 * 根据URL路径生成有意义的动作名称和描述
 * @param {string} path - URL路径
 * @param {string} method - HTTP方法
 * @returns {Object} {name, desc}
 */
function generateActionInfo(path, method) {
  const pathSegments = path.split('/').filter(p => p);
  const lastSegment = pathSegments[pathSegments.length - 1] || '';

  // 去除 .json 后缀
  const cleanSegment = lastSegment.replace(/\.json$/i, '');

  // 根据路径关键词理解功能 - 名称映射
  const nameMap = {
    'queryThroughView': '查询视图数据',
    'query': '查询数据',
    'get': '获取数据',
    'list': '列表查询',
    'create': '创建数据',
    'update': '更新数据',
    'delete': '删除数据',
    'save': '保存数据',
    'submit': '提交数据',
    'search': '搜索数据',
    'export': '导出数据',
    'import': '导入数据',
    'upload': '上传文件',
    'download': '下载文件',
    'login': '登录',
    'logout': '登出',
    'auth': '认证',
    'verify': '验证',
    'send': '发送',
    'notify': '通知',
    'message': '消息',
    'alarm': '告警',
    'report': '报表',
    'stat': '统计',
    'count': '计数',
    'detail': '详情查询',
    'info': '信息查询'
  };

  // 描述映射 - 更详细的说明
  const descMap = {
    'queryThroughView': '通过视图配置查询宜搭表单数据，支持分页和筛选条件',
    'query': '查询数据记录，支持条件筛选和结果返回',
    'get': '获取指定资源的详细信息',
    'list': '获取数据列表，支持分页和排序',
    'create': '创建新的数据记录',
    'update': '更新已有的数据记录',
    'delete': '删除指定的数据记录',
    'save': '保存数据，包括新增和更新操作',
    'submit': '提交表单或业务数据',
    'search': '根据关键词搜索数据',
    'export': '导出数据到文件',
    'import': '从文件导入数据',
    'upload': '上传文件到服务器',
    'download': '从服务器下载文件',
    'login': '用户登录认证',
    'logout': '用户退出登录',
    'auth': '身份认证和授权',
    'verify': '验证数据或身份',
    'send': '发送消息或通知',
    'notify': '发送系统通知',
    'message': '处理消息相关操作',
    'alarm': '发送告警信息',
    'report': '生成业务报表',
    'stat': '统计数据信息',
    'count': '统计记录数量',
    'detail': '查询详情信息',
    'info': '获取基础信息'
  };

  // 查找匹配的名称
  for (const [key, value] of Object.entries(nameMap)) {
    if (cleanSegment.toLowerCase().includes(key.toLowerCase())) {
      return { name: value, desc: descMap[key] || value };
    }
  }

  // 默认使用最后一段的驼峰转换
  if (cleanSegment) {
    const words = cleanSegment.replace(/([A-Z])/g, ' $1').trim();
    const name = words.charAt(0).toUpperCase() + words.slice(1);
    return { name, desc: `${method} 请求: ${name}` };
  }

  return { name: `${method} 请求`, desc: `执行 ${method} 请求操作` };
}

/**
 * 生成执行动作配置
 * @param {Object} curlData - curl解析结果
 * @param {Array} relevantHeaders - 过滤后的headers
 * @returns {Object} 执行动作配置
 */
function generateOperation(curlData, relevantHeaders) {
  const pathParts = curlData.path.split('?');
  const path = pathParts[0];
  const query = pathParts[1] || '';

  // 生成 operationId
  const pathSegments = path.split('/').filter(p => p);
  const operationId = pathSegments.slice(-2).join('_') || 'operation';

  // 生成有意义的动作名称和描述
  const actionInfo = generateActionInfo(path, curlData.method);
  const summary = actionInfo.name;
  const description = actionInfo.desc;

  // 构建 inputs
  const inputs = [];

  // Headers input
  if (relevantHeaders.length > 0) {
    const headersChildList = relevantHeaders.map(([key, value]) => ({
      _key: `${operationId}%${key}`,
      name: key,
      paramType: 'String',
      desc: key,
      required: false,
      defaultValue: value.substring(0, 50) + (value.length > 50 ? '...' : ''),
      children: [],
      childList: [],
      __level: 0,
      hidden: false,
      paramLocation: 'header'
    }));

    inputs.push({
      childList: headersChildList,
      desc: '请求头',
      name: 'Headers',
      paramType: 'Object',
      required: false,
      paramLocation: 'header'
    });
  }

  // Body input
  if (curlData.body) {
    try {
      const bodyObj = JSON.parse(curlData.body);
      const bodyChildren = Object.keys(bodyObj).map(key => ({
        _key: `${operationId}%${key}`,
        name: key,
        paramType: typeof bodyObj[key] === 'number' ? 'Number' : 'String',
        desc: key,
        required: false,
        children: [],
        childList: [],
        __level: 0,
        hidden: false,
        paramLocation: 'body'
      }));

      inputs.push({
        defaultValue: curlData.body,
        desc: '请求体',
        name: 'Body',
        paramType: 'Object',
        required: false,
        childList: bodyChildren,
        paramLocation: 'body'
      });
    } catch {
      inputs.push({
        defaultValue: curlData.body,
        desc: '请求体',
        name: 'Body',
        paramType: 'String',
        required: false,
        paramLocation: 'body'
      });
    }
  }

  // Query input
  if (query) {
    const queryParams = new URLSearchParams(query);
    const queryChildren = [];
    for (const [key] of queryParams) {
      queryChildren.push({
        _key: `${operationId}%${key}`,
        name: key,
        paramType: 'String',
        desc: key,
        required: false,
        children: [],
        childList: [],
        __level: 0,
        hidden: false,
        paramLocation: 'query'
      });
    }

    if (queryChildren.length > 0) {
      inputs.push({
        desc: '查询参数',
        name: 'Query',
        paramType: 'Object',
        required: false,
        childList: queryChildren,
        paramLocation: 'query'
      });
    }
  }

  // 构建 parameters - 必须与 inputs 同步
  const parameters = { header: [] };

  const headersInput = inputs.find(i => i.name === 'Headers');
  if (headersInput && headersInput.childList) {
    parameters.header = headersInput.childList.map(child => ({
      name: child.name,
      value: child.defaultValue || ''
    }));
  }

  const queryInput = inputs.find(i => i.name === 'Query');
  if (queryInput && queryInput.childList) {
    parameters.query = queryInput.childList.map(child => ({
      name: child.name,
      value: ''
    }));
  }

  if (curlData.body) {
    parameters.body = { default: curlData.body };
  }

  // 移除path开头的斜杠
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;

  return {
    id: `operation-${Date.now()}`,
    operationId: operationId,
    summary: summary,
    description: description,
    url: cleanPath,
    method: curlData.method.toLowerCase(),
    inputs: inputs,
    parameters: parameters,
    responses: { type: 'object', properties: {} },
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
}

module.exports = {
  generateActionInfo,
  generateOperation
};
