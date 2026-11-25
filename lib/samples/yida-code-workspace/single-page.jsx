import React, { useEffect, useState } from 'react';

/** Build a route inside the current custom page; it does not navigate to another platform page. */
export function workspaceViewHref(view, params = {}) {
  const query = new URLSearchParams(params).toString();
  return '#/' + encodeURIComponent(view) + (query ? '?' + query : '');
}

/** Resolve a declared view. Invalid fragments return to the default view without executing a URL. */
export function readWorkspaceView(hash, routes, defaultView) {
  const [path, query = ''] = String(hash || '').replace(/^#\/?/, '').split('?');
  let key;
  try { key = decodeURIComponent(path); } catch { key = ''; }
  return { key: routes.some(route => route.key === key) ? key : defaultView, params: new URLSearchParams(query) };
}

/** One custom page owns this shell and all its internal views; only the active view mounts. */
export function WorkspaceApplication({ title, routes, defaultView, renderView }) {
  const [view, setView] = useState(() => readWorkspaceView(window.location.hash, routes, defaultView));
  useEffect(() => {
    const update = () => setView(readWorkspaceView(window.location.hash, routes, defaultView));
    window.addEventListener('hashchange', update);
    update();
    return () => window.removeEventListener('hashchange', update);
  }, [routes, defaultView]);
  return <div className="collab-app">
    <aside className="app-aside">
      <div className="app-brand">{title}</div>
      <nav aria-label="应用页面">{routes.map(route => <a key={route.key}
        className={view.key === route.key ? 'app-nav active' : 'app-nav'}
        aria-current={view.key === route.key ? 'page' : undefined}
        href={workspaceViewHref(route.key)}>{route.title}</a>)}</nav>
    </aside>
    <div className="workspace-view">{renderView(view)}</div>
  </div>;
}
