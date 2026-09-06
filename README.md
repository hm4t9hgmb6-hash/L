# Dealpick — site web

Site de **Dealpick**, place de marché locale des commerces indépendants : restaurants,
boulangeries, primeurs, fleuristes et autres commerces de quartier y proposent leurs
invendus et leurs petits prix. L'utilisateur réserve et paie dans l'application, puis
récupère sur place. Dealpick encaisse pour le compte du commerçant et le reverse,
commission déduite. L'application est gratuite pour l'utilisateur.

HTML et CSS statiques, sans build ni dépendance : on ouvre `index.html` et ça fonctionne.
Le tout est repris tel quel si le projet passe plus tard sous un framework ou est recopié
dans un éditeur visuel.

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

## Thème visuel — néo-brutalisme

Parti pris assumé : **bordures noires épaisses, ombres portées franches sans flou,
aplats saturés, typographie lourde.** Le contraire d'un site propre et lisse — et c'est
volontaire : le service parle de quartier, de commerces de rue, de récup'. Un design
policé sonnerait faux.

### Palette

| Rôle | Valeur | Usage |
|---|---|---|
| Noir profond | `#1A1A1A` | Texte et **toutes** les bordures |
| Blanc cassé | `#FAF7F0` | Fond général |
| Bleu électrique | `#2E5EFF` | Couleur principale, boutons, tunnel commerçant |
| Jaune vif | `#F4C531` | Héros, blocs de mise en avant, chiffres |
| Corail | `#FF6B4A` | Réductions et urgence, uniquement |
| Citron acide | `#C7F04A` | Économie réalisée, surlignage |

### Typographie

**Archivo Black** pour les titres (une seule graisse, très lourde, capitales pour les
`h1`), **Space Grotesk** pour le texte courant et l'interface. Les deux sur Google Fonts,
avec repli système.

### Les règles du système

- Tout objet détaché ou cliquable porte une **bordure noire de 3 px** et une **ombre
  franche sans flou** (`5px 5px 0`).
- Les boutons **s'enfoncent** au clic : l'ombre se réduit, l'élément se décale.
- Les blocs colorés (cartes, étapes) alternent selon leur position, pas au hasard.
- Les couleurs d'aplat sont **fixes dans les deux thèmes** : un bloc citron reste citron
  en mode sombre, avec du texte noir. Seuls les fonds, textes et bordures basculent.
- Le corail reste **réservé aux réductions**. Employé partout, il ne signalerait plus rien.
- Le tunnel commerçant a son propre héros bleu, pour qu'on sache instantanément de quel
  côté du site on se trouve.

### Architecture des tokens

Tout est dans `assets/css/tokens.css`, en deux couches : la **palette brute**
(`--blue`, `--yellow`, `--ink`…) puis les **rôles sémantiques** (`--bg`, `--text`,
`--primary`, `--border`…). Aucun composant n'appelle une couleur brute, sauf les blocs
qui doivent délibérément rester identiques dans les deux thèmes.

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
