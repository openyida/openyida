'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  detectImageGenerator,
  getFreeStockLibraries,
  getMaterialSourcingGuidance,
  FREE_STOCK_LIBRARIES,
} = require('../lib/asset/ai-image');
const {
  resolveAssets,
  resolveOne,
  isHttpUrl,
  isLocalFile,
  getExternalDeliveryPolicy,
} = require('../lib/asset/asset-resolve');
const { parseArgs: parseAssetArgs } = require('../lib/asset/asset-cmd');
const {
  readDeclaredCapability,
  buildHostAssetCapabilities,
} = require('../lib/asset/host-capabilities');

describe('host asset capabilities', () => {
  test('enables asset search for a verified non-cloud runtime', () => {
    const capabilities = buildHostAssetCapabilities({
      env: {},
      runtime: { tool: 'codex', runtime: 'desktop_shell', subtype: 'codex' },
    });

    expect(capabilities.online_search).toEqual({
      status: 'available',
      available: true,
      source: 'non_cloud_runtime_default',
    });
    expect(capabilities.image_search).toEqual(capabilities.online_search);
    expect(capabilities.image_generation.available).toBeNull();
    expect(capabilities.requires_host_tool_inventory_check).toBe(true);
    expect(capabilities.host.class).toBe('non_cloud');
  });

  test('enables generation for QwenWork and keeps cloud search inventory-driven', () => {
    const cloud = buildHostAssetCapabilities({
      env: {},
      runtime: { tool: 'qwenwork', runtime: 'web_sandbox', subtype: 'qwenwork_web' },
    });

    expect(cloud.image_generation).toEqual({
      status: 'available',
      available: true,
      source: 'qwenwork_runtime_default',
    });
    expect(cloud.image_search.available).toBeNull();
    expect(cloud.host.class).toBe('managed_cloud');

    const local = buildHostAssetCapabilities({
      env: {},
      runtime: { tool: 'qwenwork', runtime: 'desktop_shell', subtype: 'qwenwork_desktop' },
    });
    expect(local.online_search.available).toBe(true);
    expect(local.image_search.available).toBe(true);
    expect(local.image_generation.available).toBe(true);
    expect(local.requires_host_tool_inventory_check).toBe(false);
  });

  test('accepts explicit independent declarations ahead of runtime defaults', () => {
    const capabilities = buildHostAssetCapabilities({
      env: {
        OPENYIDA_AGENT_ONLINE_SEARCH: 'true',
        OPENYIDA_AGENT_IMAGE_SEARCH: '0',
        OPENYIDA_AGENT_IMAGE_GENERATION: 'available',
      },
      runtime: { tool: 'qwenwork', runtime: 'web_sandbox', subtype: 'qwenwork_web' },
    });

    expect(capabilities.online_search.available).toBe(true);
    expect(capabilities.image_search.available).toBe(false);
    expect(capabilities.image_generation.available).toBe(true);
    expect(capabilities.requires_host_tool_inventory_check).toBe(false);
    expect(readDeclaredCapability('unexpected').status).toBe('unknown');
  });

  test('honors an explicit managed-cloud marker for otherwise local runtimes', () => {
    const capabilities = buildHostAssetCapabilities({
      env: { OPENYIDA_MANAGED_RUNTIME: 'cloud' },
      runtime: { tool: 'codex', runtime: 'desktop_shell', subtype: 'codex' },
    });

    expect(capabilities.host.class).toBe('managed_cloud');
    expect(capabilities.online_search.available).toBeNull();
    expect(capabilities.image_search.available).toBeNull();
  });
});

