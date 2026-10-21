import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import {
  db,
  initDatabase,
  hashPassword,
  verifyPassword,
  AUTHORIZED_OWNER,
  logAudit,
  getOrCreateOwnerSetupKey,
} from './db.js';
import { registerAdminExtras } from './adminExtras.js';
import { registerSiteContent } from './siteContent.js';
import { registerAdminCatalog } from './adminCatalog.js';
import { registerAdminCommerce, ESTOQUE_SQL, temVariantes, estoqueDaVariante, baixarEstoque, variantesDe, resolverEntrega, resolverPagamento, limiteFreteGratis } from './adminCommerce.js';
import { registerAdminArchitecture } from './adminArchitecture.js';
import { registerAdminTeam, criarPainel, areasDoPapel, motivoCupomInvalido, registrarUsoCupom } from './adminTeam.js';

initDatabase();

const app = express();
const PORT = 3001;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
// O upload de imagens tem leitor próprio (aceita arquivos maiores), por isso é pulado aqui
app.use((req, res, next) => (req.path === '/api/admin/uploads' ? next() : express.json()(req, res, next)));
app.use(cookieParser());

// Helper to authenticate request via Cookie or Authorization header
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Não autorizado. Sessão inexistente.' });
    return;
  }

  const session = db
    .prepare(
      `
    SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `
    )
    .get(token) as { token: string; expires_at: string; id: number; name: string; email: string; role: string } | undefined;

  if (!session) {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return;
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    return;
  }

  req.user = {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
  };
  next();
}

// CRITICAL SECURITY RULE: Exclusive Owner Authorization Middleware
export function ownerAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  authMiddleware(req, res, () => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Não autorizado. Autenticação obrigatória.' });
      return;
    }

    const cleanEmail = user.email.trim().toLowerCase();
    const authorizedEmail = AUTHORIZED_OWNER.email.toLowerCase();

    // Verify both email and role against immutable authorized owner specification
    if (cleanEmail !== authorizedEmail || user.role !== AUTHORIZED_OWNER.role) {
      logAudit({
        userId: user.id,
        userEmail: user.email,
        action: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
        entity: 'ADMIN_ROUTE',
        entityId: req.originalUrl,
        details: { method: req.method, path: req.path, attemptedRole: user.role },
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      res.status(403).json({
        error: "Acesso negado. Apenas a conta autorizada de Rodrigo Arrezzi (rodrigoarrezzi@icloud.com) possui privilégios administrativos da Luce D'Oro.",
      });
      return;
    }

    // Verify directly against current database record to prevent token forging
    const dbUser = db.prepare('SELECT id, email, role, is_verified FROM users WHERE id = ?').get(user.id) as
      | { id: number; email: string; role: string; is_verified: number }
      | undefined;

    if (!dbUser || dbUser.email.toLowerCase() !== authorizedEmail || dbUser.role !== AUTHORIZED_OWNER.role) {
      res.status(403).json({ error: 'Acesso revogado ou privilégios não confirmados no banco de dados.' });
      return;
    }

    next();
  });
}

// ==================== AUTH & SETUP ROUTES ====================

// Check/validate email format (does not expose account existence to avoid enumeration)
app.post('/api/auth/validate-email', (req: Request, res: Response) => {
  const { email } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    res.status(400).json({ error: 'Formato de e-mail inválido. Por favor, digite um e-mail correto.' });
    return;
  }
  res.json({ valid: true });
});

// Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as
    | {
        id: number;
        name: string;
        email: string;
        password_hash: string;
        salt: string;
        role: string;
      }
    | undefined;

  const dummySalt = '0123456789abcdef0123456789abcdef';
  const dummyHash = '0'.repeat(128);

  const isValid = user
    ? verifyPassword(password, user.password_hash, user.salt)
    : verifyPassword(password, dummyHash, dummySalt);

  if (!user || !isValid) {
    res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
    return;
  }

  // Create session (valid for 7 days)
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    sessionToken,
    user.id,
    expiresAt
  );

  res.cookie('session_token', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    token: sessionToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isOwner: user.role === 'owner' && user.email.toLowerCase() === AUTHORIZED_OWNER.email.toLowerCase(),
      isStaff: Object.keys(areasDoPapel(user.role)).length > 0,
      areas: areasDoPapel(user.role),
    },
  });
});

