// ============================================================
// 钉钉 AI 解决方案中心 - SA 工作台原型
// ============================================================

var _customState = {
  activeNav: 'workbench',
  activeIndustry: 'manufacturing',
  selectedSolution: 'inspection',
  diagnosisText: '客户是一家 1500 人制造企业，想用钉钉和宜搭解决设备巡检、异常上报、维修派单、管理驾驶舱的问题，现场希望 30 分钟看到可演示 Demo。',
  diagnosisMode: 'ready',
  diagnosisResult: null,
  aiLoading: false,
  aiError: '',
  materialGenerated: false,
  materialLoading: false,
  materialResult: null,
  promptCart: ['客户需求分析', '行业方案生成'],
  buildStarted: false,
  buildSubmitting: false,
  buildTaskStatus: '待生成',
  buildTaskRecordId: '',
  buildTaskError: '',
  buildSpec: null,
  buildPrompt: '',
  dashboardData: null,
  dataLoading: false,
  dataSourceLabel: '示例数据',
  dataError: '',
  _popStateHandler: null,
  _isComposing: false
};

var APP_TYPE = 'APP_WXXZPD6QF8B2NNWGJG3J';

var FORM_CONFIG = {
  customer: {
    formUuid: 'FORM-676FBB65FC1945EC830C4863B5D33463TDT5',
    fields: {
      customerName: 'textField_aewp2rp5j',
      industry: 'selectField_aewp37ca6',
      customerSize: 'selectField_aewp44d4n',
      region: 'selectField_aewp5jn67',
      owner: 'employeeField_aewp63btw',
      stage: 'selectField_aewp75b0i',
      amount: 'numberField_aewp8gy1b',
      intentLevel: 'selectField_aewq9gjo6',
      demands: 'multiSelectField_aewqaya0c',
      pain: 'textareaField_aewqbnlfw',
      decisionChain: 'selectField_aewqct6ul',
      status: 'selectField_aewqe38bk'
    }
  },
  visit: {
    formUuid: 'FORM-D6DA472F266741CCA5036EB6506C1B48S7N3',
    fields: {
      customerName: 'textField_aggg25cpn',
      owner: 'employeeField_aggg3cagc',
      visitTime: 'dateField_aggg4lo5t',
      visitType: 'selectField_aggg5iafo',
      visitStatus: 'selectField_aggg6tyu5',
      goal: 'textareaField_aggg78x1p',
      solution: 'selectField_aggg87ala',
      demoStatus: 'selectField_aggg9tywg',
      riskTags: 'multiSelectField_agghasfc6',
      aiSummary: 'textareaField_agghciolj',
      nextActions: 'tableField_agghd7l7q'
    }
  },
  solutionPackage: {
    formUuid: 'FORM-CCC466C252814048AD090156F50DAD211EYH',
    fields: {
      solutionName: 'textField_ahzv2vrqx',
      industry: 'selectField_ahzv3pix5',
      scenarios: 'multiSelectField_ahzv4vnkx',
      maturityLevel: 'selectField_ahzv541lj',
      maturityScore: 'numberField_ahzv6cx7u',
      openyidaCoverage: 'numberField_ahzv7rxdj',
      customerProblem: 'textareaField_ahzv8gccw',
      valueProp: 'textareaField_ahzv9rkh6',
      blueprint: 'textareaField_ahzwaay3p',
      prompts: 'tableField_ahzwb6bh9',
      assets: 'multiSelectField_ahzwfzczy',
      owner: 'employeeField_ahzwge548',
      status: 'selectField_ahzwhgu72'
    }
  },
  demoInstance: {
    formUuid: 'FORM-88DD6EE845464D43A2C18A85B895245AK576',
    fields: {
      demoName: 'textField_ajhc2hnzf',
      customerName: 'textField_ajhc3eszd',
      solution: 'textField_ajhc4ffn8',
      creator: 'employeeField_ajhd5nxp4',
      status: 'selectField_ajhd60inc',
      appType: 'textField_ajhd7khim',
      pageUrl: 'textField_ajhd88lv6',
      duration: 'numberField_ajhd9sef0',
      createdAt: 'dateField_ajhda7fsc',
      lastDemoAt: 'dateField_ajhdb4jan',
      feedback: 'textareaField_ajhdcpp4h',
      buildSpec: 'textareaField_bx6z13bfq',
      buildPrompt: 'textareaField_bx6z2j4v4',
      tasks: 'tableField_ajhddqugc',
      taskName: 'textField_ajhde8pga',
      taskStatus: 'selectField_ajhdfogqg',
      taskOutput: 'textareaField_ajhdgsmj5'
    }
  },
  meetingNote: {
    formUuid: 'FORM-59779ADDCF2D454EAB2B773DA788E918UL1P',
    fields: {
      customerName: 'textField_akv42xfu8',
      owner: 'employeeField_akv43h22h',
      meetingTime: 'dateField_akv44xb3l',
      source: 'selectField_akv45xqa3',
      rawNote: 'textareaField_akv46d7po',
      aiSummary: 'textareaField_akv47p8pm',
      objections: 'textareaField_akv48bnis',
      recommendReason: 'textareaField_akv49kuqj',
      todos: 'tableField_akv4ayqbr'
    }
  },
  riskCustomer: {
    formUuid: 'FORM-A885A18937284B7F86CAC5CD0F4B0D1A3FNE',
    fields: {
      customerName: 'textField_anqh2qalg',
      owner: 'employeeField_anqh34r1k',
      level: 'selectField_anqh4a48p',
      riskTypes: 'multiSelectField_anqh5ag9f',
      stage: 'selectField_anqh6urii',
      reason: 'textareaField_anqh78gju',
      aiAction: 'textareaField_anqh8nscx',
      needManager: 'radioField_anqh97c7z',
      status: 'selectField_anqicmwtk'
    }
  },
  weeklyReport: {
    formUuid: 'FORM-7DCA098A1D9A4B49B1AE7BEC0FDF7C991CXE',
    fields: {
      owner: 'employeeField_am9n2xwo2',
      activeCustomers: 'numberField_am9n4b78w',
      visits: 'numberField_am9n52joz',
      solutionDemos: 'numberField_am9n66tp8',
      demoCreates: 'numberField_am9n790ee',
      riskCustomers: 'numberField_am9n8k2ho',
      prepRate: 'numberField_am9n9eowt',
      noteRate: 'numberField_am9oan1hp',
      nextStepRate: 'numberField_am9obp4ji',
      supportNeeded: 'textareaField_am9ofxcva'
    }
  }
};

export function getCustomState(key) {
  if (key) {
    return _customState[key];
  }
  return Object.assign({}, _customState);
}

