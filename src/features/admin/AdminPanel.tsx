import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Package, ShoppingCart, Archive, Tag, Settings, Shield, X, Users, Truck, LogOut, Layers, CreditCard, Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { siteAtual, definirSiteAtual } from '../../services/siteAtual';
import { api, type AdminSite } from '../../services/api';
import { ArchitectureHome } from './ArchitectureHome';
import { DashboardTab } from './tabs/DashboardTab';
import { ProductsTab } from './tabs/ProductsTab';
import { OrdersTab } from './tabs/OrdersTab';
import { StockTab } from './tabs/StockTab';
import { CategoriesTab } from './tabs/CategoriesTab';
import { CouponsTab } from './tabs/CouponsTab';
import { SettingsSection } from './tabs/SettingsTab';
import { SETTINGS_SUB, type SettingsSub } from './tabs/constantes';
import { ArchitectureSection } from './tabs/ArchitectureSection';
import { AuditTab } from './tabs/AuditTab';
import { CustomersTab } from './tabs/CustomersTab';
import { ShippingTab } from './tabs/ShippingTab';
import { PaymentsTab } from './tabs/PaymentsTab';
import { TeamTab } from './tabs/TeamTab';
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
            marginTop: '1rem', padding: '0.6rem 1.5rem', background: '#9199a4',
            border: 'none', borderRadius: 4, color: '#0F0F0F', fontWeight: 600, cursor: 'pointer'
          }}>Fechar Painel</button>
        </div>
      );
    }
    return this.props.children;
  }
}


// ============================================================
// TABS
// ============================================================
type TabId = 'dashboard' | 'products' | 'categories' | 'content' | 'orders' | 'stock' | 'banners' | 'coupons' | 'customers' | 'shipping' | 'payments' | 'team' | 'settings' | 'audit' | 'architecture';


// area = nome da área no servidor; owner = só o proprietário vê
interface Tab { id: TabId; label: string; icon: React.ReactNode; group: string; area?: string; owner?: boolean; qualquer?: string[] }


const TABS: Tab[] = [
  { id: 'dashboard',  label: 'Dashboard',    icon: <LayoutDashboard size={15} />, group: 'Visão Geral', area: 'dashboard' },
  { id: 'products',   label: 'Produtos',     icon: <Package size={15} />,         group: 'Visão Geral', area: 'produtos' },
  { id: 'categories', label: 'Categorias',   icon: <Layers size={15} />,          group: 'Visão Geral', area: 'categorias' },
  { id: 'orders',     label: 'Pedidos',      icon: <ShoppingCart size={15} />,    group: 'Visão Geral', area: 'pedidos' },
  { id: 'customers',  label: 'Clientes',     icon: <Users size={15} />,           group: 'Visão Geral', area: 'clientes' },
  { id: 'stock',      label: 'Estoque',      icon: <Archive size={15} />,         group: 'Marketing & Loja', area: 'estoque' },
  { id: 'coupons',    label: 'Cupons',       icon: <Tag size={15} />,             group: 'Sistema', area: 'cupons' },
  { id: 'shipping',   label: 'Entrega',      icon: <Truck size={15} />,           group: 'Sistema', area: 'entrega' },
  { id: 'payments',   label: 'Pagamento',    icon: <CreditCard size={15} />,      group: 'Sistema', area: 'pagamento' },
  { id: 'settings',   label: 'Configurações',icon: <Settings size={15} />,        group: 'Sistema', area: 'configuracoes' },
  { id: 'architecture', label: 'Arquitetura Adm.', icon: <Layers size={15} />,    group: 'Sistema', area: 'arquitetura', qualquer: ['arquitetura', 'banners', 'conteudo', 'uploads'] },
  { id: 'team',       label: 'Equipe',       icon: <Shield size={15} />,          group: 'Sistema', owner: true },
  { id: 'audit',      label: 'Auditoria',    icon: <Shield size={15} />,          group: 'Sistema', area: 'auditoria' },
];



// ============================================================
// MAIN ADMIN PANEL
// ============================================================
interface AdminPanelProps {
  onClose: () => void;
}


