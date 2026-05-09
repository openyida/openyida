---
name: yida-ppt
description: >
  【已废弃】宜搭 PPT / 演示文稿旧技能。仅用于兼容用户继续提到 yida-ppt、旧版 PPT 技能或深色科技风 PPT。
  实际开发必须改用 yida-ppt-slider 技能；不要继续读取旧模板或复制旧代码。
license: MIT
compatibility:
  - opencode
  - claude-code
  - qoder
  - wukong
metadata:
  audience: developers
  workflow: yida-development
  version: 1.1.0
  tags:
    - yida
    - ppt
    - slides
    - deprecated
---

# yida-ppt 已废弃

本技能只保留兼容入口。所有宜搭 PPT / 幻灯片 / 演示文稿开发都应改用：

```text
../yida-ppt-slider/SKILL.md
```

## 执行规则

- 用户要求在宜搭中做 PPT、幻灯片、路演页或全屏演示页时，立即切换到 `yida-ppt-slider`。
- 如果用户明确说要旧版 `dark-tech` 风格，也使用 `yida-ppt-slider` 的 `dark-tech` 主题。
- 不要从本技能生成任何页面代码。
- 不要继续复制旧版内联 Canvas / 动画模板；这些实现已收敛到 `yida-ppt-slider`。

## 回复用户时

可以简短说明：

```text
yida-ppt 已合并到 yida-ppt-slider，我会使用新版 yida-ppt-slider 的对应主题来实现。
```

然后读取 `../yida-ppt-slider/SKILL.md` 并继续。
