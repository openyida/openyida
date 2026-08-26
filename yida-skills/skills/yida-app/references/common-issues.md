# 常见问题解决思路

## 用途

完整应用执行中遇到资源、字段、数据、页面、发布或输出异常时，先按本文件定位问题，再回到对应 workflow 步骤修正。

## 问题速查

| 现象 | 先看什么 | 处理路径 |
| --- | --- | --- |
| 不确定改哪个应用或页面 | 本轮显式 `appType`、`formUuid`、URL、绑定上下文、workspace cache | 回到 [Step 1](../workflow/step-1-resource-context.md) 重新解析资源；同级冲突时询问用户 |
| 已有 app 却又准备创建新 app | Step 1 的 app context 和 `allowCreate` | 复用已有 `appType`；只有目标缺失且允许创建时进入 [Step 3](../workflow/step-3-create-or-reuse-app.md) |
| 创建或发布页面前 `corpId` 不一致 | PRD/resource context 与 auth snapshot | 回到 [Step 6](../workflow/step-6-main-page.md)；确认重新登录到目标组织，或确认在当前组织继续 |
| 不知道字段 ID | `.cache/<项目名>-schema.json`、create/update 输出、`get-schema` | 回到 [Step 4](../workflow/step-4-forms-processes.md)；对目标表单执行一次完整 `--field-map-json` |
| seed records 写入失败 | 字段类型、必填字段、日期格式、单条记录结构 | 回到 [Step 5](../workflow/step-5-seed-records.md)；修正字段值后单条重试，再 query 抽查 |
| 页面没有真实数据 | `page-spec.json.dataBinding`、真实 `appType/formUuid/fieldId`、seed records 查询结果 | 回到 [Step 7](../workflow/step-7-page-code.md)；页面接真实表单或展示空态和登记入口 |
| 页面依赖 `this.dataSourceMap.*` 但发布提示无数据源 | 页面源码、页面 Schema、数据源绑定结果 | 执行 `use_skill("yida-data-source-connectors", "绑定设计器数据源")`，或改为真实表单 API/dataBinding |
| 页面业务内容像模板 | `prd.md` 的页面目标、指标口径、主操作、数据来源 | 回写 `prd.md`，重新派生 `page-spec.json`，再回到 Step 7 |
| 页面视觉和设计不一致 | `design.md` 的 token、布局、背景、圆角、密度、组件和状态规则 | 回写或重读 `design.md`，再回到 Step 7 |
| `page-spec.json` 和 PRD/design.md 冲突 | `sourceOfTruth`、`designFile`、`designRefs`、dataBinding | 丢弃旧 spec，从最新 PRD + `design.md` 重生成 |
| JSX 运行时报中文变量未定义 | 页面源码中的 `{所有级别}`、`{处理中}` 等裸中文表达式 | 改成纯文本或 `{'所有级别'}` 形式，再重新校验 |
| Canvas 编译报 `OPENYIDA_CANVAS_UNBOUND_IDENTIFIER`，名称是辅助函数、Ref、状态或局部变量，或运行时报 `<name> is not defined` | `details.issues` 中的全部名称和行列 | 回到 [Step 7](../workflow/step-7-page-code.md)；一次补齐声明或统一重命名，再重新执行 Canvas 本地校验 |
| Canvas 编译报 `OPENYIDA_CANVAS_UNBOUND_IDENTIFIER`，名称由非标准运行时提供 | `details.issues` 中的名称和运行时能力路径 | 回到 [Step 7](../workflow/step-7-page-code.md)；通过 `window.<name>` / `parentWindow.<name>` 获取能力，检查目标方法后重新执行 Canvas 本地校验 |
| emoji 导致 create/publish 失败 | 字段 JSON、`page-spec.json`、页面源码、发布 Schema、路径 | 删除 emoji；页面图标改成 `lucide-react` 或 `@ant-design/icons` 标准 import |
| 本地源码改了但远端没更新 | 是否有成功的 `openyida publish <source> <appType> <displayPageFormUuid>` | 回到 [Step 8](../workflow/step-8-publish-navigation.md) 发布本轮源码 |
| 发布失败后想重试 | 上一次 stdout/stderr、登录态、组织、参数、输入文件、字段 ID | 修改至少一项输入或上下文后重试；保留错误输出 |
| 导航顺序不对 | PRD 的导航顺序、`nav-group order` / `nav-group auto-order` 输出 | 回到 Step 8；有明确顺序用 `nav-group order`，无明确顺序用自动排序兜底 |
| final 输出太技术化 | 是否默认暴露资源 ID、管理态链接、CDN 产物 | 回到 [Step 9](../workflow/step-9-output-finish.md)；改成 2-3 句业务总结 + 一个主入口链接 |
| 用户要求删除应用 | 应用名称、应用 ID、影响范围、用户确认文本 | 展示影响范围，等待用户明确回复“确认删除”后执行 |

## 定位顺序

1. 先确认当前问题属于资源、设计、资源落地、页面、发布还是输出。
2. 读取对应 workflow 步骤，不跨步骤猜命令。
3. 使用真实 CLI 输出、`.cache/<项目名>-schema.json`、PRD 和 `design.md` 判断事实。
4. 修改目标事实源或输入文件后再重试命令。
5. 仍无法继续时，向用户说明阻塞点、已确认事实和下一步需要的确认。

## 常用修正入口

| 问题类型 | 修正入口 |
| --- | --- |
| 目标资源不清 | [Step 1：解析资源上下文](../workflow/step-1-resource-context.md) |
| PRD 或视觉事实缺失 | [Step 2：产品设计](../workflow/step-2-design.md) |
| app 创建/复用错误 | [Step 3：创建或复用应用](../workflow/step-3-create-or-reuse-app.md) |
| 表单、流程、字段 ID 错误 | [Step 4：创建或更新表单/流程](../workflow/step-4-forms-processes.md) |
| 示例数据失败 | [Step 5：写入初始表单数据](../workflow/step-5-seed-records.md) |
| 主页面或组织不一致 | [Step 6：创建或复用主页面](../workflow/step-6-main-page.md) |
| 页面源码或数据绑定错误 | [Step 7：编写或更新页面](../workflow/step-7-page-code.md) |
| 发布或导航失败 | [Step 8：发布页面并排序导航](../workflow/step-8-publish-navigation.md) |
| 输出口径错误 | [Step 9：输出与收尾](../workflow/step-9-output-finish.md) |
