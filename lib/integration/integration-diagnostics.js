'use strict';

const { getLanguage } = require('../core/i18n');

const PITFALL_RULES = [
  {
    id: 'connector-error',
    severity: 'error',
    title: {
      zh: '连接器执行异常',
      en: 'Connector execution failed',
    },
    summary: {
      zh: '日志中出现连接器或接口参数相关异常。',
      en: 'The log contains connector or API parameter errors.',
    },
    recommendation: {
      zh: '先检查 connectorId/actionId 是否存在、授权连接是否有效、入参类型是否与动作 schema 一致。员工字段、单选字段透传给连接器时尤其容易类型不匹配。',
      en: 'Check connectorId/actionId, auth connection, and whether input value types match the action schema. Employee and select fields are common mismatch sources.',
    },
    patterns: [/连接器/i, /connector/i, /一方连接器/i, /G-CONN/i, /G-ACT/i, /接口参数异常/i],
  },
  {
    id: 'get-self-form-inst-id',
    severity: 'info',
    title: {
      zh: '获取自身应使用来源表单的唯一实例字段精确匹配',
      en: 'Use the source form unique instance field for get-self',
    },
    summary: {
      zh: '获取当前触发记录时，按来源表单类型使用对应的唯一实例字段精确匹配。',
      en: 'When reading the current trigger record, match the appropriate unique instance field for the source form type.',
    },
    recommendation: {
      zh: '标准配置：获取单条数据，来源表单为当前触发表；流程表单运行态使用查询侧系统字段 pid、设计器使用 proc_inst_id，普通表单两侧使用 form_inst_id，均等于触发事件字段 __masterdata_form_inst_id。CLI 可使用 --get-self 生成该节点。',
      en: 'Recommended setup: Get single data from the trigger form. Process forms use query-side pid at runtime and proc_inst_id in the designer; ordinary forms use form_inst_id on both sides. All match the trigger field __masterdata_form_inst_id. The CLI can generate this via --get-self.',
    },
    patterns: [/获取自身/i, /表单实例ID/i, /formInstId/i, /__masterdata_form_inst_id/i, /form instance/i, /get.?self/i],
  },
  {
    id: 'serial-number-after-trigger',
    severity: 'warning',
    title: {
      zh: '触发时流水号可能还未生成',
      en: 'Serial number may be empty at trigger time',
    },
    summary: {
      zh: '编辑/新增触发时直接读取当前提交数据中的流水号，可能拿到空值或旧值。',
      en: 'Reading a serial number directly from trigger payload can return empty or stale values.',
    },
    recommendation: {
      zh: '需要消费流水号时，先用获取自身节点按来源表单对应的唯一实例字段重新获取最新记录，再引用该节点里的流水号字段。',
      en: 'Before using a serial number, add a get-self node using the source form type\'s unique instance field and read the serial number from that node output.',
    },
    patterns: [/流水号/i, /serialNumber/i, /SerialNumberField/i],
  },
  {
    id: 'data-retrieve-field-null',
    severity: 'error',
    title: {
      zh: '获取数据过滤字段不存在或类型不支持',
      en: 'Data retrieve filter field is missing or unsupported',
    },
    summary: {
      zh: '日志里出现 field is null，通常表示获取数据节点的过滤字段 ID 不存在、写成了触发事件字段，或字段类型不被该查询条件支持。',
      en: 'A "field is null" log usually means the data retrieve filter uses a missing field ID, an event field on the query side, or an unsupported field type.',
    },
    recommendation: {
      zh: '检查获取数据节点左侧字段必须是被查询表单里的字段。获取自身时，流程表单运行态使用查询侧 pid、设计器使用 proc_inst_id，普通表单两侧使用 form_inst_id；均等于触发事件字段 __masterdata_form_inst_id。不要把 __masterdata_form_inst_id 或 formInstId 放在查询侧。',
      en: 'Check that the left-side field belongs to the queried form. For get-self, process forms use query-side pid at runtime and proc_inst_id in the designer; ordinary forms use form_inst_id on both sides. Do not put __masterdata_form_inst_id or formInstId on the query side.',
    },
    patterns: [/field is null/i, /暂时不支持其他类型Field/i, /selectListException/i],
  },
  {
    id: 'condition-empty-isempty',
    severity: 'warning',
    title: {
      zh: '条件分支空值判断优先使用 ISEMPTY()',
      en: 'Use ISEMPTY() for empty checks in condition branches',
    },
    summary: {
      zh: '条件分支里的“没有值/空值”选项在部分场景可能不生效。',
      en: 'The built-in "no value" condition can be unreliable in some branch scenarios.',
    },
    recommendation: {
      zh: '空值判断建议改用公式 ISEMPTY(字段)，避免分支误判。',
      en: 'Use a formula such as ISEMPTY(field) to avoid branch misclassification.',
    },
    patterns: [/条件分支/i, /空值/i, /没有值/i, /NoValue/i, /ISEMPTY/i, /isempty/i],
  },
  {
    id: 'direct-update-field-match',
    severity: 'warning',
    title: {
      zh: '直接更新匹配字段限制较多',
      en: 'Direct update field matching has strict limits',
    },
    summary: {
      zh: '直接更新的匹配字段通常只能使用当前触发表单字段，且文本字段不能可靠匹配单选/多选字段。',
      en: 'Direct update matching usually only supports trigger-form fields, and text fields do not reliably match select fields.',
    },
    recommendation: {
      zh: '优先使用表单实例ID或唯一业务键精确匹配；跨节点结果或复杂类型匹配时，先获取数据节点，再基于节点结果更新。',
      en: 'Prefer exact matching by formInstId or a unique business key. For upstream node output or complex types, retrieve the data first and update by node result.',
    },
    patterns: [/直接更新/i, /dataUpdate/i, /UpdateDataNode/i, /匹配字段/i, /单选/i, /多选/i, /SelectField/i, /RadioField/i],
  },
  {
    id: 'direct-update-no-recursive-trigger',
    severity: 'warning',
    title: {
      zh: '直接更新不会触发目标表自动化',
      en: 'Direct update does not trigger target-form automation',
    },
    summary: {
      zh: '集成自动化里的直接更新不会继续触发被更新表单上的集成自动化。',
      en: 'Direct updates from an automation do not trigger automations on the updated target form.',
    },
    recommendation: {
      zh: '如果需要级联动作，请把后续节点放在同一条逻辑流中，或改用明确的连接器/消息/新增节点承接，不要依赖目标表再次触发。',
      en: 'If cascading behavior is required, put downstream nodes in the same flow or use an explicit connector/message/create node instead of relying on target-form triggers.',
    },
    patterns: [/不触发.*自动化/i, /不会触发.*自动化/i, /自动触发/i, /triggerFormEventRecursively/i, /递归触发/i],
  },
  {
    id: 'retry-replays-flow',
    severity: 'warning',
    title: {
      zh: '异常重试会从头执行，可能覆盖数据',
      en: 'Retry replays the flow and may overwrite data',
    },
    summary: {
      zh: '流程异常后重试通常会从头重新跑一遍，前面已执行过的新增/更新节点可能再次执行。',
      en: 'Retry usually reruns the flow from the beginning, so earlier create/update nodes may run again.',
    },
    recommendation: {
      zh: '重试前先确认是否有写数据节点；必要时先关闭自动化、修正幂等条件或手工清理已写入数据，避免覆盖或重复写入。',
      en: 'Before retrying, check write nodes. Disable the flow, add idempotent guards, or clean existing writes when needed to avoid overwrites or duplicates.',
    },
    patterns: [/重试/i, /retry/i, /从头/i, /覆盖/i, /流程异常/i, /执行异常/i],
  },
  {
    id: 'timer-trigger-stale-data',
    severity: 'warning',
    title: {
      zh: '定时触发值可能是历史数据',
      en: 'Timer trigger values can be stale',
    },
    summary: {
      zh: '定时自动化里的触发值可能不是当前最新数据。',
      en: 'Timer-triggered values may not reflect the latest record data.',
    },
    recommendation: {
      zh: '定时场景需要最新值时，先通过获取数据/获取自身节点按表单实例ID或唯一键重新取数，再继续后续节点。',
      en: 'For latest values in scheduled flows, retrieve the current record again by formInstId or a unique key before downstream nodes.',
    },
    patterns: [/定时/i, /timer/i, /schedule/i, /历史数据/i, /最新值/i],
  },
  {
    id: 'success-log-can-hide-empty-result',
    severity: 'info',
    title: {
      zh: '无异常日志不代表业务正确',
      en: 'No abnormal log does not guarantee business correctness',
    },
    summary: {
      zh: '获取数据无匹配、空结果或条件未命中时，运行日志仍可能显示成功。',
      en: 'No-match data retrieval, empty output, or unmatched branches can still produce success logs.',
    },
    recommendation: {
      zh: '排查“没生效”类问题时，同时查看成功日志、节点输出和业务数据；不要只依赖 status=2 异常日志。',
      en: 'For "did not take effect" issues, inspect success logs, node outputs, and business data; do not rely only on status=2 abnormal logs.',
    },
    patterns: [/无异常/i, /未发现执行异常/i, /status.?3/i, /成功.*空/i, /匹配不到/i, /获取不到/i, /空结果/i, /没生效/i],
  },
];

