"""Esquisses v2 : trois idées en D, valables pour Dealpick comme pour Dealmarket.

Le D de base (dessiné, pas tapé) : montant d'épaisseur ts, horizontales th (plus
fines, correction optique), panse à droite d'épaisseur tb à 3 h. La panse
extérieure est un demi-cercle de rayon H/2 ; la contreforme est une demi-ellipse
concentrique (rx = R - tb, ry = R - th).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from svgkit import circle, f, path, rrect, svg  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "esquisses")


class D:
    def __init__(self, x0=36, y0=36, H=184, W=184, ts=44, th=36, tb=40, rc=10):
        self.x0, self.y0, self.H, self.W = x0, y0, H, W
        self.ts, self.th, self.tb, self.rc = ts, th, tb, rc
        self.R = H / 2
        self.cy = y0 + self.R
        self.cx = x0 + W - self.R
        self.y1 = y0 + H

    def outer(self):
        x0, y0, y1, cx, R, rc = self.x0, self.y0, self.y1, self.cx, self.R, self.rc
        return (f"M{f(x0 + rc)} {f(y0)} H{f(cx)} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(y1)} H{f(x0 + rc)} "
                f"A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(y1 - rc)} V{f(y0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(y0)} Z")

    def counter_box(self):
        """(gauche, haut, droite, bas) de la contreforme."""
        return (self.x0 + self.ts, self.y0 + self.th, self.cx + self.R - self.tb, self.y1 - self.th)

    def counter(self):
        xl, yt, _, yb = self.counter_box()
        rx, ry = self.R - self.tb, self.R - self.th
        return f"M{f(xl)} {f(yt)} H{f(self.cx)} A{f(rx)} {f(ry)} 0 0 1 {f(self.cx)} {f(yb)} H{f(xl)} Z"


def a_pastille(g=14, W=192, low=0):
    """A — Le créneau rempli. Contreforme = carré + demi-cercle (r 56) ; la pastille est
    concentrique à la panse et laisse un jeu constant g sur trois côtés."""
    d = D(x0=32, W=W, ts=44, th=36, tb=36)
    xl, yt, xr, yb = d.counter_box()
    r = (yb - yt) / 2 - g
    cx = xr - g - r
    return path(" ".join([d.outer(), d.counter(), circle(cx, d.cy + low, r)]))


def a_point(r=32):
    """A' — pastille plus petite, posée au fond de la panse (elle « tombe » dans le creux)."""
    d = D(x0=36, W=184, ts=44, th=36, tb=40)
    xl, yt, xr, yb = d.counter_box()
    return path(" ".join([d.outer(), d.counter(), circle(d.cx + 4, yb - 14 - r, r)]))


def b_porte_cintree(door_w=44, open_bottom=True):
    """B — La porte. Le D est une devanture : sa contreforme devient une porte cintrée
    (rectangle + demi-cercle) posée sur le seuil ; ouverte en bas, elle perce le D."""
    d = D(x0=36, W=184, ts=44, th=36, tb=40, rc=10)
    xl, yt, xr, yb = d.counter_box()
    dx = (xl + xr) / 2 + 2  # axe de la porte, centré dans la contreforme (optique : un peu à droite)
    r = door_w / 2
    top = yt + 12
    bottom = d.y1 + 1 if open_bottom else yb
    door = (f"M{f(dx - r)} {f(bottom)} V{f(top + r)} A{f(r)} {f(r)} 0 0 1 {f(dx + r)} {f(top + r)} "
            f"V{f(bottom)} Z")
    return path(" ".join([d.outer(), door]))


def b_entrouvert(gap=12):
    """B' — Le D entrouvert : le montant (le cadre) et la panse (le battant) séparés
    par une fente de lumière."""
    d = D(x0=36, W=184, ts=44, th=36, tb=40, rc=10)
    x_cut = d.x0 + d.ts
    stem = rrect(d.x0, d.y0, d.ts, d.H, d.rc)
    bx = x_cut + gap
    bowl = (f"M{f(bx)} {f(d.y0)} H{f(d.cx)} A{f(d.R)} {f(d.R)} 0 0 1 {f(d.cx)} {f(d.y1)} H{f(bx)} Z "
            f"M{f(bx)} {f(d.y0 + d.th)} V{f(d.y1 - d.th)} H{f(d.cx)} "
            f"A{f(d.R - d.tb)} {f(d.R - d.th)} 0 0 0 {f(d.cx)} {f(d.y0 + d.th)} Z")
    return path(stem + " " + bowl)


def c_plein(level=0.58, g=12, merged=False):
    """C — Le plein. La contreforme se remplit jusqu'à un niveau : l'heure creuse fait le plein."""
    d = D(x0=36, W=184, ts=44, th=36, tb=40, rc=10)
    xl, yt, xr, yb = d.counter_box()
    rx, ry = d.R - d.tb, d.R - d.th
    if merged:
        ly = yb - (yb - yt) * level
        # contreforme réduite à sa partie haute (au-dessus du niveau)
        import math
        dy = d.cy - ly  # >0 si le niveau est au-dessus du centre
        ex = d.cx + rx * math.sqrt(max(0, 1 - (dy / ry) ** 2))
        sweep_large = 0
        hole = (f"M{f(xl)} {f(yt)} H{f(d.cx)} A{f(rx)} {f(ry)} 0 {sweep_large} 1 {f(ex)} {f(ly)} H{f(xl)} Z")
        return path(d.outer() + " " + hole)
    # remplissage séparé des parois par un jeu g : ellipse intérieure réduite de g
    irx, iry = rx - g, ry - g
    ixl, iyb = xl + g, yb - g
    ly = iyb - (iyb - (yt + g)) * level
    import math
    dy = d.cy - ly
    ex = d.cx + irx * math.sqrt(max(0, 1 - (dy / iry) ** 2))
    large = 0
    fill = (f"M{f(ixl)} {f(ly)} H{f(ex)} A{f(irx)} {f(iry)} 0 {large} 1 {f(d.cx)} {f(iyb)} H{f(ixl)} Z")
    return path(" ".join([d.outer(), d.counter(), fill]))


VARIANTS = {
    "a-pastille-v2": a_pastille(),
    "a-pastille-jeu18-v2": a_pastille(g=18),
    "a-point-v2": a_point(),
    "b-porte-cintree-v2": b_porte_cintree(),
    "b-porte-fermee-v2": b_porte_cintree(open_bottom=False),
    "b-entrouvert-v2": b_entrouvert(),
    "c-plein-v2": c_plein(),
    "c-plein-haut-v2": c_plein(level=0.72),
    "c-plein-fondu-v2": c_plein(merged=True, level=0.55),
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, body in VARIANTS.items():
        with open(os.path.join(OUT, name + ".svg"), "w") as fh:
            fh.write(svg(body, title=f"Dealpick — esquisse {name}"))
    print(" ".join(VARIANTS))
