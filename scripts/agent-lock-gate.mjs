#!/usr/bin/env node
/**
 * agent-lock-gate.mjs — regles pures du controle des verrous agents.
 *
 * Module SANS effet de bord : aucune lecture reseau, aucune ecriture disque.
 * Il isole les decisions du gate (`scripts/check-agent-state.mjs`) pour qu'elles
 * soient testees de maniere deterministe, sans GitHub et sans `gh`.
 *
 * Regle centrale (issue #141) :
 *   - un verrou ne bloque un scope que s'il est `active` ET non expire ;
 *   - l'IDENTITE d'un verrou est `id + agent + branch` ;
 *   - une ligne de verrou de MEME identite heritee du meme base commit n'est
 *     PAS un conflit : c'est le meme verrou, vu dans deux branches ;
 *   - un scope detenu par une AUTRE identite, active et non expiree, reste un
 *     conflit reel et doit toujours faire echouer le gate.
 */

/**
 * Identite stable d'une ligne de verrou : `id + agent + branch`.
 * La branche est partie de l'identite car deux agents peuvent choisir le
 * meme id de verrou sur des branches differentes.
 */
export function lockIdentity(row) {
  if (!row || typeof row !== "object") return "";
  return [row.id ?? "", row.agent ?? "", row.branch ?? ""].join("|");
}

/**
 * Un verrou ne tient un scope que s'il est `active` et non expire.
 * Une expiration illisible est deja signalee par le parseur de table : on la
 * traite ici comme « ne bloque pas », sans masquer l'erreur par ailleurs.
 */
export function isLockActive(row, now = Date.now()) {
  if (!row || typeof row !== "object") return false;
  if (row.status !== "active") return false;
  const expires = Date.parse(row.expires);
  if (Number.isNaN(expires)) return false;
  return expires > now;
}

/**
 * Index des verrous locaux actifs : `scope -> Map(identite -> ligne)`.
 */
export function buildActiveScopeMap(rows, now = Date.now()) {
  const map = new Map();
  for (const row of rows || []) {
    if (!isLockActive(row, now)) continue;
    for (const scope of row.scopes || []) {
      if (!map.has(scope)) map.set(scope, new Map());
      map.get(scope).set(lockIdentity(row), row);
    }
  }
  return map;
}

/**
 * Doublons de scope DANS UN MEME fichier de verrous.
 * Seuls les verrous `active` non expires comptent (cf. `agents/README.md` :
 * « Un scope `active` non expiré en double fait échouer la vérification »).
 */
export function findDuplicateScopes(rows, now = Date.now()) {
  const seen = new Map();
  const duplicates = [];
  for (const row of rows || []) {
    if (!isLockActive(row, now)) continue;
    for (const scope of row.scopes || []) {
      if (seen.has(scope)) {
        duplicates.push({ scope, first: seen.get(scope), second: row.id });
      } else {
        seen.set(scope, row.id);
      }
    }
  }
  return duplicates;
}

/**
 * Conflits de scope entre les verrous locaux actifs et ceux d'une PR ouverte.
 *
 * Regle : un verrou distant de MEME identite (`id + agent + branch`) est un
 * verrou HERITE du meme base commit — il ne constitue pas un conflit distinct
 * et ne doit pas faire echouer le gate. Tout autre verrou distant actif et
 * non expire sur un scope deja pris reste un conflit reel.
 *
 * @returns {Array<{scope,localId,remoteId,prNumber,message}>}
 */
export function findScopeConflicts({ localRows, remoteRows, prNumber, now = Date.now() }) {
  const local = buildActiveScopeMap(localRows, now);
  const conflicts = [];
  for (const row of remoteRows || []) {
    if (!isLockActive(row, now)) continue;
    const identity = lockIdentity(row);
    for (const scope of row.scopes || []) {
      const holders = local.get(scope);
      if (!holders) continue;
      if (holders.has(identity)) continue; // meme verrou herite : pas un conflit
      for (const holder of holders.values()) {
        conflicts.push({
          scope,
          localId: holder.id,
          remoteId: row.id,
          prNumber,
          message: `scope actif deja pris : ${scope} (${holder.id} et PR #${prNumber} ${row.id})`,
        });
      }
    }
  }
  return conflicts;
}

