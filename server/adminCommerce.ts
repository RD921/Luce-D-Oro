// Fase 4: frete e prazos, formas de pagamento e variações com estoque próprio.
import type { Express, Request, Response, RequestHandler } from 'express';
import { db, logAudit } from './db.js';
import type { Area } from './adminTeam.js';

type Usuario = { id: number; email: string };
const quem = (req: Request): Usuario => (req as unknown as { user: Usuario }).user;

export interface Entrega { id: string; name: string; description: string; price: number; days_min: number; days_max: number; free_above: number | null; is_active: number; display_order: number }
export interface Pagamento { id: string; name: string; description: string; kind: string; discount_percent: number; max_installments: number; is_active: number; display_order: number }

export function migrarComercio() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipping_methods (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', price REAL NOT NULL DEFAULT 0,
      days_min INTEGER NOT NULL DEFAULT 3, days_max INTEGER NOT NULL DEFAULT 7, free_above REAL,
      is_active INTEGER NOT NULL DEFAULT 1, display_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', kind TEXT NOT NULL DEFAULT 'other',
      discount_percent REAL NOT NULL DEFAULT 0, max_installments INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1, display_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL, title TEXT NOT NULL, stock INTEGER NOT NULL DEFAULT 0,
      UNIQUE(product_id, title)
    );
  `);
  const cols = (db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!cols.includes('shipping_method')) db.exec('ALTER TABLE orders ADD COLUMN shipping_method TEXT');
  if (!cols.includes('shipping_cost')) db.exec('ALTER TABLE orders ADD COLUMN shipping_cost REAL DEFAULT 0');
  if (!cols.includes('coupon_discount')) db.exec('ALTER TABLE orders ADD COLUMN coupon_discount REAL DEFAULT 0');
  if (!cols.includes('payment_discount')) db.exec('ALTER TABLE orders ADD COLUMN payment_discount REAL DEFAULT 0');

  // Dados iniciais só na primeira vez (não recria o que o dono apagou)
  const marca = db.prepare("SELECT value FROM system_settings WHERE key = 'commerce_seeded'").get();
  if (!marca) {
    const limite = (db.prepare("SELECT value FROM system_settings WHERE key = 'free_shipping_threshold'").get() as { value: string } | undefined)?.value;
    const gratis = Number.isFinite(parseFloat(limite || '')) ? parseFloat(limite as string) : 500;
    db.prepare('INSERT OR IGNORE INTO shipping_methods (id, name, description, price, days_min, days_max, free_above, is_active, display_order) VALUES (?,?,?,?,?,?,?,?,?)')
      .run('express', 'Frete Seguro Express', 'Envio segurado para todo o Brasil', 24.9, 2, 5, gratis, 1, 1);
    db.prepare('INSERT OR IGNORE INTO payment_methods (id, name, description, kind, discount_percent, max_installments, is_active, display_order) VALUES (?,?,?,?,?,?,?,?)')
      .run('pix', 'Pix Instantâneo', '5% de desconto', 'pix', 5, 1, 1, 1);
    db.prepare('INSERT OR IGNORE INTO payment_methods (id, name, description, kind, discount_percent, max_installments, is_active, display_order) VALUES (?,?,?,?,?,?,?,?)')
      .run('cartao', 'Cartão de Crédito', 'Até 10x sem juros', 'card', 0, 10, 1, 2);
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('commerce_seeded', '1')").run();
  }
}

// ---------- Auxiliares usados pelo carrinho e pelos pedidos ----------
export const ESTOQUE_SQL = `CASE WHEN EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = ci.product_id)
  THEN COALESCE((SELECT pv.stock FROM product_variants pv WHERE pv.product_id = ci.product_id AND pv.title = ci.variant_title), 0)
  ELSE p.stock END`;

export const temVariantes = (productId: string) => Boolean(db.prepare('SELECT 1 FROM product_variants WHERE product_id = ? LIMIT 1').get(productId));

export function estoqueDaVariante(productId: string, titulo: string): number {
  const r = db.prepare('SELECT stock FROM product_variants WHERE product_id = ? AND title = ?').get(productId, titulo) as { stock: number } | undefined;
  return r?.stock ?? 0;
}

export function sincronizarTotal(productId: string) {
  const s = db.prepare('SELECT COALESCE(SUM(stock),0) AS n FROM product_variants WHERE product_id = ?').get(productId) as { n: number };
  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(s.n, productId);
  return s.n;
}

export function baixarEstoque(productId: string, titulo: string, qtd: number) {
  if (temVariantes(productId)) {
    db.prepare('UPDATE product_variants SET stock = MAX(0, stock - ?) WHERE product_id = ? AND title = ?').run(qtd, productId, titulo);
    sincronizarTotal(productId);
  } else {
    db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(qtd, productId);
  }
}

export function variantesDe(productId: string): Array<{ title: string; stock: number }> {
  return db.prepare('SELECT title, stock FROM product_variants WHERE product_id = ? ORDER BY id').all(productId) as Array<{ title: string; stock: number }>;
}

export function freteEfetivo(m: Entrega, subtotal: number): number {
  return m.free_above !== null && m.free_above !== undefined && subtotal >= m.free_above ? 0 : m.price;
}

export function prazoTexto(m: Pick<Entrega, 'days_min' | 'days_max'>): string {
  if (m.days_min === 0 && m.days_max === 0) return 'Retirada no mesmo dia';
  return m.days_min === m.days_max ? `${m.days_min} dias úteis` : `${m.days_min} a ${m.days_max} dias úteis`;
}

export function entregasAtivas(): Entrega[] {
  return db.prepare('SELECT * FROM shipping_methods WHERE is_active = 1 ORDER BY display_order, name').all() as unknown as Entrega[];
}

// Menor valor a partir do qual algum frete fica grátis (alimenta a barra da sacola)
export function limiteFreteGratis(): number | null {
  const v = entregasAtivas().map((m) => m.free_above).filter((x): x is number => x !== null && x !== undefined);
  return v.length ? Math.min(...v) : null;
}

function sincronizarLimite() {
  const l = limiteFreteGratis();
  if (l !== null) db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('free_shipping_threshold', ?)").run(l.toFixed(2));
}

// Escolhe o frete do pedido. Sem id: usa o primeiro ativo. Sem nenhum ativo: frete zero.
export function resolverEntrega(id: unknown, subtotal: number): { erro?: string; metodo?: Entrega; custo: number } {
  const ativos = entregasAtivas();
  if (ativos.length === 0) return { custo: 0 };
  const m = id ? ativos.find((x) => x.id === String(id)) : ativos[0];
  if (!m) return { erro: 'Forma de entrega indisponível. Escolha outra.', custo: 0 };
  return { metodo: m, custo: freteEfetivo(m, subtotal) };
}

// Aceita o id novo ou o texto antigo ("Pix à Vista (5% OFF)", "Cartão de Crédito em 10x").
export function resolverPagamento(body: Record<string, unknown>): { erro?: string; metodo?: Pagamento; parcelas: number; descricao: string } {
  const ativos = db.prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY display_order, name').all() as unknown as Pagamento[];
  const texto = String(body.paymentMethod || '').trim();
  let m: Pagamento | undefined;
  if (body.paymentMethodId) m = ativos.find((x) => x.id === String(body.paymentMethodId));
  else if (ativos.length === 0) return { parcelas: 1, descricao: texto };
  else m = ativos.find((x) => x.name.toLowerCase() === texto.toLowerCase()) ?? (/^pix/i.test(texto) ? ativos.find((x) => x.kind === 'pix') : /^cart/i.test(texto) ? ativos.find((x) => x.kind === 'card') : undefined);
  if (!m) return { erro: 'Forma de pagamento indisponível. Escolha outra.', parcelas: 1, descricao: texto };

  let parcelas = Number(body.installments);
  if (!Number.isInteger(parcelas)) parcelas = Number((texto.match(/(\d+)\s*x/i) || [])[1]) || 1;
  if (m.kind !== 'card') parcelas = 1;
  if (parcelas < 1 || parcelas > m.max_installments) return { erro: `Esta forma de pagamento aceita de 1 a ${m.max_installments} parcela(s).`, parcelas, descricao: '' };
  const descricao = m.kind === 'card' ? `${m.name} em ${parcelas}x sem juros` : m.discount_percent > 0 ? `${m.name} (${m.discount_percent}% OFF)` : m.name;
  return { metodo: m, parcelas, descricao };
}

// ---------- Rotas ----------
const num = (v: unknown, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
const int = (v: unknown, min: number, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export function registerAdminCommerce(app: Express, painel: (a: Area) => RequestHandler, ownerOnly: RequestHandler) {
  migrarComercio();

  // Opções para o checkout (públicas)
  app.get('/api/checkout/options', (req: Request, res: Response) => {
    const subtotal = Number(req.query.subtotal) || 0;
    const shipping = entregasAtivas().map((m) => ({
      id: m.id, name: m.name, description: m.description, prazo: prazoTexto(m),
      basePrice: m.price, price: freteEfetivo(m, subtotal), free: freteEfetivo(m, subtotal) === 0, freeAbove: m.free_above,
    }));
    const payments = (db.prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY display_order, name').all() as unknown as Pagamento[]).map((p) => ({
      id: p.id, name: p.name, description: p.description, kind: p.kind, discountPercent: p.discount_percent, maxInstallments: p.max_installments,
    }));
    res.json({ shipping, payments });
  });

  // ---------- Frete ----------
  app.get('/api/admin/shipping', painel('entrega'), (_req: Request, res: Response) => {
    res.json(db.prepare('SELECT * FROM shipping_methods ORDER BY display_order, name').all());
  });

  function lerEntrega(b: Record<string, unknown>, parcial: boolean): { erro?: string; dados?: Record<string, string | number | null> } {
    const d: Record<string, string | number | null> = {};
    const tem = (k: string) => b[k] !== undefined;
    if (!parcial || tem('name')) { const n = String(b.name || '').trim(); if (!n || n.length > 60) return { erro: 'Informe o nome do frete (até 60 letras).' }; d.name = n; }
    if (tem('description')) d.description = String(b.description || '').slice(0, 200);
    if (!parcial || tem('price')) { const p = num(b.price, 0, 5000); if (p === null) return { erro: 'O valor do frete deve estar entre R$ 0 e R$ 5.000.' }; d.price = p; }
    if (!parcial || tem('days_min')) { const x = int(b.days_min, 0, 90); if (x === null) return { erro: 'Prazo mínimo inválido (0 a 90 dias).' }; d.days_min = x; }
    if (!parcial || tem('days_max')) { const x = int(b.days_max, 0, 90); if (x === null) return { erro: 'Prazo máximo inválido (0 a 90 dias).' }; d.days_max = x; }
    if (tem('free_above')) {
      if (b.free_above === null || b.free_above === '') d.free_above = null;
      else { const f = num(b.free_above, 0, 1000000); if (f === null) return { erro: 'Valor do frete grátis inválido.' }; d.free_above = f; }
    }
    if (tem('is_active')) d.is_active = b.is_active ? 1 : 0;
    if (tem('display_order')) { const o = int(b.display_order, 0, 999); if (o === null) return { erro: 'Ordem inválida.' }; d.display_order = o; }
    return { dados: d };
  }

  app.post('/api/admin/shipping', painel('entrega'), (req: Request, res: Response) => {
    const { erro, dados } = lerEntrega(req.body || {}, false);
    if (erro || !dados) { res.status(400).json({ error: erro }); return; }
    if ((dados.days_max as number) < (dados.days_min as number)) { res.status(400).json({ error: 'O prazo máximo não pode ser menor que o mínimo.' }); return; }
    let id = slug(String(dados.name)) || 'frete';
    while (db.prepare('SELECT 1 FROM shipping_methods WHERE id = ?').get(id)) id = `${id.slice(0, 34)}-${Math.floor(Math.random() * 900 + 100)}`;
    const ordem = dados.display_order ?? ((db.prepare('SELECT COALESCE(MAX(display_order),0)+1 AS n FROM shipping_methods').get() as { n: number }).n);
    db.prepare('INSERT INTO shipping_methods (id, name, description, price, days_min, days_max, free_above, is_active, display_order) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, dados.name, dados.description ?? '', dados.price, dados.days_min, dados.days_max, dados.free_above ?? null, dados.is_active ?? 1, ordem);
    sincronizarLimite();
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'SHIPPING_CREATED', entity: 'SHIPPING', entityId: id, details: dados });
    res.status(201).json({ success: true, id, message: 'Forma de entrega criada.' });
  });

  app.put('/api/admin/shipping/:id', painel('entrega'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const atual = db.prepare('SELECT * FROM shipping_methods WHERE id = ?').get(id) as unknown as Entrega | undefined;
    if (!atual) { res.status(404).json({ error: 'Forma de entrega não encontrada.' }); return; }
    const { erro, dados } = lerEntrega(req.body || {}, true);
    if (erro || !dados) { res.status(400).json({ error: erro }); return; }
    const min = (dados.days_min as number) ?? atual.days_min, max = (dados.days_max as number) ?? atual.days_max;
    if (max < min) { res.status(400).json({ error: 'O prazo máximo não pode ser menor que o mínimo.' }); return; }
    const campos = Object.keys(dados);
    if (campos.length === 0) { res.status(400).json({ error: 'Nada para atualizar.' }); return; }
    // nomes de coluna vêm de lista fixa montada acima
    db.prepare(`UPDATE shipping_methods SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...(campos.map((c) => dados[c]) as Array<string | number | null>), id);
    sincronizarLimite();
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'SHIPPING_UPDATED', entity: 'SHIPPING', entityId: id, details: dados });
    res.json({ success: true, message: 'Forma de entrega atualizada.' });
  });

  app.delete('/api/admin/shipping/:id', painel('entrega'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const m = db.prepare('SELECT name FROM shipping_methods WHERE id = ?').get(id) as { name: string } | undefined;
    if (!m) { res.status(404).json({ error: 'Forma de entrega não encontrada.' }); return; }
    db.prepare('DELETE FROM shipping_methods WHERE id = ?').run(id);
    sincronizarLimite();
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'SHIPPING_DELETED', entity: 'SHIPPING', entityId: id, details: { name: m.name } });
    res.json({ success: true, message: 'Forma de entrega removida. Pedidos antigos continuam com o frete que pagaram.' });
  });

  // ---------- Pagamento (somente o proprietário) ----------
  app.get('/api/admin/payment-methods', ownerOnly, (_req: Request, res: Response) => {
    res.json(db.prepare('SELECT * FROM payment_methods ORDER BY display_order, name').all());
  });

  function lerPagamento(b: Record<string, unknown>, parcial: boolean): { erro?: string; dados?: Record<string, string | number> } {
    const d: Record<string, string | number> = {};
    const tem = (k: string) => b[k] !== undefined;
    if (!parcial || tem('name')) { const n = String(b.name || '').trim(); if (!n || n.length > 60) return { erro: 'Informe o nome da forma de pagamento (até 60 letras).' }; d.name = n; }
    if (tem('description')) d.description = String(b.description || '').slice(0, 200);
    if (!parcial || tem('kind')) { if (!['pix', 'card', 'boleto', 'other'].includes(String(b.kind))) return { erro: 'Tipo inválido.' }; d.kind = String(b.kind); }
    if (tem('discount_percent')) { const p = num(b.discount_percent, 0, 90); if (p === null) return { erro: 'O desconto deve ficar entre 0% e 90%.' }; d.discount_percent = p; }
    if (tem('max_installments')) { const p = int(b.max_installments, 1, 24); if (p === null) return { erro: 'Parcelas: de 1 a 24.' }; d.max_installments = p; }
    if (tem('is_active')) d.is_active = b.is_active ? 1 : 0;
    if (tem('display_order')) { const o = int(b.display_order, 0, 999); if (o === null) return { erro: 'Ordem inválida.' }; d.display_order = o; }
    return { dados: d };
  }

  app.post('/api/admin/payment-methods', ownerOnly, (req: Request, res: Response) => {
    const { erro, dados } = lerPagamento(req.body || {}, false);
    if (erro || !dados) { res.status(400).json({ error: erro }); return; }
    if (dados.kind !== 'card' && (dados.max_installments ?? 1) !== 1) dados.max_installments = 1;
    let id = slug(String(dados.name)) || 'pagamento';
    while (db.prepare('SELECT 1 FROM payment_methods WHERE id = ?').get(id)) id = `${id.slice(0, 34)}-${Math.floor(Math.random() * 900 + 100)}`;
    const ordem = dados.display_order ?? ((db.prepare('SELECT COALESCE(MAX(display_order),0)+1 AS n FROM payment_methods').get() as { n: number }).n);
    db.prepare('INSERT INTO payment_methods (id, name, description, kind, discount_percent, max_installments, is_active, display_order) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, dados.name, dados.description ?? '', dados.kind, dados.discount_percent ?? 0, dados.max_installments ?? 1, dados.is_active ?? 1, ordem);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'PAYMENT_METHOD_CREATED', entity: 'PAYMENT', entityId: id, details: dados });
    res.status(201).json({ success: true, id, message: 'Forma de pagamento criada.' });
  });

  app.put('/api/admin/payment-methods/:id', ownerOnly, (req: Request, res: Response) => {
    const id = String(req.params.id);
    const atual = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id) as unknown as Pagamento | undefined;
    if (!atual) { res.status(404).json({ error: 'Forma de pagamento não encontrada.' }); return; }
    const { erro, dados } = lerPagamento(req.body || {}, true);
    if (erro || !dados) { res.status(400).json({ error: erro }); return; }
    if ((dados.kind ?? atual.kind) !== 'card') dados.max_installments = 1;
    const campos = Object.keys(dados);
    if (campos.length === 0) { res.status(400).json({ error: 'Nada para atualizar.' }); return; }
    db.prepare(`UPDATE payment_methods SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...(campos.map((c) => dados[c]) as Array<string | number>), id);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'PAYMENT_METHOD_UPDATED', entity: 'PAYMENT', entityId: id, details: dados });
    res.json({ success: true, message: 'Forma de pagamento atualizada.' });
  });

  app.delete('/api/admin/payment-methods/:id', ownerOnly, (req: Request, res: Response) => {
    const id = String(req.params.id);
    const m = db.prepare('SELECT name FROM payment_methods WHERE id = ?').get(id) as { name: string } | undefined;
    if (!m) { res.status(404).json({ error: 'Forma de pagamento não encontrada.' }); return; }
    db.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'PAYMENT_METHOD_DELETED', entity: 'PAYMENT', entityId: id, details: { name: m.name } });
    res.json({ success: true, message: 'Forma de pagamento removida.' });
  });

  // ---------- Variações com estoque próprio ----------
  app.get('/api/admin/products/:id/variants', painel('produtos'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const p = db.prepare('SELECT id, stock, variants_json FROM products WHERE id = ?').get(id) as { id: string; stock: number; variants_json: string } | undefined;
    if (!p) { res.status(404).json({ error: 'Produto não encontrado.' }); return; }
    const linhas = variantesDe(id);
    let titulos: string[] = [];
    try { titulos = JSON.parse(p.variants_json || '[]'); } catch { /* */ }
    res.json({ usaVariantes: linhas.length > 0, variantes: linhas, titulosAntigos: titulos, estoqueTotal: p.stock });
  });

  app.put('/api/admin/products/:id/variants', painel('produtos'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const p = db.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(id) as { id: string; name: string; stock: number } | undefined;
    if (!p) { res.status(404).json({ error: 'Produto não encontrado.' }); return; }
    const lista = req.body?.variantes;
    if (!Array.isArray(lista) || lista.length > 30) { res.status(400).json({ error: 'Envie a lista de variações (no máximo 30).' }); return; }
    const limpa: Array<{ title: string; stock: number }> = [];
    for (const v of lista) {
      const title = String(v?.title ?? '').trim();
      const stock = int(v?.stock, 0, 100000);
      if (!title || title.length > 60) { res.status(400).json({ error: 'Cada variação precisa de um nome (até 60 letras).' }); return; }
      if (stock === null) { res.status(400).json({ error: `Estoque inválido na variação "${title}" (inteiro de 0 a 100000).` }); return; }
      if (limpa.some((x) => x.title.toLowerCase() === title.toLowerCase())) { res.status(400).json({ error: `A variação "${title}" está repetida.` }); return; }
      limpa.push({ title, stock });
    }
    const antes = p.stock;
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
      const ins = db.prepare('INSERT INTO product_variants (product_id, title, stock) VALUES (?, ?, ?)');
      limpa.forEach((v) => ins.run(id, v.title, v.stock));
      const titulos = limpa.map((v) => v.title);
      db.prepare('UPDATE products SET variants_json = ? WHERE id = ?').run(JSON.stringify(titulos), id);
      // itens da sacola que apontam para variações removidas saem
      if (limpa.length > 0) {
        db.prepare(`DELETE FROM cart_items WHERE product_id = ? AND variant_title NOT IN (${titulos.map(() => '?').join(',')})`).run(id, ...titulos);
      }
      const novo = limpa.length > 0 ? sincronizarTotal(id) : antes;
      if (novo !== antes) {
        db.prepare('INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)')
          .run(id, novo - antes, antes, novo, 'Estoque por variação atualizado', quem(req).id);
      }
      db.exec('COMMIT');
    } catch {
      db.exec('ROLLBACK');
      res.status(500).json({ error: 'Não foi possível salvar as variações.' });
      return;
    }
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'PRODUCT_VARIANTS_UPDATED', entity: 'PRODUCTS', entityId: id, details: { name: p.name, variantes: limpa } });
    res.json({ success: true, estoqueTotal: limpa.length > 0 ? limpa.reduce((a, v) => a + v.stock, 0) : antes, message: limpa.length ? 'Variações salvas.' : 'Variações removidas. O estoque voltou a ser único.' });
  });
}
