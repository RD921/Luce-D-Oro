import { Request, Response } from 'express';
import type { Express } from 'express';
import crypto from 'node:crypto';
import { db, hashPassword, verifyPassword, AUTHORIZED_OWNER } from '../db.js';
import { areasDoPapel } from '../adminTeam.js';
import { authMiddleware, type AuthenticatedRequest } from '../auth.js';
import { limiteLoginConta, limiteLoginIp } from '../limites.js';
import { siteVisitante } from '../sites.js';

export function registerRotasAuth(app: Express) {
  // ==================== AUTH & SETUP ROUTES ====================

  // Check/validate email format (does not expose account existence to avoid enumeration)
  app.post('/api/auth/validate-email', (req: Request, res: Response) => {
    const { email } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      res.status(400).json({ error: 'Formato de e-mail inválido. Por favor, digite um e-mail correto.' });
      return;
    }
    res.json({ valid: true });
  });

  // Login
  app.post('/api/auth/login', limiteLoginIp, limiteLoginConta, (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    // A conta é da loja que o cliente está acessando (dono e desenvolvedor entram em qualquer loja)
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND (site_id = ? OR role IN ('owner','dev')) ORDER BY (site_id = ?) DESC LIMIT 1").get(email.trim().toLowerCase(), siteVisitante(req), siteVisitante(req)) as
      | {
          id: number;
          name: string;
          email: string;
          password_hash: string;
          salt: string;
          role: string;
        }
      | undefined;

    const dummySalt = '0123456789abcdef0123456789abcdef';
    const dummyHash = '0'.repeat(128);

    const isValid = user
      ? verifyPassword(password, user.password_hash, user.salt)
      : verifyPassword(password, dummyHash, dummySalt);

    if (!user || !isValid) {
      res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
      return;
    }

    // Create session (valid for 7 days)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
      sessionToken,
      user.id,
      expiresAt
    );

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === '1',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isOwner: user.role === 'owner' && user.email.toLowerCase() === AUTHORIZED_OWNER.email.toLowerCase(),
        isStaff: Object.keys(areasDoPapel(user.role)).length > 0,
        areas: areasDoPapel(user.role),
      },
    });
  });

  // Register: Public registration NEVER grants owner or admin role
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || name.trim().length < 3) {
      res.status(400).json({ error: 'Por favor, informe seu nome completo.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
      return;
    }

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'A confirmação de senha não confere.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare("SELECT id FROM users WHERE email = ? AND (site_id = ? OR role IN ('owner','dev'))").get(cleanEmail, siteVisitante(req));
    if (existing) {
      res.status(409).json({ error: 'Este e-mail já está cadastrado. Tente entrar ou recuperar sua senha.' });
      return;
    }

    const { hash, salt } = hashPassword(password);

    // Security: Public registration role is strictly 'customer'
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, salt, role, is_verified, site_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(name.trim(), cleanEmail, hash, salt, 'customer', 0, siteVisitante(req));

    const userId = Number(result.lastInsertRowid);

    // Create empty cart
    db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run(`cart_${userId}_${Date.now()}`, userId);

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
      sessionToken,
      userId,
      expiresAt
    );

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === '1',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      token: sessionToken,
      user: {
        id: userId,
        name: name.trim(),
        email: cleanEmail,
        role: 'customer',
      },
    });
  });

  // Current User Profile
  app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const user = db.prepare('SELECT id, name, email, role, is_verified, created_at FROM users WHERE id = ?').get(req.user!.id) as
      | { id: number; name: string; email: string; role: string; is_verified: number; created_at: string }
      | undefined;

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: Boolean(user.is_verified),
        isOwner: user.role === 'owner' && user.email.toLowerCase() === AUTHORIZED_OWNER.email.toLowerCase(),
        isStaff: Object.keys(areasDoPapel(user.role)).length > 0,
        areas: areasDoPapel(user.role),
        createdAt: user.created_at,
      },
    });
  });

  // Logout
  app.post('/api/auth/logout', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.clearCookie('session_token');
    res.json({ success: true, message: 'Sessão encerrada com segurança.' });
  });

  // Request Password Reset
  app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'E-mail obrigatório.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare("SELECT id FROM users WHERE email = ? AND (site_id = ? OR role IN ('owner','dev'))").get(cleanEmail, siteVisitante(req)) as { id: number } | undefined;

    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      db.prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)').run(
        token,
        user.id,
        expiresAt
      );
    }

    res.json({
      success: true,
      message: 'Se o e-mail informado estiver cadastrado, as instruções para redefinição foram enviadas com sucesso.',
    });
  });
}
