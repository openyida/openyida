'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { warn } = require('../core/chalk');

const DEFAULT_ARTIFACT_DIR = path.resolve(
  process.cwd(),
  'project',
  '.cache',
  'e2e-real',
  'integration-update-capability'
);

const UPDATE_CAPABILITY = Object.freeze({
  capabilityId: 'integration_detail_readback_wrapper',
  verdict: 'PLATFORM_PROBE_REQUIRED',
  evidenceLocator: 'scripts/eval/integration-contract/capability-manifest.json',
  blocker: 'FULL_DEFINITION_READBACK_UNPROVEN',
});

function parseFlag(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) {
    return null;
  }
  return args[index + 1];
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function summarizeTarget(input) {
  const fields = {
    appType: `sha256:${sha256(input.appType)}`,
    formUuid: `sha256:${sha256(input.formUuid)}`,
    processCode: `sha256:${sha256(input.processCode)}`,
  };
  return {
    digest: `sha256:${sha256(JSON.stringify(fields))}`,
    fields,
  };
}

function detectIntegrationUpdateCapability() {
  return { ...UPDATE_CAPABILITY };
}

function writeCapabilityArtifact(input, options = {}) {
  const targetSummary = summarizeTarget(input);
  const artifact = {
    schemaVersion: 'openyida-integration-update-capability-v1',
    probe: {
      capabilityId: UPDATE_CAPABILITY.capabilityId,
      verdict: UPDATE_CAPABILITY.verdict,
      evidenceLocator: UPDATE_CAPABILITY.evidenceLocator,
    },
    targetSummary,
    remoteWrites: 0,
    blocker: UPDATE_CAPABILITY.blocker,
  };
  const artifactDir = options.artifactDir || DEFAULT_ARTIFACT_DIR;
  const digest = targetSummary.digest.slice('sha256:'.length);
  const artifactPath = path.join(artifactDir, `probe-${digest.slice(0, 16)}.json`);
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { artifact, artifactPath };
}

async function run(args, options = {}) {
  if (!args[0] || args[0] === '--help' || args[0] === '-h') {
    warn(t('integration.update_usage'));
    return;
  }

  const input = {
    appType: args[0],
    formUuid: args[1],
    processCode: args[2],
    specPath: parseFlag(args, '--spec'),
  };
  if (!input.appType || !input.formUuid || !input.processCode || !input.specPath) {
    throw new CliError(t('integration.update_missing_args'), {
      code: 'INTEGRATION_UPDATE_ARGUMENTS_INVALID',
      details: { usage: t('integration.update_usage'), remoteWrites: 0 },
    });
  }

  const { artifactPath } = writeCapabilityArtifact(input, options);
  throw new CliError(t('integration.update_capability_blocked'), {
    code: UPDATE_CAPABILITY.verdict,
    details: {
      capability: UPDATE_CAPABILITY.capabilityId,
      verdict: UPDATE_CAPABILITY.verdict,
      evidence: UPDATE_CAPABILITY.evidenceLocator,
      blocker: UPDATE_CAPABILITY.blocker,
      artifactPath,
      remoteWrites: 0,
    },
  });
}

module.exports = {
  detectIntegrationUpdateCapability,
  run,
  summarizeTarget,
  writeCapabilityArtifact,
};
