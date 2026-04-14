/**
 * IPD 管理系统完整示例
 * 
 * 本示例演示如何一次性创建完整的 IPD 管理应用
 * 包含：应用创建、多个表单页面、自定义仪表盘、数据插入
 */

// ============================================================
// 第一步：创建应用
// ============================================================

/*
openyida create-app "IPD管理系统" "集成产品开发全流程管理"
*/

// 输出示例：
// {"success":true,"appType":"APP_XXX","appName":"IPD管理系统","url":"..."}

// ============================================================
// 第二步：创建表单页面（使用 JSON 定义字段）
// ============================================================

// 2.1 需求管理表单
var requirementFields = [
  { "type": "TextField", "label": "需求编号", "required": true },
  { "type": "TextField", "label": "需求标题", "required": true },
  { "type": "SelectField", "label": "需求类型", "options": ["产品需求", "技术需求", "市场需求"] },
  { "type": "SelectField", "label": "优先级", "options": ["P0-紧急", "P1-高", "P2-中", "P3-低"] },
  { "type": "TextareaField", "label": "需求描述" },
  { "type": "EmployeeField", "label": "提出人" },
  { "type": "DateField", "label": "期望完成日期" },
  { "type": "SelectField", "label": "状态", "options": ["待评审", "已评审", "开发中", "已上线"] }
];

/*
# 创建需求管理表单
openyida create-form create <appType> "需求管理" --fields-json '[
  {"type":"TextField","label":"需求编号","required":true},
  {"type":"TextField","label":"需求标题","required":true},
  {"type":"SelectField","label":"需求类型","options":["产品需求","技术需求","市场需求"]},
  {"type":"SelectField","label":"优先级","options":["P0-紧急","P1-高","P2-中","P3-低"]},
  {"type":"TextareaField","label":"需求描述"},
  {"type":"EmployeeField","label":"提出人"},
  {"type":"DateField","label":"期望完成日期"},
  {"type":"SelectField","label":"状态","options":["待评审","已评审","开发中","已上线"]}
]'
*/

// 2.2 项目立项表单
var projectFields = [
  { "type": "TextField", "label": "项目名称", "required": true },
  { "type": "TextField", "label": "项目编号", "required": true },
  { "type": "SelectField", "label": "项目类型", "options": ["新产品开发", "产品改进", "技术预研"] },
  { "type": "TextareaField", "label": "项目目标" },
  { "type": "NumberField", "label": "预算(万元)" },
  { "type": "EmployeeField", "label": "项目经理" },
  { "type": "DateField", "label": "计划开始日期" },
  { "type": "DateField", "label": "计划结束日期" }
];

// 2.3 缺陷管理表单
var bugFields = [
  { "type": "TextField", "label": "缺陷编号", "required": true },
  { "type": "TextField", "label": "缺陷标题", "required": true },
  { "type": "SelectField", "label": "严重程度", "options": ["致命", "严重", "一般", "轻微"] },
  { "type": "SelectField", "label": "优先级", "options": ["P0-紧急", "P1-高", "P2-中", "P3-低"] },
  { "type": "TextareaField", "label": "缺陷描述" },
  { "type": "EmployeeField", "label": "报告人" },
  { "type": "EmployeeField", "label": "处理人" },
  { "type": "SelectField", "label": "状态", "options": ["新建", "处理中", "已修复", "已验证", "已关闭"] }
];

// ============================================================
// 第三步：创建自定义仪表盘页面
// ============================================================

/*
# 创建自定义页面
openyida create-page <appType> "IPD仪表盘"

# 编写仪表盘代码（参考 yida-custom-page/templates/custom-page-template.js）
# 然后发布
openyida publish project/pages/src/ipd-dashboard.js <appType> <formUuid>
*/

// ============================================================
// 第四步：插入初始数据
// ============================================================

/*
# 先获取字段 ID
openyida get-schema <appType> <formUuid>

# 插入需求数据
openyida data create form <appType> <formUuid> --data '{
  "textField_xxx": "REQ-2024-001",
  "textField_yyy": "支持多语言国际化",
  "selectField_zzz": "产品需求",
  "selectField_aaa": "P1-高",
  "textareaField_bbb": "系统需要支持中英文切换",
  "selectField_ccc": "开发中"
}'
*/

// ============================================================
// 完整流程命令清单（复制执行）
// ============================================================

/*

# 1. 创建应用
openyida create-app "IPD管理系统"

# 2. 创建表单页面
openyida create-form create <appType> "需求管理" --fields-json '[...]'
openyida create-form create <appType> "项目立项" --fields-json '[...]'
openyida create-form create <appType> "缺陷管理" --fields-json '[...]'

# 3. 创建自定义页面
openyida create-page <appType> "IPD仪表盘"

# 4. 编写并发布仪表盘（使用 custom-page-template.js 模板）
openyida publish project/pages/src/ipd-dashboard.js <appType> <formUuid>

# 5. 插入初始数据
openyida data create form <appType> <formUuid> --data '{"textField_xxx":"值"}'

*/
