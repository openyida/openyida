# Native form custom buttons

`custom-button` configures buttons under **Form > Page settings > Custom buttons**. Common uses include assigning a customer owner, filling a linked follow-up record, starting a purchase order after approval, invoking an automation, and opening a business page.

```bash
openyida custom-button list APP_XXX FORM_XXX --json
openyida custom-button options APP_XXX FORM_XXX --json
openyida custom-button inspect APP_XXX FORM_XXX BUTTON_XXX --json
openyida custom-button create APP_XXX FORM_XXX --config button.json --json
openyida custom-button update APP_XXX FORM_XXX BUTTON_XXX --config patch.json --expected-hash HASH --json
openyida custom-button delete APP_XXX FORM_XXX BUTTON_XXX --expected-hash HASH --yes --json
```

`options` reads fields, condition variables/operators, associated forms, pages, manual custom-button automations (type 6), table views and custom detail pages. Use returned identifiers in JSON files.

To add a button to the end of a specific table view's action column, use `openyida form-view add-button APP_XXX FORM_XXX VIEW_XXX --button BUTTON_XXX --json`. Use the view owner's form ID for `form-view` and the data form ID when finding or creating the button. See the [form view guide](form-views.md).

Each translated button name is limited to 10 characters. Native responses add fallback translations and nullable i18n metadata; readback verifies every supplied or preserved translation while accepting those server additions.

Filter rules are enriched with their native component type, rule parser, value, and group/item identifiers. These fields are required for runtime evaluation even when a minimal `id/op/value` rule can be displayed by the editor. Always verify both a matching and a nonmatching record when testing conditions.

```json
{
  "name": {"type": "i18n", "zh_CN": "分配", "en_US": "Assign"},
  "actionType": "fillInForm",
  "actionConfig": {"fillType": "fillCurrentForm", "fieldsSelected": ["FIELD_FROM_OPTIONS"]},
  "tableViewUuids": ["VIEW_FROM_OPTIONS"],
  "detailId": []
}
```

| Action | actionConfig |
| --- | --- |
| Edit current form | `fillType: fillCurrentForm`, nonempty `fieldsSelected` |
| Fill associated form | `fillType: fillLinkageForm`, `linkageFormId`; app and form type are resolved from metadata |
| Invoke automation (`actionType: invokeFlow`) | Published type 6 `processCode`; `needSecondCheck: ["y"]` by default, or `[]` to disable runtime confirmation |
| Open app page (`actionType: linkToPage`) | `urlType: inner`, `urlFormUuid`, `openWith: new` or `slide`; page type resolved from metadata |
| Open external page (`actionType: linkToPage`) | `urlType: outer`, HTTP(S) `url`, `openWith: new` or `slide` |

Links optionally accept `paramInfo: [{paramName,paramType,paramValue}]`; `paramType` is `constant`, `variable` or `formula`. Use actual field references or existing valid platform formulas.

`name`, `description` and `icon` are native objects. `permissionConfig: null` means all records. A condition replaces the whole native tree, for example `{"condition":"AND","rules":[{"id":"FIELD_FROM_OPTIONS","op":"eq","value":"open"}]}`. Use `options.variables[].operatorMap` for eligible fields/operators. The CLI resolves SQL keys, editor labels or canonical codes through the field metadata and adds `conditionCode`, `opCode` and default `valueType: literal`; a conflicting supplied `opCode` is rejected. Existing valid formula expressions may retain `valueType: column`. Data-query and permission-group filters use different formats.

Updates merge translations and properties of the same action. Arrays and conditions replace completely. Changing `actionType`, `fillType` or `urlType` requires a complete new `actionConfig`. Empty display arrays clear those bindings; deleting removes the definition. Legacy/custom detail layouts may also need display references and ordering in the corresponding designer. This command does not rewrite those layouts or system button order.

Writes save backups and verify by readback. `--backup` selects a new file; existing files are never overwritten. `--expected-hash` detects stale edits; deletion requires it and `--yes`. The platform has no atomic compare-and-swap, so concurrent edits can still race after the last read. Writes are sent once, without retry after login refresh or transport failure. Errors report the backup and uncertain or accepted-but-unverified outcome; inspect remote state before retrying. Recreating a definition generates a new UUID, so backups cannot restore old references automatically.

The platform permits at most 10 buttons per form. Process records show them after the process ends. Page/field permissions, subscription availability and flow publication still apply. This command does not change entitlements or execute buttons. Configuration readback does not verify desktop/mobile rendering, linked-form fill behavior or automation execution. See the [official guide](https://docs.aliwork.com/docs/yida_support/wtwabe/ckyvwt/ohyllrtgx9v5opox).
