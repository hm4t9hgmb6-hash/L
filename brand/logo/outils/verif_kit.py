"""Planche de vérification du kit : irradiation, petite taille, icônes, favicon clair/sombre.

    python3 verif_kit.py -o ../kit/verification.html
"""
import argparse
import os

from planche import inline

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(HERE, "..", "kit")
MARINE, ROSE = "#13294B", "#FBE3E8"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--out", default=os.path.join(KIT, "verification.html"))
    a = ap.parse_args()
    out_dir = os.path.dirname(os.path.abspath(a.out))
    rel = lambda p: os.path.relpath(os.path.join(KIT, p), out_dir)  # noqa: E731
    svg = lambda n: open(os.path.join(KIT, "svg", n)).read().split("?>")[-1]  # noqa: E731
    sym = lambda n, w: svg(n).replace("<svg", f'<svg style="width:{w}px;height:{w}px;display:block"', 1)  # noqa: E731
    pet = inline(os.path.join(KIT, "svg", "symbole-petit-noir.svg"))
    mas = inline(os.path.join(KIT, "svg", "symbole-noir.svg"))
    srcs = {"m": rel("svg/symbole-marine.svg"), "p": rel("svg/symbole-petit-marine.svg")}

    def px(key, z, zoom):
        return (f'<canvas class="pix" data-src="{key}" width="{z}" height="{z}" style="width:{z * zoom}px;height:{z * zoom}px">'
                f"</canvas>")

    tabs = ""
    for bg, fg, label in (("#f1f3f4", MARINE, "onglet clair"), ("#35363a", ROSE, "onglet sombre (favicon.svg passe au rosé)")):
        icon = pet.replace('class="m"', f'style="width:16px;height:16px;color:{fg};display:block"')
        tabs += (f'<div><div style="display:flex;align-items:center;gap:8px;background:{bg};color:{"#222" if bg[1] == "f" else "#ddd"};'
                 f'border-radius:8px 8px 0 0;padding:8px 14px;width:240px;font:12px sans-serif">{icon}Dealpick — Bons plans</div>'
                 f'<p class="cap">{label}</p></div>')
    html = f"""<!doctype html><html lang="fr"><meta charset="utf-8"><title>Vérification du kit</title>
<style>
body {{ margin: 0; padding: 36px; font: 14px/1.45 -apple-system, 'Segoe UI', sans-serif; color: #222; background: #fff; }}
h1 {{ font-size: 22px; margin: 0 0 6px; }} h2 {{ font-size: 15px; margin: 30px 0 12px; }}
.row {{ display: flex; gap: 22px; align-items: flex-end; flex-wrap: wrap; }}
.cap {{ font-size: 11.5px; color: #888; margin: 6px 0 0; }}
.box {{ padding: 26px; border-radius: 16px; }}
.pix {{ image-rendering: pixelated; border: 1px solid #eee; display: block; }}
.m {{ display: block; width: 100%; height: 100%; }}
</style><body>
<h1>Vérification du kit — symbole C1</h1>
<h2>1. Irradiation : marine sur blanc / blanc aminci sur marine / rosé sur marine</h2>
<div class="row">
  <div><div class="box" style="background:#fff;border:1px solid #eee">{sym("symbole-marine.svg", 200)}</div><p class="cap">master</p></div>
  <div><div class="box" style="background:{MARINE}">{sym("symbole-blanc.svg", 200)}</div><p class="cap">inversé, traits −3 %</p></div>
  <div><div class="box" style="background:{MARINE}">{sym("symbole-rose.svg", 200)}</div><p class="cap">rosé sur marine</p></div>
  <div><div class="box" style="background:{ROSE}">{sym("symbole-marine.svg", 200)}</div><p class="cap">marine sur rosé</p></div>
</div>
<h2>2. Petite taille : master (haut) et version petite taille (bas), pixels réels</h2>
<div class="row">
  <div>{px("m", 32, 4)}<p class="cap">master 32 px ×4</p></div><div>{px("m", 24, 4)}<p class="cap">master 24 px ×4</p></div>
  <div>{px("m", 16, 6)}<p class="cap">master 16 px ×6</p></div>
  <div style="width:30px"></div>
  <div>{px("p", 32, 4)}<p class="cap">petit 32 px ×4</p></div><div>{px("p", 24, 4)}<p class="cap">petit 24 px ×4</p></div>
  <div>{px("p", 16, 6)}<p class="cap">petit 16 px ×6</p></div>
  <div style="display:flex;gap:10px;align-items:flex-end">
    <div style="width:16px;height:16px;color:#111">{mas}</div><div style="width:16px;height:16px;color:#111">{pet}</div>
    <div style="width:24px;height:24px;color:#111">{mas}</div><div style="width:24px;height:24px;color:#111">{pet}</div>
  </div>
</div>
<h2>3. Icônes</h2>
<div class="row">
  <div><img src="{rel('web/apple-touch-icon.png')}" width="120" height="120" style="border-radius:27px;display:block"><p class="cap">apple-touch-icon (arrondi par iOS)</p></div>
  <div><img src="{rel('web/icon-192.png')}" width="96" height="96" style="display:block"><p class="cap">Android 192</p></div>
  <div style="position:relative"><img src="{rel('web/icon-maskable-512.png')}" width="160" height="160" style="display:block">
    <div style="position:absolute;left:16px;top:16px;width:128px;height:128px;border-radius:50%;border:2px dashed {ROSE}"></div>
    <p class="cap">maskable : zone sûre (cercle 80 %)</p></div>
  <div><img src="{rel('web/icon-maskable-512.png')}" width="120" height="120" style="border-radius:50%;display:block"><p class="cap">maskable, masque rond</p></div>
  <div style="display:flex;gap:12px;align-items:flex-end">
    <img src="{rel('web/apple-touch-icon.png')}" width="60" height="60" style="border-radius:13px">
    <img src="{rel('web/apple-touch-icon.png')}" width="40" height="40" style="border-radius:9px">
    <img src="{rel('web/apple-touch-icon.png')}" width="29" height="29" style="border-radius:6px">
  </div>
</div>
<h2>4. Favicon dans un onglet</h2>
<div class="row">{tabs}</div>
<script>const S={srcs!r};for(const c of document.querySelectorAll('canvas[data-src]')){{const i=new Image();
i.onload=()=>c.getContext('2d').drawImage(i,0,0,c.width,c.height);i.src=S[c.dataset.src];}}</script>
</body></html>"""
    open(a.out, "w").write(html)
    print("écrit", a.out)


if __name__ == "__main__":
    main()
