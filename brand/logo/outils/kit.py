"""Kit du symbole — concept C1 (biseau), indépendant du nom.

    python3 kit.py          # écrit ../kit/{svg,png,web}

Construction du master (canevas 256) :
  D de 184 de haut (y 36→220), large de 180 ; montant 44, horizontales 36, panse 40 à 3 h ;
  coins du montant r 16, coins intérieurs r 12 ; panse extérieure en demi-cercle (R 92).
  Deux coupes parallèles à 60°, jour de 18 = 36 × cos 60° : la coupe haute passe exactement
  par les deux points de tangence (extérieur et intérieur) ; la coupe basse part du pied du
  montant, sur son bord intérieur.
  Centrage optique : emprise décalée de 6 vers la droite (la masse du montant tire à gauche).
Version inversée (blanc ou rosé sur marine) : même silhouette, traits amincis d'environ 3 %
  (irradiation), jour légèrement ouvert.
Version petite taille (≤ 32 px) : plus grasse, jour de 22 = 44 × cos 60°.
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image  # noqa: E402

from svgkit import f  # noqa: E402
from variantes_c import S, biseau  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(HERE, "..", "kit")

MARINE = "#13294B"
ROSE = "#FBE3E8"
NOIR = "#000000"
BLANC = "#FFFFFF"

GEOMS = {
    # nom : (gabarit, jour)
    "master": (S(44, 36, 184, 180, 44, 36, 40, 16, 12), 18),
    "inverse": (S(44, 36, 184, 180, 42.5, 35, 39, 16, 12), 18.5),
    "petit": (S(38, 32, 192, 192, 52, 44, 48, 16, 6), 22),
}


def d(kind):
    s, g = GEOMS[kind]
    return " ".join(biseau(s, g, 60, foot=0))


def symbol_svg(kind, color, title, viewbox="0 0 256 256"):
    w = h = 256 if viewbox == "0 0 256 256" else None
    size = f' width="{w}" height="{h}"' if w else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}"{size} role="img" aria-labelledby="t">\n'
            f'  <title id="t">{title}</title>\n'
            f'  <path fill="{color}" fill-rule="evenodd" d="{d(kind)}"/>\n</svg>\n')


def tile_svg(kind, bg, fg, title, radius=0, size=1024, glyph=0.54):
    """Tuile carrée pleine (icône d'app) : le symbole occupe `glyph` de la hauteur."""
    k = size * glyph / 184
    off = size / 2 - 128 * k
    rx = f' rx="{f(size * radius)}"' if radius else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}" '
            f'role="img" aria-labelledby="t">\n  <title id="t">{title}</title>\n'
            f'  <rect width="{size}" height="{size}"{rx} fill="{bg}"/>\n'
            f'  <g transform="translate({f(off)} {f(off)}) scale({f(k)})">\n'
            f'    <path fill="{fg}" fill-rule="evenodd" d="{d(kind)}"/>\n  </g>\n</svg>\n')


def favicon_svg():
    """Favicon : version petite taille, cadrée serrée ; marine, rosé en mode sombre."""
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="31 28 200 200" role="img" aria-labelledby="t">\n'
            '  <title id="t">Dealpick</title>\n'
            f'  <style>path{{fill:{MARINE}}}@media (prefers-color-scheme:dark){{path{{fill:{ROSE}}}}}</style>\n'
            f'  <path fill-rule="evenodd" d="{d("petit")}"/>\n</svg>\n')


def render(svg_path, png_path, size):
    subprocess.run(["node", os.path.join(HERE, "render.js"), "svg", svg_path, png_path, str(size)], check=True)


