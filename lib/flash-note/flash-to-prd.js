/**
 * flash-to-prd.js - 钉钉闪记转 PRD 命令
 *
 * 将钉钉闪记（会议录音转文字）内容通过 AI 转化为结构化的 PRD 文档。
 * 支持从文件读取或标准输入读取闪记内容。
 *
 * 用法：
 *   openyida flash-to-prd --file <闪记文件路径> [--name <项目名>]
 *   openyida flash-to-prd --name <项目名>  （从标准输入读取）
 *   cat meeting.txt | openyida flash-to-prd --name "设备巡检系统"
 */

'use strict';

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  findProjectRoot,
  httpPost,
  requestWithAutoLogin,
} = require('../core/utils');
const { t } = require('../core/i18n');

// ── 参数解析 ──────────────────────────────────────────

/**
 * 解析命令行参数
 * @param {string[]} args - 命令行参数数组
 * @returns {{ file: string|null, name: string|null, maxTokens: number }}
 */
function parseArgs(args) {
  const parsed = { file: null, name: null, maxTokens: 8000 };

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--file' || args[i] === '-f') && args[i + 1]) {
      parsed.file = args[++i];
    } else if ((args[i] === '--name' || args[i] === '-n') && args[i + 1]) {
      parsed.name = args[++i];
    } else if (args[i] === '--max-tokens' && args[i + 1]) {
      parsed.maxTokens = parseInt(args[++i], 10) || 8000;
    }
  }

  return parsed;
}

// ── 闪记内容读取 ──────────────────────────────────────

/**
 * 从文件或标准输入读取闪记内容
 * @param {string|null} filePath - 文件路径（null 则从 stdin 读取）
 * @returns {Promise<string>} 闪记原始文本
 */
async function readFlashNoteContent(filePath) {
  if (filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`文件不存在：${absolutePath}`);
    }
    return fs.readFileSync(absolutePath, 'utf-8');
  }

  // 从标准输入读取
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error('未提供闪记内容。请使用 --file 指定文件，或通过管道传入内容。'));
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      if (!data.trim()) {
        reject(new Error('标准输入内容为空'));
        return;
      }
      resolve(data);
    });
    process.stdin.on('error', reject);
  });
}

// ── AI 接口调用 ───────────────────────────────────────

/**
 * 调用宜搭 AI 接口生成文本
 * @param {string} prompt - 构建好的 prompt
 * @param {number} maxTokens - 最大输出 token 数
 * @param {object} authRef - 认证信息引用
 * @returns {Promise<string>} AI 返回的文本内容
 */
async function callAI(prompt, maxTokens, authRef) {
  const response = await requestWithAutoLogin((auth) => {
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      prompt: prompt,
      maxTokens: String(maxTokens),
      skill: 'ToText',
    });
    return httpPost(auth.baseUrl, '/query/intelligent/txtFromAI.json', postData, auth.cookies);
  }, authRef);

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || '未知错误' : '请求失败';
    throw new Error(`AI 接口调用失败：${errorMsg}`);
  }

  return response.content.content;
}

// ── 项目名推断 ────────────────────────────────────────

/**
 * 从 PRD 内容中提取项目名称
 * @param {string} prdContent - 生成的 PRD Markdown 内容
 * @returns {string} 项目名称
 */
