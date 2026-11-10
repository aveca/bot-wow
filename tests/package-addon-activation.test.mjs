#!/usr/bin/env node
/**
 * package-addon-activation.test.mjs — contrat d'ACTIVATION du paquet BOT-WOW
 * (mission factory-control#82, job job-issue82-mwaoy17i).
 *
 * L'installation place les fichiers dans Interface/AddOns/Casinobabe ; ce
 * test vérifie ce qui se passe AU CHARGEMENT, dans l'ordre de la TOC livrée,
 * sous un mock WoW fidèle (tests/helpers/wow-mock.lua) avec le vrai moteur
 * Lua 5.1 de TBC-Classic (wasmoon-lua5.1, Lua 5.1).
 *
 * PARTIE FIXTURE (toujours exécutée) : paquet construit depuis la source de
 * test partagée (tests/helpers/package-fixture.mjs — reproduit les CONTRATS
 * observés, ne copie aucun octet propriétaire) :
 *   - chargement de chaque fichier TOC sans erreur ;
 *   - Casinobabe.Fishing exposé, commande slash déclarée, événement
 *     PLAYER_LOGIN enregistré ;
 *   - chaîne de gestionnaires d'erreurs : base -> LEC -> fishing -> relève
 *     vers LEC -> capture dans CasinobabeErrorBus.pending.
 *
 * PARTIE OCTETS RÉELS (activée par BOTWOW_PACKAGE_FIXTURE=<chemin du .zip> ;
 * SANS cette variable : lignes SKIP visibles, jamais comptées comme succès,
 * sortie 0 pour ne pas bloquer la CI) : charge les VRAIS fichiers du paquet
 * réel (provenance épinglée b625ccec… vérifiée dans le MANIFEST embarqué) :
 *   - TOC réelle : ordre exact [LiveErrorCapture.lua, CasinobabeFishing.lua] ;
 *   - chargement des octets réels sans erreur (Lua 5.1) ;
 *   - LEC installe SON gestionnaire par-dessus le gestionnaire de base du
 *     client (contrat LiveErrorCapture.lua ligne 69 : seulement si un
 *     gestionnaire précédent existe) ;
 *   - init fishing réussissant sous le mock, le gestionnaire LEC reste
 *     installé (identité préservée — le remplacement n'arrive qu'en cas
 *     d'échec d'init, CasinobabeFishing.lua lignes 1399-1410) ;
 *   - sonde d'erreur routée : geterrorhandler()('probe activation
 *     Casinobabe') est capturée par le BUS réel (Capture filtre sur le mot
 *     « Casinobabe », LiveErrorCapture.lua ligne 44) ;
 *   - API réelle : Casinobabe.Fishing.{STATES,OnEvent,GetStatus,Activate},
 *     /cbfish (SLASH_CASINOBABEFISH1), frames d'événements
 *     Casinobabe_FishingEvents avec PLAYER_LOGIN/LOOT_OPENED.
 *
 * Aucun réseau, aucun paiement, aucune écriture hors tmpdir.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lua } from 'wasmoon-lua5.1';
import { readZipEntries } from './helpers/package-zip.mjs';
import { makeGitSource, buildArgs, runBuild, makeCheck, FIXTURE_VERSION } from './helpers/package-fixture.mjs';

const { check, finish } = makeCheck();
const HERE = dirname(fileURLToPath(import.meta.url));
const MOCK_PATH = join(HERE, 'helpers', 'wow-mock.lua');
const ADDON_PREFIX = 'package/addon/Casinobabe/';
const PINNED_COMMIT = 'b625ccec5fd61225dd92c5c54fa8721da76c3876';

function tocFilesOf(tocText) {
  return tocText.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => /^[A-Za-z0-9_\-\.]+\.lua$/.test(l));
}

/* Le client WoW a TOUJOURS un gestionnaire d'erreurs par défaut : on le
   simule (contrat documenté du mock). Ensuite chaque fichier de la TOC est
   monté puis exécuté DANS L'ORDRE — une erreur de chargement lève ici. */
