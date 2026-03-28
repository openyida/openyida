/**
 * 闪记转 PRD — 高质量 Prompt 构建模块
 *
 * 将钉钉闪记（会议录音转文字）内容转化为结构化的高质量 prompt，
 * 调用 txtFromAI 接口生成标准 PRD 文档。
 *
 * 核心设计思路：
 * 1. 预处理：清洗闪记原文，去除噪音，保留有效信息
 * 2. 分段策略：超长闪记自动分段，分别提取后合并
 * 3. Prompt 工程：多层次 prompt 设计，确保输出质量
 */

// ============================================================
// 常量定义
// ============================================================

/** 单次 AI 调用的最大输入字符数（约 6000 字，留余量给 prompt 模板） */
const MAX_INPUT_CHARS = 6000;

/** 口语填充词正则 */
const FILLER_WORDS_PATTERN = /(?:^|\s)(嗯|啊|那个|就是说|然后呢|对对对|是的是的|OK|okay|好的好的|哈哈|呵呵|额|哦|噢|emmm|emm|em)(?:\s|$|[，。,.])/g;

/** 时间戳正则（匹配 [00:01:23] 或 00:01:23 格式） */
const TIMESTAMP_PATTERN = /\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/g;

/** 重复标点正则 */
const REPEATED_PUNCTUATION_PATTERN = /([，。！？,\.!?])\1+/g;

/**
 * 钉钉 A1 / 闪记结构化段落标识符
 * 用于识别 AI 自动生成的高价值摘要段落
 */
const A1_SECTION_MARKERS = [
  // Emoji 标识格式
  { pattern: /(?:📋|📝)\s*(?:会议摘要|会议总结|摘要|总结|Summary)/i, type: 'summary' },
  { pattern: /(?:✅|☑️)\s*(?:待办事项|行动项|待办|Action Items?|TODO)/i, type: 'action_items' },
  { pattern: /(?:📌|🔑|💡)\s*(?:决策结论|关键决策|决策|结论|Key Decisions?|Decisions?)/i, type: 'decisions' },
  { pattern: /(?:📊|📈)\s*(?:讨论要点|关键讨论|要点|Key Points?|Discussion Points?)/i, type: 'key_points' },
  { pattern: /(?:⏭️|👉)\s*(?:后续跟进|下一步|Next Steps?|Follow[- ]?ups?)/i, type: 'next_steps' },
  // 纯文本标识格式（无 Emoji）
  { pattern: /^(?:【|〖|\[)?\s*(?:会议摘要|会议总结|摘要总结)\s*(?:】|〗|\])?$/m, type: 'summary' },
  { pattern: /^(?:【|〖|\[)?\s*(?:待办事项|行动项|Action Items?)\s*(?:】|〗|\])?$/m, type: 'action_items' },
  { pattern: /^(?:【|〖|\[)?\s*(?:决策结论|关键决策|决策事项)\s*(?:】|〗|\])?$/m, type: 'decisions' },
  { pattern: /^(?:【|〖|\[)?\s*(?:讨论要点|关键讨论)\s*(?:】|〗|\])?$/m, type: 'key_points' },
  { pattern: /^(?:【|〖|\[)?\s*(?:后续跟进|下一步计划)\s*(?:】|〗|\])?$/m, type: 'next_steps' },
];

/**
 * 会议元信息提取正则
 * 用于从闪记头部提取会议标题、参会人、时间、时长等结构化信息
 */
const MEETING_META_PATTERNS = {
  title: /(?:会议(?:主题|标题|名称)|Meeting\s*(?:Title|Topic))[：:]\s*(.+)/i,
  date: /(?:会议(?:时间|日期)|日期|时间|Date|Time)[：:]\s*(.+)/i,
  duration: /(?:会议时长|时长|Duration)[：:]\s*(.+)/i,
  participants: /(?:参会人(?:员)?|与会人(?:员)?|参与者|出席|Participants?|Attendees?)[：:]\s*(.+)/i,
  organizer: /(?:主持人|组织者|发起人|Organizer|Host)[：:]\s*(.+)/i,
  location: /(?:会议(?:地点|位置)|地点|Location)[：:]\s*(.+)/i,
};

