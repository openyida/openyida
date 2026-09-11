#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { compileCanvasLocal } = require('../../lib/app/canvas-compile');

const ROOT = path.resolve(__dirname, '..', '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');
const DEFAULT_REGISTRY_DIR = path.join(ROOT, 'project', '.cache', 'e2e-real');
const DEFAULT_FIELDS_FILE = path.join(__dirname, 'fixtures', 'form-fields.json');
const DEFAULT_PAGE_SOURCE = path.join(__dirname, 'fixtures', 'page.canvas.jsx');

function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
}

function getConfig(env = process.env, date = new Date()) {
  const prefix = env.OPENYIDA_E2E_PREFIX || `OY_E2E_${nowStamp(date)}`;
  return {
    enabled: env.OPENYIDA_E2E === '1',
    missing: env.OPENYIDA_E2E === '1' ? [] : ['OPENYIDA_E2E=1'],
    prefix,
    appName: env.OPENYIDA_E2E_APP_NAME || `${prefix}_App`,
    formName: env.OPENYIDA_E2E_FORM_NAME || `${prefix}_Form`,
    pageName: env.OPENYIDA_E2E_PAGE_NAME || `${prefix}_Page`,
    fieldsFile: env.OPENYIDA_E2E_FIELDS_FILE || DEFAULT_FIELDS_FILE,
    pageSource: env.OPENYIDA_E2E_PAGE_SOURCE || DEFAULT_PAGE_SOURCE,
    registryDir: env.OPENYIDA_E2E_REGISTRY_DIR || DEFAULT_REGISTRY_DIR,
    baseUrl: env.OPENYIDA_E2E_BASE_URL,
    corpId: env.OPENYIDA_E2E_CORP_ID,
    skipPublish: env.OPENYIDA_E2E_SKIP_PUBLISH === '1',
  };
}

function ensureEnabled(config) {
  if (!config.enabled) {
    console.log(`Skipping real E2E; missing: ${config.missing.join(', ')}`);
    return false;
  }
  return true;
}

function createRegistry(config) {
  fs.mkdirSync(config.registryDir, { recursive: true });
  const registry = {
    runId: config.prefix,
    startedAt: new Date().toISOString(),
    status: 'running',
    targetCorpId: config.corpId || null,
    resources: [],
    commands: [],
  };
  const registryPath = path.join(config.registryDir, `${config.prefix}.json`);
  writeRegistry(registryPath, registry);
  return { registry, registryPath };
}

function writeRegistry(registryPath, registry) {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

function addResource(registry, registryPath, resource) {
  registry.resources.push({
    createdAt: new Date().toISOString(),
    ...resource,
  });
  writeRegistry(registryPath, registry);
}

function extractJsonObjects(output) {
  const text = output || '';
  const results = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '{') {continue;}
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let cursor = index; cursor < text.length; cursor += 1) {
      const char = text[cursor];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(index, cursor + 1);
          try {
            results.push(JSON.parse(candidate));
          } catch {
            // Keep scanning; CLI output may contain braces in non-JSON text.
          }
          index = cursor;
          break;
        }
      }
    }
  }
  return results;
}

function parseLastJson(output) {
  const parsed = extractJsonObjects(output);
  return parsed.length > 0 ? parsed[parsed.length - 1] : null;
}

function formatCommandForLog(args) {
  return args.includes('--quiet')
    ? 'openyida [quiet command]'
    : `openyida ${args.join(' ')}`;
}

function runCli(args, env = process.env) {
  const quiet = args.includes('--quiet');
  if (!quiet) {console.log(`Running: ${formatCommandForLog(args)}`);}
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...env,
      OPENYIDA_LANG: 'zh',
      CI: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (result.status !== 0) {
    const details = quiet
      ? 'quiet command failed; inspect sanitized registry evidence'
      : (stderr.trim() || stdout.trim()).slice(0, 1600);
    throw new Error(`Command failed: ${formatCommandForLog(args)}\n${details}`);
  }
  return {
    stdout,
    stderr,
    json: parseLastJson(stdout),
  };
}

function requireSuccess(stepName, commandResult) {
  if (!commandResult.json) {
    throw new Error(`${stepName} did not emit a JSON result`);
  }
  if (commandResult.json.success === false || commandResult.json.status === 'error') {
    throw new Error(`${stepName} failed: ${JSON.stringify(commandResult.json)}`);
  }
  return commandResult.json;
}

