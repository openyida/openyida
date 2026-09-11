'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

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
  getCollectedImageProvider,
  ALLOWED_STOCK_IMAGE_PROVIDERS,
} = require('../lib/asset/asset-resolve');
const { parseArgs: parseAssetArgs } = require('../lib/asset/asset-cmd');
const { parseImageMetadata } = require('../lib/asset/image-metadata');
const { verifyImageUrl } = require('../lib/asset/url-verify');
const {
  readDeclaredCapability,
  buildHostAssetCapabilities,
} = require('../lib/asset/host-capabilities');

function pngHeader(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function uploadedImageContext() {
  return {
    canUpload: true,
    verifyFn: async url => ({ ok: true, finalUrl: url, width: 1600, height: 900, imageType: 'png' }),
    downloadFn: jest.fn(async () => {
      const file = path.join(os.tmpdir(), `asset-test-${require('crypto').randomUUID()}.png`);
      fs.writeFileSync(file, pngHeader(1600, 900));
      return file;
    }),
    uploadFn: jest.fn(async files => [{ success: true, originalPath: files[0], cdnUrl: 'https://cdn.example.com/hero.png' }]),
  };
}

function startImageServer(body, contentType = 'application/octet-stream') {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': body.length });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      url: `http://127.0.0.1:${server.address().port}/image.bin`,
    }));
  });
}

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
  test('detectImageGenerator keeps unknown distinct from unavailable', () => {
    const g = detectImageGenerator();
    expect(g.status).toBe('unknown');
    expect(g.available).toBeNull();
    expect(g.delegateToAgent).toBe(true);
    expect(typeof g.reason).toBe('string');
    expect(g.reason).toContain('图片生成能力');
  });

  test('detectImageGenerator honors an explicit unavailable declaration', () => {
    const g = detectImageGenerator({
      hostCapabilities: buildHostAssetCapabilities({
        env: { OPENYIDA_AGENT_IMAGE_GENERATION: '0' },
        runtime: { tool: 'codex', runtime: 'desktop_shell' },
      }),
    });
    expect(g.status).toBe('unavailable');
    expect(g.available).toBe(false);
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

  test('stock collection libraries are exactly Unsplash and Pexels and returned as copies', () => {
    const libs = getFreeStockLibraries();
    expect(libs.length).toBe(FREE_STOCK_LIBRARIES.length);
    const names = libs.map((l) => l.name);
    expect(names).toEqual(['Unsplash', 'Pexels']);
    libs.forEach((lib) => {
      expect(typeof lib.license).toBe('string');
      expect(typeof lib.site).toBe('string');
      expect(typeof lib.deliveryPolicy).toBe('string');
    });
    expect(libs.find((lib) => lib.name === 'Unsplash').deliveryPolicy).toContain('宜搭附件');
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
    expect(rulesText).toContain('不编造图片 URL');
    expect(rulesText).toContain('宜搭图片附件');
    expect(rulesText).toContain('联网搜图仅使用 Unsplash / Pexels');
  });
});

