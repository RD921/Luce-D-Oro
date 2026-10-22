import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { MediaPicker } from './MediaLibrary';
import styles from './AdminPanel.module.css';

const quando = (s: string) => { const d = new Date(s.replace(' ', 'T') + (s.includes('Z') || s.includes('T') ? '' : 'Z')); return isNaN(d.getTime()) ? s : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); };
const caixa: React.CSSProperties = { padding: '1.25rem' };

// ---------- SEO ----------
export function SeoSettings() {
  const [v, setV] = useState<Record<string, string> | null>(null);
  const [padrao, setPadrao] = useState<Record<string, string>>({});
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [biblioteca, setBiblioteca] = useState(false);
  useEffect(() => { api.admin.getSeo().then(r => { setV(r.valores); setPadrao(r.padrao); }).catch((e: any) => setErro(e.message || 'Não foi possível carregar.')); }, []);
  if (erro && !v) return <div className={styles.emptyState}>{erro}</div>;
  if (!v) return <div className={styles.loader}><div className={styles.spinner} /></div>;
  const set = (k: string, x: string) => { setV(o => ({ ...(o as Record<string, string>), [k]: x })); setMsg(''); };

  const salvar = async () => {
    setSalvando(true); setErro(''); setMsg('');
    try { const r = await api.admin.saveSeo(v); setV(r.valores); setMsg('SEO salvo. O site já usa os novos dados.'); } catch (e: any) { setErro(e.message || 'Não foi possível salvar.'); }
    setSalvando(false);
  };
  const titulo = v.seo_title || padrao.seo_title;
  const desc = v.seo_description || padrao.seo_description;
  const aviso: string[] = [];
  if (titulo.length > 60) aviso.push('O título passa de 60 caracteres: o Google pode cortá-lo.');
  if (desc.length > 160) aviso.push('A descrição passa de 160 caracteres: o Google pode cortá-la.');
  if (desc.length < 70) aviso.push('Descrição curta: use de 70 a 160 caracteres.');
  if (!v.seo_site_url) aviso.push('Endereço do site não informado: sem ele não há sitemap nem endereço canônico.');
  if (!v.seo_og_image) aviso.push('Sem imagem de compartilhamento: links enviados em redes sociais ficam sem foto.');
  if (v.seo_noindex === '1') aviso.push('O site está oculto dos buscadores (robots.txt bloqueia tudo).');
  const cont = (n: number, max: number) => <span style={{ fontSize: '.7rem', color: n > max ? 'var(--adm-yellow)' : 'var(--adm-text-muted)' }}>{n}/{max}</span>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <div className={styles.tableWrapper} style={caixa}>
        <div className={styles.sectionTitle}>Dados para buscadores e compartilhamento</div>
        <label className={styles.formLabel} style={{ marginTop: 12, display: 'block' }}>Título do site {cont(titulo.length, 60)}</label>
        <input className={styles.formInput} value={v.seo_title} onChange={e => set('seo_title', e.target.value)} placeholder={padrao.seo_title} />
        <label className={styles.formLabel} style={{ marginTop: 12, display: 'block' }}>Descrição {cont(desc.length, 160)}</label>
        <textarea className={styles.formInput} style={{ minHeight: 90 }} value={v.seo_description} onChange={e => set('seo_description', e.target.value)} placeholder={padrao.seo_description} />
        <label className={styles.formLabel} style={{ marginTop: 12, display: 'block' }}>Modelo do título das categorias (use {'{categoria}'})</label>
        <input className={styles.formInput} value={v.seo_category_title} onChange={e => set('seo_category_title', e.target.value)} placeholder={padrao.seo_category_title} />
        <label className={styles.formLabel} style={{ marginTop: 12, display: 'block' }}>Endereço do site</label>
        <input className={styles.formInput} value={v.seo_site_url} onChange={e => set('seo_site_url', e.target.value)} placeholder="https://www.seusite.com.br" />
        <label className={styles.formLabel} style={{ marginTop: 12, display: 'block' }}>Imagem de compartilhamento</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className={styles.formInput} style={{ flex: 1, minWidth: 160 }} value={v.seo_og_image} onChange={e => set('seo_og_image', e.target.value)} placeholder="Escolha da biblioteca ou cole um link https" />
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setBiblioteca(true)}>Biblioteca</button>
        </div>
        {v.seo_og_image && <img src={v.seo_og_image} alt="" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 140, borderRadius: 8 }} />}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: '.85rem' }}>
          <input type="checkbox" checked={v.seo_noindex === '1'} onChange={e => set('seo_noindex', e.target.checked ? '1' : '0')} /> Ocultar o site dos buscadores (use enquanto a loja não estiver pronta)
        </label>
        {erro && <div style={{ color: '#e57373', marginTop: 10, fontSize: '.85rem' }}>{erro}</div>}
        {msg && <div style={{ color: 'var(--adm-green)', marginTop: 10, fontSize: '.85rem' }}>{msg}</div>}
        <button data-testid="salvar-seo" className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} style={{ marginTop: 14 }} disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar SEO'}</button>
      </div>

      <div>
        <div className={styles.tableWrapper} style={caixa}>
          <div className={styles.sectionTitle}>Como aparece no Google</div>
          <div style={{ marginTop: 10, background: '#fff', borderRadius: 8, padding: '12px 14px', color: '#202124' }}>
            <div style={{ fontSize: '.75rem', color: '#4d5156' }}>{v.seo_site_url || 'https://seusite.com.br'}</div>
            <div style={{ fontSize: '1.1rem', color: '#1a0dab', margin: '2px 0' }}>{titulo.slice(0, 70)}</div>
            <div style={{ fontSize: '.85rem', color: '#4d5156' }}>{desc.slice(0, 170)}</div>
          </div>
        </div>
        <div className={styles.tableWrapper} style={{ ...caixa, marginTop: 16 }}>
          <div className={styles.sectionTitle}>Verificação</div>
          {aviso.length === 0 ? <p style={{ color: 'var(--adm-green)', fontSize: '.85rem' }}>Tudo certo com os dados informados.</p>
            : <ul style={{ margin: '8px 0 0 18px', fontSize: '.83rem', lineHeight: 1.7, color: 'var(--adm-yellow)' }}>{aviso.map(a => <li key={a}>{a}</li>)}</ul>}
          <p style={{ fontSize: '.75rem', color: 'var(--adm-text-muted)', marginTop: 12, lineHeight: 1.6 }}>
            Limite real: a loja é de página única. O Google executa o JavaScript e lê estes dados, mas prévias de WhatsApp e Instagram leem só o HTML inicial e podem não mostrar a imagem escolhida. O servidor também publica <code>/robots.txt</code> e <code>/sitemap.xml</code> (só com a página inicial), úteis se o site for servido por ele.
          </p>
        </div>
      </div>
      {biblioteca && <MediaPicker onPick={u => set('seo_og_image', u)} onClose={() => setBiblioteca(false)} />}
    </div>
  );
}

