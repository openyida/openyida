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
  compile <sourceFile>                                         केवल JSX संकलित करें (प्रकाशित नहीं, pages/dist/ में आउटपुट)
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
    integration_help: `उपयोग: openyida integration <उप-कमांड> [तर्क]

उप-कमांड:
  create <appType> <formUuid> <flowName> [विकल्प]   एकीकरण और स्वचालन (लॉजिक फ्लो) बनाएं

उदाहरण:
  openyida integration create APP_XXX FORM-XXX "नया रिकॉर्ड सूचना" --receivers user123 --publish`,
    integration_unknown: 'अज्ञात integration उप-कमांड: {0}',
    integration_help_hint: 'उपलब्ध उप-कमांड देखने के लिए openyida integration --help का उपयोग करें',
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
    title: '  openyida env - AI टूल वातावरण पहचान',
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
    logged_in: 'लॉग इन है',
    base_url_label: '  Domain:       {0}',
    corp_id_label: '  Org ID:       {0}',
    user_id_label: '  User ID:      {0}',
    csrf_label: '  csrf_token:   {0}...',
    not_logged_in: 'लॉग इन नहीं है',
    unknown: '(unknown)',
  },

  // ── lib/login.js ────────────────────────────────────
  login: {
    title: '🔐 Yida लॉगिन',
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
    title: '  create-app - Yida ऐप निर्माण टूल',
    usage: 'उपयोग: openyida create-app <ऐप नाम>',
    example: 'उदाहरण: openyida create-app "मेरा ऐप"',
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
  ऐप नाम: {0}`,
    app_desc: '  Description: {0}',
    app_icon: '  Icon:        {0} ({1})',
    app_theme: '  Theme:       {0}',
    step_create: `
🚀 ऐप बनाया जा रहा है...`,
    success: '  ✅ ऐप सफलतापूर्वक बनाया गया!',
    app_type_label: '  appType: {0}',
    corp_id_label: '  corpId:  {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ निर्माण विफल: {0}',
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
    title: '  create-page - Yida कस्टम पेज निर्माण टूल',
    usage: 'उपयोग: openyida create-page <appType> <पेज नाम>',
    example: 'Example: yidacli create-page "APP_XXX" "Game Home"',
    app_id: `
  ऐप ID:    {0}`,
    page_name: '  पेज नाम: {0}',
    step_create: `
📄 कस्टम पेज बनाया जा रहा है...`,
    sending: '  Sending saveFormSchemaInfo request...',
    success: '  ✅ कस्टम पेज सफलतापूर्वक बनाया गया!',
    page_id_label: '  pageId: {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ निर्माण विफल: {0}',
    datasource_injecting: '  [datasource] {0} कनेक्टर डेटा स्रोत इंजेक्ट किए जा रहे हैं...',
    datasource_success: '  [datasource] डेटा स्रोत सफलतापूर्वक इंजेक्ट हुआ',
    datasource_failed: '  [datasource] डेटा स्रोत इंजेक्शन विफल: {0}',
    invalid_response: '❌ पृष्ठ बनाने में विफल: सर्वर द्वारा अमान्य pageId लौटाया गया, कृपया जांचें कि appType सही है',
  },

  // ── lib/get-schema.js ───────────────────────────────
  get_schema: {
    title: '  get-schema - Yida फॉर्म स्कीमा प्राप्ति टूल',
    usage: 'उपयोग: openyida get-schema <appType> <formUuid>',
    example: 'Example: yidacli get-schema "APP_XXX" "FORM-XXX"',
    app_id: `
  ऐप ID:    {0}`,
    form_uuid: '  फॉर्म UUID: {0}',
    step_get: `
📋 फॉर्म स्कीमा प्राप्त किया जा रहा है...`,
    sending: '  Sending getFormSchema request...',
    success: '  ✅ स्कीमा सफलतापूर्वक प्राप्त हुआ!',
    failed: '  ❌ प्राप्ति विफल: {0}',
  },

  // ── lib/create-form.js ──────────────────────────────
  create_form: {
    error: `
❌ निर्माण त्रुटि: {0}`,
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
    usage: 'उपयोग: openyida get-page-config <appType> <formUuid>',
    example: 'Example: yidacli get-page-config APP_XXX FORM-XXX',
    title: '  get-page-config - Yida पेज कॉन्फ़िगरेशन प्राप्ति टूल',
    app_id: `
  ऐप ID:    {0}`,
    form_uuid: '  फॉर्म UUID: {0}',
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
    usage: 'उपयोग: openyida save-share-config <appType> <formUuid> <openUrl> <isOpen> [openAuth]',
    example: 'Example: node save-share-config.js "APP_XXX" "FORM-XXX" "/o/xxx" "y" "n"',
    is_open_hint: '  isOpen: y=enable public access, n=disable public access',
    open_auth_hint: '  openAuth: y=require auth, n=no auth required (default)',
    title: '  save-share-config - Yida सार्वजनिक पहुंच कॉन्फ़िगरेशन सहेजने का टूल',
    app_id: `
  ऐप ID:    {0}`,
    form_uuid: '  फॉर्म UUID: {0}',
    open_url: '  सार्वजनिक URL: {0}',
    is_open: '  सार्वजनिक पहुंच: {0}',
    open_auth: '  प्रमाणीकरण आवश्यक: {0}',
    step_validate: `
📋 Step 0: पैरामीटर सत्यापन`,
    validate_ok: '  ✅ सत्यापन सफल',
    validate_failed: '  ❌ सत्यापन विफल: {0}',
    step_save: `
💾 Step 2: सार्वजनिक पहुंच कॉन्फ़िगरेशन सहेजें`,
    sending_request: '  saveShareConfig अनुरोध भेजा जा रहा है...',
    save_ok: '  ✅ कॉन्फ़िगरेशन सफलतापूर्वक सहेजा गया!',
    save_ok_msg: 'सार्वजनिक पहुंच कॉन्फ़िगरेशन सहेजा गया',
    save_failed: '  ❌ सहेजना विफल: {0}',
    save_failed_msg: 'सहेजना विफल',
    err_is_open_invalid: 'isOpen y या n होना चाहिए। वर्तमान मान: {0}',
    err_open_auth_invalid: 'openAuth y या n होना चाहिए। वर्तमान मान: {0}',
    err_open_url_required: 'सार्वजनिक पहुंच सक्षम करने के लिए openUrl आवश्यक है',
    err_open_url_prefix: 'openUrl /o/ से शुरू होना चाहिए। वर्तमान मान: {0}',
    err_open_url_chars: 'openUrl पथ केवल a-z A-Z 0-9 _ - का समर्थन करता है। वर्तमान मान: {0}',
  },

  // ── lib/update-form-config.js ──────────────────────
  update_form_config: {
    usage: 'उपयोग: openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    example: 'Example: node update-form-config.js "APP_XXX" "FORM_XXX" "false" "My Page"',
    params_label: 'Parameters:',
    param_is_render_nav: '  isRenderNav: true=show top nav, false=hide top nav',
    param_title: '  title: page title (required)',
    title: '  update-form-config - Yida फॉर्म कॉन्फ़िगरेशन अपडेट टूल',
    app_id: `
  ऐप ID:    {0}`,
    form_uuid: '  फॉर्म UUID: {0}',
    is_render_nav: '  नेविगेशन दिखाएं: {0}',
    page_title: '  पेज शीर्षक: {0}',
    step_update: `
💾 Step 2: फॉर्म कॉन्फ़िगरेशन अपडेट करें`,
    sending_request: '  updateFormSchemaInfo अनुरोध भेजा जा रहा है...',
    update_ok: '  ✅ कॉन्फ़िगरेशन सफलतापूर्वक अपडेट हुआ!',
    nav_shown: 'शीर्ष नेविगेशन दिखाया गया',
    nav_hidden: 'शीर्ष नेविगेशन छिपाया गया',
    update_failed: '  ❌ अपडेट विफल: {0}',
    update_failed_msg: 'अपडेट विफल',
  },

  // ── lib/verify-short-url.js ────────────────────────
  verify_short_url: {
    usage: 'उपयोग: openyida verify-short-url <appType> <formUuid> <url>',
    example: 'Example: node verify-short-url.js "APP_XXX" "FORM-XXX" "/o/aaa"',
    formats_label: '  Supported formats:',
    format_open: '    /o/xxx - public access (external)',
    format_share: '    /s/xxx - org share (internal)',
    open_url_label: 'Public access URL',
    share_url_label: 'Org share URL',
    title: '  verify-short-url - Yida URL सत्यापन टूल',
    app_id: `
  ऐप ID:    {0}`,
    form_uuid: '  फॉर्म UUID: {0}',
    step_validate: `
📋 Step 0: URL प्रारूप सत्यापन`,
    validate_ok: '  ✅ प्रारूप सत्यापित',
    validate_failed: '  ❌ सत्यापन विफल: {0}',
    step_verify: `
🔍 Step 2: URL सत्यापित करें`,
    sending_request: '  verifyShortUrl अनुरोध भेजा जा रहा है...',
    url_available: '  ✅ URL उपलब्ध है!',
    open_available_msg: 'यह सार्वजनिक पहुंच URL उपलब्ध है',
    share_available_msg: 'यह आंतरिक साझाकरण URL उपलब्ध है',
    url_taken: '  ❌ URL पहले से उपयोग में है',
    url_taken_msg: 'यह शॉर्ट URL पहले से लिया गया है',
    verify_failed: '  ❌ सत्यापन अनुरोध विफल',
    err_url_prefix: 'URL /o/ या /s/ से शुरू होना चाहिए। वर्तमान मान: {0}',
    err_url_chars: 'URL पथ केवल a-z A-Z 0-9 _ - का समर्थन करता है। वर्तमान मान: {0}',
    err_url_empty: 'URL पथ खाली नहीं हो सकता: {0}',
  },

  // ── lib/copy.js ────────────────────────────────────
  copy: {
    title: '  openyida copy - Yida कार्य निर्देशिका प्रारंभ करें',
    package_root: `
📦 पैकेज रूट: {0}`,
    dest_base: '🤖 Target root: {0}',
    dest_root: '🤖 लक्ष्य निर्देशिका: {0}',
    force_mode: '⚠️  --force मोड: कॉपी करने से पहले लक्ष्य निर्देशिका साफ की जाएगी',
    no_package: `
❌ openyida पैकेज निर्देशिका नहीं मिली`,
    no_package_hint1: '   सुनिश्चित करें कि openyida वैश्विक रूप से स्थापित है:',
    no_package_hint2: '   npm install -g openyida',
    no_ai_tool: `
❌ No active AI tool environment detected
   Supported tools: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder

   Current detection results:`,
    no_active_tool: `
❌ कोई सक्रिय AI टूल वातावरण नहीं मिला`,
    supported_tools: '   समर्थित टूल: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder',
    current_result: `
   वर्तमान पहचान परिणाम:`,
    force_hint: `
   वर्तमान निर्देशिका में जबरदस्ती कॉपी करने के लिए:
   openyida copy --force`,
    force_cmd: '   openyida copy --force',
    copying: '    Copied: {0}',
    copying_label: `
📂 {0} कॉपी हो रहा है...`,
    creating_symlink: `
📂 yida-skills/ सिम्बॉलिक लिंक बनाया जा रहा है...`,
    file_copied: '    कॉपी हुआ: {0}',
    cleared: '    🗑️  साफ हुआ: {0}',
    symlink_removed: '    🗑️  पुराना सिम्बॉलिक लिंक हटाया गया: {0}',
    old_symlink_removed: '    🗑️  Removed old symlink: {0}',
    dir_deleted: '    🗑️  निर्देशिका हटाई गई: {0}',
    removed: '    🗑️  हटाया गया: {0}',
    symlink_created: '    🔗 सिम्बॉलिक लिंक: {0} -> {1}',
    symlink_label: 'सिम्बॉलिक लिंक',
    done: '✅ पूर्ण!',
    files_copied: '   कॉपी की गई फ़ाइलें: {0}',
    files_count: '{0} फ़ाइलें',
    symlinks_created: '   बनाए गए सिम्बॉलिक लिंक: {0}',
    result_symlink: '   {0} → {1} (सिम्बॉलिक लिंक)',
    result_copy: '   {0} → {1} ({2} फ़ाइलें)',
    wukong_skills_cleanup: `
🗑️  Wukong वातावरण: yida-skills/ सिम्बॉलिक लिंक साफ हो रहा है...`,
    wukong_skills_cleaned: 'साफ हुआ',
    wukong_skills_not_found: '    ℹ️  yida-skills/ सिम्बॉलिक लिंक या निर्देशिका नहीं मिली: {0}',
    remove_failed: '    ❌ हटाना विफल: {0} ({1})',
    symlink_fallback_copy: '    ⚠️  Windows सिम्बॉलिक लिंक बनाना विफल (व्यवस्थापक अधिकार आवश्यक), निर्देशिका कॉपी का उपयोग: {0}',
    symlink_failed: '    ❌ सिम्बॉलिक लिंक बनाना विफल: {0} ({1})',
  },

  // ── lib/check-update.js ─────────────────────────────
  check_update: {
    new_version: `
🎉 नया संस्करण उपलब्ध: {0} → {1}`,
  },

  // ── lib/compile.js ─────────────────────────────────
  compile: {
    usage: 'उपयोग: openyida compile <स्रोत-फ़ाइल>',
    example: 'उदाहरण: openyida compile pages/src/demo.js',
    source_not_found: '❌ स्रोत फ़ाइल नहीं मिली: {0}',
    success: '✅ संकलन पूर्ण!',
    output_file: '  आउटपुट फ़ाइल: {0}',
    exception: '\n❌ संकलन त्रुटि: {0}',
  },

  // ── lib/publish.js ─────────────────────────────────
  publish: {
    title: '  yida-publish - Yida पेज प्रकाशन टूल',
    platform: '  प्लेटफ़ॉर्म: {0}',
    base_url: `
  Platform: {0}`,
    app_type: '  App ID:   {0}',
    app_id: '  ऐप ID: {0}',
    form_uuid: '  फॉर्म ID: {0}',
    source_file: '  स्रोत: {0}',
    compiled_file: '  आउटपुट: {0}',
    output_dir: '  Output dir: pages/dist/',
    step_compile: `
📦 Step 1: स्रोत संकलित करें और स्कीमा बनाएं
`,
    reading_source: '[1/4] {0} स्रोत पढ़ा जा रहा है...',
    compiling: '[2/4] Babel से {0} संकलित हो रहा है...',
    compile_failed: '  ❌ संकलन विफल: {0}',
    compile_location: `
     स्थान: पंक्ति {0}, स्तंभ {1}`,
    compile_error_loc: '     Location: line {0}, column {1}',
    compile_error_code: '     त्रुटि कोड: {0}',
    minifying: '[3/4] UglifyJS से {0} संपीड़ित हो रहा है...',
    minify_failed: '  संपीड़न विफल: {0}',
    uglifying: '[3/4] UglifyJS minifying → {0}...',
    uglify_failed: '  Minification failed: {0}',
    compile_done: '  ✅ संकलन पूर्ण: {0}',
    building_schema: '[4/4] स्कीमा बनाया जा रहा है...',
    schema_built: '  ✅ स्कीमा सफलतापूर्वक बना!',
    step_login: `
🔑 Step 2: लॉगिन जानकारी पढ़ें`,
    step_publish: `
📤 Step 3: स्कीमा प्रकाशित करें
`,
    resend_save_csrf: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    resend_save: '  🔄 Resending saveFormSchema request after re-login...',
    csrf_retry: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    relogin_retry: '  🔄 Resending saveFormSchema request after re-login...',
    publish_failed: `
❌ प्रकाशन विफल: {0}`,
    schema_published: '  ✅ स्कीमा सफलतापूर्वक प्रकाशित!',
    schema_success: '  ✅ Schema published successfully!',
    form_uuid_label: '  formUuid: {0}',
    version_label: '  version:  {0}',
    step_config: `
⚙️  Step 4: फॉर्म कॉन्फ़िगरेशन अपडेट करें
`,
    sending_config: '  Sending updateFormConfig request...',
    resend_config_csrf: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    resend_config: '  🔄 Resending updateFormConfig request after re-login...',
    config_csrf_retry: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    config_relogin_retry: '  🔄 Resending updateFormConfig request after re-login...',
    success: '  ✅ सफलतापूर्वक प्रकाशित!',
    publish_success: '  ✅ Published successfully!',
    config_updated: '  Config updated: MINI_RESOURCE = 8',
    config_failed: '  ⚠️  कॉन्फ़िगरेशन अपडेट विफल: {0}',
    schema_ok_config_failed: '  Schema published, but config update failed',
    schema_published_config_failed: '  Schema published, but config update failed',
    exception: `
❌ प्रकाशन त्रुटि: {0}`,
    error: `
❌ Publish error: {0}`,
    source_not_found: '❌ स्रोत फ़ाइल नहीं मिली: {0}',
    usage: 'उपयोग: openyida publish <appType> <formUuid> <स्रोतफ़ाइल>',
    example: 'उदाहरण: openyida publish APP_XXX FORM-XXX pages/src/xxx.js',
  },

  // ── lib/qr-login.js ────────────────────────────────
  qr_login: {
    title: '🔐 Yida टर्मिनल QR कोड लॉगिन',
    step_init: '  Step 1: सत्र प्रारंभ हो रहा है...',
    step_get_qr: '  Step 2: QR कोड प्राप्त हो रहा है...',
    scan_hint: '  📱 कृपया DingTalk से नीचे दिए QR कोड को स्कैन करें:',
    qr_url_label: '  QR कोड URL: {0}',
    waiting_scan: '  ⏳ स्कैन की प्रतीक्षा (अधिकतम 2 मिनट)...',
    scanned_confirm: '  ✅ QR कोड स्कैन हुआ! कृपया अपने फ़ोन पर लॉगिन की पुष्टि करें...',
    scan_success: '  ✅ स्कैन की पुष्टि हुई!',
    step_exchange: '  Step 4: लॉगिन क्रेडेंशियल का आदान-प्रदान हो रहा है...',
    step_get_corps: '  Step 5: संगठन सूची प्राप्त हो रही है...',
    step_switch_corp: '  Step 7: चुने गए संगठन पर स्विच हो रहा है...',
    only_one_corp: '  ✅ एक संगठन मिला: {0}, स्वचालित रूप से चुना गया',
    select_corp_prompt: '  🏢 कई संगठन मिले, कृपया एक चुनें:',
    select_corp_input: '  नंबर दर्ज करें (1-{0}): ',
    select_corp_invalid: '  ❌ अमान्य इनपुट, कृपया 1 से {0} के बीच नंबर दर्ज करें',
    corp_selected: '  ✅ संगठन चुना गया: {0}',
    login_success: '✅ लॉगिन सफल!',
    qrcode_fallback: '  ⚠️  qrcode पैकेज स्थापित नहीं है, कृपया नीचे दिए URL पर मैन्युअल रूप से जाएं:',
    qrcode_render_failed: '  ⚠️  QR कोड रेंडरिंग विफल ({0}), कृपया नीचे दिए URL पर जाएं:',
    get_qr_failed: 'Failed to parse QR code response: {0}',
    get_qr_api_failed: 'QR code API failed: {0}',
    get_qr_error: 'Failed to get QR code: {0}',
    qr_expired: 'QR कोड समाप्त हो गया, कृपया पुनः लॉगिन करें',
    poll_timeout: 'स्कैन टाइमआउट (2 मिनट), कृपया पुनः लॉगिन करें',
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
    no_corp_available: 'कोई सुलभ संगठन नहीं मिला',
    no_csrf_in_cookie: 'लॉगिन सफल लेकिन csrf_token नहीं मिला, कृपया पुनः प्रयास करें',
    stdin_closed: 'इनपुट स्ट्रीम बंद है, संगठन चुनना संभव नहीं',
  },

  // ── scripts/postinstall.js ─────────────────────────
  postinstall: {
    welcome_title: '  🎉 OpenYida में आपका स्वागत है!                              ',
    install_success: '  ✅ स्थापना पूर्ण! {0} Yida AI विकास टूल तैयार है।',
    update_success: '  ✅ अपडेट पूर्ण! {0} OpenYida नवीनतम संस्करण में अपग्रेड हुआ।',
    ai_mode_title: '  🚀 AI वार्तालाप मोड',
    ai_mode_desc: '  Claude Code / Aone Copilot / Cursor में सीधे बात करें:',
    prompt1: '  📋  "Yida से मेरे लिए उपस्थिति प्रबंधन प्रणाली बनाएं"',
    prompt2: '  💰  "व्यक्तिगत वेतन कैलकुलेटर ऐप बनाएं"',
    prompt3: '  🏢  "CRM ग्राहक प्रबंधन प्रणाली बनाएं"',
    prompt4: '  🎂  "जन्मदिन शुभकामना मिनी-ऐप बनाएं"',
    steps_title: '  📖 शुरुआत करें',
    step1: '  {0}Step 1{1}  अपना AI कोडिंग टूल खोलें (Claude Code / Cursor आदि)',
    step2: '  {0}Step 2{1}  प्राकृतिक भाषा में अपना ऐप वर्णन करें',
    step3: '  {0}Step 3{1}  AI स्वचालित रूप से openyida कमांड चलाता है',
    step4: '  {0}Step 4{1}  अपना Yida ऐप लिंक प्राप्त करें 🎉',
    commands_title: '  ⚡ त्वरित कमांड',
    cmd_env: '  {0}openyida env{1}      {2}# AI टूल वातावरण और लॉगिन स्थिति पहचानें{3}',
    cmd_login: '  {0}openyida login{1}    {2}# Yida में लॉगिन करें{3}',
    cmd_help: '  {0}openyida --help{1}   {2}# सभी कमांड देखें{3}',
    footer1: '  📚 दस्तावेज़: https://github.com/openyida/openyida',
    footer2: '  💬 समुदाय: DingTalk पर OpenYida समुदाय में शामिल हों',
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
    config_load_error: 'CDN कॉन्फ़िगरेशन लोड विफल: {0}',
    config_saved: '✅ CDN कॉन्फ़िगरेशन सहेजा गया: {0}',
    config_usage: 'उपयोग: openyida cdn-config [विकल्प]',
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
    config_file_path: '📄 कॉन्फ़िगरेशन फ़ाइल: {0}',
    config_section_aliyun: '🔐 Alibaba Cloud क्रेडेंशियल',
    config_section_cdn: '🌐 CDN कॉन्फ़िगरेशन',
    config_section_oss: '📦 OSS कॉन्फ़िगरेशन',
    config_section_upload: '📤 अपलोड कॉन्फ़िगरेशन',
    config_cdn_domain: 'CDN डोमेन',
    config_oss_region: 'OSS क्षेत्र',
    config_oss_bucket: 'OSS बकेट',
    config_oss_endpoint: 'OSS एंडपॉइंट',
    config_upload_path: 'अपलोड पथ',
    config_compress: 'छवि संपीड़न',
    config_max_width: 'अधिकतम चौड़ाई',
    config_quality: 'छवि गुणवत्ता',
    config_not_set: 'सेट नहीं',
    config_enabled: 'सक्षम',
    config_disabled: 'अक्षम',
    config_status_valid: '✅ कॉन्फ़िगरेशन पूर्ण, उपयोग के लिए तैयार',
    config_status_invalid: '⚠️  कॉन्फ़िगरेशन अपूर्ण',
    config_missing: '   अनुपस्थित फ़ील्ड: {0}',
    config_updated: '✅ कॉन्फ़िगरेशन अपडेट हुआ!',
    config_init_title: '🔧 CDN कॉन्फ़िगरेशन प्रारंभ सहायक',
    config_init_desc: 'CDN छवि अपलोड उपयोग करने के लिए निम्नलिखित कॉन्फ़िगर करें:',
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
    upload_no_files: '❌ कृपया अपलोड करने के लिए छवि फ़ाइलें निर्दिष्ट करें',
    config_incomplete: '❌ CDN कॉन्फ़िगरेशन अपूर्ण है',
    missing_fields: '   अनुपस्थित फ़ील्ड: {0}',
    run_config_init: '   कृपया पहले चलाएं: openyida cdn-config --init',
    no_config: '❌ CDN कॉन्फ़िगरेशन नहीं मिला',
    oss_sdk_required: '❌ ali-oss SDK अनुपस्थित है',
    run_npm_install: '   चलाएं: npm install {0}',
    no_images_found: '❌ कोई समर्थित छवि फ़ाइल नहीं मिली',
    uploading_images: '📤 {0} छवियां अपलोड हो रही हैं...',
    uploading_file: '   अपलोड हो रहा है: {0}',
    upload_success: '   ✅ {0}',
    upload_failed: '   ❌ {0} अपलोड विफल: {1}',
    upload_summary: `
📊 अपलोड सारांश`,
    upload_success_count: '   सफल: {0}',
    upload_fail_count: '   विफल: {0}',
    cdn_urls: `
🔗 CDN URL सूची:`,
    upload_error: '❌ अपलोड विफल: {0}',
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
    refresh_no_targets: '❌ कृपया ताज़ा करने के लिए URL या निर्देशिकाएं निर्दिष्ट करें',
    cdn_sdk_required: '❌ Alibaba Cloud CDN SDK अनुपस्थित है',
    querying_quota: '📊 ताज़ा कोटा की जांच हो रही है...',
    quota_info: '   URL ताज़ा: {0}/दिन, {1} शेष | निर्देशिका: {2}/दिन, {3} शेष',
    quota_query_failed: '   ⚠️  Failed to query quota: {0}',
    refreshing_urls: '🔄 {0} URL ताज़ा हो रहे हैं...',
    refreshing_paths: '🔄 {0} निर्देशिकाएं ताज़ा हो रही हैं...',
    refresh_task_id: '   ✅ कार्य ID: {0}',
    refresh_urls_failed: '   ❌ URL ताज़ा विफल: {0}',
    refresh_paths_failed: '   ❌ निर्देशिका ताज़ा विफल: {0}',
    refresh_summary: `
📊 ताज़ा सारांश`,
    url_refresh_success: '   ✅ URL ताज़ा सफल, कार्य ID: {0}',
    path_refresh_success: '   ✅ निर्देशिका ताज़ा सफल, कार्य ID: {0}',
    refresh_error: '❌ ताज़ा विफल: {0}',
    file_not_found: '❌ फ़ाइल नहीं मिली: {0}',
  },

  // ── src/flash-note/flash-to-prd.ts ──────────────
  flash_to_prd: {
    title: '📋 DingTalk Flash Note se PRD',
    help_usage: 'Upyog: openyida flash-to-prd --file <path> [--name <project-name>]',
    help_usage2: '        openyida flash-to-prd --name <project-name>  (stdin se padhen)',
    help_args_title: 'Arguments:',
    help_arg_file: '  --file, -f <path>       Flash note file path (.txt / .md)',
    help_arg_name: '  --name, -n <name>       Project name (optional, auto-extracted)',
    help_arg_max_tokens: '  --max-tokens <count>    AI max output tokens (default 8000)',
    help_examples_title: 'Examples:',
    help_example1: '  openyida flash-to-prd --file ./meeting-notes.txt --name "Equipment Inspection"',
    help_example2: '  cat meeting.txt | openyida flash-to-prd --name "Equipment Inspection"',
    step_read: '[Step 1] Flash note content padh rahe hain...',
    file_not_found: 'File nahi mili: {0}',
    no_input: 'Koi flash note content nahi diya gaya. --file se file specify karein ya stdin se content bhejein.',
    stdin_empty: 'Standard input khali hai',
    read_success: '✅ Safaltapoorvak padha, {0} characters',
    step_load_module: '[Step 2] Prompt builder module load ho raha hai...',
    module_loaded_builtin: '✅ Built-in prompt module load kiya gaya',
    module_loaded_local: '✅ Local prompt module load kiya gaya: {0}',
    module_not_found: '❌ build-flash-note-prompt.js module nahi mila',
    module_path_tried: '  Tried path {0}: {1}',
    step_preprocess: '[Step 3] Pre-processing + meeting recognition...',
    preprocess_result: '  Pre-processing: {0} chars -> {1} chars',
    meeting_meta: '  Meeting metadata: {0} fields{1}',
    a1_sections: '  A1 summary sections: {0}{1}',
    speakers: '  Speakers identified: {0}{1}',
    speakers_with_role: ' ({0} role annotations sahit)',
    step_login: '[Step 4] Login status check kar rahe hain...',
    no_login: '  Koi login session nahi mila, login shuru ho raha hai...',
    login_ready: '✅ Login taiyar ({0})',
    step_ai: '[Step 5] PRD banane ke liye AI ko call kar rahe hain...',
    single_segment: '  Single segment mode, prompt length: {0} chars',
    multi_segment: '  Multi-segment mode, total {0} segments',
    extracting_segment: '  Segment {0}/{1} extract kar rahe hain ({2} chars)...',
    merging_segments: '  Segment results merge kar rahe hain...',
    ai_success: '✅ PRD safaltapoorvak banaya gaya',
    ai_error: 'AI API call vifal: {0}',
    done: '✅ Flash note se PRD conversion poorn',
    done_project: '  Project name: {0}',
    done_file: '  Output file: {0}',
    done_size: '  File size: {0} characters',
    done_meeting: '  Meeting recognition: {0} metadata, {1} A1 sections, {2} speakers',
  },
};
