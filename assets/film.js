/**
 * film.js — le film du produit dans le hero.
 *
 * Le hero montre une video : un ENREGISTREMENT de la demonstration
 * navigateur (126 Ko, muet). Regles :
 *   - elle se joue UNE fois, puis s'arrete sur sa derniere image (pas de
 *     boucle : une animation permanente fatigue et coute du CPU) ;
 *   - le poster (72 Ko) s'affiche immediatement : la video n'est pas un
 *     bloqueur de premier rendu ;
 *   - sous prefers-reduced-motion, PAS d'autoplay : le poster reste, et le
 *     bouton devient « lecture a la demande » ;
 *   - si le navigateur refuse l'autoplay, le bouton de relecture apparait
 *     (l'utilisateur garde toujours la main).
 */
(function () {
  var film = document.querySelector('[data-film]');
  if (!film) return;
  var replay = document.querySelector('[data-film-replay]');
  var playLabel = replay ? replay.getAttribute('data-play-label') : null;

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  function offerPlay(label) {
    if (!replay) return;
    if (label) replay.textContent = label;
    replay.hidden = false;
  }

  if (reduce) {
    film.removeAttribute('autoplay');
    offerPlay(playLabel);
  } else {
    film.addEventListener('ended', function () { offerPlay(null); });
    var p = film.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () { offerPlay(playLabel); });
    }
  }

  if (replay) {
    replay.addEventListener('click', function () {
      try { film.currentTime = 0; } catch (e) { /* ignore */ }
      var r = film.play();
      if (r && typeof r.catch === 'function') r.catch(function () { /* ignore */ });
      replay.hidden = true;
    });
  }
})();
