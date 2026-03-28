#!/usr/bin/env node
/**
 * 钉钉 CLI 集成测试
 */

'use strict';

const { execSync } = require('child_process');

describe('钉钉 CLI 集成', () => {
  // 测试 1: dws 命令帮助信息
  test('dws --help 显示帮助信息', () => {
    const output = execSync('node bin/yida.js dws --help', { encoding: 'utf8' });
    expect(output).toContain('openyida dws - 钉钉 CLI 集成');
    expect(output).toContain('常用命令');
    expect(output).toContain('contact user search');
  });

  // 测试 2: 无参数显示帮助
  test('dws (无参数) 显示帮助信息', () => {
    const output = execSync('node bin/yida.js dws', { encoding: 'utf8' });
    expect(output).toContain('openyida dws - 钉钉 CLI 集成');
  });

  // 测试 3: 主帮助包含 dws 命令
  test('主帮助包含 dws 命令', () => {
    const output = execSync('node bin/yida.js --help', { encoding: 'utf8' });
    expect(output).toContain('dws');
    expect(output).toContain('钉钉 CLI');
  });

  // 测试 4: 示例命令在帮助中
  test('示例命令在帮助中', () => {
    const output = execSync('node bin/yida.js --help', { encoding: 'utf8' });
    expect(output).toContain('dws contact user search');
  });
});
