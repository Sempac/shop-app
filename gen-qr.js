const QRCode = require('qrcode');
const fs = require('fs');
const url = 'https://desktop-dpd7qn6.taild4a8c6.ts.net/printshop.html?client=1';
QRCode.toDataURL(url, {errorCorrectionLevel:'H', width:400, margin:2}, (err, data) => {
  if (err) { console.error(err); process.exit(1); }
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="background:#fff;text-align:center;padding:30px;font-family:Arial">
<p style="font-size:16px;color:#1e3a8a;font-weight:bold;margin-bottom:16px">
  Scannez avec votre telephone
</p>
<img src="${data}" width="320" height="320" style="border:3px solid #1e3a8a;border-radius:12px;padding:8px">
<p style="font-size:11px;color:#888;margin-top:16px;word-break:break-all;max-width:360px;margin-left:auto;margin-right:auto">
  ${url}
</p>
</body></html>`;
  fs.writeFileSync('qr-test.html', html, 'utf8');
  console.log('OK');
});
