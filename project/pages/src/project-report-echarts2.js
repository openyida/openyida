/* 数据源报表: REPORT-Y9C66H91UBA46AV4M1SH69T7DBDR2DFI9Q8NMB (项目数据看板 v2) */
var REPORT_FORM_UUID = "REPORT-Y9C66H91UBA46AV4M1SH69T7DBDR2DFI9Q8NMB";
var FORM_UUID = "FORM-E4CA4FA5DC44463D85C0CAC3799DC27EEUS7";

var _customState = {
  loading: false,
  filters: {
    status: "",
    priority: ""
  },
  indicatorData: {
    projectCount: 0,
    totalBudget: 0
  },
  pieChartData: [],
  barBudgetData: [],
  lineChartData: [],
  tableData: [],
  tablePagination: {
    currentPage: 1,
    pageSize: 10,
    total: 0
  }
};

var _prdId = null;
var _echartsLoaded = false;
var _chartInstances = {};

var _getState = function() {
  return _customState;
};

export function forceUpdate() {
  this.setState({ _ts: Date.now() });
}

// ─── prdId 获取 ──────────────────────────────────────────────────────────────
var _fetchPrdId = function() {
  var appType = window.pageConfig && window.pageConfig.appType;
  var csrfToken = window.g_config && window.g_config._csrf_token;
  var baseUrl = window.location.origin;
  var url = baseUrl + "/dingtalk/web/" + appType
    + "/query/formnav/getFormNavigationListByOrder.json"
    + "?_api=Nav.queryList&_mock=false&_csrf_token=" + encodeURIComponent(csrfToken);

  return fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      "accept": "application/json, text/json",
      "x-requested-with": "XMLHttpRequest"
    }
  })
    .then(function(resp) { return resp.json(); })
    .then(function(res) {
      if (res.success && Array.isArray(res.content)) {
        var targetNav = res.content.find(function(item) {
          return item.formUuid === REPORT_FORM_UUID;
        });
        if (targetNav && targetNav.topicId) {
          _prdId = targetNav.topicId;
          console.log("[报表] prdId 获取成功（精确匹配）:", _prdId);
          return _prdId;
        }
        var reportNav = res.content.find(function(item) {
          return item.formType === "report" && item.topicId;
        });
        if (reportNav) {
          _prdId = reportNav.topicId;
          console.log("[报表] prdId 获取成功（兜底匹配）:", _prdId);
          return _prdId;
        }
        throw new Error("应用导航菜单中未找到包含 topicId 的报表");
      }
      throw new Error(res.errorMsg || "获取应用导航菜单失败");
    });
};

// ─── 报表数据请求（自定义页面必须用 /dingtalk/web/）────────────────────────
var _fetchReportData = function(cid, componentClassName, dataSetKey, filterValueMap) {
  var appType = window.pageConfig && window.pageConfig.appType;
  var csrfToken = window.g_config && window.g_config._csrf_token;
  var body = new URLSearchParams({
    timezone: "GMT+8",
    _tb_token_: csrfToken,
    _csrf_token: csrfToken,
    _csrf: csrfToken,
    prdId: _prdId,
    pageId: REPORT_FORM_UUID,
    pageName: "report",
    cid: cid,
    cname: "",
    componentClassName: componentClassName,
    queryContext: JSON.stringify({
      filterValueMap: filterValueMap || {},
      dim2table: true
    }),
    dataSetKey: dataSetKey
  });
  var url = "/dingtalk/web/" + appType
    + "/visual/visualizationDataRpc/getDataAsync.json";
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    credentials: "include"
  })
    .then(function(r) { return r.json(); })
    .then(function(result) {
      if (result.success) return result.content;
      throw new Error(result.errorMsg || "报表数据请求失败");
    });
};

// ─── 指标卡：项目总数 + 总预算（同一个组件返回两个字段）────────────────────
var _fetchIndicatorData = function(filters) {
  return _fetchReportData(
    "node_ocn7pea2nbpylz",
    "YoushuSimpleIndicatorCard",
    "youshuData",
    _buildFilterValueMap(filters, FILTER_KEYS.indicator)
  ).then(function(content) {
    var data = content && content.data || [];
    if (data.length > 0) {
      return {
        projectCount: Number(data[0]["field_c734tyg7"] || 0),
        totalBudget: Number(data[0]["field_65ojjjx3"] || 0)
      };
    }
    return { projectCount: 0, totalBudget: 0 };
  });
};

