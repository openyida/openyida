'use strict';

// Offline only: consume one explicitly prepared summary, never crawl a project,
// credential store, conversation history, source checkout, or environment dump.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { redactString } = require('../core/redact');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

const MAX_INPUT_BYTES = 1024 * 1024;
const REPOSITORY = 'openyida/openyida';
const TEXT_FIELDS = ['title', 'summary', 'command', 'expected', 'actual', 'impact', 'tool', 'model'];
const LIST_FIELDS = ['steps', 'evidence', 'attempts'];
const INCIDENT_FIELDS = ['openyida', 'node', 'platform', 'arch', 'installation', 'browser', 'deployment', 'organizationContext'];

function incidentEnvironment(value) {
  if (value === undefined) {value = {};}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {throw invalid('object');}
  // Only explicit incident facts belong here. The reporting process may run
  // after an upgrade or on another machine; never infer incident versions.
  return Object.fromEntries(INCIDENT_FIELDS.map(key => [key, sanitizeText(value[key])]));
}

function comparisonRun(value) {
  if (value === undefined) {return { status: 'not_run', evidence: [] };}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {throw invalid('object');}
  const run = { status: ['passed', 'failed', 'not_run'].includes(value.status) ? value.status : 'not_run' };
  ['revision', 'command', 'actual'].forEach(key => {run[key] = sanitizeText(value[key]);});
  run.evidence = textList(value.evidence);
  if (run.status !== 'not_run' && (!run.command || !run.actual || !run.evidence.length)) {
    throw invalid('comparison');
  }
  return run;
}

function comparisonReport(value) {
  if (value === undefined) {value = {};}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {throw invalid('object');}
  return {
    before: comparisonRun(value.before), after: comparisonRun(value.after),
    regression: comparisonRun(value.regression), limitations: textList(value.limitations),
  };
}

function invalid(key) {
  return new CliError(t('feedback_report.' + key), { code: 'FEEDBACK_REPORT_INVALID' });
}

