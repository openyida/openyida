'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { parseDesignDocument } = require('../design/document');

function invalid(code, details = {}) {
  throw new CliError(code, { code, details });
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function minimumSize(asset) {
  const match = typeof asset.minSize === 'string' && asset.minSize.match(/^(\d+)x(\d+)$/i);
  if (asset.minSize !== undefined && !match) {
    invalid('ASSET_INVALID_SIZE', { slotId: asset.slotId, field: 'minSize', minSize: asset.minSize, expected: 'widthxheight string, e.g. 1600x900' });
  }
  const values = [asset.minWidth ?? 0, asset.minHeight ?? 0];
  const declared = match ? [Number(match[1]), Number(match[2])] : [0, 0];
  if ([...values, ...declared].some(value => !Number.isSafeInteger(value) || value < 0) || (match && declared.some(value => !value))) {
    invalid('ASSET_INVALID_SIZE', { slotId: asset.slotId });
  }
  return { minWidth: Math.max(values[0], declared[0]), minHeight: Math.max(values[1], declared[1]) };
}

function readDesignAssetStrategy(file) {
  let markdown;
  try { markdown = fs.readFileSync(file, 'utf8'); } catch (error) {
    invalid('ASSET_DESIGN_INVALID', { file, reason: error.message });
  }
  try {
    const strategy = parseDesignDocument(markdown, { legacyTokenValues: true }).metadata.assetStrategy;
    if (!object(strategy) || !Array.isArray(strategy.pages)) {throw new Error('assetStrategy.pages must be an array');}
    return strategy;
  } catch (error) {
    invalid('ASSET_DESIGN_INVALID', { file, field: 'assetStrategy', reason: error.message });
  }
}

function validateDeliveryOptions(asset) {
  const slotId = asset.slotId;
  for (const field of ['hotlinkAllowed', 'rehostAllowed']) {
    if (asset[field] !== undefined && typeof asset[field] !== 'boolean') {
      invalid('ASSET_INPUT_INVALID', { slotId, field, expected: 'boolean' });
    }
  }
  if (asset.deliveryMode !== undefined && !['auto', 'upload'].includes(asset.deliveryMode)) {
    invalid('ASSET_INPUT_INVALID', { slotId, field: 'deliveryMode', expected: 'auto|upload' });
  }
}

function validateSourceRecords(asset) {
  const slotId = asset.slotId;
  for (const field of ['assetId', 'licenseUrl', 'licenseCheckedAt']) {
    if (asset[field] !== undefined && typeof asset[field] !== 'string') {
      invalid('ASSET_INPUT_INVALID', { slotId, field, expected: 'string' });
    }
  }
  if (asset.licenseUrl) {
    let url;
    try {url = new URL(asset.licenseUrl);} catch { /* Report malformed links below. */ }
    if (!url || !['http:', 'https:'].includes(url.protocol)) {
      invalid('ASSET_INPUT_INVALID', { slotId, field: 'licenseUrl', expected: 'HTTP(S) URL' });
    }
  }
  if (asset.licenseCheckedAt) {
    const value = asset.licenseCheckedAt;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      invalid('ASSET_INPUT_INVALID', { slotId, field: 'licenseCheckedAt', expected: 'YYYY-MM-DD' });
    }
  }
  if (asset.authorizationEvidence !== undefined
    && (!Array.isArray(asset.authorizationEvidence) || !asset.authorizationEvidence.every(nonempty))) {
    invalid('ASSET_INPUT_INVALID', { slotId, field: 'authorizationEvidence', expected: 'array of nonempty strings' });
  }
}

