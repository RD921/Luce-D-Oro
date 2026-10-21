import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'luce_d_oro.db');
export const db = new DatabaseSync(DB_PATH);

// Critical Rule: Authorized Owner Definition
export const AUTHORIZED_OWNER = {
  name: 'Rodrigo Arrezzi',
  email: 'rodrigoarrezzi@icloud.com',
  role: 'owner',
} as const;

// Helper for password hashing
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const derivedBuffer = Buffer.from(derived, 'hex');
    if (hashBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, derivedBuffer);
  } catch {
    return false;
  }
}

// Audit Log Helper
export function logAudit(data: {
  userId?: number | null;
  userEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, any>;
  ipAddress?: string | null;
}) {
  try {
    db.prepare(`
      INSERT INTO admin_audit_logs (user_id, user_email, action, entity, entity_id, details_json, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.userId || null,
      data.userEmail || null,
      data.action,
      data.entity,
      data.entityId || null,
      data.details ? JSON.stringify(data.details) : null,
      data.ipAddress || null
    );
  } catch (err) {
    console.error('[Audit Log Error]', err);
  }
}

// Generate or retrieve owner single-use setup key
export function getOrCreateOwnerSetupKey(): string {
  const keyPath = path.join(DB_DIR, 'owner_setup_key.txt');
  if (fs.existsSync(keyPath)) {
    const key = fs.readFileSync(keyPath, 'utf-8').trim();
    if (key) return key;
  }

  const newKey = `CDOURO-OWNER-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  fs.writeFileSync(keyPath, newKey, { encoding: 'utf-8' });

  db.prepare(`
    INSERT OR IGNORE INTO owner_setup_tokens (token, is_used) VALUES (?, 0)
  `).run(newKey);

  return newKey;
}

// Initialize tables and run migrations
export function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      is_verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id),
      price REAL NOT NULL,
      old_price REAL,
      cost_price REAL DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      description TEXT NOT NULL,
      materials TEXT NOT NULL,
      care_instructions TEXT NOT NULL,
      dimensions TEXT NOT NULL,
      warranty TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 10,
      is_featured INTEGER DEFAULT 0,
      image_primary TEXT NOT NULL,
      images_json TEXT NOT NULL,
      variants_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id),
      variant_title TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      UNIQUE(cart_id, product_id, variant_title)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Confirmado',
      shipping_address TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      tracking_code TEXT,
      internal_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      variant_title TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      image_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS banners (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      badge TEXT,
      cta_text TEXT,
      cta_link TEXT,
      image_desktop TEXT NOT NULL,
      image_mobile TEXT,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL COLLATE NOCASE,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      min_spend REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity_change INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reason TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS owner_setup_tokens (
      token TEXT PRIMARY KEY,
      is_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME
    );
  `);

  runMigrations();
  seedData();
  getOrCreateOwnerSetupKey();
}

function runMigrations() {
  const tableCols = (table: string) => {
    return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
  };

  try {
    const userCols = tableCols('users');
    if (!userCols.includes('is_verified')) {
      db.exec(`ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0`);
    }

    const prodCols = tableCols('products');
    if (!prodCols.includes('cost_price')) {
      db.exec(`ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0`);
    }
    if (!prodCols.includes('is_archived')) {
      db.exec(`ALTER TABLE products ADD COLUMN is_archived INTEGER DEFAULT 0`);
    }

    const orderCols = tableCols('orders');
    if (!orderCols.includes('tracking_code')) {
      db.exec(`ALTER TABLE orders ADD COLUMN tracking_code TEXT`);
    }
    if (!orderCols.includes('internal_notes')) {
      db.exec(`ALTER TABLE orders ADD COLUMN internal_notes TEXT`);
    }
  } catch (err) {
    console.error('[Migrations error - non fatal]', err);
  }
}

function seedData() {
  // Check if categories exist
  const catCount = (db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
  if (catCount === 0) {
    const insertCat = db.prepare('INSERT INTO categories (id, name, slug, description, image_url) VALUES (?, ?, ?, ?, ?)');
    insertCat.run('pulseiras', 'Pulseiras', 'pulseiras', 'Elegância e presença esculpidas em ouro nobre e design atemporal.', '/images/category-pulseiras.jpg');
    insertCat.run('correntes', 'Correntes', 'correntes', 'Elo por elo, sofisticação discreta para compor produções memoráveis.', '/images/category-correntes.jpg');
    insertCat.run('brincos', 'Brincos', 'brincos', 'O brilho sutil do ouro para iluminar a expressão com leveza e magnetismo.', '/images/category-brincos.jpg');
  }

  // Check if default users exist
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  // Contas de demonstração (senhas públicas no código): só em desenvolvimento, nunca em produção.
  if (userCount === 0 && process.env.NODE_ENV !== 'production') {
    const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, salt, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)');
    
    // Helena Vasconcelos: cliente@cddeouro.com.br / Senha@123
    const helena = hashPassword('Senha@123');
    const res1 = insertUser.run('Helena Vasconcelos', 'cliente@cddeouro.com.br', helena.hash, helena.salt, 'customer', 1);
    
    // Maria Beatriz Silva: maria@cddeouro.com.br / Ouro18k#2026
    const maria = hashPassword('Ouro18k#2026');
    insertUser.run('Maria Beatriz Silva', 'maria@cddeouro.com.br', maria.hash, maria.salt, 'customer', 1);

    // Create initial cart for Helena
    const helenaId = Number(res1.lastInsertRowid);
    db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run('cart_helena_001', helenaId);
  }

  // Check products
  const prodCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
  if (prodCount === 0) {
    const insertProd = db.prepare(`
      INSERT INTO products (
        id, name, slug, category_id, price, old_price, cost_price, is_archived, description, 
        materials, care_instructions, dimensions, warranty, stock, is_featured, 
        image_primary, images_json, variants_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Product 1: Pulseira Riviera Ouro 18k
    insertProd.run(
      'prod_riviera',
      'Pulseira Riviera Lumière Ouro 18k',
      'pulseira-riviera-lumiere-ouro-18k',
      'pulseiras',
      1280.00,
      1450.00,
      380.00,
      0,
      'A Pulseira Riviera Lumière é uma ode à elegância silenciosa. Forjada com acabamento primoroso em banho de 10 milésimos de Ouro 18k e cravada individualmente com zircônias cúbicas lapidação brilhante. Seu fecho gaveta com dupla trava de segurança garante conforto e segurança inabaláveis.',
      'Banho de Ouro 18k premium (10 milésimos), liga nobre hipoalergênica livre de níquel e cádmio, acabamento em verniz suíço nanocerâmico.',
      'Evite contato com perfumes, cremes e produtos químicos abrasivos. Limpe delicadamente com flanela mágica macia após o uso.',
      'Comprimento ajustável: 16cm, 18cm ou 20cm. Espessura: 2.8mm.',
      'Garantia vitalícia quanto ao teor do ouro e 1 ano contra defeitos de fabricação.',
      12,
      1,
      '/images/product-pulseira-riviera.jpg',
      JSON.stringify(['/images/product-pulseira-riviera.jpg', '/images/category-pulseiras.jpg', '/images/materials-macro.jpg']),
      JSON.stringify(['16 cm', '18 cm (Padrão)', '20 cm'])
    );

    // Product 2: Corrente Veneziana com Pingente Gota Orgânica
    insertProd.run(
      'prod_corrente_gota',
      'Corrente Veneziana com Pingente Gota Orgânica',
      'corrente-veneziana-pingente-gota-organica',
      'correntes',
      890.00,
      null,
      260.00,
      0,
      'Linhas fluidas e textura orgânica se encontram na Corrente Veneziana com Pingente Gota. Inspirada na natureza e esculpida à mão por nossos mestres ourives, a peça captura a luz de forma singular, proporcionando um visual contemporâneo e sofisticado.',
      'Ouro 18k 10 milésimos, corrente veneziana maciça, pingente de textura martelada orgânica, acabamento polido acetinado.',
      "Guarde separadamente no estojo aveludado Luce D'Oro para evitar atrito entre elos.",
      'Comprimento da corrente: 45cm + 5cm de extensor. Dimensões do pingente: 16mm x 11mm.',
      'Certificado de autenticidade e 1 ano de garantia total.',
      8,
      1,
      '/images/product-corrente-veneziana.jpg',
      JSON.stringify(['/images/product-corrente-veneziana.jpg', '/images/category-correntes.jpg', '/images/materials-macro.jpg']),
      JSON.stringify(['45 cm + extensor', '50 cm + extensor'])
    );

    // Product 3: Brinco Argola Bisotada Ouro 18k
    insertProd.run(
      'prod_brinco_argola',
      'Brinco Argola Bisotada Esculpida Ouro 18k',
      'brinco-argola-bisotada-ouro-18k',
      'brincos',
      640.00,
      720.00,
      190.00,
      0,
      'A sofisticação do clássico repensada com ângulos geométricos facetados. O Brinco Argola Bisotada reflete o fascínio da joalheria moderna, com fecho click anatômico invisível que se acomoda com total leveza ao lóbulo.',
      'Camada espessa de 10 milésimos de Ouro Amarelo 18k com tecnologia nanotecnológica anti-alérgica, tarraxa click de precisão.',
      'Armazene em local seco. Higienize com água morna e sabão neutro delicado a cada seis meses.',
      'Diâmetro: 22mm. Largura da haste: 3.5mm. Peso por brinco: 3.2g.',
      "Certificado de garantia de 1 ano Luce D'Oro.",
      15,
      1,
      '/images/category-brincos.jpg',
      JSON.stringify(['/images/category-brincos.jpg', '/images/materials-macro.jpg']),
      JSON.stringify(['Tamanho Médio (22mm)', 'Tamanho Grande (28mm)'])
    );

    // Product 4: Bracelete Rígido Minimalista Torcido
    insertProd.run(
      'prod_bracelete_torcido',
      'Bracelete Rígido Infinity Ouro 18k',
      'bracelete-rigido-infinity-ouro-18k',
      'pulseiras',
      950.00,
      null,
      280.00,
      0,
      'Estrutura escultural em formato de cuff rígido com extremidades arredondadas em ouro polido espelhado. Perfeito tanto para uso solo quanto para composições ousadas em pulseirismo.',
      'Ouro 18k com banho multicamadas e liga italiana resistente a deformações mecânicas.',
      'Evite quedas sobre superfícies duras para preservar o acabamento espelhado.',
      'Abertura anatômica flexível. Diâmetro interno: 60mm.',
      'Garantia de 1 ano com polimento cortesia durante a vigência.',
      6,
      0,
      '/images/category-pulseiras.jpg',
      JSON.stringify(['/images/category-pulseiras.jpg', '/images/hero-editorial.jpg']),
      JSON.stringify(['Ouro 18k Amarelo', 'Ouro Branco 18k'])
    );

    // Product 5: Choker Grumet Elo Português
    insertProd.run(
      'prod_choker_grumet',
      'Gargantilha Choker Elo Português Ouro 18k',
      'gargantilha-choker-elo-portugues-ouro-18k',
      'correntes',
      1120.00,
      1290.00,
      340.00,
      0,
      'Malha clássica de elos portugueses entrelaçados com brilho acetinado e toque aveludado na pele. Uma declaração de estilo puro e bom gosto indiscutível.',
      'Ouro 18k 10 milésimos com banho de verniz de proteção eletroforético.',
      'Armazenar estendido para não dobrar os elos.',
      'Comprimento: 40cm + 5cm extensor. Espessura dos elos: 4mm.',
      'Garantia de 1 ano e certificado de autenticidade.',
      9,
      0,
      '/images/category-correntes.jpg',
      JSON.stringify(['/images/category-correntes.jpg', '/images/materials-macro.jpg']),
      JSON.stringify(['40 cm', '45 cm'])
    );

    // Product 6: Brinco Ponto de Luz com Zircônia Flutuante
    insertProd.run(
      'prod_brinco_ponto_luz',
      'Brinco Ponto de Luz Flutuante Ouro 18k',
      'brinco-ponto-luz-flutuante-ouro-18k',
      'brincos',
      420.00,
      null,
      110.00,
      0,
      'O essencial em sua mais alta pureza. Um ponto de luz com zircônia cúbica lapidação 57 facetas presa por quatro garras minimalistas em ouro amarelo.',
      'Zircônia cúbica grau 5A (máxima pureza ótica) e banho de 10 milésimos de Ouro 18k.',
      'Limpeza com pano seco ou levemente umedecido.',
      'Diâmetro da pedra: 6mm.',
      "Garantia de 1 ano Luce D'Oro.",
      20,
      0,
      '/images/category-brincos.jpg',
      JSON.stringify(['/images/category-brincos.jpg', '/images/materials-macro.jpg']),
      JSON.stringify(['6 mm (Clássico)', '8 mm (Expressivo)'])
    );
  }

  // System settings
  const settingCount = (db.prepare('SELECT COUNT(*) as count FROM system_settings').get() as { count: number }).count;
  if (settingCount === 0) {
    const insertSetting = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)');
    insertSetting.run('store_name', "Luce D'Oro");
    insertSetting.run('store_tagline', 'Alta Joalheria Contemporânea');
    insertSetting.run('origin_cep', '01419-001');
    insertSetting.run('free_shipping_threshold', '500.00');
    insertSetting.run('announcement_banner', 'Frete cortesia para compras acima de R$ 500 para todo o Brasil');
    insertSetting.run('contact_email', 'rodrigoarrezzi@icloud.com');
    insertSetting.run('contact_phone', '+55 (11) 3088-2490');
    insertSetting.run('contact_whatsapp', '+55 (27) 99505-5702');
    insertSetting.run('instagram', '@lucedorojoalheria');
  }
  // Troca os dados de exemplo antigos pelos contatos reais (só se ainda estiverem com o valor de exemplo).
  const trocaContato = db.prepare('UPDATE system_settings SET value = ? WHERE key = ? AND value = ?');
  trocaContato.run('rodrigoarrezzi@icloud.com', 'contact_email', 'contato@cddeouro.com.br');
  trocaContato.run('+55 (27) 99505-5702', 'contact_whatsapp', '+55 (11) 98765-4321');
  trocaContato.run('@lucedorojoalheria', 'instagram', '@cddeouro.oficial');

  // Banners
  const bannerCount = (db.prepare('SELECT COUNT(*) as count FROM banners').get() as { count: number }).count;
  if (bannerCount === 0) {
    db.prepare(`
      INSERT INTO banners (id, title, subtitle, badge, cta_text, cta_link, image_desktop, is_active, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'banner_main_01',
      'Detalhes que contam a sua história.',
      'Joias forjadas em ouro nobre 18k com acabamento primoroso. O encontro harmonioso entre o luxo discreto e a autenticidade contemporânea.',
      'ALTA JOALHERIA CONTEMPORÂNEA',
      'Descubra a coleção',
      '#pulseiras',
      '/images/hero-editorial.jpg',
      1,
      0
    );
  }

  // Coupons
  const couponCount = (db.prepare('SELECT COUNT(*) as count FROM coupons').get() as { count: number }).count;
  if (couponCount === 0) {
    const insertCoupon = db.prepare(`
      INSERT INTO coupons (id, code, discount_type, discount_value, min_spend, is_active, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertCoupon.run('cp_bemvindo10', 'BEMVINDO10', 'percent', 10, 300, 1, 0);
    insertCoupon.run('cp_ouro150', 'OURO150', 'fixed', 150, 1000, 1, 0);
  }
}
