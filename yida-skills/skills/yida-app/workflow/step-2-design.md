# Step 2：并行生成 PRD 与视觉设计

完整应用使用一个共享需求简报和两个独立 artifact owner。`yida-app` 是 join owner，不直接代写 PRD 或视觉设计。

## 2.1 共享输入

执行 `use_skill("yida-requirement-analysis", "生成完整应用共享需求简报")`，写入：

- `.cache/openyida/<项目名>/requirement-brief.json`

文件存在、可解析且没有会改变资源范围的未决问题后，需求简报进入 ready。

需求简报、PRD 和视觉设计都是应用编排的内部 artifact。artifact start/end 只表达 owner 生命周期和 join 状态，不表示要向最终用户交付文件；不得为这三个文件调用宿主的用户可见 artifact、附件或交付工具。

需求简报进入 ready 后即作为本轮 artifact 的冻结输入。后续资源创建产生的 `appType`、`formUuid`、`fieldId` 等真实 ID 只写入 schema 或当前任务资源上下文，不回写简报，也不因此重跑两个 artifact owner；只有用户需求或已确认资源范围发生实质变化时，才重新生成简报和 artifact。

## 2.2 并行 artifact

共享简报 ready 后，同时启动：

| artifact | owner skill | 输出 | end 条件 |
| --- | --- | --- | --- |
| Product PRD | `yida-prd` | `prd/<项目名>/prd.md` | 资源蓝图、资源创建顺序、页面实现交付顺序、导航顺序、页面 handoff 和验收标准完整 |
| Visual Design | `yida-design` | `prd/<项目名>/design.md` | 主题 token、视觉 DNA、布局、材质、圆角、密度、组件、状态、响应式和页面场景引用完整 |

两个 owner 读取同一份需求简报，互不等待、互不写对方产物。一个 artifact 失败时只重跑其 owner，不覆盖已经 ready 的另一个 artifact。

## 2.3 join

`yida-app` 必须等待两个 artifact 都结束，再执行 join 校验：

- 两个文件路径存在且非空；
- PRD 每个 display 页面的 `designFile` 指向当前 `design.md`；
- PRD 的 `designRefs` 在 `design.md` 中可定位；
- 页面场景、主题摘要和 `explicitScope` 没有冲突；
- 冲突时业务范围交给 `yida-prd` 修正，视觉规则交给 `yida-design` 修正，不由 `yida-app` 猜测覆盖。

join 未通过时 Step 2 未完成，不得进入资源创建。join 通过后，`prd.md` 和 `design.md` 是后续页面实现的两份唯一事实源；`page-spec.json` 仅为派生 handoff。

## 主题文件实现指令

Step 2 只在 `design.md` 中确定主题色、`navTheme`、`logoSource` 和 `layoutDirection`，不传递平台 `--theme` key。进入 Step 3 后：

1. 执行复制命令：

   ```bash
   openyida sample yida-design app-theme --output .cache/openyida/<项目名>/app-theme.css
   ```

2. 按 `design.md` 的主题色修改复制文件中的对应 token。严禁重新生成或覆盖整份 CSS。
3. 主色写入 `--color-brand1-6`；保留 `--color-brand1-1/2/3/5/6/9/10`、`--color-brand-1` 至 `--color-brand-4` 和 `--color-group`；严禁补造 `--color-brand1-4/7/8`。
4. 创建应用时传入 `--theme-file`、`--nav-theme`、`--logo-source` 和 `--layout`，在应用级统一配置主题。平台统一作用于原生表单、详情页和自定义页面外层；`YidaCodeCanvas` 页面只在组件内部消费主题 token，严禁向上层注入或同步主题样式。

## 产出

进入 Step 3 前，必须确认：

- `prd.md` 和 `design.md` 路径存在；
- PRD 写明资源创建顺序、页面实现交付顺序、导航顺序或明确兜底策略；
- PRD 写明业务表单、流程表单、主页面和可选报表/大屏/权限等资源蓝图；
- `design.md` 能直接指导后续页面实现，不需要页面技能再反推视觉方向。

## 下一步

→ [Step 3：创建或复用应用](step-3-create-or-reuse-app.md)
