# Logos des commerces

Dépose ici les logos des commerces qui ont **donné leur accord écrit** pour
figurer sur le site.

## Nommage

Un fichier par commerce, en minuscules, sans accent ni espace, le tiret comme
séparateur — c'est le nom qui sera écrit dans le HTML :

```
trattoria-bruno.svg
cordonnerie-vidal.png
salon-elsa.png
```

## Format

- **SVG de préférence** : net à toutes les tailles, quelques kilo-octets.
- Sinon **PNG à fond transparent**, 240 × 240 pixels minimum (le logo
  s'affiche à 40 pixels, mais les écrans Retina en demandent le triple).
- Éviter le JPEG : il ne gère pas la transparence et laisse un carré blanc
  autour du logo.

## Mise en place dans la page

Dans `index.html`, à l'intérieur de la tuile du commerce, remplacer

```html
<svg class="cat-card__sign" aria-hidden="true"><use href="#ic-couvert"/></svg>
```

par

```html
<img class="cat-card__sign" src="assets/img/logos/trattoria-bruno.svg"
     width="40" height="40" alt="">
```

La règle `.cat-card__sign` fixe déjà la taille, le rayon et le centrage :
rien d'autre n'est à toucher.

## Avant de déposer

Un logo de marque n'est pas une image libre. Trois cas à distinguer :

- **Commerce partenaire ayant signé** : autorisation obtenue, on peut
  afficher. La clause d'autorisation doit figurer dans les CGU commerçants.
- **Enseigne réelle non partenaire** : afficher son logo affirme un
  partenariat inexistant. C'est un usage de marque sans droit.
- **Logo acheté en banque d'images** : la licence couvre rarement la
  représentation d'une relation commerciale, et jamais avec le filigrane.
