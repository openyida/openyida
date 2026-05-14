'use strict';

const { createA2aHttpServer, DEFAULT_HOST, DEFAULT_PORT, listen } = require('./server');

function hasFlag(args, name) {
  return args.includes(name);
}

function getArgValue(args, name, defaultValue) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1] || args[index + 1].startsWith('--')) {
    return defaultValue;
  }
  return args[index + 1];
}

function printUsage() {
  console.log(`
Usage: openyida a2a <serve|agent-card> [options]

Commands:
  serve                 Start a local read-only A2A HTTP adapter
  agent-card            Print the A2A Agent Card JSON

Options:
  --host <host>         Bind host, default: ${DEFAULT_HOST}
  --port <port>         Bind port, default: ${DEFAULT_PORT}
  --base-url <url>      Public base URL shown in Agent Card
  --json                Print machine-readable startup output

Examples:
  openyida a2a agent-card
  openyida a2a serve --host 127.0.0.1 --port 8787
`);
}

function parseServerOptions(args) {
  const host = getArgValue(args, '--host', DEFAULT_HOST);
  const port = Number(getArgValue(args, '--port', DEFAULT_PORT));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid --port value: ${port}`);
  }

  return {
    host,
    port,
    baseUrl: getArgValue(args, '--base-url', `http://${host}:${port}`),
  };
}

async function run(args = []) {
  const subCommand = args[0];
  const subArgs = args.slice(1);

  if (!subCommand || subCommand === '--help' || subCommand === '-h') {
    printUsage();
    return;
  }

  if (subCommand === 'agent-card') {
    const { createAgentCard } = require('./server');
    const options = parseServerOptions(subArgs);
    console.log(JSON.stringify(createAgentCard(options), null, 2));
    return;
  }

  if (subCommand === 'serve') {
    const options = parseServerOptions(subArgs);
    const server = createA2aHttpServer(options);
    await listen(server, options);

    const startup = {
      ok: true,
      readonly: true,
      host: options.host,
      port: options.port,
      base_url: options.baseUrl,
      agent_card_url: `${options.baseUrl}/.well-known/agent-card.json`,
      message_send_url: `${options.baseUrl}/message:send`,
    };

    if (hasFlag(subArgs, '--json')) {
      console.log(JSON.stringify(startup));
    } else {
      console.log(`OpenYida A2A local adapter listening on ${options.baseUrl}`);
      console.log(`Agent Card: ${startup.agent_card_url}`);
      console.log('Mode: read-only preview');
    }
    return;
  }

  throw new Error(`Unknown a2a subcommand: ${subCommand}`);
}

module.exports = {
  parseServerOptions,
  run,
};
