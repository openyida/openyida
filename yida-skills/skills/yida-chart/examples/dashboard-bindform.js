// ============================================================
// 宜搭报表 Dashboard 示例（基于 getDataAsync.json 后端聚合）
// 多图表看板（柱状图 + 饼图 + 折线图 + 统计卡片）
//
// 数据源配置：
//   PRD_ID: 13085982
//   REPORT_UUID: REPORT-0R8665A1ED54RG45IJWIX55W9Q8U2U6AH9XMM1
//   appType: APP_KNILKT41DC5XXR5D4QEC
//
// 报表组件：
//   - totalCount: 项目总数
//   - totalBudget: 预算总计
//   - avgProgress: 平均进度
//   - statusTable: 状态分布（用于柱状图和饼图）
//   - budgetTable: 预算分布（用于折线图）
// ============================================================

// ----- 配置区 -----
var ECHARTS_CDN = 'https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js';
var PRD_ID = '13085982';
var REPORT_UUID = 'REPORT-0R8665A1ED54RG45IJWIX55W9Q8U2U6AH9XMM1';

// ----- 报表组件配置 -----
var REPORT_COMPONENTS = {
  totalCount: { cid: 'YoushuSimpleIndicatorCard_mmx9ha69i', className: 'YoushuSimpleIndicatorCard', dataSetKey: 'youshuData' },
  totalBudget: { cid: 'YoushuSimpleIndicatorCard_mmx9ha69l', className: 'YoushuSimpleIndicatorCard', dataSetKey: 'youshuData' },
  avgProgress: { cid: 'YoushuSimpleIndicatorCard_mmx9ha6ao', className: 'YoushuSimpleIndicatorCard', dataSetKey: 'youshuData' },
  statusTable: { cid: 'YoushuTable_mmx9ha6ar', className: 'YoushuTable', dataSetKey: 'table' },
  budgetTable: { cid: 'YoushuTable_mmx9ha6a13', className: 'YoushuTable', dataSetKey: 'table' },
};

// ----- 筛选器配置 -----
var FILTER_KEYS = {
  status: 'filter-64d734db-c105-4372-ad2a-7833427d965b',
  priority: 'filter-1e6ace6c-10cf-4da4-bbdd-d433af52b9dc',
};

// ----- 颜色主题 -----
var STATUS_COLORS = { '规划中': '#6366f1', '进行中': '#0ea5e9', '已完成': '#059669', '已延期': '#d97706', '已取消': '#94a3b8' };
var PALETTE = {
  primary: '#1e40af',
  primaryLight: '#3b82f6',
  accent: '#0ea5e9',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  neutral: '#64748b',
  bg: '#f8fafc',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
};

// ============================================================
// 状态管理
// ============================================================

var _customState = {
  loading: true,
  totalCount: 0,
  totalBudget: 0,
  avgProgress: 0,
  statusData: [],
  budgetData: [],
  chartIds: ['chart-bar', 'chart-pie', 'chart-line'],
};

export function getCustomState(key) {
  if (key) return _customState[key];
  return Object.assign({}, _customState);
}

export function setCustomState(newState) {
  Object.keys(newState).forEach(function(key) {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

// ============================================================
// 生命周期
// ============================================================

export function didMount() {
  this.loadECharts();
}

export function didUnmount() {
  var chartIds = _customState.chartIds || [];
  chartIds.forEach(function(domId) {
    var container = document.getElementById(domId);
    if (container) {
      var instance = window.echarts.getInstanceByDom(container);
      if (instance) instance.dispose();
    }
  });
  if (this._resizeHandler) {
    window.removeEventListener('resize', this._resizeHandler);
  }
}

// ============================================================
// ECharts 加载
// ============================================================

export function loadECharts() {
  if (window.echarts) {
    this.bindChartResize();
    this.loadDashboardData();
    return;
  }
  this.utils.loadScript(ECHARTS_CDN)
    .then(function() {
      this.bindChartResize();
      this.loadDashboardData();
    }.bind(this))
    .catch(function() {
      this.utils.toast({ title: 'ECharts 加载失败，请刷新重试', type: 'error' });
      this.setCustomState({ loading: false });
    }.bind(this));
}

export function bindChartResize() {
  this._resizeHandler = function() {
    var chartIds = _customState.chartIds || [];
    chartIds.forEach(function(domId) {
      var container = document.getElementById(domId);
      if (container) {
        var instance = window.echarts.getInstanceByDom(container);
        if (instance) instance.resize();
      }
    });
  }.bind(this);
  window.addEventListener('resize', this._resizeHandler);
}

// ============================================================
// 数据获取（基于 getDataAsync.json 后端聚合）
// ============================================================

/**
 * 获取报表数据（使用 var 声明，避免被 UglifyJS 消除）
 */
var _fetchReportData = function(componentConfig, filterValueMap) {
  var appType = window.pageConfig && window.pageConfig.appType;
  var csrfToken = window.g_config && window.g_config._csrf_token;
  var queryContext = {
    aliasList: [],
    filterValueMap: filterValueMap || {},
    dim2table: true,
    orderByList: [],
    needTotalCount: componentConfig.className === 'YoushuTable',
    variableParams: {},
    paging: { start: 0, limit: 100 },
  };
  var body = new URLSearchParams({
    timezone: 'GMT+8',
    _tb_token_: csrfToken, _csrf_token: csrfToken, _csrf: csrfToken,
    prdId: PRD_ID,
    pageId: REPORT_UUID,
    pageName: 'report',
    cid: componentConfig.cid,
    cname: '',
    componentClassName: componentConfig.className,
    queryContext: JSON.stringify(queryContext),
    dataSetKey: componentConfig.dataSetKey,
    enabledCache: 'true',
    queryTimestamp: String(Date.now()),
    appendTraceId: 'true',
  });
  var url = '/alibaba/web/' + appType + '/visual/visualizationDataRpc/getDataAsync.json?_api=EDataService.getDataAsync&_mock=false&_stamp=' + Date.now();
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'accept': 'application/json, text/json', 'x-requested-with': 'XMLHttpRequest' },
    body: body.toString(),
    credentials: 'include',
  }).then(function(r) { return r.json(); })
    .then(function(result) {
      if (result.success && result.content) return result.content;
      throw new Error(result.errorMsg || '报表数据获取失败');
    });
};

