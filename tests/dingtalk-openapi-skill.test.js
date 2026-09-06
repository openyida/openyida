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
    expect(skill).toContain('accountManageUrl');
    expect(skill).toContain('添加授权账号时优先');
    expect(skill).not.toContain('--interactive');
    expect(connector).not.toContain('create-connection <connector-id>');
    expect(connector).not.toMatch(/connector create[^\n]*--app-(?:key|secret)/);
    expect(template).not.toMatch(/AppKey：ding|AppSecret：x|sk-xxxxxxxx/);
    expect(template).toContain('accountManageUrl');
    expect(template).not.toContain('本机终端');
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

  test('resolves linked parameter dependencies instead of guessing from field names', () => {
    const skill = read('yida-skills/skills/yida-dingtalk-openapi/SKILL.md');
    const contract = read('yida-skills/skills/yida-dingtalk-openapi/references/api-contract.md');

    expect(skill).toContain('入参依赖');
    expect(skill).toContain('依赖值未解析时不得创建或调用主 Action');
    expect(skill).toContain('所有前置接口也必须生成宜搭自定义连接器 Action');
    expect(contract).toContain('"fixedInputs"');
    expect(contract).toContain('"inputDependencies"');
    expect(contract).toContain('"target": "path.userId"');
    expect(contract).toContain('"semanticType": "unionId"');
    expect(contract).toContain('https://open.dingtalk.com/document/development/query-user-details');
    expect(contract).toContain('"sourceInput": "body.userid"');
    expect(contract).toContain('"sourceOutput": "result.unionid"');
    expect(contract).toContain('`calendarId` 固定传 `primary`');
    expect(contract).toContain('不能只按参数名猜值');
    expect(contract).toContain('只用于 Agent 编排');
    expect(contract).toContain('不能用 `curl`、`fetch`、临时 Node/Python 脚本');
    expect(contract).toContain('window.__OPENYIDA_CONNECTOR_API__');
  });

  test('Canvas connector binding distinguishes the Http runtime name from the numeric management id', () => {
    const binding = read(
      'yida-skills/skills/yida-canvas-data-binding/references/connector-binding.md'
    );
    expect(binding).toContain('`connectorName`');
    expect(binding).toContain('`Http_`');
    expect(binding).toContain('数字 `connectorId` 只用于 CLI 管理命令');
    expect(binding).toContain('`operationId`');
    expect(binding).toContain('`connectionId`');
    expect(binding).toContain('window.__OPENYIDA_CONNECTOR_API__.invoke');
    expect(binding).toContain('/query/publicService/invokeService.json');
    expect(binding).not.toContain('api.dingtalk.com');
  });

  test('documents the platform-safe Header, Body, and readback contracts', () => {
    const skill = read('yida-skills/skills/yida-dingtalk-openapi/SKILL.md');
    const connector = read('yida-skills/skills/yida-connector/SKILL.md');
    const mapping = read('yida-skills/skills/yida-dingtalk-openapi/references/connector-mapping.md');

    expect(skill).toContain('`CONNECTOR_READBACK_MISMATCH` 是阻断错误');
    expect(skill).toContain('Action Header 均为 `required=false`');
    expect(connector).toContain('可选 Header 没有默认值时不写入 `parameters.header`');
    expect(mapping).toContain('不得传 `JSON.stringify(...)` 的字符串');
  });

  test('routes Yida systemToken actions to server-side integration without exposing credentials', () => {
    const skill = read('yida-skills/skills/yida-dingtalk-openapi/SKILL.md');
    const connector = read('yida-skills/skills/yida-connector/SKILL.md');
    const integration = read('yida-skills/skills/yida-integration/SKILL.md');
    const mapping = read('yida-skills/skills/yida-dingtalk-openapi/references/connector-mapping.md');
    const binding = read('yida-skills/skills/yida-canvas-data-binding/references/connector-binding.md');

    expect(skill).toContain('需要 `systemToken` 时加载 `yida-integration`');
    expect(connector).toContain('--system-token-app <appType>');
    expect(integration).toContain('--connector-system-token-app <appType>');
    expect(integration).toContain('"provider": "yidaSystemToken"');
    expect(mapping).toContain('不生成 Canvas 映射');
    expect(binding).toContain('页面不得读取 `App.getSystemToken`');
    expect(binding).toContain('spec 的 `secretBindings`');
  });
});