function getCurrentLang() {
  const lang = getLanguage();
  return lang === 'zh' || lang === 'zh-HK' ? 'zh' : 'en';
}

function pickLocalized(value, lang = getCurrentLang()) {
  if (typeof value === 'string') {
    return value;
  }
  return value[lang] || value.en || value.zh || '';
}

function compactText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildLogText(log = {}, flow = {}) {
  return [
    flow.name,
    flow.processCode,
    flow.eventName,
    flow.formTitle,
    log.nodeName,
    log.nodeId,
    log.status,
    log.exceptionEntity,
    log.procInstId,
    log.formInstId,
    log.finishTime,
    log.finishDate,
  ].map(compactText).filter(Boolean).join('\n');
}

function ruleMatches(rule, text) {
  return rule.patterns.some((pattern) => pattern.test(text));
}

function materializeFinding(rule, evidence, options = {}) {
  const lang = options.lang || getCurrentLang();
  return {
    id: rule.id,
    severity: rule.severity,
    title: pickLocalized(rule.title, lang),
    summary: pickLocalized(rule.summary, lang),
    recommendation: pickLocalized(rule.recommendation, lang),
    evidence: evidence ? String(evidence).slice(0, 300) : '',
  };
}

function diagnoseText(input, options = {}) {
  const text = compactText(input);
  const findings = [];
  const seen = new Set();
  for (const rule of PITFALL_RULES) {
    if (ruleMatches(rule, text) && !seen.has(rule.id)) {
      seen.add(rule.id);
      findings.push(materializeFinding(rule, text, options));
    }
  }
  return findings;
}

