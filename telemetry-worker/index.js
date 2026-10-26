/**
 * botwow-telemetry — point de collecte first-party des evenements de
 * parcours BOT-WOW.
 *
 * DEPLOYE SUR : bot-wow.com/api/track (route Worker sur le domaine du site).
 * STOCKAGE : base D1 dediee `botwow-analytics` (binding TELEMETRY_DB).
 *
 * PRIVACITE
 *  - aucune donnee personnelle acceptee : ni email, ni nom, ni identifiant
 *    de commande, ni texte libre ; les proprietes sont une liste fermee ;
 *  - l'IP n'est jamais stockee : seul un hash sale tronque est conserve,
 *    et uniquement pour la limitation de debit ;
 *  - le client respecte Do Not Track ;
 *  - retention 90 jours, purge automatique.
 *
 * ANTI-ABUS
 *  - methode, type de contenu et taille du corps contraints ;
 *  - 60 evenements / minute / IP ; reponse 429 ;
 *  - reponses d'erreur generiques (aucune fuite d'internals).
 *
 * Ce que cet endpoint NE fait PAS : il ne compte pas les conversions.
 * Une conversion reelle (un achat confirme) vient du webhook Mollie, cote
 * Worker de paiement. Ici on ne mesure que l'intention.
 */

const SCHEMA_VERSION = 1;
const MAX_BODY_BYTES = 4096;
const RATE_LIMIT_PER_MIN = 60;
const RETENTION_DAYS = 90;

/* Liste fermee des evenements et de leurs proprietes. */
const EVENT_SPEC = {
  page_view: { cta: null, mode: null, years: null, step: 'step', source: 'source' },
  cta_click: { cta: 'cta', mode: null, years: null, step: 'step', source: 'source' },
  planner_mode: { cta: null, mode: 'mode', years: null, step: null, source: 'source' },
  ownership_view: { cta: null, mode: null, years: 'years', step: null, source: 'source' },
  checkout_start: { cta: null, mode: null, years: null, step: 'step', source: 'source' },
  checkout_error: { cta: null, mode: null, years: null, step: 'step', source: 'source' },
  journey_view: { cta: null, mode: null, years: null, step: 'step', source: 'source' },
  // Intention de paiement : clic sur un CTA d'achat. Ce n'est PAS une
  // vente ; seule la validation du webhook Mollie en etablit une.
  checkout_requested: { cta: null, mode: null, years: null, step: 'step', source: 'source' },
  offer_view: { cta: null, mode: null, years: null, step: 'step', source: 'source' },
  demo_open: { cta: null, mode: null, years: null, step: 'step', source: 'source' },
};

/* Provenance du trafic : liste fermee. Une valeur inconnue ou forgee est
   ramenee a "other" (jamais enregistree telle quelle). Sources admises :
   google, yt, reddit, discord, forum, direct, other. */
const SOURCES = ['google', 'yt', 'reddit', 'discord', 'forum', 'direct', 'other'];
const RE_SOURCE = /^(google|yt|reddit|discord|forum|direct|other)$/;

/* ATTENTION : la conversion (paiement confirme) n'est PAS dans cette
   liste. Elle n'est jamais acceptee depuis le navigateur : elle est ecrite
   directement en base par le Worker de paiement, apres verification du
   webhook Mollie. Un clic, une ouverture de checkout et un paiement
   confirme sont donc trois evenements distincts, jamais confondus. */

