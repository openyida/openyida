'use strict';

// Covers common emoji blocks and Dingbats/Misc Symbols such as ✅, ⚠️, 📊, 🚀.
// Keep this detector scoped to generated artifacts; CLI status output may still
// use terminal glyphs independently.
const EMOJI_PATTERN = /(?:[0-9#*]\uFE0F?\u20E3|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}](?:\uFE0F|\uFE0E)?(?:\u200D[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}](?:\uFE0F|\uFE0E)?)*)/gu;
const HEX_DIGITS = /^[0-9a-fA-F]+$/;

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

function createIssue(source, index, emoji, options, extra) {
  const lineInfo = getLineInfo(source, index);
  return Object.assign({
    artifact: normalizeArtifactName(options.artifact),
    path: options.path || options.valuePath || '',
    emoji,
    index,
    line: lineInfo.line,
    column: lineInfo.column,
    excerpt: lineInfo.excerpt,
  }, extra || {});
}

function isEmojiCharacter(value) {
  EMOJI_PATTERN.lastIndex = 0;
  const matched = EMOJI_PATTERN.test(value);
  EMOJI_PATTERN.lastIndex = 0;
  return matched;
}

function findRawEmojiInText(source, options) {
  const issues = [];
  EMOJI_PATTERN.lastIndex = 0;

  let match;
  while ((match = EMOJI_PATTERN.exec(source)) !== null) {
    issues.push(createIssue(source, match.index, match[0], options));
  }
  return issues;
}

function readUnicodeEscapeAt(source, index) {
  if (source[index] !== '\\' || source[index + 1] !== 'u') {
    return null;
  }

  if (source[index + 2] === '{') {
    const closeIndex = source.indexOf('}', index + 3);
    if (closeIndex < 0) {
      return null;
    }
    const hex = source.slice(index + 3, closeIndex);
    if (!hex || hex.length > 6 || !HEX_DIGITS.test(hex)) {
      return null;
    }
    const codePoint = Number.parseInt(hex, 16);
    if (!Number.isFinite(codePoint) || codePoint > 0x10FFFF) {
      return null;
    }
    return {
      raw: source.slice(index, closeIndex + 1),
      codePoint,
      length: closeIndex + 1 - index,
    };
  }

  const hex = source.slice(index + 2, index + 6);
  if (hex.length !== 4 || !HEX_DIGITS.test(hex)) {
    return null;
  }
  return {
    raw: source.slice(index, index + 6),
    codePoint: Number.parseInt(hex, 16),
    length: 6,
  };
}

function isHighSurrogate(codePoint) {
  return codePoint >= 0xD800 && codePoint <= 0xDBFF;
}

function isLowSurrogate(codePoint) {
  return codePoint >= 0xDC00 && codePoint <= 0xDFFF;
}

function combineSurrogatePair(high, low) {
  return ((high - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
}

function codePointToString(codePoint) {
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return '';
  }
}

function findEscapedEmojiInText(source, options) {
  const issues = [];
  for (let index = 0; index < source.length; index++) {
    const first = readUnicodeEscapeAt(source, index);
    if (!first) {
      continue;
    }

    let raw = first.raw;
    let codePoint = first.codePoint;
    let length = first.length;

    if (isHighSurrogate(first.codePoint)) {
      const second = readUnicodeEscapeAt(source, index + first.length);
      if (second && isLowSurrogate(second.codePoint)) {
        raw += second.raw;
        codePoint = combineSurrogatePair(first.codePoint, second.codePoint);
        length += second.length;
      }
    }

    const emoji = codePointToString(codePoint);
    if (emoji && isEmojiCharacter(emoji)) {
      issues.push(createIssue(source, index, emoji, options, {
        escaped: true,
        escape: raw,
      }));
    }

    index += Math.max(length - 1, 0);
  }
  return issues;
}

function findEmojiInText(text, options = {}) {
  const source = String(text || '');
  const maxIssues = options.maxIssues || 20;
  const scanOptions = {
    artifact: normalizeArtifactName(options.artifact),
    path: options.path || options.valuePath || '',
    valuePath: options.valuePath,
  };
  return findRawEmojiInText(source, scanOptions)
    .concat(findEscapedEmojiInText(source, scanOptions))
    .sort((left, right) => left.index - right.index)
    .slice(0, maxIssues);
}

function findEmojiInArtifactName(artifactName, options = {}) {
  const artifact = normalizeArtifactName(options.artifact || artifactName);
  return findEmojiInText(String(artifactName || ''), {
    artifact,
    path: options.path || 'filePath',
    maxIssues: options.maxIssues,
  });
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
  const escapeText = issue.escape ? ` via escape "${issue.escape}"` : '';
  return `${location}${pathText} contains emoji "${issue.emoji}"${escapeText}`;
}

function buildEmojiErrorMessage(issues, options = {}) {
  const artifact = normalizeArtifactName(options.artifact || (issues[0] && issues[0].artifact));
  const guidance = options.guidance || 'Remove emoji from generated UI copy, Schema strings, comments, file paths, and code constants. Use plain text, SVG, or icon components instead.';
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

module.exports = {
  EMOJI_PATTERN,
  buildEmojiErrorMessage,
  findEmojiInArtifactName,
  findEmojiInText,
  findEmojiInValue,
  formatEmojiIssue,
};
