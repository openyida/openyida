/**
 * flash-to-prd.js - 钉钉闪记转 PRD 命令
 *
 * 将钉钉闪记（会议录音转文字）内容通过 AI 转化为结构化的 PRD 文档。
 * 支持从文件读取或标准输入读取闪记内容。
 *
 * 用法：
 *   openyida flash-to-prd --file <闪记文件路径> [--name <项目名>]
 *   openyida flash-to-prd --name <项目名>  （从标准输入读取）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { findProjectRoot } = require('../core/utils');
const { CliError } = require('../core/cli-error');
const { createAuthRef, createYidaClient, isAuthRefReady } = require('../core/yida-client');
const { t } = require('../core/i18n');
const { warn } = require('../core/chalk');

// ── 路径常量 ──────────────────────────────────────────

/** Prompt 构建模块文件名（与本文件同目录） */
const PROMPT_BUILDER_FILE = 'build-flash-note-prompt.js';

/** 闪记转 PRD 技能在工作目录软链中的相对路径（用户自定义覆盖场景） */
const FLASH_NOTE_SKILL_RELATIVE_PATH = path.join(
  'yida-skills', 'skills', 'yida-flash-note-to-prd', PROMPT_BUILDER_FILE
);

/** PRD 输出目录名（相对于项目工作目录） */
const PRD_OUTPUT_DIR = 'prd';

// ── 参数解析 ──────────────────────────────────────────

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

async function readFlashNoteContent(filePath) {
  if (filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(t('flashNote.toPrd.file_not_found', absolutePath));
    }
    return fs.readFileSync(absolutePath, 'utf-8');
  }

  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error(t('flashNote.toPrd.no_input')));
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      if (!data.trim()) {
        reject(new Error(t('flashNote.toPrd.stdin_empty')));
        return;
      }
      resolve(data);
    });
    process.stdin.on('error', reject);
  });
}

// ── AI 接口调用 ───────────────────────────────────────

async function callAI(prompt, maxTokens, authRef) {
  const response = await createYidaClient({ authRef }).postForm(
    '/query/intelligent/txtFromAI.json',
    {
      prompt,
      maxTokens: String(maxTokens),
      skill: 'ToText',
    }
  );

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || 'unknown error' : 'request failed';
    throw new CliError(t('flashNote.toPrd.ai_error', errorMsg), {
      code: 'FLASH_NOTE_AI_ERROR',
      details: response || { success: false, errorMsg },
    });
  }

  if (!response.content || typeof response.content.content !== 'string') {
    throw new CliError(t('flashNote.toPrd.ai_error', t('common.response_not_json')), {
      code: 'FLASH_NOTE_AI_ERROR',
      details: response,
    });
  }

  return response.content.content;
}

function ensureSession() {
  const authRef = createAuthRef();
  if (!isAuthRefReady(authRef)) {
    throw new CliError(t('common.no_login_cache'), {
      code: 'NEED_LOGIN',
    });
  }
  return authRef;
}

// ── 项目名推断 ────────────────────────────────────────

function extractProjectNameFromPrd(prdContent) {
  const titleMatch = prdContent.match(/^#\s+(.+?)(?:\s*[—\-–]\s*产品需求文档)?$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  const subTitleMatch = prdContent.match(
    /^##\s+项目背景[\s\S]*?(?:构建|开发|搭建|实现|打造)\s*(?:一[个套])?(.{2,20}?)(?:系统|平台|应用|工具|方案)/m
  );
  if (subTitleMatch) {
    const suffix = subTitleMatch[0].match(/(系统|平台|应用|工具|方案)/)?.[1] || '';
    return subTitleMatch[1].trim() + suffix;
  }

  return '未命名项目';
}

// ── Prompt 构建模块加载 ───────────────────────────────

