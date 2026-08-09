---
name: yida-custom-page
description: 普通自定义页面 JSX/Jsx 维护。只用于修改已确认的存量普通 JSX/Jsx 页面。
---

# 自定义页面开发

> **先确认链路**：本技能只服务已确认的存量普通 JSX/Jsx 页面修改。新建自定义页面使用 `yida-canvas-custom-page`，发布为 `YidaCodeCanvas`。已有普通自定义页面升级到 Code Canvas 时使用 `yida-canvas-upgrade`。

## Resource-First 页面开发

编写页面源码前，先按根技能解析目标 app/page/form context：

- 已有页面 URL、display `formUuid`、bound page 或 workspace cache/config 中可确认的自定义页面时，先读取页面 Schema 或源码证据。确认目标是非 Code Canvas 的 `Jsx` / `renderJsx` 页面后，用本技能修改源码并交给 `yida-publish-page` 发布。
- 目标页面是 `YidaCodeCanvas` 时，改用 `yida-canvas-custom-page`。
- bound page 只是默认页面，不是锁定目标；如果当前会话绑定页面 A，但用户本轮明确说要修改页面 B，先解析 B 的 URL / display `formUuid` / 页面名称。B 能唯一解析时改 B；B 无法唯一解析时询问用户；禁止静默把需求发布到 A。
- 完整应用统一编排的新建页面使用 Code Canvas；缺少主入口 display page 时创建页面容器后交给 `yida-canvas-custom-page`。
- 用户只说“优化这个页面 URL / 修改现有页面 / 重新发布”时，本技能与 `yida-publish-page` 配合即可完成，不创建 app/page。
- 如果用户给的是普通表单 `formUuid`，页面源码只能把它作为数据源或入口链接使用；不能把数据表单 ID 当作发布目标。
- 页面源码路径按 Bash cwd 选择：从仓库根执行命令时用 `project/pages/src/...`；如果 cwd 已是 `<workspace>/project`，用 `pages/src/...`，不要写成 `project/pages/src/...`。

## 核心规则

1. **只维护存量普通页**：目标必须已确认是非 Code Canvas 的 `Jsx` / `renderJsx` 页面。新建页面用 `yida-canvas-custom-page`。
2. **源码格式按普通页**：源码使用 `.oyd.jsx` / `.jsx`，普通页运行时、`export function`、事件绑定、状态、URL、`FormOpenContainer` 和文案规则见 `coding-guide.md`。
3. **复杂组件看 reference**：表单类 JSX 控件、筛选栏、表格、成员和附件写法见 `component-jsx-guide.md`。
4. **样式只落地设计结果**：普通 JSX 样式落地见 `design-system.md`；图标和素材规则见 `assets-guide.md`。
5. **数据源不编造**：不得在已有普通页面里新增 `this.dataSourceMap.<name>.load()`，除非本轮已通过 `yida-data-source-connectors` 创建并绑定该数据源。
6. **发布闭环**：修改普通页面源码后，先执行 `openyida check-page <file>` 和 `openyida compile <file>`；final 前必须看到成功的 `openyida publish <source> <appType> <displayPageFormUuid>`。`check-page` / `compile` 只证明源码可发布，不等于远端页面已更新；没有 publish 成功证据时，final 只能说明“源码已修改，尚未发布”。

## 适用场景
已有普通自定义页面、已有 JSX 页面、已有 `renderJsx` 页面、已有 `dataSourceMap` 页面维护。

## 快速开始

下面命令以仓库根为视角；如果当前 cwd 已经是 `<workspace>/project`，把 `project/pages/src/...` 改成 `pages/src/...`。

1. 获取表单 Schema，确认字段 ID：

```bash
openyida get-schema APP_XXX FORM-EMPLOYEE
```

如需保存完整 Schema，使用 create_file / Write / file edit tool 创建 `<projectRoot>/.cache/openyida/employee-query/employee-schema.json`；ID 映射仍写 `<projectRoot>/.cache/employee-query-schema.json`。

```bash
# Step 2：确认或补齐自定义页面发布目标
# 已有页面 URL / display formUuid 时直接复用该 formUuid，例如 FORM-QUERY001。
# 页面缺失时停止本技能，改用 yida-create-page + yida-canvas-custom-page 新建 Code Canvas 页面。

# Step 3：编写普通自定义页面 JSX 代码
# 在 project/pages/src/employee-query.oyd.jsx 中编写；Code Canvas 页面使用 yida-canvas-custom-page / .canvas.jsx

# Step 4：本地规范检查 + 编译校验（不发布）
openyida check-page project/pages/src/employee-query.oyd.jsx
openyida compile project/pages/src/employee-query.oyd.jsx

# Step 5：发布页面
openyida publish project/pages/src/employee-query.oyd.jsx APP_XXX FORM-QUERY001
```

详细写法只在需要时读取：

| 文档 | 何时读 |
| --- | --- |
| [coding-guide.md](references/coding-guide.md) | 写普通 JSX、修 check-page、处理状态/事件/URL/FormOpenContainer |
| [runtime-guardrails.md](references/runtime-guardrails.md) | check-page 报错、兼容层或运行时异常 |
| [component-jsx-guide.md](references/component-jsx-guide.md) | 表单控件、筛选栏、表格、成员或附件 |
| [design-system.md](references/design-system.md) | 把 `design.md` 落到普通 JSX 样式 |
| [assets-guide.md](references/assets-guide.md) | 图标、素材和 emoji 替换规则 |
| [yida-api.md](../../references/yida-api.md) | API 参数不确定时读，不猜参数 |

`page-spec.json`、接口调试 JSON 和一次性验证脚本先用 create_file / Write / file edit tool 创建到 `<projectRoot>/.cache/openyida/<项目名或任务名>/`。

## 常见场景示例

- 自定义页面附件上传：见 [AttachmentField 上传指南](references/attachment-upload-guide.md)
- 对应最小代码示例：见 [attachment-upload.js](examples/attachment-upload.js)

## Available Files

| key | path | when |
|-----|------|------|
| `coding-guide` | `references/coding-guide.md` | check-page 报错、复杂交互、状态管理问题 |
| `runtime-guardrails` | `references/runtime-guardrails.md` | 页面运行时报错、check-page 规则不清、编译兼容边界不清 |
| `component-jsx-guide` | `references/component-jsx-guide.md` | 输入控件、日期、选择、成员/部门、附件、表格或筛选栏 |
| `design-system` | `references/design-system.md` | 普通 JSX 样式实现适配；消费 `yida-design` 输出的 `design.md` 时阅读 |
| `theme-runtime-helpers` | `../yida-canvas-custom-page/references/theme-runtime-helpers.md` | 维护旧源码主题同步问题 |
| `yida-api` | `../../references/yida-api.md` | 表单/流程/工具 API 完整参数 |

## 注意事项

- 本技能不读写 memory，所有页面状态（`_customState`）仅在当前页面会话内有效，刷新页面后重置，不跨会话持久化
