import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';
import { api, type Banner } from '../../../services/api';
import { ImageField } from './shared';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: BANNERS
// ============================================================
export function BannersTab() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setBanners(await api.admin.getBanners()); } catch {/* */}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Excluir banner "${title}"?`)) return;
    try { await api.admin.deleteBanner(id); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Banners da Homepage</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={() => setCreating(true)}>
          <Plus size={13} /> Novo Banner
        </button>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
          <table>
            <thead><tr><th>Prévia</th><th>Título</th><th>Subtítulo</th><th>Ordem</th><th>Ativo</th><th>Ações</th></tr></thead>
            <tbody>
              {banners.length === 0 && <tr><td colSpan={6} className={styles.emptyState}>Nenhum banner criado.</td></tr>}
              {banners.map(b => (
                <tr key={b.id}>
                  <td>
                    {b.image_desktop && (
                      <img src={b.image_desktop} alt={b.title} className={styles.productImg} style={{ width: 60, height: 36 }} onError={() => {}} />
                    )}
                  </td>
                  <td className={styles.productName}>{b.title}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{b.subtitle || '—'}</td>
                  <td>{b.display_order}</td>
                  <td>
                    <span className={`${styles.statusPill} ${b.is_active ? styles.statusConfirmed : styles.statusCancelled}`}>
                      {b.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className={styles.btnIcon} onClick={() => setEditing(b)} title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => handleDelete(b.id, b.title)} title="Excluir">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(editing || creating) && (
        <BannerModal
          banner={editing || undefined}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </>
  );
}


export function BannerModal({ banner, onClose, onSaved }: { banner?: Banner; onClose: () => void; onSaved: () => void }) {
  const isNew = !banner;
  const [form, setForm] = useState({
    title: banner?.title || '',
    subtitle: banner?.subtitle || '',
    badge: banner?.badge || '',
    cta_text: banner?.cta_text || '',
    cta_link: banner?.cta_link || '',
    image_desktop: banner?.image_desktop || '',
    image_mobile: banner?.image_mobile || '',
    is_active: banner ? Boolean(banner.is_active) : true,
    display_order: banner?.display_order ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.image_desktop) {
      setError('Título e imagem desktop são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, is_active: form.is_active ? 1 : 0 };
      if (isNew) await api.admin.createBanner(payload);
      else await api.admin.updateBanner(banner!.id, payload);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? 'Novo Banner' : 'Editar Banner'}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Título *</label>
              <input className={styles.formInput} value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Subtítulo</label>
              <input className={styles.formInput} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Badge (ex: Novo)</label>
              <input className={styles.formInput} value={form.badge} onChange={e => set('badge', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Texto do Botão (CTA)</label>
              <input className={styles.formInput} value={form.cta_text} onChange={e => set('cta_text', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Link do Botão</label>
              <input className={styles.formInput} value={form.cta_link} onChange={e => set('cta_link', e.target.value)} placeholder="#pulseiras" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagem Desktop *</label>
              <ImageField value={form.image_desktop} onChange={v => set('image_desktop', v)} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagem Mobile</label>
              <ImageField value={form.image_mobile} onChange={v => set('image_mobile', v)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Ordem de Exibição</label>
              <input type="number" className={styles.formInput} value={form.display_order} onChange={e => set('display_order', Number(e.target.value))} min={1} />
            </div>
            <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
              <label className={styles.switchLabel}>
                <input type="checkbox" className={styles.switchInput} checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                Banner ativo na loja
              </label>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? <><div className={styles.spinner} style={{ width: 13, height: 13 }} /> Salvando…</> : 'Salvar Banner'}
          </button>
        </div>
      </div>
    </div>
  );
}
