/**
 * session.js — l'etape centrale du hero : le cycle de peche, rejoue.
 *
 * OBJECTIF : en quelques secondes, faire comprendre CE QUE FAIT LE LOGICIEL.
 * Le visiteur voit la capture reelle de Lushwater Oasis (l'addon charge,
 * le chat du jeu visible) et le cycle que le bot y execute :
 *
 *   1. LANCER   le flotteur part a l'eau
 *   2. ANALYSE l'addon analyse l'eau (HSV) et isole le flotteur
 *   3. MORSURE le flotteur plonge : la morsure est confirmee
 *   4. CLIC     le clic part ; latence mediane journalisee : 308 ms
 *   5. MEMOIRE  la prise est comptee, le spot est ecrit dans la carte
 *
 * HONNETETE : ce n'est PAS un enregistrement de production. La capture
 * d'ecran est reelle ; la detection, la morsure et le clic sont une
 * RECONSTITUTION SCHEMATIQUE, annoncee comme telle dans l'interface
 * (« SIMULATED »). Aucune mesure de ce rejeu n'est envoyee a la
 * telemetrie : un evenement de demonstration ne doit pas ressembler a
 * un usage reel.
 *
 * ACCESSIBILITE : le rejeu est declenche automatiquement une seule fois
 * quand l'etape entre dans l'ecran, et peut etre relance au clavier.
 * Avec `prefers-reduced-motion`, l'etape se met directement dans son
 * etat final (etat illustratif complet), sans animation.
 */
(function () {
  var stage = document.getElementById('heroStage');
  if (!stage) return;

  var read = document.getElementById('stageRead');
  var replay = document.getElementById('stageReplay');
  var steps = Array.prototype.slice.call(stage.querySelectorAll('.stage-steps li'));
  var counter = document.getElementById('stageLatency');
  var floatEl = stage.querySelector('.stage-float');
  var clickEl = stage.querySelector('.stage-click');
  var mapSvg = document.getElementById('heroMap');

  var IS_FR = (document.documentElement.lang || 'en').toLowerCase() === 'fr';

  var TEXT = IS_FR ? {
    cast: 'Lancer : le flotteur part a l\'eau. Le bot ne lit que l\'ecran.',
    detect: 'Analyse : la fenetre d\'eau est_separee en HSV — flotteur, eau, texture.',
    bite: 'Morsure : le flotteur plonge, la morsure est confirmee sur la fenetre calibree.',
    click: 'Clic envoye a la morsure. Latence mediane journalisee : 308 ms.',
    save: 'Prise confirmee. Le spot est ecrit dans votre carte persistante.',
    done: 'C\'est un cycle complet. Les memes regles tournent sur votre compte.',
    replay: 'Rejouer le cycle',
    latency: '308',
  } : {
    cast: 'Cast: the float goes into the water. The bot only reads the screen.',
    detect: 'Analysis: the water window is separated in HSV — float, water, texture.',
    bite: 'Bite: the float dips, the bite is confirmed on the calibrated window.',
    click: 'Click sent on the bite. Median logged latency: 308 ms.',
    save: 'Catch confirmed. The spot is written to your persistent map.',
    done: 'That is one full cycle. The same rules run on your own account.',
    replay: 'Replay the cycle',
    latency: '308',
  };

  /* Chronologie du cycle (ms). Les durees sont distinctes de la duree
     d'une animation : elles representent le temps que prend l'operation,
     pas le temps d'un effet. */
  var T = {
    cast: [0, 900],
    detect: [900, 2300],
    bite: [2300, 3050],
    click: [3050, 3600],
    save: [3600, 4700],
  };

  var timers = [];
  var raf = 0;
  var running = false;
  var played = false;

  function clearTimers() {
    timers.forEach(function (t) { clearTimeout(t); });
    timers = [];
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function setPhase(name) {
    stage.setAttribute('data-phase', name);
    steps.forEach(function (li) {
      li.setAttribute('data-state', li.getAttribute('data-step') === name ? 'on'
        : (steps.indexOf(li) < steps.findIndex(function (s) { return s.getAttribute('data-step') === name; }) ? 'done' : 'todo'));
    });
    if (read && TEXT[name]) read.textContent = TEXT[name];
  }

  /* Compteur de latence : il monte reellement, il n'est pas ecrit d'un
     coup. C'est la mesure annoncee (mediane journalisee). */
  function runLatency(from, to, ms) {
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / ms);
      var v = Math.round(from + (to - from) * p);
      if (counter) counter.textContent = String(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  /* Marqueur du spot memorise, pose sur la VRAIE carte (coordonnees du
     planificateur). */
  function markSpot() {
    var map = window.botwowHeroMap;
    if (!map || !mapSvg || !map.spots || !map.spots.length) return;
    var spot = map.spots[map.spots.length - 1];
    var NS = 'http://www.w3.org/2000/svg';
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'stage-spot');
    var c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', spot.x); c.setAttribute('cy', spot.y); c.setAttribute('r', 7);
    c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#c9a227'); c.setAttribute('stroke-width', 1.2);
    var c2 = document.createElementNS(NS, 'circle');
    c2.setAttribute('cx', spot.x); c2.setAttribute('cy', spot.y); c2.setAttribute('r', 2.4);
    c2.setAttribute('fill', '#c9a227');
    g.appendChild(c); g.appendChild(c2);
    mapSvg.appendChild(g);
    timers.push(setTimeout(function () {
      g.classList.add('is-out');
      setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 900);
    }, 2600));
  }

  function play() {
    /* Un rejeu manuel relance TOUJOURS le cycle : sinon le clic du
       visiteur pendant le rejeu automatique est ignore, et le bouton
       semble mort. clearTimers() neutralise le cycle en cours. */
    clearTimers();
    running = true;
    stage.classList.add('is-playing');
    setPhase('cast');

    timers.push(setTimeout(function () { setPhase('detect'); }, T.cast[1]));
    timers.push(setTimeout(function () { setPhase('bite'); }, T.detect[1]));
    timers.push(setTimeout(function () { setPhase('click'); runLatency(0, 308, 420); }, T.bite[1]));
    timers.push(setTimeout(function () {
      setPhase('save');
      markSpot();
    }, T.click[1]));
    timers.push(setTimeout(function () {
      setPhase('done');
      stage.classList.remove('is-playing');
      running = false;
    }, T.save[1]));
  }

  /* --- mouvement reduit : etat final illustratif, sans animation --- */
  var reduce = false;
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* API absente */ }

  function showFinal() {
    clearTimers();
    stage.setAttribute('data-phase', 'done');
    steps.forEach(function (li) { li.setAttribute('data-state', 'done'); });
    if (read) read.textContent = TEXT.done;
    if (counter) counter.textContent = TEXT.latency;
    if (floatEl) floatEl.style.opacity = '1';
    if (clickEl) clickEl.style.opacity = '1';
  }

  if (replay) {
    replay.addEventListener('click', function () {
      play();
      replay.blur();
    });
  }

  if (reduce) {
    showFinal();
  } else {
    /* L'etape se joue une fois quand elle entre dans l'ecran : on ne
       distract pas avant que le visiteur soit arrive la. */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !played) { played = true; play(); io.disconnect(); }
        });
      }, { threshold: 0.35 });
      io.observe(stage);
    } else {
      played = true;
      setTimeout(play, 600);
    }
  }
})();
