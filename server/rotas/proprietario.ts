import { Request, Response } from 'express';
import type { Express } from 'express';
import { db, AUTHORIZED_OWNER, logAudit } from '../db.js';
import { authMiddleware, type AuthenticatedRequest } from '../auth.js';
import { limiteChaveDono } from '../limites.js';

export function registerRotasProprietario(app: Express) {
  // ==================== OWNER INITIALIZATION PROCEDURES ====================

  // Check Owner Account Setup Status
  app.get('/api/admin/setup/status', (req: Request, res: Response) => {
    const targetEmail = AUTHORIZED_OWNER.email.toLowerCase();
    const ownerUser = db
      .prepare('SELECT id, name, email, role, is_verified FROM users WHERE email = ?')
      .get(targetEmail) as { id: number; name: string; email: string; role: string; is_verified: number } | undefined;

    const isInitialized = ownerUser?.role === 'owner' && Boolean(ownerUser?.is_verified);

    res.json({
      authorizedOwnerEmail: AUTHORIZED_OWNER.email,
      authorizedOwnerName: AUTHORIZED_OWNER.name,
      isRegistered: Boolean(ownerUser),
      isInitialized,
      requiresVerification: Boolean(ownerUser && ownerUser.role !== 'owner'),
    });
  });

  // Claim & Activate Owner Privileges via Single-Use Setup Key
  app.post('/api/admin/setup/verify-owner', limiteChaveDono, authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const cleanEmail = user.email.trim().toLowerCase();
    const authorizedEmail = AUTHORIZED_OWNER.email.toLowerCase();

    // Strict check: only rodrigoarrezzi@icloud.com can activate the owner role
    if (cleanEmail !== authorizedEmail) {
      logAudit({
        userId: user.id,
        userEmail: user.email,
        action: 'ILLEGAL_OWNER_CLAIM_ATTEMPT',
        entity: 'SECURITY',
        details: { attemptedBy: user.email },
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      res.status(403).json({
        error: 'Acesso negado. A ativação da conta proprietária é restrita exclusivamente a Rodrigo Arrezzi (rodrigoarrezzi@icloud.com).',
      });
      return;
    }

    const { setupKey } = req.body;
    if (!setupKey) {
      res.status(400).json({ error: 'Chave de ativação do proprietário é obrigatória.' });
      return;
    }

    // Validate setup key from database
    const tokenRecord = db
      .prepare('SELECT token, is_used FROM owner_setup_tokens WHERE token = ?')
      .get(setupKey.trim()) as { token: string; is_used: number } | undefined;

    if (!tokenRecord) {
      res.status(400).json({ error: 'Chave de ativação incorreta. Verifique o código gerado no servidor.' });
      return;
    }

    if (tokenRecord.is_used === 1) {
      res.status(400).json({ error: 'Esta chave de ativação já foi utilizada anteriormente.' });
      return;
    }

    // Update user to owner role and verified status
    db.prepare("UPDATE users SET role = 'owner', is_verified = 1 WHERE id = ?").run(user.id);
    db.prepare("UPDATE owner_setup_tokens SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE token = ?").run(
      setupKey.trim()
    );

    logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'OWNER_ACCOUNT_ACTIVATED',
      entity: 'USERS',
      entityId: String(user.id),
      details: { verifiedAt: new Date().toISOString() },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: "Conta proprietária ativada com sucesso! Você agora tem acesso integral à Central de Comando da Luce D'Oro.",
      role: 'owner',
    });
  });
}
