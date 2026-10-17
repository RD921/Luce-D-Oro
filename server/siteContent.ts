// Textos e imagens da loja editáveis pelo proprietário (aba "Conteúdo" do painel).
import type { Express, Request, Response, RequestHandler } from 'express';
import { db, logAudit } from './db.js';
import { CONTENT_FIELDS, CONTENT_DEFAULTS } from '../src/content/siteContentDefaults.js';

type Owner = { id: number; email: string };
const dono = (req: Request): Owner => (req as unknown as { user: Owner }).user;

function lerPersonalizados(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM site_content').all() as Array<{ key: string; value: string }>;
  const out: Record<string, string> = {};
  for (const r of rows) if (r.key in CONTENT_DEFAULTS) out[r.key] = r.value;
  return out;
}

// Imagens só podem ser da própria loja (/images, /uploads) ou um link https — nunca "javascript:" etc.
function imagemValida(v: string): boolean {
  return /^\/(images|uploads)\/[\w./-]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v);
}

export function registerSiteContent(app: Express, ownerAuth: RequestHandler) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Público: padrões + o que o proprietário trocou
  app.get('/api/content', (_req: Request, res: Response) => {
    res.json({ ...CONTENT_DEFAULTS, ...lerPersonalizados() });
  });

  // Painel: lista de campos com valor atual e padrão
  app.get('/api/admin/content', ownerAuth, (_req: Request, res: Response) => {
    const custom = lerPersonalizados();
    res.json(
      CONTENT_FIELDS.map((f) => ({ ...f, value: custom[f.key] ?? f.def, customized: f.key in custom }))
    );
  });

  // Painel: salva só o que mudou. Valor vazio = volta ao padrão.
  app.put('/api/admin/content', ownerAuth, (req: Request, res: Response) => {
    const valores = req.body?.values;
    if (!valores || typeof valores !== 'object' || Array.isArray(valores)) {
      res.status(400).json({ error: 'Envie os campos em "values".' });
      return;
    }
    const porChave = new Map(CONTENT_FIELDS.map((f) => [f.key, f]));
    const aplicar: Array<[string, string | null]> = [];
    for (const [k, bruto] of Object.entries(valores as Record<string, unknown>)) {
      const campo = porChave.get(k);
      if (!campo) { res.status(400).json({ error: `Campo desconhecido: ${k}` }); return; }
      if (typeof bruto !== 'string') { res.status(400).json({ error: `O campo "${campo.label}" precisa ser texto.` }); return; }
      const v = bruto.trim();
      if (v.length > 2000) { res.status(400).json({ error: `O campo "${campo.label}" passou de 2000 caracteres.` }); return; }
      if (campo.type === 'image' && v && !imagemValida(v)) {
        res.status(400).json({ error: `O campo "${campo.label}" precisa ser uma foto enviada pelo painel ou um link https.` });
        return;
      }
      aplicar.push([k, v === '' || v === campo.def ? null : v]);
    }
    const up = db.prepare("INSERT INTO site_content (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP");
    const del = db.prepare('DELETE FROM site_content WHERE key = ?');
    for (const [k, v] of aplicar) { if (v === null) del.run(k); else up.run(k, v); }

    const u = dono(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'SITE_CONTENT_UPDATED', entity: 'SITE_CONTENT', details: { campos: aplicar.map(([k]) => k) } });
    res.json({ success: true, message: 'Conteúdo da loja atualizado.' });
  });
}