// Register: Public registration NEVER grants owner or admin role
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || name.trim().length < 3) {
    res.status(400).json({ error: 'Por favor, informe seu nome completo.' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
    return;
  }

  if (!password || password.length < 6) {
    res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: 'A confirmação de senha não confere.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    res.status(409).json({ error: 'Este e-mail já está cadastrado. Tente entrar ou recuperar sua senha.' });
    return;
  }

  const { hash, salt } = hashPassword(password);

  // Security: Public registration role is strictly 'customer'
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, salt, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name.trim(), cleanEmail, hash, salt, 'customer', 0);

  const userId = Number(result.lastInsertRowid);

  // Create empty cart
  db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run(`cart_${userId}_${Date.now()}`, userId);

  // Create session
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    sessionToken,
    userId,
    expiresAt
  );

  res.cookie('session_token', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    token: sessionToken,
    user: {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      role: 'customer',
    },
  });
});

// Current User Profile
app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = db.prepare('SELECT id, name, email, role, is_verified, created_at FROM users WHERE id = ?').get(req.user!.id) as
    | { id: number; name: string; email: string; role: string; is_verified: number; created_at: string }
    | undefined;

  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: Boolean(user.is_verified),
      isOwner: user.role === 'owner' && user.email.toLowerCase() === AUTHORIZED_OWNER.email.toLowerCase(),
      isStaff: Object.keys(areasDoPapel(user.role)).length > 0,
      areas: areasDoPapel(user.role),
      createdAt: user.created_at,
    },
  });
});

// Logout
app.post('/api/auth/logout', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.clearCookie('session_token');
  res.json({ success: true, message: 'Sessão encerrada com segurança.' });
});

// Request Password Reset
app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'E-mail obrigatório.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail) as { id: number } | undefined;

  if (user) {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)').run(
      token,
      user.id,
      expiresAt
    );
  }

  res.json({
    success: true,
    message: 'Se o e-mail informado estiver cadastrado, as instruções para redefinição foram enviadas com sucesso.',
  });
});

// ==================== OWNER INITIALIZATION PROCEDURES ====================

// Check Owner Account Setup Status
app.get('/api/admin/setup/status', (req: Request, res: Response) => {
  const targetEmail = AUTHORIZED_OWNER.email.toLowerCase();
  const ownerUser = db
    .prepare('SELECT id, name, email, role, is_verified FROM users WHERE email = ?')
    .get(targetEmail) as { id: number; name: string; email: string; role: string; is_verified: number } | undefined;

  const isInitialized = ownerUser?.role === 'owner' && Boolean(ownerUser?.is_verified);

  res.json({
    authorizedOwnerEmail: AUTHORIZED_OWNER.email,
    authorizedOwnerName: AUTHORIZED_OWNER.name,
    isRegistered: Boolean(ownerUser),
    isInitialized,
    requiresVerification: Boolean(ownerUser && ownerUser.role !== 'owner'),
  });
});

// Claim & Activate Owner Privileges via Single-Use Setup Key
app.post('/api/admin/setup/verify-owner', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const cleanEmail = user.email.trim().toLowerCase();
  const authorizedEmail = AUTHORIZED_OWNER.email.toLowerCase();

  // Strict check: only rodrigoarrezzi@icloud.com can activate the owner role
  if (cleanEmail !== authorizedEmail) {
    logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'ILLEGAL_OWNER_CLAIM_ATTEMPT',
      entity: 'SECURITY',
      details: { attemptedBy: user.email },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(403).json({
      error: 'Acesso negado. A ativação da conta proprietária é restrita exclusivamente a Rodrigo Arrezzi (rodrigoarrezzi@icloud.com).',
    });
    return;
  }

  const { setupKey } = req.body;
  if (!setupKey) {
    res.status(400).json({ error: 'Chave de ativação do proprietário é obrigatória.' });
    return;
  }

  // Validate setup key from database
  const tokenRecord = db
    .prepare('SELECT token, is_used FROM owner_setup_tokens WHERE token = ?')
    .get(setupKey.trim()) as { token: string; is_used: number } | undefined;

  if (!tokenRecord) {
    res.status(400).json({ error: 'Chave de ativação incorreta. Verifique o código gerado no servidor.' });
    return;
  }

  if (tokenRecord.is_used === 1) {
    res.status(400).json({ error: 'Esta chave de ativação já foi utilizada anteriormente.' });
    return;
  }

  // Update user to owner role and verified status
  db.prepare("UPDATE users SET role = 'owner', is_verified = 1 WHERE id = ?").run(user.id);
  db.prepare("UPDATE owner_setup_tokens SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE token = ?").run(
    setupKey.trim()
  );

  logAudit({
    userId: user.id,
    userEmail: user.email,
    action: 'OWNER_ACCOUNT_ACTIVATED',
    entity: 'USERS',
    entityId: String(user.id),
    details: { verifiedAt: new Date().toISOString() },
    ipAddress: req.ip || req.socket.remoteAddress,
  });

  res.json({
    success: true,
    message: "Conta proprietária ativada com sucesso! Você agora tem acesso integral à Central de Comando da Luce D'Oro.",
    role: 'owner',
  });
});

