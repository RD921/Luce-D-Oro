// Rascunhos, publicação e versões do conteúdo. Requer servidor em :3001 limpo com dev@x.com / g@x.com / c@x.com.
const base = 'http://localhost:3001';
const J = { 'content-type': 'application/json' };
const login = async (email, password) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: J, body: JSON.stringify({ email, password }) })).json()).token;
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.log('FALHOU:', m); } };
const call = async (t, method, rota, body) => { const r = await fetch(`${base}/api/admin/${rota}`, { method, headers: { ...J, ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, d: await r.json().catch(() => ({})) }; };
const pub = async () => (await fetch(`${base}/api/content`)).json();
const dev = await login('dev@x.com', 'Rodrigo_Dev_30');
const cli = await login('c@x.com', 'x');

const base0 = await pub();
ok((await call(cli, 'GET', 'content/draft')).s >= 401, 'cliente sem acesso');
ok((await call(null, 'POST', 'content/publish')).s === 401, 'publicar sem login = 401');
ok((await call(dev, 'POST', 'content/publish')).s === 400, 'publicar sem rascunho = 400');

// rascunho não vai ao ar
let r = await call(dev, 'PUT', 'content/draft', { values: { story_title: 'Titulo em rascunho', footer_hours: 'Todo dia 10h' } });
ok(r.s === 200 && r.d.pendentes === 2, 'salva rascunho ' + JSON.stringify(r.d));
ok((await pub()).story_title === base0.story_title, 'site público NÃO muda com rascunho');
let d = await call(dev, 'GET', 'content/draft');
ok(d.d.alteracoes === 2 && d.d.campos.find((f) => f.key === 'story_title').value === 'Titulo em rascunho', 'rascunho listado');
let pv = await call(dev, 'GET', 'content/preview');
ok(pv.d.story_title === 'Titulo em rascunho', 'prévia mostra o rascunho');
ok((await call(dev, 'PUT', 'content/draft', { values: { logo_header: 'javascript:alert(1)' } })).s === 400, 'valida imagem no rascunho');
ok((await call(dev, 'PUT', 'content/draft', { values: { campo_inexistente: 'x' } })).s === 400, 'campo desconhecido');

// voltar ao valor publicado remove o rascunho daquele campo
await call(dev, 'PUT', 'content/draft', { values: { footer_hours: base0.footer_hours } });
d = await call(dev, 'GET', 'content/draft');
ok(d.d.alteracoes === 1, 'igual ao publicado = sem mudança');

// descartar
ok((await call(dev, 'DELETE', 'content/draft')).d.descartados === 1, 'descarta rascunho');
ok((await call(dev, 'GET', 'content/draft')).d.alteracoes === 0, 'rascunho vazio');

// publicar
await call(dev, 'PUT', 'content/draft', { values: { story_title: 'Versao A', story_tag: 'TAG A' } });
r = await call(dev, 'POST', 'content/publish', { note: 'Primeira publicação' });
ok(r.s === 200 && r.d.publicados === 2, 'publica ' + JSON.stringify(r.d));
let p = await pub();
ok(p.story_title === 'Versao A' && p.story_tag === 'TAG A', 'site público atualizado');
ok((await call(dev, 'GET', 'content/draft')).d.alteracoes === 0, 'rascunho limpo após publicar');

await call(dev, 'PUT', 'content/draft', { values: { story_title: 'Versao B' } });
await call(dev, 'POST', 'content/publish', { note: 'Segunda' });
ok((await pub()).story_title === 'Versao B', 'segunda publicação');

let vs = await call(dev, 'GET', 'content/versions');
ok(vs.d.length === 2 && vs.d[0].note === 'Segunda' && vs.d[1].changed === 2, 'histórico de versões');

// restaurar versão 1 -> vai ao rascunho, não ao ar
const v1 = vs.d[1].id;
r = await call(dev, 'POST', `content/versions/${v1}/restore`);
ok(r.s === 200 && r.d.diferencas === 1, 'restaura versão no rascunho ' + JSON.stringify(r.d));
ok((await pub()).story_title === 'Versao B', 'restaurar não muda o site ainda');
ok((await call(dev, 'GET', 'content/preview')).d.story_title === 'Versao A', 'prévia mostra a versão restaurada');
await call(dev, 'POST', 'content/publish', { note: 'Voltou à primeira' });
ok((await pub()).story_title === 'Versao A', 'publicar a restauração');
ok((await call(dev, 'POST', 'content/versions/9999/restore')).s === 404, 'versão inexistente 404');

// alteração direta (aba Conteúdo) também entra no histórico
await call(dev, 'PUT', 'content', { values: { story_tag: 'DIRETO' } });
vs = await call(dev, 'GET', 'content/versions');
ok(vs.d[0].note.includes('direta') && (await pub()).story_tag === 'DIRETO', 'alteração direta registrada');

// voltar tudo ao original
r = await call(dev, 'POST', 'content/reset-draft');
ok(r.d.diferencas >= 2, 'reset gera rascunho');
await call(dev, 'POST', 'content/publish', { note: 'Original' });
p = await pub();
ok(p.story_title === base0.story_title && p.story_tag === base0.story_tag, 'tudo voltou ao original');

const aud = JSON.stringify((await call(dev, 'GET', 'audit-logs')).d);
for (const a of ['CONTENT_DRAFT_SAVED', 'CONTENT_DRAFT_DISCARDED', 'CONTENT_PUBLISHED', 'CONTENT_VERSION_LOADED']) ok(aud.includes(a), 'auditoria ' + a);
console.log(falhas ? `${falhas}/${total} falha(s)` : `Rascunhos e versões OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