export function setCustomState(newState) {
  var skipUrlSync = !!newState.__skipUrlSync;
  Object.keys(newState).forEach((key) => {
    if (key !== '__skipUrlSync') {
      _customState[key] = newState[key];
    }
  });
  this.forceUpdate();
  if (!skipUrlSync && shouldSyncRoute(newState)) {
    updateRouteState(newState);
  }
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

export function didMount() {
  var self = this;
  this.syncNavFromUrl();
  if (typeof window !== 'undefined' && window.addEventListener) {
    _customState._popStateHandler = function() {
      self.syncNavFromUrl();
    };
    window.addEventListener('popstate', _customState._popStateHandler);
  }
  _customState.dashboardData = buildMockDashboardData();
  if (this.isYidaDataConfigured()) {
    this.loadDashboardData();
  } else {
    _customState.dataSourceLabel = '示例数据';
    this.forceUpdate();
  }
}

export function didUnmount() {
  if (typeof window !== 'undefined' && window.removeEventListener && _customState._popStateHandler) {
    window.removeEventListener('popstate', _customState._popStateHandler);
  }
  _customState._popStateHandler = null;
}

export function isYidaDataConfigured() {
  return !!(
    FORM_CONFIG.customer.formUuid &&
    FORM_CONFIG.visit.formUuid &&
    FORM_CONFIG.demoInstance.formUuid &&
    FORM_CONFIG.riskCustomer.formUuid
  );
}

export function refreshDashboardData() {
  if (!this.isYidaDataConfigured()) {
    this.setCustomState({
      dashboardData: buildMockDashboardData(),
      dataSourceLabel: '示例数据',
      dataError: ''
    });
    this.utils.toast({ title: '未配置表单映射，当前使用示例数据', type: 'warning' });
    return;
  }
  this.loadDashboardData();
}

export function fetchFormRows(formKey) {
  var config = FORM_CONFIG[formKey] || {};
  if (!config.formUuid) {
    return Promise.resolve([]);
  }
  return this.utils.yida.searchFormDatas({
    formUuid: config.formUuid,
    pageSize: 100,
    currentPage: 1
  }).then(function(res) {
    return normalizeRows(res);
  }).catch(function(err) {
    throw err;
  });
}

export function loadDashboardData() {
  var self = this;
  self.setCustomState({
    dataLoading: true,
    dataError: '',
    dataSourceLabel: '宜搭表单'
  });

  Promise.all([
    self.fetchFormRows('customer'),
    self.fetchFormRows('visit'),
    self.fetchFormRows('demoInstance'),
    self.fetchFormRows('riskCustomer'),
    self.fetchFormRows('weeklyReport'),
    self.fetchFormRows('meetingNote')
  ]).then(function(results) {
    var data = buildDashboardDataFromRows(results[0], results[1], results[2], results[3], results[4], results[5]);
    self.setCustomState({
      dashboardData: data,
      dataLoading: false,
      dataSourceLabel: '宜搭表单',
      dataError: ''
    });
  }).catch(function(err) {
    var message = err && err.message ? err.message : '数据加载失败';
    self.setCustomState({
      dashboardData: buildMockDashboardData(),
      dataLoading: false,
      dataSourceLabel: '示例数据',
      dataError: message
    });
    self.utils.toast({ title: '宜搭数据加载失败，已使用示例数据', type: 'warning' });
  });
}

export function getDashboardData() {
  return _customState.dashboardData || buildMockDashboardData();
}

export function syncNavFromUrl() {
  var routeState = getRouteState();
  var nextState = {};
  if (routeState.activeNav && routeState.activeNav !== _customState.activeNav) {
    nextState.activeNav = routeState.activeNav;
  }
  if (routeState.activeIndustry && routeState.activeIndustry !== _customState.activeIndustry) {
    nextState.activeIndustry = routeState.activeIndustry;
  }
  if (routeState.selectedSolution && routeState.selectedSolution !== _customState.selectedSolution) {
    nextState.selectedSolution = routeState.selectedSolution;
  }
  if (Object.keys(nextState).length > 0) {
    nextState.__skipUrlSync = true;
    this.setCustomState(nextState);
  }
}

export function selectNav(key) {
  if (!isKnownNavKey(key)) {
    return;
  }
  this.setCustomState({ activeNav: key });
}

export function selectIndustry(key) {
  var solutionKey = industryDefaultSolutions[key] || 'inspection';
  this.setCustomState({
    activeIndustry: key,
    selectedSolution: solutionKey,
    diagnosisMode: 'industry',
    diagnosisResult: buildDiagnosisResult(_customState.diagnosisText || '', key, findSolutionByKey(solutionKey))
  });
}

export function selectSolution(key) {
  this.setCustomState({
    selectedSolution: key,
    diagnosisMode: 'solution',
    diagnosisResult: buildDiagnosisResult(_customState.diagnosisText || '', _customState.activeIndustry, findSolutionByKey(key))
  });
}

export function openIndustrySolution(key) {
  var solutionKey = industryDefaultSolutions[key] || 'inspection';
  this.setCustomState({
    activeNav: 'solutions',
    activeIndustry: key,
    selectedSolution: solutionKey,
    diagnosisMode: 'industry',
    diagnosisResult: buildDiagnosisResult(_customState.diagnosisText || '', key, findSolutionByKey(solutionKey))
  });
}

export function prepareVisitPlan(item, action) {
  if (!item) {
    this.utils.toast({ title: '暂无可处理的拜访计划', type: 'warning' });
    return;
  }
  var text = buildVisitPlanDiagnosisText(item);
  var industryKey = inferIndustryKey(text);
  var solutionKey = industryDefaultSolutions[industryKey] || 'inspection';
  var result = buildDiagnosisResult(text, industryKey, findSolutionByKey(solutionKey));
  this.setCustomState({
    diagnosisText: text,
    activeIndustry: industryKey,
    selectedSolution: solutionKey,
    diagnosisMode: 'generated',
    diagnosisResult: result,
    materialGenerated: false,
    materialResult: null,
    aiError: ''
  });
  if (action === 'build') {
    this.createDemo();
    return;
  }
  this.runDiagnosis();
}

export function prepareRiskCustomer(item) {
  if (!item) {
    this.utils.toast({ title: '暂无风险客户', type: 'warning' });
    return;
  }
  var text = buildRiskCustomerDiagnosisText(item);
  var industryKey = inferIndustryKey(text);
  var solutionKey = industryDefaultSolutions[industryKey] || 'inspection';
  this.setCustomState({
    diagnosisText: text,
    activeIndustry: industryKey,
    selectedSolution: solutionKey,
    diagnosisMode: 'ready',
    diagnosisResult: null,
    materialGenerated: false,
    materialResult: null,
    aiError: ''
  });
  this.runDiagnosis();
}

export function handleDiagnosisChange(e) {
  if (_customState._isComposing) {
    return;
  }
  _customState.diagnosisText = e.target.value;
}

export function runDiagnosis() {
  var self = this;
  var text = _customState.diagnosisText || '';
  if (!text.trim()) {
    this.utils.toast({ title: '先输入客户需求或会议纪要', type: 'warning' });
    return;
  }
  var fallbackIndustryKey = inferIndustryKey(text);
  var fallbackSolutionKey = industryDefaultSolutions[fallbackIndustryKey] || 'inspection';
  var fallbackSolution = findSolutionByKey(fallbackSolutionKey);

  this.setCustomState({
    activeNav: 'workbench',
    activeIndustry: fallbackIndustryKey,
    selectedSolution: fallbackSolutionKey,
    diagnosisMode: 'thinking',
    diagnosisResult: null,
    aiLoading: true,
    aiError: '',
    materialGenerated: false
  });

  this.callYidaAI(buildYidaAiPrompt(text)).then(function(aiText) {
    var result = normalizeAiDiagnosis(aiText, text);
    self.setCustomState({
      activeIndustry: result.industryKey,
      selectedSolution: result.solutionKey,
      diagnosisMode: 'generated',
      diagnosisResult: result,
      aiLoading: false,
      aiError: ''
    });
    self.utils.toast({ title: '宜搭 AI 已生成推荐方案', type: 'success' });
  }).catch(function(err) {
    var message = err && err.message ? err.message : '宜搭 AI 暂不可用';
    self.setCustomState({
      activeIndustry: fallbackIndustryKey,
      selectedSolution: fallbackSolutionKey,
      diagnosisMode: 'generated',
      diagnosisResult: buildDiagnosisResult(text, fallbackIndustryKey, fallbackSolution),
      aiLoading: false,
      aiError: message
    });
    self.utils.toast({ title: '宜搭 AI 暂不可用，已使用本地诊断', type: 'warning' });
  });
}

export function createDemo() {
  if (_customState.buildSubmitting) {
    this.utils.toast({ title: '搭建任务正在提交中', type: 'warning' });
    return;
  }
  var self = this;
  var activeSolution = this.getActiveSolution();
  var result = _customState.diagnosisResult || buildDiagnosisResult(_customState.diagnosisText || '', _customState.activeIndustry, activeSolution);
  var buildSpec = createBuildSpec(result, activeSolution);
  var buildPrompt = buildOpenYidaRunnerPrompt(buildSpec);
  this.setCustomState({
    activeNav: 'build',
    diagnosisMode: 'building',
    buildStarted: true,
    buildSubmitting: true,
    buildTaskStatus: '写入任务中',
    buildTaskRecordId: '',
    buildTaskError: '',
    buildSpec: buildSpec,
    buildPrompt: buildPrompt,
    diagnosisResult: result
  });
  this.submitBuildTask(buildSpec, buildPrompt).then(function(recordId) {
    self.setCustomState({
      buildSubmitting: false,
      buildTaskStatus: '待搭建',
      buildTaskRecordId: recordId || ''
    });
    self.utils.toast({ title: 'OpenYida 搭建任务已写入 Demo 实例表', type: 'success' });
  }).catch(function(err) {
    var message = err && err.message ? err.message : '搭建任务写入失败';
    self.setCustomState({
      buildSubmitting: false,
      buildTaskStatus: '本地已生成',
      buildTaskError: message
    });
    self.utils.toast({ title: '已生成搭建规格，表单写入失败', type: 'warning' });
  });
}

export function submitBuildTask(buildSpec, buildPrompt) {
  var config = FORM_CONFIG.demoInstance;
  var fields = config.fields;
  var appType = getCurrentAppType();
  if (!appType) {
    return Promise.reject(new Error('未识别当前应用 AppType'));
  }

  var formData = {};
  formData[fields.demoName] = limitText(buildSpec.appName, 190);
  formData[fields.customerName] = limitText(buildSpec.customerName, 190);
  formData[fields.solution] = limitText(buildSpec.solutionTitle, 190);
  formData[fields.status] = '未开始';
  formData[fields.appType] = '';
  formData[fields.pageUrl] = '';
  formData[fields.duration] = 0;
  formData[fields.createdAt] = new Date().getTime();
  formData[fields.feedback] = limitText('OpenYida buildSpec 和执行 Prompt 已生成，等待 runner 消费。', 190);
  formData[fields.buildSpec] = JSON.stringify(buildSpec, null, 2);
  formData[fields.buildPrompt] = buildPrompt;
  formData[fields.tasks] = buildSpec.tasks.map((task) => {
    var row = {};
    row[fields.taskName] = limitText(task.name, 190);
    row[fields.taskStatus] = '未开始';
    row[fields.taskOutput] = limitText(task.output, 190);
    return row;
  });

  var userId = getLoginUserId();
  if (userId) {
    formData[fields.creator] = [String(userId)];
  }

  return this.utils.yida.saveFormData({
    formUuid: config.formUuid,
    appType: appType,
    formDataJson: JSON.stringify(formData)
  }).then(function(res) {
    if (!res || res.success === false) {
      var errorMessage = res && (res.errorMsg || res.message || res.error) ? (res.errorMsg || res.message || res.error) : '保存失败';
      throw new Error(errorMessage);
    }
    return res.result || res.content || '';
  }).catch(function(err) {
    throw err;
  });
}

export function generateClientPack() {
  var self = this;
  var activeSolution = this.getActiveSolution();
  var result = _customState.diagnosisResult || buildDiagnosisResult(_customState.diagnosisText || '', _customState.activeIndustry, activeSolution);
  this.setCustomState({
    activeNav: 'materials',
    diagnosisMode: 'materials',
    materialGenerated: false,
    materialLoading: true,
    materialResult: null,
    diagnosisResult: result,
    aiError: ''
  });

  this.callYidaAI(buildMaterialPrompt(result, _customState.diagnosisText || '')).then(function(aiText) {
    self.setCustomState({
      materialGenerated: true,
      materialLoading: false,
      materialResult: normalizeMaterialResult(aiText, result),
      aiError: ''
    });
    self.utils.toast({ title: '宜搭 AI 已生成客户材料', type: 'success' });
  }).catch(function(err) {
    var message = err && err.message ? err.message : '宜搭 AI 暂不可用';
    self.setCustomState({
      materialGenerated: true,
      materialLoading: false,
      materialResult: buildFallbackMaterialResult(result),
      aiError: message
    });
    self.utils.toast({ title: '宜搭 AI 暂不可用，已生成本地材料', type: 'warning' });
  });
}

export function copyPrompt(label) {
  var nextCart = (_customState.promptCart || []).slice(0);
  if (nextCart.indexOf(label) < 0) {
    nextCart.push(label);
  }
  this.setCustomState({ promptCart: nextCart });
  this.utils.toast({ title: label + ' Prompt 已放入方案包', type: 'success' });
}

export function copyBuildPrompt() {
  var prompt = _customState.buildPrompt || '';
  if (!prompt) {
    this.utils.toast({ title: '请先生成 OpenYida 搭建任务', type: 'warning' });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(prompt).then(() => {
      this.utils.toast({ title: 'OpenYida 执行 Prompt 已复制', type: 'success' });
    }).catch((err) => {
      var message = err && err.message ? err.message : '复制失败';
      this.utils.toast({ title: message, type: 'error' });
    });
    return;
  }
  this.utils.toast({ title: '当前浏览器不支持自动复制，可直接选中下方 Prompt', type: 'warning' });
}

export function callYidaAI(prompt) {
  var csrfToken = getCsrfToken();
  if (!csrfToken || typeof fetch === 'undefined') {
    return Promise.reject(new Error('当前环境缺少宜搭 AI 登录态'));
  }
  return fetch('/query/intelligent/txtFromAI.json?_api=nattyFetch&_mock=false&_stamp=' + new Date().getTime(), {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json, text/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: encodeForm({
      _csrf_token: csrfToken,
      prompt: prompt,
      maxTokens: '1800',
      skill: 'ToText'
    })
  }).then(function(res) {
    return res.json();
  }).then(function(data) {
    if (!data || data.success === false) {
      throw new Error(data && data.errorMsg ? data.errorMsg : 'AI 接口返回异常');
    }
    var content = '';
    if (data.content && data.content.content) {
      content = data.content.content;
    } else if (typeof data.content === 'string') {
      content = data.content;
    } else if (data.data && data.data.content) {
      content = data.data.content;
    }
    if (!content) {
      throw new Error('AI 没有返回内容');
    }
    return content;
  }).catch(function(err) {
    throw err;
  });
}

export function getActiveSolution() {
  var key = _customState.selectedSolution;
  return findSolutionByKey(key);
}

function isKnownNavKey(key) {
  return navItems.filter((item) => item.key === key).length > 0;
}

function isKnownIndustryKey(key) {
  return industries.filter((item) => item.key === key).length > 0;
}

function isKnownSolutionKey(key) {
  return solutionCards.filter((item) => item.key === key).length > 0;
}

function shouldSyncRoute(newState) {
  return !!(newState.activeNav || newState.activeIndustry || newState.selectedSolution);
}

function getIndustryKeyForSolution(solutionKey) {
  var matchedKey = '';
  Object.keys(industryDefaultSolutions).forEach((industryKey) => {
    if (industryDefaultSolutions[industryKey] === solutionKey) {
      matchedKey = industryKey;
    }
  });
  return matchedKey;
}

function readRouteParam(name) {
  if (typeof window === 'undefined' || !window.location) {
    return '';
  }
  var value = '';
  try {
    if (typeof URLSearchParams !== 'undefined') {
      var params = new URLSearchParams(window.location.search || '');
      value = params.get(name) || '';
    }
  } catch (e) {
    value = '';
  }
  if (!value) {
    var matched = String(window.location.search || '').match(new RegExp('[?&]' + name + '=([^&]+)'));
    value = matched && matched[1] ? decodeURIComponent(matched[1]) : '';
  }
  return value;
}

function getRouteState() {
  var navKey = readRouteParam('tab') || readRouteParam('nav');
  var industryKey = readRouteParam('industry');
  var solutionKey = readRouteParam('solution');
  navKey = isKnownNavKey(navKey) ? navKey : '';
  industryKey = isKnownIndustryKey(industryKey) ? industryKey : '';
  solutionKey = isKnownSolutionKey(solutionKey) ? solutionKey : '';
  if (solutionKey && !industryKey) {
    industryKey = getIndustryKeyForSolution(solutionKey);
  }
  if (industryKey && !solutionKey) {
    solutionKey = industryDefaultSolutions[industryKey] || '';
  }
  return {
    activeNav: navKey,
    activeIndustry: industryKey,
    selectedSolution: solutionKey
  };
}

function updateRouteState(nextState) {
  if (typeof window === 'undefined' || !window.history || !window.history.pushState) {
    return;
  }
  var navKey = nextState.activeNav || _customState.activeNav;
  var industryKey = nextState.activeIndustry || _customState.activeIndustry;
  var solutionKey = nextState.selectedSolution || _customState.selectedSolution;
  if (!isKnownNavKey(navKey)) {
    return;
  }
  if (!isKnownIndustryKey(industryKey)) {
    industryKey = getIndustryKeyForSolution(solutionKey) || 'manufacturing';
  }
  if (!isKnownSolutionKey(solutionKey)) {
    solutionKey = industryDefaultSolutions[industryKey] || 'inspection';
  }
  try {
    var url = new URL(window.location.href);
    url.searchParams.set('tab', navKey);
    url.searchParams.set('industry', industryKey);
    url.searchParams.set('solution', solutionKey);
    var nextUrl = url.toString();
    if (nextUrl !== window.location.href) {
      window.history.pushState({ tab: navKey, industry: industryKey, solution: solutionKey }, '', nextUrl);
    }
  } catch (e) {
    var hash = window.location.hash || '';
    var base = window.location.href.split('#')[0].split('?')[0];
    var fallbackUrl = base + '?tab=' + encodeURIComponent(navKey) + '&industry=' + encodeURIComponent(industryKey) + '&solution=' + encodeURIComponent(solutionKey) + hash;
    if (fallbackUrl !== window.location.href) {
      window.history.pushState({ tab: navKey, industry: industryKey, solution: solutionKey }, '', fallbackUrl);
    }
  }
}

function buildVisitPlanDiagnosisText(item) {
  return [
    '客户：' + (item.customer || '未命名客户'),
    '拜访时间：' + (item.time || '待确认'),
    'SA：' + (item.owner || '未分配'),
    '当前阶段：' + (item.stage || '待确认'),
    '拜访目标：' + (item.goal || '待补充'),
    '推荐方向：' + (item.solution || '待匹配'),
    'Demo 状态：' + (item.demo || '待创建'),
    '风险标签：' + (item.risk || '无')
  ].join('\n');
}

function buildRiskCustomerDiagnosisText(item) {
  return [
    '客户：' + (item.customer || '未命名客户'),
    '风险等级：' + (item.level || '待判断'),
    '风险原因：' + (item.reason || '待补充'),
    '请生成主管陪访方案，包含客户痛点、推荐 Demo、会前准备、现场确认问题和下一步推进动作。'
  ].join('\n');
}

function getCsrfToken() {
  if (typeof window !== 'undefined' && window.g_config && window.g_config._csrf_token) {
    return window.g_config._csrf_token;
  }
  if (typeof document !== 'undefined' && document.cookie) {
    var matched = document.cookie.match(/(?:^|;\s*)(?:c_csrf|tianshu_csrf_token)=([^;]+)/);
    if (matched && matched[1]) {
      return decodeURIComponent(matched[1]);
    }
  }
  return '';
}

function encodeForm(params) {
  return Object.keys(params).map((key) => {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  }).join('&');
}

function buildYidaAiPrompt(text) {
  return [
    '你是钉钉解决方案中心的 AI 方案助理，服务对象是钉钉 SA。',
    '请根据客户需求，判断最适合的行业和方案包，并输出严格 JSON，不要输出 Markdown。',
    '行业 key 只能从 manufacturing, retail, property, education, logistics, government 中选择。',
    '方案 key 只能从 inspection, store, repair, admission, dispatch, supervision 中选择。',
    'JSON 字段：industryKey, solutionKey, confidence, painPoints, nextActions, assets, prompt。',
    'painPoints、nextActions、assets 都是 3-4 项字符串数组；confidence 是 0-100 数字。',
    '客户需求：' + text
  ].join('\n');
}

function buildMaterialPrompt(result, sourceText) {
  return [
    '你是钉钉解决方案中心的客户材料生成助理，服务对象是钉钉 SA。',
    '请根据诊断结果生成客户版材料，输出严格 JSON，不要输出 Markdown。',
    'JSON 字段：title, executiveSummary, demoScript, faq, acceptance, prdScope。',
    'demoScript、faq、acceptance、prdScope 都是 3-4 项字符串数组。',
    '行业：' + result.industryName,
    '方案：' + result.solutionTitle,
    '痛点：' + result.painPoints.join('；'),
    '下一步：' + result.nextActions.join('；'),
    '客户原始需求：' + sourceText
  ].join('\n');
}

function normalizeAiDiagnosis(aiText, sourceText) {
  var payload = parseJsonFromText(aiText);
  var industryKey = payload && isKnownIndustry(payload.industryKey) ? payload.industryKey : inferIndustryKey(sourceText);
  var solutionKey = payload && isKnownSolution(payload.solutionKey) ? payload.solutionKey : (industryDefaultSolutions[industryKey] || 'inspection');
  var solution = findSolutionByKey(solutionKey);
  var result = buildDiagnosisResult(sourceText, industryKey, solution);
  result.industryKey = industryKey;
  result.solutionKey = solutionKey;
  result.source = '宜搭 AI';
  if (payload) {
    result.confidence = Number(payload.confidence) || result.confidence;
    result.painPoints = normalizeStringList(payload.painPoints, result.painPoints);
    result.nextActions = normalizeStringList(payload.nextActions, result.nextActions);
    result.assets = normalizeStringList(payload.assets, result.assets);
    result.prompt = payload.prompt || result.prompt;
  }
  return result;
}

function normalizeMaterialResult(aiText, diagnosisResult) {
  var payload = parseJsonFromText(aiText);
  var fallback = buildFallbackMaterialResult(diagnosisResult);
  if (!payload) {
    return fallback;
  }
  return {
    title: payload.title || fallback.title,
    source: '宜搭 AI',
    executiveSummary: payload.executiveSummary || fallback.executiveSummary,
    demoScript: normalizeStringList(payload.demoScript, fallback.demoScript),
    faq: normalizeStringList(payload.faq, fallback.faq),
    acceptance: normalizeStringList(payload.acceptance, fallback.acceptance),
    prdScope: normalizeStringList(payload.prdScope, fallback.prdScope)
  };
}

function buildFallbackMaterialResult(result) {
  return {
    title: result.solutionTitle + ' 客户版方案',
    source: '本地规则',
    executiveSummary: '围绕' + result.industryName + '客户的核心痛点，建议用「' + result.solutionTitle + '」作为首场演示主线，先让客户看到业务闭环，再逐步展开表单、流程、权限和看板细节。',
    demoScript: [
      '开场先复述客户现状和关键痛点，确认本次演示只聚焦一个闭环。',
      '用移动端完成一线提交，再切换到管理端看流程流转和指标沉淀。',
      '结尾明确需要客户共创确认的字段、角色、规则和集成边界。'
    ],
    faq: [
      '是否可以按客户现有组织和角色配置权限？可以，通过宜搭角色、数据权限和流程节点配置实现。',
      '是否必须一次性上线全部模块？建议先用一个高频场景做样板，再复制到同类业务。',
      '后续能否继续扩展看板和 AI 能力？可以在表单数据沉淀后逐步增加统计、提醒和 AI 总结。'
    ],
    acceptance: [
      '客户确认核心流程能闭环，且责任人、时限和状态清晰。',
      '演示数据能覆盖正常、异常、退回和超时四类关键状态。',
      '主管看板能回答当前进度、风险客户和个人推进质量。'
    ],
    prdScope: result.assets.slice(0, 4)
  };
}

function createBuildSpec(result, activeSolution) {
  var playbook = getIndustryPlaybook(result.industryKey || _customState.activeIndustry);
  var customerName = inferCustomerName(_customState.diagnosisText || '');
  var solution = activeSolution || findSolutionByKey(result.solutionKey);
  var formNames = playbook.assets.map((item) => item.replace('表', '').replace('流程', '').replace('看板', '') + '表');
  var appName = customerName + ' - ' + solution.title.replace('与', '') + ' Demo';
  var taskNames = [
    '环境检测与创建应用',
    '创建核心表单',
    '配置关键流程',
    '发布首页与主管看板',
    '写入演示数据',
    '回填 Demo 地址'
  ];
  return {
    version: '1.0',
    generatedAt: formatDateTime(new Date()),
    source: '钉钉 AI 解决方案中心',
    customerName: customerName,
    appName: appName,
    industryKey: result.industryKey,
    industryName: result.industryName,
    solutionKey: result.solutionKey,
    solutionTitle: solution.title,
    painPoints: result.painPoints,
    forms: formNames.slice(0, 4),
    processes: [
      playbook.scenes[1] + '处理流程',
      playbook.scenes[2] + '闭环流程'
    ],
    pages: [
      'SA 演示首页',
      playbook.scenes[3],
      '客户版方案页'
    ],
    sampleData: [
      '生成 20 条主数据',
      '生成 12 条流程中样例',
      '生成 4 个风险/异常样例'
    ],
    prompts: (_customState.promptCart || []).slice(0, 6),
    tasks: taskNames.map((name, index) => ({
      name: name,
      output: buildTaskOutput(name, index, playbook, solution)
    }))
  };
}

function buildTaskOutput(name, index, playbook, solution) {
  if (index === 0) {
    return '执行 openyida env，创建「' + solution.title + '」样板应用。';
  }
  if (index === 1) {
    return '创建 ' + playbook.assets.slice(0, 4).join('、') + '。';
  }
  if (index === 2) {
    return '配置 ' + playbook.scenes[1] + '、' + playbook.scenes[2] + ' 两条流程。';
  }
  if (index === 3) {
    return '发布首页、看板和客户版方案页。';
  }
  if (index === 4) {
    return '写入主数据、异常数据和流程样例。';
  }
  return '将 appType、页面地址和执行日志回填到 Demo 实例。';
}

function buildOpenYidaRunnerPrompt(buildSpec) {
  return [
    '请使用 OpenYida 在当前钉钉组织中搭建一个可演示 Demo。',
    '必须先执行 openyida env --json 确认登录态，再创建应用、表单、流程、页面和演示数据。',
    '完成后请把 appType、首页地址、创建耗时和失败日志回填到 Demo 实例表。',
    '搭建规格 JSON：',
    JSON.stringify(buildSpec, null, 2)
  ].join('\n');
}

function buildRunnerCommand(recordId) {
  if (!recordId) {
    return '';
  }
  return 'npm run solution:runner -- --execute --inst-id ' + recordId;
}

function inferCustomerName(text) {
  var source = String(text || '').replace(/\s+/g, '');
  var match = source.match(/客户是(?:一家|一个)?([^，,。；;]{2,16})/);
  if (match && match[1]) {
    return match[1];
  }
  match = source.match(/([^，,。；;]{2,16})(?:想用|希望|需要|计划)/);
  if (match && match[1]) {
    return match[1];
  }
  return '客户共创';
}

function getCurrentAppType() {
  if (typeof window !== 'undefined' && window.g_config && window.g_config.appType) {
    return window.g_config.appType;
  }
  return APP_TYPE;
}

function getLoginUserId() {
  if (typeof window !== 'undefined' && window.loginUser) {
    return window.loginUser.userId || window.loginUser.userid || window.loginUser.userName || '';
  }
  return '';
}

function limitText(text, maxLength) {
  var value = String(text || '');
  if (value.length <= maxLength) {
    return value;
  }
  return value.substring(0, maxLength - 1);
}

function formatDateTime(date) {
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hour = date.getHours();
  var minute = date.getMinutes();
  var pad = function(num) { return num < 10 ? '0' + num : '' + num; };
  return date.getFullYear() + '-' + pad(month) + '-' + pad(day) + ' ' + pad(hour) + ':' + pad(minute);
}

function parseJsonFromText(text) {
  var raw = String(text || '').trim();
  var start = raw.indexOf('{');
  var end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(raw.substring(start, end + 1));
  } catch (e) {
    return null;
  }
}

