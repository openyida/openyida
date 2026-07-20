'use strict';

const IR_VERSION = '1.0';

const PRODUCT_HOMEPAGE_TEMPLATE = 'product-homepage';
const WORKBENCH_HOME_TEMPLATE = 'workbench-home';
const DASHBOARD_OVERVIEW_TEMPLATE = 'dashboard-overview';
const OFFICIAL_HOMEPAGE_TEMPLATE = 'official-homepage';
const DATA_SCREEN_TEMPLATE = 'data-screen';
const DATA_MANAGEMENT_TEMPLATE = 'data-management';
const BUSINESS_LIST_TEMPLATE = 'business-list';
const DETAIL_PROFILE_TEMPLATE = 'detail-profile';
const SPLIT_PANE_DETAIL_TEMPLATE = 'split-pane-detail';
const PORTAL_SHELL_HOME_TEMPLATE = 'portal-shell-home';
const TODO_MVC_TEMPLATE = 'todo-mvc';
const PAGE_SCENES = ['workbench', 'dashboard', 'list', 'detail', 'landing', 'screen'];
const THEME_SCOPES = ['page', 'app'];
const RESEARCH_LEVELS = ['none', 'light', 'enhanced', 'deep'];

const CANVAS_CONTROL_RESET_CSS = `
          :where(.oy-page, .oy-workbench-home, .oy-dashboard-overview, .oy-business-list, .oy-data-management, .oy-detail-profile, .oy-split-pane-detail, .oy-portal-shell-home, .oy-official, .oy-screen, .oy-todo-os, .oy-native-portal, .oy-smoke-page) {
            --oy-control-border: #d7dee8;
            --oy-control-focus: color-mix(in srgb, var(--oy-brand, #6B7CAB) 52%, #ffffff);
            --oy-control-focus-ring: color-mix(in srgb, var(--oy-brand, #6B7CAB) 18%, transparent);
            --oy-control-hover: color-mix(in srgb, var(--oy-brand, #6B7CAB) 28%, #d7dee8);
            --oy-control-active-bg: color-mix(in srgb, var(--oy-brand, #6B7CAB) 10%, #ffffff);
          }
          :where(.oy-page, .oy-workbench-home, .oy-dashboard-overview, .oy-business-list, .oy-data-management, .oy-detail-profile, .oy-split-pane-detail, .oy-portal-shell-home, .oy-official, .oy-screen, .oy-todo-os, .oy-native-portal, .oy-smoke-page) :where(input, textarea, select, button, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number, .ant-segmented, .ant-btn) {
            font-family: inherit;
            letter-spacing: 0;
          }
          :where(.oy-page, .oy-workbench-home, .oy-dashboard-overview, .oy-business-list, .oy-data-management, .oy-detail-profile, .oy-split-pane-detail, .oy-portal-shell-home, .oy-official, .oy-screen, .oy-todo-os, .oy-native-portal, .oy-smoke-page) :where(input, textarea, select, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number) {
            border-color: var(--oy-control-border) !important;
            color: #172033;
            font-weight: 400;
            outline: none !important;
            box-shadow: none !important;
          }
          :where(.oy-page, .oy-workbench-home, .oy-dashboard-overview, .oy-business-list, .oy-data-management, .oy-detail-profile, .oy-split-pane-detail, .oy-portal-shell-home, .oy-official, .oy-screen, .oy-todo-os, .oy-native-portal, .oy-smoke-page) :where(input, textarea, select, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number):hover {
            border-color: var(--oy-control-hover) !important;
          }
          :where(.oy-page, .oy-workbench-home, .oy-dashboard-overview, .oy-business-list, .oy-data-management, .oy-detail-profile, .oy-split-pane-detail, .oy-portal-shell-home, .oy-official, .oy-screen, .oy-todo-os, .oy-native-portal, .oy-smoke-page) :where(input, textarea, select, .ant-input, .ant-input-affix-wrapper, .ant-select-selector, .ant-picker, .ant-input-number):focus,
          :where(.oy-page, .oy-workbench-home, .oy-dashboard-overview, .oy-business-list, .oy-data-management, .oy-detail-profile, .oy-split-pane-detail, .oy-portal-shell-home, .oy-official, .oy-screen, .oy-todo-os, .oy-native-portal, .oy-smoke-page) :where(.ant-input-affix-wrapper, .ant-select-focused .ant-select-selector, .ant-picker-focused, .ant-input-number-focused) {
            border-color: var(--oy-control-focus) !important;
            box-shadow: 0 0 0 3px var(--oy-control-focus-ring) !important;
            outline: none !important;
          }
          :where(.oy-page, .oy-workbench-home, .oy-dashboard-overview, .oy-business-list, .oy-data-management, .oy-detail-profile, .oy-split-pane-detail, .oy-portal-shell-home, .oy-official, .oy-screen, .oy-todo-os, .oy-native-portal, .oy-smoke-page) :where(.ant-select-selection-item, .ant-select-selection-placeholder, .ant-input, input, textarea) {
            color: #172033;
            font-weight: 400;
          }
          :where(.oy-page, .oy-workbench-home, .oy-dashboard-overview, .oy-business-list, .oy-data-management, .oy-detail-profile, .oy-split-pane-detail, .oy-portal-shell-home, .oy-official, .oy-screen, .oy-todo-os, .oy-native-portal, .oy-smoke-page) :where(.ant-select-dropdown, .ant-picker-dropdown) {
            border: 1px solid color-mix(in srgb, var(--oy-brand, #6B7CAB) 22%, #d7dee8);
            border-radius: 10px;
            box-shadow: 0 14px 36px rgba(17, 24, 39, .12);
            overflow: hidden;
          }
          :where(.oy-page, .oy-workbench-home, .oy-dashboard-overview, .oy-business-list, .oy-data-management, .oy-detail-profile, .oy-split-pane-detail, .oy-portal-shell-home, .oy-official, .oy-screen, .oy-todo-os, .oy-native-portal, .oy-smoke-page) :where(.ant-select-item-option-active, .ant-select-item-option-selected) {
            background: var(--oy-control-active-bg) !important;
            color: var(--oy-brand-deep, #435480) !important;
            font-weight: 600;
          }`.trim();

const DEFAULT_SCENE_BY_TEMPLATE = {
  [PRODUCT_HOMEPAGE_TEMPLATE]: 'workbench',
  [WORKBENCH_HOME_TEMPLATE]: 'workbench',
  [DASHBOARD_OVERVIEW_TEMPLATE]: 'dashboard',
  [OFFICIAL_HOMEPAGE_TEMPLATE]: 'landing',
  [DATA_SCREEN_TEMPLATE]: 'screen',
  [DATA_MANAGEMENT_TEMPLATE]: 'list',
  [BUSINESS_LIST_TEMPLATE]: 'list',
  [DETAIL_PROFILE_TEMPLATE]: 'detail',
  [SPLIT_PANE_DETAIL_TEMPLATE]: 'list',
  [PORTAL_SHELL_HOME_TEMPLATE]: 'workbench',
  [TODO_MVC_TEMPLATE]: 'list',
};

const DEFAULT_VISUAL_PROFILES = {
  workbench: {
    name: 'yida-app-theme',
    tone: 'yida-business',
    density: 'business-compact',
    neutral: 'yida-blue-gray',
    corner: 'layered',
    accent: 'brand-following',
    typography: 'compact-hierarchy',
    motif: ['app-shell', 'quick-entry', 'metric-strip', 'task-feed'],
  },
  dashboard: {
    name: 'yida-app-theme',
    tone: 'dense-confident',
    density: 'business-compact',
    neutral: 'yida-blue-gray',
    corner: 'layered',
    accent: 'status-aware',
    typography: 'tabular-numeric',
    motif: ['kpi-first', 'app-panel', 'compact-grid'],
  },
  list: {
    name: 'yida-app-theme',
    tone: 'quiet-efficient',
    density: 'business-compact',
    neutral: 'yida-blue-gray',
    corner: 'layered',
    accent: 'action-focused',
    typography: 'scannable',
    motif: ['filter-first', 'data-manage-density', 'row-divider'],
  },
  detail: {
    name: 'yida-app-theme',
    tone: 'precise-narrative',
    density: 'business-compact',
    neutral: 'yida-blue-gray',
    corner: 'layered',
    accent: 'object-led',
    typography: 'section-contrast',
    motif: ['object-summary', 'app-panel', 'timeline-rhythm'],
  },
  landing: {
    name: 'yida-app-theme',
    tone: 'editorial-trust',
    density: 'brand-comfortable',
    neutral: 'yida-blue-gray',
    corner: 'layered',
    accent: 'brand-following',
    typography: 'editorial-hierarchy',
    motif: ['immersive-hero', 'proof-strip', 'service-showcase', 'trust-panel'],
  },
  screen: {
    name: 'yida-app-theme',
    tone: 'immersive-command',
    density: 'screen-dense',
    neutral: 'dark-blue',
    corner: 'layered',
    accent: 'glow-brand',
    typography: 'tabular-numeric',
    motif: ['command-map', 'glow-kpi', 'radar-panel', 'rank-feed'],
  },
};

