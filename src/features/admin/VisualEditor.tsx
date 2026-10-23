import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Monitor, Smartphone, RotateCcw, ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import { MediaPicker } from './MediaLibrary';
import styles from './AdminPanel.module.css';

type Campo = { key: string; label: string; group: string; type: 'text' | 'textarea' | 'image' | 'position'; def: string; value: string; publicado: string; emRascunho: boolean; customized: boolean };
type Versao = { id: number; note: string; changed: number; created_by: string | null; created_at: string };
const quando = (s: string) => { const d = new Date(s.replace(' ', 'T') + 'Z'); return isNaN(d.getTime()) ? s : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); };

// Editor visual: o site aparece ao lado; clique num elemento marcado para editar texto ou imagem.
// Salvar guarda um RASCUNHO (só aparece na prévia). O site público só muda ao clicar em Publicar; cada publicação vira uma versão.
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
  const [alteracoes, setAlteracoes] = useState(0);
  const [painel, setPainel] = useState<null | 'publicar' | 'versoes' | 'descartar' | 'original'>(null);
  const [nota, setNota] = useState('');
  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  const carregar = useCallback(() => api.admin.getContentDraft().then(r => { setCampos(r.campos); setAlteracoes(r.alteracoes); }).catch((e: any) => setErro(e.message || 'Não foi possível carregar os campos.')), []);
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
      if (e.data?.tipo === 'ld-mover' && typeof e.data.key === 'string' && Number.isFinite(e.data.x) && Number.isFinite(e.data.y)) void moverElemento(e.data.key, e.data.x, e.data.y, !!e.data.celular);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [campos, escolher]);

  const atualizarPrevia = () => frame.current?.contentWindow?.postMessage({ tipo: 'ld-atualizar' }, window.location.origin);
  const fechar = () => { setPainel(null); setNota(''); };
  const executar = async (fn: () => Promise<string>) => {
    setOcupado(true); setErro('');
    try { const m = await fn(); const r = await api.admin.getContentDraft(); setCampos(r.campos); setAlteracoes(r.alteracoes); setChave(null); setMsg(m); atualizarPrevia(); fechar(); }
    catch (e: any) { setErro(e.message || 'Não foi possível concluir.'); }
    setOcupado(false);
  };
  const abrirVersoes = async () => { setPainel('versoes'); setErro(''); try { setVersoes(await api.admin.getContentVersions()); } catch (e: any) { setErro(e.message || 'Não foi possível carregar o histórico.'); } };

  // Posição arrastada no site → rascunho (computador: pos_*, celular: posm_*)
  const moverElemento = async (key: string, x: number, y: number, ehCelular: boolean) => {
    const campo = `${ehCelular ? 'posm_' : 'pos_'}${key}`;
    setErro(''); setMsg('');
    try {
      await api.admin.saveContentDraft({ [campo]: `${Math.max(-100, Math.min(100, x))},${Math.max(-2000, Math.min(2000, y))}` });
      const r = await api.admin.getContentDraft();
      setCampos(r.campos); setAlteracoes(r.alteracoes);
      setChave(key); setValor(r.campos.find(c => c.key === key)?.value ?? '');
      setMsg(`Posição salva no rascunho (${ehCelular ? 'celular' : 'computador'}). Publique para ir ao ar.`);
    } catch (e: any) { setErro(e.message || 'Não foi possível salvar a posição.'); }
    atualizarPrevia();
  };
  const restaurarPosicao = async (campo: string) => {
    setErro(''); setMsg('');
    try {
      await api.admin.saveContentDraft({ [campo]: '' });
      const r = await api.admin.getContentDraft();
      setCampos(r.campos); setAlteracoes(r.alteracoes);
      setMsg('Posição original restaurada (no rascunho).');
    } catch (e: any) { setErro(e.message || 'Não foi possível restaurar.'); }
    atualizarPrevia();
  };
  const posTexto = (k: string) => { const v = campos.find(c => c.key === k)?.value || ''; const m = /^(-?[\d.]+),(-?[\d.]+)$/.exec(v); return m ? `${m[1]}% · ${m[2]}px` : ''; };

  const atual = campos.find(c => c.key === chave) || null;
  const mudou = !!atual && valor !== atual.value;

  const salvar = async (novo: string) => {
    if (!atual) return;
    setSalvando(true); setErro(''); setMsg('');
    try {
      await api.admin.saveContentDraft({ [atual.key]: novo });
      const r = await api.admin.getContentDraft();
      setCampos(r.campos); setAlteracoes(r.alteracoes);
      const c = r.campos.find(x => x.key === atual.key);
      setValor(c ? c.value : novo);
      atualizarPrevia();
      setMsg(novo ? 'Salvo no rascunho. Publique para ir ao ar.' : 'Voltou ao padrão (no rascunho).');
    } catch (e: any) { setErro(e.message || 'Não foi possível salvar.'); }
    setSalvando(false);
  };

  const enviar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setEnviando(true); setErro('');
    try { const r = await api.admin.uploadImage(f); setValor(r.url); } catch (ex: any) { setErro(ex.message || 'Não foi possível enviar.'); }
    setEnviando(false);
  };

  const visiveis = campos.filter(c => c.type !== 'position');
  const grupos = Array.from(new Set(visiveis.map(c => c.group)));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 16, alignItems: 'start' }}>
      <div>
        <div data-testid="barra-rascunho" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--adm-border)', background: alteracoes ? 'rgba(234,179,8,.08)' : 'var(--adm-card)' }}>
          <span style={{ fontSize: '.82rem', flex: 1, minWidth: 180 }}>{alteracoes ? `${alteracoes} alteração(ões) em rascunho — ainda não publicadas` : 'Sem alterações pendentes. O site publicado está igual à prévia.'}</span>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} disabled={!alteracoes} onClick={() => setPainel('publicar')}>Publicar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={!alteracoes} onClick={() => setPainel('descartar')}>Descartar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={abrirVersoes}>Versões</button>
        </div>
        {msg && !atual && <div style={{ color: 'var(--adm-green)', fontSize: '.82rem', marginBottom: 8 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <button className={`${styles.btnSmall} ${celular ? styles.btnSmallGhost : styles.btnSmallPrimary}`} onClick={() => setCelular(false)}><Monitor size={13} /> Computador</button>
          <button className={`${styles.btnSmall} ${celular ? styles.btnSmallPrimary : styles.btnSmallGhost}`} onClick={() => setCelular(true)}><Smartphone size={13} /> Celular</button>
          <span style={{ flex: 1, color: 'var(--adm-text-muted)', fontSize: '.78rem' }}>Clique para editar o texto/imagem. Arraste para mudar de lugar.</span>
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
                {visiveis.filter(c => c.group === g).map(c => (
                  <button key={c.key} data-testid="campo-lista" onClick={() => escolher(c.key, campos)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', padding: '5px 0', fontSize: '.8rem', cursor: 'pointer' }}>
                    {c.label}{c.emRascunho ? ' ● rascunho' : c.customized ? ' •' : ''}
                  </button>
                ))}
              </div>
            ))}
          </>
        ) : (
          <>
            <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => escolher(null, campos)}>← Todos os elementos</button>
            <div style={{ marginTop: 12 }}><strong style={{ fontSize: '.9rem' }}>{atual.group.split(' — ').pop()}: {atual.label}</strong>
              <div style={{ fontSize: '.7rem', color: 'var(--adm-text-muted)' }}>{atual.group} · {atual.emRascunho ? 'em rascunho' : atual.customized ? 'personalizado' : 'original'}</div></div>

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

            {campos.some(c => c.key === `pos_${atual.key}`) && (
              <div data-testid="painel-posicao" style={{ marginTop: 14, padding: 10, border: '1px solid var(--adm-border)', borderRadius: 8, fontSize: '.78rem' }}>
                <strong>Posição</strong> <span style={{ color: 'var(--adm-text-muted)' }}>— arraste o elemento no site para mover</span>
                {([['pos_', 'Computador'], ['posm_', 'Celular']] as const).map(([pref, nome]) => (
                  <div key={pref} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ flex: 1 }}>{nome}: {posTexto(pref + atual.key) || 'original'}</span>
                    {posTexto(pref + atual.key) && <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => restaurarPosicao(pref + atual.key)}><RotateCcw size={12} /> Restaurar</button>}
                  </div>
                ))}
              </div>
            )}

            {erro && <div style={{ color: '#e57373', marginTop: 10, fontSize: '.82rem' }}>{erro}</div>}
            {msg && <div style={{ color: 'var(--adm-green)', marginTop: 10, fontSize: '.82rem' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} disabled={salvando || !mudou || !valor.trim()} onClick={() => salvar(valor)}>{salvando ? 'Salvando…' : 'Salvar'}</button>
              {atual.customized && <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={salvando} onClick={() => salvar('')}><RotateCcw size={13} /> Restaurar padrão</button>}
            </div>
            <p style={{ fontSize: '.7rem', color: 'var(--adm-text-muted)', marginTop: 10 }}>Salvar guarda no rascunho: só aparece na prévia. Para ir ao site, use Publicar.</p>
          </>
        )}
      </div>
      {painel && (
        <div className={styles.modalOverlay} onClick={fechar}>
          <div className={`${styles.modal} ${painel === 'versoes' ? styles.modalLarge : ''}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><div className={styles.modalTitle}>{painel === 'publicar' ? 'Publicar alterações' : painel === 'descartar' ? 'Descartar rascunho' : painel === 'original' ? 'Voltar ao original' : 'Histórico de versões'}</div></div>
            <div className={styles.modalBody}>
              {painel === 'publicar' && (<>
                <p style={{ fontSize: '.85rem' }}>{alteracoes} alteração(ões) vão ao ar agora para todos os visitantes. Uma versão é salva e você poderá voltar a ela.</p>
                <label className={styles.formLabel}>Observação (opcional)</label>
                <input data-testid="nota-publicacao" className={styles.formInput} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ex.: novo texto do manifesto" maxLength={200} />
              </>)}
              {painel === 'descartar' && <p style={{ fontSize: '.85rem' }}>Descartar as {alteracoes} alteração(ões) em rascunho? O site publicado não é afetado.</p>}
              {painel === 'original' && <p style={{ fontSize: '.85rem' }}>Isso coloca no rascunho todos os textos e imagens do padrão original. Nada vai ao ar até você publicar.</p>}
              {painel === 'versoes' && (versoes.length === 0
                ? <p style={{ fontSize: '.85rem', color: 'var(--adm-text-muted)' }}>Ainda não há versões. Elas aparecem a cada publicação.</p>
                : <div>{versoes.map((v, i) => (
                    <div key={v.id} data-testid="versao" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--adm-border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.85rem' }}>{v.note || 'Publicação'}{i === 0 ? ' · no ar agora' : ''}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--adm-text-muted)' }}>{quando(v.created_at)} · {v.created_by || '—'} · {v.changed} campo(s) alterado(s)</div>
                      </div>
                      {i > 0 && <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={ocupado} onClick={() => executar(async () => { const r = await api.admin.restoreContentVersion(v.id); return r.diferencas ? `Versão carregada no rascunho (${r.diferencas} diferença(s)). Confira e publique.` : 'Essa versão é igual ao que está no ar.'; })}>Restaurar no rascunho</button>}
                    </div>))}
                    <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} style={{ marginTop: 12 }} onClick={() => setPainel('original')}>Voltar tudo ao original…</button>
                  </div>)}
              {erro && <div style={{ color: '#e57373', marginTop: 10, fontSize: '.82rem' }}>{erro}</div>}
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={fechar}>{painel === 'versoes' ? 'Fechar' : 'Cancelar'}</button>
              {painel === 'publicar' && <button data-testid="confirmar-publicar" className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} disabled={ocupado} onClick={() => executar(async () => { const r = await api.admin.publishContent(nota); return `${r.publicados} alteração(ões) publicada(s) no site.`; })}>{ocupado ? 'Publicando…' : 'Publicar agora'}</button>}
              {painel === 'descartar' && <button className={`${styles.btnSmall} ${styles.btnSmallDanger}`} disabled={ocupado} onClick={() => executar(async () => { await api.admin.discardContentDraft(); return 'Rascunho descartado.'; })}>Descartar</button>}
              {painel === 'original' && <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} disabled={ocupado} onClick={() => executar(async () => { const r = await api.admin.resetContentDraft(); return r.diferencas ? `Original carregado no rascunho (${r.diferencas} campo(s)). Confira e publique.` : 'O site já está no original.'; })}>Carregar original no rascunho</button>}
            </div>
          </div>
        </div>
      )}
      {biblioteca && <MediaPicker onPick={u => setValor(u)} onClose={() => setBiblioteca(false)} />}
    </div>
  );
}