/**
 * 解析表格数据
 */
var _parseTableData = function(content) {
  var data = content.data || content.dataList || [];
  var meta = content.meta || [];
  if (data.length === 0) return [];
  var dimField = null;
  var measureField = null;
  if (meta.length >= 2) {
    dimField = meta[0].alias;
    measureField = meta[1].alias;
  } else if (data.length > 0) {
    var firstRow = data[0];
    Object.keys(firstRow).forEach(function(key) {
      if (typeof firstRow[key] === 'string' && !dimField) dimField = key;
      else if (typeof firstRow[key] === 'number' && !measureField) measureField = key;
    });
  }
  if (!dimField || !measureField) return [];
  var result = [];
  data.forEach(function(row) {
    if (row[dimField] != null) {
      result.push({ name: String(row[dimField]), value: Number(row[measureField]) || 0 });
    }
  });
  return result;
};

/**
 * 解析指标值
 */
var _parseIndicatorValue = function(content) {
  var data = content.data || content.dataList || [];
  if (data.length === 0) return null;
  var firstRow = data[0];
  var keys = Object.keys(firstRow);
  for (var i = 0; i < keys.length; i++) {
    if (typeof firstRow[keys[i]] === 'number') return firstRow[keys[i]];
  }
  return keys.length > 0 ? firstRow[keys[0]] : null;
};

export function loadDashboardData() {
  this.setCustomState({ loading: true });

  // 并行获取所有报表组件数据
  Promise.all([
    _fetchReportData(REPORT_COMPONENTS.totalCount),
    _fetchReportData(REPORT_COMPONENTS.totalBudget),
    _fetchReportData(REPORT_COMPONENTS.avgProgress),
    _fetchReportData(REPORT_COMPONENTS.statusTable),
    _fetchReportData(REPORT_COMPONENTS.budgetTable),
  ])
  .then(function(results) {
    this.setCustomState({
      loading: false,
      totalCount: _parseIndicatorValue(results[0]) || 0,
      totalBudget: _parseIndicatorValue(results[1]) || 0,
      avgProgress: _parseIndicatorValue(results[2]) || 0,
      statusData: _parseTableData(results[3]),
      budgetData: _parseTableData(results[4]),
    });

    // 渲染图表（需要延迟一帧确保 DOM 更新完成）
    setTimeout(function() {
      this.renderAllCharts();
    }.bind(this), 100);
  }.bind(this))
  .catch(function(error) {
    this.utils.toast({ title: '数据加载失败: ' + error.message, type: 'error' });
    this.setCustomState({ loading: false });
  }.bind(this));
}

// ============================================================
// 图表渲染
// ============================================================

export function renderAllCharts() {
  if (!window.echarts) return;
  this.renderBarChart();
  this.renderPieChart();
  this.renderLineChart();
}

export function createChart(domId) {
  var container = document.getElementById(domId);
  if (!container) return null;
  var existingInstance = window.echarts.getInstanceByDom(container);
  if (existingInstance) existingInstance.dispose();
  return window.echarts.init(container);
}

export function renderBarChart() {
  var chart = this.createChart('chart-bar');
  if (!chart) return;

  var statusData = _customState.statusData || [];
  var categories = statusData.map(function(item) { return item.name; });
  var values = statusData.map(function(item) { return item.value; });

  chart.setOption({
    title: { text: '状态统计', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        rotate: categories.length > 6 ? 30 : 0,
        fontSize: this.utils.isMobile() ? 10 : 12,
      },
    },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: values,
      itemStyle: {
        color: function(params) {
          var statusName = categories[params.dataIndex];
          return STATUS_COLORS[statusName] || PALETTE.primary;
        },
      },
      barMaxWidth: 40,
    }],
    grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
  });
}

