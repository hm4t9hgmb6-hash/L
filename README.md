# Dealpick — site web

Site de **Dealpick**, service de **réductions en temps réel** proposées par les commerces
indépendants **avec pignon sur rue**.

Le mécanisme : un commerçant publie une réduction au moment où il le décide — boutique
vide un mardi après-midi, stock à écouler, créneau annulé. L'offre est immédiatement
visible par les clients qui sont dans son rayon, avec sa durée de validité et son nombre
de places. Elle disparaît dès qu'elle est épuisée ou expirée.

Deux natures d'offre :

- **des produits** — un article à récupérer pendant une fenêtre de validité ;
- **des prestations** — un rendez-vous à heure fixe, bloqué au nom du client.

Le client réserve et paie dans l'application, puis se présente sur place. Dealpick
encaisse pour le compte du commerçant et le reverse, commission déduite. L'application est
gratuite pour le client.

**Ce que le service n'est pas** : ni un catalogue de bons plans permanents, ni une
plateforme anti-gaspillage. Le temps et la distance sont les deux paramètres qui font
exister une offre — c'est ce qui doit transparaître partout dans l'interface et les
textes.

---

## Architecture

Le site sert **deux publics qui ne doivent jamais se gêner**. L'accueil est une page
client qui ne parle que de trouver un bon panier près de chez soi, avec une seule porte
vers le monde professionnel. Le parcours commerçant vit sur sa propre branche, avec son
héros et ses propres objections : un boulanger arrivant d'un e-mail commercial ne doit
pas atterrir sur du contenu grand public.

### Parcours client

| Page | Fichier | Rôle |
|---|---|---|
| Accueil | `index.html` | Promesse, « c'est dispo chez moi ? », 3 étapes, impact, villes, double porte, témoignages, FAQ courte, téléchargement |
| Comment ça marche | `comment-ca-marche.html` | Le parcours en détail et les objections d'avant-achat (contenu du panier, qualité, retard, prix) |
| Villes | `villes.html` | Villes ouvertes, villes à venir, **capture d'e-mail si absente** |
| Page ville | `villes/exemple-ville.html` | Gabarit à dupliquer par ville : **carte des commerces**, liste synchronisée, quartiers, chiffres locaux |

### Parcours commerçant

| Page | Fichier | Rôle |
|---|---|---|
| Commerçants | `commercants.html` | Landing autonome : bénéfices, fonctionnement côté pro, commission, FAQ pro, inscription |

### Marque, support, légal

| Page | Fichier |
|---|---|
| Notre mission | `mission.html` |
| FAQ (client + commerçant) | `faq.html` |
| Aide et contact | `aide.html` |
| Mentions légales | `legal/mentions-legales.html` |
| Confidentialité | `legal/confidentialite.html` |
| CGU | `legal/cgu.html` |
| **CGV** | `legal/cgv.html` |
| Cookies | `legal/cookies.html` |

### Pourquoi ces pages-là

- **Les pages ville** sont le principal levier de référencement de ce type de service :
  les gens cherchent « invendus Lyon », « anti-gaspi Bordeaux ». Une page par ville, avec
  du contenu réellement local — dupliquer le même texte n'apporte rien.
- **La carte de la page ville** répond à la seule question qui compte à ce stade du
  parcours : « qu'est-ce qu'il y a autour de moi ? ». Le fond est un SVG de substitution,
  remplaçable par MapLibre ou Leaflet sans toucher au reste de la page — voir
  `INTEGRATION.md`.
- **La page villes** sert aussi d'outil de mesure : le formulaire « ma ville n'y est pas »
  dit où ouvrir ensuite.
- **La mission** justifie les prix bas (c'est de l'invendu, pas de la mauvaise qualité),
  rassure, et ouvre la presse locale.
- **Les CGV** sont obligatoires : il y a vente, paiement et encaissement pour compte de
  tiers. Les CGU seules ne couvrent pas ça.

---

## Thème visuel — clair, une seule version

Le site **n'a pas de mode sombre**. C'est un choix, pas un oubli : il impose son fond
clair quel que soit le réglage du système, comme le font les sites de référence de ce
registre. Le sélecteur de thème a donc été retiré, et `color-scheme: light` est déclaré
pour que les contrôles de formulaire restent clairs eux aussi.

### Palette

| Rôle | Valeur | Usage |
|---|---|---|
| Encre | `#14161E` | Texte |
| Blanc | `#FFFFFF` | Fond des panneaux clairs |
| Gris panneau | `#F5F5F7` | Fond des panneaux alternés |
| Bleu | `#2E5EFF` | Marque, boutons, liens |
| Corail | `#FF6B4A` | Réductions — **uniquement** |
| Menthe | `#10B981` | Disponibilité, indicateur « en direct » |
| Violet | `#7C5CFF` | Prestations, bandes colorées |

Les neutres sont légèrement bleutés, accordés à la couleur de marque.

### Typographie

**Gabarito** en titrage (600–900), **Manrope** pour le texte courant. Titres très larges,
interlettrage resserré à −0,035 em, casse normale.

### Les panneaux

L'accueil est une **pile de panneaux pleine largeur**, alternant blanc et gris très clair.
Chaque panneau suit la même partition :

1. un titre court, centré, en très grande taille, ponctué d'un point ;
2. un sous-titre d'une à deux lignes ;
3. zéro à deux boutons pilules — bleu plein pour l'action principale, contour bleu pour
   la secondaire ;
4. une image qui **descend jusqu'au bord bas du panneau**, sans cadre, sans ombre, sans
   coin arrondi autour d'elle.