/**
 * Classe une erreur de lecture distante de `agents/locks.md`.
 *
 * - `absent` : la branche ne contient pas ce fichier (404). C'est une
 *   ABSENCE, pas une erreur et pas une preuve de conflit : la PR est ignoree
 *   pour cette comparaison.
 * - `error` : toute autre erreur (reseau, authentification, API). Elle doit
 *   rester VISIBLE : la distinguer d'un succes silencieux, sinon une panne
 *   d'authentification passerait pour un gate vert.
 */
export function classifyRemoteFetchError(error) {
  const text = `${(error && error.stderr) || ""}\n${(error && error.message) || ""}`;
  if (/HTTP 404\b/.test(text)) return "absent";
  if (/\bNot Found\b/.test(text)) return "absent";
  return "error";
}

/**
 * Message court, sans secret, pour une erreur de lecture distante.
 */
export function summarizeRemoteFetchError(error) {
  const text = `${(error && error.stderr) || ""}\n${(error && error.message) || ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return text[0] || "erreur inconnue";
}

/* ── Lecture de la table `agents/locks.md` ────────────────────────────────── */

/** Colonnes attendues de la table des verrous. */
export const LOCK_TABLE_COLUMNS = ["id", "scope", "agent", "branch", "status", "expires", "result"];

/** Découpe une ligne de tableau markdown en cellules. */
export function splitLockRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Parse la table des verrous d'un fichier markdown.
 * Fonction PURE : elle ne leve rien, elle RETOURNE les problemes detectes
 * (format invalide, doublons, ...) pour que l'appelant decide de les
 * transformer en echec ou en avertissement.
 *
 * @returns {{rows: Array<object>, problems: string[]}}
 */
export function parseLockTable(markdown, label = "verrous", now = Date.now()) {
  const rows = [];
  const problems = [];
  const lines = String(markdown || "")
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"));
  if (lines.length < 2) {
    problems.push(`${label} : table de verrous absente`);
    return { rows, problems };
  }
  const header = splitLockRow(lines[0]);
  if (LOCK_TABLE_COLUMNS.some((name, i) => header[i] !== name)) {
    problems.push(`${label} : en-tete attendu ${LOCK_TABLE_COLUMNS.join(" | ")}`);
    return { rows, problems };
  }
  for (const line of lines.slice(1)) {
    if (/^\|\s*-+/.test(line.trim())) continue;
    const cells = splitLockRow(line);
    if (cells.length < LOCK_TABLE_COLUMNS.length) {
      problems.push(`${label} : ligne incomplete`);
      continue;
    }
    const row = Object.fromEntries(LOCK_TABLE_COLUMNS.map((name, i) => [name, cells[i]]));
    if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(row.id)) problems.push(`${label} : id invalide ${row.id}`);
    if (!["active", "done", "released"].includes(row.status)) {
      problems.push(`${label} : statut invalide ${row.status}`);
    }
    if (Number.isNaN(Date.parse(row.expires))) problems.push(`${label} : expiration illisible ${row.expires}`);
    row.scopes = row.scope.split(",").map((s) => s.trim()).filter(Boolean);
    if (row.scopes.length === 0) problems.push(`${label} : scope vide pour ${row.id}`);
    rows.push(row);
  }
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) problems.push(`${label} : id duplique ${row.id}`);
    seen.add(row.id);
  }
  for (const dup of findDuplicateScopes(rows, now)) {
    problems.push(`${label} : scope actif en double ${dup.scope} (${dup.first} et ${dup.second})`);
  }
  return { rows, problems };
}
