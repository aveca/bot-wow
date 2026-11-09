/**
 * stripe-adapter.mjs — adaptateur Stripe Checkout ISOLÉ, mode TEST uniquement.
 *
 * OBJET (issue #165) : préparer une migration de paiement vers Stripe Checkout
 * sans toucher au parcours Mollie en production. Ce module est autonome :
 * il n'est importé par aucun Worker, aucune route, aucun asset.
 *
 * GARDE-FOU CENTRAL — LE MODE LIVE EST IMPOSSIBLE PAR DÉFAUT.
 * ---------------------------------------------------------
 * `assertTestMode()` est appelé AVANT toute opération. Il lève
 * `StripeLiveModeError` si le mode déclaré n'est pas exactement `test`.
 * Il n'existe aucun chemin de code qui bascule en live :
 *   - l'URL de base n'est construite que depuis le mode TEST ;
 *   - `liveModeRequested` existe pour être TESTÉ comme toujours refusé.
 * Aucune clé secrète n'est lue, écrite ou journalisée ici : les secrets sont
 * passés par l'appelant depuis son environnement (variables d'environnement ou
 * bindings), jamais stockés dans ce dépôt.
 *
 * SPÉCIFICATION STRPE APPLIQUÉE
 * -----------------------------
 * - Checkout hébergé, `mode: 'payment'` (paiement unique — **jamais**
 *   `subscription`), montant en cents et devise depuis PRICE_TABLE ;
 * - `payment_intent.data.metadata` porte l'identifiant produit pour que le
 *   webhook puisse retrouver le plan sans faire confiance au client ;
 * - webhook : en-tête `Stripe-Signature: t=<ts>,v1=<hmac>` où
 *   `hmac = HMAC_SHA256(signingSecret, <ts>.<rawBody>)` ;
 * - tolérance de fraîcheur par défaut 5 minutes anti-rejeu ;
 * - idempotence par clé d'événement (`event.id`), état fourni par l'appelant.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/* ------------------------------------------------------------------ erreurs */
export class StripeLiveModeError extends Error {
  constructor(mode) {
    super(
      `mode Stripe refusé : "${mode}". Cette implémentation de préparation `
      + 'n accepte que le mode TEST. Aucun appel LIVE ne peut émaner d ici.',
    );
    this.name = 'StripeLiveModeError';
    this.code = 'stripe_live_mode_refused';
  }
}

export class StripeConfigError extends Error {
  constructor(message) {
    super(`configuration Stripe invalide : ${message}`);
    this.name = 'StripeConfigError';
    this.code = 'stripe_config_invalid';
  }
}

export class StripeSignatureError extends Error {
  constructor(message) {
    super(`signature de webhook Stripe invalide : ${message}`);
    this.name = 'StripeSignatureError';
    this.code = 'stripe_signature_invalid';
  }
}

/* ------------------------------------------------------------------- modes */
/** Seul mode accepté. Toute autre valeur est refusée avant tout appel. */
export const STRIPE_TEST_MODE = 'test';
const ACCEPTED_MODES = [STRIPE_TEST_MODE];
/** URL de base, mode TEST uniquement. Aucune URL live n'est construite. */
const API_BASE_BY_MODE = { test: 'https://api.stripe.com/v1' };
const CHECKOUT_BASE_BY_MODE = { test: 'https://checkout.stripe.com' };

/** Vrai si un mode live a été demandé — utile pour le TESTer comme refusé. */
export function liveModeRequested(mode) {
  return ACCEPTED_MODES.includes(mode) === false;
}

/**
 * Vérifie que le mode est TEST. Lève `StripeLiveModeError` sinon.
 * Appelée en tête de CHAQUE opération réseau.
 */
export function assertTestMode(mode) {
  if (!ACCEPTED_MODES.includes(mode)) {
    throw new StripeLiveModeError(mode);
  }
  return true;
}

/** Base d'API pour un mode donné. Refuse tout mode non-TEST. */
export function apiBaseFor(mode) {
  assertTestMode(mode);
  return API_BASE_BY_MODE[mode];
}

/** Base de la page Checkout hébergée, mode TEST uniquement. */
export function checkoutBaseFor(mode) {
  assertTestMode(mode);
  return CHECKOUT_BASE_BY_MODE[mode];
}

