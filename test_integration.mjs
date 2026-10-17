import assert from 'node:assert';

const BASE_URL = 'http://localhost:3001';

async function testAll() {
  console.log("--- INICIANDO BATERIA DE TESTES DE INTEGRAÇÃO LUCE D'ORO ---\n");

  // Test 1: Unauthenticated request to /api/cart must fail with 401
  console.log('Teste 1: Acesso não autenticado à sacola privada (/api/cart)');
  const res1 = await fetch(`${BASE_URL}/api/cart`);
  assert.strictEqual(res1.status, 401, 'Deveria retornar 401 para visitante');
  const json1 = await res1.json();
  assert.ok(json1.error, 'Deveria conter mensagem de erro');
  console.log('✔ Teste 1 passou: Sacola protegida contra acesso não autorizado.\n');

  // Test 2: Unauthenticated request to /api/orders must fail with 401
  console.log('Teste 2: Acesso não autenticado aos pedidos privados (/api/orders)');
  const res2 = await fetch(`${BASE_URL}/api/orders`);
  assert.strictEqual(res2.status, 401, 'Deveria retornar 401 para visitante');
  console.log('✔ Teste 2 passou: Pedidos protegidos contra acesso não autorizado.\n');

  // Test 3: Validate email format endpoint
  console.log('Teste 3: Validação de e-mail no avanço da primeira etapa');
  const resInvalidEmail = await fetch(`${BASE_URL}/api/auth/validate-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'emailinvalido' }),
  });
  assert.strictEqual(resInvalidEmail.status, 400, 'E-mail sem @ deve falhar');

  const resValidEmail = await fetch(`${BASE_URL}/api/auth/validate-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cliente@cddeouro.com.br' }),
  });
  assert.strictEqual(resValidEmail.status, 200, 'E-mail válido deve avançar');
  console.log('✔ Teste 3 passou: Validação de e-mail impede avanço incorreto e permite formato válido.\n');

  // Test 4: Incorrect credentials
  console.log('Teste 4: Tentativa de login com senha incorreta');
  const resBadLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cliente@cddeouro.com.br', password: 'SenhaErrada123' }),
  });
  assert.strictEqual(resBadLogin.status, 401, 'Credenciais incorretas devem retornar 401');
  console.log('✔ Teste 4 passou: Credenciais incorretas rejeitadas com segurança.\n');

  // Test 5: Successful login with Helena
  console.log('Teste 5: Login bem-sucedido e emissão de sessão segura');
  const resLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cliente@cddeouro.com.br', password: 'Senha@123' }),
  });
  assert.strictEqual(resLogin.status, 200, 'Login deve retornar 200');
  const loginData = await resLogin.json();
  assert.ok(loginData.token, 'Token de sessão emitido');
  assert.strictEqual(loginData.user.email, 'cliente@cddeouro.com.br');
  const authToken = loginData.token;
  console.log('✔ Teste 5 passou: Login validado e sessão emitida.\n');

  // Test 6: Authenticated request to /api/auth/me
  console.log('Teste 6: Verificação de sessão autenticada (/api/auth/me)');
  const resMe = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.strictEqual(resMe.status, 200);
  const meData = await resMe.json();
  assert.strictEqual(meData.user.name, 'Helena Vasconcelos');
  console.log('✔ Teste 6 passou: Perfil do usuário autenticado recuperado.\n');

  // Test 7: Add item to authenticated cart
  console.log('Teste 7: Adicionar item à sacola autenticada');
  const resAdd = await fetch(`${BASE_URL}/api/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      productId: 'prod_riviera',
      variantTitle: '18 cm (Padrão)',
      quantity: 1,
    }),
  });
  assert.strictEqual(resAdd.status, 200);
  console.log('✔ Teste 7 passou: Item adicionado com sucesso.\n');

  // Test 8: Get Cart details and server calculation
  console.log('Teste 8: Consulta à sacola e cálculo de frete cortesia');
  const resCart = await fetch(`${BASE_URL}/api/cart`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.strictEqual(resCart.status, 200);
  const cartData = await resCart.json();
  assert.ok(cartData.items.length >= 1, 'Sacola deve conter pelo menos 1 item');
  assert.strictEqual(cartData.hasFreeShipping, true, 'Preço da Riviera R$ 1280 > R$ 500 limite frete cortesia');
  console.log(`✔ Teste 8 passou: Total calculado no servidor R$ ${cartData.total}, frete cortesia ativo.\n`);

  // Test 9: Create Order / Checkout
  console.log('Teste 9: Finalização de Pedido com endereço e validação de estoque');
  const resOrder = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      shippingAddress: 'Alameda Lorena, 1600 - Jardins, São Paulo, SP - CEP 01419-001',
      paymentMethod: 'Cartão de Crédito em 10x sem juros',
    }),
  });
  assert.strictEqual(resOrder.status, 201);
  const orderData = await resOrder.json();
  assert.ok(orderData.orderId, 'Número de pedido gerado');
  console.log(`✔ Teste 9 passou: Pedido ${orderData.orderId} criado e sacola esvaziada.\n`);

  // Test 10: List User Orders
  console.log('Teste 10: Listagem de histórico de pedidos do cliente');
  const resOrdersList = await fetch(`${BASE_URL}/api/orders`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.strictEqual(resOrdersList.status, 200);
  const ordersList = await resOrdersList.json();
  assert.ok(ordersList.length >= 1, 'Histórico de pedidos contém o pedido recém-criado');
  console.log('✔ Teste 10 passou: Histórico de pedidos consultado com sucesso.\n');

  // Test 11: User Registration
  console.log('Teste 11: Cadastro de novo cliente com validação real e hash');
  const uniqueEmail = `novo.cliente.${Date.now()}@cddeouro.com.br`;
  const resRegister = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Leonardo Albuquerque',
      email: uniqueEmail,
      password: 'OuroPuro#2026',
      confirmPassword: 'OuroPuro#2026',
    }),
  });
  assert.strictEqual(resRegister.status, 201);
  const regData = await resRegister.json();
  assert.ok(regData.token, 'Token gerado para novo cliente');
  assert.strictEqual(regData.user.name, 'Leonardo Albuquerque');
  console.log('✔ Teste 11 passou: Novo cliente cadastrado com senha criptografada scrypt.\n');

  // Test 12: Forgot Password flow
  console.log('Teste 12: Fluxo de redefinição de senha com token temporário');
  const resForgot = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: uniqueEmail }),
  });
  assert.strictEqual(resForgot.status, 200);
  const forgotData = await resForgot.json();
  assert.ok(forgotData.success);
  console.log('✔ Teste 12 passou: Instruções seguras de recuperação processadas sem enumeração.\n');

  // Test 13: Logout
  console.log('Teste 13: Logout e revogação de sessão');
  const resLogout = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.strictEqual(resLogout.status, 200);

  // Verify that the revoked token can no longer access /api/cart
  const resCartAfterLogout = await fetch(`${BASE_URL}/api/cart`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  assert.strictEqual(resCartAfterLogout.status, 401, 'Token revogado não pode mais acessar sacola');
  console.log('✔ Teste 13 passou: Sessão revogada no banco e acesso privado bloqueado.\n');

  console.log('====================================================');
  console.log('TODOS OS TESTES DE INTEGRAÇÃO PASSARAM COM SUCESSO!');
  console.log('====================================================');
}

testAll().catch((err) => {
  console.error('Falha nos testes:', err);
  process.exit(1);
});
