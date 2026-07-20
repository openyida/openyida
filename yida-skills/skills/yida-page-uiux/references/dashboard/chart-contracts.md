# 图表契约

## 基础要求

- 图表容器必须有稳定高度。
- 每个 series 必须有 name。
- legend/tooltip 文案使用业务名称。
- 颜色从 `--color-group` 或主题色组派生。
- Canvas 图表需要用 `getComputedStyle` 把 CSS var 解析成真实色值。

## 业务要求

- 每张图回答一个明确问题。
- 图表下方或卡片 footer 有一句具体洞察。
- 坐标轴使用紧凑格式，tooltip 使用完整格式。
- 多图同屏时主图更大，辅助图更克制。
