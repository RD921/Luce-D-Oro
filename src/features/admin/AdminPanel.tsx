import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Archive, Image, Tag, Settings,
  Shield, X, Plus, Edit2, Trash2, Search,
  AlertTriangle, Users, ArrowUpCircle, ArrowDownCircle,
  CheckCircle, XCircle, Truck, Eye, LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, type Product, type Order, type Banner, type Coupon, type StockMovement, type AuditLog, type AdminAlert, type AdminDashboardData } from '../../services/api';
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

// ============================================================
// TABS
// ============================================================
type TabId = 'dashboard' | 'products' | 'orders' | 'stock' | 'banners' | 'coupons' | 'settings' | 'audit';

interface Tab { id: TabId; label: string; icon: React.ReactNode }

const TABS: Tab[] = [
  { id: 'dashboard',  label: 'Dashboard',    icon: <LayoutDashboard size={15} /> },
  { id: 'products',   label: 'Produtos',     icon: <Package size={15} /> },
  { id: 'orders',     label: 'Pedidos',      icon: <ShoppingCart size={15} /> },
  { id: 'stock',      label: 'Estoque',      icon: <Archive size={15} /> },
  { id: 'banners',    label: 'Banners',      icon: <Image size={15} /> },
  { id: 'coupons',    label: 'Cupons',       icon: <Tag size={15} /> },
  { id: 'settings',   label: 'Configurações',icon: <Settings size={15} /> },
  { id: 'audit',      label: 'Auditoria',    icon: <Shield size={15} /> },
];

