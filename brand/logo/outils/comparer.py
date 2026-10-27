"""Planche compacte de comparaison : chaque SVG en grand, en 48/32/16 px réels,
16 px agrandi ×6, inversé sur marine et sur rosé.

    python3 comparer.py a.svg b.svg ... -o comparer.html
"""
import argparse
import os

from planche import MARINE, ROSE, inline

CSS = """
body { margin: 0; padding: 24px; font: 13px -apple-system, sans-serif; color: #333; background: #fff; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 18px; }
.card { border: 1px solid #eee; border-radius: 10px; padding: 14px; }
.name { font-weight: 600; margin-bottom: 10px; }
.row { display: flex; gap: 12px; align-items: flex-end; }
.m { display: block; width: 100%; height: 100%; }
.pix { image-rendering: pixelated; border: 1px solid #eee; }
.inv { border-radius: 8px; display: flex; align-items: center; justify-content: center; }
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("svgs", nargs="+")
    ap.add_argument("-o", "--out", default="comparer.html")
    a = ap.parse_args()
    out_dir = os.path.dirname(os.path.abspath(a.out))
    cards, srcs = [], {}
    for i, p in enumerate(a.svgs):
        s = inline(p)
        srcs[f"s{i}"] = os.path.relpath(os.path.abspath(p), out_dir)
        sizes = "".join(f'<div style="width:{z}px;height:{z}px">{s}</div>' for z in (48, 32, 16))
        cards.append(
            f'<div class="card"><div class="name">{os.path.basename(p)[:-4]}</div><div class="row">'
            f'<div style="width:150px;height:150px">{s}</div>'
            f'<div><div class="row">{sizes}<canvas class="pix" data-src="s{i}" width="16" height="16" '
            f'style="width:96px;height:96px"></canvas></div>'
            f'<div class="row" style="margin-top:10px">'
            f'<div class="inv" style="width:64px;height:64px;background:{MARINE};color:#fff;padding:12px">{s}</div>'
            f'<div class="inv" style="width:64px;height:64px;background:{ROSE};color:{MARINE};padding:12px">{s}</div>'
            f'<div class="inv" style="width:64px;height:64px;transform:rotate(90deg)">{s}</div>'
            f"</div></div></div></div>")
    js = ("<script>const S=" + repr(srcs) + ";for(const c of document.querySelectorAll('canvas[data-src]')){"
          "const i=new Image();i.onload=()=>c.getContext('2d').drawImage(i,0,0,16,16);i.src=S[c.dataset.src];}</script>")
    open(a.out, "w").write(f'<!doctype html><meta charset="utf-8"><style>{CSS}</style><div class="grid">'
                           + "".join(cards) + "</div>" + js)
    print("écrit", a.out)


if __name__ == "__main__":
    main()
