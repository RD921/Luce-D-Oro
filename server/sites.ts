// Fase 2 — vários sites. Cada site tem conteúdo, imagens, SEO, rascunhos e versões próprios.
// Catálogo, pedidos e clientes continuam compartilhados (loja principal).
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import { db, logAudit } from './db.js';
import type { Area } from './adminTeam.js';

export const SITE_PRINCIPAL = 'luce-d-oro';
const STATUS = ['ativo', 'em_construcao', 'arquivado'] as const;

export interface SiteRow { id: string; nome: string; cliente: string; dominio: string | null; tipo: string; status: string; created_at: string }

function colunas(tabela: string): string[] {
  try { return (db.prepare(`PRAGMA table_info(${tabela})`).all() as Array<{ name: string }>).map((c) => c.name); } catch { return []; }
}

// Cria as tabelas por site e converte as antigas (que eram de um site só) sem perder nada.
export function migrarSites() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      cliente TEXT NOT NULL DEFAULT '',
      dominio TEXT UNIQUE,
      tipo TEXT NOT NULL DEFAULT 'Loja',
      status TEXT NOT NULL DEFAULT 'ativo',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.prepare("INSERT OR IGNORE INTO sites (id, nome, cliente, tipo, status) VALUES (?, ?, ?, 'Loja principal', 'ativo')").run(SITE_PRINCIPAL, "Luce D'Oro", "Luce D'Oro");

  const converter = (tabela: string, criar: string, copiar: string) => {
    const cols = colunas(tabela);
    if (cols.length && cols.includes('site_id')) return;
    if (!cols.length) { db.exec(criar.replace('__T__', tabela)); return; }
    db.exec(`ALTER TABLE ${tabela} RENAME TO ${tabela}_antiga`);
    db.exec(criar.replace('__T__', tabela));
    db.exec(`INSERT INTO ${tabela} ${copiar.replace('__T__', `${tabela}_antiga`)}`);
    db.exec(`DROP TABLE ${tabela}_antiga`);
  };
  converter('site_content',
    `CREATE TABLE __T__ (site_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (site_id, key))`,
    `(site_id, key, value, updated_at) SELECT '${SITE_PRINCIPAL}', key, value, updated_at FROM __T__`);
  converter('content_drafts',
    `CREATE TABLE __T__ (site_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_by TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (site_id, key))`,
    `(site_id, key, value, updated_by, updated_at) SELECT '${SITE_PRINCIPAL}', key, value, updated_by, updated_at FROM __T__`);
  if (!colunas('content_versions').length) {
    db.exec(`CREATE TABLE content_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL DEFAULT '${SITE_PRINCIPAL}', note TEXT NOT NULL DEFAULT '', snapshot TEXT NOT NULL, changed INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  } else if (!colunas('content_versions').includes('site_id')) {
    db.exec(`ALTER TABLE content_versions ADD COLUMN site_id TEXT NOT NULL DEFAULT '${SITE_PRINCIPAL}'`);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      site_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (site_id, key)
    );
  `);
  // SEO que já existia (global) passa a ser do site principal
  db.prepare(`INSERT OR IGNORE INTO site_settings (site_id, key, value) SELECT '${SITE_PRINCIPAL}', key, value FROM system_settings WHERE key LIKE 'seo_%'`).run();
}

const existe = { get: (id: string) => db.prepare('SELECT id FROM sites WHERE id = ?').get(id) };

// Painel: o site em edição vem do cabeçalho X-Site-Id (padrão: o principal). Site inexistente = 400.
export function resolverSiteAdmin(req: Request, res: Response, next: NextFunction) {
  const h = String(req.headers['x-site-id'] || '').trim();
  if (h) {
    if (!existe.get(h)) { res.status(400).json({ error: 'Site inválido.' }); return; }
    (req as unknown as { siteId: string }).siteId = h;
  }
  next();
}
export const siteAdmin = (req: Request): string => (req as unknown as { siteId?: string }).siteId ?? SITE_PRINCIPAL;

