import { Response } from 'express';
import type { Express } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../auth.js';
import { siteVisitante } from '../sites.js';
import { obterSacola, adicionarItem, atualizarQuantidade, removerItem } from '../servicos/carrinho.js';

// Rotas finas: leem a requisição, chamam o serviço e devolvem a resposta. As regras ficam em servicos/carrinho.ts.
export function registerCarrinho(app: Express) {
  app.get('/api/cart', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    res.json(obterSacola(req.user!.id, siteVisitante(req)));
  });

  app.post('/api/cart/items', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const r = adicionarItem(req.user!.id, siteVisitante(req), req.body ?? {});
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.json({ success: true, message: 'Item adicionado à sacola com sucesso.' });
  });

  app.put('/api/cart/items/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const r = atualizarQuantidade(req.user!.id, String(req.params.id), req.body?.quantity);
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.json({ success: true });
  });

  app.delete('/api/cart/items/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const r = removerItem(req.user!.id, String(req.params.id));
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.json({ success: true, message: 'Item removido da sacola.' });
  });
}
