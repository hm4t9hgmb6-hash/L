"""Concepts v4 : les trois pistes retenues, en arcs exacts (qualité master).

Construction commune : D de 184 de haut sur un canevas 256, panse extérieure en
demi-cercle (R = 92), coins du montant arrondis à 16, horizontales plus fines que
le montant (correction optique). Le décalage dx recentre optiquement la masse,
plus lourde côté montant.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from svgkit import circle, f, path, svg  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..")
H, Y0 = 184, 36
R = H / 2
CY = Y0 + R
Y1 = Y0 + H


def outer(x0, W, rc):
    cx = x0 + W - R
    return (f"M{f(x0 + rc)} {f(Y0)} H{f(cx)} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(Y1)} H{f(x0 + rc)} "
            f"A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(Y1 - rc)} V{f(Y0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(Y0)} Z")


def counter(xl, cx, rx, ry, ri):
    yt, yb = CY - ry, CY + ry
    return (f"M{f(xl + ri)} {f(yt)} H{f(cx)} A{f(rx)} {f(ry)} 0 0 1 {f(cx)} {f(yb)} H{f(xl + ri)} "
            f"A{f(ri)} {f(ri)} 0 0 1 {f(xl)} {f(yb - ri)} V{f(yt + ri)} A{f(ri)} {f(ri)} 0 0 1 {f(xl + ri)} {f(yt)} Z")


def concept_a(g=16, ts=44, th=36, rc=16, ri=14, dx=4):
    """A — Le créneau rempli.
    Contreforme : partie droite de 56 + demi-cercle r 56 (panse d'épaisseur constante 36).
    Pastille : r = 56 - g, concentrique à la panse : jeu constant g en haut, à droite, en bas
    et à gauche (le bord gauche de la contreforme est à exactement 56 du centre)."""
    ri_b = R - th
    W = ts + ri_b + R
    x0 = (256 - W) / 2 + dx
    cx = x0 + W - R
    body = [outer(x0, W, rc), counter(cx - ri_b, cx, ri_b, ri_b, ri), circle(cx, CY, ri_b - g)]
    return path(" ".join(body)), dict(W=W, x0=x0, pastille=ri_b - g, jeu=g)


def concept_b(door_w=48, door_gap=8, ts=44, th=36, rc=16, W=180, dx=3):
    """B — La porte.
    D plein ; sa seule contreforme est une porte cintrée (largeur door_w, sommet en
    demi-cercle) posée sur le seuil (bord haut de l'horizontale basse, épaisseur th).
    Hauteur de porte = hauteur intérieure - door_gap : proportion ~ 1 : 2,1."""
    x0 = (256 - W) / 2 + dx
    ax = x0 + W / 2 + 2            # axe de la porte : centre de la façade, un rien vers la panse
    r = door_w / 2
    yb = Y1 - th
    top = Y0 + th + door_gap
    door = f"M{f(ax - r)} {f(yb)} V{f(top + r)} A{f(r)} {f(r)} 0 0 1 {f(ax + r)} {f(top + r)} V{f(yb)} Z"
    return path(outer(x0, W, rc) + " " + door), dict(W=W, porte=f"{door_w}×{yb - top:g}")


def concept_c(g=14, ts=44, th=36, tb=40, rc=16, ri=12, W=180, dx=4):
    """C — Le deal.
    Le D en anneau, coupé deux fois : en haut, là où la barre droite devient courbe
    (jour de g juste avant le point de tangence) ; en bas, au pied du montant.
    Pièce 1 = montant + barre haute (droite, ancrée : le commerçant).
    Pièce 2 = panse + barre basse (ronde : le client). Elles s'emboîtent."""
    x0 = (256 - W) / 2 + dx
    cx = x0 + W - R
    xl = x0 + ts
    rx, ry = R - tb, R - th
    yt, yb = CY - ry, CY + ry
    # pièce 1 : Γ — montant (coins extérieurs arrondis) + barre haute jusqu'à cx - g
    p1 = (f"M{f(x0 + rc)} {f(Y0)} H{f(cx - g)} V{f(yt)} H{f(xl + ri)} A{f(ri)} {f(ri)} 0 0 0 {f(xl)} {f(yt + ri)} "
          f"V{f(Y1)} H{f(x0 + rc)} A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(Y1 - rc)} V{f(Y0 + rc)} "
          f"A{f(rc)} {f(rc)} 0 0 1 {f(x0 + rc)} {f(Y0)} Z")
    # pièce 2 : panse + barre basse, de cx (tangence) jusqu'à xl + g
    p2 = (f"M{f(cx)} {f(Y0)} A{f(R)} {f(R)} 0 0 1 {f(cx)} {f(Y1)} H{f(xl + g)} V{f(yb)} H{f(cx)} "
          f"A{f(rx)} {f(ry)} 0 0 0 {f(cx)} {f(yt)} Z")
    return path(p1 + " " + p2), dict(W=W, jeu=g)


CONCEPTS = {
    "concept-a": concept_a,
    "concept-b": concept_b,
    "concept-c": concept_c,
}
TITRES = {
    "concept-a": "Dealpick — concept A, le créneau rempli",
    "concept-b": "Dealpick — concept B, la porte",
    "concept-c": "Dealpick — concept C, le deal",
}


def write(version, overrides=None):
    for name, fn in CONCEPTS.items():
        body, info = fn(**(overrides or {}).get(name, {}))
        p = os.path.join(OUT, f"{name}-{version}.svg")
        with open(p, "w") as fh:
            fh.write(svg(body, title=TITRES[name]))
        print(p, info)


if __name__ == "__main__":
    write(sys.argv[1] if len(sys.argv) > 1 else "v4")
