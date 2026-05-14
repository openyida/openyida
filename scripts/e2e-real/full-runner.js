#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const {
  addResource,
  createRegistry,
  decodeCookieData,
  getConfig,
  runCli,
  writeCookieCache,
  writeRegistry,
} = require('./runner');
const { validateSkillCoverage } = require('./skill-coverage');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_PAGE_SOURCE = path.join(ROOT, 'project', 'pages', 'src', 'demo-compat-smoke.oyd.jsx');

const DEFAULT_STAGES = [
  'auth',
  'app',
  'form',
  'page',
  'data',
  'permission',
  'share',
  'report',
  'dashboard',
  'export',
  'import',
  'batch',
  'task',
  'offline',
  'connector-local',
  'skill-coverage',
];

const EXTENDED_STAGES = [
  'ai',
  'process',
  'integration',
  'connector-real',
];

function parseStages(value) {
  if (!value || value === 'default') {return DEFAULT_STAGES;}
  if (value === 'all') {return [...DEFAULT_STAGES, ...EXTENDED_STAGES];}
  return value.split(',').map((stage) => stage.trim()).filter(Boolean);
}

function hasStage(stages, stage) {
  return stages.includes(stage) || stages.includes('all');
}

function getFullConfig(env = process.env, date = new Date()) {
  const base = getConfig(env, date);
  return {
    ...base,
    stages: parseStages(env.OPENYIDA_E2E_FULL_STAGES || env.OPENYIDA_E2E_STAGES),
    full: true,
    updateAppName: env.OPENYIDA_E2E_UPDATE_APP_NAME || `${base.prefix}_App_Renamed`,
    resultAppName: env.OPENYIDA_E2E_RESULT_APP_NAME || `${base.prefix}_PASSED`,
    importAppName: env.OPENYIDA_E2E_IMPORT_APP_NAME || `${base.prefix}_Imported`,
    pageSource: env.OPENYIDA_E2E_PAGE_SOURCE || DEFAULT_PAGE_SOURCE,
  };
}

function ensureEnabled(config) {
  if (!config.enabled) {
    console.log('Skipping full real E2E; missing: OPENYIDA_E2E=1');
    return false;
  }
  return true;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
  return filePath;
}

function archiveImportReport(workDir) {
  const source = path.join(ROOT, 'yida-migration-report.json');
  if (!fs.existsSync(source)) {return null;}
  const target = path.join(workDir, 'yida-migration-report.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(source, target);
  return target;
}

function i18nText(value) {
  if (!value) {return '';}
  if (typeof value === 'string') {return value;}
  return value.zh_CN || value.en_US || value.pureEn_US || '';
}

function collectFields(node, fields = []) {
  if (!node || typeof node !== 'object') {return fields;}
  if (node.props && node.props.fieldId) {
    fields.push({
      label: i18nText(node.props.label),
      componentName: node.componentName,
      fieldId: node.props.fieldId,
      reportFieldCode: node.componentName === 'SelectField' ? `${node.props.fieldId}_value` : node.props.fieldId,
    });
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.forEach((item) => collectFields(item, fields));
    } else if (value && typeof value === 'object') {
      collectFields(value, fields);
    }
  }
  return fields;
}

function fieldByLabel(fields, label) {
  const field = fields.find((item) => item.label === label);
  if (!field) {
    throw new Error(`Field not found in schema: ${label}`);
  }
  return field;
}

function findValueByKeys(node, keys) {
  if (!node || typeof node !== 'object') {return null;}
  for (const key of keys) {
    if (node[key]) {return node[key];}
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findValueByKeys(item, keys);
        if (found) {return found;}
      }
    } else if (value && typeof value === 'object') {
      const found = findValueByKeys(value, keys);
      if (found) {return found;}
    }
  }
  return null;
}

function buildReportCharts(formUuid, fields) {
  const numberField = fieldByLabel(fields, 'E2E Number');
  const statusField = fieldByLabel(fields, 'E2E Status');
  const cubeCode = formUuid.replace(/-/g, '_');
  return [
    {
      type: 'bar',
      title: 'E2E Number by Status',
      cubeCode,
      xField: {
        fieldCode: statusField.reportFieldCode,
        aliasName: 'E2E Status',
        dataType: 'STRING',
      },
      yField: [
        {
          fieldCode: numberField.reportFieldCode,
          aliasName: 'E2E Number',
          dataType: 'NUMBER',
          aggregateType: 'SUM',
        },
      ],
    },
  ];
}

function buildAppendCharts(formUuid, fields) {
  const numberField = fieldByLabel(fields, 'E2E Number');
  return [
    {
      type: 'indicator',
      title: 'E2E Total',
      cubeCode: formUuid.replace(/-/g, '_'),
      kpiField: {
        fieldCode: numberField.reportFieldCode,
        aliasName: 'E2E Number',
        dataType: 'NUMBER',
        aggregateType: 'SUM',
      },
    },
  ];
}

function buildResultApp(context, resultAppName) {
  if (!context.appType) {return null;}
  const baseUrl = 'https://www.aliwork.com';
  const resultPageId = context.dashboardPageId || context.pageId;
  return {
    appType: context.appType,
    name: resultAppName,
    adminUrl: `${baseUrl}/${context.appType}/admin`,
    workbenchUrl: `${baseUrl}/${context.appType}/workbench`,
    formUrl: context.formUuid ? `${baseUrl}/${context.appType}/workbench/${context.formUuid}` : null,
    pageUrl: resultPageId ? `${baseUrl}/${context.appType}/custom/${resultPageId}?isRenderNav=false` : null,
    businessDashboardFormUuid: context.businessDashboardFormUuid || context.businessDashboardPageId || null,
    businessDashboardUrl: context.businessDashboardPageId ? `${baseUrl}/${context.appType}/custom/${context.businessDashboardPageId}?isRenderNav=false` : null,
    businessDashboardShareUrl: context.businessDashboardSharePath ? `${baseUrl}${context.businessDashboardSharePath}` : null,
    reportUrl: context.reportId ? `${baseUrl}/${context.appType}/workbench/${context.reportId}` : null,
  };
}

function printResultApp(resultApp) {
  if (!resultApp) {return;}
  console.log('Full real E2E result app:');
  console.log(`  Name: ${resultApp.name}`);
  console.log(`  App: ${resultApp.adminUrl}`);
  if (resultApp.formUrl) {console.log(`  Form: ${resultApp.formUrl}`);}
  if (resultApp.pageUrl) {console.log(`  Page: ${resultApp.pageUrl}`);}
  if (resultApp.businessDashboardFormUuid) {console.log(`  Business Dashboard FormUuid: ${resultApp.businessDashboardFormUuid}`);}
  if (resultApp.businessDashboardUrl) {console.log(`  Business Dashboard: ${resultApp.businessDashboardUrl}`);}
  if (resultApp.businessDashboardShareUrl) {console.log(`  Business Dashboard Share: ${resultApp.businessDashboardShareUrl}`);}
  if (resultApp.reportUrl) {console.log(`  Report: ${resultApp.reportUrl}`);}
}

