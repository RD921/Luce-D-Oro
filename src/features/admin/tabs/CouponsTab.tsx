import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';
import { api, type Coupon } from '../../../services/api';
import { fmt } from './shared';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: COUPONS
// ============================================================
export function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  const load = async () => {
    setLoading(true);
    try { setCoupons(await api.admin.getCoupons()); } catch {/* */}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Excluir cupom "${code}"?`)) return;
    try { await api.admin.deleteCoupon(id); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Cupons de Desconto</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={() => setCreating(true)}>
          <Plus size={13} /> Novo Cupom
        </button>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
          <table>
            <thead>
              <tr><th>Código</th><th>Tipo</th><th>Desconto</th><th>Gasto mín.</th><th>Usos</th><th>Validade</th><th>Ativo</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {coupons.length === 0 && <tr><td colSpan={8} className={styles.emptyState}>Nenhum cupom criado.</td></tr>}
              {coupons.map(c => (
                <tr key={c.id}>
                  <td><span className={`${styles.tag} ${styles.tagGold}`}>{c.code}</span></td>
                  <td style={{ fontSize: '0.75rem' }}>{c.discount_type === 'percent' ? 'Percentual' : 'Fixo (R$)'}</td>
                  <td className={styles.price}>
                    {c.discount_type === 'percent' ? `${c.discount_value}%` : fmt(c.discount_value)}
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>{c.min_spend > 0 ? fmt(c.min_spend) : '—'}</td>
                  <td>{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                  <td style={{ fontSize: '0.75rem' }}>
                    {c.expires_at ? (c.expires_at < new Date().toISOString().slice(0, 10) ? <span style={{ color: '#E05252' }}>Expirou {c.expires_at.split('-').reverse().join('/')}</span> : c.expires_at.split('-').reverse().join('/')) : '—'}
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${c.is_active ? styles.statusConfirmed : styles.statusCancelled}`}>
                      {c.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <button className={styles.btnIcon} onClick={() => setEditing(c)} title="Editar" style={{ marginRight: 4 }}>
                      <Edit2 size={13} />
                    </button>
                    <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => handleDelete(c.id, c.code)} title="Excluir">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(creating || editing) && <CouponModal coupon={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />}
    </>
  );
}


export function CouponModal({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: coupon?.code ?? '',
    discount_type: coupon?.discount_type ?? 'percent',
    discount_value: coupon ? String(coupon.discount_value) : '',
    min_spend: coupon && coupon.min_spend ? String(coupon.min_spend) : '',
    expires_at: coupon?.expires_at ?? '',
    usage_limit: coupon?.usage_limit ? String(coupon.usage_limit) : '',
    per_customer_limit: coupon?.per_customer_limit ? String(coupon.per_customer_limit) : '',
    is_active: coupon ? Boolean(coupon.is_active) : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.code || !form.discount_value) {
      setError('Código e valor do desconto são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const corpo = {
        discount_type: form.discount_type as any,
        discount_value: Number(form.discount_value),
        min_spend: Number(form.min_spend) || 0,
        expires_at: form.expires_at || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        per_customer_limit: form.per_customer_limit ? Number(form.per_customer_limit) : null,
        is_active: form.is_active ? 1 : 0,
      };
      if (coupon) await api.admin.updateCoupon(coupon.id, corpo);
      else await api.admin.createCoupon({ code: form.code.toUpperCase(), ...corpo });
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{coupon ? `Editar cupom ${coupon.code}` : 'Novo Cupom de Desconto'}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Código do Cupom *</label>
              <input className={styles.formInput} value={form.code} disabled={Boolean(coupon)} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="EX: OURO20" style={{ letterSpacing: '0.1em', fontWeight: 600 }} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo de Desconto</label>
              <select className={styles.formInput} value={form.discount_type} onChange={e => set('discount_type', e.target.value)}>
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Valor do Desconto *</label>
              <input type="number" className={styles.formInput} value={form.discount_value} onChange={e => set('discount_value', e.target.value)} min={0} step={0.01} placeholder={form.discount_type === 'percent' ? 'Ex: 15' : 'Ex: 50.00'} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Compra Mínima (R$)</label>
              <input type="number" className={styles.formInput} value={form.min_spend} onChange={e => set('min_spend', e.target.value)} min={0} step={0.01} placeholder="0 = sem mínimo" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Válido até</label>
              <input type="date" className={styles.formInput} value={form.expires_at} onChange={e => set('expires_at', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Limite total de usos</label>
              <input type="number" className={styles.formInput} value={form.usage_limit} onChange={e => set('usage_limit', e.target.value)} min={1} step={1} placeholder="vazio = sem limite" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Usos por cliente</label>
              <input type="number" className={styles.formInput} value={form.per_customer_limit} onChange={e => set('per_customer_limit', e.target.value)} min={1} step={1} placeholder="vazio = sem limite" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.switchLabel}>
                <input type="checkbox" className={styles.switchInput} checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                Cupom ativo (utilizável imediatamente)
              </label>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? <><div className={styles.spinner} style={{ width: 13, height: 13 }} /> Salvando…</> : coupon ? 'Salvar alterações' : 'Criar Cupom'}
          </button>
        </div>
      </div>
    </div>
  );
}
