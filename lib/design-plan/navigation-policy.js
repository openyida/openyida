'use strict';

// Shared by the materialized page handoff and CLI manifest. This is an output
// contract, not a new authoring field or a claim about the live platform config.
function getPageNavigationContract() {
  return {
    output_path: 'pages[].navigationPolicy in the PRD execution handoff',
    input_policy: 'Derived from app navigation and pageSpecHandoff; do not write navigationPolicy into build-plan.json or page-spec.json.',
    platform_shell: {
      applicationMenuOwner: 'platform', pageLayout: 'content-only',
      renderApplicationMenu: false, localTabs: 'same-task-only', duplicatePlatformMenu: false,
    },
    page_owned: {
      applicationMenuOwner: 'page', pageLayout: 'standalone',
      renderApplicationMenu: true, localTabs: 'planned-views', duplicatePlatformMenu: false,
    },
    no_menu: {
      applicationMenuOwner: 'none', pageLayout: 'standalone',
      renderApplicationMenu: false, localTabs: 'same-task-only', duplicatePlatformMenu: false,
    },
    selection: 'platform-shell uses platform_shell; standalone uses page_owned only for explicit custom page menus or application custom navigation. Explicit none and standalone without a planned menu use no_menu.',
    discussion: {
      plan: 'Include frontend and workspace navigation in the overall plan discussion and confirmation; material changes follow the existing revision confirmation workflow.',
      fast: 'Explain and use the recorded decision; no additional navigation approval gate.',
      existing: 'Preserve explicit user requirements and existing navigation for local changes; page Tabs or state preservation alone do not authorize replacing platform navigation.',
    },
  };
}

function buildPageNavigationPolicy(spec, applicationNavigationType) {
  const contract = getPageNavigationContract();
  if (spec.entryMode === 'platform-shell') { return contract.platform_shell; }
  if (spec.navigation?.type === 'none') { return contract.no_menu; }
  return spec.navigation?.type === 'custom' || applicationNavigationType === 'custom'
    ? contract.page_owned : contract.no_menu;
}

module.exports = { getPageNavigationContract, buildPageNavigationPolicy };
