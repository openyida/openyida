# Fast 立即搭建

Fast 在应用名称、业务范围及创建授权明确后，立即创建或复用应用。没有创建前的 Plan、完整业务 JSON、build-context、PRD、design.md、page-spec 或统一物化门槛。主题、页面和业务资源按自己的依赖推进。已有明确需求直接复用，只有实际阻塞业务的缺项才澄清。

## 1. 创建或复用应用

先按本轮真实资源上下文判断复用还是新建，不重复执行能力和登录探测。用户已经明确新建完整应用且目标不存在时，加载 `yida-create-app` 并单独调用：

```bash
openyida create-app --name "应用名称" --desc "本轮业务范围" --json
```

完整保留原始回执和退出状态，不在创建命令前后拼接 date、管道、head/tail 或 JSON 筛选；计时另起只读命令，复用真实工具时间。记录真实 appType 与返回入口。复用已有应用时不调用创建。授权、当前组织和既有资源边界仍由原技能与 CLI 保护。未知写入先回读，不重复创建。

## 2. 同时准备主题与独立页面

**必须生成并应用 `app_theme.css`**，明确禁止 theme-file 的范围除外。使用本轮已选主题和主色；主题未知时一次读取 `design-plan catalog --compact` 作为主题列表，复用已有结果，不运行 init/materialize/preview。目录命令不代表采用 Plan。

```bash
openyida sample yida-app fast-theme --style-id app-platinum --primary-color '#2E6E8E' --output <绝对路径>/app_theme.css --json
```

示例风格和色值按本轮需求替换。命名主题自动读取配对模板及导航明暗，补齐品牌变量并校验 CSS/文字对比度，不验证业务资源、页面、章节或锚点。返回 `outputs.theme`、`theme.themeColor/navTheme`、`applicationTheme`，不生成任何方案文件。`--check` 只检查本次主题，不写文件；相同产物复用，不同内容保护已有文件，实质改版使用新输出路径。

有明确自由创意需求时用 free-creative，`--tokens-file` 只写主题 tokens/creativeDirection，并传 `--nav-theme light|dark`；仍不需要业务或页面 JSON。app-pop 沿用明确风格/展示任务依据，不因 Fast 自动选择。主题 token 与 CSS 消费、旧主题全局作用域确认等规则仍适用。主题失败只暂缓主题应用，主流程继续已授权且独立的资源/页面工作。

appType 和 CSS 各自就绪后，按 Step 3 支持的 update-app 参数一次上传主题并设置布局/导航，回读核对。将生成结果中的 applicationTheme 存入逐步积累的 build-manifest。页面默认直接编写 Canvas 源码并消费共享变量；不为编译补造完整设计文件或 page-spec。

## 3. 按操作执行必要业务校验

- 只有首页、案例展示/详情和联系我们的展示需求：直接实现页面、导航、联系方式与明确标注的示例内容，默认不创建案例表、留言表、后台或种子数据。用户明确要求提交保存、持续维护、数据库时才创建对应真实数据资源。
- 有数据库、角色隔离、审批或自动化要求：保留全部范围；创建/更新表单前核对当前表的字段契约，配置权限时核对真实成员和服务端数据范围，审批按真实流程执行。失败只阻塞依赖该资源的工作，独立页面继续。前端隐藏和角色文字不算权限落地。
- 应用创建与主题准备、无依赖的业务资源和各页源码按实际宿主工具并发；宿主支持时可委派独立子 Agent，每个文件/资源保持唯一写入者。只有同步工具时先做业务与页面，不派发整包后立即等待。平台写入沿用已有 batch、资源锁和失败回读保护。
- 缺图使用设计允许的明确状态，先发布已有授权的可用首版；素材独立运行，整次共享60秒、单请求15秒，不 sleep 重试。只有某页需要素材时写该页 asset draft（assets 和 assetStrategy），`asset resolve --input <绝对草稿路径> --manifest <绝对清单路径> --page-id <pageId>` 即可；无需 business context 或 design.md。来源与最终缺口按素材技能处理。
- 使用固定工作根及绝对文件路径，不在 cd 后重复拼接相对路径。校验错误先读完整 issues，按实际值和允许类型一次修正；本地无写入错误不触发安装目录或 CLI 源码搜索。相同输入不重复调用。fast-build --help 可查询旧上下文的字段契约，但 fast-build/fast-spec 仅为已有文件兼容工具，默认 Fast 不运行它们。

## 4. 逐页发布与收尾

每页就绪即检查、编译和发布，真实数据绑定、权限和主题未验证时保留缺口。统一核对导航与实际入口。build-manifest 只随真实执行增补资源 ID、字段映射、主题回执、素材任务和验收证据，不写预设完整方案，不作为创建门槛。

```bash
openyida check-prd-completeness --manifest-only --build-manifest <绝对路径>/build-manifest.json --app-type <真实appType> --json
```

此检查复用资源、导航和主题回读；业务规则、角色与浏览器交互仍按 Step 9 验收。禁止通过省略应交付资源或删除验收项制造通过。

分别记录需求路由、应用创建、主题、页面源码、编译发布、业务验收和素材的真实开始/结束时间，总耗时按墙钟计算，不累加并发区间。少量简单页面以五分钟为优化目标，实际以端到端记录为准；复杂数据、角色或审批按真实范围记录，不以本地 CLI 耗时宣称整次达标。
