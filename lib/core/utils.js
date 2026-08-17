/**
 * utils.js - 宜搭 CLI 公共工具函数
 *
 * 导出函数：
 *   findProjectRoot()         - 查找项目根目录（兼容悟空环境）
 *   loadCookieData()          - 已废弃：默认登录态不再读取 Cookie 缓存
 *   getAuthStatus()           - 读取当前鉴权模式的安全状态摘要
 *   triggerLogin()            - 触发登录
 *   resolveBaseUrl()          - 从 authData 中解析 base_url
 *   isLoginExpired()          - 检测响应体是否表示登录过期
 *   isCsrfTokenExpired()      - 检测响应体是否表示 csrf_token 过期
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { t } = require('./i18n');
const { warn } = require('./chalk');

// ── 项目根目录查找 ────────────────────────────────────

const AGENT_BROWSER_TOOLS = new Set(['codex', 'qwenwork', 'qoderwork', 'qoder', 'wukong']);

function isTruthyEnvValue(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function normalizeSignal(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePathSignal(value) {
  return normalizeSignal(value).replace(/\\/g, '/');
}

function includesAnySignal(value, signals) {
  const normalized = normalizeSignal(value);
  return signals.some(signal => normalized.includes(signal));
}

function includesAnyPathSignal(value, signals) {
  const normalized = normalizePathSignal(value);
  return signals.some(signal => normalized.includes(signal));
}

function resolveEnvWorkspaceRoot(rawPath, source) {
  if (!rawPath) {
    return null;
  }

  const candidates = [
    rawPath,
    path.join(rawPath, 'project'),
    path.join(rawPath, 'workspace'),
    path.join(rawPath, 'workspace', 'project'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'config.json'))) {
      return { workspaceRoot: candidate, workspaceRootSource: source };
    }
  }

  return { workspaceRoot: rawPath, workspaceRootSource: source };
}

function defaultWorkspaceRoot(cwd) {
  return {
    workspaceRoot: path.join(cwd, 'project'),
    workspaceRootSource: 'cwd_project',
  };
}

function firstWorkspaceRoot(candidates, fallback) {
  for (const candidate of candidates) {
    const resolved = resolveEnvWorkspaceRoot(candidate.path, candidate.source);
    if (resolved) {
      return resolved;
    }
  }
  return fallback;
}

function hasQwenWorkWebSignal(env) {
  return !!(
    isTruthyEnvValue(env.QWENWORK) ||
    includesAnySignal(env.AGENT_PLATFORM, ['qwenwork']) ||
    env.QWENWORK_CLIENT ||
    env.QWENWORK_WORKSPACE_DIR ||
    env.QWENWORK_SANDBOX_ID ||
    env.QWENWORK_PREVIEW_URL ||
    env.QWENWORK_VNC_URL
  );
}

function hasQwenWorkDesktopSignal(env) {
  const bundleId = env.__CFBundleIdentifier;
  const product = env.QODER_WORK_INTEGRATION_PRODUCT;
  const qoderConfigDir = `${env.QODERCN_CONFIG_DIR || ''} ${env.QODER_CONFIG_DIR || ''}`;
  const qoderWorkerCwd = env.QODER_WORKER_CWD;
  return !!(
    env.QWENWORK_INTEGRATION_MODE ||
    env.QWENWORKCN_INTEGRATION_MODE ||
    includesAnySignal(product, ['qwenwork', 'qwen-work', 'qwenworkcn']) ||
    includesAnySignal(bundleId, ['qwenwork', 'qwen-work']) ||
    includesAnyPathSignal(qoderConfigDir, ['.qwenworkcn']) ||
    includesAnyPathSignal(qoderWorkerCwd, ['.qwenworkcn/workspace', '/.qwenworkcn/'])
  );
}

function buildRuntimeTool(info, options) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const runtime = info.runtime || (hasDesktopEnvironment(env, platform) ? 'desktop_shell' : 'agent_cli');
  const desktopShell = info.desktopShell !== undefined
    ? !!info.desktopShell
    : runtime === 'desktop_shell';
  const agentBrowser = info.agentBrowser !== undefined
    ? !!info.agentBrowser
    : AGENT_BROWSER_TOOLS.has(info.tool);

  return {
    tool: info.tool,
    displayName: info.displayName,
    dirName: info.dirName,
    workspaceRoot: info.workspaceRoot,
    workspaceRootSource: info.workspaceRootSource,
    runtime,
    subtype: info.subtype || info.tool,
    capabilities: {
      desktop_shell: desktopShell,
      agent_browser: agentBrowser,
      browser_auto_open: desktopShell,
      playwright_required: false,
    },
  };
}

function detectRuntimeCapabilities(options = {}) {
  const env = options.env || process.env;
  const cwd = options.cwd || process.cwd();
  const home = options.home || os.homedir();
  const platform = options.platform || process.platform;
  const fallbackWorkspace = defaultWorkspaceRoot(cwd);

  // QwenWork web is upgraded from MuleRun and may still carry MULE_*.
  // Its QWENWORK_* signals must win over MuleRun/Qoder compatibility vars.
  if (hasQwenWorkWebSignal(env)) {
    const workspace = firstWorkspaceRoot([
      { path: env.QWENWORK_WORKSPACE_DIR, source: 'QWENWORK_WORKSPACE_DIR' },
      { path: env.MULE_WORKSPACE_DIR, source: 'MULE_WORKSPACE_DIR' },
    ], fallbackWorkspace);
    return buildRuntimeTool({
      tool: 'qwenwork',
      displayName: 'QwenWork（千问办公）',
      dirName: '.qwenworkcn',
      workspaceRoot: workspace.workspaceRoot,
      workspaceRootSource: workspace.workspaceRootSource,
      runtime: 'web_sandbox',
      subtype: 'qwenwork_web',
      desktopShell: false,
      agentBrowser: true,
    }, { env, platform });
  }

  // QwenWork desktop inherits several QODER_* variables from the QoderWork
  // upgrade path, so qwenwork/qwenworkcn product markers are stronger than
  // generic Qoder or QoderWork detection.
  if (hasQwenWorkDesktopSignal(env)) {
    const workspace = firstWorkspaceRoot([
      { path: env.QODER_WORKER_CWD, source: 'QODER_WORKER_CWD' },
      { path: env.QWENWORK_WORKSPACE_DIR, source: 'QWENWORK_WORKSPACE_DIR' },
    ], fallbackWorkspace);
    return buildRuntimeTool({
      tool: 'qwenwork',
      displayName: 'QwenWork（千问办公）',
      dirName: '.qwenworkcn',
      workspaceRoot: workspace.workspaceRoot,
      workspaceRootSource: workspace.workspaceRootSource,
      runtime: 'desktop_shell',
      subtype: 'qwenwork_desktop',
      desktopShell: true,
      agentBrowser: true,
    }, { env, platform });
  }

  // QoderWork (桌面客户端，__CFBundleIdentifier=com.qoder.work 或 QODERCLI_INTEGRATION_MODE=qoder_work)
  // 必须在 Claude Code 之前检测，因为 QoderWork 内部设置了 CLAUDE_CODE_ENTRYPOINT 会干扰后续判断
  if (
    env.QODERCLI_INTEGRATION_MODE === 'qoder_work' ||
    (env.__CFBundleIdentifier || '').toLowerCase().includes('qoder')
  ) {
    return buildRuntimeTool({
      tool: 'qoderwork',
      displayName: 'QoderWork',
      dirName: '.qoderwork',
      workspaceRoot: fallbackWorkspace.workspaceRoot,
      workspaceRootSource: fallbackWorkspace.workspaceRootSource,
      runtime: 'desktop_shell',
      subtype: 'qoderwork_desktop',
      desktopShell: true,
    }, { env, platform });
  }

  // Qoder IDE / Qoder Agent（CLI 集成模式）
  if (env.QODER_IDE || env.QODER_AGENT) {
    return buildRuntimeTool({
      tool: 'qoder',
      displayName: 'Qoder',
      dirName: '.qoder',
      workspaceRoot: fallbackWorkspace.workspaceRoot,
      workspaceRootSource: fallbackWorkspace.workspaceRootSource,
      subtype: 'qoder',
    }, { env, platform });
  }

  // 悟空（Wukong）
  // Windows 路径可能使用反斜杠，需同时兼容正斜杠和反斜杠。
  // AGENT_WORK_ROOT 是悟空最明确的运行时信号，优先级高于可能继承到的
  // 外层 IDE/agent 环境变量。
  if (env.AGENT_WORK_ROOT && (env.AGENT_WORK_ROOT.includes('.real') || env.AGENT_WORK_ROOT.includes(path.join('.real')))) {
    return buildRuntimeTool({
      tool: 'wukong',
      displayName: '悟空（Wukong）',
      dirName: '.real',
      workspaceRoot: resolveWukongWorkspaceRoot(env.AGENT_WORK_ROOT),
      workspaceRootSource: 'AGENT_WORK_ROOT',
      subtype: 'wukong',
    }, { env, platform });
  }

  // OpenAI Codex
  if (
    env.CODEX_SHELL ||
    env.CODEX_CI ||
    env.CODEX_THREAD_ID ||
    env.CODEX_HOME ||
    (env.__CFBundleIdentifier || '').toLowerCase().includes('codex')
  ) {
    return buildRuntimeTool({
      tool: 'codex',
      displayName: 'Codex',
      dirName: '.codex',
      workspaceRoot: fallbackWorkspace.workspaceRoot,
      workspaceRootSource: fallbackWorkspace.workspaceRootSource,
      subtype: 'codex',
    }, { env, platform });
  }

  // MuleRun（内部基于 Claude Code SDK，会同时设置 CLAUDE_CODE 变量，需先于 Claude Code 检测）
  if (env.MULERUN_CHAT_ID || env.MULE_DATA_DIR) {
    return buildRuntimeTool({
      tool: 'mulerun',
      displayName: 'MuleRun',
      dirName: '.mulerun',
      workspaceRoot: fallbackWorkspace.workspaceRoot,
      workspaceRootSource: fallbackWorkspace.workspaceRootSource,
      subtype: 'mulerun',
      agentBrowser: false,
    }, { env, platform });
  }

  // Claude Code
  if (env.CLAUDE_CODE_ENTRYPOINT || env.CLAUDE_CODE) {
    return buildRuntimeTool({
      tool: 'claude-code',
      displayName: 'Claude Code',
      dirName: '.claude',
      workspaceRoot: fallbackWorkspace.workspaceRoot,
      workspaceRootSource: fallbackWorkspace.workspaceRootSource,
      subtype: 'claude-code',
      agentBrowser: false,
    }, { env, platform });
  }

  // OpenCode
  // Windows 上配置目录为 ~/.config/opencode，macOS/Linux 为 ~/.opencode。
  // OpenCode 当前运行时会暴露 OPENCODE_CLIENT；保留 OPENCODE 兼容旧检测。
  if (env.OPENCODE || env.OPENCODE_CLIENT) {
    const opencodeDirName = platform === 'win32'
      ? path.join('.config', 'opencode')
      : '.opencode';
    return buildRuntimeTool({
      tool: 'opencode',
      displayName: 'OpenCode',
      dirName: opencodeDirName,
      workspaceRoot: fallbackWorkspace.workspaceRoot,
      workspaceRootSource: fallbackWorkspace.workspaceRootSource,
      subtype: 'opencode',
      agentBrowser: false,
    }, { env, platform });
  }

  // Cursor
  if (env.CURSOR_TRACE_ID || (env.VSCODE_GIT_ASKPASS_NODE || '').includes('Cursor')) {
    return buildRuntimeTool({
      tool: 'cursor',
      displayName: 'Cursor',
      dirName: '.cursor',
      workspaceRoot: fallbackWorkspace.workspaceRoot,
      workspaceRootSource: fallbackWorkspace.workspaceRootSource,
      subtype: 'cursor',
      agentBrowser: false,
    }, { env, platform });
  }

  // Aone Copilot - 通过专属配置目录检测（VSCode 环境）
  // Aone Copilot 没有独立的环境变量，但会在 home 目录创建 ~/.aone_copilot/
  if (env.TERM_PROGRAM === 'vscode' && fs.existsSync(path.join(home, '.aone_copilot'))) {
    return buildRuntimeTool({
      tool: 'aone-copilot',
      displayName: 'Aone Copilot',
      dirName: '.aone_copilot',
      workspaceRoot: fallbackWorkspace.workspaceRoot,
      workspaceRootSource: fallbackWorkspace.workspaceRootSource,
      subtype: 'aone-copilot',
      agentBrowser: false,
    }, { env, platform });
  }

  return {
    tool: null,
    displayName: null,
    dirName: null,
    workspaceRoot: fallbackWorkspace.workspaceRoot,
    workspaceRootSource: fallbackWorkspace.workspaceRootSource,
    runtime: hasDesktopEnvironment(env, platform) ? 'desktop_shell' : 'unknown',
    subtype: null,
    capabilities: {
      desktop_shell: hasDesktopEnvironment(env, platform),
      agent_browser: false,
      browser_auto_open: hasDesktopEnvironment(env, platform),
      playwright_required: false,
    },
  };
}

/**
 * 检测当前活跃的 AI 工具。
 * 优先级：环境变量 > 兜底检测
 *
 * 注意：只返回当前"活跃"的工具，不返回已安装但未使用的工具。
 *
 * @returns {{ tool: string, displayName: string, dirName: string, workspaceRoot: string }|null}
 */
