// ============================================================
// 雷达图示例
// 多维度能力评估 / 指标对比，适合展示各分类在多个指标上的表现
//
// 数据来源：宜搭原生报表（后端聚合）
// ============================================================

var ECHARTS_CDN = 'https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js';
var REPORT_UUID = 'REPORT-0R8665A1ED54RG45IJWIX55W9Q8U2U6AH9XMM1';
var PRD_ID = 13085982;

// 报表组件配置
var STATUS_TABLE_COMPONENT = {
  cid: 'YoushuTable_mmx9ha6ar',
  className: 'YoushuTable',
  dataSetKey: 'table'
};

var PRIORITY_TABLE_COMPONENT = {
  cid: 'YoushuTable_mmx9ha6ax',
  className: 'YoushuTable',
  dataSetKey: 'table'
};

// PALETTE 配色方案
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
  textMuted: '#94a3b8'
};

var STATUS_COLORS = {
  '规划中': '#6366f1',
  '进行中': '#0ea5e9',
  '已完成': '#059669',
  '已延期': '#d97706',
  '已取消': '#94a3b8'
};

var PRIORITY_COLORS = {
  '低': '#94a3b8',
  '中': '#0ea5e9',
  '高': '#d97706',
  '紧急': '#dc2626'
};

// ============================================================
// 状态管理
// ============================================================

var _customState = {
  loading: true,
  chartIds: ['chart-radar'],
  radarData: {},
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
// 报表数据获取函数（模块级变量）
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

// ============================================================
// ECharts 加载
// ============================================================

export function loadECharts() {
  if (window.echarts) {
    this.bindChartResize();
    this.loadRadarData();
    return;
  }
  this.utils.loadScript(ECHARTS_CDN)
    .then(function() {
      this.bindChartResize();
      this.loadRadarData();
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
// 数据获取（基于报表后端聚合）
// ============================================================

export function loadRadarData() {
  this.setCustomState({ loading: true });
  Promise.all([
    _fetchReportData(STATUS_TABLE_COMPONENT, {}),
    _fetchReportData(PRIORITY_TABLE_COMPONENT, {})
  ])
    .then(function(results) {
      var statusContent = results[0];
      var priorityContent = results[1];
      var statusData = _parseTableData(statusContent);
      var priorityData = _parseTableData(priorityContent);
      var radarData = this.buildRadarData(statusData, priorityData);
      this.setCustomState({
        loading: false,
        statusData: statusData,
        priorityData: priorityData,
        radarData: radarData
      });
      setTimeout(function() {
        this.renderRadarChart();
      }.bind(this), 100);
    }.bind(this))
    .catch(function(error) {
      this.utils.toast({ title: '数据加载失败: ' + error.message, type: 'error' });
      this.setCustomState({ loading: false });
    }.bind(this));
}

/**
 * 构建雷达图数据
 * 从报表聚合数据中提取状态和优先级分布
 * @returns {{ categories: string[], seriesData: { name: string, values: number[] }[] }}
 */
export function buildRadarData(statusData, priorityData) {
  var categories = ['状态分布', '优先级分布'];
  var seriesData = [
    {
      name: '状态分布',
      values: this._calculateDimensionValues(statusData, STATUS_COLORS)
    },
    {
      name: '优先级分布',
      values: this._calculateDimensionValues(priorityData, PRIORITY_COLORS)
    }
  ];
  return { categories: categories, seriesData: seriesData };
}

export function _calculateDimensionValues(data, colorMap) {
  var maxValues = [];
  Object.keys(colorMap).forEach(function(key) {
    var found = data.find(function(item) { return item.name === key; });
    maxValues.push(found ? found.value : 0);
  });
  return maxValues;
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

export function renderRadarChart() {
  var chart = this.createChart('chart-radar');
  if (!chart) return;

  var radarData = _customState.radarData;
  var seriesData = radarData.seriesData || [];
  var isMobile = this.utils.isMobile();

  // 构建雷达图指示器：状态和优先级的各个维度
  var allIndicators = [];
  var statusLabels = Object.keys(STATUS_COLORS);
  var priorityLabels = Object.keys(PRIORITY_COLORS);
  
  statusLabels.forEach(function(label) {
    allIndicators.push({ name: label, max: 100 });
  });
  priorityLabels.forEach(function(label) {
    allIndicators.push({ name: label, max: 100 });
  });

  // 合并状态和优先级数据
  var mergedSeriesData = seriesData.map(function(s) {
    var allValues = [];
    statusLabels.forEach(function(label) {
      var found = _customState.statusData.find(function(item) { return item.name === label; });
      allValues.push(found ? found.value : 0);
    });
    priorityLabels.forEach(function(label) {
      var found = _customState.priorityData.find(function(item) { return item.name === label; });
      allValues.push(found ? found.value : 0);
    });
    return {
      name: s.name,
      value: allValues,
      lineStyle: { color: PALETTE.primary, width: 2 },
      itemStyle: { color: PALETTE.primary },
      areaStyle: { color: PALETTE.primary, opacity: 0.15 },
    };
  });

  chart.setOption({
    title: {
      text: '任务状态与优先级分布',
      left: 'center',
      textStyle: { fontSize: isMobile ? 14 : 16, color: PALETTE.textPrimary },
    },
    tooltip: {
      trigger: 'item',
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      data: seriesData.map(function(s) { return s.name; }),
      textStyle: { fontSize: isMobile ? 10 : 12, color: PALETTE.textSecondary },
    },
    radar: {
      indicator: allIndicators,
      radius: isMobile ? '55%' : '65%',
      center: ['50%', '50%'],
      name: {
        textStyle: { fontSize: isMobile ? 10 : 12, color: PALETTE.textSecondary },
      },
      splitArea: {
        areaStyle: {
          color: [PALETTE.bg, PALETTE.cardBg]
        }
      },
      axisLine: {
        lineStyle: {
          color: PALETTE.border
        }
      },
      splitLine: {
        lineStyle: {
          color: PALETTE.border
        }
      }
    },
    series: [{
      type: 'radar',
      data: mergedSeriesData,
    }],
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

  var chartHeight = isMobile ? '350px' : '480px';

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
        <div style={styles.header}>任务状态与优先级分布</div>
        <div style={styles.chartCard}>
          <div id="chart-radar" style={{ width: '100%', height: chartHeight }} />
        </div>
      </div>
    </div>
  );
}
