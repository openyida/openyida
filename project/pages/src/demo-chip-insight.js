// 半导体行业智能洞察平台 - 可视化看板
// 从表单实时加载数据，展示市场趋势、公司竞争力、行业舆情

var FORM_MARKET = 'FORM-8EE55570104D4537BE9C3A86530E5DF05AJ3';
var FORM_COMPANY = 'FORM-4F328A699E4B4C88A436AD4BFCE62FF0Z7FB';
var FORM_SENTIMENT = 'FORM-14F9ECC414E24A908AC4179F37751C4DWTXA';
var APP_TYPE = 'APP_H3SGUZODOIT37NUFJXUO';

// 字段映射
var MF = { year: 'textField_sdei13zi0', marketSize: 'numberField_sdej29dnq', growth: 'textField_sdej3fyou', aiSize: 'numberField_sdej4zb6q', aiRatio: 'textField_sdej5eyvd', note: 'textareaField_sdej6mim5' };
var CF = { name: 'textField_su5y15ixq', marketCap: 'numberField_su5y2zmtz', revenue: 'numberField_su5y3yvwd', aiRevenue: 'numberField_su5y4tdox', share: 'textField_su5y5a89m', product: 'textField_su5y6z5fq', techRoute: 'textareaField_su5y7c72a', rating: 'selectField_su5z89ksz' };
var SF = { title: 'textField_t90f17mmk', category: 'selectField_t90f21qco', impact: 'selectField_t90f3jcrk', date: 'dateField_t90f4yl9u', summary: 'textareaField_t90f56bsg', analysis: 'textareaField_t90f6py0o', source: 'textField_t90f7alnc' };

