// Fase 3 do painel: cupons completos (validade e limites), ficha do cliente e equipe com níveis de acesso.
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import { db, logAudit, AUTHORIZED_OWNER } from './db.js';
import { migrarCupons } from './servicos/cupons.js';

type Usuario = { id: number; name: string; email: string; role: string };
const quem = (req: Request): Usuario => (req as unknown as { user: Usuario }).user;

// ---------------------------------------------------------------------------
// Níveis de acesso da equipe
//   'rw' = pode ver e alterar   'r' = só ver
// O proprietário sempre pode tudo. Configurações, Auditoria e Equipe são SÓ do proprietário.
// ---------------------------------------------------------------------------
export type Area = 'dashboard' | 'produtos' | 'categorias' | 'estoque' | 'pedidos' | 'clientes' | 'banners' | 'conteudo' | 'cupons' | 'uploads' | 'entrega' | 'configuracoes' | 'pagamento' | 'auditoria' | 'arquitetura';

export const PAPEIS: Record<string, { label: string; descricao: string; areas: Partial<Record<Area, 'r' | 'rw'>> }> = {
  dev: {
    label: 'Desenvolvedor',
    descricao: 'Acesso técnico total: loja, Configurações, Arquitetura, Pagamento e Auditoria. Só não gerencia a Equipe.',
    areas: { dashboard: 'rw', produtos: 'rw', categorias: 'rw', estoque: 'rw', pedidos: 'rw', clientes: 'rw', banners: 'rw', conteudo: 'rw', cupons: 'rw', uploads: 'rw', entrega: 'rw', configuracoes: 'rw', pagamento: 'rw', auditoria: 'r', arquitetura: 'rw' },
  },
  gerente: {
    label: 'Gerente',
    descricao: 'Cuida da loja toda, menos Configurações, Pagamento, Auditoria e Equipe.',
    areas: { dashboard: 'rw', produtos: 'rw', categorias: 'rw', estoque: 'rw', pedidos: 'rw', clientes: 'r', banners: 'rw', conteudo: 'rw', cupons: 'rw', uploads: 'rw', entrega: 'rw' },
  },
  atendente: {
    label: 'Atendente',
    descricao: 'Atende pedidos e consulta clientes e produtos.',
    areas: { pedidos: 'rw', clientes: 'r', produtos: 'r', categorias: 'r' },
  },
  estoquista: {
    label: 'Estoquista',
    descricao: 'Controla o estoque e consulta produtos.',
    areas: { estoque: 'rw', produtos: 'r', categorias: 'r' },
  },
};

export function areasDoPapel(role: string): Partial<Record<Area, 'r' | 'rw'>> {
  return PAPEIS[role]?.areas ?? {};
}

const ehDono = (u: Usuario) => u.role === AUTHORIZED_OWNER.role && u.email.trim().toLowerCase() === AUTHORIZED_OWNER.email.toLowerCase();

// Cria o porteiro de uma área do painel: dono sempre passa; equipe passa conforme o nível.
export function criarPainel(authMiddleware: RequestHandler) {
  return (area: Area): RequestHandler =>
    (req: Request, res: Response, next: NextFunction) => {
      authMiddleware(req, res, () => {
        const u = (req as unknown as { user?: Usuario }).user;
        if (!u) { res.status(401).json({ error: 'Não autorizado. Autenticação obrigatória.' }); return; }
        if (ehDono(u)) { next(); return; }

        const nivel = areasDoPapel(u.role)[area];
        const leitura = req.method === 'GET' || req.method === 'HEAD';
        if (nivel && (nivel === 'rw' || leitura)) { next(); return; }

        logAudit({
          userId: u.id,
          userEmail: u.email,
          action: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
          entity: 'ADMIN_ROUTE',
          entityId: req.originalUrl,
          details: { method: req.method, area, role: u.role },
          ipAddress: req.ip || req.socket.remoteAddress,
        });
        res.status(403).json({ error: 'Acesso negado. Seu nível de acesso não permite esta ação.' });
      });
    };
}

