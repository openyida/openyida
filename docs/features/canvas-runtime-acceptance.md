# Canvas 发布与运行时验收

## 目标

- 完整应用的主页面固定按 Canvas 模式发布。
- 发布结果提供可机器判断的发布模式和读回摘要。
- Canvas 编译阻断平台 JSX 实例 API。
- 真实 E2E 在 Canvas 模式或读回不匹配时失败。

## 已确认根因

1. `publish` 只通过 `.canvas.jsx/.canvas.tsx` 或 `--canvas` 选择 Canvas；普通 `.jsx` 会走 native。
2. 读回校验只验证当前选择的发布模式，无法推断 Agent 原本应交付 Canvas。
3. `props.utils.getDataList`、`this.utils.yida.*` 等属性链不会触发未绑定标识符检查。
4. cleanup、静默刷新和页面长期 loading 不能只靠静态语法可靠判断。

## 最小实现

1. `publish` JSON 增加 `publishMode`；health check 增加 `expectedPublishMode` 和读回页面摘要。
2. 真实 E2E 要求 Canvas publish 的 health check 成功、发布模式为 `canvas`、读回包含 `YidaCodeCanvas` 且 `runtimeCodeBytes > 0`。
3. Canvas 编译阻断 `props.utils.getDataList`、`this.utils.yida.*`、`this.dataSourceMap`、`this.$`，返回单一结构化错误码。
4. `yida-app` 使用 `--canvas --health-check` 发布新主页面，收尾时回读 Canvas 信号并在已登录浏览器确认已知记录可见。
5. `yida-canvas-data-binding` 增加一条简短浏览器完成条件。

## 不做

- 不改变 native `.jsx` 的默认发布行为。
- 不把所有 publish health check warning 改成进程失败。
- 不用启发式规则强制识别任意 dataBinding、cleanup 或静默刷新实现。
- 不新建浏览器自动化框架；今晚继续使用真实 Codex、Qoder 搭建和已登录浏览器验收。

## Done Contract

- 窄范围测试覆盖模式摘要、严格 E2E 判断和 Canvas 实例 API 守卫。
- `npm run check:skills`、`npm run build:skills`、相关 Jest 测试通过。
- 今晚真实 E2E 能区分“保存成功”和“Canvas 运行时交付成功”。

## Change Log

- `publish` 输出 `publishMode`，读回结果输出 `expectedPublishMode` 和 Canvas 摘要。
- Canvas 编译阻断无效平台实例 API，同时允许普通组件 props。
- 真实 E2E 显式使用 `--canvas`，并严格校验 Canvas 模式和非空 runtime。
- 完整应用技能使用显式 Canvas 发布命令，并增加浏览器真实数据完成条件。

## Validation

- 相关 5 个测试套件、111 个测试通过。
- `npm run check:i18n`、`npm run check:skills`、`npm run build:skills` 通过。
- `npm run check:ci` 通过。
- 失败样例会返回 `OPENYIDA_CANVAS_INSTANCE_API_UNAVAILABLE`。
- Qoder 原失败源码按 Canvas 本地编译后生成 14787 bytes runtimeCode。
- Codex、Qoder 真实搭建和已登录浏览器验收留到今晚执行。
