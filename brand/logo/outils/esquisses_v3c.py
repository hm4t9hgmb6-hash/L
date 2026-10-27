"""Esquisses v3c : trois façons de sauver la piste C (exploration, géométrie booléenne)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from shapely.geometry import box  # noqa: E402
from shapely.ops import unary_union  # noqa: E402

from geo import d_shape, disc, to_path  # noqa: E402
from svgkit import path, svg  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "esquisses")
X0, Y0, H, W, RC = 40, 36, 184, 176, 16
R = H / 2
CX = X0 + W - R


def counter(ts=44, th=36, tb=40, ri=10):
    xl = X0 + ts
    rx, ry = R - tb, R - th
    return d_shape(xl, Y0 + th, H - 2 * th, CX + rx - xl, rc=ri, rx=rx, ry=ry)


def journee(g=16, bands=3):
    """La journée pleine, avec contreforme : le D (anneau) découpé en créneaux."""
    ring = d_shape(X0, Y0, H, W, RC).difference(counter())
    bh = (H - (bands - 1) * g) / bands
    gaps = unary_union([box(0, Y0 + (i + 1) * bh + i * g, 256, Y0 + (i + 1) * (bh + g)) for i in range(bands - 1)])
    return ring.difference(gaps)


def enseigne(t=52, line=8):
    """L'enseigne peinte : D épais avec filet intérieur, comme les lettres des devantures."""
    outer = d_shape(X0, Y0, H, W, RC)
    cnt = outer.buffer(-t, join_style="round")
    mid = t / 2
    filet = outer.buffer(-(mid - line / 2), join_style="round").difference(
        outer.buffer(-(mid + line / 2), join_style="round"))
    return outer.difference(cnt).difference(filet)


def store(n=3, ts=44, th=36, tb=40):
    """Le store : le haut de la contreforme festonné, le D devient une vitrine sous son store."""
    outer = d_shape(X0, Y0, H, W, RC)
    cnt = counter(ts, th, tb)
    xl = X0 + ts
    xr = CX + R - tb
    rs = (xr - xl) / (2 * n)
    yt = Y0 + th
    scallops = unary_union([disc(xl + rs * (2 * i + 1), yt, rs) for i in range(n)])
    return outer.difference(cnt.difference(scallops))


VARIANTS = {
    "c-journee-creux-v3": journee(),
    "c-enseigne-v3": enseigne(),
    "c-store-v3": store(),
    "c-store-4-v3": store(4),
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, geom in VARIANTS.items():
        with open(os.path.join(OUT, name + ".svg"), "w") as fh:
            fh.write(svg(path(to_path(geom)), title=f"Dealpick — esquisse {name}"))
    print(" ".join(VARIANTS))


def deux_gestes(g=14, ts=44, th=36, tb=40, rot=False):
    """Le deal : deux pièces qui s'emboîtent. Pièce droite = montant + barre haute (le
    commerçant) ; pièce ronde = panse + barre basse (le client). Deux jours de g, en haut à
    droite et en bas à gauche."""
    ring = d_shape(X0, Y0, H, W, RC).difference(counter(ts, th, tb))
    cut1 = box(CX - g / 2, Y0 - 1, CX + g / 2, Y0 + th + 1)              # haut : entre barre et panse
    cut2 = box(X0 + ts - 1, Y0 + H - th - 1, X0 + ts + g, Y0 + H + 1)    # bas : entre montant et barre basse
    return ring.difference(unary_union([cut1, cut2]))


def deux_gestes_diag(g=14, ts=44, th=36, tb=40):
    """Variante : les deux jours sont en symétrie centrale (haut-droite / bas-gauche du montant)."""
    ring = d_shape(X0, Y0, H, W, RC).difference(counter(ts, th, tb))
    cut1 = box(X0 + ts, Y0 - 1, X0 + ts + g, Y0 + th + 1)               # haut, contre le montant
    cut2 = box(CX - g / 2, Y0 + H - th - 1, CX + g / 2, Y0 + H + 1)      # bas, au départ de la panse
    return ring.difference(unary_union([cut1, cut2]))


if __name__ == "__main__":
    for name, geom in {"c-deal-v3": deux_gestes(), "c-deal-diag-v3": deux_gestes_diag()}.items():
        with open(os.path.join(OUT, name + ".svg"), "w") as fh:
            fh.write(svg(path(to_path(geom)), title=f"Dealpick — esquisse {name}"))
        print(name)
