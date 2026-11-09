import assert from 'node:assert';
import {
  assertTestMode,
  buildCheckoutSessionBody,
  buildSignatureHeader,
  createCheckoutSession,
  createMemoryEventState,
  handleWebhookEvent,
  liveModeRequested,
  validateConfig,
  verifyWebhookSignature,
} from '../payments/stripe-adapter.mjs';

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

function fixtureConfig(overrides = {}) {
  return {
    mode: 'test',
    secretKeyEnv: 'STRIPE_SECRET_KEY',
    publishableKeyEnv: 'STRIPE_PUBLISHABLE_KEY',
    webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET',
    successUrl: 'https://bot-wow.com/success',
    cancelUrl: 'https://bot-wow.com/cancel',
    amount: 2000,
    currency: 'eur',
    productKey: 'bot-wow-lifetime',
    priceTable: { 'bot-wow-lifetime': { amount: 2000, currency: 'eur' } },
    productName: 'BOT-WOW Fishing Assistant',
    productDescription: 'Fishing Assistant 1.2.0 — WoW Classic assistant',
    metadata: { sessionId: 'sess_test_1', customerEmail: 'client@example.com' },
    ...overrides,
  };
}

console.log('=== 1. MODE TEST UNIQUEMENT ===');
check('MODE TEST unique : mode "test" accepté', liveModeRequested('test') === false);

const modes = ['live', '', null, undefined, 'development', 'sandbox', 'undefined_value'];
for (const m of modes) {
  check(`MODE LIVE refusé : ${String(m)}`, liveModeRequested(m) === true);
}

check('assertTestMode lance sur mode live',
  (() => { try { assertTestMode('live'); return false; } catch (e) { return e instanceof Error && e.code === 'stripe_live_mode_refused'; } })(),
  'mode live lève StripeLiveModeError');

check('assertTestMode passe en mode test',
  (() => { assertTestMode('test'); return true; })(),
  'mode test accepte');

console.log('');
console.log('=== 2. CREATE CHECKOUT SESSION (mode test) ===');

{
  const config = fixtureConfig();
  let threw = false;
  try { await createCheckoutSession(config); } catch (e) { threw = e instanceof Error && e.code === 'stripe_config_invalid'; }
  check('clé secrète manquante -> échec', threw,
    `clé secrète manquante → échec`);
}

{
  const config = fixtureConfig({ secretKeyEnv: undefined });
  let threw = false;
  try { await createCheckoutSession(config); } catch (e) { threw = e instanceof Error && e.code === 'stripe_config_invalid'; }
  check('mode test avec clé secrète manquante -> échec', threw,
    `mode test avec clé secrète manquante -> échec`);
}

{
  const config = fixtureConfig();
  let session = null;
  try {
    session = await createCheckoutSession(config, {
      fetchImpl: async (url, opts) => ({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 'cs_test_aaaaa',
          url: 'https://checkout.stripe.com/pay/cs_test_aaaaa',
          mode: 'payment',
          amount_total: 2000,
          currency: 'eur',
          customer_email: 'client@example.com',
        }),
      }),
      secrets: { STRIPE_SECRET_KEY: 'sk_test_1234567890' },
    });
  } catch (e) {
    check('créer une session réussit', false, e.message);
  }
  if (session) {
    check('mode test : une session est créée', true);
    check('id de session est un id de test Stripe', /^cs_test_/.test(session.id),
      `(attendu cs_test_*, reçu ${session.id})`);
    check('mode de la session est payment', session.mode === 'payment',
      `(reçu ${session.mode})`);
    check('montant est 2000 centimes', session.amountTotal === 2000,
      `(reçu ${session.amountTotal})`);
    check('devise est EUR', session.currency === 'EUR', `(reçu ${session.currency})`);
  }
}


{
  const config = fixtureConfig();
  let fetchCalls = 0;
  let rejected = false;
  try {
    await createCheckoutSession(config, {
      secrets: { STRIPE_SECRET_KEY: 'sk_live_never_send_this' },
      fetchImpl: async () => { fetchCalls += 1; throw new Error('fetch must not run'); },
    });
  } catch (e) {
    rejected = e instanceof Error && e.code === 'stripe_config_invalid';
  }
  check('clé sk_live_ refusée avant tout fetch', rejected && fetchCalls === 0,
    `rejected=${rejected}, fetchCalls=${fetchCalls}`);
}

