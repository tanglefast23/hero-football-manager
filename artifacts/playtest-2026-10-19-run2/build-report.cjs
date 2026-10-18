// Small renderer for this report's headings, tables, lists, and inline links.
const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;
const md = fs.readFileSync(path.join(dir, 'report.md'), 'utf8');
const facts = JSON.parse(fs.readFileSync(path.join(dir, 'facts.json')));
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => escape(s)
  .replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lines = md.split('\n');
const body = [];
const toc = [];
for (let i = 0; i < lines.length;) {
  const line = lines[i];
  if (!line.trim()) { i++; continue; }
  const heading = /^(#{1,3}) (.+)$/.exec(line);
  if (heading) {
    const level = heading[1].length;
    const id = slug(heading[2]);
    if (level === 2) toc.push({ id, text: heading[2] });
    body.push('<h' + level + ' id="' + id + '">' + inline(heading[2]) + '</h' + level + '>');
    i++; continue;
  }
  if (line.startsWith('|')) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith('|')) {
      const cells = lines[i++].split('|').slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      const tag = rows.length ? 'td' : 'th';
      rows.push('<tr>' + cells.map((c) => '<' + tag + '>' + inline(c) + '</' + tag + '>').join('') + '</tr>');
    }
    body.push('<div class="table-scroll"><table><thead>' + rows[0] + '</thead><tbody>' + rows.slice(1).join('') + '</tbody></table></div>');
    continue;
  }
  if (line.startsWith('- ')) {
    const items = [];
    while (i < lines.length && lines[i].startsWith('- ')) items.push('<li>' + inline(lines[i++].slice(2)) + '</li>');
    body.push('<ul>' + items.join('') + '</ul>'); continue;
  }
  const paragraph = [];
  while (i < lines.length && lines[i].trim() && !/^(#|\||- )/.test(lines[i])) paragraph.push(lines[i++]);
  body.push('<p>' + inline(paragraph.join(' ')) + '</p>');
}
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>HFM — Completed Chairman Playthrough</title><style>' +
  ':root{color-scheme:light;--paper:#f7f5ef;--ink:#172a30;--muted:#59696c;--line:#d7ddd7;--accent:#176451}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.65 system-ui,sans-serif}a{color:var(--accent);text-underline-offset:3px}a:focus-visible{outline:3px solid #b16b13;outline-offset:4px}header{background:#163d37;color:#fff;padding:36px max(24px,calc((100vw - 1120px)/2))}header p{margin:0 0 8px;font-size:14px;letter-spacing:.1em;text-transform:uppercase}.metrics{display:flex;gap:28px;flex-wrap:wrap}.metric strong{display:block;font-size:30px;line-height:1.3}.metric span{font-size:14px;color:#d6e4df}.layout{display:grid;grid-template-columns:210px minmax(0,850px);gap:42px;max-width:1160px;margin:32px auto;padding:0 24px}nav{font-size:14px;align-self:start;position:sticky;top:20px}nav a{display:block;margin-bottom:12px}main{min-width:0}h1{font-size:36px;line-height:1.2;margin:0 0 28px;letter-spacing:-.025em}h2{font-size:25px;line-height:1.3;margin:46px 0 18px;border-top:1px solid var(--line);padding-top:26px}h3{font-size:20px;line-height:1.4;margin:30px 0 12px}p{margin:0 0 18px}li{margin-bottom:14px}ul{padding-left:24px}code{font-size:.86em;background:#e8ece5;padding:2px 5px;border-radius:3px;overflow-wrap:anywhere}.table-scroll{overflow:auto;margin:22px 0}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.5}th,td{padding:11px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line);white-space:nowrap}th{background:#e8ece5}tbody tr:nth-child(even){background:#efefe8}footer{max-width:1120px;margin:40px auto;padding:20px 24px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}@media(max-width:850px){.layout{display:block}nav{position:static;display:flex;gap:8px 18px;flex-wrap:wrap;margin-bottom:30px}nav a{margin:0}h1{font-size:30px}header{padding:25px 24px}.metrics{gap:20px}.metric strong{font-size:25px}}@media print{nav,header{display:none}.layout{display:block;max-width:none;margin:0;padding:0}body{background:white;font-size:10pt}h2,h3{break-after:avoid}a{color:inherit}.table-scroll{overflow:visible}th,td{white-space:normal}footer{margin-top:15px}html{scroll-behavior:auto}}' +
  '</style><header><p>Hero Football Manager · Chairman · Seed ' + facts.careerSeed + '</p><div class="metrics">' +
  [['Hero Cup', 'Season 5 winner'], ['Division 1', 'Season 6 winner'], [String(facts.totals.all), 'actual fixtures'], [money.format(facts.final.cash), 'closing funds']].map(([value, label]) => '<div class="metric"><strong>' + escape(value) + '</strong><span>' + escape(label) + '</span></div>').join('') +
  '</div></header><div class="layout"><nav aria-label="Report sections">' + toc.map((t) => '<a href="#' + t.id + '">' + escape(t.text) + '</a>').join('') + '</nav><main>' + body.join('\n') + '</main></div><footer>Completed local browser career. Engine m2.9. No release deployment. ' +
  '<a href="report.md">Markdown</a> · <a href="facts.json">Verified facts</a> · <a href="provenance.json">Source and evidence limits</a></footer></html>\n';
fs.writeFileSync(path.join(dir, 'report.html'), html);
console.log(JSON.stringify({ ok: true, output: 'report.html', sections: toc.length, characters: html.length }));