// ─── 饼图：按项目状态分布 ────────────────────────────────────────────────────
var _fetchPieData = function(filters) {
  return _fetchReportData(
    "node_ochm80eka5fr10",
    "YoushuPieChart",
    "chartData",
    _buildFilterValueMap(filters, FILTER_KEYS.pie)
  ).then(function(content) {
    var data = content && content.data || [];
    return data.map(function(item) {
      return {
        name: item["field_dlpcajx4"] || "未知",
        value: Number(item["field_thigj8hd"] || 0)
      };
    });
  });
};

// ─── 柱状图：按优先级预算总额 ────────────────────────────────────────────────
var _fetchBarBudgetData = function(filters) {
  return _fetchReportData(
    "node_ocdwgcyg2sbk8x",
    "YoushuGroupedBarChart",
    "chartData",
    _buildFilterValueMap(filters, FILTER_KEYS.barBudget)
  ).then(function(content) {
    var data = content && content.data || [];
    return data.map(function(item) {
      return {
        name: item["field_wbycv2s1"] || "未知",
        value: Number(item["field_cmzs1880"] || 0)
      };
    });
  });
};

// ─── 折线图：按月项目数趋势 ──────────────────────────────────────────────────
var _fetchLineChartData = function(filters) {
  return _fetchReportData(
    "node_ocmn8v5zyq2",
    "YoushuLineChart",
    "chartData",
    _buildFilterValueMap(filters, FILTER_KEYS.line)
  ).then(function(content) {
    var data = content && content.data || [];
    return data.map(function(item) {
      return {
        month: item["field_mn8v6oj1"] || "",
        count: Number(item["field_mn8v6oiz"] || 0)
      };
    });
  });
};
// ─── 明细表：通过 searchFormDatas 获取原始记录 ───────────────────────────────
var _fetchTableData = function(selfCtx, filters, pagination) {
  var searchFieldJson = {};
  if (filters.status) {
    searchFieldJson["selectField_j2xeiduk"] = filters.status;
  }
  if (filters.priority) {
    searchFieldJson["selectField_j2xeiguj"] = filters.priority;
  }
  return selfCtx.utils.yida.searchFormDatas({
    formUuid: FORM_UUID,
    currentPage: pagination.currentPage,
    pageSize: pagination.pageSize,
    searchFieldJson: JSON.stringify(searchFieldJson)
  }).then(function(result) {
    var rawData = (result && result.data) || [];
    var totalCount = (result && result.totalCount) || 0;
    var flatData = rawData.map(function(item) {
      var formData = item.formData || {};
      return {
        formInstId: item.formInstId || "",
        projectName: formData["textField_j2xehece"] || "-",
        status: formData["selectField_j2xeiduk"] || "-",
        priority: formData["selectField_j2xeiguj"] || "-",
        owner: (item.originator && item.originator.name &&
          (item.originator.name.zh_CN || item.originator.name.en_US)) || "-",
        budget: formData["numberField_d9h5xczk"] != null
          ? Number(formData["numberField_d9h5xczk"]) : 0,
        startDate: _formatDate(formData["dateField_j2xe9bqx"])
      };
    });
    return { data: flatData, total: totalCount };
  });
};

// ─── 工具函数 ────────────────────────────────────────────────────────────────
var _formatDate = function(timestamp) {
  if (!timestamp) return "-";
  var date = new Date(Number(timestamp));
  if (isNaN(date.getTime())) return "-";
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
};

var _formatNumber = function(num) {
  if (num == null) return "-";
  if (num >= 100000000) return (num / 100000000).toFixed(2) + "亿";
  if (num >= 10000) return (num / 10000).toFixed(2) + "万";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return String(num);
};

var _getStatusColor = function(status) {
  var colorMap = {
    "未开始": "#94a3b8",
    "进行中": "#3b82f6",
    "已完成": "#22c55e",
    "已暂停": "#f59e0b",
    "已取消": "#ef4444"
  };
  return colorMap[status] || "#64748b";
};

var _getPriorityColor = function(priority) {
  var colorMap = { "高": "#ef4444", "中": "#f59e0b", "低": "#22c55e" };
  return colorMap[priority] || "#64748b";
};

