# 应用主题与 token 参考

本文件是 OpenYida 应用主题的统一参考。其他 skill 需要应用主题 key、平台候选主题或 token 变量时，引用本文，不在各自文档里重复维护完整主题清单。

主题选择先根据行业、品牌、业务情绪和视觉目标做创意判断，不能固定回到 `podBlue` 或 #1677ff，也不能套用“科技=蓝、宠物=橙、法律=蓝”这类行业刻板配色。`podBlue`、`podGreen`、`podOrange` 是常用浅底候选，不是默认答案；`blue`、`green`、`orange` 也是应用主题 token profile，保留原名，不自动改写成其他主题名。

`deepBlue`、`deepPurple`、`purple`、`yellow`、`magenta`、`red`、`greyBlue`、`coffee`、`black` 等属于平台支持主题；仅在用户明确指定、品牌匹配或业务确实需要时使用。普通业务页默认使用浅底主题，`black` 不作为默认主题。

注意：`openyida create-app/update-app --theme` 只能传平台支持的应用主题 key。若设计结果是任意自定义品牌色、渐变色盘或不在清单里的主题名，创建应用时不要显式传 `theme/colour`；把色盘写成 `style#yida-global-theme` 或 `customThemeStyle.tokens` 注入。页面级 `--theme-profile` / `style#yida-global-theme` 可以使用本文的应用主题 token profile。

## 应用主题 key 清单

| key | 颜色倾向 | 使用口径 |
| --- | --- | --- |
| `blue` | 基础蓝 | 按需 |
| `green` | 基础绿 | 按需 |
| `orange` | 基础橙 | 按需 |
| `podBule` | 平台蓝色 key | 按需 |
| `podBlue` | 平台蓝 | 常用候选，不默认 |
| `teal` | 青色 | 按需 |
| `podGreen` | 平台绿 | 常用候选，不默认 |
| `deepBlue` | 深蓝 | 按需 |
| `deepPurple` | 深紫 | 按需 |
| `purple` | 紫色 | 按需 |
| `podOrange` | 平台橙 | 常用候选，不默认 |
| `yellow` | 黄色 | 按需 |
| `magenta` | 玫红 | 按需 |
| `red` | 红色 | 按需 |
| `greyBlue` | 灰蓝 | 按需 |
| `royalBlue` | 皇家蓝 | 按需 |
| `lightBlue` | 浅蓝 | 按需 |
| `coffee` | 咖啡 | 按需 |
| `black` | 黑色 | 按需 |

## 应用主题 token profile

每个 profile 都按平台变量名记录。`--color-brand1-*` 是页面和 PC 端主要消费的品牌色阶，`--color-brand-*` 是移动端和部分原生表单/壳层桥接仍会消费的品牌色阶，不能删掉、改名或替换为别的变量。`--color-group` 用于图表和分组配色。

## 平台 token 语义

| token | 语义 | 典型用途 |
| --- | --- | --- |
| `--color-brand1-1` | 明亮品牌浅色或浅 hover 色 | 列表 hover、菜单 hover、轻量背景，不直接当深色文字 |
| `--color-brand1-2` | 品牌浅底 | 标签浅底、提示块、选中底、弱强调背景 |
| `--color-brand1-3` | 品牌透明/浅边界 | 选中边框、禁用/弱化品牌态、浅描边 |
| `--color-brand1-5` | 主色 hover 档 | 主按钮 hover、链接 hover、可点击强调 hover |
| `--color-brand1-6` | 主品牌色 | 主按钮、链接、选中态、重点标签、图表主序列 |
| `--color-brand1-7` | 主色 active 档 | 按下态、active、pressed |
| `--color-brand1-9` | 深主色 | 深色强调、深底按钮、强调标题、深色场景锚点 |
| `--color-brand1-10` | 深色或透明强调档 | 深色 hover、强强调背景、深色主题补充 |
| `--color-brand-1` | 移动端品牌浅/透明档 1 | 移动端壳层、移动端表单、旧版移动组件浅品牌态 |
| `--color-brand-2` | 移动端品牌浅/中档 2 | 移动端 hover、轻量强调、移动端组件浅色面 |
| `--color-brand-3` | 移动端主品牌档 3 | 移动端主操作、选中态、原生表单移动主色 |
| `--color-brand-4` | 移动端深品牌档 4 | 移动端 active、深色强调、移动壳层深色态 |
| `--color-group` | 图表和分类色组 | 多系列图表、排行、状态分组；第一色通常跟随主色 |

## blue

