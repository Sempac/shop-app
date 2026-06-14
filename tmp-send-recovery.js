const fs = require('fs');
const path = require('path');

const ONEDRIVE = 'C:\\Users\\PC\\OneDrive\\Backups\\smartphone-pos';
const OUT = path.join(ONEDRIVE, 'PROCEDURE-RECUPERATION.html');

const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Procédure de récupération — The SMARTPHONE POS</title>
<style>
  body{font-family:Arial,sans-serif;color:#1e293b;max-width:750px;margin:40px auto;padding:20px;}
  h1{background:#1e40af;color:white;padding:16px 20px;border-radius:8px;font-size:22px;}
  h2{color:#1e40af;font-size:16px;border-left:4px solid #3b82f6;padding-left:10px;margin-top:28px;}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:10px 0;}
  code{display:block;background:#0f172a;color:#e2e8f0;padding:12px 16px;border-radius:6px;font-family:'Courier New',monospace;font-size:13px;white-space:pre-wrap;margin:8px 0;line-height:1.7;}
  .warning{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:16px 0;}
  .ok{background:#dcfce7;border:1px solid #22c55e;border-radius:8px;padding:12px 16px;margin:16px 0;}
  .step{display:inline-block;background:#1e40af;color:white;border-radius:50%;width:26px;height:26px;text-align:center;line-height:26px;font-weight:bold;font-size:14px;margin-right:8px;}
  table{width:100%;border-collapse:collapse;margin:10px 0;}
  td,th{padding:9px 14px;border:1px solid #e2e8f0;font-size:13px;}
  th{background:#1e40af;color:white;text-align:left;}
  tr:nth-child(even){background:#f8fafc;}
  @media print{body{margin:10px;}.box{break-inside:avoid;}}
</style>
</head>
<body>

<h1>🔧 Procédure de récupération — The SMARTPHONE POS</h1>

<div class="ok">
  <strong>📅 Document généré le 14/06/2026</strong><br>
  En cas de panne du serveur principal, suivre les étapes ci-dessous pour relancer l'application sur n'importe quel PC.
</div>

<h2>🔑 Informations essentielles</h2>
<div class="box">
  <table>
    <tr><th>Élément</th><th>Valeur</th></tr>
    <tr><td>Code source (GitHub)</td><td><strong>https://github.com/Sempac/shop-app.git</strong></td></tr>
    <tr><td>Utilisateur base de données</td><td>postgres</td></tr>
    <tr><td>Mot de passe base de données</td><td><strong>Sempac</strong></td></tr>
    <tr><td>Nom de la base</td><td>shop_db</td></tr>
    <tr><td>Port PostgreSQL</td><td>5432</td></tr>
    <tr><td>Backup OneDrive</td><td>OneDrive › Backups › smartphone-pos › dernier fichier .sql</td></tr>
    <tr><td>Admin catalogue</td><td>Smartphone@Admin2026</td></tr>
  </table>
</div>

<h2><span class="step">1</span> Récupérer le backup depuis OneDrive</h2>
<div class="box">
  Ouvre OneDrive sur le PC de secours :<br><br>
  📁 <strong>OneDrive › Backups › smartphone-pos</strong><br><br>
  → Prendre le fichier <strong>.sql le plus récent</strong> (ex : backup_2026-06-14_02-00.sql)<br>
  → Copier dans <strong>C:\backup-shop\</strong> (créer le dossier si besoin)
</div>

<h2><span class="step">2</span> Installer les prérequis <em style="font-size:12px;color:#64748b;">(si pas déjà installés)</em></h2>
<div class="box">
  • <strong>PostgreSQL 18</strong> → https://www.postgresql.org/download/windows/<br>
  &nbsp;&nbsp;&nbsp;⚠️ Lors de l'installation : mettre le mot de passe <strong>Sempac</strong><br><br>
  • <strong>Node.js 20+</strong> → https://nodejs.org/
</div>

<h2><span class="step">3</span> Restaurer la base de données</h2>
<div class="box">
  Ouvrir une <strong>invite de commandes en tant qu'administrateur</strong> et taper :
<code>set PGPASSWORD=Sempac

"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" -U postgres -c "CREATE DATABASE shop_db;"

"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" -U postgres -d shop_db -f C:\\backup-shop\\backup_2026-06-14_02-00.sql</code>
  ⚠️ Adapter le nom du fichier .sql avec le plus récent disponible dans OneDrive.
</div>

<h2><span class="step">4</span> Récupérer le code source</h2>
<div class="box">
<code>git clone https://github.com/Sempac/shop-app.git C:\\apps\\shop-app
cd C:\\apps\\shop-app
npm install</code>
</div>

<h2><span class="step">5</span> Créer le fichier de configuration</h2>
<div class="box">
  Créer le fichier <strong>C:\apps\shop-app\.env</strong> avec le contenu suivant :
<code>DB_USER=postgres
DB_PASSWORD=Sempac
DB_NAME=shop_db
DB_HOST=localhost
DB_PORT=5432
EMAIL_USER=smartphonesatelier4@gmail.com
EMAIL_PASS=(mot de passe application Gmail)
CATALOGUE_ADMIN_PASS=Smartphone@Admin2026</code>
  ⚠️ Le <em>mot de passe application Gmail</em> se génère dans : Compte Google › Sécurité › Mots de passe des applications.
</div>

<h2><span class="step">6</span> Lancer l'application</h2>
<div class="box">
<code>cd C:\\apps\\shop-app
node server.js</code>
  Puis ouvrir le navigateur sur : <strong>http://localhost:3000</strong><br>
  Login avec les identifiants habituels.
</div>

<h2>⚠️ Ce qui sera récupéré / perdu</h2>
<div class="warning">
  <strong>✅ Récupéré</strong> : Toutes les données (ventes, réparations, dépenses, stock, clients, catalogue)<br><br>
  <strong>❌ Non récupéré</strong> : Photos produits (dossier uploads/) · Tokens Gmail OAuth2 (→ se reconnecter sur /api/gmail/auth)
</div>

<hr style="margin:30px 0;border:none;border-top:1px solid #e2e8f0;">
<p style="font-size:12px;color:#94a3b8;text-align:center;">
  The SMARTPHONE — Document interne confidentiel — Généré le 14/06/2026<br>
  Ce fichier est disponible dans OneDrive › Backups › smartphone-pos › PROCEDURE-RECUPERATION.html
</p>

</body></html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('✅ Document sauvegardé dans OneDrive :', OUT);
