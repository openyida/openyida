/**
 * types/index.ts - 项目核心类型定义
 *
 * 包含所有模块共享的接口和类型。
 */

// ── Cookie / 认证相关 ─────────────────────────────────

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

export interface CookieData {
  cookies: Cookie[];
  base_url: string;
  csrf_token?: string;
  corp_id?: string;
  user_id?: string;
}

export interface LoginResult {
  csrf_token: string;
  corp_id: string | null;
  user_id: string | null;
  base_url: string;
  cookies: Cookie[];
}

export interface AuthRef {
  csrfToken: string;
  cookies: Cookie[];
  baseUrl: string;
  cookieData: CookieData;
}

export interface CookieExtractResult {
  csrfToken: string | null;
  corpId: string | null;
  userId: string | null;
}

// ── AI 工具环境检测 ───────────────────────────────────

export interface ActiveTool {
  tool: string;
  displayName: string;
  dirName: string;
  workspaceRoot: string;
}

export interface EnvironmentResult {
  displayName: string;
  dirName: string;
  isActive: boolean;
  hasProject: boolean;
  workspaceRoot: string;
}

export interface DetectEnvironmentResult {
  activeToolName: string | null;
  activeProjectRoot: string | null;
  results: EnvironmentResult[];
}

export interface LoginStatus {
  loggedIn: boolean;
  csrfToken: string | null;
  corpId: string | null;
  userId: string | null;
  baseUrl: string | null;
}

// ── 宜搭 API 响应 ─────────────────────────────────────

export interface YidaApiResponse<T = unknown> {
  success: boolean;
  result?: T;
  content?: T;
  errorCode?: string;
  errorMsg?: string;
  /** 内部标记：需要重新登录 */
  __needLogin?: boolean;
  /** 内部标记：csrf_token 已过期 */
  __csrfExpired?: boolean;
}

// ── CLI 命令 ──────────────────────────────────────────

export type CliArgs = string[];

export interface CommandModule {
  run: (args: CliArgs) => Promise<void> | void;
}

// ── 版本检查 ──────────────────────────────────────────

export interface CheckLoginResult {
  status: 'ok' | 'not_logged_in';
  can_auto_use: boolean;
  csrf_token?: string;
  corp_id?: string | null;
  user_id?: string | null;
  base_url?: string;
  cookies?: Cookie[];
  message: string;
}

// ── 闪记转 PRD ────────────────────────────────────────

export interface FlashToPrdParsedArgs {
  file: string | null;
  name: string | null;
  maxTokens: number;
}

export interface FlashToPrdResult {
  success: boolean;
  projectName: string;
  prdFile: string;
  contentLength: number;
  meetingRecognition: {
    metaFields: number;
    a1Sections: number;
    speakers: number;
  };
}

/** build-flash-note-prompt.js 模块的类型声明 */
export interface PromptBuilderModule {
  preprocessFlashNote: (rawText: string) => string;
  extractMeetingMeta: (text: string) => { meta: Record<string, string>; bodyText: string };
  extractA1Summary: (text: string) => { sections: Array<{ title: string; content: string }>; remainingText: string };
  extractSpeakers: (text: string) => Array<{ name: string; role: string | null }>;
  buildMeetingContext: (
    meta: Record<string, string>,
    sections: Array<{ title: string; content: string }>,
    speakers: Array<{ name: string; role: string | null }>
  ) => string;
  splitIntoSegments: (text: string) => string[];
  buildFlashNoteToPrdPrompt: (content: string, options?: Record<string, unknown>) => string;
  buildMergePrompt: (segmentResults: string[], projectName?: string | null) => string;
}