```json
{
  "--color-brand1-1": "rgb(51, 160, 255)",
  "--color-brand1-2": "rgb(242, 249, 255)",
  "--color-brand1-3": "rgba(0, 137, 255, 0.2)",
  "--color-brand1-6": "rgb(0, 137, 255)",
  "--color-brand1-9": "rgb(0, 109, 204)",
  "--color-brand1-10": "rgba(0, 137, 255, 0.3)",
  "--color-brand-1": "rgb(178, 219, 255)",
  "--color-brand-2": "rgb(51, 160, 255)",
  "--color-brand-3": "rgb(0, 137, 255)",
  "--color-brand-4": "rgb(0, 109, 204)"
}
```

## green

```json
{
  "--color-brand1-1": "rgb(60, 190, 113)",
  "--color-brand1-2": "rgb(246, 252, 248)",
  "--color-brand1-3": "rgba(64, 179, 112, 0.2)",
  "--color-brand1-6": "rgb(64, 179, 112)",
  "--color-brand1-9": "rgb(62, 170, 107)",
  "--color-brand1-10": "rgba(64, 179, 112, 0.3)",
  "--color-brand-1": "rgb(197, 232, 212)",
  "--color-brand-2": "rgb(60, 190, 113)",
  "--color-brand-3": "rgb(64, 179, 112)",
  "--color-brand-4": "rgb(62, 170, 107)"
}
```

## orange

```json
{
  "--color-brand1-1": "rgb(255, 125, 26)",
  "--color-brand1-2": "rgb(255, 248, 242)",
  "--color-brand1-3": "rgba(255, 111, 0, 0.2)",
  "--color-brand1-6": "rgb(255, 111, 0)",
  "--color-brand1-9": "rgb(242, 105, 0)",
  "--color-brand1-10": "rgba(255, 111, 0, 0.3)",
  "--color-brand-1": "rgb(255, 211, 178)",
  "--color-brand-2": "rgb(255, 125, 26)",
  "--color-brand-3": "rgb(255, 111, 0)",
  "--color-brand-4": "rgb(242, 105, 0)"
}
```

## podBule

```json
{
  "--color-brand1-1": "rgba(73, 164, 255, 1)",
  "--color-brand1-2": "rgba(224, 240, 255, 1)",
  "--color-brand1-3": "rgba(0, 127, 255, 0.2)",
  "--color-brand1-6": "rgba(0, 102, 255, 1)",
  "--color-brand1-9": "rgba(0, 82, 204, 1)",
  "--color-brand1-10": "rgba(0, 127, 255, 0.3)",
  "--color-brand-1": "rgba(0, 127, 255, 0.3)",
  "--color-brand-2": "rgba(73, 164, 255, 1)",
  "--color-brand-3": "rgba(0, 102, 255, 1)",
  "--color-brand-4": "rgba(0, 82, 204, 1)",
  "--color-group": "rgba(131, 137, 143, 0.16),rgba(0, 200, 255, 1),rgba(122, 95, 255, 1),rgba(0, 61, 153, 1),rgba(255, 107, 53, 1),rgba(102, 204, 102, 1)"
}
```

## podBlue

```json
{
  "--color-brand1-1": "rgba(73, 164, 255, 1)",
  "--color-brand1-2": "rgba(224, 240, 255, 1)",
  "--color-brand1-3": "rgba(0, 127, 255, 0.2)",
  "--color-brand1-6": "rgba(0, 102, 255, 1)",
  "--color-brand1-9": "rgba(0, 82, 204, 1)",
  "--color-brand1-10": "rgba(0, 127, 255, 0.3)",
  "--color-brand-1": "rgba(0, 127, 255, 0.3)",
  "--color-brand-2": "rgba(73, 164, 255, 1)",
  "--color-brand-3": "rgba(0, 102, 255, 1)",
  "--color-brand-4": "rgba(0, 82, 204, 1)",
  "--color-group": "rgba(131, 137, 143, 0.16),rgba(0, 200, 255, 1),rgba(122, 95, 255, 1),rgba(0, 61, 153, 1),rgba(255, 107, 53, 1),rgba(102, 204, 102, 1)"
}
```

## teal

