#!/usr/bin/env node
/**
 * 钉钉 CLI 集成测试
 */

'use strict';

const { execFileSync } = require('child_process');

function runOpenYida(args) {
  return execFileSync(process.execPath, ['bin/yida.js', ...args], {
    encoding: 'utf8',
  });
}

describe('钉钉 CLI 集成', () => {
  // 测试 1: dws 命令帮助信息
  test('dws --help 显示帮助信息', () => {
    const output = runOpenYida(['dws', '--help']);
    expect(output).toContain('openyida dws - 钉钉 CLI 集成');
    expect(output).toContain('常用命令');
    expect(output).toContain('contact user search');
  });

  // 测试 2: 无参数显示帮助
  test('dws (无参数) 显示帮助信息', () => {
    const output = runOpenYida(['dws']);
    expect(output).toContain('openyida dws - 钉钉 CLI 集成');
  });

  // 测试 3: 主帮助包含 dws 命令
  test('主帮助包含 dws 命令', () => {
    const output = runOpenYida(['--help']);
    expect(output).toContain('dws');
    // i18n: 中文环境输出 "钉钉 CLI"，英文环境输出 "DingTalk CLI"
    const hasDwsDescription = output.includes('钉钉 CLI') || output.includes('DingTalk CLI');
    expect(hasDwsDescription).toBe(true);
  });

  // 测试 4: 示例命令在帮助中
  test('示例命令在帮助中', () => {
    const output = runOpenYida(['--help']);
    expect(output).toContain('dws contact user search');
  });
});
