'use strict';

const { loadAuthData, triggerLogin, resolveBaseUrl } = require('../core/utils');
const { generateNodeId } = require('./integration-node-ids');
const { getFormSchema, createLogicflow, saveProcess } = require('./integration-api');
const { mapEventTypes, buildProcessJson, resolveConnectorMode } = require('./integration-process-builder');
const { buildViewJson } = require('./integration-view-builder');
const { fetchFormPageList } = require('../app/form-navigation');
const {
  readIntegrationSpec,
  validateIntegrationSpec,
  buildSpecProcessAndViewJson,
  collectAddDataFormUuids,
} = require('./integration-spec-builder');
const { t } = require('../core/i18n');
const { warn } = require('../core/chalk');

// ── 参数解析 ──────────────────────────────────────────

/**
 * 从 args 数组中解析命名参数（--key value 格式）
 */
function parseFlag(args, flagName) {
  const index = args.indexOf(flagName);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

/**
 * 检查 args 中是否包含某个布尔标志
 */
function hasFlag(args, flagName) {
  return args.includes(flagName);
}

function normalizeFormType(formType) {
  return String(formType || '').trim().toLowerCase();
}

async function findFormNavigationItem(authRef, appType, formUuid, getFormNavigationItems) {
  if (!formUuid) {
    return null;
  }
  const forms = getFormNavigationItems
    ? await getFormNavigationItems()
    : await fetchFormPageList(appType, authRef);
  return forms.find((item) => item && item.formUuid === formUuid) || null;
}

function buildProcessAddDataTargetError(targetForm, targetFormUuid) {
  const targetName = targetForm && targetForm.formName ? `「${targetForm.formName}」` : targetFormUuid;
  return `${targetName} 是流程表单，不能作为“新增数据”节点的目标表单。请改用“发起审批”节点，或选择普通表单作为 --add-data-form-uuid。`;
}

// ── 主入口 ────────────────────────────────────────────

function buildInitiateApprovalTargetError(targetForm, targetFormUuid) {
  const targetName = targetForm && targetForm.formName ? `「${targetForm.formName}」` : targetFormUuid;
  return `${targetName} 不是流程表单，不能作为“发起审批”节点的目标表单。请改用流程表单，或对普通表单继续使用 --add-data-form-uuid。`;
}

function parseAssignments(args, flagName) {
  const assignments = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === flagName && args[index + 1]) {
      const colonIndex = args[index + 1].indexOf(':');
      const secondColonIndex = args[index + 1].indexOf(':', colonIndex + 1);
      if (colonIndex !== -1 && secondColonIndex !== -1) {
        const column = args[index + 1].slice(0, colonIndex);
        const valueType = args[index + 1].slice(colonIndex + 1, secondColonIndex);
        const value = args[index + 1].slice(secondColonIndex + 1);
        assignments.push({ column, valueType, value });
      }
      index++;
    }
  }
  return assignments;
}

function buildSelectUserInitiator(rawValue) {
  if (!rawValue) {
    return null;
  }
  const colonIndex = rawValue.indexOf(':');
  const id = colonIndex === -1 ? rawValue.trim() : rawValue.slice(0, colonIndex).trim();
  const label = colonIndex === -1 ? id : rawValue.slice(colonIndex + 1).trim();
  if (!id) {
    return null;
  }
  return {
    type: 'select_user',
    value: JSON.stringify({ id, label: label || id, type: 'employee' }),
  };
}

