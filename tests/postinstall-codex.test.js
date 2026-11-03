'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { version } = require('../package.json');

const ROOT = path.join(__dirname, '..');
let tempHome;

beforeEach(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-postinstall-'));
  fs.mkdirSync(path.join(tempHome, '.codex'));
});

afterEach(() => {
  fs.rmSync(tempHome, { recursive: true, force: true });
});

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pluginRoot() {
  return path.join(tempHome, '.openyida', 'codex-plugin', 'plugins', 'openyida');
}

function cacheRoot(name) {
  return path.join(tempHome, '.codex', 'plugins', 'cache', 'openyida', 'openyida', name);
}

function install() {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'postinstall.js')], {
    cwd: tempHome,
    // Keep all writes in the fixture and never invoke the real Codex CLI.
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      HOME: tempHome,
      USERPROFILE: tempHome,
      OPENYIDA_CODEX_BIN: path.join(tempHome, 'no-codex-cli'),
      CI: '1',
    },
    encoding: 'utf8',
    timeout: 30000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
}

function expectSkillsPlugin() {
  const root = pluginRoot();
  expect(readJson(path.join(root, '.codex-plugin', 'plugin.json'))).toMatchObject({
    name: 'openyida',
    version,
    skills: './skills/',
  });
  expect(readJson(path.join(root, '.codex-plugin', 'plugin.json'))).not.toHaveProperty('mcpServers');
  expect(fs.existsSync(path.join(root, '.mcp.json'))).toBe(false);
  expect(fs.readFileSync(path.join(root, 'skills', 'yida-db-seq-fix', 'SKILL.md'), 'utf8'))
    .toBe(fs.readFileSync(path.join(ROOT, 'yida-skills', 'skills', 'yida-db-seq-fix', 'SKILL.md'), 'utf8'));
  expect(fs.existsSync(path.join(root, 'skills', 'openyida', 'SKILL.md'))).toBe(true);
  expect(fs.existsSync(path.join(root, 'assets', 'logo.svg'))).toBe(true);
  expect(fs.readFileSync(path.join(tempHome, '.codex', 'config.toml'), 'utf8'))
    .toContain('[plugins."openyida@openyida"]');
}

function seedLegacyPlugin(root, extraServers = {}) {
  const manifest = { name: 'openyida', version: 'old-version', skills: './skills/', mcpServers: './.mcp.json' };
  writeJson(path.join(root, '.codex-plugin', 'plugin.json'), manifest);
  writeJson(path.join(root, '.mcp.json'), {
    mcpServers: {
      openyida: { command: process.execPath, args: [path.join(ROOT, 'bin', 'yida.js'), 'mcp'], cwd: '.' },
      ...extraServers,
    },
  });
  return manifest;
}

test('fresh install creates a skills plugin without an MCP server', () => {
  install();
  expectSkillsPlugin();
});

test('upgrade removes legacy MCP registrations from owned plugin caches and preserves other servers', () => {
  seedLegacyPlugin(pluginRoot());
  const oldCache = cacheRoot('legacy');
  const mixedCache = cacheRoot('mixed');
  const missingConfigCache = cacheRoot('missing-config');
  const unrelatedCache = cacheRoot('unrelated');
  const otherServer = { command: 'other-tool', args: ['serve'] };
  const oldManifest = seedLegacyPlugin(oldCache);
  const mixedManifest = seedLegacyPlugin(mixedCache, { other: otherServer });
  seedLegacyPlugin(missingConfigCache);
  fs.unlinkSync(path.join(missingConfigCache, '.mcp.json'));
  seedLegacyPlugin(unrelatedCache);
  const customConfig = { mcpServers: { openyida: otherServer } };
  writeJson(path.join(unrelatedCache, '.mcp.json'), customConfig);
  const skillsManifest = { ...oldManifest };
  delete skillsManifest.mcpServers;
  const toolNames = ['.claude', '.codex', '.qwenworkcn', '.qoderwork'];
  const oldSkillRoots = [
    path.join(pluginRoot(), 'skills'),
    path.join(oldCache, 'skills'),
    ...toolNames.map(tool => path.join(tempHome, tool, 'skills', 'yida-skills', 'skills')),
  ];
  for (const skillsRoot of oldSkillRoots) {
    const staleSkill = path.join(skillsRoot, 'yida-db-seq-fix', 'SKILL.md');
    fs.mkdirSync(path.dirname(staleSkill), { recursive: true });
    fs.writeFileSync(staleSkill, 'old database repair skill');
  }
  const userSkill = path.join(tempHome, '.codex', 'skills', 'user-skill', 'SKILL.md');
  fs.mkdirSync(path.dirname(userSkill), { recursive: true });
  fs.writeFileSync(userSkill, 'user-owned skill');
  const configPath = path.join(tempHome, '.codex', 'config.toml');
  const userConfig = '[mcp_servers.user_owned]\ncommand = "user-tool"\n';
  fs.writeFileSync(configPath, userConfig);

  install();

  expectSkillsPlugin();
  expect(readJson(path.join(oldCache, '.codex-plugin', 'plugin.json'))).toEqual(skillsManifest);
  expect(fs.existsSync(path.join(oldCache, '.mcp.json'))).toBe(false);
  expect(fs.existsSync(path.join(oldCache, 'skills', 'openyida', 'SKILL.md'))).toBe(true);
  expect(readJson(path.join(mixedCache, '.codex-plugin', 'plugin.json'))).toEqual(mixedManifest);
  expect(readJson(path.join(mixedCache, '.mcp.json'))).toEqual({ mcpServers: { other: otherServer } });
  expect(readJson(path.join(missingConfigCache, '.codex-plugin', 'plugin.json'))).toEqual(skillsManifest);
  expect(readJson(path.join(unrelatedCache, '.mcp.json'))).toEqual(customConfig);
  for (const skillsRoot of oldSkillRoots) {
    expect(fs.readFileSync(path.join(skillsRoot, 'yida-db-seq-fix', 'SKILL.md'), 'utf8'))
      .toBe(fs.readFileSync(path.join(ROOT, 'yida-skills', 'skills', 'yida-db-seq-fix', 'SKILL.md'), 'utf8'));
    expect(fs.existsSync(path.join(skillsRoot, 'yida-app', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(skillsRoot, 'yida-cool-card', 'SKILL.md'))).toBe(true);
  }
  expect(fs.readFileSync(userSkill, 'utf8')).toBe('user-owned skill');
  expect(fs.readFileSync(configPath, 'utf8')).toContain(userConfig);

  install();
  expectSkillsPlugin();
  expect(readJson(path.join(oldCache, '.codex-plugin', 'plugin.json'))).toEqual(skillsManifest);
  expect(readJson(path.join(mixedCache, '.mcp.json'))).toEqual({ mcpServers: { other: otherServer } });
  expect(fs.readFileSync(userSkill, 'utf8')).toBe('user-owned skill');
  expect(fs.readFileSync(configPath, 'utf8').split('[plugins."openyida@openyida"]').length).toBe(2);
});
