import { Response } from 'express';
import type { Express } from 'express';
import { db } from '../db.js';
import { ESTOQUE_SQL, temVariantes, limiteFreteGratis } from '../adminCommerce.js';
import { authMiddleware, type AuthenticatedRequest } from '../auth.js';

export function registerCarrinho(app: Express) {
  // ==================== CART ROUTES (PRIVATE TO AUTH USERS) ====================

  app.get('/api/cart', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    let cart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as { id: string } | undefined;

    if (!cart) {
      const newCartId = `cart_${userId}_${Date.now()}`;
      db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run(newCartId, userId);
      cart = { id: newCartId };
    }

    const items = db
      .prepare(
        `
      SELECT ci.id, ci.product_id, ci.variant_title, ci.quantity, p.name, p.price, p.image_primary, ${ESTOQUE_SQL} AS stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = ?
    `
      )
      .all(cart.id) as Array<{
      id: number;
      product_id: string;
      variant_title: string;
      quantity: number;
      name: string;
      price: number;
      image_primary: string;
      stock: number;
    }>;

    const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

    const thresholdRow = db.prepare("SELECT value FROM system_settings WHERE key = 'free_shipping_threshold'").get() as
      | { value: string }
      | undefined;
    const limiteLoja = limiteFreteGratis();
    const semFretes = (db.prepare('SELECT COUNT(*) AS n FROM shipping_methods WHERE is_active = 1').get() as { n: number }).n === 0;
    const freeShippingAvailable = limiteLoja !== null || semFretes;
    const freeShippingThreshold = limiteLoja ?? (thresholdRow ? parseFloat(thresholdRow.value) : 500.0);

    res.json({
      cartId: cart.id,
      items,
      itemCount,
      total,
      freeShippingThreshold,
      freeShippingAvailable,
      hasFreeShipping: freeShippingAvailable && total >= freeShippingThreshold,
    });
  });

  app.post('/api/cart/items', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { productId } = req.body;
    const quantity = Number(req.body.quantity ?? 1);

    if (!productId) {
      res.status(400).json({ error: 'Produto e variação são obrigatórios.' });
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      res.status(400).json({ error: 'Quantidade inválida.' });
      return;
    }

    const product = db.prepare('SELECT id, stock, variants_json FROM products WHERE id = ? AND is_archived = 0').get(productId) as
      | { id: string; stock: number; variants_json: string }
      | undefined;
    if (!product) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    // Produto sem variações usa a variação "Único"; com variações, a escolhida precisa existir e ter estoque próprio
    const variantTitle = String(req.body.variantTitle || '').trim() || (JSON.parse(product.variants_json || '[]')[0] ?? 'Único');
    if (temVariantes(product.id)) {
      const linha = db.prepare('SELECT stock FROM product_variants WHERE product_id = ? AND title = ?').get(product.id, variantTitle) as { stock: number } | undefined;
      if (!linha) {
        res.status(400).json({ error: 'Variação indisponível para este produto.' });
        return;
      }
      product.stock = linha.stock;
    }

    let cart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as { id: string } | undefined;
    if (!cart) {
      const newCartId = `cart_${userId}_${Date.now()}`;
      db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run(newCartId, userId);
      cart = { id: newCartId };
    }

    const existing = db
      .prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_title = ?')
      .get(cart.id, productId, variantTitle) as { id: number; quantity: number } | undefined;

    if (existing) {
      const newQty = existing.quantity + Number(quantity);
      if (newQty > product.stock) {
        res.status(400).json({ error: `Estoque insuficiente. Restam apenas ${product.stock} unidades.` });
        return;
      }
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existing.id);
    } else {
      if (quantity > product.stock) {
        res.status(400).json({ error: `Estoque insuficiente. Restam apenas ${product.stock} unidades.` });
        return;
      }
      db.prepare('INSERT INTO cart_items (cart_id, product_id, variant_title, quantity) VALUES (?, ?, ?, ?)').run(
        cart.id,
        productId,
        variantTitle,
        Number(quantity)
      );
    }

    res.json({ success: true, message: 'Item adicionado à sacola com sucesso.' });
  });

  app.put('/api/cart/items/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const itemId = String(req.params.id);
    const { quantity } = req.body;
    const userId = req.user!.id;

    const item = db
      .prepare(
        `
      SELECT ci.id, ci.product_id, ${ESTOQUE_SQL} AS stock
      FROM cart_items ci
      JOIN carts c ON ci.cart_id = c.id
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ? AND c.user_id = ?
    `
      )
      .get(itemId, userId) as { id: number; product_id: string; stock: number } | undefined;

    if (!item) {
      res.status(404).json({ error: 'Item não encontrado na sua sacola.' });
      return;
    }

    if (quantity <= 0) {
      db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);
    } else {
      if (quantity > item.stock) {
        res.status(400).json({ error: `Estoque insuficiente. Máximo de ${item.stock} unidades.` });
        return;
      }
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, itemId);
    }

    res.json({ success: true });
  });

  app.delete('/api/cart/items/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const itemId = String(req.params.id);
    const userId = req.user!.id;

    const item = db
      .prepare(
        `
      SELECT ci.id 
      FROM cart_items ci
      JOIN carts c ON ci.cart_id = c.id
      WHERE ci.id = ? AND c.user_id = ?
    `
      )
      .get(itemId, userId);

    if (!item) {
      res.status(404).json({ error: 'Item não encontrado na sua sacola.' });
      return;
    }

    db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);
    res.json({ success: true, message: 'Item removido da sacola.' });
  });
}
