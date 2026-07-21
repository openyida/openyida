'use strict';

function isSha256(value) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

module.exports = {
  isSha256,
};