function requireCanvasPublishHealth(publishResult) {
  const health = publishResult && publishResult.healthCheck;
  const readback = health && health.readback;
  if (
    publishResult &&
    publishResult.publishMode === 'canvas' &&
    health && health.ok === true &&
    health.expectedPublishMode === 'canvas' &&
    readback && readback.hasYidaCodeCanvas === true &&
    Number(readback.runtimeCodeBytes) > 0
  ) {
    return publishResult;
  }
  throw new Error(`publish Canvas health check failed: ${JSON.stringify({
    publishMode: publishResult && publishResult.publishMode,
    healthCheck: health || null,
  })}`);
}

function run(options = {}) {
  const env = options.env || process.env;
  const config = options.config || getConfig(env);
  const executeCli = options.runCli || runCli;
  const registryFactory = options.createRegistry || createRegistry;
  const persistRegistry = options.writeRegistry || writeRegistry;
  const trackResource = options.addResource || addResource;

  if (!ensureEnabled(config)) {
    return { skipped: true, missing: config.missing };
  }

  if (!fs.existsSync(config.fieldsFile)) {
    throw new Error(`E2E fields file not found: ${config.fieldsFile}`);
  }
  if (!config.skipPublish && !fs.existsSync(config.pageSource)) {
    throw new Error(`E2E page source not found: ${config.pageSource}`);
  }
  if (!config.skipPublish) {
    try {
      compileCanvasLocal(fs.readFileSync(config.pageSource, 'utf8'), {
        sourcePath: config.pageSource,
      });
    } catch (error) {
      throw new Error(`E2E page source is not compilable: ${config.pageSource}\n${error.message}`);
    }
  }

  const { registry, registryPath } = registryFactory(config);

  function runStep(name, args) {
    const commandResult = executeCli([...args, '--quiet'], env);
    registry.commands.push({ name, args, completedAt: new Date().toISOString() });
    persistRegistry(registryPath, registry);
    return commandResult;
  }

  try {
    requireSuccess('login check', runStep('login', ['login', '--check-only', '--json']));
    runStep('app-list', ['app-list', '--size', '1']);

    const app = requireSuccess('create app', runStep('create-app', [
      'create-app',
      config.appName,
      '--desc',
      'OpenYida real E2E disposable app',
      '--no-open',
    ]));
    trackResource(registry, registryPath, { type: 'app', appType: app.appType, name: config.appName, url: app.url });

    const form = requireSuccess('create form', runStep('create-form', [
      'create-form',
      'create',
      app.appType,
      config.formName,
      config.fieldsFile,
      '--no-open',
    ]));
    trackResource(registry, registryPath, { type: 'form', appType: app.appType, formUuid: form.formUuid, name: config.formName, url: form.url });

    requireSuccess('get schema', runStep('get-schema', ['get-schema', app.appType, form.formUuid, '--json']));
    requireSuccess('query data', runStep('query-data', ['data', 'query', 'form', app.appType, form.formUuid, '--size', '1']));

    if (!config.skipPublish) {
      const page = requireSuccess('create page', runStep('create-page', [
        'create-page',
        app.appType,
        config.pageName,
        '--mode',
        'dashboard',
        '--no-open',
      ]));
      trackResource(registry, registryPath, { type: 'page', appType: app.appType, pageId: page.pageId, name: config.pageName, url: page.url });
      const publishResult = requireSuccess('publish page', runStep('publish', [
        'publish',
        config.pageSource,
        app.appType,
        page.pageId,
        '--canvas',
        '--health-check',
        '--no-open',
      ]));
      requireCanvasPublishHealth(publishResult);
    }

    registry.status = 'passed';
    registry.finishedAt = new Date().toISOString();
    persistRegistry(registryPath, registry);
    console.log(`Real E2E passed. Registry: ${registryPath}`);
    return { skipped: false, registryPath, registry };
  } catch (error) {
    registry.status = 'failed';
    registry.finishedAt = new Date().toISOString();
    registry.error = error.message;
    persistRegistry(registryPath, registry);
    throw error;
  }
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
  addResource,
  createRegistry,
  extractJsonObjects,
  formatCommandForLog,
  getConfig,
  parseLastJson,
  requireCanvasPublishHealth,
  run,
  runCli,
  writeRegistry,
};
