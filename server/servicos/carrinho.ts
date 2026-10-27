import { db } from '../db.js';
import { ESTOQUE_SQL, temVariantes, limiteFreteGratis } from '../adminCommerce.js';

// Regras da sacola. Não conhece Express: recebe dados simples e devolve o resultado.
export type Falha = { ok: false; status: number; erro: string };
const falha = (status: number, erro: string): Falha => ({ ok: false, status, erro });

export interface ItemSacola {
  id: number; product_id: string; variant_title: string; quantity: number;
  name: string; price: number; image_primary: string; stock: number;
}
export interface Sacola {
  cartId: string; items: ItemSacola[]; itemCount: number; total: number;
  freeShippingThreshold: number; freeShippingAvailable: boolean; hasFreeShipping: boolean;
}

// Cada cliente tem uma sacola; ela é criada na primeira vez que é usada.
function sacolaDoUsuario(userId: number): { id: string } {
  const existente = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as { id: string } | undefined;
  if (existente) return existente;
  const id = `cart_${userId}_${Date.now()}`;
  db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run(id, userId);
  return { id };
}

export function obterSacola(userId: number, siteId: string): Sacola {
  const cart = sacolaDoUsuario(userId);
  const items = db.prepare(`
    SELECT ci.id, ci.product_id, ci.variant_title, ci.quantity, p.name, p.price, p.image_primary, ${ESTOQUE_SQL} AS stock
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.cart_id = ? AND p.site_id = ?
  `).all(cart.id, siteId) as unknown as ItemSacola[];

  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const thresholdRow = db.prepare("SELECT value FROM site_settings WHERE site_id = ? AND key = 'free_shipping_threshold'").get(siteId) as { value: string } | undefined;
  const limiteLoja = limiteFreteGratis(siteId);
  const semFretes = (db.prepare('SELECT COUNT(*) AS n FROM shipping_methods WHERE is_active = 1 AND site_id = ?').get(siteId) as { n: number }).n === 0;
  const freeShippingAvailable = limiteLoja !== null || semFretes;
  const freeShippingThreshold = limiteLoja ?? (thresholdRow ? parseFloat(thresholdRow.value) : 500.0);

  return { cartId: cart.id, items, itemCount, total, freeShippingThreshold, freeShippingAvailable, hasFreeShipping: freeShippingAvailable && total >= freeShippingThreshold };
}

export function adicionarItem(userId: number, siteId: string, entrada: { productId?: unknown; variantTitle?: unknown; quantity?: unknown }): { ok: true } | Falha {
  const quantity = Number(entrada.quantity ?? 1);
  if (!entrada.productId) return falha(400, 'Produto e variação são obrigatórios.');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return falha(400, 'Quantidade inválida.');

  const product = db.prepare('SELECT id, stock, variants_json FROM products WHERE id = ? AND is_archived = 0 AND site_id = ?').get(String(entrada.productId), siteId) as
    | { id: string; stock: number; variants_json: string } | undefined;
  if (!product) return falha(404, 'Produto não encontrado.');

  // Produto sem variações usa a variação "Único"; com variações, a escolhida precisa existir e ter estoque próprio
  const listadas: string[] = JSON.parse(product.variants_json || '[]');
  let variantTitle = String(entrada.variantTitle || '').trim() || (listadas[0] ?? 'Único');
  if (!temVariantes(product.id)) {
    // Sem lista de variações, o título enviado pelo navegador é ignorado (evita texto solto na sacola e no pedido)
    if (listadas.length === 0) variantTitle = 'Único';
    else if (!listadas.includes(variantTitle)) return falha(400, 'Variação indisponível para este produto.');
  }
  if (temVariantes(product.id)) {
    const linha = db.prepare('SELECT stock FROM product_variants WHERE product_id = ? AND title = ?').get(product.id, variantTitle) as { stock: number } | undefined;
    if (!linha) return falha(400, 'Variação indisponível para este produto.');
    product.stock = linha.stock;
  }

  const cart = sacolaDoUsuario(userId);
  const existing = db.prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_title = ?')
    .get(cart.id, product.id, variantTitle) as { id: number; quantity: number } | undefined;

  if (existing) {
    const novaQtd = existing.quantity + quantity;
    if (novaQtd > product.stock) return falha(400, `Estoque insuficiente. Restam apenas ${product.stock} unidades.`);
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(novaQtd, existing.id);
  } else {
    if (quantity > product.stock) return falha(400, `Estoque insuficiente. Restam apenas ${product.stock} unidades.`);
    db.prepare('INSERT INTO cart_items (cart_id, product_id, variant_title, quantity) VALUES (?, ?, ?, ?)').run(cart.id, product.id, variantTitle, quantity);
  }
  return { ok: true };
}

// quantidade 0 ou negativa remove o item; decimais, texto e valores acima de 99 são recusados.
export function atualizarQuantidade(userId: number, itemId: string, quantidade: unknown): { ok: true } | Falha {
  const qtd = Number(quantidade);
  if (quantidade === undefined || quantidade === null || quantidade === '' || !Number.isInteger(qtd) || qtd > 99) return falha(400, 'Quantidade inválida.');

  const item = db.prepare(`
    SELECT ci.id, ci.product_id, ${ESTOQUE_SQL} AS stock
    FROM cart_items ci
    JOIN carts c ON ci.cart_id = c.id
    JOIN products p ON ci.product_id = p.id
    WHERE ci.id = ? AND c.user_id = ?
  `).get(itemId, userId) as { id: number; product_id: string; stock: number } | undefined;
  if (!item) return falha(404, 'Item não encontrado na sua sacola.');

  if (qtd <= 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);
  } else {
    if (qtd > item.stock) return falha(400, `Estoque insuficiente. Máximo de ${item.stock} unidades.`);
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(qtd, itemId);
  }
  return { ok: true };
}

export function removerItem(userId: number, itemId: string): { ok: true } | Falha {
  const item = db.prepare(`
    SELECT ci.id FROM cart_items ci JOIN carts c ON ci.cart_id = c.id WHERE ci.id = ? AND c.user_id = ?
  `).get(itemId, userId);
  if (!item) return falha(404, 'Item não encontrado na sua sacola.');
  db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);
  return { ok: true };
}
