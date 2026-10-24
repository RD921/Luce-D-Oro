import { useState, useEffect } from 'react';
import { useSite } from '../../../context/SiteContext';
import { api } from '../../../services/api';
import { ImageField } from './shared';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: CONTEÚDO (textos e imagens da loja)
// ============================================================
export type CampoConteudo = Awaited<ReturnType<typeof api.admin.getContent>>[number];


export function ContentTab() {
  const { refreshContent } = useSite();
  const [campos, setCampos] = useState<CampoConteudo[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const lista = (await api.admin.getContent()).filter(c => c.type !== 'position');
      setCampos(lista);
      setValores(Object.fromEntries(lista.map(c => [c.key, c.value])));
    } catch (e: any) { setMsg(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const alterados = campos.filter(c => (valores[c.key] ?? '') !== c.value);

  const salvar = async () => {
    setSaving(true);
    setMsg('');
    try {
      const mudou: Record<string, string> = {};
      alterados.forEach(c => { mudou[c.key] = valores[c.key] ?? ''; });
      await api.admin.updateContent(mudou);
      await load();
      await refreshContent();
      setMsg('Conteúdo salvo. A loja já está com os novos textos.');
    } catch (e: any) { setMsg(e.message); }
    setSaving(false);
  };

  const grupos = Array.from(new Set(campos.map(c => c.group)));

  if (loading) return <div className={styles.loader}><div className={styles.spinner}/></div>;

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Textos e imagens da loja</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={salvar} disabled={saving || alterados.length === 0}>
          {saving ? 'Salvando…' : alterados.length ? `Salvar ${alterados.length} alteração(ões)` : 'Nada para salvar'}
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--adm-text-muted)', margin: '0 0 1rem' }}>
        A faixa principal da página inicial é editada em <strong>Banners</strong>. Contato, CNPJ e Instagram do rodapé vêm de <strong>Configurações</strong>.
        Apague um campo (ou clique em "Restaurar") para voltar ao texto original.
      </p>
      {msg && <div className={styles.alertRow} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{msg}</div></div>}

      {grupos.map(grupo => (
        <div key={grupo} className={styles.tableWrapper} style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{grupo}</div>
          <div className={styles.formGrid}>
            {campos.filter(c => c.group === grupo).map(c => (
              <div key={c.key} className={`${styles.formGroup} ${c.type === 'text' ? '' : styles.formGridFull}`}>
                <label className={styles.formLabel}>
                  {c.label}
                  {(valores[c.key] ?? '') !== c.def && (
                    <button type="button" className={`${styles.btnSmall} ${styles.btnSmallGhost}`} style={{ marginLeft: 8, padding: '0 6px' }} onClick={() => setValores(v => ({ ...v, [c.key]: c.def }))}>
                      Restaurar
                    </button>
                  )}
                </label>
                {c.type === 'image' ? (
                  <ImageField value={valores[c.key] ?? ''} onChange={v => setValores(x => ({ ...x, [c.key]: v }))} />
                ) : c.type === 'textarea' ? (
                  <textarea className={styles.formInput} rows={3} value={valores[c.key] ?? ''} onChange={e => setValores(v => ({ ...v, [c.key]: e.target.value }))} />
                ) : (
                  <input className={styles.formInput} value={valores[c.key] ?? ''} onChange={e => setValores(v => ({ ...v, [c.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
