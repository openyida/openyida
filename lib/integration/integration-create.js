'use strict';

const { loadCookieData, triggerLogin, resolveBaseUrl } = require('../core/utils');
const { generateNodeId } = require('./integration-node-ids');
const { getFormSchema, createLogicflow, saveProcess } = require('./integration-api');
const { mapEventTypes, buildProcessJson } = require('./integration-process-builder');
const { buildViewJson } = require('./integration-view-builder');
const { t } = require('../core/i18n');
const { banner, step, label, success, fail, warn, info, error, result, hint, listItem, usage } = require('../core/chalk');

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

// ── 主入口 ────────────────────────────────────────────

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
    warn(t('integration.create_opt_data_form_uuid'));
    warn(t('integration.create_opt_data_condition'));
    warn(t('integration.create_opt_add_data_form_uuid'));
    warn(t('integration.create_opt_add_data_assignment'));
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
  const shouldPublish = hasFlag(subArgs, '--publish');

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

  if (formEventTypes.length === 0) {
    warn(t('integration.create_invalid_events'));
    process.exit(1);
  }

  if (receiverUserIds.length === 0) {
    warn(t('integration.create_no_receivers'));
  }

  // 解析获取单条数据节点参数
  const dataFormUuid = parseFlag(subArgs, '--data-form-uuid') || null;

  // --data-condition 支持多次传入，格式：bFieldId:bFieldName:aFieldId[:componentType]
  const dataConditions = [];
  for (let index = 0; index < subArgs.length; index++) {
    if (subArgs[index] === '--data-condition' && subArgs[index + 1]) {
      const parts = subArgs[index + 1].split(':');
      if (parts.length >= 3) {
        dataConditions.push({
          bFieldId: parts[0],
          bFieldName: parts[1],
          aFieldId: parts[2],
          componentType: parts[3] || 'TextField',
        });
      }
      index++;
    }
  }

  // 解析新增数据节点参数
  const addDataFormUuid = parseFlag(subArgs, '--add-data-form-uuid') || null;

  // --add-data-assignment 支持多次传入，格式：目标字段ID:valueType:value
  // valueType 可选：processVar（引用触发表单字段）、literal（固定值）、column（公式）
  const addDataAssignments = [];
  for (let index = 0; index < subArgs.length; index++) {
    if (subArgs[index] === '--add-data-assignment' && subArgs[index + 1]) {
      const colonIndex = subArgs[index + 1].indexOf(':');
      const secondColonIndex = subArgs[index + 1].indexOf(':', colonIndex + 1);
      if (colonIndex !== -1 && secondColonIndex !== -1) {
        const column = subArgs[index + 1].slice(0, colonIndex);
        const valueType = subArgs[index + 1].slice(colonIndex + 1, secondColonIndex);
        const value = subArgs[index + 1].slice(secondColonIndex + 1);
        addDataAssignments.push({ column, valueType, value });
      }
      index++;
    }
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

  // 消息通知节点可选：receivers 或 user-fields 任一有值时生成
  const hasMessageNode = receiverUserIds.length > 0 || userFields.length > 0;

  // 生成节点 ID（顺序：canvasId, triggerNodeId, [addDataNodeId], [dataNodeId], [connectorCallNodeId], [messageNodeId], endNodeId）
  const canvasId = generateNodeId();
  const triggerNodeId = generateNodeId();
  const addDataNodeId = addDataFormUuid ? generateNodeId() : null;
  const dataNodeId = dataFormUuid ? generateNodeId() : null;
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
  warn(t('integration.create_receivers', receiverUserIds.length > 0 ? receiverUserIds.join(', ') : t('integration.create_receivers_empty')));
  warn(t('integration.create_notify_title', notificationTitle));
  warn(t('integration.create_notify_content', notificationContent));
  if (dataFormUuid) {
    warn(t('integration.create_data_form', dataFormUuid));
    warn(t('integration.create_data_conditions', String(dataConditions.length)));
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
  totalSteps++;                         // 保存/发布
  let currentStep = 0;
  const step = (label) => {
    currentStep++;
    warn(t('integration.create_step', String(currentStep), String(totalSteps), label));
  };

  step(t('integration.create_step_login'));
  let cookieData = loadCookieData();
  if (!cookieData) {
    warn(t('integration.create_no_cache'));
    cookieData = await triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  warn(t('integration.create_login_ok', authRef.baseUrl));

  // Step 2（新建模式）：调用 createLogicflow 接口新建绑定关系，获取真实 processCode
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

  // 构建节点 ID 列表（顺序：trigger, [addData], [dataRetrieve], [connectorCall], [message], end）
  const processNodeIds = [triggerNodeId];
  if (addDataNodeId) {
    processNodeIds.push(addDataNodeId);
  }
  if (dataNodeId) {
    processNodeIds.push(dataNodeId);
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
  if (addDataNodeId) {
    viewNodeIds.push(addDataNodeId);
  }
  if (dataNodeId) {
    viewNodeIds.push(dataNodeId);
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
  if (addDataFormUuid) {
    try {
      warn(t('integration.create_step_get_schema'));
      addDataFormSchema = await getFormSchema(authRef, { appType, formUuid: addDataFormUuid.toString() });
      warn(t('integration.create_get_schema_ok', String(addDataFormSchema.length)));
    } catch (error) {
      warn(t('integration.create_get_schema_warn', error.message));
    }
  }

  // 构建 json 和 viewJson 参数
  const processJson = buildProcessJson({
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
    dataFormUuid: dataFormUuid ?? undefined,
    dataConditions,
    hasMessageNode,
    connectorId: connectorIdArg,
    actionId: actionIdArg,
    connectorAssignments,
    connectorDescription: connectorNameArg || undefined,
  });

  const viewJson = buildViewJson({
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
    addDataFormName: '',
    dataFormUuid: dataFormUuid ?? undefined,
    dataConditions,
    hasMessageNode,
    connectorId: connectorIdArg,
    actionId: actionIdArg,
    connectorAssignments,
    connectorName: connectorNameArg,
    connectorIcon: connectorIconArg,
    connectorInputs: connectorInputsJson,
  });

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
      formEventTypes,
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
    formEventTypes,
  }));
}

module.exports = { run };