var _customState = {
  loading: true,
  activeTab: 'overview',
  marketData: [],
  companyData: [],
  sentimentData: [],
  expandedCard: null,
  echartsLoaded: false,
  chartInstances: {},
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

export function didMount() {
  var self = this;
  // 注入覆盖样式（确保在平台 CSS 之后生效）
  var styleTag = document.createElement('style');
  styleTag.textContent = '.vc-deep-container-entry.vc-rootcontent{padding:0!important;margin-top:0!important;margin-right:0!important;margin-bottom:0!important;margin-left:0!important}';
  document.head.appendChild(styleTag);
  // 加载 ECharts 5.5.0
  this.utils.loadScript('https://g.alicdn.com/code/lib/echarts/5.5.0/echarts.min.js').then(function() {
    _customState.echartsLoaded = true;
    self.initCharts();
  }).catch(function(err) {
    console.error('ECharts 加载失败:', err);
  });
  this.loadAllData();
}

export function didUnmount() {}

export function loadAllData() {
  var self = this;
  _customState.loading = true;
  self.forceUpdate();

  var marketPromise = self.utils.yida.searchFormDatas({
    formUuid: FORM_MARKET,
    searchFieldJson: JSON.stringify({}),
    currentPage: 1,
    pageSize: 50,
  });

  var companyPromise = self.utils.yida.searchFormDatas({
    formUuid: FORM_COMPANY,
    searchFieldJson: JSON.stringify({}),
    currentPage: 1,
    pageSize: 50,
  });

  var sentimentPromise = self.utils.yida.searchFormDatas({
    formUuid: FORM_SENTIMENT,
    searchFieldJson: JSON.stringify({}),
    currentPage: 1,
    pageSize: 50,
  });

  Promise.all([marketPromise, companyPromise, sentimentPromise]).then(function(results) {
    var marketRaw = (results[0] && results[0].data) || [];
    var companyRaw = (results[1] && results[1].data) || [];
    var sentimentRaw = (results[2] && results[2].data) || [];

    var marketList = marketRaw.map(function(item) {
      var fd = item.formData || {};
      return { year: fd[MF.year] || '', marketSize: fd[MF.marketSize] || 0, growth: fd[MF.growth] || '', aiSize: fd[MF.aiSize] || 0, aiRatio: fd[MF.aiRatio] || '', note: fd[MF.note] || '' };
    }).sort(function(a, b) { return a.year < b.year ? -1 : 1; });

    var companyList = companyRaw.map(function(item) {
      var fd = item.formData || {};
      return { name: fd[CF.name] || '', marketCap: fd[CF.marketCap] || 0, revenue: fd[CF.revenue] || 0, aiRevenue: fd[CF.aiRevenue] || 0, share: fd[CF.share] || '', product: fd[CF.product] || '', techRoute: fd[CF.techRoute] || '', rating: fd[CF.rating] || '' };
    }).sort(function(a, b) { return b.marketCap - a.marketCap; });

    var sentimentList = sentimentRaw.map(function(item) {
      var fd = item.formData || {};
      return { title: fd[SF.title] || '', category: fd[SF.category] || '', impact: fd[SF.impact] || '', date: fd[SF.date] || 0, summary: fd[SF.summary] || '', analysis: fd[SF.analysis] || '', source: fd[SF.source] || '' };
    }).sort(function(a, b) { return (b.date || 0) - (a.date || 0); });

    self.setCustomState({
      loading: false,
      marketData: marketList,
      companyData: companyList,
      sentimentData: sentimentList,
    });
    self.initCharts();
  }).catch(function(err) {
    console.error('数据加载失败:', err);
    self.setCustomState({ loading: false });
  });
}

// ===== ECharts 图表初始化 =====
export function initCharts() {
  var self = this;
  if (!_customState.echartsLoaded || typeof echarts === 'undefined') return;
  setTimeout(function() { self.initCurrentTabChart(); }, 100);
}

export function initCurrentTabChart() {
  var activeTab = _customState.activeTab;
  if (!_customState.echartsLoaded || typeof echarts === 'undefined') return;

  if (activeTab === 'overview') {
    this.initMarketChart();
    this.initAiTrendChart();
  } else if (activeTab === 'company') {
    this.initCompanyChart();
  } else if (activeTab === 'sentiment') {
    this.initImpactPieChart();
    this.initCategoryPieChart();
  }
}

export function initMarketChart() {
  var container = document.getElementById('chart-market-bar');
  if (!container) return;
  if (_customState.chartInstances.marketBar) _customState.chartInstances.marketBar.dispose();
  var chart = echarts.init(container, null, { renderer: 'canvas' });
  _customState.chartInstances.marketBar = chart;

  var marketData = _customState.marketData;
  var years = marketData.map(function(d) { return d.year; });
  var marketSizes = marketData.map(function(d) { return d.marketSize; });
  var aiSizes = marketData.map(function(d) { return d.aiSize; });

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 56, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e8f0fe', fontSize: 13 },
      formatter: function(params) {
        var year = params[0].axisValue;
        var result = '<div style="font-weight:700;margin-bottom:6px">' + year + '</div>';
        params.forEach(function(p) {
          result += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0">';
          result += '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + p.color + '"></span>';
          result += p.seriesName + ': <b>' + p.value.toLocaleString() + '</b> 亿美元</div>';
        });
        return result;
      }
    },
    legend: {
      data: ['半导体总市场', 'AI芯片市场'],
      textStyle: { color: 'rgba(200,220,255,0.6)', fontSize: 12 },
      top: 0,
      right: 0,
    },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: 'category',
      data: years,
      axisLabel: { color: 'rgba(200,220,255,0.6)', fontSize: 13, fontWeight: 600 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.15)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '亿美元',
      nameTextStyle: { color: 'rgba(200,220,255,0.4)', fontSize: 11 },
      axisLabel: { color: 'rgba(200,220,255,0.4)', fontSize: 11, formatter: function(v) { return v.toLocaleString(); } },
      splitLine: { lineStyle: { color: 'rgba(0,212,255,0.06)' } },
      axisLine: { show: false },
    },
    series: [
      {
        name: '半导体总市场',
        type: 'bar',
        data: marketSizes,
        barWidth: '35%',
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00d4ff' },
            { offset: 1, color: 'rgba(0,212,255,0.2)' }
          ]),
        },
        emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,212,255,0.4)' } },
        label: { show: true, position: 'top', color: '#00d4ff', fontSize: 12, fontWeight: 700, formatter: function(p) { return p.value.toLocaleString(); } },
      },
      {
        name: 'AI芯片市场',
        type: 'bar',
        data: aiSizes,
        barWidth: '35%',
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#7c3aed' },
            { offset: 1, color: 'rgba(124,58,237,0.2)' }
          ]),
        },
        emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(124,58,237,0.4)' } },
        label: { show: true, position: 'top', color: '#7c3aed', fontSize: 12, fontWeight: 700 },
      },
    ],
    animationDuration: 1200,
    animationEasing: 'elasticOut',
  });

  window.addEventListener('resize', function() { chart.resize(); });
}

