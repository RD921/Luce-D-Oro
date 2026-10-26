import { Response } from 'express';
import type { Express } from 'express';
import { criarPainel } from '../adminTeam.js';
import { type AuthenticatedRequest } from '../auth.js';
import { listarProdutosAdmin, criarProduto, atualizarProduto, arquivarProduto } from '../servicos/produtos.js';

// Rotas finas: as regras ficam em servicos/produtos.ts.
export function registerAdminProdutos(app: Express, painel: ReturnType<typeof criarPainel>) {
  app.get('/api/admin/products', painel('produtos'), (_req: AuthenticatedRequest, res: Response) => {
    res.json(listarProdutosAdmin());
  });

  app.post('/api/admin/products', painel('produtos'), (req: AuthenticatedRequest, res: Response) => {
    const r = criarProduto(req.user!, req.body ?? {});
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.status(201).json({ success: true, id: r.id, message: 'Produto cadastrado com sucesso.' });
  });

  app.put('/api/admin/products/:id', painel('produtos'), (req: AuthenticatedRequest, res: Response) => {
    const r = atualizarProduto(req.user!, String(req.params.id), req.body ?? {});
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.json({ success: true, message: 'Produto atualizado com sucesso.' });
  });

  app.delete('/api/admin/products/:id', painel('produtos'), (req: AuthenticatedRequest, res: Response) => {
    const r = arquivarProduto(req.user!, String(req.params.id));
    if (!r.ok) { res.status(r.status).json({ error: r.erro }); return; }
    res.json({ success: true, message: `Produto ${r.nome} arquivado com sucesso.` });
  });
}
