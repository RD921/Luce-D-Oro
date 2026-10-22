// Fase 3 — Biblioteca de mídia: arquivos com metadados, busca, substituição e exclusão segura.
// Os arquivos ficam em UPLOAD_DIR (configurável por variável de ambiente, para apontar a um disco persistente).
import type { Express, Request, Response, RequestHandler } from 'express';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, logAudit } from './db.js';
import type { Area } from './adminTeam.js';
import { UPLOAD_DIR } from './adminExtras.js';

const SITE_ID = 'luce-d-oro';
const MAX_BYTES = 8 * 1024 * 1024;
export const CATEGORIAS_MIDIA = [
  { id: 'banners', nome: 'Banners' },
  { id: 'home', nome: 'Página inicial' },
  { id: 'institucional', nome: 'Institucional' },
  { id: 'galerias', nome: 'Galerias' },
  { id: 'logotipos', nome: 'Logotipos' },
  { id: 'fundos', nome: 'Fundos e elementos visuais' },
  { id: 'campanhas', nome: 'Campanhas' },
  { id: 'geral', nome: 'Arquivos gerais' },
] as const;
const CATEGORIAS_IDS: string[] = CATEGORIAS_MIDIA.map((c) => c.id);

type Tipo = 'jpg' | 'png' | 'webp' | 'gif';
const MIME: Record<Tipo, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

interface Usuario { id: number; email: string }
const quem = (req: Request): Usuario => (req as unknown as { user: Usuario }).user;

export interface MidiaRow {
  id: string; site_id: string; file_name: string; original_name: string; mime: string; bytes: number;
  width: number | null; height: number | null; alt_text: string; category: string; uploaded_by: string | null;
  created_at: string; updated_at: string;
}

// ---------- Leitura do conteúdo real do arquivo ----------
export function detectarTipo(buf: Buffer): Tipo | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 20 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.length > 10 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii'))) return 'gif';
  return null;
}

