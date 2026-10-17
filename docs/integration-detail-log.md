# Integration automation run log details

```sh
openyida integration detail-log <appType> <procInstId>
openyida integration detail-log <appType> <procInstId> --json
openyida integration detail-log <appType> <procInstId> --json --include-params
```

Use an existing run log entry's `procInstId` to read one integration automation run's node details. This command reads logs; it does not trigger or modify a flow. An empty result does not prove that the run ID is invalid. Node `status` is not used to infer execution success or failure.

## API and authentication

The command reuses the existing token session through `createAuthRef` and `createYidaClient`. The shared client supplies bearer authentication and resolves the configured environment endpoint.

`GET /alibaba/web/{appType}/query/formLogicflowBinding/listDetailLog.json`

| Parameter | Value |
| --- | --- |
| `procInstId` | Existing run instance ID supplied to the command |
| `pageIndex` | One-based page index |
| `pageSize` | 100, fixed by this command |
| `_api` | `Connector.listDetailLog` |

The platform has not published this endpoint's contract, so its path or response shape may change. The wrapper requires `success: true`, a `content.data` array, and a nonnegative safe-integer `content.totalCount`.

## Pagination and output

Pagination follows `content.totalCount`: this endpoint's `hasMore` has been observed to be `false` even when later pages exist. The command reads at most 100 pages and 10,000 nodes. A first-page total above 10,000 fails immediately; if 100 pages do not collect the declared total, it fails without requesting page 101. Both cases return `INTEGRATION_DETAIL_LOG_PAGINATION_LIMIT`.

Changing totals, empty pages before completion, oversized pages, excess records, and mismatched `currentPage` values also fail. Results are printed only after all pages are collected and validated, so failures do not print a partial node list.

Text and ordinary `--json` output contain node order, name, activity type (`activityKey`), elapsed time and input/output key names. Both `--json` and `--include-params` are required to include parameter values. Included parameters pass recursively through the shared `redactSensitive` utility with `fullMask: true`: known credential fields such as tokens, Authorization, Cookie and passwords become `***`, including nested objects and arrays. Ordinary business values remain available; masking does not guarantee detection of every secret, and business data may still be sensitive.

This command performs a single-instance detail query. It does not search runs or diagnose failures automatically.
