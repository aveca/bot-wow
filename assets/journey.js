/**
 * journey.js — selecteur de parcours ("que voulez-vous faire ?").
 *
 * OBJECTIF : aider un visiteur a decider en connaissance de cause, sans
 * promesse que le produit ne tient pas.
 *
 * REGLE DE CONCEPTION : le selecteur ne propose QUE ce que BOT-WOW fait
 * reellement aujourd'hui (la peche) et Assume publiquement ce qu'il ne
 * fait pas (grind, gather, combat, PvP). Un visiteur qui cherche du
 * grinding lit "ce n'est pas ce produit" et le registre des modules, au
 * lieu d'acheter le mauvais outil.
 *
 * ACCESSIBILITE : pattern `tablist` (boutons role=tab, panels role=tabpanel),
 * navigation aux fleches, `aria-selected`, focus visible. Sans JavaScript,
 * TOUS les panneaux restent visibles et lisibles (degradation propre).
 */
(function () {
  var root = document.getElementById('journey');
  if (!root) return;

  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('[role="tabpanel"]'));
  if (!tabs.length || !panels.length) return;

  function select(tab, focus) {
    var id = tab.getAttribute('aria-controls');
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
    });
    panels.forEach(function (p) {
      var on = p.id === id;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
    if (focus) tab.focus();
    // Mesure de parcours : le selecteur affiche une intention -> elle est
    // enregistree. Aucune donnee personnelle, uniquement l'identifiant du
    // parcours choisi (liste fermee).
    if (typeof window.botwowTrack === 'function') {
      var intent = tab.getAttribute('data-intent') || '';
      if (intent) window.botwowTrack('journey_view', { step: intent });
    }
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { select(tab, false); });
    tab.addEventListener('keydown', function (ev) {
      var k = ev.key;
      if (k !== 'ArrowRight' && k !== 'ArrowLeft' && k !== 'Home' && k !== 'End') return;
      ev.preventDefault();
      var next = tab;
      if (k === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (k === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (k === 'Home') next = tabs[0];
      else next = tabs[tabs.length - 1];
      select(next, true);
    });
  });

  /* Etat initial : le premier onglet est actif des que le module s'execute
     (le HTML les affiche tous sans JavaScript). */
  select(tabs[0], false);
})();
