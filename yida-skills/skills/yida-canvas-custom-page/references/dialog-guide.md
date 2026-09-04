# 对话框

新增或改造 CodeCanvas 对话框时，先复制共享组件，将 import 和 `CanvasDialog` 合并到当前 `.canvas.jsx`，组件与调用代码保存在同一文件中。

```bash
openyida sample openyida-page-template canvas-dialog --output .cache/samples/canvas-dialog.jsx
```

页面使用受控组件，把确认、取消、提交中和错误状态接到业务逻辑：

```jsx
<CanvasDialog
  open={confirmOpen}
  title="确认归档"
  okText="归档"
  cancelText="取消"
  confirmLoading={saving}
  onOk={handleArchive}
  onCancel={() => setConfirmOpen(false)}
>
  <p>归档后，该记录将移入历史记录。</p>
</CanvasDialog>
```

`handleArchive` 负责提交和错误提示：等待成功后再关闭，失败保留对话框，并在 finally 中解除 `saving`。提交期间需要阻止取消时，在 `onCancel` 中判断 `saving`。组件透传 Modal 的 `footer`、`okButtonProps`、`cancelButtonProps`、宽度等属性；危险操作使用 `okButtonProps={{ danger: true }}`。普通说明可以传 `footer={null}`。

## 主题

- 背景、边框、圆角、阴影、标题、正文、页脚与关闭按钮消费 Fusion `--dialog-*`；按钮消费 `--btn-pure-*` / `--btn-warning-*`，保留基础色与 Pod 卡片 token 回退。
- 样式限定在 `openyida-dialog`，覆盖挂载到 body 的对话框。保留 CSS `var(...)`，响应应用主题更新；主题变量需在浮层节点或其祖先可继承的位置。
- 所有视觉风格都使用该组件。只有整体暗色、黑色或夜间界面才按 [暗色浮层规则](../../yida-design/references/theme/theme-token-presets.md#暗色主题浮层适配) 配置暗色 token；仅导航深色不触发。应用主题仍由 `yida-design` 输出到 `app-theme.css`。
- 页面内确认操作统一使用受控 `CanvasDialog`。维护已有 `Modal.confirm/info` 或平台 `utils.dialog` 时，按其实际渲染节点单独接入主题；平台对话框保留原有 API，通过应用主题适配 `next-dialog` / Deep 节点。
- 内容里的 Input、Select、Table 等按页面组件主题规则接入，分别核对各控件的背景、文字与交互状态。

验收实际打开对话框，检查浅色/暗色下的背景、标题、正文、关闭按钮、确认/取消按钮及 hover、禁用状态；同时验证确认、取消、Esc、提交失败保留和成功关闭，确保页面外的对话框未被样式影响。
