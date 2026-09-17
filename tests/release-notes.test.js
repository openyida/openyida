const { extractReleaseNotes } = require('../scripts/release-notes');
const fs = require('fs');
const path = require('path');

const changelog = `# Changelog

## [2026.9.16] - 2026-09-16

### 体验优化

- 页面风格更统一。

## [2026.9.15] - 2026-09-15

- 改善表单恢复。
`;

test('release body includes only the requested version and its exact install command', () => {
  const notes = extractReleaseNotes(changelog, 'v2026.9.16');
  expect(notes).toContain('页面风格更统一');
  expect(notes).not.toContain('改善表单恢复');
  expect(notes).toContain('npm install -g openyida@2026.9.16');
});

test('supports the last entry, CRLF and prerelease tags', () => {
  expect(extractReleaseNotes(changelog.replace(/\n/g, '\r\n'), '2026.9.15')).toContain('改善表单恢复');
  expect(extractReleaseNotes(changelog.replace('2026.9.16', '2026.9.16-beta.1'), 'v2026.9.16-beta.1'))
    .toContain('npm install -g openyida@2026.9.16-beta.1');
});

test('rejects missing, duplicate and empty entries', () => {
  expect(() => extractReleaseNotes(changelog, 'v2026.9.14')).toThrow('found 0');
  expect(() => extractReleaseNotes(changelog + changelog, 'v2026.9.16')).toThrow('found 2');
  expect(() => extractReleaseNotes('## [2026.9.16]\n\n### 优化\n', 'v2026.9.16')).toThrow('no release description');
});

test('rejects invalid versions before constructing the installation command', () => {
  expect(() => extractReleaseNotes(changelog, 'v2026.9.16;echo unsafe')).toThrow('Invalid release version');
});

test('current package version has release notes', () => {
  const current = fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8');
  expect(extractReleaseNotes(current, require('../package.json').version)).toContain('npm install -g openyida@');
});
