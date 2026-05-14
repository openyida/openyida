'use strict';

const { warn } = require('../core/chalk');

const APPLINK_PAGE_LINK = 'https://applink.dingtalk.com/page/link';
const LEGACY_PAGE_LINK = 'dingtalk://dingtalkclient/page/link';
const DEFAULT_TARGET = 'fullScreen';

function parseArgs(args) {
  const options = {
    url: null,
    target: DEFAULT_TARGET,
    legacyScheme: false,
    json: false,
    help: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--url') {
      options.url = args[++i];
    } else if (arg === '--target') {
      options.target = args[++i];
    } else if (arg === '--legacy-scheme') {
      options.legacyScheme = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (!arg.startsWith('--') && !options.url) {
      options.url = arg;
    }
  }

  return options;
}

function isDingTalkPageLink(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'dingtalk:' && parsed.hostname === 'dingtalkclient') {
      return parsed.pathname === '/page/link';
    }
    return parsed.protocol === 'https:' && parsed.hostname === 'applink.dingtalk.com' && parsed.pathname === '/page/link';
  } catch {
    return false;
  }
}

function extractPageUrl(value) {
  if (!isDingTalkPageLink(value)) {
    return { pageUrl: value, target: null };
  }

  const parsed = new URL(value);
  return {
    pageUrl: parsed.searchParams.get('url') || '',
    target: parsed.searchParams.get('target'),
  };
}

function assertHttpUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DingTalk page links require an absolute http(s) URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('DingTalk page links require an absolute http(s) URL.');
  }
  return parsed.toString();
}

function buildDingTalkPageLink(input) {
  const options = {
    url: input && input.url,
    target: input && input.target,
    legacyScheme: !!(input && input.legacyScheme),
  };
  const hasTargetOption = !!(input && Object.prototype.hasOwnProperty.call(input, 'target'));

  if (!options.url) {
    throw new Error('Missing URL. Usage: openyida dingtalk-link <url>');
  }

  const extracted = extractPageUrl(options.url);
  const pageUrl = assertHttpUrl(extracted.pageUrl);
  const target = hasTargetOption ? options.target : (extracted.target || DEFAULT_TARGET);
  const base = options.legacyScheme ? LEGACY_PAGE_LINK : APPLINK_PAGE_LINK;
  const link = new URL(base);
  link.searchParams.set('url', pageUrl);
  if (target) {
    link.searchParams.set('target', target);
  }
  return link.toString();
}

function printHelp() {
  console.log('Usage: openyida dingtalk-link <url> [--target fullScreen] [--legacy-scheme] [--json]');
  console.log('');
  console.log('Generate DingTalk AppLink URLs for opening web pages in DingTalk.');
  console.log('AppLink is the default because dingtalk:// may be claimed by DingTalk variants such as dedicated DingTalk clients.');
  console.log('');
  console.log('Examples:');
  console.log('  openyida dingtalk-link https://attend.dingtalk.com/attend/index.html');
  console.log('  openyida dingtalk-link "dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fexample.com"');
  console.log('  openyida dingtalk-link https://example.com --legacy-scheme');
}

async function run(args) {
  const options = parseArgs(args);
  if (options.help) {
    printHelp();
    return;
  }

  try {
    const link = buildDingTalkPageLink(options);
    if (options.json) {
      console.log(JSON.stringify({
        url: link,
        kind: options.legacyScheme ? 'legacy-scheme' : 'applink',
        target: options.target || null,
      }, null, 2));
      return;
    }
    console.log(link);
  } catch (error) {
    warn(error.message);
    process.exit(1);
  }
}

module.exports = {
  APPLINK_PAGE_LINK,
  LEGACY_PAGE_LINK,
  buildDingTalkPageLink,
  extractPageUrl,
  run,
};
