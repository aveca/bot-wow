/* Insere le bloc "cout de possession" dans fr/compare.html et corrige la
   ligne d'essai du verdict (2 sessions max). Encodage UTF-8 preserve. */
import fs from 'node:fs';

const file = 'fr/compare.html';
let t = fs.readFileSync(file, 'utf8');

const OWNERSHIP = `    <div class="ownership" id="ownership" data-years="1">
      <div class="ownership-head">
        <h3>Ce que ça coûte dans la durée</h3>
        <div class="own-switch" role="group" aria-label="Horizon de temps">
          <button type="button" data-years="1" aria-pressed="true">1 an</button>
          <button type="button" data-years="2" aria-pressed="false">2 ans</button>
          <button type="button" data-years="3" aria-pressed="false">3 ans</button>
        </div>
      </div>
      <div class="ownership-grid">
        <div class="ownership-cell ours">
          <span class="o-term">BOT-WOW — licence à vie</span>
          <span class="o-price" id="ownOurs">20,00 €</span>
          <span class="o-note">Un paiement, aucun renouvellement. La licence est à vous.</span>
          <div class="o-bar"><span id="ownOursBar" style="width:8%"></span></div>
        </div>
        <div class="ownership-cell them">
          <span class="o-term">PixelBuddy — Farming Pack</span>
          <span class="o-price" id="ownPack">239,88 €</span>
          <span class="o-note">19,99 € par 30 jours, renouvelé sur toute la période.</span>
          <div class="o-bar"><span id="ownPackBar" style="width:100%"></span></div>
        </div>
        <div class="ownership-cell them">
          <span class="o-term">PixelBuddy — à la carte</span>
          <span class="o-price" id="ownCarte">83,88 €</span>
          <span class="o-note">À partir de 6,99 € par 30 jours, un seul rôle.</span>
          <div class="o-bar"><span id="ownCarteBar" style="width:35%"></span></div>
        </div>
      </div>
      <p class="ownership-foot">
        Source : <span class="mono">pixelwowbot.com/#pricing</span>, lu le 22/10/2026 — Farming Pack 19,99 € / 30 jours,
        à la carte à partir de 6,99 € / 30 jours, essai 1,99 € / 48 h (2 sessions max).
        Les chiffres du concurrent supposent le renouvellement tous les 30 jours sur toute la période ; le nôtre est un paiement unique.
        Sur cette période, vous économisez <b id="ownSaving" class="mono">219,88 €</b> par rapport à leur Farming Pack.
        Nous n'avons jamais testé leur logiciel — ce sont leurs prix publiés, pas une mesure de leur produit.
      </p>
    </div>

`;

const anchor = '    <div class="verdict">';
if (!t.includes(anchor)) { console.error('ancre verdict introuvable'); process.exit(1); }
if (!t.includes('id="ownership"')) {
  t = t.replace(anchor, OWNERSHIP + anchor);
}
t = t.replace(
  '<span class="v-val loss">48 h — 1,99 €</span>',
  '<span class="v-val loss">1,99 € — 48 h, 2 sessions</span>'
);
fs.writeFileSync(file, t, 'utf8');
console.log('fr/compare.html : bloc ownership insere =', t.includes('id="ownership"'));
console.log('essai mis a jour =', t.includes('2 sessions</span>'));
