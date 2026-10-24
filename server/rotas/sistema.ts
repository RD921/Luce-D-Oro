import { Request, Response } from 'express';
import type { Express } from 'express';
import { db, logAudit } from '../db.js';
import { criarPainel } from '../adminTeam.js';
import { type AuthenticatedRequest } from '../auth.js';

export function registerSistema(app: Express, painel: ReturnType<typeof criarPainel>) {
  // Verificação simples de saúde (pública, sem dados sensíveis): o painel mostra "Sistema online" a partir dela.
  app.get('/api/health', (_req: Request, res: Response) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ ok: true, db: true, time: new Date().toISOString() });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });

  // 6. Admin Settings
  app.get('/api/admin/settings', painel('configuracoes'), (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT key, value FROM system_settings').all() as Array<{ key: string; value: string }>;
    const settings: Record<string, string> = {};
    rows.forEach((r) => {
      settings[r.key] = r.value;
    });
    res.json(settings);
  });

  app.put('/api/admin/settings', painel('configuracoes'), (req: AuthenticatedRequest, res: Response) => {
    const updates = req.body as Record<string, string>;

    const upsert = db.prepare(`
      INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    for (const [k, v] of Object.entries(updates)) {
      upsert.run(k, String(v));
    }

    logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'SETTINGS_UPDATED',
      entity: 'SETTINGS',
      details: updates,
    });

    res.json({ success: true, message: 'Configurações da loja atualizadas com sucesso.' });
  });
}
