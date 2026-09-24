'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKILL = path.join(ROOT, 'yida-skills/skills/yida-design');
const THEMES = path.join(SKILL, 'templates/design-themes');
const VALIDATOR = path.join(SKILL, 'scripts/validate_design_themes.py');
const PYTHON = [['python3', []], ['python', []], ['py', ['-3']]].find(([command, prefix]) => {
  const result = spawnSync(command, [...prefix, '--version'], { encoding: 'utf8' });
  const match = /Python (\d+)\.(\d+)/.exec((result.stdout || '') + (result.stderr || ''));
  return !result.error && result.status === 0 && match && Number(match[1]) === 3 && Number(match[2]) >= 9;
});

test('shipped themes inherit project color and declare the selected-item shadow contract', () => {
  const index = JSON.parse(fs.readFileSync(path.join(THEMES, 'index.json'), 'utf8'));
  for (const theme of index.themes) {
    const source = fs.readFileSync(path.join(SKILL, theme.templatePath), 'utf8');
    expect(source).not.toMatch(/(?:无品牌色|没有品牌色)[^。\n]*(?:默认[^。\n]*(?:蓝色|冷色|纯黑)|(?:蓝色|冷色|纯黑)[^。\n]*默认)/);
    expect(source).toContain('{{PRIMARY_COLOR}}');
    const shadow = /"--pod-nav-menu-item-selected-shadow":\s*"([^"]+)"/.exec(source);
    const css = fs.readFileSync(path.join(SKILL, theme.cssTemplatePath), 'utf8');
    expect(css).toContain(`--pod-nav-menu-item-selected-shadow: ${shadow ? shadow[1] : 'none'};`);
  }
});

test('native form divider secondary color follows content tone', () => {
  const index = JSON.parse(fs.readFileSync(path.join(THEMES, 'index.json'), 'utf8'));
  const sharedTemplate = fs.readFileSync(path.join(SKILL, 'references/theme/app-custom-theme-template.css'), 'utf8');
  expect(sharedTemplate).toContain('--yida-divider-secondary-color: var(--color-brand1-2);');
  for (const theme of index.themes) {
    const expected = theme.contentTone === 'dark' ? 'var(--color-line1-1)' : 'var(--color-brand1-2)';
    const design = fs.readFileSync(path.join(SKILL, theme.templatePath), 'utf8');
    const css = fs.readFileSync(path.join(SKILL, theme.cssTemplatePath), 'utf8');
    expect(design).toContain(`"--yida-divider-secondary-color": "${expected}"`);
    expect(css).toContain(`--yida-divider-secondary-color: ${expected};`);
  }
});

test('shared themes declare the platform weak icon color', () => {
  const index = JSON.parse(fs.readFileSync(path.join(THEMES, 'index.json'), 'utf8'));
  const sharedTemplate = fs.readFileSync(path.join(SKILL, 'references/theme/app-custom-theme-template.css'), 'utf8');
  expect(sharedTemplate).toContain('--color-fill1-6: var(--color-text1-3, #878f95);');
  for (const theme of index.themes) {
    const design = fs.readFileSync(path.join(SKILL, theme.templatePath), 'utf8');
    const css = fs.readFileSync(path.join(SKILL, theme.cssTemplatePath), 'utf8');
    expect(design).toContain('"--color-fill1-6": "var(--color-text1-3)"');
    expect(css).toContain('--color-fill1-6: var(--color-text1-3);');
  }
});

function validate(skill = SKILL, encoding = 'utf-8', windowsPaths = false) {
  if (!PYTHON) {
    throw new Error('Theme contract tests require Python 3.9+ (python3, python, or py -3).');
  }
  // Exercise Windows path serialization on every host while retaining real file reads.
  const windowsRunner = `
import runpy
import sys
from pathlib import Path, PureWindowsPath
from unittest.mock import patch

relative_to = Path.relative_to
sys.argv = sys.argv[1:]
with patch.object(Path, 'relative_to', lambda self, *args, **kwargs: PureWindowsPath(relative_to(self, *args, **kwargs))):
    runpy.run_path(sys.argv[0], run_name='__main__')
`;
  const runner = windowsPaths ? ['-c', windowsRunner] : [];
  return spawnSync(PYTHON[0], [...PYTHON[1], ...runner, VALIDATOR, '--skill-root', skill], {
    encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: encoding },
  });
}

function withFixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-theme-contract-'));
  try {
    const skill = path.join(dir, 'yida-design');
    const themes = path.join(skill, 'templates/design-themes');
    fs.mkdirSync(themes, { recursive: true });
    const index = JSON.parse(fs.readFileSync(path.join(THEMES, 'index.json'), 'utf8'));
    index.themes = index.themes.slice(0, 1);
    fs.copyFileSync(path.join(THEMES, 'basic-tokens.json'), path.join(themes, 'basic-tokens.json'));
    fs.mkdirSync(path.join(skill, 'references/theme'), { recursive: true });
    fs.copyFileSync(path.join(SKILL, 'references/theme/app-custom-theme-template.css'), path.join(skill, 'references/theme/app-custom-theme-template.css'));
    for (const relative of ['../yida-app/workflow/plan/step-2-confirm.md', 'sub_skill/yida-design-plan/references/visual-theme-selection.md', 'sub_skill/yida-design-plan/references/build-plan-schema.md']) {
      const file = path.resolve(skill, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '');
    }
    const original = fs.readFileSync(path.join(SKILL, index.themes[0].templatePath), 'utf8');
    const template = path.join(skill, index.themes[0].templatePath);
    fs.mkdirSync(path.dirname(template), { recursive: true });
    for (const field of ['cssTemplatePath', 'formLayoutPath']) {
      fs.copyFileSync(path.join(SKILL, index.themes[0][field]), path.join(skill, index.themes[0][field]));
    }
    const saveIndex = () => fs.writeFileSync(path.join(themes, 'index.json'), JSON.stringify(index));
    saveIndex();
    fs.writeFileSync(template, original);
    run({ skill, themes, index, template, original, saveIndex });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test.each([
  ['native', 'utf-8'], ['native', 'cp1252'],
  ['windows', 'utf-8'], ['windows', 'cp1252'],
])('all shared themes pass the V2 contract with %s paths and inherited %s encoding', (paths, encoding) => {
  const result = validate(SKILL, encoding, paths === 'windows');
  expect({ status: result.status, error: result.stderr, output: result.stdout.trim() }).toEqual({
    status: 0, error: '', output: '主题索引与完整 design.md 模板校验通过。',
  });
});

test.each([
  ['unknown reference', source => source + '\n组件消费 var(--oyd-obsolete-panel)。\n', '未声明变量'],
  ['fixed font size', source => source.replace('"--font-size-subhead": "18px"', '"--font-size-subhead": "24px"'), '--font-size-subhead 应使用固定值'],
  ['unquoted spacing', source => source.replace('"--s-5": 20px', '"--s-5": 22px'), '--s-5 应使用固定值'],
  ['numeric font weight', source => source.replace('"--font-weight-subhead": 500', '"--font-weight-subhead": 600'), '--font-weight-subhead 应使用固定值'],
  ['missing appearance token', source => source.replace(/^.*"--pod-page-bg-color":.*\n/m, ''), '全局变量集合'],
  ['missing nav theme', source => source.replace(/^navTheme:.*\n/m, ''), 'navTheme 必须是 light 或 dark'],
  ['invalid nav theme', source => source.replace(/^navTheme:.*$/m, 'navTheme: auto'), 'navTheme 必须是 light 或 dark'],
  ['cross-group cycle', source => source.replace('"--pod-page-bg-color": "#000000"', '"--pod-page-bg-color": "var(--oyd-inset-surface)"').replace('"--oyd-inset-surface": "#000000"', '"--oyd-inset-surface": "var(--pod-page-bg-color)"'), '变量循环引用'],
  ['unsupported brand slot', source => source.replace('  custom-page:\n', '  custom-page:\n    "--color-brand1-4": "#FFFFFF"\n'), '不支持的品牌色阶'],
  ['duplicate variable across scopes', source => source.replace('  custom-page:\n', '  custom-page:\n    "--color-white": "#FFFFFF"\n'), '页面层重复定义全局变量'],
  ['duplicate YAML property', source => source.replace('    shadow:\n', '    shadow:\n      "--shadow-1": "none"\n'), '重复定义 --shadow-1'],
  ['malformed token value', source => source.replace('"--s-5": 20px', '"--s-5": [20px, 22px]'), '仅支持映射和非空 CSS 标量'],
  ['renamed token', source => source.replace(/"--s-5":/g, '"--S-5":'), '无效 Token 声明'],
  ['token reference cycle', source => source.replace('"--oyd-inset-surface": "#000000"', '"--oyd-inset-surface": "var(--oyd-workspace-surface)"').replace('"--oyd-workspace-surface": "#141414"', '"--oyd-workspace-surface": "var(--oyd-inset-surface)"'), '变量循环引用'],
  ['primary seed', source => source.replace('"--color-brand1-6": "{{PRIMARY_COLOR}}"', '"--color-brand1-6": "#123456"'), '必须使用项目主色占位符'],
  ['brand derivative', source => source.replace(/("--color-brand1-1": )"[^"]+"/, '$1"#123456"'), '必须与 --color-brand1-6 同源'],
  ['page bridge', source => source.replace('"--oyd-page-bg": "var(--pod-page-bg-color)"', '"--oyd-page-bg": "#000000"'), '必须单向继承'],
  ['missing section', source => source.replace('## 4. 特色表达配方', '## 4. 其他'), 'V2 五个章节'],
  ['unknown placeholder', source => source + '\n{{UNKNOWN_VALUE}}\n', '未知'],
  ['missing placeholder', source => source.replace('{{PAGE_APPLICATIONS}}', ''), '缺少'],
  ['wildcard', source => source + '\n消费 `--shadow-*`。\n', '未展开的 Token'],
])('validator rejects %s', (_label, mutate, expected) => {
  withFixture(({ skill, template, original }) => {
    expect(validate(skill).status).toBe(0);
    const changed = mutate(original);
    expect(changed).not.toBe(original);
    fs.writeFileSync(template, changed);
    const result = validate(skill, 'cp1252');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(expected);
  });
});

test('templates accept extra global and project variables with shared references', () => {
  withFixture(({ skill, template, original }) => {
    const changed = original
      .replace('    shadow:\n', '    shadow:\n      "--project-floating-shadow": "0 6px 24px rgb(0 0 0 / 8%)"\n')
      .replace('  custom-page:\n', '  custom-page:\n    "--project-cover": "linear-gradient(135deg, #FFFFFF, #EFE7DA)"\n    "--project-motion": "180ms"\n')
      .replace('"--pod-page-bg-color": "#000000"', '"--pod-page-bg-color": "var(--oyd-inset-surface)"');
    fs.writeFileSync(template, changed);
    const result = validate(skill);
    expect({ status: result.status, errors: result.stderr, output: result.stdout }).toMatchObject({ status: 0, errors: '' });
  });
});

test.each([
  ['missing summary', index => { delete index.themes[0].styleSummary; }, 'styleSummary'],
  ['missing navigation summary', index => { delete index.themes[0].navigationSummary; }, 'navigationSummary'],
  ['missing theme modes in summary', index => { index.themes[0].styleSummary = index.themes[0].styleSummary.replace(/^[^。]+。/, ''); }, 'styleSummary 必须用自然语言说明深色或浅色导航，以及深色或浅色内容界面'],
  ['mismatched nav theme in summary', index => { index.themes[0].styleSummary = index.themes[0].styleSummary.replace('深色导航', '浅色导航'); }, 'styleSummary 的导航明暗与主题模板 navTheme 不一致'],
  ['missing content tone', index => { delete index.themes[0].contentTone; }, 'contentTone'],
  ['invalid navigation tone', index => { index.themes[0].navTheme = 'auto'; }, 'navTheme'],
  ['duplicate IDs', index => { index.themes.push({ ...index.themes[0] }); }, '重复 themeId'],
  ['unsafe theme ID', index => { index.themes[0].themeId = '../outside'; }, 'themeId 格式非法'],
  ['path traversal', index => { index.themes[0].templatePath = '../outside.md'; }, 'templatePath 必须指向公共主题目录'],
  ['absolute path', index => { index.themes[0].templatePath = path.join(THEMES, 'dark-inset-hairline.md'); }, 'templatePath 必须指向公共主题目录'],
  ['wrong schema version', index => { index.schemaVersion = '1.0'; }, 'schemaVersion'],
])('validator rejects catalog %s', (_label, mutate, expected) => {
  withFixture(({ skill, index, saveIndex }) => {
    mutate(index);
    saveIndex();
    const result = validate(skill);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(expected);
  });
});

test('validator requires every template to be indexed and every entry to exist', () => {
  withFixture(({ skill, themes, template, original }) => {
    fs.writeFileSync(path.join(themes, 'unlisted.md'), original);
    fs.unlinkSync(template);
    const result = validate(skill);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('主题模板未登记到索引');
    expect(result.stdout).toContain('索引引用了不存在的主题模板');
  });
});

test.each(['design.md', 'app_theme.css', 'form-layout.json'])('validator rejects a missing bundle file: %s', filename => {
  withFixture(({ skill, template }) => {
    fs.unlinkSync(path.join(path.dirname(template), filename));
    expect(validate(skill).status).toBe(1);
  });
});

test.each(['--color-brand1-1', '--color-brand1-6'])('validator rejects a fixed CSS template brand color: %s', name => {
  withFixture(({ skill, template }) => {
    const cssFile = path.join(path.dirname(template), 'app_theme.css');
    const css = fs.readFileSync(cssFile, 'utf8').replace(new RegExp(`(${name}: )[^;]+;`), '$1#123456;');
    fs.writeFileSync(cssFile, css);
    expect(validate(skill).stdout).toContain(`${name} 必须保留项目颜色占位`);
  });
});

test('check:skills reports missing Python instead of silently skipping the contract', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-no-python-'));
  try {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/validate-skills.js')], {
      encoding: 'utf8', env: { ...process.env, PATH: dir },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Shared design theme validation requires Python 3.9+');
    expect(result.stderr).toContain('Validation was not skipped.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('check:skills rejects a missing public CSS root closure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-invalid-theme-css-'));
  try {
    const preload = path.join(dir, 'broken-css.cjs');
    const cssFile = path.join(SKILL, 'references/theme/app-custom-theme-template.css');
    // Inject a damaged read in the subprocess; leave the real skill template untouched.
    fs.writeFileSync(preload, `
      const fs = require('fs');
      const original = fs.readFileSync;
      fs.readFileSync = function(file, ...args) {
        const content = original.call(this, file, ...args);
        return String(file) === ${JSON.stringify(cssFile)} ? content.replace(/^\\}/m, '') : content;
      };
    `);
    const result = spawnSync(process.execPath, ['--require', preload, path.join(ROOT, 'scripts/validate-skills.js')], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('app-custom-theme-template.css');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
