'use strict';

// 零依赖本地 harness 控制台:静态页 + SSE 实时流式运行预定义任务。
// 启动:  node scripts/eval/dashboard/server.js   (建议先 nvm use 20)
// 仅监听 127.0.0.1,任务为白名单固定命令,不接受任意命令注入。

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..'); // 仓库根目录
const HOST = '127.0.0.1';
const PORT = Number(process.env.EVAL_DASHBOARD_PORT || process.argv[2] || 4500);

// 白名单任务:id -> { label, group, danger, args(传给 npx/npm 的参数), env }
// 用 process.execPath 跑 node 子进程,保证与启动 server 的 Node 版本一致。
const TASKS = {
  'unit-eval': {
    label: '逻辑自检 · harness 单测',
    purpose: '验证测评 harness 自己的代码是对的——配置解析、护栏断言、报告回写、提示词解析等纯函数逻辑。',
    description: 'harness 纯函数单测（config/guardrail/manifest/routing/report/generate），无副作用、不调 agent、不建资源。改了 harness 代码先跑这个。',
    group: 'safe',
    danger: false,
    bin: 'npx',
    args: ['jest', 'tests/eval-config.test.js', 'tests/eval-guardrail.test.js',
      'tests/eval-manifest.test.js', 'tests/eval-routing.test.js',
      'tests/eval-report.test.js', 'tests/eval-generate.test.js',
      'tests/eval-doc-quality.test.js', 'tests/eval-coverage.test.js',
      'tests/eval-safety.test.js', 'tests/eval-step-completeness.test.js',
      'tests/eval-output-validity.test.js', 'tests/eval-efficiency.test.js',
      'tests/eval-radar-chart.test.js', 'tests/eval-comprehensive.test.js',
      '--colors=false'],
  },
  'unit-all': {
    label: '回归自检 · 全量单测',
    purpose: '确认你对仓库的改动没有弄坏其他模块。',
    description: '跑整个仓库的 jest 测试套件。范围最大、耗时较长，但仍无副作用。',
    group: 'safe',
    danger: false,
    bin: 'npx',
    args: ['jest', '--colors=false'],
  },
  'doc-quality': {
    label: '文档规范性 · 静态评测',
    purpose: '检查所有 SKILL.md 是否符合 frontmatter / sections / references / examples / disambiguation 规范。',
    description: '纯静态分析，无副作用。扫描所有技能文档的规范性和可维护性，输出评分和改进建议。',
    group: 'safe',
    danger: false,
    bin: 'npm',
    args: ['run', 'eval:doc-quality'],
  },
  safety: {
    label: '安全合规 · 凭证泄漏检测',
    purpose: '检查 Agent 输出中是否存在凭证泄漏、命令白名单越权等安全问题。',
    description: '静态检查 Agent 命令和输出中的凭证模式、命令白名单、corpId 一致性等。独立模式下以空数据运行基础检查。',
    group: 'safe',
    danger: false,
    bin: 'npm',
    args: ['run', 'eval:safety'],
  },
  coverage: {
    label: '覆盖度 · 测评体系完整性',
    purpose: '度量测评体系本身的完整性——技能覆盖率、分类覆盖率、引用覆盖率。',
    description: '分析 routing scenarios 覆盖了多少技能、多少分类，以及技能间引用关系的覆盖度。',
    group: 'safe',
    danger: false,
    bin: 'npm',
    args: ['run', 'eval:coverage'],
  },
  comprehensive: {
    label: '综合评测 · 10 维度评分卡',
    purpose: '对指定技能执行全部 10 个维度的评测，生成评分卡、雷达图和趋势分析。',
    description: '依次运行文档质量、路由准确率、安全合规、步骤完成率、输出有效性等维度，汇总为加权总分和准出门槛判定。需指定 --skill。',
    group: 'safe',
    danger: false,
    bin: 'npm',
    args: ['run', 'eval:comprehensive', '--', '--skill', 'yida-dashboard'],
  },
  routing: {
    label: '选对子技能吗 · 路由测评',
    purpose: '测 agent 能否从 ~50 个子技能里「选对那一个」。这是 SKILL.md 最核心的能力，改完技能文档先看它有没有变差。',
    description: '真实调用本地 headless agent（如 qodercli / claude），把每条自然语言请求跑一遍，只看它选中哪个子技能，与 golden 集比对，算命中率/混淆对。不创建宜搭资源、不需要宜搭登录，秒级、可高频跑。需本机有已登录的 agent CLI。默认启用并行批量模式。',
    group: 'safe',
    danger: false,
    bin: 'npm',
    args: ['run', 'eval:routing', '--', '--parallel'],
  },
  e2e: {
    label: '工具管道基线 · 固定命令端到端',
    purpose: '对照基线：用固定命令（不经过 agent）把「建应用→发布→截图」整条管道跑通，确认基础设施本身没坏。当“真实生成”失败时，先看这条是不是绿的，就能区分是 agent 的问题还是工具的问题。',
    description: '确定性 CLI 链路：按固定命名真实创建并发布应用/表单/看板，截图发布页。刻意不经过 agent、不发自然语言提示词。会在你的宜搭组织创建一次性资源。',
    group: 'danger',
    danger: true,
    bin: 'npm',
    args: ['run', 'eval:e2e', '--', '--skill', 'yida-dashboard', '--screenshot'],
    env: { OPENYIDA_E2E: '1' },
  },
  'e2e-score': {
    label: '工具管道基线 + 自动打分',
    purpose: '在“管道基线”之上，再验证「截图自动打分」这一环也能跑通。',
    description: '在固定命令端到端基础上，用多模态 headless agent 对截图按 rubric 自动打分。会创建真实宜搭资源。',
    group: 'danger',
    danger: true,
    bin: 'npm',
    args: ['run', 'eval:e2e', '--', '--skill', 'yida-dashboard', '--screenshot', '--auto-score'],
    env: { OPENYIDA_E2E: '1' },
  },
  generate: {
    label: '真实生成质量 · 自然语言建应用',
    purpose: '最接近真实用户的端到端测评：把一句自然语言喂给 agent，让它自己读技能、自己决定并真的执行 CLI 把应用建出来，再截图打分。测的是「选对 + 真做对 + 做得好不好」的整体效果。',
    description: '把「帮我创建一个订单管理系统」这类自然语言喂给 headless agent（如 qodercli / claude），让它自主读技能 + 真的执行 CLI 产出真实应用，再截图。最慢、有副作用，适合发版前/大改动后跑。会创建真实宜搭资源，需已认证 agent。默认启用并行模式。',
    group: 'danger',
    danger: true,
    bin: 'npm',
    args: ['run', 'eval:generate', '--', '--screenshot', '--parallel'],
    env: { OPENYIDA_E2E: '1' },
  },
  pipeline: {
    label: '全自动闭环 · Pipeline',
    purpose: '一键串联「静态校验 → 路由测试 → 安全合规 → 覆盖度 → 多维评分 → Gate 判定 → 自动优化建议」全流程闭环，输出评分卡和改进建议。',
    description: '全自动评测闭环。依次运行所有评测步骤，最终给出准出判定和优化建议列表。不创建真实资源，纯静态+路由级评测。需指定 --skill。',
    group: 'safe',
    danger: false,
    bin: 'npm',
    args: ['run', 'eval:pipeline', '--', '--skill', 'yida-dashboard', '--format', 'junit'],
  },
  baseline: {
    label: 'A/B 基线对比 · Baseline',
    purpose: '对比 with_skill 和 without_skill 两种模式的评测结果，量化 Skill 的实际价值贡献。',
    description: '运行 A/B 对比评测，生成 benchmark 报告和双线雷达图。需 YAML 评测用例或 JSON scenarios 作为输入。需指定 --skill。',
    group: 'safe',
    danger: false,
    bin: 'npm',
    args: ['run', 'eval:baseline', '--', '--skill', 'yida-dashboard'],
  },
};

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const runs = new Map(); // runId -> child process

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}

