import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Archive, Image, Tag, Settings,
  Shield, X, Plus, Edit2, Trash2, Search,
  AlertTriangle, Users, ArrowUpCircle, ArrowDownCircle,
  CheckCircle, XCircle, Truck, Eye, LogOut, Upload, Layers, FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSite } from '../../context/SiteContext';
import { api, type Category, type Product, type Order, type Banner, type Coupon, type StockMovement, type AuditLog, type AdminAlert, type AdminDashboardData, type DashboardInsights } from '../../services/api';
import styles from './AdminPanel.module.css';

// ============================================================
// ERROR BOUNDARY — Prevents admin crashes from killing the store
// ============================================================
export class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#0F0F0F', zIndex: 2000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#F0EDE8', fontFamily: 'Plus Jakarta Sans, sans-serif', gap: '1rem'
        }}>
          <div style={{ fontSize: '2rem' }}>⚠</div>
          <div style={{ fontSize: '1rem', fontWeight: 600 }}>Erro no Painel Administrativo</div>
          <div style={{ fontSize: '0.8rem', color: '#888', maxWidth: 400, textAlign: 'center' }}>{this.state.error}</div>
          <button onClick={this.props.onClose} style={{
            marginTop: '1rem', padding: '0.6rem 1.5rem', background: '#B89758',
            border: 'none', borderRadius: 4, color: '#0F0F0F', fontWeight: 600, cursor: 'pointer'
          }}>Fechar Painel</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// HELPERS
// ============================================================
const fmt = (v: number | undefined | null) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const statusClass = (s: string) => {
  const map: Record<string, string> = {
    Confirmado: styles.statusConfirmed,
    'Em preparação': styles.statusPending,
    Enviado: styles.statusShipped,
    Entregue: styles.statusDelivered,
    Cancelado: styles.statusCancelled,
  };
  return map[s] || styles.statusPending;
};

const ORDER_STATUSES = ['Confirmado', 'Em preparação', 'Enviado', 'Entregue', 'Cancelado'];

// Botão "Enviar do computador": manda a foto para o servidor e devolve o endereço dela
function UploadButton({ onUploaded, label = 'Enviar do computador' }: { onUploaded: (url: string) => void; label?: string }) {
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSending(true);
    setErr('');
    try {
      const r = await api.admin.uploadImage(file);
      onUploaded(r.url);
    } catch (ex: any) {
      setErr(ex.message || 'Não foi possível enviar a imagem.');
    }
    setSending(false);
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <label className={`${styles.btnSmall} ${styles.btnSmallGhost}`} style={{ cursor: sending ? 'wait' : 'pointer' }}>
        <Upload size={13} /> {sending ? 'Enviando…' : label}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={pick} disabled={sending} />
      </label>
      {err && <span style={{ color: '#e57373', fontSize: '0.75rem' }}>{err}</span>}
    </span>
  );
}

// Campo de imagem: cole um link OU envie um arquivo do computador
function ImageField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className={styles.formInput} style={{ flex: 1, minWidth: 180 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Cole um link ou envie um arquivo'} />
        <UploadButton onUploaded={onChange} />
      </div>
      {value && <img src={value} alt="" className={styles.bannerPreview} onError={() => {}} />}
    </>
  );
}

// ============================================================
// TABS
// ============================================================
type TabId = 'dashboard' | 'products' | 'categories' | 'content' | 'orders' | 'stock' | 'banners' | 'coupons' | 'customers' | 'team' | 'settings' | 'audit';

// area = nome da área no servidor; owner = só o proprietário vê
interface Tab { id: TabId; label: string; icon: React.ReactNode; group: string; area?: string; owner?: boolean }

const TABS: Tab[] = [
  { id: 'dashboard',  label: 'Dashboard',    icon: <LayoutDashboard size={15} />, group: 'Visão Geral', area: 'dashboard' },
  { id: 'products',   label: 'Produtos',     icon: <Package size={15} />,         group: 'Visão Geral', area: 'produtos' },
  { id: 'categories', label: 'Categorias',   icon: <Layers size={15} />,          group: 'Visão Geral', area: 'categorias' },
  { id: 'content',    label: 'Conteúdo',     icon: <FileText size={15} />,        group: 'Visão Geral', area: 'conteudo' },
  { id: 'orders',     label: 'Pedidos',      icon: <ShoppingCart size={15} />,    group: 'Marketing & Loja', area: 'pedidos' },
  { id: 'stock',      label: 'Estoque',      icon: <Archive size={15} />,         group: 'Marketing & Loja', area: 'estoque' },
  { id: 'banners',    label: 'Banners',      icon: <Image size={15} />,           group: 'Sistema', area: 'banners' },
  { id: 'coupons',    label: 'Cupons',       icon: <Tag size={15} />,             group: 'Sistema', area: 'cupons' },
  { id: 'customers',  label: 'Clientes',     icon: <Users size={15} />,           group: 'Sistema', area: 'clientes' },
  { id: 'team',       label: 'Equipe',       icon: <Shield size={15} />,          group: 'Sistema', owner: true },
  { id: 'settings',   label: 'Configurações',icon: <Settings size={15} />,        group: 'Sistema', owner: true },
  { id: 'audit',      label: 'Auditoria',    icon: <Shield size={15} />,          group: 'Sistema', owner: true },
];

