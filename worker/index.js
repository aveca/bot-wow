var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/license.ts
var SUPPORTED_LANGS = ["fr", "en", "de", "es", "pt", "ru"];
var DEFAULT_LANG = "fr";
var LICENSE_KEY_PREFIX = "BOTW-";
var LICENSE_KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var DOWNLOAD_TOKEN_BYTES = 24;
var DOWNLOAD_EXPIRY_DAYS = 30;
var DOWNLOAD_MAX_COUNT = 10;
var DEFAULT_MAX_ACTIVATIONS = 2;
var RATE_LIMITS = {
  claim: { max: 10, windowMs: 36e5 },
  // 10/h per IP
  resendIp: { max: 5, windowMs: 36e5 },
  // 5/h per IP
  resendMail: { max: 3, windowMs: 36e5 },
  // 3/h per email
  activate: { max: 30, windowMs: 3e5 },
  // 30/5min per IP
  download: { max: 20, windowMs: 36e5 },
  // 20/h per IP
  subscribe: { max: 10, windowMs: 36e5 }
  // 10/h per IP
};
function generateLicenseKey() {
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let group = "";
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor(Math.random() * LICENSE_KEY_ALPHABET.length);
      group += LICENSE_KEY_ALPHABET[idx];
    }
    groups.push(group);
  }
  return LICENSE_KEY_PREFIX + groups.join("-");
}
__name(generateLicenseKey, "generateLicenseKey");
function generateToken(bytes = DOWNLOAD_TOKEN_BYTES) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(generateToken, "generateToken");
async function signActivation(key, machineId, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const message = encoder.encode(`${key}|${machineId}`);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(signActivation, "signActivation");
async function checkRateLimit(kv, bucket, identifier, config2) {
  const now = Date.now();
  const windowStart = now - config2.windowMs;
  const kvKey = `ratelimit:${bucket}:${identifier}`;
  try {
    const stored = await kv.get(kvKey, { type: "json" });
    if (!stored || stored.resetAt < now) {
      await kv.put(kvKey, JSON.stringify({ count: 1, resetAt: now + config2.windowMs }), {
        expirationTtl: Math.ceil(config2.windowMs / 1e3) + 60
      });
      return { allowed: true };
    }
    if (stored.count >= config2.max) {
      const retryAfter = Math.ceil((stored.resetAt - now) / 1e3);
      return { allowed: false, retryAfter };
    }
    stored.count++;
    await kv.put(kvKey, JSON.stringify(stored), {
      expirationTtl: Math.ceil(config2.windowMs / 1e3) + 60
    });
    return { allowed: true };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return { allowed: true };
  }
}
__name(checkRateLimit, "checkRateLimit");
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 254;
}
__name(validateEmail, "validateEmail");
function validateLang(lang) {
  const normalized = lang.toLowerCase();
  return SUPPORTED_LANGS.includes(normalized) ? normalized : DEFAULT_LANG;
}
__name(validateLang, "validateLang");
function getClientIp(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
__name(getClientIp, "getClientIp");
async function handleSubscribe(request, env2) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(env2.RATE_LIMIT, "subscribe", ip, { max: 10, windowMs: 36e5 });
  if (!rl.allowed) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429, {
      "Retry-After": String(rl.retryAfter || 3600)
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const email = body.email?.toLowerCase().trim();
  if (!email || !validateEmail(email)) {
    return jsonResponse({ ok: false, error: "invalid_email" }, 400);
  }
  const source = body.source || "newsletter";
  const consentMarketing = body.consent_marketing === true ? 1 : 0;
  const consentTransactional = body.consent_transactional === true ? 1 : 0;
  const now = Date.now();
  try {
    const existing = await env2.DB.prepare(
      `SELECT id, status FROM botwow_emails WHERE email = ?`
    ).bind(email).first();
    if (existing) {
      if (existing.status === "subscribed") {
        return jsonResponse({ ok: true, message: "Déjà inscrit.", email }, 200);
      }
      await env2.DB.prepare(`
        UPDATE botwow_emails SET status = 'subscribed', unsubscribed_at = NULL,
          subscribed_at = ?, consent_marketing = ?, consent_transactional = ?, source = ?
        WHERE email = ?
      `).bind(now, consentMarketing, consentTransactional, source, email).run();
      return jsonResponse({ ok: true, message: "Inscription réactivée.", email }, 200);
    }
    await env2.DB.prepare(`
      INSERT INTO botwow_emails (email, source, consent_marketing, consent_transactional, subscribed_at, status, ip)
      VALUES (?, ?, ?, ?, ?, 'subscribed', ?)
    `).bind(email, source, consentMarketing, consentTransactional, now, ip).run();
    return jsonResponse({ ok: true, message: "Inscription enregistrée.", email }, 200);
  } catch (error) {
    console.error("Subscribe error:", error);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }
}
__name(handleSubscribe, "handleSubscribe");
async function handleClaim(request, env2) {
  // FIX 2026-10-21 (audit paiement) : ce canal creait une licence A VIE
  // GRATUITE pour n'importe quel e-mail (10/h/IP). Il est incompatible avec
  // l'offre unique payante (20 EUR) et constituait une livraison sans
  // paiement. Il est desactive : seule la boutique (/api/checkout) delivre.
  return jsonResponse({ ok: false, error: "claim_disabled" }, 410, {});
  // NOTE 2026-10-23 : le corps historique de cette fonction (creation
  // d'une licence gratuite, generation d'identifiant par MAX(id)+1) a ete
  // SUPPRIME. Il etait inatteignable depuis le 410 ci-dessus, et sa
  // generation numerique d'identifiant de commande est desormais
  // incompatible avec le schema TEXT de migrations/production/0004.
  // Seule la boutique (/api/checkout) et le parcours Bitcoin delivrent.
}
__name(handleClaim, "handleClaim");
async function handleActivate(request, env2) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(env2.RATE_LIMIT, "activate", ip, RATE_LIMITS.activate);
  if (!rl.allowed) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429, {
      "Retry-After": String(rl.retryAfter || 300)
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  const key = body.key?.toUpperCase().trim();
  const machineId = body.machine_id?.trim();
  if (!key || !machineId) {
    return jsonResponse({ ok: false, error: "missing_params" }, 400);
  }
  if (!key.startsWith(LICENSE_KEY_PREFIX) || key.split("-").length !== 5) {
    return jsonResponse({ ok: false, error: "invalid_key" });
  }
  try {
    const licenseResult = await env2.DB.prepare(`
      SELECT * FROM licenses WHERE key = ?
    `).bind(key).first();
    if (!licenseResult) {
      return jsonResponse({ ok: false, error: "invalid_key" });
    }
    if (licenseResult.status !== "active") {
      return jsonResponse({ ok: false, error: "revoked" });
    }
    const existingActivation = await env2.DB.prepare(`
      SELECT id FROM activations WHERE license_id = ? AND machine_id = ?
    `).bind(licenseResult.id, machineId).first();
    if (!existingActivation) {
      const countResult = await env2.DB.prepare(`
        SELECT COUNT(*) as cnt FROM activations WHERE license_id = ?
      `).bind(licenseResult.id).first();
      if ((countResult?.cnt || 0) >= licenseResult.max_activations) {
        return jsonResponse({ ok: false, error: "max_activations" });
      }
      const now = Date.now();
      const activationInsert = await env2.DB.prepare(`
        INSERT INTO activations (license_id, machine_id, ip, user_agent, activated_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        licenseResult.id,
        machineId,
        ip,
        request.headers.get("user-agent") || null,
        now,
        now
      ).run();
      // EVENEMENT SERVEUR : PREMIERE activation de cette licence sur cette
      // machine. C'est la derniere etape du funnel (demo -> intention ->
      // checkout -> paiement confirme -> licence -> livraison -> ACTIVATION)
      // et elle n'etait mesuree NULLE PART : la table `activations` restait
      // vide sans evenement correlatif, et aucune conversion ne pouvait
      // etre reliee a un usage reel du produit.
      // `ref` = id de la ligne d'activation (unique, non sensible) : la
      // revalidation d'une machine deja activee ne rejoue PAS l'evenement.
      await emitFunnelEvent(env2, 'activation', null, '/api/activate',
        validateLang2(licenseResult.lang || "en"), {
          step: 'activation',
          ref: 'act_' + (activationInsert && activationInsert.meta ? activationInsert.meta.last_row_id : 0),
        });
    } else {
      await env2.DB.prepare(`
        UPDATE activations SET last_seen_at = ? WHERE id = ?
      `).bind(Date.now(), existingActivation.id).run();
    }
    const token = await signActivation(key, machineId, env2.LICENSE_SECRET);
    return jsonResponse({
      ok: true,
      status: "active",
      token
    });
  } catch (error) {
    console.error("Activate error:", error);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }
}
__name(handleActivate, "handleActivate");
async function handleDownload(request, env2) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  if (!token) {
    return jsonResponse({ ok: false, error: "missing_token" }, 400);
  }
  const ip = getClientIp(request);
  const rl = await checkRateLimit(env2.RATE_LIMIT, "download", ip, RATE_LIMITS.download);
  if (!rl.allowed) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429, {
      "Retry-After": String(rl.retryAfter || 3600)
    });
  }
  try {
    const result = await env2.DB.prepare(`
      SELECT d.*, l.status as lic_status, l.key as license_key
      FROM downloads d
      JOIN licenses l ON l.id = d.license_id
      WHERE d.token = ?
    `).bind(token).first();
    if (!result) {
      return jsonResponse({ ok: false, error: "invalid" }, 404);
    }
    if (result.lic_status !== "active") {
      return jsonResponse({ ok: false, error: "revoked" }, 403);
    }
    const now = Date.now();
    if (now > result.expires_at) {
      return jsonResponse({ ok: false, error: "expired" }, 410);
    }
    if (result.count >= result.max_count) {
      return jsonResponse({ ok: false, error: "limit_reached" }, 429);
    }
    await env2.DB.prepare(`
      UPDATE downloads SET count = count + 1 WHERE token = ?
    `).bind(token).run();
    // FIX 2026-10-21 : le nom de l'objet R2 etait fige dans le code
    // ("Casinobabe-v1.0.38.zip"), alors que le paquet livre est versionne
    // (casinobabe-fishing-<version>.zip). On tente la version configuree,
    // puis la version courante du paquet, puis l'ancien nom (repli).
    const candidates = [
      env2.R2_OBJECT_KEY,
      "casinobabe-fishing-1.2.0.zip",
      "Casinobabe-v1.0.38.zip"
    ].filter(Boolean);
    let objectKey = candidates[0];
    let r2Object = null;
    for (const key of candidates) {
      const obj = await env2.R2_BINARIES.get(key);
      if (obj) {
        objectKey = key;
        r2Object = obj;
        break;
      }
    }
    if (!r2Object) {
      console.error("R2 object not found. Tried:", candidates.join(", "));
      return jsonResponse({ ok: false, error: "file_not_found" }, 404);
    }
    const headers = new Headers({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Casinobabe-v1.0.38.zip"`,
      "Cache-Control": "private, max-age=3600"
    });
    return new Response(r2Object.body, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error("Download error:", error);
    return jsonResponse({ ok: false, error: "server_error" }, 500);
  }
}
__name(handleDownload, "handleDownload");
async function handleResend(request, env2) {
  const ip = getClientIp(request);
  const [rlIp, rlMail] = await Promise.all([
    checkRateLimit(env2.RATE_LIMIT, "resend-ip", ip, RATE_LIMITS.resendIp),
    checkRateLimit(env2.RATE_LIMIT, "resend-mail", "", RATE_LIMITS.resendMail)
    // email checked after parse
  ]);
  if (!rlIp.allowed) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: true });
  }
  const email = body.email?.toLowerCase().trim();
  if (!email || !validateEmail(email)) {
    return jsonResponse({ ok: true });
  }
  const rlMail2 = await checkRateLimit(env2.RATE_LIMIT, "resend-mail", email, RATE_LIMITS.resendMail);
  if (!rlMail2.allowed) {
    return jsonResponse({ ok: true });
  }
  try {
    const license = await env2.DB.prepare(`
      SELECT l.key, l.lang, l.status, d.token
      FROM licenses l
      LEFT JOIN downloads d ON d.license_id = l.id
      WHERE l.email = ? AND l.status = 'active'
      ORDER BY l.id DESC LIMIT 1
    `).bind(email).first();
    if (license && license.token) {
      const downloadUrl = `https://api.bot-wow.com/api/download?t=${license.token}`;
      await sendDeliveryEmail(env2, email, license.key, downloadUrl, license.lang || DEFAULT_LANG);
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Resend endpoint failed");
    return jsonResponse({ ok: true });
  }
}
__name(handleResend, "handleResend");
async function sendDeliveryEmail(env2, email, key, downloadUrl, lang) {
  console.log("[EMAIL] Legacy resend path reached; provider delivery is not implemented");
}
__name(sendDeliveryEmail, "sendDeliveryEmail");
async function sendAdminNotification(env2, email, key) {
  console.log("[ADMIN] Registration notification helper reached");
}
__name(sendAdminNotification, "sendAdminNotification");
function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "https://bot-wow.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extraHeaders
  });
  return new Response(JSON.stringify(data), { status, headers });
}
__name(jsonResponse, "jsonResponse");