function serveIndex(res) {
  const file = path.join(__dirname, 'index.html');
  fs.readFile(file, 'utf8', (err, html) => {
    if (err) {
      return send(res, 500, 'text/plain; charset=utf-8', 'index.html 读取失败');
    }
    return send(res, 200, 'text/html; charset=utf-8', html);
  });
}

// 每个任务实际会用到哪些「提示词类别」，供前端展示。
const TASK_PROMPTS = {
  'unit-eval': [],
  'unit-all': [],
  'doc-quality': [],
  safety: [],
  coverage: [],
  comprehensive: ['comprehensive'],
  routing: ['routing'],
  e2e: ['e2e-cli'],
  'e2e-score': ['e2e-cli', 'scoring'],
  generate: ['generation', 'scoring'],
  pipeline: ['comprehensive'],
  baseline: ['comprehensive'],
};

function serveInfo(res) {
  const tasks = Object.entries(TASKS).map(([id, t]) => ({
    id, label: t.label, group: t.group, danger: t.danger,
    purpose: t.purpose || '',
    description: t.description || '',
    promptKinds: TASK_PROMPTS[id] || [],
    preview: `${t.env ? Object.entries(t.env).map(([k, v]) => `${k}=${v} `).join('') : ''}${t.bin} ${t.args.join(' ')}`,
  }));
  send(res, 200, 'application/json; charset=utf-8', JSON.stringify({
    node: process.version, cwd: ROOT, tasks,
  }));
}

