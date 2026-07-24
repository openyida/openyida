'use strict';

const {
  assertNoEmojiInArtifactName,
  assertNoEmojiInText,
  assertNoEmojiInValue,
  findEmojiInArtifactName,
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

  test('finds unicode escape sequences that decode to emoji', () => {
    const issues = findEmojiInText('const icon = "\\u2705";\nconst chart = "\\u{1F4CA}";\nconst rocket = "\\uD83D\\uDE80";\n', {
      artifact: 'page.jsx',
    });

    expect(issues.map(issue => ({
      emoji: issue.emoji,
      escape: issue.escape,
      escaped: issue.escaped,
    }))).toEqual([
      { emoji: '✅', escape: '\\u2705', escaped: true },
      { emoji: '📊', escape: '\\u{1F4CA}', escaped: true },
      { emoji: '🚀', escape: '\\uD83D\\uDE80', escaped: true },
    ]);
  });

  test('finds emoji in artifact filenames', () => {
    const issues = findEmojiInArtifactName('pages/src/home-✅.jsx');

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      artifact: 'pages/src/home-✅.jsx',
      path: 'filePath',
      emoji: '✅',
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

    expect(() => assertNoEmojiInArtifactName('pages/src/home-📊.jsx', {
      code: 'OPENYIDA_PAGE_FILENAME_EMOJI_FORBIDDEN',
    })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_PAGE_FILENAME_EMOJI_FORBIDDEN',
    }));
  });
});
