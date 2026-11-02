'use strict';

const { transformSync } = require('@babel/core');

// Compile user page source without loading Babel configuration from its project.
function transform(source, options = {}) {
  return transformSync(source, { ...options, babelrc: false, configFile: false });
}

module.exports = {
  transform,
  presets: {
    // AST guards and Canvas compilation do not need the legacy env preset.
    get env() { return require('@babel/preset-env'); },
    get react() { return require('@babel/preset-react'); },
    get typescript() { return require('@babel/preset-typescript'); },
  },
  packages: {
    parser: require('@babel/parser'),
    traverse: require('@babel/traverse'),
    generator: require('@babel/generator'),
    types: require('@babel/types'),
  },
};
