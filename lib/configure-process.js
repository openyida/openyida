#!/usr/bin/env node
/**
 * configure-process.js - 宜搭流程规则配置命令
 *
 * 用法：openyida configure-process <appType> <formUuid> <processDefinitionFile> [processCode]
 *
 * 功能：
 *   根据流程定义 JSON 文件，自动配置宜搭流程表单的审批流程。
 *   支持条件分支、嵌套分支、审批节点、字段权限、抄送节点、跳转规则。
 *
 * 核心流程：
 *   1. 获取 processCode（优先使用传入参数，否则通过 switchFormType + getAppPlatFormParam 自动获取）
 *   2. 查询流程版本列表，获取当前已发布版本的 processId
 *   3. 创建新流程版本草稿
 *   4. 根据流程定义 JSON 构建 processJson 和 viewJson（严格匹配宜搭真实格式）
 *   5. 调用 saveProcessById 保存流程
 *   6. 调用 publishProcessById 发布流程
 */

"use strict";

const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
const {
  findProjectRoot,
  loadCookieData,
  triggerLogin,
  refreshCsrfToken,
  resolveBaseUrl,
  httpPost,
  httpGet,
  requestWithAutoLogin,
} = require("./utils");
const { t } = require("./i18n");

// ── 操作符映射（基于浏览器捕获的真实数据）────────────

const OP_CODE_TO_DISPLAY = {
  Equal: "等于",
  NotEqual: "不等于",
  Contains: "包含",
  NotContain: "不包含",
  IsEmpty: "为空",
  IsNotEmpty: "不为空",
  GreaterThan: "大于",
  Bigger: "大于",
  GreaterThanOrEqual: "大于等于",
  LessThan: "小于",
  LessThanOrEqual: "小于等于",
  In: "属于",
  NotIn: "不属于",
};

// 注意：从浏览器捕获数据来看，NumberField 的 ruleType 实际是 "rule_text"
const COMPONENT_TO_RULE_TYPE = {
  TextField: "rule_text",
  TextareaField: "rule_text",
  NumberField: "rule_text",
  SelectField: "rule_select",
  RadioField: "rule_radio",
  DateField: "rule_date",
  EmployeeField: "rule_employee",
};

// ── 辅助函数 ─────────────────────────────────────────

function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let nodeIdCounter = 1;
function generateNodeId() {
  return "node_oc" + Date.now().toString(36) + (nodeIdCounter++).toString(36);
}

function i18n(zhText, enText) {
  return { en_US: enText || zhText, zh_CN: zhText, type: "i18n" };
}

// ── 构建审批/抄送动作列表 ────────────────────────────

function buildActions() {
  const actionDefs = [
    { action: "agree", zh: "同意", en: "Agree", hidden: false },
    { action: "disagree", zh: "拒绝", en: "Disagree", hidden: false },
    { action: "save", zh: "保存", en: "Save", hidden: true },
    { action: "forward", zh: "转交", en: "Forward", hidden: true },
    { action: "append", zh: "加签", en: "Append", hidden: true },
    { action: "return", zh: "退回", en: "Return", hidden: true },
  ];

  return actionDefs.map(function (def) {
    return {
      action: def.action,
      name: i18n(def.zh, def.en),
      hidden: def.hidden,
    };
  });
}

function buildAppendActions() {
  return [
    { action: "appendBefore", name: i18n("前加签", "Prepend"), hidden: false },
    { action: "appendAfter", name: i18n("后加签", "Append After"), hidden: false },
  ];
}

// ── 构建条件规则 ─────────────────────────────────────

function buildConditionRules(rules) {
  return rules.map(function (rule) {
    const ruleType = COMPONENT_TO_RULE_TYPE[rule.componentType] || "rule_text";
    const opDisplay = OP_CODE_TO_DISPLAY[rule.op] || rule.op;

    return {
      fieldId: rule.fieldId,
      fieldName: i18n(rule.fieldName || rule.fieldId),
      ruleType: ruleType,
      componentType: rule.componentType || "TextField",
      op: opDisplay,
      opCode: rule.op,
      value: Array.isArray(rule.value) ? rule.value : [String(rule.value)],
    };
  });
}

// ── 递归分配 nodeId ──────────────────────────────────