function sanitizeText(value) {
  if (value === undefined) {return '';}
  if (typeof value !== 'string' || value.length > 12000) {
    throw invalid('text');
  }
  return redactString(value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]'))
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[REDACTED KEY]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g, '[REDACTED TOKEN]')
    .replace(/(["']?(?:authorization|set-cookie|cookie|[\w-]*(?:token|secret|password|passwd|api[_-]?key))["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n,;}]+)/gi, '$1[REDACTED]')
    .replace(/--(?:[\w-]*(?:token|secret|password|api-key))\s+(?:"[^"]*"|'[^']*'|\S+)/gi, '[REDACTED OPTION]')
    .replace(/(?:https?:\/\/|git@)[^\s<>"')]+/gi, '[URL]')
    .replace(/(?:[A-Za-z]:[\\/]|\/)[^\s<>"'`]+/g, '[PATH]')
    .replace(/\b(?:APP_[A-Z0-9]+|FORM-[A-Z0-9-]+)\b/gi, '[RESOURCE]')
    .replace(/\b\d{17}[\dXx]\b/g, '[IDENTITY]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/\b1[3-9]\d\*{4}\d{4}\b/g, '[PHONE]')
    .split('').filter(char => char === '\n' || char === '\r' || char === '\t' || char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('')
    .trim();
}

function textList(value) {
  if (value === undefined) {return [];}
  if (!Array.isArray(value) || value.length > 40) {
    throw invalid('list');
  }
  return value.map(sanitizeText).filter(Boolean);
}

function buildReport(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('object');
  }
  const report = { schemaVersion: 1, repository: REPOSITORY };
  // Unknown fields (including raw logs, config and auth) are dropped.
  TEXT_FIELDS.forEach(key => {report[key] = sanitizeText(input[key]);});
  LIST_FIELDS.forEach(key => {report[key] = textList(input[key]);});
  if (!report.title || !report.actual) {
    throw invalid('required');
  }
  if (input.occurrenceCount !== undefined && (!Number.isSafeInteger(input.occurrenceCount) || input.occurrenceCount < 1)) {
    throw invalid('count');
  }
  report.occurrenceCount = input.occurrenceCount || null;
  report.comparison = comparisonReport(input.comparison);
  const cause = input.cause === undefined ? {} : input.cause;
  if (!cause || typeof cause !== 'object' || Array.isArray(cause)) {
    throw invalid('cause');
  }
  report.cause = {
    category: ['cli', 'skill', 'environment', 'platform', 'unknown'].includes(cause.category) ? cause.category : 'unknown',
    status: ['confirmed', 'hypothesis', 'unknown'].includes(cause.status) ? cause.status : 'unknown',
    summary: sanitizeText(cause.summary),
    evidence: textList(cause.evidence),
    nextSteps: textList(cause.nextSteps),
  };
  if (report.cause.status === 'confirmed' && (!report.cause.summary || !report.cause.evidence.length)) {
    throw invalid('confirmed');
  }
  report.screenshots = [];
  report.incidentEnvironment = incidentEnvironment(input.incidentEnvironment);
  // Retain this output contract for existing consumers: generator context only.
  report.environment = {
    openyida: require('../../package.json').version,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  };
  report.fingerprint = crypto.createHash('sha256')
    .update(JSON.stringify([report.title, report.command, report.actual]))
    .digest('hex').slice(0, 16);
  report.reviewRequired = true;
  report.submissionPerformed = false;
  return report;
}

// Escape markup so copied diagnostics cannot inject images, links or HTML in an issue.
function markdownText(value) {
  return String(value || t('feedback_report.body.unknown')).replace(/[\\`*_{}[\]<>()#!|~]/g, '\\$&');
}

function renderMarkdown(report) {
  const label = key => t('feedback_report.body.' + key);
  const incident = report.incidentEnvironment || {};
  const environmentLines = Object.entries({
    openyida: incident.openyida, node: incident.node, platform: incident.platform, arch: incident.arch,
    installation: incident.installation, tool: report.tool, model: report.model,
    ...Object.fromEntries(['browser', 'deployment', 'organizationContext']
      .filter(key => incident[key]).map(key => [key, incident[key]])),
  }).map(([key, value]) => `${key}: ${value || label('unknown')}`);
  const sections = [
    [label('summary'), report.summary || label('unknown')],
    [label('actual'), report.actual], [label('expected'), report.expected || label('unknown')],
    [label('incident'), environmentLines],
    [label('command'), report.command], [label('steps'), report.steps],
    [label('impact'), report.impact], [label('evidence'), report.evidence], [label('attempts'), report.attempts],
    ...(report.cause.summary || report.cause.status !== 'unknown' || report.cause.category !== 'unknown'
      ? [[label('cause'), `${report.cause.category} / ${report.cause.status}\n${report.cause.summary}`]] : []),
    [label('cause_evidence'), report.cause.evidence], [label('next'), report.cause.nextSteps],
    [label('screenshots'), report.screenshots.map(item => `${item.file}: ${item.description || label('review_image')}`)],
    ...(['before', 'after', 'regression'].some(key => report.comparison[key].status !== 'not_run') || report.comparison.limitations.length ? ['before', 'after', 'regression'] : []).map(key => [
      `Test comparison: ${key}`, [
        `Status: ${report.comparison[key].status}`,
        `Revision: ${report.comparison[key].revision || 'Unknown'}`,
        `Command: ${report.comparison[key].command || 'Not run'}`,
        `Actual: ${report.comparison[key].actual || 'Not verified'}`,
        ...(report.comparison[key].evidence || []),
      ],
    ]),
    ...(report.comparison.limitations.length ? [[label('limitations'), report.comparison.limitations]] : []),
    [label('generator'), Object.entries(report.environment).map(([key, value]) => `${key}: ${value}`)],
  ].filter(([, value]) => Array.isArray(value) ? value.length : Boolean(value));
  return [
    `# ${markdownText(report.title)}`, '',
    label('draft'), '',
    ...sections.flatMap(([heading, value]) => [
      `## ${heading}`, '',
      Array.isArray(value) ? value.map(item => `- ${markdownText(item)}`).join('\n') : markdownText(value), '',
    ]),
    `Fingerprint: ${report.fingerprint}`, `Observed occurrences: ${report.occurrenceCount || label('unknown')}`, '',
  ].join('\n');
}

function readScreenshots(value, inputDirectory) {
  if (value === undefined) {return [];}
  if (!Array.isArray(value) || value.length > 5) {throw invalid('screenshots');}
  return value.map((item, index) => {
    if (!item || typeof item.path !== 'string' || !item.path || item.path.length > 4096) {
      throw invalid('screenshots');
    }
    const source = path.resolve(inputDirectory, item.path);
    const stat = fs.statSync(source);
    if (!stat.isFile() || stat.size > 10 * 1024 * 1024) {throw invalid('screenshots');}
    const data = fs.readFileSync(source);
    let extension;
    if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      extension = 'png';
    } else if (data[0] === 255 && data[1] === 216 && data[2] === 255) {
      extension = 'jpg';
    } else if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
      extension = 'webp';
    } else {throw invalid('screenshots');}
    return {
      data, file: `screenshot-${String(index + 1).padStart(2, '0')}.${extension}`,
      description: sanitizeText(item.description),
    };
  });
}

function parseReportArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (!['--input', '--output-dir'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('-')) {
      throw invalid('usage');
    }
    const key = args[i] === '--input' ? 'input' : 'outputDir';
    if (options[key]) {throw invalid('duplicate');}
    options[key] = args[++i];
  }
  if (!options.input || !options.outputDir) {
    throw invalid('options');
  }
  return options;
}

function writeReport(options) {
  const inputPath = path.resolve(options.input);
  const stat = fs.statSync(inputPath);
  if (!stat.isFile() || stat.size > MAX_INPUT_BYTES) {
    throw invalid('file');
  }
  let input;
  try {
    input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch {
    throw invalid('json');
  }
  const report = buildReport(input);
  // Only explicitly selected images are read. No directory scan or screenshot capture.
  const screenshots = readScreenshots(input.screenshots, path.dirname(inputPath));
  report.screenshots = screenshots.map(({ file, description }) => ({ file, description, reviewRequired: true }));
  const body = renderMarkdown(report);
  // The problem fingerprint is for deduplication; approval must bind the exact
  // body and selected image bytes, including metadata the preview may not show.
  const reviewDigest = crypto.createHash('sha256').update(JSON.stringify({
    body,
    screenshots: screenshots.map(({ file, data }) => ({
      file, sha256: crypto.createHash('sha256').update(data).digest('hex'),
    })),
  })).digest('hex');
  report.reviewDigest = reviewDigest;
  const directory = path.resolve(options.outputDir);
  // Require a fresh destination: never replace existing evidence or follow a destination symlink.
  fs.mkdirSync(directory, { mode: 0o700 });
  const reportFile = path.join(directory, 'report.json');
  const bodyFile = path.join(directory, 'issue.md');
  screenshots.forEach(item => {
    fs.writeFileSync(path.join(directory, item.file), item.data, { mode: 0o600, flag: 'wx' });
  });
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(bodyFile, body, { mode: 0o600, flag: 'wx' });
  return {
    success: true, submissionPerformed: false, reviewRequired: true,
    reportFile, bodyFile, fingerprint: report.fingerprint, reviewDigest,
    screenshotFiles: screenshots.map(item => path.join(directory, item.file)),
    issueUrl: `https://github.com/${REPOSITORY}/issues/new`,
  };
}

module.exports = { buildReport, parseReportArgs, renderMarkdown, sanitizeText, writeReport };
