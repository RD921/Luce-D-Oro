// Banco: WAL, índices, backup automático e pedido tudo-ou-nada. Servidor limpo em :3001 rodando em ./data (cwd = pasta do projeto).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.log('FALHOU:', m); } };
const api = async (method, path, token, body) => {
  const r = await fetch('http://localhost:3001' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch { /* sem corpo */ } return { s: r.status, j };
};
const email = `cliente.banco.${Date.now()}@x.com`;
const reg = await api('POST', '/api/auth/register', null, { name: 'Cliente Banco', email, password: 'Senha#12345', confirmPassword: 'Senha#12345' });
const cli = reg.j.token || (await api('POST', '/api/auth/login', null, { email, password: 'Senha#12345' })).j.token;
ok(!!cli, 'cliente de teste criado e logado ' + JSON.stringify(reg.j).slice(0, 80));
const db = new DatabaseSync('data/luce_d_oro.db'); db.exec('PRAGMA busy_timeout = 5000');

// 1) WAL e índices
ok(db.prepare('PRAGMA journal_mode').get().journal_mode === 'wal', 'banco em modo WAL');
const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((x) => x.name);
for (const n of ['idx_orders_user', 'idx_order_items_order', 'idx_cart_items_cart', 'idx_products_categoria', 'idx_sessions_user', 'idx_audit_created']) ok(idx.includes(n), 'índice ' + n);
const plano = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM order_items WHERE order_id = ?').all('x').map((r) => r.detail).join(' ');
ok(/idx_order_items_order/.test(plano), 'consulta de itens do pedido usa o índice: ' + plano);

// 2) Backup automático criado e legível
const backups = fs.readdirSync('data').filter((f) => /^backup-auto-.*\.db$/.test(f));
ok(backups.length >= 1, 'backup automático criado na subida (' + backups.length + ')');
if (backups.length) {
  const b = new DatabaseSync('data/' + backups.sort().pop());
  const nb = b.prepare('SELECT COUNT(*) n FROM users').get().n, na = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  ok(nb >= 1 && nb <= na, `backup tem os usuários que existiam quando foi feito (${nb} de ${na} atuais)`);
  ok(b.prepare('PRAGMA integrity_check').get().integrity_check === 'ok', 'backup íntegro');
  b.close();
}

// 3) Pedido normal grava tudo
const antes = () => ({ pedidos: db.prepare('SELECT COUNT(*) n FROM orders').get().n, itens: db.prepare('SELECT COUNT(*) n FROM order_items').get().n, estoque: db.prepare("SELECT stock FROM products WHERE id='prod_riviera'").get().stock, mov: db.prepare('SELECT COUNT(*) n FROM stock_movements').get().n });
let a = antes();
await api('POST', '/api/cart/items', cli, { productId: 'prod_riviera', variantTitle: '18 cm (Padrão)', quantity: 1 });
let r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
let d = antes();
ok(r.s === 201 && d.pedidos === a.pedidos + 1 && d.itens === a.itens + 1 && d.mov === a.mov + 1 && d.estoque === a.estoque - 1, 'pedido normal grava pedido, item, movimento e baixa estoque', { r, a, d });

// 4) Falha no meio do pedido: nada fica salvo (força erro ao gravar o item)
await api('POST', '/api/cart/items', cli, { productId: 'prod_riviera', variantTitle: '18 cm (Padrão)', quantity: 1 });
a = antes();
const cartAntes = (await api('GET', '/api/cart', cli)).j.items?.length;
db.exec("CREATE TRIGGER teste_falha BEFORE INSERT ON order_items BEGIN SELECT RAISE(ABORT, 'falha simulada'); END");
r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
db.exec('DROP TRIGGER teste_falha');
d = antes();
ok(r.s === 500 && /Nada foi cobrado/.test(r.j.error || ''), 'falha devolve erro claro (500)', r);
ok(d.pedidos === a.pedidos && d.itens === a.itens && d.mov === a.mov && d.estoque === a.estoque, 'nada foi salvo: sem pedido, sem item, estoque e movimentos iguais', { a, d });
ok((await api('GET', '/api/cart', cli)).j.items?.length === cartAntes && cartAntes >= 1, 'sacola do cliente continua intacta');
r = await api('POST', '/api/orders', cli, { shippingAddress: 'Rua A, 1', paymentMethod: 'Pix' });
ok(r.s === 201, 'depois da falha o pedido funciona normalmente', r);

console.log(falhas ? `\n${falhas} FALHA(S) de ${total}` : `Banco OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
