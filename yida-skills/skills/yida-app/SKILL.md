---
name: yida-app
description: 宜搭完整应用开发技能，描述从零到一搭建一个完整宜搭应用的全流程，包括创建应用、创建页面、需求分析、编写代码、创建表单、发布部署。不适用于：只需修改单个子步骤（如只改表单字段、只发布页面）时，应直接调用对应子技能。
---

# yida-app — 宜搭完整应用开发编排技能

> 本文档是**流程编排层**，描述各子技能的调用时机、决策逻辑和数据流转。
> 各子技能的详细参数和示例请查阅对应的子技能文档（见主 `SKILL.md` 索引表）。

## 严格禁止 (NEVER DO)

- 不要跳过 `openyida env` 环境检测直接开始开发
- 不要在未读取各子技能 SKILL.md 的情况下执行对应操作
- 不要编造任何 ID（appType/formUuid/fieldId），必须从命令返回中提取

## 严格要求 (MUST DO)

- 开始前必须运行 `openyida env` 确认环境和登录态
- 按照本文档的流程编排顺序执行，不要跳步
- 每个关键 ID 创建后立即记录到 `.cache/<项目名>-schema.json`
- 业务需求记录到 `prd/<项目名>.md`
- **本技能不读写 memory**：所有关键 ID（appType、formUuid 等）通过 `.cache/<项目名>-schema.json` 持久化，不依赖跨会话的 memory 状态

## 适用场景

用户说"帮我搭建一个完整应用"、"从零开始创建系统"、"一句话生成应用"时使用。
本技能是**流程编排层**，负责调度各子技能按正确顺序执行。

## 触发条件

**正向触发**（用户意图是从零搭建完整应用）：
- "帮我搭建一个完整应用"
- "从零开始创建系统"
- "一句话生成应用"
- "帮我做一个 XXX 系统/平台/工具"

**不适用场景（不要触发，改用对应子技能）**：
- 只需创建应用 → `yida-create-app`
- 只需创建/修改表单 → `yida-create-form-page`
- 只需发布页面 → `yida-publish-page`
- 只需配置流程 → `yida-process-rule` 或 `yida-create-process`
- 只需查询/录入数据 → `yida-data-management`

---

## 完整开发流程

```
[Step 1] 创建应用 → openyida create-app          → 获得 appType
              ↓
[Step 2] 需求分析 → 写入 prd/<项目名>.md
              ↓
[Step 3] 创建自定义页面 → openyida create-page    → 获得 formUuid（自定义页面）
              ↓
[Step 4]（按需）创建/更新表单 → openyida create-form → 获得 formUuid（表单）
              ↓
[Step 5]（按需，需求含「审批」「流程」「申请」「审核」「工单」等关键词时必须执行）
          配置流程 → 读取 skills/yida-create-process/SKILL.md → openyida create-process / configure-process
              ↓
[Step 6] 编写自定义页面代码 → yida-custom-page 规范 → pages/src/<项目名>.oyd.jsx
              ↓  openyida check-page / compile 预检（.oyd.jsx 自动兼容构建）
              ↓  （列表/表格类页面：参考 yida-density 技能选择合适的信息密度）
              ↓
[Step 7] 发布页面 → openyida publish <源文件路径> <appType> <formUuid> [--health-check]
              ↓
[Step 8] 输出访问链接，用系统浏览器打开
```

### 编写自定义页面代码前必须完整学习 `skills/yida-custom-page/SKILL.md`

### 生成表单 schema 前必须完整学习 `skills/yida-create-form-page/SKILL.md`

### 使用模板文件确保一次性成功

为避免生成错误代码，优先用 `openyida sample` 获取 CLI 内置模板，不要读取不存在的 `skills/*/templates` 路径：

| 技能 | 模板获取命令 | 用途 |
|------|---------|------|
| yida-custom-page | `openyida sample yida-custom-page custom-page-template` | 自定义页面完整模板 |
| yida-data-management | `openyida sample yida-data-management form-field-template` | 表单字段定义和数据插入 |
| yida-create-app | `openyida sample yida-create-app ipd-app-template` | 完整应用创建示例 |

表单详情页视觉优化不走 `openyida publish`。当用户要求“详情页美化 / formDetail 样式优化”时，读取 `skills/yida-form-detail/SKILL.md`，通过表单 Schema 注入 Html 组件承载 CSS。

