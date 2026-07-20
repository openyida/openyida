'use strict';

const {
  buildTemplateVariablesFromIr,
  inferThemeScopeFromSpec,
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
    expect(ir.visualProfile).toMatchObject({
      name: 'yida-app-theme',
      density: 'business-compact',
      neutral: 'yida-blue-gray',
      corner: 'layered',
    });
    expect(ir.themeProfile).toMatchObject({
      name: 'yida-app-theme',
      followRuntimeTheme: true,
      themeColorSource: 'runtime-css-vars',
      themeColor: '#6B7CAB',
      mode: 'color_color',
      colorMode: 'gradient',
    });
    expect(ir.themeScope).toBe('page');
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
      scene: 'dashboard',
      visualProfile: {
        name: 'ops-dashboard',
        neutral: 'cool-gray',
        corner: 'micro',
        motif: ['kpi-first', 'status-band'],
      },
      themeProfile: {
        name: 'ops-shell',
        themeColor: '#334455',
        themeColorDeep: '#223344',
        themeColorSoft: '#EEF3F6',
        colorMode: 'normal',
      },
      themeScope: 'app',
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

    expect(ir.scene).toBe('dashboard');
    expect(ir.visualProfile).toMatchObject({
      name: 'ops-dashboard',
      scene: 'dashboard',
      neutral: 'cool-gray',
      corner: 'micro',
    });
    expect(ir.visualProfile.motif).toEqual(['kpi-first', 'status-band']);
    expect(ir.themeProfile).toMatchObject({
      name: 'ops-shell',
      followRuntimeTheme: false,
      themeColorSource: 'profile',
      themeColor: '#334455',
      themeColorDeep: '#223344',
      colorMode: 'normal',
    });
    expect(ir.themeScope).toBe('app');
    expect(variables.BRAND_NAME).toBe("Kuma\\'s Lab");
    expect(variables.OPENYIDA_SCENE).toBe('dashboard');
    expect(variables.OPENYIDA_VISUAL_PROFILE).toBe('ops-dashboard');
    expect(variables.OPENYIDA_THEME_PROFILE).toBe('ops-shell');
    expect(variables.OPENYIDA_THEME_SCOPE).toBe('app');
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
    expect(ir.themeScope).toBe('page');
    expect(ir.themeProfile.name).toBe('yida-app-theme');
    expect(ir.themeProfile.followRuntimeTheme).toBe(true);
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

  test('normalizes official homepage and data screen templates into distinct scenes', () => {
    const official = normalizePageSpec({
      template: 'official-homepage',
      brandName: '恒信律师事务所',
      requirement: '创建律所官网首页',
      assets: {
        heroImage: 'https://example.com/hero.jpg',
        productImages: [{ url: 'https://example.com/product.jpg', alt: '产品图' }],
      },
    });
    expect(official.template).toBe('official-homepage');
    expect(official.scene).toBe('landing');
    expect(official.visualProfile.tone).toBe('editorial-trust');
    expect(official.assets.heroImage).toBe('https://example.com/hero.jpg');
    expect(official.assets.productImages[0].alt).toBe('产品图');

    const variables = buildTemplateVariablesFromIr(official);
    const assets = JSON.parse(variables.ASSETS_JSON.replace(/\\\\/g, '\\'));
    expect(assets.heroImage).toBe('https://example.com/hero.jpg');

    const screen = normalizePageSpec({
      template: 'data-screen',
      brandName: '水质情况实时监测预警系统',
      requirement: '创建实时监控预警数据大屏',
    });
    expect(screen.template).toBe('data-screen');
    expect(screen.scene).toBe('screen');
    expect(screen.visualProfile.tone).toBe('immersive-command');
  });

  test('normalizes dedicated workbench, dashboard, list and detail templates', () => {
    const cases = [
      ['workbench-home', 'workbench', 'yida-business'],
      ['dashboard-overview', 'dashboard', 'dense-confident'],
      ['business-list', 'list', 'quiet-efficient'],
      ['data-management', 'list', 'quiet-efficient'],
      ['detail-profile', 'detail', 'precise-narrative'],
      ['split-pane-detail', 'list', 'quiet-efficient'],
      ['portal-shell-home', 'workbench', 'yida-business'],
    ];

    cases.forEach(([template, scene, tone]) => {
      const ir = normalizePageSpec({
        template,
        brandName: template,
      });

      expect(ir.template).toBe(template);
      expect(ir.scene).toBe(scene);
      expect(ir.visualProfile.tone).toBe(tone);
      expect(ir.blocks.map((block) => block.type)).toEqual([
        'hero',
        'feature-grid',
        'metric-strip',
        'roadmap',
        'cta',
      ]);

      const variables = buildTemplateVariablesFromIr(ir);
      expect(variables.OPENYIDA_TEMPLATE).toBe(template);
      expect(variables.OPENYIDA_SCENE).toBe(scene);
    });
  });

  test('normalizes data binding into IR and template variables', () => {
    const ir = normalizePageSpec({
      template: 'business-list',
      brandName: '订单管理',
      dataBinding: {
        mode: 'form',
        appType: 'APP_XXX',
        formUuid: 'FORM-ORDER',
        pageSize: 30,
        fields: {
          code: 'textField_orderNo',
          summary: 'textareaField_desc',
          status: 'selectField_status',
        },
      },
    });
    const variables = buildTemplateVariablesFromIr(ir);
    const binding = JSON.parse(variables.OPENYIDA_DATA_BINDING_JSON.replace(/\\\\/g, '\\'));

    expect(ir.dataBinding).toMatchObject({
      mode: 'form',
      enabled: true,
      appType: 'APP_XXX',
      formUuid: 'FORM-ORDER',
      pageSize: 30,
    });
    expect(ir.dataBinding.fields.code).toBe('textField_orderNo');
    expect(binding.formUuid).toBe('FORM-ORDER');
    expect(binding.fields.status).toBe('selectField_status');
  });

  test('preserves P1 design decision fields in IR and template variables', () => {
    const ir = normalizePageSpec({
      template: 'dashboard-overview',
      brandName: '经销商经营看板',
      researchLevel: 'light',
      archetype: 'analysis',
      appBlueprint: {
        appName: '奶茶渠道增长应用',
        entry: '品牌官网首页',
        shell: 'side_nav',
        roles: ['消费者', '经销商'],
        navigation: ['品牌展示', '经销商经营'],
        pages: [
          { name: '品牌官网首页', scene: 'landing', template: 'official-homepage', audience: ['消费者'] },
          { name: '经销商经营看板', scene: 'dashboard', template: 'dashboard-overview', audience: ['经销商'] },
        ],
      },
      interactionProfile: {
        primaryAction: '查看本周经营',
        detailMode: 'drawer',
        bulkActions: ['导出巡店建议'],
        states: ['loading', 'empty', 'error'],
      },
      insights: [
        {
          conclusion: '华东区贡献 43%',
          evidence: '环比 +5.2pp',
          suggestion: '优先补货高增长门店',
        },
      ],
    });
    const variables = buildTemplateVariablesFromIr(ir);

    expect(ir.researchLevel).toBe('light');
    expect(ir.archetype).toBe('analysis');
    expect(ir.visualProfile.archetype).toBe('analysis');
    expect(ir.appBlueprint).toMatchObject({
      appName: '奶茶渠道增长应用',
      shell: 'side_nav',
      roles: ['消费者', '经销商'],
    });
    expect(ir.appBlueprint.pages).toHaveLength(2);
    expect(ir.interactionProfile).toMatchObject({
      primaryAction: '查看本周经营',
      detailMode: 'drawer',
      bulkActions: ['导出巡店建议'],
    });
    expect(ir.insights[0]).toMatchObject({
      conclusion: '华东区贡献 43%',
      evidence: '环比 +5.2pp',
      suggestion: '优先补货高增长门店',
    });
    expect(variables.OPENYIDA_RESEARCH_LEVEL).toBe('light');
    expect(variables.OPENYIDA_ARCHETYPE).toBe('analysis');
    expect(JSON.parse(variables.OPENYIDA_APP_BLUEPRINT_JSON.replace(/\\\\/g, '\\')).roles).toEqual(['消费者', '经销商']);
    expect(JSON.parse(variables.OPENYIDA_INTERACTION_PROFILE_JSON.replace(/\\\\/g, '\\')).detailMode).toBe('drawer');
    expect(JSON.parse(variables.OPENYIDA_INSIGHTS_JSON.replace(/\\\\/g, '\\'))[0].conclusion).toBe('华东区贡献 43%');
  });

  test('infers app theme scope from natural language shell and navigation intent', () => {
    expect(inferThemeScopeFromSpec({
      requirement: '页面要绿色，左侧导航也要一起变色，顶部壳层和内容区保持统一。',
    })).toBe('app');

    const ir = normalizePageSpec({
      template: 'product-homepage',
      description: '把整个应用统一换肤成绿色，菜单也同步改色。',
    });

    expect(ir.themeScope).toBe('app');
  });

  test('keeps page theme scope when natural language asks not to affect navigation', () => {
    expect(inferThemeScopeFromSpec({
      requirement: '只美化当前自定义页面，不要影响左侧导航和应用其他页面。',
    })).toBe('page');

    const ir = normalizePageSpec({
      template: 'product-homepage',
      description: '做一个绿色首页，只改当前页面，不需要导航一起换肤。',
    });

    expect(ir.themeScope).toBe('page');
  });
});
