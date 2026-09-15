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
  uploadCustomThemeFile,
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

  test('accepts the shipped coffee theme template without URL placeholders', () => {
    const templatePath = path.join(
      __dirname,
      '../yida-skills/skills/yida-design/references/theme/app-custom-theme-template.css'
    );
    const css = fs.readFileSync(templatePath, 'utf8');

    expect(() => validateThemeCssContent(css)).not.toThrow();
    expect(extractThemeColor(css)).toBe('rgba(155, 136, 121, 1)');
    expect(css).not.toContain('文字模板资源');
    expect(css).not.toMatch(/url\s*\(/i);
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

describe('custom theme authenticated multipart upload', () => {
  const originalEnv = process.env;
  let fetchImpl;
  const authRef = { baseUrl: 'https://platform.example.test', projectRoot: '/synthetic/project' };
  const grant = 'task_' + 'g'.repeat(48);
  function managedEnv() {
    return {
      ...process.env, OPENYIDA_MANAGED_RUN: '1',
      OPENYIDA_AGENT_APP_TYPE: 'APP_BOUND', OPENYIDA_AGENT_CORP_ID: 'corp-test',
      OPENYIDA_AGENT_USER_ID: 'user-test', OPENYIDA_AGENT_RUN_ID: 'run-test',
      OPENYIDA_AGENT_ATTEMPT_ID: 'attempt-test', OPENYIDA_AGENT_BASE_URL: authRef.baseUrl,
      OPENYIDA_AGENT_TASK_GRANT: grant,
    };
  }
  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of Object.keys(process.env)) {
      if (key === 'OPENYIDA_MANAGED_RUN' || key.startsWith('OPENYIDA_AGENT_')) {delete process.env[key];}
    }
    const content = Buffer.from(`:root { ${buildBrandScale()} }`);
    jest.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true, size: content.length });
    jest.spyOn(fs, 'readFileSync').mockReturnValue(content);
    fetchImpl = jest.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ success: true }) });
  });
  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });
  test('managed upload uses only the Task Grant and run identity', async () => {
    process.env = managedEnv();
    const ordinaryToken = jest.spyOn(require('../lib/auth/token-auth'), 'getAccessToken').mockRejectedValue(new Error('must not read ordinary auth'));
    await uploadCustomThemeFile('APP_BOUND', './theme.css', authRef, { fetchImpl });
    expect(ordinaryToken).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
      redirect: 'error',
      headers: expect.objectContaining({
        Authorization: `Bearer ${grant}`,
        'X-OpenYida-Local-Run-Id': 'run-test',
        'X-OpenYida-Local-Attempt-Id': 'attempt-test',
        'X-OpenYida-Local-App-Type': 'APP_BOUND',
      }),
    }));
    expect(fetchImpl.mock.calls[0][0].href).toBe(`${authRef.baseUrl}/query/app/customTheme/upload.json`);
  });
  test('ordinary upload retains normal getAccessToken authentication', async () => {
    const ordinaryToken = jest.spyOn(require('../lib/auth/token-auth'), 'getAccessToken').mockResolvedValue('synthetic-ordinary-token');
    await uploadCustomThemeFile('APP_ORDINARY', './theme.css', authRef, { fetchImpl });
    expect(ordinaryToken).toHaveBeenCalledWith({ projectRoot: authRef.projectRoot });
    const request = fetchImpl.mock.calls[0][1];
    expect(request.headers.Authorization).toBe('Bearer synthetic-ordinary-token');
    expect(request.headers['X-OpenYida-Local-Run-Id']).toBeUndefined();
    expect(request.redirect).toBe('error');
  });
  test.each([
    ['APP_OTHER', authRef, 'MANAGED_APP_MISMATCH'],
    ['APP_BOUND', { ...authRef, baseUrl: 'https://other.example.test' }, 'MANAGED_OVERRIDE_FORBIDDEN'],
  ])('managed upload refuses changed app or target before sending', async (appType, ref, code) => {
    process.env = managedEnv();
    await expect(uploadCustomThemeFile(appType, './theme.css', ref, { fetchImpl })).rejects.toMatchObject({ code });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fs.statSync).not.toHaveBeenCalled();
  });
  test('an expired Task Grant reports auth failure without ordinary auth fallback', async () => {
    process.env = managedEnv();
    const ordinaryToken = jest.spyOn(require('../lib/auth/token-auth'), 'getAccessToken').mockRejectedValue(new Error('must not read ordinary auth'));
    fetchImpl.mockResolvedValue({ status: 401 });
    await expect(uploadCustomThemeFile('APP_BOUND', './theme.css', authRef, { fetchImpl })).resolves.toEqual({ __needLogin: true, __httpStatus: 401 });
    expect(ordinaryToken).not.toHaveBeenCalled();
  });
});
