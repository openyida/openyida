'use strict';

const {
  VIEW_TO_PROCESS_TYPE,
  canonicalStringify,
  localizedName,
  normalizeArtifact,
  sha256Canonical,
} = require('./normalize');

const APPROVAL_MODES = new Set(['all', 'or', 'oneByOne']);
const FIELD_BEHAVIORS = new Set(['NORMAL', 'READONLY', 'HIDDEN']);
const CONDITION_OPERATORS = new Set([
  'Equal',
  'GreaterThan',
  'GreaterThanOrEqual',
  'LessThan',
  'LessThanOrEqual',
]);

function collectProcessNodes(nodes, output) {
  (nodes || []).forEach(function (node) {
    output.push(node);
    collectProcessNodes(node.childNodes, output);
  });
}

function collectViewNodes(nodes, output) {
  (nodes || []).forEach(function (node) {
    output.push(node);
    collectViewNodes(node.children, output);
  });
}

function getProcessNodes(artifact) {
  const output = [];
  collectProcessNodes(artifact.processJson && artifact.processJson.nodes, output);
  return output;
}

function getViewNodes(artifact) {
  return getViewNodesFromViewJson(artifact.viewJson);
}

function getViewNodesFromViewJson(viewJson) {
  const output = [];
  collectViewNodes(viewJson && viewJson.schema && viewJson.schema.children, output);
  return output;
}

function processName(node) {
  return localizedName(node && (node.name || (node.props && node.props.name)));
}

function viewName(node) {
  return localizedName(node && node.props && (node.props.name || node.props.nodeName));
}

function getViewApprovalMode(viewNode) {
  const props = viewNode && viewNode.props || {};
  const multiRules = props.multiApproverRules;
  if (multiRules && typeof multiRules === 'object') {
    return multiRules.approvalType_multi
      || multiRules.multiApproverType
      || multiRules.approvalMode
      || null;
  }
  const rules = props.approverRules;
  if (Array.isArray(rules)) {
    return rules[0] && (rules[0].multiApproverType || rules[0].approvalMode);
  }
  if (rules && typeof rules === 'object') {
    return rules.multiApproverType || rules.approvalMode;
  }
  return null;
}

function getProcessApprovalMode(node) {
  const props = (node && node.props) || {};
  return props.multiApprove || props.multiApproverType || props.approvalMode || null;
}

function behaviorList(node) {
  const props = (node && node.props) || {};
  const config = props.formConfig || props.formPermission || {};
  const list = config.behaviorList || config.fieldBehaviorList || [];
  return list.map(function (item) {
    return {
      fieldId: String(item.fieldId),
      fieldBehavior: item.fieldBehavior || item.behavior,
    };
  });
}

function flowBehaviorList(flowConfig, nodeId) {
  const list = flowConfig && flowConfig[nodeId];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(function (item) {
    return {
      fieldId: String(item.fieldId),
      fieldBehavior: item.fieldBehavior || item.behavior,
    };
  });
}

function getReturnRules(node) {
  const rules = node && node.props && node.props.routeRule && node.props.routeRule.rules;
  return Array.isArray(rules) ? rules : [];
}

function indexBy(items, keyFn) {
  const map = new Map();
  items.forEach(function (item) { map.set(keyFn(item), item); });
  return map;
}

