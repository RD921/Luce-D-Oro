import { Response } from 'express';
import type { Express } from 'express';
import { db, logAudit } from '../db.js';
import { criarPainel } from '../adminTeam.js';
import { siteAdmin } from '../sites.js';
import { type AuthenticatedRequest } from '../auth.js';

export function registerAdminBanners(app: Express, painel: ReturnType<typeof criarPainel>) {
  // 5. Admin Banners
  app.get('/api/admin/banners', painel('banners'), (req: AuthenticatedRequest, res: Response) => {
    const banners = db.prepare('SELECT * FROM banners WHERE site_id = ? ORDER BY display_order ASC, created_at DESC').all(siteAdmin(req));
    res.json(banners);
  });

  app.post('/api/admin/banners', painel('banners'), (req: AuthenticatedRequest, res: Response) => {
    const { title, subtitle, badge, cta_text, cta_link, image_desktop, is_active = 1, display_order = 0 } = req.body;

    if (!title || !image_desktop) {
      res.status(400).json({ error: 'Título e imagem do banner são obrigatórios.' });
      return;
    }

    const id = `banner_${Date.now().toString(36)}`;
    db.prepare(`
      INSERT INTO banners (id, title, subtitle, badge, cta_text, cta_link, image_desktop, is_active, display_order, site_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, subtitle || '', badge || '', cta_text || 'Descubra', cta_link || '#pulseiras', image_desktop, is_active ? 1 : 0, display_order, siteAdmin(req));

    logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'BANNER_CREATED',
      entity: 'BANNERS',
      entityId: id,
      details: { title },
    });

    res.status(201).json({ success: true, id, message: 'Banner criado com sucesso.' });
  });

  app.put('/api/admin/banners/:id', painel('banners'), (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const { title, subtitle, badge, cta_text, cta_link, image_desktop, is_active, display_order } = req.body;

    db.prepare(`
      UPDATE banners SET
        title = COALESCE(?, title),
        subtitle = COALESCE(?, subtitle),
        badge = COALESCE(?, badge),
        cta_text = COALESCE(?, cta_text),
        cta_link = COALESCE(?, cta_link),
        image_desktop = COALESCE(?, image_desktop),
        is_active = COALESCE(?, is_active),
        display_order = COALESCE(?, display_order)
      WHERE id = ? AND site_id = ?
    `).run(
      title || null,
      subtitle !== undefined ? subtitle : null,
      badge !== undefined ? badge : null,
      cta_text || null,
      cta_link || null,
      image_desktop || null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      display_order !== undefined ? display_order : null,
      id, siteAdmin(req)
    );

    logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'BANNER_UPDATED',
      entity: 'BANNERS',
      entityId: id,
      details: { title },
    });

    res.json({ success: true, message: 'Banner atualizado.' });
  });

  app.delete('/api/admin/banners/:id', painel('banners'), (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    db.prepare('DELETE FROM banners WHERE id = ? AND site_id = ?').run(id, siteAdmin(req));

    logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'BANNER_DELETED',
      entity: 'BANNERS',
      entityId: id,
    });

    res.json({ success: true, message: 'Banner removido.' });
  });
}
