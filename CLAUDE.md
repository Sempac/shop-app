# CLAUDE.md — shop-app (The SMARTPHONE)

## Contexte
Application de gestion pour un magasin de téléphonie, réparation et impression.
- **Dev** : `C:\Dev\shop-app` (ce PC, PC perso)
- **Prod** : `C:\apps\shop-app` (PC magasin = serveur de prod)

## Stack technique
- **Backend** : Node.js / Express 5
- **Base de données** : PostgreSQL
- **Frontend** : HTML / CSS / JS vanilla (pas de framework)
- **IA** : Claude API (`@anthropic-ai/sdk`)
- **Autres** : Puppeteer (PDF), node-cron, Nodemailer, Multer, QR Code, Google APIs

## Accès prod
- **SSH** : `ssh prod` (alias configuré)
- **Remote** : Tailscale + Funnel (tunnel exposé publiquement)
- **Bureau à distance** : AnyDesk (disponible)
- **OS prod** : Windows

## Déploiement
- `git push` depuis dev → `git pull` sur prod via SSH
- Redémarrage app : `ssh prod` puis commande de restart (PowerShell)
- Fichier `.env` différent entre dev et prod

## Ce que Claude peut faire
- Développement complet (nouveaux features, bug fix, refacto)
- Déploiement et livraison en prod via SSH
- Redémarrage de l'application
- Modifications de configuration
- Interventions base de données (migrations SQL)
- Scripts d'administration et maintenance

## Modules principaux
- `server.js` — point d'entrée, routes API
- `auth.js` — authentification
- `theme.js` / `theme.css` — UI
- Pages HTML : sales, repairs, stock, lots, catalogue, commandes, devis, expenses, contacts, users, returns, history, dailyreport, rapport-comptable, credits, printshop

## Conventions
- Fichiers `tmp-*.js` = scripts one-shot temporaires (à nettoyer après usage)
- Fichiers `add_*.sql` / `create_*.sql` = migrations cumulatives
- Pas de framework frontend — JS vanilla uniquement