function normalizeStringList(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  var list = value.map((item) => {
    return String(item || '').trim();
  }).filter((item) => {
    return !!item;
  });
  return list.length ? list.slice(0, 4) : fallback;
}

function isKnownIndustry(key) {
  return !!industryDefaultSolutions[key];
}

function isKnownSolution(key) {
  return solutionCards.filter((item) => item.key === key).length > 0;
}

function findSolutionByKey(key) {
  var matched = solutionCards.filter((item) => item.key === key);
  return matched.length ? matched[0] : solutionCards[0];
}

function getIndustryPlaybook(key) {
  return industryPlaybooks[key] || industryPlaybooks.manufacturing;
}

function inferIndustryKey(text) {
  var source = String(text || '').toLowerCase();
  if (source.indexOf('门店') >= 0 || source.indexOf('零售') >= 0 || source.indexOf('店长') >= 0 || source.indexOf('加盟') >= 0) {
    return 'retail';
  }
  if (source.indexOf('物业') >= 0 || source.indexOf('报修') >= 0 || source.indexOf('园区') >= 0 || source.indexOf('住户') >= 0) {
    return 'property';
  }
  if (source.indexOf('招生') >= 0 || source.indexOf('教育') >= 0 || source.indexOf('学员') >= 0 || source.indexOf('校区') >= 0) {
    return 'education';
  }
  if (source.indexOf('物流') >= 0 || source.indexOf('车辆') >= 0 || source.indexOf('调度') >= 0 || source.indexOf('运输') >= 0 || source.indexOf('回单') >= 0) {
    return 'logistics';
  }
  if (source.indexOf('政务') >= 0 || source.indexOf('政企') >= 0 || source.indexOf('督办') >= 0 || source.indexOf('部门') >= 0 || source.indexOf('领导') >= 0) {
    return 'government';
  }
  return 'manufacturing';
}

function buildDiagnosisResult(text, industryKey, solution) {
  var playbook = getIndustryPlaybook(industryKey);
  var activeSolution = solution || findSolutionByKey(playbook.solutionKey);
  var sourceText = String(text || '').trim();
  var complexity = sourceText.length > 120 ? '信息完整' : '需补充客户角色和系统边界';
  return {
    industryKey: industryKey,
    solutionKey: activeSolution.key,
    source: '本地规则',
    industryName: playbook.name,
    solutionTitle: activeSolution.title,
    confidence: activeSolution.score,
    complexity: complexity,
    painPoints: playbook.signals.slice(0, 3),
    nextActions: [
      '用「' + activeSolution.title + '」作为 20 分钟演示主线',
      '先确认 ' + playbook.roles[0] + ' 和 ' + playbook.roles[1] + ' 两类关键角色',
      '现场只展开 ' + playbook.scenes[0] + '、' + playbook.scenes[1] + '、' + playbook.scenes[2] + ' 三个闭环'
    ],
    assets: playbook.assets.slice(0, 4),
    prompt: '基于客户描述，生成' + playbook.name + '行业「' + activeSolution.title + '」的价值主张、Demo 脚本、字段清单、流程规则和客户 FAQ。'
  };
}

function buildMockDashboardData() {
  return {
    visitMetrics: visitMetrics,
    visitPlans: visitPlans,
    visitStages: visitStages,
    managerMetrics: managerMetrics,
    teamRows: teamRows,
    riskCustomers: riskCustomers,
    visitActionCount: 9
  };
}

function normalizeRows(res) {
  if (!res) {
    return [];
  }
  if (Array.isArray(res.data)) {
    return res.data;
  }
  if (res.content && Array.isArray(res.content.data)) {
    return res.content.data;
  }
  if (res.content && Array.isArray(res.content.values)) {
    return res.content.values;
  }
  if (Array.isArray(res.values)) {
    return res.values;
  }
  return [];
}

function getRowData(row) {
  if (!row) {
    return {};
  }
  return row.formData || row.data || row;
}

function readField(row, formKey, alias, fallback) {
  var config = FORM_CONFIG[formKey] || {};
  var fields = config.fields || {};
  var fieldId = fields[alias];
  var formData = getRowData(row);
  if (fieldId && formData[fieldId] !== undefined && formData[fieldId] !== null && formData[fieldId] !== '') {
    return formData[fieldId];
  }
  return fallback || '';
}

function displayValue(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => displayValue(item)).filter((item) => !!item).join('、');
  }
  if (typeof value === 'object') {
    return value.name || value.label || value.text || value.value || value.userName || value.nickName || JSON.stringify(value);
  }
  return String(value);
}

function displayList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => displayValue(item)).filter((item) => !!item);
  }
  var text = displayValue(value);
  if (!text) {
    return [];
  }
  return text.split(/[、,，;；]/).map((item) => item.trim()).filter((item) => !!item);
}

function formatShortDate(value) {
  if (!value) {
    return '待定';
  }
  var date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (isNaN(date.getTime())) {
    return displayValue(value);
  }
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hour = date.getHours();
  var minute = date.getMinutes();
  var minuteText = minute < 10 ? '0' + minute : '' + minute;
  return month + '/' + day + ' ' + hour + ':' + minuteText;
}

function percent(part, total) {
  if (!total) {
    return 0;
  }
  return Math.round((part / total) * 100);
}

function countByStage(visits) {
  var labels = ['初访', '需求确认', '方案演示', 'Demo/POC', '商务推进'];
  var colors = ['#2563EB', '#0F766E', '#7C3AED', '#D97706', '#DC2626'];
  var counts = {};
  labels.forEach((label) => { counts[label] = 0; });
  visits.forEach((row) => {
    var visitType = displayValue(readField(row, 'visit', 'visitType', ''));
    if (counts[visitType] !== undefined) {
      counts[visitType]++;
    }
  });
  var maxCount = 1;
  labels.forEach((label) => {
    if (counts[label] > maxCount) {
      maxCount = counts[label];
    }
  });
  return labels.map((label, index) => ({
    label: label,
    count: counts[label],
    value: Math.max(10, Math.round((counts[label] / maxCount) * 92)),
    color: colors[index]
  }));
}

function getStatusStyle(status) {
  if (status === '已准备' || status === 'Demo已演示' || status === '转交付') {
    return { bg: '#ECFDF5', color: '#047857' };
  }
  if (status === '待准备' || status === '待客户反馈' || status === '方案确认中') {
    return { bg: '#FEF3C7', color: '#B45309' };
  }
  if (status === '暂缓/风险' || status === '需支持') {
    return { bg: '#FEE2E2', color: '#B91C1C' };
  }
  return { bg: '#EFF6FF', color: '#1D4ED8' };
}

function buildVisitPlansFromRows(visits) {
  return visits.slice(0, 6).map((row) => {
    var status = displayValue(readField(row, 'visit', 'visitStatus', '待准备'));
    var style = getStatusStyle(status);
    var riskTags = displayList(readField(row, 'visit', 'riskTags', ''));
    return {
      customer: displayValue(readField(row, 'visit', 'customerName', '未命名客户')),
      time: formatShortDate(readField(row, 'visit', 'visitTime', '')),
      owner: displayValue(readField(row, 'visit', 'owner', '未分配')),
      stage: displayValue(readField(row, 'visit', 'visitType', '拜访')),
      status: status,
      bg: style.bg,
      color: style.color,
      goal: displayValue(readField(row, 'visit', 'goal', '暂无拜访目标')),
      solution: displayValue(readField(row, 'visit', 'solution', '方案待选')),
      demo: displayValue(readField(row, 'visit', 'demoStatus', 'Demo 待创建')),
      risk: riskTags.length ? riskTags[0] : ''
    };
  });
}

function buildTeamRows(customers, visits, demos, risks, weeklyReports) {
  var map = {};
  function ensureOwner(owner) {
    var name = displayValue(owner) || '未分配';
    if (!map[name]) {
      map[name] = {
        name: name,
        focus: '客户经营',
        customers: 0,
        visits: 0,
        demos: 0,
        overdue: 0,
        health: 80
      };
    }
    return map[name];
  }

  customers.forEach((row) => {
    var owner = ensureOwner(readField(row, 'customer', 'owner', '未分配'));
    owner.customers++;
    var industry = displayValue(readField(row, 'customer', 'industry', ''));
    if (industry) {
      owner.focus = industry + ' · 客户经营';
    }
  });

  visits.forEach((row) => {
    var owner = ensureOwner(readField(row, 'visit', 'owner', '未分配'));
    owner.visits++;
    var status = displayValue(readField(row, 'visit', 'visitStatus', ''));
    if (status === '待准备' || status === '已拜访待纪要') {
      owner.overdue++;
    }
  });

  demos.forEach((row) => {
    var owner = ensureOwner(readField(row, 'demoInstance', 'creator', '未分配'));
    owner.demos++;
  });

  risks.forEach((row) => {
    var owner = ensureOwner(readField(row, 'riskCustomer', 'owner', '未分配'));
    var needManager = displayValue(readField(row, 'riskCustomer', 'needManager', ''));
    if (needManager === '是') {
      owner.overdue++;
    }
  });

  weeklyReports.forEach((row) => {
    var owner = ensureOwner(readField(row, 'weeklyReport', 'owner', '未分配'));
    var prepRate = Number(readField(row, 'weeklyReport', 'prepRate', 0)) || 0;
    var noteRate = Number(readField(row, 'weeklyReport', 'noteRate', 0)) || 0;
    var nextStepRate = Number(readField(row, 'weeklyReport', 'nextStepRate', 0)) || 0;
    if (prepRate || noteRate || nextStepRate) {
      owner.health = Math.round((prepRate + noteRate + nextStepRate) / 3);
    }
  });

  return Object.keys(map).map((key) => map[key]).sort((a, b) => b.health - a.health).slice(0, 8);
}

function buildRiskRows(risks) {
  return risks.slice(0, 6).map((row) => ({
    customer: displayValue(readField(row, 'riskCustomer', 'customerName', '未命名客户')),
    reason: displayValue(readField(row, 'riskCustomer', 'reason', '暂无风险说明')),
    level: displayValue(readField(row, 'riskCustomer', 'level', '待推进'))
  }));
}

function buildMeetingNoteMap(meetingNotes) {
  var map = {};
  meetingNotes.forEach((row) => {
    var customer = displayValue(readField(row, 'meetingNote', 'customerName', ''));
    if (customer) {
      map[customer] = true;
    }
  });
  return map;
}

