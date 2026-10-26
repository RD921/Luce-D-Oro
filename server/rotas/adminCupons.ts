import { Response } from 'express';
import type { Express } from 'express';
import { criarPainel } from '../adminTeam.js';
import { type AuthenticatedRequest } from '../auth.js';
import { listarCupons, criarCupom, atualizarCupom, removerCupom } from '../servicos/cupons.js';

// Rotas finas: as regras ficam em servicos/cupons.ts.
export function registerAdminCupons(app: Express, painel: ReturnType<typeof criarPainel>) {
  app.get('/api/admin/coupons', painel('cupons'), (_req: AuthenticatedRequest, res: Response) => {
    res.json(listarCupons());
  });

  app.post('/api/admin/coupons', painel('cupons'), (req: AuthenticatedRequest, res: Response) => {
    const r = criarCupom(req.user!, req.body ?? {});
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.status(201).json({ success: true, id: r.id, message: 'Cupom criado com sucesso.' });
  });

  app.put('/api/admin/coupons/:id', painel('cupons'), (req: AuthenticatedRequest, res: Response) => {
    const r = atualizarCupom(req.user!, String(req.params.id), req.body ?? {});
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.json({ success: true, message: 'Cupom atualizado.' });
  });

  app.delete('/api/admin/coupons/:id', painel('cupons'), (req: AuthenticatedRequest, res: Response) => {
    const r = removerCupom(req.user!, String(req.params.id));
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.json({ success: true, message: 'Cupom removido.' });
  });
}
