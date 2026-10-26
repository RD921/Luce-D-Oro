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