// ---------- Integrações ----------
const ROTULO: Record<string, { t: string; c: string }> = {
  ok: { t: 'Funcionando', c: 'var(--adm-green)' }, falha: { t: 'Falha', c: 'var(--adm-red)' },
  atencao: { t: 'Atenção', c: 'var(--adm-yellow)' }, nao_integrada: { t: 'Não integrada', c: 'var(--adm-text-muted)' },
};
export function IntegrationsPanel() {
  const [d, setD] = useState<Awaited<ReturnType<typeof api.admin.getIntegrations>> | null>(null);
  const [erro, setErro] = useState('');
  const [testando, setTestando] = useState(false);
  const carregar = () => { setTestando(true); setErro(''); api.admin.getIntegrations().then(setD).catch((e: any) => setErro(e.message || 'Não foi possível verificar.')).finally(() => setTestando(false)); };
  useEffect(carregar, []);
  return (
    <div className={styles.tableWrapper} style={caixa}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className={styles.sectionTitle} style={{ flex: 1 }}>Integrações</div>
        {d && <span style={{ fontSize: '.75rem', color: 'var(--adm-text-muted)' }}>Verificado em {quando(d.verificadoEm)}</span>}
        <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={testando} onClick={carregar}>{testando ? 'Verificando…' : 'Verificar agora'}</button>
      </div>
      <p style={{ fontSize: '.78rem', color: 'var(--adm-text-muted)', margin: '6px 0 10px' }}>Cada linha vem de uma verificação feita agora pelo servidor. O que não está conectado aparece como “Não integrada”, nunca como funcionando.</p>
      {erro && <div style={{ color: '#e57373' }}>{erro}</div>}
      {d?.itens.map(i => (
        <div key={i.id} data-testid="integracao" style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: '1px solid var(--adm-border)', alignItems: 'baseline' }}>
          <span style={{ width: 210, fontSize: '.88rem' }}>{i.nome}</span>
          <span style={{ width: 110, fontSize: '.8rem', color: ROTULO[i.estado].c }}>● {ROTULO[i.estado].t}</span>
          <span style={{ flex: 1, fontSize: '.8rem', color: 'var(--adm-text-muted)' }}>{i.detalhe}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Notificações ----------
const TIPO: Record<string, { t: string; c: string }> = { info: { t: 'Informação', c: 'var(--adm-text-muted)' }, aviso: { t: 'Aviso', c: 'var(--adm-yellow)' }, seguranca: { t: 'Segurança', c: 'var(--adm-red)' } };
export function NotificationsPanel() {
  const [tipo, setTipo] = useState('');
  const [d, setD] = useState<Awaited<ReturnType<typeof api.admin.getNotifications>> | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { setErro(''); api.admin.getNotifications(tipo, 100).then(setD).catch((e: any) => setErro(e.message || 'Não foi possível carregar.')); }, [tipo]);
  const marcar = async () => { await api.admin.markNotificationsRead().catch(() => {}); setD(await api.admin.getNotifications(tipo, 100)); };
  return (
    <div className={styles.tableWrapper} style={caixa}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className={styles.sectionTitle} style={{ flex: 1 }}>Central de notificações {d ? `(${d.naoLidas} não lida(s))` : ''}</div>
        <select className={styles.formInput} style={{ width: 'auto' }} value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="">Todas</option><option value="seguranca">Segurança</option><option value="aviso">Avisos</option><option value="info">Informações</option>
        </select>
        <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={marcar}>Marcar todas como lidas</button>
      </div>
      {erro && <div style={{ color: '#e57373', marginTop: 8 }}>{erro}</div>}
      {d && d.itens.length === 0 && <p style={{ color: 'var(--adm-text-muted)', fontSize: '.85rem', marginTop: 12 }}>Nenhuma notificação por aqui. Elas surgem quando alguém publica alterações, muda configurações, mexe na equipe ou algo dá errado.</p>}
      {d?.itens.map(n => (
        <div key={n.id} data-testid="notificacao" style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: '1px solid var(--adm-border)', opacity: n.lida ? 0.65 : 1 }}>
          <span style={{ width: 90, fontSize: '.75rem', color: TIPO[n.tipo].c }}>● {TIPO[n.tipo].t}</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: '.88rem', fontWeight: n.lida ? 400 : 600 }}>{n.titulo}</div>{n.mensagem && <div style={{ fontSize: '.75rem', color: 'var(--adm-text-muted)' }}>{n.mensagem}</div>}</div>
          <span style={{ fontSize: '.72rem', color: 'var(--adm-text-muted)' }}>{quando(n.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
