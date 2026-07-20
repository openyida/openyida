#!/usr/bin/env node

'use strict';

/**
 * i18n 语言包一致性校验
 *
 * 以 zh（源语言）为基准，校验核心语言包和 locales-extra/core 下可选语言包的 key 是否对齐：
 *   - 基准中存在但目标语言缺失的 key  -> 错误（会 fallback 到其它语言，用户可见）
 *   - 目标语言多出的 key             -> 警告（可能是残留 / 拼写错误）
 *   - 叶子/分支类型不一致（string vs object）-> 错误
 *
 * 用法：
 *   node scripts/validate-i18n.js            # 严格模式：任意缺失则退出码 1（本地全量审计）
 *   node scripts/validate-i18n.js --check    # 棘轮模式：核心语言漂移超过基线时失败（CI 用）
 *   node scripts/validate-i18n.js --update-baseline  # 将当前漂移写入基线
 *   node scripts/validate-i18n.js --json     # 输出机器可读结果
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'lib', 'core', 'locales');
const EXTRA_LOCALES_DIR = path.join(ROOT, 'locales-extra', 'core');
const BASELINE_FILE = path.join(__dirname, 'i18n-baseline.json');
const BASE_LOCALE = 'zh';
const CORE_CHECK_LOCALES = new Set(['en']);

function resolveLocaleFile(name) {
  const coreFile = path.join(LOCALES_DIR, `${name}.js`);
  if (fs.existsSync(coreFile)) {
    return coreFile;
  }
  const extraFile = path.join(EXTRA_LOCALES_DIR, `${name}.js`);
  if (fs.existsSync(extraFile)) {
    return extraFile;
  }
  return null;
}

function loadLocale(name) {
  // 清除 require 缓存，保证多次运行结果稳定
  const file = resolveLocaleFile(name);
  if (!file) {
    throw new Error(`Locale not found: ${name}`);
  }
  delete require.cache[require.resolve(file)];
  return require(file);
}

function listLocales() {
  const localeNames = new Set();
  [LOCALES_DIR, EXTRA_LOCALES_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) { return; }
    fs.readdirSync(dir)
      .filter((f) => f.endsWith('.js'))
      .forEach((f) => localeNames.add(f.replace(/\.js$/, '')));
  });
  return [...localeNames].sort();
}

/**
 * 把嵌套对象拍平成 { 'a.b.c': 'leaf', 'a.b': '__branch__' } 的形式。
 * 记录分支节点，用于检测 string vs object 类型冲突。
 */
function flatten(obj, prefix, out) {
  Object.keys(obj).forEach((key) => {
    const full = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[full] = '__branch__';
      flatten(value, full, out);
    } else {
      out[full] = '__leaf__';
    }
  });
  return out;
}

function computeReport() {
  const locales = listLocales();
  if (!locales.includes(BASE_LOCALE)) {
    console.error(`[i18n] 基准语言包 ${BASE_LOCALE}.js 不存在`);
    process.exit(1);
  }
  const baseFlat = flatten(loadLocale(BASE_LOCALE), '', {});
  const basePaths = Object.keys(baseFlat);
  const report = {};
  locales.forEach((name) => {
    if (name === BASE_LOCALE) { return; }
    const flat = flatten(loadLocale(name), '', {});
    const missing = [];
    const typeMismatch = [];
    basePaths.forEach((p) => {
      if (!(p in flat)) { missing.push(p); }
      else if (flat[p] !== baseFlat[p]) { typeMismatch.push(p); }
    });
    const extra = Object.keys(flat).filter((p) => !(p in baseFlat));
    report[name] = { missing, extra, typeMismatch };
  });
  return { locales, basePathCount: basePaths.length, report };
}

function readBaseline() {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  } catch (err) {
    return null;
  }
}

