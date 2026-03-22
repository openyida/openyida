// ============================================================
// 堆叠面积图示例
// 展示各分类随时间的占比变化趋势，适合分析结构性变化
// 基于宜搭原生报表后端聚合方案
// ============================================================

var ECHARTS_CDN = 'https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js';
var REPORT_UUID = 'REPORT-0R8665A1ED54RG45IJWIX55W9Q8U2U6AH9XMM1';
var PRD_ID = '13085982';

var STATUS_LIST = ['规划中', '进行中', '已完成', '已延期', '已取消'];
var PRIORITY_LIST = ['低', '中', '高', '紧急'];
var STATUS_COLORS = {规划中: '#6366f1', 进行中: '#0ea5e9', 已完成: '#059669', 已延期: '#d97706', 已取消: '#94a3b8'};
var PRIORITY_COLORS = {低: '#94a3b8', 中: '#0ea5e9', 高: '#d97706', 紧急: '#dc2626'};
var PALETTE = {primary: '#1e40af', primaryLight: '#3b82f6', accent: '#0ea5e9', success: '#059669', warning: '#d97706', danger: '#dc2626', neutral: '#64748b', bg: '#f8fafc', cardBg: '#ffffff', border: '#e2e8f0', textPrimary: '#0f172a', textSecondary: '#475569', textMuted: '#94a3b8'};

var COMPONENT_CONFIGS = {
  statusTable: {cid: 'YoushuTable_mmx9ha6ar', className: 'YoushuTable', dataSetKey: 'table'},
  priorityTable: {cid: 'YoushuTable_mmx9ha6ax', className: 'YoushuTable', dataSetKey: 'table'},
};

// ============================================================
// 状态管理
// ============================================================

var _customState = {
  loading: true,
  chartIds: ['chart-stacked-area'],
  areaData: {},
  showPercentage: false,
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
  _customState.chartIds.forEach(function(domId) {
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
    this.loadAreaData();
    return;
  }
  this.utils.loadScript(ECHARTS_CDN)
    .then(function() {
      this.bindChartResize();
      this.loadAreaData();
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
// 数据获取
// ============================================================

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

export function loadAreaData() {
  this.setCustomState({ loading: true });
  Promise.all([
    _fetchReportData(COMPONENT_CONFIGS.statusTable),
    _fetchReportData(COMPONENT_CONFIGS.priorityTable),
  ])
    .then(function(results) {
      var statusData = _parseTableData(results[0]);
      var priorityData = _parseTableData(results[1]);
      var areaData = this.buildAreaData(statusData, priorityData);
      this.setCustomState({ loading: false, areaData: areaData });
      setTimeout(function() {
        this.renderAreaChart();
      }.bind(this), 100);
    }.bind(this))
    .catch(function(error) {
      this.utils.toast({ title: '数据加载失败: ' + error.message, type: 'error' });
      this.setCustomState({ loading: false });
    }.bind(this));
}

/**
 * 构建堆叠面积图数据
 * 从后端聚合数据中提取维度和度量值
 */
export function buildAreaData(statusData, priorityData) {
  var allData = statusData.concat(priorityData);
  var seriesMap = {};
  var monthSet = {};

  allData.forEach(function(item) {
    var category = item.name || '未分类';
    var numValue = item.value || 0;
    var month = '2024-01';
    monthSet[month] = true;

    if (!seriesMap[category]) seriesMap[category] = {};
    seriesMap[category][month] = (seriesMap[category][month] || 0) + numValue;
  });

  var months = Object.keys(monthSet).sort();
  var categories = Object.keys(seriesMap);
  var series = categories.map(function(cat) {
    return {
      name: cat,
      data: months.map(function(m) { return seriesMap[cat][m] || 0; }),
    };
  });

  return { months: months, series: series };
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

export function renderAreaChart() {
  var chart = this.createChart('chart-stacked-area');
  if (!chart) return;

  var areaData = _customState.areaData;
  var months = areaData.months || [];
  var seriesList = areaData.series || [];
  var isMobile = this.utils.isMobile();

  chart.setOption({
    title: {
      text: '趋势占比分析',
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
      data: months,
      boundaryGap: false,
      axisLabel: { fontSize: isMobile ? 10 : 12, rotate: months.length > 8 ? 30 : 0 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: isMobile ? 10 : 12 },
    },
    series: seriesList.map(function(s, index) {
      var color = STATUS_COLORS[s.name] || PRIORITY_COLORS[s.name] || PALETTE.primaryLight;
      return {
        name: s.name,
        type: 'line',
        stack: 'total',
        data: s.data,
        smooth: true,
        lineStyle: { width: 1, color: color },
        itemStyle: { color: color },
        areaStyle: { color: color, opacity: 0.4 },
        emphasis: { focus: 'series' },
      };
    }),
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
    dataZoom: months.length > 12 ? [{
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
      color: '#999',
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
        <div style={styles.header}>堆叠面积趋势</div>
        <div style={styles.chartCard}>
          <div id="chart-stacked-area" style={{ width: '100%', height: chartHeight }} />
        </div>
      </div>
    </div>
  );
}