def main():
    out_svg, out_png, out_web = (os.path.join(KIT, x) for x in ("svg", "png", "web"))
    for p in (out_svg, out_png, out_web):
        os.makedirs(p, exist_ok=True)

    files = {
        "symbole-marine.svg": symbol_svg("master", MARINE, "Symbole — marine"),
        "symbole-noir.svg": symbol_svg("master", NOIR, "Symbole — noir"),
        "symbole-blanc.svg": symbol_svg("inverse", BLANC, "Symbole — blanc (sur fond foncé)"),
        "symbole-rose.svg": symbol_svg("inverse", ROSE, "Symbole — rosé (sur marine)"),
        "symbole-petit-marine.svg": symbol_svg("petit", MARINE, "Symbole petite taille — marine"),
        "symbole-petit-noir.svg": symbol_svg("petit", NOIR, "Symbole petite taille — noir"),
        "symbole-petit-blanc.svg": symbol_svg("petit", BLANC, "Symbole petite taille — blanc"),
        "icone-app.svg": tile_svg("inverse", MARINE, BLANC, "Icône d'app — pleine page (le système arrondit)"),
        "icone-app-arrondie.svg": tile_svg("inverse", MARINE, BLANC, "Icône d'app — aperçu arrondi", radius=0.2237),
        "icone-app-rose.svg": tile_svg("master", ROSE, MARINE, "Icône d'app — variante rosé", radius=0.2237),
        "favicon.svg": favicon_svg(),
    }
    for name, content in files.items():
        open(os.path.join(out_svg, name), "w").write(content)

    # PNG de livraison (fond transparent pour les symboles)
    for name, sizes in (("symbole-marine", (256, 512, 1024)), ("symbole-noir", (1024,)), ("symbole-blanc", (1024,)),
                        ("symbole-rose", (1024,)), ("icone-app", (1024,)), ("icone-app-arrondie", (1024,))):
        for z in sizes:
            render(os.path.join(out_svg, name + ".svg"), os.path.join(out_png, f"{name}-{z}.png"), z)

    # icônes web
    tmp = os.path.join(out_web, "_tmp")
    os.makedirs(tmp, exist_ok=True)
    fav = os.path.join(out_svg, "favicon.svg")
    open(os.path.join(out_web, "favicon.svg"), "w").write(files["favicon.svg"])
    # ICO (16/32/48) : rendus séparés à la taille réelle, pas une réduction du grand
    petit_ico = os.path.join(tmp, "petit-ico.svg")
    open(petit_ico, "w").write(symbol_svg("petit", MARINE, "favicon", viewbox="31 28 200 200"))
    imgs = []
    for z in (16, 32, 48):
        p = os.path.join(tmp, f"ico-{z}.png")
        render(petit_ico, p, z)
        imgs.append(Image.open(p).convert("RGBA").resize((z, z)) if Image.open(p).size != (z, z) else Image.open(p).convert("RGBA"))
    imgs[-1].save(os.path.join(out_web, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)],
                  append_images=imgs[:-1])
    for name, svgname, z in (("apple-touch-icon.png", "icone-app.svg", 180), ("icon-192.png", "icone-app-arrondie.svg", 192),
                             ("icon-512.png", "icone-app-arrondie.svg", 512)):
        render(os.path.join(out_svg, svgname), os.path.join(out_web, name), z)
    # maskable : fond plein, symbole dans la zone sûre (cercle de 80 %)
    mask = os.path.join(tmp, "maskable.svg")
    open(mask, "w").write(tile_svg("inverse", MARINE, BLANC, "Icône maskable", glyph=0.46))
    render(mask, os.path.join(out_web, "icon-maskable-512.png"), 512)
    for p in os.listdir(tmp):
        os.remove(os.path.join(tmp, p))
    os.rmdir(tmp)

    manifest = {
        "name": "Dealpick",
        "short_name": "Dealpick",
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
        "theme_color": MARINE,
        "background_color": ROSE,
        "display": "standalone",
        "start_url": "../../../index.html",
        "scope": "../../../",
    }
    json.dump(manifest, open(os.path.join(out_web, "site.webmanifest"), "w"), ensure_ascii=False, indent=2)
    open(os.path.join(out_web, "head.html"), "w").write(
        "<!-- Icônes : chemins relatifs à la racine du site ; préfixer ../ dans les sous-dossiers -->\n"
        '<link rel="icon" href="assets/img/icons/favicon.ico" sizes="16x16 32x32 48x48">\n'
        '<link rel="icon" href="assets/img/icons/favicon.svg" type="image/svg+xml">\n'
        '<link rel="apple-touch-icon" href="assets/img/icons/apple-touch-icon.png">\n'
        '<link rel="manifest" href="assets/img/icons/site.webmanifest">\n')
    for root, _, names in os.walk(KIT):
        for n in sorted(names):
            print(os.path.relpath(os.path.join(root, n), KIT))


if __name__ == "__main__":
    main()