function assignNodeIdsRecursive(nodes, nameToIdMap) {
  nodes.forEach(function (node) {
    if (node.type === "route") {
      node._nodeId = generateNodeId();
      const conditions = node.conditions || [];
      conditions.forEach(function (cond) {
        cond._nodeId = generateNodeId();
        if (cond.childNodes && cond.childNodes.length > 0) {
          assignNodeIdsRecursive(cond.childNodes, nameToIdMap);
        }
      });
    } else {
      node._nodeId = generateNodeId();
      if (node.name) {
        nameToIdMap[node.name] = node._nodeId;
      }
    }
  });
}

// ── 递归构建节点 ─────────────────────────────────────

function buildNodeListRecursive(nodes, exitNodeId, nameToIdMap) {
  const processNodes = [];
  const viewNodes = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nextNodeId = i + 1 < nodes.length ? nodes[i + 1]._nodeId : exitNodeId;

    if (node.type === "route") {
      const routeResult = buildRouteNode(node, nextNodeId, nameToIdMap);
      processNodes.push(routeResult.processNode);
      viewNodes.push(routeResult.viewNode);
    } else if (node.type === "approval") {
      const approvalResult = buildApprovalNode(node, nextNodeId, nameToIdMap);
      processNodes.push(approvalResult.processNode);
      viewNodes.push(approvalResult.viewNode);
    } else if (node.type === "carbon") {
      const carbonResult = buildCarbonNode(node, nextNodeId);
      processNodes.push(carbonResult.processNode);
      viewNodes.push(carbonResult.viewNode);
    }
  }

  return { processNodes, viewNodes };
}

// ── 构建审批节点 ─────────────────────────────────────

function buildApprovalNode(node, nextNodeId, nameToIdMap) {
  const nodeId = node._nodeId;
  const approverType = node.approver === "originator"
    ? "ext_target_approval_originator"
    : "ext_target_approval_originator";

  const processNode = {
    name: i18n(node.name || "审批", "Approval"),
    description: i18n(node.description || "发起人审批", "Sponsor approval"),
    type: "approval",
    approvalType: approverType,
    nodeId: nodeId,
    prevId: "",
    nextId: [nextNodeId],
    props: {
      approvals: [[node.approver || "originator"]],
      actions: buildActions(),
      appendActions: buildAppendActions(),
      openDigitalSign: false,
      noActionersType: "stopProcess",
    },
    childNodes: [],
  };

  // 跳转规则（routeRule）
  if (node.routeRules && node.routeRules.length > 0) {
    const routeRuleRules = [];
    node.routeRules.forEach(function (rr) {
      const targetNodeId = nameToIdMap[rr.jumpTo] || nextNodeId;
      routeRuleRules.push({
        action: rr.when || "disagree",
        nextId: targetNodeId,
      });
    });

    processNode.props.routeRule = {
      rules: routeRuleRules,
      triggerRule: "y",
      ruleIfMiss: "terminate",
      defaultNextId: [],
    };
  } else {
    processNode.props.routeRule = {
      rules: [],
      triggerRule: "n",
      ruleIfMiss: "terminate",
      defaultNextId: [],
    };
  }

  // 字段权限（formConfig）
  if (node.formConfig) {
    processNode.props.formConfig = node.formConfig;
  }

  const viewNode = {
    componentName: "ApprovalNode",
    id: nodeId,
    props: {
      nodeName: "ApprovalNode",
      name: i18n(node.name || "审批", "Approval"),
      description: i18n(node.description || "发起人审批", "Sponsor approval"),
      approverRules: {
        type: "APPROVER",
        approvalType: approverType,
        approvals: [[node.approver || "originator"]],
      },
      actions: {
        actions: buildActions(),
        appendActions: buildAppendActions(),
      },
    },
  };

  // viewNode 中的 routeRule
  if (node.routeRules && node.routeRules.length > 0) {
    viewNode.props.routeRule = processNode.props.routeRule;
  } else {
    viewNode.props.routeRule = {
      rules: [],
      triggerRule: "n",
      ruleIfMiss: "terminate",
      defaultNextId: [],
    };
  }

  // viewNode 中的 formConfig
  if (node.formConfig) {
    viewNode.props.formConfig = node.formConfig;
  }

  return { processNode, viewNode };
}

