# 表单详情页 CSS 注入流程

## 核心原则

表单提交页和详情页样式统一进入表单 Schema JS。保存表单 Schema 前必须更新 `actions.module.source`，并让根节点 `componentDidMount` 指向 `openyidaThemeDidMount`。

- `style#yida-global-theme`：全局主题 token，提交页和详情页都必须注入。
- `style#yida-form-detail-style`：详情页结构样式，只在运行时检测到 `formDetail` 页面时注入。

## API 顺序

### 1. 获取 Schema

```http
GET /alibaba/web/{appType}/_view/query/formdesign/getFormSchema.json?formUuid={formUuid}&schemaVersion=V5
```

若当前环境返回的 Schema 包在 `content` 字段内，先解析 `content`。

### 2. 更新表单 JS

使用公共注入脚本，保证重复执行幂等：

```js
const { ensureYidaGlobalThemeAction } = require('./form-theme-action');

ensureYidaGlobalThemeAction(schema, {
  formDetailCss: '/* yida-form-detail */\\n.vc-page-yida-page.vc-page.yida-formDetail { ... }',
});
```

Schema 必须同时满足：

- `actions.module.source` 包含 `/* openyida:theme:start */`。
- `componentsTree[0].lifeCycles.componentDidMount.name` 等于 `openyidaThemeDidMount`。
- `actions.list` 包含 `id: "openyidaThemeDidMount"` 且 `relatedEventId: "lifecycle:didMount"`。
- action 源码包含 `style.id = "yida-global-theme"` 或等价的 `style#yida-global-theme` 写入逻辑。
- action 源码包含 `openyidaThemeIsFormDetail`，并只在 formDetail 页面写入 `style#yida-form-detail-style`。

运行时规则：

- `openyidaThemeDidMount` 先调用表单原有 `didMount`。
- 始终向当前文档和同源可访问父级文档写入 `style#yida-global-theme`。
- 仅当文档 URL 或 DOM 命中 `formDetail` 时写入 `style#yida-form-detail-style`。
- 非详情页不写入详情页结构 CSS；如果存在旧的 `style#yida-form-detail-style`，移除。

### 3. 保存 Schema

```http
POST /dingtalk/web/{appType}/_view/query/formdesign/saveFormSchema.json
Content-Type: application/x-www-form-urlencoded
```

Body:

```json
{
  "formUuid": "FORM-XXX",
  "content": "JSON.stringify(schema)",
  "schemaVersion": "V5",
  "importSchema": "true"
}
```

说明：

- 使用 `/dingtalk/web/{appType}/_view/...` 前缀。
- `schemaVersion` 必须是字符串 `V5`。
- `importSchema` 建议传字符串 `"true"`，与 OpenYida 表单保存链路保持一致。

## 校验

1. 重新获取 Schema，确认存在：
   - `actions.module.source` 包含 `openyida:theme`
   - `componentDidMount.name` 等于 `openyidaThemeDidMount`
   - `actions.module.source` 包含 `yida-global-theme`
   - `actions.module.source` 包含 `yida-form-detail-style`
   - `actions.module.source` 包含 `openyidaThemeIsFormDetail`
2. 执行：
   ```bash
   openyida form-detail-style check <appType> <formUuid> --json
   ```
   结果必须包含 `globalThemeActionFound: true` 和 `formDetailStyleActionFound: true`。
3. 如果已有一条数据记录，可以打开：
   ```text
   {base_url}/{appType}/formDetail/{formUuid}?formInstId={formInstId}&navConfig.layout=1180&isRenderNav=false
   ```

## 注入方式

| 方式 | 是否使用 | 说明 |
| --- | --- | --- |
| 表单 JS 注入 | 必须 | `openyidaThemeDidMount` 统一写入全局主题和详情页条件样式 |
| `RichTextField` 注入 | 不使用 | 组件注册不完整时会出现“组件未找到” |