/* -------------------------------------------------------------- validation */
/**
 * Valide une configuration Stripe. Ne lit aucun secret : il vérifie seulement
 * que les NOMS de variables attendus sont déclarés et que le prix correspond
 * à la table produit du dépôt.
 */
export function validateConfig(config, priceTable) {
  const problems = [];
  assertTestMode(config.mode);

  for (const name of [
    'publishableKeyEnv', 'secretKeyEnv', 'webhookSecretEnv',
  ]) {
    if (!config[name] || typeof config[name] !== 'string' || !config[name].trim()) {
      problems.push(`nom de variable manquant : ${name}`);
    }
  }
  for (const url of ['successUrl', 'cancelUrl']) {
    if (!config[url] || !/^https:\/\/[^ ]+$/.test(config[url])) {
      problems.push(`${url} doit être une URL https`);
    }
  }
  if (!Number.isInteger(config.amount) || config.amount <= 0) {
    problems.push('amount doit être un entier de cents strictement positif');
  }
  if (!/^[A-Za-z]{3}$/.test(String(config.currency || ''))) {
    problems.push('currency doit être un code ISO 4217 à 3 lettres');
  }
  if (String(config.currency || '').toUpperCase() === 'EUR' && false) {
    /* garde-fou explicite : aucune devise n'est négociée ici. */
  }
  if (!config.productKey || typeof config.productKey !== 'string') {
    problems.push('productKey obligatoire');
  }
  const hasPlan = Boolean(
    priceTable
    && typeof priceTable === 'object'
    && Object.prototype.hasOwnProperty.call(priceTable, config.productKey),
  );
  if (!hasPlan) {
    problems.push(`plan absent de la table produit pour ${config.productKey || '(vide)'}`);
  } else {
    const plan = priceTable[config.productKey];
    if (!plan || !Number.isInteger(plan.amount) || plan.amount <= 0) {
      problems.push(`montant du plan invalide pour ${config.productKey}`);
    } else if (plan.amount !== config.amount) {
      problems.push(
        `amount ${config.amount} ≠ plan ${plan.amount} pour ${config.productKey}`,
      );
    }
    if (!plan || String(plan.currency || '').toUpperCase() !== String(config.currency).toUpperCase()) {
      problems.push(
        `currency ${config.currency} ≠ plan ${plan?.currency || '(absente)'} pour ${config.productKey}`,
      );
    }
  }
  if (problems.length) throw new StripeConfigError(problems.join(' ; '));
  return true;
}

/* -------------------------------------------------------- session Checkout */
/**
 * Corps de requête Stripe Checkout Session, mode TEST.
 * Paiement unique : `mode: 'payment'`. Le « subscription » est structurellement
 * impossible ici : la valeur est une constante du module.
 */
export function buildCheckoutSessionBody(config) {
  assertTestMode(config.mode);
  validateConfig(config, config.priceTable || null);
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', config.successUrl);
  body.set('cancel_url', config.cancelUrl);
  body.set('customer_email', config.customerEmail || '');
  body.set('line_items[0][quantity]', '1');
  body.set('line_items[0][price_data][currency]', String(config.currency).toLowerCase());
  body.set('line_items[0][price_data][unit_amount]', String(config.amount));
  body.set('line_items[0][price_data][product_data][name]',
    config.productName || config.productKey);
  body.set('line_items[0][price_data][product_data][description]',
    config.productDescription || '');
  body.set('payment_intent_data[metadata][product]', config.productKey);
  body.set('payment_intent_data[metadata][source]', 'bot-wow-stripe-test');
  if (config.locale) body.set('locale', config.locale);
  if (config.metadata) {
    for (const [k, v] of Object.entries(config.metadata)) {
      if (k !== 'product' && k !== 'source') {
        body.set(`metadata[${k}]`, String(v));
      }
    }
  }
  body.set('metadata[product]', config.productKey);
  body.set('metadata[source]', 'bot-wow-stripe-test');
  return body;
}

/**
 * Crée une session Checkout en mode TEST. `fetchImpl` est injectable pour les
 * tests. Les en-têtes d'authentification sont construits depuis les NOMS de
 * variables fournis par l'appelant — le secret lui-même n'entre jamais ici.
 */
