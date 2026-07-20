# 自定义页面 JSX 组件指南

> 适用于宜搭自定义页面运行时：React 16、宜搭原生 `export function` 页面模式、无 `import/require`、通过 `this.utils.yida.*` 调用数据 API。

## 先说清楚边界

- 不要假设自定义页面能直接 `import` 宜搭内部表单组件；当前规范下应使用原生 JSX 元素、Tailwind `className` 和必要的内联兜底样式组合。
- Code Canvas 是自定义页面的默认链路（现代 React/hooks/可视化/AI）；本指南服务普通自定义页面 JSX/Jsx 组件链路，例如明确要求 `Jsx` 组件、`renderJsx`、或强依赖 `this.$(fieldId)`、`this.utils.yida.*`、`this.dataSourceMap`、表单提交/字段双向绑定深度耦合。用户要代码画布、`YidaCodeCanvas`、`runtimeCode`、`importedModules` 时，切换到 `yida-canvas-custom-page`。
- 不要把字段中文名当作 `fieldId`；字段 ID 必须来自 `openyida get-schema`。
- 不要把原生表单页面的组件配置 JSON 直接复制到自定义页面 JSX；两者不是同一个运行面。
- 如果确有平台内置选择器、上传器等 API，必须先由用户提供官方示例或在目标环境验证，再写入代码。

## 组件实现原则

1. **Tailwind 视觉优先 + native 控件 reset**：面向用户的控件默认用 Tailwind utility className 组合，并保留必要的 `style` 兜底；页面默认开启 Tailwind preflight，同时注入 `openyida-native-control-reset` 或等效页面级样式，避免 input/textarea/select/自定义下拉聚焦时出现浏览器黑色粗边。
2. **非受控输入**：输入类控件使用 `defaultValue` + `onChange` 写入 `_customState`，避免 `value` 受控模式导致输入卡顿或无法输入。
3. **字段值按接口格式保存**：DateField 使用毫秒时间戳；选择/成员/部门等字段以平台数据实际结构为准，未验证时只存 ID 或文本，不伪装复杂对象。
4. **禁用可见原生下拉**：用户可见的单选下拉不要使用 `<select>`；用 `button + menu + option` 自定义下拉，避免浏览器原生控件观感不一致。
5. **移动端考虑触控尺寸**：按钮和输入框高度建议不小于 36px，表格在移动端改为卡片列表或横向滚动。

## 通用状态写入

```javascript
export function setDraftField(key, value) {
  _customState.draft = _customState.draft || {};
  _customState.draft[key] = value;
}
```

带输入法组合输入的文本输入：

```jsx
var self = this;

<input
  className="oyd-input"
  defaultValue={_customState.keyword || ''}
  onCompositionStart={(e) => { self._isComposing = true; }}
  onCompositionEnd={(e) => {
    self._isComposing = false;
    _customState.keyword = e.target.value;
  }}
  onChange={(e) => {
    if (self._isComposing) { return; }
    _customState.keyword = e.target.value;
  }}
  style={styles.input}
/>
```

## TextField / TextareaField

```jsx
var self = this;

<input
  className="oyd-input"
  defaultValue={(record.formData && record.formData[FIELDS.name]) || ''}
  placeholder="请输入"
  onChange={(e) => { self.setDraftField(FIELDS.name, e.target.value); }}
  style={styles.input}
/>

<textarea
  className="oyd-input"
  defaultValue={(record.formData && record.formData[FIELDS.remark]) || ''}
  placeholder="请输入备注"
  onChange={(e) => { self.setDraftField(FIELDS.remark, e.target.value); }}
  style={styles.textarea}
/>
```

## SelectField / RadioField

选项值必须来自业务配置或已有数据，不要猜测平台选项对象结构。自定义页面批量提交时，先用简单值或经验证的对象结构。

面向用户的下拉交互默认使用自定义下拉组件，不使用原生 `<select>`。普通自定义页里也不要直接把表单设计器的 `SelectField` 当 React 筛选组件渲染；它是表单 schema 字段，不是 native 自定义页里的通用 UI 组件。组件状态放在 `_customState.openDropdown`，字段值通过 `setDraftField` 写入草稿。

视觉契约：
- 触发器必须有 `.oyd-select-arrow` 下箭头，打开时旋转并跟随主题色。
- 选中项必须有 `.oyd-select-check` 或等效选中标记，不能只靠加粗文字。
- light 模式下选中项整块背景必须用 `--oyd-control-selected-bg` 或等效低透明度浅色 token；不要直接用 `--color-brand1-1`，部分宿主主题会把它解析成过深的品牌底色。
- `.oyd-select-arrow` 和 `.oyd-select-check` 必须显式设置 `width/height/flex/display`，必要时加 `!important`，避免 reset 未生效时 SVG 使用浏览器默认大尺寸。
- 控件必须被 `openyida-native-control-reset` 或等效样式覆盖，避免 focus 时出现浏览器黑色粗边。
- 如果页面用 `.oyd-grade-page`、`.oyd-data-page` 等自定义作用域，reset 的 style id 必须页面专属；不要检测到全局 `openyida-native-control-reset` 就跳过注入，否则多页面切换后菜单项和 SVG 样式可能丢失。

