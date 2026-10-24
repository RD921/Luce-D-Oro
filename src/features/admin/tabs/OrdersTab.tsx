import { useState, useEffect, useCallback } from 'react';
import { X, Search, CheckCircle, Truck, Eye } from 'lucide-react';
import { api, type Order } from '../../../services/api';
import { fmt, fmtDate, statusClass, ORDER_STATUSES } from './shared';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: ORDERS
// ============================================================
export function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewing, setViewing] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setOrders(await api.admin.getOrders({ status: statusFilter || undefined, q: search || undefined })); }
    catch {/* */}
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const handleStatusChange = async (orderId: string, newStatus: string, trackingCode?: string) => {
    setUpdatingId(orderId);
    try { await api.admin.updateOrderStatus(orderId, { status: newStatus, trackingCode }); await load(); }
    catch (e: any) { alert(e.message); }
    setUpdatingId(null);
  };

  return (
    <>
      <div className={styles.filterRow}>
        <Search size={14} style={{ color: 'var(--adm-text-dim)', flexShrink: 0 }} />
        <input
          className={styles.searchInput}
          placeholder="Buscar pedido, cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loader}><div className={styles.spinner}/></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Pedido</th><th>Cliente</th><th>Total</th>
                  <th>Pagamento</th><th>Status</th><th>Data</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={7} className={styles.emptyState}>Nenhum pedido encontrado.</td></tr>
                )}
                {orders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{o.id}</td>
                    <td>
                      <div style={{ fontSize: '0.8rem' }}>{(o as any).customer_name || '—'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>{(o as any).customer_email}</div>
                    </td>
                    <td className={styles.price}>{fmt(o.total)}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{o.payment_method}</td>
                    <td><span className={`${styles.statusPill} ${statusClass(o.status)}`}>{o.status}</span></td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{fmtDate(o.created_at)}</td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.btnIcon} title="Ver detalhes" onClick={() => setViewing(o)}>
                          <Eye size={13} />
                        </button>
                        {o.status !== 'Entregue' && o.status !== 'Cancelado' && (
                          <OrderQuickUpdate
                            order={o}
                            onUpdate={handleStatusChange}
                            loading={updatingId === o.id}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewing && <OrderDetailModal order={viewing} onClose={() => setViewing(null)} onUpdate={(id, s, t) => { handleStatusChange(id, s, t); setViewing(null); }} />}
    </>
  );
}


export function OrderQuickUpdate({ order, onUpdate, loading }: { order: Order; onUpdate: (id: string, s: string, t?: string) => void; loading: boolean }) {
  const current = ORDER_STATUSES.indexOf(order.status);
  const next = ORDER_STATUSES[current + 1];
  if (!next) return null;
  return (
    <button
      className={`${styles.btnSmall} ${styles.btnSmallGhost}`}
      onClick={() => onUpdate(order.id, next)}
      disabled={loading}
      title={`Avançar para: ${next}`}
    >
      {loading ? <div className={styles.spinner} style={{ width: 12, height: 12 }} /> : <Truck size={12} />}
      {next}
    </button>
  );
}


export function OrderDetailModal({ order, onClose, onUpdate }: { order: Order; onClose: () => void; onUpdate: (id: string, s: string, t?: string) => void }) {
  const [newStatus, setNewStatus] = useState(order.status);
  const [tracking, setTracking] = useState((order as any).tracking_code || '');

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Pedido {order.id}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formGrid} style={{ marginBottom: '1rem' }}>
            <div>
              <div className={styles.formLabel}>Cliente</div>
              <div style={{ marginTop: '0.3rem' }}>{(order as any).customer_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{(order as any).customer_email}</div>
            </div>
            <div>
              <div className={styles.formLabel}>Endereço de Entrega</div>
              <div style={{ marginTop: '0.3rem', fontSize: '0.82rem' }}>{order.shipping_address}</div>
            </div>
            <div>
              <div className={styles.formLabel}>Total</div>
              <div className={styles.price} style={{ marginTop: '0.3rem', fontSize: '1.2rem' }}>{fmt(order.total)}</div>
            </div>
            <div>
              <div className={styles.formLabel}>Pagamento</div>
              <div style={{ marginTop: '0.3rem', fontSize: '0.82rem' }}>{order.payment_method}</div>
            </div>
            <div>
              <div className={styles.formLabel}>Entrega</div>
              <div style={{ marginTop: '0.3rem', fontSize: '0.82rem' }}>
                {order.shipping_method || '—'}{order.shipping_method ? ` · ${order.shipping_cost ? fmt(order.shipping_cost) : 'Cortesia'}` : ''}
                {(order.coupon_discount ?? 0) > 0 && <div>Cupom: − {fmt(order.coupon_discount)}</div>}
                {(order.payment_discount ?? 0) > 0 && <div>Desconto do pagamento: − {fmt(order.payment_discount)}</div>}
              </div>
            </div>
          </div>

          <div className={styles.formLabel} style={{ marginBottom: '0.5rem' }}>Itens do Pedido</div>
          <div className={styles.tableWrapper} style={{ marginBottom: '1rem' }}>
            <table>
              <thead><tr><th>Produto</th><th>Variante</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{item.variant_title}</td>
                    <td>{item.quantity}</td>
                    <td className={styles.price}>{fmt(item.unit_price)}</td>
                    <td className={styles.price}>{fmt(item.unit_price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Status do Pedido</label>
              <select className={styles.formInput} value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Código de Rastreamento</label>
              <input className={styles.formInput} value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Ex: BR123456789BR" />
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Fechar</button>
          <button
            className={`${styles.btnSmall} ${styles.btnSmallPrimary}`}
            onClick={() => { onUpdate(order.id, newStatus, tracking); }}
          >
            <CheckCircle size={13} /> Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