// ============================================================
// 预处理模块
// ============================================================

/**
 * 预处理闪记原文，清洗噪音数据
 *
 * @param {string} rawText - 闪记原始文本
 * @returns {string} 清洗后的文本
 */
function preprocessFlashNote(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('闪记内容不能为空');
  }

  let cleaned = rawText;

  // Step 1: 去除时间戳
  cleaned = cleaned.replace(TIMESTAMP_PATTERN, '');

  // Step 2: 去除口语填充词
  cleaned = cleaned.replace(FILLER_WORDS_PATTERN, ' ');

  // Step 3: 合并连续空行为单个换行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Step 4: 去除重复标点
  cleaned = cleaned.replace(REPEATED_PUNCTUATION_PATTERN, '$1');

  // Step 5: 合并同一发言人的连续发言
  cleaned = mergeContinuousSpeech(cleaned);

  // Step 6: 去除首尾空白
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * 合并同一发言人的连续发言段落
 *
 * 闪记中经常出现同一人被拆成多段的情况：
 *   张三：我觉得这个功能
 *   张三：应该加上审批流程
 * 合并为：
 *   张三：我觉得这个功能，应该加上审批流程
 *
 * @param {string} text - 待处理文本
 * @returns {string} 合并后的文本
 */
function mergeContinuousSpeech(text) {
  const lines = text.split('\n');
  const mergedLines = [];
  let previousSpeaker = null;
  let currentContent = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      if (currentContent) {
        mergedLines.push(currentContent);
        currentContent = '';
        previousSpeaker = null;
      }
      mergedLines.push('');
      continue;
    }

    // 匹配发言人格式：「张三：」「张三(产品经理)：」「Speaker 1:」
    const speakerMatch = trimmedLine.match(/^([^：:]{1,20})[：:]\s*(.*)/);

    if (speakerMatch) {
      const speaker = speakerMatch[1].trim();
      const content = speakerMatch[2].trim();

      if (speaker === previousSpeaker && currentContent) {
        // 同一发言人，合并内容
        currentContent += '，' + content;
      } else {
        // 不同发言人，保存上一段，开始新段
        if (currentContent) {
          mergedLines.push(currentContent);
        }
        currentContent = trimmedLine;
        previousSpeaker = speaker;
      }
    } else {
      // 非发言人格式的行，直接追加
      if (currentContent) {
        currentContent += '，' + trimmedLine;
      } else {
        mergedLines.push(trimmedLine);
      }
    }
  }

  if (currentContent) {
    mergedLines.push(currentContent);
  }

  return mergedLines.join('\n');
}

// ============================================================
// 会议识别模块（Issue #126: 新增会议识别能力）
// ============================================================

/**
 * 从闪记文本头部提取会议元信息
 *
 * 钉钉 A1 / 闪记通常在文本开头包含结构化的会议元信息，如：
 *   会议主题：产品需求评审会
 *   会议时间：2026-03-24 14:00
 *   参会人员：张三、李四、王五
 *   会议时长：45 分钟
 *
 * @param {string} text - 预处理后的闪记文本
 * @returns {{ meta: object, bodyText: string }}
 *   - meta: 提取到的元信息对象
 *   - bodyText: 去除元信息头部后的正文文本
 */
