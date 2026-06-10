/**
 * gmail-historique.js
 * Export Excel de TOUTES les factures Gmail depuis 2025/01/01 jusqu'à aujourd'hui.
 * Feuille 1 : données brutes
 * Feuille 2 : analyse de fréquence par référence produit (SKU)
 * Usage unique / ponctuel : node gmail-historique.js
 */
require('dotenv').config();
const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { exec } = require('child_process');
const XLSX = require('xlsx');

const TOKEN_FILE = path.join(__dirname, 'gmail_tokens.json');

function getOAuth2Client() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/gmail/auth/callback'
  );
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error('❌ gmail_tokens.json introuvable.');
    process.exit(1);
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  oauth2.setCredentials(tokens);
  oauth2.on('tokens', function(t) {
    Object.assign(tokens, t);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens));
  });
  return oauth2;
}

function findPdfParts(part, acc) {
  if (!part) return;
  if (part.filename && /\.pdf$/i.test(part.filename) && part.body && part.body.attachmentId)
    acc.push({ filename: part.filename, attachmentId: part.body.attachmentId });
  (part.parts || []).forEach(function(p) { findPdfParts(p, acc); });
}

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

async function fetchAllPages(gmail, query) {
  var messages = [];
  var pageToken = undefined;
  do {
    var params = { userId: 'me', q: query, maxResults: 500 };
    if (pageToken) params.pageToken = pageToken;
    var res = await gmail.users.messages.list(params);
    var batch = res.data.messages || [];
    messages = messages.concat(batch);
    pageToken = res.data.nextPageToken;
    if (batch.length > 0) process.stdout.write('\r  ... ' + messages.length + ' emails récupérés   ');
  } while (pageToken);
  console.log('');
  return messages;
}

/* ── Analyse de fréquence par SKU ────────────────────────────────── */
function buildAnalyse(rows) {
  /* Générer les colonnes mois de Jan 2025 à aujourd'hui */
  var months = [];
  var d = new Date(2025, 0, 1);
  var now = new Date();
  while (d <= now) {
    months.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
    d.setMonth(d.getMonth() + 1);
  }

  /* Regrouper par référence SKU */
  var byRef = {};
  rows.forEach(function(row) {
    var ref = row['Référence'];
    if (!ref || ref === '') return;
    if (!byRef[ref]) {
      byRef[ref] = {
        ref: ref,
        noms: {},          /* comptage des noms pour prendre le plus fréquent */
        fournisseur: row['Fournisseur'],
        totalQte: 0,
        totalCommandes: 0,
        factures: {},      /* factures uniques pour compter les commandes */
        parMois: {}
      };
      months.forEach(function(m) { byRef[ref].parMois[m] = 0; });
    }
    var entry = byRef[ref];

    /* Nom le plus fréquent */
    var nom = (row['Nom produit'] || '').trim();
    if (nom) entry.noms[nom] = (entry.noms[nom] || 0) + 1;

    /* Quantité */
    var qte = parseInt(row['Quantité']) || 1;
    entry.totalQte += qte;

    /* Commandes uniques (par N° facture) */
    var facNum = row['N° Facture'];
    if (facNum && !entry.factures[facNum]) {
      entry.factures[facNum] = true;
      entry.totalCommandes++;
    }

    /* Répartition par mois — depuis la date email */
    var dateStr = row['Date email'] || row['Date Facture'] || '';
    var mois = parseMois(dateStr);
    if (mois && entry.parMois.hasOwnProperty(mois)) {
      entry.parMois[mois] += qte;
    }
  });

  /* Construire les lignes d'analyse */
  var analyseRows = Object.values(byRef).sort(function(a, b) {
    return b.totalQte - a.totalQte;  /* tri par quantité totale décroissante */
  });

  var result = analyseRows.map(function(e) {
    var nomPlusFréquent = Object.keys(e.noms).sort(function(a,b){ return e.noms[b]-e.noms[a]; })[0] || '';
    var moisActifs = months.filter(function(m){ return e.parMois[m] > 0; }).length;
    var moyParMois = moisActifs > 0 ? Math.round((e.totalQte / moisActifs) * 10) / 10 : 0;

    var ligne = {
      'Référence'         : e.ref,
      'Nom produit'       : nomPlusFréquent,
      'Fournisseur'       : e.fournisseur,
      'Total qté commandée': e.totalQte,
      'Nb commandes'      : e.totalCommandes,
      'Mois actifs'       : moisActifs,
      'Moy. qté/mois actif': moyParMois
    };
    months.forEach(function(m) { ligne[m] = e.parMois[m] || ''; });
    return ligne;
  });

  return result;
}

function parseMois(dateStr) {
  /* Format RFC2822 : "Tue, 02 Jun 2026 10:51:00 +0200"  ou  "DD/MM/YYYY" */
  var moisAbr = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
  var m = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (m) {
    var mo = moisAbr[m[2]] || 0;
    if (mo) return m[3] + '-' + String(mo).padStart(2,'0');
  }
  /* Format DD/MM/YYYY */
  m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return m[3] + '-' + m[2];
  return null;
}