console.log('');
console.log('=== 3. BUILD CHECKOUT SESSION BODY ===');

{
  const config = fixtureConfig();
  const body = buildCheckoutSessionBody(config);
  const params = {};
  for (const [k, v] of body) params[k] = v;
  check('mode est payment', params.mode === 'payment',
    `(reçu ${params.mode})`);
  check('mode n est jamais subscription', params.mode !== 'subscription');
  check('quantité est 1', params['line_items[0][quantity]'] === '1',
    `(reçu ${params['line_items[0][quantity]']})`);
  check('devise est eur', params['line_items[0][price_data][currency]'] === 'eur');
  check('montant est 2000 centimes', params['line_items[0][price_data][unit_amount]'] === '2000');
  check('nom du produit', params['line_items[0][price_data][product_data][name]'] === 'BOT-WOW Fishing Assistant',
    `(reçu ${params['line_items[0][price_data][product_data][name]']})`);
  check('identifiant produit dans metadata', params['payment_intent_data[metadata][product]'] === 'bot-wow-lifetime',
    `(reçu ${params['payment_intent_data[metadata][product]']})`);
  check('source est bot-wow-stripe-test', params['payment_intent_data[metadata][source]'] === 'bot-wow-stripe-test',
    `(reçu ${params['payment_intent_data[metadata][source]']})`);
}

console.log('');
console.log('=== 4. HANDLE WEBHOOK EVENT ===');

const secret = 'whsec_test_secret';
const priceTable = { 'bot-wow-lifetime': { amount: 2000, currency: 'eur' } };
const productKey = 'bot-wow-lifetime';

{
  const payloadValid = JSON.stringify({
    id: 'evt_test_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_aaa',
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: 2000,
        currency: 'eur',
        metadata: { product: 'bot-wow-lifetime' },
        customer_details: { email: 'client@example.com' },
      },
    },
  });
  const headerValid = buildSignatureHeader(payloadValid, secret);
  const result = handleWebhookEvent(payloadValid, {
    secret, header: headerValid, payload: payloadValid,
    state: createMemoryEventState(),
    priceTable,
    productKey,
  });
  check('webhook payé est accepté', result.action === 'fulfill',
    `(retourne ${result.action})`);
  check('statut est 200', result.status === 200, `(reçu ${result.status})`);
  check('identifiant événement est correct', result.eventId === 'evt_test_1',
    `(reçu ${result.eventId})`);
}

{
  const payload = JSON.stringify({
    id: 'evt_bad',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_aaa', payment_status: 'paid' } },
  });
  const header = buildSignatureHeader(payload, 'wrong_secret');
  let threw = false;
  try { await handleWebhookEvent(payload, { secret, header, payload }); } catch (e) { threw = e instanceof Error && e.code === 'stripe_signature_invalid'; }
  check('signature invalide est rejetée', threw,
    `échec: ${threw}`);
}

{
  const payload = JSON.stringify({
    id: 'evt_dup_1',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_dup', payment_status: 'paid', amount_total: 2000, currency: 'eur', metadata: { product: 'bot-wow-lifetime' } } },
  });
  const header = buildSignatureHeader(payload, secret);
  const state = createMemoryEventState(['evt_dup_1']);
  const result = handleWebhookEvent(payload, { secret, header, payload, eventId: 'evt_dup_1', state });
  check('rejet d un événement déjà traité -> duplicate', result.action === 'duplicate',
    `(retourne ${result.action})`);
  check('statut est 200', result.status === 200);
  check('identifiant événement est correct', result.eventId === 'evt_dup_1',
    `(reçu ${result.eventId})`);
}

{
  const payload = JSON.stringify({
    id: 'evt_unknown',
    type: 'payment_intent.canceled',
    data: { object: {} },
  });
  const header = buildSignatureHeader(payload, secret);
  const state = createMemoryEventState();
  const result = handleWebhookEvent(payload, { secret, header, payload, eventId: 'evt_unknown', state });
  check('événement inconnu est ignoré', result.action === 'ignore',
    `(retourne ${result.action})`);
  check('statut est 200', result.status === 200);
}

