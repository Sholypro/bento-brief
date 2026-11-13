# Bento pour iPhone et iPad (mode développeur, sans licence)

Une vraie app iOS (SwiftUI) qui affiche ta page Claude « Bento brief » en plein écran. Elle s'installe depuis ton Mac avec Xcode et ton Apple ID gratuit : pas besoin du programme développeur Apple à 99 €.

Ce que fait l'app :

- Ouvre directement ton brief. Le brief est écrit toutes les heures par ta tâche planifiée Claude, puis il se met à jour en direct.
- Te garde connecté à Claude d'un lancement à l'autre.
- Ouvre les liens Slack dans l'app Slack, et les liens Gmail et Studio dans Safari.
- Tirer vers le bas recharge la page. Si tu reviens après plus de 10 minutes, l'app recharge toute seule.
- Mise en page iPhone, iPad Pro 11 et 13 pouces, en portrait et en paysage.

La limite du compte gratuit : l'app expire au bout de **7 jours**. Il suffit alors de rebrancher l'appareil et de relancer depuis Xcode (étape 9). Ta connexion Claude est conservée.

## Fichiers

```
ios/AppIcon-1024.png            icône de l'app
ios/BentoBrief/BentoBriefApp.swift   point d'entrée
ios/BentoBrief/ContentView.swift     écran : fond, chargement, hors ligne, barre d'aide
ios/BentoBrief/BentoWebView.swift    la vue web (connexion, liens, fenêtres de connexion)
ios/BentoBrief/BentoConfig.swift     le lien de ta page Claude et les domaines autorisés
```

## 1. Installer Xcode (une seule fois)

1. Sur le Mac, ouvre l'App Store et installe **Xcode** (gratuit, environ 10 Go).
2. Ouvre Xcode une première fois. Accepte la licence, puis laisse-le installer les composants iOS quand il le propose.
3. **Xcode > Settings… > Accounts**, bouton **+** en bas à gauche > **Apple ID**, connecte-toi avec ton Apple ID habituel. Une équipe « Ton Nom (Personal Team) » apparaît.

## 2. Récupérer le projet

Sur github.com/Sholypro/bento-brief : bouton vert **Code > Download ZIP**, puis dézippe. Ou dans le Terminal :

```bash
git clone https://github.com/Sholypro/bento-brief.git
```

## 3. Créer l'app dans Xcode

1. **File > New > Project…** > onglet **iOS** > **App** > Next.
2. Remplis :
   - Product Name : `Bento`
   - Team : ton **Personal Team**
   - Organization Identifier : `com.sholy` (l'identifiant devient `com.sholy.Bento`)
   - Interface : **SwiftUI**, Language : **Swift**, Storage : **None**, décoche les tests
3. Next, enregistre le projet où tu veux (par exemple dans Documents).

## 4. Mettre le code de Bento

1. Dans la colonne de gauche, supprime `BentoApp.swift` et `ContentView.swift` : clic droit > **Delete** > **Move to Trash**.
2. Fais glisser les **4 fichiers** du dossier `ios/BentoBrief/` dans la colonne de gauche, dans le dossier jaune `Bento`.
3. Dans la fenêtre qui s'ouvre, coche **Copy items if needed** et vérifie que la cible **Bento** est cochée > Finish.

## 5. L'icône

1. Clique sur **Assets** dans la colonne de gauche, puis sur **AppIcon**.
2. Fais glisser `ios/AppIcon-1024.png` dans la case **Any Appearance**.

## 6. Réglages de la cible

Clique sur le projet **Bento** (icône bleue tout en haut à gauche), puis sur la cible **Bento** > onglet **General** :

- **Supported Destinations** : iPhone et iPad (déjà là par défaut).
- **Minimum Deployments** : mets la version d'iOS de ton appareil le plus ancien, au minimum **17.0**.
- **Identity > Display Name** : `Bento`.
- **Deployment Info** : coche toutes les orientations, pour iPhone comme pour iPad.

Onglet **Signing & Capabilities** : coche **Automatically manage signing**, Team = ton Personal Team. Si Xcode dit que l'identifiant n'est pas disponible, change-le (`com.sholy.bento.app` par exemple).

## 7. Préparer l'iPhone (une seule fois)

1. Branche l'iPhone au Mac avec un câble, déverrouille-le, touche **Faire confiance** et tape ton code.
2. En haut de Xcode, à côté du bouton ▶, choisis ton iPhone dans la liste des appareils.
3. Active le **mode développeur** sur l'iPhone : **Réglages > Confidentialité et sécurité > Mode développeur** (tout en bas). L'option apparaît après avoir branché l'iPhone à Xcode. Active-le, l'iPhone redémarre, puis confirme **Activer**.

## 8. Lancer l'app

1. Dans Xcode, appuie sur **▶** (ou Cmd + R). La première compilation prend une minute.
2. Si Xcode dit que le développeur n'est pas approuvé : sur l'iPhone, **Réglages > Général > VPN et gestion de l'appareil** > ton Apple ID sous « App de développeur » > **Faire confiance**. Relance ▶.
3. Bento s'ouvre sur l'iPhone, avec son icône sur l'écran d'accueil.

### Première ouverture : se connecter à Claude

- Connecte-toi comme sur le site claude.ai, avec le même compte que d'habitude.
- **Google** : la fenêtre de connexion s'ouvre par-dessus l'app. Si Google refuse (« navigateur non sécurisé »), utilise l'e-mail à la place.
- **E-mail** : Claude t'envoie un lien. Dans Mail, appuie longuement sur le lien > **Copier le lien**, reviens dans Bento et touche **Coller** dans la barre du bas.
- Une fois connecté, touche **Mon brief** si tu n'es pas arrivé directement sur ton brief. Tu n'auras plus à te reconnecter.

## 9. Sur l'iPad Pro

Mêmes étapes 7 et 8 avec l'iPad branché et choisi en haut de Xcode. Le mode développeur est au même endroit dans les Réglages.

En paysage, tout le brief tient sur un seul écran. En portrait, la section la plus remplie (souvent Slack) occupe la colonne de gauche, et les autres s'empilent à droite.

## Tous les 7 jours

Avec un Apple ID gratuit, Apple limite la signature à 7 jours. Quand Bento refuse de s'ouvrir :

1. Branche l'appareil (ou mets-le sur le même Wi-Fi que le Mac, voir plus bas).
2. Ouvre le projet dans Xcode, choisis l'appareil, appuie sur **▶**.

Ta connexion et tes réglages restent. Pour éviter le câble : **Window > Devices and Simulators**, sélectionne l'appareil et coche **Connect via network**. Tant qu'ils sont sur le même Wi-Fi, Xcode le voit sans câble.

Autres limites du compte gratuit : 3 apps de développement au maximum par appareil, et pas de notifications push.

## En cas de souci

- **La page reste blanche ou demande de se connecter en boucle** : touche **Mon brief**, ou tire vers le bas pour recharger.
- **Un lien ne s'ouvre pas** : les liens Slack ouvrent l'app Slack si elle est installée, sinon Safari.
- **Erreur de compilation dans Xcode** : fais une capture de l'erreur (le panneau rouge à gauche) et envoie-la à Claude.
- **Déboguer la page** : l'app est inspectable. Sur le Mac, Safari > Réglages > Avancées > coche « Afficher les fonctionnalités pour les développeurs web », puis menu **Développement** > ton iPhone > Bento.

## Changer de page

Le lien de la page est dans `BentoConfig.swift` (`briefURL`). Si tu recrées la page Claude un jour, colle le nouveau lien à cet endroit et relance ▶.
