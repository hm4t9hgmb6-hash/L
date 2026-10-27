"""Variantes du concept C (le deal) : position et forme des coupes, graisse — arcs exacts.

    python3 variantes_c.py v6      # écrit ../variantes-c/*.svg (symboles + lockups)

Repère commun (symbole, canevas 256) : D de 184 de haut, panse extérieure en
demi-cercle R = 92 centré (cx, 128), contreforme en demi-ellipse (rx, ry).
Pièce 1 = montant + barre haute (droite, ancrée : le commerçant).
Pièce 2 = panse + barre basse (ronde : le client).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from glyphs import Font  # noqa: E402
from svgkit import f, path, svg  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "variantes-c")
FONT = os.environ.get("DP_FONT", "/tmp/claude-0/-home-user-L/096aadd5-c25d-593f-a021-aa8bdc259b70/scratchpad/fonts/DMSans-700.ttf")


class S:
    def __init__(self, x0, y0, H, W, ts, th, tb, rc, ri):
        self.x0, self.y0, self.H, self.W = x0, y0, H, W
        self.ts, self.th, self.tb, self.rc, self.ri = ts, th, tb, rc, ri
        self.R = H / 2
        self.cy = y0 + self.R
        self.y1 = y0 + H
        self.cx = x0 + W - self.R
        self.xl = x0 + ts
        self.rx, self.ry = self.R - tb, self.R - th
        self.yt, self.yb = self.cy - self.ry, self.cy + self.ry

    # bords haut (signe -1) et bas (signe +1), extérieur et intérieur, en fonction de x
    def y_out(self, x, sgn):
        if x <= self.cx:
            return self.y1 if sgn > 0 else self.y0
        return self.cy + sgn * math.sqrt(max(0.0, self.R ** 2 - (x - self.cx) ** 2))

    def y_in(self, x, sgn):
        if x <= self.cx:
            return self.yb if sgn > 0 else self.yt
        u = (x - self.cx) / self.rx
        return self.cy + sgn * self.ry * math.sqrt(max(0.0, 1 - u * u))


def solve(fn, a, b, it=80):
    fa = fn(a)
    for _ in range(it):
        m = (a + b) / 2
        fm = fn(m)
        if (fm > 0) == (fa > 0):
            a, fa = m, fm
        else:
            b = m
    return (a + b) / 2


ANGLE = 60  # inclinaison des coupes du biseau, en degrés depuis l'horizontale


def cut_line(s, x_mid, y_mid, sgn, which, deg=ANGLE):
    """Intersection d'une droite « / » inclinée de deg° passant par (x_mid, y_mid) avec le bord
    extérieur ou intérieur (which) de la barre haute (sgn -1) ou basse (sgn +1)."""
    t = math.tan(math.radians(deg))
    line = lambda x: y_mid - t * (x - x_mid)  # noqa: E731
    bord = s.y_out if which == "out" else s.y_in
    fn = lambda x: line(x) - bord(x, sgn)  # noqa: E731
    # balayage de gauche à droite : première traversée, puis bissection dans le pas
    a, step = x_mid - 2 * s.th, s.th / 50
    while fn(a + step) > 0:
        a += step
    x = solve(fn, a, a + step)
    return x, line(x)


def seg_out_top(s, xa, xb):
    """Chemin le long du bord extérieur haut de xa à xb (xa < xb), sens horaire."""
    pts = []
    if xa < s.cx < xb:
        pts.append(f"H{f(s.cx)}")
        pts.append(f"A{f(s.R)} {f(s.R)} 0 0 1 {f(xb)} {f(s.y_out(xb, -1))}")
    elif xb <= s.cx:
        pts.append(f"H{f(xb)}")
    else:
        pts.append(f"A{f(s.R)} {f(s.R)} 0 0 1 {f(xb)} {f(s.y_out(xb, -1))}")
    return " ".join(pts)


# --- C0 / C4 : coupes droites (référence et version grasse) ---------------------------------

def droites(s, g):
    x0, y0, y1, cx, R, rc, ri, xl = s.x0, s.y0, s.y1, s.cx, s.R, s.rc, s.ri, s.xl
    p1 = (f"M{f(x0 + rc)} {f(y0)} H{f(cx - g)} V{f(s.yt)} H{f(xl + ri)} A{f(ri)} {f(ri)} 0 0 0 {f(xl)} {f(s.yt + ri)} "
          f"V{f(y1)} H{f(x0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(y1 - rc)} V{f(y0 + rc)} "
          f"A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(y0)} Z")
    p2 = (f"M{f(cx)} {f(y0)} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(y1)} H{f(xl + g)} V{f(s.yb)} H{f(cx)} "
          f"A{f(s.rx)} {f(s.ry)} 0 0 0 {f(cx)} {f(s.yt)} Z")
    return [p1, p2]


# --- C3 : symétrique -------------------------------------------------------------------------

def symetrique(s, g):
    x0, y0, y1, cx, R, rc, ri, xl = s.x0, s.y0, s.y1, s.cx, s.R, s.rc, s.ri, s.xl
    p1 = (f"M{f(x0 + rc)} {f(y0)} H{f(cx - g)} V{f(s.yt)} H{f(xl + ri)} A{f(ri)} {f(ri)} 0 0 0 {f(xl)} {f(s.yt + ri)} "
          f"V{f(s.yb - ri)} A{f(ri)} {f(ri)} 0 0 0 {f(xl + ri)} {f(s.yb)} H{f(cx - g)} V{f(y1)} H{f(x0 + rc)} "
          f"A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(y1 - rc)} V{f(y0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(y0)} Z")
    p2 = (f"M{f(cx)} {f(y0)} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(y1)} V{f(s.yb)} "
          f"A{f(s.rx)} {f(s.ry)} 0 0 0 {f(cx)} {f(s.yt)} Z")
    return [p1, p2]


# --- C1 : biseau 45° -------------------------------------------------------------------------

def biseau(s, g):
    """Deux coupes parallèles « / » à 60°, de largeur g (perpendiculaire). La coupe haute
    est centrée sur le point de tangence ; la basse au pied du montant, sans entamer le montant.
    Les intersections avec les arcs sont calculées (bissection) ; les segments restent des arcs."""
    x0, y0, y1, cx, R, rc, ri, xl = s.x0, s.y0, s.y1, s.cx, s.R, s.rc, s.ri, s.xl
    a = math.radians(ANGLE)
    h = g / 2 / math.sin(a)                # demi-largeur horizontale de la coupe
    run = s.th / 2 / math.tan(a)           # décalage horizontal sur une demi-barre
    ymt, ymb = (y0 + s.yt) / 2, (s.yb + y1) / 2
    # coupe haute centrée sur cx ; coupe basse : son bord gauche touche le montant au bas (x = xl + 2)
    xt = cx
    xb = xl + 2 + h + run
    # haut : bord gauche (pièce 1) et droit (pièce 2)
    o1 = cut_line(s, xt - h, ymt, -1, "out")
    i1 = cut_line(s, xt - h, ymt, -1, "in")
    o2 = cut_line(s, xt + h, ymt, -1, "out")
    i2 = cut_line(s, xt + h, ymt, -1, "in")
    # bas
    bo1 = cut_line(s, xb - h, ymb, +1, "out")   # bord gauche sur la ligne de base (pied du montant)
    bi1 = cut_line(s, xb - h, ymb, +1, "in")
    bo2 = cut_line(s, xb + h, ymb, +1, "out")
    bi2 = cut_line(s, xb + h, ymb, +1, "in")

    def inner_top_back(pt):
        # du point pt (sur le bord intérieur haut) vers (xl + ri, yt), en revenant vers la gauche
        x, y = pt
        if x > cx:
            return f"A{f(s.rx)} {f(s.ry)} 0 0 0 {f(cx)} {f(s.yt)} H{f(xl + ri)}"
        return f"H{f(xl + ri)}"

    p1 = (f"M{f(x0 + rc)} {f(y0)} {seg_out_top(s, x0 + rc, o1[0])} L{f(i1[0])} {f(i1[1])} {inner_top_back(i1)} "
          f"A{f(ri)} {f(ri)} 0 0 0 {f(xl)} {f(s.yt + ri)} V{f(s.yb - ri)} A{f(ri)} {f(ri)} 0 0 0 {f(xl + ri)} {f(s.yb)} "
          f"H{f(bi1[0])} L{f(bo1[0])} {f(bo1[1])} H{f(x0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(y1 - rc)} "
          f"V{f(y0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(y0)} Z")
    # pièce 2 : du bord droit de la coupe haute, autour de la panse, jusqu'au bord droit de la coupe basse
    start = f"M{f(o2[0])} {f(o2[1])} "
    if o2[0] < cx:
        start += f"H{f(cx)} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(y1)} "
    else:
        start += f"A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(y1)} "
    bottom = f"H{f(bo2[0])} L{f(bi2[0])} {f(bi2[1])} "
    inner = f"H{f(cx)} " if bi2[0] < cx else ""
    if i2[0] > cx:
        inner += f"A{f(s.rx)} {f(s.ry)} 0 0 0 {f(i2[0])} {f(i2[1])}"
    else:
        inner += f"A{f(s.rx)} {f(s.ry)} 0 0 0 {f(cx)} {f(s.yt)} H{f(i2[0])}"
    p2 = start + bottom + inner + " Z"
    return [p1, p2]


# --- C2 : bouts ronds ------------------------------------------------------------------------

def rond(s, g):
    """Panse d'épaisseur constante (tb = th) : les bouts coupés sont des demi-cercles exacts,
    tangents aux deux bords. Bout de la pièce 2 en haut : centré sur la panse à 20° après la
    tangence ; jour g entre les deux pointes, mesuré sur l'axe de la barre."""
    x0, y0, y1, cx, R, rc, ri, xl, th = s.x0, s.y0, s.y1, s.cx, s.R, s.rc, s.ri, s.xl, s.th
    r = th / 2
    rm = R - r                              # rayon de l'axe de la panse
    a = math.radians(20)
    c2 = (cx + rm * math.sin(a), s.cy - rm * math.cos(a))                    # centre du bout (pièce 2, haut)
    tip2 = (c2[0] - r * math.cos(a), c2[1] - r * math.sin(a))
    o2 = (cx + R * math.sin(a), s.cy - R * math.cos(a))                     # sur le bord extérieur
    i2 = (cx + (R - th) * math.sin(a), s.cy - (R - th) * math.cos(a))       # sur le bord intérieur
    c1x = tip2[0] - g - r                                                    # centre du bout de la pièce 1 (barre droite)
    ymt, ymb = y0 + r, y1 - r
    cbx = xl + g + r                                                         # centre du bout de la barre basse
    p1 = (f"M{f(x0 + rc)} {f(y0)} H{f(c1x)} A{f(r)} {f(r)} 0 0 1 {f(c1x)} {f(s.yt)} H{f(xl + ri)} "
          f"A{f(ri)} {f(ri)} 0 0 0 {f(xl)} {f(s.yt + ri)} V{f(y1)} H{f(x0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(y1 - rc)} "
          f"V{f(y0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(y0)} Z")
    p2 = (f"M{f(o2[0])} {f(o2[1])} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(y1)} H{f(cbx)} "
          f"A{f(r)} {f(r)} 0 0 1 {f(cbx)} {f(s.yb)} H{f(cx)} "
          f"A{f(R - th)} {f(R - th)} 0 0 0 {f(i2[0])} {f(i2[1])} "
          f"A{f(r)} {f(r)} 0 0 1 {f(o2[0])} {f(o2[1])} Z")
    return [p1, p2]


