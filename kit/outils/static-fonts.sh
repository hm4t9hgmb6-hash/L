#!/usr/bin/env bash
# Build the static font instances used by the A5 print files.
#
#   python3 -m venv /tmp/ftvenv && /tmp/ftvenv/bin/pip install fonttools brotli
#   PY=/tmp/ftvenv/bin/python bash kit/outils/static-fonts.sh
#
# Why static: Chromium embeds *variable* fonts in PDFs as Type 3 fonts, which
# print-shop preflight often flags. Static instances embed as CID TrueType.
# Sources are the exact variable files the site loads from Google Fonts (latin
# subset: French accents, œ, « », ’, €, U+00A0, U+202F). Both fonts are SIL OFL
# 1.1 with no Reserved Font Name, so instancing them is allowed.
#
# Instances match the CSS in kit/pitch-a5/pitch.css:
#   Fraunces 600, SOFT 24, WONK 0 (same settings as the site's h1/h2), optical
#   size frozen at 37.33 = the headline's 28 pt in CSS px, which is what
#   `font-optical-sizing: auto` picks in Chromium.
#   Manrope 400 / 500 / 600 (--weight-regular / --weight-medium / --weight-bold).
# Change a size or weight in the CSS → add or adjust an instance here.
set -euo pipefail

PY="${PY:-python3}"
OUT="$(cd "$(dirname "$0")/../pitch-a5/fonts" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FRAUNCES_URL="https://fonts.gstatic.com/s/fraunces/v38/6NUV8FyLNQOQZAnv9ZwIlOk.woff2"
MANROPE_URL="https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggexSg.woff2"

curl -sSf -o "$TMP/fraunces.woff2" "$FRAUNCES_URL"
curl -sSf -o "$TMP/manrope.woff2"  "$MANROPE_URL"

instance() { # <source> <output.woff2> <family> <style> <axis=value>...
  local src="$1" out="$2" family="$3" style="$4"; shift 4
  "$PY" -m fontTools varLib.instancer -q --static "$src" "$@" -o "$TMP/instance.ttf"
  # Name the instance after what it is (the inherited names describe the
  # variable font's default instance, e.g. "ExtraLight"), then save as WOFF2.
  "$PY" - "$TMP/instance.ttf" "$out" "$family" "$style" <<'PYEOF'
import sys
from fontTools.ttLib import TTFont
src, out, family, style = sys.argv[1:]
font = TTFont(src)
name = font["name"]
for nid in (16, 17, 25):            # typographic family/subfamily, variations PS prefix
    name.removeNames(nameID=nid)
ps = f"{family}-{style}".replace(" ", "")
for nid, value in {1: family, 2: "Regular", 4: f"{family} {style}", 6: ps,
                   16: family, 17: style, 3: f"{ps};static-instance"}.items():
    name.setName(value, nid, 3, 1, 0x409)
    name.setName(value, nid, 1, 0, 0)
font.flavor = "woff2"
font.save(out)
PYEOF
}

instance "$TMP/fraunces.woff2" "$OUT/fraunces-600-opsz37.woff2" "Fraunces" "SemiBold" wght=600 opsz=37.33 SOFT=24 WONK=0
instance "$TMP/manrope.woff2"  "$OUT/manrope-400.woff2"        "Manrope"  "Regular"  wght=400
instance "$TMP/manrope.woff2"  "$OUT/manrope-500.woff2"        "Manrope"  "Medium"   wght=500
instance "$TMP/manrope.woff2"  "$OUT/manrope-600.woff2"        "Manrope"  "SemiBold" wght=600

ls -l "$OUT"
