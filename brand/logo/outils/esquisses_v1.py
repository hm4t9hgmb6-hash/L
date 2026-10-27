"""Esquisses v1 des symboles, en noir. Chaque fonction décrit sa construction."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from svgkit import circle, f, path, rect, rrect, svg  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "esquisses")


def a_creneau(cy_dot=128, cx_dot=130, rd=30):
    """A — D au creux rempli.
    D : montant x 40→80 (40), haut/bas 36 et 220, panse = demi-cercle r 92 centré (124,128).
    Contreforme : x 80→124 + demi-cercle r 56 ; horizontales 36 (plus fines que le montant 40).
    Pastille : disque r 30 dans la contreforme."""
    outer = f"M40 36 H124 A92 92 0 0 1 124 220 H40 Z"
    inner = f"M80 72 H124 A56 56 0 0 1 124 184 H80 Z"
    return path(outer + " " + inner + " " + circle(cx_dot, cy_dot, rd))


def b_dp(R=72, t=36, a=36, round_ends=False):
    """B — d et p, même lettre retournée (symétrie centrale 180°).
    Anneau centré (128,128), rayon ext. R, épaisseur t. Hampe du d tangente à droite,
    du centre vers le haut (+a) ; jambage du p tangent à gauche, vers le bas (+a)."""
    c = 128
    ring = circle(c, c, R) + " " + circle(c, c, R - t, cw=False)
    if round_ends:
        r = t / 2
        d_stem = (f"M{f(c + R - t)} {f(c)} V{f(c - R - a + r)} A{f(r)} {f(r)} 0 0 1 {f(c + R)} {f(c - R - a + r)} "
                  f"V{f(c + R)} H{f(c + R - t)} Z")
        p_stem = (f"M{f(c - R + t)} {f(c)} V{f(c + R + a - r)} A{f(r)} {f(r)} 0 0 1 {f(c - R)} {f(c + R + a - r)} "
                  f"V{f(c - R)} H{f(c - R + t)} Z")
    else:
        d_stem = rect(c + R - t, c - R - a, t, 2 * R + a)
        p_stem = rect(c - R, c - R, t, 2 * R + a)
    return path(f"{ring} {d_stem} {p_stem}", fill_rule="nonzero")


def c_barres():
    """C — Les heures pleines : trois colonnes (affluence), la colonne creuse
    complétée par une pastille rejoint les deux autres. Colonnes 48, écart 20."""
    w, g, top, bot = 48, 20, 40, 216
    x1, x2, x3 = 36, 36 + w + g, 36 + 2 * (w + g)
    r = w / 2
    col1 = rrect(x1, top, w, bot - top, r)
    col3 = rrect(x3, top, w, bot - top, r)
    dot = circle(x2 + r, top + r, r)
    col2 = rrect(x2, top + w + g, w, bot - top - w - g, r)
    return path(" ".join([col1, col2, col3, dot]), fill_rule="nonzero")


def c_plaque():
    """C — La plaque émaillée : plaque de rue arrondie, filet intérieur, D en réserve."""
    plate = rrect(16, 40, 224, 176, 32, smooth=True)
    fil_o = rrect(30, 54, 196, 148, 20, smooth=True)
    fil_i = rrect(37, 61, 182, 134, 14, smooth=True)
    d_o = "M84 82 H132 A46 46 0 0 1 132 174 H84 Z"
    d_i = "M106 102 H132 A26 26 0 0 1 132 154 H106 Z"
    return path(" ".join([plate, fil_o, fil_i, d_o, d_i]))


VARIANTS = {
    "a-creneau-v1": a_creneau(),
    "a-creneau-bas-v1": a_creneau(cy_dot=146, cx_dot=136, rd=28),
    "b-dp-v1": b_dp(),
    "b-dp-rond-v1": b_dp(round_ends=True),
    "c-barres-v1": c_barres(),
    "c-plaque-v1": c_plaque(),
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, body in VARIANTS.items():
        with open(os.path.join(OUT, name + ".svg"), "w") as fh:
            fh.write(svg(body, title=f"Dealpick — esquisse {name}"))
        print(name)
