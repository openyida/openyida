# OpenYida Skill 多维度综合测评方案

> 版本：1.0 | 日期：2026-07-13
> 目标："写 Skill -> 自动测试 -> 自动评测"闭环

---

## 一、背景与目标

Skill 评测旨在对抗 AI 的不确定性、幻觉及上下文失忆等问题，确保智能体的效果稳定与质量确定性。
本方案在现有 3 层 eval harness（routing / e2e / generation）基础上，构建 **10 维评测模型**，
实现"写 Skill -> 静态校验 -> 路由测试 -> 生成评测 -> 多维评分 -> Gate 判定"的全自动闭环。

### 现状分析

| 层级 | 现有工具 | 覆盖情况 | 主要缺口 |
|------|---------|---------|---------|
| 静态校验 | `validate-skills.js` | frontmatter / 链接 / index 一致性 | 不评文档质量、不检查语义完整性 |
| 路由准确率 | `routing.js` + 15 scenarios | 15/38 技能有 golden case | 23 个技能无覆盖；无反例测试 |
| E2E 管线 | `full-runner.js` | 确定性 CLI 管线基线 | 不含 Agent 决策链路 |
| 生成评测 | `generate.js` + 3 scenarios | 端到端创建真实应用 | 仅 3 个场景，维度单一 |
| 安全护栏 | `guardrail.js` | login-before-mutation | 无 Token/凭证泄漏检测 |
| 视觉打分 | `score.js` 4 维 rubric | layout / data / fit / usability | 无结构化输出校验、无一致性评测 |

---

## 二、10 维评测模型

```
   D1a 规范性          D2 触发准确率
       \                  /
  D1b 可维护性 ----+---- D8 执行完整性
       |           |          |
  D7 覆盖度    综合评分     D9 输出有效性
       |           |          |
  D6 稳定性 ----+---- D3 生成质量
       /                  \
   D5 效率            D4 安全合规
                      |
                  D10 知识增量
```

### D1a — 规范性 (Standards)

评估 SKILL.md 是否符合项目规范。

| 检查项 | 方法 | 权重 |
|--------|------|------|
| frontmatter 完整性（name / description） | 现有 validate-skills.js | 0.20 |
| 必要章节覆盖（触发条件 / 工作流 / 输出格式） | 正则检测 | 0.25 |
| 引用文件存在且非空 | 文件系统检查 | 0.20 |
| 示例覆盖率（代码块或 examples/ 目录） | 计数 | 0.15 |
| 消歧明确性（WHEN NOT 或"不适用"条款） | 正则 + AI 辅助 | 0.20 |

实现文件：`scripts/eval/doc-quality.js`

### D1b — 可维护性 (Maintainability)

评估 Skill 的工程结构质量。

| 检查项 | 规则 | 权重 |
|--------|------|------|
| 文件行数 | SKILL.md <= 500 行 | 0.15 |
| 引用链深度 | <= 3 层 | 0.20 |
| 引用文件数 | references/ 文件数 <= 10 | 0.15 |
| 无循环引用 | 检测 markdown link 环 | 0.20 |
| 命名一致性 | 目录名 = frontmatter name | 0.15 |
| 依赖隔离 | 不引用其他技能的内部 references | 0.15 |

实现：集成在 `scripts/eval/doc-quality.js` 中。

### D2 — 触发准确率 (Routing Accuracy)

评估 Agent 能否从自然语言正确路由到目标技能。

改进要点：
- **全量覆盖**：每个技能至少 2 正例 + 2 反例，从 15 -> 76+ scenarios
- **反例测试**：`mustNotTrigger` 字段标记不该命中的技能
- **对抗性消歧**：针对易混淆技能对增加边界 case
- **多轮稳定性**：同一 scenario 跑 N 次（`--runs 3`）

Scenario 格式扩展：
```json
{
  "id": "dashboard-negative-1",
  "prompt": "帮我导出这个表的数据为 Excel",
  "expectedSkill": "yida-data-management",
  "mustNotTrigger": ["yida-dashboard", "yida-report"],
  "type": "negative",
  "difficulty": "hard",
  "category": "disambiguation"
}
```

指标：
- 触发准确率 = 正例命中数 / 正例总数
- 拒绝准确率 = 反例正确拒绝数 / 反例总数
- 综合触发分 = 触发准确率 x 0.6 + 拒绝准确率 x 0.4

实现文件：`scripts/eval/routing.js`（修改）+ `scenarios/routing-full.json`（新增）

### D3 — 生成质量 (Generation Quality)