export function initAiTrendChart() {
  var container = document.getElementById('chart-ai-trend');
  if (!container) return;
  if (_customState.chartInstances.aiTrend) _customState.chartInstances.aiTrend.dispose();
  var chart = echarts.init(container, null, { renderer: 'canvas' });
  _customState.chartInstances.aiTrend = chart;

  var marketData = _customState.marketData;
  var years = marketData.map(function(d) { return d.year; });
  var aiRatios = marketData.map(function(d) { return parseFloat(d.aiRatio) || 0; });
  var growths = marketData.map(function(d) { return parseFloat(d.growth) || 0; });

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 56, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e8f0fe', fontSize: 13 },
    },
    legend: {
      data: ['AI芯片占比', '同比增长率'],
      textStyle: { color: 'rgba(200,220,255,0.6)', fontSize: 12 },
      top: 0,
      right: 0,
    },
    grid: { left: 50, right: 50, top: 40, bottom: 40 },
    xAxis: {
      type: 'category',
      data: years,
      axisLabel: { color: 'rgba(200,220,255,0.6)', fontSize: 13 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.15)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: 'AI占比(%)',
        nameTextStyle: { color: 'rgba(200,220,255,0.4)', fontSize: 11 },
        axisLabel: { color: 'rgba(200,220,255,0.4)', fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(0,212,255,0.06)' } },
        axisLine: { show: false },
      },
      {
        type: 'value',
        name: '增长率(%)',
        nameTextStyle: { color: 'rgba(200,220,255,0.4)', fontSize: 11 },
        axisLabel: { color: 'rgba(200,220,255,0.4)', fontSize: 11, formatter: '{value}%' },
        splitLine: { show: false },
        axisLine: { show: false },
      },
    ],
    series: [
      {
        name: 'AI芯片占比',
        type: 'line',
        data: aiRatios,
        smooth: true,
        symbol: 'circle',
        symbolSize: 10,
        lineStyle: { width: 3, color: '#7c3aed' },
        itemStyle: { color: '#7c3aed', borderWidth: 2, borderColor: '#fff' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(124,58,237,0.3)' }, { offset: 1, color: 'rgba(124,58,237,0.02)' }]) },
        label: { show: true, position: 'top', color: '#7c3aed', fontSize: 12, fontWeight: 600, formatter: '{c}%' },
      },
      {
        name: '同比增长率',
        type: 'line',
        yAxisIndex: 1,
        data: growths,
        smooth: true,
        symbol: 'diamond',
        symbolSize: 10,
        lineStyle: { width: 3, color: '#2ed573', type: 'dashed' },
        itemStyle: { color: '#2ed573', borderWidth: 2, borderColor: '#fff' },
        label: { show: true, position: 'bottom', color: '#2ed573', fontSize: 11, formatter: '{c}%' },
      },
    ],
    animationDuration: 1500,
  });

  window.addEventListener('resize', function() { chart.resize(); });
}

