/**
 * gmail-test-factures.js
 * Récupère les 10 dernières factures PDF (LCDPhone / Utopya) depuis Gmail
 * et exporte le résultat dans un fichier Excel pour validation.
 *
 * Usage : node gmail-test-factures.js
 */
require('dotenv').config();
const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { exec } = require('child_process');
const XLSX = require('xlsx');

const TOKEN_FILE = path.join(__dirname, 'gmail_tokens.json');

/* ── OAuth2 ─────────────────────────────────────────────── */
function getOAuth2Client() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/gmail/auth/callback'
  );
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error('❌ gmail_tokens.json introuvable.');
    console.error('   Visitez http://localhost:3000/api/gmail/auth pour autoriser Gmail.');
    process.exit(1);
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  oauth2.setCredentials(tokens);
  oauth2.on('tokens', t => {
    Object.assign(tokens, t);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens));
  });
  return oauth2;
}

/* ── Trouve les pièces jointes PDF dans un message ──────── */
function findPdfParts(part, acc) {
  if (!part) return;
  if (part.filename && /\.pdf$/i.test(part.filename) && part.body && part.body.attachmentId)
    acc.push({ filename: part.filename, attachmentId: part.body.attachmentId });
  (part.parts || []).forEach(function(p) { findPdfParts(p, acc); });
}

/* ── Lance parse_invoice.py sur un fichier PDF ──────────── */
function runPython(pdfPath) {
  return new Promise(function(resolve, reject) {
    var pyScript = path.join(__dirname, 'parse_invoice.py');
    var WIN_PYTHON = 'C:\\Users\\PC\\AppData\\Local\\Python\\bin\\python.exe';
    var pyCmd = process.platform === 'win32'
      ? (fs.existsSync(WIN_PYTHON) ? '"' + WIN_PYTHON + '"' : 'python')
      : 'python3';
    exec(pyCmd + ' "' + pyScript + '" "' + pdfPath + '"',
      { encoding: 'utf-8', timeout: 60000 },
      function(err, stdout, stderr) {
        if (err) return reject(new Error(stderr || err.message));
        try { resolve(JSON.parse(stdout)); }
        catch(e) { reject(new Error('JSON invalide: ' + stdout.slice(0, 300))); }
      }
    );
  });
}