// 收集 harness 真实使用的提示词（路由 / 生成 / 打分），让用户直观看到“喂给 agent 的是什么”。
function collectPrompts() {
  const SKILL_NOTE = '（此处注入 yida-skills/SKILL.md 路由说明，篇幅较长已省略）';
  const out = {};

  // 路由测评（选对子技能吗）
  try {
    // eslint-disable-next-line global-require
    const routing = require('../routing');
    const scenarios = routing
      .loadScenarios(path.join(ROOT, 'scripts', 'eval', 'scenarios'))
      .map((s) => ({ id: s.id, prompt: s.prompt, expected: s.expectedSkill || null }));
    const template = routing.buildRoutingPrompt({
      request: '<用户的自然语言请求>',
      routingContext: SKILL_NOTE,
      skillNames: ['yida-dashboard', 'yida-report', 'yida-create-process', '…（共约 50 个子技能）'],
    });
    out.routing = {
      title: '路由测评 · 提示词（测“选对子技能吗”）',
      desc: '把每条自然语言请求 + 路由说明喂给 headless agent（如 qodercli / claude），让它只回答“该选哪个子技能”，与 golden 集比对。不创建任何资源。',
      scenarios,
      template,
    };
  } catch (e) { out.routing = { title: '路由测评 · 提示词', error: e.message }; }

  // 真实生成（自然语言建应用）
  try {
    // eslint-disable-next-line global-require
    const generate = require('../generate');
    const scenarios = generate
      .loadGenerationScenarios(path.join(ROOT, 'scripts', 'eval', 'scenarios', 'generation'))
      .map((s) => ({ id: s.id, prompt: s.prompt, expectedFeatures: s.expectedFeatures || null, note: s.note || '' }));
    const template = generate.buildGenerationPrompt({
      request: '<用户需求，如：帮我创建一个订单管理系统>',
      skillContext: '（此处注入 yida-skills/SKILL.md 节选，已省略）',
    });
    out.generation = {
      title: '真实生成 · 提示词（测“自然语言能否真建出应用”）',
      desc: '把一句自然语言喂给 headless agent（如 qodercli / claude），让它自己读懂 openyida 技能、真的执行 CLI 命令产出真实应用。下面是每条 golden 用例的需求原文，以及外层包装模板。',
      scenarios,
      template,
    };
  } catch (e) { out.generation = { title: '真实生成 · 提示词', error: e.message }; }

  // 打分（截图评审）
  try {
    // eslint-disable-next-line global-require
    const score = require('../score');
    out.scoring = {
      title: '截图自动打分提示词（--auto-score 时使用）',
      desc: '逐张已发布页面截图喂给多模态 headless agent，按 rubric 打 1–10 分。不开自动分则只生成人工打分模板。',
      template: score.buildScorePrompt({
        screenshotPath: '<截图绝对路径>',
        url: '<已发布页面 URL>',
        stage: '<阶段，如 dashboard>',
      }),
    };
  } catch (e) { out.scoring = { title: '打分', error: e.message }; }

  // 工具管道基线：无自然语言提示词
  out['e2e-cli'] = {
    title: '工具管道基线 · 无自然语言提示词',
    desc: '这条是”对照基线”：直接按固定命名调用 openyida 的 create-* / publish 等命令，只验证「CLI 链路 + 截图 + 打分」这套管道本身通不通，刻意不经过 agent、不发任何自然语言提示词。\n想看「帮我创建一个订单管理系统」这类带场景的自然语言提示词，请选左侧「真实生成 · 自然语言建应用」——那一类才是把需求喂给 agent、由它自主编排 CLI。',
  };

  // 综合评测
  out.comprehensive = {
    title: '综合评测 · 10 维度评分卡',
    desc: '对指定技能执行 10 个维度的评测（规范性、可维护性、路由准确率、生成质量、安全合规、效率、稳定性、覆盖度、步骤完成率、输出有效性），汇总为加权总分和准出门槛判定。输出 JSON 评分卡和 SVG 雷达图。',
  };

  return out;
}

function servePrompts(res) {
  let payload;
  try {
    payload = collectPrompts();
  } catch (e) {
    return send(res, 500, 'application/json; charset=utf-8', JSON.stringify({ error: e.message }));
  }
  return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(payload));
}

