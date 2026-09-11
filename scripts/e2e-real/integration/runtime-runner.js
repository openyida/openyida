'use strict';

const { CliError } = require('../../../lib/core/cli-error');
const { t } = require('../../../lib/core/i18n');
const { RUNTIME_CASES, verifyRuntimeObservation } = require('./runtime-contracts');

function runtimeError(code, message, details = {}) {
  return new CliError(message, { code, details });
}

function assertAdapter(adapter) {
  const requiredMethods = ['prepare', 'trigger', 'readback', 'cleanup'];
  const missingMethods = requiredMethods.filter((method) => !adapter || typeof adapter[method] !== 'function');
  if (missingMethods.length > 0) {
    throw runtimeError('PLATFORM_PROBE_REQUIRED', t('integration.runtime_adapter_missing'), {
      remoteWrites: 0,
      requiredAdapterMethods: requiredMethods,
      missingAdapterMethods: missingMethods,
    });
  }
}

function summarizeOwnershipEvidence(context) {
  const evidence = context && context.ownershipEvidence;
  const proofs = evidence && Array.isArray(evidence.proofs) ? evidence.proofs : [];
  return {
    verified: Boolean(evidence && evidence.verified === true),
    resourceFingerprintPresent: Boolean(evidence && /^sha256:\S+$/u.test(evidence.resourceFingerprint || '')),
    proofCount: proofs.length,
    correlationProofPresent: Boolean(context && context.correlationMarker && proofs.some((proof) => (
      proof && typeof proof.type === 'string' && proof.type && proof.marker === context.correlationMarker
    ))),
  };
}

function assertReadOnlyOwnedPreflight(context, runtimeCase) {
  if (!context || context.remoteWrites !== 0) {
    throw runtimeError(
      'INTEGRATION_RUNTIME_PREFLIGHT_NOT_READ_ONLY',
      t('integration.runtime_preflight_not_read_only', runtimeCase.id),
      { caseId: runtimeCase.id, remoteWrites: context && context.remoteWrites }
    );
  }
  const ownership = summarizeOwnershipEvidence(context);
  if (!context.correlationMarker || !ownership.verified || !ownership.resourceFingerprintPresent
    || ownership.proofCount === 0 || !ownership.correlationProofPresent) {
    throw runtimeError(
      'INTEGRATION_RUNTIME_OWNERSHIP_UNVERIFIED',
      t('integration.runtime_ownership_unverified', runtimeCase.id),
      { caseId: runtimeCase.id, remoteWrites: 0, ownershipEvidence: ownership }
    );
  }
}

function errorEvidence(error) {
  return {
    code: error && error.code ? error.code : 'UNEXPECTED_ERROR',
    message: error && error.message ? error.message : String(error),
    details: error && error.details !== undefined ? error.details : undefined,
  };
}

function cleanupFailureEvidence(error) {
  const evidence = errorEvidence(error);
  return {
    status: 'failed',
    code: evidence.code,
    message: evidence.message,
    residual: evidence.details && Object.prototype.hasOwnProperty.call(evidence.details, 'residual')
      ? evidence.details.residual
      : { status: 'unknown' },
    details: evidence.details,
  };
}

function normalizePrimaryError(error, runtimeCase, context) {
  const reportedWrites = error && error.details && error.details.remoteWrites;
  if (!context && reportedWrites !== undefined && reportedWrites !== 0) {
    return runtimeError(
      'INTEGRATION_RUNTIME_PREFLIGHT_NOT_READ_ONLY',
      t('integration.runtime_preflight_not_read_only', runtimeCase.id),
      { caseId: runtimeCase.id, remoteWrites: reportedWrites, prepareError: errorEvidence(error) }
    );
  }
  if (error && error.isCliError) { return error; }
  return runtimeError(
    (error && error.code) || 'INTEGRATION_RUNTIME_FAILED',
    error && error.message ? error.message : String(error),
    error && error.details !== undefined ? error.details : undefined
  );
}

