/* Suggestion de langue, sans redirection.
   navigator.languages reflète la préférence que le navigateur envoie
   dans Accept-Language. L'anglais à / reste la page par défaut. */
(function () {
  var map = { en: 'en', fr: 'fr', de: 'de', es: 'es', pt: 'pt-br', ru: 'ru', it: 'it', pl: 'pl' };
  var labels = {
    fr: 'Français', de: 'Deutsch', es: 'Español', 'pt-br': 'Português',
    ru: 'Русский', it: 'Italiano', pl: 'Polski', en: 'English'
  };
  var prompts = {
    fr: 'Cette page est aussi disponible en français.',
    de: 'Diese Seite ist auch auf Deutsch verfügbar.',
    es: 'Esta página también está en español.',
    'pt-br': 'Esta página também está em português.',
    ru: 'Эта страница также доступна на русском.',
    it: 'Questa pagina è disponibile anche in italiano.',
    pl: 'Ta strona jest też po polsku.',
    en: 'This page is also available in English.'
  };
  var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
  var suggested = '';
  for (var i = 0; i < list.length; i++) {
    var low = String(list[i] || '').toLowerCase();
    if (low.indexOf('pt') === 0) { suggested = 'pt-br'; break; }
    var base = low.split('-')[0];
    if (map[base]) { suggested = map[base]; break; }
  }
  var current = String(document.documentElement.lang || 'en').toLowerCase();
  if (current.indexOf('pt') === 0) current = 'pt-br';
  else current = current.split('-')[0];
  if (!suggested || suggested === current) return;
  try { if (sessionStorage.getItem('botwow-lang-dismiss') === suggested) return; } catch (e) {}
  var link = document.querySelector('.langs a[lang="' + suggested + '"], .langs a[hreflang="' + suggested + '"]');
  if (!link) return;
  var bar = document.createElement('div');
  bar.setAttribute('role', 'status');
  bar.style.cssText = 'position:sticky;top:0;z-index:30;background:#122033;color:#e8f1ff;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;max-width:100%;box-sizing:border-box;font:600 14px/1.4 Sora,sans-serif';
  var text = document.createElement('span');
  text.style.cssText = 'min-width:0';
  text.textContent = prompts[suggested] || prompts.en;
  var go = document.createElement('a');
  go.href = link.getAttribute('href');
  go.textContent = labels[suggested] || suggested;
  go.style.cssText = 'color:#ffd56a;font-weight:800';
  var close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close');
  close.style.cssText = 'background:transparent;color:inherit;border:0;font-size:20px;cursor:pointer';
  close.addEventListener('click', function () {
    try { sessionStorage.setItem('botwow-lang-dismiss', suggested); } catch (e) {}
    bar.remove();
  });
  bar.appendChild(text);
  bar.appendChild(go);
  bar.appendChild(close);
  document.body.insertBefore(bar, document.body.firstChild);
})();
