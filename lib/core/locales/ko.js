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
  compile <소스 파일>                                          JSX만 컴파일（배포 없음, pages/dist/ 에 출력）
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
    integration_help: `사용법: openyida integration <하위 명령> [인수]

하위 명령:
  create <appType> <formUuid> <flowName> [옵션]   통합 & 자동화(로직 플로우) 생성

예시:
  openyida integration create APP_XXX FORM-XXX "새 레코드 알림" --receivers user123 --publish`,
    integration_unknown: '알 수 없는 integration 하위 명령: {0}',
    integration_help_hint: 'openyida integration --help를 사용하여 사용 가능한 하위 명령을 확인하세요',
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
    title: '  openyida env - AI 도구 환경 감지',
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
    logged_in: '로그인됨',
    base_url_label: '  Domain:       {0}',
    corp_id_label: '  Org ID:       {0}',
    user_id_label: '  User ID:      {0}',
    csrf_label: '  csrf_token:   {0}...',
    not_logged_in: '로그인 안 됨',
    unknown: '(unknown)',
  },

  // ── lib/login.js ────────────────────────────────────
  login: {
    title: '🔐 Yida 로그인',
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
    title: '  create-app - Yida 앱 생성 도구',
    usage: '사용법: openyida create-app <앱 이름>',
    example: '예시: openyida create-app "내 앱"',
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
  앱 이름: {0}`,
    app_desc: '  Description: {0}',
    app_icon: '  Icon:        {0} ({1})',
    app_theme: '  Theme:       {0}',
    step_create: `
🚀 앱 생성 중...`,
    success: '  ✅ 앱 생성 성공!',
    app_type_label: '  appType: {0}',
    corp_id_label: '  corpId:  {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ 앱 생성 실패: {0}',
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
    title: '  create-page - Yida 커스텀 페이지 생성 도구',
    usage: '사용법: openyida create-page <appType> <페이지 이름>',
    example: '예시: openyida create-page "APP_XXX" "내 페이지"',
    app_id: `
  앱 ID:    {0}`,
    page_name: '  페이지 이름: {0}',
    step_create: `
📄 커스텀 페이지 생성 중...`,
    sending: '  Sending saveFormSchemaInfo request...',
    success: '  ✅ 커스텀 페이지 생성 성공!',
    page_id_label: '  pageId: {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ 커스텀 페이지 생성 실패: {0}',
    datasource_injecting: '  [datasource] {0}개의 커넥터 데이터 소스를 주입 중...',
    datasource_success: '  [datasource] 데이터 소스 주입 성공',
    datasource_failed: '  [datasource] 데이터 소스 주입 실패: {0}',
    invalid_response: '❌ 페이지 생성 실패: 서버에서 반환된 pageId가 유효하지 않습니다. appType이 올바른지 확인하세요',
  },

  // ── lib/get-schema.js ───────────────────────────────
  get_schema: {
    title: '  get-schema - Yida 폼 스키마 조회 도구',
    usage: '사용법: openyida get-schema <appType> <formUuid>',
    example: '예시: openyida get-schema "APP_XXX" "FORM-XXX"',
    app_id: `
  앱 ID:    {0}`,
    form_uuid: '  폼 UUID: {0}',
    step_get: `
📋 폼 스키마 조회 중...`,
    sending: '  Sending getFormSchema request...',
    success: '  ✅ 스키마 조회 성공!',
    failed: '  ❌ 스키마 조회 실패: {0}',
  },

  // ── lib/create-form.js ──────────────────────────────
  create_form: {
    error: `
❌ 폼 페이지 생성 오류: {0}`,
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
    usage: '사용법: openyida get-page-config <appType> <formUuid>',
    example: 'Example: yidacli get-page-config APP_XXX FORM-XXX',
    title: '  get-page-config - Yida 페이지 설정 조회 도구',
    app_id: `
  앱 ID:    {0}`,
    form_uuid: '  폼 UUID: {0}',
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
    usage: '사용법: openyida save-share-config <appType> <formUuid> <openUrl> <isOpen> [openAuth]',
    example: 'Example: node save-share-config.js "APP_XXX" "FORM-XXX" "/o/xxx" "y" "n"',
    is_open_hint: '  isOpen: y=enable public access, n=disable public access',
    open_auth_hint: '  openAuth: y=require auth, n=no auth required (default)',
    title: '  save-share-config - Yida 공개 접근 설정 저장 도구',
    app_id: `
  앱 ID:    {0}`,
    form_uuid: '  폼 UUID: {0}',
    open_url: '  공개 URL: {0}',
    is_open: '  공개 설정: {0}',
    open_auth: '  인증 필요: {0}',
    step_validate: `
📋 Step 0: 파라미터 검증`,
    validate_ok: '  ✅ 파라미터 검증 통과',
    validate_failed: '  ❌ 검증 실패: {0}',
    step_save: `
💾 Step 2: 공개 접근 설정 저장`,
    sending_request: '  saveShareConfig 요청 전송 중...',
    save_ok: '  ✅ 설정 저장 성공!',
    save_ok_msg: '공개 접근 설정 저장 완료',
    save_failed: '  ❌ 저장 실패: {0}',
    save_failed_msg: '저장 실패',
    err_is_open_invalid: 'isOpen은 y 또는 n이어야 합니다. 현재 값: {0}',
    err_open_auth_invalid: 'openAuth는 y 또는 n이어야 합니다. 현재 값: {0}',
    err_open_url_required: '공개 접근 활성화 시 openUrl은 필수입니다',
    err_open_url_prefix: 'openUrl은 /o/로 시작해야 합니다. 현재 값: {0}',
    err_open_url_chars: 'openUrl 경로는 a-z A-Z 0-9 _ -만 사용 가능합니다. 현재 값: {0}',
  },

  // ── lib/update-form-config.js ──────────────────────
  update_form_config: {
    usage: '사용법: openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    example: 'Example: node update-form-config.js "APP_XXX" "FORM_XXX" "false" "My Page"',
    params_label: 'Parameters:',
    param_is_render_nav: '  isRenderNav: true=show top nav, false=hide top nav',
    param_title: '  title: page title (required)',
    title: '  update-form-config - Yida 폼 설정 업데이트 도구',
    app_id: `
  앱 ID:    {0}`,
    form_uuid: '  폼 UUID: {0}',
    is_render_nav: '  내비게이션 표시: {0}',
    page_title: '  페이지 제목: {0}',
    step_update: `
💾 Step 2: 폼 설정 업데이트`,
    sending_request: '  updateFormSchemaInfo 요청 전송 중...',
    update_ok: '  ✅ 설정 업데이트 성공!',
    nav_shown: '상단 내비게이션 표시됨',
    nav_hidden: '상단 내비게이션 숨겨짐',
    update_failed: '  ❌ 업데이트 실패: {0}',
    update_failed_msg: '업데이트 실패',
  },

  // ── lib/verify-short-url.js ────────────────────────
  verify_short_url: {
    usage: '사용법: openyida verify-short-url <appType> <formUuid> <url>',
    example: 'Example: node verify-short-url.js "APP_XXX" "FORM-XXX" "/o/aaa"',
    formats_label: '  Supported formats:',
    format_open: '    /o/xxx - public access (external)',
    format_share: '    /s/xxx - org share (internal)',
    open_url_label: 'Public access URL',
    share_url_label: 'Org share URL',
    title: '  verify-short-url - Yida URL 검증 도구',
    app_id: `
  앱 ID:    {0}`,
    form_uuid: '  폼 UUID: {0}',
    step_validate: `
📋 Step 0: URL 형식 검증`,
    validate_ok: '  ✅ 형식 검증 통과',
    validate_failed: '  ❌ 검증 실패: {0}',
    step_verify: `
🔍 Step 2: URL 검증`,
    sending_request: '  verifyShortUrl 요청 전송 중...',
    url_available: '  ✅ URL을 사용할 수 있습니다!',
    open_available_msg: '이 공개 접근 URL은 사용 가능합니다',
    share_available_msg: '이 조직 내 공유 URL은 사용 가능합니다',
    url_taken: '  ❌ URL이 이미 사용 중입니다',
    url_taken_msg: '이 단축 URL은 이미 사용 중입니다',
    verify_failed: '  ❌ 검증 요청 실패',
    err_url_prefix: 'URL은 /o/ 또는 /s/로 시작해야 합니다. 현재 값: {0}',
    err_url_chars: 'URL 경로는 a-z A-Z 0-9 _ -만 사용 가능합니다. 현재 값: {0}',
    err_url_empty: 'URL 경로가 비어 있습니다: {0}',
  },

  // ── lib/copy.js ────────────────────────────────────
  copy: {
    title: '  openyida copy - Yida 작업 디렉토리 초기화',
    package_root: `
📦 패키지 루트: {0}`,
    dest_base: '🤖 Target root: {0}',
    dest_root: '🤖 대상 루트: {0}',
    force_mode: '⚠️  --force 모드: 대상 디렉토리를 초기화 후 복사합니다',
    no_package: `
❌ openyida 패키지 디렉토리를 찾을 수 없습니다`,
    no_package_hint1: '   openyida가 전역으로 설치되어 있는지 확인하세요:',
    no_package_hint2: '   npm install -g openyida',
    no_ai_tool: `
❌ No active AI tool environment detected
   Supported tools: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder

   Current detection results:`,
    no_active_tool: `
❌ 활성 AI 도구 환경이 감지되지 않았습니다`,
    supported_tools: '   지원 도구: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder',
    current_result: `
   현재 감지 결과:`,
    force_hint: `
   현재 디렉토리에 강제 복사하려면:
   openyida copy --force`,
    force_cmd: '   openyida copy --force',
    copying: '    Copied: {0}',
    copying_label: `
📂 {0} 복사 중...`,
    creating_symlink: `
📂 yida-skills/ 심볼릭 링크 생성 중...`,
    file_copied: '    복사됨: {0}',
    cleared: '    🗑️  초기화됨: {0}',
    symlink_removed: '    🗑️  이전 심볼릭 링크 제거됨: {0}',
    old_symlink_removed: '    🗑️  Removed old symlink: {0}',
    dir_deleted: '    🗑️  디렉토리 삭제됨: {0}',
    removed: '    🗑️  제거됨: {0}',
    symlink_created: '    🔗 심볼릭 링크: {0} -> {1}',
    symlink_label: '심볼릭 링크',
    done: '✅ 완료!',
    files_copied: '   복사된 파일: {0}개',
    files_count: '{0}개 파일',
    symlinks_created: '   생성된 심볼릭 링크: {0}개',
    result_symlink: '   {0} → {1} (심볼릭 링크)',
    result_copy: '   {0} → {1} ({2}개 파일)',
    wukong_skills_cleanup: `
🗑️  Wukong 환경: yida-skills/ 심볼릭 링크 정리 중...`,
    wukong_skills_cleaned: '정리됨',
    wukong_skills_not_found: '    ℹ️  yida-skills/ 심볼릭 링크 또는 디렉토리를 찾을 수 없습니다: {0}',
    remove_failed: '    ❌ 제거 실패: {0} ({1})',
    symlink_fallback_copy: '    ⚠️  Windows 심볼릭 링크 생성 실패(관리자 권한 필요), 디렉토리 복사로 대체: {0}',
    symlink_failed: '    ❌ 심볼릭 링크 생성 실패: {0} ({1})',
  },

  // ── lib/check-update.js ─────────────────────────────
  check_update: {
    new_version: `
🎉 새 버전 사용 가능: {0} → {1}`,
  },

  // ── lib/compile.js ─────────────────────────────────
  compile: {
    usage: '사용법: openyida compile <소스 파일>',
    example: '예시: openyida compile pages/src/demo.js',
    source_not_found: '❌ 소스 파일이 존재하지 않습니다: {0}',
    success: '✅ 컴파일 완료!',
    output_file: '  출력 파일: {0}',
    exception: '\n❌ 컴파일 오류: {0}',
  },

  // ── lib/publish.js ─────────────────────────────────
  publish: {
    title: '  yida-publish - Yida 페이지 배포 도구',
    platform: '  플랫폼: {0}',
    base_url: `
  Platform: {0}`,
    app_type: '  App ID:   {0}',
    app_id: '  앱 ID:  {0}',
    form_uuid: '  폼 ID: {0}',
    source_file: '  소스 파일: {0}',
    compiled_file: '  출력 파일: {0}',
    output_dir: '  Output dir: pages/dist/',
    step_compile: `
📦 Step 1: 소스 컴파일 및 스키마 빌드
`,
    reading_source: '[1/4] {0} 소스 읽는 중...',
    compiling: '[2/4] Babel로 {0} 컴파일 중...',
    compile_failed: '  ❌ 컴파일 실패: {0}',
    compile_location: `
     위치: {0}행, {1}열`,
    compile_error_loc: '     Location: line {0}, column {1}',
    compile_error_code: '     오류 코드: {0}',
    minifying: '[3/4] UglifyJS로 {0} 압축 중...',
    minify_failed: '  압축 실패: {0}',
    uglifying: '[3/4] UglifyJS minifying → {0}...',
    uglify_failed: '  Minification failed: {0}',
    compile_done: '  ✅ 컴파일 완료: {0}',
    building_schema: '[4/4] 스키마 빌드 중...',
    schema_built: '  ✅ 스키마 빌드 완료!',
    step_login: `
🔑 Step 2: 로그인 정보 읽기`,
    step_publish: `
📤 Step 3: 스키마 배포
`,
    resend_save_csrf: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    resend_save: '  🔄 Resending saveFormSchema request after re-login...',
    csrf_retry: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    relogin_retry: '  🔄 Resending saveFormSchema request after re-login...',
    publish_failed: `
❌ 배포 실패: {0}`,
    schema_published: '  ✅ 스키마 배포 성공!',
    schema_success: '  ✅ Schema published successfully!',
    form_uuid_label: '  formUuid: {0}',
    version_label: '  version:  {0}',
    step_config: `
⚙️  Step 4: 폼 설정 업데이트
`,
    sending_config: '  Sending updateFormConfig request...',
    resend_config_csrf: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    resend_config: '  🔄 Resending updateFormConfig request after re-login...',
    config_csrf_retry: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    config_relogin_retry: '  🔄 Resending updateFormConfig request after re-login...',
    success: '  ✅ 배포 성공!',
    publish_success: '  ✅ Published successfully!',
    config_updated: '  Config updated: MINI_RESOURCE = 8',
    config_failed: '  ⚠️  설정 업데이트 실패: {0}',
    schema_ok_config_failed: '  Schema published, but config update failed',
    schema_published_config_failed: '  Schema published, but config update failed',
    exception: `
❌ 배포 오류: {0}`,
    error: `
❌ Publish error: {0}`,
    source_not_found: '❌ 소스 파일을 찾을 수 없습니다: {0}',
    usage: '사용법: openyida publish <appType> <formUuid> <소스 파일>',
    example: '예시: openyida publish APP_XXX FORM-XXX pages/src/xxx.js',
  },

  // ── lib/qr-login.js ────────────────────────────────
  qr_login: {
    title: '🔐 Yida 터미널 QR 코드 로그인',
    step_init: '  Step 1: 세션 초기화 중...',
    step_get_qr: '  Step 2: QR 코드 가져오는 중...',
    scan_hint: '  📱 DingTalk으로 아래 QR 코드를 스캔하세요:',
    qr_url_label: '  QR 코드 URL: {0}',
    waiting_scan: '  ⏳ 스캔 대기 중(최대 2분)...',
    scanned_confirm: '  ✅ QR 코드 스캔 완료! 휴대폰에서 로그인을 확인하세요...',
    scan_success: '  ✅ 스캔 확인 완료!',
    step_exchange: '  Step 4: 로그인 자격 증명 교환 중...',
    step_get_corps: '  Step 5: 조직 목록 가져오는 중...',
    step_switch_corp: '  Step 7: 선택한 조직으로 전환 중...',
    only_one_corp: '  ✅ 조직 1개 감지됨: {0}, 자동 선택',
    select_corp_prompt: '  🏢 여러 조직이 발견되었습니다. 선택하세요:',
    select_corp_input: '  번호 입력 (1-{0}): ',
    select_corp_invalid: '  ❌ 잘못된 입력입니다. 1에서 {0} 사이의 숫자를 입력하세요',
    corp_selected: '  ✅ 조직 선택됨: {0}',
    login_success: '✅ 로그인 성공!',
    qrcode_fallback: '  ⚠️  qrcode 패키지가 설치되지 않았습니다. 아래 URL을 직접 방문하세요:',
    qrcode_render_failed: '  ⚠️  QR 코드 렌더링 실패({0}). 아래 URL을 방문하세요:',
    get_qr_failed: 'Failed to parse QR code response: {0}',
    get_qr_api_failed: 'QR code API failed: {0}',
    get_qr_error: 'Failed to get QR code: {0}',
    qr_expired: 'QR 코드가 만료되었습니다. 다시 로그인하세요',
    poll_timeout: '스캔 타임아웃(2분). 다시 로그인하세요',
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
    no_corp_available: '접근 가능한 조직을 찾을 수 없습니다',
    no_csrf_in_cookie: '로그인 성공했지만 csrf_token을 찾을 수 없습니다. 다시 시도하세요',
    stdin_closed: '입력 스트림이 닫혔습니다. 조직을 선택할 수 없습니다',
  },

  // ── scripts/postinstall.js ─────────────────────────
  postinstall: {
    welcome_title: '  🎉 OpenYida에 오신 것을 환영합니다!                          ',
    install_success: '  ✅ 설치 완료! {0} Yida AI 개발 도구가 준비되었습니다.',
    update_success: '  ✅ 업데이트 완료! {0} OpenYida가 최신 버전으로 업그레이드되었습니다.',
    ai_mode_title: '  🚀 AI 대화 모드',
    ai_mode_desc: '  Claude Code / Aone Copilot / Cursor 등 AI 도구에서 바로 대화하세요:',
    prompt1: '  📋  "Yida로 근태 관리 시스템을 만들어줘"',
    prompt2: '  💰  "개인 급여 계산기 앱을 만들어줘"',
    prompt3: '  🏢  "CRM 고객 관리 시스템을 만들어줘"',
    prompt4: '  🎂  "생일 축하 미니 앱을 만들어줘"',
    steps_title: '  📖 시작하기',
    step1: '  {0}Step 1{1}  AI 코딩 도구 열기 (Claude Code / Cursor 등)',
    step2: '  {0}Step 2{1}  원하는 앱을 자연어로 설명하기',
    step3: '  {0}Step 3{1}  AI가 자동으로 openyida 명령어를 실행하여 앱 생성 및 배포',
    step4: '  {0}Step 4{1}  Yida 앱 링크 받기 🎉',
    commands_title: '  ⚡ 빠른 명령어',
    cmd_env: '  {0}openyida env{1}      {2}# AI 도구 환경 및 로그인 상태 감지{3}',
    cmd_login: '  {0}openyida login{1}    {2}# Yida 로그인{3}',
    cmd_help: '  {0}openyida --help{1}   {2}# 모든 명령어 보기{3}',
    footer1: '  📚 문서: https://github.com/openyida/openyida',
    footer2: '  💬 커뮤니티: DingTalk에서 OpenYida 커뮤니티 참여',
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
    config_load_error: 'CDN 설정 로드 실패: {0}',
    config_saved: '✅ CDN 설정이 저장되었습니다: {0}',
    config_usage: '사용법: openyida cdn-config [옵션]',
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
    config_file_path: '📄 설정 파일: {0}',
    config_section_aliyun: '🔐 알리바바 클라우드 자격 증명',
    config_section_cdn: '🌐 CDN 설정',
    config_section_oss: '📦 OSS 설정',
    config_section_upload: '📤 업로드 설정',
    config_cdn_domain: 'CDN 도메인',
    config_oss_region: 'OSS 리전',
    config_oss_bucket: 'OSS 버킷',
    config_oss_endpoint: 'OSS 엔드포인트',
    config_upload_path: '업로드 경로',
    config_compress: '이미지 압축',
    config_max_width: '최대 너비',
    config_quality: '이미지 품질',
    config_not_set: '설정 안 됨',
    config_enabled: '활성화',
    config_disabled: '비활성화',
    config_status_valid: '✅ 설정 완료, 사용 가능',
    config_status_invalid: '⚠️  설정 불완전',
    config_missing: '   누락된 필드: {0}',
    config_updated: '✅ 설정이 업데이트되었습니다!',
    config_init_title: '🔧 CDN 설정 초기화 마법사',
    config_init_desc: 'CDN 이미지 업로드를 사용하려면 다음을 설정하세요:',
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
    upload_no_files: '❌ 업로드할 이미지 파일을 지정하세요',
    config_incomplete: '❌ CDN 설정이 불완전합니다',
    missing_fields: '   누락된 필드: {0}',
    run_config_init: '   먼저 실행하세요: openyida cdn-config --init',
    no_config: '❌ CDN 설정을 찾을 수 없습니다',
    oss_sdk_required: '❌ ali-oss SDK가 없습니다',
    run_npm_install: '   실행하세요: npm install {0}',
    no_images_found: '❌ 지원되는 이미지 파일을 찾을 수 없습니다',
    uploading_images: '📤 {0}개 이미지 업로드 중...',
    uploading_file: '   업로드 중: {0}',
    upload_success: '   ✅ {0}',
    upload_failed: '   ❌ {0} 업로드 실패: {1}',
    upload_summary: `
📊 업로드 요약`,
    upload_success_count: '   성공: {0}개',
    upload_fail_count: '   실패: {0}개',
    cdn_urls: `
🔗 CDN URL 목록:`,
    upload_error: '❌ 업로드 실패: {0}',
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
    refresh_no_targets: '❌ 새로 고칠 URL 또는 디렉토리를 지정하세요',
    cdn_sdk_required: '❌ 알리바바 클라우드 CDN SDK가 없습니다',
    querying_quota: '📊 새로 고침 할당량 조회 중...',
    quota_info: '   URL 새로 고침: {0}/일, {1}개 남음 | 디렉토리 새로 고침: {2}/일, {3}개 남음',
    quota_query_failed: '   ⚠️  Failed to query quota: {0}',
    refreshing_urls: '🔄 {0}개 URL 새로 고침 중...',
    refreshing_paths: '🔄 {0}개 디렉토리 새로 고침 중...',
    refresh_task_id: '   ✅ 작업 ID: {0}',
    refresh_urls_failed: '   ❌ URL 새로 고침 실패: {0}',
    refresh_paths_failed: '   ❌ 디렉토리 새로 고침 실패: {0}',
    refresh_summary: `
📊 새로 고침 요약`,
    url_refresh_success: '   ✅ URL 새로 고침 성공, 작업 ID: {0}',
    path_refresh_success: '   ✅ 디렉토리 새로 고침 성공, 작업 ID: {0}',
    refresh_error: '❌ 새로 고침 실패: {0}',
    file_not_found: '❌ 파일을 찾을 수 없습니다: {0}',
  },

  // ── src/flash-note/flash-to-prd.ts ──────────────
  flash_to_prd: {
    title: '📋 DingTalk 플래시 노트를 PRD로 변환',
    help_usage: '사용법: openyida flash-to-prd --file <경로> [--name <프로젝트명>]',
    help_usage2: '        openyida flash-to-prd --name <프로젝트명>  (표준 입력에서 읽기)',
    help_args_title: '인수:',
    help_arg_file: '  --file, -f <경로>       플래시 노트 파일 경로 (.txt / .md)',
    help_arg_name: '  --name, -n <이름>       프로젝트 이름 (선택, 내용에서 자동 추출)',
    help_arg_max_tokens: '  --max-tokens <수>       AI 최대 출력 토큰 수 (기본값 8000)',
    help_examples_title: '예시:',
    help_example1: '  openyida flash-to-prd --file ./meeting-notes.txt --name "장비점검시스템"',
    help_example2: '  cat meeting.txt | openyida flash-to-prd --name "장비점검시스템"',
    step_read: '[Step 1] 플래시 노트 내용 읽는 중...',
    file_not_found: '파일을 찾을 수 없습니다: {0}',
    no_input: '플래시 노트 내용이 제공되지 않았습니다. --file로 파일을 지정하거나 파이프로 입력하세요.',
    stdin_empty: '표준 입력이 비어 있습니다',
    read_success: '✅ 읽기 성공, {0}자',
    step_load_module: '[Step 2] 프롬프트 빌더 모듈 로딩 중...',
    module_loaded_builtin: '✅ 내장 프롬프트 모듈 로드됨',
    module_loaded_local: '✅ 로컬 프롬프트 모듈 로드됨: {0}',
    module_not_found: '❌ build-flash-note-prompt.js 모듈을 찾을 수 없습니다',
    module_path_tried: '  시도한 경로 {0}: {1}',
    step_preprocess: '[Step 3] 전처리 + 회의 인식...',
    preprocess_result: '  전처리: {0}자 → {1}자',
    meeting_meta: '  회의 메타정보: {0}개 항목{1}',
    a1_sections: '  A1 요약 섹션: {0}개{1}',
    speakers: '  발언자 식별: {0}명{1}',
    speakers_with_role: ' (역할 주석 {0}명 포함)',
    step_login: '[Step 4] 로그인 상태 확인 중...',
    no_login: '  로그인 세션을 찾을 수 없습니다, 로그인 시작...',
    login_ready: '✅ 로그인 준비 완료 ({0})',
    step_ai: '[Step 5] AI로 PRD 생성 중...',
    single_segment: '  단일 세그먼트 모드, 프롬프트 길이: {0}자',
    multi_segment: '  다중 세그먼트 모드, 총 {0}개 세그먼트',
    extracting_segment: '  세그먼트 {0}/{1} 추출 중 ({2}자)...',
    merging_segments: '  세그먼트 결과 병합 중...',
    ai_success: '✅ PRD 생성 성공',
    ai_error: 'AI API 호출 실패: {0}',
    done: '✅ 플래시 노트에서 PRD 변환 완료',
    done_project: '  프로젝트 이름: {0}',
    done_file: '  출력 파일: {0}',
    done_size: '  파일 크기: {0}자',
    done_meeting: '  회의 인식: 메타정보 {0}개, A1 요약 {1}개, 발언자 {2}명',
  },
};
