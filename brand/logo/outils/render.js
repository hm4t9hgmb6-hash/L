// Rendu SVG -> PNG et capture de pages HTML, avec le Chromium préinstallé.
//
//   node render.js svg  <fichier.svg> <sortie.png> <largeur> [hauteur]   (fond transparent)
//   node render.js html <page.html>   <sortie.png> <largeur> [scale]      (page entière)
//
// Les PNG de petite taille (16, 32 px) sont rendus à leur taille réelle, sans
// suréchantillonnage : c'est ce que verra l'écran.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [mode, src, out, a, b] = process.argv.slice(2);
  const browser = await chromium.launch();
  try {
    if (mode === 'svg') {
      const svg = fs.readFileSync(src, 'utf8');
      const vb = /viewBox="([\d.\s-]+)"/.exec(svg)[1].trim().split(/\s+/).map(Number);
      const w = Number(a);
      const h = b ? Number(b) : Math.round(w * vb[3] / vb[2]);
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const data = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
      await page.setContent(`<html><body style="margin:0;background:transparent">
        <img src="${data}" style="display:block;width:${w}px;height:${h}px"></body></html>`);
      await page.waitForFunction(() => document.images[0].complete);
      await page.screenshot({ path: out, omitBackground: true });
    } else if (mode === 'html') {
      const w = Number(a || 1400);
      const scale = Number(b || 1);
      const page = await browser.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: scale });
      await page.goto('file://' + path.resolve(src));
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: out, fullPage: true });
    } else {
      throw new Error('mode inconnu : ' + mode);
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
