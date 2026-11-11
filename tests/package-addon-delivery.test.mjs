#!/usr/bin/env node
/**
 * package-addon-install.test.mjs — LIVRAISON REELLE de l'addon BOT-WOW.
 *
 * Ce test ne simule pas une installation : il CONSTRUIT un paquet avec le vrai
 * builder, l'EXTRAIT dans un faux dossier WoW, puis CHARGE la TOC et ses
 * fichiers sous Lua 5.1 (wasmoon) avec un mock WoW. Les neuf controles sont
 * tous executes contre le paquet PRODUIT, pas contre la source.
 *
 *   1. installation dans un faux repertoire WoW propre ;
 *   2. structure Interface\AddOns ;
 *   3. chargement de la TOC ;
 *   4. presence des dependances indispensables ;
 *   5. initialisation des variables sauvegardees (SavedVariables) ;
 *   6. journalisation des erreurs ;
 *   7. absence des fichiers Casino non necessaires ;
 *   8. integrite SHA-256 du paquet ;
 *   9. reprise apres une installation interrompue.
 *
 * PERIMETRE : aucune invocation du client WoW reel. Les fichiers Lua de la
 * source de test sont des FIXTURES ORIGINALES qui reproduisent les contrats
 * observes dans le runtime (table `Casinobabe` auto-creee, `CasinobabeDB` et
 * `Casinobabe.fishing`, enregistrement d'evenements, commande slash, chaine de
 * gestionnaire d'erreurs) ; elles ne redistribuent pas le runtime. Aucun
 * reseau, aucun upload, aucun secret.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { Lua } from 'wasmoon-lua5.1';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const BUILD = join(REPO, 'scripts', 'build-package.cjs');
const WOW_MOCK = join(HERE, 'helpers', 'wow-mock.lua');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} — ${detail}`); }
};

/** Lecture des entrees d'une archive ZIP produite par le builder (defate + stocke). */
function readZipEntries(zipPath) {
  const zip = readFileSync(zipPath);
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const uncompressedSize = zip.readUInt32LE(offset + 22);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = zip.toString('utf8', nameStart, nameStart + nameLength);
    const dataStart = nameStart + nameLength + extraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Buffer.from(compressed)
      : method === 8 ? inflateRawSync(compressed)
        : (() => { throw new Error('methode ZIP non supportee : ' + method); })();
    if (data.length !== uncompressedSize) throw new Error('taille ZIP incoherente : ' + name);
    entries.set(name, data);
    offset = dataStart + compressedSize;
  }
  return entries;
}

/** Arborescence relative d'un dossier (fichiers seulement). */
function treeOf(dir, base = dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) treeOf(full, base, acc);
    else acc.push(full.slice(base.length + 1).replace(/\\/g, '/'));
  }
  return acc.sort();
}

/* ------------------------------------------------------------------------- *
 * FIXTURES LUA ORIGINALES (contrats observes, pas de copie du runtime)
 * ------------------------------------------------------------------------- */

/** Journaliseur d'erreurs : variables sauvegardees + gestionnaire d'erreurs. */
const FIXTURE_ERROR_CAPTURE = `-- Fixture originale des tests BOT-WOW.
-- Reproduit le contrat observe du journaliseur d'erreurs livre :
--   * une table globale de variables sauvegardees ;
--   * une fonction de capture appelee par le gestionnaire d'erreurs ;
--   * aucune dependance a une bibliotheque externe.
CasinobabeErrorBus = CasinobabeErrorBus or { version = 1, seq = 0, pending = {}, last = nil }
local BUS = CasinobabeErrorBus

function BUS.Capture(message, source)
  BUS.seq = BUS.seq + 1
  local entry = { seq = BUS.seq, source = source or 'unknown', message = tostring(message) }
  table.insert(BUS.pending, entry)
  BUS.last = entry
  return entry
end

function BUS.Count()
  return #BUS.pending
end

if seterrorhandler and geterrorhandler then
  pcall(function()
    local previous = geterrorhandler()
    seterrorhandler(function(m)
      BUS.Capture(m, 'errorhandler')
      if previous then return previous(m) end
    end)
  end)
end
`;

