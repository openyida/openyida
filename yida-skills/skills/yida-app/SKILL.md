---
name: yida-app
description: 宜搭完整应用开发技能，描述从零到一搭建一个完整宜搭应用的全流程，包括创建应用、创建页面、需求分析、编写代码、创建表单、发布部署。
license: MIT
compatibility:
  - opencode
  - claude-code
metadata:
  audience: developers
  workflow: yida-full-workflow
  version: 1.0.0
  tags:
    - yida
    - low-code
    - workflow
---

# 宜搭完整应用开发技能

## 概述

本技能描述如何从零到一完整搭建一个宜搭应用，涵盖从应用创建到代码发布的全流程。每个步骤均依赖对应的子技能完成。

## 何时使用

当以下场景发生时使用此技能：
- 用户想要一句话生成完整的宜搭应用
- 用户需要从头开始开发一个宜搭应用
- 用户不了解宜搭开发流程，需要完整指导
- 进行完整的宜搭应用开发项目

## 使用示例

### 示例 1：一句话生成应用
**场景**：用户说"帮我搭建一个生日祝福小游戏"
**流程**：
1. 调用 yida-create-app 创建应用
2. 需求分析，写入 prd 文档
3. 调用 yida-create-page 创建自定义页面
4. 如需存储数据，调用 yida-create-form-page 创建表单
5. 调用 yida-custom-page 编写自定义页面代码
6. 调用 yida-publish-page 发布自定义页面

---

## 完整开发流程

```
创建应用
    ↓
需求分析 → 创建 prd 文档（prd/<项目名>.md）
    ↓
创建自定义页面
    ↓
（如需存储数据）创建表单 → 将字段描述信息写入 prd 文档
    ↓
调用 yida-custom-page 技能编写页面代码（src/<name>.js）
    ↓
自动调用 yida-publish-page 技能发布代码
```

> 💡 **登录态说明**：各脚本会自动读取项目根目录的 `.cache/cookies.json`，无需手动执行登录命令。首次运行或 Cookie 失效时，脚本会自动打开浏览器引导扫码登录。

---

## 步骤详解

### ⚠️ 前置强制规则（必须遵守）

在开始任何宜搭应用开发前，**必须先执行以下检查**：

#### ⚠️ corpId 一致性检查（关键步骤）

在执行创建页面前，**必须检查 prd 文档中的 corpId 与当前登录态的 corpId 是否一致**：

1. **读取 prd 文档中的应用配置**，获取已记录的 `corpId`
2. **读取 `.cache/cookies.json`**，获取当前登录态的 `corpId`
3. **对比两个 corpId**：
   - **如果一致**：继续执行创建页面
   - **如果不一致或 prd 中无 corpId**：提示用户选择处理方式

**corpId 不一致时的处理选项**：

| 场景 | 建议操作 |
| --- | --- |
| prd 中有 corpId，但与当前登录态不一致 | **询问用户**：是重新登录到 prd 中的组织，还是在当前组织新建应用？ |
| prd 中无 corpId | 直接新建应用 |

**决策流程**：
```
检查 prd.corpId vs Cookie.corpId
    │
    ├── 一致 → 继续创建页面
    │
    └── 不一致
        │
        ├── 用户选择"重新登录" → 执行 yida-logout → 重新扫码登录到正确组织
        │
        └── 用户选择"新建应用" → 回到 Step 1 创建新应用（会自动覆盖 prd 配置）
```

### Step 1：创建应用

调用 `yida-create-app` 技能创建宜搭应用，获取 `appType`。

```bash
openyida create-app "<应用名称>" "[描述]"
```

**输出**：`appType`（如 `APP_XXXXXX`），用 markdown 记录到 prd 文件夹下文档备用。

> 详见 `yida-create-app` 技能文档。

---

### Step 2：创建自定义页面

#### 创建页面命令

确认 corpId 一致后，调用 `yida-create-page` 技能：

```bash
openyida create-page "<appType>" "<页面名称>"
```

**输出**：`pageId`（如 `FORM-XXXXXX`），记录到 prd 文档备用。

> 详见 `yida-create-page` 技能文档。

---

### Step 3：需求分析 → 写入 prd 文档

将分析的需求文档结果写入 `prd/<项目名>.md`：

**prd 文档应包含以下内容**：