export function initCompanyChart() {
  var container = document.getElementById('chart-company-bar');
  if (!container) return;
  if (_customState.chartInstances.companyBar) _customState.chartInstances.companyBar.dispose();
  var chart = echarts.init(container, null, { renderer: 'canvas' });
  _customState.chartInstances.companyBar = chart;

  var companyData = _customState.companyData.slice().reverse();
  var names = companyData.map(function(d) { return d.name; });
  var marketCaps = companyData.map(function(d) { return d.marketCap; });
  var revenues = companyData.map(function(d) { return d.revenue; });
  var aiRevenues = companyData.map(function(d) { return d.aiRevenue; });

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15, 23, 56, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e8f0fe', fontSize: 13 },
      formatter: function(params) {
        var name = params[0].axisValue;
        var result = '<div style="font-weight:700;margin-bottom:6px">' + name + '</div>';
        params.forEach(function(p) {
          result += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0">';
          result += '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + p.color + '"></span>';
          result += p.seriesName + ': <b>' + p.value.toLocaleString() + '</b> 亿美元</div>';
        });
        return result;
      }
    },
    legend: {
      data: ['市值', '年营收', 'AI营收'],
      textStyle: { color: 'rgba(200,220,255,0.6)', fontSize: 12 },
      top: 0,
      right: 0,
    },
    grid: { left: 100, right: 30, top: 40, bottom: 20 },
    xAxis: {
      type: 'value',
      name: '亿美元',
      nameTextStyle: { color: 'rgba(200,220,255,0.4)', fontSize: 11 },
      axisLabel: { color: 'rgba(200,220,255,0.4)', fontSize: 11, formatter: function(v) { return v >= 10000 ? (v / 10000).toFixed(0) + '万' : v.toLocaleString(); } },
      splitLine: { lineStyle: { color: 'rgba(0,212,255,0.06)' } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: '#e8f0fe', fontSize: 13, fontWeight: 600 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.15)' } },
      axisTick: { show: false },
    },
    series: [
      {
        name: '市值',
        type: 'bar',
        data: marketCaps,
        barWidth: '25%',
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: 'rgba(0,212,255,0.3)' },
            { offset: 1, color: '#00d4ff' }
          ]),
        },
        emphasis: { itemStyle: { shadowBlur: 15, shadowColor: 'rgba(0,212,255,0.4)' } },
      },
      {
        name: '年营收',
        type: 'bar',
        data: revenues,
        barWidth: '25%',
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: 'rgba(46,213,115,0.3)' },
            { offset: 1, color: '#2ed573' }
          ]),
        },
      },
      {
        name: 'AI营收',
        type: 'bar',
        data: aiRevenues,
        barWidth: '25%',
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: 'rgba(124,58,237,0.3)' },
            { offset: 1, color: '#7c3aed' }
          ]),
        },
      },
    ],
    animationDuration: 1200,
    animationEasing: 'elasticOut',
  });

  window.addEventListener('resize', function() { chart.resize(); });
}

export function initImpactPieChart() {
  var container = document.getElementById('chart-impact-pie');
  if (!container) return;
  if (_customState.chartInstances.impactPie) _customState.chartInstances.impactPie.dispose();
  var chart = echarts.init(container, null, { renderer: 'canvas' });
  _customState.chartInstances.impactPie = chart;

  var sentimentData = _customState.sentimentData;
  var impactCount = { '重大': 0, '较大': 0, '一般': 0, '轻微': 0 };
  sentimentData.forEach(function(item) {
    if (impactCount.hasOwnProperty(item.impact)) impactCount[item.impact]++;
  });

  var pieData = Object.keys(impactCount).map(function(level) {
    return { name: level, value: impactCount[level] };
  }).filter(function(d) { return d.value > 0; });

  var colorMap = { '重大': '#ff4757', '较大': '#ffa502', '一般': '#2ed573', '轻微': '#747d8c' };

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 56, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e8f0fe', fontSize: 13 },
      formatter: '{b}: {c}条 ({d}%)',
    },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#0a0e27',
        borderWidth: 3,
      },
      label: {
        show: true,
        color: '#e8f0fe',
        fontSize: 13,
        fontWeight: 600,
        formatter: '{b}\n{c}条',
      },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.5)' },
      },
      data: pieData.map(function(d) {
        return { name: d.name, value: d.value, itemStyle: { color: colorMap[d.name] || '#747d8c' } };
      }),
      animationType: 'scale',
      animationEasing: 'elasticOut',
      animationDelay: function(idx) { return idx * 200; },
    }],
  });

  window.addEventListener('resize', function() { chart.resize(); });
}

