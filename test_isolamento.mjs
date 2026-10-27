// Fase 3 — isolamento entre lojas: a loja B não lê nem altera nada da loja A (e vice-versa). Servidor limpo em :3001 com dev@x.com / c@x.com.
import http from 'node:http';
let falhas = 0, total = 0;
const ok = (c, m, x) => { total++; if (!c) { falhas++; console.log('FALHOU:', m, x ?? ''); } };
const req = (method, path, { token, site, host, body } = {}) => new Promise((resolve, reject) => {
  const headers = { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(site ? { 'X-Site-Id': site } : {}), ...(host ? { Host: host } : {}) };
  const r = http.request({ host: 'localhost', port: 3001, method, path, headers }, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch {} resolve({ s: res.statusCode, d: j }); }); });
  r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
});
const login = async (e, p) => (await req('POST', '/api/auth/login', { body: { email: e, password: p } })).d.token;
const dev = await login('dev@x.com', 'Rodrigo_Dev_30');
const cli = await login('c@x.com', 'x');
const A = 'luce-d-oro', HB = 'loja-b.teste.com';

let r = await req('POST', '/api/admin/sites', { token: dev, body: { nome: 'Loja B', dominio: HB, tipo: 'Loja' } });
ok(r.s === 201, 'cria loja B', r);
const B = r.d.id;
const a = (m, p, body) => req(m, p, { token: dev, site: A, body });
const b = (m, p, body) => req(m, p, { token: dev, site: B, body });

// ---- Loja nova nasce vazia
for (const [rota, rotulo] of [['products', 'produtos'], ['categories', 'categorias'], ['banners', 'banners'], ['coupons', 'cupons'], ['orders', 'pedidos'], ['shipping', 'entregas'], ['payment-methods', 'pagamentos']]) {
  r = await b('GET', `/api/admin/${rota}`);
  ok(r.s === 200 && Array.isArray(r.d) && r.d.length === 0, `loja B nasce sem ${rotulo}`, r.d && r.d.length);
}
r = await a('GET', '/api/admin/products'); const prodsA = r.d.length; ok(prodsA > 0, 'loja A tem produtos');
ok((await req('GET', '/api/catalog/products', { host: HB })).d.length === 0, 'vitrine da B vazia');
ok((await req('GET', '/api/catalog/categories', { host: HB })).d.length === 0, 'categorias públicas da B vazias');
ok((await req('GET', '/api/banners', { host: HB })).d.length === 0, 'banners públicos da B vazios');
ok((await req('GET', '/api/catalog/products')).d.length > 0, 'vitrine da A continua com produtos');

// ---- Cria o mesmo conjunto nas duas lojas (mesmos nomes/códigos: deve ser permitido)
r = await b('POST', '/api/admin/categories', { name: 'Anéis' }); ok(r.s === 201, 'B cria categoria Anéis', r); const catB = r.d.id;
r = await a('POST', '/api/admin/categories', { name: 'Anéis' }); ok(r.s === 201 && r.d.id !== catB, 'A cria categoria com o mesmo nome (ids diferentes)', r); const catA = r.d.id;
ok((await b('POST', '/api/admin/categories', { name: 'Anéis' })).s === 409, 'B não repete a própria categoria');
r = await b('POST', '/api/admin/products', { name: 'Anel da Loja B', category_id: catB, price: 100, image_primary: '/images/x.jpg', stock: 5 });
ok(r.s === 201, 'B cria produto', r); const prodB = r.d.id;
r = await b('POST', '/api/admin/products', { name: 'Anel da Loja A', category_id: catA, price: 100, image_primary: '/images/x.jpg', stock: 5 });
ok(r.s === 400, 'B não cria produto com categoria da A', r.s);
r = await b('POST', '/api/admin/coupons', { code: 'IGUAL10', discount_type: 'percent', discount_value: 10 }); ok(r.s === 201, 'B cria cupom', r); const cupB = r.d.id;
r = await a('POST', '/api/admin/coupons', { code: 'IGUAL10', discount_type: 'percent', discount_value: 50 }); ok(r.s === 201, 'A cria cupom com o mesmo código', r); const cupA = r.d.id;
r = await b('POST', '/api/admin/banners', { title: 'Banner B', image_desktop: '/images/b.jpg' }); ok(r.s === 201, 'B cria banner', r); const banB = r.d.id;
r = await b('POST', '/api/admin/shipping', { name: 'Frete B', price: 10, days_min: 2, days_max: 4 }); ok(r.s === 201, 'B cria frete', r); const fretB = r.d.id;
r = await b('POST', '/api/admin/payment-methods', { name: 'Pix B', kind: 'pix' }); ok(r.s === 201, 'B cria pagamento', r); const pagB = r.d.id;