```markdown
# <项目名> 需求文档

## 应用配置

| 配置项 | 值 |
| --- | --- |
| appType | APP_XXXXXX |
| corpId | dingXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX |
| baseUrl | https://ding.aliwork.com |

> 💡 **提示**：
> - `corpId` 由 `openyida create-app` 自动写入，用于组织一致性校验
> - 如果登录态变更或创建新应用，`openyida create-app` 会自动更新本表格

## 功能需求
- 描述页面的核心功能、交互逻辑、业务规则
- 深度分析需求，并且识别核心功能 和 隐含期望，体现应用的潜在价值
- 应用RD文档需要与上述步骤紧密相关，按照步骤产出详细功能说明
- 表单字段设计需要优先满足用户指定需要的字段，再根据实际使用场景进行字段的合理扩充，以更好的满足实际场景表单对于数据的收集，发挥表单数据的价值挖掘，同时避免字段冗余
- PRD 不要包含测试、发布、推广等其他内容，不要包含 PRD 文件头、文件尾等，直接输出核心内容

## 页面与表单配置

（记录每个页面/表单的名称、类型和字段信息，见 Step 5）

格式示例：

### 用户信息表（表单页面）

| 字段名称 | 字段类型 | 说明 |
| --- | --- | --- |
| 姓名 | TextField / 单行文本 | 必填 |
| 部门 | SelectField / 下拉单选 | 必填，选项：技术部、产品部、运营部 |
| 备注 | TextareaField / 多行文本 | 选填 |

### 首页（自定义页面）

展示用户信息列表，支持搜索和分页。

## UI 设计

（描述页面风格、布局、响应式要求）
```

> **重要**：
> - prd 文档只记录**业务语义信息**（应用名称、页面名称、页面类型、字段名称、字段类型、字段说明），**不记录** `formUuid`、`fieldId` 等 Schema 中的具体 ID 值
> - Schema ID（`formUuid`、`fieldId` 等）写入 `.cache/<项目名>-schema.json` 临时文件，供编码时读取，**注意不要写在系统的其他文件夹中**
> - **每次创建或修改表单/自定义页面后，必须同步更新 prd 文档中对应的页面/字段信息**

---

### Step 5：创建表单（按需）

**当页面需要存储数据时**，调用 `yida-create-form-page` 技能创建表单页面。

#### 5.1 定义字段

将字段定义写入 `prd/<项目名>-pageName-field.md`

```json
[
  { "type": "TextField", "label": "词语", "required": true },
  { "type": "TextField", "label": "图片地址" },
  { "type": "TextField", "label": "用户ID" },
  { "type": "TextField", "label": "用户名" }
]
```

#### 5.2 创建表单

```bash
openyida create-form create "<appType>" "<表单名称>" .cache/fields.json
```

**输出**：`formUuid` 和各字段的 `fieldId`（如 `textField_xxxxxxxx`）。

#### 5.3 将表单信息写入 prd 文档和 .cache 临时文件

**写入 prd 文档**（只记录业务语义信息，不记录 Schema ID）：

```markdown
## 页面与表单配置

### 图片生成表（表单页面）

| 字段名称 | 字段类型 | 说明 |
| --- | --- | --- |
| 词语 | TextField / 单行文本 | 必填 |
| 图片地址 | TextField / 单行文本 | 选填 |
| 用户ID | TextField / 单行文本 | 系统字段，自动填充 |
| 用户名 | TextField / 单行文本 | 系统字段，自动填充 |

### 首页（自定义页面）

展示图片生成结果，支持关键词搜索。
```

**写入 `.cache/<项目名>-schema.json`**（记录 Schema ID，供编码时读取）：

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

> ⚠️ **重要**：每次创建或修改表单/自定义页面后，必须同步更新：
> 1. **prd 文档**：更新对应页面/表单的字段名称、类型、说明
> 2. **`.cache/<项目名>-schema.json`**：更新对应的 `formUuid` 和 `fieldId`

> 详见 `yida-create-form-page` 技能文档。

---

### Step 6：编写页面代码

调用 `yida` 技能，根据 prd 文档中的需求和配置信息编写自定义页面代码。

**编写前必读 prd 文档**，从中获取：
- `appType`、`formUuid`（自定义页面）
- 各表单的 `formUuid` 和字段 ID
- 功能需求和 UI 设计要求

**代码文件命名规范**：`pages/src/<项目名>.js`

**核心规范**（详见 `yida-custom-page` 技能文档）：
- 使用 `export function` 导出函数
- 状态管理使用 `_customState` + `setCustomState`
- 必须包含 `didMount`、`didUnmount`、`renderJsx` 三个导出函数
- 输入框使用非受控组件（`defaultValue` 而非 `value`）
- 所有样式通过内联 `style` 对象定义

> 详见 `yida-custom-page` 技能文档。

---

### Step 7：发布代码

调用 `yida-publish-page` 技能，将源码编译并部署到宜搭平台。

```bash
openyida publish <源文件路径> <appType> <formUuid>
```

