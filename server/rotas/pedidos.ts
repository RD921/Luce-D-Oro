import { Response } from 'express';
import type { Express } from 'express';
import { db } from '../db.js';
import { ESTOQUE_SQL, temVariantes, baixarEstoque, resolverEntrega, resolverPagamento } from '../adminCommerce.js';
import { motivoCupomInvalido, registrarUsoCupom } from '../adminTeam.js';
import { authMiddleware, type AuthenticatedRequest } from '../auth.js';

export function registerPedidos(app: Express) {
  // ==================== ORDERS & CHECKOUT ====================

  app.get('/api/orders', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];

    const detailedOrders = orders.map((o) => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      return { ...o, items };
    });

    res.json(detailedOrders);
  });

  app.post('/api/orders', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { shippingAddress, paymentMethod, paymentMethodId, couponCode } = req.body;

    if (!shippingAddress || (!paymentMethod && !paymentMethodId)) {
      res.status(400).json({ error: 'Endereço de entrega e método de pagamento são obrigatórios.' });
      return;
    }

    const cart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as { id: string } | undefined;
    if (!cart) {
      res.status(400).json({ error: 'Sacola vazia.' });
      return;
    }

    const items = db
      .prepare(
        `
      SELECT ci.*, p.name, p.price, p.image_primary, ${ESTOQUE_SQL} AS stock
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

    if (items.length === 0) {
      res.status(400).json({ error: 'Sua sacola está vazia.' });
      return;
    }

    // Stock check
    for (const item of items) {
      if (item.quantity > item.stock) {
        res.status(400).json({ error: `O produto "${item.name}" possui apenas ${item.stock} unidades disponíveis.` });
        return;
      }
    }

    let subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    let discount = 0;
    let cupomUsado: string | null = null;

    if (couponCode) {
      const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(couponCode).trim().toUpperCase()) as any;
      if (coupon && !motivoCupomInvalido(coupon, userId, subtotal)) {
        if (coupon.discount_type === 'percent') {
          discount = (subtotal * coupon.discount_value) / 100;
        } else {
          discount = Math.min(coupon.discount_value, subtotal);
        }
        cupomUsado = coupon.id;
      }
    }

    // Pagamento e entrega: sempre calculados aqui no servidor, nunca confiados ao navegador
    const pag = resolverPagamento(req.body);
    if (pag.erro) {
      res.status(400).json({ error: pag.erro });
      return;
    }
    const entrega = resolverEntrega(req.body.shippingMethodId, subtotal);
    if (entrega.erro) {
      res.status(400).json({ error: entrega.erro });
      return;
    }
    const descontoPagamento = pag.metodo && pag.metodo.discount_percent > 0 ? Math.round(((subtotal - discount) * pag.metodo.discount_percent)) / 100 : 0;
    const total = Math.max(0, subtotal - discount - descontoPagamento) + entrega.custo;
    const orderId = `PED-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

    db.prepare(
      'INSERT INTO orders (id, user_id, total, status, shipping_address, payment_method, shipping_method, shipping_cost, coupon_discount, payment_discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(orderId, userId, total, 'Confirmado', shippingAddress, pag.descricao || paymentMethod, entrega.metodo?.name ?? null, entrega.custo, discount, descontoPagamento);
    if (cupomUsado) registrarUsoCupom(cupomUsado, userId, orderId);

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, variant_title, unit_price, quantity, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertOrderItem.run(
        orderId,
        item.product_id,
        item.name,
        item.variant_title,
        item.price,
        item.quantity,
        item.image_primary
      );

      // Decrement stock (da variação, quando houver) & record movement
      const prevStock = (db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id) as { stock: number }).stock;
      baixarEstoque(item.product_id, item.variant_title, item.quantity);
      const newStock = (db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id) as { stock: number }).stock;

      db.prepare(`
        INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(item.product_id, newStock - prevStock, prevStock, newStock, `Venda aprovada Pedido ${orderId}${temVariantes(item.product_id) ? ` (${item.variant_title})` : ''}`, userId);
    }

    // Clear cart
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);

    res.status(201).json({
      success: true,
      orderId,
      total,
      shippingCost: entrega.custo,
      paymentDiscount: descontoPagamento,
      message: 'Pedido realizado com sucesso! Um e-mail com os detalhes da compra foi enviado.',
    });
  });
}
