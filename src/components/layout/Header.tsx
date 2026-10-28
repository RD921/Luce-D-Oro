import React, { useState, useEffect, useRef } from 'react';
import { User, ShoppingBag, Menu, X, LogOut, Package, ChevronRight, LayoutDashboard, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useSite } from '../../context/SiteContext';
import styles from './Header.module.css';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, param?: string) => void;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onOpenAdmin }) => {
  const { user, isAuthenticated, canAdmin, openAuthModal, logout, setOrdersModalOpen } = useAuth();
  const { cart, openCartDrawer } = useCart();
  const { categories, c, ed } = useSite();

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAvatarClick = () => {
    if (isAuthenticated) {
      setAccountDropdownOpen((prev) => !prev);
    } else {
      openAuthModal();
    }
  };

  const handleCategoryClick = (categorySlug: string) => {
    onNavigate('category', categorySlug);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className={`${styles.header} ${isScrolled ? styles.headerScrolled : ''}`}>
        <div className={styles.container}>
          {/* Mobile Menu Toggle Button */}
          <button
            className={styles.mobileToggle}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu de navegação'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>

          {/* Left Region — Compact Brand Logo (Apple luxury style) */}
          <div className={styles.logoLeft}>
            <button
              onClick={() => onNavigate('home')}
              className={styles.brandButton}
              aria-label="Luce D'Oro - Página Inicial"
            >
              <img
                {...ed('logo_header')}
                src={c('logo_header') || '/images/logo-header.png'}
                alt="Luce D'Oro"
                className={styles.brandLogoImg}
              />
            </button>
          </div>

          {/* Center Region — Minimalist Apple Navigation */}
          <nav className={styles.navCenter} aria-label="Navegação Principal">
            <button
              onClick={() => onNavigate('home')}
              className={`${styles.navLink} ${currentView === 'home' ? styles.activeLink : ''}`}
            >
              Início
            </button>
            <button
              onClick={() => handleCategoryClick(categories[0]?.slug || 'aneis')}
              className={styles.navLink}
            >
              Coleções
            </button>
            {/* Real dynamic categories with Apple naming */}
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.slug)}
                className={`${styles.navLink} ${
                  currentView === 'category' &&
                  window.location.hash.replace('#', '').toLowerCase() === cat.slug
                    ? styles.activeLink
                    : ''
                }`}
              >
                {cat.name}
              </button>
            ))}
            <button
              onClick={() => {
                const storyEl = document.getElementById('historia-da-marca');
                if (storyEl) {
                  storyEl.scrollIntoView({ behavior: 'smooth' });
                } else {
                  onNavigate('home');
                }
              }}
              className={styles.navLink}
            >
              Sobre
            </button>
          </nav>

          {/* Right Region — Actions (Search, Account, Cart) */}
          <div className={styles.actionsRight}>
            {/* Search Icon */}
            <button
              onClick={() => handleCategoryClick(categories[0]?.slug || 'aneis')}
              className={styles.iconButton}
              aria-label="Buscar joias"
              title="Buscar no catálogo"
            >
              <Search size={19} strokeWidth={1.4} />
            </button>

            {/* Account Icon / Avatar Dropdown */}
            <div className={styles.accountWrapper} ref={accountRef}>
              <button
                id="header-avatar-btn"
                onClick={handleAvatarClick}
                className={`${styles.iconButton} ${accountDropdownOpen ? styles.iconButtonActive : ''}`}
                aria-label={isAuthenticated ? `Conta de ${user?.name}` : 'Entrar na sua conta'}
                aria-haspopup={isAuthenticated ? 'true' : 'dialog'}
                title={isAuthenticated ? `Conectado como ${user?.name}` : 'Entre na sua conta'}
              >
                <User size={19} strokeWidth={1.4} />
                {isAuthenticated && <span className={styles.onlineDot} />}
              </button>

              {/* Account Dropdown for Authenticated User */}
              {isAuthenticated && accountDropdownOpen && (
                <div className={styles.accountDropdown} role="menu">
                  <div className={styles.dropdownHeader}>
                    <p className={styles.userName}>{user?.name}</p>
                    <p className={styles.userEmail}>{user?.email}</p>
                  </div>
                  <div className={styles.dropdownDivider} />
                  {canAdmin && onOpenAdmin && (
                    <>
                      <button
                        className={styles.dropdownItem}
                        style={{ color: '#F6D5E0' }}
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          onOpenAdmin();
                        }}
                        role="menuitem"
                      >
                        <LayoutDashboard size={15} strokeWidth={1.5} />
                        <span>Painel Administrativo</span>
                        <ChevronRight size={13} className={styles.itemArrow} />
                      </button>
                      <div className={styles.dropdownDivider} />
                    </>
                  )}
                  <button
                    className={styles.dropdownItem}
                    onClick={() => {
                      setAccountDropdownOpen(false);
                      setOrdersModalOpen(true);
                    }}
                    role="menuitem"
                  >
                    <Package size={15} strokeWidth={1.5} />
                    <span>Meus Pedidos</span>
                    <ChevronRight size={13} className={styles.itemArrow} />
                  </button>
                  <div className={styles.dropdownDivider} />
                  <button
                    className={`${styles.dropdownItem} ${styles.logoutItem}`}
                    onClick={() => {
                      setAccountDropdownOpen(false);
                      logout();
                    }}
                    role="menuitem"
                  >
                    <LogOut size={15} strokeWidth={1.5} />
                    <span>Sair da conta</span>
                  </button>
                </div>
              )}
            </div>

            {/* Shopping Bag (Sacola) — Authenticated users access cart */}
            {isAuthenticated ? (
              <button
                id="header-cart-btn"
                onClick={openCartDrawer}
                className={`${styles.iconButton} ${styles.bagButton}`}
                aria-label={`Sacola de compras (${cart?.itemCount || 0} itens)`}
                title="Sua Sacola de Compras"
              >
                <ShoppingBag size={19} strokeWidth={1.4} />
                {cart && cart.itemCount > 0 && (
                  <span className={styles.bagBadge} id="cart-item-count">
                    {cart.itemCount}
                  </span>
                )}
              </button>
            ) : (
              <button
                id="header-cart-btn"
                onClick={() => openAuthModal()}
                className={`${styles.iconButton} ${styles.bagButton}`}
                aria-label="Entrar para acessar a sacola"
                title="Entrar para acessar a sacola"
              >
                <ShoppingBag size={19} strokeWidth={1.4} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenuOverlay} onClick={() => setMobileMenuOpen(false)}>
          <div className={styles.mobileMenuContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileMenuHeader}>
              <span className={styles.mobileMenuTitle}>Navegação</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className={styles.mobileCloseBtn}
                aria-label="Fechar menu"
              >
                <X size={20} />
              </button>
            </div>
            <nav className={styles.mobileNavLinks}>
              <button
                onClick={() => {
                  onNavigate('home');
                  setMobileMenuOpen(false);
                }}
                className={styles.mobileNavLink}
              >
                <span>Início</span>
                <ChevronRight size={15} />
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.slug)}
                  className={styles.mobileNavLink}
                >
                  <span>{cat.name}</span>
                  <ChevronRight size={15} />
                </button>
              ))}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  const storyEl = document.getElementById('historia-da-marca');
                  if (storyEl) storyEl.scrollIntoView({ behavior: 'smooth' });
                  else onNavigate('home');
                }}
                className={styles.mobileNavLink}
              >
                <span>Sobre a Luce D'Oro</span>
                <ChevronRight size={15} />
              </button>
            </nav>
            <div className={styles.mobileMenuFooter}>
              <p className={styles.mobileBrandQuote}>“Joias que iluminam histórias.”</p>
              <p className={styles.mobileCert}>Luce D’Oro Alta Joalheria</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
