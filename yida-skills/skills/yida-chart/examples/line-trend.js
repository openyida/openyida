// ============================================================
// 折线趋势图示例（基于 getDataAsync.json 后端聚合）
// 展示多条数据的时间趋势变化，支持多系列对比
//
// 数据源配置：
//   PRD_ID: 13085982
//   REPORT_UUID: REPORT-0R8665A1ED54RG45IJWIX55W9Q8U2U6AH9XMM1
//   appType: APP_KNILKT41DC5XXR5D4QEC
//
// 报表组件：
//   - statusTable: 状态分布（用于状态系列）
//   - priorityTable: 优先级分布（用于优先级系列）
// ============================================================

var ECHARTS_CDN = 'https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js';
var PRD_ID = '13085982';
var REPORT_UUID = 'REPORT-0R8665A1ED54RG45IJWIX55W9Q8U2U6AH9XMM1';

// ----- 报表组件配置 -----
var REPORT_COMPONENTS = {
  statusTable: { cid: 'YoushuTable_mmx9ha6ar', className: 'YoushuTable', dataSetKey: 'table' },
  priorityTable: { cid: 'YoushuTable_mmx9ha6ax', className: 'YoushuTable', dataSetKey: 'table' },
};

// ----- 筛选器配置 -----
var FILTER_KEYS = {
  status: 'filter-64d734db-c105-4372-ad2a-7833427d965b',
  priority: 'filter-1e6ace6c-10cf-4da4-bbdd-d433af52b9dc',
};

// ----- 颜色主题 -----
var STATUS_COLORS = { '规划中': '#6366f1', '进行中': '#0ea5e9', '已完成': '#059669', '已延期': '#d97706', '已取消': '#94a3b8' };
var PRIORITY_COLORS = { '低': '#94a3b8', '中': '#0ea5e9', '高': '#d97706', '紧急': '#dc2626' };
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
  chartIds: ['chart-line-trend'],
  statusData: [],
  priorityData: [],
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
    this.loadTrendData();
    return;
  }
  this.utils.loadScript(ECHARTS_CDN)
    .then(function() {
      this.bindChartResize();
      this.loadTrendData();
    }.bind(this))
    .catch(function() {
      this.utils.toast({ title: 'ECharts 加载失败，请刷新重试', type: 'error' });
      this.setCustomState({ loading: false });
    }.bind(this));
}

export function bindChartResize() {
  this._resizeHandler = function() {
    _customState.chartIds.forEach(function(domId) {
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

export function loadTrendData() {
  this.setCustomState({ loading: true });

  // 并行获取所有报表组件数据
  Promise.all([
    _fetchReportData(REPORT_COMPONENTS.statusTable),
    _fetchReportData(REPORT_COMPONENTS.priorityTable),
  ])
  .then(function(results) {
    this.setCustomState({
      loading: false,
      statusData: _parseTableData(results[0]),
      priorityData: _parseTableData(results[1]),
    });

    setTimeout(function() {
      this.renderTrendChart();
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

export function createChart(domId) {
  var container = document.getElementById(domId);
  if (!container) return null;
  var existingInstance = window.echarts.getInstanceByDom(container);
  if (existingInstance) existingInstance.dispose();
  return window.echarts.init(container);
}

export function renderTrendChart() {
  var chart = this.createChart('chart-line-trend');
  if (!chart) return;

  var statusData = _customState.statusData || [];
  var priorityData = _customState.priorityData || [];
  var isMobile = this.utils.isMobile();

  // 构建系列数据
  var seriesList = [];
  
  // 状态系列
  if (statusData.length > 0) {
    var statusCategories = statusData.map(function(item) { return item.name; });
    var statusValues = statusData.map(function(item) { return item.value; });
    seriesList.push({
      name: '状态分布',
      type: 'line',
      data: statusValues,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2, color: PALETTE.primaryLight },
      itemStyle: { color: PALETTE.primaryLight },
      emphasis: { focus: 'series' },
    });
  }

  // 优先级系列
  if (priorityData.length > 0) {
    var priorityCategories = priorityData.map(function(item) { return item.name; });
    var priorityValues = priorityData.map(function(item) { return item.value; });
    seriesList.push({
      name: '优先级分布',
      type: 'line',
      data: priorityValues,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2, color: PALETTE.warning },
      itemStyle: { color: PALETTE.warning },
      emphasis: { focus: 'series' },
    });
  }

  // 使用状态类别作为 X 轴
  var categories = statusData.length > 0 ? statusData.map(function(item) { return item.name; }) : [];

  chart.setOption({
    title: {
      text: '状态与优先级分布对比',
      left: 'center',
      textStyle: { fontSize: isMobile ? 14 : 16 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      textStyle: { fontSize: isMobile ? 10 : 12 },
    },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLabel: { fontSize: isMobile ? 10 : 12, rotate: categories.length > 8 ? 30 : 0 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: isMobile ? 10 : 12 },
    },
    series: seriesList,
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
    dataZoom: categories.length > 12 ? [{
      type: 'inside',
      start: 0,
      end: 100,
    }] : [],
  });
}

// ============================================================
// 渲染
// ============================================================

export function renderJsx() {
  var timestamp = this.state.timestamp;
  var isMobile = this.utils.isMobile();
  var loading = _customState.loading;

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
    chartCard: {
      backgroundColor: PALETTE.cardBg,
      borderRadius: '8px',
      padding: isMobile ? '12px' : '20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    },
    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '400px',
      fontSize: '16px',
      color: PALETTE.textMuted,
    },
  };

  var chartHeight = isMobile ? '320px' : '450px';

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
        <div style={styles.header}>项目趋势分析</div>
        <div style={styles.chartCard}>
          <div id="chart-line-trend" style={{ width: '100%', height: chartHeight }} />
        </div>
      </div>
    </div>
  );
}
