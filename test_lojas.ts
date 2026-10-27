// Etapa 1 da Fase 3: migração de site_id. Uso: DATA_DIR=<cópia de um banco ANTIGO> npx tsx test_lojas.ts
import fs from 'node:fs';
import { db, initDatabase, DATA_DIR_EM_USO } from './server/db.js';
import { migrarSites, SITE_PRINCIPAL } from './server/sites.js';
import { migrarLojas, TABELAS_POR_LOJA } from './server/lojas.js';
import { criarProduto } from './server/servicos/produtos.js';
import { DatabaseSync } from 'node:sqlite';

initDatabase(); migrarSites();
let falhas = 0, total = 0;
const ok = (c: boolean, m: string, extra?: unknown) => { total++; if (!c) { falhas++; console.log('FALHOU:', m, extra ?? ''); } };
const tabelas = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>).map((t) => t.name);
const contar = (d: { prepare: typeof db.prepare }) => Object.fromEntries(tabelas.map((t) => { try { return [t, (d.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n]; } catch { return [t, -1]; } }));
const cols = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>).map((c) => c.name);

const antes = contar(db);
ok(!cols('products').includes('site_id') && !cols('users').includes('site_id'), 'banco de teste é antigo (sem site_id)');
const donoAntes = (db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'owner'").get() as { n: number }).n;
const backupsAntes = fs.readdirSync(DATA_DIR_EM_USO).filter((f) => f.startsWith('backup-pre-lojas-')).length;

const r = migrarLojas();
ok(r.alterou === true && !!r.backup, 'migração alterou e informou o backup', r);
ok(!!r.backup && fs.existsSync(r.backup), 'arquivo de backup foi criado');
if (r.backup) {
  const b = new DatabaseSync(r.backup);
  ok((b.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check === 'ok', 'backup está íntegro');
  ok(JSON.stringify(contar(b as any)) === JSON.stringify(antes), 'backup tem exatamente os dados de antes da migração');
  ok(!(b.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>).some((c) => c.name === 'site_id'), 'backup é a versão anterior (sem site_id)');
  b.close();
}
const depois = contar(db);
ok(JSON.stringify(depois) === JSON.stringify(antes), 'nenhuma tabela perdeu ou ganhou linhas', { antes, depois });
for (const t of TABELAS_POR_LOJA) {
  if (!tabelas.includes(t)) continue;
  ok(cols(t).includes('site_id'), `${t} ganhou site_id`);
  const fora = (db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE site_id IS NOT ${'?'}`).get(SITE_PRINCIPAL) as { n: number }).n;
  ok(fora === 0, `todas as linhas de ${t} ficaram na loja principal`, fora);
  ok((db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name = ?").get(`idx_${t}_site`)) !== undefined, `índice de site em ${t}`);
}
ok(cols('users').includes('site_id'), 'users ganhou site_id');
ok((db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'owner' AND site_id IS NULL").get() as { n: number }).n === donoAntes, 'proprietário ficou sem loja (vê todas)');
ok((db.prepare("SELECT COUNT(*) n FROM users WHERE role != 'owner' AND site_id = ?").get(SITE_PRINCIPAL) as { n: number }).n === (db.prepare("SELECT COUNT(*) n FROM users WHERE role != 'owner'").get() as { n: number }).n, 'demais usuários ficaram na loja principal');

const r2 = migrarLojas();
const backupsDepois = fs.readdirSync(DATA_DIR_EM_USO).filter((f) => f.startsWith('backup-pre-lojas-')).length;
ok(r2.alterou === false && backupsDepois === backupsAntes + 1, 'segunda execução não altera nada e não cria outro backup', { r2, backupsAntes, backupsDepois });

// linhas novas sem informar a loja caem na principal (comportamento atual preservado)
const cat = (db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: string }).id;
const np = criarProduto('luce-d-oro', { id: (db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number }).id, email: 'x@x.com' }, { name: 'Teste Lojas', category_id: cat, price: 10, stock: 1, image_primary: '/x.jpg' });
ok(np.ok, 'produto de teste criado pelo serviço', np);
ok((db.prepare("SELECT site_id FROM products WHERE id = ?").get(np.ok ? np.id : '') as { site_id: string }).site_id === SITE_PRINCIPAL, 'produto novo sem site informado vai para a loja principal');

console.log(falhas ? `\n${falhas} FALHA(S) de ${total}` : `Migração de lojas OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
