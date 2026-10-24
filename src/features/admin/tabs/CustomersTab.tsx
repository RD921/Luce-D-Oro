import { useState, useEffect } from 'react';
import { X, Eye } from 'lucide-react';
import { api } from '../../../services/api';
import { fmt, fmtDate } from './shared';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: CLIENTES (lista + ficha)
// ============================================================
export function CustomersTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [ficha, setFicha] = useState<{ cliente: any; resumo: { pedidos: number; gasto: number }; pedidos: any[] } | null>(null);

  useEffect(() => {
    api.admin.getCustomers().then(setCustomers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const abrir = async (id: number) => {
    try { setFicha(await api.admin.getCustomer(id)); } catch (e: any) { alert(e.message); }
  };

  const q = busca.trim().toLowerCase();
  const lista = q ? customers.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(q)) : customers;

  return (
    <>
      <div className={styles.filterRow}>
        <input className={styles.formInput} style={{ maxWidth: 320 }} placeholder="Buscar por nome ou e-mail…" value={busca} onChange={e => setBusca(e.target.value)} />
        <span style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{lista.length} cliente(s)</span>
      </div>
      {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
        <div className={styles.tableWrapper}>
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Pedidos</th><th>Gasto Total</th><th>Desde</th><th></th></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={6} className={styles.emptyState}>Nenhum cliente encontrado.</td></tr>}
              {lista.map((c: any) => (
                <tr key={c.id}>
                  <td className={styles.productName}>{c.name}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{c.email}</td>
                  <td>{c.orders_count || 0}</td>
                  <td className={styles.price}>{fmt(c.total_spent || 0)}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{fmtDate(c.created_at)}</td>
                  <td><button className={styles.btnIcon} onClick={() => abrir(c.id)} title="Ver ficha"><Eye size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ficha && (
        <div className={styles.modalOverlay} onClick={() => setFicha(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{ficha.cliente.name}</span>
              <button className={styles.modalCloseBtn} onClick={() => setFicha(null)}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ fontSize: '0.8rem', color: 'var(--adm-text-muted)', marginBottom: '1rem' }}>
                {ficha.cliente.email} · cliente desde {fmtDate(ficha.cliente.created_at)}
              </div>
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                <div><div style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>Pedidos</div><strong>{ficha.resumo.pedidos}</strong></div>
                <div><div style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>Total gasto</div><strong>{fmt(ficha.resumo.gasto)}</strong></div>
              </div>
              <table>
                <thead><tr><th>Pedido</th><th>Data</th><th>Status</th><th>Total</th></tr></thead>
                <tbody>
                  {ficha.pedidos.length === 0 && <tr><td colSpan={4} className={styles.emptyState}>Ainda sem pedidos.</td></tr>}
                  {ficha.pedidos.map((p: any) => (
                    <tr key={p.id}>
                      <td style={{ fontSize: '0.75rem' }}>{p.id}</td>
                      <td style={{ fontSize: '0.75rem' }}>{fmtDate(p.created_at)}</td>
                      <td style={{ fontSize: '0.75rem' }}>{p.status}</td>
                      <td className={styles.price}>{fmt(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
