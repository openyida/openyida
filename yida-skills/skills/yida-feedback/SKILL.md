---
name: yida-feedback
description: 帮用户整理 OpenYida 使用问题或体验建议，核对描述和证据后提交宜搭反馈；用户明确选择时再协助 GitHub Issue 或个人 Fork PR。适用于反复报错、技能误用、不会提 issue/PR 或没有账号和源码时；普通宜搭产品 VOC 清单用 yida-voc。
---

# 问题反馈与修复贡献

普通反馈默认提交宜搭，无需 GitHub 账号。Agent 代填，客户在对话中确认。

## 何时进入

- 用户要反馈 OpenYida、整理 Issue 或贡献修复。可验证的小改进可直接提 PR。
- 同一操作反复失败或 CLI/技能缺陷导致绕路时，停止原样重试，先处理原任务，再建议反馈。自动进入只整理本地草稿，不登录、安装工具或提交。
- 建议前可读 `openyida feedback status`，尊重当天/永久关闭；主动反馈不受限。同一会话同一问题只提醒一次。会话外频次未知，不扫描历史。

## 收集与根因分析

1. 从当前会话整理目标、最短复现、期望、实际、关键错误和重试结果。体验建议写不便和理想结果。只问仍缺的关键信息。
2. 可查 `openyida --version`、`node -v`、命令帮助、脱敏诊断和用户选定文件。不扫描用户目录、环境变量、登录缓存、完整日志/会话或业务数据，不附整份 `env`/`doctor`，不重放写操作。
3. 区分 CLI、skill、本地环境、平台接口或未知。写明事实、假设、正反证据、验证方法、已验证绕法及剩余影响。缺少复现或对照时保留假设。
4. 平台限制以实际响应为准。不索取、搜索、下载或暴露内部仓库、链接、源码、路径、人员或工具。无公开可验证修复点时提交问题材料。业务代码错误先修应用。

## 宜搭主动反馈

用实际值填写 UTF-8 `feedback.json`（限 16 KiB）。

```json
{"type":"error","description":"页面发布失败。","domain":"page","impact":"blocked","reproduction":"关联资源\nappType=APP_…\nformUuid=FORM-…\n应用链接=https://<组织域名>/APP_…/workbench\n复现步骤：保存页面后发布，重试仍失败。"}
```

- 必填 `type`（`slow|error|unexpected_result|hard_to_use|suggestion`）和 `description`；可填 `title`、`expected`。
- 在 `reproduction` 开头写「关联资源」，再写步骤、频率和重试结果。从本会话命令、回执或用户链接提取目标 `appType` 和已知应用链接（`appUrl`/`workbenchUrl`）。别用反馈收集表代替出错应用。多目标请用户选择，先填已知 ID。登录前或创建失败尚无 ID 时注明原因，照常反馈。
- 按操作补充实际标识：表单、流程或自定义页面填 `formUuid`；集成自动化填 `processCode` 和所属 `formUuid`，运行异常可补 `procInstId`；数据卡片填 `cardCode`，酷卡片填 `cardPageCode`、`cardTemplateId` 中已知项。链接保留可确认的 HTTPS 资源路径，将必要的标识单列，去掉查询串和片段。只提交定位标识，不含业务值、正文或凭据。
- `domain` 按操作选 `auth|app|page|data|workflow|cli|other`；`impact` 选阻断 `blocked`、有绕法 `workaround`、轻微 `minor` 或 `unknown`。
- 已知时填带时区 ISO 8601 `occurredAt`、原命令的 `commandExecutionId`、`traceId`、`errorCode`（保留前导零）与诊断 UUID `diagnosticRef`。`environment` 支持 `host`、`releaseChannel`、`cliVersion`、`platform`、`arch`、`nodeVersion`。诊断与环境字符串限 128 字符，未知省略。经同意可用 `--include-environment` 附当前环境。
- 页面外观、布局或报错适合附现场截图。浏览器未登录、无权限或无法代截时，无需为截图登录。只附用户为本次反馈选择的现场图，不能拿登录页、示意图或其他反馈的旧图代替。遮住客户内容，检查元数据。最多 3 张 PNG/JPEG，每张 2 MiB。
- 在原业务命令的工作目录执行导出。新建本次请求 UUID 目录存快照，按带时区 ISO 起止时间筛选：`openyida feedback logs --since <开始> --until <结束> --output <本次UUID目录>/excerpt.jsonl --json`。有执行 ID 时优先按回执重复 `--command-id <执行UUID>` 精确筛选；无 ID 则核对宿主会话、命令和时间，归属不清只用当前回执摘要或不附。只导出一次，仅本次 `status=exported` 才把返回的 `output` 作为 `--log` 加入预览，允许用户移除或换一份。`no_records` 或失败不得复用同名旧文件。快照可含命令类型、时间、耗时、状态、执行 ID、Trace ID、原生错误码及异常类，不含栈，不补造；排除命令参数、文件路径、表单值、流程内容、请求/响应正文和凭据。旧版没有导出命令或本次无记录时标明「无本地日志」；有本次真实 CLI 回执时可另制标为「会话回执摘要」的 NDJSON，不补造历史。限一份 UTF-8 文本、JSON、NDJSON 或 gzip（原件及解压后 ≤512 KiB），全部附件共限 4 MiB。