function extractMeetingMeta(text) {
  const meta = {};
  const lines = text.split('\n');
  let metaEndIndex = 0;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    if (!line) {
      if (metaEndIndex > 0) break;
      continue;
    }

    let matched = false;
    for (const [key, pattern] of Object.entries(MEETING_META_PATTERNS)) {
      const match = line.match(pattern);
      if (match) {
        meta[key] = match[1].trim();
        matched = true;
        metaEndIndex = i + 1;
        break;
      }
    }

    if (!matched && metaEndIndex > 0) {
      break;
    }
  }

  // 对参会人进行结构化解析（拆分为数组）
  if (meta.participants) {
    meta.participantList = meta.participants
      .split(/[，,、；;／/\s]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0 && name.length < 30);
  }

  const bodyText = metaEndIndex > 0
    ? lines.slice(metaEndIndex).join('\n').trim()
    : text;

  return { meta, bodyText };
}

/**
 * 从闪记文本中提取钉钉 A1 生成的结构化摘要段落
 *
 * 钉钉 A1 会在闪记中自动生成带有特定标识的结构化段落，如：
 *   📋 会议摘要
 *   本次会议讨论了...
 *
 *   ✅ 待办事项
 *   - @张三 完成需求文档
 *   - @李四 确认技术方案
 *
 *   📌 决策结论
 *   1. 采用方案 A
 *   2. 上线时间定为下周五
 *
 * 这些段落是高价值信息，应优先提取并注入 Prompt。
 *
 * @param {string} text - 闪记文本
 * @returns {{ sections: Array<{ type: string, title: string, content: string }>, remainingText: string }}
 *   - sections: 提取到的 A1 结构化段落
 *   - remainingText: 去除 A1 段落后的原始对话文本
 */
function extractA1Summary(text) {
  const sections = [];
  const lines = text.split('\n');
  const usedLineRanges = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const marker of A1_SECTION_MARKERS) {
      if (marker.pattern.test(line)) {
        const sectionTitle = line;
        const contentLines = [];
        let endIndex = i + 1;

        // 收集该段落下的所有内容行，直到遇到下一个段落标识或连续空行
        let consecutiveEmptyLines = 0;
        for (let j = i + 1; j < lines.length; j++) {
          const contentLine = lines[j];
          if (contentLine.trim() === '') {
            consecutiveEmptyLines++;
            if (consecutiveEmptyLines >= 2) break;
            contentLines.push('');
            endIndex = j + 1;
            continue;
          }
          consecutiveEmptyLines = 0;

          // 检查是否遇到了下一个 A1 段落标识
          let isNextSection = false;
          for (const nextMarker of A1_SECTION_MARKERS) {
            if (nextMarker.pattern.test(contentLine.trim())) {
              isNextSection = true;
              break;
            }
          }
          if (isNextSection) break;

          contentLines.push(contentLine);
          endIndex = j + 1;
        }

        const content = contentLines.join('\n').trim();
        if (content) {
          sections.push({
            type: marker.type,
            title: sectionTitle.replace(/^[📋📝✅☑️📌🔑💡📊📈⏭️👉]\s*/, '').trim(),
            content: content,
          });
          usedLineRanges.push([i, endIndex]);
        }
        break;
      }
    }
  }

  // 构建去除 A1 段落后的剩余文本
  const remainingLines = [];
  for (let i = 0; i < lines.length; i++) {
    const isUsed = usedLineRanges.some(([start, end]) => i >= start && i < end);
    if (!isUsed) {
      remainingLines.push(lines[i]);
    }
  }
  const remainingText = remainingLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return { sections, remainingText };
}

/**
 * 从闪记文本中识别发言人及其角色标注
 *
 * 闪记中的发言人可能带有角色标注，如：
 *   张三(产品经理)：我们需要...
 *   李四（技术负责人）：从技术角度看...
 *   王五[设计师]：UI 方面建议...
 *
 * @param {string} text - 闪记文本
 * @returns {Array<{ name: string, role: string|null }>} 发言人列表
 */
