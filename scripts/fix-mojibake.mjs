/* Repare les fichiers double-encodes (UTF-8 lu comme cp1252 puis reecrit).
   Inverse : utf8(mojibake) -> cp1252 bytes -> utf8.
   Ne touche que les fichiers dont le contenu contient la signature de
   double-encodage, et verifie le resultat avant ecriture. */
import fs from 'node:fs';

// Table cp1252 pour la plage 0x80-0x9F (les octets > 0x7F).
const CP1252 = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/* Reconstruit le texte en re-decodant les sequences UTF-8 valides qui
   avaient ete lues comme cp1252, tout en conservant tel quel les
   caracteres legitimes hors cp1252 (→, emoji, etc.). */
function repair(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const cp = text.codePointAt(i);
    let b0;
    if (cp <= 0xff) b0 = cp;
    else if (CP1252[cp] !== undefined) b0 = CP1252[cp];
    else { out.push(String.fromCodePoint(cp)); i++; continue; }

    if (b0 >= 0xc2 && b0 <= 0xf4) {
      const need = b0 < 0xe0 ? 2 : b0 < 0xf0 ? 3 : 4;
      const seq = [b0];
      let j = i + 1;
      let ok = true;
      for (let k = 1; k < need; k++) {
        if (j >= text.length) { ok = false; break; }
        const cp2 = text.codePointAt(j);
        let b;
        if (cp2 <= 0xff) b = cp2;
        else if (CP1252[cp2] !== undefined) b = CP1252[cp2];
        else { ok = false; break; }
        if (b < 0x80 || b > 0xbf) { ok = false; break; }
        seq.push(b);
        j += cp2 > 0xffff ? 2 : 1;
      }
      if (ok) {
        const dec = Buffer.from(seq).toString('utf8');
        if (!dec.includes('\uFFFD')) { out.push(dec); i = j; continue; }
      }
    }
    out.push(String.fromCodePoint(cp));
    i += cp > 0xffff ? 2 : 1;
  }
  return out.join('');
}

const files = process.argv.slice(2);
let fixed = 0;
let skipped = 0;
for (const f of files) {
  const original = fs.readFileSync(f, 'utf8');
  const fixedText = repair(original);
  if (!fixedText || fixedText === original) { skipped++; continue; }
  fs.writeFileSync(f, fixedText, 'utf8');
  fixed++;
  console.log(`  repara  ${f}`);
}
console.log(`\n${fixed} fichier(s) repara(s), ${skipped} intact(s)`);
