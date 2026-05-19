'use strict';

const {
  preprocessFlashNote,
  extractMeetingMeta,
  extractA1Summary,
  extractSpeakers,
  buildMeetingContext,
  buildFlashNoteToPrdPrompt,
  flashNoteToPrd,
} = require('../lib/flash-note/build-flash-note-prompt');

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