```json
{
  "--color-brand1-1": "rgba(73, 180, 180, 1)",
  "--color-brand1-2": "rgba(224, 242, 242, 1)",
  "--color-brand1-3": "rgba(0, 149, 149, 0.2)",
  "--color-brand1-6": "rgba(0, 149, 149, 1)",
  "--color-brand1-9": "rgba(0, 104, 104, 1)",
  "--color-brand1-10": "rgba(0, 149, 149, 0.3)",
  "--color-brand-1": "rgba(0, 149, 149, 0.3)",
  "--color-brand-2": "rgba(73, 180, 180, 1)",
  "--color-brand-3": "rgba(0, 149, 149, 1)",
  "--color-brand-4": "rgba(0, 149, 149, 0.3)",
  "--color-group": "rgba(0, 149, 149, 1),rgba(0, 196, 196, 1),rgba(76, 175, 80, 1),rgba(0, 95, 95, 1),rgba(255, 107, 53, 1),rgba(160, 112, 255, 1)"
}
```

## podGreen

```json
{
  "--color-brand1-1": "rgba(73, 192, 109, 1)",
  "--color-brand1-2": "rgba(224, 244, 230, 1)",
  "--color-brand1-3": "rgba(0, 165, 50, 0.2)",
  "--color-brand1-6": "rgba(0, 165, 50, 1)",
  "--color-brand1-9": "rgba(0, 116, 35, 1)",
  "--color-brand1-10": "rgba(0, 165, 50, 0.3)",
  "--color-brand-1": "rgba(0, 165, 50, 0.3)",
  "--color-brand-2": "rgba(73, 192, 109, 1)",
  "--color-brand-3": "rgba(0, 165, 50, 1)",
  "--color-brand-4": "rgba(0, 116, 35, 1)",
  "--color-group": "rgba(0, 165, 50, 1),rgba(76, 217, 100, 1),rgba(0, 200, 140, 1),rgba(0, 95, 31, 1),rgba(255, 94, 91, 1),rgba(255, 159, 58, 1)"
}
```

## deepBlue

```json
{
  "--color-brand1-1": "rgba(116, 135, 236, 1)",
  "--color-brand1-2": "rgba(232, 235, 252, 1)",
  "--color-brand1-3": "rgba(57, 84, 228, 0.2)",
  "--color-brand1-6": "rgba(57, 84, 228, 1)",
  "--color-brand1-9": "rgba(42, 61, 159, 1)",
  "--color-brand1-10": "rgba(57, 84, 228, 0.3)",
  "--color-brand-1": "rgba(57, 84, 228, 0.3)",
  "--color-brand-2": "rgba(116, 135, 236, 1)",
  "--color-brand-3": "rgba(57, 84, 228, 1)",
  "--color-brand-4": "rgba(42, 61, 159, 1)",
  "--color-group": "rgba(57, 84, 228, 1),rgba(0, 122, 255, 1),rgba(138, 92, 253, 1),rgba(30, 41, 128, 1),rgba(255, 107, 53, 1),rgba(0, 200, 255, 1)"
}
```

## deepPurple

```json
{
  "--color-brand1-1": "rgba(144, 90, 253, 0.8)",
  "--color-brand1-2": "rgba(240, 233, 255, 1)",
  "--color-brand1-3": "rgba(144, 90, 253, 0.2)",
  "--color-brand1-6": "rgba(144, 90, 253, 1)",
  "--color-brand1-9": "rgba(93, 71, 138, 1)",
  "--color-brand1-10": "rgba(144, 90, 253, 0.32)",
  "--color-brand-1": "rgba(144, 90, 253, 0.32)",
  "--color-brand-2": "rgba(144, 90, 253, 0.8)",
  "--color-brand-3": "rgba(144, 90, 253, 1)",
  "--color-brand-4": "rgba(93, 71, 138, 1)",
  "--color-group": "rgba(144, 90, 253, 1),rgba(218, 102, 195, 1),rgba(252, 125, 41, 1),rgba(255, 188, 32, 1),rgba(67, 201, 102, 1),rgba(35, 205, 190, 1)"
}
```

## purple

```json
{
  "--color-brand1-1": "rgba(202, 97, 255, 1)",
  "--color-brand1-2": "rgba(246, 228, 255, 1)",
  "--color-brand1-3": "rgba(180, 33, 253, 0.2)",
  "--color-brand1-6": "rgba(180, 33, 253, 1)",
  "--color-brand1-9": "rgba(126, 23, 177, 1)",
  "--color-brand1-10": "rgba(180, 33, 253, 0.3)",
  "--color-brand-1": "rgba(180, 33, 253, 0.3)",
  "--color-brand-2": "rgba(202, 97, 255, 1)",
  "--color-brand-3": "rgba(180, 33, 253, 1)",
  "--color-brand-4": "rgba(126, 23, 177, 1)",
  "--color-group": "rgba(144, 90, 253, 1),rgba(218, 102, 195, 1),rgba(252, 125, 41, 1),rgba(255, 188, 32, 1),rgba(67, 201, 102, 1),rgba(35, 205, 190, 1)"
}
```

