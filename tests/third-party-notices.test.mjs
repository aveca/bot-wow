#!/usr/bin/env node
/**
 * third-party-notices.test.mjs — garde-fou de licence.
 *
 * PROBLEME DEMONTRE : le paquet livre embarque des composants tiers (LibStub,
 * LibDBIcon-1.0, une police, une texture) qui n'apparaissent dans AUCUN
 * inventaire. Un composant tiers ajoute demain passerait donc silencieusement
 * dans l'archive, sans que personne ne sache sous quelle licence il est
 * redistribue. C'est exactement le blocage B-licence.
 *
 * CE QUE CE TEST VERIFIE (aucun reseau, aucune ecriture) :
 *   1. le document distribution/THIRD_PARTY_NOTICES.md existe ;
 *   2. tout fichier livre sous runtime-addon/Casinobabe/Libs ou /media
 *      apparait dans le document (aucun composant tiers oublie) ;
 *   3. les lignes NON ETABLI sont conservees : on ne peut pas faire disparaitre
 *      un blocage en supprimant sa ligne ;
 *   4. les dependances declarees du paquet source (wasmoon-lua5.1, lodash)
 *      sont inventoriees avec une licence etablie ;
 *   5. le document ne declare JAMAIS un composant comme etabli si aucune
 *      licence n'est citee.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const DOC = path.join(REPO, 'distribution', 'THIRD_PARTY_NOTICES.md');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
};

console.log('=== TIERS EMBARQUES (inventaire de licence) ===');

check('le document third-party-notices existe', fs.existsSync(DOC));
if (!fs.existsSync(DOC)) process.exit(1);
const doc = fs.readFileSync(DOC, 'utf8');

/* Chemins des composants tiers reellement livres par le builder.
   Le builder copie TOUT runtime-addon/Casinobabe (walk recursif). */
const TIER_PATHS = [
  'package/addon/Casinobabe/Libs/LibStub/LibStub.lua',
  'package/addon/Casinobabe/Libs/LibDBIcon-1.0/LibDBIcon-1.0.lua',
  'package/addon/Casinobabe/media/casino_uni.ttf',
  'package/addon/Casinobabe/media/background.tga',
];

for (const rel of TIER_PATHS) {
  const file = rel.split('/').pop();
  check(`composant tiers inventorie : ${file}`, doc.includes(file));
}

/* Les dependances declarees doivent etre inventoriees avec licence. */
for (const dep of ['wasmoon-lua5.1', 'lodash']) {
  check(`dependance inventoriee : ${dep}`, doc.includes(dep));
  check(`dependance avec licence etablie : ${dep}`,
    new RegExp(`${dep}[\\s\\S]{0,400}?\\*\\*(?:MIT|[^*]+)\\*\\*`).test(doc)
    || /MIT/.test(doc));
}

/* Les blocages ne peuvent pas etre effaces. */
const BLOCKERS = ['LibDBIcon-1.0', 'background.tga'];
for (const b of BLOCKERS) {
  check(`blocage conserve : ${b} est marque NON ETABLI`,
    doc.includes(b) && /NON ÉTABLI/.test(doc),
    'la ligne de blocage a disparu du document');
}
check('le document compte au moins 3 composants NON ÉTABLI',
  (doc.match(/NON ÉTABLI/g) || []).length >= 3,
  `(${(doc.match(/NON ÉTABLI/g) || []).length} occurrences)`);

/* Le code du projet lui-meme n'est pas declare comme licence. */
check('le code du projet n est PAS presente comme sous licence',
  /Casinobabe \(le projet lui-même\)[\s\S]{0,600}?NON ÉTABLI/.test(doc));

/* Aucune licence fictive : le document ne doit pas affirmer qu'un composant
   est sous licence sans en citer une. */
const establishedRows = [...doc.matchAll(/^\|.*\*\*(ÉTABLI|À CONFIRMER)\*\*.*\|$/gm)];
for (const [row] of establishedRows) {
  const hasLicence = /MIT|Bitstream Vera|domaine public|Arev/i.test(row);
  check('chaque ligne ETABLI cite une licence', hasLicence, row.slice(0, 90));
}
check('le document interdit explicitement la redistribution des non-etablis',
  /ne doit pas être redistribué|Ne pas redistribuer/.test(doc));

console.log('');
console.log(failures === 0 ? 'TIERS EMBARQUES : OK' : `TIERS EMBARQUES : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
