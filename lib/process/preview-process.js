#!/usr/bin/env node
/**
 * preview-process.js - 宜搭流程预览命令
 *
 * 用法：openyida process preview <appType> <processInstanceId> [--output <path>]
 *
 * 功能：
 *   根据流程实例 ID，获取流程定义和审批记录，生成可视化流程图 HTML 文件。
 *   支持线性节点、条件分支（菱形判断框）、回退跳转（虚线箭头）。
 *   节点状态高亮：已完成（绿色）、当前节点（蓝色脉冲）、未到达（灰色）、被跳过（虚线半透明）。
 *
 * 核心流程：
 *   1. 调用 getInstanceById 获取流程实例详情（含流程定义、当前节点、实例状态）
 *   2. 调用 getOperationRecords 获取审批操作记录（每个节点的审批人、时间、意见）
 *   3. 解析流程定义，构建节点和连线数据
 *   4. 根据实例状态和操作记录，计算每个节点的状态
 *   5. 生成 SVG 流程图 HTML 文件，在浏览器中打开
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  findProjectRoot,
} = require('../core/utils');
const { t } = require('../core/i18n');

// ── 参数解析 ─────────────────────────────────────────

function parseArgs(args) {
  const positionals = [];
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[i + 1] || null;
      i++;
    } else if (!args[i].startsWith('--')) {
      positionals.push(args[i]);
    }
  }

  return {
    appType: positionals[0] || null,
    processInstanceId: positionals[1] || null,
    outputPath,
  };
}

// ── 登录态获取 ────────────────────────────────────────

function ensureAuth() {
  let cookieData = loadCookieData();
  if (!cookieData || !cookieData.cookies || cookieData.cookies.length === 0 || !cookieData.csrf_token) {
    cookieData = triggerLogin();
  }
  if (!cookieData || !cookieData.cookies || !cookieData.csrf_token) {
    console.error(t('preview_process.no_login'));
    process.exit(1);
  }
  return {
    cookies: cookieData.cookies,
    csrfToken: cookieData.csrf_token,
    baseUrl: resolveBaseUrl(cookieData),
  };
}

// ── API 调用 ──────────────────────────────────────────

async function fetchProcessInstance(auth, appType, processInstanceId) {
  const requestPath = `/dingtalk/web/${appType}/v1/process/getInstanceById.json`;
  const result = await httpGet(auth.baseUrl, requestPath, { processInstanceId }, auth.cookies);

  if (!result || !result.success) {
    const errorMsg = (result && result.errorMsg) || t('preview_process.fetch_instance_failed');
    console.error(`❌ ${errorMsg}`);
    process.exit(1);
  }
  return result.result || result.content;
}

async function fetchOperationRecords(auth, appType, processInstanceId) {
  const requestPath = `/dingtalk/web/${appType}/v1/process/getOperationRecords.json`;
  const result = await httpGet(auth.baseUrl, requestPath, { processInstanceId }, auth.cookies);

  if (!result || !result.success) {
    console.error(`⚠️  ${t('preview_process.fetch_records_warning')}`);
    return [];
  }
  return result.result || result.content || [];
}

// ── 流程数据解析 ──────────────────────────────────────

/**
 * 从流程实例数据中提取节点和连线信息。
 * 宜搭流程实例的 data 结构包含 actionExecutor（审批记录列表）和 processCode 等。
 */
