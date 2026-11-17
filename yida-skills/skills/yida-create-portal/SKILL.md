---
name: yida-create-portal
description: 创建宜搭原生门户，配置磁贴、主题和双端布局。仅在用户明确要求原生门户、明确排除用自定义页面做门户或维护已有原生门户时使用。
---

# 宜搭原生门户

明确目标应用、页面名称和创建意图。先查询是否已有匹配的原生门户，已有目标时用 `portal inspect` 读取并复用。用户说“做一个门户”“创建首页”或“搭一个工作台”，以及明确要求用自定义页面实现门户时，走 `use_skill("yida-create-page", "创建自定义门户页面")` 和 Canvas 开发。

```bash
openyida create-portal <appType> "<pageName>" [--locale zh_CN|en_US|ja_JP] [--open|--no-open]
```

创建后回读 `formType=portal`，输出 `pageId`、`readbackVerified`、`designerUrl` 和 `workbenchUrl`。记录真实 `pageId`，在 `designerUrl` 编辑和发布。遇到 `CREATE_PAGE_PORTAL_NOT_VERIFIED` 时，使用输出的 `recovery` 核对已创建页面，避免重复新建。

按[原生门户组件与磁贴布局](references/native-portal.md)用 `portal catalog` 查可写字段，用 `portal inspect --editable` 读取配置和版本，再用 `portal configure` 保存磁贴、布局和主题。在设计器和工作台检查实际显示及权限。

### 主题与验收

用 `openyida app-theme snapshot <appType> --output-dir <new-dir> --json` 读取应用主题。磁贴支持「跟随主题」时使用该选项，保留已有门户的自定义值。按[布局与应用主题](references/native-portal.md#布局与应用主题)设计首屏，并在工作台分别核对 PC 和移动端的背景、对比度、顺序及链接。手机需要不同的任务优先级时，给 `portal configure` 提供 `mobileOrder`。指标卡在同一应用发布后再绑定。