// ==================== PUBLIC STORE ROUTES ====================

// Public Categories
app.get('/api/catalog/categories', (_req: Request, res: Response) => {
  const categories = db.prepare('SELECT * FROM categories WHERE COALESCE(is_active, 1) = 1 ORDER BY display_order ASC, name ASC').all();
  res.json(categories);
});

// Public Products
app.get('/api/catalog/products', (req: Request, res: Response) => {
  const { category, featured, search } = req.query;

  let query = 'SELECT * FROM products WHERE is_archived = 0';
  const params: any[] = [];

  if (category) {
    query += ' AND category_id = ?';
    params.push(category);
  }

  if (featured === 'true') {
    query += ' AND is_featured = 1';
  }

  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY is_featured DESC, created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];
  const products = rows.map((r) => ({
    ...r,
    images: JSON.parse(r.images_json || '[]'),
    variants: JSON.parse(r.variants_json || '[]'),
    variant_stock: variantesDe(r.id),
  }));

  res.json(products);
});

// Public Single Product
app.get('/api/catalog/products/:slug', (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  const row = db.prepare('SELECT * FROM products WHERE (slug = ? OR id = ?) AND is_archived = 0').get(slug, slug) as any;

  if (!row) {
    res.status(404).json({ error: 'Produto não encontrado.' });
    return;
  }

  res.json({
    ...row,
    images: JSON.parse(row.images_json || '[]'),
    variants: JSON.parse(row.variants_json || '[]'),
    variant_stock: variantesDe(row.id),
  });
});

// Public Active Banners
app.get('/api/banners', (_req: Request, res: Response) => {
  const banners = db.prepare('SELECT * FROM banners WHERE is_active = 1 ORDER BY display_order ASC').all();
  res.json(banners);
});

// Public Settings
app.get('/api/settings', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT key, value FROM system_settings').all() as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  rows.forEach((r) => {
    settings[r.key] = r.value;
  });
  res.json(settings);
});

// Public Validate Coupon
app.post('/api/coupons/validate', (req: Request, res: Response) => {
  const { code, cartTotal } = req.body;
  if (!code) {
    res.status(400).json({ error: 'Código de cupom obrigatório.' });
    return;
  }

  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(code).trim().toUpperCase()) as any;
  if (!coupon) {
    res.status(404).json({ error: 'Cupom inválido ou inativo.' });
    return;
  }
  const quemPede = (() => {
    const t = (req as any).cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    if (!t) return null;
    const r = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?').get(t, new Date().toISOString()) as { user_id: number } | undefined;
    return r ? r.user_id : null;
  })();
  const motivo = motivoCupomInvalido(coupon, quemPede, Number(cartTotal) || 0);
  if (motivo) {
    res.status(400).json({ error: motivo });
    return;
  }

  let discount = 0;
  if (coupon.discount_type === 'percent') {
    discount = (cartTotal * coupon.discount_value) / 100;
  } else {
    discount = Math.min(coupon.discount_value, cartTotal);
  }

  res.json({
    valid: true,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    discountAmount: discount,
  });
});

// ==================== CART ROUTES (PRIVATE TO AUTH USERS) ====================

