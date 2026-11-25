import React from 'react';

/** Content layout for one native page entry. The platform owns application navigation. */
export function WorkspacePageLayout({ title, description, action, children }) {
  return <main className="workspace-page app-main">
    <header className="page-heading">
      <div><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>
      {action}
    </header>
    {children}
  </main>;
}