function detectActiveTool() {
  const runtime = detectRuntimeCapabilities();
  return runtime.tool ? runtime : null;
}

function hasDesktopEnvironment(env = process.env, platform = process.platform) {
  if (env.OPENYIDA_ASSUME_DESKTOP === '1') {
    return true;
  }
  if (env.CI || env.CODEX_CI) {
    return false;
  }
  if (platform === 'darwin' || platform === 'win32') {
    return true;
  }
  if (platform === 'linux') {
    return !!(
      env.DISPLAY ||
      env.WAYLAND_DISPLAY ||
      env.MIR_SOCKET ||
      ['x11', 'wayland'].includes(String(env.XDG_SESSION_TYPE || '').toLowerCase())
    );
  }
  return false;
}

/**
 * 解析悟空工作区根目录。
 *
 * 悟空的 AGENT_WORK_ROOT 历史上有两种形态：
 *   - ~/.real/users/{uuid}/workspace/           直接就是工作区
 *   - ~/.real/users/{uuid}/                     workspace 在其下
 *
 * openyida copy 在空工作区会把 project/ 内容直接铺入工作区，因此这里优先
 * 识别已经含 config.json 的目录，最后回退到 AGENT_WORK_ROOT 本身。
 *
 * @param {string} agentWorkRoot
 * @returns {string}
 */
