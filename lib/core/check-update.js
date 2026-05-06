/**
 * check-update.js - openyida 版本更新检查
 *
 * 向 npm registry 查询最新版本，有新版本时打印提示。
 * 全程异步，不阻塞主命令流程。
 */

'use strict';

const https = require('https');
const { t } = require('./i18n');

const REGISTRY_URL = 'https://registry.npmjs.org/openyida/latest';

/**
 * 从 npm registry 获取最新版本号。
 * @returns {Promise<string|null>}
 */
function fetchLatestVersion() {
  return new Promise((resolve) => {
    const req = https.get(REGISTRY_URL, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.version || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('socket', (socket) => {
      if (socket && typeof socket.unref === 'function') {
        socket.unref();
      }
    });
    if (typeof req.unref === 'function') {
      req.unref();
    }
  });
}

/**
 * 比较版本号，返回 latestVersion 是否比 currentVersion 更新。
 * 支持 semver 格式（major.minor.patch），pre-release 标签（如 -beta.1）会被忽略，
 * 仅比较数字部分。
 */
function isNewer(currentVersion, latestVersion) {
  // 截取 '-' 前的纯数字版本部分，兼容 pre-release 格式（如 1.2.3-beta.1）
  const parseStableVersion = (v) => (v || '').split('-')[0];
  const parseParts = (v) => parseStableVersion(v).split('.').map((n) => parseInt(n, 10) || 0);
  const [cMajor, cMinor, cPatch] = parseParts(currentVersion);
  const [lMajor, lMinor, lPatch] = parseParts(latestVersion);

  if (lMajor !== cMajor) {return lMajor > cMajor;}
  if (lMinor !== cMinor) {return lMinor > cMinor;}
  return lPatch > cPatch;
}

/**
 * 检查是否有新版本，有则打印提示。
 * @param {string} currentVersion - 当前版本号（来自 package.json）
 */
async function checkUpdate(currentVersion) {
  try {
    const latestVersion = await fetchLatestVersion();

    if (latestVersion && isNewer(currentVersion, latestVersion)) {
      process.nextTick(() => {
        const { c } = require('./chalk');
        process.stderr.write(`\n  ${c.yellow}⚠${c.reset} ${t('check_update.new_version', latestVersion, currentVersion)}\n`);
      });
    }
  } catch {
    // 版本检查失败静默忽略，不影响主流程
  }
}

module.exports = { checkUpdate, isNewer, fetchLatestVersion };