Ce dernier point est la règle la plus importante : l'image n'est pas posée *dans* une
boîte, elle *est* le bas du panneau. Les visuels de substitution (`.visual`) doivent être
remplacés par des photos détourées ou cadrées serré.

Deux panneaux peuvent être placés côte à côte sur grand écran (`.panel-duo`).

### Photographies

Les photos vivent dans `assets/img/photos/`, en deux formats et deux tailles :

```
coiffeur      1200 / 640 px   panneau « côté client »
commercante    900 / 600 px   panneau « côté commerçant »
restaurant           300 px   carte du diaporama des catégories
reperer       1200 / 640 px   étape 1 — visuel fabriqué, pas une photo
reserver       652 / 480 px   étape 2
profiter             400 px   étape 3 — ⚠️ trop basse définition, à remplacer
```

Chaque nom existe en `.jpg` et `.webp`.

Le visuel de l'étape 1 (`reperer`) n'est pas une photographie : c'est une composition
HTML rendue en image, qui reprend la carte et une offre du produit. Sa source est dans
`assets/img/photos/reperer.source.html` — pour la refaire, on l'ouvre, on modifie, on
capture en 1200 × 800.

Le balisage utilise `<picture>` : le WebP est servi aux navigateurs qui le gèrent, le
JPEG progressif aux autres, et `srcset` choisit la taille selon l'écran. Chaque image
porte ses dimensions et `loading="lazy"` — sans les dimensions, la page saute pendant le
chargement.

**Règle de traitement** : une photo n'est jamais encadrée. Pas de bordure, pas d'ombre,
pas de coin arrondi. Elle occupe toute la largeur de son panneau et descend jusqu'au bord
bas. Le cadrage est régularisé par `.photo-frame`, en 3/2, quelle que soit la photo
fournie.

**Pour ajouter une photo** : fournir l'original le plus grand possible (au moins 1600 px
de large), en paysage. La compression et les déclinaisons se refont avec le même
traitement — qualité 82 en JPEG, 80 en WebP.

⚠️ **Droits** : chaque photo publiée doit être libre de droits pour un usage commercial,
ou couverte par une licence achetée. Une photo de commerçant identifiable exige en outre
son autorisation écrite (droit à l'image). C'est le premier reproche qu'on adresse aux
sites de jeunes entreprises, et il coûte cher.

### Rythme des sections

Toutes les pages emploient le même en-tête de section, `.section-head` — surtitre, titre,
chapô — suivi du contenu. C'est ce composant unique qui donne au site sa régularité :
aucune page n'invente son propre espacement.

### Architecture des tokens

Tout est dans `assets/css/tokens.css`, en deux couches : la **palette brute**
(`--blue-500`, `--n-100`…) puis les **rôles sémantiques** (`--bg`, `--text`, `--primary`,
`--border`…). Aucun composant n'appelle une couleur brute, sauf les blocs qui doivent
délibérément rester identiques dans les deux thèmes.

Le mode sombre a deux déclencheurs : préférence système et choix explicite via
`data-theme` (bouton ◐, mémorisé). Il ne redéfinit que les rôles.

Le ton rédactionnel est le **tutoiement**, cohérent avec un service de quartier.

---

## Structure des fichiers

```
index.html  comment-ca-marche.html  villes.html  commercants.html
mission.html  faq.html  aide.html
villes/     exemple-ville.html
legal/      mentions-legales.html  confidentialite.html  cgu.html  cgv.html  cookies.html
assets/css/ tokens.css  base.css  components.css
assets/js/  main.js
assets/img/ logo.svg
```

---

## À faire avant mise en ligne

### Contenu
- [ ] Remplacer les **chiffres d'impact** (12 400 produits, 340 commerçants, 8 t de CO₂) par les vrais, ou retirer la section
- [ ] Remplacer les **villes d'illustration** — tant qu'aucune ville n'est ouverte, ne garder que le formulaire de demande
- [ ] Remplacer les **témoignages** par de vrais, avec accord écrit des personnes citées
- [ ] Remplacer la **maquette du téléphone** par de vraies captures
- [ ] Fixer et afficher le **taux de commission** et la **périodicité de reversement** (`commercants.html`)
- [ ] Mettre les **vrais liens** App Store et Google Play
- [ ] Ajouter une **image Open Graph** (1200 × 630)

### Technique
- [ ] Brancher les **quatre formulaires** (ville, commerçant, aide, recherche de ville) sur un service d'envoi
- [ ] Installer un **bandeau cookies** conforme si des traceurs non essentiels sont ajoutés

### Juridique — à ne pas sous-estimer
- [ ] Faire **rédiger les CGV par un juriste** : vente, retrait, annulation, remboursement, allergènes, droit de rétractation
- [ ] Compléter tous les **champs surlignés** des pages légales
- [ ] Adhérer à un **médiateur de la consommation** (obligatoire, article L.612-1)
- [ ] **Encaissement pour compte de tiers** : encaisser l'argent des clients puis le reverser aux commerçants est une activité réglementée. Elle passe normalement par un prestataire de paiement en configuration place de marché (Stripe Connect, Mangopay, Lemonway…), ou par un statut d'agent déclaré auprès de l'ACPR. À cadrer **avant** le lancement, pas après.
- [ ] Vérifier les règles d'**annonce de réduction de prix** : le prix barré doit correspondre à un prix réellement pratiqué

### Marque
- [ ] Vérifier la disponibilité de `dealpick.app` et `dealpick.io` chez un registrar
- [ ] Recherche d'antériorité **INPI / TMview** en classes 9, 35 et 42

## Note sur le nom

« Dealpick » est **descriptif** : facile à comprendre, difficile à protéger comme marque
et concurrentiel en référencement. Choix assumé, à garder en tête si la marque prend de
la valeur.
