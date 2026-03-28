# CRM 客户管理系统 — OpenYida 的 TodoMVC

## 为什么是 CRM？

就像 TodoMVC 之于前端框架，CRM 是低代码平台的"标准试金石"：
- **天然覆盖全部字段类型**：客户信息需要文本/数字/选择/地址/附件/子表/关联表单/流水号...
- **天然需要流程审批**：合同审批（条件分支）+ 费用报销（多级审批）
- **天然需要数据联动**：客户 → 商机 → 合同 → 回访，形成完整数据链
- **天然需要数据看板**：销售漏斗、业绩趋势、客户分布
- **天然需要权限隔离**：销售员/经理/管理员的数据可见性不同

## 功能覆盖矩阵

| OpenYida 功能模块 | CRM 中的对应场景 | 涉及技能 |
|---|---|---|
| 应用创建 | 创建 CRM 应用 | `create-app` |
| 表单创建（19 种字段） | 5 个表单覆盖全部字段类型 | `create-form` |
| 表单修改 | 创建后补充字段 | `create-form update` |
| Schema 获取 | 获取字段 ID 供流程/页面使用 | `get-schema` |
| 流程创建 | 合同审批表 + 费用报销表 | `create-process` |
| 流程规则配置 | 条件分支 + 多级审批 + 字段权限 + 跳转规则 | `configure-process` |
| 数据操作 | 插入模拟数据 + 发起流程 + 审批 | `data` 全部子命令 |
| 权限配置 | 3 组权限（销售员/经理/管理员） | `save-permission` |
| 自定义页面开发 | 仪表盘 + 批量录入 | `custom-page` 规范 |
| 页面发布 | 编译发布 2 个页面 | `publish` |
| 密度设计 | 仪表盘使用 compact 密度 | `density` |
| 表格表单 | 批量录入页使用 table-form 模式 | `table-form` |
| 报表 | 6 种图表 + 筛选器 | `create-report` |
| 连接器 | 外部 CRM 数据同步 | `connector` |
| 页面配置 | 仪表盘组织内分享 | `page-config` |
| 页面导航 | 更新页面标题和导航 | `update-form-config` |

---

## 5 个表单设计

### 表单 1：客户信息表（普通表单）— 覆盖 10 种字段类型

| 字段 | 类型 | 说明 |
|---|---|---|
| 客户编号 | `SerialNumberField` | CUS-{yyyyMMdd}-{0001} |
| 客户名称 | `TextField` | required |
| 客户类型 | `RadioField` | 企业客户/个人客户 |
| 客户级别 | `SelectField` | A/B/C/D |
| 联系人 | `TextField` | — |
| 联系电话 | `TextField` | — |
| 联系邮箱 | `TextField` | — |
| 公司地址 | `AddressField` | 省市区 |
| 负责人 | `EmployeeField` | 当前用户 |
| 客户来源 | `MultiSelectField` | 官网/展会/转介绍/广告/电话 |
| 备注 | `TextareaField` | — |
| 相关附件 | `AttachmentField` | — |
| 联系人明细 | `TableField` | 子表：姓名 + 职位 + 电话 |

### 表单 2：商机管理表（普通表单）— 覆盖 9 种字段类型

| 字段 | 类型 | 说明 |
|---|---|---|
| 商机编号 | `SerialNumberField` | OPP-{0001} |
| 商机名称 | `TextField` | required |
| 关联客户 | `AssociationFormField` | → 客户信息表 |
| 商机阶段 | `SelectField` | 初步接触/需求确认/方案报价/谈判/赢单/输单 |
| 预计金额 | `NumberField` | 单位：万元 |
| 成交概率 | `NumberField` | 百分比 |
| 预计成交日期 | `DateField` | — |
| 负责人 | `EmployeeField` | — |
| 商机来源 | `RadioField` | 新开发/老客户/合作伙伴 |
| 商机描述 | `TextareaField` | — |
| 产品图片 | `ImageField` | — |
| 跟进记录 | `TableField` | 子表：日期 + 方式 + 内容 |

### 表单 3：合同审批表（流程表单 1）— 条件分支审批

| 字段 | 类型 | 说明 |
|---|---|---|
| 合同编号 | `SerialNumberField` | CON-{yyyyMM}-{0001} |
| 合同名称 | `TextField` | required |
| 关联客户 | `AssociationFormField` | → 客户信息表 |
| 关联商机 | `AssociationFormField` | → 商机管理表 |
| 合同类型 | `SelectField` | 销售合同/服务合同/框架协议 |
| 合同金额 | `NumberField` | required, 决定审批路径 |
| 签订日期 | `DateField` | — |
| 合同期限 | `CascadeDateField` | 开始-结束 |
| 负责人 | `EmployeeField` | — |
| 合同附件 | `AttachmentField` | — |
| 合同备注 | `TextareaField` | — |

