# Verrous

Un scope `active` dont `expires` est dans le futur est pris. Ne pas le reprendre.

| id | scope | agent | branch | status | expires | result |
|---|---|---|---|---|---|---|
| 20261106-commercial-truth | agent-state,delivery-sandbox,api-route-map | cursor-cloud bc-aed68a08 | cursor/commercial-truth-agent-state-0086 | done | 2026-11-08T00:00:00Z | Sandbox PASS. Achat public laissé fermé. https://github.com/aveca/bot-wow/pull/129 |
| 20261106-api-head | api-head-readonly | cursor-cloud bc-aed68a08 | cursor/commercial-truth-agent-state-0086 | done | 2026-11-08T00:00:00Z | HEAD aligne sur GET pour /, /health et /api/config. Sandbox PASS. Production encore 404 tant que le Worker n'est pas redéployé. https://github.com/aveca/bot-wow/pull/129 |
