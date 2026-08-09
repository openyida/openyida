# 页面编译与排障

## 普通页面兼容构建

1. `.oyd.jsx`、`.openyida.jsx` 或显式 `--compat` 先运行 compatibility compiler。
2. 普通 `.jsx` 只有 `export default function Page()` 时，自动尝试有限 authoring 降级。
3. 已有 `export function renderJsx()` 时，机械修复事件绑定、数组回调并补基础运行时导出。
4. `export default function Page()` 支持有限 `useState` 和 `useEffect(..., [])`；引用局部 helper 或 state 的不安全 effect 会被阻塞。
5. 构建器补隐藏 timestamp 节点，并把直接事件绑定或 `.bind(this)` 改成箭头函数包裹。
6. `check-page` 拦截生命周期大小写错误、小写 `onclick`、渲染时执行事件、只引用不调用方法和无事件按钮。
7. 构建后的 `.yida.jsx` 再经过 Babel、UglifyJS 和 Schema 构建。

机械修复交给 CLI，不让模型反复手改源码。

## Canvas 编译

`.canvas.jsx` / `.canvas.tsx` 由 `publish` 的 Canvas 编译阶段检查 `YidaComp` 导出、依赖和 `runtimeCode + importedModules`，不先运行普通页面的 `check-page` / `compile`。

## 自动注入样式

发布时自动覆盖平台默认页面间距：

```css
body { background-color: #f2f3f5; }
.vc-page-yida-page { --yida-form-content-padding: 0; --yida-form-content-margin: 0; --yida-layout-padding: 0; }
.vc-deep-container-entry.vc-rootcontent { padding: 0 !important; margin-top: 0 !important; margin-right: 0 !important; margin-bottom: 0 !important; margin-left: 0 !important; }
```

使用展开属性是为了覆盖平台已有的 `!important` 规则。

## 常见问题

| 问题 | 处理 |
| --- | --- |
| 兼容构建失败 | 查看 `check-page --json` 的 `build.errors`，检查 Hook、effect deps 和 import |
| Babel 编译失败 | 检查 JSX 语法和文件后缀；Canvas 用 `.canvas.jsx`，普通 authoring 用 `.oyd.jsx` |
| UglifyJS 失败 | 检查是否仍有未转译的 ES6+ 语法 |
| 目标不是 display page | 用 `list-forms` 重新确认，不对数据表追加 `--force` |
| saveFormSchema 401 | 重新执行 `openyida login` |
| corpId 不匹配 | 询问用户是否切换组织，不新建应用规避 |
| Canvas 页面空白 | 检查 `YidaComp`、依赖白名单和浏览器控制台 |
| 普通页面空白 | 检查 `renderJsx` 导出和运行时报错 |
| 发布接口成功但页面异常 | 使用 `--health-check` 并做浏览器首屏验证 |
