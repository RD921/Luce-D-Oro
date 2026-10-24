import { useEffect, useState } from 'react';
import { Monitor, Image as ImageIcon, MousePointer2, FileText, Users, ShieldCheck, Activity, ArrowRight, Search, Settings, Upload, Shield, Package, Tag } from 'lucide-react';
import { api, type AdminSite, type ArchitectureOverview } from '../../services/api';
import styles from './AdminPanel.module.css';

// Página inicial de Configurações → Arquitetura Adm.
// Tudo aqui vem do servidor. O que ainda não existe aparece como "em breve" ou "não verificado", nunca como sucesso.
const ESTADO: Record<string, { rotulo: string; dot: string }> = {
  ok: { rotulo: 'Operacional', dot: styles.dotOk },
  falha: { rotulo: 'Falha', dot: styles.dotFail },
  atencao: { rotulo: 'Atenção', dot: styles.dotWarn },
  nao_verificado: { rotulo: 'Não verificado', dot: '' },
};

const ACAO: Record<string, string> = {
  IMAGE_UPLOADED: 'Imagem enviada',
  UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT: 'Acesso negado',
  SETTINGS_UPDATED: 'Configurações alteradas',
};

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

interface Props {
  online: boolean | null;
  onOpenSection: (id: string) => void;
  onNavigate: (tab: string) => void;
  pode: (area: string) => boolean;
  sites: AdminSite[];
  siteId: string;
  onSelectSite: (id: string) => void;
  onSitesChanged: () => Promise<void> | void;
}

