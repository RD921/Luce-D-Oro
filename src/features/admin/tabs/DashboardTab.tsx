import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api, type AdminAlert, type AdminDashboardData, type DashboardInsights } from '../../../services/api';
import { fmt, fmtDate, statusClass } from './shared';
import styles from '../AdminPanel.module.css';


// ============================================================
// TAB: DASHBOARD
// ============================================================
// ---- Gráficos do dashboard (SVG simples, uma cor só: dourado) ----
export function Delta({ atual, antes }: { atual: number; antes: number }) {
  if (antes <= 0) return <span style={{ color: 'var(--adm-text-dim)' }}> · sem base anterior</span>;
  const pct = ((atual - antes) / antes) * 100;
  const sobe = pct >= 0;
  return (
    <span style={{ color: sobe ? 'var(--adm-green)' : 'var(--adm-red)' }}>
      {' · '}{sobe ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% vs. período anterior
    </span>
  );
}


export function RevenueChart({ serie }: { serie: DashboardInsights['serie'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 200, PL = 8, PB = 22;
  const max = Math.max(1, ...serie.map(d => d.receita));
  const largura = (W - PL) / serie.length;
  const barra = Math.max(2, Math.min(24, largura - 3));
  const temVenda = serie.some(d => d.receita > 0);
  const marca = (i: number) => serie.length <= 14 || (serie.length - 1 - i) % Math.ceil(serie.length / 8) === 0;
  const h = hover !== null ? serie[hover] : null;
  return (
    <div>
      <div style={{ minHeight: 20, fontSize: '0.8rem', marginBottom: 6, color: 'var(--adm-text-muted)' }}>
        {h ? <><strong style={{ color: 'var(--adm-text)' }}>{fmt(h.receita)}</strong> · {h.pedidos} pedido(s) · {h.dia.split('-').reverse().join('/')}</>
           : temVenda ? 'Passe o mouse sobre uma barra para ver o dia.' : 'Ainda não há vendas neste período.'}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Receita por dia" style={{ display: 'block' }}>
        <line x1={PL} x2={W} y1={H - PB} y2={H - PB} stroke="rgba(255,255,255,0.12)" />
        {serie.map((d, i) => {
          const alt = d.receita > 0 ? Math.max(3, (d.receita / max) * (H - PB - 10)) : 0;
          const x = PL + i * largura + (largura - barra) / 2;
          return (
            <g key={d.dia} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={PL + i * largura} y={0} width={largura} height={H - PB} fill="transparent" />
              {alt > 0 && <rect x={x} y={H - PB - alt} width={barra} height={alt} rx={2} fill={hover === i ? 'var(--adm-gold-light)' : 'var(--adm-gold)'} />}
              {marca(i) && <text x={x + barra / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--adm-text-muted)">{d.dia.slice(8)}/{d.dia.slice(5, 7)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}


export function HBars({ linhas, vazio }: { linhas: Array<{ nome: string; valor: number; detalhe: string }>; vazio: string }) {
  const max = Math.max(1, ...linhas.map(l => l.valor));
  if (linhas.length === 0) return <div className={styles.emptyState}>{vazio}</div>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {linhas.map(l => (
        <div key={l.nome}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 3 }}>
            <span>{l.nome}</span>
            <span style={{ color: 'var(--adm-text-muted)' }}>{fmt(l.valor)} · {l.detalhe}</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
            <div style={{ width: `${(l.valor / max) * 100}%`, height: '100%', background: 'var(--adm-gold)', borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}


export function DashboardTab() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [ins, setIns] = useState<DashboardInsights | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a, i] = await Promise.all([api.admin.getDashboard(period), api.admin.getAlerts(), api.admin.getInsights(period).catch(() => null)]);
      setData(d);
      setAlerts(a);
      setIns(i);
    } catch {/* */}
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className={styles.loader}><div className={styles.spinner}/> Carregando métricas…</div>;
  if (!data) return <div className={styles.emptyState}>Erro ao carregar dados.</div>;

  const statusEntries = Object.entries(data.statusCounts);
  const receitaAtual = ins ? ins.serie.reduce((a, d) => a + d.receita, 0) : 0;
  const pedidosAtual = ins ? ins.serie.reduce((a, d) => a + d.pedidos, 0) : 0;

  return (
    <>
      {/* Period selector */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Métricas do Período</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[['7d','7 dias'],['30d','30 dias'],['90d','90 dias'],['all','Tudo']].map(([v,l]) => (
            <button
              key={v}
              onClick={() => setPeriod(v)}
              className={`${styles.btnSmall} ${period === v ? styles.btnSmallPrimary : styles.btnSmallGhost}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          {alerts.map(a => (
            <div key={a.id} className={`${styles.alertRow} ${a.type === 'warning' ? styles.alertRowWarning : a.type === 'danger' ? styles.alertRowDanger : styles.alertRowInfo}`}>
              <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div className={styles.alertTitle}>{a.title}</div>
                <div className={styles.alertMsg}>{a.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metric cards */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} ${styles.metricGold}`}>
          <div className={styles.metricLabel}>Receita</div>
          <div className={styles.metricValue}>{fmt(data.revenue)}</div>
          <div className={styles.metricSub}>{data.ordersCount} pedidos{ins?.anterior && <Delta atual={receitaAtual} antes={ins.anterior.receita} />}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Ticket Médio</div>
          <div className={styles.metricValue}>{fmt(data.averageTicket)}</div>
          <div className={styles.metricSub}>por pedido</div>
        </div>
        <div className={`${styles.metricCard} ${data.outOfStockCount > 0 ? styles.metricRed : styles.metricGreen}`}>
          <div className={styles.metricLabel}>Sem Estoque</div>
          <div className={styles.metricValue}>{data.outOfStockCount}</div>
          <div className={styles.metricSub}>{data.lowStockCount} com estoque baixo</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Clientes</div>
          <div className={styles.metricValue}>{data.totalCustomers}</div>
          <div className={styles.metricSub}>{ins ? `${ins.novosClientes} novo(s) no período · ` : ''}{data.activeCoupons} cupons ativos</div>
        </div>
      </div>

      {ins && (
        <>
          <div className={styles.metricsGrid}>
            <div className={`${styles.metricCard} ${ins.aguardando > 0 ? styles.metricGold : ''}`}>
              <div className={styles.metricLabel}>Pedidos para atender</div>
              <div className={styles.metricValue}>{ins.aguardando}</div>
              <div className={styles.metricSub}>confirmados, pagos ou em preparação</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Pedidos no período</div>
              <div className={styles.metricValue}>{pedidosAtual}</div>
              <div className={styles.metricSub}>sem cancelados{ins.anterior && <Delta atual={pedidosAtual} antes={ins.anterior.pedidos} />}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Peças em estoque</div>
              <div className={styles.metricValue}>{ins.estoque.pecas}</div>
              <div className={styles.metricSub}>{fmt(ins.estoque.venda)} em preço de venda</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Margem potencial</div>
              <div className={styles.metricValue}>{ins.estoque.custo > 0 ? fmt(ins.estoque.venda - ins.estoque.custo) : '—'}</div>
              <div className={styles.metricSub}>{ins.estoque.custo > 0 ? 'estoque a preço de venda − custo' : 'cadastre o custo dos produtos'}</div>
            </div>
          </div>

          <div className={styles.sectionHeader}><span className={styles.sectionTitle}>Receita por dia</span></div>
          <div className={styles.tableWrapper} style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <RevenueChart serie={ins.serie} />
          </div>

          <div className={styles.twoColGrid} style={{ marginBottom: '1.5rem' }}>
            <div>
              <div className={styles.sectionHeader}><span className={styles.sectionTitle}>Vendas por categoria</span></div>
              <div className={styles.tableWrapper} style={{ padding: '1rem' }}>
                <HBars linhas={ins.porCategoria.map(c => ({ nome: c.nome, valor: c.receita, detalhe: `${c.itens} item(ns)` }))} vazio="Sem vendas no período." />
              </div>
            </div>
            <div>
              <div className={styles.sectionHeader}><span className={styles.sectionTitle}>Formas de pagamento</span></div>
              <div className={styles.tableWrapper} style={{ padding: '1rem' }}>
                <HBars linhas={ins.pagamentos.map(c => ({ nome: c.metodo || 'Não informado', valor: c.receita, detalhe: `${c.pedidos} pedido(s)` }))} vazio="Sem vendas no período." />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Status distribution */}
      {statusEntries.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Status dos Pedidos</span>
          </div>
          <div className={styles.tableWrapper} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', padding: '1rem' }}>
              {statusEntries.map(([s, c]) => (
                <span key={s} className={`${styles.statusPill} ${statusClass(s)}`}>
                  {s}: {c}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      <div className={styles.twoColGrid}>
        {/* Recent orders */}
        <div>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Pedidos Recentes</span>
          </div>
          <div className={styles.tableWrapper}>
            <table>
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Status</th><th>Total</th><th>Data</th></tr></thead>
              <tbody>
                {data.recentOrders.length === 0 && (
                  <tr><td colSpan={5} className={styles.emptyState}>Nenhum pedido</td></tr>
                )}
                {data.recentOrders.map((o: any) => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{o.id}</td>
                    <td style={{ fontSize: '0.75rem' }}>{o.customerName ?? o.customer_name ?? '—'}</td>
                    <td><span className={`${styles.statusPill} ${statusClass(o.status)}`}>{o.status}</span></td>
                    <td className={styles.price}>{fmt(o.total)}</td>
                    <td style={{ color: 'var(--adm-text-muted)', fontSize: '0.75rem' }}>{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top products */}
        <div>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Top Produtos</span>
          </div>
          <div className={styles.tableWrapper}>
            <table>
              <thead><tr><th>Produto</th><th>Qtd</th><th>Receita</th></tr></thead>
              <tbody>
                {data.topProducts.length === 0 && (
                  <tr><td colSpan={3} className={styles.emptyState}>Sem dados</td></tr>
                )}
                {data.topProducts.map((p: any) => (
                  <tr key={p.product_id}>
                    <td className={styles.productName} style={{ fontSize: '0.8rem' }}>{p.product_name}</td>
                    <td>{p.total_sold ?? p.total_quantity ?? 0}</td>
                    <td className={styles.price}>{fmt(p.total_revenue ?? p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Low stock */}
      {data.lowStockProducts.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Produtos com Estoque Crítico</span>
          </div>
          <div className={styles.tableWrapper}>
            <table>
              <thead><tr><th>Produto</th><th>Categoria</th><th>Estoque</th></tr></thead>
              <tbody>
                {data.lowStockProducts.map((p: any) => (
                  <tr key={p.id}>
                    <td className={styles.productName}>{p.name}</td>
                    <td>{p.category_id}</td>
                    <td className={p.stock === 0 ? styles.stockOut : styles.stockLow}>
                      {p.stock === 0 ? '⚠ Esgotado' : `${p.stock} un.`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
