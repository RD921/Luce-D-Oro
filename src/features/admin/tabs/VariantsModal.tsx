import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import styles from '../AdminPanel.module.css';


// ---- Variações com estoque próprio ----
export function VariantsModal({ product, onClose, onSaved }: { product: { id: string; name: string; stock: number }; onClose: () => void; onSaved: () => void }) {
  const [linhas, setLinhas] = useState<Array<{ title: string; stock: string }>>([]);
  const [usa, setUsa] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.admin.getVariants(product.id).then(r => {
      setUsa(r.usaVariantes);
      if (r.usaVariantes) setLinhas(r.variantes.map(v => ({ title: v.title, stock: String(v.stock) })));
      else {
        // primeira vez: usa os nomes já cadastrados e coloca todo o estoque atual na primeira
        const nomes = r.titulosAntigos.length ? r.titulosAntigos : ['Único'];
        setLinhas(nomes.map((t, i) => ({ title: t, stock: String(i === 0 ? r.estoqueTotal : 0) })));
      }
    }).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }, [product.id]);

  const soma = linhas.reduce((a, l) => a + (Number(l.stock) || 0), 0);
  const mudar = (i: number, k: 'title' | 'stock', v: string) => setLinhas(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const salvar = async (vazio = false) => {
    setSaving(true); setError('');
    try {
      await api.admin.setVariants(product.id, vazio ? [] : linhas.map(l => ({ title: l.title.trim(), stock: Number(l.stock) })));
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Variações — {product.name}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
            <>
              <p style={{ fontSize: '0.78rem', color: 'var(--adm-text-muted)', marginTop: 0 }}>
                {usa ? 'Cada variação tem seu próprio estoque; o total do produto é a soma.' : `Hoje o produto tem um estoque único (${product.stock} un.). Ao salvar, ele passa a ser controlado por variação.`}
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {linhas.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <input className={styles.formInput} placeholder="Nome (ex: Aro 16)" value={l.title} onChange={e => mudar(i, 'title', e.target.value)} />
                    <input type="number" min={0} className={styles.formInput} style={{ width: 110 }} value={l.stock} onChange={e => mudar(i, 'stock', e.target.value)} />
                    <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} title="Remover" onClick={() => setLinhas(ls => ls.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
                <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setLinhas(ls => [...ls, { title: '', stock: '0' }])}><Plus size={12} /> Adicionar variação</button>
                <span style={{ fontSize: '0.8rem' }}>Total: <strong>{soma} un.</strong></span>
              </div>
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          {usa && <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} style={{ marginRight: 'auto', color: 'var(--adm-red)' }} disabled={saving} onClick={() => { if (confirm('Voltar ao estoque único? O total atual é mantido.')) void salvar(true); }}>Voltar ao estoque único</button>}
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} disabled={saving || loading || linhas.length === 0} onClick={() => salvar(false)}>{saving ? 'Salvando…' : 'Salvar variações'}</button>
        </div>
      </div>
    </div>
  );
}
