# Skill 测评 Harness — 本地验证流程

> 用于验证 `scripts/eval/` 下的测评 harness 是否正常工作。
> 按「最便宜、零副作用」→「真实链路」的顺序执行。

## 前置:用对 Node 版本

默认 shell 可能是 Node v14,但项目要求 **≥18**。每次新开终端先切版本:

```bash
nvm use 20            # 或 nvm use 18
node --version        # 确认 v18/v20
npm install           # 如果 node_modules 缺失,先装依赖
```

---

## 第 0 步(可选):网页控制台,点按钮运行

不想敲命令的话,启动本地控制台,在网页上点按钮即可运行下面所有任务,输出实时流式显示:

```bash
nvm use 20
npm run eval:dashboard          # 默认 http://127.0.0.1:4500
# 自定义端口: EVAL_DASHBOARD_PORT=4567 npm run eval:dashboard
```

- 左侧「安全任务」(单测、路由测评、Pipeline、Baseline)无副作用,直接点。
- 左侧「真实链路」(红色,端到端建资源)点击会弹确认框,需先 `openyida login`。
- 仅监听 `127.0.0.1`,任务是白名单固定命令,不接受任意命令输入。
- 注意:控制台用**启动它的那个 Node 版本**跑子进程,务必先 `nvm use 20`。
- **报告标签页**:点击顶部「📊 报告」可浏览所有历史评测报告(JSON/HTML),点击直接查看内容。
- **Pipeline 预览**:首页自动展示最近一次 Pipeline 评测结果的评分卡和优化建议。

---

## 第 1 步:纯函数单测(最先跑,无副作用,进 CI)

验证 harness 逻辑正确性的核心:不调真实 agent、不建资源、不需要登录。

```bash
npx jest tests/eval-config.test.js tests/eval-guardrail.test.js tests/eval-manifest.test.js tests/eval-routing.test.js
```

- 预期:`35 passed`。

跑全量回归,确认未影响其他模块:

```bash
npm test
```

- 预期:`1278 passed`(104 suites)。

---

## 第 2 步:全自动闭环 Pipeline(推荐首选,无真实资源)

> 目的:一键串联「静态校验 → 路由测试 → 安全合规 → 覆盖度 → 多维评分 → Gate 判定 → 自动优化建议」全流程闭环。

```bash
npm run eval:pipeline -- --skill yida-dashboard
# 加 JUnit 报告: --format junit
```

验证点:
- 输出 6 个步骤的 PASS/FAIL/WARN/SKIP 状态。
- 产出 `project/.cache/eval/pipeline/<run-id>/pipeline-report.json` 和 `suggestions.md`。
- 当综合评分 Gate = fail 时,自动生成按优先级排序的优化建议(blocker > critical > high > medium)。
- 退出码:Gate 通过 = 0,不通过 = 1(CI 红线)。

---

## 第 3 步:路由测评(选对子技能吗,无真实资源,需要 `claude` CLI)

> 目的:测 agent 能否从 ~50 个子技能里**选对一个**——这是 SKILL.md 最核心的能力。

真实调用本地 `claude -p`,把 `scripts/eval/scenarios/` 里的自然语言 prompt 各跑一遍,比对选中的子技能。**不建宜搭应用、不需要登录**。

```bash
# 先确认 claude CLI 存在
claude --version

npm run eval:routing
```

- 预期:每条 scenario 输出 `expectedSkill vs actualSkill`、整体命中率与混淆对。
- 报告:`project/.cache/eval/routing-report.json`。
- 降级:没装 `claude` CLI 时会提示 agent 不可用,不会崩溃。

---

## 第 4 步:A/B 基线对比(Baseline,无真实资源)

> 目的:对比 with_skill / without_skill 两种模式的评测结果,量化 Skill 的实际价值贡献。

```bash
npm run eval:baseline -- --skill yida-dashboard
# 加 JUnit 报告: --format junit
```

验证点:
- 输出 with_skill 和 without_skill 的 pass rate、时间和 delta。
- 产出 benchmark 报告和双线雷达图 SVG。
- 使用 YAML 评测用例(优先)或 JSON scenarios(降级)。

---

## 第 5 步:工具管道基线 + 截图 + 人工打分模板(真实链路,opt-in)

> 目的(对照基线):**不经过 agent**,用固定命令把「建应用→发布→截图→打分」整条管道跑通,
> 确认基础设施本身没坏。当第 7 步「真实生成」失败时,先看这条是否绿,就能区分是 agent 还是工具的问题。

**会在宜搭组织里真的创建一次性应用**,需 `OPENYIDA_E2E=1` + 有效 token session（先 `openyida login`，再用 `openyida login --check-only --json` 验证）。

```bash
OPENYIDA_E2E=1 npm run eval:e2e -- --skill yida-dashboard --screenshot
```

验证点:
- `acceptance-manifest.json` 出现 `eval` 段(`guardrails` / `screenshots[].path` / `scores[].human=null` / `reportHtml`)。
- 同目录生成 `scoring.md`(内嵌截图 + 页面 URL + 空白人工评分表)。
- 同目录生成 `eval-report.html`:**自包含 HTML 可视化报告**,截图以 base64 内联,单文件可直接双击打开;含元数据/护栏表/截图卡片/自动+人工打分。
  - 也可在控制台(第 0 步)点右上角「📊 查看最新报告」直接在浏览器打开最新一份。
