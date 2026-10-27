"""Planche de test HTML (remplace preview_sheet.py du skill, dont l'exécution est bloquée ici).

    python3 planche.py a.svg b.svg ... --refs dossier_concurrents -o planche.html

Pour chaque symbole : grande taille, échelle 128→16 px en taille réelle, pixels réels
16 et 32 px agrandis, fonds (blanc, rosé, marine, noir), une couleur inversée, flou
(test du plissement d'yeux), miroir, rotations, recadrage rond, tuile d'icône d'app,
onglet de navigateur, en-tête de site. Puis un test d'étagère avec les concurrents.
"""
import argparse
import html
import os
import re

ROSE = "#FBE3E8"
MARINE = "#14213D"


def inline(path_svg, cls="m"):
    s = open(path_svg).read()
    s = re.sub(r"<\?xml.*?\?>", "", s)
    s = re.sub(r"<title[^>]*>.*?</title>", "", s, flags=re.S)
    s = re.sub(r'fill="#(?:111|111111|000|000000)"', 'fill="currentColor"', s)
    s = re.sub(r"\swidth=\"[\d.]+\"|\sheight=\"[\d.]+\"", "", s, count=2)
    return s.replace("<svg", f'<svg class="{cls}" preserveAspectRatio="xMidYMid meet"', 1)


def ref_inline(path_svg):
    s = open(path_svg).read()
    s = re.sub(r"<title>.*?</title>", "", s)
    return s.replace("<svg", '<svg class="m" fill="currentColor"', 1)


CSS = f"""
@font-face {{ font-family: 'DM Sans'; src: url('{{font}}') format('truetype'); font-weight: 700; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; padding: 32px; font: 14px/1.4 -apple-system, 'Segoe UI', sans-serif; color: #222; background: #fff; }}
h1 {{ font-size: 20px; margin: 0 0 24px; }}
h2 {{ font-size: 15px; margin: 40px 0 12px; padding-top: 16px; border-top: 1px solid #ddd; }}
.row {{ display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; }}
.cell {{ display: flex; flex-direction: column; align-items: center; gap: 6px; }}
.cap {{ font-size: 11px; color: #888; }}
.m {{ display: block; width: 100%; height: 100%; }}
.box {{ display: flex; align-items: center; justify-content: center; }}
.pix {{ image-rendering: pixelated; border: 1px solid #eee; }}
.blur {{ filter: blur(5px); }}
.mir {{ transform: scaleX(-1); }}
.r90 {{ transform: rotate(90deg); }}
.r180 {{ transform: rotate(180deg); }}
.tile {{ border-radius: 22.5%; display: flex; align-items: center; justify-content: center; }}
.round {{ border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; }}
.tab {{ display: flex; align-items: center; gap: 8px; background: #f1f1f4; border-radius: 8px 8px 0 0;
        padding: 8px 14px; width: 220px; font-size: 12px; color: #333; }}
.hdr {{ display: flex; align-items: center; gap: 10px; padding: 16px 24px; background: #fff;
        border: 1px solid #eee; border-radius: 12px; width: 560px; font: 700 21px 'DM Sans'; letter-spacing: -.02em; }}
.hdr nav {{ margin-left: auto; display: flex; gap: 20px; font: 500 14px -apple-system, sans-serif; color: #555; }}
.shelf {{ display: flex; gap: 28px; align-items: center; padding: 20px; border-radius: 12px; }}
"""


def sizes_block(svg_inline, uid):
    cells = []
    for s in (128, 64, 48, 32, 24, 16):
        cells.append(f'<div class="cell"><div class="box" style="width:{s}px;height:{s}px">{svg_inline}</div>'
                     f'<span class="cap">{s}px</span></div>')
    # vrais pixels : rastérisation sur un canvas de 16/32 px, affichée agrandie
    for s, z in ((16, 6), (32, 3)):
        cells.append(f'<div class="cell"><canvas class="pix" data-src="{uid}" width="{s}" height="{s}" '
                     f'style="width:{s * z}px;height:{s * z}px"></canvas><span class="cap">{s}px réels ×{z}</span></div>')
    return '<div class="row">' + "".join(cells) + "</div>"