function loadPromptBuilder() {
  // 优先：与本文件同目录的内置模块（npm 包安装后的标准路径）
  const builtinModulePath = path.join(__dirname, PROMPT_BUILDER_FILE);

  // 备用：用户工作目录下的 yida-skills 软链（openyida copy -skills 创建的软链）
  const projectRoot = findProjectRoot();
  const linkedModulePath = path.join(projectRoot, FLASH_NOTE_SKILL_RELATIVE_PATH);

  if (fs.existsSync(builtinModulePath)) {
    warn(t('flashNote.toPrd.module_loaded_builtin'));
    return require(builtinModulePath);
  }

  if (fs.existsSync(linkedModulePath)) {
    warn(t('flashNote.toPrd.module_loaded_local', linkedModulePath));
    return require(linkedModulePath);
  }

  warn(t('flashNote.toPrd.module_not_found'));
  warn(t('flashNote.toPrd.module_path_tried', '1', builtinModulePath));
  warn(t('flashNote.toPrd.module_path_tried', '2', linkedModulePath));
  throw new CliError([
    t('flashNote.toPrd.module_not_found'),
    t('flashNote.toPrd.module_path_tried', '1', builtinModulePath),
    t('flashNote.toPrd.module_path_tried', '2', linkedModulePath),
  ].join('\n'), {
    code: 'FLASH_NOTE_PROMPT_BUILDER_NOT_FOUND',
    details: { builtinModulePath, linkedModulePath },
  });
}

// ── 帮助信息 ──────────────────────────────────────────

function printHelp() {
  warn(t('flashNote.toPrd.help_usage'));
  warn(t('flashNote.toPrd.help_usage2'));
  warn('');
  warn(t('flashNote.toPrd.help_args_title'));
  warn(t('flashNote.toPrd.help_arg_file'));
  warn(t('flashNote.toPrd.help_arg_name'));
  warn(t('flashNote.toPrd.help_arg_max_tokens'));
  warn('');
  warn(t('flashNote.toPrd.help_examples_title'));
  warn(t('flashNote.toPrd.help_example1'));
  warn(t('flashNote.toPrd.help_example2'));
}

// ── 主逻辑 ────────────────────────────────────────────