**审批流程（条件分支）**：
- 金额 <= 5 万 → 部门经理审批 → 结束
- 金额 > 5 万 且 <= 20 万 → 部门经理审批 → 财务审批 → 结束
- 金额 > 20 万 → 部门经理审批 → 财务审批 → 总经理审批 → 结束
- 驳回时跳转到发起人修改

### 表单 4：费用报销表（流程表单 2）— 多级顺序审批

| 字段 | 类型 | 说明 |
|---|---|---|
| 报销单号 | `SerialNumberField` | EXP-{yyyyMMdd}-{0001} |
| 申请人 | `EmployeeField` | 默认当前用户 |
| 所属部门 | `DepartmentSelectField` | — |
| 关联客户 | `AssociationFormField` | → 客户信息表（可选） |
| 报销类型 | `SelectField` | 差旅/招待/办公/交通/其他 |
| 报销明细 | `TableField` | 子表：日期 + 类别 + 金额 + 说明 |
| 报销总额 | `NumberField` | — |
| 报销说明 | `TextareaField` | — |

**审批流程（多级顺序）**：
- 直属主管审批（字段：全部只读）→ 财务审核（字段：可编辑备注）→ 出纳确认 → 结束
- 驳回时跳转到发起人

### 表单 5：客户回访表（普通表单）— 补齐剩余字段类型

| 字段 | 类型 | 说明 |
|---|---|---|
| 关联客户 | `AssociationFormField` | → 客户信息表 |
| 回访人 | `EmployeeField` | — |
| 回访日期 | `DateField` | — |
| 回访方式 | `RadioField` | 电话/上门/视频/邮件 |
| 满意度 | `RateField` | 5 星 |
| 反馈标签 | `CheckboxField` | 产品满意/服务及时/价格合理/需要改进 |
| 客户区域 | `CountrySelectField` | — |
| 回访记录 | `TextareaField` | — |

**19 种字段类型覆盖确认**：TextField, TextareaField, NumberField, RateField, RadioField, SelectField, CheckboxField, MultiSelectField, DateField, CascadeDateField, EmployeeField, DepartmentSelectField, CountrySelectField, AddressField, AttachmentField, ImageField, TableField, AssociationFormField, SerialNumberField — **全部覆盖**

---

## 2 个自定义页面

### 页面 1：CRM 销售仪表盘（compact 密度）

功能：
- 4 个指标卡：客户总数、商机总数、合同总额、本月新增客户
- 商机阶段漏斗（按阶段统计数量）
- 最近跟进记录列表（查询商机表子表数据）
- 密度切换按钮（compact / comfortable）

技术覆盖：
- `this.utils.yida.searchFormDatas` 调用多个表单
- `this.setState` 状态管理
- compact density 设计规范
- 定时器自动刷新 + didUnmount 清理
- 响应式布局

### 页面 2：客户数据批量录入工具（table-form 模式）

功能：
- 选择目标表单（客户/商机/回访）
- 表格式批量输入（动态增删行）
- Excel 粘贴导入
- 行内验证
- 草稿暂存（localStorage）
- 批量提交（Promise.all）

技术覆盖：
- table-form 批量提交模式
- `this.utils.yida.saveFormData` 批量调用
- 非受控输入
- 错误处理与 toast 提示

---

## 权限配置（3 组）

| 权限组 | 数据范围 | 操作权限 |
|---|---|---|
| 销售员 | `ORIGINATOR`（本人数据） | 查看、编辑、新增 |
| 销售经理 | `ORIGINATOR_DEPARTMENT`（本部门） | 查看、编辑、新增、删除、导出 |
| 管理员 | `ALL`（全部数据） | 全部操作 |

对所有 5 个表单配置权限。

---

## 报表（6 种图表 + 筛选器）

| 图表 | 类型 | 数据源 |
|---|---|---|
| 客户总数 | `indicator` | 客户信息表 |
| 商机销售漏斗 | `funnel` | 商机管理表（按阶段） |
| 月度合同趋势 | `line` | 合同审批表（按月） |
| 客户类型分布 | `pie` | 客户信息表（按类型） |
| 销售业绩排名 | `bar` | 商机管理表（按负责人） |
| 客户级别 x 商机阶段 | `pivot` | 商机管理表 |

筛选器：按时间范围筛选，联动全部图表。

---

## 连接器

