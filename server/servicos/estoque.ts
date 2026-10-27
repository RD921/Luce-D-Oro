import { db, logAudit, emTransacao } from '../db.js';
import { temVariantes, variantesDe, sincronizarTotal } from '../adminCommerce.js';

// Regras do estoque. Não conhece Express: recebe os dados e devolve o resultado.
export type Falha = { ok: false; status: number; erro: string };
const falha = (status: number, erro: string): Falha => ({ ok: false, status, erro });
export interface Quem { id: number; email: string }

const MAX = 100000;
// Só aceita número inteiro de verdade ("12" vale; "abc", "1.5" e vazio não).
const inteiro = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
};

export function obterEstoque(siteId: string) {
  const products = db
    .prepare('SELECT id, name, category_id, stock, price, cost_price, image_primary FROM products WHERE is_archived = 0 AND site_id = ? ORDER BY stock ASC')
    .all(siteId)
    .map((p: any) => ({ ...p, variants: variantesDe(p.id) }));
  const movements = db.prepare(`
    SELECT sm.*, p.name as product_name, u.name as user_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN users u ON sm.user_id = u.id
    WHERE p.site_id = ?
    ORDER BY sm.created_at DESC
    LIMIT 30
  `).all(siteId);
  return { products, movements };
}

// Soma ou subtrai do estoque (produto sem variações). Nunca deixa o estoque abaixo de zero.
export function ajustarEstoque(siteId: string, quem: Quem, d: Record<string, any>): { ok: true; newStock: number; mensagem: string } | Falha {
  if (!d.productId || d.quantityChange === undefined || !d.reason) return falha(400, 'Produto, variação de quantidade e justificativa são obrigatórios.');
  const change = inteiro(d.quantityChange);
  if (change === null || change === 0 || Math.abs(change) > MAX) return falha(400, `Informe uma variação inteira, diferente de zero, de até ${MAX} unidades.`);
  if (typeof d.reason !== 'string' || d.reason.trim().length < 1 || d.reason.length > 300) return falha(400, 'Justificativa inválida (até 300 caracteres, não vazia).');

  const product = db.prepare('SELECT id, name, stock FROM products WHERE id = ? AND site_id = ?').get(String(d.productId), siteId) as { id: string; name: string; stock: number } | undefined;
  if (!product) return falha(404, 'Produto não encontrado.');
  if (temVariantes(product.id)) return falha(409, 'Este produto tem variações com estoque próprio. Altere o estoque de cada variação.');

  const prevStock = product.stock;
  const newStock = Math.max(0, prevStock + change);
  emTransacao(() => {
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, product.id);
    // O histórico guarda a mudança que realmente aconteceu (se o estoque travou em zero, não a pedida)
    db.prepare('INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(product.id, newStock - prevStock, prevStock, newStock, d.reason.trim(), quem.id);
  });
  logAudit({ userId: quem.id, userEmail: quem.email, action: 'STOCK_MANUAL_ADJUSTMENT', entity: 'PRODUCTS', entityId: product.id, details: { productName: product.name, change, prevStock, newStock, reason: d.reason } });
  return { ok: true, newStock, mensagem: `Estoque do produto "${product.name}" ajustado de ${prevStock} para ${newStock} unidades.` };
}

// Define a quantidade exata (contagem). Em produto com variações, informe qual variação.
export function definirEstoque(siteId: string, quem: Quem, d: Record<string, any>): { ok: true; newStock: number; mensagem: string } | Falha {
  const q = inteiro(d.quantity);
  if (!d.productId || q === null || q < 0 || q > MAX) return falha(400, `Informe uma quantidade inteira entre 0 e ${MAX}.`);
  const p = db.prepare('SELECT id, name, stock FROM products WHERE id = ? AND site_id = ?').get(String(d.productId), siteId) as { id: string; name: string; stock: number } | undefined;
  if (!p) return falha(404, 'Produto não encontrado.');
  const motivo = String(d.reason || '').trim().slice(0, 300) || 'Contagem de estoque';
  const variante = d.variant !== undefined ? String(d.variant) : '';

  if (temVariantes(p.id)) {
    if (!variante) return falha(409, 'Este produto tem variações com estoque próprio. Informe qual variação alterar.');
    const v = db.prepare('SELECT stock FROM product_variants WHERE product_id = ? AND title = ?').get(p.id, variante) as { stock: number } | undefined;
    if (!v) return falha(404, 'Variação não encontrada.');
    if (q !== v.stock) {
      emTransacao(() => {
        db.prepare('UPDATE product_variants SET stock = ? WHERE product_id = ? AND title = ?').run(q, p.id, variante);
        const novo = sincronizarTotal(p.id);
        db.prepare('INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)')
          .run(p.id, novo - p.stock, p.stock, novo, `${motivo} (${variante})`, quem.id);
      });
      logAudit({ userId: quem.id, userEmail: quem.email, action: 'STOCK_SET', entity: 'PRODUCTS', entityId: p.id, details: { name: p.name, variante, de: v.stock, para: q, motivo } });
    }
    return { ok: true, newStock: q, mensagem: `Estoque de "${p.name}" (${variante}) definido em ${q} unidade(s).` };
  }

  if (q !== p.stock) {
    emTransacao(() => {
      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(q, p.id);
      db.prepare('INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(p.id, q - p.stock, p.stock, q, motivo, quem.id);
    });
    logAudit({ userId: quem.id, userEmail: quem.email, action: 'STOCK_SET', entity: 'PRODUCTS', entityId: p.id, details: { name: p.name, de: p.stock, para: q, motivo } });
  }
  return { ok: true, newStock: q, mensagem: `Estoque de "${p.name}" definido em ${q} unidade(s).` };
}
