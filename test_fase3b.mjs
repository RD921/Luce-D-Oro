// Fase 3b: fotos de produto, estoque (quantidade/apagar), categorias (ordem/mover) e dashboard.
import fs from 'node:fs';
import path from 'node:path';
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
let total = 0; const falhas = [];
const g = (n) => console.log(`\n== ${n}`);
function ok(c, nome, extra) { total++; if (c) { console.log(`  ok    ${nome}`); return; } falhas.push(nome + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); console.log(`  FALHA ${nome} ${extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''}`); }
async function api(m, rota, tk, corpo) {
  const r = await fetch(BASE + rota, { method: m, headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  let j = null; try { j = await r.json(); } catch { /* */ }
  return { status: r.status, json: j };
}
const reg = async (n, e) => (await api('POST', '/api/auth/register', null, { name: n, email: e, password: 'Senha#12345', confirmPassword: 'Senha#12345' })).json?.token;

async function principal() {
  const senha = 'RodrigoOuro#2026', donoEmail = 'rodrigoarrezzi@icloud.com';
  let r = await api('POST', '/api/auth/register', null, { name: 'Rodrigo Arrezzi', email: donoEmail, password: senha, confirmPassword: senha });
  if (r.status >= 400) r = await api('POST', '/api/auth/login', null, { email: donoEmail, password: senha });
  let dono = r.json?.token;
  const chave = fs.readFileSync(path.join(DATA_DIR, 'owner_setup_key.txt'), 'utf-8').trim();
  await api('POST', '/api/admin/setup/verify-owner', dono, { setupKey: chave });
  dono = (await api('POST', '/api/auth/login', null, { email: donoEmail, password: senha })).json.token;
  const suf = Date.now();
  const cli = await reg('Cli', `c.${suf}@t.com`);
  const atdEmail = `a.${suf}@t.com`, estEmail = `e.${suf}@t.com`;
  await reg('Atd', atdEmail); await reg('Est', estEmail);
  await api('POST', '/api/admin/team', dono, { email: atdEmail, role: 'atendente' });
  await api('POST', '/api/admin/team', dono, { email: estEmail, role: 'estoquista' });
  const atd = (await api('POST', '/api/auth/login', null, { email: atdEmail, password: 'Senha#12345' })).json.token;
  const est = (await api('POST', '/api/auth/login', null, { email: estEmail, password: 'Senha#12345' })).json.token;

  // produto de teste
  const novo = await api('POST', '/api/admin/products', dono, { name: `Teste ${suf}`, category_id: 'brincos', price: 100, stock: 10, description: 'x', image_primary: '/images/a.jpg' });
  ok(novo.status === 201, 'produto de teste criado', novo);
  const pid = novo.json?.id || novo.json?.productId;

  g('1. Fotos');
  r = await api('PUT', `/api/admin/products/${pid}/photos`, dono, { image_primary: '/uploads/b.png', images: ['/uploads/c.png', '/uploads/b.png', '/uploads/c.png', 'https://x.com/d.jpg'] });
  ok(r.status === 200 && r.json.image_primary === '/uploads/b.png' && JSON.stringify(r.json.images) === JSON.stringify(['/uploads/c.png', 'https://x.com/d.jpg']), 'troca principal e limpa repetidas', r.json);
  const lista = (await api('GET', '/api/admin/products', dono)).json;
  const p = lista.find((x) => x.id === pid);
  ok(p.image_primary === '/uploads/b.png' && p.images.length === 2, 'fotos gravadas no produto');
  const pub = await api('GET', '/api/catalog/products', null);
  const pubP = pub.json.find((x) => x.id === pid);
  ok(pubP?.image_primary === '/uploads/b.png', 'loja pública mostra a foto nova', pubP?.image_primary);
  ok((await api('PUT', `/api/admin/products/${pid}/photos`, dono, { image_primary: 'javascript:alert(1)' })).status === 400, 'endereço perigoso é recusado');
  ok((await api('PUT', `/api/admin/products/${pid}/photos`, dono, { image_primary: '' })).status === 400, 'foto principal vazia é recusada');
  ok((await api('PUT', `/api/admin/products/${pid}/photos`, dono, { image_primary: '/uploads/b.png', images: Array.from({ length: 13 }, (_, i) => `/uploads/${i}.png`) })).status === 400, 'mais de 12 fotos é recusado');
  ok((await api('PUT', `/api/admin/products/nao-existe/photos`, dono, { image_primary: '/uploads/b.png' })).status === 404, 'produto inexistente = 404');
  ok((await api('PUT', `/api/admin/products/${pid}/photos`, atd, { image_primary: '/uploads/z.png' })).status === 403, 'atendente não troca fotos');

  g('2. Estoque');
  r = await api('POST', '/api/admin/stock/set', est, { productId: pid, quantity: 25, reason: 'Contagem' });
  ok(r.status === 200 && r.json.newStock === 25, 'estoquista define o total em 25', r);
  let st = (await api('GET', '/api/admin/stock', est)).json;
  ok(st.products.find((x) => x.id === pid)?.stock === 25, 'estoque gravado');
  ok(st.movements.some((m) => m.product_id === pid && m.quantity_change === 15 && m.new_stock === 25), 'movimento registrado (+15)');
  ok((await api('POST', '/api/admin/stock/set', est, { productId: pid, quantity: -3 })).status === 400, 'quantidade negativa recusada');
  ok((await api('POST', '/api/admin/stock/set', est, { productId: pid, quantity: 2.5 })).status === 400, 'quantidade quebrada recusada');
  ok((await api('POST', '/api/admin/stock/set', atd, { productId: pid, quantity: 1 })).status === 403, 'atendente não altera estoque');
  r = await api('POST', '/api/admin/stock/set', dono, { productId: pid, quantity: 0 });
  ok(r.status === 200, 'dono zera o estoque (sem motivo é aceito)');
  ok((await api('POST', '/api/admin/stock/set', dono, { productId: 'x', quantity: 1 })).status === 404, 'produto inexistente = 404');

  g('3. Apagar produtos');
  ok((await api('DELETE', `/api/admin/products/${pid}/permanent`, est)).status === 403, 'estoquista não apaga produto');
  r = await api('DELETE', `/api/admin/products/${pid}/permanent`, dono);
  ok(r.status === 200, 'dono apaga produto sem vendas de vez', r);
  ok(!(await api('GET', '/api/admin/products', dono)).json.some((x) => x.id === pid), 'produto sumiu da lista');
  st = (await api('GET', '/api/admin/stock', dono)).json;
  ok(!st.products.some((x) => x.id === pid) && st.movements.every((m) => m.product_id !== pid), 'e do estoque e dos movimentos');
  // produto já vendido
  await api('POST', '/api/cart/items', cli, { productId: 'prod_riviera', variantTitle: '18 cm (Padrão)', quantity: 1 });
  const ped = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua X, 1', paymentMethod: 'Pix' });
  ok(ped.status === 201, 'pedido de teste', ped);
  r = await api('DELETE', '/api/admin/products/prod_riviera/permanent', dono);
  ok(r.status === 409 && /arquivar/i.test(r.json?.error || ''), 'produto vendido NÃO é apagado, sugere arquivar', r);
  r = await api('DELETE', '/api/admin/products/prod_riviera', dono);
  ok(r.status === 200, 'arquivar funciona');
  ok(!(await api('GET', '/api/catalog/products', null)).json.some((x) => x.id === 'prod_riviera'), 'arquivado some da loja');
  r = await api('POST', '/api/admin/products/prod_riviera/restore', dono);
  ok(r.status === 200, 'restaurar funciona');
  ok((await api('POST', '/api/admin/products/prod_riviera/restore', atd)).status === 403, 'atendente não restaura');

  g('4. Categorias');
  const cats = (await api('GET', '/api/admin/categories', dono)).json;
  const ids = cats.map((c) => c.id);
  const invertida = [...ids].reverse();
  r = await api('PUT', '/api/admin/categories-order', dono, { ids: invertida });
  ok(r.status === 200, 'reordena categorias', r);
  const dep = (await api('GET', '/api/admin/categories', dono)).json.map((c) => c.id);
  ok(JSON.stringify(dep) === JSON.stringify(invertida), 'nova ordem vale', dep);
  const pubCats = (await api('GET', '/api/catalog/categories', null)).json;
  const ativas = new Set(pubCats.map((c) => c.id));
  ok(JSON.stringify(pubCats.map((c) => c.id)) === JSON.stringify(invertida.filter((x) => ativas.has(x))), 'loja mostra a nova ordem');
  ok((await api('PUT', '/api/admin/categories-order', dono, { ids: ['nao-existe'] })).status === 400, 'ordem com categoria inexistente é recusada');
  ok((await api('PUT', '/api/admin/categories-order', dono, { ids: [ids[0], ids[0]] })).status === 400, 'ordem com repetida é recusada');
  ok((await api('PUT', '/api/admin/categories-order', atd, { ids })).status === 403, 'atendente não reordena');
  await api('PUT', '/api/admin/categories-order', dono, { ids });
  // mover produtos ao excluir
  const nc = await api('POST', '/api/admin/categories', dono, { name: `Temp ${suf}` });
  const ncId = nc.json.id;
  const pp = await api('POST', '/api/admin/products', dono, { name: `Mover ${suf}`, category_id: ncId, price: 10, stock: 1, description: 'x', image_primary: '/images/a.jpg' });
  r = await api('DELETE', `/api/admin/categories/${ncId}`, dono);
  ok(r.status === 409, 'excluir categoria com produtos pede destino', r);
  r = await api('DELETE', `/api/admin/categories/${ncId}?moveTo=${ncId}`, dono);
  ok(r.status === 400, 'destino igual à própria categoria é recusado');
  r = await api('DELETE', `/api/admin/categories/${ncId}?moveTo=nao-existe`, dono);
  ok(r.status === 400, 'destino inexistente é recusado');
  r = await api('DELETE', `/api/admin/categories/${ncId}?moveTo=${ids[0]}`, dono);
  ok(r.status === 200, 'move os produtos e exclui', r);
  const movido = (await api('GET', '/api/admin/products', dono)).json.find((x) => x.id === (pp.json.id || pp.json.productId));
  ok(movido?.category_id === ids[0], 'produto foi para a categoria de destino', movido?.category_id);

  g('5. Dashboard');
  for (const per of ['7d', '30d', '90d', 'all']) {
    r = await api('GET', `/api/admin/dashboard/insights?period=${per}`, dono);
    ok(r.status === 200 && r.json.serie.length === ({ '7d': 7, '30d': 30, '90d': 90, all: 90 })[per], `insights ${per}`, r.status);
  }
  r = await api('GET', '/api/admin/dashboard/insights?period=30d', dono);
  const rec = r.json.serie.reduce((a, d) => a + d.receita, 0);
  ok(rec > 0 && r.json.porCategoria.length > 0 && r.json.pagamentos.some((x) => /^Pix/.test(x.metodo)), 'mostra a venda de teste por dia, categoria e pagamento', r.json);
  ok(r.json.anterior && typeof r.json.anterior.receita === 'number', 'traz o período anterior para comparar');
  ok(typeof r.json.estoque.pecas === 'number' && r.json.aguardando >= 1, 'estoque e pedidos a atender');
  const d90 = await api('GET', '/api/admin/dashboard?period=90d', dono);
  ok(d90.status === 200, 'dashboard aceita 90 dias');
  ok((await api('GET', '/api/admin/dashboard/insights', atd)).status === 403, 'atendente não vê o dashboard');
  ok((await api('GET', '/api/admin/dashboard/insights', null)).status === 401, 'visitante recebe 401');
  ok((await api('GET', '/api/admin/dashboard/insights?period=zzz', dono)).status === 200, 'período inválido não quebra');

  console.log(`\n==== ${total - falhas.length}/${total} verificações passaram ====`);
  if (falhas.length) { console.log('\nFALHAS:'); falhas.forEach((f) => console.log(' - ' + f)); process.exit(1); }
}
principal().catch((e) => { console.error('ERRO NO TESTE:', e.message); process.exit(2); });
