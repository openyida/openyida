---
name: openyida-release
description: 快速发布 OpenYida npm 正式版或测试版。用户说“发布正式版”“发布测试版”“发 beta”或要求按当天日期生成版本 tag 时使用；不用于宜搭应用或自定义页面发布。
---

# OpenYida 快速版本发布

通过 Git tag 触发现有 GitHub Publish 工作流。发布过程不运行任何本地 CI、测试、lint、构建或 `npm run check:*`；远端工作流保持原样。

## 发布类型

- 正式版：北京时间当天首次为 `vYYYY.M.D`，之后依次为 `vYYYY.M.D-1`、`vYYYY.M.D-2`。
- 测试版：北京时间当天从 `vYYYY.M.D-beta.0` 开始，之后依次递增。
- 仅把明确包含“测试版”“beta”或“预发布”的请求视为测试版；其余明确的版本发布请求按正式版处理。

## 准备发布

1. 确认仓库和工作树状态，但不要修改、暂存或清理用户文件：

   ```bash
   git rev-parse --show-toplevel
   git status --short
   git fetch origin --tags
   ```

2. 默认发布最新 `origin/main`，与当前 checkout 的分支无关。不要 checkout、merge、commit，也不要 push 分支。
3. 从本技能目录运行版本计算脚本：

   ```bash
   node .agents/skills/openyida-release/scripts/next-version.js stable
   node .agents/skills/openyida-release/scripts/next-version.js beta
   ```

   脚本同时读取本地 tag 和 `origin` 远端 tag，并按 `Asia/Shanghai` 日期生成下一个版本。不要凭记忆手写编号。
4. 读取目标 commit：

   ```bash
   git rev-parse refs/remotes/origin/main
   git show -s --format='%h %s' refs/remotes/origin/main
   ```

5. 在任何写操作前，向用户展示发布类型、完整 tag、目标 commit 和 commit 标题，并明确说明“只推 tag，不推分支；本地不跑 CI；远端 Publish 工作流仍会运行”。取得一次明确确认。

工作树有未提交改动时也不得擅自 stash 或清理；因为发布目标固定为 `origin/main`，只需说明这些改动不会进入本次版本。

## 执行发布

得到确认后，先再次 `git fetch origin --tags`，重新计算版本并重新读取 `origin/main`：

- 如果 tag 或目标 commit 与用户确认时不同，停止并用新值再次确认。
- 如果两者都未变化，创建轻量 tag 并只推送该 tag：

  ```bash
  git tag "v${RELEASE_VERSION}" "${RELEASE_COMMIT}"
  git push origin "refs/tags/v${RELEASE_VERSION}"
  ```

不要运行以下操作：

- `npm test`、`npm run check:ci`、`npm run check:*`、lint、build 或安装依赖；
- `npm version`，以及直接修改 `package.json` / `package-lock.json`；
- branch push、自动 commit、自动 merge；
- 等待远端 CI 完成。

现有 `.github/workflows/publish.yml` 会从 tag 同步 npm 包版本，并把 beta 发布到 npm `beta` dist-tag；正式版及同日 `-1`、`-2` 发布到 `latest`。

## 回读与失败处理

推送后只回读远端 tag，确认它存在且指向预期 commit：

```bash
git ls-remote --tags origin "refs/tags/v${RELEASE_VERSION}"
```

- 回读一致即报告 tag 已推送、远端发布已触发，不等待工作流结束。
- push 返回不确定结果时，先回读远端 tag；远端已存在且 commit 一致则视为成功，不重复推送。
- 远端不存在时，报告本地 tag 仍保留并等待用户决定；不得自动重试或删除 tag。
- 远端 tag 已存在但 commit 不一致时立即停止，不覆盖、不删除、不 force push。