function parseProcessData(instanceData, operationRecords) {
  const nodes = [];
  const edges = [];

  // 从 actionExecutor 中提取审批节点信息
  const actionExecutors = instanceData.actionExecutor || instanceData.actionExecutorList || [];
  const instanceStatus = instanceData.instanceStatus || instanceData.status || '';
  const currentTaskNodes = extractCurrentTaskNodes(instanceData);

  // 构建操作记录索引（按 activityId 分组）
  const recordsByActivity = {};
  const recordsList = Array.isArray(operationRecords) ? operationRecords : (operationRecords.data || []);
  for (const record of recordsList) {
    const activityId = record.activityId || record.taskId || '';
    if (!recordsByActivity[activityId]) {
      recordsByActivity[activityId] = [];
    }
    recordsByActivity[activityId].push(record);
  }

  // 添加起始节点
  const originatorName = extractOriginatorName(instanceData);
  const createTime = instanceData.createTime || instanceData.gmtCreate || '';
  nodes.push({
    id: 'start',
    label: t('preview_process.node_submit'),
    type: 'start',
    status: 'completed',
    operator: originatorName,
    operateTime: formatTime(createTime),
    remark: '',
  });

  // 解析审批节点
  if (actionExecutors.length > 0) {
    parseFromActionExecutors(actionExecutors, nodes, edges, currentTaskNodes, instanceStatus, recordsByActivity);
  } else {
    // 尝试从操作记录中构建节点
    parseFromOperationRecords(recordsList, nodes, edges, currentTaskNodes, instanceStatus);
  }

  // 添加结束节点
  const lastNodeId = nodes.length > 0 ? nodes[nodes.length - 1].id : 'start';
  const endStatus = resolveEndNodeStatus(instanceStatus);
  nodes.push({
    id: 'end',
    label: t('preview_process.node_end'),
    type: 'end',
    status: endStatus,
    operator: '',
    operateTime: instanceStatus === 'COMPLETED' ? formatTime(instanceData.finishTime || instanceData.gmtModified || '') : '',
    remark: '',
  });
  edges.push({ from: lastNodeId, to: 'end', type: 'normal' });

  // 确保所有节点之间有连线
  ensureEdges(nodes, edges);

  return { nodes, edges, instanceStatus };
}

function extractCurrentTaskNodes(instanceData) {
  const taskNodes = new Set();
  const tasks = instanceData.tasks || instanceData.taskList || [];
  for (const task of tasks) {
    if (task.status === 'RUNNING' || task.status === 'NEW' || task.taskStatus === 'RUNNING') {
      taskNodes.add(task.activityId || task.activityName || '');
    }
  }
  return taskNodes;
}

function extractOriginatorName(instanceData) {
  if (instanceData.originator) {
    return instanceData.originator.name || instanceData.originator.userName || '';
  }
  return instanceData.originatorName || instanceData.originatorId || '';
}

function parseFromActionExecutors(executors, nodes, edges, currentTaskNodes, instanceStatus, recordsByActivity) {
  let prevNodeId = 'start';

  for (let i = 0; i < executors.length; i++) {
    const executor = executors[i];
    const nodeId = `node_${i}`;
    const activityId = executor.activityId || executor.taskId || nodeId;
    const activityName = executor.activityName || executor.name || `${t('preview_process.node_approval')} ${i + 1}`;

    // 判断节点状态
    const nodeStatus = resolveNodeStatus(executor, currentTaskNodes, activityId, instanceStatus);

    // 提取审批人信息
    const operatorName = extractExecutorName(executor);
    const operateTime = formatTime(executor.operateTime || executor.gmtFinished || '');
    const remark = executor.remark || executor.comment || '';

    // 判断节点类型
    const nodeType = detectNodeType(executor);

    nodes.push({
      id: nodeId,
      activityId,
      label: activityName,
      type: nodeType,
      status: nodeStatus,
      operator: operatorName,
      operateTime,
      remark,
    });

    edges.push({ from: prevNodeId, to: nodeId, type: 'normal' });
    prevNodeId = nodeId;
  }
}

function parseFromOperationRecords(records, nodes, edges, currentTaskNodes, instanceStatus) {
  let prevNodeId = 'start';
  const seenActivities = new Set();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const activityId = record.activityId || `record_${i}`;

    // 去重：同一个 activityId 只生成一个节点
    if (seenActivities.has(activityId)) { continue; }
    seenActivities.add(activityId);

    const nodeId = `node_${nodes.length - 1}`;
    const activityName = record.activityName || record.taskName || `${t('preview_process.node_approval')} ${nodes.length}`;
    const operatorName = record.operatorName || (record.operator && record.operator.name) || '';
    const operateTime = formatTime(record.operateTime || record.gmtCreate || '');
    const remark = record.remark || record.comment || '';

    const operationType = (record.operationType || record.type || '').toUpperCase();
    let nodeStatus = 'completed';
    if (operationType === 'NONE' || operationType === 'UN_EXECUTED') {
      nodeStatus = currentTaskNodes.has(activityId) ? 'current' : 'pending';
    }

    nodes.push({
      id: nodeId,
      activityId,
      label: activityName,
      type: 'approval',
      status: nodeStatus,
      operator: operatorName,
      operateTime,
      remark,
    });

    edges.push({ from: prevNodeId, to: nodeId, type: 'normal' });
    prevNodeId = nodeId;
  }
}

