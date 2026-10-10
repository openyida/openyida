# Step 4：生成交付产物并确认

由 `yida-app` 校验业务/视觉输入、生成产物并确认当前版本。

## 1. 校验业务与视觉交接

核对范围、场景与设计引用；复用 init 的已确认视觉输入和 pageId/sceneKey。选择缺失、范围变化或特殊设计交给 [Plan 视觉分支](../../../yida-design/sub_skill/yida-design-plan/SKILL.md) 补齐，业务缺项交给 `yida-prd`。

## 2. 通过 CLI 生成产物

标准首版一次合并完整业务与已准备的视觉文件：

```bash
openyida design-plan materialize prd/<项目名>/build-plan.json \
  --business-file prd/<项目名>/business.json \
  --visual-file prd/<项目名>/visual.json --json
```

只有已使用按模块更新的草稿才执行：

```bash
openyida design-plan materialize prd/<项目名>/build-plan.json --from-preview --json
```

CLI 完整校验后一起保存源计划、`prd.md`、`design.md`、`build-plan.html` 和 `app-theme.css`。

执行 init 返回的 `materialize.command`，使用其 `materialize.shell`：Windows 为 PowerShell，其他平台为 POSIX shell。成功结果的 `outputs.html` 用于展示方案，`revision` 仅用于内部确认绑定，不透出给用户。片段职责见 [完整文件合并](../parallel-work.md#plan-的-cli-交接)。直接维护源 JSON 时先设 status=awaiting_confirmation，再运行 `openyida design-plan materialize prd/<项目名>/build-plan.json --json`；诊断加 `--check --json`，正常生成不重复预检。

HTML 使用预置模板，保留需求总览、数据模型、业务流程、页面规划四章；整体视觉在总览、逐页视觉在详情，业务与 PRD 一致。见 [HTML 内容契约](../../../yida-design/sub_skill/yida-design-plan/assets/README.md#需求总览中的视觉信息)。

校验失败时按返回的 `details.issues` 集中修正对应字段后重试。写入失败由 CLI 恢复旧文件；若恢复失败，保留报错给出的备份路径并处理恢复后再继续。

## 3. 展示并确认当前版本

按 [用户交互契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行：

1. 在会话中展示“当前方案”，并用 3–7 条业务摘要说明方案内容；有前后台时说明各入口导航归属，平台导航管理页只实现业务内容。导航随整体方案确认，不另设技术选型确认。
2. 实际调用 `ask_human` 创建结构化提问。调用对象严格采用交互契约中的唯一 payload schema；`attachments` 携带 `name: "build-plan.html"`、`path: "prd/<项目名>/build-plan.html"`，`revision` 使用当前 `meta.revision`，`options` 固定为 `confirm_build` 和 `continue_editing`。一次成功调用同时建立方案展示、版本绑定和最终选择。
最终确认直接使用如下顶层字段，不要再包装成 `fields` 问卷；`fields` 用于需求澄清或用户选择“继续调整”后的补充问题。

```json
{"question":"请确认当前搭建方案","options":[{"label":"确认并开始搭建","value":"confirm_build"},{"label":"继续调整","value":"continue_editing"}],"submitLabel":"提交选择","attachments":[{"name":"build-plan.html","path":"<outputs.html>"}],"revision":"<revision>"}
```

优先将本次 materialize 或 patch --materialize 返回的 `confirmation` 对象原样传给 ask_human，它已经绑定同调用附件、revision 和固定选项。旧 CLI 没有该字段时，才按上例用实际 `<outputs.html>` 和 `<revision>` 填写，禁止另造值或省略 options/attachments/revision。确认前不创建业务资源。

3. 结构化交互成功创建后将 `meta.planState.presentedRevision=meta.revision` 写回源 JSON，仅保存展示事实，不重新物化。询问“确认并开始搭建”或“继续调整”，提交时由宿主原样回传 revision，将确认结果绑定到本次展示版本。用户可见标题、摘要、附件名称与确认问题统一使用“搭建方案”或“当前方案”，不展示修订序号。内部 revision、展示记录和确认失效机制照常维护。

只有以下条件同时成立才交接；它们由本轮 ask_human 请求和回传在运行时判定，确认结果可保留在运行时，但展示版本必须写回源文件：

- `meta.status=confirmed`
- `meta.planState.planConfirmed=true`
- `meta.revision=presentedRevision=confirmedRevision`

收到 `confirm_build` 且回传 revision 与展示版本一致后，保存运行时确认并实施同版产物。按 `assetTasks` 派发素材任务、记录编号后继续创建资源和页面，见 [并行调度](../parallel-work.md#素材与页面同时推进)。素材进度沿用确认，业务/视觉变更按下节处理；`explicitScope.allowInferredResources=false` 只实施范围内资源，不改主题、应用设置或导航。

## 4. 处理调整

修改已有方案时，从当前 `build-plan.json` 继续，只读本次涉及的字段和相关章节。已有具体修改要求就直接处理；只有用户选择 `continue_editing` 却没有说明改什么时，才在下一次交互收集修改内容。

1. 找到要改的源字段。业务内容由 `yida-prd` 维护，视觉内容由 `yida-design` 维护；只补读相关规则，不重走需求分析、主题选择或初始化。
2. 将本轮变更合在一次 `patch --materialize` 中。只提交变化的字段；页面任务改变时，同步该页的视觉说明和必要引用。
3. CLI 校验后更新 PRD、design、Plan HTML 和主题 CSS 的变化部分，保留其他内容；`updated` 返回实际改动的文件。同一次执行中，CLI 复用相同输入的主题结果和校验结果；合并了本地文档修改时仍重新检查。成功后直接用 `outputs.html` 展示修改摘要和当前方案，不再全文读取、重复生成或预检。

例如，同时调整品牌色和圆角：

```bash
openyida design-plan patch prd/<项目名>/build-plan.json \
  --set 'visualStyle.forUser.colorStrategy.primaryColor=#6F4E37' \
  --set 'visualStyle.forUser.colorStrategy.primaryColorName=咖啡色' \
  --set 'visualStyle.tokens.--pod-card-border-radius=16px' \
  --materialize --json
```

首版从 1 开始，内部补全保持当前版；已展示方案实质变更升一版并清空确认，相同内容及素材进度不升版。可选字段与旧计划兼容规则见 [紧凑计划契约](../../../yida-design/sub_skill/yida-design-plan/references/build-plan-compact-schema.md#可选字段-patch-与完成校验)。

`build-plan.json` 是 Plan 的修改入口。固定标题和排版交给 CLI，不重写整份 `business.json`、`visual.json`、HTML 或 MD。主题文件使用 `outputs.theme` 的实际路径；已有 CSS 中的自定义样式会保留。CLI 自动维护同目录的 `.build-plan-artifacts.json` 作为上次生成记录，不手动修改它。若返回内容冲突，只读取报错文件的对应部分，将本地修改与源事实对齐后重试，不能删除记录或覆盖整份文件绕过冲突。

| 调整内容 | 负责技能与传播范围 |
| --- | --- |
| 字段、流程、资源或顺序 | `yida-prd` 更新相关业务事实与页面规划 |
| 页面核心任务、区块或首屏 | `yida-prd` 更新页面，随后 `yida-design` 同步视觉应用 |
| 主题、品牌色、圆角或阴影 | `yida-design` 更新视觉事实，保持业务范围、页面任务和操作优先级 |

业务方案或视觉方案调整后重新展示并确认当前版本。素材到位、替换同用途图片或更新缺图状态属于实施进度，按 [素材交接](../../../yida-image-assets/SKILL.md#6-交给页面使用) 更新后直接继续。

本地校验失败统一按[本地校验修复](../../../../references/source-repair.md)处理：先修正并回读源文件，未变化不重跑，连续两次修复无进展时保留产物并报告阻塞。
