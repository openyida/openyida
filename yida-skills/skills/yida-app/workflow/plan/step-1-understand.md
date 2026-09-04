# Plan 输入：共享需求事实

调用 `yida-requirement-analysis` 读取用户指定来源，输出 `.cache/openyida/<项目名>/requirement-brief.json`。已有可用文件直接复用。

Fast 和 Plan 使用同一份需求事实，不重复抽取附件或生成另一套需求格式。来源不可读时先处理来源问题；显式范围、品牌约束和缺口保持原样。模式沿用 `yida-app` 已记录的 `designMode`。

有影响资源范围的未决项时交给下一步范围确认；一般字段、角色和流程细节由 `yida-prd` 在范围内规划，并记录假设。视觉推断交给 `yida-design`。
