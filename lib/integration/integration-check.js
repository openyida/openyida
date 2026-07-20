'use strict';

const fs = require('fs');
const path = require('path');
const { loadAuthData, triggerLogin, resolveBaseUrl } = require('../core/utils');
const { listLogicflows, listFormLogicflows, listLogicflowLogs } = require('./integration-api');
const { diagnoseFlow, buildCheckHints, formatFindings } = require('./integration-diagnostics');
const { t } = require('../core/i18n');
const { banner, info, warn, success, usage } = require('../core/chalk');

const LOG_STATUS = {
  success: '3',
  exception: '2',
  running: '0',
};

const DEFAULT_FLOW_TYPES = ['1', '2', '3', '5', '6'];
const VALUE_FLAGS = new Set(['--output', '-o', '--log-page-size', '--max-log-pages', '--status', '--flow-types']);
const EXPORT_HEADER_KEYS = [
  'header_app',
  'header_form_title',
  'header_form_uuid',
  'header_flow_name',
  'header_process_code',
  'header_flow_status',
  'header_event_name',
  'header_last_action',
  'header_modifier',
  'header_modified_time',
  'header_abnormal_log_count',
  'header_proc_inst_id',
  'header_form_inst_id',
  'header_execution_status',
  'header_exception',
  'header_diagnosis',
  'header_recommendation',
  'header_start_time',
  'header_finish_time',
  'header_elapsed_ms',
];

function getExportHeaders() {
  return EXPORT_HEADER_KEYS.map((key) => t(`integration_check.${key}`));
}

function createProgressReporter(enabled) {
  if (!enabled) {
    return {
      update() {},
      finish() {},
    };
  }

  let lastLength = 0;
  return {
    update(message) {
      const line = `  ${message}`;
      const padding = lastLength > line.length ? ' '.repeat(lastLength - line.length) : '';
      process.stderr.write(`\r${line}${padding}`);
      lastLength = line.length;
    },
    finish() {
      if (lastLength > 0) {
        process.stderr.write('\n');
        lastLength = 0;
      }
    },
  };
}

function formatProgressBar(current, total, width = 28) {
  const safeTotal = Number(total) > 0 ? Number(total) : 0;
  const safeCurrent = Math.min(Math.max(Number(current) || 0, 0), safeTotal || Number(current) || 0);
  const ratio = safeTotal ? safeCurrent / safeTotal : 0;
  const filled = safeTotal ? Math.min(width, Math.round(ratio * width)) : 0;
  const empty = Math.max(width - filled, 0);
  const percent = safeTotal ? Math.round(ratio * 100) : 0;

  return `[${'#'.repeat(filled)}${'-'.repeat(empty)}] ${String(percent).padStart(3, ' ')}% (${safeCurrent}/${safeTotal})`;
}

function truncateText(text, maxLength) {
  const value = String(text || '');
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function columnName(index) {
  let n = index;
  let name = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - mod) / 26);
  }
  return name;
}

