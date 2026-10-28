# Step 4：生成交付产物并确认

`yida-app` 校验并生成方案后，实际提问确认。

## 1. 校验业务与视觉交接

复用 init 已确认的视觉输入和 pageId/sceneKey。缺失或变化交给 [Plan 视觉分支](../../../yida-design/sub_skill/yida-design-plan/SKILL.md) 补齐，业务缺项交给 `yida-prd`。

## 2. 通过 CLI 生成产物

首版合并业务与视觉文件：

```bash
openyida design-plan materialize prd/<项目名>/build-plan.json \
  --business-file prd/<项目名>/business.json \
  --visual-file prd/<项目名>/visual.json --json
```

按模块更新的草稿才执行：

```bash
openyida design-plan materialize prd/<项目名>/build-plan.json --from-preview --json
```

执行 init 的 `materialize.command/shell`；CLI 保存计划、PRD、design、HTML 和主题 CSS。

`outputs.html` 是编辑稿；确认只用 `outputs.confirmationHtml` 与 revision，缺失就重新生成，不回退编辑稿或伪造版本。revision 不对用户展示。直接改 JSON 时先设置 `status=awaiting_confirmation`；`--check` 仅诊断，不产生确认。合并职责见 [完整文件合并](../parallel-work.md#plan-的-cli-交接)，HTML 见 [内容契约](../../../yida-design/sub_skill/yida-design-plan/assets/README.md#需求总览中的视觉信息)。

校验失败按 `details.issues` 集中修正；写入失败由 CLI 恢复旧文件，恢复失败则保留备份并先处理恢复。

## 3. 展示并确认当前版本

按 [用户交互契约](../../../yida-design/references/ask-human-interaction-contract.md#搭建计划展示) 展示“当前方案”和 3–7 条业务摘要，随后实际发起结构化确认并等待回答。使用本次 CLI 返回的不可变快照与 revision；同级 `confirmationPolicy` 是规则，不放入工具 payload。

千问办公负责方案附件的展示。原样传递当前快照、revision 和结构化问题，不指定文件卡片样式或另行调用展示工具；展示不代表批准。

原样使用 `confirmation` 实际调用 `ask_human` 创建结构化提问，遵守唯一 payload schema。调用成功只表示问题已创建；managed Local 使用下述 CLI。不可用或失败时保留 `awaiting_confirmation` 并说明阻塞，不能开始搭建或切换 Fast。生成 JSON、打开 HTML、普通文字和泛指“继续”均不替代结构化批准。

交互创建后记录 `presentedRevision=meta.revision`，不重复物化。仅当前快照与 revision 对应的明确 `confirm_build` 可写入真实回答、交互 ID 和时间，并设置 confirmed 状态；queued/pending 仅表示等待；无回答、超时、取消、旧版本或自行写入的标记均无效。快照或方案变化后重新确认，恢复与素材进度中，同版已有效确认则复用。

managed Local 将 `confirmation` 封装为问题文件：

```json
{"title":"确认搭建方案","revision":"<confirmation.revision>","attachments":[{"name":"搭建方案.html","path":"<outputs.confirmationHtml>"}],"questions":[{"id":"plan_decision","header":"搭建方案","question":"请确认当前搭建方案","type":"single_select","options":[{"label":"确认并开始搭建","value":"confirm_build"},{"label":"继续调整","value":"continue_editing"}]}]}
```

执行 `openyida agent ask-human --request-key <本次确认的唯一稳定键> --questions-file <相对路径> --json`；queued 立即结束本轮。续接核对 `contextRevision`、附件摘要与 `answers.plan_decision`。调整后重新物化并用新 key 提问，不重问业务需求。获批后派发 `assetTasks` 并实施；`explicitScope.allowInferredResources=false` 仅执行范围内资源。

## 4. 处理调整

从当前 `build-plan.json` 读取本轮涉及的字段与章节。已有具体要求就直接修改；仅选择 `continue_editing` 而未说明内容时在下一次交互询问。业务由 `yida-prd` 维护，视觉由 `yida-design` 维护，不重走需求分析、主题选择或初始化。

将变化合在一次 `patch --materialize` 中；页面任务变化时同步视觉说明与引用。CLI 校验后返回 `updated` 和新 `confirmation`，按上节展示、提问并等待，不重复生成或预检。

例如，同时调整品牌色和圆角：

```bash
openyida design-plan patch prd/<项目名>/build-plan.json \
  --set 'visualStyle.forUser.colorStrategy.primaryColor=#6F4E37' \
  --set 'visualStyle.forUser.colorStrategy.primaryColorName=咖啡色' \
  --set 'visualStyle.tokens.--pod-card-border-radius=16px' \
  --materialize --json
```

已展示方案实质变化时升版并清空确认；同内容与素材进度不升版。可选字段见 [紧凑计划契约](../../../yida-design/sub_skill/yida-design-plan/references/build-plan-compact-schema.md#可选字段-patch-与完成校验)。

`build-plan.json` 是修改入口；固定标题与排版交给 CLI，不重写派生文件。主题使用 `outputs.theme`，已有自定义 CSS 保留。CLI 管理 `.build-plan-artifacts.json`：内容冲突时只读报错部分、对齐源事实后重试，不手改或删除记录绕过冲突。

业务变化交给 `yida-prd`，主题与视觉交给 `yida-design`；均按上节重新确认。素材到位与同用途替换属于实施进度，按 [素材交接](../../../yida-image-assets/SKILL.md#6-交给页面使用) 继续。

本地失败按 [修复规则](../../../../references/source-repair.md) 处理；不重试未变输入，连续两次无进展则保留产物并报告。