function resolveWukongWorkspaceRoot(agentWorkRoot) {
  if (!agentWorkRoot) {
    return path.join(os.homedir(), '.real', 'workspace');
  }

  const candidates = [
    agentWorkRoot,
    path.join(agentWorkRoot, 'project'),
    path.join(agentWorkRoot, 'workspace'),
    path.join(agentWorkRoot, 'workspace', 'project'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'config.json'))) {
      return candidate;
    }
  }

  return agentWorkRoot;
}

/**
 * 获取悟空环境的 node bin 目录路径
 * @returns {string|null} 悟空 node bin 目录路径，非悟空环境返回 null
 */
function getWukongNodeBinDir() {
  const activeTool = detectActiveTool();
  if (activeTool && activeTool.tool === 'wukong') {
    const wukongBin = path.join(os.homedir(), '.real', '.bin', 'node', 'bin');
    if (fs.existsSync(wukongBin)) {
      return wukongBin;
    }
  }
  return null;
}

/**
 * 获取当前环境应使用的 npm 可执行文件路径
 * 悟空环境优先使用悟空自带的 npm，避免权限问题
 * @returns {string} npm 可执行文件路径或命令名
 */
function getNpmExecutable() {
  const wukongBin = getWukongNodeBinDir();
  if (wukongBin) {
    const npmName = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const npmPath = path.join(wukongBin, npmName);
    if (fs.existsSync(npmPath)) {
      return npmPath;
    }
  }
  return 'npm';
}

/**
 * 获取当前环境应使用的 node 可执行文件路径
 * 悟空环境优先使用悟空自带的 node，避免权限问题
 * @returns {string} node 可执行文件路径或命令名
 */
function getNodeExecutable() {
  const wukongBin = getWukongNodeBinDir();
  if (wukongBin) {
    const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
    const nodePath = path.join(wukongBin, nodeName);
    if (fs.existsSync(nodePath)) {
      return nodePath;
    }
  }
  return 'node';
}

