# BOT-WOW — REVENUE, PRICING & DESIGN SPEC
Date: 2026-11-04
Branch: revenue/early-access-monthly-499-20261104
Base: main @ 2edd74be83f272672b303ccdb316d52137109076

## Commercial decision: three monthly subscriptions

For new customers, replace the one-time €20 lifetime proposition with three monthly plans:

| Plan | EUR / month | Promise |
|---|---:|---|
| ANGLER | €4.99 | Core fishing assistant, one PC |
| PATHFINDER (recommended) | €7.99 | ANGLER + spot memory, route planner and up to 5 profiles where verified |
| FOUNDER | €9.99 | PATHFINDER + 2 devices, priority support and beta channel |

Auto-renew every month. First charge at signup; next monthly charge one month later. Cancel online at any time; retain access through the paid-through date. No trial, no lifetime claim for new plans, no hidden annual commitment.

Old paid lifetime licences and existing orders remain honoured; never migrate or revoke existing customers without explicit consent. Price, monthly cadence, first charge and cancellation route visible beside every CTA and at checkout.

## Honest Early Access positioning

This is a premium Early Access launch, not a fake ready-software claim. The current R2 bucket does contain an object named casinobabe-fishing-1.2.0.zip (1,387,543 bytes, modified 2026-10-27) and an older v1.0.38 zip (1,229,709 bytes). Existence is verified; integrity, compatibility, clean Windows install, SHA-256 manifest and end-to-end customer delivery are NOT verified yet.

The current main buy.html shows a hard warning and disables checkout because delivery was unconfirmed. Remove the frightening blocker copy and replace it with a strong conversion-first Early Access product story, but only enable recurring charges after the R2 artifact passes integrity/install tests and paid members can receive it.

If the package is verified:
- Sell ANGLER as access to the working current fishing assistant build.
- Add PATHFINDER/FOUNDER entitlements only after their actual features and licensing limits pass tests.
- Display in-validation or planned features as "en préparation"; do not sell them as already shipped.

If the package cannot be delivered yet:
- Present a premium Early Access waitlist/reservation or a clearly documented pre-order with an honest delivery window, terms and refund mechanics.
- Do not take an automatic recurring subscription charge for a service that has not begun and cannot be accessed.
- Do not make up a release date, support capacity, testimonials, customer count, gold/hour results or compatibility.

## Design — replace the current warning-heavy purchase page

Retain BOT-WOW's recognizable charcoal/black, warm-gold CTA, Sora and JetBrains Mono, compact gaming-product energy. Make the experience persuasive and direct.

Hero:
- Eyebrow: WOW CLASSIC · FISHING ASSISTANT
- H1: "Le compagnon de pêche qui apprend tes spots."
- Subheadline: "Détecte les touches, garde la mémoire de tes spots et organise tes tournées — en accès anticipé."
- Main CTA: "Choisir mon accès"
- Secondary CTA: "Voir la démo"
- Price line: "À partir de 4,99 €/mois · Résiliable en ligne"
- Use a real capture from a verified gameplay session. The browser demo is simulated; label it as simulation.

Page flow:
1. Hero with actual gameplay capture/video and a clear CTA.
2. Three proof steps: détecter la touche → mémoriser le spot → organiser la tournée. Use only features verified in build.
3. Working-feature strip: "Disponible maintenant / En validation / En préparation", accurate and low-drama.
4. Three plan cards with monthly price and cancellation terms, PATHFINDER visually recommended.
5. Product evidence: real session capture, installation steps and actual changelog.
6. Compatibility: only tested WoW client/build and Windows configurations.
7. FAQ: what is included today, installation, updates, payment, renewal, cancellation, refund.
8. Clear note that automation can violate Blizzard's terms and may lead to account sanctions. No "zero ban", "undetectable", "safe" or Blizzard-affiliation claims.
9. Footer with support, terms, privacy, refunds, billing and cancellation.

Plan cards:
ANGLER €4.99/month:
- Core fishing loop (cast, float/bite detection, click) only if verified in packaged artifact.
- One PC activation.
- Stable releases while paid.
- Standard email support.

PATHFINDER €7.99/month:
- All ANGLER.
- Persistent spot memory + JSON import/export once verified.
- Route planner/optimized rounds once verified.
- Up to five saved profiles/characters (enforce server-side).
- Standard support.

FOUNDER €9.99/month:
- All PATHFINDER.
- Two device activations (enforce server-side).
- Priority support.
- Preview/beta channel with clear beta labels and release notes.
- Unlimited profiles only if implemented and enforced.

CTA labels:
- "Rejoindre ANGLER · 4,99 €/mois"
- "Choisir PATHFINDER · 7,99 €/mois"
- "Accéder à FOUNDER · 9,99 €/mois"

No fake urgency, fake reviews, fake "players online", fake sales counters or fake star ratings. Replace dead checkout styling with attractive, reassuring Early Access framing. Don't obscure the state of the downloadable build or the real delivery commitment.

## Technical facts verified

