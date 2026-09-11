# OpenYida 快速版本发布技能

## 状态

- 阶段：已完成本地实现与窄范围验证
- 核心目标：用一句自然语言请求快速发布 OpenYida 正式版或测试版，并自动生成不冲突的日期版本号

## 已确认需求

- “发布正式版”使用北京时间当天的 `YYYY.M.D`；同日重复发布依次使用 `YYYY.M.D-1`、`YYYY.M.D-2`。
- “发布测试版”使用北京时间当天的 `YYYY.M.D-beta.0`；同日重复发布依次使用 `-beta.1`、`-beta.2`。
- 发布过程不运行本地 CI。
- 继续复用 tag 触发的 GitHub Publish 工作流；远端现有校验与 npm 发布行为不变。

## 最小实现

- 新增项目技能 `.agents/skills/openyida-release/`。
- 用技能内脚本结合本地与远端 tag 确定下一版本，避免让 Agent 临时拼接版本算法。
- 发布 tag 默认指向最新 `origin/main`，不切换工作树、不修改 package manifests、不推送分支。
- 推送 tag 前展示发布类型、tag 和目标 commit，并取得一次明确确认；推送后只做远端 tag 回读，不等待 CI。
- 收窄跨端发布守卫的自动路由，避免普通版本发布被其全量 CI 要求覆盖。

## Done Contract

- 正式版和测试版的首次、同日连续编号都由自动化测试证明。
- 技能结构校验通过，且指令明确禁止本地 CI、branch push 和 package version 修改。
- 真实发布仍必须由用户在看到准确 tag 与 commit 后确认；本任务不实际发布任何版本。

## 非目标

- 不删除或跳过远端 GitHub Publish 工作流中的校验。
- 不自动生成 changelog、提交代码、合并分支或推送业务分支。
- 不改变 npm dist-tag 规则。

## Change Log

- 2026-09-08：根据用户确认，选择“本地跳过 CI、远端工作流保持不变”的最小方案。
- 2026-09-08：新增 `openyida-release` 技能、日期版本计算脚本及单元测试；普通版本发布不再触发跨端发布守卫。

## Validation

- `node --check .agents/skills/openyida-release/scripts/next-version.js`：通过。
- `npx jest .agents/skills/openyida-release/tests/next-version.test.js --runInBand`：6 项通过。
- `npx eslint --no-ignore .../next-version.js .../next-version.test.js`：通过。
- `quick_validate.py .agents/skills/openyida-release`：技能结构有效。
- 使用远端 tag 试算 2026-09-08：正式版为 `2026.9.8`，测试版为 `2026.9.8-beta.0`；未创建或推送 tag。
- `git diff --check`：通过。

## Project Sync

发布约定已经固化在项目技能及其算法测试中，无额外长期知识同步候选。
