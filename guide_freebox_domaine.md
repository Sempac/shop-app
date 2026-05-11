# 🌐 Guide — Accès distant via Freebox Pro

## Étape 1 — Sous-domaine freeboxos.fr (gratuit)

1. Connectez-vous à **mafreebox.freebox.fr** ou **192.168.0.254**
2. Paramètres de la Freebox → **Mode avancé**
3. Cliquez sur **"Nom de domaine"**
4. **"Ajouter un nom de domaine"**
5. Choisissez **"Je veux un nom de domaine Freebox personnalisé"**
6. Saisissez par exemple : **`smartphone`**
   → Vous obtiendrez : `smartphone.freeboxos.fr`
7. Cochez **"Je veux un certificat Let's Encrypt"** (HTTPS gratuit)
8. Validez → certificat généré en ~2 minutes

## Étape 2 — Redirection de port

1. Dans FreeboxOS → **Paramètres** → **Mode avancé** → **Redirections de ports**
2. Ajouter une règle :
   - IP destination : IP du PC magasin (ex: 192.168.1.X)
   - Port externe : **3000**
   - Port interne : **3000**
   - Protocole : TCP
3. Valider

## Étape 3 — Accès

Depuis n'importe où dans le monde :
```
https://smartphone.freeboxos.fr:3000
```

Depuis le réseau local du magasin :
```
http://smartphone.local:3000
http://192.168.1.X:3000
http://localhost:3000
```

## ⚠️ Sécurité importante

Si vous ouvrez un port sur internet, **changez le port par défaut** :
- Modifier server.js : `app.listen(3000, ...)` → `app.listen(8743, ...)`  
- Ça évite les scans automatiques de robots

## Option alternative — Tailscale (recommandée pour la sécurité)

Plus sécurisé que d'ouvrir un port :
1. Installez Tailscale sur le PC magasin : https://tailscale.com
2. Installez Tailscale sur votre PC perso
3. Les 2 PC sont dans un réseau privé virtuel
4. Accédez à l'appli via l'IP Tailscale du PC magasin
5. **Aucun port ouvert sur internet** → risque zéro