describe('ai-image (honest, agent-delegated image sourcing)', () => {
  test('detectImageGenerator is unavailable by default and delegates to agent', () => {
    const g = detectImageGenerator();
    expect(g.available).toBe(false);
    expect(g.delegateToAgent).toBe(true);
    expect(typeof g.reason).toBe('string');
    expect(g.reason).toMatch(/文生图|素材库|asset resolve/);
  });

  test('detectImageGenerator honors an explicit image-gen connector', () => {
    const g = detectImageGenerator({ hasImageGenConnector: true });
    expect(g.available).toBe(true);
    expect(g.delegateToAgent).toBe(false);
  });

  test('detectImageGenerator accepts an explicit host image generation capability', () => {
    const g = detectImageGenerator({
      hostCapabilities: buildHostAssetCapabilities({
        env: { OPENYIDA_AGENT_IMAGE_GENERATION: '1' },
        runtime: { tool: 'codex' },
      }),
    });
    expect(g.available).toBe(true);
    expect(g.delegateToAgent).toBe(true);
    expect(g.source).toBe('environment_declaration');
  });

  test('detectImageGenerator recognizes the QwenWork runtime default', () => {
    const g = detectImageGenerator({
      hostCapabilities: buildHostAssetCapabilities({
        env: {},
        runtime: { tool: 'qwenwork', runtime: 'web_sandbox', subtype: 'qwenwork_web' },
      }),
    });
    expect(g.available).toBe(true);
    expect(g.delegateToAgent).toBe(true);
    expect(g.source).toBe('qwenwork_runtime_default');
  });

  test('free stock libraries are free/commercial and returned as copies', () => {
    const libs = getFreeStockLibraries();
    expect(libs.length).toBe(FREE_STOCK_LIBRARIES.length);
    expect(libs.length).toBeGreaterThanOrEqual(3);
    const names = libs.map((l) => l.name);
    expect(names).toEqual(expect.arrayContaining(['Unsplash', 'Pexels']));
    libs.forEach((lib) => {
      expect(typeof lib.license).toBe('string');
      expect(typeof lib.site).toBe('string');
      expect(typeof lib.deliveryPolicy).toBe('string');
    });
    expect(libs.find((lib) => lib.name === 'Unsplash').deliveryPolicy).toMatch(/不得镜像/);
    expect(libs.find((lib) => lib.name === 'Pixabay').deliveryPolicy).toMatch(/禁止永久热链/);
    // returned as copies, not the internal objects
    libs[0].name = 'MUTATED';
    expect(getFreeStockLibraries()[0].name).not.toBe('MUTATED');
  });

  test('material sourcing guidance carries steps, libraries and hard rules', () => {
    const g = getMaterialSourcingGuidance();
    expect(Array.isArray(g.steps)).toBe(true);
    expect(g.steps.length).toBeGreaterThan(0);
    expect(g.libraries.length).toBeGreaterThan(0);
    const rulesText = g.rules.join('\n');
    expect(rulesText).toMatch(/绝不编造图片 URL/);
    expect(rulesText).toMatch(/无 CDN 时不得声称/);
  });
});

