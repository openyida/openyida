/**
 * zh.js - 中文翻译
 */
'use strict';

module.exports = {
  // ── 通用 ──────────────────────────────────────────

  // ── bin/yida.js ────────────────────────────────────
  cli: {
    help: `
openyida - 宜搭命令行工具

用法：
  openyida <命令> [参数...]（别名：yida）

命令：
  env                                                          检测当前 AI 工具环境和登录态
  copy [--force]                                               复制 project 工作目录到当前 AI 工具环境
  login                                                        登录态管理（优先缓存，否则扫码）
  logout                                                       退出登录 / 切换账号
  create-app "<名称>" [描述] [图标] [颜色] [主题色]             创建应用，输出 appType
  create-page <appType> "<页面名>"                             创建自定义页面，输出 pageId
  create-form create <appType> "<表单名>" <字段JSON> [选项]     创建表单页面
  create-form update <appType> <formUuid> <修改JSON>           更新表单页面
  get-schema <appType> <formUuid>                              获取表单 Schema
  compile <源文件路径>                                         仅编译 JSX 源码（不发布，产物输出到 pages/dist/）
  publish <源文件路径> <appType> <formUuid>                    编译并发布自定义页面
  verify-short-url <appType> <formUuid> <url>                  验证短链接 URL 是否可用
  save-share-config <appType> <formUuid> <url> <isOpen> [auth] 保存公开访问/分享配置
  get-page-config <appType> <formUuid>                         查询页面公开访问/分享配置
  update-form-config <appType> <formUuid> <isRenderNav> <title> 更新表单配置
  data <action> <resource> [args]                              统一数据管理（表单/流程/任务/子表单）
  export <appType> [output]                                    导出应用（生成迁移包）
  import <file> [name]                                         导入迁移包，重建应用
  auth status|login|refresh|logout                             登录态管理
  org list                                                     列出可访问的组织
  org switch --corp-id <corpId>                                切换组织
  get-permission <appType> <formUuid>                          查询表单权限配置
  save-permission <appType> <formUuid> [选项]                  保存表单权限配置
  configure-process <appType> <formUuid> <file> [processCode]  配置并发布流程
  create-process <appType> <formTitle> <fields> <processDef>   创建流程表单
  connector <子命令> [参数]                                     HTTP 连接器管理
  create-report <appType> "<名称>" <图表JSON>                   创建宜搭报表
  append-chart <appType> <reportId> <图表JSON>                  向报表追加图表
  doctor [选项]                                                环境诊断与自动修复
  cdn-config [选项]                                            配置 CDN 图片上传
  cdn-upload <图片路径> [选项]                                  上传图片到 CDN
  cdn-refresh [选项]                                           刷新 CDN 缓存

示例：
  openyida login
  openyida create-app "考勤管理"
  openyida create-form create APP_XXX "员工信息" fields.json
  openyida get-schema APP_XXX FORM-XXX
  openyida compile pages/src/home.jsx
  openyida publish pages/src/home.jsx APP_XXX FORM-XXX
  openyida data query form APP_XXX FORM-XXX --page 1 --size 20
  openyida export APP_XXX
  openyida import ./yida-export.json
  openyida connector list
  openyida create-report APP_XXX "销售报表" charts.json
  openyida doctor --fix
`,
    unknown_command: '未知命令: {0}',
    run_help: '运行 openyida --help 查看帮助',
    publish_usage: '用法: openyida publish <源文件路径> <appType> <formUuid>',
    publish_example: '示例: openyida publish pages/src/home.jsx APP_XXX FORM-XXX',
    verify_usage: '用法: openyida verify-short-url <appType> <formUuid> <url>',
    verify_example: '示例: openyida verify-short-url APP_XXX FORM-XXX /o/myapp',
    share_usage: '用法: openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]',
    share_example: '示例: openyida save-share-config APP_XXX FORM-XXX /o/myapp y n',
    page_config_usage: '用法: openyida get-page-config <appType> <formUuid>',
    page_config_example: '示例: openyida get-page-config APP_XXX FORM-XXX',
    form_config_usage: '用法: openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    form_config_example: '示例: openyida update-form-config APP_XXX FORM-XXX false "页面标题"',
    export_usage: '用法: openyida export <appType> [output]',
    export_example1: '示例: openyida export APP_XXX',
    export_example2: '      openyida export APP_XXX ./my-app-backup.json',
    import_usage: '用法: openyida import <file> [name]',
    import_example1: '示例: openyida import ./yida-export.json',
    import_example2: '      openyida import ./yida-export.json "质量追溯系统（生产环境）"',
    configure_process_usage: '用法: openyida configure-process <appType> <formUuid> <processDefinitionFile> [processCode]',
    configure_process_example: '示例: openyida configure-process "APP_XXX" "FORM-YYY" process-definition.json',
    create_process_usage: '用法: openyida create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>\n      openyida create-process <appType> --formUuid <formUuid> <processDefinitionFile>',
    create_process_example: '示例: openyida create-process "APP_XXX" "订单处理表" fields.json process-definition.json',
    get_permission_usage: '用法: openyida get-permission <appType> <formUuid>',
    get_permission_example: '示例: openyida get-permission APP_XXX FORM-XXX',
    save_permission_usage: '用法: openyida save-permission <appType> <formUuid> [--data-permission <json>] [--action-permission <json>]',
    save_permission_example: "示例: openyida save-permission APP_XXX FORM-XXX --data-permission '{\"role\":\"DEFAULT\",\"dataRange\":\"SELF\"}'",
    data_usage: '用法: openyida data <action> <resource> [args] [options]',
    data_example: '示例: openyida data query form APP_XXX FORM_XXX --page 1 --size 20',
    connector_help: `
用法: openyida connector <子命令> [参数]

子命令:
  list                                         列出 HTTP 连接器
  create "名称" "域名" --operations <file>      创建连接器
  detail <connector-id>                        查看连接器详情
  delete <connector-id> [--force]              删除连接器
  add-action --operations <file> --connector-id <id>  添加执行动作
  list-actions <connector-id>                  列出执行动作
  delete-action <connector-id> <operation-id>  删除执行动作
  test --connector-id <id> --action <actionId> 测试执行动作
  list-connections <connector-id>              列出鉴权账号
  create-connection <connector-id> <name>      创建鉴权账号
  smart-create --curl "curl命令"               智能创建连接器
  parse-api [选项]                             解析接口信息
  gen-template [输出路径]                       生成接口文档模板

使用 openyida connector <子命令> --help 查看详细帮助
`,
    connector_unknown: '未知的 connector 子命令: {0}',
    connector_help_hint: '使用 openyida connector --help 查看可用子命令',
    integration_help: `用法: openyida integration <子命令> [参数]

子命令：
  create <appType> <formUuid> <flowName> [选项]   创建集成&自动化（逻辑流）

示例：
  openyida integration create APP_XXX FORM-XXX "新增记录通知" --receivers user123 --publish`,
    integration_unknown: '未知的 integration 子命令: {0}',
    integration_help_hint: '使用 openyida integration --help 查看可用子命令',
    auth_usage: '用法: openyida auth <status|login|refresh|logout>',
    auth_example: '示例: openyida auth status',
    org_usage: '用法: openyida org <list|switch> [选项]',
    org_example: '示例: openyida org list',
    exec_failed: '\n❌ 执行失败: {0}',
    first_run_title: '  🤖 OpenYida - AI 问答模式已开启！                         ',
    first_run_welcome: '  {0}欢迎首次使用 OpenYida！{1} 以下是快速上手指南：',
    first_run_way1_title: '  📝 方式一：直接描述需求',
    first_run_way1_desc: '  在 AI 工具对话框中，直接告诉 AI 你想要什么：',
    first_run_prompt1: '  「帮我用宜搭创建一个考勤管理系统」',
    first_run_prompt2: '  「创建一个 CRM 客户管理系统」',
    first_run_prompt3: '  「帮我搭建个人薪资计算器应用」',
    first_run_way2_title: '  💡 方式二：指定详细需求',
    first_run_prompt4: '  「创建一个员工入职流程，包含基本信息填写、部门审批、HR 备案」',
    first_run_examples_title: '  📋 示例应用',
    first_run_examples: '  薪资计算器    • 生日祝福小程序    • 企业宣传页',
    first_run_tips_title: '  🔧 首次使用建议',
    first_run_tip1: '  1. 运行 {0}openyida env{1}   检测环境和登录态',
    first_run_tip2: '  2. 运行 {0}openyida login{1} 登录宜搭账号',
    first_run_tip3: '  3. 在 AI 工具中直接对话，描述你想要的应用 🚀',
    first_run_footer1: '  支持的 AI 工具：Claude Code / Aone Copilot / Cursor / OpenCode',
    first_run_footer2: '  📚 文档：https://github.com/openyida/openyida',
    first_run_footer3: '  （此引导仅首次运行时显示，运行 openyida --help 查看所有命令）',
  },

  // ── lib/env.js ─────────────────────────────────────
  env: {
    title: '  yidacli env - 环境检测',
    system_info: '\n📋 系统信息',
    os: '  操作系统:   {0} ({1})',
    node: '  Node.js:    {0}',
    home: '  主目录:     {0}',
    cwd: '  工作目录:   {0}',
    ai_tools: '\n🤖 AI 工具检测',
    no_tools: '  ⚠️  未检测到任何已知 AI 工具',
    tool_active_ready: '← 当前活跃，项目已就绪',
    tool_active_no_project: '← 当前活跃，但无 project 工作目录',
    tool_installed_has_project: '(已安装，项目存在，但未活跃)',
    tool_installed: '(已安装，未活跃)',
    active_env: '\n🎯 当前生效环境',
    ai_tool_label: '  AI 工具:    {0}',
    project_root_label: '  项目根目录: {0}',
    active_no_project: '  AI 工具:    {0} (活跃，但无 project 工作目录)',
    no_active_tool: '  AI 工具:    未检测到活跃工具',
    project_fallback: '  项目根目录: {0} (fallback)',
    login_status: '\n🔐 登录态检测',
    logged_in: '  状态:       ✅ 已登录',
    base_url_label: '  域名:       {0}',
    corp_id_label: '  组织 ID:    {0}',
    user_id_label: '  用户 ID:    {0}',
    csrf_label: '  csrf_token: {0}...',
    not_logged_in: '  状态:       ❌ 未登录（运行 yidacli login 进行登录）',
    unknown: '(未知)',
  },

  // ── lib/login.js ───────────────────────────────────
  login: {
    title: '  yidacli login - 宜搭登录工具',
    logout_title: '  yidacli logout - 宜搭退出登录工具',
    cookie_file_label: '\n  Cookie 文件: {0}',
    logout_success: '  ✅ 已清空 Cookie，登录态已失效。',
    logout_hint: '  下次调用 yidacli login 时将重新触发扫码登录。',
    logout_no_file: '  ℹ️  Cookie 文件不存在，无需清空。',
    using_cache: '🔍 检测到本地 Cookie，直接使用...',
    csrf_ok: '  ✅ csrf_token: {0}...',
    corp_id_ok: '  ✅ corpId: {0}',
    no_playwright: '\n❌ 未找到 playwright 模块，请先安装：',
    playwright_install1: '   npm install -g playwright',
    playwright_install2: '   npx playwright install chromium',
    browser_opening: '\n🔐 正在打开浏览器，请扫码登录...',
    login_url_label: '  登录地址: {0}',
    waiting_login: '  等待登录完成（最长等待 10 分钟）...',
    login_timeout: '  ⏰ 登录超时（10分钟），请重试。',
    login_success: '  ✅ 登录成功！',
    no_csrf_in_cookie: '  ❌ 登录成功但 Cookie 中无 tianshu_csrf_token，请重试。',
    no_cookie_cache: '  ❌ 本地无有效 Cookie，无法刷新，需要重新登录。',
    no_csrf_in_cache: '  ❌ Cookie 中无 tianshu_csrf_token，需要重新登录。',
    csrf_extracted: '  ✅ csrf_token 提取成功: {0}...',
    trigger_login: '\n🔐 登录态失效，正在打开浏览器扫码登录...\n',
    csrf_refresh: '\n🔄 csrf_token 已过期，正在从 Cookie 重新提取...\n',
  },

  // ── lib/auth.js ────────────────────────────────────
  auth: {
    status_title: '  yidacli auth status - 登录状态查询',
    not_logged_in: '  状态:       ❌ 未登录',
    login_hint: '  提示:       运行 openyida auth login 进行登录',
    no_csrf_token: '  状态:       ❌ 登录态无效（无 csrf_token）',
    relogin_hint: '  提示:       运行 openyida auth login 重新登录',
    logged_in: '  状态:       ✅ 已登录',
    base_url_label: '  域名:       {0}',
    corp_id_label: '  组织 ID:    {0}',
    user_id_label: '  用户 ID:    {0}',
    csrf_label: '  csrf_token: {0}...',
    login_type_label: '  登录方式:   {0}',
    login_time_label: '  登录时间:   {0}',
    login_start: '\n🔐 开始登录（方式: {0}）...',
    login_success: '\n✅ 登录成功！',
    corp_id_ok: '  ✅ corpId: {0}',
    refresh_start: '\n🔄 正在刷新登录态...',
    no_cookie_cache: '  ❌ 本地无 Cookie 缓存，无法刷新',
    no_csrf_in_cache: '  ❌ Cookie 中无 csrf_token，需要重新登录',
    refresh_success: '  ✅ 登录态刷新成功！',
    csrf_ok: '  ✅ csrf_token: {0}...',
    auth_config_cleared: '  ✅ 已清空登录配置',
  },

  // ── lib/org.js ─────────────────────────────────────
  org: {
    list_title: '  yidacli org list - 组织列表',
    no_corp_id: '  ❌ 无法获取当前组织 ID，请先登录',
    current_org: '当前组织',
    current: '当前',
    no_organizations: '  ⚠️  暂无组织信息',
    switch_title: '  yidacli org switch - 组织切换',
    switch_from: '  当前组织: {0}',
    switch_to: '  目标组织: {0}',
    already_in_org: '  ✅ 已在目标组织中，无需切换',
    step1: '\n  Step 1: 发起切换请求...',
    step2: '  Step 2: 确认切换...',
    step3: '  Step 3: 获取新登录态...',
    redirect: '  Step 4: 跟随重定向 ({0})...',
    switch_failed_no_csrf: '  ❌ 切换失败：未获取到新的 csrf_token',
    switch_success: '\n  ✅ 组织切换成功！',
    new_corp_id: '  新组织 ID:  {0}',
    new_csrf: '  csrf_token: {0}...',
    switch_error: '  ❌ 切换失败: {0}',
    only_one_org: '  ⚠️  只有一个组织，无需切换',
    select_prompt: '\n  请选择要切换的组织：',
    use_corp_id_hint: '\n  💡 提示：使用 --corp-id 参数指定目标组织',
    no_login: '❌ 未登录，请先运行 openyida login',
    switched_org: '切换后的组织',
    unknown: '未知',
  },

  // ── lib/create-app.js ──────────────────────────────
  create_app: {
    title: '  yidacli create-app - 宜搭应用创建工具',
    usage: '用法: yidacli create-app "<appName>" [description] [icon] [iconColor] [themeColor]',
    example: '示例: yidacli create-app "考勤管理" "员工考勤打卡系统" "xian-daka" "#00B853" "red"',
    available_icons: '\n可用图标:',
    icons_list: '  xian-xinwen, xian-zhengfu, xian-yingyong, xian-xueshimao, xian-qiye,\n  xian-danju, xian-shichang, xian-jingli, xian-falv, xian-baogao,\n  huoche, xian-shenbao, xian-diqiu, xian-qiche, xian-feiji,\n  xian-diannao, xian-gongzuozheng, xian-gouwuche, xian-xinyongka,\n  xian-huodong, xian-jiangbei, xian-liucheng, xian-chaxun, xian-daka',
    available_colors: '\n可用颜色:',
    colors_list: '  #0089FF #00B853 #FFA200 #FF7357 #5C72FF\n  #85C700 #FFC505 #FF6B7A #8F66FF #14A9FF',
    app_name: '  应用名称: {0}',
    app_desc: '  应用描述: {0}',
    app_icon: '  图标:     {0} ({1})',
    app_theme: '  主题色:   {0}',
    step_create: '\n📦 Step 2: 创建应用\n',
    success: '  ✅ 应用创建成功！',
    app_type_label: '  appType: {0}',
    corp_id_label: '  corpId:  {0}',
    url_label: '  访问地址: {0}',
    failed: '  ❌ 创建失败: {0}',
    prd_config_title: '## 应用配置',
    prd_config_key: '配置项',
    prd_config_value: '值',
    prd_not_found: '\n  ⚠️  未找到 prd 文档，跳过 corpId 写入',
    prd_updated: '  ✅ 已更新 prd 文档: {0}',
    prd_update_failed: '  ⚠️  更新 prd 文档失败: {0}',
  },

  // ── lib/create-page.js ─────────────────────────────
  create_page: {
    title: '  yidacli create-page - 宜搭自定义页面创建工具',
    usage: '用法: yidacli create-page <appType> "<pageName>"',
    example: '示例: yidacli create-page "APP_XXX" "游戏主页"',
    app_id: '  应用 ID:  {0}',
    page_name: '  页面名称: {0}',
    step_create: '\n📄 Step 2: 创建自定义页面\n',
    sending: '  发送 saveFormSchemaInfo 请求...',
    success: '  ✅ 页面创建成功！',
    page_id_label: '  pageId:   {0}',
    url_label: '  访问地址: {0}',
    failed: '  ❌ 创建失败: {0}',
    datasource_injecting: '  [datasource] 正在注入 {0} 个连接器数据源...',
    datasource_success: '  [datasource] 数据源注入成功',
    datasource_failed: '  [datasource] 数据源注入失败：{0}',
    invalid_response: '❌ 创建页面失败：服务端返回的 pageId 无效，请检查 appType 是否正确',
  },

  // ── lib/get-schema.js ──────────────────────────────
  get_schema: {
    title: '  yidacli get-schema - 宜搭表单 Schema 获取工具',
    usage: '用法: yidacli get-schema <appType> <formUuid>',
    example: '示例: yidacli get-schema "APP_XXX" "FORM-XXX"',
    app_id: '  应用 ID:    {0}',
    form_uuid: '  表单 UUID:  {0}',
    step_get: '\n📄 Step 2: 获取表单 Schema',
    sending: '  发送 getFormSchema 请求...',
    success: '  ✅ Schema 获取成功！',
    failed: '  ❌ 获取 Schema 失败: {0}',
  },

  // ── lib/create-form.js ─────────────────────────────
  create_form: {
    error: '\n❌ 错误: {0}',
    usage_create: '用法: openyida create-form create <appType> <formTitle> <fieldsJsonFile>',
    example_create: '示例：openyida create-form create "APP_XXX" "员工信息登记" fields.json',
    usage_update: '用法: openyida create-form update <appType> <formUuid> <changesJsonOrFile>',
    example_update: '示例：openyida create-form update "APP_XXX" "FORM-YYY" \'[{"action":"add","field":{"type":"TextField","label":"备注"}}]\'',
    usage_label: '用法:',
    usage_create_short: '  创建: openyida create-form create <appType> <formTitle> <fieldsJsonFile>',
    usage_update_short: '  更新: openyida create-form update <appType> <formUuid> <changesJsonOrFile>',
    example_label: '\n示例:',
    fields_file_not_found: '  ❌ 字段定义文件不存在: ',
    fields_format_invalid: '字段定义格式不正确',
    fields_must_be_array: '字段定义必须是非空数组',
    fields_parse_failed: '  ❌ 解析字段定义失败: ',
    changes_file_not_found: '  ❌ 修改定义文件不存在: ',
    changes_must_be_array: '修改定义必须是非空数组',
    changes_parse_failed: '  ❌ 解析修改定义失败: ',
    no_components_tree: '  ❌ Schema 中未找到 componentsTree',
    no_form_container: '  ❌ Schema 中未找到 FormContainer',
    add_missing_field: ' - 缺少 field.type 或 field.label，跳过',
    add_after_ok: ' - 在「{0}」后新增字段「{1}」({2})',
    add_after_not_found: ' - 未找到「{0}」，字段「{1}」追加到末尾',
    add_before_ok: ' - 在「{0}」前新增字段「{1}」({2})',
    add_before_not_found: ' - 未找到「{0}」，字段「{1}」追加到末尾',
    add_ok: ' - 新增字段「{0}」({1})',
    delete_missing_label: ' - 缺少 label，跳过',
    delete_ok: ' - 删除字段「{0}」',
    delete_not_found: ' - 未找到字段「{0}」，跳过删除',
    update_missing_label: ' - 缺少 label，跳过',
    update_missing_changes: ' - 缺少 changes，跳过',
    update_table_not_found: ' - 未找到子表「{0}」，跳过更新',
    update_not_table: ' - 「{0}」不是有效的子表字段，跳过更新',
    in_table: '子表「{0}」中的',
    update_ok: ' - 更新{0}字段「{1}」的属性: {2}',
    update_not_found: ' - 未找到{0}字段「{1}」，跳过更新',
    unknown_action: ' - 未知操作类型「{0}」，跳过',
    filling_rule_resolved: '  🔗 回填规则解析: @label:{0} → {1}',
    filling_rule_failed: '  ⚠️ 回填规则解析失败: 找不到标签为「{0}」的字段，请检查字段名是否正确',
    table_filling_rule: '  📋 处理子表回填规则 [{0}]: tableId={1}',
    table_rule_resolved: '    🔗 子表规则解析 [{0}]: @label:{1} → {2}',
    table_rule_failed: '    ⚠️ 子表规则解析失败: 找不到标签为「{0}」的字段，请检查字段名是否正确',
    serial_number_formula_set: '  🔢 SerialNumberField 「{0}」formula 已设置',
    schema_extract_failed: '  ❌ 无法从返回结果中提取 Schema',
    schema_response_structure: '  响应结构: {0}',
    schema_parse_failed: '无法解析 Schema 结构',
    action_label: '操作 {0}: {1}',
  },
  common: {
    http_status: '  HTTP 状态码: {0}',
    http_response: '  HTTP 响应: {0}',
    response_body: '  响应内容: {0}',
    response_detail: '  响应详情: {0}',
    response_not_json: '响应非 JSON',
    login_expired: '  检测到登录过期: {0}',
    csrf_expired: '  检测到 csrf_token 过期: {0}',
    csrf_refreshed: '  csrf_token 已刷新',
    request_timeout: '  ❌ 请求超时',
    request_failed: '请求失败',
    request_failed_label: '  ❌ 请求失败',
    unknown_error: '未知错误',
    step_login: '\n🔑 Step 1: 读取登录态',
    step_login_label: '\n🔑 读取登录态',
    no_login_cache: '  ⚠️  未找到本地登录态，触发登录...',
    login_no_cache: '  ⚠️  未找到本地登录态，触发登录...',
    login_ready: '  ✅ 登录态已就绪（{0}）',
    resend: '  🔄 重新发送请求...',
    resend_csrf: '  🔄 重新发送请求（csrf_token 已刷新）...',
    relogin_retry: '  🔄 重新登录后重新发送请求...',
    exception: '\n❌ 异常: {0}',
    yes: '是',
    no: '否',
    empty: '（空）',
  },

  // ── lib/export-app.js ──────────────────────────────
  export: {
    usage: '用法: openyida export <appType> [output]',
    example1: '示例: openyida export APP_XXXXXXXXXXXXX',
    example2: '      openyida export APP_XXXXXXXXXXXXX ./my-app-backup.json',
    title: '  openyida export - 宜搭应用导出工具',
    app_id: '\n  应用 ID:  {0}',
    output_file: '  输出文件: {0}',
    step_get_forms: '\n📋 Step 2: 获取应用表单列表',
    no_forms: '  ⚠️  未找到任何表单页面，请确认应用 ID 是否正确',
    forms_found: '  ✅ 找到 {0} 个表单页面',
    step_export_schema: '\n📦 Step 3: 导出表单 Schema',
    exporting: '\n  正在导出: {0} ({1})',
    export_ok: '    ✅ 导出成功',
    export_failed: '    ⚠️  导出失败，跳过',
    step_write_file: '\n💾 Step 4: 写入导出文件',
    done: '  ✅ 导出完成！',
    success_count: '  成功: {0} 个表单',
    fail_count: '  失败: {0} 个表单（已跳过）',
    fetch_forms_failed: '获取表单列表失败',
    unnamed_form: '未命名表单',
  },

  // ── lib/import-app.js ──────────────────────────────
  import_example2: '      openyida import ./yida-export.json "质量追溯系统（生产环境）"',
  exec_failed: '\n❌ 执行失败: {0}',
  auth_usage: '用法: openyida auth <status|login|refresh|logout>',
  auth_example: '示例:\n  openyida auth status   # 查看登录状态\n  openyida auth login    # 执行登录\n  openyida auth refresh  # 刷新登录态\n  openyida auth logout   # 退出登录',
  org_usage: '用法: openyida org <list|switch>',
  org_example: '示例:\n  openyida org list                    # 列出可访问的组织\n  openyida org switch --corp-id dingXXX  # 切换到指定组织',
  title: '  openyida import - 宜搭应用导入工具',
  // ── lib/get-page-config.js ─────────────────────────
  get_page_config: {
    usage: '用法: yidacli get-page-config <appType> <formUuid>',
    example: '示例: yidacli get-page-config APP_XXX FORM-XXX',
    title: '  get-page-config - 宜搭页面配置查询工具',
    app_id: '\n  应用 ID:    {0}',
    form_uuid: '  表单 UUID:  {0}',
    step_query: '\n🔍 Step 2: 查询页面配置',
    sending_request: '  发送 getShareConfig 请求...',
    query_ok: '  ✅ 查询成功！',
    open_url: '  公开访问: {0}',
    share_url: '  组织内分享: {0}',
    no_config: '  （暂未配置公开访问或分享链接）',
    query_failed: '  ❌ 查询失败: {0}',
  },

  // ── lib/save-share-config.js ───────────────────────
  save_share_config: {
    usage: '用法: node save-share-config.js <appType> <formUuid> <openUrl> <isOpen> [openAuth]',
    example: '示例: node save-share-config.js "APP_XXX" "FORM-XXX" "/o/xxx" "y" "n"',
    is_open_hint: '  isOpen: y=开启公开访问, n=关闭公开访问',
    open_auth_hint: '  openAuth: y=需要授权, n=不需要授权（默认）',
    title: '  save-share-config - 宜搭公开访问配置保存工具',
    app_id: '\n  应用 ID:      {0}',
    form_uuid: '  表单 UUID:    {0}',
    open_url: '  公开访问路径: {0}',
    is_open: '  是否开放:     {0}',
    open_auth: '  是否需要授权: {0}',
    step_validate: '\n📋 Step 0: 验证参数',
    validate_ok: '  ✅ 参数验证通过',
    validate_failed: '  ❌ 参数验证失败: {0}',
    step_save: '\n💾 Step 2: 保存公开访问配置',
    sending_request: '  发送 saveShareConfig 请求...',
    save_ok: '  ✅ 配置保存成功！',
    save_ok_msg: '公开访问配置已保存',
    save_failed: '  ❌ 保存失败: {0}',
    save_failed_msg: '保存失败',
    err_is_open_invalid: 'isOpen 必须为 y 或 n，当前值: {0}',
    err_open_auth_invalid: 'openAuth 必须为 y 或 n，当前值: {0}',
    err_open_url_required: '开启公开访问时，openUrl 不能为空',
    err_open_url_prefix: 'openUrl 必须以 /o/ 开头，当前值: {0}',
    err_open_url_chars: 'openUrl 路径部分只支持 a-z A-Z 0-9 _ -，当前值: {0}',
  },

  // ── lib/update-form-config.js ──────────────────────
  update_form_config: {
    usage: '用法: node update-form-config.js <appType> <formUuid> <isRenderNav> <title>',
    example: '示例: node update-form-config.js "APP_XXX" "FORM_XXX" "false" "我的页面"',
    params_label: '参数说明:',
    param_is_render_nav: '  isRenderNav: true=显示顶部导航, false=隐藏顶部导航',
    param_title: '  title: 页面标题（必填）',
    title: '  update-form-config - 宜搭表单配置更新工具',
    app_id: '\n  应用 ID:      {0}',
    form_uuid: '  表单 UUID:    {0}',
    is_render_nav: '  显示导航:     {0}',
    page_title: '  页面标题:     {0}',
    step_update: '\n💾 Step 2: 更新表单配置（隐藏顶部导航）',
    sending_request: '  发送 updateFormSchemaInfo 请求...',
    update_ok: '  ✅ 配置更新成功！',
    nav_shown: '已显示顶部导航',
    nav_hidden: '已隐藏顶部导航',
    update_failed: '  ❌ 更新失败: {0}',
    update_failed_msg: '更新失败',
  },

  // ── lib/verify-short-url.js ────────────────────────
  verify_short_url: {
    usage: '用法: node verify-short-url.js <appType> <formUuid> <url>',
    example: '示例: node verify-short-url.js "APP_XXX" "FORM-XXX" "/o/aaa"',
    formats_label: '  支持两种格式：',
    format_open: '    /o/xxx - 公开访问（对外）',
    format_share: '    /s/xxx - 组织内分享（对内）',
    open_url_label: '公开访问路径',
    share_url_label: '组织内分享路径',
    title: '  verify-short-url - 宜搭 URL 验证工具',
    app_id: '\n  应用 ID:      {0}',
    form_uuid: '  表单 UUID:    {0}',
    step_validate: '\n📋 Step 0: 验证 URL 格式',
    validate_ok: '  ✅ 格式验证通过',
    validate_failed: '  ❌ 格式验证失败: {0}',
    step_verify: '\n🔍 Step 2: 验证 URL',
    sending_request: '  发送 verifyShortUrl 请求...',
    url_available: '  ✅ URL 可用！',
    open_available_msg: '该公开访问路径可用',
    share_available_msg: '该组织内分享路径可用',
    url_taken: '  ❌ URL 被占用',
    url_taken_msg: '该短链接已被占用',
    verify_failed: '  ❌ 验证请求失败',
    err_url_prefix: 'URL 必须以 /o/ 或 /s/ 开头，当前值: {0}',
    err_url_chars: 'URL 路径部分只支持 a-z A-Z 0-9 _ -，当前值: {0}',
    err_url_empty: 'URL 路径部分不能为空: {0}',
  },
  // ── lib/copy.js ────────────────────────────────────
  copy: {
    title: '  openyida copy - 初始化宜搭工作目录',
    package_root: '\n📦 包根目录: {0}',
    dest_base: '🤖 目标根目录: {0}',
    dest_root: '🤖 目标根目录: {0}',
    force_mode: '⚠️  --force 模式：目标目录将被清空后重新复制',
    no_package: '\n❌ 未找到 openyida 安装包目录',
    no_package_hint1: '   请确认 openyida 已正确全局安装：',
    no_package_hint2: '   npm install -g openyida',
    no_ai_tool: '\n❌ 未检测到活跃的 AI 工具环境\n   支持的工具：悟空、OpenCode、Claude Code、Aone Copilot、Cursor、Qoder\n\n   当前检测结果：',
    no_active_tool: '\n❌ 未检测到活跃的 AI 工具环境',
    supported_tools: '   支持的工具：悟空、OpenCode、Claude Code、Aone Copilot、Cursor、Qoder',
    current_result: '\n   当前检测结果：',
    force_hint: '\n   如需强制复制到当前目录，请运行：\n   openyida copy --force',
    force_cmd: '   openyida copy --force',
    copying: '    复制: {0}',
    copying_label: '\n📂 复制 {0}...',
    creating_symlink: '\n📂 创建 yida-skills/ 软链接...',
    file_copied: '    复制: {0}',
    cleared: '    🗑️  已清空: {0}',
    symlink_removed: '    🗑️  已移除旧软链接: {0}',
    old_symlink_removed: '    🗑️  已移除旧软链接: {0}',
    dir_deleted: '    🗑️  已删除实际目录: {0}',
    removed: '    🗑️  已移除: {0}',
    symlink_created: '    🔗 软链接: {0} -> {1}',
    symlink_label: '软链接',
    done: '✅ 完成！',
    files_copied: '   复制文件: {0} 个',
    files_count: '{0} 个文件',
    symlinks_created: '   创建软链接: {0} 个',
    result_symlink: '   {0} → {1} (软链接)',
    result_copy: '   {0} → {1} ({2} 个文件)',
    wukong_skills_cleanup: '\n🗑️  悟空环境：清理 yida-skills/ 软链（悟空通过手动上传技能，不需要软链）...',
    wukong_skills_cleaned: '已清理',
    wukong_skills_not_found: '    ℹ️  未找到 yida-skills/ 软链或目录，无需清理: {0}',
    remove_failed: '    ❌ 删除失败: {0} ({1})',
    symlink_fallback_copy: '    ⚠️  Windows 软链创建失败（需要管理员权限），降级为目录复制: {0}',
    symlink_failed: '    ❌ 软链接创建失败: {0} ({1})',
  },

  // ── lib/check-update.js ────────────────────────────
  check_update: {
    new_version: '\n💡 发现新版本 {0}（当前 {1}）\n   运行以下命令更新：\n   npm install -g openyida@latest\n',
  },

  // ── lib/compile.js ─────────────────────────────────
  compile: {
    usage: '用法: openyida compile <源文件路径>',
    example: '示例：openyida compile pages/src/demo.js',
    source_not_found: '❌ 源文件不存在：{0}',
    success: '✅ 编译完成！',
    output_file: '  产物路径：{0}',
    exception: '\n❌ 编译异常: {0}',
  },

  // ── lib/publish.js ─────────────────────────────────
  publish: {
    title: '  yida-publish - 宜搭页面发布工具',
    platform: '  平台地址: {0}',
    base_url: '\n  平台地址: {0}',
    app_type: '  应用ID:   {0}',
    app_id: '  应用ID:   {0}',
    form_uuid: '  表单ID:   {0}',
    source_file: '  源文件：   {0}',
    compiled_file: '  编译产物：{0}',
    output_dir: '  输出目录：pages/dist/',
    step_compile: '\n📦 Step 1: 编译源码 & 构建 Schema\n',
    reading_source: '[1/4] 读取 {0} 源码...',
    compiling: '[2/4] Babel 编译 {0}...',
    compile_failed: '  ❌ 编译失败：{0}',
    compile_location: '\n     位置: 第 {0} 行, 第 {1} 列',
    compile_error_loc: '     位置: 第 {0} 行, 第 {1} 列',
    compile_error_code: '     错误码: {0}',
    minifying: '[3/4] UglifyJS 压缩 → {0}...',
    minify_failed: '  压缩失败：{0}',
    uglifying: '[3/4] UglifyJS 压缩 → {0}...',
    uglify_failed: '  压缩失败：{0}',
    compile_done: '  ✅ 编译压缩完成：{0}',
    building_schema: '[4/4] 构建 Schema...',
    schema_built: '  ✅ Schema 构建完成！',
    step_login: '\n🔑 Step 2: 读取登录态',
    step_publish: '\n📤 Step 3: 发布 Schema\n',
    resend_save_csrf: '  🔄 重新发送 saveFormSchema 请求（csrf_token 已刷新）...',
    resend_save: '  🔄 重新发送 saveFormSchema 请求...',
    csrf_retry: '  🔄 重新发送 saveFormSchema 请求（csrf_token 已刷新）...',
    relogin_retry: '  🔄 重新发送 saveFormSchema 请求...',
    publish_failed: '\n❌ 发布失败: {0}',
    schema_published: '  ✅ Schema 发布成功！',
    schema_success: '  ✅ Schema 发布成功！',
    form_uuid_label: '  formUuid: {0}',
    version_label: '  version:  {0}',
    step_config: '\n⚙️  Step 4: 更新表单配置\n',
    sending_config: '  发送 updateFormConfig 请求...',
    resend_config_csrf: '  🔄 重新发送 updateFormConfig 请求（csrf_token 已刷新）...',
    resend_config: '  🔄 重新发送 updateFormConfig 请求...',
    config_csrf_retry: '  🔄 重新发送 updateFormConfig 请求（csrf_token 已刷新）...',
    config_relogin_retry: '  🔄 重新发送 updateFormConfig 请求...',
    success: '  ✅ 发布成功！',
    publish_success: '  ✅ 发布成功！',
    config_updated: '  配置已更新: MINI_RESOURCE = 8',
    config_failed: '  ⚠️  配置更新失败: {0}',
    schema_ok_config_failed: '  Schema 已发布，但配置更新失败',
    schema_published_config_failed: '  Schema 已发布，但配置更新失败',
    exception: '\n❌ 发布异常: {0}',
    error: '\n❌ 发布异常: {0}',
    source_not_found: '❌ 源文件不存在：{0}',
    usage: '用法: openyida publish <appType> <formUuid> <源文件路径>',
    example: '示例：openyida publish APP_XXX FORM-XXX pages/src/xxx.js',
  },

  // ── lib/qr-login.js ────────────────────────────────
  qr_login: {
    title: '🔐 宜搭终端二维码登录',
    step_init: '  Step 1: 初始化会话...',
    step_get_qr: '  Step 2: 获取二维码...',
    scan_hint: '  📱 请用钉钉扫描以下二维码登录：',
    qr_url_label: '  二维码链接: {0}',
    waiting_scan: '  ⏳ 等待扫码中（最长 2 分钟）...',
    scanned_confirm: '  ✅ 已扫码！请在手机上确认登录...',
    scan_success: '  ✅ 扫码确认成功！',
    step_exchange: '  Step 4: 获取登录凭证...',
    step_get_corps: '  Step 5: 获取组织列表...',
    step_switch_corp: '  Step 7: 切换到目标组织...',
    only_one_corp: '  ✅ 检测到唯一组织：{0}，自动选择',
    select_corp_prompt: '  🏢 检测到多个可访问组织，请选择：',
    select_corp_input: '  请输入序号 (1-{0}): ',
    select_corp_invalid: '  ❌ 无效输入，请输入 1 到 {0} 之间的数字',
    corp_selected: '  ✅ 已选择组织：{0}',
    login_success: '✅ 登录成功！',
    qrcode_fallback: '  ⚠️  qrcode 包未安装，请手动访问以下链接完成登录：',
    qrcode_render_failed: '  ⚠️  二维码渲染失败（{0}），请手动访问以下链接：',
    get_qr_failed: '获取二维码响应解析失败: {0}',
    get_qr_api_failed: '获取二维码接口失败: {0}',
    get_qr_error: '获取二维码失败: {0}',
    qr_expired: '二维码已过期，请重新登录',
    poll_timeout: '等待扫码超时（2 分钟），请重新登录',
    poll_error: '轮询扫码状态失败: {0}',
    exchange_failed: '换取登录凭证响应解析失败: {0}',
    exchange_api_failed: '换取登录凭证接口失败: {0}',
    exchange_error: '换取登录凭证失败: {0}',
    get_corp_list_failed: '获取组织列表响应解析失败: {0}',
    get_corp_list_api_failed: '获取组织列表接口失败: {0}',
    get_corps_warn: '  ⚠️  获取组织列表失败（{0}），将使用默认组织',
    switch_corp_failed: '切换组织失败: {0}',
    switch_corp_warn: '  ⚠️  切换组织失败（{0}），将使用当前组织',
    select_corp_warn: '  ⚠️  组织选择失败（{0}），将使用默认组织',
    no_corp_available: '未找到可访问的组织',
    no_csrf_in_cookie: '登录成功但未获取到 csrf_token，请重试',
    stdin_closed: '输入流已关闭，无法选择组织',
  },

  // ── scripts/postinstall.js ─────────────────────────
  postinstall: {
    welcome_title: '  🎉 欢迎使用 OpenYida！                                    ',
    install_success: '  ✅ 安装成功！{0} 宜搭 AI 应用开发工具已就绪。',
    update_success: '  ✅ 更新成功！{0} OpenYida 已升级到最新版本。',
    ai_mode_title: '  🚀 开启 AI 问答模式',
    ai_mode_desc: '  在 Claude Code / Aone Copilot / Cursor 等 AI 工具中直接对话：',
    prompt1: '  📋  「帮我用宜搭创建一个考勤管理系统」',
    prompt2: '  💰  「帮我搭建个人薪资计算器应用」',
    prompt3: '  🏢  「创建一个 CRM 客户管理系统」',
    prompt4: '  🎂  「做一个生日祝福小程序」',
    steps_title: '  📖 基础使用步骤',
    step1: '  {0}Step 1{1}  打开你的 AI 编程工具（Claude Code / Cursor 等）',
    step2: '  {0}Step 2{1}  直接用自然语言描述你想要的应用',
    step3: '  {0}Step 3{1}  AI 自动调用 openyida 命令完成创建和发布',
    step4: '  {0}Step 4{1}  获得可访问的宜搭应用链接 🎉',
    commands_title: '  ⚡ 快捷命令',
    cmd_env: '  {0}openyida env{1}      {2}# 检测当前 AI 工具环境和登录态{3}',
    cmd_login: '  {0}openyida login{1}    {2}# 登录宜搭账号{3}',
    cmd_help: '  {0}openyida --help{1}   {2}# 查看所有命令{3}',
    footer1: '  📚 文档：https://github.com/openyida/openyida',
    footer2: '  💬 社区：钉钉扫码加入 OpenYida 社区',
  },

  // ── lib/integration/integration-create.js ─────────
  integration: {
    create_usage: '用法: openyida integration create <appType> <formUuid> <flowName> [选项]',
    create_args_title: '参数:',
    create_arg_app_type: '  appType                                应用 ID，如 APP_XXXX',
    create_arg_form_uuid: '  formUuid                               触发表单 UUID，如 FORM-XXXX',
    create_arg_flow_name: '  flowName                               逻辑流名称',
    create_options_title: '选项:',
    create_opt_process_code: '  --process-code <code>                  已有逻辑流的 processCode（LPROC-xxx），不传则自动新建',
    create_opt_receivers: '  --receivers <userId,...>               接收钉钉工作通知的用户 ID，多个用逗号分隔',
    create_opt_title: '  --title <title>                        通知标题，支持 #{fieldId-ComponentType}# 引用字段',
    create_opt_content: '  --content <content>                    通知内容，支持 #{fieldId-ComponentType}# 引用字段',
    create_opt_events: '  --events <insert,update,...>           触发事件，可选: insert/update/delete/comment，默认 insert',
    create_opt_data_form_uuid: '  --data-form-uuid <formUuid>            获取单条数据节点的目标表单 UUID',
    create_opt_data_condition: '  --data-condition <b:bName:a[:type]>    获取单条数据的过滤条件，可多次传入',
    create_opt_add_data_form_uuid: '  --add-data-form-uuid <formUuid>        新增数据节点的目标表单 UUID',
    create_opt_add_data_assignment: '  --add-data-assignment <col:type:val>   新增数据字段赋值，可多次传入',
    create_opt_publish: '  --publish                              保存后立即发布（开启），否则仅保存草稿',
    create_examples_title: '示例:',
    create_example1: '  openyida integration create APP_XXX FORM-XXX "新增记录通知" \\',
    create_example2: '    --receivers user123 --title "有新记录提交" --content "请及时处理" --publish',
    create_unknown_sub: '未知的 integration 子命令: {0}',
    create_missing_args: '错误：缺少必填参数 appType、formUuid 或 flowName',
    create_invalid_events: '错误：--events 参数无效，可选值为 insert / update / delete / comment（或 create）',
    create_no_receivers: '警告：未指定 --receivers，通知接收人为空，流程将创建但无法发送通知',
    create_title: '🔗 创建集成&自动化（逻辑流）',
    create_app_type: '  应用 ID：{0}',
    create_form_uuid: '  触发表单：{0}',
    create_flow_name: '  流程名称：{0}',
    create_mode_update: '  模式：覆盖更新已有逻辑流',
    create_mode_new: '  模式：新建逻辑流',
    create_process_code: '  processCode：{0}',
    create_events: '  触发事件：{0}',
    create_receivers: '  通知接收人：{0}',
    create_receivers_empty: '（未设置）',
    create_notify_title: '  通知标题：{0}',
    create_notify_content: '  通知内容：{0}',
    create_data_form: '  获取单条数据表单：{0}',
    create_data_conditions: '  过滤条件数量：{0}',
    create_op_mode_publish: '  操作模式：保存并发布',
    create_op_mode_draft: '  操作模式：仅保存草稿',
    create_step: '\n[{0}/{1}] {2}',
    create_step_login: '读取登录态...',
    create_no_cache: '  未找到登录缓存，触发登录...',
    create_login_ok: '  ✅ 登录态就绪，baseUrl: {0}',
    create_step_new_flow: '新建逻辑流绑定关系...',
    create_new_flow_ok: '  ✅ 新建成功，processCode：{0}',
    create_new_flow_failed: '  ❌ {0}',
    create_step_get_schema: '  📋 获取目标表单 Schema...',
    create_get_schema_ok: '  ✅ 获取到 {0} 个字段',
    create_get_schema_warn: '  ⚠️  获取目标表单 Schema 失败（将使用空字段列表）：{0}',
    create_step_save: '保存逻辑流...',
    create_save_failed: '  ❌ 保存逻辑流失败：{0}',
    create_save_ok: '  ✅ 逻辑流保存成功（草稿状态）',
    create_step_publish: '发布逻辑流...',
    create_publish_warn: '  ⚠️  发布逻辑流失败：{0}',
    create_publish_draft_hint: '  （逻辑流已保存为草稿，可在宜搭平台手动发布）',
    create_published_ok: '  ✅ 逻辑流发布成功（已开启）',
    create_done_published: '✅ 集成&自动化创建并发布完成',
    create_done_draft: '✅ 集成&自动化已保存为草稿',
    create_draft_hint: '  提示：使用 --publish 参数可在创建时直接发布',
  },

  // ── lib/cdn-*.js ───────────────────────────────────
  cdn: {
    // 配置管理
    config_load_error: '加载 CDN 配置失败: {0}',
    config_saved: '✅ CDN 配置已保存到: {0}',
    config_usage: '用法: openyida cdn-config [选项]',
    config_examples: `
示例:
  openyida cdn-config --init
  openyida cdn-config --show
  openyida cdn-config --set-domain cdn.example.com`,
    config_options: `
选项:
  --init                初始化配置（交互式）
  --show                显示当前配置
  --set-key <key>       设置 AccessKey ID
  --set-secret <secret> 设置 AccessKey Secret
  --set-domain <domain> 设置 CDN 加速域名
  --set-bucket <bucket> 设置 OSS Bucket 名称
  --set-region <region> 设置 OSS 区域
  --set-path <path>     设置上传目录前缀`,
    config_file_path: '📄 配置文件: {0}',
    config_section_aliyun: '🔐 阿里云凭证',
    config_section_cdn: '🌐 CDN 配置',
    config_section_oss: '📦 OSS 配置',
    config_section_upload: '📤 上传配置',
    config_cdn_domain: 'CDN 加速域名',
    config_oss_region: 'OSS 区域',
    config_oss_bucket: 'OSS Bucket',
    config_oss_endpoint: 'OSS Endpoint',
    config_upload_path: '上传目录',
    config_compress: '图片压缩',
    config_max_width: '最大宽度',
    config_quality: '图片质量',
    config_not_set: '未设置',
    config_enabled: '启用',
    config_disabled: '禁用',
    config_status_valid: '✅ 配置完整，可以使用',
    config_status_invalid: '⚠️  配置不完整',
    config_missing: '   缺少字段: {0}',
    config_updated: '✅ 配置已更新！',
    config_init_title: '🔧 CDN 配置初始化向导',
    config_init_desc: '要使用 CDN 图片上传功能，需要配置以下信息：',
    config_init_example: '示例配置：',
    config_init_hint: '💡 请使用以下命令配置各项参数：',
    config_init_or: '   或一次性配置所有参数：',

    // 上传
    upload_usage: '用法: openyida cdn-upload <图片路径> [选项]',
    upload_examples: `
示例:
  yida cdn-upload ./image.png
  yida cdn-upload ./images/*.png --domain cdn.example.com
  yida cdn-upload ./photo.jpg --path products/`,
    upload_options: `
选项:
  --domain <域名>   CDN 加速域名（可选）
  --path <路径>     上传目录前缀（可选）
  --compress        启用图片压缩（默认启用）
  --no-compress     禁用图片压缩`,
    upload_no_files: '❌ 请指定要上传的图片文件',
    config_incomplete: '❌ CDN 配置不完整',
    missing_fields: '   缺少字段: {0}',
    run_config_init: '   请先运行: openyida cdn-config --init',
    no_config: '❌ 未找到 CDN 配置',
    oss_sdk_required: '❌ 缺少 ali-oss SDK',
    run_npm_install: '   请运行: npm install {0}',
    no_images_found: '❌ 未找到支持的图片文件',
    uploading_images: '📤 正在上传 {0} 个图片...',
    uploading_file: '   上传: {0}',
    upload_success: '   ✅ {0}',
    upload_failed: '   ❌ {0} 上传失败: {1}',
    upload_summary: '\n📊 上传汇总',
    upload_success_count: '   成功: {0} 个',
    upload_fail_count: '   失败: {0} 个',
    cdn_urls: '\n🔗 CDN URL 列表:',
    upload_error: '❌ 上传失败: {0}',

    // 刷新
    refresh_usage: '用法: openyida cdn-refresh [选项]',
    refresh_examples: `
示例:
  yida cdn-refresh --urls "https://cdn.example.com/image.png"
  yida cdn-refresh --paths "/yida-images/"
  yida cdn-refresh --file urls.txt`,
    refresh_options: `
选项:
  --urls <URL列表>    刷新的 URL 列表（逗号分隔）
  --paths <路径列表>  刷新的目录路径列表（逗号分隔）
  --file <文件>       从文件读取 URL 列表（每行一个）`,
    refresh_no_targets: '❌ 请指定要刷新的 URL 或目录',
    cdn_sdk_required: '❌ 缺少阿里云 CDN SDK',
    querying_quota: '📊 查询刷新配额...',
    quota_info: '   URL 刷新: {0}/天, 剩余 {1} | 目录刷新: {2}/天, 剩余 {3}',
    quota_query_failed: '   ⚠️  查询配额失败: {0}',
    refreshing_urls: '🔄 正在刷新 {0} 个 URL...',
    refreshing_paths: '🔄 正在刷新 {0} 个目录...',
    refresh_task_id: '   ✅ 任务 ID: {0}',
    refresh_urls_failed: '   ❌ URL 刷新失败: {0}',
    refresh_paths_failed: '   ❌ 目录刷新失败: {0}',
    refresh_summary: '\n📊 刷新汇总',
    url_refresh_success: '   ✅ URL 刷新成功，任务 ID: {0}',
    path_refresh_success: '   ✅ 目录刷新成功，任务 ID: {0}',
    refresh_error: '❌ 刷新失败: {0}',
    file_not_found: '❌ 文件不存在: {0}',
  },

  // ── src/flash-note/flash-to-prd.ts ──────────────
  flash_to_prd: {
    title: '📋 钉钉闪记转 PRD',
    help_usage: '用法：openyida flash-to-prd --file <闪记文件路径> [--name <项目名>]',
    help_usage2: '      openyida flash-to-prd --name <项目名>  （从标准输入读取）',
    help_args_title: '参数：',
    help_arg_file: '  --file, -f <路径>       闪记文本文件路径（支持 .txt / .md）',
    help_arg_name: '  --name, -n <名称>       项目名称（可选，默认从闪记内容中自动提取）',
    help_arg_max_tokens: '  --max-tokens <数量>     AI 最大输出 token 数（默认 8000）',
    help_examples_title: '示例：',
    help_example1: '  openyida flash-to-prd --file ./meeting-notes.txt --name "设备巡检系统"',
    help_example2: '  cat meeting.txt | openyida flash-to-prd --name "设备巡检系统"',
    step_read: '[Step 1] 读取闪记内容...',
    file_not_found: '文件不存在：{0}',
    no_input: '未提供闪记内容。请使用 --file 指定文件，或通过管道传入内容。',
    stdin_empty: '标准输入内容为空',
    read_success: '✅ 读取成功，原文 {0} 字',
    step_load_module: '[Step 2] 加载 Prompt 构建模块...',
    module_loaded_builtin: '✅ 已加载内置 Prompt 模块',
    module_loaded_local: '✅ 已加载本地 Prompt 模块：{0}',
    module_not_found: '❌ 未找到 build-flash-note-prompt.js 模块',
    module_path_tried: '  尝试路径 {0}：{1}',
    step_preprocess: '[Step 3] 预处理 + 会议识别...',
    preprocess_result: '  预处理：{0} 字 → {1} 字',
    meeting_meta: '  会议元信息：{0} 项{1}',
    a1_sections: '  A1 摘要段落：{0} 段{1}',
    speakers: '  发言人识别：{0} 位{1}',
    speakers_with_role: '（含角色标注 {0} 位）',
    step_login: '[Step 4] 检查登录态...',
    no_login: '  未检测到登录态，触发登录...',
    login_ready: '✅ 登录态就绪（{0}）',
    step_ai: '[Step 5] 调用 AI 生成 PRD...',
    single_segment: '  单段模式，Prompt 长度：{0} 字',
    multi_segment: '  多段模式，共 {0} 段',
    extracting_segment: '  提取第 {0}/{1} 段（{2} 字）...',
    merging_segments: '  合并分段结果...',
    ai_success: '✅ PRD 生成成功',
    ai_error: 'AI 接口调用失败：{0}',
    done: '✅ 闪记转 PRD 完成',
    done_project: '  项目名称：{0}',
    done_file: '  输出文件：{0}',
    done_size: '  文件大小：{0} 字',
    done_meeting: '  会议识别：元信息 {0} 项，A1 摘要 {1} 段，发言人 {2} 位',
  },
};