/* ── Main ───────────────────────────────────────────────── */
async function main() {
  var oauth2 = getOAuth2Client();
  var gmail  = google.gmail({ version: 'v1', auth: oauth2 });

  console.log('🔍 Recherche des factures PDF LCDPhone / Utopya dans Gmail...\n');

  /* Requête ciblant les FACTURES fournisseurs (pas les bons de livraison)
     - LCD Phone / Smart Gadget Home : from:notification@lcd-phone.com
     - Utopya : subject:"Confirmation de votre commande UTOPYA" (contient Facture-FA*.pdf)
       NB : "Votre commande est prête" = BON-LIVRAISON → ignoré */
  var listRes = await gmail.users.messages.list({
    userId: 'me',
    q: 'has:attachment filename:pdf (from:notification@lcd-phone.com OR subject:"Confirmation de votre commande UTOPYA") after:2026/04/01',
    maxResults: 200
  });

  var msgIds = (listRes.data.messages || []);
  if (!msgIds.length) {
    console.log('⚠️  Aucun email trouvé avec ces critères.');
    process.exit(0);
  }

  var rows = [];
  var processed = 0;
  var MAX = 999; /* pas de limite — on prend tout depuis début avril */
  var seenFactures = {}; /* dédoublonnage par numéro de facture */

  for (var i = 0; i < msgIds.length && processed < MAX; i++) {
    var id = msgIds[i].id;

    var msg = await gmail.users.messages.get({ userId: 'me', id: id, format: 'full' });
    var headers = msg.data.payload.headers || [];
    function getH(n) { var h = headers.find(function(x){ return x.name===n; }); return h ? h.value : ''; }
    var from    = getH('From');
    var subject = getH('Subject');
    var date    = getH('Date');

    var pdfs = [];
    findPdfParts(msg.data.payload, pdfs);
    if (!pdfs.length) continue;

    console.log('📧 ' + date);
    console.log('   De      : ' + from);
    console.log('   Objet   : ' + subject);
    console.log('   PDF(s)  : ' + pdfs.map(function(p){ return p.filename; }).join(', '));

    for (var j = 0; j < pdfs.length; j++) {
      var pdf = pdfs[j];
      /* Ignorer les bons de livraison Utopya (pas de prix) */
      if (/^BON-LIVRAISON/i.test(pdf.filename)) {
        console.log('   ⏩ Ignoré (bon de livraison) : ' + pdf.filename);
        continue;
      }
      var tmpPath = path.join(os.tmpdir(), 'facture_test_' + id + '_' + Date.now() + '.pdf');
      try {
        /* Télécharger la pièce jointe */
        var att = await gmail.users.messages.attachments.get({
          userId: 'me', messageId: id, id: pdf.attachmentId
        });
        fs.writeFileSync(tmpPath, Buffer.from(att.data.data, 'base64'));

        /* Parser le PDF */
        var data = await runPython(tmpPath);
        try { fs.unlinkSync(tmpPath); } catch(e) {}

        var fournisseur = data.fournisseur || '⚠️ Non reconnu';
        var nbItems     = (data.items || []).length;
        /* Dédoublonnage : même numéro de facture déjà traité → ignorer */
        if (data.numero && seenFactures[data.numero]) {
          console.log('   ⏩ Doublon ignoré : Facture ' + data.numero);
          continue;
        }
        if (data.numero) seenFactures[data.numero] = true;
        console.log('   ✓ ' + fournisseur + ' | Facture ' + (data.numero||'?') + ' | ' + nbItems + ' article(s)');

        if (nbItems > 0) {
          data.items.forEach(function(item) {
            rows.push({
              'Date email'       : date,
              'Expéditeur'       : from,
              'Fournisseur'      : fournisseur,
              'N° Facture'       : data.numero      || '',
              'Date Facture'     : data.date        || '',
              'Transporteur'     : data.transporteur || '',
              'Total HT (€)'     : data.total_ht    || '',
              'Total TTC (€)'    : data.total_ttc   || '',
              'Référence'        : item.reference   || '',
              'Nom produit'      : item.nom         || '',
              'Quantité'         : item.quantite    || 1,
              'Prix HT unit. (€)': item.prix_ht     || '',
              'Fichier PDF'      : pdf.filename
            });
          });
        } else {
          rows.push({
            'Date email'       : date,
            'Expéditeur'       : from,
            'Fournisseur'      : fournisseur,
            'N° Facture'       : data.numero      || '',
            'Date Facture'     : data.date        || '',
            'Transporteur'     : data.transporteur || '',
            'Total HT (€)'     : data.total_ht    || '',
            'Total TTC (€)'    : data.total_ttc   || '',
            'Référence'        : '',
            'Nom produit'      : '⚠️ Aucun article extrait',
            'Quantité'         : '',
            'Prix HT unit. (€)': '',
            'Fichier PDF'      : pdf.filename
          });
        }
        processed++;

      } catch(e) {
        try { fs.unlinkSync(tmpPath); } catch(x) {}
        console.error('   ❌ Erreur : ' + e.message);
        rows.push({
          'Date email'       : date,
          'Expéditeur'       : from,
          'Fournisseur'      : '❌ Erreur parsing',
          'N° Facture'       : '',
          'Date Facture'     : '',
          'Transporteur'     : '',
          'Total HT (€)'     : '',
          'Total TTC (€)'    : '',
          'Référence'        : '',
          'Nom produit'      : 'ERREUR: ' + e.message.slice(0, 200),
          'Quantité'         : '',
          'Prix HT unit. (€)': '',
          'Fichier PDF'      : pdf.filename
        });
      }
    }
    console.log('');
  }

  if (!rows.length) {
    console.log('⚠️  Aucun résultat à exporter.');
    process.exit(0);
  }

  /* ── Export Excel ──────────────────────────────────────── */
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 38 }, /* Date email        */
    { wch: 42 }, /* Expéditeur        */
    { wch: 28 }, /* Fournisseur       */
    { wch: 16 }, /* N° Facture        */
    { wch: 14 }, /* Date Facture      */
    { wch: 16 }, /* Transporteur      */
    { wch: 13 }, /* Total HT          */
    { wch: 13 }, /* Total TTC         */
    { wch: 20 }, /* Référence         */
    { wch: 55 }, /* Nom produit       */
    { wch: 10 }, /* Quantité          */
    { wch: 18 }, /* Prix HT unit.     */
    { wch: 32 }, /* Fichier PDF       */
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Factures');

  var dateStr  = new Date().toISOString().slice(0, 10);
  var outFile  = path.join(__dirname, 'test_factures_gmail_' + dateStr + '.xlsx');
  XLSX.writeFile(wb, outFile);

  console.log('─────────────────────────────────────────────');
  console.log('✅ ' + processed + ' facture(s) traitée(s) | ' + rows.length + ' lignes');
  console.log('📁 Fichier Excel : ' + outFile);
}

main().catch(function(e) {
  console.error('\n❌ ERREUR FATALE :', e.message);
  process.exit(1);
});
