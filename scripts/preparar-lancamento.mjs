// Limpa os dados de teste da loja e cria a conta de desenvolvedor.
//
// Uso (PowerShell, na pasta do projeto, com o servidor PARADO):
//   node scripts/preparar-lancamento.mjs --email dev@exemplo.com --senha "SuaSenha"            (só mostra o que seria apagado)
//   node scripts/preparar-lancamento.mjs --email dev@exemplo.com --senha "SuaSenha" --confirmar (apaga de verdade)
//
// Apaga: pedidos e itens, carrinhos, uso de cupons, histórico de estoque, auditorias e clientes de teste.
// Mantém: produtos, categorias, banners, textos do site, configurações, cupons, entrega/pagamento e a conta do proprietário.
// Antes de apagar, salva uma cópia do banco em data/backup-AAAAMMDD-HHMMSS.db.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const pega = (nome) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : undefined; };
const email = (pega('email') || '').trim().toLowerCase();
const senha = pega('senha') || '';
const confirmar = args.includes('--confirmar');
const nomeDev = pega('nome') || 'Desenvolvedor';

if (!email.includes('@') || senha.length < 8) {
  console.error('Informe --email e --senha (mínimo 8 caracteres).');
  process.exit(1);
}

const dbPath = path.resolve(process.cwd(), 'data', 'luce_d_oro.db');
if (!fs.existsSync(dbPath)) { console.error(`Banco não encontrado: ${dbPath}`); process.exit(1); }

const db = new DatabaseSync(dbPath);
const existe = (t) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t));
const conta = (t, where = '') => (existe(t) ? db.prepare(`SELECT COUNT(*) AS n FROM ${t} ${where}`).get().n : 0);

const alvos = [
  ['order_items', ''], ['orders', ''], ['coupon_uses', ''], ['cart_items', ''], ['carts', ''],
  ['stock_movements', ''], ['admin_audit_logs', ''], ['password_resets', ''],
  ['sessions', ''], ['users', "WHERE role = 'customer'"],
];
console.log(confirmar ? '== APAGANDO ==' : '== SIMULAÇÃO (nada foi apagado; use --confirmar) ==');
for (const [t, w] of alvos) console.log(`  ${t.padEnd(18)} ${conta(t, w)} registro(s)`);
console.log(`  Conta de desenvolvedor: ${email} (perfil Desenvolvedor)`);
if (!confirmar) process.exit(0);

const agora = new Date();
const p = (n) => String(n).padStart(2, '0');
const carimbo = `${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}`;
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const backup = path.join(path.dirname(dbPath), `backup-${carimbo}.db`);
fs.copyFileSync(dbPath, backup);
console.log(`Cópia de segurança: ${backup}`);

db.exec('PRAGMA foreign_keys = OFF');
db.exec('BEGIN');
try {
  for (const [t, w] of alvos) if (existe(t)) db.exec(`DELETE FROM ${t} ${w}`);
  if (existe('coupons')) db.exec('UPDATE coupons SET usage_count = 0');
  const reinicia = ['order_items', 'orders', 'cart_items', 'stock_movements', 'admin_audit_logs', 'password_resets', 'coupon_uses'].filter(existe);
  if (existe('sqlite_sequence')) for (const t of reinicia) db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(t);

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  const atual = db.prepare('SELECT id, role FROM users WHERE lower(email) = ?').get(email);
  if (atual && atual.role === 'owner') throw new Error('Este e-mail é do proprietário; use outro para a conta dev.');
  if (atual) db.prepare("UPDATE users SET name = ?, password_hash = ?, salt = ?, role = 'dev', is_verified = 1 WHERE id = ?").run(nomeDev, hash, salt, atual.id);
  else db.prepare("INSERT INTO users (name, email, password_hash, salt, role, is_verified) VALUES (?, ?, ?, ?, 'dev', 1)").run(nomeDev, email, hash, salt);
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Nada foi alterado:', e.message);
  process.exit(1);
}
db.exec('PRAGMA foreign_keys = ON');
db.exec('VACUUM');
console.log('Pronto. Dados de teste apagados e conta dev criada. As auditorias recomeçam do zero.');