## podOrange

```json
{
  "--color-brand1-1": "rgba(253, 145, 0, 0.6)",
  "--color-brand1-2": "rgba(255, 242, 224, 1)",
  "--color-brand1-3": "rgba(253, 145, 0, 0.2)",
  "--color-brand1-6": "rgba(253, 145, 0, 1)",
  "--color-brand1-9": "rgba(177, 102, 0, 1)",
  "--color-brand1-10": "rgba(177, 102, 0, 0.32)",
  "--color-brand-1": "rgba(177, 102, 0, 0.32)",
  "--color-brand-2": "rgba(253, 145, 0, 0.6)",
  "--color-brand-3": "rgba(253, 145, 0, 1)",
  "--color-brand-4": "rgba(177, 102, 0, 1)",
  "--color-group": "rgba(253, 145, 0, 1),rgba(224, 90, 45, 1),rgba(252, 125, 41, 1),rgba(212, 160, 23, 1),rgba(47, 140, 130, 1),rgba(184, 154, 125, 1)"
}
```

## yellow

```json
{
  "--color-brand1-1": "rgba(177, 102, 0, 0.32)",
  "--color-brand1-2": "rgba(255, 247, 224, 1)",
  "--color-brand1-3": "rgba(253, 189, 0, 0.2)",
  "--color-brand1-6": "rgba(215, 161, 0, 1)",
  "--color-brand1-9": "rgba(177, 133, 0, 1)",
  "--color-brand1-10": "rgba(177, 133, 0, 0.32)",
  "--color-brand-1": "rgba(177, 102, 0, 0.32)",
  "--color-brand-2": "rgba(253, 145, 0, 0.6)",
  "--color-brand-3": "rgba(253, 145, 0, 1)",
  "--color-brand-4": "rgba(177, 102, 0, 1)",
  "--color-group": "rgba(215, 161, 0, 1),rgba(194, 77, 47, 1),rgba(217, 119, 6, 1),rgba(156, 167, 76, 1),rgba(45, 140, 132, 1),rgba(161, 107, 0, 1)"
}
```

## magenta

```json
{
  "--color-brand1-1": "rgba(204, 69, 182, 0.8)",
  "--color-brand1-2": "rgba(251, 243, 249, 1)",
  "--color-brand1-3": "rgba(204, 69, 182, 0.2)",
  "--color-brand1-6": "rgba(204, 69, 182, 1)",
  "--color-brand1-9": "rgba(176, 54, 155, 1)",
  "--color-brand1-10": "rgba(204, 69, 182, 0.32)",
  "--color-brand-1": "rgba(204, 69, 182, 0.32)",
  "--color-brand-2": "rgba(204, 69, 182, 0.8)",
  "--color-brand-3": "rgba(204, 69, 182, 1)",
  "--color-brand-4": "rgba(176, 54, 155, 1)",
  "--color-group": "#CC45B6,#992784,#E96BA5,#7D4FB8,#3AAFA9,#B89ACF"
}
```

## red

```json
{
  "--color-brand1-1": "rgba(242, 81, 12, 0.8)",
  "--color-brand1-2": "rgba(255, 236, 230, 1)",
  "--color-brand1-3": "rgba(255, 187, 153, 1)",
  "--color-brand1-6": "rgba(242, 81, 12, 1)",
  "--color-brand1-9": "rgba(204, 54, 0, 1)",
  "--color-brand1-10": "rgba(242, 81, 12, 0.32)",
  "--color-brand-1": "rgba(242, 81, 12, 0.32)",
  "--color-brand-2": "rgba(242, 81, 12, 0.8)",
  "--color-brand-3": "rgba(242, 81, 12, 1)",
  "--color-brand-4": "rgba(204, 54, 0, 1)",
  "--color-group": "#F2510C,#FF9500,#D12E1A,#7A2E00,#00B0D8,#34C759"
}
```

## greyBlue