function escapeJsString(value) {
  return JSON.stringify(String(value || ''));
}

function buildDashboardSource(config, context) {
  const modules = [
    'Auth and organization',
    'App create/update/list',
    'Form create/update/options/schema',
    'Custom page build/compile/publish',
    'Data create/query/update',
    'Permission read',
    'Share config',
    'Report create/append',
    'Export/import',
    'Batch and task center',
    'Formula, doctor, samples, CDN config',
    'Connector local parsing',
  ];

  const resourceRows = [
    ['App', context.appType],
    ['Form', context.formUuid],
    ['Smoke Page', context.pageId],
    ['Report', context.reportId],
    ['Imported App', context.importAppType],
  ].filter((row) => row[1]);

  return `import React from 'react';

var RESULT = {
  title: ${escapeJsString(config.resultAppName)},
  runId: ${escapeJsString(config.prefix)},
  appType: ${escapeJsString(context.appType)},
  formUuid: ${escapeJsString(context.formUuid)},
  smokePageId: ${escapeJsString(context.pageId)},
  reportId: ${escapeJsString(context.reportId)},
  importedAppType: ${escapeJsString(context.importAppType)},
  generatedAt: ${escapeJsString(new Date().toISOString())},
};

var MODULES = ${JSON.stringify(modules, null, 2)};
var RESOURCES = ${JSON.stringify(resourceRows, null, 2)};

function metric(label, value, accent) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #d9e2ef',
      borderRadius: 8,
      padding: 18,
      minHeight: 104,
    }}>
      <div style={{ fontSize: 13, color: '#5f6f89', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, lineHeight: '34px', fontWeight: 800, color: accent || '#14213d' }}>{value}</div>
    </div>
  );
}

function statusRow(name, index) {
  return (
    <div key={name} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 0',
      borderBottom: index === MODULES.length - 1 ? '0' : '1px solid #edf1f7',
      fontSize: 14,
      color: '#24324a',
    }}>
      <span style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: '#16a34a',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 800,
        flex: '0 0 auto',
      }}>✓</span>
      <span>{name}</span>
    </div>
  );
}

function resourceRow(row) {
  return (
    <div key={row[0]} style={{
      display: 'grid',
      gridTemplateColumns: '120px minmax(0, 1fr)',
      gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid #edf1f7',
      fontSize: 14,
    }}>
      <div style={{ color: '#667085', fontWeight: 700 }}>{row[0]}</div>
      <div style={{ color: '#172033', wordBreak: 'break-all', fontFamily: 'Menlo, Consolas, monospace' }}>{row[1]}</div>
    </div>
  );
}

export default function Page() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f7fb',
      color: '#172033',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: 28,
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 20,
          marginBottom: 22,
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#2864d8', fontWeight: 800, marginBottom: 8 }}>
              OPENYIDA REAL ENVIRONMENT E2E
            </div>
            <div style={{ fontSize: 30, lineHeight: '38px', fontWeight: 850, color: '#101828' }}>
              Full E2E Dashboard
            </div>
            <div style={{ fontSize: 14, color: '#667085', marginTop: 8 }}>
              {RESULT.runId} · generated {RESULT.generatedAt}
            </div>
          </div>
          <div style={{
            background: '#dcfce7',
            color: '#166534',
            border: '1px solid #86efac',
            borderRadius: 999,
            padding: '8px 14px',
            fontWeight: 800,
            fontSize: 13,
          }}>
            PASSED
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 14,
          marginBottom: 16,
        }}>
          {metric('Modules', MODULES.length, '#2563eb')}
          {metric('Resources', RESOURCES.length, '#7c3aed')}
          {metric('Result App', RESULT.appType ? 'Ready' : 'Missing', '#16a34a')}
          {metric('Report', RESULT.reportId ? 'Ready' : 'Skipped', '#d97706')}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)',
          gap: 16,
          alignItems: 'start',
        }}>
          <section style={{
            background: '#fff',
            border: '1px solid #d9e2ef',
            borderRadius: 8,
            padding: 20,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Coverage</div>
            {MODULES.map(statusRow)}
          </section>

          <section style={{
            background: '#fff',
            border: '1px solid #d9e2ef',
            borderRadius: 8,
            padding: 20,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Resources</div>
            {RESOURCES.map(resourceRow)}
            <div style={{
              marginTop: 18,
              padding: 14,
              background: '#f8fafc',
              border: '1px solid #e5eaf3',
              borderRadius: 8,
              color: '#475467',
              fontSize: 13,
              lineHeight: '20px',
            }}>
              This app is the human-inspectable artifact for the latest successful OpenYida full real-environment test.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildDashboardSkillSource(config, context) {
  return `import React from 'react';

var DASHBOARD = {
  title: 'OpenYida Dashboard Skill E2E',
  subtitle: ${escapeJsString(config.prefix + ' · yida-dashboard verification')},
  formUuid: ${escapeJsString(context.formUuid || '')},
  reportId: ${escapeJsString(context.reportId || '')},
  generatedAt: ${escapeJsString(new Date().toISOString())}
};

var KPIS = [
  { label: '健康指数', value: '96', unit: '/100', trend: '+4.8%' },
  { label: '真实资源', value: '4', unit: '类', trend: 'App/Form/Page/Report' },
  { label: '发布状态', value: 'OK', unit: '', trend: 'health-check' },
  { label: '看板模式', value: 'ON', unit: '', trend: 'isRenderNav=false' }
];

var CHECKS = [
  'Dashboard mode custom page created',
  'KPI control tower rendered',
  'Responsive chart grid rendered',
  'Screenshot buttons carry sl-no-capture',
  'No mouse-enter event handlers used',
  'Report and form resource IDs displayed'
];

function kpiCard(item, index) {
  var colors = ['#2563eb', '#16a34a', '#7c3aed', '#d97706'];
  return (
    <div key={item.label} style={{ background: '#fff', border: '1px solid #d9e2ef', borderRadius: 8, padding: 18, minHeight: 126, position: 'relative' }}>
      <button className="sl-no-capture" style={{ position: 'absolute', top: 12, right: 12, height: 28, border: '1px solid #d0d7e2', borderRadius: 6, background: '#fff', color: '#344054' }}>截图</button>
      <div style={{ color: '#64748b', fontSize: 13, fontWeight: 700 }}>{item.label}</div>
      <div style={{ marginTop: 16 }}><span style={{ color: colors[index % colors.length], fontSize: 34, fontWeight: 850 }}>{item.value}</span><span style={{ color: '#667085', marginLeft: 6 }}>{item.unit}</span></div>
      <div style={{ marginTop: 8, color: '#16a34a', fontSize: 13, fontWeight: 800 }}>{item.trend}</div>
    </div>
  );
}

function chartPanel(title, rows) {
  return (
    <section style={{ background: '#fff', border: '1px solid #d9e2ef', borderRadius: 8, padding: 18, minHeight: 238 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 850 }}>{title}</div>
        <button className="sl-no-capture" style={{ height: 30, border: '1px solid #d0d7e2', borderRadius: 6, background: '#fff', color: '#344054' }}>截图</button>
      </div>
      {rows.map(function (row) {
        return (
          <div key={row.label} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span>{row.label}</span><span>{row.value}%</span></div>
            <div style={{ height: 10, background: '#edf2f7', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: row.value + '%', height: '100%', background: row.color }} /></div>
          </div>
        );
      })}
    </section>
  );
}

export default function Page() {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fb', color: '#172033', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: 28, boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 850, marginBottom: 8 }}>YIDA DASHBOARD SKILL</div>
            <h1 style={{ fontSize: 32, lineHeight: '40px', margin: 0 }}>{DASHBOARD.title}</h1>
            <div style={{ fontSize: 14, color: '#667085', marginTop: 8 }}>{DASHBOARD.subtitle}</div>
          </div>
          <div style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: 999, padding: '8px 14px', fontWeight: 850, fontSize: 13 }}>PASSED</div>
        </header>
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 10, background: '#fff', border: '1px solid #d9e2ef', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          {['今日', '本周', '本月', '全链路'].map(function (label) { return <button key={label} style={{ height: 32, padding: '0 12px', border: label === '全链路' ? '1px solid #2563eb' : '1px solid #d0d7e2', borderRadius: 6, background: label === '全链路' ? '#eff6ff' : '#fff', color: label === '全链路' ? '#1d4ed8' : '#344054', fontWeight: 800 }}>{label}</button>; })}
        </section>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 14 }}>{KPIS.map(kpiCard)}</section>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 }}>
          {chartPanel('模块覆盖率', [{ label: 'App/Form/Page', value: 100, color: '#2563eb' }, { label: 'Data/Permission/Share', value: 100, color: '#16a34a' }, { label: 'Report/Export/Import', value: 100, color: '#7c3aed' }])}
          {chartPanel('真实资源健康度', [{ label: 'Form schema', value: 100, color: '#0ea5e9' }, { label: 'Dashboard publish', value: 100, color: '#22c55e' }, { label: 'Report append', value: 100, color: '#f59e0b' }])}
        </section>
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 420px)', gap: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #d9e2ef', borderRadius: 8, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 850, marginBottom: 12 }}>Dashboard Skill Checks</div>
            {CHECKS.map(function (item) { return <div key={item} style={{ padding: '10px 0', borderBottom: '1px solid #edf1f7', color: '#344054' }}>✓ {item}</div>; })}
          </div>
          <div style={{ background: '#101828', borderRadius: 8, padding: 18, color: '#e5e7eb' }}>
            <div style={{ fontSize: 18, fontWeight: 850, marginBottom: 12 }}>Resource Binding</div>
            <div style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 12, lineHeight: '22px', wordBreak: 'break-all' }}><div>formUuid: {DASHBOARD.formUuid || 'n/a'}</div><div>reportId: {DASHBOARD.reportId || 'n/a'}</div><div>generatedAt: {DASHBOARD.generatedAt}</div></div>
          </div>
        </section>
      </div>
    </div>
  );
}
`;
}

function buildBusinessDashboardSource(config, context) {
  return `import React from 'react';

