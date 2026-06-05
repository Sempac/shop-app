/**
 * auth.js — The SMARTPHONE POS
 * Gestion des sessions utilisateurs côté client
 * Inclure dans chaque page : <script src="auth.js"></script>
 */

var AUTH_SESSION_HOURS = 4; /* Fermeture session après 4h d'inactivité */
var AUTH_LOCK_MINUTES  = 240; /* Verrouillage auto après 4h d'inactivité */

/* Modules accessibles par rôle */
var AUTH_MODULES = {
  gerant: ['*'], /* Tout */
  vendeur: [
    'sales', 'repairs', 'stock', 'history', 'lots',
    'contacts', 'printshop', 'credits', 'returns',
    'rapport-comptable', 'expenses-limited'
  ],
  stagiaire: [
    'sales', 'repairs', 'stock', 'lots',
    'printshop', 'rapport-comptable', 'expenses-limited'
  ]
};

/* ── OBTENIR L'UTILISATEUR CONNECTÉ ── */
function getUser() {
  try {
    var stored = sessionStorage.getItem('user');
    if (!stored) return null;
    var user = JSON.parse(stored);

    /* Vérifier inactivité (4h depuis dernière action) */
    var lastAct = user.lastActivity || user.loginAt;
    var elapsed = (Date.now() - lastAct) / 1000 / 3600;
    if (elapsed > AUTH_SESSION_HOURS) {
      sessionStorage.removeItem('user');
      return null;
    }
    return user;
  } catch(e) {
    return null;
  }
}

/* ── VÉRIFIER ACCÈS À UN MODULE ── */
function canAccess(module) {
  var user = getUser();
  if (!user) return false;
  if (user.role === 'gerant') return true;
  var allowed = AUTH_MODULES[user.role] || AUTH_MODULES.vendeur;
  return allowed.indexOf(module) >= 0 || allowed.indexOf('*') >= 0;
}

/* ── PROTÉGER UNE PAGE ── */
function requireAuth(module) {
  var user = getUser();
  if (!user) {
    /* Pas connecté → login */
    window.location.href = 'login.html';
    return null;
  }
  if (module && !canAccess(module)) {
    /* Pas le droit → accueil */
    alert('Accès refusé — Contactez le gérant');
    window.location.href = 'index.html';
    return null;
  }
  /* Mettre à jour le timestamp d'activité */
  user.lastActivity = Date.now();
  sessionStorage.setItem('user', JSON.stringify(user));
  return user;
}

/* ── DÉCONNEXION ── */
function logout() {
  if (confirm('Se déconnecter ?')) {
    sessionStorage.removeItem('user');
    window.location.href = 'login.html';
  }
}

/* ── AFFICHER INFO USER DANS LA TOPBAR ── */
function showUserBadge(containerId) {
  var user = getUser();
  if (!user) return;
  var container = document.getElementById(containerId);
  if (!container) return;

  var roleLabel = user.role === 'gerant' ? '👑 Gérant' : (user.role === 'stagiaire' ? '🎓 Stagiaire' : '👤 Vendeur');
  var roleColor = user.role === 'gerant' ? '#3b82f6' : (user.role === 'stagiaire' ? '#7c3aed' : '#475569');

  var badge = document.createElement('div');
  badge.style.cssText = 'display:flex;align-items:center;gap:8px;';
  badge.innerHTML =
    '<span style="font-size:12px;background:' + roleColor + ';color:white;padding:4px 10px;border-radius:12px;font-weight:bold;">' +
    roleLabel + ' — ' + user.name +
    '</span>' +
    '<button onclick="logout()" style="padding:5px 10px;background:#334155;color:#94a3b8;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:bold;font-family:Arial;">🔓 Déco.</button>';

  container.appendChild(badge);
}

/* ── VERROUILLAGE AUTO ── */
var _lockTimer = null;

function resetLockTimer() {
  if (_lockTimer) clearTimeout(_lockTimer);
  _lockTimer = setTimeout(function() {
    var user = getUser();
    if (user) {
      sessionStorage.removeItem('user');
      /* Afficher modal verrouillage */
      showLockScreen(user.name);
    }
  }, AUTH_LOCK_MINUTES * 60 * 1000);
}

function showLockScreen(userName) {
  var overlay = document.createElement('div');
  overlay.id = 'lockOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:#0f172a;z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML =
    '<div style="text-align:center;color:white;">' +
    '<div style="font-size:48px;margin-bottom:12px;">🔒</div>' +
    '<div style="font-size:18px;font-weight:bold;margin-bottom:8px;">Session verrouillée</div>' +
    '<div style="font-size:13px;color:#64748b;margin-bottom:24px;">Inactivité détectée — ' + userName + '</div>' +
    '<button onclick="window.location.href=\'login.html\'" style="padding:12px 28px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;font-family:Arial;">Se reconnecter</button>' +
    '</div>';
  document.body.appendChild(overlay);
}

/* Écouter les interactions pour reset le timer */
['click','keypress','mousemove','touchstart'].forEach(function(ev) {
  document.addEventListener(ev, resetLockTimer, {passive:true});
});
resetLockTimer();
