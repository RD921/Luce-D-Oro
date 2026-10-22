// SEO, notificações e integrações. Requer servidor limpo em :3001 com dev@x.com / g@x.com / c@x.com.
const base = 'http://localhost:3001';
const J = { 'content-type': 'application/json' };
const login = async (email, password) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: J, body: JSON.stringify({ email, password }) })).json()).token;
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.log('FALHOU:', m); } };
const call = async (t, method, rota, body) => { const r = await fetch(`${base}${rota}`, { method, headers: { ...J, ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, d: await r.json().catch(() => ({})) }; };
const dev = await login('dev@x.com', 'Rodrigo_Dev_30');
const ger = await login('g@x.com', 'Gerente#12345');
const cli = await login('c@x.com', 'x');

// SEO
let r = await call(null, 'GET', '/api/seo');
ok(r.s === 200 && r.d.title && r.d.noindex === false, 'SEO público com padrões');
ok((await call(cli, 'GET', '/api/admin/seo')).s >= 401, 'cliente sem acesso ao SEO');
ok((await call(ger, 'GET', '/api/admin/seo')).s === 403, 'gerente sem Configurações = 403');
ok((await call(dev, 'PUT', '/api/admin/seo', { seo_site_url: 'javascript:alert(1)' })).s === 400, 'URL inválida');
ok((await call(dev, 'PUT', '/api/admin/seo', { seo_og_image: 'data:text/html;base64,xx' })).s === 400, 'imagem inválida');
ok((await call(dev, 'PUT', '/api/admin/seo', { seo_category_title: 'sem marcador' })).s === 400, 'modelo sem {categoria}');
ok((await call(dev, 'PUT', '/api/admin/seo', { seo_title: 'x'.repeat(200) })).s === 400, 'título longo');
ok((await call(dev, 'PUT', '/api/admin/seo', { qualquer: 'x' })).s === 400, 'campo desconhecido');
r = await call(dev, 'PUT', '/api/admin/seo', { seo_title: 'Meu título', seo_description: 'Minha descrição', seo_site_url: 'https://exemplo.com.br/', seo_og_image: '/uploads/a.png' });
ok(r.s === 200, 'salva SEO');
r = await call(null, 'GET', '/api/seo');
ok(r.d.title === 'Meu título' && r.d.siteUrl === 'https://exemplo.com.br/' && r.d.ogImage === '/uploads/a.png', 'SEO público atualizado');
let rb = await (await fetch(`${base}/robots.txt`)).text();
ok(rb.includes('Disallow: /api/') && rb.includes('Sitemap: https://exemplo.com.br/sitemap.xml'), 'robots.txt com sitemap');
let sm = await fetch(`${base}/sitemap.xml`);
ok(sm.status === 200 && (await sm.text()).includes('<loc>https://exemplo.com.br/</loc>'), 'sitemap.xml');
await call(dev, 'PUT', '/api/admin/seo', { seo_noindex: '1' });
rb = await (await fetch(`${base}/robots.txt`)).text();
ok(rb.includes('Disallow: /') && !rb.includes('Sitemap'), 'ocultar dos buscadores');
ok((await fetch(`${base}/sitemap.xml`)).status === 404, 'sitemap some com noindex');
await call(dev, 'PUT', '/api/admin/seo', { seo_noindex: '0' });

// Notificações
r = await call(dev, 'GET', '/api/admin/notifications');
ok(r.s === 200 && r.d.itens.some((n) => n.titulo.includes('SEO')), 'SEO gerou notificação');
const antes = r.d.naoLidas;
ok(antes >= 1, 'há não lidas');
ok((await call(dev, 'POST', '/api/admin/notifications/read')).s === 200, 'marcar como lidas');
ok((await call(dev, 'GET', '/api/admin/notifications')).d.naoLidas === 0, 'zerou não lidas');
ok((await call(ger, 'GET', '/api/admin/notifications')).d.naoLidas >= 1, 'leitura é por usuário');
await call(dev, 'PUT', '/api/admin/seo', { seo_title: 'Outro título' });
ok((await call(dev, 'GET', '/api/admin/notifications')).d.naoLidas === 1, 'nova notificação conta como não lida');
ok((await call(dev, 'GET', '/api/admin/notifications?tipo=seguranca')).d.itens.every((n) => n.tipo === 'seguranca'), 'filtro por tipo');
ok((await call(cli, 'GET', '/api/admin/notifications')).s >= 401, 'cliente sem notificações');
ok((await call(null, 'GET', '/api/admin/notifications')).s === 401, 'sem login 401');

// Integrações
r = await call(dev, 'GET', '/api/admin/integrations');
const m = Object.fromEntries((r.d.itens || []).map((i) => [i.id, i.estado]));
ok(r.s === 200 && m.banco === 'ok' && m.armazenamento === 'ok', 'banco e armazenamento verificados');
ok(m.pagamento === 'nao_integrada' && m['email-transacional'] === 'nao_integrada' && m.analytics === 'nao_integrada', 'não integradas aparecem como tal');
ok(m.whatsapp === 'ok' && m['email-contato'] === 'ok', 'contatos configurados');
ok((await call(ger, 'GET', '/api/admin/integrations')).s === 403, 'gerente sem acesso');

console.log(falhas ? `${falhas}/${total} falha(s)` : `Fase 7 OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