```json
{
  "--color-brand1-1": "rgba(107, 124, 171, 0.8)",
  "--color-brand1-2": "rgba(243, 245, 251, 1)",
  "--color-brand1-3": "rgba(107, 124, 171, 0.2)",
  "--color-brand1-6": "rgba(107, 124, 171, 1)",
  "--color-brand1-9": "rgba(67, 84, 128, 1)",
  "--color-brand1-10": "rgba(107, 124, 171, 0.32)",
  "--color-brand-1": "rgba(107, 124, 171, 0.32)",
  "--color-brand-2": "rgba(107, 124, 171, 0.8)",
  "--color-brand-3": "rgba(107, 124, 171, 1)",
  "--color-brand-4": "rgba(67, 84, 128, 1)",
  "--color-group": "rgba(107, 124, 171, 1),rgba(126, 160, 195, 1),rgba(211, 195, 190, 1),rgba(209, 139, 88, 1),rgba(143, 104, 73, 1),rgba(107, 74, 48, 1)"
}
```

## royalBlue

```json
{
  "--color-brand1-1": "rgba(52, 113, 234, 0.8)",
  "--color-brand1-2": "rgba(234, 241, 255, 1)",
  "--color-brand1-3": "rgba(52, 113, 234, 0.2)",
  "--color-brand1-6": "rgba(52, 113, 234, 1)",
  "--color-brand1-9": "rgba(60, 103, 163, 1)",
  "--color-brand1-10": "rgba(52, 113, 234, 0.32)",
  "--color-brand-1": "rgba(52, 113, 234, 0.32)",
  "--color-brand-2": "rgba(52, 113, 234, 0.8)",
  "--color-brand-3": "rgba(52, 113, 234, 1)",
  "--color-brand-4": "rgba(60, 103, 163, 1)",
  "--color-group": "rgba(131, 137, 143, 0.16),rgba(0, 200, 255, 1),rgba(122, 95, 255, 1),rgba(0, 61, 153, 1),rgba(255, 107, 53, 1),rgba(102, 204, 102, 1)"
}
```

## lightBlue

```json
{
  "--color-brand1-1": "rgba(72, 204, 255, 0.8)",
  "--color-brand1-2": "rgba(236, 249, 254, 1)",
  "--color-brand1-3": "rgba(72, 204, 255, 0.2)",
  "--color-brand1-6": "rgba(72, 204, 255, 1)",
  "--color-brand1-9": "rgba(33, 143, 181, 1)",
  "--color-brand1-10": "rgba(72, 204, 255, 0.32)",
  "--color-brand-1": "rgba(72, 204, 255, 0.32)",
  "--color-brand-2": "rgba(72, 204, 255, 0.8)",
  "--color-brand-3": "rgba(72, 204, 255, 1)",
  "--color-brand-4": "rgba(33, 143, 181, 1)",
  "--color-group": "rgba(72, 204, 255, 1),rgba(52, 113, 234, 1),rgba(165, 91, 245, 1),rgba(218, 102, 195, 1),rgba(252, 125, 41, 1),rgba(255, 188, 32, 1)"
}
```

## coffee

```json
{
  "--color-brand1-1": "rgba(155, 136, 121, 0.8)",
  "--color-brand1-2": "rgba(243, 240, 239, 1)",
  "--color-brand1-3": "rgba(155, 136, 121, 0.2)",
  "--color-brand1-6": "rgba(155, 136, 121, 1)",
  "--color-brand1-9": "rgba(58, 55, 49, 1)",
  "--color-brand1-10": "rgba(155, 136, 121, 0.32)",
  "--color-brand-1": "rgba(155, 136, 121, 0.32)",
  "--color-brand-2": "rgba(155, 136, 121, 0.8)",
  "--color-brand-3": "rgba(155, 136, 121, 1)",
  "--color-brand-4": "rgba(58, 55, 49, 1)",
  "--color-group": "rgba(155, 136, 121, 1),rgba(210, 200, 171, 1),rgba(180, 158, 134, 1),rgba(230, 209, 190, 1),rgba(136, 122, 111, 1),rgba(58, 55, 49, 1)"
}
```

## black

```json
{
  "--color-brand1-1": "rgba(70, 73, 76, 1)",
  "--color-brand1-2": "rgba(242, 242, 246, 1)",
  "--color-brand1-3": "rgba(209, 210, 210, 1)",
  "--color-brand1-6": "rgba(24, 28, 31, 1)",
  "--color-brand1-9": "rgba(24, 28, 31, 1)",
  "--color-brand1-10": "rgba(181, 182, 183, 1)",
  "--color-brand-1": "rgba(181, 182, 183, 1)",
  "--color-brand-2": "rgba(70, 73, 76, 1)",
  "--color-brand-3": "rgba(24, 28, 31, 1)",
  "--color-brand-4": "rgba(24, 28, 31, 1)",
  "--color-group": "#3A3731, #9B8879,#D2C8AB,#B49E86,#E6D1BE,#887A6F"
}
```
