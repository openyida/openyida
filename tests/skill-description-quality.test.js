'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKILLS_ROOT = path.join(ROOT, 'yida-skills');
const SKILLS_DIR = path.join(SKILLS_ROOT, 'skills');
const MAX_DESCRIPTION_LENGTH = 140;
const UNCLEAR_WORDING = /胶水|赋能|闭环|中台|一体化|编排|链路|消费|承接|兜底|沉淀|事实源|派生产物|owner|能力边界/i;
const HOST_INTERNAL_WORDING = /本技能不读写 memory|不依赖跨会话的 memory|Resource-First|resource context|Final 证据契约|doneWhen|发布前 guard/i;

function collectSkillFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSkillFiles(fullPath);
    }
    return entry.name === 'SKILL.md' ? [fullPath] : [];
  });
}

function frontmatterDescription(content) {
  const match = content.match(/^---\r?\n[\s\S]*?^description:\s*([^\r\n]+)$/m);
  return match ? match[1].trim() : null;
}

describe('skill descriptions stay direct and concise', () => {
  const skillFiles = collectSkillFiles(SKILLS_DIR);
  const index = JSON.parse(fs.readFileSync(path.join(SKILLS_ROOT, 'skills-index.json'), 'utf8'));

  test('every route description matches its SKILL.md frontmatter', () => {
    for (const skill of index.skills) {
      const content = fs.readFileSync(path.join(SKILLS_ROOT, skill.path), 'utf8');
      expect(skill.description).toBe(frontmatterDescription(content));
    }
  });

  test('descriptions are short and avoid internal wording', () => {
    const descriptions = [
      ...index.skills.map((skill) => skill.description),
      ...index.route_groups.map((group) => group.description),
      ...skillFiles.map((file) => frontmatterDescription(fs.readFileSync(file, 'utf8'))),
    ];

    for (const description of descriptions) {
      expect(description).toBeTruthy();
      expect(description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
      expect(description).not.toMatch(UNCLEAR_WORDING);
    }
  });

  test('skill entry files stay focused and avoid host-internal prose', () => {
    for (const file of [path.join(SKILLS_ROOT, 'SKILL.md'), ...skillFiles]) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(UNCLEAR_WORDING);
      expect(content).not.toMatch(HOST_INTERNAL_WORDING);
    }
  });
});
