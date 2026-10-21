#!/usr/bin/env node
/**
 * migrations.test.mjs — validation des migrations D1.
 *
 * On applique les migrations sur une base NEUVE (comme un environnement de
 * preprod) puis on verifie :
 *  - que le schema complet est cree (toutes les tables attendues) ;
 *  - que la migration 0003 REPARE les donnees legacy (commande sans id,
 *    licence pointant sur l'ancien rowid) ;
 *  - que la jointure licences <-> orders aboutit apres reparation ;
 *  - que l'unicite des evenements de webhook est effective (garantie
 *    d'idempotence).
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const MIG = join(REPO, 'migrations');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('=== MIGRATIONS D1 (base neuve + reparation 0003) ===');

const files = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
check('des migrations sont presentes', files.length >= 3, `(${files.length})`);

const db = new DatabaseSync(':memory:');
for (const f of files) {
  try {
    db.exec(readFileSync(join(MIG, f), 'utf8'));
    console.log(`  applique : ${f}`);
  } catch (e) {
    check(`migration ${f}`, false, String(e.message).slice(0, 160));
  }
}

const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name));
for (const t of ['botwow_emails', 'orders', 'licenses', 'activations', 'downloads',
  'webhook_events', 'mollie_customers', 'deliveries']) {
  check(`table ${t}`, tables.has(t));
}

// --- donnees legacy : commande sans id + licence sur l'ancien rowid ---------
// SQLite n'applique les cles etrangeres que si on le demande : les bases
// creees a la main ne les appliquaient pas (c'est exactement l'etat
// historique que la migration 0003 doit repparer).
db.exec('PRAGMA foreign_keys = OFF');
const now = Date.now();
db.prepare(`INSERT INTO orders (provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at)
            VALUES ('mollie','tr_legacy','a@b.co',2000,'EUR','paid','{}',?,?)`).run(now, now);
const rowid = db.prepare('SELECT rowid FROM orders').get().rowid;
db.prepare(`INSERT INTO licenses (key, order_id, email, lang, status, max_activations, created_at, updated_at)
            VALUES ('BOTW-X',?,'a@b.co','fr','active',2,?,?)`).run(rowid, now, now);

const before = db.prepare('SELECT id FROM orders').get().id;
check('la commande legacy n\'a pas d\'identifiant (defaut historique)', before === null, `(${before})`);

// application de la migration de reparation
db.exec(readFileSync(join(MIG, '0003_botwow_payment_integrity.sql'), 'utf8'));

const after = db.prepare('SELECT id FROM orders').get().id;
check('la commande legacy recoit un identifiant TEXT', typeof after === 'string' && after.startsWith('ord_'), `(${after})`);
const joined = db.prepare(`SELECT l.key AS key, o.id AS order_id FROM licenses l JOIN orders o ON o.id = l.order_id`).get();
check('la jointure licences <-> orders aboutit apres reparation', !!joined, JSON.stringify(joined || {}));

// --- unicite des evenements de webhook (idempotence) -----------------------
db.prepare('INSERT INTO webhook_events (id, provider, processed_at) VALUES (?,?,?)').run('e1', 'mollie', now);
let uniqueOk = false;
try {
  db.prepare('INSERT INTO webhook_events (id, provider, processed_at) VALUES (?,?,?)').run('e1', 'mollie', now);
} catch (e) {
  uniqueOk = /UNIQUE|constraint/i.test(String(e.message));
}
check('un evenement de webhook duplique est refuse (idempotence)', uniqueOk);

db.close();

console.log('');
console.log(failures === 0 ? 'MIGRATIONS : OK' : `MIGRATIONS : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