评估技能执行后产出物的实际质量。

| 子维度 | 评测方式 |
|--------|---------|
| 页面渲染完整性 | 截图 + 视觉评分（6 维扩展 rubric） |
| CLI 命令正确性 | 解析 Agent 调用的命令序列，校验参数合法性 |
| 数据正确性 | 数据操作类：校验表单/数据是否符合预期 |
| 流程正确性 | 流程类：校验审批节点/条件是否正确配置 |

扩展 rubric（在原有 4 维基础上 +2）：
- `cliCorrectness`：CLI 调用正确性
- `outputCompliance`：输出规范性

场景扩展：从 3 -> ~16 个（每个 category 至少 2 个）。

实现文件：`scripts/eval/generate.js`（修改）+ `scripts/eval/score.js`（修改）

### D4 — 安全合规 (Safety & Compliance)

确保技能执行不泄漏凭证、不执行危险操作。

| 检查项 | 方法 |
|--------|------|
| login-before-mutation | 现有 guardrail.js |
| 无硬编码凭证 | 正则扫描 Agent 输出和生成代码中的 Cookie / Token / AK/SK |
| 命令白名单 | Agent 仅调用 command-manifest 中已注册的命令 |
| corpId 一致性 | 全链路中 corpId 不被 Agent 猜测/替换 |
| 敏感数据脱敏 | 日志/输出中无明文凭证 |

实现文件：`scripts/eval/safety.js`（新增）

### D5 — 效率 (Efficiency)

衡量技能执行的资源消耗。

| 指标 | 采集方式 |
|------|---------|
| Agent 调用轮次 | 解析 transcript 中 tool call 次数 |
| 总 Token 数 | 从 claude -p 输出提取 usage |
| 端到端耗时 | 计时 |
| CLI 命令数 | 统计 openyida 命令总数 |
| 冗余命令率 | 检测重复/无效的 CLI 调用 |

评分基准：按 category 建立 baseline，超出 2x 标记为低效。

实现文件：`scripts/eval/efficiency.js`（新增）+ `scripts/eval/efficiency-baseline.json`

### D6 — 稳定性 (Stability)

同一输入多次执行的结果一致性。

方法：
1. 对每个 scenario 跑 N 次（默认 3）
2. 计算路由选择一致性、输出结构一致性、评分方差
3. 报告一致性率 = 完全一致次数 / 总次数

实现：集成在 routing.js 和 generate.js 的 `--runs N` 参数中。

### D7 — 覆盖度 (Coverage)

度量测评体系本身的完整性。

| 指标 | 计算方式 |
|------|---------|
| 技能覆盖率 | 有 routing scenario 的技能数 / 总技能数 |
| Category 覆盖率 | 有 generation scenario 的 category 数 / 总 category 数 |
| 命令覆盖率 | 被测试触及的 CLI 命令 / command-manifest 总命令 |
| Reference 使用率 | 被引用的 reference 文件 / references/ 下总文件数 |

实现文件：`scripts/eval/coverage.js`（新增）

### D8 — 执行完整性 (Step Completeness)

评估 Skill 是否完整执行了 SKILL.md 中定义的所有工作流步骤。

方法：
1. 解析 SKILL.md 中的工作流步骤定义
2. 对比 Agent transcript 中实际执行的命令/动作
3. 计算步骤完成率

实现文件：`scripts/eval/step-completeness.js`（新增）

### D9 — 输出有效性 (Output Validity)

评估 Agent 输出是否符合 SKILL.md 定义的输出格式规范。

方法：
1. 定义各技能的输出 JSON Schema
2. 解析 Agent 实际输出
3. 校验结构、必填字段、值类型

实现文件：`scripts/eval/output-validity.js`（新增）

### D10 — 知识增量 (Knowledge Delta)

评估 Skill 相对于裸模型的增量价值。

方法：A/B 对比
- A 组（有 Skill）：`claude -p --add-dir ./yida-skills "prompt"`
- B 组（无 Skill）：`claude -p "prompt"`（不加载技能目录）

对比指标：命令正确率 delta、步骤完成率 delta、输出质量评分 delta、幻觉率差异。

增量公式：`知识增量分 = (有Skill评分 - 无Skill评分) / max(无Skill评分, 1) x 100`

实现：集成在 generate.js 的 `--ab-compare` 模式中。

---

## 三、准出标准

### 硬门槛（任一 Fail 即阻断）

| 指标 | 准出标准 |
|------|---------|
| 触发准确率 | >= 85% |
| 步骤完成率 | = 100% |
| 功能测试通过率 | >= 95% |
| 输出格式正确率 | >= 85% |
| 安全合规 | 0 failures |

