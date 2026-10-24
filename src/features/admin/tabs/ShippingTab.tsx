import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';
import { api, type AdminShipping } from '../../../services/api';
import { fmt } from './shared';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: ENTREGA (fretes e prazos)
// ============================================================
export function ShippingTab() {
  const [lista, setLista] = useState<AdminShipping[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<AdminShipping | 'novo' | null>(null);

  const load = async () => {
    try { setLista(await api.admin.getShipping()); } catch (e: any) { alert(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const alternar = async (m: AdminShipping) => {
    try { await api.admin.updateShipping(m.id, { is_active: m.is_active ? 0 : 1 }); load(); } catch (e: any) { alert(e.message); }
  };
  const apagar = async (m: AdminShipping) => {
    if (!confirm(`Remover "${m.name}"? Pedidos antigos continuam com o frete que pagaram.`)) return;
    try { await api.admin.deleteShipping(m.id); load(); } catch (e: any) { alert(e.message); }
  };
  const prazo = (m: AdminShipping) => (m.days_min === m.days_max ? `${m.days_min}` : `${m.days_min} a ${m.days_max}`) + ' dias úteis';

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Formas de entrega</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={() => setEditando('novo')}><Plus size={13} /> Nova forma de entrega</button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--adm-text-muted)', margin: '0 0 1rem' }}>
        O cliente escolhe entre as formas ativas no checkout. O valor, o prazo e o “frete grátis a partir de” são calculados no servidor — não dá para o cliente alterar.
        Sem nenhuma forma ativa, o frete fica zerado.
      </p>
      <div className={styles.tableWrapper}>
        {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
          <table>
            <thead><tr><th>Nome</th><th>Valor</th><th>Prazo</th><th>Grátis a partir de</th><th>Na loja</th><th>Ações</th></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={6} className={styles.emptyState}>Nenhuma forma de entrega cadastrada.</td></tr>}
              {lista.map(m => (
                <tr key={m.id}>
                  <td><div className={styles.productName}>{m.name}</div><div className={styles.productSlug}>{m.description}</div></td>
                  <td className={styles.price}>{fmt(m.price)}</td>
                  <td style={{ fontSize: '0.78rem' }}>{prazo(m)}</td>
                  <td style={{ fontSize: '0.78rem' }}>{m.free_above !== null ? fmt(m.free_above) : '—'}</td>
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
      {editando && <ShippingModal item={editando === 'novo' ? null : editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); load(); }} />}
    </>
  );
}


export function ShippingModal({ item, onClose, onSaved }: { item: AdminShipping | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: item?.name ?? '', description: item?.description ?? '', price: item ? String(item.price) : '', days_min: item ? String(item.days_min) : '3', days_max: item ? String(item.days_max) : '7',
    free_above: item?.free_above != null ? String(item.free_above) : '', is_active: item ? Boolean(item.is_active) : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }));

  const salvar = async () => {
    setSaving(true); setError('');
    const corpo = { name: f.name, description: f.description, price: Number(f.price || 0), days_min: Number(f.days_min), days_max: Number(f.days_max), free_above: f.free_above === '' ? null : Number(f.free_above), is_active: f.is_active ? 1 : 0 };
    try {
      if (item) await api.admin.updateShipping(item.id, corpo); else await api.admin.createShipping(corpo);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{item ? `Editar: ${item.name}` : 'Nova forma de entrega'}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Nome *</label>
              <input className={styles.formInput} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Sedex, Entrega Padrão, Retirada na loja" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Descrição (aparece no checkout)</label>
              <input className={styles.formInput} value={f.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Valor (R$)</label>
              <input type="number" min={0} step="0.01" className={styles.formInput} value={f.price} onChange={e => set('price', e.target.value)} placeholder="0 = grátis" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Grátis para compras a partir de (R$)</label>
              <input type="number" min={0} step="0.01" className={styles.formInput} value={f.free_above} onChange={e => set('free_above', e.target.value)} placeholder="vazio = nunca grátis" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Prazo mínimo (dias úteis)</label>
              <input type="number" min={0} className={styles.formInput} value={f.days_min} onChange={e => set('days_min', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Prazo máximo (dias úteis)</label>
              <input type="number" min={0} className={styles.formInput} value={f.days_max} onChange={e => set('days_max', e.target.value)} />
            </div>
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
