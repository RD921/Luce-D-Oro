import { db, emTransacao } from '../db.js';
import { ESTOQUE_SQL, temVariantes, baixarEstoque, resolverEntrega, resolverPagamento } from '../adminCommerce.js';
import { motivoCupomInvalido, registrarUsoCupom, calcularDesconto } from './cupons.js';

// Regras do checkout. Não conhece Express: recebe os dados e devolve o resultado, o que permite testar sem subir a API.
export interface EntradaPedido {
  shippingAddress?: string;
  paymentMethod?: string;
  paymentMethodId?: string;
  couponCode?: string;
  shippingMethodId?: string;
  installments?: number;
  [chave: string]: unknown;
}
export type ResultadoPedido =
  | { ok: true; orderId: string; total: number; shippingCost: number; paymentDiscount: number }
  | { ok: false; status: number; erro: string };

export function criarPedido(userId: number, entrada: EntradaPedido): ResultadoPedido {
  const { shippingAddress, paymentMethod, paymentMethodId, couponCode } = entrada;

  if (!shippingAddress || (!paymentMethod && !paymentMethodId)) {
    return { ok: false, status: 400, erro: 'Endereço de entrega e método de pagamento são obrigatórios.' };
  }

  const cart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as { id: string } | undefined;
  if (!cart) {
    return { ok: false, status: 400, erro: 'Sacola vazia.' };
  }

  const items = db
    .prepare(
      `
    SELECT ci.*, p.name, p.price, p.image_primary, ${ESTOQUE_SQL} AS stock
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.cart_id = ?
  `
    )
    .all(cart.id) as Array<{
    id: number;
    product_id: string;
    variant_title: string;
    quantity: number;
    name: string;
    price: number;
    image_primary: string;
    stock: number;
  }>;

  if (items.length === 0) {
    return { ok: false, status: 400, erro: 'Sua sacola está vazia.' };
  }

  // Stock check
  for (const item of items) {
    if (item.quantity > item.stock) {
      return { ok: false, status: 400, erro: `O produto "${item.name}" possui apenas ${item.stock} unidades disponíveis.` };
    }
  }

  let subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  let discount = 0;
  let cupomUsado: string | null = null;

  if (couponCode) {
    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(couponCode).trim().toUpperCase()) as any;
    if (coupon && !motivoCupomInvalido(coupon, userId, subtotal)) {
      discount = calcularDesconto(coupon, subtotal);
      cupomUsado = coupon.id;
    }
  }

  // Pagamento e entrega: sempre calculados aqui no servidor, nunca confiados ao navegador
  const pag = resolverPagamento(entrada);
  if (pag.erro) {
    return { ok: false, status: 400, erro: pag.erro };
  }
  const entrega = resolverEntrega(entrada.shippingMethodId, subtotal);
  if (entrega.erro) {
    return { ok: false, status: 400, erro: entrega.erro };
  }
  const descontoPagamento = pag.metodo && pag.metodo.discount_percent > 0 ? Math.round(((subtotal - discount) * pag.metodo.discount_percent)) / 100 : 0;
  const total = Math.max(0, subtotal - discount - descontoPagamento) + entrega.custo;
  const orderId = `PED-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

  // Pedido, itens, cupom, estoque e sacola são gravados juntos: se qualquer passo falhar, nada fica pela metade.
  try {
    emTransacao(() => {
      db.prepare(
        'INSERT INTO orders (id, user_id, total, status, shipping_address, payment_method, shipping_method, shipping_cost, coupon_discount, payment_discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(orderId, userId, total, 'Confirmado', shippingAddress as string, pag.descricao || paymentMethod || null, entrega.metodo?.name ?? null, entrega.custo, discount, descontoPagamento);
      if (cupomUsado) registrarUsoCupom(cupomUsado, userId, orderId);

      const insertOrderItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, variant_title, unit_price, quantity, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertOrderItem.run(
          orderId,
          item.product_id,
          item.name,
          item.variant_title,
          item.price,
          item.quantity,
          item.image_primary
        );

        // Decrement stock (da variação, quando houver) & record movement
        const prevStock = (db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id) as { stock: number }).stock;
        baixarEstoque(item.product_id, item.variant_title, item.quantity);
        const newStock = (db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id) as { stock: number }).stock;

        db.prepare(`
          INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(item.product_id, newStock - prevStock, prevStock, newStock, `Venda aprovada Pedido ${orderId}${temVariantes(item.product_id) ? ` (${item.variant_title})` : ''}`, userId);
      }

      // Clear cart
      db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
    });
  } catch (e) {
    console.error('[Pedido] falha ao gravar, nada foi salvo:', e);
    return { ok: false, status: 500, erro: 'Não foi possível concluir o pedido. Nada foi cobrado; tente novamente.' };
  }

  return { ok: true, orderId, total, shippingCost: entrega.custo, paymentDiscount: descontoPagamento };
}