### 软指标（不阻断，标 warning）

| 指标 | 建议达标 |
|------|---------|
| 知识增量 | > 0 |
| 效率 | 在 2x baseline 内 |
| 稳定性一致率 | >= 80% |
| 文档质量 | >= 70 分 |
| 可维护性 | >= 60 分 |

---

## 四、闭环流水线

```
┌───────────┐   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐
│  写 Skill  │──>│  Gate 1      │──>│  Gate 2      │──>│  Gate 3       │
│  SKILL.md  │   │  静态校验     │   │  路由测试     │   │  生成评测      │
│            │   │  D1a+D1b+D7  │   │  D2+D4(lite) │   │  D3+D4+D5+D8  │
│            │   │  <10s, 离线   │   │  ~2min       │   │  +D9+D10      │
│            │   │              │   │  需 claude    │   │  ~10min       │
└───────────┘   └──────┬───────┘   └──────┬───────┘   │  需真实环境    │
                       │                  │            └───────┬───────┘
                       │ Fail?            │ Fail?              │
                       ▼                  ▼                    ▼
                  修复反馈            修复反馈          ┌──────────────┐
                                                      │  多维评分聚合  │
                                                      │  D1-D10 雷达图 │
                                                      │  + 改进建议    │
                                                      └──────┬───────┘
                                                             │
                                                             ▼
                                                      ┌──────────────┐
                                                      │  Gate 判定    │
                                                      │  Pass → merge │
                                                      │  Fail → fix   │
                                                      └──────────────┘
```

### Gate 1 — 静态校验（无副作用，<10s）

```bash
npm run eval:doc-quality -- --skill yida-xxx
```

通过标准：D1a >= 70 分，D1b >= 60 分，D7 无 error 级问题。

### Gate 2 — 路由测试（需 claude CLI，无 Yida 副作用，~2min）

```bash
npm run eval:routing -- --skill yida-xxx --runs 3
```

通过标准：触发准确率 >= 85%，拒绝准确率 >= 90%，一致性率 >= 80%。

### Gate 3 — 生成评测（需 claude CLI + Yida 登录，~10min）

```bash
npm run eval:generate -- --skill yida-xxx --auto-score
```

通过标准：D3 >= 60 分，D4 无 fail，D8 步骤完成率 = 100%，D9 格式正确率 >= 85%。

---

## 五、CLI 入口设计

### 新增 npm scripts

```json
{
  "eval:doc-quality": "node scripts/eval/runner.js --mode doc-quality",
  "eval:safety": "node scripts/eval/runner.js --mode safety",
  "eval:efficiency": "node scripts/eval/runner.js --mode efficiency",
  "eval:coverage": "node scripts/eval/runner.js --mode coverage",
  "eval:comprehensive": "node scripts/eval/runner.js --mode comprehensive",
  "eval:all-skills": "node scripts/eval/runner.js --mode all-skills"
}
```

### 统一 CLI 入口

```bash
# 全量综合评测
npm run eval:comprehensive -- --skill yida-xxx

# 各维度独立运行
npm run eval:doc-quality   -- --skill yida-xxx
npm run eval:routing       -- --skill yida-xxx --runs 3
npm run eval:generate      -- --skill yida-xxx --auto-score
npm run eval:safety        -- --skill yida-xxx
npm run eval:efficiency    -- --skill yida-xxx
npm run eval:coverage

# 全部技能
npm run eval:all-skills

# A/B 对比
npm run eval:generate -- --skill yida-xxx --ab-compare
```

---

## 六、报告输出

### 综合评分卡（JSON）

```json
{
  "skill": "yida-dashboard",
  "timestamp": "2026-07-13T10:00:00Z",
  "overall": 82,
  "dimensions": {
    "standards": { "score": 88, "details": {} },
    "maintainability": { "score": 75, "details": {} },
    "routingAccuracy": { "score": 93, "triggerRate": 0.93, "rejectRate": 0.95 },
    "generationQuality": { "score": 75, "subscores": {} },
    "safety": { "score": 100, "failures": [] },
    "efficiency": { "score": 70, "tokens": 12500, "commands": 8 },
    "stability": { "score": 85, "consistencyRate": 0.87 },
    "coverage": { "score": 80, "scenarioCount": 4 },
    "stepCompleteness": { "score": 100, "rate": 1.0, "missing": [] },
    "outputValidity": { "score": 90, "formatRate": 0.90 },
    "knowledgeDelta": { "score": 65, "delta": 0.35 }
  },
  "gate": "pass",
  "hardGates": { "trigger": "pass", "steps": "pass", "functional": "pass", "format": "pass", "safety": "pass" },
  "report": "eval-report-yida-dashboard-20260713.html"
}
```

