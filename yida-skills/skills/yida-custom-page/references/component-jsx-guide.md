# 自定义页面 JSX 组件指南

> 适用于宜搭自定义页面运行时：React 16、类组件绑定、无 `import/require`、通过 `this.utils.yida.*` 调用数据 API。

## 先说清楚边界

- 不要假设自定义页面能直接 `import` 宜搭内部表单组件；当前规范下应使用原生 JSX 元素和内联样式组合。
- 不要把字段中文名当作 `fieldId`；字段 ID 必须来自 `openyida get-schema`。
- 不要把原生表单页面的组件配置 JSON 直接复制到自定义页面 JSX；两者不是同一个运行面。
- 如果确有平台内置选择器、上传器等 API，必须先由用户提供官方示例或在目标环境验证，再写入代码。

## 组件实现原则

1. **原生控件优先**：输入、选择、筛选、表格、按钮用 `<input>`、`<select>`、`<textarea>`、`<button>`、`<table>` 等 JSX 元素组合。
2. **非受控输入**：输入类控件使用 `defaultValue` + `onChange` 写入 `_customState`，避免 `value` 受控模式导致输入卡顿或无法输入。
3. **字段值按接口格式保存**：DateField 使用毫秒时间戳；选择/成员/部门等字段以平台数据实际结构为准，未验证时只存 ID 或文本，不伪装复杂对象。
4. **样式内联**：使用 JS 对象和 `style`，不要依赖外部 CSS、CSS Modules 或构建期能力。
5. **移动端考虑触控尺寸**：按钮和输入框高度建议不小于 36px，表格在移动端改为卡片列表或横向滚动。

## 通用状态写入

```javascript
export function setDraftField(key, value) {
  this._customState = this._customState || {};
  this._customState.draft = this._customState.draft || {};
  this._customState.draft[key] = value;
}
```

带输入法组合输入的文本输入：

```jsx
<input
  defaultValue={this._customState.keyword || ''}
  onCompositionStart={() => { this._isComposing = true; }}
  onCompositionEnd={(e) => {
    this._isComposing = false;
    this._customState.keyword = e.target.value;
  }}
  onChange={(e) => {
    if (this._isComposing) { return; }
    this._customState.keyword = e.target.value;
  }}
  style={styles.input}
/>
```

## TextField / TextareaField

```jsx
<input
  defaultValue={(record.formData && record.formData[FIELDS.name]) || ''}
  placeholder="请输入"
  onChange={(e) => { this.setDraftField(FIELDS.name, e.target.value); }}
  style={styles.input}
/>

<textarea
  defaultValue={(record.formData && record.formData[FIELDS.remark]) || ''}
  placeholder="请输入备注"
  onChange={(e) => { this.setDraftField(FIELDS.remark, e.target.value); }}
  style={styles.textarea}
/>
```

## SelectField / RadioField

选项值必须来自业务配置或已有数据，不要猜测平台选项对象结构。自定义页面批量提交时，先用简单值或经验证的对象结构。

```jsx
<select
  defaultValue={(record.formData && record.formData[FIELDS.status]) || ''}
  onChange={(e) => { this.setDraftField(FIELDS.status, e.target.value); }}
  style={styles.input}
>
  <option value="">全部状态</option>
  {statusOptions.map((option) => (
    <option key={option.value} value={option.value}>{option.label}</option>
  ))}
</select>
```

## DateField

宜搭 DateField 常用毫秒时间戳。`input[type="date"]` 输出 `YYYY-MM-DD`，写入前转为毫秒。

```javascript
export function dateInputToTimestamp(value) {
  if (!value) { return ''; }
  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(timestamp) ? '' : timestamp;
}
```

```jsx
<input
  type="date"
  defaultValue={this.formatDateInput(record.formData && record.formData[FIELDS.planDate])}
  onChange={(e) => { this.setDraftField(FIELDS.planDate, this.dateInputToTimestamp(e.target.value)); }}
  style={styles.input}
/>
```

## NumberField

保持空值为空字符串；有值时再转数字，避免把未填项误写成 `0`。