VARIANTES = {
    "c0-actuel": dict(fn=droites, label="C0 — Actuel", note="Référence : coupes droites, en haut à la tangence, en bas au pied du montant."),
    "c1-biseau": dict(fn=biseau, label="C1 — Biseau", note="Coupes parallèles à 60° : les deux pièces glissent l’une dans l’autre."),
    "c2-rond": dict(fn=rond, label="C2 — Bouts ronds", rond=True,
                    note="Bouts coupés arrondis, panse d’épaisseur constante : un D tracé en deux gestes, plus doux."),
    "c3-symetrique": dict(fn=symetrique, label="C3 — Symétrique",
                          note="Coupes aux deux tangences : la boutique ⊏ et le client ), posé et stable."),
    "c4-gras": dict(fn=droites, label="C4 — Gras", gras=True,
                    note="Plus de matière, jours plus larges : les coupes tiennent jusqu’en 16 px."),
}


def spec(kind, gras=False, rond_=False):
    if kind == "sym":
        if gras:
            return S((256 - 184) / 2 + 4, 36, 184, 184, 54, 46, 50, 18, 10)
        return S((256 - 180) / 2 + 4, 36, 184, 180, 44, 36, 36 if rond_ else 40, 16, 12)
    return S(0, -700, 700, 600, 135, 115, 115 if rond_ else 138, 40, 36)


