#!/usr/bin/env node
/**
 * package-fixture.mjs — source de test partagée par les suites du packaging
 * BOT-WOW (installation, activation). UNE SEULE définition du contenu fixture
 * pour que toutes les suites vérifient le même contrat, et une seule fabrique
 * de construction (invites explicites : arg() du builder lit la PREMIÈRE
 * occurrence, jamais de doublon dans argv).
 *
 * Les fixtures reproduisent les CONTRATS observés du runtime (table
 * CasinobabeErrorBus + chaînage du gestionnaire d'erreurs préexistant pour
 * LiveErrorCapture ; création de table + événement + commande slash +
 * chaînage pour le module pêche) sans copier le runtime propriétaire.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');
export const BUILD = join(REPO, 'scripts', 'build-package.cjs');
export const FIXTURE_VERSION = '9.9.8';
/* Dates figées : le hash du commit fixture ne dépend pas de l'horloge. */
export const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_AUTHOR_DATE: '2026-11-01T00:00:00+00:00',
  GIT_COMMITTER_DATE: '2026-11-01T00:00:00+00:00',
};

export function git(args, cwd) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', timeout: 20000, windowsHide: true, env: GIT_ENV,
  }).trim();
}

export function seedSource(dir) {
  mkdirSync(join(dir, 'runtime-addon', 'Casinobabe', 'media'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  // FIXTURE LiveErrorCapture : CONTRAT observé (table créée si absente +
  // capture dans BUS + délégation au gestionnaire précédent).
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'LiveErrorCapture.lua'),
    'CasinobabeErrorBus = CasinobabeErrorBus or { pending = {}, seq = 0 }\r\n'
    + 'local BUS = CasinobabeErrorBus\r\n'
    + 'local previousErrorHandler = geterrorhandler and geterrorhandler()\r\n'
    + 'if seterrorhandler then\r\n'
    + '  seterrorhandler(function(message)\r\n'
    + '    BUS.seq = BUS.seq + 1\r\n'
    + '    table.insert(BUS.pending, { seq = BUS.seq, message = message })\r\n'
    + '    if previousErrorHandler then pcall(previousErrorHandler, message) end\r\n'
    + '  end)\r\n'
    + 'end\r\n');
  // FIXTURE module pêche : crée la table, enregistre un événement, déclare
  // une commande slash ET chaîne SON gestionnaire sur le précédent (contrat
  // observé de CasinobabeFishing.lua : wrapper -> previousErrorHandler).
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'CasinobabeFishing.lua'),
    'local CB = Casinobabe or {}\r\n'
    + 'Casinobabe = CB\r\n'
    + 'if seterrorhandler and geterrorhandler then\r\n'
    + '  local prev = geterrorhandler()\r\n'
    + '  seterrorhandler(function(message)\r\n'
    + '    if prev then pcall(prev, "fishing relay: " .. tostring(message)) end\r\n'
    + '  end)\r\n'
    + 'end\r\n'
    + 'local f = CreateFrame("Frame", "CasinobabeFishingFrame", UIParent)\r\n'
    + 'f:RegisterEvent("PLAYER_LOGIN")\r\n'
    + 'SLASH_CASINOBABEFISHING1 = "/cbfishing"\r\n'
    + 'SlashCmdList["CASINOBABEFISHING"] = function(msg) end\r\n'
    + 'CB.Fishing = { version = "fixture" }\r\n');
  // Le core casino historique : exclu de la liste blanche, rien de livré.
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'Casinobabe.lua'),
    'local CB = Casinobabe or {}\r\nCasinobabe = CB\r\nfunction CB.Bet() end\r\n');
  // TOC du runtime casino : remplacée dans le paquet par la TOC générée.
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'Casinobabe.toc'),
    '## Interface: 20506\r\nLiveErrorCapture.lua\r\nCasinobabe.lua\r\nCasinobabeFishing.lua\r\n');
  // Police tierce non requise par la pêche (droits non établis).
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'media', 'casino_uni.ttf'),
    '\x00\x01\x02police');
  // Scripts BOT minuscules (le builder copie BOT_FILES si présent).
  writeFileSync(join(dir, 'scripts', 'fishing_bot.py'), 'import fishing_controls\nimport fishing_spots\n');
  writeFileSync(join(dir, 'scripts', 'fishing_controls.py'), 'import fishing_spots\n');
  writeFileSync(join(dir, 'scripts', 'fishing_spots.py'), 'print("spots")\n');
  writeFileSync(join(dir, 'scripts', 'focus_broker.py'), 'print("broker")\n');
}

export function makeGitSource(tmp, name) {
  const dir = join(tmp, name);
  seedSource(dir);
  git(['init', '-b', 'feat/fishing-route-intelligence-v2'], dir);
  git(['remote', 'add', 'origin', 'https://github.com/aveca/Casinobabe.git'], dir);
  git(['add', '-A'], dir);
  git(['commit', '-m', 'source de test (fixture whitelist factory#82)'], dir);
  return { dir, head: git(['rev-parse', 'HEAD'], dir) };
}

/* arg() du builder prend la PREMIÈRE occurrence : les invites sont
   construites explicitement, jamais en doublon dans argv. */
export function buildArgs({ source, commit, out, version = FIXTURE_VERSION, release = false, overrides = true } = {}) {
  const args = [BUILD, '--source', source.dir, '--version', version, '--out', out];
  if (overrides) {
    args.push(
      '--source-repo', 'aveca/Casinobabe',
      '--source-ref', 'feat/fishing-route-intelligence-v2',
      '--source-commit', commit,
    );
  }
  if (release) args.push('--release');
  return args;
}

export function runBuild(args, env = { ...process.env, SOURCE_DATE_EPOCH: '1794009600' }) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env });
  return { status: r.status, text: (r.stdout || '') + '\n' + (r.stderr || '') };
}

export function makeCheck() {
  const state = { failures: 0 };
  state.check = (name, ok, detail = '') => {
    if (ok) console.log(`  ok   ${name}`);
    else { state.failures += 1; console.log(`  FAIL ${name} ${detail}`); }
  };
  state.finish = (label) => {
    console.log('');
    console.log(state.failures === 0 ? `${label} : OK` : `${label} : ${state.failures} ÉCHEC(S)`);
    return state.failures === 0 ? 0 : 1;
  };
  return state;
}
