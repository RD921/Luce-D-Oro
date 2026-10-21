// Permissões da Arquitetura: dev vê tudo menos Equipe; gerente e cliente não passam.
// Uso: com o servidor rodando num banco de teste que já tenha dev@x.com / g@x.com / c@x.com (ver scripts/preparar-lancamento.mjs).
const base = 'http://localhost:3001';
const login = async (email, password) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const status = async (t, rota) => (await fetch(`${base}/api/admin/${rota}`, { headers: { Authorization: `Bearer ${t}` } })).status;
const esperado = { dev: { 'architecture/overview': 200, settings: 200, 'audit-logs': 200, 'payment-methods': 200, team: 403 }, gerente: { 'architecture/overview': 403, settings: 403, 'audit-logs': 403, 'payment-methods': 403, team: 403 } };
let falhas = 0;
for (const [quem, [email, senha]] of Object.entries({ dev: ['dev@x.com', 'Rodrigo_Dev_30'], gerente: ['g@x.com', 'Gerente#12345'] })) {
  const t = await login(email, senha);
  for (const [rota, cod] of Object.entries(esperado[quem])) { const s = await status(t, rota); if (s !== cod) { falhas++; console.log(`FALHOU ${quem} ${rota}: ${s} (esperado ${cod})`); } }
}
console.log(falhas ? `${falhas} falha(s)` : 'Permissões da Arquitetura OK');
process.exit(falhas ? 1 : 0);