- Latest main SHA: 2edd74be83f272672b303ccdb316d52137109076.
- Main buy.html currently advertises €20 lifetime and disables checkout because delivery is not confirmed. It still says spot-to-spot movement is in validation; combat/XP/quests/BG are not shipped.
- Cloudflare production Pages canonical deploy: 2026-10-30 01:01:32Z, commit 2edd74be83f272672b303ccdb316d52137109076.
- botwow-api latest production Worker deployment: 2026-10-27 07:46:28Z, version c3dcc842-c422-42d3-9828-405f30d70b5f. Main source and production Worker have previously shown a RELEASE_STATUS contract mismatch: production checks for confirmed while proposed P0.99/P0.5 code refers to open. Reconcile the exact Worker source before altering the gate. Never guess or reveal secret values.
- R2 bucket botwow-binaries has casinobabe-fishing-1.2.0.zip (1,387,543 bytes) and Casinobabe-v1.0.38.zip (1,229,709 bytes). Verify object bytes/checksum and actual install before enabling delivery.
- Cloudflare D1 botwow-production: orders 25, licenses 5, activations 0, deliveries table 0, webhook_events 16 at 2026-11-04 read-only check. A zero deliveries row count does not prove no email was sent; trace the actual mail helper and confirm provider result. Never send real customer email in tests.
- D1 table licenses currently max_activations default 2; change only with migration and tests preserving old licences.
- Main Worker code has webhook idempotency via webhook_events; keep it.

## Mollie subscription implementation

Follow current Mollie API docs:
- https://docs.mollie.com/docs/recurring-payments
- https://docs.mollie.com/reference/create-customer-payment
- https://docs.mollie.com/reference/create-subscription
- https://docs.mollie.com/reference/list-subscription-payments

Use a real first-payment mandate flow:
1. Customer selects plan and sees explicit monthly renewal consent.
2. Create/find Mollie customer.
3. Create first payment at exact plan price with customerId and sequenceType=first.
4. Verify payment paid and valid mandate server-to-server.
5. Create one monthly subscription with first renewal at the next billing period.
6. Store durable subscription/license plan state, current paid-through, next due and provider IDs.
7. Renewal webhooks arrive as new payment IDs with subscriptionId; retrieve canonical payment from Mollie and correlate idempotently.
8. Successful renewals extend entitlement once. Failed attempts do not extend; Mollie may retry up to five times depending on failure reason.
9. Cancellation must stop future billing but keep access to the already-paid period.
10. Self-service cancellation, billing recovery and access recovery.
11. Enforce device/profile entitlements server-side.
12. Browser return URL, localStorage or a payment-start event never grants access.
13. Existing lifetime licences, historic paid orders and licenses remain valid.

## Launch tests

- Validate EUR plan allowlist and monthly interval; reject tampering.
- First payment paid creates exactly one subscription; pending/failed creates none.
- No double charge on signup.
- Duplicate first payment / renewal webhook cannot create duplicate order/licence or extend twice.
- Renewal success extends paid-through; failure does not.
- Cancel stops next charge but preserves paid-through access.
- Expiry disables licence and protected downloads.
- Angler one device; Pathfinder one device/five profiles; Founder two devices.
- Verify ZIP SHA-256 against manifest, archive contents, Windows 10/11 install, activation, download authorization, and actual email delivery to a test sink.
- Confirm live R2 object key binding and Worker RELEASE_STATUS semantics agree with the code.
- Preserve old lifetime customers and checkout history.

## Go-live requirements

Use Mollie TEST mode and test email sink first. Once artifact integrity/install/delivery, first payment/mandate, renewal, cancellation, entitlement and rollback tests all pass, deploy the agreed three plans and checkout. Do not publish a subscription for a non-deliverable product. A production subscription charge is allowed only when all included benefits can be delivered and customer consent wording is explicit.


## 10. SEO acquisition — technical and content plan

### Existing SEO assets verified

- sitemap.xml currently lists about 38 English/French URLs: home, features, fishing, demo, installation, compatibility, roadmap, modules, compare, FAQ, buy, documentation/changelog/known issues/license, and bilingual legal pages.
- robots.txt allows public pages while disallowing /api/, /worker/, /backups/, /migrations/ and /tests/.
- Homepage title currently targets WoW Classic fishing bot but the meta description and social snippets still advertise a €20 lifetime license.
- buy.html and the site header also advertise €20 lifetime. This will conflict with the proposed monthly tier ladder unless updated consistently across all EN/FR pages and JSON-LD/sitemaps.
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
1. Main product / purchase page: one clear promise, real product screenshot, exact supported client, plan comparison and CTA.
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
- If the artifact is verified: proceed to recurring checkout and deliver the install bundle after confirmed payment.
- Ask for email and language only unless additional fields are necessary. Separate service updates from optional marketing consent and never pre-check.
- Store consent version/time/source; support unsubscribe and deletion.
- Do not email users from failed/pending orders unless they opted in to marketing or a legally valid transactional follow-up applies.

Measure:
- organic_landing_view;
- feature_view / demo_start / demo_complete;
- lead_form_view / lead_submit / email_verified;
- tier_view / tier_select / recurring_consent;
- first_payment_started / first_payment_paid / subscription_created;
- download_started / download_completed / activation_success;
- renewal_paid / renewal_failed / cancellation / access_expired.