function extractProjectNameFromPrd(prdContent) {
  // 尝试从一级标题提取：# 项目名称 — 产品需求文档
  const titleMatch = prdContent.match(/^#\s+(.+?)(?:\s*[—\-–]\s*产品需求文档)?$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // 尝试从二级标题提取
  const subTitleMatch = prdContent.match(/^##\s+项目背景[\s\S]*?(?:构建|开发|搭建|实现|打造)\s*(?:一[个套])?(.{2,20}?)(?:系统|平台|应用|工具|方案)/m);
  if (subTitleMatch) {
    return subTitleMatch[1].trim() + (subTitleMatch[0].match(/(系统|平台|应用|工具|方案)/)?.[1] || '');
  }

  return '未命名项目';
}

// ── 主逻辑 ────────────────────────────────────────────

async function run(args) {
  const parsed = parseArgs(args);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.error('用法：openyida flash-to-prd --file <闪记文件路径> [--name <项目名>]');
    console.error('      openyida flash-to-prd --name <项目名>  （从标准输入读取）');
    console.error('');
    console.error('参数：');
    console.error('  --file, -f <路径>       闪记文本文件路径（支持 .txt / .md）');
    console.error('  --name, -n <名称>       项目名称（可选，默认从闪记内容中自动提取）');
    console.error('  --max-tokens <数量>     AI 最大输出 token 数（默认 8000）');
    console.error('');
    console.error('示例：');
    console.error('  openyida flash-to-prd --file ./meeting-notes.txt --name "设备巡检系统"');
    console.error('  cat meeting.txt | openyida flash-to-prd --name "设备巡检系统"');
    process.exit(0);
  }

  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error('📋 钉钉闪记转 PRD');
  console.error(SEP);

  // Step 1: 读取闪记内容
  console.error('\n[Step 1] 读取闪记内容...');
  let rawFlashNote;
  try {
    rawFlashNote = await readFlashNoteContent(parsed.file);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
  console.error(`✅ 读取成功，原文 ${rawFlashNote.length} 字`);

  // Step 2: 加载 Prompt 构建模块
  console.error('\n[Step 2] 加载 Prompt 构建模块...');
  let promptBuilder;
  const skillsModulePath = path.join(__dirname, '..', '..', 'yida-skills', 'skills', 'yida-flash-note-to-prd', 'build-flash-note-prompt.js');
  const localModulePath = path.join(findProjectRoot(), 'skills', 'yida-flash-note-to-prd', 'build-flash-note-prompt.js');

  if (fs.existsSync(skillsModulePath)) {
    promptBuilder = require(skillsModulePath);
    console.error(`✅ 已加载内置 Prompt 模块`);
  } else if (fs.existsSync(localModulePath)) {
    promptBuilder = require(localModulePath);
    console.error(`✅ 已加载本地 Prompt 模块：${localModulePath}`);
  } else {
    console.error('❌ 未找到 build-flash-note-prompt.js 模块');
    console.error(`  尝试路径 1：${skillsModulePath}`);
    console.error(`  尝试路径 2：${localModulePath}`);
    process.exit(1);
  }

  // Step 3: 预处理 + 会议识别
  console.error('\n[Step 3] 预处理 + 会议识别...');
  const cleanedText = promptBuilder.preprocessFlashNote(rawFlashNote);
  console.error(`  预处理：${rawFlashNote.length} 字 → ${cleanedText.length} 字`);

  const { meta: meetingMeta, bodyText: metaStrippedText } = promptBuilder.extractMeetingMeta(cleanedText);
  const { sections: a1Sections, remainingText: dialogueText } = promptBuilder.extractA1Summary(metaStrippedText);
  const speakers = promptBuilder.extractSpeakers(cleanedText);

  const metaCount = Object.keys(meetingMeta).length;
  console.error(`  会议元信息：${metaCount} 项${meetingMeta.title ? '（' + meetingMeta.title + '）' : ''}`);
  console.error(`  A1 摘要段落：${a1Sections.length} 段${a1Sections.length > 0 ? '（' + a1Sections.map(s => s.title).join('、') + '）' : ''}`);
  console.error(`  发言人识别：${speakers.length} 位${speakers.filter(s => s.role).length > 0 ? '（含角色标注 ' + speakers.filter(s => s.role).length + ' 位）' : ''}`);

  const meetingContext = promptBuilder.buildMeetingContext(meetingMeta, a1Sections, speakers);
  const mainText = dialogueText || cleanedText;

  // Step 4: 登录态检查
  console.error('\n[Step 4] 检查登录态...');
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error('  未检测到登录态，触发登录...');
    cookieData = triggerLogin();
  }

  const authRef = {
    csrfToken: cookieData.csrf_token,
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  console.error(`✅ 登录态就绪（${authRef.baseUrl}）`);

  // Step 5: 构建 Prompt 并调用 AI
  console.error('\n[Step 5] 调用 AI 生成 PRD...');
  const segments = promptBuilder.splitIntoSegments(mainText);
  let prdContent;

  if (segments.length === 1) {
    // 单段模式
    const prompt = promptBuilder.buildFlashNoteToPrdPrompt(mainText, {
      projectName: parsed.name || undefined,
      meetingContext: meetingContext || undefined,
    });
    console.error(`  单段模式，Prompt 长度：${prompt.length} 字`);
    prdContent = await callAI(prompt, parsed.maxTokens, authRef);
  } else {
    // 多段模式
    console.error(`  多段模式，共 ${segments.length} 段`);
    const segmentResults = [];

    for (let index = 0; index < segments.length; index++) {
      const segmentPrompt = promptBuilder.buildFlashNoteToPrdPrompt(segments[index], {
        projectName: parsed.name || undefined,
        segmentIndex: index + 1,
        totalSegments: segments.length,
        meetingContext: index === 0 ? (meetingContext || undefined) : undefined,
      });
      console.error(`  提取第 ${index + 1}/${segments.length} 段（${segmentPrompt.length} 字）...`);
      const result = await callAI(segmentPrompt, parsed.maxTokens, authRef);
      segmentResults.push(result);
    }

    console.error('  合并分段结果...');
    const mergePrompt = promptBuilder.buildMergePrompt(segmentResults, parsed.name);
    prdContent = await callAI(mergePrompt, parsed.maxTokens, authRef);
  }

  console.error('✅ PRD 生成成功');

  // Step 6: 确定项目名称并写入文件
  const projectName = parsed.name || extractProjectNameFromPrd(prdContent);
  const safeFileName = projectName.replace(/[<>:"/\\|?*\s]/g, '-').replace(/-+/g, '-');
  const projectRoot = findProjectRoot();
  const prdDir = path.join(projectRoot, 'prd');

  if (!fs.existsSync(prdDir)) {
    fs.mkdirSync(prdDir, { recursive: true });
  }

  const prdFilePath = path.join(prdDir, `${safeFileName}.md`);
  fs.writeFileSync(prdFilePath, prdContent, 'utf-8');

  // 输出结果
  const SEP2 = '='.repeat(50);
  console.error('\n' + SEP2);
  console.error('✅ 闪记转 PRD 完成');
  console.error(`  项目名称：${projectName}`);
  console.error(`  输出文件：${prdFilePath}`);
  console.error(`  文件大小：${prdContent.length} 字`);
  if (metaCount > 0 || a1Sections.length > 0) {
    console.error(`  会议识别：元信息 ${metaCount} 项，A1 摘要 ${a1Sections.length} 段，发言人 ${speakers.length} 位`);
  }
  console.error(SEP2);

  console.log(JSON.stringify({
    success: true,
    projectName,
    prdFile: prdFilePath,
    contentLength: prdContent.length,
    meetingRecognition: {
      metaFields: metaCount,
      a1Sections: a1Sections.length,
      speakers: speakers.length,
    },
  }));
}

module.exports = { run };