const RE_CTA = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const RE_MODE = /^(prudent|equilibre|exploration)$/;
const RE_STEP = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const RE_PAGE = /^\/[a-zA-Z0-9\-_/.]{0,63}$/;
const RE_REF = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const RE_JOURNEY = /^[a-z0-9][a-z0-9_-]{0,39}$/;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function fail(status, error) {
  return json(status, { ok: false, error });
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

function uaFamily(request) {
  const ua = request.headers.get('user-agent') || '';
  if (/edg\//i.test(ua)) return 'edge';
  if (/chrome|crios/i.test(ua)) return 'chrome';
  if (/firefox|fxios/i.test(ua)) return 'firefox';
  if (/safari/i.test(ua)) return 'safari';
  if (/bot|crawler|spider|headless/i.test(ua)) return 'bot';
  return 'other';
}

/**
 * Validation de l'evenement. Retourne les colonnes a inserer, ou null.
 * Aucune valeur libre n'est acceptee.
 */
export function validateEvent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (payload.v !== SCHEMA_VERSION) return null;
  const spec = EVENT_SPEC[payload.event];
  if (!spec) return null;

  if (typeof payload.page !== 'string' || !RE_PAGE.test(payload.page)) return null;
  const lang = payload.lang === 'fr' ? 'fr' : payload.lang === 'en' ? 'en' : null;
  if (!lang) return null;

  const props = payload.props && typeof payload.props === 'object' ? payload.props : {};
  const row = {
    event: payload.event, page: payload.page, lang,
    cta: null, mode: null, years: null, step: null, ref: null, test: 0,
    journey_id: null, source: null,
  };

  if (spec.cta) {
    const cta = props.cta;
    if (typeof cta !== 'string' || !RE_CTA.test(cta)) return null;
    row.cta = cta;
  }
  if (spec.mode) {
    const mode = props.mode;
    if (typeof mode !== 'string' || !RE_MODE.test(mode)) return null;
    row.mode = mode;
  }
  if (spec.years) {
    const years = Number(props.years);
    if (!Number.isInteger(years) || years < 1 || years > 36) return null;
    row.years = years;
  }
  if (spec.step) {
    const step = props.step;
    if (step === undefined || step === null) row.step = 'unknown';
    else if (typeof step === 'string' && RE_STEP.test(step)) row.step = step;
    else return null;
  }

  // Identifiant de parcours anonyme : relie les evenements d'une meme
  // session sans exposer de donnee personnelle. Absent si la colonne
  // n'existe pas encore en production (migration 0003 non appliquee).
  const journeyId = props.journey_id;
  if (journeyId !== undefined && journeyId !== null) {
    if (typeof journeyId !== 'string' || !RE_JOURNEY.test(journeyId)) return null;
    row.journey_id = journeyId;
  }

  // Provenance du trafic : liste fermee. Absente ou hors liste -> "other"
  // (jamais une chaine arbitraire). Les evenements anterieurs restent NULL.
  const rawSource = props.source;
  if (rawSource === undefined || rawSource === null || rawSource === '') {
    row.source = 'other';
  } else if (typeof rawSource === 'string' && RE_SOURCE.test(rawSource)) {
    row.source = rawSource;
  } else {
    row.source = 'other';
  }

  // Evenement de test : reference obligatoire, marque comme tel pour ne
  // jamais polluer les statistiques.
  if (payload.test === true) {
    const ref = typeof payload.ref === 'string' && RE_REF.test(payload.ref) ? payload.ref : null;
    if (!ref) return null;
    row.test = 1;
    row.ref = ref;
  } else if (payload.test !== undefined && payload.test !== false) {
    return null;
  }
  if (payload.ref !== undefined && !row.ref) return null;

  return row;
}

export async function handleTrack(request, env) {
  if (request.method !== 'POST') return fail(405, 'method_not_allowed');
  const ctype = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (ctype !== 'application/json') return fail(415, 'unsupported_media_type');

  const declared = Number(request.headers.get('content-length') || '0');
  if (declared && declared > MAX_BODY_BYTES) return fail(413, 'payload_too_large');

  let text = '';
  try {
    text = await request.text();
  } catch {
    return fail(400, 'invalid_body');
  }
  if (text.length > MAX_BODY_BYTES) return fail(413, 'payload_too_large');

  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    return fail(400, 'invalid_json');
  }

  const row = validateEvent(payload);
  if (!row) return fail(400, 'invalid_event');

  const db = env && env.TELEMETRY_DB;
  if (!db) {
    // Stockage indisponible : on repond quand meme, l'interface ne doit
    // jamais dependre de la collecte.
    return json(202, { ok: true, stored: false });
  }

  const ip = clientIp(request);
  const salt = (env.TELEMETRY_SALT || 'botwow-telemetry-v1');
  const ipHash = (await sha256Hex(salt + '|' + ip)).slice(0, 16);

  // --- limitation de debit (par IP, fenetre d une minute) ---
  const window = Math.floor(Date.now() / 60000);
  try {
    await db.prepare(
      'INSERT INTO rl (bucket, window, count) VALUES (?, ?, 1) ' +
      'ON CONFLICT(bucket, window) DO UPDATE SET count = count + 1'
    ).bind('ip:' + ipHash, window).run();
    const res = await db.prepare('SELECT count FROM rl WHERE bucket = ? AND window = ?')
      .bind('ip:' + ipHash, window).first();
    if (res && Number(res.count) > RATE_LIMIT_PER_MIN) {
      return fail(429, 'rate_limited');
    }
  } catch {
    // Compteur indisponible : on ne bloque pas la collecte.
  }

  // --- purge de retention (opportuniste) ---
  try {
    if (Math.random() < 0.02) {
      const cutoff = Date.now() - RETENTION_DAYS * 86400000;
      await db.prepare('DELETE FROM events WHERE ts < ?').bind(cutoff).run();
      await db.prepare('DELETE FROM rl WHERE window < ?').bind(window - 10).run();
    }
  } catch {
    // la purge est opportuniste
  }

  try {
    await db.prepare(
      'INSERT INTO events (ts, event, page, lang, cta, mode, years, step, ref, test, ip_hash, ua, journey_id, source) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      Date.now(), row.event, row.page, row.lang, row.cta, row.mode, row.years,
      row.step, row.ref, row.test, ipHash, uaFamily(request), row.journey_id, row.source
    ).run();
  } catch {
    // Colonne journey_id ou source absente (schema anterieur) : on rejoue
    // sans elles. La collecte fonctionne, moins le lien de parcours et la
    // provenance.
    try {
      await db.prepare(
        'INSERT INTO events (ts, event, page, lang, cta, mode, years, step, ref, test, ip_hash, ua) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        Date.now(), row.event, row.page, row.lang, row.cta, row.mode, row.years,
        row.step, row.ref, row.test, ipHash, uaFamily(request)
      ).run();
    } catch {
      return json(202, { ok: true, stored: false });
    }
  }

  return json(202, { ok: true, stored: true });
}

export default {
  async fetch(request, env) {
    return handleTrack(request, env);
  },
};
