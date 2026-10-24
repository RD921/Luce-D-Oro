import type { Request } from 'express';
import { limitarFalhas } from './seguranca.js';

// Limite de tentativas erradas (força bruta): por e-mail+IP e também por IP
export const ipDe = (req: Request) => req.ip || req.socket.remoteAddress || 'desconhecido';
export const limiteLoginConta = limitarFalhas({ janelaMs: 15 * 60_000, max: 8, chave: (req) => `c:${ipDe(req)}:${String(req.body?.email || '').trim().toLowerCase()}`, mensagem: 'Muitas tentativas erradas. Aguarde alguns minutos e tente de novo.' });
export const limiteLoginIp = limitarFalhas({ janelaMs: 15 * 60_000, max: 40, chave: (req) => `i:${ipDe(req)}`, mensagem: 'Muitas tentativas erradas deste endereço. Aguarde alguns minutos.' });
export const limiteChaveDono = limitarFalhas({ janelaMs: 15 * 60_000, max: 5, chave: (req) => `d:${ipDe(req)}`, mensagem: 'Muitas tentativas com chave inválida. Aguarde alguns minutos.', contar: [400, 401, 403] });