// ── 构建抄送节点 ─────────────────────────────────────

function buildCarbonNode(node, nextNodeId) {
  const nodeId = node._nodeId;

  const processNode = {
    name: i18n(node.name || "抄送人", "CC"),
    description: "",
    type: "carbon",
    approvalType: "ext_target_approval_originator",
    nodeId: nodeId,
    prevId: "",
    nextId: [nextNodeId],
    props: {
      conditionalMode: "conditional",
      params: [
        { key: "nodeId", value: nodeId },
        { key: "instId", value: "#procInstId" },
        { key: "userId", value: "#originator" },
        { key: "receiver", value: { type: "VARIABLE", value: [[node.approver || "originator"]] } },
      ],
    },
    childNodes: [],
  };

  const viewNode = {
    componentName: "CarbonNode",
    id: nodeId,
    props: {
      nodeName: "CarbonNode",
      name: i18n(node.name || "抄送人", "CC"),
      approverRules: {
        type: "CC",
        approvalType: "ext_target_approval_originator",
        approvals: [[node.approver || "originator"]],
      },
    },
  };

  return { processNode, viewNode };
}

// ── 构建条件分支路由节点 ─────────────────────────────

function buildRouteNode(node, exitNodeId, nameToIdMap) {
  const routeNodeId = node._nodeId;
  const conditions = node.conditions || [];

  const conditionNodeIds = [];
  const conditionProcessNodes = [];
  const conditionViewNodes = [];

  // 构建每个条件分支
  conditions.forEach(function (cond, index) {
    const condNodeId = cond._nodeId;
    conditionNodeIds.push(condNodeId);

    // 递归构建条件分支内的子节点
    let childProcessNodes = [];
    let childViewNodes = [];
    if (cond.childNodes && cond.childNodes.length > 0) {
      const childResult = buildNodeListRecursive(cond.childNodes, exitNodeId, nameToIdMap);
      childProcessNodes = childResult.processNodes;
      childViewNodes = childResult.viewNodes;
    }

    // 构建条件规则
    let conditionProps = {
      priority: index + 1,
      isDefault: false,
    };

    if (cond.rules && cond.rules.length > 0) {
      conditionProps.conditions = {
        condition: (cond.logic || "AND").toUpperCase(),
        conditionCode: cond.logic === "OR" ? "||" : "&&",
        rules: buildConditionRules(cond.rules),
        ruleId: "group-" + generateUuid(),
      };
      conditionProps.calculate = "condition";
    }

    const condProcessNode = {
      name: i18n(cond.name || "条件 " + (index + 1), "Condition " + (index + 1)),
      description: "",
      type: "condition",
      nodeId: condNodeId,
      prevId: routeNodeId,
      nextId: [exitNodeId],
      props: conditionProps,
      childNodes: childProcessNodes,
    };

    conditionProcessNodes.push(condProcessNode);

    const condViewNode = {
      componentName: "ConditionNode",
      id: condNodeId,
      props: {
        isDefault: false,
        buttons: [{ name: "关闭" }],
        name: i18n(cond.name || "条件 " + (index + 1), "Condition " + (index + 1)),
        description: "",
      },
      children: childViewNodes,
    };

    if (cond.rules && cond.rules.length > 0) {
      condViewNode.props.conditions = conditionProps.conditions;
      condViewNode.props.calculate = "condition";
    }

    conditionViewNodes.push(condViewNode);
  });

  // 添加默认条件分支（"其他情况"）
  const defaultCondNodeId = generateNodeId();
  conditionNodeIds.push(defaultCondNodeId);

  const defaultCondProcessNode = {
    name: i18n("其他情况", "Other situations"),
    description: "",
    type: "condition",
    nodeId: defaultCondNodeId,
    prevId: routeNodeId,
    nextId: [exitNodeId],
    props: {
      priority: 2147483647,
      isDefault: true,
    },
    childNodes: [],
  };

  conditionProcessNodes.push(defaultCondProcessNode);

  const defaultCondViewNode = {
    componentName: "ConditionNode",
    id: defaultCondNodeId,
    props: {
      isDefault: true,
      buttons: [{ name: "关闭" }],
      name: i18n("其他情况", "Other situations"),
      description: "",
    },
  };

  conditionViewNodes.push(defaultCondViewNode);

  // 构建 route processNode
  const routeProcessNode = {
    name: { zh_CN: "ConditionNode", en_US: "" },
    description: "",
    type: "route",
    nodeId: routeNodeId,
    prevId: "",
    nextId: conditionNodeIds,
    props: { outgoingType: "priority" },
    childNodes: conditionProcessNodes,
  };

  // 构建 route viewNode（ConditionContainer）
  const routeViewNode = {
    componentName: "ConditionContainer",
    id: routeNodeId,
    props: {},
    title: "条件分支",
    children: conditionViewNodes,
  };

  return { processNode: routeProcessNode, viewNode: routeViewNode };
}

