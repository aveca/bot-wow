# BOT-WOW Worker — rollback manifest (2026-11-06)

## Purpose and scope

Read-only capture of Cloudflare Worker version metadata and the currently served source identity. No deployment, rollback, secret read/write, binding mutation, D1/R2 write, payment, or email was performed during this capture.

Worker: `botwow-api`  
Cloudflare account: `abf2b92cf718313567b4b38eb9dda17f`

## Current production version observed

- Active deployment: `6aecab2d-6545-4c76-a6b3-cfb089372884`
- Traffic: **100%**
- Active version: **51**
- Version ID: `1513595c-6a53-4575-b013-9979b696dce3`
- Created: `2026-11-06T09:16:45.389985Z`
- Deployment created: `2026-11-06T09:16:54.384421Z`
- Version annotation commit: `8744a3e2bbaec449e16548f89117a05f0d7f20dc` (PR #103 merge)
- Cloudflare script ETag: `df3e4a43365d9b29a87d1b3e95ff21de48ac562610e1838cbaea57efa83282ec`
- Source `worker/index.js` on main: Git blob `2e230529329381bd59750394e5398b752fe5b0bc`
- SHA-256 of the module returned by `GET /accounts/{account_id}/workers/scripts/botwow-api/content/v2`: `cc76bd3a4dd0f30aad50416687ee81ac4e70745f6b24de7058770ac8e31512f7`
- The live `content/v2` module and main `worker/index.js` were byte-identical (same SHA-256); one module, `worker.js`, 122,920 characters.

Bindings observed on v51 (names/types only; secret values never read):
- Secret bindings: `ADMIN_EMAIL`, `ADMIN_JWT_SECRET`, `ADMIN_PASSWORD_HASH`, `CONTACT_EMAIL`, `EXPORT_TOKEN`, `LICENSE_SECRET`, `MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET`, `RELEASE_STATUS`, `RESEND_API_KEY`
- D1: `DB` = `e57f5874-a9f0-42bf-8dbc-10785ef083f5`; `TELEMETRY_DB` = `935b0632-d712-4266-bece-028c70b545be`
- KV: `RATE_LIMIT` = `5cca39707796468f83d2016350794f72`
- R2: `R2_BINARIES` = `botwow-binaries`
- Plain text: `ENVIRONMENT=production`, `MAIL_FROM=BOT-WOW <licences@bot-wow.com>`, `R2_OBJECT_KEY=casinobabe-fishing-1.2.0.zip`

## Previous version 50 — rollback target

- Version: **50**
- Version ID: `c3dcc842-c422-42d3-9828-405f30d70b5f`
- Original deployment: `36227a4d-00e7-4c9f-94e0-0913b29049bc`
- Created: `2026-10-27T07:46:28.277198Z`
- Source: `wrangler` (triggered by secret change)
- Cloudflare script ETag: `635c77e92bbb59bb2afb0229800a3fa420947bd03bc2aef4bda2fb5f51dfa29f`
- Handlers: `fetch`, `scheduled`
- Cloudflare `GET .../versions?deployable=true` explicitly included this version: **deployable=true** at capture time.

Version 50 bindings recorded by Cloudflare (names/types/resource identifiers only; no secret values):
- Secret bindings: `ADMIN_EMAIL`, `ADMIN_JWT_SECRET`, `ADMIN_PASSWORD_HASH`, `CONTACT_EMAIL`, `EXPORT_TOKEN`, `LICENSE_SECRET`, `MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET`, `RELEASE_STATUS`, `RESEND_API_KEY`
- Assets binding: `ASSETS` (present on v50; absent from v51)
- D1: `DB` = `e57f5874-a9f0-42bf-8dbc-10785ef083f5`; `TELEMETRY_DB` = `935b0632-d712-4266-bece-028c70b545be`
- KV: `RATE_LIMIT` = `5cca39707796468f83d2016350794f72`
- R2: `R2_BINARIES` = `botwow-binaries`
- Plain text: `ENVIRONMENT=production`, `MAIL_FROM=BOT-WOW <licences@bot-wow.com>`, `R2_OBJECT_KEY=casinobabe-fishing-1.2.0.zip`
- v50 also carries the prior Worker Assets configuration (headers/redirect rules). A rollback therefore restores more than JavaScript: it reintroduces the `ASSETS` binding and its older asset configuration.

### Rollback mechanism

Cloudflare's deployment API accepts a deployment containing a version ID and traffic percentage. The retained v50 UUID is listed as deployable, so the rollback target still exists in Cloudflare's version store. The corresponding non-executed deployment shape is:

```json
{
  "strategy": "percentage",
  "versions": [
    {
      "version_id": "c3dcc842-c422-42d3-9828-405f30d70b5f",
      "percentage": 100
    }
  ]
}
```

The API exposes a `force=true` query option for rollbacks blocked after a secret changes. Secret values cannot be read through this capture, so secret-value continuity is **not proven**. No rollback request was sent. The v50 deployment is therefore **available and marked deployable**, but a live rollback was not tested.

## Source retrieval limitation

The authorized `GET .../content/v2` endpoint returned the current script content (v51), not a historical version selector. `GET .../versions/{version_id}` returned v50 metadata/resources and its ETag, not source bytes. Consequently:

- v51 source bytes are preserved by the exact matching `worker/index.js` on main and its SHA-256 above.
- v50 source bytes could **not** be exported through the available Cloudflare API route.
- This file is a durable **rollback pointer/manifest**, not a copy of the v50 source archive. The exact v50 code remains retained by Cloudflare under the version ID above.

## Payment and fulfillment guardrails

- Current main/live v51 `PRICE_TABLE`: `amount: 2000`, `currency: "EUR"`. The code divides the integer by 100 for Mollie, so this is **€20.00**, not €2,000.
- Current main/live v51 `handleCheckout` still checks `RELEASE_STATUS === "confirmed"` before calling Mollie.
- Current main/live v51 `handleMollieWebhook` contains payment test/live classification, atomic webhook idempotency, and fulfillment resume/complete paths. The prior v50 reconciliation report records material differences in this function between v50 and main. Because v50 source bytes are unavailable here, an AST/hash equality comparison of v51 payment functions against v50 could not be completed.
- Current main/live v51 `handleDownload` uses the configured versioned R2 key, refuses a missing/invalid artifact, reserves the quota atomically after confirming the object exists, and uses the exact object key for `Content-Disposition`.
- The current main/live v51 Worker no longer contains `handleLanding`; legacy API-host landing paths are intended to redirect rather than serve the old marketing HTML. Live HTTP probing of `api.bot-wow.com` was blocked by the execution environment's outbound-request policy, so those API-host routes are **not re-verified in this capture**.

## PR #103 and CI

PR #103 is merged at `8744a3e2bbaec449e16548f89117a05f0d7f20dc`. Its reviewed diff changes the Worker only by removing the unused log-only `sendDeliveryEmail` helper; other changes are tests and reports.

On the exact merge SHA, GitHub Actions reported:
- `npm run validate`: PASS
- `npm test`: PASS (the script includes `payment-flow`, `checkout-security`, and `worker-fulfillment-reconciliation`; the latter logged `RECONCILIATION WORKER : OK`)
- Cloudflare Pages and repository deploy checks: SUCCESS

Important distinction: the active v51 deployment is a full Worker build whose source matches main, not merely the one-line runtime deletion from PR #103. Thus the already-active v51 also contains the accumulated main changes to webhook/fulfillment and download/landing behavior since v50. This is a production payment/fulfillment behavior difference; it was not changed by this manifest capture.

## Decision at capture time

- No new Worker patch was justified: the current main Worker and active v51 source are identical, and the non-financial download/legacy-route corrections are already present there.
- No no-op deployment was made.
- No rollback was made: switching to v50 would itself change live payment/fulfillment behavior and restore the older Assets configuration. It requires a deliberate production decision.
- No real payment, checkout attempt, customer email, D1 write, R2 write, secret read/write, or binding mutation was performed.
