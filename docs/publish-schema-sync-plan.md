# OpenYida 发布前同步线上 Schema 方案

## 1. 一句话结论

`openyida publish` 不应该每次都拿本地代码重新造一份完整页面 Schema 去覆盖线上。

更合适的做法是：

```text
发布前先自动拉线上最新 Schema
只替换“代码生成的那一小块”
其余用户在线上手动改过的配置全部保留
```

也就是说，用户在宜搭设计器里改过页面配置，OpenYida 下次发布时应该自动带着这些改动继续发布，而不是把它们冲掉。

## 2. 现在的问题是什么

当前自定义页面发布可以理解成这样：

```text
本地 JSX 源码
  ↓
OpenYida 编译
  ↓
重新拼出一份页面 Schema
  ↓
保存到宜搭
```

这个流程的问题是：Schema 里不只有代码，还有很多设计器配置。

比如：

| 内容 | 谁可能会改 |
| --- | --- |
| 页面代码 | OpenYida / AI |
| 页面数据源 | 用户可能在宜搭设计器里加 |
| 页面样式、边距、标题开关 | 用户可能在线上调 |
| 组件别名 | 用户可能在线上配 |
| 页面级配置、未知新字段 | 宜搭平台或用户可能生成 |

如果 OpenYida 每次都重新拼完整 Schema，就像“只想换一段页面代码，却顺手把整间房重新装修了一遍”。用户在线上手动调过的东西就容易丢。

当前代码已经做了一点保护：`publish` 会读取线上 Schema，并保留页面级 `dataSource`。这说明方向是对的，但保护范围还太小，只保了数据源。

## 3. 用户真正想要什么

用户心智很简单：

```text
我让 AI 改页面代码，就只改页面代码。
我在宜搭后台手工改过的配置，不要被 AI 发布覆盖。
```

所以目标不是让用户每次都手动执行 `get-schema`，也不是让 AI 每次读完整 Schema。

目标应该是：CLI 自己完成同步和合并，AI 只看到很短的结果摘要。

## 4. 推荐方案

### 4.1 publish 默认变成“先同步，再局部更新”

以后执行：

```bash
openyida publish project/pages/src/home.oyd.jsx APP_XXX FORM_XXX
```

内部流程改成：

```text
1. 拉取线上最新 Schema
2. 判断目标页面是不是可安全发布的自定义页
3. 编译本地 JSX
4. 在线上 Schema 的基础上，只替换代码相关字段
5. 保留线上其它配置
6. 保存合并后的 Schema
7. 输出本次改了什么、保留了什么
```

用户不需要额外记命令。

### 4.2 明确“OpenYida 管什么，用户线上配置管什么”

需要给 Schema 划边界。

OpenYida 发布时可以覆盖：

| 字段 | 原因 |
| --- | --- |
| `actions.module.source` | 页面源码 |
| `actions.module.compiled` | 编译后的代码 |
| `actions.list` | 代码里导出的函数列表 |
| `Jsx.props.render` | 自定义页渲染入口 |
| 必要的运行时兼容字段 | 保证页面能运行 |

OpenYida 发布时默认保留：

| 字段 | 原因 |
| --- | --- |
| `Page.dataSource` | 用户可能在线上手动配数据源 |
| `Page.props` | 用户可能调页面标题、边距、背景等 |
| `Page.css` | 用户可能在线上改样式 |
| `componentAlias` | 用户可能配置组件别名 |
| `connectComponent` | 平台连接关系，不该轻易清空 |
| 未认识的新字段 | 宜搭平台未来可能新增，默认保守保留 |

这条原则很重要：**OpenYida 只更新自己生成的代码区，不碰用户可能在线上维护的配置区。**

## 5. 怎么降低 token 消耗

重点是：不要让 AI 看完整 Schema。

完整 Schema 可以很大，但它应该只在 CLI 进程里处理，不进入模型上下文。

推荐做法：

```text
完整 Schema：CLI 拉取、CLI 缓存、CLI 合并
AI 上下文：只返回摘要和风险提示
```

例如发布输出只需要这样：

```text
已同步线上 Schema
更新：页面代码、render 入口
保留：3 个数据源、1 组组件别名、Page 样式配置
风险：无
发布成功
```

这样既拿到了最新线上 Schema，又不会把几万 token 的 JSON 塞给 AI。

## 6. 建议新增的命令

### 6.1 `schema sync`

用于手动同步线上 Schema 到本地缓存。

```bash
openyida schema sync APP_XXX FORM_XXX
```

输出：

```text
已同步线上 Schema
缓存位置：project/.cache/openyida/schemas/APP_XXX/FORM_XXX.json
Schema 摘要：自定义页，2 个数据源，1 组组件别名
```

### 6.2 `schema summary`

只输出摘要，不输出完整 JSON。

```bash
openyida schema summary APP_XXX FORM_XXX
```

输出：

```text
页面类型：自定义展示页
代码区：OpenYida 普通自定义页面 Jsx
数据源：3 个
组件别名：1 组
最近同步：2026-07-09 15:20:11
```