```javascript
export function findOption(options, value) {
  var matched = options.filter((option) => option.value === value);
  return matched[0] || null;
}

export function toggleDropdown(key) {
  var nextOpen = _customState.openDropdown === key ? '' : key;
  _customState.openDropdown = nextOpen;
  this.forceUpdate();
}

export function chooseDropdown(key, value) {
  this.setDraftField(key, value);
  _customState.openDropdown = '';
  this.forceUpdate();
}
```

```jsx
export function renderDropdown(key, options, value, placeholder) {
  var self = this;
  var open = _customState.openDropdown === key;
  var selected = this.findOption(options, value);

  return (
    <div className="relative w-full" style={styles.dropdownWrap}>
      <button
        type="button"
        className="oyd-select-trigger flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-left text-sm text-slate-800 focus:outline-none"
        style={styles.selectTrigger}
        aria-expanded={open}
        onClick={(e) => { self.toggleDropdown(key); }}
      >
        <span className={selected ? 'oyd-select-trigger-label truncate text-slate-800' : 'oyd-select-trigger-label truncate text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="oyd-select-arrow" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.2 6.1a.7.7 0 0 1 1 0L8 8.9l2.8-2.8a.7.7 0 1 1 1 1L8.5 11.4a.7.7 0 0 1-1 0L4.2 7.1a.7.7 0 0 1 0-1z" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          className="oyd-select-menu absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          style={styles.selectMenu}
          role="listbox"
        >
          {options.map((option) => {
            var active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={active
                  ? 'oyd-select-option oyd-select-option-active flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium'
                  : 'oyd-select-option flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50'}
                style={active ? styles.optionActive : styles.option}
                onClick={(e) => { self.chooseDropdown(key, option.value); }}
              >
                <span>{option.label}</span>
                {active && (
                  <svg className="oyd-select-check" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6.4 11.7a.7.7 0 0 1-1 0L2.9 9.2a.7.7 0 1 1 1-1l2 2 6-6a.7.7 0 1 1 1 1l-6.5 6.5z" fill="currentColor" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

在 `renderJsx` 中调用：

```jsx
{this.renderDropdown(
  FIELDS.status,
  statusOptions,
  (record.formData && record.formData[FIELDS.status]) || '',
  '全部状态'
)}
```

兜底样式示例（Tailwind 未加载时仍可用）：

```javascript
var styles = {
  input: {
    width: '100%',
    height: 38,
    border: '1px solid #D0D5DD',
    borderRadius: 6,
    background: '#fff',
    padding: '0 12px',
    fontSize: 14,
    fontWeight: 400,
    outline: 'none',
    boxShadow: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    boxSizing: 'border-box',
  },
  dropdownWrap: { position: 'relative', width: '100%' },
  selectTrigger: {
    width: '100%',
    minHeight: 38,
    border: '1px solid #D0D5DD',
    borderRadius: 6,
    background: '#fff',
    padding: '0 12px',
    textAlign: 'left',
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
    fontWeight: 400,
    boxShadow: 'none',
    outline: 'none',
  },
  selectMenu: {
    position: 'absolute',
    zIndex: 30,
    marginTop: 6,
    width: '100%',
    background: '#fff',
    border: '1px solid #E4E7EC',
    borderRadius: 10,
    padding: 6,
    boxShadow: '0 16px 32px rgba(16,24,40,.14)',
  },
  option: {
    width: '100%',
    minHeight: 36,
    padding: '8px 12px',
    textAlign: 'left',
    background: '#fff',
    border: 0,
    borderRadius: 8,
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
    fontWeight: 400,
    outline: 'none',
    cursor: 'pointer',
  },
  optionActive: {
    width: '100%',
    minHeight: 36,
    padding: '8px 12px',
    textAlign: 'left',
    background: 'var(--oyd-control-selected-bg, #EFF6FF)',
    border: 0,
    borderRadius: 8,
    color: 'var(--color-brand1-6, #1D4ED8)',
    appearance: 'none',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
    fontWeight: 600,
    outline: 'none',
    cursor: 'pointer',
  },
};
```

## DateField

宜搭 DateField 常用毫秒时间戳。`input[type="date"]` 输出 `YYYY-MM-DD`，写入前转为毫秒。

```javascript
export function dateInputToTimestamp(value) {
  if (!value) { return ''; }
  var timestamp = new Date(value + 'T00:00:00').getTime();
  return isNaN(timestamp) ? '' : timestamp;
}
```

```jsx
var self = this;

