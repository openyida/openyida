/**
 * copy.js - 复制 project 工作目录模板 / 安装 yida-skills 到所有 AI 工具
 *
 * 用法：
 *   openyida copy                → 复制 project/ 目录模板（默认，合并模式）
 *   openyida copy --force        → 复制 project/ 目录模板（强制覆盖，先清空目标目录）
 *   openyida copy -skills        → 安装 yida-skills/ 到所有已安装的 AI 工具的 skills 目录
 *                                  非悟空：软链到 ~/<agent>/skills/yida-skills/（参考 npx skills 机制）
 *                                  悟空：删除已有软链（悟空通过手动上传技能，不需要软链）
 *   openyida copy -project       → 复制 project/ 目录模板（与默认行为相同，显式指定）
 *   openyida copy -project --force → 复制 project/ 目录模板（强制覆盖）
 *
 * 目标策略（project/）：
 *   - 悟空（Wukong）：复制到 ~/.real/workspace/project/
 *   - 其他 AI 工具：复制到当前工程目录（process.cwd()）下
 *
 * 目标策略（yida-skills/）：
 *   - 遍历所有已安装的 AI 工具，软链到 ~/<agent>/skills/yida-skills/
 *   - 悟空：删除已有软链或目录（悟空通过手动上传技能，不需要软链）
 *   - Windows：软链失败时自动降级为目录复制
 *
 * 源路径：npm 全局安装包根目录（通过 require.resolve 定位）
 *
 * project/ 合并模式（默认）：已存在的文件强制覆盖，目标目录中多余的文件保留不动
 * project/ 强制模式（--force）：先清空目标目录，再完整复制
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { detectEnvironment } = require('./env');
const { t } = require('./i18n');

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

/**
 * 合并复制目录：源文件强制覆盖，目标目录多余文件保留。
 * @returns {number} 复制的文件数量
 */
function mergeCopyDir(sourceDir, destDir) {
  if (!fs.existsSync(sourceDir)) {return 0;}

  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  let copiedCount = 0;

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copiedCount += mergeCopyDir(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
      console.log(t('copy.copying', destPath));
      copiedCount++;
    }
  }

  return copiedCount;
}

/**
 * 强制复制目录：先清空目标目录，再完整复制。
 * @returns {number} 复制的文件数量
 */
function forceCopyDir(sourceDir, destDir) {
  if (!fs.existsSync(sourceDir)) {return 0;}

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
    console.log(t('copy.cleared', destDir));
  }

  return mergeCopyDir(sourceDir, destDir);
}

/**
 * 删除指定路径（软链接或目录），用于悟空环境清理或安装前的覆盖处理。
 * 使用 lstatSync 而非 existsSync，可以检测到悬空软链（目标不存在但链接本身存在）。
 * @param {string} targetPath 要删除的路径
 * @param {boolean} silent 是否静默（不打印"未找到"提示）
 * @returns {boolean} 是否执行了删除操作
 */
function removePath(targetPath, silent) {
  let stats;
  try {
    stats = fs.lstatSync(targetPath);
  } catch {
    if (!silent) {
      console.log(t('copy.wukong_skills_not_found', targetPath));
    }
    return false;
  }

  try {
    if (stats.isSymbolicLink()) {
      fs.unlinkSync(targetPath);
      console.log(t('copy.symlink_removed', targetPath));
    } else if (stats.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log(t('copy.dir_deleted', targetPath));
    } else {
      fs.unlinkSync(targetPath);
      console.log(t('copy.removed', targetPath));
    }
    return true;
  } catch (error) {
    console.error(t('copy.remove_failed', targetPath, error.message));
    return false;
  }
}

/**
 * 创建软链接：如果目标已存在则先删除，再创建软链接。
 * Windows 上软链需要管理员权限或开发者模式，失败时自动降级为目录复制。
 * @param {string} sourceDir 源目录路径
 * @param {string} destLink 目标软链接路径
 * @returns {boolean} 是否成功创建
 */