const DEFAULT_THEME_PROFILES = {
  'yida-pod-business': {
    name: 'yida-app-theme',
    followRuntimeTheme: true,
    themeColorSource: 'runtime-css-vars',
    themeColor: '#6B7CAB',
    themeColorDeep: '#435480',
    themeColorSoft: '#F3F5FB',
    themeColorTint: 'rgba(107, 124, 171, 0.2)',
    navTheme: 'light',
    mode: 'color_color',
    colorMode: 'gradient',
    mobileNavStyle: 'top',
  },
  'yida-app-theme': {
    name: 'yida-app-theme',
    followRuntimeTheme: true,
    themeColorSource: 'runtime-css-vars',
    themeColor: '#6B7CAB',
    themeColorDeep: '#435480',
    themeColorSoft: '#F3F5FB',
    themeColorTint: 'rgba(107, 124, 171, 0.2)',
    navTheme: 'light',
    mode: 'color_color',
    colorMode: 'gradient',
    mobileNavStyle: 'top',
  },
};

const VISUAL_NEUTRAL_ALIASES = {
  'pod-blue-gray': 'yida-blue-gray',
};

const VISUAL_CORNER_ALIASES = {
  'pod-layered': 'layered',
};

const VISUAL_MOTIF_ALIASES = {
  'pod-shell': 'app-shell',
  'pod-panel': 'app-panel',
};

const DEFAULT_PRODUCT_HOMEPAGE = {
  meta: {
    brandName: 'ProductName',
    brandInitials: 'PN',
    tagline: '业务入口与状态总览',
    heroText: '面向团队日常处理的宜搭工作台模板，集中呈现关键指标、快捷入口和待办进展。',
    primaryCta: '进入处理',
    secondaryCta: '查看明细',
  },
  sections: {
    featuresTitle: '快捷入口',
    roadmapTitle: '处理进展',
    ctaTitle: '当前关注',
    ctaText: '先把入口、指标和待办跑通，再接入真实表单、报表和自动化流程。',
  },
  features: [
    {
      title: '统一入口',
      text: '把常用页面、表单和流程集中到工作台，减少来回切换。',
    },
    {
      title: '状态跟进',
      text: '用指标和任务列表展示当前进展，便于快速判断优先级。',
    },
    {
      title: '流程闭环',
      text: '后续接入表单、报表、权限和自动化，形成完整业务闭环。',
    },
  ],
  metrics: [
    { value: '12', label: '今日待办' },
    { value: '86%', label: '处理完成率' },
    { value: '3', label: '重点异常' },
  ],
  roadmap: [
    { stage: '01', title: '工作台上线', text: '先完成入口、指标和待办区域。' },
    { stage: '02', title: '接入表单', text: '连接申请、反馈、线索和需求数据。' },
    { stage: '03', title: '自动化闭环', text: '把通知、审批和报表串成运营流程。' },
  ],
};

const DEFAULT_OFFICIAL_HOMEPAGE = {
  meta: {
    brandName: '专业服务官网',
    brandInitials: 'PS',
    tagline: '专业可信的品牌门户',
    heroText: '用清晰的价值主张、真实的服务场景和可信的专业背书，让访问者在第一屏就理解你是谁、能解决什么问题、为什么值得继续了解。',
    primaryCta: '预约咨询',
    secondaryCta: '查看服务',
  },
  sections: {
    featuresTitle: '核心服务',
    roadmapTitle: '服务流程',
    ctaTitle: '为什么选择我们',
    ctaText: '把专业能力、服务边界、行业经验和交付流程组织成可信的官网首页，而不是普通工作台卡片。',
  },
  features: [
    { title: '专业咨询', text: '围绕客户问题给出清晰判断、方案路径和风险提示。' },
    { title: '项目交付', text: '以标准流程推进调研、方案、执行和复盘，保证结果可追踪。' },
    { title: '长期顾问', text: '持续陪伴客户关键节点，提供稳定、及时的专业支持。' },
  ],
  metrics: [
    { value: '12+', label: '专业领域' },
    { value: '300+', label: '服务案例' },
    { value: '98%', label: '客户满意度' },
  ],
  roadmap: [
    { stage: '01', title: '初步沟通', text: '确认目标、边界、风险和关键资料。' },
    { stage: '02', title: '方案设计', text: '形成专业判断、行动路径和阶段成果。' },
    { stage: '03', title: '执行陪伴', text: '持续跟进进度，沉淀文档和复盘结论。' },
  ],
  assets: {
    heroImage: '',
    heroImageAlt: '品牌主视觉图片',
    productImages: [],
    materialStrategy: 'website-spec-first',
  },
};

const DEFAULT_DATA_SCREEN = {
  meta: {
    brandName: '实时监控预警系统',
    brandInitials: 'RT',
    tagline: '数据态势一屏统览',
    heroText: '以中心态势图承载核心对象，左右两侧组织指标、分布、排名和趋势，形成适合指挥调度的沉浸式数据大屏。',
    primaryCta: '刷新大屏',
    secondaryCta: '查看明细',
  },
  sections: {
    featuresTitle: '监控区域',
    roadmapTitle: '预警链路',
    ctaTitle: '实时态势',
    ctaText: '当前大屏使用演示数据，后续可接入原生报表或连接器数据源。',
  },
  features: [
    { title: '核心区域', text: '汇总重点区域、站点或业务单元的实时状态。' },
    { title: '异常排名', text: '按风险等级、影响范围和处理时效排序。' },
    { title: '趋势预警', text: '结合趋势曲线识别持续升高或突增异常。' },
  ],
  metrics: [
    { value: '1,756', label: '实时流量' },
    { value: '3,520', label: '累计监测' },
    { value: '26', label: '预警事件' },
    { value: '94%', label: '处置完成率' },
  ],
  roadmap: [
    { stage: '监测', title: '自动采集', text: '持续接入站点、流程和业务指标。' },
    { stage: '识别', title: '异常研判', text: '按阈值、趋势和排名识别风险。' },
    { stage: '处置', title: '联动闭环', text: '同步任务、通知和处理记录。' },
  ],
  assets: {
    heroImage: '',
    heroImageAlt: '数据大屏视觉底图',
    productImages: [],
    materialStrategy: 'chart-map-first',
  },
};

const DEFAULT_TODO_MVC = {
  meta: {
    title: 'Todos',
    subtitle: '一个用于验证宜搭自定义页面事件、状态、循环渲染和本地持久化的 OpenYida 模板。',
    placeholder: 'What needs to be done?',
    storageKey: 'openyida.todoMVC',
    allLabel: 'All',
    activeLabel: 'Active',
    completedLabel: 'Completed',
    clearCompletedLabel: 'Clear completed',
  },
  todos: [
    { id: 1, content: '用 OpenYida 生成宜搭自定义页面', done: false },
    { id: 2, content: '运行 check-page 和 compile 做发布前检查', done: true },
    { id: 3, content: '接入真实表单数据后发布到宜搭', done: false },
  ],
};

const DEFAULT_WORKBENCH_HOME = {
  meta: {
    brandName: '业务工作台',
    brandInitials: 'WB',
    tagline: '状态、入口与待办集中处理',
    heroText: '把常用入口、关键状态和待办任务放在第一屏，让团队进入应用后可以直接开始处理事务。',
    primaryCta: '处理待办',
    secondaryCta: '查看全部入口',
  },
  sections: {
    featuresTitle: '常用入口',
    roadmapTitle: '我的待办',
    ctaTitle: '今日关注',
    ctaText: '优先处理逾期、待审批和需要协同的事项，减少在多个页面之间来回切换。',
  },
  features: [
    { title: '发起申请', text: '快速进入最常用的业务表单和流程。' },
    { title: '查看进度', text: '集中查看我提交、我负责和我关注的事项。' },
    { title: '数据入口', text: '跳转到经营看板、明细列表和配置页面。' },
  ],
  metrics: [
    { value: '18', label: '今日待办' },
    { value: '4', label: '逾期预警' },
    { value: '92%', label: '本周完成率' },
  ],
  roadmap: [
    { stage: '待办', title: '审批与确认', text: '优先处理即将超时的流程任务。' },
    { stage: '协同', title: '需要补充资料', text: '跟进需要他人配合的事项。' },
    { stage: '复盘', title: '本周进展同步', text: '查看已完成事项和异常原因。' },
  ],
};

const DEFAULT_DASHBOARD_OVERVIEW = {
  meta: {
    brandName: '经营数据看板',
    brandInitials: 'DB',
    tagline: '核心指标、趋势与异常一屏判断',
    heroText: '围绕业务健康度组织 KPI、趋势、排行和洞察，帮助管理者快速判断当前状态与下一步动作。',
    primaryCta: '刷新数据',
    secondaryCta: '查看明细',
  },
  sections: {
    featuresTitle: '关键分析',
    roadmapTitle: '行动建议',
    ctaTitle: '当前洞察',
    ctaText: '核心指标保持稳定，但异常项需要优先跟进；建议先看排行，再看趋势和明细。',
  },
  features: [
    { title: '趋势分析', text: '用主图表观察销售、库存或效率指标的变化。' },
    { title: '排行明细', text: '识别贡献最高和风险最高的对象。' },
    { title: '异常洞察', text: '把风险、原因和建议放在同一处，便于闭环。' },
  ],
  metrics: [
    { value: '126.8万', label: '本月 GMV' },
    { value: '+18%', label: '环比增长' },
    { value: '92%', label: '目标达成' },
    { value: '7', label: '重点异常' },
  ],
  roadmap: [
    { stage: '01', title: '先看核心 KPI', text: '确认业务是否偏离目标。' },
    { stage: '02', title: '定位异常对象', text: '按区域、产品或人员识别风险。' },
    { stage: '03', title: '形成跟进行动', text: '沉淀补货、巡检、培训或运营建议。' },
  ],
};

