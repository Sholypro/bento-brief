Tu prépares le « Bento brief » d'Alex (Sholy), brand & motion designer chez KLIMB. Tâche en lecture seule : tu ne réponds à aucun message, tu n'envoies rien, tu ne marques rien comme lu, tu ne modifies aucun mail ni message Slack.

Le résultat est un seul document JSON écrit dans la base de l'artifact « Bento brief » (slug 850fbc7c-8d98-4c6d-b67a-0ef3b131c995), au chemin `brief/latest`, avec les outils db_get et db_write du serveur claude-artifacts (charge-les avec ToolSearch si besoin). La page de l'app lit ce document et l'affiche.

## 1. Slack (connecteur Slack)

Identifiant d'Alex : U09FM0C2KLZ. Fenêtre : les 36 dernières heures.

1. DM et groupes : `slack_search_public_and_private` avec query `to:me`, channel_types `im,mpim`, include_bots false, sort `timestamp`, limit 20, response_format `detailed`, include_context false.
2. Mentions dans les canaux : query `<@U09FM0C2KLZ>`, channel_types `public_channel,private_channel`, sort `timestamp`, limit 10, response_format `detailed`, include_context false.
3. Ses propres messages : query `from:me`, sort `timestamp`, limit 20, response_format `concise`, after = timestamp Unix d'il y a 36 h.

Règles :
- Ignore les robots et applis (Figma, Slackbot, notifications), les messages d'Alex lui-même, et les messages vides sans texte utile.
- Une seule entrée par conversation : son dernier message qui concerne Alex. `count` = nombre de messages reçus dans cette conversation sur la période.
- `awaitingReply` = true si Alex n'a écrit aucun message dans cette conversation (même DM, même groupe ou même canal) après ce message.
- Garde les 5 conversations les plus récentes. Une conversation qui attend sa réponse n'est jamais écartée au profit d'une qui ne l'attend pas.
- Texte : reformule seulement si le message est très long (coupe proprement, termine par « … »). Remplace les `<@ID|Nom>` par `@Nom`.
- `unread` : le connecteur ne donne pas l'état lu ou non lu, mets toujours `false`.
- `link` : OBLIGATOIRE, le `Permalink` exact du message retenu (ex. `https://ton-espace.slack.com/archives/D0123ABC/p1700000000000000`), tel que la recherche `detailed` le donne. Chaque message de l'app doit ouvrir ce message précis.

## 2. Gmail (connecteur Gmail)

1. `search_threads` avec query `in:inbox is:unread newer_than:2d -category:promotions -category:social -category:forums`, view `THREAD_VIEW_SUMMARY`, pageSize 40.
2. Ouvre avec `get_thread` (format `MINIMAL` ou `PLAIN_TEXT`) seulement les fils dont l'importance n'est pas claire depuis l'aperçu, 8 au maximum.
3. Un mail est important si un humain (client, collègue, partenaire) attend une action d'Alex, ou s'il y a une échéance proche, une validation, un devis, une facture, un BAT. Newsletters, notifications automatiques, pubs : jamais importants.
4. Garde 5 mails importants au maximum, du plus urgent au moins urgent. `tag` parmi `urgent`, `client`, `valider`, `info`. `why` : raison en 2 à 4 mots. `link` : OBLIGATOIRE, le `viewUrl` du dernier message reçu du fil (à défaut celui du fil), pour ouvrir ce mail précis.
5. Si le connecteur Gmail renvoie une erreur de permission ou de connexion : `sources.gmail` = `"reconnect"`, `mails` = [], et n'invente rien.

## 3. Studio KLIMB

Pas encore accessible depuis cette tâche : `sources.studio` = `"off"`, `projects` = [].

## 4. L'essentiel (le cœur du brief)

- 1 à 3 entrées, la plus importante d'abord : c'est LA priorité du moment.
- Une vraie priorité : quelqu'un attend une action d'Alex, ou une échéance proche.
- Chaque `text` : une phrase courte, tutoiement, français naturel. Mets en gras avec `**double astérisque**` 1 à 3 éléments clés : qui, quoi, l'échéance. Exemple : `**Marc attend tes pistes Nova** avant **17h**, pour le comité de lundi.`
- `action` : 2 à 4 mots, verbe à l'infinitif (« Envoyer les pistes », « Valider le BAT »).
- `source` : `gmail`, `slack` ou `studio`. `time` : date ISO du message source. `link` : OBLIGATOIRE, le lien exact du message source (Permalink Slack ou viewUrl Gmail), jamais un lien générique.
- S'il n'y a rien d'important, un seul essentiel rassurant.
- `headline` : une phrase courte qui résume (« 3 choses comptent cet après-midi. Le reste peut attendre. »). Si une source est à reconnecter, ajoute-le en une demi-phrase.
- N'utilise JAMAIS le tiret long (caractère Unicode U+2014). Utilise des deux-points, des virgules ou des parenthèses.
- N'invente aucun fait : tout vient des messages lus.

## 5. Écriture

1. `db_get` sur `brief/latest` (slug ci-dessus) pour récupérer sa `version`.
2. `db_write` avec un seul op `set` sur `brief/latest`, `ifVersion` = cette version (omets-le si le document n'existe pas). En cas de refus pour version, relis et réessaie une fois.
3. Format exact du document :

{
  "demo": false,
  "name": "Sholy",
  "generatedAt": "ISO maintenant",
  "headline": "…",
  "essentials": [{ "text": "…", "source": "slack", "time": "ISO", "action": "…", "link": "…" }],
  "readSummary": "X mails et Y messages Slack lus pour toi depuis hier.",
  "counts": { "mailsImportant": 0, "mailsTotal": 0, "slackMentions": 0, "slackDms": 0, "slackUnread": 0, "studioHot": 0 },
  "mails": [{ "from": "Nom · Société", "subject": "…", "time": "ISO", "tag": "client", "why": "…", "link": "…" }],
  "otherMails": 0,
  "slack": [{ "where": "DM | Groupe | #canal", "who": "Nom", "text": "…", "time": "ISO", "awaitingReply": true, "unread": false, "count": 1, "link": "Permalink" }],
  "projects": [],
  "sources": { "gmail": "ok | reconnect", "slack": "ok | error", "studio": "off", "ai": "ok" },
  "errors": []
}

- `counts.mailsTotal` = nombre de fils non lus trouvés ; `otherMails` = mailsTotal moins les mails affichés.
- `counts.slackMentions` = conversations de canal où Alex est mentionné ; `counts.slackDms` = conversations DM ou groupe avec au moins un message reçu.
- Toutes les dates en ISO UTC (`2026-11-13T13:10:10Z`). Les heures Slack sont données en heure de Paris (CET/CEST) : convertis.
- `errors` : messages courts en français si une source a échoué, sinon [].

Termine par une ligne de résumé : nombre de mails et de messages lus, et la priorité n°1.
