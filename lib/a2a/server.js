'use strict';

const http = require('http');
const { version } = require('../../package.json');
const { buildCommandManifest } = require('../core/command-manifest');
const { t } = require('../core/i18n');

const A2A_PROTOCOL_VERSION = '1.0';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

function createJsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'content-type': JSON_CONTENT_TYPE,
      'cache-control': 'no-store',
      ...headers,
    },
    body: JSON.stringify(body, null, 2),
  };
}

function createTextResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
    body,
  };
}

function createA2aError(code, message, details) {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}

function createAgentCard(options = {}) {
  const baseUrl = options.baseUrl || `http://${options.host || DEFAULT_HOST}:${options.port || DEFAULT_PORT}`;
  return {
    protocolVersion: A2A_PROTOCOL_VERSION,
    name: 'OpenYida Local Adapter',
    description: 'Local read-only A2A adapter for OpenYida CLI capabilities.',
    url: baseUrl,
    provider: {
      organization: 'OpenYida',
      url: 'https://github.com/openyida/openyida',
    },
    version,
    documentationUrl: 'https://github.com/openyida/openyida',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: [
      {
        id: 'openyida.command_manifest',
        name: 'OpenYida command manifest',
        description: 'Returns the machine-readable OpenYida CLI command manifest.',
        tags: ['openyida', 'cli', 'commands'],
        examples: ['List OpenYida commands', 'Show command manifest'],
      },
      {
        id: 'openyida.a2a_health',
        name: 'OpenYida A2A health',
        description: 'Reports local A2A adapter health and readonly mode.',
        tags: ['openyida', 'a2a', 'health'],
        examples: ['health', 'status'],
      },
    ],
    securitySchemes: {
      localOnly: {
        type: 'apiKey',
        in: 'header',
        name: 'X-OpenYida-Local-Only',
        description: 'The first preview server binds to localhost by default and does not require credentials.',
      },
    },
    security: [{ localOnly: [] }],
  };
}

function createTaskStore() {
  const tasks = new Map();

  return {
    set(task) {
      tasks.set(task.id, task);
      return task;
    },
    get(taskId) {
      return tasks.get(taskId) || null;
    },
    update(taskId, updater) {
      const currentTask = tasks.get(taskId);
      if (!currentTask) {return null;}
      const nextTask = updater(currentTask);
      tasks.set(taskId, nextTask);
      return nextTask;
    },
  };
}

function createTaskId(now = Date.now()) {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `task-${now.toString(36)}-${randomSuffix}`;
}