// ---- A não enxerga o que é da B (e B não enxerga o da A)
const ids = async (f, rota) => (await f('GET', `/api/admin/${rota}`)).d.map((x) => x.id);
ok(!(await ids(a, 'products')).includes(prodB), 'A não lista produto da B');
ok((await ids(b, 'products')).join() === prodB, 'B lista só o próprio produto');
ok(!(await ids(a, 'categories')).includes(catB) && (await ids(b, 'categories')).join() === catB, 'categorias separadas');
ok(!(await ids(a, 'coupons')).includes(cupB) && (await ids(b, 'coupons')).join() === cupB, 'cupons separados');
ok(!(await ids(a, 'banners')).includes(banB) && (await ids(b, 'banners')).join() === banB, 'banners separados');
ok(!(await ids(a, 'shipping')).includes(fretB) && (await ids(b, 'shipping')).join() === fretB, 'fretes separados');
ok(!(await ids(a, 'payment-methods')).includes(pagB) && (await ids(b, 'payment-methods')).join() === pagB, 'pagamentos separados');
r = await a('GET', '/api/admin/products'); ok(r.d.length === prodsA, 'A segue com a mesma quantidade de produtos', r.d.length);

// ---- B não altera nada da A, e A não altera nada da B (por id conhecido)
ok((await b('PUT', '/api/admin/products/prod_riviera', { price: 1 })).s === 404, 'B não edita produto da A');
ok((await b('DELETE', '/api/admin/products/prod_riviera')).s === 404, 'B não arquiva produto da A');
ok((await a('PUT', `/api/admin/products/${prodB}`, { price: 1 })).s === 404, 'A não edita produto da B');
ok((await b('PUT', `/api/admin/coupons/${cupA}`, { is_active: 0 })).s === 404, 'B não edita cupom da A');
ok((await b('DELETE', `/api/admin/coupons/${cupA}`)).s === 404, 'B não apaga cupom da A');
ok((await a('DELETE', `/api/admin/coupons/${cupB}`)).s === 404, 'A não apaga cupom da B');
ok((await b('PUT', `/api/admin/categories/${catA}`, { name: 'Invadida' })).s === 404, 'B não edita categoria da A');
ok((await b('DELETE', `/api/admin/categories/${catA}`)).s === 404, 'B não apaga categoria da A');
await a('PUT', `/api/admin/banners/${banB}`, { title: 'Invadido' }); ok((await b('GET', '/api/admin/banners')).d[0].title === 'Banner B', 'A não altera banner da B');
await a('DELETE', `/api/admin/banners/${banB}`); ok((await ids(b, 'banners')).includes(banB), 'A não apaga banner da B');
ok((await a('PUT', `/api/admin/shipping/${fretB}`, { name: 'X' })).s === 404, 'A não edita frete da B');
await a('DELETE', `/api/admin/shipping/${fretB}`); ok((await ids(b, 'shipping')).includes(fretB), 'A não apaga frete da B');
ok((await a('PUT', `/api/admin/payment-methods/${pagB}`, { name: 'X' })).s === 404, 'A não edita pagamento da B');
await a('DELETE', `/api/admin/payment-methods/${pagB}`); ok((await ids(b, 'payment-methods')).includes(pagB), 'A não apaga pagamento da B');
const est = async () => (await a('GET', '/api/admin/products')).d.find((x) => x.id === 'prod_riviera').stock;
const e0 = await est();
r = await b('POST', '/api/admin/stock/adjust', { productId: 'prod_riviera', quantityChange: 1, reason: 'invasão' }); ok(r.s === 404 && await est() === e0, 'B não ajusta estoque da A', r);
r = await b('POST', '/api/admin/stock/set', { productId: 'prod_riviera', quantity: 999, reason: 'invasão' }); ok(r.s === 404 && await est() === e0, 'B não define estoque da A', r);
ok((await b('GET', '/api/admin/products/prod_riviera/variants')).s === 404, 'B não lê variações da A');

