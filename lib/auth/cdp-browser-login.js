/**
 * cdp-browser-login.js - dependency-free local browser login via Chrome DevTools Protocol
 *
 * Opens an isolated Chrome/Edge/Chromium profile, waits for Yida login cookies,
 * prints the cookies as JSON to the parent process, then closes the browser.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');
const { deriveBaseUrlFromCookies, deriveBaseUrlFromUrl } = require('../core/env-manager');

function findBrowserExecutable() {
  if (process.env.OPENYIDA_CHROME_PATH && fs.existsSync(process.env.OPENYIDA_CHROME_PATH)) {
    return process.env.OPENYIDA_CHROME_PATH;
  }

  const candidates = process.platform === 'darwin'
    ? [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ]
    : process.platform === 'win32'
      ? [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      ]
      : [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/microsoft-edge',
      ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitForJson(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function encodeClientFrame(text, opcode = 1) {
  const payload = Buffer.from(text);
  const mask = crypto.randomBytes(4);
  let header;

  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | payload.length;
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  header[0] = 0x80 | opcode;
  const maskedPayload = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index++) {
    maskedPayload[index] = payload[index] ^ mask[index % 4];
  }

  return Buffer.concat([header, mask, maskedPayload]);
}

function tryDecodeFrame(buffer) {
  if (buffer.length < 2) {return null;}

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) !== 0;
  let length = secondByte & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < offset + 2) {return null;}
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) {return null;}
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  let mask = null;
  if (masked) {
    if (buffer.length < offset + 4) {return null;}
    mask = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + length) {return null;}

  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (mask) {
    for (let index = 0; index < payload.length; index++) {
      payload[index] ^= mask[index % 4];
    }
  }

  return {
    opcode,
    payload,
    remaining: buffer.subarray(offset + length),
  };
}

function createCdpClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(wsUrl);
    if (parsedUrl.protocol !== 'ws:') {
      reject(new Error(`Unsupported CDP WebSocket protocol: ${parsedUrl.protocol}`));
      return;
    }

    const key = crypto.randomBytes(16).toString('base64');
    const socket = net.createConnection({
      host: parsedUrl.hostname,
      port: Number(parsedUrl.port || 80),
    });
    const pending = new Map();
    let nextId = 1;
    let handshakeDone = false;
    let buffer = Buffer.alloc(0);
    let settled = false;

    function settleReject(err) {
      if (!settled) {
        settled = true;
        reject(err);
      }
    }

    function sendJson(payload) {
      socket.write(encodeClientFrame(JSON.stringify(payload)));
    }

    function closePending(err) {
      for (const { reject: rejectPending } of pending.values()) {
        rejectPending(err);
      }
      pending.clear();
    }

    socket.on('connect', () => {
      const requestPath = `${parsedUrl.pathname}${parsedUrl.search}`;
      socket.write([
        `GET ${requestPath} HTTP/1.1`,
        `Host: ${parsedUrl.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n'));
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (!handshakeDone) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {return;}
        const header = buffer.subarray(0, headerEnd).toString('utf8');
        if (!/^HTTP\/1\.1 101\b/i.test(header)) {
          settleReject(new Error(`CDP WebSocket handshake failed: ${header.split('\r\n')[0]}`));
          socket.destroy();
          return;
        }
        handshakeDone = true;
        buffer = buffer.subarray(headerEnd + 4);
        if (!settled) {
          settled = true;
          resolve({
            send(method, params = {}) {
              const id = nextId++;
              sendJson({ id, method, params });
              return new Promise((resolvePending, rejectPending) => {
                pending.set(id, { resolve: resolvePending, reject: rejectPending });
              });
            },
            close() {
              try { socket.end(encodeClientFrame('', 8)); } catch { /* ignore */ }
            },
          });
        }
      }

      let decoded;
      while ((decoded = tryDecodeFrame(buffer))) {
        buffer = decoded.remaining;

        if (decoded.opcode === 8) {
          closePending(new Error('CDP WebSocket closed'));
          socket.end();
          return;
        }

        if (decoded.opcode === 9) {
          socket.write(encodeClientFrame(decoded.payload.toString('utf8'), 10));
          continue;
        }

        if (decoded.opcode !== 1) {continue;}

        let message;
        try {
          message = JSON.parse(decoded.payload.toString('utf8'));
        } catch {
          continue;
        }

        if (!message.id || !pending.has(message.id)) {continue;}
        const { resolve: resolvePending, reject: rejectPending } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          rejectPending(new Error(message.error.message || JSON.stringify(message.error)));
        } else {
          resolvePending(message.result || {});
        }
      }
    });

    socket.on('error', (err) => {
      settleReject(err);
      closePending(err);
    });
    socket.on('close', () => closePending(new Error('CDP WebSocket closed')));
  });
}

