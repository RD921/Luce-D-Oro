import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR_EM_USO } from './db.js';

// Cópias automáticas do banco. Usam VACUUM INTO: geram um arquivo consistente e completo mesmo com o banco em uso.
// Ajustes por variável de ambiente: BACKUP_HORAS (intervalo, padrão 24), BACKUP_GUARDAR (quantas manter, padrão 14), BACKUP_DESLIGADO=1.
const PREFIXO = 'backup-auto-';
const HORAS = Math.max(1, Number(process.env.BACKUP_HORAS) || 24);
const GUARDAR = Math.max(1, Number(process.env.BACKUP_GUARDAR) || 14);

const carimbo = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

export function listarBackupsAuto(): Array<{ nome: string; criadoEm: number }> {
  try {
    return fs.readdirSync(DATA_DIR_EM_USO)
      .filter((f) => f.startsWith(PREFIXO) && f.endsWith('.db'))
      .map((f) => ({ nome: f, criadoEm: fs.statSync(path.join(DATA_DIR_EM_USO, f)).mtimeMs }))
      .sort((a, b) => b.criadoEm - a.criadoEm);
  } catch { return []; }
}

export function fazerBackup(): string {
  let destino = path.join(DATA_DIR_EM_USO, `${PREFIXO}${carimbo()}.db`);
  if (fs.existsSync(destino)) destino = destino.replace(/\.db$/, `-${Date.now() % 1000}.db`);
  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  // Mantém só as cópias automáticas mais recentes; cópias manuais (backup-AAAAMMDD...) nunca são apagadas.
  for (const antigo of listarBackupsAuto().slice(GUARDAR)) {
    try { fs.unlinkSync(path.join(DATA_DIR_EM_USO, antigo.nome)); } catch { /* ignora */ }
  }
  return destino;
}

export function iniciarBackups() {
  if (process.env.BACKUP_DESLIGADO === '1') { console.log('[Backup] automático desligado (BACKUP_DESLIGADO=1).'); return; }
  const rodar = () => {
    try { console.log(`[Backup] cópia criada: ${path.basename(fazerBackup())}`); }
    catch (e) { console.error('[Backup] FALHOU:', e); }
  };
  const ultimo = listarBackupsAuto()[0];
  if (!ultimo || Date.now() - ultimo.criadoEm > HORAS * 3600_000) rodar();
  setInterval(rodar, HORAS * 3600_000).unref();
}

// Cópia feita logo antes de uma migração do banco. O nome começa com "backup-pre-" e nunca é apagado sozinho.
export function backupAntesDeMigrar(rotulo: string): string {
  let destino = path.join(DATA_DIR_EM_USO, `backup-pre-${rotulo}-${carimbo()}.db`);
  if (fs.existsSync(destino)) destino = destino.replace(/\.db$/, `-${Date.now() % 1000}.db`);
  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  return destino;
}
