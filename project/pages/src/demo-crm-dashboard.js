// ============================================================
// CRM 销售仪表盘 - 自定义页面
// ============================================================

// 表单 ID 配置
var FORMS = {
  customer: 'FORM-48FB56AFA31E43B09BDE30B7165D3E92D7WT',  // 客户信息表
  opportunity: 'FORM-ECCF67D4CC994968B2675C9CBD0F04A536P0',  // 商机管理表
  contract: 'FORM-66D473275377454DB51AC8577788E536UB4R'  // 合同审批表
};

// 字段 ID 别名
var FIELDS = {
  // 客户信息表
  customerType: 'radioField_l1h43yhd1',    // 客户类型
  customerLevel: 'selectField_l1h54iojj',   // 客户级别
  customerName: 'textField_l1h42qsqz',      // 客户名称
  // 商机管理表
  opportunityStage: 'selectField_ozj64pdqc',  // 商机阶段
  expectedAmount: 'numberField_ozj651thb',    // 预计金额
  opportunityName: 'textField_ozj624rw0',     // 商机名称
  followUpRecords: 'tableField_ozj7cibrf',    // 跟进记录(子表)
  // 合同审批表
  contractAmount: 'numberField_rvie67pbf',    // 合同金额
  contractName: 'textField_rvid2vb2q'         // 合同名称
};

// 商机阶段列表
var OPPORTUNITY_STAGES = ['初步接触', '需求确认', '方案报价', '谈判', '赢单', '输单'];

// 密度配置
var DENSITY_CONFIG = {
  compact: {
    cardPadding: '8px 12px',
    fontSize: '12px',
    lineHeight: '1.4',
    sectionGap: '8px',
    titleSize: '14px',
    metricSize: '20px',
    tableRowHeight: '32px'
  },
  comfortable: {
    cardPadding: '16px 20px',
    fontSize: '14px',
    lineHeight: '1.6',
    sectionGap: '16px',
    titleSize: '16px',
    metricSize: '28px',
    tableRowHeight: '44px'
  }
};

// ============================================================
// 状态管理
// ============================================================

var _customState = {
  density: 'compact',  // 默认紧凑模式
  loading: true,
  customerCount: 0,
  opportunityCount: 0,
  contractTotal: 0,
  monthlyNewCustomers: 0,
  stageStats: {},  // 各阶段商机数量
  recentOpportunities: [],  // 最近商机列表
  refreshTimer: null
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
  var that = this;
  // 初始加载数据
  this.loadAllData();
  // 设置 30 秒自动刷新
  _customState.refreshTimer = setInterval(function() {
    that.loadAllData();
  }, 30000);
}

export function didUnmount() {
  // 清理定时器
  if (_customState.refreshTimer) {
    clearInterval(_customState.refreshTimer);
    _customState.refreshTimer = null;
  }
}

// ============================================================
// 数据加载方法
// ============================================================

export function loadAllData() {
  var that = this;
  _customState.loading = true;
  this.forceUpdate();
  
  // 并行加载所有数据（商机查询已合并为单个请求，避免并发限流）
  Promise.all([
    that.loadCustomerCount(),
    that.loadOpportunityData(),
    that.loadContractTotal(),
    that.loadMonthlyNewCustomers()
  ]).then(function() {
    _customState.loading = false;
    that.forceUpdate();
  }).catch(function() {
    _customState.loading = false;
    that.forceUpdate();
  });
}

export function loadCustomerCount() {
  var that = this;
  return this.utils.yida.searchFormDatas({
    formUuid: FORMS.customer,
    pageSize: 1,
    currentPage: 1
  }).then(function(res) {
    _customState.customerCount = res.totalCount || 0;
  }).catch(function(err) {
    that.utils.toast({ title: '加载客户数据失败', type: 'error' });
  });
}

