'use strict';

// Route the overseas service to the test-owned TLS fixture; OAuth and CLI
// argument handling remain real, and no production request is sent.
const https = require('https');
const request = https.request;
const target = new URL(process.env.OPENYIDA_TEST_SERVICE_URL);
https.request = function(options, callback) {
  if (options.hostname === 'www.yidaapps.com') {
    options = { ...options, hostname: target.hostname, port: target.port,
      headers: { ...options.headers, 'x-openyida-test-site': 'https://www.yidaapps.com' } };
  }
  return request.call(this, options, callback);
};
