import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';
import { api, type AdminPayment } from '../../../services/api';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: PAGAMENTO (somente proprietário)
// ============================================================
const TIPOS_PAGAMENTO: Record<string, string> = { pix: 'Pix', card: 'Cartão de crédito', boleto: 'Boleto', other: 'Outro' };


export function PaymentsTab() {
  const [lista, setLista] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<AdminPayment | 'novo' | null>(null);

  const load = async () => {
    try { setLista(await api.admin.getPayments()); } catch (e: any) { alert(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const alternar = async (m: AdminPayment) => {
    try { await api.admin.updatePayment(m.id, { is_active: m.is_active ? 0 : 1 }); load(); } catch (e: any) { alert(e.message); }
  };
  const apagar = async (m: AdminPayment) => {
    if (!confirm(`Remover "${m.name}"?`)) return;
    try { await api.admin.deletePayment(m.id); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Formas de pagamento</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={() => setEditando('novo')}><Plus size={13} /> Nova forma de pagamento</button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--adm-text-muted)', margin: '0 0 1rem' }}>
        Define o que aparece no checkout, o desconto de cada forma (por exemplo, Pix) e o máximo de parcelas sem juros do cartão. O desconto é aplicado no servidor.
        A loja ainda não cobra de verdade: o pedido é registrado com a forma escolhida.
      </p>
      <div className={styles.tableWrapper}>
        {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
          <table>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Desconto</th><th>Parcelas</th><th>No checkout</th><th>Ações</th></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={6} className={styles.emptyState}>Nenhuma forma de pagamento cadastrada.</td></tr>}
              {lista.map(m => (
                <tr key={m.id}>
                  <td><div className={styles.productName}>{m.name}</div><div className={styles.productSlug}>{m.description}</div></td>
                  <td style={{ fontSize: '0.78rem' }}>{TIPOS_PAGAMENTO[m.kind] ?? m.kind}</td>
                  <td>{m.discount_percent > 0 ? `${m.discount_percent}%` : '—'}</td>
                  <td>{m.kind === 'card' ? `até ${m.max_installments}x` : '—'}</td>
                  <td><button className={`${styles.statusPill} ${m.is_active ? styles.statusConfirmed : styles.statusCancelled}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => alternar(m)}>{m.is_active ? 'Ativa' : 'Desativada'}</button></td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className={styles.btnIcon} onClick={() => setEditando(m)} title="Editar"><Edit2 size={13} /></button>
                      <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => apagar(m)} title="Remover"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editando && <PaymentModal item={editando === 'novo' ? null : editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); load(); }} />}
    </>
  );
}


export function PaymentModal({ item, onClose, onSaved }: { item: AdminPayment | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: item?.name ?? '', description: item?.description ?? '', kind: item?.kind ?? 'pix', discount_percent: item ? String(item.discount_percent) : '0',
    max_installments: item ? String(item.max_installments) : '1', is_active: item ? Boolean(item.is_active) : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }));

  const salvar = async () => {
    setSaving(true); setError('');
    const corpo = { name: f.name, description: f.description, kind: f.kind, discount_percent: Number(f.discount_percent || 0), max_installments: f.kind === 'card' ? Number(f.max_installments || 1) : 1, is_active: f.is_active ? 1 : 0 };
    try {
      if (item) await api.admin.updatePayment(item.id, corpo); else await api.admin.createPayment(corpo);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{item ? `Editar: ${item.name}` : 'Nova forma de pagamento'}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Nome *</label>
              <input className={styles.formInput} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Pix Instantâneo" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Descrição (aparece no checkout)</label>
              <input className={styles.formInput} value={f.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo</label>
              <select className={styles.formInput} value={f.kind} onChange={e => set('kind', e.target.value)}>
                {Object.entries(TIPOS_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Desconto (%)</label>
              <input type="number" min={0} max={90} step="0.5" className={styles.formInput} value={f.discount_percent} onChange={e => set('discount_percent', e.target.value)} />
            </div>
            {f.kind === 'card' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Máximo de parcelas sem juros</label>
                <input type="number" min={1} max={24} className={styles.formInput} value={f.max_installments} onChange={e => set('max_installments', e.target.value)} />
              </div>
            )}
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.switchLabel}>
                <input type="checkbox" className={styles.switchInput} checked={f.is_active} onChange={e => set('is_active', e.target.checked)} />
                Disponível no checkout
              </label>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