{
  const payload = JSON.stringify({
    id: 'evt_wrong_amount',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_wrong', payment_status: 'paid', amount_total: 9999, currency: 'eur', metadata: { product: 'bot-wow-lifetime' } } },
  });
  const header = buildSignatureHeader(payload, secret);
  const state = createMemoryEventState();
  const result = handleWebhookEvent(payload, { secret, header, payload, eventId: 'evt_wrong_amount', state, priceTable: priceTable, productKey });
  check('montant incohérent est rejeté', result.action === 'reject',
    `(retourne ${result.action})`);
  check('statut est 400', result.status === 400, `(reçu ${result.status})`);
}

{
  const payload = JSON.stringify({
    id: 'evt_unpaid',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_unpaid', payment_status: 'unpaid', amount_total: 2000, currency: 'eur', metadata: { product: 'bot-wow-lifetime' } } },
  });
  const header = buildSignatureHeader(payload, secret);
  const state = createMemoryEventState();
  const result = handleWebhookEvent(payload, { secret, header, payload, eventId: 'evt_unpaid', state });
  check('statut non payé est différé', result.action === 'defer',
    `(retourne ${result.action})`);
  check('statut est 200', result.status === 200);
}

{
  const payload = JSON.stringify({
    id: 'evt_dup_2',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_dup_2', payment_status: 'paid', amount_total: 2000, currency: 'eur', metadata: { product: 'bot-wow-lifetime' } } },
  });
  const header = buildSignatureHeader(payload, secret);
  const state = createMemoryEventState(['evt_dup_2']);
  const result = handleWebhookEvent(payload, { secret, header, payload, eventId: 'evt_dup_2', state });
  check('rejet d un paiement déjà traité -> duplicate', result.action === 'duplicate',
    `(retourne ${result.action})`);
  check('statut est 200', result.status === 200);
}

{
  const payload = JSON.stringify({
    id: 'evt_wrong_amount2',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_wrong2', payment_status: 'paid', amount_total: 2000, currency: 'usd', metadata: { product: 'bot-wow-lifetime' } } },
  });
  const header = buildSignatureHeader(payload, secret);
  const state = createMemoryEventState();
  const result = handleWebhookEvent(payload, { secret, header, payload, eventId: 'evt_wrong_amount2', state, priceTable: { 'bot-wow-lifetime': { amount: 2000, currency: 'eur' } }, productKey: 'bot-wow-lifetime' });
  check('devise incohérente est rejetée', result.action === 'reject',
    `(retourne ${result.action})`);
  check('statut est 400', result.status === 400, `(reçu ${result.status})`);
}


console.log('');
console.log('=== 5. FAIL-CLOSED / PAYMENTINTENT / FULFILLMENT RETRIES ===');

function signedEvent(event, state, overrides = {}) {
  const payload = JSON.stringify(event);
  const header = buildSignatureHeader(payload, secret);
  return handleWebhookEvent(event, {
    secret, header, payload, state, priceTable, productKey,
    ...overrides,
  });
}

{
  const event = {
    id: 'evt_plan_missing',
    type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_plan_missing',
      payment_intent: 'pi_plan_missing',
      payment_status: 'paid',
      amount_total: 2000,
      currency: 'eur',
      metadata: { product: 'bot-wow-lifetime' },
    } },
  };
  const result = signedEvent(event, createMemoryEventState(), { priceTable: {} });
  check('plan absent -> fail-closed', result.action === 'reject' && result.reason === 'plan_missing');
}

{
  const event = {
    id: 'evt_product_mismatch',
    type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_product_mismatch',
      payment_intent: 'pi_product_mismatch',
      payment_status: 'paid',
      amount_total: 2000,
      currency: 'eur',
      metadata: { product: 'different-product' },
    } },
  };
  const result = signedEvent(event, createMemoryEventState());
  check('metadata produit absent/mismatch -> fail-closed',
    result.action === 'reject' && result.reason === 'product_mismatch');
}

