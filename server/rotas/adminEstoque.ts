import { Response } from 'express';
import type { Express } from 'express';
import { db, logAudit } from '../db.js';
import { temVariantes, variantesDe } from '../adminCommerce.js';
import { criarPainel } from '../adminTeam.js';
import { type AuthenticatedRequest } from '../auth.js';

export function registerAdminEstoque(app: Express, painel: ReturnType<typeof criarPainel>) {
  // 4. Admin Stock Adjustments
  app.get('/api/admin/stock', painel('estoque'), (_req: AuthenticatedRequest, res: Response) => {
    const products = db
      .prepare('SELECT id, name, category_id, stock, price, cost_price, image_primary FROM products WHERE is_archived = 0 ORDER BY stock ASC')
      .all()
      .map((p: any) => ({ ...p, variants: variantesDe(p.id) }));

    const movements = db
      .prepare(
        `
      SELECT sm.*, p.name as product_name, u.name as user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.user_id = u.id
      ORDER BY sm.created_at DESC
      LIMIT 30
    `
      )
      .all();

    res.json({ products, movements });
  });

  app.post('/api/admin/stock/adjust', painel('estoque'), (req: AuthenticatedRequest, res: Response) => {
    const { productId, quantityChange, reason } = req.body;

    if (!productId || quantityChange === undefined || !reason) {
      res.status(400).json({ error: 'Produto, variação de quantidade e justificativa são obrigatórios.' });
      return;
    }

    const product = db.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(productId) as any;
    if (!product) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    if (temVariantes(productId)) {
      res.status(409).json({ error: 'Este produto tem variações com estoque próprio. Altere o estoque de cada variação.' });
      return;
    }
    const prevStock = product.stock;
    const change = parseInt(quantityChange, 10);
    const newStock = Math.max(0, prevStock + change);

    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, productId);

    db.prepare(`
      INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(productId, change, prevStock, newStock, reason.trim(), req.user!.id);

    logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'STOCK_MANUAL_ADJUSTMENT',
      entity: 'PRODUCTS',
      entityId: productId,
      details: { productName: product.name, change, prevStock, newStock, reason },
    });

    res.json({
      success: true,
      message: `Estoque do produto "${product.name}" ajustado de ${prevStock} para ${newStock} unidades.`,
      newStock,
    });
  });
}
