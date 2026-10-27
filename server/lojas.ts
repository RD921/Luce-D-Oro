// Fase 3 — lojas independentes. Etapa 1: cada dado comercial passa a ter dono (site_id).
// Não muda nenhuma regra: tudo o que já existe pertence à loja principal e as consultas continuam iguais.
import path from 'node:path';
import { db, emTransacao } from './db.js';
import { backupAntesDeMigrar } from './backup.js';
import { SITE_PRINCIPAL } from './sites.js';

const colunas = (t: string): string[] => {
  try { return (db.prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>).map((c) => c.name); } catch { return []; }
};

// Tabelas que ganham site_id. As filhas (itens de pedido, variações, movimentos de estoque...) herdam do registro pai.
export const TABELAS_POR_LOJA = ['categories', 'products', 'banners', 'coupons', 'shipping_methods', 'payment_methods', 'orders', 'admin_audit_logs', 'admin_notifications'] as const;

// Roda a cada subida e só altera o que falta. Antes de qualquer alteração faz uma cópia de segurança do banco.
export function migrarLojas(): { alterou: boolean; backup?: string } {
  const faltam = TABELAS_POR_LOJA.filter((t) => colunas(t).length > 0 && !colunas(t).includes('site_id'));
  const usuariosFalta = colunas('users').length > 0 && !colunas('users').includes('site_id');
  if (faltam.length === 0 && !usuariosFalta) return { alterou: false };

  const backup = backupAntesDeMigrar('lojas');
  console.log(`[Lojas] migração: backup em ${path.basename(backup)}`);
  emTransacao(() => {
    for (const t of faltam) db.exec(`ALTER TABLE ${t} ADD COLUMN site_id TEXT NOT NULL DEFAULT '${SITE_PRINCIPAL}'`);
    if (usuariosFalta) {
      // Usuários: o proprietário não pertence a nenhuma loja (NULL = vê todas); os demais ficam na loja principal.
      db.exec(`ALTER TABLE users ADD COLUMN site_id TEXT DEFAULT '${SITE_PRINCIPAL}'`);
      db.exec("UPDATE users SET site_id = NULL WHERE role = 'owner'");
    }
    for (const t of [...TABELAS_POR_LOJA, 'users']) {
      if (colunas(t).includes('site_id')) db.exec(`CREATE INDEX IF NOT EXISTS idx_${t}_site ON ${t}(site_id)`);
    }
  });
  console.log(`[Lojas] site_id adicionado em: ${[...faltam, ...(usuariosFalta ? ['users'] : [])].join(', ')}`);
  return { alterou: true, backup };
}

// Etapa 2: slug de categoria/produto e código de cupom passam a ser únicos POR LOJA (antes eram únicos no sistema todo).
// SQLite não troca uma restrição no lugar: reconstrói a tabela (procedimento oficial) com backup antes e tudo-ou-nada.
const UNICOS: Array<{ tabela: string; campo: string; antigo: RegExp }> = [
  { tabela: 'categories', campo: 'slug', antigo: /\bslug TEXT UNIQUE NOT NULL/ },
  { tabela: 'products', campo: 'slug', antigo: /\bslug TEXT UNIQUE NOT NULL/ },
  { tabela: 'users', campo: 'email', antigo: /\bemail TEXT UNIQUE NOT NULL COLLATE NOCASE/ },
  { tabela: 'coupons', campo: 'code', antigo: /\bcode TEXT UNIQUE NOT NULL COLLATE NOCASE/ },
];

export function migrarUnicosPorLoja(): { alterou: boolean; backup?: string } {
  const sqlDe = (t: string) => (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(t) as { sql: string } | undefined)?.sql ?? '';
  const pendentes = UNICOS.filter((u) => u.antigo.test(sqlDe(u.tabela)) && colunas(u.tabela).includes('site_id'));
  if (pendentes.length === 0) return { alterou: false };

  const backup = backupAntesDeMigrar('unicos');
  console.log(`[Lojas] regras únicas por loja: backup em ${path.basename(backup)}`);
  // As chaves estrangeiras precisam ficar desligadas durante a reconstrução (e só podem ser trocadas fora de transação)
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const u of pendentes) {
        const t = u.tabela;
        const indices = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL").all(t) as Array<{ sql: string }>).map((i) => i.sql);
        const lista = colunas(t).join(', ');
        let ddl = sqlDe(t).replace(u.antigo, (m) => m.replace(' UNIQUE', ''));
        ddl = ddl.replace(/\)\s*$/, `, UNIQUE (site_id, ${u.campo}))`).replace(/^CREATE TABLE\s+"?\w+"?/, `CREATE TABLE ${t}_nova`);
        db.exec(ddl);
        db.exec(`INSERT INTO ${t}_nova (${lista}) SELECT ${lista} FROM ${t}`);
        const n1 = (db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
        const n2 = (db.prepare(`SELECT COUNT(*) n FROM ${t}_nova`).get() as { n: number }).n;
        if (n1 !== n2) throw new Error(`reconstrução de ${t} perdeu linhas (${n1} -> ${n2})`);
        db.exec(`DROP TABLE ${t}`);
        db.exec(`ALTER TABLE ${t}_nova RENAME TO ${t}`);
        for (const i of indices) db.exec(i);
      }
      const problemas = db.prepare('PRAGMA foreign_key_check').all();
      if (problemas.length) throw new Error(`chaves estrangeiras quebradas após a reconstrução: ${JSON.stringify(problemas).slice(0, 200)}`);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* já desfeita */ }
      throw e;
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
  console.log(`[Lojas] únicos por loja em: ${pendentes.map((p) => p.tabela).join(', ')}`);
  return { alterou: true, backup };
}