function isInjectedAuthMode(env = process.env) {
  const authEnabled = String(env.YIDA_AUTH_ENABLED || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(authEnabled);
}

function isEnvAuthMode(env = process.env) {
  return isInjectedAuthMode(env);
}

function isTokenAuthMode(_env = process.env) {
  return true;
}

function normalizeEnvBaseUrl(baseUrl, fallbackBaseUrl) {
  const raw = String(baseUrl || fallbackBaseUrl || 'https://www.aliwork.com').trim();
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return raw.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

// Project root and skills directory helpers.
const YIDA_SKILLS_DIR_NAME = 'yida-skills';
const RUNTIME_WORKSPACE_SOURCES = new Set([
  'QWENWORK_WORKSPACE_DIR',
  'MULE_WORKSPACE_DIR',
  'QODER_WORKER_CWD',
  'AGENT_WORK_ROOT',
]);

function pathFromEnv(value, homeDir = os.homedir()) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  if (raw === '~') {
    return homeDir;
  }
  if (raw.startsWith(`~${path.sep}`) || raw.startsWith('~/')) {
    return path.join(homeDir, raw.slice(2));
  }
  return path.resolve(raw);
}

function projectRootCandidate(projectRoot, source, reason, authoritative = false) {
  return {
    projectRoot,
    source,
    reason,
    authoritative,
    exists: fs.existsSync(projectRoot),
    hasConfig: fs.existsSync(path.join(projectRoot, 'config.json')),
  };
}

function runtimeWorkspaceReason(runtime) {
  const subtype = runtime && (runtime.subtype || runtime.tool);
  return subtype
    ? `${subtype}_runtime_workspace_root`
    : 'runtime_workspace_root';
}

function isRuntimeWorkspaceSource(source) {
  const normalized = String(source || '').trim();
  return normalized.startsWith('env:') || RUNTIME_WORKSPACE_SOURCES.has(normalized);
}

function detectRuntimeCapabilitiesCompat(options = {}) {
  const runtimeDetector = module.exports && module.exports.detectRuntimeCapabilities;
  if (typeof runtimeDetector === 'function') {
    return runtimeDetector(options);
  }

  const cwd = path.resolve(options.cwd || process.cwd());
  const activeTool = Object.prototype.hasOwnProperty.call(options, 'activeTool')
    ? options.activeTool
    : detectActiveTool();

  if (activeTool) {
    return {
      ...activeTool,
      workspaceRootSource: activeTool.workspaceRootSource || 'legacy_active_tool',
      runtime: activeTool.runtime || null,
      subtype: activeTool.subtype || activeTool.tool,
      capabilities: activeTool.capabilities || null,
    };
  }

  return {
    tool: null,
    displayName: null,
    dirName: null,
    workspaceRoot: path.join(cwd, 'project'),
    workspaceRootSource: 'cwd_project',
    runtime: null,
    subtype: null,
    capabilities: null,
  };
}

function resolveProjectRoot(options = {}) {
  const env = options.env || process.env;
  const cwd = path.resolve(options.cwd || process.cwd());
  const runtimeOptions = {
    env,
    cwd,
    home: options.home || options.homeDir,
    platform: options.platform,
  };
  if (Object.prototype.hasOwnProperty.call(options, 'activeTool')) {
    runtimeOptions.activeTool = options.activeTool;
  }
  const runtime = options.runtime || detectRuntimeCapabilitiesCompat(runtimeOptions);
  const activeTool = Object.prototype.hasOwnProperty.call(options, 'activeTool')
    ? options.activeTool
    : (runtime && runtime.tool ? runtime : detectActiveTool());
  const candidates = [];

  const addCandidate = (candidate) => {
    if (!candidate || !candidate.projectRoot) {
      return null;
    }
    candidates.push(candidate);
    return candidate;
  };

  if (runtime && runtime.workspaceRoot) {
    addCandidate(projectRootCandidate(
      runtime.workspaceRoot,
      runtime.workspaceRootSource || 'runtime.workspaceRoot',
      runtimeWorkspaceReason(runtime),
      isRuntimeWorkspaceSource(runtime.workspaceRootSource)
    ));
  }

  const authoritativeCandidate = candidates.find((candidate) => candidate.authoritative);
  if (authoritativeCandidate) {
    return {
      ...authoritativeCandidate,
      candidates,
    };
  }

  const cwdConfigCandidate = projectRootCandidate(cwd, 'cwd:config.json', 'current_directory_has_config');
  if (cwdConfigCandidate.hasConfig) {
    addCandidate(cwdConfigCandidate);
    return {
      ...cwdConfigCandidate,
      candidates,
    };
  }

  const nestedProjectRoot = path.join(cwd, 'project');
  const nestedConfigCandidate = projectRootCandidate(
    nestedProjectRoot,
    'cwd:project/config.json',
    'nested_project_directory_has_config'
  );
  if (nestedConfigCandidate.hasConfig) {
    addCandidate(nestedConfigCandidate);
    return {
      ...nestedConfigCandidate,
      candidates,
    };
  }

  if (activeTool && activeTool.workspaceRoot && fs.existsSync(activeTool.workspaceRoot)) {
    const activeCandidate = projectRootCandidate(
      activeTool.workspaceRoot,
      activeTool.workspaceRootSource || 'active_tool:workspaceRoot',
      activeTool.workspaceRootReason || 'active_tool_workspace_exists'
    );
    addCandidate(activeCandidate);
    return {
      ...activeCandidate,
      candidates,
    };
  }

  const fallbackCandidate = projectRootCandidate(cwd, 'cwd:fallback', 'fallback_to_current_directory');
  addCandidate(fallbackCandidate);
  return {
    ...fallbackCandidate,
    candidates,
  };
}

/**
 * 查找项目根目录（project 工作区）。
 *
 * @returns {string} 项目根目录的绝对路径
 */
function findProjectRoot() {
  return resolveProjectRoot().projectRoot;
}

function normalizeCandidateKey(filePath) {
  const normalized = path.resolve(filePath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function nearestExistingAncestor(dirPath) {
  let current = path.resolve(dirPath);
  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(current)) {
      const stat = fs.statSync(current);
      if (stat.isDirectory()) {
        return current;
      }
    }
    current = path.dirname(current);
  }
  if (fs.existsSync(current) && fs.statSync(current).isDirectory()) {
    return current;
  }
  return null;
}

function canWritePath(destPath) {
  const parentDir = path.dirname(destPath);
  const nearest = nearestExistingAncestor(parentDir);
  if (!nearest) {
    return false;
  }
  try {
    fs.accessSync(nearest, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function appendYidaSkillsDir(skillsRoot) {
  const resolved = path.resolve(skillsRoot);
  if (path.basename(resolved) === YIDA_SKILLS_DIR_NAME) {
    return resolved;
  }
  return path.join(resolved, YIDA_SKILLS_DIR_NAME);
}

function parseQwenWorkConfigSkillPaths(env = process.env) {
  const raw = String(env.QWENWORK_CONFIG_CONTENT || '').trim();
  if (!raw) {
    return { paths: [], error: null };
  }
  try {
    const config = JSON.parse(raw);
    const paths = config &&
      config.skills &&
      Array.isArray(config.skills.paths)
      ? config.skills.paths
      : [];
    return {
      paths: paths.filter((entry) => String(entry || '').trim()),
      error: null,
    };
  } catch (error) {
    return {
      paths: [],
      error: error.message,
    };
  }
}

function buildSkillsCandidate(destPath, source, scope, reason) {
  const parentDir = path.dirname(destPath);
  const nearestWritableBase = nearestExistingAncestor(parentDir);
  const writable = canWritePath(destPath);
  return {
    path: destPath,
    source,
    scope,
    reason,
    exists: fs.existsSync(destPath),
    parent: parentDir,
    parent_exists: fs.existsSync(parentDir),
    nearest_existing_parent: nearestWritableBase,
    writable,
    usable: writable,
    workspace_only: scope === 'workspace',
  };
}

function buildSkillsDiagnostics(options = {}) {
  const env = options.env || process.env;
  const cwd = path.resolve(options.cwd || process.cwd());
  const homeDir = options.homeDir || os.homedir();
  const runtimeOptions = {
    env,
    cwd,
    home: homeDir,
    platform: options.platform,
  };
  if (Object.prototype.hasOwnProperty.call(options, 'activeTool')) {
    runtimeOptions.activeTool = options.activeTool;
  }
  const runtime = options.runtime || detectRuntimeCapabilitiesCompat(runtimeOptions);
  const activeTool = Object.prototype.hasOwnProperty.call(options, 'activeTool')
    ? options.activeTool
    : (runtime && runtime.tool ? runtime : detectActiveTool());
  const projectResolution = options.projectResolution || resolveProjectRoot({
    env,
    cwd,
    homeDir,
    runtime,
    activeTool,
  });
  const projectRoot = options.projectRoot || projectResolution.projectRoot;
  const candidates = [];
  const seen = new Set();
  const qwenWorkSubtype = activeTool && activeTool.tool === 'qwenwork'
    ? (activeTool.subtype || runtime.subtype || null)
    : null;
  const configSkillPaths = parseQwenWorkConfigSkillPaths(env);

  const addCandidate = (destPath, source, scope, reason) => {
    if (!destPath) {
      return;
    }
    const normalizedDest = path.resolve(destPath);
    const key = normalizeCandidateKey(normalizedDest);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(buildSkillsCandidate(normalizedDest, source, scope, reason));
  };

  if (qwenWorkSubtype === 'qwenwork_web') {
    for (const skillPath of configSkillPaths.paths) {
      const expanded = pathFromEnv(skillPath, homeDir);
      addCandidate(
        appendYidaSkillsDir(expanded),
        'env:QWENWORK_CONFIG_CONTENT.skills.paths',
        'host-config',
        'qwenwork_web_configured_skills_path'
      );
    }
    addCandidate(
      path.join(projectRoot, '.qwenwork', 'market-skills', YIDA_SKILLS_DIR_NAME),
      'workspace:.qwenwork/market-skills',
      'workspace',
      'qwenwork_web_workspace_market_skills'
    );
  }

  if (qwenWorkSubtype === 'qwenwork_desktop') {
    addCandidate(
      path.join(homeDir, '.qwenworkcn', 'skills', YIDA_SKILLS_DIR_NAME),
      'home:.qwenworkcn/skills',
      'user',
      'qwenwork_desktop_user_skills_dir'
    );
    addCandidate(
      path.join(projectRoot, '.qwenwork', 'market-skills', YIDA_SKILLS_DIR_NAME),
      'workspace:.qwenwork/market-skills',
      'workspace',
      'qwenwork_desktop_workspace_market_skills_fallback'
    );
  }

  if (activeTool && activeTool.tool !== 'wukong' && activeTool.dirName) {
    addCandidate(
      path.join(homeDir, activeTool.dirName, 'skills', YIDA_SKILLS_DIR_NAME),
      `home:${activeTool.dirName}/skills`,
      'user',
      `${activeTool.tool}_user_skills_dir`
    );
    addCandidate(
      path.join(projectRoot, YIDA_SKILLS_DIR_NAME),
      'workspace:yida-skills',
      'workspace',
      `${activeTool.tool}_workspace_skills_fallback`
    );
  }

  if (!activeTool) {
    addCandidate(
      path.join(projectRoot, YIDA_SKILLS_DIR_NAME),
      'workspace:yida-skills',
      'workspace',
      'no_active_tool_workspace_fallback'
    );
  }

  const selected = candidates.find((candidate) => candidate.usable) || candidates[0] || null;
  const diagnostics = {
    config_content_error: configSkillPaths.error,
    fallback: selected && selected.workspace_only
      ? 'workspace_only_current_workspace_effect'
      : null,
    install_note: activeTool && activeTool.tool === 'wukong'
      ? 'wukong_uses_manual_skill_package_upload'
      : null,
  };

  return {
    schema_version: 1,
    active_tool: activeTool
      ? {
        tool: activeTool.tool,
        displayName: activeTool.displayName,
        dirName: activeTool.dirName,
        runtime: activeTool.runtime || runtime.runtime || null,
        subtype: activeTool.subtype || runtime.subtype || null,
      }
      : null,
    selected,
    candidates,
    diagnostics,
  };
}

function resolveTokenBaseUrl(root, fallbackBaseUrl, session) {
  if (session && session.base_url) {
    return normalizeEnvBaseUrl(session.base_url, fallbackBaseUrl);
  }
  try {
    const { getCurrentEnvConfig } = require('./env-manager');
    const { config } = getCurrentEnvConfig(root);
    return normalizeEnvBaseUrl(process.env.OPENYIDA_ENDPOINT || config.baseUrl, fallbackBaseUrl);
  } catch {
    return fallbackBaseUrl;
  }
}

function loadTokenAuthData(projectRoot, defaultBaseUrl) {
  try {
    const { loadTokenSession } = require('../auth/token-store');
    const session = loadTokenSession({ projectRoot });
    if (!session || (!session.access_token && !session.refresh_token)) {
      return null;
    }
    return {
      corp_id: session.corp_id,
      corp_name: session.corp_name,
      user_id: session.user_id,
      base_url: resolveTokenBaseUrl(projectRoot, defaultBaseUrl, session),
      client_id: session.client_id,
      auth_source: session.auth_source || 'token',
      auth_store: session.auth_store,
      auth_profile: session.auth_profile,
      persistence_scope: session.persistence_scope,
      user_auth_store_writable: session.user_auth_store_writable,
      warning: session.warning,
      auth_mode: 'token',
    };
  } catch {
    return null;
  }
}

async function resolveBearerAuthHeaders(options = {}) {
  if (!isTokenAuthMode()) {
    return { tokenAuth: false, headers: {} };
  }
  const { getAccessToken } = require('../auth/token-auth');
  const accessToken = await getAccessToken({ projectRoot: options.projectRoot });
  return {
    tokenAuth: true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

// ── 登录态缓存读取 ────────────────────────────────────

/**
 * 已废弃：默认登录态不再读取 Cookie。
 * 保留函数名用于断言 legacy 缓存不生效；实际登录态只从 token session 读取。
 * @param {string} [projectRoot]
 * @param {string} [defaultBaseUrl]
 * @returns {object|null}
 */
function loadCookieData(projectRoot, defaultBaseUrl) {
  void projectRoot;
  void defaultBaseUrl;
  return null;
}

/**
 * 读取当前默认登录态。
 * 默认使用 OAuth token session；YIDA_AUTH_ENABLED=true 时仅使用运行环境注入 token。
 * @param {string} [projectRoot]
 * @param {string} [defaultBaseUrl]
 * @returns {object|null}
 */
function loadAuthData(projectRoot, defaultBaseUrl) {
  const root = projectRoot || findProjectRoot();
  const fallbackBaseUrl = defaultBaseUrl || 'https://www.aliwork.com';
  return loadTokenAuthData(root, fallbackBaseUrl);
}

function getAuthStatus(options = {}) {
  const { tokenStatus } = require('../auth/token-auth');
  return tokenStatus(options);
}

// ── 登录触发 ──────────────────────────────────────────

/**
 * 校验默认登录态；host mode 下不会触发 OAuth，本地模式提示用户执行 openyida login。
 * @param {object} [options]
 * @param {boolean} [options.force=false] - 是否跳过本地缓存，强制重新登录
 * @returns {object} loginResult
 */
function triggerLogin(options = {}) {
  if (isEnvAuthMode()) {
    const status = getAuthStatus({ projectRoot: options.projectRoot || findProjectRoot() });
    if (status && status.ok) {
      return loadTokenAuthData(options.projectRoot || findProjectRoot(), status.base_url || 'https://www.aliwork.com');
    }
    const reason = status && status.failure_reason
      ? status.failure_reason
      : 'env_token_missing';
    const { CliError } = require('./cli-error');
    throw new CliError(
      `not_logged_in: host-injected token is unavailable (${reason}). Ask the host to inject an OpenYida token.`,
      {
        code: 'INJECTED_AUTH_REQUIRED',
        details: {
          authMode: 'token',
          failure_reason: reason,
        },
      }
    );
  }

  const tokenAuthData = loadTokenAuthData(options.projectRoot || findProjectRoot(), 'https://www.aliwork.com');
  if (tokenAuthData) {
    return tokenAuthData;
  }
  const { CliError } = require('./cli-error');
  throw new CliError(
    'not_logged_in: token auth is unavailable. Run openyida login first.',
    {
      code: 'TOKEN_AUTH_REQUIRED',
      details: {
        authMode: 'token',
      },
    }
  );
}

// ── 响应检测 ──────────────────────────────────────────

/**
 * 检测响应体是否表示登录过期。
 * @param {object} responseJson
 * @returns {boolean}
 */
function isLoginExpired(responseJson) {
  if (!responseJson) {return false;}
  const content = responseJson && responseJson.content && typeof responseJson.content === 'object' && !Array.isArray(responseJson.content)
    ? responseJson.content
    : {};
  const status = String(responseJson.status || content.status || '').toLowerCase();
  const errorCode = String(
    responseJson.errorCode || responseJson.code || content.errorCode || content.code || ''
  ).toLowerCase();
  const errorMsg = String(
    responseJson.errorMsg || responseJson.message || content.errorMsg || content.message || ''
  ).toLowerCase();
  const loginExpiredCodes = new Set([
    'not_logged_in',
    'invalid_access_token',
    'expired_access_token',
    'access_token_expired',
    'missing_access_token',
  ]);
  if (
    loginExpiredCodes.has(status) ||
    loginExpiredCodes.has(errorCode) ||
    errorMsg.includes('not_logged_in') ||
    errorMsg.includes('invalid_access_token') ||
    errorMsg.includes('expired_access_token') ||
    errorMsg.includes('access_token_expired') ||
    errorMsg.includes('access token is invalid or expired')
  ) {
    return true;
  }
  return (
    responseJson.success === false &&
    ['307', '302', '401', '403'].includes(errorCode)
  );
}

/**
 * 检测响应体是否表示 csrf_token 过期。
 * @param {object} responseJson
 * @returns {boolean}
 */
function isCsrfTokenExpired(responseJson) {
  return (
    responseJson &&
    responseJson.success === false &&
    responseJson.errorCode === 'TIANSHU_000030'
  );
}

function isHttpRedirectStatus(statusCode) {
  return [301, 302, 303, 307, 308].includes(Number(statusCode));
}

function isHttpAuthStatus(statusCode) {
  return [401, 403].includes(Number(statusCode));
}

// ── base_url 解析 ─────────────────────────────────────

/**
 * 从 authData 中解析 base_url，支持多环境配置优先级。
 *
 * 优先级（高 → 低）：
 *   1. authData.base_url（鉴权服务返回的企业业务域名）
 *   2. OPENYIDA_ENDPOINT 环境变量（鉴权端点兼业务兜底）
 *   3. 当前激活的私有化环境配置
 *   4. 当前激活的环境配置（公有云默认）
 *   5. defaultBaseUrl 参数 / 公有云兜底
 *
 * @param {object} authData
 * @param {string} [defaultBaseUrl]
 * @returns {string}
 */
function resolveBaseUrl(authData, defaultBaseUrl) {
  const { normalizeBaseUrl, resolveEndpoint } = require('./env-manager');
  const businessBaseUrl = normalizeBaseUrl(
    authData && authData.base_url,
    null
  );
  if (businessBaseUrl) {
    return businessBaseUrl;
  }
  const resolved = resolveEndpoint(null, undefined);
  if (defaultBaseUrl && resolved === 'https://www.aliwork.com' && (!authData || !authData.base_url)) {
    return defaultBaseUrl.replace(/\/+$/, '');
  }
  return resolved;
}

// ── HTTP 请求工具 ─────────────────────────────────────

function collectResponseText(res, onEnd) {
  const chunks = [];
  res.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  res.on('end', () => {
    onEnd(Buffer.concat(chunks).toString('utf8'));
  });
}

function resolveRequestOptions(optionsOrLegacyCookies, maybeOptions) {
  if (maybeOptions !== undefined) {
    return maybeOptions || {};
  }
  if (Array.isArray(optionsOrLegacyCookies)) {
    return {};
  }
  return optionsOrLegacyCookies || {};
}

async function resolveRequestAuthHeaders(optionsOverride = {}) {
  const auth = await resolveBearerAuthHeaders(optionsOverride);
  return auth.headers;
}

function createNonJsonResponseResult(statusCode, data) {
  const responseText = data === null || data === undefined ? '' : String(data);
  return {
    success: false,
    errorMsg: `HTTP ${statusCode}: ` + t('common.response_not_json'),
    __httpStatus: statusCode,
    __nonJsonResponse: true,
    __emptyBody: responseText.trim().length === 0,
  };
}

/**
 * 发送 HTTP POST 请求（application/x-www-form-urlencoded）
 * @param {string} baseUrl
 * @param {string} requestPath
 * @param {string} postData - querystring 格式
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function httpPost(baseUrl, requestPath, postData, optionsOrLegacyCookies, maybeOptions) {
  const https = require('https');
  const http = require('http');
  const optionsOverride = resolveRequestOptions(optionsOrLegacyCookies, maybeOptions);
  const authHeaders = await resolveRequestAuthHeaders(optionsOverride);
  const bodyData = postData === null || postData === undefined ? '' : String(postData);

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: requestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyData),
        Accept: 'application/json, text/plain, */*',
        Origin: baseUrl,
        Referer: optionsOverride.referer || baseUrl + '/',
        'x-requested-with': 'XMLHttpRequest',
        ...authHeaders,
      },
      timeout: optionsOverride.timeout || 30000,
    };

    const req = requestModule.request(options, (res) => {
      collectResponseText(res, (data) => {
        if (!optionsOverride.silentStatus) {
          warn(t('common.http_status', res.statusCode));
        }
        if (isHttpRedirectStatus(res.statusCode) || isHttpAuthStatus(res.statusCode)) {
          resolve({
            __needLogin: true,
            __httpStatus: res.statusCode,
            __location: res.headers.location || '',
          });
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) {
            resolve({ __needLogin: true });
            return;
          }
          if (isCsrfTokenExpired(parsed)) {
            resolve({ __csrfExpired: true });
            return;
          }
          resolve(parsed);
        } catch {
          if (!optionsOverride.silentStatus) {
            warn(t('common.http_response', data.substring(0, 500)));
          }
          resolve(createNonJsonResponseResult(res.statusCode, data));
        }
      });
    });

    // 用标志位防止 timeout 后 req.destroy() 触发 error 事件导致双重 reject
    let hasRejected = false;
    req.on('timeout', () => {
      hasRejected = true;
      req.destroy();
      reject(new Error(t('common.request_timeout')));
    });
    req.on('error', (err) => { if (!hasRejected) { reject(err); } });
    req.write(bodyData);
    req.end();
  });
}