describe('asset-resolve helpers', () => {
  test('reads PNG dimensions from the image header', () => {
    expect(parseImageMetadata(pngHeader(1600, 900))).toEqual({
      type: 'png',
      width: 1600,
      height: 900,
    });
  });

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

describe('url image verification', () => {
  test('accepts binary content when the image magic is valid and returns dimensions', async () => {
    const { server, url } = await startImageServer(pngHeader(1200, 800));
    try {
      const result = await verifyImageUrl(url, { minWidth: 1000, minHeight: 600 });
      expect(result).toMatchObject({ ok: true, imageType: 'png', width: 1200, height: 800 });
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('rejects an image below the minimum dimensions', async () => {
    const { server, url } = await startImageServer(pngHeader(640, 360), 'image/png');
    try {
      const result = await verifyImageUrl(url, { minWidth: 1200, minHeight: 675 });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('WIDTH_TOO_SMALL');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});

describe('resolveOne (controlled ctx, no network)', () => {
  test('stock provider allowlist recognizes only Unsplash and Pexels image hosts', () => {
    expect(Object.keys(ALLOWED_STOCK_IMAGE_PROVIDERS)).toEqual(['unsplash', 'pexels']);
    expect(getCollectedImageProvider('https://images.unsplash.com/photo-1')).toBe('unsplash');
    expect(getCollectedImageProvider('https://images.pexels.com/photos/1/x.jpg')).toBe('pexels');
    expect(getCollectedImageProvider('https://cdn.pixabay.com/photo/2020/x.jpg')).toBeNull();
    expect(getCollectedImageProvider('https://images.unsplash.com.evil.example/photo.jpg')).toBeNull();
  });

  test('stock providers default to Yida attachment delivery', () => {
    expect(getExternalDeliveryPolicy('https://images.unsplash.com/photo-1')).toBe('yida-attachment');
    expect(getExternalDeliveryPolicy('https://images.pexels.com/photos/1/x.jpg')).toBe('yida-attachment');
  });

  test('collected images download and upload without an opt-in flag', async () => {
    const ctx = uploadedImageContext();
    const r = await resolveOne('https://images.unsplash.com/photo-1', ctx);
    expect(r).toMatchObject({ resolved: true, source: 'yida-attachment', reason: 'OK' });
    expect(ctx.downloadFn).toHaveBeenCalledTimes(1);
    expect(ctx.uploadFn).toHaveBeenCalledTimes(1);
  });

  test('default stock collection blocks Pixabay before URL verification', async () => {
    const verifyFn = jest.fn();
    const r = await resolveOne('https://cdn.pixabay.com/photo/2020/x.jpg', {
      canUpload: false,
      mirrorExternal: false,
      verifyFn,
    });
    expect(r).toMatchObject({
      resolved: false,
      deliveryPolicy: 'blocked',
      reason: 'STOCK_PROVIDER_NOT_ALLOWED',
      allowedProviders: ['unsplash', 'pexels'],
    });
    expect(verifyFn).not.toHaveBeenCalled();
  });

  test('stock downloads block redirects away from allowed providers', async () => {
    const { downloadUrlToTemp } = require('../lib/asset/asset-resolve');
    await expect(downloadUrlToTemp('https://images.example.com/x.jpg', { stockOnly: true }, 1))
      .rejects.toThrow('STOCK_PROVIDER_REDIRECT_NOT_ALLOWED');
  });

  test('offline mode rejects external URLs without verification', async () => {
    const verifyFn = jest.fn();
    const result = await resolveOne('https://images.pexels.com/photos/1/x.jpg', {
      online: false,
      verifyFn,
    });
    expect(result.reason).toBe('OFFLINE_EXTERNAL_URL');
    expect(verifyFn).not.toHaveBeenCalled();
  });

  test('user-provided authorized external image may use a non-stock host', async () => {
    const r = await resolveOne('https://assets.example.com/authorized.jpg', {
      ...uploadedImageContext(), assetSource: 'user',
    });
    expect(r).toMatchObject({ resolved: true, source: 'yida-attachment', provider: 'user', reason: 'OK' });
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

  test('local file without an uploader remains a gap', async () => {
    const tmp = path.join(os.tmpdir(), `openyida-local-${Date.now()}.png`);
    fs.writeFileSync(tmp, pngHeader(800, 600));
    try {
      const r = await resolveOne(tmp, { canUpload: false });
      expect(r.resolved).toBe(false);
      expect(r.reason).toBe('YIDA_ATTACHMENT_UNAVAILABLE');
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });

  test('local file uploads and verifies the returned attachment URL', async () => {
    const tmp = path.join(os.tmpdir(), `openyida-up-${Date.now()}.png`);
    fs.writeFileSync(tmp, pngHeader(800, 600));
    const uploadFn = jest.fn(async (files) => [
      { success: true, originalPath: files[0], cdnUrl: 'https://cdn.example.com/x.png' },
    ]);
    try {
      const r = await resolveOne(tmp, { ...uploadedImageContext(), online: true, uploadFn,
        verifyFn: async () => ({ ok: true, width: 800, height: 600, imageType: 'png' }),
      });
      expect(uploadFn).toHaveBeenCalledWith([tmp]);
      expect(r.resolved).toBe(true);
      expect(r.source).toBe('yida-attachment');
      expect(r.url).toBe('https://cdn.example.com/x.png');
      expect(r.width).toBe(800);
      expect(r.height).toBe(600);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });

  test('downloaded stock images can upload through the attachment flow', async () => {
    const tmp = path.join(os.tmpdir(), `openyida-unsplash-${Date.now()}.png`);
    fs.writeFileSync(tmp, pngHeader(800, 600));
    const { uploadFn, verifyFn } = uploadedImageContext();
    try {
      const result = await resolveOne(tmp, {
        assetSource: 'search',
        provider: 'unsplash',
        online: true,
        canUpload: true,
        uploadFn,
        verifyFn,
      });
      expect(result.source).toBe('yida-attachment');
      expect(uploadFn).toHaveBeenCalledWith([tmp]);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
});

describe('asset command parsing', () => {
  test('resolve accepts a generic slot', () => {
    const parsed = parseAssetArgs([
      'resolve',
      '--slot',
      'home.hero=https://images.example.com/hero.jpg',
      '--upload-assets',
      '--source',
      'user',
      '--json',
    ]);
    expect(parsed.subCommand).toBe('resolve');
    expect(parsed.uploadAssets).toBe(true);
    expect(parsed.source).toBe('user');
    expect(parsed.slots).toEqual([{
      slotId: 'home.hero',
      input: 'https://images.example.com/hero.jpg',
      required: true,
    }]);

    expect(parseAssetArgs(['resolve']).source).toBe('search');
  });

  test('resolve accepts input and output manifest paths', () => {
    const parsed = parseAssetArgs([
      'resolve',
      '--input',
      'manifest-draft.json',
      '--manifest',
      'asset-manifest.json',
    ]);
    expect(parsed.input).toBe('manifest-draft.json');
    expect(parsed.manifest).toBe('asset-manifest.json');
    expect(parsed.slots).toEqual([]);
  });

  test('does not keep hero/product compatibility arguments', () => {
    const parsed = parseAssetArgs(['resolve', '--hero', 'x.jpg', '--product', 'y.jpg']);
    expect(parsed.errors).toEqual([
      '未知参数：--hero',
      '未知参数：x.jpg',
      '未知参数：--product',
      '未知参数：y.jpg',
    ]);
  });

  test('rejects empty slot identifiers and values', () => {
    expect(parseAssetArgs(['resolve', '--slot', '=x.jpg']).errors).toHaveLength(1);
    expect(parseAssetArgs(['resolve', '--slot', 'home.hero=']).errors).toHaveLength(1);
  });
});

describe('resolveAssets manifest contract', () => {
  test('no declared slots yields materialStatus none', async () => {
    const result = await resolveAssets([], { online: false });
    expect(result.materialStatus).toBe('none');
    expect(result.assets).toEqual([]);
    expect(result.gaps).toEqual([]);
  });

  test('an invalid draft source remains a visible gap', async () => {
    const result = await resolveAssets([{
      slotId: 'home.hero',
      usage: 'hero',
      input: 'https://images.pexels.com/photos/1/x.jpg',
      source: 'other-library',
      alt: '首页主视觉',
    }], { online: true });
    expect(result.materialStatus).toBe('draft');
    expect(result.gaps[0].code).toBe('INVALID_SOURCE');
  });

  test('a missing required slot stays draft', async () => {
    const result = await resolveAssets([{
      slotId: 'home.hero',
      usage: 'hero',
      input: 'assets/missing.png',
      source: 'generated',
      alt: '首页主视觉',
    }], { online: false });
    expect(result.materialStatus).toBe('draft');
    expect(result.assets[0].url).toBe('');
    expect(result.gaps[0].code).toBe('NOT_FOUND');
  });

  test('resolved generated image produces a final manifest with dimensions', async () => {
    const tmp = path.join(os.tmpdir(), `openyida-hero-${Date.now()}.png`);
    fs.writeFileSync(tmp, pngHeader(1600, 900));
    const uploadFn = jest.fn(async files => [
      { success: true, originalPath: files[0], cdnUrl: 'https://cdn.example.com/hero.png' },
    ]);
    try {
      const result = await resolveAssets([{
        slotId: 'home.hero',
        usage: 'hero',
        input: tmp,
        source: 'generated',
        alt: '首页主视觉',
        minSize: '1200x675',
      }], { ...uploadedImageContext(), online: true, uploadFn });
      expect(result.materialStatus).toBe('final');
      expect(result.assets[0]).toMatchObject({
        slotId: 'home.hero',
        url: 'https://cdn.example.com/hero.png',
        width: 1600,
        height: 900,
        isIllustrative: true,
      });
      expect(result.capabilityEvidence).toBeDefined();
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });

  test('minimum dimensions are enforced before upload', async () => {
    const tmp = path.join(os.tmpdir(), `openyida-small-${Date.now()}.png`);
    fs.writeFileSync(tmp, pngHeader(640, 360));
    const uploadFn = jest.fn();
    try {
      const result = await resolveAssets([{
        slotId: 'home.hero',
        usage: 'hero',
        input: tmp,
        source: 'generated',
        alt: '首页主视觉',
        minSize: '1600x900',
      }], { ...uploadedImageContext(), online: true, uploadFn });
      expect(result.materialStatus).toBe('draft');
      expect(result.gaps[0].code).toBe('WIDTH_TOO_SMALL');
      expect(uploadFn).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });

  test('search assets require traceable provider metadata', async () => {
    const verifyFn = jest.fn(async url => ({
      ok: true,
      finalUrl: url,
      width: 1600,
      height: 900,
      imageType: 'jpeg',
    }));
    const result = await resolveAssets([{
      slotId: 'home.hero',
      usage: 'hero',
      input: 'https://images.pexels.com/photos/1/x.jpg',
      source: 'search',
      alt: '首页主视觉',
    }], { ...uploadedImageContext(), online: true, verifyFn });
    expect(result.materialStatus).toBe('draft');
    expect(result.gaps[0]).toMatchObject({ code: 'MISSING_METADATA' });
    expect(result.gaps[0].message).toMatch(/sourcePage, creator, license, attribution/);
  });

  test('Unsplash requires download tracking before final', async () => {
    const asset = {
      slotId: 'home.hero',
      usage: 'hero',
      input: 'https://images.unsplash.com/photo-1',
      source: 'search',
      sourcePage: 'https://unsplash.com/photos/example',
      creator: 'Example Creator',
      license: 'Unsplash License',
      attribution: 'Photo by Example Creator on Unsplash',
      downloadLocation: 'https://api.unsplash.com/photos/example/download',
      alt: '首页主视觉',
    };
    const verifyFn = async url => ({
      ok: true,
      finalUrl: url,
      width: 1600,
      height: 900,
      imageType: 'jpeg',
    });
    const draft = await resolveAssets([asset], { ...uploadedImageContext(), online: true, verifyFn });
    expect(draft.materialStatus).toBe('draft');
    expect(draft.gaps[0].message).toContain('downloadTracked');

    const final = await resolveAssets([{ ...asset, downloadTracked: true }], { ...uploadedImageContext(), online: true, verifyFn });
    expect(final.materialStatus).toBe('final');
  });

  test('downloads slots concurrently and preserves their order', async () => {
    const ctx = uploadedImageContext();
    const pending = [];
    const downloadFn = jest.fn(url => new Promise(resolve => pending.push({ url, resolve })));
    const promise = resolveAssets([
      { slotId: 'home.first', usage: 'scene', input: 'https://assets.example.com/first.jpg', source: 'user', alt: '第一张' },
      { slotId: 'home.second', usage: 'scene', input: 'https://assets.example.com/second.jpg', source: 'user', alt: '第二张' },
    ], { ...ctx, downloadFn });
    await Promise.resolve();
    expect(downloadFn).toHaveBeenCalledTimes(2);
    for (const item of pending.reverse()) {item.resolve(await ctx.downloadFn(item.url));}
    const result = await promise;
    expect(result.assets.map(asset => asset.slotId)).toEqual(['home.first', 'home.second']);
    expect(result.materialStatus).toBe('final');
  });

  test('json mode returns a non-zero exit code for draft assets', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-manifest-'));
    const manifest = path.join(dir, 'asset-manifest.json');
    try {
      const result = spawnSync(process.execPath, [
        path.join(__dirname, '..', 'bin', 'yida.js'),
        'asset',
        'resolve',
        '--slot',
        'home.hero=assets/missing.png',
        '--source',
        'generated',
        '--manifest',
        manifest,
        '--offline',
        '--json',
      ], { encoding: 'utf8' });
      expect(result.status).toBe(2);
      const error = JSON.parse(result.stderr);
      expect(error.errorCode).toBe('ASSET_MATERIAL_NOT_FINAL');
      expect(error.details.materialStatus).toBe('draft');
      expect(result.stderr).not.toContain('[Circular]');
      expect(JSON.parse(fs.readFileSync(manifest, 'utf8')).materialStatus).toBe('draft');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('an empty input manifest writes materialStatus none successfully', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-empty-manifest-'));
    const input = path.join(dir, 'draft.json');
    const manifest = path.join(dir, 'asset-manifest.json');
    fs.writeFileSync(input, '{"assets":[]}\n');
    try {
      const result = spawnSync(process.execPath, [
        path.join(__dirname, '..', 'bin', 'yida.js'),
        'asset',
        'resolve',
        '--input',
        input,
        '--manifest',
        manifest,
        '--offline',
        '--json',
      ], { encoding: 'utf8' });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).materialStatus).toBe('none');
      expect(JSON.parse(fs.readFileSync(manifest, 'utf8')).materialStatus).toBe('none');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('status rejects resolve-only options instead of ignoring them', () => {
    const result = spawnSync(process.execPath, [
      path.join(__dirname, '..', 'bin', 'yida.js'),
      'asset',
      'status',
      '--manifest',
      'ignored.json',
      '--json',
    ], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stderr).errorCode).toBe('ASSET_INVALID_ARGUMENTS');
  });
});
