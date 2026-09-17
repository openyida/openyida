'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SKILL = path.resolve(__dirname, '../yida-skills/skills/yida-design/sub_skill/yida-design-plan');
const THEMES = path.join(SKILL, 'templates/design-themes');

test('shipped themes inherit project color instead of prescribing a hue when branding is absent', () => {
  const index = JSON.parse(fs.readFileSync(path.join(THEMES, 'index.json'), 'utf8'));
  for (const theme of index.themes) {
    const source = fs.readFileSync(path.join(SKILL, theme.templatePath), 'utf8');
    expect(source).not.toMatch(/(?:无品牌色|没有品牌色)[^。\n]*(?:默认[^。\n]*(?:蓝色|冷色|纯黑)|(?:蓝色|冷色|纯黑)[^。\n]*默认)/);
    expect(source).toContain('{{PRIMARY_COLOR}}');
  }
});

test.each(['utf-8', 'cp1252'])('all shipped themes pass the full template contract with inherited %s encoding', encoding => {
  const result = spawnSync('python3', [path.join(SKILL, 'scripts/validate_design_themes.py')], {
    encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: encoding },
  });
  expect({ status: result.status, error: result.stderr, failures: result.stdout.includes('校验失败') }).toEqual({
    status: 0, error: '', failures: false,
  });
  expect(result.stdout).toContain('主题索引与完整 design.md 模板校验通过。');
});

test('theme validator checks base-token references and fixed typography and spacing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-theme-contract-'));
  try {
    const skill = path.join(dir, 'yida-design/sub_skill/yida-design-plan');
    const themes = path.join(skill, 'templates/design-themes');
    fs.mkdirSync(themes, { recursive: true });
    const index = JSON.parse(fs.readFileSync(path.join(THEMES, 'index.json'), 'utf8'));
    index.themes = index.themes.slice(0, 1);
    fs.writeFileSync(path.join(themes, 'index.json'), JSON.stringify(index));
    fs.copyFileSync(path.join(THEMES, 'basic-tokens.json'), path.join(themes, 'basic-tokens.json'));
    for (const relative of ['../../../yida-app/workflow/plan/step-2-confirm.md', 'references/visual-theme-selection.md', 'references/build-plan-schema.md']) {
      const file = path.resolve(skill, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '');
    }
    const relative = index.themes[0].templatePath;
    const original = fs.readFileSync(path.join(SKILL, relative), 'utf8');
    const validate = content => {
      fs.writeFileSync(path.join(skill, relative), content);
      return spawnSync('python3', [path.join(SKILL, 'scripts/validate_design_themes.py'), '--skill-root', skill], {
        encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'cp1252' },
      });
    };
    expect(validate(original).status).toBe(0);
    const alias = validate(original + '\n组件消费 var(--oyd-obsolete-panel)。\n');
    expect(alias.status).toBe(1);
    expect(alias.stdout).toContain('--oyd-obsolete-panel');
    const font = validate(original.replace('"--font-size-subhead": "18px"', '"--font-size-subhead": "24px"'));
    expect(font.status).toBe(1);
    expect(font.stdout).toContain('--font-size-subhead');
    const spacing = validate(original.replace('"--s-5": "20px"', '"--s-5": "22px"'));
    expect(spacing.status).toBe(1);
    expect(spacing.stdout).toContain('--s-5');
    const recipe = validate(original + '\n重点数字消费 `metric-primary`。\n');
    expect(recipe.status).toBe(1);
    expect(recipe.stdout).toContain('已移除的字体语义');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
