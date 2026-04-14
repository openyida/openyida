// ============================================================
// 散点图示例
// 展示两个数值维度之间的相关性，支持按分类着色和气泡大小
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
  budgetTable: {cid: 'YoushuTable_mmx9ha6a13', className: 'YoushuTable', dataSetKey: 'table'},
};

var X_AXIS_LABEL = '预算';
var Y_AXIS_LABEL = '实际支出';

// ============================================================
// 状态管理
// ============================================================

var _customState = {
  loading: true,
  chartIds: ['chart-scatter'],
  scatterData: {},
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
    this.loadScatterData();
    return;
  }
  this.utils.loadScript(ECHARTS_CDN)
    .then(function() {
      this.bindChartResize();
      this.loadScatterData();
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

export function loadScatterData() {
  this.setCustomState({ loading: true });
  _fetchReportData(COMPONENT_CONFIGS.budgetTable)
    .then(function(content) {
      var scatterData = this.buildScatterData(content);
      this.setCustomState({ loading: false, scatterData: scatterData });
      setTimeout(function() {
        this.renderScatterChart();
      }.bind(this), 100);
    }.bind(this))
    .catch(function(error) {
      this.utils.toast({ title: '数据加载失败: ' + error.message, type: 'error' });
      this.setCustomState({ loading: false });
    }.bind(this));
}

/**
 * 构建散点图数据
 * 从后端聚合数据中提取维度和度量值
 * @returns {{ categories: string[], seriesMap: Object }}
 */
export function buildScatterData(content) {
  var data = content.data || content.dataList || [];
  var meta = content.meta || [];
  var seriesMap = {};

  if (data.length === 0) return { categories: [], seriesMap: {} };

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

  if (!dimField || !measureField) return { categories: [], seriesMap: {} };

  data.forEach(function(row) {
    var category = row[dimField] || '未分类';
    var xVal = Number(row[measureField]) || 0;
    var yVal = Number(row[measureField]) || 0;

    if (!seriesMap[category]) seriesMap[category] = [];
    seriesMap[category].push([xVal, yVal, xVal]);
  });

  return {
    categories: Object.keys(seriesMap),
    seriesMap: seriesMap,
  };
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

export function renderScatterChart() {
  var chart = this.createChart('chart-scatter');
  if (!chart) return;

  var scatterData = _customState.scatterData;
  var categories = scatterData.categories || [];
  var seriesMap = scatterData.seriesMap || {};
  var isMobile = this.utils.isMobile();
  var hasSizeField = SIZE_FIELD !== null;

  var series = categories.map(function(cat, index) {
    var color = STATUS_COLORS[cat] || PRIORITY_COLORS[cat] || PALETTE.primaryLight;
    return {
      name: cat,
      type: 'scatter',
      data: seriesMap[cat],
      symbolSize: function(data) {
        var sizeVal = data[2] || 1;
        return Math.max(8, Math.min(40, Math.sqrt(sizeVal) * 4));
      },
      itemStyle: { color: color, opacity: 0.7 },
      emphasis: {
        focus: 'series',
        itemStyle: { opacity: 1, borderColor: '#333', borderWidth: 1 },
      },
    };
  });

  chart.setOption({
    title: {
      text: '相关性分析',
      left: 'center',
      textStyle: { fontSize: isMobile ? 14 : 16 },
    },
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        var data = params.data;
        var tip = params.seriesName + '<br/>'
          + X_AXIS_LABEL + ': ' + data[0] + '<br/>'
          + Y_AXIS_LABEL + ': ' + data[1];
        if (hasSizeField && data[2] !== undefined) {
          tip += '<br/>数值: ' + data[2];
        }
        return tip;
      },
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      data: categories,
      textStyle: { fontSize: isMobile ? 10 : 12 },
    },
    xAxis: {
      type: 'value',
      name: X_AXIS_LABEL,
      nameLocation: 'center',
      nameGap: 30,
      axisLabel: { fontSize: isMobile ? 10 : 12 },
    },
    yAxis: {
      type: 'value',
      name: Y_AXIS_LABEL,
      nameLocation: 'center',
      nameGap: 40,
      axisLabel: { fontSize: isMobile ? 10 : 12 },
    },
    series: series,
    grid: { left: '5%', right: '5%', bottom: '15%', top: '12%', containLabel: true },
  });
}

// ============================================================
// 渲染
// ============================================================

export function renderJsx() {
  var timestamp = this.state.timestamp;
  var isMobile = this.utils.isMobile();
  var loading = _customState.loading;
  var scatterData = _customState.scatterData;
  var totalPoints = 0;
  var categories = scatterData.categories || [];
  categories.forEach(function(cat) {
    totalPoints += (scatterData.seriesMap[cat] || []).length;
  });

  var styles = {
    container: {
      padding: isMobile ? '12px' : '24px',
      minHeight: '100vh',
      backgroundColor: PALETTE.bg,
      borderRadius: '0 !important',
    },
    headerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isMobile ? '12px' : '20px',
    },
    header: {
      fontSize: isMobile ? '18px' : '22px',
      fontWeight: 'bold',
      color: PALETTE.textPrimary,
    },
    badge: {
      padding: '4px 10px',
      backgroundColor: PALETTE.bg,
      color: PALETTE.primary,
      borderRadius: '12px',
      fontSize: '12px',
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

  var chartHeight = isMobile ? '320px' : '480px';

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
        <div style={styles.headerRow}>
          <div style={styles.header}>散点分析</div>
          <div style={styles.badge}>{totalPoints} 个数据点 · {categories.length} 个分类</div>
        </div>
        <div style={styles.chartCard}>
          <div id="chart-scatter" style={{ width: '100%', height: chartHeight }} />
        </div>
      </div>
    </div>
  );
}
