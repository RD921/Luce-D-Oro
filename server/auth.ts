import type { Request, Response, NextFunction } from 'express';
import { db, AUTHORIZED_OWNER, logAudit } from './db.js';
import { ehGlobal, siteVisitante, SITE_PRINCIPAL } from './sites.js';

// Helper to authenticate request via Cookie or Authorization header
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Não autorizado. Sessão inexistente.' });
    return;
  }

  const session = db
    .prepare(
      `
    SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role, u.site_id
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `
    )
    .get(token) as { token: string; expires_at: string; id: number; name: string; email: string; role: string; site_id: string | null } | undefined;

  if (!session) {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return;
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    return;
  }

  // A conta pertence a uma loja: só vale no endereço dessa loja (dono e desenvolvedor valem em todas).
  if (!ehGlobal(session.role) && (session.site_id ?? SITE_PRINCIPAL) !== siteVisitante(req)) {
    res.status(401).json({ error: 'Sessão inválida para esta loja. Faça login novamente.' });
    return;
  }

  req.user = {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
  };
  next();
}

// CRITICAL SECURITY RULE: Exclusive Owner Authorization Middleware
export function ownerAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  authMiddleware(req, res, () => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Não autorizado. Autenticação obrigatória.' });
      return;
    }

    const cleanEmail = user.email.trim().toLowerCase();
    const authorizedEmail = AUTHORIZED_OWNER.email.toLowerCase();

    // Verify both email and role against immutable authorized owner specification
    if (cleanEmail !== authorizedEmail || user.role !== AUTHORIZED_OWNER.role) {
      logAudit({
        userId: user.id,
        userEmail: user.email,
        action: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
        entity: 'ADMIN_ROUTE',
        entityId: req.originalUrl,
        details: { method: req.method, path: req.path, attemptedRole: user.role },
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      res.status(403).json({
        error: "Acesso negado. Apenas a conta autorizada de Rodrigo Arrezzi (rodrigoarrezzi@icloud.com) possui privilégios administrativos da Luce D'Oro.",
      });
      return;
    }

    // Verify directly against current database record to prevent token forging
    const dbUser = db.prepare('SELECT id, email, role, is_verified FROM users WHERE id = ?').get(user.id) as
      | { id: number; email: string; role: string; is_verified: number }
      | undefined;

    if (!dbUser || dbUser.email.toLowerCase() !== authorizedEmail || dbUser.role !== AUTHORIZED_OWNER.role) {
      res.status(403).json({ error: 'Acesso revogado ou privilégios não confirmados no banco de dados.' });
      return;
    }

    next();
  });
}
