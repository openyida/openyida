'use strict';

const { detectActiveTool } = require('../core/utils');

const BUILDER_AI_SOURCE_FALLBACK = 'local';
const SUPPORTED_BUILDER_AI_SOURCES = new Set([
  BUILDER_AI_SOURCE_FALLBACK,
  'codex',
  'qwenwork',
  'qoderwork',
  'qoder',
  'mulerun',
  'claude-code',
  'opencode',
  'cursor',
]);

function normalizeBuilderAiSource(source) {
  const normalized = String(source || '').trim().toLowerCase();
  return SUPPORTED_BUILDER_AI_SOURCES.has(normalized) ? normalized : null;
}

function resolveBuilderAiSource() {
  try {
    const activeTool = detectActiveTool();
    return normalizeBuilderAiSource(activeTool && activeTool.tool) || BUILDER_AI_SOURCE_FALLBACK;
  } catch (err) {
    return BUILDER_AI_SOURCE_FALLBACK;
  }
}

module.exports = {
  BUILDER_AI_SOURCE_FALLBACK,
  SUPPORTED_BUILDER_AI_SOURCES,
  normalizeBuilderAiSource,
  resolveBuilderAiSource,
};
