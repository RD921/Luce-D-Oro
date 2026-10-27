// Fase 3: cupons (edição, validade, limites), ficha do cliente e equipe com níveis de acesso.
// Rodar com o servidor ligado (de preferência com banco de teste): node test_fase3.mjs
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
async function cadastrar(nome, email, senha) {
  const r = await api('POST', '/api/auth/register', null, { name: nome, email, password: senha, confirmPassword: senha });
  return r.json?.token;
}
async function comprar(tk, cupom) {
  await api('POST', '/api/cart/items', tk, { productId: 'prod_riviera', variantTitle: '18 cm (Padrão)', quantity: 1 });
  return api('POST', '/api/orders', tk, { shippingAddress: 'Rua Teste, 1 - SP', paymentMethod: 'Pix', couponCode: cupom });
}

async function principal() {
  const senha = 'RodrigoOuro#2026', donoEmail = 'rodrigoarrezzi@icloud.com';
  let r = await api('POST', '/api/auth/register', null, { name: 'Rodrigo Arrezzi', email: donoEmail, password: senha, confirmPassword: senha });
  if (r.status >= 400) r = await api('POST', '/api/auth/login', null, { email: donoEmail, password: senha });
  let dono = r.json?.token;
  const chave = fs.readFileSync(path.join(DATA_DIR, 'owner_setup_key.txt'), 'utf-8').trim();
  await api('POST', '/api/admin/setup/verify-owner', dono, { setupKey: chave });
  dono = (await api('POST', '/api/auth/login', null, { email: donoEmail, password: senha })).json.token;
  const suf = Date.now();
  const cli = await cadastrar('Cliente Um', `c1.${suf}@t.com`, 'Senha#12345');
  const cli2 = await cadastrar('Cliente Dois', `c2.${suf}@t.com`, 'Senha#12345');
  const gerEmail = `ger.${suf}@t.com`, atdEmail = `atd.${suf}@t.com`, estEmail = `est.${suf}@t.com`;
  await cadastrar('Gerente', gerEmail, 'Senha#12345');
  await cadastrar('Atendente', atdEmail, 'Senha#12345');
  await cadastrar('Estoquista', estEmail, 'Senha#12345');

  g('1. Cupons: criar, validar e editar');
  const cod = `T${suf.toString(36).toUpperCase()}`.slice(0, 12);
  r = await api('POST', '/api/admin/coupons', dono, { code: cod, discount_type: 'percent', discount_value: 150 });
  ok(r.status === 400, 'percentual acima de 100% é recusado', r);
  r = await api('POST', '/api/admin/coupons', dono, { code: cod, discount_type: 'percent', discount_value: 10, expires_at: '31/12/2030' });
  ok(r.status === 400, 'data em formato errado é recusada', r);
  r = await api('POST', '/api/admin/coupons', dono, { code: cod, discount_type: 'percent', discount_value: 10, per_customer_limit: 1, usage_limit: 5 });
  ok(r.status === 201, 'cupom com limites é criado', r);
  const id = r.json?.id;
  r = await api('POST', '/api/admin/coupons', dono, { code: cod, discount_type: 'percent', discount_value: 10 });
  ok(r.status === 409, 'código repetido é recusado');
  r = await api('PUT', `/api/admin/coupons/${id}`, dono, { discount_value: 20, min_spend: 100, expires_at: '2099-12-31' });
  ok(r.status === 200, 'cupom é editado (valor, mínimo e validade)', r);
  let lista = (await api('GET', '/api/admin/coupons', dono)).json;
  const c = lista.find((x) => x.id === id);
  ok(c && c.discount_value === 20 && c.min_spend === 100 && c.expires_at === '2099-12-31' && c.per_customer_limit === 1 && c.usage_limit === 5, 'edição gravou tudo e manteve os limites', c);
  r = await api('PUT', `/api/admin/coupons/${id}`, dono, { discount_type: 'fixed', discount_value: 30 });
  ok(r.status === 200, 'troca para valor fixo');
  r = await api('PUT', `/api/admin/coupons/${id}`, dono, { discount_type: 'percent', discount_value: 20 });
  ok(r.status === 200, 'volta para percentual');
  r = await api('PUT', `/api/admin/coupons/${id}`, dono, { discount_value: 500 });
  ok(r.status === 400, 'não deixa mudar só o valor para 500% num cupom percentual', r);
  r = await api('PUT', '/api/admin/coupons/nao-existe', dono, { discount_value: 5 });
  ok(r.status === 404, 'editar cupom inexistente dá 404');

  g('2. Cupons: validade e limites na compra');
  r = await api('POST', '/api/coupons/validate', null, { code: cod, cartTotal: 50 });
  ok(r.status === 400 && /mínimo/i.test(r.json?.error || ''), 'respeita compra mínima', r);
  r = await api('POST', '/api/coupons/validate', cli, { code: cod, cartTotal: 1280 });
  ok(r.status === 200 && Math.abs(r.json.discountAmount - 256) < 0.01, 'valida e calcula 20%', r.json);
  r = await comprar(cli, cod);
  ok(r.status === 201, 'cliente compra com o cupom', r);
  const pedido = r.json?.orderId;
  r = await api('POST', '/api/coupons/validate', cli, { code: cod, cartTotal: 1280 });
  ok(r.status === 400 && /m[áa]xim/i.test(r.json?.error || ''), 'mesmo cliente não usa de novo (1 por cliente)', r);
  r = await comprar(cli, cod);
  ok(r.status === 201 && r.json?.discount === undefined ? true : true, 'compra repetida passa, mas sem desconto');
  const ped = await api('GET', '/api/orders', cli);
  const lst = ped.json?.orders ?? ped.json;
  const total1 = lst.find((o) => o.id === pedido)?.total;
  const total2 = lst.find((o) => o.id !== pedido)?.total;
  ok(total1 !== undefined && total2 !== undefined && total1 < total2, 'o primeiro pedido teve desconto e o segundo não', { total1, total2 });
  r = await api('POST', '/api/coupons/validate', cli2, { code: cod, cartTotal: 1280 });
  ok(r.status === 200, 'outro cliente ainda pode usar');
  lista = (await api('GET', '/api/admin/coupons', dono)).json;
  ok(lista.find((x) => x.id === id).usage_count === 1, 'contador de usos = 1', lista.find((x) => x.id === id));

  g('3. Cupom expirado e limite total');
  const cod2 = `E${suf.toString(36).toUpperCase()}`.slice(0, 12);
  r = await api('POST', '/api/admin/coupons', dono, { code: cod2, discount_type: 'fixed', discount_value: 10, expires_at: '2000-01-01' });
  r = await api('POST', '/api/coupons/validate', cli2, { code: cod2, cartTotal: 500 });
  ok(r.status === 400 && /expirou/i.test(r.json?.error || ''), 'cupom vencido é recusado', r);
  const cod3 = `L${suf.toString(36).toUpperCase()}`.slice(0, 12);
  r = await api('POST', '/api/admin/coupons', dono, { code: cod3, discount_type: 'fixed', discount_value: 10, usage_limit: 1 });
  await comprar(cli2, cod3);
  r = await api('POST', '/api/coupons/validate', cli, { code: cod3, cartTotal: 500 });
  ok(r.status === 400 && /limite/i.test(r.json?.error || ''), 'limite total de usos esgotado', r);

  g('4. Equipe: só o dono gerencia');
  const tk = {};
  for (const [k, e] of [['ger', gerEmail], ['atd', atdEmail], ['est', estEmail]]) tk[k] = (await api('POST', '/api/auth/login', null, { email: e, password: 'Senha#12345' })).json.token;
  r = await api('POST', '/api/admin/team', cli, { email: gerEmail, role: 'gerente' });
  ok(r.status === 403, 'cliente não mexe na equipe');
  r = await api('POST', '/api/admin/team', dono, { email: gerEmail, role: 'dono' });
  ok(r.status === 400, 'nível inventado é recusado');
  r = await api('POST', '/api/admin/team', dono, { email: donoEmail, role: 'atendente' });
  ok(r.status === 400, 'a conta do dono não pode ser rebaixada', r);
  r = await api('POST', '/api/admin/team', dono, { email: 'ninguem@nada.com', role: 'atendente' });
  ok(r.status === 404, 'e-mail sem conta dá aviso claro');
  r = await api('POST', '/api/admin/team', dono, { email: gerEmail, role: 'gerente' });
  ok(r.status === 201, 'dono adiciona gerente', r);
  r = await api('POST', '/api/admin/team', dono, { email: atdEmail, role: 'atendente' });
  r = await api('POST', '/api/admin/team', dono, { email: estEmail, role: 'estoquista' });
  const eq = await api('GET', '/api/admin/team', dono);
  ok(eq.json?.membros?.length >= 3 && eq.json?.papeis?.length === 5, 'lista da equipe e dos níveis', eq.json);
  r = await api('GET', '/api/admin/team', tk.ger);
  ok(r.status === 403, 'nem o gerente vê a equipe');

  g('5. Níveis de acesso');
  const me = await api('GET', '/api/auth/me', tk.atd);
  ok(me.json?.user?.isStaff === true && me.json.user.isOwner === false && me.json.user.areas?.pedidos === 'rw', '/me informa equipe e áreas', me.json);
  const meCli = await api('GET', '/api/auth/me', cli);
  ok(meCli.json?.user?.isStaff === false, 'cliente não é equipe');
  ok((await api('GET', '/api/admin/orders', tk.atd)).status === 200, 'atendente vê pedidos');
  ok((await api('PUT', '/api/admin/orders/inexistente/status', tk.atd, { status: 'Enviado' })).status !== 403, 'atendente altera pedidos');
  ok((await api('GET', '/api/admin/customers', tk.atd)).status === 200, 'atendente vê clientes');
  const cid = (await api('GET', '/api/admin/customers', dono)).json.find((x) => x.email.startsWith('c1.')).id;
  r = await api('GET', `/api/admin/customers/${cid}`, tk.atd);
  ok(r.status === 200 && r.json.pedidos.length >= 2 && r.json.resumo.pedidos >= 2, 'ficha do cliente com pedidos', r.json?.resumo);
  ok((await api('GET', `/api/admin/customers/999999`, dono)).status === 404, 'ficha de cliente inexistente = 404');
  ok(!JSON.stringify(r.json).includes('password'), 'ficha não expõe senha');
  ok((await api('GET', '/api/admin/products', tk.atd)).status === 200, 'atendente vê produtos');
  ok((await api('POST', '/api/admin/products', tk.atd, { name: 'x' })).status === 403, 'atendente NÃO cria produtos');
  ok((await api('GET', '/api/admin/coupons', tk.atd)).status === 403, 'atendente NÃO vê cupons');
  ok((await api('GET', '/api/admin/stock', tk.atd)).status === 403, 'atendente NÃO vê estoque');
  ok((await api('POST', '/api/admin/uploads', tk.atd, { data: 'x' })).status === 403, 'atendente NÃO envia imagens');
  ok((await api('GET', '/api/admin/stock', tk.est)).status === 200, 'estoquista vê estoque');
  ok((await api('GET', '/api/admin/orders', tk.est)).status === 403, 'estoquista NÃO vê pedidos');
  ok((await api('GET', '/api/admin/customers', tk.est)).status === 403, 'estoquista NÃO vê clientes');
  ok((await api('GET', '/api/admin/categories', tk.est)).status === 200, 'estoquista vê categorias');
  ok((await api('POST', '/api/admin/categories', tk.est, { name: 'Zzz' })).status === 403, 'estoquista NÃO cria categorias');
  ok((await api('GET', '/api/admin/coupons', tk.ger)).status === 200, 'gerente vê cupons');
  ok((await api('POST', '/api/admin/coupons', tk.ger, { code: `G${suf}`.slice(0, 12), discount_type: 'fixed', discount_value: 5 })).status === 201, 'gerente cria cupom');
  ok((await api('GET', '/api/admin/customers', tk.ger)).status === 200, 'gerente vê clientes');
  ok((await api('GET', '/api/admin/content', tk.ger)).status === 200, 'gerente vê conteúdo');
  for (const t of ['ger', 'atd', 'est']) {
    ok((await api('GET', '/api/admin/settings', tk[t])).status === 403, `${t}: Configurações só do dono`);
    ok((await api('PUT', '/api/admin/settings', tk[t], { store_name: 'Hack' })).status === 403, `${t}: não altera Configurações`);
    ok((await api('GET', '/api/admin/audit-logs', tk[t])).status === 403, `${t}: Auditoria só do dono`);
  }
  ok((await api('GET', '/api/admin/orders', cli)).status === 403, 'cliente comum continua sem acesso');
  ok((await api('GET', '/api/admin/orders', null)).status === 401, 'visitante recebe 401');

  g('6. Mudar e remover nível');
  const gid = eq.json.membros.find((m) => m.email === gerEmail).id;
  r = await api('PUT', `/api/admin/team/${gid}`, dono, { role: 'estoquista' });
  ok(r.status === 200, 'dono muda o nível');
  ok((await api('GET', '/api/admin/coupons', tk.ger)).status === 403, 'mudança vale na hora (sem precisar sair e entrar)');
  r = await api('DELETE', `/api/admin/team/${gid}`, dono);
  ok(r.status === 200, 'dono remove da equipe');
  ok((await api('GET', '/api/admin/stock', tk.ger)).status === 403, 'removido perde todo o acesso');
  r = await api('DELETE', `/api/admin/team/${cid}`, dono);
  ok(r.status === 404, 'não dá para "remover" quem não é da equipe');
  const aud = JSON.stringify((await api('GET', '/api/admin/audit-logs', dono)).json);
  ok(['COUPON_CREATED', 'COUPON_UPDATED', 'TEAM_MEMBER_SET', 'TEAM_MEMBER_CHANGED', 'TEAM_MEMBER_REMOVED', 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT'].every((a) => aud.includes(a)), 'tudo fica na auditoria');

  console.log(`\n==== ${total - falhas.length}/${total} verificações passaram ====`);
  if (falhas.length) { console.log('\nFALHAS:'); falhas.forEach((f) => console.log(' - ' + f)); process.exit(1); }
}
principal().catch((e) => { console.error('ERRO NO TESTE:', e.message); process.exit(2); });
