# Native form views

`form-view` reads and updates the native data-management views of an existing form. It preserves the form schema, records and permissions.

```bash
openyida form-view list APP_XXX FORM_XXX --with-config --json
openyida form-view inspect APP_XXX FORM_XXX VIEW_XXX --json
openyida form-view save APP_XXX FORM_XXX VIEW_XXX --config view-patch.json --expected-hash HASH_FROM_INSPECT --json
openyida form-view create APP_XXX FORM_XXX --name "Pending orders" --json
openyida form-view order APP_XXX FORM_XXX --config order.json --json
openyida form-view rename APP_XXX FORM_XXX VIEW_XXX --name "Pending orders" --json
openyida form-view add-button APP_XXX FORM_XXX VIEW_XXX --button BUTTON_XXX --expected-hash HASH_FROM_INSPECT --json
```

Use the UUIDs returned by `list`. `inspect` returns native static/default configuration, a content hash, and available fields with their supported filter operators. `list --with-config` reads every view configuration, including non-table views; writing settings currently supports table views.

Example patch, using real field IDs from `inspect`:

```json
{
  "defaultConfig": {
    "showFields": ["textField_REAL", "selectField_REAL"],
    "widths": { "textField_REAL": 280, "selectField_REAL": 160 },
    "lockFieldIds": ["textField_REAL"],
    "filter": {
      "values": { "selectField_REAL": ["Pending"] },
      "operationValues": { "selectField_REAL": "IN" },
      "conditionType": "AND"
    }
  }
}
```

`showFields` controls visibility and order; `"all"` shows all available fields. `widths` maps field IDs to positive pixel widths. `lockFieldIds: []` removes frozen columns; `widths: null` clears width settings. `sort` accepts an array such as `[{"id":"textField_REAL","isAsc":"y"}]` (`n` for descending). `staticConfig.columnFilter` controls available columns and is independent of data-access permissions; the native sentinel `["all"]` enables all fields. `staticConfig.dataRange` holds native view filtering rules, whose structure should be read from an existing view before editing.

Objects merge recursively and arrays replace. `filter` and `dataRange` replace as complete conditions, so `{}` clears either one. Unspecified settings are preserved. A save returns `changed: false` when it already matches. Use exact operator names returned by the platform, including their case; unsupported field IDs and operators are rejected before writing.

Every mutation first writes a local backup, optionally at `--backup <new-file>`. Success requires configuration readback and `readbackVerified: true`. The server-generated `latestUpdateTime` is excluded from setting comparison but remains part of the stale-edit hash. To restore a save, copy `config.staticConfig` and `config.defaultConfig` from the backup into a new patch file, inspect the latest configuration, and save with `--replace --expected-hash <current-hash>`. Full replacement requires both configuration objects and removes settings introduced after the backup. A backup does not restore records or page source.

`order.json` must contain every existing view UUID exactly once, including form-submission views. The first UUID determines the default view. `create` adds one table view and returns its verified UUID; configure that same view rather than creating it again after a partial failure.

`rename` changes an existing view's name in place. Enter a name of up to 20 characters for the Chinese, English, and Japanese display values.

`add-button` appends a button from the view's data form to the table's action column. Get its UUID from `custom-button list` or create the definition first with `custom-button create`. Adding an existing reference again returns `changed: false`.

The platform has no atomic compare-and-swap for view settings. The CLI checks the hash and re-reads before saving, but concurrent edits can still race. Mutation requests are sent once; after a transport error or readback mismatch, inspect remote state and keep the backup before retrying. Edition and permission rejections remain platform errors.

Open the actual page to verify visibility, widths, frozen columns, filters and navigation. Personal browser view settings can override administrator defaults. API readback alone does not verify rendering or permission behavior.
