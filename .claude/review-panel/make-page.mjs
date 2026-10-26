// Turns a judge's summary.md into one page Anton can read on his phone (published with the Artifact
// tool; see the review-panel skill). The Markdown is turned into HTML here (no library); the sceptic's
// view gets its own panel, as Anton asked.
//   node .claude/review-panel/make-page.mjs reviews/2026-10-26-app/summary.md <out.html> "App Review Panel"
import { readFileSync, writeFileSync } from 'node:fs';

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (t) =>
  esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');

/** Just enough Markdown for the judge's reports. */
function toHtml(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const html = [];
  let para = [];
  const flush = () => { if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (/^```/.test(line)) { flush(); const code = []; for (i++; i < lines.length && !/^```/.test(lines[i]); i++) code.push(lines[i]); i++; html.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) { flush(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\s*\|/.test(line)) {
      flush();
      const rows = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      const [head, , ...body] = rows;
      html.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flush();
      // A list: items by indentation; a deeper item opens a list inside the one before it.
      const stack = [];
      for (; i < lines.length; i++) {
        const l = lines[i];
        const m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
        if (!m) {
          if (/^\s+\S/.test(l) && stack.length) { html.push(` ${inline(l.trim())}`); continue; } // a wrapped line
          if (l.trim() === '' && /^\s*([-*]|\d+\.)\s+|^\s{2,}\S/.test(lines[i + 1] ?? '')) continue;
          break;
        }
        const depth = m[1].length, tag = /\d/.test(m[2]) ? 'ol' : 'ul';
        while (stack.length && depth < stack[stack.length - 1].depth) html.push(`</li></${stack.pop().tag}>`);
        if (!stack.length || depth > stack[stack.length - 1].depth) { stack.push({ depth, tag }); html.push(`<${tag}><li>`); }
        else html.push('</li><li>');
        html.push(inline(m[3]));
      }
      while (stack.length) html.push(`</li></${stack.pop().tag}>`);
      continue;
    }
    if (line.trim() === '' || /^---+$/.test(line.trim())) { flush(); i++; continue; }
    para.push(line.trim());
    i++;
  }
  flush();
  return html.join('');
}

const [src, out, title] = process.argv.slice(2);
if (!src || !out || !title) throw new Error('usage: make-page.mjs <summary.md> <out.html> <title>');
const body = toHtml(readFileSync(src, 'utf8'));
const folder = src.replace(/\/summary\.md$/, '');

writeFileSync(
  out,
  `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Unbounded:wght@600;800&display=swap">
<style>
/* One reading column over Green Tracker's own night-time Aurora: display face for the few headings,
   body face for everything read, the sceptic in a violet panel of its own. Deliberately dark only. */
:root {
  --bg: #07110f; --panel: rgba(255,255,255,0.045); --line: rgba(160,255,220,0.14);
  --fg: #e8f3ee; --muted: #9db3aa; --accent: #5ee6b0; --teal: #4fd1e0; --violet: #b49cff;
  --display: 'Unbounded', 'Arial Black', system-ui, sans-serif;
  --body: 'Manrope', -apple-system, 'Segoe UI', system-ui, sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 var(--body);
  background-image: radial-gradient(60rem 30rem at 85% -10%, rgba(79,209,224,0.16), transparent 60%),
    radial-gradient(50rem 30rem at -10% 10%, rgba(94,230,176,0.12), transparent 60%);
  background-attachment: fixed;
}
.wrap { max-width: 44rem; margin: 0 auto; padding-block: 28px 64px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.brand { display: flex; gap: 10px; align-items: center; color: var(--accent); font: 600 12px/1 var(--body);
  letter-spacing: 0.14em; text-transform: uppercase; }
.brand svg { width: 18px; height: 18px; }
h1 { font: 800 clamp(26px, 7vw, 40px)/1.12 var(--display); margin: 14px 0 6px; text-wrap: balance;
  background: linear-gradient(90deg, var(--accent), var(--teal)); -webkit-background-clip: text; background-clip: text; color: transparent; }
h2 { font: 600 19px/1.3 var(--display); margin: 40px 0 12px; text-wrap: balance; color: var(--fg); }
h3 { font-size: 17px; margin: 24px 0 8px; }
p, li { max-width: 65ch; }
a { color: var(--teal); }
strong { color: #fff; }
code { font: 0.88em ui-monospace, Menlo, monospace; background: rgba(255,255,255,0.07); padding: 1px 5px; border-radius: 5px; overflow-wrap: anywhere; }
ul, ol { padding-left: 1.3em; display: grid; gap: 8px; }
li > ul, li > ol { margin-top: 6px; gap: 4px; }
li::marker { color: var(--accent); font-weight: 700; }
section.nutshell { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 4px 18px 10px; }
section.nutshell h2 { margin-top: 18px; color: var(--accent); }
section.sceptic { margin-top: 40px; border: 1px solid rgba(180,156,255,0.45); background: rgba(180,156,255,0.07);
  border-radius: 18px; padding: 4px 18px 12px; }
section.sceptic h2 { color: var(--violet); margin-top: 18px; }
section.sceptic li::marker { color: var(--violet); }
.table { overflow-x: auto; margin: 8px 0; border: 1px solid var(--line); border-radius: 12px; }
table { border-collapse: collapse; width: 100%; font-size: 14px; min-width: 34rem; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-weight: 700; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
tr:last-child td { border-bottom: 0; }
.foot { margin-top: 44px; color: var(--muted); font-size: 13px; }
</style>
<div class="wrap">
  <div class="brand"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c1.2 3 1.6 6.2 1 9.4 2-2.3 4.7-3.8 7.7-4.4-1.2 3.3-3.4 6-6.4 7.6 2 .3 3.9 1 5.6 2.2-2.6 1.1-5.4 1.2-8 .3l.1 4.9h-.1-.1l.1-4.9c-2.6.9-5.4.8-8-.3 1.7-1.2 3.6-1.9 5.6-2.2-3-1.6-5.2-4.3-6.4-7.6 3 .6 5.7 2.1 7.7 4.4-.6-3.2-.2-6.4 1-9.4z"/></svg>Green Tracker · review panel</div>
  <main id="doc">${body}</main>
  <p class="foot">Every reviewer’s full report is in the repo, in <code>${folder}/</code>. These are suggestions only: you choose what goes on the to-do list.</p>
</div>
<script>
const doc = document.getElementById('doc');
for (const t of doc.querySelectorAll('table')) { const w = document.createElement('div'); w.className = 'table'; t.replaceWith(w); w.append(t); }
// Each h2 with what follows it becomes a section; the nutshell and the sceptic get their own panels.
for (const h of [...doc.querySelectorAll('h2')]) {
  const s = document.createElement('section');
  const name = h.textContent.toLowerCase();
  if (name.includes('nutshell')) s.className = 'nutshell';
  if (name.includes('sceptic')) s.className = 'sceptic';
  h.before(s);
  let n = h;
  while (n && !(n !== h && n.tagName === 'H2')) { const next = n.nextElementSibling; s.append(n); n = next; }
}
</script>
`,
);
console.log(out);
