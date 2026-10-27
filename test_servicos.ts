// Testa as regras do checkout chamando o serviço direto, sem servidor HTTP.
// Uso: DATA_DIR=<cópia do banco limpo> npx tsx test_servicos.ts
import { db, initDatabase } from './server/db.js';
import { migrarSites } from './server/sites.js';
import { criarPedido } from './server/servicos/pedidos.js';
import { criarProduto, atualizarProduto, arquivarProduto, listarProdutosAdmin } from './server/servicos/produtos.js';
import { calcularDesconto, validarCupomPublico, registrarUsoCupom, listarCupons, criarCupom, atualizarCupom, removerCupom, motivoCupomInvalido } from './server/servicos/cupons.js';
import { obterEstoque, ajustarEstoque, definirEstoque } from './server/servicos/estoque.js';
import { obterSacola, adicionarItem, atualizarQuantidade, removerItem } from './server/servicos/carrinho.js';

initDatabase(); migrarSites();
let falhas = 0, total = 0;
const ok = (c: boolean, m: string, extra?: unknown) => { total++; if (!c) { falhas++; console.log('FALHOU:', m, extra ?? ''); } };

const u = db.prepare("INSERT INTO users (name, email, password_hash, salt) VALUES ('Teste Servico', ?, 'x', 'y')").run(`svc.${Date.now()}@x.com`);
const uid = Number(u.lastInsertRowid);
const cartId = `cart_svc_${Date.now()}`;
db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run(cartId, uid);
const encher = (qtd: number) => { db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId); db.prepare('INSERT INTO cart_items (cart_id, product_id, variant_title, quantity) VALUES (?, ?, ?, ?)').run(cartId, 'prod_riviera', '18 cm (Padrão)', qtd); };
const estoque = () => (db.prepare("SELECT stock FROM products WHERE id='prod_riviera'").get() as { stock: number }).stock;
const pedidos = () => (db.prepare('SELECT COUNT(*) n FROM orders WHERE user_id = ?').get(uid) as { n: number }).n;

