#!/usr/bin/env node
/**
 * third-party-notices.test.mjs — garde-fou d'instantané juridique.
 *
 * PORTÉE : les quatre composants tiers identifiés dans les archives R2 1.2.0
 * et 1.2.1 relues le 2026-11-08. La source runtime n'étant pas versionnée dans
 * ce dépôt, ce test ne prétend PAS parcourir dynamiquement un nouveau ZIP.
 * Toute nouvelle archive doit être inspectée et ses empreintes ajoutées ici.
 *
 * Aucun réseau, aucune écriture, aucun secret.
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

console.log('=== THIRD-PARTY NOTICE SNAPSHOT GUARD ===');
check('le document third-party-notices existe', fs.existsSync(DOC));
if (!fs.existsSync(DOC)) process.exit(1);
const doc = fs.readFileSync(DOC, 'utf8');

const SNAPSHOTS = [
  ['casinababe-fishing-1.2.0.zip', '1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f'],
  ['casinababe-fishing-1.2.1.zip', 'ef294998a1ac5ce703739f7541ac63d0e61191f55fa8a7129b420b38adf79132'],
];
for (const [name, sha] of SNAPSHOTS) {
  check(`instantané R2 documenté : ${name}`, doc.includes(name) && doc.includes(sha));
}

const COMPONENTS = [
  ['LibDBIcon-1.0.lua', '423a81279f10542cfca09441c4ec21f5433e3203e349162d677acf0519705ac9'],
  ['LibStub.lua', '6f704d6c93c6c156379d9b6789082ae6d96e4ea939e393bbf87f8791661f7c37'],
  ['background.tga', '89e8ecd08fac85003a302ae52093acd7e41c862be4517c87611074ce213e798b'],
  ['casino_uni.ttf', '7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954'],
];
for (const [name, sha] of COMPONENTS) {
  check(`composant et empreinte documentés : ${name}`, doc.includes(name) && doc.includes(sha));
}

const inventoryStart = doc.indexOf('## Inventaire vérifié');
const inventoryEnd = doc.indexOf('## Textes de licence à joindre au paquet', inventoryStart);
const inventorySection = inventoryStart >= 0
  ? doc.slice(inventoryStart, inventoryEnd >= 0 ? inventoryEnd : doc.length)
  : '';
const rows = inventorySection.split(/\r?\n/).filter(line => /^\|/.test(line));
const rowFor = label => rows.find(line => line.includes(label));
const licenseCell = row => row ? row.split('|').map(cell => cell.trim()).filter(Boolean)[4] || '' : '';

for (const label of ['DejaVu Sans', 'wasmoon-lua5.1', 'lodash']) {
  const row = rowFor(label);
  check(`ligne d'inventaire présente : ${label}`, Boolean(row));
  if (row) {
    const licence = licenseCell(row);
    const expected = label === 'DejaVu Sans' ? /Bitstream Vera/.test(licence) && /Arev/.test(licence) : /MIT/.test(licence);
    check(`licence dans la cellule propre : ${label}`, expected, licence);
  }
}

for (const label of ['LibDBIcon-1.0', 'background.tga']) {
  const row = rowFor(label);
  check(`blocage historique conservé comme NON ÉTABLI : ${label}`, Boolean(row && /NON ÉTABLI/.test(row)));
}
const ownerCodeRow = rowFor('Casinobabe (le projet lui-même)');
check('le code original porte la déclaration du titulaire mais reste bloqué par les conditions client',
  Boolean(ownerCodeRow && /DÉCLARÉ PAR LE TITULAIRE/.test(ownerCodeRow)
    && /CONDITIONS CLIENT À FINALISER/.test(ownerCodeRow)));

const libStub = rowFor('LibStub');
check('LibStub reste À CONFIRMER (pas promu à tort)', Boolean(libStub && /À CONFIRMER/.test(libStub)));
check('le document interdit la redistribution des composants non établis',
  /Ne pas redistribuer|ne doit pas être redistribué/.test(doc));

const establishedRows = rows.filter(row => /\*\*ÉTABLI\*\*/.test(row));
for (const row of establishedRows) {
  const licence = licenseCell(row);
  check('chaque ligne ÉTABLI cite une licence dans sa propre cellule',
    /MIT|Bitstream Vera|Arev/i.test(licence), licence.slice(0, 100));
}

console.log('');
console.log(failures === 0 ? 'THIRD-PARTY NOTICE SNAPSHOT : OK' : `THIRD-PARTY NOTICE SNAPSHOT : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
