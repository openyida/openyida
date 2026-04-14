/**
 * check-data.js - 宜搭流程表单异常数据检测命令
 *
 * 用法：
 *   openyida data check <appType> <formUuid> <rules.json> [选项]
 *
 * 规则类型：
 *   contradiction  矛盾检测：条件成立时，某些字段应为空
 *   missing        缺失检测：条件成立时，某些字段不应为空
 *   value          数值异常：字段值不满足指定数值条件
 *   comparison     字段比较：两个字段之间的比较关系不满足预期
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  httpGet,
  requestWithAutoLogin,
} = require('./utils');

const querystring = require('querystring');

const USAGE = `openyida data check - 流程表单异常数据检测

用法：
  openyida data check <appType> <formUuid> <rules.json> [选项]

参数：
  appType     应用类型标识（如 APP_XXXXXX）
  formUuid    表单 UUID（如 FORM_XXXXXX）
  rules.json  规则文件路径（JSON 格式）

选项：
  --page N      起始页码（默认 1）
  --size N      每页条数（默认 20，最大 100）
  --max-pages N 最大拉取页数（默认 50，防止数据量过大）
  --output FILE 将检测结果输出到文件（默认输出到控制台）

规则文件格式（JSON 数组）：
[
  {
    "name": "合格但异常字段不为空",
    "type": "contradiction",
    "condition": { "fieldId": "radioField_xxx", "op": "Equal", "value": "合格" },
    "check": { "fieldIds": ["textareaField_a", "textareaField_b"], "shouldBe": "empty" }
  },
  {
    "name": "不合格但缺少异常描述",
    "type": "missing",
    "condition": { "fieldId": "radioField_xxx", "op": "Equal", "value": "不合格" },
    "check": { "fieldIds": ["textareaField_a"], "shouldBe": "notEmpty" }
  },
  {
    "name": "抽样数量异常",
    "type": "value",
    "check": { "fieldId": "numberField_xxx", "op": "GreaterThan", "value": 0 }
  },
  {
    "name": "时间顺序异常",
    "type": "comparison",
    "check": { "fieldA": "dateField_a", "op": "LessThanOrEqual", "fieldB": "dateField_b" }
  }
]
`;

function fail(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(1);
}

function parseError(message) {
  console.error(`参数校验失败：${message}`);
  console.error(USAGE);
  process.exit(1);
}

function ensureSession() {
  let cookieData = loadCookieData();
  if (!cookieData || !cookieData.cookies || cookieData.cookies.length === 0 || !cookieData.csrf_token) {
    cookieData = triggerLogin();
  }

  if (!cookieData || !cookieData.cookies || !cookieData.csrf_token) {
    fail('无法获取有效登录态或 CSRF Token');
  }

  return {
    cookieData,
    cookies: cookieData.cookies,
    csrfToken: cookieData.csrf_token,
    baseUrl: resolveBaseUrl(cookieData),
  };
}

function parseCliOptions(tokens) {
  const positionals = [];
  const options = {};

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith('--')) {
      const key = token.slice(2).replace(/-/g, '_');
      const next = tokens[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = true;
      }
    } else {
      positionals.push(token);
    }
  }

  return { positionals, options };
}

function loadRulesFile(rulesFilePath) {
  const resolvedPath = path.resolve(rulesFilePath);
  if (!fs.existsSync(resolvedPath)) {
    fail(`规则文件不存在：${resolvedPath}`);
  }

  let rulesContent;
  try {
    rulesContent = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    fail(`读取规则文件失败：${error.message}`);
  }

  let rules;
  try {
    rules = JSON.parse(rulesContent);
  } catch (error) {
    fail(`规则文件 JSON 格式错误：${error.message}`);
  }

  if (!Array.isArray(rules)) {
    fail('规则文件必须是 JSON 数组格式');
  }

  if (rules.length === 0) {
    fail('规则文件不能为空数组');
  }

  return rules;
}

function validateRules(rules) {
  const validTypes = ['contradiction', 'missing', 'value', 'comparison'];
  const validOps = ['Equal', 'NotEqual', 'GreaterThan', 'GreaterThanOrEqual', 'LessThan', 'LessThanOrEqual'];

  for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
    const rule = rules[ruleIndex];
    const ruleLabel = `规则[${ruleIndex}]${rule.name ? `(${rule.name})` : ''}`;

    if (!rule.name) {
      fail(`${ruleLabel}：缺少必填字段 "name"`);
    }
    if (!rule.type) {
      fail(`${ruleLabel}：缺少必填字段 "type"`);
    }
    if (!validTypes.includes(rule.type)) {
      fail(`${ruleLabel}：type 必须是 ${validTypes.join('|')} 之一，当前值：${rule.type}`);
    }
    if (!rule.check) {
      fail(`${ruleLabel}：缺少必填字段 "check"`);
    }

    // 校验 condition（可选，但若存在则必须合法）
    if (rule.condition) {
      if (!rule.condition.fieldId) {
        fail(`${ruleLabel}：condition 缺少 fieldId`);
      }
      if (!rule.condition.op) {
        fail(`${ruleLabel}：condition 缺少 op`);
      }
      if (!validOps.includes(rule.condition.op)) {
        fail(`${ruleLabel}：condition.op 必须是 ${validOps.join('|')} 之一`);
      }
      if (rule.condition.value === undefined) {
        fail(`${ruleLabel}：condition 缺少 value`);
      }
    }

    // 按类型校验 check 字段
    if (rule.type === 'contradiction' || rule.type === 'missing') {
      if (!rule.check.fieldIds || !Array.isArray(rule.check.fieldIds) || rule.check.fieldIds.length === 0) {
        fail(`${ruleLabel}：check 缺少有效的 fieldIds 数组`);
      }
      if (!rule.check.shouldBe || !['empty', 'notEmpty'].includes(rule.check.shouldBe)) {
        fail(`${ruleLabel}：check.shouldBe 必须是 empty|notEmpty`);
      }
    } else if (rule.type === 'value') {
      if (!rule.check.fieldId) {
        fail(`${ruleLabel}：check 缺少 fieldId`);
      }
      if (!rule.check.op || !validOps.includes(rule.check.op)) {
        fail(`${ruleLabel}：check.op 必须是 ${validOps.join('|')} 之一`);
      }
      if (rule.check.value === undefined) {
        fail(`${ruleLabel}：check 缺少 value`);
      }
    } else if (rule.type === 'comparison') {
      if (!rule.check.fieldA) {
        fail(`${ruleLabel}：check 缺少 fieldA`);
      }
      if (!rule.check.fieldB) {
        fail(`${ruleLabel}：check 缺少 fieldB`);
      }
      if (!rule.check.op || !validOps.includes(rule.check.op)) {
        fail(`${ruleLabel}：check.op 必须是 ${validOps.join('|')} 之一`);
      }
    }
  }
}

/**
 * 从表单实例数据中提取指定字段的值。
 * 宜搭表单数据存储在 formData 对象中，key 为字段 ID。
 */