// ============================================================
// MAIN ADMIN PANEL
// ============================================================
interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <div className={styles.adminRoot}>
      {/* -------- Sidebar -------- */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <span className={styles.sidebarBrandBadge}>⚡ Proprietário</span>
          <span className={styles.sidebarBrandName}>LUCE D'ORO</span>
          <span className={styles.sidebarOwner}>
            {user?.name || 'Rodrigo Arrezzi'}
          </span>
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.navSection}>
            <div className={styles.navSectionLabel}>Visão Geral</div>
            {TABS.slice(0, 4).map(tab => (
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

          <div className={styles.navSection}>
            <div className={styles.navSectionLabel}>Marketing &amp; Loja</div>
            {TABS.slice(4, 6).map(tab => (
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

          <div className={styles.navSection}>
            <div className={styles.navSectionLabel}>Sistema</div>
            {TABS.slice(6).map(tab => (
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
            {TABS.find(t => t.id === activeTab)?.label}
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
          {activeTab === 'orders'     && <OrdersTab />}
          {activeTab === 'stock'      && <StockTab />}
          {activeTab === 'banners'    && <BannersTab />}
          {activeTab === 'coupons'    && <CouponsTab />}
          {activeTab === 'settings'   && <SettingsTab />}
          {activeTab === 'audit'      && <AuditTab />}
        </div>
      </main>
    </div>
  );
};

// ============================================================
// TAB: DASHBOARD
// ============================================================
function DashboardTab() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([api.admin.getDashboard(period), api.admin.getAlerts()]);
      setData(d);
      setAlerts(a);
    } catch {/* */}
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className={styles.loader}><div className={styles.spinner}/> Carregando métricas…</div>;
  if (!data) return <div className={styles.emptyState}>Erro ao carregar dados.</div>;

  const statusEntries = Object.entries(data.statusCounts);

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
          <div className={styles.metricSub}>{data.ordersCount} pedidos</div>
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
          <div className={styles.metricSub}>{data.activeCoupons} cupons ativos</div>
        </div>
      </div>

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
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setProducts(await api.admin.getProducts()); } catch {/* */}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category_id.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja arquivar o produto "${name}"? Ele não será exibido na loja.`)) return;
    try {
      await api.admin.deleteProduct(id);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.filterRow}>
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
                        <button
                          className={styles.btnIcon}
                          title="Editar"
                          onClick={() => setEditing(p)}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                          title="Arquivar"
                          onClick={() => handleDelete(p.id, p.name)}
                        >
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
      </div>

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

// Product form modal
function ProductModal({ product, onClose, onSaved }: { product?: Product; onClose: () => void; onSaved: () => void }) {
  const isNew = !product;
  const [form, setForm] = useState({
    name: product?.name || '',
    slug: product?.slug || '',
    category_id: product?.category_id || 'pulseiras',
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
                <option value="pulseiras">Pulseiras</option>
                <option value="correntes">Correntes</option>
                <option value="brincos">Brincos</option>
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
              <label className={styles.formLabel}>Imagem Principal (URL) *</label>
              <input className={styles.formInput} value={form.image_primary} onChange={e => set('image_primary', e.target.value)} placeholder="https://…" />
              {form.image_primary && (
                <img src={form.image_primary} alt="" className={styles.bannerPreview} onError={() => {}} />
              )}
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagens adicionais (uma por linha)</label>
              <textarea className={styles.formInput} rows={3} value={form.images} onChange={e => set('images', e.target.value)} />
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
  const [adjusting, setAdjusting] = useState<{ product: Product; qty: string; reason: string } | null>(null);

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
    if (!adjusting || !adjusting.qty || !adjusting.reason) {
      alert('Informe a quantidade e o motivo do ajuste.');
      return;
    }
    try {
      await api.admin.adjustStock(adjusting.product.id, Number(adjusting.qty), adjusting.reason);
      setAdjusting(null);
      load();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className={styles.twoColGrid}>
        <div>
          <div className={styles.sectionHeader}><span className={styles.sectionTitle}>Estoque Atual</span></div>
          <div className={styles.tableWrapper}>
            {loading ? <div className={styles.loader}><div className={styles.spinner}/></div> : (
              <table>
                <thead><tr><th>Produto</th><th>Estoque</th><th>Ajustar</th></tr></thead>
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
                          onClick={() => setAdjusting({ product: p, qty: '', reason: '' })}
                        >
                          <Edit2 size={11} /> Ajustar
                        </button>
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
              <span className={styles.modalTitle}>Ajustar Estoque — {adjusting.product.name}</span>
              <button className={styles.modalCloseBtn} onClick={() => setAdjusting(null)}><X size={16} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                <label className={styles.formLabel}>Estoque atual</label>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--adm-text)' }}>
                  {adjusting.product.stock} unidades
                </div>
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                <label className={styles.formLabel}>Variação de quantidade (use - para reduzir)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  placeholder="Ex: +5 ou -2"
                  value={adjusting.qty}
                  onChange={e => setAdjusting(a => a ? { ...a, qty: e.target.value } : null)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Motivo do ajuste *</label>
                <input
                  className={styles.formInput}
                  placeholder="Ex: Recebimento de mercadoria, Devolução, Correção de inventário"
                  value={adjusting.reason}
                  onChange={e => setAdjusting(a => a ? { ...a, reason: e.target.value } : null)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => setAdjusting(null)}>Cancelar</button>
              <button className={`${styles.btnSmall} ${styles.btnSmallPrimary}`} onClick={handleAdjust}>Confirmar Ajuste</button>
            </div>
          </div>
        </div>
      )}
    </>
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
              <label className={styles.formLabel}>Imagem Desktop (URL) *</label>
              <input className={styles.formInput} value={form.image_desktop} onChange={e => set('image_desktop', e.target.value)} />
              {form.image_desktop && <img src={form.image_desktop} alt="" className={styles.bannerPreview} onError={() => {}} />}
            </div>
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Imagem Mobile (URL)</label>
              <input className={styles.formInput} value={form.image_mobile} onChange={e => set('image_mobile', e.target.value)} />
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
              <tr><th>Código</th><th>Tipo</th><th>Desconto</th><th>Gasto mín.</th><th>Usos</th><th>Ativo</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {coupons.length === 0 && <tr><td colSpan={7} className={styles.emptyState}>Nenhum cupom criado.</td></tr>}
              {coupons.map(c => (
                <tr key={c.id}>
                  <td><span className={`${styles.tag} ${styles.tagGold}`}>{c.code}</span></td>
                  <td style={{ fontSize: '0.75rem' }}>{c.discount_type === 'percent' ? 'Percentual' : 'Fixo (R$)'}</td>
                  <td className={styles.price}>
                    {c.discount_type === 'percent' ? `${c.discount_value}%` : fmt(c.discount_value)}
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>{c.min_spend > 0 ? fmt(c.min_spend) : '—'}</td>
                  <td>{c.usage_count}</td>
                  <td>
                    <span className={`${styles.statusPill} ${c.is_active ? styles.statusConfirmed : styles.statusCancelled}`}>
                      {c.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
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

      {creating && <CouponModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </>
  );
}

function CouponModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: '',
    min_spend: '',
    is_active: true,
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
      await api.admin.createCoupon({
        code: form.code.toUpperCase(),
        discount_type: form.discount_type as any,
        discount_value: Number(form.discount_value),
        min_spend: Number(form.min_spend) || 0,
        is_active: form.is_active ? 1 : 0,
      });
      onSaved();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Novo Cupom de Desconto</span>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          {error && <div className={`${styles.alertRow} ${styles.alertRowDanger}`} style={{ marginBottom: '1rem' }}><div className={styles.alertMsg}>{error}</div></div>}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Código do Cupom *</label>
              <input className={styles.formInput} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="EX: OURO20" style={{ letterSpacing: '0.1em', fontWeight: 600 }} />
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
            {saving ? <><div className={styles.spinner} style={{ width: 13, height: 13 }} /> Salvando…</> : 'Criar Cupom'}
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
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.admin.getSettings().then(s => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const set = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.admin.updateSettings(settings);
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
  const [customers, setCustomers] = useState<any[]>([]);
  const [view, setView] = useState<'logs' | 'customers'>('logs');

  useEffect(() => {
    Promise.all([api.admin.getAuditLogs(), api.admin.getCustomers()])
      .then(([l, c]) => { setLogs(l); setCustomers(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className={styles.filterRow}>
        <button
          className={`${styles.btnSmall} ${view === 'logs' ? styles.btnSmallPrimary : styles.btnSmallGhost}`}
          onClick={() => setView('logs')}
        >
          <Shield size={12} /> Log de Auditoria
        </button>
        <button
          className={`${styles.btnSmall} ${view === 'customers' ? styles.btnSmallPrimary : styles.btnSmallGhost}`}
          onClick={() => setView('customers')}
        >
          <Users size={12} /> Clientes ({customers.length})
        </button>
      </div>

      {loading ? (
        <div className={styles.loader}><div className={styles.spinner}/></div>
      ) : view === 'logs' ? (
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
      ) : (
        <div className={styles.tableWrapper}>
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Pedidos</th><th>Gasto Total</th><th>Desde</th></tr></thead>
            <tbody>
              {customers.length === 0 && <tr><td colSpan={5} className={styles.emptyState}>Nenhum cliente cadastrado.</td></tr>}
              {customers.map((c: any) => (
                <tr key={c.id}>
                  <td className={styles.productName}>{c.name}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{c.email}</td>
                  <td>{c.total_orders || 0}</td>
                  <td className={styles.price}>{fmt(c.total_spent || 0)}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