function extractSpeakers(text) {
  const speakerPattern = /^([^：:]{1,10})(?:\(([^)]+)\)|（([^）]+)）|\[([^\]]+)\])?\s*[：:]/gm;
  const speakerMap = new Map();
  let match;

  while ((match = speakerPattern.exec(text)) !== null) {
    const name = match[1].trim();
    const role = (match[2] || match[3] || match[4] || '').trim() || null;

    if (!speakerMap.has(name)) {
      speakerMap.set(name, role);
    } else if (role && !speakerMap.get(name)) {
      speakerMap.set(name, role);
    }
  }

  return Array.from(speakerMap.entries()).map(([name, role]) => ({ name, role }));
}

/**
 * 构建会议上下文信息文本，注入到 Prompt 中
 *
 * 将提取到的会议元信息、A1 摘要、发言人信息组装为结构化的上下文文本，
 * 放在 Prompt 的内容输入层之前，帮助 AI 更好地理解会议背景。
 *
 * @param {object} meetingMeta - extractMeetingMeta 返回的 meta 对象
 * @param {Array} a1Sections - extractA1Summary 返回的 sections 数组
 * @param {Array} speakers - extractSpeakers 返回的发言人列表
 * @returns {string} 格式化的会议上下文文本
 */
function buildMeetingContext(meetingMeta, a1Sections, speakers) {
  const contextParts = [];

  // 会议元信息
  if (Object.keys(meetingMeta).length > 0) {
    const metaLines = ['## 会议基本信息'];
    if (meetingMeta.title) metaLines.push(`- 会议主题：${meetingMeta.title}`);
    if (meetingMeta.date) metaLines.push(`- 会议时间：${meetingMeta.date}`);
    if (meetingMeta.duration) metaLines.push(`- 会议时长：${meetingMeta.duration}`);
    if (meetingMeta.organizer) metaLines.push(`- 主持人：${meetingMeta.organizer}`);
    if (meetingMeta.participants) metaLines.push(`- 参会人员：${meetingMeta.participants}`);
    if (meetingMeta.location) metaLines.push(`- 会议地点：${meetingMeta.location}`);
    contextParts.push(metaLines.join('\n'));
  }

  // 发言人角色信息
  const speakersWithRoles = speakers.filter(speaker => speaker.role);
  if (speakersWithRoles.length > 0) {
    const roleLines = ['## 发言人角色'];
    for (const speaker of speakersWithRoles) {
      roleLines.push(`- ${speaker.name}：${speaker.role}`);
    }
    contextParts.push(roleLines.join('\n'));
  }

  // A1 结构化摘要（高优先级信息）
  if (a1Sections.length > 0) {
    const sectionTypeLabels = {
      summary: '会议摘要',
      action_items: '待办事项',
      decisions: '决策结论',
      key_points: '讨论要点',
      next_steps: '后续跟进',
    };

    const a1Lines = ['## AI 自动生成的会议摘要（高优先级信息，请重点参考）'];
    for (const section of a1Sections) {
      const label = sectionTypeLabels[section.type] || section.title;
      a1Lines.push(`\n### ${label}`);
      a1Lines.push(section.content);
    }
    contextParts.push(a1Lines.join('\n'));
  }

  return contextParts.join('\n\n');
}

// ============================================================
// 分段模块
// ============================================================

/**
 * 将超长闪记文本按发言人/段落边界智能分段
 *
 * @param {string} text - 预处理后的闪记文本
 * @param {number} maxCharsPerSegment - 每段最大字符数
 * @returns {string[]} 分段后的文本数组
 */
function splitIntoSegments(text, maxCharsPerSegment = MAX_INPUT_CHARS) {
  if (text.length <= maxCharsPerSegment) {
    return [text];
  }

  const paragraphs = text.split(/\n\n+/);
  const segments = [];
  let currentSegment = '';

  for (const paragraph of paragraphs) {
    if (currentSegment.length + paragraph.length + 2 > maxCharsPerSegment) {
      if (currentSegment) {
        segments.push(currentSegment.trim());
      }
      // 如果单个段落就超长，按行拆分
      if (paragraph.length > maxCharsPerSegment) {
        const subSegments = splitLongParagraph(paragraph, maxCharsPerSegment);
        segments.push(...subSegments);
        currentSegment = '';
      } else {
        currentSegment = paragraph;
      }
    } else {
      currentSegment += (currentSegment ? '\n\n' : '') + paragraph;
    }
  }

  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments;
}