function getFieldValue(formInstance, fieldId) {
  const formData = formInstance.formData || {};
  return formData[fieldId];
}

/**
 * 判断字段值是否为"空"。
 * 空的定义：undefined、null、空字符串、空数组。
 */
function isFieldEmpty(value) {
  if (value === undefined || value === null) {return true;}
  if (typeof value === 'string' && value.trim() === '') {return true;}
  if (Array.isArray(value) && value.length === 0) {return true;}
  return false;
}

/**
 * 执行条件比较操作。
 * 支持 Equal、NotEqual、GreaterThan、GreaterThanOrEqual、LessThan、LessThanOrEqual。
 */
function evaluateOp(actualValue, op, expectedValue) {
  switch (op) {
    case 'Equal':
      return actualValue === expectedValue;
    case 'NotEqual':
      return actualValue !== expectedValue;
    case 'GreaterThan':
      return Number(actualValue) > Number(expectedValue);
    case 'GreaterThanOrEqual':
      return Number(actualValue) >= Number(expectedValue);
    case 'LessThan':
      return Number(actualValue) < Number(expectedValue);
    case 'LessThanOrEqual':
      return Number(actualValue) <= Number(expectedValue);
    default:
      return false;
  }
}

/**
 * 检测单条表单实例是否违反指定规则。
 * 返回 null 表示未违反，返回违规详情对象表示违反。
 */
