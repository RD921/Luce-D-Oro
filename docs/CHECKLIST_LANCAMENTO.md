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
`test_seguranca`, `test_fase7`, `test_versoes`, `test_midia`, `test_arquitetura`, `test_fase3`, `test_fase3b`, `test_fase4`, `test_admin_extras`.

## Vários sites (Fase 2)
- Cada site tem conteúdo, imagens, SEO, rascunhos e versões próprios; o site público é escolhido pelo domínio (Host).
- Produtos, pedidos, clientes e banners continuam compartilhados com a loja principal.
- Para um cliente novo: Arquitetura → Sites e clientes → Adicionar site, e aponte o domínio dele para este servidor.

## Banco e backups
- O banco usa modo WAL: junto de `luce_d_oro.db` aparecem `-wal` e `-shm`. É normal; copie sempre o conjunto, ou use os backups prontos.
- Backup automático: na subida e a cada 24 h, em `DATA_DIR/backup-auto-AAAAMMDD-HHMMSS.db` (consistente, gerado por VACUUM INTO). Guarda os 14 mais recentes.
- Ajustes: `BACKUP_HORAS` (intervalo), `BACKUP_GUARDAR` (quantos manter), `BACKUP_DESLIGADO=1`.
- Os backups ficam no mesmo disco do banco. Em produção, copie-os também para fora do servidor.
- O pedido é gravado em transação: se algo falhar no meio, nada fica salvo e o estoque não muda.
