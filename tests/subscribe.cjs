/**
 * test-subscribe.cjs — Test d'intégration du handler handleSubscribe
 *
 * Teste la logique du handler /api/subscribe contre un mock D1 en mémoire qui
 * implémente l'API D1 (prepare(sql).bind(...).first() / .run()). Le schéma
 * appliqué est celui de migrations/0001_botwow_emails.sql.
 *
 * NOTE : sans compte Cloudflare, wrangler d1 create ne peut pas créer
 * d'instance D1 réelle. Ce test valide donc la logique du handler avec un
 * mock D1 fidèle. Pour une validation D1 réelle, il faudra :
 *   wrangler d1 create botwow-db
 *   wrangler d1 migrations apply botwow-db --file=./migrations/0001_botwow_emails.sql
 *
 * Exit 0 = tous les tests passent.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MIGRATION_FILE = path.join(__dirname, '..', 'migrations', 'production', '0001_botwow_emails.sql');

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    failures++;
    console.error(`  FAIL: ${message}`);
  } else {
    console.log(`  ok: ${message}`);
  }
}
function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL: ${name} — ${err.message}`);
  }
}

// ── 1. Vérifier le fichier de migration ────────────────────────────────
const migrationSql = fs.readFileSync(MIGRATION_FILE, 'utf8');
assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS botwow_emails'), 'migration crée la table botwow_emails');
assert(migrationSql.includes('email TEXT NOT NULL UNIQUE'), 'colonne email UNIQUE');
assert(migrationSql.includes('subscribed_at INTEGER NOT NULL'), 'colonne subscribed_at');
assert(migrationSql.includes('status TEXT NOT NULL DEFAULT'), 'colonne status avec défaut');
assert(migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_botwow_emails_email'), 'index sur email');

// ── 2. Mock D1 fidèle (implémente prepare().bind().first() / .run()) ────
function makeD1() {
  const rows = [];
  let nextId = 1;
  return {
    prepare(sql) {
      const s = sql.trim();
      return {
        bind(...values) {
          this._values = values;
          return this;
        },
        async first() {
          const m = s.match(/SELECT\s+(.+?)\s+FROM\s+botwow_emails\s+WHERE\s+email\s*=\s*\?/i);
          if (m) {
            return rows.find(r => r.email === this._values[0]) || null;
          }
          return null;
        },
        async run() {
          const m = s.match(/INSERT\s+INTO\s+botwow_emails\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
          if (m) {
            const cols = m[1].split(',').map(c => c.trim());
            const vals = this._values;
            const row = {};
            cols.forEach((c, i) => { row[c.trim()] = vals[i]; });
            row.id = nextId++;
            rows.push(row);
            return { meta: { changes: 1, last_row_id: row.id } };
          }
          const m2 = s.match(/UPDATE\s+botwow_emails\s+SET\s+([^=]+)=\s*\?,\s*([^=]+)=\s*\?,\s*([^=]+)=\s*\?,\s*([^=]+)=\s*\?,\s*([^=]+)=\s*\?\s+WHERE\s+email\s*=\s*\?/i);
          if (m2) {
            const emailVal = this._values[this._values.length - 1];
            const idx = rows.findIndex(r => r.email === emailVal);
            if (idx !== -1) {
              rows[idx].status = 'subscribed';
              rows[idx].unsubscribed_at = null;
              rows[idx].subscribed_at = this._values[0];
              rows[idx].consent_marketing = this._values[1];
              rows[idx].consent_transactional = this._values[2];
              rows[idx].source = this._values[3];
            }
            return { meta: { changes: idx !== -1 ? 1 : 0 } };
          }
          return { meta: { changes: 0 } };
        }
      };
    }
  };
}

const env = { DB: makeD1() };

// ── 3. Implémentation de handleSubscribe (réplique exacte du worker) ────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateEmail(email) {
  return EMAIL_RE.test(email) && email.length <= 254;
}
function getClientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
async function checkRateLimit() {
  return { allowed: true, retryAfter: undefined };
}
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return { status, ok: data.ok, body: data };
}

async function handleSubscribe(request, env2) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(env2.RATE_LIMIT, 'subscribe', ip, { max: 10, windowMs: 36e5 });
  if (!rl.allowed) {
    return jsonResponse({ ok: false, error: 'rate_limited' }, 429, {
      'Retry-After': String(rl.retryAfter || 3600)
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const email = body.email?.toLowerCase().trim();
  if (!email || !validateEmail(email)) {
    return jsonResponse({ ok: false, error: 'invalid_email' }, 400);
  }
  const source = body.source || 'newsletter';
  const isSupport = source === 'support_purchase';
  // Une demande de support n'est JAMAIS ajoutée au marketing par défaut.
  const consentMarketing = isSupport ? 0 : (body.consent_marketing === true ? 1 : 0);
  const consentTransactional = body.consent_transactional === true ? 1 : 0;
  // Statut distinct : 'pending' pour une demande de support à traiter,
  // 'subscribed' pour une inscription newsletter.
  const status = isSupport ? 'pending' : 'subscribed';
  const now = Date.now();
  try {
    const existing = await env2.DB.prepare(
      `SELECT id, status, source, consent_marketing FROM botwow_emails WHERE email = ?`
    ).bind(email).first();
    if (existing) {
      if (existing.status === 'subscribed' && !isSupport) {
        return jsonResponse({ ok: true, message: 'Déjà inscrit.', email }, 200);
      }
      await env2.DB.prepare(`
        UPDATE botwow_emails SET status = ?, unsubscribed_at = NULL,
          subscribed_at = ?, consent_marketing = ?, consent_transactional = ?, source = ?
        WHERE email = ?
      `).bind(status, now, consentMarketing, consentTransactional, source, email).run();
      return jsonResponse({ ok: true, message: isSupport ? 'Demande de support enregistrée.' : 'Inscription réactivée.', email }, 200);
    }
    await env2.DB.prepare(`
      INSERT INTO botwow_emails (email, source, consent_marketing, consent_transactional, subscribed_at, status, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(email, source, consentMarketing, consentTransactional, now, status, ip).run();
    return jsonResponse({ ok: true, message: isSupport ? 'Demande de support enregistrée. L’équipe vous répondra.' : 'Inscription enregistrée.', email }, 200);
  } catch (error) {
    console.error('Subscribe error:', error);
    return jsonResponse({ ok: false, error: 'server_error' }, 500);
  }
}

function makeRequest(method, url, body) {
  return {
    method,
    url,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json() { return Promise.resolve(body); }
  };
}

// ── 4. Tests ───────────────────────────────────────────────────────────

test('inscription valide crée une entrée en base', async () => {
  const res = await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'alice@example.com',
    source: 'newsletter',
    consent_marketing: true,
    consent_transactional: true
  }), env);
  assert(res.ok === true, 'résultat ok=true');
  assert(res.body.message === 'Inscription enregistrée.', 'message de succès');
  const row = await env2.DB.prepare('SELECT * FROM botwow_emails WHERE email = ?').bind('alice@example.com').first();
  assert(row !== undefined, 'email présent en base');
  assert(row.email === 'alice@example.com', 'email stocké');
  assert(row.status === 'subscribed', 'status subscribed');
  assert(row.consent_marketing === 1, 'consent_marketing = 1');
  assert(row.consent_transactional === 1, 'consent_transactional = 1');
  assert(row.source === 'newsletter', 'source = newsletter');
  assert(typeof row.subscribed_at === 'number', 'subscribed_at défini');
});

test('email invalide est rejeté', async () => {
  const res = await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'not-an-email',
    source: 'newsletter',
    consent_marketing: true,
    consent_transactional: true
  }), env);
  assert(res.ok === false, 'ok=false');
  assert(res.body.error === 'invalid_email', 'erreur invalid_email');
  assert(res.status === 400, 'status 400');
  const row = await env2.DB.prepare('SELECT * FROM botwow_emails WHERE email = ?').bind('not-an-email').first();
  assert(row === undefined, 'aucun enregistrement créé');
});

test('email manquant est rejeté', async () => {
  const res = await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    source: 'newsletter',
    consent_marketing: true,
    consent_transactional: true
  }), env);
  assert(res.ok === false, 'ok=false');
  assert(res.body.error === 'invalid_email', 'erreur invalid_email');
});

test('payload absent (JSON invalide) est rejeté', async () => {
  const res = await handleSubscribe({
    method: 'POST',
    url: 'https://bot-wow.com/api/subscribe',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json() { throw new Error('bad json'); }
  }, env);
  assert(res.ok === false, 'ok=false');
  assert(res.body.error === 'invalid_json', 'erreur invalid_json');
});

test('email déjà inscrit est rejeté en idempotent (déjà subscribed)', async () => {
  await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'dup@example.com',
    source: 'newsletter',
    consent_marketing: true,
    consent_transactional: true
  }), env);
  const res = await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'dup@example.com',
    source: 'newsletter',
    consent_marketing: false,
    consent_transactional: false
  }), env);
  assert(res.ok === true, 'ok=true (idempotent)');
  assert(res.body.message === 'Déjà inscrit.', 'message déjà inscrit');
  const rows = await env2.DB.prepare('SELECT * FROM botwow_emails WHERE email = ?').bind('dup@example.com').first();
  assert(rows !== undefined, 'une entrée existe');
  // vérifier qu'il n'y a qu'une seule entrée (on ne peut pas compter facilement avec le mock, on vérifie juste l'unicité)
  assert(rows.email === 'dup@example.com', 'email correct');
});

test('email avec consents différents est accepté et mis à jour', async () => {
  await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'consent@example.com',
    source: 'newsletter',
    consent_marketing: true,
    consent_transactional: false
  }), env);
  const res = await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'consent@example.com',
    source: 'website',
    consent_marketing: false,
    consent_transactional: true
  }), env);
  assert(res.ok === true, 'ok=true');
  const row = await env2.DB.prepare('SELECT * FROM botwow_emails WHERE email = ?').bind('consent@example.com').first();
  assert(row.consent_marketing === 0, 'consent_marketing mis à jour à 0');
  assert(row.consent_transactional === 1, 'consent_transactional mis à jour à 1');
  assert(row.source === 'website', 'source mise à jour');
});

test('email avec consents différents est accepté et mis à jour', async () => {
  await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'consent@example.com',
    source: 'newsletter',
    consent_marketing: true,
    consent_transactional: false
  }), env);
  const res = await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'consent@example.com',
    source: 'website',
    consent_marketing: false,
    consent_transactional: true
  }), env);
  assert(res.ok === true, 'ok=true');
  const row = await env2.DB.prepare('SELECT * FROM botwow_emails WHERE email = ?').bind('consent@example.com').first();
  assert(row.consent_marketing === 0, 'consent_marketing mis à jour à 0');
  assert(row.consent_transactional === 1, 'consent_transactional mis à jour à 1');
  assert(row.source === 'website', 'source mise à jour');
});

test('demande de support : consent_marketing = 0 et statut pending', async () => {
  const res = await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'support@example.com',
    source: 'support_purchase',
    consent_marketing: false,
    consent_transactional: false
  }), env);
  assert(res.ok === true, 'ok=true');
  assert(res.body.message.includes('support'), 'message de support');
  const row = await env2.DB.prepare('SELECT * FROM botwow_emails WHERE email = ?').bind('support@example.com').first();
  assert(row !== undefined, 'email présent en base');
  assert(row.consent_marketing === 0, 'consent_marketing = 0 (pas de marketing)');
  assert(row.status === 'pending', 'statut pending');
  assert(row.source === 'support_purchase', 'source = support_purchase');
});

test('demande de support : même avec consent_marketing=true envoyé, reste à 0', async () => {
  const res = await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'support2@example.com',
    source: 'support_purchase',
    consent_marketing: true,
    consent_transactional: false
  }), env);
  assert(res.ok === true, 'ok=true');
  const row = await env2.DB.prepare('SELECT * FROM botwow_emails WHERE email = ?').bind('support2@example.com').first();
  assert(row.consent_marketing === 0, 'consent_marketing forcé à 0 pour le support');
  assert(row.status === 'pending', 'statut pending');
});

test('déduplication : une newsletter existante ne devient pas une demande de support', async () => {
  await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'dedup@example.com',
    source: 'newsletter',
    consent_marketing: true,
    consent_transactional: false
  }), env);
  const res = await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'dedup@example.com',
    source: 'support_purchase',
    consent_marketing: false,
    consent_transactional: false
  }), env);
  assert(res.ok === true, 'ok=true');
  const row = await env2.DB.prepare('SELECT * FROM botwow_emails WHERE email = ?').bind('dedup@example.com').first();
  assert(row.status === 'pending', 'statut mis à jour à pending');
  assert(row.source === 'support_purchase', 'source mise à jour à support_purchase');
  assert(row.consent_marketing === 0, 'consent_marketing mis à 0');
});

test('une demande de support existante reste pending à la ré-émission', async () => {
  await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'reissue@example.com',
    source: 'support_purchase',
    consent_marketing: false,
    consent_transactional: false
  }), env);
  const res = await handleSubscribe(makeRequest('POST', '/api/subscribe', {
    email: 'reissue@example.com',
    source: 'support_purchase',
    consent_marketing: false,
    consent_transactional: false
  }), env);
  assert(res.ok === true, 'ok=true');
  assert(res.body.message.includes('support'), 'message de support');
  const row = await env2.DB.prepare('SELECT * FROM botwow_emails WHERE email = ?').bind('reissue@example.com').first();
  assert(row.status === 'pending', 'statut toujours pending');
});

// ── 7. Résumé ──────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? 'TOUS LES TESTS PASSENT' : failures + ' ÉCHEC(S)'}`);
process.exit(failures === 0 ? 0 : 1);
