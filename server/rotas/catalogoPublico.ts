import { Request, Response } from 'express';
import type { Express } from 'express';
import { db } from '../db.js';
import { variantesDe } from '../adminCommerce.js';
import { validarCupomPublico } from '../servicos/cupons.js';
import { siteVisitante, SITE_PRINCIPAL } from '../sites.js';

export function registerCatalogoPublico(app: Express) {
  // ==================== PUBLIC STORE ROUTES ====================

  // Public Categories
  app.get('/api/catalog/categories', (req: Request, res: Response) => {
    const categories = db.prepare('SELECT * FROM categories WHERE COALESCE(is_active, 1) = 1 AND site_id = ? ORDER BY display_order ASC, name ASC').all(siteVisitante(req));
    res.json(categories);
  });

  // Public Products
  app.get('/api/catalog/products', (req: Request, res: Response) => {
    const { category, featured, search } = req.query;

    let query = 'SELECT * FROM products WHERE is_archived = 0 AND site_id = ?';
    const params: any[] = [siteVisitante(req)];

    if (category) {
      query += ' AND category_id = ?';
      params.push(category);
    }

    if (featured === 'true') {
      query += ' AND is_featured = 1';
    }

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY is_featured DESC, created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    const products = rows.map((r) => ({
      ...r,
      images: JSON.parse(r.images_json || '[]'),
      variants: JSON.parse(r.variants_json || '[]'),
      variant_stock: variantesDe(r.id),
    }));

    res.json(products);
  });

  // Public Single Product
  app.get('/api/catalog/products/:slug', (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const row = db.prepare('SELECT * FROM products WHERE (slug = ? OR id = ?) AND is_archived = 0 AND site_id = ?').get(slug, slug, siteVisitante(req)) as any;

    if (!row) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    res.json({
      ...row,
      images: JSON.parse(row.images_json || '[]'),
      variants: JSON.parse(row.variants_json || '[]'),
      variant_stock: variantesDe(row.id),
    });
  });

  // Public Active Banners
  app.get('/api/banners', (req: Request, res: Response) => {
    const banners = db.prepare('SELECT * FROM banners WHERE is_active = 1 AND site_id = ? ORDER BY display_order ASC').all(siteVisitante(req));
    res.json(banners);
  });

  // Public Settings
  app.get('/api/settings', (req: Request, res: Response) => {
    const loja = siteVisitante(req);
    // A loja principal ainda usa os ajustes antigos; toda loja tem os seus próprios em site_settings (que valem por cima).
    const base = loja === SITE_PRINCIPAL ? (db.prepare('SELECT key, value FROM system_settings').all() as Array<{ key: string; value: string }>) : [];
    const proprios = db.prepare("SELECT key, value FROM site_settings WHERE site_id = ? AND key NOT LIKE 'seo_%'").all(loja) as Array<{ key: string; value: string }>;
    const settings: Record<string, string> = {};
    [...base, ...proprios].forEach((r) => {
      settings[r.key] = r.value;
    });
    res.json(settings);
  });

  // Public Validate Coupon
  app.post('/api/coupons/validate', (req: Request, res: Response) => {
    const tk = (req as any).cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    const sessao = tk ? (db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?').get(tk, new Date().toISOString()) as { user_id: number } | undefined) : undefined;
    const r = validarCupomPublico(siteVisitante(req), req.body?.code, req.body?.cartTotal, sessao ? sessao.user_id : null);
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.json({ valid: true, code: r.code, discountType: r.discountType, discountValue: r.discountValue, discountAmount: r.discountAmount });
  });
}
