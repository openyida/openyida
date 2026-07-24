'use strict';

const { CliError } = require('./cli-error');
const {
  EMOJI_PATTERN,
  buildEmojiErrorMessage,
  findEmojiInArtifactName,
  findEmojiInText,
  findEmojiInValue,
  formatEmojiIssue,
} = require('./no-emoji-detector');

function normalizeArtifactName(value) {
  return String(value || 'artifact');
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

function assertIssuesEmpty(issues, options) {
  if (issues.length > 0) {
    throw createEmojiError(issues, options);
  }
}

function assertNoEmojiInText(text, options = {}) {
  assertIssuesEmpty(findEmojiInText(text, options), options);
}

function assertNoEmojiInValue(value, options = {}) {
  assertIssuesEmpty(findEmojiInValue(value, options), options);
}

function assertNoEmojiInArtifactName(artifactName, options = {}) {
  assertIssuesEmpty(findEmojiInArtifactName(artifactName, options), {
    ...options,
    artifact: options.artifact || artifactName,
  });
}

module.exports = {
  EMOJI_PATTERN,
  assertNoEmojiInArtifactName,
  assertNoEmojiInText,
  assertNoEmojiInValue,
  buildEmojiErrorMessage,
  createEmojiError,
  findEmojiInArtifactName,
  findEmojiInText,
  findEmojiInValue,
  formatEmojiIssue,
};