function deriveBaseUrl(cookies, fallbackUrl) {
  return deriveBaseUrlFromCookies(cookies, fallbackUrl);
}

async function getCurrentPageUrl(client, fallbackUrl) {
  try {
    const result = await client.send('Runtime.evaluate', {
      expression: 'window.location.href',
      returnByValue: true,
    });
    const value = result && result.result && result.result.value;
    return typeof value === 'string' && value ? value : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

async function runCdpBrowserLogin(options = {}) {
  const browserPath = options.browserPath || findBrowserExecutable();
  if (!browserPath) {
    throw new Error('No Chrome, Edge, or Chromium executable found');
  }

  const loginUrl = options.loginUrl || 'https://www.aliwork.com/workPlatform';
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-browser-login-'));
  const port = await getFreePort();
  const timeoutMs = options.timeoutMs || 10 * 60 * 1000;
  const child = spawn(browserPath, [
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
    loginUrl,
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.on('data', () => {});

  let client = null;
  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`, 30000);

    let target = null;
    const targetDeadline = Date.now() + 30000;
    while (Date.now() < targetDeadline) {
      const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`, 5000);
      target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl) || null;
      if (target) {break;}
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (!target) {
      throw new Error('No debuggable browser page found');
    }

    client = await createCdpClient(target.webSocketDebuggerUrl);
    await client.send('Network.enable').catch(() => {});

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await client.send('Network.getAllCookies')
        .catch(() => client.send('Storage.getCookies'));
      const cookies = Array.isArray(result.cookies) ? result.cookies : [];
      if (cookies.some((cookie) => cookie.name === 'tianshu_csrf_token' && cookie.value)) {
        const currentPageUrl = await getCurrentPageUrl(client, target.url || loginUrl);
        const fallbackBaseUrl = deriveBaseUrlFromUrl(loginUrl, currentPageUrl);
        return {
          cookies,
          base_url: deriveBaseUrl(cookies, fallbackBaseUrl),
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Login timed out before tianshu_csrf_token appeared');
  } finally {
    if (client) {client.close();}
    if (!child.killed) {child.kill('SIGTERM');}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function cdpBrowserLogin(options = {}) {
  const scriptPath = path.join(os.tmpdir(), `openyida-cdp-login-${Date.now()}.js`);
  const modulePath = __filename;
  fs.writeFileSync(scriptPath, `
const { runCdpBrowserLogin } = require(${JSON.stringify(modulePath)});
runCdpBrowserLogin(${JSON.stringify(options)})
  .then((result) => {
    console.log(JSON.stringify(result));
  })
  .catch((err) => {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  });
`, 'utf8');

  try {
    const stdout = execFileSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit'],
      timeout: (options.timeoutMs || 10 * 60 * 1000) + 60000,
    });
    const lines = stdout.trim().split('\n').filter(Boolean);
    return JSON.parse(lines[lines.length - 1]);
  } finally {
    try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
  }
}

module.exports = {
  cdpBrowserLogin,
  createCdpClient,
  deriveBaseUrl,
  findBrowserExecutable,
  runCdpBrowserLogin,
};