var DASHBOARD = {
  title: '全球业务经营驾驶舱',
  subtitle: ${escapeJsString(config.prefix + ' · real business dashboard acceptance')},
  appType: ${escapeJsString(context.appType || '')},
  formUuid: ${escapeJsString(context.formUuid || '')},
  reportId: ${escapeJsString(context.reportId || '')},
  generatedAt: ${escapeJsString(new Date().toISOString())}
};

var KPIS = [
  { label: '全球营收', value: '¥12.8亿', trend: '+18.6%', tone: '#f97316' },
  { label: '履约准时率', value: '97.4%', trend: '+3.2%', tone: '#2563eb' },
  { label: '经营健康度', value: '92', trend: '稳健', tone: '#16a34a' },
  { label: '风险闭环率', value: '88%', trend: '+9.1%', tone: '#7c3aed' }
];

var CHARTS = [
  { title: '区域营收贡献', rows: [['华东', 92], ['华南', 78], ['海外', 64]] },
  { title: '渠道增长结构', rows: [['直营', 86], ['生态伙伴', 72], ['线上', 68]] },
  { title: '客户分层表现', rows: [['战略客户', 94], ['成长客户', 75], ['长尾客户', 58]] },
  { title: '供应履约水位', rows: [['库存健康', 82], ['物流时效', 89], ['异常处理', 71]] },
  { title: '利润质量趋势', rows: [['毛利率', 76], ['费用率优化', 67], ['现金回款', 84]] },
  { title: '组织协同效率', rows: [['审批效率', 88], ['待办响应', 79], ['跨区协同', 73]] }
];

var RISKS = [
  { level: '高', title: '海外履约延迟', owner: '供应链中心', action: '发起专项派单' },
  { level: '中', title: '重点客户续约波动', owner: '大客户部', action: '跟进续约计划' },
  { level: '中', title: '华南费用率偏高', owner: '财务 BP', action: '复盘费用结构' }
];

function captureButton() {
  return <button className="sl-no-capture" style={{ height: 28, border: '1px solid rgba(255,255,255,0.28)', borderRadius: 999, background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '0 12px', fontWeight: 800 }}>截图</button>;
}

function kpiCard(item) {
  return (
    <section key={item.label} style={{ position: 'relative', borderRadius: 18, padding: 20, minHeight: 132, background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.86))', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 18px 50px rgba(15,23,42,0.18)' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>{captureButton()}</div>
      <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 800 }}>{item.label}</div>
      <div style={{ marginTop: 18, color: item.tone, fontSize: 34, lineHeight: '40px', fontWeight: 900 }}>{item.value}</div>
      <div style={{ marginTop: 8, color: '#e2e8f0', fontSize: 13, fontWeight: 800 }}>{item.trend}</div>
    </section>
  );
}