// ── 构建完整的 processJson 和 viewJson ──────────────

function buildProcessAndViewJson(definition, processCode, formUuid, baseUrl, appType) {
  const finishNodeId = generateNodeId();
  const nodes = definition.nodes || [];

  // 第一遍：递归分配 nodeId 并收集名称映射
  const nodeNameToIdMap = {};
  assignNodeIdsRecursive(nodes, nodeNameToIdMap);

  // 将结束节点加入映射
  nodeNameToIdMap["结束"] = finishNodeId;
  nodeNameToIdMap["finish"] = finishNodeId;
  nodeNameToIdMap["end"] = finishNodeId;

  // 第二遍：递归构建所有节点
  const middleResult = buildNodeListRecursive(nodes, finishNodeId, nodeNameToIdMap);

  const firstMiddleNodeId = middleResult.processNodes.length > 0
    ? middleResult.processNodes[0].nodeId
    : finishNodeId;

  // 组装发起节点
  const applyProcessNode = {
    name: i18n("发起", "start"),
    description: "",
    type: "apply",
    nodeId: "sid_instStart",
    prevId: "",
    nextId: [firstMiddleNodeId],
    props: {},
    childNodes: [],
  };

  // 组装结束节点
  const finishProcessNode = {
    name: i18n("结束", "end"),
    description: "",
    type: "finish",
    nodeId: finishNodeId,
    prevId: "",
    nextId: [],
    props: {},
    childNodes: [],
  };

  // 组装 processJson
  const processNodes = [applyProcessNode];
  middleResult.processNodes.forEach(function (node) {
    processNodes.push(node);
  });
  processNodes.push(finishProcessNode);

  const defaultProcessDetailUrl = baseUrl + "/alibaba/web/" + appType + "/inst/taskDetail.htm";
  const defaultProcessMobileDetailUrl = baseUrl + "/alibaba/mobile/" + appType + "/inst/detail/taskDetail/";

  const processJson = {
    props: {
      allowWithdraw: true,
      allowCollaboration: true,
      allowTemporaryStorage: true,
      processCode: processCode,
      processDetailUrl: definition.processDetailUrl || defaultProcessDetailUrl,
      processInitUrl: baseUrl + "/alibaba/web/" + appType + "/inst/instStart.htm?processCode=" + processCode,
      processMobileDetailUrl: definition.processMobileDetailUrl || defaultProcessMobileDetailUrl,
      bindingForm: formUuid,
      stopAssociationRulesIfFailed: false,
      noRecordRecall: false,
      untimedRule: [],
    },
    nodes: processNodes,
    flowConfig: {},
    formulaRules: [],
    approvalSummary: [],
    nodeI18nKeyMap: {},
  };

  // 组装 viewJson
  const viewChildren = [];

  viewChildren.push({
    componentName: "ApplyNode",
    id: generateNodeId(),
    props: {
      nodeName: "ApplyNode",
      name: i18n("发起", "start"),
    },
  });

  middleResult.viewNodes.forEach(function (node) {
    viewChildren.push(node);
  });

  viewChildren.push({
    componentName: "EndNode",
    id: finishNodeId,
    props: {
      name: i18n("结束", "end"),
    },
  });

  const viewJson = {
    schema: {
      componentName: "CanvasEngine",
      id: generateNodeId(),
      props: {},
      children: viewChildren,
    },
    bindingForm: formUuid,
    formulaRules: [],
    globalSetting: {
      enableSignature: false,
      stopAssociationRulesIfFailed: false,
      nodeMerge: false,
      originatorMerge: false,
      allNodeMerge: false,
      behaviorList: [],
      needOpenDigitalSignNodes: [],
      approvalSummary: [],
      noRecordRecall: false,
      untimedRule: [],
    },
  };

  return { processJson, viewJson };
}