const DEFAULT_BUSINESS_LIST = {
  meta: {
    brandName: '订单管理',
    brandInitials: 'OL',
    tagline: '筛选、处理与下钻详情',
    heroText: '以对象列表为核心，保留筛选上下文，并通过详情抽屉完成查看和处理。',
    primaryCta: '新建记录',
    secondaryCta: '导出数据',
  },
  sections: {
    featuresTitle: '列表字段',
    roadmapTitle: '处理路径',
    ctaTitle: '当前选中',
    ctaText: '选中一条记录后，在右侧详情区查看关键字段、时间线和可执行操作。',
  },
  features: [
    { title: 'ORD-20260708-001', text: '华东渠道 / 待处理 / 12,860 元' },
    { title: 'ORD-20260708-002', text: '校园门店 / 已完成 / 8,420 元' },
    { title: 'ORD-20260708-003', text: '社区团购 / 需跟进 / 5,390 元' },
  ],
  metrics: [
    { value: '128', label: '全部记录' },
    { value: '24', label: '待处理' },
    { value: '6', label: '异常' },
  ],
  roadmap: [
    { stage: '筛选', title: '按状态和时间定位', text: '先缩小范围，再处理记录。' },
    { stage: '下钻', title: '打开详情抽屉', text: '保留列表上下文，不跳丢筛选条件。' },
    { stage: '处理', title: '执行主操作', text: '完成确认、导出、分派或关闭。' },
  ],
};

const DEFAULT_DATA_MANAGEMENT = {
  meta: {
    brandName: '多维数据管理',
    brandInitials: 'DM',
    tagline: '任务、字段、分组和状态的一屏式管理',
    heroText: '参考多维表的高密度表格体验，把视图切换、字段管理、筛选、分组、标签、状态和批量操作组织到同一个数据管理页面。',
    primaryCta: '添加记录',
    secondaryCta: '分享视图',
  },
  sections: {
    featuresTitle: '全部数据',
    roadmapTitle: '本周协作节奏',
    ctaTitle: '字段与视图配置',
    ctaText: '用于任务台账、项目排期、运营需求池、客户跟进和研发治理等数据管理场景。',
  },
  features: [
    { title: 'openyida skill治理', text: '完成技能索引治理、引用检查和发布前自测。' },
    { title: '公式校验问题修复&测试&发布', text: '补齐异常案例，完成回归验证并同步发布。' },
    { title: 'npm外置链路方案-服务端oss', text: '梳理静态资源链路、上传策略和回退逻辑。' },
  ],
  metrics: [
    { value: '148', label: '总记录', hint: '按单选字段分 6 组' },
    { value: '73%', label: '本周完成', hint: '+12 条已归档' },
    { value: '18', label: '字段数', hint: '4 个公式字段' },
    { value: '26', label: '协作成员', hint: '7 人今日更新' },
  ],
  roadmap: [
    { stage: '09:30', title: '按负责人拉齐任务', text: '同步研发、测试、发布和设计任务状态。' },
    { stage: '11:20', title: '筛出高优先级', text: '只看逾期、阻塞和本周必须交付的记录。' },
    { stage: '15:00', title: '批量补充字段', text: '给需求池补齐标签、重要程度和备注。' },
  ],
};

const DEFAULT_DETAIL_PROFILE = {
  meta: {
    brandName: '客户档案',
    brandInitials: 'DP',
    tagline: '单对象全貌、时间线与关联信息',
    heroText: '围绕一个对象组织核心身份、关键摘要、具体章节和时间线，避免把数据库字段机械平铺成字段墙。',
    primaryCta: '更新状态',
    secondaryCta: '返回列表',
  },
  sections: {
    featuresTitle: '核心章节',
    roadmapTitle: '最近时间线',
    ctaTitle: '对象摘要',
    ctaText: '先确认身份和状态，再阅读关键章节、关联对象和历史动作。',
  },
  features: [
    { title: '对象身份', text: '名称、状态、负责人和核心标签。' },
    { title: '关键摘要', text: '金额、进度、风险和最近一次动作。' },
    { title: '关联信息', text: '订单、附件、联系人和处理记录。' },
  ],
  metrics: [
    { value: 'A', label: '客户等级' },
    { value: '42.6万', label: '累计金额' },
    { value: '3', label: '待跟进事项' },
  ],
  roadmap: [
    { stage: '07-08', title: '完成回访', text: '确认本周补货和活动物料需求。' },
    { stage: '07-06', title: '提交订单', text: '新增 3 个门店的产品组合。' },
    { stage: '07-01', title: '风险提示', text: '单店复购率低于区域均值，需要跟进。' },
  ],
};

const DEFAULT_SPLIT_PANE_DETAIL = {
  meta: {
    brandName: '处理工作台',
    brandInitials: 'SP',
    tagline: '左侧筛选列表，右侧上下文详情',
    heroText: '面向工单、订单、线索或任务处理场景，左侧保留筛选和队列，右侧呈现对象详情、风险摘要和可执行动作。',
    primaryCta: '开始处理',
    secondaryCta: '批量分派',
  },
  sections: {
    featuresTitle: '处理队列',
    roadmapTitle: '处理节奏',
    ctaTitle: '当前选中',
    ctaText: '保留列表上下文，不跳转丢失筛选；详情区承载摘要、时间线和下一步动作。',
  },
  features: [
    { title: '待处理订单', text: '华东渠道 / 高优先级 / 12,860 元' },
    { title: '异常工单', text: '库存不足 / 需要补货 / 2 小时内响应' },
    { title: '重点线索', text: '校园门店 / 新品咨询 / 待跟进' },
  ],
  metrics: [
    { value: '36', label: '队列待办' },
    { value: '8', label: '高优先级' },
    { value: '92%', label: '今日闭环率' },
  ],
  roadmap: [
    { stage: '01', title: '筛选队列', text: '按状态、负责人和时间缩小处理范围。' },
    { stage: '02', title: '阅读详情', text: '在右侧保留上下文查看摘要、风险和历史。' },
    { stage: '03', title: '执行动作', text: '完成分派、确认、导出或关闭。' },
  ],
};

const DEFAULT_PORTAL_SHELL_HOME = {
  meta: {
    brandName: '应用门户',
    brandInitials: 'PH',
    tagline: '统一入口、角色导航与应用状态',
    heroText: '当自定义页面隐藏平台导航时，用页面内门户壳承接角色入口、常用应用、待办摘要和关键公告，让用户第一屏就知道去哪处理。',
    primaryCta: '进入常用入口',
    secondaryCta: '查看全部应用',
  },
  sections: {
    featuresTitle: '门户入口',
    roadmapTitle: '最近动态',
    ctaTitle: '今日重点',
    ctaText: '根据角色组织入口和状态，避免把门户做成单调卡片墙。',
  },
  features: [
    { title: '业务办理', text: '申请、审批、工单和常用表单集中入口。' },
    { title: '经营分析', text: '看板、大屏、排行和专题洞察快速进入。' },
    { title: '协同服务', text: '公告、知识库、制度和支持渠道聚合。' },
  ],
  metrics: [
    { value: '12', label: '常用入口' },
    { value: '18', label: '今日待办' },
    { value: '4', label: '重点提醒' },
  ],
  roadmap: [
    { stage: '待办', title: '审批与确认', text: '优先处理即将超时的任务。' },
    { stage: '公告', title: '运营通知', text: '同步本周重点活动和规则变化。' },
    { stage: '服务', title: '常见问题', text: '沉淀用户最常访问的帮助入口。' },
  ],
};

const DEFAULTS_BY_TEMPLATE = {
  [PRODUCT_HOMEPAGE_TEMPLATE]: DEFAULT_PRODUCT_HOMEPAGE,
  [WORKBENCH_HOME_TEMPLATE]: DEFAULT_WORKBENCH_HOME,
  [DASHBOARD_OVERVIEW_TEMPLATE]: DEFAULT_DASHBOARD_OVERVIEW,
  [OFFICIAL_HOMEPAGE_TEMPLATE]: DEFAULT_OFFICIAL_HOMEPAGE,
  [DATA_SCREEN_TEMPLATE]: DEFAULT_DATA_SCREEN,
  [DATA_MANAGEMENT_TEMPLATE]: DEFAULT_DATA_MANAGEMENT,
  [BUSINESS_LIST_TEMPLATE]: DEFAULT_BUSINESS_LIST,
  [DETAIL_PROFILE_TEMPLATE]: DEFAULT_DETAIL_PROFILE,
  [SPLIT_PANE_DETAIL_TEMPLATE]: DEFAULT_SPLIT_PANE_DETAIL,
  [PORTAL_SHELL_HOME_TEMPLATE]: DEFAULT_PORTAL_SHELL_HOME,
};

