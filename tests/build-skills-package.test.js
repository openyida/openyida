'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD_SCRIPT = path.join(ROOT, 'scripts', 'build-skills-package.js');

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
      expect(fs.existsSync(path.join(outDir, 'references', 'schema-as-code-phase1.md'))).toBe(true);
      expect(fs.readFileSync(path.join(outDir, 'SKILL.md'), 'utf8')).toContain(
        'references/schema-as-code-phase1.md'
      );
      expect(fs.readFileSync(
        path.join(outDir, 'references', 'subskills', 'yida-app', 'README.md'),
        'utf8'
      )).toContain('references/schema-as-code-phase1.md');

      const entryNames = listZipEntryNames(zipOut);
      expect(entryNames).toContain('openyida/SKILL.md');
      expect(entryNames).toContain('openyida/references/schema-as-code-phase1.md');
      expect(entryNames).not.toContain('openyida/skills-index.json');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