def contexts_block(svg_inline, name):
    bgs = [("#fff", "#111", "blanc"), (ROSE, MARINE, "rosé"), (MARINE, "#fff", "marine inversé"),
           ("#111", "#fff", "noir inversé"), ("linear-gradient(135deg,#c9a27e,#5b6b7a)", "#fff", "photo (simulée)")]
    cells = []
    for bg, fg, cap in bgs:
        cells.append(f'<div class="cell"><div class="box" style="width:120px;height:120px;background:{bg};color:{fg};'
                     f'padding:22px;border-radius:12px">{svg_inline}</div><span class="cap">{cap}</span></div>')
    for cls, cap in (("blur", "flou"), ("mir", "miroir"), ("r90", "90°"), ("r180", "180°")):
        cells.append(f'<div class="cell"><div class="box {cls}" style="width:96px;height:96px">{svg_inline}</div>'
                     f'<span class="cap">{cap}</span></div>')
    cells.append(f'<div class="cell"><div class="round" style="width:96px;height:96px;background:{ROSE};color:{MARINE};'
                 f'padding:20px">{svg_inline}</div><span class="cap">avatar rond</span></div>')
    for sz in (120, 60, 29):
        cells.append(f'<div class="cell"><div class="tile" style="width:{sz}px;height:{sz}px;background:{MARINE};color:#fff;'
                     f'padding:{sz * 0.2:.0f}px">{svg_inline}</div><span class="cap">icône {sz}px</span></div>')
    row1 = '<div class="row">' + "".join(cells) + "</div>"
    tab = (f'<div class="cell"><div class="tab"><div style="width:16px;height:16px;color:{MARINE}">{svg_inline}</div>'
           f'Dealpick — Bons plans…</div><span class="cap">onglet (16px)</span></div>')
    hdr = (f'<div class="cell"><div class="hdr"><div style="width:28px;height:28px;color:{MARINE}">{svg_inline}</div>'
           f'<span style="color:{MARINE}">Dealpick</span><nav><span>Comment ça marche</span><span>Commerçants</span></nav></div>'
           f'<span class="cap">en-tête (28px, nom en DM Sans non retouché)</span></div>')
    return row1 + '<div class="row" style="margin-top:20px">' + tab + hdr + "</div>"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("svgs", nargs="+")
    ap.add_argument("--refs", help="dossier de logos concurrents (SVG simple-icons)")
    ap.add_argument("--font", default="")
    ap.add_argument("-o", "--out", default="planche.html")
    ap.add_argument("--titre", default="Dealpick — planche de test")
    a = ap.parse_args()

    out_dir = os.path.dirname(os.path.abspath(a.out))
    parts = [f"<h1>{html.escape(a.titre)}</h1>"]
    data_srcs = {}
    for i, p in enumerate(a.svgs):
        name = os.path.splitext(os.path.basename(p))[0]
        s = inline(p)
        uid = f"s{i}"
        data_srcs[uid] = os.path.relpath(os.path.abspath(p), out_dir)
        parts.append(f"<h2>{html.escape(name)}</h2>")
        parts.append(f'<div class="row"><div class="box" style="width:240px;height:240px;border:1px solid #eee">{s}</div>'
                     f"<div>{sizes_block(s, uid)}</div></div>")
        parts.append(contexts_block(s, name))

    if a.refs:
        refs = sorted(x for x in os.listdir(a.refs) if x.endswith(".svg"))
        for bg, fg, cap in (("#fff", "#111", "blanc"), (MARINE, "#fff", "inversé")):
            parts.append(f"<h2>Test d'étagère — 32 px, {cap}</h2>")
            for p in a.svgs:
                cells = [f'<div style="width:32px;height:32px;color:{fg}">{ref_inline(os.path.join(a.refs, r))}</div>'
                         for r in refs]
                mid = len(cells) // 2
                cells.insert(mid, f'<div style="width:32px;height:32px;color:{fg};outline:2px dashed #e11d48;'
                                  f'outline-offset:6px">{inline(p)}</div>')
                parts.append(f'<div class="shelf" style="background:{bg}">' + "".join(cells) + "</div>")
            parts.append(f'<p class="cap">Références : {", ".join(r[:-4] for r in refs)} (simple-icons, '
                         f"marques de leurs propriétaires, étude uniquement).</p>")

    js = f"""
<script>
const SRC = {data_srcs!r};
for (const c of document.querySelectorAll('canvas[data-src]')) {{
  const img = new Image();
  img.onload = () => {{ const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); }};
  img.src = SRC[c.dataset.src];
}}
</script>"""
    doc = (f'<!doctype html><html lang="fr"><meta charset="utf-8"><title>{html.escape(a.titre)}</title>'
           f"<style>{CSS.replace('{font}', a.font)}</style><body>" + "".join(parts) + js + "</body></html>")
    open(a.out, "w").write(doc)
    print("écrit", a.out)


if __name__ == "__main__":
    main()