```jsx
<input
  type="number"
  defaultValue={(record.formData && record.formData[FIELDS.amount]) || ''}
  onChange={(e) => {
    const raw = e.target.value;
    this.setDraftField(FIELDS.amount, raw === '' ? '' : Number(raw));
  }}
  style={styles.input}
/>
```

## EmployeeField / DepartmentField

在没有已验证 picker API 时，不要编造成员选择器。可采用以下保守方案：

- 查询场景：把成员/部门作为文本筛选条件展示，实际查询条件以接口支持为准。
- 编辑场景：只接受已知用户 ID/部门 ID，或让用户从业务侧提供的候选列表中选择。
- 展示场景：优先展示接口返回的名称字段；没有名称时展示 ID。

```jsx
<select
  defaultValue={(record.formData && record.formData[FIELDS.owner]) || ''}
  onChange={(e) => { this.setDraftField(FIELDS.owner, e.target.value); }}
  style={styles.input}
>
  <option value="">请选择负责人</option>
  {ownerOptions.map((user) => (
    <option key={user.userId} value={user.userId}>{user.name || user.userId}</option>
  ))}
</select>
```

## ImageField / AttachmentField

上传能力依赖具体页面环境和接口权限。没有经验证上传接口时：

- 不要写“可直接上传”的组件承诺。
- 可以展示已有图片/附件链接。
- 如用户提供上传接口或 CDN 配置，按 `openyida cdn-upload` 或已验证接口处理。

```jsx
{attachments.map((file) => (
  <a key={file.url} href={file.url} target="_blank" rel="noreferrer" style={styles.link}>
    {file.name || file.url}
  </a>
))}
```

## TableField / 数据表格

自定义页面中的表格通常是展示或批量编辑 UI，不等同于宜搭原生子表组件。批量写入子表数据前必须确认接口接受的数据结构。

```jsx
<table style={styles.table}>
  <thead>
    <tr>
      <th style={styles.th}>客户</th>
      <th style={styles.th}>金额</th>
      <th style={styles.th}>状态</th>
    </tr>
  </thead>
  <tbody>
    {records.map((record) => (
      <tr key={record.formInstId}>
        <td style={styles.td}>{record.formData[FIELDS.customerName]}</td>
        <td style={styles.td}>{record.formData[FIELDS.amount]}</td>
        <td style={styles.td}>{record.formData[FIELDS.status]}</td>
      </tr>
    ))}
  </tbody>
</table>
```

## 筛选栏

筛选栏建议由关键词、状态、日期范围和按钮组成；点击查询时统一读取 `_customState.filters`，再调用 `this.utils.yida.searchFormDatas`。

```jsx
<div style={styles.filterBar}>
  <input
    defaultValue={(this._customState.filters && this._customState.filters.keyword) || ''}
    placeholder="搜索关键词"
    onChange={(e) => {
      this._customState.filters = this._customState.filters || {};
      this._customState.filters.keyword = e.target.value;
    }}
    style={styles.input}
  />
  <button
    type="button"
    onClick={() => { this.loadRecords({ page: 1 }); }}
    style={styles.primaryButton}
  >
    查询
  </button>
</div>
```

## 最小样式基线

```javascript
const styles = {
  input: {
    height: 36,
    padding: '0 10px',
    border: '1px solid #d9dee8',
    borderRadius: 4,
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  textarea: {
    minHeight: 80,
    padding: 10,
    border: '1px solid #d9dee8',
    borderRadius: 4,
    fontSize: 14,
    outline: 'none',
    resize: 'vertical',
  },
  primaryButton: {
    height: 36,
    padding: '0 14px',
    border: '1px solid #1f6feb',
    borderRadius: 4,
    background: '#1f6feb',
    color: '#fff',
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '10px 12px',
    borderBottom: '1px solid #e6eaf0',
    textAlign: 'left',
    fontWeight: 600,
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #edf0f5',
  },
};
```

## 发布前检查

```bash
openyida check-page pages/src/page.jsx
openyida compile pages/src/page.jsx
```

如果页面使用字段 ID、提交数据或构造查询条件，发布前还必须重新确认 Schema：

```bash
openyida get-schema APP_XXX FORM-XXX > .cache/form-schema.json
```
