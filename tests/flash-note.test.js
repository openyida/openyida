'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const querystring = require('querystring');

jest.mock('../lib/core/utils', () => ({
  loadAuthData: jest.fn(),
  triggerLogin: jest.fn(),
  resolveBaseUrl: jest.fn(() => 'https://www.aliwork.com'),
  httpGet: jest.fn(),
  httpPost: jest.fn(),
  requestWithAutoLogin: jest.fn(),
  findProjectRoot: jest.fn(() => process.cwd()),
}));

const utils = require('../lib/core/utils');
const {
  preprocessFlashNote,
  extractMeetingMeta,
  extractA1Summary,
  extractSpeakers,
  buildMeetingContext,
  buildFlashNoteToPrdPrompt,
  flashNoteToPrd,
} = require('../lib/flash-note/build-flash-note-prompt');
const {
  run,
  callAI,
  parseArgs,
  loadPromptBuilder,
} = require('../lib/flash-note/flash-to-prd');

describe('flash note to PRD prompt builder', () => {
  test('preprocessFlashNote removes timestamps and merges continuous speech', () => {
    const cleaned = preprocessFlashNote([
      '[00:01:02] 张三：嗯 我们要做审批功能。。',
      '张三：支持手机端',
      '',
      '李四：需要导出报表',
    ].join('\n'));

    expect(cleaned).not.toContain('00:01:02');
    expect(cleaned).toContain('张三：');
    expect(cleaned).toContain('支持手机端');
    expect(cleaned).toContain('李四：需要导出报表');
  });

  test('extractMeetingMeta parses structured meeting header and strips it from body', () => {
    const result = extractMeetingMeta([
      '会议主题：客户管理需求评审',
      '会议时间：2026-05-06 10:00',
      '参会人员：张三、李四',
      '',
      '张三：需要客户列表',
    ].join('\n'));

    expect(result.meta).toMatchObject({
      title: '客户管理需求评审',
      date: '2026-05-06 10:00',
      participants: '张三、李四',
      participantList: ['张三', '李四'],
    });
    expect(result.bodyText).toContain('张三：需要客户列表');
  });

  test('extractA1Summary and extractSpeakers preserve useful meeting context', () => {
    const text = [
      '📋 会议摘要',
      '讨论客户管理系统一期范围',
      '',
      '✅ 待办事项',
      '李四整理字段清单',
      '',
      '',
      '张三：客户列表需要筛选',
      '李四：我补充导出能力',
    ].join('\n');

    const summary = extractA1Summary(text);
    const speakers = extractSpeakers(text);

    expect(summary.sections.map((section) => section.type)).toEqual(['summary', 'action_items']);
    expect(summary.remainingText).toContain('张三：客户列表需要筛选');
    expect(speakers.map((speaker) => speaker.name)).toEqual(['张三', '李四']);
  });

  test('buildMeetingContext and prompt include project hints without calling AI', () => {
    const context = buildMeetingContext(
      { title: '客户管理需求评审', participantList: ['张三'] },
      [{ type: 'summary', title: '会议摘要', content: '一期做客户档案' }],
      [{ name: '张三', speakingCount: 2 }]
    );
    const prompt = buildFlashNoteToPrdPrompt('张三：需要客户档案', {
      projectName: 'CRM',
      industry: '制造业',
      meetingContext: context,
    });

    expect(context).toContain('客户管理需求评审');
    expect(prompt).toContain('CRM');
    expect(prompt).toContain('制造业');
    expect(prompt).toContain('客户档案');
    expect(prompt).toContain('MVP 范围与版本边界');
    expect(prompt).toContain('目标用户与权限');
    expect(prompt).toContain('流程与状态机');
    expect(prompt).toContain('数据关联与约束');
    expect(prompt).toContain('OpenYida 落地约束');
    expect(prompt).not.toContain('CascadeSelectField');
  });

  test('flashNoteToPrd uses provided AI caller and returns generated content', async () => {
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const callAI = jest.fn(async (prompt) => `PRD:${prompt.includes('客户档案')}`);

    try {
      const result = await flashNoteToPrd('张三：需要客户档案管理', {
        projectName: 'CRM',
        callAI,
      });

      expect(callAI).toHaveBeenCalledTimes(1);
      expect(result).toBe('PRD:true');
    } finally {
      mockLog.mockRestore();
    }
  });

  test('flashNoteToPrd requires an AI caller', async () => {
    await expect(flashNoteToPrd('张三：需要客户档案')).rejects.toThrow('callAI');
  });
});

