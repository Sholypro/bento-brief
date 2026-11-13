# Bento brief

Ton brief du jour en quelques secondes sur iPhone et iPad : Slack, Gmail et Studio KLIMB, triés par des règles puis résumés par Claude, dans la DA solarpunk glass de la maquette.

C'est une web app installable : elle s'ouvre en plein écran depuis l'écran d'accueil, comme une vraie app. Pas de Xcode, pas de compte développeur Apple.

```
iPhone / iPad (Safari, écran d'accueil)
        │  ouvre l'app : dernier brief affiché tout de suite
        ▼
Vercel  /api/brief  (cache 10 min, bouton Actualiser = recalcul)
        ├─ Gmail     IMAP + mot de passe d'application
        ├─ Slack     token utilisateur (mentions + DM)
        ├─ Studio    JSON ou Supabase de l'app Lovable
        └─ Claude    tri + résumé avec mots en gras
```

Sans aucune variable configurée, l'app tourne en **mode démo** avec des données d'exemple. Tu peux donc l'installer et la voir tout de suite, puis brancher les sources une par une.

---

## 1. Tester en local (optionnel, 2 min)

Il faut Node 20 ou plus sur ton Mac.

```bash
cd bento-brief
npm install
npm run dev
```

Ouvre http://localhost:3000. Pour tester sur l'iPhone, même Wi-Fi : http://IP-de-ton-Mac:3000.

## 2. Mettre en ligne sur Vercel (gratuit, 5 min)

1. Crée un compte sur vercel.com (connexion GitHub conseillée).
2. Dans le dossier du projet :
   ```bash
   npx vercel
   ```
   Réponds aux questions (valeurs par défaut). Tu obtiens une URL du type `bento-brief-xxx.vercel.app`.
3. Pour la version finale : `npx vercel --prod`.

Variante sans terminal : pousse le dossier sur un repo GitHub privé, puis Vercel > Add New > Project > importe le repo.

## 3. Installer sur l'iPhone et l'iPad

1. Ouvre l'URL dans **Safari**.
2. Bouton Partager > **Sur l'écran d'accueil** > Ajouter.
3. L'icône Bento apparaît, l'app s'ouvre en plein écran.

## 4. Brancher les sources

Toutes les clés se mettent dans Vercel > ton projet > **Settings > Environment Variables**, puis **Deployments > Redeploy** pour qu'elles soient prises en compte. La liste complète est dans `.env.example`.

### Code d'accès (obligatoire dès qu'une source est branchée)

`APP_KEY` : invente une longue phrase. L'app te la demande une seule fois, puis la garde sur l'appareil. Sans ce code, l'API refuse de répondre.

### Claude (le tri et le résumé)

1. console.anthropic.com > API Keys > Create Key.
2. `ANTHROPIC_API_KEY` = la clé.
3. `CLAUDE_MODEL` : `claude-haiku-5-5` par défaut (rapide, économique). Passe à `claude-sonnet-5-5` si tu veux un tri plus fin.

Sans clé Claude, l'app fonctionne quand même avec un tri par règles, sans résumé rédigé.

### Gmail

1. Active la **validation en 2 étapes** sur le compte Google.
2. Va sur myaccount.google.com/apppasswords, crée un mot de passe d'application nommé « Bento ».
3. `GMAIL_ACCOUNTS` = `ton@gmail.com:motdepasse16lettres`
   Plusieurs comptes : sépare par des virgules.

À savoir :
- L'app ne lit que les **non lus de l'onglet Principal** des dernières 36 h. Elle ne modifie rien et ne marque rien comme lu.
- Si c'est un compte Google Workspace (adresse KLIMB), l'admin peut avoir bloqué les mots de passe d'application. Dans ce cas, dis-le-moi et on passe par OAuth.

### Slack

1. api.slack.com/apps > **Create New App** > From scratch > workspace KLIMB.
2. **OAuth & Permissions** > **User Token Scopes**, ajoute :
   `search:read`, `users:read`, `im:read`, `im:history`, `mpim:read`, `mpim:history`, `channels:read`, `groups:read`
