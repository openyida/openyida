'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');
const { readJson } = require('./files');

const STATE_FILE = '.build-plan-artifacts.json';
const DOCUMENTS = new Set(['prd.md', 'design.md', 'build-plan.html']);

function conflict(file, section) {
  throw new CliError(t('design_document.update_conflict', file, section), {
    code: 'DESIGN_PLAN_UPDATE_CONFLICT', details: { file, section },
  });
}

// Fixed chapter numbers and HTML section IDs survive changes to display titles.
function blocks(content, html) {
  const starts = [{ key: 'header', index: 0 }];
  if (html) {
    for (const match of content.matchAll(/<section id="(overview|data-models|business-flows|pages)" class="page-section">/g)) {
      starts.push({ key: match[1], index: match.index });
    }
    const end = content.lastIndexOf('</article>');
    if (end >= 0) {starts.push({ key: 'footer', index: end });}
  } else {
    const frontmatter = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(content);
    if (frontmatter) {starts.push({ key: 'intro', index: frontmatter[0].length });}
    let offset = 0, fence = null;
    for (const line of content.split(/(?<=\n)/)) {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (marker) {
        if (!fence) {fence = marker[1];}
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) {fence = null;}
      } else if (!fence) {
        const heading = /^## (\d+)\. /.exec(line);
        if (heading) {starts.push({ key: `chapter-${heading[1]}`, index: offset });}
      }
      offset += line.length;
    }
  }
  return starts.map((entry, index) => ({ ...entry, end: starts[index + 1]?.index ?? content.length,
    text: content.slice(entry.index, starts[index + 1]?.index) }));
}

function updateBlock(before, after, current, file, key) {
  if (current === before || current === after) {return after;}
  const oldLines = before.split(/(?<=\n)/), newLines = after.split(/(?<=\n)/);
  let start = 0, end = oldLines.length, nextEnd = newLines.length;
  while (start < end && start < nextEnd && oldLines[start] === newLines[start]) {start++;}
  while (end > start && nextEnd > start && oldLines[end - 1] === newLines[nextEnd - 1]) {end--; nextEnd--;}
  const contextStart = Math.max(0, start - 3);
  const contextEnd = Math.min(oldLines.length, end + 3);
  const needle = oldLines.slice(contextStart, contextEnd).join('');
  const replacement = [...oldLines.slice(contextStart, start), ...newLines.slice(start, nextEnd), ...oldLines.slice(end, contextEnd)].join('');
  const position = current.indexOf(needle);
  if (!needle || position < 0 || current.indexOf(needle, position + 1) >= 0) {conflict(file, key);}
  return current.slice(0, position) + replacement + current.slice(position + needle.length);
}

function mergeDocument(before, after, current, file) {
  if (before === after || current === after) {return current;}
  if (current === before) {return after;}
  const html = file.endsWith('.html');
  const oldBlocks = blocks(before, html), newBlocks = blocks(after, html), currentBlocks = blocks(current, html);
  for (const list of [oldBlocks, newBlocks, currentBlocks]) {
    if (new Set(list.map(block => block.key)).size !== list.length) {conflict(file, 'structure');}
  }
  if (oldBlocks.map(block => block.key).join() !== newBlocks.map(block => block.key).join()) {conflict(file, 'structure');}
  const edits = [];
  for (let index = 0; index < oldBlocks.length; index++) {
    const beforeBlock = oldBlocks[index], afterBlock = newBlocks[index];
    if (beforeBlock.text === afterBlock.text) {continue;}
    const currentBlock = currentBlocks.find(block => block.key === beforeBlock.key);
    if (!currentBlock) {conflict(file, beforeBlock.key);}
    edits.push({ ...currentBlock, text: updateBlock(beforeBlock.text, afterBlock.text, currentBlock.text, file, beforeBlock.key) });
  }
  let result = current;
  for (const edit of edits.sort((a, b) => b.index - a.index)) {
    result = result.slice(0, edit.index) + edit.text + result.slice(edit.end);
  }
  return result;
}

// Keep the last generated text separate from local edits, so later source changes
// can update their own sections without treating local notes as generated content.
function prepareUpdates(artifacts, outputDir, previousArtifacts) {
  const statePath = path.join(outputDir, STATE_FILE);
  let baseline = {};
  if (fs.existsSync(statePath)) {
    const state = readJson(statePath, STATE_FILE);
    if (state.version !== 1 || !state.documents || typeof state.documents !== 'object') {conflict(statePath, 'baseline');}
    baseline = state.documents;
  } else if (previousArtifacts && artifacts.files.some(([file]) => DOCUMENTS.has(path.basename(file)) && fs.existsSync(file))) {
    baseline = Object.fromEntries(previousArtifacts().files.filter(([file]) => DOCUMENTS.has(path.basename(file))).map(([file, content]) => [path.basename(file), content]));
  }
  const documents = {}, files = [], updated = [];
  for (const [file, generated] of artifacts.files) {
    const name = path.basename(file);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
    let content = generated;
    if (DOCUMENTS.has(name)) {
      documents[name] = generated;
      if (current !== undefined && current !== generated) {
        if (typeof baseline[name] !== 'string') {conflict(file, 'baseline');}
        content = mergeDocument(baseline[name], generated, current, file);
      }
    }
    if (content !== current) {files.push([file, content]); updated.push(file);}
  }
  const state = JSON.stringify({ version: 1, documents }, null, 2) + '\n';
  if (!fs.existsSync(statePath) || fs.readFileSync(statePath, 'utf8') !== state) {files.push([statePath, state]);}
  return { files, updated, previousDesign: baseline['design.md'] };
}

module.exports = { prepareUpdates, mergeDocument };
