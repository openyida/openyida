'use strict';


module.exports = {

  // ── bin/yida.js ────────────────────────────────────
  cli: {
    help: `
openyida - Yida CLI Tool

Usage:
  openyida <command> [args...]  (alias: yida)

Commands:
  env                                                          Detect AI tool environment and login status
  copy [--force]                                               Copy project directory to current AI tool environment
  login                                                        Manage login (cache first, then QR scan)
  logout                                                       Logout / switch account
  create-app "<name>" [desc] [icon] [color] [theme]            Create an app, output appType
  create-page <appType> "<pageName>"                           Create a custom page, output pageId
  create-form create <appType> "<formName>" <fieldsJSON> [opt] Create a form page
  create-form update <appType> <formUuid> <changesJSON>        Update a form page
  get-schema <appType> <formUuid>                              Get form Schema
  compile <源文件路徑>                                         僅編譯 JSX 原始碼（不發布，產物輸出至 pages/dist/）
  publish <sourceFile> <appType> <formUuid>                    Compile and publish a custom page
  verify-short-url <appType> <formUuid> <url>                  Verify if a short URL is available
  save-share-config <appType> <formUuid> <url> <isOpen> [auth] Save public access / share config
  get-page-config <appType> <formUuid>                         Query page public access / share config
  update-form-config <appType> <formUuid> <isRenderNav> <title> Update form config
  data <action> <resource> [args]                              Unified data management (form/process/task)
  export <appType> [output]                                    Export app (migration package)
  import <file> [name]                                         Import migration package, rebuild app
  auth status|login|refresh|logout                             Login session management
  org list                                                     List accessible organizations
  org switch --corp-id <corpId>                                Switch organization
  get-permission <appType> <formUuid>                          Query form permission config
  save-permission <appType> <formUuid> [options]               Save form permission config
  configure-process <appType> <formUuid> <file> [processCode]  Configure and publish process
  create-process <appType> <formTitle> <fields> <processDef>   Create process form
  connector <subcommand> [args]                                HTTP connector management
  create-report <appType> "<name>" <chartJSON>                 Create Yida report
  append-chart <appType> <reportId> <chartJSON>                Append chart to report
  doctor [options]                                             Environment diagnostics & auto-fix
  cdn-config [options]                                         Configure CDN image upload
  cdn-upload <image-path> [options]                            Upload images to CDN
  cdn-refresh [options]                                        Refresh CDN cache

Examples:
  openyida login
  openyida create-app "Attendance"
  openyida create-form create APP_XXX "Employee Info" fields.json
  openyida get-schema APP_XXX FORM-XXX
  openyida publish pages/src/home.jsx APP_XXX FORM-XXX
  openyida data query form APP_XXX FORM-XXX --page 1 --size 20
  openyida export APP_XXX
  openyida import ./yida-export.json
  openyida connector list
  openyida create-report APP_XXX "Sales Report" charts.json
  openyida doctor --fix
`,
    unknown_command: 'Unknown command: {0}',
    run_help: 'Run openyida --help for usage',
    publish_usage: 'Usage: openyida publish <sourceFile> <appType> <formUuid>',
    publish_example: 'Example: openyida publish pages/src/home.jsx APP_XXX FORM-XXX',
    verify_usage: 'Usage: openyida verify-short-url <appType> <formUuid> <url>',
    verify_example: 'Example: openyida verify-short-url APP_XXX FORM-XXX /o/myapp',
    share_usage: 'Usage: openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]',
    share_example: 'Example: openyida save-share-config APP_XXX FORM-XXX /o/myapp y n',
    page_config_usage: 'Usage: openyida get-page-config <appType> <formUuid>',
    page_config_example: 'Example: openyida get-page-config APP_XXX FORM-XXX',
    form_config_usage: 'Usage: openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    form_config_example: 'Example: openyida update-form-config APP_XXX FORM-XXX false "Page Title"',
    export_usage: 'Usage: openyida export <appType> [output]',
    export_example1: 'Example: openyida export APP_XXX',
    export_example2: '        openyida export APP_XXX ./my-app-backup.json',
    import_usage: 'Usage: openyida import <file> [name]',
    import_example1: 'Example: openyida import ./yida-export.json',
    import_example2: '        openyida import ./yida-export.json "Quality System (Production)"',
    configure_process_usage: 'Usage: openyida configure-process <appType> <formUuid> <processDefinitionFile> [processCode]',
    configure_process_example: 'Example: openyida configure-process "APP_XXX" "FORM-YYY" process-definition.json',
    create_process_usage: `Usage: openyida create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>
        openyida create-process <appType> --formUuid <formUuid> <processDefinitionFile>`,
    create_process_example: 'Example: openyida create-process "APP_XXX" "Order Form" fields.json process-definition.json',
    get_permission_usage: 'Usage: openyida get-permission <appType> <formUuid>',
    get_permission_example: 'Example: openyida get-permission APP_XXX FORM-XXX',
    save_permission_usage: 'Usage: openyida save-permission <appType> <formUuid> [--data-permission <json>] [--action-permission <json>]',
    save_permission_example: 'Example: openyida save-permission APP_XXX FORM-XXX --data-permission \'{"role":"DEFAULT","dataRange":"SELF"}\'',
    data_usage: 'Usage: openyida data <action> <resource> [args] [options]',
    data_example: 'Example: openyida data query form APP_XXX FORM_XXX --page 1 --size 20',
    connector_help: `
Usage: openyida connector <subcommand> [args]

Subcommands:
  list                                         List HTTP connectors
  create "name" "domain" --operations <file>   Create connector
  detail <connector-id>                        View connector details
  delete <connector-id> [--force]              Delete connector
  add-action --operations <file> --connector-id <id>  Add action
  list-actions <connector-id>                  List actions
  delete-action <connector-id> <operation-id>  Delete action
  test --connector-id <id> --action <actionId> Test action
  list-connections <connector-id>              List auth accounts
  create-connection <connector-id> <name>      Create auth account
  smart-create --curl "curl command"           Smart create connector
  parse-api [options]                          Parse API info
  gen-template [output path]                   Generate API doc template

Use openyida connector <subcommand> --help for detailed help
`,
    connector_unknown: 'Unknown connector subcommand: {0}',
    connector_help_hint: 'Use openyida connector --help to see available subcommands',
    integration_help: `用法: openyida integration <子命令> [參數]

子命令：
  create <appType> <formUuid> <flowName> [選項]   建立整合&自動化（邏輯流程）

範例：
  openyida integration create APP_XXX FORM-XXX "新增記錄通知" --receivers user123 --publish`,
    integration_unknown: '未知的 integration 子命令: {0}',
    integration_help_hint: '使用 openyida integration --help 查看可用子命令',
    auth_usage: 'Usage: openyida auth <status|login|refresh|logout>',
    auth_example: 'Example: openyida auth status',
    org_usage: 'Usage: openyida org <list|switch> [options]',
    org_example: 'Example: openyida org list',
    exec_failed: `
❌ Execution failed: {0}`,
    first_run_title: '  🤖 OpenYida - AI Conversation Mode Activated!               ',
    first_run_welcome: "  {0}Welcome to OpenYida!{1} Here's a quick start guide:",
    first_run_way1_title: '  📝 Option 1: Describe your needs directly',
    first_run_way1_desc: '  In your AI tool, just tell the AI what you want:',
    first_run_prompt1: '  "Help me create an attendance management system with Yida"',
    first_run_prompt2: '  "Create a CRM customer management system"',
    first_run_prompt3: '  "Build a personal salary calculator app"',
    first_run_way2_title: '  💡 Option 2: Specify detailed requirements',
    first_run_prompt4: '  "Create an employee onboarding flow with info form, department approval, and HR filing"',
    first_run_examples_title: '  📋 Example Apps',
    first_run_examples: '  Salary Calculator    • Birthday Greeting App    • Company Landing Page',
    first_run_tips_title: '  🔧 Getting Started Tips',
    first_run_tip1: '  1. Run {0}openyida env{1}   to detect environment and login status',
    first_run_tip2: '  2. Run {0}openyida login{1} to log in to Yida',
    first_run_tip3: '  3. Chat with your AI tool and describe the app you want 🚀',
    first_run_footer1: '  Supported AI tools: Claude Code / Aone Copilot / Cursor / OpenCode',
    first_run_footer2: '  📚 Docs: https://github.com/openyida/openyida',
    first_run_footer3: '  (This guide only shows on first run. Use openyida --help to see all commands)',
  },

  // ── lib/env.js ─────────────────────────────────────
  env: {
    title: '  openyida env - AI 工具環境偵測',
    system_info: `
📋 System Info`,
    os: '  OS:           {0} ({1})',
    node: '  Node.js:      {0}',
    home: '  Home dir:     {0}',
    cwd: '  Working dir:  {0}',
    ai_tools: `
🤖 AI Tool Detection`,
    no_tools: '  ⚠️  No known AI tools detected',
    tool_active_ready: '← Active, project ready',
    tool_active_no_project: '← Active, but no project directory',
    tool_installed_has_project: '(Installed, project exists, but not active)',
    tool_installed: '(Installed, not active)',
    active_env: `
🎯 Current Active Environment`,
    ai_tool_label: '  AI Tool:      {0}',
    project_root_label: '  Project root: {0}',
    active_no_project: '  AI Tool:      {0} (active, but no project directory)',
    no_active_tool: '  AI Tool:      No active tool detected',
    project_fallback: '  Project root: {0} (fallback)',
    login_status: `
🔐 Login Status`,
    logged_in: '已登入',
    base_url_label: '  Domain:       {0}',
    corp_id_label: '  Org ID:       {0}',
    user_id_label: '  User ID:      {0}',
    csrf_label: '  csrf_token:   {0}...',
    not_logged_in: '未登入',
    unknown: '(unknown)',
  },

  // ── lib/login.js ────────────────────────────────────
  login: {
    title: '🔐 宜搭登入',
    logout_title: '  yidacli logout - Yida Logout Tool',
    cookie_file_label: `
  Cookie file: {0}`,
    logout_success: '  ✅ Cookie cleared, login session invalidated.',
    logout_hint: '  Next time you run yidacli login, a QR scan will be triggered.',
    logout_no_file: '  ℹ️  Cookie file does not exist, nothing to clear.',
    using_cache: '🔍 Local Cookie found, using it directly...',
    csrf_ok: '  ✅ csrf_token: {0}...',
    corp_id_ok: '  ✅ corpId: {0}',
    no_playwright: `
❌ playwright module not found. Please install it first:`,
    playwright_install1: '   npm install -g playwright',
    playwright_install2: '   npx playwright install chromium',
    browser_opening: `
🔐 Opening browser for QR code login...`,
    login_url_label: '  Login URL: {0}',
    waiting_login: '  Waiting for login (up to 10 minutes)...',
    login_timeout: '  ⏰ Login timed out (10 minutes). Please try again.',
    login_success: '  ✅ Login successful!',
    no_csrf_in_cookie: '  ❌ Login succeeded but no tianshu_csrf_token in Cookie. Please retry.',
    no_cookie_cache: '  ❌ No valid local Cookie found. Cannot refresh. Please log in again.',
    no_csrf_in_cache: '  ❌ No tianshu_csrf_token in Cookie. Please log in again.',
    csrf_extracted: '  ✅ csrf_token extracted: {0}...',
    trigger_login: `
🔐 Login session expired, opening browser for QR code login...
`,
    csrf_refresh: `
🔄 csrf_token expired, re-extracting from Cookie...
`,
  },

  // ── lib/auth.js ────────────────────────────────────
  auth: {
    status_title: '  yidacli auth status - Login Status Query',
    not_logged_in: '  Status:       ❌ Not logged in',
    login_hint: '  Hint:         Run openyida auth login to authenticate',
    no_csrf_token: '  Status:       ❌ Invalid login (no csrf_token)',
    relogin_hint: '  Hint:         Run openyida auth login to re-authenticate',
    logged_in: '  Status:       ✅ Logged in',
    base_url_label: '  Domain:      {0}',
    corp_id_label: '  Org ID:      {0}',
    user_id_label: '  User ID:     {0}',
    csrf_label: '  csrf_token:  {0}...',
    login_type_label: '  Login type:  {0}',
    login_time_label: '  Login time:  {0}',
    login_start: `
🔐 Starting login (method: {0})...`,
    login_success: `
✅ Login successful!`,
    corp_id_ok: '  ✅ corpId: {0}',
    refresh_start: `
🔄 Refreshing login session...`,
    no_cookie_cache: '  ❌ No local Cookie cache, cannot refresh',
    no_csrf_in_cache: '  ❌ No csrf_token in Cookie, need to re-login',
    refresh_success: '  ✅ Login session refreshed!',
    csrf_ok: '  ✅ csrf_token: {0}...',
    auth_config_cleared: '  ✅ Auth config cleared',
  },

  // ── lib/org.js ─────────────────────────────────────
  org: {
    list_title: '  yidacli org list - Organization List',
    no_corp_id: '  ❌ Cannot get current org ID, please login first',
    current_org: 'Current organization',
    current: 'current',
    no_organizations: '  ⚠️  No organization info available',
    switch_title: '  yidacli org switch - Organization Switch',
    switch_from: '  Current org: {0}',
    switch_to: '  Target org:  {0}',
    already_in_org: '  ✅ Already in target organization',
    step1: `
  Step 1: Initiating switch request...`,
    step2: '  Step 2: Confirming switch...',
    step3: '  Step 3: Getting new credentials...',
    redirect: '  Step 4: Following redirect ({0})...',
    switch_failed_no_csrf: '  ❌ Switch failed: no new csrf_token obtained',
    switch_success: `
  ✅ Organization switched successfully!`,
    new_corp_id: '  New org ID:   {0}',
    new_csrf: '  csrf_token:   {0}...',
    switch_error: '  ❌ Switch failed: {0}',
    only_one_org: '  ⚠️  Only one organization available',
    select_prompt: `
  Select organization to switch:`,
    use_corp_id_hint: `
  💡 Hint: use --corp-id option to specify target organization`,
    no_login: '❌ Not logged in, please run openyida login first',
    switched_org: 'Switched organization',
    unknown: 'unknown',
  },

  // ── lib/create-app.js ───────────────────────────────
  create_app: {
    title: '  create-app - 宜搭應用建立工具',
    usage: '用法：openyida create-app <應用名稱>',
    example: '範例：openyida create-app "我的應用"',
    available_icons: `
Available icons:`,
    icons_list: `  xian-xinwen, xian-zhengfu, xian-yingyong, xian-xueshimao, xian-qiye,
  xian-danju, xian-shichang, xian-jingli, xian-falv, xian-baogao,
  huoche, xian-shenbao, xian-diqiu, xian-qiche, xian-feiji,
  xian-diannao, xian-gongzuozheng, xian-gouwuche, xian-xinyongka,
  xian-huodong, xian-jiangbei, xian-liucheng, xian-chaxun, xian-daka`,
    available_colors: `
Available colors:`,
    colors_list: `  #0089FF #00B853 #FFA200 #FF7357 #5C72FF
  #85C700 #FFC505 #FF6B7A #8F66FF #14A9FF`,
    app_name: `
  應用名稱：{0}`,
    app_desc: '  Description: {0}',
    app_icon: '  Icon:        {0} ({1})',
    app_theme: '  Theme:       {0}',
    step_create: `
🚀 正在建立應用...`,
    success: '  ✅ 應用建立成功！',
    app_type_label: '  appType: {0}',
    corp_id_label: '  corpId:  {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ 建立失敗：{0}',
    prd_config_title: '## App Config',
    prd_config_key: 'Key',
    prd_config_value: 'Value',
    prd_not_found: `
  ⚠️  PRD document not found, skipping corpId update`,
    prd_updated: '  ✅ PRD document updated: {0}',
    prd_update_failed: '  ⚠️  Failed to update PRD document: {0}',
  },

  // ── lib/create-page.js ──────────────────────────────
  create_page: {
    title: '  create-page - 宜搭自訂展示頁面建立工具',
    usage: '用法：openyida create-page <appType> <頁面名稱>',
    example: '範例：openyida create-page "APP_XXX" "我的頁面"',
    app_id: `
  應用 ID：    {0}`,
    page_name: '  頁面名稱：   {0}',
    step_create: `
📄 正在建立自訂頁面...`,
    sending: '  Sending saveFormSchemaInfo request...',
    success: '  ✅ 自訂頁面建立成功！',
    page_id_label: '  pageId: {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ 建立失敗：{0}',
    datasource_injecting: '  [datasource] 正在注入 {0} 個連接器資料來源...',
    datasource_success: '  [datasource] 資料來源注入成功',
    datasource_failed: '  [datasource] 資料來源注入失敗：{0}',
    invalid_response: '❌ 建立頁面失敗：伺服器回傳的 pageId 無效，請確認 appType 是否正確',
  },

  // ── lib/get-schema.js ───────────────────────────────
  get_schema: {
    title: '  get-schema - 宜搭表單 Schema 查詢工具',
    usage: '用法：openyida get-schema <appType> <formUuid>',
    example: '範例：openyida get-schema "APP_XXX" "FORM-XXX"',
    app_id: `
  應用 ID：    {0}`,
    form_uuid: '  表單 UUID：  {0}',
    step_get: `
📋 正在查詢表單 Schema...`,
    sending: '  Sending getFormSchema request...',
    success: '  ✅ Schema 查詢成功！',
    failed: '  ❌ 查詢失敗：{0}',
  },

  // ── lib/create-form.js ──────────────────────────────
  create_form: {
    error: `
❌ 建立異常：{0}`,
    usage_create: 'Usage: openyida create-form create <appType> <formTitle> <fieldsJsonFile>',
    example_create: 'Example: openyida create-form create "APP_XXX" "Employee Info" fields.json',
    usage_update: 'Usage: openyida create-form update <appType> <formUuid> <changesJsonOrFile>',
    example_update: 'Example: openyida create-form update "APP_XXX" "FORM-YYY" \'[{"action":"add","field":{"type":"TextField","label":"Note"}}]\'',
    usage_label: 'Usage:',
    usage_create_short: '  create: openyida create-form create <appType> <formTitle> <fieldsJsonFile>',
    usage_update_short: '  update: openyida create-form update <appType> <formUuid> <changesJsonOrFile>',
    example_label: `
Examples:`,
    fields_file_not_found: '  ❌ Fields definition file not found: ',
    fields_format_invalid: 'Invalid fields definition format',
    fields_must_be_array: 'Fields definition must be a non-empty array',
    fields_parse_failed: '  ❌ Failed to parse fields definition: ',
    changes_file_not_found: '  ❌ Changes definition file not found: ',
    changes_must_be_array: 'Changes definition must be a non-empty array',
    changes_parse_failed: '  ❌ Failed to parse changes definition: ',
    no_components_tree: '  ❌ componentsTree not found in Schema',
    no_form_container: '  ❌ FormContainer not found in Schema',
    add_missing_field: ' - missing field.type or field.label, skipped',
    add_after_ok: ' - added field "{1}" ({2}) after "{0}"',
    add_after_not_found: ' - "{0}" not found, field "{1}" appended to end',
    add_before_ok: ' - added field "{1}" ({2}) before "{0}"',
    add_before_not_found: ' - "{0}" not found, field "{1}" appended to end',
    add_ok: ' - added field "{0}" ({1})',
    delete_missing_label: ' - missing label, skipped',
    delete_ok: ' - deleted field "{0}"',
    delete_not_found: ' - field "{0}" not found, skipped',
    update_missing_label: ' - missing label, skipped',
    update_missing_changes: ' - missing changes, skipped',
    update_table_not_found: ' - sub-table "{0}" not found, skipped',
    update_not_table: ' - "{0}" is not a valid TableField, skipped',
    in_table: 'in sub-table "{0}" ',
    update_ok: ' - updated {0}field "{1}" props: {2}',
    update_not_found: ' - {0}field "{1}" not found, skipped',
    unknown_action: ' - unknown action "{0}", skipped',
    filling_rule_resolved: '  🔗 Filling rule resolved: @label:{0} → {1}',
    filling_rule_failed: '  ⚠️ Filling rule failed: field with label "{0}" not found, please check the field name',
    table_filling_rule: '  📋 Processing sub-table filling rule [{0}]: tableId={1}',
    table_rule_resolved: '    🔗 Sub-table rule resolved [{0}]: @label:{1} → {2}',
    table_rule_failed: '    ⚠️ Sub-table rule failed: field with label "{0}" not found, please check the field name',
    serial_number_formula_set: '  🔢 SerialNumberField "{0}" formula set',
    schema_extract_failed: '  ❌ Unable to extract Schema from response',
    schema_response_structure: '  Response structure: {0}',
    schema_parse_failed: 'Unable to parse Schema structure',
    action_label: 'Action {0}: {1}',
  },
  common: {
    http_status: '  HTTP status: {0}',
    http_response: '  HTTP response: {0}',
    response_body: '  Response body: {0}',
    response_detail: '  Response detail: {0}',
    response_not_json: 'response is not JSON',
    login_expired: '  Login session expired: {0}',
    csrf_expired: '  CSRF token expired: {0}',
    csrf_refreshed: '  csrf_token refreshed',
    request_timeout: '  ❌ Request timed out',
    request_failed: 'request failed',
    request_failed_label: '  ❌ Request failed',
    unknown_error: 'unknown error',
    step_login: `
🔑 Step 1: Read login credentials`,
    step_login_label: `
🔑 Read login credentials`,
    no_login_cache: '  ⚠️  No local login session found, triggering login...',
    login_no_cache: '  ⚠️  No local login session found, triggering login...',
    login_ready: '  ✅ Login session ready ({0})',
    resend: '  🔄 Resending request...',
    resend_csrf: '  🔄 Resending request (csrf_token refreshed)...',
    relogin_retry: '  🔄 Resending request after re-login...',
    exception: `
❌ Exception: {0}`,
    yes: 'Yes',
    no: 'No',
    empty: '(empty)',
  },

  // ── lib/export-app.js ──────────────────────────────
  export: {
    usage: 'Usage: openyida export <appType> [output]',
    example1: 'Example: openyida export APP_XXXXXXXXXXXXX',
    example2: '         openyida export APP_XXXXXXXXXXXXX ./my-app-backup.json',
    title: '  openyida export - Yida App Export Tool',
    app_id: `
  App ID:      {0}`,
    output_file: '  Output file: {0}',
    step_get_forms: `
📋 Step 2: Get app form list`,
    no_forms: '  ⚠️  No form pages found. Please verify the app ID.',
    forms_found: '  ✅ Found {0} form pages',
    step_export_schema: `
📦 Step 3: Export form Schema`,
    exporting: `
  Exporting: {0} ({1})`,
    export_ok: '    ✅ Export successful',
    export_failed: '    ⚠️  Export failed, skipped',
    step_write_file: `
💾 Step 4: Write export file`,
    done: '  ✅ Export complete!',
    success_count: '  Success: {0} forms',
    fail_count: '  Failed: {0} forms (skipped)',
    fetch_forms_failed: 'Failed to fetch form list',
    unnamed_form: 'Unnamed form',
  },

  // ── lib/import-app.js ──────────────────────────────
  import_example2: '      openyida import ./yida-export.json "质量追溯系统（生产环境）"',
  exec_failed: `
❌ 执行失败: {0}`,
  auth_usage: '用法: openyida auth <status|login|refresh|logout>',
  auth_example: `示例:
  openyida auth status   # 查看登录状态
  openyida auth login    # 执行登录
  openyida auth refresh  # 刷新登录态
  openyida auth logout   # 退出登录`,
  org_usage: '用法: openyida org <list|switch>',
  org_example: `示例:
  openyida org list                    # 列出可访问的组织
  openyida org switch --corp-id dingXXX  # 切换到指定组织`,
  title: '  openyida import - 宜搭应用导入工具',

  // ── lib/get-page-config.js ──────────────────────────
  get_page_config: {
    usage: '用法：openyida get-page-config <appType> <formUuid>',
    example: 'Example: yidacli get-page-config APP_XXX FORM-XXX',
    title: '  get-page-config - 宜搭頁面公開存取/分享設定查詢工具',
    app_id: `
  應用 ID：    {0}`,
    form_uuid: '  表單 UUID：  {0}',
    step_query: `
🔍 Step 2: Query page config`,
    sending_request: '  Sending getShareConfig request...',
    query_ok: '  ✅ Query successful!',
    open_url: '  Public access: {0}',
    share_url: '  Org share: {0}',
    no_config: '  (No public access or share link configured)',
    query_failed: '  ❌ Query failed: {0}',
  },

  // ── lib/save-share-config.js ────────────────────────
  save_share_config: {
    usage: '用法：openyida save-share-config <appType> <formUuid> <openUrl> <isOpen> [openAuth]',
    example: '範例：openyida save-share-config APP_XXX FORM-XXX /o/mypage y n',
    is_open_hint: '  isOpen: y=enable public access, n=disable public access',
    open_auth_hint: '  openAuth: y=require auth, n=no auth required (default)',
    title: '  save-share-config - 宜搭公開存取設定儲存工具',
    app_id: `
  應用 ID：      {0}`,
    form_uuid: '  表單 UUID：    {0}',
    open_url: '  公開存取路徑： {0}',
    is_open: '  公開設定：     {0}',
    open_auth: '  需要驗證：     {0}',
    step_validate: `
📋 Step 0：驗證參數`,
    validate_ok: '  ✅ 參數驗證通過',
    validate_failed: '  ❌ 驗證失敗：{0}',
    step_save: `
💾 Step 2：儲存公開存取設定`,
    sending_request: '  正在傳送 saveShareConfig 請求...',
    save_ok: '  ✅ 設定儲存成功！',
    save_ok_msg: '公開存取設定已儲存',
    save_failed: '  ❌ 儲存失敗：{0}',
    save_failed_msg: '儲存失敗',
    err_is_open_invalid: 'isOpen 必須為 y 或 n，目前值：{0}',
    err_open_auth_invalid: 'openAuth 必須為 y 或 n，目前值：{0}',
    err_open_url_required: '啟用公開存取時，openUrl 為必填',
    err_open_url_prefix: 'openUrl 必須以 /o/ 開頭，目前值：{0}',
    err_open_url_chars: 'openUrl 路徑部分只支援 a-z A-Z 0-9 _ -，目前值：{0}',
  },

  // ── lib/update-form-config.js ──────────────────────
  update_form_config: {
    usage: '用法：openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    example: '範例：openyida update-form-config "APP_XXX" "FORM_XXX" "false" "我的頁面"',
    params_label: 'Parameters:',
    param_is_render_nav: '  isRenderNav: true=show top nav, false=hide top nav',
    param_title: '  title: page title (required)',
    title: '  update-form-config - 宜搭表單設定更新工具',
    app_id: `
  應用 ID：      {0}`,
    form_uuid: '  表單 UUID：    {0}',
    is_render_nav: '  顯示導覽列：   {0}',
    page_title: '  頁面標題：     {0}',
    step_update: `
💾 Step 2：更新表單設定（隱藏頂部導覽列）`,
    sending_request: '  正在傳送 updateFormSchemaInfo 請求...',
    update_ok: '  ✅ 設定更新成功！',
    nav_shown: '已顯示頂部導覽列',
    nav_hidden: '已隱藏頂部導覽列',
    update_failed: '  ❌ 更新失敗：{0}',
    update_failed_msg: '更新失敗',
  },

  // ── lib/verify-short-url.js ────────────────────────
  verify_short_url: {
    usage: '用法：openyida verify-short-url <appType> <formUuid> <url>',
    example: '範例：openyida verify-short-url "APP_XXX" "FORM-XXX" "/o/aaa"',
    formats_label: '  Supported formats:',
    format_open: '    /o/xxx - public access (external)',
    format_share: '    /s/xxx - org share (internal)',
    open_url_label: 'Public access URL',
    share_url_label: 'Org share URL',
    title: '  verify-short-url - 宜搭 URL 驗證工具',
    app_id: `
  應用 ID：    {0}`,
    form_uuid: '  表單 UUID：  {0}',
    step_validate: `
📋 Step 0：驗證 URL 格式`,
    validate_ok: '  ✅ 格式驗證通過',
    validate_failed: '  ❌ 格式驗證失敗：{0}',
    step_verify: `
🔍 Step 2：驗證 URL`,
    sending_request: '  正在傳送 verifyShortUrl 請求...',
    url_available: '  ✅ URL 可用！',
    open_available_msg: '該公開存取路徑可用',
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
    package_root: `
📦 套件根目錄：{0}`,
    dest_base: '🤖 Target root: {0}',
    dest_root: '🤖 目標根目錄：{0}',
    force_mode: '⚠️  --force 模式：目標目錄將被清空後重新複製',
    no_package: `
❌ 未找到 openyida 安裝套件目錄`,
    no_package_hint1: '   請確認 openyida 已正確全域安裝：',
    no_package_hint2: '   npm install -g openyida',
    no_ai_tool: `
❌ No active AI tool environment detected
   Supported tools: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder

   Current detection results:`,
    no_active_tool: `
❌ 未偵測到活躍的 AI 工具環境`,
    supported_tools: '   支援的工具：悟空、OpenCode、Claude Code、Aone Copilot、Cursor、Qoder',
    current_result: `
   目前偵測結果：`,
    force_hint: `
   如需強制複製到目前目錄，請執行：
   openyida copy --force`,
    force_cmd: '   openyida copy --force',
    copying: '    Copied: {0}',
    copying_label: `
📂 複製 {0}...`,
    creating_symlink: `
📂 建立 yida-skills/ 符號連結...`,
    file_copied: '    複製：{0}',
    cleared: '    🗑️  已清空：{0}',
    symlink_removed: '    🗑️  已移除舊符號連結：{0}',
    old_symlink_removed: '    🗑️  Removed old symlink: {0}',
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
    wukong_skills_cleanup: `
🗑️  悟空環境：清理 yida-skills/ 符號連結...`,
    wukong_skills_cleaned: '已清理',
    wukong_skills_not_found: '    ℹ️  未找到 yida-skills/ 符號連結或目錄，無需清理：{0}',
    remove_failed: '    ❌ 刪除失敗：{0}（{1}）',
    symlink_fallback_copy: '    ⚠️  Windows 符號連結建立失敗（需要管理員權限），降級為目錄複製：{0}',
    symlink_failed: '    ❌ 符號連結建立失敗：{0}（{1}）',
  },

  // ── lib/check-update.js ─────────────────────────────
  check_update: {
    new_version: `
🎉 發現新版本：{0} → {1}`,
  },

  // ── lib/compile.js ─────────────────────────────────
  compile: {
    usage: '用法: openyida compile <來源檔案>',
    example: '範例：openyida compile pages/src/demo.js',
    source_not_found: '❌ 來源檔案不存在：{0}',
    success: '✅ 編譯完成！',
    output_file: '  產物路徑：{0}',
    exception: '\n❌ 編譯異常: {0}',
  },

  // ── lib/publish.js ─────────────────────────────────
  publish: {
    title: '  yida-publish - 宜搭頁面發布工具',
    platform: '  平台位址：{0}',
    base_url: `
  Platform: {0}`,
    app_type: '  App ID:   {0}',
    app_id: '  應用 ID：  {0}',
    form_uuid: '  表單 ID：  {0}',
    source_file: '  原始檔案：  {0}',
    compiled_file: '  編譯產物：{0}',
    output_dir: '  輸出目錄：pages/dist/',
    step_compile: `
📦 Step 1：編譯原始碼 & 建構 Schema
`,
    reading_source: '[1/4] 讀取 {0} 原始碼...',
    compiling: '[2/4] Babel 編譯 {0}...',
    compile_failed: '  ❌ 編譯失敗：{0}',
    compile_location: `
     位置：第 {0} 行，第 {1} 列`,
    compile_error_loc: '     Location: line {0}, column {1}',
    compile_error_code: '     錯誤碼：{0}',
    minifying: '[3/4] UglifyJS 壓縮 → {0}...',
    minify_failed: '  壓縮失敗：{0}',
    uglifying: '[3/4] UglifyJS minifying → {0}...',
    uglify_failed: '  Minification failed: {0}',
    compile_done: '  ✅ 編譯壓縮完成：{0}',
    building_schema: '[4/4] 建構 Schema...',
    schema_built: '  ✅ Schema 建構完成！',
    step_login: `
🔑 Step 2：讀取登入態`,
    step_publish: `
📤 Step 3：發布 Schema
`,
    resend_save_csrf: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    resend_save: '  🔄 Resending saveFormSchema request after re-login...',
    csrf_retry: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    relogin_retry: '  🔄 Resending saveFormSchema request after re-login...',
    publish_failed: `
❌ 發布失敗：{0}`,
    schema_published: '  ✅ Schema 發布成功！',
    schema_success: '  ✅ Schema published successfully!',
    form_uuid_label: '  formUuid: {0}',
    version_label: '  version:  {0}',
    step_config: `
⚙️  Step 4：更新表單設定
`,
    sending_config: '  Sending updateFormConfig request...',
    resend_config_csrf: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    resend_config: '  🔄 Resending updateFormConfig request after re-login...',
    config_csrf_retry: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    config_relogin_retry: '  🔄 Resending updateFormConfig request after re-login...',
    success: '  ✅ 發布成功！',
    publish_success: '  ✅ Published successfully!',
    config_updated: '  Config updated: MINI_RESOURCE = 8',
    config_failed: '  ⚠️  設定更新失敗：{0}',
    schema_ok_config_failed: '  Schema published, but config update failed',
    schema_published_config_failed: '  Schema published, but config update failed',
    exception: `
❌ 發布異常：{0}`,
    error: `
❌ Publish error: {0}`,
    source_not_found: '❌ 原始檔案不存在：{0}',
    usage: '用法：openyida publish <appType> <formUuid> <原始檔案路徑>',
    example: '範例：openyida publish APP_XXX FORM-XXX pages/src/xxx.js',
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
    select_corp_prompt: '  🏢 偵測到多個可存取組織，請選擇：',
    select_corp_input: '  請輸入序號 (1-{0})：',
    select_corp_invalid: '  ❌ 無效輸入，請輸入 1 到 {0} 之間的數字',
    corp_selected: '  ✅ 已選擇組織：{0}',
    login_success: '✅ 登入成功！',
    qrcode_fallback: '  ⚠️  qrcode 套件未安裝，請手動存取以下連結完成登入：',
    qrcode_render_failed: '  ⚠️  QR 碼渲染失敗（{0}），請手動存取以下連結：',
    get_qr_failed: 'Failed to parse QR code response: {0}',
    get_qr_api_failed: 'QR code API failed: {0}',
    get_qr_error: 'Failed to get QR code: {0}',
    qr_expired: 'QR 碼已過期，請重新登入',
    poll_timeout: '等待掃碼逾時（2 分鐘），請重新登入',
    poll_error: 'Failed to poll scan status: {0}',
    exchange_failed: 'Failed to parse auth code exchange response: {0}',
    exchange_api_failed: 'Auth code exchange API failed: {0}',
    exchange_error: 'Failed to exchange auth code: {0}',
    get_corp_list_failed: 'Failed to parse organization list response: {0}',
    get_corp_list_api_failed: 'Organization list API failed: {0}',
    get_corps_warn: '  ⚠️  Failed to get organization list ({0}), using default organization',
    switch_corp_failed: 'Failed to switch organization: {0}',
    switch_corp_warn: '  ⚠️  Failed to switch organization ({0}), using current organization',
    select_corp_warn: '  ⚠️  Organization selection failed ({0}), using default organization',
    no_corp_available: '未找到可存取的組織',
    no_csrf_in_cookie: '登入成功但未取得 csrf_token，請重試',
    stdin_closed: '輸入串流已關閉，無法選擇組織',
  },

  // ── scripts/postinstall.js ─────────────────────────
  postinstall: {
    welcome_title: '  🎉 歡迎使用 OpenYida！                                       ',
    install_success: '  ✅ 安裝成功！{0} 宜搭 AI 應用開發工具已就緒。',
    update_success: '  ✅ 更新成功！{0} OpenYida 已升級至最新版本。',
    ai_mode_title: '  🚀 開啟 AI 問答模式',
    ai_mode_desc: '  在 Claude Code / Aone Copilot / Cursor 等 AI 工具中直接對話：',
    prompt1: '  📋  「幫我用宜搭建立一個考勤管理系統」',
    prompt2: '  💰  「幫我搭建個人薪資計算器應用」',
    prompt3: '  🏢  「建立一個 CRM 客戶管理系統」',
    prompt4: '  🎂  「做一個生日祝福小程式」',
    steps_title: '  📖 基礎使用步驟',
    step1: '  {0}Step 1{1}  開啟你的 AI 程式設計工具（Claude Code / Cursor 等）',
    step2: '  {0}Step 2{1}  直接用自然語言描述你想要的應用',
    step3: '  {0}Step 3{1}  AI 自動呼叫 openyida 指令完成建立和發布',
    step4: '  {0}Step 4{1}  獲得可存取的宜搭應用連結 🎉',
    commands_title: '  ⚡ 快捷指令',
    cmd_env: '  {0}openyida env{1}      {2}# 偵測目前 AI 工具環境和登入態{3}',
    cmd_login: '  {0}openyida login{1}    {2}# 登入宜搭帳號{3}',
    cmd_help: '  {0}openyida --help{1}   {2}# 查看所有指令{3}',
    footer1: '  📚 文件：https://github.com/openyida/openyida',
    footer2: '  💬 社群：釘釘掃碼加入 OpenYida 社群',
  },

  // ── lib/integration/integration-create.js ─────────
  integration: {
    create_usage: 'Usage: openyida integration create <appType> <formUuid> <flowName> [options]',
    create_args_title: 'Arguments:',
    create_arg_app_type: '  appType                                App ID, e.g. APP_XXXX',
    create_arg_form_uuid: '  formUuid                               Trigger form UUID, e.g. FORM-XXXX',
    create_arg_flow_name: '  flowName                               Logic flow name',
    create_options_title: 'Options:',
    create_opt_process_code: '  --process-code <code>                  Existing processCode (LPROC-xxx), creates new if omitted',
    create_opt_receivers: '  --receivers <userId,...>               DingTalk notification receiver user IDs, comma-separated',
    create_opt_title: '  --title <title>                        Notification title, supports #{fieldId-ComponentType}# field refs',
    create_opt_content: '  --content <content>                    Notification content, supports #{fieldId-ComponentType}# field refs',
    create_opt_events: '  --events <insert,update,...>           Trigger events: insert/update/delete/comment, default insert',
    create_opt_data_form_uuid: '  --data-form-uuid <formUuid>            Target form UUID for get-data node',
    create_opt_data_condition: '  --data-condition <b:bName:a[:type]>    Filter condition for get-data node, repeatable',
    create_opt_add_data_form_uuid: '  --add-data-form-uuid <formUuid>        Target form UUID for add-data node',
    create_opt_add_data_assignment: '  --add-data-assignment <col:type:val>   Field assignment for add-data node, repeatable',
    create_opt_publish: '  --publish                              Publish after save, otherwise save as draft',
    create_examples_title: 'Examples:',
    create_example1: '  openyida integration create APP_XXX FORM-XXX "New record notification" \\',
    create_example2: '    --receivers user123 --title "New record submitted" --content "Please handle" --publish',
    create_unknown_sub: 'Unknown integration subcommand: {0}',
    create_missing_args: 'Error: missing required arguments appType, formUuid or flowName',
    create_invalid_events: 'Error: invalid --events value, valid options: insert / update / delete / comment (or create)',
    create_no_receivers: 'Warning: --receivers not specified, notification receivers are empty, flow will be created but cannot send notifications',
    create_title: '🔗 Creating Integration & Automation (Logic Flow)',
    create_app_type: '  App ID: {0}',
    create_form_uuid: '  Trigger form: {0}',
    create_flow_name: '  Flow name: {0}',
    create_mode_update: '  Mode: Update existing logic flow',
    create_mode_new: '  Mode: Create new logic flow',
    create_process_code: '  processCode: {0}',
    create_events: '  Trigger events: {0}',
    create_receivers: '  Notification receivers: {0}',
    create_receivers_empty: '(not set)',
    create_notify_title: '  Notification title: {0}',
    create_notify_content: '  Notification content: {0}',
    create_data_form: '  Get-data form: {0}',
    create_data_conditions: '  Filter conditions count: {0}',
    create_op_mode_publish: '  Operation mode: Save and publish',
    create_op_mode_draft: '  Operation mode: Save as draft only',
    create_step: '\n[{0}/{1}] {2}',
    create_step_login: 'Reading login state...',
    create_no_cache: '  No login cache found, triggering login...',
    create_login_ok: '  ✅ Login ready, baseUrl: {0}',
    create_step_new_flow: 'Creating new logic flow binding...',
    create_new_flow_ok: '  ✅ Created successfully, processCode: {0}',
    create_new_flow_failed: '  ❌ {0}',
    create_step_get_schema: '  📋 Fetching target form schema...',
    create_get_schema_ok: '  ✅ Got {0} fields',
    create_get_schema_warn: '  ⚠️  Failed to fetch target form schema (using empty field list): {0}',
    create_step_save: 'Saving logic flow...',
    create_save_failed: '  ❌ Failed to save logic flow: {0}',
    create_save_ok: '  ✅ Logic flow saved successfully (draft)',
    create_step_publish: 'Publishing logic flow...',
    create_publish_warn: '  ⚠️  Failed to publish logic flow: {0}',
    create_publish_draft_hint: '  (Logic flow saved as draft, you can publish manually on the Yida platform)',
    create_published_ok: '  ✅ Logic flow published successfully (enabled)',
    create_done_published: '✅ Integration & Automation created and published',
    create_done_draft: '✅ Integration & Automation saved as draft',
    create_draft_hint: '  Tip: use --publish to publish immediately when creating',
  },

  // ── lib/cdn-*.js ───────────────────────────────────
  cdn: {
    config_load_error: '載入 CDN 設定失敗：{0}',
    config_saved: '✅ CDN 設定已儲存至：{0}',
    config_usage: '用法：openyida cdn-config [選項]',
    config_examples: `
Examples:
  openyida cdn-config --init
  openyida cdn-config --show
  openyida cdn-config --set-domain cdn.example.com`,
    config_options: `
Options:
  --init                Initialize config (interactive)
  --show                Show current config
  --set-key <key>       Set AccessKey ID
  --set-secret <secret> Set AccessKey Secret
  --set-domain <domain> Set CDN domain
  --set-bucket <bucket> Set OSS Bucket name
  --set-region <region> Set OSS region
  --set-path <path>     Set upload path prefix`,
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
    config_init_desc: '要使用 CDN 圖片上傳功能，需要設定以下資訊：',
    config_init_example: 'Example config:',
    config_init_hint: '💡 Use these commands to set each parameter:',
    config_init_or: '   Or set all at once:',
    upload_usage: 'Usage: openyida cdn-upload <image-path> [options]',
    upload_examples: `
Examples:
  yida cdn-upload ./image.png
  yida cdn-upload ./images/*.png --domain cdn.example.com
  yida cdn-upload ./photo.jpg --path products/`,
    upload_options: `
Options:
  --domain <domain>   CDN domain (optional)
  --path <path>       Upload path prefix (optional)
  --compress          Enable image compression (default)
  --no-compress       Disable image compression`,
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
    upload_summary: `
📊 上傳彙總`,
    upload_success_count: '   成功：{0} 個',
    upload_fail_count: '   失敗：{0} 個',
    cdn_urls: `
🔗 CDN URL 清單：`,
    upload_error: '❌ 上傳失敗：{0}',
    refresh_usage: 'Usage: openyida cdn-refresh [options]',
    refresh_examples: `
Examples:
  yida cdn-refresh --urls "https://cdn.example.com/image.png"
  yida cdn-refresh --paths "/yida-images/"
  yida cdn-refresh --file urls.txt`,
    refresh_options: `
Options:
  --urls <url-list>    URLs to refresh (comma-separated)
  --paths <path-list>  Directory paths to refresh (comma-separated)
  --file <file>        Read URL list from file (one per line)`,
    refresh_no_targets: '❌ 請指定要重新整理的 URL 或目錄',
    cdn_sdk_required: '❌ 缺少阿里雲 CDN SDK',
    querying_quota: '📊 查詢重新整理配額...',
    quota_info: '   URL 重新整理：{0}/天，剩餘 {1} | 目錄重新整理：{2}/天，剩餘 {3}',
    quota_query_failed: '   ⚠️  Failed to query quota: {0}',
    refreshing_urls: '🔄 正在重新整理 {0} 個 URL...',
    refreshing_paths: '🔄 正在重新整理 {0} 個目錄...',
    refresh_task_id: '   ✅ 任務 ID：{0}',
    refresh_urls_failed: '   ❌ URL 重新整理失敗：{0}',
    refresh_paths_failed: '   ❌ 目錄重新整理失敗：{0}',
    refresh_summary: `
📊 重新整理彙總`,
    url_refresh_success: '   ✅ URL 重新整理成功，任務 ID：{0}',
    path_refresh_success: '   ✅ 目錄重新整理成功，任務 ID：{0}',
    refresh_error: '❌ 重新整理失敗：{0}',
    file_not_found: '❌ 檔案不存在：{0}',
  },

  // ── src/flash-note/flash-to-prd.ts ──────────────
  flash_to_prd: {
    title: '📋 釘釘閃記轉 PRD',
    help_usage: '用法：openyida flash-to-prd --file <閃記檔案路徑> [--name <專案名>]',
    help_usage2: '      openyida flash-to-prd --name <專案名>  （從標準輸入讀取）',
    help_args_title: '參數：',
    help_arg_file: '  --file, -f <路徑>       閃記文字檔案路徑（支援 .txt / .md）',
    help_arg_name: '  --name, -n <名稱>       專案名稱（可選，預設從閃記內容中自動擷取）',
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
    meeting_meta: '  會議元資訊：{0} 項{1}',
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
    done_project: '  專案名稱：{0}',
    done_file: '  輸出檔案：{0}',
    done_size: '  檔案大小：{0} 字',
    done_meeting: '  會議識別：元資訊 {0} 項，A1 摘要 {1} 段，發言人 {2} 位',
  },
};
