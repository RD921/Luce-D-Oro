// Fase 4: frete e prazos, formas de pagamento e variações com estoque próprio.
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
const near = (a, b) => Math.abs(a - b) < 0.011;

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
  const gerEmail = `g.${suf}@t.com`, atdEmail = `a.${suf}@t.com`;
  await reg('Ger', gerEmail); await reg('Atd', atdEmail);
  await api('POST', '/api/admin/team', dono, { email: gerEmail, role: 'gerente' });
  await api('POST', '/api/admin/team', dono, { email: atdEmail, role: 'atendente' });
  const ger = (await api('POST', '/api/auth/login', null, { email: gerEmail, password: 'Senha#12345' })).json.token;
  const atd = (await api('POST', '/api/auth/login', null, { email: atdEmail, password: 'Senha#12345' })).json.token;

  g('1. Opções do checkout (públicas)');
  r = await api('GET', '/api/checkout/options?subtotal=100', null);
  ok(r.status === 200 && r.json.shipping.length >= 1 && r.json.payments.length >= 2, 'lista fretes e pagamentos sem login', r.json);
  const exp = r.json.shipping.find((x) => x.id === 'express');
  ok(exp && exp.price > 0 && exp.free === false && /dias úteis/.test(exp.prazo), 'frete cobrado abaixo do mínimo, com prazo', exp);
  r = await api('GET', '/api/checkout/options?subtotal=9999', null);
  ok(r.json.shipping.find((x) => x.id === 'express').free === true, 'frete grátis acima do valor');

  g('2. Frete: cadastro e regras');
  ok((await api('POST', '/api/admin/shipping', atd, { name: 'X', price: 10, days_min: 1, days_max: 2 })).status === 403, 'atendente não cria frete');
  r = await api('POST', '/api/admin/shipping', ger, { name: `Sedex ${suf}`, description: 'Rápido', price: 45.5, days_min: 1, days_max: 3, free_above: 1500 });
  ok(r.status === 201, 'gerente cria frete', r);
  const sedex = r.json?.id;
  ok((await api('POST', '/api/admin/shipping', dono, { name: 'Ruim', price: -5, days_min: 1, days_max: 2 })).status === 400, 'preço negativo recusado');
  ok((await api('POST', '/api/admin/shipping', dono, { name: 'Ruim', price: 5, days_min: 5, days_max: 2 })).status === 400, 'prazo máximo menor que o mínimo recusado');
  ok((await api('POST', '/api/admin/shipping', dono, { name: '', price: 5, days_min: 1, days_max: 2 })).status === 400, 'nome vazio recusado');
  ok((await api('PUT', `/api/admin/shipping/${sedex}`, dono, { price: 50, days_max: 4 })).status === 200, 'edita preço e prazo');
  r = await api('GET', '/api/checkout/options?subtotal=200', null);
  const s2 = r.json.shipping.find((x) => x.id === sedex);
  ok(s2 && s2.price === 50 && /1 a 4/.test(s2.prazo), 'loja mostra o valor e prazo novos', s2);
  ok((await api('PUT', `/api/admin/shipping/${sedex}`, dono, { price: 5, days_min: 9 })).status === 400, 'edição que deixa mínimo > máximo é recusada');
  ok((await api('PUT', '/api/admin/shipping/nao-existe', dono, { price: 5 })).status === 404, 'frete inexistente = 404');
  await api('PUT', `/api/admin/shipping/${sedex}`, dono, { is_active: false });
  r = await api('GET', '/api/checkout/options?subtotal=200', null);
  ok(!r.json.shipping.some((x) => x.id === sedex), 'frete desativado some do checkout');
  await api('PUT', `/api/admin/shipping/${sedex}`, dono, { is_active: true });

  g('3. Pagamento: só o dono');
  ok((await api('GET', '/api/admin/payment-methods', ger)).status === 403, 'gerente não vê formas de pagamento');
  ok((await api('POST', '/api/admin/payment-methods', ger, { name: 'X', kind: 'other' })).status === 403, 'gerente não cria forma de pagamento');
  r = await api('POST', '/api/admin/payment-methods', dono, { name: `Boleto ${suf}`, kind: 'boleto', discount_percent: 3, max_installments: 5 });
  ok(r.status === 201, 'dono cria boleto com 3% de desconto', r);
  const boleto = r.json?.id;
  const lp = (await api('GET', '/api/admin/payment-methods', dono)).json;
  ok(lp.find((x) => x.id === boleto)?.max_installments === 1, 'parcelas só valem para cartão (boleto fica 1x)');
  ok((await api('POST', '/api/admin/payment-methods', dono, { name: 'Ruim', kind: 'pix', discount_percent: 95 })).status === 400, 'desconto acima de 90% recusado');
  ok((await api('POST', '/api/admin/payment-methods', dono, { name: 'Ruim', kind: 'xyz' })).status === 400, 'tipo inválido recusado');
  ok((await api('PUT', '/api/admin/payment-methods/cartao', dono, { max_installments: 12 })).status === 200, 'dono muda parcelas do cartão para 12');

  g('4. Pedido: frete, desconto e pagamento calculados no servidor');
  await api('POST', '/api/cart/items', cli, { productId: 'prod_riviera', variantTitle: '18 cm (Padrão)', quantity: 1 });
  const cart = await api('GET', '/api/cart', cli);
  ok(cart.json.freeShippingAvailable === true && cart.json.freeShippingThreshold === 500, 'sacola usa o limite do frete cadastrado', { t: cart.json.freeShippingThreshold });
  r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethodId: 'pix', shippingMethodId: 'express' });
  ok(r.status === 201 && near(r.json.total, 1280 * 0.95) && r.json.shippingCost === 0, 'Pix: 5% off e frete grátis (R$ 1280 → 1216)', r.json);
  await api('POST', '/api/cart/items', cli, { productId: 'prod_riviera', variantTitle: '18 cm (Padrão)', quantity: 1 });
  r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethodId: 'cartao', installments: 6, shippingMethodId: sedex });
  ok(r.status === 201 && near(r.json.total, 1280 + 50) , 'cartão + Sedex R$ 50 (acima de 1500? não): 1330', r.json);
  let ped = (await api('GET', '/api/orders', cli)).json.find((o) => o.id === r.json.orderId);
  ok(/6x/.test(ped.payment_method) && ped.shipping_method?.startsWith('Sedex') && ped.shipping_cost === 50, 'pedido guarda forma de pagamento, parcelas e frete', ped);
  await api('POST', '/api/cart/items', cli, { productId: 'prod_riviera', variantTitle: '18 cm (Padrão)', quantity: 1 });
  r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethodId: 'cartao', installments: 13 });
  ok(r.status === 400 && /parcela/.test(r.json?.error), 'parcelas acima do limite recusadas', r.json);
  r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethodId: 'inexistente' });
  ok(r.status === 400, 'forma de pagamento inexistente recusada');
  r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethodId: 'pix', shippingMethodId: 'inexistente' });
  ok(r.status === 400, 'frete inexistente recusado');
  r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethod: 'Cartão de Crédito em 10x sem juros' });
  ok(r.status === 201, 'texto antigo ("Cartão ... 10x") continua funcionando', r);
  ped = (await api('GET', '/api/orders', cli)).json.find((o) => o.id === r.json.orderId);
  ok(/10x/.test(ped.payment_method), 'e grava 10x');
  await api('POST', '/api/cart/items', cli, { productId: 'prod_riviera', variantTitle: '18 cm (Padrão)', quantity: 1 });
  r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethodId: boleto });
  ok(r.status === 201 && near(r.json.total, 1280 * 0.97), 'boleto com 3% off', r.json);

  g('5. Variações com estoque próprio');
  const novo = await api('POST', '/api/admin/products', dono, { name: `Anel ${suf}`, category_id: 'brincos', price: 200, stock: 6, description: 'x', image_primary: '/images/a.jpg', variants: ['14', '16'] });
  const pid = novo.json.id || novo.json.productId;
  r = await api('GET', `/api/admin/products/${pid}/variants`, dono);
  ok(r.status === 200 && r.json.usaVariantes === false && r.json.titulosAntigos.length === 2, 'produto começa sem estoque por variação', r.json);
  ok((await api('PUT', `/api/admin/products/${pid}/variants`, atd, { variantes: [{ title: 'A', stock: 1 }] })).status === 403, 'atendente não edita variações');
  ok((await api('PUT', `/api/admin/products/${pid}/variants`, dono, { variantes: [{ title: 'A', stock: 1 }, { title: 'a', stock: 1 }] })).status === 400, 'variação repetida recusada');
  ok((await api('PUT', `/api/admin/products/${pid}/variants`, dono, { variantes: [{ title: 'A', stock: -1 }] })).status === 400, 'estoque negativo recusado');
  ok((await api('PUT', `/api/admin/products/${pid}/variants`, dono, { variantes: [{ title: '', stock: 1 }] })).status === 400, 'nome vazio recusado');
  r = await api('PUT', `/api/admin/products/${pid}/variants`, dono, { variantes: [{ title: 'Aro 14', stock: 2 }, { title: 'Aro 16', stock: 0 }, { title: 'Aro 18', stock: 5 }] });
  ok(r.status === 200 && r.json.estoqueTotal === 7, 'salva 3 variações e soma o total (7)', r.json);
  let pub = (await api('GET', '/api/catalog/products', null)).json.find((x) => x.id === pid);
  ok(pub.stock === 7 && pub.variants.length === 3 && pub.variant_stock.find((v) => v.title === 'Aro 16').stock === 0, 'loja mostra variações e estoque de cada', pub);
  r = await api('POST', '/api/cart/items', cli, { productId: pid, variantTitle: 'Aro 16', quantity: 1 });
  ok(r.status === 400, 'variação esgotada não vai para a sacola', r);
  r = await api('POST', '/api/cart/items', cli, { productId: pid, variantTitle: 'Aro 99', quantity: 1 });
  ok(r.status === 400, 'variação inexistente recusada');
  r = await api('POST', '/api/cart/items', cli, { productId: pid, variantTitle: 'Aro 14', quantity: 3 });
  ok(r.status === 400, 'mais que o estoque da variação (2) recusado', r.json);
  r = await api('POST', '/api/cart/items', cli, { productId: pid, variantTitle: 'Aro 14', quantity: 2 });
  ok(r.status === 200, 'compra das 2 unidades da variação');
  r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethodId: 'pix' });
  ok(r.status === 201, 'pedido com variação', r);
  pub = (await api('GET', '/api/catalog/products', null)).json.find((x) => x.id === pid);
  ok(pub.variant_stock.find((v) => v.title === 'Aro 14').stock === 0 && pub.variant_stock.find((v) => v.title === 'Aro 18').stock === 5 && pub.stock === 5, 'só a variação vendida baixou (total = 5)', pub.variant_stock);
  const mv = (await api('GET', '/api/admin/stock', dono)).json;
  ok(mv.movements.some((m) => m.product_id === pid && m.quantity_change === -2 && /Aro 14/.test(m.reason)), 'movimento cita a variação');
  ok(mv.products.find((p) => p.id === pid).variants.length === 3, 'estoque do painel traz as variações');
  r = await api('POST', '/api/admin/stock/adjust', dono, { productId: pid, quantityChange: 5, reason: 'x' });
  ok(r.status === 409, 'ajuste de total é bloqueado quando há variações');
  r = await api('POST', '/api/admin/stock/set', dono, { productId: pid, quantity: 4 });
  ok(r.status === 409, 'definir total sem variação é bloqueado');
  r = await api('POST', '/api/admin/stock/set', dono, { productId: pid, variant: 'Aro 16', quantity: 4, reason: 'Chegou lote' });
  ok(r.status === 200, 'define o estoque de uma variação');
  pub = (await api('GET', '/api/catalog/products', null)).json.find((x) => x.id === pid);
  ok(pub.stock === 9 && pub.variant_stock.find((v) => v.title === 'Aro 16').stock === 4, 'total atualiza (9)', pub.stock);
  ok((await api('POST', '/api/admin/stock/set', dono, { productId: pid, variant: 'Nada', quantity: 4 })).status === 404, 'variação inexistente = 404');
  r = await api('PUT', `/api/admin/products/${pid}`, dono, { stock: 99, variants: ['Zzz'] });
  const adm = (await api('GET', '/api/admin/products', dono)).json.find((x) => x.id === pid);
  ok(r.status === 200 && adm.stock === 9 && adm.variants.length === 3, 'editar o produto não desfaz o estoque por variação', { s: adm.stock, v: adm.variants });
  // sacola com variação removida
  await api('POST', '/api/cart/items', cli, { productId: pid, variantTitle: 'Aro 18', quantity: 1 });
  await api('PUT', `/api/admin/products/${pid}/variants`, dono, { variantes: [{ title: 'Aro 14', stock: 1 }, { title: 'Aro 16', stock: 4 }] });
  const cart2 = (await api('GET', '/api/cart', cli)).json;
  ok(!cart2.items.some((i) => i.product_id === pid), 'variação removida sai da sacola');
  r = await api('PUT', `/api/admin/products/${pid}/variants`, dono, { variantes: [] });
  ok(r.status === 200, 'remover todas as variações volta ao estoque único');
  r = await api('POST', '/api/cart/items', cli, { productId: pid, variantTitle: '14', quantity: 1 });
  ok(r.status === 200, 'sem variações, a compra usa o estoque do produto');
  ok((await api('DELETE', `/api/admin/products/${pid}/permanent`, dono)).status === 409 || true, 'limpeza');

  g('6. Regressão: produto sem variação e sem título');
  r = await api('POST', '/api/cart/items', cli, { productId: 'prod_riviera' });
  ok(r.status === 200, 'adicionar sem informar variação usa a primeira / "Único"');
  const aud = JSON.stringify((await api('GET', '/api/admin/audit-logs', dono)).json);
  ok(['SHIPPING_CREATED', 'SHIPPING_UPDATED', 'PAYMENT_METHOD_CREATED', 'PRODUCT_VARIANTS_UPDATED'].every((a) => aud.includes(a)), 'tudo na auditoria');

  console.log(`\n==== ${total - falhas.length}/${total} verificações passaram ====`);
  if (falhas.length) { console.log('\nFALHAS:'); falhas.forEach((f) => console.log(' - ' + f)); process.exit(1); }
}
principal().catch((e) => { console.error('ERRO NO TESTE:', e.message); process.exit(2); });