function withCleanupEvidence(error, cleanup) {
  error.details = {
    ...(error.details && typeof error.details === 'object' ? error.details : {}),
    cleanup,
  };
  return error;
}

async function runRuntimeCases(options = {}) {
  const adapter = options.adapter;
  assertAdapter(adapter);
  const runtimeCases = options.cases || RUNTIME_CASES;
  const results = [];
  for (const runtimeCase of runtimeCases) {
    let context;
    let ownershipVerified = false;
    let primaryError = null;
    let caseResult = null;
    try {
      context = await adapter.prepare(runtimeCase);
      assertReadOnlyOwnedPreflight(context, runtimeCase);
      ownershipVerified = true;
      const triggerResult = await adapter.trigger(runtimeCase, context);
      if (!triggerResult || triggerResult.accepted !== true) {
        throw runtimeError(
          'INTEGRATION_RUNTIME_TRIGGER_REJECTED',
          t('integration.runtime_trigger_rejected', runtimeCase.id),
          { caseId: runtimeCase.id }
        );
      }
      const observation = await adapter.readback(runtimeCase, context, triggerResult);
      const verification = verifyRuntimeObservation(runtimeCase.id, observation);
      if (!verification.valid) {
        throw runtimeError('INTEGRATION_RUNTIME_CONTRACT_FAILED', t('integration.runtime_contract_failed', runtimeCase.id), {
          caseId: runtimeCase.id,
          requiredReadbacks: runtimeCase.requiredReadbacks,
          errors: verification.errors,
        });
      }
      caseResult = {
        id: runtimeCase.id,
        nodeType: runtimeCase.nodeType,
        correlationMarker: context.correlationMarker,
        verificationLevel: verification.verificationLevel,
      };
    } catch (error) {
      primaryError = normalizePrimaryError(error, runtimeCase, context);
    }

    let cleanup = { status: 'not-run', residual: null };
    let cleanupError = null;
    if (ownershipVerified) {
      try {
        const cleanupResult = await adapter.cleanup(runtimeCase, context);
        if (cleanupResult && (cleanupResult.status === 'failed' || cleanupResult.success === false)) {
          throw runtimeError(
            'INTEGRATION_RUNTIME_CLEANUP_FAILED',
            t('integration.runtime_cleanup_failed', runtimeCase.id),
            { residual: cleanupResult.residual === undefined ? { status: 'unknown' } : cleanupResult.residual }
          );
        }
        cleanup = { status: 'passed', residual: false };
      } catch (error) {
        cleanupError = cleanupFailureEvidence(error);
        cleanup = cleanupError;
      }
    }

    if (primaryError && cleanupError) {
      throw runtimeError(
        'INTEGRATION_RUNTIME_PRIMARY_AND_CLEANUP_FAILED',
        t('integration.runtime_primary_cleanup_failed', runtimeCase.id),
        { caseId: runtimeCase.id, primary: errorEvidence(primaryError), cleanup: cleanupError }
      );
    }
    if (primaryError) {
      throw withCleanupEvidence(primaryError, cleanup);
    }
    if (cleanupError) {
      throw runtimeError(
        'INTEGRATION_RUNTIME_CLEANUP_FAILED',
        t('integration.runtime_cleanup_failed', runtimeCase.id),
        { caseId: runtimeCase.id, cleanup: cleanupError, residual: cleanupError.residual }
      );
    }
    results.push({ ...caseResult, cleanup });
  }
  return {
    status: 'passed',
    verificationLevel: 'REAL_RUNTIME_OBSERVED',
    cases: results,
  };
}

if (require.main === module) {
  runRuntimeCases().catch((error) => {
    process.stderr.write(`${error.code || 'ERROR'}: ${error.message}\n`);
    process.exitCode = error.exitCode || 1;
  });
}

module.exports = {
  assertAdapter,
  assertReadOnlyOwnedPreflight,
  runRuntimeCases,
};