const FIELD_ALIASES = {
  brandName: 'brandName',
  brandInitials: 'brandInitials',
  tagline: 'tagline',
  heroText: 'heroText',
  primaryCta: 'primaryCta',
  secondaryCta: 'secondaryCta',
  featuresTitle: 'featuresTitle',
  roadmapTitle: 'roadmapTitle',
  ctaTitle: 'ctaTitle',
  ctaText: 'ctaText',
  features: 'features',
  metrics: 'metrics',
  roadmap: 'roadmap',
  'brand-name': 'brandName',
  'brand-initials': 'brandInitials',
  'hero-text': 'heroText',
  'primary-cta': 'primaryCta',
  'secondary-cta': 'secondaryCta',
  'features-title': 'featuresTitle',
  'roadmap-title': 'roadmapTitle',
  'cta-title': 'ctaTitle',
  'cta-text': 'ctaText',
  BRAND_NAME: 'brandName',
  BRAND_INITIALS: 'brandInitials',
  TAGLINE: 'tagline',
  HERO_TEXT: 'heroText',
  PRIMARY_CTA: 'primaryCta',
  SECONDARY_CTA: 'secondaryCta',
  FEATURES_TITLE: 'featuresTitle',
  ROADMAP_TITLE: 'roadmapTitle',
  CTA_TITLE: 'ctaTitle',
  CTA_TEXT: 'ctaText',
  title: 'title',
  subtitle: 'subtitle',
  placeholder: 'placeholder',
  storageKey: 'storageKey',
  allLabel: 'allLabel',
  activeLabel: 'activeLabel',
  completedLabel: 'completedLabel',
  clearCompletedLabel: 'clearCompletedLabel',
  todos: 'todos',
  items: 'todos',
  'storage-key': 'storageKey',
  'all-label': 'allLabel',
  'active-label': 'activeLabel',
  'completed-label': 'completedLabel',
  'clear-completed-label': 'clearCompletedLabel',
  TODO_TITLE: 'title',
  TODO_SUBTITLE: 'subtitle',
  TODO_PLACEHOLDER: 'placeholder',
  TODO_STORAGE_KEY: 'storageKey',
  TODO_ALL_LABEL: 'allLabel',
  TODO_ACTIVE_LABEL: 'activeLabel',
  TODO_COMPLETED_LABEL: 'completedLabel',
  TODO_CLEAR_COMPLETED_LABEL: 'clearCompletedLabel',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function valueOrDefault(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
}

function firstDefined() {
  for (let i = 0; i < arguments.length; i += 1) {
    const value = arguments[i];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function applyVariableOverrides(spec, variables) {
  if (!isPlainObject(variables)) {
    return;
  }

  Object.entries(variables).forEach(([key, value]) => {
    const fieldName = FIELD_ALIASES[key] || key;
    spec[fieldName] = value;
  });
}

function getBlock(spec, type) {
  if (!Array.isArray(spec.blocks)) {
    return null;
  }
  return spec.blocks.find((block) => block && block.type === type) || null;
}

function toList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeScene(value, fallback) {
  const raw = value === undefined || value === null || value === '' ? fallback : String(value);
  return PAGE_SCENES.includes(raw) ? raw : fallback;
}

function normalizeMotif(value, fallback) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const normalized = items
    .map((item) => String(item).trim())
    .map((item) => VISUAL_MOTIF_ALIASES[item] || item)
    .filter(Boolean);
  return normalized.length ? normalized : clone(fallback);
}

function normalizeVisualProfile(rawProfile, scene, density) {
  const defaults = DEFAULT_VISUAL_PROFILES[scene] || DEFAULT_VISUAL_PROFILES.workbench;
  const profile = typeof rawProfile === 'string'
    ? { name: rawProfile }
    : isPlainObject(rawProfile)
      ? rawProfile
      : {};
  const neutral = valueOrDefault(profile.neutral, defaults.neutral);
  const corner = valueOrDefault(profile.corner, defaults.corner);

  return {
    name: valueOrDefault(profile.name || profile.profile, defaults.name),
    scene,
    tone: valueOrDefault(profile.tone, defaults.tone),
    density: valueOrDefault(profile.density || density, defaults.density),
    neutral: VISUAL_NEUTRAL_ALIASES[neutral] || neutral,
    corner: VISUAL_CORNER_ALIASES[corner] || corner,
    accent: valueOrDefault(profile.accent, defaults.accent),
    typography: valueOrDefault(profile.typography, defaults.typography),
    archetype: valueOrDefault(profile.archetype, ''),
    motif: normalizeMotif(profile.motif || profile.visualDna || profile.visualDNA, defaults.motif),
  };
}

function getVisualProfileInput(spec) {
  return spec.visualProfile || spec.visual_profile || spec.visual || null;
}

function getThemeProfileInput(spec) {
  return spec.themeProfile || spec.theme_profile || spec.theme || null;
}

function normalizeThemeProfile(rawProfile) {
  const defaults = DEFAULT_THEME_PROFILES['yida-app-theme'];
  const profile = typeof rawProfile === 'string'
    ? { name: rawProfile }
    : isPlainObject(rawProfile)
      ? rawProfile
      : {};

  const name = valueOrDefault(profile.name || profile.profile, defaults.name);
  const preset = DEFAULT_THEME_PROFILES[name] || defaults;
  const normalizedName = DEFAULT_THEME_PROFILES[name] ? preset.name : name;
  const hasExplicit = (...keys) => keys.some((key) => (
    Object.prototype.hasOwnProperty.call(profile, key)
    && profile[key] !== undefined
    && profile[key] !== null
    && profile[key] !== ''
  ));
  const hasExplicitColor = hasExplicit('themeColor', 'color', 'brandColor');
  const hasExplicitColorFamily = hasExplicitColor
    || hasExplicit('themeColorDeep', 'brandDeep')
    || hasExplicit('themeColorSoft', 'brandSoft')
    || hasExplicit('themeColorTint', 'brandTint');
  const followRuntimeTheme = profile.followRuntimeTheme === undefined
    ? Boolean(preset.followRuntimeTheme && !hasExplicitColorFamily)
    : profile.followRuntimeTheme !== false;

  return {
    name: normalizedName,
    followRuntimeTheme,
    themeColorSource: followRuntimeTheme ? 'runtime-css-vars' : 'profile',
    themeColor: valueOrDefault(profile.themeColor || profile.color || profile.brandColor, preset.themeColor),
    themeColorDeep: valueOrDefault(profile.themeColorDeep || profile.brandDeep, preset.themeColorDeep),
    themeColorSoft: valueOrDefault(profile.themeColorSoft || profile.brandSoft, preset.themeColorSoft),
    themeColorTint: valueOrDefault(profile.themeColorTint || profile.brandTint, preset.themeColorTint),
    navTheme: valueOrDefault(profile.navTheme || profile.theme, preset.navTheme),
    mode: valueOrDefault(profile.mode, preset.mode),
    colorMode: valueOrDefault(profile.colorMode, preset.colorMode),
    mobileNavStyle: valueOrDefault(profile.mobileNavStyle, preset.mobileNavStyle),
  };
}

function getThemeScopeInput(spec) {
  return spec.themeScope || spec.theme_scope || spec.scope || null;
}

function collectThemeIntentText(spec) {
  const fields = [
    spec.themeIntent,
    spec.theme_intent,
    spec.styleIntent,
    spec.style_intent,
    spec.intent,
    spec.prompt,
    spec.requirement,
    spec.requirements,
    spec.description,
    spec.desc,
    spec.goal,
    spec.title,
  ];

  return fields
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value !== undefined && value !== null)
    .map((value) => {
      if (isPlainObject(value)) {
        return JSON.stringify(value);
      }
      return String(value);
    })
    .join(' ');
}

function inferThemeScopeFromSpec(spec) {
  const text = collectThemeIntentText(spec);
  if (!text) {
    return null;
  }

  const pageOnlyPatterns = [
    /只(改|影响|美化|作用于).{0,8}(当前)?(页面|自定义页)/,
    /(不要|不能|别).{0,8}(影响|改|覆盖).{0,8}(导航|菜单|壳层|应用)/,
    /(不需要|无需).{0,8}(导航|菜单|壳层).{0,8}(变色|换肤|统一)/,
    /页面级(主题|换肤|作用域)/,
  ];
  if (pageOnlyPatterns.some((pattern) => pattern.test(text))) {
    return 'page';
  }

  const appScopePatterns = [
    /(整个|全局|全站|全应用|应用级).{0,10}(主题|风格|换肤|变色|统一)/,
    /(应用|系统).{0,8}(整体|全局).{0,8}(主题|风格|换肤|统一)/,
    /(左侧|侧边|顶部).{0,4}(导航|菜单|壳层).{0,10}(一起|也|同步|统一).{0,8}(变色|换肤|改色|统一)?/,
    /(导航|菜单|壳层).{0,10}(一起|也|同步|统一).{0,8}(变色|换肤|改色|跟随)/,
    /内容区.{0,8}(和|与).{0,8}(导航|菜单|壳层).{0,8}(统一|一致|同色)/,
    /shell.{0,8}(theme|换肤|统一|bridge)/i,
    /updateShellConfig/,
  ];
  return appScopePatterns.some((pattern) => pattern.test(text)) ? 'app' : null;
}

function normalizeThemeScope(value) {
  const raw = String(value || 'page').trim().toLowerCase();
  if (raw === 'app' || raw === 'application' || raw === 'shell' || raw === 'global') {
    return 'app';
  }
  return THEME_SCOPES.includes(raw) ? raw : 'page';
}

function normalizeResearchLevel(value, scene) {
  const fallback = scene === 'landing' ? 'light' : 'none';
  const raw = String(value || fallback).trim().toLowerCase();
  return RESEARCH_LEVELS.includes(raw) ? raw : fallback;
}

function getResearchLevelInput(spec) {
  return spec.researchLevel || spec.research_level || spec.research || null;
}

function normalizeArchetype(value, scene) {
  const fallbackByScene = {
    workbench: 'operation',
    dashboard: 'overview',
    list: 'table-management',
    detail: 'profile',
    landing: 'brand-home',
    screen: 'monitor',
  };
  return valueOrDefault(value, fallbackByScene[scene] || 'standard');
}

function getArchetypeInput(spec) {
  const visual = getVisualProfileInput(spec);
  return spec.archetype
    || spec.pageArchetype
    || spec.dashboardArchetype
    || (isPlainObject(visual) ? visual.archetype : null)
    || null;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === undefined || item === null || item === '') {
          return '';
        }
        return typeof item === 'object' ? JSON.stringify(item) : String(item);
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeBlueprintPages(value) {
  return toList(value)
    .map((item) => {
      if (isPlainObject(item)) {
        return {
          name: valueOrDefault(item.name || item.title, ''),
          scene: valueOrDefault(item.scene || item.type, ''),
          template: valueOrDefault(item.template, ''),
          audience: normalizeStringList(item.audience || item.roles),
        };
      }
      return {
        name: valueOrDefault(item, ''),
        scene: '',
        template: '',
        audience: [],
      };
    })
    .filter((item) => item.name || item.scene || item.template);
}

function normalizeOptionalBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', 'render', 'visible', 'show'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off', 'hide', 'hidden'].includes(normalized)) {
    return false;
  }
  return null;
}

