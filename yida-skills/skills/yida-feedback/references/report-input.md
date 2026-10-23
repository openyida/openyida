# 报告输入与脱敏

输入是 Agent 从当前证据整理的摘要，不是让普通用户手填。最低字段是 `title` 和 `actual`，其他未知可省略。不支持自动抓取日志或附件。

```json
{
  "title": "发布失败后错误提示缺少处理建议",
  "summary": "想把页面发布给同事使用，目前卡在发布步骤。",
  "command": "openyida publish（省略业务参数）",
  "steps": ["使用最小示例执行发布", "观察错误提示"],
  "expected": "说明失败原因并给出可执行的下一步",
  "actual": "仅显示发布失败，没有后续指引",
  "impact": "发布受阻",
  "occurrenceCount": 2,
  "evidence": ["这里只填写实际观察的脱敏报错摘要"],
  "attempts": ["这里只填写真实操作及其结果"],
  "cause": {
    "category": "unknown",
    "status": "hypothesis",
    "summary": "可能遗漏错误分支，尚未检查公开代码",
    "evidence": ["这里只填写支持假设的实际证据"],
    "nextSteps": ["对照当前版本命令帮助和公开实现"]
  },
  "screenshots": [
    { "path": "selected-error.png", "description": "用户确认选用的复现报错截图" }
  ],
  "comparison": {
    "before": { "revision": "公开基线或已知版本", "status": "not_run" },
    "after": { "revision": "修复分支", "status": "not_run" },
    "regression": { "status": "not_run" },
    "limitations": ["尚未运行测试；实际 PR 必须如实更新前后对比证据"]
  },
  "tool": "用户实际使用的 AI 工具",
  "model": "已知才填写"
}
```

示例不是已发生事实，不得原样填入真实反馈。

- category：`cli|skill|environment|platform|unknown`；status：`confirmed|hypothesis|unknown`。confirmed 必须有 summary 和 evidence，CLI 只检查结构，不替 Agent 证明根因。
- occurrenceCount：已观察的正整数；未知省略。fingerprint 按脱敏后的 title/command/actual 生成，不等于跨用户统计或已完成查重。
- 单字段最多 12000 字符；数组最多 40 个字符串；输入最多 1 MiB。未列出的字段被丢弃；字段不能嵌套对象（cause、screenshots、comparison、incidentEnvironment 除外）。CLI 只补报告生成时的包版本、Node、系统类型和架构，不补环境变量、账号、组织、应用或项目路径。
- 自动过滤常见凭证、绝对路径、URL、应用/表单标识、邮箱、手机号与身份证号，并转义 Markdown。正则不是保密保证；人工复核业务数据、间接身份信息、内部名称和未匹配的凭证。
- 用文件工具写入 JSON，避免把报错拼成 shell 命令。命令只读这一个显式输入；输出目录父目录须存在，目标目录须不存在，避免覆盖已有材料。

## 问题发生环境与报告生成环境

复用顶层 `tool`（工具名及已知版本）、`model`。新增可选 `incidentEnvironment` 对象只接收字符串白名单：`openyida`、`node`、`platform`、`arch`、`installation`、`browser`、`deployment`、`organizationContext`。前四项为问题发生时的版本、系统和架构；安装方式可写 npm/插件/源码/未知；浏览器与部署形态仅在相关时填写；组织上下文只描述单组织/多组织切换，不含组织 ID 或名称。

例如用户明确说升级前出错，可填 `{"incidentEnvironment":{"openyida":"用户确认的旧版本","installation":"npm"}}`；未知字段省略，不根据报告命令运行环境推断。Agent 将来源和升级差异放进现有 `evidence`，避免新增重复的诊断字段。

输出 `environment` 保持原有结构，始终表示报告生成器的包版本和运行环境；Markdown 单独标为“报告生成环境（不代表问题发生时）”。缺少 `incidentEnvironment` 的旧输入继续可用，出错环境显示未知；不能用生成报告的新版 OpenYida 冒充出错时版本。所有新输入值同样脱敏、转义并参与公开稿的 `reviewDigest`。

## 截图与测试对比

`screenshots` 最多 5 张，每张至多 10 MiB，仅接受 PNG/JPEG/WebP 文件头。相对路径按摘要 JSON 所在目录解析。CLI 只复制明确选择的原图，输出 `screenshot-01.png` 等通用文件名；不复制原文件名/路径到报告，不上传、不改图、不移除元数据。原图和最终正文必须一并审阅后才公开。无图片时省略，不能用示例或生成图片充当真实截图。

`comparison.before/after/regression` 各项支持 `revision`、`command`、`actual`、`status`、`evidence`。status 为 `passed|failed|not_run`；宣称通过/失败必须提供真实命令、实际结果及证据摘要。`limitations` 写无法复现、浏览器/平台尚未验证等实际限制。CLI 只校验结构，不代替执行测试或确认修复。PR 正文应包含此对比报告，Issue 无测试时不需要展示比较章节。

`reviewDigest` 绑定生成的 `issue.md` 正文及全部已选择图片的字节（含图片元数据），用于将公开确认关联到具体版本。生成草稿不代表取得确认；`fingerprint` 仅用于查重。正文/图片变更后须重新生成预览并确认。
