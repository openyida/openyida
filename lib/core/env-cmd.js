/**
 * env-cmd.js - 多环境管理 CLI 子命令
 *
 * 子命令：
 *   openyida env list              列出所有环境及当前激活环境
 *   openyida env add <name>        交互式添加私有化环境配置
 *   openyida env switch <name>     切换当前激活环境
 *   openyida env remove <name>     移除环境配置（不可删除 public）
 *   openyida env show [name]       显示环境详细配置
 */

'use strict';

const readline = require('readline');
const {
  loadEnvsConfig,
  saveEnvsConfig,
  DEFAULT_BASE_URL,
  DEFAULT_LOGIN_URL,
} = require('./env-manager');

// ── 颜色常量 ──────────────────────────────────────────

const RESET   = '\x1b[0m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const GREEN   = '\x1b[32m';
const YELLOW  = '\x1b[33m';
const CYAN    = '\x1b[36m';
const RED     = '\x1b[31m';
const BLUE    = '\x1b[34m';

// ── 工具函数 ──────────────────────────────────────────

/**
 * 交互式读取用户输入。
 * @param {string} prompt - 提示文字
 * @param {string} [defaultValue] - 默认值（用户直接回车时使用）
 * @returns {Promise<string>}
 */
function askQuestion(prompt, defaultValue) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const displayPrompt = defaultValue
    ? `${prompt} ${DIM}[${defaultValue}]${RESET} `
    : `${prompt} `;

  return new Promise((resolve) => {
    rl.question(displayPrompt, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue || '');
    });
  });
}

/**
 * 格式化环境名称标签（当前激活环境高亮显示）。
 * @param {string} envName
 * @param {string} currentEnv
 * @returns {string}
 */
function formatEnvLabel(envName, currentEnv) {
  if (envName === currentEnv) {
    return `${GREEN}${BOLD}${envName}${RESET} ${GREEN}← 当前${RESET}`;
  }
  return `${CYAN}${envName}${RESET}`;
}

// ── 子命令实现 ────────────────────────────────────────

/**
 * env list - 列出所有环境。
 */
function cmdList() {
  const config = loadEnvsConfig();
  const envNames = Object.keys(config.environments);

  console.log('');
  console.log(`${BOLD}宜搭环境列表${RESET}`);
  console.log(`${'─'.repeat(50)}`);

  if (envNames.length === 0) {
    console.log(`${DIM}  暂无环境配置${RESET}`);
  } else {
    for (const envName of envNames) {
      const envConfig = config.environments[envName];
      const label = formatEnvLabel(envName, config.current);
      console.log(`  ${label}`);
      console.log(`    ${DIM}地址：${RESET}${envConfig.baseUrl || DEFAULT_BASE_URL}`);
      if (envConfig.description) {
        console.log(`    ${DIM}描述：${RESET}${envConfig.description}`);
      }
    }
  }

  console.log('');
  console.log(`${DIM}使用 openyida env switch <name> 切换环境${RESET}`);
  console.log(`${DIM}使用 openyida env add <name> 添加私有化环境${RESET}`);
  console.log('');
}

/**
 * env show [name] - 显示环境详细配置。
 * @param {string} [envName]
 */