// ─── ECharts 渲染 ────────────────────────────────────────────────────────────
var _renderPieChart = function() {
  var state = _getState();
  var chartData = state.pieChartData;
  if (!chartData || chartData.length === 0) return;
  var dom = document.getElementById("pie-chart-container");
  if (!dom) return;
  if (_chartInstances.pie) _chartInstances.pie.dispose();
  var chart = window.echarts.init(dom);
  chart.setOption({
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#ffffff" },
      borderRadius: 8,
      padding: 12,
      formatter: "{b}: {c} 个 ({d}%)"
    },
    legend: {
      orient: "vertical",
      right: "5%",
      top: "center",
      textStyle: { color: "#64748b", fontSize: 12 }
    },
    series: [{
      type: "pie",
      radius: ["42%", "72%"],
      center: ["38%", "50%"],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: "#ffffff", borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 15, fontWeight: "bold", color: "#1e293b" } },
      labelLine: { show: false },
      data: chartData,
      color: ["#6366f1", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"]
    }]
  });
  _chartInstances.pie = chart;
  window.addEventListener("resize", function() { chart.resize(); });
};

var _renderBarBudgetChart = function() {
  var state = _getState();
  var chartData = state.barBudgetData;
  if (!chartData || chartData.length === 0) return;
  var dom = document.getElementById("bar-budget-container");
  if (!dom) return;
  if (_chartInstances.barBudget) _chartInstances.barBudget.dispose();
  var chart = window.echarts.init(dom);
  chart.setOption({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#ffffff" },
      borderRadius: 8,
      padding: 12,
      axisPointer: { type: "shadow" },
      formatter: function(params) {
        return params[0].name + "<br/>" + _formatNumber(params[0].value);
      }
    },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: chartData.map(function(item) { return item.name; }),
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisLabel: { color: "#64748b", fontSize: 12 },
      axisTick: { show: false }
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisLabel: {
        color: "#64748b",
        fontSize: 12,
        formatter: function(val) { return _formatNumber(val); }
      },
      splitLine: { lineStyle: { color: "#f1f5f9", type: [4, 4] } }
    },
    series: [{
      type: "bar",
      data: chartData.map(function(item) { return item.value; }),
      barWidth: "50%",
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "#3b82f6" },
          { offset: 1, color: "#06b6d4" }
        ])
      },
      emphasis: {
        itemStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#06b6d4" },
            { offset: 1, color: "#0ea5e9" }
          ])
        }
      },
      label: {
        show: true,
        position: "top",
        color: "#475569",
        fontSize: 12,
        fontWeight: 600,
        formatter: function(params) { return _formatNumber(params.value); }
      }
    }]
  });
  _chartInstances.barBudget = chart;
  window.addEventListener("resize", function() { chart.resize(); });
};

var _renderLineChart = function() {
  var state = _getState();
  var chartData = state.lineChartData;
  if (!chartData || chartData.length === 0) return;
  var dom = document.getElementById("line-chart-container");
  if (!dom) return;
  if (_chartInstances.line) _chartInstances.line.dispose();
  var chart = window.echarts.init(dom);
  var months = chartData.map(function(item) { return item.month; });
  var counts = chartData.map(function(item) { return item.count; });
  chart.setOption({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,23,42,0.92)",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#ffffff" },
      borderRadius: 8,
      padding: 12
    },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: months,
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisLabel: { color: "#64748b", fontSize: 11 },
      axisTick: { show: false },
      boundaryGap: false
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisLabel: { color: "#64748b", fontSize: 12 },
      splitLine: { lineStyle: { color: "#f1f5f9", type: [4, 4] } }
    },
    series: [{
      type: "line",
      data: counts,
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      lineStyle: { color: "#6366f1", width: 2.5 },
      itemStyle: { color: "#6366f1", borderColor: "#ffffff", borderWidth: 2 },
      areaStyle: {
        color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(99,102,241,0.25)" },
          { offset: 1, color: "rgba(99,102,241,0.02)" }
        ])
      },
      label: {
        show: counts.length <= 12,
        position: "top",
        color: "#475569",
        fontSize: 11,
        fontWeight: 600
      }
    }]
  });
  _chartInstances.line = chart;
  window.addEventListener("resize", function() { chart.resize(); });
};

var _renderAllCharts = function() {
  _renderPieChart();
  _renderBarBudgetChart();
  _renderLineChart();
};

