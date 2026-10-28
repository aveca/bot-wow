# Agent instructions — BOT-WOW

Before doing any work in this repository, read `reports/operations/BOT-WOW-CURRENT-STATE.md`.

## Session-resumption rules

1. Treat the current-state document as a persistent, dated operational snapshot. Check its linked GitHub PRs and refresh only facts that may have changed or are required for the current task.
2. Do not ask the user to repeat context or redo completed P0–P0.7 diagnostics when reports and proof links already exist.
3. Do not reconfigure Cloudflare secrets merely because the secret values are masked. The presence of a `secret_text` binding name and the functional validity of its value are different questions.
4. Never create `ADMIN_PASSWORD` without evidence that the current code requires it; the observed admin binding is `ADMIN_PASSWORD_HASH`.
5. Do not run `wrangler secret put`, modify secrets/bindings, or deploy Worker/Pages without evidence of a specific defect and explicit user authorization.
6. Do not claim that a change is in production because it exists in a branch or PR. Verify deployed code directly through Cloudflare after an authorized deployment.
7. For download delivery changes, inspect the existing [PR #19](https://github.com/aveca/bot-wow/pull/19) before making edits. Avoid duplicate competing fixes.
8. Keep R2 release-object mutations, production changes, and real payment/email actions prohibited unless the user explicitly authorizes a specific action.
9. At task completion, update the current-state document with dated evidence, exact commit IDs, report/PR links, remaining blockers, and one next action. Publish the update to GitHub, not only to local disk.
10. If the current-state file is missing from the starting branch, look for its open documentation PR or branch before asking the user to reconstruct the context.

## Evidence standard

Label facts as one of: directly verified (with link/tool result), reported in an earlier mission (with report link), or not yet verified. Never treat hidden secret values as proof of absent secrets; never treat a successful CI run as proof that an artifact or production deployment is correct.
