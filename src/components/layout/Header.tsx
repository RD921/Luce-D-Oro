import React, { useState, useEffect, useRef } from 'react';
import { User, ShoppingBag, Menu, X, LogOut, Package, ChevronRight, LayoutDashboard } from 'lucide-react';
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
  const { categories } = useSite();

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
      setIsScrolled(window.scrollY > 20);
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
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu de categorias'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
          </button>

          {/* Left Region — Commercial Navigation */}
          <nav className={styles.navLeft} aria-label="Navegação de Categorias">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.slug)}
                className={`${styles.navLink} ${currentView === 'category' && window.location.hash.replace('#', '').toLowerCase() === cat.slug ? styles.activeLink : ''}`}
              >
                {cat.name}
              </button>
            ))}
          </nav>

          {/* Center Region — Brand Identity (Strictly Centered Horizontally) */}
          <div className={styles.logoCenter}>
            <button
              onClick={() => onNavigate('home')}
              className={styles.brandButton}
              aria-label="Luce D'Oro - Página Inicial"
            >
              <img
                src="/images/logo-header.png"
                alt="Luce D'Oro"
                className={styles.brandLogoImg}
              />
            </button>
          </div>

          {/* Right Region — Account and Bag */}
          <div className={styles.actionsRight}>
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
                <User size={20} strokeWidth={1.5} />
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
                  {/* EXCLUSIVE: Admin Panel only for Rodrigo Arrezzi (isOwner === true) */}
                  {canAdmin && onOpenAdmin && (
                    <>
                      <button
                        className={styles.dropdownItem}
                        style={{ color: '#B89758' }}
                        onClick={() => {
                          setAccountDropdownOpen(false);
                          onOpenAdmin();
                        }}
                        role="menuitem"
                      >
                        <LayoutDashboard size={16} strokeWidth={1.5} />
                        <span>Painel Administrativo</span>
                        <ChevronRight size={14} className={styles.itemArrow} />
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
                    <Package size={16} strokeWidth={1.5} />
                    <span>Meus Pedidos</span>
                    <ChevronRight size={14} className={styles.itemArrow} />
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
                    <LogOut size={16} strokeWidth={1.5} />
                    <span>Sair da conta</span>
                  </button>
                </div>
              )}
            </div>

            {/* Shopping Bag (Sacola) — STRICT RULE: Rendered ONLY when isAuthenticated === true */}
            {isAuthenticated && (
              <button
                id="header-cart-btn"
                onClick={openCartDrawer}
                className={`${styles.iconButton} ${styles.bagButton}`}
                aria-label={`Sacola de compras (${cart?.itemCount || 0} itens)`}
                title="Sua Sacola de Compras"
              >
                <ShoppingBag size={20} strokeWidth={1.5} />
                {cart && cart.itemCount > 0 && (
                  <span className={styles.bagBadge} id="cart-item-count">
                    {cart.itemCount}
                  </span>
                )}
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
              <span className={styles.mobileMenuTitle}>Coleções</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className={styles.mobileCloseBtn}
                aria-label="Fechar menu"
              >
                <X size={20} />
              </button>
            </div>
            <nav className={styles.mobileNavLinks}>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => handleCategoryClick(cat.slug)} className={styles.mobileNavLink}>
                  <span>{cat.name}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
              <button
                onClick={() => {
                  onNavigate('home');
                  setMobileMenuOpen(false);
                }}
                className={styles.mobileNavLink}
              >
                <span>Página Inicial</span>
                <ChevronRight size={16} />
              </button>
            </nav>
            <div className={styles.mobileMenuFooter}>
              <p className={styles.mobileBrandQuote}>“Detalhes que contam a sua história.”</p>
              <p className={styles.mobileCert}>Certificado de Autenticidade & Garantia Vitalícia do Ouro</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
