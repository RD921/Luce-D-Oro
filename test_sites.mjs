// Fase 2 — conteúdo por site. Servidor limpo em :3001 (dev@x.com / g@x.com / c@x.com).
// Opcional: se o banco tinha um conteúdo antigo "LEGADO" em story_tag (antes da conversão), confere que foi preservado no site principal.
import http from 'node:http';
const J = { 'content-type': 'application/json' };
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.log('FALHOU:', m); } };
const req = (method, path, { token, site, host, body } = {}) => new Promise((resolve, reject) => {
  const headers = { ...J, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(site ? { 'X-Site-Id': site } : {}), ...(host ? { Host: host } : {}) };
  const r = http.request({ host: 'localhost', port: 3001, method, path, headers }, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { let j = {}; try { j = JSON.parse(d); } catch { /* texto */ } resolve({ s: res.statusCode, d: j, t: d }); }); });
  r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
});
const login = async (e, p) => (await req('POST', '/api/auth/login', { body: { email: e, password: p } })).d.token;
const dev = await login('dev@x.com', 'Rodrigo_Dev_30');
const ger = await login('g@x.com', 'Gerente#12345');
const cli = await login('c@x.com', 'x');
const HOST_X = 'clientex.example.com';

// Principal e migração
let r = await req('GET', '/api/admin/sites', { token: dev });
ok(r.s === 200 && r.d[0].id === 'luce-d-oro' && r.d[0].principal === true, 'site principal existe');
const legado = await req('GET', '/api/content');
if (legado.d.story_tag === 'LEGADO') console.log('  (migração preservou o conteúdo antigo no site principal)');

// Cadastro
ok((await req('POST', '/api/admin/sites', { token: ger, body: { nome: 'Teste' } })).s === 403, 'gerente não cadastra site');
ok((await req('POST', '/api/admin/sites', { token: cli, body: { nome: 'Teste' } })).s >= 401, 'cliente não cadastra site');
ok((await req('POST', '/api/admin/sites', { token: dev, body: { nome: 'A' } })).s === 400, 'nome curto');
ok((await req('POST', '/api/admin/sites', { token: dev, body: { nome: 'Loja Ok', dominio: 'http://<script>' } })).s === 400, 'domínio inválido');
r = await req('POST', '/api/admin/sites', { token: dev, body: { nome: 'Loja Cliente X', cliente: 'Cliente X Ltda', dominio: `https://${HOST_X}/`, tipo: 'Loja' } });
ok(r.s === 201 && r.d.id === 'loja-cliente-x' && r.d.dominio === HOST_X && r.d.status === 'em_construcao', 'cria site ' + JSON.stringify(r.d));
ok((await req('POST', '/api/admin/sites', { token: dev, body: { nome: 'Outra', dominio: HOST_X } })).s === 400, 'domínio duplicado');
const SX = 'loja-cliente-x';
ok((await req('GET', '/api/admin/sites', { token: ger })).s === 200, 'gerente lista sites (seletor)');
ok((await req('GET', '/api/admin/content', { token: dev, site: 'nao-existe' })).s === 400, 'X-Site-Id inválido = 400');

// Isolamento de conteúdo / rascunhos / versões
const base = (await req('GET', '/api/content')).d;
await req('PUT', '/api/admin/content/draft', { token: dev, site: SX, body: { values: { story_title: 'Titulo do Cliente X' } } });
ok((await req('GET', '/api/admin/content/draft', { token: dev })).d.alteracoes === 0, 'rascunho do site X não aparece no principal');
ok((await req('GET', '/api/admin/content/draft', { token: dev, site: SX })).d.alteracoes === 1, 'rascunho existe no site X');
ok((await req('POST', '/api/admin/content/publish', { token: dev, body: {} })).s === 400, 'principal não tem o que publicar');
r = await req('POST', '/api/admin/content/publish', { token: dev, site: SX, body: { note: 'Primeira do X' } });
ok(r.s === 200, 'publica no site X');
ok((await req('GET', '/api/content', { host: HOST_X })).d.story_title === 'Titulo do Cliente X', 'visitante do domínio X vê o conteúdo do X');
ok((await req('GET', '/api/content')).d.story_title === base.story_title, 'visitante do site principal não vê o conteúdo do X');
ok((await req('GET', '/api/content', { host: `${HOST_X}:3001` })).d.story_title === 'Titulo do Cliente X', 'porta no Host é ignorada');
ok((await req('GET', '/api/content', { host: 'dominio-desconhecido.com' })).d.story_title === base.story_title, 'domínio desconhecido cai no principal');
const vx = (await req('GET', '/api/admin/content/versions', { token: dev, site: SX })).d;
const vp = (await req('GET', '/api/admin/content/versions', { token: dev })).d;
ok(vx.length === 1 && !vp.some((v) => v.note === 'Primeira do X'), 'versões são por site');
ok((await req('POST', `/api/admin/content/versions/${vx[0].id}/restore`, { token: dev })).s === 404, 'não restaura versão de outro site');