function main() {
  const asJson = process.argv.includes('--json');
  const isCheck = process.argv.includes('--check');
  const isUpdateBaseline = process.argv.includes('--update-baseline');

  const { locales, basePathCount, report } = computeReport();

  let totalMissing = 0;
  let totalTypeMismatch = 0;
  locales.forEach((name) => {
    if (name === BASE_LOCALE) { return; }
    totalMissing += report[name].missing.length;
    totalTypeMismatch += report[name].typeMismatch.length;
  });

  // 生成/更新基线：记录每个语言当前缺失数与类型冲突数
  if (isUpdateBaseline) {
    const baseline = { base: BASE_LOCALE, basePathCount, locales: {} };
    Object.keys(report).forEach((name) => {
      baseline.locales[name] = {
        missing: report[name].missing.length,
        typeMismatch: report[name].typeMismatch.length,
      };
    });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`[i18n] 已写入基线 ${path.relative(ROOT, BASELINE_FILE)}：${basePathCount} 个基准 key，${Object.keys(report).length} 个目标语言。`);
    return;
  }

  if (asJson) {
    console.log(JSON.stringify({ base: BASE_LOCALE, basePathCount, report }, null, 2));
    return;
  }

  console.log(`[i18n] 基准 ${BASE_LOCALE}.js 共 ${basePathCount} 个 key，校验 ${locales.length - 1} 个目标语言包\n`);
  locales.forEach((name) => {
    if (name === BASE_LOCALE) { return; }
    const r = report[name];
    const ok = r.missing.length === 0 && r.typeMismatch.length === 0;
    console.log(`${ok ? 'OK  ' : 'WARN'} ${name}: 缺失 ${r.missing.length} / 类型冲突 ${r.typeMismatch.length} / 多余 ${r.extra.length}`);
    if (r.missing.length) {
      console.log('     缺失: ' + r.missing.slice(0, 12).join(', ') + (r.missing.length > 12 ? ` …(+${r.missing.length - 12})` : ''));
    }
    if (r.typeMismatch.length) {
      console.log('     类型冲突: ' + r.typeMismatch.slice(0, 10).join(', '));
    }
  });

  // 棘轮模式：与基线比较，只在漂移变大或出现类型冲突时失败
  if (isCheck) {
    const baseline = readBaseline();
    if (!baseline) {
      console.error('\n[i18n] 未找到基线文件，请先运行 node scripts/validate-i18n.js --update-baseline');
      process.exit(1);
    }
    const regressions = [];
    Object.keys(report).forEach((name) => {
      if (!CORE_CHECK_LOCALES.has(name)) { return; }
      const base = baseline.locales[name] || { missing: 0, typeMismatch: 0 };
      if (report[name].missing.length > base.missing) {
        regressions.push(`${name} 缺失 ${base.missing} → ${report[name].missing.length}`);
      }
      if (report[name].typeMismatch.length > base.typeMismatch) {
        regressions.push(`${name} 类型冲突 ${base.typeMismatch} → ${report[name].typeMismatch.length}`);
      }
    });
    if (regressions.length) {
      console.error('\n[i18n] 棘轮校验失败：以下语言漂移增大，请补齐新增 key 或修正后重试：\n  - ' + regressions.join('\n  - '));
      console.error('（存量缺失作为跟踪项，补齐后运行 --update-baseline 收紧基线）');
      process.exit(1);
    }
    console.log('\n[i18n] 棘轮校验通过：核心语言无新增漂移 ✓（可选语言同步参与结构校验）');
    return;
  }

  // 严格模式（默认）
  if (totalMissing > 0 || totalTypeMismatch > 0) {
    console.error(`\n[i18n] 严格校验失败：${totalMissing} 个缺失 key，${totalTypeMismatch} 个类型冲突。`);
    console.error('（CI 使用 --check 棘轮模式；本地补齐后运行 --update-baseline）');
    process.exit(1);
  }
  console.log('\n[i18n] 全部语言包 key 对齐 ✓');
}

main();
