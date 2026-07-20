'use strict';

const { schemaError } = require('./errors');
const { sortStrings } = require('./sort');

function resourceId(resource) {
  return `${resource.resourceType}:${resource.key}`;
}

function validateDependencyGraph(resources) {
  const byId = new Map(resources.map(resource => [resourceId(resource), resource]));
  const edges = new Map();

  for (const resource of resources) {
    const id = resourceId(resource);
    const dependencies = sortStrings(resource.dependsOn || []);
    edges.set(id, dependencies);
    for (const target of dependencies) {
      if (!byId.has(target)) {
        const source = firstDependencySource(resource, target);
        const code = source && source.kind === 'reference'
          ? 'SCHEMA_REFERENCE_NOT_FOUND'
          : 'SCHEMA_DEPENDENCY_NOT_FOUND';
        throw schemaError(code, 'Resource dependency target does not exist.', {
          path: source && source.path,
          details: {
            resource: id,
            target,
          },
        });
      }
    }
  }

  detectCycle(edges);
}

function firstDependencySource(resource, target) {
  const sources = resource.dependencySources && resource.dependencySources[target];
  return Array.isArray(sources) && sources.length > 0 ? sources[0] : undefined;
}

function detectCycle(edges) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(id) {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      const cycle = stack.slice(start).concat(id);
      throw schemaError('SCHEMA_DEPENDENCY_CYCLE', 'Manifest resource dependencies must not contain cycles.', {
        details: { cycle },
      });
    }

    visiting.add(id);
    stack.push(id);
    for (const target of edges.get(id) || []) {
      visit(target);
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of sortStrings(edges.keys())) {
    visit(id);
  }
}

function countDependencies(resources) {
  return resources.reduce((total, resource) => total + (resource.dependsOn || []).length, 0);
}

module.exports = {
  countDependencies,
  resourceId,
  validateDependencyGraph,
};
