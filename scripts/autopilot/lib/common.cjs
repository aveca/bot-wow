#!/usr/bin/env node
/**
 * common.cjs — bases partagées du pont Factory V3 dans BOT-WOW.
 *
 * PORT depuis `aveca/sargagame` (PR #1349, merge commit
 * `87702066a79c03ff930500a2bad524df58c1f6f7`), fichier
 * `scripts/autopilot/lib/common.cjs`.
 *
 * Adaptation BOT-WOW : AUCUNE sur le contrat.
 *   - l'arborescence est identique (`scripts/autopilot/lib/` → racine du dépôt
 *     en remontant de 3 niveaux), donc `ROOT` pointe sur BOT-WOW ;
 *   - la mémoire locale reste sous `.ai/autopilot/`, répertoire ignoré par git
 *     (le runner ne versionne jamais sa queue) ;
 *   - seules les fonctions réellement utilisées par le pont sont conservées
 *     (`ensureDirs`, `readJSON`, `writeJSON`, `nowIso`, `paths`) : aucune
 *     fonction de Sargagame n'est réinventée ici.
 *
 * Zéro dépendance externe. CommonJS (le runner Windows l'exécute directement).
 */
'use strict';
const fs = require('fs');
const path = require('path');

/** Racine du dépôt BOT-WOW (scripts/autopilot/lib → ../../..). */
const ROOT = path.resolve(__dirname, '..', '..', '..');

/** Mémoire locale du runner (hors dépôt versionné). */
const AP_DIR = path.join(ROOT, '.ai', 'autopilot');

/**
 * Répertoires créés par `ensureDirs()`.
 * Sous-ensemble strict de ceux de Sargagame : seuls ceux dont le pont a
 * besoin (opportunités, rapports de run, décisions anti-répétition).
 */
const DIRS = [
  'opportunities',
  'runs',
  'decisions',
];

function ensureDirs() {
  for (const d of DIRS) {
    fs.mkdirSync(path.join(AP_DIR, d), { recursive: true });
  }
}

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return fallback; }
}

function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, p); // écriture atomique — un crash ne laisse jamais un JSON tronqué
}

function nowIso() { return new Date().toISOString(); }

module.exports = {
  ROOT, AP_DIR, DIRS, ensureDirs, readJSON, writeJSON, nowIso,
  paths: {
    queue: path.join(AP_DIR, 'queue.json'),
    latestMd: path.join(AP_DIR, 'latest.md'),
    rejected: path.join(AP_DIR, 'decisions', 'rejected.json'),
    runs: path.join(AP_DIR, 'runs'),
    opportunities: path.join(AP_DIR, 'opportunities'),
    runnerLog: path.join(AP_DIR, 'runs', 'runner.log'),
  },
};
