"""Concepts Dealpick / Dealmarket — construction paramétrique en arcs exacts.

Chaque concept est un D dessiné, décliné en deux graisses :
  - « symbole » : canevas 256, D de 184 de haut, montant 44, horizontales 36 ;
  - « lettre »  : D à la graisse de DM Sans Bold (capitale 700 : montant 135,
    horizontales 115, panse 138), qui remplace le D du mot dans les lockups.

    python3 concepts.py v5        # écrit ../concept-{a,b,c}-v5.svg et les lockups
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from glyphs import Font  # noqa: E402
from svgkit import circle, f, path, svg  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..")
FONT = os.environ.get("DP_FONT", "/tmp/claude-0/-home-user-L/096aadd5-c25d-593f-a021-aa8bdc259b70/scratchpad/fonts/DMSans-700.ttf")


class Spec:
    """Gabarit d'un D : origine (x0, y0), hauteur H, largeur W, épaisseurs, rayon des coins."""

    def __init__(self, x0, y0, H, W, ts, th, tb, rc):
        self.x0, self.y0, self.H, self.W = x0, y0, H, W
        self.ts, self.th, self.tb, self.rc = ts, th, tb, rc
        self.R = H / 2
        self.cy = y0 + self.R
        self.y1 = y0 + H
        self.cx = x0 + W - self.R


def outer(s):
    x0, y0, y1, cx, R, rc = s.x0, s.y0, s.y1, s.cx, s.R, s.rc
    return (f"M{f(x0 + rc)} {f(y0)} H{f(cx)} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(y1)} H{f(x0 + rc)} "
            f"A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(y1 - rc)} V{f(y0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(y0)} Z")


def counter(s, xl, rx, ry, ri):
    yt, yb = s.cy - ry, s.cy + ry
    return (f"M{f(xl + ri)} {f(yt)} H{f(s.cx)} A{f(rx)} {f(ry)} 0 0 1 {f(s.cx)} {f(yb)} H{f(xl + ri)} "
            f"A{f(ri)} {f(ri)} 0 0 1 {f(xl)} {f(yb - ri)} V{f(yt + ri)} A{f(ri)} {f(ri)} 0 0 1 {f(xl + ri)} {f(yt)} Z")


# --- A : le créneau rempli -------------------------------------------------------------

def a_width(H, ts, th):
    """Largeur imposée par la construction : montant + partie droite (= rayon intérieur) + R."""
    return ts + (H / 2 - th) + H / 2


def a_paths(s, g, ri):
    """Contreforme : partie droite + demi-cercle de même rayon ri_b = R - th (panse d'épaisseur
    constante th). Pastille concentrique à la panse, rayon ri_b - g : jeu constant g en haut,
    à droite, en bas — et à gauche, car le bord gauche est à ri_b du centre."""
    ri_b = s.R - s.th
    return [outer(s), counter(s, s.cx - ri_b, ri_b, ri_b, ri), circle(s.cx, s.cy, ri_b - g)]


# --- B : la porte ----------------------------------------------------------------------

def b_paths(s, door_w, door_gap, ax_shift):
    """D plein ; sa contreforme est une porte cintrée posée sur le seuil (haut de la barre basse)."""
    ax = s.x0 + s.W / 2 + ax_shift
    r = door_w / 2
    yb = s.y1 - s.th
    top = s.y0 + s.th + door_gap
    door = f"M{f(ax - r)} {f(yb)} V{f(top + r)} A{f(r)} {f(r)} 0 0 1 {f(ax + r)} {f(top + r)} V{f(yb)} Z"
    return [outer(s), door]


# --- C : le deal -----------------------------------------------------------------------

def c_paths(s, g, ri):
    """Anneau coupé deux fois : en haut juste avant le point de tangence de la panse, en bas
    au pied du montant. Pièce droite (montant + barre haute) et pièce ronde (panse + barre basse)."""
    x0, y0, y1, cx, R, rc = s.x0, s.y0, s.y1, s.cx, s.R, s.rc
    xl = x0 + s.ts
    rx, ry = R - s.tb, R - s.th
    yt, yb = s.cy - ry, s.cy + ry
    p1 = (f"M{f(x0 + rc)} {f(y0)} H{f(cx - g)} V{f(yt)} H{f(xl + ri)} A{f(ri)} {f(ri)} 0 0 0 {f(xl)} {f(yt + ri)} "
          f"V{f(y1)} H{f(x0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(y1 - rc)} V{f(y0 + rc)} "
          f"A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(y0)} Z")
    p2 = (f"M{f(cx)} {f(y0)} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(y1)} H{f(xl + g)} V{f(yb)} H{f(cx)} "
          f"A{f(rx)} {f(ry)} 0 0 0 {f(cx)} {f(yt)} Z")
    return [p1, p2]


