'use strict';

// Keep this catalog aligned with yida-next's page navigation icon picker:
// src/components/AppSubNav/SortMenuTree/Theme/nav-icon-config.json.
const FORM_NAV_ICON_GROUPS = [
  {
    key: 'defaultIcons',
    label: '常用图标',
    items: [
      ['zhuye', '首页'],
      ['clock', '时钟'],
      ['CalendarSeventeen', '日历'],
      ['set', '设置'],
      ['account-settings', '账号设置'],
      ['account', '人'],
      ['lock', '锁'],
      ['Addresslist', '通讯录'],
      ['App', '应用'],
      ['application', '应用2'],
      ['dashboard', '看板'],
      ['biaodan', '表单'],
      ['baobiao', '报表'],
      ['juhebiao', '聚合表'],
      ['liucheng', '流程'],
      ['biaoge', '表格'],
      ['list', '列表'],
      ['gerenwendang', '文档'],
      ['Project', '项目'],
      ['Filemanage', '文件管理'],
      ['add-doc', '添加文件'],
      ['bumen', '部门'],
      ['gongzuo', '工作'],
      ['book', '书'],
      ['bonus', '礼物'],
      ['briefcase', '公文包'],
      ['building', '建筑'],
      ['dingdingka', '钉钉卡'],
      ['desktop', '电脑'],
      ['document', '文件'],
      ['folder', '文件夹'],
    ],
  },
  {
    key: 'systemIcons',
    label: '更多图标',
    items: [
      ['smile', '笑脸'],
      ['rengongfuwu', '人工服务'],
      ['shop', '商城'],
      ['calendar', '日历'],
      ['Documents', '文件包'],
      ['DingDrive', '云'],
      ['appointment', '职务'],
      ['Mail', '邮件'],
      ['Product_management', '产品管理'],
      ['Todo', '任务'],
      ['admin', '账号'],
      ['airplane', '飞机'],
      ['bianqian', '标签'],
      ['bus', '汽车'],
      ['caidan1', '菜单'],
      ['calendar-span', '日历'],
      ['cascade', '连接'],
      ['certificate-type', '印章管理'],
      ['chengyuan', '成员'],
      ['chuangjiantuandui', '创建团队'],
      ['command', '快捷键'],
      ['custom-column', '列表'],
      ['data-settings', '数据设置'],
      ['dagangshu', '大纲树'],
      ['diannao', '电脑'],
      ['diqu', '地区'],
      ['dizhi', '地址'],
      ['fulishe', '福利社'],
      ['keshihuadaping', '可视化大屏'],
      ['employee-add', '新增成员'],
      ['fujian', '附件'],
      ['fuwushichang', '市场'],
      ['gouwudai', '购物袋'],
      ['guanlianzuzhi', '关联组织'],
      ['huangguan', '皇冠'],
      ['huiyishi', '会议室'],
      ['huiyuan', '会员'],
      ['image', '图片'],
      ['list-container', '列表2'],
      ['name-card', '名片'],
      ['printer', '打印机'],
      ['renwu', '任务2'],
      ['riqiziduan', '日期'],
      ['scan', '扫码'],
      ['shezhi', '设置'],
      ['shoucang', '收藏'],
      ['wenjian', '文件2'],
      ['shujuguanliye1', '数据管理页'],
      ['shujuyuanshezhi', '数据源'],
      ['suo', '锁'],
      ['tianjia', '添加'],
      ['tongxunlu', '通讯录'],
      ['wode', '我的'],
      ['zhuguanliyuan', '主管理员'],
      ['ziguanliyuan', '子管理员'],
    ],
  },
];

const FORM_NAV_ICONS = FORM_NAV_ICON_GROUPS.flatMap(function (group) {
  return group.items.map(function (item) {
    return {
      name: item[0],
      label: item[1],
      group: group.key,
    };
  });
});

const ICON_BY_LOWER_NAME = new Map(FORM_NAV_ICONS.map(function (icon) {
  return [icon.name.toLowerCase(), icon.name];
}));

