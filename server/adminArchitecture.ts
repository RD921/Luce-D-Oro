// Configurações → Arquitetura (Fase 1): visão geral técnica real da plataforma, só para proprietário e desenvolvedor.
// Tudo aqui é lido do sistema de verdade; o que ainda não foi verificado aparece como "não verificado", nunca como sucesso.
import type { Express, Request, Response, RequestHandler } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { db } from './db.js';
import { PAPEIS, type Area } from './adminTeam.js';
import { UPLOAD_DIR } from './adminExtras.js';

type Estado = 'ok' | 'falha' | 'nao_verificado' | 'atencao';
interface Verificacao { id: string; titulo: string; estado: Estado; detalhe: string }

const n = (sql: string, ...p: unknown[]): number => {
  try { return (db.prepare(sql).get(...(p as any[])) as { n: number }).n; } catch { return 0; }
};

function tamanhoPasta(dir: string): { arquivos: number; bytes: number } {
  let arquivos = 0; let bytes = 0;
  try {
    for (const nome of fs.readdirSync(dir)) {
      const st = fs.statSync(path.join(dir, nome));
      if (st.isFile()) { arquivos++; bytes += st.size; }
    }
  } catch { /* pasta inexistente */ }
  return { arquivos, bytes };
}

function podeEscrever(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `.teste-${process.pid}`);
    fs.writeFileSync(f, 'ok'); fs.unlinkSync(f);
    return true;
  } catch { return false; }
}