// The design owns page membership, required slots and minimum dimensions.
function prepareAssetPlan(assets, assetStrategy, pageId) {
  if (!Array.isArray(assets)) {invalid('ASSET_INPUT_INVALID', { field: 'assets' });}
  const seen = new Set();
  const entries = assets.map(asset => {
    if (!object(asset) || !nonempty(asset.slotId)) {invalid('ASSET_INPUT_INVALID', { field: 'assets[].slotId' });}
    const slotId = asset.slotId.trim();
    if (seen.has(slotId)) {invalid('ASSET_DUPLICATE_SLOT', { slotId });}
    seen.add(slotId);
    minimumSize(asset);
    validateDeliveryOptions(asset);
    validateSourceRecords(asset);
    return { ...asset, slotId };
  });
  if (assetStrategy === undefined) {
    if (pageId !== undefined) {invalid('ASSET_PAGE_REQUIRES_DESIGN', { pageId });}
    return { entries, pages: [], assetStrategy: undefined };
  }
  if (!object(assetStrategy) || !Array.isArray(assetStrategy.pages)) {
    invalid('ASSET_DESIGN_INVALID', { field: 'assetStrategy.pages' });
  }
  assetStrategy = { ...assetStrategy, pages: assetStrategy.pages.map(page =>
    object(page) && page.imageNeed === 'none' && page.slots === undefined ? { ...page, slots: [] } : page) };
  const pageIds = new Set();
  const slots = new Map();
  const pages = assetStrategy.pages.map(page => {
    if (!object(page) || !nonempty(page.pageId) || !['required', 'beneficial', 'none'].includes(page.imageNeed) || !Array.isArray(page.slots)) {
      invalid('ASSET_DESIGN_INVALID', { field: 'assetStrategy.pages[]' });
    }
    const pageId = page.pageId.trim();
    if (pageIds.has(pageId)) {invalid('ASSET_DUPLICATE_PAGE', { pageId });}
    pageIds.add(pageId);
    if (page.imageNeed === 'none' && page.slots.length) {invalid('ASSET_DESIGN_INVALID', { pageId, field: 'slots' });}
    const slotIds = [];
    page.slots.forEach(slot => {
      if (!object(slot) || !nonempty(slot.slotId) || !nonempty(slot.usage)) {
        invalid('ASSET_DESIGN_INVALID', { pageId, field: 'slots[].slotId/usage' });
      }
      const count = slot.count ?? 1;
      if (!Number.isInteger(count) || count < 1 || count > 100) {invalid('ASSET_DESIGN_INVALID', { pageId, slotId: slot.slotId, field: 'count' });}
      minimumSize(slot);
      validateDeliveryOptions(slot);
      validateSourceRecords(slot);
      for (let index = 0; index < count; index++) {
        const slotId = count === 1 ? slot.slotId.trim() : `${slot.slotId.trim()}[${index}]`;
        if (slots.has(slotId)) {invalid('ASSET_DUPLICATE_SLOT', { slotId });}
        slots.set(slotId, { ...slot, slotId, pageId, required: slot.required !== false });
        slotIds.push(slotId);
      }
    });
    return { pageId, imageNeed: page.imageNeed, slotIds };
  });
  for (const entry of entries) {
    if (!slots.has(entry.slotId)) {invalid('ASSET_UNDECLARED_SLOT', { slotId: entry.slotId });}
  }
  const byId = new Map(entries.map(entry => [entry.slotId, entry]));
  const planned = [...slots.values()].map(slot => {
    const entry = byId.get(slot.slotId) || {};
    const designSize = minimumSize(slot);
    const inputSize = minimumSize(entry);
    return {
      ...entry,
      ...slot,
      minWidth: Math.max(designSize.minWidth, inputSize.minWidth),
      minHeight: Math.max(designSize.minHeight, inputSize.minHeight),
    };
  });
  if (pageId !== undefined) {
    if (!nonempty(pageId) || !pageIds.has(pageId.trim())) {invalid('ASSET_PAGE_NOT_FOUND', { pageId });}
    const selectedId = pageId.trim();
    return {
      entries: planned.filter(entry => entry.pageId === selectedId),
      pages: pages.filter(page => page.pageId === selectedId),
      assetStrategy: { ...assetStrategy, pages: assetStrategy.pages.filter(page => page.pageId.trim() === selectedId) },
    };
  }
  return { entries: planned, pages, assetStrategy };
}

// The host executes search tasks; the CLI provides concrete inputs and independent output paths.
function buildAssetTasks(assetStrategy, outputDir) {
  const plan = prepareAssetPlan([], assetStrategy);
  const guidance = require('./ai-image').getMaterialSourcingGuidance();
  return plan.pages.filter(page => page.imageNeed !== 'none' && page.slotIds.length).map(page => {
    const basename = path.join(outputDir, 'asset-manifests', encodeURIComponent(page.pageId));
    const draft = `${basename}.draft.json`;
    const manifest = `${basename}.json`;
    const slots = plan.entries.filter(slot => slot.pageId === page.pageId);
    // Stable sorting preserves design order within each priority group.
    const searches = [...slots].sort((a, b) => Number(b.required) - Number(a.required)
      || Number(b.usage === 'hero') - Number(a.usage === 'hero'));
    return {
      pageId: page.pageId, skillId: 'yida-image-assets', startWhen: 'plan_confirmed',
      taskKey: path.resolve(manifest), taskState: `${basename}.task.json`,
      ...guidance.schedulingPolicy,
      collectionPolicy: guidance.collectionPolicy,
      failurePolicy: guidance.failurePolicy,
      draft, manifest,
      searches: searches.map(slot => ({
        slotId: slot.slotId, usage: slot.usage, ...minimumSize(slot),
        required: slot.required, generationAllowed: slot.generationAllowed === true, dependsOn: [],
      })),
      resolve: {
        startWhen: 'page_draft_ready', appTypeRequired: false, uploadRequiresAppType: true,
        uploadArgs: ['--app-type', '<appType>'],
        argv: ['asset', 'resolve', '--input', draft, '--manifest', manifest,
          '--design', path.join(outputDir, 'design.md'), '--page-id', page.pageId, '--json'],
      },
    };
  });
}

module.exports = { minimumSize, prepareAssetPlan, readDesignAssetStrategy, buildAssetTasks };
