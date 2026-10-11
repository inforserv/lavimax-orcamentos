const fs = require('fs'); const { JSDOM } = require('jsdom');
const SRC = process.env.SRC ||
  '/Users/paulo/Library/Mobile Documents/com~apple~CloudDocs/RELATÓRIOS QDO/LAVIMAX/Orcamento_Template_Lavimax.html';
const html = fs.readFileSync(SRC, 'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g, '');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/',
  beforeParse(win) { win.sessionStorage.setItem('lavimax_auth', 'paulo.sousa@inforshine.pt'); win.confirm = () => true; } });
const w = dom.window;
const $ = id => w.document.getElementById(id);
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FALHA ') + m); if (!c) process.exitCode = 1; };
const nav = k => w.document.querySelector(`[data-nav="${k}"]`);

ok(!w.document.body.classList.contains('mode-report'), 'arranque em modo orçamento normal');
nav('report').click();
ok(w.document.body.classList.contains('mode-report'), 'menu "Orçamento c/ Relatório" activa modo relatório');
ok($('quoteViewTitle').textContent === 'Orçamento c/ Relatório', 'título da vista');
ok(nav('report').classList.contains('active') && !nav('quote').classList.contains('active'), 'item de menu destacado');
$('clientName').textContent = 'Seguradora X';
$('reportOccurrence').textContent = 'Infiltração';
$('reportRepair').textContent = 'Substituir placa';
w.eval('saveQuote()');
let qs = JSON.parse(w.localStorage.getItem('lavimax_quotes'));
ok(qs.length === 1 && qs[0].type === 'report', 'guardado com type=report');
ok(qs[0].report.occurrence === 'Infiltração' && qs[0].report.damages === '' && qs[0].report.repair === 'Substituir placa', 'campos do relatório guardados');
const rq = w.eval('readQuoteFromDom()');
ok(rq.type === 'report' && rq.report.occurrence === 'Infiltração', 'readQuoteFromDom inclui relatório');
ok(w.eval('pdfSuffix()') === '_Relatorio.pdf', 'nome do ficheiro _Relatorio.pdf');

nav('quote').click();
ok(!w.document.body.classList.contains('mode-report') && $('reportOccurrence').textContent === '', 'Novo Orçamento volta ao modo normal e limpa relatório');
$('clientName').textContent = 'Cliente Normal';
w.eval('saveQuote()');
qs = JSON.parse(w.localStorage.getItem('lavimax_quotes'));
ok(qs[0].type === 'quote' && qs[0].report === null, 'orçamento normal guardado com type=quote');
ok(w.eval('pdfSuffix()') === '.pdf', 'nome do ficheiro normal .pdf');

nav('history').click();
const rows = w.document.querySelectorAll('#quotesListContainer tbody tr');
ok(rows.length === 2, 'lista mostra os 2');
ok(rows[1].innerHTML.includes('c/ Relatório') && !rows[0].innerHTML.includes('c/ Relatório'), 'badge "c/ Relatório" só no relatório');

w.eval(`loadQuote('${qs[1].id}')`);
ok(w.document.body.classList.contains('mode-report') && $('reportOccurrence').textContent === 'Infiltração', 'editar repõe modo e campos');
ok(nav('report').classList.contains('active'), 'menu destacado ao editar relatório');
w.eval(`duplicateQuote('${qs[1].id}')`); w.eval('saveQuote()');
qs = JSON.parse(w.localStorage.getItem('lavimax_quotes'));
ok(qs[0].type === 'report' && qs[0].report.repair === 'Substituir placa' && qs[0].number !== qs[2].number, 'duplicar mantém tipo/relatório com número novo');

// Orçamento antigo sem campo type
qs.push({ id: 'qold', number: 'ORC-2026-400', date: '01/01/2026', validUntil: '', client: { name: 'Antigo', address: '', nif: '', contact: '' }, items: [], conditions: [], total: '0,00 €' });
w.localStorage.setItem('lavimax_quotes', JSON.stringify(qs));
w.eval(`loadQuote('qold')`);
ok(!w.document.body.classList.contains('mode-report') && w.eval('currentQuoteType') === 'quote', 'orçamento antigo (sem type) abre como normal');
$('toolbarNewBtn').click();
ok(w.eval('currentQuoteType') === 'quote', 'botão Novo da toolbar mantém modo');
