# BOT-WOW — REVENUE, PRICING & DESIGN SPEC
Date: 2026-11-04
Original branch: revenue/early-access-monthly-499-20261104 (PR #69)
Carried to: revenue/offre-unique-funnel-dedup-20261104 (PR #70)
Base: main @ 2edd74be83f272672b303ccdb316d52137109076

> **Reconciliation note (2026-11-04, PR #70).**
> This spec was drafted on PR #69, which proposed **three monthly subscriptions**
> (ANGLER €4.99 / PATHFINDER €7.99 / FOUNDER €9.99). That commercial decision
> is **superseded**: BOT-WOW ships **one** module (`fish` — see
> `assets/modules.json`), so it supports **ONE CORE OFFER**. The three-tier
> ladder is **rejected** (see §0). Everything in this document that does not
> depend on the tier ladder — the durable webhook/outbox state machine (§15.1),
> the refunds/chargebacks ledger (§15.3), the evidence-freshness rules (§15.4),
> the read-only Cloudflare evidence (§15.5–§15.7), the SEO plan (§10), the
> lead-capture funnel (§11–§14) — is **kept** and re-based on the single
> offer. Sections touched by the pricing change are rewritten below.
>
> Evidence for the decision: [`reports/operations/BOT-WOW-REVENUE-STATE-2026-11-04.md`](../operations/BOT-WOW-REVENUE-STATE-2026-11-04.md)
> (revenue confirmed at **0,00 €**, 0 real customer, Mollie checkout 6/6 failed).
>
> **Location note (PR #70):** this document was drafted under
> `docs/revenue/` on PR #69 and was moved to `reports/revenue/` here.
> `docs/` is a **published** directory (`scripts/build-site.mjs` copies
> `assets`, `docs`, `legal`, `fr` into the artifact), while `reports/` is
> **not published**. This document contains revenue figures and failure
> diagnostics that must not be public, so it now lives under `reports/`.

## 0. Commercial decision: ONE CORE OFFER (one-time licence)

**For new customers, the offer stays what it already is — one licence, one
price, paid once:**

| Offer | EUR | Promise |
|---|---:|---|
| BOT-WOW lifetime licence | **€20,00** (one payment, no renewal) | The working current fishing-assistant build, delivered as a downloadable archive |

- **Free entry:** the browser demo stays free, without email gate, so a
  visitor sees real product value before any commercial ask.
- **No tier ladder, no subscription, no renewal, no trial.** One product →
  one price → one checkout.
- **Source of truth:** `PRICE_TABLE = { "bot-wow-lifetime": { amount: 2000,
  currency: "EUR" } }` in `worker/index.js`; `GET /api/config` returns
  `priceEur: 20`. The client amount is ignored server-side and a mismatched
  amount is refused with `invalid_amount` (400).
- **Old paid lifetime licences and existing orders remain honoured**; never
  migrate or revoke existing customers without explicit consent.
- **Price shown beside every CTA** and at checkout: €20,00 EUR, one-time,
  no renewal.
- **Do not change the price without documented commercial data.** As of
  2026-11-04 there is **no commercial data at all** (0,00 € revenue, 0 real
  customer), so €20 is neither validated nor disproven — it is simply the
  price already displayed, charged and legally documented everywhere.

### Why the three monthly tiers are rejected

| Rejected proposal | Reason |
|---|---|
| ANGLER €4.99/month | A recurring price for a product that cannot demonstrate recurring value; adds an entitlement/billing lifecycle (mandate, renewal, cancellation, paid-through) with **zero measured demand** behind it. |
| PATHFINDER €7.99/month (recommended) | Its differentiating promises (spot memory, route planner, 5 profiles) are **`development`/`planned`** in `assets/modules.json` — selling them would be selling undelivered features. |
| FOUNDER €9.99/month | Priority support and a beta channel have **no delivered counterpart**; would require capacity that has never been measured. |
| The ladder as a whole | It creates **several competing offers** for a product that ships one module, and would require `PRICE_TABLE` to hold several prices — directly contradicting the ONE CORE OFFER rule. |

**If a second offer is ever justified**, it must be backed by measured
demand (conversion per offer, refunds, retention) **and** by delivered
features — not by a design document. Introduce one offer at a time, with its
own allowlist, its own webhook/entitlement semantics and its own evidence.

## Honest Early Access positioning

This is a premium Early Access launch, not a fake ready-software claim. The current R2 bucket does contain an object named casinobabe-fishing-1.2.0.zip (1,387,543 bytes, modified 2026-10-27) and an older v1.0.38 zip (1,229,709 bytes). Existence is verified; integrity, compatibility, clean Windows install, SHA-256 manifest and end-to-end customer delivery are NOT verified yet.

The current main buy.html shows a hard warning and disables checkout because delivery was unconfirmed. Replace the frightening blocker copy with a strong conversion-first Early Access product story, but only enable the charge after the R2 artifact passes integrity/install tests and paid customers can receive it.

If the package is verified:
- Sell the single licence as access to the working current fishing-assistant build.
- Display in-validation or planned features as "en préparation"; do not sell them as already shipped.

If the package cannot be delivered yet:
- Present a premium Early Access waitlist/reservation or a clearly documented pre-order with an honest delivery window, terms and refund mechanics.
- Do not take a charge for a service that has not begun and cannot be accessed.
- Do not make up a release date, support capacity, testimonials, customer count, gold/hour results or compatibility.

## Design — replace the current warning-heavy purchase page

Retain BOT-WOW's recognizable charcoal/black, warm-gold CTA, Sora and JetBrains Mono, compact gaming-product energy. Make the experience persuasive and direct.

Hero:
- Eyebrow: WOW CLASSIC · FISHING ASSISTANT
- H1: "Le compagnon de pêche qui apprend tes spots."
- Subheadline: "Détecte les touches, garde la mémoire de tes spots et organise tes tournées — en accès anticipé."
- Main CTA: "Obtenir ma licence"
- Secondary CTA: "Voir la démo"
- Price line: "20,00 € · paiement unique · sans renouvellement"
- Use a real capture from a verified gameplay session. The browser demo is simulated; label it as simulation.

Page flow:
1. Hero with actual gameplay capture/video and a clear CTA.
2. Three proof steps: détecter la touche → mémoriser le spot → organiser la tournée. Use only features verified in build.
3. Working-feature strip: "Disponible maintenant / En validation / En préparation", accurate and low-drama.
4. **One** offer card: €20,00, one-time payment, what is included today, device limit, refund terms.
5. Product evidence: real session capture, installation steps and actual changelog.
6. Compatibility: only tested WoW client/build and Windows configurations.
7. FAQ: what is included today, installation, updates, payment, device limit, refund.
8. Clear note that automation can violate Blizzard's terms and may lead to account sanctions. No "zero ban", "undetectable", "safe" or Blizzard-affiliation claims.
9. Footer with support, terms, privacy, refunds and billing.

Offer card (single):
BOT-WOW licence — €20,00, paid once:
- Core fishing loop (cast, float/bite detection, click) only if verified in packaged artifact.
- Device activations: **one machine** — the copy must match
  `DEFAULT_MAX_ACTIVATIONS` in the Worker (currently `2`: see §16).
  Do not publish "no seat limits" next to "activates on one machine".
- Updates shipped for the lifetime of the product line; no per-update fee.
- Standard email support.

CTA labels:
- "Obtenir ma licence · 20,00 €"

No fake urgency, fake reviews, fake "players online", fake sales counters or fake star ratings. Replace dead checkout styling with attractive, reassuring Early Access framing. Don't obscure the state of the downloadable build or the real delivery commitment.

## Technical facts and evidence status

The facts below are dated observations, not guarantees of current production state. The read-only Cloudflare request/result summary is recorded in [§15.5](#155-fresh-read-only-cloudflare-evidence--2026-11-04t040832663z), and the package/storefront/fulfillment checks are recorded in §15.6 and the linked [operations snapshot](../operations/BOT-WOW-CURRENT-STATE.md). The live counts and deployment details were queried directly on 2026-11-04; package-byte verification and the public storefront were checked later in this follow-up. Anything explicitly described as not verified remains a release blocker.

- Latest main SHA: 2edd74be83f272672b303ccdb316d52137109076.
- Main buy.html currently advertises €20 lifetime and disables checkout because delivery is not confirmed. It still says spot-to-spot movement is in validation; combat/XP/quests/BG are not shipped.
- Cloudflare production Pages canonical deploy: 2026-10-30 01:01:32Z, commit 2edd74be83f272672b303ccdb316d52137109076.
- botwow-api latest production Worker deployment: 2026-10-27 07:46:28Z, version c3dcc842-c422-42d3-9828-405f30d70b5f. Main source and production Worker have previously shown a RELEASE_STATUS contract mismatch: production checks for confirmed while proposed P0.99/P0.5 code refers to open. Reconcile the exact Worker source before altering the gate. Never guess or reveal secret values.
- The 2026-11-04 control-plane snapshot showed both R2 objects and their sizes; the later read-only package check in §15.6 verified the v1.2.0 object bytes and manifest. End-user installation and activation remain unverified.
- Cloudflare D1 botwow-production: orders 25, licenses 5, activations 0, deliveries table 0, webhook_events 16 at 2026-11-04 read-only check. A zero deliveries row count does not prove no email was sent; trace the actual mail helper and confirm provider result. Never send real customer email in tests.
- D1 table licenses currently max_activations default 2; change only with migration and tests preserving old licences.
- Main Worker code has webhook idempotency via webhook_events; keep it.

## Mollie payment implementation (single one-time payment)

Mollie reference for a one-off payment:
- https://docs.mollie.com/reference/create-payment
- https://docs.mollie.com/reference/get-payment
- https://docs.mollie.com/reference/webhooks

Implementation rules for the single offer:
1. The customer selects **the** offer and sees the explicit price (€20,00 EUR,
   one-time, no renewal) beside the CTA and at checkout.
2. Create one payment at the exact offer price with `customerId` when known.
   `sequenceType` stays `oneoff` — **no mandate, no subscription**.
3. Retrieve the canonical payment state server-to-server and require `paid`.
   A pending or failed payment grants **no** licence.
4. Store durable order + licence state, the provider payment ID and the
   entitlement (a perpetual licence) in the same durable write as the
   webhook marker, following the state machine in §15.1.
5. The licence is issued **once** per confirmed payment. A replayed webhook
   must never create a second licence or extend an entitlement twice.
6. Enforce the device-activation limit server-side.
7. Browser return URL, localStorage or a payment-start event **never** grants
   access — only a server-verified `paid` payment does.
8. A refund or chargeback revokes the licence per §15.3 and emits a
   `license_revoked` funnel event (currently missing — see the revenue report).
9. Existing lifetime licences, historic paid orders and licences remain valid.
10. **Test mode first.** A test payment (`payment.mode === "test"`) is marked
    `test = 1` and carries `value_eur = NULL`, so no aggregate can ever count
    it as revenue (implemented in PR #70).

> If a subscription is ever reintroduced, it must be a **separate, explicit
> decision** backed by measured demand, and must implement the full mandate /
> renewal / cancellation / paid-through lifecycle described in the original
> PR #69 draft (retained below in §15.2 as a reference, not as an active
> requirement).

## Launch tests

- Validate the EUR offer allowlist server-side; reject any tampered amount
  or unknown product id with `invalid_amount` / `invalid_product`.
- A confirmed payment creates exactly **one** order and **one** licence;
  pending/failed creates none.
- No double charge on signup.
- A duplicate webhook cannot create a duplicate order/licence.
- A test-mode payment is marked `test = 1` and stores `value_eur = NULL`.
- A refund revokes the licence and emits `license_revoked`; a chargeback
  does the same; a reversed chargeback restores it (§15.3).
- Device limit enforced server-side and consistent with the published copy.
- Verify ZIP SHA-256 against manifest, archive contents, Windows 10/11 install, activation, download authorization, and actual email delivery to a test sink.
- Confirm live R2 object key binding and Worker RELEASE_STATUS semantics agree with the code.
- Preserve old lifetime customers and checkout history.

## Go-live requirements

Use Mollie TEST mode and test email sink first. Once artifact
integrity/install/delivery, payment confirmation, licence issuance,
revocation and rollback tests all pass, and **only then**, enable the charge
for the single offer. Do not publish a charge for a non-deliverable product.
A production charge is allowed only when the product can be delivered and the
customer-facing wording (price, one-time nature, refund terms) is explicit
and identical to the amount the Worker actually charges.

**Current status (2026-11-04):** the charge is **not** open. The Worker
checkout is still gated by the release/offer status contract, the interface
keeps the purchase button disabled, and the Mollie checkout has failed 6/6 in
production (2026-10-27) — cause not yet established. See
`reports/operations/BOT-WOW-REVENUE-STATE-2026-11-04.md` §4 (B1).


## 10. SEO acquisition — technical and content plan

### Existing SEO assets verified

- sitemap.xml currently lists about 38 English/French URLs: home, features, fishing, demo, installation, compatibility, roadmap, modules, compare, FAQ, buy, documentation/changelog/known issues/license, and bilingual legal pages.
- robots.txt allows public pages while disallowing /api/, /worker/, /backups/, /migrations/ and /tests/.
- Homepage title currently targets WoW Classic fishing bot but the meta description and social snippets still advertise a €20 lifetime license.
- buy.html and the site header also advertise €20 lifetime. This is now the **single and only** paid offer, so the price must stay identical across all EN/FR pages, JSON-LD and sitemaps — any divergence between the displayed price and the charged amount is a defect (the Worker refuses a mismatched amount with `invalid_amount`).
- The existing sitemap is useful; do not create one thin page per keyword or replace the existing structure without reason.

### Keyword intent clusters (hypotheses; no search-volume claims)

High purchase intent:
- WoW Classic fishing bot
- WoW Classic fishing assistant
- WoW Classic fishing automation
- WoW Classic bot fishing
- WoW Classic fishing bot Windows
- Casinobabe fishing bot

Research/consideration intent:
- WoW Classic fishing guide
- WoW Classic fishing spots by zone
- how to level fishing in WoW Classic
- WoW Classic float/bite detection
- fishing route / fishing spot memory
- install WoW Classic fishing addon

Support / conversion assurance:
- how to install Casinobabe
- BOT-WOW compatibility WoW Classic 1.13
- fishing bot setup and troubleshooting
- update / licence / activation / refund questions

Use Search Console impressions and actual queries to reorder these clusters. Do not invent keyword volumes, difficulty, positions or competitors' traffic. Do not publish content about Retail, Mac, expansion versions or private servers unless the exact tested scope is confirmed in the compatibility matrix.

### Page architecture

Create or improve only useful, differentiated pages:
1. Main product / purchase page: one clear promise, real product screenshot, exact supported client, the single offer and CTA.
2. WoW Classic fishing assistant/bot page targeting purchase intent.
3. WoW Classic fishing guide with useful and accurate progression advice.
4. Fishing spots guide organized by tested zones and actual product capability.
5. Setup/install/troubleshooting cluster with real screenshots and verified steps.
6. Feature explanation pages: bite detection, spot memory, route planning — publish only when present in tested release.
7. Comparison page clarifying what BOT-WOW does versus manual fishing and other addon categories; no unsupported competitor attacks or fake performance measurements.

Every page needs unique title/H1/meta description, canonical, language alternate/hreflang, relevant internal links, date only when meaningfully updated, and a clear CTA matched to intent. Add breadcrumb and SoftwareApplication/Product structured data only when details and prices match the visible offer. Structured data does not guarantee enhanced search results.

### Editorial proof standards

- Use real screenshots, real release notes and measured results only.
- Distinguish simulation from real in-game operation.
- State exact WoW Classic client/build and Windows environment verified.
- No "undetectable", "ban-safe", "zero risk", Blizzard endorsement or guarantee against penalties. Clearly state that automation may violate game terms and may lead to sanctions.
- Do not fabricate testimonials, user counts, gold/hour results, download numbers, star ratings or availability dates.
- Keep FR and EN articles genuinely localized, not duplicated machine translations.

### Technical SEO checks

- Validate robots.txt and sitemap.xml on production after build. Only canonical, indexable, HTTP 200 pages in sitemap.
- Noindex checkout result, account, token, activation and utility endpoints.
- Check canonical/hreflang reciprocity, duplicate EN/FR content, trailing-slash/redirect consistency, metadata, Open Graph, broken links and image alt text.
- Keep page load fast, lazy-load media below fold, include intrinsic image dimensions and avoid heavy third-party scripts.
- Preserve existing URL equity and redirects; do not rename all pages casually.
- Use real video embeds with transcript/captions if video content exists; do not add VideoObject schema for a simulated demo.
- Follow Google Search Central people-first and anti-spam guidance; no doorway pages, scaled low-value AI pages, hidden content, keyword stuffing, link schemes or fake reviews.

## 11. Lead capture and early-access funnel

The free browser demo should remain accessible without email. Do not force an email gate before the visitor sees the actual product value.

Capture at high intent:
- After demo completion: offer a "WoW fishing setup checklist" or early-access update signup.
- On pricing selection: email capture for a saved quote or release availability.
- If artifact is not verified: clearly named Early Access waitlist / preorder interest capture with a real delivery status and transparent refund terms.
- If the artifact is verified: proceed to checkout and deliver the install bundle after confirmed payment.
- Ask for email and language only unless additional fields are necessary. Separate service updates from optional marketing consent and never pre-check.
- Store consent version/time/source; support unsubscribe and deletion.
- Do not email users from failed/pending orders unless they opted in to marketing or a legally valid transactional follow-up applies.

Measure:
- organic_landing_view;
- feature_view / demo_start / demo_complete;
- lead_form_view / lead_submit / email_verified;
- offer_view / checkout_requested / checkout_start;
- payment_started / payment_paid / license_created / delivery_sent;
- download_started / download_completed / activation_success;
- refund_issued / license_revoked / dispute_opened.

The **server-side** events (`payment_confirmed`, `license_created`,
`delivery_sent`, `activation`, `license_revoked`) are the only ones that may
be counted as revenue or usage: a browser redirect, a `payment-start` event
or a localStorage flag **never** is. Carry UTM parameters and the original
landing page through checkout and webhook.

Event names are dedup'd client-side by `event|page|cta|step|mode|years`
(see `assets/analytics.js`), and the D1 `events` table has no uniqueness
constraint — so the deduplication key must include the page, otherwise
`page_view` would collapse to one per session.

## 12. Read-only production signals observed 2026-11-04

Cloudflare D1 botwow-production:
- 25 orders: 5 paid, 8 pending_payment, 11 failed and 1 rejected.
- The five paid orders total €100 in the normalized EUR currency rows.
- 5 licences.
- 0 activations rows in the activations table.
- 0 rows in the deliveries table.
- 16 webhook_events.
- The zero deliveries count does not prove no email was delivered; trace the real Resend delivery helper and provider response. Likewise, zero activations may indicate an unused path; reconcile with actual logs and licence API before claiming no users activated.
- There are existing pending/failed orders worth investigating; do not send recovery messages without proper consent and do not expose customer email addresses in analytics.
- R2 lists v1.2.0 zip 1,387,543 bytes; the actual checksum, archive integrity, Windows installation and customer delivery remain to be verified.

## 13. Conversion funnel — one high-intent route

Organic query → exact answer page → real product proof → demo → the single
offer → checkout → Mollie payment → **server-verified** `payment_confirmed` →
licence issued → verified download → activation → first successful use →
(and later, refund/dispute if applicable).

Offer positioning:
- **BOT-WOW licence — €20,00 EUR, one-time payment, no renewal.**

No recurring charge, no mandate, no paid-through logic: the entitlement is a
perpetual licence for the purchased build. Do not collect any charge for a
product that cannot be delivered. If package delivery is not ready, use a
waitlist or transparent pre-order with refund terms and a substantiated
delivery timeline; do not label that as instant access.

The funnel is instrumented and the **real** measured state (2026-11-04) is:
`page_view` 1 432 · `journey_view` 531 · `cta_click` 48 ·
`checkout_requested` 29 · `checkout_start` 4 · `checkout_created` 6 ·
`checkout_failed` 6 · **everything after `checkout_created` = 0**, because
**no Mollie payment ever succeeded**. See
`reports/operations/BOT-WOW-REVENUE-STATE-2026-11-04.md` §2.

## 14. Launch marketing loop

- Publish one genuinely helpful topical page or tutorial at a time, tied to a verified capability.
- Make short video demos from actual gameplay, each linking to the corresponding guide page.
- Reuse real support questions as FAQ/installation content.
- Reach relevant WoW Classic communities and creators without unsolicited bulk promotion or spam.
- Request honest feedback from actual users after activation; never manufacture reviews.
- Build an organic referral mechanism only if it is measurable and does not reward fake signups.
- Review organic query → demo → paid licence weekly and update content based on GSC data, not guessed demand.


## 15. Codex review resolutions — 2026-11-04

### 15.1 Recoverable webhook idempotency after partial failure

A unique `webhook_events` key is necessary but is not sufficient if it permanently marks a payment as handled before fulfilment has committed. Process each provider payment using a durable state machine:

- Fetch the canonical Mollie payment server-to-server; never trust the browser return or webhook payload as the payment status.
- Track `processing`, `processed` and `retryable_failed` (plus attempt count, timestamps and a recoverable lease) against a unique provider event/payment key.
- Commit the order transition, entitlement/licence changes and a unique durable delivery-outbox item together in one database transaction/batch wherever possible. External email delivery must happen from the committed outbox, not before it.
- A duplicate already marked `processed` may return HTTP 200. A retryable failure or stale `processing` lease must be reclaimed and processed; do not return 200 merely because a marker row exists. Return a retryable non-2xx response when durable processing cannot complete, so Mollie can retry.
- Make outbox delivery independently idempotent. Record provider result, attempt count and failure reason; do not let an email timeout repeat licence creation or paid-through extension.

Failure-injection tests are mandatory at each boundary: after event reservation, after order update, after licence write, after outbox commit, and during email-provider timeout. A replay must eventually complete the paid order exactly once, with no duplicate licence, entitlement extension or delivery. Mollie's current webhook documentation says non-2xx/timeouts are retried up to 10 attempts over 26 hours: https://docs.mollie.com/reference/webhooks

### 15.2 Supported Mollie mandate states — reference only (no subscription today)

> **Status (PR #70):** the single offer is a **one-time payment**; no
> mandate and no subscription are created, so nothing in this section is
> active code today. It is kept as the **spec to apply if and only if** a
> subscription is ever reintroduced by an explicit commercial decision backed
> by measured demand. Do not implement it speculatively.

Do not require a mandate to be `valid` only. Mollie's current recurring-payments guide explicitly permits both `pending` and `valid` mandate statuses when creating a subscription; when neither exists, initiate the required first payment: https://docs.mollie.com/docs/recurring-payments

After the first payment is confirmed paid, fetch the customer's mandates from Mollie and permit the documented `pending` or `valid` states. Keep the subscription creation idempotent. Add test-mode coverage for both mandate states and for the no-eligible-mandate path. Do not grant an entitlement from a pending first payment.

### 15.3 Reversed refunds and chargebacks

> **Status (PR #70):** for the one-time licence there is no `paid_through`
> period: a confirmed payment grants a **perpetual licence**, and a reversal
> revokes **that** licence. The ledger model below still applies — one
> entitlement per provider payment — but `paid_through` becomes
> "licence validity" and a reversal flips it to revoked instead of shrinking
> a period. **A revocation event (`license_revoked`) does not exist yet in the
> Worker** (see the revenue report, §2.4): today a refund would be invisible
> in the funnel. This is a known gap, not a solved one.

Maintain a payment-level entitlement ledger so a later reversal can remove only the entitlement supported by that payment, rather than blindly revoking unrelated paid access.

- `refund.pending` / `refund.processing`: record the refund in progress; do not treat it as a completed reversal.
- `refund.refunded`: mark the associated payment reversed and revoke the licence it created.
- `chargeback.received`: mark the payment disputed/reversed for entitlement purposes and suspend access. Preserve older, independently paid entitlements.
- `chargeback.reversed`: record the reversal of the dispute and restore the entitlement only after fetching and reconciling the authoritative payment/chargeback state.
- `refund.failed` / `refund.canceled`: retain the original entitlement unless another authoritative status requires a change.

Use unique provider event IDs (or a stable event-type + payment/refund/chargeback identifier) and idempotent recomputation. Do not extend access twice, revoke unrelated licences, or let an out-of-order older event overwrite a newer provider state. Test duplicate, delayed and out-of-order refund/chargeback events, including chargeback reversal. Mollie documents payment webhooks for refunds and chargebacks, and the newer event catalogue includes `chargeback.received` and `chargeback.reversed`: https://docs.mollie.com/reference/webhooks and https://docs.mollie.com/reference/create-webhook

### 15.4 Evidence and freshness of production facts

The production counts and deployment details in section 12 are a **read-only point-in-time snapshot observed on 2026-11-04**, not a persisted signed audit artifact or a guarantee that the environment is unchanged. Treat them as historical clues only. Before implementation or release, re-query the live Cloudflare Pages deployment, Worker version/bindings, R2 object metadata and D1 counts; attach the resulting timestamped evidence (or CI artifact) to the implementation PR. Do not infer successful delivery, activation, archive integrity or end-user installation from object/table counts alone.

The code reference for the repository baseline used in that snapshot is https://github.com/aveca/bot-wow/commit/2edd74be83f272672b303ccdb316d52137109076. The snapshot values remain provisional until refreshed directly from the control plane.


### 15.5 Fresh read-only Cloudflare evidence — 2026-11-04T04:08:32.663Z

The following control-plane values were queried directly from Cloudflare in this session. This is a timestamped point-in-time observation, not a guarantee that state cannot change afterward. All requests below were read-only; no production resource, secret, payment, object or database row was modified.

| Surface | Direct read-only evidence | Observed result |
|---|---|---|
| Cloudflare Pages production | `GET /accounts/abf2b92cf718313567b4b38eb9dda17f/pages/projects/bot-wow/deployments?env=production&page=1&per_page=1` | Latest production deployment `84b0a681-f816-49b4-9a74-5c885eedbbef`, success, created `2026-10-30T01:01:32.826445Z`, source branch `main`, commit `2edd74be83f272672b303ccdb316d52137109076`; aliases include https://bot-wow.com and https://www.bot-wow.com. Preview/doc PR changes are not live. |
| Cloudflare Worker deployment | `GET /accounts/abf2b92cf718313567b4b38eb9dda17f/workers/scripts/botwow-api/deployments` | Latest deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc`, 100% assigned to version `c3dcc842-c422-42d3-9828-405f30d70b5f` (version 50), created `2026-10-27T07:46:28.277198Z`. |
| R2 release object metadata | `GET /accounts/abf2b92cf718313567b4b38eb9dda17f/r2/buckets/botwow-binaries/objects?per_page=50&prefix=casinobabe-fishing-1.2.0.zip` | `casinobabe-fishing-1.2.0.zip` exists; 1,387,543 bytes; content type `application/zip`; last modified `2026-10-27T06:31:06.784Z`; ETag `d9d7ab22ec076873b8fed656a53460bc`. This ETag is object metadata and is **not** a SHA-256 proof. No object bytes were downloaded or changed in this check. |
| D1 table counts | Read-only D1 query on `botwow-production`, database `e57f5874-a9f0-42bf-8dbc-10785ef083f5` | `orders=25`, `licenses=5`, `activations=0`, `deliveries=0`, `webhook_events=16`; query metadata reported `changed_db=false`, `rows_written=0`. |
| D1 order states and paid total | Read-only grouped `SELECT` on `orders` | `failed=11`, `paid=5`, `pending_payment=8`, `rejected=1`; paid rows are `eur`, 5 orders, `total_minor_units=10000` (= €100.00). |

The older P0.7 operations snapshot records a previously checked archive SHA-256 of `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`; that prior report is not a fresh byte-level verification in this session. Current R2 metadata alone cannot certify archive integrity, a clean Windows installation, or successful end-to-end customer delivery. The zero `deliveries` and `activations` table counts do not prove no email was sent or no customer activated through another path; those require provider/log evidence.

**Operational consequence:** production Pages is still on the 2026-10-30 main commit and the production Worker is still on version 50 from 2026-10-27. This PR remains documentation/design only; no price, checkout, Worker, secret, R2 or live-payment change is authorized by this evidence refresh.

### 15.6 Read-only package, storefront and delivery-path check — 2026-11-04

The release archive and public storefront were checked again during the revenue-factory follow-up. These checks did not modify Cloudflare, R2, D1, Mollie, Resend, or the public site.

The implementation follow-up is committed on PR #69 as `5ccb1e231e5f20bc15c1e506aa88fce4068f8caa`; CI and a new Codex review are required on the pushed head before this branch is considered ready.

- `wrangler r2 object get botwow-binaries/casinobabe-fishing-1.2.0.zip --remote` downloaded the release object to a temporary local path. The downloaded file is 1,387,543 bytes; SHA-256 is `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`. .NET ZIP enumeration succeeded, there are 30 entries, no absolute or parent-traversal paths, and all 26 file hashes and lengths listed in `MANIFEST.json` match. `VERSION` is `1.2.0`. The archive's whole-file SHA covers the four ZIP entries outside the manifest (including the manifest itself).
- The archive was extracted to a new temporary directory on the available Windows 11 Home host (build 26300). `py -3 --version` was 3.14.4 and `py -3 -m compileall -q` passed for the extracted package. This is a clean extraction and Python syntax check only: the launcher was not run, no addon was installed into a live WoW folder, no Windows 10 VM was available, and activation was not tested. Do not claim a clean installation/activation proof from this check.
- Public `GET https://bot-wow.com/buy.html` and `/fr/buy.html` returned 200. The live page still carries the existing one-time €20 copy and a disabled purchase button; this check did not submit the form. The public `GET https://api.bot-wow.com/api/config` returned `product=bot-wow-lifetime`, `priceEur=20`, `currency=eur`. Preserve this configuration; proposed monthly prices are not active. All four old `/ab/.../buy.html` routes returned 404 in production. The PR now redirects those legacy variant paths to the closed EN/FR Early Access pages if the branch is later deployed; this redirect is not live yet.
- In the PR branch, Worker checkout requires both `RELEASE_STATUS=confirmed` and the separate `LEGACY_LIFETIME_OFFER_STATUS=confirmed`. The second environment value is intentionally absent from this branch's Wrangler configuration, so both legacy Mollie and Bitcoin offer routes remain closed by default even if delivery is marked ready. Tests verify missing/pending release state and missing/non-confirmed offer state fail before a Mollie call or order write. The production secret/config values were not read, and no Worker was deployed. The €20 public API configuration is unchanged.
- **PR #70 carry-over:** only the **log-redaction** part of PR #69's implementation is carried over (e-mail address, licence key and download token removed from Worker logs, with a test). The `LEGACY_LIFETIME_OFFER_STATUS` checkout gate and the `/ab/.../buy.html` redirects are **not** carried over: the checkout gate is a commercial decision (it would close the offer entirely), and the `/ab/...` routes already answer 404 in production, so a redirect there is optional polish, not revenue.
- Fulfillment sends through `sendDeliveryEmail2` → `sendEmail2` → `POST https://api.resend.com/emails`; a successful 2xx returns Resend's message ID in memory. The current database records failed sends for retry, but does not persist successful provider IDs or later delivered/bounced events. The older `/api/resend` handler still reaches a log-only helper and does not call Resend. Cloudflare's read-only Worker `script-settings` response returned `observability: null`, so this session could not retrieve historical provider logs. A zero `deliveries` count is not evidence that no emails were sent. No real email was sent by these checks. The PR also removes recipient emails, license keys and download tokens from Worker log statements and tests this guard.

Local validation for the PR branch at `aca79ee4666e73eacc58bf86c5c258a4cdc88cd4`: `npm ci` completed with 0 reported vulnerabilities; `npm test` passed; `npm run validate` passed; `npx playwright test --reporter=line` passed 154/154; `git diff --check` passed. These local results are not a substitute for CI on the pushed PR head. The recurring subscription and recoverable webhook lifecycle remains a design requirement, not implemented billing code; it must be implemented and tested in Mollie TEST before any offer can open.

### 15.7 Fresh public storefront and API GET — 2026-11-04T05:48:22Z

This was a read-only public check; no checkout form or API POST was submitted.

| Request | Direct result | Observed content |
|---|---|---|
| `GET https://bot-wow.com/buy.html` | 308, `Location: /buy`; following the redirect returned 200 | Final page contains the existing €20 copy. |
| `GET https://bot-wow.com/fr/buy.html` | 308, `Location: /fr/buy`; following the redirect returned 200 | Final page contains the existing €20 copy. |
| Four production `/ab/.../buy.html` URLs | 404 each | A/B checkout pages remain unavailable in production. |
| `GET https://api.bot-wow.com/api/config` | 200 | `product=bot-wow-lifetime`, `priceEur=20`, `currency=eur`, `bitcoin.enabled=true`, `bitcoin.address=null`. |

The public configuration still advertises Bitcoin as enabled while returning no address. This GET does not establish whether the live POST endpoint accepts an order; no POST was attempted. The stricter offer-specific check exists only in the un-deployed PR branch, and production secret/binding values were not inspected.

## 16. Open contradictions — decisions required (not taken unilaterally)

| # | Contradiction | Evidence | Decision needed |
|---|---|---|---|
| **D1** | `buy.html` / `fr/buy.html`: « A licence activates on one machine. » vs `DEFAULT_MAX_ACTIVATIONS = 2` in the Worker vs `faq.html`: « no seat limits » | `worker/index.js`, `buy.html:216`, `fr/buy.html:215`, `faq.html:59` | **Founder decision.** Changing the constant is a commercial guarantee change and must ship with the matching copy + legal text (and a migration that preserves existing licences). Changing the copy is a promise change. Both are out of scope for an instrumentation/offer-architecture pass. |
| **D2** | Mollie checkout fails **6/6** in production (2026-10-27) while the secrets exist | D1 analytics `checkout_created`=6 / `checkout_failed`=6; `MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET` present | `createMolliePayment` never sends `profileId`. Establishing the exact cause requires **creating a real Mollie payment** → explicit authorization needed. Until then, no euro can enter. |
| **D3** | The interface disables the purchase button (PR #54) but the Worker would still accept a direct POST | `buy.html`, `index.html`, `compare.html` + `worker/index.js` | Decide whether the gate is enforced **server-side** (a Worker-level offer status) or only in the UI. Server-side is the safer default but it is a production gate change → authorization needed. |
| **D4** | `demo_open` and `offer_view` are emitted by the client but have **0 row** in D1 | D1 analytics census 2026-11-04 | Investigate (page actually visited? `IntersectionObserver` blocked? Do Not Track?) before using them as funnel steps. |
| **D5** | A refund or chargeback revokes the licence but writes **no event** | `worker/index.js` — `revokeLicense` without `emitFunnelEvent` | Add a `license_revoked` server event (code change, low risk, no commercial impact). |

**Rule for all five:** no offer is declared profitable, no price is changed,
and no checkout/refund/payment/customer-email behaviour is altered without
explicit authorization. The measured state is **0,00 € revenue, 0 real
customer** — there is no commercial data to justify a pricing change.