**示例**：

```bash
openyida publish pages/src/xxx.js APP_XXX FORM-XXXXXX
```

**发布流程**：
1. Babel 编译 JSX → ES5
2. UglifyJS 压缩
3. 动态构建 Schema JSON
4. 读取 `.cache/cookies.json` 获取登录态（若不存在或接口返回 302，自动触发扫码登录）
5. 调用 `saveFormSchema` 接口保存 Schema

> 详见 `yida-publish-page` 技能文档。

---

### Step 7：输出访问链接并直接使用系统浏览器打开
* 访问地址参考「宜搭应用 url 规则说明」

## 快速参考

### 子技能一览

| 技能 | 用途 | 调用时机 |
| --- | --- | --- |
| `yida-login` | 登录态管理 | 接口返回 302 时自动触发（无需手动调用） |
| `yida-logout` | 退出登录 | 需要切换账号或 Cookie 失效时 |
| `yida-create-app` | 创建应用 | Step 1，获取 appType |
| `yida-create-page` | 创建自定义页面 | Step 2，获取 pageId |
| `yida-create-form-page` | 创建表单页面并构建 Schema，然后直接发布到宜搭 | Step 5，需要存储数据时 |
| `yida-get-schema` | 获取表单 Schema | 需要分析已有表单字段结构时 |
| `yida-custom-page` | 编写自定义页面代码 | Step 6，核心开发自定义页面代码 |
| `yida-publish-page` | 编译并发布自定义页面代码 | Step 7，发布自定义页面到宜搭 |

### 关键配置速查

配置信息分两处存储，各司其职：

| 信息类型 | 存储位置 | 示例 |
| --- | --- | --- |
| 应用名称、页面名称、页面类型、字段名称、字段类型、字段说明 | `prd/<项目名>.md` | 姓名、TextField / 单行文本、必填 |
| `appType`、`formUuid`、`fieldId` 等 Schema ID | `.cache/<项目名>-schema.json` | `"姓名": "textField_xxxxxxxx"` |

编码时从 `.cache/<项目名>-schema.json` 读取 Schema ID，无需重复查询接口。

### 宜搭应用 URL 规则说明

| 页面类型 | URL 格式 | 说明 |
|---------|---------|------|
| **应用首页** | `{base_url}/{appType}/workbench` | 标准的应用首页 |
| **表单提交页** | `{base_url}/{appType}/submission/{formUuid}` | 可用于自定义页面用 iframe 嵌入表单或直接跳转使用表单 |
| **自定义页面** | `{base_url}/{appType}/custom/{formUuid}` | 自定义页面 |
| **自定义页面（隐藏导航）** | `{base_url}/{appType}/custom/{formUuid}?isRenderNav=false` | 可用于自定义页面作为首页，不希望展示导航信息 |
| **表单详情页面** | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}` | 可用于自定义页面用 iframe 嵌入表单详情页或直接跳转查看详情 |
| **表单详情页面（自动开启编辑状态）** | `{base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&mode=edit` | 可以直接开启表单编辑状态 |

> 💡 **提示**：所有地址上拼接 `&corpid={corpId}` 后可以自动切换到对应的组织，建议首页加上 `&corpid={corpId}`

### 常见问题

**Q：发布时提示登录失效怎么办？**
A：使用 `openyida logout` 清空 Cookie 缓存，再重新执行发布命令，会自动触发扫码登录。

```bash
openyida logout
openyida publish ...
```

**Q：一直登录失败怎么办？**
A：不需要自主尝试其他登录方案，直接提示登录失败，请联系开发同学@天晟。

**Q：如何查看已有表单的字段 ID？**
A：使用 `get-schema` 技能获取表单 Schema，从中读取各字段的 `fieldId`。

**Q：页面代码更新后如何重新发布？**
A：直接重新执行 `yida-publish` 命令即可，会覆盖已有 Schema。

---

## 文件结构约定

```
项目根目录/
├── README.md                # 用来判断根目录路径，必须存在
├── config.json              # 全局配置（loginUrl、defaultBaseUrl）
├── .cache/
│   └── cookies.json         # 登录态缓存和其他临时文件（运行时自动生成）
├── pages/src/
│   └── <项目名>.js          # 自定义页面源码
├── pages/dist/
│   └── <项目名>.js          # 自定义页面编译后的代码
├── prd/
│   └── <项目名>.md          # 需求文档（含所有配置信息）
└── .claude/
    └── skills/              # 各子技能目录
```

> - **临时文件写在当前工程根目录的 .cache 文件夹中，如果没有就创建一个文件夹，注意不要写在系统的其他文件夹中**
