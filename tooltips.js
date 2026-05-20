/**
 * tooltips.js — The SMARTPHONE POS
 * Tooltip universel sur tous les éléments avec title=
 * Fonctionne sur éléments statiques ET dynamiques (JS)
 */
(function() {
  var tip = document.createElement('div');
  tip.id = 'global-tooltip';
  tip.style.cssText = [
    'position:fixed;z-index:99999;',
    'background:#0f172a;color:#e2e8f0;',
    'font-size:11px;font-family:Arial,sans-serif;',
    'padding:6px 10px;border-radius:7px;',
    'max-width:220px;text-align:center;line-height:1.5;',
    'border:1px solid #334155;',
    'box-shadow:0 4px 16px rgba(0,0,0,0.5);',
    'pointer-events:none;display:none;',
    'transition:opacity 0.15s;'
  ].join('');
  document.body.appendChild(tip);

  var showTimer = null;

  document.addEventListener('mouseover', function(e) {
    var el = e.target;
    /* Chercher title sur l'élément ou ses parents proches */
    for (var i = 0; i < 4; i++) {
      if (!el) break;
      if (el.title && el.title.trim()) {
        var text = el.title.trim();
        clearTimeout(showTimer);
        showTimer = setTimeout(function() {
          tip.textContent = text;
          tip.style.display = 'block';
          /* Positionner */
          var x = e.clientX + 12;
          var y = e.clientY - 40;
          /* Éviter débordement droite */
          if (x + 240 > window.innerWidth) x = e.clientX - 240;
          /* Éviter débordement haut */
          if (y < 4) y = e.clientY + 20;
          tip.style.left = x + 'px';
          tip.style.top  = y + 'px';
        }, 400); /* Délai 400ms avant affichage */
        return;
      }
      el = el.parentElement;
    }
  });

  document.addEventListener('mousemove', function(e) {
    if (tip.style.display === 'block') {
      var x = e.clientX + 12;
      var y = e.clientY - 40;
      if (x + 240 > window.innerWidth) x = e.clientX - 240;
      if (y < 4) y = e.clientY + 20;
      tip.style.left = x + 'px';
      tip.style.top  = y + 'px';
    }
  });

  document.addEventListener('mouseout', function(e) {
    clearTimeout(showTimer);
    tip.style.display = 'none';
  });

  document.addEventListener('click', function() {
    tip.style.display = 'none';
  });
})();