async function run(args) {
  const parsed = parseArgs(args);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return { help: true };
  }

  const SEP = '='.repeat(50);
  warn(SEP);
  warn(t('flashNote.toPrd.title'));
  warn(SEP);

  // Step 1: 读取闪记内容
  warn('\n' + t('flashNote.toPrd.step_read'));
  let rawFlashNote;
  try {
    rawFlashNote = await readFlashNoteContent(parsed.file);
  } catch (err) {
    throw new CliError(err.message, {
      code: 'FLASH_NOTE_INPUT_ERROR',
      details: { file: parsed.file || null },
    });
  }
  warn(t('flashNote.toPrd.read_success', String(rawFlashNote.length)));

  // Step 2: 加载 Prompt 构建模块
  warn('\n' + t('flashNote.toPrd.step_load_module'));
  const promptBuilder = loadPromptBuilder();

  // Step 3: 预处理 + 会议识别
  warn('\n' + t('flashNote.toPrd.step_preprocess'));
  const cleanedText = promptBuilder.preprocessFlashNote(rawFlashNote);
  warn(t('flashNote.toPrd.preprocess_result', String(rawFlashNote.length), String(cleanedText.length)));

  const { meta: meetingMeta, bodyText: metaStrippedText } = promptBuilder.extractMeetingMeta(cleanedText);
  const { sections: a1Sections, remainingText: dialogueText } = promptBuilder.extractA1Summary(metaStrippedText);
  const speakers = promptBuilder.extractSpeakers(cleanedText);

  const metaCount = Object.keys(meetingMeta).length;
  const metaTitle = meetingMeta.title ? `（${meetingMeta.title}）` : '';
  warn(t('flashNote.toPrd.meeting_meta', String(metaCount), metaTitle));

  const sectionTitles = a1Sections.length > 0
    ? `（${a1Sections.map(section => section.title).join('、')}）`
    : '';
  warn(t('flashNote.toPrd.a1_sections', String(a1Sections.length), sectionTitles));

  const roleCount = speakers.filter(speaker => speaker.role).length;
  const roleInfo = roleCount > 0 ? t('flashNote.toPrd.speakers_with_role', String(roleCount)) : '';
  warn(t('flashNote.toPrd.speakers', String(speakers.length), roleInfo));

  const meetingContext = promptBuilder.buildMeetingContext(meetingMeta, a1Sections, speakers);
  const mainText = dialogueText || cleanedText;

  // Step 4: 登录态检查
  warn('\n' + t('flashNote.toPrd.step_login'));
  const authRef = ensureSession();
  warn(t('flashNote.toPrd.login_ready', authRef.baseUrl));

  // Step 5: 构建 Prompt 并调用 AI
  warn('\n' + t('flashNote.toPrd.step_ai'));
  const segments = promptBuilder.splitIntoSegments(mainText);
  let prdContent;

  if (segments.length === 1) {
    const prompt = promptBuilder.buildFlashNoteToPrdPrompt(mainText, {
      projectName: parsed.name || undefined,
      meetingContext: meetingContext || undefined,
    });
    warn(t('flashNote.toPrd.single_segment', String(prompt.length)));
    prdContent = await callAI(prompt, parsed.maxTokens, authRef);
  } else {
    warn(t('flashNote.toPrd.multi_segment', String(segments.length)));
    const segmentResults = [];

    for (let index = 0; index < segments.length; index++) {
      const segmentPrompt = promptBuilder.buildFlashNoteToPrdPrompt(segments[index], {
        projectName: parsed.name || undefined,
        segmentIndex: index + 1,
        totalSegments: segments.length,
        meetingContext: index === 0 ? (meetingContext || undefined) : undefined,
      });
      warn(t('flashNote.toPrd.extracting_segment', String(index + 1), String(segments.length), String(segmentPrompt.length)));
      const result = await callAI(segmentPrompt, parsed.maxTokens, authRef);
      segmentResults.push(result);
    }

    warn(t('flashNote.toPrd.merging_segments'));
    const mergePrompt = promptBuilder.buildMergePrompt(segmentResults, parsed.name);
    prdContent = await callAI(mergePrompt, parsed.maxTokens, authRef);
  }

  warn(t('flashNote.toPrd.ai_success'));

  // Step 6: 确定项目名称并写入文件
  const projectName = parsed.name || extractProjectNameFromPrd(prdContent);
  const safeFileName = projectName.replace(/[<>:"/\\|?*\s]/g, '-').replace(/-+/g, '-');
  const projectRoot = findProjectRoot();
  const prdDir = path.join(projectRoot, PRD_OUTPUT_DIR);

  const prdFilePath = path.join(prdDir, `${safeFileName}.md`);
  try {
    if (!fs.existsSync(prdDir)) {
      fs.mkdirSync(prdDir, { recursive: true });
    }
    fs.writeFileSync(prdFilePath, prdContent, 'utf-8');
  } catch (err) {
    throw new CliError(err.message, {
      code: 'FLASH_NOTE_WRITE_FAILED',
      details: { prdFilePath },
    });
  }

  const result = {
    success: true,
    projectName,
    prdFile: prdFilePath,
    contentLength: prdContent.length,
    meetingRecognition: {
      metaFields: metaCount,
      a1Sections: a1Sections.length,
      speakers: speakers.length,
    },
  };

  const SEP2 = '='.repeat(50);
  warn('\n' + SEP2);
  warn(t('flashNote.toPrd.done'));
  warn(t('flashNote.toPrd.done_project', projectName));
  warn(t('flashNote.toPrd.done_file', prdFilePath));
  warn(t('flashNote.toPrd.done_size', String(prdContent.length)));
  if (metaCount > 0 || a1Sections.length > 0) {
    warn(t('flashNote.toPrd.done_meeting', String(metaCount), String(a1Sections.length), String(speakers.length)));
  }
  warn(SEP2);

  console.log(JSON.stringify(result));
  return result;
}

module.exports = {
  run,
  parseArgs,
  readFlashNoteContent,
  callAI,
  ensureSession,
  extractProjectNameFromPrd,
  loadPromptBuilder,
};
