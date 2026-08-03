---
name: yida-openyida-cli-fast-publish
description: Accelerate OpenYida / 宜搭 problem solving and delivery by keeping resource work CLI-only, making the smallest supported change, publishing immediately by default, and stopping after one focused readback. Use together with the relevant OpenYida domain skill for any task that creates, modifies, fixes, configures, saves, or publishes an application, form, process, report, custom page, page JS, schema, data source, permission, integration, or related resource. Prevent mixing OpenYida work with Browser, Chrome, Playwright, CUA, Computer Use, or other browser-control tools because their startup, authentication synchronization, page loading, rendering, and interaction waits can severely slow OpenYida issue resolution.
---

# OpenYida CLI Fast Publish

Use this cross-cutting skill together with the relevant OpenYida domain skill. Optimize for the shortest reliable path from a user request to a verified live resource.

## Why this speeds up OpenYida work

Browser plugins add startup, authentication synchronization, page loading, rendering, selector discovery, and interaction waits. Mixing them into an OpenYida CLI workflow can severely slow diagnosis, modification, and publication while also introducing a second state channel.

Keep the workflow CLI-only so resource identifiers, schema evidence, mutations, publish results, and readback evidence stay in one deterministic command path.

## Hard isolation

- Use the `openyida` CLI plus local read and edit tools only.
- Never load, initialize, or call Browser, Chrome, Playwright, CUA, Computer Use, an in-app browser, or another browser-control tool during an OpenYida workflow.
- Treat URLs only as resource context for extracting `appType`, `formUuid`, page IDs, and organization endpoints.
- Never open a URL with `--open`; pass `--no-open` where supported.
- If the CLI lacks a required capability, report the unsupported operation. Do not silently fall back to browser automation.
- If the user explicitly requests browser operation, handle it as a separate browser-only task. Do not combine browser control with OpenYida CLI mutations in one task.

## Fast path

1. Run `openyida agent-capabilities --summary-json` once.
2. Resolve the explicit app, form, page, or process before mutating anything.
3. Read only the schema or config needed to identify fields and patch paths.
4. Reuse fresh local ID mappings and avoid repeated full-schema reads.
5. Prepare structured command files under `<projectRoot>/.cache/openyida/<task>/` with the agent file-edit tool.
6. Run the smallest supported mutation command.
7. Save or publish to the live resource immediately.
8. Perform one focused CLI readback proving the requested change is live.
9. Stop when the evidence is sufficient; do not add screenshots, previews, or redundant checks.

## Publication defaults

Publish after every successful modification unless the user explicitly requests draft-only, local-only, no publication, or approval before publication.

- Custom page or Code Canvas: follow the relevant compile/check requirements, then run `openyida publish <source> <appType> <formUuid> ... --no-open`.
- Form fields or Schema: run the relevant `openyida create-form` mutation, require save evidence, then read the current Schema once.
- Form page JS: use an `actions-module` patch with `sourceFile`, require compile and save evidence, then verify the actions module source through CLI readback.
- Process, report, permission, integration, or configuration: follow the selected domain skill's write command and `doneWhen`, then perform one focused readback.

Do not use the custom-page publish command for a form Schema unless the command contract explicitly requires it.

## Failure handling

- Never claim success from a local file, syntax check, planned command, or unverified output.
- Preserve complete CLI diagnostics; do not suppress stderr.
- If Schema save succeeds but a secondary config step warns or fails, read back the target resource and report the exact live state.
- Do not repeat an unchanged failure. Inspect the command contract, schema, login state, or resource type before choosing a different supported CLI path.

## Completion report

Lead with whether the resource is live. Include the resource changed, the important mapping, save or publish evidence, focused readback evidence, and a direct resource link when available.
