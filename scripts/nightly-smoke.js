#!/usr/bin/env node

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');
const BASE_REQUIRED_ENV = [
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
    baseUrl: env.OPENYIDA_SMOKE_BASE_URL,
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

function buildCliEnv(env = process.env, config = {}) {
  return {
    ...env,
    ...(config.baseUrl && !env.OPENYIDA_ENDPOINT ? { OPENYIDA_ENDPOINT: config.baseUrl } : {}),
  };
}

function run(options = {}) {
  const env = options.env || process.env;
  const executeCli = options.runCli || runCli;
  if (!hasRequiredConfig(env)) {
    return;
  }

  const config = getSmokeConfig(env);
  const cliEnv = buildCliEnv(env, config);

  executeCli(['login', '--check-only'], cliEnv);
  executeCli(['app-list', '--size', '1'], cliEnv);

  if (config.pageUuid) {
    executeCli(['get-schema', config.appType, config.pageUuid], cliEnv);
    if (config.pageSource) {
      executeCli(['publish', config.pageSource, config.appType, config.pageUuid, '--health-check', '--no-open'], cliEnv);
    }
  }

  if (config.formUuid) {
    executeCli(['get-schema', config.appType, config.formUuid], cliEnv);
    executeCli(['data', 'query', 'form', config.appType, config.formUuid, '--size', '1'], cliEnv);
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
  buildCliEnv,
  getSmokeConfig,
  hasRequiredConfig,
  run,
  runCli,
};