function extractSemanticContract(normalizedArtifact) {
  const processNodes = getProcessNodes(normalizedArtifact);
  const viewNodes = getViewNodes(normalizedArtifact);
  const processById = indexBy(processNodes, function (node) { return node.nodeId; });
  const viewById = indexBy(viewNodes, function (node) { return node.id; });
  const flowConfig = normalizedArtifact.processJson.flowConfig || {};

  const nodes = processNodes.map(function (node) {
    return {
      id: node.nodeId,
      type: node.type,
      name: processName(node),
      nextIds: Array.isArray(node.nextId) ? node.nextId.slice() : [],
    };
  });

  const viewBindings = processNodes.map(function (node) {
    const viewNode = viewById.get(node.nodeId);
    return {
      processId: node.nodeId,
      processType: node.type,
      processName: processName(node),
      viewId: viewNode ? viewNode.id : null,
      componentName: viewNode ? viewNode.componentName : null,
      viewType: viewNode ? (VIEW_TO_PROCESS_TYPE[viewNode.componentName] || viewNode.componentName) : null,
      viewName: viewNode ? viewName(viewNode) : null,
    };
  });

  const views = viewNodes.map(function (node) {
    return {
      id: node.id,
      componentName: node.componentName,
      viewType: VIEW_TO_PROCESS_TYPE[node.componentName] || node.componentName,
      name: viewName(node),
    };
  });

  const branches = [];
  processNodes.filter(function (node) { return node.type === 'route'; }).forEach(function (routeNode) {
    const routeView = viewById.get(routeNode.nodeId);
    const routeViewChildren = (routeView && routeView.children) || [];
    const routeViewById = indexBy(routeViewChildren, function (node) { return node.id; });
    const branchItems = (routeNode.childNodes || [])
      .filter(function (node) { return node.type === 'condition'; })
      .map(function (branchNode) {
        const branchView = routeViewById.get(branchNode.nodeId) || viewById.get(branchNode.nodeId);
        const conditions = branchNode.props && branchNode.props.conditions;
        const targetId = branchNode.nextId && branchNode.nextId[0] || null;
        const targetNode = processById.get(targetId);
        const viewTargetId = branchView && branchView.children && branchView.children[0]
          ? branchView.children[0].id
          : null;
        return {
          id: branchNode.nodeId,
          name: processName(branchNode),
          componentName: branchView ? branchView.componentName : null,
          isDefault: !!(branchNode.props && branchNode.props.isDefault),
          logic: conditions && conditions.condition || null,
          rules: conditions && Array.isArray(conditions.rules) ? conditions.rules.map(function (rule) {
            return {
              fieldId: rule.fieldId,
              operator: rule.operator,
              value: rule.value,
            };
          }) : [],
          targetId: targetId,
          targetName: targetNode ? processName(targetNode) : null,
          viewTargetId: viewTargetId,
        };
      });
    branches.push({
      routeId: routeNode.nodeId,
      routeName: processName(routeNode),
      outgoingType: routeNode.props && routeNode.props.outgoingType || null,
      requiresDefault: routeNode.props && routeNode.props.outgoingType === 'priority',
      items: branchItems,
    });
  });

  const approvalModes = processNodes
    .filter(function (node) { return node.type === 'approval'; })
    .map(function (node) {
      const viewNode = viewById.get(node.nodeId);
      return {
        nodeId: node.nodeId,
        nodeName: processName(node),
        componentName: viewNode ? viewNode.componentName : null,
        processKind: node.props && node.props.mode === 'multi' ? 'multi' : 'single',
        viewKind: viewNode && viewNode.componentName === 'MultiApprovalNode' ? 'multi' : 'single',
        processMode: getProcessApprovalMode(node),
        viewMode: getViewApprovalMode(viewNode),
      };
    });

  const fieldPermissions = processNodes
    .map(function (node) {
      const processPermissions = behaviorList(node);
      const viewPermissions = behaviorList(viewById.get(node.nodeId));
      const flowPermissions = flowBehaviorList(flowConfig, node.nodeId);
      if (!processPermissions.length && !viewPermissions.length && !flowPermissions.length) {
        return null;
      }
      return {
        nodeId: node.nodeId,
        nodeName: processName(node),
        process: processPermissions,
        view: viewPermissions,
        flowConfig: flowPermissions,
      };
    })
    .filter(Boolean);

  const returnRules = [];
  processNodes.forEach(function (node) {
    getReturnRules(node).forEach(function (rule, index) {
      const target = processById.get(rule.targetNodeId);
      const viewNode = viewById.get(node.nodeId);
      const viewRules = getReturnRules(viewNode);
      const viewRule = viewRules[index];
      returnRules.push({
        nodeId: node.nodeId,
        nodeName: processName(node),
        index: index,
        event: rule.event || rule.action || null,
        targetId: rule.targetNodeId || null,
        targetName: target ? processName(target) : null,
        viewTargetId: viewRule && viewRule.targetNodeId || null,
      });
    });
  });

  return {
    nodes: nodes,
    views: views,
    viewBindings: viewBindings,
    branches: branches,
    approvalModes: approvalModes,
    fieldPermissions: fieldPermissions,
    returnRules: returnRules,
  };
}

