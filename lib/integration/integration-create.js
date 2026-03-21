'use strict';

/**
 * integration-create.js - 集成&自动化创建命令主入口
 *
 * 子命令：openyida integration create <appType> <formUuid> <flowName> [选项]
 *
 * 依赖模块：
 *   - integration-node-ids.js    ID 生成工具
 *   - integration-api.js         API 调用（getFormSchema / saveProcess / createLogicflow）
 *   - integration-process-builder.js  buildProcessJson（执行引擎节点定义）
 *   - integration-view-builder.js     buildViewJson（画布 Schema）
 */

const { loadCookieData, triggerLogin, resolveBaseUrl } = require('../core/utils');
const { generateNodeId } = require('./integration-node-ids');
const { getFormSchema, saveProcess, createLogicflow } = require('./integration-api');
const { mapEventTypes, buildProcessJson } = require('./integration-process-builder');
const { buildViewJson } = require('./integration-view-builder');

// ── 参数解析 ──────────────────────────────────────────

/**
 * 从 args 数组中解析命名参数（--key value 格式）
 * @param {string[]} args
 * @param {string} flagName - 如 '--receivers'
 * @returns {string|null}
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
 * @param {string[]} args
 * @param {string} flagName - 如 '--publish'
 * @returns {boolean}
 */
function hasFlag(args, flagName) {
  return args.includes(flagName);
}

// ── 主入口 ────────────────────────────────────────────