def gap(kind, gras):
    g = 22 if gras else 18
    return g if kind == "sym" else round(g * 700 / 184 * 0.9)


def lockup(d_letter, word, font, tracking=-18):
    d_rsb = font.tt["hmtx"][font.name("D")][0] - 661
    x = 600 + d_rsb + tracking
    glyphs, end = font.word(word[1:], x, 0, 1000, tracking)
    pad, top, bottom = 60, -780, 290
    vb_w = end - tracking + 2 * pad
    body = path(d_letter) + "\n" + "\n".join(path(d, fill_rule="nonzero") for _, d, _, _ in glyphs)
    out = svg(f'    <g transform="translate({pad} 0)">\n{body}\n    </g>', w=vb_w, h=bottom - top, title=f"{word} — lockup")
    return out.replace(f'viewBox="0 0 {f(vb_w)} {f(bottom - top)}"', f'viewBox="0 {top} {f(vb_w)} {bottom - top}"')


def write(version):
    os.makedirs(OUT, exist_ok=True)
    font = Font(FONT)
    for key, v in VARIANTES.items():
        gras, rd = v.get("gras", False), v.get("rond", False)
        d_sym = " ".join(v["fn"](spec("sym", gras, rd), gap("sym", gras)))
        open(os.path.join(OUT, f"concept-{key}-{version}.svg"), "w").write(
            svg(path(d_sym), title=f"Dealpick — concept C, variante {v['label']}"))
        d_let = " ".join(v["fn"](spec("let", gras, rd), gap("let", gras)))
        for word in ("Dealpick", "Dealmarket"):
            open(os.path.join(OUT, f"concept-{key}-lockup-{word.lower()}-{version}.svg"), "w").write(
                lockup(d_let, word, font))
        print(key)


if __name__ == "__main__":
    write(sys.argv[1] if len(sys.argv) > 1 else "v6")
