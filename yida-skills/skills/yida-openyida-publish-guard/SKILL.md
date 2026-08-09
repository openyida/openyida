---
name: yida-openyida-publish-guard
description: 修改或发布已有自定义页面前检查线上版本，防止本地旧源码覆盖线上改动。
---

# 发布前检查线上页面

## 何时使用

- 修改或发布已有自定义页面。
- 用户提供 `pageDesigner` URL、展示页面 `formUuid` 或现有页面源码。
- 用户要求“只修改某一处”或“不要改其他内容”。
- 页面可能在宜搭设计器中被其他人修改过。

全新页面还没有线上 Schema 时不用本技能。

## 必须遵守

1. 编辑前读取线上 Schema，不能直接用本地旧源码覆盖。
2. 比较线上源码、本地源码和页面数据源。
3. 用户只要求修改一处时，最终差异只能包含该修改和必要的辅助代码。
4. 线上存在本地没有的改动时，保留线上改动；无法确定如何合并时询问用户。
5. 只有用户明确要求“以本地源码为准”时，才可不合并线上源码，但仍要执行检查、编译和发布。

## 执行步骤

1. 确认目标 `appType`、展示页面 `formUuid` 和本地源码路径。
2. 检查环境和登录：

```bash
openyida env --json
openyida login --check-only --json
```

3. 读取线上 Schema：

```bash
openyida get-schema <appType> <formUuid> --json
```

需要保存结果时，使用文件编辑工具写入：

```text
<projectRoot>/.cache/openyida/publish-guard/live-<formUuid>.json
```

不要使用 shell 重定向，也不要提交该文件。

4. 检查线上页面的源码、编译结果、组件树和 `dataSource.online`。
5. 将用户要求的修改合并到最新线上行为，再检查最终差异。
6. 执行发布：

```bash
openyida check-page <source>
openyida compile <source>
openyida publish <source> <appType> <formUuid> --health-check
```

Code Canvas 页面按 `yida-canvas-custom-page` 和 `yida-publish-page` 的命令要求执行。

## 检查重点

- 不格式化无关代码，不重新生成整页。
- 不恢复线上已经删除的按钮、文案或交互。
- 保留现有页面数据源，并检查发布输出是否显示数据源已保留。
- 搜索本次问题涉及的旧标签或控件，确认它们没有被意外恢复。

## 覆盖后恢复

1. 明确说明发生了覆盖。
2. 恢复被覆盖的线上改动，不做无关重构。
3. 重新执行检查、编译和带健康检查的发布命令。
4. 回读线上 Schema，确认恢复结果。

## 完成条件

- 已比较线上和本地源码。
- 用户的修改已合并到最新线上版本。
- 无关线上改动和页面数据源得到保留。
- 发布和线上回读成功。