function extractTextFromMessage(message) {
  if (!message) {return '';}
  if (typeof message === 'string') {return message;}
  if (typeof message.text === 'string') {return message.text;}
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part) => {
        if (!part) {return '';}
        if (typeof part === 'string') {return part;}
        if (typeof part.text === 'string') {return part.text;}
        if (part.kind === 'text' && typeof part.content === 'string') {return part.content;}
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function createTextPart(text) {
  return {
    kind: 'text',
    text,
  };
}

function createDataPart(data) {
  return {
    kind: 'data',
    data,
  };
}

function createAgentMessage(parts) {
  return {
    role: 'agent',
    parts,
  };
}

function buildCommandManifestResult() {
  const manifest = buildCommandManifest({ t, version });
  return createAgentMessage([
    createTextPart(`OpenYida exposes ${manifest.commands.length} CLI commands. This A2A preview is read-only.`),
    createDataPart({ manifest }),
  ]);
}

function buildHealthResult(options = {}) {
  return createAgentMessage([
    createTextPart('OpenYida A2A local adapter is running in read-only preview mode.'),
    createDataPart({
      ok: true,
      protocolVersion: A2A_PROTOCOL_VERSION,
      version,
      readonly: true,
      host: options.host || DEFAULT_HOST,
      port: options.port || DEFAULT_PORT,
    }),
  ]);
}

function buildFallbackResult(inputText) {
  return createAgentMessage([
    createTextPart([
      'OpenYida A2A preview currently supports read-only discovery commands.',
      'Try: "health", "status", "commands", or "command manifest".',
      inputText ? `Received: ${inputText}` : '',
    ].filter(Boolean).join('\n')),
  ]);
}

function runReadonlySkill(inputText, options = {}) {
  const normalizedText = String(inputText || '').trim().toLowerCase();
  if (!normalizedText || /health|status|ping|a2a/.test(normalizedText)) {
    return buildHealthResult(options);
  }
  if (/command|manifest|commands|capabilit|能力|命令/.test(normalizedText)) {
    return buildCommandManifestResult();
  }
  return buildFallbackResult(inputText);
}

function createCompletedTask(inputMessage, outputMessage, now = new Date()) {
  return {
    id: createTaskId(now.getTime()),
    contextId: inputMessage && (inputMessage.contextId || inputMessage.context_id) || undefined,
    status: {
      state: 'completed',
      timestamp: now.toISOString(),
    },
    history: [
      {
        role: 'user',
        parts: inputMessage && Array.isArray(inputMessage.parts) ? inputMessage.parts : [createTextPart(extractTextFromMessage(inputMessage))],
      },
      outputMessage,
    ],
    artifacts: [
      {
        artifactId: 'openyida-readonly-result',
        name: 'OpenYida read-only result',
        parts: outputMessage.parts,
      },
    ],
  };
}

function parseJsonBody(rawBody) {
  if (!rawBody) {return {};}
  return JSON.parse(rawBody);
}

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

async function handleA2aRequest(request, rawBody = '', context = {}) {
  const url = new URL(request.url, 'http://localhost');
  const pathname = normalizePath(url.pathname);
  const method = request.method || 'GET';
  const taskStore = context.taskStore || createTaskStore();
  const serverOptions = context.serverOptions || {};

  if (method === 'OPTIONS') {
    return createTextResponse(204, '', {
      allow: 'GET,POST,OPTIONS',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
    });
  }

  if (method === 'GET' && (pathname === '/.well-known/agent-card.json' || pathname === '/agent-card.json')) {
    return createJsonResponse(200, createAgentCard(serverOptions));
  }

  if (method === 'GET' && (pathname === '/' || pathname === '/health')) {
    return createJsonResponse(200, {
      ok: true,
      name: 'openyida-a2a',
      protocolVersion: A2A_PROTOCOL_VERSION,
      agentCard: '/.well-known/agent-card.json',
    });
  }

  if (method === 'POST' && (pathname === '/message:send' || pathname === '/a2a/v1/message:send')) {
    let payload;
    try {
      payload = parseJsonBody(rawBody);
    } catch (err) {
      return createJsonResponse(400, createA2aError('INVALID_JSON', err.message));
    }

    const inputMessage = payload.message || payload;
    const inputText = extractTextFromMessage(inputMessage);
    const outputMessage = runReadonlySkill(inputText, serverOptions);
    const task = taskStore.set(createCompletedTask(inputMessage, outputMessage));
    return createJsonResponse(200, task);
  }

  const taskMatch = pathname.match(/^\/(?:a2a\/v1\/)?tasks\/([^/]+)$/);
  if (taskMatch && method === 'GET') {
    const task = taskStore.get(decodeURIComponent(taskMatch[1]));
    if (!task) {
      return createJsonResponse(404, createA2aError('TASK_NOT_FOUND', 'Task not found.'));
    }
    return createJsonResponse(200, task);
  }

  const cancelMatch = pathname.match(/^\/(?:a2a\/v1\/)?tasks\/([^/]+):cancel$/);
  if (cancelMatch && method === 'POST') {
    const task = taskStore.update(decodeURIComponent(cancelMatch[1]), (currentTask) => ({
      ...currentTask,
      status: {
        state: currentTask.status && currentTask.status.state === 'completed' ? 'completed' : 'canceled',
        timestamp: new Date().toISOString(),
      },
    }));
    if (!task) {
      return createJsonResponse(404, createA2aError('TASK_NOT_FOUND', 'Task not found.'));
    }
    return createJsonResponse(200, task);
  }

  if (pathname.includes('message:stream') || pathname.includes('push')) {
    return createJsonResponse(501, createA2aError(
      'UNSUPPORTED_CAPABILITY',
      'Streaming and push notifications are not supported by this read-only preview adapter.'
    ));
  }

  return createJsonResponse(404, createA2aError('NOT_FOUND', `No A2A route for ${method} ${pathname}.`));
}

function writeNodeResponse(nodeResponse, response) {
  nodeResponse.writeHead(response.statusCode, response.headers);
  nodeResponse.end(response.body);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function createA2aHttpServer(options = {}) {
  const taskStore = options.taskStore || createTaskStore();
  return http.createServer(async (request, response) => {
    try {
      const rawBody = await readRequestBody(request);
      const result = await handleA2aRequest(request, rawBody, {
        taskStore,
        serverOptions: options,
      });
      writeNodeResponse(response, result);
    } catch (err) {
      writeNodeResponse(response, createJsonResponse(500, createA2aError('INTERNAL_ERROR', err.message)));
    }
  });
}

function listen(server, options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = Number(options.port || DEFAULT_PORT);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve({ host, port });
    });
  });
}

module.exports = {
  A2A_PROTOCOL_VERSION,
  DEFAULT_HOST,
  DEFAULT_PORT,
  createA2aError,
  createA2aHttpServer,
  createAgentCard,
  createTaskStore,
  extractTextFromMessage,
  handleA2aRequest,
  listen,
  runReadonlySkill,
};
