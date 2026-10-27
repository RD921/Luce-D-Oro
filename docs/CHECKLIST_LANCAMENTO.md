# Checklist de lançamento — Luce D'Oro

Estado conferido por testes automáticos (`test_*.mjs`) e por revisão. Itens marcados **[você]** dependem de decisão ou ação sua.

## Segurança (verificado)
- [x] Todas as rotas `/api/admin/*` recusam quem não fez login (401) e cliente comum (403) — varredura automática em `test_seguranca.mjs`.
- [x] Permissões validadas no servidor, por área (dashboard, produtos, mídia, configurações, arquitetura...); Equipe só para o proprietário.
- [x] Upload: valida o conteúdo real (JPG/PNG/WEBP/GIF), recusa SVG/HTML disfarçado, limite de 8 MB, nome gerado pelo servidor (sem caminho do usuário), exclusão bloqueada se a imagem está em uso.
- [x] Imagens servidas com `nosniff` e política restritiva; pastas e arquivos internos não são expostos.
- [x] Cabeçalhos: `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, `COOP`; sem `X-Powered-By`; HSTS em produção com HTTPS.
- [x] CORS restrito: em produção só as origens de `CORS_ORIGINS`; localhost só em desenvolvimento.
- [x] Limite de tentativas erradas: login (8 por conta/IP e 40 por IP em 15 min) e chave do proprietário (5 em 15 min), com `Retry-After`.
- [x] Sessão em cookie `httpOnly` + `SameSite=Lax`; `/api/auth/me` não expõe senha/hash.
- [x] Auditoria de ações administrativas e central de notificações (segurança, avisos).
- [x] Dados de demonstração só são criados fora de produção.

## Antes de publicar **[você]**
- [ ] Definir `NODE_ENV=production`.
- [ ] Servir o site por **HTTPS** e definir `COOKIE_SECURE=1` (cookie só trafega por HTTPS).
- [ ] Definir `CORS_ORIGINS` com o endereço real do site, se a API ficar em outro endereço.
- [ ] Se houver proxy/CDN na frente (Render, Cloudflare...), configurar `trust proxy` para o limite de tentativas ver o IP real do visitante.
- [ ] **Disco persistente:** definir `DATA_DIR` (banco) e `UPLOAD_DIR` (imagens) para uma pasta de disco que sobrevive a deploys. Sem isso, em hospedagem de disco temporário, banco e imagens são apagados a cada deploy.
- [ ] **Backups** do `DATA_DIR` e `UPLOAD_DIR` (o painel não faz backup automático).
- [ ] Trocar a chave do proprietário se ela já foi exibida em algum lugar (apagar `data/` e reiniciar, apenas se não houver dados reais).
- [ ] Rodar `node scripts/preparar-lancamento.mjs --confirmar` para limpar dados de teste (faz backup antes).
- [ ] Em Configurações → SEO: informar o endereço do site e a imagem de compartilhamento; desmarcar "ocultar dos buscadores" só no dia do lançamento.
- [ ] Conferir contatos reais em Configurações → Geral.

## Limites conhecidos (não estão prontos)
- Pagamento online, e-mails automáticos de pedido e estatísticas de visitas **não estão integrados** (o painel mostra "Não integrada").
- A loja é de página única: sem endereços próprios por página; prévia de links no WhatsApp/Instagram pode não mostrar a imagem de SEO.
- Não há política de conteúdo (CSP) na loja; as fontes vêm do Google Fonts.
- Banco SQLite local: um servidor só. Vários sites/clientes (Fase 2) ainda não existem.
- Editor visual cobre textos e imagens da home e do rodapé; banners, categorias e produtos têm suas próprias abas.

## Como rodar os testes
Cada suíte deve rodar em um banco limpo (reinicie o servidor entre elas):
`test_seguranca`, `test_fase7`, `test_versoes`, `test_midia`, `test_arquitetura`, `test_fase3`, `test_fase3b`, `test_fase4`, `test_admin_extras`, `test_isolamento`.

## Vários sites (Fase 2)
- Cada site tem conteúdo, imagens, SEO, rascunhos e versões próprios; o site público é escolhido pelo domínio (Host).
- Cada loja tem produtos, categorias, banners, cupons, frete, pagamento e pedidos próprios (veja Fase 3).
- Para um cliente novo: Arquitetura → Sites e clientes → Adicionar site, e aponte o domínio dele para este servidor.

## Banco e backups
- O banco usa modo WAL: junto de `luce_d_oro.db` aparecem `-wal` e `-shm`. É normal; copie sempre o conjunto, ou use os backups prontos.
- Backup automático: na subida e a cada 24 h, em `DATA_DIR/backup-auto-AAAAMMDD-HHMMSS.db` (consistente, gerado por VACUUM INTO). Guarda os 14 mais recentes.
- Ajustes: `BACKUP_HORAS` (intervalo), `BACKUP_GUARDAR` (quantos manter), `BACKUP_DESLIGADO=1`.
- Os backups ficam no mesmo disco do banco. Em produção, copie-os também para fora do servidor.
- O pedido é gravado em transação: se algo falhar no meio, nada fica salvo e o estoque não muda.

## Regras de negócio (camada de serviços)
- `server/servicos/` guarda regras sem Express. Migrados: checkout, sacola, produtos, estoque e cupons (`servicos/*.ts`). As rotas só leem a requisição e devolvem a resposta.
- Teste direto, sem subir a API: `DATA_DIR=<cópia do banco limpo> npx tsx test_servicos.ts`.

## Lojas independentes (Fase 3)
- Etapa 1 pronta: as tabelas comerciais (categorias, produtos, banners, cupons, frete, pagamento, pedidos, auditoria, notificações e usuários) têm `site_id`. Tudo o que existia ficou na loja principal; o proprietário fica sem loja (vê todas).
- A migração roda sozinha na subida, só se faltar coluna, e antes cria `data/backup-pre-lojas-AAAAMMDD-HHMMSS.db`. Esse backup nunca é apagado sozinho. Para voltar atrás: pare o servidor e restaure esse arquivo como `luce_d_oro.db`.
- Etapas 2 e 3 prontas: painel (X-Site-Id) e vitrine (Host) só enxergam e só alteram dados da própria loja: produtos, estoque, variações, categorias, banners, cupons, frete, pagamento, pedidos, sacola, checkout, mídia e dashboard. Códigos de cupom e endereços de categoria podem se repetir entre lojas.
- Categorias de lojas novas têm id `<endereço>~<loja>` (o id é único no banco); na loja principal continua igual ao endereço.
- Etapa 4 pronta: contas por loja. O e-mail é único por loja (a tabela de usuários foi reconstruída, com backup `backup-pre-unicos-...`); cadastro, login e recuperação de senha valem só na loja do endereço acessado; a sessão de cliente/equipe só funciona no endereço da própria loja. Dono e desenvolvedor (role `owner`/`dev`) entram e atuam em qualquer loja; gerente, atendente e estoquista só na própria (o seletor mostra só ela).
- Ainda falta: o comprador de uma loja gerenciar a própria equipe (hoje a tela Equipe é só do proprietário, que escolhe a loja no seletor), e a loja nova nascer com tudo pronto (etapa 5). A auditoria ainda é global.
- Testes: `test_isolamento.mjs` (servidor limpo) e `DATA_DIR=<cópia de um banco antigo> npx tsx test_lojas.ts`.