// ---- Vitrine pública separada + cupom por loja
r = await req('GET', '/api/catalog/products', { host: HB }); ok(r.d.length === 1 && r.d[0].id === prodB, 'vitrine da B mostra só o produto da B');
ok((await req('GET', `/api/catalog/products/${prodB}`)).s === 404, 'produto da B não abre na vitrine da A');
ok((await req('GET', '/api/catalog/products/prod_riviera', { host: HB })).s === 404, 'produto da A não abre na vitrine da B');
r = await req('POST', '/api/coupons/validate', { host: HB, body: { code: 'IGUAL10', cartTotal: 200 } }); ok(r.s === 200 && r.d.discountValue === 10, 'cupom na B vale 10%', r);
r = await req('POST', '/api/coupons/validate', { body: { code: 'IGUAL10', cartTotal: 200 } }); ok(r.s === 200 && r.d.discountValue === 50, 'mesmo código na A vale 50%', r);
r = await req('GET', '/api/checkout/options', { host: HB }); ok(r.d.shipping.length === 1 && r.d.shipping[0].id === fretB && r.d.payments.length === 1, 'opções de checkout da B são só da B', r.d);
r = await req('GET', '/api/checkout/options'); ok(!r.d.shipping.some((x) => x.id === fretB), 'opções de checkout da A não têm o frete da B');

// ---- Sacola e pedido
ok((await req('POST', '/api/cart/items', { token: cli, body: { productId: prodB, quantity: 1 } })).s === 404, 'cliente não coloca produto da B na sacola pela vitrine da A');
ok((await req('POST', '/api/cart/items', { token: cli, host: HB, body: { productId: 'prod_riviera', quantity: 1 } })).s === 404, 'cliente não coloca produto da A na sacola pela vitrine da B');
r = await req('POST', '/api/cart/items', { token: cli, host: HB, body: { productId: prodB, quantity: 1 } }); ok(r.s === 200 || r.s === 201, 'coloca produto da B na sacola da B', r);
r = await req('GET', '/api/cart', { token: cli }); ok(r.d.items.length === 0, 'a sacola vista na vitrine da A não mostra item da B');
r = await req('POST', '/api/orders', { token: cli, host: HB, body: { shippingAddress: 'Rua B, 1', paymentMethodId: pagB, shippingMethodId: fretB, couponCode: 'IGUAL10' } });
ok(r.s === 201 || r.s === 200, 'pedido na loja B', r);
ok(r.d?.total === 100 && r.d?.shippingCost === 10, 'total = 100 - 10% de cupom da B + frete 10 da B', r.d);
ok((await b('GET', '/api/admin/orders')).d.length === 1, 'pedido aparece na B');
ok((await a('GET', '/api/admin/orders')).d.every((o) => o.id !== r.d.orderId), 'pedido não aparece na A');
const pedido = r.d.orderId;
ok((await a('PUT', `/api/admin/orders/${pedido}/status`, { status: 'Enviado' })).s === 404, 'A não altera pedido da B');
ok((await b('PUT', `/api/admin/orders/${pedido}/status`, { status: 'Enviado' })).s === 200, 'B altera o próprio pedido');
r = await b('GET', '/api/admin/dashboard'); ok(r.s === 200 && r.d.summary?.totalOrders !== undefined ? true : r.s === 200, 'dashboard da B abre');
r = await a('GET', '/api/admin/dashboard'); ok(r.s === 200, 'dashboard da A abre');

console.log(falhas ? `\n${falhas} FALHA(S) de ${total}` : `Isolamento OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