// ─── 数据加载 ────────────────────────────────────────────────────────────────
// 每个图表组件有独立的 filterKey（从各组件 dataViewQueryModel.filterList 中提取）
// 格式：{ status: filterKey, priority: filterKey }
var FILTER_KEYS = {
  indicator: {
    status:   "filter-rqhm4wvn-evp5y4p3-lo7e90ll-xjw6xzyq",
    priority: "filter-c33f0mmz-fu2pyn72-8cf3xx0z-sl1w6iad"
  },
  pie: {
    status:   "filter-jucb5hl2-b8e7eir5-a0utw3tr-jm7r8bc8",
    priority: "filter-t1qmc28n-89ewq9yo-jtgpwrxg-g7wz622b"
  },
  barBudget: {
    status:   "filter-e8gngf2c-p5c4a59l-1khcd5ig-7nqztl8g",
    priority: "filter-by1s63iy-h63vcbnv-ulxs2nr0-o9ronoxg"
  },
  line: {
    status:   "filter-255365b3-6c9f-42d1-a265-e7f385ebab0b",
    priority: "filter-62bddbcb-3398-41dd-bd00-0cb82ff52608"
  },
  table: {
    status:   "filter-zpybhpvs-jfb2s87a-qmvrjgdz-c6i3pha8",
    priority: "filter-pj98ji0m-9af1c6yh-h128dhlb-m0759elc"
  }
};

var _buildFilterValueMap = function(filters, keys) {
  var filterValueMap = {};
  // 宜搭筛选器的值必须是数组格式，如 ["已完成"]
  if (filters.status) {
    filterValueMap[keys.status] = [filters.status];
  }
  if (filters.priority) {
    filterValueMap[keys.priority] = [filters.priority];
  }
  return filterValueMap;
};

export function loadAllData() {
  var self = this;
  var state = _getState();

  _customState.loading = true;
  this.forceUpdate();

  Promise.all([
    _fetchIndicatorData(state.filters),
    _fetchPieData(state.filters),
    _fetchBarBudgetData(state.filters),
    _fetchLineChartData(state.filters)
  ])
    .then(function(results) {
      _customState.indicatorData = results[0];
      _customState.pieChartData = results[1];
      _customState.barBudgetData = results[2];
      _customState.lineChartData = results[3];
      _customState.loading = false;
      self.forceUpdate();
      if (_echartsLoaded) {
        setTimeout(_renderAllCharts, 100);
      }
    })
    .catch(function(err) {
      console.error("[loadAllData] 加载图表数据失败:", err);
      _customState.loading = false;
      self.forceUpdate();
    });

  _fetchTableData(self, state.filters, state.tablePagination)
    .then(function(result) {
      _customState.tableData = result.data;
      _customState.tablePagination = Object.assign({}, state.tablePagination, {
        total: result.total
      });
      self.forceUpdate();
    })
    .catch(function(err) {
      console.error("[loadAllData] 加载明细表失败:", err);
    });
}

export function loadTablePage(page) {
  var self = this;
  var state = _getState();
  _customState.tablePagination = Object.assign({}, state.tablePagination, { currentPage: page });
  _fetchTableData(self, state.filters, _customState.tablePagination)
    .then(function(result) {
      _customState.tableData = result.data;
      _customState.tablePagination = Object.assign({}, _customState.tablePagination, {
        total: result.total
      });
      self.forceUpdate();
    })
    .catch(function(err) {
      console.error("[loadTablePage] 加载分页数据失败:", err);
    });
}

// ─── 生命周期 ────────────────────────────────────────────────────────────────
export function didMount() {
  var self = this;
  var script = document.createElement("script");
  script.src = "https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js";
  script.onload = function() {
    _echartsLoaded = true;
    _fetchPrdId()
      .then(function() { self.loadAllData(); })
      .catch(function(err) {
        console.error("[didMount] 获取 prdId 失败:", err);
        _customState.loading = false;
        self.forceUpdate();
      });
  };
  script.onerror = function() {
    self.utils.toast({ title: "ECharts 加载失败，请刷新重试", type: "error" });
  };
  document.head.appendChild(script);
}

export function didUnmount() {
  Object.keys(_chartInstances).forEach(function(key) {
    if (_chartInstances[key]) _chartInstances[key].dispose();
  });
  _chartInstances = {};
}

