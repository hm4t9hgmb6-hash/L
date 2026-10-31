// Export an A5 kit page to PDF and run the print checks from the kit handoff.
//
//   node kit/outils/export-pdf.js kit/pitch-a5/index.html kit/pitch-a5/pitch-a5.pdf
//
// Checks (exit code 1 if any fails):
//   - bundled fonts actually loaded (no silent fallback in the PDF);
//   - every printed element stays inside the 8 mm safe zone;
//   - the headline holds on 2 lines max;
//   - no widow (single word on a last line) in headlines, paragraphs, labels;
//   - French spacing: no plain space before : ; ? ! », after «, or between a
//     number and its unit (h, %, €, mm);
//   - reports where the 1.1 hook ends, as a share of the sheet height.
// Uses the preinstalled Chromium through Playwright.
const { chromium } = require('playwright');
const path = require('path');

const MM = 96 / 25.4;          // CSS px per millimetre
const SAFE_MM = 8;
const TOLERANCE_PX = 0.05;

(async () => {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) throw new Error('usage: node export-pdf.js <page.html> <out.pdf>');

  const browser = await chromium.launch();
  const failures = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
    await page.emulateMedia({ media: 'print' });
    await page.goto('file://' + path.resolve(src));
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);

    const report = await page.evaluate(({ MM, SAFE_MM, TOLERANCE_PX }) => {
      const res = { fonts: {}, outside: [], lines: {}, widows: [], spacing: [], sheets: [] };

      // Fonts: the families must be loaded from the bundled files.
      for (const fam of ['Fraunces', 'Manrope']) {
        res.fonts[fam] = [...document.fonts].some((f) => f.family.replace(/"/g, '') === fam && f.status === 'loaded');
      }

      // Line analysis: group each character by the top of its line box.
      const linesOf = (el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const chars = [];
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          for (let i = 0; i < n.data.length; i++) {
            const r = document.createRange();
            r.setStart(n, i); r.setEnd(n, i + 1);
            const rect = r.getClientRects()[0];
            if (rect && rect.width > 0) chars.push({ ch: n.data[i], top: Math.round(rect.top) });
          }
        }
        const lines = [];
        for (const c of chars) {
          const last = lines[lines.length - 1];
          if (last && Math.abs(last.top - c.top) <= 2) last.text += c.ch;
          else lines.push({ top: c.top, text: c.ch });
        }
        return lines.map((l) => l.text.trim());
      };

      for (const sheet of document.querySelectorAll('.sheet')) {
        const s = sheet.getBoundingClientRect();
        const safe = {
          left: s.left + SAFE_MM * MM, top: s.top + SAFE_MM * MM,
          right: s.right - SAFE_MM * MM, bottom: s.bottom - SAFE_MM * MM,
        };
        const info = { label: sheet.getAttribute('aria-label'), widthMm: s.width / MM, heightMm: s.height / MM };

        // Safe zone: every rendered element (HTML and SVG) except the sheet itself.
        for (const el of sheet.querySelectorAll('*')) {
          if (el.classList.contains('sheet__safe')) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          if (el.closest('svg') && ['title', 'desc', 'g'].includes(el.tagName)) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const over = {
            left: safe.left - r.left, top: safe.top - r.top,
            right: r.right - safe.right, bottom: r.bottom - safe.bottom,
          };
          const worst = Object.entries(over).filter(([, v]) => v > TOLERANCE_PX);
          if (worst.length) {
            res.outside.push({
              el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().replace(/\s+/g, '.') : ''),
              text: (el.textContent || '').trim().slice(0, 40),
              by: worst.map(([k, v]) => `${k} ${(v / MM).toFixed(2)} mm`).join(', '),
            });
          }
        }

        const hook = sheet.querySelector('.hook');
        if (hook) {
          const h = hook.getBoundingClientRect();
          info.hookBottomMm = (h.bottom - s.top) / MM;
          info.hookShare = (h.bottom - s.top) / s.height;
        }
        res.sheets.push(info);
      }

      // Headline: max 2 lines.
      for (const h of document.querySelectorAll('.sheet h1')) res.lines.headline = linesOf(h);

      // Widows: a last line made of a single word, on any multi-line block.
      const blocks = document.querySelectorAll('.sheet h1, .sheet h2, .sheet p, .sheet figcaption, .sheet .todo__id');
      for (const b of blocks) {
        const ls = linesOf(b);
        if (ls.length > 1) {
          const words = ls[ls.length - 1].split(/[\s  ]+/).filter(Boolean);
          if (words.length < 2) res.widows.push({ text: b.textContent.trim().slice(0, 50), last: ls[ls.length - 1] });
        }
        if (b.matches('.hook__lede, .hook__bridge')) res.lines[b.className] = ls;
      }

      // French spacing: inspect every visible text node of the sheets (SVG included).
      const rules = [
        [/ [:;?!»]/, 'plain space before : ; ? ! »'],
        [/« /, 'plain space after «'],
        [/[^  ][:;?!](\s|$)/, 'missing no-break space before : ; ? !'],
        [/\d (h|%|€|mm)(?=[\s.,;:!?)]|$)/, 'plain space between number and unit'],
        [/\d(h|%|€)(?=[\s.,;:!?)]|$)/, 'missing space between number and unit'],
        [/'/, "straight apostrophe (use ’)"],
      ];
      const tw = document.createTreeWalker(document.querySelector('.sheet').parentNode, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (!n.parentElement.closest('.sheet, title, desc')) continue;
        const t = n.data.replace(/[ \t\r\n]+/g, ' '); // keep U+00A0 / U+202F: \s would match them
        for (const [re, msg] of rules) if (re.test(t)) res.spacing.push({ msg, text: t.trim().slice(0, 60) });
      }
      return res;
    }, { MM, SAFE_MM, TOLERANCE_PX });

    // ---- Report -----------------------------------------------------------
    for (const [fam, ok] of Object.entries(report.fonts)) {
      console.log(`font ${fam}: ${ok ? 'loaded' : 'NOT LOADED'}`);
      if (!ok) failures.push(`font ${fam} not loaded`);
    }
    for (const s of report.sheets) {
      console.log(`sheet "${s.label}": ${s.widthMm.toFixed(1)} × ${s.heightMm.toFixed(1)} mm`);
      if (s.hookBottomMm) console.log(`  1.1 hook ends at ${s.hookBottomMm.toFixed(1)} mm from the top trim (${(s.hookShare * 100).toFixed(1)} % of the sheet)`);
    }
    console.log('headline lines:', JSON.stringify(report.lines.headline));
    for (const [k, v] of Object.entries(report.lines)) if (k !== 'headline') console.log(`${k} lines:`, JSON.stringify(v));
    if (report.lines.headline && report.lines.headline.length > 2) failures.push('headline exceeds 2 lines');

    if (report.outside.length) {
      failures.push(`${report.outside.length} element(s) outside the safe zone`);
      console.log('outside safe zone:'); console.table(report.outside);
    } else console.log('safe zone: all elements inside the 8 mm inset');

    if (report.widows.length) { failures.push('widows'); console.log('widows:'); console.table(report.widows); }
    else console.log('widows: none');

    if (report.spacing.length) { failures.push('French spacing'); console.log('spacing:'); console.table(report.spacing); }
    else console.log('French spacing: OK');

    await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
    console.log('PDF written:', out);
  } finally {
    await browser.close();
  }
  if (failures.length) { console.error('FAILED:', failures.join('; ')); process.exit(1); }
  console.log('All checks passed.');
})().catch((e) => { console.error(e.message); process.exit(1); });
