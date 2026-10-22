# FACTORY V3 — BOT-WOW Continuous Improvement System

## Last verified delivery

- **Version:** V13.1 (hero editorial bold, variant C — EN + FR)
- **Commit:** (pending)
- **Date:** 2026-10-22
- **Production URLs:**
  - Cloudflare Pages: https://bot-wow.com/ (verified: V13 hero serving)
  - GitHub Pages: https://aveca.github.io/bot-wow/ (verified: V13 hero serving)
- **Tests:** `npm run validate` PASS, `npm test` PASS (10 suites)
- **Gzip budget:** code assets ≈ 67 Ko (under 210 Ko limit)
- **Known issues:** None critical. Mascot SVG unused in production hero (variant C). Variant A/B CSS files still published.

## Functional contract

### Site purpose
BOT-WOW is a companion site for the Casinobabe fishing bot for WoW Classic (1.13 + private servers). It sells a lifetime licence (€20), provides a browser-based demo (simulated map), and documents the product honestly.

### Pages
- `index.html` — Landing page: hero, product demo cycle, journey selector, telemetry, steps, module ledger, comparison, pricing, docs, final CTA
- `demo.html` — Browser demo (simulated map, route planner)
- `compare.html` — Comparison vs. all-in-one bots
- `modules.html` — Module ledger (honest status: shipped/in-dev/planned)
- `features.html`, `fishing.html`, `getting-started.html`, `compatibility.html`, `roadmap.html`, `faq.html` — Supporting pages
- `success.html`, `cancel.html` — Payment result pages
- `fr/` — French translations of all above
- `docs/` — Install guide, changelog, known issues, licence recovery
- `legal/` — Terms, privacy, refund policy

### Critical paths
1. Hero CTA → Demo (browser demo)
2. Hero CTA → Offer (pricing section)
3. Pricing form → Mollie checkout → Webhook → Licence delivery
4. Module ledger → Honest status display
5. Browser demo → Route planner (simulated map)

### Telemetry
- First-party only (Cloudflare Worker + D1)
- Event schema: versioned, closed list
- Never counts clicks as conversions (intent only)
- Conversion recorded server-side via Mollie webhook

## Design system

### CSS architecture
- `assets/style.css` — Core styles, layout, typography, components
- `assets/site.css` — Site-specific overrides
- `assets/variant-c.css` — Hero variant C (Editorial Bold) — ACTIVE
- `assets/premium.css` — Premium card styles
- `assets/compare.css`, `assets/components.css`, `assets/hero.css`, `assets/motion.css`, `assets/theme.css` — Section styles
- `assets/mascot/idle.svg` — Mascot SVG (variant A, not currently used in production hero)

