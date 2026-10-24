import { Response } from 'express';
import type { Express } from 'express';
import { db, AUTHORIZED_OWNER } from '../db.js';
import { criarPainel } from '../adminTeam.js';
import { type AuthenticatedRequest } from '../auth.js';

export function registerAdminClientes(app: Express, painel: ReturnType<typeof criarPainel>) {
  // 8. Admin Customers
  app.get('/api/admin/customers', painel('clientes'), (_req: AuthenticatedRequest, res: Response) => {
    const customers = db
      .prepare(
        `
      SELECT u.id, u.name, u.email, u.role, u.is_verified, u.created_at,
             COUNT(o.id) as orders_count,
             COALESCE(SUM(o.total), 0) as total_spent,
             MAX(o.created_at) as last_order_date
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id AND o.status != 'Cancelado'
      GROUP BY u.id
      ORDER BY total_spent DESC, orders_count DESC
    `
      )
      .all();

    res.json(customers);
  });

  // 9. Admin Audit Logs
  app.get('/api/admin/audit-logs', painel('auditoria'), (_req: AuthenticatedRequest, res: Response) => {
    const logs = db.prepare('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 60').all() as any[];
    const parsed = logs.map((l) => ({
      ...l,
      details: l.details_json ? JSON.parse(l.details_json) : null,
    }));
    res.json(parsed);
  });

  // 10. Admin Real-time Alerts
  app.get('/api/admin/alerts', painel('dashboard'), (_req: AuthenticatedRequest, res: Response) => {
    const alerts: Array<{ id: string; type: 'warning' | 'info' | 'danger'; title: string; message: string; link?: string }> = [];

    // Low stock alerts
    const lowStock = (db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= 5 AND is_archived = 0').get() as { count: number }).count;
    if (lowStock > 0) {
      alerts.push({
        id: 'alert_low_stock',
        type: 'warning',
        title: 'Atenção ao Estoque',
        message: `Existem ${lowStock} joias com estoque crítico (menor ou igual a 5 unidades).`,
        link: 'stock',
      });
    }

    // Pending shipments
    const pendingShipments = (db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'Confirmado' OR status = 'Em Preparação'").get() as { count: number }).count;
    if (pendingShipments > 0) {
      alerts.push({
        id: 'alert_orders_pending',
        type: 'info',
        title: 'Expedição Pendente',
        message: `${pendingShipments} pedidos aprovados aguardando despacho e código de rastreio.`,
        link: 'orders',
      });
    }

    // Security status alert
    const ownerRecord = db.prepare("SELECT is_verified FROM users WHERE email = ? AND role = 'owner'").get(AUTHORIZED_OWNER.email.toLowerCase()) as any;
    if (ownerRecord && ownerRecord.is_verified) {
      alerts.push({
        id: 'alert_security_ok',
        type: 'info',
        title: 'Proteção Ativa',
        message: 'Acesso administrativo exclusivo de Rodrigo Arrezzi validado com sucesso no banco de dados.',
      });
    }

    res.json(alerts);
  });
}
