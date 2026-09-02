/**
 * update.js - openyida 自更新命令
 *
 * 参考 openclaw update 的终端输出风格：
 *   - 表格化状态展示（Install / Channel / Version / Update）
 *   - 分步骤 spinner 进度动画
 *   - 彩色高亮关键信息
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { fetchLatestVersion, isNewer, parseSemver } = require('./check-update');
const { t } = require('./i18n');
const { c, warn } = require('./chalk');
const { CliError } = require('./cli-error');
const { getNpmExecutable } = require('./utils');

const DEFAULT_AUTO_UPDATE_SECS = 24 * 60 * 60;
const LOCK_STALE_MS = 10 * 60 * 1000;
const AUTO_UPDATE_DIR = '.openyida';
const AUTO_UPDATE_STATE_FILE = 'update-check.json';
const AUTO_UPDATE_LOCK_FILE = 'update.lock';

// ── ANSI 颜色常量 ──────────────────────────────────
const RESET   = c.reset;
const BOLD    = c.bold;
const DIM     = c.dim;
const GREEN   = c.green;
const YELLOW  = c.yellow;
const CYAN    = c.cyan;
const RED     = c.red;
const MAGENTA = c.magenta;

// ── Spinner 动画 ───────────────────────────────────
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function createSpinner(message) {
  let frameIndex = 0;
  const timer = setInterval(() => {
    process.stderr.write(`\r${CYAN}${SPINNER_FRAMES[frameIndex]}${RESET} ${message}`);
    frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
  }, 80);

  return {
    succeed(text) {
      clearInterval(timer);
      process.stderr.write(`\r${GREEN}✔${RESET} ${text}\n`);
    },
    fail(text) {
      clearInterval(timer);
      process.stderr.write(`\r${RED}✖${RESET} ${text}\n`);
    },
  };
}

// ── 表格渲染（仿 openclaw renderTable）─────────────
function renderStatusTable(rows) {
  const labelWidth = Math.max(...rows.map(([label]) => label.length)) + 2;
  const border = `${DIM}${'─'.repeat(labelWidth + 32)}${RESET}`;

  console.log(border);
  for (const [label, value] of rows) {
    const paddedLabel = `${BOLD}${label}${RESET}`.padEnd(labelWidth + BOLD.length + RESET.length);
    console.log(`  ${paddedLabel}  ${value}`);
  }
  console.log(border);
}

function runNpmSync(npmArgs, options = {}) {
  const execFile = options.execFileSyncFn || execFileSync;
  const npmExecutable = options.npmExecutable || getNpmExecutable();
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const command = platform === 'win32'
    ? (env.ComSpec || env.COMSPEC || 'cmd.exe')
    : npmExecutable;
  const args = platform === 'win32'
    ? ['/d', '/c', npmExecutable, ...npmArgs]
    : npmArgs;
  return execFile(command, args, {
    ...(options.execOptions || {}),
    env,
  });
}

/**
 * 检测当前 npm 全局安装方式（npm / pnpm / yarn）
 */
function detectPackageManager(options = {}) {
  const npmExecutable = options.npmExecutable || getNpmExecutable();
  try {
    const common = {
      execFileSyncFn: options.execFileSyncFn,
      npmExecutable,
      platform: options.platform,
      env: options.env,
    };
    const npmRoot = runNpmSync(['root', '-g'], {
      ...common,
      execOptions: { encoding: 'utf8', timeout: 5000 },
    }).trim();
    const globalPath = runNpmSync(['prefix', '-g'], {
      ...common,
      execOptions: { encoding: 'utf8', timeout: 5000 },
    }).trim();
    if (globalPath && npmRoot) {
      return 'npm';
    }
  } catch {
    // ignore
  }
  return 'npm';
}