app.get('/api/cart', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  let cart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as { id: string } | undefined;

  if (!cart) {
    const newCartId = `cart_${userId}_${Date.now()}`;
    db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run(newCartId, userId);
    cart = { id: newCartId };
  }

  const items = db
    .prepare(
      `
    SELECT ci.id, ci.product_id, ci.variant_title, ci.quantity, p.name, p.price, p.image_primary, ${ESTOQUE_SQL} AS stock
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

  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const thresholdRow = db.prepare("SELECT value FROM system_settings WHERE key = 'free_shipping_threshold'").get() as
    | { value: string }
    | undefined;
  const limiteLoja = limiteFreteGratis();
  const semFretes = (db.prepare('SELECT COUNT(*) AS n FROM shipping_methods WHERE is_active = 1').get() as { n: number }).n === 0;
  const freeShippingAvailable = limiteLoja !== null || semFretes;
  const freeShippingThreshold = limiteLoja ?? (thresholdRow ? parseFloat(thresholdRow.value) : 500.0);

  res.json({
    cartId: cart.id,
    items,
    itemCount,
    total,
    freeShippingThreshold,
    freeShippingAvailable,
    hasFreeShipping: freeShippingAvailable && total >= freeShippingThreshold,
  });
});

app.post('/api/cart/items', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { productId } = req.body;
  const quantity = Number(req.body.quantity ?? 1);

  if (!productId) {
    res.status(400).json({ error: 'Produto e variação são obrigatórios.' });
    return;
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    res.status(400).json({ error: 'Quantidade inválida.' });
    return;
  }

  const product = db.prepare('SELECT id, stock, variants_json FROM products WHERE id = ? AND is_archived = 0').get(productId) as
    | { id: string; stock: number; variants_json: string }
    | undefined;
  if (!product) {
    res.status(404).json({ error: 'Produto não encontrado.' });
    return;
  }

  // Produto sem variações usa a variação "Único"; com variações, a escolhida precisa existir e ter estoque próprio
  const variantTitle = String(req.body.variantTitle || '').trim() || (JSON.parse(product.variants_json || '[]')[0] ?? 'Único');
  if (temVariantes(product.id)) {
    const linha = db.prepare('SELECT stock FROM product_variants WHERE product_id = ? AND title = ?').get(product.id, variantTitle) as { stock: number } | undefined;
    if (!linha) {
      res.status(400).json({ error: 'Variação indisponível para este produto.' });
      return;
    }
    product.stock = linha.stock;
  }

  let cart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as { id: string } | undefined;
  if (!cart) {
    const newCartId = `cart_${userId}_${Date.now()}`;
    db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run(newCartId, userId);
    cart = { id: newCartId };
  }

  const existing = db
    .prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_title = ?')
    .get(cart.id, productId, variantTitle) as { id: number; quantity: number } | undefined;

  if (existing) {
    const newQty = existing.quantity + Number(quantity);
    if (newQty > product.stock) {
      res.status(400).json({ error: `Estoque insuficiente. Restam apenas ${product.stock} unidades.` });
      return;
    }
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existing.id);
  } else {
    if (quantity > product.stock) {
      res.status(400).json({ error: `Estoque insuficiente. Restam apenas ${product.stock} unidades.` });
      return;
    }
    db.prepare('INSERT INTO cart_items (cart_id, product_id, variant_title, quantity) VALUES (?, ?, ?, ?)').run(
      cart.id,
      productId,
      variantTitle,
      Number(quantity)
    );
  }

  res.json({ success: true, message: 'Item adicionado à sacola com sucesso.' });
});

app.put('/api/cart/items/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const itemId = String(req.params.id);
  const { quantity } = req.body;
  const userId = req.user!.id;

  const item = db
    .prepare(
      `
    SELECT ci.id, ci.product_id, ${ESTOQUE_SQL} AS stock
    FROM cart_items ci
    JOIN carts c ON ci.cart_id = c.id
    JOIN products p ON ci.product_id = p.id
    WHERE ci.id = ? AND c.user_id = ?
  `
    )
    .get(itemId, userId) as { id: number; product_id: string; stock: number } | undefined;

  if (!item) {
    res.status(404).json({ error: 'Item não encontrado na sua sacola.' });
    return;
  }

  if (quantity <= 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);
  } else {
    if (quantity > item.stock) {
      res.status(400).json({ error: `Estoque insuficiente. Máximo de ${item.stock} unidades.` });
      return;
    }
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, itemId);
  }

  res.json({ success: true });
});

app.delete('/api/cart/items/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const itemId = String(req.params.id);
  const userId = req.user!.id;

  const item = db
    .prepare(
      `
    SELECT ci.id 
    FROM cart_items ci
    JOIN carts c ON ci.cart_id = c.id
    WHERE ci.id = ? AND c.user_id = ?
  `
    )
    .get(itemId, userId);

  if (!item) {
    res.status(404).json({ error: 'Item não encontrado na sua sacola.' });
    return;
  }

  db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);
  res.json({ success: true, message: 'Item removido da sacola.' });
});

// ==================== ORDERS & CHECKOUT ====================

app.get('/api/orders', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];

  const detailedOrders = orders.map((o) => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
    return { ...o, items };
  });

  res.json(detailedOrders);
});

app.post('/api/orders', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { shippingAddress, paymentMethod, paymentMethodId, couponCode } = req.body;

  if (!shippingAddress || (!paymentMethod && !paymentMethodId)) {
    res.status(400).json({ error: 'Endereço de entrega e método de pagamento são obrigatórios.' });
    return;
  }

  const cart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as { id: string } | undefined;
  if (!cart) {
    res.status(400).json({ error: 'Sacola vazia.' });
    return;
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
    res.status(400).json({ error: 'Sua sacola está vazia.' });
    return;
  }

  // Stock check
  for (const item of items) {
    if (item.quantity > item.stock) {
      res.status(400).json({ error: `O produto "${item.name}" possui apenas ${item.stock} unidades disponíveis.` });
      return;
    }
  }

  let subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  let discount = 0;
  let cupomUsado: string | null = null;

  if (couponCode) {
    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(couponCode).trim().toUpperCase()) as any;
    if (coupon && !motivoCupomInvalido(coupon, userId, subtotal)) {
      if (coupon.discount_type === 'percent') {
        discount = (subtotal * coupon.discount_value) / 100;
      } else {
        discount = Math.min(coupon.discount_value, subtotal);
      }
      cupomUsado = coupon.id;
    }
  }

  // Pagamento e entrega: sempre calculados aqui no servidor, nunca confiados ao navegador
  const pag = resolverPagamento(req.body);
  if (pag.erro) {
    res.status(400).json({ error: pag.erro });
    return;
  }
  const entrega = resolverEntrega(req.body.shippingMethodId, subtotal);
  if (entrega.erro) {
    res.status(400).json({ error: entrega.erro });
    return;
  }
  const descontoPagamento = pag.metodo && pag.metodo.discount_percent > 0 ? Math.round(((subtotal - discount) * pag.metodo.discount_percent)) / 100 : 0;
  const total = Math.max(0, subtotal - discount - descontoPagamento) + entrega.custo;
  const orderId = `PED-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

  db.prepare(
    'INSERT INTO orders (id, user_id, total, status, shipping_address, payment_method, shipping_method, shipping_cost, coupon_discount, payment_discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(orderId, userId, total, 'Confirmado', shippingAddress, pag.descricao || paymentMethod, entrega.metodo?.name ?? null, entrega.custo, discount, descontoPagamento);
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

  res.status(201).json({
    success: true,
    orderId,
    total,
    shippingCost: entrega.custo,
    paymentDiscount: descontoPagamento,
    message: 'Pedido realizado com sucesso! Um e-mail com os detalhes da compra foi enviado.',
  });
});

// ==================== ADMIN EXCLUSIVE ROUTES (OWNER ONLY) ====================

// Upload de imagens e categorias (arquivo separado)
const painel = criarPainel(authMiddleware as any);
registerAdminExtras(app, painel);
registerSiteContent(app, painel);
registerAdminTeam(app, painel, ownerAuthMiddleware as any);
registerAdminCatalog(app, painel);
registerAdminCommerce(app, painel, ownerAuthMiddleware as any);
registerAdminArchitecture(app, painel);

// 1. Admin Dashboard Overview
app.get('/api/admin/dashboard', painel('dashboard'), (req: AuthenticatedRequest, res: Response) => {
  const { period = 'all' } = req.query;

  let dateFilter = '';
  if (period === 'today') {
    dateFilter = " AND date(created_at) = date('now')";
  } else if (period === '7d') {
    dateFilter = " AND datetime(created_at) >= datetime('now', '-7 days')";
  } else if (period === '30d') {
    dateFilter = " AND datetime(created_at) >= datetime('now', '-30 days')";
  } else if (period === '90d') {
    dateFilter = " AND datetime(created_at) >= datetime('now', '-90 days')";
  }

  const allOrders = db.prepare(`SELECT * FROM orders WHERE 1=1 ${dateFilter} ORDER BY created_at DESC`).all() as any[];

  const ordersCount = allOrders.length;
  const statusCounts: Record<string, number> = {
    Confirmado: 0,
    Pago: 0,
    'Em Preparação': 0,
    Enviado: 0,
    Entregue: 0,
    Cancelado: 0,
  };

  let revenue = 0;
  let paidOrdersCount = 0;

  allOrders.forEach((o) => {
    if (statusCounts[o.status] !== undefined) {
      statusCounts[o.status]++;
    } else {
      statusCounts[o.status] = 1;
    }

    if (o.status !== 'Cancelado') {
      revenue += o.total;
      paidOrdersCount++;
    }
  });

  const averageTicket = paidOrdersCount > 0 ? revenue / paidOrdersCount : 0;

  // Inventory stats
  const lowStockRows = db
    .prepare('SELECT id, name, stock, price, category_id, image_primary FROM products WHERE stock <= 5 AND is_archived = 0 ORDER BY stock ASC')
    .all() as any[];
  const outOfStockCount = lowStockRows.filter((p) => p.stock === 0).length;

  // Active coupons
  const activeCoupons = (db.prepare('SELECT COUNT(*) as count FROM coupons WHERE is_active = 1').get() as { count: number }).count;

  // Top Products from order_items
  const topProducts = db
    .prepare(
      `
    SELECT oi.product_id, oi.product_name, oi.image_url, SUM(oi.quantity) as total_sold, SUM(oi.unit_price * oi.quantity) as total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'Cancelado' ${dateFilter.replace(/created_at/g, 'o.created_at')}
    GROUP BY oi.product_id
    ORDER BY total_sold DESC
    LIMIT 5
  `
    )
    .all();

  // Recent 8 orders with user name
  const recentOrders = allOrders.slice(0, 8).map((o) => {
    const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(o.user_id) as any;
    const items = db.prepare('SELECT product_name, variant_title, quantity, unit_price FROM order_items WHERE order_id = ?').all(o.id);
    return {
      ...o,
      customerName: user?.name || 'Cliente',
      customerEmail: user?.email || '',
      items,
    };
  });

  // Total registered customers
  const totalCustomers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get() as { count: number }).count;

  res.json({
    period,
    ordersCount,
    revenue,
    averageTicket,
    statusCounts,
    lowStockCount: lowStockRows.length,
    outOfStockCount,
    lowStockProducts: lowStockRows,
    topProducts,
    recentOrders,
    activeCoupons,
    totalCustomers,
  });
});

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

