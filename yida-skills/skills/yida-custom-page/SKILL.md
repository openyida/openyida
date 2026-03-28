---
name: yida-custom-page
description: 宜搭自定义页面 JSX 开发规范。React 16 类组件模式，宜搭 JS API 调用，状态管理与编码约束。
---

# 自定义页面开发

## 快速开始

```bash
openyida create-page <appType> <页面标题>     # 创建页面
# 在 project/pages/src/ 下编写 JSX
openyida publish <源文件> <appType> <formUuid>  # 发布
```

## 核心约束

| # | 约束 | 说明 |
|---|------|------|
| 1 | **React 16** | 禁止 Hooks（useState/useEffect），类组件模式 |
| 2 | **单文件** | 所有代码写在一个 `.js` 文件中 |
| 3 | **export function** | 所有需要 `this` 的方法必须用 `export function` 定义 |
| 4 | **事件绑定** | 必须箭头函数包裹：`onClick={(e) => { this.handleClick(e) }}` |
| 5 | **非受控输入** | `<input>` 用 `defaultValue`，onChange 写入 `_customState` |
| 6 | **内联样式** | 所有样式通过 JS 对象 + `style` 属性 |
| 7 | **pageSize ≤ 100** | 分页接口最大 100 |
| 8 | **ES2015** | 禁止 import/require |
| 9 | **定时器清理** | didUnmount 中清理所有 setInterval/setTimeout |
| 10 | **错误处理** | 所有 API 调用必须 .catch() 并 toast 提示 |

> 完整编码规范详见 [编码指南](references/coding-guide.md)。

## API 速查

### 表单数据（`this.utils.yida.<方法>(params)`）

| 方法 | 说明 | 必填参数 |
|------|------|----------|
| `saveFormData` | 新建实例 | `formUuid`, `appType`, `formDataJson` |
| `updateFormData` | 更新实例 | `formInstId`, `updateFormDataJson` |
| `deleteFormData` | 删除实例 | `formUuid` |
| `getFormDataById` | 查询详情 | `formInstId` |
| `searchFormDatas` | 搜索列表 | `formUuid` |
| `searchFormDataIds` | 搜索 ID 列表 | `formUuid` |

### 流程操作（`this.utils.yida.<方法>(params)`）

| 方法 | 说明 | 必填参数 |
|------|------|----------|
| `startProcessInstance` | 发起流程 | `formUuid`, `processCode`, `formDataJson` |
| `getProcessInstanceById` | 查询流程详情 | `processInstanceId` |
| `getProcessInstances` | 搜索流程列表 | — |

### 工具函数（`this.utils.<方法>()`）

| 方法 | 用途 |
|------|------|
| `toast` | 轻提示 |
| `dialog` | 对话框 |
| `formatter` | 日期/金额格式化 |
| `getLoginUserId` / `getLoginUserName` | 获取当前用户 |
| `isMobile` | 判断移动端 |
| `openPage` | 打开新页面 |
| `router.push` | 路由跳转 |
| `loadScript` | 动态加载脚本 |

完整参数说明见 [yida-api.md](../../reference/yida-api.md)、[model-api.md](../../reference/model-api.md)。

## 参考文档

| 文档 | 说明 |
|------|------|
| [编码指南](references/coding-guide.md) | 文件结构模板、状态管理、17 条编码注意事项 |
| [设计规范](references/design-system.md) | 色彩系统、圆角/字体/间距、组件样式模板 |
| [素材资源](references/assets-guide.md) | 图片/音乐/Icon 素材库、CDN 安全规范 |
