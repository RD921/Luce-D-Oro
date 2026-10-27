import { Response } from 'express';
import type { Express } from 'express';
import { db } from '../db.js';
import { criarPainel } from '../adminTeam.js';
import { siteAdmin, SITE_PRINCIPAL } from '../sites.js';
import { type AuthenticatedRequest } from '../auth.js';

export function registerAdminDashboard(app: Express, painel: ReturnType<typeof criarPainel>) {
  // 1. Admin Dashboard Overview
  app.get('/api/admin/dashboard', painel('dashboard'), (req: AuthenticatedRequest, res: Response) => {
    const { period = 'all' } = req.query;
    const loja = siteAdmin(req);

    let dateFilter = '';
    if (period === 'today') {
      dateFilter = " AND date(created_at) = date('now')";
    } else if (period === '7d') {
      dateFilter = " AND datetime(created_at) >= datetime('now', '-7 days')";
    } else if (period === '30d') {
      dateFilter = " AND datetime(created_at) >= datetime('now', '-30 days')";
    } else if (period === '90d') {
      dateFilter = " AND datetime(created_at) >= datetime('now', '-90 days')";
    }

    const allOrders = db.prepare(`SELECT * FROM orders WHERE site_id = ? ${dateFilter} ORDER BY created_at DESC`).all(loja) as any[];

    const ordersCount = allOrders.length;
    const statusCounts: Record<string, number> = {
      Confirmado: 0,
      Pago: 0,
      'Em Preparação': 0,
      Enviado: 0,
      Entregue: 0,
      Cancelado: 0,
    };

    let revenue = 0;
    let paidOrdersCount = 0;

    allOrders.forEach((o) => {
      if (statusCounts[o.status] !== undefined) {
        statusCounts[o.status]++;
      } else {
        statusCounts[o.status] = 1;
      }

      if (o.status !== 'Cancelado') {
        revenue += o.total;
        paidOrdersCount++;
      }
    });

    const averageTicket = paidOrdersCount > 0 ? revenue / paidOrdersCount : 0;

    // Inventory stats
    const lowStockRows = db
      .prepare('SELECT id, name, stock, price, category_id, image_primary FROM products WHERE stock <= 5 AND is_archived = 0 AND site_id = ? ORDER BY stock ASC')
      .all(loja) as any[];
    const outOfStockCount = lowStockRows.filter((p) => p.stock === 0).length;

    // Active coupons
    const activeCoupons = (db.prepare('SELECT COUNT(*) as count FROM coupons WHERE is_active = 1 AND site_id = ?').get(loja) as { count: number }).count;

    // Top Products from order_items
    const topProducts = db
      .prepare(
        `
      SELECT oi.product_id, oi.product_name, oi.image_url, SUM(oi.quantity) as total_sold, SUM(oi.unit_price * oi.quantity) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.site_id = ? AND o.status != 'Cancelado' ${dateFilter.replace(/created_at/g, 'o.created_at')}
      GROUP BY oi.product_id
      ORDER BY total_sold DESC
      LIMIT 5
    `
      )
      .all(loja);

    // Recent 8 orders with user name
    const recentOrders = allOrders.slice(0, 8).map((o) => {
      const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(o.user_id) as any;
      const items = db.prepare('SELECT product_name, variant_title, quantity, unit_price FROM order_items WHERE order_id = ?').all(o.id);
      return {
        ...o,
        customerName: user?.name || 'Cliente',
        customerEmail: user?.email || '',
        items,
      };
    });

    // Total registered customers
    const totalCustomers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer' AND (site_id = ? OR (site_id IS NULL AND ? = '"+SITE_PRINCIPAL+"'))").get(loja, loja) as { count: number }).count;

    res.json({
      period,
      ordersCount,
      revenue,
      averageTicket,
      statusCounts,
      lowStockCount: lowStockRows.length,
      outOfStockCount,
      lowStockProducts: lowStockRows,
      topProducts,
      recentOrders,
      activeCoupons,
      totalCustomers,
    });
  });
}
