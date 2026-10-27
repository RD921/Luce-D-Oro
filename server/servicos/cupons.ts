import { db, logAudit } from '../db.js';

// Regras de cupom de desconto. Não conhece Express: recebe os dados e devolve o resultado.
export type Falha = { ok: false; status: number; erro: string };
const falha = (status: number, erro: string): Falha => ({ ok: false, status, erro });
export interface Quem { id: number; email: string }

export interface CupomRow {
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

// Valor do desconto sobre um subtotal. Nunca passa do próprio subtotal.
export function calcularDesconto(c: Pick<CupomRow, 'discount_type' | 'discount_value'>, subtotal: number): number {
  const base = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0;
  return c.discount_type === 'percent' ? Math.min(base, (base * c.discount_value) / 100) : Math.min(c.discount_value, base);
}

// Cupom informado pelo cliente no carrinho (rota pública). userId é null para visitante sem login.
export function validarCupomPublico(siteId: string, codigo: unknown, cartTotal: unknown, userId: number | null):
  | { ok: true; code: string; discountType: string; discountValue: number; discountAmount: number } | Falha {
  if (!codigo) return falha(400, 'Código de cupom obrigatório.');
  const c = db.prepare('SELECT * FROM coupons WHERE code = ? AND site_id = ?').get(String(codigo).trim().toUpperCase(), siteId) as CupomRow | undefined;
  if (!c) return falha(404, 'Cupom inválido ou inativo.');
  const total = Number(cartTotal);
  const subtotal = Number.isFinite(total) && total > 0 ? total : 0;
  const motivo = motivoCupomInvalido(c, userId, subtotal);
  if (motivo) return falha(400, motivo);
  return { ok: true, code: c.code, discountType: c.discount_type, discountValue: c.discount_value, discountAmount: calcularDesconto(c, subtotal) };
}

export function listarCupons(siteId: string) {
  return db.prepare('SELECT * FROM coupons WHERE site_id = ? ORDER BY created_at DESC').all(siteId);
}

export function criarCupom(siteId: string, quem: Quem, body: Record<string, any>): { ok: true; id: string } | Falha {
  const code = String(body?.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return falha(400, 'O código deve ter de 3 a 30 letras, números, "-" ou "_".');
  const { erro, dados } = lerCupom(body || {}, false);
  if (erro || !dados) return falha(400, erro || 'Dados do cupom inválidos.');
  if (db.prepare('SELECT id FROM coupons WHERE code = ? AND site_id = ?').get(code, siteId)) return falha(409, 'Já existe um cupom cadastrado com este código.');
  const id = `cp_${siteId === 'luce-d-oro' ? '' : siteId + '_'}${code.toLowerCase()}_${Date.now().toString(36)}`;
  db.prepare(
    `INSERT INTO coupons (id, code, discount_type, discount_value, min_spend, is_active, usage_count, expires_at, usage_limit, per_customer_limit, site_id)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
  ).run(id, code, dados.discount_type, dados.discount_value, dados.min_spend ?? 0, dados.is_active ?? 1, dados.expires_at ?? null, dados.usage_limit ?? null, dados.per_customer_limit ?? null, siteId);
  logAudit({ userId: quem.id, userEmail: quem.email, action: 'COUPON_CREATED', entity: 'COUPONS', entityId: id, details: { code, ...dados } });
  return { ok: true, id };
}

export function atualizarCupom(siteId: string, quem: Quem, id: string, body: Record<string, any>): { ok: true } | Falha {
  const atual = db.prepare('SELECT * FROM coupons WHERE id = ? AND site_id = ?').get(id, siteId) as CupomRow | undefined;
  if (!atual) return falha(404, 'Cupom não encontrado.');
  const { erro, dados } = lerCupom(body || {}, true);
  if (erro || !dados) return falha(400, erro || 'Dados do cupom inválidos.');
  // Confere o limite de 100% também quando só o valor ou só o tipo muda
  const tipo = (dados.discount_type as string) ?? atual.discount_type;
  const valor = (dados.discount_value as number) ?? atual.discount_value;
  if (tipo === 'percent' && valor > 100) return falha(400, 'Desconto percentual não pode passar de 100%.');
  const campos = Object.keys(dados);
  if (campos.length === 0) return falha(400, 'Nada para atualizar.');
  // nomes de coluna vêm da lista fixa de lerCupom, nunca do usuário
  db.prepare(`UPDATE coupons SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND site_id = ?`).run(...(campos.map((c) => dados[c]) as Array<string | number | null>), id, siteId);
  logAudit({ userId: quem.id, userEmail: quem.email, action: 'COUPON_UPDATED', entity: 'COUPONS', entityId: id, details: dados });
  return { ok: true };
}

export function removerCupom(siteId: string, quem: Quem, id: string): { ok: true } | Falha {
  const atual = db.prepare('SELECT code FROM coupons WHERE id = ? AND site_id = ?').get(id, siteId) as { code: string } | undefined;
  if (!atual) return falha(404, 'Cupom não encontrado.');
  db.prepare('DELETE FROM coupons WHERE id = ? AND site_id = ?').run(id, siteId);
  logAudit({ userId: quem.id, userEmail: quem.email, action: 'COUPON_DELETED', entity: 'COUPONS', entityId: id, details: { code: atual.code } });
  return { ok: true };
}