// ============================================================
// MAIN ADMIN PANEL
// ============================================================
interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { user, logout, isOwner } = useAuth();
  const abas = TABS.filter(t => (t.owner ? isOwner : isOwner || Boolean(t.area && user?.areas?.[t.area])));
  const [activeTab, setActiveTab] = useState<TabId>(abas[0]?.id ?? 'dashboard');
  const grupos = Array.from(new Set(abas.map(t => t.group)));

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <div className={styles.adminRoot}>
      {/* -------- Sidebar -------- */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <span className={styles.sidebarBrandBadge}>{isOwner ? '⚡ Proprietário' : '👥 Equipe'}</span>
          <span className={styles.sidebarBrandName}>LUCE D'ORO</span>
          <span className={styles.sidebarOwner}>
            {user?.name || ''}
          </span>
        </div>

        <nav className={styles.sidebarNav}>
          {grupos.map(g => (
            <div key={g} className={styles.navSection}>
              <div className={styles.navSectionLabel}>{g}</div>
              {abas.filter(t => t.group === g).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${styles.navItem} ${activeTab === tab.id ? styles.navItemActive : ''}`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.exitBtn} onClick={onClose} title="Voltar à loja">
            <X size={15} />
            Voltar à loja
          </button>
          <button className={styles.exitBtn} onClick={handleLogout} style={{ color: '#E05252' }}>
            <LogOut size={15} />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* -------- Main Content -------- */}
      <main className={styles.mainContent}>
        <div className={styles.topBar}>
          <span className={styles.topBarTitle}>
            {abas.find(t => t.id === activeTab)?.label}
          </span>
          <div className={styles.topBarRight}>
            <span style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </span>
          </div>
        </div>

        <div className={styles.scrollArea}>
          {activeTab === 'dashboard'  && <DashboardTab />}
          {activeTab === 'products'   && <ProductsTab />}
          {activeTab === 'categories' && <CategoriesTab />}
          {activeTab === 'content'    && <ContentTab />}
          {activeTab === 'orders'     && <OrdersTab />}
          {activeTab === 'stock'      && <StockTab />}
          {activeTab === 'banners'    && <BannersTab />}
          {activeTab === 'coupons'    && <CouponsTab />}
          {activeTab === 'customers'  && <CustomersTab />}
          {activeTab === 'team'       && isOwner && <TeamTab />}
          {activeTab === 'settings'   && isOwner && <SettingsTab />}
          {activeTab === 'audit'      && isOwner && <AuditTab />}
        </div>
      </main>
    </div>
  );
};

// ============================================================
// TAB: DASHBOARD
// ============================================================
// ---- Gráficos do dashboard (SVG simples, uma cor só: dourado) ----
function Delta({ atual, antes }: { atual: number; antes: number }) {
  if (antes <= 0) return <span style={{ color: 'var(--adm-text-dim)' }}> · sem base anterior</span>;
  const pct = ((atual - antes) / antes) * 100;
  const sobe = pct >= 0;
  return (
    <span style={{ color: sobe ? 'var(--adm-green)' : 'var(--adm-red)' }}>
      {' · '}{sobe ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% vs. período anterior
    </span>
  );
}

function RevenueChart({ serie }: { serie: DashboardInsights['serie'] }) {
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

function HBars({ linhas, vazio }: { linhas: Array<{ nome: string; valor: number; detalhe: string }>; vazio: string }) {
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

function DashboardTab() {
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

// ============================================================
// TAB: PRODUCTS
// ============================================================
function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [photosOf, setPhotosOf] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [verArquivados, setVerArquivados] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setProducts(await api.admin.getProducts()); } catch {/* */}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter(p =>
    Boolean(p.is_archived) === verArquivados &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category_id.toLowerCase().includes(search.toLowerCase()))
  );
  const qtdArquivados = products.filter(p => p.is_archived).length;

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja arquivar o produto "${name}"? Ele não será exibido na loja.`)) return;
    try {
      await api.admin.deleteProduct(id);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  const restaurar = async (p: Product) => {
    try { await api.admin.restoreProduct(p.id); await load(); } catch (e: any) { alert(e.message); }
  };
  const apagarDeVez = async (p: Product) => {
    if (!confirm(`Apagar "${p.name}" DE VEZ? Isso não tem volta.`)) return;
    try { await api.admin.deleteProductForever(p.id); await load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.filterRow}>
        <button className={`${styles.btnSmall} ${verArquivados ? styles.btnSmallPrimary : styles.btnSmallGhost}`} onClick={() => setVerArquivados(v => !v)}>
          {verArquivados ? '← Voltar aos ativos' : `Arquivados (${qtdArquivados})`}
        </button>
        <Search size={14} style={{ color: 'var(--adm-text-dim)', flexShrink: 0 }} />
        <input
          className={styles.searchInput}
          placeholder="Buscar produto ou categoria…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className={`${styles.btnSmall} ${styles.btnSmallPrimary}`}
          onClick={() => setCreating(true)}
        >
          <Plus size={13} /> Novo Produto
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loader}><div className={styles.spinner}/> Carregando…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Foto</th><th>Nome</th><th>Categoria</th>
                  <th>Preço</th><th>Estoque</th><th>Destaque</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className={styles.emptyState}>Nenhum produto encontrado.</td></tr>
                )}
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <img
                        src={p.image_primary}
                        alt={p.name}
                        className={styles.productImg}
                        style={{ cursor: 'pointer' }}
                        title="Clique para trocar as fotos"
                        onClick={() => setPhotosOf(p)}
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                      />
                    </td>
                    <td>
                      <div className={styles.productName}>{p.name}</div>
                      <div className={styles.productSlug}>{p.slug}</div>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{p.category_id}</td>
                    <td>
                      <div className={styles.price}>{fmt(p.price)}</div>
                      {p.old_price && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--adm-text-dim)', textDecoration: 'line-through' }}>
                          {fmt(p.old_price)}
                        </div>
                      )}
                    </td>
                    <td className={p.stock === 0 ? styles.stockOut : p.stock <= 3 ? styles.stockLow : styles.stockOk}>
                      {p.stock}
                    </td>
                    <td>
                      {p.is_featured ? (
                        <span className={`${styles.tag} ${styles.tagGold}`}>★ Destaque</span>
                      ) : (
                        <span className={styles.tag}>—</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.btnIcon} title="Trocar fotos" onClick={() => setPhotosOf(p)}>
                          <Image size={13} />
                        </button>
                        <button
                          className={styles.btnIcon}
                          title="Editar"
                          onClick={() => setEditing(p)}
                        >
                          <Edit2 size={13} />
                        </button>
                        {p.is_archived ? (
                          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => restaurar(p)}>Restaurar</button>
                        ) : (
                          <button
                            className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                            title="Arquivar (tira da loja, mantém o histórico)"
                            onClick={() => handleDelete(p.id, p.name)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} style={{ color: 'var(--adm-red)' }} title="Apagar de vez" onClick={() => apagarDeVez(p)}>Apagar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {photosOf && <PhotosModal product={photosOf} onClose={() => setPhotosOf(null)} onSaved={() => { setPhotosOf(null); load(); }} />}
      {(editing || creating) && (
        <ProductModal
          product={editing || undefined}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </>
  );
}

// ---- Editor de fotos do produto ----
function PhotosModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [principal, setPrincipal] = useState(product.image_primary);
  const [extras, setExtras] = useState<string[]>(product.images ?? []);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const todas = [principal, ...extras].filter(Boolean);
  const virarPrincipal = (u: string) => { setExtras(e => [principal, ...e.filter(x => x !== u)].filter(Boolean)); setPrincipal(u); };
  const remover = (u: string) => {
    if (u === principal) {
      if (extras.length === 0) { setError('O produto precisa de pelo menos uma foto. Envie outra antes de remover esta.'); return; }
      setPrincipal(extras[0]); setExtras(extras.slice(1));
    } else setExtras(e => e.filter(x => x !== u));
    setError('');
  };
  const adicionar = (u: string) => {
    if (!u) return;
    if (!principal) setPrincipal(u);
    else setExtras(e => (e.includes(u) || u === principal ? e : [...e, u]));
  };
  const trocarPrincipal = (u: string) => {
    // troca a foto principal pela nova; a antiga sai da galeria
    setPrincipal(u);
    setExtras(e => e.filter(x => x !== u));
  };

  const salvar = async () => {
    if (!principal) { setError('Escolha a foto principal.'); return; }
    setSaving(true); setError('');
    try { await api.admin.setProductPhotos(product.id, principal, extras); onSaved(); }
    catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Fotos — {product.name}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: '1rem' }}>
            {todas.map((u, i) => (
              <div key={u} style={{ border: `1px solid ${u === principal ? 'var(--adm-gold)' : 'var(--adm-border-md)'}`, borderRadius: 6, overflow: 'hidden', background: 'var(--adm-bg-input)' }}>
                <img src={u} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
                <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.65rem', color: u === principal ? 'var(--adm-gold)' : 'var(--adm-text-muted)' }}>{u === principal ? '★ Principal' : `Foto ${i + 1}`}</span>
                  {u !== principal && <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => virarPrincipal(u)}>Tornar principal</button>}
                  <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} style={{ color: 'var(--adm-red)' }} onClick={() => remover(u)}>Remover</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <UploadButton label="Adicionar foto" onUploaded={adicionar} />
            <UploadButton label="Trocar a principal" onUploaded={trocarPrincipal} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className={styles.formInput} placeholder="…ou cole o endereço (link) de uma imagem" value={url} onChange={e => setUrl(e.target.value)} />
            <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} disabled={!url.trim()} onClick={() => { adicionar(url.trim()); setUrl(''); }}>Adicionar</button>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar fotos'}</button>
        </div>
      </div>
    </div>
  );
}