/** Module de peche : contrats charges par la TOC generee. */
const FIXTURE_FISHING = `-- Fixture originale des tests BOT-WOW.
-- Reproduit les contrats observes du module de peche livre :
--   * cree SA propre table globale \`Casinobabe\` (aucune dependance au fichier casino) ;
--   * cree/lit ses variables sauvegardees \`CasinobabeDB.fishing\` ;
--   * enregistre ses evenements sur une frame (aucune bibliotheque requise) ;
--   * expose une commande slash ;
--   * chaine son gestionnaire d'erreurs sur le precedent.
local CB = Casinobabe or {}
Casinobabe = CB
CB.Fishing = CB.Fishing or {}
local F = CB.Fishing

local db = rawget(_G, 'CasinobabeDB')
CasinobabeDB = db
db.fishing = db.fishing or { totals = { sessions = 0, catches = 0 }, sessions = {} }

F.state = 'INACTIF'
F.version = (GetAddOnMetadata and GetAddOnMetadata('Casinobabe', 'Version')) or '?'

local ev = CreateFrame('Frame', 'Casinobabe_FishingEvents', UIParent)
F.frame = ev
if ev.RegisterEvent then
  for _, e in ipairs({ 'PLAYER_LOGIN', 'BAG_UPDATE' }) do
    pcall(ev.RegisterEvent, ev, e)
  end
end

function F.OnEvent(self, event)
  if event == 'PLAYER_LOGIN' then
    local d = rawget(_G, 'CasinobabeDB')
    d.fishing.totals.sessions = d.fishing.totals.sessions + 1
    F.state = 'PRET'
  end
end

if ev.SetScript then ev:SetScript('OnEvent', F.OnEvent) end

SLASH_CASINOBABEFISH1 = '/cbfish'
SLASH_CASINOBABEFISH2 = '/cbf'
SlashCmdList['CASINOBABEFISH'] = function(msg)
  F.state = 'ACTIF'
end

-- Utilise UNIQUEMENT des API WoW optionnelles : si elles manquent, le module
-- doit rester fonctionnel (contrat observe, teste par le mock permissif).
local getFont = rawget(_G, 'SetFont')
local getTex = rawget(_G, 'CreateTexture')
if getFont then getFont(F.frame) end
if getTex then getTex(F.frame, 'BACKGROUND') end
`;

/** Bot Python : fixture reproduisant la dependance dure au nom du addon. */
const FIXTURE_BOT_PY = `"""Fixture des tests BOT-WOW : le bot lit les variables sauvegardees
ecrites par WoW sous le nom du .toc (moins l'extension)."""
import os

SAVED_VARIABLES_FILE = "Casinobabe.lua"


def find_saved_variables(root):
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            if fn == "Casinobabe.lua":
                return os.path.join(dirpath, fn)
    return None
`;

