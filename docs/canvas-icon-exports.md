# Canvas 图标导出清单维护

`lib/app/canvas-icon-exports.json` 保存宜搭 Canvas 实际加载的 Lucide 与 Ant Design Icons 导出名、资产 URL 和 SHA-256；编译 / 发布共享 `canvas-icon-guard.js`，不在线下载资源，不执行业务代码。不能用 npm 最新版本的目录替代运行时清单。

当前清单来源（2026-09-16 核对）：

- React 18.3.1：`https://g.alicdn.com/code/lib/react/18.3.1/umd/react.development.js`
- Lucide：`https://g.alicdn.com/yida-components/yida-plugin-ui-shared/0.0.1/lucideReact.js`，`window.LucideReact` 共 5298 项导出，另有 `window.DynamicIcon`。
- Ant Design Icons 5.5.1：`https://g.alicdn.com/code/lib/ant-design-icons/5.5.1/index.umd.min.js`，`window.icons` 共 836 项导出。

平台变更依赖版本或同 URL 内容时，先核对宿主 `yida-code-canvas/dependencies.ts` 中真实资产，再更新脚本的 `assets`。将对应三个经过核对的包下载到独立目录，分别命名 `react.js`、`lucideReact.js`、`antDesignIcons.js`，执行：

```sh
node scripts/update-canvas-icon-exports.js /absolute/path/to/reviewed-bundles
npm test -- --runInBand tests/canvas-icon-guard.test.js tests/canvas-compile.test.js tests/compile.test.js
```

生成器仅供仓库维护使用，不随 npm 包发布。它会在 Node VM 中执行指定目录里的包；VM 不是安全沙箱，禁止传入用户页面或未经核对的第三方代码。检查 diff 中 URL、哈希、导出名变化，再走完整 CI。移除旧图标或改变默认导入语义时，补兼容性说明和测试。

静态检查覆盖 named import、静态 namespace 成员 / 解构及不可变别名，不证明动态属性、远程数据、私有化环境的不同资源或浏览器加载结果正确。运行时图标名使用显式组件映射与有效兜底；平台资源变化需同步更新清单，不能通过跳过检查发布。线上渲染仍需单独验收。
