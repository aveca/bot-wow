# BOT-WOW — REVENUE + DESIGN SPEC (2026-11-04)

Branch: revenue/early-access-monthly-499-20261104
Base: main @ 2edd74be83f272672b303ccdb316d52137109076

## Commercial offer

New-customer offer ladder, recurring monthly, no free trial:

| Plan | Price | Audience |
|---|---:|---|
| Angler | €4.99/month | The player who wants the core fishing assistant |
| Pathfinder | €7.99/month | The player who wants memory, route planning and more profiles |
| Founder | €9.99/month | The committed early adopter with extra seats and priority access |

All monthly subscriptions auto-renew and can be canceled online. Make first payment timing, renewal price, cancellation path and Early Access status clear before payment. Preserve existing paid lifetime licenses and old orders; do not migrate them or remove access.

The three tiers only become purchasable when the actual Early Access service being sold is available. If the build cannot yet be delivered, use a clearly labeled reservation/waitlist or pre-order with a real delivery commitment and refund terms; do not silently charge a recurring membership for a download that does not exist.

## Product positioning

Sell what BOT-WOW actually is today: a WoW Classic fishing assistant, not a generic combat/XP/battleground bot.

Hero:
- Eyebrow: "WOW CLASSIC · FISHING ASSISTANT"
- H1: "Le compagnon de pêche qui apprend tes spots."
- Subheadline: "Détecte les touches, garde la mémoire de tes spots et aide à organiser tes tournées — en accès anticipé."
- Primary CTA: "Choisir mon accès"
- Secondary CTA: "Voir la démo"
- Trust line: "À partir de 4,99 €/mois · Résiliable à tout moment"

Use a real gameplay capture, not a synthetic fake screenshot. The browser demo is simulated; label it honestly and distinguish it from in-game bot operation.

## Three pricing cards

### Angler — €4.99/month
- Core fishing loop: cast, bite/float detection and click only when verified in the distributed build.
- One Windows PC activation.
- Standard stable updates during an active subscription.
- Email support.

### Pathfinder — €7.99/month (recommended)
- Everything in Angler.
- Persistent fishing-spot memory and JSON import/export, once verified.
- Route planning between saved spots, once verified.
- Up to five saved fishing profiles/characters (enforce server-side).
- Standard support and updates.

### Founder — €9.99/month
- Everything in Pathfinder.
- Two device activations (enforce server-side).
- Unlimited profiles (only once implemented).
- Priority support.
- Preview/beta builds clearly marked as beta, with release notes and rollback.
- Early adopter feedback channel; do not promise feature delivery on demand.

No tier promises anti-ban protection, undetectability, Blizzard approval, or safety from penalties. State clearly that automation may violate Blizzard's terms and can lead to account sanctions. Never say "zero ban", "undetected", or "safe".

## Design / sales page rebuild

Keep BOT-WOW's recognizable visual direction: black/charcoal, warm gold CTA, Sora/JetBrains Mono, compact gamer-product feel. Replace warning-heavy / BTC-conflicting legacy copy with a confident, premium and truthful Early Access storefront.

1. Hero: headline, one sentence value proposition, real screenshot/video, primary CTA and starting monthly price.
2. Three-step proof: detect a bite → remember productive spots → organize next round. Only show steps verified in current build; mark unreleased elements "en préparation".
3. Interactive browser demo clearly labeled as simulation; CTA back to the real product plan.
4. "What works now / In validation / Planned" status strip with exact verified capabilities. Never hide material limitations.
5. Pricing cards: Angler, Pathfinder, Founder. Pathfinder recommended. Monthly price and cancellation wording directly under each price.
6. Compatibility section restricted to verified WoW client/version and Windows configurations.
7. Risk / fair-use notice with plain language about game rules and possible account sanctions.
8. FAQ: download timing, install, version support, billing/cancellation, updates, refunds, support.
9. Footer with terms, privacy, refund policy, support and product status.

Pricing CTA examples:
- "Rejoindre Angler · 4,99 €/mois"
- "Choisir Pathfinder · 7,99 €/mois"
- "Accéder à Founder · 9,99 €/mois"

Show a clean, low-friction checkout: email → plan/cadence/price confirmation → hosted Mollie payment. The plan price and billing interval must be selected and validated server-side.

## Important code findings

- buy.html currently sells a €20 lifetime license and says the v1.2.0 package is unconfirmed; it disables checkout.
- The page states spot-to-spot movement is still in validation and combat/XP/quests/BG automation are not shipped.
- Main's worker/index.js currently contains webhook idempotency, but still has download fallback candidates and hardcoded old filename. The P0.99 branch was not visible in GitHub at the last check.
- Earlier direct Cloudflare inspection found the live Worker expects RELEASE_STATUS=confirmed while a later proposed contract says open. Recheck exact main, branch and production Worker before changing any gate.
- Never read or expose secret values.

## Mollie subscription implementation

Inspect Mollie current recurring-payment docs and existing repository integrations. Implement a proper first payment/mandate, then subscription:
1. Customer selects plan; explicit consent spells out recurring monthly cost.
2. Create/find Mollie customer.
3. Create first payment with customerId and sequenceType=first.
4. Verify paid result server-to-server and mandate validity.
5. Create monthly subscription with first renewal after one month, never double-charge signup.
6. Store subscription, customer, plan, payment, current paid-through date, renewal state.
7. Renewal webhook retrieves authoritative payment from Mollie, correlates subscriptionId, extends entitlement once.
8. Failed renewal does not extend entitlement.
9. Cancellation stops future charges but keeps access until paid-through date.
10. Self-service cancellation and billing recovery.
11. Enforce device and profile limits server-side.
12. Never grant based only on the browser redirect or localStorage.

## Conversion / implementation tests

- Correct EUR 4.99/7.99/9.99 amount and monthly interval.
- Tampered tier / amount rejected.
- Failed or pending first payment creates no active subscription.
- Duplicate webhook never creates duplicate subscriptions or entitlement periods.
- Paid renewal extends access once.
- Failed renewal does not extend access.
- Cancellation keeps access through paid period and prevents next charge.
- Angler one device, Pathfinder one device/five profiles, Founder two devices/unlimited profiles.
- Legacy lifetime licences still work.
- Package integrity SHA-256, clean Windows installation, activation and email delivery all tested before promising a download.
- Test mail sink only; no real customer communications.

## Launch gates

Mollie TEST lifecycle and the real download/activation path must pass before activating real recurring charges. Do not turn on checkout for access that cannot be delivered. Live billing, RELEASE_STATUS change, Worker deployment, production secrets and actual customer charging require the owner's explicit authorization.
