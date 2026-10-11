// Compara os PDFs de tests/out/ com a versão publicada, página a página.
// A baseline é gerada de ../index.html (= o que está no GitHub Pages) para
// tests/out/baseline/, salvo se BASELINE apontar para outra pasta.
// Renderiza com pdftoppm (PGM em tons de cinza), conta píxeis diferentes e
// exporta PNGs das páginas alteradas (e da baseline) para revisão visual.
// Uso: node compare-baseline.js [limiar%]   (por omissão 0.05%)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = process.env.OUT || path.join(__dirname, 'out');
const BASE = process.env.BASELINE || path.join(OUT, 'baseline');
if (!process.env.BASELINE) {
  execFileSync(process.execPath, [path.join(__dirname, 'run-test.js')], {
    env: { ...process.env, SRC: path.join(__dirname, '..', 'index.html'), OUT: BASE }, stdio: 'ignore'
  });
}
const PNG = path.join(OUT, 'png');
const THRESHOLD = parseFloat(process.argv[2] || '0.05');
const DPI = '50';

function which(bin) {
  for (const d of (process.env.PATH || '').split(':').concat(['/usr/local/bin', '/opt/homebrew/bin'])) {
    if (fs.existsSync(path.join(d, bin))) return path.join(d, bin);
  }
  throw new Error(bin + ' não encontrado (brew install poppler)');
}
const PDFTOPPM = which('pdftoppm');

function render(pdf, prefix, args) {
  execFileSync(PDFTOPPM, [...args, pdf, prefix]);
  const dir = path.dirname(prefix), base = path.basename(prefix);
  return fs.readdirSync(dir).filter(f => f.startsWith(base + '-')).sort()
    .map(f => path.join(dir, f));
}

function readPgm(file) {
  const buf = fs.readFileSync(file);
  // cabeçalho: P5\n<w> <h>\n<max>\n
  const m = buf.toString('latin1', 0, 64).match(/^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/);
  if (!m) throw new Error('PGM inválido: ' + file);
  return { w: +m[1], h: +m[2], px: buf.subarray(m[0].length) };
}

function diffPct(a, b) {
  if (a.w !== b.w || a.h !== b.h) return 100;
  let n = 0;
  for (let i = 0; i < a.px.length; i++) if (Math.abs(a.px[i] - b.px[i]) > 24) n++;
  return (100 * n) / a.px.length;
}

const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'lavimax-cmp-'));
fs.rmSync(PNG, { recursive: true, force: true });
fs.mkdirSync(PNG, { recursive: true });

const report = [];
for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.pdf')).sort()) {
  const name = f.replace(/\.pdf$/, '');
  const outPdf = path.join(OUT, f), basePdf = path.join(BASE, f);
  const outPages = render(outPdf, path.join(tmp, 'o_' + name), ['-gray', '-r', DPI]);
  const exportPng = pages => pages.forEach(p => {
    render(outPdf, path.join(PNG, `${name}`), ['-png', '-r', '80', '-f', String(p), '-l', String(p)]);
  });

  if (!fs.existsSync(basePdf)) {
    report.push({ caso: name, estado: 'SEM BASELINE', paginas: outPages.length });
    exportPng(outPages.map((_, i) => i + 1));
    continue;
  }
  const basePages = render(basePdf, path.join(tmp, 'b_' + name), ['-gray', '-r', DPI]);
  const changed = [];
  const n = Math.max(outPages.length, basePages.length);
  for (let i = 0; i < n; i++) {
    const pct = outPages[i] && basePages[i] ? diffPct(readPgm(outPages[i]), readPgm(basePages[i])) : 100;
    if (pct > THRESHOLD) changed.push({ pagina: i + 1, diff: +pct.toFixed(2) });
  }
  const estado = outPages.length !== basePages.length ? `PÁGINAS ${basePages.length}→${outPages.length}`
    : changed.length ? 'ALTERADO' : 'igual';
  report.push({ caso: name, estado, paginas: outPages.length, alteradas: changed });
  if (changed.length) {
    exportPng(changed.filter(c => c.pagina <= outPages.length).map(c => c.pagina));
    for (const c of changed.filter(c => c.pagina <= basePages.length)) {
      render(basePdf, path.join(PNG, `${name}.baseline`), ['-png', '-r', '80', '-f', String(c.pagina), '-l', String(c.pagina)]);
    }
  }
}
fs.rmSync(tmp, { recursive: true, force: true });

for (const r of report) {
  const pags = (r.alteradas || []).map(c => `p${c.pagina} ${c.diff}%`).join(', ');
  console.log(r.caso.padEnd(28), r.estado.padEnd(14), `${r.paginas} pág.`, pags);
}
console.log(`\nPNGs para revisão: ${PNG}`);
if (process.env.JSON) fs.writeFileSync(path.join(OUT, 'compare.json'), JSON.stringify(report, null, 2));