function checkInstanceAgainstRule(formInstance, rule) {
  const { type, condition, check } = rule;

  // 若有前置条件，先判断条件是否成立
  if (condition) {
    const conditionFieldValue = getFieldValue(formInstance, condition.fieldId);
    const conditionMet = evaluateOp(conditionFieldValue, condition.op, condition.value);
    if (!conditionMet) {
      // 条件不成立，跳过此规则
      return null;
    }
  }

  if (type === 'contradiction' || type === 'missing') {
    const violatingFields = [];
    for (const fieldId of check.fieldIds) {
      const fieldValue = getFieldValue(formInstance, fieldId);
      const isEmpty = isFieldEmpty(fieldValue);
      const shouldBeEmpty = check.shouldBe === 'empty';

      if (shouldBeEmpty && !isEmpty) {
        violatingFields.push({ fieldId, actualValue: fieldValue, issue: '字段应为空但有值' });
      } else if (!shouldBeEmpty && isEmpty) {
        violatingFields.push({ fieldId, actualValue: fieldValue, issue: '字段应有值但为空' });
      }
    }

    if (violatingFields.length > 0) {
      return { violatingFields };
    }
    return null;
  }

  if (type === 'value') {
    const fieldValue = getFieldValue(formInstance, check.fieldId);
    // 数值比较：check.op 描述的是"正常应满足的条件"，不满足则为异常
    const isNormal = evaluateOp(fieldValue, check.op, check.value);
    if (!isNormal) {
      return {
        violatingFields: [{
          fieldId: check.fieldId,
          actualValue: fieldValue,
          issue: `字段值 ${fieldValue} 不满足条件 ${check.op} ${check.value}`,
        }],
      };
    }
    return null;
  }

  if (type === 'comparison') {
    const valueA = getFieldValue(formInstance, check.fieldA);
    const valueB = getFieldValue(formInstance, check.fieldB);

    // 若任一字段为空，跳过比较
    if (isFieldEmpty(valueA) || isFieldEmpty(valueB)) {
      return null;
    }

    // 对日期字段做时间戳转换，其余字段直接数值比较
    const comparableA = isNaN(Number(valueA)) ? new Date(valueA).getTime() : Number(valueA);
    const comparableB = isNaN(Number(valueB)) ? new Date(valueB).getTime() : Number(valueB);

    const isNormal = evaluateOp(comparableA, check.op, comparableB);
    if (!isNormal) {
      return {
        violatingFields: [{
          fieldId: check.fieldA,
          actualValue: valueA,
          issue: `字段 ${check.fieldA}(${valueA}) 与 ${check.fieldB}(${valueB}) 的比较不满足条件 ${check.op}`,
        }],
      };
    }
    return null;
  }

  return null;
}

/**
 * 对单条表单实例运行所有规则，返回所有违规信息。
 */
function checkInstance(formInstance, rules) {
  const violations = [];
  for (const rule of rules) {
    const result = checkInstanceAgainstRule(formInstance, rule);
    if (result) {
      violations.push({
        ruleName: rule.name,
        ruleType: rule.type,
        ...result,
      });
    }
  }
  return violations;
}

/**
 * 分页拉取所有流程表单实例数据。
 */