export function renderPieChart() {
  var chart = this.createChart('chart-pie');
  if (!chart) return;

  var statusData = _customState.statusData || [];
  var pieData = statusData.map(function(item) {
    return {
      name: item.name,
      value: item.value,
      itemStyle: { color: STATUS_COLORS[item.name] || PALETTE.primary },
    };
  });

  chart.setOption({
    title: { text: '状态占比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}: {d}%', fontSize: this.utils.isMobile() ? 10 : 12 },
      data: pieData,
    }],
  });
}

export function renderLineChart() {
  var chart = this.createChart('chart-line');
  if (!chart) return;

  var budgetData = _customState.budgetData || [];
  var categories = budgetData.map(function(item) { return item.name; });
  var values = budgetData.map(function(item) { return item.value; });

  chart.setOption({
    title: { text: '预算分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLabel: { fontSize: this.utils.isMobile() ? 10 : 12 },
    },
    yAxis: { type: 'value' },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      areaStyle: { color: 'rgba(59,130,246,0.15)' },
      lineStyle: { color: PALETTE.primaryLight, width: 2 },
      itemStyle: { color: PALETTE.primaryLight },
    }],
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
  });
}

// ============================================================
// 渲染
// ============================================================

export function renderJsx() {
  var timestamp = this.state.timestamp;
  var isMobile = this.utils.isMobile();
  var loading = _customState.loading;
  var totalCount = _customState.totalCount;
  var totalBudget = _customState.totalBudget;
  var avgProgress = _customState.avgProgress;
  var statusCount = (_customState.statusData || []).length;

  var styles = {
    container: {
      padding: isMobile ? '12px' : '24px',
      minHeight: '100vh',
      backgroundColor: PALETTE.bg,
      borderRadius: '0 !important',
    },
    header: {
      fontSize: isMobile ? '18px' : '22px',
      fontWeight: 'bold',
      color: PALETTE.textPrimary,
      marginBottom: isMobile ? '12px' : '20px',
    },
    statsRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: isMobile ? '8px' : '16px',
      marginBottom: isMobile ? '12px' : '20px',
    },
    statCard: {
      flex: isMobile ? '1 1 45%' : '1 1 22%',
      backgroundColor: PALETTE.cardBg,
      borderRadius: '8px',
      padding: isMobile ? '12px' : '16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    },
    statLabel: {
      fontSize: '12px',
      color: PALETTE.textMuted,
      marginBottom: '4px',
    },
    statValue: {
      fontSize: isMobile ? '20px' : '28px',
      fontWeight: 'bold',
      color: PALETTE.textPrimary,
    },
    chartsRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: isMobile ? '8px' : '16px',
    },
    chartCard: {
      flex: isMobile ? '1 1 100%' : '1 1 48%',
      backgroundColor: PALETTE.cardBg,
      borderRadius: '8px',
      padding: isMobile ? '12px' : '16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      marginBottom: isMobile ? '8px' : '16px',
    },
    chartCardFull: {
      flex: '1 1 100%',
      backgroundColor: PALETTE.cardBg,
      borderRadius: '8px',
      padding: isMobile ? '12px' : '16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      marginBottom: isMobile ? '8px' : '16px',
    },
    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '400px',
      fontSize: '16px',
      color: PALETTE.textMuted,
    },
    refreshButton: {
      padding: '8px 16px',
      backgroundColor: PALETTE.primary,
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px',
    },
  };

  var chartHeight = isMobile ? '280px' : '380px';

  if (loading) {
    return (
      <div>
        <div style={{ display: 'none' }}>{timestamp}</div>
        <div style={styles.container}>
          <div style={styles.loadingContainer}>数据加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'none' }}>{timestamp}</div>
      <div style={styles.container}>
        {/* 标题栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '12px' : '20px' }}>
          <div style={styles.header}>项目看板</div>
          <button style={styles.refreshButton} onClick={(e) => { this.loadDashboardData(); }}>刷新数据</button>
        </div>

        {/* 统计卡片 */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>项目总数</div>
            <div style={styles.statValue}>{totalCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>状态数</div>
            <div style={styles.statValue}>{statusCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>预算总计</div>
            <div style={Object.assign({}, styles.statValue, { color: PALETTE.primaryLight })}>{totalBudget.toLocaleString()}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>平均进度</div>
            <div style={Object.assign({}, styles.statValue, { color: PALETTE.success })}>{avgProgress.toFixed(1)}%</div>
          </div>
        </div>

        {/* 图表区域 */}
        <div style={styles.chartsRow}>
          <div style={styles.chartCard}>
            <div id="chart-bar" style={{ width: '100%', height: chartHeight }} />
          </div>
          <div style={styles.chartCard}>
            <div id="chart-pie" style={{ width: '100%', height: chartHeight }} />
          </div>
          <div style={styles.chartCardFull}>
            <div id="chart-line" style={{ width: '100%', height: chartHeight }} />
          </div>
        </div>
      </div>
    </div>
  );
}