**代码生成前必须**：

1. 执行对应的 `openyida sample` 命令生成模板
2. 以模板为基础进行扩展
3. 验证所有参数名称与 CLI 一致

---

## 关键决策树

### 决策 1：是否需要存储数据？

```
用户需求
    │
    ├── 纯展示 / 静态内容 → 跳过 Step 5（无需创建表单）
    │
    └── 需要收集 / 存储数据 → Step 5 创建表单
```

### 决策 2：是否需要审批流程？

```
表单创建后
    │
    ├── 无审批需求 → 直接进入 Step 6 编写代码
    │
    └── 有审批需求 → 调用 yida-create-process 配置流程后再编写代码
```

### 决策 3：是否需要数据可视化报表？

```
应用功能需求
    │
    ├── 标准统计报表 → 调用 yida-report 创建原生报表
    │
    └── 高级 ECharts 大屏 → 先 yida-report 创建数据源，再 yida-chart 创建可视化页面
```

### 决策 4：corpId 一致性检查（创建页面前必须执行）

```
读取 prd 文档中的 corpId vs 读取 .cache/cookies.json 中的 corpId
    │
    ├── 一致 → 继续创建页面
    │
    └── 不一致
        │
        ├── 用户选择"重新登录" → openyida logout → 重新扫码登录到正确组织
        │
        └── 用户选择"新建应用" → 回到 Step 1（会自动覆盖 prd 配置）
```

---

## 步骤详解

### Step 1：创建应用

调用 `yida-create-app` 技能，创建宜搭应用并获取 `appType`：

```bash
openyida create-app "<应用名称>" "[描述]"
```

**输出**：`appType`（如 `APP_XXXXXX`），自动写入 prd 文档的应用配置表。

> 📖 详见 [`skills/yida-create-app/SKILL.md`](../yida-create-app/SKILL.md)

---

### Step 2：需求分析 → 写入 prd 文档

深度分析用户需求，识别核心功能和隐含期望，将结果写入 `prd/<项目名>.md`。

**prd 文档结构**：

```markdown
# <项目名> 需求文档

## 应用配置

| 配置项 | 值 |
|--------|-----|
| appType | APP_XXXXXX |
| corpId | dingXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX |
| baseUrl | https://www.aliwork.com |

## 功能需求

（描述页面的核心功能、交互逻辑、业务规则）

## 页面与表单配置

### 用户信息表（表单页面）

| 字段名称 | 字段类型 | 说明 |
|---------|---------|------|
| 姓名 | TextField / 单行文本 | 必填 |
| 部门 | SelectField / 下拉单选 | 必填，选项：技术部、产品部、运营部 |
| 备注 | TextareaField / 多行文本 | 选填 |

### 首页（自定义页面）

展示用户信息列表，支持搜索和分页。

## UI 设计

（描述页面风格、布局、响应式要求）
```

> ⚠️ **重要约定**：
> - prd 文档只记录**业务语义信息**（字段名称、类型、说明），**不记录** `formUuid`、`fieldId` 等 Schema ID
> - Schema ID 统一写入 `.cache/<项目名>-schema.json`，供编码时读取
> - 每次创建或修改表单/页面后，必须同步更新 prd 文档

---

### Step 3：创建自定义页面

确认 corpId 一致后，调用 `yida-create-page` 技能：

```bash
openyida create-page <appType> "<页面名称>" [--mode dashboard]
```

**输出**：`formUuid`（如 `FORM-XXXXXX`），写入 `.cache/<项目名>-schema.json`。

> 📖 详见 [`skills/yida-create-page/SKILL.md`](../yida-create-page/SKILL.md)

---

### Step 4：创建表单（按需）

**当页面需要收集/存储数据时**，调用 `yida-create-form-page` 技能。

#### 4.1 定义字段，写入 `.cache/xxx-fields.json`

```json
[
  { "type": "TextField", "label": "词语", "required": true },
  { "type": "TextField", "label": "图片地址" },
  { "type": "TextField", "label": "用户ID" },
  { "type": "TextField", "label": "用户名" }
]
```

#### 4.2 创建表单

```bash
openyida create-form create <appType> "<表单名称>" .cache/xxx-fields.json
```

**输出**：`formUuid` 和各字段的 `fieldId`（如 `textField_xxxxxxxx`）。

