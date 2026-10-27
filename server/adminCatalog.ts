// Fase 3b: fotos de produto, estoque (quantidade exata e exclusão), reordenar categorias e dados extras do dashboard.
import { definirEstoque } from './servicos/estoque.js';
import { siteAdmin } from './sites.js';
import type { Express, Request, Response, RequestHandler } from 'express';
import { db, logAudit } from './db.js';
import type { Area } from './adminTeam.js';

type Usuario = { id: number; email: string };
const quem = (req: Request): Usuario => (req as unknown as { user: Usuario }).user;

const urlImagemOk = (u: string) => /^(\/uploads\/|\/images\/|https?:\/\/)/.test(u) && u.length <= 600 && !/[\s<>"']/.test(u);

const DIAS: Record<string, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90, all: 90 };

export function registerAdminCatalog(app: Express, painel: (a: Area) => RequestHandler) {
  // ---------- Fotos do produto ----------
  app.put('/api/admin/products/:id/photos', painel('produtos'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const p = db.prepare('SELECT id, name, image_primary, images_json FROM products WHERE id = ? AND site_id = ?').get(id, siteAdmin(req)) as { id: string; name: string; image_primary: string; images_json: string } | undefined;
    if (!p) { res.status(404).json({ error: 'Produto não encontrado.' }); return; }

    const principal = req.body?.image_primary !== undefined ? String(req.body.image_primary).trim() : p.image_primary;
    if (!principal || !urlImagemOk(principal)) { res.status(400).json({ error: 'A foto principal é obrigatória e precisa ser um endereço de imagem válido.' }); return; }
    let extras: string[];
    if (req.body?.images !== undefined) {
      if (!Array.isArray(req.body.images)) { res.status(400).json({ error: 'A lista de fotos adicionais é inválida.' }); return; }
      extras = req.body.images.map((x: unknown) => String(x).trim()).filter(Boolean);
    } else {
      try { extras = JSON.parse(p.images_json || '[]'); } catch { extras = []; }
    }
    if (extras.length > 12) { res.status(400).json({ error: 'No máximo 12 fotos adicionais por produto.' }); return; }
    if (extras.some((x) => !urlImagemOk(x))) { res.status(400).json({ error: 'Alguma foto tem endereço inválido.' }); return; }
    extras = extras.filter((x, i) => x !== principal && extras.indexOf(x) === i);

    db.prepare('UPDATE products SET image_primary = ?, images_json = ? WHERE id = ?').run(principal, JSON.stringify(extras), id);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'PRODUCT_PHOTOS_UPDATED', entity: 'PRODUCTS', entityId: id, details: { name: p.name, fotos: extras.length + 1 } });
    res.json({ success: true, image_primary: principal, images: extras, message: 'Fotos atualizadas.' });
  });

  // ---------- Estoque: definir quantidade exata (regras em servicos/estoque.ts) ----------
  app.post('/api/admin/stock/set', painel('estoque'), (req: Request, res: Response) => {
    const r = definirEstoque(siteAdmin(req), quem(req), req.body || {});
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.json({ success: true, newStock: r.newStock, message: r.mensagem });
  });

  // ---------- Produtos: restaurar e apagar de vez ----------
  app.post('/api/admin/products/:id/restore', painel('produtos'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const p = db.prepare('SELECT name FROM products WHERE id = ? AND site_id = ?').get(id, siteAdmin(req)) as { name: string } | undefined;
    if (!p) { res.status(404).json({ error: 'Produto não encontrado.' }); return; }
    db.prepare('UPDATE products SET is_archived = 0 WHERE id = ?').run(id);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'PRODUCT_RESTORED', entity: 'PRODUCTS', entityId: id, details: { name: p.name } });
    res.json({ success: true, message: `"${p.name}" voltou para a loja.` });
  });

  app.delete('/api/admin/products/:id/permanent', painel('produtos'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const p = db.prepare('SELECT name FROM products WHERE id = ? AND site_id = ?').get(id, siteAdmin(req)) as { name: string } | undefined;
    if (!p) { res.status(404).json({ error: 'Produto não encontrado.' }); return; }
    const vendidos = (db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?').get(id) as { n: number }).n;
    if (vendidos > 0) {
      res.status(409).json({ error: `"${p.name}" já foi vendido em ${vendidos} item(ns) de pedido e não pode ser apagado de vez, para não quebrar o histórico. Use "Arquivar" para tirá-lo da loja.` });
      return;
    }
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM cart_items WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: 'Não foi possível apagar o produto.' });
      return;
    }
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'PRODUCT_DELETED', entity: 'PRODUCTS', entityId: id, details: { name: p.name } });
    res.json({ success: true, message: `"${p.name}" foi apagado.` });
  });

  // ---------- Categorias: reordenar ----------
  app.put('/api/admin/categories-order', painel('categorias'), (req: Request, res: Response) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((x: unknown) => typeof x !== 'string')) { res.status(400).json({ error: 'Lista de categorias inválida.' }); return; }
    const existentes = new Set((db.prepare('SELECT id FROM categories WHERE site_id = ?').all(siteAdmin(req)) as Array<{ id: string }>).map((r) => r.id));
    if (ids.some((x: string) => !existentes.has(x)) || new Set(ids).size !== ids.length) { res.status(400).json({ error: 'A lista tem categorias inexistentes ou repetidas.' }); return; }
    const up = db.prepare('UPDATE categories SET display_order = ? WHERE id = ?');
    (ids as string[]).forEach((id, i) => up.run(i + 1, id));
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'CATEGORIES_REORDERED', entity: 'CATEGORIES', entityId: 'all', details: { ids } });
    res.json({ success: true, message: 'Ordem das categorias salva.' });
  });

  // ---------- Dashboard: dados extras ----------
  app.get('/api/admin/dashboard/insights', painel('dashboard'), (req: Request, res: Response) => {
    const periodo = String(req.query.period || '30d');
    const dias = DIAS[periodo] ?? 30;
    const loja = siteAdmin(req);
    const sem = "status != 'Cancelado' AND site_id = ?";

    const linhas = db.prepare(`SELECT date(created_at) AS d, COUNT(*) AS n, COALESCE(SUM(total),0) AS r FROM orders WHERE ${sem} AND date(created_at) >= date('now', ?) GROUP BY d`).all(loja, `-${dias - 1} days`) as Array<{ d: string; n: number; r: number }>;
    const mapa = new Map(linhas.map((l) => [l.d, l]));
    const serie: Array<{ dia: string; pedidos: number; receita: number }> = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const l = mapa.get(d);
      serie.push({ dia: d, pedidos: l?.n ?? 0, receita: l?.r ?? 0 });
    }

    let anterior: { pedidos: number; receita: number } | null = null;
    if (periodo !== 'all') {
      const a = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS r FROM orders WHERE ${sem} AND date(created_at) >= date('now', ?) AND date(created_at) < date('now', ?)`).get(loja, `-${dias * 2 - 1} days`, `-${dias - 1} days`) as { n: number; r: number };
      anterior = { pedidos: a.n, receita: a.r };
    }

    const filtro = periodo === 'all' ? '' : `AND date(o.created_at) >= date('now', '-${dias - 1} days')`;
    const porCategoria = db.prepare(
      `SELECT COALESCE(c.name, p.category_id, 'Sem categoria') AS nome, SUM(oi.unit_price * oi.quantity) AS receita, SUM(oi.quantity) AS itens
       FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id LEFT JOIN categories c ON c.id = p.category_id
       WHERE o.status != 'Cancelado' AND o.site_id = ? ${filtro} GROUP BY nome ORDER BY receita DESC LIMIT 8`
    ).all(loja);
    const pagamentos = db.prepare(
      `SELECT payment_method AS metodo, COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS receita FROM orders o WHERE o.status != 'Cancelado' AND o.site_id = ? ${filtro} GROUP BY payment_method ORDER BY pedidos DESC LIMIT 6`
    ).all(loja);
    const novosClientes = (db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer' AND site_id = ? ${periodo === 'all' ? '' : `AND date(created_at) >= date('now', '-${dias - 1} days')`}`).get(loja) as { n: number }).n;
    const aguardando = (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('Confirmado','Pago','Em Preparação') AND site_id = ?").get(loja) as { n: number }).n;
    const valorEstoque = db.prepare('SELECT COALESCE(SUM(stock * price),0) AS venda, COALESCE(SUM(stock * COALESCE(cost_price,0)),0) AS custo, COALESCE(SUM(stock),0) AS pecas FROM products WHERE is_archived = 0 AND site_id = ?').get(loja);

    res.json({ periodo, dias, serie, anterior, porCategoria, pagamentos, novosClientes, aguardando, estoque: valorEstoque });
  });
}
