'use strict';

/**
 * Slice A readback public API.
 * Definition preflight remains the responsibility of
 * lib/process/services/process-compiler.js#compileProcessDefinition.
 */

const { normalizeReadback, normalizeViewReadback } = require('./normalize');
const { verifyContract, verifyViewContract } = require('./validate');

module.exports = {
  normalizeReadback,
  normalizeViewReadback,
  verifyContract,
  verifyViewContract,
};
