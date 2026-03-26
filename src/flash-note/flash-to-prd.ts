/**
 * flash-to-prd.ts - 钉钉闪记转 PRD 命令
 *
 * 将钉钉闪记（会议录音转文字）内容通过 AI 转化为结构化的 PRD 文档。
 * 支持从文件读取或标准输入读取闪记内容。
 *
 * 用法：
 *   openyida flash-to-prd --file <闪记文件路径> [--name <项目名>]
 *   openyida flash-to-prd --name <项目名>  （从标准输入读取）
 */

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as querystring from 'querystring';
import {
  loadCookieData,
  triggerLogin,
  resolveBaseUrl,
  findProjectRoot,
  httpPost,
  requestWithAutoLogin,
} from '../core/utils';
import { t } from '../core/i18n';
import type {
  AuthRef,
  YidaApiResponse,
  FlashToPrdParsedArgs,
  FlashToPrdResult,
  PromptBuilderModule,
} from '../types';

// ── 参数解析 ──────────────────────────────────────────

function parseArgs(args: string[]): FlashToPrdParsedArgs {
  const parsed: FlashToPrdParsedArgs = { file: null, name: null, maxTokens: 8000 };

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

async function readFlashNoteContent(filePath: string | null): Promise<string> {
  if (filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(t('flash_to_prd.file_not_found', absolutePath));
    }
    return fs.readFileSync(absolutePath, 'utf-8');
  }

  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error(t('flash_to_prd.no_input')));
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => {
      if (!data.trim()) {
        reject(new Error(t('flash_to_prd.stdin_empty')));
        return;
      }
      resolve(data);
    });
    process.stdin.on('error', reject);
  });
}

// ── AI 接口调用 ───────────────────────────────────────

interface AiTextContent {
  content: string;
}

async function callAI(prompt: string, maxTokens: number, authRef: AuthRef): Promise<string> {
  const response = await requestWithAutoLogin((auth: AuthRef) => {
    const postData = querystring.stringify({
      _csrf_token: auth.csrfToken,
      prompt,
      maxTokens: String(maxTokens),
      skill: 'ToText',
    });
    return httpPost(auth.baseUrl, '/query/intelligent/txtFromAI.json', postData, auth.cookies);
  }, authRef);

  if (!response || !response.success) {
    const errorMsg = response ? response.errorMsg || 'unknown error' : 'request failed';
    throw new Error(t('flash_to_prd.ai_error', errorMsg));
  }

  const content = response.content as AiTextContent;
  return content.content;
}

// ── 项目名推断 ────────────────────────────────────────

