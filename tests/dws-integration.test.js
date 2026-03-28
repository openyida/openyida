#!/usr/bin/env node
/**
 * 钉钉 CLI 集成测试
 */

'use strict';

const { execSync } = require('child_process');
const assert = require('assert');

console.log('开始测试钉钉 CLI 集成...\n');

// 测试 1: dws 命令帮助信息
console.log('测试 1: dws --help');
try {
  const output = execSync('node bin/yida.js dws --help', { encoding: 'utf8' });
  assert(output.includes('openyida dws - 钉钉 CLI 集成'), '帮助信息标题不正确');
  assert(output.includes('常用命令'), '缺少常用命令列表');
  assert(output.includes('contact user search'), '缺少联系人搜索命令');
  console.log('✓ 通过\n');
} catch (error) {
  console.error('✗ 失败:', error.message);
  process.exit(1);
}

// 测试 2: 无参数显示帮助
console.log('测试 2: dws (无参数)');
try {
  const output = execSync('node bin/yida.js dws', { encoding: 'utf8' });
  assert(output.includes('openyida dws - 钉钉 CLI 集成'), '帮助信息标题不正确');
  console.log('✓ 通过\n');
} catch (error) {
  console.error('✗ 失败:', error.message);
  process.exit(1);
}

// 测试 3: 主帮助包含 dws 命令
console.log('测试 3: 主帮助包含 dws 命令');
try {
  const output = execSync('node bin/yida.js --help', { encoding: 'utf8' });
  assert(output.includes('dws'), '主帮助缺少 dws 命令');
  assert(output.includes('钉钉 CLI'), '缺少钉钉 CLI 说明');
  console.log('✓ 通过\n');
} catch (error) {
  console.error('✗ 失败:', error.message);
  process.exit(1);
}

// 测试 4: 示例命令在帮助中
console.log('测试 4: 示例命令在帮助中');
try {
  const output = execSync('node bin/yida.js --help', { encoding: 'utf8' });
  assert(output.includes('dws contact user search'), '缺少示例命令');
  console.log('✓ 通过\n');
} catch (error) {
  console.error('✗ 失败:', error.message);
  process.exit(1);
}

console.log('所有测试通过！✓');
console.log('\n提示：钉钉 CLI (dws) 尚未安装，运行以下命令安装：');
console.log('  openyida dws install');
console.log('\n或手动执行：');
console.log('  curl -fsSL https://raw.githubusercontent.com/DingTalk-Real-AI/dingtalk-workspace-cli/main/scripts/install.sh | sh');
