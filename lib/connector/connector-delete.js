/**
 * connector delete - 删除连接器
 *
 * 用法：openyida connector delete <connector-id> [--force]
 */

'use strict';
const { fail } = require('../core/chalk');

const {
  deleteConnector,
  findConnectorById,
  findConnectorByName,
  getAuthRef,
} = require('./api');

function showUsage() {
  console.log(`
用法: openyida connector delete <connector-id> [--force]

选项:
  --force    跳过确认提示

示例:
  openyida connector delete 910244
  openyida connector delete 910244 --force
`);
}

async function run(args) {
  if (!args || args.length < 1 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    process.exit(0);
  }

  const connectorId = args[0];
  const force = args.includes('--force');

  console.log('⚠️  删除连接器\n');
  console.log(`连接器 ID: ${connectorId}`);

  if (!force) {
    console.log('\n⚠️  警告: 此操作不可恢复，关联的执行动作也将被删除！');
    console.log('如果需要跳过确认，请使用 --force 参数:');
    console.log(`   openyida connector delete ${connectorId} --force`);
    return;
  }

  const authRef = getAuthRef();

  const connector = await findConnectorById(connectorId, authRef);
  if (!connector) {
    fail('未找到该连接器');
    process.exit(1);
  }

  console.log(`\n连接器: ${connector.displayName}`);
  await deleteConnector(connector.connectorName, connector.connectorMode || '5', authRef);
  const residual = await findConnectorByName(connector.connectorName, authRef);
  if (residual) {
    const error = new Error('连接器删除后的列表回读仍存在目标资源');
    error.code = 'CONNECTOR_DELETE_READBACK_MISMATCH';
    throw error;
  }
  console.log('\n✅ 连接器删除成功');
}

module.exports = { run };
