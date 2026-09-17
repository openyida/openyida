import React from 'react';

// Merge this fragment into one Canvas file. Keep config outside YidaComp.
// For a standalone page without an existing router or unsaved-edit blockers.
// Only allow public enum filters; never put free text, personal data or drafts in URLs.
function normalizeCanvasViewState(config, input) {
  const filters = {};
  Object.entries(config.filters).forEach(([key, values]) => {
    filters[key] = values.includes(input.filters?.[key]) ? input.filters[key] : values[0];
  });
  const page = Number(input.page);
  return {
    view: config.views.includes(input.view) ? input.view : config.views[0],
    filters,
    page: Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1,
  };
}

function readCanvasViewState(config, href) {
  const params = new URL(href).searchParams;
  const filters = {};
  Object.keys(config.filters).forEach(key => {
    filters[key] = params.get(`${config.namespace}.filter.${key}`);
  });
  return normalizeCanvasViewState(config, {
    view: params.get(`${config.namespace}.view`),
    page: params.get(`${config.namespace}.page`),
    filters,
  });
}

function buildCanvasViewStateUrl(config, href, state) {
  const url = new URL(href);
  const normalized = normalizeCanvasViewState(config, state);
  url.searchParams.set(`${config.namespace}.view`, normalized.view);
  url.searchParams.set(`${config.namespace}.page`, String(normalized.page));
  Object.entries(normalized.filters).forEach(([key, value]) => {
    url.searchParams.set(`${config.namespace}.filter.${key}`, value);
  });
  return url.href;
}

function useCanvasViewState(config) {
  const [state, setState] = React.useState(() => readCanvasViewState(config, window.location.href));
  React.useEffect(() => {
    const restore = () => setState(readCanvasViewState(config, window.location.href));
    restore();
    window.addEventListener('popstate', restore);
    window.addEventListener('hashchange', restore);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('popstate', restore);
      window.removeEventListener('hashchange', restore);
      window.removeEventListener('pageshow', restore);
    };
  }, [config]);

  function update(patch, { replace = false } = {}) {
    // Read the current URL, so consecutive events do not reuse an old render's state.
    const current = readCanvasViewState(config, window.location.href);
    const next = normalizeCanvasViewState(config, {
      ...current, ...patch, filters: { ...current.filters, ...patch.filters },
    });
    if (next.view !== current.view || Object.keys(config.filters).some(key => next.filters[key] !== current.filters[key])) {
      next.page = 1;
    }
    if (JSON.stringify(next) === JSON.stringify(current)) { return; }
    const href = buildCanvasViewStateUrl(config, window.location.href, next);
    // Preserve platform history metadata, unrelated query parameters and the entire hash.
    window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', href);
    setState(next);
  }
  return [state, update];
}