function sanitizeSheetName(name, fallback, usedNames = new Set()) {
  const base = String(name || fallback || 'Sheet')
    .replace(/[:\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31) || 'Sheet';
  let candidate = base;
  let counter = 2;
  while (usedNames.has(candidate)) {
    const suffix = ` ${counter}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    counter++;
  }
  usedNames.add(candidate);
  return candidate;
}

function cellXml(value, rowIndex, columnIndex) {
  const ref = `${columnName(columnIndex)}${rowIndex}`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function worksheetXml(rows) {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => cellXml(value, rowIndex + 1, columnIndex + 1)).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<dimension ref="A1:${columnName(EXPORT_HEADER_KEYS.length)}${Math.max(rows.length, 1)}"/>`,
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
    '<sheetData>',
    sheetRows,
    '</sheetData>',
    '</worksheet>',
  ].join('');
}

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = [];
    for (let i = 0; i < 256; i++) {
      let value = i;
      for (let bit = 0; bit < 8; bit++) {
        value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
      }
      table[i] = value >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const dataBuffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const crc = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function formatTimestamp(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  const timestamp = numeric < 10000000000 ? numeric * 1000 : numeric;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const pad = (part) => String(part).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
  ].join('');
}

function abnormalFlowToRows(flow) {
  const logs = flow.logs && flow.logs.length ? flow.logs : [{}];
  const flowFindings = Array.isArray(flow.diagnostics) ? flow.diagnostics : [];
  const diagnosisText = flowFindings.map((item) => `[${item.severity}] ${item.title}`).join('\n');
  const recommendationText = flowFindings.map((item) => item.recommendation).join('\n');
  return logs.map((log) => [
    flow.appType || '',
    flow.formTitle || '',
    flow.formUuid || '',
    flow.name || '',
    flow.processCode || '',
    flow.status || '',
    flow.eventName || '',
    flow.lastAction || '',
    flow.modifier || '',
    formatTimestamp(flow.gmtModified),
    flow.abnormalLogCount || 0,
    log.procInstId || '',
    log.formInstId || '',
    log.status === undefined ? '' : log.status,
    log.exceptionEntity || '',
    diagnosisText,
    recommendationText,
    formatTimestamp(log.createDate),
    formatTimestamp(log.finishDate || log.finishTime),
    log.elapsedTime === undefined ? '' : log.elapsedTime,
  ]);
}

function buildAppRows(appType, abnormalFlows, errors = []) {
  const rows = [getExportHeaders()];
  const flows = abnormalFlows.filter((flow) => flow.appType === appType);
  const appError = errors.find((error) => error.appType === appType);
  if (appError) {
    rows.push([appType, '', '', '', '', '', '', '', '', '', 0, '', '', '', t('integration_check.app_failed', appError.message), '', '', '', '', '']);
  }
  if (!flows.length) {
    if (!appError) {
      rows.push([appType, '', '', '', '', '', '', '', '', '', 0, '', '', '', t('integration_check.no_abnormal'), '', '', '', '', '']);
    }
    return rows;
  }
  for (const flow of flows) {
    rows.push(...abnormalFlowToRows(flow));
  }
  return rows;
}

function buildXlsxWorkbook(sheets) {
  const usedNames = new Set();
  const normalizedSheets = sheets.map((sheet, index) => ({
    name: sanitizeSheetName(sheet.name, `App${index + 1}`, usedNames),
    rows: sheet.rows && sheet.rows.length ? sheet.rows : [getExportHeaders()],
  }));
  const sheetEntries = normalizedSheets.map((sheet, index) => (
    `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )).join('');
  const relEntries = normalizedSheets.map((sheet, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('');
  const overrides = normalizedSheets.map((sheet, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('');

  const files = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`,
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relEntries}<Relationship Id="rId${normalizedSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>',
    },
  ];

  normalizedSheets.forEach((sheet, index) => {
    files.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: worksheetXml(sheet.rows),
    });
  });

  return zipStore(files);
}

function exportResultToExcel(result, outputPath) {
  const sheets = result.checkedApps.map((appType) => ({
    name: appType,
    rows: buildAppRows(appType, result.abnormalFlows, result.errors),
  }));
  const workbook = buildXlsxWorkbook(sheets.length ? sheets : [{ name: t('integration_check.result_sheet'), rows: [getExportHeaders()] }]);
  const resolvedPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, workbook);
  return resolvedPath;
}

function parseFlag(args, flagName) {
  const index = args.indexOf(flagName);
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('-')) {
    return args[index + 1];
  }
  return null;
}

function hasFlag(args, flagName) {
  return args.includes(flagName);
}

function parseAppTypes(args) {
  return args.filter((arg, index) => {
    if (arg.startsWith('-')) {
      return false;
    }
    return !VALUE_FLAGS.has(args[index - 1]);
  });
}

function normalizeLogStatus(value) {
  if (!value || value === 'exception') {
    return LOG_STATUS.exception;
  }
  if (value === 'success') {
    return LOG_STATUS.success;
  }
  if (value === 'running') {
    return LOG_STATUS.running;
  }
  if (['0', '2', '3'].includes(String(value))) {
    return String(value);
  }
  throw new Error(`不支持的日志状态：${value}。可选值：exception/success/running/0/2/3`);
}

function buildAuthRef() {
  const authData = loadAuthData();
  return Promise.resolve(authData || triggerLogin()).then((resolvedAuthData) => ({
    baseUrl: resolveBaseUrl(resolvedAuthData),
    authData: resolvedAuthData,
    authMode: resolvedAuthData.auth_mode || '',
    authSource: resolvedAuthData.auth_source || '',
    corpId: resolvedAuthData.corp_id || '',
    userId: resolvedAuthData.user_id || '',
  }));
}

