'use strict';

const { transformSync } = require('@babel/core');

// Keep compilation independent of project Babel and Browserslist configuration.
function transform(source, options = {}) {
  return transformSync(source, {
    ...options,
    babelrc: false,
    configFile: false,
    browserslistConfigFile: false,
  });
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
