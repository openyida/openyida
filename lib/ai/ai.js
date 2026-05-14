/**
 * ai.js - 宜搭 AI 能力命令
 *
 * 支持：
 *   openyida ai text --prompt "..."         调用 txtFromAI 文生文
 *   openyida ai image --file ./image.png    上传图片并调用识图连接器
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  findProjectRoot,
  httpGet,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { warn } = require('../core/chalk');

const DEFAULT_MAX_TOKENS = 3000;
const DEFAULT_IMAGE_CONNECTOR = {
  connectorId: 'Http_2aa221179eef4c128de666c5b9c8df1b',
  actionId: 'flowerrecognize',
  connection: 2391,
};

const IMAGE_MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

function printHelp() {
  console.log(`
用法:
  openyida ai text --prompt "提示词" [--max-tokens 3000] [--json]
  openyida ai text --file prompt.txt [--json]
  openyida ai image --file ./image.png --app-type APP_XXX [--json]
  openyida ai image --image-url https://... [--json]

子命令:
  text     调用宜搭 /query/intelligent/txtFromAI.json
  image    上传本地图片并调用识图连接器；也可直接传入 --image-url

image 选项:
  --app-type <APP_XXX>        上传图片使用的宜搭应用 ID；未传时尝试读取当前 project/config.json 或 Cookie
  --form-uuid <FORM_XXX>      可选，上传回调关联的表单 ID
  --connector-id <id>         识图 HTTP 连接器 ID，默认使用 HAR 中的植物识别连接器
  --action-id <id>            识图动作 ID，默认 flowerrecognize
  --connection <id>           识图连接账号 ID，默认 2391
  --baike / --no-baike        是否返回百科信息，默认 --baike
  --base-url <url>            覆盖宜搭域名，例如 https://demo.aliwork.com
`);
}

function parseArgs(args) {
  const parsed = {
    subCommand: args[0],
    prompt: '',
    file: '',
    imageUrl: '',
    maxTokens: DEFAULT_MAX_TOKENS,
    json: false,
    appType: '',
    formUuid: '',
    connectorId: DEFAULT_IMAGE_CONNECTOR.connectorId,
    actionId: DEFAULT_IMAGE_CONNECTOR.actionId,
    connection: DEFAULT_IMAGE_CONNECTOR.connection,
    baike: true,
    baseUrl: '',
    help: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if ((arg === '--prompt' || arg === '-p') && args[i + 1]) {
      parsed.prompt = args[++i];
    } else if ((arg === '--file' || arg === '-f') && args[i + 1]) {
      parsed.file = args[++i];
    } else if (arg === '--image-url' && args[i + 1]) {
      parsed.imageUrl = args[++i];
    } else if (arg === '--max-tokens' && args[i + 1]) {
      parsed.maxTokens = parseInt(args[++i], 10) || DEFAULT_MAX_TOKENS;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--app-type' && args[i + 1]) {
      parsed.appType = args[++i];
    } else if (arg === '--form-uuid' && args[i + 1]) {
      parsed.formUuid = args[++i];
    } else if (arg === '--connector-id' && args[i + 1]) {
      parsed.connectorId = args[++i];
    } else if (arg === '--action-id' && args[i + 1]) {
      parsed.actionId = args[++i];
    } else if (arg === '--connection' && args[i + 1]) {
      parsed.connection = parseInt(args[++i], 10) || args[i];
    } else if (arg === '--baike') {
      parsed.baike = true;
    } else if (arg === '--no-baike') {
      parsed.baike = false;
    } else if (arg === '--base-url' && args[i + 1]) {
      parsed.baseUrl = args[++i].replace(/\/+$/, '');
    }
  }

  return parsed;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function readPrompt(options) {
  if (options.prompt) {
    return options.prompt;
  }
  if (options.file) {
    const absolutePath = path.resolve(options.file);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`文件不存在: ${absolutePath}`);
    }
    return fs.readFileSync(absolutePath, 'utf-8');
  }
  return readStdin();
}

function getAuthRef(options) {
  let cookieData = loadCookieData();
  if (!cookieData || !cookieData.cookies || !cookieData.csrf_token) {
    cookieData = triggerLogin();
  }
  if (!cookieData || !cookieData.cookies || !cookieData.csrf_token) {
    throw new Error('未获取到有效宜搭登录态，请先执行 openyida login');
  }
  return {
    csrfToken: cookieData.csrf_token || '',
    cookies: cookieData.cookies || [],
    baseUrl: options.baseUrl || resolveBaseUrl(cookieData),
    cookieData,
  };
}

function getCookieValue(authRef, name) {
  const matched = (authRef.cookies || []).filter(cookie => cookie.name === name);
  return matched.length ? matched[0].value : '';
}

function inferAppType(options, authRef) {
  if (options.appType) {
    return options.appType;
  }

  const projectRoot = findProjectRoot();
  const configPath = path.join(projectRoot, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.appType) {
        return config.appType;
      }
    } catch {
      // ignore invalid local config and continue with cookie fallback
    }
  }

  return getCookieValue(authRef, 'tianshu_app_type');
}

function getSuccessContent(response, fallbackMessage) {
  if (!response || !response.success) {
    throw new Error(response && response.errorMsg ? response.errorMsg : fallbackMessage);
  }
  return response.content;
}

async function callTextFromAI(prompt, options, authRef) {
  const response = await requestWithAutoLogin((auth) => {
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      prompt,
      maxTokens: String(options.maxTokens || DEFAULT_MAX_TOKENS),
      skill: 'ToText',
    });
    return httpPost(auth.baseUrl, '/query/intelligent/txtFromAI.json', postData, auth.cookies);
  }, authRef);

  const content = getSuccessContent(response, 'AI 接口调用失败');

  return {
    success: true,
    content: content && content.content ? content.content : '',
    raw: response,
  };
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_MIME_TYPES[ext] || 'application/octet-stream';
}

function createObjectName(appType, filePath) {
  const ext = path.extname(filePath) || '.png';
  const now = new Date();
  const monthDay = (now.getMonth() + 1) + '-' + now.getDate();
  const id = crypto.randomUUID ? crypto.randomUUID().toUpperCase() : crypto.randomBytes(16).toString('hex').toUpperCase();
  return appType + '/' + now.getFullYear() + '/' + monthDay + '/' + id + ext;
}

async function getOssSign(filePath, appType, authRef) {
  const stat = fs.statSync(filePath);
  const fileName = path.basename(filePath);
  const contentType = getMimeType(filePath);
  const objectName = createObjectName(appType, filePath);

  return requestWithAutoLogin((auth) => {
    return httpGet(auth.baseUrl, '/ossSign', {
      scene: 'ImageField',
      _api: 'nattyFetch',
      _mock: 'false',
      _csrf_token: auth.csrfToken,
      appType,
      fileName,
      fileSize: String(stat.size),
      contentType,
      isOpen: 'n',
      newContext: 'y',
      objectName,
      procInstId: '',
      businessType: '',
      accelerate: 'y',
      _stamp: String(Date.now()),
    }, auth.cookies);
  }, authRef);
}

async function postToOss(filePath, signContent) {
  if (typeof fetch !== 'function' || typeof FormData !== 'function' || typeof Blob !== 'function') {
    throw new Error('当前 Node.js 环境缺少 fetch/FormData，请使用 Node.js 18+');
  }

  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('accessid', signContent.accessid);
  form.append('key', signContent.objectName);
  form.append('policy', signContent.policy);
  form.append('OSSAccessKeyId', signContent.accessid);
  form.append('signature', signContent.signature);
  form.append('expire', signContent.expire);
  form.append('appType', signContent.appType);
  form.append('Content-Disposition', 'attachment; filename=' + fileName);
  form.append('file', new Blob([fileBuffer], { type: getMimeType(filePath) }), fileName);

  const response = await fetch(signContent.host, {
    method: 'POST',
    body: form,
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.text();
    throw new Error('OSS 上传失败: HTTP ' + response.status + ' ' + body.slice(0, 160));
  }

  return {
    status: response.status,
    requestId: response.headers.get('x-oss-request-id') || '',
  };
}

async function convertToPublicImageUrl(downloadUrl, authRef) {
  const response = await requestWithAutoLogin((auth) => {
    return httpGet(auth.baseUrl, '/aliyun/sdk/upload2Oss.json', {
      imageUrl: downloadUrl,
      _csrf_token: auth.csrfToken,
    }, auth.cookies);
  }, authRef);

  if (!response || !response.success) {
    throw new Error(response && response.errorMsg ? response.errorMsg : '图片 URL 转换失败');
  }
  return response.content;
}

async function uploadCallback(filePath, appType, formUuid, signContent, ossResult, authRef) {
  if (!formUuid) {
    return { skipped: true };
  }

  const stat = fs.statSync(filePath);
  return requestWithAutoLogin((auth) => {
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      appType,
      fileName: path.basename(filePath),
      fileSize: String(stat.size),
      objectName: signContent.objectName,
      formUuid,
      procInstId: '',
      ossRequestId: ossResult.requestId || '',
      businessType: 'inst',
    });
    return httpPost(auth.baseUrl, '/query/attach/uploadCallBack.json', postData, auth.cookies);
  }, authRef);
}

async function uploadImageForAI(filePath, options, authRef) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`图片不存在: ${absolutePath}`);
  }

  const appType = inferAppType(options, authRef);
  if (!appType) {
    throw new Error('上传图片需要 appType，请传入 --app-type APP_XXX');
  }

  const signResponse = await getOssSign(absolutePath, appType, authRef);
  const signContent = getSuccessContent(signResponse, '获取 OSS 上传签名失败');
  if (!signContent) {
    throw new Error('获取 OSS 上传签名失败');
  }

  const ossResult = await postToOss(absolutePath, signContent);
  const publicImageUrl = await convertToPublicImageUrl(signContent.downloadUrl, authRef);
  const callbackResult = await uploadCallback(absolutePath, appType, options.formUuid, signContent, ossResult, authRef);

  return {
    appType,
    fileName: path.basename(absolutePath),
    fileSize: fs.statSync(absolutePath).size,
    contentType: getMimeType(absolutePath),
    objectName: signContent.objectName,
    downloadUrl: signContent.downloadUrl,
    previewUrl: signContent.previewUrl,
    imageUrl: publicImageUrl,
    ossRequestId: ossResult.requestId,
    callback: callbackResult && callbackResult.skipped ? 'skipped' : 'ok',
  };
}

async function invokeImageRecognition(imageUrl, options, authRef) {
  const inputs = {
    path: {},
    query: {
      PageIndex: '1',
      PageSize: '50',
      KeyWord: '',
    },
    header: {},
    body: {
      image: imageUrl,
      baike: options.baike ? '1' : '0',
    },
  };
  const serviceInfo = {
    connectorInfo: {
      connectorId: options.connectorId,
      actionId: options.actionId,
      type: 'httpConnector',
      connection: options.connection,
    },
  };

  const response = await requestWithAutoLogin((auth) => {
    const postData = querystring.stringify({
      inputs: JSON.stringify(inputs),
      serviceInfo: JSON.stringify(serviceInfo),
      _csrf_token: auth.csrfToken,
    });
    return httpPost(auth.baseUrl, '/query/publicService/invokeService.json', postData, auth.cookies);
  }, authRef);

  if (!response || !response.success) {
    throw new Error(response && response.errorMsg ? response.errorMsg : '识图服务调用失败');
  }

  return response.content && response.content.serviceReturnValue
    ? response.content.serviceReturnValue
    : response.content;
}

function normalizeImageResult(serviceReturnValue) {
  const list = serviceReturnValue && Array.isArray(serviceReturnValue.result)
    ? serviceReturnValue.result
    : [];
  return list.map(item => ({
    name: item.name || '',
    score: typeof item.score === 'number' ? item.score : Number(item.score) || 0,
    confidence: Math.round((typeof item.score === 'number' ? item.score : Number(item.score) || 0) * 10000) / 100,
    baikeInfo: item.baike_info || item.baikeInfo || {},
    raw: item,
  }));
}

function printImageSummary(result) {
  console.log('图片 URL: ' + result.imageUrl);
  if (!result.recognition.length) {
    console.log('识别结果: 无结果');
    return;
  }
  console.log('识别结果:');
  result.recognition.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.name || '未知'}  ${item.confidence}%`);
  });
}

async function runText(options, authRef) {
  const prompt = await readPrompt(options);
  if (!prompt.trim()) {
    throw new Error('请通过 --prompt、--file 或 stdin 提供提示词');
  }
  const output = await callTextFromAI(prompt, options, authRef);
  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(output.content);
  }
}

async function runImage(options, authRef) {
  let upload = null;
  let imageUrl = options.imageUrl;

  if (!imageUrl) {
    if (!options.file) {
      throw new Error('请通过 --file 上传图片，或通过 --image-url 传入图片 URL');
    }
    upload = await uploadImageForAI(options.file, options, authRef);
    imageUrl = upload.imageUrl;
  }

  const serviceReturnValue = await invokeImageRecognition(imageUrl, options, authRef);
  const result = {
    success: true,
    imageUrl,
    upload,
    recognition: normalizeImageResult(serviceReturnValue),
    raw: serviceReturnValue,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printImageSummary(result);
  }
}

async function run(args) {
  const options = parseArgs(args);
  if (!options.subCommand || options.help || options.subCommand === '--help' || options.subCommand === '-h') {
    printHelp();
    return;
  }

  const authRef = getAuthRef(options);
  if (options.subCommand === 'text' || options.subCommand === 'txt') {
    await runText(options, authRef);
    return;
  }
  if (options.subCommand === 'image' || options.subCommand === 'vision' || options.subCommand === 'image-recognize') {
    await runImage(options, authRef);
    return;
  }

  warn(`未知的 ai 子命令: ${options.subCommand}`);
  printHelp();
  process.exit(1);
}

module.exports = {
  run,
  callTextFromAI,
  uploadImageForAI,
  invokeImageRecognition,
  normalizeImageResult,
  parseArgs,
};