function cmdShow(envName) {
  const config = loadEnvsConfig();
  const targetName = envName || config.current;
  const envConfig = config.environments[targetName];

  if (!envConfig) {
    console.error(`${RED}错误：环境 "${targetName}" 不存在${RESET}`);
    console.error(`使用 ${CYAN}openyida env list${RESET} 查看所有环境`);
    process.exit(1);
  }

  const isActive = targetName === config.current;

  console.log('');
  console.log(`${BOLD}环境详情：${CYAN}${targetName}${RESET}${isActive ? `  ${GREEN}← 当前激活${RESET}` : ''}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`  ${BOLD}地址：${RESET}      ${envConfig.baseUrl || DEFAULT_BASE_URL}`);
  console.log(`  ${BOLD}登录 URL：${RESET}  ${envConfig.loginUrl || DEFAULT_LOGIN_URL}`);
  if (envConfig.description) {
    console.log(`  ${BOLD}描述：${RESET}      ${envConfig.description}`);
  }
  if (envConfig.dwsEndpoint) {
    console.log(`  ${BOLD}DWS 端点：${RESET}  ${envConfig.dwsEndpoint}`);
  }
  if (envConfig.tenantId) {
    console.log(`  ${BOLD}租户 ID：${RESET}   ${envConfig.tenantId}`);
  }
  console.log(`  ${BOLD}Cookie 文件：${RESET}${envConfig.cookieFile || 'cookies-public.json'}`);
  console.log('');
}

/**
 * env switch <name> - 切换当前激活环境。
 * @param {string} envName
 */
function cmdSwitch(envName) {
  if (!envName) {
    console.error(`${RED}错误：请指定要切换的环境名称${RESET}`);
    console.error(`用法：${CYAN}openyida env switch <name>${RESET}`);
    process.exit(1);
  }

  const config = loadEnvsConfig();

  if (!config.environments[envName]) {
    console.error(`${RED}错误：环境 "${envName}" 不存在${RESET}`);
    console.error(`使用 ${CYAN}openyida env list${RESET} 查看所有环境`);
    process.exit(1);
  }

  if (config.current === envName) {
    console.log(`${YELLOW}当前已在 "${envName}" 环境，无需切换${RESET}`);
    return;
  }

  const previousEnv = config.current;
  config.current = envName;
  saveEnvsConfig(config);

  console.log('');
  console.log(`${GREEN}✅ 已切换环境${RESET}`);
  console.log(`  ${DIM}${previousEnv}${RESET} → ${GREEN}${BOLD}${envName}${RESET}`);
  console.log(`  地址：${config.environments[envName].baseUrl}`);
  console.log('');
  console.log(`${DIM}提示：登录态已自动切换，如需重新登录请运行 openyida login --qr${RESET}`);
  console.log('');
}

/**
 * env remove <name> - 移除环境配置。
 * @param {string} envName
 */
function cmdRemove(envName) {
  if (!envName) {
    console.error(`${RED}错误：请指定要移除的环境名称${RESET}`);
    console.error(`用法：${CYAN}openyida env remove <name>${RESET}`);
    process.exit(1);
  }

  if (envName === 'public') {
    console.error(`${RED}错误：不能删除默认的公有云环境 "public"${RESET}`);
    process.exit(1);
  }

  const config = loadEnvsConfig();

  if (!config.environments[envName]) {
    console.error(`${RED}错误：环境 "${envName}" 不存在${RESET}`);
    process.exit(1);
  }

  // 若删除的是当前激活环境，自动切回 public
  const wasActive = config.current === envName;
  delete config.environments[envName];
  if (wasActive) {
    config.current = 'public';
  }

  saveEnvsConfig(config);

  console.log('');
  console.log(`${GREEN}✅ 已移除环境 "${envName}"${RESET}`);
  if (wasActive) {
    console.log(`${YELLOW}已自动切换回 "public" 环境${RESET}`);
  }
  console.log('');
}

/**
 * env add <name> - 交互式添加私有化环境配置。
 * @param {string} envName
 */
async function cmdAdd(envName) {
  if (!envName) {
    console.error(`${RED}错误：请指定环境名称${RESET}`);
    console.error(`用法：${CYAN}openyida env add <name>${RESET}`);
    console.error(`示例：${CYAN}openyida env add private-prod${RESET}`);
    process.exit(1);
  }

  // 环境名称校验：只允许字母、数字、连字符
  if (!/^[a-zA-Z0-9-]+$/.test(envName)) {
    console.error(`${RED}错误：环境名称只能包含字母、数字和连字符（-）${RESET}`);
    process.exit(1);
  }

  if (envName === 'public') {
    console.error(`${RED}错误："public" 是保留的默认环境名称，不能添加${RESET}`);
    process.exit(1);
  }

  const config = loadEnvsConfig();
  const existingConfig = config.environments[envName];

  if (existingConfig) {
    console.log(`${YELLOW}环境 "${envName}" 已存在，将更新其配置${RESET}`);
  }

  console.log('');
  console.log(`${BOLD}添加私有化宜搭环境：${CYAN}${envName}${RESET}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`${DIM}直接回车使用默认值，输入内容后回车确认${RESET}`);
  console.log('');

  const defaultBaseUrl = existingConfig?.baseUrl || '';
  const baseUrl = await askQuestion(`${BOLD}宜搭服务地址${RESET}（如 https://yida.company.com）：`, defaultBaseUrl);

  if (!baseUrl) {
    console.error(`${RED}错误：服务地址不能为空${RESET}`);
    process.exit(1);
  }

  // 自动推导登录 URL
  const inferredLoginUrl = baseUrl.replace(/\/+$/, '') + '/workPlatform';
  const defaultLoginUrl = existingConfig?.loginUrl || inferredLoginUrl;
  const loginUrl = await askQuestion(`${BOLD}登录页面地址${RESET}：`, defaultLoginUrl);

  const defaultDescription = existingConfig?.description || '';
  const description = await askQuestion(`${BOLD}环境描述${RESET}（可选）：`, defaultDescription);

  const defaultDwsEndpoint = existingConfig?.dwsEndpoint || '';
  const dwsEndpoint = await askQuestion(`${BOLD}钉钉 DWS 端点${RESET}（私有化钉钉 OpenAPI 网关，可选）：`, defaultDwsEndpoint);

  const defaultTenantId = existingConfig?.tenantId || '';
  const tenantId = await askQuestion(`${BOLD}租户 ID${RESET}（可选）：`, defaultTenantId);

  // 构建环境配置
  const newEnvConfig = {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    loginUrl: loginUrl || inferredLoginUrl,
    description: description || undefined,
    cookieFile: `cookies-${envName}.json`,
  };

  if (dwsEndpoint) { newEnvConfig.dwsEndpoint = dwsEndpoint; }
  if (tenantId) { newEnvConfig.tenantId = tenantId; }

  // 清理 undefined 字段
  Object.keys(newEnvConfig).forEach((key) => {
    if (newEnvConfig[key] === undefined) { delete newEnvConfig[key]; }
  });

  config.environments[envName] = newEnvConfig;
  saveEnvsConfig(config);

  console.log('');
  console.log(`${GREEN}✅ 环境 "${envName}" 已${existingConfig ? '更新' : '添加'}${RESET}`);
  console.log('');
  console.log(`  地址：${CYAN}${newEnvConfig.baseUrl}${RESET}`);
  console.log(`  登录：${CYAN}${newEnvConfig.loginUrl}${RESET}`);
  if (newEnvConfig.description) { console.log(`  描述：${newEnvConfig.description}`); }
  console.log('');
  console.log(`${YELLOW}下一步：切换到该环境并登录${RESET}`);
  console.log(`  ${CYAN}openyida env switch ${envName}${RESET}`);
  console.log(`  ${CYAN}openyida login --qr${RESET}`);
  console.log('');
}

