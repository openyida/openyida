'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('DingTalk OpenAPI skill contract', () => {
  test('routes official server APIs through the dedicated skill and rejects unsupported event subscriptions', () => {
    const root = read('yida-skills/SKILL.md');
    const index = JSON.parse(read('yida-skills/skills-index.json'));
    const skill = read('yida-skills/skills/yida-dingtalk-openapi/SKILL.md');

    expect(root).toContain('`yida-dingtalk-openapi`');
    expect(index.skills.find((item) => item.name === 'yida-dingtalk-openapi'))
      .toMatchObject({ category: 'yida-skills/integration' });
    expect(skill).toContain('OpenYida 不支持钉钉事件订阅');
    expect(skill).toContain('直接说明不支持并停止');
    expect(skill).not.toContain('events-and-auth.md');
    expect(root).toContain('OpenYida 不支持；直接说明能力边界并停止');
  });

  test('never asks the user to put DingTalk credentials in chat or argv', () => {
    const skill = read('yida-skills/skills/yida-dingtalk-openapi/SKILL.md');
    const connector = read('yida-skills/skills/yida-connector/SKILL.md');
    const template = read('yida-skills/skills/yida-connector/templates/api-document-template.md');

    expect(skill).toContain('App Key、App Secret、access token 永远不进入聊天');
    expect(skill).toContain('用户只需回复“已配置”');
    expect(skill).toContain('list-connections --json');
    expect(skill).toContain('--interactive');
    expect(connector).not.toMatch(/connector create[^\n]*--app-(?:key|secret)/);
    expect(template).not.toMatch(/AppKey：ding|AppSecret：x|sk-xxxxxxxx/);
  });

  test('provides official API discovery links and traces every operation to its source page', () => {
    const skill = read('yida-skills/skills/yida-dingtalk-openapi/SKILL.md');
    const contract = read('yida-skills/skills/yida-dingtalk-openapi/references/api-contract.md');

    const officialDomainSlugs = [
      'contacts-overview',
      'attendance-overview',
      'dingtalk-event-overview',
      'blackboard-announcement-overview',
      'sign-check-overview',
      'report-log-overview',
      'overview-yida',
      'agoal-overview',
      'create-and-close-video-meetings',
      'data-structure',
      'workflow-overview',
      'knowledge-base-overview',
      'development-robot-overview',
      'dingtalk-todo-task-overview',
      'dedicated-dingtalk-overview',
      'get-a-list-of-all-applications-inside-the-enterprise',
      'application-market-overview',
      'intelligent-personnel-call-description',
      'smart-recruitment-overview',
      'intelligent-form-filling-overview',
    ];
    officialDomainSlugs.forEach((slug) => {
      expect(contract).toContain(`https://open.dingtalk.com/document/development/${slug}`);
    });
    expect(contract).not.toContain('服务端 API 调用说明');
    expect(contract).not.toContain('/document/orgapp/');
    expect(contract).toContain('"sourceUrl": "https://open.dingtalk.com/document/development/create-schedule"');
    expect(contract).toContain('每个 `operation.sourceUrl`');
    expect(skill).toContain('每个 Action 保存自己的 `sourceUrl`');
  });

  test('Canvas connector binding uses resource IDs and the fixed runtime bridge', () => {
    const binding = read(
      'yida-skills/skills/yida-canvas-data-binding/references/connector-binding.md'
    );
    expect(binding).toContain('`connectorId`');
    expect(binding).toContain('`operationId`');
    expect(binding).toContain('`connectionId`');
    expect(binding).toContain('window.__OPENYIDA_CONNECTOR_API__.invoke');
    expect(binding).toContain('/query/publicService/invokeService.json');
    expect(binding).not.toContain('api.dingtalk.com');
  });
});