/**
 * 将超长段落按行边界拆分
 *
 * @param {string} paragraph - 超长段落
 * @param {number} maxChars - 最大字符数
 * @returns {string[]} 拆分后的子段落
 */
function splitLongParagraph(paragraph, maxChars) {
  const lines = paragraph.split('\n');
  const subSegments = [];
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxChars) {
      if (currentChunk) {
        subSegments.push(currentChunk.trim());
      }
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk.trim()) {
    subSegments.push(currentChunk.trim());
  }

  return subSegments;
}

// ============================================================
// Prompt 构建模块（核心）
// ============================================================

/**
 * 构建完整的闪记转 PRD prompt
 *
 * 采用三层 prompt 架构：
 * 1. 系统角色层：定义 AI 的角色和能力边界
 * 2. 任务指令层：明确输出格式、质量要求、评判标准
 * 3. 内容输入层：预处理后的闪记文本
 *
 * @param {string} flashNoteContent - 预处理后的闪记内容
 * @param {object} options - 可选配置
 * @param {string} options.projectName - 项目名称（可选，AI 自动提取）
 * @param {string} options.industry - 行业领域（可选，帮助 AI 理解上下文）
 * @param {number} options.segmentIndex - 当前分段索引（分段模式下使用）
 * @param {number} options.totalSegments - 总分段数（分段模式下使用）
 * @returns {string} 构建好的 prompt
 */
function buildFlashNoteToPrdPrompt(flashNoteContent, options = {}) {
  const { projectName, industry, segmentIndex, totalSegments, meetingContext } = options;

  const isSegmented = totalSegments && totalSegments > 1;

  // ---- 系统角色层 ----
  const systemRole = `你是一名拥有 10 年经验的资深产品经理，同时精通宜搭低代码平台。你擅长：
- 从非结构化的会议讨论中精准提取产品需求
- 将模糊的口语化描述转化为清晰的功能规格
- 识别隐含需求和潜在风险
- 设计合理的数据模型和字段结构
- 区分"讨论过程"和"最终决策"
- 识别和利用 AI 自动生成的会议摘要、待办事项、决策结论等结构化信息`;

  // ---- 任务指令层 ----
  let taskInstruction;

  if (isSegmented) {
    taskInstruction = buildSegmentedTaskInstruction(segmentIndex, totalSegments);
  } else {
    taskInstruction = buildFullTaskInstruction(projectName, industry);
  }

  // ---- 组装完整 prompt ----
  const promptParts = [
    systemRole,
    '',
    taskInstruction,
    '',
  ];

  // 注入会议上下文信息（元信息 + A1 摘要 + 发言人角色）
  if (meetingContext) {
    promptParts.push(
      '---',
      '以下是从闪记中自动提取的会议结构化信息（请优先参考这些信息）：',
      '---',
      '',
      meetingContext,
      '',
    );
  }

  promptParts.push(
    '---',
    '以下是钉钉闪记（会议录音自动转写）的原始对话内容：',
    '---',
    '',
    flashNoteContent,
    '',
    '---',
    '请严格按照上述要求输出结构化 PRD 文档。',
  );

  return promptParts.join('\n');
}

/**
 * 构建完整模式的任务指令（单段或短文本）
 *
 * @param {string} projectName - 项目名称
 * @param {string} industry - 行业领域
 * @returns {string} 任务指令文本
 */