// Product form modal
function ProductModal({ product, onClose, onSaved }: { product?: Product; onClose: () => void; onSaved: () => void }) {
  const { categories } = useSite();
  const isNew = !product;
  const [form, setForm] = useState({
    name: product?.name || '',
    slug: product?.slug || '',
    category_id: product?.category_id || categories[0]?.id || 'pulseiras',
    price: product?.price ?? 0,
    old_price: product?.old_price ?? '',
    cost_price: product?.cost_price ?? '',
    description: product?.description || '',
    materials: product?.materials || '',
    care_instructions: product?.care_instructions || '',
    dimensions: product?.dimensions || '',
    warranty: product?.warranty || '12 meses',
    stock: product?.stock ?? 0,
    is_featured: product?.is_featured ? true : false,
    image_primary: product?.image_primary || '',
    images: product?.images?.join('\n') || '',
    variants: product?.variants?.join('\n') || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Auto-slug from name
  const handleNameChange = (v: string) => {
    set('name', v);
    if (isNew) {
      set('slug', v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.image_primary) {
      setError('Nome, preço e imagem principal são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Partial<Product> = {
        ...form,
        price: Number(form.price),
        old_price: form.old_price !== '' ? Number(form.old_price) : null,
        cost_price: form.cost_price !== '' ? Number(form.cost_price) : undefined,
        stock: Number(form.stock),
        is_featured: form.is_featured,
        images: form.images.split('\n').map(s => s.trim()).filter(Boolean),
        variants: form.variants.split('\n').map(s => s.trim()).filter(Boolean),
      };
      if (isNew) await api.admin.createProduct(payload);
      else await api.admin.updateProduct(product!.id, payload);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? 'Novo Produto' : `Editar: ${product?.name}`}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && (
            <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}>
              <XCircle size={14} />
              <div className={styles.alertMsg}>{error}</div>
            </div>
          )}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome do Produto *</label>
              <input className={styles.formInput} value={form.name} onChange={e => handleNameChange(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Slug (URL)</label>
              <input className={styles.formInput} value={form.slug} onChange={e => set('slug', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Categoria *</label>
              <select className={styles.formInput} value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {!categories.some(c => c.id === form.category_id) && form.category_id && <option value={form.category_id}>{form.category_id} (desativada)</option>}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Estoque</label>
              <input type="number" className={styles.formInput} value={form.stock} onChange={e => set('stock', e.target.value)} min={0} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Preço de Venda (R$) *</label>
              <input type="number" className={styles.formInput} value={form.price} onChange={e => set('price', e.target.value)} step="0.01" min={0} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Preço Antigo / De (R$)</label>
              <input type="number" className={styles.formInput} value={form.old_price} onChange={e => set('old_price', e.target.value)} step="0.01" min={0} placeholder="Opcional" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Custo (R$)</label>
              <input type="number" className={styles.formInput} value={form.cost_price} onChange={e => set('cost_price', e.target.value)} step="0.01" min={0} placeholder="Opcional" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Garantia</label>
              <input className={styles.formInput} value={form.warranty} onChange={e => set('warranty', e.target.value)} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagem Principal *</label>
              <ImageField value={form.image_primary} onChange={v => set('image_primary', v)} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagens adicionais (uma por linha)</label>
              <textarea className={styles.formInput} rows={3} value={form.images} onChange={e => set('images', e.target.value)} />
              <div style={{ marginTop: 6 }}>
                <UploadButton label="Adicionar foto do computador" onUploaded={url => set('images', form.images ? form.images.replace(/\s+$/, '') + '\n' + url : url)} />
              </div>
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Variantes disponíveis (uma por linha)</label>
              <textarea className={styles.formInput} rows={3} value={form.variants} onChange={e => set('variants', e.target.value)} placeholder="Ex: 14K Ouro Amarelo&#10;18K Ouro Rosé" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Descrição</label>
              <textarea className={styles.formInput} rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Materiais</label>
              <textarea className={styles.formInput} rows={2} value={form.materials} onChange={e => set('materials', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cuidados</label>
              <textarea className={styles.formInput} rows={2} value={form.care_instructions} onChange={e => set('care_instructions', e.target.value)} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Dimensões</label>
              <input className={styles.formInput} value={form.dimensions} onChange={e => set('dimensions', e.target.value)} placeholder="Ex: Comprimento 18cm" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formCheckbox}>
                <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} />
                Produto em destaque na home
              </label>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? <><div className={styles.spinner} style={{ width: 13, height: 13 }} /> Salvando…</> : 'Salvar Produto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB: ORDERS
// ============================================================
function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewing, setViewing] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setOrders(await api.admin.getOrders({ status: statusFilter || undefined, q: search || undefined })); }
    catch {/* */}
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const handleStatusChange = async (orderId: string, newStatus: string, trackingCode?: string) => {
    setUpdatingId(orderId);
    try { await api.admin.updateOrderStatus(orderId, { status: newStatus, trackingCode }); await load(); }
    catch (e: any) { alert(e.message); }
    setUpdatingId(null);
  };

  return (
    <>
      <div className={styles.filterRow}>
        <Search size={14} style={{ color: 'var(--adm-text-dim)', flexShrink: 0 }} />
        <input
          className={styles.searchInput}
          placeholder="Buscar pedido, cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loader}><div className={styles.spinner}/></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Pedido</th><th>Cliente</th><th>Total</th>
                  <th>Pagamento</th><th>Status</th><th>Data</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={7} className={styles.emptyState}>Nenhum pedido encontrado.</td></tr>
                )}
                {orders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{o.id}</td>
                    <td>
                      <div style={{ fontSize: '0.8rem' }}>{(o as any).customer_name || '—'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>{(o as any).customer_email}</div>
                    </td>
                    <td className={styles.price}>{fmt(o.total)}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{o.payment_method}</td>
                    <td><span className={`${styles.statusPill} ${statusClass(o.status)}`}>{o.status}</span></td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{fmtDate(o.created_at)}</td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.btnIcon} title="Ver detalhes" onClick={() => setViewing(o)}>
                          <Eye size={13} />
                        </button>
                        {o.status !== 'Entregue' && o.status !== 'Cancelado' && (
                          <OrderQuickUpdate
                            order={o}
                            onUpdate={handleStatusChange}
                            loading={updatingId === o.id}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewing && <OrderDetailModal order={viewing} onClose={() => setViewing(null)} onUpdate={(id, s, t) => { handleStatusChange(id, s, t); setViewing(null); }} />}
    </>
  );
}

function OrderQuickUpdate({ order, onUpdate, loading }: { order: Order; onUpdate: (id: string, s: string, t?: string) => void; loading: boolean }) {
  const current = ORDER_STATUSES.indexOf(order.status);
  const next = ORDER_STATUSES[current + 1];
  if (!next) return null;
  return (
    <button
      className={`${styles.btnSmall} ${styles.btnSmallGhost}`}
      onClick={() => onUpdate(order.id, next)}
      disabled={loading}
      title={`Avançar para: ${next}`}
    >
      {loading ? <div className={styles.spinner} style={{ width: 12, height: 12 }} /> : <Truck size={12} />}
      {next}
    </button>
  );
}

function OrderDetailModal({ order, onClose, onUpdate }: { order: Order; onClose: () => void; onUpdate: (id: string, s: string, t?: string) => void }) {
  const [newStatus, setNewStatus] = useState(order.status);
  const [tracking, setTracking] = useState((order as any).tracking_code || '');

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Pedido {order.id}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formGrid} style={{ marginBottom: '1rem' }}>
            <div>
              <div className={styles.formLabel}>Cliente</div>
              <div style={{ marginTop: '0.3rem' }}>{(order as any).customer_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{(order as any).customer_email}</div>
            </div>
            <div>
              <div className={styles.formLabel}>Endereço de Entrega</div>
              <div style={{ marginTop: '0.3rem', fontSize: '0.82rem' }}>{order.shipping_address}</div>
            </div>
            <div>
              <div className={styles.formLabel}>Total</div>
              <div className={styles.price} style={{ marginTop: '0.3rem', fontSize: '1.2rem' }}>{fmt(order.total)}</div>
            </div>
            <div>
              <div className={styles.formLabel}>Pagamento</div>
              <div style={{ marginTop: '0.3rem', fontSize: '0.82rem' }}>{order.payment_method}</div>
            </div>
          </div>

          <div className={styles.formLabel} style={{ marginBottom: '0.5rem' }}>Itens do Pedido</div>
          <div className={styles.tableWrapper} style={{ marginBottom: '1rem' }}>
            <table>
              <thead><tr><th>Produto</th><th>Variante</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr></thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{item.variant_title}</td>
                    <td>{item.quantity}</td>
                    <td className={styles.price}>{fmt(item.unit_price)}</td>
                    <td className={styles.price}>{fmt(item.unit_price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Status do Pedido</label>
              <select className={styles.formInput} value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Código de Rastreamento</label>
              <input className={styles.formInput} value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Ex: BR123456789BR" />
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Fechar</button>
          <button
            className={`${styles.btnSmall} ${styles.btnSmallPrimary}`}
            onClick={() => { onUpdate(order.id, newStatus, tracking); }}
          >
            <CheckCircle size={13} /> Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB: STOCK
// ============================================================
function StockTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isOwner } = useAuth();
  const podeApagar = isOwner || user?.areas?.produtos === 'rw';
  const [adjusting, setAdjusting] = useState<{ product: Product; qty: string; reason: string; modo: 'somar' | 'definir' } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getStock();
      setProducts(res.products);
      setMovements(res.movements);
    } catch {/* */}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdjust = async () => {
    if (!adjusting) return;
    if (adjusting.qty === '') { alert('Informe a quantidade.'); return; }
    try {
      if (adjusting.modo === 'definir') {
        await api.admin.setStock(adjusting.product.id, Number(adjusting.qty), adjusting.reason.trim());
      } else {
        if (!adjusting.reason.trim()) { alert('Informe o motivo do ajuste.'); return; }
        await api.admin.adjustStock(adjusting.product.id, Number(adjusting.qty), adjusting.reason);
      }
      setAdjusting(null);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const apagar = async (p: Product) => {
    if (!confirm(`Apagar "${p.name}" do estoque e da loja?\n\nSe já houve vendas dele, ele será apenas arquivado (some da loja, mantém o histórico).`)) return;
    try {
      await api.admin.deleteProductForever(p.id);
    } catch {
      try { await api.admin.deleteProduct(p.id); alert('Este produto já tem vendas: foi arquivado em vez de apagado (volta em Produtos → Arquivados).'); }
      catch (e: any) { alert(e.message); return; }
    }
    load();
  };

  return (
    <>
      <div className={styles.twoColGrid}>
        <div>
          <div className={styles.sectionHeader}><span className={styles.sectionTitle}>Estoque Atual</span></div>
          <div className={styles.tableWrapper}>
            {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
              <table>
                <thead><tr><th>Produto</th><th>Estoque</th><th>Quantidade</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className={styles.productName} style={{ fontSize: '0.8rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>{p.category_id}</div>
                      </td>
                      <td className={p.stock === 0 ? styles.stockOut : p.stock <= 3 ? styles.stockLow : styles.stockOk}>
                        {p.stock} un.
                      </td>
                      <td>
                        <button
                          className={`${styles.btnSmall} ${styles.btnSmallGhost}`}
                          onClick={() => setAdjusting({ product: p, qty: String(p.stock), reason: '', modo: 'definir' })}
                        >
                          <Edit2 size={11} /> Alterar
                        </button>
                        {podeApagar && (
                          <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} style={{ marginLeft: 6 }} title="Apagar produto" onClick={() => apagar(p)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <div className={styles.sectionHeader}><span className={styles.sectionTitle}>Histórico de Movimentos</span></div>
          <div className={styles.tableWrapper}>
            {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {movements.length === 0 && <div className={styles.emptyState}>Sem movimentos registrados.</div>}
                {movements.map(m => (
                  <div key={m.id} className={styles.auditEntry}>
                    <div
                      className={styles.auditDot}
                      style={{ background: m.quantity_change > 0 ? 'var(--adm-green)' : 'var(--adm-red)' }}
                    />
                    <div>
                      <div className={styles.auditAction}>
                        {m.quantity_change > 0 ? <ArrowUpCircle size={12} style={{ display: 'inline', color: 'var(--adm-green)' }} /> : <ArrowDownCircle size={12} style={{ display: 'inline', color: 'var(--adm-red)' }} />}
                        {' '}{m.product_name} {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                      </div>
                      <div className={styles.auditMeta}>
                        {m.previous_stock} → {m.new_stock} un. · {m.reason} · {fmtDate(m.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {adjusting && (
        <div className={styles.modalOverlay} onClick={() => setAdjusting(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Estoque — {adjusting.product.name}</span>
              <button className={styles.modalCloseBtn} onClick={() => setAdjusting(null)}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                <label className={styles.formLabel}>Estoque atual</label>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--adm-text)' }}>
                  {adjusting.product.stock} unidades
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
                <button className={`${styles.btnSmall} ${adjusting.modo === 'definir' ? styles.btnSmallPrimary : styles.btnSmallGhost}`} onClick={() => setAdjusting(a => a ? { ...a, modo: 'definir', qty: String(a.product.stock) } : null)}>Definir total</button>
                <button className={`${styles.btnSmall} ${adjusting.modo === 'somar' ? styles.btnSmallPrimary : styles.btnSmallGhost}`} onClick={() => setAdjusting(a => a ? { ...a, modo: 'somar', qty: '' } : null)}>Somar / subtrair</button>
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                <label className={styles.formLabel}>{adjusting.modo === 'definir' ? 'Nova quantidade em estoque' : 'Variação de quantidade (use - para reduzir)'}</label>
                <input
                  type="number"
                  className={styles.formInput}
                  placeholder={adjusting.modo === 'definir' ? 'Ex: 12' : 'Ex: +5 ou -2'}
                  min={adjusting.modo === 'definir' ? 0 : undefined}
                  value={adjusting.qty}
                  onChange={e => setAdjusting(a => a ? { ...a, qty: e.target.value } : null)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Motivo{adjusting.modo === 'somar' ? ' *' : ' (opcional)'}</label>
                <input
                  className={styles.formInput}
                  placeholder="Ex: Recebimento de mercadoria, Devolução, Contagem do inventário"
                  value={adjusting.reason}
                  onChange={e => setAdjusting(a => a ? { ...a, reason: e.target.value } : null)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setAdjusting(null)}>Cancelar</button>
              <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleAdjust}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// TAB: CONTEÚDO (textos e imagens da loja)
// ============================================================
type CampoConteudo = Awaited<ReturnType<typeof api.admin.getContent>>[number];

function ContentTab() {
  const { refreshContent } = useSite();
  const [campos, setCampos] = useState<CampoConteudo[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const lista = await api.admin.getContent();
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

// ============================================================
// TAB: CATEGORIAS
// ============================================================
function CategoriesTab() {
  const { refreshCategories } = useSite();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await api.admin.getCategories()); } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const afterChange = () => { load(); void refreshCategories(); };

  const [movendo, setMovendo] = useState<{ cat: Category; destino: string } | null>(null);

  const handleDelete = async (c: Category) => {
    if ((c.product_count ?? 0) > 0) {
      const outras = items.filter(x => x.id !== c.id);
      if (outras.length === 0) { alert('Esta categoria tem produtos e não há outra para recebê-los. Crie outra categoria primeiro.'); return; }
      setMovendo({ cat: c, destino: outras[0].id });
      return;
    }
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
    try { await api.admin.deleteCategory(c.id); afterChange(); } catch (e: any) { alert(e.message); }
  };

  const confirmarMover = async () => {
    if (!movendo) return;
    try { await api.admin.deleteCategory(movendo.cat.id, movendo.destino); setMovendo(null); afterChange(); } catch (e: any) { alert(e.message); }
  };

  const mover = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const ids = items.map(c => c.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await api.admin.reorderCategories(ids); afterChange(); } catch (e: any) { alert(e.message); }
  };

  const toggleActive = async (c: Category) => {
    try { await api.admin.updateCategory(c.id, { is_active: c.is_active ? 0 : 1 }); afterChange(); } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Categorias da Loja</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={() => setCreating(true)}>
          <Plus size={13} /> Nova Categoria
        </button>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
          <table>
            <thead><tr><th>Imagem</th><th>Nome</th><th>Endereço</th><th>Produtos</th><th>Ordem</th><th>Na loja</th><th>Ações</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={7} className={styles.emptyState}>Nenhuma categoria criada.</td></tr>}
              {items.map((c, i) => (
                <tr key={c.id}>
                  <td>{c.image_url && <img src={c.image_url} alt={c.name} className={styles.productImg} style={{ width: 60, height: 36 }} onError={() => {}} />}</td>
                  <td className={styles.productName}>{c.name}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>#{c.slug}</td>
                  <td>{c.product_count ?? 0}</td>
                  <td>
                    <button className={styles.btnIcon} disabled={i === 0} onClick={() => mover(i, -1)} title="Subir">▲</button>
                    <button className={styles.btnIcon} disabled={i === items.length - 1} onClick={() => mover(i, 1)} title="Descer" style={{ marginLeft: 4 }}>▼</button>
                  </td>
                  <td>
                    <button className={`${styles.statusPill} ${c.is_active ? styles.statusConfirmed : styles.statusCancelled}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => toggleActive(c)} title="Clique para mostrar/esconder na loja">
                      {c.is_active ? 'Visível' : 'Oculta'}
                    </button>
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className={styles.btnIcon} onClick={() => setEditing(c)} title="Editar"><Edit2 size={13} /></button>
                      <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => handleDelete(c)} title="Excluir"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {movendo && (
        <div className={styles.modalOverlay} onClick={() => setMovendo(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Excluir "{movendo.cat.name}"</span>
              <button className={styles.modalCloseBtn} onClick={() => setMovendo(null)}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.85rem', marginTop: 0 }}>Esta categoria tem {movendo.cat.product_count} produto(s). Para onde eles devem ir?</p>
              <select className={styles.formInput} value={movendo.destino} onChange={e => setMovendo(m => m ? { ...m, destino: e.target.value } : null)}>
                {items.filter(x => x.id !== movendo.cat.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setMovendo(null)}>Cancelar</button>
              <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={confirmarMover}>Mover produtos e excluir</button>
            </div>
          </div>
        </div>
      )}
      {(editing || creating) && (
        <CategoryModal
          category={editing || undefined}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); afterChange(); }}
        />
      )}
    </>
  );
}

function CategoryModal({ category, onClose, onSaved }: { category?: Category; onClose: () => void; onSaved: () => void }) {
  const isNew = !category;
  const [form, setForm] = useState({
    name: category?.name || '',
    description: category?.description || '',
    image_url: category?.image_url || '',
    display_order: category?.display_order ?? 0,
    is_active: category ? Boolean(category.is_active) : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('O nome da categoria é obrigatório.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, is_active: form.is_active ? 1 : 0 };
      if (isNew) await api.admin.createCategory(payload);
      else await api.admin.updateCategory(category!.id, payload);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? 'Nova Categoria' : 'Editar Categoria'}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Nome *</label>
              <input className={styles.formInput} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Anéis" />
              {!isNew && <span style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>O endereço (#{category!.slug}) não muda ao renomear, para não quebrar links.</span>}
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Descrição (aparece no topo da página da categoria)</label>
              <textarea className={styles.formInput} rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagem da categoria</label>
              <ImageField value={form.image_url} onChange={v => set('image_url', v)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Ordem no menu (menor aparece primeiro)</label>
              <input type="number" className={styles.formInput} value={form.display_order} onChange={e => set('display_order', Number(e.target.value))} />
            </div>
            <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
              <label className={styles.switchLabel}>
                <input type="checkbox" className={styles.switchInput} checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                Visível na loja
              </label>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar Categoria'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB: BANNERS
// ============================================================
function BannersTab() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setBanners(await api.admin.getBanners()); } catch {/* */}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Excluir banner "${title}"?`)) return;
    try { await api.admin.deleteBanner(id); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Banners da Homepage</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={() => setCreating(true)}>
          <Plus size={13} /> Novo Banner
        </button>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
          <table>
            <thead><tr><th>Prévia</th><th>Título</th><th>Subtítulo</th><th>Ordem</th><th>Ativo</th><th>Ações</th></tr></thead>
            <tbody>
              {banners.length === 0 && <tr><td colSpan={6} className={styles.emptyState}>Nenhum banner criado.</td></tr>}
              {banners.map(b => (
                <tr key={b.id}>
                  <td>
                    {b.image_desktop && (
                      <img src={b.image_desktop} alt={b.title} className={styles.productImg} style={{ width: 60, height: 36 }} onError={() => {}} />
                    )}
                  </td>
                  <td className={styles.productName}>{b.title}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{b.subtitle || '—'}</td>
                  <td>{b.display_order}</td>
                  <td>
                    <span className={`${styles.statusPill} ${b.is_active ? styles.statusConfirmed : styles.statusCancelled}`}>
                      {b.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button className={styles.btnIcon} onClick={() => setEditing(b)} title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => handleDelete(b.id, b.title)} title="Excluir">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(editing || creating) && (
        <BannerModal
          banner={editing || undefined}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </>
  );
}

function BannerModal({ banner, onClose, onSaved }: { banner?: Banner; onClose: () => void; onSaved: () => void }) {
  const isNew = !banner;
  const [form, setForm] = useState({
    title: banner?.title || '',
    subtitle: banner?.subtitle || '',
    badge: banner?.badge || '',
    cta_text: banner?.cta_text || '',
    cta_link: banner?.cta_link || '',
    image_desktop: banner?.image_desktop || '',
    image_mobile: banner?.image_mobile || '',
    is_active: banner ? Boolean(banner.is_active) : true,
    display_order: banner?.display_order ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.image_desktop) {
      setError('Título e imagem desktop são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, is_active: form.is_active ? 1 : 0 };
      if (isNew) await api.admin.createBanner(payload);
      else await api.admin.updateBanner(banner!.id, payload);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? 'Novo Banner' : 'Editar Banner'}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Título *</label>
              <input className={styles.formInput} value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Subtítulo</label>
              <input className={styles.formInput} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Badge (ex: Novo)</label>
              <input className={styles.formInput} value={form.badge} onChange={e => set('badge', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Texto do Botão (CTA)</label>
              <input className={styles.formInput} value={form.cta_text} onChange={e => set('cta_text', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Link do Botão</label>
              <input className={styles.formInput} value={form.cta_link} onChange={e => set('cta_link', e.target.value)} placeholder="#pulseiras" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagem Desktop *</label>
              <ImageField value={form.image_desktop} onChange={v => set('image_desktop', v)} />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagem Mobile</label>
              <ImageField value={form.image_mobile} onChange={v => set('image_mobile', v)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Ordem de Exibição</label>
              <input type="number" className={styles.formInput} value={form.display_order} onChange={e => set('display_order', Number(e.target.value))} min={1} />
            </div>
            <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
              <label className={styles.switchLabel}>
                <input type="checkbox" className={styles.switchInput} checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                Banner ativo na loja
              </label>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? <><div className={styles.spinner} style={{ width: 13, height: 13 }} /> Salvando…</> : 'Salvar Banner'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB: COUPONS
// ============================================================
function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  const load = async () => {
    setLoading(true);
    try { setCoupons(await api.admin.getCoupons()); } catch {/* */}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Excluir cupom "${code}"?`)) return;
    try { await api.admin.deleteCoupon(id); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Cupons de Desconto</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={() => setCreating(true)}>
          <Plus size={13} /> Novo Cupom
        </button>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
          <table>
            <thead>
              <tr><th>Código</th><th>Tipo</th><th>Desconto</th><th>Gasto mín.</th><th>Usos</th><th>Validade</th><th>Ativo</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {coupons.length === 0 && <tr><td colSpan={8} className={styles.emptyState}>Nenhum cupom criado.</td></tr>}
              {coupons.map(c => (
                <tr key={c.id}>
                  <td><span className={`${styles.tag} ${styles.tagGold}`}>{c.code}</span></td>
                  <td style={{ fontSize: '0.75rem' }}>{c.discount_type === 'percent' ? 'Percentual' : 'Fixo (R$)'}</td>
                  <td className={styles.price}>
                    {c.discount_type === 'percent' ? `${c.discount_value}%` : fmt(c.discount_value)}
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>{c.min_spend > 0 ? fmt(c.min_spend) : '—'}</td>
                  <td>{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                  <td style={{ fontSize: '0.75rem' }}>
                    {c.expires_at ? (c.expires_at < new Date().toISOString().slice(0, 10) ? <span style={{ color: '#E05252' }}>Expirou {c.expires_at.split('-').reverse().join('/')}</span> : c.expires_at.split('-').reverse().join('/')) : '—'}
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${c.is_active ? styles.statusConfirmed : styles.statusCancelled}`}>
                      {c.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <button className={styles.btnIcon} onClick={() => setEditing(c)} title="Editar" style={{ marginRight: 4 }}>
                      <Edit2 size={13} />
                    </button>
                    <button className={`${styles.btnIcon} ${styles.btnIconDanger}`} onClick={() => handleDelete(c.id, c.code)} title="Excluir">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(creating || editing) && <CouponModal coupon={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />}
    </>
  );
}

function CouponModal({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: coupon?.code ?? '',
    discount_type: coupon?.discount_type ?? 'percent',
    discount_value: coupon ? String(coupon.discount_value) : '',
    min_spend: coupon && coupon.min_spend ? String(coupon.min_spend) : '',
    expires_at: coupon?.expires_at ?? '',
    usage_limit: coupon?.usage_limit ? String(coupon.usage_limit) : '',
    per_customer_limit: coupon?.per_customer_limit ? String(coupon.per_customer_limit) : '',
    is_active: coupon ? Boolean(coupon.is_active) : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.code || !form.discount_value) {
      setError('Código e valor do desconto são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const corpo = {
        discount_type: form.discount_type as any,
        discount_value: Number(form.discount_value),
        min_spend: Number(form.min_spend) || 0,
        expires_at: form.expires_at || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        per_customer_limit: form.per_customer_limit ? Number(form.per_customer_limit) : null,
        is_active: form.is_active ? 1 : 0,
      };
      if (coupon) await api.admin.updateCoupon(coupon.id, corpo);
      else await api.admin.createCoupon({ code: form.code.toUpperCase(), ...corpo });
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{coupon ? `Editar cupom ${coupon.code}` : 'Novo Cupom de Desconto'}</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Código do Cupom *</label>
              <input className={styles.formInput} value={form.code} disabled={Boolean(coupon)} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="EX: OURO20" style={{ letterSpacing: '0.1em', fontWeight: 600 }} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo de Desconto</label>
              <select className={styles.formInput} value={form.discount_type} onChange={e => set('discount_type', e.target.value)}>
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Valor do Desconto *</label>
              <input type="number" className={styles.formInput} value={form.discount_value} onChange={e => set('discount_value', e.target.value)} min={0} step={0.01} placeholder={form.discount_type === 'percent' ? 'Ex: 15' : 'Ex: 50.00'} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Compra Mínima (R$)</label>
              <input type="number" className={styles.formInput} value={form.min_spend} onChange={e => set('min_spend', e.target.value)} min={0} step={0.01} placeholder="0 = sem mínimo" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Válido até</label>
              <input type="date" className={styles.formInput} value={form.expires_at} onChange={e => set('expires_at', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Limite total de usos</label>
              <input type="number" className={styles.formInput} value={form.usage_limit} onChange={e => set('usage_limit', e.target.value)} min={1} step={1} placeholder="vazio = sem limite" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Usos por cliente</label>
              <input type="number" className={styles.formInput} value={form.per_customer_limit} onChange={e => set('per_customer_limit', e.target.value)} min={1} step={1} placeholder="vazio = sem limite" />
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.switchLabel}>
                <input type="checkbox" className={styles.switchInput} checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                Cupom ativo (utilizável imediatamente)
              </label>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? <><div className={styles.spinner} style={{ width: 13, height: 13 }} /> Salvando…</> : coupon ? 'Salvar alterações' : 'Criar Cupom'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB: SETTINGS
// ============================================================
function SettingsTab() {
  const { refreshContent } = useSite();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.admin.getSettings().then(s => {
      // Lojas antigas guardam estes dados com outros nomes: mostra o valor existente nos campos novos
      const alias: Record<string, string> = { store_email: 'contact_email', store_phone: 'contact_whatsapp', store_slogan: 'store_tagline', store_instagram: 'instagram' };
      const completo = { ...s };
      for (const [novo, antigo] of Object.entries(alias)) if (!completo[novo] && s[antigo]) completo[novo] = s[antigo];
      setSettings(completo);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const set = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.admin.updateSettings(settings);
      void refreshContent();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  if (loading) return <div className={styles.loader}><div className={styles.spinner}/></div>;

  const SETTING_FIELDS: { key: string; label: string; placeholder?: string; type?: string }[] = [
    { key: 'store_name', label: 'Nome da Loja', placeholder: "Luce D'Oro" },
    { key: 'store_slogan', label: 'Slogan', placeholder: 'Joalheria Contemporânea' },
    { key: 'store_email', label: 'E-mail de Contato', placeholder: 'contato@cddeouro.com.br', type: 'email' },
    { key: 'store_phone', label: 'Telefone / WhatsApp', placeholder: '+55 11 99999-9999' },
    { key: 'store_instagram', label: 'Instagram (@ ou URL)', placeholder: '@cddeouro' },
    { key: 'free_shipping_threshold', label: 'Frete Grátis a partir de (R$)', placeholder: '350', type: 'number' },
    { key: 'store_cnpj', label: 'CNPJ', placeholder: '00.000.000/0001-00' },
    { key: 'store_address', label: 'Endereço Completo', placeholder: 'Rua das Joias, 100 — São Paulo, SP' },
    { key: 'meta_description', label: 'Meta Description (SEO)', placeholder: 'Joias folheadas e semi-joias premium' },
  ];

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Configurações da Loja</span>
        <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleSave} disabled={saving}>
          {saving ? <><div className={styles.spinner} style={{ width: 13, height: 13 }} /> Salvando…</> : saved ? <><CheckCircle size={13} /> Salvo!</> : 'Salvar Configurações'}
        </button>
      </div>

      <div className={styles.tableWrapper} style={{ padding: '1.5rem' }}>
        <div className={styles.formGrid}>
          {SETTING_FIELDS.map(f => (
            <div key={f.key} className={styles.formGroup}>
              <label className={styles.formLabel}>{f.label}</label>
              <input
                type={f.type || 'text'}
                className={styles.formInput}
                value={settings[f.key] || ''}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================
// TAB: AUDIT
// ============================================================
function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getAuditLogs().then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      {loading ? (
        <div className={styles.loader}><div className={styles.spinner}/></div>
      ) : (
        <div className={styles.tableWrapper}>
          <div style={{ padding: '1rem', maxHeight: 600, overflowY: 'auto' }}>
            {logs.length === 0 && <div className={styles.emptyState}>Nenhum evento registrado.</div>}
            {logs.map(l => (
              <div key={l.id} className={styles.auditEntry}>
                <div className={styles.auditDot} />
                <div>
                  <div className={styles.auditAction}>
                    [{l.entity}] {l.action}
                    {l.entity_id && <span style={{ color: 'var(--adm-text-muted)', fontWeight: 400 }}> #{l.entity_id}</span>}
                  </div>
                  <div className={styles.auditMeta}>
                    {l.user_email || 'Sistema'} · {fmtDate(l.created_at)}
                    {l.ip_address && ` · IP: ${l.ip_address}`}
                  </div>
                  {l.details && (
                    <details style={{ marginTop: '0.25rem' }}>
                      <summary style={{ fontSize: '0.7rem', color: 'var(--adm-text-dim)', cursor: 'pointer' }}>Detalhes</summary>
                      <pre style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)', marginTop: '0.3rem', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(l.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// TAB: CLIENTES (lista + ficha)
// ============================================================
function CustomersTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [ficha, setFicha] = useState<{ cliente: any; resumo: { pedidos: number; gasto: number }; pedidos: any[] } | null>(null);

  useEffect(() => {
    api.admin.getCustomers().then(setCustomers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const abrir = async (id: number) => {
    try { setFicha(await api.admin.getCustomer(id)); } catch (e: any) { alert(e.message); }
  };

  const q = busca.trim().toLowerCase();
  const lista = q ? customers.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(q)) : customers;

  return (
    <>
      <div className={styles.filterRow}>
        <input className={styles.formInput} style={{ maxWidth: 320 }} placeholder="Buscar por nome ou e-mail…" value={busca} onChange={e => setBusca(e.target.value)} />
        <span style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{lista.length} cliente(s)</span>
      </div>
      {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
        <div className={styles.tableWrapper}>
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Pedidos</th><th>Gasto Total</th><th>Desde</th><th></th></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={6} className={styles.emptyState}>Nenhum cliente encontrado.</td></tr>}
              {lista.map((c: any) => (
                <tr key={c.id}>
                  <td className={styles.productName}>{c.name}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{c.email}</td>
                  <td>{c.orders_count || 0}</td>
                  <td className={styles.price}>{fmt(c.total_spent || 0)}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{fmtDate(c.created_at)}</td>
                  <td><button className={styles.btnIcon} onClick={() => abrir(c.id)} title="Ver ficha"><Eye size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ficha && (
        <div className={styles.modalOverlay} onClick={() => setFicha(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{ficha.cliente.name}</span>
              <button className={styles.modalCloseBtn} onClick={() => setFicha(null)}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ fontSize: '0.8rem', color: 'var(--adm-text-muted)', marginBottom: '1rem' }}>
                {ficha.cliente.email} · cliente desde {fmtDate(ficha.cliente.created_at)}
              </div>
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                <div><div style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>Pedidos</div><strong>{ficha.resumo.pedidos}</strong></div>
                <div><div style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>Total gasto</div><strong>{fmt(ficha.resumo.gasto)}</strong></div>
              </div>
              <table>
                <thead><tr><th>Pedido</th><th>Data</th><th>Status</th><th>Total</th></tr></thead>
                <tbody>
                  {ficha.pedidos.length === 0 && <tr><td colSpan={4} className={styles.emptyState}>Ainda sem pedidos.</td></tr>}
                  {ficha.pedidos.map((p: any) => (
                    <tr key={p.id}>
                      <td style={{ fontSize: '0.75rem' }}>{p.id}</td>
                      <td style={{ fontSize: '0.75rem' }}>{fmtDate(p.created_at)}</td>
                      <td style={{ fontSize: '0.75rem' }}>{p.status}</td>
                      <td className={styles.price}>{fmt(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// TAB: EQUIPE (somente proprietário)
// ============================================================
function TeamTab() {
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
