/**
 * wa-client.js — WhatsApp sender via whatsapp-web.js
 * Démarre avec le serveur, session persistée dans .wwebjs_auth/
 */

/* Force Chrome path avant tout chargement puppeteer */
if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
  process.env.PUPPETEER_EXECUTABLE_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs   = require('fs');
const { execSync } = require('child_process');

let client  = null;
let _qrData = null;
let _ready  = false;
let _status = 'disconnected'; /* disconnected | qr | connecting | ready */

function cleanChromeLocks() {
  /* Tuer les processus Chrome orphelins qui utilisent notre session WA */
  try {
    execSync('wmic process where "name=\'chrome.exe\' and commandline like \'%wwebjs_auth%\'" delete',
      { stdio: 'ignore', timeout: 5000 });
  } catch(e) {} /* Pas de processus = normal */

  /* Supprimer les fichiers verrou résiduels */
  const sessionDir = path.join(__dirname, '.wwebjs_auth', 'session');
  ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'].forEach(f => {
    try { fs.unlinkSync(path.join(sessionDir, f)); } catch(e) {}
  });
}

function initWhatsApp() {
  cleanChromeLocks();
  /* Petite pause pour laisser le temps au Chrome tué de libérer ses ressources */
  setTimeout(_doInit, 2000);
}

function _doInit() {
  try {
    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking'
        ]
      }
    });

    client.on('qr', (qr) => {
      _qrData  = qr;
      _ready   = false;
      _status  = 'qr';
      console.log('[WhatsApp] QR code prêt — ouvrez /whatsapp-setup.html pour scanner');
    });

    client.on('loading_screen', (pct) => {
      _status = 'connecting';
      console.log('[WhatsApp] Chargement', pct + '%');
    });

    client.on('authenticated', () => {
      _status = 'connecting';
      console.log('[WhatsApp] Authentifié');
    });

    client.on('ready', () => {
      _ready  = true;
      _qrData = null;
      _status = 'ready';
      console.log('[WhatsApp] ✅ Connecté et prêt');
    });

    client.on('disconnected', (reason) => {
      _ready  = false;
      _status = 'disconnected';
      console.log('[WhatsApp] Déconnecté :', reason);
      /* Tentative de reconnexion après 10s */
      setTimeout(() => initWhatsApp(), 10000);
    });

    client.on('auth_failure', (msg) => {
      _ready  = false;
      _status = 'disconnected';
      console.error('[WhatsApp] Échec auth :', msg);
    });

    /* Catch async rejections from initialize() (e.g. Chrome not found) */
    client.initialize().catch(e => {
      _ready  = false;
      _status = 'disconnected';
      console.error('[WhatsApp] Erreur initialize :', e.message);
    });
    console.log('[WhatsApp] Initialisation en cours...');

  } catch(e) {
    console.error('[WhatsApp] Erreur init :', e.message);
  }
}

/* ── Envoyer rapport (texte + PDF en pièce jointe) ── */
async function sendReport(to, text, pdfPath) {
  if (!_ready) throw new Error('WhatsApp non connecté (statut : ' + _status + ')');

  const chatId = to.includes('@') ? to : to.replace(/\D/g, '') + '@c.us';

  /* Texte */
  await client.sendMessage(chatId, text);

  /* PDF si fourni */
  if (pdfPath && fs.existsSync(pdfPath)) {
    const media = MessageMedia.fromFilePath(pdfPath);
    await client.sendMessage(chatId, media, {
      caption: '📊 Rapport Comptable — The SMARTPHONE'
    });
  }
}

/* ── Getters pour les routes API ── */
function getQR()     { return _qrData; }
function getStatus() { return _status; }
function isReady()   { return _ready;  }

function getClient() { return client; }
module.exports = { initWhatsApp, sendReport, getQR, getStatus, isReady, getClient };
