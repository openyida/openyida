# Step 4：生成交付产物并确认

`yida-app` 校验并生成方案后，实际提问确认。

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

CLI 校验后保存源计划、PRD、design、HTML 和主题 CSS。

执行 init 的 `materialize.command` 与 `materialize.shell`（Windows 用 PowerShell，其他用 POSIX）。`outputs.html` 是编辑稿；确认必须同时取得 `outputs.confirmationHtml` 和 revision，缺失时先重新生成，不回退编辑稿或伪造版本。revision 不向用户展示。直接维护 JSON 时先设 status=awaiting_confirmation 再 materialize；`--check` 仅诊断，不产生确认。片段职责见 [完整文件合并](../parallel-work.md#plan-的-cli-交接)。

HTML 四章与视觉展示遵守 [HTML 内容契约](../../../yida-design/sub_skill/yida-design-plan/assets/README.md#需求总览中的视觉信息)，业务与 PRD 一致。

校验失败时按返回的 `details.issues` 集中修正对应字段后重试。写入失败由 CLI 恢复旧文件；若恢复失败，保留报错给出的备份路径并处理恢复后再继续。

## 3. 展示并确认当前版本

按 [用户交互契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行：

1. 展示“当前方案”和 3–7 条业务摘要；导航归属随整体确认，不另设技术选型题。
2. 云端实际调用 `ask_human` 创建结构化提问；managed Local 使用下述 CLI 封装。遵守交互契约的唯一 payload schema，绑定当前快照与 revision，选项为 `confirm_build` 和 `continue_editing`。调用成功只表示问题已创建，收到匹配回答后才获批。
优先原样传入本次 materialize 或 patch --materialize 返回的 `confirmation`；同级 `confirmationPolicy` 是执行规则，不放入工具 payload。不要用 `fields` 包装最终选择，也不自行拼接附件路径。生成 JSON、打开 HTML、文字问“是否执行”均不等于实际调用。工具不可用或失败时保留 `awaiting_confirmation`，说明阻塞，不能直接开始搭建或切换 Fast。

3. 交互创建成功后写回 `meta.planState.presentedRevision=meta.revision`，不重复物化；queued/pending 仅表示等待。收到该次交互的 `confirm_build` 且回传 revision 匹配当前方案，才记录真实交互 ID、回答和时间，设置 `meta.status=confirmed`、`meta.planState.planConfirmed=true`、`meta.revision=presentedRevision=confirmedRevision`。无回答、超时、取消、旧版本回调和自行写入的状态都不能授权实施。

恢复时核验真实问答与当前方案，同版已有效确认则复用。主题、需求确认和泛指“继续”均不替代执行批准。获批后派发 `assetTasks` 并实施；`explicitScope.allowInferredResources=false` 仅执行范围内资源。

managed Local 将 `confirmation` 封装为以下问题 JSON 后交给 CLI：

```json
{"title":"确认搭建方案","revision":"<confirmation.revision>","attachments":[{"name":"搭建方案.html","path":"<outputs.confirmationHtml>"}],"questions":[{"id":"plan_decision","header":"搭建方案","question":"请确认当前搭建方案","type":"single_select","options":[{"label":"确认并开始搭建","value":"confirm_build"},{"label":"继续调整","value":"continue_editing"}]}]}
```

保存问题文件后执行 `openyida agent ask-human --request-key <本次确认的唯一稳定键> --questions-file <相对路径> --json`；queued 立即结束本轮。续接时核对 `contextRevision`、附件摘要及 `answers.plan_decision`，仅当前方案的 `confirm_build` 可继续。调整后重新物化并用新 key 提问，不重问业务需求。

## 4. 处理调整

修改已有方案时，从当前 `build-plan.json` 继续，只读本次涉及的字段和相关章节。已有具体修改要求就直接处理；只有用户选择 `continue_editing` 却没有说明改什么时，才在下一次交互收集修改内容。

1. 找到要改的源字段。业务内容由 `yida-prd` 维护，视觉内容由 `yida-design` 维护；只补读相关规则，不重走需求分析、主题选择或初始化。
2. 将本轮变更合在一次 `patch --materialize` 中。只提交变化的字段；页面任务改变时，同步该页的视觉说明和必要引用。
3. CLI 校验并更新变化的产物，`updated` 列出改动文件。用返回的 `confirmation` 按上节重新提问，不重复读取、生成或预检。

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

业务方案或视觉方案调整后，用最新 `confirmation` 重新实际调用 `ask_human` 并等待回答。素材到位、替换同用途图片或更新缺图状态属于实施进度，按 [素材交接](../../../yida-image-assets/SKILL.md#6-交给页面使用) 更新后直接继续。

本地校验失败统一按[本地校验修复](../../../../references/source-repair.md)处理：先修正并回读源文件，未变化不重跑，连续两次修复无进展时保留产物并报告阻塞。