// ── API 调用函数 ─────────────────────────────────────

function queryProcessVersions(authRef, appType, processCode, status) {
  const requestPath = "/alibaba/web/" + appType + "/query/process/pageProcessVersion.json"
    + "?_api=Process.getProcessVersionInfo&_mock=false"
    + "&_csrf_token=" + encodeURIComponent(authRef.csrfToken)
    + "&_locale_time_zone_offset=28800000"
    + "&processCode=" + encodeURIComponent(processCode)
    + "&appType=" + encodeURIComponent(appType)
    + "&status=" + (status || "")
    + "&pageIndex=1&pageSize=10"
    + "&orderByModifyTime=desc"
    + "&_stamp=" + Date.now();
  return httpGet(authRef.baseUrl, requestPath, null, authRef.cookies);
}

function switchFormType(authRef, appType, formUuid) {
  const requestPath = "/" + appType + "/query/formdesign/switchFormType.json"
    + "?_api=Nav.transformForm&_mock=false&_stamp=" + Date.now();
  const postData = querystring.stringify({
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: "28800000",
    toFormType: "process",
    formUuid: formUuid,
  });
  return httpPost(authRef.baseUrl, requestPath, postData, authRef.cookies);
}

function getProcessCodeFromAppParam(authRef, appType, formUuid) {
  const requestPath = "/" + appType + "/query/app/getAppPlatFormParam.json"
    + "?_api=nattyFetch&_mock=false"
    + "&_csrf_token=" + encodeURIComponent(authRef.csrfToken)
    + "&_locale_time_zone_offset=28800000"
    + "&pageIndex=1&pageSize=50"
    + "&_stamp=" + Date.now();
  return httpGet(authRef.baseUrl, requestPath, null, authRef.cookies).then(function (result) {
    if (result.success && result.content && result.content.formNavigationList) {
      const navList = result.content.formNavigationList;
      for (let i = 0; i < navList.length; i++) {
        if (navList[i].formUuid === formUuid && navList[i].processCode) {
          return navList[i].processCode;
        }
      }
    }
    return null;
  });
}

function getProcessCodeFromSchema(authRef, appType, formUuid) {
  const requestPath = "/dingtalk/web/" + appType + "/query/formdesign/getFormSchema.json"
    + "?formUuid=" + encodeURIComponent(formUuid)
    + "&schemaVersion=V5";
  return httpGet(authRef.baseUrl, requestPath, null, authRef.cookies).then(function (result) {
    if (result.success && result.content) {
      const schemaStr = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
      const matches = schemaStr.match(/TPROC[A-Za-z0-9_-]+/g);
      if (matches && matches.length > 0) {
        const unique = [];
        const seen = {};
        matches.forEach(function (m) {
          if (!seen[m]) { seen[m] = true; unique.push(m); }
        });
        return unique[0];
      }
    }
    return null;
  });
}

function newDraftProcess(authRef, appType, processCode, formUuid, processId, processVersion) {
  const requestPath = "/" + appType + "/query/simpleProcess/newDraftProcess.json";
  const postObj = {
    _csrf_token: authRef.csrfToken,
    _locale_time_zone_offset: "28800000",
    formUuid: formUuid,
    processCode: processCode,
  };
  if (processId) postObj.processId = String(processId);
  if (processVersion !== undefined && processVersion !== null) postObj.processVersion = String(processVersion);
  return httpPost(authRef.baseUrl, requestPath, querystring.stringify(postObj), authRef.cookies);
}

function saveProcessById(authRef, appType, formUuid, processCode, processId, processVersion, processJsonStr, viewJsonStr) {
  const requestPath = "/alibaba/web/" + appType + "/query/simpleProcess/saveProcessById.json";
  return httpPost(authRef.baseUrl, requestPath, querystring.stringify({
    _csrf_token: authRef.csrfToken,
    formUuid: formUuid,
    isOnline: "true",
    json: processJsonStr,
    needReportLine: "y",
    processCode: processCode,
    processId: String(processId),
    processVersion: String(processVersion),
    viewJson: viewJsonStr,
  }), authRef.cookies);
}

