/**
 * connector delete - 连接器删除指引（只读）
 *
 * 用法：openyida connector delete <connector-id> [--force]
 */

'use strict';
const { fail } = require('../core/chalk');

const { findConnectorById, getAuthRef } = require('./api');

function showUsage() {
  console.log(`
用法: openyida connector delete <connector-id> [--force]

选项:
  --force    跳过首次警告，仅展示目标和手工删除指引（不会自动删除）

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
    console.log('\n⚠️  警告: 在平台删除连接器不可恢复，关联的执行动作也将被删除！');
    console.log('如需查询目标并查看手工删除指引，请使用 --force 参数（CLI 不会执行删除）:');
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
  console.log('\n⚠️  CLI 未执行删除操作：当前无法确定性证明该连接器未被表单、页面、流程或集成自动化引用。');
  console.log('请先确认并解除全部依赖，再前往宜搭平台管理后台手工删除:');
  console.log('   https://www.aliwork.com/platformManage/customConnectorFactory');
}

module.exports = { run };
