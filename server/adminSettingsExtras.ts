// Fase 7 — SEO, notificações e estado das integrações (somente verificações reais).
import type { Express, Request, Response, RequestHandler } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, logAudit } from './db.js';
import type { Area } from './adminTeam.js';
import { UPLOAD_DIR } from './adminExtras.js';

type U = { id: number; email: string };
const quem = (req: Request): U => (req as unknown as { user: U }).user;

const SEO_CHAVES = ['seo_title', 'seo_description', 'seo_og_image', 'seo_site_url', 'seo_noindex', 'seo_category_title'] as const;
type SeoChave = (typeof SEO_CHAVES)[number];
const SEO_PADRAO: Record<SeoChave, string> = {
  seo_title: "Luce D'Oro | Joalheria Contemporânea",
  seo_description: "Luce D'Oro — Joalheria contemporânea em ouro nobre. Descubra pulseiras, correntes e brincos esculpidos com sofisticação atemporal.",
  seo_og_image: '',
  seo_site_url: '',
  seo_noindex: '0',
  seo_category_title: "{categoria} | Luce D'Oro",
};

function lerSeo(): Record<SeoChave, string> {
  const rows = db.prepare("SELECT key, value FROM system_settings WHERE key LIKE 'seo_%'").all() as Array<{ key: string; value: string }>;
  const out = { ...SEO_PADRAO };
  for (const r of rows) if ((SEO_CHAVES as readonly string[]).includes(r.key)) out[r.key as SeoChave] = r.value;
  return out;
}

