import { useState, useEffect } from 'react';
import { X, Edit2, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { api, type StockMovement, type StockProduct } from '../../../services/api';
import { fmtDate } from './shared';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: STOCK
// ============================================================
export function StockTab() {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isOwner } = useAuth();
  const podeApagar = isOwner || user?.areas?.produtos === 'rw';
  const [adjusting, setAdjusting] = useState<{ product: StockProduct; qty: string; reason: string; modo: 'somar' | 'definir'; variante?: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getStock();
      setProducts(res.products);
      setMovements(res.movements);
    } catch {/* */}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdjust = async () => {
    if (!adjusting) return;
    if (adjusting.qty === '') { alert('Informe a quantidade.'); return; }
    try {
      if (adjusting.variante) {
        await api.admin.setVariantStock(adjusting.product.id, adjusting.variante, Number(adjusting.qty), adjusting.reason.trim());
      } else if (adjusting.modo === 'definir') {
        await api.admin.setStock(adjusting.product.id, Number(adjusting.qty), adjusting.reason.trim());
      } else {
        if (!adjusting.reason.trim()) { alert('Informe o motivo do ajuste.'); return; }
        await api.admin.adjustStock(adjusting.product.id, Number(adjusting.qty), adjusting.reason);
      }
      setAdjusting(null);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const apagar = async (p: StockProduct) => {
    if (!confirm(`Apagar "${p.name}" do estoque e da loja?\n\nSe já houve vendas dele, ele será apenas arquivado (some da loja, mantém o histórico).`)) return;
    try {
      await api.admin.deleteProductForever(p.id);
    } catch {
      try { await api.admin.deleteProduct(p.id); alert('Este produto já tem vendas: foi arquivado em vez de apagado (volta em Produtos → Arquivados).'); }
      catch (e: any) { alert(e.message); return; }
    }
    load();
  };

  return (
    <>
      <div className={styles.twoColGrid}>
        <div>
          <div className={styles.sectionHeader}><span className={styles.sectionTitle}>Estoque Atual</span></div>
          <div className={styles.tableWrapper}>
            {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
              <table>
                <thead><tr><th>Produto</th><th>Estoque</th><th>Quantidade</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className={styles.productName} style={{ fontSize: '0.8rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>{p.category_id}</div>
                        {p.variants.length > 0 && (
                          <div style={{ marginTop: 6, display: 'grid', gap: 3 }}>
                            {p.variants.map(v => (
                              <div key={v.title} style={{ fontSize: '0.72rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ color: 'var(--adm-text-muted)' }}>{v.title}:</span>
                                <span className={v.stock === 0 ? styles.stockOut : v.stock <= 3 ? styles.stockLow : styles.stockOk}>{v.stock} un.</span>
                                <button className={styles.btnIcon} title="Alterar esta variação" onClick={() => setAdjusting({ product: p, qty: String(v.stock), reason: '', modo: 'definir', variante: v.title })}><Edit2 size={11} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={p.stock === 0 ? styles.stockOut : p.stock <= 3 ? styles.stockLow : styles.stockOk}>
                        {p.stock} un.
                      </td>
                      <td>
                        {p.variants.length === 0 && (
                          <button
                            className={`${styles.btnSmall} ${styles.btnSmallGhost}`}
                            onClick={() => setAdjusting({ product: p, qty: String(p.stock), reason: '', modo: 'definir' })}
                          >
                            <Edit2 size={11} /> Alterar
                          </button>
                        )}
                        {podeApagar && (
                          <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} style={{ marginLeft: 6 }} title="Apagar produto" onClick={() => apagar(p)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <div className={styles.sectionHeader}><span className={styles.sectionTitle}>Histórico de Movimentos</span></div>
          <div className={styles.tableWrapper}>
            {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {movements.length === 0 && <div className={styles.emptyState}>Sem movimentos registrados.</div>}
                {movements.map(m => (
                  <div key={m.id} className={styles.auditEntry}>
                    <div
                      className={styles.auditDot}
                      style={{ background: m.quantity_change > 0 ? 'var(--adm-green)' : 'var(--adm-red)' }}
                    />
                    <div>
                      <div className={styles.auditAction}>
                        {m.quantity_change > 0 ? <ArrowUpCircle size={12} style={{ display: 'inline', color: 'var(--adm-green)' }} /> : <ArrowDownCircle size={12} style={{ display: 'inline', color: 'var(--adm-red)' }} />}
                        {' '}{m.product_name} {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                      </div>
                      <div className={styles.auditMeta}>
                        {m.previous_stock} → {m.new_stock} un. · {m.reason} · {fmtDate(m.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {adjusting && (
        <div className={styles.modalOverlay} onClick={() => setAdjusting(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Estoque — {adjusting.product.name}</span>
              <button className={styles.modalCloseBtn} onClick={() => setAdjusting(null)}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                <label className={styles.formLabel}>Estoque atual</label>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--adm-text)' }}>
                  {adjusting.product.stock} unidades
                </div>
              </div>
              {adjusting.variante && <div style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>Variação: <strong>{adjusting.variante}</strong></div>}
              <div style={{ display: adjusting.variante ? 'none' : 'flex', gap: 8, marginBottom: '1rem' }}>
                <button className={`${styles.btnSmall} ${adjusting.modo === 'definir' ? styles.btnSmallPrimary : styles.btnSmallGhost}`} onClick={() => setAdjusting(a => a ? { ...a, modo: 'definir', qty: String(a.product.stock) } : null)}>Definir total</button>
                <button className={`${styles.btnSmall} ${adjusting.modo === 'somar' ? styles.btnSmallPrimary : styles.btnSmallGhost}`} onClick={() => setAdjusting(a => a ? { ...a, modo: 'somar', qty: '' } : null)}>Somar / subtrair</button>
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                <label className={styles.formLabel}>{adjusting.modo === 'definir' ? 'Nova quantidade em estoque' : 'Variação de quantidade (use - para reduzir)'}</label>
                <input
                  type="number"
                  className={styles.formInput}
                  placeholder={adjusting.modo === 'definir' ? 'Ex: 12' : 'Ex: +5 ou -2'}
                  min={adjusting.modo === 'definir' ? 0 : undefined}
                  value={adjusting.qty}
                  onChange={e => setAdjusting(a => a ? { ...a, qty: e.target.value } : null)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Motivo{adjusting.modo === 'somar' ? ' *' : ' (opcional)'}</label>
                <input
                  className={styles.formInput}
                  placeholder="Ex: Recebimento de mercadoria, Devolução, Contagem do inventário"
                  value={adjusting.reason}
                  onChange={e => setAdjusting(a => a ? { ...a, reason: e.target.value } : null)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setAdjusting(null)}>Cancelar</button>
              <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleAdjust}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
