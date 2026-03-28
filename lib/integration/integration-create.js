'use strict';

const { loadCookieData, triggerLogin, resolveBaseUrl } = require('../core/utils');
const { generateNodeId } = require('./integration-node-ids');
const { getFormSchema, createLogicflow, saveProcess } = require('./integration-api');
const { mapEventTypes, buildProcessJson } = require('./integration-process-builder');
const { buildViewJson } = require('./integration-view-builder');
const { t } = require('../core/i18n');

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
  const subCommand = args[0];

  if (!subCommand || subCommand === '--help' || subCommand === '-h') {
    console.error(t('integration.create_usage'));
    console.error('');
    console.error(t('integration.create_args_title'));
    console.error(t('integration.create_arg_app_type'));
    console.error(t('integration.create_arg_form_uuid'));
    console.error(t('integration.create_arg_flow_name'));
    console.error('');
    console.error(t('integration.create_options_title'));
    console.error(t('integration.create_opt_process_code'));
    console.error(t('integration.create_opt_receivers'));
    console.error(t('integration.create_opt_title'));
    console.error(t('integration.create_opt_content'));
    console.error(t('integration.create_opt_events'));
    console.error(t('integration.create_opt_data_form_uuid'));
    console.error(t('integration.create_opt_data_condition'));
    console.error(t('integration.create_opt_add_data_form_uuid'));
    console.error(t('integration.create_opt_add_data_assignment'));
    console.error(t('integration.create_opt_publish'));
    console.error('');
    console.error(t('integration.create_examples_title'));
    console.error(t('integration.create_example1'));
    console.error(t('integration.create_example2'));
    process.exit(0);
  }

  if (subCommand !== 'create') {
    console.error(t('integration.create_unknown_sub', subCommand));
    console.error(t('integration.create_usage'));
    process.exit(1);
  }

  const subArgs = args.slice(1);
  const appType = subArgs[0];
  const formUuid = subArgs[1];
  const flowName = subArgs[2];

  if (!appType || !formUuid || !flowName) {
    console.error(t('integration.create_missing_args'));
    console.error(t('integration.create_usage'));
    process.exit(1);
  }

  // 解析可选参数
  const processCodeInput = parseFlag(subArgs, '--process-code');
  const receiversRaw = parseFlag(subArgs, '--receivers') || '';
  const notificationTitle = parseFlag(subArgs, '--title') || flowName;
  const notificationContent = parseFlag(subArgs, '--content') || '表单有新记录提交，请及时查看。';
  const eventsRaw = parseFlag(subArgs, '--events') || 'insert';
  const shouldPublish = hasFlag(subArgs, '--publish');

  const receiverUserIds = receiversRaw
    ? receiversRaw.split(',').map((id) => id.trim()).filter(Boolean)
    : [];
  const toUsers = receiverUserIds.map((userId) => ({ userId, userName: '' }));

  const formEventTypes = mapEventTypes(
    eventsRaw.split(',').map((event) => event.trim()).filter(Boolean)
  );

  if (formEventTypes.length === 0) {
    console.error(t('integration.create_invalid_events'));
    process.exit(1);
  }

  if (receiverUserIds.length === 0) {
    console.error(t('integration.create_no_receivers'));
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

  // 消息通知节点可选：无 receivers 时跳过
  const hasMessageNode = receiverUserIds.length > 0;

  // 生成节点 ID（顺序：canvasId, triggerNodeId, [addDataNodeId], [dataNodeId], [messageNodeId], endNodeId）
  const canvasId = generateNodeId();
  const triggerNodeId = generateNodeId();
  const addDataNodeId = addDataFormUuid ? generateNodeId() : null;
  const dataNodeId = dataFormUuid ? generateNodeId() : null;
  const messageNodeId = hasMessageNode ? generateNodeId() : null;
  const endNodeId = generateNodeId();

  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error(t('integration.create_title'));
  console.error(SEP);
  console.error(t('integration.create_app_type', appType));
  console.error(t('integration.create_form_uuid', formUuid));
  console.error(t('integration.create_flow_name', flowName));
  console.error(processCodeInput ? t('integration.create_mode_update') : t('integration.create_mode_new'));
  if (processCodeInput) {
    console.error(t('integration.create_process_code', processCodeInput));
  }
  console.error(t('integration.create_events', formEventTypes.join(', ')));
  console.error(t('integration.create_receivers', receiverUserIds.length > 0 ? receiverUserIds.join(', ') : t('integration.create_receivers_empty')));
  console.error(t('integration.create_notify_title', notificationTitle));
  console.error(t('integration.create_notify_content', notificationContent));
  if (dataFormUuid) {
    console.error(t('integration.create_data_form', dataFormUuid));
    console.error(t('integration.create_data_conditions', String(dataConditions.length)));
  }
  console.error(shouldPublish ? t('integration.create_op_mode_publish') : t('integration.create_op_mode_draft'));

  // Step 1: 读取登录态
  // 动态计算总步骤数：登录(1) + 新建flow(可选,1) + 获取目标表单Schema(可选,1) + 保存/发布(1)
  let totalSteps = 1; // 登录
  if (!processCodeInput) totalSteps++; // 新建 logicflow
  if (addDataFormUuid) totalSteps++;   // 获取目标表单 Schema
  totalSteps++;                         // 保存/发布
  let currentStep = 0;
  const step = (label) => {
    currentStep++;
    console.error(t('integration.create_step', String(currentStep), String(totalSteps), label));
  };

  step(t('integration.create_step_login'));
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error(t('integration.create_no_cache'));
    cookieData = await triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  console.error(t('integration.create_login_ok', authRef.baseUrl));

  // Step 2（新建模式）：调用 createLogicflow 接口新建绑定关系，获取真实 processCode
  let processCode = processCodeInput;
  if (!processCode) {
    step(t('integration.create_step_new_flow'));
    try {
      processCode = await createLogicflow(authRef, { appType, formUuid, flowName });
      console.error(t('integration.create_new_flow_ok', processCode));
    } catch (error) {
      console.error(t('integration.create_new_flow_failed', error.message));
      console.error(SEP);
      console.log(JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    }
  }

  // 构建节点 ID 列表（顺序：trigger, [addData], [dataRetrieve], [message], end）
  const processNodeIds = [triggerNodeId];
  if (addDataNodeId) {
    processNodeIds.push(addDataNodeId);
  }
  if (dataNodeId) {
    processNodeIds.push(dataNodeId);
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
  if (messageNodeId) {
    viewNodeIds.push(messageNodeId);
  }
  viewNodeIds.push(endNodeId);

  // 若有新增数据节点，获取目标表单 Schema（用于 viewJson 中的 inputs/rules 字段）
  let addDataFormSchema = [];
  if (addDataFormUuid) {
    try {
      console.error(t('integration.create_step_get_schema'));
      addDataFormSchema = await getFormSchema(authRef, { appType, formUuid: addDataFormUuid.toString() });
      console.error(t('integration.create_get_schema_ok', String(addDataFormSchema.length)));
    } catch (error) {
      console.error(t('integration.create_get_schema_warn', error.message));
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
    nodeIds: processNodeIds,
    addDataFormUuid: addDataFormUuid ?? undefined,
    addDataAssignments,
    dataFormUuid: dataFormUuid ?? undefined,
    dataConditions,
    hasMessageNode,
  });

  const viewJson = buildViewJson({
    formUuid,
    formEventTypes,
    notificationTitle,
    notificationContent,
    toUsers,
    appType,
    nodeIds: viewNodeIds,
    addDataFormUuid: addDataFormUuid ?? undefined,
    addDataAssignments,
    addDataFormSchema,
    addDataFormName: '',
    dataFormUuid: dataFormUuid ?? undefined,
    dataConditions,
    hasMessageNode,
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
    console.error(t('integration.create_save_failed', errorMsg));
    console.error(SEP);
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    process.exit(1);
  }
  console.error(t('integration.create_save_ok'));

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
      console.error(t('integration.create_publish_warn', errorMsg));
      console.error(t('integration.create_publish_draft_hint'));
      console.error(SEP);
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

    console.error(t('integration.create_published_ok'));
    console.error('\n' + SEP);
    console.error(t('integration.create_done_published'));
    console.error(t('integration.create_process_code', processCode));
    console.error(t('integration.create_flow_name', flowName));
    console.error(SEP);
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
  console.error('\n' + SEP);
  console.error(t('integration.create_done_draft'));
  console.error(t('integration.create_process_code', processCode));
  console.error(t('integration.create_flow_name', flowName));
  console.error(t('integration.create_draft_hint'));
  console.error(SEP);
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
