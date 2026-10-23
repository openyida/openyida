# Form message notifications

`openyida form-message` manages native bindings under a form's **Page settings > Message notifications**. It is form-scoped and does not send arbitrary messages, configure application-wide notifications, or replace integration automation.

Use `list`, `inspect` and `options` to read the current bindings, stable hashes, supported fields and seven native template types. `create` and `update` currently accept the four verified immediate events for ordinary forms: create, edit, delete and comment success. Scheduled date rules and process-specific bindings remain readable but are rejected for mutation until their timing, process-version and node context can be independently verified.

Every successful action returns `configUrl`, the form's notification settings page: `<authenticated base URL>/<appType>/admin/<formUuid>/settings/messageSetting`. After creating or updating a notification, provide this clickable link with its ID, title, trigger and recipients, including for standalone configuration requests. The link opens the form's notification list; locate the notification by its title.

Mutations create an exclusive backup, compare the complete binding list again before writing, issue one non-replayed request, and require a matching readback. `delete` requires `--yes` and the latest `--expected-hash`. The native binding has no independent enabled/disabled state; `isSendMessage` belongs to process work-record behavior and is not a toggle.

See the `yida-form-message` skill for the configuration schema, recipient types, variable mapping and validation boundaries. Saving a binding does not submit form data or send a test notification. Runtime triggering and actual delivery require separate authorized acceptance.