async function newEngineWithTocLoaded(label, addonEntries, tocText) {
  const lua = await Lua.create();
  lua.mountFile('wow-mock.lua', readFileSync(MOCK_PATH, 'utf8'));
  await lua.doFile('wow-mock.lua');
  await lua.doString('seterrorhandler(function(m) end)'); // gestionnaire par défaut du client
  // Trace d'identité du gestionnaire d'erreurs : [0]=base, puis un état
  // après CHAQUE fichier chargé (permet d'affirmer qui a remplacé qui).
  await lua.doString('__WoWMock.loadHandlers = { [0] = geterrorhandler() }');
  const files = tocFilesOf(tocText);
  for (const f of files) {
    const key = ADDON_PREFIX + f;
    const data = addonEntries.get(key);
    if (!data) throw new Error(`[${label}] la TOC référence ${f} mais l'entrée ZIP est absente : ${key}`);
    lua.mountFile(`addon/${f}`, data.toString('utf8'));
    await lua.doFile(`addon/${f}`);
    await lua.doString('__WoWMock.loadHandlers[#__WoWMock.loadHandlers + 1] = geterrorhandler()');
  }
  return { lua, files };
}

const luaSync = (lua, code) => lua.doStringSync(code);

/* ============================ PARTIE FIXTURE ============================ */
const tmp = mkdtempSync(join(tmpdir(), 'botwow-activate-'));
try {
  const SRC = makeGitSource(tmp, 'src');
  const OUT = join(tmp, 'dist');
  const build = runBuild(buildArgs({ source: SRC, commit: SRC.head, out: OUT }));
  check('activation fixture : la construction du paquet réussit', build.status === 0, build.text.trim().slice(-200));
  if (build.status !== 0) throw new Error('construction fixture impossible');

  const zipPath = join(OUT, `casinobabe-fishing-${FIXTURE_VERSION}.zip`);
  const entries = readZipEntries(zipPath);
  const tocText = entries.get(ADDON_PREFIX + 'Casinobabe.toc').toString('utf8');

  const { lua, files } = await newEngineWithTocLoaded('fixture', entries, tocText);
  check('activation fixture : les fichiers se chargent dans l\'ordre de la TOC sans erreur',
    files.join('|') === 'LiveErrorCapture.lua|CasinobabeFishing.lua', files.join('|'));
  check('activation fixture : Casinobabe.Fishing est exposé (table + version fixture)',
    luaSync(lua, 'return type(Casinobabe)=="table" and type(Casinobabe.Fishing)=="table" and Casinobabe.Fishing.version=="fixture"') === true);
  check('activation fixture : la commande slash est déclarée (/cbfishing)',
    luaSync(lua, 'return type(SlashCmdList["CASINOBABEFISHING"])=="function" and SLASH_CASINOBABEFISHING1=="/cbfishing"') === true);
  check('activation fixture : l\'événement PLAYER_LOGIN est enregistré',
    luaSync(lua, 'return (function() for _,e in ipairs(__WoWMock.events) do if e.event=="PLAYER_LOGIN" then return true end end return false end)()') === true);
  // Chaîne d'erreurs : base -> LEC -> fishing (wrapper) -> relève LEC -> BUS.
  check('activation fixture : un gestionnaire d\'erreurs est installé après les deux fichiers',
    luaSync(lua, 'return type(geterrorhandler())=="function"') === true);
  await lua.doString('local h = geterrorhandler() pcall(h, "probe fixture")');
  const captured = luaSync(lua,
    'local p = CasinobabeErrorBus.pending if #p == 0 then return "" end return p[#p].message');
  check('activation fixture : la sonde d\'erreur remonte la CHAÎNE (fishing -> LEC -> BUS)',
    captured === 'fishing relay: probe fixture', JSON.stringify(captured));

  /* ======================== PARTIE OCTETS RÉELS ========================= */
  const realZip = process.env.BOTWOW_PACKAGE_FIXTURE || null;
  if (!realZip) {
    console.log('  SKIP (réel) : env BOTWOW_PACKAGE_FIXTURE absente — l\'activation des octets réels n\'est PAS exécutée ici (jamais comptée comme succès).');
    console.log('  SKIP (réel) : preuve locale attendue via BOTWOW_PACKAGE_FIXTURE=<zip réel> (voir rapport de mission).');
  } else {
    check('activation réelle : le ZIP fourni existe', existsSync(realZip), realZip);
    if (existsSync(realZip)) {
      const realEntries = readZipEntries(realZip);
      const realManifest = JSON.parse(realEntries.get('MANIFEST.json').toString('utf8'));
      const dist = realManifest.distribution || {};
      check('activation réelle : le MANIFEST embarqué porte la whitelist attendue et la provenance ÉPINGLÉE',
        JSON.stringify(dist.addon?.whitelist) === JSON.stringify(['LiveErrorCapture.lua', 'CasinobabeFishing.lua'])
        && realManifest.source?.commit === PINNED_COMMIT
        && dist.mode === 'qa' && dist.eligible === false,
        JSON.stringify({ whitelist: dist.addon?.whitelist, commit: realManifest.source?.commit, mode: dist.mode }));
      const realToc = realEntries.get(ADDON_PREFIX + 'Casinobabe.toc').toString('utf8');
      const realFiles = tocFilesOf(realToc);
      check('activation réelle : ordre TOC exact [LiveErrorCapture.lua, CasinobabeFishing.lua]',
        realFiles.join('|') === 'LiveErrorCapture.lua|CasinobabeFishing.lua', realFiles.join('|'));

      const real = await newEngineWithTocLoaded('réel', realEntries, realToc);
      const rl = real.lua;
      check('activation réelle : les deux fichiers réels se chargent sans erreur (Lua 5.1)',
        Array.isArray(real.files) && real.files.length === 2, real.files.join('|'));
      // Trace du gestionnaire : [0]=base, [1]=après LEC, [2]=après fishing.
      check('activation réelle : LEC (octets réels) REMPLACE le gestionnaire de base (contrat ligne 69 : seulement si un précédent existe)',
        luaSync(rl, 'return type(__WoWMock.loadHandlers[0])=="function" '
          + 'and type(__WoWMock.loadHandlers[1])=="function" '
          + 'and __WoWMock.loadHandlers[1] ~= __WoWMock.loadHandlers[0]') === true);
      check('activation réelle : Casinobabe.Fishing expose l\'API réelle (STATES/OnEvent/GetStatus/Activate)',
        luaSync(rl, 'return type(Casinobabe)=="table" and type(Casinobabe.Fishing)=="table" '
          + 'and type(Casinobabe.Fishing.OnEvent)=="function" and Casinobabe.Fishing.STATES ~= nil '
          + 'and type(Casinobabe.Fishing.GetStatus)=="function" and type(Casinobabe.Fishing.Activate)=="function"') === true);
      check('activation réelle : /cbfish déclarée (SLASH_CASINOBABEFISH1) et SlashCmdList["CASINOBABEFISH"] appelable',
        luaSync(rl, 'return SLASH_CASINOBABEFISH1=="/cbfish" and type(SlashCmdList["CASINOBABEFISH"])=="function"') === true);
      check('activation réelle : frame d\'événements réelle créée (Casinobabe_FishingEvents) avec PLAYER_LOGIN et LOOT_OPENED',
        luaSync(rl, 'return __WoWMock.frames["Casinobabe_FishingEvents"] ~= nil '
          + 'and (function() local hasLogin, hasLoot = false, false for _,e in ipairs(__WoWMock.events) do '
          + 'if e.event=="PLAYER_LOGIN" then hasLogin = true end if e.event=="LOOT_OPENED" then hasLoot = true end end '
          + 'return hasLogin and hasLoot end)()') === true);
      check('activation réelle : init réussissant sous le mock, le gestionnaire LEC reste installé (identité préservée)',
        luaSync(rl, 'return __WoWMock.loadHandlers[2] == __WoWMock.loadHandlers[1]') === true,
        'init fishing échouée sous le mock (cf. CasinobabeFishing.lua:1399) ; journal : '
        + JSON.stringify(luaSync(rl, 'return table.concat(__WoWMock.chatLog, " | ")')));
      // Sonde réelle : Capture filtre sur le mot « Casinobabe » (LEC ligne 44).
      await rl.doString('local h = geterrorhandler() pcall(h, "probe activation Casinobabe")');
      const realCaptured = luaSync(rl,
        'local p = CasinobabeErrorBus.GetPending() if #p == 0 then return "" end return tostring(p[#p].message)');
      check('activation réelle : la sonde d\'erreur est capturée par le BUS RÉEL (mot-clé Casinobabe requis)',
        typeof realCaptured === 'string' && realCaptured.includes('probe activation Casinobabe'),
        JSON.stringify(realCaptured));
    }
  }
} catch (err) {
  check('activation : exception inattendue', false, String((err && err.stack) || err));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const realZipRan = !!process.env.BOTWOW_PACKAGE_FIXTURE;
if (!realZipRan) {
  console.log('RÉSUMÉ : fixtures vérifiés ; OCTETS RÉELS non exécutés (env BOTWOW_PACKAGE_FIXTURE absente) — jamais comptés comme succès.');
}
process.exit(finish('ACTIVATION'));
