# Bento pour iPhone et iPad (mode développeur, sans licence)

Une app iOS (SwiftUI) qui affiche la webapp Bento en plein écran : https://sholypro.github.io/bento-brief/

> Plus simple encore : ouvre ce lien dans Safari puis Partager > Sur l'écran d'accueil. Même résultat, sans Xcode et sans expiration.

Ce que fait l'app :

- Au premier lancement, elle te demande seulement ta **clé d'accès Bento**. Aucune connexion Claude, Google ou Slack.
- Le brief vient de ta base Supabase, rempli toutes les heures en journée par ta tâche planifiée Claude.
- Ouvre les liens Slack dans l'app Slack, et les liens Gmail et Studio dans Safari.
- Tirer vers le bas recharge. Chaque mise à jour poussée sur GitHub arrive sans repasser par Xcode.

La limite du compte gratuit : l'app expire au bout de **7 jours**. Il suffit alors de rebrancher l'appareil et de relancer depuis Xcode. Ta clé d'accès est conservée.

## Fichiers

```
ios/Bento.xcodeproj                  le projet Xcode, prêt à ouvrir
ios/BentoBrief/BentoBriefApp.swift   point d'entrée
ios/BentoBrief/ContentView.swift     écran : fond, chargement, hors ligne, barre d'aide
ios/BentoBrief/BentoWebView.swift    la vue web (liens, rechargement)
ios/BentoBrief/BentoConfig.swift     l'adresse de la webapp et les domaines autorisés
ios/BentoBrief/Assets.xcassets       l'icône de l'app
```

Tout est déjà réglé dans le projet : nom affiché « Bento », iPhone et iPad, toutes les orientations, iOS 17 minimum, icône. Il te reste seulement à choisir ton Apple ID pour la signature.

## 1. Installer Xcode (une seule fois)

1. Sur le Mac, ouvre l'App Store et installe **Xcode** (gratuit, environ 10 Go). Il faut Xcode 16 ou plus récent.
2. Ouvre Xcode une première fois. Accepte la licence, puis laisse-le installer les composants iOS quand il le propose.
3. **Xcode > Settings… > Accounts**, bouton **+** en bas à gauche > **Apple ID**, connecte-toi avec ton Apple ID habituel. Une équipe « Ton Nom (Personal Team) » apparaît.

## 2. Récupérer le projet

Sur github.com/Sholypro/bento-brief : bouton vert **Code > Download ZIP**, puis dézippe. Ou dans le Terminal :

```bash
git clone https://github.com/Sholypro/bento-brief.git
```

## 3. Ouvrir le projet

Double-clique sur `ios/Bento.xcodeproj`. Xcode s'ouvre sur le projet Bento.

## 4. Choisir ton Apple ID (une seule fois)

1. Clique sur le projet **Bento** (icône bleue tout en haut de la colonne de gauche), puis sur la cible **Bento**.
2. Onglet **Signing & Capabilities** : **Automatically manage signing** est déjà coché. Dans **Team**, choisis ton **Personal Team**.
3. Si Xcode dit que l'identifiant `com.sholy.bento` n'est pas disponible, change le **Bundle Identifier** (par exemple `com.sholy.bento.app`).

## 5. (Facultatif) Essayer sur le simulateur

En haut de Xcode, à côté du bouton ▶, choisis un **iPhone** ou un **iPad Pro** parmi les simulateurs, puis ▶. Pratique pour voir l'app avant de brancher un appareil.

## 6. Préparer l'iPhone (une seule fois)

1. Branche l'iPhone au Mac avec un câble, déverrouille-le, touche **Faire confiance** et tape ton code.
2. En haut de Xcode, à côté du bouton ▶, choisis ton iPhone dans la liste des appareils.
3. Active le **mode développeur** sur l'iPhone : **Réglages > Confidentialité et sécurité > Mode développeur** (tout en bas). L'option apparaît après avoir branché l'iPhone à Xcode. Active-le, l'iPhone redémarre, puis confirme **Activer**.

## 7. Lancer l'app

1. Dans Xcode, appuie sur **▶** (ou Cmd + R). La première compilation prend une minute.
2. Si Xcode dit que le développeur n'est pas approuvé : sur l'iPhone, **Réglages > Général > VPN et gestion de l'appareil** > ton Apple ID sous « App de développeur » > **Faire confiance**. Relance ▶.
3. Bento s'ouvre sur l'iPhone, avec son icône sur l'écran d'accueil.

### Première ouverture : ta clé d'accès

- Colle ta clé d'accès Bento (elle commence par `bento_`) puis **Ouvrir mon brief**.
- L'API du Studio KLIMB est facultative : tu pourras l'ajouter plus tard depuis la pastille Studio.
- C'est tout : l'app ne te redemandera rien.

## 8. Sur l'iPad Pro

Mêmes étapes 6 et 7 avec l'iPad branché et choisi en haut de Xcode. Le mode développeur est au même endroit dans les Réglages.

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
- **« Signing requires a development team »** : refais l'étape 4.
- **Erreur de compilation dans Xcode** : fais une capture de l'erreur (le panneau rouge à gauche) et envoie-la à Claude.
- **Déboguer la page** : l'app est inspectable. Sur le Mac, Safari > Réglages > Avancées > coche « Afficher les fonctionnalités pour les développeurs web », puis menu **Développement** > ton iPhone > Bento.

## Changer d'adresse

L'adresse de la webapp est dans `BentoConfig.swift` (`briefURL`). Elle ne change que si le dépôt GitHub change de nom.
