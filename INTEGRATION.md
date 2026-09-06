# Guide d'intégration — pour le développeur

Ce dépôt contient le **front statique** de Dealpick : le site public et les écrans du
parcours de commande. Aucune logique métier, aucun appel réseau, aucun secret. Ce
document décrit ce qu'il reste à construire et les pièges à éviter.

---

## 1. Ce qui existe

```
index.html … faq.html      Site public (vitrine, SEO, acquisition)
app/                       Écrans transactionnels
  offres.html              Liste des offres
  offre.html               Fiche offre + réservation
  paiement.html            Récapitulatif + emplacement du module de paiement
  confirmation.html        Code de retrait
  compte.html              Commandes en cours et historique
assets/css/tokens.css      Thème : couleurs, typo, espacement, rayons, ombres
assets/css/components.css  Tous les composants, y compris ceux du parcours d'achat
```

Les emplacements à brancher sont **visibles à l'écran** : ce sont les blocs hachurés
`.hook`. Ils décrivent l'appel attendu et la contrainte associée. À supprimer une fois
l'intégration faite.

Le thème est piloté par des variables CSS. Un front reconstruit en React, Vue ou Svelte
peut importer `tokens.css` tel quel et rester visuellement identique au site public.

---

## 2. La contrainte structurante

Le site est statique. **Un front statique ne peut pas garder de secret** : tout ce qui est
dans la page est lisible par n'importe quel visiteur. Il faut donc un backend, même
minimal (serveur classique ou fonctions serverless), pour :

