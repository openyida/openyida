'use strict';

const {
  buildTemplateVariablesFromIr,
  normalizePageSpec,
} = require('../lib/app/page-ir');

describe('page IR', () => {
  test('normalizes legacy product homepage fields into blocks', () => {
    const ir = normalizePageSpec({
      template: 'product-homepage',
      brandName: 'OpenKuma',
      brandInitials: 'OK',
      tagline: '开放项目首页工作台',
      heroText: '把品牌展示、社区入口和运营反馈放进同一个宜搭页面',
    });

    expect(ir.irVersion).toBe('1.0');
    expect(ir.template).toBe('product-homepage');
    expect(ir.blocks.map((block) => block.type)).toEqual([
      'hero',
      'feature-grid',
      'metric-strip',
      'roadmap',
      'cta',
    ]);
    expect(ir.blocks[0].brandName).toBe('OpenKuma');
    expect(ir.blocks[1].items).toHaveLength(3);
  });

  test('normalizes block specs and builds escaped template variables', () => {
    const ir = normalizePageSpec({
      template: 'product-homepage',
      variables: {
        BRAND_NAME: "Kuma's Lab",
        BRAND_INITIALS: 'KL',
      },
      blocks: [
        {
          type: 'feature-grid',
          title: '能力清单',
          items: [
            { name: '模板', description: '少写 JSX，多填结构。' },
          ],
        },
        {
          type: 'metric-strip',
          items: [
            { value: '10+', label: '生成块' },
          ],
        },
        {
          type: 'roadmap',
          title: '节奏',
          items: [
            { title: '生成', summary: '先出页面。' },
          ],
        },
      ],
    }, {
      variables: {
        'cta-title': '下一步',
      },
    });
    const variables = buildTemplateVariablesFromIr(ir);

    expect(variables.BRAND_NAME).toBe("Kuma\\'s Lab");
    expect(variables.OPENYIDA_BLOCKS).toBe('hero,feature-grid,metric-strip,roadmap,cta');
    expect(variables.FEATURES_TITLE).toBe('能力清单');
    expect(variables.CTA_TITLE).toBe('下一步');

    const features = JSON.parse(variables.FEATURES_JSON.replace(/\\\\/g, '\\'));
    expect(features[0]).toEqual({
      title: '模板',
      text: '少写 JSX，多填结构。',
    });
  });

  test('normalizes TodoMVC specs into interaction blocks', () => {
    const ir = normalizePageSpec({
      template: 'todo-mvc',
      title: '团队待办',
      storageKey: 'openyida.team.todos',
      todos: [
        { content: '设计字段模型', done: false },
        { title: '发布页面', status: 'completed' },
      ],
    });
    const variables = buildTemplateVariablesFromIr(ir);

    expect(ir.template).toBe('todo-mvc');
    expect(ir.blocks.map((block) => block.type)).toEqual([
      'todo-shell',
      'todo-list',
      'todo-actions',
      'persistence',
    ]);
    expect(ir.blocks[0].title).toBe('团队待办');
    expect(ir.blocks[3].storageKey).toBe('openyida.team.todos');
    expect(ir.blocks[1].items[1]).toMatchObject({
      content: '发布页面',
      done: true,
    });
    expect(variables.TODO_TITLE).toBe('团队待办');
    expect(variables.OPENYIDA_BLOCKS).toBe('todo-shell,todo-list,todo-actions,persistence');
    expect(JSON.parse(variables.TODO_ITEMS_JSON.replace(/\\\\/g, '\\'))).toHaveLength(2);
  });
});
