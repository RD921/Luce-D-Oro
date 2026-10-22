import { useEffect, useState } from 'react';
import { Monitor, Image as ImageIcon, MousePointer2, FileText, RefreshCw, Users, ShieldCheck, Activity, ArrowRight, Search, Settings, Upload, Shield, Package } from 'lucide-react';
import { api, type ArchitectureOverview } from '../../services/api';
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
}

export function ArchitectureHome({ online, onOpenSection, onNavigate }: Props) {
  const [d, setD] = useState<ArchitectureOverview | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  useEffect(() => { api.admin.getArchitecture().then(setD).catch((e: Error) => setErro(e.message || 'Não foi possível carregar.')); }, []);

  const cartoes: Array<{ icon: React.ReactNode; titulo: string; desc: string; abre: () => void; breve?: string }> = [
    { icon: <Monitor size={26} strokeWidth={1.3} />, titulo: 'Visão geral', desc: 'Acompanhe o estado do site, os números da loja e as verificações técnicas.', abre: () => onOpenSection('visao') },
    { icon: <ImageIcon size={26} strokeWidth={1.3} />, titulo: 'Biblioteca de mídia', desc: 'Gerencie imagens, arquivos e recursos visuais.', abre: () => onOpenSection('midia') },
    { icon: <MousePointer2 size={26} strokeWidth={1.3} />, titulo: 'Editor visual', desc: 'Edite o conteúdo do site de forma simples e intuitiva.', abre: () => onOpenSection('editor') },
    { icon: <FileText size={26} strokeWidth={1.3} />, titulo: 'Páginas e conteúdo', desc: 'Organize páginas, seções e textos do site.', abre: () => onNavigate('content') },
    { icon: <RefreshCw size={26} strokeWidth={1.3} />, titulo: 'Versões e publicação', desc: 'Controle rascunhos, histórico e publique alterações.', abre: () => onOpenSection('versoes'), breve: 'Fase 5' },
    { icon: <Users size={26} strokeWidth={1.3} />, titulo: 'Sites e clientes', desc: 'Gerencie múltiplos sites e clientes em um só lugar.', abre: () => onOpenSection('sites') },
    { icon: <ShieldCheck size={26} strokeWidth={1.3} />, titulo: 'Segurança e permissões', desc: 'Configure funções, acessos e proteja seus dados.', abre: () => onOpenSection('acesso') },
    { icon: <Activity size={26} strokeWidth={1.3} />, titulo: 'Diagnóstico e auditoria', desc: 'Monitore logs, integrações e o estado do sistema.', abre: () => onOpenSection('diag') },
  ];

  const host = typeof window !== 'undefined' ? window.location.host : '';
  const nomeSite = d?.site.nome || "Luce D'Oro";
  const iniciais = nomeSite.split(/[\s']+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  const sites = [{ id: d?.site.id || 'luce-d-oro', nome: nomeSite, tipo: 'Loja principal', cliente: nomeSite, dominio: d?.site.dominio || host, tecnologia: 'React + Vite', ult: d?.ultimaAtividade ?? null }]
    .filter(s => !busca.trim() || `${s.nome} ${s.cliente} ${s.dominio}`.toLowerCase().includes(busca.toLowerCase()));

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
        <div className={styles.siteSelect} title="Apenas um site cadastrado. Outros sites chegam na fase 2.">
          <Monitor size={15} strokeWidth={1.4} /> {nomeSite} (loja principal)
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

      <div className={styles.archPanel}>
        <div className={styles.archPanelHead}>
          <span className={styles.archPanelTitle}>Sites e clientes</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled title="O cadastro de novos sites chega na fase 2" style={{ opacity: 0.55, cursor: 'not-allowed' }}>+ Adicionar site</button>
            <div className={styles.relative}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--adm-text-dim)' }} />
              <input className={styles.searchBox} style={{ paddingLeft: 30 }} placeholder="Buscar sites…" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.archTable}>
            <thead><tr><th>Site</th><th>Cliente</th><th>Domínio</th><th>Tecnologia</th><th>Status</th><th>Última atividade</th><th>Ações</th></tr></thead>
            <tbody>
              {sites.length === 0 && <tr><td colSpan={7}>Nenhum site encontrado.</td></tr>}
              {sites.map(s => (
                <tr key={s.id}>
                  <td><div className={styles.siteCell}><span className={styles.siteTile}>{iniciais || 'LD'}</span><span>{s.nome}<span className={styles.siteSub}>{s.tipo}</span></span></div></td>
                  <td>{s.cliente}</td>
                  <td>{s.dominio || '—'}</td>
                  <td>{s.tecnologia}</td>
                  <td><span className={styles.sysStatus}><span className={`${styles.dot} ${online ? styles.dotOk : online === false ? styles.dotFail : ''}`} />{online === null ? 'Verificando…' : online ? 'Online' : 'Sem resposta'}</span></td>
                  <td>{fmt(s.ult)}</td>
                  <td><a href="/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--adm-gold-light)', fontSize: '.78rem' }}>Abrir site</a></td>
                </tr>
              ))}
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
            <div className={styles.archRow}><span>Site</span><span className={styles.archRowMain}>{nomeSite}</span></div>
            <div className={styles.archRow}><span>Endereço</span><span className={styles.archRowMain}>{d?.site.dominio || host}</span></div>
            <div className={styles.archRow}><span>Ambiente</span><span className={styles.archRowMain}>{d?.site.ambiente || '—'}</span></div>
            <div className={styles.archRow}><span>Última atividade</span><span className={styles.archRowMain}>{fmt(d?.ultimaAtividade ?? null)}</span></div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 12, flexWrap: 'wrap' }}>
              <a className={`${styles.btnSmall} ${styles.btnSmallGhost}`} href="/" target="_blank" rel="noopener noreferrer">Abrir site</a>
              <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => onOpenSection('editor')}>Editor visual</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
