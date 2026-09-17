#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function extractReleaseNotes(changelog, tag) {
  const version = tag.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid release version: ${tag}`);
  }
  const headings = [...changelog.matchAll(/^## \[([^\]]+)\][^\r\n]*\r?$/gm)];
  const matches = headings.filter(heading => heading[1] === version);
  if (matches.length !== 1) {
    throw new Error(`CHANGELOG.md must contain exactly one entry for ${version}; found ${matches.length}`);
  }
  const heading = matches[0];
  const next = headings[headings.indexOf(heading) + 1];
  const section = changelog.slice(heading.index + heading[0].length, next?.index ?? changelog.length).trim();
  if (!/^[-*] \S.+/m.test(section)) {
    throw new Error(`CHANGELOG.md entry for ${version} has no release description`);
  }
  return `${section}\n\n## 安装 / 更新\n\n\`\`\`bash\nnpm install -g openyida@${version}\n\`\`\`\n`;
}

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..');
    const tag = process.argv[2] || require('../package.json').version;
    const notes = extractReleaseNotes(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), tag);
    if (process.argv[3]) {
      fs.writeFileSync(process.argv[3], notes);
    }
    console.log(`Release notes validated: ${tag}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { extractReleaseNotes };
