/* ─── Offline Guard — détecte si le serveur est KO ─── */
(function(){
  var INTERVAL   = 15000; /* vérif toutes les 15 s */
  var TIMEOUT    = 6000;  /* abandon ping après 6 s */
  var PHASE2_AT  = 3;     /* passe en phase 2 après 3 échecs (~45 s) */
  var _shown     = false;
  var _failCount = 0;

  var CARD = 'background:#fff;border-radius:18px;padding:36px 32px;' +
             'max-width:460px;width:92%;text-align:center;' +
             'box-shadow:0 24px 64px rgba(0,0,0,0.6);';

  /* Phase 1 — redémarrage automatique en cours */
  function phase1HTML(){
    return '<div style="' + CARD + '">' +
      '<div style="font-size:56px;margin-bottom:14px;">🔄</div>' +
      '<h1 style="font-size:20px;color:#0f172a;margin:0 0 12px;line-height:1.4;">' +
        'Le serveur redémarre automatiquement…' +
      '</h1>' +
      '<p style="color:#64748b;font-size:14px;margin:0 0 18px;line-height:1.7;">' +
        'Ne vous inquiétez pas — vos données sont sauvegardées.<br>' +
        'La page se rechargera toute seule dès que c\'est prêt.' +
      '</p>' +
      '<div id="og-status" style="font-size:12px;color:#94a3b8;">⏳ Vérification en cours…</div>' +
    '</div>';
  }

  /* Phase 2 — l'auto a échoué, le vendeur doit agir */
  function phase2HTML(){
    return '<div style="' + CARD + '">' +
      '<div style="font-size:56px;margin-bottom:14px;">⚠️</div>' +
      '<h1 style="font-size:20px;color:#0f172a;margin:0 0 12px;line-height:1.4;">' +
        'Le redémarrage automatique n\'a pas fonctionné' +
      '</h1>' +
      '<p style="color:#374151;font-size:14px;margin:0 0 20px;line-height:1.7;">' +
        'Cliquez sur le raccourci<br>' +
        '<b style="font-size:15px;color:#1e40af;">🖥️ Redémarrer le Serveur Appli Vente</b><br>' +
        'sur votre bureau, puis attendez 10 secondes.' +
      '</p>' +
      '<button onclick="window._ogRetry()" style="' +
        'width:100%;padding:14px;background:#22c55e;color:#fff;' +
        'border:none;border-radius:10px;font-size:15px;font-weight:bold;' +
        'cursor:pointer;font-family:Arial;margin-bottom:10px;">' +
        '🔄 J\'ai cliqué sur le raccourci — réessayer' +
      '</button>' +
      '<div id="og-status" style="font-size:11px;color:#94a3b8;">' +
        'Vérification automatique toutes les 15 secondes…' +
      '</div>' +
    '</div>';
  }

  function buildOverlay(html){
    var d = document.createElement('div');
    d.id = 'og-overlay';
    d.style.cssText = 'position:fixed;inset:0;z-index:999999;' +
      'background:rgba(15,23,42,0.97);' +
      'display:flex;align-items:center;justify-content:center;' +
      'font-family:Arial,sans-serif;';
    d.innerHTML = html;
    return d;
  }

  function show(){
    if (_shown) return;
    _shown = true;
    var fn = function(){
      document.body.appendChild(buildOverlay(phase1HTML()));
    };
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  function hide(){
    var el = document.getElementById('og-overlay');
    if (el) el.remove();
    _shown     = false;
    _failCount = 0;
  }

  function setStatus(txt){
    var el = document.getElementById('og-status');
    if (el) el.textContent = txt;
  }

  function onFail(){
    _failCount++;
    show(); /* no-op si déjà affiché */
    if (_failCount >= PHASE2_AT){
      var ov = document.getElementById('og-overlay');
      if (ov) ov.innerHTML = phase2HTML();
    } else {
      setStatus('⏳ Nouvelle vérification dans ' + (INTERVAL / 1000) + ' secondes…');
    }
  }

  function ping(){
    var ctrl = new AbortController();
    var t    = setTimeout(function(){ ctrl.abort(); }, TIMEOUT);
    fetch('/api/products?_og=1', {cache:'no-store', signal:ctrl.signal})
      .then(function(r){
        clearTimeout(t);
        if (r.ok){ if (_shown){ hide(); window.location.reload(); } }
        else { onFail(); }
      })
      .catch(function(){ clearTimeout(t); onFail(); });
  }

  window._ogRetry = function(){
    setStatus('⏳ Vérification en cours…');
    ping();
  };

  /* Lancer après le chargement initial (évite fausse alerte au boot) */
  setTimeout(function(){
    ping();
    setInterval(ping, INTERVAL);
  }, 4000);
})()

/* ─── Theme manager — The SMARTPHONE ─── */
(function(){
  // Appliquer le thème AVANT le rendu (évite le flash)
  var t = localStorage.getItem('app-theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);

  document.addEventListener('DOMContentLoaded', function(){
    // FAB bouton flottant bas-droite
    var fab = document.createElement('button');
    fab.id = 'theme-fab';
    fab.title = 'Basculer thème clair / sombre';

    function applyFab(theme){
      fab.textContent = theme === 'dark' ? '☀️' : '🌙';
      fab.style.background = theme === 'dark' ? '#334155' : '#1e293b';
      fab.style.borderColor = theme === 'dark' ? '#475569' : '#334155';
    }

    var s = fab.style;
    s.position   = 'fixed';
    s.bottom     = '22px';
    s.right      = '22px';
    s.zIndex     = '9998';
    s.width      = '44px';
    s.height     = '44px';
    s.borderRadius = '50%';
    s.border     = '2px solid';
    s.fontSize   = '20px';
    s.cursor     = 'pointer';
    s.boxShadow  = '0 3px 14px rgba(0,0,0,.45)';
    s.transition = 'transform .15s, background .2s';
    s.lineHeight = '1';
    s.padding    = '0';
    s.display    = 'flex';
    s.alignItems = 'center';
    s.justifyContent = 'center';

    applyFab(t);

    fab.addEventListener('mouseenter', function(){ this.style.transform = 'scale(1.13)'; });
    fab.addEventListener('mouseleave', function(){ this.style.transform = 'scale(1)'; });

    fab.addEventListener('click', function(){
      var cur  = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('app-theme', next);
      applyFab(next);
    });

    document.body.appendChild(fab);
  });
})();