// ─── 渲染 ────────────────────────────────────────────────────────────────────
export function renderJsx() {
  var self = this;
  var state = _getState();
  var appType = window.pageConfig && window.pageConfig.appType;
  var totalPages = Math.ceil(state.tablePagination.total / state.tablePagination.pageSize) || 1;

  var cardStyle = {
    backgroundColor: "#ffffff",
    borderRadius: "10px",
    padding: "20px",
    border: "1px solid #e2e8f0"
  };

  var sectionTitleStyle = {
    fontSize: "15px",
    fontWeight: "600",
    color: "#1e293b",
    margin: "0 0 16px 0"
  };

  var thStyle = {
    padding: "10px 14px",
    textAlign: "left",
    fontWeight: 600,
    color: "#475569",
    fontSize: 12,
    borderBottom: "2px solid #e2e8f0",
    background: "#f8fafc",
    whiteSpace: "nowrap"
  };

  var tdStyle = {
    padding: "10px 14px",
    borderBottom: "1px solid #f1f5f9",
    color: "#475569",
    fontSize: 13
  };

  return (
    <div style={{
      backgroundColor: "#f0f5ff",
      minHeight: "100vh",
      padding: "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{ display: "none" }}>{this.state._ts}</div>

      {/* ── 页头 + 筛选器 ── */}
      <div style={Object.assign({}, cardStyle, { marginBottom: "20px" })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1e293b", margin: 0 }}>
            📊 项目数据看板 v2
          </h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "#64748b" }}>项目状态：</span>
            <select
              value={state.filters.status}
              onChange={(e) => {
                _customState.filters = Object.assign({}, state.filters, { status: e.target.value });
                _customState.tablePagination = Object.assign({}, state.tablePagination, { currentPage: 1 });
                setTimeout(function() { self.loadAllData(); }, 50);
              }}
              style={{
                padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
                fontSize: "13px", color: "#334155", backgroundColor: "#ffffff", minWidth: "110px"
              }}
            >
              <option value="">全部</option>
              <option value="未开始">未开始</option>
              <option value="进行中">进行中</option>
              <option value="已完成">已完成</option>
              <option value="已暂停">已暂停</option>
              <option value="已取消">已取消</option>
            </select>
            <span style={{ fontSize: "13px", color: "#64748b" }}>优先级：</span>
            <select
              value={state.filters.priority}
              onChange={(e) => {
                _customState.filters = Object.assign({}, state.filters, { priority: e.target.value });
                _customState.tablePagination = Object.assign({}, state.tablePagination, { currentPage: 1 });
                setTimeout(function() { self.loadAllData(); }, 50);
              }}
              style={{
                padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: "6px",
                fontSize: "13px", color: "#334155", backgroundColor: "#ffffff", minWidth: "100px"
              }}
            >
              <option value="">全部</option>
              <option value="高">高</option>
              <option value="中">中</option>
              <option value="低">低</option>
            </select>
          </div>
        </div>

        {/* ── KPI 指标卡 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
          <div style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            borderRadius: "10px", padding: "20px", color: "#ffffff"
          }}>
            <div style={{ fontSize: "13px", opacity: 0.85, marginBottom: "8px" }}>项目总数</div>
            <div style={{ fontSize: "32px", fontWeight: "700", fontFeatureSettings: "\"tnum\"" }}>
              {state.indicatorData.projectCount}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "4px" }}>个项目</div>
          </div>
          <div style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
            borderRadius: "10px", padding: "20px", color: "#ffffff"
          }}>
            <div style={{ fontSize: "13px", opacity: 0.85, marginBottom: "8px" }}>总预算</div>
            <div style={{ fontSize: "32px", fontWeight: "700", fontFeatureSettings: "\"tnum\"" }}>
              {_formatNumber(state.indicatorData.totalBudget)}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "4px" }}>元</div>
          </div>
        </div>
      </div>

      {/* ── 折线图：按月项目数趋势（全宽）── */}
      <div style={Object.assign({}, cardStyle, { marginBottom: "20px" })}>
        <h3 style={sectionTitleStyle}>项目数量月度趋势</h3>
        <div id="line-chart-container" style={{ height: "240px" }}></div>
      </div>

      {/* ── 饼图 + 柱状图 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>项目状态分布</h3>
          <div id="pie-chart-container" style={{ height: "260px" }}></div>
        </div>
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>各优先级预算总额</h3>
          <div id="bar-budget-container" style={{ height: "260px" }}></div>
        </div>
      </div>

      {/* ── 数据明细表格 ── */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>项目明细</h3>
        <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                <th style={thStyle}>项目名称</th>
                <th style={thStyle}>项目状态</th>
                <th style={thStyle}>优先级</th>
                <th style={thStyle}>负责人</th>
                <th style={thStyle}>开始日期</th>
                <th style={Object.assign({}, thStyle, { textAlign: "right" })}>项目预算（元）</th>
                <th style={Object.assign({}, thStyle, { textAlign: "center" })}>详情</th>
              </tr>
            </thead>
            <tbody>
              {state.tableData.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
                    暂无数据
                  </td>
                </tr>
              ) : state.tableData.map(function(row, index) {
                var statusColor = _getStatusColor(row.status);
                var priorityColor = _getPriorityColor(row.priority);
                return (
                  <tr key={row.formInstId || index} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    <td style={Object.assign({}, tdStyle, { color: "#3b82f6", fontWeight: 500, cursor: "pointer" })}
                      onClick={() => {
                        window.open("/" + appType + "/formDetail/" + FORM_UUID + "?formInstId=" + row.formInstId, "_blank");
                      }}>
                      {row.projectName}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 4,
                        fontSize: 11, fontWeight: 600,
                        color: statusColor, background: statusColor + "14", border: "1px solid " + statusColor + "30"
                      }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 4,
                        fontSize: 11, fontWeight: 600,
                        color: priorityColor, background: priorityColor + "14", border: "1px solid " + priorityColor + "30"
                      }}>
                        {row.priority}
                      </span>
                    </td>
                    <td style={tdStyle}>{row.owner}</td>
                    <td style={tdStyle}>{row.startDate}</td>
                    <td style={Object.assign({}, tdStyle, { textAlign: "right", fontWeight: 600, fontFeatureSettings: "\"tnum\"" })}>
                      {row.budget != null ? row.budget.toLocaleString() : "-"}
                    </td>
                    <td style={Object.assign({}, tdStyle, { textAlign: "center" })}>
                      <span
                        style={{ color: "#3b82f6", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                        onClick={() => {
                          window.open("/" + appType + "/formDetail/" + FORM_UUID + "?formInstId=" + row.formInstId, "_blank");
                        }}
                      >
                        详情 →
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 分页器 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #f1f5f9"
        }}>
          <div style={{ fontSize: "13px", color: "#64748b" }}>
            共 {state.tablePagination.total} 条记录
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              disabled={state.tablePagination.currentPage <= 1}
              onClick={() => { self.loadTablePage(state.tablePagination.currentPage - 1); }}
              style={{
                padding: "5px 12px", border: "1px solid #e2e8f0", borderRadius: "6px",
                backgroundColor: state.tablePagination.currentPage <= 1 ? "#f1f5f9" : "#ffffff",
                color: state.tablePagination.currentPage <= 1 ? "#94a3b8" : "#334155",
                cursor: state.tablePagination.currentPage <= 1 ? "not-allowed" : "pointer",
                fontSize: "13px"
              }}
            >
              上一页
            </button>
            <span style={{ fontSize: "13px", color: "#334155", padding: "0 4px" }}>
              {state.tablePagination.currentPage} / {totalPages}
            </span>
            <button
              disabled={state.tablePagination.currentPage >= totalPages}
              onClick={() => { self.loadTablePage(state.tablePagination.currentPage + 1); }}
              style={{
                padding: "5px 12px", border: "1px solid #e2e8f0", borderRadius: "6px",
                backgroundColor: state.tablePagination.currentPage >= totalPages ? "#f1f5f9" : "#ffffff",
                color: state.tablePagination.currentPage >= totalPages ? "#94a3b8" : "#334155",
                cursor: state.tablePagination.currentPage >= totalPages ? "not-allowed" : "pointer",
                fontSize: "13px"
              }}
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* 加载遮罩 */}
      {state.loading && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999
        }}>
          <div style={{
            backgroundColor: "#ffffff", padding: "24px 32px", borderRadius: "10px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "12px"
          }}>
            <div style={{
              width: "32px", height: "32px",
              border: "3px solid #e2e8f0", borderTopColor: "#6366f1",
              borderRadius: "50%", animation: "spin 0.8s linear infinite"
            }}></div>
            <div style={{ fontSize: "14px", color: "#64748b" }}>数据加载中...</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