# --- déclinaisons ------------------------------------------------------------------------

SYM = dict(H=184, y0=36, ts=44, th=36, tb=40, rc=16)                # symbole, canevas 256
LET = dict(H=700, ts=135, th=115, tb=138, rc=40)                    # lettre, unités DM Sans (capitale 700)

PARAMS = {
    "a": dict(sym=dict(g=16, ri=14, dx=4), let=dict(g=56, ri=40)),
    "b": dict(sym=dict(W=180, door_w=58, door_gap=6, ax_shift=2, dx=3), let=dict(W=600, door_w=190, door_gap=30, ax_shift=6)),
    "c": dict(sym=dict(W=180, g=18, ri=12, dx=4), let=dict(W=600, g=60, ri=36)),
}


def build(concept, kind, x0=None, y0=None, **override):
    base = dict(SYM if kind == "sym" else LET)
    p = dict(PARAMS[concept][kind])
    p.update(override)
    H, ts, th, tb, rc = base["H"], base["ts"], base["th"], base["tb"], base["rc"]
    if concept == "a":
        W = a_width(H, ts, th)
    else:
        W = p.pop("W")
    dx = p.pop("dx", 0)
    if x0 is None:
        x0 = (256 - W) / 2 + dx
    if y0 is None:
        y0 = base.get("y0", 0)
    s = Spec(x0, y0, H, W, ts, th, tb, rc)
    fn = {"a": a_paths, "b": b_paths, "c": c_paths}[concept]
    return fn(s, **p), W


TITRES = {"a": "le créneau rempli", "b": "la porte", "c": "le deal"}


def lockup(concept, word, font, tracking=-18):
    """Lockup horizontal : la lettre-symbole remplace le D, le reste du mot en DM Sans Bold
    vectorisé (provisoire), approche resserrée de `tracking` unités par lettre."""
    letter, W = build(concept, "let", x0=0, y0=-700)
    # approche D→e : même blanc que le couple D-e de DM Sans (approche droite du D + gauche du e)
    d_rsb = font.tt["hmtx"][font.name("D")][0] - 661
    x = W + d_rsb + tracking
    glyphs, end = font.word(word[1:], x, 0, 1000, tracking)
    pad = 60
    top, bottom = -720 - pad, 230 + pad   # ascendante du l/k (720), descendante du p (~ -210)
    vb_w = end - tracking + 2 * pad
    body = path(" ".join(letter)) + "\n" + "\n".join(path(d, fill_rule="nonzero") for _, d, _, _ in glyphs)
    return svg(f'    <g transform="translate({pad} 0)">\n{body}\n    </g>', w=vb_w, h=bottom - top,
               title=f"{word} — lockup concept {concept.upper()} ({TITRES[concept]})").replace(
        f'viewBox="0 0 {f(vb_w)} {f(bottom - top)}"', f'viewBox="0 {f(top)} {f(vb_w)} {f(bottom - top)}"')


def write(version):
    font = Font(FONT)
    out = []
    for c in "abc":
        paths, _ = build(c, "sym")
        p = os.path.join(OUT, f"concept-{c}-{version}.svg")
        open(p, "w").write(svg(path(" ".join(paths)), title=f"Dealpick — concept {c.upper()}, {TITRES[c]}"))
        out.append(p)
        for word in ("Dealpick", "Dealmarket"):
            q = os.path.join(OUT, f"concept-{c}-lockup-{word.lower()}-{version}.svg")
            open(q, "w").write(lockup(c, word, font))
            out.append(q)
    print("\n".join(os.path.relpath(p, OUT) for p in out))


if __name__ == "__main__":
    write(sys.argv[1] if len(sys.argv) > 1 else "v5")
