# Dealpick — site web

Site vitrine de l'application mobile **Dealpick** : agrégateur de promotions qui écarte
les fausses réductions, côté grand public, avec un espace commerçants.

HTML et CSS statiques, sans build ni dépendance. On ouvre `index.html` dans un navigateur
et ça fonctionne. Le jour où le projet passe sous un framework (Next.js, Astro…), la
structure et les tokens se reprennent tels quels.

---

## Structure du site

| Page | Fichier | Rôle |
|---|---|---|
| Accueil | `index.html` | Héros, promesse, preuve, fonctionnement, commerçants, FAQ courte, téléchargement |
| Fonctionnalités | `fonctionnalites.html` | Le détail de ce que fait l'app |
| Commerçants | `commercants.html` | Entrée B2B : bénéfices, formules, formulaire de contact |
| FAQ | `faq.html` | Questions classées par thème (app, offres, données, commerçants) |
| Aide | `support.html` | Contact, signalement d'une offre, questions de compte |
| Mentions légales | `legal/mentions-legales.html` | Obligatoire (LCEN art. 6 III) |
| Confidentialité | `legal/confidentialite.html` | Obligatoire pour publier sur l'App Store et Google Play |
| CGU | `legal/cgu.html` | Cadre d'utilisation, responsabilité, comptes commerçants |

Deux entrées distinctes assumées dès la navigation : **« je cherche des bons plans »**
(accueil, fonctionnalités) et **« je suis commerçant »** (page dédiée). Les deux publics
n'ont ni les mêmes questions ni les mêmes objections.

### Fichiers

```
index.html, fonctionnalites.html, commercants.html, faq.html, support.html
legal/          mentions-legales.html, confidentialite.html, cgu.html
assets/css/     tokens.css, base.css, components.css
assets/js/      main.js
assets/img/     logo.svg
```

---

## Thème visuel

Le parti pris : **la clarté plutôt que le criard.** Le secteur de la promo abuse du rouge
agressif et du « -70 % » clignotant, ce qui abîme la confiance. Dealpick promet l'inverse —
trier, vérifier, écarter le faux — donc le design doit respirer le sérieux et laisser
l'accent visuel aux vraies réductions.

- **Indigo `#5B54F3`** en couleur principale : moderne, fiable, non alimentaire, et
  surtout pas la couleur du discount.
- **Corail `#FF5A36`** en accent, **strictement réservé** aux badges de réduction et aux
  urgences. Employé partout, il perdrait tout signal.
- **Vert `#0EA46A`** pour l'économie réalisée et les prix planchers.
- Neutres légèrement bleutés, beaucoup d'air, coins largement arrondis, ombres discrètes.
- Typographie **Plus Jakarta Sans** (Google Fonts) avec repli sur la police système.

### Tokens

Tout est centralisé dans `assets/css/tokens.css`, en deux couches :

1. **La palette brute** (`--brand-500`, `--gray-100`…) — les couleurs disponibles.
2. **Les rôles sémantiques** (`--bg`, `--text`, `--primary`, `--border`…) — ce que le reste
   du CSS utilise réellement.

Aucun composant n'appelle une couleur brute. Conséquence : **pour rhabiller tout le site,
on ne touche qu'aux rôles** — et le mode sombre n'a besoin de redéfinir que ces rôles-là,
jamais la palette.

Le mode sombre a deux déclencheurs : la préférence système, et un choix explicite via
l'attribut `data-theme` (bouton ◐ dans l'en-tête, mémorisé en `localStorage`).

Sont également tokenisés : l'échelle typographique, l'espacement (base 4 px), les rayons,
les ombres, la largeur de conteneur et les transitions.

### Changer de marque

Le nom n'est pas figé. Pour en changer :

1. `assets/css/tokens.css` → les variables `--brand-*` et `--accent-*`.
2. `assets/img/logo.svg` → le symbole.
3. Le texte « Dealpick » dans les en-têtes, pieds de page et balises `<title>`.

---

## Accessibilité

Structure sémantique, lien d'évitement, `aria-current` sur la page active, focus visible
sur tous les éléments interactifs, contrastes conformes AA, respect de
`prefers-reduced-motion`, cibles tactiles d'au moins 40 px.

---

## À faire avant mise en ligne

- [ ] Remplacer les **chiffres de la page d'accueil** (1 200 enseignes, 4,8/5…) par les vrais
- [ ] Remplacer la **maquette du téléphone** par de vraies captures de l'application
- [ ] Mettre les **vrais liens** App Store et Google Play
- [ ] Compléter tous les **champs entre crochets** des pages légales (surlignés en corail)
- [ ] Faire relire les **CGU et la politique de confidentialité** par un juriste
- [ ] Brancher les **formulaires** (commerçants et aide) sur un service d'envoi
- [ ] Ajouter une **image Open Graph** (1200 × 630) pour le partage sur les réseaux
- [ ] Vérifier la disponibilité de **`dealpick.app`** et **`dealpick.io`** chez un registrar
- [ ] Rechercher les antériorités **INPI / TMview** en classes 9 et 35 avant dépôt de marque

## Note sur le nom

« Dealpick » est **descriptif** : facile à comprendre, mais difficile à protéger comme
marque et concurrentiel en référencement. Choix assumé — à garder en tête si la marque
prend de la valeur.
