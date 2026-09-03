'use strict';

const FORM_NAVIGATION_UPDATE_KEYS = [
  'gmtModified',
  'parentNavUuid',
  'hidden',
  'mobileHidden',
  'i18nTitle',
  'isNewReport',
  'id',
  'isNewForm',
  'slug',
  'formType',
  'formUuid',
  'navUuid',
  'navType',
  'isNew',
  'gmtCreate',
  'parentId',
  'url',
  'topicId',
  'displayType',
  'relateFormUuid',
  'processCode',
  'listOrder',
  'formStatus',
  'relateFormType',
];

function buildFormNavigationIconUpdatePayload(navigationNode, icon) {
  const updatePayload = {
    _locale_time_zone_offset: 28800000,
  };
  FORM_NAVIGATION_UPDATE_KEYS.forEach(function (key) {
    if (navigationNode[key] !== undefined) {
      updatePayload[key] = key === 'i18nTitle' && navigationNode[key] !== null && typeof navigationNode[key] === 'object'
        ? String(navigationNode[key])
        : navigationNode[key];
    }
  });

  const navigationTitle = navigationNode.title || navigationNode.i18nTitle || {};
  updatePayload.title = typeof navigationTitle === 'string'
    ? navigationTitle
    : JSON.stringify(navigationTitle);
  updatePayload.formUuid = navigationNode.formUuid || 'NAV-SYSTEM-FROM-ME-UUID';
  updatePayload.icon = icon;
  return updatePayload;
}

function createFormNavIconService(dependencies) {
  const {
    buildApiPath,
    requestWithAutoLogin,
    sendGetRequest,
    sendPostRequest,
    throwCreateFormError,
    sanitizeFailureResult,
    candidateLimit = 8,
  } = dependencies;

  function flattenNavigationNodes(nodes, output) {
    const resultNodes = output || [];
    (nodes || []).forEach(function (node) {
      resultNodes.push(node);
      if (Array.isArray(node.children)) {
        flattenNavigationNodes(node.children, resultNodes);
      }
    });
    return resultNodes;
  }

  async function fetchFormNavigationList(authRef, appType) {
    const navigationResult = await requestWithAutoLogin(function (auth) {
      return sendGetRequest(
        auth.baseUrl,
        buildApiPath(appType, 'getFormNavigationListByOrder', {
          queryModule: 'formnav',
          addTimestamp: true,
        }),
        {
          _api: 'Nav.queryList',
          _mock: false,
          _locale_time_zone_offset: 28800000,
        }
      );
    }, authRef);

    if (!navigationResult || navigationResult.success === false || !Array.isArray(navigationResult.content)) {
      const message = navigationResult
        ? navigationResult.errorMsg || navigationResult.message || 'Failed to fetch form navigation list'
        : 'Failed to fetch form navigation list';
      throwCreateFormError(message, 'CREATE_FORM_NAV_ICON_LIST_FAILED', {
        appType,
        result: sanitizeFailureResult(navigationResult),
      });
    }

    return flattenNavigationNodes(navigationResult.content);
  }

  function resolveFormNavigationNode(nodes, formUuid) {
    const exactMatches = (nodes || []).filter(function (node) {
      return node && (node.formUuid === formUuid || node.navUuid === formUuid);
    });
    const relatedMatches = (nodes || []).filter(function (node) {
      return node && node.relateFormUuid === formUuid;
    });
    const matches = exactMatches.length > 0 ? exactMatches : relatedMatches;
    if (matches.length !== 1) {
      return null;
    }
    return matches[0];
  }

  async function updateCreatedFormNavigationIcon(authRef, appType, formUuid, icon) {
    const navigationNodes = await fetchFormNavigationList(authRef, appType);
    const navigationNode = resolveFormNavigationNode(navigationNodes, formUuid);
    if (!navigationNode) {
      throwCreateFormError('Created form navigation node could not be resolved uniquely.', 'CREATE_FORM_NAV_ICON_NODE_NOT_FOUND', {
        appType,
        formUuid,
        candidates: navigationNodes.filter(function (node) {
          return node && node.navType !== 'SYSTEM';
        }).slice(0, candidateLimit).map(function (node) {
          return {
            id: node.id,
            navUuid: node.navUuid,
            formUuid: node.formUuid,
            relateFormUuid: node.relateFormUuid,
            formType: node.formType,
          };
        }),
      });
    }

    const updatePayload = buildFormNavigationIconUpdatePayload(navigationNode, icon);

    const updateResult = await requestWithAutoLogin(function (auth) {
      return sendPostRequest(
        auth.baseUrl,
        buildApiPath(appType, 'updateFormNavigation', {
          queryModule: 'formnav',
          api: 'Nav.update',
          mock: false,
          addTimestamp: true,
        }),
        updatePayload,
        formUuid,
        auth,
        {
          appType,
          referer: `${auth.baseUrl}/${appType}/admin/${formUuid}`,
        }
      );
    }, authRef);

    if (!updateResult || updateResult.success === false) {
      const message = updateResult
        ? updateResult.errorMsg || updateResult.message || 'Failed to update form navigation icon'
        : 'Failed to update form navigation icon';
      throwCreateFormError(message, 'CREATE_FORM_NAV_ICON_UPDATE_FAILED', {
        appType,
        formUuid,
        navUuid: navigationNode.navUuid,
        icon,
        result: sanitizeFailureResult(updateResult),
      });
    }

    const updatedNavigationNodes = await fetchFormNavigationList(authRef, appType);
    const updatedNavigationNode = resolveFormNavigationNode(updatedNavigationNodes, formUuid);
    if (!updatedNavigationNode || updatedNavigationNode.icon !== icon) {
      throwCreateFormError('Form navigation icon readback did not match the requested icon.', 'CREATE_FORM_NAV_ICON_READBACK_MISMATCH', {
        appType,
        formUuid,
        navUuid: navigationNode.navUuid,
        expectedIcon: icon,
        actualIcon: updatedNavigationNode && updatedNavigationNode.icon,
      });
    }

    return {
      id: updatedNavigationNode.id,
      navUuid: updatedNavigationNode.navUuid,
      icon: updatedNavigationNode.icon,
    };
  }

  return {
    fetchFormNavigationList,
    flattenNavigationNodes,
    resolveFormNavigationNode,
    updateCreatedFormNavigationIcon,
  };
}

module.exports = {
  FORM_NAVIGATION_UPDATE_KEYS,
  buildFormNavigationIconUpdatePayload,
  createFormNavIconService,
};