// 3. Admin Orders Management
app.get('/api/admin/orders', painel('pedidos'), (req: AuthenticatedRequest, res: Response) => {
  const { status, q } = req.query;

  let query = `
    SELECT o.*, u.name as customer_name, u.email as customer_email
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status && status !== 'all') {
    query += ' AND o.status = ?';
    params.push(status);
  }

  if (q) {
    query += ' AND (o.id LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR o.shipping_address LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  query += ' ORDER BY o.created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];

  const detailed = rows.map((order) => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    return { ...order, items };
  });

  res.json(detailed);
});

app.put('/api/admin/orders/:id/status', painel('pedidos'), (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { status, trackingCode, internalNotes } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) {
    res.status(404).json({ error: 'Pedido não encontrado.' });
    return;
  }

  db.prepare(`
    UPDATE orders SET
      status = COALESCE(?, status),
      tracking_code = COALESCE(?, tracking_code),
      internal_notes = COALESCE(?, internal_notes)
    WHERE id = ?
  `).run(status || null, trackingCode || null, internalNotes || null, id);

  logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'ORDER_UPDATED',
    entity: 'ORDERS',
    entityId: id,
    details: { previousStatus: order.status, newStatus: status, trackingCode },
  });

  res.json({ success: true, message: `Pedido ${id} atualizado para "${status}".` });
});

// 4. Admin Stock Adjustments
app.get('/api/admin/stock', painel('estoque'), (_req: AuthenticatedRequest, res: Response) => {
  const products = db
    .prepare('SELECT id, name, category_id, stock, price, cost_price, image_primary FROM products WHERE is_archived = 0 ORDER BY stock ASC')
    .all()
    .map((p: any) => ({ ...p, variants: variantesDe(p.id) }));

  const movements = db
    .prepare(
      `
    SELECT sm.*, p.name as product_name, u.name as user_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN users u ON sm.user_id = u.id
    ORDER BY sm.created_at DESC
    LIMIT 30
  `
    )
    .all();

  res.json({ products, movements });
});

app.post('/api/admin/stock/adjust', painel('estoque'), (req: AuthenticatedRequest, res: Response) => {
  const { productId, quantityChange, reason } = req.body;

  if (!productId || quantityChange === undefined || !reason) {
    res.status(400).json({ error: 'Produto, variação de quantidade e justificativa são obrigatórios.' });
    return;
  }

  const product = db.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(productId) as any;
  if (!product) {
    res.status(404).json({ error: 'Produto não encontrado.' });
    return;
  }

  if (temVariantes(productId)) {
    res.status(409).json({ error: 'Este produto tem variações com estoque próprio. Altere o estoque de cada variação.' });
    return;
  }
  const prevStock = product.stock;
  const change = parseInt(quantityChange, 10);
  const newStock = Math.max(0, prevStock + change);

  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, productId);

  db.prepare(`
    INSERT INTO stock_movements (product_id, quantity_change, previous_stock, new_stock, reason, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(productId, change, prevStock, newStock, reason.trim(), req.user!.id);

  logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'STOCK_MANUAL_ADJUSTMENT',
    entity: 'PRODUCTS',
    entityId: productId,
    details: { productName: product.name, change, prevStock, newStock, reason },
  });

  res.json({
    success: true,
    message: `Estoque do produto "${product.name}" ajustado de ${prevStock} para ${newStock} unidades.`,
    newStock,
  });
});

