# 普通页面数据源保留

`openyida publish` 重新发布已有普通页面时，先读取目标页面 Schema，提取 Page 组件上的 `dataSource`，再与内置的 `urlParams`、`timestamp` 数据源合并。

读取旧 Schema 失败时发布会停止，避免清空已有 HTTP、VALUE、URI 或连接器数据源。用户要求保留数据源时，直接使用当前 `openyida publish`，不手写额外合并脚本。

## 发布后判断

- 源码不含 `this.dataSourceMap.`，输出 `No custom page data sources to preserve` 是正常情况。
- 源码包含 `this.dataSourceMap.`，输出 `No custom page data sources to preserve` 不是完成状态。

第二种情况按以下任一方式处理：

1. 改用 `this.utils.yida.*` 或入口型页面，再执行 check、compile、publish。
2. 使用 `yida-data-source-connectors` 创建并绑定设计器数据源，再重新发布。

不能只凭 API 发布成功就判断页面可用。
