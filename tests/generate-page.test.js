'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { escapeJsStringValue } = require('../lib/app/page-ir');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');

describe('generate-page command', () => {
  let tmpDir;
  let tmpHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-generate-page-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-generate-home-'));
    fs.writeFileSync(path.join(tmpDir, 'config.json'), '{}', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function cliEnv() {
    const env = {
      ...process.env,
      HOME: tmpHome,
      USERPROFILE: tmpHome,
      OPENYIDA_LANG: 'zh',
      CI: '1',
    };

    for (const key of Object.keys(env)) {
      if (key.startsWith('CODEX') || key === 'AGENT_WORK_ROOT') {
        delete env[key];
      }
    }

    return env;
  }

  test('escapes values inserted into JSX string literals', () => {
    const input = "Kuma's Lab\\AI\nNext";
    expect(escapeJsStringValue(input)).toBe("Kuma\\'s Lab\\\\AI\\nNext");
  });

  test('generates and compiles a curated product homepage from a spec file', () => {
    const specPath = path.join(tmpDir, 'openkuma-page.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'product-homepage',
      output: 'pages/src/openkuma-home.jsx',
      brandName: 'OpenKuma',
      brandInitials: 'OK',
      tagline: '开放项目首页工作台',
      heroText: '把品牌展示、社区入口和运营反馈放进同一个宜搭页面',
      primaryCta: '开始体验',
      secondaryCta: '查看能力',
      blocks: [
        {
          type: 'feature-grid',
          title: '核心模块',
          items: [
            { title: '服务目录', text: '把项目能力变成清晰入口。' },
            { title: '社区反馈', text: '把需求、建议和问题沉淀到表单。' },
            { title: '运营看板', text: '把访问、线索和处理进度放在首页。' },
          ],
        },
        {
          type: 'metric-strip',
          items: [
            { value: '12', label: '模板' },
            { value: '3', label: '流程' },
            { value: '1', label: '首页' },
          ],
        },
        {
          type: 'roadmap',
          title: '交付节奏',
          items: [
            { stage: '01', title: '首页上线', text: '先让用户能看懂项目。' },
            { stage: '02', title: '反馈闭环', text: '接入表单和自动化通知。' },
            { stage: '03', title: '数据沉淀', text: '形成运营报表。' },
          ],
        },
        {
          type: 'cta',
          title: '从模板开始',
          text: '先把首页跑通，再接入真实数据。',
        },
      ],
      compile: true,
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [BIN, 'generate-page', '--spec', specPath], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'openkuma-home.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'openkuma-home.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'openkuma-home.openyida-page.json');

    expect(fs.existsSync(sourcePath)).toBe(true);
    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);

    const source = fs.readFileSync(sourcePath, 'utf8');
    expect(source).toContain("brandName: 'OpenKuma'");
    expect(source).toContain('@openyida-template product-homepage');
    expect(source).toContain('@openyida-blocks hero,feature-grid,metric-strip,roadmap,cta');
    expect(source).toContain("featuresTitle: '核心模块'");
    expect(source).toContain('服务目录');
    expect(source).toContain('交付节奏');
    expect(source).not.toContain('{{BRAND_NAME}}');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.irVersion).toBe('1.0');
    expect(manifest.blocks.map((block) => block.type)).toEqual([
      'hero',
      'feature-grid',
      'metric-strip',
      'roadmap',
      'cta',
    ]);
    expect(manifest.blocks[1].items[0].title).toBe('服务目录');
    expect(fs.statSync(compiledPath).size).toBeGreaterThan(1000);
  });

  test('generates and compiles a TodoMVC interaction page from a spec file', () => {
    const specPath = path.join(tmpDir, 'todo-page.json');
    fs.writeFileSync(specPath, JSON.stringify({
      template: 'todo-mvc',
      output: 'pages/src/team-todos.oyd.jsx',
      title: '团队待办',
      subtitle: '验证事件、状态、循环渲染和本地持久化',
      placeholder: '输入任务并按 Enter',
      storageKey: 'openyida.team.todos',
      todos: [
        { content: '确认字段模型', done: false },
        { content: '发布到宜搭测试应用', done: true },
      ],
      compile: true,
    }, null, 2), 'utf8');

    execFileSync(process.execPath, [BIN, 'generate-page', '--spec', specPath], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    const sourcePath = path.join(tmpDir, 'pages', 'src', 'team-todos.oyd.jsx');
    const buildPath = path.join(tmpDir, 'pages', 'build', 'team-todos.yida.jsx');
    const compiledPath = path.join(tmpDir, 'pages', 'dist', 'team-todos.yida.js');
    const manifestPath = path.join(tmpDir, 'pages', 'src', 'team-todos.oyd.openyida-page.json');

    expect(fs.existsSync(sourcePath)).toBe(true);
    expect(fs.existsSync(buildPath)).toBe(true);
    expect(fs.existsSync(compiledPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);

    const source = fs.readFileSync(sourcePath, 'utf8');
    expect(source).toContain('@openyida-template todo-mvc');
    expect(source).toContain("title: '团队待办'");
    expect(source).toContain('确认字段模型');
    expect(source).toContain('window.localStorage.setItem');
    expect(source).not.toContain('{{TODO_TITLE}}');

    const built = fs.readFileSync(buildPath, 'utf8');
    expect(built).toContain('export function renderJsx()');
    expect(built).toContain('this.state && this.state.timestamp');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.blocks.map((block) => block.type)).toEqual([
      'todo-shell',
      'todo-list',
      'todo-actions',
      'persistence',
    ]);
    expect(manifest.blocks[1].items).toHaveLength(2);
    expect(manifest.blocks[3].storageKey).toBe('openyida.team.todos');
    expect(fs.statSync(compiledPath).size).toBeGreaterThan(1000);
  });
});