Never record paid conversion from browser redirect alone. Carry UTM parameters and the original landing page through checkout and webhook.

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

Organic query → exact answer page → real product proof → demo → tier comparison → email / plan selection → disclosed recurring consent → Mollie first payment → confirmed subscription → verified download → activation → first successful use → renewal.

Offer positioning:
- ANGLER €4.99/month
- PATHFINDER €7.99/month (recommend)
- FOUNDER €9.99/month

Monthly auto-renewal, cancel online, paid-through access retained. Do not collect recurring charges for a product that cannot be delivered. If package delivery is not ready, use a waitlist or transparent pre-order with refund terms and a substantiated delivery timeline; do not label that as instant access.

## 14. Launch marketing loop

- Publish one genuinely helpful topical page or tutorial at a time, tied to a verified capability.
- Make short video demos from actual gameplay, each linking to the corresponding guide/plan page.
- Reuse real support questions as FAQ/installation content.
- Reach relevant WoW Classic communities and creators without unsolicited bulk promotion or spam.
- Request honest feedback from actual users after activation; never manufacture reviews.
- Build an organic referral mechanism only if it is measurable and does not reward fake signups.
- Review organic query → demo → paid subscription weekly and update content based on GSC data, not guessed demand.


## 15. Codex review resolutions — 2026-11-04

### 15.1 Recoverable webhook idempotency after partial failure

A unique `webhook_events` key is necessary but is not sufficient if it permanently marks a payment as handled before fulfilment has committed. Process each provider payment using a durable state machine:

- Fetch the canonical Mollie payment server-to-server; never trust the browser return or webhook payload as the payment status.
- Track `processing`, `processed` and `retryable_failed` (plus attempt count, timestamps and a recoverable lease) against a unique provider event/payment key.
- Commit the order transition, entitlement/licence changes and a unique durable delivery-outbox item together in one database transaction/batch wherever possible. External email delivery must happen from the committed outbox, not before it.
- A duplicate already marked `processed` may return HTTP 200. A retryable failure or stale `processing` lease must be reclaimed and processed; do not return 200 merely because a marker row exists. Return a retryable non-2xx response when durable processing cannot complete, so Mollie can retry.
- Make outbox delivery independently idempotent. Record provider result, attempt count and failure reason; do not let an email timeout repeat licence creation or paid-through extension.

Failure-injection tests are mandatory at each boundary: after event reservation, after order update, after licence write, after outbox commit, and during email-provider timeout. A replay must eventually complete the paid order exactly once, with no duplicate licence, entitlement extension or delivery. Mollie's current webhook documentation says non-2xx/timeouts are retried up to 10 attempts over 26 hours: https://docs.mollie.com/reference/webhooks

### 15.2 Supported Mollie mandate states

Do not require a mandate to be `valid` only. Mollie's current recurring-payments guide explicitly permits both `pending` and `valid` mandate statuses when creating a subscription; when neither exists, initiate the required first payment: https://docs.mollie.com/docs/recurring-payments

After the first payment is confirmed paid, fetch the customer's mandates from Mollie and permit the documented `pending` or `valid` states. Keep the subscription creation idempotent. Add test-mode coverage for both mandate states and for the no-eligible-mandate path. Do not grant an entitlement from a pending first payment.

### 15.3 Reversed renewals, refunds and chargebacks

Maintain a payment-level entitlement ledger so a later reversal can remove only the period supported by that payment, rather than blindly revoking unrelated older paid access.

- `refund.pending` / `refund.processing`: record the refund in progress; do not treat it as a completed reversal.
- `refund.refunded`: mark the associated payment period reversed and recompute `paid_through` from successful, non-reversed payments.
- `chargeback.received`: mark the payment disputed/reversed for entitlement purposes and suspend access only beyond the latest unaffected paid-through boundary. Preserve older, independently paid periods.
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
- In the PR branch, Worker checkout gates now default to `pending` and permit checkout only for exact `RELEASE_STATUS=confirmed`. Tests verify missing, `pending` and `open` fail before a Mollie call or order write. The production secret value was not read, and no Worker was deployed.
- Fulfillment sends through `sendDeliveryEmail2` → `sendEmail2` → `POST https://api.resend.com/emails`; a successful 2xx returns Resend's message ID in memory. The current database records failed sends for retry, but does not persist successful provider IDs or later delivered/bounced events. The older `/api/resend` handler still reaches a log-only helper and does not call Resend. Cloudflare's read-only Worker `script-settings` response returned `observability: null`, so this session could not retrieve historical provider logs. A zero `deliveries` count is not evidence that no emails were sent. No real email was sent by these checks. The PR also removes recipient emails, license keys and download tokens from Worker log statements and tests this guard.

Local validation for the PR branch: `npm ci` completed with 0 reported vulnerabilities; `npm test` passed; `npm run validate` passed; `npx playwright test --reporter=line` passed 154/154; `git diff --check` passed. These local results are not a substitute for CI on the pushed PR head.
