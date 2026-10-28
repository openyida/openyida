'use strict';

// Self-contained so generated runtime fixtures can embed it in their source.
function writeStartupReceipt(config, ready = true) {
  const fs = require('fs');
  const path = require('path');
  const name = 'startup-' + config.startupId + '.json';
  const pending = path.join(config.stateDir, '.' + name + '.tmp');
  const target = path.join(config.stateDir, name);
  fs.writeFileSync(pending, JSON.stringify({ protocolVersion: 1, startupId: config.startupId, ready }), { mode: 0o600 });
  fs.renameSync(pending, target);
}

module.exports = { writeStartupReceipt };
