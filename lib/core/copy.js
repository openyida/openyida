/**
 * copy.js - 复制 project 工作目录模板 / 复制 yida-skills 到当前 AI 工具环境
 *
 * 用法：
 *   openyida copy                → 复制 project/ 目录模板（默认，合并模式）
 *   openyida copy --force        → 复制 project/ 目录模板（强制覆盖，先清空目标目录）
 *   openyida copy -skills        → 复制 yida-skills/ 到当前 AI 工具的 skills 目录
 *   openyida copy -project       → 复制 project/ 目录模板（与默认行为相同，显式指定）
 *   openyida copy -project --force → 复制 project/ 目录模板（强制覆盖）
 *
 * 目标策略：
 *   - 复制/链接到当前工程目录（process.cwd()）或宿主显式提供的工作区
 *
 * 源路径：npm 全局安装包根目录（通过 require.resolve 定位）
 *
 * project/ 合并模式（默认）：已存在的文件强制覆盖，目标目录中多余的文件保留不动
 * project/ 强制模式（--force）：先清空目标目录，再完整复制
 * yida-skills/：复制到宿主的 skills 目录，如目标已存在则先清理
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { CliError } = require('./cli-error');
const { detectEnvironment } = require('./env');
const { buildSkillsDiagnostics, resolveProjectRoot } = require('./utils');
const { t } = require('./i18n');
const { warn } = require('./chalk');

const PROJECT_COPY_IGNORE_PATHS = [
  '.cache',
  path.join('pages', 'build'),
  path.join('pages', 'dist'),
];

const PROJECT_WORKSPACE_DIRS = [
  path.join('pages', 'src'),
];

const RUNTIME_WORKSPACE_SOURCES = new Set([
  'QWENWORK_WORKSPACE_DIR',
  'MULE_WORKSPACE_DIR',
  'QODER_WORKER_CWD',
]);

function isExplicitRuntimeWorkspaceSource(source) {
  const normalized = String(source || '').trim();
  return normalized.startsWith('env:') || RUNTIME_WORKSPACE_SOURCES.has(normalized);
}

/**
 * 查找 npm 全局安装包根目录。
 * 优先通过 require.resolve 定位（适用于正式全局安装），
 * 失败时 fallback 到 __dirname 向上查找（适用于 npm link 本地开发）。
 * @returns {string|null} 包根目录的绝对路径，找不到则返回 null
 */
function findPackageRoot() {
  try {
    const packageJsonPath = require.resolve('openyida/package.json');
    return path.dirname(packageJsonPath);
  } catch {
    // fallback：从当前文件向上查找包含 package.json 的目录
    let dir = path.resolve(__dirname);
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    return null;
  }
}

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function shouldSkipCopyPath(sourcePath, sourceRoot, ignorePaths) {
  if (!Array.isArray(ignorePaths) || !ignorePaths.length) {
    return false;
  }
  const relativePath = normalizeRelativePath(path.relative(sourceRoot, sourcePath));
  return ignorePaths.some((ignorePath) => {
    const normalizedIgnore = normalizeRelativePath(ignorePath);
    return relativePath === normalizedIgnore || relativePath.startsWith(`${normalizedIgnore}/`);
  });
}

/**
 * 合并复制目录：源文件强制覆盖，目标目录多余文件保留。
 * @returns {number} 复制的文件数量
 */
function mergeCopyDir(sourceDir, destDir, options = {}) {
  if (!fs.existsSync(sourceDir)) {return 0;}

  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  let copiedCount = 0;
  const sourceRoot = options.sourceRoot || sourceDir;

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (shouldSkipCopyPath(sourcePath, sourceRoot, options.ignorePaths)) {
      continue;
    }

    if (entry.isDirectory()) {
      copiedCount += mergeCopyDir(sourcePath, destPath, { ...options, sourceRoot });
    } else {
      fs.copyFileSync(sourcePath, destPath);
      console.log(t('copy.copying', destPath));
      copiedCount++;
    }
  }

  return copiedCount;
}