async function httpPostJson(baseUrl, requestPath, payload, optionsOrLegacyCookies, maybeOptions) {
  const https = require('https');
  const http = require('http');
  const optionsOverride = resolveRequestOptions(optionsOrLegacyCookies, maybeOptions);
  const authHeaders = await resolveRequestAuthHeaders(optionsOverride);

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const body = JSON.stringify(payload === undefined ? {} : payload);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: requestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Accept: 'application/json, text/plain, */*',
        Origin: baseUrl,
        Referer: optionsOverride.referer || baseUrl + '/',
        'x-requested-with': 'XMLHttpRequest',
        ...authHeaders,
      },
      timeout: optionsOverride.timeout || 30000,
    };

    const req = requestModule.request(options, (res) => {
      collectResponseText(res, (data) => {
        if (!optionsOverride.silentStatus) {
          warn(t('common.http_status', res.statusCode));
        }
        if (isHttpRedirectStatus(res.statusCode) || isHttpAuthStatus(res.statusCode)) {
          resolve({
            __needLogin: true,
            __httpStatus: res.statusCode,
            __location: res.headers.location || '',
          });
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) {
            resolve({ __needLogin: true });
            return;
          }
          if (isCsrfTokenExpired(parsed)) {
            resolve({ __csrfExpired: true });
            return;
          }
          resolve(parsed);
        } catch {
          if (!optionsOverride.silentStatus) {
            warn(t('common.http_response', data.substring(0, 500)));
          }
          resolve(createNonJsonResponseResult(res.statusCode, data));
        }
      });
    });

    let hasRejected = false;
    req.on('timeout', () => {
      hasRejected = true;
      req.destroy();
      reject(new Error(t('common.request_timeout')));
    });
    req.on('error', (err) => { if (!hasRejected) { reject(err); } });
    req.write(body);
    req.end();
  });
}

