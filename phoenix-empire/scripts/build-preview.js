'use strict';
// Construit une version statique du site, sans serveur, pour un aperçu en ligne
// (par exemple un artefact claude.ai). L'API est simulée dans le navigateur par
// scripts/preview-runtime.js, qui réutilise le code de src/.
//
//   node scripts/build-preview.js <dossier-de-sortie>
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig, DAY_LABELS } = require('../src/config');
const { renderSite } = require('../src/render');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'preview-build'));

const cfg = loadConfig();
const pages = renderSite(PUBLIC, cfg, { baseUrl: '', preview: true });

const write = (rel, content) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

// Toutes les pages sont à la racine : les liens absolus deviennent relatifs.
function relink(s) {
  return s
    .replace(/\/assets\/img\/icons\.svg#/g, '#')
    .replace(/(["'`(])\/assets\//g, '$1assets/')
    .replace(/(["'`])\/legal\/([a-z-]+)/g, '$1legal-$2.html')
    .replace(/(["'`])\/(reserver|reservation|paiement-demo|admin)(?=[?#"'`])/g, '$1$2.html')
    .replace(/(["'`])\/#/g, '$1index.html#')
    .replace(/href="\/"/g, 'href="index.html"');
}

// Sprite d'icônes intégré à chaque page (pas de référence externe).
const sprite = fs.readFileSync(path.join(PUBLIC, 'assets/img/icons.svg'), 'utf8')
  .replace('<svg xmlns="http://www.w3.org/2000/svg">', '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">');

function prepare(html) {
  return relink(html)
    .replace(/<link rel="preload"[^>]*>\s*/g, '')
    .replace(/<link rel="canonical"[^>]*>\s*/g, '')
    .replace('<script src="assets/js/main.js" defer></script>', '<script src="assets/js/preview-api.js" defer></script>\n  <script src="assets/js/main.js" defer></script>')
    .replace(/(<p class="preview-bar"[\s\S]*?)<\/p>/, '$1<a href="admin.html">Espace studio</a></p>')
    .replace(/(<body[^>]*>)/, `$1\n${sprite}`);
}

const map = {
  '/index.html': 'index.html',
  '/reserver.html': 'reserver.html',
  '/reservation.html': 'reservation.html',
  '/paiement-demo.html': 'paiement-demo.html',
  '/admin.html': 'admin.html',
  '/legal/cgv.html': 'legal-cgv.html',
  '/legal/mentions-legales.html': 'legal-mentions-legales.html',
  '/legal/confidentialite.html': 'legal-confidentialite.html',
};

for (const [src, dest] of Object.entries(map)) {
  let html = prepare(pages.get(src));
  if (dest === 'paiement-demo.html') {
    // Aucun champ de carte bancaire dans l'aperçu : un simple bouton simule le paiement.
    html = html.replace(/<label class="field"><span class="label">Numéro de carte[\s\S]*?<\/div>\s*/, '');
  }
  if (dest === 'admin.html') {
    html = html.replace('<label class="field"><span>Mot de passe</span>',
      '<div class="notice notice--warn" style="margin-bottom:18px"><div><p>Aperçu : le mot de passe est <strong>demo</strong>.</p></div></div>\n    <label class="field"><span>Mot de passe</span>');
  }
  if (dest === 'index.html') {
    // La page principale est enveloppée par l'hébergeur : on retire doctype, html, head et body.
    const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1]
      .replace(/<meta charset[^>]*>\s*/, '')
      .replace(/<meta name="viewport"[^>]*>\s*/, '')
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${cfg.studio.name}</title>`);
    const body = /<body[^>]*>([\s\S]*?)<\/body>/.exec(html)[1];
    html = `${head.trim()}\n${body.trim()}\n`;
  }
  write(dest, html);
}

// Feuille de style : polices intégrées, et réglages propres à l'aperçu.
const fontData = (file) => `data:font/woff2;base64,${fs.readFileSync(path.join(PUBLIC, 'assets/fonts', file)).toString('base64')}`;
const css = fs.readFileSync(path.join(PUBLIC, 'assets/css/style.css'), 'utf8')
  .replace(/url\("\/assets\/fonts\/([^"]+)"\)/g, (m, f) => `url("${fontData(f)}")`)
  + `
/* Aperçu : contenu visible sans attendre le défilement, héros à la taille de son contenu. */
.reveal { opacity: 1; }
.hero { min-height: auto; }
.preview-bar a { margin-left: 12px; color: inherit; text-decoration: underline; text-underline-offset: 2px; font-weight: 700; }
`;
write('assets/css/style.css', css);

for (const f of ['main.js', 'booking.js', 'reservation.js', 'demo-pay.js', 'admin.js']) {
  write(`assets/js/${f}`, relink(fs.readFileSync(path.join(PUBLIC, 'assets/js', f), 'utf8')));
}
for (const f of ['logo.svg', 'favicon.svg']) {
  write(`assets/img/${f}`, fs.readFileSync(path.join(PUBLIC, 'assets/img', f)));
}

// Simulateur d'API : modules du serveur + routeur navigateur.
const shim = `module.exports = { DAY_KEYS: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], DAY_LABELS: ${JSON.stringify(DAY_LABELS)} };`;
const modules = { config: shim };
for (const name of ['time', 'availability', 'pricing', 'ics', 'bookings']) {
  modules[name] = fs.readFileSync(path.join(ROOT, 'src', `${name}.js`), 'utf8');
}
const bufferShim = 'const Buffer = { from: (s) => new TextEncoder().encode(String(s)), byteLength: (s) => new TextEncoder().encode(String(s)).length };';
const modulesJs = `{\n${Object.entries(modules).map(([name, code]) => `${JSON.stringify(name)}: function (module, exports, require) {\n${bufferShim}\n${code}\n}`).join(',\n')}\n}`;
const runtime = fs.readFileSync(path.join(__dirname, 'preview-runtime.js'), 'utf8')
  .replace('/*__CONFIG__*/null', JSON.stringify({ ...cfg, dayLabels: DAY_LABELS }))
  .replace('/*__MODULES__*/{}', () => modulesJs);
write('assets/js/preview-api.js', runtime);

console.log(`Aperçu construit dans ${OUT}`);
for (const f of fs.readdirSync(OUT, { recursive: true })) {
  const st = fs.statSync(path.join(OUT, f));
  if (st.isFile()) console.log(`  ${f}  ${(st.size / 1024).toFixed(1)} Ko`);
}