// 合并商机查询：一次请求获取商机总数、阶段统计、最近商机
export function loadOpportunityData() {
  var that = this;
  var stats = {};
  OPPORTUNITY_STAGES.forEach(function(stage) {
    stats[stage] = 0;
  });
  
  return this.utils.yida.searchFormDatas({
    formUuid: FORMS.opportunity,
    pageSize: 100,
    currentPage: 1
  }).then(function(res) {
    // 1. 设置商机总数
    _customState.opportunityCount = res.totalCount || 0;
    
    // 2. 设置最近商机（取前10条）
    var data = res.data || [];
    _customState.recentOpportunities = data.slice(0, 10);
    
    // 3. 统计阶段分布
    data.forEach(function(item) {
      var stage = item.formData[FIELDS.opportunityStage];
      if (stage && stats.hasOwnProperty(stage)) {
        stats[stage]++;
      }
    });
    
    // 如果数据超过100条，继续加载分页完善阶段统计
    if (res.totalCount > 100) {
      return that.loadAllStageStats(res.totalCount, stats);
    }
    _customState.stageStats = stats;
  }).catch(function(err) {
    that.utils.toast({ title: '加载商机数据失败', type: 'error' });
  });
}

export function loadContractTotal() {
  var that = this;
  return this.utils.yida.searchFormDatas({
    formUuid: FORMS.contract,
    pageSize: 100,
    currentPage: 1
  }).then(function(res) {
    var total = 0;
    var data = res.data || [];
    data.forEach(function(item) {
      var amount = item.formData[FIELDS.contractAmount] || 0;
      total += Number(amount) || 0;
    });
    // 如果数据超过100条，继续查询
    if (res.totalCount > 100) {
      return that.loadAllContractAmounts(res.totalCount, total);
    }
    _customState.contractTotal = total;
  }).catch(function(err) {
    that.utils.toast({ title: '加载合同数据失败', type: 'error' });
  });
}

export function loadAllContractAmounts(totalCount, currentTotal) {
  var that = this;
  var pages = Math.ceil(totalCount / 100);
  var promises = [];
  
  for (var i = 2; i <= pages; i++) {
    promises.push(
      that.utils.yida.searchFormDatas({
        formUuid: FORMS.contract,
        pageSize: 100,
        currentPage: i
      })
    );
  }
  
  return Promise.all(promises).then(function(results) {
    var total = currentTotal;
    results.forEach(function(res) {
      var data = res.data || [];
      data.forEach(function(item) {
        var amount = item.formData[FIELDS.contractAmount] || 0;
        total += Number(amount) || 0;
      });
    });
    _customState.contractTotal = total;
  }).catch(function(err) {
    that.utils.toast({ title: '加载合同数据失败', type: 'error' });
  });
}

export function loadMonthlyNewCustomers() {
  var that = this;
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth() + 1;
  var monthStr = month < 10 ? '0' + month : '' + month;
  var createFrom = year + '-' + monthStr + '-01';
  var createTo = year + '-' + monthStr + '-31';
  
  return this.utils.yida.searchFormDatas({
    formUuid: FORMS.customer,
    pageSize: 1,
    currentPage: 1,
    createFrom: createFrom,
    createTo: createTo
  }).then(function(res) {
    _customState.monthlyNewCustomers = res.totalCount || 0;
  }).catch(function(err) {
    that.utils.toast({ title: '加载本月客户数据失败', type: 'error' });
  });
}

// loadAllStageStats: 加载超过100条时的分页数据，用于完善阶段统计
export function loadAllStageStats(totalCount, currentStats) {
  var that = this;
  var pages = Math.ceil(totalCount / 100);
  var promises = [];
  
  for (var i = 2; i <= pages; i++) {
    promises.push(
      that.utils.yida.searchFormDatas({
        formUuid: FORMS.opportunity,
        pageSize: 100,
        currentPage: i
      })
    );
  }
  
  return Promise.all(promises).then(function(results) {
    var stats = currentStats;
    results.forEach(function(res) {
      var data = res.data || [];
      data.forEach(function(item) {
        var stage = item.formData[FIELDS.opportunityStage];
        if (stage && stats.hasOwnProperty(stage)) {
          stats[stage]++;
        }
      });
    });
    _customState.stageStats = stats;
  }).catch(function(err) {
    that.utils.toast({ title: '加载商机阶段数据失败', type: 'error' });
  });
}

// ============================================================
// 交互方法
// ============================================================

export function switchDensity(densityKey) {
  _customState.density = densityKey;
  this.forceUpdate();
}

export function refreshData() {
  this.loadAllData();
  this.utils.toast({ title: '刷新成功', type: 'success' });
}