- 护栏:若「登录校验前建资源」会红线 `fail`。
- 降级:Playwright 没装则自动跳过截图(`npm install --no-save playwright && npx playwright install chromium` 可启用),e2e 仍继续。
- 截图目标会自动过滤掉 `aliwork.com/o/<slug>` 这类 vanity 分享短链(headless 下常 404,截出来是废图)。

---

## 第 6 步:端到端 + 本地 agent 自动打分

```bash
OPENYIDA_E2E=1 npm run eval:e2e -- --skill yida-dashboard --screenshot --auto-score
```

验证点:
- `eval.scores[].auto.overall` 有分值,`auto.model` 为 `claude -p`。
- 降级:没装 `claude` 则只留人工模板。

---

## 第 7 步:真实生成 —— 自然语言 → agent 真实生成应用(真实链路,opt-in)

> 目的:最接近真实用户的端到端测评——测「一句话能否真生成可用应用」(选对 + 真做对 + 做得好不好)。

把一句「帮我创建一个订单管理系统」喂给本地 `claude -p`,**让它自己读懂 openyida 技能、
自己决定并真的执行 CLI 命令**产出真实应用,再复用截图 + 打分 + HTML 报告链路。
与第 5 步「工具管道基线」的区别:基线是确定性 CLI(固定命名直接调命令、不经过 agent),
本步走自然语言、由 agent 自主编排。

```bash
# 需 OPENYIDA_E2E=1 + headless agent 已认证(claude 已登录或设 ANTHROPIC_API_KEY)
OPENYIDA_E2E=1 npm run eval:generate -- --screenshot
# 自定义 golden 集目录: --gen-scenarios <dir>(默认 scripts/eval/scenarios/generation)
# 加本地 agent 自动打分: --auto-score
```

验证点:
- golden 集 `scripts/eval/scenarios/generation/generation-core.json`(订单管理 / 请假审批 / 销售看板)逐条跑。
- 每条输出 `产出资源 / 通过` 计数与通过率;`expectedFeatures` 校验 appType / 目标数 / 类型 / 关键词。
- 重型场景可增加执行证据契约：
  - `expectedSkills.required/optional`：实际使用的子技能；optional 缺失只记覆盖缺口，不阻断通过。
  - `expectedCommands.required/optional`：harness 通过临时 PATH shim 独立记录真实 `openyida` / `yida` 调用，可断言命令前缀、`argsIncludes` 和 `minCount`。
  - `expectedResources.required/optional`：按资源 `type`、`name` / `nameIncludes`、`id`、`minCount` / `exactCount` 断言；还能检查权限包数、报表组件/图表/跨应用数据源、自动化状态、公开路径和种子数据实例数。
  - `forbiddenFindings`：禁止出现的 finding code，例如 `resource-before-login-check`、`protected-resource-referenced`。
  - `expectedSchemaDiff`：断言 `minAdded/minRemoved/minChanged`、`maxAdded/maxRemoved/maxChanged`、`addedKeys/removedKeys/changedKeys/stableKeys`；上限为 0 可验证幂等重放。
- 场景可显式设置 `readback.enabled=true`，由当前 link 的 OpenYida CLI 在 agent 完成后执行只读回查：
  - `list-forms` 证明 form/process/page/report；
  - `integration list`、`nav-group list`、`i18n overview` 证明治理资源；
  - `permissionFormNames` 与 `sharePageNames` 只回查场景点名的表单/页面；
  - `dataPresenceFormNames` 对点名业务表执行只读 `data query ... --size 1`，仅记录实例数量，不把表单正文写进报告；
  - `reportInspect=true` 回查报表版本、组件、未知 cube 和逐图表真实查询探针；任一探针失败会生成 `report-runtime-query-failed`；
  - `pageRuntime` 为截图目标附加浏览器运行时契约，检查 console/page error、破图、加载收敛、正文长度和空数据文案；看板可按页面名启用 `requireKnownDataEvidence`，与 `dataPresenceFormNames` 的只读记录数交叉验证；
  - `portalNames` 将平台上的 display 页面按场景语义额外标记为 portal。
- readback 资源标记为 `source=platform-readback`，与 `agent-report` 分离；readback 命令不计入 agent 的 `expectedCommands`。
- 命令轨迹只保存脱敏参数、顺序、退出码和耗时，不保存 stdout/stderr；agent 自报的 commands 不会被采信。
- 有证据契约但未满足时状态为 `evidence-miss`，并写入 JSON/HTML 报告；旧场景不声明这些字段时保持兼容。
- finding 先按 `application-gap` / `diagnostic` / `openyida-optimization` / `resolved` 分层：CRM 资源缺口只写 `affected`，待重放问题只写 `diagnosticTargets`，只有证据足以指向 OpenYida 时才写 `targets`。问题组分别聚合为 `affected*`、`diagnostic*`、`target*` 字段，避免把相关技能误报为待优化技能。
- 产物落 `project/.cache/eval/generate/gen-<时间戳>/`：`generation-report.json` + `optimization-backlog.json` + `scoring.md` + `eval-report.html`。
- 控制台(第 0 步)「📊 查看最新报告」会自动包含「真实生成」的最新报告。
- 降级:`claude` 不可用 → 整批标 `agent-unavailable`;Playwright 缺失 → 跳过截图;均不崩。