// src/mollie.ts
import { createHmac } from "crypto";
var MOLLIE_API_BASE = "https://api.mollie.com/v2";
var PRODUCT_METADATA_KEY = "bot-wow-lifetime";
// Rate limit du checkout : 5 tentatives par IP toutes les 5 minutes.
// Valeur restauree (2026-10-21, audit V9) : la version locale avait ete
// remontee a 100 pendant le debogage Mollie, ce qui autorisait 1200 creations
// de paiement par heure et par IP. Chaque appel cree un vrai objet de
// paiement Mollie : c'est a la fois un cout et un vecteur d'abus.
// References voisines dans le meme Worker :
//   BITCOIN_CHECKOUT_RATE_LIMIT = 3 / 5 min
//   RATE_LIMITS.subscribe        = 10 / heure
//   RATE_LIMITS.download         = 20 / heure
// Reponse en cas de depassement : 429 + Retry-After (voir handleCheckout).
var CHECKOUT_RATE_LIMIT = { max: 5, windowMs: 3e5 };
// Mapping langue du site -> locale Mollie.
// Source : liste officielle des `locale` acceptes par l'API Mollie
// (POST /customers et POST /payments) :
//   ca_ES cs_CZ da_DK de_AT de_CH de_DE de_LU el_GR en_BE en_GB en_NL en_US
//   es_ES fi_FI fr_BE fr_FR fr_LU hu_HU is_IS it_IT lt_LT lv_LV nb_NO nl_BE
//   nl_NL pl_PL pt_PT sk_SK sl_SI sv_SE tr_TR
// Les codes courts ("en", "fr"...) ne sont PAS acceptes par l'API : il faut
// une locale ISO 15897 "xx_XX". `ru` n'a pas de page hebergee Mollie : on
// retombe sur en_US plutot que d'envoyer une valeur invalide (422).
var MOLLIE_LOCALES = {
  fr: "fr_FR",
  en: "en_US",
  de: "de_DE",
  es: "es_ES",
  pt: "pt_PT"
};
var MOLLIE_LOCALE_FALLBACK = "en_US";
function toMollieLocale(lang) {
  return MOLLIE_LOCALES[String(lang || "").toLowerCase()] || MOLLIE_LOCALE_FALLBACK;
}
// FIX 2026-10-21 : le TARIF est fixe COTE SERVEUR.
// Avant, le montant venait du navigateur (`body.amount || 2e3`) : un client
// pouvait demander un montant arbitraire (y compris 1,00 EUR) et c'etait le
// serveur qui debitait. Le navigateur n'envoie plus que l'e-mail et la langue.
var PRICE_TABLE = {
  "bot-wow-lifetime": { amount: 2000, currency: "EUR", description: "BOT-WOW — Accès à vie" }
};
var CANONICAL_REDIRECT_URL = "https://bot-wow.com/success.html";
var CANONICAL_CANCEL_URL = "https://bot-wow.com/cancel.html";
var CANONICAL_WEBHOOK_URL = "https://api.bot-wow.com/api/mollie-webhook";
async function handleCheckout(request, env2) {
  const ip = getClientIp2(request);
  const rl = await checkRateLimit2(env2.RATE_LIMIT, "checkout", ip, CHECKOUT_RATE_LIMIT);
  if (!rl.allowed) {
    return jsonResponse2({ ok: false, error: "rate_limited" }, 429, {
      "Retry-After": String(rl.retryAfter || 300)
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse2({ ok: false, error: "invalid_json" }, 400);
  }
  const email = body.email?.toLowerCase().trim();
  const lang = validateLang2(body.lang || "fr");
  // FIX 2026-10-21 : prix, devise, produit et URL de retour sont decides
  // par le serveur. Le montant venant du navigateur est ignore, et refuse
  // explicitement s'il ne correspond pas a la reference.
  const plan = PRICE_TABLE[PRODUCT_METADATA_KEY];
  const amount = plan.amount;
  const currency = plan.currency;
  const redirectUrl = CANONICAL_REDIRECT_URL;
  const webhookUrl = CANONICAL_WEBHOOK_URL;
  if (!email || !validateEmail2(email)) {
    return jsonResponse2({ ok: false, error: "invalid_email" }, 400);
  }
  if (body.amount !== void 0 && Number(body.amount) !== amount) {
    console.warn("Checkout: montant demande par le client refuse", body.amount, "attendu", amount);
    return jsonResponse2({ ok: false, error: "invalid_amount" }, 400);
  }
  const rawJourneyId = body.journey_id;
  const journeyId = typeof rawJourneyId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(rawJourneyId) ? rawJourneyId : null;
  try {
    const customer = await getOrCreateMollieCustomer(env2, email, lang);
    const payment = await createMolliePayment(env2, {
      customerId: customer.id,
      amount: { value: (amount / 100).toFixed(2), currency },
      description: plan.description,
      redirectUrl,
      cancelUrl: CANONICAL_CANCEL_URL,
      webhookUrl,
      metadata: {
        email,
        lang,
        product: PRODUCT_METADATA_KEY,
        journey_id: journeyId || ""
      }
    });
    // Evenement serveur : commande de paiement creee (cote serveur, montant
    // verifie). Ne confirme pas un paiement reussi : seule la notification
    // webhook Mollie peut confirmer.
    await emitFunnelEvent(env2, 'checkout_created', journeyId, '/api/checkout', lang, { step: 'checkout_created' });
    return jsonResponse2({
      paymentId: payment.id,
      checkoutUrl: payment._links?.checkout?.href || `https://www.mollie.com/payscreen/${payment.id}`,
      expiresAt: new Date(Date.now() + 30 * 6e4).toISOString()
      // 30 min
    });
  } catch (error) {
    console.error("Checkout error:", error);
    if (error instanceof Response) return error;
    // Evenement serveur : echec de creation du paiement.
    await emitFunnelEvent(env2, 'checkout_failed', journeyId, '/api/checkout', lang, { step: 'checkout_failed' });
    return jsonResponse2({ ok: false, error: "checkout_failed", detail: error && error.message }, 500);
  }
}
__name(handleCheckout, "handleCheckout");
async function handleMollieWebhook(request, env2) {
  // PROTOCOLE : webhook classique de la Payments API Mollie.
  // Mollie envoie un POST dont le corps contient `id=tr_xxx` ; on interroge
  // l'API avec la cle serveur pour obtenir l'etat REEL du paiement. La
  // signature HMAC (autre format de webhook) n'est pas exigee : si elle est
  // presente et que le secret est configure, elle est verifiee en
  // complement (une verification supplementaire, jamais la source de verite).
  let payload;
  try {
    payload = await request.text();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const signature = request.headers.get("Mollie-Signature");
  if (signature && env2.MOLLIE_WEBHOOK_SECRET) {
    if (!verifyMollieSignature(payload, signature, env2.MOLLIE_WEBHOOK_SECRET)) {
      console.error("Invalid webhook signature");
      return new Response("Invalid Signature", { status: 401 });
    }
  }
  let event = null;
  try {
    event = JSON.parse(payload);
  } catch {
    event = null;
  }
  let paymentId = null;
  if (event && typeof event === "object") {
    paymentId = event.id || event.payload?.id || (typeof event.data?.id === "string" ? event.data.id : null);
  }
  if (!paymentId) {
    try {
      paymentId = new URLSearchParams(payload).get("id");
    } catch {
      paymentId = null;
    }
  }
  if (!paymentId) {
    console.error("Webhook: aucun identifiant de paiement recu");
    return new Response("Missing payment ID", { status: 400 });
  }
  let payment;
  try {
    payment = await fetchMolliePayment(env2, paymentId, true);
  } catch (e) {
    console.error("Webhook: lecture du paiement impossible", e && e.message);
    return new Response("Server Error", { status: 500 });
  }
  if (!payment || !payment.id) {
    console.error(`Webhook: paiement ${paymentId} introuvable via l'API`);
    return new Response("OK", { status: 200 });
  }
  // DISTINCTION REEL / TEST.
  // L'API Mollie renvoie `mode` = "live" | "test". Un paiement de test ne
  // doit JAMAIS compter comme du chiffre d'affaires. Regle fail-safe : seul
  // un mode explicitement "test" est marque test=1 ; un mode absent est
  // traite comme un paiement reel (on ne perd jamais une vente mesuree).
  const paymentMode = String(payment.mode || "").toLowerCase();
  const isTestPayment = paymentMode === "test";
  if (payment.metadata?.product !== PRODUCT_METADATA_KEY) {
    console.log(`Webhook: Ignoring payment ${paymentId} - not our product`);
    return new Response("OK", { status: 200 });
  }
  // VERIFICATION REELLE : montant, devise, produit, statut.
  const plan = PRICE_TABLE[PRODUCT_METADATA_KEY];
  const paidAmount = Math.round(parseFloat(payment.amount?.value || "0") * 100);
  const paidCurrency = String(payment.amount?.currency || "").toUpperCase();
  if (paidAmount !== plan.amount || paidCurrency !== plan.currency) {
    console.error(`Webhook: montant inattendu pour ${paymentId}: ${paidAmount} ${paidCurrency} (attendu ${plan.amount} ${plan.currency})`);
    return new Response("Amount mismatch", { status: 400 });
  }
  const email = String(payment.metadata?.email || "").toLowerCase();
  const lang = validateLang2(payment.metadata?.lang || "fr");
  if (!email) {
    console.error("Webhook: aucun e-mail dans les metadonnees du paiement");
    return new Response("Missing email", { status: 400 });
  }
  const status = String(payment.status || "");
  // FIX 2026-10-21 : un remboursement ou une contestation doit revoquer la
  // licence liee — AVANT le garde statut-ouvert (sinon jamais traitee).
  if (status === "refunded" || status === "charged_back") {
    await revokeLicense(env2, payment, email, `refund:${paymentId}`);
    return new Response("OK", { status: 200 });
  }
  if (status !== "paid" && status !== "failed" && status !== "expired" && status !== "canceled") {
    // open / pending : rien a faire, la confirmation suivra.
    console.log(`Webhook: paiement ${paymentId} statut=${status} (en attente)`);
    return new Response("OK", { status: 200 });
  }
  // GARDE-FOU D'IDEMPOTENCE : l'insertion de l'evenement est atomique et
  // sert de verrou. Deux notifications simultanees ne peuvent donc pas creer
  // deux licences. La cle est l'identifiant du paiement (stable quel que
  // soit le type d'evenement).
  const eventId = `payment:${paymentId}`;
  try {
    await env2.DB.prepare(
      "INSERT INTO webhook_events (id, provider, processed_at) VALUES (?, 'mollie', ?)"
    ).bind(eventId, Date.now()).run();
  } catch (e) {
    const msg = String(e && e.message || "");
    if (/UNIQUE|constraint/i.test(msg)) {
      console.log(`Webhook: paiement ${paymentId} deja traite, ignore`);
      return new Response("OK", { status: 200 });
    }
    console.error("Webhook: insertion de l'evenement impossible", msg);
    return new Response("Server Error", { status: 500 });
  }
  // Le journey_id opaque est transmis dans les métadonnées Mollie du checkout.
  // On le récupère ici sans lecture KV supplémentaire.
  const rawJourneyId = payment.metadata?.journey_id;
  const journeyId = typeof rawJourneyId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(rawJourneyId) ? rawJourneyId : null;
  let paymentRef = null;
  try {
    paymentRef = await hashPaymentReference(payment.id);
  } catch {
    // La télémétrie reste facultative : une erreur de hachage ne bloque pas le webhook.
  }
  // FIX 2026-10-21 (audit paiement) : un remboursement ou une contestation
  // doit revoquer la licence liee (le signal existait mais n'etait jamais
  // branche sur le flux du webhook).
  if (status === "paid") {
    await fulfillOrder(env2, payment, email, lang, eventId, journeyId, paymentRef, isTestPayment);
    // Evenement serveur : paiement confirme par Mollie (etat verifie via API).
    // Ecris APRÈS fulfillOrder pour ne rien ecrire si la livraison echoue
    // (schema de production avec orders.id INTEGER -> datatype mismatch).
    await emitFunnelEvent(env2, 'payment_confirmed', journeyId, '/api/mollie-webhook', lang, { step: 'payment_confirmed', ref: paymentRef, test: isTestPayment ? 1 : 0 });
    // MESURE DE CONVERSION (V11.2).
    // Cette ligne n'est ecrite QUE par le serveur, apres verification du
    // paiement via l'API Mollie. Un clic, une ouverture de checkout et un
    // paiement confirme restent donc trois evenements distincts, et un
    // evenement "conversion" ne peut pas etre forge depuis le navigateur
    // (le point de collecte public ne l'accepte pas).
    // L'echec de cette mesure ne doit JAMAIS empecher la livraison de la
    // licence : l'echec est attrape et journalise.
    try {
      await recordConversion(env2, payment, email, lang, isTestPayment);
    } catch (e) {
      console.error("Webhook: mesure de conversion impossible", String(e && e.message || ""));
    }
  } else {
    await markOrderFailed(env2, payment, email, eventId, journeyId, lang, paymentRef);
  }
  return new Response("OK", { status: 200 });
}
__name(handleMollieWebhook, "handleMollieWebhook");
/**
 * Enregistre une CONVERSION confirmee dans la base de telemetrie.
 *
 * - Ecrit uniquement par le serveur, apres que le paiement a ete verifie
 *   (montant, devise, produit, statut) via l'API Mollie ;
 * - aucune donnee personnelle : ni e-mail, ni nom, ni montant detaille.
 *   Seul un hash tronque de l'identifiant de paiement est conserve, pour
 *   rapprocher un evenement d'une commande sans exposer l'identifiant ;
 * - la base de telemetrie est une base D1 DEDIEE, distincte de la base des
 *   commandes : elle ne contient ni e-mail, ni licence, ni jeton ;
 * - si la base est absente ou en erreur, l'echec est silencieux : la
 *   livraison de la licence ne doit jamais dependre de la mesure.
 */
async function hashPaymentReference(paymentId) {
  const normalizedId = String(paymentId || "");
  if (!normalizedId) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("botwow-conversion-v1|" + normalizedId));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
__name(hashPaymentReference, "hashPaymentReference");
async function recordConversion(env2, payment, email, lang, isTest) {
  const db = env2.TELEMETRY_DB;
  if (!db) return;
  const amount = Math.round(parseFloat(payment.amount.value) * 100) / 100;
  const paymentId = String(payment.id || "");
  const ref = await hashPaymentReference(paymentId);
  // value_eur reste NULL pour un paiement de test : une somme naive ne
  // peut donc jamais compter un test comme du revenu, meme si l'on oublie
  // de filtrer sur `test = 0`.
  await db.prepare(
    "INSERT INTO events (ts, event, page, lang, cta, mode, years, step, ref, test, ip_hash, ua, value_eur, source) " +
    "VALUES (?, 'conversion', '/', ?, NULL, NULL, NULL, 'paid', ?, ?, NULL, NULL, ?, ?)"
  ).bind(Date.now(), lang === "fr" ? "fr" : "en", ref, isTest ? 1 : 0, isTest ? null : amount, "mollie").run();
  console.log("Conversion enregistree", ref, amount);
}

/**
 * Ecrit un evenement d'entonnoir (funnel) dans la base de telemetrie.
 * N'est jamais bloquant : toute echec est silencieux. Le champ journey_id
 * lie les evenements d'une meme session sans exposer de donnee personnelle.
 * Si la colonne journey_id n'existe pas encore (migration 0003 non appliquee),
 * l'insertion est rejouee sans elle.
 */
async function emitFunnelEvent(env2, event, journey_id, page, lang, extra) {
  const db = env2.TELEMETRY_DB;
  if (!db) return;
  const insertFull = (
    'INSERT INTO events (ts, event, page, lang, cta, mode, years, step, ref, test, ip_hash, ua, journey_id) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertLite = (
    'INSERT INTO events (ts, event, page, lang, cta, mode, years, step, ref, test, ip_hash, ua) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const bindFull = [
    Date.now(), event, page || '/', lang || 'fr',
    extra && extra.cta ? extra.cta : null,
    null, null,
    extra && extra.step ? extra.step : null,
    extra && extra.ref ? extra.ref : null,
    extra && extra.test ? 1 : 0, null, 'server',
    journey_id || null,
  ];
  const bindLite = [
    Date.now(), event, page || '/', lang || 'fr',
    extra && extra.cta ? extra.cta : null,
    null, null,
    extra && extra.step ? extra.step : null,
    extra && extra.ref ? extra.ref : null,
    extra && extra.test ? 1 : 0, null, 'server',
  ];
  try {
    await db.prepare(insertFull).bind(...bindFull).run();
  } catch {
    try {
      await db.prepare(insertLite).bind(...bindLite).run();
    } catch {
      // La collecte d'entonnoir est meilleure effort : on n'arrete jamais
      // le parcours de paiement pour une erreur de telemetrie.
    }
  }
}

async function fulfillOrder(env2, payment, email, lang, eventId, journeyId, paymentRef, isTestPayment) {
  const now = Date.now();
  const amount = Math.round(parseFloat(payment.amount.value) * 100);
  // FIX 2026-10-21 : la commande porte un identifiant TEXT explicite.
  // Avant, `id` n'etait pas insere (colonne TEXT PRIMARY KEY => NULL) et la
  // licence pointait sur `meta.last_row_id` (un nombre) : la jointure
  // orders <-> licenses ne pouvait donc jamais aboutir.
  const orderId = `ord_${payment.id}`;
  await env2.DB.prepare(`
    INSERT INTO orders (id, provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at)
    VALUES (?, 'mollie', ?, ?, ?, ?, 'paid', ?, ?, ?)
  `).bind(
    orderId,
    payment.id,
    email,
    amount,
    payment.amount.currency,
    JSON.stringify({ lang, product: PRODUCT_METADATA_KEY, mollie: payment }),
    now,
    now
  ).run();
  const licenseKey = generateLicenseKey2();
  const licenseResult = await env2.DB.prepare(`
    INSERT INTO licenses (key, order_id, email, lang, status, max_activations, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
  `).bind(licenseKey, orderId, email, lang, 2, now, now).run();
  const licenseId = licenseResult.meta.last_row_id;
  const downloadToken = generateToken2();
  await env2.DB.prepare(`
    INSERT INTO downloads (token, license_id, expires_at, count, max_count, created_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).bind(
    downloadToken,
    licenseId,
    now + 30 * 864e5,
    10,
    now
  ).run();
  const downloadUrl = `https://api.bot-wow.com/api/download?t=${downloadToken}`;
  await sendDeliveryEmail2(env2, email, licenseKey, downloadUrl, lang, journeyId, isTestPayment);
  await sendAdminNotification2(env2, email, licenseKey, amount);
  console.log(`Order fulfilled: ${payment.id}`);
  // Evenement serveur : licence creee et liee a la commande payee.
  await emitFunnelEvent(env2, 'license_created', journeyId, '/api/mollie-webhook', lang, { step: 'license_created', ref: paymentRef, test: isTestPayment ? 1 : 0 });
}
__name(fulfillOrder, "fulfillOrder");
async function markOrderFailed(env2, payment, email, eventId, journeyId, lang, paymentRef) {
  const now = Date.now();
  const amount = Math.round(parseFloat(payment.amount.value) * 100);
  await env2.DB.prepare(`
    INSERT INTO orders (id, provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at)
    VALUES (?, 'mollie', ?, ?, ?, ?, 'failed', ?, ?, ?)
  `).bind(
    `ord_${payment.id}`,
    payment.id,
    email,
    amount,
    payment.amount.currency,
    JSON.stringify({ mollie: payment }),
    now,
    now
  ).run();
  console.log(`Order failed: ${payment.id}`);
  // Evenement serveur : echec de paiement confirme par Mollie.
  await emitFunnelEvent(env2, 'checkout_failed', journeyId, '/api/mollie-webhook', lang, { step: 'checkout_failed', ref: paymentRef });
}
__name(markOrderFailed, "markOrderFailed");
async function revokeLicense(env2, payment, email, eventId) {
  const now = Date.now();
  const license = await env2.DB.prepare(`
    SELECT l.id, l.key FROM licenses l
    JOIN orders o ON o.id = l.order_id
    WHERE o.provider = 'mollie' AND o.provider_id = ?
  `).bind(payment.id).first();
  if (license) {
    await env2.DB.batch([
      env2.DB.prepare("UPDATE licenses SET status = ? WHERE id = ?").bind("revoked", license.id),
      env2.DB.prepare("UPDATE orders SET status = ? WHERE provider = ? AND provider_id = ?").bind("refunded", "mollie", payment.id)
    ]);
    console.log(`License revoked for payment ${payment.id}`);
  } else {
    console.log(`No license to revoke for ${payment.id} (refund/chargeback)`);
  }
  // L'evenement de remboursement est journalise meme sans licence associee :
  // ce MARQUEUR rend les rejeux du webhook naturellement sans effet.
  try {
    await env2.DB.prepare("INSERT OR IGNORE INTO webhook_events (id, provider, processed_at) VALUES (?, ?, ?)").bind(eventId, "mollie", now).run();
  } catch (e) {
    console.error("Refund event logging failed:", e && e.message);
  }
}
__name(revokeLicense, "revokeLicense");
async function getOrCreateMollieCustomer(env2, email, locale) {
  const cached = await env2.DB.prepare(
    "SELECT * FROM mollie_customers WHERE email = ?"
  ).bind(email).first();
  if (cached) return cached;
  const response = await mollieFetch(env2, "POST", "/customers", {
    email,
    locale: toMollieLocale(locale),
    metadata: { source: "bot-wow" }
  });
  const customer = response;
  await env2.DB.prepare(`
    INSERT INTO mollie_customers (id, email, locale, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(customer.id, email, locale, JSON.stringify(customer.metadata), Date.now(), Date.now()).run();
  return customer;
}
__name(getOrCreateMollieCustomer, "getOrCreateMollieCustomer");
async function createMolliePayment(env2, params) {
  const body = {
    customerId: params.customerId,
    amount: params.amount,
    description: params.description,
    redirectUrl: params.redirectUrl,
    cancelUrl: params.cancelUrl,
    webhookUrl: params.webhookUrl,
    metadata: params.metadata,
    method: ["creditcard", "ideal", "bancontact", "sofort", "giropay", "eps", "przelewy24"],
    locale: toMollieLocale(params.metadata.lang)
  };
  return mollieFetch(env2, "POST", "/payments", body, true);
}
__name(createMolliePayment, "createMolliePayment");
async function fetchMolliePayment(env2, paymentId, includeProfileId = false) {
  return mollieFetch(env2, "GET", `/payments/${paymentId}`, void 0, includeProfileId);
}
__name(fetchMolliePayment, "fetchMolliePayment");
async function mollieFetch(env2, method, path, body, includeProfileId = false) {
  let url = `${MOLLIE_API_BASE}${path}`;
  if (includeProfileId && env2.MOLLIE_PROFILE_ID) {
    const separator = url.includes("?") ? "&" : "?";
    url += `${separator}profileId=${encodeURIComponent(env2.MOLLIE_PROFILE_ID)}`;
  }
  const headers = {
    "Authorization": `Bearer ${env2.MOLLIE_API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : void 0
  });
  if (!response.ok) {
    const error = await response.text();
    console.error(`Mollie API error (${response.status}):`, error);
    throw new Error(`Mollie API error: ${response.status} - ${error}`);
  }
  return response.json();
}
__name(mollieFetch, "mollieFetch");
function verifyMollieSignature(payload, signatureHeader, secret) {
  try {
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let signature = "";
    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "t") timestamp = value;
      if (key === "v1") signature = value;
    }
    if (!timestamp || !signature) return false;
    const now = Math.floor(Date.now() / 1e3);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      console.warn("Webhook timestamp outside tolerance");
      return false;
    }
    const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    return timingSafeEqual(signature, expected);
  } catch {
    return false;
  }
}
__name(verifyMollieSignature, "verifyMollieSignature");
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
async function checkRateLimit2(kv, bucket, identifier, config2) {
  const now = Date.now();
  const windowStart = now - config2.windowMs;
  const kvKey = `ratelimit:${bucket}:${identifier}`;
  try {
    const stored = await kv.get(kvKey, { type: "json" });
    if (!stored || stored.resetAt < now) {
      await kv.put(kvKey, JSON.stringify({ count: 1, resetAt: now + config2.windowMs }), {
        expirationTtl: Math.ceil(config2.windowMs / 1e3) + 60
      });
      return { allowed: true };
    }
    if (stored.count >= config2.max) {
      const retryAfter = Math.ceil((stored.resetAt - now) / 1e3);
      return { allowed: false, retryAfter };
    }
    stored.count++;
    await kv.put(kvKey, JSON.stringify(stored), {
      expirationTtl: Math.ceil(config2.windowMs / 1e3) + 60
    });
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}
__name(checkRateLimit2, "checkRateLimit");
function generateLicenseKey2() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let group = "";
    for (let i = 0; i < 5; i++) {
      group += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    groups.push(group);
  }
  return "BOTW-" + groups.join("-");
}
__name(generateLicenseKey2, "generateLicenseKey");
function generateToken2(bytes = 24) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(generateToken2, "generateToken");
function validateEmail2(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
__name(validateEmail2, "validateEmail");
function validateLang2(lang) {
  const supported = ["fr", "en", "de", "es", "pt", "ru"];
  return supported.includes(lang.toLowerCase()) ? lang.toLowerCase() : "fr";
}
__name(validateLang2, "validateLang");
function getClientIp2(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
__name(getClientIp2, "getClientIp");
async function sendDeliveryEmail2(env2, email, key, downloadUrl, lang, journeyId, isTestPayment) {
  // FIX 2026-10-21 : la livraison etait un simple console.log -> le client
  // ne recevait JAMAIS sa cle. On envoie reellement l'e-mail si une cle
  // d'envoi est configuree (Resend), sinon on conserve la commande et la
  // licence en base (table deliveries) pour un rejeu, sans jamais la
  // dupliquer.
  const subject = lang === "en" ? "Your BOT-WOW licence and download link" : "Votre licence BOT-WOW et votre lien de téléchargement";
  const text = lang === "en" ? [
    "Thank you for your purchase.",
    "",
    "Licence key: " + key,
    "Download: " + downloadUrl,
    "",
    "Installation guide: https://bot-wow.com/docs/install.html",
    "Support: support@bot-wow.com",
    "",
    "The download link is limited in time and in number of downloads."
  ].join("\n") : [
    "Merci pour votre achat.",
    "",
    "Cle de licence : " + key,
    "Telechargement : " + downloadUrl,
    "",
    "Guide d'installation : https://bot-wow.com/docs/install.html",
    "Support : support@bot-wow.com",
    "",
    "Le lien de telechargement est limite dans le temps et en nombre de downloads."
  ].join("\n");
  const html = "<p>Merci pour votre achat.</p>"
    + "<p><b>Cle de licence :</b> <code>" + key + "</code></p>"
    + "<p><b>Lien de telechargement :</b> <a href=\"" + downloadUrl + "\">" + downloadUrl + "</a></p>"
    + "<p>Guide d'installation : <a href=\"https://bot-wow.com/docs/install.html\">bot-wow.com/docs/install.html</a></p>"
    + "<p>Support : support@bot-wow.com</p>";
  const status = await sendEmail2(env2, email, subject, text, html);
  if (!status.sent) {
    console.error("[EMAIL] Envoi impossible (" + status.reason + ") - livraison consignee en base pour rejeu");
    try {
      await env2.DB.prepare(`
        INSERT INTO deliveries (email, subject, body, kind, status, created_at)
        VALUES (?, ?, ?, 'delivery', 'pending', ?)
      `).bind(email, subject, text, Date.now()).run();
    } catch (e) {
      console.error("[EMAIL] consignation impossible:", e && e.message);
    }
    // Evenement serveur : echec de livraison e-mail.
    await emitFunnelEvent(env2, 'delivery_failed', journeyId, '/api/mollie-webhook', lang, { step: 'delivery_failed', test: isTestPayment ? 1 : 0 });
  } else {
    // Evenement serveur : licence livree par e-mail.
    await emitFunnelEvent(env2, 'delivery_sent', journeyId, '/api/mollie-webhook', lang, { step: 'delivery_sent', test: isTestPayment ? 1 : 0 });
  }
  return status;
}
__name(sendDeliveryEmail2, "sendDeliveryEmail2");
async function sendEmail2(env2, to, subject, text, html) {
  const apiKey = env2.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "aucun secret RESEND_API_KEY configure" };
  }
  const from = env2.MAIL_FROM || "BOT-WOW <licences@bot-wow.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, html })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[EMAIL] Resend rejected delivery", res.status);
      return { sent: false, reason: "resend_" + res.status };
    }
    const data = await res.json().catch(() => ({}));
    console.log("[EMAIL] Resend accepted provider message", data && data.id ? { providerMessageId: data.id } : {});
    return { sent: true, id: data && data.id };
  } catch (e) {
    console.error("[EMAIL] echec reseau", e && e.message);
    return { sent: false, reason: "network" };
  }
}
__name(sendEmail2, "sendEmail2");
__name(sendDeliveryEmail2, "sendDeliveryEmail");
async function sendAdminNotification2(env2, email, key, amount) {
  console.log("[ADMIN] Paid order recorded");
}
__name(sendAdminNotification2, "sendAdminNotification");
function jsonResponse2(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "https://bot-wow.com",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...extraHeaders
    }
  });
}
__name(jsonResponse2, "jsonResponse");

