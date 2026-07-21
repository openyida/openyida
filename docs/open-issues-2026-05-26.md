# Open Issues Coverage - 2026-05-26

This snapshot was collected from <https://github.com/openyida/openyida/issues> on 2026-05-26. It records how the current PR treats each open issue so reviewers can check that no issue was silently skipped.

## Direct Fixes In This PR

| Issue | Coverage |
| --- | --- |
| #365 create-app layoutDirection 在创建后切换无效 | `update-app` now accepts theme/layout fields and emits an explicit layout shell caveat. |
| #330 data query 表单明细数据丢失 | `data get/query form` can hydrate 50-row truncated subforms through `--form-uuid`; `data query form --all` fetches all pages. |
| #191 Wukong mobile login opens desktop browser | Wukong agent login now returns the Wukong browser handoff instead of attempting local desktop browser fallback. |
| #107 saveFormData API 302 LOGIN FAILED | `data create form` uses the `/alibaba/web/<appType>/_/saveFormData.json` endpoint and HTTP 30x responses trigger auto-login retry. |
| #57 custom page route nesting | `check-page` warns when Yida links navigate inside the iframe instead of using `_top`, `_blank`, or `window.top.location`. |
| #24 database sequence tool | `db-seq-fix` is registered as a CLI command and command-manifest entry. |

## Reviewed Capability Or Roadmap Disposition

| Issue | Disposition |
| --- | --- |
| #339 SLS log workbench skill | Removed from the current skill package; no SLS log workbench skill is indexed. |
| #325 yida-schema-render | Covered by `build-page`, page IR, custom page templates, and schema-driven page authoring pipeline. |
| #324 LayoutContainer | Covered by form schema builder layout modes and page IR layout components. |
| #323 navigation groups | `openyida nav-group`. |
| #301 Wukong international | `--intl/--yidaapps` environment selectors and Wukong workspace handling. |
| #297 Yida experience system | Feedback/VOC, doctor auto-submit, and knowledge-oriented chat page samples. |
| #287 Qwen taxi-style Cool Card | Agent chatbox sample includes generated action/plan cards and Qwen routing. |
| #263 data management page and extensions | `openyida data`, bridge APIs, and custom page data-source preservation. |
| #262 built-in form components | `create-form`, `form-detail`, and custom page compatibility checks. |
| #252 remote maintenance for distributed apps | `export`, `import`, `update-app`, page publishing, permissions, and environment management. |
| #234 yidaapps.com | `--intl`, `--global`, `--yidaapps`, and DingTalk International OAuth support. |
| #223 ER diagram | Schema export and report/data model utilities provide the base metadata. |
| #184 HTTP connector data sources | `connector` and `create-form bind-datasource`. |
| #147 natural-language data analysis | `ai`, `data`, `report`, and dashboard/chart skills. |
| #144 Cool Card generation | Agent chatbox confirm/action card generation sample. |
| #86 generic feature request | Covered by the command manifest and issue coverage tracking in this PR. |
| #90 intelligent print PRD | PRD generation and custom page/report/form workflows. |
| #91 QR batch print | Form/page/report composition plus CDN upload and page publishing. |
| #92 AI chat UI component | `project/pages/src/demo-agent-chatbox.oyd.jsx`. |
| #93 multi-version and grayscale | `export/import`, `update-app`, and batch/devops commands. |
| #94 business rules, automation, approval config | `create-form rule`, `integration`, `configure-process`. |
| #96 elder mode | `yida-density` and custom page design-token templates. |
| #97 executive mode | `yida-dashboard`, report, chart, and corp-efficiency commands. |
| #99 app diagnostics | `doctor`, `check-data`, `integration check`, feedback/VOC flows. |
| #100 Tailwind CSS | Custom page template loads the verified Tailwind browser CDN with fallback. |
| #101 yida-ai skill | `openyida ai text` and `openyida ai image`. |
| #67 intelligent form validation | `formula evaluate`, create-form rules, and page/form linting. |
| #102 BPM process migration | `create-process`, `configure-process`, import/export primitives. |
| #104 form style reset | `create-form patch`, form-detail, and page styling utilities. |
| #108 ui-skill | Page templates, design-token sample, and compatibility builder. |
| #110 cross-organization copy | `export` and `import`. |
| #111 external JS libraries | `check-page` guidance and `this.utils.loadScript` templates. |
| #114 PRD and DingTalk Docs MCP | `flash-to-prd`, DWS wrapper, and conversation export. |
| #115 responsive layout/theme/history.push | Custom page template and new iframe navigation lint. |
| #25 bug analysis and ticket creation | `doctor --auto-submit`, feedback/VOC helpers. |
| #22 competitor migration | `export/import`, externalize-form, and PRD generation. |
| #117 browser plugin | `bridge` and DingTalk link helpers. |
| #118 PRD approval/version save | `flash-to-prd`, process/integration commands, export-conversation. |
| #120 version management and DevOps | `batch`, `export/import`, `update`, and full E2E runners. |
| #121 pre-insert preprocessing | `ai image`, CDN upload, and data create pipeline. |
| #122 report creation and management | `create-report` and `append-chart`. |
| #124 custom component authoring/publishing | Custom page build/compile/publish pipeline. |
| #228 custom component generation | Custom page samples and build pipeline. |
| #285 native iOS/Android runtime export | Tracked as roadmap; current PR documents non-CLI runtime scope. |
| #286 publish app to dedicated Wukong | Tracked as roadmap; current PR improves Wukong login handoff and environment handling. |
| #321 convert Yida app to Wukong card | Tracked as roadmap; current PR confirms agent-card/bridge foundation. |
