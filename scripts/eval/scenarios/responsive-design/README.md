# 任务驱动响应式生成评测

本组验证 Skill 的设计决定能否落实到真实生成的本地 HTML，不创建宜搭资源，不注册新 CLI 命令。它补充 `eval:generate` 的线上链路，不替代 Canvas 编译、平台数据绑定或真机验收。

## 运行与隔离

通过 `scripts/eval/responsive-generation.js` 的 `runEvaluation` 复用现有 agent 封装；默认调用 `scripts/eval/agent.js`，也支持注入已认证的 runner。注入 runner 返回 `{available, ok, text, error}`，`text` 为模型最终输出，不能用手写页面冒充生成结果。执行环境使用独立临时目录与只读权限，禁止平台写入；不向 agent 开放其他版本的本地/全局 Skill，避免基线被新规则污染。

从仓库根执行示例（已有 Claude 认证时）；使用其他 agent 时按现有适配器注入 `runAgent`，记录实际命令与模型，不为本评测修改产品 CLI：

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { runAgent } = require('./scripts/eval/agent');
const { loadContext, runEvaluation } = require('./scripts/eval/responsive-generation');
const root = process.cwd();
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'oy-responsive-eval-'));
runEvaluation({
  outputDir: path.join(root, '.cache/responsive-design-eval', String(Date.now())),
  agentLabel: 'configured claude; isolated cwd; no tools',
  runAgent: options => runAgent({ ...options, cwd, extraArgs: ['--tools', ''] }),
  variants: [
    { id: 'before', source: baseline, context: loadContext(file =>
      execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' })) },
    { id: 'after', source: 'working-tree', context: loadContext(file =>
      fs.readFileSync(path.join(root, file), 'utf8')) },
  ],
}).then(console.log);
```

提交后复跑时将 baseline 换为修改前的明确 SHA；两组使用同一 agent、请求、示例数据、输出要求与检查矩阵。保存上下文 hash、完整 prompt、原始回答、HTML、耗时和失败记录。`generated` 只表示格式可解析且产物存在；不能据此宣布设计或浏览器通过。单轮结果只用于发现问题，不宣称统计显著提升。

## 浏览器与设计检查

将输出目录通过仅绑定 `127.0.0.1` 的静态服务打开，在外部浏览器访问 `browser-review.html`。页面提供原型选择、视口/内容宽度调整和批量测量按钮，测量原型的实际 DOM 并可下载 JSON；生成过程中需等全部用例结束后再打开。批量检查覆盖默认宽度、内联 CSS 中以 px 表示的 min/max-width 断点前后、宽视口中的窄内容区及恢复宽度后的输入保留；其他单位、范围语法及 JS 断点另行补测。检查标记只作定位，不指定页面布局或代替业务点击验证。

用外部浏览器打开生成 HTML，先确认宽视口完整展示。逐页检查 360、600、768、1024、1280、1600px 和实际断点前后；另在1600px视口中缩窄同一内容容器，保留当前输入及选中项，检查恢复后的状态。

每次记录实际 viewport/container 宽度、页面是否整体溢出、控制台错误、输入保留和主操作可达。截全页或分段图，检查截图完整性。图表或比较表允许局部横滑，不能用页面级裁切掩盖溢出。模拟窄宽度不等于真机触控、软键盘或安全区域验证。

按 `cases.json` 各用例的 `review` 逐项给出截图或交互证据，不以关键词出现作为设计通过：

- 对账：检查真实列与金额比较、横滑信息提示、筛选占用和选择保留。
- 售后：打开详情、填写备注、返回，检查上下文及手机主操作。
- 已有表单：触发短文案校验，再补足内容提交；确认四字段、顺序、反馈、草稿及清空行为没有改变。
- 品牌展示：检查课程信息、预约反馈及宽窄构图，确认未出现模板的无关图表和空槽位。

同一结果分别报告生成状态、浏览器检查、设计评审、平台/真机未测项。发现生成缺陷时优先修正共享提示并重新生成；保留失败产物与首次结果，不能手工修原型后宣称原始生成通过。新增关键规则后补留出场景，防止只对这四个样例优化。