/**
 * 发送 HTTP GET 请求
 * @param {string} baseUrl
 * @param {string} requestPath
 * @param {object} queryParams
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function httpGet(baseUrl, requestPath, queryParams, optionsOrLegacyCookies, maybeOptions) {
  const https = require('https');
  const http = require('http');
  const querystring = require('querystring');
  const optionsOverride = resolveRequestOptions(optionsOrLegacyCookies, maybeOptions);
  const authHeaders = await resolveRequestAuthHeaders(optionsOverride);

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    const fullPath = queryParams ? `${requestPath}?${querystring.stringify(queryParams)}` : requestPath;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: fullPath,
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Origin: baseUrl,
        Referer: baseUrl + '/',
        'x-requested-with': 'XMLHttpRequest',
        ...authHeaders,
      },
      timeout: optionsOverride.timeout || 30000,
    };

    const req = requestModule.request(options, (res) => {
      collectResponseText(res, (data) => {
        if (!optionsOverride.silentStatus) {
          warn(t('common.http_status', res.statusCode));
        }
        if (isHttpRedirectStatus(res.statusCode) || isHttpAuthStatus(res.statusCode)) {
          resolve({
            __needLogin: true,
            __httpStatus: res.statusCode,
            __location: res.headers.location || '',
          });
          return;
        }
        if (optionsOverride.responseType === 'text') {
          if (Number(res.statusCode) < 200 || Number(res.statusCode) >= 300) {
            resolve({
              success: false,
              errorMsg: `HTTP ${res.statusCode}`,
              __httpStatus: res.statusCode,
            });
            return;
          }
          resolve(data);
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) {
            resolve({ __needLogin: true });
            return;
          }
          if (isCsrfTokenExpired(parsed)) {
            resolve({ __csrfExpired: true });
            return;
          }
          resolve(parsed);
        } catch {
          if (!optionsOverride.silentStatus) {
            warn(t('common.http_response', data.substring(0, 500)));
          }
          resolve(createNonJsonResponseResult(res.statusCode, data));
        }
      });
    });

    // 用标志位防止 timeout 后 req.destroy() 触发 error 事件导致双重 reject
    let hasRejected = false;
    req.on('timeout', () => {
      hasRejected = true;
      req.destroy();
      reject(new Error(t('common.request_timeout')));
    });
    req.on('error', (err) => { if (!hasRejected) { reject(err); } });
    req.end();
  });
}

/**
 * 带自动重登录的请求封装。
 * @param {Function} requestFn - 接受 authRef 返回 Promise 的工厂函数
 * @param {object} authRef - { baseUrl, authData }
 * @returns {Promise<object>}
 */