function resolveExistingPath(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function resolveCanonicalPath(targetPath) {
  let current = path.resolve(targetPath);
  const missingSegments = [];

  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    missingSegments.unshift(path.basename(current));
    current = parent;
  }

  const existingBase = fs.existsSync(current) ? fs.realpathSync(current) : current;
  return path.resolve(existingBase, ...missingSegments);
}

function isSameOrDescendantPath(candidatePath, parentPath) {
  const relative = path.relative(parentPath, candidatePath);
  return relative === '' || (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function assertCopyDestinationSafe(sourceDir, destDir) {
  const sourcePath = resolveCanonicalPath(sourceDir);
  const destinationPath = resolveCanonicalPath(destDir);
  const destinationInsideSource = isSameOrDescendantPath(destinationPath, sourcePath);
  const sourceInsideDestination = isSameOrDescendantPath(sourcePath, destinationPath);

  if (!destinationInsideSource && !sourceInsideDestination) {
    return;
  }

  throw new CliError(t('copy.source_destination_overlap', sourcePath, destinationPath), {
    code: 'COPY_SOURCE_DESTINATION_OVERLAP',
    details: {
      sourcePath,
      destinationPath,
      relation: destinationInsideSource ? 'destination_inside_source' : 'source_inside_destination',
      sideEffectState: 'none',
      retryable: false,
      retrySafe: true,
    },
  });
}

function isSameDirectory(a, b) {
  const pathA = resolveExistingPath(a);
  const pathB = resolveExistingPath(b);
  if (process.platform === 'win32') {
    return pathA.toLowerCase() === pathB.toLowerCase();
  }
  return pathA === pathB;
}

function clearDirectoryContents(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
  }
}

/**
 * 强制复制目录：先清空目标目录，再完整复制。
 * @returns {number} 复制的文件数量
 */
function forceCopyDir(sourceDir, destDir, options = {}) {
  if (!fs.existsSync(sourceDir)) {return 0;}

  if (fs.existsSync(destDir)) {
    if (isSameDirectory(destDir, process.cwd())) {
      clearDirectoryContents(destDir);
    } else {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
    console.log(t('copy.cleared', destDir));
  }

  return mergeCopyDir(sourceDir, destDir, options);
}

function ensureProjectWorkspaceDirs(projectDir) {
  PROJECT_WORKSPACE_DIRS.forEach((relativeDir) => {
    fs.mkdirSync(path.join(projectDir, relativeDir), { recursive: true });
  });
}

/**
 * 删除已有的 yida-skills 软链接或目录。
 * 使用 lstatSync 而非 existsSync，可以检测到悬空软链（目标不存在但链接本身存在）。
 * @returns {boolean} 是否执行了删除操作
 */
function removeSkillsLink(destLink) {
  let stats;
  try {
    stats = fs.lstatSync(destLink);
  } catch {
    // 路径不存在（包括悬空软链也不存在的情况）
    return false;
  }

  try {
    if (stats.isSymbolicLink()) {
      fs.unlinkSync(destLink);
      console.log(t('copy.symlink_removed', destLink));
    } else if (stats.isDirectory()) {
      fs.rmSync(destLink, { recursive: true, force: true });
      console.log(t('copy.dir_deleted', destLink));
    } else {
      fs.unlinkSync(destLink);
      console.log(t('copy.removed', destLink));
    }
    return true;
  } catch (error) {
    warn(t('copy.remove_failed', destLink, error.message));
    return false;
  }
}

/**
 * 根据已检测的环境信息返回目标根目录，避免重复调用 detectEnvironment()。
 * @param {string|null} activeToolName
 * @param {string|null} activeProjectRoot
 * @param {Array} envResults
 * @param {object} [options]
 * @param {boolean} [options.allowCurrentDir=false] - 未检测到活跃 AI 工具时，是否允许使用当前目录
 * @returns {string} 目标根目录路径
 */
function resolveDestBaseFromEnv(activeToolName, activeProjectRoot, envResults, options = {}) {
  const activeResult = envResults.find((r) => r.displayName === activeToolName);
  const runtimeSource = (options.activeTool && options.activeTool.workspaceRootSource) ||
    (activeResult && activeResult.workspaceRootSource);

  if (
    (activeResult || options.activeTool) &&
    activeProjectRoot &&
    isExplicitRuntimeWorkspaceSource(runtimeSource)
  ) {
    return activeProjectRoot;
  }

  if (activeToolName) {
    return process.cwd();
  }

  if (options.allowCurrentDir) {
    return process.cwd();
  }

  // 未检测到活跃工具
  warn(t('copy.no_ai_tool'));
  envResults.forEach((r) => {
    warn(`     ${r.isActive ? '✅' : '⬜'} ${r.displayName}`);
  });
  warn(t('copy.force_hint'));
  process.exit(1);
}

/**
 * 执行单项复制任务，打印结果。
 */
function copyItem(label, sourceDir, destDir, isForce, options = {}) {
  assertCopyDestinationSafe(sourceDir, destDir);
  console.log(t('copy.copying_label', label));
  const count = isForce
    ? forceCopyDir(sourceDir, destDir, options)
    : mergeCopyDir(sourceDir, destDir, options);
  return count;
}

/**
 * 执行 copy 命令主逻辑。
 * @param {string[]} [args=process.argv.slice(3)] 命令参数
 */
function run(args = process.argv.slice(3)) {
  if (args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }
  const { c, sep, banner, info, success, label, fail: chalkFail, listItem } = require('./chalk');

  banner(t('copy.title'), { stderr: false });

  const isForce = args.includes('--force');
  const wantsSkills = args.includes('-skills');
  const wantsProject = args.includes('-project');

  // 1. 查找 npm 包根目录
  const packageRoot = findPackageRoot();
  if (!packageRoot) {
    chalkFail(t('copy.no_package'), { hint: `${t('copy.no_package_hint1')}\n  ${t('copy.no_package_hint2')}` });
  }

  const packageProjectDir = path.join(packageRoot, 'project');
  const packageYidaSkillsDir = path.join(packageRoot, 'yida-skills');

  label('Package', packageRoot, { stderr: false });

  // 2. 确定目标根目录（检测 AI 工具环境）
  const {
    activeTool,
    activeToolName,
    activeProjectRoot: detectedProjectRoot,
    results: envResults,
  } = detectEnvironment();
  const runtimeOptions = activeTool ? { activeTool } : {};
  const projectResolution = resolveProjectRoot(runtimeOptions);
  const activeProjectRoot = projectResolution.projectRoot || detectedProjectRoot;
  const destBase = resolveDestBaseFromEnv(activeToolName, activeProjectRoot, envResults, {
    allowCurrentDir: isForce,
    activeTool,
  });
  label('Target', destBase, { stderr: false });
  if (isForce) {
    warn(t('copy.force_mode'), false);
  }

  // 3. 确定要复制/链接的内容
  //    - 指定了 -skills：复制到 AI 工具可发现的 skills 目录
  //    - 指定了 -project：只复制 project/
  //    - 两者都没指定（默认）：只复制 project/
  //    - 两者都指定：同时处理两项

  const shouldCopyProject = wantsProject || (!wantsSkills);
  const shouldLinkSkills = wantsSkills;

  const results = [];

  if (shouldCopyProject) {
    // 检查 destBase 是否为空目录：
    //   - 空目录 → 直接把 project/ 内容铺进 destBase，不创建 project/ 这层
    //   - 非空目录（已有其他文件）→ 复制整个 project/ 目录（含目录本身）
    const destBaseEntries = fs.existsSync(destBase)
      ? fs.readdirSync(destBase).filter((name) => name !== '.DS_Store')
      : [];
    const isDestBaseEmpty = destBaseEntries.length === 0;
    const shouldUseProjectRootDirectly = isExplicitRuntimeWorkspaceSource(projectResolution.source);

    const projectDestDir = (isDestBaseEmpty || shouldUseProjectRootDirectly)
      ? destBase
      : path.join(destBase, 'project');

    if (isDestBaseEmpty) {
      console.log(t('copy.dest_empty_flatten'));
    }

    const count = copyItem('project/', packageProjectDir, projectDestDir, isForce, {
      ignorePaths: PROJECT_COPY_IGNORE_PATHS,
      sourceRoot: packageProjectDir,
    });
    ensureProjectWorkspaceDirs(projectDestDir);
    results.push({ label: 'project/', dest: projectDestDir, count, type: 'copy' });
  }

  if (shouldLinkSkills) {
    // 复制到 AI 工具配置目录的 skills/yida-skills/；
    // 若宿主用户级目录不可写，按 capabilities 诊断降级到工作区可发现目录。
    const activeResult = envResults.find((r) => r.isActive);
    const skillsDiagnostics = buildSkillsDiagnostics({ ...runtimeOptions, projectResolution });
    const selectedSkills = skillsDiagnostics.selected;

    if (selectedSkills && selectedSkills.path) {
      assertCopyDestinationSafe(packageYidaSkillsDir, selectedSkills.path);
      // 清理旧版遗留在根目录的错误安装
      if (activeResult && selectedSkills.scope === 'user') {
        removeSkillsLink(path.join(os.homedir(), activeResult.dirName, 'yida-skills'));
      }

      // 清理已有的 skills/yida-skills/（旧软链或旧目录）
      removeSkillsLink(selectedSkills.path);

      // 复制文件
      fs.mkdirSync(path.dirname(selectedSkills.path), { recursive: true });
      const count = mergeCopyDir(packageYidaSkillsDir, selectedSkills.path);
      results.push({
        label: 'yida-skills/',
        dest: selectedSkills.path,
        count,
        type: selectedSkills.workspace_only ? 'copy-workspace' : 'copy'
      });
    } else {
      // 未检测到 AI 工具，复制到当前目录下
      const destSkillsDest = path.join(destBase, 'yida-skills');
      assertCopyDestinationSafe(packageYidaSkillsDir, destSkillsDest);
      removeSkillsLink(destSkillsDest);
      const count = mergeCopyDir(packageYidaSkillsDir, destSkillsDest);
      results.push({
        label: 'yida-skills/',
        dest: destSkillsDest,
        count,
        type: 'copy'
      });
    }
  }

  // 4. 打印汇总
  const copyCount = results
    .filter((r) => r.type === 'copy' || r.type === 'copy-workspace')
    .reduce((sum, r) => sum + r.count, 0);
  const linkCount = results.filter((r) => r.type === 'symlink').length;
  console.log('');
  console.log(`  ${sep()}`);
  success(t('copy.done'), false);
  if (copyCount > 0) {
    info(t('copy.files_copied', copyCount), false);
  }
  if (linkCount > 0) {
    info(t('copy.symlinks_created', linkCount), false);
  }
  results.forEach((r) => {
    if (r.type === 'symlink') {
      listItem(`${c.cyan}${r.label.padEnd(14)}${c.reset} ${c.dim}→${c.reset} ${r.dest} ${c.dim}(${t('copy.symlink_label')})${c.reset}`, { stderr: false });
    } else {
      listItem(`${c.cyan}${r.label.padEnd(14)}${c.reset} ${c.dim}→${c.reset} ${r.dest} ${c.dim}(${t('copy.files_count', r.count)})${c.reset}`, { stderr: false });
    }
  });
  console.log(`  ${sep()}\n`);
}

module.exports = {
  run,
  _internal: {
    assertCopyDestinationSafe,
    forceCopyDir,
    ensureProjectWorkspaceDirs,
    resolveDestBaseFromEnv,
  },
};