3. **Install to Workspace** (selon les réglages KLIMB, un admin peut devoir valider).
4. Copie le **User OAuth Token** (commence par `xoxp-`) dans `SLACK_USER_TOKEN`.

L'app récupère tes mentions et tes DM reçus. Elle ne poste rien.

### Studio KLIMB (studio.goklimb.com)

Je n'ai pas pu voir le contenu du site (il faut être connecté). Deux options :

**Option A, la plus simple** : si quelqu'un peut exposer une URL qui renvoie la liste des projets en JSON, mets-la dans `STUDIO_JSON_URL`.

**Option B, lire la base Supabase de l'app Lovable** :
1. Ouvre studio.goklimb.com sur ton Mac dans Chrome, connecté.
2. Clic droit > Inspecter > onglet **Network**, recharge la page, filtre sur `supabase`.
3. Tu verras des appels du type `https://xxxx.supabase.co/rest/v1/NOM_TABLE?...`
   - `STUDIO_SUPABASE_URL` = `https://xxxx.supabase.co`
   - `STUDIO_TABLE` = `NOM_TABLE`
   - `STUDIO_SUPABASE_KEY` = la valeur de l'en-tête `apikey`
4. Si la table renvoie une liste vide, c'est que l'accès demande d'être connecté : il faudra une clé en lecture seule de la personne qui a créé l'app.

Les colonnes n'ont pas besoin d'un format précis : Claude les lit et en sort client, projet, deadline et avancement. Vérifie avec KLIMB que c'est OK de brancher ces données sur un outil perso.

### Règles de tri (avant l'IA)

- `PRIORITY_SENDERS` : domaines ou noms qui comptent toujours (clients, `goklimb.com`…)
- `PRIORITY_KEYWORDS` : mots qui font remonter un mail (urgent, BAT, devis…)
- `LOOKBACK_HOURS` : fenêtre de lecture (36 par défaut)
- `DISPLAY_NAME` : le prénom de « Bonjour … »

## 5. Comment ça marche au quotidien

- À l'ouverture, l'app affiche **immédiatement** le dernier brief gardé sur l'appareil, puis se met à jour.
- Le serveur garde le brief **10 minutes** en cache : l'ouverture est quasi instantanée. Le bouton ⟳ force un nouveau calcul (5 à 15 s selon le volume).
- En bas de l'écran, les pastilles indiquent l'état de chaque source (OK, off, erreur), et les erreurs éventuelles s'affichent en clair.
- Les liens ouvrent directement le mail dans Gmail, le message dans Slack ou le site Studio.

## Structure

```
api/brief.js        point d'entrée de l'API (code d'accès + cache)
lib/brief.js        orchestration : sources, règles, IA, fusion
lib/gmail.js        lecture IMAP
lib/slack.js        mentions + DM
lib/studio.js       JSON ou Supabase, normalisation de secours
lib/claude.js       prompt de tri et de résumé
lib/rules.js        score des mails, tri sans IA
lib/demo.js         données du mode démo
public/index.html   l'app (design, rendu, cache local)
public/sw.js        ouverture hors ligne
scripts/            serveur local et test de l'API
```

Tester l'API sans navigateur : `npm run test:api` (avec un `.env` rempli).

---

## V1 en ligne : page Claude + brief automatique

- **L'app** : `artifact/index.html`, publiée comme page Claude privée (« Bento brief »). Elle lit le document `brief/latest` dans la base de la page.
- **Le tri** : une tâche planifiée Claude (`automation/prompt.md`) tourne en semaine, toutes les heures de 8h à 20h. Elle lit Slack et Gmail avec les connecteurs de ton compte Claude, trie, puis écrit le brief dans la base.
- **Studio KLIMB** : pas encore branché.
- Le dossier `api/` et `lib/` reste la version autonome (Vercel ou serveur Node) si tu veux un jour sortir de Claude.
- **App iPhone et iPad** : `ios/`, une app SwiftUI qui affiche la page Claude en plein écran, installée depuis Xcode en mode développeur avec un Apple ID gratuit. Le guide pas à pas est dans `ios/README.md`.
