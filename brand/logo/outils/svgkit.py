"""Petites briques géométriques pour écrire les SVG à la main, coordonnées exactes."""
import math


def f(v):
    """Nombre court : 2 décimales au plus, sans zéros inutiles."""
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def svg(body, w=256, h=256, title="Dealpick", fill="#111"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" '
            f'width="{f(w)}" height="{f(h)}" role="img" aria-labelledby="title">\n'
            f'  <title id="title">{title}</title>\n'
            f'  <g fill="{fill}" fill-rule="evenodd">\n{body}\n  </g>\n</svg>\n')


def path(d, **attrs):
    extra = "".join(f' {k.replace("_", "-")}="{v}"' for k, v in attrs.items())
    return f'    <path d="{d}"{extra}/>'


def circle(cx, cy, r, cw=True):
    """Cercle complet en deux arcs ; cw=False inverse le sens (trou en nonzero)."""
    s = 1 if cw else 0
    return (f"M{f(cx - r)} {f(cy)} A{f(r)} {f(r)} 0 1 {s} {f(cx + r)} {f(cy)} "
            f"A{f(r)} {f(r)} 0 1 {s} {f(cx - r)} {f(cy)} Z")


def rect(x, y, w, h):
    return f"M{f(x)} {f(y)} H{f(x + w)} V{f(y + h)} H{f(x)} Z"


def rrect(x, y, w, h, r, smooth=False):
    """Rectangle arrondi. smooth=True : coins à courbure progressive (anti effet d'os)."""
    if not smooth:
        return (f"M{f(x + r)} {f(y)} H{f(x + w - r)} A{f(r)} {f(r)} 0 0 1 {f(x + w)} {f(y + r)} "
                f"V{f(y + h - r)} A{f(r)} {f(r)} 0 0 1 {f(x + w - r)} {f(y + h)} H{f(x + r)} "
                f"A{f(r)} {f(r)} 0 0 1 {f(x)} {f(y + h - r)} V{f(y + r)} A{f(r)} {f(r)} 0 0 1 {f(x + r)} {f(y)} Z")
    # coin « squircle » : départ à 1,3 r du coin, poignées à 0,6 r de l'extrémité
    s = 1.3 * r
    k = 0.6 * r
    return (f"M{f(x + s)} {f(y)} H{f(x + w - s)} C{f(x + w - s + k)} {f(y)} {f(x + w)} {f(y + s - k)} {f(x + w)} {f(y + s)} "
            f"V{f(y + h - s)} C{f(x + w)} {f(y + h - s + k)} {f(x + w - s + k)} {f(y + h)} {f(x + w - s)} {f(y + h)} "
            f"H{f(x + s)} C{f(x + s - k)} {f(y + h)} {f(x)} {f(y + h - s + k)} {f(x)} {f(y + h - s)} "
            f"V{f(y + s)} C{f(x)} {f(y + s - k)} {f(x + s - k)} {f(y)} {f(x + s)} {f(y)} Z")


def polar(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)