- créer les intentions de paiement (la clé secrète du prestataire n'apparaît jamais côté client) ;
- réserver le stock de façon atomique ;
- recevoir et vérifier les webhooks de paiement ;
- générer les codes de retrait ;
- calculer et déclencher les reversements aux commerçants.

---

## 3. Modèle de données minimal

```
Commerce      id, nom, type, siret, adresse, lat, lng, ville, horaires,
              compte_psp_id, statut

Offre         id, commerce_id, titre, categorie, description, allergenes,
              prix_reference_cents, prix_cents, quantite_totale,
              quantite_restante, creneau_debut, creneau_fin, statut

Commande      id, offre_id, user_id, quantite, montant_cents,
              commission_cents, montant_commercant_cents,
              statut, code_retrait, expire_le, cree_le

Paiement      id, commande_id, psp, intent_id, statut, montant_cents

Reversement   id, commerce_id, periode, montant_cents, statut, vire_le
```

**Statuts d'une offre** : `brouillon → publiee → epuisee | expiree | retiree`

**Statuts d'une commande** :
`en_attente_paiement → payee → retiree`
avec les branches `expiree` (paiement non abouti), `annulee` (client, dans les délais),
`non_retiree` (créneau passé), `remboursee`.

Les montants sont **en centimes, en entiers**. Jamais de flottant sur de la monnaie.

---

## 4. Surface d'API attendue par les écrans

| Écran | Appel | Remarque |
|---|---|---|
| `app/offres.html` | `GET /api/offres?ville&lat&lng&categorie` | Uniquement `publiee`, `quantite_restante > 0`, `creneau_fin > now` |
| `app/offre.html` | `GET /api/offres/:id` | |
| `app/offre.html` | `POST /api/reservations` | Réserve le stock **et** crée l'intention de paiement |
| `app/paiement.html` | `POST /api/paiements/intention` | Côté serveur uniquement |
| — | `POST /api/webhooks/psp` | Signature vérifiée, source de vérité |
| `app/compte.html` | `GET /api/commandes` | Actives / historique |
| `app/compte.html` | `POST /api/commandes/:id/annuler` | Contrôle du délai côté serveur |
| Site public | `POST /api/villes/demande` | Formulaire « ma ville n'y est pas » |
| Site public | `POST /api/commercants/inscription` | Formulaire commerçant |

---

## 5. Le paiement

### Encaissement pour compte de tiers

Dealpick encaisse puis reverse : c'est une **activité réglementée** en France. En pratique,
on passe par un prestataire en configuration place de marché — Stripe Connect, Mangopay,
Lemonway — qui porte l'agrément et gère les comptes des commerçants, la commission et les
reversements. L'alternative (statut d'agent déclaré à l'ACPR) est nettement plus lourde.
**À cadrer avant d'écrire la première ligne de code de paiement** : le choix détermine le
modèle de données des comptes commerçants.

### Règles non négociables

1. **Jamais de champ carte maison.** Le formulaire de carte appartient au prestataire
   (élément embarqué ou page hébergée). C'est ce qui maintient le projet sur le
   questionnaire PCI-DSS le plus léger.
2. **Aucune clé secrète côté client.** L'intention de paiement se crée sur le serveur.
3. **3-D Secure obligatoire.** L'authentification forte est requise en Europe ; un tunnel
   qui ne la gère pas verra une partie des paiements refusés.
4. **Le webhook fait foi.** La redirection de retour peut être perdue, rejouée ou
   falsifiée : la commande ne passe à `payee` que sur webhook vérifié par signature.
5. **Clés d'idempotence** sur la création de commande et de paiement, sinon un double clic
   ou un rejeu de webhook crée une double commande.
6. **Remboursements** : prévoir le cas « commerce fermé / rien à remettre », qui doit être
   traitable en un geste depuis le back-office.

### Concurrence sur le stock

Le point le plus casse-gueule du projet. Deux clients peuvent viser le dernier panier au
même instant. La réservation doit être **atomique côté base** (`UPDATE … SET
quantite_restante = quantite_restante - 1 WHERE id = ? AND quantite_restante >= 1`, et on
vérifie le nombre de lignes affectées), avec une **expiration courte** de la commande non
payée — 10 minutes — et une tâche qui remet le stock en circulation à l'expiration.

---

## 6. La carte des villes

`villes/exemple-ville.html` contient une carte **schématique en SVG**, qui n'est qu'un
substitut : elle permet de valider la mise en page et l'interaction sans dépendre d'un
serveur de tuiles.

### Ce qui est déjà en place

- Un conteneur `.map` au bon format, avec le cadre et l'ombre du thème.
- Les épingles sont de **vrais boutons HTML** portant `data-pin="1"`, positionnés en
  pourcentage — exactement le rôle qu'auront les marqueurs.
- La liste latérale porte les `data-row` correspondants, et la **synchronisation
  carte ↔ liste fonctionne déjà** : clic sur une épingle, survol d'une ligne, fermeture
  à la touche Échap, bascule de la bulle quand elle sortirait du cadre.

### Le remplacement

Monter la carte dans `.map` et supprimer le `<svg class="map__canvas">`. Le reste de la
page ne bouge pas.

- **MapLibre GL JS** est le choix recommandé : libre, sans clé propriétaire, rendu
  vectoriel, gestion native du regroupement de marqueurs. **Leaflet** convient aussi et
  est plus simple, avec un rendu raster.
- **Attribution obligatoire** si les tuiles viennent d'OpenStreetMap. Google Maps impose
  ses propres conditions et une facturation à l'usage : à trancher avant de coder.
- **Regrouper les marqueurs** au-delà d'une trentaine de points, sinon le centre-ville
  devient une bouillie de pastilles superposées.
- **Ne pas charger la carte au premier rendu** de la page publique : elle pèse lourd et
  cette page est aussi une page de référencement. La charger à l'entrée dans le viewport.

### Données attendues

`GET /api/offres?ville=lyon&bbox=minLng,minLat,maxLng,maxLat` renvoyant par offre :

```json
{
  "id": "off_8412",
  "commerce": { "nom": "Boulangerie Marchand", "lat": 45.7640, "lng": 4.8357 },
  "titre": "Panier surprise viennoiseries",
  "prix_cents": 400,
  "prix_reference_cents": 1000,
  "remise_pct": 60,
  "creneau_debut": "2026-09-06T18:00:00+02:00",
  "creneau_fin": "2026-09-06T19:30:00+02:00",
  "quantite_restante": 3
}
```

La remise affichée sur le marqueur se calcule côté serveur à partir des deux prix, pour
que la carte et la fiche ne puissent jamais diverger.

### Un point de vigilance

Le prix de référence qui sert à calculer la remise doit correspondre à un **prix
réellement pratiqué en boutique**. Une pastille « −60 % » calculée sur un prix théorique
est une pratique commerciale trompeuse — et sur une carte, elle est affichée des milliers
de fois.

---

## 7. Le site et l'application

Le parcours d'achat est en HTML : le même code peut servir sur le web et être embarqué
dans l'application. Trois remarques.

**PWA plutôt que simple page.** Manifeste, service worker, icônes : l'utilisateur peut
installer l'app depuis le navigateur, et tu gagnes les notifications sur Android.

**Attention à la publication sur l'App Store.** Une application qui n'est qu'une coquille
autour d'un site web est régulièrement refusée par Apple pour fonctionnalité insuffisante
(règle 4.2). Il faut au minimum des fonctions natives réelles : notifications push,
géolocalisation en arrière-plan, ajout au portefeuille du code de retrait. À anticiper, pas
à découvrir au moment de la soumission.

**Le paiement par carte est ici légitime.** Les règles d'achat intégré d'Apple visent les
contenus numériques ; les biens physiques et les services consommés en personne — ce qui
est exactement le cas d'un panier récupéré en boutique — doivent au contraire utiliser un
autre moyen de paiement. Pas de commission de 30 % à craindre.

---

## 8. Checklist avant mise en production

- [ ] HTTPS partout, en-têtes de sécurité (CSP, HSTS)
- [ ] Aucune clé secrète dans le front — vérifier le bundle final
- [ ] Webhooks vérifiés par signature, rejeu impossible
- [ ] Réservation de stock atomique + expiration testée en concurrence
- [ ] Idempotence sur commandes et paiements
- [ ] Géolocalisation demandée au bon moment, avec repli sur saisie manuelle de la ville
- [ ] Parcours testé en 3-D Secure, y compris le cas d'échec
- [ ] Suppression de compte réellement fonctionnelle (RGPD)
- [ ] Journalisation des paiements suffisante pour un rapprochement comptable
- [ ] Les blocs `.hook` retirés du HTML livré
- [ ] Carte réelle en place, attribution des tuiles affichée, marqueurs regroupés
