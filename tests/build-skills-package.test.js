'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD_SCRIPT = path.join(ROOT, 'scripts', 'build-skills-package.js');
const LEGACY_COOKIE_ENV = 'OPENYIDA_COOKIE_B64';

function findEndOfCentralDirectory(zipBuffer) {
  for (let offset = zipBuffer.length - 22; offset >= 0; offset--) {
    if (zipBuffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error('missing end of central directory');
}

function listZipEntryNames(zipFile) {
  const zipBuffer = fs.readFileSync(zipFile);
  const endOffset = findEndOfCentralDirectory(zipBuffer);
  const entryCount = zipBuffer.readUInt16LE(endOffset + 10);
  let offset = zipBuffer.readUInt32LE(endOffset + 16);
  const names = [];

  for (let index = 0; index < entryCount; index++) {
    if (zipBuffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('malformed central directory');
    }
    const nameLength = zipBuffer.readUInt16LE(offset + 28);
    const extraLength = zipBuffer.readUInt16LE(offset + 30);
    const commentLength = zipBuffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    names.push(zipBuffer.slice(nameStart, nameEnd).toString('utf8'));
    offset = nameEnd + extraLength + commentLength;
  }

  return names;
}

describe('build-skills-package', () => {
  test('keeps machine index in generated root but excludes it from Wukong zip', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-skills-build-'));
    const outDir = path.join(tempDir, 'openyida');
    const zipOut = path.join(tempDir, 'openyida-skills.zip');

    try {
      execFileSync(process.execPath, [BUILD_SCRIPT, '--out', outDir, '--zip-out', zipOut], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 20000,
      });

      expect(fs.existsSync(path.join(outDir, 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'skills-index.json'))).toBe(true);
      const generatedIndex = JSON.parse(fs.readFileSync(path.join(outDir, 'skills-index.json'), 'utf8'));
      const loginIndexEntry = generatedIndex.skills.find((skill) => skill.name === 'yida-login');
      expect(loginIndexEntry.path).toBe('references/subskills/yida-login/README.md');
      expect(fs.existsSync(path.join(outDir, loginIndexEntry.path))).toBe(true);
      expect(generatedIndex.skills.some((skill) => skill.path.startsWith('skills/'))).toBe(false);
      const generatedRootSkill = fs.readFileSync(path.join(outDir, 'SKILL.md'), 'utf8');
      expect(generatedRootSkill).toContain('OPENYIDA_ACCESS_TOKEN');
      expect(generatedRootSkill).toContain('禁止触发 OAuth');
      expect(generatedRootSkill).not.toContain(LEGACY_COOKIE_ENV);
      expect(fs.readFileSync(
        path.join(outDir, 'references', 'subskills', 'yida-app', 'README.md'),
        'utf8'
      )).toContain('fast_build');
      const generatedSetupGuide = fs.readFileSync(
        path.join(outDir, 'references', 'setup-and-env.md'),
        'utf8'
      );
      expect(generatedSetupGuide).toContain('host-injected token mode');
      expect(generatedSetupGuide).toContain('STOP and ask host to inject `OPENYIDA_ACCESS_TOKEN` or `OPENYIDA_REFRESH_TOKEN`');
      expect(generatedSetupGuide).toContain('Never run `openyida login` after the snapshot reports host-injected token mode');
      expect(generatedSetupGuide).not.toContain('auth_mode=cookie');
      const generatedLoginSkill = fs.readFileSync(
        path.join(outDir, 'references', 'subskills', 'yida-login', 'README.md'),
        'utf8'
      );
      expect(generatedLoginSkill).toContain('OPENYIDA_ACCESS_TOKEN');
      expect(generatedLoginSkill).toContain('不要再执行 `openyida login` 触发 OAuth');
      expect(generatedLoginSkill).toContain('不要查找本地 `.cache/cookies*.json`');
      expect(generatedLoginSkill).not.toContain(LEGACY_COOKIE_ENV);
      expect(generatedLoginSkill).not.toContain('本地兼容缓存');
      expect(generatedLoginSkill).not.toContain('兼容缓存的 Cookie/CSRF');

      const entryNames = listZipEntryNames(zipOut);
      expect(entryNames).toContain('openyida/SKILL.md');
      expect(entryNames).toContain('openyida/references/setup-and-env.md');
      expect(entryNames).toContain('openyida/references/subskills/yida-login/README.md');
      expect(entryNames).not.toContain('openyida/skills-index.json');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
