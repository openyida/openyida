'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RETIRED_ENDPOINT = 'query/formdesign/updateFormConfig.json';

function listJavaScriptFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listJavaScriptFiles(absolutePath);
    }
    return entry.isFile() && entry.name.endsWith('.js') ? [absolutePath] : [];
  });
}

describe('retired updateFormConfig endpoint', () => {
  test('has no production callers', () => {
    const offenders = listJavaScriptFiles(path.join(ROOT, 'lib'))
      .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes(RETIRED_ENDPOINT))
      .map((filePath) => path.relative(ROOT, filePath));

    expect(offenders).toEqual([]);
  });

  test('is absent from API guidance and the retired injection guide is removed', () => {
    const apiReference = fs.readFileSync(path.join(ROOT, 'yida-skills', 'references', 'yida-api.md'), 'utf8');
    const injectionGuidePath = path.join(
      ROOT,
      'yida-skills',
      'skills',
      'yida-form-detail',
      'references',
      'injection-guide.md'
    );

    expect(apiReference).not.toContain(RETIRED_ENDPOINT);
    expect(fs.existsSync(injectionGuidePath)).toBe(false);
  });

  test('keeps the independent form schema info configuration command', () => {
    const commandSource = fs.readFileSync(path.join(ROOT, 'lib', 'app', 'update-form-config.js'), 'utf8');

    expect(commandSource).toContain('updateFormSchemaInfo.json');
    expect(commandSource).not.toContain(RETIRED_ENDPOINT);
  });
});
