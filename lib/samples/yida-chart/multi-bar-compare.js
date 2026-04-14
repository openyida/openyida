// ============================================================
// 多维度对比柱状图示例
// 支持分组柱状图 + 堆叠柱状图两种模式切换
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
  chartIds: ['chart-multi-bar'],
  barData: {},
  isStacked: false,
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
    this.loadBarData();
    return;
  }
  this.utils.loadScript(ECHARTS_CDN)
    .then(function() {
      this.bindChartResize();
      this.loadBarData();
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

export function loadBarData() {
  this.setCustomState({ loading: true });
  this.fetchAllFormData(DATA_FORM_UUID)
    .then(function(dataList) {
      var barData = this.buildMultiBarData(dataList);
      this.setCustomState({ loading: false, barData: barData });
      setTimeout(function() {
        this.renderMultiBarChart();
      }.bind(this), 100);
    }.bind(this))
    .catch(function(error) {
      this.utils.toast({ title: '数据加载失败: ' + error.message, type: 'error' });
      this.setCustomState({ loading: false });
    }.bind(this));
}

export function fetchAllFormData(formUuid, searchCondition) {
  var allData = [];
  var pageSize = 100;
  var fetchPage = function(currentPage) {
    var params = { formUuid: formUuid, currentPage: currentPage, pageSize: pageSize };
    if (searchCondition) {
      params.searchFieldJson = JSON.stringify(searchCondition);
    }
    return this.utils.yida.searchFormDatas(params)
      .then(function(res) {
        allData = allData.concat(res.data || []);
        if (currentPage * pageSize < (res.totalCount || 0)) {
          return fetchPage.call(this, currentPage + 1);
        }
        return allData;
      }.bind(this));
  }.bind(this);
  return fetchPage(1);
}

/**
 * 构建多维度柱状图数据
 * 主分类作为 X 轴，子分类作为不同系列
 * @returns {{ mainCategories: string[], subCategories: string[], matrix: Object }}
 */
export function buildMultiBarData(dataList) {
  var matrix = {};
  var mainCatSet = {};
  var subCatSet = {};

  dataList.forEach(function(item) {
    var mainCat = item.formData[MAIN_CATEGORY_FIELD] || '未分类';
    var subCat = item.formData[SUB_CATEGORY_FIELD] || '未分类';
    var numValue = Number(item.formData[NUMBER_FIELD]) || 0;

    mainCatSet[mainCat] = true;
    subCatSet[subCat] = true;

    if (!matrix[mainCat]) matrix[mainCat] = {};
    matrix[mainCat][subCat] = (matrix[mainCat][subCat] || 0) + numValue;
  });

  return {
    mainCategories: Object.keys(mainCatSet),
    subCategories: Object.keys(subCatSet),
    matrix: matrix,
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

export function renderMultiBarChart() {
  var chart = this.createChart('chart-multi-bar');
  if (!chart) return;

  var barData = _customState.barData;
  var mainCategories = barData.mainCategories || [];
  var subCategories = barData.subCategories || [];
  var matrix = barData.matrix || {};
  var isStacked = _customState.isStacked;
  var isMobile = this.utils.isMobile();

  var series = subCategories.map(function(subCat, index) {
    var color = subCat === '状态' ? PALETTE.primaryLight : PALETTE.accent;
    return {
      name: subCat,
      type: 'bar',
      stack: isStacked ? 'total' : undefined,
      data: mainCategories.map(function(mainCat) {
        return (matrix[mainCat] && matrix[mainCat][subCat]) || 0;
      }),
      itemStyle: { color: color },
      barMaxWidth: 30,
      emphasis: { focus: 'series' },
    };
  });

  chart.setOption({
    title: {
      text: isStacked ? '堆叠对比' : '分组对比',
      left: 'center',
      textStyle: { fontSize: isMobile ? 14 : 16 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      textStyle: { fontSize: isMobile ? 10 : 12 },
    },
    xAxis: {
      type: 'category',
      data: mainCategories,
      axisLabel: {
        rotate: mainCategories.length > 6 ? 30 : 0,
        fontSize: isMobile ? 10 : 12,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: isMobile ? 10 : 12 },
    },
    series: series,
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
  });
}

export function toggleStackMode() {
  _customState.isStacked = !_customState.isStacked;
  this.renderMultiBarChart();
  this.forceUpdate();
}

// ============================================================
// 渲染
// ============================================================

export function renderJsx() {
  var timestamp = this.state.timestamp;
  var isMobile = this.utils.isMobile();
  var loading = _customState.loading;
  var isStacked = _customState.isStacked;

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
      color: '#1a1a1a',
    },
    toggleButton: {
      padding: '6px 14px',
      backgroundColor: isStacked ? PALETTE.success : PALETTE.primary,
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px',
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
        <div style={styles.headerRow}>
          <div style={styles.header}>多维度对比</div>
          <button style={styles.toggleButton} onClick={(e) => { this.toggleStackMode(); }}>
            {isStacked ? '切换为分组' : '切换为堆叠'}
          </button>
        </div>
        <div style={styles.chartCard}>
          <div id="chart-multi-bar" style={{ width: '100%', height: chartHeight }} />
        </div>
      </div>
    </div>
  );
}