/**
 * 显示 env 命令帮助信息。
 */
function showHelp() {
  console.log('');
  console.log(`${BOLD}openyida env - 多环境管理${RESET}`);
  console.log('');
  console.log(`${CYAN}用法：${RESET}`);
  console.log('  openyida env <子命令> [参数]');
  console.log('');
  console.log(`${CYAN}子命令：${RESET}`);
  console.log(`  ${GREEN}list${RESET}              列出所有环境及当前激活环境`);
  console.log(`  ${GREEN}add <name>${RESET}        交互式添加私有化环境配置`);
  console.log(`  ${GREEN}switch <name>${RESET}     切换当前激活环境`);
  console.log(`  ${GREEN}remove <name>${RESET}     移除环境配置`);
  console.log(`  ${GREEN}show [name]${RESET}       显示环境详细配置`);
  console.log('');
  console.log(`${CYAN}示例：${RESET}`);
  console.log(`  ${BLUE}openyida env list${RESET}                     查看所有环境`);
  console.log(`  ${BLUE}openyida env add private-prod${RESET}         添加私有化生产环境`);
  console.log(`  ${BLUE}openyida env switch private-prod${RESET}      切换到私有化环境`);
  console.log(`  ${BLUE}openyida env show private-prod${RESET}        查看环境详情`);
  console.log(`  ${BLUE}openyida env remove private-prod${RESET}      删除私有化环境`);
  console.log('');
  console.log(`${CYAN}环境变量（优先级高于配置文件）：${RESET}`);
  console.log(`  ${YELLOW}OPENYIDA_ENDPOINT${RESET}=https://yida.company.com    强制指定宜搭地址`);
  console.log(`  ${YELLOW}OPENYIDA_LOGIN_URL${RESET}=https://...                强制指定登录页`);
  console.log(`  ${YELLOW}OPENYIDA_ENV${RESET}=private-prod                    快速切换环境（不修改配置文件）`);
  console.log(`  ${YELLOW}OPENYIDA_DWS_ENDPOINT${RESET}=https://dws.company.com 私有化钉钉网关`);
  console.log('');
}

// ── 主入口 ────────────────────────────────────────────

/**
 * env 命令主入口。
 * @param {string[]} args - process.argv.slice(3) 之后的参数
 */
async function run(args) {
  const subCommand = args[0];
  const subArgs = args.slice(1);

  switch (subCommand) {
    case 'list':
    case undefined:
      cmdList();
      break;

    case 'show':
      cmdShow(subArgs[0]);
      break;

    case 'switch':
      cmdSwitch(subArgs[0]);
      break;

    case 'remove':
    case 'rm':
    case 'delete':
      cmdRemove(subArgs[0]);
      break;

    case 'add':
    case 'create':
      await cmdAdd(subArgs[0]);
      break;

    case '--help':
    case '-h':
    case 'help':
      showHelp();
      break;

    default:
      console.error(`${RED}未知的 env 子命令：${subCommand}${RESET}`);
      console.error(`使用 ${CYAN}openyida env --help${RESET} 查看帮助`);
      process.exit(1);
  }
}

module.exports = { run };
