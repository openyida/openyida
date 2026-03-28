/**
 * connector test - 测试连接器执行动作
 *
 * 用法：openyida connector test --connector-id <id> --action <actionId> [--params <json>] [--account-id <id>]
 */

'use strict';

const {
  getAuthRef,
  findConnectorById,
  getConnectorDetail,
  listConnections,
  testConnector,
} = require('./api');

function showUsage() {
  console.log(`
用法: openyida connector test [选项]

选项:
  --connector-id <id>    连接器 ID（必需）
  --action <actionId>    执行动作 ID（必需）
  --params <json>        请求参数（JSON格式，可选）
  --account-id <id>      认证账号 ID（可选，用于需要鉴权的连接器）

示例:
  openyida connector test --connector-id 910296 --action dataQuery_queryThroughView.json
  openyida connector test --connector-id 910296 --action dataQuery_queryThroughView.json \\
    --params '{"appType": "APP_XXX", "formUuid": "FORM_XXX"}'
`);
}

function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
      case '-h':
        showUsage();
        process.exit(0);
        break;
      case '--connector-id':
        options.connectorId = args[++i];
        break;
      case '--action':
        options.actionId = args[++i];
        break;
      case '--params':
        options.params = args[++i];
        break;
      case '--account-id':
        options.accountId = args[++i];
        break;
    }
  }

  return options;
}

function buildTestParams(operation, userParams) {
  const params = { header: {}, query: {}, body: {} };

  if (operation.parameters) {
    if (operation.parameters.header) {
      operation.parameters.header.forEach(headerParam => {
        params.header[headerParam.name] = headerParam.value || '';
      });
    }
    if (operation.parameters.query) {
      operation.parameters.query.forEach(queryParam => {
        params.query[queryParam.name] = queryParam.value || '';
      });
    }
    if (operation.parameters.body && operation.parameters.body.default) {
      try {
        params.body = JSON.parse(operation.parameters.body.default);
      } catch {
        params.body = operation.parameters.body.default;
      }
    }
  }

  if (userParams) {
    try {
      const userParamsObj = JSON.parse(userParams);
      Object.assign(params.query, userParamsObj);
      Object.assign(params.body, userParamsObj);
    } catch (e) {
      console.warn('⚠️  参数解析失败，使用默认值:', e.message);
    }
  }

  return params;
}

async function run(args) {
  if (!args || args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    process.exit(0);
  }

  const options = parseArgs(args);

  if (!options.connectorId || !options.actionId) {
    console.error('❌ 请提供 --connector-id 和 --action 参数');
    showUsage();
    process.exit(1);
  }

  const authRef = getAuthRef();

  // 获取连接器详情
  const connector = await findConnectorById(options.connectorId, authRef);
  if (!connector) {
    console.error(`❌ 未找到连接器 ID: ${options.connectorId}`);
    process.exit(1);
  }

  const detail = await getConnectorDetail(connector.connectorName, authRef);

  // 找到对应的执行动作
  let operations = detail.operations || [];
  if (typeof operations === 'string') {
    try {
      operations = JSON.parse(operations);
    } catch (e) {
      operations = [];
    }
  }

  const operation = operations.find(op => op.operationId === options.actionId);
  if (!operation) {
    console.error(`\n❌ 未找到执行动作: ${options.actionId}`);
    console.log('\n可用的执行动作:');
    operations.forEach((op, index) => {
      console.log(`  ${index + 1}. ${op.operationId}: ${op.summary}`);
    });
    process.exit(1);
  }

  console.log('\n📋 执行动作信息');
  console.log('──────────────────────────────────────────────────');
  console.log(`动作ID: ${operation.operationId}`);
  console.log(`动作名称: ${operation.summary}`);
  console.log(`请求方法: ${operation.method.toUpperCase()}`);
  console.log(`请求路径: ${operation.url}`);
  console.log('──────────────────────────────────────────────────\n');

  // 检查是否需要认证账号
  const authAccounts = await listConnections(connector.connectorName, authRef);
  if (authAccounts.length > 0 && !options.accountId) {
    console.log('💡 该连接器需要认证账号，可用的账号:');
    authAccounts.forEach((account, index) => {
      console.log(`  ${index + 1}. ${account.id}: ${account.displayName || account.authName || '未命名'}`);
    });
    console.log('\n请使用 --account-id 参数指定账号');
    return;
  }

  // 构建测试参数
  const testParams = buildTestParams(operation, options.params);

  console.log('📤 请求参数');
  console.log('──────────────────────────────────────────────────');
  console.log('Headers:', JSON.stringify(testParams.header, null, 2));
  console.log('Query:', JSON.stringify(testParams.query, null, 2));
  console.log('Body:', JSON.stringify(testParams.body, null, 2));
  console.log('──────────────────────────────────────────────────\n');

  console.log('🚀 正在发送测试请求...\n');

  const result = await testConnector({
    connectorId: options.connectorId,
    operationId: options.actionId,
    header: testParams.header,
    query: testParams.query,
    body: testParams.body,
    authId: options.accountId || '',
  }, authRef);

  console.log('📥 响应结果');
  console.log('═══════════════════════════════════════════════════\n');

  if (result.hasError) {
    console.error('❌ 测试失败:', result.errorMsg || '未知错误');
    if (result.content) {
      console.log('\n错误详情:', JSON.stringify(result.content, null, 2));
    }
  } else {
    console.log('✅ 测试成功!\n');

    const response = result.content;

    if (response && response.statusCode) {
      const statusEmoji = response.statusCode >= 200 && response.statusCode < 300 ? '✅' : '⚠️';
      console.log(`${statusEmoji} HTTP 状态: ${response.statusCode}`);
    }

    if (response && response.headers) {
      console.log('\n📋 响应头:');
      console.log(JSON.stringify(response.headers, null, 2).substring(0, 500));
    }

    if (response && response.body) {
      console.log('\n📄 响应体:');
      try {
        const bodyObj = JSON.parse(response.body);
        console.log(JSON.stringify(bodyObj, null, 2));
      } catch {
        console.log(response.body.substring(0, 1000));
      }
    }

    if (response && response.executeTime) {
      console.log(`\n⏱️  执行时间: ${response.executeTime}ms`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
}

module.exports = { run };
