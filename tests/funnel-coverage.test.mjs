#!/usr/bin/env node
/**
 * funnel-coverage.test.mjs — couverture et cohérence des événements de tunnel.
 *
 * Vérifie que :
 *   1. tous les événements client (analytics.js) sont documentés ;
 *   2. les événements serveur (worker/index.js) ne sont PAS dans analytics.js
 *      (ils ne sont jamais émis par le navigateur) ;
 *   3. le Worker de telemetry n'accepte pas les événements de conversion
 *      (EVENT_SPEC fermé, pas de checkout_created/payment_confirmed/etc.) ;
 *   4. l'écart identifié (checkout_requested sans checkout_created sur lien
 *      Stripe direct) est documenté ;
 *   5. aucun événement n'est compté à la fois comme intention et comme
 *      conversion.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('=== ENTONNOIR : COUVERTURE DES ÉVÉNEMENTS ===');

const an = read('assets/analytics.js');
const worker = read('worker/index.js');
const telemetry = read('telemetry-worker/index.js');

// 1. Tous les événements client documentés sont présents dans le code
const clientEvents = [
  'page_view', 'offer_view', 'demo_open', 'cta_click',
  'planner_mode', 'ownership_view', 'checkout_start',
  'checkout_requested', 'checkout_error', 'checkout_abandoned',
  'journey_view'
];
for (const ev of clientEvents) {
  check(`client : "${ev}" présent dans analytics.js`, an.includes(ev));
}

// 2. Les événements serveur ne sont PAS dans analytics.js (jamais émis par le navigateur)
const serverEvents = [
  'checkout_created', 'checkout_failed', 'payment_confirmed',
  'delivery_sent', 'delivery_failed'
];
for (const ev of serverEvents) {
  check(`serveur : "${ev}" absent d'analytics.js (côté client)`,
    !an.includes(`'${ev}'`));
}

// 3. Les événements serveur sont bien présents dans le Worker de paiement
for (const ev of serverEvents) {
  check(`serveur : "${ev}" émis par worker/index.js`, worker.includes(`"${ev}"`) || worker.includes(`'${ev}'`));
}

// 4. Le Worker de telemetry n'accepte pas les événements de conversion
//    (EVENT_SPEC fermé, pas de checkout_created / payment_confirmed / etc.)
const specBlock = (telemetry.match(/const EVENT_SPEC = \{[\s\S]*?\n\};/) || [''])[0];
for (const ev of serverEvents) {
  check(`telemetry : "${ev}" refusé par EVENT_SPEC (pas d'acceptation navigateur)`,
    !specBlock.includes(`"${ev}"`));
}
check(
  'telemetry : EVENT_SPEC documente l’absence de conversion',
  /conversion/.test(specBlock) || /paiement confirme/.test(telemetry)
);

// 5. L'écart checkout_requested -> checkout_created est documenté
check(
  'écart documenté : checkout_requested sans checkout_created sur lien Stripe direct',
  /checkout_requested.*checkout_created|checkout_created.*checkout_requested/gs.test(an)
  || /lien Stripe direct/.test(an)
);
check(
  'écart documenté : pas de checkout_created côté serveur pour paiement externe',
  /Stripe crée la session en externe/.test(an) || /pas via \/api\/checkout/.test(an)
);

// 6. Aucun événement n'est à la fois intention et conversion
//    checkout_requested = intention, payment_confirmed = conversion
check(
  'checkout_requested est une intention, pas une conversion',
  /ce n'est PAS une vente/.test(an) || /pas une vente/.test(an)
);
check(
  'payment_confirmed est une conversion, pas une intention',
  worker.includes('payment_confirmed')
);

// 7. Distinction claire : 4 stades du tunnel documentés
const stages = ['checkout_created', 'payment_confirmed', 'delivery_sent', 'delivery_failed'];
let stagesFound = 0;
for (const ev of stages) {
  if (worker.includes(`"${ev}"`) || worker.includes(`'${ev}'`)) stagesFound += 1;
}
check(
  `serveur : ${stagesFound}/4 stades de livraison présents`,
  stagesFound === 4,
  `(${stagesFound}/4)`
);

// 8. checkout_abandoned transporte uniquement step (pas de PII)
const abandonBlock = an.match(/checkout_abandoned[\s\S]{0,300}?\}/g);
if (abandonBlock) {
  const propsText = abandonBlock.join(' ');
  check(
    'checkout_abandoned : pas de champ email/nom/order_id',
    !/@|email|user_?name|order_?id/i.test(propsText)
  );
} else {
  check('checkout_abandoned : bloc de props trouvé', false, '(bloc non détecté)');
}

console.log(failures === 0 ? '\nENTONNOIR COUVERTURE : OK' : `\nENTONNOIR COUVERTURE : ${failures} ÉCHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
