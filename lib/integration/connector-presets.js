'use strict';

const fs = require('fs');
const path = require('path');

/**
 * connector-presets.js - 已知连接器 action 的真实 inputs/outputs schema 预设
 *
 * 集成自动化画布识别「连接器节点已配置」的关键是：
 *   viewJson.schema.children[*].props.connectorRules.rules 必须是非空的赋值规则数组，
 *   每项外层含 inputSchema 字段 + id/parentId/rules，内层 rules[0] 带 valueType/value/ruleId/valueLabel。
 *
 * 宜搭后端不提供 action 的 inputs/outputs schema 查询接口（已探测 queryAction/getConnector 等 8 个
 * 接口均返回 inputs:null），所以这里内置高频 action 的真实 schema：
 *   - connector-presets/todo-create-task-inputs.json    （8 项入参）
 *   - connector-presets/todo-create-task-outputs.json   （1 项出参，含深度嵌套 children）
 *
 * 两份 JSON 均从 saveProcess.json 抓包的真实 viewJson 中拷贝出来，结构完全一致。
 *
 * integration-view-builder.js 构建 ConnectorNode 时：
 *   1. 优先使用 `--connector-inputs` 指定的 JSON
 *   2. 其次按 `${connectorId}::${actionId}` 查 preset 内嵌 JSON（返回 inputs + outputs + meta）
 *   3. 再无命中时按 assignments 合成最小 fallback inputs
 *   4. rules 数组由 buildConnectorRulesFromInputs(inputsSchema, assignments) 动态合成
 */

const PRESETS_DIR = path.join(__dirname, 'connector-presets');

/**
 * 预设索引：key = `${connectorId}::${actionId}`
 * value = { inputsFile, outputsFile, description, openDevSchemaType }
 */
const PRESET_INDEX = {
  'G-CONN-1016B8AEBED50B01B8D00009::G-ACT-1016B8B1911A0B01B8D0000I': {
    inputsFile: 'todo-create-task-inputs.json',
    outputsFile: 'todo-create-task-outputs.json',
    description: '创建待办任务 - 待办2.0',
    openDevSchemaType: 'normal',
  },
};

/**
 * 读取并缓存预设 JSON。
 */
const loadedCache = {};
function loadPresetJson(fileName) {
  if (loadedCache[fileName]) {
    return loadedCache[fileName];
  }
  const filePath = path.join(PRESETS_DIR, fileName);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    loadedCache[fileName] = JSON.parse(raw);
    return loadedCache[fileName];
  } catch (err) {
    return null;
  }
}

/**
 * 根据 connectorId + actionId 查找完整预设（inputs + outputs + meta）。
 * @returns {{inputs: Array, outputs: Array, description: string, openDevSchemaType: string}|null}
 */
function lookupConnectorPreset(connectorId, actionId) {
  if (!connectorId || !actionId) {
    return null;
  }
  const key = `${connectorId}::${actionId}`;
  const entry = PRESET_INDEX[key];
  if (!entry) {
    return null;
  }
  const inputs = loadPresetJson(entry.inputsFile);
  const outputs = loadPresetJson(entry.outputsFile);
  if (!Array.isArray(inputs)) {
    return null;
  }
  return {
    inputs,
    outputs: Array.isArray(outputs) ? outputs : [],
    description: entry.description || '',
    openDevSchemaType: entry.openDevSchemaType || 'normal',
  };
}

/**
 * 向后兼容旧接口：只返回 inputs schema。
 */
function lookupConnectorInputsPreset(connectorId, actionId) {
  const preset = lookupConnectorPreset(connectorId, actionId);
  return preset ? preset.inputs : null;
}

/**
 * 生成 ruleId：`rule-` + 20 位大写字母数字（与宜搭真实格式对齐）。
 */
function generateConnectorRuleId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'rule-';
  for (let i = 0; i < 20; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * 根据 inputs schema + assignments 合成 rules 数组。
 *
 * rules 数组结构（与真实 payload 完全对齐）：
 *   每一项 = 原 inputSchema 字段 + {id: name, parentId: '', rules: [innerRule]}
 *   innerRule = 原 inputSchema 字段 + {id: name, parentId: '', valueType, value, ruleId, valueLabel}
 *   若该 input 没有对应的 assignment（如 detailUrl），内层 rules 留空数组 []。
 *
 * 对于嵌套 Object 类型的 input（如 detailUrl.childList = [pcUrl, appUrl]），
 * childList 的 id/parentId 格式为 `<parent>%<child>` / `<parent>`。
 *
 * @param {Array} inputsSchema - inputs schema 数组（来自 preset 或用户指定）
 * @param {Array} assignments - [{column, valueType, value, valueLabel?}]
 * @returns {Array} rules 数组
 */
function buildConnectorRulesFromInputs(inputsSchema, assignments) {
  if (!Array.isArray(inputsSchema) || inputsSchema.length === 0) {
    return [];
  }
  const assignMap = {};
  (assignments || []).forEach((a) => {
    if (a && a.column) {
      assignMap[a.column] = a;
    }
  });

  return inputsSchema.map((input) => {
    const base = cloneInputSchema(input);
    base.id = input.name;
    base.parentId = '';

    // 处理嵌套子字段：为 childList 的每个子项补 id/parentId（格式 `<parent>%<child>` / `<parent>`）
    if (Array.isArray(base.childList)) {
      base.childList = base.childList.map((child) => {
        const cloned = cloneInputSchema(child);
        cloned.id = `${input.name}%${child.name}`;
        cloned.parentId = input.name;
        return cloned;
      });
    }

    const assign = assignMap[input.name];
    if (assign) {
      const innerBase = cloneInputSchema(input);
      innerBase.id = input.name;
      innerBase.parentId = '';
      innerBase.valueType = assign.valueType || 'processVar';
      innerBase.value = assign.valueType === 'literal' && !Number.isNaN(Number(assign.value))
        ? Number(assign.value)
        : assign.value;
      innerBase.ruleId = assign.ruleId || generateConnectorRuleId();
      innerBase.valueLabel = assign.valueLabel || input.label || input.name;
      base.rules = [innerBase];
    } else {
      base.rules = [];
    }
    return base;
  });
}

/**
 * 深拷贝 inputSchema 项，避免后续改动污染 preset 缓存。
 */
function cloneInputSchema(input) {
  return JSON.parse(JSON.stringify(input));
}

/**
 * 当既无用户传入的 inputs、也无 preset 命中时，按 assignments 的 column 列表合成最小 fallback schema。
 */
function buildFallbackInputsFromAssignments(assignments) {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return [];
  }
  return assignments.map((item) => ({
    childList: null,
    componentName: 'TextField',
    componentOption: '',
    componentProps: null,
    convert: '',
    defaultValue: '',
    desc: '',
    display: true,
    itemType: '',
    label: item.column,
    name: item.column,
    order: null,
    paramType: 'String',
    queryDefaultValue: null,
    required: false,
    successCondition: '',
    successFlag: null,
  }));
}

module.exports = {
  lookupConnectorPreset,
  lookupConnectorInputsPreset,
  buildConnectorRulesFromInputs,
  buildFallbackInputsFromAssignments,
  generateConnectorRuleId,
};
