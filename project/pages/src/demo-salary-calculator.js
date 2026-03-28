// ============================================================
// 状态管理
// ============================================================

const _customState = {
  // 输入参数
  monthlySalary: 25000,
  bonusMonths: 1,
  city: 'beijing',
  providentFundRate: 0.12,
  socialSecurityBase: 'actual', // actual / min / max
  // 专项扣除（年度）
  childEducation: 0,
  housingLoan: 0,
  elderCare: 0,
  supplementProvidentFund: 0,
  // 高级设置展开状态
  advancedExpanded: false,
  // 计算结果
  result: null,
  // 复制状态
  copySuccess: false,
};

// 各城市社保公积金数据（2026年）
const CITY_DATA = {
  beijing:   { name: '北京',   pension: 0.08, medical: 0.02, unemployment: 0.005, minBase: 6821,  maxBase: 35283 },
  shanghai:  { name: '上海',   pension: 0.08, medical: 0.02, unemployment: 0.005, minBase: 7310,  maxBase: 36549 },
  guangzhou: { name: '广州',   pension: 0.08, medical: 0.02, unemployment: 0.005, minBase: 5765,  maxBase: 28825 },
  shenzhen:  { name: '深圳',   pension: 0.08, medical: 0.005,unemployment: 0.003, minBase: 6623,  maxBase: 33115 },
  hangzhou:  { name: '杭州',   pension: 0.08, medical: 0.02, unemployment: 0.005, minBase: 5782,  maxBase: 28910 },
  chengdu:   { name: '成都',   pension: 0.08, medical: 0.02, unemployment: 0.005, minBase: 4420,  maxBase: 22100 },
  wuhan:     { name: '武汉',   pension: 0.08, medical: 0.02, unemployment: 0.005, minBase: 4200,  maxBase: 21000 },
  nanjing:   { name: '南京',   pension: 0.08, medical: 0.02, unemployment: 0.005, minBase: 5500,  maxBase: 27500 },
  xian:      { name: '西安',   pension: 0.08, medical: 0.02, unemployment: 0.005, minBase: 4200,  maxBase: 21000 },
  custom:    { name: '自定义', pension: 0.08, medical: 0.02, unemployment: 0.005, minBase: 5000,  maxBase: 25000 },
};

// 个税累进税率表（年度应纳税所得额）
const TAX_BRACKETS = [
  { limit: 36000,   rate: 0.03, deduction: 0 },
  { limit: 144000,  rate: 0.10, deduction: 2520 },
  { limit: 300000,  rate: 0.20, deduction: 16920 },
  { limit: 420000,  rate: 0.25, deduction: 31920 },
  { limit: 660000,  rate: 0.30, deduction: 52920 },
  { limit: 960000,  rate: 0.35, deduction: 85920 },
  { limit: Infinity, rate: 0.45, deduction: 181920 },
];

/**
 * 计算年度个税
 */
function calcAnnualTax(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  for (var i = 0; i < TAX_BRACKETS.length; i++) {
    if (taxableIncome <= TAX_BRACKETS[i].limit) {
      return taxableIncome * TAX_BRACKETS[i].rate - TAX_BRACKETS[i].deduction;
    }
  }
  return 0;
}

/**
 * 核心计算引擎
 */