function runTask(req, res, taskId) {
  const task = TASKS[taskId];
  if (!task) {
    return send(res, 404, 'text/plain; charset=utf-8', '未知任务');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const runId = `${taskId}-${Date.now()}`;
  const bin = process.platform === 'win32' ? `${task.bin}.cmd` : task.bin;
  const child = spawn(bin, task.args, {
    cwd: ROOT,
    env: { ...process.env, ...(task.env || {}) },
  });
  runs.set(runId, child);

  const emit = (event, data) => {
    const payload = String(data).split('\n').map((l) => `data: ${l}`).join('\n');
    res.write(`event: ${event}\n${payload}\n\n`);
  };

  emit('meta', JSON.stringify({ runId, cmd: `${task.bin} ${task.args.join(' ')}` }));

  let stdoutBuf = '';
  let stderrBuf = '';
  const pump = (chunk, bufName, stream) => {
    let buf = bufName === 'out' ? stdoutBuf : stderrBuf;
    buf += chunk.toString().replace(ANSI, '');
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      emit(stream, line);
    }
    if (bufName === 'out') {
      stdoutBuf = buf;
    } else {
      stderrBuf = buf;
    }
  };

  child.stdout.on('data', (c) => pump(c, 'out', 'log'));
  child.stderr.on('data', (c) => pump(c, 'err', 'log'));

  child.on('error', (e) => {
    emit('log', `[启动失败] ${e.message}`);
    emit('done', JSON.stringify({ code: -1 }));
    runs.delete(runId);
    res.end();
  });

  child.on('close', (code) => {
    if (stdoutBuf) {
      emit('log', stdoutBuf);
    }
    if (stderrBuf) {
      emit('log', stderrBuf);
    }
    emit('done', JSON.stringify({ code }));
    runs.delete(runId);
    res.end();
  });

  req.on('close', () => {
    if (runs.has(runId)) {
      child.kill('SIGTERM');
      runs.delete(runId);
    }
  });
}

// 在 e2e-real（管道基线）与 eval/generate（真实生成）产物目录里找最新一份 eval-report.html
function findLatestReport() {
  const bases = [
    path.join(ROOT, 'project', '.cache', 'e2e-real'),
    path.join(ROOT, 'project', '.cache', 'eval', 'generate'),
    path.join(ROOT, 'project', '.cache', 'eval'),
  ];
  let best = null;
  for (const base of bases) {
    try {
      for (const name of fs.readdirSync(base)) {
        const candidate = path.join(base, name, 'eval-report.html');
        if (fs.existsSync(candidate)) {
          const mtime = fs.statSync(candidate).mtimeMs;
          if (!best || mtime > best.mtime) {best = { path: candidate, mtime };}
        }
      }
    } catch {
      // ignore：目录不存在 = 还没跑过
    }
  }
  return best ? best.path : null;
}

function serveLatestReport(res) {
  const reportPath = findLatestReport();
  if (!reportPath) {
    return send(res, 404, 'text/html; charset=utf-8',
      '<meta charset="utf-8"><p style="font:16px sans-serif;padding:40px">还没有报告。请先跑一次「端到端 + 截图」。</p>');
  }
  return fs.readFile(reportPath, 'utf8', (err, html) => {
    if (err) {return send(res, 500, 'text/plain; charset=utf-8', '报告读取失败');}
    return send(res, 200, 'text/html; charset=utf-8', html);
  });
}

function stopRun(res, runId) {
  const child = runs.get(runId);
  if (child) {
    child.kill('SIGTERM');
    runs.delete(runId);
    return send(res, 200, 'application/json', JSON.stringify({ stopped: true }));
  }
  return send(res, 404, 'application/json', JSON.stringify({ stopped: false }));
}

