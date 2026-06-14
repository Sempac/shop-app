/**
 * gmail-send.js — Envoi d'email via Gmail API (OAuth2)
 * Partagé par server.js et rapport-auto.js
 */
const path = require('path');
const GMAIL_TOKEN_FILE = path.join(__dirname, 'gmail_tokens.json');

function _oauth2() {
  const { google } = require('googleapis');
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
}

async function gmailSendMail({ to, subject, html, attachments }) {
  const fs = require('fs');
  const { google } = require('googleapis');

  if (!fs.existsSync(GMAIL_TOKEN_FILE))
    throw new Error('Gmail non autorisé. Visitez /api/gmail/auth-send');

  const tokens = JSON.parse(fs.readFileSync(GMAIL_TOKEN_FILE, 'utf8'));
  const oauth2 = _oauth2();
  oauth2.setCredentials(tokens);
  oauth2.on('tokens', t => {
    Object.assign(tokens, t);
    fs.writeFileSync(GMAIL_TOKEN_FILE, JSON.stringify(tokens));
  });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  const boundary = 'boundary_' + Date.now();
  const toList   = Array.isArray(to) ? to.join(', ') : to;
  let raw = [
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    `From: "The SMARTPHONE" <${process.env.EMAIL_USER}>`,
    `To: ${toList}`,
    `Subject: ${subject}`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html
  ].join('\r\n');

  if (attachments && attachments.length) {
    for (const att of attachments) {
      const content = att.content
        ? att.content.toString('base64')
        : Buffer.from(att.path ? require('fs').readFileSync(att.path) : '').toString('base64');
      raw += `\r\n--${boundary}\r\n` +
             `Content-Type: ${att.contentType || 'application/octet-stream'}\r\n` +
             `Content-Transfer-Encoding: base64\r\n` +
             `Content-Disposition: attachment; filename="${att.filename}"\r\n\r\n${content}`;
    }
  }
  raw += `\r\n--${boundary}--`;

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: Buffer.from(raw).toString('base64url') }
  });
}

module.exports = { gmailSendMail };
