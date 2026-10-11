// Harness de validação do PDF LAVIMAX.
// Extrai REPORT_FIELDS + funções PDF directamente do HTML de origem e gera PDFs de teste.
const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');
const vfs = require('pdfmake/build/vfs_fonts.js');

const SRC = process.env.SRC ||
  '/Users/paulo/Library/Mobile Documents/com~apple~CloudDocs/RELATÓRIOS QDO/LAVIMAX/Orcamento_Template_Lavimax.html';
const html = fs.readFileSync(SRC, 'utf8');

function slice(startMarker, endMarker) {
  const s = html.indexOf(startMarker);
  const e = html.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error('marcador não encontrado: ' + startMarker);
  return html.slice(s, e);
}
const reportFieldsSrc = html.includes('const REPORT_FIELDS')
  ? slice('const REPORT_FIELDS', 'function setQuoteMode') : 'const REPORT_FIELDS = [];';
const pdfSrc = slice('const PDF_COLORS', 'async function generateQuotePdf');
const logo = (html.match(/<div class="logo-container">\s*<img src="([^"]+)"/) || [])[1];

global.document = { querySelector: () => (logo ? { src: logo } : null) };
const lib = new Function(reportFieldsSrc + '\n' + pdfSrc +
  '\nreturn { buildQuoteDocDefinition, REPORT_FIELDS };')();

// Fontes Roboto a partir do vfs do pdfmake
const vfsData = vfs.pdfMake ? vfs.pdfMake.vfs : vfs;
const fontDir = path.join(__dirname, 'fonts');
fs.mkdirSync(fontDir, { recursive: true });
for (const [name, b64] of Object.entries(vfsData)) fs.writeFileSync(path.join(fontDir, name), Buffer.from(b64, 'base64'));
const f = n => path.join(fontDir, n);
const printer = new PdfPrinter({ Roboto: {
  normal: f('Roboto-Regular.ttf'), bold: f('Roboto-Medium.ttf'),
  italics: f('Roboto-Italic.ttf'), bolditalics: f('Roboto-MediumItalic.ttf') } });

function sampleItems(n) {
  const items = [
    { desc: 'Mão de obra', included: true, iva: '23' },
    { desc: 'Deslocações', included: true, iva: '23' }
  ];
  for (let i = 1; i <= n; i++) {
    items.push({ desc: 'Substituição de componente ' + i + ' — motor de portão seccionado', qty: String(i % 3 + 1), price: (25 + i * 7.5).toFixed(2).replace('.', ','), iva: i % 4 === 0 ? '6' : '23' });
    if (i % 5 === 0) items.push({ detail: true, text: 'Inclui afinação e testes de funcionamento' });
  }
  return items;
}

const SHORT = {
  occurrence: 'Infiltração de água proveniente da fração superior, comunicada pelo cliente a 02/10/2026.',
  damages: 'Placa eletrónica do esquentador danificada por contacto com água.\nCaixa de ligação com oxidação visível.',
  cause: 'Rotura em tubagem de abastecimento na fração superior.',
  repair: 'Substituição da placa eletrónica e da caixa de ligação, seguida de testes de funcionamento.'
};
const para = 'Verificou-se no local que o equipamento apresentava sinais evidentes de exposição prolongada a humidade, com depósitos calcários e corrosão nos terminais, o que inviabiliza a sua reparação em condições de segurança. ';
const LONG = {
  occurrence: (para + '\n').repeat(4),
  damages: (para + para + '\n').repeat(5),
  cause: (para + '\n').repeat(3),
  repair: (para + '\n').repeat(4)
};
const PARTIAL = { occurrence: SHORT.occurrence, damages: '', cause: '   ', repair: SHORT.repair };

function quote(n, type, report) {
  return {
    number: 'ORC-2026-499', date: '08/10/2026', validUntil: '16/10/2026',
    client: { name: 'Fidelidade — Sinistro 2026/123456', address: 'Rua das Flores 10, 2500-100 Caldas da Rainha', nif: '500 918 880', contact: 'perito@exemplo.pt' },
    location: 'Caldas da Rainha', deadline: '5 dias úteis', payment: 'Após conclusão',
    items: sampleItems(n),
    conditions: ['Mão de obra e deslocações incluídas no valor apresentado.', 'Orçamento válido por 8 dias a partir da data de emissão.', 'Materiais com garantia do fabricante.'],
    type, report
  };
}

const cases = [
  ['test-1-itens', quote(1, 'quote', null)],
  ['test-5-itens', quote(5, 'quote', null)],
  ['test-15-itens', quote(15, 'quote', null)],
  ['test-30-itens', quote(30, 'quote', null)],
  ['test-rel-curto-5-itens', quote(5, 'report', SHORT)],
  ['test-rel-longo-15-itens', quote(15, 'report', LONG)],
  ['test-rel-parcial-3-itens', quote(3, 'report', PARTIAL)],
  ['test-rel-vazio-3-itens', quote(3, 'report', { occurrence: '', damages: '', cause: '', repair: '' })]
];

(async () => {
  for (const [name, q] of cases) {
    const doc = printer.createPdfKitDocument(lib.buildQuoteDocDefinition(q));
    const outDir = process.env.OUT || path.join(__dirname, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, name + '.pdf');
    await new Promise((res, rej) => {
      const ws = fs.createWriteStream(out);
      doc.pipe(ws); doc.end(); ws.on('finish', res); ws.on('error', rej);
    });
    console.log(name.padEnd(28), (fs.statSync(out).size / 1024).toFixed(1) + ' KB');
  }
})().catch(e => { console.error(e); process.exit(1); });