{
  const event = {
    id: 'evt_pi_succeeded',
    type: 'payment_intent.succeeded',
    data: { object: {
      id: 'pi_test_succeeded',
      object: 'payment_intent',
      status: 'succeeded',
      amount: 2000,
      amount_received: 2000,
      currency: 'eur',
      metadata: { product: 'bot-wow-lifetime' },
    } },
  };
  const state = createMemoryEventState();
  const result = signedEvent(event, state);
  check('payment_intent.succeeded + status=succeeded -> fulfill',
    result.action === 'fulfill' && result.fulfillmentKey === 'pi_test_succeeded');
  state.markProcessed(result.eventId, result.fulfillmentKey);
  const duplicate = signedEvent(event, state);
  check('PaymentIntent rejoué après fulfillment -> duplicate', duplicate.action === 'duplicate');
}

{
  const state = createMemoryEventState();
  const failed = {
    id: 'evt_pi_failed_first',
    type: 'payment_intent.payment_failed',
    data: { object: {
      id: 'pi_retry_order',
      object: 'payment_intent',
      status: 'requires_payment_method',
      amount: 2000,
      currency: 'eur',
      metadata: { product: 'bot-wow-lifetime' },
    } },
  };
  const succeeded = {
    id: 'evt_pi_succeeded_later',
    type: 'payment_intent.succeeded',
    data: { object: {
      id: 'pi_retry_order',
      object: 'payment_intent',
      status: 'succeeded',
      amount: 2000,
      amount_received: 2000,
      currency: 'eur',
      metadata: { product: 'bot-wow-lifetime' },
    } },
  };
  check('payment_failed reçu avant succeeded ne verrouille pas le paiement',
    signedEvent(failed, state).action === 'payment_failed'
      && signedEvent(succeeded, state).action === 'fulfill');
}

{
  const state = createMemoryEventState();
  const event = {
    id: 'evt_delivery_retry',
    type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_delivery_retry',
      payment_intent: 'pi_delivery_retry',
      payment_status: 'paid',
      amount_total: 2000,
      currency: 'eur',
      metadata: { product: 'bot-wow-lifetime' },
    } },
  };
  const first = signedEvent(event, state);
  check('première livraison revendique une clé idempotente', first.action === 'fulfill');
  state.markFailed(first.eventId, first.fulfillmentKey);
  const retry = signedEvent(event, state);
  check('échec fulfillment permet un rejeu', retry.action === 'fulfill');
  state.markProcessed(retry.eventId, retry.fulfillmentKey);
  const replay = signedEvent(event, state);
  check('livraison terminée ne peut pas être doublée', replay.action === 'duplicate');
}

{
  const state = createMemoryEventState();
  const checkout = {
    id: 'evt_checkout_completed',
    type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_shared_payment',
      payment_intent: 'pi_shared_payment',
      payment_status: 'paid',
      amount_total: 2000,
      currency: 'eur',
      metadata: { product: 'bot-wow-lifetime' },
    } },
  };
  const first = signedEvent(checkout, state);
  state.markProcessed(first.eventId, first.fulfillmentKey);
  const paymentIntent = {
    id: 'evt_payment_intent_succeeded',
    type: 'payment_intent.succeeded',
    data: { object: {
      id: 'pi_shared_payment',
      object: 'payment_intent',
      status: 'succeeded',
      amount: 2000,
      amount_received: 2000,
      currency: 'eur',
      metadata: { product: 'bot-wow-lifetime' },
    } },
  };
  check('Checkout + PaymentIntent du même paiement -> une seule livraison',
    signedEvent(paymentIntent, state).action === 'duplicate');
}

{
  const event = {
    id: 'evt_no_state',
    type: 'checkout.session.completed',
    data: { object: {
      id: 'cs_no_state',
      payment_intent: 'pi_no_state',
      payment_status: 'paid',
      amount_total: 2000,
      currency: 'eur',
      metadata: { product: 'bot-wow-lifetime' },
    } },
  };
  const result = signedEvent(event, null);
  check('absence de store idempotent -> fail-closed 503',
    result.action === 'reject' && result.status === 503);
}

console.log('');
console.log(failures === 0 ? 'STRIPE ADAPTER : OK' : `STRIPE ADAPTER : ${failures} ÉCHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