### 6.3 `schema diff`

比较本地缓存和线上最新 Schema，告诉用户线上是否有人改过。

```bash
openyida schema diff APP_XXX FORM_XXX
```

输出：

```text
线上有新改动：
- Page.dataSource 增加 1 个 HTTP 数据源
- Page.props.showTitle 从 false 改为 true
- componentAlias 增加 2 项
```

这三个命令不是每次都要求用户执行，而是给排查和高级用户使用。普通发布仍然走 `openyida publish` 自动同步。

## 7. publish 的安全策略

### 7.1 默认安全发布

默认不允许在“不确定能安全合并”的情况下覆盖线上。

例如线上 Schema 被用户改得很厉害，OpenYida 找不到 `Jsx` 节点了，就不要强行保存。

应该提示：

```text
无法安全合并：未找到 OpenYida 管理的 Jsx 节点
本次没有发布，线上页面未被修改
如确认要全量重建，请使用 --force-rebuild
```

### 7.2 强制重建需要显式参数

新增或明确一个危险参数：

```bash
openyida publish page.oyd.jsx APP_XXX FORM_XXX --force-rebuild
```

含义：

```text
我知道会重建完整 Schema，也知道可能覆盖线上手动配置。
```

不要把这个行为藏在普通 `--force` 里。`--force` 现在更像是绕过目标类型检查，`--force-rebuild` 应该专门表示“允许全量重建”。

## 8. 本地缓存怎么设计

缓存只给工具用，不要求 AI 读取完整内容。

推荐目录：

```text
project/.cache/openyida/schemas/
  APP_XXX/
    FORM_XXX.schema.json
    FORM_XXX.meta.json
```

`meta.json` 里放：

```json
{
  "appType": "APP_XXX",
  "formUuid": "FORM_XXX",
  "remoteHash": "xxx",
  "fetchedAt": "2026-07-09T15:20:11+08:00",
  "summary": {
    "pageType": "display",
    "dataSourceCount": 3,
    "aliasCount": 1,
    "managedByOpenYida": true
  }
}
```

这样 AI 需要判断时，只读 `meta.json` 或 `summary` 输出，不读完整 Schema。

## 9. 推荐落地步骤

### 第一步：扩展 publish 的合并能力

在现有“保留 `dataSource`”的基础上，扩展成“基于线上 Schema patch 代码区”。

优先处理普通自定义页面：

```text
线上 Schema
  + 新编译出来的 source / compiled
  + 新 actions.list
  + 必要 runtime 字段
  = 待保存 Schema
```

### 第二步：加发布摘要

每次 publish 输出：

```text
更新了什么
保留了什么
有没有风险
```

这比输出完整 Schema 更有价值，也更省 token。

### 第三步：加 `schema sync / summary / diff`

这一步解决排查问题。

当用户说“我在线上改过东西，担心被覆盖”时，AI 可以先跑：

```bash
openyida schema diff APP_XXX FORM_XXX
```

而不是把完整 Schema 拉出来读。

### 第四步：加冲突保护

当线上 Schema 不是 OpenYida 能识别的结构时，默认停止发布。

只有用户明确加 `--force-rebuild`，才允许重建完整 Schema。

### 第五步：补测试

至少覆盖这些场景：

| 场景 | 预期 |
| --- | --- |
| 线上有自定义数据源 | publish 后保留 |
| 线上改了 `Page.props` | publish 后保留 |
| 线上有 `componentAlias` | publish 后保留 |
| 本地代码变化 | publish 后代码更新 |
| 找不到 Jsx 节点 | 默认阻断，不保存 |
| 使用 `--force-rebuild` | 允许全量重建 |

## 10. 对 AI 使用方式的影响

以前 AI 可能会这样做：

```text
get-schema 拉完整 Schema
读大 JSON
修改
publish
```

以后应该变成：

```text
改源码
执行 publish
看发布摘要
必要时执行 schema diff
```

也就是说，AI 不再靠“读完整 Schema”保证安全，而是靠 CLI 的同步、合并和保护机制保证安全。

## 11. 最终用户体验

普通用户只需要：

```bash
openyida publish project/pages/src/home.oyd.jsx APP_XXX FORM_XXX
```

理想输出：

```text
已同步线上最新 Schema
本次更新：
- 页面源码
- 编译后代码
- render 入口

已保留：
- 3 个页面数据源
- Page 样式与标题配置
- 1 组组件别名
- 其它平台扩展字段

发布成功
```

用户如果在线上手动改了东西，也不用担心普通发布把它清空。

## 12. 总结

这件事的核心不是“每次都让 AI 查最新 Schema”。

核心是把 `publish` 做成一个安全合并器：

```text
线上 Schema 是底稿
本地代码是补丁
publish 负责把补丁打到底稿上
```

这样既能同步线上最新改动，也能控制 token 消耗，还能避免把用户在宜搭后台手工配置的内容覆盖掉。
