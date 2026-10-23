// Posição arrastada dos elementos (editor visual). Servidor limpo em :3001 com dev@x.com / g@x.com / c@x.com.
const base = 'http://localhost:3001';
const J = { 'content-type': 'application/json' };
const login = async (email, password) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: J, body: JSON.stringify({ email, password }) })).json()).token;
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.log('FALHOU:', m); } };
const call = async (t, method, rota, body) => { const r = await fetch(`${base}/api/admin/${rota}`, { method, headers: { ...J, Authorization: `Bearer ${t}` }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, d: await r.json().catch(() => ({})) }; };
const pub = async () => (await fetch(`${base}/api/content`)).json();
const dev = await login('dev@x.com', 'Rodrigo_Dev_30');

const campos = (await call(dev, 'GET', 'content/draft')).d.campos;
const pos = campos.filter((c) => c.type === 'position');
ok(pos.length === 28 && pos.some((c) => c.key === 'pos_story_title') && pos.some((c) => c.key === 'posm_logo_header'), 'campos de posição (computador e celular) existem');
ok((await call(dev, 'GET', 'content')).d.filter((c) => c.type === 'position').length === 28, 'aparecem na lista do painel com tipo position');

for (const ruim of ['abc', '10', '10,', '101,5', '5,2001', '1;2,3', '<b>,1', '5,5,5']) {
  ok((await call(dev, 'PUT', 'content/draft', { values: { pos_story_title: ruim } })).s === 400, `rejeita posição inválida "${ruim}"`);
}
let r = await call(dev, 'PUT', 'content/draft', { values: { pos_story_title: '12.5,-30', posm_story_title: '-4,8' } });
ok(r.s === 200 && r.d.pendentes === 2, 'salva posições no rascunho');
ok(!('pos_story_title' in (await pub())) || (await pub()).pos_story_title === '', 'site público não muda antes de publicar');
ok((await call(dev, 'GET', 'content/preview')).d.pos_story_title === '12.5,-30', 'prévia mostra a posição');
r = await call(dev, 'POST', 'content/publish', { note: 'mover título' });
ok(r.s === 200, 'publica posições');
const p = await pub();
ok(p.pos_story_title === '12.5,-30' && p.posm_story_title === '-4,8', 'site público recebe as posições');

// restaurar posição (valor vazio) volta ao original
await call(dev, 'PUT', 'content/draft', { values: { pos_story_title: '' } });
await call(dev, 'POST', 'content/publish', { note: 'restaurar' });
const p2 = await pub();
ok(!p2.pos_story_title && p2.posm_story_title === '-4,8', 'restaurar limpa só o computador');

// versões guardam posição
const vs = (await call(dev, 'GET', 'content/versions')).d;
ok(vs.length === 2, 'posições entram no histórico de versões');
r = await call(dev, 'POST', `content/versions/${vs[1].id}/restore`);
ok(r.s === 200 && r.d.diferencas === 1, 'restaurar versão antiga traz a posição de volta ao rascunho');

console.log(falhas ? `${falhas}/${total} falha(s)` : `Posição OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