function buildHiddenContract(artifact, runtimeCases, metadata) {
  const normalized = normalizeArtifact(artifact);
  const semantic = extractSemanticContract(normalized);
  return Object.assign({
    schemaVersion: 1,
    protocolVersion: 1,
    runtimeCases: JSON.parse(JSON.stringify(runtimeCases || [])),
  }, metadata || {}, semantic);
}

function error(code, path, expected, actual) {
  return {
    code: code,
    path: path,
    expected: expected === undefined ? null : expected,
    actual: actual === undefined ? null : actual,
  };
}

function compareRules(expectedBranch, actualBranch, path, errors) {
  const expectedRules = expectedBranch.rules || [];
  const actualRules = actualBranch.rules || [];
  if (expectedBranch.logic !== actualBranch.logic) {
    errors.push(error('PROCESS_CONDITION_LOGIC_MISMATCH', path + '.logic', expectedBranch.logic, actualBranch.logic));
  }
  if (expectedRules.length !== actualRules.length) {
    errors.push(error('PROCESS_CONDITION_RULE_COUNT_MISMATCH', path + '.rules.length', expectedRules.length, actualRules.length));
  }
  const length = Math.min(expectedRules.length, actualRules.length);
  for (let index = 0; index < length; index += 1) {
    const expectedRule = expectedRules[index];
    const actualRule = actualRules[index];
    if (expectedRule.fieldId !== actualRule.fieldId) {
      errors.push(error('PROCESS_CONDITION_FIELD_MISMATCH', path + '.rules[' + index + '].fieldId', expectedRule.fieldId, actualRule.fieldId));
    }
    if (expectedRule.operator !== actualRule.operator) {
      errors.push(error('PROCESS_CONDITION_OPERATOR_MISMATCH', path + '.rules[' + index + '].operator', expectedRule.operator, actualRule.operator));
    }
    if (canonicalStringify(expectedRule.value) !== canonicalStringify(actualRule.value)) {
      errors.push(error('PROCESS_CONDITION_VALUE_MISMATCH', path + '.rules[' + index + '].value', expectedRule.value, actualRule.value));
    }
  }
}

function validateReferences(actualSemantic, errors) {
  const nodeIds = new Set(actualSemantic.nodes.map(function (node) { return node.id; }));
  actualSemantic.nodes.forEach(function (node) {
    node.nextIds.forEach(function (targetId, index) {
      if (targetId && !nodeIds.has(targetId)) {
        errors.push(error(
          'PROCESS_NODE_REFERENCE_BROKEN',
          '$.nodes[' + node.id + '].nextIds[' + index + ']',
          'existing node id',
          targetId
        ));
      }
    });
  });
  actualSemantic.returnRules.forEach(function (rule) {
    if (rule.targetId && !nodeIds.has(rule.targetId)) {
      errors.push(error(
        'PROCESS_NODE_REFERENCE_BROKEN',
        '$.returnRules[' + rule.nodeId + ':' + rule.index + '].targetId',
        'existing node id',
        rule.targetId
      ));
    }
  });
}

