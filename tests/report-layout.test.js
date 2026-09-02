'use strict';

const {
  assertReportLayout,
  packReportLayout,
} = require('../lib/report/layout');

describe('report RGL layout packer', () => {
  test('uses the tallest item in a mixed-height row when wrapping', () => {
    const layout = packReportLayout([
      { i: 'a', w: 2, h: 10 },
      { i: 'b', w: 4, h: 20 },
      { i: 'c', w: 3, h: 5 },
      { i: 'd', w: 3, h: 7 },
    ]);

    expect(layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))).toEqual([
      { i: 'a', x: 0, y: 0, w: 2, h: 10 },
      { i: 'b', x: 2, y: 0, w: 4, h: 20 },
      { i: 'c', x: 0, y: 20, w: 3, h: 5 },
      { i: 'd', x: 3, y: 20, w: 3, h: 7 },
    ]);
    expect(() => assertReportLayout(layout)).not.toThrow();
  });

  test('appends below an existing layout and preserves non-overlap', () => {
    const existingLayout = [
      { i: 'old-a', x: 0, y: 0, w: 3, h: 10 },
      { i: 'old-b', x: 3, y: 0, w: 3, h: 20 },
    ];
    const appended = packReportLayout([
      { i: 'new-a', w: 3, h: 8 },
      { i: 'new-b', w: 3, h: 6 },
    ], { existingLayout });

    expect(appended[0]).toMatchObject({ i: 'new-a', x: 0, y: 20 });
    expect(appended[1]).toMatchObject({ i: 'new-b', x: 3, y: 20 });
    expect(() => assertReportLayout([...existingLayout, ...appended])).not.toThrow();
  });

  test.each([
    [{ i: 'a', w: 0, h: 1 }],
    [{ i: 'a', w: 7, h: 1 }],
    [{ i: 'a', w: 2.5, h: 1 }],
    [{ i: 'a', w: 1, h: -1 }],
  ])('rejects invalid dimensions before packing', (items) => {
    expect(() => packReportLayout(items)).toThrow(expect.objectContaining({
      code: 'REPORT_LAYOUT_INVALID',
    }));
  });

  test('rejects overlapping existing layouts', () => {
    expect(() => assertReportLayout([
      { i: 'a', x: 0, y: 0, w: 4, h: 10 },
      { i: 'b', x: 3, y: 5, w: 3, h: 10 },
    ])).toThrow(expect.objectContaining({
      code: 'REPORT_LAYOUT_OVERLAP',
    }));
  });
});