async function requestWithAutoLogin(requestFn, authRef) {
  const result = await requestFn(authRef);

  if (result && result.__needLogin) {
    const { tokenRefresh, isRefreshAuthRequired } = require('../auth/token-auth');
    try {
      const currentAuthData = authRef && authRef.authData;
      const currentBaseUrl = authRef && authRef.baseUrl ? authRef.baseUrl : resolveBaseUrl(currentAuthData);
      const refreshResult = await tokenRefresh({
        projectRoot: authRef && authRef.projectRoot,
        baseUrl: currentBaseUrl,
        clientId: currentAuthData && (currentAuthData.client_id || currentAuthData.clientId),
      });
      if (!refreshResult || refreshResult.ok === false || !refreshResult.access_token) {
        if (isRefreshAuthRequired(refreshResult)) {
          return tokenAuthRequiredResult();
        }
        return tokenRefreshFailedResult(new Error('token_refresh_failed'));
      }
      const refreshedTokenData = refreshResult.access_token
        ? normalizeRefreshedTokenAuthData(refreshResult, currentBaseUrl)
        : loadTokenAuthData(authRef && authRef.projectRoot, currentBaseUrl);
      if (refreshedTokenData) {
        if (!authRef) {
          authRef = {};
        }
        authRef.authData = refreshedTokenData;
        authRef.baseUrl = resolveBaseUrl(refreshedTokenData);
        authRef.authMode = refreshedTokenData.auth_mode || refreshedTokenData.authMode || '';
        authRef.authSource = refreshedTokenData.auth_source || refreshedTokenData.authSource || '';
        authRef.corpId = refreshedTokenData.corp_id || authRef.corpId || '';
        authRef.corpName = refreshedTokenData.corp_name || authRef.corpName || '';
        authRef.userId = refreshedTokenData.user_id || authRef.userId || '';
        return requestFn(authRef);
      }
      return tokenRefreshFailedResult(new Error('token_refresh_failed'));
    } catch (error) {
      if (isRefreshAuthRequired(error)) {
        return tokenAuthRequiredResult();
      }
      return tokenRefreshFailedResult(error);
    }
  }

  return result;
}

