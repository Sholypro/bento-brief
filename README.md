# Bento brief

Ton brief du jour en quelques secondes sur iPhone et iPad : Slack, Gmail et Studio KLIMB, triés et résumés par Claude, dans la DA solarpunk glass.

```
Tâche planifiée Claude (toutes les heures de 8h à 19h, plus 6h et 21h)
        ├─ lit Slack et Gmail (connecteurs Claude, lecture seule)
        ├─ relit tes réglages et tes retours « Important / Pas important »
        └─ écrit le brief trié dans Supabase (table bento_briefs)
                         │
                         ▼
Webapp Bento (GitHub Pages)  https://sholypro.github.io/bento-brief/
        ├─ lit le dernier brief avec ta clé d'accès Bento
        ├─ lit l'API Studio KLIMB directement (adresse et clé gardées sur l'appareil)
        └─ appui long sur un élément : tu lui apprends ce qui compte
```

Aucune clé API payante : le tri est fait par ta tâche planifiée Claude. L'app ne se connecte ni à Google ni à Slack, elle lit seulement ta base.

## Installer sur l'iPhone et l'iPad (sans Xcode)

1. Ouvre https://sholypro.github.io/bento-brief/ dans **Safari**.
2. Colle ta **clé d'accès Bento** (une seule fois).
3. Bouton Partager > **Sur l'écran d'accueil** > Ajouter.

L'icône Bento s'ouvre en plein écran comme une vraie app, sans expiration. Chaque mise à jour poussée sur GitHub arrive toute seule.

L'app SwiftUI du dossier `ios/` fait la même chose dans une app native (installée avec Xcode, compte gratuit, à relancer tous les 7 jours). Voir `ios/README.md`.

## Fichiers

```
docs/                 la webapp publiée sur GitHub Pages (index.html, manifeste, icônes, mode hors ligne)
artifact/index.html   copie de travail de la page (identique à docs/index.html)
supabase/schema.sql   tables et fonctions de la base (accès uniquement avec la clé Bento)
automation/prompt.md  prompt de la tâche planifiée (version publique, identifiants masqués)
ios/                  app iOS native (WKWebView) qui affiche la webapp
```

## Sécurité

- Les tables Supabase sont fermées. L'app passe par trois fonctions (`bento_get`, `bento_save_config`, `bento_feedback`) qui exigent la clé d'accès Bento. Seul son hash est stocké.
- La clé publique Supabase visible dans la page ne donne accès à rien sans la clé Bento.
- L'adresse et la clé de l'API Studio restent sur l'appareil.
- Nouvelle clé d'accès : voir la fin de `supabase/schema.sql`. Pour en révoquer une : `delete from public.bento_keys where id = …`.

## Studio KLIMB

Dès que l'API existe : pastille **Studio** en bas de l'app, colle l'adresse et la clé. L'app accepte une liste de projets (`client`, `title`, `deadline`, `progress`, `status`) ou `{ "projects": [...] }`. Le format exact sera ajusté à l'API réelle.