async function run(args) {
  const subCommand = args[0];

  if (!subCommand || subCommand === '--help' || subCommand === '-h') {
    console.error('用法: openyida integration create <appType> <formUuid> <flowName> [选项]');
    console.error('');
    console.error('参数:');
    console.error('  appType                                应用 ID，如 APP_XXXX');
    console.error('  formUuid                               触发表单 UUID，如 FORM-XXXX');
    console.error('  flowName                               逻辑流名称');
    console.error('');
    console.error('选项:');
    console.error('  --process-code <code>                  已有逻辑流的 processCode（LPROC-xxx），不传则自动新建');
    console.error('  --receivers <userId,...>               接收钉钉工作通知的用户 ID，多个用逗号分隔');
    console.error('  --title <title>                        通知标题，支持 #{fieldId-ComponentType}# 引用字段');
    console.error('  --content <content>                    通知内容，支持 #{fieldId-ComponentType}# 引用字段');
    console.error('  --events <insert,update,...>           触发事件，可选: insert/update/delete/comment，默认 insert');
    console.error('  --data-form-uuid <formUuid>            获取单条数据节点的目标表单 UUID');
    console.error('  --data-condition <b:bName:a[:type]>    获取单条数据的过滤条件，可多次传入');
    console.error('  --add-data-form-uuid <formUuid>        新增数据节点的目标表单 UUID');
    console.error('  --add-data-assignment <col:type:val>   新增数据字段赋值，可多次传入');
    console.error('  --publish                              保存后立即发布（开启），否则仅保存草稿');
    console.error('');
    console.error('示例:');
    console.error('  openyida integration create APP_XXX FORM-XXX "新增记录通知" \\');
    console.error('    --receivers user123 --title "有新记录提交" --content "请及时处理" --publish');
    process.exit(0);
  }

  if (subCommand !== 'create') {
    console.error(`未知的 integration 子命令: ${subCommand}`);
    console.error('用法: openyida integration create <appType> <formUuid> <flowName> [选项]');
    process.exit(1);
  }

  const subArgs = args.slice(1);
  const appType = subArgs[0];
  const formUuid = subArgs[1];
  const flowName = subArgs[2];

  if (!appType || !formUuid || !flowName) {
    console.error('错误：缺少必填参数 appType、formUuid 或 flowName');
    console.error('用法: openyida integration create <appType> <formUuid> <flowName> [选项]');
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
    console.error('错误：--events 参数无效，可选值为 insert / update / delete / comment（或 create）');
    process.exit(1);
  }

  if (receiverUserIds.length === 0) {
    console.error('警告：未指定 --receivers，通知接收人为空，流程将创建但无法发送通知');
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
  console.error('🔗 创建集成&自动化（逻辑流）');
  console.error(SEP);
  console.error(`  应用 ID：${appType}`);
  console.error(`  触发表单：${formUuid}`);
  console.error(`  流程名称：${flowName}`);
  console.error(`  模式：${processCodeInput ? '覆盖更新已有逻辑流' : '新建逻辑流'}`);
  if (processCodeInput) {
    console.error(`  processCode：${processCodeInput}`);
  }
  console.error(`  触发事件：${formEventTypes.join(', ')}`);
  console.error(`  通知接收人：${receiverUserIds.length > 0 ? receiverUserIds.join(', ') : '（未设置）'}`);
  console.error(`  通知标题：${notificationTitle}`);
  console.error(`  通知内容：${notificationContent}`);
  if (dataFormUuid) {
    console.error(`  获取单条数据表单：${dataFormUuid}`);
    console.error(`  过滤条件数量：${dataConditions.length}`);
  }
  console.error(`  操作模式：${shouldPublish ? '保存并发布' : '仅保存草稿'}`);

  // Step 1: 读取登录态
  const totalSteps = shouldPublish ? (processCodeInput ? 3 : 4) : (processCodeInput ? 2 : 3);
  let currentStep = 0;
  const step = (label) => {
    currentStep++;
    console.error(`\n[${currentStep}/${totalSteps}] ${label}`);
  };

  step('读取登录态...');
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error('  未找到登录缓存，触发登录...');
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  console.error(`  ✅ 登录态就绪，baseUrl: ${authRef.baseUrl}`);

  // Step 2（新建模式）：调用 createLogicflow 接口新建绑定关系，获取真实 processCode
  let processCode = processCodeInput;
  if (!processCode) {
    step('新建逻辑流绑定关系...');
    try {
      processCode = await createLogicflow(authRef, { appType, formUuid, flowName });
      console.error(`  ✅ 新建成功，processCode：${processCode}`);
    } catch (error) {
      console.error(`  ❌ ${error.message}`);
      console.error(SEP);
      console.log(JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    }
  }

  // 构建节点 ID 列表（顺序：trigger, [addData], [dataRetrieve], [message], end）
  const processNodeIds = [triggerNodeId];
  if (addDataNodeId) { processNodeIds.push(addDataNodeId); }
  if (dataNodeId) { processNodeIds.push(dataNodeId); }
  if (messageNodeId) { processNodeIds.push(messageNodeId); }
  processNodeIds.push(endNodeId);

  // viewJson 节点 ID 列表（canvasId 开头）
  const viewNodeIds = [canvasId, triggerNodeId];
  if (addDataNodeId) { viewNodeIds.push(addDataNodeId); }
  if (dataNodeId) { viewNodeIds.push(dataNodeId); }
  if (messageNodeId) { viewNodeIds.push(messageNodeId); }
  viewNodeIds.push(endNodeId);

  // 若有新增数据节点，获取目标表单 Schema（用于 viewJson 中的 inputs/rules 字段）
  let addDataFormSchema = [];
  const addDataFormName = '';
  if (addDataFormUuid) {
    try {
      console.error('  📋 获取目标表单 Schema...');
      addDataFormSchema = await getFormSchema(authRef, { appType, formUuid: addDataFormUuid });
      console.error(`  ✅ 获取到 ${addDataFormSchema.length} 个字段`);
    } catch (error) {
      console.error(`  ⚠️  获取目标表单 Schema 失败（将使用空字段列表）：${error.message}`);
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
    addDataFormUuid,
    addDataAssignments,
    dataFormUuid,
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
    addDataFormUuid,
    addDataAssignments,
    addDataFormSchema,
    addDataFormName,
    dataFormUuid,
    dataConditions,
    hasMessageNode,
  });

  // 保存逻辑流（草稿）
  step('保存逻辑流...');

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
    console.error(`  ❌ 保存逻辑流失败：${errorMsg}`);
    console.error(SEP);
    console.log(JSON.stringify({ success: false, error: errorMsg }));
    process.exit(1);
  }

  console.error('  ✅ 逻辑流保存成功（草稿状态）');

  // 发布逻辑流（可选）
  if (shouldPublish) {
    step('发布逻辑流...');

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
      console.error(`  ⚠️  发布逻辑流失败：${errorMsg}`);
      console.error('  （逻辑流已保存为草稿，可在宜搭平台手动发布）');
      console.error(SEP);
      console.log(
        JSON.stringify({
          success: true,
          published: false,
          processCode,
          flowName,
          appType,
          formUuid,
          warning: `发布失败：${errorMsg}，已保存为草稿`,
        })
      );
      return;
    }

    console.error('  ✅ 逻辑流发布成功（已开启）');
    console.error('\n' + SEP);
    console.error('✅ 集成&自动化创建并发布完成');
    console.error(`  processCode：${processCode}`);
    console.error(`  流程名称：${flowName}`);
    console.error(SEP);

    console.log(
      JSON.stringify({
        success: true,
        published: true,
        processCode,
        flowName,
        appType,
        formUuid,
        formEventTypes,
      })
    );
    return;
  }

  // 仅保存草稿的输出
  console.error('\n' + SEP);
  console.error('✅ 集成&自动化已保存为草稿');
  console.error(`  processCode：${processCode}`);
  console.error(`  流程名称：${flowName}`);
  console.error('  提示：使用 --publish 参数可在创建时直接发布');
  console.error(SEP);

  console.log(
    JSON.stringify({
      success: true,
      published: false,
      processCode,
      flowName,
      appType,
      formUuid,
      formEventTypes,
    })
  );
}

module.exports = { run };