function inferPageLevelNavigation(templateName, source) {
  const explicit = normalizeOptionalBoolean(
    firstDefined(
      source.hasPageNavigation,
      source.has_page_navigation,
      source.pageNavigation,
      source.page_navigation,
      source.selfNavigation,
      source.self_navigation,
      source.customNav,
      source.custom_nav
    )
  );
  if (explicit !== null) {
    return explicit;
  }
  return ['portal-shell-home', 'workbench-home'].includes(templateName);
}

function inferHideAppNav(source, scene, templateName, hasPageNavigation) {
  const explicitHide = normalizeOptionalBoolean(
    firstDefined(
      source.hideAppNav,
      source.hide_app_nav,
      source.hideYidaNav,
      source.hide_yida_nav
    )
  );
  if (explicitHide !== null) {
    return explicitHide;
  }

  const explicitRender = normalizeOptionalBoolean(
    firstDefined(
      source.renderNav,
      source.render_nav,
      source.isRenderNav,
      source.is_render_nav
    )
  );
  if (explicitRender !== null) {
    return !explicitRender;
  }

  if (scene === 'screen' || templateName === 'data-screen') {
    return true;
  }
  return hasPageNavigation;
}

function normalizeAppBlueprint(spec, scene, templateName, meta) {
  const source = isPlainObject(spec.appBlueprint)
    ? spec.appBlueprint
    : isPlainObject(spec.app_blueprint)
      ? spec.app_blueprint
      : (spec.pages || spec.roles || spec.navigation || spec.navGroups || spec.appName || spec.app_name || spec.entry || spec.shell)
        ? spec
        : {};
  const pages = normalizeBlueprintPages(source.pages || spec.pages || []);
  const shell = valueOrDefault(source.shell || source.shellType || spec.shell || spec.shellType, scene === 'screen' ? 'no_shell' : 'single_page');
  const navigation = normalizeStringList(source.navigation || source.navGroups || spec.navigation || spec.navGroups);
  const hasPageNavigation = inferPageLevelNavigation(templateName, source);
  const hideAppNav = inferHideAppNav(source, scene, templateName, hasPageNavigation);
  const renderNav = !hideAppNav;
  const defaultPage = {
    name: meta && (meta.brandName || meta.title) ? (meta.brandName || meta.title) : templateName,
    scene,
    template: templateName,
    audience: [],
  };

  return {
    appName: valueOrDefault(source.appName || source.name || spec.appName || spec.app_name, ''),
    entry: valueOrDefault(source.entry || source.entryPage || source.entry_page, defaultPage.name),
    shell,
    roles: normalizeStringList(source.roles || spec.roles),
    navigation,
    pages: pages.length ? pages : [defaultPage],
    hasPageNavigation,
    hideAppNav,
    renderNav,
    navConfig: {
      isRenderNav: renderNav,
      reason: hideAppNav
        ? 'page-level navigation or immersive page should own the viewport'
        : 'use Yida application navigation',
    },
  };
}

function normalizeInteractionProfile(spec, scene, meta) {
  const source = isPlainObject(spec.interactionProfile)
    ? spec.interactionProfile
    : isPlainObject(spec.interaction_profile)
      ? spec.interaction_profile
      : isPlainObject(spec.interactions)
        ? spec.interactions
        : (spec.primaryAction || spec.primary_action || spec.detailMode || spec.detail_mode || spec.bulkActions || spec.bulk_actions || spec.states)
          ? spec
          : {};
  const detailModeByScene = {
    workbench: 'page',
    dashboard: 'page',
    list: 'drawer',
    detail: 'page',
    landing: 'none',
    screen: 'none',
  };
  const states = normalizeStringList(source.states || source.uiStates);
  return {
    primaryAction: valueOrDefault(source.primaryAction || source.primary_action, meta && meta.primaryCta ? meta.primaryCta : ''),
    detailMode: valueOrDefault(source.detailMode || source.detail_mode, detailModeByScene[scene] || 'none'),
    bulkActions: normalizeStringList(source.bulkActions || source.bulk_actions),
    states: states.length ? states : ['empty', 'loading', 'error'],
  };
}

function normalizeInsights(value, fallbackText) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const normalized = items
    .map((item) => {
      if (isPlainObject(item)) {
        return {
          conclusion: valueOrDefault(item.conclusion || item.title || item.summary, ''),
          evidence: valueOrDefault(item.evidence || item.data || item.metric, ''),
          suggestion: valueOrDefault(item.suggestion || item.action || item.nextStep || item.next_step, ''),
        };
      }
      return {
        conclusion: valueOrDefault(item, ''),
        evidence: '',
        suggestion: '',
      };
    })
    .filter((item) => item.conclusion || item.evidence || item.suggestion);

  if (normalized.length) {
    return normalized;
  }
  return fallbackText ? [{ conclusion: fallbackText, evidence: '', suggestion: '' }] : [];
}

function normalizeFieldMap(value) {
  if (!isPlainObject(value)) {
    return {};
  }
  return Object.keys(value).reduce((acc, key) => {
    const raw = value[key];
    if (raw === undefined || raw === null || raw === '') {
      return acc;
    }
    acc[key] = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
    return acc;
  }, {});
}

function normalizeDataBinding(spec, scene) {
  const source = isPlainObject(spec.dataBinding)
    ? spec.dataBinding
    : isPlainObject(spec.data_binding)
      ? spec.data_binding
      : (spec.dataMode || spec.data_mode || spec.dataUrl || spec.data_url || spec.formUuid || spec.form_uuid || spec.connectorUrl || spec.connector_url)
        ? spec
        : {};
  const rawMode = String(source.mode || source.dataMode || source.data_mode || '').trim().toLowerCase();
  const hasForm = Boolean(source.appType || source.app_type || spec.appType || spec.app_type) && Boolean(source.formUuid || source.form_uuid || spec.formUuid || spec.form_uuid);
  const hasEndpoint = Boolean(source.url || source.endpoint || source.connectorUrl || source.connector_url || source.dataUrl || source.data_url);
  const mode = rawMode || (hasForm ? 'form' : hasEndpoint ? 'connector' : 'seed');
  const normalizedMode = ['seed', 'form', 'connector', 'url', 'report', 'none'].includes(mode) ? mode : 'connector';
  const enabled = source.enabled === false || source.enabled === 'false' || normalizedMode === 'none'
    ? false
    : normalizedMode !== 'seed' && (hasForm || hasEndpoint || normalizedMode === 'report');

  return {
    mode: normalizedMode,
    enabled,
    sourceName: valueOrDefault(source.sourceName || source.name || source.dataSourceName || source.data_source_name, ''),
    appType: valueOrDefault(source.appType || source.app_type || spec.appType || spec.app_type, ''),
    formUuid: valueOrDefault(source.formUuid || source.form_uuid || spec.formUuid || spec.form_uuid, ''),
    endpoint: valueOrDefault(source.endpoint || source.url || source.connectorUrl || source.connector_url || source.dataUrl || source.data_url, ''),
    method: valueOrDefault(source.method, normalizedMode === 'form' ? 'POST' : 'GET').toUpperCase(),
    pageSize: Number(source.pageSize || source.page_size || (scene === 'screen' ? 50 : 20)) || (scene === 'screen' ? 50 : 20),
    pageNumber: Number(source.pageNumber || source.page_number || 1) || 1,
    refresh: valueOrDefault(source.refresh || source.refreshMode || source.refresh_mode, scene === 'screen' ? 'poll' : 'manual'),
    pollIntervalMs: Number(source.pollIntervalMs || source.poll_interval_ms || 5000) || 5000,
    fields: normalizeFieldMap(source.fields || source.fieldMap || source.field_map),
    query: isPlainObject(source.query) ? clone(source.query) : {},
    body: isPlainObject(source.body) ? clone(source.body) : {},
    totalField: valueOrDefault(source.totalField || source.total_field, ''),
    rowsField: valueOrDefault(source.rowsField || source.rows_field, ''),
    emptyAsError: source.emptyAsError === false || source.empty_as_error === false ? false : true,
    seedStrategy: valueOrDefault(source.seedStrategy || source.seed_strategy, enabled ? 'fallback-until-loaded' : 'demo-only'),
  };
}