function validateSemanticContract(actualSemantic, contract) {
  const errors = [];
  const actualNodes = indexBy(actualSemantic.nodes, function (node) { return node.id; });
  const actualViews = indexBy(actualSemantic.viewBindings, function (binding) { return binding.processId; });
  const expectedNodes = indexBy(contract.nodes, function (node) { return node.id; });
  const expectedViewNodes = indexBy(contract.views || contract.viewBindings.map(function (binding) {
    return { id: binding.viewId };
  }), function (view) { return view.id; });

  contract.nodes.forEach(function (expectedNode) {
    const path = '$.nodes[' + expectedNode.id + ']';
    const actualNode = actualNodes.get(expectedNode.id);
    if (!actualNode) {
      errors.push(error('PROCESS_NODE_MISSING', path, {
        type: expectedNode.type,
        name: expectedNode.name,
      }, null));
      return;
    }
    if (expectedNode.type !== actualNode.type) {
      errors.push(error('PROCESS_NODE_TYPE_MISMATCH', path + '.type', expectedNode.type, actualNode.type));
    }
    if (expectedNode.name !== actualNode.name) {
      errors.push(error('PROCESS_NODE_NAME_MISMATCH', path + '.name', expectedNode.name, actualNode.name));
    }
  });

  actualSemantic.nodes.forEach(function (actualNode) {
    if (!expectedNodes.has(actualNode.id)) {
      errors.push(error('PROCESS_NODE_UNEXPECTED', '$.nodes[' + actualNode.id + ']', null, {
        type: actualNode.type,
        name: actualNode.name,
      }));
    }
  });

  actualSemantic.views.forEach(function (actualView) {
    if (!expectedViewNodes.has(actualView.id)) {
      errors.push(error('PROCESS_VIEW_NODE_UNEXPECTED', '$.views[' + actualView.id + ']', null, {
        componentName: actualView.componentName,
        viewType: actualView.viewType,
        name: actualView.name,
      }));
    }
  });

  validateReferences(actualSemantic, errors);

  contract.nodes.forEach(function (expectedNode) {
    const actualNode = actualNodes.get(expectedNode.id);
    if (!actualNode) {
      return;
    }
    if (canonicalStringify(expectedNode.nextIds) !== canonicalStringify(actualNode.nextIds)) {
      errors.push(error(
        'PROCESS_EDGE_TARGET_MISMATCH',
        '$.nodes[' + expectedNode.id + '].nextIds',
        expectedNode.nextIds,
        actualNode.nextIds
      ));
    }
  });

  contract.viewBindings.forEach(function (expectedBinding) {
    const actualBinding = actualViews.get(expectedBinding.processId);
    const path = '$.viewBindings[' + expectedBinding.processId + ']';
    if (!actualBinding || !actualBinding.viewId) {
      errors.push(error('PROCESS_VIEW_NODE_MISSING', path, expectedBinding.componentName, null));
      return;
    }
    ['viewId', 'componentName', 'viewType', 'viewName'].forEach(function (key) {
      if (expectedBinding[key] !== actualBinding[key]) {
        errors.push(error('PROCESS_VIEW_NODE_MISMATCH', path + '.' + key, expectedBinding[key], actualBinding[key]));
      }
    });
    if (actualBinding.processName !== actualBinding.viewName || actualBinding.processType !== actualBinding.viewType) {
      errors.push(error('PROCESS_VIEW_SEMANTIC_MISMATCH', path, {
        type: actualBinding.processType,
        name: actualBinding.processName,
      }, {
        type: actualBinding.viewType,
        name: actualBinding.viewName,
      }));
    }
  });

  const actualRoutes = indexBy(actualSemantic.branches, function (route) { return route.routeId; });
  contract.branches.forEach(function (expectedRoute) {
    const actualRoute = actualRoutes.get(expectedRoute.routeId);
    const routePath = '$.branches[' + expectedRoute.routeId + ']';
    if (!actualRoute) {
      errors.push(error('PROCESS_ROUTE_MISSING', routePath, expectedRoute.routeName, null));
      return;
    }
    if (expectedRoute.requiresDefault && !actualRoute.items.some(function (item) { return item.isDefault; })) {
      errors.push(error('PROCESS_DEFAULT_BRANCH_MISSING', routePath + '.default', true, false));
    }
    const actualItems = indexBy(actualRoute.items, function (item) { return item.id; });
    expectedRoute.items.forEach(function (expectedBranch) {
      const actualBranch = actualItems.get(expectedBranch.id);
      const path = routePath + '.items[' + expectedBranch.id + ']';
      if (!actualBranch) {
        errors.push(error('PROCESS_BRANCH_MISSING', path, expectedBranch.name, null));
        return;
      }
      if (expectedBranch.isDefault !== actualBranch.isDefault) {
        errors.push(error('PROCESS_BRANCH_DEFAULT_MISMATCH', path + '.isDefault', expectedBranch.isDefault, actualBranch.isDefault));
      }
      if (expectedBranch.targetId !== actualBranch.targetId || expectedBranch.targetName !== actualBranch.targetName) {
        errors.push(error('PROCESS_BRANCH_TARGET_MISMATCH', path + '.target', {
          id: expectedBranch.targetId,
          name: expectedBranch.targetName,
        }, {
          id: actualBranch.targetId,
          name: actualBranch.targetName,
        }));
      }
      if (actualBranch.viewTargetId !== actualBranch.targetId) {
        errors.push(error('PROCESS_VIEW_BRANCH_TARGET_MISMATCH', path + '.viewTargetId', actualBranch.targetId, actualBranch.viewTargetId));
      }
      compareRules(expectedBranch, actualBranch, path, errors);
    });
  });

  const actualModes = indexBy(actualSemantic.approvalModes, function (item) { return item.nodeId; });
  contract.approvalModes.forEach(function (expectedMode) {
    const actualMode = actualModes.get(expectedMode.nodeId);
    const path = '$.approvalModes[' + expectedMode.nodeId + ']';
    if (!actualMode) {
      return;
    }
    if (expectedMode.componentName !== actualMode.componentName
      || expectedMode.processKind !== actualMode.processKind
      || expectedMode.viewKind !== actualMode.viewKind) {
      errors.push(error('PROCESS_APPROVAL_COMPONENT_MISMATCH', path + '.component', {
        componentName: expectedMode.componentName,
        processKind: expectedMode.processKind,
        viewKind: expectedMode.viewKind,
      }, {
        componentName: actualMode.componentName,
        processKind: actualMode.processKind,
        viewKind: actualMode.viewKind,
      }));
    }
    if (!APPROVAL_MODES.has(actualMode.processMode) || expectedMode.processMode !== actualMode.processMode) {
      errors.push(error('PROCESS_APPROVAL_MODE_MISMATCH', path + '.processMode', expectedMode.processMode, actualMode.processMode));
    }
    if (!APPROVAL_MODES.has(actualMode.viewMode) || expectedMode.viewMode !== actualMode.viewMode) {
      errors.push(error('PROCESS_APPROVAL_MODE_MISMATCH', path + '.viewMode', expectedMode.viewMode, actualMode.viewMode));
    }
    if (actualMode.processMode !== actualMode.viewMode) {
      errors.push(error('PROCESS_APPROVAL_MODE_VIEW_MISMATCH', path, actualMode.processMode, actualMode.viewMode));
    }
  });

  const actualPermissions = indexBy(actualSemantic.fieldPermissions, function (item) { return item.nodeId; });
  contract.fieldPermissions.forEach(function (expectedPermission) {
    const actualPermission = actualPermissions.get(expectedPermission.nodeId);
    const path = '$.fieldPermissions[' + expectedPermission.nodeId + ']';
    if (!actualPermission) {
      errors.push(error('PROCESS_FIELD_PERMISSION_MISSING', path, expectedPermission.process, null));
      return;
    }
    ['process', 'view', 'flowConfig'].forEach(function (side) {
      const expectedFields = indexBy(expectedPermission[side], function (item) { return item.fieldId; });
      const actualFields = indexBy(actualPermission[side], function (item) { return item.fieldId; });
      expectedFields.forEach(function (expectedField, fieldId) {
        const actualField = actualFields.get(fieldId);
        if (!actualField || !FIELD_BEHAVIORS.has(actualField.fieldBehavior) || expectedField.fieldBehavior !== actualField.fieldBehavior) {
          errors.push(error(
            side === 'flowConfig'
              ? 'PROCESS_FLOW_CONFIG_PERMISSION_MISMATCH'
              : 'PROCESS_FIELD_PERMISSION_MISMATCH',
            path + '.' + side + '[' + fieldId + ']',
            expectedField.fieldBehavior,
            actualField && actualField.fieldBehavior
          ));
        }
      });
    });
  });

  const actualReturns = indexBy(actualSemantic.returnRules, function (item) { return item.nodeId + ':' + item.index; });
  contract.returnRules.forEach(function (expectedRule) {
    const key = expectedRule.nodeId + ':' + expectedRule.index;
    const actualRule = actualReturns.get(key);
    const path = '$.returnRules[' + key + ']';
    if (!actualRule) {
      errors.push(error('PROCESS_RETURN_RULE_MISSING', path, expectedRule, null));
      return;
    }
    if (expectedRule.targetId !== actualRule.targetId || expectedRule.targetName !== actualRule.targetName) {
      errors.push(error('PROCESS_RETURN_TARGET_MISMATCH', path + '.target', {
        id: expectedRule.targetId,
        name: expectedRule.targetName,
      }, {
        id: actualRule.targetId,
        name: actualRule.targetName,
      }));
    }
    if (actualRule.viewTargetId !== actualRule.targetId) {
      errors.push(error('PROCESS_VIEW_RETURN_TARGET_MISMATCH', path + '.viewTargetId', actualRule.targetId, actualRule.viewTargetId));
    }
  });

  return errors;
}