function isManagedCloudRuntime(env = process.env) {
  const qwenWorkEnabled = ['1', 'true', 'yes', 'on']
    .includes(String(env.QWENWORK || '').trim().toLowerCase());
  const agentPlatform = String(env.AGENT_PLATFORM || '').toLowerCase();
  return String(env.OPENYIDA_MANAGED_RUNTIME || '').trim().toLowerCase() === 'cloud' || !!(
    env.CI ||
    env.CODEX_CI ||
    qwenWorkEnabled ||
    agentPlatform.includes('qwenwork') ||
    env.QWENWORK_CLIENT ||
    env.QWENWORK_WORKSPACE_DIR ||
    env.QWENWORK_SANDBOX_ID ||
    env.QWENWORK_PREVIEW_URL ||
    env.QWENWORK_VNC_URL ||
    env.MULERUN_CHAT_ID ||
    env.MULE_DATA_DIR ||
    env.MULE_WORKSPACE_DIR ||
    env.MULE_SANDBOX_ID
  );
}

function isAutoUpdateDisabled(env = process.env) {
  return !!(
    env.OPENYIDA_NO_AUTO_UPDATE ||
    env.OPENYIDA_SKIP_UPDATE_CHECK ||
    env.NO_UPDATE_NOTIFIER ||
    env.OPENYIDA_AUTO_UPDATE_REEXEC
  );
}

function getAutoUpdateIntervalMs(env = process.env) {
  const raw = env.OPENYIDA_AUTO_UPDATE_SECS;
  const configured = raw === undefined || String(raw).trim() === '' ? NaN : Number(raw);
  const seconds = Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_AUTO_UPDATE_SECS;
  return seconds * 1000;
}

function shouldSkipAutoUpdateCommand(command, args = []) {
  if (!command || ['--help', '-h', '--version', '-v'].includes(command)) {
    return true;
  }
  if (['commands', 'agent-capabilities', 'mcp', 'a2a', 'bridge', 'update'].includes(command)) {
    return true;
  }
  return args.some(arg => ['--help', '-h', '--version', '-v', '--check-only'].includes(arg));
}

