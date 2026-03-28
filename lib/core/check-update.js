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
  });
}

/**
 * 比较版本号，返回 latestVersion 是否比 currentVersion 更新。
 * 仅支持 semver 格式（major.minor.patch）。
 */
function isNewer(currentVersion, latestVersion) {
  const parseParts = (v) => (v || '').split('.').map((n) => parseInt(n, 10) || 0);
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
        console.error(t('check_update.new_version', latestVersion, currentVersion));
      });
    }
  } catch {
    // 版本检查失败静默忽略，不影响主流程
  }
}

module.exports = { checkUpdate, isNewer, fetchLatestVersion };
