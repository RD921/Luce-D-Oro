import { useState, useEffect } from 'react';
import { api, type ArchitectureOverview } from '../../../services/api';
import { MediaLibrary } from '../MediaLibrary';
import { VisualEditor } from '../VisualEditor';
import { fmtDate } from './shared';
import { ContentTab } from './ContentTab';
import { BannersTab } from './BannersTab';
import styles from '../AdminPanel.module.css';


const ESTADO_INFO: Record<string, { rotulo: string; cor: string }> = {
  ok: { rotulo: 'Funcionando', cor: 'var(--adm-green)' },
  falha: { rotulo: 'Falha', cor: 'var(--adm-red)' },
  atencao: { rotulo: 'Atenção', cor: 'var(--adm-yellow)' },
  nao_verificado: { rotulo: 'Não verificado', cor: 'var(--adm-text-muted)' },
};


export function ArchitectureSection({ secao }: { secao: string }) {
  const [d, setD] = useState<ArchitectureOverview | null>(null);
  const [erro, setErro] = useState('');
  const tecnica = ['visao', 'sites', 'acesso', 'diag'].includes(secao);
  const carregar = () => { if (!tecnica) return; setErro(''); api.admin.getArchitecture().then(setD).catch((e: any) => setErro(e.message || 'Não foi possível carregar.')); };
  useEffect(carregar, []);

  const mb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const tempo = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 60)} min`);
  if (secao === 'midia') return <MediaLibrary />;
  if (secao === 'editor') return <VisualEditor />;
  if (secao === 'conteudo') return <ContentTab />;
  if (secao === 'banners') return <BannersTab />;

  return (
    <>
      {erro && <div className={styles.emptyState}>{erro}</div>}
      {!erro && !d && <div className={styles.loader}><div className={styles.spinner} /></div>}

      {d && secao === 'visao' && (
        <>
          <div className={styles.metricsGrid}>
            {Object.entries(d.contagens).map(([k, v]) => (
              <div key={k} className={styles.metricCard}><div className={styles.metricLabel}>{k[0].toUpperCase() + k.slice(1)}</div><div className={styles.metricValue}>{v}</div></div>
            ))}
            <div className={styles.metricCard}><div className={styles.metricLabel}>Imagens enviadas</div><div className={styles.metricValue}>{d.armazenamento.arquivos}</div><div className={styles.metricSub}>{mb(d.armazenamento.bytes)}</div></div>
            <div className={styles.metricCard}><div className={styles.metricLabel}>Banco de dados</div><div className={styles.metricValue}>{mb(d.armazenamento.bancoBytes)}</div></div>
          </div>
          <div className={styles.tableWrapper} style={{ padding: '1.25rem', marginTop: '1rem' }}>
            <div className={styles.sectionTitle}>Servidor</div>
            <p style={{ color: 'var(--adm-text-muted)', marginTop: '.5rem', lineHeight: 1.7 }}>
              Node {d.servidor.node} · {d.servidor.plataforma} · ligado há {tempo(d.servidor.uptimeSegundos)} · {d.servidor.memoriaMB} MB de memória
            </p>
          </div>
          <div className={styles.tableWrapper} style={{ padding: '1.25rem', marginTop: '1rem' }}>
            <div className={styles.sectionTitle}>Plano de entrega</div>
            {d.fases.map(f => (
              <div key={f.n} style={{ display: 'flex', gap: 10, padding: '.4rem 0', color: f.pronta ? 'var(--adm-green)' : 'var(--adm-text-muted)' }}>
                <span>{f.pronta ? '✔' : '○'}</span><span>Fase {f.n} — {f.titulo}{f.pronta ? '' : ' (pendente)'}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {d && secao === 'sites' && (
        <div className={styles.tableWrapper} style={{ padding: '1.25rem' }}>
          <div className={styles.sectionTitle}>{d.site.nome}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,200px) 1fr', gap: '.6rem 1rem', marginTop: '.8rem', fontSize: '.85rem' }}>
            <span style={{ color: 'var(--adm-text-muted)' }}>Identificador</span><span>{d.site.id}</span>
            <span style={{ color: 'var(--adm-text-muted)' }}>Domínio</span><span>{d.site.dominio || 'Não informado'}</span>
            <span style={{ color: 'var(--adm-text-muted)' }}>Tecnologia</span><span>{d.site.tecnologia}</span>
            <span style={{ color: 'var(--adm-text-muted)' }}>Ambiente</span><span>{d.site.ambiente}</span>
            <span style={{ color: 'var(--adm-text-muted)' }}>Armazenamento</span><span>{d.site.armazenamento}</span>
            <span style={{ color: 'var(--adm-text-muted)' }}>Publicação</span><span>{d.site.publicacao}</span>
          </div>
          <p style={{ color: 'var(--adm-text-muted)', marginTop: '1rem', fontSize: '.8rem' }}>
            Esta é a única loja cadastrada. O cadastro de outros clientes e sites, com dados isolados, chega na fase 2.
          </p>
        </div>
      )}

      {d && secao === 'acesso' && (
        <>
          <div className={styles.tableWrapper} style={{ padding: '1.25rem' }}>
            <div className={styles.sectionTitle}>Perfis de acesso</div>
            {d.papeis.map(p => (
              <div key={p.id} style={{ padding: '.7rem 0', borderTop: '1px solid var(--adm-border)' }}>
                <strong>{p.label}</strong>
                <div style={{ color: 'var(--adm-text-muted)', fontSize: '.8rem', margin: '.2rem 0' }}>{p.descricao}</div>
                <div style={{ fontSize: '.75rem' }}>
                  {p.areas === 'todas' ? 'Todas as áreas' : Object.entries(p.areas).map(([a, nv]) => `${a} (${nv === 'rw' ? 'editar' : 'ver'})`).join(' · ')}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.tableWrapper} style={{ padding: '1.25rem', marginTop: '1rem' }}>
            <div className={styles.sectionTitle}>Contas por perfil</div>
            {d.usuariosPorPapel.map(u => <div key={u.role} style={{ padding: '.25rem 0' }}>{u.role}: {u.n}</div>)}
            <p style={{ color: 'var(--adm-text-muted)', marginTop: '.8rem', fontSize: '.8rem' }}>
              Acessos negados nos últimos 7 dias: {d.seguranca.tentativasNegadas7dias}. As permissões são conferidas no servidor em cada requisição.
            </p>
          </div>
        </>
      )}

      {d && secao === 'diag' && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Verificações</span>
            <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={carregar}>Verificar de novo</button>
          </div>
          {d.verificacoes.map(v => (
            <div key={v.id} className={styles.alertRow} style={{ borderColor: ESTADO_INFO[v.estado].cor }}>
              <div className={styles.alertTitle}>{v.titulo} — <span style={{ color: ESTADO_INFO[v.estado].cor }}>{ESTADO_INFO[v.estado].rotulo}</span></div>
              <div className={styles.alertMsg}>{v.detalhe}</div>
            </div>
          ))}
          <div className={styles.sectionHeader} style={{ marginTop: '1.25rem' }}><span className={styles.sectionTitle}>Últimos eventos</span></div>
          <div className={styles.tableWrapper}>
            <div style={{ padding: '1rem' }}>
              {d.eventosRecentes.length === 0 && <div className={styles.emptyState}>Nenhum evento registrado ainda.</div>}
              {d.eventosRecentes.map(e => (
                <div key={e.id} className={styles.auditEntry}>
                  <div className={styles.auditDot} />
                  <div>
                    <div className={styles.auditAction}>[{e.entity}] {e.action}{e.entity_id ? <span style={{ color: 'var(--adm-text-muted)', fontWeight: 400 }}> #{e.entity_id}</span> : null}</div>
                    <div className={styles.auditMeta}>{e.user_email || 'Sistema'} · {fmtDate(e.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