### Design tokens
Defined in `assets/style.css` and `assets/site.css`:
- `--bg`, `--txt`, `--mut`, `--mut2` — Colors
- `--gold` (#c9a227), `--cyan` (#5fb4d8), `--green` (#7bd88f) — Accent colors
- `--mono` — JetBrains Mono font
- `--sora` / system font — Sora font

### Hero (variant C) structure
```html
<section class="hero variant-c" id="hero">
  <div class="hero__wrapper">
    <span class="badge">...</span>
    <h1 class="hero__title">
      <span class="word word--1">The WoW</span>
      <span class="word word--2">Classic</span>
      <span class="word word--3">fishing bot</span>
    </h1>
    <p class="hero__lead">...</p>
    <div class="hero__cta">...</div>
    <div class="hero__price">
      <div class="hero__price-value">€20.00</div>
      <div class="hero__price-label">one-time, lifetime licence</div>
    </div>
    <div class="hero__guarantee">...</div>
    <div class="hero__divider"></div>
    <div class="hero__proof">...</div>
  </div>
  <svg class="sonar-bg" ...></svg>
</section>
```

### Animation rules
- Composite-only properties (transform, opacity)
- No `transition: all`
- Respect `prefers-reduced-motion`
- No gratuitous motion
- No redundant dependencies

## Components

### Reusable components
- `.btn` — Button (gold, ghost variants)
- `.badge` — Status badge with dot
- `.benefit` — Benefit card with icon
- `.stage` — Interactive demo cycle
- `.telemetry` — Telemetry metrics display
- `.price-card` — Pricing card
- `.journey-tabs` / `.journey-panel` — Journey selector
- `.film` — Product film (video + HUD) — used in V12.2, removed in V13 hero

## Performance constraints

- Gzip budget: ≤ 210 Ko for code assets (CSS, JS, JSON, SVG)
- Current: ≈ 67 Ko gzip (code assets only; media files excluded)
- No horizontal overflow on any viewport
- First-party only, no paid dependencies
- No third-party ad IDs, no secrets in frontend

## Security constraints

- `/worker/*`, `package.json`, `package-lock.json` → 404 via `_redirects`
- No secrets in frontend
- Server-side field/size validation
- Spam/abuse protection (rate limiting)
- Graceful degradation (no unbounded in-memory storage)

## Accessibility constraints

- Exactly one `<h1>` per page
- Content visible with `prefers-reduced-motion`
- Images have alt text
- ARIA labels on interactive elements
- Keyboard navigation support

## SEO constraints

- Canonical URLs
- hreflang (en/fr)
- Meta descriptions
- Open Graph tags
- Sitemap.xml

## Test commands

```bash
npm run validate                    # Site validation (files, refs, secrets, syntax)
npm test                           # All test suites (parity, distribution, payment, security, artifact, links, conversion, telemetry, migrations)
node scripts/build-site.mjs _site  # Build static site
node scripts/serve.mjs 8099 _site  # Serve locally
node scripts/audit-viewports.mjs <url> <label>  # Chrome CDP viewport audit
```

## Quality criteria

- `npm run validate` must pass
- `npm test` must pass
- No horizontal overflow on any viewport
- No console errors
- CTA in fold on mobile (≤ 360px width)
- Exactly one h1 per page
- Content visible with prefers-reduced-motion
- No secrets in published artifacts
- Gzip budget ≤ 210 Ko (code assets)
- Both deployments (Cloudflare Pages + GitHub Pages) verified

## Known issues

1. **Mascot SVG unused in production** — `assets/mascot/idle.svg` created but not used in production hero (variant C doesn't use mascot). Could be integrated as decorative element.
2. **Unused variant CSS files in production** — `variant-a.css`, `variant-b.css` published but only `variant-c.css` is actively used. Could be removed to reduce asset count.
3. **README.md outdated** — Describes old MVP product (Bot-Wow lobby game), not the current Casinobabe fishing bot.

## Completed improvements (Factory V3)

1. **French hero updated to variant C** (2026-10-22) — `fr/index.html` hero replaced with variant C structure, translated to French. Consistent with EN version. All tests pass.

## Improvement backlog (prioritized)

1. **Update README.md** (MEDIUM) — Rewrite to reflect current product (Casinobabe fishing bot).
2. **Clean unused variant CSS** (LOW) — Remove variant-a.css and variant-b.css from production (only variant-c is used). Update versionne-assets.mjs ASSETS list.
3. **Integrate mascot into variant C** (LOW) — Add mascot SVG as decorative element in the hero or elsewhere.
4. **Add "what is included" link to hero price** (LOW) — Variant C hero price lacks the "what is included" link that EN original had.
5. **Audit FR pages for remaining inconsistencies** (MEDIUM) — Check all fr/ pages for V12.2 remnants that should be updated to V13.

## Persistent state mechanism

- This file (`FACTORY.md`) serves as the persistent state across sessions.
- Git history serves as the change log.
- `docs/deployment.md` documents deployment procedures.
- `docs/known-issues.html` documents known issues for users.
- `docs/changelog.html` documents release history.

## Next priority task

**Update French hero to variant C** — Translate the V13 hero (variant C) to French, matching the EN structure. This includes:
- Translating all text
- Using `../assets/` paths (FR pages are in `fr/` subdirectory)
- Updating the hero section from old V12.2 structure to variant C
- Running `npm run validate`, `npm test`
- Auditing in Chrome CDP
- Committing, pushing, deploying, verifying both targets