const SEMANTIC_ICON_RULES = [
  { icon: 'clock', keywords: ['考勤', '打卡', '工时', '时钟', 'attendance', 'timesheet'] },
  { icon: 'huiyishi', keywords: ['会议室', '会议预约', '会议', 'meeting'] },
  { icon: 'CalendarSeventeen', keywords: ['日程', '日历', '排期', '计划', '预约', 'calendar', 'schedule'] },
  { icon: 'Project', keywords: ['项目', 'project'] },
  { icon: 'Todo', keywords: ['任务', '待办', '工单', 'task', 'todo', 'ticket'] },
  { icon: 'name-card', keywords: ['客户', '联系人', '访客', '名片', 'crm', 'customer', 'contact', 'visitor'] },
  { icon: 'chengyuan', keywords: ['员工', '人员', '成员', '人才', '招聘', 'employee', 'member', 'recruit'] },
  { icon: 'bumen', keywords: ['部门', '组织', '团队', 'department', 'organization', 'team'] },
  { icon: 'Product_management', keywords: ['产品', '需求', 'product', 'requirement'] },
  { icon: 'shop', keywords: ['商品', '商城', '店铺', 'product catalog', 'store', 'shop'] },
  { icon: 'gouwudai', keywords: ['订单', '采购', '销售', '购物', 'order', 'purchase', 'sales'] },
  { icon: 'dingdingka', keywords: ['财务', '报销', '费用', '付款', '收款', '预算', '发票', 'finance', 'expense', 'payment', 'invoice'] },
  { icon: 'document', keywords: ['合同', '协议', '公文', '文书', 'contract', 'agreement'] },
  { icon: 'Filemanage', keywords: ['文件', '档案', '资料', 'file', 'archive'] },
  { icon: 'book', keywords: ['知识', '图书', '课程', '培训', 'knowledge', 'book', 'course', 'training'] },
  { icon: 'baobiao', keywords: ['报表', '统计', '分析', 'report', 'analytics'] },
  { icon: 'dashboard', keywords: ['看板', '指标', '驾驶舱', 'dashboard', 'metric'] },
  { icon: 'liucheng', keywords: ['审批', '流程', 'approval', 'workflow'] },
  { icon: 'dizhi', keywords: ['地址', '地点', '场地', 'address', 'location'] },
  { icon: 'building', keywords: ['仓库', '库房', '楼宇', '场馆', 'warehouse', 'building'] },
  { icon: 'desktop', keywords: ['设备', '电脑', '终端', 'device', 'computer'] },
  { icon: 'fuwushichang', keywords: ['市场', '营销', '活动', '推广', 'marketing', 'campaign'] },
  { icon: 'bonus', keywords: ['礼品', '奖励', '福利', 'gift', 'reward', 'benefit'] },
  { icon: 'rengongfuwu', keywords: ['客服', '服务', '咨询', 'service', 'support'] },
  { icon: 'Mail', keywords: ['邮件', '消息', '通知', 'mail', 'message', 'notification'] },
  { icon: 'image', keywords: ['图片', '照片', '素材', 'image', 'photo', 'media'] },
  { icon: 'fujian', keywords: ['附件', 'attachment'] },
  { icon: 'certificate-type', keywords: ['印章', '用印', '证书', 'seal', 'certificate'] },
  { icon: 'admin', keywords: ['账号', '管理员', 'account', 'admin'] },
  { icon: 'lock', keywords: ['权限', '安全', '密码', 'permission', 'security', 'password'] },
  { icon: 'bus', keywords: ['车辆', '用车', '交通', 'vehicle', 'car', 'transport'] },
  { icon: 'airplane', keywords: ['差旅', '航班', '机票', 'travel', 'flight'] },
  { icon: 'diqu', keywords: ['地区', '区域', 'region', 'area'] },
  { icon: 'scan', keywords: ['扫码', '二维码', '条码', 'scan', 'qrcode', 'barcode'] },
  { icon: 'shezhi', keywords: ['配置', '设置', 'config', 'setting'] },
  { icon: 'biaoge', keywords: ['台账', '清单', '表格', '明细', 'ledger', 'table', 'list'] },
  { icon: 'liucheng', keywords: ['申请', 'request'] },
];

const GENERIC_FORM_ICONS = ['biaodan', 'list', 'document', 'briefcase', 'gongzuo'];

function normalizeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).toLowerCase();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean).join(' ');
  }
  if (typeof value === 'object') {
    return Object.values(value).map(normalizeText).filter(Boolean).join(' ');
  }
  return '';
}

function collectFieldSemanticText(fields) {
  const values = [];
  const visit = function (fieldList) {
    (fieldList || []).forEach(function (field) {
      if (!field || typeof field !== 'object') {
        return;
      }
      values.push(field.label, field.title, field.name, field.key);
      if (field.props && typeof field.props === 'object') {
        values.push(field.props.label, field.props.title, field.props.name);
      }
      if (Array.isArray(field.children)) {
        field.children.forEach(function (children) {
          visit(Array.isArray(children) ? children : [children]);
        });
      }
    });
  };
  visit(fields);
  return normalizeText(values);
}

function findSemanticIcon(text) {
  return SEMANTIC_ICON_RULES.find(function (rule) {
    return rule.keywords.some(function (keyword) {
      return text.includes(keyword.toLowerCase());
    });
  });
}

function stableGenericIcon(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index++) {
    hash = ((hash * 31) + text.charCodeAt(index)) >>> 0;
  }
  return GENERIC_FORM_ICONS[hash % GENERIC_FORM_ICONS.length];
}

function inferFormNavIcon(formTitle, fields) {
  const titleText = normalizeText(formTitle);
  const titleMatch = findSemanticIcon(titleText);
  if (titleMatch) {
    return titleMatch.icon;
  }

  const fieldText = collectFieldSemanticText(fields);
  const fieldMatch = findSemanticIcon(fieldText);
  if (fieldMatch) {
    return fieldMatch.icon;
  }

  return stableGenericIcon(titleText || fieldText || 'form');
}

function normalizeFormNavIcon(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.toLowerCase() === 'auto') {
    return null;
  }
  return ICON_BY_LOWER_NAME.get(raw.toLowerCase()) || '';
}

function resolveFormNavIcon(value, formTitle, fields) {
  const normalized = normalizeFormNavIcon(value);
  if (normalized) {
    return {
      icon: normalized,
      source: 'explicit',
    };
  }
  if (String(value || '').trim() && String(value).trim().toLowerCase() !== 'auto') {
    return {
      icon: '',
      source: 'invalid',
    };
  }
  return {
    icon: inferFormNavIcon(formTitle, fields),
    source: 'auto',
  };
}

module.exports = {
  FORM_NAV_ICON_GROUPS,
  FORM_NAV_ICONS,
  collectFieldSemanticText,
  inferFormNavIcon,
  normalizeFormNavIcon,
  resolveFormNavIcon,
};
