'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { materialize } = require('../lib/design-plan/materialize');
const { patchPlan } = require('../lib/design-plan/patch');
const { readDesignTokens } = require('../lib/app/theme-from-design');
const sample = require('../lib/core/sample');

const ROOT = path.join(__dirname, '..');
const guidance = fs.readFileSync(path.join(ROOT, 'yida-skills/skills/yida-design/references/application-theme-consistency.md'), 'utf8');
// Exercise the actual authoring example through both supported generation paths.
const editorialTokens = JSON.parse(guidance.match(/```json\n([\s\S]*?)\n```/)[1]);
const formGuidance = fs.readFileSync(path.join(ROOT,
  'yida-skills/skills/yida-design/references/native-form-styles.md'), 'utf8');
const formTokenExample = formGuidance.split('## 写入现有主题源\n')[1];
const formTokens = JSON.parse(formTokenExample.match(/```json\n([\s\S]*?)\n```/)[1]);
const DETAIL_FIELD_PREVIEW_TOKENS = [
  '--pod-field-preview-bg-color', '--pod-field-preview-border-radius',
  '--pod-field-preview-indicator-color', '--pod-field-preview-shadow',
  '--pod-field-preview-text-color', '--form-element-medium-font-size',
  '--pod-field-preview-gap', '--pod-field-preview-line-height',
  '--pod-field-preview-min-height', '--pod-field-preview-padding',
];