function normalizeFeatureItems(items, fallback) {
  const normalized = toList(items)
    .filter(isPlainObject)
    .map((item, index) => ({
      title: valueOrDefault(item.title || item.name, `能力 ${index + 1}`),
      text: valueOrDefault(item.text || item.description || item.summary, ''),
    }))
    .filter((item) => item.title || item.text);

  return normalized.length ? normalized : clone(fallback);
}

function normalizeMetricItems(items, fallback) {
  const normalized = toList(items)
    .filter(isPlainObject)
    .map((item, index) => ({
      value: valueOrDefault(item.value || item.metric || item.count, '-'),
      label: valueOrDefault(item.label || item.title || item.name, `指标 ${index + 1}`),
    }))
    .filter((item) => item.value || item.label);

  return normalized.length ? normalized : clone(fallback);
}

function padStage(index) {
  return String(index + 1).padStart(2, '0');
}

function normalizeRoadmapItems(items, fallback) {
  const normalized = toList(items)
    .filter(isPlainObject)
    .map((item, index) => ({
      stage: valueOrDefault(item.stage || item.step || item.phase, padStage(index)),
      title: valueOrDefault(item.title || item.name, `阶段 ${index + 1}`),
      text: valueOrDefault(item.text || item.description || item.summary, ''),
    }))
    .filter((item) => item.stage || item.title || item.text);

  return normalized.length ? normalized : clone(fallback);
}

function normalizeMediaAssets(spec, defaults) {
  const source = isPlainObject(spec.assets) ? spec.assets : {};
  const productImages = toList(source.productImages || spec.productImages || spec.images)
    .filter((item) => item !== undefined && item !== null && item !== '')
    .map((item) => {
      if (isPlainObject(item)) {
        return {
          url: valueOrDefault(item.url || item.src || item.image, ''),
          alt: valueOrDefault(item.alt || item.title || item.name, ''),
        };
      }
      return { url: String(item), alt: '' };
    })
    .filter((item) => item.url);

  const fallback = defaults.assets || {};
  return {
    heroImage: valueOrDefault(source.heroImage || source.hero || spec.heroImage || spec.hero_image, fallback.heroImage || ''),
    heroImageAlt: valueOrDefault(source.heroImageAlt || source.heroAlt || spec.heroImageAlt || spec.hero_image_alt, fallback.heroImageAlt || ''),
    productImages: productImages.length ? productImages : clone(fallback.productImages || []),
    materialStrategy: valueOrDefault(source.materialStrategy || spec.materialStrategy, fallback.materialStrategy || 'visual-anchor-required'),
    // 素材完成度：final(可交付最终版) / draft(仅草稿) / none(无素材) / unknown(尚未预检)
    // 由 generate-page 的素材预检（asset-resolve）在生成时回填，IR 层默认 unknown。
    materialStatus: valueOrDefault(source.materialStatus || spec.materialStatus, 'unknown'),
    materialGaps: Array.isArray(source.materialGaps) ? clone(source.materialGaps) : [],
  };
}