function extractViewContractProjection(canonicalView) {
  return getViewNodesFromViewJson(canonicalView).map(function (node) {
    const componentName = node.componentName;
    return {
      id: node.id,
      componentName: componentName,
      viewType: VIEW_TO_PROCESS_TYPE[componentName] || componentName,
      name: viewName(node),
      approvalMode: getViewApprovalMode(node),
      approvalKind: componentName === 'MultiApprovalNode' ? 'multi' : 'single',
    };
  });
}

function buildViewUnverifiedAssertions(contract) {
  const assertions = [
    {
      id: 'process.node-runtime-types',
      reason: 'view component types do not prove deployed process node types',
    },
    {
      id: 'process.node-names',
      reason: 'view node names do not prove deployed process node names',
    },
    {
      id: 'process.edge-targets',
      reason: 'designer tree order does not expose runtime nextId edges or references',
    },
    {
      id: 'process.view-bindings',
      reason: 'view-only readback cannot prove process/view type and name bindings',
    },
    {
      id: 'runtime.cases',
      reason: 'runtime cases require platform execution evidence',
    },
  ];

  if ((contract.approvalModes || []).length > 0) {
    assertions.push(
      {
        id: 'process.approval-component-mode',
        reason: 'visible approval configuration does not prove deployed process approval props',
      },
      {
        id: 'runtime.approver-resolution',
        reason: 'visible approver props do not prove runtime actor resolution',
      }
    );
  }

  if ((contract.branches || []).length > 0) {
    assertions.push(
      { id: 'view.branches', reason: 'view branch containers are not asserted by this verifier' },
      { id: 'view.condition-rules', reason: 'view condition logic, operators, and values are not asserted' },
      { id: 'view.default-branch', reason: 'view default branch markers are not asserted' },
      { id: 'view.branch-targets', reason: 'view branch child targets are not asserted' },
      { id: 'process.branches', reason: 'process branch nodes are absent from view-only readback' },
      { id: 'process.condition-rules', reason: 'deployed process condition rules are absent from view-only readback' },
      { id: 'process.default-branch', reason: 'deployed process default branch is absent from view-only readback' },
      { id: 'process.branch-targets', reason: 'deployed process branch targets are absent from view-only readback' },
      { id: 'runtime.condition-evaluation', reason: 'condition evaluation requires runtime evidence' }
    );
  }

  if ((contract.fieldPermissions || []).length > 0) {
    assertions.push(
      { id: 'view.field-permissions', reason: 'view-side field permissions are not asserted by this verifier' },
      { id: 'process.field-permissions', reason: 'process-side field permissions are absent from view-only readback' },
      { id: 'process.flow-config', reason: 'top-level process flowConfig is absent from view-only readback' },
      { id: 'runtime.field-permissions', reason: 'field permission enforcement requires runtime evidence' }
    );
  }

  if ((contract.returnRules || []).length > 0) {
    assertions.push(
      { id: 'view.return-rules', reason: 'view-side return rules and targets are not asserted by this verifier' },
      { id: 'process.return-rules', reason: 'deployed process return rules are absent from view-only readback' },
      { id: 'runtime.return-routing', reason: 'return routing requires runtime evidence' }
    );
  }

  return assertions;
}

