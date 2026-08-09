---
name: yida-data-source-connectors
description: 为已有普通 JSX 页面配置设计器数据源，并通过 this.dataSourceMap 调用连接器或远程 API。
---

# 普通 JSX 页面数据源

## 何时使用

本技能只服务 **已有普通 JSX 自定义页面**：

- 页面使用 `.oyd.jsx`、`renderJsx` 或已有 `this.dataSourceMap`。
- 用户要求数据源在设计器左侧可见。
- 需要维护已有 `dataSource.online`、`YIDACONNECTOR` 或 `REMOTE` Schema。

Code Canvas 不直接使用普通页面的 `this.dataSourceMap`。遇到 `.canvas.jsx`、`YidaCodeCanvas` 或 `YidaComp` 时，使用：

```text
use_skill("yida-canvas-data-binding", "为 Code Canvas 页面接入真实数据")
```

创建或管理连接器、账号、鉴权或 Action 时，使用 `yida-connector`。

## 必须遵守

1. 普通页面先在 Page 根节点 `dataSource.online` 注册数据源，再调用 `this.dataSourceMap.<name>.load()`。
2. 不在普通页面用 `fetch`、`XMLHttpRequest`、测试接口或外部 URL 绕过设计器数据源。
3. 查询、详情、保存和删除使用独立的业务数据源名，不合并成万能 Action。
4. 请求失败、取消或超时后恢复 loading；mutation 按钮有 submitting 或 disabled 状态。
5. Canvas 页面不复制本技能的 `dataSourceMap` 代码，也不降级成普通页面。

## 执行步骤

1. 查询连接器和 Action：

```bash
openyida connector detail <connector-id>
openyida connector list-actions <connector-id>
```

2. 按 [普通页面数据源实现](references/native-data-source-guide.md) 注册 `dataSource.online`。
3. 页面只调用已经注册的数据源。
4. 检查、编译、发布并回读：

```bash
openyida check-page <src>
openyida compile <src>
openyida publish <src> <appType> <displayPageFormUuid> --health-check
openyida get-schema <appType> <displayPageFormUuid> --summary-json
```

子表明细超过 50 行时，使用 `openyida data query subform` 按 `formInstId + tableFieldId` 分页查询，不为此新建连接器数据源。

## 完成条件

- 已确认目标是已有普通 JSX 页面。
- Page Schema 包含可审计的数据源配置。
- 页面只通过 `this.dataSourceMap` 调用远程能力。
- loading、error、timeout 和 retry 可恢复。
- 发布和线上回读通过。

## 参考文件

| 文件 | 什么时候读 |
| --- | --- |
| [普通页面数据源实现](references/native-data-source-guide.md) | 注册 `dataSource.online`、编写调用 helper 或检查发布后的 Schema 时 |
