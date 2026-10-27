"""Guide d'usage du symbole (une page) : construction, protection, tailles, couleurs, fonds,
interdits, fichiers.

    python3 guide.py            # écrit ../kit/guide-symbole.html (puis render.js pour PNG/PDF)
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from svgkit import f  # noqa: E402
from variantes_c import S, biseau  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(HERE, "..", "kit")
ROOT_SITE = os.path.join(HERE, "..", "..", "..")
MARINE, ROSE, FRAMBOISE, ENCRE = "#13294B", "#FBE3E8", "#E11D48", "#191614"

M = S(44, 36, 184, 180, 44, 36, 40, 16, 12)
D_MASTER = " ".join(biseau(M, 18, 60, foot=0))
D_INV = " ".join(biseau(S(44, 36, 184, 180, 42.5, 35, 39, 16, 12), 18.5, 60, foot=0))


def svg(d, fill, w, extra="", style=""):
    return (f'<svg viewBox="0 0 256 256" width="{w}" height="{w}" style="display:block;{style}">'
            f'<path fill="{fill}" fill-rule="evenodd" d="{d}"/>{extra}</svg>')


def d_plein(s):
    """D sans coupe (pour l'exemple « ne pas combler les coupes »)."""
    x0, y0, y1, cx, R, rc, ri, xl = s.x0, s.y0, s.y1, s.cx, s.R, s.rc, s.ri, s.xl
    outer = (f"M{f(x0 + rc)} {f(y0)} H{f(cx)} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(y1)} H{f(x0 + rc)} "
             f"A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(y1 - rc)} V{f(y0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(y0)} Z")
    inner = (f"M{f(xl + ri)} {f(s.yt)} H{f(cx)} A{f(s.rx)} {f(s.ry)} 0 0 1 {f(cx)} {f(s.yb)} H{f(xl + ri)} "
             f"A{f(ri)} {f(ri)} 0 0 1 {f(xl)} {f(s.yb - ri)} V{f(s.yt + ri)} A{f(ri)} {f(ri)} 0 0 1 {f(xl + ri)} {f(s.yt)} Z")
    return outer + " " + inner


def construction():
    """Surimpression : droites des coupes prolongées, points de tangence, cotes."""
    t = math.tan(math.radians(60))
    h = 9 / math.sin(math.radians(60))

    def line(px, py):
        # droite « / » à 60° passant par (px, py), prolongée sur tout le canevas
        xa, xb = px - (256 - py) / t, px + py / t
        return f'<line x1="{f(xa)}" y1="256" x2="{f(xb)}" y2="0" stroke="{FRAMBOISE}" stroke-width=".8" stroke-dasharray="3 2"/>'

    cx, y0, yt, xl, y1 = M.cx, M.y0, M.yt, M.xl, M.y1
    lines = line(cx, y0) + line(cx, yt) + line(xl, y1) + line(xl + 2 * h, y1)
    dots = "".join(f'<circle cx="{f(x)}" cy="{f(y)}" r="2.4" fill="#fff" stroke="{FRAMBOISE}" stroke-width="1"/>'
                   for x, y in ((cx, y0), (cx, yt), (xl, y1)))
    guides = (f'<line x1="0" y1="{y0}" x2="256" y2="{y0}" stroke="#9aa4b8" stroke-width=".5"/>'
              f'<line x1="0" y1="{y1}" x2="256" y2="{y1}" stroke="#9aa4b8" stroke-width=".5"/>'
              f'<circle cx="{cx}" cy="{M.cy}" r="{M.R}" fill="none" stroke="#9aa4b8" stroke-width=".5" stroke-dasharray="2 2"/>'
              f'<line x1="{cx}" y1="20" x2="{cx}" y2="236" stroke="#9aa4b8" stroke-width=".5"/>')
    label = lambda x, y, s, anchor="start": (f'<text x="{f(x)}" y="{f(y)}" font-size="7.5" font-family="-apple-system,sans-serif" '  # noqa: E731
                                            f'fill="{ENCRE}" text-anchor="{anchor}">{s}</text>')
    labels = (label(cx + 6, 30, "points de tangence") + label(66, 246, "60°") + label(226, 128, "R 92")
              + label(22, 128, "44", "end") + label(70, 31, "36"))
    return guides + lines + dots + labels


def main():
    rel = lambda p: os.path.relpath(p, KIT)  # noqa: E731
    photo = rel(os.path.join(ROOT_SITE, "assets", "img", "photos", "commercante-600.jpg"))
    photo2 = rel(os.path.join(ROOT_SITE, "assets", "img", "photos", "coiffeur-640.jpg"))
    W = 1240
    big = svg(D_MASTER, MARINE, 400, construction(), "background:#fafafa;border-radius:14px")
    x = 44  # zone de protection = épaisseur du montant
    prot = (f'<svg viewBox="-{x} -{x} {256 + 2 * x} {256 + 2 * x}" width="250" height="250" style="display:block">'
            f'<rect x="{M.x0 - x}" y="{M.y0 - x}" width="{180 + 2 * x}" height="{184 + 2 * x}" fill="{ROSE}"/>'
            f'<rect x="{M.x0}" y="{M.y0}" width="180" height="184" fill="none" stroke="#9aa4b8" stroke-width="1" stroke-dasharray="3 2"/>'
            f'<path fill="{MARINE}" fill-rule="evenodd" d="{D_MASTER}"/>'
            f'<rect x="{M.x0 - x}" y="{M.y0 - x}" width="{x}" height="{x}" fill="none" stroke="{FRAMBOISE}" stroke-width="1.2"/>'
            f'<text x="{M.x0 - x / 2}" y="{M.y0 - x / 2 + 4}" font-size="13" text-anchor="middle" fill="{FRAMBOISE}" '
            f'font-family="-apple-system,sans-serif">x</text></svg>')
    swatches = [
        ("Marine", MARINE, "19 · 41 · 75", "75 · 45 · 0 · 71", "proche 2767 C", "Symbole, textes forts", "#fff"),
        ("Rosé", ROSE, "251 · 227 · 232", "0 · 10 · 8 · 2", "proche 705 C", "Fonds, aplats doux", ENCRE),
        ("Framboise", FRAMBOISE, "225 · 29 · 72", "0 · 87 · 68 · 12", "à choisir sur nuancier", "Boutons, prix (pas le symbole)", "#fff"),
        ("Encre", ENCRE, "25 · 22 · 20", "0 · 12 · 20 · 90", "—", "Texte courant", "#fff"),
        ("Blanc", "#FFFFFF", "255 · 255 · 255", "0 · 0 · 0 · 0", "—", "Fonds, symbole inversé", ENCRE),
    ]
    sw = "".join(
        f'<div class="sw"><div class="chip" style="background:{h};color:{fg};{"border:1px solid #e5e5e5;" if h == "#FFFFFF" else ""}">'
        f'<b>{n}</b><span>{h}</span></div><dl><dt>RVB</dt><dd>{rgb}</dd><dt>CMJN</dt><dd>{cmyk}</dd>'
        f'<dt>Pantone</dt><dd>{pms}</dd></dl><p>{role}</p></div>'
        for n, h, rgb, cmyk, pms, role, fg in swatches)
    fonds = [
        (svg(D_MASTER, MARINE, 92), "#fff", "Marine sur blanc", True),
        (svg(D_MASTER, MARINE, 92), ROSE, "Marine sur rosé", True),
        (svg(D_INV, "#fff", 92), MARINE, "Blanc (fichier inversé) sur marine", True),
        (svg(D_INV, ROSE, 92), MARINE, "Rosé sur marine", True),
        (svg(D_INV, "#fff", 92), f"linear-gradient(rgba(19,41,75,.62),rgba(19,41,75,.62)), url({photo}) center/cover",
         "Blanc sur photo, sous un voile marine", True),
        (svg(D_MASTER, "#000", 92), "#fff", "Noir : impression une couleur", True),
    ]
    fd = "".join(f'<div class="ex"><div class="exbox" style="background:{bg}">{s}</div><p>{t}</p></div>' for s, bg, t, _ in fonds)
    interdits = [
        (svg(D_MASTER, MARINE, 84, style="transform:rotate(-14deg)"), "#fff", "Pivoter"),
        (svg(D_MASTER, MARINE, 84, style="transform:scaleX(1.35)"), "#fff", "Déformer"),
        (svg(d_plein(M), MARINE, 84), "#fff", "Combler les coupes"),
        (svg(" ".join(biseau(M, 18, 75, foot=0)), MARINE, 84), "#fff", "Changer l’angle"),
        (f'<svg viewBox="0 0 256 256" width="84" height="84" style="display:block"><path fill="none" stroke="{MARINE}" '
         f'stroke-width="5" d="{D_MASTER}"/></svg>', "#fff", "Contour seul"),
        (svg(D_MASTER, FRAMBOISE, 84), "#fff", "Framboise"),
        (svg(D_MASTER, MARINE, 84, style="filter:drop-shadow(4px 6px 4px rgba(0,0,0,.35))"), "#fff", "Ombre, effets"),
        (svg(D_MASTER, MARINE, 84), f"url({photo2}) center/cover", "Fond chargé"),
    ]
    nd = "".join(f'<div class="ex no"><div class="exbox" style="background:{bg}">{s}</div><p>{t}</p></div>' for s, bg, t in interdits)
    html = f"""<!doctype html><html lang="fr"><meta charset="utf-8"><title>Symbole — règles d’usage</title>
<style>
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: #fff; color: {ENCRE}; font: 13px/1.5 -apple-system, 'Segoe UI', Roboto, sans-serif; }}
.page {{ width: {W}px; padding: 56px 64px 44px; }}
header {{ display: flex; align-items: center; gap: 20px; border-bottom: 1px solid #eee; padding-bottom: 22px; }}
h1 {{ font-size: 28px; margin: 0; letter-spacing: -.015em; }}
header p {{ margin: 2px 0 0; color: #777; }}
h2 {{ font-size: 15px; margin: 30px 0 12px; }}
.two {{ display: grid; grid-template-columns: 400px 1fr; gap: 36px; align-items: start; }}
.facts {{ display: grid; grid-template-columns: 150px 1fr; gap: 6px 14px; margin: 0; }}
.facts dt {{ color: #888; }} .facts dd {{ margin: 0; }}
.idea {{ font-size: 15px; margin: 0 0 18px; max-width: 34em; }}
table {{ border-collapse: collapse; width: 100%; }}
td, th {{ text-align: left; padding: 6px 10px 6px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top; }}
th {{ color: #888; font-weight: 500; }}
.sws {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }}
.chip {{ height: 92px; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; justify-content: flex-end; }}
.chip b {{ font-size: 14px; }} .chip span {{ font: 12px ui-monospace, Menlo, monospace; opacity: .9; }}
.sw dl {{ display: grid; grid-template-columns: 58px 1fr; gap: 2px 8px; margin: 10px 0 4px; font-size: 12px; }}
.sw dt {{ color: #999; }} .sw dd {{ margin: 0; }}
.sw p {{ margin: 0; font-size: 12px; color: #555; }}
.exs {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }}
.nos {{ display: grid; grid-template-columns: repeat(8, 1fr); gap: 12px; }}
.exbox {{ height: 128px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid #eee; overflow: hidden; }}
.ex p {{ margin: 6px 0 0; font-size: 12px; color: #555; }}
.no .exbox {{ height: 112px; position: relative; }}
.no .exbox::after {{ content: ""; position: absolute; inset: 0; background:
  linear-gradient(45deg, transparent 48.5%, {FRAMBOISE} 48.5%, {FRAMBOISE} 51.5%, transparent 51.5%); opacity: .85; }}
.files td:first-child {{ font: 12px ui-monospace, Menlo, monospace; white-space: nowrap; padding-right: 18px; }}
.foot {{ margin-top: 26px; padding-top: 14px; border-top: 1px solid #eee; color: #777; font-size: 11.5px; }}
</style><body><div class="page">
<header>{svg(D_MASTER, MARINE, 64)}<div><h1>Symbole — règles d’usage</h1>
<p>Concept C1 « le deal ». Valable pour Dealpick comme pour Dealmarket. Version 1, octobre 2026 : symbole seul, wordmark à venir.</p></div></header>

<div class="two" style="margin-top:28px">
  <div>{big}</div>
  <div>
    <h2 style="margin-top:0">L’idée</h2>
    <p class="idea">Deux pièces s’emboîtent pour former le D : l’une droite et ancrée, le commerçant ; l’autre ronde, le client.
    Les deux coupes parallèles les font glisser l’une dans l’autre : un deal, gagnant des deux côtés.</p>
    <h2>Construction (canevas 256)</h2>
    <dl class="facts">
      <dt>D</dt><dd>184 de haut, 180 de large ; panse extérieure en demi-cercle de rayon 92</dd>
      <dt>Épaisseurs</dt><dd>montant 44 · barres 36 · panse 40 à trois heures (correction optique)</dd>
      <dt>Coins</dt><dd>rayon 16 à l’extérieur du montant, 12 à l’intérieur</dd>
      <dt>Coupes</dt><dd>deux coupes parallèles à 60° ; jour de 18 = 36 × cos 60°</dd>
      <dt>Repères</dt><dd>la coupe haute passe exactement par les deux points de tangence ; la coupe basse part du pied du montant</dd>
      <dt>Inversé</dt><dd>sur fond foncé, utiliser le fichier « blanc » ou « rosé » : traits amincis d’environ 3 %</dd>
      <dt>Petite taille</dt><dd>sous 24 px ou 8 mm, version petite taille : plus grasse (montant 52, barres 44), jour de 22</dd>
    </dl>
    <div style="display:grid;grid-template-columns:250px 1fr;gap:28px;margin-top:20px;align-items:start">
      <div><h2 style="margin-top:0">Zone de protection</h2>{prot}<p style="margin:-14px 0 0;color:#555">x = épaisseur du montant, sur les quatre côtés. Rien n’y entre.</p></div>
      <div><h2 style="margin-top:0">Tailles minimales</h2>
        <table><tr><th></th><th>Écran</th><th>Impression</th></tr>
          <tr><td>Symbole</td><td>24 px</td><td>6 mm de haut</td></tr>
          <tr><td>Version petite taille</td><td>16 à 23 px</td><td>4 à 8 mm</td></tr>
          <tr><td>Vinyle découpé (vitrophanie)</td><td>—</td><td>12 mm (jour ≥ 1 mm)</td></tr>
        </table>
        <p style="color:#555;margin:10px 0 0">En dessous de 16 px, ne pas utiliser le symbole.</p>
      </div>
    </div>
  </div>
</div>

<h2>Couleurs</h2>
<div class="sws">{sw}</div>
<table style="margin-top:14px"><tr><th>Contraste (WCAG)</th><th>Marine sur blanc</th><th>Marine sur rosé</th><th>Framboise sur blanc</th>
<th>Framboise sur rosé</th><th>Framboise sur marine</th></tr>
<tr><td></td><td>14,5:1</td><td>11,9:1</td><td>4,7:1</td><td>3,9:1 (grands éléments seulement)</td><td>3,1:1 (à éviter)</td></tr></table>

<h2>Fonds autorisés</h2>
<div class="exs">{fd}</div>

<h2>À ne pas faire</h2>
<div class="nos">{nd}</div>

<h2>Fichiers</h2>
<table class="files">
<tr><td>svg/symbole-marine.svg · -noir · -blanc · -rose</td><td>Masters vectoriels. Blanc et rosé : fichiers inversés, pour fonds foncés.</td></tr>
<tr><td>svg/symbole-petit-*.svg</td><td>Version petite taille (16 à 23 px, 4 à 8 mm).</td></tr>
<tr><td>svg/icone-app.svg · png/icone-app-1024.png</td><td>Icône d’app pleine page (App Store, Play Store) : le système arrondit les coins.</td></tr>
<tr><td>web/favicon.ico · favicon.svg</td><td>Favicon 16/32/48 ; le SVG passe au rosé en mode sombre.</td></tr>
<tr><td>web/apple-touch-icon.png · icon-192/512 · icon-maskable-512</td><td>Icônes d’écran d’accueil iOS et Android, manifeste site.webmanifest.</td></tr>
</table>

<p class="foot">CMJN : conversion théorique depuis le sRVB, à caler sur épreuve chez l’imprimeur ; références Pantone approchantes, à vérifier
sur nuancier. Avant tout dépôt ou impression : recherche d’antériorité à l’INPI et à l’EUIPO. Le wordmark et les lockups seront ajoutés
une fois le nom arrêté.</p>
</div></body></html>"""
    out = os.path.join(KIT, "guide-symbole.html")
    open(out, "w").write(html)
    print("écrit", out)


if __name__ == "__main__":
    main()
