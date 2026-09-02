---
name: yida-form-detail
description: >
  表单页视觉引导与 formDetail 主题适配。表单开发默认用 Divider 进行语义分组；运行容器在表单、提交页、详情页和表单 iframe 中加载同一应用级自定义主题 CSS。
license: MIT
compatibility:
  - opencode
  - claude-code
  - qoder
metadata:
  audience: developers
  workflow: yida-development
  version: 1.5.0
  tags:
    - yida
    - low-code
    - form-detail
    - visual-guidance
---

# 宜搭表单页视觉引导与主题适配

## 目标

- 表单字段按真实填写路径分组，每个语义分组以 `Divider` 开始。
- 普通表单、流程表单、提交页、formDetail 和自定义页面消费同一份应用主题 CSS。
- 自定义主题通过 `openyida update-app <appType> --theme-file <file.css> --nav-theme <light|dark|white|gray> --logo-source <appIcon|customImage> --layout <side|top|l_shape>` 联合保存，主色由 CSS 的 `--color-brand1-6` 自动派生。
- 运行容器在表单、提交页、formDetail、自定义页面和 `FormOpenContainer` iframe 中加载同一应用主题文件。

## 何时使用

- 创建或更新普通表单、流程表单。
- 设计字段分组、填写密度、局部多列布局。
- 用户要求优化 formDetail 或保持表单与应用主题一致。

## 不要这样做

- 不要通过表单级 CLI 为单张表单重复配置主题或详情样式。
- 不要用 `RichTextField`、`GroupContainer` 或 `PageSection` 承载普通业务分组。
- 不要编造 `appType`、`formUuid` 或 `fieldId`。

## 表单视觉引导

交给 `yida-create-form-page` 前先输出：

```markdown
### 【表单视觉引导】
- 表单场景：<普通表单 / 流程表单 / 数据维护表 / 申请表>
- 填写路径：<用户按什么顺序完成填写>
- 分组结构：<每个分组名称；每组开头必须用 Divider，包括第一组>
- Divider 策略：<默认 bold-with-thin；同一张表单保持同一 dividerType>
- 字段密度：<单列为主；短字段成对时局部 ColumnContainer>
- 主题策略：<表单与 formDetail 由运行容器加载同一应用自定义主题 CSS>
```

## 落地方案

1. 读取 `prd/<项目名>/prd.md` 中的表单业务目标、填写路径和字段语义。
2. 读取 `prd/<项目名>/design.md` 中的主题、密度、Divider 和详情页语义 token。
3. 使用 `yida-create-form-page` 写入字段 JSON；表单 Schema 只承载业务字段、布局和业务动作。
4. 将定制主题 token 写入 `yida-design/references/theme/app-custom-theme-template.css` 的项目副本。
5. 执行 `openyida update-app <appType> --theme-file <file.css> --nav-theme <light|dark|white|gray> --logo-source <appIcon|customImage> --layout <side|top|l_shape>`，由服务端在所有运行页加载该 CSS。

## 决策规则

- 新建、更新和流程表单统一使用应用级主题文件。
- 用户要求调整品牌色、圆角、卡片、字段预览或 formDetail 时，修改应用主题 CSS 的对应语义 token，再重新执行 `update-app --theme-file`。
- 自定义页面和其中的表单 iframe 由运行容器分别加载同一应用主题文件，主题变量保持一致。