function createSymlink(sourceDir, destLink) {
  if (!fs.existsSync(sourceDir)) {return false;}

  // 如果目标已存在，先删除（静默模式，不打印"未找到"）
  removePath(destLink, true);

  // Windows 上 junction 只支持目录，且需要管理员权限或开发者模式
  // 失败时降级为目录复制
  const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
  try {
    fs.symlinkSync(sourceDir, destLink, symlinkType);
    console.log(t('copy.symlink_created', destLink, sourceDir));
    return true;
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') {
      console.log(t('copy.symlink_fallback_copy', destLink));
      const count = mergeCopyDir(sourceDir, destLink);
      console.log(t('copy.files_copied', count));
      return true;
    }
    console.error(t('copy.symlink_failed', destLink, error.message));
    return false;
  }
}

/**
 * 将 yida-skills/ 安装到所有已安装的 AI 工具的 skills 目录。
 * 参考 npx skills 的安装机制：软链到 ~/<agent>/skills/yida-skills/
 * 悟空环境：删除已有软链（悟空通过手动上传技能，不需要软链）
 *
 * @param {string} sourceDir yida-skills/ 源目录路径
 * @param {Array} installedTools 已安装的 AI 工具列表（来自 getInstalledTools()）
 * @returns {Array} 每个工具的安装结果 { displayName, dirName, dest, type, success }
 */
function installSkillsToAllAgents(sourceDir, installedTools) {
  const installResults = [];
  const userHome = os.homedir();

  for (const { dirName, displayName } of installedTools) {
    const isWukong = dirName === '.real';
    const agentSkillsDir = path.join(userHome, dirName, 'skills');
    const destLink = path.join(agentSkillsDir, 'yida-skills');

    if (isWukong) {
      // 悟空环境：删除已有软链，不创建新软链
      console.log(`  [${displayName}] ${t('copy.wukong_skills_cleanup')}`);
      const removed = removePath(destLink, false);
      installResults.push({ displayName, dirName, dest: destLink, type: 'wukong-cleanup', success: removed });
    } else {
      // 其他 AI 工具：确保 skills 目录存在，然后创建软链接
      try {
        fs.mkdirSync(agentSkillsDir, { recursive: true });
      } catch (error) {
        console.error(`  [${displayName}] ${t('copy.symlink_failed', agentSkillsDir, error.message)}`);
        installResults.push({ displayName, dirName, dest: destLink, type: 'symlink', success: false });
        continue;
      }
      console.log(`  [${displayName}] ${t('copy.creating_symlink')}`);
      const success = createSymlink(sourceDir, destLink);
      installResults.push({ displayName, dirName, dest: destLink, type: 'symlink', success });
    }
  }

  return installResults;
}

/**
 * 根据已检测的环境信息返回目标根目录，避免重复调用 detectEnvironment()。
 * @param {string|null} activeToolName
 * @param {string|null} activeProjectRoot
 * @param {Array} envResults
 * @returns {string} 目标根目录路径
 */
function resolveDestBaseFromEnv(activeToolName, activeProjectRoot, envResults) {
  const activeResult = envResults.find((r) => r.displayName === activeToolName);
  const isWukong = activeResult && activeResult.dirName === '.real';

  if (isWukong) {
    return activeProjectRoot
      ? path.dirname(activeProjectRoot)
      : path.join(os.homedir(), '.real', 'workspace');
  }

  if (activeToolName) {
    return process.cwd();
  }

  // 未检测到活跃工具
  console.error(t('copy.no_ai_tool'));
  envResults.forEach((r) => {
    console.error(`     ${r.isActive ? '✅' : '⬜'} ${r.displayName}`);
  });
  console.error(t('copy.force_hint'));
  process.exit(1);
}

/**
 * 执行单项复制任务，打印结果。
 */
function copyItem(label, sourceDir, destDir, isForce) {
  console.log(t('copy.copying_label', label));
  const count = isForce
    ? forceCopyDir(sourceDir, destDir)
    : mergeCopyDir(sourceDir, destDir);
  return count;
}

/**
 * 执行 copy 命令主逻辑。
 */
