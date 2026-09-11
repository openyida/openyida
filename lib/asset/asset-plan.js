'use strict';

const fs = require('fs');
const { CliError } = require('../core/cli-error');

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
    invalid('ASSET_INVALID_SIZE', { slotId: asset.slotId, minSize: asset.minSize });
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
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  const lines = frontmatter ? frontmatter[1].split(/\r?\n/).filter(line => /^assetStrategy:/.test(line)) : [];
  if (lines.length !== 1) {invalid('ASSET_DESIGN_INVALID', { file, field: 'assetStrategy', format: 'single-line JSON in frontmatter' });}
  try { return JSON.parse(lines[0].slice('assetStrategy:'.length).trim()); } catch {
    invalid('ASSET_DESIGN_INVALID', { file, field: 'assetStrategy', format: 'single-line JSON in frontmatter' });
  }
}

// The design owns page membership, required slots and minimum dimensions.
function prepareAssetPlan(assets, assetStrategy) {
  if (!Array.isArray(assets)) {invalid('ASSET_INPUT_INVALID', { field: 'assets' });}
  const seen = new Set();
  const entries = assets.map(asset => {
    if (!object(asset) || !nonempty(asset.slotId)) {invalid('ASSET_INPUT_INVALID', { field: 'assets[].slotId' });}
    const slotId = asset.slotId.trim();
    if (seen.has(slotId)) {invalid('ASSET_DUPLICATE_SLOT', { slotId });}
    seen.add(slotId);
    minimumSize(asset);
    return { ...asset, slotId };
  });
  if (assetStrategy === undefined) {return { entries, pages: [], assetStrategy: undefined };}
  if (!object(assetStrategy) || !Array.isArray(assetStrategy.pages)) {
    invalid('ASSET_DESIGN_INVALID', { field: 'assetStrategy.pages' });
  }
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
  return { entries: planned, pages, assetStrategy };
}

module.exports = { minimumSize, prepareAssetPlan, readDesignAssetStrategy };