function calculate(state) {
  var salary = parseFloat(state.monthlySalary) || 0;
  var bonusMonths = parseFloat(state.bonusMonths) || 0;
  var cityData = CITY_DATA[state.city] || CITY_DATA.beijing;
  var pfRate = parseFloat(state.providentFundRate) || 0.12;

  // 确定社保基数
  var socialBase;
  if (state.socialSecurityBase === 'min') {
    socialBase = cityData.minBase;
  } else if (state.socialSecurityBase === 'max') {
    socialBase = cityData.maxBase;
  } else {
    socialBase = Math.min(Math.max(salary, cityData.minBase), cityData.maxBase);
  }

  // 公积金基数（同社保基数逻辑）
  var pfBase = Math.min(Math.max(salary, cityData.minBase), cityData.maxBase);

  // 月度五险一金个人部分
  var monthlyPension = socialBase * cityData.pension;
  var monthlyMedical = socialBase * cityData.medical;
  var monthlyUnemployment = socialBase * cityData.unemployment;
  var monthlyProvidentFund = pfBase * pfRate;
  var monthlySupplementPF = parseFloat(state.supplementProvidentFund) || 0;
  var monthlySocialInsurance = monthlyPension + monthlyMedical + monthlyUnemployment + monthlyProvidentFund + monthlySupplementPF;

  // 年度五险一金
  var annualSocialInsurance = monthlySocialInsurance * 12;

  // 税前年薪
  var annualBonus = salary * bonusMonths;
  var annualGrossSalary = salary * 12 + annualBonus;

  // 专项扣除年度合计
  var annualSpecialDeduction = (parseFloat(state.childEducation) || 0) * 12
    + (parseFloat(state.housingLoan) || 0) * 12
    + (parseFloat(state.elderCare) || 0) * 12;

  // 应纳税所得额（年度）
  var annualTaxableIncome = annualGrossSalary - 60000 - annualSocialInsurance - annualSpecialDeduction;

  // 年度个税
  var annualTax = calcAnnualTax(annualTaxableIncome);

  // 月度个税（平均）
  var monthlyTax = annualTax / 12;

  // 税后月收入
  var monthlyNetSalary = salary - monthlySocialInsurance - monthlyTax;

  // 税后年薪
  var annualNetSalary = monthlyNetSalary * 12 + annualBonus * (1 - (annualTax > 0 ? annualTax / annualGrossSalary : 0));

  // 平均时薪（按176小时/月）
  var hourlyRate = annualGrossSalary / (176 * 12);

  // 实际税率
  var effectiveTaxRate = annualGrossSalary > 0 ? (annualTax / annualGrossSalary) : 0;

  return {
    annualGrossSalary: round2(annualGrossSalary),
    annualNetSalary: round2(annualNetSalary),
    monthlyNetSalary: round2(monthlyNetSalary),
    hourlyRate: round2(hourlyRate),
    monthlySocialInsurance: round2(monthlySocialInsurance),
    monthlyTax: round2(monthlyTax),
    annualTax: round2(annualTax),
    annualSocialInsurance: round2(annualSocialInsurance),
    effectiveTaxRate: round2(effectiveTaxRate * 100),
    breakdown: {
      monthlyPension: round2(monthlyPension),
      monthlyMedical: round2(monthlyMedical),
      monthlyUnemployment: round2(monthlyUnemployment),
      monthlyProvidentFund: round2(monthlyProvidentFund),
      monthlySupplementPF: round2(monthlySupplementPF),
    },
  };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value) {
  if (value === undefined || value === null) return '0.00';
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getCustomState(key) {
  if (key) return _customState[key];
  return { ..._customState };
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
  // 从 localStorage 恢复上次输入
  try {
    var saved = localStorage.getItem('salary_calculator_state');
    if (saved) {
      var parsed = JSON.parse(saved);
      Object.keys(parsed).forEach(function(key) {
        if (key in _customState) {
          _customState[key] = parsed[key];
        }
      });
    }
  } catch (e) {
    // 忽略存储读取错误
  }

  // 初始计算
  _customState.result = calculate(_customState);
  this.forceUpdate();
}

export function didUnmount() {}

export function saveToStorage() {
  try {
    var toSave = {
      monthlySalary: _customState.monthlySalary,
      bonusMonths: _customState.bonusMonths,
      city: _customState.city,
      providentFundRate: _customState.providentFundRate,
      socialSecurityBase: _customState.socialSecurityBase,
      childEducation: _customState.childEducation,
      housingLoan: _customState.housingLoan,
      elderCare: _customState.elderCare,
      supplementProvidentFund: _customState.supplementProvidentFund,
    };
    localStorage.setItem('salary_calculator_state', JSON.stringify(toSave));
  } catch (e) {}
}

export function triggerCalculate() {
  _customState.result = calculate(_customState);
  this.saveToStorage();
  this.forceUpdate();
}

export function handleCalculate() {
  _customState.result = calculate(_customState);
  this.saveToStorage();
  this.forceUpdate();
}

export function handleCopy() {
  var result = _customState.result || {};
  if (!result.annualGrossSalary) return;
  var state = _customState;
  var cityName = (CITY_DATA[state.city] || CITY_DATA.beijing).name;
  var text = [
    '📊 薪资计算结果',
    '━━━━━━━━━━━━━━━━━━',
    '城市：' + cityName,
    '月薪：¥' + formatMoney(state.monthlySalary),
    '年终奖：' + state.bonusMonths + ' 个月',
    '━━━━━━━━━━━━━━━━━━',
    '税前年薪：¥' + formatMoney(result.annualGrossSalary),
    '税后月收入：¥' + formatMoney(result.monthlyNetSalary),
    '税后年薪：¥' + formatMoney(result.annualNetSalary),
    '平均时薪：¥' + formatMoney(result.hourlyRate) + '/小时',
    '月缴五险一金：¥' + formatMoney(result.monthlySocialInsurance),
    '月缴个税：¥' + formatMoney(result.monthlyTax),
    '综合税率：' + result.effectiveTaxRate + '%',
    '━━━━━━━━━━━━━━━━━━',
    '计算结果仅供参考，以实际劳动合同和当地政策为准',
  ].join('\n');

  try {
    navigator.clipboard.writeText(text).then(() => {
      _customState.copySuccess = true;
      this.forceUpdate();
      setTimeout(() => {
        _customState.copySuccess = false;
        this.forceUpdate();
      }, 2000);
    });
  } catch (e) {
    this.utils.toast({ title: '复制失败，请手动复制', type: 'error' });
  }
}

export function toggleAdvanced() {
  _customState.advancedExpanded = !_customState.advancedExpanded;
  this.forceUpdate();
}

// ============================================================
// 渲染
// ============================================================

export function renderJsx() {
  var { timestamp } = this.state;
  var state = _customState;
  var result = state.result || {};

  // ---- 样式定义 ----
  var styles = {
    page: {
      minHeight: '100vh',
      background: '#F3F4F6',
      fontFamily: "'PingFang SC', 'Microsoft YaHei', Inter, sans-serif",
      color: '#1F2937',
    },
    header: {
      background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      padding: '24px 32px',
      color: '#fff',
    },
    headerTitle: {
      fontSize: '24px',
      fontWeight: '700',
      margin: '0 0 4px 0',
      letterSpacing: '0.5px',
    },
    headerSubtitle: {
      fontSize: '13px',
      opacity: '0.85',
      margin: 0,
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px 16px',
      display: 'flex',
      gap: '24px',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
    },
    inputPanel: {
      flex: '0 0 380px',
      minWidth: '320px',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
      padding: '24px',
    },
    resultPanel: {
      flex: '1 1 500px',
      minWidth: '300px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
    sectionTitle: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '2px solid #D1FAE5',
    },
    fieldGroup: {
      marginBottom: '16px',
    },
    label: {
      display: 'block',
      fontSize: '13px',
      color: '#6B7280',
      marginBottom: '6px',
      fontWeight: '500',
    },
    input: {
      width: '100%',
      height: '40px',
      border: '1.5px solid #E5E7EB',
      borderRadius: '8px',
      padding: '0 12px',
      fontSize: '14px',
      color: '#1F2937',
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s',
      fontFamily: "'Roboto Mono', 'SF Mono', monospace",
    },
    select: {
      width: '100%',
      height: '40px',
      border: '1.5px solid #E5E7EB',
      borderRadius: '8px',
      padding: '0 12px',
      fontSize: '14px',
      color: '#1F2937',
      outline: 'none',
      boxSizing: 'border-box',
      background: '#fff',
      cursor: 'pointer',
    },
    sliderRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    slider: {
      flex: 1,
      accentColor: '#10B981',
    },
    sliderValue: {
      minWidth: '60px',
      textAlign: 'right',
      fontSize: '14px',
      fontWeight: '600',
      color: '#10B981',
      fontFamily: "'Roboto Mono', monospace",
    },
    quickBtns: {
      display: 'flex',
      gap: '8px',
      marginTop: '8px',
      flexWrap: 'wrap',
    },
    quickBtn: {
      padding: '4px 12px',
      borderRadius: '20px',
      border: '1.5px solid #10B981',
      background: '#fff',
      color: '#10B981',
      fontSize: '12px',
      cursor: 'pointer',
      fontWeight: '500',
    },
    quickBtnActive: {
      padding: '4px 12px',
      borderRadius: '20px',
      border: '1.5px solid #10B981',
      background: '#10B981',
      color: '#fff',
      fontSize: '12px',
      cursor: 'pointer',
      fontWeight: '500',
    },
    advancedToggle: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      padding: '10px 0',
      borderTop: '1px solid #F3F4F6',
      marginTop: '8px',
      color: '#6B7280',
      fontSize: '13px',
      fontWeight: '500',
    },
    calcBtn: {
      width: '100%',
      height: '44px',
      background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      marginTop: '16px',
      letterSpacing: '1px',
    },
    // 结果卡片
    gridRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
    },
    card: {
      background: '#fff',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
    },
    cardHighlight: {
      background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 16px rgba(16,185,129,0.25)',
      color: '#fff',
    },
    cardLabel: {
      fontSize: '12px',
      color: '#9CA3AF',
      marginBottom: '8px',
      fontWeight: '500',
    },
    cardLabelLight: {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.8)',
      marginBottom: '8px',
      fontWeight: '500',
    },
    cardValue: {
      fontSize: '26px',
      fontWeight: '700',
      color: '#10B981',
      fontFamily: "'Roboto Mono', 'SF Mono', monospace",
      lineHeight: 1.2,
    },
    cardValueLight: {
      fontSize: '26px',
      fontWeight: '700',
      color: '#fff',
      fontFamily: "'Roboto Mono', 'SF Mono', monospace",
      lineHeight: 1.2,
    },
    cardNote: {
      fontSize: '11px',
      color: '#9CA3AF',
      marginTop: '4px',
    },
    cardNoteLight: {
      fontSize: '11px',
      color: 'rgba(255,255,255,0.7)',
      marginTop: '4px',
    },
    // 扣除明细
    detailCard: {
      background: '#fff',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
    },
    detailRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #F9FAFB',
      fontSize: '13px',
    },
    detailLabel: {
      color: '#6B7280',
    },
    detailValue: {
      fontWeight: '600',
      color: '#1F2937',
      fontFamily: "'Roboto Mono', monospace",
    },
    detailValueRed: {
      fontWeight: '600',
      color: '#EF4444',
      fontFamily: "'Roboto Mono', monospace",
    },
    detailValueGreen: {
      fontWeight: '600',
      color: '#10B981',
      fontFamily: "'Roboto Mono', monospace",
    },
    // 进度条
    progressBar: {
      height: '8px',
      borderRadius: '4px',
      background: '#F3F4F6',
      overflow: 'hidden',
      marginTop: '4px',
    },
    // 复制按钮
    actionRow: {
      display: 'flex',
      gap: '10px',
    },
    copyBtn: {
      flex: 1,
      height: '40px',
      background: '#fff',
      border: '1.5px solid #10B981',
      borderRadius: '8px',
      color: '#10B981',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
    },
    disclaimer: {
      textAlign: 'center',
      fontSize: '11px',
      color: '#9CA3AF',
      padding: '16px',
      lineHeight: 1.6,
    },
  };

  // ---- 事件处理 ----

  function handleSalaryChange(e) {
    _customState.monthlySalary = parseFloat(e.target.value) || 0;
  }

  function handleCityChange(e) {
    _customState.city = e.target.value;
    triggerCalculate();
  }

  function handleBonusSlider(e) {
    _customState.bonusMonths = parseFloat(e.target.value);
    triggerCalculate();
  }

  function handlePFRateChange(e) {
    _customState.providentFundRate = parseFloat(e.target.value) || 0.12;
    triggerCalculate();
  }

  function handleSSBaseChange(e) {
    _customState.socialSecurityBase = e.target.value;
    triggerCalculate();
  }

  function handleSpecialDeductionChange(field, e) {
    _customState[field] = parseFloat(e.target.value) || 0;
  }

  function handleSupplementPFChange(e) {
    _customState.supplementProvidentFund = parseFloat(e.target.value) || 0;
  }



  // ---- 计算进度条宽度 ----

  var cityOptions = Object.keys(CITY_DATA).map(function(key) {
    return <option key={key} value={key}>{CITY_DATA[key].name}</option>;
  });

  var bonusQuickOptions = [
    { label: '13薪', value: 1 },
    { label: '14薪', value: 2 },
    { label: '15薪', value: 3 },
    { label: '16薪', value: 4 },
  ];

  return (
    <div style={styles.page}>
      <div style={{ display: 'none' }}>{timestamp}</div>

      {/* 顶部标题栏 */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>💰 个人薪资计算器</h1>
        <p style={styles.headerSubtitle}>精准估算收入结构 · 让你看清每一分钱的去向 · 数据基于 2026 年政策</p>
      </div>

      <div style={styles.container}>
        {/* 左侧输入区 */}
        <div style={styles.inputPanel}>
          <div style={styles.sectionTitle}>📝 基础信息</div>

          {/* 月薪 */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>月薪（税前，元）</label>
            <input
              id="input-salary"
              type="number"
              style={styles.input}
              defaultValue={state.monthlySalary}
              placeholder="例如：25000"
              onChange={(e) => { _customState.monthlySalary = parseFloat(e.target.value) || 0; }}
              onBlur={(e) => { this.handleCalculate(); }}
            />
          </div>

          {/* 工作城市 */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>工作城市</label>
            <select style={styles.select} defaultValue={state.city} onChange={(e) => { _customState.city = e.target.value; this.triggerCalculate(); }}>
              {cityOptions}
            </select>
          </div>

          {/* 年终奖月数 */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>年终奖月数：<span style={{ color: '#10B981', fontWeight: 700 }}>{state.bonusMonths} 个月</span></label>
            <div style={styles.sliderRow}>
              <input
                type="range"
                min="0"
                max="6"
                step="0.5"
                style={styles.slider}
                defaultValue={state.bonusMonths}
                onChange={(e) => { _customState.bonusMonths = parseFloat(e.target.value); this.triggerCalculate(); }}
              />
              <span style={styles.sliderValue}>{state.bonusMonths}月</span>
            </div>
            <div style={styles.quickBtns}>
              {bonusQuickOptions.map(function(opt) {
                return (
                  <button
                    key={opt.value}
                    style={state.bonusMonths === opt.value ? styles.quickBtnActive : styles.quickBtn}
                    onClick={(e) => { _customState.bonusMonths = opt.value; this.triggerCalculate(); }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 高级设置折叠 */}
          <div style={styles.advancedToggle} onClick={(e) => { this.toggleAdvanced(); }}>
            <span>⚙️ 高级设置（公积金比例、专项扣除等）</span>
            <span>{state.advancedExpanded ? '▲' : '▼'}</span>
          </div>

          {state.advancedExpanded && (
            <div>
              {/* 公积金比例 */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>公积金比例：<span style={{ color: '#10B981', fontWeight: 700 }}>{Math.round((state.providentFundRate || 0.12) * 100)}%</span></label>
                <div style={styles.sliderRow}>
                defaultValue={state.providentFundRate}
                onChange={(e) => { _customState.providentFundRate = parseFloat(e.target.value) || 0.12; this.triggerCalculate(); }}
                  <span style={styles.sliderValue}>{Math.round((state.providentFundRate || 0.12) * 100)}%</span>
                </div>
              </div>

              {/* 社保方案 */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>社保缴纳基数</label>
                <select style={styles.select} defaultValue={state.socialSecurityBase} onChange={(e) => { _customState.socialSecurityBase = e.target.value; this.triggerCalculate(); }}>
                  <option value="actual">按实际工资（推荐）</option>
                  <option value="min">按最低基数</option>
                  <option value="max">按上限基数</option>
                </select>
              </div>

              {/* 专项扣除 */}
              <div style={{ ...styles.sectionTitle, marginTop: '12px' }}>🏠 专项附加扣除（月度，元）</div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>子女教育</label>
                <input
                  type="number"
                  style={styles.input}
                  defaultValue={state.childEducation}
                  placeholder="0（每孩每月最高2000）"
                  onChange={(e) => { _customState.childEducation = parseFloat(e.target.value) || 0; }}
                  onBlur={(e) => { this.handleCalculate(); }}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>住房贷款利息</label>
                <input
                  type="number"
                  style={styles.input}
                  defaultValue={state.housingLoan}
                  placeholder="0（每月最高1000）"
                  onChange={(e) => { _customState.housingLoan = parseFloat(e.target.value) || 0; }}
                  onBlur={(e) => { this.handleCalculate(); }}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>赡养老人</label>
                <input
                  type="number"
                  style={styles.input}
                  defaultValue={state.elderCare}
                  placeholder="0（每月最高3000）"
                  onChange={(e) => { _customState.elderCare = parseFloat(e.target.value) || 0; }}
                  onBlur={(e) => { this.handleCalculate(); }}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>补充公积金（月度）</label>
                <input
                  type="number"
                  style={styles.input}
                  defaultValue={state.supplementProvidentFund}
                  placeholder="0"
                  onChange={(e) => { _customState.supplementProvidentFund = parseFloat(e.target.value) || 0; }}
                  onBlur={(e) => { this.handleCalculate(); }}
                />
              </div>
            </div>
          )}

        </div>

        {/* 右侧结果区 */}
        <div style={styles.resultPanel}>
          {/* 4宫格核心指标 */}
          <div style={styles.gridRow}>
            {/* 税后月收入 - 最突出 */}
            <div style={{ ...styles.cardHighlight, gridColumn: 'span 2' }}>
              <div style={styles.cardLabelLight}>💵 税后月收入</div>
              <div style={styles.cardValueLight}>¥ {formatMoney(result.monthlyNetSalary || 0)}</div>
              <div style={styles.cardNoteLight}>实际每月到手金额</div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardLabel}>📅 税前年薪</div>
              <div style={styles.cardValue}>¥ {formatMoney(result.annualGrossSalary || 0)}</div>
              <div style={styles.cardNote}>含年终奖</div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardLabel}>🏦 税后年薪</div>
              <div style={styles.cardValue}>¥ {formatMoney(result.annualNetSalary || 0)}</div>
              <div style={styles.cardNote}>实际到手</div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardLabel}>⏰ 平均时薪</div>
              <div style={styles.cardValue}>¥ {formatMoney(result.hourlyRate || 0)}</div>
              <div style={styles.cardNote}>按 176 小时/月</div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardLabel}>📊 综合税率</div>
              <div style={styles.cardValue}>{result.effectiveTaxRate || 0}%</div>
              <div style={styles.cardNote}>个税 / 税前年薪</div>
            </div>
          </div>

          {/* 月度资金流向明细 */}
          <div style={styles.detailCard}>
            <div style={styles.sectionTitle}>📋 月度资金流向明细</div>

            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>税前月薪</span>
              <span style={styles.detailValue}>¥ {formatMoney(state.monthlySalary || 0)}</span>
            </div>

            {/* 进度条可视化 */}
            <div style={{ margin: '12px 0 16px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>月薪构成分布</div>
              {(function() {
                var gross = result.annualGrossSalary / 12 || 0;
                var net = result.monthlyNetSalary || 0;
                var si = result.monthlySocialInsurance || 0;
                var tax = result.monthlyTax || 0;
                var netPct = gross > 0 ? (net / gross) * 100 : 0;
                var siPct = gross > 0 ? (si / gross) * 100 : 0;
                var taxPct = gross > 0 ? (tax / gross) * 100 : 0;
                return (
                  <div>
                    <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
                      <div style={{ width: netPct + '%', background: '#10B981', borderRadius: '6px 0 0 6px', transition: 'width 0.4s' }} title={'到手 ' + netPct.toFixed(1) + '%'} />
                      <div style={{ width: siPct + '%', background: '#3B82F6', transition: 'width 0.4s' }} title={'五险一金 ' + siPct.toFixed(1) + '%'} />
                      <div style={{ width: taxPct + '%', background: '#9CA3AF', borderRadius: '0 6px 6px 0', transition: 'width 0.4s' }} title={'个税 ' + taxPct.toFixed(1) + '%'} />
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: '#6B7280' }}>
                      <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: '#10B981', marginRight: '4px' }} />到手 {netPct.toFixed(1)}%</span>
                      <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: '#3B82F6', marginRight: '4px' }} />五险一金 {siPct.toFixed(1)}%</span>
                      <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: '#9CA3AF', marginRight: '4px' }} />个税 {taxPct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>— 养老保险（{Math.round((CITY_DATA[state.city] || CITY_DATA.beijing).pension * 100)}%）</span>
              <span style={styles.detailValueRed}>- ¥ {formatMoney((result.breakdown || {}).monthlyPension || 0)}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>— 医疗保险（{((CITY_DATA[state.city] || CITY_DATA.beijing).medical * 100).toFixed(1)}%）</span>
              <span style={styles.detailValueRed}>- ¥ {formatMoney((result.breakdown || {}).monthlyMedical || 0)}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>— 失业保险（{((CITY_DATA[state.city] || CITY_DATA.beijing).unemployment * 100).toFixed(1)}%）</span>
              <span style={styles.detailValueRed}>- ¥ {formatMoney((result.breakdown || {}).monthlyUnemployment || 0)}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>— 住房公积金（{Math.round((state.providentFundRate || 0.12) * 100)}%）</span>
              <span style={styles.detailValueRed}>- ¥ {formatMoney((result.breakdown || {}).monthlyProvidentFund || 0)}</span>
            </div>
            {(state.supplementProvidentFund > 0) && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>— 补充公积金</span>
                <span style={styles.detailValueRed}>- ¥ {formatMoney((result.breakdown || {}).monthlySupplementPF || 0)}</span>
              </div>
            )}
            <div style={{ ...styles.detailRow, borderBottom: 'none', fontWeight: '600' }}>
              <span style={styles.detailLabel}>— 五险一金合计</span>
              <span style={styles.detailValueRed}>- ¥ {formatMoney(result.monthlySocialInsurance || 0)}</span>
            </div>
            <div style={{ ...styles.detailRow, borderBottom: 'none', fontWeight: '600' }}>
              <span style={styles.detailLabel}>— 月度个税</span>
              <span style={styles.detailValueRed}>- ¥ {formatMoney(result.monthlyTax || 0)}</span>
            </div>
            <div style={{ ...styles.detailRow, borderBottom: 'none', background: '#F0FDF4', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
              <span style={{ color: '#059669', fontWeight: '700', fontSize: '14px' }}>= 税后月收入</span>
              <span style={{ ...styles.detailValueGreen, fontSize: '18px' }}>¥ {formatMoney(result.monthlyNetSalary || 0)}</span>
            </div>
          </div>

          {/* 年度汇总 */}
          <div style={styles.detailCard}>
            <div style={styles.sectionTitle}>📆 年度汇总</div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>税前年薪（含年终奖）</span>
              <span style={styles.detailValue}>¥ {formatMoney(result.annualGrossSalary || 0)}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>年缴五险一金</span>
              <span style={styles.detailValueRed}>- ¥ {formatMoney(result.annualSocialInsurance || 0)}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>年缴个税</span>
              <span style={styles.detailValueRed}>- ¥ {formatMoney(result.annualTax || 0)}</span>
            </div>
            <div style={{ ...styles.detailRow, borderBottom: 'none', background: '#F0FDF4', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
              <span style={{ color: '#059669', fontWeight: '700', fontSize: '14px' }}>税后年薪（实际到手）</span>
              <span style={{ ...styles.detailValueGreen, fontSize: '18px' }}>¥ {formatMoney(result.annualNetSalary || 0)}</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={styles.actionRow}>
            <button style={styles.copyBtn} onClick={(e) => { this.handleCopy(); }}>
              {state.copySuccess ? '✅ 已复制！' : '📋 一键复制结果'}
            </button>
          </div>

          {/* 免责声明 */}
          <div style={styles.disclaimer}>
            ⚠️ 计算结果仅供参考，以实际劳动合同和当地政策为准。<br />
            社保比例数据基于 2026 年各城市政策，个税税率依据现行累进税率表。
          </div>
        </div>
      </div>
    </div>
  );
}
