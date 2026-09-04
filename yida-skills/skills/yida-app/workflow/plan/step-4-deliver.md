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

完整文件的职责与版本规则见 [完整文件合并](../parallel-work.md#plan-的-cli-交接)。直接维护源计划时先设 `meta.status=awaiting_confirmation`，再执行 `openyida design-plan materialize prd/<项目名>/build-plan.json --json`；仅做诊断时使用 `openyida design-plan materialize prd/<项目名>/build-plan.json --check --json`。正常生成已经包含完整校验，不先运行一次 --check 再重复生成。

HTML 保留“需求总览、数据模型、业务流程、页面规划”四章，完整展示用户需要确认的业务、视觉、数据、顺序和验收内容；整体视觉放在需求总览，逐页视觉放在页面详情。展示范围见 [HTML 内容契约](../../../yida-design/sub_skill/yida-design-plan/assets/README.md#需求总览中的视觉信息)，Markdown 供 Agent 执行。

校验失败时按返回的 `details.issues` 集中修正对应字段后重试。写入失败由 CLI 恢复旧文件；若恢复失败，保留报错给出的备份路径并处理恢复后再继续。

## 3. 展示并确认当前版本

按 [用户交互契约](../../../yida-design/references/ask-human-interaction-contract.md) 执行：

1. 在会话中展示“当前这版方案”、3–7 条业务摘要和可打开的 `build-plan.html`。
2. 展示成功后内部记录 `presentedRevision=meta.revision`，记录后直接提问；收到确认或修改业务事实后再重新生成。用户可见版本称为“第 N 版方案”，展示序号与内部 revision 绑定。
3. 询问“确认并开始搭建”或“继续调整”，将确认结果绑定到本次展示版本。

只有以下条件同时成立才交接：

- `meta.status=confirmed`
- `meta.planState.planConfirmed=true`
- `meta.revision=presentedRevision=confirmedRevision`

交接前运行不带 `--from-preview` 的生成命令同步确认状态，将同版本 `prd.md`、`design.md` 返回应用主流程 Step 3，执行 [公共主题 CSS 交接](../step-2-design.md#主题文件实现指令)。

## 4. 处理调整

按字段更新源事实并重新生成，例如同时调整品牌色和圆角：

```bash
openyida design-plan patch prd/<项目名>/build-plan.json \
  --set 'visualStyle.forUser.colorStrategy.primaryColor=#6F4E37' \
  --set 'visualStyle.forUser.colorStrategy.primaryColorName=咖啡色' \
  --set 'visualStyle.tokens.--pod-card-border-radius=16px' \
  --materialize --json
```

CLI 支持首次添加契约允许的可选字段，自动递增 revision、使旧确认失效，并同步源 JSON 与派生产物。字段限制见 [紧凑计划契约](../../../yida-design/sub_skill/yida-design-plan/references/build-plan-compact-schema.md#可选字段-patch-与完成校验)。

| 调整内容 | 负责技能与传播范围 |
| --- | --- |
| 字段、流程、资源或顺序 | `yida-prd` 更新相关业务事实与页面规划 |
| 页面核心任务、区块或首屏 | `yida-prd` 更新页面，随后 `yida-design` 同步视觉应用 |
| 主题、品牌色、圆角或阴影 | `yida-design` 更新视觉事实，保持业务范围、页面任务和操作优先级 |

每次调整后重新展示并确认当前版本。
