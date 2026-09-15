# Step 4：生成交付产物并确认

输入为业务与视觉片段，或已整理完成的 `build-plan.json`。本步骤由 `yida-app` 校验交接、一次生成文件并确认当前版本。

## 1. 校验业务与视觉交接

核对范围、场景和设计引用。标准首版复用 init 预填的已确认视觉输入，页面沿用确认时的 pageId 与 sceneKey；仅视觉选择不完整、页面范围变化或存在特殊视觉要求时由 [Plan 视觉分支](../../../yida-design/sub_skill/yida-design-plan/SKILL.md) 补齐受影响记录，业务缺项交给 `yida-prd` 修正。

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

CLI 完整校验后一起保存源计划、`prd.md`、`design.md`、`build-plan.html` 和 `app-theme.css`。HTML 使用预置模板，业务内容与 PRD 一致。

标准首版的生成入口是 init 返回的 `materialize.command`。成功 JSON 中的 `outputs.html` 和 `revision` 直接构成下一步结构化确认的附件与版本输入。按模块更新过的草稿使用本节单列的 `--from-preview` 命令；诊断使用下方 `--check` 命令。

完整文件的职责与版本规则见 [完整文件合并](../parallel-work.md#plan-的-cli-交接)。直接维护源计划时先设 `meta.status=awaiting_confirmation`，再执行 `openyida design-plan materialize prd/<项目名>/build-plan.json --json`；仅做诊断时使用 `openyida design-plan materialize prd/<项目名>/build-plan.json --check --json`。正常生成已经包含完整校验，不先运行一次 --check 再重复生成。

HTML 保留“需求总览、数据模型、业务流程、页面规划”四章，完整展示用户需要确认的业务、视觉、数据、顺序和验收内容；整体视觉放在需求总览，逐页视觉放在页面详情。展示范围见 [HTML 内容契约](../../../yida-design/sub_skill/yida-design-plan/assets/README.md#需求总览中的视觉信息)，Markdown 供 Agent 执行。

校验失败时按返回的 `details.issues` 集中修正对应字段后重试。写入失败由 CLI 恢复旧文件；若恢复失败，保留报错给出的备份路径并处理恢复后再继续。

## 3. 展示并确认当前版本

按 [用户交互契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行：

1. 在会话中展示“当前这版方案”，并用 3–7 条业务摘要说明方案内容。
2. 实际调用 `ask_human` 创建结构化提问。调用对象严格采用交互契约中的唯一 payload schema；`attachments` 携带 `name: "build-plan.html"`、`path: "prd/<项目名>/build-plan.html"`，`revision` 使用当前 `meta.revision`，`options` 固定为 `confirm_build` 和 `continue_editing`。一次成功调用同时建立方案展示、版本绑定和最终选择。
3. 结构化交互成功创建后内部记录 `presentedRevision=meta.revision`。询问“确认并开始搭建”或“继续调整”，提交时由宿主原样回传 revision，将确认结果绑定到本次展示版本。用户可见版本称为“第 N 版方案”，展示序号与内部 revision 绑定。

只有以下条件同时成立才交接；它们由本轮 ask_human 请求和回传在运行时判定，不要求把确认状态写回 workspace 文件：

- `meta.status=confirmed`
- `meta.planState.planConfirmed=true`
- `meta.revision=presentedRevision=confirmedRevision`

收到 `confirm_build`（确认并开始搭建）且回传 revision 等于展示 revision 后，直接进入同版本资源实施。确认结果保存在运行时交接上下文。立即按同版本物化结果的 `assetTasks` 启动素材任务，同时进入应用和表单创建；调度见 [素材与页面同时推进](../parallel-work.md#素材与页面同时推进)。后续素材进度更新保留该确认，业务方案或视觉方案变更按下一节处理。`explicitScope.allowInferredResources=false` 时也不执行主题 CSS、应用设置或导航交接，只创建范围内资源并回读、交付。

## 4. 处理调整

`continue_editing` 把工作流从 `awaiting_confirmation` 转为 `editing`。下一次交互收集变更内容；收到变更后更新当前计划源，物化新 revision，并重新进入最终确认。

按字段更新源事实并重新生成，例如同时调整品牌色和圆角：

```bash
openyida design-plan patch prd/<项目名>/build-plan.json \
  --set 'visualStyle.forUser.colorStrategy.primaryColor=#6F4E37' \
  --set 'visualStyle.forUser.colorStrategy.primaryColorName=咖啡色' \
  --set 'visualStyle.tokens.--pod-card-border-radius=16px' \
  --materialize --json
```

CLI 支持首次添加契约允许的可选字段。方案变更自动递增 revision、清除旧确认；仅更新素材进度保留 revision 和确认，同步源 JSON 与派生产物。字段限制见 [紧凑计划契约](../../../yida-design/sub_skill/yida-design-plan/references/build-plan-compact-schema.md#可选字段-patch-与完成校验)。

| 调整内容 | 负责技能与传播范围 |
| --- | --- |
| 字段、流程、资源或顺序 | `yida-prd` 更新相关业务事实与页面规划 |
| 页面核心任务、区块或首屏 | `yida-prd` 更新页面，随后 `yida-design` 同步视觉应用 |
| 主题、品牌色、圆角或阴影 | `yida-design` 更新视觉事实，保持业务范围、页面任务和操作优先级 |

业务方案或视觉方案调整后重新展示并确认当前版本。素材到位、替换同用途图片或更新缺图状态属于实施进度，按 [素材交接](../../../yida-image-assets/SKILL.md#6-交给页面使用) 更新后直接继续。
