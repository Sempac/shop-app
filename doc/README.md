# The SMARTPHONE — Shop App : Documentation Technique

> Version 1.0 — Juin 2026  
> Application de gestion interne pour la boutique The SMARTPHONE, 1 Avenue d'Italie, 75013 Paris

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture](#2-architecture)
3. [Technologies](#3-technologies)
4. [Modules & Pages](#4-modules--pages)
5. [API Backend — Endpoints principaux](#5-api-backend--endpoints-principaux)
6. [Base de données](#6-base-de-données)
7. [Gmail OAuth2](#7-gmail-oauth2)
8. [WhatsApp](#8-whatsapp)
9. [Rapport automatique (20h)](#9-rapport-automatique-20h)
10. [Déploiement](#10-déploiement)
11. [Configuration (.env)](#11-configuration-env)
12. [Accès & Réseau](#12-accès--réseau)
13. [Maintenance & Nettoyage](#13-maintenance--nettoyage)

---

## 1. Vue d'ensemble

**Shop App** est une application web interne de gestion de boutique téléphonie / réparation.  
Elle couvre : ventes, réparations, stock, catalogue, devis, commandes, comptabilité, impression, communication automatisée.

| Attribut | Valeur |
|---|---|
| URL interne (VPN) | http://100.126.44.43:3000 |
| Domaine public | www.thesmartphone.pro *(DNS à configurer)* |
| Serveur | PC du magasin (Windows 10), VPN Tailscale |
| Base de données | PostgreSQL 16 — base `shop_db` |
| Démarrage serveur | Tâche planifiée `RestartShop` → `restart.bat` |

---

## 2. Architecture

```
C:\apps\shop-app\          ← Production (serveur magasin)
C:\Dev\shop-app\           ← Développement (PC kader-dev)

GitHub (remote)            ← Dépôt intermédiaire
  git push origin master   → déploiement via git pull sur prod
```

### Flux de déploiement

```
[Dev] Edit code
  └─ git add / commit
  └─ git push origin master
  └─ ssh prod "cd /apps/shop-app && git pull"
  └─ schtasks /Run /TN RestartShop   (si besoin)
```

### Démarrage automatique du serveur

`C:\apps\shop-app\restart.bat` :
```bat
@echo off
taskkill /F /IM node.exe 2>NUL
taskkill /F /IM chrome.exe 2>NUL
cd /d C:\apps\shop-app
node server.js > C:\apps\shop-app\server.log 2>&1
```
Lancé par la tâche planifiée Windows `RestartShop` au démarrage et manuellement via :
```powershell
schtasks /Run /TN RestartShop
```

---

## 3. Technologies

| Couche | Techno | Version |
|---|---|---|
| Backend | Node.js + Express 5 | express ^5.2 |
| BDD | PostgreSQL | pg ^8.20 |
| WhatsApp | whatsapp-web.js | ^1.34.7 |
| PDF | pdfkit | ^0.18 |
| Email | Gmail API (OAuth2) | googleapis ^171 |
| Import email | imapflow | ^1.3.5 |
| Upload fichiers | multer | ^2.1 |
| QR Code | qrcode | ^1.5.4 |
| Excel | xlsx | ^0.18.5 |
| Sécurité | helmet | ^8.1 |
| CORS | cors | ^2.8.6 |
| Variables env | dotenvx | (intercept dotenv) |
| IA (Claude) | @anthropic-ai/sdk | ^0.97 |
| Frontend | HTML/CSS/JS vanilla | — |

---

## 4. Modules & Pages

### Pages HTML (frontend)

| Fichier | Module | Description |
|---|---|---|
| `index.html` | Accueil | Dashboard général, accès rapide aux modules |
| `sales.html` | Ventes | Caisse, facturation, encaissement CB/espèces/crédit |
| `repairs.html` | Réparations | Fiches réparation, suivi, livraison |
| `stock.html` | Stock | Gestion inventaire produits |
| `catalogue.html` | Catalogue vitrine | Catalogue public avec photos, prix, disponibilité |
| `catalogue-admin.html` | Admin catalogue | Gestion des fiches produit du catalogue |
| `commandes.html` | Commandes fournisseurs | Suivi des commandes et livraisons |
| `lots.html` | Lots | Achat/gestion de lots de produits |
| `devis.html` | Devis | Génération et impression de devis |
| `expenses.html` | Dépenses | Saisie et suivi des dépenses journalières |
| `credits.html` | Crédits clients | Gestion des avoirs et crédits |
| `returns.html` | Retours | Gestion des retours produits |
| `contacts.html` | Contacts | Répertoire clients/fournisseurs |
| `history.html` | Historique | Historique des opérations |
| `analytics.html` | Statistiques | Tableaux de bord, CA, tendances |
| `users.html` | Utilisateurs | Gestion des comptes vendeurs |
| `users-admin.html` | Admin users | Administration avancée des utilisateurs |
| `rapport-comptable.html` | Rapport manuel | Génération manuelle du rapport comptable |
| `dailyreport.html` | Rapport journalier | Interface rapport journalier |
| `fiche-impression-client.html` | Impression client | Fiche à imprimer pour le client |
| `printshop.html` | Service impression | Interface impression vitrine (QR code) |
| `print-display.html` | Affiche impression | Panneau A4/2×A5 service d'impression |
| `qr-vitrine.html` | QR vitrine | Page QR code pour la vitrine du magasin |
| `whatsapp-setup.html` | Setup WhatsApp | Scan QR code pour connexion WhatsApp Web |
| `login.html` | Authentification | Page de connexion |

### Scripts backend clés

| Fichier | Rôle |
|---|---|
| `server.js` | Serveur Express principal — toutes les routes API |
| `rapport-auto.js` | Envoi automatique du rapport comptable à 20h (lun–sam) |
| `gmail-send.js` | Module partagé d'envoi email via Gmail API OAuth2 |
| `wa-client.js` | Client WhatsApp Web (whatsapp-web.js + puppeteer) |
| `auth.js` | Authentification utilisateurs |
| `watchdog.js` | Surveillance et redémarrage automatique |
| `theme.js` | Thème clair/sombre |
| `sort-table.js` | Tri des tableaux HTML |
| `tooltips.js` | Infobulles UI |
| `contact-buttons.js` | Boutons de contact rapide |
| `gen-display.js` | Génère print-display.html (affiche A4 impression) |
| `gen-qr.js` | Génère les QR codes |
| `gmail-historique.js` | Import historique factures Gmail |
| `sync-comptabilite.js` | Synchronisation données comptabilité |

---

## 5. API Backend — Endpoints principaux

### Ventes
```
GET    /api/products              Liste des produits
POST   /api/orders                Créer une vente
GET    /api/orders                Historique des ventes
GET    /api/orders/:id/facture    Générer facture PDF
DELETE /api/orders/:id            Annuler une vente
```

### Réparations
```
GET    /api/repairs               Liste des réparations
POST   /api/repairs               Créer une réparation
PATCH  /api/repairs/:id           Mettre à jour le statut
GET    /api/repairs/:id/ticket    Générer ticket PDF
```

### Stock / Catalogue
```
GET    /api/products              Produits en stock
POST   /api/products              Ajouter un produit
PATCH  /api/products/:id          Modifier un produit
POST   /api/products/:id/photo    Upload photo produit
GET    /api/catalogue             Catalogue public
```

### Rapport comptable
```
POST   /api/rapport-comptable/generer   Générer + envoyer le rapport
GET    /api/rapport-comptable/pdf/:date Télécharger le PDF du rapport
```

### Gmail OAuth2
```
GET    /api/gmail/auth            URL d'autorisation (scope: readonly)
GET    /api/gmail/auth-send       URL d'autorisation (scope: send + readonly)
GET    /api/gmail/callback        Callback OAuth2 — enregistre les tokens
GET    /api/gmail/factures        Import factures depuis Gmail
```

### WhatsApp
```
GET    /api/whatsapp/status       État de la connexion WhatsApp
GET    /api/whatsapp/qr           QR code de connexion
DELETE /api/whatsapp/messages/mine  Supprimer mes messages dans un groupe
```

### Divers
```
GET    /api/expenses              Dépenses
POST   /api/expenses              Ajouter une dépense
GET    /api/analytics             Statistiques CA
GET    /api/users                 Utilisateurs
POST   /api/auth/login            Connexion
POST   /api/print/upload          Upload fichier à imprimer
```

---

## 6. Base de données

### Connexion
- **Host** : localhost (sur le PC magasin)
- **Base** : `shop_db`
- **User** : `postgres`
- **Mot de passe** : dans `.env` → `DB_PASSWORD`
- **Port** : 5432

### Tables principales

| Table | Description |
|---|---|
| `products` | Produits en stock (téléphones, accessoires) |
| `orders` | Commandes/ventes |
| `order_items` | Lignes de commande |
| `repairs` | Fiches de réparation |
| `expenses` | Dépenses journalières |
| `credits` | Avoirs clients |
| `contacts` | Clients et fournisseurs |
| `suppliers` | Fournisseurs |
| `lots` | Lots de produits achetés |
| `categories` | Catégories de produits |
| `users` | Utilisateurs de l'application |
| `catalogue_items` | Catalogue public vitrine |
| `commandes` | Commandes fournisseurs |
| `repair_parts` | Pièces utilisées en réparation |
| `todos` | Tâches internes |

### Migrations (dossier `migrations/`)
Les scripts SQL d'évolution du schéma sont historisés dans `migrations/`.  
Ils ont tous été exécutés en production. Ne jamais les relancer sans vérification.

---

## 7. Gmail OAuth2

### Principe
L'application utilise **Gmail API** (pas SMTP) pour envoyer les emails.  
Cela évite les blocages Google sur les mots de passe d'application.

### Fichiers
- `gmail_tokens.json` — Tokens OAuth2 (access_token + refresh_token). **Ne pas versionner.**
- `gmail-send.js` — Module partagé : lit les tokens, construit le MIME, envoie via `gmail.users.messages.send`
- `client_secret_*.json` — Credentials OAuth2 (Client ID + Secret). **Ne pas versionner.**

### Scopes autorisés
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
```

### Flux d'autorisation
1. Aller sur `/api/gmail/auth-send` → copier l'URL
2. Coller l'URL dans un navigateur connecté au compte Google `smartphonesatelier4@gmail.com`
3. Autoriser → redirection vers `/api/gmail/callback`
4. Les tokens sont sauvegardés dans `gmail_tokens.json`

### Renouvellement automatique
Le refresh_token est permanent. L'access_token expire toutes les heures et est renouvelé automatiquement par `gmail-send.js`.

### Utilisation
```javascript
const { gmailSendMail } = require('./gmail-send');
await gmailSendMail({
  to: 'destinataire@example.com',
  subject: 'Objet',
  html: '<p>Corps HTML</p>',
  attachments: [{ filename: 'doc.pdf', content: pdfBuffer, contentType: 'application/pdf' }]
});
```

---

## 8. WhatsApp

### Principe
Connexion via **whatsapp-web.js** v1.34.7 + Puppeteer/Chrome.  
Le PC du magasin maintient une session WhatsApp Web permanente.

### Fichiers
- `wa-client.js` — Gestion du client WhatsApp (connexion, QR, envoi, reconnexion)
- `.wwebjs_auth/` — Session WhatsApp (ne pas supprimer)
- `.wwebjs_cache/` — Cache navigateur (peut être supprimé si problème)

### Configuration .env
```
WA_TO=33XXXXXXXXX@c.us        # Numéro/groupe destinataire du rapport
```

### Connexion initiale
1. Aller sur `/whatsapp-setup.html`
2. Scanner le QR code avec le téléphone du magasin
3. La session est sauvegardée dans `.wwebjs_auth/`

### Fonctions principales (wa-client.js)
```javascript
isReady()               // true si WhatsApp est connecté
sendReport(to, text, pdfPath)  // Envoie texte + PDF au groupe
```

### Problèmes connus
- **Chrome orphelin** : Si le serveur est tué sans arrêt propre, des processus Chrome restent en mémoire.  
  `restart.bat` fait `taskkill /F /IM chrome.exe` avant de relancer.
- **Session déconnectée** : Rescanner le QR sur `/whatsapp-setup.html`
- **Suppression de messages** : La méthode `message.delete(true)` peut silencieusement ne supprimer que pour soi.  
  La suppression pour tous nécessite `Cmd.sendRevokeMsgs()` via `pupPage.evaluate()`.

---

## 9. Rapport automatique (20h)

### Fonctionnement
Chaque soir du **lundi au samedi à 20h00**, le rapport comptable est :
1. Généré en PDF (pdfkit)
2. Sauvegardé dans `rapports/`
3. Envoyé par **email** (Gmail API) à `ittech75013@gmail.com`
4. Envoyé sur **WhatsApp** (groupe planning ITtech)

### Contenu du rapport
- Liste des ventes du jour
- Liste des réparations livrées
- Total CA (ventes + réparations)
- Répartition CB / Espèces
- Dépenses du jour
- **Net Caisse** = CA total − dépenses

### Fichier
`rapport-auto.js` — initialisation dans `server.js` :
```javascript
const initRapportAuto = require('./rapport-auto');
initRapportAuto(pool);
```

### Exclusion dimanche
```javascript
const jour = new Date().getDay(); // 0 = dimanche
if (jour !== 0) { await envoyerRapport(...); }
```

### En-tête PDF
```
The SMARTPHONE
1 Avenue d'Italie, 75013 Paris
01 47 07 18 66 | smartphonesatelier4@gmail.com | www.thesmartphone.pro
```

### Déclenchement manuel
```
POST /api/rapport-comptable/generer  { "date": "2026-06-15" }
```
Ou via l'interface : `rapport-comptable.html`

---

## 10. Déploiement

### Prérequis
- Node.js installé sur le PC magasin
- PostgreSQL en service
- `.env` configuré (voir section 11)
- Tâche planifiée `RestartShop` créée

### Créer la tâche planifiée (une seule fois)
```powershell
schtasks /Create /TN "RestartShop" /TR "C:\apps\shop-app\restart.bat" /SC ONSTART /RU SYSTEM
```

### Déployer une mise à jour
```powershell
# Sur le PC de dev :
git add -A
git commit -m "description"
git push origin master

# Sur le serveur (via SSH ou sur place) :
cd C:\apps\shop-app
git pull
schtasks /Run /TN RestartShop
```

### Connexion SSH
```
Alias : prod
IP    : 100.126.44.43 (Tailscale VPN)
User  : pc
```

### Logs serveur
```
C:\apps\shop-app\server.log     ← stdout + stderr du serveur
```
Consulter en direct :
```powershell
ssh prod "powershell -Command \"Get-Content C:\apps\shop-app\server.log -Tail 50\""
```

---

## 11. Configuration (.env)

Fichier `.env` à la racine du projet (non versionné) :

```env
# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=shop_db
DB_USER=postgres
DB_PASSWORD=Sempac

# Gmail OAuth2
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REDIRECT_URI=http://100.126.44.43:3000/api/gmail/callback

# Destinataires
EMAIL_TO=ittech75013@gmail.com
WA_TO=33XXXXXXXXX@c.us         # ou ID groupe WhatsApp

# Rapports
RAPPORT_DIR=C:\Users\PC\OneDrive\Documents\Rapport Comptable

# Port serveur
PORT=3000
```

---

## 12. Accès & Réseau

| Point d'accès | URL |
|---|---|
| Application (interne VPN) | http://100.126.44.43:3000 |
| Domaine public (à configurer) | https://www.thesmartphone.pro |
| Catalogue public | http://100.126.44.43:3000/catalogue.html |
| Service impression vitrine | http://100.126.44.43:3000/printshop.html |
| Setup WhatsApp | http://100.126.44.43:3000/whatsapp-setup.html |

### Réseau
- **VPN** : Tailscale — accès depuis n'importe où avec le compte Tailscale
- **Domaine** : `www.thesmartphone.pro` enregistré chez OVH — DNS A record à configurer

### Configurer le domaine (à faire)
1. Aller dans OVH > Zone DNS de `thesmartphone.pro`
2. Ajouter un enregistrement A : `www` → IP publique du magasin
3. Sur le routeur : ouvrir port 80 et 443 → `100.126.44.43:3000`
4. OU utiliser un tunnel Cloudflare (recommandé, sans ouvrir de port)

---

## 13. Maintenance & Nettoyage

### Fichiers à ne jamais supprimer
| Fichier | Raison |
|---|---|
| `.env` | Configuration sensible |
| `gmail_tokens.json` | Tokens OAuth2 Gmail |
| `client_secret_*.json` | Credentials OAuth2 Google |
| `.wwebjs_auth/` | Session WhatsApp |
| `uploads/` | Photos produits |
| `rapports/` | PDFs rapports comptables |

### Fichiers générés (nettoyage possible)
- `rapports/*.pdf` — PDFs > 30 jours peuvent être archivés
- `server.log` — Vider régulièrement si volumineux

### Redémarrer le serveur
```powershell
# Via SSH depuis le PC dev :
ssh prod "powershell -Command \"schtasks /Run /TN RestartShop\""
# OU sur place :
schtasks /Run /TN RestartShop
```

### Vérifier que le serveur tourne
```powershell
ssh prod "powershell -Command \"Get-Process node -ErrorAction SilentlyContinue | Select-Object Id,CPU,WorkingSet\""
```

### Tuer un Chrome orphelin
```powershell
ssh prod "powershell -Command \"Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force\""
```

---

## Contacts & Infos boutique

| | |
|---|---|
| **Boutique** | The SMARTPHONE |
| **Adresse** | 1 Avenue d'Italie, 75013 Paris |
| **Téléphone** | 01 47 07 18 66 |
| **Mobile** | 06 86 84 82 79 |
| **Email** | smartphonesatelier4@gmail.com |
| **Email IT** | ittech75013@gmail.com |
| **Site web** | www.thesmartphone.pro |
| **Google** | ⭐ 4,8/5 · 490 avis |
| **Horaires** | Lun–Sam 9h30–19h30 · Dim Fermé |