/* ── Main ─────────────────────────────────────────────────────────── */
async function main() {
  var oauth2 = getOAuth2Client();
  var gmail  = google.gmail({ version: 'v1', auth: oauth2 });

  console.log('🔍 Récupération de TOUTES les factures Gmail depuis 2025/01/01...');
  var query = 'has:attachment filename:pdf (from:notification@lcd-phone.com OR subject:"Confirmation de votre commande UTOPYA") after:2025/01/01';
  var msgIds = await fetchAllPages(gmail, query);

  console.log('📬 Total emails : ' + msgIds.length + '\n');
  if (!msgIds.length) { console.log('⚠️  Aucun email.'); process.exit(0); }

  var rows = [];
  var seenFactures = {};

  for (var i = 0; i < msgIds.length; i++) {
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

    process.stdout.write('[' + (i+1) + '/' + msgIds.length + '] ' + (date||'').slice(5,22) + ' | ' + subject.slice(0,50) + '\n');

    for (var j = 0; j < pdfs.length; j++) {
      var pdf = pdfs[j];
      if (/^BON-LIVRAISON/i.test(pdf.filename)) continue;

      var tmpPath = path.join(os.tmpdir(), 'hist_' + id + '_' + Date.now() + '.pdf');
      try {
        var att = await gmail.users.messages.attachments.get({
          userId: 'me', messageId: id, id: pdf.attachmentId
        });
        fs.writeFileSync(tmpPath, Buffer.from(att.data.data, 'base64'));

        var data = await runPython(tmpPath);
        try { fs.unlinkSync(tmpPath); } catch(e) {}

        if (data.numero && seenFactures[data.numero]) continue;
        if (data.numero) seenFactures[data.numero] = true;

        var fournisseur = data.fournisseur || '⚠️ Non reconnu';
        var nbItems = (data.items || []).length;
        process.stdout.write('  ✓ ' + fournisseur + ' | ' + (data.numero||'?') + ' | ' + nbItems + ' art.\n');

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
            'Date email': date, 'Expéditeur': from, 'Fournisseur': fournisseur,
            'N° Facture': data.numero||'', 'Date Facture': data.date||'',
            'Transporteur': data.transporteur||'', 'Total HT (€)': data.total_ht||'',
            'Total TTC (€)': data.total_ttc||'', 'Référence': '',
            'Nom produit': '⚠️ Aucun article extrait', 'Quantité': '',
            'Prix HT unit. (€)': '', 'Fichier PDF': pdf.filename
          });
        }
      } catch(e) {
        try { fs.unlinkSync(tmpPath); } catch(x) {}
        console.error('  ❌ ' + e.message);
        rows.push({
          'Date email': date, 'Expéditeur': from, 'Fournisseur': '❌ Erreur parsing',
          'N° Facture': '', 'Date Facture': '', 'Transporteur': '',
          'Total HT (€)': '', 'Total TTC (€)': '', 'Référence': '',
          'Nom produit': 'ERREUR: ' + e.message.slice(0,200),
          'Quantité': '', 'Prix HT unit. (€)': '', 'Fichier PDF': pdf.filename
        });
      }
    }
  }

  if (!rows.length) { console.log('⚠️  Aucun résultat.'); process.exit(0); }

  /* ── Feuille 1 : données brutes ─────────────────────────────── */
  var wb = XLSX.utils.book_new();
  var ws1 = XLSX.utils.json_to_sheet(rows);
  ws1['!cols'] = [
    {wch:38},{wch:42},{wch:28},{wch:16},{wch:14},
    {wch:16},{wch:13},{wch:13},{wch:20},{wch:55},
    {wch:10},{wch:18},{wch:32}
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Factures');

  /* ── Feuille 2 : analyse fréquence ──────────────────────────── */
  console.log('\n📊 Génération de l\'analyse de fréquence...');
  var analyseRows = buildAnalyse(rows);
  var ws2 = XLSX.utils.json_to_sheet(analyseRows);
  /* Largeurs colonnes */
  var cols2 = [{wch:16},{wch:55},{wch:28},{wch:20},{wch:15},{wch:13},{wch:20}];
  /* Colonnes mois : largeur 10 chacune */
  for (var k = 0; k < 30; k++) cols2.push({wch:10});
  ws2['!cols'] = cols2;
  XLSX.utils.book_append_sheet(wb, ws2, 'Fréquence par produit');

  var outFile = path.join(__dirname, 'historique_factures_2025-2026.xlsx');
  XLSX.writeFile(wb, outFile);

  var nbFactures = Object.keys(seenFactures).length;
  console.log('─────────────────────────────────────────────────────');
  console.log('✅ ' + nbFactures + ' facture(s) | ' + rows.length + ' lignes | ' + analyseRows.length + ' références uniques');
  console.log('📁 ' + outFile);
}

main().catch(function(e) {
  console.error('\n❌ ERREUR FATALE :', e.message);
  process.exit(1);
});
