"""Esquisses v3 : premier affinage des trois pistes retenues.

A — Le créneau rempli : contreforme aux coins intérieurs arrondis, pastille
    concentrique à la panse, jeu constant.
B — La porte : contreforme en porte cintrée posée sur le seuil.
C — La journée pleine : le D découpé en créneaux horizontaux.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from svgkit import circle, f, path, svg  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "esquisses")


def d_outer(x0, y0, H, W, rc):
    R = H / 2
    cx = x0 + W - R
    y1 = y0 + H
    return (f"M{f(x0 + rc)} {f(y0)} H{f(cx)} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(y1)} H{f(x0 + rc)} "
            f"A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(y1 - rc)} V{f(y0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(y0)} Z")


def d_counter(xl, yt, yb, cx, rx, ry, ri):
    """Contreforme : bord gauche droit, coins intérieurs gauches arrondis (ri), panse en demi-ellipse."""
    return (f"M{f(xl + ri)} {f(yt)} H{f(cx)} A{f(rx)} {f(ry)} 0 0 1 {f(cx)} {f(yb)} H{f(xl + ri)} "
            f"A{f(ri)} {f(ri)} 0 0 1 {f(xl)} {f(yb - ri)} V{f(yt + ri)} A{f(ri)} {f(ri)} 0 0 1 {f(xl + ri)} {f(yt)} Z")


def a_creneau(g=16, ts=44, th=36, rc=16, ri=14, dot_shift=0):
    """D 184 de haut ; contreforme = demi-cercle r 56 + partie droite de 56 - pastille de rayon 56 - g
    concentrique à la panse ; le montant mesure ts, les horizontales th."""
    H, y0 = 184, 36
    R = H / 2
    ri_bowl = R - th               # 56 : rayon intérieur de la panse (épaisseur constante th)
    xl = 0                         # calé plus bas
    # largeur : montant + partie droite de la contreforme (= ri_bowl) + rayon extérieur
    W = ts + ri_bowl + R
    x0 = (256 - W) / 2
    cx = x0 + W - R
    xl = cx - ri_bowl
    outer = d_outer(x0, y0, H, W, rc)
    counter = d_counter(xl, y0 + th, y0 + H - th, cx, ri_bowl, ri_bowl, ri)
    dot = circle(cx + dot_shift, y0 + R, ri_bowl - g)
    return path(" ".join([outer, counter, dot]))


def b_porte(door_w=48, door_top=20, ts=44, th=36, rc=16, W=176):
    """Porte cintrée : largeur door_w, sommet en demi-cercle, posée sur le seuil (bord haut
    de l'horizontale basse) ; axe au centre optique de l'espace intérieur."""
    H, y0 = 184, 36
    R = H / 2
    x0 = (256 - W) / 2
    cx = x0 + W - R
    yt, yb = y0 + th, y0 + H - th
    xl = x0 + ts
    xr = cx + R - th - 4
    ax = (xl + xr) / 2
    r = door_w / 2
    top = yt + door_top
    door = (f"M{f(ax - r)} {f(yb)} V{f(top + r)} A{f(r)} {f(r)} 0 0 1 {f(ax + r)} {f(top + r)} V{f(yb)} Z")
    return path(d_outer(x0, y0, H, W, rc) + " " + door)


def c_journee(bands=3, g=16, rc=16, W=176, counter=False, ts=44, th=36):
    """D plein découpé en `bands` créneaux horizontaux séparés par des jours de g."""
    H, y0 = 184, 36
    R = H / 2
    x0 = (256 - W) / 2
    cx = x0 + W - R
    cy = y0 + R
    bh = (H - (bands - 1) * g) / bands
    parts = []
    for i in range(bands):
        top = y0 + i * (bh + g)
        bot = top + bh

        def xr(y):
            dy = y - cy
            return cx + math.sqrt(max(0.0, R * R - dy * dy)) if abs(dy) <= R else cx

        # bord droit de la bande suivant la panse (arc du cercle extérieur)
        x_top, x_bot = xr(top), xr(bot)
        large = 0
        seg = f"M{f(x0 + (rc if i == 0 else 0))} {f(top)} H{f(x_top)} A{f(R)} {f(R)} 0 {large} 1 {f(x_bot)} {f(bot)} "
        if i == bands - 1:
            seg += f"H{f(x0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(bot - rc)} "
        else:
            seg += f"H{f(x0)} "
        if i == 0:
            seg += f"V{f(top + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(top)} Z"
        else:
            seg += f"V{f(top)} Z"
        parts.append(seg)
    body = " ".join(parts)
    if counter:
        ri = R - th
        xl = x0 + ts
        body += " " + d_counter(xl, y0 + th, y0 + H - th, cx, ri, ri, 10)
    return path(body)


VARIANTS = {
    "a-creneau-v3": a_creneau(),
    "a-creneau-jeu20-v3": a_creneau(g=20),
    "b-porte-v3": b_porte(),
    "b-porte-etroite-v3": b_porte(door_w=40, door_top=12, W=168),
    "c-journee-3-v3": c_journee(3),
    "c-journee-4-v3": c_journee(4, g=14),
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, body in VARIANTS.items():
        with open(os.path.join(OUT, name + ".svg"), "w") as fh:
            fh.write(svg(body, title=f"Dealpick — esquisse {name}"))
    print(" ".join(VARIANTS))