function verifyViewContract(expectedContract, canonicalView) {
  const contract = expectedContract;
  if (!contract || contract.schemaVersion !== 1) {
    throw new TypeError('contract schemaVersion 1 is required');
  }
  if (!canonicalView || !canonicalView.schema || canonicalView.schema.componentName !== 'CanvasEngine'
    || canonicalView.processJson !== undefined || canonicalView.viewJson !== undefined
    || !Object.prototype.hasOwnProperty.call(canonicalView, 'bindingForm')
    || !Array.isArray(canonicalView.formulaRules)
    || !canonicalView.globalSetting || typeof canonicalView.globalSetting !== 'object'
    || Array.isArray(canonicalView.globalSetting)) {
    throw new TypeError('canonicalView must be a standalone CanvasEngine view payload');
  }

  const errors = [];
  const actualViews = extractViewContractProjection(canonicalView);
  const expectedViews = contract.views || contract.viewBindings.map(function (binding) {
    return {
      id: binding.viewId,
      componentName: binding.componentName,
      viewType: binding.viewType,
      name: binding.viewName,
    };
  });
  const actualById = indexBy(actualViews, function (view) { return view.id; });
  const expectedById = indexBy(expectedViews, function (view) { return view.id; });

  expectedViews.forEach(function (expectedView) {
    const path = '$.views[' + expectedView.id + ']';
    const actualView = actualById.get(expectedView.id);
    if (!actualView) {
      errors.push(error('PROCESS_VIEW_NODE_MISSING', path, {
        componentName: expectedView.componentName,
        name: expectedView.name,
      }, null));
      return;
    }
    ['componentName', 'viewType', 'name'].forEach(function (key) {
      if (expectedView[key] !== actualView[key]) {
        errors.push(error('PROCESS_VIEW_NODE_MISMATCH', path + '.' + key, expectedView[key], actualView[key]));
      }
    });
  });

  actualViews.forEach(function (actualView) {
    if (!expectedById.has(actualView.id)) {
      errors.push(error('PROCESS_VIEW_NODE_UNEXPECTED', '$.views[' + actualView.id + ']', null, {
        componentName: actualView.componentName,
        name: actualView.name,
      }));
    }
  });

  const expectedOrder = expectedViews.map(function (view) { return view.id; });
  const actualOrder = actualViews.map(function (view) { return view.id; });
  if (canonicalStringify(expectedOrder) !== canonicalStringify(actualOrder)) {
    errors.push(error(
      'PROCESS_VIEW_NODE_ORDER_MISMATCH',
      '$.views.order',
      expectedOrder,
      actualOrder
    ));
  }

  (contract.approvalModes || []).forEach(function (expectedMode) {
    const actualView = actualById.get(expectedMode.nodeId);
    const path = '$.approvalModes[' + expectedMode.nodeId + ']';
    if (!actualView) {
      return;
    }
    if (expectedMode.componentName !== actualView.componentName
      || expectedMode.viewKind !== actualView.approvalKind) {
      errors.push(error('PROCESS_APPROVAL_COMPONENT_MISMATCH', path + '.component', {
        componentName: expectedMode.componentName,
        viewKind: expectedMode.viewKind,
      }, {
        componentName: actualView.componentName,
        viewKind: actualView.approvalKind,
      }));
    }
    if (!APPROVAL_MODES.has(actualView.approvalMode)
      || expectedMode.viewMode !== actualView.approvalMode) {
      errors.push(error(
        'PROCESS_APPROVAL_MODE_MISMATCH',
        path + '.viewMode',
        expectedMode.viewMode,
        actualView.approvalMode
      ));
    }
  });

  const errorCodes = new Set(errors.map(function (item) { return item.code; }));
  const verifiedAssertions = [];
  if (!errorCodes.has('PROCESS_VIEW_NODE_MISSING')
    && !errorCodes.has('PROCESS_VIEW_NODE_UNEXPECTED')) {
    verifiedAssertions.push('view.node-set');
  }
  if (!errorCodes.has('PROCESS_VIEW_NODE_MISSING')
    && !errorCodes.has('PROCESS_VIEW_NODE_MISMATCH')) {
    verifiedAssertions.push('view.node-component-name');
  }
  if (!errorCodes.has('PROCESS_VIEW_NODE_ORDER_MISMATCH')) {
    verifiedAssertions.push('view.designer-tree-order');
  }
  const observedCapabilities = [
    'viewJson.bindingForm',
    'viewJson.formulaRules',
    'viewJson.globalSetting',
    'viewJson.schema',
    'view.node.identity',
    'view.node.order',
  ];
  const expectedApprovalModes = contract.approvalModes || [];
  if (expectedApprovalModes.length > 0) {
    const approvalNodeMissing = expectedApprovalModes.some(function (expectedMode) {
      return !actualById.has(expectedMode.nodeId);
    });
    if (!approvalNodeMissing
      && !errorCodes.has('PROCESS_APPROVAL_COMPONENT_MISMATCH')
      && !errorCodes.has('PROCESS_APPROVAL_MODE_MISMATCH')) {
      verifiedAssertions.push('view.approval-component-mode');
    }
    observedCapabilities.push('view.approval.mode');
  }

  const unverifiedAssertions = buildViewUnverifiedAssertions(contract);

  return {
    verificationLevel: 'PLATFORM_VIEW_VERIFIED',
    valid: errors.length === 0,
    errors: errors,
    verifiedAssertions: verifiedAssertions,
    observedCapabilities: observedCapabilities,
    unverifiedAssertions: unverifiedAssertions,
    runtimeRequired: unverifiedAssertions.map(function (item) { return item.id; }),
    artifactHash: sha256Canonical(canonicalView),
  };
}