#### 4.3 将 Schema ID 写入 `.cache/<项目名>-schema.json`

```json
{
  "appType": "APP_XXXXXX",
  "pages": {
    "图片生成表": {
      "formUuid": "FORM-XXXXXX",
      "fields": {
        "词语": "textField_xxxxxxxx",
        "图片地址": "textField_xxxxxxxx",
        "用户ID": "textField_xxxxxxxx",
        "用户名": "textField_xxxxxxxx"
      }
    },
    "首页": {
      "formUuid": "FORM-XXXXXX"
    }
  }
}
```

> 📖 详见 [`skills/yida-create-form-page/SKILL.md`](../yida-create-form-page/SKILL.md)

---

### Step 5：配置流程（按需）

**当需求含「审批」「流程」「申请」「审核」「工单」等关键词时必须执行**。

```bash
openyida create-process <appType> --formUuid <formUuid> <流程定义文件>
```

> 📖 详见 [`skills/yida-create-process/SKILL.md`](../yida-create-process/SKILL.md)

---

### Step 6：编写自定义页面代码

**编写前必须**：
1. 完整读取 [`skills/yida-custom-page/SKILL.md`](../yida-custom-page/SKILL.md)
2. 执行 `openyida sample yida-custom-page custom-page-template` 获取模板，再用 `read_file` 读取 `.cache/samples/custom-page-template.js`
3. 读取 prd 文档和 `.cache/<项目名>-schema.json` 获取所有 ID

**代码文件路径**：`pages/src/<项目名>.oyd.jsx`

**核心规范**：
- 使用 `export function` 导出函数（`didMount`、`didUnmount`、`renderJsx` 三个必须导出）
- `renderJsx` 顶部定义 `var self = this`，事件绑定统一写 `(e) => { self.xxx(e); }`，禁止直接 `onClick={this.xxx}` 或 `.bind(this)`
- `renderJsx` 每个 return 分支都必须有隐藏 timestamp 节点；`.oyd.jsx` 构建会自动补齐，但模板里仍建议显式保留
- 工作台/看板默认要有空态或演示数据兜底，接口失败时把 `loading` 置回 `false`，避免首屏永久显示加载文案
- 状态管理使用 `_customState` + `setCustomState`
- 输入框使用非受控组件（`defaultValue` 而非 `value`）
- 所有样式通过内联 `style` 对象定义
- 列表/表格类页面：参考 `yida-density` 技能选择合适的信息密度

**预检命令**：

```bash
openyida check-page pages/src/<项目名>.oyd.jsx
openyida compile pages/src/<项目名>.oyd.jsx
```

> 📖 详见 [`skills/yida-custom-page/SKILL.md`](../yida-custom-page/SKILL.md)

---

### Step 7：发布页面

调用 `yida-publish-page` 技能，将源码编译并部署到宜搭平台：

```bash
openyida publish <源文件路径> <appType> <formUuid> [--health-check]
```

**发布流程**：Babel 编译 JSX → ES5 → UglifyJS 压缩 → 调用 `saveFormSchema` 保存 Schema

> 📖 详见 [`skills/yida-publish-page/SKILL.md`](../yida-publish-page/SKILL.md)

---

### Step 8：输出访问链接并用系统浏览器打开