// Visitante: o site é escolhido pelo endereço (domínio) que ele acessou. Sem correspondência = site principal.
export function siteVisitante(req: Request): string {
  const bruto = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
  if (!bruto) return SITE_PRINCIPAL;
  const r = db.prepare("SELECT id FROM sites WHERE dominio = ? AND status != 'arquivado'").get(bruto) as { id: string } | undefined;
  return r?.id ?? SITE_PRINCIPAL;
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'site';
const dominioOk = (d: string) => /^(localhost|([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})$/.test(d);

export function registerSites(app: Express, painel: (a: Area) => RequestHandler) {
  const quem = (req: Request) => (req as unknown as { user: { id: number; email: string } }).user;

  app.get('/api/admin/sites', painel('conteudo'), (_req: Request, res: Response) => {
    const sites = db.prepare('SELECT * FROM sites ORDER BY (id = ?) DESC, created_at ASC').all(SITE_PRINCIPAL) as unknown as SiteRow[];
    const cont = (sql: string, id: string) => (db.prepare(sql).get(id) as { n: number; u?: string }) ;
    res.json(sites.map((s) => ({
      ...s,
      principal: s.id === SITE_PRINCIPAL,
      midias: cont('SELECT COUNT(*) AS n FROM media_files WHERE site_id = ?', s.id).n,
      rascunhos: cont('SELECT COUNT(*) AS n FROM content_drafts WHERE site_id = ?', s.id).n,
      publicacoes: cont('SELECT COUNT(*) AS n FROM content_versions WHERE site_id = ?', s.id).n,
      ultimaPublicacao: (db.prepare('SELECT MAX(created_at) AS u FROM content_versions WHERE site_id = ?').get(s.id) as { u: string | null }).u,
    })));
  });

  function validar(b: Record<string, unknown>, atual?: SiteRow): { v: Partial<SiteRow> } | { erro: string } {
    const v: Partial<SiteRow> = {};
    if (b.nome !== undefined) {
      const n = String(b.nome).trim();
      if (n.length < 2 || n.length > 80) return { erro: 'O nome do site precisa ter de 2 a 80 caracteres.' };
      v.nome = n;
    }
    if (b.cliente !== undefined) { const c = String(b.cliente).trim(); if (c.length > 80) return { erro: 'O nome do cliente passou de 80 caracteres.' }; v.cliente = c; }
    if (b.tipo !== undefined) { const t = String(b.tipo).trim(); if (t.length > 40) return { erro: 'O tipo passou de 40 caracteres.' }; v.tipo = t || 'Loja'; }
    if (b.dominio !== undefined) {
      const d = String(b.dominio).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
      if (d && !dominioOk(d)) return { erro: 'Endereço inválido. Use algo como www.seusite.com.br (sem http://).' };
      if (d) {
        const outro = db.prepare('SELECT id FROM sites WHERE dominio = ? AND id != ?').get(d, atual?.id ?? '') as { id: string } | undefined;
        if (outro) return { erro: 'Esse endereço já pertence a outro site.' };
      }
      v.dominio = d || null;
    }
    if (b.status !== undefined) {
      if (!(STATUS as readonly string[]).includes(String(b.status))) return { erro: 'Situação inválida.' };
      if (atual?.id === SITE_PRINCIPAL && b.status === 'arquivado') return { erro: 'O site principal não pode ser arquivado.' };
      v.status = String(b.status);
    }
    return { v };
  }

  app.post('/api/admin/sites', painel('arquitetura'), (req: Request, res: Response) => {
    const b = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    if (!b.nome) { res.status(400).json({ error: 'Informe o nome do site.' }); return; }
    const r = validar(b);
    if ('erro' in r) { res.status(400).json({ error: r.erro }); return; }
    let id = slug(r.v.nome as string); let n = 2;
    while (existe.get(id)) id = `${slug(r.v.nome as string)}-${n++}`;
    db.prepare('INSERT INTO sites (id, nome, cliente, dominio, tipo, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, r.v.nome as string, r.v.cliente ?? '', r.v.dominio ?? null, r.v.tipo ?? 'Loja', r.v.status ?? 'em_construcao');
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'SITE_CREATED', entity: 'SITE', entityId: id, details: { nome: r.v.nome, dominio: r.v.dominio ?? null } });
    res.status(201).json(db.prepare('SELECT * FROM sites WHERE id = ?').get(id));
  });

  app.put('/api/admin/sites/:id', painel('arquitetura'), (req: Request, res: Response) => {
    const atual = db.prepare('SELECT * FROM sites WHERE id = ?').get(String(req.params.id)) as unknown as SiteRow | undefined;
    if (!atual) { res.status(404).json({ error: 'Site não encontrado.' }); return; }
    const r = validar((req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>, atual);
    if ('erro' in r) { res.status(400).json({ error: r.erro }); return; }
    const novo = { ...atual, ...r.v };
    db.prepare('UPDATE sites SET nome = ?, cliente = ?, dominio = ?, tipo = ?, status = ? WHERE id = ?').run(novo.nome, novo.cliente, novo.dominio, novo.tipo, novo.status, atual.id);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'SITE_UPDATED', entity: 'SITE', entityId: atual.id, details: r.v as Record<string, unknown> });
    res.json(db.prepare('SELECT * FROM sites WHERE id = ?').get(atual.id));
  });
}