function resolveNodeStatus(executor, currentTaskNodes, activityId, instanceStatus) {
  const executorStatus = (executor.status || executor.taskStatus || '').toUpperCase();
  const result = (executor.result || executor.outResult || '').toUpperCase();

  if (currentTaskNodes.has(activityId) || currentTaskNodes.has(executor.activityName)) {
    return 'current';
  }
  if (executorStatus === 'COMPLETED' || executorStatus === 'AGREE' || result === 'AGREE' || result === 'SUBMIT') {
    return 'completed';
  }
  if (executorStatus === 'RUNNING' || executorStatus === 'NEW') {
    return 'current';
  }
  if (executorStatus === 'SKIPPED' || executorStatus === 'CANCELED' || executorStatus === 'AUTO_AGREE') {
    return 'skipped';
  }
  if (executorStatus === 'DISAGREE' || result === 'DISAGREE') {
    return 'completed';
  }
  if (instanceStatus === 'COMPLETED' || instanceStatus === 'TERMINATED') {
    return 'completed';
  }
  return 'pending';
}

function extractExecutorName(executor) {
  if (executor.executorName) { return executor.executorName; }
  if (executor.executor && executor.executor.name) { return executor.executor.name; }
  if (executor.userName) { return executor.userName; }
  if (executor.name && typeof executor.name === 'string') { return executor.name; }
  return executor.executorId || '';
}

function detectNodeType(executor) {
  const activityType = (executor.activityType || executor.type || '').toLowerCase();
  if (activityType === 'condition' || activityType === 'route' || activityType === 'exclusive_gateway') {
    return 'condition';
  }
  if (activityType === 'cc' || activityType === 'notify') {
    return 'cc';
  }
  return 'approval';
}

function resolveEndNodeStatus(instanceStatus) {
  if (instanceStatus === 'COMPLETED') { return 'completed'; }
  if (instanceStatus === 'TERMINATED') { return 'completed'; }
  return 'pending';
}

function ensureEdges(nodes, edges) {
  const edgeSet = new Set(edges.map(e => `${e.from}->${e.to}`));
  for (let i = 0; i < nodes.length - 1; i++) {
    const key = `${nodes[i].id}->${nodes[i + 1].id}`;
    if (!edgeSet.has(key)) {
      edges.push({ from: nodes[i].id, to: nodes[i + 1].id, type: 'normal' });
      edgeSet.add(key);
    }
  }
}

function formatTime(timeStr) {
  if (!timeStr) { return ''; }
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) { return timeStr; }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return timeStr;
  }
}

// ── HTML 生成 ─────────────────────────────────────────