function run() {
  const SEP = '='.repeat(55);
  console.log(SEP);
  console.log(t('copy.title'));
  console.log(SEP);

  const args = process.argv.slice(3);
  const isForce = args.includes('--force');
  const wantsSkills = args.includes('-skills');
  const wantsProject = args.includes('-project');

  // 1. 查找 npm 包根目录
  const packageRoot = findPackageRoot();
  if (!packageRoot) {
    console.error(t('copy.no_package'));
    console.error(t('copy.no_package_hint1'));
    console.error(t('copy.no_package_hint2'));
    process.exit(1);
  }

  const packageProjectDir = path.join(packageRoot, 'project');
  const packageYidaSkillsDir = path.join(packageRoot, 'yida-skills');

  console.log(t('copy.package_root', packageRoot));

  // 2. 检测 AI 工具环境（一次性调用，复用结果）
  const { activeToolName, activeProjectRoot, results: envResults } = detectEnvironment();

  // 3. 确定要复制/链接的内容
  //    - 指定了 -skills：遍历所有已安装的 AI 工具，安装到各自的 ~/<agent>/skills/yida-skills/
  //    - 指定了 -project：只复制 project/
  //    - 两者都没指定（默认）：只复制 project/
  //    - 两者都指定：同时处理两项

  const shouldCopyProject = wantsProject || (!wantsSkills);
  const shouldLinkSkills = wantsSkills;

  const results = [];

  if (shouldCopyProject) {
    // project/ 复制仍然依赖当前活跃工具的目标根目录
    const destBase = resolveDestBaseFromEnv(activeToolName, activeProjectRoot, envResults);
    console.log(t('copy.dest_base', destBase));
    if (isForce) {
      console.log(t('copy.force_mode'));
    }
    const count = copyItem(
      'project/',
      packageProjectDir,
      path.join(destBase, 'project'),
      isForce
    );
    results.push({ label: 'project/', dest: path.join(destBase, 'project'), count, type: 'copy' });
  }

  if (shouldLinkSkills) {
    // 参考 npx skills 机制：遍历所有已安装的 AI 工具，安装到各自的 skills 目录
    const installedTools = envResults.map(({ dirName, displayName }) => ({ dirName, displayName }));

    if (installedTools.length === 0) {
      console.log(t('copy.no_ai_tool'));
    } else {
      console.log(t('copy.installing_skills_to_agents'));
      const skillsInstallResults = installSkillsToAllAgents(packageYidaSkillsDir, installedTools);
      skillsInstallResults.forEach((r) => {
        results.push({
          label: 'yida-skills/',
          dest: r.dest,
          count: r.success ? 1 : 0,
          type: r.type,
          displayName: r.displayName,
        });
      });
    }
  }

  // 4. 打印汇总
  const copyCount = results.filter(r => r.type === 'copy').reduce((sum, r) => sum + r.count, 0);
  const symlinkResults = results.filter(r => r.type === 'symlink');
  const successLinkCount = symlinkResults.filter(r => r.count > 0).length;
  console.log(`\n${SEP}`);
  console.log(t('copy.done'));
  if (copyCount > 0) {
    console.log(t('copy.files_copied', copyCount));
  }
  if (successLinkCount > 0) {
    console.log(t('copy.symlinks_created', successLinkCount));
  }
  results.forEach((r) => {
    if (r.type === 'symlink') {
      const status = r.count > 0 ? t('copy.symlink_label') : t('copy.failed');
      console.log(`   [${r.displayName}] → ${r.dest} (${status})`);
    } else if (r.type === 'wukong-cleanup') {
      const statusText = r.count > 0 ? t('copy.wukong_skills_cleaned') : '跳过';
      console.log(`   [${r.displayName}] → ${r.dest} (${statusText})`);
    } else {
      console.log(`   ${r.label.padEnd(14)} → ${r.dest} (${t('copy.files_count', r.count)})`);
    }
  });
  console.log(SEP);
}

module.exports = { run, removePath, createSymlink, installSkillsToAllAgents };
