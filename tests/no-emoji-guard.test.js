'use strict';

const {
  assertNoEmojiInText,
  assertNoEmojiInValue,
  findEmojiInText,
  findEmojiInValue,
} = require('../lib/core/no-emoji-guard');

describe('no emoji artifact guard', () => {
  test('finds emoji in text with stable line and column', () => {
    const issues = findEmojiInText('const title = "已完成 ✅";\nconst ok = true;\n', {
      artifact: 'page.jsx',
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      artifact: 'page.jsx',
      emoji: '✅',
      line: 1,
      column: 20,
    });
  });

  test('finds emoji recursively in schema-like objects', () => {
    const issues = findEmojiInValue({
      fields: [
        { label: '客户状态 📊' },
      ],
    }, {
      artifact: 'form schema',
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      artifact: 'form schema',
      path: 'fields[0].label',
      emoji: '📊',
    });
  });

  test('throws artifact errors with machine-readable details', () => {
    expect(() => assertNoEmojiInText('<div>✅ 已完成</div>', {
      artifact: 'home.canvas.jsx',
      code: 'OPENYIDA_PAGE_SOURCE_EMOJI_FORBIDDEN',
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_PAGE_SOURCE_EMOJI_FORBIDDEN',
      details: expect.objectContaining({
        artifact: 'home.canvas.jsx',
        issues: expect.any(Array),
      }),
    }));

    expect(() => assertNoEmojiInValue({ title: '任务 🚀' }, {
      artifact: 'form schema',
    })).toThrow(/contains emoji/);
  });
});
