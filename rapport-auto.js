/**
 * rapport-auto.js — Envoi automatique du rapport comptable
 * Email + WhatsApp chaque soir
 */

module.exports = function initRapportAuto(pool) {

  /* ── Planifier l'envoi à 20h00 chaque soir ── */
  function scheduleDaily() {
    function msUntil20h00() {
      const now  = new Date();
      const next = new Date();
      next.setHours(20, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next - now;
    }
    setTimeout(async function tick() {
      const date = new Date().toISOString().split('T')[0];
      const jour = new Date().getDay(); /* 0=dimanche */
      if (jour !== 0) {
        try {
          await envoyerRapport(pool, date);
          console.log('[Rapport Auto] Envoyé pour', date);
        } catch(e) {
          console.error('[Rapport Auto] Erreur:', e.message);
        }
      } else {
        console.log('[Rapport Auto] Dimanche — pas d\'envoi');
      }
      /* Replanifier pour le lendemain */
      setTimeout(tick, msUntil20h00());
    }, msUntil20h00());

    const h = Math.round(msUntil20h00() / 3600000 * 10) / 10;
    console.log('[Rapport Auto] Prochain envoi dans', h, 'h');
  }

  scheduleDaily();

  return envoyerRapport;
};

/* ── Fonction principale ── */
async function envoyerRapport(pool, date) {
  const PDFDocument = require('pdfkit');
  const fs          = require('fs');
  const path        = require('path');

  /* ── Données ── */
  const ventes = await pool.query(`
    SELECT STRING_AGG(DISTINCT COALESCE(p.name,'Produit supprimé'), ', ') AS nom,
      1 AS qty, o.total - COALESCE(o.amount_credit,0) AS total_ligne,
      COALESCE(o.amount_credit,0) AS amount_credit, o.payment_method
    FROM orders o JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id
    WHERE DATE(o.created_at)=$1 AND (o.status IS NULL OR o.status!='cancelled') AND o.payment_method!='credit'
    GROUP BY o.id ORDER BY o.id DESC`, [date]);

  const reps = await pool.query(`
    SELECT TRIM(COALESCE(brand,'')||' '||COALESCE(model,'')||' '||COALESCE(device_type,'')) AS nom,
      1 AS qty, COALESCE(final_price,estimated_price,0)-COALESCE(amount_credit,0) AS total_ligne,
      COALESCE(amount_credit,0) AS amount_credit, payment_method
    FROM repairs WHERE DATE(COALESCE(delivered_at,created_at))=$1 AND status IN ('TERMINE','LIVRE') ORDER BY id DESC`, [date]);

  const totV = await pool.query(`
    SELECT COALESCE(SUM(total-COALESCE(amount_credit,0)),0) AS total_ventes,
      COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cb,0) WHEN payment_method='card' THEN total ELSE 0 END),0) AS total_cb,
      COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 OR COALESCE(amount_cash,0)>0 THEN COALESCE(amount_cash,0) WHEN payment_method='cash' THEN total ELSE 0 END),0) AS total_esp
    FROM orders WHERE DATE(created_at)=$1 AND (status IS NULL OR status!='cancelled') AND payment_method!='credit'`, [date]);

  const totR = await pool.query(`
    SELECT COALESCE(SUM(COALESCE(final_price,estimated_price,0)-COALESCE(amount_credit,0)),0) AS total_reps,
      COALESCE(SUM(CASE WHEN COALESCE(amount_cb,0)>0 THEN amount_cb WHEN payment_method='card' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_cb,
      COALESCE(SUM(CASE WHEN COALESCE(amount_cash,0)>0 THEN amount_cash WHEN payment_method='cash' THEN COALESCE(final_price,estimated_price,0) ELSE 0 END),0) AS total_esp
    FROM repairs WHERE DATE(COALESCE(delivered_at,created_at))=$1 AND status IN ('TERMINE','LIVRE')`, [date]);

  const totDep = await pool.query(`SELECT COALESCE(SUM(amount),0) AS total_depenses FROM expenses WHERE DATE(date)=$1`, [date]);

  const t = {
    total_ventes: parseFloat(totV.rows[0].total_ventes),
    total_reps:   parseFloat(totR.rows[0].total_reps),
    total_cb:     parseFloat(totV.rows[0].total_cb) + parseFloat(totR.rows[0].total_cb),
    total_esp:    parseFloat(totV.rows[0].total_esp) + parseFloat(totR.rows[0].total_esp),
    total_dep:    parseFloat(totDep.rows[0].total_depenses)
  };
  const totalCA   = t.total_ventes + t.total_reps;
  const netCaisse = totalCA - t.total_dep;
  const fmt = n => Number(n||0).toFixed(2) + ' EUR';

  /* ── Génération PDF ── */
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR',
    {weekday:'long', year:'numeric', month:'long', day:'numeric'});
  const dateStr  = date.replace(/-/g,'');
  const filename = `Rapport Comptable - The SMARTPHONE - ${dateStr}.pdf`;

  const fallbackDir = path.join(__dirname, 'rapports');
  fs.mkdirSync(fallbackDir, {recursive:true});
  const saveDir  = process.env.RAPPORT_DIR || fallbackDir;
  let   finalPath = path.join(saveDir, filename);

  const doc    = new PDFDocument({margin:40, size:'A4', info:{
    Title:   `Rapport Comptable - The SMARTPHONE - ${dateStr}`,
    Author:  'The SMARTPHONE',
    Subject: `Rapport du ${dateLabel}`
  }});
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const pdfDone = new Promise((resolve, reject) => {
    doc.on('end', resolve); doc.on('error', reject);
  });

  /* En-tête */
  doc.font('Helvetica-Bold').fontSize(14).text('The SMARTPHONE', 40, 40);
  doc.font('Helvetica').fontSize(9).fillColor('#444')
     .text("1 Avenue d'Italie, 75013 Paris", 40, 57)
     .text('01 47 07 18 66  |  smartphonesatelier4@gmail.com  |  www.thesmartphone.pro', 40, 68);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
     .text('Rapport Comptable', 0, 40, {align:'right'})
     .font('Helvetica').fontSize(10)
     .text(date.split('-').reverse().join('/'), 0, 57, {align:'right'})
     .text(dateLabel, 0, 69, {align:'right'});
  doc.moveTo(40,85).lineTo(555,85).lineWidth(1.5).stroke('#000');

  const colX = [40, 220, 370, 430, 480];
  const colW = [180, 150,  60,  50,  75];
  let y = 95;

  doc.rect(40,y,515,16).fill('#1e293b');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('white');
  ['Nom','Fournisseur','Qte','Type','CA'].forEach((h,i) => {
    doc.text(h, colX[i], y+4, {width:colW[i], align: i>=2?'right':'left'});
  });
  y += 16;
  doc.fillColor('#000').font('Helvetica').fontSize(8);

  const allRows = [
    ...ventes.rows.map(l => ({nom:l.nom, four:'—', qty:l.qty, type:'Vente',       ca:l.total_ligne})),
    ...reps.rows  .map(l => ({nom:l.nom||'Reparation', four:'—', qty:l.qty, type:'Reparation', ca:l.total_ligne}))
  ];

  if (!allRows.length) {
    doc.fillColor('#888').text('Aucune operation ce jour', 40, y+4, {width:515, align:'center'});
    y += 16;
  } else {
    allRows.forEach((row, idx) => {
      const bg = idx%2===0 ? '#f8fafc' : '#ffffff';
      doc.rect(40,y,515,14).fill(bg);
      doc.fillColor('#000')
         .text(row.nom,           colX[0], y+3, {width:colW[0]-4, align:'left'})
         .text(row.four,          colX[1], y+3, {width:colW[1]-4, align:'left'})
         .text(String(row.qty),   colX[2], y+3, {width:colW[2],   align:'right'})
         .text(row.type,          colX[3], y+3, {width:colW[3],   align:'right'})
         .text(fmt(row.ca),       colX[4], y+3, {width:colW[4],   align:'right'});
      y += 14;
    });
  }

  doc.moveTo(40,y).lineTo(555,y).lineWidth(0.5).stroke('#888'); y += 4;
  [
    ['Total Ventes',      t.total_ventes, false],
    ['Total Reparations', t.total_reps,   false],
    ['Total CA',          totalCA,         true]
  ].forEach(([lbl,val,bold]) => {
    if (bold) { doc.rect(40,y,515,16).fill('#f0f0f0'); doc.moveTo(40,y).lineTo(555,y).lineWidth(1).stroke('#000'); }
    doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(bold?10:8).fillColor('#000')
       .text(lbl, 40, y+3, {width:420, align:'left'})
       .text(fmt(val), colX[4], y+3, {width:colW[4], align:'right'});
    y += bold ? 16 : 14;
  });

  y += 8;
  doc.moveTo(40,y).lineTo(555,y).lineWidth(1).stroke('#000'); y += 6;
  doc.font('Helvetica-Bold').fontSize(9).text('Recapitulatif paiements', 40, y); y += 14;
  [
    ['CB',             fmt(t.total_cb)],
    ['Especes (ES)',   fmt(t.total_esp)],
    ['Depenses (DP)',  t.total_dep > 0 ? '- ' + fmt(t.total_dep) : fmt(t.total_dep)],
  ].forEach(([lbl,val]) => {
    doc.font('Helvetica').fontSize(9).fillColor('#000')
       .text(lbl, 40, y, {width:420}).text(val, colX[4], y, {width:colW[4], align:'right'});
    y += 14;
  });
  doc.moveTo(40,y).lineTo(555,y).lineWidth(1).stroke('#000'); y += 4;
  doc.rect(40,y,515,18).fill('#1e293b');
  doc.font('Helvetica-Bold').fontSize(11).fillColor('white')
     .text('Net Caisse', 42, y+3, {width:420})
     .text(fmt(netCaisse), colX[4], y+3, {width:colW[4], align:'right'});
  y += 18;

  y += 14;
  doc.font('Helvetica').fontSize(8).fillColor('#aaa')
     .text('Genere le ' + new Date().toLocaleString('fr-FR'), 40, y, {align:'right'});

  doc.end();
  await pdfDone;
  const pdfBuffer = Buffer.concat(chunks);

  /* Sauvegarde */
  try {
    fs.mkdirSync(saveDir, {recursive:true});
    fs.writeFileSync(finalPath, pdfBuffer);
  } catch(_) {
    finalPath = path.join(fallbackDir, filename);
    fs.writeFileSync(finalPath, pdfBuffer);
  }

  /* ── Envoi Email (Gmail API OAuth2) ── */
  let emailSent = false, emailError = null;
  try {
    const { gmailSendMail } = require('./gmail-send');
    await gmailSendMail({
      to:      process.env.EMAIL_TO || 'ittech75013@gmail.com',
      subject: `Rapport Comptable - The SMARTPHONE - ${date}`,
      html:    `<p>Bonjour,</p><p>Veuillez trouver en pièce jointe le rapport comptable du ${dateLabel}.</p><p>The SMARTPHONE<br>1 Avenue d'Italie, 75013 Paris</p>`,
      attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }]
    });
    emailSent = true;
  } catch(emailErr) { emailError = emailErr.message; }

  /* ── Envoi WhatsApp ── */
  let waSent = false, waError = null;
  try {
    const waTo = process.env.WA_TO;
    if (waTo && require('./wa-client').isReady()) {
      const nbVentes = ventes.rows.length;
      const nbReps   = reps.rows.length;
      const texte =
        `📊 *Rapport Comptable — ${date.split('-').reverse().join('/')}*\n` +
        `\n` +
        `🛒 Ventes : *${nbVentes}* opération(s)\n` +
        `🔧 Réparations : *${nbReps}* livrée(s)\n` +
        `\n` +
        `💳 CB : *${fmt(t.total_cb)}*\n` +
        `💵 Espèces : *${fmt(t.total_esp)}*\n` +
        (t.total_dep > 0 ? `💸 Dépenses : *- ${fmt(t.total_dep)}*\n` : '') +
        `\n` +
        `🏦 *Net Caisse : ${fmt(netCaisse)}*\n` +
        `\n_The SMARTPHONE — 1 Av. d'Italie, Paris 13e_`;

      await require('./wa-client').sendReport(waTo, texte, finalPath);
      waSent = true;
    } else if (!waTo) {
      waError = 'WA_TO non configuré';
    } else {
      waError = 'WhatsApp non connecté';
    }
  } catch(waErr) { waError = waErr.message; }

  return {
    success: true,
    date,
    saved:      finalPath,
    emailSent,  emailError,
    waSent,     waError
  };
}
