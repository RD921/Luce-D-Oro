import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2 } from 'lucide-react';
import { useSite } from '../../../context/SiteContext';
import { api, type Category } from '../../../services/api';
import { ImageField } from './shared';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: CATEGORIAS
// ============================================================
export function CategoriesTab() {
  const { refreshCategories } = useSite();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await api.admin.getCategories()); } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const afterChange = () => { load(); void refreshCategories(); };

  const [movendo, setMovendo] = useState<{ cat: Category; destino: string } | null>(null);

  const handleDelete = async (c: Category) => {
    if ((c.product_count ?? 0) > 0) {
      const outras = items.filter(x => x.id !== c.id);
      if (outras.length === 0) { alert('Esta categoria tem produtos e não há outra para recebê-los. Crie outra categoria primeiro.'); return; }
      setMovendo({ cat: c, destino: outras[0].id });
      return;
    }
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    try { await api.admin.deleteCategory(c.id); afterChange(); } catch (e: any) { alert(e.message); }
  };

  const confirmarMover = async () => {
    if (!movendo) return;
    try { await api.admin.deleteCategory(movendo.cat.id, movendo.destino); setMovendo(null); afterChange(); } catch (e: any) { alert(e.message); }
  };

  const mover = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const ids = items.map(c => c.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await api.admin.reorderCategories(ids); afterChange(); } catch (e: any) { alert(e.message); }
  };

  const toggleActive = async (c: Category) => {
    try { await api.admin.updateCategory(c.id, { is_active: c.is_active ? 0 : 1 }); afterChange(); } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Categorias da Loja</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={() => setCreating(true)}>
          <Plus size={13} /> Nova Categoria
        </button>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
          <table>
            <thead><tr><th>Imagem</th><th>Nome</th><th>Endereço</th><th>Produtos</th><th>Ordem</th><th>Na loja</th><th>Ações</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={7} className={styles.emptyState}>Nenhuma categoria criada.</td></tr>}
              {items.map((c, i) => (
                <tr key={c.id}>
                  <td>{c.image_url && <img src={c.image_url} alt={c.name} className={styles.productImg} style={{ width: 60, height: 36 }} onError={() => {}} />}</td>
                  <td className={styles.productName}>{c.name}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>#{c.slug}</td>
                  <td>{c.product_count ?? 0}</td>
                  <td>
                    <button className={styles.btnIcon} disabled={i === 0} onClick={() => mover(i, -1)} title="Subir">▲</button>
                    <button className={styles.btnIcon} disabled={i === items.length - 1} onClick={() => mover(i, 1)} title="Descer" style={{ marginLeft: 4 }}>▼</button>
                  </td>
                  <td>
                    <button className={`${styles.statusPill} ${c.is_active ? styles.statusConfirmed : styles.statusCancelled}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => toggleActive(c)} title="Clique para mostrar/esconder na loja">
                      {c.is_active ? 'Visível' : 'Oculta'}
                    </button>
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className={styles.btnIcon} onClick={() => setEditing(c)} title="Editar"><Edit2 size={13} /></button>
                      <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => handleDelete(c)} title="Excluir"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {movendo && (
        <div className={styles.modalOverlay} onClick={() => setMovendo(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Excluir "{movendo.cat.name}"</span>
              <button className={styles.modalCloseBtn} onClick={() => setMovendo(null)}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.85rem', marginTop: 0 }}>Esta categoria tem {movendo.cat.product_count} produto(s). Para onde eles devem ir?</p>
              <select className={styles.formInput} value={movendo.destino} onChange={e => setMovendo(m => m ? { ...m, destino: e.target.value } : null)}>
                {items.filter(x => x.id !== movendo.cat.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setMovendo(null)}>Cancelar</button>
              <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={confirmarMover}>Mover produtos e excluir</button>
            </div>
          </div>
        </div>
      )}
      {(editing || creating) && (
        <CategoryModal
          category={editing || undefined}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); afterChange(); }}
        />
      )}
    </>
  );
}


export function CategoryModal({ category, onClose, onSaved }: { category?: Category; onClose: () => void; onSaved: () => void }) {
  const isNew = !category;
  const [form, setForm] = useState({
    name: category?.name || '',
    description: category?.description || '',
    image_url: category?.image_url || '',
    display_order: category?.display_order ?? 0,
    is_active: category ? Boolean(category.is_active) : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('O nome da categoria é obrigatório.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, is_active: form.is_active ? 1 : 0 };
      if (isNew) await api.admin.createCategory(payload);
      else await api.admin.updateCategory(category!.id, payload);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? 'Nova Categoria' : 'Editar Categoria'}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Nome *</label>
              <input className={styles.formInput} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Anéis" />
              {!isNew && <span style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>O endereço (#{category!.slug}) não muda ao renomear, para não quebrar links.</span>}
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Descrição (aparece no topo da página da categoria)</label>
              <textarea className={styles.formInput} rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagem da categoria</label>
              <ImageField value={form.image_url} onChange={v => set('image_url', v)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Ordem no menu (menor aparece primeiro)</label>
              <input type="number" className={styles.formInput} value={form.display_order} onChange={e => set('display_order', Number(e.target.value))} />
            </div>
            <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
              <label className={styles.switchLabel}>
                <input type="checkbox" className={styles.switchInput} checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                Visível na loja
              </label>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar Categoria'}
          </button>
        </div>
      </div>
    </div>
  );
}
