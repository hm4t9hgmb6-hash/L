"""Audit d'un SVG de logo (remplace svg_audit.py du skill, dont l'exécution est bloquée ici).

    python3 audit.py a.svg b.svg ...

Vérifie : <text>, <image>, filtres, masques/clipPath, dégradés, traits (stroke),
nombre de couleurs, nombre de tracés et de points d'ancrage, précision des
coordonnées, emprise (bbox rastérisée) et centrage, plus petit détail.
L'emprise et le plus petit détail sont mesurés sur un rendu PNG (render.js).
"""
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def raster(svg_path, size=512):
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, "r.png")
        subprocess.run(["node", os.path.join(HERE, "render.js"), "svg", svg_path, png, str(size)], check=True)
        return np.array(Image.open(png).convert("RGBA"))


def min_feature(mask):
    """Épaisseur minimale approchée (encre et vide intérieur) via des passes horizontales/verticales."""
    def runs(a):
        best = 10 ** 9
        for line in a:
            v = np.flatnonzero(np.diff(np.concatenate([[0], line.astype(int), [0]])))
            for s, e in zip(v[::2], v[1::2]):
                best = min(best, e - s)
        return best
    ink = min(runs(mask), runs(mask.T))
    # vides entre deux zones d'encre sur une même ligne (contreformes, interstices)
    gaps = 10 ** 9
    for a in (mask, mask.T):
        for line in a:
            idx = np.flatnonzero(line)
            if len(idx) < 2:
                continue
            inner = ~line[idx[0]: idx[-1] + 1]
            v = np.flatnonzero(np.diff(np.concatenate([[0], inner.astype(int), [0]])))
            for s, e in zip(v[::2], v[1::2]):
                gaps = min(gaps, e - s)
    return ink, gaps


def components(mask):
    """Nombre de composantes connexes (4-voisinage) d'un masque booléen."""
    from collections import deque
    seen = np.zeros_like(mask, dtype=bool)
    h, w = mask.shape
    n = 0
    for y0 in range(h):
        for x0 in range(w):
            if mask[y0, x0] and not seen[y0, x0]:
                n += 1
                q = deque([(y0, x0)])
                seen[y0, x0] = True
                while q:
                    y, x = q.popleft()
                    for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                            seen[yy, xx] = True
                            q.append((yy, xx))
    return n


def topo(svg_path, size):
    """(pièces d'encre, trous) d'un rendu à `size` px ; le fond extérieur n'est pas un trou."""
    a = raster(svg_path, size)[..., 3] > 127
    pad = np.pad(~a, 1, constant_values=True)
    return components(a), components(pad) - 1


def audit(p):
    s = open(p).read()
    rep = []
    vb = [float(x) for x in re.search(r'viewBox="([^"]+)"', s).group(1).split()]
    W, H = vb[2], vb[3]
    fails = []
    for tag, why in (("<text", "texte vivant"), ("<image", "image matricielle"), ("<filter", "filtre"),
                     ("<mask", "masque"), ("<clipPath", "clipPath")):
        if tag in s:
            fails.append(why)
    grads = len(re.findall(r"<(linear|radial)Gradient", s))
    strokes = len(re.findall(r'stroke-width="', s))
    colors = sorted(set(c.lower() for c in re.findall(r'(?:fill|stroke)="(#[0-9a-fA-F]{3,6})"', s)))
    paths = re.findall(r'\sd="([^"]+)"', s)
    anchors = sum(len(re.findall(r"[MLHVCSQTA]", d, re.I)) for d in paths)
    nums = re.findall(r"-?\d+\.\d+", " ".join(paths))
    long_prec = sum(1 for n in nums if len(n.split(".")[1]) > 2)

    size = 512
    img = raster(p, size)
    mask = img[..., 3] > 127
    ys, xs = np.nonzero(mask)
    k = W / size if W >= H else H / size  # unités SVG par pixel
    bx0, bx1, by0, by1 = xs.min() * k, (xs.max() + 1) * k, ys.min() * k, (ys.max() + 1) * k
    # centre de masse de l'encre
    cmx, cmy = xs.mean() * k, ys.mean() * k
    ink, gap = min_feature(mask)
    rep.append(f"== {os.path.basename(p)}  viewBox {W:g}×{H:g}")
    rep.append(f"   structure : {len(paths)} tracé(s), {anchors} commandes, couleurs {colors or ['(héritée)']}, "
               f"dégradés {grads}, traits {strokes}, coordonnées >2 déc. : {long_prec}")
    rep.append(f"   emprise   : x {bx0:.0f}→{bx1:.0f}, y {by0:.0f}→{by1:.0f}  "
               f"({bx1 - bx0:.0f}×{by1 - by0:.0f}, ratio {(bx1 - bx0) / (by1 - by0):.2f})")
    rep.append(f"   centrage  : centre de l'emprise ({(bx0 + bx1) / 2:.0f},{(by0 + by1) / 2:.0f}) ; "
               f"centre de masse ({cmx:.0f},{cmy:.0f}) ; centre du canevas ({W / 2:.0f},{H / 2:.0f})")
    ref = max(W, H)
    rep.append(f"   détails (indicatif, bruité aux pointes de courbes) : trait mini ≈ {ink * k:.1f} u ({ink * k / ref * 100:.1f} %), "
               f"vide mini ≈ {gap * k:.1f} u ({gap * k / ref * 100:.1f} %)  → à 16 px : "
               f"{ink * k / ref * 16:.2f} px / {gap * k / ref * 16:.2f} px")
    t512, t32, t16 = topo(p, 256), topo(p, 32), topo(p, 16)
    rep.append(f"   topologie : (pièces, trous) 256px {t512} · 32px {t32} · 16px {t16}")
    warn = []
    if t32 != t512:
        warn.append("la forme change de topologie à 32 px")
    if t16 != t512:
        warn.append("à 16 px : des jours ou des trous se bouchent")
    if strokes:
        warn.append("traits à vectoriser pour le master")
    if long_prec:
        warn.append("précision excessive")
    verdict = "ÉCHEC : " + ", ".join(fails) if fails else "OK"
    rep.append(f"   verdict   : {verdict}" + ("" if not warn else "  | alertes : " + " ; ".join(warn)))
    return "\n".join(rep)


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(audit(p))
