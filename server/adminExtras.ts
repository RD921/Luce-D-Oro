// Rotas administrativas extras (somente o proprietário): upload de imagens e categorias.
// Fica separado do index.ts para não misturar com o que já funciona.
import express, { type Express, type Request, type Response, type RequestHandler } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, logAudit } from './db.js';
import type { Area } from './adminTeam.js';

type Owner = { id: number; email: string };
const dono = (req: Request): Owner => (req as unknown as { user: Owner }).user;

// Em hospedagem com disco temporário, aponte UPLOAD_DIR para uma pasta de disco persistente.
export const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.resolve(process.cwd(), 'uploads');
const MAX_BYTES = 6 * 1024 * 1024;

// Descobre o tipo REAL do arquivo pelos primeiros bytes (não confia no nome nem no tipo enviado).
function detectarImagem(buf: Buffer): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.length > 6 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii'))) return 'gif';
  return null;
}

export function slugify(texto: string): string {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function migrarExtras() {
  const colunas = db.prepare('PRAGMA table_info(categories)').all() as Array<{ name: string }>;
  if (!colunas.some((c) => c.name === 'display_order')) {
    db.exec('ALTER TABLE categories ADD COLUMN display_order INTEGER DEFAULT 0');
    // Mantém a ordem atual (Pulseiras, Correntes, Brincos) nas categorias que já existem
    const padrao = ['pulseiras', 'correntes', 'brincos'];
    padrao.forEach((id, i) => db.prepare('UPDATE categories SET display_order = ? WHERE id = ?').run(i + 1, id));
  }
  if (!colunas.some((c) => c.name === 'is_active')) {
    db.exec('ALTER TABLE categories ADD COLUMN is_active INTEGER DEFAULT 1');
  }
}

export function registerAdminExtras(app: Express, painel: (a: Area) => RequestHandler) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  migrarExtras();

  // Arquivos enviados ficam públicos (são fotos da vitrine)
  app.use('/uploads', express.static(UPLOAD_DIR, { index: false, dotfiles: 'deny', setHeaders: (r) => r.setHeader('Cache-Control', 'public, max-age=0, must-revalidate') }));

  // ---------- Upload de imagem ----------
  // Corpo: { data: "<base64 ou data:image/...;base64,...>" }
  app.post('/api/admin/uploads', express.json({ limit: '10mb' }), painel('uploads'), (req: Request, res: Response) => {
    const bruto = String(req.body?.data || '');
    if (!bruto) { res.status(400).json({ error: 'Nenhuma imagem enviada.' }); return; }
    const base64 = bruto.includes(',') ? bruto.slice(bruto.indexOf(',') + 1) : bruto;
    let buf: Buffer;
    try { buf = Buffer.from(base64, 'base64'); } catch { res.status(400).json({ error: 'Imagem inválida.' }); return; }
    if (buf.length === 0) { res.status(400).json({ error: 'Imagem vazia.' }); return; }
    if (buf.length > MAX_BYTES) { res.status(413).json({ error: 'Imagem acima de 6 MB. Reduza o tamanho e tente de novo.' }); return; }
    const tipo = detectarImagem(buf);
    if (!tipo) { res.status(400).json({ error: 'Formato não aceito. Envie JPG, PNG, WEBP ou GIF.' }); return; }

    const nome = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${tipo}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, nome), buf);
    const u = dono(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'IMAGE_UPLOADED', entity: 'UPLOADS', entityId: nome, details: { bytes: buf.length } });
    res.status(201).json({ url: `/uploads/${nome}`, bytes: buf.length });
  });

  // ---------- Categorias ----------
  app.get('/api/admin/categories', painel('categorias'), (_req: Request, res: Response) => {
    const lista = db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_archived = 0) AS product_count
         FROM categories c ORDER BY c.display_order ASC, c.name ASC`
      )
      .all();
    res.json(lista);
  });

  app.post('/api/admin/categories', painel('categorias'), (req: Request, res: Response) => {
    const { name, description = '', image_url = '', display_order, is_active = 1 } = req.body || {};
    const nome = String(name || '').trim();
    if (!nome) { res.status(400).json({ error: 'O nome da categoria é obrigatório.' }); return; }
    let slug = slugify(req.body?.slug || nome);
    if (!slug) { res.status(400).json({ error: 'Nome inválido para gerar o endereço da categoria.' }); return; }
    if (['home', 'admin', 'api', 'uploads'].includes(slug)) slug = `${slug}-colecao`;
    if (db.prepare('SELECT id FROM categories WHERE id = ? OR slug = ?').get(slug, slug)) {
      res.status(409).json({ error: `Já existe uma categoria com o endereço "${slug}".` });
      return;
    }
    const ordem = Number.isFinite(Number(display_order))
      ? Number(display_order)
      : ((db.prepare('SELECT COALESCE(MAX(display_order),0) AS m FROM categories').get() as { m: number }).m + 1);
    db.prepare('INSERT INTO categories (id, name, slug, description, image_url, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(slug, nome, slug, String(description), String(image_url), ordem, is_active ? 1 : 0);
    const u = dono(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'CATEGORY_CREATED', entity: 'CATEGORIES', entityId: slug, details: { name: nome } });
    res.status(201).json({ success: true, id: slug, message: 'Categoria criada.' });
  });

  app.put('/api/admin/categories/:id', painel('categorias'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const atual = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!atual) { res.status(404).json({ error: 'Categoria não encontrada.' }); return; }
    const b = req.body || {};
    const nome = b.name !== undefined ? String(b.name).trim() : String(atual.name);
    if (!nome) { res.status(400).json({ error: 'O nome da categoria é obrigatório.' }); return; }
    // O endereço (slug) não muda: links, produtos e histórico dependem dele.
    db.prepare('UPDATE categories SET name = ?, description = ?, image_url = ?, display_order = ?, is_active = ? WHERE id = ?').run(
      nome,
      b.description !== undefined ? String(b.description) : String(atual.description ?? ''),
      b.image_url !== undefined ? String(b.image_url) : String(atual.image_url ?? ''),
      Number.isFinite(Number(b.display_order)) ? Number(b.display_order) : Number(atual.display_order ?? 0),
      b.is_active !== undefined ? (b.is_active ? 1 : 0) : Number(atual.is_active ?? 1),
      id
    );
    const u = dono(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'CATEGORY_UPDATED', entity: 'CATEGORIES', entityId: id, details: { name: nome } });
    res.json({ success: true, message: 'Categoria atualizada.' });
  });

  app.delete('/api/admin/categories/:id', painel('categorias'), (req: Request, res: Response) => {
    const id = String(req.params.id);
    const atual = db.prepare('SELECT id, name FROM categories WHERE id = ?').get(id) as { id: string; name: string } | undefined;
    if (!atual) { res.status(404).json({ error: 'Categoria não encontrada.' }); return; }
    // Produtos (inclusive arquivados) e pedidos antigos dependem da categoria: só apaga se estiver vazia,
    // ou se o painel pedir para mover os produtos para outra categoria (?moveTo=...).
    const usados = (db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?').get(id) as { n: number }).n;
    const destino = typeof req.query.moveTo === 'string' ? req.query.moveTo : '';
    if (usados > 0) {
      if (!destino) {
        res.status(409).json({ error: `Esta categoria tem ${usados} produto(s) (contando os arquivados). Mova-os para outra categoria ou desative a categoria em vez de excluir.`, products: usados });
        return;
      }
      if (destino === id || !db.prepare('SELECT id FROM categories WHERE id = ?').get(destino)) {
        res.status(400).json({ error: 'Categoria de destino inválida.' });
        return;
      }
      db.prepare('UPDATE products SET category_id = ? WHERE category_id = ?').run(destino, id);
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    const u = dono(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'CATEGORY_DELETED', entity: 'CATEGORIES', entityId: id, details: { name: atual.name, movidos: usados, destino: destino || null } });
    res.json({ success: true, message: 'Categoria excluída.' });
  });
}