describe('shared application theme', () => {
  let directory;
  let input;
  let plan;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-editorial-theme-'));
    input = path.join(directory, 'build-plan.json');
    plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/design-plan.json'), 'utf8'));
    plan.visualStyle.forUser.selectedTheme = {
      themeId: 'warm-canvas-contrast-panels', source: 'user_selected',
      templatePath: 'templates/design-themes/warm-canvas-contrast-panels/design.md',
    };
    plan.visualStyle.forUser.colorStrategy = {
      source: 'user_selected', primaryColor: '#1B1B1B', primaryColorName: '编辑墨黑',
      usage: '奶油暖底 #F6F1E8 与橙红装饰 #C1451D', confidence: 'high',
    };
    plan.pages.customPageDetails[0].pageSpecHandoff = { designRefs: ['themeProfile'] };
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('prose about warm surfaces does not replace explicit token inputs', () => {
    fs.writeFileSync(input, JSON.stringify(plan));
    const result = materialize(input);
    const tokens = readDesignTokens(fs.readFileSync(result.outputs.design, 'utf8'));
    expect(tokens['--color-brand1-6']).toBe('#1B1B1B');
    expect(tokens['--pod-page-bg-color']).not.toBe('#F6F1E8');
    expect(tokens['--oyd-editorial-accent']).toBeUndefined();
    expect(fs.readFileSync(result.outputs.theme, 'utf8')).not.toContain('#C1451D');
  });

  test('Plan and Fast emit the same explicit surfaces, accent and typography', async () => {
    plan.visualStyle.tokens = editorialTokens;
    fs.writeFileSync(input, JSON.stringify(plan));
    const result = materialize(input);
    const tokens = readDesignTokens(fs.readFileSync(result.outputs.design, 'utf8'));
    expect(tokens).toMatchObject(editorialTokens);
    const fastOutput = path.join(directory, 'fast-theme.css');
    await sample.run(['yida-design', 'app-theme', '--design-file', result.outputs.design, '--output', fastOutput]);
    for (const file of [result.outputs.theme, fastOutput]) {
      const css = fs.readFileSync(file, 'utf8');
      for (const [name, value] of Object.entries(editorialTokens)) {
        expect(css).toContain(`${name}: ${value};`);
      }
      expect(css).toContain('--color-brand1-6: #1B1B1B;');
      expect(css).toContain('--pod-table-cell-color: var(--pod-card-bg-color);');
    }
  });

  test('editing source tokens refreshes design and CSS while preserving the brand color', () => {
    plan.visualStyle.tokens = editorialTokens;
    fs.writeFileSync(input, JSON.stringify(plan));
    const result = materialize(input);
    patchPlan(input, ['visualStyle.tokens.--magazine-surface-paper=#F3E9D8', 'visualStyle.tokens.--oyd-editorial-accent=#A63820'], { materialize: true });
    const tokens = readDesignTokens(fs.readFileSync(result.outputs.design, 'utf8'));
    const css = fs.readFileSync(result.outputs.theme, 'utf8');
    expect(tokens['--magazine-surface-paper']).toBe('#F3E9D8');
    expect(tokens['--pod-page-bg-color']).toBe('var(--magazine-surface-paper)');
    expect(tokens['--oyd-editorial-accent']).toBe('#A63820');
    expect(css).toContain('--magazine-surface-paper: #F3E9D8;');
    expect(css).toContain('--pod-page-bg-color: var(--magazine-surface-paper);');
    expect(css).toContain('--oyd-editorial-accent: #A63820;');
    expect(css).not.toContain('--oyd-editorial-accent: #C1451D;');
    expect(tokens['--color-brand1-6']).toBe('#1B1B1B');
  });

  test('detail read-only field guidance covers every consumed style token', () => {
    expect(formGuidance).toContain('## 详情页只读字段数据框');
    DETAIL_FIELD_PREVIEW_TOKENS.forEach(token => {
      expect(formGuidance).toContain(`\`${token}\``);
      expect(formTokens[token]).toBeDefined();
    });
  });

  test('native form controls and submission backgrounds survive Plan and Fast generation', async () => {
    plan.visualStyle.tokens = formTokens;
    fs.writeFileSync(input, JSON.stringify(plan));
    const result = materialize(input);
    expect(readDesignTokens(fs.readFileSync(result.outputs.design, 'utf8'))).toMatchObject(formTokens);
    const fastOutput = path.join(directory, 'fast-form-theme.css');
    await sample.run(['yida-design', 'app-theme', '--design-file', result.outputs.design, '--output', fastOutput]);
    for (const file of [result.outputs.theme, fastOutput]) {
      const css = fs.readFileSync(file, 'utf8');
      for (const [name, value] of Object.entries(formTokens)) {
        // Template declarations may put the value on the following line.
        const declaration = css.match(new RegExp(`${name}:\\s*([^;]+);`));
        expect(declaration?.[1].trim()).toBe(value);
        // A later duplicate declaration must not silently reset the form design.
        expect(css.split(`${name}:`)).toHaveLength(2);
      }
      expect(css).toContain('--color-brand1-6: #1B1B1B;');
    }
  });

  test('changing form density preserves background, brand, and unrelated custom styles', async () => {
    plan.visualStyle.tokens = formTokens;
    fs.writeFileSync(input, JSON.stringify(plan));
    const result = materialize(input);
    const fastOutput = path.join(directory, 'fast-form-theme.css');
    const generate = () => sample.run(['yida-design', 'app-theme', '--design-file', result.outputs.design, '--output', fastOutput]);
    await generate();
    const custom = '\n.local-form-note { padding: 7px; }\n';
    fs.appendFileSync(fastOutput, custom);
    patchPlan(input, ['visualStyle.tokens.--form-element-medium-height=44px',
      'visualStyle.tokens.--form-top-label-margin-b=8px'], { materialize: true });
    await generate();
    for (const file of [result.outputs.theme, fastOutput]) {
      const css = fs.readFileSync(file, 'utf8');
      expect(css).toContain('--form-element-medium-height: 44px;');
      expect(css).toContain('--form-top-label-margin-b: 8px;');
      expect(css).not.toContain('--form-element-medium-height: 40px;');
      expect(css).toContain(`--pod-app-root-bg-image: ${formTokens['--pod-app-root-bg-image']};`);
      expect(css).toContain('--input-bg-color: #FFFCF6;');
      expect(css).toContain('--color-brand1-6: #1B1B1B;');
    }
    expect(fs.readFileSync(fastOutput, 'utf8')).toContain(custom);
  });
});
