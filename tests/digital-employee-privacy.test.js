'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKILL = path.join(ROOT, 'yida-skills', 'skills', 'yida-digital-employee-approval');

/** Public instructions must remain independent of a pilot tenant or account. */
function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(file) : [file];
  });
}

const PRIVATE_CONTENT = [
  /\b(?:[a-z0-9-]+\.)+(?:alibaba-inc\.com|aliyun-inc\.com)\b/i,
  /(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)[^\s<>]+/i,
  /\bding[0-9a-f]{16,}\b/i,
  /\bAPP_[A-Z0-9]{12,}\b/,
  /\bFORM-[0-9A-F]{20,}\b/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /(?:access[_-]?token|refresh[_-]?token|appSecret|systemToken|Authorization|Cookie)["']?\s*[:=]\s*["'][^"'<>\s]{8,}["']/i,
];

describe('public digital employee skill privacy', () => {
  test.each(collectFiles(SKILL).map(file => [path.relative(SKILL, file), file]))(
    '%s contains instructions without tenant identifiers, credentials or private paths', (_name, file) => {
      expect(path.extname(file)).toBe('.md');
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of PRIVATE_CONTENT) {
        expect(content).not.toMatch(pattern);
      }
    }
  );
});