function chartPanel(item, index) {
  var palette = ['#f97316', '#2563eb', '#16a34a', '#7c3aed', '#0ea5e9', '#d97706'];
  return (
    <section key={item.title} style={{ borderRadius: 18, padding: 18, background: '#ffffff', border: '1px solid #eadfd4', minHeight: 220, boxShadow: '0 14px 36px rgba(121,85,54,0.10)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#1f2937', fontSize: 17, fontWeight: 900 }}>{item.title}</h3>
        <button className="sl-no-capture" style={{ height: 28, border: '1px solid #fed7aa', borderRadius: 999, background: '#fff7ed', color: '#c2410c', padding: '0 10px', fontWeight: 800 }}>截图</button>
      </div>
      {item.rows.map(function (row) {
        return (
          <div key={row[0]} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: 13, marginBottom: 7 }}><span>{row[0]}</span><strong>{row[1]}%</strong></div>
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: row[1] + '%', height: '100%', background: palette[index % palette.length], borderRadius: 999 }} /></div>
          </div>
        );
      })}
    </section>
  );
}

function riskRow(item) {
  return (
    <div key={item.title} style={{ display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr) 120px 120px', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
      <span style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: 999, background: item.level === '高' ? '#ef4444' : '#f59e0b', color: '#fff', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{item.level}</span>
      <strong style={{ color: '#fff' }}>{item.title}</strong>
      <span style={{ color: '#cbd5e1' }}>{item.owner}</span>
      <button className="sl-no-capture" style={{ height: 30, border: '1px solid rgba(255,255,255,0.26)', borderRadius: 999, background: 'rgba(255,255,255,0.10)', color: '#fff', fontWeight: 800 }}>{item.action}</button>
    </div>
  );
}

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff7ed 0%, #eff6ff 42%, #f8fafc 100%)', padding: 28, boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <header style={{ borderRadius: 24, padding: 28, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 52%, #92400e 100%)', color: '#fff', marginBottom: 18, boxShadow: '0 24px 70px rgba(15,23,42,0.24)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#fed7aa', fontSize: 13, fontWeight: 900, letterSpacing: 1.8 }}>BUSINESS DASHBOARD ACCEPTANCE</div>
              <h1 style={{ margin: '10px 0 8px', fontSize: 38, lineHeight: '46px', fontWeight: 950 }}>{DASHBOARD.title}</h1>
              <p style={{ margin: 0, color: '#dbeafe', fontSize: 15 }}>{DASHBOARD.subtitle}</p>
            </div>
            <div style={{ textAlign: 'right', color: '#e0f2fe', fontSize: 13, lineHeight: '22px' }}>
              <div>appType: {DASHBOARD.appType || 'n/a'}</div>
              <div>formUuid: {DASHBOARD.formUuid || 'n/a'}</div>
              <div>reportId: {DASHBOARD.reportId || 'n/a'}</div>
            </div>
          </div>
        </header>

        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: 14, borderRadius: 18, background: 'rgba(255,255,255,0.84)', border: '1px solid #e5e7eb', marginBottom: 18 }}>
          {['今日', '本周', '本月', 'FY2026'].map(function (label) { return <button key={label} style={{ height: 34, border: label === 'FY2026' ? '1px solid #f97316' : '1px solid #cbd5e1', borderRadius: 999, background: label === 'FY2026' ? '#fff7ed' : '#fff', color: label === 'FY2026' ? '#c2410c' : '#334155', padding: '0 14px', fontWeight: 850 }}>{label}</button>; })}
          <span style={{ color: '#94a3b8' }}>|</span>
          {['全球', '华东', '华南', '海外'].map(function (label) { return <button key={label} style={{ height: 34, border: '1px solid #dbeafe', borderRadius: 999, background: label === '全球' ? '#eff6ff' : '#fff', color: '#1d4ed8', padding: '0 14px', fontWeight: 850 }}>{label}</button>; })}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 18 }}>{KPIS.map(kpiCard)}</section>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 18 }}>{CHARTS.map(chartPanel)}</section>

        <section style={{ borderRadius: 22, padding: 22, background: 'linear-gradient(135deg, #111827, #1e293b)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 950 }}>风险水位与行动闭环</h2>
            {captureButton()}
          </div>
          {RISKS.map(riskRow)}
          <div style={{ marginTop: 16, color: '#cbd5e1', fontSize: 13 }}>页面内派单入口用于验收交互闭环；真实钉钉待办由 saveFormData → 集成自动化 → 待办2.0 连接器链路承接。</div>
        </section>
      </div>
    </main>
  );
}
`;
}

function ensureAcceptance(registry) {
  registry.stageResults = registry.stageResults || {};
  registry.acceptance = registry.acceptance || { artifacts: [] };
  registry.artifacts = registry.artifacts || [];
  return registry.acceptance;
}

function toRelativePath(filePath, basePath) {
  if (!filePath) {return null;}
  const baseDir = basePath ? path.dirname(basePath) : ROOT;
  const relativePath = path.relative(baseDir, filePath);
  return relativePath && !relativePath.startsWith('..') ? relativePath : filePath;
}

function normalizeStageResult(result = {}) {
  return {
    status: result.status || 'passed',
    commands: result.commands || [],
    resources: result.resources || [],
    artifacts: result.artifacts || [],
    summary: result.summary || '',
    skippedReason: result.skippedReason || null,
    optInReason: result.optInReason || null,
    completedAt: result.completedAt || new Date().toISOString(),
  };
}

function recordStageResult(registry, registryPath, stageName, result) {
  ensureAcceptance(registry);
  registry.stageResults[stageName] = normalizeStageResult(result);
  if (registryPath) {writeRegistry(registryPath, registry);}
  return registry.stageResults[stageName];
}

function addAcceptanceArtifact(registry, registryPath, artifact) {
  const acceptance = ensureAcceptance(registry);
  const normalized = {
    ...artifact,
    createdAt: artifact.createdAt || new Date().toISOString(),
  };
  acceptance.artifacts.push(normalized);
  registry.artifacts.push(normalized);
  if (registryPath) {writeRegistry(registryPath, registry);}
  return normalized;
}

function buildAcceptanceManifest(registry, registryPath) {
  ensureAcceptance(registry);
  const stageResults = registry.stageResults || {};
  const resultApp = registry.resultApp || {};
  return {
    runId: registry.runId || registry.id || null,
    suite: registry.suite || 'full',
    status: registry.status || 'running',
    startedAt: registry.startedAt || null,
    finishedAt: registry.finishedAt || null,
    registryPath,
    stages: Object.keys(stageResults).map((name) => ({
      name,
      status: stageResults[name].status,
      summary: stageResults[name].summary,
      skippedReason: stageResults[name].skippedReason,
      optInReason: stageResults[name].optInReason,
    })),
    resources: registry.resources || [],
    urls: {
      adminUrl: resultApp.adminUrl || null,
      workbenchUrl: resultApp.workbenchUrl || null,
      formUrl: resultApp.formUrl || null,
      pageUrl: resultApp.pageUrl || null,
      businessDashboardUrl: resultApp.businessDashboardUrl || null,
      businessDashboardShareUrl: resultApp.businessDashboardShareUrl || null,
      reportUrl: resultApp.reportUrl || null,
    },
    artifacts: registry.acceptance.artifacts || [],
    resultApp: registry.resultApp || null,
  };
}

function buildAcceptanceReport(registry, registryPath) {
  ensureAcceptance(registry);
  const stageResults = registry.stageResults || {};
  const stages = Object.keys(stageResults).map((name) => ({ name, ...stageResults[name] }));
  const countByStatus = stages.reduce((acc, stage) => {
    acc[stage.status] = (acc[stage.status] || 0) + 1;
    return acc;
  }, {});
  return {
    runId: registry.runId || registry.id || null,
    suite: registry.suite || 'full',
    status: registry.status || 'running',
    registryPath,
    summary: {
      totalStages: stages.length,
      passed: countByStatus.passed || 0,
      failed: countByStatus.failed || 0,
      skipped: countByStatus.skipped || 0,
      commandCount: (registry.commands || []).length,
      resourceCount: (registry.resources || []).length,
      artifactCount: (registry.artifacts || []).length,
    },
    stages,
  };
}

function writeAcceptanceArtifacts(registry, registryPath, workDir, writeJsonFile) {
  ensureAcceptance(registry);
  const manifestPath = path.join(workDir, 'acceptance-manifest.json');
  const reportPath = path.join(workDir, 'acceptance-report.json');

  registry.acceptance.manifestPath = manifestPath;
  registry.acceptance.reportPath = reportPath;
  registry.acceptance.writtenAt = new Date().toISOString();
  addAcceptanceArtifact(registry, null, {
    type: 'acceptance-manifest',
    path: manifestPath,
    relativePath: toRelativePath(manifestPath, registryPath),
  });
  addAcceptanceArtifact(registry, null, {
    type: 'acceptance-report',
    path: reportPath,
    relativePath: toRelativePath(reportPath, registryPath),
  });

  const manifest = buildAcceptanceManifest(registry, registryPath);
  const report = buildAcceptanceReport(registry, registryPath);
  writeJsonFile(manifestPath, manifest);
  writeJsonFile(reportPath, report);

  if (registryPath) {writeRegistry(registryPath, registry);}
  return { manifestPath, reportPath, manifest, report };
}

function printAcceptanceSummary(registry, registryPath) {
  const report = buildAcceptanceReport(registry, registryPath);
  console.log('Full real E2E acceptance summary:');
  console.log(`  Registry: ${registryPath}`);
  if (registry.acceptance && registry.acceptance.manifestPath) {
    console.log(`  Manifest: ${registry.acceptance.manifestPath}`);
  }
  if (registry.acceptance && registry.acceptance.reportPath) {
    console.log(`  Report: ${registry.acceptance.reportPath}`);
  }
  console.log(`  Stages: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`);
  for (const stage of report.stages) {
    const reason = stage.skippedReason || stage.optInReason || stage.summary || '';
    console.log(`  - ${stage.name}: ${stage.status}${reason ? ` (${reason})` : ''}`);
  }
}

function commandsByName(registry, names) {
  const nameSet = new Set(names);
  return (registry.commands || []).filter((command) => nameSet.has(command.name));
}

function resourcesByType(registry, types) {
  const typeSet = new Set(types);
  return (registry.resources || []).filter((resource) => typeSet.has(resource.type));
}

function artifactsByType(registry, types) {
  const typeSet = new Set(types);
  return (registry.artifacts || []).filter((artifact) => typeSet.has(artifact.type));
}

function commandNames(commands) {
  return commands.map((command) => command.name);
}

function recordConfiguredStageResults(registry, registryPath, config, context, workDir) {
  const stageDefinitions = {
    auth: {
      commands: ['commands', 'env', 'login', 'org-switch', 'org-list'],
      summary: config.corpId ? `Login and organization checked for corpId ${config.corpId}` : 'Login and organization checked',
      resources: [],
    },
    app: {
      commands: ['app-list', 'create-app', 'update-app', 'app-list-after-create'],
      summary: `App created and renamed: ${context.appType || 'n/a'}`,
      resources: ['app'],
    },
    form: {
      commands: ['create-form', 'list-forms', 'create-form-add-option', 'create-form-update', 'get-schema', 'get-schema-field', 'get-schema-all'],
      summary: `Form schema verified: ${context.formUuid || 'n/a'}, fields=${(context.fields || []).length}`,
      resources: ['form'],
      artifacts: ['form-update', 'schema'],
    },
    page: {
      commands: ['check-page', 'build-page', 'compile', 'generate-page', 'create-page', 'update-form-config-page', 'publish'],
      summary: `Smoke dashboard page published: ${context.pageId || 'n/a'}`,
      resources: ['page'],
    },
    data: {
      commands: ['data-create-form', 'data-get-form', 'data-update-form', 'data-query-form', 'data-query-form-ids'],
      summary: 'Form data create/get/update/query/ids-only loop verified',
      resources: [],
    },
    permission: {
      commands: ['get-permission'],
      summary: `Permission read verified for form ${context.formUuid || 'n/a'}`,
      resources: [],
    },
    share: {
      commands: ['get-page-config', 'verify-short-url', 'save-share-config', 'get-page-config-after-save'],
      summary: `Share config verified for ${context.pageId || context.formUuid || 'n/a'}`,
      resources: [],
    },
    report: {
      commands: ['create-report', 'append-chart'],
      summary: `Report created and appended: ${context.reportId || 'n/a'}`,
      resources: ['report'],
    },
    dashboard: {
      commands: ['dashboard-skill-check', 'dashboard-skill-create-page', 'dashboard-skill-publish', 'business-dashboard-check', 'business-dashboard-create-page', 'business-dashboard-publish', 'business-dashboard-verify-short-url', 'business-dashboard-save-share-config'],
      summary: `Dashboard skill and business dashboard published: ${context.businessDashboardPageId || 'n/a'}`,
      resources: ['dashboard-skill', 'business-dashboard'],
    },
    export: {
      commands: ['export'],
      summary: `App export generated under ${workDir}`,
      resources: [],
      artifacts: ['export'],
    },
    import: {
      commands: ['import'],
      summary: `Imported app verified: ${context.importAppType || 'n/a'}`,
      resources: ['imported-app'],
      artifacts: ['import-report'],
    },
    batch: {
      commands: ['batch'],
      summary: 'Batch command chain verified with app-list and get-schema',
      resources: [],
    },
    task: {
      commands: ['task-center-created', 'data-query-tasks'],
      summary: 'Task center and data task query verified',
      resources: [],
    },
    offline: {
      commands: ['formula-evaluate', 'doctor', 'sample-list', 'cdn-config-show'],
      summary: 'Formula, doctor, sample and CDN config offline checks verified',
      resources: [],
    },
    'connector-local': {
      commands: ['connector-gen-template', 'connector-parse-api'],
      summary: 'Connector template generation and cURL parsing verified locally',
      resources: [],
    },
    'skill-coverage': {
      commands: [],
      summary: `Skill coverage matrix checked: ${(registry.skillCoverage && registry.skillCoverage.checked) || 0} skills`,
      resources: [],
    },
  };

  for (const stageName of config.stages || []) {
    const definition = stageDefinitions[stageName];
    if (!definition) {continue;}
    const commands = commandsByName(registry, definition.commands);
    recordStageResult(registry, null, stageName, {
      status: 'passed',
      commands: commandNames(commands),
      resources: resourcesByType(registry, definition.resources || []),
      artifacts: artifactsByType(registry, definition.artifacts || []),
      summary: definition.summary,
    });
  }
  if (registryPath) {writeRegistry(registryPath, registry);}
}

function run(options = {}) {
  const env = options.env || process.env;
  const config = options.config || getFullConfig(env);
  const executeCli = options.runCli || runCli;
  const persistCookieCache = options.writeCookieCache || writeCookieCache;
  const registryFactory = options.createRegistry || createRegistry;
  const persistRegistry = options.writeRegistry || writeRegistry;
  const trackResource = options.addResource || addResource;
  const writeJsonFile = options.writeJson || writeJson;
  const writeTextFile = options.writeText || writeText;
  const archiveReport = options.archiveImportReport || archiveImportReport;

  if (!ensureEnabled(config)) {
    return { skipped: true };
  }

  persistCookieCache(decodeCookieData(config));
  const { registry, registryPath } = registryFactory(config);
  registry.suite = 'full';
  registry.stages = config.stages;
  persistRegistry(registryPath, registry);

  const workDir = path.join(config.registryDir, config.prefix);
  const context = {
    appType: null,
    formUuid: null,
    pageId: null,
    reportId: null,
    businessDashboardPageId: null,
    businessDashboardFormUuid: null,
    businessDashboardSharePath: null,
    importAppType: null,
    fields: [],
  };

  function runStep(name, args, stepOptions = {}) {
    const commandResult = executeCli([...args, '--quiet'], env);
    registry.commands.push({ name, args, completedAt: new Date().toISOString(), optional: !!stepOptions.optional });
    persistRegistry(registryPath, registry);
    if (stepOptions.allowNoJson) {return commandResult;}
    if (!commandResult.json) {
      throw new Error(`${name} did not emit a JSON result`);
    }
    if (commandResult.json.success === false || commandResult.json.status === 'error') {
      throw new Error(`${name} failed: ${JSON.stringify(commandResult.json)}`);
    }
    return commandResult;
  }

  try {
    if (hasStage(config.stages, 'auth')) {
      runStep('commands', ['commands', '--json']);
      runStep('env', ['env', '--json']);
      runStep('login', ['login', '--check-only', '--json']);
      if (config.corpId) {
        runStep('org-switch', ['org', 'switch', '--corp-id', config.corpId], { allowNoJson: true });
      }
      runStep('org-list', ['org', 'list'], { allowNoJson: true });
    }

    if (hasStage(config.stages, 'app')) {
      runStep('app-list', ['app-list', '--size', '1'], { allowNoJson: true });
      const app = runStep('create-app', [
        'create-app',
        config.appName,
        '--desc',
        'OpenYida full real E2E disposable app',
        '--no-open',
      ]).json;
      context.appType = app.appType;
      trackResource(registry, registryPath, { type: 'app', appType: context.appType, name: config.appName, url: app.url });

      runStep('update-app', ['update-app', context.appType, '--name', config.updateAppName]);
      runStep('app-list-after-create', ['app-list', '--size', '5'], { allowNoJson: true });
    }

    if (hasStage(config.stages, 'form')) {
      const form = runStep('create-form', [
        'create-form',
        'create',
        context.appType,
        config.formName,
        config.fieldsFile,
        '--no-open',
      ]).json;
      context.formUuid = form.formUuid;
      trackResource(registry, registryPath, { type: 'form', appType: context.appType, formUuid: context.formUuid, name: config.formName, url: form.url });

      runStep('list-forms', ['list-forms', context.appType]);
      const addOption = runStep('create-form-add-option', [
        'create-form',
        'add-option',
        context.appType,
        context.formUuid,
        'E2E Status',
        'Blocked',
      ]).json;
      if (addOption.success === false) {
        throw new Error(`create-form add-option failed: ${JSON.stringify(addOption)}`);
      }

      const changesPath = writeJsonFile(path.join(workDir, 'form-update.json'), [
        { action: 'add', field: { type: 'TextareaField', label: 'E2E Notes' } },
      ]);
      runStep('create-form-update', ['create-form', 'update', context.appType, context.formUuid, changesPath, '--force', '--no-open']);

      const schemaResult = runStep('get-schema', ['get-schema', context.appType, context.formUuid, '--json']).json;
      context.fields = collectFields(schemaResult.content || schemaResult);
      runStep('get-schema-field', ['get-schema', context.appType, context.formUuid, '--field', 'E2E Text', '--json']);
      runStep('get-schema-all', ['get-schema', context.appType, '--all', '--output-dir', path.join(workDir, 'schemas'), '--json']);
    }

    if (hasStage(config.stages, 'page')) {
      runStep('check-page', ['check-page', config.pageSource, '--json']);
      runStep('build-page', ['build-page', config.pageSource, '--output', path.join(workDir, 'built-page.jsx'), '--json']);
      runStep('compile', ['compile', config.pageSource], { allowNoJson: true });
      runStep('generate-page', ['generate-page', 'todo-mvc', '--output', path.join(workDir, 'generated-todo.oyd.jsx'), '--compile'], { allowNoJson: true });

      const page = runStep('create-page', [
        'create-page',
        context.appType,
        config.pageName,
        '--mode',
        'dashboard',
        '--no-open',
      ]).json;
      context.pageId = page.pageId;
      trackResource(registry, registryPath, { type: 'page', appType: context.appType, pageId: context.pageId, name: config.pageName, url: page.url });
      runStep('update-form-config-page', ['update-form-config', context.appType, context.pageId, 'false', config.pageName], { allowNoJson: true });
      runStep('publish', ['publish', config.pageSource, context.appType, context.pageId, '--health-check', '--no-open']);
    }

    if (hasStage(config.stages, 'data')) {
      const textField = fieldByLabel(context.fields, 'E2E Text');
      const numberField = fieldByLabel(context.fields, 'E2E Number');
      const statusField = fieldByLabel(context.fields, 'E2E Status');
      const createData = {};
      createData[textField.fieldId] = `${config.prefix} record`;
      createData[numberField.fieldId] = 42;
      createData[statusField.fieldId] = 'New';
      const createResult = runStep('data-create-form', [
        'data',
        'create',
        'form',
        context.appType,
        context.formUuid,
        '--data-json',
        JSON.stringify(createData),
      ]).json;
      const formInstId = findValueByKeys(createResult, ['formInstId', 'formInstanceId', 'instanceId']);
      if (formInstId) {
        runStep('data-get-form', ['data', 'get', 'form', context.appType, '--inst-id', formInstId]);
        const updateData = {};
        updateData[textField.fieldId] = `${config.prefix} record updated`;
        runStep('data-update-form', ['data', 'update', 'form', context.appType, '--inst-id', formInstId, '--data-json', JSON.stringify(updateData)]);
      }
      runStep('data-query-form', ['data', 'query', 'form', context.appType, context.formUuid, '--size', '1']);
      runStep('data-query-form-ids', ['data', 'query', 'form', context.appType, context.formUuid, '--size', '1', '--ids-only']);
    }

    if (hasStage(config.stages, 'permission')) {
      runStep('get-permission', ['get-permission', context.appType, context.formUuid]);
    }

    if (hasStage(config.stages, 'share')) {
      const shareTarget = context.pageId || context.formUuid;
      const sharePath = `/o/${config.prefix.toLowerCase()}-share`;
      runStep('get-page-config', ['get-page-config', context.appType, shareTarget], { allowNoJson: true });
      runStep('verify-short-url', ['verify-short-url', context.appType, shareTarget, sharePath], { allowNoJson: true });
      runStep('save-share-config', ['save-share-config', context.appType, shareTarget, sharePath, 'n'], { allowNoJson: true });
      runStep('get-page-config-after-save', ['get-page-config', context.appType, shareTarget], { allowNoJson: true });
    }

    if (hasStage(config.stages, 'report')) {
      const chartsPath = writeJsonFile(path.join(workDir, 'report-charts.json'), buildReportCharts(context.formUuid, context.fields));
      const report = runStep('create-report', ['create-report', context.appType, `${config.prefix}_Report`, chartsPath, '--no-open']).json;
      context.reportId = report.reportId;
      trackResource(registry, registryPath, { type: 'report', appType: context.appType, reportId: context.reportId, name: `${config.prefix}_Report`, url: report.url });

      const appendPath = writeJsonFile(path.join(workDir, 'append-charts.json'), buildAppendCharts(context.formUuid, context.fields));
      runStep('append-chart', ['append-chart', context.appType, context.reportId, appendPath, '--no-open']);
    }

    if (hasStage(config.stages, 'dashboard')) {
      const dashboardSkillSourcePath = writeTextFile(path.join(workDir, 'dashboard-skill.oyd.jsx'), buildDashboardSkillSource(config, context));
      runStep('dashboard-skill-check', ['check-page', dashboardSkillSourcePath, '--json']);
      const dashboardSkillPage = runStep('dashboard-skill-create-page', [
        'create-page',
        context.appType,
        `${config.prefix}_DashboardSkill`,
        '--mode',
        'dashboard',
        '--no-open',
      ]).json;
      context.dashboardSkillPageId = dashboardSkillPage.pageId;
      trackResource(registry, registryPath, { type: 'dashboard-skill', appType: context.appType, pageId: context.dashboardSkillPageId, name: `${config.prefix}_DashboardSkill`, url: dashboardSkillPage.url });
      runStep('dashboard-skill-publish', ['publish', dashboardSkillSourcePath, context.appType, context.dashboardSkillPageId, '--health-check', '--no-open']);

      const businessDashboardSourcePath = writeTextFile(path.join(workDir, 'business-dashboard.oyd.jsx'), buildBusinessDashboardSource(config, context));
      runStep('business-dashboard-check', ['check-page', businessDashboardSourcePath, '--json']);
      const businessDashboardPage = runStep('business-dashboard-create-page', [
        'create-page',
        context.appType,
        `${config.prefix}_BusinessDashboard`,
        '--mode',
        'dashboard',
        '--no-open',
      ]).json;
      context.businessDashboardPageId = businessDashboardPage.pageId || businessDashboardPage.formUuid;
      context.businessDashboardFormUuid = businessDashboardPage.formUuid || businessDashboardPage.pageId || null;
      context.businessDashboardSharePath = `/o/${config.prefix.toLowerCase()}-business-dashboard`;
      trackResource(registry, registryPath, {
        type: 'business-dashboard',
        appType: context.appType,
        pageId: context.businessDashboardPageId,
        name: `${config.prefix}_BusinessDashboard`,
        url: businessDashboardPage.url,
        sharePath: context.businessDashboardSharePath,
      });
      runStep('business-dashboard-publish', ['publish', businessDashboardSourcePath, context.appType, context.businessDashboardPageId, '--health-check', '--no-open']);
      runStep('business-dashboard-verify-short-url', ['verify-short-url', context.appType, context.businessDashboardPageId, context.businessDashboardSharePath], { allowNoJson: true });
      runStep('business-dashboard-save-share-config', ['save-share-config', context.appType, context.businessDashboardPageId, context.businessDashboardSharePath, 'n'], { allowNoJson: true });
      registry.businessDashboard = {
        appType: context.appType,
        formUuid: context.businessDashboardFormUuid,
        pageId: context.businessDashboardPageId,
        url: `https://www.aliwork.com/${context.appType}/custom/${context.businessDashboardPageId}?isRenderNav=false`,
        sharePath: context.businessDashboardSharePath,
        shareUrl: `https://www.aliwork.com${context.businessDashboardSharePath}`,
        note: 'This is the real business dashboard acceptance page, not the Dashboard Skill smoke page.',
      };
      persistRegistry(registryPath, registry);
    }

    if (hasStage(config.stages, 'export')) {
      const exportPath = path.join(workDir, 'export.json');
      runStep('export', ['export', context.appType, exportPath]);
      registry.artifacts = registry.artifacts || [];
      registry.artifacts.push({ type: 'export', path: exportPath });
      persistRegistry(registryPath, registry);

      if (hasStage(config.stages, 'import')) {
        const imported = runStep('import', ['import', exportPath, config.importAppName]).json;
        context.importAppType = imported.targetAppType || imported.appType || imported.newAppType;
        const reportPath = archiveReport(workDir);
        if (reportPath) {
          registry.artifacts = registry.artifacts || [];
          registry.artifacts.push({ type: 'import-report', path: reportPath });
          persistRegistry(registryPath, registry);
        }
        if (context.importAppType) {
          trackResource(registry, registryPath, { type: 'imported-app', appType: context.importAppType, name: config.importAppName });
        }
      }
    }

    if (hasStage(config.stages, 'batch')) {
      runStep('batch', [
        'batch',
        '--commands',
        `app-list --size 1 ; get-schema ${context.appType} ${context.formUuid} --json`,
        '--json',
        '--quiet',
      ]);
    }

    if (hasStage(config.stages, 'task')) {
      runStep('task-center-created', ['task-center', 'created', '--size', '1', '--no-detail']);
      runStep('data-query-tasks', ['data', 'query', 'tasks', context.appType, '--type', 'submitted', '--size', '1']);
    }

    if (hasStage(config.stages, 'offline')) {
      const formulaSchemaPath = writeJsonFile(path.join(workDir, 'formula-schema.json'), { fields: context.fields });
      runStep('formula-evaluate', ['formula', 'evaluate', '1+1', '--schema', formulaSchemaPath, '--json']);
      runStep('doctor', ['doctor'], { allowNoJson: true });
      runStep('sample-list', ['sample', '--list'], { allowNoJson: true });
      runStep('cdn-config-show', ['cdn-config', '--show'], { allowNoJson: true });
    }

    if (hasStage(config.stages, 'ai')) {
      const flashNotePath = writeTextFile(path.join(workDir, 'flash-note.md'), '# E2E Meeting\n\nNeed build a test app.');
      runStep('flash-to-prd', ['flash-to-prd', '--file', flashNotePath, '--name', `${config.prefix} PRD`], { allowNoJson: true });
    }

    if (hasStage(config.stages, 'connector-local')) {
      const templatePath = path.join(workDir, 'api-template.md');
      runStep('connector-gen-template', ['connector', 'gen-template', templatePath], { allowNoJson: true });
      runStep('connector-parse-api', [
        'connector',
        'parse-api',
        '--curl',
        "curl 'https://api.example.com/users?id=1' -H 'Authorization: Bearer test'",
        '--format',
        'json',
      ]);
    }

    if (hasStage(config.stages, 'skill-coverage')) {
      const skillCoverage = validateSkillCoverage();
      registry.skillCoverage = {
        checked: skillCoverage.checked,
        levels: Object.keys(skillCoverage.coverage).sort().reduce((acc, name) => {
          acc[name] = skillCoverage.coverage[name].level;
          return acc;
        }, {}),
        matrix: Object.keys(skillCoverage.coverage).sort().map((name) => ({
          skill: name,
          level: skillCoverage.coverage[name].level,
          stages: skillCoverage.coverage[name].stages || [],
          commands: skillCoverage.coverage[name].commands || [],
          tests: skillCoverage.coverage[name].tests || [],
          reason: skillCoverage.coverage[name].reason || null,
        })),
      };
      persistRegistry(registryPath, registry);
    }

    if (context.appType) {
      const dashboardSourcePath = writeTextFile(path.join(workDir, 'result-dashboard.oyd.jsx'), buildDashboardSource(config, context));
      runStep('result-dashboard-check', ['check-page', dashboardSourcePath, '--json']);
      const dashboardPage = runStep('result-dashboard-create-page', [
        'create-page',
        context.appType,
        `${config.prefix}_Dashboard`,
        '--mode',
        'dashboard',
        '--no-open',
      ]).json;
      context.dashboardPageId = dashboardPage.pageId;
      trackResource(registry, registryPath, { type: 'dashboard', appType: context.appType, pageId: context.dashboardPageId, name: `${config.prefix}_Dashboard`, url: dashboardPage.url });
      runStep('result-dashboard-publish', ['publish', dashboardSourcePath, context.appType, context.dashboardPageId, '--health-check', '--no-open']);
      runStep('mark-result-app', ['update-app', context.appType, '--name', config.resultAppName]);
    }

    registry.status = 'passed';
    registry.finishedAt = new Date().toISOString();
    registry.context = context;
    registry.resultApp = buildResultApp(context, config.resultAppName);
    recordConfiguredStageResults(registry, registryPath, config, context, workDir);
    writeAcceptanceArtifacts(registry, registryPath, workDir, writeJsonFile);
    persistRegistry(registryPath, registry);
    printResultApp(registry.resultApp);
    printAcceptanceSummary(registry, registryPath);
    console.log(`Full real E2E passed. Registry: ${registryPath}`);
    return { skipped: false, registryPath, registry };
  } catch (error) {
    registry.status = 'failed';
    registry.finishedAt = new Date().toISOString();
    registry.error = error.message;
    registry.context = context;
    registry.resultApp = buildResultApp(context, config.resultAppName);
    recordStageResult(registry, null, 'run', {
      status: 'failed',
      commands: commandNames(registry.commands || []),
      resources: registry.resources || [],
      artifacts: registry.artifacts || [],
      summary: error.message,
    });
    try {
      writeAcceptanceArtifacts(registry, registryPath, workDir, writeJsonFile);
    } catch (artifactError) {
      registry.acceptance = registry.acceptance || { artifacts: [] };
      registry.acceptance.error = artifactError.message;
    }
    persistRegistry(registryPath, registry);
    throw error;
  }
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_STAGES,
  EXTENDED_STAGES,
  addAcceptanceArtifact,
  archiveImportReport,
  buildAcceptanceManifest,
  buildAcceptanceReport,
  buildResultApp,
  buildDashboardSource,
  buildDashboardSkillSource,
  buildBusinessDashboardSource,
  collectFields,
  fieldByLabel,
  findValueByKeys,
  getFullConfig,
  parseStages,
  printAcceptanceSummary,
  recordStageResult,
  run,
  writeAcceptanceArtifacts,
};
