---
name: yida-density
description: 自定义页面信息密度设计规范。紧凑/舒适/宽松三种模式，支持密度切换和响应式降级。
---

# 信息密度设计规范

## 场景选择

| 场景 | 推荐密度 | 示例 |
|------|---------|------|
| 数据量大、专业用户 | **compact** | 运营后台、数据报表 |
| 常规业务 | **comfortable** | 表单填写、任务管理 |
| 重点突出、新手友好 | **spacious** | 移动端、展示大屏 |

## 密度变量

```javascript
var DENSITY_CONFIG = {
  compact: { cardPadding: '8px 12px', fontSize: '12px', lineHeight: '1.4', tableRowHeight: '32px', buttonHeight: '24px', inputHeight: '24px', sectionGap: '8px' },
  comfortable: { cardPadding: '16px 20px', fontSize: '14px', lineHeight: '1.6', tableRowHeight: '48px', buttonHeight: '32px', inputHeight: '32px', sectionGap: '16px' },
  spacious: { cardPadding: '24px 28px', fontSize: '16px', lineHeight: '1.8', tableRowHeight: '64px', buttonHeight: '40px', inputHeight: '40px', sectionGap: '24px' },
};
```

## 响应式降级

| 设备 | 默认密度 |
|------|----------|
| PC | comfortable |
| 移动端 | spacious |
| 大屏 | spacious |

## AI 决策规则

1. 用户未指定 → 根据场景自动选择
2. 列表/表格页 → 默认提供密度切换 UI
3. 移动端 → 固定 spacious，不提供切换
4. 表单填写页 → 固定 comfortable，不提供切换

完整示例代码见 [`examples/density-switch-page.js`](./examples/density-switch-page.js)
