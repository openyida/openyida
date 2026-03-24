/**
 * ja.js - 日本語翻訳
 */
'use strict';


module.exports = {

  // ── bin/yida.js ────────────────────────────────────
  cli: {
    help: `
openyida - Yida CLI ツール

使用方法：
  openyida <コマンド> [引数...]（エイリアス：yida）

コマンド：
  env                                                          AI ツール環境とログイン状態を検出
  copy [--force]                                               project ディレクトリを現在の AI ツール環境にコピー
  login                                                        ログイン管理（キャッシュ優先、なければ QR スキャン）
  logout                                                       ログアウト / アカウント切り替え
  create-app "<名前>" [説明] [アイコン] [色] [テーマ]           アプリを作成し appType を出力
  create-page <appType> "<ページ名>"                           カスタムページを作成し pageId を出力
  create-form create <appType> "<フォーム名>" <フィールドJSON> [オプション]  フォームページを作成
  create-form update <appType> <formUuid> <変更JSON>           フォームページを更新
  get-schema <appType> <formUuid>                              フォーム Schema を取得
  compile <ソースファイル>                                     JSX のみコンパイル（公開なし、pages/dist/ に出力）
  publish <ソースファイル> <appType> <formUuid>                カスタムページをコンパイルして公開
  verify-short-url <appType> <formUuid> <url>                  短縮 URL が使用可能か確認
  save-share-config <appType> <formUuid> <url> <isOpen> [auth] 公開アクセス / 共有設定を保存
  get-page-config <appType> <formUuid>                         ページの公開アクセス / 共有設定を照会
  update-form-config <appType> <formUuid> <isRenderNav> <title> フォーム設定を更新
  data <action> <resource> [args]                              統合データ管理（フォーム/プロセス/タスク）
  export <appType> [output]                                    アプリをエクスポート（移行パッケージ）
  import <file> [name]                                         移行パッケージをインポートしてアプリを再構築
  auth status|login|refresh|logout                             ログイン状態管理
  org list                                                     アクセス可能な組織一覧
  org switch --corp-id <corpId>                                組織を切り替え
  get-permission <appType> <formUuid>                          フォーム権限設定を照会
  save-permission <appType> <formUuid> [オプション]            フォーム権限設定を保存
  configure-process <appType> <formUuid> <file> [processCode]  プロセスを設定して公開
  create-process <appType> <formTitle> <fields> <processDef>   プロセスフォームを作成
  connector <サブコマンド> [引数]                               HTTP コネクタ管理
  create-report <appType> "<名前>" <チャートJSON>               Yida レポートを作成
  append-chart <appType> <reportId> <チャートJSON>              レポートにチャートを追加
  doctor [オプション]                                          環境診断と自動修復
  cdn-config [オプション]                                      CDN 画像アップロード設定
  cdn-upload <画像パス> [オプション]                            画像を CDN にアップロード
  cdn-refresh [オプション]                                     CDN キャッシュを更新

使用例：
  openyida login
  openyida create-app "勤怠管理"
  openyida create-form create APP_XXX "従業員情報" fields.json
  openyida get-schema APP_XXX FORM-XXX
  openyida publish pages/src/home.jsx APP_XXX FORM-XXX
  openyida data query form APP_XXX FORM-XXX --page 1 --size 20
  openyida export APP_XXX
  openyida import ./yida-export.json
  openyida connector list
  openyida create-report APP_XXX "売上レポート" charts.json
  openyida doctor --fix
`,
    unknown_command: '不明なコマンド: {0}',
    run_help: 'openyida --help を実行してヘルプを確認してください',
    publish_usage: '使用方法: openyida publish <ソースファイル> <appType> <formUuid>',
    publish_example: '例: openyida publish pages/src/home.jsx APP_XXX FORM-XXX',
    verify_usage: '使用方法: openyida verify-short-url <appType> <formUuid> <url>',
    verify_example: '例: openyida verify-short-url APP_XXX FORM-XXX /o/myapp',
    share_usage: '使用方法: openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]',
    share_example: '例: openyida save-share-config APP_XXX FORM-XXX /o/myapp y n',
    page_config_usage: '使用方法: openyida get-page-config <appType> <formUuid>',
    page_config_example: '例: openyida get-page-config APP_XXX FORM-XXX',
    form_config_usage: '使用方法: openyida update-form-config <appType> <formUuid> <isRenderNav> <title>',
    form_config_example: '例: openyida update-form-config APP_XXX FORM-XXX false "ページタイトル"',
    export_usage: '使用方法: openyida export <appType> [output]',
    export_example1: '例: openyida export APP_XXX',
    export_example2: '    openyida export APP_XXX ./my-app-backup.json',
    import_usage: '使用方法: openyida import <file> [name]',
    import_example1: '例: openyida import ./yida-export.json',
    import_example2: '    openyida import ./yida-export.json "品質追跡システム（本番環境）"',
    configure_process_usage: '使用方法: openyida configure-process <appType> <formUuid> <processDefinitionFile> [processCode]',
    configure_process_example: '例: openyida configure-process "APP_XXX" "FORM-YYY" process-definition.json',
    create_process_usage: `使用方法: openyida create-process <appType> <formTitle> <fieldsJsonFile> <processDefinitionFile>
        openyida create-process <appType> --formUuid <formUuid> <processDefinitionFile>`,
    create_process_example: '例: openyida create-process "APP_XXX" "注文処理フォーム" fields.json process-definition.json',
    get_permission_usage: '使用方法: openyida get-permission <appType> <formUuid>',
    get_permission_example: '例: openyida get-permission APP_XXX FORM-XXX',
    save_permission_usage: '使用方法: openyida save-permission <appType> <formUuid> [--data-permission <json>] [--action-permission <json>]',
    save_permission_example: '例: openyida save-permission APP_XXX FORM-XXX --data-permission \'{"role":"DEFAULT","dataRange":"SELF"}\'',
    data_usage: '使用方法: openyida data <action> <resource> [args] [options]',
    data_example: '例: openyida data query form APP_XXX FORM_XXX --page 1 --size 20',
    connector_help: `
使用方法: openyida connector <サブコマンド> [引数]

サブコマンド:
  list                                         HTTP コネクタ一覧
  create "名前" "ドメイン" --operations <file>  コネクタを作成
  detail <connector-id>                        コネクタ詳細を表示
  delete <connector-id> [--force]              コネクタを削除
  add-action --operations <file> --connector-id <id>  アクションを追加
  list-actions <connector-id>                  アクション一覧
  delete-action <connector-id> <operation-id>  アクションを削除
  test --connector-id <id> --action <actionId> アクションをテスト
  list-connections <connector-id>              認証アカウント一覧
  create-connection <connector-id> <name>      認証アカウントを作成
  smart-create --curl "curlコマンド"            スマート作成
  parse-api [オプション]                        API 情報を解析
  gen-template [出力パス]                       API ドキュメントテンプレートを生成

openyida connector <サブコマンド> --help で詳細を確認
`,
    connector_unknown: '不明な connector サブコマンド: {0}',
    connector_help_hint: 'openyida connector --help で利用可能なサブコマンドを確認してください',
    integration_help: `使用法: openyida integration <サブコマンド> [引数]

サブコマンド：
  create <appType> <formUuid> <flowName> [オプション]   インテグレーション＆自動化（ロジックフロー）を作成

例：
  openyida integration create APP_XXX FORM-XXX "新規レコード通知" --receivers user123 --publish`,
    integration_unknown: '不明な integration サブコマンド: {0}',
    integration_help_hint: 'openyida integration --help で利用可能なサブコマンドを確認してください',
    auth_usage: '使用方法: openyida auth <status|login|refresh|logout>',
    auth_example: '例: openyida auth status',
    org_usage: '使用方法: openyida org <list|switch> [オプション]',
    org_example: '例: openyida org list',
    exec_failed: `
❌ 実行に失敗しました: {0}`,
    first_run_title: '  🤖 OpenYida - AI 会話モードが有効になりました！                ',
    first_run_welcome: '  {0}OpenYida へようこそ！{1} クイックスタートガイドをご覧ください：',
    first_run_way1_title: '  📝 方法1：ニーズを直接説明する',
    first_run_way1_desc: '  AI ツールのチャットで、作りたいものを直接伝えてください：',
    first_run_prompt1: '  「Yida で勤怠管理システムを作ってください」',
    first_run_prompt2: '  「CRM 顧客管理システムを作成してください」',
    first_run_prompt3: '  「個人給与計算アプリを構築してください」',
    first_run_way2_title: '  💡 方法2：詳細な要件を指定する',
    first_run_prompt4: '  「基本情報入力・部門承認・HR 登録を含む従業員オンボーディングフローを作成してください」',
    first_run_examples_title: '  📋 サンプルアプリ',
    first_run_examples: '  給与計算ツール    • 誕生日お祝いアプリ    • 企業ランディングページ',
    first_run_tips_title: '  🔧 はじめに',
    first_run_tip1: '  1. {0}openyida env{1} を実行して環境とログイン状態を確認',
    first_run_tip2: '  2. {0}openyida login{1} を実行してYida にログイン',
    first_run_tip3: '  3. AI ツールで作りたいアプリを説明してください 🚀',
    first_run_footer1: '  対応 AI ツール：Claude Code / Aone Copilot / Cursor / OpenCode',
    first_run_footer2: '  📚 ドキュメント：https://github.com/openyida/openyida',
    first_run_footer3: '  （このガイドは初回起動時のみ表示されます。openyida --help で全コマンドを確認できます）',
  },

  // ── lib/env.js ─────────────────────────────────────
  env: {
    title: '  yidacli env - 環境検出',
    system_info: `
📋 システム情報`,
    os: '  OS:           {0} ({1})',
    node: '  Node.js:      {0}',
    home: '  ホームディレクトリ: {0}',
    cwd: '  作業ディレクトリ:   {0}',
    ai_tools: `
🤖 AI ツール検出`,
    no_tools: '  ⚠️  既知の AI ツールが検出されませんでした',
    tool_active_ready: '← アクティブ、プロジェクト準備完了',
    tool_active_no_project: '← アクティブ、ただし project ディレクトリなし',
    tool_installed_has_project: '（インストール済み、プロジェクトあり、非アクティブ）',
    tool_installed: '（インストール済み、非アクティブ）',
    active_env: `
🎯 現在の有効環境`,
    ai_tool_label: '  AI ツール:          {0}',
    project_root_label: '  プロジェクトルート: {0}',
    active_no_project: '  AI ツール:          {0}（アクティブ、ただし project ディレクトリなし）',
    no_active_tool: '  AI ツール:          アクティブなツールが検出されませんでした',
    project_fallback: '  プロジェクトルート: {0}（フォールバック）',
    login_status: `
🔐 ログイン状態`,
    logged_in: '  状態:       ✅ ログイン済み',
    base_url_label: '  ドメイン:   {0}',
    corp_id_label: '  組織 ID:    {0}',
    user_id_label: '  ユーザー ID: {0}',
    csrf_label: '  csrf_token: {0}...',
    not_logged_in: '  状態:       ❌ 未ログイン（yidacli login を実行してログインしてください）',
    unknown: '（不明）',
  },

  // ── lib/login.js ───────────────────────────────────
  login: {
    title: '  yidacli login - Yida ログインツール',
    logout_title: '  yidacli logout - Yida ログアウトツール',
    cookie_file_label: `
  Cookie ファイル: {0}`,
    logout_success: '  ✅ Cookie をクリアしました。ログインセッションが無効になりました。',
    logout_hint: '  次回 yidacli login を実行すると QR コードスキャンが開始されます。',
    logout_no_file: '  ℹ️  Cookie ファイルが存在しません。クリア不要です。',
    using_cache: '🔍 ローカルの Cookie が見つかりました。直接使用します...',
    csrf_ok: '  ✅ csrf_token: {0}...',
    corp_id_ok: '  ✅ corpId: {0}',
    no_playwright: `
❌ playwright モジュールが見つかりません。先にインストールしてください：`,
    playwright_install1: '   npm install -g playwright',
    playwright_install2: '   npx playwright install chromium',
    browser_opening: `
🔐 ブラウザを開いて QR コードログインを開始します...`,
    login_url_label: '  ログイン URL: {0}',
    waiting_login: '  ログイン完了を待機中（最大 10 分）...',
    login_timeout: '  ⏰ ログインがタイムアウトしました（10 分）。再試行してください。',
    login_success: '  ✅ ログインに成功しました！',
    no_csrf_in_cookie: '  ❌ ログインは成功しましたが Cookie に tianshu_csrf_token がありません。再試行してください。',
    no_cookie_cache: '  ❌ 有効なローカル Cookie がありません。再ログインが必要です。',
    no_csrf_in_cache: '  ❌ Cookie に tianshu_csrf_token がありません。再ログインが必要です。',
    csrf_extracted: '  ✅ csrf_token を取得しました: {0}...',
    trigger_login: `
🔐 ログインセッションが期限切れです。ブラウザで QR コードログインを開始します...
`,
    csrf_refresh: `
🔄 csrf_token が期限切れです。Cookie から再取得中...
`,
  },

  // ── lib/auth.js ────────────────────────────────────
  auth: {
    status_title: '  yidacli auth status - ログイン状態照会',
    not_logged_in: '  状態:       ❌ 未ログイン',
    login_hint: '  ヒント:     openyida auth login を実行してログインしてください',
    no_csrf_token: '  状態:       ❌ ログイン状態が無効（csrf_token なし）',
    relogin_hint: '  ヒント:     openyida auth login で再ログインしてください',
    logged_in: '  状態:       ✅ ログイン済み',
    base_url_label: '  ドメイン:   {0}',
    corp_id_label: '  組織 ID:    {0}',
    user_id_label: '  ユーザー ID: {0}',
    csrf_label: '  csrf_token: {0}...',
    login_type_label: '  ログイン方法: {0}',
    login_time_label: '  ログイン時刻: {0}',
    login_start: `
🔐 ログイン開始（方法: {0}）...`,
    login_success: `
✅ ログイン成功！`,
    corp_id_ok: '  ✅ corpId: {0}',
    refresh_start: `
🔄 ログイン状態を更新中...`,
    no_cookie_cache: '  ❌ ローカル Cookie キャッシュなし、更新できません',
    no_csrf_in_cache: '  ❌ Cookie に csrf_token なし、再ログインが必要',
    refresh_success: '  ✅ ログイン状態を更新しました！',
    csrf_ok: '  ✅ csrf_token: {0}...',
    auth_config_cleared: '  ✅ 認証設定をクリアしました',
  },

  // ── lib/org.js ─────────────────────────────────────
  org: {
    list_title: '  yidacli org list - 組織一覧',
    no_corp_id: '  ❌ 現在の組織 ID を取得できません、先にログインしてください',
    current_org: '現在の組織',
    current: '現在',
    no_organizations: '  ⚠️  組織情報がありません',
    switch_title: '  yidacli org switch - 組織切り替え',
    switch_from: '  現在の組織: {0}',
    switch_to: '  切り替え先: {0}',
    already_in_org: '  ✅ 既にターゲット組織にいます',
    step1: `
  Step 1: 切り替えリクエストを開始...`,
    step2: '  Step 2: 切り替えを確認...',
    step3: '  Step 3: 新しい認証情報を取得...',
    redirect: '  Step 4: リダイレクトを追跡 ({0})...',
    switch_failed_no_csrf: '  ❌ 切り替え失敗: 新しい csrf_token を取得できません',
    switch_success: `
  ✅ 組織の切り替えに成功しました！`,
    new_corp_id: '  新しい組織 ID: {0}',
    new_csrf: '  csrf_token:   {0}...',
    switch_error: '  ❌ 切り替え失敗: {0}',
    only_one_org: '  ⚠️  利用可能な組織が1つしかありません',
    select_prompt: `
  切り替える組織を選択:`,
    use_corp_id_hint: `
  💡 ヒント: --corp-id オプションでターゲット組織を指定`,
    no_login: '❌ 未ログイン、先に openyida login を実行してください',
    switched_org: '切り替え後の組織',
    unknown: '不明',
  },

  // ── lib/create-app.js ──────────────────────────────
  create_app: {
    title: '  yidacli create-app - Yida アプリ作成ツール',
    usage: 'Usage: yidacli create-app "<appName>" [description] [icon] [iconColor] [themeColor]',
    example: '例: yidacli create-app "勤怠管理" "従業員勤怠システム" "xian-daka" "#00B853" "red"',
    available_icons: `
利用可能なアイコン:`,
    icons_list: `  xian-xinwen, xian-zhengfu, xian-yingyong, xian-xueshimao, xian-qiye,
  xian-danju, xian-shichang, xian-jingli, xian-falv, xian-baogao,
  huoche, xian-shenbao, xian-diqiu, xian-qiche, xian-feiji,
  xian-diannao, xian-gongzuozheng, xian-gouwuche, xian-xinyongka,
  xian-huodong, xian-jiangbei, xian-liucheng, xian-chaxun, xian-daka`,
    available_colors: `
利用可能な色:`,
    colors_list: `  #0089FF #00B853 #FFA200 #FF7357 #5C72FF
  #85C700 #FFC505 #FF6B7A #8F66FF #14A9FF`,
    app_name: '  アプリ名:   {0}',
    app_desc: '  説明:       {0}',
    app_icon: '  アイコン:   {0} ({1})',
    app_theme: '  テーマカラー: {0}',
    step_create: `
📦 Step 2: アプリを作成
`,
    success: '  ✅ アプリが正常に作成されました！',
    app_type_label: '  appType: {0}',
    corp_id_label: '  corpId:  {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ 作成に失敗しました: {0}',
    prd_config_title: '## アプリ設定',
    prd_config_key: '設定項目',
    prd_config_value: '値',
    prd_not_found: `
  ⚠️  PRD ドキュメントが見つかりません。corpId の更新をスキップします`,
    prd_updated: '  ✅ PRD ドキュメントを更新しました: {0}',
    prd_update_failed: '  ⚠️  PRD ドキュメントの更新に失敗しました: {0}',
  },

  // ── lib/create-page.js ─────────────────────────────
  create_page: {
    title: '  yidacli create-page - Yida カスタムページ作成ツール',
    usage: 'Usage: yidacli create-page <appType> "<pageName>"',
    example: '例: yidacli create-page "APP_XXX" "ゲームホーム"',
    app_id: '  アプリ ID:   {0}',
    page_name: '  ページ名:   {0}',
    step_create: `
📄 Step 2: カスタムページを作成
`,
    sending: '  saveFormSchemaInfo リクエストを送信中...',
    success: '  ✅ ページが正常に作成されました！',
    page_id_label: '  pageId: {0}',
    url_label: '  URL: {0}',
    failed: '  ❌ 作成に失敗しました: {0}',
    datasource_injecting: '  [datasource] {0} 件のコネクタデータソースを注入中...',
    datasource_success: '  [datasource] データソースの注入に成功しました',
    datasource_failed: '  [datasource] データソースの注入に失敗しました：{0}',
    invalid_response: '❌ ページの作成に失敗しました：サーバーから返された pageId が無効です。appType が正しいか確認してください',
  },

  // ── lib/get-schema.js ──────────────────────────────
  get_schema: {
    title: '  yidacli get-schema - Yida フォーム Schema 取得ツール',
    usage: 'Usage: yidacli get-schema <appType> <formUuid>',
    example: '例: yidacli get-schema "APP_XXX" "FORM-XXX"',
    app_id: '  アプリ ID:    {0}',
    form_uuid: '  フォーム UUID: {0}',
    step_get: `
📄 Step 2: フォーム Schema を取得`,
    sending: '  getFormSchema リクエストを送信中...',
    success: '  ✅ Schema の取得に成功しました！',
    failed: '  ❌ Schema の取得に失敗しました: {0}',
  },

  // ── lib/create-form.js ─────────────────────────────
  create_form: {
    error: `
❌ エラー: {0}`,
    usage_create: '使用方法: openyida create-form create <appType> <formTitle> <fieldsJsonFile>',
    example_create: '例: openyida create-form create "APP_XXX" "従業員情報" fields.json',
    usage_update: '使用方法: openyida create-form update <appType> <formUuid> <changesJsonOrFile>',
    example_update: '例: openyida create-form update "APP_XXX" "FORM-YYY" \'[{"action":"add","field":{"type":"TextField","label":"備考"}}]\'',
    usage_label: '使用方法:',
    usage_create_short: '  作成: openyida create-form create <appType> <formTitle> <fieldsJsonFile>',
    usage_update_short: '  更新: openyida create-form update <appType> <formUuid> <changesJsonOrFile>',
    example_label: `
例:`,
    fields_file_not_found: '  ❌ フィールド定義ファイルが見つかりません: ',
    fields_format_invalid: 'フィールド定義の形式が正しくありません',
    fields_must_be_array: 'フィールド定義は空でない配列である必要があります',
    fields_parse_failed: '  ❌ フィールド定義の解析に失敗しました: ',
    changes_file_not_found: '  ❌ 変更定義ファイルが見つかりません: ',
    changes_must_be_array: '変更定義は空でない配列である必要があります',
    changes_parse_failed: '  ❌ 変更定義の解析に失敗しました: ',
    no_components_tree: '  ❌ Schema に componentsTree が見つかりません',
    no_form_container: '  ❌ Schema に FormContainer が見つかりません',
    add_missing_field: ' - field.type または field.label が不足しています。スキップします',
    add_after_ok: ' - 「{0}」の後にフィールド「{1}」({2})を追加しました',
    add_after_not_found: ' - 「{0}」が見つかりません。フィールド「{1}」を末尾に追加しました',
    add_before_ok: ' - 「{0}」の前にフィールド「{1}」({2})を追加しました',
    add_before_not_found: ' - 「{0}」が見つかりません。フィールド「{1}」を末尾に追加しました',
    add_ok: ' - フィールド「{0}」({1})を追加しました',
    delete_missing_label: ' - label が不足しています。スキップします',
    delete_ok: ' - フィールド「{0}」を削除しました',
    delete_not_found: ' - フィールド「{0}」が見つかりません。削除をスキップします',
    update_missing_label: ' - label が不足しています。スキップします',
    update_missing_changes: ' - changes が不足しています。スキップします',
    update_table_not_found: ' - サブテーブル「{0}」が見つかりません。更新をスキップします',
    update_not_table: ' - 「{0}」は有効なサブテーブルフィールドではありません。スキップします',
    in_table: 'サブテーブル「{0}」内の',
    update_ok: ' - {0}フィールド「{1}」のプロパティを更新しました: {2}',
    update_not_found: ' - {0}フィールド「{1}」が見つかりません。更新をスキップします',
    unknown_action: ' - 不明な操作タイプ「{0}」。スキップします',
    filling_rule_resolved: '  🔗 回填ルール解決: @label:{0} → {1}',
    filling_rule_failed: '  ⚠️ 回填ルール解決失敗: ラベル「{0}」のフィールドが見つかりません。フィールド名を確認してください',
    table_filling_rule: '  📋 サブテーブル回填ルール処理 [{0}]: tableId={1}',
    table_rule_resolved: '    🔗 サブテーブルルール解決 [{0}]: @label:{1} → {2}',
    table_rule_failed: '    ⚠️ サブテーブルルール解決失敗: ラベル「{0}」のフィールドが見つかりません。フィールド名を確認してください',
    serial_number_formula_set: '  🔢 SerialNumberField「{0}」formula を設定しました',
    schema_extract_failed: '  ❌ レスポンスから Schema を抽出できません',
    schema_response_structure: '  レスポンス構造: {0}',
    schema_parse_failed: 'Schema 構造を解析できません',
    action_label: '操作 {0}: {1}',
  },
  common: {
    http_status: '  HTTP ステータス: {0}',
    http_response: '  HTTP レスポンス: {0}',
    response_body: '  レスポンス内容: {0}',
    response_detail: '  レスポンス詳細: {0}',
    response_not_json: 'レスポンスが JSON ではありません',
    login_expired: '  ログインセッション期限切れ: {0}',
    csrf_expired: '  CSRF トークン期限切れ: {0}',
    csrf_refreshed: '  csrf_token を更新しました',
    request_timeout: '  ❌ リクエストタイムアウト',
    request_failed: 'リクエスト失敗',
    request_failed_label: '  ❌ リクエスト失敗',
    unknown_error: '不明なエラー',
    step_login: `
🔑 Step 1: ログイン情報を読み込む`,
    step_login_label: `
🔑 ログイン情報を読み込む`,
    no_login_cache: '  ⚠️  ローカルのログイン情報が見つかりません。ログインを開始します...',
    login_no_cache: '  ⚠️  ローカルのログイン情報が見つかりません。ログインを開始します...',
    login_ready: '  ✅ ログイン情報が準備できました（{0}）',
    resend: '  🔄 リクエストを再送信中...',
    resend_csrf: '  🔄 リクエストを再送信中（csrf_token を更新済み）...',
    relogin_retry: '  🔄 再ログイン後にリクエストを再送信中...',
    exception: `
❌ 例外: {0}`,
    yes: 'はい',
    no: 'いいえ',
    empty: '（空）',
  },

  // ── lib/export-app.js ──────────────────────────────
  export: {
    usage: '使用方法: openyida export <appType> [output]',
    example1: '例: openyida export APP_XXXXXXXXXXXXX',
    example2: '    openyida export APP_XXXXXXXXXXXXX ./my-app-backup.json',
    title: '  openyida export - Yida アプリエクスポートツール',
    app_id: `
  アプリ ID:    {0}`,
    output_file: '  出力ファイル: {0}',
    step_get_forms: `
📋 Step 2: アプリのフォームリストを取得`,
    no_forms: '  ⚠️  フォームページが見つかりません。アプリ ID を確認してください。',
    forms_found: '  ✅ {0} 個のフォームページが見つかりました',
    step_export_schema: `
📦 Step 3: フォーム Schema をエクスポート`,
    exporting: `
  エクスポート中: {0} ({1})`,
    export_ok: '    ✅ エクスポート成功',
    export_failed: '    ⚠️  エクスポート失敗、スキップ',
    step_write_file: `
💾 Step 4: エクスポートファイルを書き込む`,
    done: '  ✅ エクスポート完了！',
    success_count: '  成功: {0} 個のフォーム',
    fail_count: '  失敗: {0} 個のフォーム（スキップ済み）',
    fetch_forms_failed: 'フォームリストの取得に失敗しました',
    unnamed_form: '名前のないフォーム',
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

  // ── lib/get-page-config.js ─────────────────────────
  get_page_config: {
    usage: '使用方法: yidacli get-page-config <appType> <formUuid>',
    example: '例: yidacli get-page-config APP_XXX FORM-XXX',
    title: '  get-page-config - Yida ページ設定照会ツール',
    app_id: `
  アプリ ID:    {0}`,
    form_uuid: '  フォーム UUID: {0}',
    step_query: `
🔍 Step 2: ページ設定を照会`,
    sending_request: '  getShareConfig リクエストを送信中...',
    query_ok: '  ✅ 照会成功！',
    open_url: '  公開アクセス: {0}',
    share_url: '  組織内共有: {0}',
    no_config: '  （公開アクセスまたは共有リンクが設定されていません）',
    query_failed: '  ❌ 照会失敗: {0}',
  },

  // ── lib/save-share-config.js ───────────────────────
  save_share_config: {
    usage: '使用方法: node save-share-config.js <appType> <formUuid> <openUrl> <isOpen> [openAuth]',
    example: '例: node save-share-config.js "APP_XXX" "FORM-XXX" "/o/xxx" "y" "n"',
    is_open_hint: '  isOpen: y=公開アクセスを有効化, n=公開アクセスを無効化',
    open_auth_hint: '  openAuth: y=認証が必要, n=認証不要（デフォルト）',
    title: '  save-share-config - Yida 公開アクセス設定保存ツール',
    app_id: `
  アプリ ID:      {0}`,
    form_uuid: '  フォーム UUID:  {0}',
    open_url: '  公開 URL:       {0}',
    is_open: '  公開設定:       {0}',
    open_auth: '  認証が必要:     {0}',
    step_validate: `
📋 Step 0: パラメータを検証`,
    validate_ok: '  ✅ パラメータ検証通過',
    validate_failed: '  ❌ 検証失敗: {0}',
    step_save: `
💾 Step 2: 公開アクセス設定を保存`,
    sending_request: '  saveShareConfig リクエストを送信中...',
    save_ok: '  ✅ 設定の保存に成功しました！',
    save_ok_msg: '公開アクセス設定を保存しました',
    save_failed: '  ❌ 保存失敗: {0}',
    save_failed_msg: '保存失敗',
    err_is_open_invalid: 'isOpen は y または n でなければなりません。現在の値: {0}',
    err_open_auth_invalid: 'openAuth は y または n でなければなりません。現在の値: {0}',
    err_open_url_required: '公開アクセスを有効にする場合、openUrl は必須です',
    err_open_url_prefix: 'openUrl は /o/ で始まる必要があります。現在の値: {0}',
    err_open_url_chars: 'openUrl のパス部分は a-z A-Z 0-9 _ - のみ使用できます。現在の値: {0}',
  },

  // ── lib/update-form-config.js ──────────────────────
  update_form_config: {
    usage: '使用方法: node update-form-config.js <appType> <formUuid> <isRenderNav> <title>',
    example: '例: node update-form-config.js "APP_XXX" "FORM_XXX" "false" "マイページ"',
    params_label: 'パラメータ説明:',
    param_is_render_nav: '  isRenderNav: true=トップナビを表示, false=トップナビを非表示',
    param_title: '  title: ページタイトル（必須）',
    title: '  update-form-config - Yida フォーム設定更新ツール',
    app_id: `
  アプリ ID:      {0}`,
    form_uuid: '  フォーム UUID:  {0}',
    is_render_nav: '  ナビ表示:       {0}',
    page_title: '  ページタイトル: {0}',
    step_update: `
💾 Step 2: フォーム設定を更新（トップナビを非表示）`,
    sending_request: '  updateFormSchemaInfo リクエストを送信中...',
    update_ok: '  ✅ 設定の更新に成功しました！',
    nav_shown: 'トップナビを表示しました',
    nav_hidden: 'トップナビを非表示にしました',
    update_failed: '  ❌ 更新失敗: {0}',
    update_failed_msg: '更新失敗',
  },

  // ── lib/verify-short-url.js ────────────────────────
  verify_short_url: {
    usage: '使用方法: node verify-short-url.js <appType> <formUuid> <url>',
    example: '例: node verify-short-url.js "APP_XXX" "FORM-XXX" "/o/aaa"',
    formats_label: '  対応フォーマット：',
    format_open: '    /o/xxx - 公開アクセス（外部向け）',
    format_share: '    /s/xxx - 組織内共有（内部向け）',
    open_url_label: '公開アクセス URL',
    share_url_label: '組織内共有 URL',
    title: '  verify-short-url - Yida URL 検証ツール',
    app_id: `
  アプリ ID:    {0}`,
    form_uuid: '  フォーム UUID: {0}',
    step_validate: `
📋 Step 0: URL フォーマットを検証`,
    validate_ok: '  ✅ フォーマット検証通過',
    validate_failed: '  ❌ 検証失敗: {0}',
    step_verify: `
🔍 Step 2: URL を検証`,
    sending_request: '  verifyShortUrl リクエストを送信中...',
    url_available: '  ✅ URL は利用可能です！',
    open_available_msg: 'この公開アクセス URL は利用可能です',
    share_available_msg: 'この組織内共有 URL は利用可能です',
    url_taken: '  ❌ URL は使用中です',
    url_taken_msg: 'この短縮 URL はすでに使用されています',
    verify_failed: '  ❌ 検証リクエスト失敗',
    err_url_prefix: 'URL は /o/ または /s/ で始まる必要があります。現在の値: {0}',
    err_url_chars: 'URL のパス部分は a-z A-Z 0-9 _ - のみ使用できます。現在の値: {0}',
    err_url_empty: 'URL のパス部分が空です: {0}',
  },

  // ── lib/copy.js ────────────────────────────────────
  copy: {
    title: '  openyida copy - Yida 作業ディレクトリを初期化',
    package_root: `
📦 パッケージルート: {0}`,
    dest_base: '🤖 ターゲットルート: {0}',
    dest_root: '🤖 ターゲットルート: {0}',
    force_mode: '⚠️  --force モード：ターゲットディレクトリをクリアしてからコピーします',
    no_package: `
❌ openyida パッケージディレクトリが見つかりません`,
    no_package_hint1: '   openyida がグローバルにインストールされていることを確認してください：',
    no_package_hint2: '   npm install -g openyida',
    no_ai_tool: `
❌ アクティブな AI ツール環境が検出されませんでした
   対応ツール：悟空、OpenCode、Claude Code、Aone Copilot、Cursor、Qoder

   現在の検出結果：`,
    no_active_tool: `
❌ アクティブな AI ツール環境が検出されませんでした`,
    supported_tools: '   対応ツール：悟空、OpenCode、Claude Code、Aone Copilot、Cursor、Qoder',
    current_result: `
   現在の検出結果：`,
    force_hint: `
   現在のディレクトリに強制コピーするには、次を実行してください：
   openyida copy --force`,
    force_cmd: '   openyida copy --force',
    copying: '    コピー: {0}',
    copying_label: `
📂 {0} をコピー中...`,
    creating_symlink: `
📂 yida-skills/ シンボリックリンクを作成中...`,
    file_copied: '    コピー: {0}',
    cleared: '    🗑️  クリア: {0}',
    symlink_removed: '    🗑️  古いシンボリックリンクを削除: {0}',
    old_symlink_removed: '    🗑️  古いシンボリックリンクを削除: {0}',
    dir_deleted: '    🗑️  ディレクトリを削除: {0}',
    removed: '    🗑️  削除: {0}',
    symlink_created: '    🔗 シンボリックリンク: {0} -> {1}',
    symlink_label: 'シンボリックリンク',
    done: '✅ 完了！',
    files_copied: '   コピーしたファイル: {0} 個',
    files_count: '{0} ファイル',
    symlinks_created: '   作成したシンボリックリンク: {0} 個',
    result_symlink: '   {0} → {1}（シンボリックリンク）',
    result_copy: '   {0} → {1}（{2} ファイル）',
    wukong_skills_cleanup: `
🗑️  悟空環境：yida-skills/ シンボリックリンクを削除中（悟空はスキルを手動アップロードするため、シンボリックリンク不要）...`,
    wukong_skills_cleaned: '削除済み',
    wukong_skills_not_found: '    ℹ️  yida-skills/ シンボリックリンクまたはディレクトリが見つかりません: {0}',
    remove_failed: '    ❌ 削除失敗: {0} ({1})',
    symlink_fallback_copy: '    ⚠️  Windows でシンボリックリンク作成失敗（管理者権限が必要）、ディレクトリコピーにフォールバック: {0}',
    symlink_failed: '    ❌ シンボリックリンク作成失敗: {0} ({1})',
  },

  // ── lib/check-update.js ────────────────────────────
  check_update: {
    new_version: `
💡 New version available: {0} (current: {1})
   Run the following command to update:
   npm install -g openyida@latest
`,
  },

  // ── lib/compile.js ─────────────────────────────────
  compile: {
    usage: '使用法: openyida compile <ソースファイル>',
    example: '例: openyida compile pages/src/demo.js',
    source_not_found: '❌ ソースファイルが見つかりません：{0}',
    success: '✅ コンパイル完了！',
    output_file: '  出力ファイル：{0}',
    exception: '\n❌ コンパイルエラー: {0}',
  },

  // ── lib/publish.js ─────────────────────────────────
  publish: {
    title: '  yida-publish - Yida ページ公開ツール',
    platform: '  プラットフォーム: {0}',
    base_url: `
  プラットフォーム: {0}`,
    app_type: '  アプリ ID:   {0}',
    app_id: '  アプリ ID:   {0}',
    form_uuid: '  フォーム ID: {0}',
    source_file: '  ソースファイル: {0}',
    compiled_file: '  コンパイル結果: {0}',
    output_dir: '  出力ディレクトリ: pages/dist/',
    step_compile: `
📦 Step 1: ソースをコンパイルして Schema を構築
`,
    reading_source: '[1/4] {0} のソースを読み込み中...',
    compiling: '[2/4] Babel で {0} をコンパイル中...',
    compile_failed: '  ❌ コンパイルに失敗しました：{0}',
    compile_location: `
     位置: {0} 行目, {1} 列目`,
    compile_error_loc: '     位置: {0} 行目, {1} 列目',
    compile_error_code: '     エラーコード: {0}',
    minifying: '[3/4] UglifyJS で {0} を圧縮中...',
    minify_failed: '  圧縮に失敗しました：{0}',
    uglifying: '[3/4] UglifyJS で {0} を圧縮中...',
    uglify_failed: '  圧縮に失敗しました：{0}',
    compile_done: '  ✅ コンパイル・圧縮が完了しました：{0}',
    building_schema: '[4/4] Schema を構築中...',
    schema_built: '  ✅ Schema の構築が完了しました！',
    step_login: `
🔑 Step 2: ログイン情報を読み込む`,
    step_publish: `
📤 Step 3: Schema を公開
`,
    resend_save_csrf: '  🔄 saveFormSchema リクエストを再送信中（csrf_token を更新済み）...',
    resend_save: '  🔄 再ログイン後に saveFormSchema リクエストを再送信中...',
    csrf_retry: '  🔄 saveFormSchema リクエストを再送信中（csrf_token を更新済み）...',
    relogin_retry: '  🔄 再ログイン後に saveFormSchema リクエストを再送信中...',
    publish_failed: `
❌ 公開に失敗しました: {0}`,
    schema_published: '  ✅ Schema の公開に成功しました！',
    schema_success: '  ✅ Schema の公開に成功しました！',
    form_uuid_label: '  formUuid: {0}',
    version_label: '  version:  {0}',
    step_config: `
⚙️  Step 4: フォーム設定を更新
`,
    sending_config: '  updateFormConfig リクエストを送信中...',
    resend_config_csrf: '  🔄 updateFormConfig リクエストを再送信中（csrf_token を更新済み）...',
    resend_config: '  🔄 再ログイン後に updateFormConfig リクエストを再送信中...',
    config_csrf_retry: '  🔄 updateFormConfig リクエストを再送信中（csrf_token を更新済み）...',
    config_relogin_retry: '  🔄 再ログイン後に updateFormConfig リクエストを再送信中...',
    success: '  ✅ 公開に成功しました！',
    publish_success: '  ✅ 公開に成功しました！',
    config_updated: '  設定を更新しました: MINI_RESOURCE = 8',
    config_failed: '  ⚠️  設定の更新に失敗しました: {0}',
    schema_ok_config_failed: '  Schema は公開されましたが、設定の更新に失敗しました',
    schema_published_config_failed: '  Schema は公開されましたが、設定の更新に失敗しました',
    exception: `
❌ 公開エラー: {0}`,
    error: `
❌ 公開エラー: {0}`,
    source_not_found: '❌ ソースファイルが見つかりません：{0}',
    usage: '使用方法: openyida publish <appType> <formUuid> <ソースファイル>',
    example: '例: openyida publish APP_XXX FORM-XXX pages/src/xxx.js',
  },

  // ── lib/qr-login.js ────────────────────────────────
  qr_login: {
    title: '🔐 宜搭 ターミナル QR コードログイン',
    step_init: '  Step 1: セッションを初期化中...',
    step_get_qr: '  Step 2: QR コードを取得中...',
    scan_hint: '  📱 DingTalk で以下の QR コードをスキャンしてください：',
    qr_url_label: '  QR コード URL: {0}',
    waiting_scan: '  ⏳ スキャン待機中（最大 2 分）...',
    scanned_confirm: '  ✅ スキャン完了！スマートフォンでログインを確認してください...',
    scan_success: '  ✅ スキャン確認完了！',
    step_exchange: '  Step 4: ログイン認証情報を取得中...',
    step_get_corps: '  Step 5: 組織リストを取得中...',
    step_switch_corp: '  Step 7: 選択した組織に切り替え中...',
    only_one_corp: '  ✅ 組織が 1 つ検出されました：{0}、自動選択',
    select_corp_prompt: '  🏢 複数の組織が見つかりました。選択してください：',
    select_corp_input: '  番号を入力してください (1-{0}): ',
    select_corp_invalid: '  ❌ 無効な入力です。1 から {0} の数字を入力してください',
    corp_selected: '  ✅ 組織を選択しました：{0}',
    login_success: '✅ ログイン成功！',
    qrcode_fallback: '  ⚠️  qrcode パッケージがインストールされていません。以下の URL を手動で開いてください：',
    qrcode_render_failed: '  ⚠️  QR コードのレンダリングに失敗しました（{0}）。以下の URL を開いてください：',
    get_qr_failed: 'QR コードレスポンスの解析に失敗しました: {0}',
    get_qr_api_failed: 'QR コード API が失敗しました: {0}',
    get_qr_error: 'QR コードの取得に失敗しました: {0}',
    qr_expired: 'QR コードの有効期限が切れました。再度ログインしてください',
    poll_timeout: 'スキャンタイムアウト（2 分）。再度ログインしてください',
    poll_error: 'スキャン状態のポーリングに失敗しました: {0}',
    exchange_failed: '認証コード交換レスポンスの解析に失敗しました: {0}',
    exchange_api_failed: '認証コード交換 API が失敗しました: {0}',
    exchange_error: '認証コードの交換に失敗しました: {0}',
    get_corp_list_failed: '組織リストレスポンスの解析に失敗しました: {0}',
    get_corp_list_api_failed: '組織リスト API が失敗しました: {0}',
    get_corps_warn: '  ⚠️  組織リストの取得に失敗しました（{0}）。デフォルト組織を使用します',
    switch_corp_failed: '組織の切り替えに失敗しました: {0}',
    switch_corp_warn: '  ⚠️  組織の切り替えに失敗しました（{0}）。現在の組織を使用します',
    select_corp_warn: '  ⚠️  組織の選択に失敗しました（{0}）。デフォルト組織を使用します',
    no_corp_available: 'アクセス可能な組織が見つかりません',
    no_csrf_in_cookie: 'ログインは成功しましたが csrf_token が見つかりません。再試行してください',
    stdin_closed: '入力ストリームが閉じられました。組織を選択できません',
  },

  // ── scripts/postinstall.js ─────────────────────────
  postinstall: {
    welcome_title: '  🎉 OpenYida へようこそ！                                    ',
    install_success: '  ✅ インストール完了！{0} Yida AI 開発ツールが使用可能になりました。',
    update_success: '  ✅ 更新完了！{0} OpenYida が最新バージョンにアップグレードされました。',
    ai_mode_title: '  🚀 AI 会話モードを開始',
    ai_mode_desc: '  Claude Code / Aone Copilot / Cursor などの AI ツールで直接チャット：',
    prompt1: '  📋  「Yida で勤怠管理システムを作ってください」',
    prompt2: '  💰  「個人給与計算アプリを構築してください」',
    prompt3: '  🏢  「CRM 顧客管理システムを作成してください」',
    prompt4: '  🎂  「誕生日お祝いミニアプリを作ってください」',
    steps_title: '  📖 基本的な使い方',
    step1: '  {0}Step 1{1}  AI コーディングツールを開く（Claude Code / Cursor など）',
    step2: '  {0}Step 2{1}  作りたいアプリを自然言語で説明する',
    step3: '  {0}Step 3{1}  AI が自動的に openyida コマンドを実行してアプリを作成・公開',
    step4: '  {0}Step 4{1}  Yida アプリのリンクを取得 🎉',
    commands_title: '  ⚡ クイックコマンド',
    cmd_env: '  {0}openyida env{1}      {2}# AI ツール環境とログイン状態を検出{3}',
    cmd_login: '  {0}openyida login{1}    {2}# Yida にログイン{3}',
    cmd_help: '  {0}openyida --help{1}   {2}# 全コマンドを表示{3}',
    footer1: '  📚 ドキュメント：https://github.com/openyida/openyida',
    footer2: '  💬 コミュニティ：DingTalk で OpenYida コミュニティに参加',
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
    config_load_error: 'Failed to load CDN config: {0}',
    config_saved: '✅ CDN config saved to: {0}',
    config_usage: 'Usage: openyida cdn-config [options]',
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
    config_file_path: '📄 Config file: {0}',
    config_section_aliyun: '🔐 Alibaba Cloud Credentials',
    config_section_cdn: '🌐 CDN Config',
    config_section_oss: '📦 OSS Config',
    config_section_upload: '📤 Upload Config',
    config_cdn_domain: 'CDN Domain',
    config_oss_region: 'OSS Region',
    config_oss_bucket: 'OSS Bucket',
    config_oss_endpoint: 'OSS Endpoint',
    config_upload_path: 'Upload Path',
    config_compress: 'Image Compression',
    config_max_width: 'Max Width',
    config_quality: 'Image Quality',
    config_not_set: 'Not set',
    config_enabled: 'Enabled',
    config_disabled: 'Disabled',
    config_status_valid: '✅ Config complete, ready to use',
    config_status_invalid: '⚠️  Config incomplete',
    config_missing: '   Missing fields: {0}',
    config_updated: '✅ Config updated!',
    config_init_title: '🔧 CDN Config Initialization Wizard',
    config_init_desc: 'To use CDN image upload, configure the following:',
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
    upload_no_files: '❌ Please specify image files to upload',
    config_incomplete: '❌ CDN config incomplete',
    missing_fields: '   Missing fields: {0}',
    run_config_init: '   Please run: openyida cdn-config --init',
    no_config: '❌ CDN config not found',
    oss_sdk_required: '❌ Missing ali-oss SDK',
    run_npm_install: '   Please run: npm install {0}',
    no_images_found: '❌ No supported image files found',
    uploading_images: '📤 Uploading {0} images...',
    uploading_file: '   Uploading: {0}',
    upload_success: '   ✅ {0}',
    upload_failed: '   ❌ {0} upload failed: {1}',
    upload_summary: `
📊 Upload Summary`,
    upload_success_count: '   Success: {0}',
    upload_fail_count: '   Failed: {0}',
    cdn_urls: `
🔗 CDN URLs:`,
    upload_error: '❌ Upload failed: {0}',
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
    refresh_no_targets: '❌ Please specify URLs or directories to refresh',
    cdn_sdk_required: '❌ Missing Alibaba Cloud CDN SDK',
    querying_quota: '📊 Querying refresh quota...',
    quota_info: '   URL refresh: {0}/day, {1} remaining | Dir refresh: {2}/day, {3} remaining',
    quota_query_failed: '   ⚠️  Failed to query quota: {0}',
    refreshing_urls: '🔄 Refreshing {0} URLs...',
    refreshing_paths: '🔄 Refreshing {0} directories...',
    refresh_task_id: '   ✅ Task ID: {0}',
    refresh_urls_failed: '   ❌ URL refresh failed: {0}',
    refresh_paths_failed: '   ❌ Directory refresh failed: {0}',
    refresh_summary: `
📊 Refresh Summary`,
    url_refresh_success: '   ✅ URL refresh success, Task ID: {0}',
    path_refresh_success: '   ✅ Directory refresh success, Task ID: {0}',
    refresh_error: '❌ Refresh failed: {0}',
    file_not_found: '❌ File not found: {0}',
  },

  // ── src/flash-note/flash-to-prd.ts ──────────────
  flash_to_prd: {
    title: '📋 DingTalk フラッシュノートを PRD に変換',
    help_usage: '使用法：openyida flash-to-prd --file <パス> [--name <プロジェクト名>]',
    help_usage2: '        openyida flash-to-prd --name <プロジェクト名>（標準入力から読み取り）',
    help_args_title: '引数：',
    help_arg_file: '  --file, -f <パス>       フラッシュノートファイルパス（.txt / .md）',
    help_arg_name: '  --name, -n <名前>       プロジェクト名（省略可、内容から自動抽出）',
    help_arg_max_tokens: '  --max-tokens <数>       AI 最大出力トークン数（デフォルト 8000）',
    help_examples_title: '例：',
    help_example1: '  openyida flash-to-prd --file ./meeting-notes.txt --name "設備点検システム"',
    help_example2: '  cat meeting.txt | openyida flash-to-prd --name "設備点検システム"',
    step_read: '[Step 1] フラッシュノートを読み込み中...',
    file_not_found: 'ファイルが見つかりません：{0}',
    no_input: 'フラッシュノートが提供されていません。--file でファイルを指定するか、パイプで入力してください。',
    stdin_empty: '標準入力が空です',
    read_success: '✅ 読み込み成功、{0} 文字',
    step_load_module: '[Step 2] プロンプトビルダーモジュールを読み込み中...',
    module_loaded_builtin: '✅ 内蔵プロンプトモジュールを読み込みました',
    module_loaded_local: '✅ ローカルプロンプトモジュールを読み込みました：{0}',
    module_not_found: '❌ build-flash-note-prompt.js モジュールが見つかりません',
    module_path_tried: '  試行パス {0}：{1}',
    step_preprocess: '[Step 3] 前処理 + 会議認識...',
    preprocess_result: '  前処理：{0} 文字 → {1} 文字',
    meeting_meta: '  会議メタ情報：{0} 項目{1}',
    a1_sections: '  A1 要約セクション：{0} 件{1}',
    speakers: '  発言者識別：{0} 名{1}',
    speakers_with_role: '（役割注釈 {0} 名を含む）',
    step_login: '[Step 4] ログイン状態を確認中...',
    no_login: '  ログインセッションが見つかりません、ログインを開始...',
    login_ready: '✅ ログイン準備完了（{0}）',
    step_ai: '[Step 5] AI で PRD を生成中...',
    single_segment: '  単一セグメントモード、プロンプト長：{0} 文字',
    multi_segment: '  マルチセグメントモード、合計 {0} セグメント',
    extracting_segment: '  セグメント {0}/{1} を抽出中（{2} 文字）...',
    merging_segments: '  セグメント結果を統合中...',
    ai_success: '✅ PRD 生成成功',
    ai_error: 'AI API 呼び出し失敗：{0}',
    done: '✅ フラッシュノートから PRD への変換完了',
    done_project: '  プロジェクト名：{0}',
    done_file: '  出力ファイル：{0}',
    done_size: '  ファイルサイズ：{0} 文字',
    done_meeting: '  会議認識：メタ情報 {0} 項目、A1 要約 {1} セクション、発言者 {2} 名',
  },
};
