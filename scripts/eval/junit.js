'use strict';

/**
 * JUnit XML report generator for OpenYida evaluations.
 *
 * Generates JUnit-compatible XML output for CI integration (Jenkins, GitHub Actions, etc.).
 * Ported from skill-up's JUnit report format.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeAttr(str) {
  return escapeXml(str);
}

// ---------------------------------------------------------------------------
// JUnit XML builder
// ---------------------------------------------------------------------------

function renderJunitXml(options) {
  const opts = options || {};
  const suiteName = opts.suiteName || 'openyida-eval';
  const results = opts.results || [];
  const timestamp = opts.timestamp || new Date().toISOString();

  let passed = 0, failed = 0, errored = 0, skipped = 0;
  let totalTime = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    switch (r.status) {
      case 'PASS': passed++; break;
      case 'FAIL': failed++; break;
      case 'ERROR': errored++; break;
      case 'SKIP': skipped++; break;
      default: errored++;
    }
    totalTime += (r.durationMs || 0) / 1000;
  }

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<testsuites name="' + escapeAttr(suiteName) + '" tests="' + results.length +
    '" failures="' + failed + '" errors="' + errored + '" skipped="' + skipped +
    '" time="' + totalTime.toFixed(3) + '" timestamp="' + escapeAttr(timestamp) + '">');

  // Group by configuration
  const groups = groupByConfiguration(results);
  const groupNames = Object.keys(groups);

  for (let g = 0; g < groupNames.length; g++) {
    const groupName = groupNames[g];
    const groupResults = groups[groupName];
    let gPassed = 0, gFailed = 0, gErrored = 0, gSkipped = 0, gTime = 0;

    for (let gi = 0; gi < groupResults.length; gi++) {
      const gr = groupResults[gi];
      switch (gr.status) {
        case 'PASS': gPassed++; break;
        case 'FAIL': gFailed++; break;
        case 'ERROR': gErrored++; break;
        case 'SKIP': gSkipped++; break;
        default: gErrored++;
      }
      gTime += (gr.durationMs || 0) / 1000;
    }

    lines.push('  <testsuite name="' + escapeAttr(suiteName + '.' + groupName) +
      '" tests="' + groupResults.length + '" failures="' + gFailed +
      '" errors="' + gErrored + '" skipped="' + gSkipped +
      '" time="' + gTime.toFixed(3) + '" timestamp="' + escapeAttr(timestamp) + '">');

    for (let ci = 0; ci < groupResults.length; ci++) {
      lines.push(renderTestCase(groupResults[ci], suiteName + '.' + groupName));
    }

    lines.push('  </testsuite>');
  }

  lines.push('</testsuites>');
  return lines.join('\n');
}

function groupByConfiguration(results) {
  const groups = {};
  for (let i = 0; i < results.length; i++) {
    const config = results[i].configuration || 'default';
    if (!groups[config]) { groups[config] = []; }
    groups[config].push(results[i]);
  }
  return groups;
}

function renderTestCase(result, classname) {
  const time = ((result.durationMs || 0) / 1000).toFixed(3);
  const name = result.caseId || result.caseName || 'unknown';

  const lines = [];
  lines.push('    <testcase name="' + escapeAttr(name) +
    '" classname="' + escapeAttr(classname) +
    '" time="' + time + '">');

  if (result.status === 'FAIL') {
    const failMsg = buildFailureMessage(result);
    lines.push('      <failure message="' + escapeAttr(failMsg.summary) +
      '" type="AssertionFailure">');
    lines.push(escapeXml(failMsg.detail));
    lines.push('      </failure>');
  } else if (result.status === 'ERROR') {
    const errMsg = result.error || 'execution error';
    lines.push('      <error message="' + escapeAttr(errMsg) + '" type="ExecutionError">');
    lines.push(escapeXml(errMsg));
    lines.push('      </error>');
  } else if (result.status === 'SKIP') {
    const skipMsg = (result.grading && result.grading.skipReason) || 'skipped';
    lines.push('      <skipped message="' + escapeAttr(skipMsg) + '"/>');
  }

  // System output
  if (result.finalMessage) {
    lines.push('      <system-out>');
    lines.push(escapeXml(result.finalMessage.slice(0, 4000)));
    lines.push('      </system-out>');
  }

  lines.push('    </testcase>');
  return lines.join('\n');
}

function buildFailureMessage(result) {
  const failedAssertions = [];
  if (result.grading && result.grading.assertions) {
    for (let i = 0; i < result.grading.assertions.length; i++) {
      const a = result.grading.assertions[i];
      if (!a.passed) {
        failedAssertions.push(a.text + ': ' + a.evidence);
      }
    }
  }

  return {
    summary: failedAssertions.length > 0 ? failedAssertions[0] : 'assertion failed',
    detail: failedAssertions.join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Write JUnit XML to file
// ---------------------------------------------------------------------------

function writeJunitReport(outputPath, options) {
  const xml = renderJunitXml(options);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, xml, 'utf8');
  return outputPath;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  renderJunitXml: renderJunitXml,
  writeJunitReport: writeJunitReport,
  escapeXml: escapeXml,
};
