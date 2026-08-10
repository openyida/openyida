'use strict';

const {
  PAGE_COMPILER_MODE_CANVAS,
  PAGE_COMPILER_MODE_NATIVE,
  assertPageCompilerMode,
  isCanvasSourcePath,
  resolvePageCompilerMode,
} = require('../lib/app/page-compiler-routing');
const { compileSource } = require('../lib/app/page-compiler');

describe('page compiler routing', () => {
  test.each([
    ['home.canvas.jsx', true],
    ['home.canvas.tsx', true],
    ['home.CANVAS.JSX', true],
    ['home.oyd.jsx', false],
    ['home.jsx', false],
  ])('classifies %s once for every command', (sourcePath, expectedCanvas) => {
    expect(isCanvasSourcePath(sourcePath)).toBe(expectedCanvas);
    expect(resolvePageCompilerMode(sourcePath)).toBe(
      expectedCanvas ? PAGE_COMPILER_MODE_CANVAS : PAGE_COMPILER_MODE_NATIVE
    );
  });

  test('explicit --canvas can force Canvas mode for a legacy filename', () => {
    expect(resolvePageCompilerMode('legacy.jsx', { forceCanvas: true }))
      .toBe(PAGE_COMPILER_MODE_CANVAS);
  });

  test('native compiler rejects Canvas source even when called directly', () => {
    expect(() => compileSource('/tmp/home.canvas.jsx')).toThrow(expect.objectContaining({
      code: 'OPENYIDA_PAGE_COMPILER_MISMATCH',
      details: expect.objectContaining({
        expectedMode: PAGE_COMPILER_MODE_CANVAS,
        actualMode: PAGE_COMPILER_MODE_NATIVE,
      }),
    }));
  });

  test('shared assertion reports compiler mismatch with stable metadata', () => {
    expect(() => assertPageCompilerMode('home.canvas.tsx', PAGE_COMPILER_MODE_NATIVE))
      .toThrow(expect.objectContaining({
        code: 'OPENYIDA_PAGE_COMPILER_MISMATCH',
        details: expect.objectContaining({
          stage: 'compiler_routing',
          sourcePath: 'home.canvas.tsx',
        }),
      }));
  });
});
