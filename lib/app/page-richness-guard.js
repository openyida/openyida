'use strict';

const MIN_CONTENT_BLOCKS = 4;
const RICH_SCENES = ['workbench', 'dashboard', 'landing', 'screen'];

function lineNumberAt(source, index) {
  return String(source || '').slice(0, index).split(/\r?\n/).length;
}

function isTemplateToken(value) {
  return /^\{\{[A-Z0-9_]+\}\}$/.test(String(value || '').trim());
}

function readAnnotation(source, name) {
  const text = String(source || '');
  const pattern = new RegExp(`@openyida-${name}\\s+([^\\r\\n*]+)`, 'i');
  const match = text.match(pattern);
  if (!match) {
    return null;
  }
  return {
    value: match[1].trim(),
    line: lineNumberAt(text, match.index),
  };
}

function parseList(value) {
  const raw = String(value || '').trim();
  if (!raw || isTemplateToken(raw)) {
    return null;
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferScene(source) {
  const scene = readAnnotation(source, 'scene');
  if (scene && scene.value) {
    return scene.value;
  }
  const text = String(source || '');
  if (/工作台|业务首页|系统首页|运营台|任务中心|workbench/i.test(text)) {
    return 'workbench';
  }
  if (/数据看板|经营看板|驾驶舱|dashboard/i.test(text)) {
    return 'dashboard';
  }
  if (/官网|落地页|品牌首页|landing/i.test(text)) {
    return 'landing';
  }
  if (/大屏|态势|实时监控|screen/i.test(text)) {
    return 'screen';
  }
  return '';
}

function findPageRichnessIssues(source) {
  const text = String(source || '');
  const scene = inferScene(text);
  if (!RICH_SCENES.includes(scene)) {
    return [];
  }

  const annotation = readAnnotation(text, 'content-blocks');
  if (!annotation) {
    return [{
      line: 1,
      type: 'missing',
      count: 0,
      min: MIN_CONTENT_BLOCKS,
      scene,
    }];
  }

  const blocks = parseList(annotation.value);
  if (blocks === null) {
    return [];
  }
  if (blocks.length >= MIN_CONTENT_BLOCKS) {
    return [];
  }

  return [{
    line: annotation.line,
    type: 'too-few',
    count: blocks.length,
    min: MIN_CONTENT_BLOCKS,
    scene,
  }];
}

function formatPageRichnessMessage(issue) {
  const count = issue && Number.isFinite(issue.count) ? issue.count : 0;
  const min = issue && Number.isFinite(issue.min) ? issue.min : MIN_CONTENT_BLOCKS;
  if (issue && issue.type === 'missing') {
    return `展示型页面必须声明 @openyida-content-blocks，且至少包含 ${min} 个有业务目的的内容区块；KPI 组、快捷入口组、列表组各只算 1 个区块。`;
  }
  return `展示型页面至少需要 ${min} 个有业务目的的内容区块；KPI 组、快捷入口组、列表组各只算 1 个区块，当前只有 ${count} 个。`;
}

module.exports = {
  MIN_CONTENT_BLOCKS,
  RICH_SCENES,
  findPageRichnessIssues,
  formatPageRichnessMessage,
};
