# Canvas 页面接入应用主题

antd 页面用 CanvasThemeProvider 包住业务组件；图表通过 useCanvasThemeContext 取色。纯 DOM 页面直接使用应用 CSS 变量。

## 1. 选择接入方式

`@canvas-theme-provider` 和 `.themed.canvas.jsx` 仅用于第 2 节的脚本装配路线，不是所有顶部导航、背景图或 Canvas 页面的必经步骤。已有 Provider 的页面直接编译原文件；不要重复插入 Provider 或增加标记。

| 页面情况 | 操作 |
| --- | --- |
| 用 `sample` 生成表单抽屉、批量表格或趋势图页面 | 已接好主题，继续编写业务内容 |
| 自己编写页面，直接使用应用主题 | 按下方命令提取 Provider，合并到页面 |
| 有本地 app-theme.css，需要生成完整页面或预览 | 按第 2 节运行主题脚本 |
| 维护 .oyd.jsx / 平台 Jsx 页面 | 使用 yida-custom-page |

```bash
openyida sample openyida-page-template canvas-theme --output <项目目录>/canvas-theme.jsx
```

将片段与业务代码合并到同一 Canvas 文件，React 和 ConfigProvider 的 import 各保留一份。把业务内容放进 PageContent，在 YidaComp 中用 CanvasThemeProvider 包住 PageContent。已有页面用它替换自带的主题 hook 和配色 ConfigProvider。

组件结构固定为 `YidaComp → CanvasThemeProvider → PageContent`。主题上下文和 Provider 定义放在模块顶层；`useCanvasThemeContext()` 放在 PageContent 或其子组件中；通过 `<PageContent />` 渲染业务内容。

## 2. 用本地主题文件生成页面

先按 design.md 准备 app-theme.css。应用主题使用 `openyida update-app <appType> --theme-file <app-theme.css>` 上传保存；页面由平台加载该 CSS。

在业务源文件的模块顶层保留一个标记：

```jsx
/* @canvas-theme-provider */
import { Button } from 'antd';

function PageContent() {
  const { token } = useCanvasThemeContext();
  return <section style={{ color: token.colorText }}><Button type="primary">新增</Button></section>;
}
function YidaComp() {
  return <CanvasThemeProvider><PageContent /></CanvasThemeProvider>;
}
export default YidaComp;
```

```bash
node <skill-dir>/scripts/build-canvas-theme.js \
  --theme-file <项目目录>/app-theme.css \
  --theme-url <已上传主题的HTTPS地址> \
  --page <项目目录>/pages/src/workbench.canvas.jsx \
  --output <项目目录>/pages/src/workbench.themed.canvas.jsx
```

- `<skill-dir>` 是当前安装的技能目录。
- `--theme-file`、`--output` 必填。输出使用独立文件，保留业务源文件和主题 CSS。
- `--theme-url` 可省略；填写时使用该 CSS 的真实上传地址或应用配置回读结果。
- 标记只写一次。脚本会插入 React、ConfigProvider、CanvasThemeProvider 和 useCanvasThemeContext；业务代码共用这些声明，hooks 使用 `React.useState` 等。
- 后续修改写入业务源文件或 app-theme.css，再运行脚本。编译和发布使用输出的 `.themed.canvas.jsx`。

需要本地主题预览时，省略 `--page`，将 `--output` 指向 `theme-preview.canvas.jsx`。生成的测试页默认开启 `preview`，使用 CSS 顶层 `:root` 变量；完整选择器、媒体查询和字体资源在实际应用中验证。测试真实应用主题时移除 `preview`。

## 3. 接入控件和图表

### 默认控件状态

按用途选择组件：内容面板切换用 Tabs（默认线条型）；作品类别等互斥筛选用受控 Segmented，长文案或需换行时用 Radio.Group/自绘筛选组；主业务操作才用实心主按钮。不要把一排分类选项都做成抢眼的主按钮。antd 运行时为 5.23.3，不使用 5.24 才引入的 Segmented.shape。

标准 Provider 给 Tabs、Segmented、Radio.Button 和 Button 提供组件级默认色：普通项用可读中性文字；筛选选中项用当前品牌色与表面混合出的轻底色，文字优先品牌色、对比不足时回到清晰正文色；Tabs 以指示线表达选中，不铺浓重底色。不要假设 `--color-brand1-1` 永远是浅底，也不要把同一主色同时用作选中文字和实心背景。

对可解析的不透明 sRGB 色值，选中项及实心主按钮文字按至少 4.5:1 的对比度选择。实心按钮检查常态、悬停、按下共用文字的可读性；应用 hover/active 色阶对比不足时保留主色背景，避免文字消失。透明色、其他色彩空间与图片背景保留组件库默认策略，需实页检查。禁用项使用独立禁用 token；危险、成功与警告保留语义色。

Provider 上下文的 `controls` 返回同一组 surface/text/selectedBg/selectedColor/hoverBg/activeBg 等解析值，可供自绘胶囊筛选使用；未能解析时为 null，继续使用 CSS 变量或组件库默认值。选中不是 disabled：保留点击、键盘操作与清晰焦点，单选筛选用受控值或 aria-pressed，真正面板切换才用 tab/tabpanel 语义。圆角、尺寸与间距仍按 design.md，不统一把所有控件改成胶囊。

照片分类这类场景建议一行轻量筛选：未选中项中性底与正文色，选中项轻品牌底与清晰文字，选中状态不改变宽度；与说明文字、作品网格分别留出组间距。窄屏按设计横向滚动或换行，不压缩文字至难以辨认。

