'use strict';

const { CliError } = require('./cli-error');

// Covers common emoji blocks and Dingbats/Misc Symbols such as ✅, ⚠️, 📊, 🚀.
// Keep this guard scoped to generated artifacts; CLI status output may still use
// terminal glyphs independently.
const EMOJI_PATTERN = /(?:[0-9#*]\uFE0F?\u20E3|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}](?:\uFE0F|\uFE0E)?(?:\u200D[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}](?:\uFE0F|\uFE0E)?)*)/gu;

function normalizeArtifactName(value) {
  return String(value || 'artifact');
}

function getLineInfo(text, index) {
  const before = text.slice(0, index);
  const line = before.split(/\r\n|\r|\n/).length;
  const lineStart = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r')) + 1;
  const nextNewline = text.indexOf('\n', index);
  const lineEnd = nextNewline >= 0 ? nextNewline : text.length;
  const column = index - lineStart + 1;
  return {
    line,
    column,
    excerpt: compactExcerpt(text.slice(lineStart, lineEnd), column),
  };
}

function compactExcerpt(lineText, column) {
  const normalized = String(lineText || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= 120) {
    return normalized;
  }
  const center = Math.max(0, column - 1);
  const start = Math.max(0, center - 45);
  const end = Math.min(normalized.length, start + 110);
  return (start > 0 ? '...' : '') + normalized.slice(start, end) + (end < normalized.length ? '...' : '');
}

function findEmojiInText(text, options = {}) {
  const source = String(text || '');
  const artifact = normalizeArtifactName(options.artifact);
  const valuePath = options.path || options.valuePath || '';
  const maxIssues = options.maxIssues || 20;
  const issues = [];
  EMOJI_PATTERN.lastIndex = 0;

  let match;
  while ((match = EMOJI_PATTERN.exec(source)) !== null) {
    const lineInfo = getLineInfo(source, match.index);
    issues.push({
      artifact,
      path: valuePath,
      emoji: match[0],
      index: match.index,
      line: lineInfo.line,
      column: lineInfo.column,
      excerpt: lineInfo.excerpt,
    });
    if (issues.length >= maxIssues) {
      break;
    }
  }

  return issues;
}

function appendPath(parentPath, key) {
  if (typeof key === 'number') {
    return `${parentPath || '$'}[${key}]`;
  }
  if (/^[A-Za-z_$][\w$]*$/.test(String(key))) {
    return parentPath ? `${parentPath}.${key}` : String(key);
  }
  return `${parentPath || '$'}[${JSON.stringify(String(key))}]`;
}

function findEmojiInValue(value, options = {}) {
  const issues = [];
  const seen = new WeakSet();
  const maxIssues = options.maxIssues || 20;

  function visit(current, currentPath) {
    if (issues.length >= maxIssues) {
      return;
    }
    if (typeof current === 'string') {
      findEmojiInText(current, {
        artifact: options.artifact,
        path: currentPath,
        maxIssues: maxIssues - issues.length,
      }).forEach((issue) => issues.push(issue));
      return;
    }
    if (!current || typeof current !== 'object') {
      return;
    }
    if (seen.has(current)) {
      return;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, appendPath(currentPath, index)));
      return;
    }

    Object.keys(current).forEach((key) => {
      visit(current[key], appendPath(currentPath, key));
    });
  }

  visit(value, options.path || '');
  return issues;
}

function formatEmojiIssue(issue) {
  const location = issue.line
    ? `${issue.artifact}:${issue.line}:${issue.column}`
    : issue.artifact;
  const pathText = issue.path ? ` (${issue.path})` : '';
  return `${location}${pathText} contains emoji "${issue.emoji}"`;
}

function buildEmojiErrorMessage(issues, options = {}) {
  const artifact = normalizeArtifactName(options.artifact || (issues[0] && issues[0].artifact));
  const guidance = options.guidance || 'Remove emoji from generated UI copy, Schema strings, comments, filenames, and code constants. Use plain text, SVG, or icon components instead.';
  const lines = [
    `${artifact} contains emoji, which is forbidden for OpenYida generated artifacts.`,
    ...issues.slice(0, 5).map(formatEmojiIssue),
    guidance,
  ];
  if (issues.length > 5) {
    lines.splice(lines.length - 1, 0, `...and ${issues.length - 5} more emoji occurrence(s).`);
  }
  return lines.join('\n');
}

function createEmojiError(issues, options = {}) {
  return new CliError(buildEmojiErrorMessage(issues, options), {
    code: options.code || 'OPENYIDA_ARTIFACT_EMOJI_FORBIDDEN',
    details: {
      artifact: normalizeArtifactName(options.artifact || (issues[0] && issues[0].artifact)),
      issues,
    },
  });
}

function assertNoEmojiInText(text, options = {}) {
  const issues = findEmojiInText(text, options);
  if (issues.length > 0) {
    throw createEmojiError(issues, options);
  }
}

function assertNoEmojiInValue(value, options = {}) {
  const issues = findEmojiInValue(value, options);
  if (issues.length > 0) {
    throw createEmojiError(issues, options);
  }
}

module.exports = {
  EMOJI_PATTERN,
  assertNoEmojiInText,
  assertNoEmojiInValue,
  buildEmojiErrorMessage,
  createEmojiError,
  findEmojiInText,
  findEmojiInValue,
};