function buildFullTaskInstruction(projectName, industry) {
  const projectHint = projectName ? `项目名称为「${projectName}」。` : '';
  const industryHint = industry ? `该项目属于「${industry}」行业。` : '';

  return `## 任务

请分析以下钉钉闪记内容，从中提取产品需求，生成一份高质量的结构化 PRD（产品需求文档）。${projectHint}${industryHint}

## 分析要求

### 内容提取规则
1. **识别决策结论**：只提取最终达成共识的结论，忽略讨论过程中的争论和被否决的方案
2. **忽略无关内容**：跳过寒暄、闲聊、重复表述、口语化废话（如"我觉得吧"、"怎么说呢"）
3. **提取隐含需求**：从讨论上下文中推断未被明确说出但逻辑上必需的功能（如提到"审批"则隐含需要审批流程配置）
4. **保留数据约束**：精确记录讨论中提到的数字、规则、条件（如"积分有效期 1 年"、"单次最多报销 5000 元"）
5. **区分角色视角**：不同发言人可能代表不同角色（产品、技术、业务），注意区分并标注

### 字段设计规则
字段类型必须使用宜搭平台支持的标准类型：
| 宜搭字段类型 | 适用场景 |
|-------------|---------|
| TextField | 短文本（姓名、标题等） |
| TextareaField | 长文本（描述、备注等） |
| NumberField | 数字（金额、数量、积分等） |
| SelectField | 单选下拉（状态、类别等），需列出选项值 |
| MultiSelectField | 多选（标签、多选类别等） |
| DateField | 日期（提交时间、截止日期等） |
| EmployeeField | 人员选择（提交人、审批人等） |
| DepartmentSelectField | 部门选择 |
| AttachmentField | 附件上传（文件、图片等） |
| RadioField | 单选按钮（是/否、性别等少量选项） |
| CheckboxField | 复选框 |
| CascadeSelectField | 级联选择（省市区等） |
| TableField | 子表单/明细（订单明细、费用明细等） |

### 质量标准
- 每个功能模块必须包含：功能描述、业务规则、字段设计表
- 字段设计表必须包含：字段名、类型、必填、说明
- 流程设计必须明确：发起人、审批节点、通过/拒绝后的动作
- 待确认事项必须列出：闪记中未明确或存在分歧的内容

## 输出格式

严格按照以下 Markdown 结构输出，不要遗漏任何章节：

\`\`\`
# <项目名称> — 产品需求文档

## 项目背景
<!-- 2-3 句话概括项目来源、业务场景、核心痛点 -->

## 需求概述
<!-- 一句话描述核心需求和预期价值 -->

## 目标用户
<!-- 表格形式列出角色和说明 -->
| 角色 | 说明 |
|------|------|

## 功能需求

### 功能模块 1：<模块名>
- **功能描述**：...
- **业务规则**：
  - 规则 1
  - 规则 2
- **字段设计**：
  | 字段名 | 类型 | 必填 | 说明 |
  |--------|------|------|------|

### 功能模块 2：<模块名>
<!-- 同上结构，按需添加更多模块 -->

## 流程设计
<!-- 如果闪记中讨论了审批/业务流程，用流程图文字描述 -->
<!-- 明确：发起人、每个审批节点、通过/拒绝后的动作 -->

## 数据报表
<!-- 如果闪记中提到了统计、报表、数据分析需求 -->
| 报表名称 | 数据来源 | 展示方式 | 说明 |
|---------|---------|---------|------|

## 非功能需求
<!-- 性能、权限、安全、通知、集成等非功能性要求 -->

## 待确认事项
<!-- 表格形式列出需要用户进一步确认的内容 -->
| 序号 | 待确认内容 | 说明 |
|------|----------|------|
\`\`\``;
}

/**
 * 构建分段模式的任务指令
 *
 * @param {number} segmentIndex - 当前段索引（从 1 开始）
 * @param {number} totalSegments - 总段数
 * @returns {string} 分段任务指令
 */
