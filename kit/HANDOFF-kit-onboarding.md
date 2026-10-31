# HANDOFF — Merchant Onboarding Kit (dealmarket)

> Paste this file at the repo root (or `/kit/`) and tell Claude Code: "Read HANDOFF-kit-onboarding.md and start with the next pending section."

## 1. Context

- **Product:** dealmarket (formerly Dealpick). Local deals + reservation app for independent brick-and-mortar businesses in France. Merchants publish discounts on their off-peak hours, nearby customers book.
- **Brand name:** always `dealmarket`, lowercase.
- **Launch:** Lyon first (field prospecting: Lyon 1er & 2e — Presqu'île, Terreaux, Hôtel de Ville, bas des Pentes, Guillotière). Upcoming cities: Nantes, Lille, Toulouse.
- **Who uses the kit:** the founder + a field sales partner, door-to-door with merchants.
- **Payments:** Stripe.
- **Design rules:** follow `DESIGN.md` (Apple-style direction) and `DETAILS.md` ("details make the difference"), both imported via `CLAUDE.md`. Reuse existing tokens — never invent new ones.
- **Language:** all user-facing copy in French, used verbatim. Prompts/code comments in English.
- **Workflow:** one sub-section at a time. Do not design sections that are not yet specified — leave labeled placeholders.

## 2. Hard rules

- **No invented numbers.** Do not reuse the "150+ commerces / 2 500+ offres" figures from the landing page: they are not real. Any stat must be sourced (e.g. INSEE) or marked "illustratif".
- **Tone:** sober, factual, no satire.
- **French typography:** non-breaking space before `: ; ? !` and between number and unit (`15 h`, `10 %`, `5 €`); typographic apostrophes `’`; French quotes `« »` with non-breaking spaces.
- **Print files:** A5 = `@page { size: 148mm 210mm; margin: 0; }`, 8 mm safe zone, 3 mm bleed on full-bleed backgrounds, mm/pt units. Must also preview correctly on screen.

## 3. Kit structure (6 themes × 5 sub-sections)

Status: ✅ done · 🟡 specified, to build · ⬜ to define

### 1. Field pitch (A5 flyer, recto/verso)
- ✅ 1.1 Hook — off-peak hours problem *(spec below · built in `kit/pitch-a5/`, awaiting review)*
- ⬜ 1.2 How it works, in 3 steps
- ⬜ 1.3 What it earns (sourced INSEE figures + margin-simulator example)
- ⬜ 1.4 What it costs (commission, no fixed fee — **model TBD**)
- ⬜ 1.5 Call to action (sign-up QR + sales contact)

### 2. Sign-up flow
- ⬜ 2.1 First contact & account creation
- ⬜ 2.2 Business info (name, address, hours, photos)
- ⬜ 2.3 Verification (SIRET) & ground rules
- ⬜ 2.4 Payments: Stripe connection
- ⬜ 2.5 Approval & go-live

### 3. Creating your first offer
- ⬜ 3.1 Pick an off-peak slot
- ⬜ 3.2 Set discount & number of spots
- ⬜ 3.3 Write title & description
- ⬜ 3.4 Examples by business type (restaurant, bakery, hair salon…)
- ⬜ 3.5 Publish & track bookings

### 4. In-store materials
- ⬜ 4.1 Window sticker ("Ici, on dealmarket")
- ⬜ 4.2 QR code to the merchant page
- ⬜ 4.3 Counter tent card
- ⬜ 4.4 Mini-flyer for customers
- ⬜ 4.5 Usage guide (sizes, colors, placement)

### 5. FAQ & objections
- ⬜ 5.1 Price & commission objections
- ⬜ 5.2 Fear of devaluing the business
- ⬜ 5.3 No-shows & cancellations
- ⬜ 5.4 Payments & payouts
- ⬜ 5.5 Support & contact

### 6. Legal framework
- ⬜ 6.1 Merchant T&Cs
- ⬜ 6.2 Commission & invoicing
- ⬜ 6.3 Cancellation, refunds, disputes
- ⬜ 6.4 Data & GDPR
- ⬜ 6.5 Termination

> Theme 6 must be reviewed by a lawyer before use.

## 4. Open decisions

- **Format:** print only (PDF), or also web pages on the site? → default for now: print-ready HTML → PDF.
- **Scope:** 6 themes listed; the founder may drop one to keep 5.
- **Commission model:** not defined yet (blocks 1.4, 5.1, 6.2).
- **Alternate 1.1 headlines** (if the main one is rejected):
  - « Un mardi à 15 h, votre commerce est-il plein ? »
  - « Remplissez vos heures creuses. »

## 5. Next task — Section 1.1 "Hook"

Build section 1.1 of the merchant field pitch: a print-ready A5 flyer for door-to-door prospecting in Lyon.

**Files**
- Create `/kit/pitch-a5/index.html` (+ local CSS). Self-contained, no external JS.
- This section takes roughly the top 40 % of the recto. Below it, add empty labeled placeholders for 1.2–1.5.

**Content (top to bottom, French copy verbatim)**
1. Eyebrow: « Pour les commerces indépendants de Lyon »
2. Headline: « Vos heures creuses ont de la valeur. »
3. Subhead: « dealmarket remplit vos tables, vos fauteuils et vos créneaux vides avec des clients du quartier, au moment précis où vous en avez besoin. »
4. Inline SVG bar chart: 13 bars, 8 h → 20 h, typical footfall curve (morning peak, lunch peak, deep dip 14 h–17 h, evening peak). Bars neutral grey; the 14 h–17 h dip in the brand accent. Bracket/label over the dip: « Vos heures creuses ». Hour labels every 2 h. Tiny caption bottom-right: « illustratif ». No y-axis, no gridlines, hairline baseline only.
5. Bridge line: « Vous choisissez quand. Vos clients réservent. Vous encaissez. »

**Details**
- Headline max 2 lines, balanced (`text-wrap: balance`). No widows.
- Apply the French typography rules from §2.
- Print to PDF (A5) and check nothing crosses the safe zone.

**Done when:** PDF export looks clean, nothing outside the safe zone, placeholders 1.2–1.5 visible. Then update the status in §3 (1.1 → ✅) and stop for review.
