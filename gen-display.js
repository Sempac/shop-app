// Génère print-display.html — 2×A5 sur 1 A4
const QRCode = require('qrcode');
const fs     = require('fs');
const path   = require('path');

const QR_URL  = 'https://desktop-dpd7qn6.taild4a8c6.ts.net/printshop.html?client=1';
const WIFI_SSID = 'TheSmartphone_Invite';   // ← à mettre à jour après config Freebox
const WIFI_PASS = '________';              // ← à mettre à jour après config Freebox

QRCode.toDataURL(QR_URL, {
  errorCorrectionLevel: 'H',
  margin: 1,
  width: 400,
  color: { dark: '#1e3a8a', light: '#ffffff' }
}, (err, qrDataUrl) => {
  if (err) { console.error(err); process.exit(1); }

  const panel = `
  <div class="panel">

    <!-- Côté gauche : QR code -->
    <div class="qr-side">
      <div class="store-name">THE<br><span>SMARTPHONE</span></div>
      <img src="${qrDataUrl}" alt="QR Code" width="150" height="150">
      <div class="scan-label">📲 Scannez-moi !</div>
      <div class="scan-sub">Gratuit · Sans inscription</div>
    </div>

    <!-- Côté droit : infos -->
    <div class="info-side">

      <div class="section-title">🖨️ Service d'impression</div>

      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-txt">Scannez le QR code avec votre téléphone</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-txt">Envoyez votre fichier via <b>WhatsApp</b>, <b>Email</b> ou en le <b>glissant</b> depuis votre téléphone</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-txt">Votre impression est prête en quelques minutes !</div>
        </div>
      </div>

      <div class="formats">
        📎 PDF · Word · Excel · PowerPoint · Photos (JPG, PNG)
      </div>

      <div class="prices">
        <div class="price-row">
          <span class="price-label">🖨️ Impression N&B</span>
          <span class="price-val">0,30 €</span>
        </div>
        <div class="price-row">
          <span class="price-label">🌈 Impression couleur</span>
          <span class="price-val">0,80 €</span>
        </div>
        <div class="price-row">
          <span class="price-label">📠 Scan</span>
          <span class="price-val">1,00 €</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="contacts">
        <div class="contact-row">📞 <strong>01 47 07 18 66</strong> &nbsp;·&nbsp; 📱 <strong>06 86 84 82 79</strong></div>
        <div class="contact-row">✉️ smartphonesatelier4@gmail.com</div>
        <div class="contact-row">🌐 www.thesmartphone.pro</div>
      </div>


    </div>
  </div>`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>The SMARTPHONE — Affiche impression</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 210mm;
    height: 297mm;
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #fff;
  }

  /* ── Panneau A5 (148.5mm × 210mm) ────────────────────────── */
  .panel {
    width: 210mm;
    height: 148.5mm;
    display: flex;
    border-bottom: 1.5px dashed #b0b8d0;
    overflow: hidden;
  }
  .panel:last-child { border-bottom: none; }

  /* ── Côté gauche bleu ────────────────────────────────────── */
  .qr-side {
    width: 72mm;
    background: linear-gradient(160deg, #1e3a8a 0%, #1e40af 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4mm;
    padding: 6mm;
    flex-shrink: 0;
  }
  .store-name {
    color: #fff;
    font-size: 11pt;
    font-weight: 900;
    text-align: center;
    letter-spacing: 1px;
    line-height: 1.1;
    text-transform: uppercase;
  }
  .store-name span {
    font-size: 18pt;
    font-weight: 900;
    letter-spacing: -0.5px;
  }
  .qr-side img {
    border-radius: 10px;
    border: 3px solid rgba(255,255,255,0.9);
    background: white;
    padding: 3px;
  }
  .scan-label {
    color: #fff;
    font-size: 13pt;
    font-weight: 700;
    text-align: center;
  }
  .scan-sub {
    color: rgba(255,255,255,0.75);
    font-size: 8pt;
    text-align: center;
  }

  /* ── Côté droit infos ────────────────────────────────────── */
  .info-side {
    flex: 1;
    padding: 7mm 8mm 6mm 8mm;
    display: flex;
    flex-direction: column;
    gap: 3mm;
  }
  .section-title {
    font-size: 15pt;
    font-weight: 800;
    color: #1e3a8a;
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 2mm;
    margin-bottom: 1mm;
  }

  /* Étapes */
  .steps { display: flex; flex-direction: column; gap: 2.5mm; }
  .step { display: flex; align-items: flex-start; gap: 3mm; }
  .step-num {
    background: #1e40af;
    color: #fff;
    font-size: 9pt;
    font-weight: 700;
    width: 5.5mm;
    height: 5.5mm;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 0.5mm;
  }
  .step-txt { font-size: 9.5pt; color: #1e293b; line-height: 1.35; }

  /* Formats */
  .formats {
    font-size: 8pt;
    color: #475569;
    background: #f1f5f9;
    border-radius: 5px;
    padding: 2mm 3mm;
  }

  /* Tarifs */
  .prices {
    display: flex;
    flex-direction: column;
    gap: 1mm;
    background: #fefce8;
    border: 1.5px solid #fde047;
    border-radius: 6px;
    padding: 2mm 3mm;
  }
  .price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 9pt;
  }
  .price-label { color: #374151; }
  .price-val {
    font-weight: 800;
    color: #92400e;
    background: #fef3c7;
    padding: 0.5mm 2mm;
    border-radius: 4px;
    font-size: 9.5pt;
  }

  /* Séparateur */
  .divider { border-top: 1px solid #e2e8f0; }

  /* Contacts */
  .contacts { display: flex; flex-direction: column; gap: 1.5mm; }
  .contact-row { font-size: 9pt; color: #1e293b; }

</style>
</head>
<body>
  ${panel}
  ${panel}
</body>
</html>`;

  const out = path.join(__dirname, 'print-display.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log('Créé :', out);
});