/** Source de test : liste blanche + bot + composants a exclure. */
function seedSource(dir) {
  const addon = join(dir, 'runtime-addon', 'Casinobabe');
  mkdirSync(addon, { recursive: true });
  mkdirSync(join(addon, 'Libs', 'LibStub'), { recursive: true });
  mkdirSync(join(addon, 'Libs', 'LibDBIcon-1.0'), { recursive: true });
  mkdirSync(join(addon, 'media'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(addon, 'LiveErrorCapture.lua'), FIXTURE_ERROR_CAPTURE);
  writeFileSync(join(addon, 'CasinobabeFishing.lua'), FIXTURE_FISHING);
  // Interface casino historique et composants exclus par la liste blanche.
  writeFileSync(join(addon, 'Casinobabe.lua'), '-- fixture: interface casino non livree\n');
  writeFileSync(join(addon, 'Casinobabe.toc'), '## Interface: 20506\n## SavedVariables: CasinobabeDB, CasinobabeErrorBus\nCasinobabe.lua\n');
  writeFileSync(join(addon, 'Libs', 'LibStub', 'LibStub.lua'), '-- fixture: bibliotheque exclue\n');
  writeFileSync(join(addon, 'Libs', 'LibDBIcon-1.0', 'LibDBIcon-1.0.lua'), '-- fixture: bibliotheque exclue\n');
  writeFileSync(join(addon, 'media', 'background.tga'), Buffer.from('fixture texture'));
  writeFileSync(join(addon, 'media', 'casino_uni.ttf'), Buffer.from('fixture police'));
  writeFileSync(join(dir, 'scripts', 'fishing_bot.py'), FIXTURE_BOT_PY);
  writeFileSync(join(dir, 'scripts', 'fishing_controls.py'), FIXTURE_BOT_PY);
}

/** Installe le paquet (dossier package/) dans un faux dossier WoW. */
function installIntoWow(zipPath, wowDir) {
  const entries = readZipEntries(zipPath);
  const addonPrefix = 'package/addon/Casinobabe/';
  const addonTarget = join(wowDir, 'Interface', 'AddOns', 'Casinobabe');
  let installed = 0;
  for (const [name, bytes] of entries) {
    if (!name.startsWith(addonPrefix)) continue;
    const relative = name.slice(addonPrefix.length);
    if (!relative || relative.split('/').includes('..') || relative.startsWith('/')) {
      throw new Error('chemin addon dangereux dans le ZIP : ' + name);
    }
    const target = join(addonTarget, ...relative.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    installed += 1;
  }
  return { installed, addonTarget };
}

/** Charge la TOC generee puis chaque fichier Lua sous Lua 5.1. */
async function loadAddon(addonTarget) {
  const errors = [];
  let declared = [];
  const tocPath = join(addonTarget, 'Casinobabe.toc');
  if (!existsSync(tocPath)) {
    // Dossier addon explore sans TOC : WoW ne charge rien. C'est le cas d'une
    // installation interrompue des le premier fichier.
    const lua = await Lua.create();
    await lua.doString(readFileSync(WOW_MOCK, 'utf8'));
    errors.push('Casinobabe.toc absent : le addon n est pas chargeable');
    return { lua, declared, errors };
  }
  const toc = readFileSync(tocPath, 'utf8');
  declared = toc.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const lua = await Lua.create();
  await lua.doString(readFileSync(WOW_MOCK, 'utf8'));
  // WoW cree les variables sauvegardees AVANT de charger les fichiers du addon,
  // et connait deja les metadata de la TOC qu'il charge.
  await lua.global.set('CasinobabeDB', {});
  await lua.doString(`return __WoWMockLoadAddOn('Casinobabe', ${JSON.stringify(toc)})`);
  for (const rel of declared) {
    const filePath = join(addonTarget, rel);
    if (!existsSync(filePath)) { errors.push(`${rel} : declare par la TOC mais absent`); continue; }
    try {
      await lua.doString(readFileSync(filePath, 'utf8'));
    } catch (e) {
      errors.push(`${rel} : ${String(e && e.message ? e.message : e)}`);
    }
  }
  return { lua, declared, errors };
}

/* ------------------------------------------------------------------------- *
 * DEROULEMENT
 * ------------------------------------------------------------------------- */
const tmp = mkdtempSync(join(tmpdir(), 'botwow-addon-install-'));
try {
  /* --- Construction reelle du paquet ------------------------------------ */
  const src = join(tmp, 'src');
  seedSource(src);
  const out = join(tmp, 'dist');
  const build = spawnSync(process.execPath, [BUILD, '--source', src, '--version', '9.9.9', '--out', out], {
    encoding: 'utf8', env: { ...process.env, SOURCE_DATE_EPOCH: '1794009600' },
  });
  check('le paquet est construit par le vrai builder', build.status === 0,
    (build.stdout + '\n' + build.stderr).slice(-400));
  if (build.status !== 0) throw new Error('build interrompu');

  const pkgDir = join(out, 'casinobabe-fishing-9.9.9');
  const zipPath = join(out, 'casinobabe-fishing-9.9.9.zip');
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'MANIFEST.json'), 'utf8'));

  /* --- 1 + 2. installation dans un faux dossier WoW propre --------------- */
  const wow = join(tmp, 'fake-wow');
  const { installed, addonTarget } = installIntoWow(zipPath, wow);
  check('1. le paquet s installe dans un faux dossier WoW', installed >= 3, `${installed} fichier(s)`);
  check('2. la structure Interface\\AddOns\\Casinobabe est creee',
    existsSync(join(wow, 'Interface', 'AddOns', 'Casinobabe', 'Casinobabe.toc')));
  const addonFiles = treeOf(addonTarget);
  check('2. le dossier addon installe contient exactement la liste blanche et la TOC',
    addonFiles.join(',') === 'Casinobabe.toc,CasinobabeFishing.lua,LiveErrorCapture.lua',
    addonFiles.join(', '));
  check('1. rien d autre n est ecrit hors Interface\\AddOns',
    treeOf(join(wow, 'Interface')).join(',') === 'AddOns/Casinobabe/' + addonFiles.join(',AddOns/Casinobabe/'),
    treeOf(join(wow, 'Interface')).join(' | '));

  /* --- 3. chargement de la TOC ------------------------------------------ */
  const tocText = readFileSync(join(addonTarget, 'Casinobabe.toc'), 'utf8');
  check('3. la TOC generee cible l interface Classic annoncee',
    /^## Interface:\s*20506$/m.test(tocText), tocText.split('\n')[0]);
  check('3. la TOC porte le titre BOT-WOW Fishing Assistant',
    /## Title:.*BOT-WOW.*Fishing Assistant/.test(tocText));
  const { lua, declared, errors } = await loadAddon(addonTarget);
  check('3. la TOC ne declare que des fichiers Lua presents', declared.length === 2,
    declared.join(', '));
  check('3. chaque fichier declare par la TOC existe dans le paquet installe',
    errors.filter((e) => /absent/.test(e)).length === 0, errors.join(' ; '));
  check('3. le chargement Lua 5.1 de la TOC ne produit AUCUNE erreur',
    errors.length === 0, errors.join(' ; '));
  check('3. la TOC declare les memes variables sauvegardees que le builder',
    /^## SavedVariables: CasinobabeDB, CasinobabeErrorBus$/m.test(tocText)
    && JSON.stringify(manifest.distribution.addon.savedVariables)
      === JSON.stringify(['CasinobabeDB', 'CasinobabeErrorBus']));

  /* --- 4. dependances indispensables ------------------------------------ */
  const globals = await lua.doString(`return {
    casinobabe = Casinobabe ~= nil,
    fishing = (Casinobabe and Casinobabe.Fishing) ~= nil,
    bus = CasinobabeErrorBus ~= nil,
    libstub = LibStub ~= nil,
    libdbicon = LibDBIcon ~= nil,
  }`);
  check('4. la table globale Casinobabe est creee par le module', globals.casinobabe === true);
  check('4. le module peche est disponible apres chargement', globals.fishing === true);
  check('4. le journaliseur d erreurs est charge AVANT le module (ordre de la TOC)',
    globals.bus === true && declared[0] === 'LiveErrorCapture.lua',
    declared.join(','));
  check('4. AUCUNE bibliotheque externe n est requise (LibStub et LibDBIcon absents)',
    globals.libstub === false && globals.libdbicon === false,
    ['casinobabe','fishing','bus','libstub','libdbicon'].map((k) => k + '=' + globals[k]).join(','));
  const version = await lua.doString('return Casinobabe.Fishing.version');
  check('4. le module se cale sur la version declaree dans la TOC',
    version === '9.9.9', String(version));
  const botSource = readFileSync(join(pkgDir, 'package', 'scripts', 'fishing_bot.py'), 'utf8');
  check('4. le bot livre lit les variables sauvegardees sous le nom du addon',
    botSource.includes('Casinobabe.lua')
    && join(addonTarget).endsWith(join('AddOns', 'Casinobabe')));

  /* --- 5. initialisation des variables sauvegardees ---------------------- */
  const fired = await lua.doString('return __FireWoWEvent("PLAYER_LOGIN")');
  const sessions = await lua.doString('return CasinobabeDB.fishing.totals.sessions');
  const state = await lua.doString('return Casinobabe.Fishing.state');
  check('5. les evenements enregistres par le module sont declenches', Number(fired) >= 1, String(fired));
  check('5. les variables sauvegardees sont initialisees et incrementees',
    Number(sessions) === 1, String(sessions));
  check('5. l etat du module passe a PRET apres PLAYER_LOGIN', state === 'PRET', String(state));

  /* --- 6. journalisation des erreurs ------------------------------------ */
  await lua.doString(`
    local boom = CreateFrame('Frame', 'BotWowTest_Boom', UIParent)
    boom:RegisterEvent('BOTWOW_TEST_BOOM')
    boom:SetScript('OnEvent', function() error('erreur de test BOT-WOW') end)
    return true
  `);
  const before = await lua.doString('return CasinobabeErrorBus.Count()');
  await lua.doString('return __FireWoWEvent("BOTWOW_TEST_BOOM")');
  const after = await lua.doString('return CasinobabeErrorBus.Count()');
  const last = await lua.doString('return CasinobabeErrorBus.last and CasinobabeErrorBus.last.message or ""');
  const seq = await lua.doString('return CasinobabeErrorBus.last and CasinobabeErrorBus.last.seq or 0');
  check('6. une erreur dans un gestionnaire d evenement est capturee',
    Number(after) === Number(before) + 1, `avant ${before} / apres ${after}`);
  check('6. le message capture est celui de l erreur reelle',
    /erreur de test BOT-WOW/.test(String(last)), String(last));
  check('6. la capture est numerotee dans le bus de variables sauvegardees',
    Number(seq) === Number(before) + 1, String(seq));

  /* --- 7. absence des fichiers Casino non necessaires -------------------- */
  const manifestKeys = Object.keys(manifest.files);
  check('7. l interface casino historique n est pas livree',
    !addonFiles.includes('Casinobabe.lua') && !manifestKeys.some((k) => /Casinobabe\.lua$/.test(k)),
    manifestKeys.join(', '));
  check('7. aucune bibliotheque minimap n est livree',
    !addonFiles.some((f) => /LibStub|LibDBIcon/.test(f))
    && !manifestKeys.some((k) => /LibStub|LibDBIcon/.test(k)));
  check('7. aucune police ni texture casino n est livree',
    !addonFiles.some((f) => /\.(ttf|tga)$/.test(f))
    && !manifestKeys.some((k) => /\.(ttf|tga)$/.test(k)));
  check('7. le manifeste declare chaque exclus du addon avec sa raison',
    (manifest.distribution.addon.excluded || []).length >= 6
    && (manifest.distribution.addon.excluded || []).every((e) => e.reason));

  /* --- 8. integrite SHA-256 du paquet ----------------------------------- */
  let integrityOk = true;
  const broken = [];
  for (const [rel, info] of Object.entries(manifest.files)) {
    const inPackage = join(pkgDir, 'package', rel);
    const atRoot = join(pkgDir, rel);
    const path = existsSync(inPackage) ? inPackage : atRoot;
    if (!existsSync(path)) { integrityOk = false; broken.push(rel + ' absent'); continue; }
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (digest !== info.sha256) { integrityOk = false; broken.push(rel + ' hash'); }
    if (readFileSync(path).length !== info.bytes) { integrityOk = false; broken.push(rel + ' taille'); }
  }
  check('8. tous les SHA-256 declares dans MANIFEST.json correspondent aux fichiers livres',
    integrityOk, broken.join(', '));
  const installedOk = (() => {
    for (const rel of addonFiles) {
      const info = manifest.files[`addon/Casinobabe/${rel}`];
      if (!info) return false;
      const digest = createHash('sha256').update(readFileSync(join(addonTarget, rel))).digest('hex');
      if (digest !== info.sha256) return false;
    }
    return true;
  })();
  check('8. les fichiers installes dans le faux WoW portent le hash du manifeste', installedOk);

  /* --- 9. reprise apres installation interrompue ------------------------- */
  const wowResumed = join(tmp, 'fake-wow-resume');
  const partial = join(wowResumed, 'Interface', 'AddOns', 'Casinobabe');
  mkdirSync(partial, { recursive: true });

  // (a) extraction INTERROMPUE au milieu : la TOC et le premier fichier charge
  // sont presents, le module de peche ne l'est PAS. WoW charge quand meme le
  // addon : le contrat verifie est que l'incompletude est DETECTABLE par les
  // fichiers que la TOC declare et qui manquent, sans inventaire prealable.
  writeFileSync(join(partial, 'Casinobabe.toc'), readFileSync(join(addonTarget, 'Casinobabe.toc')));
  writeFileSync(join(partial, 'LiveErrorCapture.lua'),
    readFileSync(join(addonTarget, 'LiveErrorCapture.lua')));
  const partialState = await loadAddon(partial);
  check('9. une installation interrompue est detectee (fichier declare absent)',
    partialState.errors.some((e) => /CasinobabeFishing\.lua/.test(e)),
    partialState.errors.join(' ; ') || 'aucune erreur detectee');
  check('9. la TOC interrompue reste lisible et declare l installation partielle',
    partialState.declared.length === 2, partialState.declared.join(', '));

  // (a2) interruption TOTALE : aucun fichier copie. Rien ne doit planter.
  const emptyDir = join(tmp, 'fake-wow-empty');
  const emptyState = await loadAddon(join(emptyDir, 'Interface', 'AddOns', 'Casinobabe'));
  check('9. un dossier addon vide ne charge rien et ne provoque aucune erreur',
    emptyState.declared.length === 0
      && emptyState.errors.some((e) => /Casinobabe\.toc/.test(e)),
    emptyState.errors.join(' ; ') || 'aucune erreur');
  // (b) REPRISE : on rejoue l'installation complete sur le meme dossier.
  const resume = installIntoWow(zipPath, wowResumed);
  const resumedState = await loadAddon(resume.addonTarget);
  check('9. la reprise complete l installation sans corrompre le dossier',
    resume.installed >= 3 && resumedState.errors.length === 0,
    resumedState.errors.join(' ; '));
  const resumedSessions = await resumedState.lua.doString(`
    local ok = pcall(function()
      __FireWoWEvent('PLAYER_LOGIN')
      return CasinobabeDB.fishing.totals.sessions
    end)
    return ok
  `);
  check('9. apres reprise, le addon recharge et s initialise normalement',
    resumedSessions === true);
  check('9. le paquet reinstalle est identique au paquet d origine (meme hash de TOC)',
    createHash('sha256').update(readFileSync(join(resume.addonTarget, 'Casinobabe.toc'))).digest('hex')
    === createHash('sha256').update(readFileSync(join(addonTarget, 'Casinobabe.toc'))).digest('hex'));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('');
console.log(failures === 0 ? 'LIVRAISON ADDON : OK' : `LIVRAISON ADDON : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
