---
name: yida-skill-evaluator
description: >
  评测指定的 openyida 技能质量。输入技能名称，自动执行全链路闭环评测
  （静态校验 → 路由测试 → 安全合规 → 覆盖度 → 多维评分 → 准出门槛 → 优化建议），
  生成评测报告和改进建议。不要触发本技能来执行其他 openyida 开发任务。
triggers:
  - 评测技能
  - 测试技能
  - skill eval
  - 评估技能质量
  - 跑一下评测
  - 技能打分
  - 检查技能
  - 技能准出
  - 评测 xx 技能
  - run eval
---

## 触发条件

当用户的意图是「评测/测试/检查某个 openyida 技能的质量」时触发。典型表述：

- "评测一下 yida-dashboard 技能"
- "帮我跑一下 skill eval"
- "检查这个技能的质量"
- "这个技能能不能准出？"
- "评估 yida-report 技能"
- "测试下路由准确率"

## 前置条件

1. 确认目标技能名称（如 `yida-dashboard`）。若用户未指定，列出可用技能供选择：
   ```bash
   ls yida-skills/skills/
   ```
2. 确认 Node.js 版本 ≥ 18：
   ```bash
   node --version
   ```
3. 确认依赖已安装：
   ```bash
   npm install
   ```

## 工作流

### Step 1 — 快速评测（默认，无副作用）

大多数情况使用 `pipeline` 模式，它会自动串联所有评测步骤：

```bash
node scripts/eval/pipeline.js --skill <技能名>
```

该命令自动执行以下全部步骤：
1. 静态校验（文档规范性 + 可维护性）
2. 路由测试（命中率 + 混淆对）
3. 安全合规检查
4. 覆盖度分析
5. 10 维度综合评分 + 加权总分
6. 准出门槛判定 + 自动优化建议

产物目录：`project/.cache/eval/pipeline/<run-id>/`

读取结果：
```bash
cat project/.cache/eval/pipeline/*/pipeline-report.json | tail -1
```

### Step 2 — 解读结果

从 `pipeline-report.json` 中提取关键信息，向用户报告：

1. **Pipeline 状态**：`status` 字段（pass / fail / warn）
2. **各步骤结果**：`steps[]` 数组的 step / status / score / detail
3. **总分**：`scorecard.overall`（0-100 分）
4. **准出判定**：`scorecard.gate`（pass = 可准出，fail = 不可准出）
5. **硬门槛详情**：`scorecard.hardGates` 中每项的状态
6. **优化建议**：`suggestions[]` 中按 priority 排序的改进项

### Step 3 — 深度评测（可选，用户要求时）

如果用户要求更深度的评测（如 A/B 对比、JUnit 报告）：

```bash
# A/B 基线对比（with_skill vs without_skill）
node scripts/eval/runner.js --mode baseline --skill <技能名> --format junit

# 单独维度评测
node scripts/eval/runner.js --mode doc-quality --skill <技能名>
node scripts/eval/runner.js --mode comprehensive --skill <技能名>
```

### Step 4 — Web 控制台（可选）

如果用户希望在浏览器中查看评测结果：

```bash
npm run eval:dashboard
```

然后打开 http://127.0.0.1:4500 查看控制台。

### Step 5 — 输出评测报告

向用户呈现结构化报告：

```
## 技能评测报告：<技能名>

### Pipeline 状态：<PASS/FAIL/WARN>

| 步骤 | 状态 | 分数 | 详情 |
|------|------|------|------|
| 静态校验 | ✔/✗ | xx | ... |
| 路由测试 | ✔/✗ | xx% | ... |
| 安全合规 | ✔/✗ | xx | ... |
| 覆盖度 | ✔/✗ | xx% | ... |
| 综合评分 | ✔/✗ | xx/100 | ... |
| 准出判定 | ✔/✗ | - | ... |

### 评分卡（10 维度）

| 维度 | 得分 | 权重 | 加权得分 |
|------|------|------|----------|
| 规范性 | xx | 10% | x.x |
| 可维护性 | xx | 5% | x.x |
| 路由准确率 | xx | 15% | x.x |
| ... | ... | ... | ... |
| **总分** | **xx** | | |

### 准出门槛

| 门槛 | 要求 | 实际 | 状态 |
|------|------|------|------|
| 触发准确率 | ≥ 85% | xx% | ✔/✗ |
| 步骤完成率 | = 100% | xx% | ✔/✗ |
| 功能测试通过率 | ≥ 95% | xx% | ✔/✗ |
| 输出格式正确率 | ≥ 85% | xx% | ✔/✗ |
| 安全合规 | 0 failures | xx | ✔/✗ |

### 优化建议（前 3 条）

1. [blocker/critical/high] ...
2. ...
3. ...
```

## 可用评测模式

| 模式 | 命令 | 说明 |
|------|------|------|
| pipeline | `--mode pipeline` | 全自动闭环（推荐） |
| doc-quality | `--mode doc-quality` | 文档规范性 |
| routing | `--mode routing` | 路由准确率 |
| safety | `--mode safety` | 安全合规 |
| coverage | `--mode coverage` | 覆盖度 |
| comprehensive | `--mode comprehensive` | 10 维度评分 |
| baseline | `--mode baseline` | A/B 基线对比 |
| e2e | `--mode e2e` | 端到端基线（需 OPENYIDA_E2E=1） |
| generate | `--mode generate` | 真实生成（需 OPENYIDA_E2E=1） |

## WHEN NOT

- **不处理**应用搭建、页面开发、数据管理等开发任务
- **不处理**非 openyida 技能的评测
- **不修改**技能文件——仅读取和评测（除非用户明确要求根据建议修改）
- **不执行**需要真实宜搭资源的评测（e2e / generate），除非用户明确要求
- 不与 `yida-dashboard`、`yida-report`、`yida-create-process` 等搭建类技能混淆
