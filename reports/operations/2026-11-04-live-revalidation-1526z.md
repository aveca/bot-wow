# BOT-WOW — Live revalidation 2026-11-04 15:26 UTC

Scope: BOT-WOW only. Read-only production checks unless explicitly stated. No payment, email, secret, D1/R2 mutation, or production deployment performed.

## 1. GitHub state

- `main`: `595e7acd85996512d404a3f4b2b278ea2c4bfe35`.
- PR #77 — [Mollie profileId fix](https://github.com/aveca/bot-wow/pull/77), draft/open, head `e25781fd0d10f0bffedaca982fdf4ed5bd74313a`. It changes only `worker/index.js` and `tests/payment-flow.test.mjs`.
- PR #79 — [purchase-copy honesty fix](https://github.com/aveca/bot-wow/pull/79), open, head `6a447b2c3e034dd8a298fa7c94c4675e5d9324c4`. It changes six EN/FR purchase surfaces and two regression test files.
- PR #78 — documentation revalidation remains open.
- PR #66 — compliance review / non-automating pivot remains open; pivot not merged or implemented.

## 2. Mollie P0 — code defect verified, production fix not deployed

On current `main`, `createMolliePayment()` and the webhook payment lookup still pass `includeProfileId=true` to Mollie while `mollieFetch()` appends `?profileId=...` whenever `MOLLIE_PROFILE_ID` exists.

Mollie's official documentation says API keys are tied to a payment profile and `profileId` must not be sent with an API key; OAuth/organization credentials require it:
- https://docs.mollie.com/reference/authentication
- https://docs.mollie.com/reference/create-payment

PR #77 changes those calls to omit the parameter and adds two regression assertions. GitHub Actions on the latest PR #77 commit:
- Validate Bot-Wow: SUCCESS, run 41857130935.
- UI quality and visual evidence: SUCCESS, run 41857130846.

The historical `Invalid Authorization header` message is reported in PR #77's diagnostic; it was not independently re-read from live Worker logs in this pass. The source-code defect and Mollie's credential rule are independently confirmed.

## 3. Purchase-copy defect — corrected in PR #79, not live

Direct inspection of the live EN and FR homepages and buy pages found contradictory claims:
- Homepages say card payments are available via Mollie / card payment is live.
- Canonical buy pages and A/B variants show a Mollie badge or say the buyer will be redirected to Mollie.
- The same pages say checkout is unavailable and the purchase button is disabled.

PR #79 removes the active-payment and redirect claims across:
- `index.html`, `fr/index.html`
- `buy.html`, `fr/buy.html`
- `ab/a/buy.html`, `ab/a/fr/buy.html`, `ab/b/buy.html`, `ab/b/fr/buy.html`

It adds regression assertions in `tests/release-availability.test.mjs` and `tests/ab-variants.test.mjs`. No checkout logic or price changed. All buttons remain disabled.

At 15:26 UTC no GitHub Actions run was returned for PR #79's latest head; tests are therefore **not yet certified** on that head. The GitHub API commits made through the connector did not yield a runnable CI record. Do not merge until CI is green on the exact head.

## 4. Cloudflare production state

Read-only Cloudflare API checks:
- Latest Pages production deployment: `d9d79ad7-0d35-4bf4-a5db-8fae45f5de77`, success at 2026-11-04 13:42:52 UTC, source commit `595e7acd`.
- Preview deployments for PR branches are disabled (`preview_deployments_disabled`); the PR branches are not live.
- Latest `botwow-api` Worker deployment: `36227a4d-00e7-4c9f-94e0-0913b29049bc`, 2026-10-27 07:46:28 UTC, 100% on version `c3dcc842-c422-42d3-9828-405f30d70b5f`. PR #77 is not deployed.

## 5. Current revenue and funnel — D1 read-only

Production orders grouped by provider/status:
- Mollie: 11 `failed` orders, 22,000 minor units nominally requested; these are not revenue.
- `bitcoin_manual`: 5 `paid` test orders (10,000 minor units), 8 pending, 1 rejected. The five paid orders are test data, not customer sales.

Fulfillment:
- Licences: 5 active, all linked to the manual test orders.
- Deliveries: 0 rows.
- Activations: 0 rows.

Analytics:
- `page_view` live: 1,508.
- `journey_view` live: 573.
- `cta_click` live: 48.
- `checkout_requested` live: 29.
- `checkout_created` live: 6; `checkout_failed` live: 6.
- No `payment_confirmed`, `conversion`, `delivery_sent`, or activation events.
- Latest page-view event: 2026-11-04 14:43:47 UTC.
- Last checkout-request event: 2026-11-04 02:47 UTC; last server checkout attempts remain on 2026-10-27.

**Confirmed customer sales: 0. Confirmed real revenue: €0.00.** D1 queries were read-only; no customer email or license data was retrieved.

## 6. Compliance and acquisition

PR #66 remains open and contains an internal assessment that the current screen-reading/clicking product conflicts with Blizzard's published rules, with no explicit authorization identified. Its non-automating planner/spot journal/offline simulator pivot is not merged or shipped.

Do not buy traffic or market the current gameplay automation to official-server players until the applicable platform rules and product scope are resolved. Keep acquisition work behind product/compliance readiness.

## 7. Decisions and next actions

1. **P0 / payment code:** review PR #77 and its exact diff; do not merge/deploy or change secrets until explicit authorization for the Worker/payment change.
2. **P0 / trust:** run `npm run validate`, `npm test`, and `npm run test:e2e` on PR #79's exact head; merge only after CI and deployment side effects are understood.
3. **P0 / first payment:** after authorization, deploy the Worker with `RELEASE_STATUS=pending`, run one controlled Mollie test payment to a controlled mailbox, and verify webhook → license → delivery → activation. No real payment or checkout reopening in this cycle.
4. **P0 / compliance:** decide whether to continue with the current automation scope or implement the non-automating pivot from PR #66.
5. **P1 / growth:** resume SEO and qualified acquisition only after compliance, payment, and fulfillment are proven.

No production mutation, checkout reopening, payment, email, price change, secret change, D1/R2 write, or Worker deployment was performed.