export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { user, logout, isOwner } = useAuth();
  const pode = (area: string) => Boolean(isOwner || user?.areas?.[area]);
  const abas = TABS.filter(t => (t.owner ? isOwner : isOwner || (t.qualquer ? t.qualquer.some(a => user?.areas?.[a]) : Boolean(t.area && user?.areas?.[t.area]))));
  const [activeTab, setActiveTab] = useState<TabId>(abas[0]?.id ?? 'dashboard');
  const canSettings = abas.some(t => t.id === 'settings');
  const [settingsSub, setSettingsSub] = useState<SettingsSub>('geral');
  const [archSection, setArchSection] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string>(() => siteAtual());
  const [sites, setSites] = useState<AdminSite[]>([]);
  const carregarSites = useCallback(() => {
    if (!(isOwner || user?.areas?.conteudo)) return Promise.resolve();
    return api.admin.getSites().then(l => { setSites(l); if (!l.some(x => x.id === siteAtual())) { definirSiteAtual('luce-d-oro'); setSiteId('luce-d-oro'); } }).catch(() => {});
  }, [isOwner, user]);
  useEffect(() => { void carregarSites(); }, [carregarSites]);
  const trocarSite = (id: string) => { definirSiteAtual(id); setSiteId(id); };
  const [online, setOnline] = useState<boolean | null>(null);
  const [sino, setSino] = useState(false);
  const [notifs, setNotifs] = useState<{ itens: Array<{ id: number; tipo: string; titulo: string; mensagem: string; created_at: string; lida: boolean }>; naoLidas: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    const buscar = () => api.admin.getNotifications('', 8).then(r => { if (vivo) setNotifs(r); }).catch(() => {});
    buscar();
    const t = setInterval(buscar, 60000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  const [menuConta, setMenuConta] = useState(false);

  // "Sistema online" vem de uma verificação real do servidor, repetida a cada 30 segundos.
  useEffect(() => {
    let vivo = true;
    const checar = () => fetch('/api/health').then(r => r.ok).catch(() => false).then(ok => { if (vivo) setOnline(ok); });
    checar();
    const t = window.setInterval(checar, 30000);
    return () => { vivo = false; window.clearInterval(t); };
  }, []);
  const iniciaisUsuario = (user?.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  const papelRotulo = isOwner ? 'Proprietário' : user?.role === 'dev' ? 'Desenvolvedor' : 'Equipe';
  const abrirAba = (id: string) => { setActiveTab(id as TabId); setArchSection(null); };
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
          <span className={styles.sidebarBrandName}>LUCE D'ORO</span>
          <span className={styles.sidebarOwner}>{papelRotulo}</span>
        </div>

        <nav className={styles.sidebarNav}>
          {grupos.map(g => (
            <div key={g} className={styles.navSection}>
              <div className={styles.navSectionLabel}>{g}</div>
              {abas.filter(t => t.group === g).map(tab => (
                <React.Fragment key={tab.id}>
                  <button
                    onClick={() => abrirAba(tab.id)}
                    className={`${styles.navItem} ${activeTab === tab.id ? styles.navItemActive : ''}`}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.id === 'settings' && <ChevronDown size={14} style={{ marginLeft: 'auto', transform: activeTab === 'settings' ? 'none' : 'rotate(-90deg)', transition: 'transform 160ms' }} />}
                  </button>
                  {tab.id === 'settings' && activeTab === 'settings' && (
                    <div className={styles.subNav}>
                      {SETTINGS_SUB.map(sub => (
                        <button key={sub.id} className={`${styles.subNavItem} ${settingsSub === sub.id ? styles.subNavActive : ''}`} onClick={() => setSettingsSub(sub.id)}>{sub.label}</button>
                      ))}
                    </div>
                  )}
                </React.Fragment>
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
            <span className={styles.sysStatus} title="Resultado de uma verificação real do servidor">
              <span className={`${styles.dot} ${online ? styles.dotOk : online === false ? styles.dotFail : ''}`} />
              {online === null ? 'Verificando…' : online ? 'Sistema online' : 'Sem resposta do servidor'}
            </span>
            <div className={styles.relative}>
              <button className={styles.iconBtn} aria-label="Notificações" style={{ position: 'relative' }} onClick={() => { setSino(v => !v); setMenuConta(false); }}>
                <Bell size={17} strokeWidth={1.4} />
                {!!notifs?.naoLidas && <span data-testid="sino-contagem" style={{ position: 'absolute', top: -2, right: -2, background: '#e57373', color: '#fff', borderRadius: 9, fontSize: 10, minWidth: 16, height: 16, lineHeight: '16px', textAlign: 'center' }}>{notifs.naoLidas > 9 ? '9+' : notifs.naoLidas}</span>}
              </button>
              {sino && (
                <div className={styles.popover} style={{ width: 320, maxHeight: 380, overflowY: 'auto' }}>
                  {!notifs || notifs.itens.length === 0 ? <div>Nenhuma notificação.</div> : notifs.itens.map(n => (
                    <div key={n.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--adm-border)', opacity: n.lida ? 0.6 : 1 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: n.lida ? 400 : 600 }}>{n.titulo}</div>
                      <div style={{ fontSize: '.7rem', color: 'var(--adm-text-muted)' }}>{n.mensagem}</div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                    <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={async () => { await api.admin.markNotificationsRead().catch(() => {}); setNotifs(await api.admin.getNotifications('', 8)); }}>Marcar como lidas</button>
                    {canSettings && <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={() => { setSino(false); setSettingsSub('notificacoes'); setActiveTab('settings'); }}>Ver todas</button>}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.relative}>
              <button className={`${styles.iconBtn} ${styles.userChip}`} style={{ width: 'auto', padding: '0 .4rem' }} onClick={() => { setMenuConta(v => !v); setSino(false); }}>
                <span className={styles.avatar}>{iniciaisUsuario}</span>
                <span style={{ textAlign: 'left' }}>
                  <span className={styles.userName} style={{ display: 'block' }}>{user?.name}</span>
                  <span className={styles.userSub} style={{ display: 'block' }}>{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>
                </span>
                <ChevronDown size={14} />
              </button>
              {menuConta && (
                <div className={styles.popover} style={{ minWidth: 220 }}>
                  <div style={{ color: 'var(--adm-text)', marginBottom: 2 }}>{user?.name}</div>
                  <div style={{ marginBottom: 10 }}>{user?.email} · {papelRotulo}</div>
                  <button className={`${styles.btnSmall} ${styles.btnSmallGhost}`} onClick={onClose}>Voltar à loja</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {(activeTab === 'architecture' || activeTab === 'settings') && sites.length > 0 && (
          <div data-testid="barra-site" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 24px', borderBottom: '1px solid var(--adm-border)', fontSize: '.8rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--adm-text-muted)' }}>Site em edição</span>
            <select data-testid="seletor-site" className={styles.formInput} style={{ width: 'auto', minWidth: 220 }} value={siteId} onChange={e => trocarSite(e.target.value)}>
              {sites.map(x => <option key={x.id} value={x.id}>{x.nome}{x.principal ? ' (loja principal)' : ''}{x.status !== 'ativo' ? ` — ${x.status === 'em_construcao' ? 'em construção' : 'arquivado'}` : ''}</option>)}
            </select>
            {siteId !== 'luce-d-oro' && <span style={{ color: 'var(--adm-yellow)' }}>Conteúdo, imagens e SEO deste site são separados. Produtos, pedidos, clientes e banners são da loja principal.</span>}
          </div>
        )}
        <div className={styles.scrollArea} key={siteId}>
          {activeTab === 'dashboard'  && <DashboardTab />}
          {activeTab === 'products'   && <ProductsTab />}
          {activeTab === 'categories' && <CategoriesTab />}
          {activeTab === 'orders'     && <OrdersTab />}
          {activeTab === 'stock'      && <StockTab />}
          {activeTab === 'coupons'    && <CouponsTab />}
          {activeTab === 'customers'  && <CustomersTab />}
          {activeTab === 'shipping'   && <ShippingTab />}
          {activeTab === 'payments'   && <PaymentsTab />}
          {activeTab === 'team'       && isOwner && <TeamTab />}
          {activeTab === 'settings'   && <SettingsSection sub={settingsSub} />}
          {activeTab === 'architecture' && (archSection
            ? <><button className={styles.archBack} onClick={() => setArchSection(null)}>← Voltar para Arquitetura Adm.</button><ArchitectureSection secao={archSection} /></>
            : <ArchitectureHome online={online} onOpenSection={setArchSection} onNavigate={abrirAba} pode={pode} sites={sites} siteId={siteId} onSelectSite={trocarSite} onSitesChanged={carregarSites} />)}
          {activeTab === 'audit'      && <AuditTab />}
        </div>
      </main>
    </div>
  );
};
