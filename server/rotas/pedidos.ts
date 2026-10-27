import { Response } from 'express';
import type { Express } from 'express';
import { db } from '../db.js';
import { siteVisitante } from '../sites.js';
import { criarPedido } from '../servicos/pedidos.js';
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
    const r = criarPedido(req.user!.id, siteVisitante(req), req.body ?? {});
    if (!r.ok) {
      res.status(r.status).json({ error: r.erro });
      return;
    }
    res.status(201).json({
      success: true,
      orderId: r.orderId,
      total: r.total,
      shippingCost: r.shippingCost,
      paymentDiscount: r.paymentDiscount,
      message: 'Pedido realizado com sucesso! Um e-mail com os detalhes da compra foi enviado.',
    });
  });
}
