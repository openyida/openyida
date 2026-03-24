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
  compile <arquivoFonte>                                       Compilar apenas JSX (sem publicar, saída em pages/dist/)
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
    integration_help: `Uso: openyida integration <subcomando> [args]

Subcomandos:
  create <appType> <formUuid> <flowName> [opções]   Criar integração & automação (fluxo lógico)

Exemplos:
  openyida integration create APP_XXX FORM-XXX "Notificação de novo registro" --receivers user123 --publish`,
    integration_unknown: 'Subcomando integration desconhecido: {0}',
    integration_help_hint: 'Use openyida integration --help para ver os subcomandos disponíveis',
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
    title: '  openyida env - Detecção do ambiente de ferramenta IA',
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
    logged_in: 'Conectado',
    base_url_label: '  Domain:       {0}',
    corp_id_label: '  Org ID:       {0}',
    user_id_label: '  User ID:      {0}',
    csrf_label: '  csrf_token:   {0}...',
    not_logged_in: 'Não conectado',
    unknown: '(unknown)',
  },

  // ── lib/login.js ────────────────────────────────────
  login: {
    title: '🔐 Login no Yida',
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
    title: '  create-app - Ferramenta de criação de aplicativos Yida',
    usage: 'Uso: openyida create-app <nome do app>',
    example: 'Exemplo: openyida create-app "Meu App"',
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
  Nome do app: {0}`,
    app_desc: '  Description: {0}',
    app_icon: '  Icon:        {0} ({1})',
    app_theme: '  Theme:       {0}',
    step_create: `
🚀 Criando o aplicativo...`,
    success: '  ✅ Aplicativo criado com sucesso!',
    app_type_label: '  appType: {0}',
    corp_id_label: '  corpId:  {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ Falha na criação: {0}',
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
    title: '  create-page - Ferramenta de criação de páginas personalizadas Yida',
    usage: 'Uso: openyida create-page <appType> <nome da página>',
    example: 'Example: yidacli create-page "APP_XXX" "Game Home"',
    app_id: `
  ID do app:    {0}`,
    page_name: '  Nome da página: {0}',
    step_create: `
📄 Criando página personalizada...`,
    sending: '  Sending saveFormSchemaInfo request...',
    success: '  ✅ Página personalizada criada com sucesso!',
    page_id_label: '  pageId: {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ Falha na criação: {0}',
    datasource_injecting: '  [datasource] Injetando {0} fonte(s) de dados do conector...',
    datasource_success: '  [datasource] Fonte de dados injetada com sucesso',
    datasource_failed: '  [datasource] Falha ao injetar fonte de dados: {0}',
    invalid_response: '❌ Falha ao criar página: pageId inválido retornado pelo servidor, verifique se appType está correto',
  },

  // ── lib/get-schema.js ───────────────────────────────
  get_schema: {
    title: '  get-schema - Ferramenta de obtenção de esquema Yida',
    usage: 'Uso: openyida get-schema <appType> <formUuid>',
    example: 'Example: yidacli get-schema "APP_XXX" "FORM-XXX"',
    app_id: `
  ID do app:    {0}`,
    form_uuid: '  UUID do formulário: {0}',
    step_get: `
📋 Obtendo esquema do formulário...`,
    sending: '  Sending getFormSchema request...',
    success: '  ✅ Esquema obtido com sucesso!',
    failed: '  ❌ Falha na obtenção: {0}',
  },

  // ── lib/create-form.js ──────────────────────────────
  create_form: {
    error: `
❌ Erro de criação: {0}`,
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
    usage: 'Uso: openyida get-page-config <appType> <formUuid>',
    example: 'Example: yidacli get-page-config APP_XXX FORM-XXX',
    title: '  get-page-config - Ferramenta de obtenção de configuração de página Yida',
    app_id: `
  ID do app:    {0}`,
    form_uuid: '  UUID do formulário: {0}',
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
    usage: 'Uso: openyida save-share-config <appType> <formUuid> <openUrl> <isOpen> [openAuth]',
    example: 'Example: node save-share-config.js "APP_XXX" "FORM-XXX" "/o/xxx" "y" "n"',
    is_open_hint: '  isOpen: y=enable public access, n=disable public access',
    open_auth_hint: '  openAuth: y=require auth, n=no auth required (default)',
    title: '  save-share-config - Ferramenta de salvamento de configuração de acesso público Yida',
    app_id: `
  ID do app:    {0}`,
    form_uuid: '  UUID do formulário: {0}',
    open_url: '  URL pública: {0}',
    is_open: '  Acesso público: {0}',
    open_auth: '  Auth necessária: {0}',
    step_validate: `
📋 Step 0: Validar parâmetros`,
    validate_ok: '  ✅ Validação bem-sucedida',
    validate_failed: '  ❌ Validação falhou: {0}',
    step_save: `
💾 Step 2: Salvar configuração de acesso público`,
    sending_request: '  Enviando requisição saveShareConfig...',
    save_ok: '  ✅ Configuração salva com sucesso!',
    save_ok_msg: 'Configuração de acesso público salva',
    save_failed: '  ❌ Falha ao salvar: {0}',
    save_failed_msg: 'Falha ao salvar',
    err_is_open_invalid: 'isOpen deve ser y ou n. Valor atual: {0}',
    err_open_auth_invalid: 'openAuth deve ser y ou n. Valor atual: {0}',
    err_open_url_required: 'openUrl é obrigatório para habilitar o acesso público',
    err_open_url_prefix: 'openUrl deve começar com /o/. Valor atual: {0}',
    err_open_url_chars: 'O caminho openUrl suporta apenas a-z A-Z 0-9 _ -. Valor atual: {0}',
  },

  // ── lib/update-form-config.js ──────────────────────
  update_form_config: {
    usage: 'Uso: openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    example: 'Example: node update-form-config.js "APP_XXX" "FORM_XXX" "false" "My Page"',
    params_label: 'Parameters:',
    param_is_render_nav: '  isRenderNav: true=show top nav, false=hide top nav',
    param_title: '  title: page title (required)',
    title: '  update-form-config - Ferramenta de atualização de configuração de formulário Yida',
    app_id: `
  ID do app:    {0}`,
    form_uuid: '  UUID do formulário: {0}',
    is_render_nav: '  Mostrar nav: {0}',
    page_title: '  Título da página: {0}',
    step_update: `
💾 Step 2: Atualizar configuração do formulário`,
    sending_request: '  Enviando requisição updateFormSchemaInfo...',
    update_ok: '  ✅ Configuração atualizada com sucesso!',
    nav_shown: 'Navegação superior exibida',
    nav_hidden: 'Navegação superior oculta',
    update_failed: '  ❌ Falha na atualização: {0}',
    update_failed_msg: 'Falha na atualização',
  },

  // ── lib/verify-short-url.js ────────────────────────
  verify_short_url: {
    usage: 'Uso: openyida verify-short-url <appType> <formUuid> <url>',
    example: 'Example: node verify-short-url.js "APP_XXX" "FORM-XXX" "/o/aaa"',
    formats_label: '  Supported formats:',
    format_open: '    /o/xxx - public access (external)',
    format_share: '    /s/xxx - org share (internal)',
    open_url_label: 'Public access URL',
    share_url_label: 'Org share URL',
    title: '  verify-short-url - Ferramenta de verificação de URL Yida',
    app_id: `
  ID do app:    {0}`,
    form_uuid: '  UUID do formulário: {0}',
    step_validate: `
📋 Step 0: Validar formato de URL`,
    validate_ok: '  ✅ Formato validado',
    validate_failed: '  ❌ Validação falhou: {0}',
    step_verify: `
🔍 Step 2: Verificar URL`,
    sending_request: '  Enviando requisição verifyShortUrl...',
    url_available: '  ✅ A URL está disponível!',
    open_available_msg: 'Esta URL de acesso público está disponível',
    share_available_msg: 'Esta URL de compartilhamento interno está disponível',
    url_taken: '  ❌ A URL já está em uso',
    url_taken_msg: 'Esta URL curta já está sendo usada',
    verify_failed: '  ❌ Falha na requisição de verificação',
    err_url_prefix: 'A URL deve começar com /o/ ou /s/. Valor atual: {0}',
    err_url_chars: 'O caminho URL suporta apenas a-z A-Z 0-9 _ -. Valor atual: {0}',
    err_url_empty: 'O caminho URL não pode estar vazio: {0}',
  },

  // ── lib/copy.js ────────────────────────────────────
  copy: {
    title: '  openyida copy - Inicializar diretório de trabalho Yida',
    package_root: `
📦 Raiz do pacote: {0}`,
    dest_base: '🤖 Target root: {0}',
    dest_root: '🤖 Diretório destino: {0}',
    force_mode: '⚠️  Modo --force: o diretório destino será esvaziado antes de copiar',
    no_package: `
❌ Diretório do pacote openyida não encontrado`,
    no_package_hint1: '   Certifique-se de que o openyida está instalado globalmente:',
    no_package_hint2: '   npm install -g openyida',
    no_ai_tool: `
❌ No active AI tool environment detected
   Supported tools: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder

   Current detection results:`,
    no_active_tool: `
❌ Nenhum ambiente de ferramenta IA ativo detectado`,
    supported_tools: '   Ferramentas suportadas: Wukong, OpenCode, Claude Code, Aone Copilot, Cursor, Qoder',
    current_result: `
   Resultados de detecção atuais:`,
    force_hint: `
   Para forçar a cópia para o diretório atual:
   openyida copy --force`,
    force_cmd: '   openyida copy --force',
    copying: '    Copied: {0}',
    copying_label: `
📂 Copiando {0}...`,
    creating_symlink: `
📂 Criando link simbólico yida-skills/...`,
    file_copied: '    Copiado: {0}',
    cleared: '    🗑️  Esvaziado: {0}',
    symlink_removed: '    🗑️  Link simbólico antigo removido: {0}',
    old_symlink_removed: '    🗑️  Removed old symlink: {0}',
    dir_deleted: '    🗑️  Diretório excluído: {0}',
    removed: '    🗑️  Removido: {0}',
    symlink_created: '    🔗 Link simbólico: {0} -> {1}',
    symlink_label: 'link simbólico',
    done: '✅ Concluído!',
    files_copied: '   Arquivos copiados: {0}',
    files_count: '{0} arquivos',
    symlinks_created: '   Links simbólicos criados: {0}',
    result_symlink: '   {0} → {1} (link simbólico)',
    result_copy: '   {0} → {1} ({2} arquivos)',
    wukong_skills_cleanup: `
🗑️  Ambiente Wukong: Limpando link simbólico yida-skills/...`,
    wukong_skills_cleaned: 'limpo',
    wukong_skills_not_found: '    ℹ️  Link simbólico ou diretório yida-skills/ não encontrado: {0}',
    remove_failed: '    ❌ Falha ao remover: {0} ({1})',
    symlink_fallback_copy: '    ⚠️  Criação de link simbólico Windows falhou (requer permissões de admin), usando cópia de diretório: {0}',
    symlink_failed: '    ❌ Falha ao criar link simbólico: {0} ({1})',
  },

  // ── lib/check-update.js ─────────────────────────────
  check_update: {
    new_version: `
🎉 Nova versão disponível: {0} → {1}`,
  },

  // ── lib/compile.js ─────────────────────────────────
  compile: {
    usage: 'Uso: openyida compile <arquivo-fonte>',
    example: 'Exemplo: openyida compile pages/src/demo.js',
    source_not_found: '❌ Arquivo fonte não encontrado: {0}',
    success: '✅ Compilação concluída!',
    output_file: '  Arquivo de saída: {0}',
    exception: '\n❌ Erro de compilação: {0}',
  },

  // ── lib/publish.js ─────────────────────────────────
  publish: {
    title: '  yida-publish - Ferramenta de publicação de páginas Yida',
    platform: '  Plataforma: {0}',
    base_url: `
  Platform: {0}`,
    app_type: '  App ID:   {0}',
    app_id: '  ID do app: {0}',
    form_uuid: '  ID do formulário: {0}',
    source_file: '  Fonte: {0}',
    compiled_file: '  Saída: {0}',
    output_dir: '  Output dir: pages/dist/',
    step_compile: `
📦 Step 1: Compilar fonte e construir esquema
`,
    reading_source: '[1/4] Lendo fonte {0}...',
    compiling: '[2/4] Compilando {0} com Babel...',
    compile_failed: '  ❌ Falha na compilação: {0}',
    compile_location: `
     Localização: linha {0}, coluna {1}`,
    compile_error_loc: '     Location: line {0}, column {1}',
    compile_error_code: '     Código de erro: {0}',
    minifying: '[3/4] Minificando com UglifyJS → {0}...',
    minify_failed: '  Falha na minificação: {0}',
    uglifying: '[3/4] UglifyJS minifying → {0}...',
    uglify_failed: '  Minification failed: {0}',
    compile_done: '  ✅ Compilação concluída: {0}',
    building_schema: '[4/4] Construindo esquema...',
    schema_built: '  ✅ Esquema construído com sucesso!',
    step_login: `
🔑 Step 2: Ler credenciais de login`,
    step_publish: `
📤 Step 3: Publicar esquema
`,
    resend_save_csrf: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    resend_save: '  🔄 Resending saveFormSchema request after re-login...',
    csrf_retry: '  🔄 Resending saveFormSchema request (csrf_token refreshed)...',
    relogin_retry: '  🔄 Resending saveFormSchema request after re-login...',
    publish_failed: `
❌ Falha na publicação: {0}`,
    schema_published: '  ✅ Esquema publicado com sucesso!',
    schema_success: '  ✅ Schema published successfully!',
    form_uuid_label: '  formUuid: {0}',
    version_label: '  version:  {0}',
    step_config: `
⚙️  Step 4: Atualizar configuração do formulário
`,
    sending_config: '  Sending updateFormConfig request...',
    resend_config_csrf: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    resend_config: '  🔄 Resending updateFormConfig request after re-login...',
    config_csrf_retry: '  🔄 Resending updateFormConfig request (csrf_token refreshed)...',
    config_relogin_retry: '  🔄 Resending updateFormConfig request after re-login...',
    success: '  ✅ Publicado com sucesso!',
    publish_success: '  ✅ Published successfully!',
    config_updated: '  Config updated: MINI_RESOURCE = 8',
    config_failed: '  ⚠️  Falha ao atualizar configuração: {0}',
    schema_ok_config_failed: '  Schema published, but config update failed',
    schema_published_config_failed: '  Schema published, but config update failed',
    exception: `
❌ Erro de publicação: {0}`,
    error: `
❌ Publish error: {0}`,
    source_not_found: '❌ Arquivo fonte não encontrado: {0}',
    usage: 'Uso: openyida publish <appType> <formUuid> <arquivoFonte>',
    example: 'Exemplo: openyida publish APP_XXX FORM-XXX pages/src/xxx.js',
  },

  // ── lib/qr-login.js ────────────────────────────────
  qr_login: {
    title: '🔐 Login Yida com código QR no terminal',
    step_init: '  Step 1: Inicializando sessão...',
    step_get_qr: '  Step 2: Obtendo código QR...',
    scan_hint: '  📱 Escaneie o código QR abaixo com o DingTalk:',
    qr_url_label: '  URL do código QR: {0}',
    waiting_scan: '  ⏳ Aguardando escaneamento (até 2 minutos)...',
    scanned_confirm: '  ✅ Código QR escaneado! Por favor confirme o login no seu telefone...',
    scan_success: '  ✅ Escaneamento confirmado!',
    step_exchange: '  Step 4: Trocando credenciais...',
    step_get_corps: '  Step 5: Obtendo lista de organizações...',
    step_switch_corp: '  Step 7: Mudando para a organização selecionada...',
    only_one_corp: '  ✅ Uma organização detectada: {0}, selecionada automaticamente',
    select_corp_prompt: '  🏢 Múltiplas organizações encontradas, por favor selecione uma:',
    select_corp_input: '  Digite o número (1-{0}): ',
    select_corp_invalid: '  ❌ Entrada inválida, digite um número entre 1 e {0}',
    corp_selected: '  ✅ Organização selecionada: {0}',
    login_success: '✅ Login realizado com sucesso!',
    qrcode_fallback: '  ⚠️  Pacote qrcode não instalado, visite a URL abaixo manualmente:',
    qrcode_render_failed: '  ⚠️  Falha ao renderizar código QR ({0}), visite a URL abaixo:',
    get_qr_failed: 'Failed to parse QR code response: {0}',
    get_qr_api_failed: 'QR code API failed: {0}',
    get_qr_error: 'Failed to get QR code: {0}',
    qr_expired: 'Código QR expirado, por favor faça login novamente',
    poll_timeout: 'Tempo de espera de escaneamento esgotado (2 minutos), por favor faça login novamente',
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
    no_corp_available: 'Nenhuma organização acessível encontrada',
    no_csrf_in_cookie: 'Login bem-sucedido mas csrf_token não encontrado, tente novamente',
    stdin_closed: 'Fluxo de entrada fechado, não é possível selecionar organização',
  },

  // ── scripts/postinstall.js ─────────────────────────
  postinstall: {
    welcome_title: '  🎉 Bem-vindo ao OpenYida!                                    ',
    install_success: '  ✅ Instalação concluída! {0} A ferramenta de desenvolvimento IA Yida está pronta.',
    update_success: '  ✅ Atualização concluída! {0} OpenYida foi atualizado para a versão mais recente.',
    ai_mode_title: '  🚀 Modo de conversa IA',
    ai_mode_desc: '  No Claude Code / Aone Copilot / Cursor, converse diretamente:',
    prompt1: '  📋  "Crie um sistema de gestão de presença com Yida"',
    prompt2: '  💰  "Construa um app de calculadora de salário pessoal"',
    prompt3: '  🏢  "Crie um sistema CRM de gestão de clientes"',
    prompt4: '  🎂  "Faça um mini-app de felicitações de aniversário"',
    steps_title: '  📖 Primeiros passos',
    step1: '  {0}Step 1{1}  Abra sua ferramenta IA (Claude Code / Cursor, etc.)',
    step2: '  {0}Step 2{1}  Descreva o app que deseja em linguagem natural',
    step3: '  {0}Step 3{1}  A IA executa automaticamente os comandos openyida',
    step4: '  {0}Step 4{1}  Obtenha o link do seu app Yida 🎉',
    commands_title: '  ⚡ Comandos rápidos',
    cmd_env: '  {0}openyida env{1}      {2}# Detectar ambiente de ferramenta IA e status de login{3}',
    cmd_login: '  {0}openyida login{1}    {2}# Fazer login no Yida{3}',
    cmd_help: '  {0}openyida --help{1}   {2}# Ver todos os comandos{3}',
    footer1: '  📚 Documentação: https://github.com/openyida/openyida',
    footer2: '  💬 Comunidade: Junte-se à comunidade OpenYida no DingTalk',
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
    config_load_error: 'Falha ao carregar configuração CDN: {0}',
    config_saved: '✅ Configuração CDN salva em: {0}',
    config_usage: 'Uso: openyida cdn-config [opções]',
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
    config_file_path: '📄 Arquivo de configuração: {0}',
    config_section_aliyun: '🔐 Credenciais do Alibaba Cloud',
    config_section_cdn: '🌐 Configuração CDN',
    config_section_oss: '📦 Configuração OSS',
    config_section_upload: '📤 Configuração de upload',
    config_cdn_domain: 'Domínio CDN',
    config_oss_region: 'Região OSS',
    config_oss_bucket: 'Bucket OSS',
    config_oss_endpoint: 'Endpoint OSS',
    config_upload_path: 'Caminho de upload',
    config_compress: 'Compressão de imagem',
    config_max_width: 'Largura máxima',
    config_quality: 'Qualidade de imagem',
    config_not_set: 'Não configurado',
    config_enabled: 'Habilitado',
    config_disabled: 'Desabilitado',
    config_status_valid: '✅ Configuração completa, pronta para uso',
    config_status_invalid: '⚠️  Configuração incompleta',
    config_missing: '   Campos faltantes: {0}',
    config_updated: '✅ Configuração atualizada!',
    config_init_title: '🔧 Assistente de inicialização CDN',
    config_init_desc: 'Para usar o upload de imagens CDN, configure o seguinte:',
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
    upload_no_files: '❌ Por favor especifique arquivos de imagem para upload',
    config_incomplete: '❌ Configuração CDN incompleta',
    missing_fields: '   Campos faltantes: {0}',
    run_config_init: '   Por favor execute primeiro: openyida cdn-config --init',
    no_config: '❌ Configuração CDN não encontrada',
    oss_sdk_required: '❌ SDK ali-oss ausente',
    run_npm_install: '   Execute: npm install {0}',
    no_images_found: '❌ Nenhum arquivo de imagem suportado encontrado',
    uploading_images: '📤 Fazendo upload de {0} imagens...',
    uploading_file: '   Enviando: {0}',
    upload_success: '   ✅ {0}',
    upload_failed: '   ❌ {0} falha no upload: {1}',
    upload_summary: `
📊 Resumo do upload`,
    upload_success_count: '   Sucesso: {0}',
    upload_fail_count: '   Falhas: {0}',
    cdn_urls: `
🔗 URLs CDN:`,
    upload_error: '❌ Falha no upload: {0}',
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
    refresh_no_targets: '❌ Por favor especifique URLs ou diretórios para atualizar',
    cdn_sdk_required: '❌ SDK CDN do Alibaba Cloud ausente',
    querying_quota: '📊 Consultando cota de atualização...',
    quota_info: '   Atualização URL: {0}/dia, {1} restantes | Diretórios: {2}/dia, {3} restantes',
    quota_query_failed: '   ⚠️  Failed to query quota: {0}',
    refreshing_urls: '🔄 Atualizando {0} URLs...',
    refreshing_paths: '🔄 Atualizando {0} diretórios...',
    refresh_task_id: '   ✅ ID da tarefa: {0}',
    refresh_urls_failed: '   ❌ Falha ao atualizar URLs: {0}',
    refresh_paths_failed: '   ❌ Falha ao atualizar diretórios: {0}',
    refresh_summary: `
📊 Resumo da atualização`,
    url_refresh_success: '   ✅ Atualização de URL bem-sucedida, ID da tarefa: {0}',
    path_refresh_success: '   ✅ Atualização de diretório bem-sucedida, ID da tarefa: {0}',
    refresh_error: '❌ Falha na atualização: {0}',
    file_not_found: '❌ Arquivo não encontrado: {0}',
  },

  // ── src/flash-note/flash-to-prd.ts ──────────────
  flash_to_prd: {
    title: '📋 Nota Flash DingTalk para PRD',
    help_usage: 'Uso: openyida flash-to-prd --file <caminho> [--name <nome-projeto>]',
    help_usage2: '     openyida flash-to-prd --name <nome-projeto>  (ler de stdin)',
    help_args_title: 'Argumentos:',
    help_arg_file: '  --file, -f <caminho>    Caminho do arquivo de nota flash (.txt / .md)',
    help_arg_name: '  --name, -n <nome>       Nome do projeto (opcional, extraido automaticamente)',
    help_arg_max_tokens: '  --max-tokens <qtd>      Tokens max. de saida AI (padrao 8000)',
    help_examples_title: 'Exemplos:',
    help_example1: '  openyida flash-to-prd --file ./meeting-notes.txt --name "Inspecao de equipamentos"',
    help_example2: '  cat meeting.txt | openyida flash-to-prd --name "Inspecao de equipamentos"',
    step_read: '[Passo 1] Lendo conteudo da nota flash...',
    file_not_found: 'Arquivo nao encontrado: {0}',
    no_input: 'Nenhum conteudo fornecido. Use --file para especificar um arquivo ou redirecione conteudo via stdin.',
    stdin_empty: 'A entrada padrao esta vazia',
    read_success: '✅ Leitura bem-sucedida, {0} caracteres',
    step_load_module: '[Passo 2] Carregando modulo construtor de prompt...',
    module_loaded_builtin: '✅ Modulo de prompt integrado carregado',
    module_loaded_local: '✅ Modulo de prompt local carregado: {0}',
    module_not_found: '❌ Modulo build-flash-note-prompt.js nao encontrado',
    module_path_tried: '  Caminho tentado {0}: {1}',
    step_preprocess: '[Passo 3] Pre-processamento + reconhecimento de reuniao...',
    preprocess_result: '  Pre-processamento: {0} car. -> {1} car.',
    meeting_meta: '  Metadados da reuniao: {0} campos{1}',
    a1_sections: '  Secoes resumo A1: {0}{1}',
    speakers: '  Palestrantes identificados: {0}{1}',
    speakers_with_role: ' (com {0} anotacoes de papel)',
    step_login: '[Passo 4] Verificando estado de login...',
    no_login: '  Nenhuma sessao encontrada, iniciando login...',
    login_ready: '✅ Login pronto ({0})',
    step_ai: '[Passo 5] Chamando AI para gerar PRD...',
    single_segment: '  Modo segmento unico, comprimento do prompt: {0} car.',
    multi_segment: '  Modo multi-segmento, {0} segmentos no total',
    extracting_segment: '  Extraindo segmento {0}/{1} ({2} car.)...',
    merging_segments: '  Mesclando resultados dos segmentos...',
    ai_success: '✅ PRD gerado com sucesso',
    ai_error: 'Falha na chamada API AI: {0}',
    done: '✅ Conversao de nota flash para PRD concluida',
    done_project: '  Nome do projeto: {0}',
    done_file: '  Arquivo de saida: {0}',
    done_size: '  Tamanho do arquivo: {0} caracteres',
    done_meeting: '  Reconhecimento de reuniao: {0} metadados, {1} secoes A1, {2} palestrantes',
  },
};