let r = criarPedido(uid, 'luce-d-oro', {});
ok(!r.ok && r.status === 400, 'sem endereço/pagamento = 400', r);
r = criarPedido(uid, 'luce-d-oro', { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
ok(!r.ok && r.status === 400 && /vazia/i.test(r.erro), 'sacola sem itens = 400', r);

encher(1);
const e0 = estoque();
r = criarPedido(uid, 'luce-d-oro', { shippingAddress: 'Rua A, 1', paymentMethodId: 'inexistente' });
ok(!r.ok && r.status === 400, 'pagamento inexistente = 400', r);
r = criarPedido(uid, 'luce-d-oro', { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix', shippingMethodId: 'inexistente' });
ok(!r.ok && r.status === 400, 'frete inexistente = 400', r);
ok(estoque() === e0 && pedidos() === 0, 'recusas não gravam nada');

encher(9999);
r = criarPedido(uid, 'luce-d-oro', { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
ok(!r.ok && r.status === 400 && /unidades dispon/.test(r.erro), 'estoque insuficiente = 400', r);

encher(1);
r = criarPedido(uid, 'luce-d-oro', { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
ok(r.ok && pedidos() === 1 && estoque() === e0 - 1, 'pedido válido grava e baixa o estoque', r);
ok((db.prepare('SELECT COUNT(*) n FROM cart_items WHERE cart_id = ?').get(cartId) as { n: number }).n === 0, 'sacola esvaziada depois do pedido');

encher(1);
db.exec("CREATE TRIGGER svc_falha BEFORE INSERT ON order_items BEGIN SELECT RAISE(ABORT, 'falha simulada'); END");
const antes = { p: pedidos(), e: estoque() };
r = criarPedido(uid, 'luce-d-oro', { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
db.exec('DROP TRIGGER svc_falha');
ok(!r.ok && r.status === 500, 'falha no meio = 500', r);
ok(pedidos() === antes.p && estoque() === antes.e, 'falha no meio não deixa pedido nem baixa de estoque');

// ===== Carrinho =====
const u2 = db.prepare("INSERT INTO users (name, email, password_hash, salt) VALUES ('Outro Cliente', ?, 'x', 'y')").run(`svc2.${Date.now()}@x.com`);
const uid2 = Number(u2.lastInsertRowid);
let sac = obterSacola(uid2, 'luce-d-oro');
ok(sac.items.length === 0 && sac.total === 0 && !!sac.cartId, 'sacola nova nasce vazia');
ok(obterSacola(uid2, 'luce-d-oro').cartId === sac.cartId, 'a sacola é a mesma nas próximas leituras');
const V = '18 cm (Padrão)';
let c = adicionarItem(uid2, 'luce-d-oro', {});
ok(!c.ok && c.status === 400, 'adicionar sem produto = 400', c);
c = adicionarItem(uid2, 'luce-d-oro', { productId: 'prod_riviera', variantTitle: V, quantity: 0 });
ok(!c.ok && c.status === 400, 'quantidade 0 = 400');
c = adicionarItem(uid2, 'luce-d-oro', { productId: 'prod_riviera', variantTitle: V, quantity: 1.5 });
ok(!c.ok && c.status === 400, 'quantidade decimal = 400');
c = adicionarItem(uid2, 'luce-d-oro', { productId: 'nao_existe', quantity: 1 });
ok(!c.ok && c.status === 404, 'produto inexistente = 404');
c = adicionarItem(uid2, 'luce-d-oro', { productId: 'prod_riviera', variantTitle: 'Variação que não existe', quantity: 1 });
ok(!c.ok && c.status === 400, 'variação inexistente = 400', c);
c = adicionarItem(uid2, 'luce-d-oro', { productId: 'prod_riviera', variantTitle: V, quantity: 1 });
ok(c.ok, 'adiciona item válido', c);
c = adicionarItem(uid2, 'luce-d-oro', { productId: 'prod_riviera', variantTitle: V, quantity: 1 });
sac = obterSacola(uid2, 'luce-d-oro');
ok(c.ok && sac.items.length === 1 && sac.items[0].quantity === 2 && sac.itemCount === 2, 'mesmo item soma a quantidade em vez de duplicar', sac.items);
c = adicionarItem(uid2, 'luce-d-oro', { productId: 'prod_riviera', variantTitle: V, quantity: 99 });
ok(!c.ok && c.status === 400 && /Estoque insuficiente/.test(c.erro), 'passar do estoque ao somar = 400', c);
const item = sac.items[0];
let m = atualizarQuantidade(uid2, String(item.id), 'abc');
ok(!m.ok && m.status === 400, 'quantidade "abc" recusada (antes entrava no banco)', m);
m = atualizarQuantidade(uid2, String(item.id), 1.5);
ok(!m.ok && m.status === 400, 'quantidade 1.5 recusada');
m = atualizarQuantidade(uid2, String(item.id), undefined);
ok(!m.ok && m.status === 400, 'quantidade ausente recusada');
ok(obterSacola(uid2, 'luce-d-oro').items[0].quantity === 2, 'recusas não alteram a sacola');
m = atualizarQuantidade(uid2, String(item.id), 1);
ok(m.ok && obterSacola(uid2, 'luce-d-oro').items[0].quantity === 1, 'atualiza para 1');
m = atualizarQuantidade(uid2, String(item.id), 99999);
ok(!m.ok && m.status === 400, 'acima do limite = 400');
m = atualizarQuantidade(uid, String(item.id), 1);
ok(!m.ok && m.status === 404, 'cliente não mexe no item da sacola de outro cliente (404)', m);
let rm = removerItem(uid, String(item.id));
ok(!rm.ok && rm.status === 404 && obterSacola(uid2, 'luce-d-oro').items.length === 1, 'cliente não remove item de outro cliente');
m = atualizarQuantidade(uid2, String(item.id), 0);
ok(m.ok && obterSacola(uid2, 'luce-d-oro').items.length === 0, 'quantidade 0 remove o item');
adicionarItem(uid2, 'luce-d-oro', { productId: 'prod_riviera', variantTitle: V, quantity: 1 });
rm = removerItem(uid2, String(obterSacola(uid2, 'luce-d-oro').items[0].id));
ok(rm.ok && obterSacola(uid2, 'luce-d-oro').items.length === 0, 'remove o próprio item');

// ===== Produtos =====
const quem = { id: uid, email: 'svc@x.com' };
const cat = (db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: string }).id;
const base = { name: 'Anel Teste Servico', category_id: cat, price: 199.9, image_primary: '/images/x.jpg' };
const nProd = () => (db.prepare('SELECT COUNT(*) n FROM products').get() as { n: number }).n;
const n0 = nProd();
const recusa = (d: Record<string, any>, rotulo: string) => { const x = criarProduto('luce-d-oro', quem, { ...base, ...d }); ok(!x.ok && x.status === 400, `cadastro recusa ${rotulo}`, x); };
let pr: ReturnType<typeof criarProduto> = criarProduto('luce-d-oro', quem, { name: 'Só nome' });
ok(!pr.ok && pr.status === 400, 'cadastro sem campos obrigatórios = 400');
recusa({ name: 123 }, 'nome que não é texto');
recusa({ name: 'A' }, 'nome curto');
recusa({ category_id: 'categoria_que_nao_existe' }, 'categoria inexistente (antes dava erro 500)');
recusa({ price: 'abc' }, 'preço "abc" (antes gravava NaN)');
recusa({ price: -5 }, 'preço negativo');
recusa({ old_price: 'xx' }, 'preço anterior inválido');
recusa({ cost_price: -1 }, 'custo negativo');
recusa({ stock: -3 }, 'estoque negativo');
recusa({ stock: 2.5 }, 'estoque decimal');
recusa({ images: 'nao-e-lista' }, 'fotos que não são lista');
recusa({ variants: [1, 2] }, 'variações que não são texto');
recusa({ description: { a: 1 } }, 'descrição que não é texto');
ok(nProd() === n0, 'recusas não gravam produto nenhum');
pr = criarProduto('luce-d-oro', quem, { ...base, price: '199,90', stock: '7' });
ok(pr.ok, 'cadastro válido (preço "199,90" e estoque "7" como texto)', pr);
const pid2 = pr.ok ? pr.id : '';
const linha = db.prepare('SELECT price, stock, variants_json, images_json FROM products WHERE id = ?').get(pid2) as any;
ok(linha?.price === 199.9 && linha?.stock === 7 && linha?.variants_json === '["Padrão"]' && linha?.images_json === '["/images/x.jpg"]', 'valores gravados corretos e padrões aplicados', linha);
ok((db.prepare("SELECT COUNT(*) n FROM stock_movements WHERE product_id = ? AND reason LIKE 'Cadastro inicial%'").get(pid2) as { n: number }).n === 1, 'estoque inicial gera movimento');
ok(listarProdutosAdmin('luce-d-oro').some((x: any) => x.id === pid2), 'produto aparece na lista do painel');

let up = atualizarProduto('luce-d-oro', quem, 'nao_existe', { price: 10 });
ok(!up.ok && up.status === 404, 'editar produto inexistente = 404');
for (const [d, r] of [[{ price: 'abc' }, 'preço inválido'], [{ stock: -1 }, 'estoque negativo'], [{ category_id: 'nao_existe' }, 'categoria inexistente'], [{ name: 5 }, 'nome numérico'], [{ images: [1] }, 'fotos inválidas']] as Array<[Record<string, any>, string]>) {
  up = atualizarProduto('luce-d-oro', quem, pid2, d); ok(!up.ok && up.status === 400, `edição recusa ${r}`, up);
}
ok((db.prepare('SELECT price, stock FROM products WHERE id = ?').get(pid2) as any).price === 199.9, 'recusas de edição não alteram o produto');
up = atualizarProduto('luce-d-oro', quem, pid2, { price: 250, stock: 4, name: 'Anel Teste Servico 2', old_price: '' });
const ap = db.prepare('SELECT name, price, stock, old_price FROM products WHERE id = ?').get(pid2) as any;
ok(up.ok && ap.price === 250 && ap.stock === 4 && ap.name === 'Anel Teste Servico 2' && ap.old_price === null, 'edição válida muda preço, estoque e nome', ap);
ok((db.prepare("SELECT COUNT(*) n FROM stock_movements WHERE product_id = ? AND reason LIKE 'Ajuste manual%'").get(pid2) as { n: number }).n === 1, 'mudança de estoque gera movimento');
up = atualizarProduto('luce-d-oro', quem, pid2, { price: 260 });
ok(up.ok && (db.prepare('SELECT stock FROM products WHERE id = ?').get(pid2) as any).stock === 4, 'editar sem mexer em estoque mantém o estoque');
const ar = arquivarProduto('luce-d-oro', quem, pid2);
ok(ar.ok && (db.prepare('SELECT is_archived FROM products WHERE id = ?').get(pid2) as any).is_archived === 1, 'arquivar marca o produto como arquivado (não apaga)');
const ar2 = arquivarProduto('luce-d-oro', quem, 'nao_existe');
ok(!ar2.ok && ar2.status === 404, 'arquivar inexistente = 404');
ok(((db.prepare("SELECT COUNT(*) n FROM admin_audit_logs WHERE entity_id = ? ").get(pid2)) as { n: number }).n >= 3, 'criar, editar e arquivar ficam na auditoria');

// ===== Estoque =====
const sp = criarProduto('luce-d-oro', quem, { ...base, name: 'Colar Estoque Teste', stock: 10 });
const sid = sp.ok ? sp.id : '';
const est = () => (db.prepare('SELECT stock FROM products WHERE id = ?').get(sid) as { stock: number }).stock;
const movs = () => (db.prepare('SELECT COUNT(*) n FROM stock_movements WHERE product_id = ?').get(sid) as { n: number }).n;
const m0 = movs();
for (const [d, r] of [[{}, 'sem dados'], [{ productId: sid, quantityChange: 'abc', reason: 'teste' }, 'quantidade "abc" (antes dava erro 500)'], [{ productId: sid, quantityChange: 1.5, reason: 'teste' }, 'quantidade decimal'], [{ productId: sid, quantityChange: 0, reason: 'teste' }, 'quantidade zero'], [{ productId: sid, quantityChange: 9999999, reason: 'teste' }, 'quantidade enorme'], [{ productId: sid, quantityChange: 1, reason: 123 }, 'justificativa numérica (antes dava erro 500)'], [{ productId: sid, quantityChange: 1, reason: ' ' }, 'justificativa vazia']] as Array<[Record<string, any>, string]>) {
  const x = ajustarEstoque('luce-d-oro', quem, d); ok(!x.ok && x.status === 400, `ajuste recusa ${r}`, x);
}
const nf = ajustarEstoque('luce-d-oro', quem, { productId: 'nao_existe', quantityChange: 1, reason: 'teste' });
ok(!nf.ok && nf.status === 404, 'ajuste de produto inexistente = 404');
ok(est() === 10 && movs() === m0, 'recusas não alteram estoque nem histórico');
let aj = ajustarEstoque('luce-d-oro', quem, { productId: sid, quantityChange: '5', reason: 'Entrada de mercadoria' });
ok(aj.ok && aj.newStock === 15 && est() === 15, 'ajuste +5 (texto "5") vai de 10 para 15', aj);
aj = ajustarEstoque('luce-d-oro', quem, { productId: sid, quantityChange: -100, reason: 'Perda geral' });
ok(aj.ok && aj.newStock === 0 && est() === 0, 'ajuste nunca deixa o estoque negativo (trava em 0)', aj);
const ultimo = db.prepare('SELECT quantity_change, previous_stock, new_stock FROM stock_movements WHERE product_id = ? ORDER BY id DESC LIMIT 1').get(sid) as any;
ok(ultimo.quantity_change === -15 && ultimo.previous_stock === 15 && ultimo.new_stock === 0, 'histórico guarda a mudança real (-15), não a pedida (-100)', ultimo);
let df = definirEstoque('luce-d-oro', quem, { productId: sid, quantity: 'abc' });
ok(!df.ok && df.status === 400, 'definir estoque "abc" = 400');
df = definirEstoque('luce-d-oro', quem, { productId: sid, quantity: -1 });
ok(!df.ok && df.status === 400, 'definir estoque negativo = 400');
df = definirEstoque('luce-d-oro', quem, { productId: sid, quantity: 25, reason: 'Contagem' });
ok(df.ok && est() === 25, 'definir estoque em 25', df);
const mAntes = movs();
df = definirEstoque('luce-d-oro', quem, { productId: sid, quantity: 25 });
ok(df.ok && movs() === mAntes, 'definir o mesmo valor não cria movimento');
// variações
db.prepare('INSERT INTO product_variants (product_id, title, stock) VALUES (?, ?, ?)').run(sid, 'Aro 14', 3);
db.prepare('INSERT INTO product_variants (product_id, title, stock) VALUES (?, ?, ?)').run(sid, 'Aro 16', 4);
aj = ajustarEstoque('luce-d-oro', quem, { productId: sid, quantityChange: 1, reason: 'teste' });
ok(!aj.ok && aj.status === 409, 'ajuste simples em produto com variações = 409');
df = definirEstoque('luce-d-oro', quem, { productId: sid, quantity: 9 });
ok(!df.ok && df.status === 409, 'definir sem informar a variação = 409');
df = definirEstoque('luce-d-oro', quem, { productId: sid, quantity: 9, variant: 'Aro 99' });
ok(!df.ok && df.status === 404, 'variação inexistente = 404');
df = definirEstoque('luce-d-oro', quem, { productId: sid, quantity: 9, variant: 'Aro 14', reason: 'Contagem' });
ok(df.ok && (db.prepare("SELECT stock FROM product_variants WHERE product_id = ? AND title = 'Aro 14'").get(sid) as any).stock === 9 && est() === 13, 'definir variação muda a variação e o total do produto (9 + 4)', df);
const lista = obterEstoque('luce-d-oro');
ok(lista.products.some((x: any) => x.id === sid && x.variants.length === 2) && lista.movements.length > 0 && lista.movements.length <= 30, 'lista do painel traz variações e até 30 movimentos');

// ===== Cupons =====
const sufixo = Date.now().toString(36).toUpperCase();
const COD = `TESTE${sufixo}`;
ok(calcularDesconto({ discount_type: 'percent', discount_value: 10 }, 200) === 20, 'desconto percentual: 10% de 200 = 20');
ok(calcularDesconto({ discount_type: 'fixed', discount_value: 50 }, 200) === 50, 'desconto fixo: R$ 50 em 200');
ok(calcularDesconto({ discount_type: 'fixed', discount_value: 500 }, 200) === 200, 'desconto fixo nunca passa do subtotal');
ok(calcularDesconto({ discount_type: 'percent', discount_value: 10 }, NaN) === 0 && calcularDesconto({ discount_type: 'percent', discount_value: 10 }, -5) === 0, 'subtotal inválido = desconto 0 (antes dava NaN)');

let cp: ReturnType<typeof criarCupom> = criarCupom('luce-d-oro', quem, { code: 'a', discount_type: 'percent', discount_value: 10 });
ok(!cp.ok && cp.status === 400, 'código curto = 400');
cp = criarCupom('luce-d-oro', quem, { code: COD, discount_type: 'banana', discount_value: 10 });
ok(!cp.ok && cp.status === 400, 'tipo de desconto inválido = 400');
cp = criarCupom('luce-d-oro', quem, { code: COD, discount_type: 'percent', discount_value: 150 });
ok(!cp.ok && cp.status === 400, 'percentual acima de 100% = 400');
cp = criarCupom('luce-d-oro', quem, { code: COD, discount_type: 'fixed', discount_value: 'abc' });
ok(!cp.ok && cp.status === 400, 'valor "abc" = 400');
cp = criarCupom('luce-d-oro', quem, { code: COD, discount_type: 'fixed', discount_value: 10, expires_at: '31/12/2030' });
ok(!cp.ok && cp.status === 400, 'validade fora do formato = 400');
cp = criarCupom('luce-d-oro', quem, { code: COD, discount_type: 'fixed', discount_value: 10, usage_limit: 1.5 });
ok(!cp.ok && cp.status === 400, 'limite de uso decimal = 400');
cp = criarCupom('luce-d-oro', quem, { code: COD.toLowerCase(), discount_type: 'percent', discount_value: 10, min_spend: 100, usage_limit: 2, per_customer_limit: 1 });
ok(cp.ok, 'cria cupom válido (código em minúsculas vira maiúsculas)', cp);
const cid = cp.ok ? cp.id : '';
ok(listarCupons('luce-d-oro').some((x: any) => x.code === COD), 'cupom aparece na lista');
cp = criarCupom('luce-d-oro', quem, { code: COD, discount_type: 'percent', discount_value: 5 });
ok(!cp.ok && cp.status === 409, 'código repetido = 409');

let v = validarCupomPublico('luce-d-oro', '', 200, null);
ok(!v.ok && v.status === 400, 'validar sem código = 400');
v = validarCupomPublico('luce-d-oro', 'NAO_EXISTE', 200, null);
ok(!v.ok && v.status === 404, 'validar código inexistente = 404');
v = validarCupomPublico('luce-d-oro', COD, 50, null);
ok(!v.ok && v.status === 400 && /mínimo/.test(v.erro), 'abaixo do mínimo = 400', v);
v = validarCupomPublico('luce-d-oro', COD, undefined, null);
ok(!v.ok && v.status === 400, 'sem total informado = 400 (antes calculava NaN)');
v = validarCupomPublico('luce-d-oro', COD.toLowerCase(), '200', null);
ok(v.ok && v.discountAmount === 20 && v.code === COD, 'valida cupom (total como texto "200"): 10% = 20', v);

// uso: limite por cliente e limite geral
db.prepare("INSERT OR IGNORE INTO orders (id, user_id, total, status, shipping_address, payment_method) VALUES ('PED-SVC-CUPOM', ?, 1, 'Confirmado', 'x', 'Pix')").run(uid);
registrarUsoCupom(cid, uid, 'PED-SVC-CUPOM');
ok(motivoCupomInvalido(db.prepare('SELECT * FROM coupons WHERE id = ?').get(cid) as any, uid, 200) === 'Você já usou este cupom o número máximo de vezes.', 'limite por cliente: segundo uso recusado');
ok(motivoCupomInvalido(db.prepare('SELECT * FROM coupons WHERE id = ?').get(cid) as any, uid2, 200) === null, 'outro cliente ainda pode usar');
registrarUsoCupom(cid, uid2, 'PED-SVC-CUPOM');
v = validarCupomPublico('luce-d-oro', COD, 200, null);
ok(!v.ok && /limite de usos/.test(v.erro), 'limite geral de usos atingido', v);

let at = atualizarCupom('luce-d-oro', quem, 'nao_existe', { is_active: 0 });
ok(!at.ok && at.status === 404, 'editar cupom inexistente = 404');
at = atualizarCupom('luce-d-oro', quem, cid, {});
ok(!at.ok && at.status === 400, 'editar sem campos = 400');
at = atualizarCupom('luce-d-oro', quem, cid, { discount_value: 500 });
ok(!at.ok && at.status === 400 && /100%/.test(at.erro), 'editar só o valor para 500% é recusado');
at = atualizarCupom('luce-d-oro', quem, cid, { is_active: false, usage_limit: '' });
ok(at.ok && (db.prepare('SELECT is_active, usage_limit FROM coupons WHERE id = ?').get(cid) as any).is_active === 0, 'desativa e remove limite', at);
v = validarCupomPublico('luce-d-oro', COD, 200, null);
ok(!v.ok && /inativo/.test(v.erro), 'cupom desativado é recusado', v);
let rc = removerCupom('luce-d-oro', quem, cid);
ok(rc.ok && !listarCupons('luce-d-oro').some((x: any) => x.id === cid), 'remove o cupom');
rc = removerCupom('luce-d-oro', quem, cid);
ok(!rc.ok && rc.status === 404, 'remover de novo = 404');
ok((db.prepare("SELECT COUNT(*) n FROM admin_audit_logs WHERE entity = 'COUPONS' AND entity_id = ?").get(cid) as { n: number }).n >= 3, 'criar, editar e remover ficam na auditoria');

console.log(falhas ? `\n${falhas} FALHA(S) de ${total}` : `Serviço de pedidos OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
