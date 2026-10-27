"""Planche des concepts (remplace concept_sheet.py du skill) : une colonne par concept,
grand symbole, lockups avec les deux noms, tailles réelles 64/32/16 px, idée en une
ligne, recommandation. Niveaux de gris ; touche de marine pour la recommandation.

    python3 planche_concepts.py v5 -o ../concepts.html
"""
import argparse
import os

from planche import inline

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
MARINE = "#142A4F"
ROSE = "#FBE3E8"

CONCEPTS = [
    ("a", "A — Le créneau rempli", "Lettre-symbole · contreforme pleine",
     "Le creux du D reçoit une pastille : l’heure vide devient pleine, le créneau est choisi."),
    ("b", "B — La porte", "Lettre-symbole · contreforme figurative",
     "La contreforme du D est une porte de boutique : on pousse, on entre, le commerce vit."),
    ("c", "C — Le deal", "Lettre-symbole · construction en deux pièces",
     "Deux pièces s’emboîtent pour faire le D : la droite, ancrée (le commerçant), la ronde (le client)."),
]

CSS = f"""
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: #fff; color: #1a1a1a; font: 14px/1.45 -apple-system, 'Segoe UI', Roboto, sans-serif; }}
.page {{ width: 1500px; padding: 48px 56px 40px; }}
h1 {{ font-size: 26px; letter-spacing: -.01em; margin: 0; }}
.sub {{ color: #777; margin: 6px 0 34px; }}
.cols {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }}
.col {{ border: 1px solid #e6e6e6; border-radius: 18px; padding: 26px; position: relative; }}
.col.reco {{ border: 2px solid #1a1a1a; }}
.badge {{ position: absolute; top: -13px; left: 24px; background: #1a1a1a; color: #fff; font-size: 12px;
          font-weight: 600; padding: 4px 10px; border-radius: 99px; }}
h2 {{ font-size: 19px; margin: 0; }}
.type {{ color: #888; font-size: 12.5px; margin: 2px 0 18px; }}
.big {{ background: #f3f3f3; border-radius: 14px; height: 260px; display: flex; align-items: center;
        justify-content: center; color: #111; }}
.big svg {{ width: 210px; height: 210px; }}
.lock {{ margin: 18px 0 0; display: flex; flex-direction: column; gap: 12px; }}
.lock img {{ height: 46px; width: auto; align-self: flex-start; }}
.sizes {{ display: flex; align-items: flex-end; gap: 18px; margin: 22px 0 6px; }}
.sizes .s {{ display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: #999; }}
.pix {{ image-rendering: pixelated; border: 1px solid #eee; }}
.idea {{ margin: 16px 0 0; font-size: 14.5px; }}
.hint {{ display: flex; gap: 12px; align-items: center; margin-top: 18px; padding: 14px; border-radius: 12px; background: {ROSE}; }}
.tile {{ width: 64px; height: 64px; border-radius: 15px; background: {MARINE}; color: #fff; display: flex;
         align-items: center; justify-content: center; padding: 13px; }}
.tile svg {{ width: 100%; height: 100%; }}
.hint img {{ height: 30px; }}
.foot {{ margin-top: 28px; color: #777; font-size: 12.5px; line-height: 1.6; }}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("version")
    ap.add_argument("--reco", default="a")
    ap.add_argument("-o", "--out", default=os.path.join(ROOT, "concepts.html"))
    a = ap.parse_args()
    out_dir = os.path.dirname(os.path.abspath(a.out))
    rel = lambda p: os.path.relpath(p, out_dir)  # noqa: E731
    cols, srcs = [], {}
    for key, title, kind, idea in CONCEPTS:
        sym = os.path.join(ROOT, f"concept-{key}-{a.version}.svg")
        s = inline(sym)
        srcs[key] = rel(sym)
        locks = "".join(f'<img src="{rel(os.path.join(ROOT, f"concept-{key}-lockup-{w}-{a.version}.svg"))}" alt="">'
                        for w in ("dealpick", "dealmarket"))
        sizes = "".join(f'<div class="s"><img src="{srcs[key]}" width="{z}" height="{z}" alt="">{z} px</div>'
                        for z in (64, 32, 16))
        sizes += (f'<div class="s"><canvas class="pix" data-src="{key}" width="16" height="16" '
                  f'style="width:64px;height:64px"></canvas>16 px ×4</div>')
        reco = key == a.reco
        hint = ""
        if reco:
            lk = os.path.join(ROOT, f"concept-{key}-lockup-dealpick-{a.version}.svg")
            vb = [float(v) for v in open(lk).read().split('viewBox="')[1].split('"')[0].split()]
            lk_svg = inline(lk).replace('class="m"', f'style="height:30px;width:{30 * vb[2] / vb[3]:.0f}px;color:{MARINE}"')
            hint = (f'<div class="hint"><div class="tile">{s}</div>{lk_svg}'
                    f'<span style="font-size:12px;color:{MARINE}">Touche de couleur : marine sur rosé</span></div>')
        cols.append(
            f'<div class="col{" reco" if reco else ""}">{"<span class=badge>Recommandé</span>" if reco else ""}'
            f'<h2>{title}</h2><div class="type">{kind}</div><div class="big">{s}</div>'
            f'<div class="lock">{locks}</div><div class="sizes">{sizes}</div>'
            f'<p class="idea"><b>Idée :</b> {idea}</p>{hint}</div>')
    js = ("<script>const S=" + repr(srcs) + ";for(const c of document.querySelectorAll('canvas[data-src]')){"
          "const i=new Image();i.onload=()=>c.getContext('2d').drawImage(i,0,0,16,16);i.src=S[c.dataset.src];}</script>")
    html = (f'<!doctype html><html lang="fr"><meta charset="utf-8"><title>Dealpick — concepts</title>'
            f'<style>{CSS}</style><body><div class="page">'
            f'<h1>Dealpick · Dealmarket — trois pistes de logo</h1>'
            f'<p class="sub">Niveaux de gris, tailles réelles. Chaque D vaut pour les deux noms : '
            f'le symbole remplace le D du mot.</p>'
            f'<div class="cols">{"".join(cols)}</div>'
            f'<p class="foot">Symboles et D dessinés sur mesure (tracés, aucun texte vivant). Reste du mot : DM Sans Bold '
            f'vectorisé, non retouché, provisoire (licence SIL OFL, usage logo autorisé) — le wordmark sera dessiné une fois '
            f'le nom arrêté. Recherche d’antériorité INPI / EUIPO à faire avant tout dépôt ou impression.</p>'
            f'</div>{js}</body></html>')
    open(a.out, "w").write(html)
    print("écrit", a.out)


if __name__ == "__main__":
    main()
