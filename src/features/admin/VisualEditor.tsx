import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Monitor, Smartphone, RotateCcw, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import { MediaPicker } from './MediaLibrary';
import styles from './AdminPanel.module.css';

type Campo = { key: string; label: string; group: string; type: 'text' | 'textarea' | 'image'; def: string; value: string; customized: boolean };

// Editor visual: o site aparece ao lado; clique num elemento marcado para editar texto ou imagem.
// Por enquanto salvar aplica na hora no site (rascunhos e versões chegam na próxima fase).
export function VisualEditor() {
  const [campos, setCampos] = useState<Campo[]>([]);
  const [chave, setChave] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [celular, setCelular] = useState(false);
  const [biblioteca, setBiblioteca] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  const carregar = useCallback(() => api.admin.getContent().then(setCampos).catch((e: any) => setErro(e.message || 'Não foi possível carregar os campos.')), []);
  useEffect(() => { void carregar(); }, [carregar]);

  const escolher = useCallback((key: string | null, lista: Campo[]) => {
    setChave(key); setMsg(''); setErro('');
    const c = lista.find(x => x.key === key);
    setValor(c ? c.value : '');
    frame.current?.contentWindow?.postMessage({ tipo: 'ld-marcar', key }, window.location.origin);
  }, []);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.tipo === 'ld-editar' && typeof e.data.key === 'string') escolher(e.data.key, campos);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [campos, escolher]);

  const atual = campos.find(c => c.key === chave) || null;
  const mudou = !!atual && valor !== atual.value;

  const salvar = async (novo: string) => {
    if (!atual) return;
    setSalvando(true); setErro(''); setMsg('');
    try {
      await api.admin.updateContent({ [atual.key]: novo });
      const lista = await api.admin.getContent();
      setCampos(lista);
      const c = lista.find(x => x.key === atual.key);
      setValor(c ? c.value : novo);
      frame.current?.contentWindow?.postMessage({ tipo: 'ld-atualizar' }, window.location.origin);
      setMsg(novo ? 'Salvo e aplicado no site.' : 'Voltou ao padrão.');
    } catch (e: any) { setErro(e.message || 'Não foi possível salvar.'); }
    setSalvando(false);
  };

  const enviar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setEnviando(true); setErro('');
    try { const r = await api.admin.uploadImage(f); setValor(r.url); } catch (ex: any) { setErro(ex.message || 'Não foi possível enviar.'); }
    setEnviando(false);
  };

  const grupos = Array.from(new Set(campos.map(c => c.group)));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 16, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <button className={`${styles.btnSmall} ${celular ? styles.btnSmallGhost : styles.btnSmallPrimary}`} onClick={() => setCelular(false)}><Monitor size={13} /> Computador</button>
          <button className={`${styles.btnSmall} ${celular ? styles.btnSmallPrimary : styles.btnSmallGhost}`} onClick={() => setCelular(true)}><Smartphone size={13} /> Celular</button>
          <span style={{ flex: 1, color: 'var(--adm-text-muted)', fontSize: '.78rem' }}>Clique em um elemento com contorno tracejado para editar.</span>
          <a className={`${styles.btnSmall} ${styles.btnSmallGhost}`} href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Abrir site</a>
        </div>
        <div style={{ background: '#05090c', border: '1px solid var(--adm-border)', borderRadius: 10, padding: celular ? 12 : 0, display: 'flex', justifyContent: 'center' }}>
          <iframe ref={frame} title="Prévia do site" data-testid="editor-frame" src="/?editor=1"
            style={{ border: 0, width: celular ? 390 : '100%', height: '72vh', background: '#fff', borderRadius: celular ? 8 : 10 }} />
        </div>
        <p style={{ fontSize: '.75rem', color: 'var(--adm-text-muted)', marginTop: 8 }}>
          Editáveis aqui: logos, textos e imagens da página inicial e do rodapé. Banners, categorias, produtos e contatos continuam nas suas próprias abas.
        </p>
      </div>

      <div style={{ background: 'var(--adm-card)', border: '1px solid var(--adm-border)', borderRadius: 10, padding: 14, position: 'sticky', top: 12, maxHeight: '80vh', overflowY: 'auto' }}>
        {!atual ? (
          <>
            <strong style={{ fontSize: '.9rem' }}>Elementos editáveis</strong>
            <p style={{ fontSize: '.78rem', color: 'var(--adm-text-muted)' }}>Clique no site ou escolha na lista.</p>
            {grupos.map(g => (
              <div key={g} style={{ marginTop: 10 }}>
                <div style={{ fontSize: '.68rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--adm-text-muted)' }}>{g}</div>
                {campos.filter(c => c.group === g).map(c => (
                  <button key={c.key} data-testid="campo-lista" onClick={() => escolher(c.key, campos)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', padding: '5px 0', fontSize: '.8rem', cursor: 'pointer' }}>
                    {c.label}{c.customized ? ' •' : ''}
                  </button>
                ))}
              </div>
            ))}
          </>
        ) : (
          <>
            <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => escolher(null, campos)}>← Todos os elementos</button>
            <div style={{ marginTop: 12 }}><strong style={{ fontSize: '.9rem' }}>{atual.label}</strong>
              <div style={{ fontSize: '.7rem', color: 'var(--adm-text-muted)' }}>{atual.group} · {atual.customized ? 'personalizado' : 'original'}</div></div>

            {atual.type === 'image' ? (
              <div style={{ marginTop: 12 }}>
                <img src={valor} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', background: '#05090c', borderRadius: 8 }} />
                <input className={styles.formInput} style={{ marginTop: 8 }} value={valor} onChange={e => setValor(e.target.value)} placeholder="Endereço da imagem" />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setBiblioteca(true)}><ImageIcon size={13} /> Biblioteca</button>
                  <label className={`${styles.btnSmall} ${styles.btnSmallGhost}`} style={{ cursor: enviando ? 'wait' : 'pointer' }}><Upload size={13} /> {enviando ? 'Enviando…' : 'Enviar'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={enviar} disabled={enviando} /></label>
                </div>
              </div>
            ) : atual.type === 'textarea' ? (
              <textarea data-testid="editor-input" className={styles.formInput} style={{ marginTop: 12, minHeight: 140 }} value={valor} onChange={e => setValor(e.target.value)} />
            ) : (
              <input data-testid="editor-input" className={styles.formInput} style={{ marginTop: 12 }} value={valor} onChange={e => setValor(e.target.value)} />
            )}

            {erro && <div style={{ color: '#e57373', marginTop: 10, fontSize: '.82rem' }}>{erro}</div>}
            {msg && <div style={{ color: 'var(--adm-green)', marginTop: 10, fontSize: '.82rem' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} disabled={salvando || !mudou || !valor.trim()} onClick={() => salvar(valor)}>{salvando ? 'Salvando…' : 'Salvar'}</button>
              {atual.customized && <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={salvando} onClick={() => salvar('')}><RotateCcw size={13} /> Restaurar padrão</button>}
            </div>
            <p style={{ fontSize: '.7rem', color: 'var(--adm-text-muted)', marginTop: 10 }}>Ao salvar, a alteração vai para o site na hora. Rascunhos e versões chegam na próxima fase.</p>
          </>
        )}
      </div>
      {biblioteca && <MediaPicker onPick={u => setValor(u)} onClose={() => setBiblioteca(false)} />}
    </div>
  );
}