历史真实运行可用最新验收合同重新诊断，无需再次运行 agent 或写远端资源：

```bash
npm run eval:replay -- \
  --report project/.cache/eval/generate/gen-123/generation-report.json \
  --scenario scripts/eval/scenarios/crm-pro/generation-crm-pro.json \
  --app-type APP_XXX \
  --trace-completeness partial
```

`partial` 是默认值：只对 trace 中明确观察到的失败做候选归因，不把未出现的命令武断判断为技能遗漏。只有确认报告覆盖完整冷启动进程时才使用 `full`。

## 第 8 步:三类测评一起跑

```bash
OPENYIDA_E2E=1 npm run eval:all -- --skill yida-dashboard --screenshot
# all = 路由测评 + 工具管道基线 + 真实生成
```

---

## 配置与常用 flag

优先级:`CLI flag > env(OPENYIDA_EVAL_*) > scripts/eval/eval.config.json > 默认`。

| Flag | 作用 |
|------|------|
| `--mode e2e\|routing\|generate\|pipeline\|baseline\|comprehensive\|all` | 跑哪几层 |
| `--skill <name>` | 限定评测目标子技能 |
| `--stages a,b` | 显式指定 stage,覆盖 skill 反查 |
| `--screenshot` / `--no-screenshot` | 是否截发布页(默认开;Playwright 缺失则跳过) |
| `--auto-score` / `--no-auto-score` | 是否用本地 `claude -p` 给截图打分(默认关 → 仅人工模板) |
| `--scenarios <dir>` | 路由测评 golden 集目录(默认 `scripts/eval/scenarios`) |
| `--gen-scenarios <dir>` | 真实生成 golden 集目录(默认 `scripts/eval/scenarios/generation`) |
| `--gen-timeout-ms <ms>` | 单条真实生成 agent 超时（默认 600000；重型场景可显式提高） |
| `--baseline` / `--no-baseline` | 是否启用 A/B 对比(baseline 模式下默认开) |
| `--format junit` | 额外生成 JUnit XML 报告(CI 集成用) |
| `--fix` | pipeline 模式下尝试自动修复(实验性) |

---

## Skill-as-Evaluator(自然语言触发评测)

可以通过 openyida 的 `yida-skill-evaluator` 子技能用自然语言触发评测:

```
评测一下 yida-dashboard 技能
```

Agent 会自动运行 Pipeline 评测并输出结构化报告,包含评分卡、准出判定和优化建议。

---

## CI 自动化

项目配置了 `.github/workflows/skill-eval.yml`,支持三种自动触发:

| 场景 | 触发条件 | 评测范围 |
|------|----------|----------|
| PR | `yida-skills/` 或 `scripts/eval/` 变更 | 静态 + 安全 + 覆盖度 + 变更技能的综合评测 |
| Nightly | 每日 10:00 北京时间 | 全量 pipeline 评测(含 JUnit) |
| Release | tag `v*` 推送 | 严格 pipeline 准出门槛(失败阻断发布) |
| 手动 | workflow_dispatch | 自定义模式和技能 |

---

## 最小验证组合

只想快速确认 harness 没问题:跑 **第 1 步**(单测)+ **第 2 步**(Pipeline)即可——
前者证明逻辑对,后者证明全流程闭环正常,都不动宜搭线上资源。

---

## 评测模式一览

| 模式 | 命令 | 说明 | 副作用 |
|------|------|------|--------|
| pipeline | `eval:pipeline -- --skill <name>` | 全自动闭环(推荐) | 无 |
| doc-quality | `eval:doc-quality` | 文档规范性 | 无 |
| routing | `eval:routing` | 路由准确率 | 无(需 agent CLI) |
| safety | `eval:safety` | 安全合规 | 无 |
| coverage | `eval:coverage` | 覆盖度 | 无 |
| comprehensive | `eval:comprehensive -- --skill <name>` | 10 维度评分 | 无 |
| baseline | `eval:baseline -- --skill <name>` | A/B 基线对比 | 无 |
| e2e | `eval:e2e` | 工具管道基线 | **创建真实资源** |
| generate | `eval:generate` | 真实生成 | **创建真实资源** |
| all | `eval:all` | 路由+e2e+生成 | **创建真实资源** |

---

## 已知前置问题(与本 harness 无关)

当前 checkout 下 `npm run check:ci` 跑不全绿,原因在 HEAD 本身:
- 仓库缺 `.eslintrc.json` → `npm run lint` / `check:structure` 失败。
- `lib/samples/yida-chart/china-map.js` 是 ESM → `check:syntax` 报错。

这两项是仓库既有问题,不是测评 harness 引入的。
