// Fase 3 do painel: cupons completos (validade e limites), ficha do cliente e equipe com níveis de acesso.
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import { db, logAudit, AUTHORIZED_OWNER } from './db.js';

type Usuario = { id: number; name: string; email: string; role: string };
const quem = (req: Request): Usuario => (req as unknown as { user: Usuario }).user;

// ---------------------------------------------------------------------------
// Níveis de acesso da equipe
//   'rw' = pode ver e alterar   'r' = só ver
// O proprietário sempre pode tudo. Configurações, Auditoria e Equipe são SÓ do proprietário.
// ---------------------------------------------------------------------------
export type Area = 'dashboard' | 'produtos' | 'categorias' | 'estoque' | 'pedidos' | 'clientes' | 'banners' | 'conteudo' | 'cupons' | 'uploads';

export const PAPEIS: Record<string, { label: string; descricao: string; areas: Partial<Record<Area, 'r' | 'rw'>> }> = {
  gerente: {
    label: 'Gerente',
    descricao: 'Cuida da loja toda, menos Configurações, Auditoria e Equipe.',
    areas: { dashboard: 'rw', produtos: 'rw', categorias: 'rw', estoque: 'rw', pedidos: 'rw', clientes: 'r', banners: 'rw', conteudo: 'rw', cupons: 'rw', uploads: 'rw' },
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

// ---------------------------------------------------------------------------
// Cupons
// ---------------------------------------------------------------------------
interface CupomRow {
  id: string; code: string; discount_type: string; discount_value: number; min_spend: number;
  is_active: number; usage_count: number; expires_at?: string | null; usage_limit?: number | null; per_customer_limit?: number | null;
}

export function migrarCupons() {
  const cols = db.prepare('PRAGMA table_info(coupons)').all() as Array<{ name: string }>;
  const tem = (n: string) => cols.some((c) => c.name === n);
  if (!tem('expires_at')) db.exec('ALTER TABLE coupons ADD COLUMN expires_at TEXT');
  if (!tem('usage_limit')) db.exec('ALTER TABLE coupons ADD COLUMN usage_limit INTEGER');
  if (!tem('per_customer_limit')) db.exec('ALTER TABLE coupons ADD COLUMN per_customer_limit INTEGER');
  db.exec(`
    CREATE TABLE IF NOT EXISTS coupon_uses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_id TEXT NOT NULL,
      user_id INTEGER,
      order_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon ON coupon_uses (coupon_id, user_id);
  `);
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

// Regras de uso do cupom. Devolve a mensagem de erro, ou null se pode usar.
export function motivoCupomInvalido(c: CupomRow, userId: number | null, subtotal: number): string | null {
  if (!c.is_active) return 'Cupom inválido ou inativo.';
  if (c.expires_at && c.expires_at < hojeISO()) return 'Este cupom expirou.';
  if (c.usage_limit && c.usage_count >= c.usage_limit) return 'Este cupom atingiu o limite de usos.';
  if (c.per_customer_limit && userId) {
    const usos = (db.prepare('SELECT COUNT(*) AS n FROM coupon_uses WHERE coupon_id = ? AND user_id = ?').get(c.id, userId) as { n: number }).n;
    if (usos >= c.per_customer_limit) return 'Você já usou este cupom o número máximo de vezes.';
  }
  if (subtotal < c.min_spend) return `Este cupom exige valor mínimo de R$ ${c.min_spend.toFixed(2)} em compras.`;
  return null;
}

export function registrarUsoCupom(cupomId: string, userId: number | null, orderId: string) {
  db.prepare('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?').run(cupomId);
  db.prepare('INSERT INTO coupon_uses (coupon_id, user_id, order_id) VALUES (?, ?, ?)').run(cupomId, userId, orderId);
}

function lerCupom(body: Record<string, unknown>, parcial: boolean): { erro?: string; dados?: Record<string, any> } {
  const dados: Record<string, any> = {};
  const tem = (k: string) => body[k] !== undefined;

  if (!parcial || tem('discount_type')) {
    if (!['percent', 'fixed'].includes(String(body.discount_type))) return { erro: 'O tipo de desconto deve ser percentual ou valor fixo.' };
    dados.discount_type = String(body.discount_type);
  }
  if (!parcial || tem('discount_value')) {
    const v = Number(body.discount_value);
    if (!Number.isFinite(v) || v <= 0) return { erro: 'O valor do desconto deve ser maior que zero.' };
    dados.discount_value = v;
  }
  const tipoFinal = (dados.discount_type as string) ?? undefined;
  if (tipoFinal === 'percent' && (dados.discount_value as number) > 100) return { erro: 'Desconto percentual não pode passar de 100%.' };
  if (tem('min_spend')) {
    const m = Number(body.min_spend || 0);
    if (!Number.isFinite(m) || m < 0) return { erro: 'A compra mínima não pode ser negativa.' };
    dados.min_spend = m;
  }
  if (tem('expires_at')) {
    const e = String(body.expires_at || '').trim();
    if (e && !/^\d{4}-\d{2}-\d{2}$/.test(e)) return { erro: 'A validade deve estar no formato AAAA-MM-DD.' };
    if (e && Number.isNaN(Date.parse(e))) return { erro: 'Data de validade inválida.' };
    dados.expires_at = e || null;
  }
  for (const k of ['usage_limit', 'per_customer_limit'] as const) {
    if (tem(k)) {
      const raw = body[k];
      if (raw === null || raw === '' || Number(raw) === 0) dados[k] = null;
      else {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) return { erro: 'Os limites de uso devem ser números inteiros a partir de 1 (ou vazio para sem limite).' };
        dados[k] = n;
      }
    }
  }
  if (tem('is_active')) dados.is_active = body.is_active ? 1 : 0;
  return { dados };
}

export function registerAdminTeam(app: Express, painel: (a: Area) => RequestHandler, ownerOnly: RequestHandler) {
  migrarCupons();

  // ---------- Cupons ----------
  app.get('/api/admin/coupons', painel('cupons'), (_req: Request, res: Response) => {
    res.json(db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all());
  });

  app.post('/api/admin/coupons', painel('cupons'), (req: Request, res: Response) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) { res.status(400).json({ error: 'O código deve ter de 3 a 30 letras, números, "-" ou "_".' }); return; }
    const { erro, dados } = lerCupom(req.body || {}, false);
    if (erro || !dados) { res.status(400).json({ error: erro }); return; }
    if (db.prepare('SELECT id FROM coupons WHERE code = ?').get(code)) { res.status(409).json({ error: 'Já existe um cupom cadastrado com este código.' }); return; }

    const id = `cp_${code.toLowerCase()}_${Date.now().toString(36)}`;
    db.prepare(
      `INSERT INTO coupons (id, code, discount_type, discount_value, min_spend, is_active, usage_count, expires_at, usage_limit, per_customer_limit)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).run(id, code, dados.discount_type, dados.discount_value, dados.min_spend ?? 0, dados.is_active ?? 1, dados.expires_at ?? null, dados.usage_limit ?? null, dados.per_customer_limit ?? null);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'COUPON_CREATED', entity: 'COUPONS', entityId: id, details: { code, ...dados } });
    res.status(201).json({ success: true, id, message: 'Cupom criado com sucesso.' });
  });

  app.put('/api/admin/coupons/:id', painel('cupons'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const atual = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id) as CupomRow | undefined;
    if (!atual) { res.status(404).json({ error: 'Cupom não encontrado.' }); return; }
    const { erro, dados } = lerCupom(req.body || {}, true);
    if (erro || !dados) { res.status(400).json({ error: erro }); return; }
    // Confere o limite de 100% também quando só o valor ou só o tipo muda
    const tipo = (dados.discount_type as string) ?? atual.discount_type;
    const valor = (dados.discount_value as number) ?? atual.discount_value;
    if (tipo === 'percent' && valor > 100) { res.status(400).json({ error: 'Desconto percentual não pode passar de 100%.' }); return; }

    const campos = Object.keys(dados);
    if (campos.length === 0) { res.status(400).json({ error: 'Nada para atualizar.' }); return; }
    // nomes de coluna vêm da lista fixa acima, nunca do usuário
    db.prepare(`UPDATE coupons SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...(campos.map((c) => dados[c]) as Array<string | number | null>), id);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'COUPON_UPDATED', entity: 'COUPONS', entityId: id, details: dados });
    res.json({ success: true, message: 'Cupom atualizado.' });
  });

  app.delete('/api/admin/coupons/:id', painel('cupons'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const atual = db.prepare('SELECT code FROM coupons WHERE id = ?').get(id) as { code: string } | undefined;
    if (!atual) { res.status(404).json({ error: 'Cupom não encontrado.' }); return; }
    db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'COUPON_DELETED', entity: 'COUPONS', entityId: id, details: { code: atual.code } });
    res.json({ success: true, message: 'Cupom removido.' });
  });

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
