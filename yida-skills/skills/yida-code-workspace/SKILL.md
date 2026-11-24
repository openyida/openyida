---
name: yida-code-workspace
description: 查询和批量保存应用级多文件代码工作区，拉取固定源码快照、登记已有构建并按原应用版本发布；用于明确的工作区目录开发，不替换历史单文件页面发布。
---

# 多文件代码工作区

先确认目标应用、组织与当前登录环境。需要服务端开放工作区及应用开发权限。普通单文件 Canvas 页面继续使用原发布流程。

## 读取与修改

```bash
openyida code-workspace limits APP_ID --json
openyida code-workspace current APP_ID --json
openyida code-workspace pull APP_ID ./new-workspace --json
openyida code-workspace check APP_ID ./new-workspace --json
```

pull 只写入不存在的新目录，逐文件核验字节数及 SHA-256，不覆盖已有编辑。`--snapshot ID` 可导出历史快照，历史导出不能直接作为当前编辑基线提交。

源码 project.json 须明确声明 toolchainRef、lockfilePath、lockfileHash、runtimeAbi、entries。锁文件摘要必须匹配真实文件；entries 是入口 ID 到源码路径的映射。当前元数据不回传冻结配方，缺少配置时报告缺口，不猜工具链。check 只检查目录及配置，不编译或执行源码。

## 一轮修改应用一次

```bash
openyida code-workspace push APP_ID ./new-workspace --json
```

首次提交未拉取的目录须显式传 `--expected-revision 0`；已有编辑头使用真实 revision。pull 的本地状态位于 .openyida/workspace.json，不上传。push 在一次请求内合并变化文件和删除路径，校验源码回读；冲突先拉取比较，不盲目覆盖。

单文件编辑、保存及编译预览只在本地完成，不得每改一个文件就 push 或登记构建。源码保存不要求编译成功。

## 登记与正式发布

```bash
openyida code-workspace register APP_ID ./new-workspace --build-dir ./frozen-output --json
openyida code-workspace publish APP_ID ./new-workspace --draft-version ACTUAL_DRAFT --publish-id STABLE_PUBLISH_ID --json
```

register 接收与冻结配方一致的外部构建器输出：runtime.manifest.json 及 files/ 下的运行文件。CLI 校验工作区、源码、ABI 和文件摘要后上传，不内置多文件编译器，不保证任意外部产物能由 FC 重建。缺少兼容构建器时止于源码保存。

publish 使用本地已登记且匹配源码的 buildId。保存、登记、正式发布分别报告；返回发布状态不代表真实浏览器运行已验收。超时或结果不明先查原应用发布状态，重试保留原 publish-id，不自动另发一版。

## 恢复源码编辑头

仅在用户明确要求恢复时执行：

```bash
openyida code-workspace restore APP_ID ./new-workspace --snapshot SOURCE_ID --json
```

恢复不改变线上版本，不覆盖本地文件；完成后 pull 到新目录再编辑。旧目录保持原基线，不能用它覆盖恢复结果。
