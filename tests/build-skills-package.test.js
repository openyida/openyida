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
      expect(generatedRootSkill).toContain('环境准备与登录检测');
      expect(generatedRootSkill).not.toContain(LEGACY_COOKIE_ENV);
      expect(fs.readFileSync(
        path.join(outDir, 'references', 'subskills', 'yida-app', 'README.md'),
        'utf8'
      )).toContain('完整应用编排技能');
      const generatedDesignSkill = fs.readFileSync(
        path.join(outDir, 'references', 'subskills', 'yida-design', 'README.md'),
        'utf8'
      );
      expect(generatedDesignSkill).toContain('sub_skill/yida-design-fast/README.md');
      expect(generatedDesignSkill).toContain('sub_skill/yida-design-plan/README.md');
      expect(generatedDesignSkill).not.toContain('sub_skill/yida-design-fast/SKILL.md');
      expect(generatedDesignSkill).not.toContain('sub_skill/yida-design-plan/SKILL.md');
      expect(fs.existsSync(path.join(
        outDir,
        'references',
        'subskills',
        'yida-design',
        'sub_skill',
        'yida-design-fast',
        'README.md'
      ))).toBe(true);
      expect(fs.existsSync(path.join(
        outDir,
        'references',
        'subskills',
        'yida-design',
        'sub_skill',
        'yida-design-fast',
        'sub_skill',
        'page-design',
        'README.md'
      ))).toBe(true);
      expect(fs.existsSync(path.join(
        outDir,
        'references',
        'subskills',
        'yida-design',
        'sub_skill',
        'yida-design-plan',
        'README.md'
      ))).toBe(true);
      expect(fs.existsSync(path.join(
        outDir,
        'references',
        'subskills',
        'yida-design',
        'sub_skill',
        'yida-design-fast',
        'sub_skill',
        'page-design',
        'SKILL.md'
      ))).toBe(false);
      const generatedSetupGuide = fs.readFileSync(
        path.join(outDir, 'references', 'setup-and-env.md'),
        'utf8'
      );
      expect(generatedSetupGuide).toContain('Codex、yida-agent 等宿主都使用同一套 OpenYida auth snapshot 规则');
      expect(generatedSetupGuide).toContain('让 Codex、yida-agent 等宿主注入 `OPENYIDA_ACCESS_TOKEN` 或 `OPENYIDA_REFRESH_TOKEN`');
      expect(generatedSetupGuide).toContain('snapshot 已进入运行环境注入 token 模式后，不要再执行 `openyida login`');
      expect(generatedSetupGuide).not.toContain('Wukong');
      expect(generatedSetupGuide).not.toContain('悟空');
      expect(generatedSetupGuide).not.toContain('auth_mode=cookie');
      const generatedLoginSkill = fs.readFileSync(
        path.join(outDir, 'references', 'subskills', 'yida-login', 'README.md'),
        'utf8'
      );
      expect(generatedLoginSkill).toContain('OPENYIDA_ACCESS_TOKEN');
      expect(generatedLoginSkill).toContain('Codex、yida-agent 等宿主都使用同一套 OpenYida auth snapshot 规则');
      expect(generatedLoginSkill).toContain('不要再执行 `openyida login` 触发 OAuth');
      expect(generatedLoginSkill).toContain('不要查找本地 `.cache/cookies*.json`');
      expect(generatedLoginSkill).not.toContain('Wukong');
      expect(generatedLoginSkill).not.toContain('悟空');
      expect(generatedLoginSkill).not.toContain(LEGACY_COOKIE_ENV);
      expect(generatedLoginSkill).not.toContain('本地兼容缓存');
      expect(generatedLoginSkill).not.toContain('兼容缓存的 Cookie/CSRF');

      const entryNames = listZipEntryNames(zipOut);
      expect(entryNames).toContain('openyida/SKILL.md');
      expect(entryNames).toContain('openyida/references/setup-and-env.md');
      expect(entryNames).toContain('openyida/references/subskills/yida-login/README.md');
      expect(entryNames).toContain('openyida/references/subskills/yida-design/sub_skill/yida-design-fast/README.md');
      expect(entryNames).toContain('openyida/references/subskills/yida-design/sub_skill/yida-design-fast/sub_skill/page-design/README.md');
      expect(entryNames).toContain('openyida/references/subskills/yida-design/sub_skill/yida-design-plan/README.md');
      expect(entryNames).not.toContain('openyida/references/subskills/yida-design/sub_skill/yida-design-fast/sub_skill/page-design/SKILL.md');
      expect(entryNames).not.toContain('openyida/skills-index.json');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
