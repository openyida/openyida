# Step 3：创建或复用应用

按 Step 1 的资源上下文和 Step 2 的 PRD 确认目标应用。已有 app 直接复用；缺少 app 且允许创建时才创建。

## 输入

- Step 1 的 app resource context；
- `prd/<项目名>/prd.md`；
- `prd/<项目名>/design.md`。

## 操作

1. 已有 `appType`、应用 URL 或已绑定 app → 直接复用该 app。
2. 缺少 app 且 Step 1 判定 `allowCreate=true` → 执行 `use_skill("yida-create-app", "按 PRD 创建应用并获取 appType")`，再按 PRD 创建应用。
3. 创建或复用后提取真实 `appType`，写入 `.cache/<项目名>-schema.json` 或当前任务资源上下文。
4. 新建完整应用默认基于 `app-custom-theme-template.css` 生成主题文件，并在 `create-app` 中同时传 `--theme-file`、`--nav-theme`、`--logo-source` 和新版 `--layout`。只有用户明确只要兼容空壳、暂不配置主题或保留旧创建方式时才省略主题文件；CLI 不把它设为硬性必填。
5. CLI 从 CSS 的 `--color-brand1-6` 自动提取 `themeColor`，创建后立即上传主题文件，并把 `customThemeStyle/themeColor/navTheme/logoSource/layoutDirection` 一次保存；不要再额外传 `--theme-color`。
6. 已有 app 不自动改名。外部工具预创建 app 时，OpenYida 侧只复用 `appType`，但用户明确要求应用级换肤时可以执行上一步主题更新。

## 产出

- 真实目标 `appType`；
- app 来源：显式资源、绑定上下文、workspace cache、会话历史或本轮新建；
- 自定义主题文件、导航主题、Logo 来源、导航布局和 CSS 主色是否已联合保存的结论。

## Checklist

- [ ] 已确认不会重复创建同类 app；
- [ ] 已拿到真实 `appType`；
- [ ] 已有 app 未被自动改名；
- [ ] 已联合保存 `themeFile`、由 `--color-brand1-6` 派生的 `themeColor`、`navTheme`、`logoSource` 和 `layoutDirection`。

## 下一步

→ [Step 4：创建或更新表单/流程](step-4-forms-processes.md)
