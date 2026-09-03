'use strict';

const fs = require('fs');
const path = require('path');
const {
  REQUIRED_BRAND_SCALE_TOKENS,
  validateThemeCssContent,
  normalizeThemeColor,
  normalizeCssColorToHex,
  extractThemeColor,
  unwrapUploadResponse,
  buildCustomThemeStyle,
} = require('../lib/app/custom-theme');

function buildBrandScale(overrides = {}) {
  return REQUIRED_BRAND_SCALE_TOKENS
    .map((token, index) => `    ${token}: ${overrides[token] || `rgb(${index + 1}, ${index + 2}, ${index + 3})`};`)
    .join('\n');
}

describe('custom app theme helpers', () => {
  test('accepts the modern theme template token patterns', () => {
    expect(() => validateThemeCssContent(`
      :root {
${buildBrandScale({ '--color-brand1-6': '#1677FF' })}
        --pod-shell-bg-color-light: var(--color-brand1-2, #F2F7FF);
      }
      .hero { background-image: url(https://cdn.example.com/theme.png); }
    `)).not.toThrow();
  });

  test('accepts the shipped coffee theme template and ignores commented font placeholders', () => {
    const templatePath = path.join(
      __dirname,
      '../yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'
    );
    const css = fs.readFileSync(templatePath, 'utf8');

    expect(() => validateThemeCssContent(css)).not.toThrow();
    expect(extractThemeColor(css)).toBe('rgba(155, 136, 121, 1)');
  });

  test('requires the complete platform --color-brand1 scale', () => {
    expect(() => validateThemeCssContent(`
      :root {
        ${buildBrandScale().replace('    --color-brand1-5: rgb(4, 5, 6);', '')}
      }
    `)).toThrow('缺少: --color-brand1-5');

    expect(() => validateThemeCssContent(`
      /* --color-brand1-5: #123456; */
      :root {
        ${buildBrandScale().replace('    --color-brand1-5: rgb(4, 5, 6);', '')}
      }
    `)).toThrow('缺少: --color-brand1-5');
  });

  test('extracts the app theme color from --color-brand1-6', () => {
    expect(extractThemeColor(`
      /* --color-brand1-6: #000000; */
      :root { --color-brand1-6: #8f66ff; }
    `)).toBe('#8F66FF');
    expect(extractThemeColor(':root { --color-brand1-6: rgb(12, 34, 56); }'))
      .toBe('rgb(12, 34, 56)');
    expect(normalizeThemeColor('hsl(220, 80%, 50%)')).toBe('hsl(220, 80%, 50%)');
  });

  test('requires --color-brand1-6 to be a literal supported color', () => {
    expect(() => extractThemeColor(':root { --color-brand1-5: #1677FF; }'))
      .toThrow('--color-brand1-6');
    expect(() => extractThemeColor(':root { --color-brand1-6: var(--brand); }'))
      .toThrow('可直接保存的颜色值');
    expect(() => normalizeThemeColor('rgb(300, 0, 0)')).toThrow('Unsupported theme color');
  });

  test('normalizes the custom brand color to the appIcon hex contract', () => {
    expect(normalizeCssColorToHex('#abc')).toBe('#AABBCC');
    expect(normalizeCssColorToHex('rgb(22, 119, 255)')).toBe('#1677FF');
    expect(normalizeCssColorToHex('rgba(0, 0, 0, 0.5)')).toBe('#808080');
    expect(normalizeCssColorToHex('hsl(0, 100%, 50%)')).toBe('#FF0000');
    expect(normalizeCssColorToHex('hsla(120, 100%, 25%, 50%)')).toBe('#80BF80');
  });

  test('rejects CSS constructs rejected by the custom theme endpoint', () => {
    expect(() => validateThemeCssContent(`
      /* @import "https://example.com/base.css"; .x { background: url(文字模板资源); } */
      :root { ${buildBrandScale()} }
    `)).not.toThrow();
    expect(() => validateThemeCssContent('@import "https://example.com/base.css";')).toThrow('@import');
    expect(() => validateThemeCssContent('.x { background: url(javascript:alert(1)); }')).toThrow('危险资源协议');
    expect(() => validateThemeCssContent('.x { background: url(//evil.example.com/theme.png); }')).toThrow('不安全');
    expect(() => validateThemeCssContent('.x { width: expression(alert(1)); }')).toThrow('expression');
  });

  test('normalizes wrapped upload results into the updateApp contract', () => {
    const response = {
      content: {
        success: true,
        content: {
          name: 'app-theme.css',
          url: '/download/app-theme.css',
          downloadUrl: 'https://cdn.example.com/app-theme.css',
        },
      },
    };
    expect(unwrapUploadResponse(response)).toMatchObject({ name: 'app-theme.css' });
    expect(JSON.parse(buildCustomThemeStyle(response))).toEqual({
      enabled: true,
      iframePropagation: false,
      cssUrl: 'https://cdn.example.com/app-theme.css',
      cssFileName: 'app-theme.css',
    });
  });
});
