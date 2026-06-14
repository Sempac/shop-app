require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;color:#1e293b;max-width:700px;margin:0 auto;padding:20px;}
  h1{background:#1e40af;color:white;padding:16px 20px;border-radius:8px;font-size:20px;margin-bottom:24px;}
  h2{color:#1e40af;font-size:16px;border-left:4px solid #3b82f6;padding-left:10px;margin-top:28px;}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:10px 0;}
  code{display:block;background:#0f172a;color:#e2e8f0;padding:12px 16px;border-radius:6px;font-family:monospace;font-size:13px;white-space:pre-wrap;margin:8px 0;line-height:1.6;}
  .warning{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:16px 0;}
  .ok{background:#dcfce7;border:1px solid #22c55e;border-radius:8px;padding:12px 16px;margin:16px 0;}
  .step{display:inline-block;background:#1e40af;color:white;border-radius:50%;width:24px;height:24px;text-align:center;line-height:24px;font-weight:bold;font-size:13px;margin-right:8px;}
  table{width:100%;border-collapse:collapse;margin:10px 0;}
  td,th{padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;}
  th{background:#1e40af;color:white;}
  tr:nth-child(even){background:#f8fafc;}
</style>
</head>
<body>

<h1>🔧 Procédure de récupération — The SMARTPHONE POS</h1>

<div class="ok">
  <strong>📅 Document généré le 14/06/2026</strong><br>
  À conserver précieusement. En cas de panne du serveur principal, suivre les étapes ci-dessous pour relancer l'application sur un PC de secours.
</div>

<h2>🔑 Informations essentielles (à garder en lieu sûr)</h2>
<div class="box">
  <table>
    <tr><th>Élément</th><th>Valeur</th></tr>
    <tr><td>Dépôt code source (GitHub)</td><td>https://github.com/Sempac/shop-app.git</td></tr>
    <tr><td>Utilisateur base de données</td><td>postgres</td></tr>
    <tr><td>Mot de passe base de données</td><td>Sempac</td></tr>
    <tr><td>Nom de la base</td><td>shop_db</td></tr>
    <tr><td>Port PostgreSQL</td><td>5432</td></tr>
    <tr><td>Backup OneDrive</td><td>OneDrive › Backups › smartphone-pos › dernier fichier .sql</td></tr>
  </table>
</div>

<h2><span class="step">1</span> Récupérer le backup depuis OneDrive</h2>
<div class="box">
  Ouvre OneDrive sur le PC de secours et navigue vers :<br><br>
  <strong>OneDrive › Backups › smartphone-pos</strong><br><br>
  Prends le fichier <strong>.sql le plus récent</strong> (ex : <code style="display:inline;background:#e2e8f0;color:#0f172a;padding:2px 6px;border-radius:4px;">backup_2026-06-14_02-00.sql</code>)<br>
  Copie-le dans <strong>C:\backup-shop\</strong> (crée le dossier si besoin).
</div>

<h2><span class="step">2</span> Installer les prérequis</h2>
<div class="box">
  Si ce n'est pas déjà installé sur le PC de secours :<br><br>
  • <strong>PostgreSQL 18</strong> → <a href="https://www.postgresql.org/download/windows/">postgresql.org/download/windows</a><br>
  &nbsp;&nbsp;⚠️ Lors de l'installation, mettre le mot de passe : <strong>Sempac</strong><br><br>
  • <strong>Node.js 20+</strong> → <a href="https://nodejs.org">nodejs.org</a>
</div>

<h2><span class="step">3</span> Restaurer la base de données</h2>
<div class="box">
  Ouvre une invite de commandes <strong>en tant qu'administrateur</strong> et exécute :
<code>set PGPASSWORD=Sempac

"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" -U postgres -c "CREATE DATABASE shop_db;"

"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" -U postgres -d shop_db -f C:\\backup-shop\\backup_2026-06-14_02-00.sql</code>
  ⚠️ Remplace le nom du fichier .sql par le plus récent disponible.
</div>

<h2><span class="step">4</span> Récupérer le code source</h2>
<div class="box">
  Dans une invite de commandes :
<code>git clone https://github.com/Sempac/shop-app.git C:\\apps\\shop-app
cd C:\\apps\\shop-app
npm install</code>
</div>

<h2><span class="step">5</span> Créer le fichier de configuration</h2>
<div class="box">
  Crée le fichier <strong>C:\apps\shop-app\.env</strong> avec ce contenu :
<code>DB_USER=postgres
DB_PASSWORD=Sempac
DB_NAME=shop_db
DB_HOST=localhost
DB_PORT=5432
EMAIL_USER=smartphonesatelier4@gmail.com
EMAIL_PASS=(mot de passe application Gmail)
CATALOGUE_ADMIN_PASS=Smartphone@Admin2026</code>
  ⚠️ Le mot de passe Gmail (EMAIL_PASS) est un <strong>mot de passe d'application</strong> généré dans les paramètres Google. À noter séparément.
</div>

<h2><span class="step">6</span> Lancer l'application</h2>
<div class="box">
<code>cd C:\\apps\\shop-app
node server.js</code>
  Puis ouvre le navigateur sur : <strong>http://localhost:3000</strong>
</div>

<h2>⚠️ Points d'attention</h2>
<div class="warning">
  <strong>Ce qui sera récupéré ✅</strong><br>
  • Toutes les données (ventes, réparations, dépenses, stock, clients)<br>
  • Le code complet de l'application<br><br>
  <strong>Ce qui ne sera PAS récupéré ❌</strong><br>
  • Les photos produits (dossier uploads/) — non incluses dans le backup OneDrive<br>
  • Les tokens Gmail OAuth2 (reconnexion requise sur /api/gmail/auth)
</div>

<hr style="margin:30px 0;border:none;border-top:1px solid #e2e8f0;">
<p style="font-size:12px;color:#94a3b8;text-align:center;">
  The SMARTPHONE — Document interne confidentiel — Généré automatiquement le 14/06/2026
</p>

</body>
</html>`;

transporter.sendMail({
  from: '"The SMARTPHONE" <smartphonesatelier4@gmail.com>',
  to: 'smartphonesatelier4@gmail.com, aek.boughari@gmail.com',
  subject: '🔧 Procédure de récupération — The SMARTPHONE POS',
  html: html
}, (err, info) => {
  if (err) { console.error('ERREUR:', err.message); process.exit(1); }
  console.log('✅ Email envoyé:', info.messageId);
  process.exit(0);
});