function evaluateRule(rule, input) {
  if (!CONDITION_OPERATORS.has(rule.operator)) {
    return false;
  }
  const actual = input[rule.fieldId];
  if (rule.operator === 'Equal') { return actual === rule.value; }
  if (rule.operator === 'GreaterThan') { return actual > rule.value; }
  if (rule.operator === 'GreaterThanOrEqual') { return actual >= rule.value; }
  if (rule.operator === 'LessThan') { return actual < rule.value; }
  if (rule.operator === 'LessThanOrEqual') { return actual <= rule.value; }
  return false;
}

function evaluateConditionRoute(route, input) {
  let defaultBranch = null;
  for (const branch of route.items) {
    if (branch.isDefault) {
      defaultBranch = branch;
      continue;
    }
    const results = branch.rules.map(function (rule) { return evaluateRule(rule, input); });
    const matched = branch.logic === 'OR'
      ? results.some(Boolean)
      : results.length > 0 && results.every(Boolean);
    if (matched) {
      return branch;
    }
  }
  return defaultBranch;
}

function validateRuntimeCases(actualSemantic, runtimeCases) {
  const errors = [];
  const results = [];
  const routesByName = indexBy(actualSemantic.branches, function (route) { return route.routeName; });
  (runtimeCases || []).forEach(function (runtimeCase, index) {
    if (runtimeCase.kind !== 'condition') {
      results.push({ id: runtimeCase.id, kind: runtimeCase.kind, status: 'contract-only' });
      return;
    }
    const route = routesByName.get(runtimeCase.routeName);
    const branch = route ? evaluateConditionRoute(route, runtimeCase.input || {}) : null;
    const path = '$.runtimeCases[' + index + ']';
    if (!branch || branch.name !== runtimeCase.expectedBranch || branch.targetName !== runtimeCase.expectedTarget) {
      errors.push(error('PROCESS_RUNTIME_CASE_TARGET_MISMATCH', path, {
        branch: runtimeCase.expectedBranch,
        target: runtimeCase.expectedTarget,
      }, branch ? { branch: branch.name, target: branch.targetName } : null));
      results.push({ id: runtimeCase.id, kind: runtimeCase.kind, status: 'fail' });
      return;
    }
    results.push({ id: runtimeCase.id, kind: runtimeCase.kind, status: 'pass' });
  });
  return { errors: errors, results: results };
}

