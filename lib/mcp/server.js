'use strict';

const { version } = require('../../package.json');

const MCP_PROTOCOL_VERSION = '2025-06-18';
const SELECT_ORGANIZATION_TOOL = 'select_yida_login_organization';

function createTextToolResult(text, structuredContent = null, isError = false) {
  const result = {
    content: [{ type: 'text', text }],
    isError: !!isError,
  };
  if (structuredContent) {
    result.structuredContent = structuredContent;
  }
  return result;
}

function normalizeCorpList(corpList) {
  if (!Array.isArray(corpList)) {return [];}
  return corpList
    .map((corp) => ({
      corpId: corp.corpId || corp.corp_id || corp.id,
      corpName: corp.corpName || corp.corp_name || corp.name || corp.corpId || corp.id,
      mainOrg: !!(corp.mainOrg || corp.main_org),
    }))
    .filter((corp) => corp.corpId);
}

function formatCorpName(corp) {
  return corp.mainOrg ? `${corp.corpName}（主组织）` : corp.corpName;
}

function buildOrganizationElicitation(corpList, message) {
  const normalized = normalizeCorpList(corpList);
  return {
    message: message || '请选择这次登录要使用的宜搭组织。',
    requestedSchema: {
      type: 'object',
      properties: {
        corp_id: {
          type: 'string',
          title: '宜搭组织',
          description: '选择一个组织完成 OpenYida 登录。',
          enum: normalized.map((corp) => corp.corpId),
          enumNames: normalized.map(formatCorpName),
        },
      },
      required: ['corp_id'],
    },
  };
}

function resolveSelectedCorpId(elicitationResult, corpList) {
  if (!elicitationResult || elicitationResult.action !== 'accept') {
    const action = elicitationResult && elicitationResult.action ? elicitationResult.action : 'cancel';
    throw new Error(`用户未选择组织（${action}）`);
  }

  const content = elicitationResult.content || {};
  const rawValue = content.corp_id || content.corpId || content.organization || content.value;
  if (!rawValue) {
    throw new Error('用户选择结果中缺少 corp_id');
  }

  const normalized = normalizeCorpList(corpList);
  const selected = normalized.find((corp) =>
    corp.corpId === rawValue ||
    corp.corpName === rawValue ||
    formatCorpName(corp) === rawValue
  );

  if (!selected) {
    throw new Error(`用户选择的组织不在当前登录会话中: ${rawValue}`);
  }

  return selected.corpId;
}

function sanitizeLoginResult(result) {
  if (!result || typeof result !== 'object') {return result;}
  return {
    ok: result.ok !== false,
    status: result.status || 'ok',
    can_auto_use: result.can_auto_use !== false,
    auth_mode: result.auth_mode || result.authMode,
    base_url: result.base_url,
    corp_id: result.corp_id,
    user_id: result.user_id,
    selected_corp: result.selected_corp || null,
  };
}

async function selectYidaLoginOrganization() {
  throw new Error('OpenYida 已切换为 token-only 鉴权，请使用 openyida login 完成登录。');
}

function listTools() {
  return [];
}

function createMcpServer(options = {}) {
  const output = options.output || process.stdout;
  const log = options.log || ((message) => process.stderr.write(`${message}\n`));
  const pendingRequests = new Map();
  let requestId = 1;
  let clientCapabilities = {};

  function send(message) {
    output.write(`${JSON.stringify(message)}\n`);
  }

  function respond(id, result) {
    send({ jsonrpc: '2.0', id, result });
  }

  function respondError(id, code, message, data) {
    send({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data === undefined ? {} : { data }),
      },
    });
  }

  function requestClient(method, params) {
    const id = `openyida-${requestId++}`;
    send({ jsonrpc: '2.0', id, method, params });
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
    });
  }

  async function handleRequest(message) {
    const id = message.id;
    const method = message.method;
    const params = message.params || {};

    try {
      if (method === 'initialize') {
        clientCapabilities = params.capabilities || {};
        respond(id, {
          protocolVersion: params.protocolVersion || MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: 'openyida',
            title: 'OpenYida',
            version,
          },
          instructions: 'Use openyida login for OpenYida authentication.',
        });
        return;
      }

      if (method === 'ping') {
        respond(id, {});
        return;
      }

      if (method === 'tools/list') {
        respond(id, { tools: listTools() });
        return;
      }

      if (method === 'tools/call') {
        const toolName = params.name;
        const toolArgs = params.arguments || {};
        if (toolName !== SELECT_ORGANIZATION_TOOL) {
          respondError(id, -32602, `Unknown tool: ${toolName}`);
          return;
        }

        if (!clientCapabilities.elicitation) {
          respond(id, createTextToolResult(
            '当前 MCP 客户端没有声明 elicitation 能力，无法打开原生组织选择控件。',
            null,
            true
          ));
          return;
        }

        try {
          const structuredContent = await selectYidaLoginOrganization(toolArgs, {
            requestElicitation: (elicitationParams) => requestClient('elicitation/create', elicitationParams),
          });
          respond(id, createTextToolResult(JSON.stringify(structuredContent), structuredContent, false));
        } catch (err) {
          respond(id, createTextToolResult(err.message, null, true));
        }
        return;
      }

      respondError(id, -32601, `Method not found: ${method}`);
    } catch (err) {
      respondError(id, -32603, err.message);
    }
  }

  function handleResponse(message) {
    const pending = pendingRequests.get(message.id);
    if (!pending) {return;}
    pendingRequests.delete(message.id);
    if (message.error) {
      pending.reject(new Error(message.error.message || 'MCP client request failed'));
    } else {
      pending.resolve(message.result);
    }
  }

  async function handleMessage(message) {
    if (message && Object.prototype.hasOwnProperty.call(message, 'id') && !message.method) {
      handleResponse(message);
      return;
    }

    if (!message || !message.method) {return;}
    if (!Object.prototype.hasOwnProperty.call(message, 'id')) {
      if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') {
        return;
      }
      return;
    }

    await handleRequest(message);
  }

  function handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) {return;}
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch (err) {
      log(`Invalid MCP JSON: ${err.message}`);
      return;
    }
    handleMessage(message).catch((err) => log(`MCP message failed: ${err.message}`));
  }

  return {
    handleLine,
    handleMessage,
    listTools,
    requestClient,
  };
}

function runStdioServer(options = {}) {
  const readline = require('readline');
  const input = options.input || process.stdin;
  const server = createMcpServer(options);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on('line', server.handleLine);
}

module.exports = {
  MCP_PROTOCOL_VERSION,
  SELECT_ORGANIZATION_TOOL,
  buildOrganizationElicitation,
  createMcpServer,
  listTools,
  normalizeCorpList,
  resolveSelectedCorpId,
  runStdioServer,
  sanitizeLoginResult,
  selectYidaLoginOrganization,
};