const imagemOk = (v: string) => /^\/(images|uploads)\/[\w./-]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v);
const urlSiteOk = (v: string) => /^https?:\/\/[^\s"'<>/]+(\/[^\s"'<>]*)?$/.test(v);

function validarSeo(b: Record<string, unknown>): { valores: Partial<Record<SeoChave, string>> } | { erro: string } {
  const valores: Partial<Record<SeoChave, string>> = {};
  for (const [k, bruto] of Object.entries(b)) {
    if (!(SEO_CHAVES as readonly string[]).includes(k)) return { erro: `Campo desconhecido: ${k}` };
    if (typeof bruto !== 'string') return { erro: `O campo ${k} precisa ser texto.` };
    const v = bruto.trim();
    if (k === 'seo_title' && v.length > 120) return { erro: 'O título do site passou de 120 caracteres.' };
    if (k === 'seo_description' && v.length > 320) return { erro: 'A descrição passou de 320 caracteres.' };
    if (k === 'seo_category_title') {
      if (v.length > 120) return { erro: 'O modelo de título das categorias passou de 120 caracteres.' };
      if (v && !v.includes('{categoria}')) return { erro: 'O modelo de título das categorias precisa conter {categoria}.' };
    }
    if (k === 'seo_og_image' && v && !imagemOk(v)) return { erro: 'A imagem de compartilhamento precisa ser uma foto da biblioteca ou um link https.' };
    if (k === 'seo_site_url' && v && !urlSiteOk(v)) return { erro: 'O endereço do site precisa começar com http:// ou https:// (ex.: https://lucedoro.com.br).' };
    if (k === 'seo_noindex' && v !== '0' && v !== '1') return { erro: 'Valor inválido para ocultar dos buscadores.' };
    valores[k as SeoChave] = v;
  }
  return { valores };
}

export function registerAdminSettingsExtras(app: Express, painel: (a: Area) => RequestHandler) {
  // ---------- SEO ----------
  // Público: o site lê isto para ajustar título, descrição e compartilhamento.
  app.get('/api/seo', (_req: Request, res: Response) => {
    const s = lerSeo();
    const v = (k: SeoChave) => s[k] || SEO_PADRAO[k];
    res.json({ title: v('seo_title'), description: v('seo_description'), ogImage: s.seo_og_image, siteUrl: s.seo_site_url, noindex: s.seo_noindex === '1', categoryTitle: v('seo_category_title') });
  });

  app.get('/robots.txt', (_req: Request, res: Response) => {
    const s = lerSeo();
    const linhas = ['User-agent: *', s.seo_noindex === '1' ? 'Disallow: /' : 'Disallow: /api/'];
    if (s.seo_noindex !== '1' && s.seo_site_url) linhas.push(`Sitemap: ${s.seo_site_url.replace(/\/$/, '')}/sitemap.xml`);
    res.type('text/plain').send(linhas.join('\n') + '\n');
  });

  // A loja é de página única (sem endereços próprios por página): o mapa lista só a página inicial.
  app.get('/sitemap.xml', (_req: Request, res: Response) => {
    const s = lerSeo();
    if (!s.seo_site_url || s.seo_noindex === '1') { res.status(404).type('text/plain').send('Sitemap indisponível: defina o endereço do site em Configurações → SEO.'); return; }
    const loc = s.seo_site_url.replace(/\/$/, '') + '/';
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${loc}</loc></url>\n</urlset>\n`);
  });

  app.get('/api/admin/seo', painel('configuracoes'), (_req: Request, res: Response) => { res.json({ valores: lerSeo(), padrao: SEO_PADRAO }); });

  app.put('/api/admin/seo', painel('configuracoes'), (req: Request, res: Response) => {
    const r = validarSeo((req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>);
    if ('erro' in r) { res.status(400).json({ error: r.erro }); return; }
    const up = db.prepare("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP");
    for (const [k, v] of Object.entries(r.valores)) up.run(k, v as string);
    const u = quem(req);
    logAudit({ userId: u.id, userEmail: u.email, action: 'SEO_UPDATED', entity: 'SETTINGS', details: { campos: Object.keys(r.valores) } });
    res.json({ success: true, valores: lerSeo() });
  });

  // ---------- Notificações ----------
  const cursor = (id: number) => ((db.prepare('SELECT last_read_id FROM admin_notification_cursor WHERE user_id = ?').get(id) as { last_read_id: number } | undefined)?.last_read_id ?? 0);

  app.get('/api/admin/notifications', painel('dashboard'), (req: Request, res: Response) => {
    const u = quem(req);
    const lido = cursor(u.id);
    const limite = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const tipo = String(req.query.tipo || '');
    const itens = (tipo
      ? db.prepare('SELECT id, tipo, titulo, mensagem, user_email, created_at FROM admin_notifications WHERE tipo = ? ORDER BY id DESC LIMIT ?').all(tipo, limite)
      : db.prepare('SELECT id, tipo, titulo, mensagem, user_email, created_at FROM admin_notifications ORDER BY id DESC LIMIT ?').all(limite)) as Array<{ id: number }>;
    const naoLidas = (db.prepare('SELECT COUNT(*) AS n FROM admin_notifications WHERE id > ?').get(lido) as { n: number }).n;
    res.json({ itens: itens.map((i) => ({ ...i, lida: i.id <= lido })), naoLidas });
  });

  app.post('/api/admin/notifications/read', painel('dashboard'), (req: Request, res: Response) => {
    const u = quem(req);
    const max = (db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM admin_notifications').get() as { m: number }).m;
    db.prepare('INSERT INTO admin_notification_cursor (user_id, last_read_id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_read_id = excluded.last_read_id').run(u.id, max);
    res.json({ success: true });
  });

  // ---------- Integrações: só o que dá para verificar de verdade ----------
  app.get('/api/admin/integrations', painel('configuracoes'), (_req: Request, res: Response) => {
    type Estado = 'ok' | 'falha' | 'atencao' | 'nao_integrada';
    const itens: Array<{ id: string; nome: string; estado: Estado; detalhe: string }> = [];
    const set = (k: string) => ((db.prepare('SELECT value FROM system_settings WHERE key = ?').get(k) as { value: string } | undefined)?.value || '').trim();

    try { db.prepare('SELECT 1').get(); itens.push({ id: 'banco', nome: 'Banco de dados', estado: 'ok', detalhe: 'SQLite respondendo.' }); }
    catch (e) { itens.push({ id: 'banco', nome: 'Banco de dados', estado: 'falha', detalhe: (e as Error).message }); }

    try {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const t = path.join(UPLOAD_DIR, `.teste-${crypto.randomBytes(4).toString('hex')}`);
      fs.writeFileSync(t, 'ok'); fs.unlinkSync(t);
      itens.push({ id: 'armazenamento', nome: 'Armazenamento de imagens', estado: 'ok', detalhe: 'Pasta de uploads com permissão de gravação.' });
    } catch (e) { itens.push({ id: 'armazenamento', nome: 'Armazenamento de imagens', estado: 'falha', detalhe: `Não foi possível gravar: ${(e as Error).message}` }); }

    const wa = set('contact_whatsapp').replace(/\D/g, '');
    itens.push({ id: 'whatsapp', nome: 'WhatsApp (link direto)', estado: wa.length >= 10 ? 'ok' : 'atencao', detalhe: wa.length >= 10 ? 'Número configurado; o site abre a conversa por link. Não usa a API oficial.' : 'Número de WhatsApp não configurado ou inválido (Configurações → Geral).' });
    const email = set('contact_email');
    itens.push({ id: 'email-contato', nome: 'E-mail de contato', estado: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'ok' : 'atencao', detalhe: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Endereço configurado e exibido no rodapé (abre o e-mail do visitante).' : 'E-mail de contato não configurado ou inválido.' });
    const insta = set('instagram');
    itens.push({ id: 'instagram', nome: 'Instagram (link)', estado: insta ? 'ok' : 'atencao', detalhe: insta ? `Perfil ${insta} configurado como link.` : 'Perfil do Instagram não configurado.' });

    let nEnvios = -1;
    try { nEnvios = (db.prepare('SELECT COUNT(*) AS n FROM shipping_methods WHERE is_active = 1').get() as { n: number }).n; } catch { /* sem a tabela */ }
    itens.push({ id: 'frete', nome: 'Entrega', estado: nEnvios > 0 ? 'ok' : nEnvios === 0 ? 'atencao' : 'nao_integrada', detalhe: nEnvios > 0 ? `${nEnvios} opção(ões) de entrega ativa(s), cadastradas manualmente. Sem cálculo automático por transportadora.` : nEnvios === 0 ? 'Nenhuma opção de entrega ativa.' : 'Opções de entrega não verificadas.' });

    itens.push({ id: 'pagamento', nome: 'Pagamento online', estado: 'nao_integrada', detalhe: 'Nenhum provedor (cartão, Pix automático) está conectado. As formas de pagamento cadastradas são informativas.' });
    itens.push({ id: 'email-transacional', nome: 'E-mails automáticos (pedidos)', estado: 'nao_integrada', detalhe: 'O servidor ainda não envia e-mails (confirmação de pedido, avisos).' });
    itens.push({ id: 'analytics', nome: 'Estatísticas de visitas', estado: 'nao_integrada', detalhe: 'Nenhuma ferramenta de análise (Google Analytics etc.) conectada.' });
    res.json({ verificadoEm: new Date().toISOString(), itens });
  });
}