function extractProjectNameFromPrd(prdContent: string): string {
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

function loadPromptBuilder(): PromptBuilderModule {
  const projectRoot = findProjectRoot();
  const skillsModulePath = path.join(
    __dirname, '..', '..', 'yida-skills', 'skills',
    'yida-flash-note-to-prd', 'build-flash-note-prompt.js'
  );
  const localModulePath = path.join(
    projectRoot, 'skills', 'yida-flash-note-to-prd', 'build-flash-note-prompt.js'
  );

  if (fs.existsSync(skillsModulePath)) {
    console.error(t('flash_to_prd.module_loaded_builtin'));
    return require(skillsModulePath) as PromptBuilderModule;
  }

  if (fs.existsSync(localModulePath)) {
    console.error(t('flash_to_prd.module_loaded_local', localModulePath));
    return require(localModulePath) as PromptBuilderModule;
  }

  console.error(t('flash_to_prd.module_not_found'));
  console.error(t('flash_to_prd.module_path_tried', '1', skillsModulePath));
  console.error(t('flash_to_prd.module_path_tried', '2', localModulePath));
  process.exit(1);
}

// ── 帮助信息 ──────────────────────────────────────────

function printHelp(): void {
  console.error(t('flash_to_prd.help_usage'));
  console.error(t('flash_to_prd.help_usage2'));
  console.error('');
  console.error(t('flash_to_prd.help_args_title'));
  console.error(t('flash_to_prd.help_arg_file'));
  console.error(t('flash_to_prd.help_arg_name'));
  console.error(t('flash_to_prd.help_arg_max_tokens'));
  console.error('');
  console.error(t('flash_to_prd.help_examples_title'));
  console.error(t('flash_to_prd.help_example1'));
  console.error(t('flash_to_prd.help_example2'));
}

// ── 主逻辑 ────────────────────────────────────────────

export async function run(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const SEP = '='.repeat(50);
  console.error(SEP);
  console.error(t('flash_to_prd.title'));
  console.error(SEP);

  // Step 1: 读取闪记内容
  console.error('\n' + t('flash_to_prd.step_read'));
  let rawFlashNote: string;
  try {
    rawFlashNote = await readFlashNoteContent(parsed.file);
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }
  console.error(t('flash_to_prd.read_success', String(rawFlashNote.length)));

  // Step 2: 加载 Prompt 构建模块
  console.error('\n' + t('flash_to_prd.step_load_module'));
  const promptBuilder = loadPromptBuilder();

  // Step 3: 预处理 + 会议识别
  console.error('\n' + t('flash_to_prd.step_preprocess'));
  const cleanedText = promptBuilder.preprocessFlashNote(rawFlashNote);
  console.error(t('flash_to_prd.preprocess_result', String(rawFlashNote.length), String(cleanedText.length)));

  const { meta: meetingMeta, bodyText: metaStrippedText } = promptBuilder.extractMeetingMeta(cleanedText);
  const { sections: a1Sections, remainingText: dialogueText } = promptBuilder.extractA1Summary(metaStrippedText);
  const speakers = promptBuilder.extractSpeakers(cleanedText);

  const metaCount = Object.keys(meetingMeta).length;
  const metaTitle = meetingMeta.title ? `（${meetingMeta.title}）` : '';
  console.error(t('flash_to_prd.meeting_meta', String(metaCount), metaTitle));

  const sectionTitles = a1Sections.length > 0
    ? `（${a1Sections.map(section => section.title).join('、')}）`
    : '';
  console.error(t('flash_to_prd.a1_sections', String(a1Sections.length), sectionTitles));

  const roleCount = speakers.filter(speaker => speaker.role).length;
  const roleInfo = roleCount > 0 ? t('flash_to_prd.speakers_with_role', String(roleCount)) : '';
  console.error(t('flash_to_prd.speakers', String(speakers.length), roleInfo));

  const meetingContext = promptBuilder.buildMeetingContext(meetingMeta, a1Sections, speakers);
  const mainText = dialogueText || cleanedText;

  // Step 4: 登录态检查
  console.error('\n' + t('flash_to_prd.step_login'));
  let cookieData = loadCookieData();
  if (!cookieData) {
    console.error(t('flash_to_prd.no_login'));
    cookieData = triggerLogin();
  }

  const authRef: AuthRef = {
    csrfToken: cookieData.csrf_token || '',
    cookies: cookieData.cookies,
    baseUrl: resolveBaseUrl(cookieData),
    cookieData,
  };
  console.error(t('flash_to_prd.login_ready', authRef.baseUrl));

  // Step 5: 构建 Prompt 并调用 AI
  console.error('\n' + t('flash_to_prd.step_ai'));
  const segments = promptBuilder.splitIntoSegments(mainText);
  let prdContent: string;

  if (segments.length === 1) {
    const prompt = promptBuilder.buildFlashNoteToPrdPrompt(mainText, {
      projectName: parsed.name || undefined,
      meetingContext: meetingContext || undefined,
    });
    console.error(t('flash_to_prd.single_segment', String(prompt.length)));
    prdContent = await callAI(prompt, parsed.maxTokens, authRef);
  } else {
    console.error(t('flash_to_prd.multi_segment', String(segments.length)));
    const segmentResults: string[] = [];

    for (let index = 0; index < segments.length; index++) {
      const segmentPrompt = promptBuilder.buildFlashNoteToPrdPrompt(segments[index], {
        projectName: parsed.name || undefined,
        segmentIndex: index + 1,
        totalSegments: segments.length,
        meetingContext: index === 0 ? (meetingContext || undefined) : undefined,
      });
      console.error(t('flash_to_prd.extracting_segment', String(index + 1), String(segments.length), String(segmentPrompt.length)));
      const result = await callAI(segmentPrompt, parsed.maxTokens, authRef);
      segmentResults.push(result);
    }

    console.error(t('flash_to_prd.merging_segments'));
    const mergePrompt = promptBuilder.buildMergePrompt(segmentResults, parsed.name);
    prdContent = await callAI(mergePrompt, parsed.maxTokens, authRef);
  }

  console.error(t('flash_to_prd.ai_success'));

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

  const result: FlashToPrdResult = {
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
  console.error('\n' + SEP2);
  console.error(t('flash_to_prd.done'));
  console.error(t('flash_to_prd.done_project', projectName));
  console.error(t('flash_to_prd.done_file', prdFilePath));
  console.error(t('flash_to_prd.done_size', String(prdContent.length)));
  if (metaCount > 0 || a1Sections.length > 0) {
    console.error(t('flash_to_prd.done_meeting', String(metaCount), String(a1Sections.length), String(speakers.length)));
  }
  console.error(SEP2);

  console.log(JSON.stringify(result));
}