<input
  className="oyd-input"
  type="date"
  defaultValue={self.formatDateInput(record.formData && record.formData[FIELDS.planDate])}
  onChange={(e) => { self.setDraftField(FIELDS.planDate, self.dateInputToTimestamp(e.target.value)); }}
  style={styles.input}
/>
```

## NumberField

保持空值为空字符串；有值时再转数字，避免把未填项误写成 `0`。

```jsx
var self = this;

<input
  className="oyd-input"
  type="number"
  defaultValue={(record.formData && record.formData[FIELDS.amount]) || ''}
  onChange={(e) => {
    var raw = e.target.value;
    self.setDraftField(FIELDS.amount, raw === '' ? '' : Number(raw));
  }}
  style={styles.input}
/>
```

## EmployeeField / DepartmentSelectField

普通自定义页面 JSX 里不能直接把表单设计器字段当 React 组件渲染。不要写未验证的 `<EmployeeField />`、`<DepartmentSelectField />`、`<AttachmentField />`、`<ImageField />`，也不要假设可以从 `@ali/deep` import。自定义页面只负责交互 UI 和数据提交；真正的字段组件优先放在表单页面里。

按场景选择：

- 查询/筛选场景：把成员/部门作为文本、userId、deptId 或候选项筛选，查询条件以真实接口支持为准。
- 编辑/提交场景：用业务候选列表、自定义下拉或已验证 picker 收集 userId/deptId，再通过 `this.utils.yida.saveFormData` / `updateFormData` 写入真实字段。
- 展示场景：优先展示接口返回的名称字段；没有名称时展示 userId/deptId。

必须遵守：

- `EmployeeField` 写值通常是成员 userId 数组，例如 `[userId]`；多人时是多个 userId。具体结构以 `get-schema` 和真实查询返回为准。
- `DepartmentSelectField` 写值通常是部门 id 数组或平台返回的部门值结构；不要把部门名称当作稳定主键。
- 同名成员/部门必须让用户或业务候选列表提供可区分的 userId/deptId，不得只凭名称写入。
- 如果用户要求“原生成员选择弹窗/通讯录选择器”，必须先拿到官方示例或在目标环境验证 picker API；未验证时只能实现候选列表选择或文本/ID 录入 fallback。

```jsx
{this.renderDropdown(
  FIELDS.owner,
  ownerOptions.map((user) => ({
    value: user.userId,
    label: user.name || user.userId,
  })),
  (record.formData && record.formData[FIELDS.owner]) || '',
  '请选择负责人'
)}
```

提交时按真实字段 ID 组装 payload：

```jsx
var payload = {};
payload[FIELDS.owner] = state.ownerUserId ? [state.ownerUserId] : [];
payload[FIELDS.department] = state.deptId ? [state.deptId] : [];

this.utils.yida.saveFormData({
  appType: APP_TYPE,
  formUuid: FORM_UUID,
  formDataJson: JSON.stringify(payload),
});
```

## ImageField / AttachmentField

上传能力依赖具体页面环境和接口权限。普通自定义页面 JSX 里不要把浏览器 `File` 对象、普通 URL 字符串或单个对象直接写进 `AttachmentField` / `ImageField`。

必须遵守：

- 不要写“可直接上传”的组件承诺。
- 可以展示已有图片/附件链接。
- 真正上传并写表单字段时，必须读取 [AttachmentField 上传指南](attachment-upload-guide.md)，走 `ossSign -> OSS 直传 -> 附件对象数组 -> saveFormData/updateFormData`。
- `ImageField` 也按附件对象数组链路处理；图片预览 URL 和下载 URL 以 OSS/平台返回为准。
- 上传成功不等于落表成功，必须在保存表单后再查询验证字段值。

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
var self = this;

<div style={styles.filterBar}>
  <input
    className="oyd-input"
    defaultValue={(_customState.filters && _customState.filters.keyword) || ''}
    placeholder="搜索关键词"
    onChange={(e) => {
      _customState.filters = _customState.filters || {};
      _customState.filters.keyword = e.target.value;
    }}
    style={styles.input}
  />
  <button
    type="button"
    onClick={(e) => { self.loadRecords({ page: 1 }); }}
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
    fontWeight: 400,
    outline: 'none',
    boxShadow: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    background: '#fff',
  },
  textarea: {
    minHeight: 80,
    padding: 10,
    border: '1px solid #d9dee8',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 400,
    outline: 'none',
    boxShadow: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
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
openyida get-schema APP_XXX FORM-XXX
```

如需保存完整 Schema，使用 create_file / Write / file edit tool 创建 `<projectRoot>/.cache/openyida/<项目名或任务名>/form-schema.json`；不要使用 shell 重定向。
