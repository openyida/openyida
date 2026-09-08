# 脚本生成 CanvasThemeProvider

用于现有 CodeCanvas 运行时。主题适配由本技能的脚本生成，业务页面无需复制变量映射、颜色解析或更新监听。不需要修改 vc-deep-yida，也不新增运行时依赖包。

## 选择接入方式

| 当前情况 | 做法 |
| --- | --- |
| 新 antd 页面，有本地主题文件 | 用本脚本装配 Provider |
| 没有本地主题文件 | 先取得当前应用的主题文件；暂保留原接入，不凭 URL 编造配色 |
| 纯 DOM 页面 | 直接消费平台 CSS 变量，不引入 Provider |
| 已有 useCanvasTheme 页面 | 保留原链路继续维护，或按下方步骤完整迁移；不叠加 Provider |
| 存量 .oyd.jsx / 平台 Jsx 页面 | 继续使用 yida-custom-page；本脚本不负责迁移运行时 |
| 只测试本地主题 | 生成默认测试页，保留 preview；不要求发布 |

## 设计与主题来源

1. 从 design.md 生成或定点更新应用 app-theme.css。页面基础背景是 --pod-page-bg-color，卡片是 --pod-card-bg-color；不另定义页面品牌色。
2. 应用级上传与保存仍走 create-app/update-app --theme-file。主题 URL 必须来自真实上传结果或应用配置回读，不能根据文件名拼接。保存的 URL 与当前本地 CSS 应是同一次主题产物。
3. 调用本技能 scripts/build-canvas-theme.js。`<skill-dir>` 使用当前实际安装技能目录，不要硬编码开发者路径。

脚本不上传或下载主题。URL 作为来源标识和已加载 link 的加载事件匹配条件；页面由平台加载应用 CSS。SHA256 标识本地生成快照，不证明远端文件与本地一致。

## 先生成测试页

```bash
node <skill-dir>/scripts/build-canvas-theme.js \
  --theme-file <项目目录>/app-theme.css \
  --theme-url <已上传主题的HTTPS地址> \
  --output <项目目录>/pages/src/theme-preview.canvas.jsx
```

未上传时可省略 --theme-url。输出是可独立编译的 Canvas 页面，默认开启 `preview`：把本地 CSS 的顶层 :root token 快照放在当前 Provider 容器上，供本地预览。不会插入全局样式表、修改 body 或加载完整平台 CSS。快照保留变量引用，不携带选择器、媒体查询、字体资源等完整 CSS 行为。

测试主按钮、次按钮、危险按钮、禁用和确认弹窗。`preview` 只验证快照；验证应用真实主题时移除 `preview`，由当前应用样式驱动。

## 业务页面接入

源文件保留一个模块级标记，让脚本展开 Provider：

```jsx
/* @canvas-theme-provider */
import { Button } from 'antd';

function PageContent() {
  // 普通按钮自动继承；图表可在此组件内调用 useCanvasThemeContext() 取色。
  return <Button type="primary">新增</Button>;
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

生成片段已声明 React、ConfigProvider、CanvasThemeProvider 和 useCanvasThemeContext。源文件不要重复声明这些名字；React hooks 使用 `React.useState` 等。标记必须恰好出现一次，输出不能覆盖输入。修改主题或业务代码后重新运行脚本，只编译 `.themed.canvas.jsx`；需要发布时也使用这个文件。不要直接编辑派生文件，否则下次生成会覆盖手动修改。含标记的输入不能直接发布。

## 旧页面迁移

1. 先保留原页面用于对照。业务内容提取到 PageContent，清除旧 useCanvasTheme/readThemeColor、旧根 ref 和负责配色的 ConfigProvider；尺寸或圆角等独立配置可以保留。
2. 按上方示例加一个标记和一个 CanvasThemeProvider。Provider 已提供页面最小高度和底色，内容层不再重复设置整页 min-height；业务 padding、卡片和装饰仍保留。
3. 用脚本输出独立文件，编译并对照原页面验证。旧示例中的 Modal.useModal holder 仍须放在新 Provider 下。
4. 既有主题若使用旧页面背景别名 `--oyd-page-background`，先比对其与 --pod-page-bg-color 的值；有差异时在 design.md 确认共享底色再定点修改主题。脚本不会自动迁移旧主题文件、Schema 或已发布页面。

脚本只装配已维护的 Provider，不改写业务逻辑或主题 CSS。源码只读要求仍然优先。三个旧示例继续使用原 hook，供存量维护；直接拿来创建新页面时，必须按上述步骤替换主题链路。

## 运行契约

- 默认模式：读取 Provider 实际作用域中的应用变量，由统一 ConfigProvider 传给 antd；不把本地快照覆盖到线上应用。
- `preview` 模式：使用本地 :root 快照，仅作用于当前页面；移除此属性后恢复应用主题。
- Context 提供 `token/status/source/revision`；状态为 loading、ready、preview、missing、error。ready 表示读到了主色，不代表整套主题完成视觉验收。revision 是生成快照的 SHA256，不是平台实时版本。
- 主色未读到时为 missing，解析抛异常时为 error；其他缺失颜色保留 antd 默认值。页面仍可渲染，但 missing/error 不能当成主题验收通过。
- 当前只自动适配主色、表面、文字、填充和边框。成功/警告/错误沿用 antd 默认；尺寸、圆角、字体、图表色组和完整 CSS 选择器不自动转换。
- 页面根背景由 Provider 提供；内容区只决定布局、卡片和装饰。不要再包带固定主色的 ConfigProvider。
- 如需弹层继承局部 CSS，给 Provider 传 getPopupContainer，并验证目标容器不会裁剪浮层；默认保留 antd 的挂载位置。
- 弹窗使用上下文内 Modal.useModal，消息使用上下文 API，保留 holder 在 Provider 下。不要用静态调用绕过主题。
- 主题通过祖先属性、head 样式变化、匹配 URL 的 link load 和 resize 更新。CSSOM 更新方需要显式派发 `openyida:theme-change`；平台尚未承诺该事件。
- 当前适配层不会修改底层 CodeCanvas。将来底层能力验证通过后再迁移，不能提前删掉兼容实现。

## 验收

先 compileCanvasLocal 检查生成页面；再分别验证 preview 和应用主题模式、主题延迟加载、换肤、按钮交互态、确认弹窗、缺失和异常状态。解析色值与颜色对比度仍需实际浏览器验证，脚本成功和编译成功不能替代视觉验收。
