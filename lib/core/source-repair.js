'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const REPAIR_POLICY = Object.freeze({ unchangedRetryAllowed: false, maxAttemptsWithoutProgress: 2 });

// Stateless diagnostics for the caller's repair loop. Do not block deliberate
// CLI invocations or persist counters across independent tasks.
function withSourceRepair(error, files, args = []) {
  if (!error?.isCliError) { return error; }
  const inputs = [...new Set(files.filter(Boolean).map(file => path.resolve(file)))].map(sourcePath => {
    try { return { sourcePath, hash: digest(fs.readFileSync(sourcePath, 'utf8')) }; }
    catch { return { sourcePath, hash: null }; }
  });
  const details = error.details || {};
  const issues = (details.issues || [{ path: details.path || details.field, code: details.issue || error.code }])
    .map(issue => {
      const flag = /^visualStyle(?:\.|$)/.test(issue.path || '') ? '--visual-file'
        : /^(?:overview|dataModels|businessFlows|pages|execution|meta\.(?:businessDomain|experienceTopology))(?:\.|\[|$)/.test(issue.path || '') ? '--business-file' : null;
      const file = flag && args.includes(flag) ? args[args.indexOf(flag) + 1]
        : flag && args.includes('--from-preview') && inputs[0] ? path.join(path.dirname(inputs[0].sourcePath), 'preview/.state.json') : null;
      return { ...issue, code: issue.code || error.code,
        path: !issue.sourcePath && file ? `facts.${issue.path}` : issue.path,
        sourcePath: issue.sourcePath || details.sourcePath || (file ? path.resolve(file) : inputs[0]?.sourcePath),
      };
    });
  error.details = { ...details, issues, repair: {
    inputs, inputHash: digest({ inputs, args }),
    errorHash: digest({ code: error.code, issues }),
    ...REPAIR_POLICY,
  } };
  return error;
}

module.exports = { withSourceRepair, REPAIR_POLICY };
