import { useState, useEffect } from 'react';
import { api, type AuditLog } from '../../../services/api';
import { fmtDate } from './shared';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: AUDIT
// ============================================================
export function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getAuditLogs().then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      {loading ? (
        <div className={styles.loader}><div className={styles.spinner}/></div>
      ) : (
        <div className={styles.tableWrapper}>
          <div style={{ padding: '1rem', maxHeight: 600, overflowY: 'auto' }}>
            {logs.length === 0 && <div className={styles.emptyState}>Nenhum evento registrado.</div>}
            {logs.map(l => (
              <div key={l.id} className={styles.auditEntry}>
                <div className={styles.auditDot} />
                <div>
                  <div className={styles.auditAction}>
                    [{l.entity}] {l.action}
                    {l.entity_id && <span style={{ color: 'var(--adm-text-muted)', fontWeight: 400 }}> #{l.entity_id}</span>}
                  </div>
                  <div className={styles.auditMeta}>
                    {l.user_email || 'Sistema'} · {fmtDate(l.created_at)}
                    {l.ip_address && ` · IP: ${l.ip_address}`}
                  </div>
                  {l.details && (
                    <details style={{ marginTop: '0.25rem' }}>
                      <summary style={{ fontSize: '0.7rem', color: 'var(--adm-text-dim)', cursor: 'pointer' }}>Detalhes</summary>
                      <pre style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)', marginTop: '0.3rem', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(l.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