访问地址格式参考文档末尾 [「宜搭应用 URL 规则」](#宜搭应用-url-规则) 章节。

## 数据流转说明

各步骤产出的关键数据，是后续步骤的输入：

| 步骤 | 产出 | 用途 |
|------|------|------|
| create-app | `appType` | 所有后续命令的必填参数 |
| create-page | `pageId` (即 `formUuid`) | 发布自定义页面时指定目标页面 |
| create-form | `formUuid` + `fieldId` | 自定义页面代码中调用表单 API |
| get-schema | `fieldId` 列表 | 公式字段、权限配置、数据查询时引用 |

**存储约定**：
- **业务语义信息**（应用名、页面名、字段名、字段类型）→ `prd/<项目名>.md`
- **Schema ID**（`appType`、`formUuid`、`fieldId`）→ `.cache/<项目名>-schema.json`

**测试数据/修数脚本约定**：
- 一次性造数、旧数据修正、字段迁移可以使用 Python 或 JS，选择更快更清晰的实现即可；不要求为了“宜搭”强行写 JS。
- 脚本放在 `.cache/` 下，执行前先 `openyida get-schema` / `openyida data query` 确认字段和记录，批量更新单次不超过 30 条。
- 脚本可以通过 `openyida data ...` 命令或宜搭官方接口执行，但字段 ID、formInstId、appType 必须来自真实查询结果，不能猜。

---

## 典型场景示例

### 场景 1：一句话生成应用（如"生日祝福小游戏"）

```
1. yida-create-app → 创建应用，获取 appType
2. 需求分析 → 写入 prd/birthday-game.md
3. yida-create-page → 创建自定义页面，获取 pageId
4. yida-create-form-page → 创建祝福记录表单，获取 formUuid + fieldId
5. yida-custom-page → 编写游戏页面代码
6. yida-publish-page → 发布，输出访问链接
```

### 场景 2：带审批的 CRM 系统

```
1. yida-create-app → 创建 CRM 应用
2. 需求分析 → 写入 prd/crm.md
3. yida-create-form-page → 创建客户信息表、跟进记录表
4. yida-create-process → 配置客户审批流程
5. yida-report → 创建销售数据报表
6. yida-create-page → 创建 CRM 首页
7. yida-custom-page → 编写首页代码（集成表单 + 报表）
8. yida-publish-page → 发布
```

### 场景 3：数据大屏（ECharts 可视化）

```
1. yida-create-app → 创建应用
2. yida-create-form-page → 创建数据录入表单
3. yida-report → 创建原生报表（作为 ECharts 数据源）
4. yida-chart → 创建 ECharts 自定义页面（引用原生报表数据）
5. yida-publish-page → 发布
```

---

## 宜搭应用 URL 规则

| 页面类型 | URL 格式 |
|---------|---------|
| 应用首页 | `{base_url}/{appType}/workbench` |
| 表单提交页 | `{base_url}/{appType}/submission/{formUuid}` |
| 自定义页面 | `{base_url}/{appType}/custom/{formUuid}` |
| 自定义页面（隐藏导航） | `{base_url}/{appType}/custom/{formUuid}?isRenderNav=false` |
| 表单详情页 | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}` |
| 表单详情页（编辑模式） | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&mode=edit` |

> 💡 所有地址拼接 `&corpid={corpId}` 后可自动切换到对应组织，建议首页加上。

---

## 删除应用（危险操作）

> ⚠️ **删除应用不可逆**，将永久清除该应用下的所有表单、页面、数据记录，无法恢复。

**执行前必须完成以下确认流程，缺一不可：**

1. 向用户展示操作摘要：
   ```
   ⚠️ 即将删除应用
   应用名称：<appName>
   应用 ID：<appType>
   影响范围：该应用下的所有表单、页面、数据将被永久删除，不可恢复。
   请回复「确认删除」继续，或回复「取消」中止操作。
   ```
2. **等待用户明确回复**（必须包含"确认"或"确认删除"等明确同意词）
3. 用户确认后才可执行删除命令

**若用户未明确确认，或回复模糊（如"好的"、"嗯"、"可以"），必须再次询问确认，不得执行删除。**

---

## 异常处理

| 异常场景 | 处理方式 |
|---------|----------|
| 用户要求删除应用 | 必须先展示操作摘要并等待用户明确确认，禁止直接执行（详见上方「删除应用」章节） |
| 发布时提示登录失效 | 执行 `openyida logout`，再重新执行 `openyida publish`（会自动触发扫码登录） |
| 一直登录失败 | 不要自主尝试其他登录方案，直接提示登录失败，请联系开发同学 @天晟 |
| corpId 不一致（发布到错误组织） | 执行决策 4 流程：询问用户选择"重新登录"或"新建应用"，不得强行发布 |
| 表单字段 ID 不知道 | 使用 `yida-get-schema` 技能获取表单 Schema，从中读取各字段的 `fieldId` |
| 页面代码更新后需要重新发布 | 直接重新执行 `yida-publish-page` 命令，会覆盖已有 Schema |
| Babel 编译失败 | 检查 JSX 语法；现代 React authoring 源码应使用 `.oyd.jsx` 并通过 OpenYida 兼容编译，参考 `yida-custom-page` 规范 |
| 创建应用/表单返回错误 | 检查 `appType` 是否有效，确认登录态正常（`openyida env`），不要编造任何 ID |