export function initCategoryPieChart() {
  var container = document.getElementById('chart-category-pie');
  if (!container) return;
  if (_customState.chartInstances.categoryPie) _customState.chartInstances.categoryPie.dispose();
  var chart = echarts.init(container, null, { renderer: 'canvas' });
  _customState.chartInstances.categoryPie = chart;

  var sentimentData = _customState.sentimentData;
  var categoryCount = {};
  sentimentData.forEach(function(item) {
    categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
  });

  var categoryColors = ['#00d4ff', '#7c3aed', '#2ed573', '#ffa502', '#ff4757', '#ff6b81'];
  var pieData = Object.keys(categoryCount).map(function(cat, idx) {
    return { name: cat, value: categoryCount[cat], itemStyle: { color: categoryColors[idx % categoryColors.length] } };
  });

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 56, 0.95)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e8f0fe', fontSize: 13 },
      formatter: '{b}: {c}条 ({d}%)',
    },
    series: [{
      type: 'pie',
      radius: ['0%', '70%'],
      center: ['50%', '55%'],
      roseType: 'area',
      itemStyle: {
        borderRadius: 6,
        borderColor: '#0a0e27',
        borderWidth: 2,
      },
      label: {
        show: true,
        color: '#e8f0fe',
        fontSize: 12,
        formatter: '{b}: {c}',
      },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.5)' },
      },
      data: pieData,
      animationType: 'scale',
      animationEasing: 'elasticOut',
      animationDelay: function(idx) { return idx * 150; },
    }],
  });

  window.addEventListener('resize', function() { chart.resize(); });
}

