import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { db, initDatabase, AUTHORIZED_OWNER, getOrCreateOwnerSetupKey } from './db.js';
import { registerAdminExtras } from './adminExtras.js';
import { registerAdminMedia } from './adminMedia.js';
import { migrarSites, resolverSiteAdmin, registerSites } from './sites.js';
import { registerAdminSettingsExtras } from './adminSettingsExtras.js';
import { registerSiteContent } from './siteContent.js';
import { registerAdminCatalog } from './adminCatalog.js';
import { registerAdminCommerce } from './adminCommerce.js';
import { registerAdminArchitecture } from './adminArchitecture.js';
import { cabecalhosSeguranca, origemPermitida } from './seguranca.js';
import { registerAdminTeam, criarPainel } from './adminTeam.js';
import { authMiddleware, ownerAuthMiddleware } from './auth.js';
import { registerRotasAuth } from './rotas/auth.js';
import { registerRotasProprietario } from './rotas/proprietario.js';
import { registerCatalogoPublico } from './rotas/catalogoPublico.js';
import { registerCarrinho } from './rotas/carrinho.js';
import { registerPedidos } from './rotas/pedidos.js';
import { registerAdminDashboard } from './rotas/adminDashboard.js';
import { registerAdminProdutos } from './rotas/adminProdutos.js';
import { registerAdminPedidos } from './rotas/adminPedidos.js';
import { registerAdminEstoque } from './rotas/adminEstoque.js';
import { registerAdminBanners } from './rotas/adminBanners.js';
import { registerSistema } from './rotas/sistema.js';
import { registerAdminClientes } from './rotas/adminClientes.js';

initDatabase();
migrarSites();

const app = express();
app.disable('x-powered-by');
const PORT = 3001;

app.use(cabecalhosSeguranca);
app.use(
  cors({
    origin: origemPermitida,
    credentials: true,
  })
);

// O upload de imagens tem leitor próprio (aceita arquivos maiores), por isso é pulado aqui
app.use((req, res, next) => (req.path === '/api/admin/uploads' || req.path.startsWith('/api/admin/media') ? next() : express.json()(req, res, next)));
app.use(cookieParser());
app.use('/api/admin', resolverSiteAdmin);

// Rotas públicas, de conta e da loja
registerRotasAuth(app);
registerRotasProprietario(app);
registerCatalogoPublico(app);
registerCarrinho(app);
registerPedidos(app);

// Áreas do painel (arquivos próprios)
const painel = criarPainel(authMiddleware as any);
registerAdminExtras(app, painel);
registerAdminMedia(app, painel);
registerSites(app, painel);
registerAdminSettingsExtras(app, painel);
registerSiteContent(app, painel);
registerAdminTeam(app, painel, ownerAuthMiddleware as any);
registerAdminCatalog(app, painel);
registerAdminCommerce(app, painel, ownerAuthMiddleware as any);
registerAdminArchitecture(app, painel);

// Rotas do painel
registerAdminDashboard(app, painel);
registerAdminProdutos(app, painel);
registerAdminPedidos(app, painel);
registerAdminEstoque(app, painel);
registerAdminBanners(app, painel);
registerSistema(app, painel);
registerAdminClientes(app, painel);

app.listen(PORT, () => {
  console.log(`[Luce D'Oro API] Server running on http://localhost:${PORT}`);
  console.log(`[Luce D'Oro Security] Owner Authorized: ${AUTHORIZED_OWNER.name} <${AUTHORIZED_OWNER.email}>`);
  // A chave só é exibida enquanto ainda não foi usada (cadastro do dono pendente).
  const chave = getOrCreateOwnerSetupKey();
  const usada = db.prepare('SELECT is_used FROM owner_setup_tokens WHERE token = ?').get(chave) as { is_used: number } | undefined;
  if (!usada || usada.is_used !== 1) console.log(`[Luce D'Oro Security] Owner Setup Key: ${chave}`);
  else console.log("[Luce D'Oro Security] Cadastro do dono já concluído.");
});