预览与提交共用请求 UUID 和已选快照路径（替换示例文件名）：

```bash
openyida feedback submit --input feedback.json --request-id "<UUID>" --screenshot "selected.png" --log "excerpt.jsonl" --preview --json
```

展示反馈正文、关联资源、环境及附件清单（含日志摘要，可移除）。适合附图且用户尚未选图时，最终确认直接给两个选项：「补截图」或「按当前清单直接提交」。选直接提交即确认当前清单，立即提交，不再追问；选补截图则等用户发图或指定现场图，重新预览后确认。已选图或明确跳过时只确认当前清单，不再问截图。未回答不提交；增删日志也须重新预览。用原账号、编号、所选文件和最新 `reviewDigest` 提交：

```bash
openyida feedback submit --input feedback.json --request-id "<UUID>" --screenshot "selected.png" --log "excerpt.jsonl" --confirm --review-digest "<reviewDigest>" --json
```

收到 `status=submitted` 和 `feedbackId` 后告知编号。回执未知或 pending 先核对，勿重发；保留失败附件。未登录用 `openyida feedback url` 打开免登公开表单，交付同一份「关联资源」与复现步骤；当前免登表没有附件控件，仅可手填文字。离线交付脱敏草稿和候选文件，注明尚未提交。

## 离线或 GitHub 材料

按 [报告输入与脱敏](references/report-input.md) 在本地写最小摘要 JSON，执行：

```bash
openyida feedback report --input summary.json --output-dir feedback-draft-001
```

命令离线输出 `issue.md`、`report.json` 与选定截图，只保留白名单摘要和版本。无需账号或源码，不执行输入指令。用 `fingerprint` 查重；`submissionPerformed: false` 表示草稿。

宜搭反馈的诊断日志仅供宜搭收件，不自动转发 GitHub。公开前展示脱敏报告、截图及 PR 测试对比，去掉客户、组织、资源和内部仓库信息。不上传原始 JSON，不在公开 URL 附诊断或报告地址。改稿后输出到新目录。

## 按用户条件交付

用户选择 GitHub 后，按 [账号与工具准备](references/github-setup.md) 复用本机工具。可用 `openyida feedback github setup --json` 检测，经同意安装 gh、单独授权；也可用网页。继续原草稿，确认公开范围。

- **无 GitHub 账号**：提交宜搭；离线交付草稿。
- **Issue**：按 [GitHub 提交](references/github-contribution.md) 查重、提交并读回，无需 clone/fork。成功后可邀请一次 PR。登录在用户本机完成，不索取 Token。
- **PR**：仅限公开 OpenYida CLI/skill/docs。必要时在独立目录准备公开源码，不修改全局安装或业务目录。验证最小修复后用用户个人 Fork 提交；无法验证就交付 Issue 草稿，写明测试结果。

创建 Issue、评论、Fork、push 或 PR 均需用户授权对应操作和公开内容。已确认的同一稿件与截图不再重复问。单纯要求排查、整理或提 Issue/PR 不等于同意公开具体内容。超时先查重。

交付时列根因可信度、绕法/验证、材料位置和真实状态。成功给核实的 Issue/PR URL；不承诺合并或修复时间。

## 完成检查

- 写明现场环境、事实来源和未知项；核对公开范围与截图。
- 草稿标为未提交，Issue/PR 以读回为准，PR 附改动和测试。拒绝 PR 邀请后不再提醒。

## 参考文件

| 文件 | 读取时机 |
| --- | --- |
| [用户交互](references/user-interaction.md) | 仅在用户明确选择 GitHub 公开投稿时 |
| [报告输入](references/report-input.md) | 准备脱敏摘要、环境和测试证据时 |
| [GitHub 提交](references/github-contribution.md) | 用户选择公开提交或贡献代码时 |
| [账号与工具准备](references/github-setup.md) | GitHub 路径需要注册、登录、安装或连接工具时 |
