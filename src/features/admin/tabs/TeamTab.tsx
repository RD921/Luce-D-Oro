import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: EQUIPE (somente proprietário)
// ============================================================
export function TeamTab() {
  const [dados, setDados] = useState<Awaited<ReturnType<typeof api.admin.getTeam>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState('atendente');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const load = async () => {
    try { setDados(await api.admin.getTeam()); } catch {/* */}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const rodar = async (fn: () => Promise<{ message: string }>) => {
    try { const r = await fn(); setMsg({ ok: true, texto: r.message }); await load(); }
    catch (e: any) { setMsg({ ok: false, texto: e.message }); }
  };

  if (loading) return <div className={styles.loader}><div className={styles.spinner}/></div>;
  const papeis = dados?.papeis ?? [];

  return (
    <>
      <div className={styles.sectionHeader}><span className={styles.sectionTitle}>Equipe e níveis de acesso</span></div>
      {msg && <div className={`${styles.alertRow} ${msg.ok ? '' : styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{msg.texto}</div></div>}

      <div className={styles.tableWrapper} style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>Adicionar pessoa à equipe (ela precisa já ter conta na loja)</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input className={styles.formInput} style={{ flex: '1 1 240px' }} type="email" placeholder="e-mail da pessoa" value={email} onChange={e => setEmail(e.target.value)} />
          <select className={styles.formInput} style={{ width: 170 }} value={papel} onChange={e => setPapel(e.target.value)}>
            {papeis.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} disabled={!email.trim()} onClick={() => rodar(async () => { const r = await api.admin.addTeamMember(email, papel); setEmail(''); return r; })}>
            <Plus size={13} /> Adicionar
          </button>
        </div>
        <ul style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)', marginTop: '0.75rem', paddingLeft: '1.1rem' }}>
          {papeis.map(p => <li key={p.id}><strong>{p.label}:</strong> {p.descricao}</li>)}
        </ul>
      </div>

      <div className={styles.tableWrapper}>
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Nível</th><th></th></tr></thead>
          <tbody>
            {(dados?.membros.length ?? 0) === 0 && <tr><td colSpan={4} className={styles.emptyState}>Ninguém na equipe ainda.</td></tr>}
            {dados?.membros.map(m => (
              <tr key={m.id}>
                <td className={styles.productName}>{m.name}</td>
                <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{m.email}</td>
                <td>
                  <select className={styles.formInput} value={m.role} onChange={e => rodar(() => api.admin.setTeamRole(m.id, e.target.value))}>
                    {papeis.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </td>
                <td>
                  <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} title="Remover da equipe" onClick={() => { if (confirm(`Remover ${m.name} da equipe? Ela volta a ser cliente.`)) void rodar(() => api.admin.removeTeamMember(m.id)); }}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