describe('flash-to-prd CLI command', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    utils.loadAuthData.mockReturnValue({
      base_url: 'https://www.aliwork.com',
      auth_mode: 'token',
      auth_source: 'token',
      corp_id: 'corp',
      user_id: 'user',
    });
    utils.requestWithAutoLogin.mockImplementation((requestFn, authRef) => requestFn(authRef));
    utils.httpPost.mockResolvedValue({
      success: true,
      content: { content: '# CRM - 产品需求文档\n\n## 背景\n客户档案管理。' },
    });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('parseArgs keeps defaults and explicit options', () => {
    expect(parseArgs(['--file', 'meeting.md', '--name', 'CRM', '--max-tokens', '4096'])).toEqual({
      file: 'meeting.md',
      name: 'CRM',
      maxTokens: 4096,
    });
    expect(parseArgs(['-f', 'meeting.md', '-n', 'CRM'])).toMatchObject({
      file: 'meeting.md',
      name: 'CRM',
      maxTokens: 8000,
    });
  });

  test('callAI posts through yida-client and returns generated text', async () => {
    const result = await callAI('生成 PRD', 2048, {
      baseUrl: 'https://www.aliwork.com',
      authMode: 'token',
      authSource: 'token',
    });

    expect(result).toContain('CRM');
    expect(utils.httpPost).toHaveBeenCalledTimes(1);
    expect(utils.httpPost.mock.calls[0][1]).toBe('/query/intelligent/txtFromAI.json');
    expect(querystring.parse(utils.httpPost.mock.calls[0][2])).toMatchObject({
      prompt: '生成 PRD',
      maxTokens: '2048',
      skill: 'ToText',
    });
  });

  test('callAI reports API failures as CliError', async () => {
    utils.httpPost.mockResolvedValue({
      success: false,
      errorMsg: '模型暂不可用',
    });

    await expect(callAI('生成 PRD', 2048, {
      baseUrl: 'https://www.aliwork.com',
      authMode: 'token',
      authSource: 'token',
    })).rejects.toMatchObject({
      isCliError: true,
      code: 'FLASH_NOTE_AI_ERROR',
    });
  });

  test('run reads flash note file, calls AI, and writes PRD output', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-flash-to-prd-'));
    const inputPath = path.join(tmpDir, 'meeting.txt');
    fs.writeFileSync(inputPath, [
      '会议主题：客户管理需求评审',
      '参会人员：张三、李四',
      '',
      '张三：需要客户档案和筛选。',
      '李四：需要导出报表。',
    ].join('\n'), 'utf8');
    utils.findProjectRoot.mockReturnValue(tmpDir);

    try {
      const result = await run(['--file', inputPath, '--name', 'CRM', '--max-tokens', '2048']);

      expect(result).toMatchObject({
        success: true,
        projectName: 'CRM',
        contentLength: expect.any(Number),
      });
      expect(result.prdFile).toBe(path.join(tmpDir, 'prd', 'CRM.md'));
      expect(fs.readFileSync(result.prdFile, 'utf8')).toContain('客户档案管理');
      expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(result);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('run returns help without exiting', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not be called');
    });

    try {
      await expect(run(['--help'])).resolves.toEqual({ help: true });
      expect(exitSpy).not.toHaveBeenCalled();
      expect(utils.httpPost).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });

  test('run reports missing input file as CliError before network work', async () => {
    await expect(run(['--file', path.join(os.tmpdir(), 'missing-openyida-flash-note.txt')]))
      .rejects.toMatchObject({
        isCliError: true,
        code: 'FLASH_NOTE_INPUT_ERROR',
      });
    expect(utils.httpPost).not.toHaveBeenCalled();
  });

  test('loadPromptBuilder resolves the packaged prompt builder', () => {
    const promptBuilder = loadPromptBuilder();

    expect(promptBuilder).toHaveProperty('buildFlashNoteToPrdPrompt');
  });
});
