---
name: yida-density
description: 宜搭自定义页面信息密度设计规范。提供紧凑、舒适、宽松三种密度模式的样式模板，支持密度切换和响应式降级，帮助 AI 生成符合场景需求的页面布局。
license: MIT
compatibility:
  - opencode
  - claude-code
metadata:
  audience: developers
  workflow: yida-development
  version: 1.0.0
  tags:
    - yida
    - low-code
    - custom-page
    - density
    - layout
---

# 宜搭自定义页面信息密度设计规范

## 概述

不同业务场景对信息展示密度有不同需求。本规范定义三种标准密度模式，AI 在生成自定义页面时应根据场景自动选择合适的密度，或在页面中提供密度切换能力。

---

## 何时使用

| 场景 | 推荐密度 | 典型示例 |
| --- | --- | --- |
| 数据量大、专业用户、需一屏展示更多信息 | **紧凑（compact）** | 运营后台、数据报表、审批列表 |
| 常规业务场景、平衡信息量与可读性 | **舒适（comfortable）** | 表单填写、任务管理、日常审批 |
| 重点突出、新手友好、强调视觉舒适度 | **宽松（spacious）** | 移动端、展示大屏、引导页 |

---

## 三种密度的样式规范

### 密度变量定义

```javascript
var DENSITY_CONFIG = {
  compact: {
    cardPadding: '8px 12px',
    cardMarginBottom: '8px',
    fontSize: '12px',
    lineHeight: '1.4',
    tableRowHeight: '32px',
    buttonHeight: '24px',
    buttonPadding: '0 8px',
    inputHeight: '24px',
    iconSize: '14px',
    sectionGap: '8px',
  },
  comfortable: {
    cardPadding: '16px 20px',
    cardMarginBottom: '16px',
    fontSize: '14px',
    lineHeight: '1.6',
    tableRowHeight: '48px',
    buttonHeight: '32px',
    buttonPadding: '0 16px',
    inputHeight: '32px',
    iconSize: '16px',
    sectionGap: '16px',
  },
  spacious: {
    cardPadding: '24px 28px',
    cardMarginBottom: '24px',
    fontSize: '16px',
    lineHeight: '1.8',
    tableRowHeight: '64px',
    buttonHeight: '40px',
    buttonPadding: '0 24px',
    inputHeight: '40px',
    iconSize: '20px',
    sectionGap: '24px',
  },
};
```

---

## 完整示例代码

完整示例代码见 [`examples/density-switch-page.js`](./examples/density-switch-page.js)

---

## 响应式降级规则

| 设备 | 默认密度 | 说明 |
| --- | --- | --- |
| PC 端 | comfortable | 平衡信息量与可读性 |
| 移动端 | spacious | 触控友好，避免误操作 |
| 大屏展示 | spacious | 字体更大，远距离可读 |

在 `didMount` 中自动检测并降级：

```javascript
export function didMount() {
  if (this.utils.isMobile()) {
    _customState.density = 'spacious';
  }
}
```

---

## 何时提供密度切换 UI

| 场景 | 是否提供切换 |
| --- | --- |
| 数据量大的列表/表格页 | ✅ 提供，让用户自选 |
| 固定展示的报表/大屏 | ❌ 不提供，直接用 spacious |
| 移动端页面 | ❌ 不提供，固定 spacious |
| 表单填写页 | ❌ 不提供，固定 comfortable |

---

## AI 生成页面时的决策规则

1. **用户未指定密度** → 根据场景自动选择（见「何时使用」表格）
2. **用户说"紧凑/密集/更多信息"** → 使用 `compact`
3. **用户说"宽松/舒适/大字体"** → 使用 `spacious`
4. **列表/表格类页面** → 默认提供密度切换 UI
5. **移动端页面** → 始终使用 `spacious`，不提供切换
