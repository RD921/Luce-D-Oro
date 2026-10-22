import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Search, Copy, Trash2, RefreshCw, X, Check } from 'lucide-react';
import { api, type MediaItem } from '../../services/api';
import styles from './AdminPanel.module.css';

// Biblioteca de mídia. Em modo "escolher" (onPick) devolve o endereço da imagem selecionada.
const tamanho = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const dataBR = (s: string) => { const d = new Date(s.replace(' ', 'T') + 'Z'); return isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR'); };

export function MediaLibrary({ onPick }: { onPick?: (url: string) => void }) {
  const [cats, setCats] = useState<Array<{ id: string; nome: string }>>([]);
  const [itens, setItens] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [tipo, setTipo] = useState('');
  const [ordem, setOrdem] = useState('date');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [envio, setEnvio] = useState<{ cat: string; enviando: boolean }>({ cat: 'geral', enviando: false });
  const [sel, setSel] = useState<MediaItem | null>(null);
  const POR_PAGINA = 24;

  useEffect(() => { api.admin.mediaCategorias().then(setCats).catch(() => {}); }, []);

  const carregar = useCallback(() => {
    setLoading(true);
    api.admin.mediaList({ q, category: cat, type: tipo, sort: ordem, from: de, to: ate, page: pagina, pageSize: POR_PAGINA })
      .then(r => { setItens(r.itens); setTotal(r.total); setErro(''); })
      .catch((e: any) => setErro(e.message || 'Não foi possível carregar a biblioteca.'))
      .finally(() => setLoading(false));
  }, [q, cat, tipo, ordem, de, ate, pagina]);
  useEffect(() => { const t = setTimeout(carregar, 200); return () => clearTimeout(t); }, [carregar]);

  const enviar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (!arquivos.length) return;
    setEnvio(x => ({ ...x, enviando: true })); setMsg(''); setErro('');
    const falhas: string[] = []; let ok = 0;
    for (const f of arquivos) {
      try { await api.admin.mediaUpload(f, envio.cat); ok++; } catch (ex: any) { falhas.push(`${f.name}: ${ex.message}`); }
    }
    setEnvio(x => ({ ...x, enviando: false }));
    setMsg(ok ? `${ok} imagem(ns) enviada(s).` : '');
    if (falhas.length) setErro(falhas.join(' · '));
    setPagina(1); carregar();
  };

  const nomeCat = (id: string) => cats.find(c => c.id === id)?.nome || id;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const campo: React.CSSProperties = { width: 'auto', minWidth: 120 };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, opacity: .6 }} />
          <input className={styles.formInput} style={{ paddingLeft: 30 }} placeholder="Buscar por nome ou descrição" value={q} onChange={e => { setQ(e.target.value); setPagina(1); }} />
        </div>
        <select className={styles.formInput} style={campo} value={cat} onChange={e => { setCat(e.target.value); setPagina(1); }}>
          <option value="">Todas as categorias</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select className={styles.formInput} style={campo} value={tipo} onChange={e => { setTipo(e.target.value); setPagina(1); }}>
          <option value="">Todos os formatos</option>
          <option value="jpg">JPG</option><option value="png">PNG</option><option value="webp">WEBP</option><option value="gif">GIF</option>
        </select>
        <select className={styles.formInput} style={campo} value={ordem} onChange={e => setOrdem(e.target.value)}>
          <option value="date">Mais recentes</option><option value="name">Nome</option><option value="size">Tamanho</option><option value="usage">Mais usadas</option>
        </select>
        <input className={styles.formInput} style={{ width: 150 }} type="date" value={de} onChange={e => { setDe(e.target.value); setPagina(1); }} title="De" />
        <input className={styles.formInput} style={{ width: 150 }} type="date" value={ate} onChange={e => { setAte(e.target.value); setPagina(1); }} title="Até" />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <select className={styles.formInput} style={campo} value={envio.cat} onChange={e => setEnvio(x => ({ ...x, cat: e.target.value }))} aria-label="Categoria do envio">
          {cats.map(c => <option key={c.id} value={c.id}>Enviar para: {c.nome}</option>)}
        </select>
        <label className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} style={{ cursor: envio.enviando ? 'wait' : 'pointer' }}>
          <Upload size={13} /> {envio.enviando ? 'Enviando…' : 'Enviar imagens'}
          <input data-testid="media-input" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={enviar} disabled={envio.enviando} />
        </label>
        <span style={{ color: 'var(--adm-text-muted)', fontSize: '.8rem' }}>{total} arquivo(s) · JPG, PNG, WEBP ou GIF até 8 MB</span>
      </div>

      {msg && <div style={{ color: 'var(--adm-green)', marginBottom: 8 }}>{msg}</div>}
      {erro && <div style={{ color: '#e57373', marginBottom: 8 }}>{erro}</div>}

      {loading ? <div className={styles.loader}><div className={styles.spinner} /></div>
        : itens.length === 0 ? <div className={styles.emptyState}>Nenhuma imagem encontrada. Use “Enviar imagens” para começar.</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
            {itens.map(m => (
              <button key={m.id} data-testid="media-card" onClick={() => (onPick ? onPick(m.urlBase) : setSel(m))}
                style={{ textAlign: 'left', background: 'var(--adm-card)', border: '1px solid var(--adm-border)', borderRadius: 8, padding: 0, cursor: 'pointer', overflow: 'hidden', color: 'inherit' }}>
                <div style={{ aspectRatio: '1', background: '#05090c' }}>
                  <img src={m.url} alt={m.alt || m.nome} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: '.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nome}</div>
                  <div style={{ fontSize: '.7rem', color: 'var(--adm-text-muted)' }}>{nomeCat(m.categoria)} · {tamanho(m.bytes)}</div>
                  <div style={{ fontSize: '.7rem', color: m.usos ? 'var(--adm-green)' : 'var(--adm-text-muted)' }}>{m.usos ? `Em uso (${m.usos})` : 'Sem uso'}</div>
                </div>
              </button>
            ))}
          </div>
        )}

      {paginas > 1 && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <span style={{ fontSize: '.8rem' }}>Página {pagina} de {paginas}</span>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}>Próxima</button>
        </div>
      )}

      {sel && <MediaDetalhe item={sel} cats={cats} onClose={() => setSel(null)} onChanged={() => { setSel(null); carregar(); }} />}
    </div>
  );
}

