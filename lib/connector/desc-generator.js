/**
 * 连接器描述生成模块
 */

/**
 * 生成连接器描述
 * @param {Object} curlData - curl解析结果
 * @param {Object} operation - 执行动作配置
 * @returns {string} 连接器描述
 */
function generateConnectorDesc(curlData, operation) {
  const host = curlData.host;
  const actionName = operation.summary;
  const method = curlData.method;

  let desc = '';

  // 识别常见系统
  if (host.includes('aliwork.com') || host.includes('yida')) {
    desc = `宜搭平台数据连接器，用于${actionName}。`;
  } else if (host.includes('dingtalk.com') || host.includes('dingtalk')) {
    desc = `钉钉平台连接器，用于${actionName}。`;
  } else if (host.includes('aliyun') || host.includes('alibaba')) {
    desc = `阿里云服务平台连接器，用于${actionName}。`;
  } else {
    desc = `HTTP API连接器，用于${actionName}。`;
  }

  // 添加接口信息
  desc += `支持${method}请求方式。`;

  return desc;
}

module.exports = {
  generateConnectorDesc
};