function appendFlow(result, group, flow) {
  if (!flow || !flow.processCode || result.seenProcessCodes.has(flow.processCode)) {
    return;
  }
  result.seenProcessCodes.add(flow.processCode);
  result.flows.push({
    appType: result.appType,
    formUuid: flow.formUuid || group.formUuid || '',
    formTitle: group.formTitle || flow.formTitle || '',
    formType: group.formType || flow.formType || '',
    name: flow.name || '',
    processCode: flow.processCode,
    status: flow.status || '',
    eventName: flow.eventName || '',
    eventType: flow.eventType || group.eventType || null,
    executeByOrder: flow.executeByOrder,
    gmtModified: flow.gmtModified || '',
    lastAction: flow.lastAction || '',
    modifier: flow.modifier || '',
  });
}

function collectFlowsFromListResponse(result, response) {
  const groups = response.data || [];
  for (const item of groups) {
    if (Array.isArray(item.flowList)) {
      for (const flow of item.flowList) {
        appendFlow(result, item, flow);
      }
    } else {
      appendFlow(result, {}, item);
    }
  }
}

async function listAllFlowsForForm(authRef, appType, formUuid, baseGroup, options = {}) {
  const pageSize = options.pageSize || 10;
  const type = options.type || '1';
  const flows = {
    appType,
    flows: [],
    seenProcessCodes: new Set(),
  };
  let pageIndex = 1;
  let totalCount = null;

  do {
    const response = await listFormLogicflows(authRef, {
      appType,
      formUuid,
      type,
      pageIndex,
      pageSize,
    });
    collectFlowsFromListResponse(flows, response);
    totalCount = response.totalCount || totalCount;
    pageIndex++;
  } while (totalCount && (pageIndex - 1) * pageSize < totalCount);

  return flows.flows.map((flow) => ({
    ...flow,
    formTitle: flow.formTitle || baseGroup.formTitle || '',
    formType: flow.formType || baseGroup.formType || '',
  }));
}

async function listAllLogicflows(authRef, appType, options = {}) {
  const pageSize = options.pageSize || 10;
  const flowTypes = options.flowTypes || DEFAULT_FLOW_TYPES;
  const result = {
    appType,
    flows: [],
    seenProcessCodes: new Set(),
  };

  for (const type of flowTypes) {
    const groupsWithMore = [];
    let pageIndex = 1;
    let totalCount = null;

    do {
      const response = await listLogicflows(authRef, {
        appType,
        type,
        pageIndex,
        pageSize,
      });
      collectFlowsFromListResponse(result, response);
      for (const group of response.data || []) {
        if (group && group.formUuid && group.hasMore) {
          groupsWithMore.push(group);
        }
      }
      totalCount = response.totalCount || totalCount;
      pageIndex++;
    } while (totalCount && (pageIndex - 1) * pageSize < totalCount);

    for (const group of groupsWithMore) {
      const formFlows = await listAllFlowsForForm(authRef, appType, group.formUuid, group, { pageSize, type });
      for (const flow of formFlows) {
        appendFlow(result, group, flow);
      }
    }
  }

  return result.flows;
}

async function collectAbnormalFlows(authRef, appType, options = {}) {
  const status = normalizeLogStatus(options.status || 'exception');
  const logPageSize = options.logPageSize || 10;
  const maxLogPages = options.maxLogPages || 1;
  const flows = await listAllLogicflows(authRef, appType, {
    pageSize: 10,
    flowTypes: options.flowTypes || DEFAULT_FLOW_TYPES,
  });
  if (options.onProgress) {
    options.onProgress({ appType, phase: 'logs', current: 0, total: flows.length });
  }
  const abnormalFlows = [];

  for (let index = 0; index < flows.length; index++) {
    const flow = flows[index];
    const logs = [];
    let totalCount = 0;
    for (let pageIndex = 1; pageIndex <= maxLogPages; pageIndex++) {
      const logResponse = await listLogicflowLogs(authRef, {
        appType,
        processCode: flow.processCode,
        status,
        pageIndex,
        pageSize: logPageSize,
      });
      totalCount = logResponse.totalCount || totalCount;
      logs.push(...(logResponse.data || []));
      if (!totalCount || pageIndex * logPageSize >= totalCount) {
        break;
      }
    }
    if (totalCount > 0 || logs.length > 0) {
      abnormalFlows.push({
        ...flow,
        abnormalLogCount: totalCount || logs.length,
        logs,
        diagnostics: diagnoseFlow({ ...flow, logs }),
      });
    }
    if (options.onProgress) {
      options.onProgress({
        appType,
        phase: 'logs',
        current: index + 1,
        total: flows.length,
        flow,
      });
    }
  }

  return {
    appType,
    totalFlows: flows.length,
    abnormalFlows,
  };
}