export function registerAdminArchitecture(app: Express, painel: (a: Area) => RequestHandler) {
  app.get('/api/admin/architecture/overview', painel('arquitetura') as RequestHandler, (_req: Request, res: Response) => {
    const config: Record<string, string> = {};
    try {
      for (const r of db.prepare('SELECT key, value FROM system_settings').all() as Array<{ key: string; value: string }>) config[r.key] = r.value;
    } catch { /* sem configurações */ }

    const dbFile = path.resolve(process.cwd(), 'data', 'luce_d_oro.db');
    const dbBytes = fs.existsSync(dbFile) ? fs.statSync(dbFile).size : 0;
    const uploads = tamanhoPasta(UPLOAD_DIR);
    const emProducao = process.env.NODE_ENV === 'production';
    const hospedagemEfemera = Boolean(process.env.RENDER || process.env.DYNO || process.env.VERCEL || process.env.FLY_APP_NAME);
    const backups = (() => {
      try { return fs.readdirSync(path.dirname(dbFile)).filter((f) => /^backup-.*\.db$/.test(f)).sort(); } catch { return []; }
    })();
    const donoCadastrado = n("SELECT COUNT(*) AS n FROM users WHERE role = 'owner'") > 0;

    const verificacoes: Verificacao[] = [];
    try {
      db.prepare('SELECT 1').get();
      verificacoes.push({ id: 'banco', titulo: 'Banco de dados (SQLite)', estado: 'ok', detalhe: `Respondeu à consulta. Arquivo com ${(dbBytes / 1024).toFixed(0)} KB.` });
    } catch (e) {
      verificacoes.push({ id: 'banco', titulo: 'Banco de dados (SQLite)', estado: 'falha', detalhe: (e as Error).message });
    }
    const gravavel = podeEscrever(UPLOAD_DIR);
    verificacoes.push({ id: 'uploads', titulo: 'Pasta de imagens enviadas', estado: gravavel ? 'ok' : 'falha', detalhe: gravavel ? `Gravável. ${uploads.arquivos} arquivo(s).` : 'Não foi possível gravar na pasta de uploads.' });
    verificacoes.push({
      id: 'persistencia',
      titulo: 'Armazenamento persistente',
      estado: hospedagemEfemera ? 'atencao' : 'nao_verificado',
      detalhe: hospedagemEfemera
        ? 'Hospedagem com disco temporário detectada: imagens enviadas e o banco SQLite podem ser apagados a cada novo deploy. É preciso disco persistente ou armazenamento externo.'
        : 'Não foi possível confirmar se o disco sobrevive a novos deploys. Verifique na sua hospedagem.',
    });
    verificacoes.push({ id: 'dono', titulo: 'Conta do proprietário', estado: donoCadastrado ? 'ok' : 'atencao', detalhe: donoCadastrado ? 'Proprietário cadastrado.' : 'Cadastro do proprietário ainda não concluído.' });
    verificacoes.push({ id: 'backup', titulo: 'Cópias de segurança do banco', estado: backups.length ? 'ok' : 'nao_verificado', detalhe: backups.length ? `Última cópia: ${backups[backups.length - 1]}.` : 'Nenhuma cópia local encontrada. Backups automáticos ainda não foram configurados.' });
    verificacoes.push({ id: 'ambiente', titulo: 'Ambiente', estado: emProducao ? 'ok' : 'atencao', detalhe: emProducao ? 'Produção (NODE_ENV=production).' : 'Desenvolvimento (NODE_ENV não é production).' });

    const usuariosPorPapel = db.prepare('SELECT role, COUNT(*) AS n FROM users GROUP BY role ORDER BY n DESC').all() as Array<{ role: string; n: number }>;
    const tentativas7d = n("SELECT COUNT(*) AS n FROM admin_audit_logs WHERE action = 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT' AND created_at >= datetime('now','-7 day')");
    const recentes = (() => {
      try {
        return db.prepare('SELECT id, user_email, action, entity, entity_id, created_at FROM admin_audit_logs ORDER BY id DESC LIMIT 15').all();
      } catch { return []; }
    })();

    res.json({
      geradoEm: new Date().toISOString(),
      site: {
        id: 'luce-d-oro',
        nome: config.store_name || "Luce D'Oro",
        dominio: config.store_domain || null,
        tecnologia: 'React + Vite (site) · Node.js + Express (API) · SQLite (dados)',
        ambiente: emProducao ? 'produção' : 'desenvolvimento',
        estadoConexao: 'ok',
        armazenamento: 'Disco local do servidor (pasta uploads/)',
        publicacao: 'Edições do painel valem imediatamente (rascunhos e versões: fase 5)',
      },
      contagens: {
        produtos: n('SELECT COUNT(*) AS n FROM products'),
        categorias: n('SELECT COUNT(*) AS n FROM categories'),
        pedidos: n('SELECT COUNT(*) AS n FROM orders'),
        clientes: n("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"),
        equipe: n("SELECT COUNT(*) AS n FROM users WHERE role <> 'customer'"),
        banners: n('SELECT COUNT(*) AS n FROM banners'),
        cupons: n('SELECT COUNT(*) AS n FROM coupons'),
      },
      usuariosPorPapel,
      armazenamento: { arquivos: uploads.arquivos, bytes: uploads.bytes, bancoBytes: dbBytes, backups: backups.length },
      servidor: { node: process.version, plataforma: `${os.type()} ${os.release()}`, uptimeSegundos: Math.round(process.uptime()), memoriaMB: Math.round(process.memoryUsage().rss / 1048576) },
      verificacoes,
      papeis: [
        { id: 'owner', label: 'Proprietário', descricao: 'Controle integral, inclusive Equipe.', areas: 'todas' },
        ...Object.entries(PAPEIS).map(([id, p]) => ({ id, label: p.label, descricao: p.descricao, areas: p.areas })),
      ],
      seguranca: { tentativasNegadas7dias: tentativas7d },
      eventosRecentes: recentes,
      fases: [
        { n: 1, titulo: 'Navegação, acesso e diagnóstico', pronta: true },
        { n: 2, titulo: 'Vários clientes e sites', pronta: false },
        { n: 3, titulo: 'Biblioteca de mídia', pronta: false },
        { n: 4, titulo: 'Editor visual', pronta: false },
        { n: 5, titulo: 'Rascunhos, versões e publicação', pronta: false },
        { n: 6, titulo: 'Auditoria avançada e testes de segurança', pronta: false },
      ],
    });
  });
}
