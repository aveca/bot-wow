/* Iter 2b : le comparateur etait un mur de 26 lignes d'egalite.
   On le regroupe en 5 themes avec des sous-en-tetes : le visiteur
   balaie par intention ("detection", "deplacement", "roles", "plateforme",
   "prix") au lieu de lire line par line.
   Les 26 lignes et leurs libelles sont inchanges. */
import fs from 'node:fs';

const GROUPS = {
  EN: [
    ['Fishing & detection', ['External bot (pixels, no injection)', 'Addon client (data channel)', 'Fishing — AI (trained model)', 'Background mode (no focus)', 'Persistent fishing-spot memory']],
    ['Planning & movement', ['Route planner (cost + optimiser)', 'Automatic movement between spots', 'Navigation profiles (manual)']],
    ['Roles & game scope', ['Profile/rotation shop (free)', 'Inventory & vendor', 'Grind / combat rotations', 'Gathering / questing / battlegrounds', 'Follower / scripting', 'Game scope', 'Private servers', 'Vanilla / Classic / Live']],
    ['Platform & installation', ['Interface languages', 'Mobile piloting', 'Installation wizard', 'Machine-locked licence']],
    ['Price & conditions', ['48 h paid trial', 'Subscription', 'Ban-risk honesty', 'Memory / injection', 'Price model', 'Number of roles']],
  ],
  FR: [
    ['Pêche & détection', ['Bot externe (pixels, sans injection)', 'Addon client (canal de données)', 'Pêche par IA (modèle entraîné)', 'Mode arrière-plan (sans focus)', 'Mémoire persistante des spots']],
    ['Planification & déplacement', ['Planificateur de rondes (coût + optimiseur)', 'Déplacement automatique entre spots', 'Navigation par profils (manuelle)']],
    ['Rôles & périmètre de jeu', ['Boutique de profils/rotations (gratuite)', 'Inventaire &amp; vendeur', 'Grind / rotations de combat', 'Grind / collecte / quêtes / champs de bataille', 'Follower / scripting', 'Périmètre de jeu', 'Serveurs privés', 'Vanille / Classic / Live']],
    ['Plateforme & installation', ['Langues d\'interface', 'Pilotage smartphone', 'Assistant d\'installation', 'Licence verrouillée à une machine']],
    ['Prix & conditions', ['Essai payant 48 h', 'Abonnement', 'Vigilance anti-bannissement', 'Mémoire / injection', 'Modèle de prix', 'Nombre de rôles']],
  ],
};

for (const [file, lang] of [['compare.html', 'EN'], ['fr/compare.html', 'FR']]) {
  let t = fs.readFileSync(file, 'utf8');
  const m = t.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!m) { console.log(`  [absent] ${file} : tbody`); continue; }
  const body = m[1];
  // Decoupe en lignes
  const rows = body.split(/<tr>/).slice(1).map((r) => '<tr>' + r.replace(/<\/tr>\s*$/, '')).filter((r) => r.trim());
  const labelOf = (r) => {
    const mm = r.match(/<td[^>]*>([\s\S]*?)<\/td>/);
    return mm ? mm[1].replace(/<[^>]+>/g, '').trim() : '';
  };
  const byLabel = new Map(rows.map((r) => [labelOf(r), r]));

  let out = '';
  let used = 0;
  for (const [title, labels] of GROUPS[lang]) {
    const found = labels.map((l) => byLabel.get(l)).filter(Boolean);
    if (!found.length) { console.log(`  [groupe vide] ${file} : ${title}`); continue; }
    out += `\n        <tr class="vs-group"><td colspan="4"><span>${title}</span></td></tr>\n`;
    for (const r of found) { out += '        ' + r.replace(/^\s+/, '') + '\n'; used++; }
  }
  // Toute ligne non rangee est conservee a la fin (aucune perte).
  const grouped = new Set(GROUPS[lang].flatMap(([, ls]) => ls.map((l) => byLabel.get(l)).filter(Boolean)));
  for (const r of rows) { if (![...grouped].includes(r)) { out += '        ' + r.replace(/^\s+/, '') + '\n'; used++; } }

  t = t.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${out}        </tbody>`);
  fs.writeFileSync(file, t, 'utf8');
  console.log(`${file} : ${used} lignes regroupees en ${GROUPS[lang].length} themes`);
}