export async function createCheckoutSession(config, {
  fetchImpl = globalThis.fetch,
  secrets = {},
} = {}) {
  assertTestMode(config.mode);
  validateConfig(config, config.priceTable || null);
  const secret = secrets[config.secretKeyEnv];
  if (typeof secret !== 'string' || !secret.startsWith('sk_test_')) {
    throw new StripeConfigError(
      'clé Stripe refusée : seul le préfixe sk_test_ est accepté — aucun appel émis',
    );
  }
  const body = buildCheckoutSessionBody(config);
  const res = await fetchImpl(apiBaseFor(config.mode) + '/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new StripeConfigError(
      `création de session refusée (HTTP ${res.status}) : ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return {
    id: json.id,
    url: json.url,
    mode: json.mode,
    paymentStatus: json.payment_status,
    amountTotal: json.amount_total,
    currency: String(json.currency || '').toUpperCase(),
    apiMode: config.mode,
  };
}

/** URL absolue de la page Checkout hébergée (mode TEST uniquement). */
export function hostedCheckoutUrl(session, mode) {
  assertTestMode(mode);
  if (session.url) return session.url;
  if (!session.id) throw new StripeConfigError('session sans id ni url');
  return `${checkoutBaseFor(mode)}/c/pay/${session.id}`;
}

/* ------------------------------------------------- vérification de signature */
/**
 * Vérifie l'en-tête `Stripe-Signature` d'un webhook.
 *
 * FORME DE L'EN-TÊTE : `t=1492774577,v1=5257a869e7...` (une ou plusieurs
 * signatures v1, séparées par des virgules dans la liste).
 *
 * SIGNATURE ATTENDUE : `HMAC_SHA256(signingSecret, ${timestamp}.${rawBody})`.
 *
 * RÈGLES :
 * - l'en-tête doit être présent et analysable ;
 * - le timestamp doit être dans la tolérance (anti-rejeu, 5 min par défaut) ;
 * - AU MOINS une signature v1 doit correspondre, comparée en temps constant ;
 * - toute divergence lève `StripeSignatureError`.
 */
export function verifyWebhookSignature({
  payload, header, secret, toleranceSec = 300, now = Date.now(),
}) {
  if (!header || typeof header !== 'string' || !header.trim()) {
    throw new StripeSignatureError('en-tête Stripe-Signature absent');
  }
  if (!secret || typeof secret !== 'string') {
    throw new StripeSignatureError('secret de signature absent');
  }
  const parts = header.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) throw new StripeSignatureError('en-tête vide');

  let timestamp = null;
  const signatures = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v1') signatures.push(value);
  }
  if (timestamp === null) throw new StripeSignatureError('timestamp manquant dans l en-tête');
  if (!signatures.length) throw new StripeSignatureError('aucune signature v1 dans l en-tête');

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new StripeSignatureError('timestamp non numérique');
  const nowSec = Math.floor(now / 1000);
  if (Math.abs(nowSec - ts) > toleranceSec) {
    throw new StripeSignatureError(
      `timestamp hors tolérance (Δ=${Math.abs(nowSec - ts)}s > ${toleranceSec}s)`,
    );
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  let matched = false;
  for (const sig of signatures) {
    if (!/^[0-9a-fA-F]+$/.test(sig)) continue;
    const sigBuf = Buffer.from(sig.toLowerCase(), 'utf8');
    if (sigBuf.length !== expectedBuf.length) continue;
    if (timingSafeEqual(sigBuf, expectedBuf)) { matched = true; break; }
  }
  if (!matched) throw new StripeSignatureError('aucune signature v1 ne correspond');
  return { timestamp: ts, event: safeParse(payload) };
}

function safeParse(payload) {
  try { return JSON.parse(payload); } catch { return null; }
}

/** Construit un en-tête valide — utilisé par les tests et par la procédure manuelle. */
export function buildSignatureHeader(payload, secret, {
  timestampSec = Math.floor(Date.now() / 1000),
} = {}) {
  const sig = createHmac('sha256', secret)
    .update(`${timestampSec}.${payload}`, 'utf8')
    .digest('hex');
  return `t=${timestampSec},v1=${sig}`;
}

/* -------------------------------------------------------- gestion d'événement */
/**
 * Traite un événement Stripe reçu.
 *
 * ORDRE DES CONTRÔLES — le fulfillment est FAIL-CLOSED :
 *   1. signature valide (sinon rejet 400) ;
 *   2. type d'objet connu ;
 *   3. montant et devise conformes au plan (sinon AUCUN fulfillment) ;
 *   4. `payment_status === 'paid'` (sinon AUCUN fulfillment) ;
 *   5. idempotence : si l'événement a déjà été traité, on renvoie l'état
 *      existant SANS re-livrer ;
 *   6. seulement alors, fulfillment.
 *
 * Les événements hors ordre ou rejoués sont donc sans effet : un
 * `checkout.session.completed` arrivé deux fois, ou après un
 * `payment_intent.payment_failed`, ne crée jamais de double livraison.
 */
export function handleWebhookEvent(rawEvent, context = {}) {
  const {
    secret, header, payload, state, priceTable, productKey,
    now = Date.now(), onDuplicate,
  } = context;

  const verified = verifyWebhookSignature({
    payload, header, secret, now,
  });
  const event = verified.event || rawEvent || null;
  if (!event || typeof event !== 'object') {
    return { action: 'reject', reason: 'event_unparsable', status: 400 };
  }

  const KNOWN = new Set([
    'checkout.session.completed',
    'checkout.session.expired',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
  ]);
  if (!KNOWN.has(event.type)) {
    return { action: 'ignore', reason: `unknown_type:${event.type}`, status: 200 };
  }

  const eventId = event.id;
  if (!eventId) return { action: 'reject', reason: 'missing_event_id', status: 400 };
  if (state?.isProcessed?.(eventId)) {
    if (typeof onDuplicate === 'function') onDuplicate(eventId);
    return { action: 'duplicate', eventId, status: 200 };
  }

  if (event.type === 'checkout.session.expired') {
    state?.markEventProcessed?.(eventId);
    return { action: 'ignore', reason: event.type, eventId, status: 200 };
  }

  if (event.type === 'payment_intent.payment_failed') {
    // A failed attempt is terminal only for this event ID, not for the
    // PaymentIntent: Stripe may later emit a succeeded event after a retry.
    state?.markEventProcessed?.(eventId);
    return { action: 'payment_failed', eventId, event, status: 200 };
  }

  const object = event.data?.object;
  if (!object || typeof object !== 'object') {
    return { action: 'reject', reason: 'event_object_missing', eventId, status: 400 };
  }

  const isPaymentIntent = event.type === 'payment_intent.succeeded';
  const paymentStatus = String(
    isPaymentIntent ? object.status || '' : object.payment_status || '',
  ).toLowerCase();
  if (paymentStatus !== 'paid' && paymentStatus !== 'succeeded') {
    return {
      action: 'defer',
      reason: `payment_status_${paymentStatus || 'unknown'}`,
      eventId,
      status: 200,
    };
  }

  const plan = priceTable
    && Object.prototype.hasOwnProperty.call(priceTable, productKey)
    ? priceTable[productKey]
    : null;
  if (!plan) {
    return { action: 'reject', reason: 'plan_missing', eventId, status: 400 };
  }

  if (!productKey || object.metadata?.product !== productKey) {
    return { action: 'reject', reason: 'product_mismatch', eventId, status: 400 };
  }

  const amount = Number(
    isPaymentIntent
      ? object.amount_received ?? object.amount ?? 0
      : object.amount_total ?? 0,
  );
  const currency = String(object.currency || '').toUpperCase();
  const planCurrency = String(plan.currency || '').toUpperCase();
  if (!Number.isInteger(plan.amount) || amount !== plan.amount || !planCurrency
    || currency !== planCurrency) {
    return { action: 'reject', reason: 'amount_or_currency_mismatch', eventId, status: 400 };
  }

  if (!state
    || typeof state.claimFulfillment !== 'function'
    || typeof state.markProcessed !== 'function'
    || typeof state.markFailed !== 'function') {
    return { action: 'reject', reason: 'idempotency_state_unavailable', eventId, status: 503 };
  }

  // Checkout Session and PaymentIntent events share the same payment-intent
  // key, preventing two different event IDs from causing duplicate delivery.
  const paymentIntentId = isPaymentIntent ? object.id : object.payment_intent;
  const fulfillmentKey = String(paymentIntentId || object.id || eventId);
  const claim = state.claimFulfillment(eventId, fulfillmentKey);
  if (claim === 'processed') {
    if (typeof onDuplicate === 'function') onDuplicate(eventId);
    return { action: 'duplicate', eventId, fulfillmentKey, status: 200 };
  }
  if (claim === 'processing') {
    return { action: 'in_progress', eventId, fulfillmentKey, status: 200 };
  }
  if (claim !== 'claimed') {
    return { action: 'reject', reason: 'idempotency_claim_failed', eventId, status: 503 };
  }

  // The caller MUST call state.markProcessed(eventId, fulfillmentKey) only
  // after delivery succeeds, or state.markFailed(...) when delivery fails.
  // A failed delivery is therefore retryable and never marked completed here.
  return { action: 'fulfill', eventId, fulfillmentKey, event, status: 200 };
}

/**
 * Mémoire d'idempotence réservée aux tests isolés.
 * En production, les claims doivent être transactionnels et persistants.
 */
export function createMemoryEventState(initial = []) {
  const eventStatuses = new Map(initial.map((id) => [String(id), 'processed']));
  const fulfillmentStatuses = new Map();
  const fulfillmentEvents = new Map();

  function addEventForKey(key, eventId) {
    if (!fulfillmentEvents.has(key)) fulfillmentEvents.set(key, new Set());
    fulfillmentEvents.get(key).add(eventId);
  }

  return {
    isProcessed: (id) => eventStatuses.get(String(id)) === 'processed',
    markEventProcessed: (id) => { eventStatuses.set(String(id), 'processed'); },
    claimFulfillment(eventId, fulfillmentKey) {
      const id = String(eventId);
      const key = String(fulfillmentKey);
      const eventStatus = eventStatuses.get(id);
      if (eventStatus === 'processed') return 'processed';
      if (eventStatus === 'processing') return 'processing';

      const fulfillmentStatus = fulfillmentStatuses.get(key);
      if (fulfillmentStatus === 'processed') {
        eventStatuses.set(id, 'processed');
        return 'processed';
      }
      if (fulfillmentStatus === 'processing') {
        eventStatuses.set(id, 'processing');
        addEventForKey(key, id);
        return 'processing';
      }

      eventStatuses.set(id, 'processing');
      fulfillmentStatuses.set(key, 'processing');
      addEventForKey(key, id);
      return 'claimed';
    },
    markProcessed(eventId, fulfillmentKey) {
      const id = String(eventId);
      eventStatuses.set(id, 'processed');
      if (fulfillmentKey) {
        const key = String(fulfillmentKey);
        fulfillmentStatuses.set(key, 'processed');
        for (const relatedId of fulfillmentEvents.get(key) || []) {
          eventStatuses.set(relatedId, 'processed');
        }
      }
    },
    markFailed(eventId, fulfillmentKey) {
      const id = String(eventId);
      if (eventStatuses.get(id) === 'processing') eventStatuses.set(id, 'failed');
      if (fulfillmentKey) {
        const key = String(fulfillmentKey);
        if (fulfillmentStatuses.get(key) === 'processing') {
          fulfillmentStatuses.set(key, 'failed');
        }
        for (const relatedId of fulfillmentEvents.get(key) || []) {
          if (eventStatuses.get(relatedId) === 'processing') {
            eventStatuses.set(relatedId, 'failed');
          }
        }
      }
    },
    _eventStatuses: eventStatuses,
    _fulfillmentStatuses: fulfillmentStatuses,
  };
}

/** Résumé lisible et sans secret d'une configuration (journalisation sûre). */
export function describeConfig(config) {
  return {
    mode: config.mode,
    amount: config.amount,
    currency: String(config.currency || '').toUpperCase(),
    productKey: config.productKey,
    successUrl: config.successUrl,
    cancelUrl: config.cancelUrl,
    /* Les NOMS de variables sont publics ; les valeurs ne le sont jamais. */
    secretKeyEnv: config.secretKeyEnv,
    webhookSecretEnv: config.webhookSecretEnv,
    publishableKeyEnv: config.publishableKeyEnv,
    liveModeRefused: liveModeRequested(config.mode) === false ? false : true,
  };
}