function generateHtml(processData, appType, processInstanceId) {
  const { nodes, edges, instanceStatus } = processData;

  const statusLabel = {
    RUNNING: '进行中',
    COMPLETED: '已完成',
    TERMINATED: '已终止',
    ERROR: '异常',
  };

  const nodesJson = JSON.stringify(nodes);
  const edgesJson = JSON.stringify(edges);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>流程预览 - ${processInstanceId}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 20px;
  }
  .container {
    max-width: 900px;
    margin: 0 auto;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    overflow: hidden;
  }
  .header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #fff;
    padding: 24px 32px;
  }
  .header h1 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .header .meta {
    font-size: 13px;
    color: rgba(255,255,255,0.7);
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .header .meta .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
  .status-running { background: rgba(59,130,246,0.3); color: #93c5fd; }
  .status-completed { background: rgba(34,197,94,0.3); color: #86efac; }
  .status-terminated { background: rgba(239,68,68,0.3); color: #fca5a5; }

  .flow-canvas {
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  /* 节点通用样式 */
  .flow-node {
    position: relative;
    width: 320px;
    border-radius: 12px;
    padding: 16px 20px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .flow-node:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.12);
  }
  .flow-node .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .flow-node .node-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    flex-shrink: 0;
  }
  .flow-node .node-title {
    font-size: 14px;
    font-weight: 600;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .flow-node .node-detail {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
    line-height: 1.5;
  }
  .flow-node .node-detail .operator { color: #374151; font-weight: 500; }
  .flow-node .node-detail .time { color: #9ca3af; }
  .flow-node .node-remark {
    font-size: 12px;
    color: #6b7280;
    margin-top: 6px;
    padding: 6px 10px;
    background: rgba(0,0,0,0.03);
    border-radius: 6px;
    border-left: 3px solid #d1d5db;
    display: none;
  }
  .flow-node.expanded .node-remark { display: block; }

  /* 已完成节点 */
  .node-completed {
    background: #f0fdf4;
    border: 2px solid #86efac;
  }
  .node-completed .node-icon { background: #22c55e; color: #fff; }
  .node-completed .node-title { color: #166534; }

  /* 当前节点 */
  .node-current {
    background: #eff6ff;
    border: 2px solid #60a5fa;
    animation: pulse-border 2s ease-in-out infinite;
  }
  .node-current .node-icon { background: #3b82f6; color: #fff; }
  .node-current .node-title { color: #1e40af; }
  @keyframes pulse-border {
    0%, 100% { border-color: #60a5fa; box-shadow: 0 0 0 0 rgba(59,130,246,0.3); }
    50% { border-color: #3b82f6; box-shadow: 0 0 0 6px rgba(59,130,246,0); }
  }

  /* 未到达节点 */
  .node-pending {
    background: #f9fafb;
    border: 2px solid #d1d5db;
  }
  .node-pending .node-icon { background: #d1d5db; color: #fff; }
  .node-pending .node-title { color: #6b7280; }

  /* 被跳过节点 */
  .node-skipped {
    background: #f9fafb;
    border: 2px dashed #d1d5db;
    opacity: 0.6;
  }
  .node-skipped .node-icon { background: #e5e7eb; color: #9ca3af; }
  .node-skipped .node-title { color: #9ca3af; text-decoration: line-through; }

  /* 条件节点（菱形） */
  .node-condition-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .node-condition-wrapper .diamond {
    width: 40px;
    height: 40px;
    transform: rotate(45deg);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .node-condition-wrapper .diamond-icon {
    transform: rotate(-45deg);
    font-size: 14px;
  }
  .node-condition-wrapper.status-completed .diamond { background: #22c55e; color: #fff; }
  .node-condition-wrapper.status-current .diamond { background: #3b82f6; color: #fff; }
  .node-condition-wrapper.status-pending .diamond { background: #d1d5db; color: #fff; }
  .node-condition-wrapper.status-skipped .diamond { background: #e5e7eb; color: #9ca3af; border: 2px dashed #d1d5db; }
  .node-condition-wrapper .condition-label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    text-align: center;
    max-width: 200px;
  }

  /* 连线箭头 */
  .flow-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 36px;
    position: relative;
  }
  .flow-arrow .arrow-line {
    width: 2px;
    flex: 1;
    background: #d1d5db;
  }
  .flow-arrow .arrow-head {
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid #d1d5db;
  }
  .flow-arrow.completed .arrow-line { background: #86efac; }
  .flow-arrow.completed .arrow-head { border-top-color: #86efac; }
  .flow-arrow.dashed .arrow-line {
    background: repeating-linear-gradient(to bottom, #d1d5db 0, #d1d5db 4px, transparent 4px, transparent 8px);
  }

  /* 起始/结束节点 */
  .node-start, .node-end {
    width: 320px;
    text-align: center;
    border-radius: 24px;
    padding: 12px 20px;
  }
  .node-start {
    background: #f0fdf4;
    border: 2px solid #86efac;
  }
  .node-end.node-completed {
    background: #f0fdf4;
    border: 2px solid #86efac;
  }
  .node-end.node-pending {
    background: #f9fafb;
    border: 2px solid #d1d5db;
  }

  /* Tooltip */
  .tooltip {
    display: none;
    position: fixed;
    background: #1f2937;
    color: #fff;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.6;
    max-width: 300px;
    z-index: 1000;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    pointer-events: none;
  }
  .tooltip.visible { display: block; }

  /* 图例 */
  .legend {
    display: flex;
    justify-content: center;
    gap: 20px;
    padding: 16px 24px;
    border-top: 1px solid #f3f4f6;
    flex-wrap: wrap;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #6b7280;
  }
  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .legend-dot.completed { background: #22c55e; }
  .legend-dot.current { background: #3b82f6; }
  .legend-dot.pending { background: #d1d5db; }
  .legend-dot.skipped { background: #e5e7eb; border: 1px dashed #9ca3af; }

  /* 响应式 */
  @media (max-width: 600px) {
    body { padding: 8px; }
    .container { border-radius: 12px; }
    .header { padding: 16px 20px; }
    .header h1 { font-size: 17px; }
    .flow-canvas { padding: 20px 12px; }
    .flow-node, .node-start, .node-end { width: 280px; padding: 12px 14px; }
    .legend { gap: 12px; padding: 12px 16px; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>📋 流程预览</h1>
    <div class="meta">
      <span>实例 ID: ${processInstanceId}</span>
      <span>应用: ${appType}</span>
      <span class="status-badge status-${(instanceStatus || 'running').toLowerCase()}">${statusLabel[instanceStatus] || instanceStatus || '进行中'}</span>
    </div>
  </div>
  <div class="flow-canvas" id="flowCanvas"></div>
  <div class="legend">
    <div class="legend-item"><div class="legend-dot completed"></div>已完成</div>
    <div class="legend-item"><div class="legend-dot current"></div>当前节点</div>
    <div class="legend-item"><div class="legend-dot pending"></div>未到达</div>
    <div class="legend-item"><div class="legend-dot skipped"></div>被跳过</div>
  </div>
</div>
<div class="tooltip" id="tooltip"></div>

<script>
(function() {
  var nodes = ${nodesJson};
  var edges = ${edgesJson};
  var canvas = document.getElementById('flowCanvas');
  var tooltip = document.getElementById('tooltip');

  var STATUS_ICONS = {
    completed: '✅',
    current: '🔵',
    pending: '⬜',
    skipped: '⏭️'
  };

  function renderFlow() {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];

      // 在节点之间添加箭头（除了第一个节点）
      if (i > 0) {
        var prevNode = nodes[i - 1];
        var arrowClass = 'flow-arrow';
        if (prevNode.status === 'completed') arrowClass += ' completed';
        var arrowEl = document.createElement('div');
        arrowEl.className = arrowClass;
        arrowEl.innerHTML = '<div class="arrow-line"></div><div class="arrow-head"></div>';
        canvas.appendChild(arrowEl);
      }

      // 条件节点使用菱形
      if (node.type === 'condition') {
        renderConditionNode(node);
        continue;
      }

      // 普通节点
      var nodeEl = document.createElement('div');
      var nodeClass = 'flow-node node-' + node.status;
      if (node.type === 'start' || node.type === 'end') {
        nodeClass += ' node-' + node.type;
      }
      nodeEl.className = nodeClass;
      nodeEl.setAttribute('data-node-id', node.id);

      var iconText = STATUS_ICONS[node.status] || '⬜';
      var detailHtml = '';
      if (node.operator) {
        detailHtml += '<span class="operator">' + escapeHtml(node.operator) + '</span>';
      }
      if (node.operateTime) {
        detailHtml += (detailHtml ? '  ' : '') + '<span class="time">' + escapeHtml(node.operateTime) + '</span>';
      }

      var remarkHtml = '';
      if (node.remark) {
        remarkHtml = '<div class="node-remark">' + escapeHtml(node.remark) + '</div>';
      }

      nodeEl.innerHTML =
        '<div class="node-header">' +
          '<div class="node-icon">' + iconText + '</div>' +
          '<div class="node-title">' + escapeHtml(node.label) + '</div>' +
        '</div>' +
        (detailHtml ? '<div class="node-detail">' + detailHtml + '</div>' : '') +
        remarkHtml;

      // 点击展开/收起备注
      if (node.remark) {
        nodeEl.addEventListener('click', function() {
          this.classList.toggle('expanded');
        });
      }

      // 悬停 tooltip
      nodeEl.addEventListener('mouseenter', function(e) {
        var nodeData = findNodeById(this.getAttribute('data-node-id'));
        if (nodeData) showTooltip(e, nodeData);
      });
      nodeEl.addEventListener('mousemove', function(e) {
        moveTooltip(e);
      });
      nodeEl.addEventListener('mouseleave', function() {
        hideTooltip();
      });

      canvas.appendChild(nodeEl);
    }
  }

  function renderConditionNode(node) {
    var wrapper = document.createElement('div');
    wrapper.className = 'node-condition-wrapper status-' + node.status;
    wrapper.setAttribute('data-node-id', node.id);

    var iconText = node.status === 'completed' ? '✅' : (node.status === 'current' ? '🔵' : '◇');
    wrapper.innerHTML =
      '<div class="diamond"><span class="diamond-icon">' + iconText + '</span></div>' +
      '<div class="condition-label">' + escapeHtml(node.label) + '</div>';

    wrapper.addEventListener('mouseenter', function(e) {
      var nodeData = findNodeById(this.getAttribute('data-node-id'));
      if (nodeData) showTooltip(e, nodeData);
    });
    wrapper.addEventListener('mousemove', function(e) { moveTooltip(e); });
    wrapper.addEventListener('mouseleave', function() { hideTooltip(); });

    canvas.appendChild(wrapper);
  }

  function findNodeById(id) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return nodes[i];
    }
    return null;
  }

  function showTooltip(e, node) {
    var statusMap = { completed: '已完成', current: '待审批', pending: '未到达', skipped: '已跳过' };
    var lines = ['<strong>' + escapeHtml(node.label) + '</strong>'];
    lines.push('状态: ' + (statusMap[node.status] || node.status));
    if (node.operator) lines.push('审批人: ' + escapeHtml(node.operator));
    if (node.operateTime) lines.push('时间: ' + escapeHtml(node.operateTime));
    if (node.remark) lines.push('意见: ' + escapeHtml(node.remark));
    tooltip.innerHTML = lines.join('<br>');
    tooltip.classList.add('visible');
    moveTooltip(e);
  }

  function moveTooltip(e) {
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top = (e.clientY + 12) + 'px';
  }

  function hideTooltip() {
    tooltip.classList.remove('visible');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  renderFlow();
})();
</script>
</body>
</html>`;
}

// ── 主函数 ────────────────────────────────────────────

async function run(args) {
  const { appType, processInstanceId, outputPath } = parseArgs(args);

  if (!appType || !processInstanceId) {
    console.error(t('preview_process.usage'));
    console.error(t('preview_process.example'));
    process.exit(1);
  }

  console.error(`\n🔍 ${t('preview_process.fetching', processInstanceId)}`);

  const auth = ensureAuth();

  // 并行获取流程实例和操作记录
  const [instanceData, operationRecords] = await Promise.all([
    fetchProcessInstance(auth, appType, processInstanceId),
    fetchOperationRecords(auth, appType, processInstanceId),
  ]);

  console.error(`✅ ${t('preview_process.data_fetched')}`);

  // 解析流程数据
  const processData = parseProcessData(instanceData, operationRecords);
  console.error(`📊 ${t('preview_process.nodes_count', processData.nodes.length)}`);

  // 生成 HTML
  const html = generateHtml(processData, appType, processInstanceId);

  // 确定输出路径
  const finalOutputPath = outputPath || path.join(
    findProjectRoot(),
    `process-preview-${processInstanceId.substring(0, 8)}.html`
  );

  fs.writeFileSync(finalOutputPath, html, 'utf-8');
  console.error(`\n🎉 ${t('preview_process.output_success', finalOutputPath)}`);

  // 输出结构化结果到 stdout
  console.log(JSON.stringify({
    success: true,
    outputPath: finalOutputPath,
    processInstanceId,
    instanceStatus: processData.instanceStatus,
    nodeCount: processData.nodes.length,
    edgeCount: processData.edges.length,
  }, null, 2));

  // 尝试自动打开浏览器
  tryOpenBrowser(finalOutputPath);
}

function tryOpenBrowser(filePath) {
  try {
    const { execSync } = require('child_process');
    const platform = process.platform;
    if (platform === 'darwin') {
      execSync(`open "${filePath}"`, { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execSync(`start "" "${filePath}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${filePath}"`, { stdio: 'ignore' });
    }
    console.error(`🌐 ${t('preview_process.browser_opened')}`);
  } catch {
    console.error(`💡 ${t('preview_process.browser_hint', filePath)}`);
  }
}

module.exports = { run };