export function registerAdminTeam(app: Express, painel: (a: Area) => RequestHandler, ownerOnly: RequestHandler) {
  migrarCupons();

  // ---------- Ficha do cliente ----------
  app.get('/api/admin/customers/:id', painel('clientes'), (req: Request, res: Response) => {
    const cliente = db.prepare('SELECT id, name, email, role, is_verified, created_at FROM users WHERE id = ?').get(Number(req.params.id)) as Record<string, unknown> | undefined;
    if (!cliente) { res.status(404).json({ error: 'Cliente não encontrado.' }); return; }
    const pedidos = db.prepare('SELECT id, total, status, payment_method, tracking_code, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(Number(req.params.id));
    const resumo = db.prepare("SELECT COUNT(*) AS pedidos, COALESCE(SUM(total),0) AS gasto FROM orders WHERE user_id = ? AND status != 'Cancelado'").get(Number(req.params.id));
    res.json({ cliente, resumo, pedidos });
  });

  // ---------- Equipe (somente o proprietário) ----------
  app.get('/api/admin/team', ownerOnly, (_req: Request, res: Response) => {
    const membros = db
      .prepare(`SELECT id, name, email, role, created_at FROM users WHERE role IN (${Object.keys(PAPEIS).map(() => '?').join(',')}) ORDER BY name`)
      .all(...Object.keys(PAPEIS));
    res.json({
      membros,
      papeis: Object.entries(PAPEIS).map(([id, p]) => ({ id, label: p.label, descricao: p.descricao, areas: p.areas })),
    });
  });

  app.post('/api/admin/team', ownerOnly, (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const papel = String(req.body?.role || '');
    if (!PAPEIS[papel]) { res.status(400).json({ error: 'Escolha um nível de acesso válido.' }); return; }
    if (email === AUTHORIZED_OWNER.email.toLowerCase()) { res.status(400).json({ error: 'A conta do proprietário não pode ser alterada aqui.' }); return; }
    const alvo = db.prepare('SELECT id, name, email, role FROM users WHERE lower(email) = ?').get(email) as Usuario | undefined;
    if (!alvo) { res.status(404).json({ error: 'Essa pessoa ainda não tem conta. Peça para ela se cadastrar na loja e tente de novo.' }); return; }
    if (alvo.role === 'owner') { res.status(400).json({ error: 'Esta conta é de proprietário e não pode ser alterada.' }); return; }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(papel, alvo.id);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'TEAM_MEMBER_SET', entity: 'USERS', entityId: String(alvo.id), details: { email: alvo.email, de: alvo.role, para: papel } });
    res.status(201).json({ success: true, message: `${alvo.name} agora é ${PAPEIS[papel].label}.` });
  });

  app.put('/api/admin/team/:id', ownerOnly, (req: Request, res: Response) => {
    const papel = String(req.body?.role || '');
    if (!PAPEIS[papel]) { res.status(400).json({ error: 'Escolha um nível de acesso válido.' }); return; }
    const alvo = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(Number(req.params.id)) as Usuario | undefined;
    if (!alvo || !PAPEIS[alvo.role]) { res.status(404).json({ error: 'Membro da equipe não encontrado.' }); return; }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(papel, alvo.id);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'TEAM_MEMBER_CHANGED', entity: 'USERS', entityId: String(alvo.id), details: { email: alvo.email, de: alvo.role, para: papel } });
    res.json({ success: true, message: `${alvo.name} agora é ${PAPEIS[papel].label}.` });
  });

  app.delete('/api/admin/team/:id', ownerOnly, (req: Request, res: Response) => {
    const alvo = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(Number(req.params.id)) as Usuario | undefined;
    if (!alvo || !PAPEIS[alvo.role]) { res.status(404).json({ error: 'Membro da equipe não encontrado.' }); return; }
    db.prepare("UPDATE users SET role = 'customer' WHERE id = ?").run(alvo.id);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'TEAM_MEMBER_REMOVED', entity: 'USERS', entityId: String(alvo.id), details: { email: alvo.email, era: alvo.role } });
    res.json({ success: true, message: `${alvo.name} voltou a ser cliente.` });
  });
}
