# Step 3：创建或复用应用

按 Step 1 的资源上下文和 Step 2 的 PRD 确认目标应用。已有 app 直接复用；缺少 app 且允许创建时才创建。

## 输入

- Step 1 的 app resource context；
- `prd/<项目名>/prd.md`；
- `prd/<项目名>/design.md`。

## 调度边界

本步骤分为“取得 appType”和“主题设置同步”两条工作。真实 `appType` 就绪后立即启动 Step 4，主题任务按 [主题与业务资源的依赖](parallel-work.md#主题与业务资源的依赖) 与表单创建、页面开发并行。主题生成本身只依赖已确认主题，不要求先拿到 appType；下列序号说明操作职责，不代表必须依次等待。

## 操作

1. 已有 `appType`、应用 URL 或已绑定 app → 直接复用该 app。
2. 缺少 app 且 Step 1 判定 `allowCreate=true` → 执行 `use_skill("yida-create-app", "按 PRD 创建应用并获取 appType")`，再按 PRD 创建应用。
3. 创建或复用后提取真实 `appType`，写入 `.cache/<项目名>-schema.json` 或当前任务资源上下文。
   - Step 2 已确认的 `requirement-brief.json`、PRD 与 design 保持不变；不得仅因拿到真实 `appType` 回写需求文件或重新生成 PRD 和视觉设计。
4. 用户确认计划或主题后立即准备 CSS，不等表单或页面完成。创建完整应用时，Plan 复用 `materialize` 返回的 `outputs.theme`。其他场景用以下命令生成或更新主题：

   ```bash
   openyida sample yida-design app-theme --output .cache/openyida/<项目名>/app-theme.css --design-file prd/<项目名>/design.md
   ```

   CLI 首次复制公共模板，后续更新 token 并保留自定义样式。整体暗色方案还需按 [浮层适配](../../yida-design/references/theme/theme-token-presets.md#暗色主题浮层适配) 在该文件末尾补充必要的 class 覆盖；仅深色导航不触发此操作。
5. 主题文件就绪且已有真实 `appType` 后，立即通过独立任务更新应用基础设置，与表单和页面开发并行：

   ```bash
   openyida update-app <appType> --theme-file <app-theme.css> --colour custom --nav-theme <light|dark> --logo-source appIcon --layout <l_shape|top|side>
   ```

   主题文件的职责与生效边界见 [应用主题 CSS 的职责](../../yida-design/workflow/output-design.md#应用主题-css-的职责)，使用当前流程记录的实际 CSS 路径。

   `create-app` 只负责获取应用，创建阶段不提交 `colour`、`navTheme`、`layoutDirection` 等应用设置，统一等待主题 CSS 生成后同步更新。`update-app --theme-file` 上传 CSS 到主题资源接口，再调用 `updateApp` 保存 `colour=custom`、从 `--color-brand1-6` 提取的 `themeColor`、含资源 URL 的 `customThemeStyle` 和导航配置；不要额外传 `--theme-color`。只有用户明确只创建空壳或暂不配置主题时才跳过这一步。
   必须收到 `themeVerification.verified=true` 且 `customThemeStyle.enabled=true`、`cssUrl` 非空，才能确认应用设置已绑定主题资源。失败时使用同一个 `appType` 修复并重试 `update-app --theme-file`，不得重复创建应用。CSS 后续有修改时也必须重新执行该更新命令，仅修改本地文件不会更新应用设置。
6. 已有 app 不自动改名。外部工具预创建 app 时，OpenYida 侧只复用 `appType`，但用户明确要求应用级换肤时可以执行上一步主题更新。

## 应用导航配置

按 PRD 的 [导航类型](../../yida-prd/workflow/output-prd.md#导航类型与执行配置) 设置布局。已有应用切换平台导航时执行 `openyida update-app <appType> --layout <l_shape|top|side> --show-app-nav`；自定义导航执行 `openyida update-app <appType> --hide-app-nav`，并将逐页隐藏清单交给 Step 4 与 Step 6，在各页面创建后立即配置，Step 8 只做发布后核对。新建应用也在主题文件生成后的同一次 `update-app --theme-file` 中传入布局和 `--hide-app-nav` / `--show-app-nav`，不要提前单独更新导航或在创建时传入布局。用户已确认的应用导航隐藏随这次设置更新一起生效，不等待自定义页面创建、代码开发或发布。

## 产出

- 真实目标 `appType`；
- app 来源：显式资源、绑定上下文、workspace cache、会话历史或本轮新建；
- 自定义主题文件、导航主题、Logo 来源、导航布局和 CSS 主色是否已联合保存的结论。

## Checklist

- [ ] 已确认不会重复创建同类 app；
- [ ] 已拿到真实 `appType`；
- [ ] 已有 app 未被自动改名；
- [ ] 主题分支已调度；其完成条件为已执行 `update-app --theme-file`，回读确认 `customThemeStyle` 资源、`colour=custom` 和 `themeColor`，并保存导航配置；不能以本地 CSS 存在或创建成功替代主题验收。

## 下一步

真实 `appType` 就绪即进入 → [Step 4：创建或更新表单/流程](step-4-forms-processes.md)，不等待主题分支完成；主题分支在输入就绪时立即更新，并在视觉验收及 Step 9 前汇合。
