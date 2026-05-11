/**
 * voice-scan.js — The SMARTPHONE POS
 * Saisie vocale + Scan code barre (caméra)
 * Usage : addVoiceButton('idDuChamp')
 *         addScanButton('idDuChamp')
 *         addVoiceScan('idDuChamp')  // les deux
 */

/* ══════════════════════════════════════
   SAISIE VOCALE
══════════════════════════════════════ */
var VS_recognition = null;
var VS_activeField = null;
var VS_listening   = false;

function initVoice() {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  var r = new SpeechRecognition();
  r.lang = 'fr-FR';
  r.continuous = false;
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

function startVoice(fieldId, btn) {
  var field = document.getElementById(fieldId);
  if (!field) return;

  /* Vérifier support */
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('La saisie vocale nécessite Chrome ou Edge.');
    return;
  }

  if (VS_listening) {
    /* Arrêter si déjà en écoute */
    if (VS_recognition) VS_recognition.stop();
    return;
  }

  VS_recognition = initVoice();
  VS_activeField = field;
  VS_listening   = true;

  /* Feedback visuel */
  btn.textContent  = '🔴';
  btn.title        = 'Écoute en cours... (cliquez pour arrêter)';
  btn.style.background = '#ef4444';
  field.style.borderColor = '#ef4444';
  field.placeholder = '🎤 Parlez maintenant...';

  VS_recognition.onresult = function(event) {
    var text = event.results[0][0].transcript;
    field.value = text;
    field.dispatchEvent(new Event('input', {bubbles:true}));
    field.dispatchEvent(new Event('change', {bubbles:true}));
    resetVoiceBtn(btn, field);
    /* Focus sur le champ */
    field.focus();
  };

  VS_recognition.onerror = function(e) {
    if (e.error !== 'aborted') {
      var msg = {
        'not-allowed':   'Microphone non autorisé — vérifiez les permissions',
        'no-speech':     'Aucune parole détectée',
        'network':       'Erreur réseau',
        'audio-capture': 'Pas de microphone détecté'
      }[e.error] || 'Erreur : ' + e.error;
      /* Afficher un tooltip plutôt qu'une alerte */
      btn.title = msg;
    }
    resetVoiceBtn(btn, field);
  };

  VS_recognition.onend = function() {
    resetVoiceBtn(btn, field);
  };

  VS_recognition.start();
}

function resetVoiceBtn(btn, field) {
  VS_listening = false;
  btn.textContent = '🎤';
  btn.title       = 'Saisie vocale';
  btn.style.background = '#334155';
  if (field) {
    field.style.borderColor = '';
    if (!field.value) field.placeholder = field.dataset.originalPlaceholder || '';
  }
}

/* ══════════════════════════════════════
   SCAN CODE BARRE (caméra)
══════════════════════════════════════ */
var SCAN_active  = false;
var SCAN_fieldId = null;
var SCAN_stream  = null;

function startScan(fieldId, btn) {
  if (SCAN_active) {
    stopScan();
    return;
  }

  /* Créer la modal caméra si elle n'existe pas */
  if (!document.getElementById('scanModal')) {
    createScanModal();
  }

  SCAN_fieldId = fieldId;
  SCAN_active  = true;
  btn.textContent = '⏹️';
  btn.style.background = '#f59e0b';

  document.getElementById('scanModal').style.display = 'flex';
  startCamera();
}

function createScanModal() {
  var modal = document.createElement('div');
  modal.id = 'scanModal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:#000000cc;z-index:9999;align-items:center;justify-content:center;flex-direction:column;';
  modal.innerHTML = [
    '<div style="background:#1e293b;border-radius:14px;padding:20px;width:380px;max-width:95vw;text-align:center;">',
    '<div style="font-size:15px;font-weight:bold;color:white;margin-bottom:12px;">📷 Scanner un code barre</div>',
    '<div style="position:relative;border-radius:8px;overflow:hidden;background:#000;margin-bottom:12px;">',
    '<video id="scanVideo" autoplay playsinline style="width:100%;height:220px;object-fit:cover;display:block;"></video>',
    '<canvas id="scanCanvas" style="display:none;"></canvas>',
    /* Viseur */
    '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">',
    '<div style="width:240px;height:80px;border:2px solid #22c55e;border-radius:4px;box-shadow:0 0 0 2000px rgba(0,0,0,0.3);">',
    '<div style="position:absolute;top:0;left:0;width:20px;height:20px;border-top:3px solid #22c55e;border-left:3px solid #22c55e;"></div>',
    '<div style="position:absolute;top:0;right:0;width:20px;height:20px;border-top:3px solid #22c55e;border-right:3px solid #22c55e;"></div>',
    '<div style="position:absolute;bottom:0;left:0;width:20px;height:20px;border-bottom:3px solid #22c55e;border-left:3px solid #22c55e;"></div>',
    '<div style="position:absolute;bottom:0;right:0;width:20px;height:20px;border-bottom:3px solid #22c55e;border-right:3px solid #22c55e;"></div>',
    '</div></div></div>',
    '<div id="scanStatus" style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Pointez la caméra vers le code barre...</div>',
    '<button onclick="stopScan()" style="width:100%;padding:11px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;font-family:Arial;">✕ Annuler</button>',
    '</div>'
  ].join('');
  document.body.appendChild(modal);
}

