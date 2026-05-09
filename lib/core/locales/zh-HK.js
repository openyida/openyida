/**
 * zh-HK.js - 繁體中文翻譯（香港）
 */
'use strict';

module.exports = {
  // ── 通用 ──────────────────────────────────────────

  // ── bin/yida.js printHelp() ────────────────────────
  help: {
    subtitle: '宜搭低程式碼 AI 開發工具',
    usage: '用法:',
    alias: '別名:',
    group_auth: '環境 & 認證',
    cmd_login: '登入（優先緩存，--qr 或 --codex 瀏覽器登入）',
    cmd_logout: '登出 / 切換帳戶',
    cmd_auth: '登入態管理',
    cmd_org: '組織管理（列出 / 切換）',
    cmd_env: '偵測 AI 工具環境和登入態',
    cmd_env_management: '管理公有雲 / 私有化環境',
    group_app: '應用程式管理',
    cmd_app_list: '查詢我的應用程式清單',
    cmd_create_app: '建立宜搭應用程式',
    cmd_update_app: '更新應用程式資料',
    cmd_export: '匯出應用程式（產生遷移包）',
    cmd_import: '匯入遷移包，重建應用程式',
    group_form: '表單 & 頁面',
    cmd_create_form: '建立表單頁面',
    cmd_update_form: '更新表單頁面',
    cmd_list_forms: '列出應用程式下的表單/頁面',
    cmd_get_schema: '取得表單 Schema',
    cmd_create_page: '建立自訂展示頁面',
    cmd_generate_page: '基於高質素模板生成頁面',
    cmd_check_page: '檢查自定義頁面規範',
    cmd_compile: '本機編譯自訂頁面',
    cmd_publish: '編譯並發布自訂頁面',
    cmd_update_form_config: '更新表單設定',
    group_data: '資料 & 權限',
    cmd_data: '統一資料管理（表單/流程/任務/子表單）',
    cmd_task_center: '全域任務中心（待辦/已處理/抄送等）',
    cmd_get_permission: '查詢表單權限設定',
    cmd_save_permission: '儲存表單權限設定',
    group_process: '流程',
    cmd_configure_process: '設定並發布流程規則',
    cmd_create_process: '建立流程表單（一體化）',
    cmd_process_preview: '預覽流程實例（視覺化流程圖）',
    group_share: '頁面設定 & 分享',
    cmd_verify_url: '驗證短連結 URL',
    cmd_save_share: '儲存公開訪問 / 分享設定',
    cmd_get_page_config: '查詢頁面公開訪問設定',
    group_report: '報表',
    cmd_create_report: '建立宜搭報表',
    cmd_append_chart: '向已有報表追加圖表',
    group_connector: '連接器',
    cmd_connector_list: '列出 HTTP 連接器',
    cmd_connector_create: '建立連接器',
    cmd_connector_detail: '查看連接器詳情',
    cmd_connector_delete: '刪除連接器',
    cmd_connector_add_action: '新增執行動作',
    cmd_connector_list_actions: '列出執行動作',
    cmd_connector_delete_action: '刪除執行動作',
    cmd_connector_test: '測試執行動作',
    cmd_connector_list_connections: '列出認證帳戶',
    cmd_connector_create_connection: '建立認證帳戶',
    cmd_connector_smart: '智慧建立連接器（從 cURL）',
    cmd_connector_parse_api: '解析 API 資料',
    cmd_connector_gen_template: '產生 API 文件模板',
    cmd_connector_more: '查看更多子命令',
    group_integration: '整合 & 釘釘',
    cmd_integration: '建立整合自動化邏輯流',
    cmd_dws: '釘釘 CLI（通訊錄/日曆/待辦/審批等）',
    group_utility: '工具',
    cmd_commands: '輸出機器可讀命令清單',
    cmd_copy: '複製 project 工作目錄',
    cmd_sample: '輸出程式碼範例/模板',
    cmd_doctor: '環境診斷與自動修復',
    cmd_update: '檢查並更新到最新版本',
    cmd_export_conversation: '匯出 AI 對話記錄',
    cmd_flash_to_prd: '閃記 / 會議紀要轉 PRD prompt',
    cmd_cdn: 'CDN 圖片管理（設定/上傳/刷新）',
    cmd_cdn_config: '設定 CDN / OSS 上傳',
    cmd_cdn_upload: '上傳圖片到 CDN',
    cmd_cdn_refresh: '刷新 CDN 緩存',
    quickstart_title: '快速上手',
    quickstart_app_name: '考勤管理',
    quickstart_form_name: '員工資料',
    docs: '📚 文件:',
  },

  // ── bin/yida.js ────────────────────────────────────
  cli: {
    help: `
openyida - 宜搭命令列工具

用法：
  openyida <指令> [參數...]（別名：yida）

指令：
  env                                                          偵測目前 AI 工具環境和登入態
  copy [--force]                                               複製 project 工作目錄到目前 AI 工具環境
  login                                                        登入態管理（優先緩存，否則掃碼）
  logout                                                       登出 / 切換帳戶
  create-app "<名稱>" [描述] [圖示] [顏色] [主題色] [導航風格] [佈局]  建立應用程式，輸出 appType
  create-page <appType> "<頁面名>" [--mode dashboard]          建立自訂頁面，輸出 pageId
  create-form create <appType> "<表單名>" <欄位JSON> [--layout <佈局>] [--theme <主題>] [--label-align <對齊>]  建立表單頁面
  create-form update <appType> <formUuid> <修改JSON>           更新表單頁面
  get-schema <appType> <formUuid>                              取得表單 Schema
  publish <原始檔路徑> <appType> <formUuid> [--health-check]   編譯並發布自訂頁面
  verify-short-url <appType> <formUuid> <url>                  驗證短連結 URL 是否可用
  save-share-config <appType> <formUuid> <url> <isOpen> [auth] 儲存公開訪問/分享設定
  get-page-config <appType> <formUuid>                         查詢頁面公開訪問/分享設定
  update-form-config <appType> <formUuid> <isRenderNav> <title> 更新表單設定
  data <action> <resource> [args]                              統一資料管理（表單/流程/任務/子表單）
  task-center <type> [--page N] [--size N] [--keyword TEXT]   全域任務中心（待辦/我建立的/我已處理/副本/代提交）
  doctor [選項]                                                檢查環境依賴，診斷應用程式問題
    --fix / --repair                                           診斷並自動修復
    --production --app <appId>                                 正式應用程式診斷
    --monitor                                                  啟動即時健康度監控
    --report <format>                                          產生診斷報告（json | markdown | html）
    --create-ticket                                            根據診斷結果建立工單
    --create-voc                                               建立 VOC（需求反饋）
    --auto-submit                                              自動判斷並提交工單或 VOC
  auth status                                                  查看目前登入狀態
  auth login                                                   執行登入
  auth refresh                                                 刷新登入態
  auth logout                                                  登出
  org list                                                     列出可訪問的組織
  org switch --corp-id <corpId>                                切換組織（無需重新登入）
  export <appType> [output]                                    匯出應用程式所有表單 Schema（產生遷移包）
  import <file> [name]                                         匯入遷移包，在目標環境重建應用程式
  get-permission <appType> <formUuid>                          查詢表單權限設定
  save-permission <appType> <formUuid> [--data-permission <json>] [--action-permission <json>]  儲存表單權限設定
  configure-process <appType> <formUuid> <processDefinitionFile> [processCode]  設定並發布流程
  create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>  建立流程表單（一體化）
  create-process <appType> --formUuid <formUuid> <processDefinitionFile>         複用已有表單建立流程
  connector list [選項]                                        列出 HTTP 連接器
  connector create "名稱" "網域" --operations <file> [選項]    建立連接器
  connector detail <connector-id>                              查看連接器詳情
  connector delete <connector-id> [--force]                    刪除連接器
  connector add-action --operations <file> --connector-id <id> 新增執行動作到連接器
  connector list-actions <connector-id>                        列出執行動作
  connector delete-action <connector-id> <operation-id>        刪除執行動作
  connector test --connector-id <id> --action <actionId>       測試執行動作
  connector list-connections <connector-id>                    列出認證帳戶
  connector create-connection <connector-id> <name> [選項]     建立認證帳戶
  connector smart-create --curl "curl指令" [選項]              從 cURL 智慧建立連接器
  connector parse-api [選項]                                   解析 API 資料
  connector gen-template [輸出路徑]                             產生介面文件範本
  integration create <appType> <formUuid> <flowName> [選項]    建立整合&自動化邏輯流
  create-report <appType> "<報表名稱>" <圖表JSON|檔案路徑>     建立宜搭報表
  append-chart <appType> <reportId> <圖表JSON|檔案路徑>        向已有報表追加圖表
  dws <command> [args]                                         釘釘 CLI（通訊錄/日曆/待辦/審批等）
  export-conversation [選項]                                   匯出 AI 對話記錄
    --output, -o <path>                                        指定輸出檔案路徑
    --input, -i <file>                                         指定輸入對話檔案
    --latest                                                   只匯出最新對話（預設）
    --list                                                     列出可用的對話記錄
  cdn-config [選項]                                            設定 CDN 圖片上傳（阿里雲 OSS + CDN）
  cdn-upload <圖片路徑> [選項]                                  上傳圖片到 CDN
  cdn-refresh [選項]                                           刷新 CDN 緩存

範例：
  openyida login
  openyida logout
  openyida create-app "考勤管理"
  openyida create-app "考勤管理" "員工考勤系統" "xian-daka" "#00B853" "deepBlue" "dark" "slide"
  openyida create-page APP_XXX "遊戲主頁"
  openyida create-form create APP_XXX "員工資料" fields.json
  openyida create-form update APP_XXX FORM-XXX '[{"action":"add","field":{"type":"TextField","label":"備註"}}]'
  openyida get-schema APP_XXX FORM-XXX
  openyida publish pages/src/home.oyd.jsx APP_XXX FORM-XXX
  openyida verify-short-url APP_XXX FORM-XXX /o/myapp
  openyida save-share-config APP_XXX FORM-XXX /o/myapp y n
  openyida get-page-config APP_XXX FORM-XXX
  openyida update-form-config APP_XXX FORM-XXX false "頁面標題"
  openyida data query form APP_XXX FORM-XXX --page 1 --size 20
  openyida dws contact user search --keyword "悟空"
  openyida create-report APP_XXX "銷售報表" charts.json
  openyida append-chart APP_XXX REPORT-XXX charts.json
  openyida configure-process APP_XXX FORM-YYY process-def.json
  openyida create-process APP_XXX "訂單處理表" fields.json process-def.json
  openyida export APP_XXX
  openyida export APP_XXX ./my-app-backup.json
  openyida import ./yida-export.json
  openyida import ./yida-export.json "品質追溯系統（正式環境）"
  openyida doctor                                 完整診斷
  openyida doctor --fix                           診斷並自動修復
  openyida doctor --production --app APP_XXX      正式應用程式診斷
  openyida export-conversation                    匯出目前對話記錄
  openyida export-conversation -o output.md       指定輸出路徑
  openyida export-conversation --list             列出可用對話
`,
    unknown_command: '未知指令：{0}',
    run_help: '執行 openyida --help 查看說明',
    integration_help: '用法：openyida integration <create|list|enable|disable> ...',
    integration_unknown: '未知的 integration 子指令：{0}',
    integration_help_hint: '執行 openyida integration --help 查看可用子指令',
    integration_list_usage: '用法：openyida integration list <appType> [--form-uuid <uuid>] [--status y|n] [--key <kw>] [--page <n>] [--size <n>] [--json]',
    integration_list_example: '範例：openyida integration list APP_XXX --form-uuid FORM-XXX --json',
    integration_enable_usage: '用法：openyida integration enable <appType> <formUuid> <processCode>',
    integration_enable_example: '範例：openyida integration enable APP_XXX FORM-XXX LPROC-XXX',
    integration_disable_usage: '用法：openyida integration disable <appType> <formUuid> <processCode>',
    integration_disable_example: '範例：openyida integration disable APP_XXX FORM-XXX LPROC-XXX',
    compile_usage: '用法：openyida compile <原始檔路徑>',
    compile_example: '範例：openyida compile pages/src/home.oyd.jsx',
    check_page_usage: '用法：openyida check-page <原始檔路徑> [--compat] [--json]',
    check_page_example: '範例：openyida check-page pages/src/home.oyd.jsx --json',
    generate_page_usage: '用法：openyida generate-page <template> --output pages/src/home.oyd.jsx [--spec page.json] [--compile]',
    generate_page_example: '範例：openyida generate-page product-homepage --brand-name OpenKuma --brand-initials OK --output pages/src/home.oyd.jsx --compile',
    publish_usage: '用法：openyida publish <原始檔路徑> <appType> <formUuid> [--health-check]',
    publish_example: '範例：openyida publish pages/src/home.oyd.jsx APP_XXX FORM-XXX --health-check',
    verify_usage: '用法：openyida verify-short-url <appType> <formUuid> <url>',
    verify_example: '範例：openyida verify-short-url APP_XXX FORM-XXX /o/myapp',
    share_usage: '用法：openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]',
    share_example: '範例：openyida save-share-config APP_XXX FORM-XXX /o/myapp y n',
    page_config_usage: '用法：openyida get-page-config <appType> <formUuid>',
    page_config_example: '範例：openyida get-page-config APP_XXX FORM-XXX',
    form_config_usage: '用法：openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    form_config_example: '範例：openyida update-form-config APP_XXX FORM-XXX false "頁面標題"',
    export_usage: '用法：openyida export <appType> [output]',
    export_example1: '範例：openyida export APP_XXX',
    export_example2: '      openyida export APP_XXX ./my-app-backup.json',
    import_usage: '用法：openyida import <file> [name]',
    import_example1: '範例：openyida import ./yida-export.json',
    import_example2: '      openyida import ./yida-export.json "品質追溯系統（正式環境）"',
    configure_process_usage: '用法：openyida configure-process <appType> <formUuid> <processDefinitionFile> [processCode]',
    configure_process_example: '範例：openyida configure-process "APP_XXX" "FORM-YYY" process-definition.json',
    create_process_usage: '用法：openyida create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>\n      openyida create-process <appType> --formUuid <formUuid> <processDefinitionFile>',
    create_process_example: '範例：openyida create-process "APP_XXX" "訂單處理表" fields.json process-definition.json',
    process_usage: '用法：openyida process <子指令>\n\n子指令：\n  preview <appType> <processInstanceId> [--output <path>]  預覽流程實例（產生視覺化流程圖）',
    process_preview_usage: '用法：openyida process preview <appType> <processInstanceId> [--output <path>]',
    process_preview_example: '範例：openyida process preview APP_XXX proc-inst-id-xxx',
    get_permission_usage: '用法：openyida get-permission <appType> <formUuid>',
    get_permission_example: '範例：openyida get-permission APP_XXX FORM-XXX',
    save_permission_usage: '用法：openyida save-permission <appType> <formUuid> [--data-permission <json>] [--action-permission <json>]',
    save_permission_example: "範例：openyida save-permission APP_XXX FORM-XXX --data-permission '{\"role\":\"DEFAULT\",\"dataRange\":\"SELF\"}'",
    exec_failed: '\n❌ 執行失敗：{0}',
    first_run_title: '  🤖 OpenYida - AI 問答模式已開啟！                         ',
    first_run_welcome: '  {0}歡迎首次使用 OpenYida！{1} 以下是快速上手指南：',
    first_run_way1_title: '  📝 方式一：直接描述需求',
    first_run_way1_desc: '  在 AI 工具對話框中，直接告訴 AI 你想要什麼：',
    first_run_prompt1: '  「幫我用宜搭建立一個考勤管理系統」',
    first_run_prompt2: '  「建立一個 CRM 客戶管理系統」',
    first_run_prompt3: '  「幫我搭建個人薪資計算器應用程式」',
    first_run_way2_title: '  💡 方式二：指定詳細需求',
    first_run_prompt4: '  「建立一個員工入職流程，包含基本資料填寫、部門審批、HR 備案」',
    first_run_examples_title: '  📋 範例應用程式',
    first_run_examples: '  薪資計算器    • 生日祝福小程式    • 企業宣傳頁',
    first_run_tips_title: '  🔧 首次使用建議',
    first_run_tip1: '  1. 執行 {0}openyida env{1}   偵測環境和登入態',
    first_run_tip2: '  2. 執行 {0}openyida login{1} 登入宜搭帳戶',
    first_run_tip3: '  3. 在 AI 工具中直接對話，描述你想要的應用程式 🚀',
    first_run_footer1: '  支援的 AI 工具：Codex / Claude Code / Aone Copilot / Cursor / OpenCode',
    first_run_footer2: '  📚 文件：https://github.com/openyida/openyida',
    first_run_footer3: '  （此引導僅首次執行時顯示，執行 openyida --help 查看所有指令）',
  },

  // ── lib/env.js ─────────────────────────────────────
  env: {
    title: '  openyida env - 環境偵測',
    system_info: '\n📋 系統資料',
    os: '  作業系統：   {0} ({1})',
    node: '  Node.js：    {0}',
    home: '  主目錄：     {0}',
    cwd: '  工作目錄：   {0}',
    ai_tools: '\n🤖 AI 工具偵測',
    no_tools: '  ⚠️  未偵測到任何已知 AI 工具',
    tool_active_ready: '← 目前活躍，項目已就緒',
    tool_active_no_project: '← 目前活躍，但無 project 工作目錄',
    tool_installed_has_project: '(已安裝，項目存在，但未活躍)',
    tool_installed: '(已安裝，未活躍)',
    active_env: '\n🎯 目前生效環境',
    ai_tool_label: '  AI 工具：    {0}',
    project_root_label: '  項目根目錄：{0}',
    active_no_project: '  AI 工具：    {0} (活躍，但無 project 工作目錄)',
    no_active_tool: '  AI 工具：    未偵測到活躍工具',
    project_fallback: '  項目根目錄：{0} (fallback)',
    login_status: '\n🔐 登入態偵測',
    logged_in: '  狀態：       ✅ 已登入',
    base_url_label: '  網域：       {0}',
    corp_id_label: '  組織 ID：    {0}',
    user_id_label: '  用戶 ID：  {0}',
    csrf_label: '  csrf_token：{0}...',
    not_logged_in: '  狀態：       ❌ 未登入（執行 openyida login 進行登入）',
    unknown: '(未知)',
  },

  // ── lib/login.js ───────────────────────────────────
  login: {
    title: '  openyida login - 宜搭登入工具',
    logout_title: '  openyida logout - 宜搭登出工具',
    cookie_file_label: '\n  Cookie 檔案：{0}',
    logout_success: '  ✅ 已清空 Cookie，登入態已失效。',
    logout_hint: '  下次呼叫 openyida login 時將重新觸發掃碼登入。',
    logout_no_file: '  ℹ️  Cookie 檔案不存在，無需清空。',
    using_cache: '🔍 偵測到本機 Cookie，直接使用...',
    csrf_ok: '  ✅ csrf_token：{0}...',
    corp_id_ok: '  ✅ corpId：{0}',
    no_playwright: '\n❌ 本機瀏覽器登入需要可選依賴 playwright。預設請使用 openyida login 或 openyida login --qr；如確需本機瀏覽器登入，請先安裝：',
    playwright_install1: '   npm install -g playwright',
    playwright_install2: '   npx playwright install chromium',
    browser_opening: '\n🔐 正在開啟瀏覽器，請掃碼登入...',
    login_url_label: '  登入網址：{0}',
    waiting_login: '  等待登入完成（最長等待 10 分鐘）...',
    login_timeout: '  ⏰ 登入逾時（10 分鐘），請重試。',
    login_success: '  ✅ 登入成功！',
    no_csrf_in_cookie: '  ❌ 登入成功但 Cookie 中無 tianshu_csrf_token，請重試。',
    no_cookie_cache: '  ❌ 本機無有效 Cookie，無法刷新，需要重新登入。',
    no_csrf_in_cache: '  ❌ Cookie 中無 tianshu_csrf_token，需要重新登入。',
    csrf_extracted: '  ✅ csrf_token 擷取成功：{0}...',
    trigger_login: '\n🔐 登入態失效，正在開啟瀏覽器掃碼登入...\n',
    csrf_refresh: '\n🔄 csrf_token 已過期，正在從 Cookie 重新擷取...\n',
  },

  // ── lib/auth.js ────────────────────────────────────
  auth: {
    status_title: '  openyida auth status - 登入狀態查詢',
    not_logged_in: '  狀態：       ❌ 未登入',
    login_hint: '  提示：       執行 openyida auth login 進行登入',
    no_csrf_token: '  狀態：       ❌ 登入態無效（無 csrf_token）',
    relogin_hint: '  提示：       執行 openyida auth login 重新登入',
    logged_in: '  狀態：       ✅ 已登入',
    base_url_label: '  網域：       {0}',
    corp_id_label: '  組織 ID：    {0}',
    user_id_label: '  用戶 ID：  {0}',
    csrf_label: '  csrf_token：{0}...',
    login_type_label: '  登入方式：   {0}',
    login_time_label: '  登入時間：   {0}',
    login_start: '\n🔐 開始登入（方式：{0}）...',
    login_success: '\n✅ 登入成功！',
    corp_id_ok: '  ✅ corpId：{0}',
    refresh_start: '\n🔄 正在刷新登入態...',
    no_cookie_cache: '  ❌ 本機無 Cookie 緩存，無法刷新',
    no_csrf_in_cache: '  ❌ Cookie 中無 csrf_token，需要重新登入',
    refresh_success: '  ✅ 登入態刷新成功！',
    csrf_ok: '  ✅ csrf_token：{0}...',
    auth_config_cleared: '  ✅ 已清空登入設定',
  },

  // ── lib/org.js ─────────────────────────────────────
  org: {
    list_title: '  openyida org list - 組織清單',
    no_corp_id: '  ❌ 無法取得目前組織 ID，請先登入',
    current_org: '目前組織',
    current: '目前',
    no_organizations: '  ⚠️  暫無組織資料',
    switch_title: '  openyida org switch - 組織切換',
    switch_from: '  目前組織：{0}',
    switch_to: '  目標組織：{0}',
    already_in_org: '  ✅ 已在目標組織中，無需切換',
    step1: '\n  Step 1：發起切換請求...',
    step2: '  Step 2：確認切換...',
    step3: '  Step 3：取得新登入態...',
    redirect: '  Step 4：跟隨重新導向 ({0})...',
    switch_failed_no_csrf: '  ❌ 切換失敗：未取得新的 csrf_token',
    switch_success: '\n  ✅ 組織切換成功！',
    new_corp_id: '  新組織 ID：  {0}',
    new_csrf: '  csrf_token：{0}...',
    switch_error: '  ❌ 切換失敗：{0}',
    only_one_org: '  ⚠️  只有一個組織，無需切換',
    select_prompt: '\n  請選擇要切換的組織：',
    use_corp_id_hint: '\n  💡 提示：使用 --corp-id 參數指定目標組織',
    no_login: '❌ 未登入，請先執行 openyida login',
    switched_org: '切換後的組織',
    unknown: '未知',
  },

  // ── lib/create-app.js ──────────────────────────────
  create_app: {
    title: '  openyida create-app - 宜搭應用程式建立工具',
    usage: '用法：openyida create-app "<appName>" [description] [icon] [iconColor] [themeColor] 或 openyida create-app --name "<appName>" [--desc "..."] [--theme deepBlue]',
    example: '範例：openyida create-app --name "考勤管理" --desc "員工考勤打卡系統" --theme deepBlue',
    available_icons: '\n可用圖示：',
    icons_list: '  xian-xinwen, xian-zhengfu, xian-yingyong, xian-xueshimao, xian-qiye,\n  xian-danju, xian-shichang, xian-jingli, xian-falv, xian-baogao,\n  huoche, xian-shenbao, xian-diqiu, xian-qiche, xian-feiji,\n  xian-diannao, xian-gongzuozheng, xian-gouwuche, xian-xinyongka,\n  xian-huodong, xian-jiangbei, xian-liucheng, xian-chaxun, xian-daka',
    available_colors: '\n可用顏色：',
    colors_list: '  #0089FF #00B853 #FFA200 #FF7357 #5C72FF\n  #85C700 #FFC505 #FF6B7A #8F66FF #14A9FF',
    app_name: '  應用程式名稱：{0}',
    app_desc: '  應用程式描述：{0}',
    app_icon: '  圖示：     {0} ({1})',
    app_theme: '  主題：     colour={0} navTheme={1} layout={2}',
    step_create: '\n📦 Step 2：建立應用程式\n',
    success: '  ✅ 應用程式建立成功！',
    app_type_label: '  appType：{0}',
    corp_id_label: '  corpId：  {0}',
    url_label: '  訪問網址：{0}',
    failed: '  ❌ 建立失敗：{0}',
    prd_config_title: '## 應用程式設定',
    prd_config_key: '設定項',
    prd_config_value: '值',
    prd_not_found: '\n  ⚠️  未找到 prd 文件，跳過 corpId 寫入',
    prd_updated: '  ✅ 已更新 prd 文件：{0}',
    prd_update_failed: '  ⚠️  更新 prd 文件失敗：{0}',
  },

  // ── lib/create-page.js ─────────────────────────────
  create_page: {
    title: '  openyida create-page - 宜搭自訂頁面建立工具',
    usage: '用法：openyida create-page <appType> "<pageName>" [--mode dashboard]',
    example: '範例：openyida create-page "APP_XXX" "駕駛艙" --mode dashboard',
    app_id: '  應用程式 ID：  {0}',
    page_name: '  頁面名稱：{0}',
    step_create: '\n📄 Step 2：建立自訂頁面\n',
    sending: '  傳送 saveFormSchemaInfo 請求...',
    success: '  ✅ 頁面建立成功！',
    step_dashboard_config: '\n🖥️  Step 3：設定看板全螢幕模式',
    dashboard_config_ok: '  ✅ 已設定看板模式：隱藏頂部導航，並輸出無左側欄的 custom URL',
    dashboard_config_failed: '  ⚠️  看板模式設定失敗：{0}',
    err_mode_invalid: '不支援的頁面模式：{0}',
    mode_hint: '可用模式：default, dashboard',
    page_id_label: '  pageId：   {0}',
    url_label: '  訪問網址：{0}',
    failed: '  ❌ 建立失敗：{0}',
  },

  // ── lib/get-schema.js ──────────────────────────────
  get_schema: {
    title: '  openyida get-schema - 宜搭表單 Schema 取得工具',
    usage: '用法：openyida get-schema <appType> <formUuid>',
    example: '範例：openyida get-schema "APP_XXX" "FORM-XXX"',
    app_id: '  應用程式 ID：    {0}',
    form_uuid: '  表單 UUID：  {0}',
    step_get: '\n📄 Step 2：取得表單 Schema',
    sending: '  傳送 getFormSchema 請求...',
    success: '  ✅ Schema 取得成功！',
    failed: '  ❌ 取得 Schema 失敗：{0}',
  },

  // ── lib/create-form.js ─────────────────────────────
  create_form: {
    error: '\n❌ 錯誤：{0}',
    usage_create: '用法：openyida create-form create <appType> <formTitle> <fieldsJsonFile>',
    example_create: '範例：openyida create-form create "APP_XXX" "員工資料登記" fields.json',
    usage_update: '用法：openyida create-form update <appType> <formUuid> <changesJsonOrFile>',
    example_update: '範例：openyida create-form update "APP_XXX" "FORM-YYY" \'[{"action":"add","field":{"type":"TextField","label":"備註"}}]\'',
    usage_label: '用法：',
    usage_create_short: '  建立：openyida create-form create <appType> <formTitle> <fieldsJsonFile>',
    usage_update_short: '  更新：openyida create-form update <appType> <formUuid> <changesJsonOrFile>',
    example_label: '\n範例：',
    fields_file_not_found: '  ❌ 欄位定義檔案不存在：',
    fields_format_invalid: '欄位定義格式不正確',
    fields_must_be_array: '欄位定義必須是非空陣列',
    fields_parse_failed: '  ❌ 解析欄位定義失敗：',
    changes_file_not_found: '  ❌ 修改定義檔案不存在：',
    changes_must_be_array: '修改定義必須是非空陣列',
    changes_parse_failed: '  ❌ 解析修改定義失敗：',
    no_components_tree: '  ❌ Schema 中未找到 componentsTree',
    no_form_container: '  ❌ Schema 中未找到 FormContainer',
    add_missing_field: ' - 缺少 field.type 或 field.label，跳過',
    add_after_ok: ' - 在「{0}」後新增欄位「{1}」({2})',
    add_after_not_found: ' - 未找到「{0}」，欄位「{1}」追加到末尾',
    add_before_ok: ' - 在「{0}」前新增欄位「{1}」({2})',
    add_before_not_found: ' - 未找到「{0}」，欄位「{1}」追加到末尾',
    add_ok: ' - 新增欄位「{0}」({1})',
    delete_missing_label: ' - 缺少 label，跳過',
    delete_ok: ' - 刪除欄位「{0}」',
    delete_not_found: ' - 未找到欄位「{0}」，跳過刪除',
    update_missing_label: ' - 缺少 label，跳過',
    update_missing_changes: ' - 缺少 changes，跳過',
    update_table_not_found: ' - 未找到子表「{0}」，跳過更新',
    update_not_table: ' - 「{0}」不是有效的子表欄位，跳過更新',
    in_table: '子表「{0}」中的',
    update_ok: ' - 更新{0}欄位「{1}」的屬性：{2}',
    update_not_found: ' - 未找到{0}欄位「{1}」，跳過更新',
    unknown_action: ' - 未知操作類型「{0}」，跳過',
    filling_rule_resolved: '  🔗 回填規則解析：@label:{0} → {1}',
    filling_rule_failed: '  ⚠️ 回填規則解析失敗：找不到標籤為「{0}」的欄位，請檢查欄位名是否正確',
    table_filling_rule: '  📋 處理子表回填規則 [{0}]：tableId={1}',
    table_rule_resolved: '    🔗 子表規則解析 [{0}]：@label:{1} → {2}',
    table_rule_failed: '    ⚠️ 子表規則解析失敗：找不到標籤為「{0}」的欄位，請檢查欄位名是否正確',
    serial_number_formula_set: '  🔢 SerialNumberField 「{0}」formula 已設定',
    schema_extract_failed: '  ❌ 無法從回傳結果中擷取 Schema',
    schema_response_structure: '  回應結構：{0}',
    schema_parse_failed: '無法解析 Schema 結構',
    action_label: '操作 {0}：{1}',
    step_check_data: '\n🔍 步驟 {0}：檢查表單是否已有資料',
    data_exists_warning: '  ⚠️  該表單已有 {0} 筆資料！修改表單結構可能導致：',
    data_exists_impact: '     - 歷史資料遺失或損壞\n     - 流程狀態異常\n     - 資料不一致',
    data_exists_abort: '  ❌ 已中止修改。如需強制執行，請新增 --force 參數。',
    data_exists_confirm_message: '該表單已有 {0} 筆資料，修改結構可能影響已有資料。請新增 --force 參數確認執行。',
    data_exists_force_hint: '用法：openyida create-form update <appType> <formUuid> <changesJson> --force',
    data_exists_force_proceed: '  ⚠️  --force 模式：跳過確認，強制修改已有 {0} 筆資料的表單結構',
    data_check_empty: '  ✅ 表單暫無資料，可安全修改',
    data_check_failed: '  ⚠️  資料量檢查失敗，繼續執行修改',
  },
  common: {
    http_status: '  HTTP 狀態碼：{0}',
    http_response: '  HTTP 回應：{0}',
    response_body: '  回應內容：{0}',
    response_detail: '  回應詳情：{0}',
    response_not_json: '回應非 JSON',
    login_expired: '  偵測到登入過期：{0}',
    csrf_expired: '  偵測到 csrf_token 過期：{0}',
    csrf_refreshed: '  csrf_token 已刷新',
    request_timeout: '  ❌ 請求逾時',
    request_failed: '請求失敗',
    request_failed_label: '  ❌ 請求失敗',
    unknown_error: '未知錯誤',
    step_login: '\n🔑 Step 1：讀取登入態',
    step_login_label: '\n🔑 讀取登入態',
    no_login_cache: '  ⚠️  未找到本機登入態，觸發登入...',
    login_no_cache: '  ⚠️  未找到本機登入態，觸發登入...',
    login_ready: '  ✅ 登入態已就緒（{0}）',
    resend: '  🔄 重新傳送請求...',
    resend_csrf: '  🔄 重新傳送請求（csrf_token 已刷新）...',
    relogin_retry: '  🔄 重新登入後重新傳送請求...',
    exception: '\n❌ 異常：{0}',
    yes: '是',
    no: '否',
    empty: '（空）',
  },

  // ── lib/export-app.js ──────────────────────────────
  export: {
    usage: '用法：openyida export <appType> [output]',
    example1: '範例：openyida export APP_XXXXXXXXXXXXX',
    example2: '      openyida export APP_XXXXXXXXXXXXX ./my-app-backup.json',
    title: '  openyida export - 宜搭應用程式匯出工具',
    app_id: '\n  應用程式 ID：  {0}',
    output_file: '  輸出檔案：{0}',
    step_get_forms: '\n📋 Step 2：取得應用程式表單清單',
    no_forms: '  ⚠️  未找到任何表單頁面，請確認應用程式 ID 是否正確',
    forms_found: '  ✅ 找到 {0} 個表單頁面',
    step_export_schema: '\n📦 Step 3：匯出表單 Schema',
    exporting: '\n  正在匯出：{0} ({1})',
    export_ok: '    ✅ 匯出成功',
    export_failed: '    ⚠️  匯出失敗，跳過',
    step_write_file: '\n💾 Step 4：寫入匯出檔案',
    done: '  ✅ 匯出完成！',
    success_count: '  成功：{0} 個表單',
    fail_count: '  失敗：{0} 個表單（已跳過）',
    fetch_forms_failed: '取得表單清單失敗',
    unnamed_form: '未命名表單',
  },

  // ── lib/import-app.js ──────────────────────────────
  import_example2: '      openyida import ./yida-export.json "品質追溯系統（正式環境）"',
  exec_failed: '\n❌ 執行失敗：{0}',
  auth_usage: '用法：openyida auth <status|login|refresh|logout>',
  auth_example: '範例：\n  openyida auth status         # 查看登入狀態\n  openyida auth login          # 執行登入\n  openyida auth login --codex  # Codex 內建瀏覽器登入\n  openyida auth refresh        # 刷新登入態\n  openyida auth logout         # 登出',
  org_usage: '用法：openyida org <list|switch>',
  org_example: '範例：\n  openyida org list                    # 列出可訪問的組織\n  openyida org switch --corp-id dingXXX  # 切換到指定組織',
  title: '  openyida import - 宜搭應用程式匯入工具',
  // ── lib/get-page-config.js ─────────────────────────
  get_page_config: {
    usage: '用法：openyida get-page-config <appType> <formUuid>',
    example: '範例：openyida get-page-config APP_XXX FORM-XXX',
    title: '  get-page-config - 宜搭頁面設定查詢工具',
    app_id: '\n  應用程式 ID：    {0}',
    form_uuid: '  表單 UUID：  {0}',
    step_query: '\n🔍 Step 2：查詢頁面設定',
    sending_request: '  傳送 getShareConfig 請求...',
    query_ok: '  ✅ 查詢成功！',
    open_url: '  公開訪問：{0}',
    share_url: '  組織內分享：{0}',
    no_config: '  （尚未設定公開訪問或分享連結）',
    query_failed: '  ❌ 查詢失敗：{0}',
  },

  // ── lib/save-share-config.js ───────────────────────
  save_share_config: {
    usage: '用法：openyida save-share-config <appType> <formUuid> <openUrl> <isOpen> [openAuth]',
    example: '範例：openyida save-share-config "APP_XXX" "FORM-XXX" "/o/xxx" "y" "n"',
    is_open_hint: '  isOpen：y=開啟公開訪問，n=關閉公開訪問',
    open_auth_hint: '  openAuth：y=需要授權，n=不需要授權（預設）',
    title: '  save-share-config - 宜搭公開訪問設定儲存工具',
    app_id: '\n  應用程式 ID：      {0}',
    form_uuid: '  表單 UUID：    {0}',
    open_url: '  公開訪問路徑：{0}',
    is_open: '  是否開放：     {0}',
    open_auth: '  是否需要授權：{0}',
    step_validate: '\n📋 Step 0：驗證參數',
    validate_ok: '  ✅ 參數驗證通過',
    validate_failed: '  ❌ 參數驗證失敗：{0}',
    step_save: '\n💾 Step 2：儲存公開訪問設定',
    sending_request: '  傳送 saveShareConfig 請求...',
    save_ok: '  ✅ 設定儲存成功！',
    save_ok_msg: '公開訪問設定已儲存',
    save_failed: '  ❌ 儲存失敗：{0}',
    save_failed_msg: '儲存失敗',
    err_is_open_invalid: 'isOpen 必須為 y 或 n，目前值：{0}',
    err_open_auth_invalid: 'openAuth 必須為 y 或 n，目前值：{0}',
    err_open_url_required: '開啟公開訪問時，openUrl 不能為空',
    err_open_url_prefix: 'openUrl 必須以 /o/ 開頭，目前值：{0}',
    err_open_url_chars: 'openUrl 路徑部分只支援 a-z A-Z 0-9 _ -，目前值：{0}',
  },

  // ── lib/update-form-config.js ──────────────────────
  update_form_config: {
    usage: '用法：openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    example: '範例：openyida update-form-config "APP_XXX" "FORM_XXX" "false" "我的頁面"',
    params_label: '參數說明：',
    param_is_render_nav: '  isRenderNav：true=顯示頂部導航列，false=隱藏頂部導航列',
    param_title: '  title：頁面標題（必填）',
    title: '  update-form-config - 宜搭表單設定更新工具',
    app_id: '\n  應用程式 ID：      {0}',
    form_uuid: '  表單 UUID：    {0}',
    is_render_nav: '  顯示導航列：   {0}',
    page_title: '  頁面標題：     {0}',
    step_update: '\n💾 Step 2：更新表單設定（隱藏頂部導航列）',
    sending_request: '  傳送 updateFormSchemaInfo 請求...',
    update_ok: '  ✅ 設定更新成功！',
    nav_shown: '已顯示頂部導航列',
    nav_hidden: '已隱藏頂部導航列',
    update_failed: '  ❌ 更新失敗：{0}',
    update_failed_msg: '更新失敗',
  },

  // ── lib/verify-short-url.js ────────────────────────
  verify_short_url: {
    usage: '用法：openyida verify-short-url <appType> <formUuid> <url>',
    example: '範例：openyida verify-short-url "APP_XXX" "FORM-XXX" "/o/aaa"',
    formats_label: '  支援兩種格式：',
    format_open: '    /o/xxx - 公開訪問（對外）',
    format_share: '    /s/xxx - 組織內分享（對內）',
    open_url_label: '公開訪問路徑',
    share_url_label: '組織內分享路徑',
    title: '  verify-short-url - 宜搭 URL 驗證工具',
    app_id: '\n  應用程式 ID：      {0}',
    form_uuid: '  表單 UUID：    {0}',
    step_validate: '\n📋 Step 0：驗證 URL 格式',
    validate_ok: '  ✅ 格式驗證通過',
    validate_failed: '  ❌ 格式驗證失敗：{0}',
    step_verify: '\n🔍 Step 2：驗證 URL',
    sending_request: '  傳送 verifyShortUrl 請求...',
    url_available: '  ✅ URL 可用！',
    open_available_msg: '該公開訪問路徑可用',
    share_available_msg: '該組織內分享路徑可用',
    url_taken: '  ❌ URL 已被佔用',
    url_taken_msg: '該短連結已被佔用',
    verify_failed: '  ❌ 驗證請求失敗',
    err_url_prefix: 'URL 必須以 /o/ 或 /s/ 開頭，目前值：{0}',
    err_url_chars: 'URL 路徑部分只支援 a-z A-Z 0-9 _ -，目前值：{0}',
    err_url_empty: 'URL 路徑部分不能為空：{0}',
  },
  // ── lib/copy.js ────────────────────────────────────
  copy: {
    title: '  openyida copy - 初始化宜搭工作目錄',
    package_root: '\n📦 套件根目錄：{0}',
    dest_base: '🤖 目標根目錄：{0}',
    dest_root: '🤖 目標根目錄：{0}',
    dest_empty_flatten: '📂 目標目錄為空，將 project/ 內容直接鋪入（不建立 project/ 子目錄）',
    force_mode: '⚠️  --force 模式：目標目錄將被清空後重新複製',
    no_package: '\n❌ 未找到 openyida 安裝套件目錄',
    no_package_hint1: '   請確認 openyida 已正確全域安裝：',
    no_package_hint2: '   npm install -g openyida',
    no_ai_tool: '\n❌ 未偵測到活躍的 AI 工具環境\n   支援的工具：悟空、Codex、OpenCode、Claude Code、Aone Copilot、Cursor、Qoder\n\n   目前偵測結果：',
    no_active_tool: '\n❌ 未偵測到活躍的 AI 工具環境',
    supported_tools: '   支援的工具：悟空、Codex、OpenCode、Claude Code、Aone Copilot、Cursor、Qoder',
    current_result: '\n   目前偵測結果：',
    force_hint: '\n   如需強制複製到目前目錄，請執行：\n   openyida copy --force',
    force_cmd: '   openyida copy --force',
    copying: '    複製：{0}',
    copying_label: '\n📂 複製 {0}...',
    creating_symlink: '\n📂 建立 yida-skills/ 符號連結...',
    file_copied: '    複製：{0}',
    cleared: '    🗑️  已清空：{0}',
    symlink_removed: '    🗑️  已移除舊符號連結：{0}',
    old_symlink_removed: '    🗑️  已移除舊符號連結：{0}',
    dir_deleted: '    🗑️  已刪除實際目錄：{0}',
    removed: '    🗑️  已移除：{0}',
    symlink_created: '    🔗 符號連結：{0} -> {1}',
    symlink_label: '符號連結',
    done: '✅ 完成！',
    files_copied: '   複製檔案：{0} 個',
    files_count: '{0} 個檔案',
    symlinks_created: '   建立符號連結：{0} 個',
    result_symlink: '   {0} → {1}（符號連結）',
    result_copy: '   {0} → {1}（{2} 個檔案）',
    wukong_skills_cleanup: '\n🗑️  悟空環境：清理 yida-skills/ 符號連結（悟空透過手動上傳技能，不需要符號連結）...',
    wukong_skills_cleaned: '已清理',
    wukong_skills_not_found: '    ℹ️  未找到 yida-skills/ 符號連結或目錄，無需清理：{0}',
    remove_failed: '    ❌ 刪除失敗：{0}（{1}）',
    symlink_fallback_copy: '    ⚠️  Windows 符號連結建立失敗（需要管理員權限），降級為目錄複製：{0}',
    symlink_failed: '    ❌ 符號連結建立失敗：{0}（{1}）',
  },

  // ── lib/check-update.js ────────────────────────────
  check_update: {
    new_version: '\n💡 發現新版本 {0}（目前 {1}）\n   執行以下指令更新：\n   npm install -g openyida@latest\n',
  },

  // ── lib/update.js ──────────────────────────────────
  update: {
    checking: '正在檢查最新版本...',
    fetch_failed: '無法取得最新版本資料，請檢查網路連線',
    already_latest: '目前已是最新版本（{0}），無需更新',
    found_new_version: '發現新版本 {0}（目前 {1}）',
    installing: '正在安裝 openyida@latest...',
    success: '更新成功！目前版本：{0}',
    install_failed: '更新失敗：{0}',
    manual_hint: '請嘗試手動執行：npm install -g openyida@latest',
    available: '有可用更新',
    up_to_date: '已是最新',
    label_install: 'Install',
    label_channel: 'Channel',
    label_version: 'Version',
    label_update: 'Update',
    done: '更新完成！',
    done_hint: '執行 openyida --version 確認新版本',
  },

  // ── lib/publish.js ─────────────────────────────────
  generate_page: {
    spec_not_found: 'spec 文件不存在：{0}',
    spec_invalid: 'spec JSON 解析失敗：{0}',
    unknown_template: '未知頁面模板：{0}',
    available_templates: '可用模板：{0}',
    template_not_found: '模板文件不存在：{0}',
    done: '頁面已產生：{0}',
    hint: '建議繼續執行 openyida compile <file>，或使用 --compile 直接編譯校驗。',
    success: '頁面產生完成',
  },
  publish: {
    title: '  yida-publish - 宜搭頁面發布工具',
    platform: '  平台位址：{0}',
    base_url: '\n  平台位址：{0}',
    app_type: '  應用程式 ID：   {0}',
    app_id: '  應用程式 ID：   {0}',
    form_uuid: '  表單 ID：   {0}',
    source_file: '  原始檔案：   {0}',
    compiled_file: '  編譯產物：{0}',
    output_dir: '  輸出目錄：pages/dist/',
    step_lint: '\n🔍 Step 0：宜搭編碼規範預檢\n',
    lint_title: '⚠️  宜搭頁面代碼檢查:',
    lint_error_line: '  ❌ 第 {0} 行：{1}',
    lint_warning_line: '  ⚠️  第 {0} 行：{1}',
    lint_event_function: '事件綁定使用了 function，應使用箭頭函數 (e) => { this.xxx() }',
    lint_missing_render_jsx: '缺少 export function renderJsx()，宜搭自定義頁面必須匯出 renderJsx',
    lint_import_require: '偵測到 import/require。宜搭自定義頁面禁止模組匯入，第三方腳本應透過 this.utils.loadScript 載入',
    lint_react_hooks: '偵測到 React Hooks。宜搭執行時基於 React 16 類組件模式，不支援 useState/useEffect 等 Hooks',
    lint_export_default: '偵測到 export default。宜搭需要 export function renderJsx/didMount 等具名匯出',
    lint_jsx_extension: '目前文件是 .js 但包含 JSX，建議改為 .jsx，編譯產物仍會輸出 .js',
    lint_event_direct_method: '事件綁定直接傳入 this.xxx，會導致 this 遺失；請使用 (e) => { this.xxx(e); }',
    lint_event_bind_this: '事件綁定使用了 .bind(this)，請改為 (e) => { this.xxx(e); }',
    lint_array_callback_function: '.{0}(function ...) 會導致回調內 this 遺失，請改為 .{0}((item) => ...)',
    lint_foreach_callback_function: '.forEach(function ...) 可能導致回調內 this 遺失，建議改為 .forEach((item) => ...)',
    lint_controlled_input: 'input 使用了 value 受控模式，宜搭頁面應使用 defaultValue + onChange 寫入 _customState',
    lint_page_size_limit: 'pageSize={0} 超過宜搭 API 上限 100，請改為 100 或更小',
    lint_yida_api_catch: 'this.utils.yida API 調用未偵測到 .catch()，請補充錯誤處理並 toast 給用戶',
    lint_echarts_legacy_map_china: 'ECharts 5 已廢棄 echarts/map/js/china.js，請載入 DataV GeoJSON 後調用 echarts.registerMap("china", geoJson)',
    lint_echarts_rich_label_formatter: 'ECharts label.formatter 返回 rich text 模板在宜搭自定義頁面環境不穩定，建議使用普通 formatter 字串或預先拼好的標籤文字',
    lint_const_let: '使用了 const/let 宣告，建議改為 var（宜搭執行環境相容性）',
    lint_computed_property: '使用了 ES6 計算屬性名 { [key]: value }，宜搭 JS 引擎不支援此語法，會導致靜默失敗。請改為 var obj = {}; obj[key] = value;',
    lint_pad_method: '使用了 String.{0}()，宜搭 JS 引擎不支援此方法，會導致 Promise 回呼靜默中斷。請用三元運算子替代，如：x < 10 ? "0" + x : "" + x',
    lint_large_then_callback: 'Promise .then() 回呼程式碼量過大（{0} 行，建議不超過 {1} 行），可能導致靜默截斷。建議將邏輯提取到獨立的 export function 中',
    lint_fix_errors: '❌ 請修復以上錯誤後再發布',
    lint_skip_hint: '💡 如需跳過檢查，可添加 --skip-lint 參數',
    lint_passed: '  ✅ 程式碼檢查通過\n',
    lint_skipped: '\n⏭️  跳過程式碼預檢（--skip-lint）\n',
    duplicate_source_mismatch: '  ⚠️  偵測到同名雙副本但內容不一致。目前發布：{0}；另一份：{1}',
    step_compile: '\n📦 Step 1：編譯原始碼 & 建構 Schema\n',
    reading_source: '[1/4] 讀取 {0} 原始碼...',
    compiling: '[2/4] Babel 編譯 {0}...',
    compile_failed: '  ❌ 編譯失敗：{0}',
    compile_location: '\n     位置：第 {0} 行，第 {1} 列',
    compile_error_loc: '     位置：第 {0} 行，第 {1} 列',
    compile_error_code: '     錯誤碼：{0}',
    minifying: '[3/4] UglifyJS 壓縮 → {0}...',
    minify_failed: '  壓縮失敗：{0}',
    uglifying: '[3/4] UglifyJS 壓縮 → {0}...',
    uglify_failed: '  壓縮失敗：{0}',
    compile_done: '  ✅ 編譯壓縮完成：{0}',
    building_schema: '[4/4] 建構 Schema...',
    schema_built: '  ✅ Schema 建構完成！',
    step_login: '\n🔑 Step 2：讀取登入態',
    step_publish: '\n📤 Step 3：發布 Schema\n',
    resend_save_csrf: '  🔄 重新傳送 saveFormSchema 請求（csrf_token 已刷新）...',
    resend_save: '  🔄 重新傳送 saveFormSchema 請求...',
    csrf_retry: '  🔄 重新傳送 saveFormSchema 請求（csrf_token 已刷新）...',
    relogin_retry: '  🔄 重新傳送 saveFormSchema 請求...',
    publish_failed: '\n❌ 發布失敗：{0}',
    schema_published: '  ✅ Schema 發布成功！',
    schema_success: '  ✅ Schema 發布成功！',
    form_uuid_label: '  formUuid：{0}',
    version_label: '  version：  {0}',
    step_config: '\n⚙️  Step 4：更新表單設定\n',
    sending_config: '  傳送 updateFormConfig 請求...',
    resend_config_csrf: '  🔄 重新傳送 updateFormConfig 請求（csrf_token 已刷新）...',
    resend_config: '  🔄 重新傳送 updateFormConfig 請求...',
    config_csrf_retry: '  🔄 重新傳送 updateFormConfig 請求（csrf_token 已刷新）...',
    config_relogin_retry: '  🔄 重新傳送 updateFormConfig 請求...',
    success: '  ✅ 發布成功！',
    publish_success: '  ✅ 發布成功！',
    config_updated: '  設定已更新：MINI_RESOURCE = 8',
    config_failed: '  ⚠️  設定更新失敗：{0}',
    schema_ok_config_failed: '  Schema 已發布，但設定更新失敗',
    schema_published_config_failed: '  Schema 已發布，但設定更新失敗',
    step_health_check: '\n🩺 Step 5：健康檢查已發布頁面\n',
    health_check_ok: '  ✅ 健康檢查通過：HTTP {0}',
    health_check_failed: '  ⚠️  健康檢查失敗：HTTP {0} {1}',
    exception: '\n❌ 發布異常：{0}',
    error: '\n❌ 發布異常：{0}',
    source_not_found: '❌ 原始檔案不存在：{0}',
    usage: '用法：openyida publish <appType> <formUuid> <原始檔路徑> [--health-check]',
    example: '範例：openyida publish APP_XXX FORM-XXX pages/src/xxx.js --health-check',
  },

  // ── lib/qr-login.js ────────────────────────────────
  qr_login: {
    title: '🔐 宜搭終端機 QR 碼登入',
    step_init: '  Step 1：初始化工作階段...',
    step_get_qr: '  Step 2：取得 QR 碼...',
    scan_hint: '  📱 請用釘釘掃描以下 QR 碼登入：',
    qr_url_label: '  QR 碼連結：{0}',
    waiting_scan: '  ⏳ 等待掃碼中（最長 2 分鐘）...',
    scanned_confirm: '  ✅ 已掃碼！請在手機上確認登入...',
    scan_success: '  ✅ 掃碼確認成功！',
    step_exchange: '  Step 4：取得登入憑證...',
    step_get_corps: '  Step 5：取得組織清單...',
    step_switch_corp: '  Step 7：切換至目標組織...',
    only_one_corp: '  ✅ 偵測到唯一組織：{0}，自動選擇',
    select_corp_prompt: '  🏢 偵測到多個可訪問組織，請選擇：',
    select_corp_input: '  請輸入序號 (1-{0})：',
    select_corp_invalid: '  ❌ 無效輸入，請輸入 1 到 {0} 之間的數字',
    target_corp_not_found: '未在可訪問組織中找到指定 corpId：{0}',
    corp_selected: '  ✅ 已選擇組織：{0}',
    login_success: '✅ 登入成功！',
    qrcode_fallback: '  ⚠️  qrcode 套件未安裝，請手動訪問以下連結完成登入：',
    qrcode_render_failed: '  ⚠️  QR 碼渲染失敗（{0}），請手動訪問以下連結：',
    get_qr_failed: '取得 QR 碼回應解析失敗：{0}',
    get_qr_api_failed: '取得 QR 碼介面失敗：{0}',
    get_qr_error: '取得 QR 碼失敗：{0}',
    qr_expired: 'QR 碼已過期，請重新登入',
    poll_timeout: '等待掃碼逾時（2 分鐘），請重新登入',
    poll_error: '輪詢掃碼狀態失敗：{0}',
    exchange_failed: '換取登入憑證回應解析失敗：{0}',
    exchange_api_failed: '換取登入憑證介面失敗：{0}',
    exchange_error: '換取登入憑證失敗：{0}',
    get_corp_list_failed: '取得組織清單回應解析失敗：{0}',
    get_corp_list_api_failed: '取得組織清單介面失敗：{0}',
    get_corps_warn: '  ⚠️  取得組織清單失敗（{0}），將使用預設組織',
    switch_corp_failed: '切換組織失敗：{0}',
    switch_corp_warn: '  ⚠️  切換組織失敗（{0}），將使用目前組織',
    select_corp_warn: '  ⚠️  組織選擇失敗（{0}），將使用預設組織',
    no_corp_available: '未找到可訪問的組織',
    no_csrf_in_cookie: '登入成功但未取得 csrf_token，請重試',
    stdin_closed: '輸入串流已關閉，無法選擇組織',
  },

  // ── scripts/postinstall.js ─────────────────────────
  postinstall: {
    welcome_title: '  🎉 歡迎使用 OpenYida！                                    ',
    install_success: '  ✅ 安裝成功！{0} 宜搭 AI 應用程式開發工具已就緒。',
    update_success: '  ✅ 更新成功！{0} OpenYida 已升級至最新版本。',
    ai_mode_title: '  🚀 開啟 AI 問答模式',
    ai_mode_desc: '  在 Codex / Claude Code / Aone Copilot / Cursor 等 AI 工具中直接對話：',
    prompt1: '  📋  「幫我用宜搭建立一個考勤管理系統」',
    prompt2: '  💰  「幫我搭建個人薪資計算器應用程式」',
    prompt3: '  🏢  「建立一個 CRM 客戶管理系統」',
    prompt4: '  🎂  「做一個生日祝福小程式」',
    steps_title: '  📖 基礎使用步驟',
    step1: '  {0}Step 1{1}  開啟你的 AI 程式設計工具（Codex / Claude Code / Cursor 等）',
    step2: '  {0}Step 2{1}  直接用自然語言描述你想要的應用程式',
    step3: '  {0}Step 3{1}  AI 自動呼叫 openyida 指令完成建立和發布',
    step4: '  {0}Step 4{1}  獲得可訪問的宜搭應用程式連結 🎉',
    commands_title: '  ⚡ 快捷指令',
    cmd_env: '  {0}openyida env{1}      {2}# 偵測目前 AI 工具環境和登入態{3}',
    cmd_login: '  {0}openyida login{1}    {2}# 登入宜搭帳戶{3}',
    cmd_help: '  {0}openyida --help{1}   {2}# 查看所有指令{3}',
    footer1: '  📚 文件：https://github.com/openyida/openyida',
    footer2: '  💬 社群：釘釘掃碼加入 OpenYida 社群',
  },

  // ── lib/cdn-*.js ───────────────────────────────────
  cdn: {
    // 設定管理
    config_load_error: '載入 CDN 設定失敗：{0}',
    config_saved: '✅ CDN 設定已儲存至：{0}',
    config_usage: '用法：openyida cdn-config [選項]',
    config_examples: `
範例：
  openyida cdn-config --init
  openyida cdn-config --show
  openyida cdn-config --set-domain cdn.example.com`,
    config_options: `
選項：
  --init                初始化設定（互動式）
  --show                顯示目前設定
  --set-key <key>       設定 AccessKey ID
  --set-secret <secret> 設定 AccessKey Secret
  --set-domain <domain> 設定 CDN 加速網域
  --set-bucket <bucket> 設定 OSS Bucket 名稱
  --set-region <region> 設定 OSS 區域
  --set-path <path>     設定上傳目錄前綴`,
    config_file_path: '📄 設定檔：{0}',
    config_section_aliyun: '🔐 阿里雲憑證',
    config_section_cdn: '🌐 CDN 設定',
    config_section_oss: '📦 OSS 設定',
    config_section_upload: '📤 上傳設定',
    config_cdn_domain: 'CDN 加速網域',
    config_oss_region: 'OSS 區域',
    config_oss_bucket: 'OSS Bucket',
    config_oss_endpoint: 'OSS Endpoint',
    config_upload_path: '上傳目錄',
    config_compress: '圖片壓縮',
    config_max_width: '最大寬度',
    config_quality: '圖片品質',
    config_not_set: '未設定',
    config_enabled: '啟用',
    config_disabled: '停用',
    config_status_valid: '✅ 設定完整，可以使用',
    config_status_invalid: '⚠️  設定不完整',
    config_missing: '   缺少欄位：{0}',
    config_updated: '✅ 設定已更新！',
    config_init_title: '🔧 CDN 設定初始化精靈',
    config_init_desc: '要使用 CDN 圖片上傳功能，需要設定以下資料：',
    config_init_example: '範例設定：',
    config_init_hint: '💡 請使用以下指令設定各項參數：',
    config_init_or: '   或一次性設定所有參數：',

    // 上傳
    upload_usage: '用法：openyida cdn-upload <圖片路徑> [選項]',
    upload_examples: `
範例：
  yida cdn-upload ./image.png
  yida cdn-upload ./images/*.png --domain cdn.example.com
  yida cdn-upload ./photo.jpg --path products/`,
    upload_options: `
選項：
  --domain <網域>   CDN 加速網域（可選）
  --path <路徑>     上傳目錄前綴（可選）
  --compress        啟用圖片壓縮（預設啟用）
  --no-compress     停用圖片壓縮`,
    upload_no_files: '❌ 請指定要上傳的圖片檔案',
    config_incomplete: '❌ CDN 設定不完整',
    missing_fields: '   缺少欄位：{0}',
    run_config_init: '   請先執行：openyida cdn-config --init',
    no_config: '❌ 未找到 CDN 設定',
    oss_sdk_required: '❌ 缺少 ali-oss SDK',
    run_npm_install: '   請執行：npm install {0}',
    no_images_found: '❌ 未找到支援的圖片檔案',
    uploading_images: '📤 正在上傳 {0} 個圖片...',
    uploading_file: '   上傳：{0}',
    upload_success: '   ✅ {0}',
    upload_failed: '   ❌ {0} 上傳失敗：{1}',
    upload_summary: '\n📊 上傳彙總',
    upload_success_count: '   成功：{0} 個',
    upload_fail_count: '   失敗：{0} 個',
    cdn_urls: '\n🔗 CDN URL 清單：',
    upload_error: '❌ 上傳失敗：{0}',

    // 刷新
    refresh_usage: '用法：openyida cdn-refresh [選項]',
    refresh_examples: `
範例：
  yida cdn-refresh --urls "https://cdn.example.com/image.png"
  yida cdn-refresh --paths "/yida-images/"
  yida cdn-refresh --file urls.txt`,
    refresh_options: `
選項：
  --urls <URL 清單>    刷新的 URL 清單（逗號分隔）
  --paths <路徑清單>  刷新的目錄路徑清單（逗號分隔）
  --file <檔案>       從檔案讀取 URL 清單（每行一個）`,
    refresh_no_targets: '❌ 請指定要刷新的 URL 或目錄',
    cdn_sdk_required: '❌ 缺少阿里雲 CDN SDK',
    querying_quota: '📊 查詢刷新配額...',
    quota_info: '   URL 刷新：{0}/天，剩餘 {1} | 目錄刷新：{2}/天，剩餘 {3}',
    quota_query_failed: '   ⚠️  查詢配額失敗：{0}',
    refreshing_urls: '🔄 正在刷新 {0} 個 URL...',
    refreshing_paths: '🔄 正在刷新 {0} 個目錄...',
    refresh_task_id: '   ✅ 任務 ID：{0}',
    refresh_urls_failed: '   ❌ URL 刷新失敗：{0}',
    refresh_paths_failed: '   ❌ 目錄刷新失敗：{0}',
    refresh_summary: '\n📊 刷新彙總',
    url_refresh_success: '   ✅ URL 刷新成功，任務 ID：{0}',
    path_refresh_success: '   ✅ 目錄刷新成功，任務 ID：{0}',
    refresh_error: '❌ 刷新失敗：{0}',
    file_not_found: '❌ 檔案不存在：{0}',
  },

  // ── src/flash-note/flash-to-prd.ts ──────────────
  flashNote: {
    toPrd: {
      title: '📋 釘釘閃記轉 PRD',
      help_usage: '用法：openyida flash-to-prd --file <閃記檔案路徑> [--name <項目名>]',
      help_usage2: '      openyida flash-to-prd --name <項目名>  （從標準輸入讀取）',
      help_args_title: '參數：',
      help_arg_file: '  --file, -f <路徑>       閃記文字檔案路徑（支援 .txt / .md）',
      help_arg_name: '  --name, -n <名稱>       項目名稱（可選，預設從閃記內容中自動擷取）',
      help_arg_max_tokens: '  --max-tokens <數量>     AI 最大輸出 token 數（預設 8000）',
      help_examples_title: '範例：',
      help_example1: '  openyida flash-to-prd --file ./meeting-notes.txt --name "設備巡檢系統"',
      help_example2: '  cat meeting.txt | openyida flash-to-prd --name "設備巡檢系統"',
      step_read: '[Step 1] 讀取閃記內容...',
      file_not_found: '檔案不存在：{0}',
      no_input: '未提供閃記內容。請使用 --file 指定檔案，或透過管道傳入內容。',
      stdin_empty: '標準輸入內容為空',
      read_success: '✅ 讀取成功，原文 {0} 字',
      step_load_module: '[Step 2] 載入 Prompt 建構模組...',
      module_loaded_builtin: '✅ 已載入內建 Prompt 模組',
      module_loaded_local: '✅ 已載入本地 Prompt 模組：{0}',
      module_not_found: '❌ 未找到 build-flash-note-prompt.js 模組',
      module_path_tried: '  嘗試路徑 {0}：{1}',
      step_preprocess: '[Step 3] 預處理 + 會議識別...',
      preprocess_result: '  預處理：{0} 字 → {1} 字',
      meeting_meta: '  會議元資料：{0} 項{1}',
      a1_sections: '  A1 摘要段落：{0} 段{1}',
      speakers: '  發言人識別：{0} 位{1}',
      speakers_with_role: '（含角色標註 {0} 位）',
      step_login: '[Step 4] 檢查登入態...',
      no_login: '  未偵測到登入態，觸發登入...',
      login_ready: '✅ 登入態就緒（{0}）',
      step_ai: '[Step 5] 呼叫 AI 產生 PRD...',
      single_segment: '  單段模式，Prompt 長度：{0} 字',
      multi_segment: '  多段模式，共 {0} 段',
      extracting_segment: '  擷取第 {0}/{1} 段（{2} 字）...',
      merging_segments: '  合併分段結果...',
      ai_success: '✅ PRD 產生成功',
      ai_error: 'AI 介面呼叫失敗：{0}',
      done: '✅ 閃記轉 PRD 完成',
      done_project: '  項目名稱：{0}',
      done_file: '  輸出檔案：{0}',
      done_size: '  檔案大小：{0} 字',
      done_meeting: '  會議識別：元資料 {0} 項，A1 摘要 {1} 段，發言人 {2} 位',
    },
  },

  // ── lib/process/preview-process.js ─────────────────
  preview_process: {
    usage: '用法：openyida process preview <appType> <processInstanceId> [--output <path>]',
    example: '範例：openyida process preview APP_XXX proc-inst-id-xxx',
    no_login: '❌ 無法取得有效登入態，請先執行 openyida login',
    fetch_instance_failed: '取得流程實例詳情失敗',
    fetch_records_warning: '取得審批記錄失敗，將僅展示基礎流程圖',
    fetching: '正在取得流程實例 {0} ...',
    data_fetched: '流程資料取得成功',
    nodes_count: '解析到 {0} 個流程節點',
    output_success: '流程預覽已產生：{0}',
    browser_opened: '已在瀏覽器中開啟',
    browser_hint: '請在瀏覽器中開啟：{0}',
    node_submit: '發起提交',
    node_end: '流程結束',
    node_approval: '審批節點',
  },
  codex_login: {
    title: '  openyida login --codex - Codex 登入模式',
    not_codex: '目前環境未偵測為 Codex，僅返回 Codex 瀏覽器登入 handoff。',
    no_playwright: 'Codex 登入模式不需要安裝 Playwright 或額外 Chromium。',
    using_browser: 'Codex 內建瀏覽器僅適合無需登入的頁面預覽；宜搭登入 Cookie 請使用 openyida login --browser。',
    browser_handoff_hint: 'Codex 內建瀏覽器不支援認證 Cookie 匯出；如需 CLI Cookie，請使用 openyida login --browser。',
    handoff_message: 'Codex 內建瀏覽器不能匯出宜搭登入 Cookie；如需 CLI Cookie，請執行 fallback_command。',
    cache_available: '已存在可用的 CLI Cookie 緩存，無需重新開啟瀏覽器登入。',
  },
};
