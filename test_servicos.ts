// Testa as regras do checkout chamando o serviço direto, sem servidor HTTP.
// Uso: DATA_DIR=<cópia do banco limpo> npx tsx test_servicos.ts
import { db, initDatabase } from './server/db.js';
import { migrarSites } from './server/sites.js';
import { criarPedido } from './server/servicos/pedidos.js';

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

console.log(falhas ? `\n${falhas} FALHA(S) de ${total}` : `Serviço de pedidos OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