describe('asset-resolve helpers', () => {
  test('isHttpUrl distinguishes http(s) from local refs', () => {
    expect(isHttpUrl('https://images.unsplash.com/photo-1')).toBe(true);
    expect(isHttpUrl('http://example.com/a.png')).toBe(true);
    expect(isHttpUrl('./local/hero.png')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
  });

  test('isLocalFile only returns true for real files on disk', () => {
    expect(isLocalFile('https://example.com/a.png')).toBe(false);
    expect(isLocalFile('/definitely/not/here/xyz.png')).toBe(false);
    const tmp = path.join(os.tmpdir(), `openyida-asset-${Date.now()}.png`);
    fs.writeFileSync(tmp, 'fake');
    try {
      expect(isLocalFile(tmp)).toBe(true);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
});

describe('resolveOne (controlled ctx, no network)', () => {
  test('provider delivery policies distinguish required hotlinking and self-hosting', () => {
    expect(getExternalDeliveryPolicy('https://images.unsplash.com/photo-1')).toBe('hotlink-only');
    expect(getExternalDeliveryPolicy('https://cdn.pixabay.com/photo/2020/x.jpg')).toBe('self-host-required');
    expect(getExternalDeliveryPolicy('https://images.pexels.com/photos/1/x.jpg')).toBe('standard');
  });

  test('Unsplash API image remains hotlinked even when mirroring was requested', async () => {
    const uploadFn = jest.fn();
    const downloadFn = jest.fn();
    const r = await resolveOne('https://images.unsplash.com/photo-1', {
      canUpload: true,
      mirrorExternal: true,
      uploadFn,
      downloadFn,
      verifyFn: async url => ({ ok: true, finalUrl: url }),
    });
    expect(r).toMatchObject({
      resolved: true,
      source: 'external',
      deliveryPolicy: 'hotlink-only',
      reason: 'OK_HOTLINK_REQUIRED',
    });
    expect(downloadFn).not.toHaveBeenCalled();
    expect(uploadFn).not.toHaveBeenCalled();
  });

  test('Pixabay API image is not final until explicit self-hosting is available', async () => {
    const r = await resolveOne('https://cdn.pixabay.com/photo/2020/x.jpg', {
      canUpload: false,
      mirrorExternal: false,
      verifyFn: async url => ({ ok: true, finalUrl: url }),
    });
    expect(r).toMatchObject({
      resolved: false,
      deliveryPolicy: 'self-host-required',
      reason: 'PROVIDER_REQUIRES_SELF_HOSTING',
    });
  });

  test('empty candidate is an empty gap', async () => {
    const r = await resolveOne('', { canUpload: false });
    expect(r.resolved).toBe(false);
    expect(r.reason).toBe('EMPTY');
  });

  test('non-existent local ref is NOT_FOUND, never fabricated', async () => {
    const r = await resolveOne('assets/missing-hero.png', { canUpload: true });
    expect(r.resolved).toBe(false);
    expect(r.reason).toBe('NOT_FOUND');
  });

  test('local file without CDN is a LOCAL_NO_CDN gap (no phantom upload)', async () => {
    const tmp = path.join(os.tmpdir(), `openyida-local-${Date.now()}.png`);
    fs.writeFileSync(tmp, 'fake');
    try {
      const r = await resolveOne(tmp, { canUpload: false });
      expect(r.resolved).toBe(false);
      expect(r.reason).toBe('LOCAL_NO_CDN');
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });

  test('local file WITH CDN is uploaded via injected uploadFn', async () => {
    const tmp = path.join(os.tmpdir(), `openyida-up-${Date.now()}.png`);
    fs.writeFileSync(tmp, 'fake');
    const uploadFn = jest.fn(async (files) => [
      { success: true, originalPath: files[0], cdnUrl: 'https://cdn.example.com/x.png' },
    ]);
    try {
      const r = await resolveOne(tmp, { canUpload: true, uploadFn });
      expect(uploadFn).toHaveBeenCalledWith([tmp]);
      expect(r.resolved).toBe(true);
      expect(r.source).toBe('cdn');
      expect(r.url).toBe('https://cdn.example.com/x.png');
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
});

describe('asset command parsing', () => {
  test('resolve accepts --upload-assets for external mirroring', () => {
    const parsed = parseAssetArgs([
      'resolve',
      '--hero',
      'https://images.example.com/hero.jpg',
      '--product',
      'https://images.example.com/product.jpg',
      '--upload-assets',
      '--require-hero',
      '--json',
    ]);
    expect(parsed.subCommand).toBe('resolve');
    expect(parsed.uploadAssets).toBe(true);
    expect(parsed.requireHero).toBe(true);
    expect(parsed.hero).toBe('https://images.example.com/hero.jpg');
    expect(parsed.products).toEqual(['https://images.example.com/product.jpg']);
  });
});

describe('resolveAssets material gating (no network)', () => {
  test('requireHero with no material yields materialStatus none', async () => {
    const r = await resolveAssets({}, { requireHero: true, online: false });
    expect(r.materialStatus).toBe('none');
    expect(r.materialGaps.length).toBeGreaterThan(0);
    expect(r.assets.heroImage).toBe('');
  });

  test('no image required and none provided is final', async () => {
    const r = await resolveAssets({}, { requireHero: false, online: false });
    expect(r.materialStatus).toBe('final');
    expect(r.materialGaps).toEqual([]);
  });

  test('missing local hero degrades to none and never fabricates a url', async () => {
    const r = await resolveAssets(
      { heroImage: 'assets/missing.png' },
      { requireHero: true, online: false }
    );
    expect(r.materialStatus).toBe('none');
    expect(r.assets.heroImage).toBe('');
    expect(r.materialGaps.join('\n')).toMatch(/NOT_FOUND/);
  });

  test('resolved local hero via CDN uploadFn is final', async () => {
    const tmp = path.join(os.tmpdir(), `openyida-hero-${Date.now()}.png`);
    fs.writeFileSync(tmp, 'fake');
    const uploadFn = jest.fn(async (files) => [
      { success: true, originalPath: files[0], cdnUrl: 'https://cdn.example.com/hero.png' },
    ]);
    try {
      const r = await resolveAssets(
        { heroImage: tmp },
        { requireHero: true, online: false, uploadFn }
      );
      expect(uploadFn).toHaveBeenCalledWith([tmp]);
      expect(r.materialStatus).toBe('final');
      expect(r.assets.heroImage).toBe('https://cdn.example.com/hero.png');
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });

  test('verified external hero can be mirrored to CDN when requested', async () => {
    const tmp = path.join(os.tmpdir(), `openyida-mirror-${Date.now()}.png`);
    fs.writeFileSync(tmp, 'fake-png');
    const verifyFn = jest.fn(async (url) => ({
      url,
      ok: true,
      status: 200,
      contentType: 'image/png',
      bytes: 8,
      reason: 'OK',
      finalUrl: url,
    }));
    const downloadFn = jest.fn(async () => tmp);
    const uploadFn = jest.fn(async (files) => [
      { success: true, originalPath: files[0], cdnUrl: 'https://cdn.example.com/mirrored-hero.png' },
    ]);
    try {
      const r = await resolveAssets(
        { heroImage: 'https://images.example.com/hero.png' },
        { requireHero: true, mirrorExternal: true, verifyFn, downloadFn, uploadFn }
      );
      expect(verifyFn).toHaveBeenCalledWith('https://images.example.com/hero.png', expect.any(Object));
      expect(downloadFn).toHaveBeenCalledWith('https://images.example.com/hero.png', expect.any(Object));
      expect(uploadFn).toHaveBeenCalledTimes(1);
      expect(r.materialStatus).toBe('final');
      expect(r.actions[0].source).toBe('cdn-mirrored');
      expect(r.assets.heroImage).toBe('https://cdn.example.com/mirrored-hero.png');
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
});
