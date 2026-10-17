import { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { AuthModal } from './components/auth/AuthModal';
import { CartDrawer } from './features/cart/CartDrawer';
import { CheckoutModal } from './features/account/CheckoutModal';
import { OrdersModal } from './features/account/OrdersModal';
import { HomeView } from './features/home/HomeView';
import { CategoryView } from './features/catalog/CategoryView';
import { ProductDetailModal } from './features/products/ProductDetailModal';
import { AdminPanel } from './features/admin/AdminPanel';
import type { Product } from './services/api';

function AppContent() {
  const [currentView, setCurrentView] = useState<'home' | 'category'>('home');
  const [currentCategory, setCurrentCategory] = useState<string>('pulseiras');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const { setCheckoutModalOpen } = useCart();
  const { isOwner, setOrdersModalOpen } = useAuth();

  // Sync hash routing: e.g. #pulseiras, #correntes, #brincos, #home
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['pulseiras', 'correntes', 'brincos'].includes(hash)) {
        setCurrentView('category');
        setCurrentCategory(hash);
      } else {
        setCurrentView('home');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (view: string, param?: string) => {
    if (view === 'category' && param) {
      window.location.hash = param;
      setCurrentView('category');
      setCurrentCategory(param);
    } else {
      window.location.hash = '';
      setCurrentView('home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-layout">
      {/* Header with strictly centered logo and authentication-conditioned bag */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAdmin={() => setAdminOpen(true)}
      />

      {/* Main Content */}
      {currentView === 'home' && (
        <HomeView
          onNavigateCategory={(slug) => handleNavigate('category', slug)}
          onSelectProduct={(prod) => setSelectedProduct(prod)}
        />
      )}

      {currentView === 'category' && (
        <CategoryView
          categorySlug={currentCategory}
          onSelectProduct={(prod) => setSelectedProduct(prod)}
        />
      )}

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />

      {/* Progressive Authentication Modal (States 1 to 6) */}
      <AuthModal />

      {/* Shopping Bag Drawer (Rendered ONLY if authenticated) */}
      <CartDrawer
        onOpenCheckout={() => setCheckoutModalOpen(true)}
        onNavigateCatalog={() => handleNavigate('category', 'pulseiras')}
      />

      {/* Checkout Modal */}
      <CheckoutModal onOrderSuccess={() => setOrdersModalOpen(true)} />

      {/* Orders History Modal */}
      <OrdersModal />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {/* EXCLUSIVE OWNER ADMIN PANEL — Only rendered for Rodrigo Arrezzi */}
      {isOwner && adminOpen && (
        <AdminPanel onClose={() => setAdminOpen(false)} />
      )}
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
