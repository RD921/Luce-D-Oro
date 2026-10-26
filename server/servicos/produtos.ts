import { db, logAudit, emTransacao } from '../db.js';
import { temVariantes, variantesDe } from '../adminCommerce.js';

// Regras do cadastro de produtos. Não conhece Express: recebe os dados e devolve o resultado.
export type Falha = { ok: false; status: number; erro: string };
const falha = (status: number, erro: string): Falha => ({ ok: false, status, erro });
export interface Quem { id: number; email: string }

const MAX_FOTOS = 20;
const MAX_VARIACOES = 30;

// Converte para número só quando é um valor numérico de verdade (aceita "12.5"); texto solto vira NaN.
const numero = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN);
const dinheiro = (v: unknown) => { const n = numero(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const inteiro = (v: unknown) => { const n = numero(v); return Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : null; };
const listaTextos = (v: unknown, max: number): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every((x) => typeof x === 'string' && x.trim() !== '' && x.length <= 300) ? v.map((x: string) => x.trim()) : null;

export function listarProdutosAdmin() {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all() as any[];
  return rows.map((r) => ({ ...r, images: JSON.parse(r.images_json || '[]'), variants: JSON.parse(r.variants_json || '[]'), variant_stock: variantesDe(r.id) }));
}

const textoCurto = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : null);

export function criarProduto(quem: Quem, d: Record<string, any>): { ok: true; id: string } | Falha {
  if (!d.name || !d.category_id || d.price === undefined || !d.image_primary) return falha(400, 'Nome, categoria, preço e imagem principal são obrigatórios.');
  if (typeof d.name !== 'string' || d.name.trim().length < 2 || d.name.length > 120) return falha(400, 'Nome inválido (de 2 a 120 caracteres).');
  if (typeof d.image_primary !== 'string' || d.image_primary.length > 500) return falha(400, 'Imagem principal inválida.');
  if (typeof d.category_id !== 'string' || !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(d.category_id)) return falha(400, 'Categoria inválida.');
  const price = dinheiro(d.price);
  if (price === null) return falha(400, 'Preço inválido.');
  let oldPrice: number | null = null;
  if (d.old_price) { oldPrice = dinheiro(d.old_price); if (oldPrice === null) return falha(400, 'Preço anterior inválido.'); }
  const cost = d.cost_price === undefined || d.cost_price === '' || d.cost_price === null ? 0 : dinheiro(d.cost_price);
  if (cost === null) return falha(400, 'Custo inválido.');
  const stock = d.stock === undefined ? 10 : inteiro(d.stock);
  if (stock === null) return falha(400, 'Estoque inválido.');
  const images = d.images === undefined ? [] : listaTextos(d.images, MAX_FOTOS);
  if (images === null) return falha(400, 'Lista de fotos inválida.');
  const variants = d.variants === undefined ? [] : listaTextos(d.variants, MAX_VARIACOES);
  if (variants === null) return falha(400, 'Lista de variações inválida.');
  for (const [campo, rotulo] of [['description', 'Descrição'], ['materials', 'Materiais'], ['care_instructions', 'Cuidados'], ['dimensions', 'Dimensões'], ['warranty', 'Garantia']] as const) {
    if (d[campo] !== undefined && textoCurto(d[campo], 5000) === null) return falha(400, `${rotulo} inválido(a).`);
  }

  const nome = d.name.trim();
  const baseSlug = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let slug = baseSlug;
  if (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug)) slug = `${baseSlug}-${Date.now().toString(36)}`;
  const id = `prod_${baseSlug.replace(/-/g, '_')}_${Date.now().toString(36)}`;

  emTransacao(() => {
    db.prepare(`
      INSERT INTO products (
        id, name, slug, category_id, price, old_price, cost_price, is_archived, description,
        materials, care_instructions, dimensions, warranty, stock, is_featured,
        image_primary, images_json, variants_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, nome, slug, d.category_id, price, oldPrice, cost, d.description || '', d.materials || '',
      d.care_instructions ?? '', d.dimensions ?? '', d.warranty ?? "1 ano de garantia Luce D'Oro", stock, d.is_featured ? 1 : 0,
      d.image_primary, JSON.stringify(images.length > 0 ? images : [d.image_primary]), JSON.stringify(variants.length > 0 ? variants : ['Padrão'])
    );
    db.prepare(`
      INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id)
      VALUES (?, ?, 0, ?, 'Cadastro inicial de produto', ?)
    `).run(id, stock, stock, quem.id);
  });
  logAudit({ userId: quem.id, userEmail: quem.email, action: 'PRODUCT_CREATED', entity: 'PRODUCTS', entityId: id, details: { name: d.name, price: d.price, stock } });
  return { ok: true, id };
}

export function atualizarProduto(quem: Quem, id: string, d: Record<string, any>): { ok: true } | Falha {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!existing) return falha(404, 'Produto não encontrado.');

  if (d.name !== undefined && (typeof d.name !== 'string' || (d.name.trim() !== '' && (d.name.trim().length < 2 || d.name.length > 120)))) return falha(400, 'Nome inválido (de 2 a 120 caracteres).');
  if (d.category_id && (typeof d.category_id !== 'string' || !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(d.category_id))) return falha(400, 'Categoria inválida.');
  if (d.image_primary !== undefined && d.image_primary !== '' && (typeof d.image_primary !== 'string' || d.image_primary.length > 500)) return falha(400, 'Imagem principal inválida.');
  const price = d.price !== undefined ? dinheiro(d.price) : undefined;
  if (price === null) return falha(400, 'Preço inválido.');
  let oldPrice: number | null = existing.old_price;
  if (d.old_price !== undefined) { if (d.old_price) { const o = dinheiro(d.old_price); if (o === null) return falha(400, 'Preço anterior inválido.'); oldPrice = o; } else oldPrice = null; }
  const cost = d.cost_price !== undefined ? dinheiro(d.cost_price) : undefined;
  if (cost === null) return falha(400, 'Custo inválido.');
  const stockIn = d.stock !== undefined ? inteiro(d.stock) : undefined;
  if (stockIn === null) return falha(400, 'Estoque inválido.');
  const images = d.images ? listaTextos(d.images, MAX_FOTOS) : undefined;
  if (images === null) return falha(400, 'Lista de fotos inválida.');
  const variants = d.variants ? listaTextos(d.variants, MAX_VARIACOES) : undefined;
  if (variants === null) return falha(400, 'Lista de variações inválida.');
  for (const [campo, rotulo] of [['description', 'Descrição'], ['materials', 'Materiais'], ['care_instructions', 'Cuidados'], ['dimensions', 'Dimensões'], ['warranty', 'Garantia']] as const) {
    if (d[campo] !== undefined && textoCurto(d[campo], 5000) === null) return falha(400, `${rotulo} inválido(a).`);
  }

  const prevStock = existing.stock;
  // Produto com variações: estoque e lista de variações só mudam pelo editor de variações
  const comVariacoes = temVariantes(id);
  const newStock = !comVariacoes && stockIn !== undefined ? stockIn : prevStock;

  emTransacao(() => {
    db.prepare(`
      UPDATE products SET
        name = COALESCE(?, name), category_id = COALESCE(?, category_id), price = COALESCE(?, price), old_price = ?,
        cost_price = COALESCE(?, cost_price), stock = ?, description = COALESCE(?, description), materials = COALESCE(?, materials),
        care_instructions = COALESCE(?, care_instructions), dimensions = COALESCE(?, dimensions), warranty = COALESCE(?, warranty),
        is_featured = COALESCE(?, is_featured), is_archived = COALESCE(?, is_archived), image_primary = COALESCE(?, image_primary),
        images_json = COALESCE(?, images_json), variants_json = COALESCE(?, variants_json)
      WHERE id = ?
    `).run(
      d.name?.trim() || null, d.category_id || null, price ?? null, oldPrice, cost ?? null, newStock,
      d.description || null, d.materials || null, d.care_instructions || null, d.dimensions || null, d.warranty || null,
      d.is_featured !== undefined ? (d.is_featured ? 1 : 0) : null, d.is_archived !== undefined ? (d.is_archived ? 1 : 0) : null,
      d.image_primary || null, images ? JSON.stringify(images) : null, variants && !comVariacoes ? JSON.stringify(variants) : null, id
    );
    if (newStock !== prevStock) {
      db.prepare(`
        INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id)
        VALUES (?, ?, ?, ?, 'Ajuste manual pelo proprietário', ?)
      `).run(id, newStock - prevStock, prevStock, newStock, quem.id);
    }
  });
  logAudit({ userId: quem.id, userEmail: quem.email, action: 'PRODUCT_UPDATED', entity: 'PRODUCTS', entityId: id, details: { name: d.name || existing.name, price: d.price, stock: newStock } });
  return { ok: true };
}

// Arquiva em vez de apagar, para não quebrar o histórico de pedidos.
export function arquivarProduto(quem: Quem, id: string): { ok: true; nome: string } | Falha {
  const existing = db.prepare('SELECT id, name FROM products WHERE id = ?').get(id) as { id: string; name: string } | undefined;
  if (!existing) return falha(404, 'Produto não encontrado.');
  db.prepare('UPDATE products SET is_archived = 1 WHERE id = ?').run(id);
  logAudit({ userId: quem.id, userEmail: quem.email, action: 'PRODUCT_ARCHIVED', entity: 'PRODUCTS', entityId: id, details: { name: existing.name } });
  return { ok: true, nome: existing.name };
}
