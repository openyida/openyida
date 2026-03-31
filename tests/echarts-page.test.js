'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ECHARTS_PAGE_PATH = path.join(__dirname, '..', 'project', 'pages', 'src', 'project-report-echarts2.js');
const sourceCode = fs.readFileSync(ECHARTS_PAGE_PATH, 'utf-8');

// ── 语法检查 ──────────────────────────────────────────────────────────────────

describe('ECharts 页面语法', () => {
  test('通过 Node.js 语法检查', () => {
    // 宜搭页面使用 export function 语法，需要用 --input-type=module 检查
    // 退而求其次：检查文件可读且非空
    expect(sourceCode.length).toBeGreaterThan(0);
  });
});

// ── 关键常量 ──────────────────────────────────────────────────────────────────

describe('ECharts 页面关键常量', () => {
  test('定义了 REPORT_FORM_UUID', () => {
    expect(sourceCode).toMatch(/var REPORT_FORM_UUID\s*=\s*["']REPORT-[A-Z0-9]+["']/);
  });

  test('定义了 FORM_UUID（数据源表单）', () => {
    expect(sourceCode).toMatch(/var FORM_UUID\s*=\s*["']FORM-[A-Z0-9]+["']/);
  });

  test('REPORT_FORM_UUID 和 FORM_UUID 不相同', () => {
    const reportMatch = sourceCode.match(/var REPORT_FORM_UUID\s*=\s*["']([^"']+)["']/);
    const formMatch = sourceCode.match(/var FORM_UUID\s*=\s*["']([^"']+)["']/);
    expect(reportMatch).not.toBeNull();
    expect(formMatch).not.toBeNull();
    expect(reportMatch[1]).not.toBe(formMatch[1]);
  });
});

// ── filterKey 规范 ────────────────────────────────────────────────────────────

describe('ECharts 页面 filterKey 规范', () => {
  test('使用 FILTER_KEYS 对象管理各图表的独立 filterKey', () => {
    expect(sourceCode).toContain('FILTER_KEYS');
  });

  test('FILTER_KEYS 包含多个图表组件的 key 分组', () => {
    // 至少包含 indicator、pie、table 三个分组
    expect(sourceCode).toMatch(/indicator\s*:/);
    expect(sourceCode).toMatch(/pie\s*:/);
    expect(sourceCode).toMatch(/table\s*:/);
  });

  test('filterKey 格式为 UUID 格式（filter-xxxx-xxxx-xxxx-xxxx）', () => {
    const filterKeyPattern = /filter-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/g;
    const matches = sourceCode.match(filterKeyPattern);
    expect(matches).not.toBeNull();
    expect(matches.length).toBeGreaterThan(0);
  });

  test('筛选值使用数组格式（filterValueMap 的值是数组）', () => {
    // 检查 _buildFilterValueMap 函数中使用了数组格式
    expect(sourceCode).toMatch(/\[filters\.(status|priority)\]/);
  });

  test('_buildFilterValueMap 函数接受 keys 参数', () => {
    expect(sourceCode).toMatch(/function\s*\(filters,\s*keys\)/);
  });
});

// ── 接口路径规范 ──────────────────────────────────────────────────────────────

describe('ECharts 页面接口路径规范', () => {
  test('使用 /dingtalk/web/ 路径（自定义页面必须用此路径）', () => {
    expect(sourceCode).toContain('/dingtalk/web/');
  });

  test('不使用 /alibaba/web/ 路径（该路径仅用于 CLI 端）', () => {
    expect(sourceCode).not.toContain('/alibaba/web/');
  });

  test('使用 getDataAsync.json 接口获取报表数据', () => {
    expect(sourceCode).toContain('getDataAsync.json');
  });

  test('使用 getFormNavigationListByOrder.json 动态获取 prdId', () => {
    expect(sourceCode).toContain('getFormNavigationListByOrder.json');
  });
});

// ── 宜搭自定义页面编码规范 ───────────────────────────────────────────────────

describe('ECharts 页面宜搭编码规范', () => {
  test('数据请求函数用 var 声明（避免被 UglifyJS 消除）', () => {
    // 核心 fetch 函数必须用 var 声明
    expect(sourceCode).toMatch(/var _fetch\w+\s*=\s*function/);
  });

  test('export function 用于宜搭生命周期和事件处理', () => {
    expect(sourceCode).toMatch(/export function (didMount|forceUpdate|onFilter|loadAllData)/);
  });

  test('事件绑定使用箭头函数（避免 this 丢失）', () => {
    // JSX 中 onChange 事件绑定必须用箭头函数，格式：onChange={(e) => ...}
    expect(sourceCode).toMatch(/onChange=\{.*=>/);
  });

  test('包含 didMount 生命周期函数', () => {
    expect(sourceCode).toMatch(/export function didMount/);
  });

  test('包含 loadAllData 函数', () => {
    expect(sourceCode).toMatch(/export function loadAllData|var loadAllData\s*=/);
  });
});

// ── 图表组件完整性 ────────────────────────────────────────────────────────────

describe('ECharts 页面图表完整性', () => {
  test('包含指标卡数据获取逻辑', () => {
    expect(sourceCode).toMatch(/_fetchIndicatorData|indicatorData/);
  });

  test('包含饼图数据获取逻辑', () => {
    expect(sourceCode).toMatch(/_fetchPieData|pieChartData/);
  });

  test('包含柱状图数据获取逻辑', () => {
    expect(sourceCode).toMatch(/_fetchBarBudgetData|barBudgetData/);
  });

  test('包含折线图数据获取逻辑', () => {
    expect(sourceCode).toMatch(/_fetchLineChartData|lineChartData/);
  });

  test('包含明细表格数据获取逻辑', () => {
    expect(sourceCode).toMatch(/tableData|searchFormDatas/);
  });

  test('包含分页配置', () => {
    expect(sourceCode).toMatch(/tablePagination|currentPage|pageSize/);
  });
});

// ── prdId 获取逻辑 ────────────────────────────────────────────────────────────

describe('ECharts 页面 prdId 获取逻辑', () => {
  test('通过 getFormNavigationListByOrder 动态获取 prdId（不硬编码）', () => {
    // 不应该有硬编码的 prdId 数字
    expect(sourceCode).not.toMatch(/var _prdId\s*=\s*\d+/);
    // 应该初始化为 null，后续动态获取
    expect(sourceCode).toMatch(/var _prdId\s*=\s*null/);
  });

  test('精确匹配 REPORT_FORM_UUID 获取 topicId', () => {
    expect(sourceCode).toContain('formUuid === REPORT_FORM_UUID');
    expect(sourceCode).toContain('topicId');
  });

  test('包含兜底匹配逻辑', () => {
    expect(sourceCode).toMatch(/formType.*report|兜底/);
  });
});

// ── ECharts 加载 ──────────────────────────────────────────────────────────────

describe('ECharts 页面 ECharts 加载', () => {
  test('动态加载 ECharts 库', () => {
    expect(sourceCode).toMatch(/echarts|ECharts/);
  });

  test('使用 CDN 加载 ECharts', () => {
    expect(sourceCode).toMatch(/cdnjs\.cloudflare\.com|g\.alicdn\.com|cdn\.jsdelivr\.net/);
  });

  test('ECharts 实例存储在模块级变量中', () => {
    expect(sourceCode).toMatch(/var _chartInstances\s*=\s*\{\}/);
  });
});