export function ArchitectureHome({ online, onOpenSection, pode, sites: listaSites, siteId, onSelectSite, onSitesChanged }: Props) {
  const [modal, setModal] = useState<null | { site?: AdminSite }>(null);
  const [d, setD] = useState<ArchitectureOverview | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const veTudo = pode('arquitetura');
  useEffect(() => { if (veTudo) api.admin.getArchitecture().then(setD).catch((e: Error) => setErro(e.message || 'Não foi possível carregar.')); }, [veTudo]);

  const todos: Array<{ icon: React.ReactNode; titulo: string; desc: string; abre: () => void; breve?: string; area: string }> = [
    { icon: <Monitor size={26} strokeWidth={1.3} />, titulo: 'Visão geral', desc: 'Acompanhe o estado do site, os números da loja e as verificações técnicas.', abre: () => onOpenSection('visao'), area: 'arquitetura' },
    { icon: <ImageIcon size={26} strokeWidth={1.3} />, titulo: 'Biblioteca de mídia', desc: 'Gerencie imagens, arquivos e recursos visuais.', abre: () => onOpenSection('midia'), area: 'uploads' },
    { icon: <MousePointer2 size={26} strokeWidth={1.3} />, titulo: 'Editor visual', desc: 'Edite textos e imagens do site com rascunhos, versões e publicação.', abre: () => onOpenSection('editor'), area: 'conteudo' },
    { icon: <FileText size={26} strokeWidth={1.3} />, titulo: 'Páginas e conteúdo', desc: 'Organize páginas, seções e textos do site.', abre: () => onOpenSection('conteudo'), area: 'conteudo' },
    { icon: <Tag size={26} strokeWidth={1.3} />, titulo: 'Banners', desc: 'Faixas e imagens de destaque da página inicial.', abre: () => onOpenSection('banners'), area: 'banners' },
    { icon: <Users size={26} strokeWidth={1.3} />, titulo: 'Sites e clientes', desc: 'Gerencie múltiplos sites e clientes em um só lugar.', abre: () => onOpenSection('sites'), area: 'arquitetura' },
    { icon: <ShieldCheck size={26} strokeWidth={1.3} />, titulo: 'Segurança e permissões', desc: 'Configure funções, acessos e proteja seus dados.', abre: () => onOpenSection('acesso'), area: 'arquitetura' },
    { icon: <Activity size={26} strokeWidth={1.3} />, titulo: 'Diagnóstico e auditoria', desc: 'Monitore logs, integrações e o estado do sistema.', abre: () => onOpenSection('diag'), area: 'arquitetura' },
  ];

  const cartoes = todos.filter(c => pode(c.area));

  const host = typeof window !== 'undefined' ? window.location.host : '';
  const nomeSite = d?.site.nome || "Luce D'Oro";
  const sites = listaSites.filter(x => !busca.trim() || `${x.nome} ${x.cliente} ${x.dominio ?? ''}`.toLowerCase().includes(busca.toLowerCase()));
  const sitAtual = listaSites.find(x => x.id === siteId);
  const situacao = (st: string) => (st === 'ativo' ? { t: 'Ativo', d: styles.dotOk } : st === 'em_construcao' ? { t: 'Em construção', d: styles.dotWarn } : { t: 'Arquivado', d: '' });
  const abrirEditor = (id: string) => { onSelectSite(id); onOpenSection('editor'); };

  const v = (id: string) => d?.verificacoes.find(x => x.id === id);
  const itensEstado: Array<{ nome: string; icon: React.ReactNode; rotulo: string; dot: string }> = [
    { nome: 'Servidor', icon: <Settings size={16} strokeWidth={1.4} />, rotulo: online === null ? 'Verificando…' : online ? 'Online' : 'Sem resposta', dot: online ? styles.dotOk : online === false ? styles.dotFail : '' },
    { nome: 'Banco de dados', icon: <Package size={16} strokeWidth={1.4} />, rotulo: v('banco') ? ESTADO[v('banco')!.estado].rotulo : '—', dot: v('banco') ? ESTADO[v('banco')!.estado].dot : '' },
    { nome: 'Armazenamento', icon: <Upload size={16} strokeWidth={1.4} />, rotulo: v('persistencia') ? ESTADO[v('persistencia')!.estado].rotulo : '—', dot: v('persistencia') ? ESTADO[v('persistencia')!.estado].dot : '' },
    { nome: 'API de pagamentos', icon: <Shield size={16} strokeWidth={1.4} />, rotulo: 'Não integrada', dot: '' },
    { nome: 'Integrações externas', icon: <Activity size={16} strokeWidth={1.4} />, rotulo: 'Não verificado', dot: '' },
  ];

  return (
    <>
      <div className={styles.archHead}>
        <div>
          <h2 className={styles.archTitle}>Arquitetura Administrativa</h2>
          <p className={styles.archDesc}>Gerencie a estrutura, os recursos e a publicação do seu site.</p>
        </div>
        <div className={styles.siteSelect} title="Troque o site em edição na barra acima">
          <Monitor size={15} strokeWidth={1.4} /> {sitAtual?.nome || nomeSite}{sitAtual?.principal ? ' (loja principal)' : ''}
        </div>
      </div>

      {erro && <div className={styles.emptyState}>{erro}</div>}

      <div className={styles.archCards}>
        {cartoes.map(c => (
          <button key={c.titulo} className={styles.archCard} onClick={c.abre}>
            <div className={styles.archCardTop}>{c.icon}<ArrowRight size={16} className={styles.archCardArrow} /></div>
            <div className={styles.archCardTitle}>{c.titulo}</div>
            <div className={styles.archCardDesc}>{c.desc}</div>
            {c.breve && <span className={styles.soon}>Em breve · {c.breve}</span>}
          </button>
        ))}
      </div>

      {veTudo && (<>
      <div className={styles.archPanel}>
        <div className={styles.archPanelHead}>
          <span className={styles.archPanelTitle}>Sites e clientes</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button data-testid="adicionar-site" className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={() => setModal({})}>+ Adicionar site</button>
            <div className={styles.relative}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--adm-text-dim)' }} />
              <input className={styles.searchBox} style={{ paddingLeft: 30 }} placeholder="Buscar sites…" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.archTable}>
            <thead><tr><th>Site</th><th>Cliente</th><th>Domínio</th><th>Situação</th><th>Imagens</th><th>Última publicação</th><th>Ações</th></tr></thead>
            <tbody>
              {sites.length === 0 && <tr><td colSpan={7}>Nenhum site encontrado.</td></tr>}
              {sites.map(x => {
                const sit = situacao(x.status);
                const ini = x.nome.split(/[\s']+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
                return (
                  <tr key={x.id} data-testid="linha-site" style={x.id === siteId ? { background: 'var(--adm-hover)' } : undefined}>
                    <td><div className={styles.siteCell}><span className={styles.siteTile}>{ini}</span><span>{x.nome}<span className={styles.siteSub}>{x.principal ? 'Loja principal' : x.tipo}</span></span></div></td>
                    <td>{x.cliente || '—'}</td>
                    <td>{x.dominio || (x.principal ? host : '—')}</td>
                    <td><span className={styles.sysStatus}><span className={`${styles.dot} ${sit.d}`} />{sit.t}</span></td>
                    <td>{x.midias ?? 0}</td>
                    <td>{fmt(x.ultimaPublicacao ?? null)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={x.status === 'arquivado'} onClick={() => abrirEditor(x.id)}>Editar site</button>{' '}
                      <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setModal({ site: x })}>Dados</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.archBottom}>
        <div className={styles.archPanel} style={{ marginBottom: 0 }}>
          <div className={styles.archPanelHead}><span className={styles.archPanelTitle}>Atividade recente</span><button className={styles.archBack} style={{ padding: 0 }} onClick={() => onOpenSection('diag')}>Ver todas</button></div>
          <div className={styles.archList}>
            {!d && !erro && <div className={styles.archRow}>Carregando…</div>}
            {d && d.eventosRecentes.length === 0 && <div className={styles.archRow}>Nenhuma atividade registrada ainda.</div>}
            {d?.eventosRecentes.slice(0, 4).map(e => (
              <div key={e.id} className={styles.archRow}>
                <span><span className={styles.archRowMain}>{ACAO[e.action] || e.action}</span><br />{e.user_email || 'Sistema'} · {e.entity}{e.entity_id ? ` #${e.entity_id}` : ''}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{fmt(e.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.archPanel} style={{ marginBottom: 0 }}>
          <div className={styles.archPanelHead}><span className={styles.archPanelTitle}>Estado do sistema</span><button className={styles.archBack} style={{ padding: 0 }} onClick={() => onOpenSection('diag')}>Ver detalhes</button></div>
          <div className={styles.archList}>
            {itensEstado.map(i => (
              <div key={i.nome} className={styles.archRow}>
                <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>{i.icon}<span className={styles.archRowMain}>{i.nome}</span></span>
                <span className={styles.sysStatus}><span className={`${styles.dot} ${i.dot}`} />{i.rotulo}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.archPanel} style={{ marginBottom: 0 }}>
          <div className={styles.archPanelHead}><span className={styles.archPanelTitle}>Resumo do site atual</span></div>
          <div className={styles.archList}>
            <div className={styles.archRow}><span>Site</span><span className={styles.archRowMain}>{sitAtual?.nome || nomeSite}</span></div>
            <div className={styles.archRow}><span>Endereço</span><span className={styles.archRowMain}>{sitAtual ? (sitAtual.dominio || (sitAtual.principal ? host : '—')) : d?.site.dominio || host}</span></div>
            <div className={styles.archRow}><span>Ambiente</span><span className={styles.archRowMain}>{d?.site.ambiente || '—'}</span></div>
            <div className={styles.archRow}><span>Última atividade</span><span className={styles.archRowMain}>{fmt(d?.ultimaAtividade ?? null)}</span></div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 12, flexWrap: 'wrap' }}>
              <a className={`${styles.btnSmall} ${styles.btnSmallGhost}`} href="/" target="_blank" rel="noopener noreferrer">Abrir site</a>
              <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => onOpenSection('editor')}>Editor visual</button>
            </div>
          </div>
        </div>
      </div>
      </>)}
      {modal && <SiteModal site={modal.site} onClose={() => setModal(null)} onSaved={async (criado) => { setModal(null); await onSitesChanged(); if (criado) onSelectSite(criado); }} />}
    </>
  );
}

function SiteModal({ site, onClose, onSaved }: { site?: AdminSite; onClose: () => void; onSaved: (idCriado?: string) => void | Promise<void> }) {
  const [nome, setNome] = useState(site?.nome ?? '');
  const [cliente, setCliente] = useState(site?.cliente ?? '');
  const [dominio, setDominio] = useState(site?.dominio ?? '');
  const [tipo, setTipo] = useState(site?.tipo ?? 'Loja');
  const [status, setStatus] = useState<string>(site?.status ?? 'em_construcao');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true); setErro('');
    try {
      if (site) { await api.admin.updateSite(site.id, { nome, cliente, dominio, tipo, status }); await onSaved(); }
      else { const r = await api.admin.createSite({ nome, cliente, dominio, tipo }); await onSaved(r.id); }
    } catch (e: any) { setErro(e.message || 'Não foi possível salvar.'); }
    setSalvando(false);
  };
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}><div className={styles.modalTitle}>{site ? `Dados do site — ${site.nome}` : 'Adicionar site'}</div></div>
        <div className={styles.modalBody}>
          <label className={styles.formLabel}>Nome do site</label>
          <input data-testid="site-nome" className={styles.formInput} value={nome} onChange={e => setNome(e.target.value)} maxLength={80} />
          <label className={styles.formLabel} style={{ marginTop: 10, display: 'block' }}>Cliente</label>
          <input className={styles.formInput} value={cliente} onChange={e => setCliente(e.target.value)} maxLength={80} />
          <label className={styles.formLabel} style={{ marginTop: 10, display: 'block' }}>Endereço (domínio)</label>
          <input data-testid="site-dominio" className={styles.formInput} value={dominio} onChange={e => setDominio(e.target.value)} placeholder="www.seusite.com.br" />
          <p style={{ fontSize: '.72rem', color: 'var(--adm-text-muted)', margin: '4px 0 0' }}>Visitantes que chegarem por este endereço veem o conteúdo deste site. O endereço precisa apontar para este servidor.</p>
          <label className={styles.formLabel} style={{ marginTop: 10, display: 'block' }}>Tipo</label>
          <input className={styles.formInput} value={tipo} onChange={e => setTipo(e.target.value)} maxLength={40} />
          {site && (<>
            <label className={styles.formLabel} style={{ marginTop: 10, display: 'block' }}>Situação</label>
            <select className={styles.formInput} value={status} onChange={e => setStatus(e.target.value)} disabled={site.principal && false}>
              <option value="ativo">Ativo</option><option value="em_construcao">Em construção</option>
              {!site.principal && <option value="arquivado">Arquivado (para de responder pelo endereço)</option>}
            </select>
          </>)}
          {erro && <div style={{ color: '#e57373', marginTop: 10, fontSize: '.85rem' }}>{erro}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button data-testid="salvar-site" className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : site ? 'Salvar' : 'Criar site'}</button>
        </div>
      </div>
    </div>
  );
}