function diagnoseLog(log = {}, flow = {}, options = {}) {
  return diagnoseText(buildLogText(log, flow), options);
}

function diagnoseFlow(flow = {}, options = {}) {
  const logs = Array.isArray(flow.logs) ? flow.logs : [];
  const seen = new Map();
  for (const log of logs) {
    for (const finding of diagnoseLog(log, flow, options)) {
      const existing = seen.get(finding.id);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(finding.id, { ...finding, count: 1 });
      }
    }
  }

  if (logs.length > 0 && seen.size === 0) {
    const lang = options.lang || getCurrentLang();
    seen.set('unknown-abnormal', {
      id: 'unknown-abnormal',
      severity: 'warning',
      title: lang === 'zh' ? '发现异常日志，但未命中已知规则' : 'Abnormal log found, no known rule matched',
      summary: lang === 'zh' ? '该异常需要结合节点配置、运行日志和业务数据继续排查。' : 'Inspect node config, run logs, and business data for this issue.',
      recommendation: lang === 'zh'
        ? '优先确认失败节点、重试是否会重复写入，以及上游节点输出是否为空。'
        : 'Check the failed node, retry idempotency, and whether upstream node output is empty.',
      evidence: logs.map((log) => log.exceptionEntity).filter(Boolean).join('\n').slice(0, 300),
      count: logs.length,
    });
  }

  return Array.from(seen.values());
}

function listPitfallRules(options = {}) {
  const lang = options.lang || getCurrentLang();
  return PITFALL_RULES.map((rule) => ({
    id: rule.id,
    severity: rule.severity,
    title: pickLocalized(rule.title, lang),
    summary: pickLocalized(rule.summary, lang),
    recommendation: pickLocalized(rule.recommendation, lang),
  }));
}

function buildCheckHints(options = {}) {
  const lang = options.lang || getCurrentLang();
  if (lang === 'zh') {
    return [
      {
        id: 'check-status-scope',
        severity: 'info',
        message: 'integration check 默认只筛选异常日志；获取数据无匹配、条件未命中等逻辑问题可能仍显示执行成功。',
      },
      {
        id: 'get-self-standard',
        severity: 'info',
        message: '获取自身的标准配置是：流程表单运行态查询侧 pid、设计器 proc_inst_id，普通表单两侧 form_inst_id，均等于触发事件字段 __masterdata_form_inst_id；创建时可使用 --get-self。',
      },
    ];
  }
  return [
    {
      id: 'check-status-scope',
      severity: 'info',
      message: 'integration check filters abnormal logs by default; no-match data retrieval and unmatched branches may still show success.',
    },
    {
      id: 'get-self-standard',
      severity: 'info',
      message: 'Recommended get-self setup: process forms use query-side pid at runtime and proc_inst_id in the designer; ordinary forms use form_inst_id on both sides. Use --get-self when creating flows.',
    },
  ];
}

function formatFindings(findings, options = {}) {
  const lang = options.lang || getCurrentLang();
  if (!Array.isArray(findings) || findings.length === 0) {
    return lang === 'zh' ? '未命中已知集成自动化闭坑规则。' : 'No known integration pitfall rule matched.';
  }
  return findings.map((finding) => {
    const count = finding.count && finding.count > 1 ? ` x${finding.count}` : '';
    return [
      `[${finding.severity}] ${finding.id}${count}: ${finding.title}`,
      `  ${finding.summary}`,
      `  ${finding.recommendation}`,
    ].join('\n');
  }).join('\n');
}

module.exports = {
  PITFALL_RULES,
  diagnoseText,
  diagnoseLog,
  diagnoseFlow,
  listPitfallRules,
  buildCheckHints,
  formatFindings,
};