// ============================================================
// 辅助方法
// ============================================================

export function formatMoney(num) {
  if (num === null || num === undefined) return '0';
  var n = Number(num);
  if (isNaN(n)) return '0';
  if (n >= 10000) {
    return (n / 10000).toFixed(1) + '万';
  }
  return n.toLocaleString();
}

export function getStageColor(stage) {
  var colorMap = {
    '初步接触': '#1677FF',
    '需求确认': '#722ED1',
    '方案报价': '#FA8C16',
    '谈判': '#13C2C2',
    '赢单': '#52C41A',
    '输单': '#FF4D4F'
  };
  return colorMap[stage] || '#86909C';
}

// ============================================================
// 渲染方法
// ============================================================

export function renderDensityToggle(d) {
  var that = this;
  var options = [
    { key: 'compact', label: '紧凑' },
    { key: 'comfortable', label: '舒适' }
  ];
  
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {options.map(function(option) {
        var isActive = _customState.density === option.key;
        return (
          <button
            key={option.key}
            onClick={function() { that.switchDensity(option.key); }}
            style={{
              height: '24px',
              padding: '0 10px',
              fontSize: '12px',
              border: '1px solid ' + (isActive ? 'var(--color-brand1-6)' : '#E5E6EB'),
              borderRadius: '4px',
              background: isActive ? 'var(--color-brand1-1)' : '#fff',
              color: isActive ? 'var(--color-brand1-6)' : '#4E5969',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function renderMetricCard(title, value, unit, color, d) {
  return (
    <div style={{
      flex: 1,
      minWidth: '0',
      background: '#FFFFFF',
      borderRadius: '8px',
      padding: d.cardPadding,
      border: '1px solid #E5E6EB',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
    }}>
      <div style={{
        fontSize: d.fontSize,
        color: '#86909C',
        marginBottom: '4px'
      }}>
        {title}
      </div>
      <div style={{
        fontSize: d.metricSize,
        fontWeight: 600,
        color: color || '#1D2129',
        lineHeight: 1.2
      }}>
        {value}
        {unit && <span style={{ fontSize: d.fontSize, fontWeight: 400, marginLeft: '2px' }}>{unit}</span>}
      </div>
    </div>
  );
}

export function renderStageStats(d) {
  var that = this;
  var stats = _customState.stageStats;
  var total = 0;
  OPPORTUNITY_STAGES.forEach(function(stage) {
    total += stats[stage] || 0;
  });
  
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '8px',
      padding: d.cardPadding,
      border: '1px solid #E5E6EB',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
    }}>
      <div style={{
        fontSize: d.titleSize,
        fontWeight: 600,
        color: '#1D2129',
        marginBottom: d.sectionGap,
        paddingBottom: '8px',
        borderBottom: '1px solid #F2F3F5'
      }}>
        商机阶段分布
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {OPPORTUNITY_STAGES.map(function(stage) {
          var count = stats[stage] || 0;
          var percent = total > 0 ? (count / total * 100) : 0;
          var color = that.getStageColor(stage);
          
          return (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '60px',
                fontSize: d.fontSize,
                color: '#4E5969',
                flexShrink: 0
              }}>
                {stage}
              </div>
              <div style={{
                flex: 1,
                height: '16px',
                background: '#F2F3F5',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: percent + '%',
                  height: '100%',
                  background: color,
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{
                width: '50px',
                fontSize: d.fontSize,
                color: '#1D2129',
                textAlign: 'right',
                flexShrink: 0
              }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function renderRecentOpportunities(d) {
  var that = this;
  var opportunities = _customState.recentOpportunities;
  
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '8px',
      padding: d.cardPadding,
      border: '1px solid #E5E6EB',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
    }}>
      <div style={{
        fontSize: d.titleSize,
        fontWeight: 600,
        color: '#1D2129',
        marginBottom: d.sectionGap,
        paddingBottom: '8px',
        borderBottom: '1px solid #F2F3F5'
      }}>
        最近商机
      </div>
      {opportunities.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '24px',
          color: '#C9CDD4',
          fontSize: d.fontSize
        }}>
          暂无商机数据
        </div>
      ) : (
        <div style={{ overflow: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: d.fontSize
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F2F3F5' }}>
                <th style={{ padding: '8px', textAlign: 'left', color: '#86909C', fontWeight: 500 }}>商机名称</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#86909C', fontWeight: 500 }}>阶段</th>
                <th style={{ padding: '8px', textAlign: 'right', color: '#86909C', fontWeight: 500 }}>预计金额</th>
                <th style={{ padding: '8px', textAlign: 'left', color: '#86909C', fontWeight: 500 }}>负责人</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map(function(item, index) {
                var formData = item.formData || {};
                var name = formData[FIELDS.opportunityName] || '-';
                var stage = formData[FIELDS.opportunityStage] || '-';
                var amount = formData[FIELDS.expectedAmount];
                var originator = item.originator || {};
                var originatorName = originator.name;
                var displayName = '-';
                if (originatorName) {
                  displayName = originatorName.zh_CN || originatorName.en_US || originatorName;
                  if (typeof displayName === 'object') {
                    displayName = '-';
                  }
                }
                
                return (
                  <tr key={item.formInstId || index} style={{
                    borderBottom: '1px solid #F2F3F5',
                    height: d.tableRowHeight
                  }}>
                    <td style={{ padding: '8px', color: '#1D2129', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: that.getStageColor(stage),
                        background: that.getStageColor(stage) + '15'
                      }}>
                        {stage}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#1D2129' }}>
                      {amount != null ? '¥' + that.formatMoney(amount) : '-'}
                    </td>
                    <td style={{ padding: '8px', color: '#4E5969' }}>
                      {displayName}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 主渲染函数
// ============================================================

export function renderJsx() {
  var that = this;
  var timestamp = this.state.timestamp;
  var d = DENSITY_CONFIG[_customState.density] || DENSITY_CONFIG.compact;
  var isMobile = this.utils.isMobile();
  
  var pageStyle = {
    minHeight: '100vh',
    background: '#F7F8FA',
    padding: isMobile ? '12px' : d.cardPadding,
    borderRadius: '0 !important',
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
    boxSizing: 'border-box'
  };
  
  return (
    <div style={pageStyle}>
      {/* 隐藏的时间戳，用于触发重渲染 */}
      <div style={{ display: 'none' }}>{timestamp}</div>
      
      {/* 顶部标题栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: d.sectionGap,
        padding: d.cardPadding,
        background: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E5E6EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{
          fontSize: d.titleSize,
          fontWeight: 600,
          color: '#1D2129'
        }}>
          CRM 销售仪表盘
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={function() { that.refreshData(); }}
            style={{
              height: '24px',
              padding: '0 10px',
              fontSize: '12px',
              border: '1px solid #E5E6EB',
              borderRadius: '4px',
              background: '#fff',
              color: '#4E5969',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            刷新
          </button>
          {that.renderDensityToggle(d)}
        </div>
      </div>
      
      {/* 加载状态 */}
      {_customState.loading && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#86909C',
          fontSize: d.fontSize
        }}>
          数据加载中...
        </div>
      )}
      
      {/* 指标卡片区域 */}
      <div style={{
        display: 'flex',
        gap: d.sectionGap,
        marginBottom: d.sectionGap,
        flexWrap: isMobile ? 'wrap' : 'nowrap'
      }}>
        {that.renderMetricCard('客户总数', _customState.customerCount, '家', '#1677FF', d)}
        {that.renderMetricCard('商机总数', _customState.opportunityCount, '个', '#722ED1', d)}
        {that.renderMetricCard('合同总额', '¥' + that.formatMoney(_customState.contractTotal), '', '#52C41A', d)}
        {that.renderMetricCard('本月新增客户', _customState.monthlyNewCustomers, '家', '#FA8C16', d)}
      </div>
      
      {/* 下方区域：阶段统计 + 最近商机 */}
      <div style={{
        display: 'flex',
        gap: d.sectionGap,
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        <div style={{ flex: isMobile ? 'none' : '0 0 360px', width: isMobile ? '100%' : 'auto' }}>
          {that.renderStageStats(d)}
        </div>
        <div style={{ flex: 1 }}>
          {that.renderRecentOpportunities(d)}
        </div>
      </div>
    </div>
  );
}
