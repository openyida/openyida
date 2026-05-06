#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');
const REQUIRED_ENV = [
  'OPENYIDA_SMOKE_COOKIES_BASE64',
  'OPENYIDA_SMOKE_APP_TYPE',
  'OPENYIDA_SMOKE_FORM_UUID',
];

function hasRequiredConfig() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.log(`Skipping real-environment smoke; missing: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

function decodeCookieData() {
  const raw = Buffer.from(process.env.OPENYIDA_SMOKE_COOKIES_BASE64, 'base64').toString('utf8');
  const parsed = JSON.parse(raw);
  const cookieData = Array.isArray(parsed) ? { cookies: parsed } : parsed;
  if (!Array.isArray(cookieData.cookies) || cookieData.cookies.length === 0) {
    throw new Error('OPENYIDA_SMOKE_COOKIES_BASE64 must decode to a cookie array or an object with cookies');
  }
  cookieData.base_url = process.env.OPENYIDA_SMOKE_BASE_URL || cookieData.base_url || 'https://www.aliwork.com';
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

function runCli(args) {
  console.log(`Running: openyida ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
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

function run() {
  if (!hasRequiredConfig()) {
    return;
  }

  const cookieData = decodeCookieData();
  writeCookieCache(cookieData);

  const appType = process.env.OPENYIDA_SMOKE_APP_TYPE;
  const formUuid = process.env.OPENYIDA_SMOKE_FORM_UUID;

  runCli(['login', '--check-only']);
  runCli(['app-list', '--size', '1']);
  runCli(['get-schema', appType, formUuid]);
  runCli(['data', 'query', 'form', appType, formUuid, '--size', '1']);

  console.log('Nightly real-environment smoke passed');
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
