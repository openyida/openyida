---
name: yida-canvas-table-form
description: 自定义页面表格批量录入技能。使用 `YidaCodeCanvas` 组件和 antd Table、Input、Select、DatePicker、React hooks 实现草稿、行级校验、分批并发提交和行级错误保留。`YidaCodeCanvas` 组件内不能直接调用 this.utils.yida.*；写入默认消费发布层注入的 window.__OPENYIDA_YIDA_API__，也可走已验证连接器或同源业务桥，未验证时不得声称提交闭环。
---

# 自定义页面表格批量录入

## 核心定位

本技能是“批量录入 / 表格填写 / Excel 式多行编辑”的默认实现链路：

- `.canvas.jsx` / `.canvas.tsx` + `YidaComp`。
- React hooks 管理行状态、草稿和提交流程。
- antd `Table`、`Input`、`Select`、`DatePicker` 构建行内编辑。
- 分批并发写入，每行独立记录成功或失败。
- 写入能力由显式、已验证的数据桥提供。

`yida-table-form` 保留给已检测到的平台 JSX 组件页面或 native 页面：仅当目标页面已确认依赖平台实例桥，或存量源码已确认使用 `this.utils.yida.saveFormData` 时使用。

## 路由边界

| 用户意图 | 选择 |
| --- | --- |
| 默认批量录入、表格填写、多行编辑 | `yida-canvas-table-form` |
| YidaCodeCanvas 组件 + antd Table | `yida-canvas-table-form` |
| 已检测到平台 JSX 组件页面/native 页面 | `yida-table-form` |
| 明确要求 `this.utils.yida.saveFormData` | `yida-table-form` |
| 只需 CLI 批量写入数据，不开发页面 | `yida-data-management` |
| 需要创建或调整表单字段 | `yida-create-form-page` |

## 致命规则（FATAL）

1. **YidaCodeCanvas 组件内没有平台 JSX 组件实例桥**：禁止在 `YidaComp` 源码中直接调用 `this.utils.yida.*`、`this.$(...)` 或 `this.dataSourceMap`；需要宜搭表单写入时消费发布层注入的 `window.__OPENYIDA_YIDA_API__`。
2. **写入桥必须先验证**：默认使用 `window.__OPENYIDA_YIDA_API__.saveFormData/updateFormData`，也可使用已验证连接器代理或同源业务桥。必须确认目标 `appType/formUuid`、请求体、返回体和错误码。
3. **未验证不得伪装闭环**：桥未配置或未验证时，提交按钮禁用或进入清晰的“待接入”状态；不得模拟成功、生成假 `formInstId` 或宣称数据已写入宜搭。
4. **提交前先验证并确认**：先完成行级校验，再向用户展示待提交行数和关键字段摘要，获得确认后发起写入。
5. **分批并发而非无限并发**：按固定批次切分，批次内使用 `Promise.all` 并发，批次间顺序推进；不得逐行串行，也不得一次性无限并发。
6. **失败行必须保留**：每行保存 `_status`、`_errors` 和 `_submitError`；部分失败后只重试失败行，成功行不能重复提交。
7. **真实交付要发布证据**：创建或修改 `.canvas.jsx` / `.canvas.tsx` 页面源码后，只有 `openyida publish <source> <appType> <displayPageFormUuid>` 成功才能声明页面已发布。

## 数据桥契约

推荐让运行环境、连接器适配层或页面装配代码显式注入：

```javascript
const writeBridge = {
  verified: true,
  name: 'same-origin-form-write-v1',
  async saveRow(payload, context) {
    // context: { rowId, idempotencyKey }
    // 调用已验证的同源接口或连接器代理
    return { formInstId: '真实接口返回值' };
  },
};
```

页面只在满足以下条件时允许提交：

- `writeBridge.verified === true`。
- `typeof writeBridge.saveRow === 'function'`。
- 目标表单字段 ID 已由 `yida-get-schema` 取证。
- 写入返回值能确定该行成功，失败会抛出带可展示信息的错误。
- 重试策略有幂等键，或后端能防止重复记录。

不要把 access token、密钥或连接器凭据写入页面源码。它们应保留在宜搭同源会话、连接器或后端服务侧。

## 行状态

```javascript
{
  _rowId: 'row_...',
  _status: 'draft', // draft | invalid | submitting | submitted | failed
  _errors: {},
  _submitError: '',
  fieldId_name: '',
  selectField_status: '',
  dateField_dueAt: ''
}
```

- 修改单元格后清除该字段错误，并把 `failed` / `invalid` 行恢复为 `draft`。
- 草稿使用 `localStorage`，key 至少包含目标 `formUuid`，避免不同表单串稿。
- 保存草稿时排除敏感字段；页面明确告知草稿只保存在当前浏览器。
- 全部成功后清除草稿；部分失败时保留失败行和错误，成功行标记为 `submitted`。

## 分批并发模板

```javascript
async function submitInBatches(rows, writeBridge, batchSize) {
  const results = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map(async (row) => {
      try {
        const value = await writeBridge.saveRow(toPayload(row), {
          rowId: row._rowId,
          idempotencyKey: 'canvas-table:' + row._rowId,
        });
        return { rowId: row._rowId, ok: true, value };
      } catch (error) {
        return { rowId: row._rowId, ok: false, error: error.message || '提交失败' };
      }
    }));
    results.push(...batchResults);
  }
  return results;
}
```

每批建议 5-20 行，具体以已验证接口限流为准。不要对失败行自动无限重试。

## 开发流程

下面命令以仓库根为视角；如果 cwd 已是 `<workspace>/project`，把 `project/pages/src/...` 改成 `pages/src/...`。

```bash
# 1. 取得真实字段 ID
openyida get-schema <appType> <formUuid> --field-map-json

# 2. 编写表格批量录入页面

# 3. 接入并验证 window.__OPENYIDA_YIDA_API__ / 连接器 / 数据桥
# 未验证前保持 writeBridge.verified !== true

# 4. 本地快检
node -e "const fs=require('fs'); const {compileCanvasLocal}=require('./lib/app/canvas-compile'); const src=fs.readFileSync('project/pages/src/table-form-batch-submit.canvas.jsx','utf8'); console.log(compileCanvasLocal(src).importedModules)"

# 5. 真实交付时发布
openyida publish project/pages/src/table-form-batch-submit.canvas.jsx <appType> <displayPageFormUuid>
```

## 验收清单

- [ ] 使用 `.canvas.jsx` / `.canvas.tsx`、`YidaComp`、hooks 和 antd 表格控件。
- [ ] 源码不含 `this.utils.yida.*`、`this.$`、`this.dataSourceMap`。
- [ ] 字段 ID 来自真实 Schema，不按 label 猜测。
- [ ] 刷新可恢复草稿，全部成功后草稿被清除。
- [ ] 必填、类型、范围等错误显示在对应行和单元格。
- [ ] 提交前显示行数与关键字段摘要并要求确认。
- [ ] 分批并发受控，成功/失败数量可见。
- [ ] 部分失败后失败行可编辑、可单独重试，成功行不会重复写入。
- [ ] 未验证写入桥时按钮禁用并显示未闭环原因。
- [ ] 真实接口验证与页面发布都有证据后，才声明完整交付。

## 完成证据

- 本地样例：`compileCanvasLocal` 成功，依赖清单包含 `react`、`antd`、`dayjs`。
- 写入闭环：已验证数据桥真实返回逐行写入结果，部分失败与重试路径经过验证。
- 页面交付：目标 `.canvas.jsx` 已成功发布。
- 缺少任一远程证据时，明确报告“本地页面已完成，写入桥/远程发布尚未验证”。