function hasValue(value) {
  if (Array.isArray(value)) {
    return value.some(hasValue);
  }
  if (isPlainObject(value)) {
    return Object.keys(value).some((key) => hasValue(value[key]));
  }
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function hasBlockItems(block) {
  return Boolean(block && Array.isArray(block.items) && block.items.some(hasValue));
}

function isSameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeDomainSpecificity(rawSpec, options, blocks, defaults, normalized, scene) {
  const spec = isPlainObject(rawSpec) ? rawSpec : {};
  const optionInputs = isPlainObject(options) ? options : {};
  const heroBlock = blocks.heroBlock || {};
  const featureBlock = blocks.featureBlock || {};
  const metricBlock = blocks.metricBlock || {};
  const roadmapBlock = blocks.roadmapBlock || {};
  const ctaBlock = blocks.ctaBlock || {};
  const sampleFallbacks = [];
  const missing = [];

  const hasDomainText = hasValue([
    spec.requirement,
    spec.requirements,
    spec.prompt,
    spec.goal,
    spec.industry,
    spec.businessType,
    spec.business_type,
    spec.name,
    spec.title,
    spec.brandName,
    spec.appName,
    spec.appBlueprint,
    spec.app_blueprint,
  ]);
  const provided = {
    hero: hasValue(spec.brandName || spec.tagline || spec.heroText || heroBlock.brandName || heroBlock.tagline || heroBlock.text || heroBlock.heroText),
    features: hasValue(spec.features) || hasBlockItems(featureBlock),
    metrics: hasValue(spec.metrics) || hasBlockItems(metricBlock),
    roadmap: hasValue(spec.roadmap) || hasBlockItems(roadmapBlock),
    cta: hasValue(spec.ctaTitle || spec.ctaText || ctaBlock.title || ctaBlock.text),
    visualProfile: hasValue(optionInputs.visualProfile || spec.visualProfile || spec.visual_profile || spec.visual),
    appBlueprint: hasValue(optionInputs.appBlueprint || spec.appBlueprint || spec.app_blueprint || spec.pages || spec.roles || spec.navigation || spec.navGroups),
    interactionProfile: hasValue(optionInputs.interactionProfile || spec.interactionProfile || spec.interaction_profile || spec.interactions || spec.primaryAction || spec.detailMode || spec.bulkActions),
    insights: hasValue(optionInputs.insights || spec.insights || spec.insight),
    dataBinding: hasValue(optionInputs.dataBinding || spec.dataBinding || spec.data_binding || spec.formUuid || spec.form_uuid || spec.dataUrl || spec.data_url),
    assets: hasValue(spec.assets || spec.heroImage || spec.hero_image || spec.productImages || spec.images),
  };

  if (normalized.meta.brandName === defaults.meta.brandName) {
    sampleFallbacks.push('brandName');
  }
  if (normalized.meta.tagline === defaults.meta.tagline) {
    sampleFallbacks.push('tagline');
  }
  if (normalized.meta.heroText === defaults.meta.heroText) {
    sampleFallbacks.push('heroText');
  }
  if (isSameJson(normalized.features, defaults.features)) {
    sampleFallbacks.push('features');
  }
  if (isSameJson(normalized.metrics, defaults.metrics)) {
    sampleFallbacks.push('metrics');
  }
  if (isSameJson(normalized.roadmap, defaults.roadmap)) {
    sampleFallbacks.push('roadmap');
  }

  if (!provided.hero) {
    missing.push('页面名称、业务定位和首屏说明');
  }
  if (!provided.features) {
    missing.push('业务对象/模块，而不是模板卖点');
  }
  if (!provided.metrics && ['dashboard', 'screen', 'workbench'].includes(scene)) {
    missing.push('贴合业务的指标口径');
  }
  if (!provided.roadmap && scene !== 'landing') {
    missing.push('用户动作、处理路径或运营节奏');
  }
  if (!provided.interactionProfile && ['dashboard', 'list', 'detail', 'workbench'].includes(scene)) {
    missing.push('主操作、下钻方式、筛选/批量动作和空载错状态');
  }
  if (!provided.visualProfile) {
    missing.push('区别于 sample 的视觉方向');
  }
  if (scene === 'landing' && !provided.assets) {
    missing.push('真实素材或素材缺口说明');
  }

  const weightedProvided = [
    provided.hero,
    provided.features,
    provided.metrics,
    provided.roadmap,
    provided.cta,
    provided.visualProfile,
    provided.appBlueprint,
    provided.interactionProfile,
    provided.insights,
    provided.dataBinding,
    provided.assets,
  ].filter(Boolean).length;
  const score = Math.round((weightedProvided / 11) * 100);
  const status = sampleFallbacks.length === 0 && missing.length <= 1
    ? 'domain-ready'
    : hasDomainText
      ? 'draft-needs-domain-spec'
      : 'sample-reference';

  return {
    status,
    score,
    sampleFallbacks,
    missing,
    provided,
    guidance: status === 'domain-ready'
      ? 'Spec 已覆盖主要业务语义；sample 仅作为编译骨架。'
      : '补齐业务对象、指标口径、用户动作、视觉方向和素材/数据约束后再视为真实业务页；sample 只能作为可编译参考。',
  };
}

function normalizeTodoItems(items, fallback) {
  const normalized = toList(items)
    .filter(isPlainObject)
    .map((item, index) => ({
      id: item.id === undefined || item.id === null || item.id === '' ? index + 1 : item.id,
      content: valueOrDefault(item.content || item.title || item.text, `待办任务 ${index + 1}`),
      done: item.done === true || item.done === 'true' || item.status === 'done' || item.status === 'completed',
    }))
    .filter((item) => item.content);

  return normalized.length ? normalized : clone(fallback);
}

function normalizeProductHomepageSpec(rawSpec, options, templateName = PRODUCT_HOMEPAGE_TEMPLATE) {
  const spec = isPlainObject(rawSpec) ? clone(rawSpec) : {};

  if (isPlainObject(spec.variables)) {
    applyVariableOverrides(spec, spec.variables);
  }
  applyVariableOverrides(spec, options && options.variables);

  const heroBlock = getBlock(spec, 'hero') || {};
  const featureBlock = getBlock(spec, 'feature-grid') || {};
  const metricBlock = getBlock(spec, 'metric-strip') || {};
  const roadmapBlock = getBlock(spec, 'roadmap') || {};
  const ctaBlock = getBlock(spec, 'cta') || {};
  const optionScene = options && options.scene;
  const scene = normalizeScene(optionScene || spec.scene || spec.pageScene, DEFAULT_SCENE_BY_TEMPLATE[templateName] || DEFAULT_SCENE_BY_TEMPLATE[PRODUCT_HOMEPAGE_TEMPLATE]);
  const density = valueOrDefault(spec.density, DEFAULT_VISUAL_PROFILES[scene].density);
  const visualProfile = normalizeVisualProfile((options && options.visualProfile) || getVisualProfileInput(spec), scene, density);
  const archetype = normalizeArchetype((options && options.archetype) || getArchetypeInput(spec), scene);
  visualProfile.archetype = archetype;

  const defaults = DEFAULTS_BY_TEMPLATE[templateName] || DEFAULT_PRODUCT_HOMEPAGE;
  const meta = {
    brandName: valueOrDefault(spec.brandName || heroBlock.brandName, defaults.meta.brandName),
    brandInitials: valueOrDefault(spec.brandInitials || heroBlock.brandInitials, defaults.meta.brandInitials),
    tagline: valueOrDefault(spec.tagline || heroBlock.tagline, defaults.meta.tagline),
    heroText: valueOrDefault(spec.heroText || heroBlock.text || heroBlock.heroText, defaults.meta.heroText),
    primaryCta: valueOrDefault(spec.primaryCta || heroBlock.primaryCta, defaults.meta.primaryCta),
    secondaryCta: valueOrDefault(spec.secondaryCta || heroBlock.secondaryCta, defaults.meta.secondaryCta),
  };
  const assets = normalizeMediaAssets(spec, defaults);
  const appBlueprint = normalizeAppBlueprint((options && options.appBlueprint) || spec, scene, templateName, meta);
  const interactionProfile = normalizeInteractionProfile((options && options.interactionProfile) || spec, scene, meta);
  const insights = normalizeInsights((options && options.insights) || spec.insights || spec.insight, defaults.sections && defaults.sections.ctaText);
  const dataBinding = normalizeDataBinding((options && options.dataBinding) || spec, scene);

  const features = normalizeFeatureItems(
    featureBlock.items || spec.features,
    defaults.features
  );
  const metrics = normalizeMetricItems(
    metricBlock.items || spec.metrics,
    defaults.metrics
  );
  const roadmap = normalizeRoadmapItems(
    roadmapBlock.items || spec.roadmap,
    defaults.roadmap
  );
  const domainFidelity = normalizeDomainSpecificity(
    spec,
    options,
    { heroBlock, featureBlock, metricBlock, roadmapBlock, ctaBlock },
    defaults,
    { meta, features, metrics, roadmap },
    scene
  );

  return {
    irVersion: IR_VERSION,
    template: templateName,
    pageType: templateName,
    scene,
    density,
    researchLevel: normalizeResearchLevel((options && options.researchLevel) || getResearchLevelInput(spec), scene),
    archetype,
    visualProfile,
    themeProfile: normalizeThemeProfile((options && options.themeProfile) || getThemeProfileInput(spec)),
    themeScope: normalizeThemeScope((options && options.themeScope) || getThemeScopeInput(spec) || inferThemeScopeFromSpec(spec)),
    appBlueprint,
    interactionProfile,
    dataBinding,
    domainFidelity,
    meta,
    assets,
    insights,
    blocks: [
      {
        type: 'hero',
        brandName: meta.brandName,
        brandInitials: meta.brandInitials,
        tagline: meta.tagline,
        text: meta.heroText,
        primaryCta: meta.primaryCta,
        secondaryCta: meta.secondaryCta,
      },
      {
        type: 'feature-grid',
        title: valueOrDefault(spec.featuresTitle || featureBlock.title, defaults.sections.featuresTitle),
        items: features,
      },
      {
        type: 'metric-strip',
        items: metrics,
      },
      {
        type: 'roadmap',
        title: valueOrDefault(spec.roadmapTitle || roadmapBlock.title, defaults.sections.roadmapTitle),
        items: roadmap,
      },
      {
        type: 'cta',
        title: valueOrDefault(spec.ctaTitle || ctaBlock.title, defaults.sections.ctaTitle),
        text: valueOrDefault(spec.ctaText || ctaBlock.text, defaults.sections.ctaText),
      },
    ],
  };
}

function normalizeTodoMvcSpec(rawSpec, options) {
  const spec = isPlainObject(rawSpec) ? clone(rawSpec) : {};

  if (isPlainObject(spec.variables)) {
    applyVariableOverrides(spec, spec.variables);
  }
  applyVariableOverrides(spec, options && options.variables);

  const shellBlock = getBlock(spec, 'todo-shell') || {};
  const listBlock = getBlock(spec, 'todo-list') || {};
  const persistenceBlock = getBlock(spec, 'persistence') || {};
  const defaults = DEFAULT_TODO_MVC;
  const optionScene = options && options.scene;
  const scene = normalizeScene(optionScene || spec.scene || spec.pageScene, DEFAULT_SCENE_BY_TEMPLATE[TODO_MVC_TEMPLATE]);
  const density = valueOrDefault(spec.density, DEFAULT_VISUAL_PROFILES[scene].density);
  const visualProfile = normalizeVisualProfile((options && options.visualProfile) || getVisualProfileInput(spec), scene, density);
  const archetype = normalizeArchetype((options && options.archetype) || getArchetypeInput(spec), scene);
  visualProfile.archetype = archetype;

  const meta = {
    title: valueOrDefault(spec.title || shellBlock.title, defaults.meta.title),
    subtitle: valueOrDefault(spec.subtitle || shellBlock.subtitle, defaults.meta.subtitle),
    placeholder: valueOrDefault(spec.placeholder || shellBlock.placeholder, defaults.meta.placeholder),
    storageKey: valueOrDefault(spec.storageKey || persistenceBlock.storageKey, defaults.meta.storageKey),
    allLabel: valueOrDefault(spec.allLabel || shellBlock.allLabel, defaults.meta.allLabel),
    activeLabel: valueOrDefault(spec.activeLabel || shellBlock.activeLabel, defaults.meta.activeLabel),
    completedLabel: valueOrDefault(spec.completedLabel || shellBlock.completedLabel, defaults.meta.completedLabel),
    clearCompletedLabel: valueOrDefault(spec.clearCompletedLabel || shellBlock.clearCompletedLabel, defaults.meta.clearCompletedLabel),
  };

  const todos = normalizeTodoItems(
    listBlock.items || spec.todos || spec.items,
    defaults.todos
  );
  const appBlueprint = normalizeAppBlueprint((options && options.appBlueprint) || spec, scene, TODO_MVC_TEMPLATE, meta);
  const interactionProfile = normalizeInteractionProfile((options && options.interactionProfile) || spec, scene, meta);
  const dataBinding = normalizeDataBinding((options && options.dataBinding) || spec, scene);

  return {
    irVersion: IR_VERSION,
    template: TODO_MVC_TEMPLATE,
    pageType: TODO_MVC_TEMPLATE,
    scene,
    density,
    researchLevel: normalizeResearchLevel((options && options.researchLevel) || getResearchLevelInput(spec), scene),
    archetype,
    visualProfile,
    themeProfile: normalizeThemeProfile((options && options.themeProfile) || getThemeProfileInput(spec)),
    themeScope: normalizeThemeScope((options && options.themeScope) || getThemeScopeInput(spec) || inferThemeScopeFromSpec(spec)),
    appBlueprint,
    interactionProfile,
    dataBinding,
    meta,
    insights: normalizeInsights((options && options.insights) || spec.insights || spec.insight, ''),
    blocks: [
      {
        type: 'todo-shell',
        title: meta.title,
        subtitle: meta.subtitle,
        placeholder: meta.placeholder,
      },
      {
        type: 'todo-list',
        items: todos,
      },
      {
        type: 'todo-actions',
        allLabel: meta.allLabel,
        activeLabel: meta.activeLabel,
        completedLabel: meta.completedLabel,
        clearCompletedLabel: meta.clearCompletedLabel,
      },
      {
        type: 'persistence',
        mode: 'localStorage',
        storageKey: meta.storageKey,
      },
    ],
  };
}

function normalizePageSpec(spec, options) {
  const templateName = (options && options.template) || (spec && spec.template) || PRODUCT_HOMEPAGE_TEMPLATE;

  if (
    templateName === PRODUCT_HOMEPAGE_TEMPLATE ||
    templateName === WORKBENCH_HOME_TEMPLATE ||
    templateName === DASHBOARD_OVERVIEW_TEMPLATE ||
    templateName === OFFICIAL_HOMEPAGE_TEMPLATE ||
    templateName === DATA_SCREEN_TEMPLATE ||
    templateName === DATA_MANAGEMENT_TEMPLATE ||
    templateName === BUSINESS_LIST_TEMPLATE ||
    templateName === DETAIL_PROFILE_TEMPLATE ||
    templateName === SPLIT_PANE_DETAIL_TEMPLATE ||
    templateName === PORTAL_SHELL_HOME_TEMPLATE
  ) {
    return normalizeProductHomepageSpec(spec, options || {}, templateName);
  }

  if (templateName === TODO_MVC_TEMPLATE) {
    return normalizeTodoMvcSpec(spec, options || {});
  }

  throw new Error(`Unsupported page template: ${templateName}`);
}

function getBlockByType(ir, type) {
  return ir.blocks.find((block) => block.type === type) || {};
}

function escapeJsStringValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '\\n');
}

