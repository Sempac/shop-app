/**
 * input-tools.js — The SMARTPHONE POS
 * Saisie vocale + Scan code barre (caméra + douchette)
 * v2 — Scan global sans cliquer dans un champ
 */

var InputTools = (function() {

  /* ═══════════════════════════
     STYLES
  ═══════════════════════════ */
  function injectStyles() {
    if (document.getElementById('it-styles')) return;
    var s = document.createElement('style');
    s.id  = 'it-styles';
    s.textContent = [
      '.it-btn{display:inline-flex;align-items:center;justify-content:center;',
        'width:34px;height:34px;border:none;border-radius:6px;cursor:pointer;',
        'font-size:16px;background:#334155;color:white;flex-shrink:0;',
        'vertical-align:middle;margin-left:4px;transition:background 0.2s;}',
      '.it-btn:hover{background:#475569;}',
      '.it-btn.it-active{background:#ef4444;animation:it-pulse 1s infinite;}',
      '@keyframes it-pulse{0%,100%{opacity:1}50%{opacity:0.6}}',
      '#it-scan-modal{display:none;position:fixed;inset:0;background:#000000cc;',
        'z-index:9999;align-items:center;justify-content:center;}',
      '#it-scan-modal.show{display:flex;}',
      '#it-scan-box{background:#1e293b;border-radius:14px;padding:20px;',
        'width:360px;max-width:95vw;text-align:center;}',
      '#it-scan-box h4{margin:0 0 12px;font-size:14px;color:white;}',
      '#it-video-wrap{position:relative;border-radius:8px;overflow:hidden;',
        'background:#000;margin-bottom:12px;}',
      '#it-video{width:100%;height:200px;object-fit:cover;display:block;}',
      '#it-crosshair{position:absolute;inset:0;display:flex;align-items:center;',
        'justify-content:center;pointer-events:none;}',
      '#it-crosshair-inner{width:220px;height:70px;border:2px solid #22c55e;',
        'border-radius:4px;}',
      '#it-scan-status{font-size:12px;color:#94a3b8;margin-bottom:12px;}',
      '#it-scan-cancel{width:100%;padding:10px;background:#ef4444;color:white;',
        'border:none;border-radius:8px;font-size:13px;font-weight:bold;',
        'cursor:pointer;font-family:Arial;}',
      /* Toast scan global */
      '#it-scan-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);',
        'background:#22c55e;color:white;padding:10px 20px;border-radius:8px;',
        'font-size:13px;font-family:Arial;z-index:99999;display:none;',
        'box-shadow:0 4px 12px #0004;font-weight:bold;}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ═══════════════════════════
     MODAL CAMÉRA
  ═══════════════════════════ */
  function createScanModal() {
    if (document.getElementById('it-scan-modal')) return;
    var m = document.createElement('div');
    m.id  = 'it-scan-modal';
    m.innerHTML = [
      '<div id="it-scan-box">',
        '<h4>📷 Scanner un code barre</h4>',
        '<div id="it-video-wrap">',
          '<video id="it-video" autoplay playsinline muted></video>',
          '<canvas id="it-canvas" style="display:none"></canvas>',
          '<div id="it-crosshair"><div id="it-crosshair-inner"></div></div>',
        '</div>',
        '<div id="it-scan-status">Pointez vers le code barre...</div>',
        '<button id="it-scan-cancel" onclick="InputTools.stopScan()">✕ Annuler</button>',
      '</div>'
    ].join('');
    document.body.appendChild(m);

    /* Toast scan global */
    var toast = document.createElement('div');
    toast.id = 'it-scan-toast';
    document.body.appendChild(toast);
  }

  /* ═══════════════════════════
     ÉTAT INTERNE
  ═══════════════════════════ */
  var _voiceActive  = false;
  var _recognition  = null;
  var _scanActive   = false;
  var _scanStream   = null;
  var _scanFieldId  = null;
  var _scanCallback = null;
  var _scanBtn      = null;
  var _detector     = null;

  /* ══════════════════════════════════════════
     SCAN GLOBAL DOUCHETTE — sans cliquer
     Détecte séquence rapide + Enter
  ══════════════════════════════════════════ */
  var _globalBuffer   = '';
  var _globalTimer    = null;
  var _globalEnabled  = false;
  var _globalCallback = null;
  var _lastScannedCode = '';
  var _lastScannedTime = 0;
  var _DEBOUNCE_MS     = 2000; /* Ignorer le même code dans les 1.5s */

  function enableGlobalScan(callback) {
    if (_globalEnabled) return;
    _globalEnabled  = true;
    _globalCallback = callback;

    document.addEventListener('keydown', function(e) {
      var tag    = document.activeElement ? document.activeElement.tagName : '';
      var isInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');

      /* Détecter modal ouvert */
      var modalOpen = !!document.querySelector('.moverlay.show, #overlay, [id="modal"].show');

      if (e.key === 'Enter') {
        if (_globalBuffer.length >= 3) {
          var code = _globalBuffer.trim();
          _globalBuffer = '';
          clearTimeout(_globalTimer);

          /* Si l'utilisateur tapait manuellement dans un champ (frappe lente) → ignorer
             Mais si c'est la douchette (frappe rapide) → toujours traiter */
          /* On ne bloque plus rien ici — le callback gère selon le contexte */

          /* Bip */
          try {
            var ac = new AudioContext(); var osc = ac.createOscillator(); var g = ac.createGain();
            osc.connect(g); g.connect(ac.destination); osc.frequency.value = 1200;
            g.gain.setValueAtTime(0.3, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.12);
            osc.start(); osc.stop(ac.currentTime + 0.12);
          } catch(err) {}

          /* Anti-doublon : ignorer si même code dans les 1.5s */
          var now = Date.now();
          if (code === _lastScannedCode && (now - _lastScannedTime) < _DEBOUNCE_MS) {
            return; /* Doublon ignoré */
          }
          _lastScannedCode = code;
          _lastScannedTime = now;

          if (_globalCallback) _globalCallback(code, isInput && !modalOpen);
        } else {
          _globalBuffer = '';
        }
        return;
      }

      /* Accumule les caractères — JAMAIS de preventDefault (ne pas bloquer saisie manuelle) */
      if (e.key && e.key.length === 1) {
        _globalBuffer += e.key;
        clearTimeout(_globalTimer);
        _globalTimer = setTimeout(function() { _globalBuffer = ''; }, 300);
      }
    });
  }

  /* ═══════════════════════════
     SAISIE VOCALE
  ═══════════════════════════ */
  function startVoice(fieldId, btn, callback) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('🎤 Voix non supportée — utilisez Chrome ou Edge'); return; }
    if (_voiceActive) { if (_recognition) _recognition.stop(); return; }

    var field = document.getElementById(fieldId);
    if (!field) return;

    _voiceActive = true;
    btn.classList.add('it-active');

    _recognition = new SR();
    _recognition.lang = 'fr-FR';
    _recognition.continuous = false;
    _recognition.interimResults = false;

    _recognition.onresult = function(e) {
      var text = e.results[0][0].transcript.replace(/[.,;:!?]/g, '').trim();
      field.value = text;
      field.dispatchEvent(new Event('input',  {bubbles:true}));
      field.dispatchEvent(new Event('change', {bubbles:true}));
      field.focus();
      if (callback) callback(text);
      resetVoice(btn);
    };

    _recognition.onerror = function(err) {
      var msgs = {'not-allowed':'Microphone refusé','no-speech':'Aucune parole','network':'Erreur réseau','audio-capture':'Pas de micro'};
      showToast('🎤 ' + (msgs[err.error] || 'Erreur: ' + err.error));
      resetVoice(btn);
    };

    _recognition.onend = function() { resetVoice(btn); };
    _recognition.start();
  }

  function resetVoice(btn) {
    _voiceActive = false;
    if (btn) btn.classList.remove('it-active');
  }

  /* ═══════════════════════════
     SCAN CAMÉRA
  ═══════════════════════════ */
  function startScan(fieldId, btn, callback) {
    if (_scanActive) { stopScan(); return; }
    createScanModal();
    _scanFieldId  = fieldId;
    _scanCallback = callback;
    _scanBtn      = btn;
    _scanActive   = true;
    if (btn) btn.classList.add('it-active');
    document.getElementById('it-scan-modal').classList.add('show');
    document.getElementById('it-scan-status').textContent = 'Démarrage caméra...';

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width:{ideal:1280}, height:{ideal:720} }
    }).then(function(stream) {
      _scanStream = stream;
      var video = document.getElementById('it-video');
      video.srcObject = stream;
      video.play();
      document.getElementById('it-scan-status').textContent = 'Pointez vers le code barre...';
      if ('BarcodeDetector' in window) {
        _detector = new BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','qr_code','upc_a','upc_e','itf']});
        requestAnimationFrame(scanLoop);
      } else {
        document.getElementById('it-scan-status').textContent = '⚠️ Scan non supporté — utilisez Chrome';
      }
    }).catch(function(err) {
      document.getElementById('it-scan-status').textContent = '❌ Caméra: ' + err.message;
    });
  }

  function scanLoop() {
    if (!_scanActive || !_detector) return;
    var video = document.getElementById('it-video');
    if (!video || video.readyState < 2) { requestAnimationFrame(scanLoop); return; }
    _detector.detect(video).then(function(codes) {
      if (codes.length > 0) onCodeDetected(codes[0].rawValue);
      else requestAnimationFrame(scanLoop);
    }).catch(function() { requestAnimationFrame(scanLoop); });
  }

  function onCodeDetected(code) {
    try {
      var ac = new AudioContext(); var osc = ac.createOscillator(); var g = ac.createGain();
      osc.connect(g); g.connect(ac.destination); osc.frequency.value = 1200;
      g.gain.setValueAtTime(0.3, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.12);
      osc.start(); osc.stop(ac.currentTime + 0.12);
    } catch(e) {}
    var field = document.getElementById(_scanFieldId);
    if (field) {
      field.value = code;
      field.dispatchEvent(new Event('input',  {bubbles:true}));
      field.dispatchEvent(new Event('change', {bubbles:true}));
      field.focus();
    }
    if (_scanCallback) _scanCallback(code);
    stopScan();
  }

  function stopScan() {
    _scanActive = false; _detector = null;
    if (_scanStream) { _scanStream.getTracks().forEach(function(t){t.stop();}); _scanStream = null; }
    var modal = document.getElementById('it-scan-modal');
    if (modal) modal.classList.remove('show');
    if (_scanBtn) { _scanBtn.classList.remove('it-active'); _scanBtn = null; }
  }

  /* ═══════════════════════════
     DOUCHETTE SUR UN CHAMP
  ═══════════════════════════ */
  function enableBarcode(fieldId, callback) {
    var field = document.getElementById(fieldId);
    if (!field) return;
    field.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (field.value.trim()) {
          field.dispatchEvent(new Event('input',  {bubbles:true}));
          field.dispatchEvent(new Event('change', {bubbles:true}));
          if (callback) callback(field.value.trim());
        }
      }
    });
    field.addEventListener('focus', function(){ field.style.boxShadow = '0 0 0 3px #22c55e44'; });
    field.addEventListener('blur',  function(){ field.style.boxShadow = ''; });
  }

  /* ═══════════════════════════
     TOAST
  ═══════════════════════════ */
  function showToast(msg) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:white;padding:10px 18px;border-radius:8px;font-size:13px;font-family:Arial;z-index:99999;box-shadow:0 4px 12px #0004;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 3000);
  }

  function showScanToast(code) {
    var t = document.getElementById('it-scan-toast');
    if (!t) return;
    t.textContent = '🔍 ' + code;
    t.style.display = 'block';
    setTimeout(function(){ t.style.display = 'none'; }, 2000);
  }

  /* ═══════════════════════════
     CRÉER UN BOUTON
  ═══════════════════════════ */
  function makeBtn(icon, title, onclick) {
    var btn = document.createElement('button');
    btn.className   = 'it-btn';
    btn.type        = 'button';
    btn.textContent = icon;
    btn.title       = title;
    btn.onclick     = onclick;
    return btn;
  }

  /* ═══════════════════════════
     API PUBLIQUE
  ═══════════════════════════ */
  function addVoice(fieldId, callback) {
    injectStyles();
    var field = document.getElementById(fieldId);
    if (!field) return;
    var btn = makeBtn('🎤', 'Saisie vocale', function(){ startVoice(fieldId, btn, callback); });
    field.insertAdjacentElement('afterend', btn);
  }

  function addScan(fieldId, callback) {
    injectStyles(); createScanModal();
    var field = document.getElementById(fieldId);
    if (!field) return;
    enableBarcode(fieldId, callback);
    var btn = makeBtn('📷', 'Scanner un code barre', function(){ startScan(fieldId, btn, callback); });
    field.insertAdjacentElement('afterend', btn);
  }

  function addBoth(fieldId, callback) {
    injectStyles(); createScanModal();
    var field = document.getElementById(fieldId);
    if (!field) return;
    enableBarcode(fieldId, callback);
    var btnScan  = makeBtn('📷', 'Scanner un code barre', function(){ startScan(fieldId, btnScan, callback); });
    var btnVoice = makeBtn('🎤', 'Saisie vocale', function(){ startVoice(fieldId, btnVoice, callback); });
    field.insertAdjacentElement('afterend', btnScan);
    btnScan.insertAdjacentElement('afterend', btnVoice);
  }

  return {
    addVoice:         addVoice,
    addScan:          addScan,
    addBoth:          addBoth,
    stopScan:         stopScan,
    enableGlobalScan: enableGlobalScan,
    showScanToast:    showScanToast
  };

})();