### HTML 报告增强

- SVG 雷达图（10 维得分可视化，零依赖）
- 趋势折线图（历史评分对比）
- Gate 通过/失败醒目标识
- 问题清单（按严重程度排序 + 改进建议）

### Dashboard 增强

- 综合评测任务组
- 技能对比视图（多技能雷达图叠加）
- 历史趋势视图

---

## 七、Skill-as-Evaluator

将评测封装为 openyida 子技能 `yida-skill-evaluator`，开发者可通过自然语言触发：

> "帮我评测一下 yida-dashboard 这个技能的质量"

Agent 加载 yida-skill-evaluator -> 调用 `openyida eval` CLI -> 输出结果。

---

## 八、多矩阵测试

支持 `eval.config.json` 中配置矩阵：

```json
{
  "matrix": {
    "models": ["claude-sonnet-4-6", "claude-opus-4-6"],
    "agents": ["claude-code", "qoder", "wukong"],
    "branches": ["master", "feat/new-skill"]
  }
}
```

CI nightly 通过 GitHub Actions strategy.matrix 驱动。

---

## 九、CI 集成

| 级别 | 触发条件 | 运行内容 | 阻断 |
|------|---------|---------|------|
| PR | label: skill-change | Gate 1 + Gate 2(core) | 是 |
| Nightly | cron 每日 20:00 UTC | 全量 10 维评测 | 否，产出报告 |
| Release | v* tag | 全技能 D1+D2+D7 | 是 |

---

## 十、新增文件清单

```
scripts/eval/
  doc-quality.js              # [P0] D1a+D1b 文档质量 + 可维护性
  coverage.js                 # [P0] D7 覆盖度分析
  safety.js                   # [P1] D4 安全合规
  step-completeness.js        # [P1] D8 执行完整性
  output-validity.js          # [P2] D9 输出有效性
  efficiency.js               # [P3] D5 效率分析
  comprehensive.js            # [P3] 综合评测编排器
  radar-chart.js              # [P3] SVG 雷达图（零依赖）
  history.js                  # [P3] 历史评分存取
  generate-routing-scenarios.js  # [P0] 路由 scenario 自动生成辅助
  efficiency-baseline.json    # [P3] 各 category 效率基准
  safety-rules.json           # [P1] 安全检查规则
  scenarios/
    routing-full.json         # [P0] 全量 76+ scenarios
    routing-adversarial.json  # [P0] 对抗性消歧
    doc-quality-rules.json    # [P0] 文档质量检查规则
    generation/
      generation-form.json         # [P2]
      generation-process.json      # [P2]
      generation-dashboard.json    # [P2]
      generation-connector.json    # [P2]
      generation-page.json         # [P2]
  config.js                   # [修改] 新增 mode 和配置项
  runner.js                   # [修改] 新增 mode 路由
  routing.js                  # [修改] --runs / --skill / mustNotTrigger
  generate.js                 # [修改] --ab-compare / 场景扩展
  score.js                    # [修改] 扩展 rubric
  report.js                   # [修改] 雷达图 + 趋势图

tests/
  eval-doc-quality.test.js    # [P0]
  eval-coverage.test.js       # [P0]
  eval-safety.test.js         # [P1]
  eval-step-completeness.test.js  # [P1]
  eval-output-validity.test.js    # [P2]
  eval-efficiency.test.js     # [P3]
  eval-comprehensive.test.js  # [P3]
  eval-radar-chart.test.js    # [P3]
```

---

## 十一、实施优先级

| 阶段 | 内容 | 预估 | 依赖 |
|------|------|------|------|
| P0 | D1a 规范性 + D1b 可维护性 + D7 覆盖度 + 路由场景扩充 | 2-3 天 | 无（纯离线） |
| P1 | D4 安全 + D6 稳定性 + D8 步骤完整性 | 1-2 天 | P0 |
| P2 | D3 生成场景 + D9 输出有效性 + 扩展 rubric | 2-3 天 | P1 |
| P3 | D5 效率 + D10 知识增量 + 综合编排 + 雷达图 + 历史 | 2-3 天 | P2 |
| P4 | Dashboard + CI + Skill-as-Evaluator | 1-2 天 | P3 |

总计 8-13 工作日，按 P0 -> P4 迭代推进。
