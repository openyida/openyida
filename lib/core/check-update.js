/**
 * check-update.js - openyida 版本更新检查
 *
 * 向 npm registry 查询 latest dist-tag，并提供 SemVer 比较。
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
 * 实现 SemVer 2.0.0 的优先级规则，构建元数据不参与比较。
 */
function isNewer(currentVersion, latestVersion) {
  const current = parseSemver(currentVersion);
  const latest = parseSemver(latestVersion);
  if (!current || !latest) {return false;}

  for (const key of ['major', 'minor', 'patch']) {
    const compared = compareNumericIdentifier(latest[key], current[key]);
    if (compared !== 0) {return compared > 0;}
  }

  return comparePrerelease(latest.prerelease, current.prerelease) > 0;
}

function parseSemver(version) {
  if (typeof version !== 'string') {return null;}
  const match = version.trim().match(
    /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
  );
  if (!match) {return null;}
  return {
    major: match[1],
    minor: match[2],
    patch: match[3],
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function comparePrerelease(left, right) {
  if (left.length === 0 || right.length === 0) {
    if (left.length === right.length) {return 0;}
    return left.length === 0 ? 1 : -1;
  }

  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    if (left[i] === undefined) {return -1;}
    if (right[i] === undefined) {return 1;}
    if (left[i] === right[i]) {continue;}

    const leftNumeric = /^\d+$/.test(left[i]);
    const rightNumeric = /^\d+$/.test(right[i]);
    if (leftNumeric && rightNumeric) {
      return compareNumericIdentifier(left[i], right[i]);
    }
    if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    }
    return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function compareNumericIdentifier(left, right) {
  if (left.length !== right.length) {
    return left.length > right.length ? 1 : -1;
  }
  if (left === right) {return 0;}
  return left > right ? 1 : -1;
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

module.exports = {
  checkUpdate,
  isNewer,
  fetchLatestVersion,
  parseSemver,
  comparePrerelease,
  compareNumericIdentifier,
};
