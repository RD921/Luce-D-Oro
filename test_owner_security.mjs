import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3001';

async function testSecurity() {
  console.log('--- INICIANDO TESTES DA REGRA CRÍTICA DE ACESSO DO PROPRIETÁRIO ---\n');

  // Test 1: Unauthenticated request to /api/admin/dashboard must return 401
  console.log('Teste 1: Visitante não autenticado tentando acessar /api/admin/dashboard');
  const res1 = await fetch(`${BASE_URL}/api/admin/dashboard`);
  assert.strictEqual(res1.status, 401, 'Visitante não autenticado deve receber 401');
  console.log('✔ Teste 1 passou: 401 Unauthorized para visitante.\n');

  // Test 2: Unauthenticated request to modify products must return 401
  console.log('Teste 2: Visitante tentando cadastrar produto diretamente');
  const res2 = await fetch(`${BASE_URL}/api/admin/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Produto Fake', price: 9999, category_id: 'pulseiras', image_primary: '/img.jpg' }),
  });
  assert.strictEqual(res2.status, 401, 'Tentativa de criar produto sem autenticação deve retornar 401');
  console.log('✔ Teste 2 passou: 401 Unauthorized ao tentar criar produto sem sessão.\n');

  // Test 3: Authenticated non-owner client (Helena) must receive 403 Forbidden on admin routes
  console.log('Teste 3: Cliente comum autenticado (Helena) tentando acessar /api/admin/dashboard');
  const loginHelena = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cliente@cddeouro.com.br', password: 'Senha@123' }),
  });
  const helenaData = await loginHelena.json();
  const helenaToken = helenaData.token;

  const res3 = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${helenaToken}` },
  });
  assert.strictEqual(res3.status, 403, 'Cliente Helena deve receber 403 Forbidden no admin');
  console.log('✔ Teste 3 passou: 403 Forbidden para conta de cliente comum.\n');

  // Test 4: Authenticated non-owner trying to alter settings, create products or adjust stock
  console.log('Teste 4: Cliente comum tentando alterar configurações e ajustar estoque');
  const res4 = await fetch(`${BASE_URL}/api/admin/settings`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${helenaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ store_name: 'Loja Hackeada' }),
  });
  assert.strictEqual(res4.status, 403, 'Tentativa de alterar configurações por cliente deve retornar 403');

  const resStockHack = await fetch(`${BASE_URL}/api/admin/stock/adjust`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${helenaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId: 'prod_riviera', quantityChange: 100, reason: 'Hack' }),
  });
  assert.strictEqual(resStockHack.status, 403, 'Ajuste de estoque por cliente deve retornar 403');
  console.log('✔ Teste 4 passou: 403 Forbidden em mutações de estoque e configurações.\n');

  // Test 5: Public registration cannot choose role 'owner' or 'admin'
  console.log('Teste 5: Registro público com tentativa de forçar role "owner" ou "admin"');
  const hackerEmail = `tentativa.owner.${Date.now()}@cddeouro.com.br`;
  const resReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tentativa Invasor',
      email: hackerEmail,
      password: 'SenhaForte#2026',
      confirmPassword: 'SenhaForte#2026',
      role: 'owner', // Injected role attempt
    }),
  });
  const regData = await resReg.json();
  assert.strictEqual(regData.user.role, 'customer', 'Cadastro público não pode conceder role owner');

  // Attempting admin dashboard with this newly registered account
  const resRegAdmin = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${regData.token}` },
  });
  assert.strictEqual(resRegAdmin.status, 403, 'Novo cadastro deve receber 403 Forbidden no admin');
  console.log('✔ Teste 5 passou: Cadastro público bloqueia role owner e retorna 403.\n');

  // Test 6: Non-owner trying to activate owner via /api/admin/setup/verify-owner
  console.log('Teste 6: Conta invasora tentando chamar /api/admin/setup/verify-owner');
  const resIllegalClaim = await fetch(`${BASE_URL}/api/admin/setup/verify-owner`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${helenaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ setupKey: 'CHAVE_QUALQUER' }),
  });
  assert.strictEqual(resIllegalClaim.status, 403, 'Apenas rodrigoarrezzi@icloud.com pode ativar a conta proprietária');
  console.log('✔ Teste 6 passou: 403 Forbidden para tentativa de ativação por e-mail não autorizado.\n');

  // Test 7: Verify owner setup key and activation for rodrigoarrezzi@icloud.com
  console.log('Teste 7: Procedimento seguro de inicialização para Rodrigo Arrezzi (rodrigoarrezzi@icloud.com)');
  const keyPath = path.resolve(process.cwd(), 'data', 'owner_setup_key.txt');
  const setupKey = fs.readFileSync(keyPath, 'utf-8').trim();
  assert.ok(setupKey.startsWith('CDOURO-OWNER-'), 'Chave de setup gerada com formato correto');

  // Reset setup key status and ensure Rodrigo starts as customer for activation test
  const { DatabaseSync } = await import('node:sqlite');
  const crypto = (await import('node:crypto')).default;
  const dbFile = fs.existsSync(path.resolve(process.cwd(), 'data', 'luce_d_oro.db')) ? 'luce_d_oro.db' : 'cd_de_ouro.db';
  const dbPath = path.resolve(process.cwd(), 'data', dbFile);
  const testDb = new DatabaseSync(dbPath);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync('RodrigoOuro#2026', salt, 64).toString('hex');
  testDb.prepare('UPDATE owner_setup_tokens SET is_used = 0 WHERE token = ?').run(setupKey);
  testDb.prepare("UPDATE users SET role = 'customer', password_hash = ?, salt = ? WHERE email = ?").run(
    hash,
    salt,
    'rodrigoarrezzi@icloud.com'
  );

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rodrigoarrezzi@icloud.com', password: 'RodrigoOuro#2026' }),
  });
  const loginData = await loginRes.json();
  const rodrigoToken = loginData.token;

  // Before activation, Rodrigo has role customer
  // Now activate owner role with setup key
  const resActivation = await fetch(`${BASE_URL}/api/admin/setup/verify-owner`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${rodrigoToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ setupKey }),
  });
  assert.strictEqual(resActivation.status, 200, 'Ativação do proprietário com a chave correta deve retornar 200');
  const actData = await resActivation.json();
  assert.strictEqual(actData.role, 'owner', 'Role deve ser atualizado para owner');
  console.log('✔ Teste 7 passou: Conta de Rodrigo Arrezzi ativada com sucesso como owner.\n');

  // Test 8: Authorized owner access to admin features
  console.log('Teste 8: Acesso integral do proprietário autorizado ao dashboard e endpoints');
  const resAdminDash = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${rodrigoToken}` },
  });
  assert.strictEqual(resAdminDash.status, 200, 'Rodrigo Arrezzi deve ter acesso 200 OK ao dashboard');
  const dashData = await resAdminDash.json();
  assert.ok(dashData.ordersCount !== undefined, 'Dashboard deve conter dados reais de pedidos');
  assert.ok(dashData.revenue !== undefined, 'Dashboard deve conter receita calculada');
  console.log(`✔ Teste 8 passou: Dashboard acessado com sucesso! Pedidos: ${dashData.ordersCount}, Receita: R$ ${dashData.revenue.toFixed(2)}.\n`);

  // Test 9: Owner manages catalog (Create, update stock, audit log)
  console.log('Teste 9: Operações administrativas reais (Cadastro de produto, ajuste de estoque, auditoria)');
  const resCreateProd = await fetch(`${BASE_URL}/api/admin/products`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${rodrigoToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Anel Solitário Imperial Ouro 18k',
      category_id: 'brincos',
      price: 2450.0,
      cost_price: 680.0,
      stock: 7,
      description: 'Anel solitário com diamante lapidação brilhante forjado em ouro amarelo 18k.',
      materials: 'Ouro 18k e diamante 50 pontos',
      image_primary: '/images/hero-editorial.jpg',
      is_featured: 1,
    }),
  });
  assert.strictEqual(resCreateProd.status, 201, 'Criação de produto deve retornar 201');
  const createProdData = await resCreateProd.json();
  const newProdId = createProdData.id;

  // Stock adjustment
  const resStockAdj = await fetch(`${BASE_URL}/api/admin/stock/adjust`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${rodrigoToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId: newProdId,
      quantityChange: 5,
      reason: 'Entrada de lote de atelier de ourivesaria',
    }),
  });
  assert.strictEqual(resStockAdj.status, 200, 'Ajuste de estoque deve retornar 200');

  // Verify Audit Log
  const resAudit = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
    headers: { Authorization: `Bearer ${rodrigoToken}` },
  });
  assert.strictEqual(resAudit.status, 200, 'Consulta a logs de auditoria deve retornar 200');
  const logs = await resAudit.json();
  assert.ok(logs.length > 0, 'Audit logs devem conter os registros das ações do proprietário');
  console.log(`✔ Teste 9 passou: Produto criado, estoque ajustado e audit log registrado (${logs.length} eventos).\n`);

  // Test 10: Setup key cannot be reused
  console.log('Teste 10: Garantia de uso único da chave de setup (impedir reutilização)');
  const resReuse = await fetch(`${BASE_URL}/api/admin/setup/verify-owner`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${rodrigoToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ setupKey }),
  });
  assert.strictEqual(resReuse.status, 400, 'Chave de ativação já utilizada deve ser rejeitada');
  console.log('✔ Teste 10 passou: Chave de setup invalidada após primeiro uso.\n');

  console.log('================================================================');
  console.log('TODOS OS 10 TESTES DE SEGURANÇA E ACESSO DO PROPRIETÁRIO PASSARAM!');
  console.log('================================================================');
}

testSecurity().catch((err) => {
  console.error('❌ ERRO NO TESTE DE SEGURANÇA:', err);
  process.exit(1);
});