function normalizeRefreshedTokenAuthData(refreshResult, fallbackBaseUrl) {
  if (!refreshResult || !refreshResult.access_token) {
    return null;
  }
  return {
    corp_id: refreshResult.corp_id,
    corp_name: refreshResult.corp_name,
    user_id: refreshResult.user_id,
    base_url: resolveBaseUrl(refreshResult, fallbackBaseUrl),
    client_id: refreshResult.client_id,
    auth_source: refreshResult.auth_source || 'token',
    auth_store: refreshResult.auth_store,
    auth_profile: refreshResult.auth_profile,
    persistence_scope: refreshResult.persistence_scope,
    user_auth_store_writable: refreshResult.user_auth_store_writable,
    warning: refreshResult.warning,
    auth_mode: 'token',
  };
}

function tokenAuthRequiredResult() {
  return {
    success: false,
    __needLogin: true,
    errorCode: 'TOKEN_AUTH_REQUIRED',
    errorMsg: 'not_logged_in: token auth is unavailable. Run openyida login first.',
  };
}

function tokenRefreshFailedResult(error) {
  return {
    success: false,
    errorCode: 'TOKEN_REFRESH_FAILED',
    errorMsg: error && error.message
      ? error.message
      : 'token_refresh_failed: failed to refresh access token. Please retry later.',
  };
}

module.exports = {
  detectActiveTool,
  detectRuntimeCapabilities,
  hasDesktopEnvironment,
  findProjectRoot,
  resolveProjectRoot,
  buildSkillsDiagnostics,
  getAuthStatus,
  loadAuthData,
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  isLoginExpired,
  isCsrfTokenExpired,
  httpPost,
  httpPostJson,
  httpGet,
  requestWithAutoLogin,
  getWukongNodeBinDir,
  getNpmExecutable,
  getNodeExecutable,
  resolveWukongWorkspaceRoot,
  isInjectedAuthMode,
  isEnvAuthMode,
  isTokenAuthMode,
};
