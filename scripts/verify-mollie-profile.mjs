#!/usr/bin/env node
/**
 * verify-mollie-profile.mjs — verify the Mollie credential type and its
 * BOT-WOW profile WITHOUT ever displaying, storing or logging the credential.
 *
 * Fills one specific gap of the report for the mission
 * "MOLLIE VALIDÉ -> PREMIÈRE VENTE LIVRABLE" (2026-11-07): the worker in the
 * cloud cannot tell whether MOLLIE_API_KEY is a standard API key (test_/live_,
 * already linked to one profile) or an organization/OAuth token, and whether
 * that credential is really bound to the validated BOT-WOW profile.
 * Only the owner can answer, because the key itself is required to ask Mollie.
 *
 * Ownership of the run: the OWNER runs this locally, never inside CI, never
 * with the key in a file tracked by git, never pasted in a PR/issue/report.
 *
 *   $env:MOLLIE_API_KEY   = "..."       # test_ key, live_ key or org token
 *   $env:MOLLIE_PROFILE_ID = "pfl_..."  # only needed for an organization token
 *   node scripts/verify-mollie-profile.mjs --expect-pfl pfl_L84sQNbb4i
 *
 * Mollie calls made (read-only, two GETs at most, no payment object created):
 *   API key test_/live_  -> GET https://api.mollie.com/v2/profiles/current
 *   organization token   -> GET https://api.mollie.com/v2/profiles/{profileId}
 *   Organization tokens require the profileId (docs.mollie.com/reference/
 *   get-profile): the worker itself refuses to call Mollie without it, so the
 *   script must not send one blindly either.
 *
 * Guarantees: the key is read from the environment, never echoed in the
 * output (even in error paths), never written to disk; only booleans and
 * Mollie's public profile fields (id, mode, name, website) go to stdout.
 */

const MOLLIE_API_BASE = "https://api.mollie.com/v2";

export function classifyCredential(key) {
  const value = String(key || "");
  if (!value) return "missing";
  if (value.startsWith("test_")) return "api_key_test";
  if (value.startsWith("live_")) return "api_key_live";
  return "organization_token";
}

function scrub(text, secrets = []) {
  let safe = String(text || "");
  for (const secret of secrets) {
    const value = String(secret || "");
    if (value) safe = safe.split(value).join("***");
  }
  return safe;
}

export async function verify({ apiKey, profileId, expectProfileId, fetchImpl = globalThis.fetch }) {
  const keyType = classifyCredential(apiKey);
  const result = {
    ok: false,
    keyType,
    profile: null,
    expectedProfileId: expectProfileId || null,
    profileMatch: null,
    profileIdProvided: Boolean(profileId),
    serviceCalls: [],
    messages: [],
    error: null
  };
  if (keyType === "missing") {
    result.error = "MOLLIE_API_KEY absent: verification is done by the owner, locally (see header).";
    return result;
  }
  if (keyType === "organization_token" && !profileId) {
    result.error = "credential treated as organization token: MOLLIE_PROFILE_ID is mandatory (the worker itself does not call Mollie without it).";
    return result;
  }

  const url = keyType === "organization_token"
    ? `${MOLLIE_API_BASE}/profiles/${encodeURIComponent(profileId)}`
    : `${MOLLIE_API_BASE}/profiles/current`;
  result.serviceCalls.push(url);

  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" }
    });
  } catch (e) {
    // Fetch errors may echo request headers in their message; never surface them.
    result.error = "network: unable to reach Mollie (request failed)";
    return result;
  }
  if (!response.ok) {
    // Never echo the response body: it could contain echoed request data.
    result.error = `mollie_http_${response.status} (invalid credential or unauthorized profile)`;
    return result;
  }
  let profile;
  try {
    profile = await response.json();
  } catch {
    result.error = "mollie_response_unreadable";
    return result;
  }
  result.profile = {
    id: profile && profile.id,
    mode: profile && profile.mode,
    name: profile && profile.name,
    website: profile && (profile.website || (profile._links && profile._links.website)),
    locale: profile && profile.locale
  };
  result.profileMatch = expectProfileId ? profile && profile.id === expectProfileId : null;
  result.ok = expectProfileId ? result.profileMatch === true : Boolean(result.profile.id);
  if (result.ok && keyType === "api_key_test" && result.profile.mode === "live") {
    result.messages.push("consistency notice: test_ key but profile mode reported live by Mollie (unusual: check in the dashboard).");
  }
  if (result.ok && keyType === "api_key_live" && result.profile.mode === "test") {
    result.messages.push("consistency notice: live_ key but profile mode reported test by Mollie (unusual: check in the dashboard).");
  }
  if (result.ok && keyType !== "organization_token" && profileId && profileId !== result.profile.id) {
    result.messages.push(`MOLLIE_PROFILE_ID (${scrub(profileId)}) is ignored with a standard API key: the profile linked to the key is ${result.profile.id}.`);
  }
  if (!result.ok && expectProfileId) {
    result.error = `profile mismatch: credential linked to ${result.profile.id}, expected ${expectProfileId}. Do not reuse another product profile.`;
  }
  return result;
}

function formatHuman(result) {
  const lines = [];
  lines.push(`credential type: ${result.keyType}`);
  if (result.error) lines.push(`result: FAILURE — ${result.error}`);
  else lines.push(`result: OK — verified profile: ${result.profile.id} (mode: ${result.profile.mode || "unknown"})`);
  if (result.profile) {
    lines.push(`name: ${result.profile.name || "unknown"}`);
    lines.push(`website: ${result.profile.website || "unknown"}`);
  }
  if (result.profileMatch !== null) {
    lines.push(`expected profile match (${result.expectedProfileId}): ${result.profileMatch ? "yes" : "NO"}`);
  }
  if (result.keyType === "organization_token" && !result.profileIdProvided) {
    lines.push("note: MOLLIE_PROFILE_ID not provided: this is mandatory for an organization token.");
  }
  for (const message of result.messages) lines.push(`note: ${message}`);
  return lines.join("\n");
}

function main(argv, io = { log: console.log, err: console.error }) {
  const expectArg = argv.indexOf("--expect-pfl");
  const expectProfileId = expectArg >= 0 ? argv[expectArg + 1] : null;
  const asJson = argv.includes("--json");
  const hasKey = Boolean(process.env.MOLLIE_API_KEY);
  if (!hasKey) {
    io.err("no credential detected in the MOLLIE_API_KEY environment: nothing was queried.");
  }
  const apiKey = process.env.MOLLIE_API_KEY;
  if (expectProfileId && apiKey && String(expectProfileId).includes(apiKey)) {
    io.err("options refused: --expect-pfl does not accept the credential value.");
    process.exitCode = 2;
    return;
  }
  verify({
    apiKey: process.env.MOLLIE_API_KEY,
    profileId: process.env.MOLLIE_PROFILE_ID,
    expectProfileId
  }).then((result) => {
    io.log(asJson ? JSON.stringify(result, null, 2) : formatHuman(result));
    process.exitCode = result.ok ? 0 : 1;
  }).catch((e) => {
    io.err(`verification failed: ${scrub(e && e.message || "unknown", [process.env.MOLLIE_API_KEY])}`);
    process.exitCode = 1;
  });
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (invokedDirectly) {
  main(process.argv.slice(2));
}
