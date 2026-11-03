# Fast 执行上下文

Fast 使用 `build-context.json` 与 `app_theme.css`，按 [Fast 直接搭建](../workflow/fast-build.md) 生成。后续步骤及共用子技能中，PRD 的业务资源、顺序、数据、角色、规则与验收对应上下文 `resources/roles/businessRules/acceptanceChecks` 和各页任务；design.md 的页面、导航、主题与素材对应 `pages/navigation/themeProfile/assetStrategy` 和生成 CSS。`intake/explicitScope/constraints` 保留已确认需求和禁止项。此映射只替换输入载体，不降低业务、权限、对比度、主题能力、发布和验收标准。

上下文只记录规划声明。真实 app/form/field ID、字段契约、角色配置、数据回读、主题和发布回执保存在独立 build-manifest，不据此声明已完成。导航隐藏有要求时明确 `navigationVisibility`，入口记录沿用已有 `entryRecommendation`。资源创建按 `dependsOn`，页面按自己的依赖就绪实施。

Fast 直接编写 Canvas 源码，不执行长文档或 page-spec 派生链。素材命令使用 `--build-spec <build-context.json>`，收尾使用 `check-prd-completeness --build-spec <build-context.json>`。Plan 和已有文档任务继续使用原 PRD/design.md 契约。