function MediaDetalhe({ item, cats, onClose, onChanged }: { item: MediaItem; cats: Array<{ id: string; nome: string }>; onClose: () => void; onChanged: () => void }) {
  const [m, setM] = useState<MediaItem>(item);
  const [nome, setNome] = useState(item.nome);
  const [alt, setAlt] = useState(item.alt);
  const [categoria, setCategoria] = useState(item.categoria);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [locais, setLocais] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const refTroca = useRef<HTMLInputElement>(null);

  useEffect(() => { api.admin.mediaGet(item.id).then(r => { setM(r); setLocais(r.locais || []); }).catch(() => {}); }, [item.id]);

  const rodar = async (fn: () => Promise<void>) => {
    setBusy(true); setErro(''); setOk('');
    try { await fn(); } catch (e: any) { setErro(e.message || 'Falha na operação.'); }
    setBusy(false);
  };
  const salvar = () => rodar(async () => { const r = await api.admin.mediaUpdate(m.id, { nome, alt, categoria }); setM(r); setOk('Alterações salvas.'); });
  const trocar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    rodar(async () => { const r = await api.admin.mediaReplace(m.id, f); setM(r); setOk('Imagem substituída. Todos os locais que a usam já mostram a nova.'); });
  };
  const excluir = () => rodar(async () => {
    try { await api.admin.mediaDelete(m.id); onChanged(); }
    catch (e: any) {
      const r = await api.admin.mediaGet(m.id).catch(() => null);
      if (r?.locais?.length) setLocais(r.locais);
      setConfirmar(false);
      throw e;
    }
  });
  const copiar = () => { navigator.clipboard?.writeText(location.origin + m.urlBase).then(() => setOk('Endereço copiado.')).catch(() => setErro('Não foi possível copiar.')); };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><div className={styles.modalTitle}>{m.nome}</div><button className={styles.modalCloseBtn} onClick={onClose} aria-label="Fechar"><X size={16} /></button></div>
        <div className={styles.modalBody} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }}>
          <div>
            <img src={m.url} alt={m.alt || m.nome} style={{ width: '100%', borderRadius: 8, background: '#05090c' }} />
            <p style={{ fontSize: '.75rem', color: 'var(--adm-text-muted)', marginTop: 8, lineHeight: 1.7 }}>
              {m.mime.replace('image/', '').toUpperCase()} · {m.largura && m.altura ? `${m.largura}×${m.altura}px · ` : ''}{tamanho(m.bytes)}<br />
              Enviada em {dataBR(m.criadoEm)}{m.enviadoPor ? ` por ${m.enviadoPor}` : ''}<br />
              <code>{m.urlBase}</code>
            </p>
          </div>
          <div>
            <label className={styles.formLabel}>Nome</label>
            <input className={styles.formInput} value={nome} onChange={e => setNome(e.target.value)} />
            <label className={styles.formLabel} style={{ marginTop: 10, display: 'block' }}>Texto alternativo (acessibilidade e SEO)</label>
            <input className={styles.formInput} value={alt} onChange={e => setAlt(e.target.value)} placeholder="Descreva a imagem" />
            <label className={styles.formLabel} style={{ marginTop: 10, display: 'block' }}>Categoria</label>
            <select className={styles.formInput} value={categoria} onChange={e => setCategoria(e.target.value)}>{cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>

            <div style={{ marginTop: 14 }}>
              <strong style={{ fontSize: '.8rem' }}>Onde é usada</strong>
              {locais.length ? <ul style={{ margin: '6px 0 0 18px', fontSize: '.8rem' }}>{locais.map((l, i) => <li key={i}>{l}</li>)}</ul>
                : <p style={{ fontSize: '.8rem', color: 'var(--adm-text-muted)', margin: '4px 0 0' }}>Não está em uso em nenhum lugar.</p>}
            </div>
            {erro && <div style={{ color: '#e57373', marginTop: 10, fontSize: '.85rem' }}>{erro}</div>}
            {ok && <div style={{ color: 'var(--adm-green)', marginTop: 10, fontSize: '.85rem' }}><Check size={13} /> {ok}</div>}
          </div>
        </div>
        <div className={styles.modalFooter} style={{ flexWrap: 'wrap' }}>
          {!confirmar
            ? <button className={`${styles.btnSmall} ${styles.btnSmallDanger}`} disabled={busy} onClick={() => setConfirmar(true)}><Trash2 size={13} /> Excluir</button>
            : <><span style={{ fontSize: '.8rem' }}>Excluir definitivamente?</span><button className={`${styles.btnSmall} ${styles.btnSmallDanger}`} disabled={busy} onClick={excluir}>Sim, excluir</button><button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setConfirmar(false)}>Cancelar</button></>}
          <span style={{ flex: 1 }} />
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={copiar}><Copy size={13} /> Copiar endereço</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={busy} onClick={() => refTroca.current?.click()}><RefreshCw size={13} /> Substituir</button>
          <input ref={refTroca} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={trocar} />
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} disabled={busy} onClick={salvar}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

// Janela para escolher uma imagem da biblioteca (usada nos campos de imagem do painel)
export function MediaPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><div className={styles.modalTitle}>Escolher da biblioteca</div><button className={styles.modalCloseBtn} onClick={onClose} aria-label="Fechar"><X size={16} /></button></div>
        <div className={styles.modalBody}><MediaLibrary onPick={u => { onPick(u); onClose(); }} /></div>
      </div>
    </div>
  );
}