// 5. Admin Banners
app.get('/api/admin/banners', painel('banners'), (_req: AuthenticatedRequest, res: Response) => {
  const banners = db.prepare('SELECT * FROM banners ORDER BY display_order ASC, created_at DESC').all();
  res.json(banners);
});

app.post('/api/admin/banners', painel('banners'), (req: AuthenticatedRequest, res: Response) => {
  const { title, subtitle, badge, cta_text, cta_link, image_desktop, is_active = 1, display_order = 0 } = req.body;

  if (!title || !image_desktop) {
    res.status(400).json({ error: 'Título e imagem do banner são obrigatórios.' });
    return;
  }

  const id = `banner_${Date.now().toString(36)}`;
  db.prepare(`
    INSERT INTO banners (id, title, subtitle, badge, cta_text, cta_link, image_desktop, is_active, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, subtitle || '', badge || '', cta_text || 'Descubra', cta_link || '#pulseiras', image_desktop, is_active ? 1 : 0, display_order);

  logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'BANNER_CREATED',
    entity: 'BANNERS',
    entityId: id,
    details: { title },
  });

  res.status(201).json({ success: true, id, message: 'Banner criado com sucesso.' });
});

app.put('/api/admin/banners/:id', painel('banners'), (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { title, subtitle, badge, cta_text, cta_link, image_desktop, is_active, display_order } = req.body;

  db.prepare(`
    UPDATE banners SET
      title = COALESCE(?, title),
      subtitle = COALESCE(?, subtitle),
      badge = COALESCE(?, badge),
      cta_text = COALESCE(?, cta_text),
      cta_link = COALESCE(?, cta_link),
      image_desktop = COALESCE(?, image_desktop),
      is_active = COALESCE(?, is_active),
      display_order = COALESCE(?, display_order)
    WHERE id = ?
  `).run(
    title || null,
    subtitle !== undefined ? subtitle : null,
    badge !== undefined ? badge : null,
    cta_text || null,
    cta_link || null,
    image_desktop || null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    display_order !== undefined ? display_order : null,
    id
  );

  logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'BANNER_UPDATED',
    entity: 'BANNERS',
    entityId: id,
    details: { title },
  });

  res.json({ success: true, message: 'Banner atualizado.' });
});

app.delete('/api/admin/banners/:id', painel('banners'), (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  db.prepare('DELETE FROM banners WHERE id = ?').run(id);

  logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'BANNER_DELETED',
    entity: 'BANNERS',
    entityId: id,
  });

  res.json({ success: true, message: 'Banner removido.' });
});

// 6. Admin Settings
app.get('/api/admin/settings', painel('configuracoes'), (_req: AuthenticatedRequest, res: Response) => {
  const rows = db.prepare('SELECT key, value FROM system_settings').all() as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  rows.forEach((r) => {
    settings[r.key] = r.value;
  });
  res.json(settings);
});

app.put('/api/admin/settings', painel('configuracoes'), (req: AuthenticatedRequest, res: Response) => {
  const updates = req.body as Record<string, string>;

  const upsert = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  for (const [k, v] of Object.entries(updates)) {
    upsert.run(k, String(v));
  }

  logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    action: 'SETTINGS_UPDATED',
    entity: 'SETTINGS',
    details: updates,
  });

  res.json({ success: true, message: 'Configurações da loja atualizadas com sucesso.' });
});

// 8. Admin Customers
app.get('/api/admin/customers', painel('clientes'), (_req: AuthenticatedRequest, res: Response) => {
  const customers = db
    .prepare(
      `
    SELECT u.id, u.name, u.email, u.role, u.is_verified, u.created_at,
           COUNT(o.id) as orders_count,
           COALESCE(SUM(o.total), 0) as total_spent,
           MAX(o.created_at) as last_order_date
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id AND o.status != 'Cancelado'
    GROUP BY u.id
    ORDER BY total_spent DESC, orders_count DESC
  `
    )
    .all();

  res.json(customers);
});

// 9. Admin Audit Logs
app.get('/api/admin/audit-logs', painel('auditoria'), (_req: AuthenticatedRequest, res: Response) => {
  const logs = db.prepare('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 60').all() as any[];
  const parsed = logs.map((l) => ({
    ...l,
    details: l.details_json ? JSON.parse(l.details_json) : null,
  }));
  res.json(parsed);
});

// 10. Admin Real-time Alerts
app.get('/api/admin/alerts', painel('dashboard'), (_req: AuthenticatedRequest, res: Response) => {
  const alerts: Array<{ id: string; type: 'warning' | 'info' | 'danger'; title: string; message: string; link?: string }> = [];

  // Low stock alerts
  const lowStock = (db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= 5 AND is_archived = 0').get() as { count: number }).count;
  if (lowStock > 0) {
    alerts.push({
      id: 'alert_low_stock',
      type: 'warning',
      title: 'Atenção ao Estoque',
      message: `Existem ${lowStock} joias com estoque crítico (menor ou igual a 5 unidades).`,
      link: 'stock',
    });
  }

  // Pending shipments
  const pendingShipments = (db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'Confirmado' OR status = 'Em Preparação'").get() as { count: number }).count;
  if (pendingShipments > 0) {
    alerts.push({
      id: 'alert_orders_pending',
      type: 'info',
      title: 'Expedição Pendente',
      message: `${pendingShipments} pedidos aprovados aguardando despacho e código de rastreio.`,
      link: 'orders',
    });
  }

  // Security status alert
  const ownerRecord = db.prepare("SELECT is_verified FROM users WHERE email = ? AND role = 'owner'").get(AUTHORIZED_OWNER.email.toLowerCase()) as any;
  if (ownerRecord && ownerRecord.is_verified) {
    alerts.push({
      id: 'alert_security_ok',
      type: 'info',
      title: 'Proteção Ativa',
      message: 'Acesso administrativo exclusivo de Rodrigo Arrezzi validado com sucesso no banco de dados.',
    });
  }

  res.json(alerts);
});

app.listen(PORT, () => {
  console.log(`[Luce D'Oro API] Server running on http://localhost:${PORT}`);
  console.log(`[Luce D'Oro Security] Owner Authorized: ${AUTHORIZED_OWNER.name} <${AUTHORIZED_OWNER.email}>`);
  // A chave só é exibida enquanto ainda não foi usada (cadastro do dono pendente).
  const chave = getOrCreateOwnerSetupKey();
  const usada = db.prepare('SELECT is_used FROM owner_setup_tokens WHERE token = ?').get(chave) as { is_used: number } | undefined;
  if (!usada || usada.is_used !== 1) console.log(`[Luce D'Oro Security] Owner Setup Key: ${chave}`);
  else console.log("[Luce D'Oro Security] Cadastro do dono já concluído.");
});
