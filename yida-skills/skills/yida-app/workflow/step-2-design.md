# Step 2：产品设计

完整应用只走统一产品设计。`yida-app` 不直接凭感觉定义字段、页面结构或视觉风格；这些事实由 `yida-design` 产出。

## 设计技能

执行 `use_skill("yida-design", "完整应用产品设计")`，让它基于 Step 1 的资源上下文输出：

- `prd/<项目名>/prd.md`
- `prd/<项目名>/design.md`

已有 app/page/form/process 只作为上下文复用；缺失资源按 PRD 的资源创建顺序落地，页面视觉按 `design.md` 落地。

## 设计职责边界

| 文件 | 职责 |
| --- | --- |
| `prd.md` | 应用基本信息、用户角色、核心任务、业务对象、数据结构、页面与功能、业务逻辑、交互状态、资源蓝图、资源创建顺序、页面实现交付顺序、导航顺序和验收标准 |
| `design.md` | 主题 token、视觉 DNA、布局密度、圆角规则、背景与卡片层次、组件规则、状态规则、响应式规则和页面视觉验收 |

`prd.md` 和 `design.md` 是唯一设计事实源。`page-spec.json` 只是页面实现阶段从二者派生的 handoff / 生成器输入，不是第三份设计文件。

## 主题 key

新版应用不再由设计产物选择或传递平台 `--theme` key。`design.md` 必须基于 `app-custom-theme-template.css` 给出应用 CSS、`navTheme`、`logoSource` 和新版 `layoutDirection`；CSS 完整声明平台实际生成的 `--color-brand1-1/2/3/5/6/9/10`，保留 `--color-brand-1` 至 `--color-brand-4` 和 `--color-group`，不得补造 `--color-brand1-4/7/8`。模板默认使用 coffee 咖啡色与大圆角；只有设计结论明确变化时才成套调整。主色写入 `--color-brand1-6`，创建阶段通过 `create-app --theme-file/--nav-theme/--logo-source/--layout` 联合保存。运行容器负责让页面、表单和详情页加载同一应用主题文件。

## 产出

进入 Step 3 前，必须确认：

- `prd.md` 和 `design.md` 路径存在；
- PRD 写明资源创建顺序、页面实现交付顺序、导航顺序或明确兜底策略；
- PRD 写明业务表单、流程表单、主页面和可选报表/大屏/权限等资源蓝图；
- `design.md` 能直接指导后续页面实现，不需要页面技能再反推视觉方向。

## 下一步

→ [Step 3：创建或复用应用](step-3-create-or-reuse-app.md)
