#!/usr/bin/env node
/**
 * agent-state-locks.test.mjs — tests de regression du gate des verrous.
 *
 * Issue #141 : le gate `scripts/check-agent-state.mjs` rejetait toute PR qui
 * herite de `agents/locks.md` de main, parce qu'il comparait les SCOPES seul.
 * Deux lignes de verrou identiques (meme id, meme agent, meme branche)
 * heritees du meme base commit ne sont PAS deux verrous en conflit.
 *
 * Ces tests sont DETERMINISTES : aucun appel reseau, aucun appel `gh`,
 * aucune ecriture. L'instant de reference est fige.
 *
 * Couvre :
 *   1. identite de verrou (id + agent + branch)
 *   2. activite d'un verrou (active + non expire)
 *   3. doublons de scope dans un meme fichier
 *   4. conflits de scope local <-> PR : herite identique, identites distinctes,
 *      expire, done, released, local expire
 *   5. classement des erreurs de lecture distante (404 = absence, autre = erreur)
 *   6. lecture reelle de `agents/locks.md` : herite identique = 0 conflit,
 *      identite differente = conflit reel
 *   7. le gate local (`scripts/check-agent-state.mjs`) termine en exit 0
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  classifyRemoteFetchError,
  findDuplicateScopes,
  findScopeConflicts,
  isLockActive,
  lockIdentity,
  parseLockTable,
  summarizeRemoteFetchError,
} from "../scripts/agent-lock-gate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Instantane fige : 2026-11-07T12:00:00Z. */
const NOW = Date.parse("2026-11-07T12:00:00Z");
const FUTURE = "2026-11-10T00:00:00Z";
const PAST = "2026-11-01T00:00:00Z";

let checks = 0;
function check(label, condition, detail = "") {
  checks += 1;
  assert.ok(condition, `${label}${detail ? ` — ${detail}` : ""}`);
}

function row(overrides = {}) {
  return {
    id: "20261107-demo",
    scope: "demo-scope",
    agent: "agent-x",
    branch: "branch-x",
    status: "active",
    expires: FUTURE,
    result: "test",
    scopes: ["demo-scope"],
    ...overrides,
  };
}

// ── 1. Identite de verrou ───────────────────────────────────────────────────

console.log("=== 1. identite de verrou ===");
{
  const a = row();
  const b = row();
  check("identite stable", lockIdentity(a) === lockIdentity(b));
  check(
    "identite = id + agent + branch",
    lockIdentity(a) === "20261107-demo|agent-x|branch-x",
    lockIdentity(a),
  );
  check("agent different => identite differente", lockIdentity(a) !== lockIdentity(row({ agent: "agent-y" })));
  check("branche differente => identite differente", lockIdentity(a) !== lockIdentity(row({ branch: "branch-y" })));
  check("id different => identite differente", lockIdentity(a) !== lockIdentity(row({ id: "20261108-demo" })));
}

// ── 2. Activite d'un verrou ─────────────────────────────────────────────────

console.log("=== 2. activite d'un verrou ===");
{
  check("active non expire = actif", isLockActive(row(), NOW) === true);
  check("active expire = inactif", isLockActive(row({ expires: PAST }), NOW) === false);
  check("done = inactif", isLockActive(row({ status: "done" }), NOW) === false);
  check("released = inactif", isLockActive(row({ status: "released" }), NOW) === false);
  check("expiration illisible = inactif", isLockActive(row({ expires: "bientôt" }), NOW) === false);
}

// ── 3. Doublons de scope dans un meme fichier ───────────────────────────────

console.log("=== 3. doublons de scope dans un meme fichier ===");
{
  const dups = findDuplicateScopes(
    [row({ id: "a-one" }), row({ id: "b-two" })],
    NOW,
  );
  check("deux verrous actifs sur le meme scope = doublon", dups.length === 1, JSON.stringify(dups));

  const withExpired = findDuplicateScopes(
    [row({ id: "a-one" }), row({ id: "b-two", expires: PAST })],
    NOW,
  );
  check("un verrou expire ne fait pas de doublon", withExpired.length === 0, JSON.stringify(withExpired));

  const withDone = findDuplicateScopes(
    [row({ id: "a-one" }), row({ id: "b-two", status: "done" })],
    NOW,
  );
  check("un verrou done ne fait pas de doublon", withDone.length === 0, JSON.stringify(withDone));
}

// ── 4. Conflits local <-> PR ────────────────────────────────────────────────