function buildDashboardDataFromRows(customers, visits, demos, risks, weeklyReports, meetingNotes) {
  var totalVisits = visits.length;
  var prepared = 0;
  var noted = 0;
  var nextClear = 0;
  var noteMap = buildMeetingNoteMap(meetingNotes || []);
  var hasMeetingNotes = meetingNotes && meetingNotes.length > 0;
  visits.forEach((row) => {
    var status = displayValue(readField(row, 'visit', 'visitStatus', ''));
    var aiSummary = displayValue(readField(row, 'visit', 'aiSummary', ''));
    var nextActions = displayValue(readField(row, 'visit', 'nextActions', ''));
    var customerName = displayValue(readField(row, 'visit', 'customerName', ''));
    if (status === '已准备' || status === 'Demo已演示' || status === '方案确认中' || status === '转交付') {
      prepared++;
    }
    if ((hasMeetingNotes && noteMap[customerName]) || (!hasMeetingNotes && aiSummary && status !== '待准备')) {
      noted++;
    }
    if (nextActions || status === '待客户反馈' || status === '方案确认中' || status === '转交付') {
      nextClear++;
    }
  });

  var activeCustomers = customers.filter((row) => {
    var status = displayValue(readField(row, 'customer', 'status', ''));
    return status !== '关闭' && status !== '暂缓';
  }).length;
  var solutionDemoCount = visits.filter((row) => displayValue(readField(row, 'visit', 'visitType', '')).indexOf('演示') >= 0).length;
  var notDemoed = demos.filter((row) => {
    var status = displayValue(readField(row, 'demoInstance', 'status', ''));
    return status === '已创建' || status === '创建中';
  }).length;
  var highRisks = risks.filter((row) => displayValue(readField(row, 'riskCustomer', 'level', '')).indexOf('高') >= 0).length;
  var needManager = risks.filter((row) => displayValue(readField(row, 'riskCustomer', 'needManager', '')) === '是').length;
  var missingNext = totalVisits - nextClear;

  return {
    visitMetrics: [
      { label: '本周客户拜访', value: String(totalVisits), hint: '来自客户拜访表', color: '#059669' },
      { label: '拜访前准备率', value: percent(prepared, totalVisits) + '%', hint: '目标 85%', color: '#2563EB' },
      { label: '会后纪要沉淀', value: percent(noted, totalVisits) + '%', hint: '已沉淀 ' + noted + ' 份', color: '#7C3AED' },
      { label: '下一步明确率', value: percent(nextClear, totalVisits) + '%', hint: missingNext + ' 个待补齐', color: '#D97706' }
    ],
    visitPlans: buildVisitPlansFromRows(visits),
    visitStages: countByStage(visits),
    managerMetrics: [
      { label: '活跃客户', value: String(activeCustomers), hint: '客户档案', color: '#2563EB' },
      { label: '方案演示', value: String(solutionDemoCount), hint: '拜访记录', color: '#059669' },
      { label: 'Demo 创建', value: String(demos.length), hint: notDemoed + ' 个未演示', color: '#7C3AED' },
      { label: '高风险客户', value: String(highRisks), hint: needManager + ' 个需陪访', color: '#DC2626' }
    ],
    teamRows: buildTeamRows(customers, visits, demos, risks, weeklyReports),
    riskCustomers: buildRiskRows(risks),
    visitActionCount: missingNext
  };
}

export function renderNavItem(item) {
  var self = this;
  var active = _customState.activeNav === item.key;
  return (
    <button
      key={item.key}
      style={Object.assign({}, styles.navItem, active ? styles.navItemActive : {})}
      onClick={(e) => { self.selectNav(item.key); }}
    >
      <span style={Object.assign({}, styles.navIcon, active ? styles.navIconActive : {})}>{item.icon}</span>
      <span style={styles.navText}>{item.label}</span>
      {item.badge ? <span style={styles.navBadge}>{item.badge}</span> : null}
    </button>
  );
}

export function renderMetric(item) {
  var self = this;
  var cardStyle = Object.assign({}, styles.metricCard, item.target ? styles.metricCardClickable : {});
  return (
    <button key={item.label} style={cardStyle} onClick={(e) => { item.target ? self.selectNav(item.target) : null; }}>
      <div style={styles.metricTop}>
        <span style={Object.assign({}, styles.metricIcon, { background: item.color })}>{item.icon}</span>
        <span style={styles.metricDelta}>{item.delta}</span>
      </div>
      <div style={styles.metricValue}>{item.value}</div>
      <div style={styles.metricLabel}>{item.label}</div>
    </button>
  );
}

export function renderPipelineStep(item) {
  return (
    <div key={item.title} style={styles.pipelineStep}>
      <div style={styles.pipelineNumber}>{item.no}</div>
      <div style={styles.pipelineBody}>
        <div style={styles.pipelineTitle}>{item.title}</div>
        <div style={styles.pipelineDesc}>{item.desc}</div>
      </div>
    </div>
  );
}

export function renderIndustry(item) {
  var self = this;
  var active = _customState.activeIndustry === item.key;
  return (
    <button
      key={item.key}
      style={Object.assign({}, styles.industryButton, active ? styles.industryButtonActive : {})}
      onClick={(e) => { self.selectIndustry(item.key); }}
    >
      <span style={styles.industryName}>{item.name}</span>
      <span style={styles.industryMeta}>{item.count} 个方案 · {item.demo} 个可搭建</span>
    </button>
  );
}

export function renderSolutionCard(item) {
  var self = this;
  var active = _customState.selectedSolution === item.key;
  return (
    <button
      key={item.key}
      style={Object.assign({}, styles.solutionCard, active ? styles.solutionCardActive : {})}
      onClick={(e) => { self.selectSolution(item.key); }}
    >
      <div style={styles.solutionHeader}>
        <span style={Object.assign({}, styles.solutionRank, { background: item.rankColor })}>{item.grade}</span>
        <span style={styles.solutionScore}>{item.score} 分</span>
      </div>
      <div style={styles.solutionTitle}>{item.title}</div>
      <div style={styles.solutionDesc}>{item.desc}</div>
      <div style={styles.tagRow}>
        {item.tags.map((tag) => (
          <span key={tag} style={styles.smallTag}>{tag}</span>
        ))}
      </div>
    </button>
  );
}

export function renderPrompt(item) {
  var self = this;
  var selected = (_customState.promptCart || []).indexOf(item.label) >= 0;
  return (
    <div key={item.label} style={styles.promptRow}>
      <div>
        <div style={styles.promptTitle}>{item.label}</div>
        <div style={styles.promptDesc}>{item.desc}</div>
      </div>
      <button
        style={Object.assign({}, styles.iconButton, selected ? styles.iconButtonSelected : {})}
        onClick={(e) => { self.copyPrompt(item.label); }}
        title="加入方案包"
      >
        {selected ? '✓' : '+'}
      </button>
    </div>
  );
}

export function renderBuildTask(item) {
  return (
    <div key={item.title} style={styles.taskRow}>
      <div style={Object.assign({}, styles.taskStatus, item.done ? styles.taskStatusDone : {})}>
        {item.done ? '✓' : '·'}
      </div>
      <div style={styles.taskContent}>
        <div style={styles.taskTitle}>{item.title}</div>
        <div style={styles.taskDesc}>{item.desc}</div>
      </div>
      <span style={styles.taskTime}>{item.time}</span>
    </div>
  );
}

export function renderVisitMetric(item) {
  return (
    <div key={item.label} style={styles.visitMetricCard}>
      <div style={styles.visitMetricValue}>{item.value}</div>
      <div style={styles.visitMetricLabel}>{item.label}</div>
      <div style={Object.assign({}, styles.visitMetricHint, { color: item.color })}>{item.hint}</div>
    </div>
  );
}

export function renderVisitPlan(item) {
  var self = this;
  return (
    <div key={item.customer} style={styles.visitPlanCard}>
      <div style={styles.visitPlanTop}>
        <div>
          <div style={styles.visitCustomer}>{item.customer}</div>
          <div style={styles.visitMeta}>{item.time} · {item.owner} · {item.stage}</div>
        </div>
        <span style={Object.assign({}, styles.visitStatus, { background: item.bg, color: item.color })}>{item.status}</span>
      </div>
      <div style={styles.visitGoal}>{item.goal}</div>
      <div style={styles.visitActionRow}>
        <span style={styles.smallTag}>{item.solution}</span>
        <span style={styles.smallTag}>{item.demo}</span>
        <span style={Object.assign({}, styles.smallTag, item.risk ? styles.riskTag : {})}>{item.risk || '无风险'}</span>
      </div>
      <div style={styles.cardButtonRow}>
        <button style={styles.miniPrimaryButton} onClick={(e) => { self.prepareVisitPlan(item, 'diagnose'); }}>生成方案包</button>
        <button style={styles.miniSecondaryButton} onClick={(e) => { self.prepareVisitPlan(item, 'build'); }}>搭建 Demo</button>
      </div>
    </div>
  );
}

export function renderVisitStage(item) {
  return (
    <div key={item.label} style={styles.funnelRow}>
      <div style={styles.funnelLabel}>{item.label}</div>
      <div style={styles.funnelTrack}>
        <span style={Object.assign({}, styles.funnelFill, { width: item.value + '%', background: item.color })}></span>
      </div>
      <div style={styles.funnelValue}>{item.count}</div>
    </div>
  );
}

export function renderTeamRow(item) {
  return (
    <div key={item.name} style={styles.teamRow}>
      <div style={styles.teamPerson}>
        <span style={styles.personAvatar}>{item.name.substring(0, 1)}</span>
        <div>
          <div style={styles.personName}>{item.name}</div>
          <div style={styles.personRole}>{item.focus}</div>
        </div>
      </div>
      <div style={styles.teamCell}>{item.customers}</div>
      <div style={styles.teamCell}>{item.visits}</div>
      <div style={styles.teamCell}>{item.demos}</div>
      <div style={Object.assign({}, styles.teamCell, item.overdue > 0 ? styles.warningText : {})}>{item.overdue}</div>
      <div style={styles.healthCell}>
        <span style={styles.healthTrack}>
          <span style={Object.assign({}, styles.healthFill, { width: item.health + '%' })}></span>
        </span>
        <span>{item.health}</span>
      </div>
    </div>
  );
}

export function renderRiskCustomer(item) {
  var self = this;
  return (
    <div key={item.customer} style={styles.riskRow}>
      <div>
        <div style={styles.riskTitle}>{item.customer}</div>
        <div style={styles.riskDesc}>{item.reason}</div>
      </div>
      <div style={styles.riskActionColumn}>
        <span style={styles.riskLevel}>{item.level}</span>
        <button style={styles.miniSecondaryButton} onClick={(e) => { self.prepareRiskCustomer(item); }}>陪访方案</button>
      </div>
    </div>
  );
}