创建一个"外部 CRM 数据同步"连接器：
- 鉴权方式：`BasicAuth`
- 域名：`https://jsonplaceholder.typicode.com`（公共测试 API）
- 执行动作：GET /users（模拟获取外部客户列表）
- 测试执行动作

---

## 页面配置

- 仪表盘页面：组织内分享 `/s/crm-dashboard`
- 更新页面标题和导航配置

---

## 执行计划（17 个 Task）

### Task 1: 环境检查与应用创建
- `openyida auth status` 确认登录态
- `openyida create-app "CRM客户管理系统"` 获取 appType

### Task 2: 创建客户信息表
- 使用 `create-form create` 创建含 13 个字段的表单
- 包含 SerialNumberField、TableField、AddressField、MultiSelectField 等
- `get-schema` 获取字段 ID

### Task 3: 创建商机管理表
- 依赖 Task 2（需要客户表 formUuid 配置关联表单）
- 包含 AssociationFormField、ImageField、TableField 等
- `get-schema` 获取字段 ID

### Task 4: 创建合同审批表 + 流程配置
- 依赖 Task 2, 3（需要两个关联表单）
- 先 `create-form` 创建表单 → `get-schema` 获取字段 ID
- 再 `create-process` 转为流程表单
- 最后 `configure-process` 配置条件分支审批流程（金额阈值 5万/20万）

### Task 5: 创建费用报销表 + 流程配置
- 依赖 Task 2（关联客户表）
- 先 `create-form` → `get-schema` → `create-process` → `configure-process`
- 多级顺序审批 + 字段权限控制

### Task 6: 创建客户回访表
- 依赖 Task 2（关联客户表）
- 包含 RateField、CheckboxField、CountrySelectField（补齐剩余字段类型）

### Task 7: 权限配置
- 依赖 Task 2-6（所有表单创建完成）
- 对 5 个表单分别配置 3 组权限

### Task 8: 插入模拟数据（普通表单）
- 依赖 Task 2, 3, 6
- 客户信息表：5 条数据
- 商机管理表：8 条数据（关联客户）
- 客户回访表：3 条数据

### Task 9: 发起流程实例 + 审批
- 依赖 Task 4, 5, 8
- 合同审批：发起 3 条（分别触发 3 个条件分支）
- 费用报销：发起 2 条
- 执行审批任务（AGREE）

### Task 10: 开发 CRM 仪表盘页面
- 依赖 Task 1（需要 appType）
- 先 `create-page` 创建页面
- 编写 JSX 代码（compact 密度、指标卡、数据列表）

### Task 11: 开发批量录入页面
- 依赖 Task 1（需要 appType）
- 先 `create-page` 创建页面
- 编写 JSX 代码（table-form 模式、批量提交）

### Task 12: 发布自定义页面
- 依赖 Task 10, 11
- `openyida publish` 编译发布 2 个页面

### Task 13: 创建报表
- 依赖 Task 8, 9（需要有数据才能验证）
- 创建报表 + 6 种图表 + 筛选器

### Task 14: 创建连接器
- 无强依赖，可与其他任务并行
- 创建连接器 → 添加执行动作 → 测试

### Task 15: 页面配置与分享
- 依赖 Task 12（页面发布后）
- 配置组织内分享链接
- 更新页面标题和导航

### Task 16: 浏览器端到端验证
- 依赖 Task 1-15 全部完成
- 验证所有表单、流程、页面、报表的功能正确性

### Task 17: 输出回归测试报告
- 汇总所有功能点的测试结果
- 标注通过/失败/已知问题

### 依赖关系图

```
T1 ──→ T2 ──→ T3 ──→ T4 (合同审批+流程)
         │       │
         │       └──→ T5 (费用报销+流程) ──→ T9 (流程实例)
         │                                      │
         └──→ T6 (客户回访)                      │
         │                                      │
         └──→ T8 (插入数据) ────────────────────→ T9
         │
         └──→ T7 (权限配置，依赖 T2-T6)

T1 ──→ T10 (仪表盘) ──→ T12 (发布) ──→ T15 (分享)
T1 ──→ T11 (批量录入) ──→ T12

T8+T9 ──→ T13 (报表)
T1 ──→ T14 (连接器，可并行)

T1-T15 ──→ T16 (E2E 验证) ──→ T17 (报告)
```

### 可并行的任务组

- T3 + T5 + T6 可并行（均仅依赖 T2）
- T10 + T11 可并行（均仅依赖 T1）
- T14 可与大部分任务并行
- T7 + T8 可并行（T7 依赖所有表单，T8 依赖普通表单）