async function startCamera() {
  try {
    SCAN_stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: {ideal:1280}, height: {ideal:720} }
    });
    var video = document.getElementById('scanVideo');
    video.srcObject = SCAN_stream;
    video.play();
    /* Démarrer la détection */
    setTimeout(scanLoop, 500);
  } catch(e) {
    document.getElementById('scanStatus').textContent = 'Caméra non disponible : ' + e.message;
    document.getElementById('scanStatus').style.color = '#ef4444';
  }
}

function scanLoop() {
  if (!SCAN_active) return;
  var video  = document.getElementById('scanVideo');
  var canvas = document.getElementById('scanCanvas');
  if (!video || !canvas) return;
  if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    setTimeout(scanLoop, 200);
    return;
  }
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  /* Utiliser BarcodeDetector si disponible (Chrome 83+) */
  if ('BarcodeDetector' in window) {
    var detector = new BarcodeDetector({formats: [
      'ean_13','ean_8','code_128','code_39','qr_code','upc_a','upc_e'
    ]});
    detector.detect(canvas).then(function(barcodes) {
      if (barcodes.length > 0) {
        var code = barcodes[0].rawValue;
        onBarcodeDetected(code);
      } else {
        setTimeout(scanLoop, 200);
      }
    }).catch(function() {
      setTimeout(scanLoop, 200);
    });
  } else {
    /* Fallback : message */
    document.getElementById('scanStatus').textContent =
      'Saisie manuelle requise — BarcodeDetector non supporté sur ce navigateur';
    document.getElementById('scanStatus').style.color = '#f59e0b';
  }
}

function onBarcodeDetected(code) {
  /* Son de confirmation */
  try {
    var ctx = new AudioContext();
    var osc = ctx.createOscillator();
    var g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = 1200;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch(e) {}

  /* Remplir le champ */
  var field = document.getElementById(SCAN_fieldId);
  if (field) {
    field.value = code;
    field.dispatchEvent(new Event('input', {bubbles:true}));
    field.dispatchEvent(new Event('change', {bubbles:true}));
    field.focus();
  }
  stopScan();
}

function stopScan() {
  SCAN_active = false;
  if (SCAN_stream) {
    SCAN_stream.getTracks().forEach(function(t){ t.stop(); });
    SCAN_stream = null;
  }
  var modal = document.getElementById('scanModal');
  if (modal) modal.style.display = 'none';

  /* Réinitialiser tous les boutons scan */
  document.querySelectorAll('.vs-scan-btn').forEach(function(b){
    b.textContent = '📷';
    b.style.background = '#334155';
  });
}

/* ══════════════════════════════════════
   DOUCHETTE — Focus automatique
══════════════════════════════════════ */
function enableDouchetteMode(fieldId) {
  var field = document.getElementById(fieldId);
  if (!field) return;

  /* Indicateur visuel quand le champ est actif */
  field.addEventListener('focus', function() {
    field.style.boxShadow = '0 0 0 3px #22c55e44';
    field.dataset.douchetteReady = 'true';
  });
  field.addEventListener('blur', function() {
    field.style.boxShadow = '';
    field.dataset.douchetteReady = 'false';
  });

  /* La douchette envoie le code + Enter */
  field.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && field.value && field.dataset.douchetteReady) {
      e.preventDefault();
      field.dispatchEvent(new Event('input', {bubbles:true}));
      field.dispatchEvent(new Event('change', {bubbles:true}));
    }
  });
}

/* ══════════════════════════════════════
   FONCTIONS UTILITAIRES
══════════════════════════════════════ */

