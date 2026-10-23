// Fase 8 — endurecimento: cabeçalhos de segurança, origens permitidas (CORS) e limite de tentativas de login.
import type { Request, Response, NextFunction } from 'express';

const emProducao = () => process.env.NODE_ENV === 'production';

export function cabecalhosSeguranca(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // o editor visual abre a própria loja num iframe da mesma origem
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (emProducao() && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

// Origens que podem chamar a API de outro endereço. Mesma origem não precisa de CORS.
// Em desenvolvimento, localhost é liberado. Em produção, só o que estiver em CORS_ORIGINS (separado por vírgula).
export function origemPermitida(origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) {
  if (!origin) return cb(null, true);
  const lista = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  if (lista.includes(origin.replace(/\/$/, ''))) return cb(null, true);
  if (!emProducao() && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
  return cb(null, false);
}

// Conta só as tentativas que FALHARAM (401/403 por padrão) e bloqueia depois do limite, por janela.
export function limitarFalhas(opcoes: { janelaMs: number; max: number; chave: (req: Request) => string; mensagem: string; contar?: number[] }) {
  const falhas = new Map<string, { n: number; ate: number }>();
  const limpar = setInterval(() => { const t = Date.now(); for (const [k, v] of falhas) if (v.ate < t) falhas.delete(k); }, 60_000);
  limpar.unref();
  return (req: Request, res: Response, next: NextFunction) => {
    const k = opcoes.chave(req);
    const agora = Date.now();
    const reg = falhas.get(k);
    if (reg && reg.ate > agora && reg.n >= opcoes.max) {
      res.setHeader('Retry-After', String(Math.ceil((reg.ate - agora) / 1000)));
      res.status(429).json({ error: opcoes.mensagem });
      return;
    }
    res.on('finish', () => {
      if ((opcoes.contar ?? [401, 403]).includes(res.statusCode)) {
        const atual = falhas.get(k);
        if (!atual || atual.ate < Date.now()) falhas.set(k, { n: 1, ate: Date.now() + opcoes.janelaMs });
        else atual.n += 1;
      } else if (res.statusCode < 300) {
        falhas.delete(k); // acertou: zera
      }
    });
    next();
  };
}
