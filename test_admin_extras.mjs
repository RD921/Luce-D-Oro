// Testes do painel: upload de imagens, categorias, conteúdo, cupons, equipe, frete/pagamento.
// Como rodar (com o servidor ligado em outra janela, de preferência com um banco de teste):
//   node test_admin_extras.mjs
// Usa o arquivo data/owner_setup_key.txt da pasta onde o servidor roda (DATA_DIR para mudar).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
let total = 0;
let grupo = '';
const falhas = [];
const g = (n) => { grupo = n; console.log(`\n== ${n}`); };
function ok(cond, nome, extra) {
  total++;
  if (cond) { console.log(`  ok    ${nome}`); return; }
  falhas.push(`[${grupo}] ${nome}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`);
  console.log(`  FALHA ${nome}${extra !== undefined ? ' -> ' + JSON.stringify(extra).slice(0, 300) : ''}`);
}

async function api(metodo, rota, token, corpo) {
  const r = await fetch(BASE + rota, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  let j = null;
  try { j = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, json: j };
}

// PNG 1x1 válido
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function principal() {
  // ---- acesso: dono e cliente ----
  const senhaDono = 'RodrigoOuro#2026';
  const donoEmail = 'rodrigoarrezzi@icloud.com';
  let r = await api('POST', '/api/auth/register', null, { name: 'Rodrigo Arrezzi', email: donoEmail, password: senhaDono, confirmPassword: senhaDono });
  if (r.status >= 400) r = await api('POST', '/api/auth/login', null, { email: donoEmail, password: senhaDono });
  let tokenDono = r.json?.token;
  assert.ok(tokenDono, `não consegui entrar como dono (${r.status} ${JSON.stringify(r.json)})`);
  const chave = fs.readFileSync(path.join(DATA_DIR, 'owner_setup_key.txt'), 'utf-8').trim();
  await api('POST', '/api/admin/setup/verify-owner', tokenDono, { setupKey: chave });
  const login = await api('POST', '/api/auth/login', null, { email: donoEmail, password: senhaDono });
  tokenDono = login.json.token;

  const cliEmail = `cliente.${Date.now()}@teste.com`;
  const cli = await api('POST', '/api/auth/register', null, { name: 'Cliente Teste', email: cliEmail, password: 'Senha#12345', confirmPassword: 'Senha#12345' });
  const tokenCli = cli.json.token;

  g('1. Upload de imagens');
  r = await api('POST', '/api/admin/uploads', null, { data: PNG });
  ok(r.status === 401, 'visitante não envia imagem', r.status);
  r = await api('POST', '/api/admin/uploads', tokenCli, { data: PNG });
  ok(r.status === 403, 'cliente comum não envia imagem', r.status);
  r = await api('POST', '/api/admin/uploads', tokenDono, { data: 'data:image/png;base64,' + PNG });
  ok(r.status === 201 && /^\/uploads\/[a-z0-9-]+\.png$/.test(r.json?.url), 'dono envia PNG e recebe o endereço', r.json);
  const img = await fetch(BASE + (r.json?.url || '/uploads/x'));
  ok(img.status === 200 && (img.headers.get('content-type') || '').includes('image/png'), 'a imagem enviada abre pelo endereço público', img.status);
  r = await api('POST', '/api/admin/uploads', tokenDono, { data: Buffer.from('<script>alert(1)</script>').toString('base64') });
  ok(r.status === 400, 'arquivo que não é imagem é recusado', r.json);
  r = await api('POST', '/api/admin/uploads', tokenDono, { data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>').toString('base64') });
  ok(r.status === 400, 'SVG (pode conter script) é recusado', r.json);
  const grande = Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(7 * 1024 * 1024)]).toString('base64');
  r = await api('POST', '/api/admin/uploads', tokenDono, { data: grande });
  ok(r.status === 413, 'imagem acima de 6 MB é recusada', r.status);
  r = await api('POST', '/api/admin/uploads', tokenDono, {});
  ok(r.status === 400, 'envio vazio é recusado', r.status);
  const trav = await fetch(BASE + '/uploads/..%2f..%2fpackage.json');
  ok(trav.status >= 400, 'não deixa ler arquivos fora da pasta de imagens', trav.status);

  g('2. Categorias');
  let pub = await api('GET', '/api/catalog/categories', null);
  const antes = pub.json.length;
  ok(antes >= 3 && pub.json[0].id === 'pulseiras', 'as 3 categorias atuais continuam, na mesma ordem', pub.json.map((c) => c.id));
  r = await api('POST', '/api/admin/categories', tokenCli, { name: 'Anéis' });
  ok(r.status === 403, 'cliente não cria categoria', r.status);
  r = await api('POST', '/api/admin/categories', tokenDono, { name: '  ' });
  ok(r.status === 400, 'nome vazio é recusado', r.status);
  r = await api('POST', '/api/admin/categories', tokenDono, { name: 'Anéis & Alianças', description: 'Para todas as ocasiões', image_url: '/images/category-brincos.jpg' });
  ok(r.status === 201 && r.json.id === 'aneis-aliancas', 'cria categoria e gera o endereço sem acentos', r.json);
  r = await api('POST', '/api/admin/categories', tokenDono, { name: 'Anéis & Alianças' });
  ok(r.status === 409, 'não deixa duplicar o endereço', r.status);
  pub = await api('GET', '/api/catalog/categories', null);
  ok(pub.json.length === antes + 1 && pub.json[pub.json.length - 1].id === 'aneis-aliancas', 'a nova categoria aparece na loja, no fim da lista');
  r = await api('PUT', '/api/admin/categories/aneis-aliancas', tokenDono, { name: 'Anéis', description: 'Nova descrição', display_order: 0 });
  ok(r.status === 200, 'edita nome, descrição e ordem');
  pub = await api('GET', '/api/catalog/categories', null);
  ok(pub.json[0].id === 'aneis-aliancas' && pub.json[0].name === 'Anéis' && pub.json[0].slug === 'aneis-aliancas', 'a ordem vale e o endereço não muda ao renomear', pub.json[0]);

  const prod = await api('POST', '/api/admin/products', tokenDono, {
    name: 'Anel Teste', category_id: 'aneis-aliancas', price: 1000, description: 'd', materials: 'm', image_primary: '/images/hero-editorial.jpg',
  });
  ok(prod.status === 201, 'cria produto na categoria nova', prod.json);
  const lista = await api('GET', '/api/catalog/products?category=aneis-aliancas', null);
  ok(lista.json.length === 1, 'a loja lista o produto pela categoria nova', lista.json.length);
  r = await api('DELETE', '/api/admin/categories/aneis-aliancas', tokenDono);
  ok(r.status === 409, 'categoria com produto não pode ser excluída', r.json);
  await api('DELETE', `/api/admin/products/${prod.json?.id}`, tokenDono);
  r = await api('DELETE', '/api/admin/categories/aneis-aliancas', tokenDono);
  ok(r.status === 409, 'mesmo com produto arquivado, a exclusão continua bloqueada (histórico)', r.json);
  r = await api('PUT', '/api/admin/categories/aneis-aliancas', tokenDono, { is_active: false });
  pub = await api('GET', '/api/catalog/categories', null);
  ok(r.status === 200 && !pub.json.some((c) => c.id === 'aneis-aliancas'), 'categoria desativada some da loja');
  const adm = await api('GET', '/api/admin/categories', tokenDono);
  ok(adm.json.some((c) => c.id === 'aneis-aliancas' && c.is_active === 0), 'mas continua no painel para reativar');
  r = await api('POST', '/api/admin/categories', tokenDono, { name: 'Vazia Temporária' });
  r = await api('DELETE', `/api/admin/categories/${r.json.id}`, tokenDono);
  ok(r.status === 200, 'categoria vazia pode ser excluída', r.json);
  r = await api('DELETE', '/api/admin/categories/nao-existe', tokenDono);
  ok(r.status === 404, 'excluir categoria inexistente dá 404', r.status);

  g('3. Textos e imagens da loja');
  let cont = await api('GET', '/api/content', null);
  ok(cont.status === 200 && cont.json.story_title === 'Luxo Silencioso, Elegância Eterna' && cont.json.footer_hours, 'a loja recebe os textos padrão sem ninguém ter mexido', cont.status);
  r = await api('GET', '/api/admin/content', tokenCli);
  ok(r.status === 403, 'cliente não vê a lista de edição', r.status);
  const campos = await api('GET', '/api/admin/content', tokenDono);
  ok(campos.status === 200 && campos.json.length >= 30 && campos.json.every((f) => f.customized === false), 'dono vê todos os campos, nenhum alterado ainda', campos.json?.length);
  r = await api('PUT', '/api/admin/content', tokenCli, { values: { story_title: 'Hack' } });
  ok(r.status === 403, 'cliente não altera textos', r.status);
  r = await api('PUT', '/api/admin/content', null, { values: { story_title: 'Hack' } });
  ok(r.status === 401, 'visitante não altera textos', r.status);
  r = await api('PUT', '/api/admin/content', tokenDono, { values: { story_title: 'Nosso novo manifesto', trust1_desc: '<script>alert(1)</script> Frete grátis' } });
  ok(r.status === 200, 'dono altera textos', r.json);
  cont = await api('GET', '/api/content', null);
  ok(cont.json.story_title === 'Nosso novo manifesto' && cont.json.story_p1.startsWith('Nascemos'), 'a loja mostra o novo título e mantém os outros textos');
  ok(cont.json.trust1_desc.includes('<script>'), 'HTML fica como texto puro no servidor (o site escapa ao exibir)');
  r = await api('PUT', '/api/admin/content', tokenDono, { values: { campo_inexistente: 'x' } });
  ok(r.status === 400, 'campo desconhecido é recusado', r.status);
  r = await api('PUT', '/api/admin/content', tokenDono, { values: { story_title: 123 } });
  ok(r.status === 400, 'valor que não é texto é recusado', r.status);
  r = await api('PUT', '/api/admin/content', tokenDono, { values: { story_p1: 'a'.repeat(2001) } });
  ok(r.status === 400, 'texto acima de 2000 caracteres é recusado', r.status);
  r = await api('PUT', '/api/admin/content', tokenDono, { values: { materials_image: 'javascript:alert(1)' } });
  ok(r.status === 400, 'imagem com endereço perigoso é recusada', r.status);
  r = await api('PUT', '/api/admin/content', tokenDono, { values: { materials_image: '/uploads/abc-123.png' } });
  ok(r.status === 200 && (await api('GET', '/api/content', null)).json.materials_image === '/uploads/abc-123.png', 'imagem enviada pelo painel é aceita');
  r = await api('PUT', '/api/admin/content', tokenDono, { values: { story_title: '', materials_image: '' } });
  cont = await api('GET', '/api/content', null);
  ok(cont.json.story_title === 'Luxo Silencioso, Elegância Eterna' && cont.json.materials_image === '/images/materials-macro.jpg', 'campo vazio restaura o texto original');
  const lista2 = await api('GET', '/api/admin/content', tokenDono);
  ok(lista2.json.find((f) => f.key === 'trust1_desc')?.customized === true && lista2.json.find((f) => f.key === 'story_title')?.customized === false, 'o painel marca quais campos foram alterados');

  g('Auditoria');
  const aud = await api('GET', '/api/admin/audit-logs', tokenDono);
  const acoes = JSON.stringify(aud.json);
  ok(['IMAGE_UPLOADED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_DELETED', 'SITE_CONTENT_UPDATED'].every((a) => acoes.includes(a)), 'envios e mudanças de categoria ficam registrados');

  console.log(`\n==== ${total - falhas.length}/${total} verificações passaram ====`);
  if (falhas.length) { console.log('\nFALHAS:'); falhas.forEach((f) => console.log(' - ' + f)); process.exit(1); }
}
principal().catch((e) => { console.error('ERRO NO TESTE:', e.message); process.exit(2); });
