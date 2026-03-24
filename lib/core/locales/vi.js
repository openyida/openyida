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
  compile <tệpNguồn>                                           Chỉ biên dịch JSX (không xuất bản, đầu ra tại pages/dist/)
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
    integration_help: `Cách dùng: openyida integration <lệnh con> [tham số]

Lệnh con:
  create <appType> <formUuid> <flowName> [tùy chọn]   Tạo tích hợp & tự động hóa (luồng logic)

Ví dụ:
  openyida integration create APP_XXX FORM-XXX "Thông báo bản ghi mới" --receivers user123 --publish`,
    integration_unknown: 'Lệnh con integration không xác định: {0}',
    integration_help_hint: 'Dùng openyida integration --help để xem các lệnh con có sẵn',
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
    title: '  openyida env - Phát hiện môi trường công cụ AI',
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
    logged_in: 'Đã đăng nhập',
    base_url_label: '  Domain:       {0}',
    corp_id_label: '  Org ID:       {0}',
    user_id_label: '  User ID:      {0}',
    csrf_label: '  csrf_token:   {0}...',
    not_logged_in: 'Chưa đăng nhập',
    unknown: '(unknown)',
  },

  // ── lib/login.js ────────────────────────────────────
  login: {
    title: '🔐 Đăng nhập Yida',
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
    title: '  create-app - Công cụ tạo ứng dụng Yida',
    usage: 'Cách dùng: openyida create-app <tên ứng dụng>',
    example: 'Ví dụ: openyida create-app "Ứng dụng của tôi"',
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
  Tên ứng dụng: {0}`,
    app_desc: '  Description: {0}',
    app_icon: '  Icon:        {0} ({1})',
    app_theme: '  Theme:       {0}',
    step_create: `
🚀 Đang tạo ứng dụng...`,
    success: '  ✅ Tạo ứng dụng thành công!',
    app_type_label: '  appType: {0}',
    corp_id_label: '  corpId:  {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ Tạo thất bại: {0}',
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
    title: '  create-page - Công cụ tạo trang tùy chỉnh Yida',
    usage: 'Cách dùng: openyida create-page <appType> <tên trang>',
    example: 'Example: yidacli create-page "APP_XXX" "Game Home"',
    app_id: `
  ID ứng dụng:  {0}`,
    page_name: '  Tên trang:    {0}',
    step_create: `
📄 Đang tạo trang tùy chỉnh...`,
    sending: '  Sending saveFormSchemaInfo request...',
    success: '  ✅ Tạo trang tùy chỉnh thành công!',
    page_id_label: '  pageId: {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ Tạo thất bại: {0}',
    datasource_injecting: '  [datasource] Đang chèn {0} nguồn dữ liệu connector...',
    datasource_success: '  [datasource] Chèn nguồn dữ liệu thành công',
    datasource_failed: '  [datasource] Chèn nguồn dữ liệu thất bại: {0}',
    invalid_response: '❌ Tạo trang thất bại: pageId không hợp lệ được trả về từ máy chủ, vui lòng kiểm tra appType có đúng không',
  },

  // ── lib/get-schema.js ───────────────────────────────
  get_schema: {
    title: '  get-schema - Công cụ lấy schema biểu mẫu Yida',
    usage: 'Cách dùng: openyida get-schema <appType> <formUuid>',
    example: 'Example: yidacli get-schema "APP_XXX" "FORM-XXX"',
    app_id: `
  ID ứng dụng:  {0}`,
    form_uuid: '  UUID biểu mẫu: {0}',
    step_get: `
📋 Đang lấy schema biểu mẫu...`,
    sending: '  Sending getFormSchema request...',
    success: '  ✅ Lấy schema thành công!',
    failed: '  ❌ Lấy thất bại: {0}',
  },

  // ── lib/create-form.js ──────────────────────────────
  create_form: {
    error: `
❌ Lỗi tạo biểu mẫu: {0}`,
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
    usage: 'Cách dùng: openyida get-page-config <appType> <formUuid>',
    example: 'Example: yidacli get-page-config APP_XXX FORM-XXX',
    title: '  get-page-config - Công cụ lấy cấu hình trang Yida',
    app_id: `
  ID ứng dụng:  {0}`,
    form_uuid: '  UUID biểu mẫu: {0}',
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
    usage: 'Cách dùng: openyida save-share-config <appType> <formUuid> <openUrl> <isOpen> [openAuth]',
    example: 'Example: node save-share-config.js "APP_XXX" "FORM-XXX" "/o/xxx" "y" "n"',
    is_open_hint: '  isOpen: y=enable public access, n=disable public access',
    open_auth_hint: '  openAuth: y=require auth, n=no auth required (default)',
    title: '  save-share-config - Công cụ lưu cấu hình truy cập công khai Yida',
    app_id: `
  ID ứng dụng:  {0}`,
    form_uuid: '  UUID biểu mẫu: {0}',
    open_url: '  URL công khai: {0}',
    is_open: '  Truy cập công khai: {0}',
    open_auth: '  Yêu cầu xác thực: {0}',
    step_validate: `
📋 Step 0: Xác thực tham số`,
    validate_ok: '  ✅ Xác thực thành công',
    validate_failed: '  ❌ Xác thực thất bại: {0}',
    step_save: `
💾 Step 2: Lưu cấu hình truy cập công khai`,
    sending_request: '  Đang gửi yêu cầu saveShareConfig...',
    save_ok: '  ✅ Lưu cấu hình thành công!',
    save_ok_msg: 'Đã lưu cấu hình truy cập công khai',
    save_failed: '  ❌ Lưu thất bại: {0}',
    save_failed_msg: 'Lưu thất bại',
    err_is_open_invalid: 'isOpen phải là y hoặc n. Giá trị hiện tại: {0}',
    err_open_auth_invalid: 'openAuth phải là y hoặc n. Giá trị hiện tại: {0}',
    err_open_url_required: 'openUrl là bắt buộc khi bật truy cập công khai',
    err_open_url_prefix: 'openUrl phải bắt đầu bằng /o/. Giá trị hiện tại: {0}',
    err_open_url_chars: 'Đường dẫn openUrl chỉ hỗ trợ a-z A-Z 0-9 _ -. Giá trị hiện tại: {0}',
  },

  // ── lib/update-form-config.js ──────────────────────
  update_form_config: {
    usage: 'Cách dùng: openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    example: 'Example: node update-form-config.js "APP_XXX" "FORM_XXX" "false" "My Page"',
    params_label: 'Parameters:',
    param_is_render_nav: '  isRenderNav: true=show top nav, false=hide top nav',
    param_title: '  title: page title (required)',
    title: '  update-form-config - Công cụ cập nhật cấu hình biểu mẫu Yida',
    app_id: `
  ID ứng dụng:  {0}`,
    form_uuid: '  UUID biểu mẫu: {0}',
    is_render_nav: '  Hiển thị nav: {0}',
    page_title: '  Tiêu đề trang: {0}',
    step_update: `
💾 Step 2: Cập nhật cấu hình biểu mẫu`,
    sending_request: '  Đang gửi yêu cầu updateFormSchemaInfo...',
    update_ok: '  ✅ Cập nhật cấu hình thành công!',
    nav_shown: 'Đã hiển thị thanh điều hướng trên cùng',
    nav_hidden: 'Đã ẩn thanh điều hướng trên cùng',
    update_failed: '  ❌ Cập nhật thất bại: {0}',
    update_failed_msg: 'Cập nhật thất bại',
  },

  // ── lib/verify-short-url.js ────────────────────────
  verify_short_url: {
    usage: 'Cách dùng: openyida verify-short-url <appType> <formUuid> <url>',
    example: 'Example: node verify-short-url.js "APP_XXX" "FORM-XXX" "/o/aaa"',
    formats_label: '  Supported formats:',
    format_open: '    /o/xxx - public access (external)',
    format_share: '    /s/xxx - org share (internal)',
    open_url_label: 'Public access URL',
    share_url_label: 'Org share URL',
    title: '  verify-short-url - Công cụ xác minh URL Yida',
    app_id: `
  ID ứng dụng:  {0}`,
    form_uuid: '  UUID biểu mẫu: {0}',
    step_validate: `
📋 Step 0: Xác thực định dạng URL`,
    validate_ok: '  ✅ Định dạng hợp lệ',
    validate_failed: '  ❌ Xác thực thất bại: {0}',
    step_verify: `
🔍 Step 2: Xác minh URL`,
    sending_request: '  Đang gửi yêu cầu verifyShortUrl...',
    url_available: '  ✅ URL có thể sử dụng!',
    open_available_msg: 'URL truy cập công khai này có thể sử dụng',
    share_available_msg: 'URL chia sẻ nội bộ này có thể sử dụng',
    url_taken: '  ❌ URL đã được sử dụng',
    url_taken_msg: 'URL rút gọn này đã được sử dụng',
    verify_failed: '  ❌ Yêu cầu xác minh thất bại',
    err_url_prefix: 'URL phải bắt đầu bằng /o/ hoặc /s/. Giá trị hiện tại: {0}',
    err_url_chars: 'Đường dẫn URL chỉ hỗ trợ a-z A-Z 0-9 _ -. Giá trị hiện tại: {0}',
    err_url_empty: 'Đường dẫn URL không được để trống: {0}',
  },

  // ── lib/copy.js ────────────────────────────────────
  copy: {
    title: '  openyida copy - Khởi tạo thư mục làm việc Yida',
    package_root: `
📦 Thư mục gốc gói: {0}`,
    dest_base: '🤖 Target root: {0}',
    dest_root: '🤖 Thư mục đích: {0}',
    force_mode: '⚠️  Chế độ --force: thư mục đích sẽ được xóa trước khi sao chép',
    no_package: `
❌ Không tìm thấy thư mục gói openyida`,
    no_package_hint1: '   Hãy đảm bảo openyida đã được cài đặt toàn cục:',
    no_package_hint2: '   npm install -g openyida',
    no_ai_tool: `
❌ No active AI tool environment detected
   Supported tools: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder

   Current detection results:`,
    no_active_tool: `
❌ Không phát hiện môi trường công cụ AI nào đang hoạt động`,
    supported_tools: '   Công cụ hỗ trợ: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder',
    current_result: `
   Kết quả phát hiện hiện tại:`,
    force_hint: `
   Để buộc sao chép vào thư mục hiện tại:
   openyida copy --force`,
    force_cmd: '   openyida copy --force',
    copying: '    Copied: {0}',
    copying_label: `
📂 Đang sao chép {0}...`,
    creating_symlink: `
📂 Đang tạo liên kết tượng trưng yida-skills/...`,
    file_copied: '    Đã sao chép: {0}',
    cleared: '    🗑️  Đã xóa: {0}',
    symlink_removed: '    🗑️  Đã xóa liên kết tượng trưng cũ: {0}',
    old_symlink_removed: '    🗑️  Removed old symlink: {0}',
    dir_deleted: '    🗑️  Đã xóa thư mục: {0}',
    removed: '    🗑️  Đã xóa: {0}',
    symlink_created: '    🔗 Liên kết tượng trưng: {0} -> {1}',
    symlink_label: 'liên kết tượng trưng',
    done: '✅ Hoàn thành!',
    files_copied: '   Tệp đã sao chép: {0}',
    files_count: '{0} tệp',
    symlinks_created: '   Liên kết tượng trưng đã tạo: {0}',
    result_symlink: '   {0} → {1} (liên kết tượng trưng)',
    result_copy: '   {0} → {1} ({2} tệp)',
    wukong_skills_cleanup: `
🗑️  Môi trường Wukong: Đang dọn dẹp liên kết tượng trưng yida-skills/...`,
    wukong_skills_cleaned: 'đã dọn dẹp',
    wukong_skills_not_found: '    ℹ️  Không tìm thấy liên kết tượng trưng hoặc thư mục yida-skills/: {0}',
    remove_failed: '    ❌ Xóa thất bại: {0} ({1})',
    symlink_fallback_copy: '    ⚠️  Tạo liên kết tượng trưng Windows thất bại (cần quyền admin), sử dụng sao chép thư mục: {0}',
    symlink_failed: '    ❌ Tạo liên kết tượng trưng thất bại: {0} ({1})',
  },

  // ── lib/check-update.js ─────────────────────────────
  check_update: {
    new_version: `
🎉 Phiên bản mới có sẵn: {0} → {1}`,
  },

  // ── lib/compile.js ─────────────────────────────────
  compile: {
    usage: 'Cách dùng: openyida compile <tệp-nguồn>',
    example: 'Ví dụ: openyida compile pages/src/demo.js',
    source_not_found: '❌ Không tìm thấy tệp nguồn: {0}',
    success: '✅ Biên dịch hoàn tất!',
    output_file: '  Tệp đầu ra: {0}',
    exception: '\n❌ Lỗi biên dịch: {0}',
  },

  // ── lib/publish.js ─────────────────────────────────
  publish: {
    title: '  yida-publish - Công cụ xuất bản trang Yida',
    platform: '  Nền tảng: {0}',
    base_url: `
  Platform: {0}`,
    app_type: '  App ID:   {0}',
    app_id: '  ID ứng dụng: {0}',
    form_uuid: '  ID biểu mẫu: {0}',
    source_file: '  Nguồn: {0}',
    compiled_file: '  Đầu ra: {0}',
    output_dir: '  Output dir: pages/dist/',
    step_compile: `
📦 Step 1: Biên dịch nguồn và xây dựng schema
`,
    reading_source: '[1/4] Đang đọc nguồn {0}...',
    compiling: '[2/4] Đang biên dịch {0} với Babel...',
    compile_failed: '  ❌ Biên dịch thất bại: {0}',
    compile_location: `
     Vị trí: dòng {0}, cột {1}`,
    compile_error_loc: '     Location: line {0}, column {1}',
    compile_error_code: '     Mã lỗi: {0}',
    minifying: '[3/4] Đang nén với UglifyJS → {0}...',
    minify_failed: '  Nén thất bại: {0}',
    uglifying: '[3/4] UglifyJS minifying → {0}...',
    uglify_failed: '  Minification failed: {0}',
    compile_done: '  ✅ Biên dịch hoàn thành: {0}',
    building_schema: '[4/4] Đang xây dựng schema...',
    schema_built: '  ✅ Xây dựng schema thành công!',
    step_login: `
🔑 Step 2: Đọc thông tin đăng nhập`,
    step_publish: `
📤 Step 3: Xuất bản schema
`,
    resend_save_csrf: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    resend_save: '  🔄 Resending saveFormSchema request after re-login...',
    csrf_retry: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    relogin_retry: '  🔄 Resending saveFormSchema request after re-login...',
    publish_failed: `
❌ Xuất bản thất bại: {0}`,
    schema_published: '  ✅ Xuất bản schema thành công!',
    schema_success: '  ✅ Schema published successfully!',
    form_uuid_label: '  formUuid: {0}',
    version_label: '  version:  {0}',
    step_config: `
⚙️  Step 4: Cập nhật cấu hình biểu mẫu
`,
    sending_config: '  Sending updateFormConfig request...',
    resend_config_csrf: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    resend_config: '  🔄 Resending updateFormConfig request after re-login...',
    config_csrf_retry: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    config_relogin_retry: '  🔄 Resending updateFormConfig request after re-login...',
    success: '  ✅ Xuất bản thành công!',
    publish_success: '  ✅ Published successfully!',
    config_updated: '  Config updated: MINI_RESOURCE = 8',
    config_failed: '  ⚠️  Cập nhật cấu hình thất bại: {0}',
    schema_ok_config_failed: '  Schema published, but config update failed',
    schema_published_config_failed: '  Schema published, but config update failed',
    exception: `
❌ Lỗi xuất bản: {0}`,
    error: `
❌ Publish error: {0}`,
    source_not_found: '❌ Không tìm thấy tệp nguồn: {0}',
    usage: 'Cách dùng: openyida publish <appType> <formUuid> <tệpNguồn>',
    example: 'Ví dụ: openyida publish APP_XXX FORM-XXX pages/src/xxx.js',
  },

  // ── lib/qr-login.js ────────────────────────────────
  qr_login: {
    title: '🔐 Đăng nhập Yida bằng mã QR trên terminal',
    step_init: '  Step 1: Đang khởi tạo phiên...',
    step_get_qr: '  Step 2: Đang lấy mã QR...',
    scan_hint: '  📱 Vui lòng quét mã QR bên dưới bằng DingTalk:',
    qr_url_label: '  URL mã QR: {0}',
    waiting_scan: '  ⏳ Đang chờ quét (tối đa 2 phút)...',
    scanned_confirm: '  ✅ Đã quét mã QR! Vui lòng xác nhận đăng nhập trên điện thoại...',
    scan_success: '  ✅ Đã xác nhận quét!',
    step_exchange: '  Step 4: Đang trao đổi thông tin đăng nhập...',
    step_get_corps: '  Step 5: Đang lấy danh sách tổ chức...',
    step_switch_corp: '  Step 7: Đang chuyển sang tổ chức đã chọn...',
    only_one_corp: '  ✅ Phát hiện một tổ chức: {0}, tự động chọn',
    select_corp_prompt: '  🏢 Tìm thấy nhiều tổ chức, vui lòng chọn một:',
    select_corp_input: '  Nhập số (1-{0}): ',
    select_corp_invalid: '  ❌ Đầu vào không hợp lệ, vui lòng nhập số từ 1 đến {0}',
    corp_selected: '  ✅ Đã chọn tổ chức: {0}',
    login_success: '✅ Đăng nhập thành công!',
    qrcode_fallback: '  ⚠️  Gói qrcode chưa được cài đặt, vui lòng truy cập URL bên dưới thủ công:',
    qrcode_render_failed: '  ⚠️  Hiển thị mã QR thất bại ({0}), vui lòng truy cập URL bên dưới:',
    get_qr_failed: 'Failed to parse QR code response: {0}',
    get_qr_api_failed: 'QR code API failed: {0}',
    get_qr_error: 'Failed to get QR code: {0}',
    qr_expired: 'Mã QR đã hết hạn, vui lòng đăng nhập lại',
    poll_timeout: 'Hết thời gian chờ quét (2 phút), vui lòng đăng nhập lại',
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
    no_corp_available: 'Không tìm thấy tổ chức nào có thể truy cập',
    no_csrf_in_cookie: 'Đăng nhập thành công nhưng không tìm thấy csrf_token, vui lòng thử lại',
    stdin_closed: 'Luồng đầu vào đã đóng, không thể chọn tổ chức',
  },

  // ── scripts/postinstall.js ─────────────────────────
  postinstall: {
    welcome_title: '  🎉 Chào mừng đến với OpenYida!                               ',
    install_success: '  ✅ Cài đặt hoàn tất! {0} Công cụ phát triển AI Yida đã sẵn sàng.',
    update_success: '  ✅ Cập nhật hoàn tất! {0} OpenYida đã được nâng cấp lên phiên bản mới nhất.',
    ai_mode_title: '  🚀 Chế độ hội thoại AI',
    ai_mode_desc: '  Trong Claude Code / Aone Copilot / Cursor, hãy trò chuyện trực tiếp:',
    prompt1: '  📋  "Tạo cho tôi hệ thống quản lý chấm công với Yida"',
    prompt2: '  💰  "Xây dựng ứng dụng tính lương cá nhân"',
    prompt3: '  🏢  "Tạo hệ thống CRM quản lý khách hàng"',
    prompt4: '  🎂  "Làm mini-app chúc mừng sinh nhật"',
    steps_title: '  📖 Bắt đầu',
    step1: '  {0}Step 1{1}  Mở công cụ AI của bạn (Claude Code / Cursor, v.v.)',
    step2: '  {0}Step 2{1}  Mô tả ứng dụng bạn muốn bằng ngôn ngữ tự nhiên',
    step3: '  {0}Step 3{1}  AI tự động chạy các lệnh openyida để tạo và xuất bản',
    step4: '  {0}Step 4{1}  Nhận liên kết ứng dụng Yida của bạn 🎉',
    commands_title: '  ⚡ Lệnh nhanh',
    cmd_env: '  {0}openyida env{1}      {2}# Phát hiện môi trường công cụ AI và trạng thái đăng nhập{3}',
    cmd_login: '  {0}openyida login{1}    {2}# Đăng nhập Yida{3}',
    cmd_help: '  {0}openyida --help{1}   {2}# Xem tất cả lệnh{3}',
    footer1: '  📚 Tài liệu: https://github.com/openyida/openyida',
    footer2: '  💬 Cộng đồng: Tham gia cộng đồng OpenYida trên DingTalk',
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
    config_load_error: 'Tải cấu hình CDN thất bại: {0}',
    config_saved: '✅ Cấu hình CDN đã được lưu vào: {0}',
    config_usage: 'Cách dùng: openyida cdn-config [tùy chọn]',
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
    config_file_path: '📄 Tệp cấu hình: {0}',
    config_section_aliyun: '🔐 Thông tin xác thực Alibaba Cloud',
    config_section_cdn: '🌐 Cấu hình CDN',
    config_section_oss: '📦 Cấu hình OSS',
    config_section_upload: '📤 Cấu hình tải lên',
    config_cdn_domain: 'Tên miền CDN',
    config_oss_region: 'Khu vực OSS',
    config_oss_bucket: 'Bucket OSS',
    config_oss_endpoint: 'Endpoint OSS',
    config_upload_path: 'Đường dẫn tải lên',
    config_compress: 'Nén ảnh',
    config_max_width: 'Chiều rộng tối đa',
    config_quality: 'Chất lượng ảnh',
    config_not_set: 'Chưa cài đặt',
    config_enabled: 'Đã bật',
    config_disabled: 'Đã tắt',
    config_status_valid: '✅ Cấu hình đầy đủ, sẵn sàng sử dụng',
    config_status_invalid: '⚠️  Cấu hình chưa đầy đủ',
    config_missing: '   Trường còn thiếu: {0}',
    config_updated: '✅ Cấu hình đã được cập nhật!',
    config_init_title: '🔧 Trình hướng dẫn khởi tạo CDN',
    config_init_desc: 'Để sử dụng tải ảnh CDN, hãy cấu hình các mục sau:',
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
    upload_no_files: '❌ Vui lòng chỉ định tệp ảnh để tải lên',
    config_incomplete: '❌ Cấu hình CDN chưa đầy đủ',
    missing_fields: '   Trường còn thiếu: {0}',
    run_config_init: '   Vui lòng chạy trước: openyida cdn-config --init',
    no_config: '❌ Không tìm thấy cấu hình CDN',
    oss_sdk_required: '❌ Thiếu SDK ali-oss',
    run_npm_install: '   Chạy: npm install {0}',
    no_images_found: '❌ Không tìm thấy tệp ảnh được hỗ trợ',
    uploading_images: '📤 Đang tải lên {0} ảnh...',
    uploading_file: '   Đang tải: {0}',
    upload_success: '   ✅ {0}',
    upload_failed: '   ❌ {0} tải lên thất bại: {1}',
    upload_summary: `
📊 Tóm tắt tải lên`,
    upload_success_count: '   Thành công: {0}',
    upload_fail_count: '   Thất bại: {0}',
    cdn_urls: `
🔗 Danh sách URL CDN:`,
    upload_error: '❌ Tải lên thất bại: {0}',
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
    refresh_no_targets: '❌ Vui lòng chỉ định URL hoặc thư mục để làm mới',
    cdn_sdk_required: '❌ Thiếu SDK CDN Alibaba Cloud',
    querying_quota: '📊 Đang truy vấn hạn mức làm mới...',
    quota_info: '   Làm mới URL: {0}/ngày, còn {1} | Thư mục: {2}/ngày, còn {3}',
    quota_query_failed: '   ⚠️  Failed to query quota: {0}',
    refreshing_urls: '🔄 Đang làm mới {0} URL...',
    refreshing_paths: '🔄 Đang làm mới {0} thư mục...',
    refresh_task_id: '   ✅ ID tác vụ: {0}',
    refresh_urls_failed: '   ❌ Làm mới URL thất bại: {0}',
    refresh_paths_failed: '   ❌ Làm mới thư mục thất bại: {0}',
    refresh_summary: `
📊 Tóm tắt làm mới`,
    url_refresh_success: '   ✅ Làm mới URL thành công, ID tác vụ: {0}',
    path_refresh_success: '   ✅ Làm mới thư mục thành công, ID tác vụ: {0}',
    refresh_error: '❌ Làm mới thất bại: {0}',
    file_not_found: '❌ Không tìm thấy tệp: {0}',
  },

  // ── src/flash-note/flash-to-prd.ts ──────────────
  flash_to_prd: {
    title: '📋 Ghi chu nhanh DingTalk sang PRD',
    help_usage: 'Cach dung: openyida flash-to-prd --file <duong-dan> [--name <ten-du-an>]',
    help_usage2: '           openyida flash-to-prd --name <ten-du-an>  (doc tu stdin)',
    help_args_title: 'Tham so:',
    help_arg_file: '  --file, -f <duong dan>  Duong dan file ghi chu nhanh (.txt / .md)',
    help_arg_name: '  --name, -n <ten>        Ten du an (tuy chon, tu dong trich xuat)',
    help_arg_max_tokens: '  --max-tokens <so>       Token dau ra AI toi da (mac dinh 8000)',
    help_examples_title: 'Vi du:',
    help_example1: '  openyida flash-to-prd --file ./meeting-notes.txt --name "Kiem tra thiet bi"',
    help_example2: '  cat meeting.txt | openyida flash-to-prd --name "Kiem tra thiet bi"',
    step_read: '[Buoc 1] Dang doc noi dung ghi chu nhanh...',
    file_not_found: 'Khong tim thay file: {0}',
    no_input: 'Khong co noi dung ghi chu nhanh. Dung --file de chi dinh file hoac chuyen huong noi dung qua stdin.',
    stdin_empty: 'Dau vao tieu chuan trong',
    read_success: '✅ Doc thanh cong, {0} ky tu',
    step_load_module: '[Buoc 2] Dang tai module xay dung prompt...',
    module_loaded_builtin: '✅ Da tai module prompt tich hop',
    module_loaded_local: '✅ Da tai module prompt cuc bo: {0}',
    module_not_found: '❌ Khong tim thay module build-flash-note-prompt.js',
    module_path_tried: '  Duong dan da thu {0}: {1}',
    step_preprocess: '[Buoc 3] Tien xu ly + nhan dang cuoc hop...',
    preprocess_result: '  Tien xu ly: {0} ky tu -> {1} ky tu',
    meeting_meta: '  Thong tin cuoc hop: {0} truong{1}',
    a1_sections: '  Phan tom tat A1: {0}{1}',
    speakers: '  Nguoi phat bieu: {0}{1}',
    speakers_with_role: ' (co {0} chu thich vai tro)',
    step_login: '[Buoc 4] Kiem tra trang thai dang nhap...',
    no_login: '  Khong tim thay phien dang nhap, bat dau dang nhap...',
    login_ready: '✅ Dang nhap san sang ({0})',
    step_ai: '[Buoc 5] Goi AI de tao PRD...',
    single_segment: '  Che do doan don, do dai prompt: {0} ky tu',
    multi_segment: '  Che do da doan, tong cong {0} doan',
    extracting_segment: '  Dang trich xuat doan {0}/{1} ({2} ky tu)...',
    merging_segments: '  Dang hop nhat ket qua cac doan...',
    ai_success: '✅ Tao PRD thanh cong',
    ai_error: 'Goi API AI that bai: {0}',
    done: '✅ Chuyen doi ghi chu nhanh sang PRD hoan tat',
    done_project: '  Ten du an: {0}',
    done_file: '  File dau ra: {0}',
    done_size: '  Kich thuoc file: {0} ky tu',
    done_meeting: '  Nhan dang cuoc hop: {0} thong tin, {1} phan A1, {2} nguoi phat bieu',
  },
};
