# Phoenix Empire — site et réservation en ligne

Site du studio d'enregistrement **Phoenix Empire** : vitrine (studios, services, tarifs, FAQ,
accès) et **réservation en ligne avec paiement**. Le client choisit un studio, une durée, un
jour et une heure parmi les créneaux libres, ajoute des options, puis paie un acompte ou la
totalité par carte via Stripe. Il reçoit sa confirmation par e-mail et peut annuler lui-même
jusqu'à 48 h avant, avec remboursement automatique.

Le studio gère tout depuis **`/admin`** : planning de la semaine, liste des réservations,
réservations prises par téléphone, fermetures (congés, maintenance), annulations et
remboursements.

---

## Démarrer en 2 minutes (sur ton ordinateur)

Il faut [Node.js](https://nodejs.org) **22.13 ou plus récent**.

```bash
cd phoenix-empire
npm install
cp .env.example .env      # puis ouvre .env et change ADMIN_PASSWORD
npm start
```

Ouvre <http://localhost:3000>. Sans clé Stripe, le site tourne en **mode démo** : la page de
paiement est simulée, rien n'est débité. Les e-mails ne partent pas : ils sont copiés dans
`data/outbox/` (ouvre-les dans un navigateur pour les voir).

`npm test` lance les tests automatiques (créneaux, prix, double réservation, paiement,
annulation, webhook Stripe).

---

## Modifier le contenu : un seul fichier

Tout ce qui change d'un studio à l'autre est dans **`config/studio.json`**. Le site, les prix
affichés et les prix facturés en sont tirés : impossible d'afficher un prix et d'en encaisser
un autre. Redémarre le serveur après chaque modification.

| Clé | Ce que ça règle |
|---|---|
| `studio` | Nom, ville, e-mail, téléphone, adresse, accès, lien Google Maps, réseaux sociaux |
| `hours` | Horaires par jour (`["10:00", "02:00"]` = ouvert jusqu'à 2 h du matin ; `null` = fermé) |
| `closures` | Jours fériés ou fermetures fixes (`"2026-12-25"`) |
| `booking.slotStepMinutes` | Pas entre deux heures de début (60 = toutes les heures) |
| `booking.minNoticeHours` | Délai minimum avant une session réservée en ligne |
| `booking.maxAdvanceDays` | Jusqu'à combien de jours à l'avance on peut réserver |
| `booking.bufferMinutes` | Battement entre deux sessions dans un même studio |
| `booking.freeCancellationHours` | Délai d'annulation gratuite (48 h par défaut) |
| `payment.depositPercent` | Pourcentage de l'acompte (0 = paiement total obligatoire) |
| `payment.allowFullPayment` | Proposer aussi de tout payer en ligne |
| `engineer.count` / `hourly` | Nombre d'ingés son disponibles en même temps et prix horaire de l'option |
| `rooms` | Les studios : nom, description, surface, capacité, matériel, couleur, **tarifs par durée** |
| `rooms[].engineer` | `"included"` (ingé inclus et obligatoire), `"optional"` (option payante) ou `"none"` |
| `rooms[].prices` | `{ "1": 35, "2": 64, "4": 120 }` → durées proposées et prix TTC de chacune |
| `rooms[].image` | Chemin d'une vraie photo (ex. `"/assets/img/studios/ignis.jpg"`) à la place de l'illustration |
| `extras` | Options vendues avec la session (mix, mastering, vidéo…) |
| `services`, `faq`, `testimonials` | Textes de l'accueil. Les avis restent masqués tant que la liste est vide |
| `legal` | Raison sociale, SIRET, hébergeur… utilisés par les pages légales |

Les champs encore à remplir apparaissent **surlignés en jaune** sur les pages légales.

**Photos.** Dépose les photos des studios dans `public/assets/img/studios/` (format paysage,
1600 × 1280 px environ, en `.jpg` ou `.webp`), puis indique leur chemin dans `rooms[].image`.

---

## Brancher le paiement Stripe

1. Crée un compte sur <https://stripe.com> (gratuit, commission par paiement uniquement).
2. **Mode test d'abord.** Dans *Développeurs → Clés API*, copie la clé secrète `sk_test_…` dans
   `STRIPE_SECRET_KEY`.
3. **Webhook** : c'est ce qui confirme une réservation dès que le paiement passe.
   - En ligne : *Développeurs → Webhooks → Ajouter un endpoint*, URL
     `https://TON-DOMAINE/api/stripe/webhook`, événements `checkout.session.completed`,
     `checkout.session.async_payment_succeeded` et `checkout.session.expired`. Copie le
     « secret de signature » `whsec_…` dans `STRIPE_WEBHOOK_SECRET`.
   - En local : installe la [Stripe CLI](https://stripe.com/docs/stripe-cli) puis
     `stripe listen --forward-to localhost:3000/api/stripe/webhook` ; elle affiche le `whsec_…`.
4. Fais une réservation avec la carte de test `4242 4242 4242 4242` (date future, n'importe
   quel CVC). La réservation doit passer en « Confirmée » dans `/admin`.
5. Quand tout marche, active ton compte Stripe (infos de la société, IBAN) et remplace les
   clés par les clés **live** (`sk_live_…` et un nouveau webhook en mode live).

Ce qui est déjà géré :

- le créneau est **bloqué pendant le paiement** (33 min max) puis libéré s'il n'est pas payé ;
- si le client ferme la page Stripe, le créneau est libéré immédiatement ;
- si un paiement arrive en retard sur un créneau repris entre-temps, il est **remboursé
  automatiquement** ;
- si le webhook tarde, la page de confirmation interroge Stripe directement ;
- les montants sont toujours recalculés côté serveur : le navigateur n'envoie jamais de prix.

---

## Envoyer les e-mails

N'importe quel service SMTP fonctionne. Exemples : **Brevo** (gratuit jusqu'à 300 e-mails par jour),
la messagerie de ton hébergeur (OVH, o2switch…), ou Gmail avec un « mot de passe
d'application ».

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=ton-identifiant
SMTP_PASS=ta-cle-smtp
MAIL_FROM="Phoenix Empire <reservations@phoenix-empire.fr>"
```

E-mails envoyés : confirmation au client (avec le fichier agenda `.ics` et le lien de
gestion), alerte de nouvelle réservation au studio, confirmation d'annulation, et
remboursement en cas de conflit.

---

## Mettre en ligne

Le site a besoin d'un **serveur Node.js avec un disque persistant** (la base de données est un
fichier SQLite). Un hébergement « statique » de type Netlify, GitHub Pages ou Vercel ne suffit pas.

**Option simple : Render** (environ 7 $/mois avec disque)
1. Mets le dossier `phoenix-empire` dans son propre dépôt GitHub (recommandé), ou garde-le
   ici et indique `phoenix-empire/render.yaml` comme chemin du Blueprint.
2. Sur Render : *New → Blueprint*, choisis le dépôt. Le fichier `render.yaml` crée le
   service et le disque.
3. Renseigne les variables demandées (`BASE_URL`, `ADMIN_PASSWORD`, clés Stripe, SMTP).
4. Ajoute ton nom de domaine dans *Settings → Custom Domains* (HTTPS automatique), puis mets
   ce domaine dans `BASE_URL` et dans l'URL du webhook Stripe.

**Option VPS** (OVH, Hostinger, Scaleway… à partir de 4 €/mois) avec Docker :

```bash
docker build -t phoenix-empire .
docker run -d --name phoenix --restart unless-stopped -p 3000:3000 \
  --env-file .env -v phoenix-data:/data phoenix-empire
```

Place un reverse proxy HTTPS devant, par exemple Caddy : `phoenix-empire.fr { reverse_proxy localhost:3000 }`.

**Sauvegardes.** Toute l'activité est dans `DATA_DIR/phoenix.sqlite`. Copie ce fichier
régulièrement (Render propose des instantanés du disque).

---

## Aperçu sans serveur

`node scripts/build-preview.js <dossier>` produit une version statique du site (pages,
styles, scripts) où l'API est simulée dans le navigateur, avec le même code de calcul que le
serveur. C'est pratique pour montrer le site avant la mise en ligne : les réservations restent
dans le navigateur de chaque visiteur, rien n'est envoyé ni encaissé, et le mot de passe de
l'espace studio est `demo`.

---

## Avant le lancement : liste de vérification

- [ ] Vrais horaires, tarifs, matériel et textes dans `config/studio.json`
- [ ] Vraies photos des studios (`rooms[].image`)
- [ ] Mentions légales complétées : raison sociale, SIRET, TVA, directeur de publication,
      hébergeur, médiateur de la consommation (obligatoire pour vendre à des particuliers)
- [ ] CGV relues, idéalement par un professionnel (annulation, droit de rétractation)
- [ ] `ADMIN_PASSWORD` long et unique, `NODE_ENV=production`
- [ ] Une réservation de bout en bout en mode test Stripe, puis passage aux clés live
- [ ] SMTP configuré, e-mail de confirmation reçu (vérifie aussi les spams)
- [ ] Domaine en HTTPS et `BASE_URL` à jour

---

## Organisation du code

```
phoenix-empire/
├── config/studio.json     Contenu, horaires, studios, tarifs (à modifier)
├── server.js              Serveur web et API
├── src/
│   ├── availability.js    Calcul des créneaux libres (conflits, ingés son, délais)
│   ├── bookings.js        Création, paiement, annulation, remboursement
│   ├── payments.js        Stripe Checkout (ou mode démo)
│   ├── pricing.js         Calcul des prix et de l'acompte
│   ├── mailer.js          E-mails transactionnels
│   ├── ics.js             Fichier agenda et lien Google Agenda
│   ├── render.js          Injection du contenu dans les pages HTML
│   ├── db.js              Base SQLite (module intégré à Node)
│   └── time.js            Heures du studio (fuseau Europe/Paris)
├── public/                Pages, styles, scripts, logo, polices
└── test/                  Tests automatiques (npm test)
```

Aucun service tiers en dehors de Stripe et du SMTP : pas de traceur, pas de cookie
publicitaire, polices hébergées sur le site (pas d'appel à Google Fonts).
