'use strict';

const {
  buildOrganizationElicitation,
  resolveSelectedCorpId,
  sanitizeLoginResult,
  selectYidaLoginOrganization,
} = require('../lib/mcp/server');
const {
  createTaskStore,
  handleA2aRequest,
} = require('../lib/a2a/server');

describe('OpenYida MCP server helpers', () => {
  test('builds MCP elicitation schema for organization single-select', () => {
    const elicitation = buildOrganizationElicitation([
      { corpId: 'ding-main', corpName: 'Main Org', mainOrg: true },
      { corpId: 'ding-alt', corpName: 'Alt Org' },
    ]);

    expect(elicitation).toEqual({
      message: '请选择这次登录要使用的宜搭组织。',
      requestedSchema: {
        type: 'object',
        properties: {
          corp_id: {
            type: 'string',
            title: '宜搭组织',
            description: '选择一个组织完成 OpenYida 登录。',
            enum: ['ding-main', 'ding-alt'],
            enumNames: ['Main Org（主组织）', 'Alt Org'],
          },
        },
        required: ['corp_id'],
      },
    });
  });

  test('resolves accepted elicitation selection to corpId', () => {
    expect(resolveSelectedCorpId({
      action: 'accept',
      content: { corp_id: 'ding-alt' },
    }, [
      { corpId: 'ding-main', corpName: 'Main Org', mainOrg: true },
      { corpId: 'ding-alt', corpName: 'Alt Org' },
    ])).toBe('ding-alt');
  });

  test('fails when user cancels organization selection', () => {
    expect(() => resolveSelectedCorpId({ action: 'cancel' }, [
      { corpId: 'ding-main', corpName: 'Main Org' },
    ])).toThrow('用户未选择组织（cancel）');
  });

  test('selectYidaLoginOrganization is disabled in token-only auth mode', async () => {
    await expect(selectYidaLoginOrganization({
      session_file: '/tmp/openyida-session.json',
    })).rejects.toThrow('token-only');
  });

  test('sanitizeLoginResult returns token login summary without secrets', () => {
    const result = sanitizeLoginResult({
      ok: true,
      status: 'ok',
      can_auto_use: true,
      auth_mode: 'token',
      base_url: 'https://www.aliwork.com',
      corp_id: 'ding-main',
      user_id: 'user-1',
    });
    expect(result).toMatchObject({
      ok: true,
      status: 'ok',
      can_auto_use: true,
      auth_mode: 'token',
      base_url: 'https://www.aliwork.com',
      corp_id: 'ding-main',
      user_id: 'user-1',
      selected_corp: null,
    });
    expect(result.cookies).toBeUndefined();
    expect(result.csrf_token).toBeUndefined();
  });
});

describe('OpenYida A2A local adapter helpers', () => {
  test('serves Agent Card discovery without login state', async () => {
    const response = await handleA2aRequest({
      method: 'GET',
      url: '/.well-known/agent-card.json',
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      protocolVersion: '1.0',
      name: 'OpenYida Local Adapter',
      capabilities: {
        streaming: false,
        pushNotifications: false,
      },
    });
    expect(body.skills.map(skill => skill.id)).toContain('openyida.command_manifest');
  });

  test('handles message:send and stores completed task', async () => {
    const taskStore = createTaskStore();
    const response = await handleA2aRequest({
      method: 'POST',
      url: '/message:send',
    }, JSON.stringify({
      message: {
        role: 'user',
        parts: [{ kind: 'text', text: 'commands' }],
      },
    }), { taskStore });
    const task = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(task.status.state).toBe('completed');
    expect(task.artifacts[0].parts[1].data.manifest.name).toBe('openyida');

    const getResponse = await handleA2aRequest({
      method: 'GET',
      url: `/tasks/${task.id}`,
    }, '', { taskStore });
    expect(JSON.parse(getResponse.body).id).toBe(task.id);
  });

  test('returns unsupported capability for streaming routes', async () => {
    const response = await handleA2aRequest({
      method: 'POST',
      url: '/message:stream',
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(501);
    expect(body.error.code).toBe('UNSUPPORTED_CAPABILITY');
  });
});
