'use strict';

const publish = require('../lib/app/publish');

describe('publish argument parsing', () => {
  test('always auto-orders navigation after Code Canvas publish', () => {
    expect(publish.shouldAutoOrderNavigation(true, false)).toBe(true);
    expect(publish.shouldAutoOrderNavigation(false, true)).toBe(true);
    expect(publish.shouldAutoOrderNavigation(false, false)).toBe(false);
  });

  test('uses source-first order for the public CLI contract', () => {
    expect(publish.parseArgs([
      'pages/src/home.oyd.jsx',
      'APP_XXX',
      'FORM-XXX',
      '--health-check',
      '--no-open',
    ])).toMatchObject({
      sourceFile: 'pages/src/home.oyd.jsx',
      appType: 'APP_XXX',
      formUuid: 'FORM-XXX',
      healthCheck: true,
      autoNavOrder: false,
      browserOpenMode: false,
    });
  });

  test('parses auto navigation order as an explicit publish option', () => {
    expect(publish.parseArgs([
      'pages/src/home.canvas.jsx',
      'APP_XXX',
      'FORM-XXX',
      '--auto-nav-order',
      '--health-check',
    ])).toMatchObject({
      sourceFile: 'pages/src/home.canvas.jsx',
      appType: 'APP_XXX',
      formUuid: 'FORM-XXX',
      healthCheck: true,
      autoNavOrder: true,
    });
  });

  test('keeps older positional publish.js order compatible', () => {
    expect(publish.parseArgs([
      'APP_XXX',
      'FORM-XXX',
      'pages/src/home.oyd.jsx',
      '--force',
    ])).toMatchObject({
      sourceFile: 'pages/src/home.oyd.jsx',
      appType: 'APP_XXX',
      formUuid: 'FORM-XXX',
      force: true,
    });
  });
});
