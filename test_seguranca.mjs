// Fase 8 — validação de segurança. Rodar com o servidor limpo em :3001 (dev@x.com / g@x.com / c@x.com).
import fs from 'node:fs';
const base = 'http://localhost:3001';
const J = { 'content-type': 'application/json' };
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.log('FALHOU:', m); } };
const login = async (email, password) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: J, body: JSON.stringify({ email, password }) })).json()).token;
const dev = await login('dev@x.com', 'Rodrigo_Dev_30');
const cli = await login('c@x.com', 'x');

// 1) Toda rota /api/admin exige login e papel
const rotas = new Set();
for (const f of fs.readdirSync('server').filter((n) => n.endsWith('.ts'))) {
  const src = fs.readFileSync(`server/${f}`, 'utf8');
  for (const m of src.matchAll(/app\.(get|post|put|patch|delete)\(\s*'(\/api\/admin[^']*)'/g)) rotas.add(`${m[1].toUpperCase()} ${m[2]}`);
}
const PUBLICAS = new Set(['GET /api/admin/setup/status']);
let semLogin = 0, comoCliente = 0, n = 0;
for (const r of rotas) {
  if (PUBLICAS.has(r)) continue;
  const [metodo, rota] = r.split(' ');
  const url = base + rota.replace(/:\w+/g, '1');
  const opts = (t) => ({ method: metodo, headers: { ...J, ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: metodo === 'GET' || metodo === 'DELETE' ? undefined : '{}' });
  n++;
  const a = await fetch(url, opts(null));
  if (a.status !== 401) { semLogin++; console.log(`  sem login: ${r} -> ${a.status}`); }
  const b = await fetch(url, opts(cli));
  if (b.status !== 401 && b.status !== 403) { comoCliente++; console.log(`  como cliente: ${r} -> ${b.status}`); }
}
ok(n >= 60, `rotas admin encontradas (${n})`);
ok(semLogin === 0, `todas as rotas admin recusam quem não fez login (${semLogin} falhas)`);
ok(comoCliente === 0, `todas as rotas admin recusam cliente comum (${comoCliente} falhas)`);

// 2) Cabeçalhos
const h = await fetch(`${base}/api/health`);
ok(h.headers.get('x-content-type-options') === 'nosniff', 'nosniff');
ok(h.headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options');
ok(!!h.headers.get('referrer-policy') && !!h.headers.get('permissions-policy'), 'Referrer/Permissions-Policy');
ok(!h.headers.get('x-powered-by'), 'sem X-Powered-By');

// 3) CORS
let c = await fetch(`${base}/api/health`, { headers: { Origin: 'https://site-malicioso.example' } });
ok(!c.headers.get('access-control-allow-origin'), 'origem estranha não recebe CORS');
c = await fetch(`${base}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
ok(c.headers.get('access-control-allow-origin') === 'http://localhost:5173', 'localhost liberado em desenvolvimento');

// 4) Uploads
const b64 = (s, mime = 'image/png') => `data:${mime};base64,` + Buffer.from(s).toString('base64');
const up = async (data, name) => (await fetch(`${base}/api/admin/media`, { method: 'POST', headers: { ...J, Authorization: `Bearer ${dev}` }, body: JSON.stringify({ data, name }) }));
ok((await up(b64('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/svg+xml'), 'x.svg')).status === 400, 'SVG recusado');
ok((await up(b64('<html><script>alert(1)</script></html>'), 'x.png')).status === 400, 'HTML disfarçado de PNG recusado');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const ok1 = await up('data:image/png;base64,' + png.toString('base64'), '../../../etc/passwd');
const j = await ok1.json();
ok(ok1.status === 201 && /^\/uploads\/[\w.-]+$/.test(j.urlBase) && !j.urlBase.includes('..'), 'nome malicioso não vira caminho');
const got = await fetch(base + j.urlBase);
ok(got.status === 200 && got.headers.get('x-content-type-options') === 'nosniff' && (got.headers.get('content-security-policy') || '').includes("default-src 'none'"), 'imagem servida com nosniff e CSP restritiva');
for (const p of ['/uploads/../server/index.ts', '/uploads/%2e%2e/package.json', '/uploads/.env', '/uploads/']) ok([400, 403, 404].includes((await fetch(base + p)).status), `não expõe ${p}`);
ok((await fetch(`${base}/api/admin/media/..%2F..%2Fpackage`, { headers: { Authorization: `Bearer ${dev}` } })).status === 404, 'id de mídia com caminho não vaza arquivos');

// 5) Força bruta no login
const errado = (email) => fetch(`${base}/api/auth/login`, { method: 'POST', headers: J, body: JSON.stringify({ email, password: 'errada' }) });
let bloqueou = 0;
for (let i = 0; i < 10; i++) { const r = await errado('vitima@x.com'); if (r.status === 429) { bloqueou = i + 1; break; } }
ok(bloqueou === 9, `bloqueia na 9ª tentativa errada (bloqueou na ${bloqueou})`);
const r429 = await errado('vitima@x.com');
ok(r429.status === 429 && !!r429.headers.get('retry-after'), '429 com Retry-After');
ok((await fetch(`${base}/api/auth/login`, { method: 'POST', headers: J, body: JSON.stringify({ email: 'dev@x.com', password: 'Rodrigo_Dev_30' }) })).status === 200, 'outra conta continua entrando');

// 6) Sessão
ok((await fetch(`${base}/api/auth/me`, { headers: { Authorization: 'Bearer token-falso' } })).status === 401, 'token falso = 401');
const me = await (await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${dev}` } })).json();
ok(!JSON.stringify(me).match(/password|salt|hash/i), '/me não vaza senha/hash');

console.log(falhas ? `${falhas}/${total} falha(s)` : `Segurança OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