function encodeJsonForTemplate(value) {
  return escapeJsStringValue(JSON.stringify(value));
}

function buildTemplateVariablesFromIr(ir) {
  if (ir.template === TODO_MVC_TEMPLATE) {
    return buildTodoMvcTemplateVariables(ir);
  }

  const hero = getBlockByType(ir, 'hero');
  const features = getBlockByType(ir, 'feature-grid');
  const metrics = getBlockByType(ir, 'metric-strip');
  const roadmap = getBlockByType(ir, 'roadmap');
  const cta = getBlockByType(ir, 'cta');

  return {
    OPENYIDA_TEMPLATE: escapeJsStringValue(ir.template),
    OPENYIDA_IR_VERSION: escapeJsStringValue(ir.irVersion),
    OPENYIDA_SCENE: escapeJsStringValue(ir.scene),
    OPENYIDA_RESEARCH_LEVEL: escapeJsStringValue(ir.researchLevel || 'none'),
    OPENYIDA_ARCHETYPE: escapeJsStringValue(ir.archetype || ''),
    OPENYIDA_VISUAL_PROFILE: escapeJsStringValue(ir.visualProfile.name),
    OPENYIDA_VISUAL_PROFILE_JSON: encodeJsonForTemplate(ir.visualProfile),
    OPENYIDA_THEME_PROFILE: escapeJsStringValue(ir.themeProfile.name),
    OPENYIDA_THEME_PROFILE_JSON: encodeJsonForTemplate(ir.themeProfile),
    OPENYIDA_THEME_SCOPE: escapeJsStringValue(ir.themeScope),
    OPENYIDA_CANVAS_CONTROL_CSS: CANVAS_CONTROL_RESET_CSS,
    OPENYIDA_APP_BLUEPRINT_JSON: encodeJsonForTemplate(ir.appBlueprint || {}),
    OPENYIDA_INTERACTION_PROFILE_JSON: encodeJsonForTemplate(ir.interactionProfile || {}),
    OPENYIDA_INSIGHTS_JSON: encodeJsonForTemplate(ir.insights || []),
    OPENYIDA_DATA_BINDING_JSON: encodeJsonForTemplate(ir.dataBinding || {}),
    OPENYIDA_BLOCKS: escapeJsStringValue(ir.blocks.map((block) => block.type).join(',')),
    OPENYIDA_MATERIAL_STATUS: escapeJsStringValue((ir.assets && ir.assets.materialStatus) || 'unknown'),
    ASSETS_JSON: encodeJsonForTemplate(ir.assets || {}),
    BRAND_NAME: escapeJsStringValue(hero.brandName),
    BRAND_INITIALS: escapeJsStringValue(hero.brandInitials),
    TAGLINE: escapeJsStringValue(hero.tagline),
    HERO_TEXT: escapeJsStringValue(hero.text),
    PRIMARY_CTA: escapeJsStringValue(hero.primaryCta),
    SECONDARY_CTA: escapeJsStringValue(hero.secondaryCta),
    FEATURES_TITLE: escapeJsStringValue(features.title),
    ROADMAP_TITLE: escapeJsStringValue(roadmap.title),
    CTA_TITLE: escapeJsStringValue(cta.title),
    CTA_TEXT: escapeJsStringValue(cta.text),
    FEATURES_JSON: encodeJsonForTemplate(features.items || []),
    METRICS_JSON: encodeJsonForTemplate(metrics.items || []),
    ROADMAP_JSON: encodeJsonForTemplate(roadmap.items || []),
  };
}

function buildTodoMvcTemplateVariables(ir) {
  const shell = getBlockByType(ir, 'todo-shell');
  const list = getBlockByType(ir, 'todo-list');
  const actions = getBlockByType(ir, 'todo-actions');
  const persistence = getBlockByType(ir, 'persistence');

  return {
    OPENYIDA_TEMPLATE: escapeJsStringValue(ir.template),
    OPENYIDA_IR_VERSION: escapeJsStringValue(ir.irVersion),
    OPENYIDA_SCENE: escapeJsStringValue(ir.scene),
    OPENYIDA_RESEARCH_LEVEL: escapeJsStringValue(ir.researchLevel || 'none'),
    OPENYIDA_ARCHETYPE: escapeJsStringValue(ir.archetype || ''),
    OPENYIDA_VISUAL_PROFILE: escapeJsStringValue(ir.visualProfile.name),
    OPENYIDA_VISUAL_PROFILE_JSON: encodeJsonForTemplate(ir.visualProfile),
    OPENYIDA_THEME_PROFILE: escapeJsStringValue(ir.themeProfile.name),
    OPENYIDA_THEME_PROFILE_JSON: encodeJsonForTemplate(ir.themeProfile),
    OPENYIDA_THEME_SCOPE: escapeJsStringValue(ir.themeScope),
    OPENYIDA_CANVAS_CONTROL_CSS: CANVAS_CONTROL_RESET_CSS,
    OPENYIDA_APP_BLUEPRINT_JSON: encodeJsonForTemplate(ir.appBlueprint || {}),
    OPENYIDA_INTERACTION_PROFILE_JSON: encodeJsonForTemplate(ir.interactionProfile || {}),
    OPENYIDA_INSIGHTS_JSON: encodeJsonForTemplate(ir.insights || []),
    OPENYIDA_DATA_BINDING_JSON: encodeJsonForTemplate(ir.dataBinding || {}),
    OPENYIDA_BLOCKS: escapeJsStringValue(ir.blocks.map((block) => block.type).join(',')),
    TODO_TITLE: escapeJsStringValue(shell.title),
    TODO_SUBTITLE: escapeJsStringValue(shell.subtitle),
    TODO_PLACEHOLDER: escapeJsStringValue(shell.placeholder),
    TODO_STORAGE_KEY: escapeJsStringValue(persistence.storageKey),
    TODO_ALL_LABEL: escapeJsStringValue(actions.allLabel),
    TODO_ACTIVE_LABEL: escapeJsStringValue(actions.activeLabel),
    TODO_COMPLETED_LABEL: escapeJsStringValue(actions.completedLabel),
    TODO_CLEAR_COMPLETED_LABEL: escapeJsStringValue(actions.clearCompletedLabel),
    TODO_ITEMS_JSON: encodeJsonForTemplate(list.items || []),
  };
}

module.exports = {
  IR_VERSION,
  PRODUCT_HOMEPAGE_TEMPLATE,
  WORKBENCH_HOME_TEMPLATE,
  DASHBOARD_OVERVIEW_TEMPLATE,
  OFFICIAL_HOMEPAGE_TEMPLATE,
  DATA_SCREEN_TEMPLATE,
  DATA_MANAGEMENT_TEMPLATE,
  BUSINESS_LIST_TEMPLATE,
  DETAIL_PROFILE_TEMPLATE,
  TODO_MVC_TEMPLATE,
  DEFAULT_PRODUCT_HOMEPAGE,
  DEFAULT_WORKBENCH_HOME,
  DEFAULT_DASHBOARD_OVERVIEW,
  DEFAULT_OFFICIAL_HOMEPAGE,
  DEFAULT_DATA_SCREEN,
  DEFAULT_DATA_MANAGEMENT,
  DEFAULT_BUSINESS_LIST,
  DEFAULT_DETAIL_PROFILE,
  DEFAULT_TODO_MVC,
  PAGE_SCENES,
  THEME_SCOPES,
  RESEARCH_LEVELS,
  DEFAULT_VISUAL_PROFILES,
  DEFAULT_THEME_PROFILES,
  CANVAS_CONTROL_RESET_CSS,
  normalizePageSpec,
  buildTemplateVariablesFromIr,
  escapeJsStringValue,
  inferThemeScopeFromSpec,
};
