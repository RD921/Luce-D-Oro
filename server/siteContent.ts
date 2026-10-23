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
function imagemOuTextoOk(f: { type: string }, v: string): boolean {
  return typeof v === 'string' && v.length <= 2000 && (f.type !== 'image' || imagemValida(v)) && (f.type !== 'position' || /^-?\d{1,3}(\.\d{1,2})?,-?\d{1,4}(\.\d{1,2})?$/.test(v));
}

function imagemValida(v: string): boolean {
  return /^\/(images|uploads)\/[\w./-]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v);
}

export function registerSiteContent(app: Express, painel: (a: 'conteudo') => RequestHandler) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS content_drafts (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS content_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note TEXT NOT NULL DEFAULT '',
      snapshot TEXT NOT NULL,
      changed INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  type Aplicar = Array<[string, string | null]>;
  const porChave = new Map(CONTENT_FIELDS.map((f) => [f.key, f]));

  // Valida {chave: valor}; devolve o que gravar (null = voltar ao padrão) ou a mensagem de erro.
  function validar(valores: unknown): { aplicar: Aplicar } | { erro: string } {
    if (!valores || typeof valores !== 'object' || Array.isArray(valores)) return { erro: 'Envie os campos em "values".' };
    const aplicar: Aplicar = [];
    for (const [k, bruto] of Object.entries(valores as Record<string, unknown>)) {
      const campo = porChave.get(k);
      if (!campo) return { erro: `Campo desconhecido: ${k}` };
      if (typeof bruto !== 'string') return { erro: `O campo "${campo.label}" precisa ser texto.` };
      const v = bruto.trim();
      if (v.length > 2000) return { erro: `O campo "${campo.label}" passou de 2000 caracteres.` };
      if (campo.type === 'position' && v) {
        const m = /^(-?\d{1,3}(?:\.\d{1,2})?),(-?\d{1,4}(?:\.\d{1,2})?)$/.exec(v);
        if (!m || Math.abs(Number(m[1])) > 100 || Math.abs(Number(m[2])) > 2000) return { erro: `Posição inválida em "${campo.label}".` };
      }
      if (campo.type === 'image' && v && !imagemValida(v)) return { erro: `O campo "${campo.label}" precisa ser uma foto enviada pelo painel ou um link https.` };
      aplicar.push([k, v === '' || v === campo.def ? null : v]);
    }
    return { aplicar };
  }

  // Grava no site publicado e registra uma versão (histórico).
  function publicar(aplicar: Aplicar, u: Owner, nota: string): number {
    const up = db.prepare("INSERT INTO site_content (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP");
    const del = db.prepare('DELETE FROM site_content WHERE key = ?');
    const antes = lerPersonalizados();
    for (const [k, v] of aplicar) { if (v === null) del.run(k); else up.run(k, v); }
    const depois = lerPersonalizados();
    const mudou = CONTENT_FIELDS.filter((f) => (antes[f.key] ?? f.def) !== (depois[f.key] ?? f.def)).length;
    db.prepare('INSERT INTO content_versions (note, snapshot, changed, created_by) VALUES (?, ?, ?, ?)').run(nota.slice(0, 200), JSON.stringify(depois), mudou, u.email);
    return mudou;
  }

  // Público: padrões + o que o proprietário trocou
  app.get('/api/content', (_req: Request, res: Response) => {
    res.json({ ...CONTENT_DEFAULTS, ...lerPersonalizados() });
  });

  // Painel: lista de campos com valor atual e padrão
  app.get('/api/admin/content', painel('conteudo'), (_req: Request, res: Response) => {
    const custom = lerPersonalizados();
    res.json(
      CONTENT_FIELDS.map((f) => ({ ...f, value: custom[f.key] ?? f.def, customized: f.key in custom }))
    );
  });

  // Painel: salva só o que mudou, direto no site (aba Conteúdo e "Imagens do site"). Valor vazio = volta ao padrão.
  app.put('/api/admin/content', painel('conteudo'), (req: Request, res: Response) => {
    const r = validar(req.body?.values);
    if ('erro' in r) { res.status(400).json({ error: r.erro }); return; }
    const u = dono(req);
    publicar(r.aplicar, u, 'Alteração direta pelo painel');
    logAudit({ userId: u.id, userEmail: u.email, action: 'SITE_CONTENT_UPDATED', entity: 'SITE_CONTENT', details: { campos: r.aplicar.map(([k]) => k) } });
    res.json({ success: true, message: 'Conteúdo da loja atualizado.' });
  });

  // ---------- Rascunho, publicação e versões ----------
  const rascunhos = () => db.prepare('SELECT key, value FROM content_drafts').all() as Array<{ key: string; value: string }>;
  const valorEfetivo = (f: { key: string; def: string }, pub: Record<string, string>, dr: Map<string, string>) => {
    if (dr.has(f.key)) return dr.get(f.key) === '' ? f.def : (dr.get(f.key) as string);
    return pub[f.key] ?? f.def;
  };

  // Campos com o valor do rascunho (se houver) e o publicado
  app.get('/api/admin/content/draft', painel('conteudo'), (_req: Request, res: Response) => {
    const pub = lerPersonalizados();
    const dr = new Map(rascunhos().map((r) => [r.key, r.value]));
    res.json({
      campos: CONTENT_FIELDS.map((f) => {
        const efetivo = valorEfetivo(f, pub, dr);
        const publicado = pub[f.key] ?? f.def;
        return { ...f, value: efetivo, publicado, emRascunho: efetivo !== publicado, customized: efetivo !== f.def };
      }),
      alteracoes: CONTENT_FIELDS.filter((f) => valorEfetivo(f, pub, dr) !== (pub[f.key] ?? f.def)).length,
    });
  });

  // Prévia: o site como ficaria com o rascunho publicado (usada só dentro do editor)
  app.get('/api/admin/content/preview', painel('conteudo'), (_req: Request, res: Response) => {
    const pub = lerPersonalizados();
    const dr = new Map(rascunhos().map((r) => [r.key, r.value]));
    res.json(Object.fromEntries(CONTENT_FIELDS.map((f) => [f.key, valorEfetivo(f, pub, dr)])));
  });

  app.put('/api/admin/content/draft', painel('conteudo'), (req: Request, res: Response) => {
    const r = validar(req.body?.values);
    if ('erro' in r) { res.status(400).json({ error: r.erro }); return; }
    const u = dono(req);
    const pub = lerPersonalizados();
    const up = db.prepare("INSERT INTO content_drafts (key, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP");
    const del = db.prepare('DELETE FROM content_drafts WHERE key = ?');
    for (const [k, v] of r.aplicar) {
      const f = porChave.get(k)!;
      const novo = v ?? f.def;                 // valor efetivo desejado
      const publicado = pub[k] ?? f.def;
      if (novo === publicado) del.run(k);      // igual ao que está no ar: não é mudança
      else up.run(k, v === null ? '' : v, u.email);
    }
    logAudit({ userId: u.id, userEmail: u.email, action: 'CONTENT_DRAFT_SAVED', entity: 'SITE_CONTENT', details: { campos: r.aplicar.map(([k]) => k) } });
    res.json({ success: true, pendentes: rascunhos().length });
  });

  app.delete('/api/admin/content/draft', painel('conteudo'), (req: Request, res: Response) => {
    const u = dono(req);
    const n = (db.prepare('SELECT COUNT(*) AS n FROM content_drafts').get() as { n: number }).n;
    db.prepare('DELETE FROM content_drafts').run();
    logAudit({ userId: u.id, userEmail: u.email, action: 'CONTENT_DRAFT_DISCARDED', entity: 'SITE_CONTENT', details: { descartados: n } });
    res.json({ success: true, descartados: n });
  });

  app.post('/api/admin/content/publish', painel('conteudo'), (req: Request, res: Response) => {
    const u = dono(req);
    const pub = lerPersonalizados();
    const dr = rascunhos().filter((r) => {
      const f = porChave.get(r.key);
      return f && (r.value === '' ? f.def : r.value) !== (pub[r.key] ?? f.def);
    });
    if (!dr.length) { res.status(400).json({ error: 'Não há alterações em rascunho para publicar.' }); return; }
    const nota = typeof req.body?.note === 'string' && req.body.note.trim() ? req.body.note.trim() : 'Publicação do rascunho';
    const aplicar: Aplicar = dr.map((r) => [r.key, r.value === '' || r.value === porChave.get(r.key)!.def ? null : r.value]);
    const mudou = publicar(aplicar, u, nota);
    db.prepare('DELETE FROM content_drafts').run();
    logAudit({ userId: u.id, userEmail: u.email, action: 'CONTENT_PUBLISHED', entity: 'SITE_CONTENT', details: { campos: aplicar.map(([k]) => k), nota } });
    res.json({ success: true, publicados: mudou, message: 'Alterações publicadas no site.' });
  });

  app.get('/api/admin/content/versions', painel('conteudo'), (_req: Request, res: Response) => {
    const linhas = db.prepare('SELECT id, note, changed, created_by, created_at FROM content_versions ORDER BY id DESC LIMIT 50').all();
    res.json(linhas);
  });

  // Restaurar = carregar aquela versão no RASCUNHO (nada vai ao ar até publicar)
  app.post('/api/admin/content/versions/:id/restore', painel('conteudo'), (req: Request, res: Response) => {
    const u = dono(req);
    const v = db.prepare('SELECT id, snapshot, created_at FROM content_versions WHERE id = ?').get(Number(req.params.id)) as { id: number; snapshot: string; created_at: string } | undefined;
    if (!v) { res.status(404).json({ error: 'Versão não encontrada.' }); return; }
    let snap: Record<string, string> = {};
    try { snap = JSON.parse(v.snapshot); } catch { res.status(500).json({ error: 'Versão corrompida.' }); return; }
    const pub = lerPersonalizados();
    db.prepare('DELETE FROM content_drafts').run();
    const ins = db.prepare("INSERT INTO content_drafts (key, value, updated_by) VALUES (?, ?, ?)");
    let n = 0;
    for (const f of CONTENT_FIELDS) {
      const alvo = f.key in snap && imagemOuTextoOk(f, snap[f.key]) ? snap[f.key] : f.def;
      if (alvo !== (pub[f.key] ?? f.def)) { ins.run(f.key, alvo === f.def ? '' : alvo, u.email); n++; }
    }
    logAudit({ userId: u.id, userEmail: u.email, action: 'CONTENT_VERSION_LOADED', entity: 'SITE_CONTENT', details: { versao: v.id, diferencas: n } });
    res.json({ success: true, diferencas: n });
  });

  // Volta tudo ao original (como rascunho)
  app.post('/api/admin/content/reset-draft', painel('conteudo'), (req: Request, res: Response) => {
    const u = dono(req);
    const pub = lerPersonalizados();
    db.prepare('DELETE FROM content_drafts').run();
    const ins = db.prepare("INSERT INTO content_drafts (key, value, updated_by) VALUES (?, '', ?)");
    let n = 0;
    for (const k of Object.keys(pub)) { ins.run(k, u.email); n++; }
    logAudit({ userId: u.id, userEmail: u.email, action: 'CONTENT_RESET_DRAFTED', entity: 'SITE_CONTENT', details: { campos: n } });
    res.json({ success: true, diferencas: n });
  });
}
