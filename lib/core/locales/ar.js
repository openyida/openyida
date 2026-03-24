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
  compile <sourceFile>                                         تجميع JSX فقط (بدون نشر، الإخراج في pages/dist/)
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
    integration_help: `الاستخدام: openyida integration <أمر فرعي> [وسائط]

الأوامر الفرعية:
  create <appType> <formUuid> <flowName> [خيارات]   إنشاء تكامل وأتمتة (تدفق منطقي)

أمثلة:
  openyida integration create APP_XXX FORM-XXX "إشعار سجل جديد" --receivers user123 --publish`,
    integration_unknown: 'أمر فرعي integration غير معروف: {0}',
    integration_help_hint: 'استخدم openyida integration --help لرؤية الأوامر الفرعية المتاحة',
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
    title: '  openyida env - اكتشاف بيئة أداة الذكاء الاصطناعي',
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
    logged_in: 'مسجّل الدخول',
    base_url_label: '  Domain:       {0}',
    corp_id_label: '  Org ID:       {0}',
    user_id_label: '  User ID:      {0}',
    csrf_label: '  csrf_token:   {0}...',
    not_logged_in: 'غير مسجّل الدخول',
    unknown: '(unknown)',
  },

  // ── lib/login.js ────────────────────────────────────
  login: {
    title: '🔐 تسجيل الدخول إلى Yida',
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
    title: '  create-app - أداة إنشاء تطبيق Yida',
    usage: 'الاستخدام: openyida create-app <اسم التطبيق>',
    example: 'مثال: openyida create-app "تطبيقي"',
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
  اسم التطبيق: {0}`,
    app_desc: '  Description: {0}',
    app_icon: '  Icon:        {0} ({1})',
    app_theme: '  Theme:       {0}',
    step_create: `
🚀 جارٍ إنشاء التطبيق...`,
    success: '  ✅ تم إنشاء التطبيق بنجاح!',
    app_type_label: '  appType: {0}',
    corp_id_label: '  corpId:  {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ فشل الإنشاء: {0}',
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
    title: '  create-page - أداة إنشاء صفحة مخصصة في Yida',
    usage: 'الاستخدام: openyida create-page <appType> <اسم الصفحة>',
    example: 'Example: yidacli create-page "APP_XXX" "Game Home"',
    app_id: `
  معرّف التطبيق: {0}`,
    page_name: '  اسم الصفحة:    {0}',
    step_create: `
📄 جارٍ إنشاء الصفحة المخصصة...`,
    sending: '  Sending saveFormSchemaInfo request...',
    success: '  ✅ تم إنشاء الصفحة المخصصة بنجاح!',
    page_id_label: '  pageId: {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ فشل الإنشاء: {0}',
    datasource_injecting: '  [datasource] جارٍ حقن {0} مصدر/مصادر بيانات الموصّل...',
    datasource_success: '  [datasource] تم حقن مصدر البيانات بنجاح',
    datasource_failed: '  [datasource] فشل حقن مصدر البيانات: {0}',
    invalid_response: '❌ فشل إنشاء الصفحة: pageId غير صالح أعاده الخادم، يرجى التحقق من صحة appType',
  },

  // ── lib/get-schema.js ───────────────────────────────
  get_schema: {
    title: '  get-schema - أداة استرداد مخطط النموذج في Yida',
    usage: 'الاستخدام: openyida get-schema <appType> <formUuid>',
    example: 'Example: yidacli get-schema "APP_XXX" "FORM-XXX"',
    app_id: `
  معرّف التطبيق: {0}`,
    form_uuid: '  UUID النموذج: {0}',
    step_get: `
📋 جارٍ استرداد مخطط النموذج...`,
    sending: '  Sending getFormSchema request...',
    success: '  ✅ تم استرداد المخطط بنجاح!',
    failed: '  ❌ فشل الاسترداد: {0}',
  },

  // ── lib/create-form.js ──────────────────────────────
  create_form: {
    error: `
❌ خطأ في الإنشاء: {0}`,
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
    usage: 'الاستخدام: openyida get-page-config <appType> <formUuid>',
    example: 'Example: yidacli get-page-config APP_XXX FORM-XXX',
    title: '  get-page-config - أداة استرداد إعدادات الصفحة في Yida',
    app_id: `
  معرّف التطبيق: {0}`,
    form_uuid: '  UUID النموذج: {0}',
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
    usage: 'الاستخدام: openyida save-share-config <appType> <formUuid> <openUrl> <isOpen> [openAuth]',
    example: 'Example: node save-share-config.js "APP_XXX" "FORM-XXX" "/o/xxx" "y" "n"',
    is_open_hint: '  isOpen: y=enable public access, n=disable public access',
    open_auth_hint: '  openAuth: y=require auth, n=no auth required (default)',
    title: '  save-share-config - أداة حفظ إعدادات الوصول العام في Yida',
    app_id: `
  معرّف التطبيق: {0}`,
    form_uuid: '  UUID النموذج: {0}',
    open_url: '  رابط الوصول العام: {0}',
    is_open: '  الوصول العام: {0}',
    open_auth: '  المصادقة مطلوبة: {0}',
    step_validate: `
📋 Step 0: التحقق من المعاملات`,
    validate_ok: '  ✅ اجتاز التحقق',
    validate_failed: '  ❌ فشل التحقق: {0}',
    step_save: `
💾 Step 2: حفظ إعدادات الوصول العام`,
    sending_request: '  جارٍ إرسال طلب saveShareConfig...',
    save_ok: '  ✅ تم حفظ الإعدادات بنجاح!',
    save_ok_msg: 'تم حفظ إعدادات الوصول العام',
    save_failed: '  ❌ فشل الحفظ: {0}',
    save_failed_msg: 'فشل الحفظ',
    err_is_open_invalid: 'يجب أن تكون قيمة isOpen y أو n. القيمة الحالية: {0}',
    err_open_auth_invalid: 'يجب أن تكون قيمة openAuth y أو n. القيمة الحالية: {0}',
    err_open_url_required: 'openUrl مطلوب لتفعيل الوصول العام',
    err_open_url_prefix: 'يجب أن يبدأ openUrl بـ /o/. القيمة الحالية: {0}',
    err_open_url_chars: 'مسار openUrl يدعم فقط a-z A-Z 0-9 _ -. القيمة الحالية: {0}',
  },

  // ── lib/update-form-config.js ──────────────────────
  update_form_config: {
    usage: 'الاستخدام: openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    example: 'Example: node update-form-config.js "APP_XXX" "FORM_XXX" "false" "My Page"',
    params_label: 'Parameters:',
    param_is_render_nav: '  isRenderNav: true=show top nav, false=hide top nav',
    param_title: '  title: page title (required)',
    title: '  update-form-config - أداة تحديث إعدادات النموذج في Yida',
    app_id: `
  معرّف التطبيق: {0}`,
    form_uuid: '  UUID النموذج: {0}',
    is_render_nav: '  إظهار التنقل: {0}',
    page_title: '  عنوان الصفحة: {0}',
    step_update: `
💾 Step 2: تحديث إعدادات النموذج`,
    sending_request: '  جارٍ إرسال طلب updateFormSchemaInfo...',
    update_ok: '  ✅ تم تحديث الإعدادات بنجاح!',
    nav_shown: 'تم إظهار شريط التنقل العلوي',
    nav_hidden: 'تم إخفاء شريط التنقل العلوي',
    update_failed: '  ❌ فشل التحديث: {0}',
    update_failed_msg: 'فشل التحديث',
  },

  // ── lib/verify-short-url.js ────────────────────────
  verify_short_url: {
    usage: 'الاستخدام: openyida verify-short-url <appType> <formUuid> <url>',
    example: 'Example: node verify-short-url.js "APP_XXX" "FORM-XXX" "/o/aaa"',
    formats_label: '  Supported formats:',
    format_open: '    /o/xxx - public access (external)',
    format_share: '    /s/xxx - org share (internal)',
    open_url_label: 'Public access URL',
    share_url_label: 'Org share URL',
    title: '  verify-short-url - أداة التحقق من الرابط في Yida',
    app_id: `
  معرّف التطبيق: {0}`,
    form_uuid: '  UUID النموذج: {0}',
    step_validate: `
📋 Step 0: التحقق من تنسيق الرابط`,
    validate_ok: '  ✅ اجتاز التحقق من التنسيق',
    validate_failed: '  ❌ فشل التحقق: {0}',
    step_verify: `
🔍 Step 2: التحقق من الرابط`,
    sending_request: '  جارٍ إرسال طلب verifyShortUrl...',
    url_available: '  ✅ الرابط متاح!',
    open_available_msg: 'رابط الوصول العام هذا متاح',
    share_available_msg: 'رابط المشاركة الداخلية هذا متاح',
    url_taken: '  ❌ الرابط مستخدم بالفعل',
    url_taken_msg: 'هذا الرابط المختصر مستخدم بالفعل',
    verify_failed: '  ❌ فشل طلب التحقق',
    err_url_prefix: 'يجب أن يبدأ الرابط بـ /o/ أو /s/. القيمة الحالية: {0}',
    err_url_chars: 'مسار الرابط يدعم فقط a-z A-Z 0-9 _ -. القيمة الحالية: {0}',
    err_url_empty: 'لا يمكن أن يكون مسار الرابط فارغاً: {0}',
  },

  // ── lib/copy.js ────────────────────────────────────
  copy: {
    title: '  openyida copy - تهيئة دليل عمل Yida',
    package_root: `
📦 جذر الحزمة: {0}`,
    dest_base: '🤖 Target root: {0}',
    dest_root: '🤖 الدليل الهدف: {0}',
    force_mode: '⚠️  وضع --force: سيتم مسح الدليل الهدف قبل النسخ',
    no_package: `
❌ لم يتم العثور على دليل حزمة openyida`,
    no_package_hint1: '   تأكد من تثبيت openyida بشكل عام:',
    no_package_hint2: '   npm install -g openyida',
    no_ai_tool: `
❌ No active AI tool environment detected
   Supported tools: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder

   Current detection results:`,
    no_active_tool: `
❌ لم يتم اكتشاف أي بيئة أداة ذكاء اصطناعي نشطة`,
    supported_tools: '   الأدوات المدعومة: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder',
    current_result: `
   نتائج الاكتشاف الحالية:`,
    force_hint: `
   للنسخ القسري إلى الدليل الحالي:
   openyida copy --force`,
    force_cmd: '   openyida copy --force',
    copying: '    Copied: {0}',
    copying_label: `
📂 جارٍ نسخ {0}...`,
    creating_symlink: `
📂 جارٍ إنشاء رابط رمزي yida-skills/...`,
    file_copied: '    تم النسخ: {0}',
    cleared: '    🗑️  تم المسح: {0}',
    symlink_removed: '    🗑️  تم حذف الرابط الرمزي القديم: {0}',
    old_symlink_removed: '    🗑️  Removed old symlink: {0}',
    dir_deleted: '    🗑️  تم حذف الدليل: {0}',
    removed: '    🗑️  تم الحذف: {0}',
    symlink_created: '    🔗 رابط رمزي: {0} -> {1}',
    symlink_label: 'رابط رمزي',
    done: '✅ اكتمل!',
    files_copied: '   الملفات المنسوخة: {0}',
    files_count: '{0} ملفات',
    symlinks_created: '   الروابط الرمزية المنشأة: {0}',
    result_symlink: '   {0} → {1} (رابط رمزي)',
    result_copy: '   {0} → {1} ({2} ملفات)',
    wukong_skills_cleanup: `
🗑️  بيئة Wukong: جارٍ تنظيف الرابط الرمزي yida-skills/...`,
    wukong_skills_cleaned: 'تم التنظيف',
    wukong_skills_not_found: '    ℹ️  لم يتم العثور على رابط رمزي أو دليل yida-skills/: {0}',
    remove_failed: '    ❌ فشل الحذف: {0} ({1})',
    symlink_fallback_copy: '    ⚠️  فشل إنشاء الرابط الرمزي في Windows (يتطلب صلاحيات المسؤول)، استخدام نسخ الدليل: {0}',
    symlink_failed: '    ❌ فشل إنشاء الرابط الرمزي: {0} ({1})',
  },

  // ── lib/check-update.js ─────────────────────────────
  check_update: {
    new_version: `
🎉 إصدار جديد متاح: {0} → {1}`,
  },

  // ── lib/compile.js ─────────────────────────────────
  compile: {
    usage: 'الاستخدام: openyida compile <ملف-المصدر>',
    example: 'مثال: openyida compile pages/src/demo.js',
    source_not_found: '❌ ملف المصدر غير موجود: {0}',
    success: '✅ اكتمل التجميع!',
    output_file: '  ملف الإخراج: {0}',
    exception: '\n❌ خطأ في التجميع: {0}',
  },

  // ── lib/publish.js ─────────────────────────────────
  publish: {
    title: '  yida-publish - أداة نشر صفحات Yida',
    platform: '  المنصة: {0}',
    base_url: `
  Platform: {0}`,
    app_type: '  App ID:   {0}',
    app_id: '  معرّف التطبيق: {0}',
    form_uuid: '  معرّف النموذج: {0}',
    source_file: '  المصدر: {0}',
    compiled_file: '  المخرجات: {0}',
    output_dir: '  Output dir: pages/dist/',
    step_compile: `
📦 Step 1: تجميع المصدر وبناء المخطط
`,
    reading_source: '[1/4] جارٍ قراءة مصدر {0}...',
    compiling: '[2/4] جارٍ تجميع {0} بـ Babel...',
    compile_failed: '  ❌ فشل التجميع: {0}',
    compile_location: `
     الموقع: السطر {0}، العمود {1}`,
    compile_error_loc: '     Location: line {0}, column {1}',
    compile_error_code: '     رمز الخطأ: {0}',
    minifying: '[3/4] جارٍ ضغط {0} بـ UglifyJS...',
    minify_failed: '  فشل الضغط: {0}',
    uglifying: '[3/4] UglifyJS minifying → {0}...',
    uglify_failed: '  Minification failed: {0}',
    compile_done: '  ✅ اكتمل التجميع: {0}',
    building_schema: '[4/4] جارٍ بناء المخطط...',
    schema_built: '  ✅ تم بناء المخطط بنجاح!',
    step_login: `
🔑 Step 2: قراءة بيانات تسجيل الدخول`,
    step_publish: `
📤 Step 3: نشر المخطط
`,
    resend_save_csrf: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    resend_save: '  🔄 Resending saveFormSchema request after re-login...',
    csrf_retry: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    relogin_retry: '  🔄 Resending saveFormSchema request after re-login...',
    publish_failed: `
❌ فشل النشر: {0}`,
    schema_published: '  ✅ تم نشر المخطط بنجاح!',
    schema_success: '  ✅ Schema published successfully!',
    form_uuid_label: '  formUuid: {0}',
    version_label: '  version:  {0}',
    step_config: `
⚙️  Step 4: تحديث إعدادات النموذج
`,
    sending_config: '  Sending updateFormConfig request...',
    resend_config_csrf: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    resend_config: '  🔄 Resending updateFormConfig request after re-login...',
    config_csrf_retry: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    config_relogin_retry: '  🔄 Resending updateFormConfig request after re-login...',
    success: '  ✅ تم النشر بنجاح!',
    publish_success: '  ✅ Published successfully!',
    config_updated: '  Config updated: MINI_RESOURCE = 8',
    config_failed: '  ⚠️  فشل تحديث الإعدادات: {0}',
    schema_ok_config_failed: '  Schema published, but config update failed',
    schema_published_config_failed: '  Schema published, but config update failed',
    exception: `
❌ خطأ في النشر: {0}`,
    error: `
❌ Publish error: {0}`,
    source_not_found: '❌ لم يتم العثور على ملف المصدر: {0}',
    usage: 'الاستخدام: openyida publish <appType> <formUuid> <ملفالمصدر>',
    example: 'مثال: openyida publish APP_XXX FORM-XXX pages/src/xxx.js',
  },

  // ── lib/qr-login.js ────────────────────────────────
  qr_login: {
    title: '🔐 تسجيل الدخول إلى Yida برمز QR في الطرفية',
    step_init: '  Step 1: جارٍ تهيئة الجلسة...',
    step_get_qr: '  Step 2: جارٍ الحصول على رمز QR...',
    scan_hint: '  📱 يرجى مسح رمز QR أدناه باستخدام DingTalk:',
    qr_url_label: '  رابط رمز QR: {0}',
    waiting_scan: '  ⏳ في انتظار المسح (حتى دقيقتين)...',
    scanned_confirm: '  ✅ تم مسح رمز QR! يرجى تأكيد تسجيل الدخول على هاتفك...',
    scan_success: '  ✅ تم تأكيد المسح!',
    step_exchange: '  Step 4: جارٍ تبادل بيانات الاعتماد...',
    step_get_corps: '  Step 5: جارٍ الحصول على قائمة المؤسسات...',
    step_switch_corp: '  Step 7: جارٍ التبديل إلى المؤسسة المحددة...',
    only_one_corp: '  ✅ تم اكتشاف مؤسسة واحدة: {0}، تم الاختيار تلقائياً',
    select_corp_prompt: '  🏢 تم العثور على مؤسسات متعددة، يرجى اختيار واحدة:',
    select_corp_input: '  أدخل الرقم (1-{0}): ',
    select_corp_invalid: '  ❌ إدخال غير صالح، يرجى إدخال رقم بين 1 و {0}',
    corp_selected: '  ✅ تم اختيار المؤسسة: {0}',
    login_success: '✅ تم تسجيل الدخول بنجاح!',
    qrcode_fallback: '  ⚠️  حزمة qrcode غير مثبتة، يرجى زيارة الرابط أدناه يدوياً:',
    qrcode_render_failed: '  ⚠️  فشل عرض رمز QR ({0})، يرجى زيارة الرابط أدناه:',
    get_qr_failed: 'Failed to parse QR code response: {0}',
    get_qr_api_failed: 'QR code API failed: {0}',
    get_qr_error: 'Failed to get QR code: {0}',
    qr_expired: 'انتهت صلاحية رمز QR، يرجى تسجيل الدخول مجدداً',
    poll_timeout: 'انتهت مهلة انتظار المسح (دقيقتان)، يرجى تسجيل الدخول مجدداً',
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
    no_corp_available: 'لم يتم العثور على مؤسسات يمكن الوصول إليها',
    no_csrf_in_cookie: 'نجح تسجيل الدخول لكن لم يتم العثور على csrf_token، يرجى المحاولة مجدداً',
    stdin_closed: 'تم إغلاق تدفق الإدخال، لا يمكن اختيار مؤسسة',
  },

  // ── scripts/postinstall.js ─────────────────────────
  postinstall: {
    welcome_title: '  🎉 مرحباً بك في OpenYida!                                    ',
    install_success: '  ✅ اكتمل التثبيت! {0} أداة تطوير Yida بالذكاء الاصطناعي جاهزة.',
    update_success: '  ✅ اكتمل التحديث! {0} تم ترقية OpenYida إلى أحدث إصدار.',
    ai_mode_title: '  🚀 وضع المحادثة بالذكاء الاصطناعي',
    ai_mode_desc: '  في Claude Code / Aone Copilot / Cursor، تحدث مباشرة:',
    prompt1: '  📋  "أنشئ لي نظام إدارة الحضور باستخدام Yida"',
    prompt2: '  💰  "ابنِ تطبيق حاسبة الراتب الشخصي"',
    prompt3: '  🏢  "أنشئ نظام CRM لإدارة العملاء"',
    prompt4: '  🎂  "اصنع تطبيقاً مصغراً للتهنئة بأعياد الميلاد"',
    steps_title: '  📖 البدء',
    step1: '  {0}Step 1{1}  افتح أداة الذكاء الاصطناعي (Claude Code / Cursor إلخ)',
    step2: '  {0}Step 2{1}  صف التطبيق الذي تريده بلغة طبيعية',
    step3: '  {0}Step 3{1}  يقوم الذكاء الاصطناعي تلقائياً بتشغيل أوامر openyida',
    step4: '  {0}Step 4{1}  احصل على رابط تطبيق Yida الخاص بك 🎉',
    commands_title: '  ⚡ أوامر سريعة',
    cmd_env: '  {0}openyida env{1}      {2}# اكتشاف بيئة أداة الذكاء الاصطناعي وحالة تسجيل الدخول{3}',
    cmd_login: '  {0}openyida login{1}    {2}# تسجيل الدخول إلى Yida{3}',
    cmd_help: '  {0}openyida --help{1}   {2}# عرض جميع الأوامر{3}',
    footer1: '  📚 التوثيق: https://github.com/openyida/openyida',
    footer2: '  💬 المجتمع: انضم إلى مجتمع OpenYida على DingTalk',
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
    config_load_error: 'فشل تحميل إعدادات CDN: {0}',
    config_saved: '✅ تم حفظ إعدادات CDN في: {0}',
    config_usage: 'الاستخدام: openyida cdn-config [خيارات]',
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
    config_file_path: '📄 ملف الإعدادات: {0}',
    config_section_aliyun: '🔐 بيانات اعتماد Alibaba Cloud',
    config_section_cdn: '🌐 إعدادات CDN',
    config_section_oss: '📦 إعدادات OSS',
    config_section_upload: '📤 إعدادات الرفع',
    config_cdn_domain: 'نطاق CDN',
    config_oss_region: 'منطقة OSS',
    config_oss_bucket: 'حاوية OSS',
    config_oss_endpoint: 'نقطة نهاية OSS',
    config_upload_path: 'مسار الرفع',
    config_compress: 'ضغط الصور',
    config_max_width: 'الحد الأقصى للعرض',
    config_quality: 'جودة الصورة',
    config_not_set: 'غير محدد',
    config_enabled: 'مفعّل',
    config_disabled: 'معطّل',
    config_status_valid: '✅ الإعدادات مكتملة، جاهزة للاستخدام',
    config_status_invalid: '⚠️  الإعدادات غير مكتملة',
    config_missing: '   الحقول المفقودة: {0}',
    config_updated: '✅ تم تحديث الإعدادات!',
    config_init_title: '🔧 معالج تهيئة CDN',
    config_init_desc: 'لاستخدام رفع الصور عبر CDN، قم بتكوين ما يلي:',
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
    upload_no_files: '❌ يرجى تحديد ملفات الصور للرفع',
    config_incomplete: '❌ إعدادات CDN غير مكتملة',
    missing_fields: '   الحقول المفقودة: {0}',
    run_config_init: '   يرجى تشغيل أولاً: openyida cdn-config --init',
    no_config: '❌ لم يتم العثور على إعدادات CDN',
    oss_sdk_required: '❌ SDK ali-oss مفقود',
    run_npm_install: '   شغّل: npm install {0}',
    no_images_found: '❌ لم يتم العثور على ملفات صور مدعومة',
    uploading_images: '📤 جارٍ رفع {0} صور...',
    uploading_file: '   جارٍ الرفع: {0}',
    upload_success: '   ✅ {0}',
    upload_failed: '   ❌ فشل رفع {0}: {1}',
    upload_summary: `
📊 ملخص الرفع`,
    upload_success_count: '   نجح: {0}',
    upload_fail_count: '   فشل: {0}',
    cdn_urls: `
🔗 قائمة روابط CDN:`,
    upload_error: '❌ فشل الرفع: {0}',
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
    refresh_no_targets: '❌ يرجى تحديد روابط أو مجلدات للتحديث',
    cdn_sdk_required: '❌ SDK CDN من Alibaba Cloud مفقود',
    querying_quota: '📊 جارٍ الاستعلام عن حصة التحديث...',
    quota_info: '   تحديث الروابط: {0}/يوم، {1} متبقٍ | المجلدات: {2}/يوم، {3} متبقٍ',
    quota_query_failed: '   ⚠️  Failed to query quota: {0}',
    refreshing_urls: '🔄 جارٍ تحديث {0} رابط...',
    refreshing_paths: '🔄 جارٍ تحديث {0} مجلد...',
    refresh_task_id: '   ✅ معرّف المهمة: {0}',
    refresh_urls_failed: '   ❌ فشل تحديث الروابط: {0}',
    refresh_paths_failed: '   ❌ فشل تحديث المجلدات: {0}',
    refresh_summary: `
📊 ملخص التحديث`,
    url_refresh_success: '   ✅ نجح تحديث الرابط، معرّف المهمة: {0}',
    path_refresh_success: '   ✅ نجح تحديث المجلد، معرّف المهمة: {0}',
    refresh_error: '❌ فشل التحديث: {0}',
    file_not_found: '❌ لم يتم العثور على الملف: {0}',
  },

  // ── src/flash-note/flash-to-prd.ts ──────────────
  flash_to_prd: {
    title: '📋 DingTalk Flash Note to PRD',
    help_usage: 'Usage: openyida flash-to-prd --file <path> [--name <project-name>]',
    help_usage2: '       openyida flash-to-prd --name <project-name>  (read from stdin)',
    help_args_title: 'Arguments:',
    help_arg_file: '  --file, -f <path>       Flash note file path (.txt / .md)',
    help_arg_name: '  --name, -n <name>       Project name (optional, auto-extracted)',
    help_arg_max_tokens: '  --max-tokens <count>    Max AI output tokens (default 8000)',
    help_examples_title: 'Examples:',
    help_example1: '  openyida flash-to-prd --file ./meeting-notes.txt --name "Equipment Inspection"',
    help_example2: '  cat meeting.txt | openyida flash-to-prd --name "Equipment Inspection"',
    step_read: '[Step 1] Reading flash note content...',
    file_not_found: 'File not found: {0}',
    no_input: 'No flash note content provided. Use --file or pipe content via stdin.',
    stdin_empty: 'Standard input is empty',
    read_success: '✅ Read successfully, {0} characters',
    step_load_module: '[Step 2] Loading prompt builder module...',
    module_loaded_builtin: '✅ Built-in prompt module loaded',
    module_loaded_local: '✅ Local prompt module loaded: {0}',
    module_not_found: '❌ build-flash-note-prompt.js module not found',
    module_path_tried: '  Tried path {0}: {1}',
    step_preprocess: '[Step 3] Preprocessing + meeting recognition...',
    preprocess_result: '  Preprocessed: {0} chars -> {1} chars',
    meeting_meta: '  Meeting metadata: {0} fields{1}',
    a1_sections: '  A1 summary sections: {0}{1}',
    speakers: '  Speakers identified: {0}{1}',
    speakers_with_role: ' (with {0} role annotations)',
    step_login: '[Step 4] Checking login status...',
    no_login: '  No login session found, triggering login...',
    login_ready: '✅ Login ready ({0})',
    step_ai: '[Step 5] Calling AI to generate PRD...',
    single_segment: '  Single segment mode, prompt length: {0} chars',
    multi_segment: '  Multi-segment mode, {0} segments total',
    extracting_segment: '  Extracting segment {0}/{1} ({2} chars)...',
    merging_segments: '  Merging segment results...',
    ai_success: '✅ PRD generated successfully',
    ai_error: 'AI API call failed: {0}',
    done: '✅ Flash note to PRD complete',
    done_project: '  Project name: {0}',
    done_file: '  Output file: {0}',
    done_size: '  File size: {0} characters',
    done_meeting: '  Meeting recognition: {0} metadata fields, {1} A1 sections, {2} speakers',
  },
};
