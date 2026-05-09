#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');
const BASE_REQUIRED_ENV = [
  'OPENYIDA_SMOKE_COOKIES_BASE64',
  'OPENYIDA_SMOKE_APP_TYPE',
];

function getSmokeConfig(env = process.env) {
  const missing = BASE_REQUIRED_ENV.filter((name) => !env[name]);
  const hasFormSmoke = Boolean(env.OPENYIDA_SMOKE_FORM_UUID);
  const hasPageSmoke = Boolean(env.OPENYIDA_SMOKE_PAGE_UUID);
  if (!hasFormSmoke && !hasPageSmoke) {
    missing.push('OPENYIDA_SMOKE_FORM_UUID or OPENYIDA_SMOKE_PAGE_UUID');
  }
  if (env.OPENYIDA_SMOKE_PAGE_SOURCE && !hasPageSmoke) {
    missing.push('OPENYIDA_SMOKE_PAGE_UUID');
  }
  return {
    missing,
    appType: env.OPENYIDA_SMOKE_APP_TYPE,
    formUuid: env.OPENYIDA_SMOKE_FORM_UUID,
    pageUuid: env.OPENYIDA_SMOKE_PAGE_UUID,
    pageSource: env.OPENYIDA_SMOKE_PAGE_SOURCE,
  };
}

function hasRequiredConfig(env = process.env) {
  const { missing } = getSmokeConfig(env);
  if (missing.length > 0) {
    console.log(`Skipping real-environment smoke; missing: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

function decodeCookieData(env = process.env) {
  const raw = Buffer.from(env.OPENYIDA_SMOKE_COOKIES_BASE64, 'base64').toString('utf8');
  const parsed = JSON.parse(raw);
  const cookieData = Array.isArray(parsed) ? { cookies: parsed } : parsed;
  if (!Array.isArray(cookieData.cookies) || cookieData.cookies.length === 0) {
    throw new Error('OPENYIDA_SMOKE_COOKIES_BASE64 must decode to a cookie array or an object with cookies');
  }
  cookieData.base_url = env.OPENYIDA_SMOKE_BASE_URL || cookieData.base_url || 'https://www.aliwork.com';
  return cookieData;
}

function writeCookieCache(cookieData) {
  const cacheDir = path.join(ROOT, 'project', '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, 'cookies-public.json'),
    JSON.stringify(cookieData, null, 2),
    'utf8'
  );
}

function runCli(args, env = process.env) {
  console.log(`Running: openyida ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...env,
      OPENYIDA_LANG: 'zh',
      CI: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  });
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = (stderr || stdout).slice(0, 1000);
    throw new Error(`Command failed: openyida ${args.join(' ')}\n${details}`);
  }
  const outputLength = (result.stdout || '').trim().length;
  console.log(`OK: openyida ${args[0]} (${outputLength} stdout chars)`);
}

function run(options = {}) {
  const env = options.env || process.env;
  const executeCli = options.runCli || runCli;
  const persistCookieCache = options.writeCookieCache || writeCookieCache;
  if (!hasRequiredConfig(env)) {
    return;
  }

  const config = getSmokeConfig(env);
  const cookieData = decodeCookieData(env);
  persistCookieCache(cookieData);

  executeCli(['login', '--check-only'], env);
  executeCli(['app-list', '--size', '1'], env);

  if (config.pageUuid) {
    executeCli(['get-schema', config.appType, config.pageUuid], env);
    if (config.pageSource) {
      executeCli(['publish', config.pageSource, config.appType, config.pageUuid, '--health-check', '--no-open'], env);
    }
  }

  if (config.formUuid) {
    executeCli(['get-schema', config.appType, config.formUuid], env);
    executeCli(['data', 'query', 'form', config.appType, config.formUuid, '--size', '1'], env);
  }

  console.log('Nightly real-environment smoke passed');
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  decodeCookieData,
  getSmokeConfig,
  hasRequiredConfig,
  run,
  runCli,
  writeCookieCache,
};
