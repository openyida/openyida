'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** 技能复制属于可选安装步骤，权限不足时保留旧目录，CLI 仍可使用随包技能。 */
function install(options = {}) {
  const io = options.fs || fs;
  const home = options.home || os.homedir();
  const root = path.join(home, '.qwenworkcn');
  if (!options.target && !io.existsSync(root)) { return { status: 'skipped' }; }
  const source = options.source || path.resolve(__dirname, '../yida-skills');
  const target = options.target || path.join(root, 'skills', 'yida-skills');
  const unique = `${Date.now()}-${process.pid}`;
  const backup = path.join(options.backupRoot || path.join(options.target ? path.dirname(target) : root, '.openyida-beta-backups'), unique);
  const stage = path.join(path.dirname(target), `.openyida-installing-${unique}`);
  let moved = false;
  try {
    io.mkdirSync(path.dirname(target), { recursive: true });
    io.cpSync(source, stage, { recursive: true });
    if (io.existsSync(target)) {
      io.mkdirSync(path.dirname(backup), { recursive: true });
      io.renameSync(target, backup);
      moved = true;
    }
    io.renameSync(stage, target);
    return { status: 'updated' };
  } catch {
    // 可选复制失败不使 npm 回滚；旧技能已移动时先恢复，备份始终保留在扫描目录外。
    try { if (moved && !io.existsSync(target)) { io.renameSync(backup, target); } } catch { /* 保留备份，避免覆盖现有内容。 */ }
    try { io.rmSync(stage, { recursive: true, force: true }); } catch { /* 权限不足时不扩大清理范围。 */ }
    return { status: 'skipped' };
  }
}

if (require.main === module) {
  const index = process.argv.indexOf('--target-dir');
  install(index >= 0 && process.argv[index + 1] ? { target: path.resolve(process.argv[index + 1]) } : {});
}
module.exports = { install };
