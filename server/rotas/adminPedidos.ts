import { Response } from 'express';
import type { Express } from 'express';
import { db, logAudit } from '../db.js';
import { criarPainel } from '../adminTeam.js';
import { type AuthenticatedRequest } from '../auth.js';

export function registerAdminPedidos(app: Express, painel: ReturnType<typeof criarPainel>) {
  // 3. Admin Orders Management
  app.get('/api/admin/orders', painel('pedidos'), (req: AuthenticatedRequest, res: Response) => {
    const { status, q } = req.query;

    let query = `
      SELECT o.*, u.name as customer_name, u.email as customer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND o.status = ?';
      params.push(status);
    }

    if (q) {
      query += ' AND (o.id LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR o.shipping_address LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    query += ' ORDER BY o.created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];

    const detailed = rows.map((order) => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      return { ...order, items };
    });

    res.json(detailed);
  });

  app.put('/api/admin/orders/:id/status', painel('pedidos'), (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const { status, trackingCode, internalNotes } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    db.prepare(`
      UPDATE orders SET
        status = COALESCE(?, status),
        tracking_code = COALESCE(?, tracking_code),
        internal_notes = COALESCE(?, internal_notes)
      WHERE id = ?
    `).run(status || null, trackingCode || null, internalNotes || null, id);

    logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'ORDER_UPDATED',
      entity: 'ORDERS',
      entityId: id,
      details: { previousStatus: order.status, newStatus: status, trackingCode },
    });

    res.json({ success: true, message: `Pedido ${id} atualizado para "${status}".` });
  });
}
