/**
 * d1-sqlite-adapter.mjs — adaptateur D1 (API Cloudflare Workers) au-dessus de
 * node:sqlite, pour tester le VRAI Worker contre un VRAI moteur SQL.
 *
 * Pourquoi : payment-flow.test.mjs simule D1 avec des tableaux JS — il valide
 * la logique du Worker mais pas les contraintes du schema (types, cles
 * primaires, cles etrangeres, index uniques). Or l'incompatibilite centrale
 * porte sur le schema : en production `orders.id` est INTEGER PRIMARY KEY
 * alors que le Worker y insere des identifiants texte (`ord_tr_xxx`). Seul un
 * vrai moteur SQL revele ce conflit.
 *
 * Fidelite par rapport a D1 :
 *  1. prepare(sql) -> .bind(...) -> .run()/.first()/.all() (API identique).
 *  2. run() retourne { meta: { last_row_id, changes } } (D1 nomme la cle
 *     last_row_id ; node:sqlite la nomme lastInsertRowid).
 *  3. Un ecart de nombre de parametres LEVE une erreur (comportement D1 que
 *     node:sqlite n'a pas : sans ce garde-fou, un oubli de parametre
 *     passerait inapercu en test et casserait en production).
 *  4. Parametres anonymes `?` et numerotes `?1` acceptes (le Worker use les
 *     deux formes).
 *  5. batch() execute dans l'ordre et s'arrete a la premiere erreur.
 *  6. PRAGMA foreign_keys peut etre active explicitement (D1 l'applique,
 *     contrairement au defaut SQLite) pour verifier les cles etrangeres.
 */
import { DatabaseSync } from 'node:sqlite';

/**
 * Compte les placeholders d'une requete SQL, en ignorant ceux places dans des
 * litteraux chaine (selon la regle SQLite : '' est une apostrophe echappee).
 * Gere la forme anonyme `?` et la forme numerotee `?1`..`?9`.
 * Retourne le nombre d'arguments attendus.
 */
export function countBoundParameters(sql) {
  let expected = 0;
  let maxNumbered = 0;
  let i = 0;
  let inString = false;
  while (i < sql.length) {
    const ch = sql[i];
    if (inString) {
      if (ch === "'") {
        if (sql[i + 1] === "'") { i += 2; continue; }
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === "'") { inString = true; i += 1; continue; }
    if (ch === '?') {
      const next = sql[i + 1];
      if (next >= '1' && next <= '9') {
        const n = Number(next);
        if (n > maxNumbered) maxNumbered = n;
        i += 2;
        continue;
      }
      expected += 1;
      i += 1;
      continue;
    }
    i += 1;
  }
  return Math.max(expected, maxNumbered);
}

/**
 * Cree un binding compatible D1 autour d'une instance node:sqlite.
 *
 * @param {DatabaseSync} db base deja ouverte
 * @param {{ foreignKeys?: boolean }} [options]
 * @returns {{ prepare, batch }} binding au sens Workers
 */
export function createD1Binding(db, options = {}) {
  if (options.foreignKeys) {
    db.exec('PRAGMA foreign_keys = ON');
  }

  function prepare(sql) {
    const expected = countBoundParameters(sql);
    const stmt = db.prepare(sql);

    function checkParams(args) {
      if (args.length !== expected) {
        throw new Error(
          `D1 parameter mismatch: expected ${expected}, got ${args.length} — ${sql.replace(/\s+/g, ' ').trim().slice(0, 120)}`
        );
      }
    }

    return {
      bind(...args) {
        checkParams(args);
        return {
          run: async () => {
            const info = stmt.run(...args);
            return { meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) } };
          },
          first: async () => {
            const row = stmt.get(...args);
            return row === undefined ? null : row;
          },
          all: async () => {
            return { results: stmt.all(...args) };
          },
        };
      },
      // Sans bind() : D1 exige des parametres. On rend l'erreur explicite.
      run: async () => { checkParams([]); const info = stmt.run(); return { meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) } }; },
      first: async () => { checkParams([]); const row = stmt.get(); return row === undefined ? null : row; },
      all: async () => { checkParams([]); return { results: stmt.all() }; },
    };
  }

  return {
    prepare,
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) { out.push(await s.run()); }
        db.exec('COMMIT');
        return out;
      } catch (e) {
        try { db.exec('ROLLBACK'); } catch { /* deja prematurement termine */ }
        throw e;
      }
    },
  };
}

/**
 * Ouvre une base isolée (mémoire, ou fichier temporaire) et retourne
 * { db, d1, close } — pratique pour les tests unitaires.
 */
export function createIsolatedDatabase(options = {}) {
  const db = options.file
    ? new DatabaseSync(options.file)
    : new DatabaseSync(':memory:');
  return {
    db,
    d1: createD1Binding(db, options),
    close: () => { try { db.close(); } catch { /* deja fermee */ } },
  };
}