// src/bitcoin.ts
var PRODUCT_METADATA_KEY2 = "bot-wow-lifetime";
var PRICE_EUR = 2e3;
var PRICE_EUR_STR = "20.00";
var BITCOIN_CHECKOUT_RATE_LIMIT = { max: 3, windowMs: 3e5 };
async function handleBitcoinCheckout(request, env2) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(env2.RATE_LIMIT, "bitcoin-checkout", ip, BITCOIN_CHECKOUT_RATE_LIMIT);
  if (!rl.allowed) {
    return jsonResponse3({ ok: false, error: "rate_limited" }, 429, {
      "Retry-After": String(rl.retryAfter || 300)
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse3({ ok: false, error: "invalid_json" }, 400);
  }
  const email = body.email?.toLowerCase().trim();
  const lang = validateLang(body.lang || "fr");
  if (!email || !validateEmail(email)) {
    return jsonResponse3({ ok: false, error: "invalid_email" }, 400);
  }
  try {
    const now = Date.now();
    const orderReference = `BTC-${generateToken(8).toUpperCase()}`;
    const orderResult = await env2.DB.prepare(`
      INSERT INTO orders (id, provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at)
      VALUES (?, 'bitcoin_manual', ?, ?, ?, 'eur', 'pending_payment', ?, ?, ?)
    `).bind(
      // FIX 2026-10-21 (audit paiement) : id TEXT explicite. Sans lui la
      // colonne TEXT PRIMARY KEY recevait NULL (toutes les lignes NULL) et la
      // jointure commandes <-> licences ne pouvait jamais aboutir.
      `ord_bitcoin_manual_${orderReference}`,
      orderReference,
      email,
      PRICE_EUR,
      JSON.stringify({
        lang,
        product: PRODUCT_METADATA_KEY2,
        paymentMethod: "bitcoin"
      }),
      now,
      now
    ).run();
    const orderId = `ord_bitcoin_manual_${orderReference}`;
    const mailtoSubject = encodeURIComponent(`Bot-Wow \u2014 Paiement Bitcoin \u2014 ${orderReference}`);
    const mailtoBody = encodeURIComponent(generatePaymentEmailBody({
      orderReference,
      email,
      product: "Casinobae Addon World of Warcraft",
      priceEur: PRICE_EUR_STR,
      orderId,
      lang
    }));
    const mailtoLink = `mailto:${env2.CONTACT_EMAIL}?subject=${mailtoSubject}&body=${mailtoBody}`;
    // Evenement serveur : commande Bitcoin creee.
    await emitFunnelEvent(env2, 'checkout_created', body.journey_id || null, '/api/bitcoin/checkout', lang, { step: 'checkout_created', ref: orderReference });
    return jsonResponse3({
      ok: true,
      orderId,
      orderReference,
      product: "Casinobae Addon World of Warcraft",
      priceEur: PRICE_EUR_STR,
      priceBtc: "Calculated at payment time (check current BTC/EUR rate)",
      instructions: "Payment instructions including the Bitcoin address will be sent to your email by our support team.",
      mailtoLink,
      message: "Order created. Payment instructions including the Bitcoin address will be sent to your email by our support team."
    });
  } catch (error) {
    console.error("Bitcoin checkout error:", error);
    return jsonResponse3({ ok: false, error: "checkout_failed" }, 500);
  }
}
__name(handleBitcoinCheckout, "handleBitcoinCheckout");
async function handleBitcoinPaidNotification(request, env2) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse3({ ok: false, error: "invalid_json" }, 400);
  }
  const orderReference = body.orderReference?.trim().toUpperCase();
  const txid = body.txid?.trim();
  if (!orderReference) {
    return jsonResponse3({ ok: false, error: "missing_order_reference" }, 400);
  }
  try {
    const order = await env2.DB.prepare(`
      SELECT * FROM orders WHERE provider = 'bitcoin_manual' AND provider_id = ?
    `).bind(orderReference).first();
    if (!order) {
      return jsonResponse3({ ok: false, error: "order_not_found" }, 404);
    }
    if (order.status !== "pending_payment") {
      return jsonResponse3({ ok: false, error: "order_not_pending" }, 400);
    }
    const metadata = order.metadata ? JSON.parse(order.metadata) : {};
    metadata.txid = txid || null;
    metadata.paymentNotifiedAt = Date.now();
    await env2.DB.prepare(`
      UPDATE orders SET metadata = ?, updated_at = ? WHERE id = ?
    `).bind(JSON.stringify(metadata), Date.now(), order.id).run();
    return jsonResponse3({
      ok: true,
      message: "Payment notification received. An admin will verify the payment manually.",
      status: "pending_payment"
    });
  } catch (error) {
    console.error("Bitcoin paid notification error:", error);
    return jsonResponse3({ ok: false, error: "server_error" }, 500);
  }
}
__name(handleBitcoinPaidNotification, "handleBitcoinPaidNotification");
async function handleAdminApproveOrder(request, env2) {
  // FIX 2026-10-21 (audit paiement) : la validation etait atteinte par la route
  // directe SANS authentification (le garde-fou n'existe que dans le catch-all
  // /api/admin/*). Toute personne pouvait marquer une commande payee et creer
  // une licence gratuite. Verification obligatoire ici.
  const auth = await verifyAdminAuth(request, env2);
  if (!auth) {
    return jsonResponse3({ ok: false, error: "unauthorized" }, 401);
  }
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter((p) => p);
  // FIX 2026-10-21 (audit paiement) : les ids de commande sont des TEXT
  // (ordre_*) ; accepter egalement la reference fournisseur (BTC-*) en repli.
  const orderIdRaw = decodeURIComponent(pathParts[pathParts.length - 2] || "");
  if (!orderIdRaw) {
    return jsonResponse3({ ok: false, error: "invalid_order_id" }, 400);
  }
  try {
    const order = await env2.DB.prepare(`
      SELECT * FROM orders
      WHERE id = ?1 OR (provider = 'bitcoin_manual' AND provider_id = ?1)
      LIMIT 1
    `).bind(orderIdRaw).first();
    if (!order) {
      return jsonResponse3({ ok: false, error: "order_not_found" }, 404);
    }
    if (order.provider !== "bitcoin_manual") {
      return jsonResponse3({ ok: false, error: "not_bitcoin_order" }, 400);
    }
    if (order.status !== "pending_payment") {
      return jsonResponse3({ ok: false, error: "order_not_pending" }, 400);
    }
    const now = Date.now();
    const email = order.email;
    const metadata = order.metadata ? JSON.parse(order.metadata) : {};
    const lang = metadata.lang || "fr";
    const licenseKey = generateLicenseKey();
    const licenseResult = await env2.DB.prepare(`
      INSERT INTO licenses (key, order_id, email, lang, status, max_activations, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
    `).bind(licenseKey, order.id, email, lang, 2, now, now).run();
    const licenseId = licenseResult.meta.last_row_id;
    const downloadToken = generateToken();
    await env2.DB.batch([
      env2.DB.prepare(`
        UPDATE orders SET status = 'paid', updated_at = ? WHERE id = ?
      `).bind(now, order.id),
      env2.DB.prepare(`
        INSERT INTO downloads (token, license_id, expires_at, count, max_count, created_at)
        VALUES (?, ?, ?, 0, ?, ?)
      `).bind(
        downloadToken,
        licenseId,
        now + 30 * 864e5,
        10,
        now
      )
    ]);
    const downloadUrl = `https://api.bot-wow.com/api/download?t=${downloadToken}`;
    const deliverySubject = `Bot-Wow \u2014 Votre licence ${licenseKey}`;
    const deliveryBody = generateDeliveryEmailBody({
      licenseKey,
      downloadUrl,
      email,
      lang
    });
    const deliveryMailtoLink = `mailto:${email}?subject=${encodeURIComponent(deliverySubject)}&body=${encodeURIComponent(deliveryBody)}`;
    return jsonResponse3({
      ok: true,
      message: "Order approved. License created. Use the delivery email below to send the license to the customer.",
      licenseKey,
      downloadUrl,
      deliveryEmail: {
        to: email,
        subject: deliverySubject,
        body: deliveryBody,
        mailtoLink: deliveryMailtoLink
      }
    });
  } catch (error) {
    console.error("Admin approve error:", error);
    return jsonResponse3({ ok: false, error: "server_error" }, 500);
  }
}
__name(handleAdminApproveOrder, "handleAdminApproveOrder");
async function handleAdminRejectOrder(request, env2) {
  // FIX 2026-10-21 (audit paiement) : meme garde d'authentification que l'app
  // robation des commandes (la route directe contournait verifierAdminAuth).
  const auth = await verifyAdminAuth(request, env2);
  if (!auth) {
    return jsonResponse3({ ok: false, error: "unauthorized" }, 401);
  }
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter((p) => p);
  const orderIdRaw = decodeURIComponent(pathParts[pathParts.length - 2] || "");
  if (!orderIdRaw) {
    return jsonResponse3({ ok: false, error: "invalid_order_id" }, 400);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    body = { reason: "" };
  }
  try {
    const order = await env2.DB.prepare(`
      SELECT * FROM orders
      WHERE id = ?1 OR (provider = 'bitcoin_manual' AND provider_id = ?1)
      LIMIT 1
    `).bind(orderIdRaw).first();
    if (!order) {
      return jsonResponse3({ ok: false, error: "order_not_found" }, 404);
    }
    if (order.provider !== "bitcoin_manual") {
      return jsonResponse3({ ok: false, error: "not_bitcoin_order" }, 400);
    }
    if (order.status !== "pending_payment") {
      return jsonResponse3({ ok: false, error: "order_not_pending" }, 400);
    }
    const now = Date.now();
    await env2.DB.prepare(`
      UPDATE orders SET status = 'rejected', updated_at = ?, metadata = ? WHERE id = ?
    `).bind(
      now,
      JSON.stringify({ ...JSON.parse(order.metadata || "{}"), rejectionReason: body.reason || "Payment not received" }),
      order.id
    ).run();
    return jsonResponse3({ ok: true, message: "Order rejected" });
  } catch (error) {
    console.error("Admin reject error:", error);
    return jsonResponse3({ ok: false, error: "server_error" }, 500);
  }
}
__name(handleAdminRejectOrder, "handleAdminRejectOrder");
async function handleConfigWithBitcoin(env2) {
  return jsonResponse3({
    contactEmail: env2.CONTACT_EMAIL,
    product: PRODUCT_METADATA_KEY2,
    priceEur: PRICE_EUR / 100,
    currency: "eur",
    bitcoin: {
      enabled: true,
      address: null
      // Never expose BTC address in public API
    }
  });
}
__name(handleConfigWithBitcoin, "handleConfigWithBitcoin");
function generatePaymentEmailBody(params) {
  const { orderReference, email, product, priceEur, orderId, lang } = params;
  const templates = {
    fr: {
      subject: `Bot-Wow \u2014 Paiement Bitcoin \u2014 ${orderReference}`,
      body: `Bonjour,

Vous avez command\xE9 : ${product}
Prix : ${priceEur} EUR
R\xE9f\xE9rence commande : ${orderReference}
ID commande : #${orderId}

Pour finaliser votre achat, envoyez l'\xE9quivalent exact de ${priceEur} EUR en Bitcoin \xE0 l'adresse ci-dessous :

Adresse Bitcoin : Sera transmise par email

Montant BTC : V\xE9rifiez le taux de change actuel EUR/BTC au moment du paiement.

IMPORTANT : 
- Indiquez la r\xE9f\xE9rence "${orderReference}" dans le memo de la transaction si possible.
- Envoyez le montant exact en BTC correspondant \xE0 ${priceEur} EUR au taux du moment.

Une fois le paiement effectu\xE9, cliquez sur "J'ai effectu\xE9 le paiement" sur la page de confirmation ou r\xE9pondez \xE0 cet email avec :
- Votre TXID (identifiant de transaction Bitcoin)
- La date/heure du paiement
- Le montant exact envoy\xE9

Un administrateur v\xE9rifiera manuellement le paiement et activera votre licence.

Cordialement,
L'\xE9quipe Bot-Wow
support@bot-wow.com`
    },
    en: {
      subject: `Bot-Wow \u2014 Bitcoin Payment \u2014 ${orderReference}`,
      body: `Hello,

You ordered: ${product}
Price: ${priceEur} EUR
Order Reference: ${orderReference}
Order ID: #${orderId}

To complete your purchase, send the exact equivalent of ${priceEur} EUR in Bitcoin to the address below:

Bitcoin Address: Will be sent via email

BTC Amount: Check the current EUR/BTC exchange rate at time of payment.

IMPORTANT: 
- Include the reference "${orderReference}" in the transaction memo if possible.
- Send the exact BTC amount equivalent to ${priceEur} EUR at the current rate.

Once payment is sent, click "I've made the payment" on the confirmation page or reply to this email with:
- Your TXID (Bitcoin transaction ID)
- Date/time of payment
- Exact amount sent

An admin will manually verify the payment and activate your license.

Best regards,
Bot-Wow Team
support@bot-wow.com`
    }
  };
  const template = templates[lang] || templates.en;
  return template.body;
}
__name(generatePaymentEmailBody, "generatePaymentEmailBody");
function generateDeliveryEmailBody(params) {
  const { licenseKey, downloadUrl, email, lang } = params;
  const templates = {
    fr: {
      subject: `Bot-Wow \u2014 Votre licence ${licenseKey}`,
      body: `Bonjour,

Votre paiement a \xE9t\xE9 v\xE9rifi\xE9 et votre licence est maintenant active.

Licence : ${licenseKey}
Produit : Casinobae Addon World of Warcraft
T\xE9l\xE9chargement : ${downloadUrl}

Cette licence vous donne acc\xE8s \xE0 vie au bot Casinobae pour World of Warcraft.

Pour installer :
1. T\xE9l\xE9chargez le fichier via le lien ci-dessus
2. Extrayez l'archive ZIP
3. Suivez les instructions d'installation incluses

Le lien de t\xE9l\xE9chargement est valable 30 jours et limit\xE9 \xE0 10 t\xE9l\xE9chargements.

En cas de probl\xE8me, contactez-nous \xE0 support@bot-wow.com en mentionnant votre cl\xE9 de licence : ${licenseKey}

Cordialement,
L'\xE9quipe Bot-Wow
support@bot-wow.com`
    },
    en: {
      subject: `Bot-Wow \u2014 Your License ${licenseKey}`,
      body: `Hello,

Your payment has been verified and your license is now active.

License: ${licenseKey}
Product: Casinobae Addon World of Warcraft
Download: ${downloadUrl}

This license gives you lifetime access to the Casinobae bot for World of Warcraft.

To install:
1. Download the file via the link above
2. Extract the ZIP archive
3. Follow the included installation instructions

The download link is valid for 30 days and limited to 10 downloads.

If you encounter any issues, contact us at support@bot-wow.com mentioning your license key: ${licenseKey}

Best regards,
Bot-Wow Team
support@bot-wow.com`
    }
  };
  const template = templates[lang] || templates.en;
  return template.body;
}
__name(generateDeliveryEmailBody, "generateDeliveryEmailBody");
function jsonResponse3(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "https://bot-wow.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extraHeaders
  });
  return new Response(JSON.stringify(data), { status, headers });
}
__name(jsonResponse3, "jsonResponse");