/**
 * Ajouter bouton voix après un champ
 * fieldId : id du champ input
 * callback : fonction appelée avec le texte reconnu (optionnel)
 */
function addVoiceButton(fieldId, callback) {
  var field = document.getElementById(fieldId);
  if (!field) return;

  field.dataset.originalPlaceholder = field.placeholder;

  var btn = document.createElement('button');
  btn.className   = 'vs-voice-btn';
  btn.textContent = '🎤';
  btn.title       = 'Saisie vocale (Chrome/Edge requis)';
  btn.type        = 'button';
  btn.style.cssText = [
    'padding:0 10px',
    'background:#334155',
    'color:white',
    'border:none',
    'border-radius:0 6px 6px 0',
    'cursor:pointer',
    'font-size:14px',
    'height:100%',
    'flex-shrink:0',
    'transition:background 0.2s'
  ].join(';');

  btn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    startVoice(fieldId, btn);
  });

  /* Wrapper le champ + bouton */
  wrapFieldWithButtons(field, [btn]);

  if (callback) {
    field.addEventListener('input', function(){ if (field.value) callback(field.value); });
  }
}

/**
 * Ajouter bouton scan caméra après un champ
 */
function addScanButton(fieldId, callback) {
  var field = document.getElementById(fieldId);
  if (!field) return;

  var btn = document.createElement('button');
  btn.className   = 'vs-scan-btn';
  btn.textContent = '📷';
  btn.title       = 'Scanner un code barre';
  btn.type        = 'button';
  btn.style.cssText = [
    'padding:0 10px',
    'background:#334155',
    'color:white',
    'border:none',
    'border-radius:0 6px 6px 0',
    'cursor:pointer',
    'font-size:14px',
    'height:100%',
    'flex-shrink:0',
    'transition:background 0.2s'
  ].join(';');

  btn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    startScan(fieldId, btn);
  });

  wrapFieldWithButtons(field, [btn]);
  enableDouchetteMode(fieldId);

  if (callback) {
    field.addEventListener('change', function(){ if (field.value) callback(field.value); });
  }
}

/**
 * Ajouter les DEUX boutons (voix + scan)
 */
function addVoiceScan(fieldId, callback) {
  var field = document.getElementById(fieldId);
  if (!field) return;
  field.dataset.originalPlaceholder = field.placeholder;

  var btnVoice = document.createElement('button');
  btnVoice.className   = 'vs-voice-btn';
  btnVoice.textContent = '🎤';
  btnVoice.title       = 'Saisie vocale';
  btnVoice.type        = 'button';

  var btnScan = document.createElement('button');
  btnScan.className   = 'vs-scan-btn';
  btnScan.textContent = '📷';
  btnScan.title       = 'Scanner code barre';
  btnScan.type        = 'button';

  var commonStyle = [
    'padding:0 10px',
    'color:white',
    'border:none',
    'cursor:pointer',
    'font-size:14px',
    'height:100%',
    'flex-shrink:0',
    'transition:background 0.2s'
  ].join(';');

  btnVoice.style.cssText = commonStyle + ';background:#334155;border-radius:0;';
  btnScan.style.cssText  = commonStyle + ';background:#334155;border-radius:0 6px 6px 0;';

  btnVoice.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    startVoice(fieldId, btnVoice);
  });
  btnScan.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    startScan(fieldId, btnScan);
  });

  wrapFieldWithButtons(field, [btnVoice, btnScan]);
  enableDouchetteMode(fieldId);

  if (callback) {
    field.addEventListener('input', function(){ if (field.value) callback(field.value); });
  }
}

/* Helper : encapsuler le champ dans un flex wrapper */
function wrapFieldWithButtons(field, buttons) {
  /* Éviter double wrapping */
  if (field.parentNode && field.parentNode.classList.contains('vs-wrapper')) {
    buttons.forEach(function(b){ field.parentNode.appendChild(b); });
    return;
  }

  var wrapper = document.createElement('div');
  wrapper.className = 'vs-wrapper';
  wrapper.style.cssText = 'display:flex;align-items:stretch;width:100%;';

  field.style.borderRadius = '6px 0 0 6px';
  field.style.flex = '1';
  field.style.minWidth = '0';

  field.parentNode.insertBefore(wrapper, field);
  wrapper.appendChild(field);
  buttons.forEach(function(b){ wrapper.appendChild(b); });
}