function buildSegmentedTaskInstruction(segmentIndex, totalSegments) {
  if (segmentIndex === 1) {
    return `## 任务（分段处理 ${segmentIndex}/${totalSegments}）

这是一段较长的钉钉闪记内容，已被分为 ${totalSegments} 段处理。当前是第 ${segmentIndex} 段。

请从以下闪记片段中提取所有产品需求相关的信息，以 JSON 格式输出：

\`\`\`json
{
  "projectName": "从内容中推断的项目名称",
  "background": "项目背景描述",
  "users": [{"role": "角色名", "description": "说明"}],
  "features": [
    {
      "moduleName": "模块名",
      "description": "功能描述",
      "rules": ["业务规则1", "业务规则2"],
      "fields": [
        {"name": "字段名", "type": "宜搭字段类型", "required": true, "description": "说明"}
      ]
    }
  ],
  "processes": [{"name": "流程名", "steps": "流程描述"}],
  "reports": [{"name": "报表名", "source": "数据来源", "chartType": "图表类型", "description": "说明"}],
  "nonFunctional": ["非功能需求1"],
  "unconfirmed": [{"content": "待确认内容", "description": "说明"}]
}
\`\`\`

注意：
- 只提取本段中出现的信息，不要编造
- 忽略寒暄、闲聊、重复内容
- 识别决策结论，忽略讨论过程`;
  }

  if (segmentIndex === totalSegments) {
    return `## 任务（分段处理 ${segmentIndex}/${totalSegments} — 最后一段）

这是闪记的最后一段。请提取本段中的需求信息，同样以 JSON 格式输出（结构同前）。

提取完成后，这些分段结果将被合并生成完整的 PRD 文档。`;
  }

  return `## 任务（分段处理 ${segmentIndex}/${totalSegments}）

这是闪记的第 ${segmentIndex} 段（共 ${totalSegments} 段）。请继续提取本段中的需求信息，以 JSON 格式输出（结构同前）。

注意：如果本段内容与前面段落有重叠，请去重。`;
}

/**
 * 构建分段结果合并的 prompt
 *
 * 将多段提取的 JSON 结果合并为最终 PRD
 *
 * @param {string[]} segmentResults - 各段提取的 JSON 结果
 * @param {string} projectName - 项目名称
 * @returns {string} 合并 prompt
 */
function buildMergePrompt(segmentResults, projectName) {
  const projectHint = projectName ? `项目名称为「${projectName}」。` : '';

  return `你是一名资深产品经理。以下是从一段较长的钉钉闪记中分段提取的需求信息（JSON 格式）。${projectHint}

请将这些分段结果合并、去重、整理，生成一份完整的高质量 PRD 文档。

## 合并规则
1. 相同功能模块的信息合并到一起
2. 重复的字段、规则去重
3. 冲突的信息以后面段落的为准（代表更新的讨论结论）
4. 补充遗漏的关联信息（如提到审批但未设计审批流程，需补充）

## 分段提取结果

${segmentResults.map((result, index) => `### 第 ${index + 1} 段\n\`\`\`json\n${result}\n\`\`\``).join('\n\n')}

## 输出要求

请按照标准 PRD 格式输出完整的 Markdown 文档，结构如下：
- # 项目名称 — 产品需求文档
- ## 项目背景
- ## 需求概述
- ## 目标用户（表格）
- ## 功能需求（每个模块含功能描述、业务规则、字段设计表）
- ## 流程设计
- ## 数据报表（表格）
- ## 非功能需求
- ## 待确认事项（表格）`;
}

// ============================================================
// 主流程编排
// ============================================================

/**
 * 闪记转 PRD 主流程
 *
 * @param {string} rawFlashNote - 闪记原始文本
 * @param {object} options - 配置选项
 * @param {string} options.projectName - 项目名称
 * @param {string} options.industry - 行业领域
 * @param {function} options.callAI - AI 调用函数 (prompt) => Promise<string>
 * @returns {Promise<string>} 生成的 PRD Markdown 内容
 */
