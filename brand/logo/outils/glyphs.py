"""Contours de glyphes (fontTools) convertis en chemins SVG, repère y vers le bas.

Usage en module :
    from glyphs import Font
    f = Font("DMSans-700.ttf")
    d, adv = f.path("a", x=0, baseline=200, size=180)   # size = corps en unités SVG

Usage en ligne de commande (planche de comparaison, texte converti en tracés) :
    python3 glyphs.py police.ttf "Dealpick" -o sortie.svg
"""
import argparse
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont


class Font:
    def __init__(self, path):
        self.tt = TTFont(path)
        self.gs = self.tt.getGlyphSet()
        self.cmap = self.tt.getBestCmap()
        self.upm = self.tt["head"].unitsPerEm
        os2 = self.tt["OS/2"]
        self.x_height = os2.sxHeight
        self.cap_height = os2.sCapHeight

    def name(self, char):
        return self.cmap[ord(char)]

    def advance(self, char, size):
        return self.tt["hmtx"][self.name(char)][0] * size / self.upm

    def path(self, char, x, baseline, size):
        """Chemin SVG du glyphe, origine (x, baseline), corps `size`."""
        k = size / self.upm
        pen = SVGPathPen(self.gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        self.gs[self.name(char)].draw(TransformPen(pen, (k, 0, 0, -k, x, baseline)))
        return pen.getCommands(), self.advance(char, size)

    def word(self, text, x, baseline, size, tracking=0.0, kern=None):
        """Liste [(char, d, x0, avance)] ; `kern` = {index: décalage ajouté avant la lettre}."""
        out = []
        for i, ch in enumerate(text):
            x += (kern or {}).get(i, 0)
            d, adv = self.path(ch, x, baseline, size)
            out.append((ch, d, x, adv))
            x += adv + tracking
        return out, x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("font")
    ap.add_argument("text")
    ap.add_argument("--size", type=float, default=200)
    ap.add_argument("--tracking", type=float, default=0)
    ap.add_argument("-o", "--out", default="-")
    a = ap.parse_args()
    f = Font(a.font)
    base = a.size * 1.0
    glyphs, end = f.word(a.text, 20, base, a.size, a.tracking)
    h = a.size * 1.3
    paths = "\n".join(f'  <path d="{d}"/>' for _, d, _, _ in glyphs)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {end + 20:.0f} {h:.0f}">\n'
           f'<g fill="#111">\n{paths}\n</g>\n</svg>\n')
    (sys.stdout if a.out == "-" else open(a.out, "w")).write(svg)


if __name__ == "__main__":
    main()