function publishProcessById(authRef, appType, formUuid, processCode, processId, processVersion) {
  const requestPath = "/alibaba/web/" + appType + "/query/simpleProcess/publishProcessById.json";
  return httpPost(authRef.baseUrl, requestPath, querystring.stringify({
    _csrf_token: authRef.csrfToken,
    formUuid: formUuid,
    processCode: processCode,
    processId: String(processId),
    processVersion: String(processVersion),
  }), authRef.cookies);
}

// ── 主流程 ───────────────────────────────────────────

async function run(args) {
  if (args.length < 3) {
    console.error(t("configure_process.usage"));
    process.exit(1);
  }

  const appType = args[0];
  const formUuid = args[1];
  const processDefinitionFile = path.resolve(args[2]);
  const processCodeArg = args[3] || null;

  console.error("🔧 " + t("configure_process.title"));
  console.error("  " + t("configure_process.app_id") + ": " + appType);
  console.error("  " + t("configure_process.form_uuid") + ": " + formUuid);
  console.error("  " + t("configure_process.definition_file") + ": " + processDefinitionFile);
  if (processCodeArg) {
    console.error("  processCode: " + processCodeArg + " (" + t("configure_process.from_cli") + ")");
  }
  console.error("");

  // 1. 读取流程定义
  if (!fs.existsSync(processDefinitionFile)) {
    console.error("  ❌ " + t("configure_process.file_not_found") + ": " + processDefinitionFile);
    process.exit(1);
  }

  let definition;
  try {
    definition = JSON.parse(fs.readFileSync(processDefinitionFile, "utf-8"));
  } catch (e) {
    console.error("  ❌ " + t("configure_process.parse_failed") + ": " + e.message);
    process.exit(1);
  }
  console.error("  ✅ " + t("configure_process.definition_loaded") + " (" + (definition.nodes || []).length + " " + t("configure_process.nodes") + ")");

  // 2. 读取登录态
  console.error("\n🔑 " + t("configure_process.loading_auth") + "...");
  let cookieData = loadCookieData();
  if (!cookieData || !cookieData.cookies || cookieData.cookies.length === 0) {
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData: cookieData,
  };
  console.error("  ✅ " + t("configure_process.auth_loaded") + ", baseUrl: " + authRef.baseUrl);

  // 3. 获取 processCode
  console.error("\n🔍 " + t("configure_process.getting_process_code") + "...");
  let processCode = processCodeArg;

  if (!processCode) {
    // 确保表单是流程表单
    console.error("  " + t("configure_process.switching_form_type") + "...");
    const switchResult = await switchFormType(authRef, appType, formUuid);
    if (switchResult.success) {
      console.error("  ✅ " + t("configure_process.switch_success"));
    } else {
      const switchMsg = switchResult.errorMsg || "";
      if (switchMsg.indexOf("已转换") >= 0 || switchMsg.indexOf("已经是") >= 0) {
        console.error("  ✅ " + t("configure_process.already_process"));
      } else {
        console.error("  ⚠️ " + t("configure_process.switch_warning") + ": " + switchMsg);
      }
    }

    // 方法 1: 从 getAppPlatFormParam 接口提取
    console.error("  " + t("configure_process.method1") + "...");
    processCode = await getProcessCodeFromAppParam(authRef, appType, formUuid);
    if (processCode) {
      console.error("  ✅ " + t("configure_process.got_process_code") + ": " + processCode);
    }

    // 方法 2: 从 getFormSchema 中提取
    if (!processCode) {
      console.error("  " + t("configure_process.method2") + "...");
      processCode = await getProcessCodeFromSchema(authRef, appType, formUuid);
      if (processCode) {
        console.error("  ✅ " + t("configure_process.got_from_schema") + ": " + processCode);
      }
    }
  }

  if (!processCode) {
    console.error("  ❌ " + t("configure_process.no_process_code"));
    console.error("  💡 " + t("configure_process.manual_hint"));
    process.exit(1);
  }
  console.error("  ✅ processCode: " + processCode);

  // 4. 查询流程版本列表
  console.error("\n🔍 " + t("configure_process.querying_versions") + "...");
  const publishedResult = await queryProcessVersions(authRef, appType, processCode, "PUBLISHED");

  let latestProcessId = null;
  let latestVersion = 0;

  if (publishedResult.success && publishedResult.content && publishedResult.content.data && publishedResult.content.data.length > 0) {
    const publishedVersion = publishedResult.content.data[0];
    latestProcessId = publishedVersion.id;
    latestVersion = parseInt(publishedVersion.version, 10);
    console.error("  ✅ " + t("configure_process.found_published") + ": processId=" + latestProcessId + ", version=" + latestVersion);
  } else {
    console.error("  ℹ️ " + t("configure_process.no_published") + "...");
    const allVersionsResult = await queryProcessVersions(authRef, appType, processCode, "");
    if (allVersionsResult.success && allVersionsResult.content && allVersionsResult.content.data && allVersionsResult.content.data.length > 0) {
      const latestItem = allVersionsResult.content.data[0];
      latestProcessId = latestItem.id;
      latestVersion = parseInt(latestItem.version, 10);
      console.error("  ✅ " + t("configure_process.found_latest") + ": processId=" + latestProcessId + ", version=" + latestVersion);
    }
  }

  const newVersion = latestVersion + 1;

  // 5. 创建新流程版本草稿
  console.error("\n📝 " + t("configure_process.creating_draft") + "...");
  const draftResult = await newDraftProcess(authRef, appType, processCode, formUuid, latestProcessId, newVersion);

  let newProcessId = null;

  if (draftResult.success && draftResult.content && draftResult.content.processId) {
    newProcessId = draftResult.content.processId;
    console.error("  ✅ " + t("configure_process.draft_created") + ": processId=" + newProcessId);
  } else if (draftResult.success) {
    console.error("  ✅ " + t("configure_process.draft_created_no_id"));
    const savedResult = await queryProcessVersions(authRef, appType, processCode, "");
    if (savedResult.success && savedResult.content && savedResult.content.data) {
      const savedVersions = savedResult.content.data.filter(function (item) { return item.status === "SAVED"; });
      if (savedVersions.length > 0) {
        newProcessId = savedVersions[0].id;
      } else {
        newProcessId = savedResult.content.data[0].id;
      }
    }
  } else {
    console.error("  ❌ " + t("configure_process.draft_failed") + ": " + (draftResult.errorMsg || JSON.stringify(draftResult)));
    process.exit(1);
  }

  if (!newProcessId) {
    console.error("  ❌ " + t("configure_process.no_draft_id"));
    process.exit(1);
  }

  // 6. 构建 processJson 和 viewJson
  console.error("\n🏗️  " + t("configure_process.building_json") + "...");
  const result = buildProcessAndViewJson(definition, processCode, formUuid, authRef.baseUrl, appType);
  const processJsonStr = JSON.stringify(result.processJson);
  const viewJsonStr = JSON.stringify(result.viewJson);
  console.error("  ✅ processJson: " + processJsonStr.length + " chars");
  console.error("  ✅ viewJson: " + viewJsonStr.length + " chars");

  // 7. 保存流程
  console.error("\n💾 " + t("configure_process.saving") + "...");
  const saveResult = await saveProcessById(
    authRef, appType, formUuid, processCode, newProcessId, newVersion,
    processJsonStr, viewJsonStr
  );

  if (saveResult.success) {
    console.error("  ✅ " + t("configure_process.save_success"));
  } else {
    console.error("  ❌ " + t("configure_process.save_failed") + ": " + (saveResult.errorMsg || JSON.stringify(saveResult)));
    process.exit(1);
  }

  // 8. 发布流程
  console.error("\n🚀 " + t("configure_process.publishing") + "...");
  const publishResult = await publishProcessById(
    authRef, appType, formUuid, processCode, newProcessId, newVersion
  );

  if (publishResult.success) {
    console.error("  ✅ " + t("configure_process.publish_success"));
  } else {
    console.error("  ❌ " + t("configure_process.publish_failed") + ": " + (publishResult.errorMsg || JSON.stringify(publishResult)));
    process.exit(1);
  }

  // 9. 输出结果
  const output = {
    success: true,
    processCode: processCode,
    processId: newProcessId,
    processVersion: newVersion,
    appType: appType,
    formUuid: formUuid,
  };

  console.log(JSON.stringify(output));
  console.error("\n🎉 " + t("configure_process.done"));
}

module.exports = { run };