async function flashNoteToPrd(rawFlashNote, options = {}) {
  const { projectName, industry, callAI } = options;

  if (!callAI || typeof callAI !== 'function') {
    throw new Error('必须提供 callAI 函数用于调用 AI 接口');
  }

  // Step 1: 预处理
  const cleanedText = preprocessFlashNote(rawFlashNote);
  console.log(`[闪记转PRD] 预处理完成，原文 ${rawFlashNote.length} 字 → 清洗后 ${cleanedText.length} 字`);

  // Step 2: 会议识别 — 提取元信息、A1 摘要、发言人角色
  const { meta: meetingMeta, bodyText: metaStrippedText } = extractMeetingMeta(cleanedText);
  const { sections: a1Sections, remainingText: dialogueText } = extractA1Summary(metaStrippedText);
  const speakers = extractSpeakers(cleanedText);

  const metaCount = Object.keys(meetingMeta).length;
  const a1Count = a1Sections.length;
  const speakerCount = speakers.length;
  console.log(`[闪记转PRD] 会议识别完成：元信息 ${metaCount} 项，A1 摘要 ${a1Count} 段，发言人 ${speakerCount} 位`);

  // 构建会议上下文（注入 Prompt）
  const meetingContext = buildMeetingContext(meetingMeta, a1Sections, speakers);

  // 使用去除 A1 摘要后的对话文本作为主要输入（A1 摘要已通过 meetingContext 注入）
  const mainText = dialogueText || cleanedText;

  // Step 3: 判断是否需要分段
  const segments = splitIntoSegments(mainText);
  console.log(`[闪记转PRD] 分段结果：共 ${segments.length} 段`);

  // Step 4: 单段模式 — 直接生成 PRD
  if (segments.length === 1) {
    const prompt = buildFlashNoteToPrdPrompt(mainText, {
      projectName,
      industry,
      meetingContext: meetingContext || undefined,
    });
    console.log(`[闪记转PRD] 单段模式，prompt 长度：${prompt.length} 字`);
    const prdContent = await callAI(prompt);
    return prdContent;
  }

  // Step 5: 多段模式 — 分段提取 + 合并
  console.log(`[闪记转PRD] 多段模式，开始分段提取...`);
  const segmentResults = [];

  for (let index = 0; index < segments.length; index++) {
    const segmentPrompt = buildFlashNoteToPrdPrompt(segments[index], {
      projectName,
      industry,
      segmentIndex: index + 1,
      totalSegments: segments.length,
      meetingContext: index === 0 ? (meetingContext || undefined) : undefined,
    });
    console.log(`[闪记转PRD] 提取第 ${index + 1}/${segments.length} 段，prompt 长度：${segmentPrompt.length} 字`);
    const result = await callAI(segmentPrompt);
    segmentResults.push(result);
  }

  // Step 6: 合并分段结果
  console.log('[闪记转PRD] 分段提取完成，开始合并...');
  const mergePrompt = buildMergePrompt(segmentResults, projectName);
  const finalPrd = await callAI(mergePrompt);

  return finalPrd;
}

// ============================================================
// 宜搭平台调用适配
// ============================================================

/**
 * 在宜搭自定义页面中调用 AI 接口的适配函数
 *
 * @param {string} prompt - 构建好的 prompt
 * @param {number} maxTokens - 最大输出 token 数
 * @returns {Promise<string>} AI 返回的文本内容
 */
function createYidaAICaller(maxTokens = 8000) {
  return async function callYidaAI(prompt) {
    const response = await fetch('/query/intelligent/txtFromAI.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf_token: window.g_config._csrf_token,
        prompt: prompt,
        maxTokens: String(maxTokens),
        skill: 'ToText',
      }).toString(),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(`AI 接口调用失败: ${data.errorMsg || '未知错误'}`);
    }

    return data.content.content;
  };
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  preprocessFlashNote,
  mergeContinuousSpeech,
  splitIntoSegments,
  extractMeetingMeta,
  extractA1Summary,
  extractSpeakers,
  buildMeetingContext,
  buildFlashNoteToPrdPrompt,
  buildMergePrompt,
  flashNoteToPrd,
  createYidaAICaller,
};
