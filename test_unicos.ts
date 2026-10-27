// Etapa 2: slug/código únicos por loja (reconstrução de tabelas). Uso: DATA_DIR=<cópia de banco ANTIGO> npx tsx test_unicos.ts
import fs from 'node:fs';
import { db, initDatabase, DATA_DIR_EM_USO } from './server/db.js';
import { migrarSites } from './server/sites.js';
import { migrarLojas, migrarUnicosPorLoja } from './server/lojas.js';
import { registerAdminCommerce } from './server/adminCommerce.js';
void registerAdminCommerce;
import { DatabaseSync } from 'node:sqlite';

initDatabase(); migrarSites(); migrarLojas();
let falhas = 0, total = 0;
const ok = (c: boolean, m: string, extra?: unknown) => { total++; if (!c) { falhas++; console.log('FALHOU:', m, extra ?? ''); } };
const n = (t: string) => (db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
const antes = { categories: n('categories'), products: n('products'), coupons: n('coupons'), cart_items: n('cart_items'), stock_movements: n('stock_movements'), orders: n('orders') };
const produtosAntes = JSON.stringify(db.prepare('SELECT id, slug, category_id, price, site_id FROM products ORDER BY id').all());
const cuponsAntes = JSON.stringify(db.prepare('SELECT id, code, discount_value, usage_count FROM coupons ORDER BY id').all());

const r = migrarUnicosPorLoja();
ok(r.alterou && !!r.backup && fs.existsSync(r.backup), 'reconstrução rodou e criou backup', r);
if (r.backup) { const b = new DatabaseSync(r.backup); ok((b.prepare('PRAGMA integrity_check').get() as any).integrity_check === 'ok', 'backup íntegro'); b.close(); }
const depois = { categories: n('categories'), products: n('products'), coupons: n('coupons'), cart_items: n('cart_items'), stock_movements: n('stock_movements'), orders: n('orders') };
ok(JSON.stringify(antes) === JSON.stringify(depois), 'nenhuma tabela perdeu linhas', { antes, depois });
ok(JSON.stringify(db.prepare('SELECT id, slug, category_id, price, site_id FROM products ORDER BY id').all()) === produtosAntes, 'produtos idênticos antes e depois');
ok(JSON.stringify(db.prepare('SELECT id, code, discount_value, usage_count FROM coupons ORDER BY id').all()) === cuponsAntes, 'cupons idênticos antes e depois');
ok((db.prepare('PRAGMA foreign_key_check').all() as unknown[]).length === 0, 'chaves estrangeiras íntegras');
ok((db.prepare('PRAGMA foreign_keys').get() as any).foreign_keys === 1, 'chaves estrangeiras religadas');
for (const i of ['idx_categories_site', 'idx_products_categoria', 'idx_products_site', 'idx_coupons_site']) ok(!!db.prepare("SELECT 1 FROM sqlite_master WHERE name = ?").get(i), `índice ${i} recriado`);

// única por loja
db.prepare("INSERT INTO sites (id, nome) VALUES ('loja-b', 'Loja B')").run();
const catA = db.prepare("SELECT id, slug FROM categories LIMIT 1").get() as { id: string; slug: string };
const insCat = (id: string, slug: string, site: string) => db.prepare('INSERT INTO categories (id, name, slug, site_id) VALUES (?, ?, ?, ?)').run(id, slug, slug, site);
let falhou = false; try { insCat('cat_dup_a', catA.slug, 'luce-d-oro'); } catch { falhou = true; }
ok(falhou, 'mesmo slug na mesma loja é recusado');
falhou = false; try { insCat('cat_b_1', catA.slug, 'loja-b'); } catch (e) { falhou = true; console.log(e); }
ok(!falhou, 'mesmo slug em OUTRA loja é aceito');
const cupA = db.prepare('SELECT code FROM coupons LIMIT 1').get() as { code: string };
const insCup = (id: string, code: string, site: string) => db.prepare("INSERT INTO coupons (id, code, discount_type, discount_value, site_id) VALUES (?, ?, 'percent', 5, ?)").run(id, code, site);
falhou = false; try { insCup('cp_dup', cupA.code.toLowerCase(), 'luce-d-oro'); } catch { falhou = true; }
ok(falhou, 'mesmo código de cupom (até em minúsculas) na mesma loja é recusado');
falhou = false; try { insCup('cp_b', cupA.code, 'loja-b'); } catch { falhou = true; }
ok(!falhou, 'mesmo código de cupom em outra loja é aceito');
const r2 = migrarUnicosPorLoja();
ok(r2.alterou === false, 'segunda execução não altera nada');

console.log(falhas ? `\n${falhas} FALHA(S) de ${total}` : `Únicos por loja OK (${total} verificações)`);
process.exit(falhas ? 1 : 0);
