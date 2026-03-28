'use strict';

// ── 图表类型映射 ──────────────────────────────────────

const CHART_COMPONENT_MAP = {
  bar:       'YoushuGroupedBarChart',      // 柱状图（分组）
  line:      'YoushuLineChart',            // 折线图
  pie:       'YoushuPieChart',             // 饼图
  funnel:    'YoushuFunnelChart',          // 漏斗图
  gauge:     'YoushuGauge',               // 仪表盘
  combo:     'YoushuComboChart',           // 柱线混合图
  table:     'YoushuTable',               // 基础表格
  indicator: 'YoushuSimpleIndicatorCard', // 指标卡
  pivot:     'YoushuCrossPivotTable',     // 交叉透视表
};

// ── ID 生成工具 ───────────────────────────────────────

/**
 * 生成随机 8 位字母数字 ID（小写）
 */
function randomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * 生成节点 ID，格式：node_oc + 随机12位
 */
function genNodeId() {
  return 'node_oc' + randomId() + randomId().slice(0, 4);
}

/**
 * 生成字段别名 ID，格式：field_ + 随机8位
 */
function genFieldAlias() {
  return 'field_' + randomId();
}

/**
 * 生成组件 fieldId，格式：ComponentName_ + 随机8位
 */
function genFieldId(componentName) {
  return componentName + '_' + randomId();
}

module.exports = {
  CHART_COMPONENT_MAP,
  randomId,
  genNodeId,
  genFieldAlias,
  genFieldId,
};