// ===== 工具函数 =====
function formatNumber(num) {
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return String(num);
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  var d = new Date(Number(timestamp));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getImpactColor(impact) {
  if (impact === '重大') return '#ff4757';
  if (impact === '较大') return '#ffa502';
  if (impact === '一般') return '#2ed573';
  return '#747d8c';
}

function getCategoryIcon(category) {
  if (category === '技术突破') return '🔬';
  if (category === '政策法规') return '📋';
  if (category === '市场动态') return '📈';
  if (category === '供应链') return '🔗';
  if (category === '竞争格局') return '⚔️';
  return '📰';
}

function getRatingColor(rating) {
  if (rating === '领导者') return '#00d4ff';
  if (rating === '挑战者') return '#ffa502';
  if (rating === '追随者') return '#747d8c';
  return '#a4b0be';
}

// ===== 样式常量 =====
var COLORS = {
  bg: '#0a0e27',
  cardBg: 'rgba(15, 23, 56, 0.85)',
  cardBorder: 'rgba(0, 212, 255, 0.12)',
  cardHoverBorder: 'rgba(0, 212, 255, 0.35)',
  accent: '#00d4ff',
  accentGlow: 'rgba(0, 212, 255, 0.15)',
  text: '#e8f0fe',
  textSecondary: 'rgba(200, 220, 255, 0.6)',
  gradient1: '#00d4ff',
  gradient2: '#7c3aed',
  success: '#2ed573',
  warning: '#ffa502',
  danger: '#ff4757',
};

// ===== 渲染入口 =====
export function renderJsx() {
  var timestamp = this.state.timestamp;
  var loading = _customState.loading;
  var activeTab = _customState.activeTab;
  var self = this;

  if (loading) {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'PingFang SC', 'Helvetica Neue', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px', animation: 'pulse 2s infinite' }}>🔬</div>
          <div style={{ color: COLORS.accent, fontSize: '18px', fontWeight: '600' }}>正在加载行业洞察数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', fontFamily: "'PingFang SC', 'Helvetica Neue', sans-serif", color: COLORS.text, padding: '0' }}>
      <div style={{ display: 'none' }}>{timestamp}</div>

      {self.renderHeader()}
      {self.renderKPICards()}
      {self.renderTabBar()}

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px 40px' }}>
        {activeTab === 'overview' ? self.renderOverview() : null}
        {activeTab === 'company' ? self.renderCompanyView() : null}
        {activeTab === 'sentiment' ? self.renderSentimentView() : null}
      </div>
    </div>
  );
}

// ===== 头部 =====
export function renderHeader() {
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(124,58,237,0.08) 100%)', borderBottom: '1px solid ' + COLORS.cardBorder, padding: '32px 24px 24px', marginBottom: '0' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '32px' }}>🔬</span>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', background: 'linear-gradient(135deg, ' + COLORS.gradient1 + ', ' + COLORS.gradient2 + ')', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>半导体行业智能洞察</h1>
            </div>
            <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: '14px' }}>Semiconductor Industry Intelligence Dashboard · 2026</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
            <div style={{ padding: '8px 16px', background: 'rgba(46,213,115,0.15)', border: '1px solid rgba(46,213,115,0.3)', borderRadius: '20px', fontSize: '13px', color: COLORS.success }}>
              ● 数据实时同步
            </div>
            <div style={{ padding: '8px 16px', background: COLORS.accentGlow, border: '1px solid rgba(0,212,255,0.3)', borderRadius: '20px', fontSize: '13px', color: COLORS.accent, cursor: 'pointer' }} onClick={(e) => { this.loadAllData(); }}>
              🔄 刷新数据
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== KPI 卡片 =====
export function renderKPICards() {
  var marketData = _customState.marketData;
  var companyData = _customState.companyData;
  var sentimentData = _customState.sentimentData;
  var self = this;

  var latestMarket = marketData.length > 0 ? marketData[marketData.length - 1] : {};
  var prevMarket = marketData.length > 1 ? marketData[marketData.length - 2] : {};
  var totalMarketCap = companyData.reduce(function(sum, item) { return sum + (item.marketCap || 0); }, 0);
  var criticalNews = sentimentData.filter(function(item) { return item.impact === '重大'; }).length;

  var kpis = [
    { icon: '💰', label: '全球半导体市场规模', value: (latestMarket.marketSize || 0) + '亿$', sub: latestMarket.year || '', color: COLORS.accent },
    { icon: '🤖', label: 'AI芯片市场规模', value: (latestMarket.aiSize || 0) + '亿$', sub: '占比 ' + (latestMarket.aiRatio || 'N/A'), color: '#7c3aed' },
    { icon: '📈', label: '同比增长率', value: latestMarket.growth || 'N/A', sub: '较上年 ' + (prevMarket.growth || ''), color: COLORS.success },
    { icon: '🏢', label: '跟踪企业总市值', value: formatNumber(totalMarketCap) + '亿$', sub: companyData.length + ' 家核心企业', color: COLORS.warning },
    { icon: '🔥', label: '重大舆情事件', value: String(criticalNews), sub: '共 ' + sentimentData.length + ' 条舆情', color: COLORS.danger },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 24px 0' }}>
      <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
        {kpis.map(function(kpi, index) {
          return (
            <div key={index} style={{ flex: '1 0 200px', background: COLORS.cardBg, border: '1px solid ' + COLORS.cardBorder, borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden', minWidth: '200px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, ' + kpi.color + ', transparent)' }}></div>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{kpi.icon}</div>
              <div style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: kpi.color, marginBottom: '4px' }}>{kpi.value}</div>
              <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>{kpi.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== Tab 栏 =====
export function renderTabBar() {
  var activeTab = _customState.activeTab;
  var self = this;

  var tabs = [
    { key: 'overview', label: '📊 市场总览', desc: '市场规模与趋势' },
    { key: 'company', label: '🏢 竞争格局', desc: '核心企业分析' },
    { key: 'sentiment', label: '📰 行业舆情', desc: '最新动态追踪' },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 24px 0' }}>
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid ' + COLORS.cardBorder, paddingBottom: '0' }}>
        {tabs.map(function(tab) {
          var isActive = activeTab === tab.key;
          return (
            <div
              key={tab.key}
              style={{
                padding: '12px 24px',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid ' + COLORS.accent : '2px solid transparent',
                color: isActive ? COLORS.accent : COLORS.textSecondary,
                fontSize: '15px',
                fontWeight: isActive ? '600' : '400',
                transition: 'all 0.2s',
              }}
              onClick={(e) => { this.setCustomState({ activeTab: tab.key }); setTimeout(() => { this.initCurrentTabChart(); }, 150); }}
            >
              {tab.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== 市场总览 =====
export function renderOverview() {
  var marketData = _customState.marketData;
  var self = this;

  if (marketData.length === 0) {
    return <div style={{ textAlign: 'center', padding: '60px', color: COLORS.textSecondary }}>暂无市场数据</div>;
  }

  return (
    <div style={{ paddingTop: '24px' }}>
      {/* ECharts 市场规模趋势图 */}
      <div style={{ background: COLORS.cardBg, border: '1px solid ' + COLORS.cardBorder, borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: COLORS.text }}>
          📊 全球半导体市场规模趋势（亿美元）
        </h3>
        <div id="chart-market-bar" style={{ width: '100%', height: '360px' }}></div>
      </div>

      {/* ECharts AI芯片占比 & 增长率趋势 */}
      <div style={{ background: COLORS.cardBg, border: '1px solid ' + COLORS.cardBorder, borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: COLORS.text }}>
          🤖 AI芯片占比 & 市场增长率趋势
        </h3>
        <div id="chart-ai-trend" style={{ width: '100%', height: '320px' }}></div>
      </div>

      {/* 年度详情卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {marketData.map(function(item, index) {
          var isEstimate = item.year.indexOf('E') >= 0;
          return (
            <div key={index} style={{ background: COLORS.cardBg, border: '1px solid ' + COLORS.cardBorder, borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: isEstimate ? 'linear-gradient(90deg, ' + COLORS.warning + ', transparent)' : 'linear-gradient(90deg, ' + COLORS.accent + ', transparent)' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '20px', fontWeight: '700', color: isEstimate ? COLORS.warning : COLORS.accent }}>{item.year}</span>
                {isEstimate ? <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(255,165,2,0.15)', color: COLORS.warning, borderRadius: '10px' }}>预测</span> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: COLORS.textSecondary }}>市场规模</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: COLORS.text }}>{item.marketSize.toLocaleString()}亿$</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: COLORS.textSecondary }}>同比增长</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: COLORS.success }}>{item.growth}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: COLORS.textSecondary }}>AI芯片规模</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#7c3aed' }}>{item.aiSize}亿$</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: COLORS.textSecondary }}>AI芯片占比</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#7c3aed' }}>{item.aiRatio}</div>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: COLORS.textSecondary, lineHeight: '1.6', borderTop: '1px solid ' + COLORS.cardBorder, paddingTop: '12px' }}>
                {item.note}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== 竞争格局 =====
export function renderCompanyView() {
  var companyData = _customState.companyData;
  var expandedCard = _customState.expandedCard;
  var self = this;

  if (companyData.length === 0) {
    return <div style={{ textAlign: 'center', padding: '60px', color: COLORS.textSecondary }}>暂无公司数据</div>;
  }

  var maxRevenue = Math.max.apply(null, companyData.map(function(d) { return d.revenue; }));

  return (
    <div style={{ paddingTop: '24px' }}>
      {/* ECharts 企业对比图 */}
      <div style={{ background: COLORS.cardBg, border: '1px solid ' + COLORS.cardBorder, borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600', color: COLORS.text }}>
          🏆 核心企业综合对比（市值 / 营收 / AI营收，亿美元）
        </h3>
        <div id="chart-company-bar" style={{ width: '100%', height: '380px' }}></div>
      </div>

      {/* 公司详情卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
        {companyData.map(function(item, index) {
          var isExpanded = expandedCard === index;
          var ratingColor = getRatingColor(item.rating);
          var revenueBarWidth = maxRevenue > 0 ? (item.revenue / maxRevenue * 100) : 0;
          var aiRevenueBarWidth = maxRevenue > 0 ? (item.aiRevenue / maxRevenue * 100) : 0;

          return (
            <div
              key={index}
              style={{
                background: COLORS.cardBg,
                border: '1px solid ' + (isExpanded ? COLORS.cardHoverBorder : COLORS.cardBorder),
                borderRadius: '16px',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onClick={(e) => { this.setCustomState({ expandedCard: isExpanded ? null : index }); }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, ' + ratingColor + ', transparent)' }}></div>

              {/* 公司头部 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: COLORS.text, marginBottom: '4px' }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>{item.product}</div>
                </div>
                <div style={{ padding: '4px 12px', background: ratingColor + '20', border: '1px solid ' + ratingColor + '40', borderRadius: '12px', fontSize: '12px', color: ratingColor, fontWeight: '600' }}>
                  {item.rating}
                </div>
              </div>

              {/* 核心指标 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(0,212,255,0.05)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: COLORS.textSecondary, marginBottom: '4px' }}>市值</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: COLORS.accent }}>{formatNumber(item.marketCap)}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(46,213,115,0.05)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: COLORS.textSecondary, marginBottom: '4px' }}>年营收</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: COLORS.success }}>{item.revenue}亿</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(124,58,237,0.05)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: COLORS.textSecondary, marginBottom: '4px' }}>AI营收</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#7c3aed' }}>{item.aiRevenue}亿</div>
                </div>
              </div>

              {/* 营收对比条 */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>营收结构</span>
                  <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>市场份额: {item.share}</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(0,212,255,0.06)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', height: '100%', width: revenueBarWidth + '%', background: 'rgba(0,212,255,0.3)', borderRadius: '4px' }}></div>
                  <div style={{ position: 'absolute', height: '100%', width: aiRevenueBarWidth + '%', background: '#7c3aed', borderRadius: '4px' }}></div>
                </div>
              </div>

              {/* 展开详情 */}
              {isExpanded ? (
                <div style={{ borderTop: '1px solid ' + COLORS.cardBorder, paddingTop: '16px', marginTop: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: COLORS.accent, marginBottom: '8px' }}>🔬 技术路线与战略分析</div>
                  <div style={{ fontSize: '13px', color: COLORS.textSecondary, lineHeight: '1.8' }}>{item.techRoute}</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontSize: '12px', color: COLORS.textSecondary, marginTop: '8px' }}>
                  点击展开详情 ▼
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== 行业舆情 =====
export function renderSentimentView() {
  var sentimentData = _customState.sentimentData;
  var self = this;

  if (sentimentData.length === 0) {
    return <div style={{ textAlign: 'center', padding: '60px', color: COLORS.textSecondary }}>暂无舆情数据</div>;
  }

  return (
    <div style={{ paddingTop: '24px' }}>
      {/* ECharts 舆情统计概览 */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {/* 影响等级分布 - 环形图 */}
        <div style={{ flex: '1 1 300px', background: COLORS.cardBg, border: '1px solid ' + COLORS.cardBorder, borderRadius: '16px', padding: '24px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '600', color: COLORS.text }}>⚡ 影响等级分布</h4>
          <div id="chart-impact-pie" style={{ width: '100%', height: '280px' }}></div>
        </div>

        {/* 类别分布 - 南丁格尔玫瑰图 */}
        <div style={{ flex: '1 1 300px', background: COLORS.cardBg, border: '1px solid ' + COLORS.cardBorder, borderRadius: '16px', padding: '24px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '600', color: COLORS.text }}>📂 舆情类别分布</h4>
          <div id="chart-category-pie" style={{ width: '100%', height: '280px' }}></div>
        </div>
      </div>

      {/* 舆情时间线 */}
      <div style={{ background: COLORS.cardBg, border: '1px solid ' + COLORS.cardBorder, borderRadius: '16px', padding: '28px' }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '600', color: COLORS.text }}>
          📰 行业舆情动态
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {sentimentData.map(function(item, index) {
            var impactColor = getImpactColor(item.impact);
            var isLast = index === sentimentData.length - 1;

            return (
              <div key={index} style={{ display: 'flex', gap: '20px', position: 'relative' }}>
                {/* 时间线 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '20px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: impactColor, border: '2px solid ' + COLORS.bg, zIndex: 1, flexShrink: 0 }}></div>
                  {!isLast ? <div style={{ width: '2px', flex: 1, background: 'rgba(0,212,255,0.1)', minHeight: '20px' }}></div> : null}
                </div>

                {/* 内容 */}
                <div style={{ flex: 1, paddingBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: COLORS.textSecondary }}>{formatDate(item.date)}</span>
                    <span style={{ padding: '2px 8px', background: impactColor + '20', color: impactColor, fontSize: '11px', borderRadius: '10px', fontWeight: '600' }}>{item.impact}</span>
                    <span style={{ padding: '2px 8px', background: 'rgba(0,212,255,0.1)', color: COLORS.accent, fontSize: '11px', borderRadius: '10px' }}>{getCategoryIcon(item.category)} {item.category}</span>
                  </div>

                  <div style={{ fontSize: '16px', fontWeight: '600', color: COLORS.text, marginBottom: '8px', lineHeight: '1.5' }}>
                    {item.title}
                  </div>

                  <div style={{ fontSize: '13px', color: COLORS.textSecondary, lineHeight: '1.7', marginBottom: '8px' }}>
                    {item.summary}
                  </div>

                  {item.analysis ? (
                    <div style={{ padding: '12px 16px', background: 'rgba(124,58,237,0.06)', borderLeft: '3px solid #7c3aed', borderRadius: '0 8px 8px 0', marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#7c3aed', marginBottom: '4px' }}>💡 影响分析</div>
                      <div style={{ fontSize: '13px', color: COLORS.textSecondary, lineHeight: '1.6' }}>{item.analysis}</div>
                    </div>
                  ) : null}

                  {item.source ? (
                    <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>
                      📎 来源: {item.source}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
