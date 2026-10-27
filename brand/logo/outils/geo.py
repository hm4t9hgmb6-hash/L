"""Géométrie booléenne (shapely) pour l'exploration : formes -> chemin SVG.

Les arcs sont échantillonnés finement ; c'est bon pour regarder une idée, pas pour
un master (trop de points). Les masters sont redessinés en arcs exacts.
"""
import math

from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from svgkit import f

RES = 64  # segments par quart de cercle


def disc(cx, cy, r):
    return Point(cx, cy).buffer(r, quad_segs=RES)


def ellipse_pts(cx, cy, rx, ry, a0, a1, n=96):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def rounded_rect(x, y, w, h, r):
    return box(x + r, y + r, x + w - r, y + h - r).buffer(r, quad_segs=RES) if r else box(x, y, x + w, y + h)


def d_shape(x0, y0, H, W, rc=0, rx=None, ry=None):
    """D plein : rectangle à gauche (coins rc) + demi-ellipse à droite (rx, ry ; défaut cercle H/2)."""
    ry = ry or H / 2
    rx = rx or H / 2
    cy = y0 + H / 2
    cx = x0 + W - rx
    pts = [(x0 + rc, y0), (cx, y0)] + ellipse_pts(cx, cy, rx, ry, -90, 90)[1:-1] + [(cx, y0 + H), (x0 + rc, y0 + H)]
    poly = Polygon(pts)
    if rc:
        left = rounded_rect(x0, y0, 2 * rc + 1, H, rc)
        poly = unary_union([poly, left, box(x0 + rc, y0, cx, y0 + H)])
    return poly


def to_path(geom):
    """Chemin SVG (evenodd) d'un Polygon ou MultiPolygon."""
    polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
    out = []
    for p in polys:
        for ring in [p.exterior] + list(p.interiors):
            c = list(ring.coords)
            out.append("M" + " L".join(f"{f(x)} {f(y)}" for x, y in c[:-1]) + " Z")
    return " ".join(out)