function normalizeRealPath(targetPath, fsImpl = fs) {
  try {
    const realpath = fsImpl.realpathSync.native || fsImpl.realpathSync;
    const resolved = realpath(targetPath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  } catch {
    const resolved = path.resolve(targetPath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }
}

/**
 * 仅当当前 package 真实位于 `npm root -g` 下时，才允许自动安装。
 */
function isNpmGlobalInstall(options = {}) {
  const npmExecutable = options.npmExecutable || getNpmExecutable();
  const fsImpl = options.fsImpl || fs;
  const packageRoot = options.packageRoot || path.resolve(__dirname, '..', '..');
  try {
    const npmRoot = String(runNpmSync(['root', '-g'], {
      execFileSyncFn: options.execFileSyncFn,
      npmExecutable,
      platform: options.platform,
      env: options.env,
      execOptions: { encoding: 'utf8', timeout: 5000 },
    })).trim();
    if (!npmRoot) {return false;}
    return normalizeRealPath(packageRoot, fsImpl) === normalizeRealPath(path.join(npmRoot, 'openyida'), fsImpl);
  } catch {
    return false;
  }
}

function installVersion(version, options = {}) {
  if (!parseSemver(version)) {
    throw new CliError(t('update.fetch_failed'), { code: 'INVALID_UPDATE_VERSION' });
  }
  const npmExecutable = options.npmExecutable || getNpmExecutable();
  runNpmSync(['install', '-g', `openyida@${version}`], {
    execFileSyncFn: options.execFileSyncFn,
    npmExecutable,
    platform: options.platform,
    env: options.env,
    execOptions: {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeout || 120000,
      env: options.env || process.env,
    },
  });
}

function readLastCheck(statePath, fsImpl = fs) {
  try {
    const parsed = JSON.parse(fsImpl.readFileSync(statePath, 'utf8'));
    return Number.isFinite(parsed.lastCheck) ? parsed.lastCheck : 0;
  } catch {
    return 0;
  }
}

function writeLastCheck(statePath, now, fsImpl = fs) {
  const tempPath = `${statePath}.${process.pid}.tmp`;
  fsImpl.writeFileSync(tempPath, `${JSON.stringify({ lastCheck: now })}\n`, 'utf8');
  fsImpl.renameSync(tempPath, statePath);
}

function acquireUpdateLock(lockPath, now, fsImpl = fs) {
  const tryOpen = () => fsImpl.openSync(lockPath, 'wx');
  try {
    return tryOpen();
  } catch (error) {
    if (!error || error.code !== 'EEXIST') {throw error;}
  }

  try {
    const stat = fsImpl.statSync(lockPath);
    if (now - stat.mtimeMs <= LOCK_STALE_MS) {return null;}
    fsImpl.unlinkSync(lockPath);
    return tryOpen();
  } catch {
    return null;
  }
}

function releaseUpdateLock(lockPath, lockFd, fsImpl = fs) {
  try { fsImpl.closeSync(lockFd); } catch { /* lock may already be closed */ }
  try { fsImpl.unlinkSync(lockPath); } catch { /* lock may already be removed */ }
}

/**
 * Homebrew 风格的命令前同步自动更新。返回 reexecuted=true 时，调用方必须停止执行旧 CLI。
 */
async function maybeAutoUpdate(options = {}) {
  const env = options.env || process.env;

  // 云端/关闭守卫必须位于任何缓存、registry 和 npm 副作用之前。
  if (isManagedCloudRuntime(env) || isAutoUpdateDisabled(env)) {
    return { status: 'skipped', reason: 'environment' };
  }
  if (shouldSkipAutoUpdateCommand(options.command, options.args)) {
    return { status: 'skipped', reason: 'command' };
  }

  const fsImpl = options.fsImpl || fs;
  const now = options.now === undefined ? Date.now() : options.now;
  const updateDir = options.updateDir || path.join(os.homedir(), AUTO_UPDATE_DIR);
  const statePath = path.join(updateDir, AUTO_UPDATE_STATE_FILE);
  const lockPath = path.join(updateDir, AUTO_UPDATE_LOCK_FILE);
  const intervalMs = getAutoUpdateIntervalMs(env);
  const lastCheck = readLastCheck(statePath, fsImpl);
  if (lastCheck > 0 && now - lastCheck < intervalMs) {
    return { status: 'skipped', reason: 'fresh' };
  }

  const npmExecutable = options.npmExecutable || getNpmExecutable();
  const execFile = options.execFileSyncFn || execFileSync;
  if (!isNpmGlobalInstall({
    execFileSyncFn: execFile,
    npmExecutable,
    fsImpl,
    packageRoot: options.packageRoot,
    platform: options.platform,
    env,
  })) {
    return { status: 'skipped', reason: 'not-npm-global' };
  }

  let lockFd;
  try {
    fsImpl.mkdirSync(updateDir, { recursive: true });
    lockFd = acquireUpdateLock(lockPath, now, fsImpl);
  } catch (error) {
    const stderr = options.stderr || process.stderr;
    stderr.write(`${t('update.install_failed', error.message)}\n`);
    return { status: 'failed', error };
  }
  if (lockFd === null) {
    return { status: 'skipped', reason: 'locked' };
  }

  try {
    // 获锁后复查，避免并发进程在等待检测期间重复检查。
    const lockedLastCheck = readLastCheck(statePath, fsImpl);
    if (lockedLastCheck > 0 && now - lockedLastCheck < intervalMs) {
      return { status: 'skipped', reason: 'fresh' };
    }

    const fetchVersion = options.fetchLatestVersionFn || fetchLatestVersion;
    let latestVersion = null;
    try {
      latestVersion = await fetchVersion();
    } finally {
      // 网络失败也记入检查周期，避免离线环境每条命令都等待超时。
      writeLastCheck(statePath, now, fsImpl);
    }
    if (!latestVersion || !isNewer(options.currentVersion, latestVersion)) {
      return { status: 'checked', latestVersion };
    }

    const stderr = options.stderr || process.stderr;
    stderr.write(`${t('update.found_new_version', latestVersion, options.currentVersion)}\n`);
    try {
      const install = options.installVersionFn || installVersion;
      install(latestVersion, {
        execFileSyncFn: execFile,
        npmExecutable,
        platform: options.platform,
        env,
      });
    } catch (error) {
      stderr.write(`${t('update.install_failed', error.message)}\n`);
      return { status: 'failed', error };
    }
    stderr.write(`${t('update.success', latestVersion)}\n`);

    // 锁只保护检查与安装；新 CLI 的业务命令不应长期占用更新锁。
    releaseUpdateLock(lockPath, lockFd, fsImpl);
    lockFd = null;

    const spawn = options.spawnSyncFn || spawnSync;
    const argv = options.argv || process.argv;
    let child;
    try {
      child = spawn(process.execPath, argv.slice(1), {
        stdio: 'inherit',
        env: { ...env, OPENYIDA_AUTO_UPDATE_REEXEC: '1' },
      });
    } catch (error) {
      stderr.write(`${t('update.install_failed', error.message)}\n`);
      return { status: 'reexecuted', reexecuted: true, exitCode: 1, error };
    }
    return {
      status: 'reexecuted',
      reexecuted: true,
      exitCode: Number.isInteger(child.status) ? child.status : 1,
      error: child.error,
    };
  } catch (error) {
    const stderr = options.stderr || process.stderr;
    stderr.write(`${t('update.install_failed', error.message)}\n`);
    return { status: 'failed', error };
  } finally {
    if (lockFd !== null) {
      releaseUpdateLock(lockPath, lockFd, fsImpl);
    }
  }
}

/**
 * 执行自更新流程（仿 openclaw update 风格）：
 * 1. 展示当前状态表格
 * 2. 查询 npm registry 获取最新版本
 * 3. 若有新版本，spinner 动画安装 registry 查询到的精确版本
 * 4. 若已是最新，表格中标记 up to date
 *
 * @param {string} currentVersion - 当前版本号（来自 package.json）
 */
async function runUpdate(currentVersion) {
  if (isManagedCloudRuntime(process.env)) {
    return { status: 'skipped', reason: 'managed-runtime' };
  }
  // ── 标题 ──
  console.log('');
  console.log(`${BOLD}${CYAN}OpenYida update${RESET}`);
  console.log('');

  // ── Step 1: 检查最新版本 ──
  const spinner = createSpinner(t('update.checking'));
  const latestVersion = await fetchLatestVersion();

  if (!latestVersion) {
    spinner.fail(t('update.fetch_failed'));
    throw new CliError(t('update.fetch_failed'), { code: 'UPDATE_CHECK_FAILED' });
  }

  const hasUpdate = isNewer(currentVersion, latestVersion);
  spinner.succeed(t('update.checking'));

  // ── Step 2: 状态表格 ──
  const packageManager = detectPackageManager();
  const updateValue = hasUpdate
    ? `${YELLOW}${BOLD}${t('update.available')}${RESET} · ${MAGENTA}${currentVersion}${RESET} → ${GREEN}${BOLD}${latestVersion}${RESET}`
    : `${GREEN}${t('update.up_to_date')}${RESET} · ${DIM}${latestVersion}${RESET}`;

  renderStatusTable([
    [t('update.label_install'),  packageManager],
    [t('update.label_channel'),  `stable ${DIM}(default)${RESET}`],
    [t('update.label_version'),  `${CYAN}${currentVersion}${RESET}`],
    [t('update.label_update'),   updateValue],
  ]);

  // ── Step 3: 无需更新 → 退出 ──
  if (!hasUpdate) {
    console.log('');
    console.log(`  ${GREEN}✔${RESET} ${t('update.already_latest', currentVersion)}`);
    console.log('');
    return;
  }

  // ── Step 4: 执行更新 ──
  console.log('');
  const installSpinner = createSpinner(t('update.installing', latestVersion));

  try {
    installVersion(latestVersion);
    installSpinner.succeed(`${t('update.success', latestVersion)}`);
  } catch (error) {
    installSpinner.fail(t('update.install_failed', error.message));
    warn(`  ${DIM}${t('update.manual_hint', latestVersion)}${RESET}`);
    throw new CliError(t('update.install_failed', error.message), { code: 'UPDATE_INSTALL_FAILED' });
  }

  // ── 完成提示 ──
  console.log('');
  console.log(`  ${GREEN}${BOLD}${t('update.done')}${RESET}`);
  console.log(`  ${DIM}${t('update.done_hint')}${RESET}`);
  console.log('');
}

module.exports = {
  runUpdate,
  installVersion,
  maybeAutoUpdate,
  isManagedCloudRuntime,
  isAutoUpdateDisabled,
  getAutoUpdateIntervalMs,
  shouldSkipAutoUpdateCommand,
  isNpmGlobalInstall,
  readLastCheck,
  acquireUpdateLock,
  runNpmSync,
};
