# LBA Discord Bot v2 — Liberté Air Virtual
## Vérification par code email (OTP)

---

## Setup rapide

### 1. Créer le bot Discord
1. https://discord.com/developers/applications → New Application → "LBA Bot"
2. **Bot** → Add Bot → copier le **Token**
3. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Manage Roles`, `Manage Nicknames`, `Send Messages`, `Embed Links`, `Read Message History`
4. Coller l'URL générée dans le navigateur → inviter dans votre serveur

### 2. Créer les rôles Discord (dans cet ordre, du haut vers le bas)
```
[LBA BOT]           ← rôle du bot, auto-créé, doit être au-dessus de tout
────────────────────
Chief Pilot
Senior Captain
Captain
Senior First Officer
First Officer
Second Officer
Student Pilot
────────────────────
Hub LFBD
Hub LFPG
────────────────────
Pilote LBA          ← rôle de base attribué après vérification
Non vérifié         ← attribué aux nouveaux membres, retiré après vérification
```

### 3. Créer les salons Discord
```
#bienvenue          ← messages de bienvenue automatiques
#verification       ← panel de vérification OTP
#pireps             ← PIREPs auto-postés
#annonces           ← actualités VA auto-postées
#logs-bot           ← logs d'activité du bot
```

### 4. Configurer .env
```bash
cp .env.example .env
nano .env
```

Pour chaque ID : clic droit sur le rôle/salon/serveur → "Copier l'identifiant"
(Activer le mode développeur dans Discord : Paramètres → Avancés → Mode développeur)

### 5. Installer et démarrer
```bash
npm install
node src/deploy-commands.js    # une seule fois pour enregistrer les commandes
npm start
```

### 6. Poster le panel de vérification
Dans votre salon #verification, tapez :
```
/setup-verify
```

---

## Déployer sur Railway (gratuit)

1. Créer un compte sur https://railway.app
2. New Project → Deploy from GitHub repo
3. Uploader ce dossier sur GitHub d'abord (repo privé)
4. Dans Railway : ajouter toutes les variables du .env dans **Variables**
5. Railway démarre automatiquement avec `npm start`

---

## Flux de vérification OTP

```
Pilote clique "Vérifier mon compte"
        ↓
Modal 1 : entre son Pilot ID (ex: LBA0001)
        ↓
Bot appelle phpVMS API → trouve le compte + email
        ↓
Bot génère code 6 chiffres + envoie email via SMTP
        ↓
Pilote clique "Entrer le code"
        ↓
Modal 2 : entre le code reçu
        ↓
Bot vérifie → attribue rang + hub + retire "Non vérifié"
        ↓
Pseudo Discord mis à jour : "Nom | LBA0001"
```

---

## Commandes slash

| Commande | Description | Accès |
|----------|-------------|-------|
| `/stats` | Statistiques de la VA | Tous |
| `/pireps count:5` | Derniers PIREPs | Tous |
| `/pilot pilot_id:LBA0001` | Profil d'un pilote | Tous |
| `/setup-verify` | Poster le panel de vérif | Admin |
| `/sync user:@membre pilot_id:LBA0001` | Forcer sync des rôles | Admin |

---

## Production (Railway ou VPS)

```bash
# PM2 si sur VPS
npm install -g pm2
pm2 start src/index.js --name lba-bot
pm2 save && pm2 startup
```
