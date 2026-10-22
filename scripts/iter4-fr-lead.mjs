/* Iter 4 : le hero FR depassait la ligne de flottaison (CTA a 937 px) :
   le texte francais est ~15 % plus long que l anglais, donc le lead
   prenait une ligne de plus. On raccourcit le lead FR (meme sens, meme
   information) et on resserre legerement la taille du lead. */
import fs from 'node:fs';

const f = 'fr/index.html';
let t = fs.readFileSync(f, 'utf8');
const from = `        Détection mesurée du flotteur, <b>mémoire persistante des spots</b> et rondes optimisées
        qui enchaînent les bancs — plus un registre de modules honnête qui montre exactement
        ce qui livre, ce qui est en développement et ce qui est planifié.`;
const to = `        Détection mesurée du flotteur, <b>mémoire persistante des spots</b> et rondes
        optimisées — plus un registre honnête qui montre ce qui livre, ce qui est en
        développement et ce qui est planifié.`;
if (t.includes(from)) { t = t.split(from).join(to); fs.writeFileSync(f, t, 'utf8'); console.log('lead FR raccourci'); }
else console.log('[absent] lead FR');