### 接入规则

- 先提取标准 Provider 再写 Button、Tabs、Segmented、Typography.Link 等业务控件；业务组件整体放在 Provider 内。本页切换时保持 Provider 挂载，新增视图也消费同一主题，不按 Tab 重建硬编码配色的 ConfigProvider。
- antd 主按钮使用 `type="primary"`，链接使用 `type="link"` 或 Typography.Link；Tabs 保留默认主题交互色。调整内层 ConfigProvider 时只覆盖所需尺寸、圆角，颜色读取上下文解析值。`token.colorPrimary/colorLink`、Tabs 的 inkBarColor/itemSelectedColor 等不要填固定品牌色，也不要直接填未解析的 `var(...)`。
- 自绘按钮、链接及 Tab 的 normal/hover/active/selected/focus/disabled 都消费应用 CSS 变量；优先提取 `canvas-nav-tabs` 作为受控 Tab 片段。选中逻辑与颜色分开，不能仅初始态跟随主题、点击后切成固定蓝色或 Tailwind 的 `bg-blue-*`。状态色与装饰色仍按业务语义使用。
- 页面背景使用 `--pod-page-bg-color`，卡片使用 `--pod-card-bg-color`。Provider 已提供根节点背景和最小高度，业务内容负责布局、卡片和装饰。
- Drawer 的组件级背景单独读取 `--pod-shell-theme-bg-color`，回退 `--color-white`；外壳文字读取 `--pod-page-header-text-color`，回退 `--color-text1-4`。外壳跟随应用框架更新，内部 iframe 继续使用平台页面主题；卡片和通用浮层保留各自底色。
- Provider 内置表格和 Spin 加载遮罩的防闪边样式：边框固定为零，只对透明度做过渡，避免整页刷新时延迟加载的基础样式触发黑边动画。保留这段样式，不要改回 `transition: all`。旧页面需更新 Provider 并重新发布，修改主题 CSS 不会自动更新页面里的 Provider。
- antd 自动接收主色、表面、文字、填充和边框色，并应用上述控件状态默认值。成功、警告和错误使用 antd 默认色；尺寸、圆角、字体和图表色组按 design.md 设置。
- 图表在 PageContent 内调用 `useCanvasThemeContext()` 获取解析后的 token。
- 弹窗使用 `Modal.useModal`，消息使用上下文 API，holder 放在 Provider 内。
- 弹层默认使用 antd 的挂载位置。需要继承局部 CSS 时设置 `getPopupContainer`，并检查弹层是否被容器裁剪。

## 4. 检查主题和发布结果

先执行 `openyida compile <输出文件> --json`，再检查实际页面的主色、按钮状态、确认弹窗、延迟加载和换肤效果。用户要求发布时，执行 `openyida publish <输出文件> <appType> <formUuid>`。

编译会检查主题容器是否挂载、入口是否提前读取主题、主题上下文是否放在模块顶层。报错包含位置和调整方法，按提示修正后再次编译。发布后实际打开页面，检查首屏和主题交互；`--health-check` 用于核对保存内容，页面能否正常运行以浏览器结果为准。

编译和发布默认保留 ConfigProvider 中可确定的固定品牌色覆盖，并在结果 `warnings` 返回 `OPENYIDA_CANVAS_THEME_FIXED_BRAND`；加 `--strict-theme` 才会阻断。新页面使用标准 Provider 或上下文解析值；仅把色值提到常量中不算修复。迁移现有覆盖按[发布技能的主题处理](../../yida-publish-page/SKILL.md#canvas-主题处理)执行。动态表达式、自绘 CSS、组件是否实际被 Provider 包住及宿主主题加载仍需验证，静态检查通过不能证明全部控件跟随主题。

验收至少切换两种不同应用主色，再逐一操作主按钮、链接、每个 Tab、禁用控件与弹层，检查选中/悬停/按下/焦点状态；再检查切页返回、异步内容出现后的颜色。只测默认蓝色无法发现写死蓝色的问题。记录实测项，无法使用真实页面时明确保留待验收项。

原始文件仍有 `/* @canvas-theme-provider */` 时，编译和发布会报 `OPENYIDA_CANVAS_THEME_NOT_ASSEMBLED`。按第 2 节生成独立输出文件后编译该输出；不要仅删除标记掩盖尚未接入的 Provider。

Context 返回 `token/status/source/revision`：

| status | 含义与处理 |
| --- | --- |
| loading | 正在读取主题 |
| ready | 已读到应用主色，继续检查页面效果 |
| preview | 使用本地变量快照，实际应用效果另行验证 |
| missing | 未读到主色，检查应用 CSS 是否加载 |
| error | 解析失败，检查主题变量和运行错误 |

其他缺失颜色使用 antd 默认值。`source` 是生成时提供的 URL，`revision` 是本地 CSS 的 SHA256；直接提取的应用主题片段中这两项为空。

Provider 会监听祖先属性、head 样式、主题 link 加载和窗口尺寸变化。用 CSSOM 修改样式的代码需主动派发 `openyida:theme-change`；该事件由修改方负责。

链接与实心按钮分开适配：Provider 保留品牌填充色，链接普通、hover、active 前景需在内容面上达到 4.5:1；原品牌档不足时沿用可读内容文字，不直接把深色按钮填充当成暗色页面链接。主题快照支持 `:root` 与平台模式选择器共用一个声明块。