// Isolamento de mídia
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
r = await req('POST', '/api/admin/media', { token: dev, site: SX, body: { data: png, name: 'logo-x.png' } });
ok(r.s === 201, 'envia imagem no site X');
const mid = r.d.id, murl = r.d.urlBase;
ok(!(await req('GET', '/api/admin/media?q=logo-x', { token: dev })).d.itens.some((i) => i.id === mid), 'imagem do X não aparece na biblioteca do principal');
ok((await req('GET', '/api/admin/media?q=logo-x', { token: dev, site: SX })).d.itens.some((i) => i.id === mid), 'aparece na biblioteca do X');
ok((await req('GET', `/api/admin/media/${mid}`, { token: dev })).s === 404, 'detalhe cruzado = 404');
ok((await req('DELETE', `/api/admin/media/${mid}`, { token: dev })).s === 404, 'exclusão cruzada = 404');
ok((await req('PUT', `/api/admin/media/${mid}`, { token: dev, body: { alt: 'x' } })).s === 404, 'edição cruzada = 404');
await req('PUT', '/api/admin/content', { token: dev, site: SX, body: { values: { logo_header: murl } } });
r = await req('DELETE', `/api/admin/media/${mid}`, { token: dev, site: SX });
ok(r.s === 409 && r.d.locais.some((l) => l.includes('logo_header')), 'imagem em uso no X não é excluída');
await req('PUT', '/api/admin/content', { token: dev, site: SX, body: { values: { logo_header: '' } } });

// Isolamento de SEO
await req('PUT', '/api/admin/seo', { token: dev, site: SX, body: { seo_title: 'SEO do Cliente X', seo_site_url: `https://${HOST_X}` } });
ok((await req('GET', '/api/seo', { host: HOST_X })).d.title === 'SEO do Cliente X', 'SEO público do X');
ok((await req('GET', '/api/seo')).d.title !== 'SEO do Cliente X', 'SEO do principal intacto');
ok((await req('GET', '/api/admin/seo', { token: dev })).d.valores.seo_title !== 'SEO do Cliente X', 'painel do principal não vê o SEO do X');
ok((await req('GET', '/sitemap.xml', { host: HOST_X })).t.includes(`https://${HOST_X}/`), 'sitemap por site');

// Edição e arquivamento
ok((await req('PUT', '/api/admin/sites/luce-d-oro', { token: dev, body: { status: 'arquivado' } })).s === 400, 'principal não pode ser arquivado');
r = await req('PUT', `/api/admin/sites/${SX}`, { token: dev, body: { status: 'ativo', cliente: 'Cliente X S/A' } });
ok(r.s === 200 && r.d.status === 'ativo' && r.d.cliente === 'Cliente X S/A', 'edita site');
await req('PUT', `/api/admin/sites/${SX}`, { token: dev, body: { status: 'arquivado' } });
ok((await req('GET', '/api/content', { host: HOST_X })).d.story_title === base.story_title, 'site arquivado deixa de responder pelo domínio');
ok((await req('PUT', '/api/admin/sites/inexistente', { token: dev, body: { nome: 'Xx' } })).s === 404, 'site inexistente = 404');
r = await req('GET', '/api/admin/sites', { token: dev });
const sx = r.d.find((x) => x.id === SX);
ok(sx && sx.midias === 1 && sx.publicacoes >= 1, 'contagens por site');

console.log(falhas ? `${falhas}/${total} falha(s)` : `Sites OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