// ../../node_modules/bcryptjs/index.js
import nodeCrypto from "crypto";
var randomFallback = null;
function randomBytes(len) {
  try {
    return crypto.getRandomValues(new Uint8Array(len));
  } catch {
  }
  try {
    return nodeCrypto.randomBytes(len);
  } catch {
  }
  if (!randomFallback) {
    throw Error(
      "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
    );
  }
  return randomFallback(len);
}
__name(randomBytes, "randomBytes");
function genSaltSync(rounds, seed_length) {
  rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof rounds !== "number")
    throw Error(
      "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
    );
  if (rounds < 4) rounds = 4;
  else if (rounds > 31) rounds = 31;
  var salt = [];
  salt.push("$2b$");
  if (rounds < 10) salt.push("0");
  salt.push(rounds.toString());
  salt.push("$");
  salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
  return salt.join("");
}
__name(genSaltSync, "genSaltSync");
function genSalt(rounds, seed_length, callback) {
  if (typeof seed_length === "function")
    callback = seed_length, seed_length = void 0;
  if (typeof rounds === "function") callback = rounds, rounds = void 0;
  if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
  else if (typeof rounds !== "number")
    throw Error("illegal arguments: " + typeof rounds);
  function _async(callback2) {
    nextTick2(function() {
      try {
        callback2(null, genSaltSync(rounds));
      } catch (err) {
        callback2(err);
      }
    });
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(genSalt, "genSalt");
function hash(password, salt, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password === "string" && typeof salt === "number")
      genSalt(salt, function(err, salt2) {
        _hash(password, salt2, callback2, progressCallback);
      });
    else if (typeof password === "string" && typeof salt === "string")
      _hash(password, salt, callback2, progressCallback);
    else
      nextTick2(
        callback2.bind(
          this,
          Error("Illegal arguments: " + typeof password + ", " + typeof salt)
        )
      );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(hash, "hash");
function safeStringCompare(known, unknown) {
  var diff = known.length ^ unknown.length;
  for (var i = 0; i < known.length; ++i) {
    diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
  }
  return diff === 0;
}
__name(safeStringCompare, "safeStringCompare");
function compare(password, hashValue, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password !== "string" || typeof hashValue !== "string") {
      nextTick2(
        callback2.bind(
          this,
          Error(
            "Illegal arguments: " + typeof password + ", " + typeof hashValue
          )
        )
      );
      return;
    }
    if (hashValue.length !== 60) {
      nextTick2(callback2.bind(this, null, false));
      return;
    }
    hash(
      password,
      hashValue.substring(0, 29),
      function(err, comp) {
        if (err) callback2(err);
        else callback2(null, safeStringCompare(comp, hashValue));
      },
      progressCallback
    );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(compare, "compare");
var nextTick2 = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function utf8Length(string) {
  var len = 0, c = 0;
  for (var i = 0; i < string.length; ++i) {
    c = string.charCodeAt(i);
    if (c < 128) len += 1;
    else if (c < 2048) len += 2;
    else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
      ++i;
      len += 4;
    } else len += 3;
  }
  return len;
}
__name(utf8Length, "utf8Length");
function utf8Array(string) {
  var offset = 0, c1, c2;
  var buffer = new Array(utf8Length(string));
  for (var i = 0, k = string.length; i < k; ++i) {
    c1 = string.charCodeAt(i);
    if (c1 < 128) {
      buffer[offset++] = c1;
    } else if (c1 < 2048) {
      buffer[offset++] = c1 >> 6 | 192;
      buffer[offset++] = c1 & 63 | 128;
    } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
      c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
      ++i;
      buffer[offset++] = c1 >> 18 | 240;
      buffer[offset++] = c1 >> 12 & 63 | 128;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    } else {
      buffer[offset++] = c1 >> 12 | 224;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    }
  }
  return buffer;
}
__name(utf8Array, "utf8Array");
var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
var BASE64_INDEX = [
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  1,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  -1,
  -1,
  -1,
  -1,
  -1
];
function base64_encode(b, len) {
  var off2 = 0, rs = [], c1, c2;
  if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
  while (off2 < len) {
    c1 = b[off2++] & 255;
    rs.push(BASE64_CODE[c1 >> 2 & 63]);
    c1 = (c1 & 3) << 4;
    if (off2 >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off2++] & 255;
    c1 |= c2 >> 4 & 15;
    rs.push(BASE64_CODE[c1 & 63]);
    c1 = (c2 & 15) << 2;
    if (off2 >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off2++] & 255;
    c1 |= c2 >> 6 & 3;
    rs.push(BASE64_CODE[c1 & 63]);
    rs.push(BASE64_CODE[c2 & 63]);
  }
  return rs.join("");
}
__name(base64_encode, "base64_encode");
function base64_decode(s, len) {
  var off2 = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
  if (len <= 0) throw Error("Illegal len: " + len);
  while (off2 < slen - 1 && olen < len) {
    code = s.charCodeAt(off2++);
    c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    code = s.charCodeAt(off2++);
    c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c1 == -1 || c2 == -1) break;
    o = c1 << 2 >>> 0;
    o |= (c2 & 48) >> 4;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off2 >= slen) break;
    code = s.charCodeAt(off2++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1) break;
    o = (c2 & 15) << 4 >>> 0;
    o |= (c3 & 60) >> 2;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off2 >= slen) break;
    code = s.charCodeAt(off2++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o = (c3 & 3) << 6 >>> 0;
    o |= c4;
    rs.push(String.fromCharCode(o));
    ++olen;
  }
  var res = [];
  for (off2 = 0; off2 < olen; off2++) res.push(rs[off2].charCodeAt(0));
  return res;
}
__name(base64_decode, "base64_decode");
var BCRYPT_SALT_LEN = 16;
var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
var BLOWFISH_NUM_ROUNDS = 16;
var MAX_EXECUTION_TIME = 100;
var P_ORIG = [
  608135816,
  2242054355,
  320440878,
  57701188,
  2752067618,
  698298832,
  137296536,
  3964562569,
  1160258022,
  953160567,
  3193202383,
  887688300,
  3232508343,
  3380367581,
  1065670069,
  3041331479,
  2450970073,
  2306472731
];
var S_ORIG = [
  3509652390,
  2564797868,
  805139163,
  3491422135,
  3101798381,
  1780907670,
  3128725573,
  4046225305,
  614570311,
  3012652279,
  134345442,
  2240740374,
  1667834072,
  1901547113,
  2757295779,
  4103290238,
  227898511,
  1921955416,
  1904987480,
  2182433518,
  2069144605,
  3260701109,
  2620446009,
  720527379,
  3318853667,
  677414384,
  3393288472,
  3101374703,
  2390351024,
  1614419982,
  1822297739,
  2954791486,
  3608508353,
  3174124327,
  2024746970,
  1432378464,
  3864339955,
  2857741204,
  1464375394,
  1676153920,
  1439316330,
  715854006,
  3033291828,
  289532110,
  2706671279,
  2087905683,
  3018724369,
  1668267050,
  732546397,
  1947742710,
  3462151702,
  2609353502,
  2950085171,
  1814351708,
  2050118529,
  680887927,
  999245976,
  1800124847,
  3300911131,
  1713906067,
  1641548236,
  4213287313,
  1216130144,
  1575780402,
  4018429277,
  3917837745,
  3693486850,
  3949271944,
  596196993,
  3549867205,
  258830323,
  2213823033,
  772490370,
  2760122372,
  1774776394,
  2652871518,
  566650946,
  4142492826,
  1728879713,
  2882767088,
  1783734482,
  3629395816,
  2517608232,
  2874225571,
  1861159788,
  326777828,
  3124490320,
  2130389656,
  2716951837,
  967770486,
  1724537150,
  2185432712,
  2364442137,
  1164943284,
  2105845187,
  998989502,
  3765401048,
  2244026483,
  1075463327,
  1455516326,
  1322494562,
  910128902,
  469688178,
  1117454909,
  936433444,
  3490320968,
  3675253459,
  1240580251,
  122909385,
  2157517691,
  634681816,
  4142456567,
  3825094682,
  3061402683,
  2540495037,
  79693498,
  3249098678,
  1084186820,
  1583128258,
  426386531,
  1761308591,
  1047286709,
  322548459,
  995290223,
  1845252383,
  2603652396,
  3431023940,
  2942221577,
  3202600964,
  3727903485,
  1712269319,
  422464435,
  3234572375,
  1170764815,
  3523960633,
  3117677531,
  1434042557,
  442511882,
  3600875718,
  1076654713,
  1738483198,
  4213154764,
  2393238008,
  3677496056,
  1014306527,
  4251020053,
  793779912,
  2902807211,
  842905082,
  4246964064,
  1395751752,
  1040244610,
  2656851899,
  3396308128,
  445077038,
  3742853595,
  3577915638,
  679411651,
  2892444358,
  2354009459,
  1767581616,
  3150600392,
  3791627101,
  3102740896,
  284835224,
  4246832056,
  1258075500,
  768725851,
  2589189241,
  3069724005,
  3532540348,
  1274779536,
  3789419226,
  2764799539,
  1660621633,
  3471099624,
  4011903706,
  913787905,
  3497959166,
  737222580,
  2514213453,
  2928710040,
  3937242737,
  1804850592,
  3499020752,
  2949064160,
  2386320175,
  2390070455,
  2415321851,
  4061277028,
  2290661394,
  2416832540,
  1336762016,
  1754252060,
  3520065937,
  3014181293,
  791618072,
  3188594551,
  3933548030,
  2332172193,
  3852520463,
  3043980520,
  413987798,
  3465142937,
  3030929376,
  4245938359,
  2093235073,
  3534596313,
  375366246,
  2157278981,
  2479649556,
  555357303,
  3870105701,
  2008414854,
  3344188149,
  4221384143,
  3956125452,
  2067696032,
  3594591187,
  2921233993,
  2428461,
  544322398,
  577241275,
  1471733935,
  610547355,
  4027169054,
  1432588573,
  1507829418,
  2025931657,
  3646575487,
  545086370,
  48609733,
  2200306550,
  1653985193,
  298326376,
  1316178497,
  3007786442,
  2064951626,
  458293330,
  2589141269,
  3591329599,
  3164325604,
  727753846,
  2179363840,
  146436021,
  1461446943,
  4069977195,
  705550613,
  3059967265,
  3887724982,
  4281599278,
  3313849956,
  1404054877,
  2845806497,
  146425753,
  1854211946,
  1266315497,
  3048417604,
  3681880366,
  3289982499,
  290971e4,
  1235738493,
  2632868024,
  2414719590,
  3970600049,
  1771706367,
  1449415276,
  3266420449,
  422970021,
  1963543593,
  2690192192,
  3826793022,
  1062508698,
  1531092325,
  1804592342,
  2583117782,
  2714934279,
  4024971509,
  1294809318,
  4028980673,
  1289560198,
  2221992742,
  1669523910,
  35572830,
  157838143,
  1052438473,
  1016535060,
  1802137761,
  1753167236,
  1386275462,
  3080475397,
  2857371447,
  1040679964,
  2145300060,
  2390574316,
  1461121720,
  2956646967,
  4031777805,
  4028374788,
  33600511,
  2920084762,
  1018524850,
  629373528,
  3691585981,
  3515945977,
  2091462646,
  2486323059,
  586499841,
  988145025,
  935516892,
  3367335476,
  2599673255,
  2839830854,
  265290510,
  3972581182,
  2759138881,
  3795373465,
  1005194799,
  847297441,
  406762289,
  1314163512,
  1332590856,
  1866599683,
  4127851711,
  750260880,
  613907577,
  1450815602,
  3165620655,
  3734664991,
  3650291728,
  3012275730,
  3704569646,
  1427272223,
  778793252,
  1343938022,
  2676280711,
  2052605720,
  1946737175,
  3164576444,
  3914038668,
  3967478842,
  3682934266,
  1661551462,
  3294938066,
  4011595847,
  840292616,
  3712170807,
  616741398,
  312560963,
  711312465,
  1351876610,
  322626781,
  1910503582,
  271666773,
  2175563734,
  1594956187,
  70604529,
  3617834859,
  1007753275,
  1495573769,
  4069517037,
  2549218298,
  2663038764,
  504708206,
  2263041392,
  3941167025,
  2249088522,
  1514023603,
  1998579484,
  1312622330,
  694541497,
  2582060303,
  2151582166,
  1382467621,
  776784248,
  2618340202,
  3323268794,
  2497899128,
  2784771155,
  503983604,
  4076293799,
  907881277,
  423175695,
  432175456,
  1378068232,
  4145222326,
  3954048622,
  3938656102,
  3820766613,
  2793130115,
  2977904593,
  26017576,
  3274890735,
  3194772133,
  1700274565,
  1756076034,
  4006520079,
  3677328699,
  720338349,
  1533947780,
  354530856,
  688349552,
  3973924725,
  1637815568,
  332179504,
  3949051286,
  53804574,
  2852348879,
  3044236432,
  1282449977,
  3583942155,
  3416972820,
  4006381244,
  1617046695,
  2628476075,
  3002303598,
  1686838959,
  431878346,
  2686675385,
  1700445008,
  1080580658,
  1009431731,
  832498133,
  3223435511,
  2605976345,
  2271191193,
  2516031870,
  1648197032,
  4164389018,
  2548247927,
  300782431,
  375919233,
  238389289,
  3353747414,
  2531188641,
  2019080857,
  1475708069,
  455242339,
  2609103871,
  448939670,
  3451063019,
  1395535956,
  2413381860,
  1841049896,
  1491858159,
  885456874,
  4264095073,
  4001119347,
  1565136089,
  3898914787,
  1108368660,
  540939232,
  1173283510,
  2745871338,
  3681308437,
  4207628240,
  3343053890,
  4016749493,
  1699691293,
  1103962373,
  3625875870,
  2256883143,
  3830138730,
  1031889488,
  3479347698,
  1535977030,
  4236805024,
  3251091107,
  2132092099,
  1774941330,
  1199868427,
  1452454533,
  157007616,
  2904115357,
  342012276,
  595725824,
  1480756522,
  206960106,
  497939518,
  591360097,
  863170706,
  2375253569,
  3596610801,
  1814182875,
  2094937945,
  3421402208,
  1082520231,
  3463918190,
  2785509508,
  435703966,
  3908032597,
  1641649973,
  2842273706,
  3305899714,
  1510255612,
  2148256476,
  2655287854,
  3276092548,
  4258621189,
  236887753,
  3681803219,
  274041037,
  1734335097,
  3815195456,
  3317970021,
  1899903192,
  1026095262,
  4050517792,
  356393447,
  2410691914,
  3873677099,
  3682840055,
  3913112168,
  2491498743,
  4132185628,
  2489919796,
  1091903735,
  1979897079,
  3170134830,
  3567386728,
  3557303409,
  857797738,
  1136121015,
  1342202287,
  507115054,
  2535736646,
  337727348,
  3213592640,
  1301675037,
  2528481711,
  1895095763,
  1721773893,
  3216771564,
  62756741,
  2142006736,
  835421444,
  2531993523,
  1442658625,
  3659876326,
  2882144922,
  676362277,
  1392781812,
  170690266,
  3921047035,
  1759253602,
  3611846912,
  1745797284,
  664899054,
  1329594018,
  3901205900,
  3045908486,
  2062866102,
  2865634940,
  3543621612,
  3464012697,
  1080764994,
  553557557,
  3656615353,
  3996768171,
  991055499,
  499776247,
  1265440854,
  648242737,
  3940784050,
  980351604,
  3713745714,
  1749149687,
  3396870395,
  4211799374,
  3640570775,
  1161844396,
  3125318951,
  1431517754,
  545492359,
  4268468663,
  3499529547,
  1437099964,
  2702547544,
  3433638243,
  2581715763,
  2787789398,
  1060185593,
  1593081372,
  2418618748,
  4260947970,
  69676912,
  2159744348,
  86519011,
  2512459080,
  3838209314,
  1220612927,
  3339683548,
  133810670,
  1090789135,
  1078426020,
  1569222167,
  845107691,
  3583754449,
  4072456591,
  1091646820,
  628848692,
  1613405280,
  3757631651,
  526609435,
  236106946,
  48312990,
  2942717905,
  3402727701,
  1797494240,
  859738849,
  992217954,
  4005476642,
  2243076622,
  3870952857,
  3732016268,
  765654824,
  3490871365,
  2511836413,
  1685915746,
  3888969200,
  1414112111,
  2273134842,
  3281911079,
  4080962846,
  172450625,
  2569994100,
  980381355,
  4109958455,
  2819808352,
  2716589560,
  2568741196,
  3681446669,
  3329971472,
  1835478071,
  660984891,
  3704678404,
  4045999559,
  3422617507,
  3040415634,
  1762651403,
  1719377915,
  3470491036,
  2693910283,
  3642056355,
  3138596744,
  1364962596,
  2073328063,
  1983633131,
  926494387,
  3423689081,
  2150032023,
  4096667949,
  1749200295,
  3328846651,
  309677260,
  2016342300,
  1779581495,
  3079819751,
  111262694,
  1274766160,
  443224088,
  298511866,
  1025883608,
  3806446537,
  1145181785,
  168956806,
  3641502830,
  3584813610,
  1689216846,
  3666258015,
  3200248200,
  1692713982,
  2646376535,
  4042768518,
  1618508792,
  1610833997,
  3523052358,
  4130873264,
  2001055236,
  3610705100,
  2202168115,
  4028541809,
  2961195399,
  1006657119,
  2006996926,
  3186142756,
  1430667929,
  3210227297,
  1314452623,
  4074634658,
  4101304120,
  2273951170,
  1399257539,
  3367210612,
  3027628629,
  1190975929,
  2062231137,
  2333990788,
  2221543033,
  2438960610,
  1181637006,
  548689776,
  2362791313,
  3372408396,
  3104550113,
  3145860560,
  296247880,
  1970579870,
  3078560182,
  3769228297,
  1714227617,
  3291629107,
  3898220290,
  166772364,
  1251581989,
  493813264,
  448347421,
  195405023,
  2709975567,
  677966185,
  3703036547,
  1463355134,
  2715995803,
  1338867538,
  1343315457,
  2802222074,
  2684532164,
  233230375,
  2599980071,
  2000651841,
  3277868038,
  1638401717,
  4028070440,
  3237316320,
  6314154,
  819756386,
  300326615,
  590932579,
  1405279636,
  3267499572,
  3150704214,
  2428286686,
  3959192993,
  3461946742,
  1862657033,
  1266418056,
  963775037,
  2089974820,
  2263052895,
  1917689273,
  448879540,
  3550394620,
  3981727096,
  150775221,
  3627908307,
  1303187396,
  508620638,
  2975983352,
  2726630617,
  1817252668,
  1876281319,
  1457606340,
  908771278,
  3720792119,
  3617206836,
  2455994898,
  1729034894,
  1080033504,
  976866871,
  3556439503,
  2881648439,
  1522871579,
  1555064734,
  1336096578,
  3548522304,
  2579274686,
  3574697629,
  3205460757,
  3593280638,
  3338716283,
  3079412587,
  564236357,
  2993598910,
  1781952180,
  1464380207,
  3163844217,
  3332601554,
  1699332808,
  1393555694,
  1183702653,
  3581086237,
  1288719814,
  691649499,
  2847557200,
  2895455976,
  3193889540,
  2717570544,
  1781354906,
  1676643554,
  2592534050,
  3230253752,
  1126444790,
  2770207658,
  2633158820,
  2210423226,
  2615765581,
  2414155088,
  3127139286,
  673620729,
  2805611233,
  1269405062,
  4015350505,
  3341807571,
  4149409754,
  1057255273,
  2012875353,
  2162469141,
  2276492801,
  2601117357,
  993977747,
  3918593370,
  2654263191,
  753973209,
  36408145,
  2530585658,
  25011837,
  3520020182,
  2088578344,
  530523599,
  2918365339,
  1524020338,
  1518925132,
  3760827505,
  3759777254,
  1202760957,
  3985898139,
  3906192525,
  674977740,
  4174734889,
  2031300136,
  2019492241,
  3983892565,
  4153806404,
  3822280332,
  352677332,
  2297720250,
  60907813,
  90501309,
  3286998549,
  1016092578,
  2535922412,
  2839152426,
  457141659,
  509813237,
  4120667899,
  652014361,
  1966332200,
  2975202805,
  55981186,
  2327461051,
  676427537,
  3255491064,
  2882294119,
  3433927263,
  1307055953,
  942726286,
  933058658,
  2468411793,
  3933900994,
  4215176142,
  1361170020,
  2001714738,
  2830558078,
  3274259782,
  1222529897,
  1679025792,
  2729314320,
  3714953764,
  1770335741,
  151462246,
  3013232138,
  1682292957,
  1483529935,
  471910574,
  1539241949,
  458788160,
  3436315007,
  1807016891,
  3718408830,
  978976581,
  1043663428,
  3165965781,
  1927990952,
  4200891579,
  2372276910,
  3208408903,
  3533431907,
  1412390302,
  2931980059,
  4132332400,
  1947078029,
  3881505623,
  4168226417,
  2941484381,
  1077988104,
  1320477388,
  886195818,
  18198404,
  3786409e3,
  2509781533,
  112762804,
  3463356488,
  1866414978,
  891333506,
  18488651,
  661792760,
  1628790961,
  3885187036,
  3141171499,
  876946877,
  2693282273,
  1372485963,
  791857591,
  2686433993,
  3759982718,
  3167212022,
  3472953795,
  2716379847,
  445679433,
  3561995674,
  3504004811,
  3574258232,
  54117162,
  3331405415,
  2381918588,
  3769707343,
  4154350007,
  1140177722,
  4074052095,
  668550556,
  3214352940,
  367459370,
  261225585,
  2610173221,
  4209349473,
  3468074219,
  3265815641,
  314222801,
  3066103646,
  3808782860,
  282218597,
  3406013506,
  3773591054,
  379116347,
  1285071038,
  846784868,
  2669647154,
  3771962079,
  3550491691,
  2305946142,
  453669953,
  1268987020,
  3317592352,
  3279303384,
  3744833421,
  2610507566,
  3859509063,
  266596637,
  3847019092,
  517658769,
  3462560207,
  3443424879,
  370717030,
  4247526661,
  2224018117,
  4143653529,
  4112773975,
  2788324899,
  2477274417,
  1456262402,
  2901442914,
  1517677493,
  1846949527,
  2295493580,
  3734397586,
  2176403920,
  1280348187,
  1908823572,
  3871786941,
  846861322,
  1172426758,
  3287448474,
  3383383037,
  1655181056,
  3139813346,
  901632758,
  1897031941,
  2986607138,
  3066810236,
  3447102507,
  1393639104,
  373351379,
  950779232,
  625454576,
  3124240540,
  4148612726,
  2007998917,
  544563296,
  2244738638,
  2330496472,
  2058025392,
  1291430526,
  424198748,
  50039436,
  29584100,
  3605783033,
  2429876329,
  2791104160,
  1057563949,
  3255363231,
  3075367218,
  3463963227,
  1469046755,
  985887462
];
var C_ORIG = [
  1332899944,
  1700884034,
  1701343084,
  1684370003,
  1668446532,
  1869963892
];
function _encipher(lr, off2, P, S) {
  var n, l = lr[off2], r = lr[off2 + 1];
  l ^= P[0];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[1];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[2];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[3];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[4];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[5];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[6];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[7];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[8];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[9];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[10];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[11];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[12];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[13];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[14];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[15];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[16];
  lr[off2] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
  lr[off2 + 1] = l;
  return lr;
}
__name(_encipher, "_encipher");
function _streamtoword(data, offp) {
  for (var i = 0, word = 0; i < 4; ++i)
    word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
  return { key: word, offp };
}
__name(_streamtoword, "_streamtoword");
function _key(key, P, S) {
  var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
  for (i = 0; i < plen; i += 2)
    lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
__name(_key, "_key");
function _ekskey(data, key, P, S) {
  var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
  offp = 0;
  for (i = 0; i < plen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
__name(_ekskey, "_ekskey");
function _crypt(b, salt, rounds, callback, progressCallback) {
  var cdata = C_ORIG.slice(), clen = cdata.length, err;
  if (rounds < 4 || rounds > 31) {
    err = Error("Illegal number of rounds (4-31): " + rounds);
    if (callback) {
      nextTick2(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.length !== BCRYPT_SALT_LEN) {
    err = Error(
      "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
    );
    if (callback) {
      nextTick2(callback.bind(this, err));
      return;
    } else throw err;
  }
  rounds = 1 << rounds >>> 0;
  var P, S, i = 0, j;
  if (typeof Int32Array === "function") {
    P = new Int32Array(P_ORIG);
    S = new Int32Array(S_ORIG);
  } else {
    P = P_ORIG.slice();
    S = S_ORIG.slice();
  }
  _ekskey(salt, b, P, S);
  function next() {
    if (progressCallback) progressCallback(i / rounds);
    if (i < rounds) {
      var start = Date.now();
      for (; i < rounds; ) {
        i = i + 1;
        _key(b, P, S);
        _key(salt, P, S);
        if (Date.now() - start > MAX_EXECUTION_TIME) break;
      }
    } else {
      for (i = 0; i < 64; i++)
        for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
      var ret = [];
      for (i = 0; i < clen; i++)
        ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
      if (callback) {
        callback(null, ret);
        return;
      } else return ret;
    }
    if (callback) nextTick2(next);
  }
  __name(next, "next");
  if (typeof callback !== "undefined") {
    next();
  } else {
    var res;
    while (true) if (typeof (res = next()) !== "undefined") return res || [];
  }
}
__name(_crypt, "_crypt");
function _hash(password, salt, callback, progressCallback) {
  var err;
  if (typeof password !== "string" || typeof salt !== "string") {
    err = Error("Invalid string / salt: Not a string");
    if (callback) {
      nextTick2(callback.bind(this, err));
      return;
    } else throw err;
  }
  var minor, offset;
  if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
    err = Error("Invalid salt version: " + salt.substring(0, 2));
    if (callback) {
      nextTick2(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.charAt(2) === "$") minor = String.fromCharCode(0), offset = 3;
  else {
    minor = salt.charAt(2);
    if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
      err = Error("Invalid salt revision: " + salt.substring(2, 4));
      if (callback) {
        nextTick2(callback.bind(this, err));
        return;
      } else throw err;
    }
    offset = 4;
  }
  if (salt.charAt(offset + 2) > "$") {
    err = Error("Missing salt rounds");
    if (callback) {
      nextTick2(callback.bind(this, err));
      return;
    } else throw err;
  }
  var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
  password += minor >= "a" ? "\0" : "";
  var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
  function finish(bytes) {
    var res = [];
    res.push("$2");
    if (minor >= "a") res.push(minor);
    res.push("$");
    if (rounds < 10) res.push("0");
    res.push(rounds.toString());
    res.push("$");
    res.push(base64_encode(saltb, saltb.length));
    res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
    return res.join("");
  }
  __name(finish, "finish");
  if (typeof callback == "undefined")
    return finish(_crypt(passwordb, saltb, rounds));
  else {
    _crypt(
      passwordb,
      saltb,
      rounds,
      function(err2, bytes) {
        if (err2) callback(err2, null);
        else callback(null, finish(bytes));
      },
      progressCallback
    );
  }
}
__name(_hash, "_hash");

// src/admin.ts
var ADMIN_ROUTES = {
  "GET /api/admin/stats": handleStats,
  "GET /api/admin/orders": handleListOrders,
  "GET /api/admin/licenses": handleListLicenses,
  "POST /api/admin/licenses/revoke": handleRevokeLicense,
  "POST /api/admin/licenses/reactivate": handleReactivateLicense,
  "POST /api/admin/licenses/resend": handleResendLicense,
  "GET /api/admin/export": handleExport,
  "POST /api/admin/login": handleLogin,
  "POST /api/admin/logout": handleLogout,
  "GET /api/admin/me": handleMe
};
async function handleAdmin(request, env2) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const routeKey = `${method} ${path}`;
  const corsHeaders2 = {
    "Access-Control-Allow-Origin": "https://admin.bot-wow.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  };
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders2 });
  }
  const handler = ADMIN_ROUTES[routeKey];
  if (!handler) {
    return jsonError("not_found", "Admin endpoint not found", 404, corsHeaders2);
  }
  const isPublic = path === "/api/admin/login" || path === "/api/admin/logout";
  if (!isPublic) {
    const auth = await verifyAdminAuth(request, env2);
    if (!auth) {
      return jsonError("unauthorized", "Authentication required", 401, corsHeaders2);
    }
    request.adminUser = auth;
  }
  try {
    return await handler(request, env2, corsHeaders2);
  } catch (error) {
    console.error("Admin handler error:", error);
    return jsonError("server_error", "Internal server error", 500, corsHeaders2);
  }
}
__name(handleAdmin, "handleAdmin");
async function handleLogin(request, env2, corsHeaders2) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", "Invalid JSON", 400, corsHeaders2);
  }
  const email = body.email?.toLowerCase().trim();
  const password = body.password;
  if (!email || !password) {
    return jsonError("missing_credentials", "Email and password required", 400, corsHeaders2);
  }
  if (email !== env2.ADMIN_EMAIL.toLowerCase()) {
    await sleep(100);
    return jsonError("invalid_credentials", "Invalid email or password", 401, corsHeaders2);
  }
  const valid = await verifyPassword(password, env2.ADMIN_PASSWORD_HASH);
  if (!valid) {
    await sleep(100);
    return jsonError("invalid_credentials", "Invalid email or password", 401, corsHeaders2);
  }
  const token = await generateJWT({ sub: email, role: "admin" }, env2.ADMIN_JWT_SECRET);
  const headers = new Headers(corsHeaders2);
  headers.set("Set-Cookie", `admin_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);
  return new Response(JSON.stringify({ ok: true, user: { email, role: "admin" } }), {
    status: 200,
    headers
  });
}
__name(handleLogin, "handleLogin");
async function handleLogout(request, env2, corsHeaders2) {
  const headers = new Headers(corsHeaders2);
  headers.set("Set-Cookie", "admin_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
  return jsonResponse4({ ok: true }, 200, headers);
}
__name(handleLogout, "handleLogout");
async function handleMe(request, env2, corsHeaders2) {
  const authUser = request.adminUser;
  const user = authUser ? { email: authUser.sub, role: authUser.role } : null;
  return jsonResponse4({ ok: true, user }, 200, corsHeaders2);
}
__name(handleMe, "handleMe");
async function handleStats(request, env2, corsHeaders2) {
  const [orders, licenses, revenue] = await Promise.all([
    env2.DB.prepare("SELECT COUNT(*) as cnt FROM orders").first(),
    env2.DB.prepare('SELECT COUNT(*) as cnt FROM licenses WHERE status = "active"').first(),
    env2.DB.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = "paid"').first()
  ]);
  return jsonResponse4({
    ok: true,
    stats: {
      totalOrders: orders?.cnt || 0,
      activeLicenses: licenses?.cnt || 0,
      totalRevenue: (revenue?.total || 0) / 100
      // Convert cents to euros
    }
  }, 200, corsHeaders2);
}
__name(handleStats, "handleStats");
async function handleListOrders(request, env2, corsHeaders2) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
  const status = url.searchParams.get("status");
  const provider = url.searchParams.get("provider");
  const search = url.searchParams.get("search");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params = [];
  if (status) {
    where += " AND o.status = ?";
    params.push(status);
  }
  if (provider) {
    where += " AND o.provider = ?";
    params.push(provider);
  }
  if (search) {
    where += " AND (o.email LIKE ? OR o.provider_id LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (dateFrom) {
    where += " AND o.created_at >= ?";
    params.push(parseInt(dateFrom));
  }
  if (dateTo) {
    where += " AND o.created_at <= ?";
    params.push(parseInt(dateTo));
  }
  params.push(limit, offset);
  const [orders, total] = await Promise.all([
    env2.DB.prepare(`
      SELECT o.*, l.key as license_key, l.status as license_status
      FROM orders o
      LEFT JOIN licenses l ON l.order_id = o.id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params).all(),
    env2.DB.prepare(`
      SELECT COUNT(*) as cnt FROM orders o ${where}
    `).bind(...params.slice(0, -2)).first()
  ]);
  return jsonResponse4({
    ok: true,
    orders: orders.results,
    pagination: {
      page,
      limit,
      total: total?.cnt || 0,
      totalPages: Math.ceil((total?.cnt || 0) / limit)
    }
  }, 200, corsHeaders2);
}
__name(handleListOrders, "handleListOrders");
async function handleListLicenses(request, env2, corsHeaders2) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1";
  const params = [];
  if (status) {
    where += " AND l.status = ?";
    params.push(status);
  }
  if (search) {
    where += " AND (l.key LIKE ? OR l.email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  params.push(limit, offset);
  const [licenses, total] = await Promise.all([
    env2.DB.prepare(`
      SELECT l.*, 
        (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) as activation_count,
        (SELECT COUNT(*) FROM downloads d WHERE d.license_id = l.id) as download_count,
        (SELECT SUM(d.count) FROM downloads d WHERE d.license_id = l.id) as total_downloads
      FROM licenses l
      ${where}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params).all(),
    env2.DB.prepare(`
      SELECT COUNT(*) as cnt FROM licenses l ${where}
    `).bind(...params.slice(0, -2)).first()
  ]);
  return jsonResponse4({
    ok: true,
    licenses: licenses.results,
    pagination: {
      page,
      limit,
      total: total?.cnt || 0,
      totalPages: Math.ceil((total?.cnt || 0) / limit)
    }
  }, 200, corsHeaders2);
}
__name(handleListLicenses, "handleListLicenses");
async function handleRevokeLicense(request, env2, corsHeaders2) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", "Invalid JSON", 400, corsHeaders2);
  }
  const result = await env2.DB.prepare(`
    UPDATE licenses SET status = 'revoked', updated_at = ? WHERE id = ?
  `).bind(Date.now(), body.id).run();
  if (result.meta.changes === 0) {
    return jsonError("not_found", "License not found", 404, corsHeaders2);
  }
  return jsonResponse4({ ok: true, message: "License revoked" }, 200, corsHeaders2);
}
__name(handleRevokeLicense, "handleRevokeLicense");
async function handleReactivateLicense(request, env2, corsHeaders2) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", "Invalid JSON", 400, corsHeaders2);
  }
  const result = await env2.DB.prepare(`
    UPDATE licenses SET status = 'active', updated_at = ? WHERE id = ?
  `).bind(Date.now(), body.id).run();
  if (result.meta.changes === 0) {
    return jsonError("not_found", "License not found", 404, corsHeaders2);
  }
  return jsonResponse4({ ok: true, message: "License reactivated" }, 200, corsHeaders2);
}
__name(handleReactivateLicense, "handleReactivateLicense");
async function handleResendLicense(request, env2, corsHeaders2) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", "Invalid JSON", 400, corsHeaders2);
  }
  const license = await env2.DB.prepare(`
    SELECT l.key, l.email, l.lang, d.token
    FROM licenses l
    LEFT JOIN downloads d ON d.license_id = l.id
    WHERE l.id = ?
  `).bind(body.id).first();
  if (!license || !license.token) {
    return jsonError("not_found", "License or download token not found", 404, corsHeaders2);
  }
  const downloadUrl = `https://botwow-api-staging.m4ngo.workers.dev/api/download?t=${license.token}`;
  await sendDeliveryEmail(env2, license.email, license.key, downloadUrl, license.lang || "fr");
  return jsonResponse4({ ok: true, message: "Email resent" }, 200, corsHeaders2);
}
__name(handleResendLicense, "handleResendLicense");
async function handleExport(request, env2, corsHeaders2) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("X-Export-Token");
  if (!token || token !== env2.EXPORT_TOKEN) {
    return jsonError("forbidden", "Invalid export token", 403, corsHeaders2);
  }
  const rows = await env2.DB.prepare(`
    SELECT 
      o.created_at, o.email, o.amount, o.currency, o.status, o.provider,
      l.lang, l.key as license_key, l.status as license_status,
      (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) as activations,
      (SELECT COALESCE(SUM(d.count), 0) FROM downloads d WHERE d.license_id = l.id) as downloads
    FROM orders o
    LEFT JOIN licenses l ON l.order_id = o.id
    ORDER BY o.created_at DESC
  `).all();
  const headers = ["Date", "Email", "Amount (EUR)", "Currency", "Status", "Provider", "Lang", "License Key", "License Status", "Activations", "Downloads"];
  const csv = [
    headers.join(","),
    ...rows.results.map((r) => [
      r.created_at ? new Date(r.created_at).toISOString() : "",
      r.email,
      (r.amount / 100).toFixed(2),
      r.currency,
      r.status,
      r.provider,
      r.lang || "",
      r.license_key || "",
      r.license_status || "",
      r.activations || 0,
      r.downloads || 0
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders2,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="botwow-export-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv"`,
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store"
    }
  });
}
__name(handleExport, "handleExport");
async function verifyAdminAuth(request, env2) {
  const cookieHeader = request.headers.get("Cookie");
  let token = "";
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    token = cookies["admin_token"] || "";
  }
  if (!token) {
    const auth = request.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      token = auth.slice(7);
    }
  }
  if (!token) return null;
  try {
    const payload = await verifyJWT(token, env2.ADMIN_JWT_SECRET);
    if (payload.role !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyAdminAuth, "verifyAdminAuth");
async function generateJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + 86400
    // 24 hours
  };
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signingInput)
  );
  const encodedSignature = b64url(new Uint8Array(signature));
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}
__name(generateJWT, "generateJWT");
async function verifyJWT(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signature = b64urlToBytes(encodedSignature);
  const valid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(signingInput));
  if (!valid) throw new Error("Invalid signature");
  const payload = JSON.parse(b64urlDecode(encodedPayload));
  if (payload.exp < Math.floor(Date.now() / 1e3)) {
    throw new Error("Token expired");
  }
  return payload;
}
__name(verifyJWT, "verifyJWT");
async function verifyPassword(password, hash2) {
  try {
    if (typeof hash2 !== "string" || typeof password !== "string") {
      return false;
    }
    if (!hash2.startsWith("$2a$") && !hash2.startsWith("$2b$") && !hash2.startsWith("$2y$")) {
      return false;
    }
    return await compare(password, hash2);
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}
__name(verifyPassword, "verifyPassword");
function b64url(data) {
  const str = data instanceof Uint8Array ? String.fromCharCode.apply(null, Array.from(data)) : data;
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(b64url, "b64url");
function b64urlDecode(data) {
  const padded = data + "=".repeat((4 - data.length % 4) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}
__name(b64urlDecode, "b64urlDecode");
function b64urlToBytes(data) {
  const binary = b64urlDecode(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(b64urlToBytes, "b64urlToBytes");
function parseCookies(cookieHeader) {
  const cookies = {};
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name && rest.length > 0) {
      cookies[name] = rest.join("=");
    }
  }
  return cookies;
}
__name(parseCookies, "parseCookies");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");
function jsonResponse4(data, status = 200, extraHeaders = {}) {
  const headersObj = extraHeaders instanceof Headers ? Object.fromEntries(extraHeaders.entries()) : extraHeaders;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...headersObj
    }
  });
}
__name(jsonResponse4, "jsonResponse");
function jsonError(code, message, status, extraHeaders = {}) {
  const headersObj = extraHeaders instanceof Headers ? Object.fromEntries(extraHeaders.entries()) : extraHeaders;
  return new Response(JSON.stringify({ ok: false, error: code, message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...headersObj
    }
  });
}
__name(jsonError, "jsonError");
var corsHeaders = {
  "Access-Control-Allow-Origin": "https://admin.bot-wow.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400"
};

// src/web.ts (legacy landing generator REMOVED 2026-11-04)
//
// L'hote api.bot-wow.com est un hote API : il ne doit PAS servir de page
// marketing. Le generateur historique rendait, pour /de/, /en/, /es/, /pt/
// et /ru/, une page « gratuite », une promesse d'indetectabilite et une
// promesse de « farm de l'or », avec un JSON-LD "offers.price": "0" et un
// sitemap « bot-wow-gold / best-wow-bot / bot-wow-gratuit ».
//
// Ces contenus contredisaient simultanement :
//   - l'offre unique payante (PRICE_TABLE : 2000 EUR), affichee partout
//     sur bot-wow.com et dans /api/config (priceEur: 20) ;
//   - assets/modules.json : la section « never » interdit les promesses
//     d'indetectabilite, et « farm » n'est pas un module livre (seul
//     `fish` est `available`).
//
// Regle appliquee : UNE seule version indexable, sur bot-wow.com. L'hote API
// redirige (308) vers l'URL canonique et ne rend plus aucun HTML marketing.
// Rollback : redeployer la version precedente du Worker (id conserve dans le
// rapport de mission).
var CANONICAL_SITE = "https://bot-wow.com";
function redirectToCanonicalSite(request) {
  const u = new URL(request.url);
  const target = CANONICAL_SITE + (u.pathname === "/" ? "/" : u.pathname) + (u.search || "");
  return new Response(null, {
    status: 308,
    headers: {
      "location": target,
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
__name(redirectToCanonicalSite, "redirectToCanonicalSite");

// src/index.ts
var index_default = {
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "https://bot-wow.com",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    try {
      if (path === "/api/config" && method === "GET") {
        return handleConfigWithBitcoin(env2);
      }
      if (path === "/api/claim" && method === "POST") {
        return handleClaim(request, env2);
      }
      if (path === "/api/activate" && method === "POST") {
        return handleActivate(request, env2);
      }
      if (path === "/api/subscribe" && method === "POST") {
        return handleSubscribe(request, env2);
      }
      if (path === "/api/download" && method === "GET") {
        return handleDownload(request, env2);
      }
      if (path === "/api/resend" && method === "POST") {
        return handleResend(request, env2);
      }
      if (path === "/api/checkout" && method === "POST") {
        return handleCheckout(request, env2);
      }
      if (path === "/api/mollie-webhook" && method === "POST") {
        return handleMollieWebhook(request, env2);
      }
      if (path === "/api/bitcoin/checkout" && method === "POST") {
        return handleBitcoinCheckout(request, env2);
      }
      if (path === "/api/bitcoin/paid" && method === "POST") {
        return handleBitcoinPaidNotification(request, env2);
      }
      if (path.startsWith("/api/admin/orders/") && path.endsWith("/approve") && method === "POST") {
        return handleAdminApproveOrder(request, env2);
      }
      if (path.startsWith("/api/admin/orders/") && path.endsWith("/reject") && method === "POST") {
        return handleAdminRejectOrder(request, env2);
      }
      if (path.startsWith("/api/admin/")) {
        return handleAdmin(request, env2);
      }
      if (path === "/health" && method === "GET") {
        return new Response(JSON.stringify({
          status: "ok",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          version: "1.0.0"
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (method === "GET" && !path.startsWith("/api/")) {
        // L'hote API ne rend plus de page marketing : il redirige vers
        // l'URL canonique unique (voir redirectToCanonicalSite).
        return redirectToCanonicalSite(request);
      }
      return jsonError2("not_found", "Endpoint not found", 404);
    } catch (error) {
      console.error("Worker error:", error);
      return jsonError2("server_error", "Internal server error", 500);
    }
  },
  // Scheduled handler for cron jobs (backups, cleanup)
  async scheduled(event, env2, ctx) {
    console.log(`Cron triggered: ${event.cron}`);
    try {
      if (event.cron === "0 3 * * *") {
        await runDailyBackup(env2);
      }
      if (event.cron === "0 * * * *") {
        await cleanupRateLimits(env2);
      }
      if (event.cron === "0 4 * * *") {
        await cleanupExpiredDownloads(env2);
      }
    } catch (error) {
      console.error("Scheduled task error:", error);
    }
  }
};
async function runDailyBackup(env2) {
  console.log("Starting daily backup...");
  try {
    const tables = ["webhook_events", "orders", "licenses", "activations", "downloads", "rate_limit", "admin_sessions", "mollie_customers"];
    let sqlDump = "";
    for (const table of tables) {
      const schemaResult = await env2.DB.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).bind(table).first();
      if (schemaResult?.sql) {
        sqlDump += schemaResult.sql + ";\n\n";
      }
      const data = await env2.DB.prepare(`SELECT * FROM ${table}`).all();
      if (data.results.length > 0) {
        const columns = Object.keys(data.results[0]);
        const placeholders = columns.map(() => "?").join(", ");
        const insertPrefix = `INSERT INTO ${table} (${columns.join(", ")}) VALUES `;
        const rows = data.results.map(
          (row) => "(" + columns.map((col) => {
            const val = row[col];
            if (val === null) return "NULL";
            if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === "number") return String(val);
            if (typeof val === "boolean") return val ? "1" : "0";
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(", ") + ")"
        ).join(",\n");
        sqlDump += insertPrefix + rows + ";\n\n";
      }
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const key = `botwow-${timestamp}.sql`;
    await env2.R2_BINARIES.put(key, sqlDump);
    console.log(`Backup uploaded: ${key} (${sqlDump.length} bytes)`);
    const objects = await env2.R2_BINARIES.list({ prefix: "botwow-" });
    const cutoff = Date.now() - 30 * 864e5;
    for (const obj of objects.objects) {
      const match = obj.key.match(/botwow-(\d{4})(\d{2})(\d{2})-/);
      if (match) {
        const date = /* @__PURE__ */ new Date(`${match[1]}-${match[2]}-${match[3]}`);
        if (date.getTime() < cutoff) {
          await env2.R2_BINARIES.delete(obj.key);
          console.log(`Deleted old backup: ${obj.key}`);
        }
      }
    }
  } catch (error) {
    console.error("Backup failed:", error);
  }
}
__name(runDailyBackup, "runDailyBackup");
async function cleanupRateLimits(env2) {
  console.log("Rate limit cleanup (handled by KV TTL)");
}
__name(cleanupRateLimits, "cleanupRateLimits");
async function cleanupExpiredDownloads(env2) {
  try {
    const result = await env2.DB.prepare(`
      DELETE FROM downloads WHERE expires_at < ?
    `).bind(Date.now()).run();
    if (result.meta.changes > 0) {
      console.log(`Cleaned up ${result.meta.changes} expired download tokens`);
    }
  } catch (error) {
    console.error("Cleanup expired downloads error:", error);
  }
}
__name(cleanupExpiredDownloads, "cleanupExpiredDownloads");
function jsonError2(code, message, status) {
  return new Response(JSON.stringify({ ok: false, error: code, message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "https://bot-wow.com"
    }
  });
}
__name(jsonError2, "jsonError");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