console.log("=== 4. conflits local <-> PR ===");
{
  const local = [row()];

  const inherited = findScopeConflicts({
    localRows: local,
    remoteRows: [row()],
    prNumber: 139,
    now: NOW,
  });
  check("ligne identique heritee = PAS de conflit", inherited.length === 0, JSON.stringify(inherited));

  const otherId = findScopeConflicts({
    localRows: local,
    remoteRows: [row({ id: "20261107-autre" })],
    prNumber: 140,
    now: NOW,
  });
  check("meme scope, id different = conflit", otherId.length === 1, JSON.stringify(otherId));

  const otherAgent = findScopeConflicts({
    localRows: local,
    remoteRows: [row({ agent: "agent-y" })],
    prNumber: 140,
    now: NOW,
  });
  check("meme scope, agent different = conflit", otherAgent.length === 1, JSON.stringify(otherAgent));

  const otherBranch = findScopeConflicts({
    localRows: local,
    remoteRows: [row({ branch: "branch-y" })],
    prNumber: 140,
    now: NOW,
  });
  check("meme scope, branche differente = conflit", otherBranch.length === 1, JSON.stringify(otherBranch));

  const expiredRemote = findScopeConflicts({
    localRows: local,
    remoteRows: [row({ id: "20261107-autre", expires: PAST })],
    prNumber: 140,
    now: NOW,
  });
  check("verrou distant expire = PAS de conflit", expiredRemote.length === 0, JSON.stringify(expiredRemote));

  const doneRemote = findScopeConflicts({
    localRows: local,
    remoteRows: [row({ id: "20261107-autre", status: "done" })],
    prNumber: 140,
    now: NOW,
  });
  check("verrou distant done = PAS de conflit", doneRemote.length === 0, JSON.stringify(doneRemote));

  const releasedRemote = findScopeConflicts({
    localRows: local,
    remoteRows: [row({ id: "20261107-autre", status: "released" })],
    prNumber: 140,
    now: NOW,
  });
  check("verrou distant released = PAS de conflit", releasedRemote.length === 0, JSON.stringify(releasedRemote));

  const expiredLocal = findScopeConflicts({
    localRows: [row({ expires: PAST })],
    remoteRows: [row({ id: "20261107-autre" })],
    prNumber: 140,
    now: NOW,
  });
  check("verrou local expire ne bloque pas", expiredLocal.length === 0, JSON.stringify(expiredLocal));

  const otherScope = findScopeConflicts({
    localRows: local,
    remoteRows: [row({ id: "20261107-autre", scope: "autre-scope", scopes: ["autre-scope"] })],
    prNumber: 140,
    now: NOW,
  });
  check("scope different = PAS de conflit", otherScope.length === 0, JSON.stringify(otherScope));

  check(
    "message de conflit nomme le scope et les deux ids",
    otherId[0]?.message.includes("demo-scope")
    && otherId[0]?.message.includes("20261107-demo")
    && otherId[0]?.message.includes("20261107-autre")
    && otherId[0]?.message.includes("PR #140"),
    otherId[0]?.message,
  );
}

// ── 5. Erreurs de lecture distante : 404 = absence, autre = erreur ──────────

console.log("=== 5. erreurs de lecture distante ===");
{
  const notFound = Object.assign(new Error("Command failed"), {
    stderr: "gh: Not Found (HTTP 404)\n",
  });
  check("404 = absence (pas une erreur)", classifyRemoteFetchError(notFound) === "absent");
  check(
    "404 via message = absence",
    classifyRemoteFetchError(new Error("HTTP 404: Not Found")) === "absent",
  );
  const unauthorized = Object.assign(new Error("Command failed"), {
    stderr: "gh: Bad credentials (HTTP 401)\n",
  });
  check("401 = erreur visible", classifyRemoteFetchError(unauthorized) === "error");
  check(
    "erreur reseau = erreur visible",
    classifyRemoteFetchError(new Error("spawnSync gh ETIMEDOUT")) === "error",
  );
  check("erreur vide = erreur visible", classifyRemoteFetchError(undefined) === "error");
  check(
    "resume d'erreur sans secret ni saut de ligne",
    summarizeRemoteFetchError(notFound) === "gh: Not Found (HTTP 404)",
    summarizeRemoteFetchError(notFound),
  );
}

// ── 6. Fichier de verrous reel du depot ─────────────────────────────────────

console.log("=== 6. agents/locks.md reel ===");
{
  const markdown = readFileSync(path.join(ROOT, "agents", "locks.md"), "utf8");
  const { rows, problems } = parseLockTable(markdown, "agents/locks.md", Date.now());
  check("table de verrous reelle sans probleme de format", problems.length === 0, problems.join(" | "));
  check("verrous reels lus", rows.length >= 5, String(rows.length));

  // Cas exact de l'issue #141 : une PR qui herite du fichier de main.
  const inherited = findScopeConflicts({
    localRows: rows,
    remoteRows: rows,
    prNumber: 139,
    now: Date.now(),
  });
  check("heritage identique du fichier reel = 0 conflit", inherited.length === 0, JSON.stringify(inherited));

  // Une PR qui prendrait le meme scope avec une AUTRE identite reste un conflit.
  const firstActive = rows.find((r) => r.status === "active" && r.scopes.length > 0);
  assert.ok(firstActive, "le fichier reel doit contenir au moins un verrou actif");
  const mutated = rows.map((r) =>
    r.id === firstActive.id ? { ...r, branch: `${r.branch}-autre` } : r,
  );
  const realConflict = findScopeConflicts({
    localRows: rows,
    remoteRows: mutated,
    prNumber: 140,
    now: Date.now(),
  });
  check("identite reelle differente = conflit reel", realConflict.length >= 1, JSON.stringify(realConflict));

  // Preuve du faux positif d'origine : l'ancien algoritme (comparaison des
  // scopes seuls) signale des conflits sur le fichier herite identique.
  const legacyConflicts = rows
    .filter((r) => r.status === "active")
    .flatMap((r) => r.scopes.filter((scope) => rows.some((o) => o.status === "active" && o.scopes.includes(scope))))
    .length;
  check("l'ancien algorithme (scope seul) aurait signale des conflits", legacyConflicts >= 5, String(legacyConflicts));
  check("le nouvel algorithme n'en signale aucun sur le meme fichier", inherited.length === 0);
}

// ── 7. Gate local : execution reelle ────────────────────────────────────────

console.log("=== 7. gate local ===");
{
  const out = execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-agent-state.mjs")], {
    encoding: "utf8",
    cwd: ROOT,
  });
  check("gate local : AGENT STATE : OK", out.includes("AGENT STATE : OK"), out.trim());
}

console.log(`AGENT STATE LOCKS: OK (${checks} contrôles)`);
