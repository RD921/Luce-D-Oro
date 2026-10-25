// Testa as regras do checkout chamando o serviço direto, sem servidor HTTP.
// Uso: DATA_DIR=<cópia do banco limpo> npx tsx test_servicos.ts
import { db, initDatabase } from './server/db.js';
import { migrarSites } from './server/sites.js';
import { criarPedido } from './server/servicos/pedidos.js';
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

let r = criarPedido(uid, {});
ok(!r.ok && r.status === 400, 'sem endereço/pagamento = 400', r);
r = criarPedido(uid, { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
ok(!r.ok && r.status === 400 && /vazia/i.test(r.erro), 'sacola sem itens = 400', r);

encher(1);
const e0 = estoque();
r = criarPedido(uid, { shippingAddress: 'Rua A, 1', paymentMethodId: 'inexistente' });
ok(!r.ok && r.status === 400, 'pagamento inexistente = 400', r);
r = criarPedido(uid, { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix', shippingMethodId: 'inexistente' });
ok(!r.ok && r.status === 400, 'frete inexistente = 400', r);
ok(estoque() === e0 && pedidos() === 0, 'recusas não gravam nada');

encher(9999);
r = criarPedido(uid, { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
ok(!r.ok && r.status === 400 && /unidades dispon/.test(r.erro), 'estoque insuficiente = 400', r);

encher(1);
r = criarPedido(uid, { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
ok(r.ok && pedidos() === 1 && estoque() === e0 - 1, 'pedido válido grava e baixa o estoque', r);
ok((db.prepare('SELECT COUNT(*) n FROM cart_items WHERE cart_id = ?').get(cartId) as { n: number }).n === 0, 'sacola esvaziada depois do pedido');

encher(1);
db.exec("CREATE TRIGGER svc_falha BEFORE INSERT ON order_items BEGIN SELECT RAISE(ABORT, 'falha simulada'); END");
const antes = { p: pedidos(), e: estoque() };
r = criarPedido(uid, { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
db.exec('DROP TRIGGER svc_falha');
ok(!r.ok && r.status === 500, 'falha no meio = 500', r);
ok(pedidos() === antes.p && estoque() === antes.e, 'falha no meio não deixa pedido nem baixa de estoque');

// ===== Carrinho =====
const u2 = db.prepare("INSERT INTO users (name, email, password_hash, salt) VALUES ('Outro Cliente', ?, 'x', 'y')").run(`svc2.${Date.now()}@x.com`);
const uid2 = Number(u2.lastInsertRowid);
let sac = obterSacola(uid2);
ok(sac.items.length === 0 && sac.total === 0 && !!sac.cartId, 'sacola nova nasce vazia');
ok(obterSacola(uid2).cartId === sac.cartId, 'a sacola é a mesma nas próximas leituras');
const V = '18 cm (Padrão)';
let c = adicionarItem(uid2, {});
ok(!c.ok && c.status === 400, 'adicionar sem produto = 400', c);
c = adicionarItem(uid2, { productId: 'prod_riviera', variantTitle: V, quantity: 0 });
ok(!c.ok && c.status === 400, 'quantidade 0 = 400');
c = adicionarItem(uid2, { productId: 'prod_riviera', variantTitle: V, quantity: 1.5 });
ok(!c.ok && c.status === 400, 'quantidade decimal = 400');
c = adicionarItem(uid2, { productId: 'nao_existe', quantity: 1 });
ok(!c.ok && c.status === 404, 'produto inexistente = 404');
c = adicionarItem(uid2, { productId: 'prod_riviera', variantTitle: 'Variação que não existe', quantity: 1 });
ok(!c.ok && c.status === 400, 'variação inexistente = 400', c);
c = adicionarItem(uid2, { productId: 'prod_riviera', variantTitle: V, quantity: 1 });
ok(c.ok, 'adiciona item válido', c);
c = adicionarItem(uid2, { productId: 'prod_riviera', variantTitle: V, quantity: 1 });
sac = obterSacola(uid2);
ok(c.ok && sac.items.length === 1 && sac.items[0].quantity === 2 && sac.itemCount === 2, 'mesmo item soma a quantidade em vez de duplicar', sac.items);
c = adicionarItem(uid2, { productId: 'prod_riviera', variantTitle: V, quantity: 99 });
ok(!c.ok && c.status === 400 && /Estoque insuficiente/.test(c.erro), 'passar do estoque ao somar = 400', c);
const item = sac.items[0];
let m = atualizarQuantidade(uid2, String(item.id), 'abc');
ok(!m.ok && m.status === 400, 'quantidade "abc" recusada (antes entrava no banco)', m);
m = atualizarQuantidade(uid2, String(item.id), 1.5);
ok(!m.ok && m.status === 400, 'quantidade 1.5 recusada');
m = atualizarQuantidade(uid2, String(item.id), undefined);
ok(!m.ok && m.status === 400, 'quantidade ausente recusada');
ok(obterSacola(uid2).items[0].quantity === 2, 'recusas não alteram a sacola');
m = atualizarQuantidade(uid2, String(item.id), 1);
ok(m.ok && obterSacola(uid2).items[0].quantity === 1, 'atualiza para 1');
m = atualizarQuantidade(uid2, String(item.id), 99999);
ok(!m.ok && m.status === 400, 'acima do limite = 400');
m = atualizarQuantidade(uid, String(item.id), 1);
ok(!m.ok && m.status === 404, 'cliente não mexe no item da sacola de outro cliente (404)', m);
let rm = removerItem(uid, String(item.id));
ok(!rm.ok && rm.status === 404 && obterSacola(uid2).items.length === 1, 'cliente não remove item de outro cliente');
m = atualizarQuantidade(uid2, String(item.id), 0);
ok(m.ok && obterSacola(uid2).items.length === 0, 'quantidade 0 remove o item');
adicionarItem(uid2, { productId: 'prod_riviera', variantTitle: V, quantity: 1 });
rm = removerItem(uid2, String(obterSacola(uid2).items[0].id));
ok(rm.ok && obterSacola(uid2).items.length === 0, 'remove o próprio item');

console.log(falhas ? `\n${falhas} FALHA(S) de ${total}` : `Serviço de pedidos OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
