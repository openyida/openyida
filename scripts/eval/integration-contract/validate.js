'use strict';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const output = {};
  Object.keys(value).sort().forEach(function (key) {
    output[key] = stableValue(value[key]);
  });
  return output;
}

function equal(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function equalOptional(left, right) {
  const normalizedLeft = left === undefined || left === null ? null : left;
  const normalizedRight = right === undefined || right === null ? null : right;
  return equal(normalizedLeft, normalizedRight);
}

function contractError(code, path, expected, actual) {
  return {
    code,
    path,
    expected: expected === undefined ? null : expected,
    actual: actual === undefined ? null : actual,
  };
}

function addError(errors, code, path, expected, actual) {
  errors.push(contractError(code, path, expected, actual));
}

function indexBy(items, key) {
  const output = new Map();
  (Array.isArray(items) ? items : []).forEach(function (item) {
    if (item && item[key] !== undefined) {
      output.set(item[key], item);
    }
  });
  return output;
}

function collectSourceReferences(value, path, output) {
  if (Array.isArray(value)) {
    value.forEach(function (item, index) {
      collectSourceReferences(item, path + '[' + index + ']', output);
    });
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  if (value.sourceNode) {
    output.push({ path: path + '.sourceNode', value: value.sourceNode });
  }
  Object.keys(value).forEach(function (key) {
    collectSourceReferences(value[key], path + '.' + key, output);
  });
}

function validateContractSemanticIntegrity(semantic, errors) {
  if (!isPlainObject(semantic.trigger)
    || !Array.isArray(semantic.nodes)
    || !Array.isArray(semantic.branches)) {
    addError(
      errors,
      'INTEGRATION_CONTRACT_STRUCTURE_INVALID',
      '$.contract.semantic',
      { trigger: 'object', nodes: 'array', branches: 'array' },
      semantic
    );
    return false;
  }

  let valid = true;
  if (typeof semantic.trigger.key !== 'string' || semantic.trigger.key === '') {
    addError(
      errors,
      'INTEGRATION_CONTRACT_STRUCTURE_INVALID',
      '$.contract.semantic.trigger.key',
      'non-empty string',
      semantic.trigger.key
    );
    valid = false;
  }
  const nodeKeys = new Set();
  semantic.nodes.forEach(function (node, index) {
    const key = node && node.key;
    if (typeof key !== 'string' || key === '' || nodeKeys.has(key)) {
      addError(
        errors,
        'INTEGRATION_CONTRACT_STRUCTURE_INVALID',
        '$.contract.semantic.nodes[' + index + '].key',
        'non-empty unique string',
        key
      );
      valid = false;
      return;
    }
    nodeKeys.add(key);
  });
  if (semantic.trigger.key && !nodeKeys.has(semantic.trigger.key)) {
    addError(
      errors,
      'INTEGRATION_CONTRACT_STRUCTURE_INVALID',
      '$.contract.semantic.trigger.key',
      'key present in semantic.nodes',
      semantic.trigger.key
    );
    valid = false;
  }

  const branchKeys = new Set();
  semantic.branches.forEach(function (branch, index) {
    const key = branch && branch.key;
    if (typeof key !== 'string'
      || key === ''
      || branchKeys.has(key)
      || nodeKeys.has(key)) {
      addError(
        errors,
        'INTEGRATION_CONTRACT_STRUCTURE_INVALID',
        '$.contract.semantic.branches[' + index + '].key',
        'non-empty unique string',
        key
      );
      valid = false;
      return;
    }
    branchKeys.add(key);
  });
  return valid;
}

function validateSideIntegrity(side, sideName, errors) {
  if (!side || !Array.isArray(side.nodes) || !Array.isArray(side.branches)) {
    addError(errors, 'INTEGRATION_CANONICAL_STRUCTURE_INVALID', '$.' + sideName, {
      trigger: 'object|null', nodes: 'array', branches: 'array',
    }, side);
    return false;
  }

  let valid = true;
  const allKeys = new Set();
  if (side.trigger) {
    if (typeof side.trigger.key !== 'string' || side.trigger.key === '') {
      addError(
        errors,
        'INTEGRATION_CANONICAL_STRUCTURE_INVALID',
        '$.' + sideName + '.trigger.key',
        'non-empty string',
        side.trigger.key
      );
      valid = false;
    } else {
      allKeys.add(side.trigger.key);
    }
  }
  const nodeKeys = new Set();
  side.nodes.forEach(function (node, nodeIndex) {
    if (!node || typeof node.key !== 'string' || node.key === '') {
      addError(
        errors,
        'INTEGRATION_CANONICAL_STRUCTURE_INVALID',
        '$.' + sideName + '.nodes[' + nodeIndex + '].key',
        'non-empty unique string',
        node && node.key
      );
      valid = false;
      return;
    }
    if (nodeKeys.has(node.key)) {
      addError(
        errors,
        'INTEGRATION_CANONICAL_STRUCTURE_INVALID',
        '$.' + sideName + '.nodes[' + nodeIndex + '].key',
        'unique node key',
        node.key
      );
      valid = false;
      return;
    }
    nodeKeys.add(node.key);
    allKeys.add(node.key);
  });
  const branchKeys = new Set();
  side.branches.forEach(function (branch, branchIndex) {
    if (!branch || typeof branch.key !== 'string' || branch.key === '') {
      addError(
        errors,
        'INTEGRATION_CANONICAL_STRUCTURE_INVALID',
        '$.' + sideName + '.branches[' + branchIndex + '].key',
        'non-empty unique string',
        branch && branch.key
      );
      valid = false;
      return;
    }
    if (branchKeys.has(branch.key) || nodeKeys.has(branch.key)) {
      addError(
        errors,
        'INTEGRATION_CANONICAL_STRUCTURE_INVALID',
        '$.' + sideName + '.branches[' + branchIndex + '].key',
        'unique branch key',
        branch.key
      );
      valid = false;
      return;
    }
    branchKeys.add(branch.key);
    allKeys.add(branch.key);
  });

  if (!valid) {
    return false;
  }

  side.nodes.forEach(function (node, nodeIndex) {
    (node.nextKeys || []).forEach(function (target, targetIndex) {
      if (!allKeys.has(target)) {
        addError(
          errors,
          'INTEGRATION_EDGE_DANGLING',
          '$.' + sideName + '.nodes[' + nodeIndex + '].nextKeys[' + targetIndex + ']',
          'existing canonical node or branch key',
          target
        );
      }
    });
    const references = [];
    collectSourceReferences(node.config, '$.' + sideName + '.nodes[' + nodeIndex + '].config', references);
    references.forEach(function (reference) {
      if (!allKeys.has(reference.value)) {
        addError(
          errors,
          'INTEGRATION_REFERENCE_DANGLING',
          reference.path,
          'existing canonical node key',
          reference.value
        );
      }
    });
  });

  side.branches.forEach(function (branch, branchIndex) {
    if (!allKeys.has(branch.routeKey)) {
      addError(
        errors,
        'INTEGRATION_EDGE_DANGLING',
        '$.' + sideName + '.branches[' + branchIndex + '].routeKey',
        'existing route key',
        branch.routeKey
      );
    }
    if (branch.targetKey && !allKeys.has(branch.targetKey)) {
      addError(
        errors,
        'INTEGRATION_EDGE_DANGLING',
        '$.' + sideName + '.branches[' + branchIndex + '].targetKey',
        'existing canonical node key',
        branch.targetKey
      );
    }
    const references = [];
    collectSourceReferences(branch.rules, '$.' + sideName + '.branches[' + branchIndex + '].rules', references);
    references.forEach(function (reference) {
      if (!allKeys.has(reference.value)) {
        addError(
          errors,
          'INTEGRATION_REFERENCE_DANGLING',
          reference.path,
          'existing canonical node key',
          reference.value
        );
      }
    });
  });

  const routeKeys = new Set(side.branches.map(function (branch) { return branch.routeKey; }));
  routeKeys.forEach(function (routeKey) {
    const defaults = side.branches.filter(function (branch) {
      return branch.routeKey === routeKey && branch.isDefault;
    });
    if (defaults.length === 0) {
      addError(
        errors,
        'INTEGRATION_DEFAULT_BRANCH_MISSING',
        '$.' + sideName + '.branches[' + routeKey + '].default',
        1,
        0
      );
    } else if (defaults.length > 1) {
      addError(
        errors,
        'INTEGRATION_DEFAULT_BRANCH_MULTIPLE',
        '$.' + sideName + '.branches[' + routeKey + '].default',
        1,
        defaults.length
      );
    }
  });
  return valid;
}

function compareRuleList(expectedRules, actualRules, path, errors, options = {}) {
  const expected = Array.isArray(expectedRules) ? expectedRules : [];
  const actual = Array.isArray(actualRules) ? actualRules : [];
  const generalCode = options.generalCode || 'INTEGRATION_CONDITION_BOUNDARY_MISMATCH';
  if (expected.length !== actual.length) {
    addError(errors, generalCode, path + '.length', expected.length, actual.length);
  }
  const length = Math.min(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    const expectedRule = expected[index];
    const actualRule = actual[index];
    const rulePath = path + '[' + index + ']';
    if (!equalOptional(expectedRule.valueType, actualRule.valueType)) {
      addError(
        errors,
        'INTEGRATION_VALUE_TYPE_MISMATCH',
        rulePath + '.valueType',
        expectedRule.valueType,
        actualRule.valueType
      );
    }
    ['field', 'operator', 'value'].forEach(function (key) {
      if (!equalOptional(expectedRule[key], actualRule[key])) {
        addError(errors, generalCode, rulePath + '.' + key, expectedRule[key], actualRule[key]);
      }
    });
    ['sourceNode', 'sourceField'].forEach(function (key) {
      if (!equalOptional(expectedRule[key], actualRule[key])) {
        addError(
          errors,
          'INTEGRATION_REFERENCE_SOURCE_MISMATCH',
          rulePath + '.' + key,
          expectedRule[key],
          actualRule[key]
        );
      }
    });
  }
}

function compareAssignments(expectedAssignments, actualAssignments, path, errors) {
  compareRuleList(expectedAssignments, actualAssignments, path, errors, {
    generalCode: 'INTEGRATION_ASSIGNMENT_MISMATCH',
  });
}

function compareSendMessage(expected, actual, path, errors) {
  const expectedMessage = expected.sendMessage || {};
  const actualMessage = actual.sendMessage || {};
  ['recipients', 'title', 'content'].forEach(function (key) {
    if (!equal(expectedMessage[key], actualMessage[key])) {
      addError(
        errors,
        'INTEGRATION_ASSIGNMENT_MISMATCH',
        path + '.sendMessage.' + key,
        expectedMessage[key],
        actualMessage[key]
      );
    }
  });
}

function compareDataRetrieve(expected, actual, path, errors) {
  const expectedData = expected.dataRetrieve || {};
  const actualData = actual.dataRetrieve || {};
  ['sourceForm', 'emptyBehavior'].forEach(function (key) {
    if (expectedData[key] !== undefined && expectedData[key] !== actualData[key]) {
      addError(
        errors,
        'INTEGRATION_ASSIGNMENT_MISMATCH',
        path + '.dataRetrieve.' + key,
        expectedData[key],
        actualData[key]
      );
    }
  });
  compareRuleList(expectedData.query, actualData.query, path + '.dataRetrieve.query', errors);
  compareAssignments(expectedData.assignments, actualData.assignments, path + '.dataRetrieve.assignments', errors);
}

function compareDataCreate(expected, actual, path, errors) {
  const expectedData = expected.dataCreate || {};
  const actualData = actual.dataCreate || {};
  if (expectedData.targetForm !== actualData.targetForm) {
    addError(
      errors,
      'INTEGRATION_ASSIGNMENT_MISMATCH',
      path + '.dataCreate.targetForm',
      expectedData.targetForm,
      actualData.targetForm
    );
  }
  compareAssignments(expectedData.assignments, actualData.assignments, path + '.dataCreate.assignments', errors);
}

function compareDataUpdate(expected, actual, path, errors) {
  const expectedData = expected.dataUpdate || {};
  const actualData = actual.dataUpdate || {};
  if (expectedData.targetForm !== actualData.targetForm) {
    addError(
      errors,
      'INTEGRATION_DATA_UPDATE_CONDITION_MISMATCH',
      path + '.dataUpdate.targetForm',
      expectedData.targetForm,
      actualData.targetForm
    );
  }
  compareRuleList(expectedData.query, actualData.query, path + '.dataUpdate.query', errors, {
    generalCode: 'INTEGRATION_DATA_UPDATE_CONDITION_MISMATCH',
  });
  compareAssignments(expectedData.assignments, actualData.assignments, path + '.dataUpdate.assignments', errors);
  if (expectedData.sourceNode !== undefined && expectedData.sourceNode !== actualData.sourceNode) {
    addError(
      errors,
      'INTEGRATION_REFERENCE_SOURCE_MISMATCH',
      path + '.dataUpdate.sourceNode',
      expectedData.sourceNode,
      actualData.sourceNode
    );
  }
}

function compareInitiateApproval(expected, actual, path, errors) {
  const expectedApproval = expected.initiateApproval || {};
  const actualApproval = actual.initiateApproval || {};
  if (expectedApproval.targetForm !== actualApproval.targetForm) {
    addError(
      errors,
      'INTEGRATION_APPROVAL_TARGET_MISMATCH',
      path + '.initiateApproval.targetForm',
      expectedApproval.targetForm,
      actualApproval.targetForm
    );
  }
  if (!equal(expectedApproval.initiator, actualApproval.initiator)) {
    addError(
      errors,
      'INTEGRATION_ASSIGNMENT_MISMATCH',
      path + '.initiateApproval.initiator',
      expectedApproval.initiator,
      actualApproval.initiator
    );
  }
  compareAssignments(
    expectedApproval.assignments,
    actualApproval.assignments,
    path + '.initiateApproval.assignments',
    errors
  );
}

function compareConnector(expected, actual, path, errors) {
  const expectedConnector = expected.connector || {};
  const actualConnector = actual.connector || {};
  ['mode', 'connector'].forEach(function (key) {
    if (expectedConnector[key] !== actualConnector[key]) {
      addError(
        errors,
        'INTEGRATION_CONNECTOR_ACTION_MISMATCH',
        path + '.connector.' + key,
        expectedConnector[key],
        actualConnector[key]
      );
    }
  });
  if (expectedConnector.action !== actualConnector.action) {
    addError(
      errors,
      'INTEGRATION_CONNECTOR_ACTION_MISMATCH',
      path + '.connector.action',
      expectedConnector.action,
      actualConnector.action
    );
  }
  if (expectedConnector.connection !== actualConnector.connection) {
    addError(
      errors,
      'INTEGRATION_CONNECTOR_CONNECTION_MISMATCH',
      path + '.connector.connection',
      expectedConnector.connection,
      actualConnector.connection
    );
  }
  compareAssignments(expectedConnector.inputs, actualConnector.inputs, path + '.connector.inputs', errors);
  compareAssignments(expectedConnector.outputs, actualConnector.outputs, path + '.connector.outputs', errors);
}

function compareNodeConfig(expectedNode, actualNode, path, errors) {
  const expected = expectedNode.config || {};
  const actual = actualNode.config || {};
  if (expected.sendMessage) {
    compareSendMessage(expected, actual, path, errors);
  } else if (expected.dataRetrieve) {
    compareDataRetrieve(expected, actual, path, errors);
  } else if (expected.dataCreate) {
    compareDataCreate(expected, actual, path, errors);
  } else if (expected.dataUpdate) {
    compareDataUpdate(expected, actual, path, errors);
  } else if (expected.initiateApproval) {
    compareInitiateApproval(expected, actual, path, errors);
  } else if (expected.connector) {
    compareConnector(expected, actual, path, errors);
  } else if (!equal(expected, actual)) {
    addError(errors, 'INTEGRATION_ASSIGNMENT_MISMATCH', path, expected, actual);
  }
}

function compareTrigger(expected, actual, path, errors) {
  if (!actual) {
    addError(errors, 'INTEGRATION_TRIGGER_MISSING', path, expected, null);
    return;
  }
  if (!equal(expected.eventTypes || [], actual.eventTypes || [])) {
    addError(
      errors,
      'INTEGRATION_TRIGGER_EVENT_MISMATCH',
      path + '.eventTypes',
      expected.eventTypes || [],
      actual.eventTypes || []
    );
  }
  ['key', 'type', 'componentName', 'recursive'].forEach(function (key) {
    if (expected[key] !== undefined && expected[key] !== actual[key]) {
      addError(
        errors,
        key === 'type' || key === 'componentName'
          ? 'INTEGRATION_NODE_TYPE_MISMATCH'
          : 'INTEGRATION_ASSIGNMENT_MISMATCH',
        path + '.' + key,
        expected[key],
        actual[key]
      );
    }
  });
  compareRuleList(expected.conditions, actual.conditions, path + '.conditions', errors);
}

function compareNodes(expectedNodes, actualNodes, path, errors) {
  const expected = Array.isArray(expectedNodes) ? expectedNodes : [];
  const actual = Array.isArray(actualNodes) ? actualNodes : [];
  const expectedByKey = indexBy(expected, 'key');
  const actualByKey = indexBy(actual, 'key');

  expected.forEach(function (expectedNode) {
    if (!actualByKey.has(expectedNode.key)) {
      addError(
        errors,
        'INTEGRATION_NODE_MISSING',
        path + '[' + expectedNode.key + ']',
        expectedNode,
        null
      );
    }
  });
  actual.forEach(function (actualNode) {
    if (!expectedByKey.has(actualNode.key)) {
      addError(
        errors,
        'INTEGRATION_EXTRA_NODE',
        path + '[' + actualNode.key + ']',
        null,
        actualNode
      );
    }
  });

  const expectedOrder = expected.map(function (node) { return node.key; });
  const actualKnownOrder = actual
    .filter(function (node) { return expectedByKey.has(node.key); })
    .map(function (node) { return node.key; });
  if (!equal(expectedOrder, actualKnownOrder)) {
    addError(
      errors,
      'INTEGRATION_NODE_ORDER_MISMATCH',
      path + '.order',
      expectedOrder,
      actualKnownOrder
    );
  }

  expected.forEach(function (expectedNode) {
    const actualNode = actualByKey.get(expectedNode.key);
    if (!actualNode) {
      return;
    }
    const nodePath = path + '[' + expectedNode.key + ']';
    ['type', 'componentName'].forEach(function (key) {
      if (expectedNode[key] !== actualNode[key]) {
        addError(
          errors,
          'INTEGRATION_NODE_TYPE_MISMATCH',
          nodePath + '.' + key,
          expectedNode[key],
          actualNode[key]
        );
      }
    });
    if (expectedNode.name !== actualNode.name) {
      addError(
        errors,
        'INTEGRATION_ASSIGNMENT_MISMATCH',
        nodePath + '.name',
        expectedNode.name,
        actualNode.name
      );
    }
    if (!equal(expectedNode.nextKeys || [], actualNode.nextKeys || [])) {
      addError(
        errors,
        expectedNode.type === 'route'
          ? 'INTEGRATION_ROUTE_TARGET_MISMATCH'
          : 'INTEGRATION_NODE_ORDER_MISMATCH',
        nodePath + '.nextKeys',
        expectedNode.nextKeys || [],
        actualNode.nextKeys || []
      );
    }
    compareNodeConfig(expectedNode, actualNode, nodePath + '.config', errors);
  });
}

function compareBranches(expectedBranches, actualBranches, path, errors) {
  const expected = Array.isArray(expectedBranches) ? expectedBranches : [];
  const actual = Array.isArray(actualBranches) ? actualBranches : [];
  const expectedByKey = indexBy(expected, 'key');
  const actualByKey = indexBy(actual, 'key');

  expected.forEach(function (expectedBranch) {
    const actualBranch = actualByKey.get(expectedBranch.key);
    const branchPath = path + '[' + expectedBranch.key + ']';
    if (!actualBranch) {
      addError(errors, 'INTEGRATION_NODE_MISSING', branchPath, expectedBranch, null);
      return;
    }
    ['routeKey', 'targetKey'].forEach(function (key) {
      if (expectedBranch[key] !== actualBranch[key]) {
        addError(
          errors,
          'INTEGRATION_ROUTE_TARGET_MISMATCH',
          branchPath + '.' + key,
          expectedBranch[key],
          actualBranch[key]
        );
      }
    });
    if (expectedBranch.logic !== actualBranch.logic) {
      addError(
        errors,
        'INTEGRATION_CONDITION_LOGIC_MISMATCH',
        branchPath + '.logic',
        expectedBranch.logic,
        actualBranch.logic
      );
    }
    ['name', 'isDefault', 'priority'].forEach(function (key) {
      if (expectedBranch[key] !== actualBranch[key]) {
        let code = 'INTEGRATION_CONDITION_BOUNDARY_MISMATCH';
        if (key === 'isDefault') {
          code = expectedBranch.isDefault
            ? 'INTEGRATION_DEFAULT_BRANCH_MISSING'
            : 'INTEGRATION_DEFAULT_BRANCH_MULTIPLE';
        }
        addError(
          errors,
          code,
          branchPath + '.' + key,
          expectedBranch[key],
          actualBranch[key]
        );
      }
    });
    compareRuleList(expectedBranch.rules, actualBranch.rules, branchPath + '.rules', errors);
  });
  actual.forEach(function (actualBranch) {
    if (!expectedByKey.has(actualBranch.key)) {
      addError(
        errors,
        'INTEGRATION_EXTRA_NODE',
        path + '[' + actualBranch.key + ']',
        null,
        actualBranch
      );
    }
  });
}

function compareProcessView(expectedSemantic, processSide, viewSide, errors) {
  compareTrigger(expectedSemantic.trigger, viewSide.trigger, '$.view.trigger', errors);
  const processByKey = indexBy(processSide.nodes, 'key');
  const viewByKey = indexBy(viewSide.nodes, 'key');
  const processOrder = processSide.nodes.map(function (node) { return node.key; });
  const viewOrder = viewSide.nodes.map(function (node) { return node.key; });
  if (!equal(processOrder, viewOrder)) {
    addError(
      errors,
      'INTEGRATION_PROCESS_VIEW_MISMATCH',
      '$.view.nodes.order',
      processOrder,
      viewOrder
    );
  }
  processByKey.forEach(function (processNode, key) {
    if (!viewByKey.has(key)) {
      addError(
        errors,
        'INTEGRATION_PROCESS_VIEW_MISMATCH',
        '$.view.nodes[' + key + ']',
        processNode,
        null
      );
    }
  });
  viewByKey.forEach(function (viewNode, key) {
    if (!processByKey.has(key)) {
      addError(
        errors,
        'INTEGRATION_PROCESS_VIEW_MISMATCH',
        '$.view.nodes[' + key + ']',
        null,
        viewNode
      );
    }
  });
  (expectedSemantic.nodes || []).forEach(function (expectedNode) {
    const processNode = processByKey.get(expectedNode.key);
    const viewNode = viewByKey.get(expectedNode.key);
    const path = '$.view.nodes[' + expectedNode.key + ']';
    if (!viewNode) {
      addError(errors, 'INTEGRATION_PROCESS_VIEW_MISMATCH', path, expectedNode, null);
      return;
    }
    if (!processNode
      || processNode.type !== viewNode.type
      || processNode.componentName !== viewNode.componentName
      || processNode.name !== viewNode.name) {
      addError(
        errors,
        'INTEGRATION_PROCESS_VIEW_MISMATCH',
        path,
        processNode && {
          type: processNode.type,
          componentName: processNode.componentName,
          name: processNode.name,
        },
        {
          type: viewNode.type,
          componentName: viewNode.componentName,
          name: viewNode.name,
        }
      );
    }
    if (processNode
      && Array.isArray(viewNode.nextKeys)
      && viewNode.nextKeys.length > 0
      && !equal(processNode.nextKeys || [], viewNode.nextKeys)) {
      addError(
        errors,
        'INTEGRATION_PROCESS_VIEW_MISMATCH',
        path + '.nextKeys',
        processNode.nextKeys || [],
        viewNode.nextKeys
      );
    }
    const localErrors = [];
    compareNodeConfig(expectedNode, viewNode, path + '.config', localErrors);
    localErrors.forEach(function (item) {
      addError(
        errors,
        'INTEGRATION_PROCESS_VIEW_MISMATCH',
        item.path,
        item.expected,
        item.actual
      );
    });
  });

  const processBranches = indexBy(processSide.branches, 'key');
  const viewBranches = indexBy(viewSide.branches, 'key');
  processBranches.forEach(function (processBranch, key) {
    if (!viewBranches.has(key)) {
      addError(
        errors,
        'INTEGRATION_PROCESS_VIEW_MISMATCH',
        '$.view.branches[' + key + ']',
        processBranch,
        null
      );
    }
  });
  viewBranches.forEach(function (viewBranch, key) {
    if (!processBranches.has(key)) {
      addError(
        errors,
        'INTEGRATION_PROCESS_VIEW_MISMATCH',
        '$.view.branches[' + key + ']',
        null,
        viewBranch
      );
    }
  });
  (expectedSemantic.branches || []).forEach(function (expectedBranch) {
    const processBranch = processBranches.get(expectedBranch.key);
    const viewBranch = viewBranches.get(expectedBranch.key);
    const representedViewBranch = viewBranch && processBranch
      ? Object.keys(processBranch).every(function (key) {
        if (key === 'targetKey'
          && viewBranch.targetKey === null
          && processBranch.isDefault === true) {
          return true;
        }
        return equal(processBranch[key], viewBranch[key]);
      })
      : false;
    if (!viewBranch || !processBranch || !representedViewBranch) {
      addError(
        errors,
        'INTEGRATION_PROCESS_VIEW_MISMATCH',
        '$.view.branches[' + expectedBranch.key + ']',
        processBranch,
        viewBranch
      );
    }
  });
}

function verifyIntegrationContract(expectedContract, canonicalIntegration) {
  const errors = [];
  if (!isPlainObject(expectedContract)
    || expectedContract.schemaVersion !== 1
    || !isPlainObject(expectedContract.semantic)) {
    addError(
      errors,
      'INTEGRATION_CONTRACT_STRUCTURE_INVALID',
      '$.contract',
      { schemaVersion: 1, semantic: 'object' },
      expectedContract
    );
    return { valid: false, errors };
  }
  if (!validateContractSemanticIntegrity(expectedContract.semantic, errors)) {
    return { valid: false, errors };
  }
  if (!isPlainObject(canonicalIntegration)
    || canonicalIntegration.schemaVersion !== 1
    || canonicalIntegration.artifactKind !== 'definition') {
    addError(
      errors,
      'INTEGRATION_CANONICAL_STRUCTURE_INVALID',
      '$',
      { schemaVersion: 1, artifactKind: 'definition' },
      canonicalIntegration
    );
    return { valid: false, errors };
  }
  if (expectedContract.artifactKind
    && expectedContract.artifactKind !== canonicalIntegration.artifactKind) {
    addError(
      errors,
      'INTEGRATION_CANONICAL_STRUCTURE_INVALID',
      '$.artifactKind',
      expectedContract.artifactKind,
      canonicalIntegration.artifactKind
    );
  }

  const processStructureValid = validateSideIntegrity(canonicalIntegration.process, 'process', errors);
  const viewStructureValid = validateSideIntegrity(canonicalIntegration.view, 'view', errors);
  if (!processStructureValid || !viewStructureValid) {
    return { valid: false, errors };
  }

  const semantic = expectedContract.semantic;
  compareTrigger(semantic.trigger, canonicalIntegration.process.trigger, '$.process.trigger', errors);
  compareNodes(semantic.nodes, canonicalIntegration.process.nodes, '$.process.nodes', errors);
  compareBranches(semantic.branches, canonicalIntegration.process.branches, '$.process.branches', errors);

  if (semantic.requireProcessViewConsistency) {
    compareProcessView(semantic, canonicalIntegration.process, canonicalIntegration.view, errors);
  }

  const expectedControl = semantic.control || expectedContract.control;
  if (expectedControl && !equal(expectedControl, canonicalIntegration.control)) {
    addError(
      errors,
      'INTEGRATION_ASSIGNMENT_MISMATCH',
      '$.control',
      expectedControl,
      canonicalIntegration.control
    );
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  compareAssignments,
  compareBranches,
  compareNodeConfig,
  compareNodes,
  compareRuleList,
  contractError,
  verifyIntegrationContract,
};