// List all available eval reports (JSON + HTML)
function serveReportList(res) {
  const reports = [];
  const evalDir = path.join(ROOT, 'project', '.cache', 'eval');
  const scanDirs = [
    evalDir,
    path.join(evalDir, 'comprehensive'),
    path.join(evalDir, 'pipeline'),
    path.join(evalDir, 'generate'),
    path.join(ROOT, 'project', '.cache', 'e2e-real'),
  ];
  for (const base of scanDirs) {
    try {
      if (!fs.existsSync(base)) { continue; }
      const entries = fs.readdirSync(base);
      for (const name of entries) {
        const full = path.join(base, name);
        const stat = fs.statSync(full);
        if (stat.isFile() && (name.endsWith('.json') || name.endsWith('.html'))) {
          reports.push({
            name: name,
            path: full,
            type: name.endsWith('.html') ? 'html' : 'json',
            size: stat.size,
            mtime: stat.mtimeMs,
            dir: path.relative(ROOT, base),
          });
        } else if (stat.isDirectory()) {
          // Look for reports inside subdirectories
          try {
            for (const sub of fs.readdirSync(full)) {
              if (sub.endsWith('.json') || sub.endsWith('.html')) {
                const subFull = path.join(full, sub);
                const subStat = fs.statSync(subFull);
                reports.push({
                  name: name + '/' + sub,
                  path: subFull,
                  type: sub.endsWith('.html') ? 'html' : 'json',
                  size: subStat.size,
                  mtime: subStat.mtimeMs,
                  dir: path.relative(ROOT, full),
                });
              }
            }
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
  reports.sort(function (a, b) { return b.mtime - a.mtime; });
  // Limit to top 50
  const top = reports.slice(0, 50).map(function (r) {
    return { name: r.name, type: r.type, size: r.size, mtime: r.mtime, dir: r.dir, path: r.path };
  });
  send(res, 200, 'application/json; charset=utf-8', JSON.stringify(top));
}

// Serve report content by path (only files inside project/.cache/)
function serveReportContent(res, filePath) {
  if (!filePath) {
    return send(res, 400, 'text/plain; charset=utf-8', 'missing path parameter');
  }
  // Security: only allow paths inside project/.cache/
  const resolved = path.resolve(filePath);
  const allowed = path.join(ROOT, 'project', '.cache');
  if (!resolved.startsWith(allowed)) {
    return send(res, 403, 'text/plain; charset=utf-8', 'forbidden');
  }
  if (!fs.existsSync(resolved)) {
    return send(res, 404, 'text/plain; charset=utf-8', 'not found');
  }
  const ext = path.extname(resolved);
  const mimeType = ext === '.html' ? 'text/html; charset=utf-8'
    : ext === '.json' ? 'application/json; charset=utf-8'
      : ext === '.xml' ? 'application/xml; charset=utf-8'
        : ext === '.svg' ? 'image/svg+xml' : 'text/plain; charset=utf-8';
  fs.readFile(resolved, 'utf8', function (err, content) {
    if (err) { return send(res, 500, 'text/plain; charset=utf-8', 'read error'); }
    return send(res, 200, mimeType, content);
  });
}

// Serve latest pipeline result for a skill
function servePipelineLatest(res, skill) {
  const pipelineDir = path.join(ROOT, 'project', '.cache', 'eval', 'pipeline');
  if (!fs.existsSync(pipelineDir)) {
    return send(res, 404, 'application/json; charset=utf-8', JSON.stringify({ error: 'no pipeline results' }));
  }
  let best = null;
  try {
    for (const name of fs.readdirSync(pipelineDir)) {
      if (skill && !name.startsWith(skill + '-')) { continue; }
      const reportFile = path.join(pipelineDir, name, 'pipeline-report.json');
      if (fs.existsSync(reportFile)) {
        const mtime = fs.statSync(reportFile).mtimeMs;
        if (!best || mtime > best.mtime) { best = { path: reportFile, mtime: mtime }; }
      }
    }
  } catch { /* ignore */ }
  if (!best) {
    return send(res, 404, 'application/json; charset=utf-8', JSON.stringify({ error: 'no pipeline results for ' + (skill || 'any') }));
  }
  return fs.readFile(best.path, 'utf8', function (err, content) {
    if (err) { return send(res, 500, 'text/plain; charset=utf-8', 'read error'); }
    return send(res, 200, 'application/json; charset=utf-8', content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname === '/') {
    return serveIndex(res);
  }
  if (url.pathname === '/info') {
    return serveInfo(res);
  }
  if (url.pathname === '/prompts') {
    return servePrompts(res);
  }
  if (url.pathname === '/report') {
    return serveLatestReport(res);
  }
  if (url.pathname === '/run') {
    return runTask(req, res, url.searchParams.get('task'));
  }
  if (url.pathname === '/stop') {
    return stopRun(res, url.searchParams.get('id'));
  }
  if (url.pathname === '/api/reports') {
    return serveReportList(res);
  }
  if (url.pathname === '/api/report-content') {
    return serveReportContent(res, url.searchParams.get('path'));
  }
  if (url.pathname === '/api/pipeline-latest') {
    return servePipelineLatest(res, url.searchParams.get('skill'));
  }
  return send(res, 404, 'text/plain; charset=utf-8', 'Not Found');
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`\n  OpenYida Eval 控制台已启动:  http://${HOST}:${PORT}\n  Node ${process.version} · 按 Ctrl+C 退出\n`);
});
