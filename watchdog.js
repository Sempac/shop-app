const http = require('http');
const { execSync, exec } = require('child_process');
const net  = require('net');

const PORT  = process.env.WATCHDOG_PORT  || 3001;
const TOKEN = process.env.WATCHDOG_TOKEN || 'restart2025';
const APP_PORT = 3000;

function checkAppRunning() {
  return new Promise(resolve => {
    const s = net.createConnection(APP_PORT, '127.0.0.1');
    s.setTimeout(1500);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error',   () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}

function restartApp() {
  return new Promise((resolve, reject) => {
    // Essaie la tâche planifiée ShopApp (prod), sinon relance node directement
    const ps = `
      $task = Get-ScheduledTask -TaskName 'ShopApp' -ErrorAction SilentlyContinue
      if ($task) {
        if ($task.State -eq 'Running') { Stop-ScheduledTask 'ShopApp' -ErrorAction SilentlyContinue; Start-Sleep 2 }
        Start-ScheduledTask 'ShopApp'
        Write-Output 'task_ok'
      } else {
        Write-Output 'no_task'
      }
    `;
    exec(`powershell -NoProfile -Command "${ps.replace(/\n/g,' ')}"`, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

const HTML = (running) => `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>The SMARTPHONE — Watchdog</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0f;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center}
.logo{font-size:26px;font-weight:900;letter-spacing:-1px;margin-bottom:6px}
.logo span{color:#e8ff00}
.sub{font-size:12px;color:#6b6b85;margin-bottom:36px;letter-spacing:1px;text-transform:uppercase}
.status-box{width:100%;max-width:320px;background:#13131a;border:1px solid #2a2a3a;border-radius:18px;padding:28px 20px;margin-bottom:24px}
.dot{width:64px;height:64px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px}
.dot.on{background:rgba(0,230,118,.15);box-shadow:0 0 24px rgba(0,230,118,.25)}
.dot.off{background:rgba(255,80,80,.12);box-shadow:0 0 24px rgba(255,80,80,.15)}
.status-label{font-size:22px;font-weight:700;margin-bottom:6px}
.status-label.on{color:#00e676}
.status-label.off{color:#ff5252}
.status-sub{font-size:13px;color:#6b6b85}
.btn{width:100%;max-width:320px;padding:18px;border-radius:14px;border:0;font-size:16px;font-weight:700;cursor:pointer;transition:opacity .2s}
.btn-restart{background:#e8ff00;color:#000;margin-bottom:12px}
.btn-restart:active{opacity:.8}
.btn-refresh{background:#1a1a24;color:#f0f0f0;border:1px solid #2a2a3a}
.btn-refresh:active{opacity:.7}
.note{font-size:11px;color:#4a4a5a;margin-top:20px;line-height:1.6}
.spinner{display:none;width:20px;height:20px;border:3px solid #0003;border-top:3px solid #000;
  border-radius:50%;animation:spin .7s linear infinite;margin:0 auto}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="logo">📱 <span>SMARTPHONE</span></div>
<div class="sub">Watchdog serveur</div>

<div class="status-box">
  <div class="dot ${running?'on':'off'}">${running?'✅':'⚠️'}</div>
  <div class="status-label ${running?'on':'off'}">${running?'En ligne':'Hors ligne'}</div>
  <div class="status-sub">Port ${APP_PORT} — ${new Date().toLocaleTimeString('fr-FR')}</div>
</div>

<button class="btn btn-restart" onclick="doRestart()" id="btnR">
  🔄 Redémarrer le serveur
</button>
<button class="btn btn-refresh" onclick="location.reload()">
  ↻ Rafraîchir le statut
</button>
<div class="note">Le redémarrage prend ~10 secondes.<br>Rafraîchis ensuite cette page pour vérifier.</div>

<script>
function doRestart(){
  if(!confirm('Redémarrer le serveur ?')) return;
  var btn=document.getElementById('btnR');
  btn.disabled=true; btn.innerHTML='<div class="spinner" style="display:block"></div>';
  fetch('/restart?token=${TOKEN}',{method:'POST'})
    .then(r=>r.json())
    .then(d=>{
      setTimeout(()=>location.reload(), 10000);
      btn.innerHTML='⏳ Redémarrage en cours…';
    })
    .catch(()=>{ btn.disabled=false; btn.innerHTML='🔄 Redémarrer le serveur'; alert('Erreur réseau'); });
}
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);

  if (req.method === 'GET' && url.pathname === '/') {
    const running = await checkAppRunning();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(HTML(running));
  }

  if (req.method === 'GET' && url.pathname === '/status') {
    const running = await checkAppRunning();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ running, ts: Date.now() }));
  }

  if (req.method === 'POST' && url.pathname === '/restart') {
    if (url.searchParams.get('token') !== TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    try {
      const result = await restartApp();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, result }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`Watchdog démarré sur http://localhost:${PORT}  (token: ${TOKEN})`);
});
