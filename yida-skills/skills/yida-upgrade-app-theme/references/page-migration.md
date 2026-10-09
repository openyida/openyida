# 页面和表单迁移

## 1. 备份原页面

使用准备命令生成的 Schema、源码和 `upgrade-plan.json`。在单独目录修改源码，保留原始备份。

核对隐藏页、嵌入页和用户指定页面，补齐遗漏。根据 Schema 区分 JSX、CodeCanvas 和表单。缺少原源码时停止该页迁移，不根据编译产物猜写业务逻辑。

## 2. 迁移自定义页面

- **JSX 页面**：按 [yida-canvas-upgrade](../../yida-canvas-upgrade/SKILL.md) 转为 CodeCanvas，保留业务逻辑和主要布局。
- **CodeCanvas 页面**：直接更新主题样式，保留原有状态和业务代码。
- **混合组件页面**：保留原组件树、数据源和动作。不能用单 Canvas 发布命令覆盖；无法保留时停止该页迁移。

迁移时保留字段 ID、请求参数、数据映射、权限、路由、筛选分页、提交回调和生命周期清理。平台 API 和数据源按 [数据桥规范](../../yida-canvas-custom-page/references/data-bridge-guide.md) 适配，验证可用后再发布，不用静态数据替代。

按升级清单中选定的主色和风格准备应用主题 CSS，保留原页面的布局、圆角和密度。页面使用同一套主题 token，Provider 只作用于页面内部；成功、警告、失败等业务语义色保持不变。

## 3. 清理表单旧样式

检查表单 Schema、动作、CSS，以及自定义页面向表单详情、弹窗或 iframe 注入样式的代码。

- 逐项确认 `styleCandidates`，只删除旧主题注入及其专属监听、定时器和清理代码。
- 保留业务事件、页面内部样式、详情跳转、弹窗通信和提交回调。样式与业务混在同一函数时，只移除样式部分。
- 表单使用 `create-form patch` 精确修改对应路径，保留字段、校验、公式、权限和流程。修改动作源码时同步更新编译内容。

不能按关键词批量删除代码。无法确认影响范围或保存方式时，停止该项修改。`publish --fix-theme` 只辅助替换部分固定色，使用后检查差异，不能代替注入清理。

## 4. 校验并发布

先完成本地修改和编译，再执行升级 Skill 中的升级命令。发布前重新拉取 Schema；若有他人改动，合并并重新验证，避免覆盖。

升级命令成功后，保存已确认的应用主题并核对回读结果，不能只让页面跟随默认主题：

```bash
openyida update-app <appType> --theme-file <working/app-theme.css>
```

只更新主题，保留应用名称、导航结构、Logo 和访问设置。

单 Canvas 页面发布到原 `appType` 和 `formUuid`：

```bash
openyida compile <working/page.canvas.jsx> --json
openyida publish <working/page.canvas.jsx> <appType> <原formUuid> --json
openyida get-schema <appType> <原formUuid>
```

回读确认页面已保存为 CodeCanvas，源码、运行代码或 codeBundle 有效，业务绑定完整。表单保存后也要回读核对。

## 5. 验收并记录

重新加载页面，检查：

- 查询、筛选、分页、增删改、提交、权限和详情开关正常。
- 页面主要结构、图表和窄屏显示正常。
- 应用导航、主按钮、链接、页面和表单符合选定主色及风格。
- 表单录入、校验、公式和流程未变，页面与表单主题一致。
- 旧样式没有被监听器或定时器重新注入。

在 `upgrade-plan.json` 逐页记录备份、修改、发布、回读和验收结果。失败项写明原因，不自动回滚整个应用。全部目标资源通过后才能报告升级完成；否则列出已完成和未完成项。
