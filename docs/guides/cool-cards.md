# 宜搭原生酷卡片

原生酷卡片和原生数据卡片使用不同的资源与命令：

| 资源 | 命令 / Skill | 标识 | 支持范围 |
| --- | --- | --- | --- |
| 原生数据卡片 | `data-card` / `yida-data-card` | `CARD-...` | 创建、读取、配置保存、发布、投放播报 |
| 原生酷卡片 | `cool-card` / `yida-cool-card` | `cardPageCode`、`cardTemplateId` | 交互/置顶资源创建、配置读取、模板目录、管理入口 |
| 页面展示卡片 | 页面开发与发布 | 页面及组件 | 随 Canvas/React 页面维护 |

仅当用户明确选择相应原生能力时使用；泛称“卡片”“指标卡”“群通知”不会自动创建原生资源。`dataCardDesigner.html?cardCode=CARD-...` 是数据卡片设计器；酷卡片管理入口是 `coolCardManage`。

## 使用

```bash
openyida cool-card list APP_XXX --json
openyida cool-card templates APP_XXX --type im --json
openyida cool-card create APP_XXX --type im --name '订单交互卡片' --json
openyida cool-card create APP_XXX --type onebox --name '订单群置顶卡片' --json
openyida cool-card get APP_XXX form真实标识 --out cool-card-snapshot.json --json
openyida app-settings APP_XXX --section cool-card --json
```

`im` 表示交互卡片，`onebox` 表示置顶卡片。列表与模板目录支持 `--page`、`--size`、`--search`。模板目录只做查询，不会自动套用模板。导出文件不会覆盖已有内容。

读取保留完整原始配置，并解析组件类型、变量、编辑器数据及平台发布状态。`templateIdsMatch` 显示资源模板 ID 与配置内部模板 ID 是否相同，读取不擅自改写任一 ID。文件包含应用标识，不能传给数据卡片或页面的保存命令。

## 创建和配置是两个阶段

创建请求只包含卡片名称和类型，写请求不自动重试。CLI 先在管理列表中核对新资源，再读取模板。平台可以在资源创建后仍返回“卡片模板不存在”：此时输出 `completion=resource-only`、`readbackVerified=true`、`schemaReadbackVerified=false`，并保留 `schemaReadbackError` 的平台错误码和提示。它只代表资源元数据回读成功；不会捏造一个空模板，也不代表配置已经完成。后续读取同一卡片失败时保留原始失败，不自动再建一张。

## 打开官方入口配置保存

`create/get` 的 `nextAction.url` 是交给用户点击的入口，`verificationCommand` 是用户保存后回读配置的 CLI 命令：

- 新建卡片：打开对应官方编辑器，配置内容并点击“保存”。CLI 交付状态是“资源已创建，待用户配置保存”。没有适用的直接编辑器地址时，返回当前租户的管理入口。
- 已有卡片：打开酷卡片管理，找到目标卡片 → 编辑 → 配置 → 保存；平台会在编辑过程中处理模板版本。
- 保存后：运行 `openyida cool-card get APP_XXX form真实标识 --json` 查看组件、变量和平台状态。

链接不包含凭证，用户使用自己的平台登录态。CLI 不执行编辑器配置保存、模板套用、发布或发送，因此 `capabilities.save/publish/send=false`。编辑器“保存”对应 `build`，宜搭场景未启用通用发布按钮。配置回读成功不代表实际发送或客户端渲染已经验证。详见 [官方酷卡片设计文档](https://docs.aliwork.com/docs/yida_support/_9/tspkdk/pqnynb)。

## 权限与权益

两类原生卡片均服从各自的服务端权限和权益，不共享硬编码额度或角色判断。CLI 不修改版本、权益、额度、应用标记或官方卡片开关来绕过限制；平台拒绝时保留错误并停止。配置与实际消息发送分开，创建或读取不发送消息。

## 可选外部工具：钉钉 Workspace CLI

[dws](https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli#installation) 由钉钉独立提供，OpenYida 不内置、捆绑或自动安装它。需要钉钉 A2UI 编写、校验或消息操作时，可按官方说明安装，也可单独执行：

```bash
npm install -g dingtalk-workspace-cli
dws version
```

访问钉钉业务时使用 `dws auth login` 并核对目标组织与账号，命令能力以已安装版本的 `--help` 为准。仅使用当前 OpenYida 酷卡片命令及编辑器链接，无需安装 dws。

外部工具直接使用 `dws <command> [args]` 调用，升级与登录由 dws 独立管理。

宜搭资源通过当前 `cardTemplateId` 关联钉钉模板；dws 现有 A2UI 消息更新使用的是已发送卡片的 `bizId`，不能代替该模板的保存。当前仍由用户通过官方编辑器保存，OpenYida 回读验收；安装 dws 不会自动开启宜搭模板保存能力。

## 卡片设计与本地样例

先选业务匹配的原生模板，再组合头部、指标、标签、富文本、循环明细及折叠详情。默认突出结论和一个主操作，检查窄屏、桌面和深色效果；节点数量不作为视觉质量指标。变量类型、Mock 与真实动作的边界见 [设计指南](../../yida-skills/skills/yida-cool-card/references/design.md)。

`openyida sample yida-cool-card project-brief --var APP_URL=https://你的租户/真实应用ID --output .cache/cool-card/project-brief.json` 输出已实测结构的本地导入文件；修改演示数据后在官方编辑器导入并保存，再用 `cool-card get` 回读。该命令只写本地文件，未实现在线模板保存。