async function run(args) {
  // 兼容两种调用方式：
  // 1) bin/yida.js 路由层已吃掉 `create`，传入 [appType, formUuid, flowName, ...]
  // 2) 直接调用 run(['create', appType, formUuid, flowName, ...])（向后兼容历史测试）
  const arg0 = args[0];

  if (!arg0 || arg0 === '--help' || arg0 === '-h') {
    warn(t('integration.create_usage'));
    warn('');
    warn(t('integration.create_args_title'));
    warn(t('integration.create_arg_app_type'));
    warn(t('integration.create_arg_form_uuid'));
    warn(t('integration.create_arg_flow_name'));
    warn('');
    warn(t('integration.create_options_title'));
    warn(t('integration.create_opt_process_code'));
    warn(t('integration.create_opt_receivers'));
    warn(t('integration.create_opt_title'));
    warn(t('integration.create_opt_content'));
    warn(t('integration.create_opt_events'));
    warn(t('integration.create_opt_spec'));
    warn(t('integration.create_opt_data_form_uuid'));
    warn(t('integration.create_opt_data_condition'));
    warn(t('integration.create_opt_get_self'));
    warn(t('integration.create_opt_get_self_field'));
    warn(t('integration.create_opt_get_self_query_field'));
    warn(t('integration.create_opt_add_data_form_uuid'));
    warn(t('integration.create_opt_add_data_assignment'));
    warn(t('integration.create_opt_initiate_approval_form_uuid'));
    warn(t('integration.create_opt_initiate_approval_initiator_user'));
    warn(t('integration.create_opt_initiate_approval_assignment'));
    warn(t('integration.create_opt_connector_mode'));
    warn(t('integration.create_opt_connection_id'));
    warn(t('integration.create_opt_connector_display_name'));
    warn(t('integration.create_opt_publish'));
    warn('');
    warn(t('integration.create_examples_title'));
    warn(t('integration.create_example1'));
    warn(t('integration.create_example2'));
    process.exit(0);
  }

  // 兼容历史调用：首参数为 'create' 时跳过
  const subArgs = arg0 === 'create' ? args.slice(1) : args;
  const appType = subArgs[0];
  const formUuid = subArgs[1];
  const flowName = subArgs[2];

  if (!appType || !formUuid || !flowName) {
    warn(t('integration.create_missing_args'));
    warn(t('integration.create_usage'));
    process.exit(1);
  }

  // 解析可选参数
  const processCodeInput = parseFlag(subArgs, '--process-code');
  const receiversRaw = parseFlag(subArgs, '--receivers') || '';
  const userFieldsRaw = parseFlag(subArgs, '--user-fields') || '';
  const notificationTitle = parseFlag(subArgs, '--title') || flowName;
  const notificationContent = parseFlag(subArgs, '--content') || '表单有新记录提交，请及时查看。';
  const eventsRaw = parseFlag(subArgs, '--events') || 'insert';
  const approvalActionsRaw = parseFlag(subArgs, '--approval-actions') || '';
  const approvalNodeIdsRaw = parseFlag(subArgs, '--approval-node-ids') || '';
  const specPath = parseFlag(subArgs, '--spec');
  const triggerRecursively = hasFlag(subArgs, '--trigger-recursively');
  const getSelf = hasFlag(subArgs, '--get-self');
  const getSelfTriggerField = parseFlag(subArgs, '--get-self-field')
    || parseFlag(subArgs, '--get-self-trigger-field')
    || '__masterdata_form_inst_id';
  const getSelfQueryField = parseFlag(subArgs, '--get-self-query-field') || 'pid';
  const shouldPublish = hasFlag(subArgs, '--publish');
  let integrationSpec = null;
  if (specPath) {
    try {
      integrationSpec = readIntegrationSpec(specPath);
    } catch (error) {
      warn(`读取 --spec 失败：${error.message}`);
      process.exit(1);
    }
  }

  const receiverUserIds = receiversRaw
    ? receiversRaw.split(',').map((id) => id.trim()).filter(Boolean)
    : [];
  const toUsers = receiverUserIds.map((userId) => ({ userId, userName: '' }));
  const userFields = userFieldsRaw
    ? userFieldsRaw.split(',').map((id) => id.trim()).filter(Boolean)
    : [];

  const formEventTypes = mapEventTypes(
    eventsRaw.split(',').map((event) => event.trim()).filter(Boolean)
  );
  const approvalActions = approvalActionsRaw
    ? approvalActionsRaw.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  const approvalNodeIds = approvalNodeIdsRaw
    ? approvalNodeIdsRaw.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  if (formEventTypes.length === 0) {
    warn(t('integration.create_invalid_events'));
    process.exit(1);
  }

  if (integrationSpec) {
    try {
      validateIntegrationSpec(integrationSpec, formEventTypes);
    } catch (error) {
      warn(`读取 --spec 失败：${error.message}`);
      process.exit(1);
    }
  }

  if (formEventTypes.includes('processFinish') && approvalActions.length === 0) {
    warn('审批事件触发时必须传入 --approval-actions agree,disagree,terminated 中的至少一项');
    process.exit(1);
  }

  if (formEventTypes.includes('activityTask') && approvalActions.length === 0) {
    warn('审批节点事件触发时必须传入 --approval-actions agree,disagree,terminated 中的至少一项');
    process.exit(1);
  }

  if (formEventTypes.includes('activityTask') && approvalNodeIds.length === 0) {
    warn('审批节点事件触发时必须传入 --approval-node-ids node_xxx[,node_yyy]');
    process.exit(1);
  }

  if (receiverUserIds.length === 0) {
    warn(t('integration.create_no_receivers'));
  }

  // 解析获取单条数据节点参数
  const dataFormUuid = getSelf ? formUuid : (parseFlag(subArgs, '--data-form-uuid') || null);

  // --data-condition 支持多次传入，格式：bFieldId:bFieldName:aFieldId[:componentType[:opCode[:valueType]]]
  const dataConditions = [];
  if (getSelf) {
    dataConditions.push({
      bFieldId: getSelfQueryField,
      bFieldName: '表单实例ID',
      aFieldId: getSelfTriggerField,
      componentType: 'TextField',
      opCode: 'Equal',
      valueType: 'processVar',
    });
  }
  for (let index = 0; index < subArgs.length; index++) {
    if (subArgs[index] === '--data-condition' && subArgs[index + 1]) {
      const parts = subArgs[index + 1].split(':');
      if (parts.length >= 3) {
        dataConditions.push({
          bFieldId: parts[0],
          bFieldName: parts[1],
          aFieldId: parts[2],
          componentType: parts[3] || 'TextField',
          opCode: parts[4] || 'Contain',
          valueType: parts[5] || 'processVar',
        });
      }
      index++;
    }
  }

  // --trigger-condition 支持多次传入，格式：fieldId:fieldName:opCode:value[:componentType[:valueType]]
  const triggerConditions = [];
  for (let index = 0; index < subArgs.length; index++) {
    if (subArgs[index] === '--trigger-condition' && subArgs[index + 1]) {
      const parts = subArgs[index + 1].split(':');
      if (parts.length >= 4) {
        triggerConditions.push({
          fieldId: parts[0],
          fieldName: parts[1],
          opCode: parts[2],
          value: parts[3],
          componentType: parts[4] || 'TextField',
          valueType: parts[5] || 'literal',
        });
      }
      index++;
    }
  }

  // 解析新增数据节点参数
  const addDataFormUuid = parseFlag(subArgs, '--add-data-form-uuid') || null;

  // --add-data-assignment 支持多次传入，格式：目标字段ID:valueType:value
  // valueType 可选：processVar（引用触发表单字段）、literal（固定值）、column（公式）
  const addDataAssignments = parseAssignments(subArgs, '--add-data-assignment');

  const initiateApprovalFormUuid = parseFlag(subArgs, '--initiate-approval-form-uuid') || null;
  const initiateApprovalInitiator = buildSelectUserInitiator(
    parseFlag(subArgs, '--initiate-approval-initiator-user') || ''
  );
  const initiateApprovalAssignments = parseAssignments(subArgs, '--initiate-approval-assignment');

  if (initiateApprovalFormUuid && !initiateApprovalInitiator) {
    warn('发起审批节点必须提供 --initiate-approval-initiator-user userId[:name]，用于指定流程发起人。');
    process.exit(1);
  }

  // 解析连接器调用节点参数（可选）
  // --connector-id G-CONN-xxx：连接器 ID
  // --action-id    G-ACT-xxx ：动作 ID
  // --connector-name <str>    ：连接器中文名（画布显示用，缺省"连接器"）
  // --connector-icon <url>    ：连接器图标 URL（缺省空）
  // --connector-inputs <path> ：完整入参 schema JSON 文件路径（可选，缺省空数组）
  // --connector-assignment column:valueType:value（可多次）
  //    valueType：processVar（引用触发表单字段 ID 或系统变量如 form_inst_modifier）/ literal（字面量）
  const connectorIdArg = parseFlag(subArgs, '--connector-id') || null;
  const actionIdArg = parseFlag(subArgs, '--action-id') || null;
  const connectorNameArg = parseFlag(subArgs, '--connector-name') || '';
  const connectorDisplayNameArg = parseFlag(subArgs, '--connector-display-name') || connectorNameArg;
  const connectorModeArg = resolveConnectorMode(connectorIdArg, parseFlag(subArgs, '--connector-mode') || '');
  const connectionIdArg = parseFlag(subArgs, '--connection-id')
    || parseFlag(subArgs, '--connector-connection-id')
    || '';
  const connectorIconArg = parseFlag(subArgs, '--connector-icon') || '';
  const connectorInputsPath = parseFlag(subArgs, '--connector-inputs') || null;

  let connectorInputsJson = [];
  if (connectorInputsPath) {
    try {
      const fs = require('fs');
      const raw = fs.readFileSync(connectorInputsPath, 'utf8');
      const parsed = JSON.parse(raw);
      connectorInputsJson = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      warn(`读取 --connector-inputs 文件失败：${err.message}，降级为空 inputs`);
      connectorInputsJson = [];
    }
  }

  const connectorAssignments = [];
  for (let index = 0; index < subArgs.length; index++) {
    if (subArgs[index] === '--connector-assignment' && subArgs[index + 1]) {
      const colonIndex = subArgs[index + 1].indexOf(':');
      const secondColonIndex = subArgs[index + 1].indexOf(':', colonIndex + 1);
      if (colonIndex !== -1 && secondColonIndex !== -1) {
        const column = subArgs[index + 1].slice(0, colonIndex);
        const valueType = subArgs[index + 1].slice(colonIndex + 1, secondColonIndex);
        const value = subArgs[index + 1].slice(secondColonIndex + 1);
        connectorAssignments.push({ column, valueType, value });
      }
      index++;
    }
  }

  const hasConnectorCallNode = Boolean(connectorIdArg && actionIdArg);
  if ((connectorIdArg && !actionIdArg) || (!connectorIdArg && actionIdArg)) {
    warn('⚠️  --connector-id 与 --action-id 必须同时提供，已忽略连接器调用节点');
  }
  if (hasConnectorCallNode && String(connectorIdArg).startsWith('Http_') && connectorModeArg !== 5) {
    warn('⚠️  connectorId 以 Http_ 开头，但 connectorMode 不是 5，右侧配置面板可能无法加载 HTTP 连接器详情');
  }
  if (hasConnectorCallNode && connectorModeArg === 5 && !connectionIdArg) {
    warn('⚠️  HTTP 连接器建议提供 --connection-id，否则右侧配置面板可能无法加载连接实例详情');
  }

  // 消息通知节点可选：receivers 或 user-fields 任一有值时生成
  const hasMessageNode = receiverUserIds.length > 0 || userFields.length > 0;

  // 生成节点 ID（顺序：canvasId, triggerNodeId, [dataNodeId], [addDataNodeId], [connectorCallNodeId], [messageNodeId], endNodeId）
  const canvasId = generateNodeId();
  const triggerNodeId = generateNodeId();
  const dataNodeId = dataFormUuid ? generateNodeId() : null;
  const addDataNodeId = addDataFormUuid ? generateNodeId() : null;
  const initiateApprovalNodeId = initiateApprovalFormUuid ? generateNodeId() : null;
  const connectorCallNodeId = hasConnectorCallNode ? generateNodeId() : null;
  const messageNodeId = hasMessageNode ? generateNodeId() : null;
  const endNodeId = generateNodeId();

  const SEP = '='.repeat(50);
  warn(SEP);
  warn(t('integration.create_title'));
  warn(SEP);
  warn(t('integration.create_app_type', appType));
  warn(t('integration.create_form_uuid', formUuid));
  warn(t('integration.create_flow_name', flowName));
  warn(processCodeInput ? t('integration.create_mode_update') : t('integration.create_mode_new'));
  if (processCodeInput) {
    warn(t('integration.create_process_code', processCodeInput));
  }
  warn(t('integration.create_events', formEventTypes.join(', ')));
  if (approvalActions.length > 0) {
    warn(`审批动作: ${approvalActions.join(', ')}`);
  }
  if (approvalNodeIds.length > 0) {
    warn(`审批节点: ${approvalNodeIds.join(', ')}`);
  }
  if (triggerRecursively) {
    warn('允许自动触发: true');
  }
  if (triggerConditions.length > 0) {
    warn(`触发过滤条件: ${triggerConditions.length}`);
  }
  if (integrationSpec) {
    const specNodes = Array.isArray(integrationSpec.nodes || integrationSpec.flow || integrationSpec.steps)
      ? (integrationSpec.nodes || integrationSpec.flow || integrationSpec.steps).length
      : 0;
    warn(`结构化编排: ${specPath} (${specNodes} 个顶层节点)`);
  }
  warn(t('integration.create_receivers', receiverUserIds.length > 0 ? receiverUserIds.join(', ') : t('integration.create_receivers_empty')));
  warn(t('integration.create_notify_title', notificationTitle));
  warn(t('integration.create_notify_content', notificationContent));
  if (dataFormUuid) {
    warn(t('integration.create_data_form', dataFormUuid));
    warn(t('integration.create_data_conditions', String(dataConditions.length)));
    if (getSelf) {
      warn(t('integration.create_get_self_summary', getSelfQueryField, getSelfTriggerField));
    }
  }
  if (initiateApprovalFormUuid) {
    warn(`发起审批目标表单: ${initiateApprovalFormUuid}`);
    warn(`发起审批字段赋值: ${initiateApprovalAssignments.length}`);
  }
  warn(shouldPublish ? t('integration.create_op_mode_publish') : t('integration.create_op_mode_draft'));

  // Step 1: 读取登录态
  // 动态计算总步骤数：登录(1) + 新建flow(可选,1) + 获取目标表单Schema(可选,1) + 保存/发布(1)
  let totalSteps = 1; // 登录
  if (!processCodeInput) {
    totalSteps++;
  } // 新建 logicflow
  if (addDataFormUuid) {
    totalSteps++;
  } // 获取目标表单 Schema
  const specAddDataFormUuids = integrationSpec
    ? collectAddDataFormUuids(integrationSpec).filter((uuid) => uuid !== addDataFormUuid)
    : [];
  totalSteps += specAddDataFormUuids.length;
  totalSteps++;                         // 保存/发布
  if (shouldPublish) {
    totalSteps++;
  }
  let currentStep = 0;
  const step = (label) => {
    currentStep++;
    warn(t('integration.create_step', String(currentStep), String(totalSteps), label));
  };

  step(t('integration.create_step_login'));
  let authData = loadAuthData();
  if (!authData) {
    warn(t('integration.create_no_cache'));
    authData = await triggerLogin();
  }

  const authRef = {
    baseUrl: resolveBaseUrl(authData),
    authData,
    authMode: authData.auth_mode || '',
    authSource: authData.auth_source || '',
    corpId: authData.corp_id || '',
    userId: authData.user_id || '',
  };
  warn(t('integration.create_login_ok', authRef.baseUrl));

  let formNavigationItemsPromise = null;
  const getFormNavigationItems = () => {
    if (!formNavigationItemsPromise) {
      formNavigationItemsPromise = fetchFormPageList(appType, authRef).catch((error) => {
        formNavigationItemsPromise = null;
        throw error;
      });
    }
    return formNavigationItemsPromise;
  };

  let addDataTargetForm = null;
  if (addDataFormUuid) {
    try {
      addDataTargetForm = await findFormNavigationItem(authRef, appType, addDataFormUuid.toString(), getFormNavigationItems);
    } catch (error) {
      warn(`获取目标表单信息失败，继续按普通表单处理: ${error.message}`);
    }
    if (normalizeFormType(addDataTargetForm && addDataTargetForm.formType) === 'process') {
      const errorMessage = buildProcessAddDataTargetError(addDataTargetForm, addDataFormUuid.toString());
      warn(errorMessage);
      warn(SEP);
      console.log(JSON.stringify({
        success: false,
        code: 'ADD_DATA_TARGET_IS_PROCESS_FORM',
        error: errorMessage,
        appType,
        formUuid,
        targetFormUuid: addDataFormUuid.toString(),
        targetFormType: addDataTargetForm.formType,
      }));
      process.exit(1);
    }
  }

  // Step 2（新建模式）：调用 createLogicflow 接口新建绑定关系，获取真实 processCode
  let initiateApprovalTargetForm = null;
  if (initiateApprovalFormUuid) {
    try {
      initiateApprovalTargetForm = await findFormNavigationItem(authRef, appType, initiateApprovalFormUuid.toString(), getFormNavigationItems);
    } catch (error) {
      warn(`获取发起审批目标表单信息失败: ${error.message}`);
    }
    if (normalizeFormType(initiateApprovalTargetForm && initiateApprovalTargetForm.formType) !== 'process') {
      const errorMessage = buildInitiateApprovalTargetError(initiateApprovalTargetForm, initiateApprovalFormUuid.toString());
      warn(errorMessage);
      warn(SEP);
      console.log(JSON.stringify({
        success: false,
        code: 'INITIATE_APPROVAL_TARGET_NOT_PROCESS_FORM',
        error: errorMessage,
        appType,
        formUuid,
        targetFormUuid: initiateApprovalFormUuid.toString(),
        targetFormType: initiateApprovalTargetForm ? initiateApprovalTargetForm.formType : '',
      }));
      process.exit(1);
    }
  }

  let processCode = processCodeInput;
  if (!processCode) {
    step(t('integration.create_step_new_flow'));
    try {
      processCode = await createLogicflow(authRef, { appType, formUuid, flowName });
      warn(t('integration.create_new_flow_ok', processCode));
    } catch (error) {
      warn(t('integration.create_new_flow_failed', error.message));
      warn(SEP);
      console.log(JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    }
  }

  // 构建节点 ID 列表（顺序：trigger, [dataRetrieve], [addData], [connectorCall], [message], end）
  const processNodeIds = [triggerNodeId];
  if (dataNodeId) {
    processNodeIds.push(dataNodeId);
  }
  if (addDataNodeId) {
    processNodeIds.push(addDataNodeId);
  }
  if (initiateApprovalNodeId) {
    processNodeIds.push(initiateApprovalNodeId);
  }
  if (connectorCallNodeId) {
    processNodeIds.push(connectorCallNodeId);
  }
  if (messageNodeId) {
    processNodeIds.push(messageNodeId);
  }
  processNodeIds.push(endNodeId);

  // viewJson 节点 ID 列表（canvasId 开头）
  const viewNodeIds = [canvasId, triggerNodeId];
  if (dataNodeId) {
    viewNodeIds.push(dataNodeId);
  }
  if (addDataNodeId) {
    viewNodeIds.push(addDataNodeId);
  }
  if (initiateApprovalNodeId) {
    viewNodeIds.push(initiateApprovalNodeId);
  }
  if (connectorCallNodeId) {
    viewNodeIds.push(connectorCallNodeId);
  }
  if (messageNodeId) {
    viewNodeIds.push(messageNodeId);
  }
  viewNodeIds.push(endNodeId);

  // 若有新增数据节点，获取目标表单 Schema（用于 viewJson 中的 inputs/rules 字段）
  let addDataFormSchema = [];
  const formSchemasByUuid = new Map();
  if (addDataFormUuid) {
    try {
      warn(t('integration.create_step_get_schema'));
      addDataFormSchema = await getFormSchema(authRef, { appType, formUuid: addDataFormUuid.toString() });
      formSchemasByUuid.set(addDataFormUuid.toString(), addDataFormSchema);
      warn(t('integration.create_get_schema_ok', String(addDataFormSchema.length)));
    } catch (error) {
      warn(t('integration.create_get_schema_warn', error.message));
    }
  }
  for (const specFormUuid of specAddDataFormUuids) {
    try {
      step(`获取 ${specFormUuid} 表单 Schema`);
      const schema = await getFormSchema(authRef, { appType, formUuid: specFormUuid.toString() });
      formSchemasByUuid.set(specFormUuid.toString(), schema);
      warn(t('integration.create_get_schema_ok', String(schema.length)));
    } catch (error) {
      warn(t('integration.create_get_schema_warn', error.message));
    }
  }

  // 构建 json 和 viewJson 参数
  let processJson;
  let viewJson;
  let outputFormEventTypes = formEventTypes;
  let specNodeIdMap = null;

  if (integrationSpec) {
    const built = buildSpecProcessAndViewJson({
      spec: integrationSpec,
      processCode,
      formUuid,
      appType,
      flowName,
      formEventTypes,
      notificationTitle,
      notificationContent,
      toUsers,
      userFields,
      formSchemasByUuid,
    });
    processJson = built.processJson;
    viewJson = built.viewJson;
    outputFormEventTypes = built.formEventTypes;
    specNodeIdMap = built.nodeIdMap;
  } else {
    processJson = buildProcessJson({
      processCode,
      formUuid,
      appType,
      formEventTypes,
      notificationTitle,
      notificationContent,
      toUsers,
      userFields,
      nodeIds: processNodeIds,
      addDataFormUuid: addDataFormUuid ?? undefined,
      addDataAssignments,
      initiateApprovalFormUuid: initiateApprovalFormUuid ?? undefined,
      initiateApprovalFormName: initiateApprovalTargetForm ? initiateApprovalTargetForm.formName : '',
      initiateApprovalInitiator,
      initiateApprovalAssignments,
      dataFormUuid: dataFormUuid ?? undefined,
      dataConditions,
      hasMessageNode,
      approvalActions,
      approvalNodeIds,
      triggerRecursively,
      triggerConditions,
      connectorId: connectorIdArg,
      actionId: actionIdArg,
      connectorAssignments,
      connectorDescription: connectorNameArg || undefined,
      connectorMode: connectorModeArg,
      connectionId: connectionIdArg,
    });

    viewJson = buildViewJson({
      processCode,
      formUuid,
      formEventTypes,
      notificationTitle,
      notificationContent,
      toUsers,
      userFields,
      appType,
      nodeIds: viewNodeIds,
      addDataFormUuid: addDataFormUuid ?? undefined,
      addDataAssignments,
      addDataFormSchema,
      addDataFormName: addDataTargetForm ? addDataTargetForm.formName : '',
      initiateApprovalFormUuid: initiateApprovalFormUuid ?? undefined,
      initiateApprovalFormName: initiateApprovalTargetForm ? initiateApprovalTargetForm.formName : '',
      initiateApprovalInitiator,
      initiateApprovalAssignments,
      dataFormUuid: dataFormUuid ?? undefined,
      dataConditions,
      hasMessageNode,
      approvalActions,
      approvalNodeIds,
      triggerRecursively,
      triggerConditions,
      connectorId: connectorIdArg,
      actionId: actionIdArg,
      connectorAssignments,
      connectorName: connectorNameArg,
      connectorDisplayName: connectorDisplayNameArg,
      connectorIcon: connectorIconArg,
      connectorInputs: connectorInputsJson,
      connectorMode: connectorModeArg,
      connectionId: connectionIdArg,
    });
  }

  // 保存逻辑流（草稿）
  step(t('integration.create_step_save'));
  const saveResponse = await saveProcess(authRef, {
    appType,
    formUuid,
    processCode,
    processJson,
    viewJson,
    isOnline: false,
  });

  if (!saveResponse || !saveResponse.success) {
    const errorMsg = saveResponse
      ? saveResponse.errorMsg || JSON.stringify(saveResponse)
      : '请求失败';
    warn(t('integration.create_save_failed', errorMsg));
    warn(SEP);
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    process.exit(1);
  }
  warn(t('integration.create_save_ok'));

  // 发布逻辑流（可选）
  if (shouldPublish) {
    step(t('integration.create_step_publish'));
    const publishResponse = await saveProcess(authRef, {
      appType,
      formUuid,
      processCode,
      processJson,
      viewJson,
      isOnline: true,
    });

    if (!publishResponse || !publishResponse.success) {
      const errorMsg = publishResponse
        ? publishResponse.errorMsg || JSON.stringify(publishResponse)
        : '请求失败';
      warn(t('integration.create_publish_warn', errorMsg));
      warn(t('integration.create_publish_draft_hint'));
      warn(SEP);
      console.log(JSON.stringify({
        success: true,
        published: false,
        processCode,
        flowName,
        appType,
        formUuid,
        warning: `发布失败：${errorMsg}，已保存为草稿`,
      }));
      return;
    }

    warn(t('integration.create_published_ok'));
    warn('\n' + SEP);
    warn(t('integration.create_done_published'));
    warn(t('integration.create_process_code', processCode));
    warn(t('integration.create_flow_name', flowName));
    warn(SEP);
    console.log(JSON.stringify({
      success: true,
      published: true,
      processCode,
      flowName,
      appType,
      formUuid,
      formEventTypes: outputFormEventTypes,
      specNodeIdMap,
    }));
    return;
  }

  // 仅保存草稿的输出
  warn('\n' + SEP);
  warn(t('integration.create_done_draft'));
  warn(t('integration.create_process_code', processCode));
  warn(t('integration.create_flow_name', flowName));
  warn(t('integration.create_draft_hint'));
  warn(SEP);
  console.log(JSON.stringify({
    success: true,
    published: false,
    processCode,
    flowName,
    appType,
    formUuid,
    formEventTypes: outputFormEventTypes,
    specNodeIdMap,
  }));
}

module.exports = { run };