function verifyContract(expectedContract, canonicalProcess) {
  const contract = expectedContract;
  if (!contract || contract.schemaVersion !== 1) {
    throw new TypeError('contract schemaVersion 1 is required');
  }
  if (!canonicalProcess || !canonicalProcess.processJson || !canonicalProcess.viewJson) {
    throw new TypeError('canonicalProcess must contain processJson and viewJson');
  }
  const actualSemantic = extractSemanticContract(canonicalProcess);
  const errors = validateSemanticContract(actualSemantic, contract);
  const runtime = validateRuntimeCases(actualSemantic, contract.runtimeCases || []);
  errors.push.apply(errors, runtime.errors);
  const artifactHash = sha256Canonical(canonicalProcess);
  return {
    verificationLevel: 'CONTRACT_VERIFIED',
    valid: errors.length === 0,
    errors: errors,
    runtimeCases: runtime.results,
    canonicalProcess: canonicalProcess,
    artifactHash: artifactHash,
    contractHash: sha256Canonical(contract),
  };
}

function validateArtifact(artifact, contract) {
  const normalized = normalizeArtifact(artifact);
  const result = verifyContract(contract, normalized);
  return Object.assign({ normalized: normalized }, result);
}

module.exports = {
  APPROVAL_MODES,
  FIELD_BEHAVIORS,
  CONDITION_OPERATORS,
  extractSemanticContract,
  extractViewContractProjection,
  buildHiddenContract,
  evaluateRule,
  evaluateConditionRoute,
  validateRuntimeCases,
  verifyContract,
  verifyViewContract,
  validateArtifact,
};
