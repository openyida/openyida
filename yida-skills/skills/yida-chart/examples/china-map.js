// ============================================================
// 中国地图示例
// 按省份展示数据分布热力图，支持 tooltip 悬浮查看详情
//
// 数据来源：宜搭原生报表（后端聚合）
// 地图数据来源：阿里云 DataV GeoJSON API（公开可信数据源）
// ============================================================

var ECHARTS_CDN = 'https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js';
var CHINA_GEO_JSON_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';
var REPORT_UUID = 'REPORT-0R8665A1ED54RG45IJWIX55W9Q8U2U6AH9XMM1';
var PRD_ID = 13085982;

// 报表组件配置
var BUDGET_TABLE_COMPONENT = {
  cid: 'YoushuTable_mmx9ha6a13',
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

// ============================================================
// 状态管理
// ============================================================

var _customState = {
  loading: true,
  chartIds: ['chart-china-map'],
  mapData: {},
  totalCount: 0,
  maxValue: 0,
  geoJsonLoaded: false,
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
  this.loadEChartsAndMap();
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
// ECharts + 地图数据加载
// ============================================================

export function loadEChartsAndMap() {
  var loadEChartsPromise = window.echarts
    ? Promise.resolve()
    : this.utils.loadScript(ECHARTS_CDN);

  loadEChartsPromise
    .then(function() {
      this.bindChartResize();
      return this.loadChinaGeoJson();
    }.bind(this))
    .then(function() {
      this.loadMapData();
    }.bind(this))
    .catch(function(error) {
      this.utils.toast({ title: '资源加载失败: ' + (error.message || '请刷新重试'), type: 'error' });
      this.setCustomState({ loading: false });
    }.bind(this));
}

/**
 * 加载中国地图 GeoJSON 数据并注册到 ECharts
 * 数据来源：阿里云 DataV（公开可信数据源）
 */
export function loadChinaGeoJson() {
  if (_customState.geoJsonLoaded) {
    return Promise.resolve();
  }
  return fetch(CHINA_GEO_JSON_URL)
    .then(function(response) {
      if (!response.ok) {
        throw new Error('地图数据加载失败: HTTP ' + response.status);
      }
      return response.json();
    })
    .then(function(geoJson) {
      window.echarts.registerMap('china', geoJson);
      _customState.geoJsonLoaded = true;
    });
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

export function loadMapData() {
  this.setCustomState({ loading: true });
  _fetchReportData(BUDGET_TABLE_COMPONENT, {})
    .then(function(content) {
      var mapData = _parseTableData(content);
      var maxValue = 0;
      mapData.forEach(function(item) {
        if (item.value > maxValue) maxValue = item.value;
      });
      // 标准化省份名称
      mapData.forEach(function(item) {
        item.name = this.normalizeProvinceName(item.name);
      }.bind(this));
      this.setCustomState({
        loading: false,
        mapData: mapData,
        totalCount: mapData.length,
        maxValue: maxValue || 100,
      });
      setTimeout(function() {
        this.renderChinaMap();
      }.bind(this), 100);
    }.bind(this))
    .catch(function(error) {
      this.utils.toast({ title: '数据加载失败: ' + error.message, type: 'error' });
      this.setCustomState({ loading: false });
    }.bind(this));
}

/**
 * 标准化省份名称，确保与 GeoJSON 中的名称一致
 * GeoJSON 中使用全称（如"北京市"、"广东省"、"内蒙古自治区"）
 */
export function normalizeProvinceName(name) {
  if (!name) return name;
  name = name.trim();

  // 省份简称 → 全称映射
  var shortToFull = {
    '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
    '河北': '河北省', '山西': '山西省', '辽宁': '辽宁省', '吉林': '吉林省',
    '黑龙江': '黑龙江省', '江苏': '江苏省', '浙江': '浙江省', '安徽': '安徽省',
    '福建': '福建省', '江西': '江西省', '山东': '山东省', '河南': '河南省',
    '湖北': '湖北省', '湖南': '湖南省', '广东': '广东省', '海南': '海南省',
    '四川': '四川省', '贵州': '贵州省', '云南': '云南省', '陕西': '陕西省',
    '甘肃': '甘肃省', '青海': '青海省', '台湾': '台湾省',
    '内蒙古': '内蒙古自治区', '广西': '广西壮族自治区',
    '西藏': '西藏自治区', '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区',
    '香港': '香港特别行政区', '澳门': '澳门特别行政区',
  };

  if (shortToFull[name]) return shortToFull[name];
  return name;
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

export function renderChinaMap() {
  var chart = this.createChart('chart-china-map');
  if (!chart) return;

  var mapData = _customState.mapData;
  var maxValue = _customState.maxValue || 100;
  var isMobile = this.utils.isMobile();

  chart.setOption({
    title: {
      text: '全国数据分布',
      left: 'center',
      textStyle: { fontSize: isMobile ? 14 : 18 },
    },
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        if (params.value === undefined || isNaN(params.value)) {
          return params.name + '：暂无数据';
        }
        return params.name + '：' + params.value;
      },
    },
    visualMap: {
      min: 0,
      max: maxValue,
      left: isMobile ? 'center' : 'left',
      bottom: isMobile ? 0 : 20,
      orient: isMobile ? 'horizontal' : 'vertical',
      itemWidth: isMobile ? 12 : 15,
      itemHeight: isMobile ? 60 : 100,
      text: ['高', '低'],
      textStyle: { fontSize: isMobile ? 10 : 12 },
      inRange: {
        color: [PALETTE.primaryLight + '33', PALETTE.primaryLight + '80', PALETTE.primaryLight, PALETTE.primary, PALETTE.textPrimary],
      },
      calculable: true,
    },
    series: [{
      name: '数据分布',
      type: 'map',
      map: 'china',
      roam: true,
      zoom: isMobile ? 1.0 : 1.2,
      scaleLimit: { min: 0.8, max: 5 },
      label: {
        show: !isMobile,
        fontSize: 9,
        color: '#333',
      },
      emphasis: {
        label: { show: true, fontSize: 12, fontWeight: 'bold' },
        itemStyle: { areaColor: '#FFD700', borderColor: '#333', borderWidth: 1 },
      },
      itemStyle: {
        areaColor: PALETTE.bg,
        borderColor: PALETTE.border,
        borderWidth: 0.5,
      },
      data: mapData,
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
  var totalCount = _customState.totalCount;
  var mapData = _customState.mapData;
  var provinceCount = (mapData || []).length;

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
    statsRow: {
      display: 'flex',
      gap: '12px',
    },
    statBadge: {
      padding: '4px 10px',
      backgroundColor: PALETTE.primaryLight + '33',
      color: PALETTE.primary,
      borderRadius: '12px',
      fontSize: '12px',
    },
    chartCard: {
      backgroundColor: PALETTE.cardBg,
      borderRadius: '8px',
      padding: isMobile ? '8px' : '20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    },
    refreshButton: {
      padding: '6px 14px',
      backgroundColor: PALETTE.primary,
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px',
      marginLeft: '8px',
    },
    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '500px',
      fontSize: '16px',
      color: PALETTE.textMuted,
    },
    tip: {
      marginTop: '12px',
      fontSize: '12px',
      color: PALETTE.textMuted,
      textAlign: 'center',
    },
  };

  var chartHeight = isMobile ? '400px' : '600px';

  if (loading) {
    return (
      <div>
        <div style={{ display: 'none' }}>{timestamp}</div>
        <div style={styles.container}>
          <div style={styles.loadingContainer}>地图数据加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'none' }}>{timestamp}</div>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div style={styles.header}>全国数据分布</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={styles.statsRow}>
              <div style={styles.statBadge}>{totalCount} 条数据</div>
              <div style={styles.statBadge}>{provinceCount} 个省份</div>
            </div>
            <button style={styles.refreshButton} onClick={(e) => { this.loadMapData(); }}>刷新</button>
          </div>
        </div>
        <div style={styles.chartCard}>
          <div id="chart-china-map" style={{ width: '100%', height: chartHeight }} />
        </div>
        <div style={styles.tip}>支持鼠标滚轮缩放和拖拽，悬浮查看详情</div>
      </div>
    </div>
  );
}