export function dimensoes(buf: Buffer, tipo: Tipo): { width: number; height: number } | null {
  try {
    if (tipo === 'png') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (tipo === 'gif') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    if (tipo === 'jpg') {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marcador = buf[i + 1];
        if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return null;
    }
    // webp
    const trecho = buf.subarray(12, 16).toString('ascii');
    if (trecho === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (trecho === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (trecho === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  } catch { /* arquivo truncado */ }
  return null;
}

function lerBase64(bruto: string): Buffer | null {
  if (!bruto) return null;
  const base64 = bruto.includes(',') ? bruto.slice(bruto.indexOf(',') + 1) : bruto;
  try { const b = Buffer.from(base64, 'base64'); return b.length ? b : null; } catch { return null; }
}

// ---------- Banco ----------
export function migrarMidia() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL DEFAULT 'luce-d-oro',
      file_name TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      alt_text TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'geral',
      uploaded_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_media_site ON media_files(site_id, created_at);
  `);
}

// Registra no banco os arquivos que já estão na pasta (enviados antes da biblioteca existir ou por outro caminho).
export function sincronizarPasta(): number {
  let novos = 0;
  let nomes: string[] = [];
  try { nomes = fs.readdirSync(UPLOAD_DIR); } catch { return 0; }
  const existe = db.prepare('SELECT 1 FROM media_files WHERE file_name = ?');
  const ins = db.prepare(`INSERT INTO media_files (id, site_id, file_name, original_name, mime, bytes, width, height, category, uploaded_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'geral', NULL, ?, ?)`);
  for (const nome of nomes) {
    if (nome.startsWith('.') || existe.get(nome)) continue;
    const caminho = path.join(UPLOAD_DIR, nome);
    try {
      const st = fs.statSync(caminho);
      if (!st.isFile()) continue;
      const buf = fs.readFileSync(caminho);
      const tipo = detectarTipo(buf);
      if (!tipo) continue;
      const dim = dimensoes(buf, tipo);
      const quando = st.mtime.toISOString().replace('T', ' ').slice(0, 19);
      ins.run(crypto.randomUUID(), SITE_ID, nome, nome, MIME[tipo], buf.length, dim?.width ?? null, dim?.height ?? null, quando, quando);
      novos++;
    } catch { /* ignora arquivo ilegível */ }
  }
  return novos;
}

// ---------- Onde cada arquivo é usado ----------
function colecoesDeTexto(): Array<{ onde: string; texto: string }> {
  const itens: Array<{ onde: string; texto: string }> = [];
  const add = (onde: string, ...partes: Array<unknown>) => itens.push({ onde, texto: partes.map((p) => String(p ?? '')).join(' ') });
  const seguro = <T>(sql: string): T[] => { try { return db.prepare(sql).all() as T[]; } catch { return []; } };
  for (const b of seguro<Record<string, unknown>>('SELECT * FROM banners')) add(`Banner "${b.title ?? b.id}"`, b.image_desktop, b.image_mobile);
  for (const c of seguro<Record<string, unknown>>('SELECT id, name, image_url FROM categories')) add(`Categoria ${c.name}`, c.image_url);
  for (const p of seguro<Record<string, unknown>>('SELECT id, name, image_primary, images_json FROM products')) add(`Produto ${p.name}`, p.image_primary, p.images_json);
  for (const c of seguro<Record<string, unknown>>('SELECT key, value FROM site_content')) add(`Conteúdo do site (${c.key})`, c.value);
  for (const s of seguro<Record<string, unknown>>('SELECT key, value FROM system_settings')) add(`Configuração ${s.key}`, s.value);
  return itens;
}

function usosDe(nomes: string[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  const corpus = colecoesDeTexto();
  for (const nome of nomes) {
    const alvo = `/uploads/${nome}`;
    mapa.set(nome, corpus.filter((c) => c.texto.includes(alvo)).map((c) => c.onde));
  }
  return mapa;
}

const urlDe = (r: MidiaRow) => `/uploads/${r.file_name}?v=${encodeURIComponent(r.updated_at)}`;
const publico = (r: MidiaRow, usos?: string[]) => ({
  id: r.id, url: urlDe(r), urlBase: `/uploads/${r.file_name}`, nome: r.original_name, arquivo: r.file_name, mime: r.mime, bytes: r.bytes,
  largura: r.width, altura: r.height, alt: r.alt_text, categoria: r.category, enviadoPor: r.uploaded_by, criadoEm: r.created_at, atualizadoEm: r.updated_at,
  usos: usos ? usos.length : undefined, locais: usos,
});

export function registerAdminMedia(app: Express, painel: (a: Area) => RequestHandler) {
  migrarMidia();
  sincronizarPasta();
  const json = express.json({ limit: '12mb' });
  const porta = painel('uploads');

  app.get('/api/admin/media/categories', porta, (_req: Request, res: Response) => { res.json(CATEGORIAS_MIDIA); });

  app.get('/api/admin/media', porta, (req: Request, res: Response) => {
    sincronizarPasta();
    const q = String(req.query.q || '').trim().toLowerCase();
    const cat = String(req.query.category || '');
    const tipo = String(req.query.type || '');
    const de = String(req.query.from || '');
    const ate = String(req.query.to || '');
    const ordem = String(req.query.sort || 'date');
    const pagina = Math.max(1, Number(req.query.page) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(req.query.pageSize) || 24));

    let linhas = db.prepare('SELECT * FROM media_files WHERE site_id = ?').all(SITE_ID) as unknown as MidiaRow[];
    if (q) linhas = linhas.filter((r) => `${r.original_name} ${r.alt_text}`.toLowerCase().includes(q));
    if (cat && CATEGORIAS_IDS.includes(cat)) linhas = linhas.filter((r) => r.category === cat);
    if (tipo) linhas = linhas.filter((r) => r.mime === MIME[tipo as Tipo] || (tipo === 'jpeg' && r.mime === 'image/jpeg'));
    if (de) linhas = linhas.filter((r) => r.created_at.slice(0, 10) >= de);
    if (ate) linhas = linhas.filter((r) => r.created_at.slice(0, 10) <= ate);

    const usos = usosDe(linhas.map((r) => r.file_name));
    if (ordem === 'name') linhas.sort((a, b) => a.original_name.localeCompare(b.original_name, 'pt-BR'));
    else if (ordem === 'size') linhas.sort((a, b) => b.bytes - a.bytes);
    else if (ordem === 'usage') linhas.sort((a, b) => (usos.get(b.file_name)?.length ?? 0) - (usos.get(a.file_name)?.length ?? 0));
    else linhas.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const total = linhas.length;
    const itens = linhas.slice((pagina - 1) * porPagina, pagina * porPagina).map((r) => publico(r, usos.get(r.file_name)));
    res.json({ itens, total, pagina, porPagina });
  });

  app.get('/api/admin/media/:id', porta, (req: Request, res: Response) => {
    const r = db.prepare('SELECT * FROM media_files WHERE id = ? AND site_id = ?').get(String(req.params.id), SITE_ID) as unknown as MidiaRow | undefined;
    if (!r) { res.status(404).json({ error: 'Arquivo não encontrado.' }); return; }
    res.json(publico(r, usosDe([r.file_name]).get(r.file_name) || []));
  });

  // Envio de uma imagem por requisição. Corpo: { data, name?, alt?, category? }
  app.post('/api/admin/media', json, porta, (req: Request, res: Response) => {
    const u = quem(req);
    const rejeitar = (status: number, motivo: string) => {
      logAudit({ userId: u.id, userEmail: u.email, action: 'MEDIA_UPLOAD_REJECTED', entity: 'MEDIA', details: { motivo } });
      res.status(status).json({ error: motivo });
    };
    const buf = lerBase64(String(req.body?.data || ''));
    if (!buf) { rejeitar(400, 'Nenhuma imagem válida foi enviada.'); return; }
    if (buf.length > MAX_BYTES) { rejeitar(413, 'Imagem acima de 8 MB. Reduza o tamanho e tente de novo.'); return; }
    const tipo = detectarTipo(buf);
    if (!tipo) { rejeitar(400, 'Formato não aceito. Envie JPG, PNG, WEBP ou GIF.'); return; }
    const dim = dimensoes(buf, tipo);
    if (!dim || dim.width < 1 || dim.height < 1 || dim.width > 12000 || dim.height > 12000) { rejeitar(400, 'Dimensões da imagem inválidas (máximo 12000 px por lado).'); return; }
    const categoria = CATEGORIAS_IDS.includes(String(req.body?.category)) ? String(req.body.category) : 'geral';
    const nomeOriginal = String(req.body?.name || '').replace(/[\\/\0]/g, '').trim().slice(0, 120) || `imagem.${tipo}`;
    const alt = String(req.body?.alt || '').trim().slice(0, 300);

    const arquivo = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${tipo}`;
    try {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, arquivo), buf);
    } catch (e) {
      logAudit({ userId: u.id, userEmail: u.email, action: 'MEDIA_STORAGE_ERROR', entity: 'MEDIA', details: { erro: (e as Error).message } });
      res.status(500).json({ error: 'Não foi possível gravar o arquivo no armazenamento.' });
      return;
    }
    const id = crypto.randomUUID();
    try {
      db.prepare(`INSERT INTO media_files (id, site_id, file_name, original_name, mime, bytes, width, height, alt_text, category, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, SITE_ID, arquivo, nomeOriginal, MIME[tipo], buf.length, dim.width, dim.height, alt, categoria, u.email);
    } catch (e) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, arquivo)); } catch { /* */ }
      res.status(500).json({ error: 'Falha ao registrar o arquivo.' });
      void e;
      return;
    }
    logAudit({ userId: u.id, userEmail: u.email, action: 'MEDIA_UPLOADED', entity: 'MEDIA', entityId: id, details: { arquivo, bytes: buf.length, categoria } });
    const r = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as unknown as MidiaRow;
    res.status(201).json(publico(r, []));
  });

  app.put('/api/admin/media/:id', json, porta, (req: Request, res: Response) => {
    const u = quem(req);
    const r = db.prepare('SELECT * FROM media_files WHERE id = ? AND site_id = ?').get(String(req.params.id), SITE_ID) as unknown as MidiaRow | undefined;
    if (!r) { res.status(404).json({ error: 'Arquivo não encontrado.' }); return; }
    const nome = req.body?.nome !== undefined ? String(req.body.nome).replace(/[\\/\0]/g, '').trim().slice(0, 120) : r.original_name;
    if (!nome) { res.status(400).json({ error: 'O nome não pode ficar vazio.' }); return; }
    const alt = req.body?.alt !== undefined ? String(req.body.alt).trim().slice(0, 300) : r.alt_text;
    let categoria = r.category;
    if (req.body?.categoria !== undefined) {
      if (!CATEGORIAS_IDS.includes(String(req.body.categoria))) { res.status(400).json({ error: 'Categoria inválida.' }); return; }
      categoria = String(req.body.categoria);
    }
    db.prepare("UPDATE media_files SET original_name = ?, alt_text = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(nome, alt, categoria, r.id);
    logAudit({ userId: u.id, userEmail: u.email, action: 'MEDIA_UPDATED', entity: 'MEDIA', entityId: r.id, details: { categoria } });
    const nova = db.prepare('SELECT * FROM media_files WHERE id = ?').get(r.id) as unknown as MidiaRow;
    res.json(publico(nova, usosDe([nova.file_name]).get(nova.file_name) || []));
  });

  // Substitui o conteúdo mantendo o mesmo endereço (quem usa a imagem passa a mostrar a nova). Exige o mesmo formato.
  app.post('/api/admin/media/:id/replace', json, porta, (req: Request, res: Response) => {
    const u = quem(req);
    const r = db.prepare('SELECT * FROM media_files WHERE id = ? AND site_id = ?').get(String(req.params.id), SITE_ID) as unknown as MidiaRow | undefined;
    if (!r) { res.status(404).json({ error: 'Arquivo não encontrado.' }); return; }
    const buf = lerBase64(String(req.body?.data || ''));
    if (!buf) { res.status(400).json({ error: 'Nenhuma imagem válida foi enviada.' }); return; }
    if (buf.length > MAX_BYTES) { res.status(413).json({ error: 'Imagem acima de 8 MB.' }); return; }
    const tipo = detectarTipo(buf);
    if (!tipo) { res.status(400).json({ error: 'Formato não aceito. Envie JPG, PNG, WEBP ou GIF.' }); return; }
    if (MIME[tipo] !== r.mime) { res.status(400).json({ error: `Para manter o mesmo endereço, envie uma imagem do mesmo formato (${r.mime.replace('image/', '').toUpperCase()}).` }); return; }
    const dim = dimensoes(buf, tipo);
    if (!dim || dim.width > 12000 || dim.height > 12000) { res.status(400).json({ error: 'Dimensões da imagem inválidas.' }); return; }
    const destino = path.join(UPLOAD_DIR, r.file_name);
    const temp = `${destino}.tmp`;
    try { fs.writeFileSync(temp, buf); fs.renameSync(temp, destino); } catch {
      try { fs.unlinkSync(temp); } catch { /* */ }
      res.status(500).json({ error: 'Não foi possível gravar o arquivo no armazenamento.' });
      return;
    }
    db.prepare("UPDATE media_files SET bytes = ?, width = ?, height = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(buf.length, dim.width, dim.height, r.id);
    logAudit({ userId: u.id, userEmail: u.email, action: 'MEDIA_REPLACED', entity: 'MEDIA', entityId: r.id, details: { bytes: buf.length } });
    const nova = db.prepare('SELECT * FROM media_files WHERE id = ?').get(r.id) as unknown as MidiaRow;
    res.json(publico(nova, usosDe([nova.file_name]).get(nova.file_name) || []));
  });

  // Exclusão segura: bloqueia se a imagem estiver em uso.
  app.delete('/api/admin/media/:id', porta, (req: Request, res: Response) => {
    const u = quem(req);
    const r = db.prepare('SELECT * FROM media_files WHERE id = ? AND site_id = ?').get(String(req.params.id), SITE_ID) as unknown as MidiaRow | undefined;
    if (!r) { res.status(404).json({ error: 'Arquivo não encontrado.' }); return; }
    const usos = usosDe([r.file_name]).get(r.file_name) || [];
    if (usos.length) {
      res.status(409).json({ error: 'Esta imagem está em uso e não pode ser excluída. Substitua-a ou troque a imagem nos locais abaixo.', locais: usos });
      return;
    }
    db.prepare('DELETE FROM media_files WHERE id = ?').run(r.id);
    try { fs.unlinkSync(path.join(UPLOAD_DIR, r.file_name)); } catch { /* já não existia */ }
    logAudit({ userId: u.id, userEmail: u.email, action: 'MEDIA_DELETED', entity: 'MEDIA', entityId: r.id, details: { arquivo: r.file_name } });
    res.json({ success: true });
  });
}
