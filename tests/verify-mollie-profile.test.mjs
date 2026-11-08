/**
 * verify-mollie-profile.test.mjs — verifications du script de diagnostic :
 * classification du credential, correspondance au profil attendu, absence
 * TOTALE de fuite du credential dans les retours (meme en erreur). Aucun
 * appel reseau : la fonction fetch est injectee.
 */
import { classifyCredential, verify } from '../scripts/verify-mollie-profile.mjs';

let failures = 0;
let passes = 0;
function check(label, ok, extra = '') {
  if (ok) { passes++; console.log(`  ok   ${label}`); }
  else { failures++; console.log(`  FAIL  ${label} ${extra}`); }
}

/* 1. classification du type de credential */
check('cle test_ -> api_key_test', classifyCredential('test_sondage_x') === 'api_key_test');
check('cle live_ -> api_key_live', classifyCredential('live_sondage_x') === 'api_key_live');
check('valeur ni test_ ni live_ -> organization_token', classifyCredential('access_token_x') === 'organization_token');
check('valeur vide -> missing', classifyCredential('') === 'missing');

/* 2. cle test_ : lecture /profiles/current, profil verifie, aucune fuite */
{
  let calls = [];
  const KEY = 'test_SECRET_NE_PAS_ECHOUPER';
  const fetchImpl = async (url, opts) => {
    calls.push({ url, method: opts.method, auth: Boolean(String(opts.headers.Authorization || '').startsWith('Bearer ')) });
    return new Response(JSON.stringify({ id: 'pfl_botwow_check', mode: 'test', name: 'BOT-WOW', website: 'https://bot-wow.com' }), { status: 200 });
  };
  const result = await verify({ apiKey: KEY, profileId: '', expectProfileId: 'pfl_botwow_check', fetchImpl });
  check('cle test_ : profil attendu verifie', result.ok === true && result.profileMatch === true);
  check('exactement un appel, GET /profiles/current avec Bearer',
    calls.length === 1 && calls[0].method === 'GET' && calls[0].url.endsWith('/profiles/current') && calls[0].auth);
  const printed = JSON.stringify(result);
  check('la cle n-apparait jamais dans le resultat', !printed.includes(KEY));
}

/* 3. cle test_ mais autre profil attendu : echec clair, sans fuite */
{
  const KEY = 'test_SECRET_NE_PAS_ECHOUPER_2';
  const fetchImpl = async () => new Response(JSON.stringify({ id: 'pfl_reel', mode: 'test' }), { status: 200 });
  const result = await verify({ apiKey: KEY, profileId: '', expectProfileId: 'pfl_autre', fetchImpl });
  check('correspondance refusée : ok=false, profileMatch=false', result.ok === false && result.profileMatch === false);
  check('l-erreur nomme les deux identifiants publiques (pas la cle)',
    result.error.includes('pfl_reel') && result.error.includes('pfl_autre') && !result.error.includes(KEY));
}

/* 4. token organisation sans MOLLIE_PROFILE_ID : aucun appel, erreur claire */
{
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response('{}', { status: 200 }); };
  const result = await verify({ apiKey: 'access_sondage', profileId: '', expectProfileId: 'pfl_botwow_check', fetchImpl });
  check('token organisation sans MOLLIE_PROFILE_ID : aucun appel, echec', calls === 0 && result.ok === false);
  check('message explique l-obligation du profileId', result.error.includes('MOLLIE_PROFILE_ID'));
}

/* 5. token organisation avec profileId : GET /profiles/{id} conforme */
{
  let seenUrl = '';
  const fetchImpl = async (url) => { seenUrl = url; return new Response(JSON.stringify({ id: 'pfl_botwow_2', mode: 'live' }), { status: 200 }); };
  const result = await verify({ apiKey: 'access_sondage2', profileId: 'pfl_botwow_2', expectProfileId: 'pfl_botwow_2', fetchImpl });
  check('token organisation lit /profiles/{profileId}', seenUrl.endsWith('/profiles/pfl_botwow_2'));
  check('token organisation : profil verifie', result.ok === true && result.profileMatch === true);
}

/* 6. refus 401 : statut seul, corps non renvoye, cle jamais imprimee */
{
  const KEY = 'live_SECRET_CIBLE_DE_FUITE';
  const fetchImpl = async () => new Response(JSON.stringify({ error: 'unauthorized', hint: `${KEY} echo attempt` }), { status: 401 });
  const result = await verify({ apiKey: KEY, profileId: '', expectProfileId: null, fetchImpl });
  check('401 -> echec explicite par statut', result.ok === false && result.error.startsWith('mollie_http_401'));
  const printed = JSON.stringify(result);
  check('401 : aucune fuite dans le resultat', !printed.includes(KEY));
  check('401 : corps de Mollie non re-rapporte', !printed.includes('echo attempt'));
}

/* 7. cle standard + MOLLIE_PROFILE_ID non correspondant : avertissement explicite */
{
  const fetchImpl = async () => new Response(JSON.stringify({ id: 'pfl_from_key', mode: 'live' }), { status: 200 });
  const result = await verify({ apiKey: 'live_fromkey', profileId: 'pfl_stale_placeholder', expectProfileId: 'pfl_from_key', fetchImpl });
  check('profil de la cle verifie (attendu = profil retourne)', result.ok === true && result.profileMatch === true);
  check('un avertissement signale que le binding est ignore', result.messages.length === 1 && result.messages[0].includes('ignored'));
}

/* 8. incoherence test_/live_ : visible, sans crash */
{
  const fetchImpl = async () => new Response(JSON.stringify({ id: 'pfl_mode', mode: 'live' }), { status: 200 });
  const result = await verify({ apiKey: 'test_mode4', profileId: '', expectProfileId: 'pfl_mode', fetchImpl });
  check('cle test_ + profil live : OK mais signale', result.ok === true && result.messages.length === 1);
}


/* 9. network exceptions may echo Authorization headers: return a fixed safe error */
{
  const KEY = 'test_SECRET_RESEAU_NE_PAS_ECHOUPER';
  const fetchImpl = async (_url, opts) => {
    throw new Error(`fetch failed with Authorization: ${opts.headers.Authorization}`);
  };
  const result = await verify({ apiKey: KEY, profileId: '', expectProfileId: 'pfl_network', fetchImpl });
  const printed = JSON.stringify(result);
  check('erreur réseau : échec générique sans credential', result.error === 'network: unable to reach Mollie (request failed)');
  check('erreur réseau : aucun header Authorization ni secret dans le résultat', !printed.includes(KEY) && !printed.includes('Authorization') && !printed.includes('Bearer '));
}

console.log(`VERIFY-MOLLIE-PROFILE: ${passes} verifications passees, ${failures} echec(s)`);
if (failures > 0) process.exitCode = 1;
