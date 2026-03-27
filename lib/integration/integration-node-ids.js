'use strict';

const crypto = require('crypto');

/**
 * integration-node-ids.js - 集成&自动化节点 ID / UUID 生成工具
 *
 * 所有随机 ID 的生成逻辑集中在此文件，方便统一维护格式规范。
 */

/**
 * 生成随机节点 ID，格式类似 node_ockpz6phx72
 */
function generateNodeId() {
  const randomPart = crypto.randomBytes(6).toString('hex').slice(0, 11);
  return `node_${randomPart}`;
}

/**
 * 生成随机按钮 UUID，格式类似 button-MMYV60WF139H6I6FBN87
 */
function generateButtonUuid() {
  return `button-${crypto.randomBytes(10).toString('hex').toUpperCase().slice(0, 20)}`;
}

/**
 * 生成 processCode，格式类似 LPROC-17B66F81MI24CP5JOVNAQ46OCTME2Q1Z5VYMM19
 */
function generateProcessCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'LPROC-';
  for (let index = 0; index < 38; index++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * 生成随机规则 ID，格式类似 item-cbe14a39-4aac-4bb5-b8a5-9412c02ac4c7
 */
function generateRuleItemId() {
  const hex = () => crypto.randomBytes(2).toString('hex');
  const hex4 = () => crypto.randomBytes(4).toString('hex');
  return `item-${hex4()}-${hex()}-${hex()}-${hex()}-${hex4()}${hex()}`;
}

/**
 * 生成随机规则组 ID，格式类似 group-c26b657f-c503-468a-9c97-14767c099546
 */
function generateRuleGroupId() {
  const hex = () => crypto.randomBytes(2).toString('hex');
  const hex4 = () => crypto.randomBytes(4).toString('hex');
  return `group-${hex4()}-${hex()}-${hex()}-${hex()}-${hex4()}${hex()}`;
}

/**
 * 生成随机 dataRule ID，格式类似 rule-MMYV60W92EYW9KG6RJT1
 */
function generateDataRuleId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'rule-';
  for (let index = 0; index < 20; index++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

module.exports = {
  generateNodeId,
  generateButtonUuid,
  generateProcessCode,
  generateRuleItemId,
  generateRuleGroupId,
  generateDataRuleId,
};
