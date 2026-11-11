#!/usr/bin/env node
/**
 * memory.cjs — persistance de la mémoire du pont Factory V3 dans BOT-WOW
 * (`.ai/autopilot/`).
 *
 * PORT depuis `aveca/sargagame` (PR #1349, merge commit
 * `87702066a79c03ff930500a2bad524df58c1f6f7`), fichier
 * `scripts/autopilot/lib/memory.cjs`.
 *
 * Adaptation BOT-WOW : sous-ensemble STRICT des fonctions utilisées par
 * `multi-repo-bridge.cjs` :
 *   - `loadQueue` / `saveQueue` : queue des opportunités ;
 *   - `writeOpportunityFile` : fiche markdown d'une opportunité importée.
 *
 * Les fonctions de Sargagame hors périmètre du pont (updateOpportunity,
 * loadRejected, reject, writeRegression, writeRunReport, listRuns) ne sont PAS
 * portées : le pont ne les appelle pas, et les porter reviendrait à inventer
 * un runner autopilot complet dans BOT-WOW — hors mission.
 *
 * Zéro écriture hors `.ai/autopilot/` (répertoire ignoré par git).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { AP_DIR, paths, readJSON, writeJSON, nowIso } = require('./common.cjs');

/**
 * Queue des opportunités.
 * Schéma identique à Sargagame : `{ opportunities: [...] }`.
 * Le pont y ajoute une opportunité par mission importée ; il n'y a jamais
 * d'opportunité pour une mission d'un AUTRE dépôt (routage strict).
 */
function loadQueue() {
  return readJSON(paths.queue, { opportunities: [] });
}

function saveQueue(q) { writeJSON(paths.queue, q); }

/**
 * Fiche markdown d'une opportunité (une par mission importée localement).
 * Le format est celui de Sargagame : la fiche reste lisible par l'opérateur.
 */
function writeOpportunityFile(opp) {
  const p = path.join(paths.opportunities, `${opp.id}.md`);
  const md = `# ${opp.id} — ${opp.title}\n\n` +
    `- **source** : ${opp.source}\n- **sévérité** : ${opp.severity} · **confiance** : ${opp.confidence}\n` +
    `- **actionable** : ${opp.actionable}${opp.recipe ? ` (recette \`${opp.recipe}\`)` : ''}\n` +
    `- **preuve** : ${opp.evidence || 'n/a'}\n- **impact attendu** : ${opp.expectedImpact || 'n/a'}\n` +
    `- **rollback** : ${opp.rollback || 'revert du commit'}\n- **statut** : ${opp.status}\n\n_Généré par l'autopilot le ${nowIso()}_\n`;
  fs.mkdirSync(paths.opportunities, { recursive: true });
  fs.writeFileSync(p, md, 'utf8');
  return p;
}

module.exports = {
  loadQueue, saveQueue, writeOpportunityFile,
  AP_DIR,
};
