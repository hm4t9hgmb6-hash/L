"""Planche de comparaison des variantes de C (niveaux de gris, tailles réelles).

    python3 planche_variantes.py v6 -o ../variantes-c.html
"""
import argparse
import os

from planche import inline

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DIR = os.path.join(ROOT, "variantes-c")
MARINE = "#142A4F"
ROSE = "#FBE3E8"

VARS = [
    ("c0-actuel", "C0 — Actuel", "Référence", "Coupes droites : en haut à la tangence, en bas au pied du montant.",
     "En 16 px, les coupes s’effacent."),
    ("c1-biseau", "C1 — Biseau", "Forme des coupes", "Coupes parallèles à 60° : les deux pièces glissent l’une dans l’autre.",
     "Deux obliques : certains y liront un D « barré »."),
    ("c2-rond", "C2 — Bouts ronds", "Forme des coupes", "Bouts arrondis, panse d’épaisseur constante : un D tracé en deux gestes.",
     "Plus doux, un peu moins net en très petit."),
    ("c3-symetrique", "C3 — Symétrique", "Position des coupes", "Coupes aux deux tangences : la boutique ⊏ et le client ).",
     "Plus statique : l’idée d’emboîtement s’affaiblit."),
    ("c4-gras", "C4 — Gras", "Graisse", "Plus de matière, jours plus larges : les coupes tiennent jusqu’en 16 px.",
     "Plus massif ; contreforme plus petite."),
]

CSS = f"""
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: #fff; color: #1a1a1a; font: 14px/1.45 -apple-system, 'Segoe UI', Roboto, sans-serif; }}
.page {{ width: 1680px; padding: 44px 48px 36px; }}
h1 {{ font-size: 25px; margin: 0; letter-spacing: -.01em; }}
.sub {{ color: #777; margin: 6px 0 30px; }}
.cols {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; }}
.col {{ border: 1px solid #e6e6e6; border-radius: 16px; padding: 20px; }}
.col.ref {{ background: #fafafa; }}
h2 {{ font-size: 17px; margin: 0; }}
.type {{ color: #888; font-size: 12px; margin: 2px 0 14px; }}
.big {{ background: #f3f3f3; border-radius: 12px; height: 210px; display: flex; align-items: center; justify-content: center; color: #111; }}
.col.ref .big {{ background: #ececec; }}
.big svg {{ width: 170px; height: 170px; }}
.lock {{ margin: 16px 0 0; display: flex; flex-direction: column; gap: 10px; }}
.lock img {{ height: 34px; width: auto; align-self: flex-start; }}
.sizes {{ display: flex; align-items: flex-end; gap: 12px; margin: 18px 0 4px; }}
.sizes .s {{ display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10.5px; color: #999; }}
.pix {{ image-rendering: pixelated; border: 1px solid #eee; }}
.ctx {{ display: flex; gap: 10px; align-items: center; margin-top: 14px; padding: 12px; border-radius: 12px; background: {ROSE}; }}
.tile {{ border-radius: 22.5%; background: {MARINE}; color: #fff; display: flex; align-items: center; justify-content: center; }}
.tile svg {{ width: 100%; height: 100%; }}
.idea {{ margin: 14px 0 0; font-size: 13.5px; }}
.risk {{ margin: 6px 0 0; font-size: 12.5px; color: #8a5a00; }}
.foot {{ margin-top: 24px; color: #777; font-size: 12px; }}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("version")
    ap.add_argument("-o", "--out", default=os.path.join(ROOT, "variantes-c.html"))
    a = ap.parse_args()
    out_dir = os.path.dirname(os.path.abspath(a.out))
    rel = lambda p: os.path.relpath(p, out_dir)  # noqa: E731
    cols, srcs = [], {}
    for key, title, kind, idea, risk in VARS:
        sym = os.path.join(DIR, f"concept-{key}-{a.version}.svg")
        s = inline(sym)
        srcs[key] = rel(sym)
        locks = "".join(f'<img src="{rel(os.path.join(DIR, f"concept-{key}-lockup-{w}-{a.version}.svg"))}" alt="">'
                        for w in ("dealpick", "dealmarket"))
        sizes = "".join(f'<div class="s"><img src="{srcs[key]}" width="{z}" height="{z}" alt="">{z}</div>' for z in (64, 32, 16))
        sizes += (f'<div class="s"><canvas class="pix" data-src="{key}" width="16" height="16" '
                  f'style="width:64px;height:64px"></canvas>16 ×4</div>')
        ctx = "".join(f'<div class="tile" style="width:{z}px;height:{z}px;padding:{z * 0.19:.0f}px">{s}</div>' for z in (60, 40, 29))
        ctx += f'<div style="width:28px;height:28px;color:{MARINE}">{s}</div>'
        cols.append(
            f'<div class="col{" ref" if key.startswith("c0") else ""}"><h2>{title}</h2><div class="type">{kind}</div>'
            f'<div class="big">{s}</div><div class="lock">{locks}</div><div class="sizes">{sizes}</div>'
            f'<div class="ctx">{ctx}</div><p class="idea">{idea}</p><p class="risk">Risque : {risk}</p></div>')
    js = ("<script>const S=" + repr(srcs) + ";for(const c of document.querySelectorAll('canvas[data-src]')){"
          "const i=new Image();i.onload=()=>c.getContext('2d').drawImage(i,0,0,16,16);i.src=S[c.dataset.src];}</script>")
    html = (f'<!doctype html><html lang="fr"><meta charset="utf-8"><title>Dealpick — variantes de C</title>'
            f'<style>{CSS}</style><body><div class="page">'
            f'<h1>Concept C, le deal — quatre variantes</h1>'
            f'<p class="sub">Position et forme des coupes, graisse. Niveaux de gris et tailles réelles ; '
            f'icônes d’app en marine sur rosé. Les variantes se combinent (par exemple bouts ronds + gras).</p>'
            f'<div class="cols">{"".join(cols)}</div>'
            f'<p class="foot">D dessiné sur mesure, arcs exacts. Reste du mot : DM Sans Bold vectorisé, provisoire. '
            f'Nom à confirmer.</p></div>{js}</body></html>')
    open(a.out, "w").write(html)
    print("écrit", a.out)


if __name__ == "__main__":
    main()
