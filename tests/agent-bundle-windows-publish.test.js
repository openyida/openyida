'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { materializeBundle, verifyBundle } = require('../lib/agent/frozen-bundle');
const { createBundleFixture, removeFixture } = require('./helpers/agent-bundle-fixture');

const windowsTest = process.platform === 'win32' ? test : test.skip;
describe('Windows bundle atomic publication', () => {
  let root;
  afterEach(() => {jest.restoreAllMocks(); if (root) {removeFixture(root);}});
  windowsTest.each([1, Infinity])('handles %s transient publication failures without replacing existing bundles', (failures) => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-publish-')));
    const fixture = createBundleFixture(root);
    const original = fs.renameSync;
    let attempts = 0;
    jest.spyOn(fs, 'renameSync').mockImplementation((source, target) => {
      if (path.basename(source).startsWith('.staging-') && ++attempts <= failures) {
        throw Object.assign(new Error('temporary directory sharing conflict'), { code: 'EPERM' });
      }
      return original(source, target);
    });
    const freeze = () => materializeBundle(fixture.runtime, fixture.config);
    if (failures === Infinity) {
      expect(freeze).toThrow(expect.objectContaining({ code: 'AGENT_BUNDLE_INVALID' }));
      expect(attempts).toBe(6);
      expect(fs.readdirSync(path.join(fixture.config.stateDir, 'bundles'))).toEqual([]);
    } else {
      const frozen = freeze();
      expect(attempts).toBe(2);
      expect(verifyBundle(frozen.config.bundle.root, frozen.config.bundle.id)).toBeTruthy();
    }
  });
});
