# Bot-Wow — Product Integrity and Validation Roadmap

## Product position
Bot-Wow is a GitHub Pages companion MVP. The website may coordinate a workflow, but cannot claim an in-game action happened unless a trusted addon/client event confirms it.

## P0 — Truthful state transitions
- Preserve: ACTION_REQUIRED → user action in WoW → verified event → resume workflow.
- Keep demo simulation visibly separate from live state.
- Never report trade, invite, payout, emote or other client action successful from a browser request alone.
- Document event provenance, timestamps, session IDs and deduplication.

## P1 — Complete user journey
- Test session creation, invite/launch, player events, rand results, completion and failure recovery.
- Cover duplicate, delayed, missing and out-of-order events.
- Verify responsive UI and Pages deployment from the exact candidate commit.
- Record public smoke-test evidence after deployment.

## P2 — Integration boundary
- Keep the static site deployable without backend secrets.
- Treat any local bridge as a separate, permissioned component with authentication, replay protection and explicit user control.
- Maintain a tested WoW-version compatibility matrix; do not imply universal compatibility.

## P3 — Validate demand before monetization
- Choose one target segment and measure repeat usage.
- Track completed real sessions, abandonment, error rate and support requests.
- Add backend/payment scope only after repeated value is demonstrated.

## Release gates
1. Tests pass on candidate commit.
2. Deployment workflow completes.
3. Public health and critical routes are verified.
4. Demo/live state is clearly distinguished.
5. No unverified in-game success is displayed.

**Status:** proposal only; does not certify current deployment or addon compatibility.