export function renderAssistantPanel(activeSolution) {
  return (
    <aside style={styles.sidePanel}>
      <div style={styles.assistantHeader}>
        <div>
          <div style={styles.eyebrow}>AI 方案助理</div>
          <h2 style={styles.sideTitle}>下一步建议</h2>
        </div>
        <span style={styles.assistantAvatar}>AI</span>
      </div>

      <div style={styles.suggestionBox}>
        <div style={styles.suggestionTitle}>推荐动作</div>
        <div style={styles.suggestionText}>
          优先用「{activeSolution.title}」打开客户沟通，现场演示以异常闭环和管理驾驶舱为主，避免一开始展开过多表单细节。
        </div>
      </div>

      <div style={styles.sideSection}>
        <div style={styles.sideSectionTitle}>我的方案包</div>
        {myPackages.map((item) => (
          <div key={item.name} style={styles.packageRow}>
            <span style={styles.packageDot}></span>
            <span style={styles.packageName}>{item.name}</span>
            <span style={styles.packageMeta}>{item.count}</span>
          </div>
        ))}
      </div>

      <div style={styles.sideSection}>
        <div style={styles.sideSectionTitle}>成熟度雷达</div>
        {maturityItems.map((item) => (
          <div key={item.label} style={styles.radarRow}>
            <span style={styles.radarLabel}>{item.label}</span>
            <span style={styles.radarBar}>
              <span style={Object.assign({}, styles.radarFill, { width: item.value + '%' })}></span>
            </span>
            <span style={styles.radarValue}>{item.value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function renderDiagnosisResult() {
  var self = this;
  var result = _customState.diagnosisResult;
  if (_customState.aiLoading) {
    return (
      <div style={styles.diagnosisResult}>
        <div style={styles.diagnosisResultTop}>
          <div>
            <div style={styles.eyebrow}>宜搭 AI 诊断中</div>
            <div style={styles.resultTitle}>正在匹配行业、方案包和下一步动作</div>
            <div style={styles.resultText}>优先调用宜搭 AI 接口，完成后会自动生成结构化方案。</div>
          </div>
          <span style={styles.statusPill}>生成中</span>
        </div>
      </div>
    );
  }
  if (!result) {
    return null;
  }
  return (
    <div style={styles.diagnosisResult}>
      <div style={styles.diagnosisResultTop}>
        <div>
          <div style={styles.eyebrow}>诊断结果</div>
          <div style={styles.resultTitle}>{result.industryName} · {result.solutionTitle}</div>
          <div style={styles.resultText}>匹配度 {result.confidence} 分 · {result.complexity} · {result.source || '本地规则'}</div>
          {_customState.aiError ? <div style={styles.errorText}>宜搭 AI 返回：{_customState.aiError}</div> : null}
        </div>
        <span style={styles.statusPill}>可进入方案包</span>
      </div>
      <div style={styles.diagnosisColumns}>
        <div style={styles.insightBox}>
          <div style={styles.suggestionTitle}>识别到的痛点</div>
          {result.painPoints.map((item) => (
            <div key={item} style={styles.checkItem}>{item}</div>
          ))}
        </div>
        <div style={styles.insightBox}>
          <div style={styles.suggestionTitle}>下一步动作</div>
          {result.nextActions.map((item) => (
            <div key={item} style={styles.checkItem}>{item}</div>
          ))}
        </div>
      </div>
      <div style={styles.promptPreview}>{result.prompt}</div>
      <div style={styles.actionRow}>
        <button style={styles.primaryButton} onClick={(e) => { self.selectNav('solutions'); }}>查看方案包</button>
        <button style={styles.secondaryButton} onClick={(e) => { self.createDemo(); }}>进入 OpenYida 搭建</button>
      </div>
    </div>
  );
}

export function renderWorkbench(activeSolution, isMobile) {
  var self = this;
  var contentStyle = isMobile ? styles.mobileMainGrid : styles.mainGrid;
  return (
    <div style={contentStyle}>
      <main style={styles.mainColumn}>
        <section style={isMobile ? Object.assign({}, styles.heroPanel, styles.mobileHeroPanel) : styles.heroPanel}>
          <div style={styles.heroCopy}>
            <div style={styles.eyebrow}>悟空 × OpenYida</div>
            <h1 style={isMobile ? Object.assign({}, styles.heroTitle, styles.mobileHeroTitle) : styles.heroTitle}>钉钉 AI 解决方案中心</h1>
            <p style={isMobile ? Object.assign({}, styles.heroSubtitle, styles.mobileHeroSubtitle) : styles.heroSubtitle}>输入客户需求，生成可演示、可交付、可复用的行业方案。</p>
          </div>
          <div style={isMobile ? Object.assign({}, styles.heroActions, styles.mobileHeroActions) : styles.heroActions}>
            <button style={styles.primaryButton} onClick={(e) => { self.runDiagnosis(); }}>生成推荐方案</button>
            <button style={styles.secondaryButton} onClick={(e) => { self.createDemo(); }}>创建宜搭样板</button>
          </div>
        </section>

        <section style={styles.diagnosisPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.eyebrow}>客户需求诊断</div>
              <h2 style={styles.sectionTitle}>从会议纪要到方案包</h2>
            </div>
            <span style={styles.statusPill}>{diagnosisLabels[_customState.diagnosisMode]}</span>
          </div>
          <textarea
            style={styles.textarea}
            defaultValue={_customState.diagnosisText}
            onCompositionStart={(e) => { _customState._isComposing = true; }}
            onCompositionEnd={(e) => {
              _customState._isComposing = false;
              self.handleDiagnosisChange(e);
            }}
            onChange={(e) => { self.handleDiagnosisChange(e); }}
          />
          <div style={styles.actionRow}>
            <button style={styles.primaryButton} onClick={(e) => { self.runDiagnosis(); }}>{_customState.aiLoading ? '诊断中...' : 'AI 诊断'}</button>
            <button style={styles.secondaryButton} onClick={(e) => { self.generateClientPack(); }}>生成客户材料</button>
            <button style={styles.secondaryButton} onClick={(e) => { self.createDemo(); }}>OpenYida 搭建</button>
          </div>
          {this.renderDiagnosisResult()}
        </section>

        <section style={isMobile ? styles.mobileBuildGrid : styles.metricGrid}>
          {metricItems.map((item) => self.renderMetric(item))}
        </section>

        <section style={styles.sectionPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.eyebrow}>闭环工作流</div>
              <h2 style={styles.sectionTitle}>SA 从需求到演示的 4 步</h2>
            </div>
          </div>
          <div style={isMobile ? styles.mobileBuildGrid : styles.pipelineGrid}>
            {pipelineSteps.map((item) => self.renderPipelineStep(item))}
          </div>
        </section>

        <section style={styles.twoColumn}>
          <div style={styles.sectionPanel}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.eyebrow}>行业作战地图</div>
                <h2 style={styles.sectionTitle}>按客户场景找切入点</h2>
              </div>
            </div>
            <div style={styles.industryGrid}>
              {industries.map((item) => self.renderIndustry(item))}
            </div>
          </div>

          <div style={styles.sectionPanel}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.eyebrow}>推荐方案</div>
                <h2 style={styles.sectionTitle}>可执行方案包</h2>
              </div>
            </div>
            <div style={styles.solutionGrid}>
              {solutionCards.map((item) => self.renderSolutionCard(item))}
            </div>
          </div>
        </section>

        <section style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <div>
              <div style={styles.eyebrow}>当前方案</div>
              <h2 style={styles.detailTitle}>{activeSolution.title}</h2>
              <p style={styles.detailDesc}>{activeSolution.longDesc}</p>
            </div>
            <div style={styles.detailScore}>
              <span style={styles.detailScoreValue}>{activeSolution.score}</span>
              <span style={styles.detailScoreLabel}>成熟度</span>
            </div>
          </div>

          <div style={styles.assetGrid}>
            {assetBlocks.map((item) => (
              <div key={item.title} style={styles.assetBlock}>
                <div style={styles.assetIcon}>{item.icon}</div>
                <div style={styles.assetTitle}>{item.title}</div>
                <div style={styles.assetText}>{item.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {isMobile ? null : this.renderAssistantPanel(activeSolution)}
    </div>
  );
}

export function renderBuildView(isMobile) {
  var self = this;
  var activeSolution = this.getActiveSolution();
  var result = _customState.diagnosisResult || buildDiagnosisResult(_customState.diagnosisText || '', _customState.activeIndustry, activeSolution);
  var buildSpec = _customState.buildSpec || createBuildSpec(result, activeSolution);
  var buildPrompt = _customState.buildPrompt || buildOpenYidaRunnerPrompt(buildSpec);
  var statusText = _customState.buildSubmitting ? '写入中' : _customState.buildTaskStatus;
  var resultText = '已准备应用蓝图：' + buildSpec.forms.length + ' 张表单、' + buildSpec.processes.length + ' 条流程、' + buildSpec.pages.length + ' 个页面、' + buildSpec.sampleData.length + ' 类演示数据。';
  return (
    <div style={styles.fullPanel}>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.eyebrow}>OpenYida 搭建任务</div>
          <h1 style={styles.pageTitle}>把方案变成可运行 Demo</h1>
        </div>
        <div style={styles.headerActions}>
          <span style={styles.statusPill}>{statusText}</span>
          <button style={styles.primaryButton} onClick={(e) => { self.createDemo(); }}>{_customState.buildSubmitting ? '提交中...' : '生成搭建任务'}</button>
        </div>
      </div>

      <div style={isMobile ? styles.mobileBuildGrid : styles.buildGrid}>
        <div style={styles.sectionPanel}>
          <div style={styles.sectionTitle}>OpenYida 执行清单</div>
          <div style={styles.taskList}>
            {buildSpec.tasks.map((item, index) => self.renderBuildTask({
              title: item.name,
              desc: item.output,
              time: index === 0 ? '准备' : '执行',
              done: !!_customState.buildTaskRecordId && index === 0
            }))}
          </div>
        </div>

        <div style={styles.sectionPanel}>
          <div style={styles.sectionTitle}>生成结果</div>
          <div style={styles.resultBox}>
            <div style={styles.resultTitle}>{buildSpec.appName}</div>
            <div style={styles.resultText}>{resultText}</div>
            {_customState.buildTaskRecordId ? <div style={styles.successText}>已写入 Demo 实例：{_customState.buildTaskRecordId}</div> : null}
            {_customState.buildTaskRecordId ? <div style={styles.runnerCommand}>{buildRunnerCommand(_customState.buildTaskRecordId)}</div> : null}
            {_customState.buildTaskError ? <div style={styles.errorText}>写入失败：{_customState.buildTaskError}</div> : null}
            <div style={styles.actionRow}>
              <button style={styles.primaryButton} onClick={(e) => { self.copyBuildPrompt(); }}>复制执行 Prompt</button>
              <button style={styles.primaryButton} onClick={(e) => { self.generateClientPack(); }}>生成客户材料</button>
              <button style={styles.secondaryButton} onClick={(e) => { self.selectNav('prompts'); }}>查看 Prompt</button>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.buildSpecGrid}>
        <div style={styles.specCard}>
          <div style={styles.sectionCardTitle}>表单</div>
          {buildSpec.forms.map((item) => <div key={item} style={styles.checkItem}>{item}</div>)}
        </div>
        <div style={styles.specCard}>
          <div style={styles.sectionCardTitle}>流程</div>
          {buildSpec.processes.map((item) => <div key={item} style={styles.checkItem}>{item}</div>)}
        </div>
        <div style={styles.specCard}>
          <div style={styles.sectionCardTitle}>页面</div>
          {buildSpec.pages.map((item) => <div key={item} style={styles.checkItem}>{item}</div>)}
        </div>
        <div style={styles.specCard}>
          <div style={styles.sectionCardTitle}>演示数据</div>
          {buildSpec.sampleData.map((item) => <div key={item} style={styles.checkItem}>{item}</div>)}
        </div>
      </div>

      <div style={styles.promptBox}>
        <div style={Object.assign({}, styles.sectionCardTitle, { color: '#FFFFFF' })}>OpenYida 执行 Prompt</div>
        <pre style={styles.codeText}>{buildPrompt}</pre>
      </div>
    </div>
  );
}

export function renderMaterialSection(title, items) {
  return (
    <div style={styles.materialSection}>
      <div style={styles.sectionCardTitle}>{title}</div>
      <div style={styles.materialList}>
        {items.map((item) => (
          <div key={item} style={styles.checkItem}>{item}</div>
        ))}
      </div>
    </div>
  );
}

export function renderPromptView() {
  var self = this;
  var cart = _customState.promptCart || [];
  return (
    <div style={styles.fullPanel}>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.eyebrow}>悟空 Prompt 资产库</div>
          <h1 style={styles.pageTitle}>让每个方案都能被 AI 复用</h1>
        </div>
        <span style={styles.statusPill}>已选 {cart.length} 条</span>
      </div>
      <div style={styles.cartPanel}>
        <div style={styles.suggestionTitle}>当前方案 Prompt 包</div>
        <div style={styles.cartRow}>
          {cart.map((item) => (
            <span key={item} style={styles.cartChip}>{item}</span>
          ))}
        </div>
      </div>
      <div style={styles.promptGrid}>
        {promptAssets.map((item) => self.renderPrompt(item))}
      </div>
    </div>
  );
}

export function renderMaterialsView() {
  var self = this;
  var activeSolution = this.getActiveSolution();
  var generated = !!_customState.materialGenerated;
  var material = _customState.materialResult;
  var result = _customState.diagnosisResult || buildDiagnosisResult(_customState.diagnosisText || '', _customState.activeIndustry, activeSolution);
  return (
    <div style={styles.fullPanel}>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.eyebrow}>客户材料</div>
          <h1 style={styles.pageTitle}>一键生成客户版交付包</h1>
        </div>
        <div style={styles.headerActions}>
          <span style={styles.statusPill}>{_customState.materialLoading ? 'AI 生成中' : (generated ? '已生成' : '待生成')}</span>
          <button style={styles.primaryButton} onClick={(e) => { self.generateClientPack(); }}>{_customState.materialLoading ? '生成中...' : '重新生成'}</button>
        </div>
      </div>
      <div style={styles.generatedBanner}>
        <div>
          <div style={styles.resultTitle}>{material ? material.title : activeSolution.title}</div>
          <div style={styles.resultText}>
            {_customState.materialLoading ? '正在调用宜搭 AI 生成客户价值、演示路径、FAQ、PRD 范围和验收口径。' : (material ? material.executiveSummary : '点击重新生成后，会按客户场景组织材料：客户价值、演示路径、字段流程、FAQ 和下一步共创清单。')}
          </div>
          {_customState.aiError && generated ? <div style={styles.errorText}>宜搭 AI 返回：{_customState.aiError}</div> : null}
        </div>
        <button style={styles.secondaryButton} onClick={(e) => { self.selectNav('solutions'); }}>回到方案包</button>
      </div>
      {material ? (
        <div style={styles.materialDetailGrid}>
          {self.renderMaterialSection('20 分钟演示话术', material.demoScript)}
          {self.renderMaterialSection('客户 FAQ', material.faq)}
          {self.renderMaterialSection('验收口径', material.acceptance)}
          {self.renderMaterialSection('PRD 范围', material.prdScope)}
        </div>
      ) : null}
      <div style={styles.materialGrid}>
        {materialItems.map((item) => (
          <div key={item.title} style={styles.materialCard}>
            <div style={styles.materialIcon}>{item.icon}</div>
            <div style={styles.materialTitle}>{item.title}</div>
            <div style={styles.materialDesc}>{item.desc}</div>
            <span style={styles.materialStatus}>{generated ? '已生成' : item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function renderIndustriesView(isMobile) {
  var self = this;
  var playbook = getIndustryPlaybook(_customState.activeIndustry);
  var activeSolution = findSolutionByKey(playbook.solutionKey);
  return (
    <div style={styles.fullPanel}>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.eyebrow}>行业地图</div>
          <h1 style={styles.pageTitle}>按行业识别场景、角色和推荐方案</h1>
        </div>
        <button style={styles.primaryButton} onClick={(e) => { self.openIndustrySolution(_customState.activeIndustry); }}>查看行业方案包</button>
      </div>

      <div style={isMobile ? styles.mobileBuildGrid : styles.industryPageGrid}>
        <section style={styles.sectionPanel}>
          <div style={styles.sectionTitle}>行业入口</div>
          <div style={styles.industryGrid}>
            {industries.map((item) => self.renderIndustry(item))}
          </div>
        </section>

        <section style={styles.sectionPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.eyebrow}>{playbook.name} 作战图</div>
              <h2 style={styles.sectionTitle}>{activeSolution.title}</h2>
            </div>
            <span style={styles.statusPill}>{activeSolution.score} 分</span>
          </div>
          <div style={styles.playbookGrid}>
            {playbook.scenes.map((item) => (
              <div key={item} style={styles.playbookCard}>
                <div style={styles.playbookTitle}>{item}</div>
                <div style={styles.playbookDesc}>可沉淀字段、流程、角色权限和看板指标。</div>
              </div>
            ))}
          </div>
          <div style={styles.diagnosisColumns}>
            <div style={styles.insightBox}>
              <div style={styles.suggestionTitle}>拜访识别信号</div>
              {playbook.signals.map((item) => (
                <div key={item} style={styles.checkItem}>{item}</div>
              ))}
            </div>
            <div style={styles.insightBox}>
              <div style={styles.suggestionTitle}>关键确认问题</div>
              {playbook.questions.map((item) => (
                <div key={item} style={styles.checkItem}>{item}</div>
              ))}
            </div>
          </div>
          <div style={styles.actionRow}>
            <button style={styles.primaryButton} onClick={(e) => { self.openIndustrySolution(_customState.activeIndustry); }}>进入方案包</button>
            <button style={styles.secondaryButton} onClick={(e) => { self.createDemo(); }}>按此行业搭建 Demo</button>
          </div>
        </section>
      </div>
    </div>
  );
}

export function renderSolutionsView(isMobile) {
  var self = this;
  var activeSolution = this.getActiveSolution();
  var playbook = getIndustryPlaybook(_customState.activeIndustry);
  var result = _customState.diagnosisResult || buildDiagnosisResult(_customState.diagnosisText || '', _customState.activeIndustry, activeSolution);
  return (
    <div style={styles.fullPanel}>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.eyebrow}>方案包</div>
          <h1 style={styles.pageTitle}>可演示、可交付、可复用的 SA 方案资产</h1>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.secondaryButton} onClick={(e) => { self.selectNav('industries'); }}>行业地图</button>
          <button style={styles.primaryButton} onClick={(e) => { self.generateClientPack(); }}>生成客户材料</button>
        </div>
      </div>

      <div style={isMobile ? styles.mobileBuildGrid : styles.solutionPageGrid}>
        <section style={styles.sectionPanel}>
          <div style={styles.sectionTitle}>方案列表</div>
          <div style={styles.solutionGridCompact}>
            {solutionCards.map((item) => self.renderSolutionCard(item))}
          </div>
        </section>

        <section style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <div>
              <div style={styles.eyebrow}>{playbook.name} · 推荐方案</div>
              <h2 style={styles.detailTitle}>{activeSolution.title}</h2>
              <p style={styles.detailDesc}>{activeSolution.longDesc}</p>
            </div>
            <div style={styles.detailScore}>
              <span style={styles.detailScoreValue}>{activeSolution.score}</span>
              <span style={styles.detailScoreLabel}>成熟度</span>
            </div>
          </div>

          <div style={styles.diagnosisColumns}>
            <div style={styles.insightBox}>
              <div style={styles.suggestionTitle}>客户痛点</div>
              {result.painPoints.map((item) => (
                <div key={item} style={styles.checkItem}>{item}</div>
              ))}
            </div>
            <div style={styles.insightBox}>
              <div style={styles.suggestionTitle}>交付资产</div>
              {result.assets.map((item) => (
                <div key={item} style={styles.checkItem}>{item}</div>
              ))}
            </div>
          </div>

          <div style={styles.assetGrid}>
            {assetBlocks.map((item) => (
              <div key={item.title} style={styles.assetBlock}>
                <div style={styles.assetIcon}>{item.icon}</div>
                <div style={styles.assetTitle}>{item.title}</div>
                <div style={styles.assetText}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={styles.actionRow}>
            <button style={styles.primaryButton} onClick={(e) => { self.createDemo(); }}>OpenYida 搭建</button>
            <button style={styles.secondaryButton} onClick={(e) => { self.copyPrompt('行业方案生成'); }}>加入 Prompt 包</button>
            <button style={styles.secondaryButton} onClick={(e) => { self.generateClientPack(); }}>客户材料</button>
          </div>
        </section>
      </div>
    </div>
  );
}

export function renderVisitsView(isMobile) {
  var self = this;
  var dashboard = this.getDashboardData();
  return (
    <div style={styles.fullPanel}>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.eyebrow}>SA 客户拜访</div>
          <h1 style={styles.pageTitle}>把每次拜访变成可经营资产</h1>
        </div>
        <div style={styles.headerActions}>
          <span style={styles.statusPill}>{_customState.dataLoading ? '加载中' : _customState.dataSourceLabel}</span>
          <button style={styles.secondaryButton} onClick={(e) => { self.refreshDashboardData(); }}>刷新数据</button>
          <button style={styles.primaryButton} onClick={(e) => { self.prepareVisitPlan((dashboard.visitPlans || [])[0], 'diagnose'); }}>生成拜访方案包</button>
        </div>
      </div>

      <div style={styles.visitMetricGrid}>
        {dashboard.visitMetrics.map((item) => self.renderVisitMetric(item))}
      </div>

      <div style={isMobile ? styles.mobileBuildGrid : styles.visitLayout}>
        <section style={styles.sectionPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.eyebrow}>本周拜访计划</div>
              <h2 style={styles.sectionTitle}>拜访前准备、会后纪要、下一步动作</h2>
            </div>
            <span style={styles.statusPill}>{dashboard.visitActionCount} 个待处理</span>
          </div>
          <div style={styles.visitPlanList}>
            {dashboard.visitPlans.map((item) => self.renderVisitPlan(item))}
          </div>
        </section>

        <section style={styles.sectionPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.eyebrow}>拜访推进漏斗</div>
              <h2 style={styles.sectionTitle}>从初访到 Demo 复盘</h2>
            </div>
          </div>
          <div style={styles.funnelList}>
            {dashboard.visitStages.map((item) => self.renderVisitStage(item))}
          </div>
          <div style={styles.aiAdviceBox}>
            <div style={styles.suggestionTitle}>AI 拜访建议</div>
            <div style={styles.suggestionText}>本周高价值拜访集中在制造和政企，建议优先准备设备巡检、督办闭环两个可演示 Demo；3 个客户缺少明确下一步，需要会后 24 小时内补齐 owner 和时间点。</div>
            <div style={styles.actionRow}>
              <button style={styles.miniPrimaryButton} onClick={(e) => { self.prepareVisitPlan((dashboard.visitPlans || [])[0], 'diagnose'); }}>准备首个拜访</button>
              <button style={styles.miniSecondaryButton} onClick={(e) => { self.prepareVisitPlan((dashboard.visitPlans || [])[0], 'build'); }}>创建首个 Demo</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function renderManagerView(isMobile) {
  var self = this;
  var dashboard = this.getDashboardData();
  return (
    <div style={styles.fullPanel}>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.eyebrow}>SA 主管看板</div>
          <h1 style={styles.pageTitle}>团队大盘、个人状态、客户风险一屏看清</h1>
        </div>
        <div style={styles.headerActions}>
          <span style={styles.statusPill}>{_customState.dataLoading ? '加载中' : _customState.dataSourceLabel}</span>
          <button style={styles.secondaryButton} onClick={(e) => { self.refreshDashboardData(); }}>刷新数据</button>
        </div>
      </div>

      <div style={styles.managerMetricGrid}>
        {dashboard.managerMetrics.map((item) => self.renderVisitMetric(item))}
      </div>

      <div style={isMobile ? styles.mobileBuildGrid : styles.managerLayout}>
        <section style={styles.sectionPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.eyebrow}>个人状态</div>
              <h2 style={styles.sectionTitle}>SA 推进质量排行</h2>
            </div>
          </div>
          <div style={styles.teamHeader}>
            <div>SA</div>
            <div>客户</div>
            <div>拜访</div>
            <div>Demo</div>
            <div>逾期</div>
            <div>健康</div>
          </div>
          <div style={styles.teamList}>
            {dashboard.teamRows.map((item) => self.renderTeamRow(item))}
          </div>
        </section>

        <section style={styles.sectionPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.eyebrow}>风险客户</div>
              <h2 style={styles.sectionTitle}>需要主管介入的机会</h2>
            </div>
          </div>
          <div style={styles.riskList}>
            {dashboard.riskCustomers.map((item) => self.renderRiskCustomer(item))}
          </div>
          <div style={styles.aiAdviceBox}>
            <div style={styles.suggestionTitle}>AI 管理建议</div>
            <div style={styles.suggestionText}>建议主管本周陪访「华东精密制造」，并安排行业专家支持「政务督办项目」。有 5 个 Demo 创建后超过 7 天未完成演示，需要逐一确认客户反馈。</div>
            <div style={styles.actionRow}>
              <button style={styles.miniPrimaryButton} onClick={(e) => { self.prepareRiskCustomer((dashboard.riskCustomers || [])[0]); }}>生成重点陪访方案</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function renderContent(activeSolution, isMobile) {
  if (_customState.activeNav === 'visits') {
    return this.renderVisitsView(isMobile);
  }
  if (_customState.activeNav === 'manager') {
    return this.renderManagerView(isMobile);
  }
  if (_customState.activeNav === 'industries') {
    return this.renderIndustriesView(isMobile);
  }
  if (_customState.activeNav === 'solutions') {
    return this.renderSolutionsView(isMobile);
  }
  if (_customState.activeNav === 'build') {
    return this.renderBuildView(isMobile);
  }
  if (_customState.activeNav === 'prompts') {
    return this.renderPromptView();
  }
  if (_customState.activeNav === 'materials') {
    return this.renderMaterialsView();
  }
  return this.renderWorkbench(activeSolution, isMobile);
}

export function renderJsx() {
  var self = this;
  var isMobile = this.utils.isMobile();
  var timestamp = this.state && this.state.timestamp;
  var activeSolution = this.getActiveSolution();

  return (
    <div style={styles.page}>
      <div style={{ display: 'none' }}>{timestamp}</div>
      <div style={isMobile ? styles.mobileShell : styles.shell}>
        {isMobile ? null : (
          <aside style={styles.sidebar}>
            <div style={styles.brand}>
              <div style={styles.brandMark}>钉</div>
              <div>
                <div style={styles.brandTitle}>AI 解决方案中心</div>
                <div style={styles.brandSub}>SA Solution Hub</div>
              </div>
            </div>
            <nav style={styles.navList}>
              {navItems.map((item) => self.renderNavItem(item))}
            </nav>
          </aside>
        )}

        <div style={isMobile ? Object.assign({}, styles.content, styles.mobileContent) : styles.content}>
          <header style={isMobile ? Object.assign({}, styles.topbar, styles.mobileTopbar) : styles.topbar}>
            <div>
              <div style={styles.topTitle}>SA AI 作战台</div>
              <div style={styles.topSub}>需求诊断、客户拜访、团队大盘、Demo 搭建、材料生成</div>
            </div>
            <div style={isMobile ? Object.assign({}, styles.topActions, styles.mobileTopActions) : styles.topActions}>
              <span style={styles.topChip}>悟空已接入</span>
              <span style={styles.topChip}>OpenYida 可搭建</span>
            </div>
          </header>

          {isMobile ? (
            <div style={styles.mobileNav}>
              {navItems.map((item) => self.renderNavItem(item))}
            </div>
          ) : null}

          {this.renderContent(activeSolution, isMobile)}
        </div>
      </div>
    </div>
  );
}

var navItems = [
  { key: 'workbench', label: '工作台', icon: '⌘' },
  { key: 'visits', label: '客户拜访', icon: '日', badge: '9' },
  { key: 'manager', label: '主管看板', icon: '盘', badge: '3' },
  { key: 'industries', label: '行业地图', icon: '▦' },
  { key: 'solutions', label: '方案包', icon: '□', badge: 'S' },
  { key: 'prompts', label: '悟空 Prompt', icon: '✦' },
  { key: 'build', label: 'OpenYida 搭建', icon: '▶' },
  { key: 'materials', label: '客户材料', icon: '↗' }
];

var metricItems = [
  { label: '可一键搭建方案', value: '24', delta: '+6 本周', icon: '搭', color: '#2563EB', target: 'build' },
  { label: '高复用方案包', value: '68', delta: 'S/A 级', icon: '方', color: '#059669', target: 'solutions' },
  { label: '悟空 Prompt', value: '186', delta: '+32', icon: 'AI', color: '#7C3AED', target: 'prompts' },
  { label: 'SA 共创待审', value: '17', delta: '需处理', icon: '审', color: '#D97706', target: 'manager' }
];

var pipelineSteps = [
  { no: '01', title: '识别需求', desc: '贴入客户背景、会议纪要或商机描述，悟空提炼业务痛点。' },
  { no: '02', title: '匹配方案', desc: '按行业、场景和成熟度推荐可复用方案包。' },
  { no: '03', title: '搭建 Demo', desc: 'OpenYida 创建表单、流程、报表、自定义页和演示数据。' },
  { no: '04', title: '交付材料', desc: '生成客户版方案、演示话术、FAQ、PRD 和验收清单。' }
];

var industries = [
  { key: 'manufacturing', name: '制造', count: 18, demo: 7 },
  { key: 'retail', name: '零售', count: 12, demo: 4 },
  { key: 'property', name: '地产物业', count: 9, demo: 3 },
  { key: 'education', name: '教育', count: 8, demo: 2 },
  { key: 'logistics', name: '物流供应链', count: 10, demo: 4 },
  { key: 'government', name: '政企', count: 11, demo: 3 }
];

var industryDefaultSolutions = {
  manufacturing: 'inspection',
  retail: 'store',
  property: 'repair',
  education: 'admission',
  logistics: 'dispatch',
  government: 'supervision'
};

var industryPlaybooks = {
  manufacturing: {
    name: '制造',
    solutionKey: 'inspection',
    roles: ['生产负责人', '设备主管', '一线巡检员', '维修班组'],
    scenes: ['设备点检', '异常上报', '维修派单', '管理驾驶舱'],
    signals: ['设备台账分散，巡检结果靠纸质或群消息流转', '异常发现后缺少责任人、时限和状态追踪', '维修响应时效和产线风险无法被主管实时看见', '多工厂、多车间指标口径不统一，复盘成本高'],
    questions: ['设备和产线台账目前在哪个系统维护？', '异常从发现到派单会经过哪些角色？', '主管最关心哪些时效、趋势和排行指标？'],
    assets: ['设备台账表', '巡检任务表', '异常上报流程', '维修工单看板']
  },
  retail: {
    name: '零售',
    solutionKey: 'store',
    roles: ['总部运营', '区域经理', '门店店长', '一线导购'],
    scenes: ['门店巡检', '问题整改', '区域排行', '复盘报告'],
    signals: ['门店执行标准难统一，总部无法快速看到整改进度', '区域经理靠群消息追进展，问题闭环依赖人工催办', '巡店图片、记录和评分没有形成可复用资产', '门店之间缺少清晰排行和优秀案例沉淀'],
    questions: ['总部目前如何下发巡店标准？', '整改超期后由谁提醒和升级？', '区域经理每周需要哪些排行和复盘指标？'],
    assets: ['门店档案表', '巡店检查表', '整改督办流程', '区域经营看板']
  },
  property: {
    name: '地产物业',
    solutionKey: 'repair',
    roles: ['物业经理', '客服前台', '维修师傅', '业主/租户'],
    scenes: ['住户报修', '工单派发', '维修反馈', '满意度看板'],
    signals: ['报修入口分散，客服需要二次录入和人工派单', '维修进度不透明，住户反复询问处理状态', '服务评价没有形成问题复盘和人员绩效依据', '园区多项目管理缺少统一服务看板'],
    questions: ['当前报修入口主要来自哪里？', '工单派发规则按项目、楼栋还是技能区分？', '满意度和超时规则是否需要纳入考核？'],
    assets: ['报修申请表', '维修工单流程', '服务评价表', '项目服务看板']
  },
  education: {
    name: '教育',
    solutionKey: 'admission',
    roles: ['招生负责人', '校区主管', '课程顾问', '教务老师'],
    scenes: ['线索录入', '跟进提醒', '试听转化', '招生漏斗'],
    signals: ['线索来自多渠道，归属和跟进记录不完整', '顾问跟进节奏靠个人经验，缺少提醒和复盘', '试听、报价、报名节点缺少统一转化漏斗', '校区负责人无法及时看到高意向线索和流失原因'],
    questions: ['线索来源和分配规则是什么？', '从线索到报名有哪些关键节点？', '校区主管每天需要看哪些转化和风险指标？'],
    assets: ['招生线索表', '跟进记录表', '试听预约流程', '转化漏斗看板']
  },
  logistics: {
    name: '物流供应链',
    solutionKey: 'dispatch',
    roles: ['运输负责人', '调度员', '司机', '客服/结算'],
    scenes: ['车辆调度', '运输异常', '回单上传', '线路运营看板'],
    signals: ['派车和线路调整依赖电话沟通，过程记录不完整', '运输异常上报不及时，客服无法同步客户进度', '回单、签收和结算材料分散，影响回款效率', '线路准点率和异常原因缺少持续分析'],
    questions: ['派车规则主要看车辆、司机还是线路？', '运输异常需要通知哪些角色？', '回单和结算材料目前如何归档？'],
    assets: ['车辆台账表', '派车任务表', '运输异常流程', '线路运营看板']
  },
  government: {
    name: '政企',
    solutionKey: 'supervision',
    roles: ['分管领导', '督办专员', '责任部门', '协同单位'],
    scenes: ['任务分解', '责任流转', '进度预警', '领导驾驶舱'],
    signals: ['会议纪要和重点事项缺少结构化拆解', '跨部门责任边界不清，进度催办靠人工跟进', '超期和风险缺少自动预警和升级机制', '领导需要一屏看清大盘、重点风险和个人责任'],
    questions: ['督办事项来源主要是会议、文件还是领导交办？', '责任部门和协同部门如何确认？', '领导驾驶舱最关心哪些状态和预警？'],
    assets: ['督办事项表', '任务分解流程', '进度填报表', '领导驾驶舱']
  }
};

var solutionCards = [
  {
    key: 'inspection',
    grade: 'S',
    rankColor: '#059669',
    score: 92,
    title: '制造业设备巡检与异常闭环',
    desc: '巡检、异常上报、维修派单、管理驾驶舱。',
    longDesc: '适合有设备点检、产线巡检、维修响应和现场异常闭环诉求的制造企业，演示重点是从移动端上报到管理端看板。',
    tags: ['制造', '可搭建', '高复用']
  },
  {
    key: 'store',
    grade: 'A',
    rankColor: '#2563EB',
    score: 86,
    title: '零售门店巡检与整改闭环',
    desc: '门店检查、整改派发、区域排行、复盘报告。',
    longDesc: '适合直营或加盟门店管理场景，强调总部标准下发、门店执行、问题整改和区域管理。',
    tags: ['零售', '移动端', '督办']
  },
  {
    key: 'repair',
    grade: 'A',
    rankColor: '#2563EB',
    score: 84,
    title: '物业报修与服务评价',
    desc: '住户报修、工单派发、维修反馈、满意度看板。',
    longDesc: '适合园区、物业和后勤服务场景，客户能直观看到服务闭环和体验提升。',
    tags: ['物业', '服务', '工单']
  },
  {
    key: 'admission',
    grade: 'B',
    rankColor: '#D97706',
    score: 78,
    title: '教育招生线索转化',
    desc: '线索录入、跟进提醒、转化漏斗、招生分析。',
    longDesc: '适合招生、销售和客户运营团队，适合作为 CRM 轻量化切入场景。',
    tags: ['教育', 'CRM', '漏斗']
  },
  {
    key: 'dispatch',
    grade: 'A',
    rankColor: '#2563EB',
    score: 83,
    title: '物流车辆调度与异常上报',
    desc: '派车、运输异常、回单、线路运营看板。',
    longDesc: '适合运输、配送和仓运一体客户，重点展示跨角色任务协同。',
    tags: ['物流', '调度', '异常']
  },
  {
    key: 'supervision',
    grade: 'A',
    rankColor: '#2563EB',
    score: 85,
    title: '政企督办事项闭环',
    desc: '任务分解、责任流转、进度预警、领导驾驶舱。',
    longDesc: '适合政企客户的督办、纪要待办和重点工作推进场景。',
    tags: ['政企', '督办', '看板']
  }
];

var assetBlocks = [
  { icon: '蓝', title: '应用蓝图', desc: '4 张表单、2 条流程、1 个首页、1 个经营看板。' },
  { icon: '提', title: '悟空 Prompt', desc: '需求分析、方案改写、演示话术、异议处理。' },
  { icon: '搭', title: 'OpenYida 动作', desc: '创建应用、生成页面、发布看板、准备演示数据。' },
  { icon: '交', title: '交付资产', desc: '客户版方案、PRD、FAQ、验收清单和风险说明。' }
];

var promptAssets = [
  { label: '客户需求分析', desc: '从会议纪要中提炼行业、痛点、角色、流程和系统边界。' },
  { label: '行业方案生成', desc: '按客户行业生成价值主张、应用蓝图和演示路径。' },
  { label: '客户话术改写', desc: '把内部方案转成客户听得懂的业务语言。' },
  { label: '异议处理', desc: '围绕价格、交付周期、数据安全、系统集成生成回应。' },
  { label: 'PRD 生成', desc: '将确认后的方案转为需求、字段、流程和验收标准。' },
  { label: '方案质检', desc: '检查方案是否具备可演示、可交付、可复用条件。' }
];

var buildTasks = [
  { title: '创建样板应用', desc: '创建「制造业设备巡检 AI Demo」应用空间。', time: '20s', done: true },
  { title: '生成核心表单', desc: '设备台账、巡检任务、异常上报、维修工单。', time: '2min', done: true },
  { title: '配置流程规则', desc: '异常分派、维修处理、验收评价。', time: '3min', done: true },
  { title: '发布管理看板', desc: '异常趋势、响应时效、产线排行。', time: '2min', done: false },
  { title: '准备演示数据', desc: '生成 50 条巡检和维修样例数据。', time: '1min', done: false }
];

var materialItems = [
  { icon: 'PPT', title: '客户版方案 PPT', desc: '自动生成 12 页客户沟通版材料。', status: '可生成' },
  { icon: '话', title: '20 分钟演示话术', desc: '按开场、痛点、演示、总结组织。', status: '已就绪' },
  { icon: 'PRD', title: 'PRD 草稿', desc: '字段、流程、权限、报表和验收标准。', status: '可生成' },
  { icon: 'FAQ', title: '客户 FAQ', desc: '覆盖安全、集成、交付、后续扩展。', status: '已就绪' }
];

var visitMetrics = [
  { label: '本周客户拜访', value: '42', hint: '+18% 环比', color: '#059669' },
  { label: '拜访前准备率', value: '87%', hint: '目标 85%', color: '#2563EB' },
  { label: '会后纪要沉淀', value: '91%', hint: '自动生成 28 份', color: '#7C3AED' },
  { label: '下一步明确率', value: '76%', hint: '9 个待补齐', color: '#D97706' }
];

var visitPlans = [
  { customer: '华东精密制造', time: '今天 14:00', owner: '林晨', stage: '方案演示', status: '已准备', bg: '#ECFDF5', color: '#047857', goal: '演示设备巡检异常闭环，确认维修派单和驾驶舱指标。', solution: '设备巡检', demo: 'Demo 已创建', risk: '决策链' },
  { customer: '北方连锁零售', time: '明天 10:30', owner: '周岚', stage: '需求确认', status: '待准备', bg: '#FEF3C7', color: '#B45309', goal: '梳理门店巡检、整改督办和区域排行诉求。', solution: '门店巡检', demo: 'Demo 待创建', risk: '预算' },
  { customer: '政务协同中心', time: '周五 16:00', owner: '陈越', stage: 'POC 评估', status: '需支持', bg: '#FEE2E2', color: '#B91C1C', goal: '确认督办事项闭环、领导驾驶舱和数据权限边界。', solution: '政企督办', demo: '需改版', risk: '交付边界' },
  { customer: '东南物流集团', time: '周五 19:00', owner: '许宁', stage: '初访', status: 'AI 建议', bg: '#EFF6FF', color: '#1D4ED8', goal: '验证车辆调度、运输异常和回单流转是否为切入点。', solution: '车辆调度', demo: '方案待选', risk: '' }
];

var visitStages = [
  { label: '初访', count: 36, value: 92, color: '#2563EB' },
  { label: '需求确认', count: 24, value: 72, color: '#0F766E' },
  { label: '方案演示', count: 18, value: 58, color: '#7C3AED' },
  { label: 'Demo/POC', count: 11, value: 42, color: '#D97706' },
  { label: '商务推进', count: 7, value: 30, color: '#DC2626' }
];

var managerMetrics = [
  { label: '活跃客户', value: '126', hint: '+14 本周', color: '#2563EB' },
  { label: '方案演示', value: '31', hint: '转阶段 12', color: '#059669' },
  { label: 'Demo 创建', value: '19', hint: '5 个未演示', color: '#7C3AED' },
  { label: '高风险客户', value: '8', hint: '3 个需陪访', color: '#DC2626' }
];

var teamRows = [
  { name: '林晨', focus: '制造 · 高价值客户', customers: 18, visits: 9, demos: 5, overdue: 1, health: 92 },
  { name: '周岚', focus: '零售 · 门店巡检', customers: 15, visits: 8, demos: 3, overdue: 3, health: 78 },
  { name: '陈越', focus: '政企 · 督办协同', customers: 12, visits: 6, demos: 4, overdue: 2, health: 82 },
  { name: '许宁', focus: '物流 · 车辆调度', customers: 14, visits: 5, demos: 2, overdue: 0, health: 88 },
  { name: '孟琪', focus: '教育 · 招生转化', customers: 11, visits: 4, demos: 1, overdue: 4, health: 66 }
];

var riskCustomers = [
  { customer: '华东精密制造', reason: '高价值客户，已演示 Demo，但决策链缺少 IT 和生产负责人。', level: '需陪访' },
  { customer: '政务协同中心', reason: 'POC 范围扩大，交付边界不清，建议行业专家介入。', level: '高风险' },
  { customer: '北方连锁零售', reason: '预算周期不明确，门店侧需求强但总部 owner 未确认。', level: '待推进' },
  { customer: '西南装备集团', reason: 'Demo 创建 9 天未演示，需要确认客户时间和演示人。', level: '停滞' }
];

var myPackages = [
  { name: '制造巡检客户包', count: '8 项' },
  { name: '门店巡检复用包', count: '6 项' },
  { name: '政企督办演示包', count: '5 项' }
];

var maturityItems = [
  { label: '行业匹配', value: 94 },
  { label: '可演示', value: 90 },
  { label: '可交付', value: 86 },
  { label: 'AI 化', value: 88 },
  { label: '可搭建', value: 92 }
];

var diagnosisLabels = {
  ready: '待诊断',
  thinking: 'AI 诊断中',
  generated: '已生成',
  industry: '行业已切换',
  solution: '方案已选择',
  building: '搭建中',
  materials: '材料已生成'
};

var styles = {
  page: {
    minHeight: '100vh',
    background: '#EAF0F6',
    color: '#172033',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", Arial, sans-serif'
  },
  shell: {
    minHeight: '100vh',
    display: 'block'
  },
  mobileShell: {
    minHeight: '100vh',
    display: 'block',
    width: '100%',
    maxWidth: '100vw',
    overflowX: 'hidden'
  },
  sidebar: {
    background: '#162033',
    color: '#FFFFFF',
    padding: '22px 16px',
    boxSizing: 'border-box',
    borderRight: '1px solid rgba(255,255,255,0.08)',
    position: 'fixed',
    top: 0,
    left: 0,
    width: '236px',
    height: '100vh',
    overflowY: 'auto',
    zIndex: 20
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '28px'
  },
  brandMark: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: '#2F6FED',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800
  },
  brandTitle: {
    fontSize: '16px',
    fontWeight: 700
  },
  brandSub: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.55)',
    marginTop: '2px'
  },
  navList: {
    display: 'grid',
    gap: '6px'
  },
  navItem: {
    width: '100%',
    height: '42px',
    border: '0',
    borderRadius: '8px',
    background: 'transparent',
    color: 'rgba(255,255,255,0.78)',
    display: 'grid',
    gridTemplateColumns: '28px 1fr auto',
    alignItems: 'center',
    gap: '8px',
    padding: '0 10px',
    textAlign: 'left',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },
  navItemActive: {
    background: '#24324B',
    color: '#FFFFFF'
  },
  navIcon: {
    width: '24px',
    height: '24px',
    borderRadius: '7px',
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px'
  },
  navIconActive: {
    background: '#2F6FED'
  },
  navText: {
    fontSize: '14px',
    whiteSpace: 'nowrap'
  },
  navBadge: {
    minWidth: '20px',
    height: '20px',
    borderRadius: '10px',
    background: '#F59E0B',
    color: '#111827',
    fontSize: '11px',
    lineHeight: '20px',
    textAlign: 'center',
    fontWeight: 800
  },
  content: {
    minWidth: 0,
    padding: '18px',
    boxSizing: 'border-box',
    marginLeft: '236px'
  },
  mobileContent: {
    padding: '12px',
    width: '100%',
    maxWidth: '100vw',
    overflowX: 'hidden',
    marginLeft: 0
  },
  topbar: {
    minHeight: '64px',
    background: '#FFFFFF',
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    boxSizing: 'border-box',
    marginBottom: '14px'
  },
  mobileTopbar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: '10px',
    padding: '12px',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden'
  },
  topTitle: {
    fontSize: '18px',
    fontWeight: 800
  },
  topSub: {
    fontSize: '12px',
    color: '#6B7280',
    marginTop: '4px'
  },
  topActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  mobileTopActions: {
    justifyContent: 'flex-start',
    width: '100%'
  },
  topChip: {
    height: '28px',
    lineHeight: '28px',
    borderRadius: '8px',
    padding: '0 10px',
    background: '#EEF6FF',
    color: '#1D4ED8',
    fontSize: '12px',
    fontWeight: 700
  },
  mobileNav: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    marginBottom: '12px'
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    gap: '14px',
    alignItems: 'start'
  },
  mobileMainGrid: {
    display: 'block'
  },
  mainColumn: {
    display: 'grid',
    gap: '14px',
    minWidth: 0
  },
  heroPanel: {
    minHeight: '172px',
    background: 'linear-gradient(135deg, #0F766E 0%, #2563EB 58%, #6D28D9 100%)',
    borderRadius: '8px',
    padding: '24px',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '16px',
    boxSizing: 'border-box',
    overflow: 'hidden'
  },
  mobileHeroPanel: {
    minHeight: 'auto',
    display: 'block',
    padding: '20px',
    width: '100%',
    maxWidth: '100%',
    overflow: 'visible'
  },
  heroCopy: {
    maxWidth: '640px',
    minWidth: 0
  },
  eyebrow: {
    fontSize: '12px',
    color: '#4B8BFF',
    fontWeight: 800,
    letterSpacing: '0',
    marginBottom: '8px'
  },
  heroTitle: {
    fontSize: '34px',
    lineHeight: 1.18,
    fontWeight: 900,
    margin: '0 0 10px'
  },
  mobileHeroTitle: {
    fontSize: '28px',
    lineHeight: 1.22,
    wordBreak: 'break-word'
  },
  heroSubtitle: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.86)',
    margin: 0,
    lineHeight: 1.6
  },
  mobileHeroSubtitle: {
    fontSize: '14px'
  },
  heroActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  mobileHeroActions: {
    justifyContent: 'flex-start',
    marginTop: '14px'
  },
  primaryButton: {
    height: '36px',
    border: '0',
    borderRadius: '8px',
    background: '#2563EB',
    color: '#FFFFFF',
    padding: '0 14px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  secondaryButton: {
    height: '36px',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    background: '#FFFFFF',
    color: '#1F2937',
    padding: '0 14px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  miniPrimaryButton: {
    height: '28px',
    border: '0',
    borderRadius: '7px',
    background: '#2563EB',
    color: '#FFFFFF',
    padding: '0 10px',
    fontSize: '12px',
    fontWeight: 850,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  miniSecondaryButton: {
    height: '28px',
    border: '1px solid #CBD5E1',
    borderRadius: '7px',
    background: '#FFFFFF',
    color: '#334155',
    padding: '0 10px',
    fontSize: '12px',
    fontWeight: 850,
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  diagnosisPanel: {
    background: '#FFFFFF',
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    padding: '16px',
    boxSizing: 'border-box'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '14px'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap'
  },
  sectionTitle: {
    fontSize: '17px',
    lineHeight: 1.3,
    fontWeight: 850,
    margin: 0
  },
  pageTitle: {
    fontSize: '24px',
    lineHeight: 1.25,
    fontWeight: 900,
    margin: 0
  },
  statusPill: {
    height: '26px',
    lineHeight: '26px',
    borderRadius: '8px',
    padding: '0 10px',
    background: '#ECFDF5',
    color: '#047857',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap'
  },
  textarea: {
    width: '100%',
    minHeight: '92px',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    padding: '12px',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#1F2937',
    outline: 'none',
    fontFamily: 'inherit',
    background: '#F8FAFC'
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '12px'
  },
  diagnosisResult: {
    marginTop: '14px',
    border: '1px solid #C7D2FE',
    borderRadius: '8px',
    background: '#F8FBFF',
    padding: '14px',
    boxSizing: 'border-box'
  },
  diagnosisResultTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '14px'
  },
  diagnosisColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '10px',
    marginTop: '12px'
  },
  insightBox: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#FFFFFF',
    padding: '12px',
    boxSizing: 'border-box'
  },
  checkItem: {
    position: 'relative',
    paddingLeft: '14px',
    marginTop: '7px',
    fontSize: '12px',
    lineHeight: 1.55,
    color: '#475569'
  },
  promptPreview: {
    marginTop: '12px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#FFFFFF',
    padding: '10px',
    fontSize: '12px',
    lineHeight: 1.55,
    color: '#334155'
  },
  errorText: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#B45309',
    lineHeight: 1.5
  },
  successText: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#047857',
    lineHeight: 1.5,
    fontWeight: 800
  },
  runnerCommand: {
    marginTop: '8px',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    background: '#FFFFFF',
    color: '#334155',
    padding: '8px 10px',
    fontSize: '12px',
    lineHeight: 1.5,
    fontFamily: 'Menlo, Consolas, monospace',
    wordBreak: 'break-all'
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px'
  },
  metricCard: {
    background: '#FFFFFF',
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    padding: '14px',
    boxSizing: 'border-box',
    minHeight: '124px',
    width: '100%',
    color: '#172033',
    textAlign: 'left',
    cursor: 'default',
    fontFamily: 'inherit'
  },
  metricCardClickable: {
    cursor: 'pointer'
  },
  metricTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px'
  },
  metricIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900
  },
  metricDelta: {
    fontSize: '12px',
    color: '#64748B',
    fontWeight: 700
  },
  metricValue: {
    fontSize: '30px',
    lineHeight: 1,
    fontWeight: 900,
    marginBottom: '8px'
  },
  metricLabel: {
    fontSize: '13px',
    color: '#64748B'
  },
  sectionPanel: {
    background: '#FFFFFF',
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    padding: '16px',
    boxSizing: 'border-box'
  },
  pipelineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px'
  },
  pipelineStep: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '12px',
    minHeight: '118px',
    boxSizing: 'border-box',
    background: '#F8FAFC'
  },
  pipelineNumber: {
    width: '32px',
    height: '24px',
    lineHeight: '24px',
    borderRadius: '7px',
    background: '#DBEAFE',
    color: '#1D4ED8',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 900,
    marginBottom: '10px'
  },
  pipelineBody: {
    minWidth: 0
  },
  pipelineTitle: {
    fontSize: '14px',
    fontWeight: 850,
    marginBottom: '6px'
  },
  pipelineDesc: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: 1.55
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: '0.92fr 1.08fr',
    gap: '14px',
    alignItems: 'start'
  },
  industryGrid: {
    display: 'grid',
    gap: '8px'
  },
  industryButton: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#FFFFFF',
    padding: '11px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'grid',
    gap: '4px'
  },
  industryButtonActive: {
    borderColor: '#2563EB',
    background: '#EFF6FF'
  },
  industryName: {
    fontSize: '14px',
    fontWeight: 850,
    color: '#172033'
  },
  industryMeta: {
    fontSize: '12px',
    color: '#64748B'
  },
  solutionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px'
  },
  solutionCard: {
    minHeight: '152px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#FFFFFF',
    padding: '12px',
    textAlign: 'left',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },
  solutionCardActive: {
    borderColor: '#2563EB',
    background: '#F8FBFF',
    boxShadow: '0 8px 22px rgba(37, 99, 235, 0.12)'
  },
  solutionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px'
  },
  solutionRank: {
    minWidth: '26px',
    height: '24px',
    lineHeight: '24px',
    borderRadius: '7px',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 900
  },
  solutionScore: {
    fontSize: '12px',
    color: '#64748B',
    fontWeight: 800
  },
  solutionTitle: {
    fontSize: '14px',
    lineHeight: 1.38,
    fontWeight: 850,
    color: '#172033',
    marginBottom: '7px'
  },
  solutionDesc: {
    fontSize: '12px',
    lineHeight: 1.5,
    color: '#64748B',
    minHeight: '36px'
  },
  tagRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '10px'
  },
  smallTag: {
    height: '22px',
    lineHeight: '22px',
    borderRadius: '7px',
    background: '#F1F5F9',
    color: '#475569',
    padding: '0 7px',
    fontSize: '11px',
    fontWeight: 700
  },
  detailPanel: {
    background: '#FFFFFF',
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    padding: '18px',
    boxSizing: 'border-box'
  },
  detailHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 110px',
    gap: '16px',
    alignItems: 'start',
    marginBottom: '16px'
  },
  detailTitle: {
    fontSize: '22px',
    lineHeight: 1.3,
    fontWeight: 900,
    margin: '0 0 8px'
  },
  detailDesc: {
    margin: 0,
    fontSize: '13px',
    lineHeight: 1.65,
    color: '#64748B'
  },
  detailScore: {
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    minHeight: '86px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F8FAFC'
  },
  detailScoreValue: {
    fontSize: '28px',
    fontWeight: 900,
    color: '#059669',
    lineHeight: 1
  },
  detailScoreLabel: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '6px'
  },
  assetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px'
  },
  assetBlock: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#F8FAFC',
    padding: '12px',
    boxSizing: 'border-box'
  },
  assetIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    background: '#0F766E',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900,
    marginBottom: '10px'
  },
  assetTitle: {
    fontSize: '14px',
    fontWeight: 850,
    marginBottom: '6px'
  },
  assetText: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: 1.55
  },
  sidePanel: {
    background: '#FFFFFF',
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    padding: '16px',
    boxSizing: 'border-box',
    display: 'grid',
    gap: '16px',
    position: 'sticky',
    top: '18px'
  },
  assistantHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center'
  },
  sideTitle: {
    fontSize: '18px',
    lineHeight: 1.25,
    fontWeight: 900,
    margin: 0
  },
  assistantAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '8px',
    background: '#6D28D9',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 900
  },
  suggestionBox: {
    borderRadius: '8px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    padding: '12px'
  },
  suggestionTitle: {
    fontSize: '13px',
    fontWeight: 850,
    marginBottom: '6px'
  },
  suggestionText: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: 1.65
  },
  sideSection: {
    display: 'grid',
    gap: '8px'
  },
  sideSectionTitle: {
    fontSize: '13px',
    fontWeight: 850,
    color: '#334155'
  },
  packageRow: {
    minHeight: '34px',
    display: 'grid',
    gridTemplateColumns: '12px 1fr auto',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid #EEF2F7'
  },
  packageDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#2563EB'
  },
  packageName: {
    fontSize: '12px',
    color: '#334155'
  },
  packageMeta: {
    fontSize: '12px',
    color: '#64748B',
    fontWeight: 800
  },
  radarRow: {
    display: 'grid',
    gridTemplateColumns: '58px 1fr 28px',
    alignItems: 'center',
    gap: '8px'
  },
  radarLabel: {
    fontSize: '12px',
    color: '#475569'
  },
  radarBar: {
    height: '7px',
    borderRadius: '4px',
    background: '#E2E8F0',
    overflow: 'hidden'
  },
  radarFill: {
    display: 'block',
    height: '100%',
    borderRadius: '4px',
    background: '#059669'
  },
  radarValue: {
    fontSize: '12px',
    color: '#64748B',
    textAlign: 'right'
  },
  fullPanel: {
    background: '#FFFFFF',
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    padding: '18px',
    boxSizing: 'border-box',
    minHeight: 'calc(100vh - 100px)'
  },
  industryPageGrid: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(0, 1fr)',
    gap: '14px',
    alignItems: 'start'
  },
  playbookGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '10px',
    marginBottom: '12px'
  },
  playbookCard: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#F8FAFC',
    padding: '12px',
    minHeight: '86px',
    boxSizing: 'border-box'
  },
  playbookTitle: {
    fontSize: '14px',
    fontWeight: 900,
    color: '#172033',
    marginBottom: '6px'
  },
  playbookDesc: {
    fontSize: '12px',
    lineHeight: 1.5,
    color: '#64748B'
  },
  solutionPageGrid: {
    display: 'grid',
    gridTemplateColumns: '340px minmax(0, 1fr)',
    gap: '14px',
    alignItems: 'start'
  },
  solutionGridCompact: {
    display: 'grid',
    gap: '10px'
  },
  buildGrid: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.9fr',
    gap: '14px'
  },
  mobileBuildGrid: {
    display: 'grid',
    gap: '14px'
  },
  taskList: {
    display: 'grid',
    gap: '8px',
    marginTop: '12px'
  },
  taskRow: {
    display: 'grid',
    gridTemplateColumns: '28px 1fr auto',
    gap: '10px',
    alignItems: 'center',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '10px',
    background: '#F8FAFC'
  },
  taskStatus: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#E2E8F0',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900
  },
  taskStatusDone: {
    background: '#DCFCE7',
    color: '#047857'
  },
  taskContent: {
    minWidth: 0
  },
  taskTitle: {
    fontSize: '13px',
    fontWeight: 850,
    marginBottom: '4px'
  },
  taskDesc: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: 1.5
  },
  taskTime: {
    fontSize: '12px',
    color: '#64748B',
    fontWeight: 800
  },
  resultBox: {
    marginTop: '12px',
    borderRadius: '8px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    padding: '16px'
  },
  buildSpecGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginTop: '14px'
  },
  specCard: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#F8FAFC',
    padding: '12px',
    boxSizing: 'border-box',
    minHeight: '138px'
  },
  promptBox: {
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    background: '#162033',
    padding: '14px',
    marginTop: '14px',
    boxSizing: 'border-box'
  },
  codeText: {
    margin: 0,
    maxHeight: '280px',
    overflow: 'auto',
    color: '#E5E7EB',
    fontSize: '12px',
    lineHeight: 1.6,
    fontFamily: 'Menlo, Consolas, monospace',
    whiteSpace: 'pre-wrap'
  },
  resultTitle: {
    fontSize: '17px',
    fontWeight: 900,
    marginBottom: '8px'
  },
  resultText: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: 1.65
  },
  promptGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px'
  },
  cartPanel: {
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    background: '#F8FAFC',
    padding: '12px',
    marginBottom: '14px'
  },
  cartRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  cartChip: {
    height: '26px',
    lineHeight: '26px',
    borderRadius: '8px',
    background: '#EFF6FF',
    color: '#1D4ED8',
    padding: '0 10px',
    fontSize: '12px',
    fontWeight: 800
  },
  promptRow: {
    minHeight: '86px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#F8FAFC',
    padding: '12px',
    display: 'grid',
    gridTemplateColumns: '1fr 32px',
    gap: '10px',
    alignItems: 'center',
    boxSizing: 'border-box'
  },
  promptTitle: {
    fontSize: '14px',
    fontWeight: 850,
    marginBottom: '6px'
  },
  promptDesc: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: 1.55
  },
  iconButton: {
    width: '32px',
    height: '32px',
    border: '0',
    borderRadius: '8px',
    background: '#2563EB',
    color: '#FFFFFF',
    fontSize: '18px',
    lineHeight: '32px',
    cursor: 'pointer',
    fontWeight: 900
  },
  iconButtonSelected: {
    background: '#059669'
  },
  visitMetricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px',
    marginBottom: '14px'
  },
  managerMetricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px',
    marginBottom: '14px'
  },
  visitMetricCard: {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '14px',
    minHeight: '104px',
    boxSizing: 'border-box'
  },
  visitMetricValue: {
    fontSize: '28px',
    lineHeight: 1,
    fontWeight: 900,
    marginBottom: '10px'
  },
  visitMetricLabel: {
    fontSize: '13px',
    color: '#334155',
    fontWeight: 800,
    marginBottom: '6px'
  },
  visitMetricHint: {
    fontSize: '12px',
    fontWeight: 800
  },
  visitLayout: {
    display: 'grid',
    gridTemplateColumns: '1.18fr 0.82fr',
    gap: '14px',
    alignItems: 'start'
  },
  managerLayout: {
    display: 'grid',
    gridTemplateColumns: '1.25fr 0.75fr',
    gap: '14px',
    alignItems: 'start'
  },
  visitPlanList: {
    display: 'grid',
    gap: '10px'
  },
  visitPlanCard: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#F8FAFC',
    padding: '12px',
    boxSizing: 'border-box'
  },
  visitPlanTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
    marginBottom: '10px'
  },
  visitCustomer: {
    fontSize: '15px',
    fontWeight: 900,
    marginBottom: '4px'
  },
  visitMeta: {
    fontSize: '12px',
    color: '#64748B'
  },
  visitStatus: {
    height: '24px',
    lineHeight: '24px',
    borderRadius: '7px',
    padding: '0 8px',
    fontSize: '12px',
    fontWeight: 900,
    whiteSpace: 'nowrap'
  },
  visitGoal: {
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: '10px'
  },
  visitActionRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap'
  },
  cardButtonRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '12px'
  },
  riskTag: {
    background: '#FEF2F2',
    color: '#B91C1C'
  },
  funnelList: {
    display: 'grid',
    gap: '12px'
  },
  funnelRow: {
    display: 'grid',
    gridTemplateColumns: '72px 1fr 38px',
    gap: '10px',
    alignItems: 'center'
  },
  funnelLabel: {
    fontSize: '12px',
    color: '#475569',
    fontWeight: 800
  },
  funnelTrack: {
    height: '10px',
    borderRadius: '5px',
    background: '#E2E8F0',
    overflow: 'hidden'
  },
  funnelFill: {
    display: 'block',
    height: '100%',
    borderRadius: '5px'
  },
  funnelValue: {
    fontSize: '12px',
    color: '#64748B',
    textAlign: 'right',
    fontWeight: 900
  },
  aiAdviceBox: {
    marginTop: '16px',
    border: '1px solid #DDE5F0',
    borderRadius: '8px',
    background: '#F8FAFC',
    padding: '12px'
  },
  teamHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 1.2fr) repeat(4, 64px) minmax(92px, 0.8fr)',
    gap: '8px',
    alignItems: 'center',
    padding: '0 10px 8px',
    color: '#64748B',
    fontSize: '12px',
    fontWeight: 900
  },
  teamList: {
    display: 'grid',
    gap: '8px'
  },
  teamRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 1.2fr) repeat(4, 64px) minmax(92px, 0.8fr)',
    gap: '8px',
    alignItems: 'center',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#F8FAFC',
    padding: '10px',
    boxSizing: 'border-box'
  },
  teamPerson: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0
  },
  personAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    background: '#2563EB',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 900,
    flexShrink: 0
  },
  personName: {
    fontSize: '13px',
    fontWeight: 900,
    marginBottom: '3px'
  },
  personRole: {
    fontSize: '11px',
    color: '#64748B',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  teamCell: {
    fontSize: '13px',
    fontWeight: 900,
    color: '#334155',
    textAlign: 'center'
  },
  warningText: {
    color: '#DC2626'
  },
  healthCell: {
    display: 'grid',
    gridTemplateColumns: '1fr 28px',
    gap: '6px',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: 900,
    color: '#334155'
  },
  healthTrack: {
    height: '7px',
    borderRadius: '4px',
    background: '#E2E8F0',
    overflow: 'hidden'
  },
  healthFill: {
    display: 'block',
    height: '100%',
    borderRadius: '4px',
    background: '#059669'
  },
  riskList: {
    display: 'grid',
    gap: '10px'
  },
  riskRow: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#F8FAFC',
    padding: '12px',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '10px',
    alignItems: 'start'
  },
  riskTitle: {
    fontSize: '14px',
    fontWeight: 900,
    marginBottom: '6px'
  },
  riskDesc: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: 1.55
  },
  riskLevel: {
    height: '24px',
    lineHeight: '24px',
    borderRadius: '7px',
    background: '#FEF2F2',
    color: '#B91C1C',
    padding: '0 8px',
    fontSize: '12px',
    fontWeight: 900,
    whiteSpace: 'nowrap'
  },
  riskActionColumn: {
    display: 'grid',
    gap: '8px',
    justifyItems: 'end'
  },
  materialGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px'
  },
  generatedBanner: {
    border: '1px solid #C7D2FE',
    borderRadius: '8px',
    background: '#F8FBFF',
    padding: '14px',
    marginBottom: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    alignItems: 'flex-start',
    boxSizing: 'border-box'
  },
  materialDetailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '14px'
  },
  materialSection: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#FFFFFF',
    padding: '12px',
    boxSizing: 'border-box',
    minHeight: '172px'
  },
  sectionCardTitle: {
    fontSize: '13px',
    fontWeight: 900,
    color: '#172033',
    marginBottom: '8px'
  },
  materialList: {
    display: 'grid',
    gap: '4px'
  },
  materialCard: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    background: '#F8FAFC',
    padding: '14px',
    boxSizing: 'border-box',
    minHeight: '170px',
    display: 'flex',
    flexDirection: 'column'
  },
  materialIcon: {
    width: '42px',
    height: '32px',
    borderRadius: '8px',
    background: '#162033',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900,
    marginBottom: '12px'
  },
  materialTitle: {
    fontSize: '15px',
    fontWeight: 850,
    marginBottom: '8px'
  },
  materialDesc: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: 1.55,
    flex: 1
  },
  materialStatus: {
    alignSelf: 'flex-start',
    marginTop: '12px',
    height: '24px',
    lineHeight: '24px',
    borderRadius: '7px',
    background: '#ECFDF5',
    color: '#047857',
    padding: '0 8px',
    fontSize: '12px',
    fontWeight: 800
  }
};
