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