async function fetchAllProcessInstances(session, appType, formUuid, pageSize, maxPages) {
  const allInstances = [];
  let currentPage = 1;
  let totalFetched = 0;

  while (currentPage <= maxPages) {
    const params = {
      _api: 'nattyFetch',
      _mock: 'false',
      _csrf_token: session.csrfToken,
      _stamp: `${Date.now()}`,
      formUuid,
      currentPage: String(currentPage),
      pageSize: String(pageSize),
    };

    const requestPath = `/dingtalk/web/${appType}/v1/process/getInstances.json`;
    let result;
    try {
      result = await requestWithAutoLogin(
        (auth) => httpGet(auth.baseUrl, requestPath, params, auth.cookies),
        session,
      );
    } catch (error) {
      fail(`拉取第 ${currentPage} 页数据失败：${error.message}`);
    }

    if (!result || !result.success) {
      const errorMsg = (result && result.errorMsg) || '未知错误';
      fail(`API 请求失败：${errorMsg}`);
    }

    const data = result.result || result.data || {};
    const instances = data.data || data.list || data.instances || [];

    if (instances.length === 0) {
      break;
    }

    allInstances.push(...instances);
    totalFetched += instances.length;

    // 判断是否已拉取全部数据
    const totalCount = data.totalCount || data.total || 0;
    if (totalCount > 0 && totalFetched >= totalCount) {
      break;
    }

    // 若本页数据不足一页，说明已是最后一页
    if (instances.length < pageSize) {
      break;
    }

    currentPage += 1;
  }

  return { instances: allInstances, pagesFetched: currentPage };
}

/**
 * 格式化并输出检测报告。
 */
function printReport(anomalies, totalChecked, rules, outputFile) {
  const report = {
    summary: {
      totalChecked,
      totalAnomalies: anomalies.length,
      rulesApplied: rules.length,
      checkedAt: new Date().toISOString(),
    },
    anomalies,
  };

  const reportJson = JSON.stringify(report, null, 2);

  if (outputFile) {
    const resolvedOutput = path.resolve(outputFile);
    try {
      fs.writeFileSync(resolvedOutput, reportJson, 'utf8');
      console.log(`✅ 检测完成，结果已写入：${resolvedOutput}`);
    } catch (error) {
      fail(`写入输出文件失败：${error.message}`);
    }
  } else {
    console.log(reportJson);
  }

  // 控制台摘要（无论是否输出到文件都打印）
  if (outputFile) {
    console.log(`📊 检测摘要：共检测 ${totalChecked} 条记录，发现 ${anomalies.length} 条异常`);
  }

  // 若有异常，以非零退出码退出，方便 CI 集成
  if (anomalies.length > 0) {
    process.exit(2);
  }
}

async function run(args) {
  const { positionals, options } = parseCliOptions(args);

  if (positionals.length < 3) {
    parseError('缺少必填参数：appType、formUuid、rules.json');
  }

  const [appType, formUuid, rulesFilePath] = positionals;

  const pageSize = Math.min(Math.max(Number.parseInt(options.size || '20', 10), 1), 100);
  const maxPages = Math.max(Number.parseInt(options.max_pages || '50', 10), 1);
  const outputFile = options.output || null;

  // 加载并校验规则
  const rules = loadRulesFile(rulesFilePath);
  validateRules(rules);

  console.error(`🔍 开始检测：appType=${appType}, formUuid=${formUuid}, 规则数=${rules.length}`);

  // 建立会话
  const session = ensureSession();

  // 分页拉取数据
  console.error(`📥 正在拉取流程表单数据（每页 ${pageSize} 条，最多 ${maxPages} 页）...`);
  const { instances, pagesFetched } = await fetchAllProcessInstances(session, appType, formUuid, pageSize, maxPages);

  console.error(`📋 共拉取 ${instances.length} 条记录（共 ${pagesFetched} 页），开始逐条检测...`);

  // 逐条检测
  const anomalies = [];
  for (const instance of instances) {
    const violations = checkInstance(instance, rules);
    if (violations.length > 0) {
      anomalies.push({
        instanceId: instance.processInstanceId || instance.formInstId || instance.id,
        title: instance.title || instance.formData && instance.formData.title,
        originatorName: instance.originatorName || instance.createUser,
        createTime: instance.createTime || instance.gmtCreate,
        violations,
      });
    }
  }

  printReport(anomalies, instances.length, rules, outputFile);
}

module.exports = { run, checkInstance, checkInstanceAgainstRule, isFieldEmpty, evaluateOp };
