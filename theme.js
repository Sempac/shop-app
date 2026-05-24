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