function printTextResult(result) {
  success(t('integration_check.summary', result.checkedApps.length, result.totalFlows, result.abnormalFlows.length));
  for (const hintItem of result.hints || []) {
    info(`${hintItem.id}: ${hintItem.message}`);
  }
  if (result.errors.length) {
    warn(t('integration_check.apps_failed', result.errors.length));
  }
  if (!result.abnormalFlows.length) {
    info(t('integration_check.no_logs'));
    return;
  }
  for (const flow of result.abnormalFlows) {
    console.log([
      flow.appType,
      flow.formTitle || flow.formUuid || '-',
      flow.name || '-',
      flow.processCode,
      `异常日志 ${flow.abnormalLogCount}`,
    ].join('\t'));
    for (const log of flow.logs || []) {
      console.log([
        '',
        log.procInstId || '-',
        log.formInstId || '-',
        log.exceptionEntity || '-',
        log.finishDate || log.finishTime || log.createDate || '-',
      ].join('\t'));
    }
    if (flow.diagnostics && flow.diagnostics.length) {
      console.log(formatFindings(flow.diagnostics));
    }
  }
}

async function run(args) {
  if (!args.length || hasFlag(args, '--help') || hasFlag(args, '-h')) {
    usage(
      t('integration_check.usage'),
      t('integration_check.example')
    );
    process.exit(0);
  }

  const outputJson = hasFlag(args, '--json');
  const outputPath = parseFlag(args, '--output') || parseFlag(args, '-o');
  const logPageSize = Number(parseFlag(args, '--log-page-size') || 10);
  const maxLogPages = Number(parseFlag(args, '--max-log-pages') || 1);
  const status = normalizeLogStatus(parseFlag(args, '--status') || 'exception');
  const flowTypes = (parseFlag(args, '--flow-types') || DEFAULT_FLOW_TYPES.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const appTypes = parseAppTypes(args);

  if (!appTypes.length) {
    throw new Error(t('integration_check.missing_app'));
  }

  if (!outputJson) {
    banner(t('integration_check.banner_title'), { subtitle: t('integration_check.status_filter', status) });
  }

  const authRef = await buildAuthRef();
  const progress = createProgressReporter(!hasFlag(args, '--no-progress'));
  const result = {
    checkedApps: appTypes,
    totalFlows: 0,
    abnormalFlows: [],
    errors: [],
    hints: buildCheckHints(),
  };

  for (const appType of appTypes) {
    try {
      if (!outputJson) {
        info(t('integration_check.checking_app', appType));
      }
      const appResult = await collectAbnormalFlows(authRef, appType, {
        status,
        logPageSize,
        maxLogPages,
        flowTypes,
        onProgress: ({ current, total, flow }) => {
          if (current !== 0 && current !== total && current % 5 !== 0) {
            return;
          }
          const suffix = flow && flow.name ? t('integration_check.current', truncateText(flow.name, 32)) : '';
          progress.update(t('integration_check.progress', formatProgressBar(current, total), suffix));
        },
      });
      progress.finish();
      result.totalFlows += appResult.totalFlows;
      result.abnormalFlows.push(...appResult.abnormalFlows);
    } catch (error) {
      progress.finish();
      result.errors.push({ appType, message: error.message });
    }
  }

  if (outputJson) {
    console.log(JSON.stringify(result, null, 2));
    if (outputPath) {
      const exportedPath = exportResultToExcel(result, outputPath);
      success(t('integration_check.excel_exported', exportedPath));
    }
    return;
  }

  if (outputPath) {
    const exportedPath = exportResultToExcel(result, outputPath);
    success(t('integration_check.excel_exported', exportedPath));
  }
  printTextResult(result);
  if (result.errors.length) {
    process.exitCode = 1;
  }
}

module.exports = {
  LOG_STATUS,
  DEFAULT_FLOW_TYPES,
  formatProgressBar,
  sanitizeSheetName,
  buildAppRows,
  buildXlsxWorkbook,
  exportResultToExcel,
  formatTimestamp,
  normalizeLogStatus,
  parseAppTypes,
  collectFlowsFromListResponse,
  listAllLogicflows,
  collectAbnormalFlows,
  run,
};
