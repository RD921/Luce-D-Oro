import { Response } from 'express';
import type { Express } from 'express';
import { criarPainel } from '../adminTeam.js';
import { type AuthenticatedRequest } from '../auth.js';
import { obterEstoque, ajustarEstoque } from '../servicos/estoque.js';

// Rotas finas: as regras ficam em servicos/estoque.ts.
export function registerAdminEstoque(app: Express, painel: ReturnType<typeof criarPainel>) {
  app.get('/api/admin/stock', painel('estoque'), (_req: AuthenticatedRequest, res: Response) => {
    res.json(obterEstoque());
  });

  app.post('/api/admin/stock/adjust', painel('estoque'), (req: AuthenticatedRequest, res: Response) => {
    const r = ajustarEstoque(req.user!, req.body ?? {});
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.json({ success: true, message: r.mensagem, newStock: r.newStock });
  });
}
