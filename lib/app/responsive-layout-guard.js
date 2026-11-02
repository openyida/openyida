'use strict';

const FIXED_WIDTH_THRESHOLD = 480;

function getLine(source, index) {
  return source.slice(0, index).split('\n').length;
}

function lineHasOptOut(source, index, marker) {
  const lineStart = source.lastIndexOf('\n', index) + 1;
  const lineEnd = source.indexOf('\n', index);
  const line = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
  return line.includes(marker);
}

/**
 * Find high-confidence responsive layout risks shared by Canvas and legacy JSX pages.
 * The checks stay advisory because viewport-owned overlays and fixed-size visualizations
 * can be intentional; authors can add the documented line marker after reviewing one.
 * @param {string} source
 * @returns {Array<{line: number, rule: string, messageKey: string, params?: Array<unknown>}>>}
 */
function findResponsiveLayoutIssues(source) {
  const text = String(source || '');
  const issues = [];

  const observerMatch = /new\s+(?:window\.)?ResizeObserver\s*\(/.exec(text);
  if (observerMatch && !/\.\s*(?:disconnect|unobserve)\s*\(/.test(text)) {
    issues.push({
      line: getLine(text, observerMatch.index),
      rule: 'resize-observer-cleanup',
      messageKey: 'publish.lint_resize_observer_cleanup',
    });
  }

  const viewportMatch = /(?:window\s*\.\s*innerWidth|matchMedia\s*\(\s*['"`]\s*\([^'"`]*(?:min|max)-width)/.exec(text);
  const hasLayoutBranch = /(?:@media|grid-template-columns|gridTemplateColumns|flex-direction|flexDirection|\bmobile\b|\bisMobile\b)/.test(text);
  const hasContainerSignal = /(?:@container|container-type|containerType|ResizeObserver|getBoundingClientRect\s*\(\s*\)\s*\.\s*width|\.\s*clientWidth\b)/.test(text);
  if (
    viewportMatch && hasLayoutBranch && !hasContainerSignal &&
    !text.includes('openyida-responsive-viewport-ok')
  ) {
    issues.push({
      line: getLine(text, viewportMatch.index),
      rule: 'responsive-viewport-only',
      messageKey: 'publish.lint_responsive_viewport_only',
    });
  }

  const fixedWidthPattern = /(?:^|[\s{;,])width\s*:\s*['"]?(\d{3,})px?['"]?(?=\s*[,;}])/gm;
  let fixedWidthMatch;
  while ((fixedWidthMatch = fixedWidthPattern.exec(text)) !== null) {
    const width = Number(fixedWidthMatch[1]);
    if (
      width >= FIXED_WIDTH_THRESHOLD &&
      !lineHasOptOut(text, fixedWidthMatch.index, 'openyida-responsive-fixed-width-ok')
    ) {
      issues.push({
        line: getLine(text, fixedWidthMatch.index),
        rule: 'responsive-fixed-width',
        messageKey: 'publish.lint_responsive_fixed_width',
        params: [width],
      });
    }
  }

  const scaleMatch = /(?:transform\s*:\s*[^;\n}]*\bscale\s*\(|\bzoom\s*:)/.exec(text);
  if (scaleMatch && !text.includes('openyida-responsive-scale-ok')) {
    issues.push({
      line: getLine(text, scaleMatch.index),
      rule: 'responsive-page-scale',
      messageKey: 'publish.lint_responsive_page_scale',
    });
  }

  return issues;
}

module.exports = {
  FIXED_WIDTH_THRESHOLD,
  findResponsiveLayoutIssues,
};
