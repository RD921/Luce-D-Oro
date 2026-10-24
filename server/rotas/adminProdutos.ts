import { Response } from 'express';
import type { Express } from 'express';
import { db, logAudit } from '../db.js';
import { temVariantes, variantesDe } from '../adminCommerce.js';
import { criarPainel } from '../adminTeam.js';
import { type AuthenticatedRequest } from '../auth.js';

export function registerAdminProdutos(app: Express, painel: ReturnType<typeof criarPainel>) {
  // 2. Admin Products CRUD
  app.get('/api/admin/products', painel('produtos'), (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all() as any[];
    const products = rows.map((r) => ({
      ...r,
      images: JSON.parse(r.images_json || '[]'),
      variants: JSON.parse(r.variants_json || '[]'),
      variant_stock: variantesDe(r.id),
    }));
    res.json(products);
  });

  app.post('/api/admin/products', painel('produtos'), (req: AuthenticatedRequest, res: Response) => {
    const {
      name,
      category_id,
      price,
      old_price,
      cost_price = 0,
      stock = 10,
      description,
      materials,
      care_instructions = '',
      dimensions = '',
      warranty = "1 ano de garantia Luce D'Oro",
      is_featured = 0,
      image_primary,
      images = [],
      variants = [],
    } = req.body;

    if (!name || !category_id || price === undefined || !image_primary) {
      res.status(400).json({ error: 'Nome, categoria, preço e imagem principal são obrigatórios.' });
      return;
    }

    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    const existingSlug = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
    if (existingSlug) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    const id = `prod_${baseSlug.replace(/-/g, '_')}_${Date.now().toString(36)}`;

    db.prepare(`
      INSERT INTO products (
        id, name, slug, category_id, price, old_price, cost_price, is_archived, description,
        materials, care_instructions, dimensions, warranty, stock, is_featured,
        image_primary, images_json, variants_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      slug,
      category_id,
      parseFloat(price),
      old_price ? parseFloat(old_price) : null,
      parseFloat(cost_price || 0),
      description || '',
      materials || '',
      care_instructions,
      dimensions,
      warranty,
      parseInt(stock, 10),
      is_featured ? 1 : 0,
      image_primary,
      JSON.stringify(images.length > 0 ? images : [image_primary]),
      JSON.stringify(variants.length > 0 ? variants : ['Padrão'])
    );

    // Initial stock movement record
    db.prepare(`
      INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id)
      VALUES (?, ?, 0, ?, 'Cadastro inicial de produto', ?)
    `).run(id, parseInt(stock, 10), parseInt(stock, 10), req.user!.id);

    logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'PRODUCT_CREATED',
      entity: 'PRODUCTS',
      entityId: id,
      details: { name, price, stock },
    });

    res.status(201).json({ success: true, id, message: 'Produto cadastrado com sucesso.' });
  });

  app.put('/api/admin/products/:id', painel('produtos'), (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    const {
      name,
      category_id,
      price,
      old_price,
      cost_price,
      stock,
      description,
      materials,
      care_instructions,
      dimensions,
      warranty,
      is_featured,
      is_archived,
      image_primary,
      images,
      variants,
    } = req.body;

    const prevStock = existing.stock;
    // Produto com variações: estoque e lista de variações só mudam pelo editor de variações
    const comVariacoes = temVariantes(id);
    const newStock = !comVariacoes && stock !== undefined ? parseInt(stock, 10) : prevStock;

    db.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        category_id = COALESCE(?, category_id),
        price = COALESCE(?, price),
        old_price = ?,
        cost_price = COALESCE(?, cost_price),
        stock = ?,
        description = COALESCE(?, description),
        materials = COALESCE(?, materials),
        care_instructions = COALESCE(?, care_instructions),
        dimensions = COALESCE(?, dimensions),
        warranty = COALESCE(?, warranty),
        is_featured = COALESCE(?, is_featured),
        is_archived = COALESCE(?, is_archived),
        image_primary = COALESCE(?, image_primary),
        images_json = COALESCE(?, images_json),
        variants_json = COALESCE(?, variants_json)
      WHERE id = ?
    `).run(
      name?.trim() || null,
      category_id || null,
      price !== undefined ? parseFloat(price) : null,
      old_price !== undefined ? (old_price ? parseFloat(old_price) : null) : existing.old_price,
      cost_price !== undefined ? parseFloat(cost_price) : null,
      newStock,
      description || null,
      materials || null,
      care_instructions || null,
      dimensions || null,
      warranty || null,
      is_featured !== undefined ? (is_featured ? 1 : 0) : null,
      is_archived !== undefined ? (is_archived ? 1 : 0) : null,
      image_primary || null,
      images ? JSON.stringify(images) : null,
      variants && !comVariacoes ? JSON.stringify(variants) : null,
      id
    );

    // If stock was modified, record movement
    if (newStock !== prevStock) {
      db.prepare(`
        INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id)
        VALUES (?, ?, ?, ?, 'Ajuste manual pelo proprietário', ?)
      `).run(id, newStock - prevStock, prevStock, newStock, req.user!.id);
    }

    logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'PRODUCT_UPDATED',
      entity: 'PRODUCTS',
      entityId: id,
      details: { name: name || existing.name, price, stock: newStock },
    });

    res.json({ success: true, message: 'Produto atualizado com sucesso.' });
  });

  app.delete('/api/admin/products/:id', painel('produtos'), (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const existing = db.prepare('SELECT id, name FROM products WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    // Soft delete / archive to protect existing orders history
    db.prepare('UPDATE products SET is_archived = 1 WHERE id = ?').run(id);

    logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'PRODUCT_ARCHIVED',
      entity: 'PRODUCTS',
      entityId: id,
      details: { name: existing.name },
    });

    res.json({ success: true, message: `Produto ${existing.name} arquivado com sucesso.` });
  });
}
