import fs from 'node:fs';
const p = 'assets/premium.css';
let t = fs.readFileSync(p, 'utf8');
if (!t.includes('.own-switch')) {
  t += `
/* Selecteur d horizon du cout de possession. */
.own-switch{display:inline-flex;gap:6px;flex-wrap:wrap}
.own-switch button{
  font-family:var(--sans);font-size:12.5px;font-weight:700;color:var(--mut);
  background:transparent;border:1px solid var(--line);border-radius:999px;
  padding:6px 14px;min-height:34px;cursor:pointer;
  transition:color 160ms var(--ease-out),border-color 160ms var(--ease-out),background-color 160ms var(--ease-out);
}
.own-switch button:hover{color:var(--txt);border-color:var(--line-bright)}
.own-switch button[aria-pressed="true"]{color:var(--gold);border-color:var(--gold-line);background:var(--gold-dim)}
.own-switch button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
`;
  fs.writeFileSync(p, t, 'utf8');
}
console.log('own-switch CSS present :', fs.readFileSync(p, 'utf8').includes('.own-switch'));
